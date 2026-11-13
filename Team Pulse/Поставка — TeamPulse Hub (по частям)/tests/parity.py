"""Golden-source parity for rich delayed responses and explicit zero metrics.

Uses the ordinary shipped chart as oracle, without changing it. Synthetic data
exercises office, growth, vacancy median and weekly AI paths; it is not a SQL or
production-volume benchmark. Start fixture_server.py first.
"""
import json
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('TP_BASE', 'http://127.0.0.1:8767/')
TABS = ['onepager', 'structure', 'movement', 'turnover', 'hiring',
        'tgrowth', 'monitor', 'office', 'ai']

# Only the obsolete availability presentation is intentionally different. No
# numeric cells, SVG labels, conclusions, chart geometry or headings are removed.
CONTENT = """() => {
  const el=document.querySelector('#view').cloneNode(true);
  el.querySelectorAll('.nav-dev,.dev-tag,.dev-note,.st-dev,.in-chip.dev').forEach(n=>n.remove());
  return el.textContent.replace(/\\s+/g,' ').trim();
}"""
MODEL = """() => {
  const D=window.TPDATA, S=window.__pvtState.tp.S;
  const lp=D.reportLeaves(S), bl=D.benchmarkLeaves(S);
  return {scope:window.TP_REAL.scopePath, applied:window.TP_REAL.applied,
    periods:D.METRICS.filter(m=>!m.off).map(m=>({key:m.key,stub:D.isStub(m.key),
      report:D.periodTotal(lp,m.key),base:D.periodTotal(bl,m.key)})),
    flags:{office:D.OFF_LIVE,growth:D.ROST_LIVE,ai:D.AI_CUTS},
    office:D.offDays(lp),growth:D.rostProfile(lp),weeks:D.aiWeeks(lp),ai:D.aiUsage(lp),
    peer:window.TP_REAL.peer};
}"""
ROW_FACTS = """() => [...document.querySelectorAll('#view .mrow[data-metric]')].map(r=>({
  key:r.dataset.metric,
  pending:r.classList.contains('tp-op-pending'),
  facts:[...r.querySelectorAll('.m-val,.col-num')].map(n=>n.textContent.replace(/\\s+/g,' ').trim())
}))"""


def compare_equal(actual, expected, label):
    if actual != expected:
        path = '/tmp/teampulse-parity-mismatch.json'
        with open(path, 'w') as f:
            json.dump({'check': label, 'split': actual, 'ordinary': expected}, f, ensure_ascii=False, indent=2)
        raise AssertionError(label + ': mismatch; details in ' + path)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        errors = []

        def open_page(query):
            page = browser.new_page(viewport={'width': 1440, 'height': 950})
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE + '?' + query)
            frame = next(f for f in page.frames if 'c=dict' in f.url or 'c=all' in f.url)
            frame.wait_for_selector('.nav-i[data-tab="onepager"]')
            return page, frame

        def settled(frame):
            frame.wait_for_function("!window.TP_PARTS || ['people','flow','aux'].every(k=>window.TP_PARTS.have[k])")
            frame.wait_for_function('!window.__pvtState.tp.pending')
            ready = frame.locator('[data-tp-details]')
            if ready.count():
                ready.click()

        def go(frame, tab):
            frame.locator('.nav-i[data-tab="'+tab+'"]').click()

        def compare_pages(split, ordinary, label):
            compare_equal(split.evaluate(MODEL), ordinary.evaluate(MODEL), label + ' data model')
            count = 0
            for tab in TABS:
                for frame in [split, ordinary]:
                    go(frame, tab)
                compare_equal(split.evaluate(CONTENT), ordinary.evaluate(CONTENT), label + ' ' + tab)
                # Identical final eligibility: background arrival must not leave
                # initialization-time development flags captured in closures.
                flags = '(tab)=>window.TPSCREENS.blocks[tab] ? window.TPSCREENS.blocks[tab].subTabs.map(s=>[s[0],window.TPSCREENS.devOf(tab,s[0])]) : []'
                compare_equal(split.evaluate(flags, tab), ordinary.evaluate(flags, tab), label + ' readiness ' + tab)
                subs = ordinary.locator('[data-subtab]').evaluate_all('(xs)=>[...new Set(xs.map(x=>x.dataset.subtab))]')
                for sub in subs:
                    for frame in [split, ordinary]:
                        frame.locator('[data-subtab="'+sub+'"]').first.click()
                    compare_equal(split.evaluate(CONTENT), ordinary.evaluate(CONTENT), label + ' ' + tab + '/' + sub)
                    count += 1
            print('PASS:', label, 'model, readiness and', count, 'subtabs match ordinary delivery', flush=True)

        def compare_ready_rows(split, ordinary, label):
            actual = split.evaluate(ROW_FACTS)
            expected = {r['key']: r['facts'] for r in ordinary.evaluate(ROW_FACTS)}
            assert split.locator('.mtable').count() >= 6, 'normal One-pager tables must appear with core'
            assert not split.locator('.tp-quick-table,.tp-core-preview').count(), 'temporary summary layout must not appear'
            for row in actual:
                if not row['pending']:
                    compare_equal(row['facts'], expected[row['key']], label + ' ready row ' + row['key'])
            return {r['key']: r for r in actual}

        # Each detail part is independently slow. The ordinary One-pager is
        # already the visible layout; only regions needing that part are pending.
        ref_page, ref = open_page('single=1&rich=1')
        for late in ['people', 'flow', 'aux']:
            delays = {part: 900 for part in ['people', 'flow', 'aux']}
            delays[late] = 5000
            query = 'rich=1&delay=core:100,' + ','.join(k+':'+str(v) for k, v in delays.items())
            pg, pf = open_page(query)
            assert not pf.evaluate('window.TP_PARTS.have.'+late), 'must observe incomplete response'
            rows = compare_ready_rows(pf, ref, late + ' first core')
            assert rows['time_to_fill']['pending'], 'do not flash mean before vacancy median arrives'
            assert rows['ai_penetration']['pending'], 'AI must await its weekly data'
            assert not pf.locator('.in-grid').count(), 'do not derive provisional conclusions'
            assert 'Загружа' in pf.locator('[data-metric="underwork"] .col-tgt').inner_text()
            # Trigger the real delegated click handler immediately, before
            # Playwright's scroll/stability wait lets the auxiliary response win.
            pf.locator('.mrow[data-metric="underwork"]').evaluate('(el)=>el.click()')
            assert pf.locator('.detail-row .svgchart').count(), 'ready metric expands in the normal table'
            assert 'Выводы и сравнения загружаются' in pf.locator('.detail-row').inner_text()
            # Wait only for the two non-delayed detail parts.
            pf.wait_for_function('(late)=>["people","flow","aux"].filter(k=>k!==late).every(k=>window.TP_PARTS.have[k])', arg=late)
            rows = compare_ready_rows(pf, ref, late + ' other parts ready')
            assert rows['time_to_fill']['pending'] == (late == 'flow')
            assert rows['ai_penetration']['pending'] == (late == 'aux')
            if late == 'aux':
                assert 'Загружа' in pf.locator('[data-metric="underwork"] .col-tgt').inner_text()
                assert not pf.locator('.in-grid').count()
            else:
                compare_equal(pf.locator('[data-metric="underwork"] .col-tgt').inner_text(),
                              ref.locator('[data-metric="underwork"] .col-tgt').inner_text(), late+' reference ready')
            settled(pf)
            compare_ready_rows(pf, ref, late + ' completed')
            pg.close()
        ref_page.close()
        print('PASS: normal One-pager from core; independently delayed parts; ready values match golden rows; safe expansion and references', flush=True)

        page, split = open_page('rich=1&delay=core:100,people:1600,flow:2300,aux:3200')
        assert not split.evaluate('window.TP_PARTS.have.aux'), 'fixture must exercise partial first render'
        assert not split.evaluate('!!window.TPDATA.MIX_BY_KEY.stream'), 'core must not contain stream dimensions'
        stream_tabs = 'window.TPSCREENS.blocks.structure.subTabs.map(t=>t[0])'
        assert 'stream' not in split.evaluate(stream_tabs), 'no invented stream tab before its source arrives'
        assert 'в разработ' not in split.locator('body').inner_text().lower()
        assert 'метрик в норме' not in split.locator('#view').inner_text(), 'premature peer-dependent conclusion'
        split.wait_for_function('window.TP_PARTS.have.people')
        assert split.evaluate('!!window.TPDATA.MIX_BY_KEY.stream'), 'people must populate stream dimensions'
        assert 'stream' in split.evaluate(stream_tabs), 'late people must restore the stream tab without a new core'
        single, ordinary = open_page('single=1&rich=1')
        settled(split)
        flags = ordinary.evaluate(MODEL)['flags']
        assert flags['growth'] and flags['ai'], 'rich fixture must exercise real growth and AI cuts'
        assert flags['office']['cal'] and flags['office']['city'] and flags['office']['seg'], 'rich fixture must exercise real office cuts'
        compare_pages(split, ordinary, 'rich initial response')

        # Change unit while retaining all production detail shapes. Both charts
        # execute their own real filter path, not a manually changed model.
        for frame in [split, ordinary]:
            frame.locator('#btnSetup').click()
            frame.locator('[data-upick="T/A"]').click()
            frame.locator('#btnApply').click()
        for frame in [split, ordinary]:
            frame.wait_for_function('window.TP_REAL.req[0]==="A" && !window.__pvtState.tp.pending')
            settled(frame)
        compare_pages(split, ordinary, 'rich filtered response')

        # A dimension can legitimately disappear for another selection. The
        # current model controls both navigation and the chapter's dimension
        # list; returning must restore both, with the new category labels.
        for unit in ['B', 'A']:
            for frame in [split, ordinary]:
                go(frame, 'structure')
                frame.locator('#btnSetup').click()
                frame.locator('[data-upick="T/'+unit+'"]').click()
                frame.locator('#btnApply').click()
            for frame in [split, ordinary]:
                frame.wait_for_function('(unit)=>window.TP_REAL.req[0]===unit && !window.__pvtState.tp.pending', arg=unit)
                settled(frame)
            compare_equal(split.evaluate(MODEL), ordinary.evaluate(MODEL), 'stream selection '+unit+' model')
            compare_equal(split.evaluate(stream_tabs), ordinary.evaluate(stream_tabs), 'stream selection '+unit+' tabs')
            assert ('stream' in split.evaluate(stream_tabs)) == (unit == 'A')
            if unit == 'A':
                for frame in [split, ordinary]:
                    frame.locator('[data-subtab="stream"]').first.click()
                assert 'Аналитика' in split.locator('#view').inner_text()
            compare_equal(split.evaluate(CONTENT), ordinary.evaluate(CONTENT), 'stream selection '+unit+' chapter')
        print('PASS: stream dimension absent in core, added by people, removed for B and restored for A; tab and chapter match golden', flush=True)

        page.close()
        single.close()
        zp, zs = open_page('rich=1&zero=1&delay=people:1200,flow:1700,aux:2300')
        op, osf = open_page('single=1&rich=1&zero=1')
        settled(zs)
        # Zero fields must not be reclassified to hide their golden eligibility.
        compare_equal(zs.evaluate(MODEL), osf.evaluate(MODEL), 'explicit zero-valued data model')
        assert not errors, json.dumps(errors, ensure_ascii=False)
        print('PASS: explicit zeros preserve golden availability/calculations; no browser errors', flush=True)
        browser.close()


if __name__ == '__main__':
    main()

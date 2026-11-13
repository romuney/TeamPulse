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

        page, split = open_page('rich=1&delay=core:100,people:1600,flow:2300,aux:3200')
        assert not split.evaluate('window.TP_PARTS.have.aux'), 'fixture must exercise partial first render'
        assert 'в разработ' not in split.locator('body').inner_text().lower()
        assert 'метрик в норме' not in split.locator('#view').inner_text(), 'premature peer-dependent conclusion'
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

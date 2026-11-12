"""Run against fixture_server.py; Playwright + Chromium required."""
from playwright.sync_api import sync_playwright
import json

BASE = 'http://127.0.0.1:8767/'
TABS = ['onepager', 'structure', 'movement', 'turnover', 'hiring', 'tgrowth', 'monitor', 'office', 'ai']


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        errors = []

        def open_page(query=''):
            page = b.new_page(viewport={'width': 1440, 'height': 950})
            page.on('pageerror', lambda e: errors.append(e.stack))
            page.goto(BASE + '?' + query)
            page.wait_for_timeout(900)
            f = next(f for f in page.frames if 'c=dict' in f.url or 'c=all' in f.url)
            f.wait_for_selector('.nav-i[data-tab="onepager"]')
            return page, f

        def settled(f):
            f.wait_for_function('!document.querySelector(".chip.part") && !document.querySelector(".tp-busy")')

        def go(f, tab):
            f.locator('.nav-i[data-tab="'+tab+'"]').click()

        def compare(a, c):
            for tab in TABS:
                for f in [a, c]:
                    go(f, tab)
                assert a.locator('#view').inner_text() == c.locator('#view').inner_text(), tab
                subs = a.locator('[data-subtab]').evaluate_all('(xs)=>[...new Set(xs.map(x=>x.dataset.subtab))]')
                for sub in subs:
                    for f in [a, c]:
                        f.locator('[data-subtab="'+sub+'"]').first.click()
                    assert a.locator('#view').inner_text() == c.locator('#view').inner_text(), tab+'/'+sub

        # Real delivered minified JS in opaque iframes, staggered arrivals.
        page, f = open_page('delay=people:3000,flow:4500,aux:6000')
        f.evaluate('window.keepRoot=document.querySelector(".tp-overlay");window.keepView=document.querySelector("#view")')
        go(f, 'monitor')
        assert f.locator('.tp-core-preview .svgchart').count() == 2
        assert f.locator('.part-wait').count() == 1
        f.wait_for_function('window.TP_PARTS.have.people')
        assert f.locator('.part-wait').count() == 0
        f.evaluate('window.keepContent=document.querySelector("#view").firstElementChild')
        f.wait_for_function('window.TP_PARTS.have.flow')
        assert f.evaluate('window.keepContent===document.querySelector("#view").firstElementChild'), 'unrelated flow redrew monitor'
        settled(f)
        assert f.evaluate('keepRoot===document.querySelector(".tp-overlay")&&keepView===document.querySelector("#view")')
        single, sf = open_page('single=1')
        compare(f, sf)
        print('PASS: partial charts, stable root, unrelated flow, all tabs/subtabs match ordinary chart', flush=True)

        # Applying a new unit on Monitor: core alone must not reset the old view;
        # core+people unlock it before flow/aux arrive.
        go(f, 'monitor')
        page.evaluate('DELAY.core=300;DELAY.people=2200;DELAY.flow=6000;DELAY.aux=7000')
        f.locator('#btnSetup').click()
        f.locator('[data-upick="T/A"]').click()
        f.locator('#btnApply').click()
        page.wait_for_timeout(800)
        assert f.locator('.tp-busy').count() == 1
        assert f.evaluate('keepRoot===document.querySelector(".tp-overlay")'), 'core applied before monitor ready'
        f.wait_for_function('!document.querySelector(".tp-busy") && window.TP_REAL.req[0]==="A"')
        assert f.locator('.nav-i.active').get_attribute('data-tab') == 'monitor'
        assert f.locator('.part-wait').count() == 0
        assert not f.evaluate('window.TP_PARTS.have.flow || window.TP_PARTS.have.aux')
        assert f.evaluate('window.TPDATA.lastVal(window.TPDATA.reportLeaves(window.__pvtState.tp.S),"hc_total")') == 40
        f.evaluate('window.filterRoot=document.querySelector(".tp-overlay")')
        # Keep settings open while remaining responses arrive.
        f.locator('#btnSetup').click()
        page.wait_for_timeout(5500)
        assert f.locator('#btnApply').is_visible()
        assert f.evaluate('filterRoot===document.querySelector(".tp-overlay")')
        f.locator('#btnApply').click()
        settled(f)
        filtered, ff = open_page('single=1&unit=A')
        compare(f, ff)
        print('PASS: Monitor filter waits only core+people, 40 people shown, settings retained, filtered parity', flush=True)

        # Regression: the late response of an earlier selection cannot undo B.
        race, rf = open_page()
        settled(rf)
        go(rf, 'monitor')
        def choose(unit, delay):
            race.evaluate('(d)=>{DELAY.core=d;DELAY.people=d;DELAY.flow=d;DELAY.aux=d}', delay)
            rf.locator('#btnSetup').click()
            rf.locator('[data-upick="T/'+unit+'"]').click()
            rf.locator('#btnApply').click()
        choose('A', 3500)
        race.wait_for_timeout(300)
        choose('B', 700)
        rf.wait_for_function('window.TP_REAL.req[0]==="B" && !window.__pvtState.tp.pending')
        race.wait_for_timeout(3500)
        assert rf.evaluate('window.TP_REAL.req[0]') == 'B'
        assert rf.evaluate('window.TPDATA.lastVal(window.TPDATA.reportLeaves(window.__pvtState.tp.S),"hc_total")') == 60
        # A new active tab uses data already received; it need not await people.
        nav, nf = open_page()
        settled(nf)
        go(nf, 'monitor')
        nav.evaluate('DELAY.core=200;DELAY.people=5000;DELAY.flow=6000;DELAY.aux=7000')
        nf.locator('#btnSetup').click()
        nf.locator('[data-upick="T/A"]').click()
        nf.locator('#btnApply').click()
        nav.wait_for_timeout(700)
        go(nf, 'onepager')
        nf.wait_for_function('window.TP_REAL.req[0]==="A" && !window.__pvtState.tp.pending', timeout=1500)
        assert not nf.evaluate('window.TP_PARTS.have.people')
        # Return to the already displayed B while A is pending (same core hash).
        choose('A', 3500)
        race.wait_for_timeout(300)
        choose('B', 700)
        rf.wait_for_function('!window.__pvtState.tp.pending', timeout=1500)
        race.wait_for_timeout(3500)
        assert rf.evaluate('window.TP_REAL.req[0]') == 'B'
        print('PASS: late old filter ignored; changing active tab immediately rechecks readiness', flush=True)

        focus, fof = open_page('delay=aux:4500')
        fof.wait_for_function('window.TP_PARTS.have.people && window.TP_PARTS.have.flow')
        go(fof, 'monitor')
        fof.locator('[data-tsearch]').fill('Отдел')
        fof.locator('[data-tsearch]').evaluate('(e)=>{e.focus();e.setSelectionRange(2,4)}')
        settled(fof)
        assert fof.evaluate('document.activeElement.hasAttribute("data-tsearch")')
        assert fof.evaluate('[document.activeElement.selectionStart,document.activeElement.selectionEnd]') == [2,4]
        # Reading a core chart must not be replaced by another layout mid-scroll.
        reading, readf = open_page('delay=people:4500,flow:5000,aux:5500')
        reading.set_viewport_size({'width': 1440, 'height': 700})
        reading.wait_for_timeout(150)
        go(readf, 'monitor')
        readf.evaluate('window.readChart=document.querySelector(".tp-core-preview .panel");document.querySelector(".tp-overlay").scrollTop=240;window.readTop=readChart.getBoundingClientRect().top')
        assert readf.evaluate('document.querySelector(".tp-overlay").scrollTop') > 80
        readf.wait_for_selector('[data-tp-details]', timeout=7000, state='attached')
        assert readf.evaluate('readChart===document.querySelector(".tp-core-preview .panel")')
        assert readf.evaluate('Math.abs(readChart.getBoundingClientRect().top-readTop)') < 3
        assert readf.locator('[data-tp-details]').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}')
        readf.locator('[data-tp-details]').click()
        assert readf.locator('.tp-core-preview').count() == 0
        assert readf.locator('.nav-i.active').get_attribute('data-tab') == 'monitor'
        print('PASS: search focus/selection and scrolled chart preserved during background updates', flush=True)

        # Timeout is visible; available charts remain useful.
        missing, mf = open_page('drop=people')
        go(mf, 'monitor')
        assert mf.locator('.tp-core-preview .svgchart').count() == 2
        go(mf, 'ai')
        # aux normally arrives quickly; a dedicated absent-aux page checks wording.
        noai, af = open_page('drop=aux')
        go(af, 'ai')
        assert 'Готовые показатели уже доступны' not in af.locator('#view').inner_text()
        assert 'Загружаю данные' in af.locator('.part-wait').inner_text()
        go(mf, 'monitor')
        mf.wait_for_selector('.part-wait.late', timeout=25000)
        assert 'Не удалось загрузить подробности' in mf.locator('.part-wait.late').inner_text()
        assert mf.locator('.tp-core-preview .svgchart').count() == 2
        print('PASS: missing response reports error without hiding available metrics', flush=True)

        stale, stf = open_page('stale=people')
        settled(stf)
        masks = stale.evaluate('window.__stand.masks')
        assert len(masks) == 1 and any(m['column'] == 'tp_nonce' for m in masks[0])
        assert not stf.evaluate('window.TP_PARTS.mixed')
        assert not errors, json.dumps(errors, ensure_ascii=False)
        print('PASS: stale cache repaired; no browser errors', flush=True)
        b.close()


if __name__ == '__main__':
    main()

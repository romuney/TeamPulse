"""Regression for flames -> normal report, with independently delayed parts."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('TP_BASE', 'http://127.0.0.1:8767/')
OUT = Path(os.environ.get('TP_SHOTS', '/tmp/teampulse-loading'))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        errors = []

        def open_page(query, width=1440):
            page = browser.new_page(viewport={'width': width, 'height': 950})
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE + '?rich=1&' + query)
            frame = next(f for f in page.frames if 'c=dict' in f.url)
            return page, frame

        page, frame = open_page('delay=dict:100,core:1800,people:4500,flow:5000,aux:5500')
        frame.wait_for_function('window.TPPARTS')
        assert frame.locator('.tp-boot,.tp-quick-table,.tp-overlay').count() == 0
        assert frame.evaluate('getComputedStyle(document.documentElement).backgroundColor') == 'rgba(0, 0, 0, 0)'
        assert page.evaluate('getComputedStyle(document.body).backgroundImage').startswith('url("data:image/svg+xml')
        page.screenshot(path=str(OUT/'01-existing-flames.png'))
        frame.wait_for_selector('.op-keep .mrow[data-metric="hc_total"]')
        assert not frame.evaluate('TP_PARTS.have.people || TP_PARTS.have.flow || TP_PARTS.have.aux')
        assert frame.locator('.tp-quick-table,.tp-boot,[data-tp-details]').count() == 0
        assert frame.locator('[data-metric="hc_total"] .m-val').inner_text().startswith('100')
        page.screenshot(path=str(OUT/'02-normal-report-core.png'))
        frame.wait_for_function('TP_PARTS.have.people&&TP_PARTS.have.flow&&TP_PARTS.have.aux')
        frame.wait_for_function('__pvtState.tp.perf.frames.some(f=>f.partsReady===3&&f.frameOpportunityMs!==null)')
        perf = frame.evaluate('__pvtState.tp.perf')
        assert len(perf['frames']) <= 40
        assert perf['frames'][0]['partsReady'] == 0
        for timing in perf['frames']:
            assert set(timing) == {'id', 'intent', 'intentAtMs', 'startMs', 'partsReady',
                                   'phasesMs', 'applyEndMs', 'frameOpportunityMs', 'superseded'}
            assert set(timing['phasesMs']) <= {'merge', 'model', 'data', 'render', 'nav'}
            assert timing['applyEndMs'] >= timing['startMs']
            if timing['frameOpportunityMs'] is not None:
                assert timing['frameOpportunityMs'] >= timing['applyEndMs']
        assert all(k in perf['frames'][-1]['phasesMs'] for k in ['merge', 'model', 'data', 'render', 'nav'])
        page.screenshot(path=str(OUT/'03-normal-report-complete.png'))
        print('PASS: existing flames -> normal One-pager before background responses; no intermediate layout', flush=True)
        page.close()

        for missing in ['people', 'flow', 'aux']:
            page, frame = open_page('drop='+missing+'&delay=dict:100,core:300,people:400,flow:500,aux:600')
            frame.wait_for_selector('.op-keep .mtable')
            frame.wait_for_function('(m)=>["people","flow","aux"].every(k=>k===m||TP_PARTS.have[k])', arg=missing)
            assert frame.locator('[data-metric="hc_total"] .m-val').inner_text().startswith('100')
            assert frame.locator('.tp-busy').count() == 0
            assert frame.locator('[data-metric="time_to_fill"].tp-op-pending').count() == (1 if missing == 'flow' else 0)
            assert frame.locator('[data-metric="ai_wau"].tp-op-pending').count() == (1 if missing == 'aux' else 0)
            if missing == 'aux':
                assert frame.locator('.chip.bench[role="status"]').inner_text() == 'База сравнения загружается'
                frame.locator('#btnSetup').click()
                assert 'Подразделений такого же размера для сравнения нет' not in frame.locator('#benchPreview').inner_text()
                frame.locator('#btnApply').click()
            frame.locator('[data-metric="hc_total"]').click()
            assert frame.locator('.detail-row .svgchart').count() > 0
            print('PASS: missing '+missing+' does not block independent rows or expansion', flush=True)
            page.close()

        for width in [1440, 768, 420]:
            page, frame = open_page('delay=dict:100,core:300,people:700,flow:900,aux:3500', width)
            frame.wait_for_selector('.op-keep .mtable')
            frame.wait_for_function('TP_PARTS.have.people&&TP_PARTS.have.flow')
            frame.evaluate('''() => {
              const row=document.querySelector('[data-metric="hire"]');
              document.querySelector('.tp-overlay').scrollTop+=row.getBoundingClientRect().top-180;
              window.readTop=row.getBoundingClientRect().top;
            }''')
            frame.locator('#op-movement button').evaluate('(e)=>e.focus({preventScroll:true})')
            frame.wait_for_function('TP_PARTS.have.aux')
            shift = frame.evaluate('document.querySelector("[data-metric=hire]").getBoundingClientRect().top-readTop')
            assert abs(shift) < 3, (width, shift)
            assert frame.evaluate('!!document.activeElement.closest("#op-movement")')
            assert frame.locator('[data-tp-details],.tp-quick-table').count() == 0
            print('PASS: reading position and focus preserved at width', width, flush=True)
            page.close()
        page, frame = open_page('drop=core')
        frame.wait_for_selector('.tp-boot-error [role=alert]', timeout=23000)
        assert frame.locator('.op-keep,.tp-boot,.tp-quick-table').count() == 0
        print('PASS: absent core produces a bounded error, not an endless blank/loader', flush=True)
        page.close()
        assert not errors, errors
        browser.close()


if __name__ == '__main__':
    main()

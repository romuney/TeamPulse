"""Exercise the offline board through the actual settings dialog and filter echo."""
import os
import shutil
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

preview = Path(__file__).parent / 'previews/single-debug.html'
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH') or shutil.which('chromium'))
    page = browser.new_page(viewport={'width':1440, 'height':960})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(preview.read_text())
    chart = page.frame_locator('iframe')
    frame = page.frames[1]
    expect(chart.locator('#btnSetup')).to_be_visible()
    frame.evaluate("""()=>{
        const schedule=window.setTimeout;
        window.requestTimeouts=[];
        window.setTimeout=(cb,delay,...args)=>{
            if(delay===45000)requestTimeouts.push(cb);
            return schedule(cb,delay,...args);
        };
    }""")
    for unit, mode in [('A','deferred'), ('B','loaded'), ('R','deferred')]:
        if unit=='R':
            chart.locator('.nav-i[data-tab="structure"]').click()
        chart.locator('#btnSetup').click()
        path = 'T' if unit=='R' else 'T/'+unit
        chart.locator('[data-upick="'+path+'"]').click()
        chart.locator('#btnApply').click()
        if unit=='B':
            # A callback already queued by the previous generation must ignore B.
            assert frame.evaluate("""()=>{
                const pending=window.__pvtState.tp.pending;
                requestTimeouts[0]();
                return !!pending && window.__pvtState.tp.pending===pending;
            }""")
        frame.wait_for_function('([u,m])=>TP_REAL.scopeId===u && TP_REAL.reviewMode===m && !__pvtState.tp.pending', arg=[unit,mode])
        if unit=='A':
            chart.locator('.nav-i[data-tab="review"]').click()
            chart.locator('[data-subtab="how"]').click()
        if unit!='R':
            expect(chart.locator('.review-matrix').first.locator('tr.total td').nth(1)).to_have_text('40' if unit=='A' else '60')
        chart.locator('#btnSetup').click()
        chart.locator('#reportTiming summary').click()
        expect(chart.locator('#reportTiming p')).to_contain_text('От отправки фильтра')
        chart.locator('#btnApply').click()
    assert not errors,errors
    browser.close()
    print('PASS: filters, review on demand, stale timeout, diagnostics, return to root')

"""Exercise the shipped split chart against fixture_server.py with and without growth cuts."""
import os
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'))
    for rich in (False, True):
        page = browser.new_page(viewport={'width': 1440, 'height': 950})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:8767/?rich=' + str(int(rich)))
        chart = page.frame_locator('iframe[src*="c=dict"]')
        unit = 'A' if rich else 'B'
        chart.locator('#btnSetup').click()
        chart.locator('[data-upick="T/'+unit+'"]').click()
        chart.locator('#btnApply').click()
        frame = next(f for f in page.frames if 'c=dict' in f.url)
        frame.wait_for_function('unit=>window.TP_REAL.req[0]===unit && !window.__pvtState.tp.pending', arg=unit)
        chart.locator('.nav-i[data-tab="tgrowth"]').click()
        for sub in ('grades', 'spec'):
            chart.locator('[data-subtab="'+sub+'"]').click()
            panel = chart.locator('.split-r')
            if rich:
                expect(panel).to_contain_text('Текущий → желаемый' if sub=='grades' else 'Смена специализации по месяцам')
            else:
                expect(panel).to_contain_text('Нет данных о росте')
                expect(panel.locator('table, .svgchart')).to_have_count(0)
            expect(chart.locator('#view .dev-note, #view .dev-tag, #view .st-dev')).to_have_count(0)
        assert not errors, errors
        page.close()
    browser.close()
print('PASS: missing and populated growth cuts in the shipped split chart')

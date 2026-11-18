"""Exercise the actual single-delivery CSS in a native dashboard fixture, including CSS scope."""
from pathlib import Path
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
CSS = (ROOT / 'Поставка — TeamPulse Hub/4. CSS борда (дописать в конец).css').read_text()
MD = (ROOT / 'Поставка — TeamPulse Hub/7. Markdown — управление шапкой.md').read_text()
BASE = '''html,body{margin:0;font:14px Arial}#main-menu{height:48px;background:#fff}
.dashboard-header-container{height:65px;box-sizing:border-box;display:flex;align-items:center;gap:24px;background:white}
.dashboard-header-container h1{font-size:18px;margin:0}.grid-container{padding:0}.resizable-container{height:900px}
iframe{box-sizing:border-box}.dashboard{display:flow-root}button{font:14px Arial}'''
CONTROL = '''<div class="dragdroppable-row"><div class="with-popover-menu"><div class="grid-row"><div class="dragdroppable"><div class="with-popover-menu"><div class="resizable-container"><div class="dashboard-markdown"><p><a href="#app" title="Открыть шапку дашборда">Открыть шапку дашборда</a></p><p><a href="#tp-header-closed-814002">Закрыть шапку дашборда</a></p></div></div></div></div></div></div></div>'''
BODY = '''<div id="app"><nav id="main-menu">Proteus</nav><div class="dashboard"><header class="dashboard-header-container"><h1>TeamPulse</h1><button id="menu">Меню</button><button id="edit">Edit</button></header><div class="dashboard-content"><div class="grid-container"><div class="dashboard-grid"><div class="grid-content">CONTROL<div class="report-row"><div class="resizable-container"><div class="dashboard-component-chart-holder dashboard-chart-id-814002"><div class="chart-container"><div id="chart-id-814002" class="react_sanbbox"><iframe title="Отчёт" srcdoc="&lt;h1&gt;TeamPulse Hub&lt;/h1&gt;"></iframe></div></div></div></div></div></div></div></div></div></div></div>'''

def rect(page):
    return page.locator('iframe').bounding_box()

def close(page):
    # Visible pseudo-element of the ordinary close link, below the eight-pixel hotspot.
    page.mouse.click(page.viewport_size['width'] - 80, 80)

def run():
    assert '#tp-header-closed-814002' in MD and '#app' in MD
    n = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), args=['--no-sandbox'])
        for scope in ('', '#app', '.dashboard'):
            for width, height in ((1440, 900), (768, 768), (420, 800)):
                page = browser.new_page(viewport={'width':width,'height':height})
                css = '@scope ('+scope+') {'+CSS+'}' if scope else CSS
                page.set_content('<style>'+BASE+'</style><style>'+css+'</style>'+BODY.replace('CONTROL',CONTROL))
                header=page.locator('.dashboard-header-container')
                assert header.evaluate('(e)=>getComputedStyle(e).position') == 'fixed'
                hidden=rect(page)
                # Neither hover nor a click outside the narrow top-right corner opens it.
                page.mouse.move(width-80,52)
                assert header.evaluate('(e)=>getComputedStyle(e).position') == 'fixed'
                page.mouse.click(30,52)
                assert header.evaluate('(e)=>getComputedStyle(e).position') == 'fixed'
                page.mouse.click(width-80,52)
                assert header.evaluate('(e)=>getComputedStyle(e).position') == 'relative'
                opened=rect(page)
                assert abs(opened['y']-hidden['y']-65)<1,(scope,width,hidden,opened)
                assert abs(opened['height']-hidden['height']+65)<1
                assert abs(opened['y']+opened['height']-hidden['y']-hidden['height'])<1
                assert opened['width']==hidden['width']
                assert header.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(255, 255, 255)'
                if not scope and width==1440:page.screenshot(path='/tmp/teampulse-header-open.png')
                page.mouse.click(width-80,52)
                assert header.evaluate('(e)=>getComputedStyle(e).position')=='fixed'
                page.mouse.click(width-80,52)
                assert header.evaluate('(e)=>getComputedStyle(e).position')=='relative'
                close(page)
                assert header.evaluate('(e)=>getComputedStyle(e).position')=='fixed'
                # Keyboard can activate both native links.
                page.locator('a[title="Открыть шапку дашборда"]').focus()
                page.keyboard.press('Enter')
                assert header.evaluate('(e)=>getComputedStyle(e).position')=='relative'
                page.locator('#menu').focus()
                page.evaluate('history.replaceState(null,"", "about:blank")')
                assert header.evaluate('(e)=>getComputedStyle(e).position')=='relative'
                page.locator('a[href="#tp-header-closed-814002"]').focus()
                page.keyboard.press('Enter')
                assert header.evaluate('(e)=>getComputedStyle(e).position')=='fixed'
                page.locator('.dashboard').evaluate('(e)=>e.classList.add("dashboard--editing")')
                assert header.evaluate('(e)=>getComputedStyle(e).position')=='static'
                page.close();n+=1
        for control in ('',CONTROL.replace('href="#app"','href="#missing"'),CONTROL.replace('href="#app"','target="_blank" href="#app"')):
            page=browser.new_page()
            page.set_content('<style>'+BASE+CSS+'</style>'+BODY.replace('CONTROL',control))
            assert page.locator('.dashboard-header-container').evaluate('(e)=>getComputedStyle(e).position')=='static'
            page.close();n+=1
        browser.close()
    print(f'PASS: {n} native-header scenarios (global/scoped CSS, 3 sizes, click, keyboard, Edit, missing/broken controls)')

if __name__=='__main__':run()

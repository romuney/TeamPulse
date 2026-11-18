"""Browser check on synthetic aggregate rows emitted by review.cjs; no external data."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json, os, shutil, sys, threading
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
rows=json.loads(Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/tp-review-browser-rows.json').read_text())
html=(ROOT/'index.html').read_text().replace('<script src="data.js"></script>',
    '<script src="proteus/real.js"></script><script>window.TP_REAL=window.TPREAL.build('+json.dumps(rows).replace('</','<\\/')+');</script><script src="data.js"></script>')
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        if self.path.split('?')[0]=='/review-fixture.html':
            data=html.encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(data)
        else:super().do_GET()
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
        for width in (1440,768,420):
            page=browser.new_page(viewport={'width':width,'height':1000})
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{server.server_port}/review-fixture.html?tour=0')
            if width<=780:page.locator('#navToggle').click()
            page.locator('[data-tab="review"]').click()
            page.locator('.review-screen').wait_for()
            assert 'Общая численность' in page.locator('.review-screen').inner_text()
            assert 'Из них eligible' in page.locator('.review-screen').inner_text()
            assert not errors,errors
            if width==1440:page.screenshot(path='/tmp/teampulse-review-who.png',full_page=True)
            page.locator('[data-subtab="how"]').click()
            assert page.locator('.review-matrix').count()==3
            assert '33,3%' in page.locator('.review-matrix').first.inner_text()
            assert '66,7%' in page.locator('.review-matrix').first.inner_text()
            assert page.locator('a[href$="#d-001-h1"]').count()==1
            # Percent headers explain the eligible denominator via the shared tooltip.
            headers=page.locator('.review-matrix').first.locator('th')
            assert 'доля 3–4' in headers.last.inner_text().lower(),headers.last.inner_text()
            assert page.locator('.review-matrix').first.locator('tbody tr').count()==4
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),(width,'page overflow')
            if width==420:
                box=page.locator('.review-matrix').first.locator('..')
                assert box.evaluate('(e)=>e.scrollWidth>e.clientWidth'), 'matrix must scroll horizontally inside the panel'
            if width==1440:page.screenshot(path='/tmp/teampulse-review-how.png',full_page=True)
            # Switching sections preserves annual results and does not revive old mock review.
            page.locator('[data-subtab="who"]').click()
            assert 'Из них eligible' in page.locator('.review-screen').inner_text()
            page.locator('[data-subtab="how"]').click()
            assert '33,3%' in page.locator('.review-matrix').first.inner_text()
            assert not errors,errors
            page.close()
        # Execute the shipped ES5/minified artifact in an opaque-origin sandbox.
        code=(ROOT/'Поставка — TeamPulse Hub/3. Proteus — чарт TeamPulse Hub.js').read_text()
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content("""<iframe title="Proteus sandbox" sandbox="allow-scripts" style="width:100%;height:980px;border:0" srcdoc='<html><body style="margin:0"><div _echarts_instance_="test" style="height:100vh"></div></body></html>'></iframe>""")
        frame=page.frame_locator('iframe')
        frame.locator('[_echarts_instance_]').wait_for()
        page.frames[1].evaluate("({rows,code})=>{window.data=rows;window.option=null;window.applyCrossFilter=mask=>window.lastMask=mask;const s=document.createElement('script');s.textContent=code;document.body.appendChild(s)}",{'rows':rows,'code':code})
        try:frame.locator('[data-tab="review"]').click(timeout=8000)
        except Exception:
            print('Sandbox errors:',errors,flush=True)
            print('Sandbox body:',frame.locator('body').inner_text()[:2000],flush=True)
            raise
        frame.locator('[data-subtab="how"]').click()
        assert frame.locator('.review-matrix').count()==3
        assert '33,3%' in frame.locator('.review-matrix').first.inner_text()
        assert 'ошибка чарта' not in frame.locator('body').inner_text()
        assert not errors,errors
        page.screenshot(path='/tmp/teampulse-review-sandbox.png',full_page=True)
        page.close()
        browser.close()
    print('PASS: review tabs, real adapter fixture, 3 widths, exact values, glossary links, contained horizontal scroll, no browser errors; shipped minified ES5 artifact in opaque-origin sandbox')
finally:server.shutdown();server.server_close()

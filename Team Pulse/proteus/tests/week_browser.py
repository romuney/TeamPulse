"""Browser check of the monitoring «Месяц | Неделя» switch on chart rows from week.cjs (synthetic, no employee data).
usage: python week_browser.py rows_week.json
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json, os, re, shutil, sys, threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
rows = json.loads(Path(sys.argv[1]).read_text())
html = (ROOT / 'index.html').read_text().replace('<script src="data.js"></script>',
    '<script src="proteus/real.js"></script><script>window.TP_REAL=window.TPREAL.build(' + json.dumps(rows).replace('</', '<\\/') +
    ');</script><script src="data.js"></script>')
class H(SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def do_GET(s):
        if s.path.split('?')[0] == '/w.html':
            d = html.encode(); s.send_response(200); s.send_header('Content-Type', 'text/html; charset=utf-8'); s.end_headers(); s.wfile.write(d)
        else: super().do_GET()
    def log_message(s, *a): pass
srv = ThreadingHTTPServer(('127.0.0.1', 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), args=['--no-sandbox'])
        for width in (1440, 768, 420):
            pg = b.new_page(viewport={'width': width, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'http://127.0.0.1:{srv.server_port}/w.html?tour=0')
            if width <= 780: pg.locator('#navToggle').click()
            pg.locator('.nav-i[data-tab="monitor"]').click(); pg.wait_for_timeout(200)
            right = pg.locator('.split-r')
            assert pg.locator('[data-monper="m"]').get_attribute('aria-pressed') == 'true', 'month by default'
            month_head = right.locator('.st-head h3').inner_text()
            pg.locator('[data-monper="w"]').click(); pg.wait_for_timeout(200)
            assert 'mper=w' in pg.url and pg.locator('[data-monper="w"]').get_attribute('aria-pressed') == 'true'
            txt = ' '.join(right.inner_text().split())  # numbers are kept with nbsp by richText
            assert re.search(r'Неделя 09\.11–15\.11: недоработка — 2 чел', ' '.join(right.locator('.st-head h3').inner_text().split())), txt[:300]
            assert 'последние 16 недель' in txt and 'Неделя к неделе не сравнивается' in txt and 'Недель без данных: 1' in txt, txt[:400]
            assert right.locator('.svgchart').count() == 3
            assert pg.locator('.split-l th').filter(has_text='за неделю').count() == 3, 'table columns follow the week'
            # the last closed week drives the table: unit 22 shows 4 people of week 09.11
            r22 = pg.locator('.split-l tr.urow').filter(has_text='Отдел 22').locator('td')
            assert r22.nth(1).inner_text() == '4', r22.all_inner_texts()
            assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), 'page overflow'
            # reload keeps the week; switching back restores the month view
            pg.reload(); pg.locator('.split-r').wait_for()
            assert pg.locator('[data-monper="w"]').get_attribute('aria-pressed') == 'true'
            pg.locator('[data-monper="m"]').click(); pg.wait_for_timeout(200)
            assert 'mper=w' not in pg.url and right.locator('.st-head h3').inner_text() == month_head
            assert not errs, errs
            pg.close()
        # 27.11: a unit without weekly rows under the filters ({weeks:[]}) — the table shows dashes, no «reading 'hc'»;
        # repeated switches keep working
        html_ok = html
        rows_no = json.loads(json.dumps(rows))
        for r in rows_no:
            if r.get('id') == '22': r['mx'] = '\n'.join(l for l in r['mx'].split('\n') if not l.startswith('mw\t'))
        html = (ROOT / 'index.html').read_text().replace('<script src="data.js"></script>',
            '<script src="proteus/real.js"></script><script>window.TP_REAL=window.TPREAL.build(' + json.dumps(rows_no).replace('</', '<\\/') +
            ');</script><script src="data.js"></script>')
        pg = b.new_page(viewport={'width': 1440, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{srv.server_port}/w.html?tour=0'); pg.locator('.nav-i[data-tab="monitor"]').click()
        for _ in range(3):
            pg.locator('[data-monper="w"]').click(); pg.wait_for_timeout(150); pg.locator('[data-monper="m"]').click(); pg.wait_for_timeout(150)
        pg.locator('[data-monper="w"]').click(); pg.wait_for_timeout(200)
        r22 = pg.locator('.split-l tr.urow').filter(has_text='Отдел 22').locator('td')
        assert [t.strip() for t in r22.all_inner_texts()[1:]] == ['—', '—', '—'], r22.all_inner_texts()
        assert pg.locator('.split-l tr.urow').filter(has_text='Отдел 11').locator('td').nth(1).inner_text() == '10'
        assert pg.locator('.split-r .svgchart').count() == 3 and not errs, errs
        if pg.locator('button.split-rail').count(): pg.locator('button.split-rail').first.click(); pg.wait_for_timeout(200)  # units panel is collapsed by default
        pg.locator('.split-l th[data-tsort^="hc:"]').first.click(); pg.wait_for_timeout(150)  # sort by people: missing goes last, not as 0
        assert 'Отдел 22' in pg.locator('.split-l tr.urow').last.inner_text() and not errs, errs
        pg.close(); html = html_ok
        # shipped minified ES5 artifact in an opaque-origin sandbox
        code = next((ROOT / 'Поставка — TeamPulse Hub').glob('3. *.js')).read_text()
        pg = b.new_page(viewport={'width': 1440, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.set_content("""<iframe sandbox="allow-scripts" style="width:100%;height:980px;border:0" srcdoc='<html><body style="margin:0"><div _echarts_instance_="t" style="height:100vh"></div></body></html>'></iframe>""")
        fr = pg.frame_locator('iframe'); fr.locator('[_echarts_instance_]').wait_for()
        pg.frames[1].evaluate("({rows,code})=>{window.data=rows;window.option=null;window.applyCrossFilter=m=>0;const s=document.createElement('script');s.textContent=code;document.body.appendChild(s)}", {'rows': rows, 'code': code})
        fr.locator('.nav-i[data-tab="monitor"]').click(timeout=15000); fr.locator('[data-monper="w"]').click(); pg.wait_for_timeout(300)
        assert 'последние 16 недель' in ' '.join(fr.locator('.split-r').inner_text().split()) and fr.locator('.split-r .svgchart').count() == 3
        assert 'ошибка чарта' not in fr.locator('body').inner_text() and not errs, errs
        b.close()
    print('PASS: monitoring month by default, week switch (charts, table columns, chapter head, window caption, gap note), '
          'URL keeps the week, back to month restores the view, 3 widths; shipped ES5 artifact in sandbox')
finally:
    srv.shutdown(); srv.server_close()

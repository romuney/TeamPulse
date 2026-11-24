"""Browser check on synthetic aggregate rows emitted by review.cjs; no external data."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json, os, re, shutil, sys, threading
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
rows=json.loads(Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/tp-review-browser-rows.json').read_text())
year=int(json.loads(rows[0]['j'])['rv'].split('|')[1])
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
            head=lambda:' '.join(page.locator('.review-screen .st-head h3').inner_text().split()) # richText keeps numbers with nbsp
            page.goto(f'http://127.0.0.1:{server.server_port}/review-fixture.html?tour=0')
            if width<=780:page.locator('#navToggle').click()
            page.locator('[data-tab="review"]').click()
            page.locator('.review-screen').wait_for()
            assert 'Общая численность' in page.locator('.review-screen').inner_text()
            assert 'Из них eligible' in page.locator('.review-screen').inner_text()
            assert not errors,errors
            # One outcome breakdown: six groups add up to all eligible (11), total in the caption.
            who=page.locator('.review-screen').inner_text()
            assert 'Что с оценкой у eligible' in who and 'Остальные результаты' not in who
            assert page.locator('.review-screen .bt-cap').filter(has_text='Что с оценкой у eligible').locator('b').inner_text()=='11'
            # Chapter head states facts only.
            assert head()=='В ревью '+str(year)+' оцениваем 11 из 13 человек'
            if width==1440:page.screenshot(path='/tmp/teampulse-review-who.png',full_page=True)
            page.locator('[data-subtab="how"]').click()
            # 23.11: three self-contained tables, each with its own caption, header row and total.
            assert page.locator('.review-matrix').count()==3
            assert page.locator('.review-matrix tr.hx-sec').count()==0 and page.locator('.review-matrix tr.total').count()==3
            assert [' '.join(t.split()) for t in page.locator('.review-screen .rv-tables .bt-cap').all_inner_texts()]==[
                'Распределение оценок по грейду','Распределение оценок по стажу','Распределение оценок по специализации']
            assert head()=='Огонь и выше — у 3 из 11 eligible'
            # Equal-width grid: every column of every table is the same width; header cells match body cells.
            grid=page.evaluate('''()=>[...document.querySelectorAll('.review-matrix')].map(t=>{const w=r=>[...r.children].map(c=>Math.round(c.getBoundingClientRect().width));
              return {head:w(t.querySelector('thead tr')),body:w(t.querySelector('tbody tr'))}})''')
            # grade: ten equal columns; tenure and specialization: first column 2.5x each of the other nine, equal among themselves.
            assert all(g['head']==g['body'] for g in grid),grid
            assert len(set(grid[0]['head']))==1,grid[0]
            assert all(len(set(g['head'][1:]))==1 and abs(g['head'][0]/g['head'][1]-2.5)<0.05 for g in grid[1:]),grid
            # Transitions and first ratings: people, share and a 0–100% bar of the same raw share; denominators named in captions.
            bt=page.evaluate('''()=>[...document.querySelectorAll('.review-screen .bt-group')].filter(g=>/Переходы между оценками|Первые оценки/.test(g.innerText)).map(g=>({
              cap:g.querySelector('.bt-cap').innerText,rows:[...g.querySelectorAll('tbody tr')].map(r=>{const c=r.querySelectorAll('td'),bar=r.querySelector('.cellbar i');
                return {n:+c[1].innerText,share:c[2].innerText,w:parseFloat(bar.style.width)}})}))''')
            assert len(bt)==2 and 'от всех с изменившейся оценкой' in bt[0]['cap'] and 'от всех впервые оценённых' in bt[1]['cap'],bt
            for g in bt:
                tot=sum(r['n'] for r in g['rows'])
                assert ('всего '+str(tot)) in ' '.join(g['cap'].split()),g['cap']
                for r in g['rows']:
                    assert abs(r['w']-100*r['n']/tot)<0.06 and r['share']==(f"{100*r['n']/tot:.1f}".replace('.',',').replace(',0','')+'%'),(r,tot)
            # No scale codes anywhere the user can see or hear: text, tooltips, alt, aria-labels.
            seen=page.evaluate('''()=>{const r=document.querySelector('.review-screen');return r.innerText+' '+
              [...r.querySelectorAll('[data-tip],[alt],[aria-label]')].map(e=>(e.getAttribute('data-tip')||'')+' '+(e.getAttribute('alt')||'')+' '+(e.getAttribute('aria-label')||'')).join(' ')}''')
            assert not re.search(r'0–1|3–4|0–4|\b[0-4] — |\([0-4]\)|Оценка [0-4]',seen),re.findall(r'.{20}(?:0–1|3–4|\b[0-4] — ).{20}',seen)
            assert '33,3%' in page.locator('.review-matrix').first.inner_text()
            assert '66,7%' in page.locator('.review-matrix').first.inner_text()
            assert page.locator('.review-matrix a').count()==0
            # Percent headers explain the eligible denominator via the shared tooltip.
            headers=page.locator('.review-matrix').first.locator('th')
            # 24.11: «% < [Хорошо]», «% > [Хорошо]»; former names in the shared tooltip, also on keyboard focus.
            assert ' '.join(headers.nth(8).inner_text().split())=='% <' and ' '.join(headers.last.inner_text().split())=='% >'
            assert headers.nth(8).locator('img').get_attribute('alt')=='Хорошо' and headers.last.locator('img').get_attribute('alt')=='Хорошо'
            assert headers.last.get_attribute('aria-label')=='Процент сотрудников с оценкой выше «Хорошо»'
            headers.last.focus();page.wait_for_timeout(100)
            assert page.locator('div.tip.on').count()==1 and page.locator('div.tip.on').inner_text().startswith('% огней и выше')
            page.keyboard.press('Shift+Tab');page.wait_for_timeout(100)
            assert page.locator('div.tip.on').inner_text().startswith('% есть над чем поработать и ниже')
            page.locator('body').click(position={'x':5,'y':5});page.evaluate('document.activeElement.blur()')
            # Rating icons: one per scale point in headers, transitions and first ratings; all decoded, alt = number + name.
            icons=page.locator('.review-screen img.rv-ico')
            assert icons.count()>=15,icons.count()
            assert page.evaluate("[...document.querySelectorAll('.review-screen img.rv-ico')].every(i=>i.complete&&i.naturalWidth>0&&(window.TPDATA.REVIEW_SCALE.includes(i.alt)||i.alt==='Хорошо')&&i.getBoundingClientRect().width===i.getBoundingClientRect().height)")
            assert headers.nth(3).locator('img').get_attribute('alt')=='не соответствует ожиданиям'
            assert headers.nth(7).locator('img').get_attribute('alt')=='звезда'
            # Checklist 12: tooltips only via data-tip, never the native title attribute (smoke cannot see this tab on mocks).
            assert page.locator('.review-screen [title]').count()==0
            assert headers.first.inner_text().strip()=='' # table name stands above the table, not in its first column
            assert page.locator('.review-matrix').first.locator('tbody tr').count()==4 # total + G1, H1, Не указано
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),(width,'page overflow')
            if width==420:
                box=page.locator('.review-matrix').first.locator('..')
                assert box.evaluate('(e)=>e.scrollWidth>e.clientWidth'), 'matrix must scroll horizontally inside the panel'
            if width==1440:page.screenshot(path='/tmp/teampulse-review-how.png',full_page=True)
            left=page.locator('#bk-det .split-l')
            right=page.locator('#bk-det .split-r')
            unit=left.locator('tr.urow').filter(has_text='Отдел 22')
            grade=right.locator('.review-matrix').first
            assert left.is_visible() and unit.locator('td').nth(1).inner_text()=='1'
            if width==1440:
                assert left.bounding_box()['x']<right.bounding_box()['x']
                # 24.11: wide panel (units collapsed) — blocks in one column, one left edge and one width, nothing overflows.
                page.locator('.unit-hide').first.click();page.wait_for_timeout(200)
                lay=page.evaluate('''()=>[...document.querySelectorAll('.review-screen .st-main>.bt-stack>*')].map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.width)]})''')
                assert len(lay)==6 and len({x[0] for x in lay})==1 and len({x[1] for x in lay})==1 and lay[0][1]<=960,lay
                assert page.evaluate("[...document.querySelectorAll('.review-matrix')].every(t=>t.parentElement.scrollWidth<=t.parentElement.clientWidth+1)")
                page.locator('button.split-rail').first.click();page.wait_for_timeout(200)
                # 512 px split panel < ten 80 px columns: the table scrolls inside its own wrapper, the page does not.
                assert grade.locator('..').evaluate('(e)=>e.scrollWidth>e.clientWidth')
                grade.locator('..').screenshot(path='/tmp/teampulse-review-heatmap.png')
                left.locator('[data-tsort="eligible:d"]').click()
                assert 'Отдел 11' in left.locator('tr.urow').first.inner_text()
                left.locator('[data-tsort="eligible:a"]').click()
                assert 'Отдел 22' in left.locator('tr.urow').first.inner_text()
            def grade_count():
                return grade.locator('tr.total td').nth(1).inner_text()
            def grade_four_color():
                return grade.locator('tbody tr').filter(has_text='G1').locator('td').nth(7).evaluate('(el)=>el.style.backgroundColor')
            assert grade_count()=='11'
            company_color=grade_four_color()
            unit.locator('.row-body').click()
            assert grade_count()=='1' and grade_four_color() and grade_four_color()!=company_color
            assert grade.locator('tbody tr').filter(has_text='G1').locator('td').nth(3).evaluate('(el)=>!el.style.backgroundColor')
            assert '100%' in grade.inner_text()
            page.locator('[data-subtab="who"]').click()
            assert 'Отдел 22' in left.locator('tr.sel').inner_text()
            assert 'Отдел 22' in right.inner_text()
            page.locator('[data-subtab="how"]').click()
            assert grade_count()=='1'
            unit.locator('.row-body').click()
            assert grade_count()=='11' and grade_four_color()==company_color
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
        assert page.frames[1].evaluate("(()=>{const a=[...document.querySelectorAll('img.rv-ico')];return a.length>=15&&a.every(i=>i.complete&&i.naturalWidth>0)})()")
        frame.locator('.split-l tr.urow').filter(has_text='Отдел 22').locator('.row-body').click()
        assert frame.locator('.review-matrix').first.locator('tr.total td').nth(1).inner_text()=='1'
        assert 'ошибка чарта' not in frame.locator('body').inner_text()
        assert not errors,errors
        page.screenshot(path='/tmp/teampulse-review-sandbox.png',full_page=True)
        page.close()
        browser.close()
    print('PASS: review tabs, rating icons decoded with alt, real adapter fixture, 3 widths, exact values, plain category labels, contained horizontal scroll, no browser errors; shipped minified ES5 artifact in opaque-origin sandbox')
finally:server.shutdown();server.server_close()

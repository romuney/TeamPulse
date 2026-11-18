"""Build an offline single-chart Proteus test board with synthetic departments."""
import json
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[2]
delivery = ROOT / 'Поставка — TeamPulse Hub'
fixture = runpy.run_path(str(ROOT / 'Поставка — TeamPulse Hub (по частям)' / 'tests/fixture_server.py'))
chart = next(delivery.glob('3. *.js')).read_text()


def response(unit):
    rows = fixture['dataset']('all', [{'column': 'unit_f', 'value': [unit]}] if unit != 'R' else [], rich=True)
    for row in rows:
        if row['role'] == 'meta':
            meta = json.loads(row['j'])
            meta['rv'] = 'hub-2-review-2|2026'
            row['j'] = json.dumps(meta)
        if row['role'] in ('scope', 'c'):
            a, b = {'R': (40, 60), 'A': (40, 0), 'B': (0, 60)}[row['id']]
            total = a + b
            counts = [('rvc', key, total) for key in ('all', 'eligible', 'rated', 'same')]
            counts.append(('rvyear', '2026', total))
            for family, label in [('rvgr', 'G1'), ('rvt', '1–3 года'), ('rvsp', 'Разработка')]:
                counts.extend((family, label+'|'+key, n) for key, n in [('b', total), ('2', a), ('4', b)] if n)
            row['mx'] += ''.join(f'\n{k}\t{v}\t{n}' for k, v, n in counts)
    return rows


def js(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c')


responses = {u: response(u) for u in ('R', 'A', 'B')}
# srcdoc has an opaque origin, as on the real board. All responses are embedded.
frame = """<!doctype html><meta charset=utf-8><style>*{box-sizing:border-box}body{margin:0}#cell{height:100vh}</style>
<div id=cell _echarts_instance_="preview"></div><script>
const renderChart=new Function('data','applyCrossFilter',SOURCE);
const responses=RESPONSES;
function apply(mask){
  const get=k=>(mask.find(x=>x.column===k)||{value:[]}).value[0];
  window.requestCount=(window.requestCount||0)+1;
  const rows=responses[get('unit_f')||'R'];
  setTimeout(()=>renderChart(rows,apply),150);
}
apply([]);
</script>""".replace('SOURCE', js(chart)).replace('RESPONSES', js(responses))
html = """<!doctype html><html lang=ru><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>TeamPulse — тест переключения подразделений</title><style>body{margin:0}iframe{display:block;width:100%;height:100dvh;border:0}</style>
<iframe title="TeamPulse на синтетических данных" sandbox="allow-scripts"></iframe><script>document.querySelector('iframe').srcdoc=""" + js(frame) + ';</script></html>'
out = Path(sys.argv[1]) if len(sys.argv)>1 else ROOT / 'proteus/tests/previews/single-debug.html'
out.write_text(html)

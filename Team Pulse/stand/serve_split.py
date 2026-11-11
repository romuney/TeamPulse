# Стенд дашборда «по частям»: главный чарт и четыре чарта-загрузчика в отдельных iframe-песочницах, датасеты частей —
# на ClickHouse (chdb) стенда.
#
#   python3 stand/serve_split.py <каталог стенда> [порт]      → http://localhost:8767/
#
# Как в Proteus:
#   - каждый чарт — свой iframe sandbox="allow-scripts" (другой origin: общего window у чартов нет, связь — postMessage);
#   - код чарта выполняется new Function('data', 'applyCrossFilter', код) и перезапускается на каждый ответ датасета;
#   - applyCrossFilter главного чарта доходит до чартов его области: по умолчанию — только загрузчики
#     (JSON областей из поставки), главный чарт сам себя не перезапрашивает.
# Параметры страницы (строка запроса):
#   single=1            один чарт на целом датасете (PART = 'all', файл 3 обычной поставки) — эталон для сверки
#   delay=core:1500,people:4000   задержка ответа части, мс (по умолчанию core 600, people 900, flow 800, aux 500, dict 300)
#   drop=aux            загрузчик есть, но ответа не даёт (проверка «часть не пришла»)
#   self=1              главный чарт стоит в своей области кросс-фильтра (борд без JSON областей)
#   unit=<id>           кросс-фильтр юнита уже применён при открытии (как после перезагрузки борда)
#   stale=people        часть отдаётся «из старого кэша» (другая отметка сборки данных), пока её не перезапросят с меткой
# Счётчики для проверок — в window.__stand главного окна: запросы по чартам, маски.
import json, os, sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import jinja2
from chdb import session

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import split_check as sc  # noqa: E402

DIR = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub (по частям)')
MAIN = os.path.join(DIR, '3. Proteus — главный чарт TeamPulse Hub.js')
LOADER = os.path.join(DIR, '3а. Proteus — чарт-загрузчик (один код на четыре чарта).js')
ONE = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', '3. Proteus — чарт TeamPulse Hub.js')
LOADERS = ['core', 'people', 'flow', 'aux']

BOARD = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Стенд — TeamPulse Hub по частям</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#fff}
#main{position:absolute;left:0;top:0;width:100%;height:100%;border:0}
/* загрузчики — как в CSS борда поставки: в окне, но 1×1 и прозрачные */
.ld{position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0}</style></head>
<body>
<script>
var Q = new URLSearchParams(location.search);
var SINGLE = Q.get('single') === '1', SELF = Q.get('self') === '1';
var DELAY = {dict: 300, core: 600, people: 900, flow: 800, aux: 500, all: 600};
(Q.get('delay') || '').split(',').forEach(function (kv) { var p = kv.split(':'); if (p[0] && p[1]) DELAY[p[0]] = +p[1]; });
var DROP = (Q.get('drop') || '').split(',').filter(Boolean);
var STALE = (Q.get('stale') || '').split(',').filter(Boolean);
var MASK0 = Q.get('unit') ? [{column: 'unit_f', operator: 'IN', value: [Q.get('unit')]}] : [];
window.__stand = {req: {}, masks: [], runs: {}};
var charts = SINGLE ? ['all'] : ['dict'].concat(%(loaders)s);
var frames = {};
charts.forEach(function (c) {
  var f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.id = (c === 'dict' || c === 'all') ? 'main' : 'ld_' + c;
  if (f.id !== 'main') f.className = 'ld';
  f.src = '/frame?c=' + c;
  document.body.appendChild(f);
  frames[c] = f;
});
function load(c, mask) {
  window.__stand.req[c] = (window.__stand.req[c] || 0) + 1;
  return fetch('/data?c=' + c + (STALE.indexOf(c) >= 0 ? '&stale=1' : ''), {method: 'POST', body: JSON.stringify(mask || [])}).then(function (r) { return r.json(); });
}
function feed(c, mask) {
  if (DROP.indexOf(c) >= 0) { window.__stand.req[c] = (window.__stand.req[c] || 0) + 1; return; }
  var t0 = Date.now();
  load(c, mask).then(function (rows) {
    setTimeout(function () {
      window.__stand.runs[c] = (window.__stand.runs[c] || 0) + 1;
      frames[c].contentWindow.postMessage({type: 'STAND_DATA', rows: rows}, '*');
    }, Math.max(0, (DELAY[c] || 0) - (Date.now() - t0)));
  });
}
window.addEventListener('message', function (ev) {
  var d = ev.data || {};
  if (d.type === 'STAND_READY') { feed(d.c, (d.c === 'dict') ? [] : MASK0); return; }
  if (d.type === 'STAND_CF') {
    /* кросс-фильтр главного чарта: его область — загрузчики; сам главный — только при self=1 (или один чарт) */
    window.__stand.masks.push(d.mask);
    MASK0 = d.mask;
    if (SINGLE) { feed('all', d.mask); return; }
    %(loaders)s.forEach(function (c) { feed(c, d.mask); });
    if (SELF) feed('dict', d.mask);
  }
});
</script></body></html>"""

FRAME = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%%;overflow:hidden;background:#fff}
#cell{position:relative;width:100%%;height:100vh}</style></head>
<body>
<div id="cell"><div _echarts_instance_="ec_stand" style="position:relative;width:100%%;height:100%%"><canvas></canvas></div></div>
<script>
var C = %(c)s, SRC = null;
window.__runs = 0;
function applyCrossFilter(mask) { window.parent.postMessage({type: 'STAND_CF', c: C, mask: mask}, '*'); }
function run(rows) {
  var f = new Function('data', 'applyCrossFilter', SRC + '\\n;return option;');
  window.__option = f(rows, applyCrossFilter);
  window.__runs++;
}
window.addEventListener('message', function (ev) {
  var d = ev.data || {};
  if (d.type === 'STAND_DATA' && ev.source === window.parent) run(d.rows);
});
fetch('/chart.js?c=' + C).then(function (r) { return r.text(); }).then(function (t) {
  SRC = t;
  window.parent.postMessage({type: 'STAND_READY', c: C}, '*');
});
</script></body></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype):
        b = body.encode('utf-8') if isinstance(body, str) else body
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')      # iframe-песочница — origin null
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        c = (q.get('c') or [''])[0]
        if u.path == '/favicon.ico':
            return self.send(204, b'', 'image/x-icon')
        if u.path in ('/', '/index.html'):
            return self.send(200, BOARD.replace('%(loaders)s', json.dumps(LOADERS)), 'text/html; charset=utf-8')
        if u.path == '/frame':
            return self.send(200, FRAME % {'c': json.dumps(c)}, 'text/html; charset=utf-8')
        if u.path == '/chart.js':
            path = ONE if c == 'all' else MAIN if c == 'dict' else LOADER
            return self.send(200, open(path, encoding='utf-8').read(), 'application/javascript; charset=utf-8')
        self.send(404, 'нет', 'text/plain; charset=utf-8')

    def do_POST(self):
        u = urlparse(self.path)
        c = (parse_qs(u.query).get('c') or [''])[0]
        if u.path != '/data' or c not in ['all'] + sc.PARTS:
            return self.send(404, 'нет', 'text/plain; charset=utf-8')
        n = int(self.headers.get('Content-Length') or 0)
        mask = json.loads(self.rfile.read(n) or b'[]')
        flt = {}
        for m in mask:
            flt[m['column']] = [str(v) for v in m.get('value') or []]
        rows = sc.run(S, c, {k: v for k, v in flt.items() if k != 'tp_nonce'})
        # «старый кэш»: у части другая отметка сборки данных, пока запрос не пришёл с меткой tp_nonce (мимо кэша)
        if (parse_qs(u.query).get('stale') or [''])[0] == '1' and 'tp_nonce' not in flt:
            for r in rows:
                if r['role'] == 'part':
                    j = json.loads(r['j']); j['bt'] = 'старая сборка'; r['j'] = json.dumps(j, ensure_ascii=False)
        self.send(200, json.dumps(rows, ensure_ascii=False), 'application/json; charset=utf-8')


if __name__ == '__main__':
    db = sys.argv[1]
    S = session.Session(os.path.join(db, 'db') if os.path.isdir(os.path.join(db, 'db')) else db)
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8767
    print(f'стенд «по частям»: http://localhost:{port}/   (один чарт для сверки: ?single=1)')
    HTTPServer(('127.0.0.1', port), H).serve_forever()

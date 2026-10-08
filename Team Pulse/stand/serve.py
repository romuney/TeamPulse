# Стенд чарта Proteus: страница с хостом ECharts, собранный чарт (файл 3) и датасет
# (файл 2) на ClickHouse 24.8 (chdb) по симуляции таблицы.
#
#   python serve.py DB [порт]      → http://localhost:8766/
#
# Как в Proteus: чарт выполняется через new Function('data', 'applyCrossFilter', код),
# applyCrossFilter(маска) — новый запрос датасета с filter_values из маски и новый
# прогон чарта в той же странице (window.__pvtState переживает прогон).
import json, os, sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from chdb import session

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dataset  # noqa: E402

CHART = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', '3. Proteus — чарт TeamPulse Hub.js')
PAGE = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Стенд — TeamPulse Hub в Proteus</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#fff}
#cell{position:relative;width:100%;height:100vh}</style></head>
<body>
<div id="cell"><div _echarts_instance_="ec_stand" style="position:relative;width:100%;height:100%"><canvas></canvas></div></div>
<script>
var SRC = null;
window.__runs = 0; window.__masks = [];
function load(mask) {
  return fetch('/data', {method: 'POST', body: JSON.stringify(mask || [])}).then(function (r) { return r.json(); });
}
function run(rows) {
  window.__rows = rows;
  var f = new Function('data', 'applyCrossFilter', SRC + '\\n;return option;');
  window.__option = f(rows, applyCrossFilter);
  window.__runs++;
}
function applyCrossFilter(mask) {
  window.__masks.push(mask);
  window.__waiting = true;
  /* как в Proteus: ответ приходит не сразу */
  setTimeout(function () { load(mask).then(function (rows) { window.__waiting = false; run(rows); }); }, 300);
}
fetch('/chart.js').then(function (r) { return r.text(); }).then(function (t) {
  SRC = t;
  return load([]);
}).then(run);
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
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == '/favicon.ico':
            return self.send(204, b'', 'image/x-icon')
        if self.path in ('/', '/index.html'):
            return self.send(200, PAGE, 'text/html; charset=utf-8')
        if self.path.startswith('/chart.js'):
            return self.send(200, open(CHART, encoding='utf-8').read(), 'application/javascript; charset=utf-8')
        self.send(404, 'нет', 'text/plain; charset=utf-8')

    def do_POST(self):
        if self.path != '/data':
            return self.send(404, 'нет', 'text/plain; charset=utf-8')
        n = int(self.headers.get('Content-Length') or 0)
        mask = json.loads(self.rfile.read(n) or b'[]')
        flt = {}
        for m in mask:
            flt[m['column']] = [str(v) for v in m.get('value') or []]
        _, rows = dataset.query(S, dataset.render(flt))
        self.send(200, json.dumps(rows, ensure_ascii=False), 'application/json; charset=utf-8')


if __name__ == '__main__':
    S = session.Session(sys.argv[1])
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8766
    print(f'стенд: http://localhost:{port}/')
    HTTPServer(('127.0.0.1', port), H).serve_forever()

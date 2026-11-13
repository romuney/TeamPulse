"""Synthetic responses, real shipped charts and opaque sandbox iframes.
No corporate data, SQL or service access. Run: python tests/fixture_server.py.
"""
import ast
import json
import re
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DELIVERY = Path(__file__).resolve().parents[1]
ROOT = DELIVERY.parent
board_css = (DELIVERY / '4. CSS борда (дописать в конец).css').read_text()
flame = re.search(r'--tp-load:\s*(url\("[^"]+"\))', board_css).group(1)
# Reuse the production-like sandbox/cross-filter transport of the existing stand.
tree = ast.parse((ROOT / 'stand/serve_split.py').read_text())
templates = {n.targets[0].id: ast.literal_eval(n.value) for n in tree.body
             if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name)
             and n.targets[0].id in ['BOARD', 'FRAME']}
PARTS = ['dict', 'core', 'people', 'flow', 'aux']
KEYS = 'hc act avg hire fire reg tin tout pnor plow phig pgry wday ovis gapr gdec hrn hrs tlk obase hob nob ab25 ab5 we25 we5 t23 t35 t5 hrw pdw tkw'.split()
RICH_KEYS = 'nreg vop vcl vap vtd vtn vjn hwd hov rh nrh avh fh hch fwday fovis vbk bk bkv vsv'.split()


def row(role, **values):
    return dict(role=role, id=values.pop('id', ''), pid=values.pop('pid', ''),
                lvl=values.pop('lvl', 0), kids=values.pop('kids', 0), nm=values.pop('nm', ''),
                j=values.pop('j', ''), ms=values.pop('ms', ''), mx=values.pop('mx', ''), **values)


def dataset(part, mask, stale=False, rich=False, zero=False):
    filters = {m['column']: m.get('value', []) for m in mask}
    unit = (filters.get('unit_f') or ['R'])[0]
    echo = dict(scope=unit, req=filters.get('unit_f', []), bt='old' if stale and 'tp_nonce' not in filters else 'v1', ok=1)
    keys = KEYS + (RICH_KEYS if rich else [])
    meta = dict(n=23, m0='2025-01', lm='2026-11', dt='2026-11-10', root='R',
                scope=unit, **{'def': 'R'}, req=echo['req'], ok=1, full=1, cuts=[], mk=','.join(keys))
    units = [('R', '', 100), ('A', 'R', 40), ('B', 'R', 60)] if unit == 'R' else [(unit, 'R', 40 if unit == 'A' else 60)]
    def metrics(n):
        values = dict(hc=n, act=n, avg=n, hire=4, fire=2, reg=1, tin=1, tout=1,
                      pnor=n*.7, plow=n*.1, phig=n*.1, pgry=n*.1, wday=n*20,
                      ovis=n*8, gapr=3, gdec=1, hrn=n, hrs=n*8, tlk=n*2, obase=n, hob=n*.1, nob=n*.3,
                      ab25=2, ab5=1, we25=3, we5=1, t23=5, t35=2, t5=1, hrw=n*160, pdw=n*20, tkw=n*40)
        if rich:
            values.update(nreg=1, vop=6, vcl=3, vap=4, vtd=90, vtn=3, vjn=1,
                          hwd=n*2, hov=n*.8, rh=1, nrh=1, avh=n, fh=2, hch=n,
                          fwday=n*4, fovis=n*2, vbk=n*4, bk=n*6, bkv=n, vsv=n*4)
        if zero:
            # Explicit zeros must retain the golden model's availability rules.
            values.update({k: 0 for k in ['nreg', 'vop', 'vcl', 'vap', 'vtd', 'vtn', 'vjn']})
        return ';'.join(','.join(str(values[k]) for _ in range(23)) for k in keys)
    def detail(n):
        chunks = {'people': f'g\tЖенский\t{n*.6}\n\tМужской\t{n*.4}\ngr\t10\t{n}\ns\tSenior\t{n}\n'
                           f'mp\thc\t{n}\n\tab25\t2\n\tab5\t1\n\twe25\t3\n\twe5\t1\n\tt23\t5\n'
                           'mpd\t2026-07-20|2026-11-08\t1',
                  'flow': 'vk\tВнешний найм\t4', 'aux': ''}
        if rich:
            chunks['people'] += (f'\ndw\t2026-11-02\t{n}\ndo\t2026-11-02\t{n*.4}'
                                 f'\noc\tМосква\t{n*8}\nocd\tМосква\t{n*20}\nocp\tМосква\t{n}'
                                 f'\nrs\tnone|av|10\t{n-3}\nrs\tok|g|10\t3'
                                 '\nrm\t2026-10|g|0|ok\t3\nrq\tg|0|ok|11|10\t3')
            chunks['flow'] += '\nvt\t2026-10|20\t1\nvt\t2026-10|30\t1\nvt\t2026-10|40\t1'
            chunks['aux'] = (f'aw\t2026-10-26|{n*.5},{n}\t1\naw\t2026-11-02|{n*.6},{n}\t1'
                             f'\naik\t2026-11-02\t1\naut\tCopilot\t{n*.6}\naur\tCopilot\t1'
                             f'\naph\tHQ\t{n}\napt\tHQ|Copilot\t{n*.6}'
                             f'\nauf\t3\t{n*.6}\naun\t1\t{n*.6}\naum\t\t{n*10}'
                             f'\nauc\t\t{n*8}\nauk\tНаписание кода\t{n*8}'
                             f'\nash\tp|HQ\t{n}\nasu\tp|HQ\t{n*.6}'
                             '\naih\t\t2\naiu\t\t1\nait\tCopilot\t1\naif\t2\t1')
        return '\n'.join(chunks.values()) if part == 'all' else chunks.get(part, '')
    rows = [row('part', id=part, j=json.dumps(echo))] if part != 'all' else []
    if part in ['core', 'all']:
        rows.append(row('meta', j=json.dumps(meta)))
    if part in ['dict', 'all']:
        rows.append(row('dict', j='R\t\t1\t2\tТестовая компания\t\t\nA\tR\t2\t0\tОтдел А\t\t\nB\tR\t2\t0\tОтдел Б\t\t'))
    if part != 'dict':
        for i, (uid, parent, n) in enumerate(units):
            rows.append(row('scope' if i == 0 else 'c', id=uid, pid=parent,
                            lvl=1 if uid == 'R' else 2, kids=2 if uid == 'R' else 0,
                            nm='Тестовая компания' if uid == 'R' else 'Отдел '+uid,
                            ms=metrics(n) if part in ['core', 'all'] else '', mx=detail(n)))
        rows.append(row('base', ms=metrics(500) if part in ['core', 'all'] else '', mx=detail(500)))
    if rich and part in ['aux', 'all']:
        # Deliberately unlike the company fallback: missing aux must not produce a
        # definitive favorable judgment that reverses when real peers arrive.
        rows.append(row('peer', j='\n'.join(f'{key}\t{band}\t25\t1\t2\t3'
                    for key in ['turnover_y', 'underwork', 'overwork'] for band in range(1, 5))))
    rows.append(row('end'))
    return rows


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send(self, body, kind):
        b = body.encode()
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        c = parse_qs(u.query).get('c', [''])[0]
        if u.path == '/frame':
            self.send(templates['FRAME'] % {'c': json.dumps(c)}, 'text/html; charset=utf-8')
        elif u.path == '/chart.js':
            folder = ROOT / 'Поставка — TeamPulse Hub' if c == 'all' else DELIVERY
            name = '3. Proteus — чарт TeamPulse Hub.js' if c == 'all' else '3. Proteus — главный чарт TeamPulse Hub.js' if c == 'dict' else '3а. Proteus — чарт-загрузчик (один код на четыре чарта).js'
            self.send((folder / name).read_text(), 'application/javascript; charset=utf-8')
        else:
            board = templates['BOARD'].replace('%(loaders)s', json.dumps(PARTS[1:]))
            # The real board already owns the initial flame loader. Keep it
            # behind transparent frames, exactly like the shipped board CSS.
            board = board.replace('</style>', 'body{background:#fff '+flame+' center / 260px 180px no-repeat}</style>')
            board = board.replace("fetch('/data?c=' + c +",
                                  "fetch('/data?rich=' + (Q.get('rich') || '') + '&zero=' + (Q.get('zero') || '') + '&c=' + c +")
            self.send(board, 'text/html; charset=utf-8')

    def do_POST(self):
        q = parse_qs(urlparse(self.path).query)
        mask = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
        self.send(json.dumps(dataset(q['c'][0], mask, q.get('stale') == ['1'],
                                     q.get('rich') == ['1'], q.get('zero') == ['1']), ensure_ascii=False), 'application/json')


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8767), Handler).serve_forever()

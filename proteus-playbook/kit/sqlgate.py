#!/usr/bin/env python3
"""Гейт сохранения: пройдёт ли SQL проверку Proteus при Save датасета (и в SQL Lab) — до вставки владельцем.

Форк при сохранении разбирает SQL своим парсером и отвечает «Некорректный SQL запрос: →…←» (строки нет в Superset
2.0.1, sqlglot в 2.0.x нет — это код форка; sqlglot 23–30 воспроизводит отказ на алиасе в GROUP BY, а < 15 не годится:
не знает CAST(x, 'T') и роняет рабочие датасеты). chdb такие
ошибки не ловит: он выполняет всё. Здесь — все известные причины отказа и порчи текста:

  1. sqlglot (dialect clickhouse): ровно один оператор, только запрос (Select / Union / Subquery; в SQL Lab ещё
     Describe), без изменяющих узлов; ошибка — в формате форка «…→место←…»;
  2. алиас в GROUP BY (`GROUP BY intDiv(rn - 1, 500) AS ch` — отказ 29.09) — по токенам, даже если sqlglot молчит;
  3. `\\x..` в строковом литерале (sqlglot перепечатает '\\x1F' как '\\\\x1F' — значение меняется);
  4. кортежный тип строкой в CAST (`CAST([], 'Array(Tuple(UInt8, String))')` — отказ 18.09, sqlglot его пропускает);
  5. SETTINGS / FORMAT / `;` в середине / `AS MATERIALIZED` в теле датасета (Code 62 при сохранении: Superset
     дописывает "\\nLIMIT 1000" после текста);
  6. лексер sqlparse (0.3.0 + патч 2.0.1 или 0.4.4 + патч 2.1.3/3.0 — какой стоит в venv; гоняйте оба) видит строки
     так же, как sqlglot, а strip_comments вырезает только комментарии (иначе запрос портится до ClickHouse —
     superset201.lexer_problems);
  7. остатки Jinja после рендера (DebugUndefined печатает неизвестную переменную текстом);
  8. --sqllab: слово `system` (SQL Lab Proteus: «Использование "system" запрещено» — даже в комментарии), SHOW,
     один запрос (сборник «по одному» — каждый отдельно; из .md — блоки ```sql), первым словом SELECT или DESCRIBE,
     «LIMIT N BY» на верхнем уровне (SQL Lab 2.0.1 примет его за лимит строк и покажет N строк всего ответа),
     REPLACE и WITH первой строкой — предупреждения (не проверено в бою).

Запуск:
    python kit/sqlgate.py proteus/report.data.sql [--user a.user] [--filters '{"unit_f": ["u1"]}'] [--cols auto]
    python kit/sqlgate.py --sqllab "Поставка/10. Проверка на бою.sql" "Поставка/0. Инструкция.md"
    python kit/sqlgate.py report.data.sql --sqlglot-dirs ~/sg/23.17.0,~/sg/30.0.0   # ещё версии sqlglot

Другие версии sqlglot ставятся рядом, не в venv:  pip install --target ~/sg/23.17.0 sqlglot==23.17.0
и подаются каталогами (--sqlglot-dirs) — гейт перезапустит себя с PYTHONPATH=<каталог> для каждого.
Варианты датасета: сохранение (AlwaysTrue, текст + LIMIT 1000), открытие (--user, --filters, --url-params) и
обёртка чарта (SELECT … GROUP BY … LIMIT). Код выхода: 0 — чисто, 1 — есть ошибки, 2 — вызов.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import superset201 as ss  # noqa: E402

MUTATING = ['Insert', 'Update', 'Delete', 'Merge', 'Create', 'Drop', 'TruncateTable', 'Alter', 'Command']
QUERY_NODES = ['Select', 'Union', 'Subquery', 'Except', 'Intersect']
GB_END = {'HAVING', 'ORDER_BY', 'LIMIT', 'UNION', 'EXCEPT', 'INTERSECT', 'SEMICOLON', 'WINDOW', 'QUALIFY',
          'SETTINGS', 'FORMAT'}


# ─────────────────────────────── sqlglot: разбор как при сохранении ───────────────────────────────
def sqlglot_problem(text, sqllab=False):
    """Как SQLScript / SQLStatement Superset 4.1+ и, вероятно, проверка форка: один оператор, запрос. '' — норма."""
    try:
        import sqlglot
        from sqlglot import exp
    except ImportError:
        return 'нет sqlglot'
    try:
        st = [x for x in sqlglot.parse(text, read='clickhouse') if x is not None]   # read= есть во всех версиях
    except Exception as ex:  # noqa: BLE001 — ParseError, TokenError и прочее: форк ответил бы отказом
        errs = getattr(ex, 'errors', None) or []
        e = errs[0] if errs else {}
        if e:
            return 'Некорректный SQL запрос: …%s→%s←%s… (%s)' % (
                (e.get('start_context') or '')[-60:].replace('\n', ' '), e.get('highlight', ''),
                (e.get('end_context') or '')[:40].replace('\n', ' '), e.get('description', '')[:80])
        return 'Некорректный SQL запрос: %s' % str(ex).splitlines()[0][:200]
    if len(st) != 1:
        return 'операторов: %d (нужен один)' % len(st)
    allowed = QUERY_NODES + (['Describe'] if sqllab else [])
    if not any(hasattr(exp, n) and isinstance(st[0], getattr(exp, n)) for n in allowed):
        return 'не запрос: %s' % type(st[0]).__name__
    for n in MUTATING:
        if hasattr(exp, n) and st[0].find(getattr(exp, n)):
            return 'изменяющий узел: ' + n
    return ''


# ─────────────────────────────── проверки по токенам ───────────────────────────────
def _toks(text):
    from sqlglot.dialects.clickhouse import ClickHouse
    return ClickHouse().tokenize(text)


def _ctx(text, at, w=60):
    return text[max(0, at - w):at + 30].replace('\n', ' ')


def token_problems(text, dataset=True):
    """Алиас в GROUP BY, \\x в литералах, кортежный CAST строкой, SETTINGS / FORMAT / ; / MATERIALIZED."""
    out = []
    try:
        t = _toks(text)
    except ImportError:
        return ['нет sqlglot: проверки по токенам пропущены']
    except Exception as ex:  # noqa: BLE001
        return ['sqlglot не токенизирует: %s' % str(ex).splitlines()[0][:160]]
    names = [x.token_type.name for x in t]
    up = [x.text.upper() for x in t]
    for i, n in enumerate(names):
        if n == 'GROUP_BY':
            depth = 0
            for j in range(i + 1, len(t)):
                m = names[j]
                if m in ('L_PAREN', 'L_BRACKET'):
                    depth += 1
                elif m in ('R_PAREN', 'R_BRACKET'):
                    if depth == 0:
                        break
                    depth -= 1
                elif depth == 0 and m in GB_END:
                    break
                elif depth == 0 and m == 'ALIAS':
                    out.append('алиас в GROUP BY (форк: «Некорректный SQL запрос», 29.09) — ключ колонкой '
                               'подзапроса: …%s…' % _ctx(text, t[j].start))
                    break
        if n in ('STRING', 'NATIONAL_STRING'):
            raw = text[t[i].start:t[i].end + 1]
            if re.search(r'(?<!\\)(?:\\\\)*\\x[0-9A-Fa-f]{2}', raw):
                out.append('\\x-экран в литерале (перепечатка sqlglot меняет значение) — char(N): …%s…'
                           % _ctx(text, t[i].start))
            if re.match(r'^\s*(?:[A-Za-z]+\(\s*)*Tuple\s*\(', t[i].text):
                out.append('кортежный тип строкой %r (форк отверг CAST с ним при сохранении, 18.09) — '
                           'arrayFilter(t -> …, [(toUInt8(N), x)]): …%s…' % (t[i].text[:40], _ctx(text, t[i].start)))
        if not dataset:
            continue
        if up[i] == 'SETTINGS' and i + 2 < len(t) and names[i + 2] == 'EQ':
            out.append('SETTINGS в теле датасета (сохранение допишет LIMIT после него — Code 62): …%s…'
                       % _ctx(text, t[i].start))
        if up[i] == 'FORMAT' and i + 1 < len(t) and names[i + 1] != 'L_PAREN' and (i == 0 or names[i - 1] != 'DOT'):
            out.append('FORMAT в теле датасета (подзапрос не принимает FORMAT): …%s…' % _ctx(text, t[i].start))
        if up[i] == 'MATERIALIZED' and i > 0 and names[i - 1] == 'ALIAS':
            out.append('AS MATERIALIZED (в ClickHouse 24.8 нет — Code 62): …%s…' % _ctx(text, t[i].start))
        if n == 'SEMICOLON' and any(x != 'SEMICOLON' for x in names[i + 1:]):
            out.append('«;» в середине текста («multiple statements»): …%s…' % _ctx(text, t[i].start))
    return out


# ─────────────────────────────── SQL Lab ───────────────────────────────
def sqllab_problems(text):
    """Правила SQL Lab Proteus (бой 08.10) + путь SQL Lab 2.0.1 (ParsedQuery(strip_comments=True), лимит)."""
    err, warn = [], []
    for m in re.finditer(r'(?i)system', text):
        line = text.count('\n', 0, m.start()) + 1
        err.append('слово «system» в строке %d (SQL Lab: «Использование "system" запрещено» — даже в комментарии)'
                   % line)
        if len(err) >= 5:
            break
    for m in re.finditer(r'(?i)\bshow\b', text):
        err.append('SHOW в строке %d (SQL Lab принимает только SELECT / DESCRIBE)' % (text.count('\n', 0, m.start()) + 1))
        break
    if re.search(r'(?i)\breplace\b', text):
        warn.append('REPLACE в тексте: отказ SQL Lab на нём не подтверждён боем (TP — осторожность); '
                    'функция replace( в датасетах работает')
    if '{{' in text or '{%' in text:
        warn.append('в SQL Lab-файле Jinja: SQL Lab 2.0.1 её рендерит и падает на неизвестной переменной — '
                    'давайте отрендеренный текст (DV-23)')
    ss.lexer_patch()
    pq = ss.ParsedQuery(text, strip_comments=True)
    stm = pq.get_statements()
    if len(stm) != 1:
        err.append('запросов: %d — SQL Lab Proteus исполняет один' % len(stm))
    if stm:
        head = stm[0].lstrip('( \n\t').split(None, 1)[0].upper() if stm[0].strip() else ''
        if head == 'WITH':
            warn.append('первое слово WITH: SQL Lab Proteus пропускает «только select или describe» — CTE внутри '
                        'FROM (…) надёжнее (отказ на WITH не проверен)')
        elif head not in ('SELECT', 'DESCRIBE', 'DESC'):
            err.append('первое слово %s — SQL Lab Proteus пропускает только SELECT и DESCRIBE' % head)
        one = ss.ParsedQuery(stm[0])
        if one.limit:
            # SQL Lab 2.0.1: query.limit = min(LIMIT запроса, лимит окна), затем верхний LIMIT → limit + 1 (force),
            # лишняя строка отбрасывается. Обычный LIMIT N так и остаётся N, а «LIMIT N BY» на верхнем уровне
            # становится «LIMIT N+1 BY», и SQL Lab покажет всего N строк ответа.
            st0 = one._parsed[0]
            idx, _ = st0.token_next_by(m=(ss.Keyword, 'LIMIT'))
            nidx, _num = st0.token_next(idx) if idx is not None else (None, None)
            _, after = st0.token_next(nidx) if nidx is not None else (None, None)
            if after is not None and after.ttype in ss.Keyword and after.normalized == 'BY':
                err.append('«LIMIT %d BY» на верхнем уровне: SQL Lab примет его за лимит строк и покажет всего %d '
                           'строк ответа — оберните запрос в SELECT * FROM (…)' % (one.limit, one.limit))
    return err, warn


# ─────────────────────────────── варианты текста ───────────────────────────────
def dataset_texts(path, opts):
    """→ [(вариант, текст, проверять ли тело датасета)] + ошибки рендера."""
    tpl = open(path, encoding='utf-8').read()
    out, errs = [], []
    if opts.get('rendered'):
        return [('как есть', tpl, True)], errs
    rs = ss.render(tpl, user=opts['user'], filters={}, url_params={}, save=True)
    if rs.error:
        errs.append('сохранение: ' + rs.error)
    else:
        sp = ss.save_path(rs.text)
        if sp['error']:
            errs.append('сохранение: ' + sp['error'])
        out.append(('сохранение (AlwaysTrue)', rs.text, True))
        if sp.get('executed'):
            out.append(('сохранение + LIMIT 1000', sp['executed'], False))
        if rs.leftovers:
            errs.append('сохранение: после рендера остался Jinja-текст: %s' % ', '.join(rs.leftovers[:4]))
    ro = ss.render(tpl, user=opts['user'], filters=opts['filters'], url_params=opts['url_params'])
    if ro.error:
        errs.append('открытие: ' + ro.error)
        return out, errs
    if ro.leftovers:
        errs.append('открытие: после рендера остался Jinja-текст: %s' % ', '.join(ro.leftovers[:4]))
    out.append(('открытие', ro.text, True))
    cols = opts.get('cols')
    if cols in (None, 'auto'):
        try:
            import sqlglot
            ast = sqlglot.parse_one(ss.sqlparse.format(ro.text.strip('\t\r\n; '), strip_comments=True),
                                    read='clickhouse')
            cols = [c for c in ast.named_selects if c]
        except Exception:  # noqa: BLE001
            cols = None
    if cols:
        ds = ss.sqlparse.format(ro.text.strip('\t\r\n; '), strip_comments=True)
        out.append(('обёртка чарта', ss.wrap(ds, cols, opts.get('limit', 50000)), False))
    return out, errs


def gate_file(path, opts):
    rep = {'file': path, 'errors': [], 'warnings': [], 'variants': [], 'texts': {}}
    if opts['sqllab']:
        text = open(path, encoding='utf-8').read()
        if path.endswith('.md'):
            # инструкция: каждый блок ```sql — отдельный запрос для SQL Lab
            blocks = [('блок %d' % (i + 1), b) for i, b in
                      enumerate(re.findall(r'```sql[^\n]*\n(.*?)```', text, flags=re.S))]
        else:
            blocks = [('', text)]
        variants = []
        for label, b in blocks:
            ss.lexer_patch()
            stm = ss.ParsedQuery(b, strip_comments=True).get_statements()
            if len(stm) > 1:
                # сборник запросов «по одному»: каждый проверяется сам, файл целиком SQL Lab не исполнит
                rep['warnings'].append('%s%d запросов: SQL Lab Proteus исполняет один — владелец выделяет и запускает '
                                       'по одному (лучше — файл на запрос или один запрос UNION ALL)'
                                       % ((label + ': ') if label else '', len(stm)))
                parts = [('%s запрос %d' % (label, k + 1)).strip() for k in range(len(stm))]
                pieces = list(zip(parts, stm))
                for m in re.finditer(r'(?i)system', b):   # system — по сырому тексту, с комментариями
                    rep['errors'].append('%sслово «system» в строке %d (даже в комментарии)'
                                         % ((label + ': ') if label else '', b.count('\n', 0, m.start()) + 1))
            else:
                pieces = [(label or 'SQL Lab', b)]
            for name, q in pieces:
                e, w = sqllab_problems(q)
                if len(stm) > 1:
                    e = [x for x in e if 'system' not in x]
                pre = '' if name == 'SQL Lab' else name + ': '
                rep['errors'] += [pre + x for x in e]
                rep['warnings'] += [pre + x for x in w]
                variants.append(('SQL Lab' if name == 'SQL Lab' else 'SQL Lab, ' + name, q, False))
    else:
        variants, errs = dataset_texts(path, opts)
        rep['errors'] += errs
        if re.search(r'(?i)system', open(path, encoding='utf-8').read()):
            rep['warnings'].append('слово «system» в датасете: если владелец запустит его в SQL Lab — отказ')
    seen = {}
    for name, text, body in variants:
        probs = []
        p = sqlglot_problem(text, opts['sqllab'])
        if p:
            probs.append(p)
        probs += token_problems(text, dataset=body)
        if name in ('открытие', 'сохранение (AlwaysTrue)', 'как есть') or name.startswith('SQL Lab'):
            probs += ['лексер: ' + x for x in ss.lexer_problems(text)]
        probs = list(dict.fromkeys(probs))
        rep['variants'].append({'name': name, 'problems': probs})
        rep['texts'][name] = text
        for x in probs:
            seen.setdefault(x, []).append(name)
    # одна и та же причина в нескольких вариантах — одной строкой
    for x, names in seen.items():
        line = '%s  [%s]' % (x, ', '.join(names))
        (rep['warnings'] if x.startswith('нет sqlglot') else rep['errors']).append(line)
    return rep


# ─────────────────────────────── другие версии sqlglot ───────────────────────────────
def other_sqlglot(reports, dirs, sqllab):
    """Перезапуск себя с PYTHONPATH=<каталог> на тех же текстах: {каталог: {версия, ошибки}}."""
    payload = [{'key': '%s :: %s' % (r['file'], n), 'text': t} for r in reports for n, t in r['texts'].items()]
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump({'sqllab': sqllab, 'items': payload}, f, ensure_ascii=False)
        tmp = f.name
    out = {}
    try:
        for d in dirs:
            d = os.path.expanduser(d)
            env = dict(os.environ, PYTHONPATH=d + os.pathsep + os.environ.get('PYTHONPATH', ''))
            r = subprocess.run([sys.executable, os.path.abspath(__file__), '--_sqlglot-json', tmp], env=env,
                               capture_output=True, text=True)
            try:
                out[d] = json.loads(r.stdout)
            except ValueError:
                out[d] = {'version': '?', 'errors': {'запуск': (r.stderr or r.stdout)[-300:]}}
    finally:
        os.unlink(tmp)
    return out


def _sqlglot_only(tmp):
    data = json.load(open(tmp, encoding='utf-8'))
    try:
        import sqlglot
        ver = sqlglot.__version__
    except ImportError:
        ver = 'нет'
    errs = {}
    for it in data['items']:
        p = sqlglot_problem(it['text'], data['sqllab'])
        if p:
            errs[it['key']] = p
    print(json.dumps({'version': ver, 'errors': errs}, ensure_ascii=False))


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ['--_sqlglot-json']:
        _sqlglot_only(argv[1])
        return 0
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0], formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog=__doc__.split('\n\n', 1)[1])
    ap.add_argument('files', nargs='+')
    ap.add_argument('--sqllab', action='store_true', help='файлы для SQL Lab (а не датасеты)')
    ap.add_argument('--rendered', action='store_true', help='текст уже без Jinja — не рендерить')
    ap.add_argument('--user', default='stand.user')
    ap.add_argument('--filters', default='')
    ap.add_argument('--url-params', default='')
    ap.add_argument('--cols', default='auto')
    ap.add_argument('--limit', type=int, default=50000)
    ap.add_argument('--sqlglot-dirs', default='', help='каталоги с другими версиями sqlglot через запятую')
    ap.add_argument('--no-patch', action='store_true', help='лексер без патча Superset')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args(argv)
    ss.lexer_patch(not a.no_patch)
    opts = {'sqllab': a.sqllab, 'rendered': a.rendered, 'user': a.user, 'filters': ss._json_arg(a.filters),
            'url_params': ss._json_arg(a.url_params), 'limit': a.limit,
            'cols': 'auto' if a.cols == 'auto' else [c.strip() for c in a.cols.split(',') if c.strip()]}
    reports = [gate_file(f, opts) for f in a.files]
    dirs = [d for d in a.sqlglot_dirs.split(',') if d.strip()]
    others = other_sqlglot(reports, dirs, a.sqllab) if dirs else {}
    for d, res in others.items():
        agg = {}
        for key, p in res.get('errors', {}).items():
            f, _, n = key.partition(' :: ')
            agg.setdefault((f, p), []).append(n)
        for (f, p), names in agg.items():
            for r in reports:
                if r['file'] == f:
                    r['errors'].append('sqlglot %s: %s  [%s]' % (res.get('version'), p, ', '.join(names)))
    bad = sum(1 for r in reports if r['errors'])
    ver = ss.versions()
    if a.json:
        for r in reports:
            r.pop('texts', None)
        print(json.dumps({'versions': ver, 'other_sqlglot': {d: r.get('version') for d, r in others.items()},
                          'reports': reports}, ensure_ascii=False, indent=1))
        return 1 if bad else 0
    print('sqlglot %s · sqlparse %s (патч: %s)%s' % (ver['sqlglot'], ver['sqlparse'], ver['patch'],
          ''.join(' · sqlglot %s' % r.get('version') for r in others.values())))
    for r in reports:
        print('=' * 100)
        print('%s — %s' % (r['file'], 'ЧИСТО' if not r['errors'] else 'ОШИБКИ: %d' % len(r['errors'])))
        for v in r['variants']:
            print('  [%s] %s' % ('ок' if not v['problems'] else '✗', v['name']))
        for e in r['errors']:
            print('  ✗ ' + e)
        for w in r['warnings']:
            print('  ! ' + w)
    if not dirs:
        print('-' * 100)
        print('Другие версии sqlglot (23–30, как Superset 4.0–5.0): pip install --target <каталог> sqlglot==23.17.0 '
              '→ --sqlglot-dirs <каталог>,…')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())

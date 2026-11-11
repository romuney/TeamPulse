# Поставка «по частям»: сумма ответов частей датасета = ответ целого датасета (PART = 'all').
#
#   python3 stand/split_check.py <каталог chdb стенда> [юнит …]
#
# Каталог chdb — тот, что оставляет ноутбук стенда (stand/nb_tp20.py --hub <каталог> → <каталог>/db).
# Для каждого набора фильтров: целый ответ и пять частей (dict, core, people, flow, aux) исполняются на стенде, части
# сводятся так же, как их сводит главный чарт (proteus/parts.js: ряды и имена — из core, разрезы — склейкой блоков), и
# сравниваются с целым: meta (кроме today), справочник, база похожих, строка HQ, у каждого узла — ряды, имя, уровень и
# разрезы как множество «ключ, значение, число». Строка part каждой части — эхо того же запроса.
import json, os, re, sys
import jinja2
from chdb import session

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', '2. Proteus — датасет TeamPulse Hub.sql')
PARTS = ['dict', 'core', 'people', 'flow', 'aux']
SET_ALL = "{% set PART = 'all' %}"


def text(part):
    s = open(SRC, encoding='utf-8').read().replace('{% set FULL = [] %}', "{% set FULL = ['tester'] %}")
    assert s.count(SET_ALL) == 1, 'в датасете нет строки PART'
    return s.replace(SET_ALL, "{% set PART = '" + part + "' %}")


def run(s, part, filters, user='tester'):
    tpl = jinja2.Environment(extensions=['jinja2.ext.do']).from_string(text(part))
    sql = tpl.render(filter_values=lambda col: list(filters.get(col, [])), current_username=lambda: user)
    out = str(s.query(sql.strip().rstrip(';'), 'JSONEachRow'))
    return [json.loads(l) for l in out.splitlines() if l.strip()]


def blocks(mx):
    """разрезы узла → множество (ключ, значение, число); ключ — у первой строки блока"""
    res, k = set(), ''
    for line in (mx or '').split('\n'):
        if not line:
            continue
        p = line.split('\t')
        if p[0]:
            k = p[0]
        res.add((k, p[1] if len(p) > 1 else '', p[2] if len(p) > 2 else ''))
    return res


def merge(parts):
    """как proteus/parts.js: строки core — основа, разрезы остальных частей дописываются узлу по (role, id)"""
    rows, by = [], {}
    for r in parts['core']:
        if r['role'] in ('part', 'end'):
            continue
        r = dict(r)
        rows.append(r)
        if r['role'] in ('scope', 'base', 'c', 'g', 'x'):
            by[(r['role'], r['id'])] = r
    for p in ('people', 'flow', 'aux'):
        for r in parts[p]:
            if r['role'] in ('scope', 'base', 'c', 'g', 'x'):
                t = by.get((r['role'], r['id']))
                if t is not None and r['mx']:
                    t['mx'] = (t['mx'] + '\n' if t['mx'] else '') + r['mx']
            elif r['role'] == 'peer':
                rows.append(dict(r))
    rows.extend(dict(r) for r in parts['dict'] if r['role'] == 'dict')
    return rows


def main():
    db = sys.argv[1]
    s = session.Session(db if os.path.isdir(os.path.join(db, 'store')) or not os.path.isdir(os.path.join(db, 'db')) else os.path.join(db, 'db'))
    base = run(s, 'all', {})
    kids = [r['id'] for r in base if r['role'] == 'c'][:2] + [r['id'] for r in base if r['role'] == 'g'][:1]
    units = sys.argv[2:] or kids
    cases = [('без фильтров', {})] + [('юнит ' + u, {'unit_f': [u]}) for u in units]
    cases += [('HQ', {'paint_f': ['Hq']}), ('IT + штат', {'it_f': ['IT'], 'staff_f': ['Штат']}), ('вся численность', {'act_f': ['Вся']}),
              ('юнит + HQ + вся', {'unit_f': units[:1], 'paint_f': ['Hq'], 'act_f': ['Вся']}),
              ('нет доступа', None)]
    bad = 0
    for name, flt in cases:
        user = 'tester'
        if flt is None:
            flt, user = {}, 'nobody.at.all'
        whole = run(s, 'all', flt, user)
        parts = {p: run(s, p, flt, user) for p in PARTS}
        errs = []
        # строка part: у каждой части, эхо одно и то же
        echo = set()
        for p in PARTS:
            pr = [r for r in parts[p] if r['role'] == 'part']
            if len(pr) != 1 or pr[0]['id'] != p:
                errs.append('у части %s нет строки part' % p)
                continue
            j = json.loads(pr[0]['j'])
            echo.add(json.dumps({k: j[k] for k in ('ok', 'scope', 'req', 'paint', 'it', 'staff', 'act', 'bt')}, sort_keys=True, ensure_ascii=False))
            if not j['bt']:
                errs.append('у части %s пустая отметка сборки данных (bt)' % p)
            if not any(r['role'] == 'end' for r in parts[p]):
                errs.append('у части %s нет строки end' % p)
        if len(echo) != 1:
            errs.append('эхо частей разное: %s' % sorted(echo))
        m = merge(parts)
        key = lambda r: (r['role'], r['id'])
        W = {key(r): r for r in whole if r['role'] != 'end'}
        M = {key(r): r for r in m}
        if set(W) != set(M):
            errs.append('строки: лишние %s, нет %s' % (sorted(set(M) - set(W))[:5], sorted(set(W) - set(M))[:5]))
        for k in set(W) & set(M):
            a, b = W[k], M[k]
            if k[0] == 'meta':
                ja, jb = json.loads(a['j']), json.loads(b['j'])
                ja.pop('today', None); jb.pop('today', None)
                if ja != jb:
                    errs.append('meta: %s' % [x for x in ja if ja.get(x) != jb.get(x)])
                continue
            for c in ('pid', 'lvl', 'nm', 'kids', 'j', 'ms'):
                if a[c] != b[c]:
                    errs.append('%s: колонка %s' % (k, c))
            if blocks(a['mx']) != blocks(b['mx']):
                d = blocks(a['mx']) ^ blocks(b['mx'])
                errs.append('%s: разрезы, ключи %s' % (k, sorted({x[0] for x in d})[:8]))
        # ключ разреза — только в одной части
        seen = {}
        for p in ('people', 'flow', 'aux'):
            for r in parts[p]:
                for b3 in blocks(r['mx']):
                    seen.setdefault((r['id'], b3[0]), set()).add(p)
        dup = sorted({k[1] for k, v in seen.items() if len(v) > 1})
        if dup:
            errs.append('ключ разреза в двух частях: %s' % dup)
        wkb = sum(len(json.dumps(r, ensure_ascii=False)) for r in whole) / 1024
        pk = {p: sum(len(json.dumps(r, ensure_ascii=False)) for r in parts[p]) / 1024 for p in PARTS}
        print('%-18s узлов %3d · целый %6.1f КБ · части %s · %s' % (
            name, sum(1 for r in whole if r['role'] in ('scope', 'c', 'g', 'x')), wkb,
            ' '.join('%s %.0f' % (p, pk[p]) for p in PARTS), 'OK' if not errs else 'РАСХОЖДЕНИЯ: ' + '; '.join(errs[:6])))
        bad += len(errs)
    s.close()
    print('ИТОГ:', 'сумма частей равна целому ответу' if not bad else 'есть расхождения')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()

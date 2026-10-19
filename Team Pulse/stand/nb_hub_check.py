# Сквозная сверка: ноутбук «1. Helicopter — ноут TeamPulse Hub.yaml» целиком (stand/nb_tp20.py --hub)
# → ClickHouse → датасеты: файл 2 (на hr_structure_overall) и 2а (на teampulse_hub_*) против правды
# по людям той же симуляции. Сверяются все узлы ответа (выбранный юнит, база, три уровня), все ряды
# m_*, при нескольких фильтрах и при шести настройках сервера.
#
#   python3 stand/nb_tp20.py --hub <папка> && python3 stand/nb_hub_check.py <папка>
import json, os, sys, datetime as dt
from collections import defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dataset                                                            # noqa: E402
import nb_tp20 as nb                                                      # noqa: E402
from chdb import session                                                  # noqa: E402

DIR = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub')
F2 = dataset.SQL
F2A = os.path.join(DIR, '2а. Proteus — датасет на таблицах ноутбука.sql')
# ряд ответа → мера правды; переводы файла 2 — без уровня (завышены наверху), их не сверяем
KEYS = {'hc': 'hc', 'act': 'act', 'avg': 'ssch', 'hire': 'hire', 'fire': 'fire', 'tin': 'tin', 'tout': 'tout',
        'perf': 'perf', 'grt': 'grt2'}


def run(db, sql, flt, settings=''):
    dataset.SQL = sql
    s = session.Session(db)
    out, rows = dataset.query(s, dataset.render(flt).strip().rstrip(';'), settings)
    s.close()
    return out, rows


def main():
    d = sys.argv[1]
    db = os.path.join(d, 'db')
    U, people = nb.simulate()
    perf, office, grt = nb.side(people)
    names = {k: tuple(U[x][0] for x in nb.path(U, k)) for k in U}
    ms = nb.months()[:-1]                       # 2025-01 … 2026-09 — сетка ответа
    cases = [('без фильтров', {}, lambda p: True),
             ('IT + штат', {'it_f': ['IT'], 'staff_f': ['Штат']}, lambda p: p['it'] == 'IT' and p['rel'] == 'Штатный сотрудник'),
             ('покраска HQ (2а)', {'paint_f': ['Hq']}, lambda p: p['oper'] == 'HQ'),
             ('NonIT строчными', {'it_f': ['nonit']}, lambda p: p['it'] == 'NonIT'),
             ('Digital (отдельно от NonIT)', {'it_f': ['Digital']}, lambda p: p['it'] == 'Digital'),
             ('покраска Line + Support (2а)', {'paint_f': ['Line', 'Support']}, lambda p: p['oper'] in ('Line', 'Support'))]
    raw = {}
    ok = True
    for name, flt, pred in cases:
        for label, sql in (('файл 2 ', F2), ('файл 2а', F2A)):
            T = nb.truth(U, people, perf, grt, raw.get(name, pred) if label == 'файл 2а' else pred,
                         agg=label == 'файл 2 ')
            if label == 'файл 2 ' and 'paint_f' in flt:
                continue                         # в hr_structure_overall покраски нет
            f = dict(flt)
            pred_note = ''
            outs = {run(db, sql, f, st)[0] for st in dataset.CFG.values()}
            out, rows = run(db, sql, f)
            if len(outs) != 1:
                ok = False
            bad = defaultdict(int)
            nodes = 0
            for r in rows:
                if r['role'] not in ('scope', 'base', 'c', 'g', 'x'):
                    continue
                if label == 'файл 2а':
                    rk = r['id']
                else:                            # id файла 2 — md5 пути имён
                    rk = next((k for k, v in names.items() if dataset.uid('\t'.join(v)) == r['id']), None)
                if rk == 'all':                  # общий корень build_hub — сумма корней; переход
                    roots = [k for k in U if U[k][1] is None]   # между корнями для него внутренний
                    for m in ms:
                        for kk in set(x for k in roots for x in T[(k, m)]):
                            T[('all', m)][kk] = 0 if kk in ('tin', 'tout') else sum(T[(k, m)][kk] for k in roots)
                elif rk not in U:
                    bad['узел не найден'] += 1
                    continue
                nodes += 1
                a = {k: [float(x) for x in r['m_' + k].split(',')] for k in
                     ('hc', 'act', 'avg', 'hire', 'fire', 'tin', 'tout', 'pnor', 'plow', 'phig', 'pgry', 'gapr', 'gdec')}
                a['perf'] = [w + x + y + z for w, x, y, z in zip(a['pnor'], a['plow'], a['phig'], a['pgry'])]
                a['grt'] = [x + y for x, y in zip(a['gapr'], a['gdec'])]
                for k, tk in KEYS.items():
                    if label == 'файл 2 ' and k in ('tin', 'tout'):
                        continue
                    exp = [round(T[(rk, m)][tk], 1) for m in ms]
                    if [round(x, 1) for x in a[k]] != exp:
                        bad[k] += 1
            if label == 'файл 2а':
                # 19.10: справочник — все узлы, fd — численность последнего месяца по сочетаниям
                # покраска × IT × штат: сумма прошедших фильтры случая = правда по людям
                meta = json.loads(rows[0]['j'])
                fv = meta.get('fdv') or {}
                dl = [l.split('\t') for l in next(r for r in rows if r['role'] == 'dict')['j'].split('\n') if l]
                ks = [fv.get(k) or [] for k in ('paint', 'it', 'staff')]
                want = [{x.lower() for x in f.get(c, [])} for c in ('paint_f', 'it_f', 'staff_f')]
                for l in dl:
                    rk, fd = l[0], (l[6] if len(l) > 6 else '')
                    n = 0.0
                    for x in fd.split(' '):
                        if not x:
                            continue
                        c, v = x.split(':')
                        c = int(c)
                        ic = c % len(ks[2]); c //= len(ks[2])
                        ib = c % len(ks[1]); ia = c // len(ks[1])
                        vals = (ks[0][ia], ks[1][ib], ks[2][ic])
                        if all(not w or v_.lower() in w for w, v_ in zip(want, vals)):
                            n += float(v)
                    if rk == 'all':
                        roots = [k for k in U if U[k][1] is None]
                        exp = sum(T[(k, ms[-1])]['hc'] for k in roots)
                    elif rk in U:
                        exp = T[(rk, ms[-1])]['hc']
                    else:
                        bad['fd: узел не найден'] += 1
                        continue
                    if round(n) != round(exp):
                        bad['fd'] += 1
                if len(dl) != len(U) + (1 if any(l[0] == 'all' for l in dl) else 0):
                    bad['dict: не все узлы'] += 1
                # логин руководителя: у юнита — h<юнит> (stand: structure_rows), у юнита со своими
                # людьми на конец месяца он обязан быть
                if name == 'без фильтров':
                    kids = defaultdict(list)
                    for k, (_, par) in U.items():
                        if par:
                            kids[par].append(k)
                    for l in dl:
                        rk, hd = l[0], (l[5] if len(l) > 5 else '')
                        if rk not in U:
                            continue
                        own = T[(rk, ms[-1])]['hc'] - sum(T[(c, ms[-1])]['hc'] for c in kids[rk])
                        if (hd and hd != 'h' + rk) or (own > 0 and not hd):
                            bad['логин руководителя'] += 1
            res = 'сходится' if not bad else 'РАСХОЖДЕНИЯ ' + ', '.join(f'{k}: {v} узл.' for k, v in bad.items())
            if label == 'файл 2а' and bad:
                ok = False
            print(f'{name:24} {label}: узлов {nodes:3} · {len(outs)} отв. при 6 настройках · {res}{pred_note}')
    print('ИТОГ:', 'датасет 2а = правда по людям' if ok else 'есть расхождения')
    return ok


if __name__ == '__main__':
    sys.exit(0 if main() else 1)

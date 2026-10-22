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
    # 21.10, поставка 50: вакансии и AI — не люди, фильтры среза на них не действуют: правда одна
    TV, TA = nb.truth_vac(U, nb.vacancies(U)), nb.truth_ai(U, people)
    ms = nb.months()                            # 2025-01 … 2026-10 — сетка ответа (20.10: с текущим незакрытым)
    # 21.10: срез человека меняется во времени — фильтр по дню (nb.attr)
    A = nb.attr
    cases = [('без фильтров', {}, lambda p, d: True),
             ('IT + штат', {'it_f': ['IT'], 'staff_f': ['Штат']},
              lambda p, d: A(p, 'it', d) == 'IT' and A(p, 'rel', d) == 'Штатный сотрудник'),
             ('покраска HQ (2а)', {'paint_f': ['Hq']}, lambda p, d: A(p, 'oper', d) == 'HQ'),
             ('NonIT строчными', {'it_f': ['nonit']}, lambda p, d: A(p, 'it', d) == 'NonIT'),
             ('Digital (отдельно от NonIT)', {'it_f': ['Digital']}, lambda p, d: A(p, 'it', d) == 'Digital'),
             ('покраска Line + Support (2а)', {'paint_f': ['Line', 'Support']},
              lambda p, d: A(p, 'oper', d) in ('Line', 'Support')),
             ('штат + HQ (2а)', {'staff_f': ['Штат'], 'paint_f': ['HQ']},
              lambda p, d: A(p, 'rel', d) == 'Штатный сотрудник' and A(p, 'oper', d) == 'HQ'),
             # 20.10: тип численности — по умолчанию (случаи выше) «Активная», «Вся» — все строки
             ('вся численность', {'act_f': ['Вся']}, lambda p, d: True),
             ('вся численность + IT + штат', {'act_f': ['Вся'], 'it_f': ['IT'], 'staff_f': ['Штат']},
              lambda p, d: A(p, 'it', d) == 'IT' and A(p, 'rel', d) == 'Штатный сотрудник'),
             # 22.10, поставка 60: любой набор типов численности. По умолчанию (поставка 61) — «Активная»; при
             # «Активная + Подрядчики», как в мастер-отчёте, подрядчик в штат — внутри выбора, при одной «Активной» —
             # перевод «в», при одних «Подрядчиках» — «из»
             ('Активная + Подрядчики, как мастер-отчёт (2а)', {'act_f': ['Активная', 'Подрядчики']}, lambda p, d: True),
             ('только Подрядчики (2а)', {'act_f': ['Подрядчики']}, lambda p, d: True),
             ('Активная + Декрет (2а)', {'act_f': ['Активная', 'Декрет']}, lambda p, d: True),
             ('Подрядчики + штат (2а)', {'act_f': ['Подрядчики'], 'staff_f': ['Штат']},
              lambda p, d: A(p, 'rel', d) == 'Штатный сотрудник')]
    raw = {}
    ok = True
    for name, flt, pred in cases:
        # типы численности выбора: по умолчанию nb.ACTIVE («Активная»), «Вся» — все (None), иначе — названные
        av = flt.get('act_f')
        act = nb.ACTIVE if av is None else None if av == ['Вся'] else tuple(av)
        for label, sql in (('файл 2 ', F2), ('файл 2а', F2A)):
            T = nb.truth(U, people, perf, grt, raw.get(name, pred) if label == 'файл 2а' else pred,
                         agg=label == 'файл 2 ' and act is not None, act=act, hday=label == 'файл 2а')
            if label == 'файл 2 ' and ('paint_f' in flt or av not in (None, ['Вся'])):
                continue                         # в hr_structure_overall нет покраски и типов численности целиком
            if label == 'файл 2а':               # найм на конец месяца — для разбивок найма (mx)
                Te = nb.truth(U, people, perf, grt, raw.get(name, pred), act=act)
            if label == 'файл 2а':               # 21.10: переводы 2а — под фильтры (переходы ноутбука)
                Tt = nb.truth_trf(U, people, pred, act)
                for k in set(T) | set(Tt):
                    T[k]['tin'], T[k]['tout'] = Tt[k]['tin'], Tt[k]['tout']
            f = dict(flt)
            pred_note = ''
            outs = {run(db, sql, f, st)[0] for st in dataset.CFG.values()}
            out, rows = run(db, sql, f)
            if len(outs) != 1:
                ok = False
            bad = defaultdict(int)
            bal = [0, 0.0]                       # невязка водопада: узлов × месяцев, сумма модулей
            hit = [0.0]
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
                            if kk not in ('tin', 'tout'):    # переводы общего корня — свои (truth_trf)
                                T[('all', m)][kk] = sum(T[(k, m)][kk] for k in roots)
                        if label == 'файл 2а':
                            Te[('all', m)]['hire'] = sum(Te[(k, m)]['hire'] for k in roots)
                elif rk not in U:
                    bad['узел не найден'] += 1
                    continue
                nodes += 1
                a = {k: [float(x) for x in r['m_' + k].split(',')] for k in
                     ('hc', 'act', 'avg', 'hire', 'fire', 'tin', 'tout', 'pnor', 'plow', 'phig', 'pgry', 'gapr', 'gdec')}
                # поставка 56: найм по дню события из переходов (hit) — его и берёт чарт, если он не пустой
                if label == 'файл 2а' and r.get('m_hit') is not None:
                    hit[0] += sum(float(x) for x in r['m_hit'].split(','))
                    a['hire'] = [float(x) for x in r['m_hit'].split(',')]
                a['perf'] = [w + x + y + z for w, x, y, z in zip(a['pnor'], a['plow'], a['phig'], a['pgry'])]
                a['grt'] = [x + y for x, y in zip(a['gapr'], a['gdec'])]
                if label == 'файл 2а':
                    # 21.10, заказчик: водопад сходится без «прочего» — численность месяца минус прошлого =
                    # найм − отток + переводы в − переводы из, у каждого узла ответа и в каждом месяце
                    for i in range(1, len(ms)):
                        r_ = a['hc'][i] - a['hc'][i - 1] - (a['hire'][i] - a['fire'][i] + a['tin'][i] - a['tout'][i])
                        if abs(r_) > 0.01:
                            bal[0] += 1
                            bal[1] += abs(r_)
                for k, tk in KEYS.items():
                    if label == 'файл 2 ' and k in ('tin', 'tout'):
                        continue
                    exp = [round(T[(rk, m)][tk], 1) for m in ms]
                    if [round(x, 1) for x in a[k]] != exp:
                        bad[k] += 1
                if label == 'файл 2а':
                    # поставка 50: обычные увольнения (под фильтрами), вакансии и AI (без фильтров)
                    for k, src in [('nreg', T)] + [(k, TV) for k in ('vop', 'vcl', 'vap', 'vtd', 'vtn', 'vjn')] + \
                            [(k, TA) for k in ('aiw', 'aip', 'aic')]:
                        got = [round(float(x), 1) for x in r['m_' + k].split(',')]
                        if got != [round(src[(rk, m)][k], 1) for m in ms]:
                            bad[k] += 1
                    # новые разрезы: в сумме — численность последнего месяца (sp, tc), увольнения (xsp, xtc)
                    # и найм (hk, hch, hg, hsp — на активной) с начала года
                    mx = defaultdict(float)
                    for line in (r.get('mx') or '').split('\n'):
                        if line.count('\t') == 2:
                            kk, _, n = line.split('\t')
                            mx[kk] += float(n)
                    ytd = [m for m in ms if m.year == ms[-1].year]
                    want_mx = {'sp': T[(rk, ms[-1])]['hc'], 'tc': T[(rk, ms[-1])]['hc'],
                               'xsp': sum(T[(rk, m)]['fire'] for m in ytd), 'xtc': sum(T[(rk, m)]['fire'] for m in ytd)}
                    if act:
                        # разбивки найма — из строк ноутбука с измерениями на конец месяца (как TP 2.0): их сумма —
                        # найм с срезом конца месяца, а не дня найма (hday). Разница — у тех, кому срез сменили в
                        # месяц найма
                        want_mx.update({k: sum(Te[(rk, m)]['hire'] for m in ytd) for k in ('hk', 'hch', 'hg', 'hsp')})
                    for kk, w in want_mx.items():
                        if abs(mx[kk] - w) > 0.5:
                            bad['mx ' + kk] += 1
            if label == 'файл 2а':
                # 19.10: справочник — все узлы, fd — численность последнего месяца по сочетаниям
                # покраска × IT × штат: сумма прошедших фильтры случая = правда по людям
                meta = json.loads(rows[0]['j'])
                if meta.get('dt') != str(nb.D1) or meta.get('lm') != str(ms[-1]):   # 20.10: текущий месяц и дата данных
                    bad['дата данных ' + str(meta.get('dt')) + ' / ' + str(meta.get('lm'))] += 1
                fv = meta.get('fdv') or {}
                dl = [l.split('\t') for l in next(r for r in rows if r['role'] == 'dict')['j'].split('\n') if l]
                # 20.10: четвёртый разрез — тип численности; пустой словарь (нет act_cd) — один тип
                ks = [fv.get(k) or [] for k in ('paint', 'it', 'staff', 'act')]
                # тип численности: по умолчанию «Активная» (nb.ACTIVE), «Вся» — любой, иначе — названные
                want = [{x.lower() for x in f.get(c, [])} for c in ('paint_f', 'it_f', 'staff_f')] + [
                    {x.lower() for x in nb.ACTIVE} if av is None else set() if av == ['Вся'] else {x.lower() for x in av}]
                for l in dl:
                    rk, fd = l[0], (l[6] if len(l) > 6 else '')
                    n = 0.0
                    for x in fd.split(' '):
                        if not x:
                            continue
                        c, v = x.split(':')
                        c = int(c)
                        ix = []
                        for kk in reversed(ks):
                            L = max(len(kk), 1); ix.append(c % L); c //= L
                        ix.reverse()
                        vals = tuple(kk[i] if kk else '' for kk, i in zip(ks, ix))
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
            if label == 'файл 2а' and not hit[0]:
                bad['найм из переходов (hit) пуст'] += 1
            if bal[0]:
                bad[f'водопад: «прочее» в {bal[0]} узл.×мес. (сумма {bal[1]:.0f} чел)'] += 1
            res = 'сходится' if not bad else 'РАСХОЖДЕНИЯ ' + ', '.join(f'{k}: {v} узл.' for k, v in bad.items())
            if label == 'файл 2а' and bad:
                ok = False
            print(f'{name:24} {label}: узлов {nodes:3} · {len(outs)} отв. при 6 настройках · {res}{pred_note}')
    # поставка 59: переводы — строки событий с флагом источника (правило мастер-отчёта): «в» и «из» без флага
    # юнита и типа быть не должно (то же — проверка 7 в hub checks)
    s = session.Session(db)
    kinds = s.query("SELECT trf_kind, sum(trf_cnt) FROM prod_proteus.teampulse_hub_trf GROUP BY trf_kind ORDER BY trf_kind",
                    'TSV').bytes().decode().strip()
    nf = s.query("SELECT count() FROM prod_proteus.teampulse_hub_trf WHERE trf_kind IN ('i', 'o') AND ifNull(fu, 0) "
                 "+ ifNull(fa, 0) + ifNull(fp, 0) + ifNull(fi, 0) + ifNull(fs, 0) = 0", 'TSV').bytes().decode().strip()
    s.close()
    print('переводы (i — в, o — из, h — найм):', kinds.replace('\t', ' ').replace('\n', ', '), '· «в / из» без флага:', nf)
    if nf != '0':
        ok = False
    print('ИТОГ:', 'датасет 2а = правда по людям' if ok else 'есть расхождения')
    return ok


if __name__ == '__main__':
    sys.exit(0 if main() else 1)

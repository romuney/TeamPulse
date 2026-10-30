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
    MM = nb.mon_month(nb.mon_days(people))      # поставка 71: мониторинг по дням — месяц человека
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
    # 31.10-б, п. 6: те же фильтры без покраски; файл 6, п. 4 — и только HQ (rost_pred ниже): эталон «Роста»
    NP = {'покраска HQ (2а)': lambda p, d: True, 'покраска Line + Support (2а)': lambda p, d: True,
          'штат + HQ (2а)': lambda p, d: A(p, 'rel', d) == 'Штатный сотрудник'}
    def rost_pred(name, pred):
        b = NP.get(name, raw.get(name, pred))
        return lambda p, d: b(p, d) and A(p, 'oper', d) == 'HQ'
    ok = True
    for name, flt, pred in cases:
        # типы численности выбора: по умолчанию nb.ACTIVE («Активная»), «Вся» — все (None), иначе — названные
        av = flt.get('act_f')
        act = nb.ACTIVE if av is None else None if av == ['Вся'] else tuple(av)
        # поставка 64: ноутбук отчёта не считает переводы (EXEC build_all_metrics, transfers=False) — файл 2 на его
        # hr_structure_with_ssch не собирается (в бою файл 2 читает таблицу ноутбука TP 2.0); сверяется 2а
        for label, sql in (('файл 2а', F2A),):
            T = nb.truth(U, people, perf, grt, raw.get(name, pred) if label == 'файл 2а' else pred,
                         agg=label == 'файл 2 ' and act is not None, act=act, hday=label == 'файл 2а')
            if label == 'файл 2 ' and ('paint_f' in flt or av not in (None, ['Вся'])):
                continue                         # в hr_structure_overall нет покраски и типов численности целиком
            if label == 'файл 2а':               # найм на конец месяца — для разбивок найма (mx)
                Te = nb.truth(U, people, perf, grt, raw.get(name, pred), act=act)
                # поставка 66: посещения Адели — ряды бронирований и руководителей, города, календарь, сегмент
                To, Dd, Co, MH = nb.truth_office(U, people, office, raw.get(name, pred), act)
                Tm = nb.truth_mon(U, people, MM, raw.get(name, pred), act)
            if label == 'файл 2а':               # 21.10: переводы 2а — под фильтры (переходы ноутбука)
                # поставка 63: смена атрибута, по которому стоит фильтр, — перевод и внутри выбора
                chg = [h for k, h in (('paint_f', 'operh'), ('it_f', 'ith'), ('staff_f', 'relh')) if k in flt]
                chg += ['acth'] if act is not None else []
                Tt = nb.truth_trf(U, people, pred, act, chg)
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
                if label == 'файл 2а' and r.get('m_hcd') is not None:
                    # поставка 65: найм по видам — из учебной группы в боевую (hcd) и стажёр в штат (hst)
                    for k in ('hcd', 'hst'):
                        got = [round(float(x), 1) for x in r['m_' + k].split(',')]
                        if got != [round(T[(rk, m)][k], 1) for m in ms]:
                            bad[k] += 1
                    if not any(float(x) for x in r['m_hcd'].split(',') + r['m_hst'].split(',')) and act and rk == 'all':
                        bad['найм по видам пуст'] += 1
                if label == 'файл 2а' and r.get('m_din') is not None:
                    # поставка 64: переводы «напрямую в юните» — свой узел юнит:d (люди в самом юните)
                    for k, tk in (('din', 'tin'), ('dout', 'tout')):
                        got = [round(float(x), 1) for x in r['m_' + k].split(',')]
                        if got != [round(T[(rk + ':d', m)][tk], 1) for m in ms]:
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
                    mx, mxv = defaultdict(float), defaultdict(dict)
                    for line in (r.get('mx') or '').split('\n'):
                        if line.count('\t') == 2:
                            kk, vv, n = line.split('\t')
                            mx[kk] += float(n)
                            mxv[kk][vv] = float(n)
                    # поставка 66: посещения Адели. Ряды: рабочие дни и посещения (wday ovis), бронирования (bk bkv vsv),
                    # руководители (hwd hov) — под фильтрами
                    for k in ('wday', 'ovis', 'bk', 'bkv', 'vsv', 'hwd', 'hov'):
                        if r.get('m_' + k) is None:
                            bad['нет ряда ' + k] += 1
                            continue
                        got = [round(float(x), 1) for x in r['m_' + k].split(',')]
                        if got != [round(To[(rk, m)][k], 1) for m in ms]:
                            bad[k] += 1
                    # поставка 71: мониторинг по дням (with_performance Адели) — люди в сегментах прогулов, работы в
                    # выходной и доли звонков, сумма средних часов дня и звонков — под фильтрами
                    for k in ('ab25', 'ab5', 'we25', 'we5', 't23', 't35', 't5', 'hrs', 'hrn', 'tlk'):
                        if r.get('m_' + k) is None:
                            bad['нет ряда ' + k] += 1
                            continue
                        got = [float(x) for x in r['m_' + k].split(',')]
                        if any(abs(g - Tm[(rk, m)][k]) > 0.06 for g, m in zip(got, ms)):
                            bad[k] += 1
                    # сегмент mh (численность руководителей и остальных), города последнего месяца (oc ocp) — по значениям
                    want_v = {'mh': {v: n for v, n in MH[rk].items() if n}, 'oc': {v: n for v, n in Co[rk]['oc'].items() if n},
                              'ocp': {v: n for v, n in Co[rk]['ocp'].items() if n},
                              # 27.10-в, п. 14: нарушения брони по городам (ov) и база (ob)
                              'ov': {v: n for v, n in Co[rk]['ov'].items() if n}, 'ob': {v: n for v, n in Co[rk]['ob'].items() if n}}
                    # 31.10-б, п. 6: «Рост HQ» — без фильтра покраски; файл 6, п. 4 — только по численности HQ (cond_rh);
                    # п. 3 и 6 — у каждого узла (выбор строки таблицы фильтрует вкладку)
                    want_v.update(nb.truth_rost(U, people, grt, rk, rost_pred(name, pred), act))
                    # календарь (dw dw) и уходы по инициатору и месяцу (xim, 26.10-б) — только у выбранного юнита
                    if r['role'] == 'scope':
                        want_v['xim'] = nb.truth_fire_init(U, people, rk, raw.get(name, pred), act)
                        days = sorted(d for (n_, d) in Dd if n_ == rk)
                        want_v['dw'] = {str(d): Dd[(rk, d)]['dw'] for d in days if Dd[(rk, d)]['dw']}
                        want_v['do'] = {str(d): Dd[(rk, d)]['do'] for d in days if Dd[(rk, d)]['do']}
                        if not want_v['dw']:
                            bad['календарь пуст'] += 1
                        # поставка 71: T-рост — заявки по месяцам (rm), успешность по желаемому (rq), статусы (rs)
                        # поставка 73: возраст в годах (e) — средний возраст команды
                        want_v['e'] = nb.truth_age(U, people, rk, raw.get(name, pred), act)
                        if not want_v['rs']:
                            bad['T-рост пуст'] += 1
                        # 28.10, п. 1: найм по специализации — в сумме = ряду с начала года. Переводы в и из по
                        # специализациям — по флагам переводов под фильтры или смены специализации (поставка 90, truth_spec_move)
                        ytd_ = nb.ytd_months()             # поставка 90: январь..последний закрытый месяц
                        if abs(mx['tsh'] - sum(T[(rk, m)]['hire'] for m in ytd_)) > 0.5:
                            bad['mx tsh'] += 1
                        want_v.update(nb.truth_spec_move(U, people, rk, raw.get(name, pred), act, chg))
                        if not mxv.get('tsh'):
                            bad['движение по специализациям пусто'] += 1
                        # поставка 90: окно — январь..сентябрь стенда; у узких выборов («только Подрядчики») смен специализации
                        # в нём нет и по правде — пустота проверяется только у выборов с «Активной» или «Вся»
                        if not want_v['tsi'] and (act is None or 'Активная' in act):
                            bad['переводы по специализациям пусты'] += 1
                        # 31.10-б, п. 1: es / en — по каждому разрезу в сумме те же люди с возрастом и та же сумма возрастов,
                        # что в разрезе e (возраст → людей); у пола — ещё и по каждому значению против правды по людям
                        ev = mxv.get('e', {})
                        n_e = sum(ev.values()); s_e = sum(float(v.replace(',', '.')) * n for v, n in ev.items())
                        for dk in ('g', 'a', 'gr', 'sp', 'rg'):
                            en_ = sum(n for v, n in mxv.get('en', {}).items() if v.startswith(dk + '|'))
                            es_ = sum(n for v, n in mxv.get('es', {}).items() if v.startswith(dk + '|'))
                            if abs(en_ - n_e) > 0.5 or abs(es_ - s_e) > 0.5 + 0.01 * s_e:
                                bad['mx es/en ' + dk] += 1
                        if n_e and not mxv.get('en'):
                            bad['средний возраст по разрезам пуст'] += 1
                        # 31.10-б, п. 9: посещения и люди-руководители по городу (ocl ocpl) — часть всех (oc ocp)
                        for kl, ka in (('ocl', 'oc'), ('ocpl', 'ocp')):
                            if any(n > mxv.get(ka, {}).get(v, 0) + 0.5 for v, n in mxv.get(kl, {}).items()):
                                bad['mx ' + kl + ' больше ' + ka] += 1
                        if mxv.get('oc') and not mxv.get('ocl'):
                            bad['руководители по городам пусты'] += 1
                        # п. 7: численность по специализации на начало года (sp0) — в сумме = численности декабря
                        dec = [m for m in ms if m.year == ms[-1].year - 1][-1]
                        if abs(mx['sp0'] - T[(rk, dec)]['hc']) > 0.5:
                            bad['mx sp0'] += 1
                        # поставка 90: численность по специализации на конец последнего закрытого месяца (sp1) — в сумме =
                        # численности этого месяца
                        if abs(mx['sp1'] - T[(rk, nb.closed_month())]['hc']) > 0.5 or not mxv.get('sp1'):
                            bad['mx sp1'] += 1
                    elif any(mxv.get(k) for k in ('dw', 'do', 'xim', 'tsh', 'tsi', 'tso', 'sp0', 'sp1', 'es', 'en')):
                        bad['календарь не у выбранного'] += 1
                    for kk, w in want_v.items():
                        g = mxv.get(kk, {})
                        if set(g) != set(w) or any(abs(g[v] - w[v]) > 0.05 for v in w):
                            bad['mx ' + kk] += 1
                    # поставка 90: «с начала года» — январь..последний закрытый месяц (у стенда D1 = 12.10 → январь..сентябрь)
                    ytd = nb.ytd_months()
                    # закрытые вакансии по каналу (vk) и уровню кандидата (vq) — в сумме = закрытым ряда за эти месяцы
                    vcl = [float(x) for x in r['m_vcl'].split(',')]
                    for kk in ('vk', 'vq'):
                        if abs(mx[kk] - sum(vcl[ms.index(m)] for m in ytd)) > 0.5:
                            bad['mx ' + kk] += 1
                    # поставка 62: регион (rg) и пара «стрим|специализация» (ws) — тоже численность
                    want_mx = {'sp': T[(rk, ms[-1])]['hc'], 'tc': T[(rk, ms[-1])]['hc'],
                               'rg': T[(rk, ms[-1])]['hc'], 'ws': T[(rk, ms[-1])]['hc'],
                               'xsp': sum(T[(rk, m)]['fire'] for m in ytd), 'xtc': sum(T[(rk, m)]['fire'] for m in ytd)}
                    # поставка 90: остальные разрезы увольнений — тоже за январь..cm (xq — нежелательные)
                    want_mx.update({k: sum(T[(rk, m)]['fire'] for m in ytd) for k in ('xr', 'xi', 'xp', 'xt', 'xg', 'xs')})
                    want_mx['xq'] = sum(T[(rk, m)]['reg'] for m in ytd)
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
                        # поставка 66: имя руководителя (8-е поле) — из unit_head_structure по логину; у юнита со своими
                        # людьми — имя его руководителя (stand: person_nm)
                        hn = l[7] if len(l) > 7 else None
                        if hn is None:
                            bad['dict без имени руководителя'] += 1
                        elif own > 0:
                            hrk = min(p['rk'] for p in people if p['start'] <= nb.eom(ms[-1])
                                      and (p['end'] is None or nb.eom(ms[-1]) < p['end'])
                                      and nb.at(p['unit'], nb.eom(ms[-1])) == rk)
                            f_, l_ = nb.person_nm(hrk)
                            if hn != (f_ + ' ' + l_ if l_ else f_):
                                bad['имя руководителя'] += 1
            if label == 'файл 2а':
                # поставка 65: строка hq — светофор «Как уходит HQ?»: выбранный юнит под «HQ + Активная» (покраска и тип
                # численности из фильтров не действуют, IT-код и штат — как выбраны); сверяются численность, ССЧ,
                # увольнения, нежелательные и обычные — всё, из чего считаются три метрики светофора
                itv = {x.lower() for x in flt.get('it_f', [])}
                stv = {x.lower() for x in flt.get('staff_f', [])}
                pred_hq = lambda p, d: A(p, 'oper', d) == 'HQ' and (not itv or A(p, 'it', d).lower() in itv) and (
                    not stv or ('штат' if A(p, 'rel', d) == 'Штатный сотрудник' else 'не штат') in stv)
                Th = nb.truth(U, people, perf, grt, pred_hq, act=nb.ACTIVE, hday=True)
                hq = [r for r in rows if r['role'] == 'hq']
                if len(hq) != 1:
                    bad['строка hq: ' + str(len(hq))] += 1
                # файл 6, п. 2: ряды HQ у каждого узла (fh rh nrh avh) — «Как уходит HQ» по выбранной строке таблицы
                for r in rows:
                    if r['role'] not in ('scope', 'c', 'g', 'x') or r.get('m_fh') is None or r['id'] not in U:
                        continue
                    for k, tk in (('fh', 'fire'), ('hch', 'hc'), ('rh', 'reg'), ('nrh', 'nreg'), ('avh', 'ssch')):
                        got = [round(float(x), 1) for x in r['m_' + k].split(',')]
                        if got != [round(Th[(r['id'], m)][tk], 1) for m in ms]:
                            bad['узел ' + k] += 1
                if not any(r.get('m_fh') is not None for r in rows):
                    bad['нет ряда fh'] += 1
                for r in hq:
                    rk = r['id']
                    ks = [k for k in U if U[k][1] is None] if rk == 'all' else [rk]
                    for k, tk in (('hc', 'hc'), ('avg', 'ssch'), ('fire', 'fire'), ('reg', 'reg'), ('nreg', 'nreg')):
                        got = [round(float(x), 1) for x in r['m_' + k].split(',')]
                        if got != [round(sum(Th[(x, m)][tk] for x in ks), 1) for m in ms]:
                            bad['hq ' + k] += 1
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
                 "+ ifNull(fa, 0) + ifNull(fp, 0) + ifNull(fi, 0) + ifNull(fs, 0) + ifNull(fsp, 0) = 0", 'TSV').bytes().decode().strip()
    s.close()
    print('переводы (i — в, o — из, h — найм):', kinds.replace('\t', ' ').replace('\n', ', '), '· «в / из» без флага:', nf)
    if nf != '0':
        ok = False
    print('ИТОГ:', 'датасет 2а = правда по людям' if ok else 'есть расхождения')
    return ok


if __name__ == '__main__':
    sys.exit(0 if main() else 1)

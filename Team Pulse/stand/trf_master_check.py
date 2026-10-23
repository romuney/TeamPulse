# Переводы ноутбука (teampulse_hub_trf) и датасета 2а против правила мастер-отчёта, написанного заново на Python
# по строкам дневного источника (поставка 59). Правило — старый TeamPulse (transfers.yaml: transfer_in /
# transfer_out / dinamica), его же подтвердили выборки боя «RawData&Result»:
#   в     — строка с флагом «в»: юнит уровня узла (lvlN_mngt_unit_in_trsf_flg) или смена типа численности,
#           покраски, IT-кода, типа оформления (transfer_to_*); без найма. Срез — состояние этой строки
#   из    — строка с флагом «из» (…_out_…), без увольнения; last_day_of_month_flg — в следующий месяц
#   найм  — строка с hire_flg
#   флаг смены атрибута засчитан, только если по атрибуту выбран фильтр (тип численности — любой набор типов
#   active_type_nm, поставка 60; по умолчанию «Активная», без подрядчиков, — поставка 61); при выборе типов кандидат /
#   стажёр (in_ok = 0) — найм, не перевод. Фильтр из нескольких значений — смена засчитана, только если соседний
#   день вне выбора: подрядчик в штат при «Активная + Подрядчики» — не перевод
# Сверка: 1) таблица — построчно (узел × месяц × вид × срез × флаги × in_ok → число); 2) датасет 2а — переводы
# в / из и найм по дню у всех узлов ответа при нескольких наборах фильтров.
#
#   python3 stand/trf_master_check.py <папка> [--edge]
# --edge — к источнику стенда добавлены строки со сбоями флагов: флаг без смены значения, «из» без «в»,
# флаг не того уровня, дубли строк дня, last_day_of_month_flg не в последний день, найм / увольнение с флагом
# перевода, переход кандидата, подрядчик в штат. NB_ROOTS=2 — два корня (общий корень «all»).
import datetime as dt, os, sys
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dataset                                                            # noqa: E402
import nb_tp20 as nb                                                      # noqa: E402
from chdb import session                                                  # noqa: E402

YAML = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', '1. Helicopter — ноут TeamPulse Hub.yaml')
F2A = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', '2а. Proteus — датасет на таблицах ноутбука.sql')
LV = range(1, 12)
STAFF = 'Штатный сотрудник'
TYPES = (('active_type', 'ia', 'oa'), ('hq', 'ip', 'oq'), ('it', 'ii', 'oi'), ('employment_relation_type', 'ist', 'ost'))


def norm(r):
    """строка источника → как её видит SQL ноутбука (ключи, флаги 0/1, срез)"""
    t = lambda c: None if r[c] is None or r[c] != r[c] else str(r[c])     # NULL и NaN pandas — пусто
    flg = lambda c: int((t(c) or '0') == '1')
    cut = lambda c: (t(c) if t(c) not in (None, '') else '-') if t(c) is not None else '-'
    typ = lambda c: (t(c) or '').strip() or '-'                           # тип численности — целиком (поставка 60)
    v = {'e': r['mdm_employee_rk'], 'dt': r['calendar_dt']}
    for i in LV:
        k = t(f'lvl{i}_mapped_management_unit_rk')
        v[f'k{i}'] = k if k not in (None, '') else '-'
        v[f'ui{i}'] = flg(f'lvl{i}_mngt_unit_in_trsf_flg')
        v[f'uo{i}'] = flg(f'lvl{i}_mngt_unit_out_trsf_flg')
    v.update(pa=cut('emp_specialization_oper_code'), it=cut('emp_specialization_it_code'),
             st='Штат' if r['employment_relation_type_desc'] == STAFF else 'Не штат',
             ac=typ('active_type_nm'),
             hf=flg('hire_flg'), cv=min(flg('transfer_candidate_flg') + flg('transfer_internal_flg'), 1),
             fx=flg('fire_flg'), ld=flg('last_day_of_month_flg'))
    for tp, ai, ao in TYPES:
        v[ai], v[ao] = flg(f'transfer_to_{tp}_flg'), flg(f'transfer_out_{tp}_flg')
    return tuple(sorted(v.items()))


def master(rows, grid_start, lm, multi):
    """события мастер-отчёта: (узел, месяц, вид, покраска, IT, штат, тип, fu, fa, fp, fi, fs, in_ok,
    x_покраска, x_IT, x_штат, x_тип) → число. x_… пустые: с поставки 63 флаг смены атрибута считается как есть,
    без сверки со значением соседнего дня (значения соседнего дня — только в детализации, teampulse_hub_trfe)"""
    rs = [dict(t) for t in set(norm(r) for r in rows)]         # одинаковые строки дня — одна
    none = (None, None, None, None)
    out = Counter()
    for v in rs:
        ms = lambda d: dt.date(d.year, d.month, 1)
        nodes = [(v[f'k{i}'], v[f'ui{i}'], v[f'uo{i}']) for i in LV if v[f'k{i}'] != '-'] + ([('all', 0, 0)] if multi else [])
        # поставка 64: «напрямую в юните» — самый глубокий юнит строки с ':d'; флаг — любой флаг юнита строки (в мастер-
        # отчёте — строка юнита с уровнем ниже «-»: выгрузка боя 23.10, «Переводы5»)
        deep = [v[f'k{i}'] for i in LV if v[f'k{i}'] != '-']
        if deep:
            nodes.append((deep[-1] + ':d', max(v[f'ui{i}'] for i in LV), max(v[f'uo{i}'] for i in LV)))
        cut = (v['pa'], v['it'], v['st'], v['ac'])
        xi = xo = none
        for n, ui, uo in nodes:
            if not v['hf'] and (ui or v['ia'] or v['ip'] or v['ii'] or v['ist']):
                out[(n, ms(v['dt']), 'i') + cut + (ui, v['ia'], v['ip'], v['ii'], v['ist'], 1 - v['cv']) + xi] += 1
            if not v['fx'] and (uo or v['oa'] or v['oq'] or v['oi'] or v['ost']):
                out[(n, ms(v['dt'] + dt.timedelta(v['ld'])), 'o') + cut + (uo, v['oa'], v['oq'], v['oi'], v['ost'], 1) + xo] += 1
            if v['hf']:
                out[(n, ms(v['dt']), 'h') + cut + (0, 0, 0, 0, 0, 1) + none] += 1
    return Counter({k: c for k, c in out.items() if grid_start <= k[1] <= lm})


def expect(ev, flt):
    """переводы в / из и найм по дню, которые датасет обязан отдать: узел × месяц → {tin, tout, hit}"""
    lo = lambda xs: [x.lower() for x in xs]
    act = lo(flt.get('act_f', []))
    act = [] if ('вся' in act or 'all' in act) else (act or lo(nb.ACTIVE))   # по умолчанию — «Активная»
    F = {'paint': lo(flt.get('paint_f', [])), 'it': lo(flt.get('it_f', [])), 'staff': lo(flt.get('staff_f', [])), 'act': act}
    act_on = bool(act)                       # выбран тип численности: кандидат / стажёр — найм, не перевод
    T = {}
    for (n, m, k, pa, it, st, ac, fu, fa, fp, fi, fs, ok, xpa, xit, xst, xac), c in ev.items():
        cut = {'paint': pa, 'it': it, 'staff': st, 'act': ac}
        if any(F[x] and cut[x].lower() not in F[x] for x in F):
            continue
        # смена атрибута — по флагу как есть, если по атрибуту стоит фильтр (поставка 63: и при фильтре из нескольких
        # значений — Подрядчики → Активная при «Активная + Подрядчики» — и «из», и «в», как в мастер-отчёте)
        sel = lambda x, f: f and bool(F[x])
        flg = fu or sel('act', fa) or sel('paint', fp) or sel('it', fi) or sel('staff', fs)
        d = T.setdefault((n, m), {'tin': 0, 'tout': 0, 'hit': 0})
        # кандидат / стажёр (ok = 0) из «в» исключаются всегда, при выборе типа — найм
        if k == 'i' and flg and ok:
            d['tin'] += c
        if k == 'i' and flg and not ok and act_on:
            d['hit'] += c
        if k == 'o' and flg:
            d['tout'] += c
        if k == 'h':
            d['hit'] += c
    return T


def inject(pg, U):
    """строки со сбоями флагов (--edge): как в бою бывает, а мастер-отчёт считает по флагам как есть"""
    t = pg.run("select * from usr_cross_data.hr_executive_proteus where mdm_employee_rk = 600002 and calendar_dt = '2025-06-01'")
    base = {c: t[c].iloc[0] for c in nb.COLS}
    for c in nb.COLS:
        if c.endswith('_flg'):
            base[c] = 0
    base.update(active_count_flg=1, active_type_nm='Активная', emp_specialization_oper_code='HQ',
                emp_specialization_it_code='IT', employment_relation_type_desc=STAFF)
    rows = []

    def day(rk, d, leaf, **kw):
        r = dict(base)
        p = nb.path(U, leaf)
        r.update(calendar_dt=dt.date.fromisoformat(d), mdm_employee_rk=rk,
                 last_day_of_month_flg=int((dt.date.fromisoformat(d) + dt.timedelta(1)).day == 1))
        for i in range(1, 13):
            r[f'lvl{i}_mapped_management_unit_rk'] = p[i - 1] if i <= len(p) else None
            r[f'lvl{i}_mapped_management_unit_nm'] = U[p[i - 1]][0] if i <= len(p) else None
        r.update(kw)
        rows.append([r[c] for c in nb.COLS])

    day(910001, '2025-05-14', '1121', lvl4_mngt_unit_in_trsf_flg=1)                  # флаг «в» без смены юнита
    day(910002, '2025-06-10', '1112', transfer_out_active_type_flg=1)                # «из» Активной без «в»
    day(910003, '2025-07-08', '1131', lvl5_mngt_unit_in_trsf_flg=1)                  # флаг не того уровня
    day(910004, '2025-08-12', '1113', lvl3_mngt_unit_in_trsf_flg=1, lvl4_mngt_unit_in_trsf_flg=1)
    day(910004, '2025-08-12', '1113', lvl3_mngt_unit_in_trsf_flg=1, lvl4_mngt_unit_in_trsf_flg=1)   # точный дубль
    day(910005, '2025-09-03', '1121', lvl4_mngt_unit_in_trsf_flg=1)                  # два юнита в один день
    day(910005, '2025-09-03', '1122', lvl4_mngt_unit_in_trsf_flg=1)
    day(910006, '2025-09-30', '1132', lvl4_mngt_unit_out_trsf_flg=1)                 # «из» в последний день месяца
    day(910007, '2025-10-30', '1132', lvl4_mngt_unit_out_trsf_flg=1, last_day_of_month_flg=1)   # признак не в последний
    day(910008, '2025-11-11', '1111', hire_flg=1, lvl4_mngt_unit_in_trsf_flg=1)      # найм с флагом перевода
    day(910009, '2025-12-16', '1111', fire_flg=1, lvl4_mngt_unit_out_trsf_flg=1)     # увольнение с флагом перевода
    day(910010, '2026-01-20', '1122', transfer_internal_flg=1, transfer_to_active_type_flg=1)   # стажёр в штат
    day(910011, '2026-02-05', '1112', active_count_flg=0, active_type_nm='Прочие',
        transfer_to_active_type_flg=1, lvl4_mngt_unit_in_trsf_flg=1)                  # пришёл в «Прочие»
    day(910012, '2026-03-17', '1131', emp_specialization_oper_code='Line', transfer_to_hq_flg=1)   # покраска
    day(910013, '2026-04-21', '1121', emp_specialization_it_code='Digital', transfer_out_it_flg=1)  # IT, «из»
    day(910014, '2026-05-12', '1113', employment_relation_type_desc='ГПД ФЛ', transfer_to_employment_relation_type_flg=1)
    day(910015, '2026-06-09', '1112', transfer_to_specialization_flg=1, transfer_to_stream_flg=1)    # не тот атрибут
    # поставка 60: подрядчик — в штат. При «Активная + Подрядчики» не перевод, при одной «Активной» —
    # «в», при одних «Подрядчиках» — «из»
    day(910016, '2026-07-06', '1121', active_count_flg=1, active_type_nm='Подрядчики', transfer_out_active_type_flg=1)
    day(910016, '2026-07-07', '1121', active_count_flg=1, active_type_nm='Активная', transfer_to_active_type_flg=1)
    pg.copy('usr_cross_data.hr_executive_proteus', nb.COLS, rows)
    return len(rows)


def main():
    out = sys.argv[1]
    pg = nb.PG(dict(host='/tmp/pgt', port=55432, user='pg', dbname='postgres'))
    U, people = nb.simulate()
    nb.load(pg, U, people)
    if '--edge' in sys.argv:
        print('строк со сбоями флагов:', inject(pg, U))
    nb.run_yaml(pg, YAML, out)
    cal = pg.run('select lm, grid_start, mo from teampulse_hub_cal').iloc[0]
    cols = ', '.join(c for c in nb.COLS if c.endswith('_rk') or c.endswith('_flg') or c in (
        'calendar_dt', 'emp_specialization_oper_code', 'emp_specialization_it_code', 'employment_relation_type_desc',
        'active_type_nm'))
    src = pg.run(f'select {cols} from usr_cross_data.hr_executive_proteus').to_dict('records')
    ev = master(src, cal.grid_start, cal.lm, int(cal.mo) == 1)
    tab = pg.run('select node_rk, report_month, trf_kind, paint_cd, it_cd, staff_cd, act_cd, fu, fa, fp, fi, fs, in_ok, '
                 'x_paint_cd, x_it_cd, x_staff_cd, x_act_cd, trf_cnt from teampulse_hub_trf')
    nn = lambda x: None if x is None or x != x else x
    got = Counter({tuple(nn(x) for x in r[:-1]): int(r[-1]) for r in tab.itertuples(index=False, name=None)})
    bad = (ev - got) + (got - ev)
    print(f'таблица: строк {len(got)}, событий {sum(got.values())}; мастер-отчёт на Python: строк {len(ev)}, '
          f'событий {sum(ev.values())}; расхождений {len(bad)}')
    for k in list(bad)[:10]:
        print('  ', k, 'мастер', ev.get(k, 0), 'таблица', got.get(k, 0))
    db = os.path.join(out, 'db')
    ms = nb.months()
    ok = not bad
    for name, flt in [('по умолчанию (Активная)', {}), ('вся численность', {'act_f': ['Вся']}),
                      ('Активная + Подрядчики', {'act_f': ['Активная', 'Подрядчики']}), ('только Подрядчики', {'act_f': ['Подрядчики']}),
                      ('Активная + Декрет', {'act_f': ['Активная', 'Декрет']}),
                      ('IT + штат', {'it_f': ['IT'], 'staff_f': ['Штат']}), ('покраска Hq', {'paint_f': ['Hq']}),
                      ('вся + Digital', {'act_f': ['Вся'], 'it_f': ['Digital']}),
                      ('Line + Support, Не штат', {'paint_f': ['Line', 'Support'], 'staff_f': ['Не штат']}),
                      ('IT + Digital, Штат + Не штат', {'it_f': ['IT', 'Digital'], 'staff_f': ['Штат', 'Не штат']})]:
        T = expect(ev, flt)
        dataset.SQL = F2A
        s = session.Session(db)
        _, rows = dataset.query(s, dataset.render(flt).strip().rstrip(';'))
        s.close()
        miss, nodes = 0, 0
        for r in rows:
            if r['role'] not in ('scope', 'base', 'c', 'g', 'x'):
                continue
            nodes += 1
            # поставка 64: din / dout — переводы узла «напрямую в юните» (юнит:d)
            for k, n, tk in (('tin', r['id'], 'tin'), ('tout', r['id'], 'tout'), ('hit', r['id'], 'hit'),
                             ('din', r['id'] + ':d', 'tin'), ('dout', r['id'] + ':d', 'tout')):
                a = [round(float(x), 1) for x in r['m_' + k].split(',')]
                e = [float(T.get((n, m), {}).get(tk, 0)) for m in ms]
                if a != e:
                    miss += 1
                    if miss <= 3:
                        print(f'    {name}: узел {r["id"]} {k}: датасет {a} мастер {e}')
        ok &= miss == 0
        print(f'датасет, {name:26}: узлов {nodes}, расхождений {miss}')
    print('ИТОГ:', 'переводы = мастер-отчёт' if ok else 'ЕСТЬ РАСХОЖДЕНИЯ')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()

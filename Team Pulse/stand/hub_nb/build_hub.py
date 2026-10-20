# =============================================================================
# Блок 4 — таблицы TeamPulse Hub: всё, что отчёту нужно, считается здесь.
#   teampulse_hub_meta    1 строка: последний месяц (и текущий незакрытый), дата данных, сетка, корень, юнит по умолчанию
#   teampulse_hub_unit    узлы нынешней структуры (по ключам юнитов): родитель, уровень, имя,
#                         число подразделений, путь ключами от корня, логин руководителя
#   teampulse_hub_series  узел × месяц × срез (покраска, IT, штат, тип численности): численность, активная, ССЧ,
#                         найм (как в методологии DD: найм в компанию + перевод из учебной группы
#                         в боевую + перевод стажёров в штат), увольнения, regret, переводы через
#                         границу узла, мониторинг, посещаемость, T-рост. Узел несёт всё своё
#                         поддерево
#   teampulse_hub_mix     узел × срез (с типом численности) × разрез × значение: численность последнего
#                         месяца по атрибутам и увольнения с начала года по причинам и др.
# Виртуальный датасет отчёта не кешируется и на каждый запрос только выбирает узлы ответа:
# дерево, история в нынешней структуре, ССЧ, переводы и разрезы готовы здесь.
# Источник — таблица человек × месяц × юнит (build_all_metrics + перформанс, посещаемость,
# T-рост), до group_and_sum_metrics: разрезы и переводы считаются по людям.
# =============================================================================
from dal_client import query as dal

HUB_ALL = 'all'          # ключ общего корня, если корней в структуре несколько
# Где брать логин руководителя юнита (19.10: под именем юнита в окне настройки и поиск по нему,
# как в HRBP HUB): первая таблица, где есть все колонки, — источник TP 2.0, иначе структура
# сотрудников (её берёт HRBP HUB). Нет ни одной — логин пустой, отчёт работает.
HUB_HEAD_SRC = [('usr_cross_data.hr_executive_proteus', 'calendar_dt'),
                ('prod_v_emart.mdm_employee_structure_d', 'business_dt')]
HUB_HEAD_COLS = {'mdm_employee_rk', 'management_head_flg', 'ad_login', 'management_head_ad_login'}


def _hub_q(sql: str):
    return dal.get_df(datasource='gp', query=sql)


def _hub_clean(col: str) -> str:
    """значение разреза: «-» и NULL — пустая строка, табы, переводы строк и «|» — пробелы и «/»
    (разделители ответа датасета)"""
    return f"coalesce(nullif(translate({col}::text, E'\\t\\n|', '  /'), '-'), '')"


def _hub_head_src():
    for t, d in HUB_HEAD_SRC:
        try:
            if HUB_HEAD_COLS | {d} <= _source_cols(t):
                return t, d
        except Exception:
            continue
    return None, None


def build_hub(
    source: str = 'all_metrics_with_performance_and_office_traffic_and_grt',
    prefix: str = 'teampulse_hub',
    n_levels: int = 11,
    staff_value: str = 'Штатный сотрудник',
    debug: bool = False,
):
    src, p = _qualified(source), _ident(prefix)
    cols = _source_cols(src)
    has = lambda c: c in cols
    lv = [i for i in range(1, n_levels + 1) if has(f'lvl{i}_rk') and has(f'lvl{i}_nm')]
    if not lv:
        raise ValueError('нет lvlN_rk: build_all_metrics должен выводить ключи уровней')
    rk_arr = 'ARRAY[' + ', '.join(f's.lvl{i}_rk::text' for i in lv) + ']'
    nm_arr = 'ARRAY[' + ', '.join(f's.lvl{i}_nm::text' for i in lv) + ']'
    path_rk = f"array_to_string(({rk_arr})[1:s.leaf_lvl], '|')"
    cut = lambda c, alias: f"coalesce(nullif(s.{c}::text, ''), '-') AS {alias}" if has(c) else f"'-'::text AS {alias}"
    num = lambda c: f'coalesce(e.{c}, 0)' if has(c) else '0'
    snum = lambda c: f'coalesce(s.{c}, 0)' if has(c) else '0'
    dist = lambda key: f'distributed by ({key})'
    steps = []

    # 1. последний месяц — последний в источнике, и текущий незакрытый тоже (20.10, заказчик: «показывать
    #    текущий месяц, как в HRBP HUB»); dt — дата данных: последний день этого месяца в дневном источнике
    #    руководителей (hr_executive_proteus), нет его — вчера, но не позже конца месяца
    hsrc, hdt = (None, None) if debug else _hub_head_src()
    dt_q = (f"(select max(x.{hdt})::date from {_qualified(hsrc)} x "
            f"where x.{hdt} >= c.lm and x.{hdt} < (c.lm + interval '1 month'))") if hsrc else 'null::date'
    steps.append(f"""
drop table if exists {p}_cal;
create table {p}_cal as
select c.lm, coalesce({dt_q}, least(current_date - 1, (c.lm + interval '1 month' - interval '1 day')::date)) as dt
from (select max(report_month)::date as lm from {src}) c
{dist('lm')}""")

    # 2. путь каждого юнита в последнем месяце (два пути — меньший)
    steps.append(f"""
drop table if exists {p}_upath;
create table {p}_upath as
select s.mng_unit_rk::text as unit_rk, min({path_rk}) as cp
from {src} s
where s.report_month = (select lm from {p}_cal) and s.leaf_lvl > 0
group by 1
{dist('unit_rk')}""")

    # 3. узлы — все начала путей: и юниты со своими людьми, и уровни над ними без своих строк
    steps.append(f"""
drop table if exists {p}_node;
create table {p}_node as
select rk, min(nm) as nm, min(lv) as lv, min(prk) as prk, min(pth) as pth
from (
    select x.rk, x.nm, x.lv,
           case when x.lv = 1 then '' else x.ra[x.lv - 1] end as prk,
           array_to_string(x.ra[1:x.lv], '|') as pth
    from (
        select unnest(r.ra) as rk, unnest(r.na) as nm, generate_subscripts(r.ra, 1) as lv, r.ra
        from (
            select distinct ({rk_arr})[1:s.leaf_lvl] as ra, ({nm_arr})[1:s.leaf_lvl] as na
            from {src} s
            join {p}_upath u on u.unit_rk = s.mng_unit_rk::text and u.cp = {path_rk}
            where s.report_month = (select lm from {p}_cal) and s.leaf_lvl > 0
        ) r
    ) x
    where x.rk <> '-'
) n
group by rk
{dist('rk')}""")

    for sql in steps:
        if debug:
            print(sql)
        else:
            _hub_q(sql)
    steps = []

    # несколько корней — общий корень над ними: «вся компания» — сумма всех строк
    roots = 0 if debug else int(_hub_q(f"select count(*) as n from {p}_node where prk = ''")['n'].iloc[0])
    multi = roots > 1
    pre = f"'{HUB_ALL}|' || " if multi else ''
    if multi:
        steps.append(f"""
update {p}_node set prk = '{HUB_ALL}' where prk = '';
update {p}_node set pth = '{HUB_ALL}|' || pth, lv = lv + 1;
insert into {p}_node (rk, nm, lv, prk, pth) values ('{HUB_ALL}', 'Все юниты', 1, '', '{HUB_ALL}')""")

    # 4. руководитель юнита на конец последнего месяца (на дату данных) — голосами, как в HRBP HUB:
    #    3 — сам руководитель (management_head_flg = 1) в юните → его ad_login; 2 — люди юнита →
    #    их management_head_ad_login; 1 — руководители подразделений → их management_head_ad_login
    #    (у юнита без своих людей). Старший голос, внутри — самый частый логин, при равенстве —
    #    меньший. Человек — в юните строки конца месяца (численность > 0), источник логинов —
    #    по mdm_employee_rk на последнюю дату месяца
    if hsrc and has('mdm_employee_rk'):
        hh = f"""(
        select e.mdm_employee_rk as erk, max(coalesce(e.management_head_flg::text, '0'))::int as is_head,
               max(nullif(lower(trim(e.ad_login::text)), '')) as login,
               max(nullif(lower(trim(e.management_head_ad_login::text)), '')) as head_login
        from {_qualified(hsrc)} e
        where e.{hdt} = (select max(x.{hdt}) from {_qualified(hsrc)} x
                         where x.{hdt} >= (select lm from {p}_cal)
                           and x.{hdt} < ((select lm from {p}_cal) + interval '1 month'))
        group by 1)"""
        steps.append(f"""
drop table if exists {p}_head;
create table {p}_head as
select distinct on (unit_rk) unit_rk, head_login
from (
    select v.unit_rk, v.head_login, max(v.w) as w, count(*) as n
    from (
        select s.mng_unit_rk::text as unit_rk,
               case when h.is_head = 1 then h.login else h.head_login end as head_login,
               case when h.is_head = 1 then 3 else 2 end as w
        from {src} s
        join {hh} h on h.erk = s.mdm_employee_rk
        where s.report_month = (select lm from {p}_cal) and s.leaf_lvl > 0 and {snum('hc_total_cnt')} > 0
        union all
        select n.prk, h.head_login, 1
        from {src} s
        join {hh} h on h.erk = s.mdm_employee_rk
        join {p}_node n on n.rk = s.mng_unit_rk::text
        where s.report_month = (select lm from {p}_cal) and s.leaf_lvl > 0 and {snum('hc_total_cnt')} > 0
          and h.is_head = 1 and n.prk <> ''
    ) v
    where v.head_login is not null and v.unit_rk is not null
    group by v.unit_rk, v.head_login
) t
order by unit_rk, w desc, n desc, head_login
{dist('unit_rk')}""")
    else:
        steps.append(f"""
drop table if exists {p}_head;
create table {p}_head as select ''::text as unit_rk, ''::text as head_login where false
{dist('unit_rk')}""")

    # 5. справочник узлов: + число подразделений и логин руководителя
    steps.append(f"""
drop table if exists {p}_unit;
create table {p}_unit as
select n.rk as unit_rk, n.prk as parent_rk, n.lv as unit_lvl, n.nm as unit_nm,
       coalesce(k.kids, 0)::int as kids_cnt, n.pth as path_rk, coalesce(h.head_login, '') as head_login
from {p}_node n
left join (select prk, count(*) as kids from {p}_node where prk <> '' group by prk) k on k.prk = n.rk
left join {p}_head h on h.unit_rk = n.rk
{dist('unit_rk')}""")

    # 6. строки источника → узлы нынешней структуры. История — по пути юнита в последнем
    #    месяце (переехал — прошлое едет с ним); юнита нет — по своему пути.
    #    Перевод входит в узел глубины d, если сменился уровень ≤ d (через границу узла)
    # тип численности (20.10): «Активная» — тип активности строки на конец месяца (по флагу
    # источника, FIXED_DIMS), остальные — «Прочие». Отчёт по умолчанию — только «Активная»
    act_c = ("case when s.active_type_gr_nm = 'Активная' then 'Активная' else 'Прочие' end"
             if has('active_type_gr_nm') else "'Активная'::text")
    expl = f"""
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - {1 if multi else 0} as d
    from (
        select s.*, {pre}coalesce(u.cp, {path_rk}) as cp,
               {cut('paint_cd', 'paint_c')}, {cut('emp_specialization_it_code', 'it_c')},
               case when s.employment_relation_type = '{staff_value}' then 'Штат' else 'Не штат' end as staff_c,
               {act_c} as act_c
        from {src} s
        left join {p}_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 {{where}}
    ) x"""
    steps.append(f"""
drop table if exists {p}_sx;
create table {p}_sx as
select node_rk, report_month::date as report_month, paint_c, it_c, staff_c, act_c,
       sum({num('hc_total_cnt')}) as hc, sum({num('hc_active_cnt')}) as act,
       -- найм по методологии DD: найм в компанию + перевод из учебной группы в боевую + стажёров в
       -- штат; одно событие на человека в строке: тип активности в источнике — на конец месяца,
       -- и стажёр, принятый и переведённый в одном месяце, иначе попал бы и в найм, и в перевод
       sum(greatest({num('hire_amt')}, {num('transfer_candidate_amt')}, {num('transfer_internal_amt')})) as hire,
       -- найм в компанию с любым типом активности — найм «всей численности» (методология: по
       -- юридической численности найм — только событие «Найм в компанию»)
       sum({num('hire_cnt') if has('hire_cnt') else num('hire_amt')}) as hco,
       sum({num('fire_amt')}) as fire, sum({num('regret_fire_amt')}) as reg,
       sum(case when {num('transfer_in_lvl')} between 1 and d then {num('transfer_in_amt')} else 0 end) as tin,
       sum(case when {num('transfer_out_lvl')} between 1 and d then {num('transfer_out_amt')} else 0 end) as tout,
       sum({num('perf_normal')}) as pnor, sum({num('perf_low')}) as plow,
       sum({num('perf_high')}) as phig, sum({num('perf_gray')}) as pgry,
       sum({num('work_day_amt')}) as wday, sum({num('office_visit_amt')}) as ovis,
       sum({num('grt_approve_cnt')}) as gapr, sum({num('grt_decline_cnt')}) as gdec
from ({expl.replace('{where}', '')}) e
group by 1, 2, 3, 4, 5, 6
{dist('node_rk')}""")

    # 7. ССЧ = (численность месяца + прошлого) / 2 по узлу и срезу: строка и там, где людей
    #    среза в узле в этом месяце уже нет, а в прошлом были. Первый месяц — без лага. В строках
    #    «Активная» это ССЧ активной (методология: упрощённый способ), сумма по обоим типам —
    #    ССЧ всей численности
    on = lambda a, b: ' and '.join(f'{a}.{c} = {b}.{c}' for c in ('node_rk', 'paint_c', 'it_c', 'staff_c', 'act_c'))
    steps.append(f"""
drop table if exists {p}_series;
create table {p}_series as
with k as (
    select node_rk, report_month, paint_c, it_c, staff_c, act_c from {p}_sx
    union
    select node_rk, (report_month + interval '1 month')::date, paint_c, it_c, staff_c, act_c from {p}_sx
    where report_month < (select max(report_month) from {p}_sx)
)
select k.node_rk, k.report_month, k.paint_c as paint_cd, k.it_c as it_cd, k.staff_c as staff_cd,
       k.act_c as act_cd,
       coalesce(c.hc, 0) as hc_cnt, coalesce(c.act, 0) as act_cnt,
       (coalesce(c.hc, 0) + case when k.report_month = (select min(report_month) from {p}_sx)
                                 then coalesce(c.hc, 0) else coalesce(pv.hc, 0) end) / 2.0 as avg_cnt,
       coalesce(c.hire, 0) as hire_cnt, coalesce(c.hco, 0) as hco_cnt,
       coalesce(c.fire, 0) as fire_cnt, coalesce(c.reg, 0) as reg_cnt,
       coalesce(c.tin, 0) as tin_cnt, coalesce(c.tout, 0) as tout_cnt,
       coalesce(c.pnor, 0) as pnor_cnt, coalesce(c.plow, 0) as plow_cnt,
       coalesce(c.phig, 0) as phig_cnt, coalesce(c.pgry, 0) as pgry_cnt,
       coalesce(c.wday, 0) as wday_amt, coalesce(c.ovis, 0) as ovis_amt,
       coalesce(c.gapr, 0) as gapr_cnt, coalesce(c.gdec, 0) as gdec_cnt
from k
left join {p}_sx c on {on('c', 'k')} and c.report_month = k.report_month
left join {p}_sx pv on {on('pv', 'k')} and pv.report_month = (k.report_month - interval '1 month')::date
{dist('node_rk')}""")

    # 8. разрезы: численность последнего месяца по атрибутам (g a t gr s c o w r) и
    #    увольнения с начала его года (xr причина, xq regret по причине, xi инициатива,
    #    xp причина|инициатива, xt стаж, xg грейд, xs стрим). Пустое значение — ''
    a = {k: _hub_clean(f'e.{c}') if has(c) else "''" for k, c in (
        ('g', 'gender'), ('a', 'type_age'), ('t', 'experience_group_nm'), ('gr', 'grade'), ('s', 'seniority'),
        ('c', 'employee_contract_type'), ('o', 'legal_organization'), ('w', 'employee_stream'),
        ('r', 'employment_relation_type'), ('fr', 'fire_reason_group'), ('fi', 'fire_initiative'))}
    hc_keys = ['g', 'a', 't', 'gr', 's', 'c', 'o', 'w', 'r']
    steps.append(f"""
drop table if exists {p}_mix;
create table {p}_mix as
select node_rk, paint_c as paint_cd, it_c as it_cd, staff_c as staff_cd, act_c as act_cd,
       mx_key, mx_val, sum(mx_n) as mx_n
from (
    select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
           unnest(ARRAY[{', '.join(f"'{k}'" for k in hc_keys)}]) as mx_key,
           unnest(ARRAY[{', '.join(a[k] for k in hc_keys)}]) as mx_val,
           {num('hc_total_cnt')} as mx_n
    from ({expl.replace('{where}', 'and s.report_month = (select lm from ' + p + '_cal)')}) e
    where {num('hc_total_cnt')} > 0
    union all
    select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
           unnest(ARRAY['xr', 'xq', 'xi', 'xp', 'xt', 'xg', 'xs']) as mx_key,
           unnest(ARRAY[{a['fr']}, {a['fr']}, {a['fi']}, {a['fr']} || '|' || {a['fi']}, {a['t']}, {a['gr']}, {a['w']}]) as mx_val,
           unnest(ARRAY[{', '.join([num('fire_amt'), num('regret_fire_amt')] + [num('fire_amt')] * 5)}]) as mx_n
    from ({expl.replace('{where}', "and s.report_month between date_trunc('year', (select lm from " + p + "_cal))::date and (select lm from " + p + "_cal)")}) e
    where {num('fire_amt')} > 0
) kv
group by 1, 2, 3, 4, 5, 6, 7
having sum(mx_n) > 0
{dist('node_rk')}""")

    # 9. календарь отчёта, корень и юнит по умолчанию (у корня один ребёнок — он)
    steps.append(f"""
drop table if exists {p}_meta;
create table {p}_meta as
select c.lm as last_month,
       c.dt as data_dt,
       (date_trunc('year', c.lm) - interval '1 year')::date as grid_start,
       (12 + date_part('month', c.lm))::int as n_months,
       12 as ytd_idx,
       r.unit_rk as root_rk,
       case when r.kids_cnt = 1 then (select unit_rk from {p}_unit where parent_rk = r.unit_rk) else r.unit_rk end as def_rk,
       now() as built_at,
       'hub-2' as schema_ver
from {p}_cal c
cross join (select unit_rk, kids_cnt from {p}_unit where parent_rk = '' order by unit_rk limit 1) r
{dist('last_month')}""")

    steps.append(f"drop table if exists {p}_sx; drop table if exists {p}_node; drop table if exists {p}_head")

    for sql in steps:
        if debug:
            print(sql)
        else:
            _hub_q(sql)
    if debug:
        return
    for t in ('meta', 'unit', 'series', 'mix'):
        n = _hub_q(f'select count(*) as n from {p}_{t}')['n'].iloc[0]
        print(f'[OK] {p}_{t}: {n} строк')
    if multi:
        print(f'[INFO] корней {roots} — общий корень «{HUB_ALL}»')

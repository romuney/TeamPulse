# =============================================================================
# Блок 4 — таблицы TeamPulse Hub: всё, что отчёту нужно, считается здесь.
#   teampulse_hub_meta    1 строка: последний закрытый месяц, сетка, корень, юнит по умолчанию
#   teampulse_hub_unit    узлы нынешней структуры (по ключам юнитов): родитель, уровень, имя,
#                         число подразделений, путь ключами от корня
#   teampulse_hub_series  узел × месяц × срез (покраска, IT, штат): численность, активная, ССЧ,
#                         найм, увольнения, regret, переводы через границу узла, мониторинг,
#                         посещаемость, T-рост. Узел несёт всё своё поддерево
#   teampulse_hub_mix     узел × срез × разрез × значение: численность последнего закрытого
#                         месяца по атрибутам и увольнения с начала года по причинам и др.
# Виртуальный датасет отчёта не кешируется и на каждый запрос только выбирает узлы ответа:
# дерево, история в нынешней структуре, ССЧ, переводы и разрезы готовы здесь.
# Источник — таблица человек × месяц × юнит (build_all_metrics + перформанс, посещаемость,
# T-рост), до group_and_sum_metrics: разрезы и переводы считаются по людям.
# =============================================================================
from dal_client import query as dal

HUB_ALL = 'all'          # ключ общего корня, если корней в структуре несколько


def _hub_q(sql: str):
    return dal.get_df(datasource='gp', query=sql)


def _hub_clean(col: str) -> str:
    """значение разреза: «-» и NULL — пустая строка, табы, переводы строк и «|» — пробелы и «/»
    (разделители ответа датасета)"""
    return f"coalesce(nullif(translate({col}::text, E'\\t\\n|', '  /'), '-'), '')"


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
    dist = lambda key: f'distributed by ({key})'
    steps = []

    # 1. последний закрытый месяц: если в источнике есть строки текущего месяца — прошлый
    steps.append(f"""
drop table if exists {p}_cal;
create table {p}_cal as
select case when max(report_month) >= date_trunc('month', current_date)::date
            then (date_trunc('month', max(report_month)) - interval '1 month')::date
            else max(report_month)::date end as lm
from {src}
{dist('lm')}""")

    # 2. путь каждого юнита в последнем закрытом месяце (два пути — меньший)
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

    # 4. справочник узлов: + число подразделений
    steps.append(f"""
drop table if exists {p}_unit;
create table {p}_unit as
select n.rk as unit_rk, n.prk as parent_rk, n.lv as unit_lvl, n.nm as unit_nm,
       coalesce(k.kids, 0)::int as kids_cnt, n.pth as path_rk
from {p}_node n
left join (select prk, count(*) as kids from {p}_node where prk <> '' group by prk) k on k.prk = n.rk
{dist('unit_rk')}""")

    # 5. строки источника → узлы нынешней структуры. История — по пути юнита в последнем
    #    закрытом месяце (переехал — прошлое едет с ним); юнита нет — по своему пути.
    #    Перевод входит в узел глубины d, если сменился уровень ≤ d (через границу узла)
    expl = f"""
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - {1 if multi else 0} as d
    from (
        select s.*, {pre}coalesce(u.cp, {path_rk}) as cp,
               {cut('paint_cd', 'paint_c')}, {cut('emp_specialization_it_code', 'it_c')},
               case when s.employment_relation_type = '{staff_value}' then 'Штат' else 'Не штат' end as staff_c
        from {src} s
        left join {p}_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 {{where}}
    ) x"""
    steps.append(f"""
drop table if exists {p}_sx;
create table {p}_sx as
select node_rk, report_month::date as report_month, paint_c, it_c, staff_c,
       sum({num('hc_total_cnt')}) as hc, sum({num('hc_active_cnt')}) as act,
       sum({num('hire_amt')}) as hire, sum({num('fire_amt')}) as fire, sum({num('regret_fire_amt')}) as reg,
       sum(case when {num('transfer_in_lvl')} between 1 and d then {num('transfer_in_amt')} else 0 end) as tin,
       sum(case when {num('transfer_out_lvl')} between 1 and d then {num('transfer_out_amt')} else 0 end) as tout,
       sum({num('perf_normal')}) as pnor, sum({num('perf_low')}) as plow,
       sum({num('perf_high')}) as phig, sum({num('perf_gray')}) as pgry,
       sum({num('work_day_amt')}) as wday, sum({num('office_visit_amt')}) as ovis,
       sum({num('grt_approve_cnt')}) as gapr, sum({num('grt_decline_cnt')}) as gdec
from ({expl.replace('{where}', '')}) e
group by 1, 2, 3, 4, 5
{dist('node_rk')}""")

    # 6. ССЧ активной = (активная месяца + прошлого) / 2 по узлу и срезу: строка и там, где
    #    людей среза в узле в этом месяце уже нет, а в прошлом были. Первый месяц — без лага
    on = lambda a, b: ' and '.join(f'{a}.{c} = {b}.{c}' for c in ('node_rk', 'paint_c', 'it_c', 'staff_c'))
    steps.append(f"""
drop table if exists {p}_series;
create table {p}_series as
with k as (
    select node_rk, report_month, paint_c, it_c, staff_c from {p}_sx
    union
    select node_rk, (report_month + interval '1 month')::date, paint_c, it_c, staff_c from {p}_sx
    where report_month < (select max(report_month) from {p}_sx)
)
select k.node_rk, k.report_month, k.paint_c as paint_cd, k.it_c as it_cd, k.staff_c as staff_cd,
       coalesce(c.hc, 0) as hc_cnt, coalesce(c.act, 0) as act_cnt,
       (coalesce(c.act, 0) + case when k.report_month = (select min(report_month) from {p}_sx)
                                  then coalesce(c.act, 0) else coalesce(pv.act, 0) end) / 2.0 as avg_cnt,
       coalesce(c.hire, 0) as hire_cnt, coalesce(c.fire, 0) as fire_cnt, coalesce(c.reg, 0) as reg_cnt,
       coalesce(c.tin, 0) as tin_cnt, coalesce(c.tout, 0) as tout_cnt,
       coalesce(c.pnor, 0) as pnor_cnt, coalesce(c.plow, 0) as plow_cnt,
       coalesce(c.phig, 0) as phig_cnt, coalesce(c.pgry, 0) as pgry_cnt,
       coalesce(c.wday, 0) as wday_amt, coalesce(c.ovis, 0) as ovis_amt,
       coalesce(c.gapr, 0) as gapr_cnt, coalesce(c.gdec, 0) as gdec_cnt
from k
left join {p}_sx c on {on('c', 'k')} and c.report_month = k.report_month
left join {p}_sx pv on {on('pv', 'k')} and pv.report_month = (k.report_month - interval '1 month')::date
{dist('node_rk')}""")

    # 7. разрезы: численность последнего закрытого месяца по атрибутам (g a t gr s c o w r) и
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
select node_rk, paint_c as paint_cd, it_c as it_cd, staff_c as staff_cd,
       mx_key, mx_val, sum(mx_n) as mx_n
from (
    select e.node_rk, e.paint_c, e.it_c, e.staff_c,
           unnest(ARRAY[{', '.join(f"'{k}'" for k in hc_keys)}]) as mx_key,
           unnest(ARRAY[{', '.join(a[k] for k in hc_keys)}]) as mx_val,
           {num('hc_total_cnt')} as mx_n
    from ({expl.replace('{where}', 'and s.report_month = (select lm from ' + p + '_cal)')}) e
    where {num('hc_total_cnt')} > 0
    union all
    select e.node_rk, e.paint_c, e.it_c, e.staff_c,
           unnest(ARRAY['xr', 'xq', 'xi', 'xp', 'xt', 'xg', 'xs']) as mx_key,
           unnest(ARRAY[{a['fr']}, {a['fr']}, {a['fi']}, {a['fr']} || '|' || {a['fi']}, {a['t']}, {a['gr']}, {a['w']}]) as mx_val,
           unnest(ARRAY[{', '.join([num('fire_amt'), num('regret_fire_amt')] + [num('fire_amt')] * 5)}]) as mx_n
    from ({expl.replace('{where}', "and s.report_month between date_trunc('year', (select lm from " + p + "_cal))::date and (select lm from " + p + "_cal)")}) e
    where {num('fire_amt')} > 0
) kv
group by 1, 2, 3, 4, 5, 6
having sum(mx_n) > 0
{dist('node_rk')}""")

    # 8. календарь отчёта, корень и юнит по умолчанию (у корня один ребёнок — он)
    steps.append(f"""
drop table if exists {p}_meta;
create table {p}_meta as
select c.lm as last_month,
       (date_trunc('year', c.lm) - interval '1 year')::date as grid_start,
       (12 + date_part('month', c.lm))::int as n_months,
       12 as ytd_idx,
       r.unit_rk as root_rk,
       case when r.kids_cnt = 1 then (select unit_rk from {p}_unit where parent_rk = r.unit_rk) else r.unit_rk end as def_rk,
       now() as built_at,
       'hub-1' as schema_ver
from {p}_cal c
cross join (select unit_rk, kids_cnt from {p}_unit where parent_rk = '' order by unit_rk limit 1) r
{dist('last_month')}""")

    steps.append(f"drop table if exists {p}_sx; drop table if exists {p}_node")

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

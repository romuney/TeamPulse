# SQL-параграфы сборки таблиц TeamPulse Hub (поставка 58, 22.10): build_hub без Python.
# Было: Python-параграф build_hub отправлял в GP больше ста запросов подряд (каждый месяц — свой запрос) и ждал
# ответа на каждый; данные в Python не приходили, но параграф ждал все шаги разом и падал по таймауту.
# Стало: параграфы gp — каждый шаг сборки виден и ограничен по времени. Логика и таблицы — те же, что у
# Python-версии (stand/hub_nb/build_hub.py до поставки 58 — в истории git; стенд сверил построчно, вместе с
# типами колонок), а тяжёлые шаги — за один проход вместо помесячных частей:
#   ряды и разрезы    — по узкому набору колонок источника людей: один запрос на все месяцы (у build_hub
#                       подзапрос нёс все ~80 колонок источника через развёртку по узлам — отсюда
#                       «workfile per query size limit exceeded» и части по месяцам);
#   переходы          — дневной источник читается один раз (у build_hub — 22 раза, по месяцу), окно
#                       месяца сохранено: «вчера» — только последний день прошлого месяца и дни этого.
# Даты в SQL — не литералами: последний месяц и дата данных лежат в teampulse_hub_cal, отсечение
# партиций дневного источника — по current_date (стабильная функция, GP отсекает по ней партиции).
# Колонки источников — постоянные (как в бою); параграф «hub · 0 колонки» проверяет их до сборки.
# Необязательные источники (логины руководителей, AI) — в Python-параграфе hub_optional.py: там сначала
# проверка, есть ли источник, — SQL так не умеет.
#
#   python3 stand/hub_sql.py          # пересобрать stand/hub_nb/sql_*.sql (потом stand/mk_hub_yaml.py)
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'hub_nb')

P = 'teampulse_hub'
SRC = 'all_metrics_with_performance_and_office_traffic_and_grt'
DAY = 'usr_cross_data.hr_executive_proteus'
VAC_SRC = 'usr_cross_data.vacancy_daily'
VAC = 'structure_x_vacancy'
STRUCT = 'org_structure'
HUB_ALL = 'all'
STAFF = 'Штатный сотрудник'
VAC_OK_GROUP = 'Согласованные'
LV = list(range(1, 12))          # уровни источника людей (build_all_metrics, n_levels=11)
DLV_FLG = list(range(1, 13))     # флаги переводов юнита в дневном источнике — все 12 уровней
NV = 11                          # уровни вакансий (resource_level_N_rk)

dist = lambda key: f'distributed by ({key})'


def head(title, *lines):
    bar = '-- ' + '=' * 77
    return '\n'.join([bar, f'-- TeamPulse Hub · {title}'] + [f'-- {x}' if x else '--' for x in lines] + [bar])


def wrap(items, ind, sep=', ', width=110):
    """список через sep с переносом: строка длиннее width — с новой строки с отступом ind"""
    lines, cur = [], ''
    for it in items:
        if cur and len(ind + cur + sep + it) > width:
            lines.append(cur + sep.rstrip())
            cur = it
        else:
            cur = it if not cur else cur + sep + it
    lines.append(cur)
    return ('\n' + ind).join(lines)


def clean(col):
    """значение разреза: «-» и NULL — пустая строка, табы, переводы строк и «|» — пробелы и «/»"""
    return f"coalesce(nullif(translate({col}::text, E'\\t\\n|', '  /'), '-'), '')"


# ---- колонки источников: SQL ниже написан под них ---------------------------------------------
SRC_COLS = (['report_month', 'mng_unit_rk', 'leaf_lvl'] + [f'lvl{i}_rk' for i in LV] + [f'lvl{i}_nm' for i in LV]
            + ['paint_cd', 'emp_specialization_it_code', 'employment_relation_type', 'active_type_gr_nm',
               'hc_total_cnt', 'hc_active_cnt', 'hire_amt', 'hire_cnt', 'transfer_candidate_amt', 'transfer_internal_amt',
               'fire_amt', 'regret_fire_amt', 'non_regret_fire_amt', 'transfer_in_amt', 'transfer_in_lvl',
               'transfer_out_amt', 'transfer_out_lvl', 'perf_normal', 'perf_low', 'perf_high', 'perf_gray',
               'work_day_amt', 'office_visit_amt', 'grt_approve_cnt', 'grt_decline_cnt',
               'gender', 'type_age', 'experience_group_nm', 'grade', 'seniority', 'employee_contract_type',
               'legal_organization', 'employee_stream', 'fire_reason_group', 'fire_initiative', 'specialization',
               'type_company', 'source_type_nm'])
TYPES = ('hq', 'it', 'employment_relation_type', 'active_type')
DAY_COLS = (['calendar_dt', 'mdm_employee_rk'] + [f'lvl{i}_mapped_management_unit_rk' for i in LV]
            + ['emp_specialization_oper_code', 'emp_specialization_it_code', 'employment_relation_type_desc',
               'active_count_flg', 'hire_flg', 'transfer_candidate_flg', 'transfer_internal_flg', 'fire_flg']
            + [f'lvl{i}_mngt_unit_{k}_trsf_flg' for i in DLV_FLG for k in ('in', 'out')]
            + [f'transfer_{d}_{t}_flg' for t in TYPES for d in ('to', 'out')])
VAC_COLS = (['issue_full_nm', 'issue_day', 'approved_dt', 'close_flg', 'end_of_month_flg', 'last_dt_flg', 'status_name',
             'status_name_chng_group', 'search_reason', 'mapping_channel_name', 'finalist_level_candy',
             'lvl_position_adj', 'specialization'] + [f'resource_level_{i}_rk' for i in range(1, NV + 1)])


def sql_cols():
    need = ([('', SRC, c) for c in SRC_COLS] + [('', STRUCT, c) for c in ('report_month', 'mng_unit_rk')]
            + [tuple(DAY.split('.')) + (c,) for c in DAY_COLS] + [tuple(VAC_SRC.split('.')) + (c,) for c in VAC_COLS])
    vals = ',\n'.join(f"        ('{s}', '{t}', '{c}')" for s, t, c in need)
    tabs = ', '.join(f"'{t}'" for t in dict.fromkeys(t for _, t, _ in need))
    return f"""{head('0. Колонки источников (поставка 58)',
               'SQL-параграфы сборки написаны под колонки источников (как в бою). Нет колонки или доступа к',
               'таблице — ошибка здесь, со списком того, чего нет, а не посреди сборки. Всё на месте — строка',
               '«колонки на месте». Пустое имя схемы — таблица этого ноутбука (схема по умолчанию).')}
with need (sch, tbl, col) as (
    values
{vals}
),
have as (
    select table_schema as sch, table_name as tbl, column_name as col
    from information_schema.columns
    where table_name in ({tabs})
)
select case when count(*) = 0 then 'колонки на месте'
            else ('НЕТ КОЛОНОК (параграф «hub · 0 колонки»): '
                  || string_agg(case when n.sch = '' then '' else n.sch || '.' end || n.tbl || '.' || n.col, ', '))::int::text
       end as result
from need n
left join have h
       on h.tbl = n.tbl and h.col = n.col
      and (h.sch = n.sch or (n.sch = '' and h.sch not in ('pg_catalog', 'information_schema')))
where h.col is null;
"""


# ---- снимок «структура × вакансии» (прежний vacancy.py, без Python) -----------------------------
def sql_vacancy_snapshot():
    rk = lambda i: f"nullif(nullif(vd.resource_level_{i}_rk::text, '-'), '')"
    lvs = range(1, NV + 1)
    leaf = 'case ' + wrap([f'when {rk(i)} is not null then {i}' for i in reversed(lvs)], ' ' * 16, sep=' ') + ' end'
    unit = 'case ' + wrap([f'when {rk(i)} is not null then {rk(i)}' for i in reversed(lvs)], ' ' * 16, sep=' ') + ' end'
    path = ("array_to_string((ARRAY[" + wrap([f"coalesce({rk(i)}, '-')" for i in lvs], ' ' * 16)
            + f"])[1:{leaf}], '|')")
    txt = lambda c, alias: f"coalesce(nullif(vd.{c}::text, ''), '-') as {alias}"
    flg = lambda c: f'coalesce(vd.{c}::int, 0)'
    return f"""{head('снимок «структура × вакансии» (structure_x_vacancy, поставка 58 — SQL вместо Python)',
               'Как в TP 2.0 (параграф vacancy_daily), но плоско: строка — юнит × месяц × разрезы вакансии, меры —',
               'числами. Основа — вакансии (не структура): вакансии юнитов без людей не теряются, in_structure = 0.',
               '  закрыто   close_flg = 1 (за месяц)',
               '  открыто   в работе на конец месяца: end_of_month_flg = 1 и статус из группы «Согласованные»;',
               '            у незакрытого месяца — на последний загруженный день',
               '  новые     issue_day = approved_dt — согласованы в этом месяце',
               '  срок      у закрытых: дней от согласования до закрытия (сумма и число)',
               'Узлы и путь — в «hub · 6» (teampulse_hub_vacancy).')}
drop table if exists {VAC};
create table {VAC} as
with mx as (select max(issue_day)::date as last_dt from {VAC_SRC}),
v as (
    select vd.issue_full_nm::text as vac, vd.issue_day::date as dd, date_trunc('month', vd.issue_day)::date as report_month,
           vd.approved_dt::date as adt, {flg('close_flg')} as cf,
           -- в работе на конец месяца; у незакрытого месяца — на последний загруженный день
           (({flg('end_of_month_flg')} = 1 or vd.issue_day::date = (select last_dt from mx))
            and vd.status_name_chng_group = '{VAC_OK_GROUP}')::int as of_,
           (vd.issue_day::date = vd.approved_dt::date)::int as nf,
           {leaf} as leaf_lvl,
           {unit} as mng_unit_rk,
           {path} as unit_path,
           {txt('mapping_channel_name', 'channel')},
           case when vd.search_reason ilike '%замена%' then 'Замена'
                when vd.search_reason ilike '%нов%' then 'Новый' else 'Прочее' end as search_reason,
           case when vd.finalist_level_candy ilike '%jun%' then 'Junior'
                when vd.finalist_level_candy ilike '%middl%' then 'Middle'
                when vd.finalist_level_candy ilike '%senior%' then 'Senior'
                when vd.finalist_level_candy is null then 'Other'
                else vd.finalist_level_candy::text end as cand_lvl,
           {txt('lvl_position_adj', 'position_lvl')}, {txt('specialization', 'specialization')},
           -- статус — снимок на последний день (last_dt_flg), только у вакансий в работе
           case when {flg('last_dt_flg')} = 1 and vd.status_name_chng_group = '{VAC_OK_GROUP}'
                then coalesce(nullif(vd.status_name::text, ''), '-') else '' end as status
    from {VAC_SRC} vd
    where ({flg('close_flg')} = 1 or {flg('end_of_month_flg')} = 1 or vd.issue_day::date = vd.approved_dt::date
           or vd.issue_day::date = (select last_dt from mx))
),
d as (
    select report_month, mng_unit_rk, leaf_lvl, unit_path, channel, search_reason, cand_lvl, position_lvl,
           specialization, status,
           count(distinct case when cf = 1 then vac end) as close_cnt,
           count(distinct case when of_ = 1 then vac end) as open_cnt,
           count(distinct case when nf = 1 then vac end) as new_cnt,
           coalesce(sum(case when cf = 1 and adt is not null then dd - adt end), 0) as ttf_days,
           count(distinct case when cf = 1 and adt is not null then vac end) as ttf_cnt
    from v
    where leaf_lvl is not null
    group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    having count(distinct case when cf = 1 then vac end) + count(distinct case when of_ = 1 then vac end)
         + count(distinct case when nf = 1 then vac end) > 0
)
select d.report_month, d.mng_unit_rk, d.leaf_lvl, d.unit_path,
       case when s.mng_unit_rk is null then 0 else 1 end as in_structure,
       d.channel, d.search_reason, d.cand_lvl, d.position_lvl, d.specialization, d.status,
       d.close_cnt, d.open_cnt, d.new_cnt, d.ttf_days, d.ttf_cnt
from d
left join (select distinct report_month::date as report_month, mng_unit_rk::text as mng_unit_rk
           from {STRUCT}) s
       on s.report_month = d.report_month and s.mng_unit_rk = d.mng_unit_rk
{dist('mng_unit_rk')};

-- итог: строк, открыто и закрыто (сумма по месяцам), из них в юнитах без людей
select count(*) as rows_cnt, coalesce(sum(open_cnt), 0) as open_sum, coalesce(sum(close_cnt), 0) as close_sum,
       coalesce(sum(case when in_structure = 0 then open_cnt + close_cnt end), 0) as in_units_without_people
from {VAC};
"""


# ---- выражения источника людей (как в Python-версии build_hub) -------------------------------------
path_rk = ("array_to_string((ARRAY[" + wrap([f's.lvl{i}_rk::text' for i in LV], ' ' * 38)
           + "])[1:s.leaf_lvl], '|')")
cut = lambda c, alias: f"coalesce(nullif(s.{c}::text, ''), '-') AS {alias}"
num = lambda c: f'coalesce(e.{c}, 0)'
act_c = "case when s.active_type_gr_nm = 'Активная' then 'Активная' else 'Прочие' end"
staff_c = f"case when s.employment_relation_type = '{STAFF}' then 'Штат' else 'Не штат' end"
PRE = f'(select pre from {P}_cal)'          # 'all|' — если корней несколько, иначе ''
MO = f'(select mo from {P}_cal)'            # 1 — общий корень над несколькими корнями


def expl(cols, where):
    """строки источника людей → узлы нынешней структуры: путь юнита в последнем месяце (переехал — прошлое
    едет с ним), юнита нет — свой путь; d — глубина узла. Только нужные колонки: развёртка по узлам множит
    строки на глубину"""
    sel = wrap([f's.{c}' for c in cols], ' ' * 15)
    return f"""
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - {MO} as d
    from (
        select {sel},
               {PRE} || coalesce(u.cp,
                   {path_rk}) as cp,
               {cut('paint_cd', 'paint_c')}, {cut('emp_specialization_it_code', 'it_c')},
               {staff_c} as staff_c,
               {act_c} as act_c
        from {SRC} s
        left join {P}_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0 {where}
    ) x
"""


def sql_structure():
    kcol = wrap([f's.lvl{i}_rk::text as k{i}' for i in LV], ' ' * 7)
    ncol = wrap([f'min(s.lvl{i}_nm::text) as n{i}' for i in LV], ' ' * 7)
    k_arr_u = 'ARRAY[' + ', '.join(f'u.k{i}' for i in LV) + ']'
    n_arr_u = 'ARRAY[' + ', '.join(f'u.n{i}' for i in LV) + ']'
    return f"""{head('1. Календарь и структура (поставка 58: SQL вместо build_hub)',
               'teampulse_hub_cal — последний месяц (lm), дата данных (dt), начало сетки, общий корень (mo, pre);',
               '_uall / _uone / _upath — путь каждого юнита последнего месяца; _node — узлы нынешней структуры.')}

-- 1. последний месяц — последний в источнике людей (и текущий незакрытый); dt — последний день этого
--    месяца в дневном источнике, нет его — вчера, но не позже конца месяца. Дневной источник — с отсечением
--    партиций по current_date (подзапрос от lm GP партициями не режет: сортирует источник целиком)
drop table if exists {P}_lm;
create table {P}_lm as select max(s.report_month)::date as lm from {SRC} s {dist('lm')};
drop table if exists {P}_cal;
create table {P}_cal as
select l.lm,
       coalesce(x.dt, least(current_date - 1, (l.lm + interval '1 month' - interval '1 day')::date)) as dt,
       (date_trunc('year', l.lm) - interval '1 year')::date as grid_start,
       0 as mo, ''::text as pre
from {P}_lm l
cross join (
    select max(d.calendar_dt)::date as dt
    from {DAY} d
    where d.calendar_dt >= (date_trunc('month', current_date - 1) - interval '3 month')::date
      and d.calendar_dt >= (select lm from {P}_lm)
      and d.calendar_dt < ((select lm from {P}_lm) + interval '1 month')::date
) x
{dist('lm')};
drop table if exists {P}_lm;

-- 2. пути юнитов последнего месяца — по маленьким таблицам: _uall — юнит × его пути (ключи уровней
--    колонками), _uone — один путь на юнит (если их несколько — меньший строкой, путь целиком)
drop table if exists {P}_uall;
create table {P}_uall as
select s.mng_unit_rk::text as unit_rk, s.leaf_lvl,
       {kcol},
       {ncol}
from {SRC} s
where s.report_month = (select lm from {P}_cal) and s.leaf_lvl > 0
group by {', '.join(str(i) for i in range(1, len(LV) + 3))}
{dist('unit_rk')};
drop table if exists {P}_uone;
create table {P}_uone as
select distinct on (unit_rk) *
from (select u.*, array_to_string(({k_arr_u})[1:u.leaf_lvl], '|') as cp
      from {P}_uall u) x
order by unit_rk, cp
{dist('unit_rk')};
drop table if exists {P}_upath;
create table {P}_upath as
select unit_rk, cp from {P}_uone
{dist('unit_rk')};

-- 3. узлы — все начала путей: и юниты со своими людьми, и уровни над ними без своих строк
drop table if exists {P}_node;
create table {P}_node as
select rk, min(nm) as nm, min(lv) as lv, min(prk) as prk, min(pth) as pth
from (
    select x.rk, x.nm, x.lv,
           case when x.lv = 1 then '' else x.ra[x.lv - 1] end as prk,
           array_to_string(x.ra[1:x.lv], '|') as pth
    from (
        select unnest(r.ra) as rk, unnest(r.na) as nm, generate_subscripts(r.ra, 1) as lv, r.ra
        from (
            select ({k_arr_u})[1:u.leaf_lvl] as ra,
                   ({n_arr_u})[1:u.leaf_lvl] as na
            from {P}_uone u
        ) r
    ) x
    where x.rk <> '-'
) n
group by rk
{dist('rk')};

-- несколько корней — общий корень над ними: «вся компания» — сумма всех строк
update {P}_cal set mo = 1, pre = '{HUB_ALL}|' where (select count(*) from {P}_node where prk = '') > 1;
update {P}_node set prk = '{HUB_ALL}' where prk = '' and {MO} = 1;
update {P}_node set pth = '{HUB_ALL}|' || pth, lv = lv + 1 where {MO} = 1;
insert into {P}_node (rk, nm, lv, prk, pth) select '{HUB_ALL}', 'Все юниты', 1, '', '{HUB_ALL}' where {MO} = 1;

select c.lm as last_month, c.dt as data_dt, c.grid_start, c.mo as common_root,
       (select count(*) from {P}_node) as nodes, (select count(*) from {P}_upath) as units
from {P}_cal c;
"""


def sql_series():
    sx_cols = ['report_month', 'hc_total_cnt', 'hc_active_cnt', 'hire_amt', 'transfer_candidate_amt',
               'transfer_internal_amt', 'hire_cnt', 'fire_amt', 'regret_fire_amt', 'non_regret_fire_amt',
               'transfer_in_lvl', 'transfer_in_amt', 'transfer_out_lvl', 'transfer_out_amt',
               'perf_normal', 'perf_low', 'perf_high', 'perf_gray', 'work_day_amt', 'office_visit_amt',
               'grt_approve_cnt', 'grt_decline_cnt']
    on = lambda a, b: wrap([f'{a}.{c} = {b}.{c}' for c in ('node_rk', 'paint_c', 'it_c', 'staff_c', 'act_c')],
                           ' ' * 7, sep=' and ', width=100)
    return f"""{head('3. Справочник узлов и ряды (поставка 58: SQL вместо build_hub)',
               'teampulse_hub_unit — узлы: родитель, уровень, имя, число подразделений, путь, логин руководителя;',
               'teampulse_hub_series — узел × месяц × срез: численность, ССЧ, найм, увольнения, переводы и др.')}

-- 5. справочник узлов: + число подразделений и логин руководителя (teampulse_hub_head — параграф «hub · 2»)
drop table if exists {P}_unit;
create table {P}_unit as
select n.rk as unit_rk, n.prk as parent_rk, n.lv as unit_lvl, n.nm as unit_nm,
       coalesce(k.kids, 0)::int as kids_cnt, n.pth as path_rk, coalesce(h.head_login, '') as head_login
from {P}_node n
left join (select prk, count(*) as kids from {P}_node where prk <> '' group by prk) k on k.prk = n.rk
left join {P}_head h on h.unit_rk = n.rk
{dist('unit_rk')};

-- 6. строки источника → узлы нынешней структуры, все месяцы одним запросом. Перевод входит в узел
--    глубины d, если сменился уровень ≤ d (через границу узла). Тип численности: «Активная» — по флагу
--    источника на конец месяца, остальные — «Прочие»
drop table if exists {P}_sx;
create table {P}_sx as
select node_rk, report_month::date as report_month, paint_c, it_c, staff_c, act_c,
       sum({num('hc_total_cnt')}) as hc, sum({num('hc_active_cnt')}) as act,
       -- найм по методологии DD: найм в компанию + перевод из учебной группы в боевую + стажёров в
       -- штат; одно событие на человека в строке
       sum(greatest({num('hire_amt')}, {num('transfer_candidate_amt')}, {num('transfer_internal_amt')})) as hire,
       -- найм в компанию с любым типом активности — найм «всей численности»
       sum({num('hire_cnt')}) as hco,
       sum({num('fire_amt')}) as fire, sum({num('regret_fire_amt')}) as reg,
       sum({num('non_regret_fire_amt')}) as nreg,
       sum(case when {num('transfer_in_lvl')} between 1 and d then {num('transfer_in_amt')} else 0 end) as tin,
       sum(case when {num('transfer_out_lvl')} between 1 and d then {num('transfer_out_amt')} else 0 end) as tout,
       sum({num('perf_normal')}) as pnor, sum({num('perf_low')}) as plow,
       sum({num('perf_high')}) as phig, sum({num('perf_gray')}) as pgry,
       sum({num('work_day_amt')}) as wday, sum({num('office_visit_amt')}) as ovis,
       sum({num('grt_approve_cnt')}) as gapr, sum({num('grt_decline_cnt')}) as gdec
from ({expl(sx_cols, '')}) e
group by 1, 2, 3, 4, 5, 6
{dist('node_rk')};

-- 7. ССЧ = (численность месяца + прошлого) / 2 по узлу и срезу: строка и там, где людей среза в узле
--    в этом месяце уже нет, а в прошлом были. Первый месяц — без лага
drop table if exists {P}_series;
create table {P}_series as
with k as (
    select node_rk, report_month, paint_c, it_c, staff_c, act_c from {P}_sx
    union
    select node_rk, (report_month + interval '1 month')::date, paint_c, it_c, staff_c, act_c from {P}_sx
    where report_month < (select max(report_month) from {P}_sx)
)
select k.node_rk, k.report_month, k.paint_c as paint_cd, k.it_c as it_cd, k.staff_c as staff_cd,
       k.act_c as act_cd,
       coalesce(c.hc, 0) as hc_cnt, coalesce(c.act, 0) as act_cnt,
       (coalesce(c.hc, 0) + case when k.report_month = (select min(report_month) from {P}_sx)
                                 then coalesce(c.hc, 0) else coalesce(pv.hc, 0) end) / 2.0 as avg_cnt,
       coalesce(c.hire, 0) as hire_cnt, coalesce(c.hco, 0) as hco_cnt,
       coalesce(c.fire, 0) as fire_cnt, coalesce(c.reg, 0) as reg_cnt, coalesce(c.nreg, 0) as nreg_cnt,
       coalesce(c.tin, 0) as tin_cnt, coalesce(c.tout, 0) as tout_cnt,
       coalesce(c.pnor, 0) as pnor_cnt, coalesce(c.plow, 0) as plow_cnt,
       coalesce(c.phig, 0) as phig_cnt, coalesce(c.pgry, 0) as pgry_cnt,
       coalesce(c.wday, 0) as wday_amt, coalesce(c.ovis, 0) as ovis_amt,
       coalesce(c.gapr, 0) as gapr_cnt, coalesce(c.gdec, 0) as gdec_cnt
from k
left join {P}_sx c
       on {on('c', 'k')}
      and c.report_month = k.report_month
left join {P}_sx pv
       on {on('pv', 'k')}
      and pv.report_month = (k.report_month - interval '1 month')::date
{dist('node_rk')};
drop table if exists {P}_sx;

select (select count(*) from {P}_unit) as unit_rows, (select count(*) from {P}_series) as series_rows;
"""


def sql_mix():
    a = {k: clean(f'e.{c}') for k, c in (
        ('g', 'gender'), ('a', 'type_age'), ('t', 'experience_group_nm'), ('gr', 'grade'), ('s', 'seniority'),
        ('c', 'employee_contract_type'), ('o', 'legal_organization'), ('w', 'employee_stream'),
        ('r', 'employment_relation_type'), ('fr', 'fire_reason_group'), ('fi', 'fire_initiative'),
        ('sp', 'specialization'), ('tc', 'type_company'), ('hs', 'source_type_nm'))}
    hc_keys = ['g', 'a', 't', 'gr', 's', 'c', 'o', 'w', 'r', 'sp', 'tc']
    hire_e = f"greatest({num('hire_amt')}, {num('transfer_candidate_amt')}, {num('transfer_internal_amt')})"
    hch = (f"case when {num('hire_amt')} > 0 then 'Найм в компанию'\n"
           f"{' ' * 30}when {num('transfer_candidate_amt')} > 0 then 'Из учебной группы в боевую' else 'Стажёр в штат' end")
    attrs = ['gender', 'type_age', 'experience_group_nm', 'grade', 'seniority', 'employee_contract_type',
             'legal_organization', 'employee_stream', 'employment_relation_type', 'specialization', 'type_company']
    lm = f'(select lm from {P}_cal)'
    ytd = f"and s.report_month between date_trunc('year', {lm})::date and {lm}"
    return f"""{head('4. Разрезы (поставка 58: SQL вместо build_hub)',
               'teampulse_hub_mix — узел × срез × разрез × значение: численность последнего месяца по атрибутам',
               '(g a t gr s c o w r sp tc), увольнения с начала его года (xr причина, xq regret по причине, xi',
               'инициатива, xp причина|инициатива, xt стаж, xg грейд, xs стрим, xsp специализация, xtc тип компании),',
               "найм с начала года (hk источник, hch канал, hg грейд, hsp специализация). Пустое значение — ''.")}

-- численность последнего месяца
drop table if exists {P}_mixr;
create table {P}_mixr as
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       unnest(ARRAY[{', '.join(f"'{k}'" for k in hc_keys)}]) as mx_key,
       unnest(ARRAY[{(',' + chr(10) + ' ' * 20).join(a[k] for k in hc_keys)}]) as mx_val,
       {num('hc_total_cnt')} as mx_n
from ({expl(['hc_total_cnt'] + attrs, f'and s.report_month = {lm}')}) e
where {num('hc_total_cnt')} > 0
{dist('node_rk')};

-- увольнения с начала года
insert into {P}_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       unnest(ARRAY['xr', 'xq', 'xi', 'xp', 'xt', 'xg', 'xs', 'xsp', 'xtc']) as mx_key,
       unnest(ARRAY[{(',' + chr(10) + ' ' * 20).join([a['fr'], a['fr'], a['fi'],
                                                      a['fr'] + chr(10) + ' ' * 20 + "|| '|' || " + a['fi'],
                                                      a['t'], a['gr'], a['w'], a['sp'], a['tc']])}]) as mx_val,
       unnest(ARRAY[{wrap([num('fire_amt'), num('regret_fire_amt')] + [num('fire_amt')] * 7, ' ' * 20)}]) as mx_n
from ({expl(['fire_amt', 'regret_fire_amt', 'fire_reason_group', 'fire_initiative', 'experience_group_nm', 'grade',
             'employee_stream', 'specialization', 'type_company'], ytd)}) e
where {num('fire_amt')} > 0;

-- найм с начала года: источник, канал (найм в компанию / из учебной группы в боевую / стажёр в штат),
-- грейд, специализация
insert into {P}_mixr
select e.node_rk, e.paint_c, e.it_c, e.staff_c, e.act_c,
       unnest(ARRAY['hk', 'hch', 'hg', 'hsp']) as mx_key,
       unnest(ARRAY[{(',' + chr(10) + ' ' * 20).join([a['hs'], hch, a['gr'], a['sp']])}]) as mx_val,
       {hire_e} as mx_n
from ({expl(['hire_amt', 'transfer_candidate_amt', 'transfer_internal_amt', 'source_type_nm', 'grade',
             'specialization'], ytd)}) e
where {hire_e} > 0;

drop table if exists {P}_mix;
create table {P}_mix as
select node_rk, paint_c as paint_cd, it_c as it_cd, staff_c as staff_cd, act_c as act_cd,
       mx_key, mx_val, sum(mx_n) as mx_n
from {P}_mixr
group by 1, 2, 3, 4, 5, 6, 7
having sum(mx_n) > 0
{dist('node_rk')};
drop table if exists {P}_mixr;

select count(*) as mix_rows from {P}_mix;
"""


def sql_trf():
    dkeys = (',\n' + ' ' * 31).join(f"coalesce(nullif(x.lvl{i}_mapped_management_unit_rk::text, ''), '-') as k{i}" for i in LV)
    dleaf = 'case ' + wrap([f"when r.k{i} <> '-' then {i}" for i in reversed(LV)], ' ' * 30, sep=' ') + ' else 0 end'
    du = 'case q.lf ' + wrap([f'when {i} then q.k{i}' for i in LV], ' ' * 37, sep=' ') + " else '' end"
    dop = ("concat_ws('|', q.k1, " + wrap([f'case when q.lf >= {i} then q.k{i} end' for i in LV[1:]], ' ' * 61)
           + ')')
    dflg = lambda c: f"(coalesce(x.{c}::text, '0') = '1')::int"
    dcut = lambda c: f"coalesce(nullif(coalesce(x.{c}::text, '-'), ''), '-')"
    dany = lambda cs: '(' + wrap([f"coalesce(x.{c}::text, '0') = '1'" for c in cs], ' ' * 32, sep=' or ') + ')::int'
    tflg = lambda d, t: dany([f'transfer_{d}_{t}_flg'])
    u_in = dany([f'lvl{i}_mngt_unit_in_trsf_flg' for i in DLV_FLG])
    u_out = dany([f'lvl{i}_mngt_unit_out_trsf_flg' for i in DLV_FLG])
    act_e = "case when coalesce(x.active_count_flg::text, '0') = '1' then 'Активная' else 'Прочие' end"
    staff_e = f"case when x.employment_relation_type_desc = '{STAFF}' then 'Штат' else 'Не штат' end"
    fpath = lambda c: f"case when {c} = '' then '{{}}'::text[] else string_to_array({PRE} || {c}, '|') end"
    lag = ['u', 'op', 'pa', 'it', 'st', 'ac', 'fx', 'ou', 'oq', 'oi', 'ost', 'oa']
    in_grid = lambda m: f'{m} between c.grid_start and c.lm'
    m_end = lambda m: f"(({m} + interval '1 month')::date - 1)"
    return f"""{head('5. Переходы людей (поставка 58: SQL вместо build_hub)',
               'teampulse_hub_trf — узел × месяц × вид × срез до × срез после: датасет считает из них переводы в выбор',
               'и из выбора под любые фильтры. Перевод — только если смену отметил флаг источника: «в» — на первом',
               'дне в новом состоянии, «из» — на последнем в старом; переход между днями t−1 и t датируется днём t.',
               'Виды: i / o / s — вошёл в узел, вышел, остался со сменой среза; h — найм в компанию (срез дня найма);',
               'x… — смены без флага, для сверки (xi / xo / xs, xa — появился без найма, xd — пропал без увольнения).',
               'Дневной источник читается один раз. Окно — месяц, как у помесячных частей build_hub: «вчера» для дня',
               'месяца — только дни этого месяца и последний день прошлого; «пропал» — нет его до конца месяца.')}

-- 10а. события по дням: смены юнита или среза, найм и появления, пропажи. Строка — человек × день, у
--      которого есть событие; «0» — прошлый день человека, «1» — следующий. Путь юнита (op) — ключами из
--      строки дня; нынешний путь подставляет 10б: событий мало, а сортировка по людям и дням — узкая
drop table if exists {P}_ev;
create table {P}_ev as
select s.e, s.dt, s.mo_dt as report_month, s.u, s.op, s.pa, s.it, s.st, s.ac, s.hf, s.cv, s.fx,
       s.iu, s.ip, s.ii, s.ist, s.ia, s.u0, s.op0, s.pa0, s.it0, s.st0, s.ac0, s.fx0, s.ou0, s.oq0, s.oi0, s.ost0, s.oa0,
       s.g_ok::int as is_g, s.ha_ok::int as is_ha, s.d_ok::int as is_d
from (
    select w.*,
           -- смена против прошлого дня того же окна месяца; найм — отдельно (h)
           ({in_grid('w.mo_dt')} and w.dt0 >= w.mo_dt - 1 and w.hf = 0
            and (w.u <> w.u0 or (w.pa, w.it, w.st, w.ac) <> (w.pa0, w.it0, w.st0, w.ac0))) as g_ok,
           -- найм в компанию или появление: прошлого дня в окне месяца нет
           ({in_grid('w.mo_dt')} and (w.hf = 1 or w.dt0 is null or w.dt0 < w.mo_dt - 1)) as ha_ok,
           -- пропал без увольнения: следующего дня нет до конца месяца, где был бы «завтра»
           ({in_grid('w.mo_d1')} and w.fx = 0 and w.dt < least({m_end('w.mo_d1')}, c.dt)
            and (w.dt1 is null or w.dt1 > {m_end('w.mo_d1')})) as d_ok
    from (
        select y.*, date_trunc('month', y.dt)::date as mo_dt, date_trunc('month', y.dt + 1)::date as mo_d1,
               {wrap(['lag(y.dt) over wd as dt0'] + [f'lag(y.{k}) over wd as {k}0' for k in lag], ' ' * 15)},
               lead(y.dt) over wd as dt1
        from (
            -- одна строка на человека и день (если их несколько — с меньшим юнитом): то же окно по человеку,
            -- что и у «вчера», — GP перераспределяет строки один раз
            select z.*, case when lag(z.dt) over (partition by z.e order by z.dt, z.u) = z.dt then 0 else 1 end as rn
            from (
                -- юнит дня — самый глубокий уровень с ключом (lf), его путь — ключи уровней до него (op)
                select q.e, q.dt, {du} as u,
                       case when q.lf = 0 then '' else {dop} end as op,
                       q.pa, q.it, q.st, q.ac, q.hf, q.cv, q.fx, q.iu, q.ou, q.ip, q.oq, q.ii, q.oi, q.ist, q.ost, q.ia, q.oa
                from (
                    select r.*, {dleaf} as lf
                    from (
                        select x.mdm_employee_rk as e, x.calendar_dt::date as dt,
                               {dkeys},
                               {dcut('emp_specialization_oper_code')} as pa,
                               {dcut('emp_specialization_it_code')} as it,
                               {staff_e} as st,
                               {act_e} as ac,
                               {dflg('hire_flg')} as hf,
                               least({dflg('transfer_candidate_flg')} + {dflg('transfer_internal_flg')}, 1) as cv,
                               {dflg('fire_flg')} as fx,
                               {u_in} as iu,
                               {u_out} as ou,
                               {tflg('to', 'hq')} as ip, {tflg('out', 'hq')} as oq,
                               {tflg('to', 'it')} as ii, {tflg('out', 'it')} as oi,
                               {tflg('to', 'employment_relation_type')} as ist,
                               {tflg('out', 'employment_relation_type')} as ost,
                               {tflg('to', 'active_type')} as ia,
                               {tflg('out', 'active_type')} as oa
                        from {DAY} x
                        -- сетка отчёта и последний день перед ней; первое условие — отсечение партиций
                        where x.calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
                          and x.calendar_dt >= (select grid_start from {P}_cal) - 1
                          and x.calendar_dt < ((select lm from {P}_cal) + interval '1 month')::date
                    ) r
                ) q
            ) z
        ) y
        where y.rn = 1
        window wd as (partition by y.e order by y.dt)
    ) w
    cross join {P}_cal c
) s
where s.g_ok or s.ha_ok or s.d_ok
{dist('e')};

-- 10б. события → переходы по узлам. Путь юнита — нынешний (_upath), у юнита вне нынешней структуры — свой
--      (op). Какие части перехода отметил источник: «в» на новом дне или «из» на прошлом; неотмеченная часть —
--      как будто не менялась (вид без «x»), по значениям — сверка (вид «x…»)
drop table if exists {P}_trf;
create table {P}_trf as
select * from (
with s as (
    select v.*,
           case when v.u = '' then '' else coalesce(ua1.cp, v.op) end as cp,
           case when v.u0 = '' then '' else coalesce(ua0.cp, v.op0) end as cpb
    from {P}_ev v
    left join {P}_upath ua1 on ua1.unit_rk = v.u
    left join {P}_upath ua0 on ua0.unit_rk = v.u0
),
g as (
    select s.*,
           coalesce(greatest(s.iu, s.ou0), (s.u <> s.u0)::int) as gu,
           coalesce(greatest(s.ip, s.oq0), (s.pa <> s.pa0)::int) as gp,
           coalesce(greatest(s.ii, s.oi0), (s.it <> s.it0)::int) as gi,
           coalesce(greatest(s.ist, s.ost0), (s.st <> s.st0)::int) as gs,
           greatest(coalesce(greatest(s.ia, s.oa0), (s.ac <> s.ac0)::int), s.cv) as ga
    from s
    where s.is_g = 1
),
c as (
    -- «было» с учётом флагов (e): неотмеченная часть — как будто не менялась; «было» по значениям (t)
    select g.report_month, g.pa, g.it, g.st, g.ac,
           case when g.gp = 1 then g.pa0 else g.pa end as epa, case when g.gi = 1 then g.it0 else g.it end as eit,
           case when g.gs = 1 then g.st0 else g.st end as est, case when g.ga = 1 then g.ac0 else g.ac end as eac,
           g.pa0 as tpa, g.it0 as tit, g.st0 as tst, g.ac0 as tac,
           1 - g.cv as in_ok, 1 - g.fx0 as out_ok,
           g.cp as cp1,
           case when g.gu = 1 then g.cpb else g.cp end as ecp,
           g.cpb as tcp
    from g
),
r as (
    -- событие: путь до (a0) и после (a1), срез до (f) и после (t), вид-префикс
    select report_month, '' as pfx, ecp as cp0, cp1, epa as fpa, eit as fit, est as fst, eac as fac,
           pa as tpa_, it as tit_, st as tst_, ac as tac_, in_ok, out_ok
    from c where ecp <> cp1 or (epa, eit, est, eac) <> (pa, it, st, ac)
    union all
    select report_month, 'x', tcp, ecp, tpa, tit, tst, tac, epa, eit, est, eac, 1, 1
    from c where tcp <> ecp or (tpa, tit, tst, tac) <> (epa, eit, est, eac)
    union all
    select s.report_month, case when s.hf = 1 then 'h' else 'a' end, '', s.cp,
           '', '', '', '', s.pa, s.it, s.st, s.ac, 1, 1
    from s where s.is_ha = 1
    union all
    select date_trunc('month', s.dt + 1)::date, 'd', s.cp, '',
           s.pa, s.it, s.st, s.ac, '', '', '', '', 1, 1
    from s where s.is_d = 1
),
t as (
    select r.*, {fpath('r.cp0')} as a0,
           {fpath('r.cp1')} as a1,
           (fpa, fit, fst, fac) <> (tpa_, tit_, tst_, tac_) as cut_chg
    from r
),
n as (
    select report_month, node_rk, pfx, case when node_rk = any(a0) then 's' else 'i' end as k,
           fpa, fit, fst, fac, tpa_, tit_, tst_, tac_, in_ok, out_ok, cut_chg
    from (select t.*, unnest(t.a1) as node_rk from t) z
    union all
    select report_month, node_rk, pfx, 'o', fpa, fit, fst, fac, tpa_, tit_, tst_, tac_, in_ok, out_ok, cut_chg
    from (select t.*, unnest(t.a0) as node_rk from t) z
    where not (node_rk = any(a1))
)
select node_rk, report_month,
       case pfx when '' then k when 'x' then 'x' || k when 'h' then 'h' when 'a' then 'xa' else 'xd' end as trf_kind,
       case when k = 'i' then '' else fpa end as f_paint_cd, case when k = 'i' then '' else fit end as f_it_cd,
       case when k = 'i' then '' else fst end as f_staff_cd, case when k = 'i' then '' else fac end as f_act_cd,
       case when k = 'o' then '' else tpa_ end as t_paint_cd, case when k = 'o' then '' else tit_ end as t_it_cd,
       case when k = 'o' then '' else tst_ end as t_staff_cd, case when k = 'o' then '' else tac_ end as t_act_cd,
       case when k = 'o' then 1 else in_ok end as in_ok, case when k = 'i' then 1 else out_ok end as out_ok,
       count(*) as trf_cnt
from n
where (k <> 's' or cut_chg) and (k <> 'o' or out_ok = 1)
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
) q
{dist('node_rk')};
drop table if exists {P}_ev;

select count(*) as trf_rows, coalesce(sum(trf_cnt), 0) as transitions from {P}_trf;
"""


def sql_final():
    gs, lm = f'(select grid_start from {P}_cal)', f'(select lm from {P}_cal)'
    return f"""{head('6. Вакансии, календарь отчёта, уборка (поставка 58: SQL вместо build_hub)',
               'teampulse_hub_vacancy — узел × месяц × разрезы вакансии; teampulse_hub_meta — одна строка: последний',
               'месяц, дата данных, сетка, корень, юнит по умолчанию. В конце — сколько строк в каждой таблице.')}

-- 11. вакансии: structure_x_vacancy → узлы нынешней структуры. Путь юнита — по _upath, юнита нет в
--     последнем месяце — свой путь из уровней вакансии. Вакансия — не человек: фильтры среза на неё не действуют
drop table if exists {P}_vacancy;
create table {P}_vacancy as
select node_rk, report_month, channel, search_reason, cand_lvl, position_lvl, specialization, status,
       sum(open_cnt) as vac_open_cnt, sum(close_cnt) as vac_close_cnt, sum(new_cnt) as vac_new_cnt,
       sum(ttf_days) as vac_ttf_days, sum(ttf_cnt) as vac_ttf_cnt
from (
    select x.*, unnest(string_to_array({PRE} || coalesce(u.cp, x.unit_path), '|')) as node_rk
    from {VAC} x
    left join {P}_upath u on u.unit_rk = x.mng_unit_rk::text
    where x.report_month between {gs} and {lm}
) e
group by 1, 2, 3, 4, 5, 6, 7, 8
{dist('node_rk')};

-- 9. календарь отчёта, корень и юнит по умолчанию (у корня один ребёнок — он)
drop table if exists {P}_meta;
create table {P}_meta as
select c.lm as last_month,
       c.dt as data_dt,
       (date_trunc('year', c.lm) - interval '1 year')::date as grid_start,
       (12 + date_part('month', c.lm))::int as n_months,
       12 as ytd_idx,
       r.unit_rk as root_rk,
       case when r.kids_cnt = 1 then (select unit_rk from {P}_unit where parent_rk = r.unit_rk) else r.unit_rk end as def_rk,
       now() as built_at,
       'hub-2' as schema_ver
from {P}_cal c
cross join (select unit_rk, kids_cnt from {P}_unit where parent_rk = '' order by unit_rk limit 1) r
{dist('last_month')};

drop table if exists {P}_node;
drop table if exists {P}_head;
drop table if exists {P}_uall;
drop table if exists {P}_uone;

select 'meta' as tbl, count(*) as rows_cnt from {P}_meta
union all select 'unit', count(*) from {P}_unit
union all select 'series', count(*) from {P}_series
union all select 'mix', count(*) from {P}_mix
union all select 'trf', count(*) from {P}_trf
union all select 'vacancy', count(*) from {P}_vacancy
union all select 'ai', count(*) from {P}_ai;
"""


def sql_checks():
    root, lm = f'(select root_rk from {P}_meta)', f'(select last_month from {P}_meta)'
    hcl = f"""(select node_rk, sum(hc_cnt) as hc from {P}_series
                     where report_month = {lm} group by 1)"""
    checks = [
        # (проверка, обязательная: 1 — не сошлось → ошибка и выгрузки нет; 0 — справочно, SQL)
        ('корень − люди: численность последнего месяца', 1,
         f"""(select sum(hc_cnt) from {P}_series
          where node_rk = {root}
            and report_month = {lm})
       - (select sum(hc_total_cnt) from {SRC}
          where leaf_lvl > 0 and report_month = {lm})"""),
        ('корень − люди: увольнения за всё время', 1,
         f"""(select sum(fire_cnt) from {P}_series where node_rk = {root})
       - (select sum(fire_amt) from {SRC} where leaf_lvl > 0)"""),
        ('корень − люди: перформанс за всё время', 1,
         f"""(select sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) from {P}_series
          where node_rk = {root})
       - (select sum(perf_normal + perf_low + perf_high + perf_gray) from {SRC}
          where leaf_lvl > 0)"""),
        ('корень − разрез по полу (численность)', 1,
         f"""(select sum(hc_cnt) from {P}_series
          where node_rk = {root}
            and report_month = {lm})
       - (select sum(mx_n) from {P}_mix where node_rk = {root} and mx_key = 'g')"""),
        ('повторы ключа «узел × месяц × срез»', 1,
         f"""(select count(*) from (select 1 from {P}_series
                                group by node_rk, report_month, paint_cd, it_cd, staff_cd, act_cd
                                having count(*) > 1) t)"""),
        ('узлов, у которых нет родителя в справочнике (кроме корня)', 1,
         f"""(select count(*) from {P}_unit u
        where u.parent_rk <> '' and not exists (select 1 from {P}_unit p where p.unit_rk = u.parent_rk))"""),
        ('переходы: «остался» без смены среза', 1,
         f"""(select count(*) from {P}_trf where trf_kind = 's'
        and (f_paint_cd, f_it_cd, f_staff_cd, f_act_cd) = (t_paint_cd, t_it_cd, t_staff_cd, t_act_cd))"""),
        ('переходы: строк без людей', 1,
         f"(select count(*) from {P}_trf where trf_cnt <= 0 or (in_ok = 0 and out_ok = 0))"),
        ('корней', 1, f"(select count(*) - 1 from {P}_unit where parent_rk = '')"),
        ('узлов, где подразделения больше узла (численность)', 1,
         f"""(select count(*) from {P}_unit u
        join {hcl} h on h.node_rk = u.unit_rk
        left join (select u2.parent_rk, sum(h2.hc) as hc
                   from {P}_unit u2
                   join {hcl} h2 on h2.node_rk = u2.unit_rk
                   group by 1) k on k.parent_rk = u.unit_rk
        where h.hc - coalesce(k.hc, 0) < -0.5)"""),
        # справочно: вакансия юнита вне дерева людей в корень не попадёт; x… — «прочее» водопада компании
        ('вакансии: корень − снимок (открытые на конец последнего месяца)', 0,
         f"""coalesce((select sum(vac_open_cnt) from {P}_vacancy
                   where node_rk = {root}
                     and report_month = {lm}), 0)
       - coalesce((select sum(open_cnt) from {VAC} where report_month = {lm}), 0)"""),
        ('вакансии: корень − снимок (закрытые за всё время сетки)', 0,
         f"""coalesce((select sum(vac_close_cnt) from {P}_vacancy where node_rk = {root}), 0)
       - coalesce((select sum(close_cnt) from {VAC}
                   where report_month >= (select grid_start from {P}_meta)), 0)"""),
        ('переходы без флага источника у корня (x…), после первого месяца сетки', 0,
         f"""(select coalesce(sum(trf_cnt), 0) from {P}_trf
        where trf_kind like 'x%' and node_rk = {root}
          and report_month > (select min(report_month) from {P}_trf))"""),
    ]
    rows = '\nunion all\n'.join(f"select {i} as n, '{name}'::text as check_nm, {must} as must,\n       ({sql})::float8 as val"
                                for i, (name, must, sql) in enumerate(checks, 1))
    return f"""{head('проверки таблиц — до выгрузки (поставка 58: SQL вместо Python)',
               'Каждая проверка — одно число. Обязательная не сошлась — ошибка со списком, и параграф выгрузки',
               '(to click) со старыми данными в отчёте не запускается. Справочные (INFO) выгрузку не останавливают.',
               'Результат по каждой — таблица teampulse_hub_chk (её же показывает второй запрос).')}
drop table if exists {P}_chk;
create table {P}_chk as
{rows}
distributed randomly;

select n, check_nm, val,
       case when must = 0 then 'INFO' when abs(coalesce(val, 0)) < 0.5 then 'OK' else 'FAIL' end as result
from {P}_chk
order by n;

select case when count(*) = 0 then 'таблицы TeamPulse Hub сходятся'
            else ('ТАБЛИЦЫ TeamPulse Hub НЕ СХОДЯТСЯ: '
                  || string_agg(check_nm || ' = ' || coalesce(val, 0)::text, '; '))::int::text
       end as result
from {P}_chk
where must = 1 and abs(coalesce(val, 0)) >= 0.5;
"""


FILES = {
    'sql_0_cols.sql': sql_cols,
    'sql_vacancy.sql': sql_vacancy_snapshot,
    'sql_1_structure.sql': sql_structure,
    'sql_3_series.sql': sql_series,
    'sql_4_mix.sql': sql_mix,
    'sql_5_trf.sql': sql_trf,
    'sql_6_final.sql': sql_final,
    'sql_checks.sql': sql_checks,
}


def main():
    for fn, f in FILES.items():
        text = '\n'.join(line.rstrip() for line in f().strip('\n').split('\n')) + '\n'
        open(os.path.join(OUT, fn), 'w', encoding='utf-8').write(text)
        print(f'{fn}: {len(text.splitlines())} строк')


if __name__ == '__main__':
    main()

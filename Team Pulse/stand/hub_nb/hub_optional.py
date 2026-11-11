# =============================================================================
# TeamPulse Hub · 2. Логины руководителей и AI — необязательные источники (поставка 58)
# Остальная сборка — параграфы gp (SQL). Здесь Python, потому что сначала нужно проверить, есть ли
# источник и его колонки, — SQL так не умеет. Два коротких запроса; тяжёлых шагов здесь нет.
# Нет источника — таблица пустая, отчёт работает: логины пустые, AI «в разработке».
#   teampulse_hub_head  юнит → логин руководителя на дату данных и его имя (для teampulse_hub_unit, параграф
#                       «hub · 3»; имя — с поставки 66, из unit_head_structure Адели)
#   teampulse_hub_login сотрудник → логин на ту же дату (детализация переводов, параграф «hub · 5», поставка 63)
#   teampulse_hub_access логин → юнит: кому какой юнит открыт (12.11, источник прав usr_cross_data.new_access_to_digest_line)
#   teampulse_hub_aiw   узел × неделя: WAU, численность и проникновение AI-инструментов (без стажёров)
# =============================================================================
from dal_client import query as dal

HUB_P = 'teampulse_hub'
HUB_SRC = 'all_metrics_with_performance_and_office_traffic_and_grt'
# логин руководителя (как в HRBP HUB): первая таблица, где есть все колонки, — источник TP 2.0,
# иначе структура сотрудников (её берёт HRBP HUB)
HUB_HEAD_SRC = [('usr_cross_data.hr_executive_proteus', 'calendar_dt'),
                ('prod_v_emart.mdm_employee_structure_d', 'business_dt')]
HUB_HEAD_COLS = {'mdm_employee_rk', 'management_head_flg', 'ad_login', 'management_head_ad_login'}
HUB_AI_SRC = 'usr_mlpa.ai_bi_all_copilots_usage_digest_weekly'
# поставка 66 : имя и фамилия руководителя — параграф unit_head_structure (руководитель юнита по месяцам)
HUB_HEAD_NM = 'unit_head_structure'


def _hub_q(sql):
    return dal.get_df(datasource='gp', query=sql)


def _hub_cols(table):
    sch, _, tbl = table.rpartition('.')
    where = f"table_schema = '{sch}'" if sch else "table_schema not in ('pg_catalog', 'information_schema')"
    try:
        df = _hub_q(f"select column_name from information_schema.columns where {where} and table_name = '{tbl}'")
    except Exception:
        return set()
    return {c.lower() for c in df['column_name']}


_cal = _hub_q(f'select lm, grid_start, dt from {HUB_P}_cal').iloc[0]
_lm, _gs = str(_cal['lm'])[:10], str(_cal['grid_start'])[:10]
_dt = str(_cal['dt'])[:10]                       # поставка 106: дата данных — последняя полная неделя AI

# поставка 66: имя руководителя по логину — из unit_head_structure, последний месяц, где этот логин руководит
# юнитом (не позже последнего месяца отчёта). Нет таблицы — имена пустые, логины остаются
_nm = "(select ''::text as login, ''::text as nm where false)"
if {'report_month', 'leader_login', 'leader_full_nm'} <= _hub_cols(HUB_HEAD_NM):
    _nm = f"""(
        select distinct on (login) login, nm
        from (select lower(trim(leader_login::text)) as login, trim(leader_full_nm::text) as nm, report_month
              from {HUB_HEAD_NM}
              where report_month <= '{_lm}'::date) x
        where login <> '' and coalesce(nm, '') <> ''
        order by login, report_month desc, nm)"""

# 4. руководитель юнита на конец последнего месяца — голосами, как в HRBP HUB: 3 — сам руководитель
#    (management_head_flg = 1) в юните → его ad_login; 2 — люди юнита → их management_head_ad_login;
#    1 — руководители подразделений → их management_head_ad_login (у юнита без своих людей). Старший
#    голос, внутри — самый частый логин, при равенстве — меньший. Источник логинов — на последнюю дату
#    месяца, литералом: так GP режет партиции
_hsrc = next(((t, d) for t, d in HUB_HEAD_SRC if HUB_HEAD_COLS | {d} <= _hub_cols(t)), None)
_hdt = None
if _hsrc and 'mdm_employee_rk' in _hub_cols(HUB_SRC):
    _t, _d = _hsrc
    _x = _hub_q(f"""select max(x.{_d})::date as dt from {_t} x
                    where x.{_d} >= '{_lm}'::date and x.{_d} < ('{_lm}'::date + interval '1 month')""")['dt'].iloc[0]
    if _x is not None and str(_x)[:3] not in ('NaT', 'Non', 'nan'):
        _hdt = str(_x)[:10]
if _hdt:
    _hh = f"""(
        select e.mdm_employee_rk as erk, max(coalesce(e.management_head_flg::text, '0'))::int as is_head,
               max(nullif(lower(trim(e.ad_login::text)), '')) as login,
               max(nullif(lower(trim(e.management_head_ad_login::text)), '')) as head_login
        from {_t} e
        where e.{_d} = '{_hdt}'::date
        group by 1)"""
    _hub_q(f"""
drop table if exists {HUB_P}_head;
create table {HUB_P}_head as
select hd.unit_rk, hd.head_login, coalesce(nm.nm, '') as head_nm
from (
select distinct on (unit_rk) unit_rk, head_login
from (
    select v.unit_rk, v.head_login, max(v.w) as w, count(*) as n
    from (
        select s.mng_unit_rk::text as unit_rk,
               case when h.is_head = 1 then h.login else h.head_login end as head_login,
               case when h.is_head = 1 then 3 else 2 end as w
        from {HUB_SRC} s
        join {_hh} h on h.erk = s.mdm_employee_rk
        where s.report_month = '{_lm}'::date and s.leaf_lvl > 0 and coalesce(s.hc_total_cnt, 0) > 0
        union all
        select n.prk, h.head_login, 1
        from {HUB_SRC} s
        join {_hh} h on h.erk = s.mdm_employee_rk
        join {HUB_P}_node n on n.rk = s.mng_unit_rk::text
        where s.report_month = '{_lm}'::date and s.leaf_lvl > 0 and coalesce(s.hc_total_cnt, 0) > 0
          and h.is_head = 1 and n.prk <> ''
    ) v
    where v.head_login is not null and v.unit_rk is not null
    group by v.unit_rk, v.head_login
) t
order by unit_rk, w desc, n desc, head_login
) hd
left join {_nm} nm on nm.login = hd.head_login
distributed by (unit_rk)""")
    _hn = _hub_q(f"select count(*) as n, count(nullif(head_nm, '')) as nm from {HUB_P}_head").iloc[0]
    print(f"[OK] {HUB_P}_head: логины из {_t} на {_hdt} — {_hn['n']} юнитов, с именем руководителя — {_hn['nm']}")
    # поставка 63: логины сотрудников на ту же дату — для детализации переводов (hub · 5). Ушедших до этой
    # даты нет — у них в детализации только шифр
    _hub_q(f"""
drop table if exists {HUB_P}_login;
create table {HUB_P}_login as
select h.erk, h.login from {_hh} h where h.login is not null
distributed by (erk)""")
else:
    _hub_q(f"""
drop table if exists {HUB_P}_head;
create table {HUB_P}_head as select ''::text as unit_rk, ''::text as head_login, ''::text as head_nm where false
distributed by (unit_rk)""")
    _hub_q(f"""
drop table if exists {HUB_P}_login;
create table {HUB_P}_login as select 0::bigint as erk, ''::text as login where false
distributed by (erk)""")
    print(f'[WARN] логинов руководителей нет ни в одном источнике {[t for t, _ in HUB_HEAD_SRC]} — логины пустые')

# 4а. Доступ к отчёту (12.11, владелец: единый источник прав): usr_cross_data.new_access_to_digest_line — логин получателя
#     доступа (login) и юнит (mngt_unit_rk). Таблица teampulse_hub_access — уникальные пары «логин, юнит»: дубли источника
#     не размножают строки. Датасет открывает логину юнит и всё под ним; у кого юнит — корень, видит всю компанию
#     (суперюзеры — тоже строками источника, списка логинов в датасете больше нет). leader_login — руководитель юнита, к
#     правам не относится. Нет источника или колонок — таблица пустая: доступа нет ни у кого (не «всем всё»)
HUB_ACC_SRC = 'usr_cross_data.new_access_to_digest_line'
if {'mngt_unit_rk', 'login'} <= _hub_cols(HUB_ACC_SRC):
    _hub_q(f"""
drop table if exists {HUB_P}_access;
create table {HUB_P}_access as
select distinct login, unit_rk
from (select lower(trim(login::text)) as login, trim(mngt_unit_rk::text) as unit_rk from {HUB_ACC_SRC}) a
where coalesce(login, '') <> '' and coalesce(unit_rk, '') <> ''
distributed by (login)""")
    _ha = _hub_q(f"""select count(*) as n, count(distinct login) as lg, (select count(*) from {HUB_ACC_SRC}) as src
                from {HUB_P}_access""").iloc[0]
    print(f"[OK] {HUB_P}_access: строк источника {_ha['src']}, уникальных пар «логин, юнит» {_ha['n']}, логинов {_ha['lg']}")
else:
    _hub_q(f"""
drop table if exists {HUB_P}_access;
create table {HUB_P}_access as select ''::text as login, ''::text as unit_rk where false
distributed by (login)""")
    print(f'[WARN] источника прав {HUB_ACC_SRC} нет или в нём нет колонок login, mngt_unit_rk — доступа к отчёту нет ни у кого')

# 12. AI-инструменты — ТОЛЬКО НЕДЕЛИ (решение заказчика 06.11, поставка 106): месячный AI и месячный
#     дайджест больше не используются, месяц из недель не сворачивается. Витрина teampulse_hub_aiw —
#     узел × неделя (Пн): зерно источника — человек × неделя × пара «юнит → его дочерний на пути к
#     листу» (лист сам с собой), поэтому GROUP BY mngt_unit_rk = поддерево юнита; люди — только
#     count distinct (строк на человека-неделю ~7–8); стажёры исключены из числителя и знаменателя
#     (иначе завышение на 2–4%); численность — своя у источника, не series. Срезы на AI не действуют.
#     Формулы сверены с источником 06.11 (company_weekly_penetration_pct = той же формуле по компании)
_acols = _hub_cols(HUB_AI_SRC)
if {'week', 'mngt_unit_rk', 'ai_usage_flg', 'is_intern_flg'} <= _acols:
    _hub_q(f"""
drop table if exists {HUB_P}_aiw;
create table {HUB_P}_aiw as
select a.week::date as week, a.mngt_unit_rk::text as node_rk,
       count(distinct case when coalesce(a.is_intern_flg::text, '0') <> '1' then a.person_id::text end)::float8 as ai_heads,
       count(distinct case when coalesce(a.ai_usage_flg::text, '0') = '1'
                             and coalesce(a.is_intern_flg::text, '0') <> '1' then a.person_id::text end)::float8 as ai_wau,
       (100.0 * count(distinct case when coalesce(a.ai_usage_flg::text, '0') = '1'
                                      and coalesce(a.is_intern_flg::text, '0') <> '1' then a.person_id::text end)
              / nullif(count(distinct case when coalesce(a.is_intern_flg::text, '0') <> '1'
                                             then a.person_id::text end), 0))::float8 as ai_pen
from {HUB_AI_SRC} a
where coalesce(a.mngt_unit_rk::text, '') <> ''
  and a.week::date >= (('{_gs}'::date) - interval '4 month')
group by 1, 2
distributed by (node_rk)""")
    print(f"[OK] {HUB_P}_aiw: {_hub_q(f'select count(*) as n, count(distinct node_rk) as u, max(week) as w from {HUB_P}_aiw')[['n', 'u', 'w']].iloc[0].to_dict()}")
else:
    _hub_q(f"""
drop table if exists {HUB_P}_aiw;
create table {HUB_P}_aiw (week date, node_rk text, ai_heads float8, ai_wau float8, ai_pen float8)
distributed by (node_rk)""")
    print(f'[WARN] {HUB_AI_SRC}: нет таблицы или колонок — {HUB_P}_aiw пустая, AI в отчёте «нет данных» (проверить синхронизацию таблицы в GP)')

# 12б (поставка 106, владелец): «Кто пользуется?» и «Как пользуется?» — из той же недельной витрины, за ПОСЛЕДНЮЮ ПОЛНУЮ
#     неделю (понедельник + 6 дней <= дата данных; иначе неделя перед ней — так же неделю выбирает чарт). Витрина
#     teampulse_hub_aix — узел × ключ × значение → n. Человек в узле — одна строка (его поля в строках пар пути одинаковы,
#     берём max); люди — count distinct, сообщения — сумма по людям (предагрегаты источника по строкам не суммируются).
#     Ключи: aik — неделя; стажёры: aih (всего), aiu (с AI), ait (инструмент → стажёров), aif (дней в неделю → стажёров
#     с AI); без стажёров: aph (покраска → людей), apt («покраска|инструмент» → людей), aut (инструмент → людей),
#     auf (дней в неделю → людей с AI), aun (инструментов: 1, 2, 3, 4+ → людей с AI), aum (сообщений инструментам
#     разработчика), auc (из них классифицировано), auk (задача → сообщений); 07.11: aur / air — ранг инструмента
#     (без стажёров / у стажёров: топ-10 чарта), auo / aio — людей с инструментами вне топ-10 (группа «Остальное», каждый
#     один раз), apo — то же по покраске. Поставка 112: ash / asu — «разрез|значение» → людей / с AI без стажёров
#     (p покраска, s сеньорность, g грейд, t стаж, sp специализация; атрибуты — из таблицы отчёта по mdm_employee_rk на
#     последний месяц, человек не найден — «-»). Поставка 113-б: aip — «стажёр|с AI|покраска|сеньорность|грейд|стаж|специализация»
#     → людей (вместе со стажёрами): по нему чарт пересчитывает разрезы при клике (кросс-фильтр). Массивы tools / tasks / task_messages —
#     как массивы GP (text[]; строка вида {a,b} тоже читается). Смысл колонок сообщений сверить на проде
_xcols = {'paint', 'tools', 'tools_count', 'usage_days_in_week', 'tasks', 'task_messages', 'total_tasks_messages',
          'total_copilot_nestor_messages'}
if {'week', 'mngt_unit_rk', 'ai_usage_flg', 'is_intern_flg'} | _xcols <= _acols:
    _clean = lambda e: f"coalesce(nullif(translate(trim({e}), E'\\t\\n|', '  /'), ''), '-')"
    _hub_q(f"""
drop table if exists {HUB_P}_aix;
create table {HUB_P}_aix as
with cw as (
    select case when max(week)::date + 6 <= '{_dt}'::date then max(week)::date else max(week)::date - 7 end as w
    from {HUB_AI_SRC}
), b as (
    select a.mngt_unit_rk::text as node_rk, a.person_id::text as pid,
           max(case when coalesce(a.is_intern_flg::text, '0') = '1' then 1 else 0 end) as it,
           max(case when coalesce(a.ai_usage_flg::text, '0') = '1' then 1 else 0 end) as u,
           max({_clean('a.paint::text')}) as paint,
           max(coalesce(a.usage_days_in_week, 0))::int as days,
           max(coalesce(a.tools_count, 0))::int as ntools,
           max(coalesce(a.total_copilot_nestor_messages, 0))::float8 as msgs,
           max(coalesce(a.total_tasks_messages, 0))::float8 as cls,
           max(a.tools::text) as tools, max(a.tasks::text) as tasks, max(a.task_messages::text) as tmsg
    from {HUB_AI_SRC} a, cw
    where a.week::date = cw.w and coalesce(a.mngt_unit_rk::text, '') <> ''
    group by 1, 2
), pa as (   -- поставка 112: атрибуты человека на последний месяц отчёта (как разрезы численности hub · 4) — по mdm_employee_rk
    select s.mdm_employee_rk::text as pid,
           max({_clean('s.seniority::text')}) as sen, max({_clean('s.grade::text')}) as grd,
           max({_clean('s.experience_group_nm::text')}) as ten, max({_clean('s.specialization::text')}) as spc
    from {HUB_SRC} s
    where s.report_month = (select max(report_month) from {HUB_SRC}) and s.mdm_employee_rk is not null
    group by 1
), bs as (   -- поставка 112: «Кто пользуется» — каждый человек без стажёров один раз в каждом разрезе; нет в отчёте — «-»
    select b.node_rk, b.pid, b.u,
           unnest(array['p', 's', 'g', 't', 'sp']) as d,
           unnest(array[b.paint, coalesce(pa.sen, '-'), coalesce(pa.grd, '-'), coalesce(pa.ten, '-'), coalesce(pa.spc, '-')]) as v
    from b left join pa on pa.pid = b.pid
    where b.it = 0
), bp as (   -- поставка 113-б: «Кто пользуется» с кросс-фильтром — сочетание разрезов человека (стажёр, пользуется ли AI, покраска,
            -- сеньорность, грейд, стаж, специализация) — сколько людей; чарт берёт его только у выбранного юнита (датасет)
    select b.node_rk, b.pid, b.it::text || '|' || b.u::text || '|' || b.paint || '|' || coalesce(pa.sen, '-') || '|' ||
           coalesce(pa.grd, '-') || '|' || coalesce(pa.ten, '-') || '|' || coalesce(pa.spc, '-') as cv
    from b left join pa on pa.pid = b.pid
), bt as (
    select b.node_rk, b.pid, b.it, b.paint, {_clean('(b.tools::text[])[i]')} as tool
    from b, generate_series(1, coalesce(array_length(b.tools::text[], 1), 0)) i
), bk as (
    select b.node_rk, {_clean('(b.tasks::text[])[i]')} as task, coalesce((b.tmsg::text[])[i], '0')::float8 as n
    from b, generate_series(1, coalesce(array_length(b.tasks::text[], 1), 0)) i
    where b.it = 0
), rk as (   -- 07.11 (AI-итерация, п. 3): ранг инструмента в узле — топ-10 чарта и группа «Остальное» по нему
    select node_rk, it, tool, row_number() over (partition by node_rk, it order by count(distinct pid) desc, tool) as r
    from bt group by 1, 2, 3
), bo as (   -- люди с инструментами вне топ-10 — один раз, сколько бы таких инструментов у них ни было
    select bt.node_rk, bt.it, bt.paint, bt.pid from bt join rk on rk.node_rk = bt.node_rk and rk.it = bt.it and rk.tool = bt.tool
    where rk.r > 10
)
select node_rk, 'aik'::text as k, (select w from cw)::text as v, 1::float8 as n from b group by 1
union all select node_rk, 'aih', '', count(distinct pid) from b where it = 1 group by 1
union all select node_rk, 'aiu', '', count(distinct pid) from b where it = 1 and u = 1 group by 1
union all select node_rk, 'ait', tool, count(distinct pid) from bt where it = 1 group by 1, 3
union all select node_rk, 'aif', days::text, count(distinct pid) from b where it = 1 and u = 1 and days > 0 group by 1, 3
union all select node_rk, 'aph', paint, count(distinct pid) from b where it = 0 group by 1, 3
union all select node_rk, 'apt', paint || '|' || tool, count(distinct pid) from bt where it = 0 group by 1, 3
union all select node_rk, 'aut', tool, count(distinct pid) from bt where it = 0 group by 1, 3
union all select node_rk, 'auf', days::text, count(distinct pid) from b where it = 0 and u = 1 and days > 0 group by 1, 3
union all select node_rk, 'aun', case when ntools > 0 then least(ntools, 4) else 0 end::text, count(distinct pid) from b where it = 0 and u = 1 group by 1, 3
union all select node_rk, 'aum', '', sum(msgs) from b where it = 0 group by 1
union all select node_rk, 'auc', '', sum(cls) from b where it = 0 group by 1
union all select node_rk, 'auk', task, sum(n) from bk group by 1, 3
union all select node_rk, case when it = 1 then 'air' else 'aur' end, tool, r::float8 from rk
union all select node_rk, 'auo', '', count(distinct pid) from bo where it = 0 group by 1
union all select node_rk, 'apo', paint, count(distinct pid) from bo where it = 0 group by 1, 3
union all select node_rk, 'aio', '', count(distinct pid) from bo where it = 1 group by 1
union all select node_rk, 'ash', d || '|' || v, count(distinct pid) from bs group by 1, 3
union all select node_rk, 'asu', d || '|' || v, count(distinct pid) from bs where u = 1 group by 1, 3
union all select node_rk, 'aip', cv, count(distinct pid) from bp group by 1, 3
distributed by (node_rk)""")
    print(f"[OK] {HUB_P}_aix: {_hub_q(f'select count(*) as n, count(distinct node_rk) as u, max(case when k = $$aik$$ then v end) as w from {HUB_P}_aix')[['n', 'u', 'w']].iloc[0].to_dict()}")
else:
    _hub_q(f"""
drop table if exists {HUB_P}_aix;
create table {HUB_P}_aix (node_rk text, k text, v text, n float8)
distributed by (node_rk)""")
    print(f'[WARN] {HUB_AI_SRC}: нет колонок разрезов ({", ".join(sorted(_xcols - _acols))}) — {HUB_P}_aix пустая, «Кто» и «Как пользуется» условные')
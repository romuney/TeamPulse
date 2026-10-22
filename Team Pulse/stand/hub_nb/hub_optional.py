# =============================================================================
# TeamPulse Hub · 2. Логины руководителей и AI — необязательные источники (поставка 58)
# Остальная сборка — параграфы gp (SQL). Здесь Python, потому что сначала нужно проверить, есть ли
# источник и его колонки, — SQL так не умеет. Два коротких запроса; тяжёлых шагов здесь нет.
# Нет источника — таблица пустая, отчёт работает: логины пустые, AI «в разработке».
#   teampulse_hub_head  юнит → логин руководителя на дату данных (для teampulse_hub_unit, параграф «hub · 3»)
#   teampulse_hub_login сотрудник → логин на ту же дату (детализация переводов, параграф «hub · 5», поставка 63)
#   teampulse_hub_ai    узел × месяц: WAU AI-инструментов и проникновение (по юниту и компании)
# =============================================================================
from dal_client import query as dal

HUB_P = 'teampulse_hub'
HUB_SRC = 'all_metrics_with_performance_and_office_traffic_and_grt'
# логин руководителя (как в HRBP HUB): первая таблица, где есть все колонки, — источник TP 2.0,
# иначе структура сотрудников (её берёт HRBP HUB)
HUB_HEAD_SRC = [('usr_cross_data.hr_executive_proteus', 'calendar_dt'),
                ('prod_v_emart.mdm_employee_structure_d', 'business_dt')]
HUB_HEAD_COLS = {'mdm_employee_rk', 'management_head_flg', 'ad_login', 'management_head_ad_login'}
HUB_AI_SRC = 'usr_mlpa.ai_bi_all_copilots_usage_digest_monthly'


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


_cal = _hub_q(f'select lm, grid_start from {HUB_P}_cal').iloc[0]
_lm, _gs = str(_cal['lm'])[:10], str(_cal['grid_start'])[:10]

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
distributed by (unit_rk)""")
    print(f"[OK] {HUB_P}_head: логины из {_t} на {_hdt} — "
          f"{_hub_q(f'select count(*) as n from {HUB_P}_head')['n'].iloc[0]} юнитов")
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
create table {HUB_P}_head as select ''::text as unit_rk, ''::text as head_login where false
distributed by (unit_rk)""")
    _hub_q(f"""
drop table if exists {HUB_P}_login;
create table {HUB_P}_login as select 0::bigint as erk, ''::text as login where false
distributed by (erk)""")
    print(f'[WARN] логинов руководителей нет ни в одном источнике {[t for t, _ in HUB_HEAD_SRC]} — логины пустые')

# 12. AI-инструменты — как в прод-ноутбуке HQ: WAU и проникновение посчитаны в источнике по юниту (строка
#     юнита — всё его поддерево), здесь берутся у своего узла. Корню отчёта, если в источнике его нет, —
#     сумма WAU верхнего уровня источника и проникновение по компании. Фильтры среза на AI не действуют
_acols = _hub_cols(HUB_AI_SRC)
if {'month', 'mngt_unit_rk', 'avg_wau', 'avg_penetration_unit_pct'} <= _acols:
    _aco = 'a.avg_penetration_company_pct' if 'avg_penetration_company_pct' in _acols else 'null::float8'
    _alv = 'a.lvl' if 'lvl' in _acols else '0'
    _hub_q(f"""
drop table if exists {HUB_P}_ai;
create table {HUB_P}_ai as
with a as (
    select date_trunc('month', a.month::date)::date as report_month, a.mngt_unit_rk::text as node_rk,
           max(a.avg_wau)::float8 as ai_wau, max(a.avg_penetration_unit_pct)::float8 as ai_pen,
           max({_aco})::float8 as ai_pen_co, min({_alv}) as lv
    from {HUB_AI_SRC} a
    where a.month::date between '{_gs}'::date and ('{_lm}'::date + interval '1 month' - interval '1 day')
    group by 1, 2
)
select report_month, node_rk, ai_wau, ai_pen, ai_pen_co from a
union all
select a.report_month, r.unit_rk, sum(a.ai_wau), max(a.ai_pen_co), max(a.ai_pen_co)
from a
cross join (select rk as unit_rk from {HUB_P}_node where prk = '') r
where a.lv = (select min(lv) from a a2 where a2.report_month = a.report_month)
  and not exists (select 1 from a a3 where a3.node_rk = r.unit_rk)
group by 1, 2
distributed by (node_rk)""")
    print(f"[OK] {HUB_P}_ai: {_hub_q(f'select count(*) as n from {HUB_P}_ai')['n'].iloc[0]} строк")
else:
    _hub_q(f"""
drop table if exists {HUB_P}_ai;
create table {HUB_P}_ai (report_month date, node_rk text, ai_wau float8, ai_pen float8, ai_pen_co float8)
distributed by (node_rk)""")
    print(f'[WARN] {HUB_AI_SRC}: нет таблицы или колонок — {HUB_P}_ai пустая, AI в отчёте «в разработке»')

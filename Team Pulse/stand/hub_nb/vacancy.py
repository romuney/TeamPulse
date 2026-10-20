# =============================================================================
# Вакансии — снимок «структура × вакансии» (structure_x_vacancy) до витрины отчёта.
# Логика — как в TP 2.0 (параграф vacancy_daily: vacancy_by_unit и соединение с org_structure),
# но плоско, без JSON: строка — юнит × месяц × разрезы вакансии, меры — числами.
#   закрыто     close_flg = 1                                                 (за месяц)
#   открыто     в работе на конец месяца: end_of_month_flg = 1 и статус из группы «Согласованные»;
#               у незакрытого месяца — на последний загруженный день (как численность, 20.10)
#   новые       issue_day = approved_dt — согласованы в этом месяце
#   срок        у закрытых: дней от согласования до закрытия (сумма и число — среднее складывается)
# Каждая вакансия считается один раз в юните и месяце (count distinct issue_full_nm, как в TP 2.0).
# Отличие от TP 2.0: там org_structure s LEFT JOIN vacancy_by_unit v — вакансии юнита, где в этом
# месяце нет людей (новый юнит, все места пусты), терялись. Здесь основа — вакансии, а соединение
# со структурой — признак in_structure (1 — у юнита в этом месяце есть люди); 0е и проверки ниже
# показывают, сколько таких вакансий. Узлы и путь — в build_hub (шаг 11, teampulse_hub_vacancy).
# =============================================================================
from dal_client import query as dal

VAC_SRC = 'usr_cross_data.vacancy_daily'
VAC_OK_GROUP = 'Согласованные'        # группа статуса «в работе» (status_name_chng_group)


def build_structure_x_vacancy(
    source: str = VAC_SRC,
    structure: str = 'org_structure',
    target: str = 'structure_x_vacancy',
    n_levels: int = 11,
    debug: bool = False,
):
    q = lambda sql: dal.get_df(datasource='gp', query=sql)
    try:
        cols = set() if debug else _source_cols(_qualified(source))
    except Exception:
        cols = set()
    has = lambda c: debug or c in cols
    tgt = _ident(target)
    # источника нет (нет доступа, другая схема) — пустая таблица той же формы: отчёт работает,
    # вакансии остаются «в разработке»
    empty = f"""
drop table if exists {tgt};
create table {tgt} (report_month date, mng_unit_rk text, leaf_lvl int, unit_path text, in_structure int,
    channel text, search_reason text, cand_lvl text, position_lvl text, specialization text, status text,
    close_cnt bigint, open_cnt bigint, new_cnt bigint, ttf_days bigint, ttf_cnt bigint)
distributed by (mng_unit_rk)"""
    need = {'issue_full_nm', 'issue_day', 'close_flg', 'end_of_month_flg', 'approved_dt',
            'status_name_chng_group', 'resource_level_1_rk'}
    if not debug and not need <= cols:
        print(f'[WARN] {source}: нет колонок {sorted(need - cols)} — {target} пустая')
        q(empty)
        return
    lv = [i for i in range(1, n_levels + 1) if has(f'resource_level_{i}_rk')]
    rk = lambda i: f"nullif(nullif(vd.resource_level_{i}_rk::text, '-'), '')"
    leaf = 'case ' + ' '.join(f'when {rk(i)} is not null then {i}' for i in reversed(lv)) + ' end'
    unit = 'case ' + ' '.join(f'when {rk(i)} is not null then {rk(i)}' for i in reversed(lv)) + ' end'
    path = ("array_to_string((ARRAY[" + ', '.join(f"coalesce({rk(i)}, '-')" for i in lv) + f"])[1:{leaf}], '|')")
    txt = lambda c, alias: f"coalesce(nullif(vd.{c}::text, ''), '-') as {alias}" if has(c) else f"'-'::text as {alias}"
    flg = lambda c: f"coalesce(vd.{c}::int, 0)" if has(c) else '0'
    sql = f"""
drop table if exists {tgt};
create table {tgt} as
with mx as (select max(issue_day)::date as last_dt from {_qualified(source)}),
v as (
    select vd.issue_full_nm::text as vac, vd.issue_day::date as dd, date_trunc('month', vd.issue_day)::date as report_month,
           vd.approved_dt::date as adt, {flg('close_flg')} as cf,
           -- в работе на конец месяца; у незакрытого месяца — на последний загруженный день
           (({flg('end_of_month_flg')} = 1 or vd.issue_day::date = (select last_dt from mx))
            and vd.status_name_chng_group = '{VAC_OK_GROUP}')::int as of_,
           (vd.issue_day::date = vd.approved_dt::date)::int as nf,
           {leaf} as leaf_lvl, {unit} as mng_unit_rk, {path} as unit_path,
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
    from {_qualified(source)} vd
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
           from {_qualified(structure)}) s
       on s.report_month = d.report_month and s.mng_unit_rk = d.mng_unit_rk
distributed by (mng_unit_rk)"""
    if debug:
        print(sql)
        return
    q(sql)
    r = q(f"""select count(*) as n, coalesce(sum(open_cnt), 0) as o, coalesce(sum(close_cnt), 0) as c,
                     coalesce(sum(case when in_structure = 0 then open_cnt + close_cnt end), 0) as lost
              from {tgt}""").iloc[0]
    print(f'[OK] {target}: {int(r.n)} строк; открыто (сумма по месяцам) {int(r.o)}, закрыто {int(r.c)}; '
          f'в юнитах без людей — {int(r.lost)} (LEFT JOIN от структуры их бы потерял)')

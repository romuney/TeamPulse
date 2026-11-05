-- ============================================================================
-- 0з. Сверка снимка вакансий structure_x_vacancy с формулами TP 2.0 (параграф vacancy_daily) —
-- Helicopter, параграф gp, после запуска ноутбука «1. Helicopter — ноут TeamPulse Hub.yaml».
-- Ответ — в чат (строка на месяц сетки; чисел людей нет — только счёт вакансий).
--   tp20_*   формулы TP 2.0 прямо по usr_cross_data.vacancy_daily: count(distinct issue_full_nm) по юниту
--            и месяцу, сумма по юнитам — закрытые (close_flg = 1), в работе на конец месяца
--            (end_of_month_flg = 1 и группа «Согласованные»), новые (issue_day = approved_dt)
--   our_*    снимок structure_x_vacancy — должен совпасть с tp20_* во всех месяцах, кроме
--            открытых текущего месяца: у незакрытого месяца снимок берёт последний загруженный день
--            (end_of_month_flg ещё не стоит — в TP 2.0 там ноль)
--   lost_*   вакансии юнитов, где в этом месяце нет людей: соединение TP 2.0 «org_structure s LEFT JOIN
--            vacancy_by_unit v» их теряло, снимок их держит (in_structure = 0)
--   no_unit  строки источника без юнита (все resource_level_N_rk пустые) — не попадают никуда
-- Проверено на стенде PostgreSQL (stand/nb_tp20.py --hub): расхождений tp20 / our нет.
-- ============================================================================
with v as (
    select issue_full_nm, issue_day::date as dd, date_trunc('month', issue_day)::date as m,
           coalesce(close_flg::int, 0) as cf, coalesce(end_of_month_flg::int, 0) as ef,
           status_name_chng_group as sg, approved_dt::date as adt,
           coalesce(nullif(nullif(resource_level_11_rk::text, '-'), ''), nullif(nullif(resource_level_10_rk::text, '-'), ''),
                    nullif(nullif(resource_level_9_rk::text, '-'), ''), nullif(nullif(resource_level_8_rk::text, '-'), ''),
                    nullif(nullif(resource_level_7_rk::text, '-'), ''), nullif(nullif(resource_level_6_rk::text, '-'), ''),
                    nullif(nullif(resource_level_5_rk::text, '-'), ''), nullif(nullif(resource_level_4_rk::text, '-'), ''),
                    nullif(nullif(resource_level_3_rk::text, '-'), ''), nullif(nullif(resource_level_2_rk::text, '-'), ''),
                    nullif(nullif(resource_level_1_rk::text, '-'), '')) as u
    from usr_cross_data.vacancy_daily
    where close_flg = 1 or end_of_month_flg = 1 or issue_day::date = approved_dt::date
),
tp as (
    select m, sum(c) as tp20_close, sum(o) as tp20_open, sum(n) as tp20_new
    from (select m, u,
                 count(distinct case when cf = 1 then issue_full_nm end) as c,
                 count(distinct case when ef = 1 and sg = 'Согласованные' then issue_full_nm end) as o,
                 count(distinct case when dd = adt then issue_full_nm end) as n
          from v where u is not null group by m, u) x
    group by m
),
nu as (select m, count(distinct issue_full_nm) as no_unit from v where u is null group by m),
our as (
    select report_month as m, sum(close_cnt) as our_close, sum(open_cnt) as our_open, sum(new_cnt) as our_new,
           sum(case when in_structure = 0 then open_cnt else 0 end) as lost_open,
           sum(case when in_structure = 0 then close_cnt else 0 end) as lost_close
    from structure_x_vacancy group by report_month
)
select coalesce(tp.m, our.m) as month,
       tp.tp20_close, our.our_close, tp.tp20_open, our.our_open, tp.tp20_new, our.our_new,
       our.lost_open, our.lost_close, coalesce(nu.no_unit, 0) as no_unit,
       case when coalesce(tp.tp20_close, 0) = coalesce(our.our_close, 0) and coalesce(tp.tp20_new, 0) = coalesce(our.our_new, 0)
                 and (coalesce(tp.tp20_open, 0) = coalesce(our.our_open, 0) or coalesce(tp.m, our.m) = (select max(m) from v))
            then 'сходится' else 'РАСХОЖДЕНИЕ' end as verdict
from tp
full join our on our.m = tp.m
left join nu on nu.m = coalesce(tp.m, our.m)
order by 1;

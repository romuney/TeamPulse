-- ============================================================================
-- 0п. Мониторинг работы и T-рост: почему число отчёта не сходится с мастер-источником (28.10, п. 3).
-- Helicopter, параграф gp, после ноутбука поставки 71. Ответ — в чат, не в репозиторий: в нём числа.
--
-- Что сделать: в блоке p вписать месяц (последний закрытый, первое число) и, если сверяете подразделение, —
-- его ключ (mng_unit_rk; пусто — вся компания). Запустить оба запроса и прислать таблицы вместе с числами
-- мастер-источника и названием, откуда они (дашборд, вкладка, фильтры, месяц).
--
-- Каждый запрос считает одно и то же пятью способами:
--   А  источник целиком (performance_metric_d / заявки rost_info), без численности ноутбука
--   Б  только люди численности ноутбука в этом месяце, все их строки (у перешедшего внутри месяца — две)
--   В  Б, одна строка человека в месяце (last_row_flg = 1) — так считает ноутбук поставки 71
--   Г  В + тип численности «Активная» — так считает отчёт по умолчанию (все покраски)
--   Д  Г + покраска HQ — так считают дашборды HQ
-- Какая строка совпала с мастер-источником — та и есть его правило: скажите — переведу отчёт на него.
-- ============================================================================

-- 1. Мониторинг: люди с 2–5 и больше 5 прогулами, днями работы в выходной, с долей звонков 20–30% / 30–50% / 50%+
--    и средние часы рабочего дня за месяц
with p (m, unit_rk) as (
    values (date '2026-09-01', null::text)
),
d as (
    select x.mdm_employee_rk,
           sum(case when x.working_balance = -1 then 1 else 0 end) as ab,
           sum(case when x.working_balance = 1 then 1 else 0 end) as wo,
           sum(case when x.plan_working_day_flg = 1 then x.duration_hour end) / nullif(sum(x.plan_working_day_flg), 0) as hrs,
           100.0 * sum(case when x.plan_working_day_flg = 1 then x.talk_call_duration_h end)
               / nullif(sum(case when x.plan_working_day_flg = 1 then x.duration_hour end), 0) as sh
    from prod_v_sse_crossdata.performance_metric_d x, p
    where date_trunc('month', x.calendar_dt) = p.m
    group by x.mdm_employee_rk
),
r as (
    select s.mdm_employee_rk, s.last_row_flg, s.act_type_nm, s.paint_cd
    from all_metrics_with_performance_added s, p
    where s.report_month = p.m and s.leaf_lvl > 0
      and (p.unit_rk is null or p.unit_rk in (s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
           s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text, s.lvl9_rk::text, s.lvl10_rk::text,
           s.lvl11_rk::text))
),
v as (
    select 'А источник целиком' as variant, d.* from d
    union all
    select 'Б численность ноутбука, все строки', d.* from d join r using (mdm_employee_rk)
    union all
    select 'В одна строка человека', d.* from d join r using (mdm_employee_rk) where r.last_row_flg = 1
    union all
    select 'Г + «Активная»', d.* from d join r using (mdm_employee_rk) where r.last_row_flg = 1 and r.act_type_nm = 'Активная'
    union all
    select 'Д + покраска HQ', d.* from d join r using (mdm_employee_rk)
    where r.last_row_flg = 1 and r.act_type_nm = 'Активная' and lower(coalesce(r.paint_cd, '')) = 'hq'
)
select variant, count(*) as people,
       sum((ab between 2 and 5)::int) as absence_2_5, sum((ab > 5)::int) as absence_5plus,
       sum((wo between 2 and 5)::int) as weekend_2_5, sum((wo > 5)::int) as weekend_5plus,
       sum((round(sh, 1) >= 20 and round(sh, 1) <= 30 and hrs > 0)::int) as talk_20_30,
       sum((round(sh, 1) > 30 and round(sh, 1) <= 50 and hrs > 0)::int) as talk_30_50,
       sum((round(sh, 1) > 50 and hrs > 0)::int) as talk_50plus,
       round(avg(case when hrs > 0 then hrs end)::numeric, 2) as hours_per_day
from v
group by variant
order by variant;

-- 2. T-рост: статусы роста людей на месяц p.m (заявки за 12 месяцев до него) и успешно закрытые заявки за 12 месяцев
with p (m, unit_rk) as (
    values (date '2026-09-01', null::text)
),
a as (
    select ri.mdm_employee_rk,
           max((ri.is_approved = 1 and ri.month > p.m - interval '12 month' and ri.month <= p.m)::int) as ok12,
           max((ri.is_inprogress = 1)::int) as act,
           max((ri.is_declined = 1 and ri.month > p.m - interval '12 month' and ri.month <= p.m)::int) as dcl12,
           sum((ri.is_approved = 1 and ri.grade_change_application_flg = 1
                and ri.month > p.m - interval '12 month' and ri.month <= p.m)::int) as ok_grade,
           sum((ri.is_approved = 1 and ri.specialization_change_application_flg = 1
                and ri.month > p.m - interval '12 month' and ri.month <= p.m)::int) as ok_spec
    from rost_info ri, p
    group by ri.mdm_employee_rk
),
r as (
    select s.mdm_employee_rk, s.last_row_flg, s.act_type_nm, s.paint_cd
    from all_metrics_with_performance_added s, p
    where s.report_month = p.m and s.leaf_lvl > 0 and coalesce(s.hc_total_cnt, 0) > 0
      and (p.unit_rk is null or p.unit_rk in (s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
           s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text, s.lvl9_rk::text, s.lvl10_rk::text,
           s.lvl11_rk::text))
),
v as (
    select 'А источник целиком' as variant, a.* from a
    union all
    select 'Б численность ноутбука, все строки', a.* from r left join a using (mdm_employee_rk)
    union all
    select 'В одна строка человека', a.* from r left join a using (mdm_employee_rk) where r.last_row_flg = 1
    union all
    select 'Г + «Активная»', a.* from r left join a using (mdm_employee_rk) where r.last_row_flg = 1 and r.act_type_nm = 'Активная'
    union all
    select 'Д + покраска HQ', a.* from r left join a using (mdm_employee_rk)
    where r.last_row_flg = 1 and r.act_type_nm = 'Активная' and lower(coalesce(r.paint_cd, '')) = 'hq'
)
select variant, count(*) as people,
       sum((ok12 = 1 and act = 1)::int) as again,
       sum((ok12 = 1 and coalesce(act, 0) = 0)::int) as done,
       sum((coalesce(ok12, 0) = 0 and act = 1)::int) as first,
       sum((coalesce(ok12, 0) = 0 and coalesce(act, 0) = 0 and dcl12 = 1)::int) as denied,
       sum((coalesce(ok12, 0) = 0 and coalesce(act, 0) = 0 and coalesce(dcl12, 0) = 0)::int) as no_application,
       sum(coalesce(ok_grade, 0)) as approved_grade_12m, sum(coalesce(ok_spec, 0)) as approved_spec_12m
from v
group by variant
order by variant;

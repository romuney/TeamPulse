-- =============================================================================
-- TeamPulse Hub · 3в. Недельный мониторинг рабочего времени
-- teampulse_hub_series_week — узел × неделя × срез: средняя длительность рабочего дня (ч), доля звонков (%),
-- число людей в категории недели (переработка / норма / недоработка / grey).
-- Логика — мастер «Monitoring work activity (1)»: рабочий день = будни без расписания или плановый + тип дня
-- «Работа»; часы дня — reduced_duration_hour, если >7, иначе duration_hour; доля звонков — avg(звонки)/avg(часы)*100;
-- категория недели — пересчитывается из подневного performance_category по числу рабочих дней (как cte_week).
-- Исходник — параграф владельца 26.11 («TeamPulse_Hub_week.yaml»). Правки 26.11 (решения владельца):
--   1) неделя — целиком (Пн–Вс, date_trunc('week')): человек — одна строка на неделю, категория, часы и доля звонков —
--      по всем рабочим дням недели. Было: неделя на стыке месяцев делилась по месяцам — человек считался дважды,
--      часы и доля усреднялись по половинам, категория выбиралась по половине недели (стенд: PG-синтетика 29.12–04.01);
--   2) юнит и срезы человека — на конец месяца ВОСКРЕСЕНЬЯ недели; у ещё не начавшегося в данных месяца — последний
--      месяц данных (иначе текущая неделя на стыке месяцев выпадала бы до следующей сборки);
--   3) суммы вместо средних для отчёта: wt_sum / wt_n — сумма и число средних часов людей, tk_sum / tk_n — то же для
--      доли звонков. Отчёт складывает срезы фильтров и узлы и делит: среднее по людям под любыми фильтрами точно.
--      Колонки work_time_h и share_talk (средние по срезу) — как в исходнике, для чтения таблицы глазами.
-- Неделя в источнике не помечена как неполная: отчёт считает неполной неделю, чьё воскресенье позже даты данных.
-- =============================================================================
drop table if exists teampulse_hub_series_week;
create table teampulse_hub_series_week as
with perf_d as (
    select
        pmd.mdm_employee_rk
        , date_trunc('week', pmd.calendar_dt)::date as report_week
        , extract(dow from pmd.calendar_dt) as weekday
        , ec.attendance_group_nm as date_type_group_nm
        , decode(ec.attendance_group_nm, 'Работа', 1, 0) as plan_working_day_flg
        , case when pmd.reduced_duration_hour > 7 then pmd.reduced_duration_hour else pmd.duration_hour end as duration_hour_correct
        , pmd.talk_call_duration_h
        , pmd.performance_category
        , case
              when pmd.performance_category in ('super_high','super_low') then '1'
              when pmd.performance_category in ('high','low') then '2'
              when pmd.performance_category in ('normal') then '3'
              when pmd.performance_category in ('grey') then '4'
          end as convert_category
    from prod_v_sse_crossdata.performance_metric_d pmd
    left join prod_v_hrmart.mdm_employee_attendance ec
        on ec.mdm_employee_rk = pmd.mdm_employee_rk and ec.attendance_dt = pmd.calendar_dt
    where pmd.calendar_dt >= date_trunc('year', current_date - interval '1 year')
)
, wd as (  -- рабочий день — как в мастер-мониторинге
    select
        mdm_employee_rk, report_week, weekday, date_type_group_nm, plan_working_day_flg,
        duration_hour_correct, talk_call_duration_h, performance_category, convert_category,
        (((weekday in (1,2,3,4,5) and plan_working_day_flg is null) or plan_working_day_flg = 1)
          and date_type_group_nm = 'Работа')::int as wd_flg
    from perf_d
)
, cat_cnt as (  -- число рабочих дней категории за всю неделю
    select mdm_employee_rk, report_week, performance_category, convert_category, count(*) as cnt
    from wd
    where wd_flg = 1
    group by 1, 2, 3, 4
)
, cat_week as (  -- категория недели: чаще всего по рабочим дням (связка — экстремальная первая), как cte_week
    select distinct on (mdm_employee_rk, report_week)
        mdm_employee_rk, report_week, performance_category as cat_week
    from cat_cnt
    order by mdm_employee_rk, report_week, cnt desc, convert_category
)
, person_week as (  -- метрики человека-недели (avg/avg, как в мастере), неделя целиком
    select
        w.mdm_employee_rk
        , w.report_week
        , avg(w.duration_hour_correct) as work_time_avg
        , avg(w.talk_call_duration_h) / nullif(avg(w.duration_hour_correct), 0) * 100 as share_talk
        , cw.cat_week
    from wd w
    join cat_week cw
        on cw.mdm_employee_rk = w.mdm_employee_rk and cw.report_week = w.report_week
    where w.wd_flg = 1
    group by w.mdm_employee_rk, w.report_week, cw.cat_week
)
, lm as (  -- последний месяц данных — для недели, чьё воскресенье уже в следующем месяце
    select max(report_month)::date as lm
    from all_metrics_with_performance_and_office_traffic_and_grt
    where last_row_flg = 1 and leaf_lvl > 0
)
, people_week as (
    select
        pw.mdm_employee_rk
        , pw.report_week
        , pw.work_time_avg
        , pw.share_talk
        , pw.cat_week
        , m.mng_unit_rk
        , m.leaf_lvl
        , coalesce(nullif(m.paint_cd::text, ''), '-') as paint_c
        , coalesce(nullif(m.emp_specialization_it_code::text, ''), '-') as it_c
        , case when m.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c
        , coalesce(nullif(trim(m.act_type_nm::text), ''), '-') as act_c
        , (select pre from teampulse_hub_cal) || coalesce(u.cp,
            array_to_string((ARRAY[m.lvl1_rk::text, m.lvl2_rk::text, m.lvl3_rk::text, m.lvl4_rk::text,
                               m.lvl5_rk::text, m.lvl6_rk::text, m.lvl7_rk::text, m.lvl8_rk::text,
                               m.lvl9_rk::text, m.lvl10_rk::text, m.lvl11_rk::text])[1:m.leaf_lvl], '|')) as cp
    from person_week pw
    cross join lm
    join all_metrics_with_performance_and_office_traffic_and_grt m
        on m.mdm_employee_rk = pw.mdm_employee_rk
        and m.report_month = least(date_trunc('month', pw.report_week + 6)::date, lm.lm)
        and m.last_row_flg = 1 and m.leaf_lvl > 0
    left join teampulse_hub_upath u on u.unit_rk = m.mng_unit_rk::text
)
select e.node_rk, e.report_week, e.paint_c as paint_cd, e.it_c as it_cd, e.staff_c as staff_cd,
       e.act_c as act_cd,
       count(*) as hc_cnt,
       round(avg(e.work_time_avg), 2) as work_time_h,
       round(avg(e.share_talk), 1) as share_talk,
       sum(e.work_time_avg) as wt_sum,
       count(e.work_time_avg) as wt_n,
       sum(e.share_talk) as tk_sum,
       count(e.share_talk) as tk_n,
       sum((e.cat_week in ('super_high', 'high'))::int) as over_cnt,
       sum((e.cat_week = 'normal')::int) as norm_cnt,
       sum((e.cat_week in ('low', 'super_low'))::int) as under_cnt,
       sum((e.cat_week = 'grey' or e.cat_week is null)::int) as grey_cnt
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk
    from people_week x
) e
group by 1, 2, 3, 4, 5, 6
distributed by (node_rk);

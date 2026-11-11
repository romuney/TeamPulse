-- =============================================================================
-- TeamPulse Hub
-- перформанс (категории за месяц) и мониторинг по дням (27.10): средняя длительность рабочего дня, прогулы,
-- работа в выходной, звонки и доля разговоров, сегменты. Поставка 71 — исправлено: деление на число плановых рабочих
-- дней через nullif (у человека, который в месяце работал только в выходные, оно 0 — параграф падал); мониторинг по
-- дням — к одной строке человека в месяце (last_row_flg = 1), как перформанс: у перешедшего строк две, и прогулы с
-- часами считались в обоих юнитах; день отбора — с 1 января прошлого года включительно (было «>»)
-- 03.11, поставка 103 (файл 9, п. 1): категории мониторинга — только у людей численности на конец месяца
-- (hc_total_cnt = 1), как численность отчёта: ушедшие в течение месяца в мониторинг не попадают (было 341 против 339).
-- Человек численности без записи перформанса — «не размечено» (perf_gray), а не пропуск: сумма категорий = численность
-- той же выборки, покраска HQ / Support / Line — на конец месяца, как у численности
-- 11.11 (владелец, параграф «ПРАВКИ» боевого ноутбука — логика мастер-дашборда мониторинга): плановый рабочий день — из
-- календаря посещаемости (mdm_employee_attendance, «Работа»); часы дня — reduced_duration_hour, если он больше 7, иначе
-- duration_hour; прогулы и работа в выходные для сегментов — скользящие 16 недель на последнюю неделю месяца; доля
-- звонков — недельная (среднее звонков / среднее часов), последняя неделя месяца; категория недели и срок в ней —
-- из performance_metric_w
-- =============================================================================
drop table if exists all_metrics_with_performance_added ;
create table all_metrics_with_performance_added as

with performance_category (val, mapped_val) as(
    select * from (values
        ('normal',      'normal'),
        ('super_low',   'low'),
        ('low',         'low'),
        ('high',        'high'),
        ('super_high',  'high')
    )t (val, mapped_val)
)
, performance_base as(
    select
        mdm_employee_rk
        , calendar_dt
        , coalesce(pc.mapped_val, 'gray') as performance_category_mapped
    from prod_v_sse_crossdata.performance_metric_m pmm
    left join performance_category pc on pmm.performance_category = pc.val
    where pmm.calendar_dt >= DATE_TRUNC('year', current_date) - interval '1 year'
)
, performance as(
    select mdm_employee_rk::int
        , calendar_dt,
        count(*) filter (where performance_category_mapped = 'normal') as perf_normal,
        count(*) filter (where performance_category_mapped = 'low')    as perf_low,
        count(*) filter (where performance_category_mapped = 'high')   as perf_high,
        count(*) filter (where performance_category_mapped = 'gray')   as perf_gray
    from performance_base
    group by 1,2
)
, cat_week as(
    select
        mdm_employee_rk
        , date_trunc('week', calendar_dt)::date as report_week
        , performance_category as cat_week
    from prod_v_sse_crossdata.performance_metric_w
    where calendar_dt >= (date_trunc('week', current_date) - interval '15 week')::date
)
, cat_week_location as(
    with base_data as(
        select
            mdm_employee_rk
            , date_trunc('week', calendar_dt)::date as report_week
            , performance_category
        from prod_v_sse_crossdata.performance_metric_w
        where calendar_dt >= (date_trunc('week', current_date) - interval '15 week')::date
    )
    , islands as(
        select mdm_employee_rk, report_week, performance_category,
            row_number() over (partition by mdm_employee_rk order by report_week)
            - row_number() over (partition by mdm_employee_rk, performance_category order by report_week) as grp
        from base_data
    )
    select
        mdm_employee_rk
        , report_week
        , performance_category as cat_week
        , row_number() over (partition by mdm_employee_rk, performance_category, grp order by report_week) as weeks_in_current_category
    from islands
)
, performance_metric_d as (
    select
        pmd.mdm_employee_rk
        , pmd.calendar_dt
        , date_trunc('month', pmd.calendar_dt)::date as report_month
        , date_trunc('week', pmd.calendar_dt)::date as report_week
        , pmd.duration_hour
        , pmd.reduced_duration_hour
        , extract(dow from pmd.calendar_dt) as weekday -- PG dow: вс=0..сб=6; будни = 1..5
        , case when pmd.reduced_duration_hour > 7 then pmd.reduced_duration_hour else pmd.duration_hour end as duration_hour_correct
        , decode(ec.attendance_group_nm, 'Работа', 1, 0) as plan_working_day_flg -- из календаря (mdm_employee_attendance), как в мастер-дашборде мониторинга
        , case when pmd.working_balance = -1 then 1 else 0 end as absence -- прогул
        , case when pmd.working_balance = 1 then 1 else 0 end as work_dayoff -- Работа в выходной
        , pmd.talk_call_duration_h
    from prod_v_sse_crossdata.performance_metric_d pmd
    left join prod_v_hrmart.mdm_employee_attendance ec
        on ec.mdm_employee_rk = pmd.mdm_employee_rk and ec.attendance_dt = pmd.calendar_dt
    where 1=1
    and pmd.calendar_dt >= date_trunc('year', current_date - interval '1 year')
)
, performance_month as (
    select
        report_month
        , mdm_employee_rk
        , sum(duration_hour_correct) filter (where plan_working_day_flg = 1) as duration_plan_sum
        , sum(plan_working_day_flg) as plan_day_cnt
        , sum(absence) as absence
        , sum(work_dayoff) as work_dayoff
        , sum(talk_call_duration_h) filter (where plan_working_day_flg = 1) as talk_plan_sum
        , sum(duration_hour_correct) as dur_all_sum
        , count(duration_hour_correct) as dur_all_cnt
        , sum(talk_call_duration_h) filter (where (weekday in (1,2,3,4,5) and plan_working_day_flg is null and duration_hour > 0) or plan_working_day_flg = 1) as talk_h_sum
        , sum(duration_hour_correct) filter (where (weekday in (1,2,3,4,5) and plan_working_day_flg is null and duration_hour > 0) or plan_working_day_flg = 1) as work_h_sum
    from performance_metric_d
    group by report_month, mdm_employee_rk
)
, performance_week as(
    select
        report_week
        , mdm_employee_rk
        , date_trunc('month', report_week)::date as report_month
        , sum(absence) as absence_w
        , sum(work_dayoff) as work_dayoff_w
    from performance_metric_d
    group by report_week, mdm_employee_rk
)
, performance_rolling as(
    select
        report_week
        , mdm_employee_rk
        , report_month
        , sum(absence_w)     over (partition by mdm_employee_rk order by report_week rows between 15 preceding and current row) as absence_16w
        , sum(work_dayoff_w) over (partition by mdm_employee_rk order by report_week rows between 15 preceding and current row) as work_dayoff_16w
    from performance_week
)
, performance_rolling_month as(
    select distinct on (mdm_employee_rk, report_month)
        report_month
        , mdm_employee_rk
        , absence_16w
        , work_dayoff_16w
    from performance_rolling
    order by mdm_employee_rk, report_month, report_week desc
)
, performance_share_week as(
    select
        mdm_employee_rk
        , report_week
        , round(
            avg(talk_call_duration_h) filter (where (weekday in (1,2,3,4,5) and plan_working_day_flg is null and duration_hour > 0) or plan_working_day_flg = 1)
            / nullif(avg(duration_hour_correct) filter (where (weekday in (1,2,3,4,5) and plan_working_day_flg is null and duration_hour > 0) or plan_working_day_flg = 1), 0)
            * 100, 1) as share_talk
    from performance_metric_d
    group by mdm_employee_rk, report_week
)
, performance_share_month as(
    select distinct on (mdm_employee_rk, report_month)
        report_month
        , mdm_employee_rk
        , share_talk
    from (select mdm_employee_rk, report_week, date_trunc('month', report_week)::date as report_month, share_talk from performance_share_week) s
    order by mdm_employee_rk, report_month, report_week desc
)
, cat_week_month as(
    select distinct on (c.mdm_employee_rk, date_trunc('month', c.report_week)::date)
        date_trunc('month', c.report_week)::date as report_month
        , c.mdm_employee_rk
        , c.cat_week
        , cl.weeks_in_current_category
    from cat_week c
    left join cat_week_location cl
        on cl.mdm_employee_rk = c.mdm_employee_rk and cl.report_week = c.report_week
    order by c.mdm_employee_rk, date_trunc('month', c.report_week)::date, c.report_week desc
)




select nm.*
    , case when coalesce(nm.hc_total_cnt, 0) = 1 then coalesce(perf.perf_normal, 0) else 0 end as perf_normal
    , case when coalesce(nm.hc_total_cnt, 0) = 1 then coalesce(perf.perf_low, 0) else 0 end    as perf_low
    , case when coalesce(nm.hc_total_cnt, 0) = 1 then coalesce(perf.perf_high, 0) else 0 end   as perf_high
    , case when coalesce(nm.hc_total_cnt, 0) = 1
           then case when perf.mdm_employee_rk is null then 1 else coalesce(perf.perf_gray, 0) end else 0 end as perf_gray
    , coalesce(pm.duration_plan_sum,0)/nullif(coalesce(pm.plan_day_cnt,0),0) as duration_hour -- Длительность рабочего дня в часах средняя
    , coalesce(pm.talk_plan_sum,0)/nullif(coalesce(pm.plan_day_cnt,0),0) as talk_call_duration_h -- Длительность звонков в часах средняя
    , coalesce(pm.absence, 0)          as absence -- прогул
    , coalesce(pm.work_dayoff, 0)      as work_dayoff -- Работа в выходной
    , coalesce(pm.talk_h_sum, 0)       as talk_h_sum
    , coalesce(pm.work_h_sum, 0)       as work_h_sum
    , coalesce(psm.share_talk, 0)      as share_talk -- доля времени на разговоры, % (недельно avg/avg, как в мастер-дашборде мониторинга)
    , coalesce(pm.duration_plan_sum, 0) as duration_plan_sum -- часы плановых дней месяца (поставка 104)
    , coalesce(pm.plan_day_cnt, 0)     as plan_day_cnt -- плановые дни месяца
    , coalesce(pm.talk_plan_sum, 0)    as talk_plan_sum -- часы звонков плановых дней месяца
    , coalesce(cwm.cat_week, 'grey')   as cat_week -- категория недели (performance_metric_w)
    , coalesce(cwm.weeks_in_current_category, 0) as weeks_in_current_category
    , coalesce(prm.absence_16w, 0)     as flg_absent_total -- прогулы за 16 недель
    , coalesce(prm.work_dayoff_16w, 0) as flg_work_in_rest_total -- работа в выходные за 16 недель
    , case
        when coalesce(psm.share_talk, 0) <= 0 then 'нет данных'
        when coalesce(psm.share_talk, 0) < 20 then 'до 20%'
        when coalesce(psm.share_talk, 0) <= 30 then '20-30%'
        when coalesce(psm.share_talk, 0) <= 50 then '30-50%'
        else '50%+'
    end as talk_segment_cd
    , case
        when coalesce(prm.absence_16w, 0) <= 1 then '0-1'
        when coalesce(prm.absence_16w, 0) <= 5 then '2-5'
        else '5+'
    end as absence_segment_cd
    , case
        when coalesce(prm.work_dayoff_16w, 0) <= 1 then '0-1'
        when coalesce(prm.work_dayoff_16w, 0) <= 5 then '2-5'
        else '5+'
    end as weekend_segment_cd
from all_metrics nm
left join performance perf
    on nm.mdm_employee_rk = perf.mdm_employee_rk and perf.calendar_dt = nm.report_month--::date
    and nm.last_row_flg = 1
left join performance_month pm
    on nm.mdm_employee_rk = pm.mdm_employee_rk and pm.report_month = nm.report_month
    and nm.last_row_flg = 1
left join performance_rolling_month prm
    on nm.mdm_employee_rk = prm.mdm_employee_rk and prm.report_month = nm.report_month
    and nm.last_row_flg = 1
left join performance_share_month psm
    on nm.mdm_employee_rk = psm.mdm_employee_rk and psm.report_month = nm.report_month
    and nm.last_row_flg = 1
left join cat_week_month cwm
    on nm.mdm_employee_rk = cwm.mdm_employee_rk and cwm.report_month = nm.report_month
    and nm.last_row_flg = 1

distributed by (mdm_employee_rk, report_month);

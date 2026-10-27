-- =============================================================================
-- TeamPulse Hub
-- перформанс (категории за месяц) и мониторинг по дням (Адель, 27.10): средняя длительность рабочего дня, прогулы,
-- работа в выходной, звонки и доля разговоров, сегменты. Поставка 71 — исправлено: деление на число плановых рабочих
-- дней через nullif (у человека, который в месяце работал только в выходные, оно 0 — параграф падал); мониторинг по
-- дням — к одной строке человека в месяце (last_row_flg = 1), как перформанс: у перешедшего строк две, и прогулы с
-- часами считались в обоих юнитах; день отбора — с 1 января прошлого года включительно (было «>»)
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
, performance_metric_d as (
    select 
        mdm_employee_rk
        , calendar_dt
        , date_trunc('month', calendar_dt) as report_month
        , duration_hour
        , plan_working_day_flg
        , case when working_balance = -1 then 1 else 0 end as absence -- прогул
        , case when working_balance = 1 then 1 else 0 end as work_dayoff -- Работа в выходной
        , talk_call_duration_h
    from prod_v_sse_crossdata.performance_metric_d
    where 1=1
    and calendar_dt >= date_trunc('year', current_date - interval '1 year')
)
, performance_metric_d_aggr as (
    select 
        report_month
        , mdm_employee_rk
        , sum(case when plan_working_day_flg=1 then duration_hour end)/nullif(sum(plan_working_day_flg), 0)*1.0 as duration_hour
        , sum(absence) as absence
        , sum(work_dayoff) as work_dayoff
        , sum(case when plan_working_day_flg=1 then talk_call_duration_h end)/nullif(sum(plan_working_day_flg), 0)*1.0 as talk_call_duration_h
        , round(100.0 * sum(case when plan_working_day_flg=1 then talk_call_duration_h end)
            / nullif(sum(case when plan_working_day_flg=1 then duration_hour end), 0), 1) as share_talk
    from performance_metric_d
    group by report_month, mdm_employee_rk
)




select nm.*
    , coalesce(perf.perf_normal, 0)     as perf_normal
    , coalesce(perf.perf_low, 0)        as perf_low
    , coalesce(perf.perf_high, 0)       as perf_high
    , coalesce(perf.perf_gray, 0)       as perf_gray
    , coalesce(pmd.duration_hour, 0)    as duration_hour -- Длительность рабочего дня в часах средняя
    , coalesce(pmd.absence, 0)          as absence -- прогул
    , coalesce(pmd.work_dayoff, 0)        as work_dayoff -- Работа в выходной
    , coalesce(pmd.talk_call_duration_h, 0) as talk_call_duration_h -- Длительность звонков в часах средняя
    , coalesce(pmd.share_talk, 0)       as share_talk -- доля времени на разговоры, %
    , case
        when coalesce(pmd.duration_hour, 0) <= 0 then 'нет данных'
        when coalesce(pmd.share_talk, 0) < 20 then 'до 20%'
        when coalesce(pmd.share_talk, 0) <= 30 then '20-30%'
        when coalesce(pmd.share_talk, 0) <= 50 then '30-50%'
        else '50%+'
    end as talk_segment_cd
    , case
        when coalesce(pmd.absence, 0) <= 1 then '0-1'
        when coalesce(pmd.absence, 0) <= 5 then '2-5'
        else '5+'
    end as absence_segment_cd
    , case
        when coalesce(pmd.work_dayoff, 0) <= 1 then '0-1'
        when coalesce(pmd.work_dayoff, 0) <= 5 then '2-5'
        else '5+'
    end as weekend_segment_cd
from all_metrics nm
left join performance perf
    on nm.mdm_employee_rk = perf.mdm_employee_rk and perf.calendar_dt = nm.report_month--::date
    and nm.last_row_flg = 1
left join performance_metric_d_aggr pmd
    on nm.mdm_employee_rk = pmd.mdm_employee_rk and pmd.report_month = nm.report_month
    and nm.last_row_flg = 1

distributed by (mdm_employee_rk, report_month);


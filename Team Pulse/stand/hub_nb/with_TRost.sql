-- =============================================================================
-- TeamPulse Hub
-- заявки T-роста к людям (Адель, 27.10): за месяц — одобрено, отклонено, отменено, в работе, из них T@T (к одной
-- строке человека в месяце); за всё время — сколько заявок подавал, признаки «ни разу», «впервые», «повторно»
-- =============================================================================
drop table if exists all_metrics_with_performance_and_office_traffic_and_grt ;
create table all_metrics_with_performance_and_office_traffic_and_grt as


with  grt_employee as (
    -- всё за всё время по сотруднику: сколько заявок, сколько одобрено, дата последнего прохождения
    select mdm_employee_rk,
            count(*) as grt_app_cnt,
            sum(is_approved) as grt_approve_total,
            max(create_dttm) filter (where is_approved = 1) as grt_last_approve_dttm
    from rost_info
    group by mdm_employee_rk
)
, grt_month as (
    select mdm_employee_rk
            , month
            , sum(is_approved) as is_approved
            , sum(is_declined) as is_declined
            , sum(is_cancelled) as is_cancelled
            , sum(is_inprogress) as is_inprogress
            , sum(tat_flg) as tat
    from rost_info group by mdm_employee_rk, month
)
select m.*
    , coalesce(o.is_approved, 0) as grt_approve_cnt
    , coalesce(o.is_declined, 0) as grt_decline_cnt
    , coalesce(o.is_cancelled, 0) as grt_cancel_cnt
    , coalesce(o.is_inprogress, 0) as grt_inprogress_cnt
    
    , coalesce(e.grt_app_cnt, 0) as grt_app_cnt
    , coalesce(o.tat, 0) as grt_tat_cnt --из них ТаТ
    , case when e.mdm_employee_rk is null then 1 else 0 end as grt_no_app_flg   -- ни разу не подавал заявку в Т-Росте
    , case when coalesce(e.grt_app_cnt, 0) >= 2 then 1 else 0 end as grt_repeat_flg -- участвует повторно (подавал больше 1 заявки)
    , case when coalesce(e.grt_app_cnt, 0) = 1 then 1 else 0 end as grt_first_flg   -- первый раз
    -- , case
    --         when e.grt_last_approve_dttm is null then 'не проходил рост'
    --         when age(m.report_month, e.grt_last_approve_dttm::date) < interval '6 months'  then 'менее 6 мес'
    --         when age(m.report_month, e.grt_last_approve_dttm::date) < interval '1 year'    then '6-12 мес'
    --         when age(m.report_month, e.grt_last_approve_dttm::date) < interval '2 years'   then '1-2 года'
    --         when age(m.report_month, e.grt_last_approve_dttm::date) < interval '3 years'   then '2-3 года'
    --         when age(m.report_month, e.grt_last_approve_dttm::date) < interval '4 years'   then '3-4 года'
    --         else '4+ лет'
    --     end as grt_recency_cd

from all_metrics_with_performance_and_office_traffic m
left join grt_month o
    on o.month = m.report_month
    and o.mdm_employee_rk = m.mdm_employee_rk
    and m.last_row_flg = 1
left join grt_employee e
    on e.mdm_employee_rk = m.mdm_employee_rk

distributed by (mdm_employee_rk, report_month)
;

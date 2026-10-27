-- =============================================================================
-- TeamPulse Hub
-- добавлены города посещений для статистики посещений (Адель, 23.10): бронирования, нарушения
-- бронирования и посещения по городам. С поставки 66 — в отчёте: «hub · 3» (ряды бронирований),
-- «hub · 4» (города последнего месяца)
-- ======================================================================
drop table if exists all_metrics_with_performance_and_office_traffic ;
create table all_metrics_with_performance_and_office_traffic as

with base as (
    select date_trunc('month', calendar_dt) as month
        , mdm_employee_rk
        , calendar_dt
        , work_day_flg
        , coalesce(office_visit_flg, 0)      as office_visit_flg
        , coalesce(booking_flg, 0)           as booking_flg
        , coalesce(booking_violation_flg, 0) as booking_violation_flg --бронь без посещения
        , coalesce(visit_violation_flg, 0)   as visit_violation_flg   --посещение без брони
        , office_city_nm
    from usr_cross_data.office_traffic_attendance
    where work_day_flg = 1
)
-- общие метрики за месяц
, office_traffic as (
    select month
        , mdm_employee_rk
        , count(work_day_flg)        as work_day_amt
        , sum(office_visit_flg)      as office_visit_amt
        , sum(booking_flg)           as booking_amt
        , sum(booking_violation_flg) as booking_viol_amt
        , sum(visit_violation_flg)   as visit_viol_amt
    from base
    group by month, mdm_employee_rk
)
-- посещения в разрезе городов; 27.10-в: и брони с нарушениями (дни с бронью, бронь без посещения, посещение без
-- брони) — для «Нарушений брони по городам»; город с одной бронью без прихода тоже попадает
, city_visits as (
    select month
        , mdm_employee_rk
        , office_city_nm
        , sum(office_visit_flg)      as visit_count
        , sum(booking_flg)           as booking_count
        , sum(booking_violation_flg) as booking_viol_count
        , sum(visit_violation_flg)   as visit_viol_count
    from base
    where office_city_nm is not null
    group by month, mdm_employee_rk, office_city_nm
    having sum(office_visit_flg) + sum(booking_flg) + sum(visit_violation_flg) > 0
)
-- сворачиваем в json
, city_json as (
    select month
        , mdm_employee_rk
        , json_agg(
              json_build_object(
                  'office_city_nm',     office_city_nm,
                  'visit_count',        visit_count,
                  'booking_count',      booking_count,
                  'booking_viol_count', booking_viol_count,
                  'visit_viol_count',   visit_viol_count
              )
              order by visit_count desc, office_city_nm
          ) as office_city_visits_json
    from city_visits
    group by month, mdm_employee_rk
)

select m.*
    , o.work_day_amt
    , o.office_visit_amt
    , o.booking_amt
    , o.booking_viol_amt
    , o.visit_viol_amt
    , c.office_city_visits_json
from all_metrics_with_performance_added m
left join office_traffic o
    on o.month = m.report_month
    and o.mdm_employee_rk = m.mdm_employee_rk
    and m.last_row_flg = 1
left join city_json c
    on  c.month           = m.report_month
    and c.mdm_employee_rk = m.mdm_employee_rk
    and m.last_row_flg    = 1

distributed by (mdm_employee_rk, report_month)
;

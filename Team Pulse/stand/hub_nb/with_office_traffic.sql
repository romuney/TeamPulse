-- =============================================================================
-- TeamPulse Hub
-- добавлены города посещений для статистики посещений (23.10): бронирования, нарушения
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
        -- 06.11, как в мастере: rn офиса дня (0 — без визита, 1 — главный офис), закреплён ли офис, фикс
        , coalesce(main_office_visit_rn, 0) as main_office_visit_rn
        , case when active_office_emp_flg = 'Да' then 1 else 0 end as office_emp_flg
        , case when fix_flex_cat = 'фикс' then 1 else 0 end as fix_flg
        , coalesce(office_visit_flg, 0)    as office_visit_flg
        , coalesce(booking_flg, 0)         as booking_flg
        , booking_violation_flg  -- бронь без посещения; null — бронь вне учёта нарушений (не coalesce: различаем)
        , visit_violation_flg    -- посещение без брони; null — вне учёта
        , coalesce(nullif(trim(office_city_nm::text), ''), '-') as office_city_nm
    from usr_cross_data.office_traffic_attendance
    where work_day_flg = 1
      and active_type_nm = 'Активная'   -- 06.11: мастер — активная численность
)
-- общие метрики за месяц; 06.11 — в базовой логике мастера (борд «Посещаемость и бронирование офисов»,
-- выгрузки мастера 06.11; сверено: посещаемость HQ 12/12 месяцев ±0.4 п.п.):
--   посещаемость и посещения — на активных с закреплённым офисом (office_emp_flg = 1), визит —
--   главный офис дня (rn = 1), знаменатель — строки rn <= 1; fix_* — то же у владельцев фиксов;
--   брони — только строки с определённым нарушением (booking_violation_flg is not null)
, office_traffic as (
    select month
        , mdm_employee_rk
        , sum(case when office_emp_flg = 1 and main_office_visit_rn <= 1 then 1 else 0 end) as work_day_amt
        , sum(case when office_emp_flg = 1 and main_office_visit_rn = 1 then office_visit_flg else 0 end) as office_visit_amt
        , sum(case when fix_flg = 1 and main_office_visit_rn <= 1 then 1 else 0 end) as fix_work_day_amt
        , sum(case when fix_flg = 1 and main_office_visit_rn = 1 then office_visit_flg else 0 end) as fix_office_visit_amt
        , sum(case when booking_violation_flg is not null then booking_flg else 0 end) as booking_amt
        , sum(booking_violation_flg) as booking_viol_amt
        , sum(case when office_emp_flg = 1 and main_office_visit_rn = 1 then visit_violation_flg else 0 end) as visit_viol_amt
        , sum(case when office_emp_flg = 1 and main_office_visit_rn = 1 and visit_violation_flg = 0
                   then office_visit_flg else 0 end) as visit_with_booking_amt
    from base
    group by month, mdm_employee_rk
)
-- посещения в разрезе городов (06.11 — база мастера: активные с закреплённым офисом, визит — главный офис
-- дня; брони — с определённым нарушением); 27.10-в: и брони с нарушениями (дни с бронью, бронь без
-- посещения, посещение без брони) — для «Нарушений брони по городам»; город с одной бронью без прихода тоже попадает
, city_visits as (
    select month
        , mdm_employee_rk
        , office_city_nm
        , sum(case when office_emp_flg = 1 and main_office_visit_rn = 1 then office_visit_flg else 0 end) as visit_count
        , sum(case when office_emp_flg = 1 and main_office_visit_rn <= 1 then 1 else 0 end) as work_day_count
        , sum(case when booking_violation_flg is not null then booking_flg else 0 end) as booking_count
        , sum(booking_violation_flg) as booking_viol_count
        , sum(case when office_emp_flg = 1 and main_office_visit_rn = 1 then visit_violation_flg else 0 end) as visit_viol_count
    from base
    -- 09.11 (hub checks № 33: посещения по городам = посещения): посещение без города — строкой «-» (в отчёте «Не
    -- указано»); было — отбрасывалось, и сумма по городам была меньше посещений
    group by month, mdm_employee_rk, office_city_nm
    -- 09.11 (бой: посещения по городам меньше посещений): visit_violation_flg бывает NULL — сумма с NULL давала NULL, и
    -- строка города выпадала вместе с посещениями. Каждое слагаемое — через coalesce
    having coalesce(sum(case when office_emp_flg = 1 and main_office_visit_rn <= 1 then 1 else 0 end), 0)
         + coalesce(sum(case when office_emp_flg = 1 and main_office_visit_rn = 1 then office_visit_flg else 0 end), 0)
         + coalesce(sum(case when booking_violation_flg is not null then booking_flg else 0 end), 0)
         + coalesce(sum(case when office_emp_flg = 1 and main_office_visit_rn = 1 then visit_violation_flg else 0 end), 0) > 0
)
-- сворачиваем в json
, city_json as (
    select month
        , mdm_employee_rk
        , json_agg(
              json_build_object(
                  'office_city_nm',     office_city_nm,
                  'visit_count',        visit_count,
                  'work_day_count',     work_day_count,
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
    , o.fix_work_day_amt
    , o.fix_office_visit_amt
    , o.booking_amt
    , o.booking_viol_amt
    , o.visit_viol_amt
    , o.visit_with_booking_amt
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
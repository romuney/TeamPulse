-- =============================================================================
-- TeamPulse Hub
-- календарь посещений на последние 2 месяца (Адель, 23.10; поставка 66 — исправлен и дополнен)
-- юнит × день × срез отчёта: людей с рабочим днём (cnt_work_day) и из них в офисе (cnt_office_visit);
-- посещаемость дня = cnt_office_visit / cnt_work_day. За месяц сумма — те же рабочие дни и посещения, что
-- у with_office_traffic (проверка в «hub checks»). В отчёт календарь раскладывает по узлам «hub · 4».
-- Поставка 66, к версии 23.10:
--   - date_trunck → date_trunc, запятая после cnt_work_day;
--   - без условия office_visit_flg = 1: с ним в таблице только дни в офисе, и cnt_work_day = cnt_office_visit —
--     посещаемость дня всегда 100%;
--   - человек — одной строкой месяца (last_row_flg = 1, как у посещений в with_office_traffic): у перешедшего
--     в месяце строк несколько, и его дни считались в каждой;
--   - срезы отчёта (покраска, IT-код, тип оформления, тип численности) и ключи уровней — по ним отчёт
--     фильтрует календарь и раскладывает его по узлам;
--   - два месяца — последний месяц all_metrics и прошлый (первое условие — отсечение партиций по дате).
-- ======================================================================
drop table if exists office_traffic_calendar ;
create table office_traffic_calendar as

with calendar as (
select calendar_dt::date as calendar_dt
        , date_trunc('month', calendar_dt)::date as report_month
        , mdm_employee_rk
        --, office_city_nm
        , coalesce(region_visit_flg, 0) as region_visit_flg
        , coalesce(office_visit_flg, 0) as office_visit_flg
        , day_short_nm
        , day_sort
    from usr_cross_data.office_traffic_attendance
    where calendar_dt >= date_trunc('month', current_date - interval '3 month')
    and calendar_dt >= (select max(report_month)::date - interval '1 month' from all_metrics)
    and work_day_flg = 1
)

select c.report_month,
    c.calendar_dt,
    am.mng_unit_rk,
    am.leaf_lvl
    , am.lvl1_rk
    , am.lvl2_rk
    , am.lvl3_rk
    , am.lvl4_rk
    , am.lvl5_rk
    , am.lvl6_rk
    , am.lvl7_rk
    , am.lvl8_rk
    , am.lvl9_rk
    , am.lvl10_rk
    , am.lvl11_rk
    , am.lvl1_nm
    , am.lvl2_nm
    , am.lvl3_nm
    , am.lvl4_nm
    , am.lvl5_nm
    , am.lvl6_nm
    , am.lvl7_nm
    , am.lvl8_nm
    , am.lvl9_nm
    , am.lvl10_nm
    , am.lvl11_nm
    , am.paint_cd
    , am.emp_specialization_it_code
    , am.employment_relation_type
    , am.act_type_nm
    , count(*) as cnt_work_day
    , sum(c.office_visit_flg) as cnt_office_visit
    , sum(c.region_visit_flg) as cnt_region_visit
    , max(c.day_sort) as day_sort
    , max(c.day_short_nm) as day_short_nm

from all_metrics am
join calendar c on am.mdm_employee_rk = c.mdm_employee_rk and am.report_month = c.report_month
where am.last_row_flg = 1
group by c.report_month,
    c.calendar_dt,
    am.mng_unit_rk,
    am.leaf_lvl,
    am.lvl1_rk, am.lvl2_rk, am.lvl3_rk, am.lvl4_rk, am.lvl5_rk, am.lvl6_rk, am.lvl7_rk, am.lvl8_rk, am.lvl9_rk, am.lvl10_rk, am.lvl11_rk,
    am.lvl1_nm, am.lvl2_nm, am.lvl3_nm, am.lvl4_nm, am.lvl5_nm, am.lvl6_nm, am.lvl7_nm, am.lvl8_nm, am.lvl9_nm, am.lvl10_nm, am.lvl11_nm,
    am.paint_cd, am.emp_specialization_it_code, am.employment_relation_type, am.act_type_nm

distributed by (mng_unit_rk);

analyze office_traffic_calendar;

-- =============================================================================
-- TeamPulse Hub
-- заявки T-роста к структуре (Адель, 27.10): заявка — юнит и срезы человека в месяце начала (поставка 73: как эталон «Роста» — старт согласования, иначе создание). Поставка 71: к одной
-- строке человека в месяце (last_row_flg = 1) — у перешедшего в месяце строк две, и заявка считалась дважды. Из неё
-- «hub · 4» собирает разрезы T-роста: заявки по месяцам и успешность по желаемому грейду и специализации
-- =============================================================================
drop table if exists structure_x_rost;
create table structure_x_rost as

select 
    am.mng_unit_rk
    , am.leaf_lvl
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
    , ri.*
from rost_info ri
join all_metrics am 
on ri.mdm_employee_rk = am.mdm_employee_rk and ri.month = am.report_month
    and am.last_row_flg = 1
distributed by (mdm_employee_rk);

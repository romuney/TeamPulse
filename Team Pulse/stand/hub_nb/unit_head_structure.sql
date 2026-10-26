-- =============================================================================
-- TeamPulse Hub · руководитель юнита по месяцам: имя и логин (Адель, 23.10; поставка 66)
-- Руководитель — сотрудник с management_head_flg = 1, юнит — его management_unit_rk, на последний день
-- месяца (у текущего — на последний день данных). Имя — «Имя Фамилия»: его ищут в фильтре юнита отчёта.
-- Поставка 66: одна строка на юнит и месяц. У юнита бывает несколько строк с флагом (две должности,
-- соруководители, две даты в месяце) — org_structure, который присоединяет таблицу, размножал строки юнита.
-- Берётся последняя дата месяца, при равенстве — меньший mdm_employee_rk. Нет фамилии — только имя.
-- =============================================================================
DROP TABLE IF EXISTS unit_head_structure;
create table unit_head_structure as

with unit_heads as (
select
    business_dt::DATE AS business_dt,
    management_unit_rk,
    management_unit_nm,
    mdm_employee_rk,
    last_nm,first_nm,
    nullif(trim(coalesce(first_nm, '') || ' ' || coalesce(last_nm, '')), '') as full_nm,
    ad_login

from prod_v_emart.mdm_employee_structure_d
where
    (last_day_flg = 1 or last_day_of_month_flg = 1)
    and management_head_flg=1
)
    --AND company_fire_flg = 0


select distinct on (uh.management_unit_rk, date_trunc('month', uh.business_dt)::DATE)
    uh.management_unit_rk
    , date_trunc('month', uh.business_dt)::DATE as report_month
    , uh.mdm_employee_rk as leader_mdm_employee_rk
    , uh.first_nm as leader_first_nm
    , uh.full_nm as leader_full_nm
    , uh.ad_login as leader_login

from unit_heads uh
order by uh.management_unit_rk, date_trunc('month', uh.business_dt)::DATE, uh.business_dt desc, uh.mdm_employee_rk

distributed by (management_unit_rk);

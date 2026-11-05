-- ============================================================================
-- 0и. Флаги переводов в дневном источнике: где стоят и что значат (поставка 56).
-- Helicopter, параграф gp. Ответ — в чат: только счёт переходов, без людей.
--
-- С поставки 56 перевод — по флагам источника (методология переводов). Ноутбук читает их так:
--   «в» — на первом дне в новом состоянии, «из» — на последнем дне в старом (так их читает и TP 2.0);
--   флаг значит «значение сменилось» — любое, не только «в HQ», «в IT», «в Активную».
-- Запрос проверяет оба допущения на одном месяце (по умолчанию — сентябрь 2026; другой — поменяйте
-- обе даты в where). Строка — часть и проверка:
--   смена со флагом / без флага   — день к дню значение сменилось; отмечен ли переход флагом «в» на
--                                   новом дне или «из» на прошлом. «Без флага» ждём 0: иначе ноутбук
--                                   положит такие смены в «прочее» (виды x… в teampulse_hub_trf)
--   «в» на новом дне / на прошлом — где стоит флаг «в» у смены; ждём «на новом дне»
--   «из» на прошлом дне / на новом — где стоит флаг «из»; ждём «на прошлом дне»
--   флаг без смены значения        — флаг есть, значение то же (перевод туда и обратно в один день и т. п.)
-- Пары «было → стало» у покраски и IT-кода — чтобы увидеть, отмечает ли флаг любые смены
-- (Line → Support) или только смены в HQ / в IT.
-- ============================================================================
with d as (
    select x.mdm_employee_rk as e, x.calendar_dt::date as dt,
           coalesce(x.emp_specialization_oper_code::text, '-') as pa,
           coalesce(x.emp_specialization_it_code::text, '-') as it,
           coalesce(x.employment_relation_type_desc::text, '-') as rel,
           coalesce(x.active_type_nm::text, '-') as act,
           concat_ws('|', x.lvl1_mapped_management_unit_rk, x.lvl2_mapped_management_unit_rk,
                     x.lvl3_mapped_management_unit_rk, x.lvl4_mapped_management_unit_rk,
                     x.lvl5_mapped_management_unit_rk, x.lvl6_mapped_management_unit_rk,
                     x.lvl7_mapped_management_unit_rk, x.lvl8_mapped_management_unit_rk,
                     x.lvl9_mapped_management_unit_rk, x.lvl10_mapped_management_unit_rk,
                     x.lvl11_mapped_management_unit_rk) as up,
           (coalesce(x.transfer_to_hq_flg::text, '0') = '1')::int as i_pa,
           (coalesce(x.transfer_out_hq_flg::text, '0') = '1')::int as o_pa,
           (coalesce(x.transfer_to_it_flg::text, '0') = '1')::int as i_it,
           (coalesce(x.transfer_out_it_flg::text, '0') = '1')::int as o_it,
           (coalesce(x.transfer_to_employment_relation_type_flg::text, '0') = '1')::int as i_rel,
           (coalesce(x.transfer_out_employment_relation_type_flg::text, '0') = '1')::int as o_rel,
           (coalesce(x.transfer_to_active_type_flg::text, '0') = '1')::int as i_act,
           (coalesce(x.transfer_out_active_type_flg::text, '0') = '1')::int as o_act,
           (coalesce(x.lvl1_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl2_mngt_unit_in_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl3_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl4_mngt_unit_in_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl5_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl6_mngt_unit_in_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl7_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl8_mngt_unit_in_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl9_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl10_mngt_unit_in_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl11_mngt_unit_in_trsf_flg::text, '0') = '1')::int as i_up,
           (coalesce(x.lvl1_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl2_mngt_unit_out_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl3_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl4_mngt_unit_out_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl5_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl6_mngt_unit_out_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl7_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl8_mngt_unit_out_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl9_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl10_mngt_unit_out_trsf_flg::text, '0') = '1'
            or coalesce(x.lvl11_mngt_unit_out_trsf_flg::text, '0') = '1')::int as o_up,
           (coalesce(x.hire_flg::text, '0') = '1')::int as hf,
           (coalesce(x.fire_flg::text, '0') = '1')::int as fx
    from usr_cross_data.hr_executive_proteus x
    where x.calendar_dt::date between '2026-08-31'::date and '2026-09-30'::date
),
s as (
    select d.*, lag(dt) over w as dt0, lag(pa) over w as pa0, lag(it) over w as it0, lag(rel) over w as rel0,
           lag(act) over w as act0, lag(up) over w as up0, lag(fx) over w as fx0,
           lag(i_pa) over w as i_pa0, lag(o_pa) over w as o_pa0, lag(i_it) over w as i_it0, lag(o_it) over w as o_it0,
           lag(i_rel) over w as i_rel0, lag(o_rel) over w as o_rel0, lag(i_act) over w as i_act0, lag(o_act) over w as o_act0,
           lag(i_up) over w as i_up0, lag(o_up) over w as o_up0
    from d
    window w as (partition by e order by dt)
),
t as (
    -- переходы день к дню внутри месяца, без найма в этот день и без увольнения накануне
    select * from s where dt0 is not null and dt >= '2026-09-01'::date and hf = 0 and fx0 = 0
),
p as (
    select 'подразделение' as part, up0 as v0, up as v1, i_up as i1, i_up0 as i0, o_up0 as o0, o_up as o1 from t
    union all select 'покраска', pa0, pa, i_pa, i_pa0, o_pa0, o_pa from t
    union all select 'IT-код', it0, it, i_it, i_it0, o_it0, o_it from t
    union all select 'тип оформления', rel0, rel, i_rel, i_rel0, o_rel0, o_rel from t
    union all select 'тип активности', act0, act, i_act, i_act0, o_act0, o_act from t
)
select part, 'смена со флагом' as chk, count(*) as n from p where v0 <> v1 and (i1 = 1 or o0 = 1) group by 1
union all select part, 'смена без флага', count(*) from p where v0 <> v1 and not (i1 = 1 or o0 = 1) group by 1
union all select part, '«в» на новом дне', count(*) from p where v0 <> v1 and i1 = 1 group by 1
union all select part, '«в» на прошлом дне', count(*) from p where v0 <> v1 and i0 = 1 and i1 = 0 group by 1
union all select part, '«из» на прошлом дне', count(*) from p where v0 <> v1 and o0 = 1 group by 1
union all select part, '«из» на новом дне', count(*) from p where v0 <> v1 and o1 = 1 and o0 = 0 group by 1
union all select part, 'флаг без смены значения', count(*) from p where v0 = v1 and (i1 = 1 or o0 = 1) group by 1
union all
select part || ': ' || v0 || ' → ' || v1, case when i1 = 1 or o0 = 1 then 'смена со флагом' else 'смена без флага' end, count(*)
from p where part in ('покраска', 'IT-код') and v0 <> v1
group by 1, 2
order by 1, 2;

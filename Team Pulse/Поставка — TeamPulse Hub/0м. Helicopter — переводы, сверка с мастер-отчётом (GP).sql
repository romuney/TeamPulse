-- ============================================================================
-- 0м. Переводы по правилу мастер-отчёта: сверка один в один на трёх подразделениях (поставка 59).
-- Helicopter, параграф gp. Ответ — в чат, не в репозиторий: в нём числа.
--
-- Что сделать: в запросе 1 (блок p в начале) вписать имена трёх подразделений из queries.md вместо
-- «ВПИШИТЕ …» — в том же порядке, что в queries.md. Уровни и фильтр IT уже стоят. Запустить и прислать таблицу.
-- Запрос 2 — по желанию: если ни одна пара колонок не совпала с мастер-отчётом.
--
-- Зачем. Правило переводов восстановлено по вашим выборкам 22.10. На первой совпали все 12 месяцев, на двух
-- других у мастер-отчёта больше в 7 числах из 48. Каждое недостающее событие — у человека, у которого тип
-- численности не «Активная» (в выборке — «Прочие»), чаще «Не штат». Похоже, «Активная» мастер-отчёта шире,
-- чем active_type_nm = 'Активная'. В выборке был только этот признак — поэтому запрос на бою.
-- Запрос 1 считает переводы «в» и «из» по правилу мастер-отчёта при трёх определениях «Активной»:
--   in_type, out_type  active_type_nm = 'Активная'                  — как по выборке
--   in_flag, out_flag  active_count_flg = 1                          — как считает ноутбук отчёта
--   in_cntr, out_cntr  active_type_nm in ('Активная', 'Подрядчики')  — «активные» прод-ноутбука УС
-- Пара, которая совпадёт с мастер-отчётом во всех месяцах всех трёх подразделений, — его определение.
-- Если это не in_flag, out_flag — ноутбук поправлю одной строкой.
--
-- Правило (как в мастер-отчёте и в ноутбуке с поставки 59). Событие — строка источника за день:
--   «в»  — флаг юнита своего уровня lvlN_mngt_unit_in_trsf_flg, или флаг типа численности
--          transfer_to_active_type_flg, или (стоит фильтр IT) transfer_to_it_flg; без найма, кандидатов и
--          внутренних (hire_flg, transfer_candidate_flg, transfer_internal_flg = 0); месяц — день строки;
--   «из» — те же флаги out; без увольнения (fire_flg = 0); последний день месяца — следующим месяцем.
--   Фильтры (юнит, IT, «Активная») — к самой строке, состояние этого дня.
-- ============================================================================

-- 1. Переводы по месяцам: подразделение × месяц × три определения «Активной»
with p (smp, lvl, unit_nm, it_cd) as (
    values (1, 5, 'ВПИШИТЕ имя подразделения из запроса 1 в queries.md', null::text),
           (2, 3, 'ВПИШИТЕ имя подразделения из запроса 2 в queries.md', 'Digital'),
           (3, 4, 'ВПИШИТЕ имя подразделения из запроса 3 в queries.md', null::text)
),
r as (  -- строки подразделения с флагом; повторы строк — один раз, как в мастер-отчёте
    select distinct p.smp, x.mdm_employee_rk, x.calendar_dt::date as dt,
           coalesce(case p.lvl when 1 then x.lvl1_mngt_unit_in_trsf_flg::text when 2 then x.lvl2_mngt_unit_in_trsf_flg::text
                               when 3 then x.lvl3_mngt_unit_in_trsf_flg::text when 4 then x.lvl4_mngt_unit_in_trsf_flg::text
                               when 5 then x.lvl5_mngt_unit_in_trsf_flg::text when 6 then x.lvl6_mngt_unit_in_trsf_flg::text
                               when 7 then x.lvl7_mngt_unit_in_trsf_flg::text when 8 then x.lvl8_mngt_unit_in_trsf_flg::text
                               when 9 then x.lvl9_mngt_unit_in_trsf_flg::text when 10 then x.lvl10_mngt_unit_in_trsf_flg::text
                               when 11 then x.lvl11_mngt_unit_in_trsf_flg::text end, '0') = '1' as u_in,
           coalesce(case p.lvl when 1 then x.lvl1_mngt_unit_out_trsf_flg::text when 2 then x.lvl2_mngt_unit_out_trsf_flg::text
                               when 3 then x.lvl3_mngt_unit_out_trsf_flg::text when 4 then x.lvl4_mngt_unit_out_trsf_flg::text
                               when 5 then x.lvl5_mngt_unit_out_trsf_flg::text when 6 then x.lvl6_mngt_unit_out_trsf_flg::text
                               when 7 then x.lvl7_mngt_unit_out_trsf_flg::text when 8 then x.lvl8_mngt_unit_out_trsf_flg::text
                               when 9 then x.lvl9_mngt_unit_out_trsf_flg::text when 10 then x.lvl10_mngt_unit_out_trsf_flg::text
                               when 11 then x.lvl11_mngt_unit_out_trsf_flg::text end, '0') = '1' as u_out,
           coalesce(x.transfer_to_active_type_flg::text, '0') = '1' as a_in, coalesce(x.transfer_out_active_type_flg::text, '0') = '1' as a_out,
           p.it_cd is not null and coalesce(x.transfer_to_it_flg::text, '0') = '1' as i_in,
           p.it_cd is not null and coalesce(x.transfer_out_it_flg::text, '0') = '1' as i_out,
           coalesce(x.hire_flg::text, '0') = '1' or coalesce(x.transfer_candidate_flg::text, '0') = '1' or coalesce(x.transfer_internal_flg::text, '0') = '1' as ex_in,
           coalesce(x.fire_flg::text, '0') = '1' as ex_out, coalesce(x.last_day_of_month_flg::text, '0') = '1' as ld,
           coalesce(x.active_type_nm::text, '') = 'Активная' as k_type,
           coalesce(x.active_count_flg::text, '0') = '1' as k_flag,
           coalesce(x.active_type_nm::text, '') in ('Активная', 'Подрядчики') as k_cntr
    from usr_cross_data.hr_executive_proteus x
    join p on case p.lvl when 1 then x.lvl1_mapped_management_unit_nm::text when 2 then x.lvl2_mapped_management_unit_nm::text
                       when 3 then x.lvl3_mapped_management_unit_nm::text when 4 then x.lvl4_mapped_management_unit_nm::text
                       when 5 then x.lvl5_mapped_management_unit_nm::text when 6 then x.lvl6_mapped_management_unit_nm::text
                       when 7 then x.lvl7_mapped_management_unit_nm::text when 8 then x.lvl8_mapped_management_unit_nm::text
                       when 9 then x.lvl9_mapped_management_unit_nm::text when 10 then x.lvl10_mapped_management_unit_nm::text
                       when 11 then x.lvl11_mapped_management_unit_nm::text end = p.unit_nm
    where x.calendar_dt >= '2025-10-31'
      and (coalesce(x.lvl1_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl1_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl2_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl2_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl3_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl3_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl4_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl4_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl5_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl5_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl6_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl6_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl7_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl7_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl8_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl8_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl9_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl9_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl10_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl10_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl11_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl11_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.transfer_to_active_type_flg::text, '0') = '1' or coalesce(x.transfer_out_active_type_flg::text, '0') = '1'
           or coalesce(x.transfer_to_it_flg::text, '0') = '1' or coalesce(x.transfer_out_it_flg::text, '0') = '1')
      and (p.it_cd is null or x.emp_specialization_it_code::text = p.it_cd)
),
e as (
    select smp, date_trunc('month', dt)::date as m, 'i' as d, k_type, k_flag, k_cntr from r
    where (u_in or a_in or i_in) and not ex_in
    union all
    select smp, date_trunc('month', dt + case when ld then 1 else 0 end)::date, 'o', k_type, k_flag, k_cntr from r
    where (u_out or a_out or i_out) and not ex_out
),
g as (
    select p.smp, p.lvl, p.unit_nm, m::date as m
    from p, generate_series('2025-11-01'::date, date_trunc('month', current_date)::date, interval '1 month') m
)
select g.smp, g.lvl, g.m as month,
       sum(case when e.d = 'i' and e.k_type then 1 else 0 end) as in_type,
       sum(case when e.d = 'o' and e.k_type then 1 else 0 end) as out_type,
       sum(case when e.d = 'i' and e.k_flag then 1 else 0 end) as in_flag,
       sum(case when e.d = 'o' and e.k_flag then 1 else 0 end) as out_flag,
       sum(case when e.d = 'i' and e.k_cntr then 1 else 0 end) as in_cntr,
       sum(case when e.d = 'o' and e.k_cntr then 1 else 0 end) as out_cntr
from g
left join e on e.smp = g.smp and e.m = g.m
group by 1, 2, 3
order by 1, 3;

-- 2. По желанию: события людей, у которых тип численности не «Активная», — по типу, флагу active_count_flg и
--    оформлению. Блок p — тот же, что в запросе 1 (имена вписать и здесь)
with p (smp, lvl, unit_nm, it_cd) as (
    values (1, 5, 'ВПИШИТЕ имя подразделения из запроса 1 в queries.md', null::text),
           (2, 3, 'ВПИШИТЕ имя подразделения из запроса 2 в queries.md', 'Digital'),
           (3, 4, 'ВПИШИТЕ имя подразделения из запроса 3 в queries.md', null::text)
),
r as (
    select distinct p.smp, x.mdm_employee_rk, x.calendar_dt::date as dt,
           coalesce(case p.lvl when 1 then x.lvl1_mngt_unit_in_trsf_flg::text when 2 then x.lvl2_mngt_unit_in_trsf_flg::text
                               when 3 then x.lvl3_mngt_unit_in_trsf_flg::text when 4 then x.lvl4_mngt_unit_in_trsf_flg::text
                               when 5 then x.lvl5_mngt_unit_in_trsf_flg::text when 6 then x.lvl6_mngt_unit_in_trsf_flg::text
                               when 7 then x.lvl7_mngt_unit_in_trsf_flg::text when 8 then x.lvl8_mngt_unit_in_trsf_flg::text
                               when 9 then x.lvl9_mngt_unit_in_trsf_flg::text when 10 then x.lvl10_mngt_unit_in_trsf_flg::text
                               when 11 then x.lvl11_mngt_unit_in_trsf_flg::text end, '0') = '1' or coalesce(x.transfer_to_active_type_flg::text, '0') = '1'
               or (p.it_cd is not null and coalesce(x.transfer_to_it_flg::text, '0') = '1') as f_in,
           coalesce(case p.lvl when 1 then x.lvl1_mngt_unit_out_trsf_flg::text when 2 then x.lvl2_mngt_unit_out_trsf_flg::text
                               when 3 then x.lvl3_mngt_unit_out_trsf_flg::text when 4 then x.lvl4_mngt_unit_out_trsf_flg::text
                               when 5 then x.lvl5_mngt_unit_out_trsf_flg::text when 6 then x.lvl6_mngt_unit_out_trsf_flg::text
                               when 7 then x.lvl7_mngt_unit_out_trsf_flg::text when 8 then x.lvl8_mngt_unit_out_trsf_flg::text
                               when 9 then x.lvl9_mngt_unit_out_trsf_flg::text when 10 then x.lvl10_mngt_unit_out_trsf_flg::text
                               when 11 then x.lvl11_mngt_unit_out_trsf_flg::text end, '0') = '1' or coalesce(x.transfer_out_active_type_flg::text, '0') = '1'
               or (p.it_cd is not null and coalesce(x.transfer_out_it_flg::text, '0') = '1') as f_out,
           coalesce(x.hire_flg::text, '0') = '1' or coalesce(x.transfer_candidate_flg::text, '0') = '1' or coalesce(x.transfer_internal_flg::text, '0') = '1' as ex_in,
           coalesce(x.fire_flg::text, '0') = '1' as ex_out, coalesce(x.last_day_of_month_flg::text, '0') = '1' as ld,
           coalesce(x.active_type_nm::text, '-') as active_type_nm,
           coalesce(x.active_count_flg::text, '-') as active_count_flg,
           coalesce(x.staff_flg::text, '-') as staff_flg
    from usr_cross_data.hr_executive_proteus x
    join p on case p.lvl when 1 then x.lvl1_mapped_management_unit_nm::text when 2 then x.lvl2_mapped_management_unit_nm::text
                       when 3 then x.lvl3_mapped_management_unit_nm::text when 4 then x.lvl4_mapped_management_unit_nm::text
                       when 5 then x.lvl5_mapped_management_unit_nm::text when 6 then x.lvl6_mapped_management_unit_nm::text
                       when 7 then x.lvl7_mapped_management_unit_nm::text when 8 then x.lvl8_mapped_management_unit_nm::text
                       when 9 then x.lvl9_mapped_management_unit_nm::text when 10 then x.lvl10_mapped_management_unit_nm::text
                       when 11 then x.lvl11_mapped_management_unit_nm::text end = p.unit_nm
    where x.calendar_dt >= '2025-10-31'
      and (coalesce(x.lvl1_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl1_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl2_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl2_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl3_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl3_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl4_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl4_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl5_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl5_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl6_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl6_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl7_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl7_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl8_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl8_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl9_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl9_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl10_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl10_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.lvl11_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(x.lvl11_mngt_unit_out_trsf_flg::text, '0') = '1'
           or coalesce(x.transfer_to_active_type_flg::text, '0') = '1' or coalesce(x.transfer_out_active_type_flg::text, '0') = '1'
           or coalesce(x.transfer_to_it_flg::text, '0') = '1' or coalesce(x.transfer_out_it_flg::text, '0') = '1')
      and (p.it_cd is null or x.emp_specialization_it_code::text = p.it_cd)
      and coalesce(x.active_type_nm::text, '') <> 'Активная'
)
select smp, m as month, d, active_type_nm, active_count_flg, staff_flg, count(*) as events
from (
    select smp, date_trunc('month', dt)::date as m, 'в' as d, active_type_nm, active_count_flg, staff_flg from r
    where f_in and not ex_in
    union all
    select smp, date_trunc('month', dt + case when ld then 1 else 0 end)::date, 'из', active_type_nm, active_count_flg,
           staff_flg from r
    where f_out and not ex_out
) t
where m >= '2025-11-01'
group by 1, 2, 3, 4, 5, 6
order by 1, 2, 3, 7 desc;

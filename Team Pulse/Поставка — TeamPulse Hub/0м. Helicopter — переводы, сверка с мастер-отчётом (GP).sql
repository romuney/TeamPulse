-- ============================================================================
-- 0м. Переводы при «Активных» (Активная + Подрядчики): сверка с мастер-отчётом один в один (поставка 60).
-- Helicopter, параграф gp. Ответ — в чат, не в репозиторий: в нём числа.
--
-- Что сделать: в запросе 1 (блок p в начале) вписать имена трёх подразделений из queries.md вместо
-- «ВПИШИТЕ …» — в том же порядке, что в queries.md. Уровни и фильтр IT уже стоят. Запустить и прислать таблицу.
-- Запрос 2 — по желанию: если in_report, out_report и in_flags, out_flags разошлись.
--
-- Зачем. Числа мастер-отчёта в выборках 22.10 — при «Активных»: тип численности «Активная» или «Подрядчики».
-- Запрос считает переводы этих подразделений так же, на всех данных боя, двумя способами:
--   in_report, out_report  как посчитает отчёт (поставка 60): смена типа — перевод, только если человек
--                          пересёк границу выбора. Подрядчик перешёл в «Активную» — он остался в «Активных»:
--                          не перевод (при выборе одной «Активной» это был бы перевод «в»)
--   in_flags, out_flags    по флагам источника как есть: такой подрядчик — и «из», и «в»
-- Если in_report, out_report совпали с мастер-отчётом во всех месяцах трёх подразделений — отчёт сходится один
-- в один. Если совпали in_flags, out_flags, а in_report — нет, мастер-отчёт считает переход внутри «Активных»
-- переводом: скажите, как правильно, — поправлю одной строкой датасета.
--
-- Правило (как в мастер-отчёте и в ноутбуке с поставки 59). Событие — строка источника за день:
--   «в»  — флаг юнита своего уровня lvlN_mngt_unit_in_trsf_flg, или флаг типа численности
--          transfer_to_active_type_flg, или (стоит фильтр IT) transfer_to_it_flg; без найма, кандидатов и
--          стажёров (hire_flg, transfer_candidate_flg, transfer_internal_flg = 0); месяц — день строки;
--   «из» — те же флаги out; без увольнения (fire_flg = 0); последний день месяца — следующим месяцем.
--   Фильтры (юнит, IT, тип численности) — к самой строке, состояние этого дня.
-- ============================================================================

-- 1. Переводы по месяцам при «Активных»: как посчитает отчёт и по флагам как есть
with p (smp, lvl, unit_nm, it_cd) as (
    values (1, 5, 'ВПИШИТЕ имя подразделения из запроса 1 в queries.md', null::text),
           (2, 3, 'ВПИШИТЕ имя подразделения из запроса 2 в queries.md', 'Digital'),
           (3, 4, 'ВПИШИТЕ имя подразделения из запроса 3 в queries.md', null::text)
),
r as (  -- строки подразделения с флагом при «Активных»; повторы строк — один раз, как в мастер-отчёте
    select distinct p.smp, x.mdm_employee_rk as e, x.calendar_dt::date as dt,
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
           coalesce(nullif(trim(x.active_type_nm::text), ''), '-') as tp
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
      and coalesce(nullif(trim(x.active_type_nm::text), ''), '-') in ('Активная', 'Подрядчики')
),
n as (  -- соседний день у строк со сменой типа: вчера — для «в», завтра — для «из»
    select distinct e, dt - 1 as d from r where a_in
    union
    select distinct e, dt + 1 from r where a_out
),
v as (  -- тип численности соседнего дня (строк несколько — меньший), в любом подразделении
    select n.e, n.d, min(coalesce(nullif(trim(x.active_type_nm::text), ''), '-')) as tp
    from n
    join usr_cross_data.hr_executive_proteus x on x.mdm_employee_rk = n.e and x.calendar_dt = n.d
    where x.calendar_dt >= '2025-10-30'
    group by 1, 2
),
e as (
    select r.smp, date_trunc('month', r.dt)::date as m, 'i' as d,
           r.u_in or r.i_in or (r.a_in and coalesce(vi.tp, '') not in ('Активная', 'Подрядчики')) as rep,
           r.u_in or r.i_in or r.a_in as lit
    from r
    left join v vi on vi.e = r.e and vi.d = r.dt - 1
    where (r.u_in or r.a_in or r.i_in) and not r.ex_in
    union all
    select r.smp, date_trunc('month', r.dt + case when r.ld then 1 else 0 end)::date, 'o',
           r.u_out or r.i_out or (r.a_out and coalesce(vo.tp, '') not in ('Активная', 'Подрядчики')),
           r.u_out or r.i_out or r.a_out
    from r
    left join v vo on vo.e = r.e and vo.d = r.dt + 1
    where (r.u_out or r.a_out or r.i_out) and not r.ex_out
),
g as (
    select p.smp, p.lvl, m::date as m
    from p, generate_series('2025-11-01'::date, date_trunc('month', current_date)::date, interval '1 month') m
)
select g.smp, g.lvl, g.m as month,
       sum(case when e.d = 'i' and e.rep then 1 else 0 end) as in_report,
       sum(case when e.d = 'o' and e.rep then 1 else 0 end) as out_report,
       sum(case when e.d = 'i' and e.lit then 1 else 0 end) as in_flags,
       sum(case when e.d = 'o' and e.lit then 1 else 0 end) as out_flags
from g
left join e on e.smp = g.smp and e.m = g.m
group by 1, 2, 3
order by 1, 3;

-- 2. По желанию: переходы внутри «Активных», которые по флагам — перевод, а в отчёте — нет. Блок p — тот же,
--    что в запросе 1 (имена вписать и здесь)
with p (smp, lvl, unit_nm, it_cd) as (
    values (1, 5, 'ВПИШИТЕ имя подразделения из запроса 1 в queries.md', null::text),
           (2, 3, 'ВПИШИТЕ имя подразделения из запроса 2 в queries.md', 'Digital'),
           (3, 4, 'ВПИШИТЕ имя подразделения из запроса 3 в queries.md', null::text)
),
r as (  -- строки подразделения с флагом при «Активных»; повторы строк — один раз, как в мастер-отчёте
    select distinct p.smp, x.mdm_employee_rk as e, x.calendar_dt::date as dt,
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
           coalesce(nullif(trim(x.active_type_nm::text), ''), '-') as tp
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
      and coalesce(nullif(trim(x.active_type_nm::text), ''), '-') in ('Активная', 'Подрядчики')
),
n as (  -- соседний день у строк со сменой типа: вчера — для «в», завтра — для «из»
    select distinct e, dt - 1 as d from r where a_in
    union
    select distinct e, dt + 1 from r where a_out
),
v as (  -- тип численности соседнего дня (строк несколько — меньший), в любом подразделении
    select n.e, n.d, min(coalesce(nullif(trim(x.active_type_nm::text), ''), '-')) as tp
    from n
    join usr_cross_data.hr_executive_proteus x on x.mdm_employee_rk = n.e and x.calendar_dt = n.d
    where x.calendar_dt >= '2025-10-30'
    group by 1, 2
)
select r.smp, date_trunc('month', case when r.a_in then r.dt else r.dt + case when r.ld then 1 else 0 end end)::date
           as month,
       case when r.a_in then 'в' else 'из' end as d,
       case when r.a_in then vi.tp else r.tp end as type_from, case when r.a_in then r.tp else vo.tp end as type_to,
       count(*) as events
from r
left join v vi on vi.e = r.e and vi.d = r.dt - 1
left join v vo on vo.e = r.e and vo.d = r.dt + 1
where (r.a_in and not r.u_in and not r.i_in and not r.ex_in and coalesce(vi.tp, '') in ('Активная', 'Подрядчики'))
   or (r.a_out and not r.a_in and not r.u_out and not r.i_out and not r.ex_out and coalesce(vo.tp, '') in ('Активная', 'Подрядчики'))
group by 1, 2, 3, 4, 5
order by 1, 2, 3;

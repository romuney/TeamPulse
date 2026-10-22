-- =============================================================================
-- TeamPulse Hub · 5. Переводы — как в мастер-отчёте (поставки 59–60)
-- teampulse_hub_trf — узел × месяц × вид × срез × флаги: датасет считает из них переводы в выбор и из
-- выбора под фильтры. Логика — мастер-отчёта (старый TeamPulse: transfer_in / transfer_out), сверена на
-- выборках боя: событие — строка дня с флагом источника, «в» и «из» считаются отдельно, каждое — по
-- состоянию своей строки.
--   i  перевод в: строка — первый день в новом состоянии. Узел — юнит строки на каждом уровне (структура
--      того дня), флаг юнита — этого уровня (lvlN_mngt_unit_in_trsf_flg). Найм — не перевод (вид h)
--   o  перевод из: строка — последний день в старом состоянии (lvlN_mngt_unit_out_trsf_flg, transfer_out_*),
--      увольнение — не перевод. Последний день месяца (last_day_of_month_flg) — следующий месяц
--   h  найм в компанию: узлы и срез дня найма
-- fu — флаг юнита этого уровня; fa / fp / fi / fs — смена типа численности, покраски, IT-кода, типа
-- оформления: датасет засчитывает их, только когда выбран этот фильтр (тип численности — любой набор
-- типов active_type_nm, по умолчанию «Активная»). Фильтр из нескольких значений — только если x_…
-- (вчера для «в», завтра для «из») вне выбора: Подрядчики → Активная при выборе «Активная + Подрядчики» —
-- не перевод, при одной «Активной» — перевод «в». in_ok = 0 — кандидат учебного юнита или стажёр: при
-- выборе типов это найм, не перевод.
-- =============================================================================
-- шаги — таблицами, не CTE: у таблицы есть статистика (analyze), и план не ошибается в числе строк
-- (CTE оценивается в единицы строк — на объёме боя план выбирал вложенный цикл)
drop table if exists teampulse_hub_trfr;
create table teampulse_hub_trfr as
-- строки дня с событием; одинаковые строки — одна (как distinct мастер-отчёта)
select distinct x.mdm_employee_rk as e, x.calendar_dt::date as dt,
       coalesce(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') as k1,
       coalesce(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') as k2,
       coalesce(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') as k3,
       coalesce(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') as k4,
       coalesce(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') as k5,
       coalesce(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') as k6,
       coalesce(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') as k7,
       coalesce(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') as k8,
       coalesce(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') as k9,
       coalesce(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') as k10,
       coalesce(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') as k11,
       (coalesce(x.lvl1_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui1,
       (coalesce(x.lvl2_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui2,
       (coalesce(x.lvl3_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui3,
       (coalesce(x.lvl4_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui4,
       (coalesce(x.lvl5_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui5,
       (coalesce(x.lvl6_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui6,
       (coalesce(x.lvl7_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui7,
       (coalesce(x.lvl8_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui8,
       (coalesce(x.lvl9_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui9,
       (coalesce(x.lvl10_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui10,
       (coalesce(x.lvl11_mngt_unit_in_trsf_flg::text, '0') = '1')::int as ui11,
       (coalesce(x.lvl1_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo1,
       (coalesce(x.lvl2_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo2,
       (coalesce(x.lvl3_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo3,
       (coalesce(x.lvl4_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo4,
       (coalesce(x.lvl5_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo5,
       (coalesce(x.lvl6_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo6,
       (coalesce(x.lvl7_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo7,
       (coalesce(x.lvl8_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo8,
       (coalesce(x.lvl9_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo9,
       (coalesce(x.lvl10_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo10,
       (coalesce(x.lvl11_mngt_unit_out_trsf_flg::text, '0') = '1')::int as uo11,
       coalesce(nullif(coalesce(x.emp_specialization_oper_code::text, '-'), ''), '-') as pa, coalesce(nullif(coalesce(x.emp_specialization_it_code::text, '-'), ''), '-') as it,
       case when x.employment_relation_type_desc = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as st,
       coalesce(nullif(trim(x.active_type_nm::text), ''), '-') as ac,
       (coalesce(x.hire_flg::text, '0') = '1')::int as hf, least((coalesce(x.transfer_candidate_flg::text, '0') = '1')::int + (coalesce(x.transfer_internal_flg::text, '0') = '1')::int, 1) as cv,
       (coalesce(x.fire_flg::text, '0') = '1')::int as fx, (coalesce(x.last_day_of_month_flg::text, '0') = '1')::int as ld,
       (coalesce(x.transfer_to_active_type_flg::text, '0') = '1')::int as ia, (coalesce(x.transfer_out_active_type_flg::text, '0') = '1')::int as oa,
       (coalesce(x.transfer_to_hq_flg::text, '0') = '1')::int as ip, (coalesce(x.transfer_out_hq_flg::text, '0') = '1')::int as oq,
       (coalesce(x.transfer_to_it_flg::text, '0') = '1')::int as ii, (coalesce(x.transfer_out_it_flg::text, '0') = '1')::int as oi,
       (coalesce(x.transfer_to_employment_relation_type_flg::text, '0') = '1')::int as ist, (coalesce(x.transfer_out_employment_relation_type_flg::text, '0') = '1')::int as ost
from usr_cross_data.hr_executive_proteus x
-- сетка отчёта и последний день перед ней (перевод «из» в этот день — уже первый месяц сетки);
-- первое условие — отсечение партиций
where x.calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
  and x.calendar_dt >= (select grid_start from teampulse_hub_cal) - 1
  and x.calendar_dt < ((select lm from teampulse_hub_cal) + interval '1 month')::date
  and (coalesce(x.hire_flg::text, '0') = '1' or coalesce(x.lvl1_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl1_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl2_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl2_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl3_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl3_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl4_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl4_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl5_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl5_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl6_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl6_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl7_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl7_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl8_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl8_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl9_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl9_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl10_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl10_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.lvl11_mngt_unit_in_trsf_flg::text, '0') = '1' or
       coalesce(x.lvl11_mngt_unit_out_trsf_flg::text, '0') = '1' or coalesce(x.transfer_to_active_type_flg::text, '0') = '1' or
       coalesce(x.transfer_out_active_type_flg::text, '0') = '1' or coalesce(x.transfer_to_hq_flg::text, '0') = '1' or
       coalesce(x.transfer_out_hq_flg::text, '0') = '1' or coalesce(x.transfer_to_it_flg::text, '0') = '1' or
       coalesce(x.transfer_out_it_flg::text, '0') = '1' or
       coalesce(x.transfer_to_employment_relation_type_flg::text, '0') = '1' or
       coalesce(x.transfer_out_employment_relation_type_flg::text, '0') = '1')
distributed by (e);
analyze teampulse_hub_trfr;

drop table if exists teampulse_hub_trfv;
create table teampulse_hub_trfv as
-- значения соседнего дня у строк со сменой атрибута: вчера — для «в», завтра — для «из». Нужны фильтрам из
-- нескольких значений: смена между двумя выбранными значениями (Line → Support при «Line + Support») — не
-- перевод. Строк в этот день несколько — меньшее значение
select n.e, n.d, min(coalesce(nullif(coalesce(x.emp_specialization_oper_code::text, '-'), ''), '-')) as pa, min(coalesce(nullif(coalesce(x.emp_specialization_it_code::text, '-'), ''), '-')) as it,
       min(case when x.employment_relation_type_desc = 'Штатный сотрудник' then 'Штат' else 'Не штат' end) as st, min(coalesce(nullif(trim(x.active_type_nm::text), ''), '-')) as ac
from (
    select distinct r.e, r.dt - 1 as d from teampulse_hub_trfr r where r.hf = 0 and r.ia + r.ip + r.ii + r.ist > 0
    union
    select distinct r.e, r.dt + 1 from teampulse_hub_trfr r where r.fx = 0 and r.oa + r.oq + r.oi + r.ost > 0
) n
join usr_cross_data.hr_executive_proteus x on x.mdm_employee_rk = n.e and x.calendar_dt = n.d
where x.calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
  and x.calendar_dt >= (select grid_start from teampulse_hub_cal) - 2
  and x.calendar_dt <= ((select lm from teampulse_hub_cal) + interval '1 month')::date
group by 1, 2
distributed by (e);
analyze teampulse_hub_trfv;

drop table if exists teampulse_hub_trf;
create table teampulse_hub_trf as
select * from (
with r as (
    -- строка и соседний день: xi_… — вчера (для «в»), xo_… — завтра (для «из»), только у строк со сменой
    -- атрибута. Соседний день — до раскрытия по уровням: соединение в 11 раз меньше
    select r.*, vi.pa as xi_pa, vi.it as xi_it, vi.st as xi_st, vi.ac as xi_ac,
           vo.pa as xo_pa, vo.it as xo_it, vo.st as xo_st, vo.ac as xo_ac
    from teampulse_hub_trfr r
    left join teampulse_hub_trfv vi on vi.e = r.e and vi.d = r.dt - 1 and r.hf = 0 and r.ia + r.ip + r.ii + r.ist > 0
    left join teampulse_hub_trfv vo on vo.e = r.e and vo.d = r.dt + 1 and r.fx = 0 and r.oa + r.oq + r.oi + r.ost > 0
),
e as (
    -- узлы строки — юнит на каждом уровне; флаг юнита — этого уровня
    select z.* from (
        select r.*, unnest(ARRAY[r.k1, r.k2, r.k3, r.k4, r.k5, r.k6, r.k7, r.k8, r.k9, r.k10, r.k11]) as node_rk,
               unnest(ARRAY[r.ui1, r.ui2, r.ui3, r.ui4, r.ui5, r.ui6, r.ui7, r.ui8, r.ui9, r.ui10, r.ui11]) as fu_in,
               unnest(ARRAY[r.uo1, r.uo2, r.uo3, r.uo4, r.uo5, r.uo6, r.uo7, r.uo8, r.uo9, r.uo10, r.uo11]) as fu_out
        from r
    ) z
    where z.node_rk <> '-'
    union all
    -- общий корень над несколькими корнями: переход между корнями — внутри него, не перевод
    select r.*, 'all', 0, 0 from r where (select mo from teampulse_hub_cal) = 1
)
select node_rk, report_month, trf_kind, paint_cd, it_cd, staff_cd, act_cd, fu, fa, fp, fi, fs, in_ok,
       x_paint_cd, x_it_cd, x_staff_cd, x_act_cd, count(*) as trf_cnt
from (
    -- в: флаг «в» на строке; найм — отдельно (h)
    select e.node_rk, date_trunc('month', e.dt)::date as report_month, 'i' as trf_kind,
           e.pa as paint_cd, e.it as it_cd, e.st as staff_cd, e.ac as act_cd,
           e.fu_in as fu, e.ia as fa, e.ip as fp, e.ii as fi, e.ist as fs, 1 - e.cv as in_ok,
           e.xi_pa as x_paint_cd, e.xi_it as x_it_cd, e.xi_st as x_staff_cd, e.xi_ac as x_act_cd
    from e
    where e.hf = 0 and (e.fu_in = 1 or e.ia = 1 or e.ip = 1 or e.ii = 1 or e.ist = 1)
    union all
    -- из: флаг «из» на строке, без увольнения; последний день месяца — в следующий месяц
    select e.node_rk, date_trunc('month', e.dt + e.ld)::date, 'o',
           e.pa, e.it, e.st, e.ac, e.fu_out, e.oa, e.oq, e.oi, e.ost, 1,
           e.xo_pa, e.xo_it, e.xo_st, e.xo_ac
    from e
    where e.fx = 0 and (e.fu_out = 1 or e.oa = 1 or e.oq = 1 or e.oi = 1 or e.ost = 1)
    union all
    -- найм в компанию: узлы и срез дня найма
    select e.node_rk, date_trunc('month', e.dt)::date, 'h', e.pa, e.it, e.st, e.ac, 0, 0, 0, 0, 0, 1,
           null::text, null::text, null::text, null::text
    from e
    where e.hf = 1
) t
where report_month between (select grid_start from teampulse_hub_cal) and (select lm from teampulse_hub_cal)
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17
) q
distributed by (node_rk);
drop table if exists teampulse_hub_trfr;
drop table if exists teampulse_hub_trfv;

select trf_kind, count(*) as rows_cnt, coalesce(sum(trf_cnt), 0) as events
from teampulse_hub_trf
group by 1
order by 1;

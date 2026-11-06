-- =============================================================================
-- TeamPulse Hub · 4в. Водопад движения — замкнутая витрина teampulse_hub_flow (поставка 105, 06.11).
-- Принцип (заказчик): у каждой строки отчёта — подразделения на любом уровне и специализации —
-- «конец = начало + найм − отток + переводы в − переводы из» тождественно, без «прочего».
-- Принадлежность строке — как численность series: строка человека в ПОСЛЕДНИЙ ДЕНЬ ДАННЫХ месяца
-- (eom_flg build_all_metrics: последний календарный день месяца, для неполного — max(calendar_dt)
-- источника), не уволен в этот день; юнит-путь — как series: pre || coalesce(upath, lvl-цепочка).
-- Перевод «в» = стал принадлежать этой строке (пришёл откуда угодно: другой юнит, другая
-- специализация, другой тип численности, возвращение), «из» = перестал принадлежать. Категории
-- «внутри юнита» нет: перемещение внутри узла — это «из» старой строки и «в» новую (в строке узла
-- суммарно гасится, в строках специализаций — видно). Найм/отток — события месяца, приписаны строке
-- конца месяца (найм) / строке прошлого месяца (отток); нанят-и-уволен-в-месяц — найм и отток его
-- строки. Замыкание любой агрегации строк — по построению (двойная запись); проверка — hub checks
-- №27 (баланс) и №28 (fin = hc series, узел × месяц × срез).
-- Зерно: узел × месяц × специализация × срез. Строки: sp_cd = '-' (юнит целиком) и по специализации.
-- Правило переводов trf (вкладка «Переводы», сверена с мастер-эталонами) НЕ меняется.
-- =============================================================================

-- 0. последний день данных источника (для eom неполного месяца) — один раз
drop table if exists teampulse_hub_fdts;
create table teampulse_hub_fdts as
select max(calendar_dt)::date as max_dt from usr_cross_data.hr_executive_proteus
distributed randomly;

-- 1. последняя строка человека в месяце (+ месяц перед сеткой — для «начала» первого месяца)
drop table if exists teampulse_hub_flp;
create table teampulse_hub_flp as
select distinct on (e, m) e, m, sp, ac, pa, itc, st,
       k1, k2, k3, k4, k5, k6, k7, k8, k9, k10, k11, fx, is_eom,
       case when k11 <> '-' then k11 when k10 <> '-' then k10 when k9 <> '-' then k9
            when k8 <> '-' then k8 when k7 <> '-' then k7 when k6 <> '-' then k6
            when k5 <> '-' then k5 when k4 <> '-' then k4 when k3 <> '-' then k3
            when k2 <> '-' then k2 when k1 <> '-' then k1 else '-' end as leaf_rk,
       case when k11 <> '-' then 11 when k10 <> '-' then 10 when k9 <> '-' then 9
            when k8 <> '-' then 8 when k7 <> '-' then 7 when k6 <> '-' then 6
            when k5 <> '-' then 5 when k4 <> '-' then 4 when k3 <> '-' then 3
            when k2 <> '-' then 2 when k1 <> '-' then 1 else 0 end as leaf_lvl
from (
    select x.mdm_employee_rk as e, date_trunc('month', x.calendar_dt)::date as m,
           translate(coalesce(nullif(trim(x.employee_specialization_desc::text), ''), '-'), E'\t\n|', '  /') as sp,
           coalesce(nullif(trim(x.active_type_nm::text), ''), '-') as ac,
           coalesce(nullif(coalesce(x.emp_specialization_oper_code::text, '-'), ''), '-') as pa,
           coalesce(nullif(coalesce(x.emp_specialization_it_code::text, '-'), ''), '-') as itc,
           case when x.employment_relation_type_desc = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as st,
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
           (coalesce(x.fire_flg::text, '0') = '1')::int as fx,
           (x.calendar_dt::date = least((date_trunc('month', x.calendar_dt) + interval '1 month'
                                         - interval '1 day')::date, f.max_dt)) as is_eom,
           x.calendar_dt
    from usr_cross_data.hr_executive_proteus x
    cross join teampulse_hub_fdts f
    where x.calendar_dt >= ((select grid_start from teampulse_hub_cal) - interval '1 month')::date
      and x.calendar_dt < ((select lm from teampulse_hub_cal) + interval '1 month')::date
) z
order by e, m, calendar_dt desc
distributed by (e);
analyze teampulse_hub_flp;

-- 2. найм/увольнение месяца (max по дням)
drop table if exists teampulse_hub_flg;
create table teampulse_hub_flg as
select mdm_employee_rk as e, date_trunc('month', calendar_dt)::date as m,
       max((coalesce(hire_flg::text, '0') = '1')::int) as hf,
       max((coalesce(fire_flg::text, '0') = '1')::int) as fxx
from usr_cross_data.hr_executive_proteus
where calendar_dt >= ((select grid_start from teampulse_hub_cal) - interval '1 month')::date
  and calendar_dt < ((select lm from teampulse_hub_cal) + interval '1 month')::date
group by 1, 2
distributed by (e);
analyze teampulse_hub_flg;

-- 3. события человека × месяца: принадлежность (как series), найм, отток, смена ключа строки,
--    пути узлов cur/prev как в series: pre || coalesce(upath, lvl-цепочка месяца)
drop table if exists teampulse_hub_fle;
create table teampulse_hub_fle as
select q.e, q.m,
       (q.fx = 0 and q.is_eom and q.leaf_lvl > 0) as in_cur,
       (q.pe is not null and q.pfx = 0 and q.pis_eom and q.pleaf_lvl > 0) as in_prev,
       coalesce(q.hf, 0) as hf,
       coalesce(q.fxx, 0) as fxx,
       -- найм: нанят и принадлежит строке конца месяца; нанят-и-уволен-в-месяц (без строки прошлого) — найм его строки
       (coalesce(q.hf, 0) = 1 and ((q.fx = 0 and q.is_eom and q.leaf_lvl > 0)
                                    or ((q.pe is null or not (q.pfx = 0 and q.pis_eom and q.pleaf_lvl > 0))
                                        and coalesce(q.fxx, 0) = 1))) as hire_ev,
       -- отток: уволен и был в строке прошлого месяца
       (coalesce(q.fxx, 0) = 1 and q.pe is not null and q.pfx = 0 and q.pis_eom and q.pleaf_lvl > 0) as fire_prev,
       -- отток «нанят и уволен в месяц» — на строку текущего месяца (последняя строка — день увольнения)
       (coalesce(q.fxx, 0) = 1 and coalesce(q.hf, 0) = 1
        and (q.pe is null or not (q.pfx = 0 and q.pis_eom and q.pleaf_lvl > 0)) and q.fx = 1) as fire_cur,
       -- пути узлов как в series (шаг 6 «hub · 1»: upath юнита нынешней структуры, нет его — lvl-цепочка месяца)
       q.cp_c, q.cp_p,
       -- смена ключа строки: путь узлов + срезы (+ тип численности — колонка строки)
       (ARRAY[q.cp_c, q.pa, q.itc, q.st, q.ac]
        <> ARRAY[q.cp_p, q.pa_p, q.itc_p, q.st_p, q.ac_p]) as key_u,
       q.sp as sp_c, coalesce(q.sp_p, '-') as sp_p,
       q.pa, q.itc, q.st, q.ac as ac_c,
       q.pa_p, q.itc_p, q.st_p, q.ac_p
from (
    select c.e, c.m,
           c.fx, c.is_eom, c.leaf_lvl, c.sp, c.pa, c.itc, c.st, c.ac,
           p.e as pe, p.fx as pfx, p.is_eom as pis_eom, p.leaf_lvl as pleaf_lvl,
           p.sp as sp_p, coalesce(p.pa, '-') as pa_p, coalesce(p.itc, '-') as itc_p,
           coalesce(p.st, '-') as st_p, coalesce(p.ac, '-') as ac_p,
           g.hf, g.fxx,
           (select pre from teampulse_hub_cal)
             || coalesce(uc.cp, array_to_string((ARRAY[c.k1, c.k2, c.k3, c.k4, c.k5, c.k6, c.k7, c.k8, c.k9, c.k10, c.k11])[1:c.leaf_lvl], '|')) as cp_c,
           (select pre from teampulse_hub_cal)
             || coalesce(up.cp, array_to_string((ARRAY[coalesce(p.k1, '-'), coalesce(p.k2, '-'), coalesce(p.k3, '-'),
                                                         coalesce(p.k4, '-'), coalesce(p.k5, '-'), coalesce(p.k6, '-'),
                                                         coalesce(p.k7, '-'), coalesce(p.k8, '-'), coalesce(p.k9, '-'),
                                                         coalesce(p.k10, '-'), coalesce(p.k11, '-')])[1:coalesce(p.leaf_lvl, 0)], '|')) as cp_p
    from teampulse_hub_flp c
    left join teampulse_hub_flp p on p.e = c.e and p.m = (c.m - interval '1 month')::date
    left join teampulse_hub_flg g on g.e = c.e and g.m = c.m
    left join teampulse_hub_upath uc on uc.unit_rk = c.leaf_rk
    left join teampulse_hub_upath up on up.unit_rk = coalesce(p.leaf_rk, '-')
    where c.m >= (select grid_start from teampulse_hub_cal)
) q
distributed by (e);
analyze teampulse_hub_fle;

-- 4. ключ со специализацией и сама витрина: двойная запись событий в строки
--    (юнит-строки sp = '-' — ключ без специализации; строки специализаций — с ней)
drop table if exists teampulse_hub_flow;
create table teampulse_hub_flow as
with ev as (
    select f.*,
           (f.key_u or f.sp_c <> f.sp_p) as key_s
    from teampulse_hub_fle f
)
select node_rk, report_month, sp_cd, paint_cd, it_cd, staff_cd, act_cd,
       sum(beg) as beg_cnt, sum(hire) as hire_cnt, sum(fire) as fire_cnt,
       sum(tin) as tin_cnt, sum(tout) as tout_cnt, sum(fin) as fin_cnt
from (
    -- ===== юнит-строки (специализация '-' = юнит целиком) =====
    select unnest(string_to_array(cp_p, '|')) as node_rk, m as report_month,
           '-'::text as sp_cd, pa_p as paint_cd, itc_p as it_cd, st_p as staff_cd, ac_p as act_cd,
           (in_prev)::int as beg, 0::int as hire, 0::int as fire, 0::int as tin, 0::int as tout, 0::int as fin
    from ev where in_prev
    union all
    select unnest(string_to_array(cp_c, '|')), m, '-', pa, itc, st, ac_c,
           0, 0, 0, 0, 0, (in_cur)::int
    from ev where in_cur
    union all
    select unnest(string_to_array(cp_c, '|')), m, '-', pa, itc, st, ac_c,
           0, (hire_ev)::int, 0, 0, 0, 0
    from ev where hire_ev
    union all
    select unnest(string_to_array(cp_p, '|')), m, '-', pa_p, itc_p, st_p, ac_p,
           0, 0, (fire_prev)::int, 0, 0, 0
    from ev where fire_prev
    union all
    select unnest(string_to_array(cp_c, '|')), m, '-', pa, itc, st, ac_c,
           0, 0, (fire_cur)::int, 0, 0, 0
    from ev where fire_cur
    union all
    select unnest(string_to_array(cp_c, '|')), m, '-', pa, itc, st, ac_c,
           0, 0, 0, (in_cur and hf = 0 and ((not in_prev) or key_u))::int, 0, 0
    from ev where in_cur
    union all
    select unnest(string_to_array(cp_p, '|')), m, '-', pa_p, itc_p, st_p, ac_p,
           0, 0, 0, 0, (in_prev and fxx = 0 and ((not in_cur) or key_u))::int, 0
    from ev where in_prev
    union all
    -- ===== строки специализаций (только люди С специализацией: sp '-' склеился бы с юнит-строками
    --      и удваивал их; человек без специализации виден только в строке юнита) =====
    select unnest(string_to_array(cp_p, '|')) as node_rk, m as report_month,
           sp_p as sp_cd, pa_p as paint_cd, itc_p as it_cd, st_p as staff_cd, ac_p as act_cd,
           (in_prev)::int as beg, 0::int as hire, 0::int as fire, 0::int as tin, 0::int as tout, 0::int as fin
    from ev where in_prev and sp_p <> '-'
    union all
    select unnest(string_to_array(cp_c, '|')), m, sp_c, pa, itc, st, ac_c,
           0, 0, 0, 0, 0, (in_cur)::int
    from ev where in_cur and sp_c <> '-'
    union all
    select unnest(string_to_array(cp_c, '|')), m, sp_c, pa, itc, st, ac_c,
           0, (hire_ev)::int, 0, 0, 0, 0
    from ev where hire_ev and sp_c <> '-'
    union all
    select unnest(string_to_array(cp_p, '|')), m, sp_p, pa_p, itc_p, st_p, ac_p,
           0, 0, (fire_prev)::int, 0, 0, 0
    from ev where fire_prev and sp_p <> '-'
    union all
    select unnest(string_to_array(cp_c, '|')), m, sp_c, pa, itc, st, ac_c,
           0, 0, (fire_cur)::int, 0, 0, 0
    from ev where fire_cur and sp_c <> '-'
    union all
    select unnest(string_to_array(cp_c, '|')), m, sp_c, pa, itc, st, ac_c,
           0, 0, 0, (in_cur and hf = 0 and ((not in_prev) or key_s))::int, 0, 0
    from ev where in_cur and sp_c <> '-'
    union all
    select unnest(string_to_array(cp_p, '|')), m, sp_p, pa_p, itc_p, st_p, ac_p,
           0, 0, 0, 0, (in_prev and fxx = 0 and ((not in_cur) or key_s))::int, 0
    from ev where in_prev and sp_p <> '-' 
) t
group by 1, 2, 3, 4, 5, 6, 7
distributed by (node_rk);
analyze teampulse_hub_flow;

select count(*) as flow_rows, count(distinct node_rk) as flow_nodes from teampulse_hub_flow;
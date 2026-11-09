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

-- 2. найм/увольнение месяца (max по дням). 09.11 (владелец: «логика расчёта метрики не может быть разная»): найм — как
--    «Найм, чел» рядов (hub · 3, методология DD): найм в компанию + из учебной группы в боевую + стажёры в штат; раньше
--    водопад брал только hire_flg, а переходы из учебной группы и стажёров писал переводами «в»
drop table if exists teampulse_hub_flg;
create table teampulse_hub_flg as
select mdm_employee_rk as e, date_trunc('month', calendar_dt)::date as m,
       max((coalesce(hire_flg::text, '0') = '1')::int) as hf,
       max((coalesce(transfer_candidate_flg::text, '0') = '1' or coalesce(transfer_internal_flg::text, '0') = '1')::int) as cf,
       max((coalesce(fire_flg::text, '0') = '1')::int) as fxx
from usr_cross_data.hr_executive_proteus
where calendar_dt >= ((select grid_start from teampulse_hub_cal) - interval '1 month')::date
  and calendar_dt < ((select lm from teampulse_hub_cal) + interval '1 month')::date
group by 1, 2
distributed by (e);
analyze teampulse_hub_flg;

-- 2б. 09.11: юнит дня найма — «Найм, чел» рядов стоит в строке юнита, где был найм (build_all_metrics: строка — человек ×
--     месяц × юнит), срез — на конец месяца. Водопад пишет найм туда же; переход в другой юнит до конца месяца — перевод
drop table if exists teampulse_hub_flh;
create table teampulse_hub_flh as
select distinct on (e, m) e, m, k1, k2, k3, k4, k5, k6, k7, k8, k9, k10, k11,
       case when k11 <> '-' then k11 when k10 <> '-' then k10 when k9 <> '-' then k9 when k8 <> '-' then k8 when k7 <> '-' then k7 when k6 <> '-' then k6 when k5 <> '-' then k5 when k4 <> '-' then k4 when k3 <> '-' then k3 when k2 <> '-' then k2 when k1 <> '-' then k1 else '-' end as leaf_rk,
       case when k11 <> '-' then 11 when k10 <> '-' then 10 when k9 <> '-' then 9 when k8 <> '-' then 8 when k7 <> '-' then 7 when k6 <> '-' then 6 when k5 <> '-' then 5 when k4 <> '-' then 4 when k3 <> '-' then 3 when k2 <> '-' then 2 when k1 <> '-' then 1 else 0 end as leaf_lvl
from (
    select x.mdm_employee_rk as e, date_trunc('month', x.calendar_dt)::date as m,
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
           x.calendar_dt
    from usr_cross_data.hr_executive_proteus x
    where x.calendar_dt >= ((select grid_start from teampulse_hub_cal) - interval '1 month')::date
      and x.calendar_dt < ((select lm from teampulse_hub_cal) + interval '1 month')::date
      and (coalesce(x.hire_flg::text, '0') = '1' or coalesce(x.transfer_candidate_flg::text, '0') = '1'
           or coalesce(x.transfer_internal_flg::text, '0') = '1')
) z
order by e, m, calendar_dt
distributed by (e);
analyze teampulse_hub_flh;

-- 3. события человека × месяца: принадлежность (как series), найм, отток, смена ключа строки,
--    пути узлов cur/prev как в series: pre || coalesce(upath, lvl-цепочка месяца)
drop table if exists teampulse_hub_fle;
create table teampulse_hub_fle as
select q.e, q.m,
       (q.fx = 0 and q.is_eom and q.leaf_lvl > 0) as in_cur,
       (q.pe is not null and q.pfx = 0 and q.pis_eom and q.pleaf_lvl > 0) as in_prev,
       -- 09.11: строка конца месяца — у уволенного в месяце это строка дня увольнения (последняя строка месяца)
       (q.leaf_lvl > 0 and ((q.fx = 0 and q.is_eom) or (coalesce(q.fxx, 0) = 1 and q.fx = 1))) as in_end,
       coalesce(q.hf, 0) as hf,
       coalesce(q.fxx, 0) as fxx,
       -- найм — как ряды (hub · 3), событие месяца на строке конца месяца (у уволенного — дня увольнения):
       -- hire_ev — методология DD («Найм, чел» при выбранных типах численности): найм в компанию в «Активную» + из
       -- учебной группы в боевую + стажёр в штат; hco_ev — найм в компанию с любым типом («Найм, чел» при «Вся»);
       -- conv — переход из учебной группы / стажёров (найм DD без найма в компанию)
       (q.leaf_lvl > 0 and ((q.fx = 0 and q.is_eom) or (coalesce(q.fxx, 0) = 1 and q.fx = 1))
        and ((coalesce(q.hf, 0) = 1 and q.ac = 'Активная') or coalesce(q.cf, 0) = 1)) as hire_ev,
       (q.leaf_lvl > 0 and ((q.fx = 0 and q.is_eom) or (coalesce(q.fxx, 0) = 1 and q.fx = 1))
        and coalesce(q.hf, 0) = 1) as hco_ev,
       (q.leaf_lvl > 0 and ((q.fx = 0 and q.is_eom) or (coalesce(q.fxx, 0) = 1 and q.fx = 1))
        and coalesce(q.cf, 0) = 1 and not (coalesce(q.hf, 0) = 1 and q.ac = 'Активная')) as conv,
       -- 09.11: отток — как «Ушли, чел» рядов: подразделение и срез дня увольнения (строка месяца увольнения); раньше —
       -- строка конца прошлого месяца. Сменил подразделение или срез перед уходом — это перевод, потом увольнение
       (coalesce(q.fxx, 0) = 1 and q.leaf_lvl > 0
        and ((q.fx = 0 and q.is_eom) or q.fx = 1)) as fire_ev,
       -- пути узлов как в series (шаг 6 «hub · 1»: upath юнита нынешней структуры, нет его — lvl-цепочка месяца)
       q.cp_c, q.cp_p, coalesce(q.cp_h, q.cp_c) as cp_h,
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
           g.hf, g.cf, g.fxx,
           (select pre from teampulse_hub_cal)
             || coalesce(uc.cp, array_to_string((ARRAY[c.k1, c.k2, c.k3, c.k4, c.k5, c.k6, c.k7, c.k8, c.k9, c.k10, c.k11])[1:c.leaf_lvl], '|')) as cp_c,
           (select pre from teampulse_hub_cal)
             || coalesce(up.cp, array_to_string((ARRAY[coalesce(p.k1, '-'), coalesce(p.k2, '-'), coalesce(p.k3, '-'),
                                                         coalesce(p.k4, '-'), coalesce(p.k5, '-'), coalesce(p.k6, '-'),
                                                         coalesce(p.k7, '-'), coalesce(p.k8, '-'), coalesce(p.k9, '-'),
                                                         coalesce(p.k10, '-'), coalesce(p.k11, '-')])[1:coalesce(p.leaf_lvl, 0)], '|')) as cp_p,
           case when h.e is not null then (select pre from teampulse_hub_cal)
             || coalesce(uh.cp, array_to_string((ARRAY[h.k1, h.k2, h.k3, h.k4, h.k5, h.k6, h.k7, h.k8, h.k9, h.k10, h.k11])[1:h.leaf_lvl], '|')) end as cp_h
    from teampulse_hub_flp c
    left join teampulse_hub_flp p on p.e = c.e and p.m = (c.m - interval '1 month')::date
    left join teampulse_hub_flg g on g.e = c.e and g.m = c.m
    left join teampulse_hub_flh h on h.e = c.e and h.m = c.m
    left join teampulse_hub_upath uh on uh.unit_rk = h.leaf_rk
    left join teampulse_hub_upath uc on uc.unit_rk = c.leaf_rk
    left join teampulse_hub_upath up on up.unit_rk = coalesce(p.leaf_rk, '-')
    where c.m >= (select grid_start from teampulse_hub_cal)
) q
distributed by (e);
analyze teampulse_hub_fle;

-- 4. ключ со специализацией и сама витрина: двойная запись событий в строки
--    (юнит-строки sp = '-' — ключ без специализации; строки специализаций — с ней)
-- 06.11 (владелец, поставка 105): перевод — вход в периметр отчёта или выход из него не наймом и не увольнением;
-- периметр — узел + выбранные фильтры (тип численности, покраска, IT, штат). Поэтому:
--   * в узел перевод пишется, только если человек пришёл в узел извне или ушёл из него (chg_unit = 1: узла нет в другом
--     пути, или человека не было / не стало в численности); переход между подразделениями внутри узла самому узлу не
--     пишется — человек и в начале, и в конце той же строки узла;
--   * смена среза внутри узла пишется со срезом ДРУГОЙ стороны перехода (oth_paint_cd / oth_it_cd / oth_staff_cd /
--     oth_act_cd; у «в» — откуда пришёл, у «из» — куда ушёл): датасет засчитывает перевод, только если другая сторона вне
--     выбранных фильтров (Support → HQ при фильтре HQ — перевод; при фильтре HQ + Support или без фильтра покраски — нет);
--   * у строк специализаций смена специализации (chg_sp) — всегда перевод: специализация — часть периметра строки.
-- Баланс каждой строки и проверки №27–28 — как были (новые колонки — часть зерна)
drop table if exists teampulse_hub_flow;
create table teampulse_hub_flow as
with ev as (
    select f.*,
           (f.key_u or f.sp_c <> f.sp_p) as key_s,
           string_to_array(f.cp_c, '|') as ac_arr, string_to_array(f.cp_p, '|') as ap_arr,
           string_to_array(f.cp_h, '|') as ah_arr,
           (f.pa <> f.pa_p)::int as dp, (f.itc <> f.itc_p)::int as di, (f.st <> f.st_p)::int as ds,
           (f.ac_c <> f.ac_p)::int as da, (f.sp_c <> f.sp_p)::int as dsp
    from teampulse_hub_fle f
),
-- переводы «в»: узлы новой строки; «из»: узлы старой строки
ti as (
    select z.*, ((not z.in_prev) or not (z.node_rk = any(z.ap_arr)))::int as cu
    from (select ev.*, unnest(ev.ac_arr) as node_rk from ev
          where in_end and not hire_ev and not hco_ev and ((not in_prev) or key_s)) z
),
tu as (
    select z.*, ((not z.in_end) or not (z.node_rk = any(z.ac_arr)))::int as cu
    from (select ev.*, unnest(ev.ap_arr) as node_rk from ev
          where in_prev and ((not in_end) or key_s)) z
)
select node_rk, report_month, sp_cd, paint_cd, it_cd, staff_cd, act_cd,
       chg_unit, chg_sp, oth_paint_cd, oth_it_cd, oth_staff_cd, oth_act_cd,
       sum(beg) as beg_cnt, sum(hire) as hire_cnt, sum(hco) as hco_cnt, sum(fire) as fire_cnt,
       sum(tin) as tin_cnt, sum(tout) as tout_cnt, sum(fin) as fin_cnt
from (
    -- столбцы: beg, hire (DD), hco (найм в компанию с любым типом), fire, tin, tout, fin.
    -- 09.11: найм в компанию не по DD (тип не «Активная») при выбранных типах — «в» с другой стороной '+' (вне любого
    -- выбора типов: засчитан), при «Вся» не засчитан — там это найм hco; переход из учебной группы / стажёров — найм DD,
    -- его «из» в старом типе — тоже с другой стороной '+' (засчитан при любом выборе типов, как найм DD)
    -- ===== юнит-строки (специализация '-' = юнит целиком) =====
    select unnest(ap_arr) as node_rk, m as report_month,
           '-'::text as sp_cd, pa_p as paint_cd, itc_p as it_cd, st_p as staff_cd, ac_p as act_cd,
           0 as chg_unit, 0 as chg_sp, ''::text as oth_paint_cd, ''::text as oth_it_cd, ''::text as oth_staff_cd,
           ''::text as oth_act_cd,
           1 as beg, 0 as hire, 0 as hco, 0 as fire, 0 as tin, 0 as tout, 0 as fin
    from ev where in_prev
    union all
    select unnest(ac_arr), m, '-', pa, itc, st, ac_c, 0, 0, '', '', '', '', 0, 0, 0, 0, 0, 0, 1
    from ev where in_cur
    union all
    select unnest(ah_arr), m, '-', pa, itc, st, ac_c, 0, 0, '', '', '', '', 0, 1, 0, 0, 0, 0, 0
    from ev where hire_ev
    union all
    select unnest(ah_arr), m, '-', pa, itc, st, ac_c, 0, 0, '', '', '', '', 0, 0, 1, 0, 0, 0, 0
    from ev where hco_ev
    union all
    select unnest(ah_arr), m, '-', pa, itc, st, ac_c, 0, 0, pa, itc, st, '+', 0, 0, 0, 0, 1, 0, 0
    from ev where hco_ev and not hire_ev
    union all
    select unnest(ac_arr), m, '-', pa, itc, st, ac_c, 0, 0, '', '', '', '', 0, 0, 0, 1, 0, 0, 0
    from ev where fire_ev
    union all
    -- 09.11: нанят в одном юните, к концу месяца — в другом: «из» юнита дня найма и «в» юнит конца месяца (срез — конца)
    select z.node_rk, z.m, '-', z.pa, z.itc, z.st, z.ac_c, 1, 0, '', '', '', '', 0, 0, 0, 0, 0, 1, 0
    from (select ev.*, unnest(ah_arr) as node_rk from ev where (hire_ev or hco_ev) and cp_h <> cp_c) z
    where not (z.node_rk = any(z.ac_arr))
    union all
    select z.node_rk, z.m, '-', z.pa, z.itc, z.st, z.ac_c, 1, 0, '', '', '', '', 0, 0, 0, 0, 1, 0, 0
    from (select ev.*, unnest(ac_arr) as node_rk from ev where (hire_ev or hco_ev) and cp_h <> cp_c) z
    where not (z.node_rk = any(z.ah_arr))
    union all
    -- юнит-строка: переход по ключу юнита (key_u); в общем узле без смены среза — не пишется
    select node_rk, m, '-', pa, itc, st, ac_c, cu, 0, case when cu = 1 then '' else pa_p end, case when cu = 1 then '' else itc_p end, case when cu = 1 then '' else st_p end, case when cu = 1 then '' else ac_p end,
           0, 0, 0, 0, 1, 0, 0
    from ti where ((not in_prev) or key_u) and (cu = 1 or dp + di + ds + da > 0)
    union all
    select node_rk, m, '-', pa_p, itc_p, st_p, ac_p, cu, 0, case when cu = 1 then '' else pa end, case when cu = 1 then '' else itc end, case when cu = 1 then '' else st end, case when cu = 1 then '' when conv then '+' else ac_c end,
           0, 0, 0, 0, 0, 1, 0
    from tu where ((not in_end) or key_u) and (cu = 1 or dp + di + ds + da > 0)
    union all
    -- ===== строки специализаций (только люди С специализацией: sp '-' склеился бы с юнит-строками
    --      и удваивал их; человек без специализации виден только в строке юнита) =====
    select unnest(ap_arr), m, sp_p, pa_p, itc_p, st_p, ac_p, 0, 0, '', '', '', '', 1, 0, 0, 0, 0, 0, 0
    from ev where in_prev and sp_p <> '-'
    union all
    select unnest(ac_arr), m, sp_c, pa, itc, st, ac_c, 0, 0, '', '', '', '', 0, 0, 0, 0, 0, 0, 1
    from ev where in_cur and sp_c <> '-'
    union all
    select unnest(ah_arr), m, sp_c, pa, itc, st, ac_c, 0, 0, '', '', '', '', 0, 1, 0, 0, 0, 0, 0
    from ev where hire_ev and sp_c <> '-'
    union all
    select unnest(ah_arr), m, sp_c, pa, itc, st, ac_c, 0, 0, '', '', '', '', 0, 0, 1, 0, 0, 0, 0
    from ev where hco_ev and sp_c <> '-'
    union all
    select unnest(ah_arr), m, sp_c, pa, itc, st, ac_c, 0, 0, pa, itc, st, '+', 0, 0, 0, 0, 1, 0, 0
    from ev where hco_ev and not hire_ev and sp_c <> '-'
    union all
    select unnest(ac_arr), m, sp_c, pa, itc, st, ac_c, 0, 0, '', '', '', '', 0, 0, 0, 1, 0, 0, 0
    from ev where fire_ev and sp_c <> '-'
    union all
    select z.node_rk, z.m, z.sp_c, z.pa, z.itc, z.st, z.ac_c, 1, 0, '', '', '', '', 0, 0, 0, 0, 0, 1, 0
    from (select ev.*, unnest(ah_arr) as node_rk from ev where (hire_ev or hco_ev) and cp_h <> cp_c and sp_c <> '-') z
    where not (z.node_rk = any(z.ac_arr))
    union all
    select z.node_rk, z.m, z.sp_c, z.pa, z.itc, z.st, z.ac_c, 1, 0, '', '', '', '', 0, 0, 0, 0, 1, 0, 0
    from (select ev.*, unnest(ac_arr) as node_rk from ev where (hire_ev or hco_ev) and cp_h <> cp_c and sp_c <> '-') z
    where not (z.node_rk = any(z.ah_arr))
    union all
    select node_rk, m, sp_c, pa, itc, st, ac_c, cu, dsp * (1 - cu), case when cu = 1 then '' else pa_p end, case when cu = 1 then '' else itc_p end, case when cu = 1 then '' else st_p end, case when cu = 1 then '' else ac_p end,
           0, 0, 0, 0, 1, 0, 0
    from ti where sp_c <> '-' and (cu = 1 or dp + di + ds + da + dsp > 0)
    union all
    select node_rk, m, sp_p, pa_p, itc_p, st_p, ac_p, cu, dsp * (1 - cu), case when cu = 1 then '' else pa end, case when cu = 1 then '' else itc end, case when cu = 1 then '' else st end, case when cu = 1 then '' when conv then '+' else ac_c end,
           0, 0, 0, 0, 0, 1, 0
    from tu where sp_p <> '-' and (cu = 1 or dp + di + ds + da + dsp > 0)
) t
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
distributed by (node_rk);
analyze teampulse_hub_flow;

select count(*) as flow_rows, count(distinct node_rk) as flow_nodes from teampulse_hub_flow;
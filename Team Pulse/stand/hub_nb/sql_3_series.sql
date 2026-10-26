-- =============================================================================
-- TeamPulse Hub · 3. Справочник узлов и ряды (поставка 58: SQL вместо build_hub)
-- teampulse_hub_unit — узлы: родитель, уровень, имя, число подразделений, путь, логин руководителя;
-- teampulse_hub_series — узел × месяц × срез: численность, ССЧ, найм, увольнения, переводы и др.;
-- с поставки 66 — бронирования (bk, bkv, vsv) и посещаемость руководителей (hwd, hov), имя руководителя.
-- =============================================================================

-- 5. справочник узлов: + число подразделений, логин и имя руководителя (teampulse_hub_head — параграф «hub · 2»;
--    имя — с поставки 66, из unit_head_structure)
drop table if exists teampulse_hub_unit;
create table teampulse_hub_unit as
select n.rk as unit_rk, n.prk as parent_rk, n.lv as unit_lvl, n.nm as unit_nm,
       coalesce(k.kids, 0)::int as kids_cnt, n.pth as path_rk, coalesce(h.head_login, '') as head_login,
       coalesce(h.head_nm, '') as head_nm
from teampulse_hub_node n
left join (select prk, count(*) as kids from teampulse_hub_node where prk <> '' group by prk) k on k.prk = n.rk
left join teampulse_hub_head h on h.unit_rk = n.rk
distributed by (unit_rk);

-- 6. строки источника → узлы нынешней структуры, все месяцы одним запросом. Перевод входит в узел
--    глубины d, если сменился уровень ≤ d (через границу узла). Тип численности — целиком, на конец месяца
--    (act_type_nm); активная численность (hc_active_cnt) — тип «Активная», без подрядчиков
drop table if exists teampulse_hub_sx;
create table teampulse_hub_sx as
select node_rk, report_month::date as report_month, paint_c, it_c, staff_c, act_c,
       sum(coalesce(e.hc_total_cnt, 0)) as hc, sum(coalesce(e.hc_active_cnt, 0)) as act,
       -- найм по методологии DD: найм в компанию + перевод из учебной группы в боевую + стажёров в
       -- штат; одно событие на человека в строке
       sum(greatest(coalesce(e.hire_amt, 0), coalesce(e.transfer_candidate_amt, 0), coalesce(e.transfer_internal_amt, 0))) as hire,
       -- найм в компанию с любым типом активности — найм «всей численности»
       sum(coalesce(e.hire_cnt, 0)) as hco,
       sum(coalesce(e.fire_amt, 0)) as fire, sum(coalesce(e.regret_fire_amt, 0)) as reg,
       sum(coalesce(e.non_regret_fire_amt, 0)) as nreg,
       -- переводы считает «hub · 5 переходы» (teampulse_hub_trf); с поставки 64 ноутбук TP 2.0 их не считает
       -- (EXEC build_all_metrics: transfers=False) — колонки рядов остаются нулями, схема та же
       0 as tin, 0 as tout,
       sum(coalesce(e.perf_normal, 0)) as pnor, sum(coalesce(e.perf_low, 0)) as plow,
       sum(coalesce(e.perf_high, 0)) as phig, sum(coalesce(e.perf_gray, 0)) as pgry,
       sum(coalesce(e.work_day_amt, 0)) as wday, sum(coalesce(e.office_visit_amt, 0)) as ovis,
       sum(coalesce(e.grt_approve_cnt, 0)) as gapr, sum(coalesce(e.grt_decline_cnt, 0)) as gdec,
       -- поставка 66 (Адель): бронирования — дней с бронью, бронь без посещения, посещение без брони; рабочие
       -- дни и посещения руководителей (management_head_flg = 1) — сегмент «Руководители» посещаемости
       sum(coalesce(e.booking_amt, 0)) as bk, sum(coalesce(e.booking_viol_amt, 0)) as bkv, sum(coalesce(e.visit_viol_amt, 0)) as vsv,
       sum(case when e.management_head_flg::text = '1' then coalesce(e.work_day_amt, 0) else 0 end) as hwd,
       sum(case when e.management_head_flg::text = '1' then coalesce(e.office_visit_amt, 0) else 0 end) as hov
from (
    select x.*, unnest(string_to_array(x.cp, '|')) as node_rk,
           generate_subscripts(string_to_array(x.cp, '|'), 1) - (select mo from teampulse_hub_cal) as d
    from (
        select s.report_month, s.hc_total_cnt, s.hc_active_cnt, s.hire_amt, s.transfer_candidate_amt,
               s.transfer_internal_amt, s.hire_cnt, s.fire_amt, s.regret_fire_amt, s.non_regret_fire_amt,
               s.perf_normal, s.perf_low, s.perf_high, s.perf_gray, s.work_day_amt, s.office_visit_amt,
               s.grt_approve_cnt, s.grt_decline_cnt, s.booking_amt, s.booking_viol_amt, s.visit_viol_amt,
               s.management_head_flg,
               (select pre from teampulse_hub_cal) || coalesce(u.cp,
                   array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
                                      s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text,
                                      s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) as cp,
               coalesce(nullif(s.paint_cd::text, ''), '-') AS paint_c, coalesce(nullif(s.emp_specialization_it_code::text, ''), '-') AS it_c,
               case when s.employment_relation_type = 'Штатный сотрудник' then 'Штат' else 'Не штат' end as staff_c,
               coalesce(nullif(trim(s.act_type_nm::text), ''), '-') as act_c
        from all_metrics_with_performance_and_office_traffic_and_grt s
        left join teampulse_hub_upath u on u.unit_rk = s.mng_unit_rk::text
        where s.leaf_lvl > 0
    ) x
) e
group by 1, 2, 3, 4, 5, 6
distributed by (node_rk);

-- 7. ССЧ = (численность месяца + прошлого) / 2 по узлу и срезу: строка и там, где людей среза в узле
--    в этом месяце уже нет, а в прошлом были. Первый месяц — без лага
drop table if exists teampulse_hub_series;
create table teampulse_hub_series as
with k as (
    select node_rk, report_month, paint_c, it_c, staff_c, act_c from teampulse_hub_sx
    union
    select node_rk, (report_month + interval '1 month')::date, paint_c, it_c, staff_c, act_c from teampulse_hub_sx
    where report_month < (select max(report_month) from teampulse_hub_sx)
)
select k.node_rk, k.report_month, k.paint_c as paint_cd, k.it_c as it_cd, k.staff_c as staff_cd,
       k.act_c as act_cd,
       coalesce(c.hc, 0) as hc_cnt, coalesce(c.act, 0) as act_cnt,
       (coalesce(c.hc, 0) + case when k.report_month = (select min(report_month) from teampulse_hub_sx)
                                 then coalesce(c.hc, 0) else coalesce(pv.hc, 0) end) / 2.0 as avg_cnt,
       coalesce(c.hire, 0) as hire_cnt, coalesce(c.hco, 0) as hco_cnt,
       coalesce(c.fire, 0) as fire_cnt, coalesce(c.reg, 0) as reg_cnt, coalesce(c.nreg, 0) as nreg_cnt,
       coalesce(c.tin, 0) as tin_cnt, coalesce(c.tout, 0) as tout_cnt,
       coalesce(c.pnor, 0) as pnor_cnt, coalesce(c.plow, 0) as plow_cnt,
       coalesce(c.phig, 0) as phig_cnt, coalesce(c.pgry, 0) as pgry_cnt,
       coalesce(c.wday, 0) as wday_amt, coalesce(c.ovis, 0) as ovis_amt,
       coalesce(c.gapr, 0) as gapr_cnt, coalesce(c.gdec, 0) as gdec_cnt,
       coalesce(c.bk, 0) as bk_amt, coalesce(c.bkv, 0) as bkv_amt, coalesce(c.vsv, 0) as vsv_amt,
       coalesce(c.hwd, 0) as hwd_amt, coalesce(c.hov, 0) as hov_amt
from k
left join teampulse_hub_sx c
       on c.node_rk = k.node_rk and c.paint_c = k.paint_c and c.it_c = k.it_c and c.staff_c = k.staff_c and
       c.act_c = k.act_c
      and c.report_month = k.report_month
left join teampulse_hub_sx pv
       on pv.node_rk = k.node_rk and pv.paint_c = k.paint_c and pv.it_c = k.it_c and
       pv.staff_c = k.staff_c and pv.act_c = k.act_c
      and pv.report_month = (k.report_month - interval '1 month')::date
distributed by (node_rk);
drop table if exists teampulse_hub_sx;

select (select count(*) from teampulse_hub_unit) as unit_rows, (select count(*) from teampulse_hub_series) as series_rows;

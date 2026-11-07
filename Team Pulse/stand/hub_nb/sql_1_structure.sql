-- =============================================================================
-- TeamPulse Hub · 1. Календарь и структура (поставка 58: SQL вместо build_hub)
-- teampulse_hub_cal — последний месяц (lm), дата данных (dt), последний закрытый месяц (cm), начало сетки,
-- общий корень (mo, pre);
-- _uall / _uone / _upath — путь каждого юнита последнего месяца; _node — узлы нынешней структуры.
-- =============================================================================

-- 1. последний месяц — последний в источнике людей (и текущий незакрытый); dt — последний день этого
--    месяца в дневном источнике, нет его — вчера, но не позже конца месяца. Дневной источник — с отсечением
--    партиций по current_date (подзапрос от lm GP партициями не режет: сортирует источник целиком)
drop table if exists teampulse_hub_lm;
create table teampulse_hub_lm as select max(s.report_month)::date as lm from all_metrics_with_performance_and_office_traffic_and_grt s distributed by (lm);
--    поставка 90: cm — последний закрытый месяц: lm, если dt — последний день месяца lm или lm — январь (тогда
--    неполный январь — единственные данные года), иначе месяц перед lm. Доли и месячные разрезы — по cm; разрезы «с начала года» — январь..lm (поставка 106)
drop table if exists teampulse_hub_cal;
create table teampulse_hub_cal as
select c.lm, c.dt,
       case when date_part('month', c.lm) = 1 or c.dt >= (c.lm + interval '1 month' - interval '1 day')::date then c.lm
            else (c.lm - interval '1 month')::date end as cm,
       c.grid_start, c.mo, c.pre
from (
    select l.lm,
           coalesce(x.dt, least(current_date - 1, (l.lm + interval '1 month' - interval '1 day')::date)) as dt,
           (date_trunc('year', l.lm) - interval '1 year')::date as grid_start,
           0 as mo, ''::text as pre
    from teampulse_hub_lm l
    cross join (
        select max(d.calendar_dt)::date as dt
        from usr_cross_data.hr_executive_proteus d
        where d.calendar_dt >= (date_trunc('month', current_date - 1) - interval '3 month')::date
          and d.calendar_dt >= (select lm from teampulse_hub_lm)
          and d.calendar_dt < ((select lm from teampulse_hub_lm) + interval '1 month')::date
    ) x
) c
distributed by (lm);
drop table if exists teampulse_hub_lm;

-- 2. пути юнитов последнего месяца — по маленьким таблицам: _uall — юнит × его пути (ключи уровней
--    колонками), _uone — один путь на юнит (если их несколько — меньший строкой, путь целиком)
drop table if exists teampulse_hub_uall;
create table teampulse_hub_uall as
select s.mng_unit_rk::text as unit_rk, s.leaf_lvl,
       s.lvl1_rk::text as k1, s.lvl2_rk::text as k2, s.lvl3_rk::text as k3, s.lvl4_rk::text as k4,
       s.lvl5_rk::text as k5, s.lvl6_rk::text as k6, s.lvl7_rk::text as k7, s.lvl8_rk::text as k8,
       s.lvl9_rk::text as k9, s.lvl10_rk::text as k10, s.lvl11_rk::text as k11,
       min(s.lvl1_nm::text) as n1, min(s.lvl2_nm::text) as n2, min(s.lvl3_nm::text) as n3,
       min(s.lvl4_nm::text) as n4, min(s.lvl5_nm::text) as n5, min(s.lvl6_nm::text) as n6,
       min(s.lvl7_nm::text) as n7, min(s.lvl8_nm::text) as n8, min(s.lvl9_nm::text) as n9,
       min(s.lvl10_nm::text) as n10, min(s.lvl11_nm::text) as n11
from all_metrics_with_performance_and_office_traffic_and_grt s
where s.report_month = (select lm from teampulse_hub_cal) and s.leaf_lvl > 0
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
distributed by (unit_rk);
drop table if exists teampulse_hub_uone;
create table teampulse_hub_uone as
select distinct on (unit_rk) *
from (select u.*, array_to_string((ARRAY[u.k1, u.k2, u.k3, u.k4, u.k5, u.k6, u.k7, u.k8, u.k9, u.k10, u.k11])[1:u.leaf_lvl], '|') as cp
      from teampulse_hub_uall u) x
order by unit_rk, cp
distributed by (unit_rk);
-- 3. узлы — все начала путей: и юниты со своими людьми, и уровни над ними без своих строк.
--    07.11 (бой, ноябрь: «узлов, где подразделения больше узла» — 26): в месяце реорганизации у части юнитов путь
--    уже новый, у части — старый, и один узел встречается под разными родителями. Раньше родитель брался наименьшим
--    ключом, а люди складывались по своему пути — сумма детей расходилась с родителем на тысячи. Теперь у узла один
--    родитель — тот, под которым больше людей (при равенстве — меньший ключ), путь узла строится по этому дереву, и по
--    нему же — путь юнита (teampulse_hub_upath): люди и дерево согласованы. При согласованных путях — как раньше.
drop table if exists teampulse_hub_uppl;
create table teampulse_hub_uppl as
select s.mng_unit_rk::text as unit_rk, count(distinct s.mdm_employee_rk)::float8 as ppl
from all_metrics_with_performance_and_office_traffic_and_grt s
where s.report_month = (select lm from teampulse_hub_cal) and s.leaf_lvl > 0
group by 1
distributed by (unit_rk);
drop table if exists teampulse_hub_nedge;
create table teampulse_hub_nedge as
select x.rk, x.nm, x.prk, sum(coalesce(p.ppl, 0)) + count(*) * 1e-6 as w
from (
    select r.unit_rk, unnest(r.ra) as rk, unnest(r.na) as nm, unnest(r.pa) as prk
    from (
        select u.unit_rk,
               (ARRAY[u.k1, u.k2, u.k3, u.k4, u.k5, u.k6, u.k7, u.k8, u.k9, u.k10, u.k11])[1:u.leaf_lvl] as ra,
               (ARRAY[u.n1, u.n2, u.n3, u.n4, u.n5, u.n6, u.n7, u.n8, u.n9, u.n10, u.n11])[1:u.leaf_lvl] as na,
               (ARRAY[''::text, u.k1, u.k2, u.k3, u.k4, u.k5, u.k6, u.k7, u.k8, u.k9, u.k10])[1:u.leaf_lvl] as pa
        from teampulse_hub_uone u
    ) r
) x
left join teampulse_hub_uppl p on p.unit_rk = x.unit_rk
where x.rk <> '-'
group by 1, 2, 3
distributed by (rk);
drop table if exists teampulse_hub_npar;
create table teampulse_hub_npar as
select distinct on (rk) rk, case when prk = '-' then '' else prk end as prk
from teampulse_hub_nedge
order by rk, w desc, prk
distributed by (rk);
drop table if exists teampulse_hub_node;
create table teampulse_hub_node as
select n.rk, m.nm, array_length(n.pa, 1) as lv, n.prk, array_to_string(n.pa, '|') as pth
from (
    select a0.rk, a0.prk,
           array_remove(ARRAY[a10.rk, a9.rk, a8.rk, a7.rk, a6.rk, a5.rk, a4.rk, a3.rk, a2.rk, a1.rk, a0.rk], NULL) as pa
    from teampulse_hub_npar a0
    left join teampulse_hub_npar a1 on a1.rk = a0.prk
    left join teampulse_hub_npar a2 on a2.rk = a1.prk
    left join teampulse_hub_npar a3 on a3.rk = a2.prk
    left join teampulse_hub_npar a4 on a4.rk = a3.prk
    left join teampulse_hub_npar a5 on a5.rk = a4.prk
    left join teampulse_hub_npar a6 on a6.rk = a5.prk
    left join teampulse_hub_npar a7 on a7.rk = a6.prk
    left join teampulse_hub_npar a8 on a8.rk = a7.prk
    left join teampulse_hub_npar a9 on a9.rk = a8.prk
    left join teampulse_hub_npar a10 on a10.rk = a9.prk
) n
join (select rk, min(nm) as nm from teampulse_hub_nedge group by rk) m on m.rk = n.rk
distributed by (rk);
drop table if exists teampulse_hub_upath;
create table teampulse_hub_upath as
select u.unit_rk, coalesce(n.pth, u.cp) as cp
from teampulse_hub_uone u
left join teampulse_hub_node n on n.rk = u.unit_rk
distributed by (unit_rk);
drop table if exists teampulse_hub_uppl;
drop table if exists teampulse_hub_nedge;
drop table if exists teampulse_hub_npar;

-- несколько корней — общий корень над ними: «вся компания» — сумма всех строк
update teampulse_hub_cal set mo = 1, pre = 'all|' where (select count(*) from teampulse_hub_node where prk = '') > 1;
update teampulse_hub_node set prk = 'all' where prk = '' and (select mo from teampulse_hub_cal) = 1;
update teampulse_hub_node set pth = 'all|' || pth, lv = lv + 1 where (select mo from teampulse_hub_cal) = 1;
insert into teampulse_hub_node (rk, nm, lv, prk, pth) select 'all', 'Все юниты', 1, '', 'all' where (select mo from teampulse_hub_cal) = 1;

select c.lm as last_month, c.dt as data_dt, c.cm as closed_month, c.grid_start, c.mo as common_root,
       (select count(*) from teampulse_hub_node) as nodes, (select count(*) from teampulse_hub_upath) as units
from teampulse_hub_cal c;

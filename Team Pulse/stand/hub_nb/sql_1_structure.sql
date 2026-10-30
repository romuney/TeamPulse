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
--    неполный январь — единственные данные года), иначе месяц перед lm. Разрезы «с начала года» — январь..cm
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
drop table if exists teampulse_hub_upath;
create table teampulse_hub_upath as
select unit_rk, cp from teampulse_hub_uone
distributed by (unit_rk);

-- 3. узлы — все начала путей: и юниты со своими людьми, и уровни над ними без своих строк
drop table if exists teampulse_hub_node;
create table teampulse_hub_node as
select rk, min(nm) as nm, min(lv) as lv, min(prk) as prk, min(pth) as pth
from (
    select x.rk, x.nm, x.lv,
           case when x.lv = 1 then '' else x.ra[x.lv - 1] end as prk,
           array_to_string(x.ra[1:x.lv], '|') as pth
    from (
        select unnest(r.ra) as rk, unnest(r.na) as nm, generate_subscripts(r.ra, 1) as lv, r.ra
        from (
            select (ARRAY[u.k1, u.k2, u.k3, u.k4, u.k5, u.k6, u.k7, u.k8, u.k9, u.k10, u.k11])[1:u.leaf_lvl] as ra,
                   (ARRAY[u.n1, u.n2, u.n3, u.n4, u.n5, u.n6, u.n7, u.n8, u.n9, u.n10, u.n11])[1:u.leaf_lvl] as na
            from teampulse_hub_uone u
        ) r
    ) x
    where x.rk <> '-'
) n
group by rk
distributed by (rk);

-- несколько корней — общий корень над ними: «вся компания» — сумма всех строк
update teampulse_hub_cal set mo = 1, pre = 'all|' where (select count(*) from teampulse_hub_node where prk = '') > 1;
update teampulse_hub_node set prk = 'all' where prk = '' and (select mo from teampulse_hub_cal) = 1;
update teampulse_hub_node set pth = 'all|' || pth, lv = lv + 1 where (select mo from teampulse_hub_cal) = 1;
insert into teampulse_hub_node (rk, nm, lv, prk, pth) select 'all', 'Все юниты', 1, '', 'all' where (select mo from teampulse_hub_cal) = 1;

select c.lm as last_month, c.dt as data_dt, c.cm as closed_month, c.grid_start, c.mo as common_root,
       (select count(*) from teampulse_hub_node) as nodes, (select count(*) from teampulse_hub_upath) as units
from teampulse_hub_cal c;

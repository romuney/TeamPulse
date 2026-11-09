-- =============================================================================
-- TeamPulse Hub · 1. Календарь и структура (поставка 58: SQL вместо build_hub)
-- teampulse_hub_cal — последний месяц (lm), дата данных (dt), последний закрытый месяц (cm), начало сетки,
-- общий корень (mo, pre);
-- _umap — цепочка юнита в каждом месяце (по ней люди относятся к подразделениям); _uall — пути юнитов последнего
-- месяца (имена узлов); _node — узлы нынешней структуры (дерево для показа).
-- С 09.11 (поставка 129) файл ведётся руками: генератор stand/hub_sql.py его больше не перезаписывает.
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

-- 2. пути юнитов последнего месяца — по маленьким таблицам: _uall — юнит × его пути (ключи и имена уровней
--    колонками): из них имена узлов дерева
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
drop table if exists teampulse_hub_upath;

-- 3. люди → подразделения. 09.11, поставка 129 (владелец: «подразделения не сходятся» с мастер-отчётом): человек
--    относится к подразделениям цепочки своего юнита В ТОМ ЖЕ МЕСЯЦЕ — как мастер-отчёт (подразделение там — фильтр
--    по уровню цепочки самой строки дня) и как переводы «hub · 5» (путь дня, поставка 59). Было: путь юнита в
--    последнем месяце для всех месяцев («история в нынешней структуре»), а с 07.11 (поставки 113-г…е) — путь по общему
--    дереву: люди юнитов с другой цепочкой (пропущен уровень, старый путь у части юнитов в месяц реорганизации)
--    засчитывались чужому предку. _umap: юнит × месяц → цепочка большинства его людей на конец месяца («-» внутри
--    пути выкинуты; людей поровну — больше строк, дальше меньшая строкой). На неизменной структуре — то же, что раньше
drop table if exists teampulse_hub_umap0;
create table teampulse_hub_umap0 as
select distinct on (x.unit_rk, x.report_month) x.unit_rk, x.report_month, x.cp
from (
    select s.mng_unit_rk::text as unit_rk, s.report_month::date as report_month,
           array_to_string(array_remove((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
               s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text, s.lvl9_rk::text, s.lvl10_rk::text,
               s.lvl11_rk::text])[1:s.leaf_lvl], '-'), '|') as cp,
           sum(coalesce(s.hc_total_cnt, 0)) as hc, count(*) as n
    from all_metrics_with_performance_and_office_traffic_and_grt s
    where s.leaf_lvl > 0
    group by 1, 2, 3
) x
where x.cp <> ''
order by x.unit_rk, x.report_month, x.hc desc, x.n desc, x.cp
distributed by (unit_rk);
--    ключ, который в цепочке повторяется (бывает в mapped: один уровень дважды), — один раз, первое вхождение: иначе
--    человек засчитывался бы такому узлу дважды (до поставки 129 повтор снимал путь по дереву)
drop table if exists teampulse_hub_umap;
create table teampulse_hub_umap as
select y.unit_rk, y.report_month,
       array_to_string(array_remove(ARRAY[max(case when y.i = 1 then y.rk end), max(case when y.i = 2 then y.rk end),
           max(case when y.i = 3 then y.rk end), max(case when y.i = 4 then y.rk end), max(case when y.i = 5 then y.rk end),
           max(case when y.i = 6 then y.rk end), max(case when y.i = 7 then y.rk end), max(case when y.i = 8 then y.rk end),
           max(case when y.i = 9 then y.rk end), max(case when y.i = 10 then y.rk end),
           max(case when y.i = 11 then y.rk end)], NULL), '|') as cp
from (
    select z.unit_rk, z.report_month, z.rk, min(z.i) as i
    from (select w.unit_rk, w.report_month, unnest(string_to_array(w.cp, '|')) as rk,
                 generate_subscripts(string_to_array(w.cp, '|'), 1) as i
          from teampulse_hub_umap0 w) z
    group by 1, 2, 3
) y
group by 1, 2
distributed by (unit_rk);
drop table if exists teampulse_hub_umap0;
--    месяц перед сеткой — только «начало» первого месяца водопада («hub · 4в»): цепочки первого месяца сетки
insert into teampulse_hub_umap (unit_rk, report_month, cp)
select unit_rk, (report_month - interval '1 month')::date, cp
from teampulse_hub_umap
where report_month = (select grid_start from teampulse_hub_cal);

-- 4. узлы — все начала путей последнего месяца: и юниты со своими людьми, и уровни над ними без своих строк. Дерево —
--    только для показа (фильтр подразделения, таблицы подразделений, руководители): людей оно не переносит (п. 3).
--    07.11 (бой, ноябрь): в mapped-цепочках один узел стоит в разных юнитах под разными родителями (пропущен
--    промежуточный уровень, у части юнитов старый путь; бывает, что A над B в одних цепочках и B над A в других).
--    Дерево собирается из целых цепочек (поставка 113-е: колец нет), родитель узла — там, где больше его людей
--    (поставка 129; было — из самой длинной цепочки: узел с тысячами людей вставал под предка из старого пути, где их
--    трое). Кандидаты узла X — начала цепочек до X (первое вхождение), вес начала — люди всех цепочек, которые с него
--    начинаются; лучшее — больше людей, поровну — короче, дальше — меньшее строкой; родитель — элемент перед X.
--    Колец нет: начало до родителя есть у тех же людей и короче, значит, лучшее начало родителя строго лучше начала
--    узла. У узла с двумя родителями люди чужой ветки остаются в её предках, как в мастер-отчёте, — сумма
--    подразделений бывает больше узла (hub checks № 10, справочно)
drop table if exists teampulse_hub_upw;
create table teampulse_hub_upw as
select x.unit_rk, x.cp, count(distinct x.emp) as ppl
from (
    select s.mng_unit_rk::text as unit_rk, s.mdm_employee_rk as emp,
           array_to_string(array_remove((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
               s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text, s.lvl9_rk::text, s.lvl10_rk::text,
               s.lvl11_rk::text])[1:s.leaf_lvl], '-'), '|') as cp
    from all_metrics_with_performance_and_office_traffic_and_grt s
    where s.report_month = (select lm from teampulse_hub_cal) and s.leaf_lvl > 0
) x
where x.cp <> ''
group by 1, 2
distributed by (unit_rk);
drop table if exists teampulse_hub_nedge;
create table teampulse_hub_nedge as
select x.rk, x.unit_rk, x.cp, x.ppl, array_length(string_to_array(x.cp, '|'), 1) as ln, min(x.i) as i
from (
    select p.unit_rk, p.cp, p.ppl, unnest(string_to_array(p.cp, '|')) as rk,
           generate_subscripts(string_to_array(p.cp, '|'), 1) as i
    from teampulse_hub_upw p
) x
group by 1, 2, 3, 4, 5
distributed by (rk);
drop table if exists teampulse_hub_npre;
create table teampulse_hub_npre as
select e.rk, array_to_string((string_to_array(e.cp, '|'))[1:e.i], '|') as pfx, e.i, sum(e.ppl) as ppl
from teampulse_hub_nedge e
group by 1, 2, 3
distributed by (rk);
drop table if exists teampulse_hub_npar;
create table teampulse_hub_npar as
select y.rk, case when y.i = 1 then '' else (string_to_array(y.pfx, '|'))[y.i - 1] end as prk
from (
    select distinct on (p.rk) p.rk, p.pfx, p.i
    from teampulse_hub_npre p
    order by p.rk, p.ppl desc, p.i, p.pfx
) y
distributed by (rk);
--    имя узла — из путей юнитов (как раньше)
drop table if exists teampulse_hub_nnm;
create table teampulse_hub_nnm as
select x.rk, min(x.nm) as nm
from (
    select unnest(ARRAY[u.k1, u.k2, u.k3, u.k4, u.k5, u.k6, u.k7, u.k8, u.k9, u.k10, u.k11]) as rk,
           unnest(ARRAY[u.n1, u.n2, u.n3, u.n4, u.n5, u.n6, u.n7, u.n8, u.n9, u.n10, u.n11]) as nm
    from teampulse_hub_uall u
) x
where x.rk <> '-'
group by 1
distributed by (rk);
--    путь узла — подъёмом по родителям (до 20 шагов: дерево из разных цепочек может быть глубже 11 уровней)
drop table if exists teampulse_hub_node;
create table teampulse_hub_node as
select n.rk, m.nm, array_length(n.pa, 1) as lv, n.prk, array_to_string(n.pa, '|') as pth
from (
    select a0.rk, a0.prk,
           array_remove(ARRAY[a19.rk, a18.rk, a17.rk, a16.rk, a15.rk, a14.rk, a13.rk, a12.rk, a11.rk, a10.rk, a9.rk, a8.rk, a7.rk, a6.rk, a5.rk, a4.rk, a3.rk, a2.rk, a1.rk, a0.rk], NULL) as pa
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
    left join teampulse_hub_npar a11 on a11.rk = a10.prk
    left join teampulse_hub_npar a12 on a12.rk = a11.prk
    left join teampulse_hub_npar a13 on a13.rk = a12.prk
    left join teampulse_hub_npar a14 on a14.rk = a13.prk
    left join teampulse_hub_npar a15 on a15.rk = a14.prk
    left join teampulse_hub_npar a16 on a16.rk = a15.prk
    left join teampulse_hub_npar a17 on a17.rk = a16.prk
    left join teampulse_hub_npar a18 on a18.rk = a17.prk
    left join teampulse_hub_npar a19 on a19.rk = a18.prk
) n
left join teampulse_hub_nnm m on m.rk = n.rk
distributed by (rk);
drop table if exists teampulse_hub_upw;
drop table if exists teampulse_hub_nedge;
drop table if exists teampulse_hub_npre;
drop table if exists teampulse_hub_npar;
drop table if exists teampulse_hub_nnm;

-- несколько корней — общий корень над ними: «вся компания» — сумма всех строк. Поставка 129: корни — и у дерева, и у
-- цепочек людей за все месяцы (люди считаются по своей цепочке: начнись она не с корня дерева — без общего корня они
-- выпали бы из «всей компании»)
update teampulse_hub_cal set mo = 1, pre = 'all|'
where (select count(*) from (select rk from teampulse_hub_node where prk = ''
                             union select split_part(cp, '|', 1) from teampulse_hub_umap) r) > 1;
update teampulse_hub_node set prk = 'all' where prk = '' and (select mo from teampulse_hub_cal) = 1;
update teampulse_hub_node set pth = 'all|' || pth, lv = lv + 1 where (select mo from teampulse_hub_cal) = 1;
insert into teampulse_hub_node (rk, nm, lv, prk, pth) select 'all', 'Все юниты', 1, '', 'all' where (select mo from teampulse_hub_cal) = 1;

select c.lm as last_month, c.dt as data_dt, c.cm as closed_month, c.grid_start, c.mo as common_root,
       (select count(*) from teampulse_hub_node) as nodes,
       (select count(*) from teampulse_hub_umap where report_month = c.lm) as units
from teampulse_hub_cal c;

-- ============================================================================
-- 0о. Посещаемость офиса: почему число отчёта не сходится с мастер-источником (27.10-в, п. 9).
-- Helicopter, параграф gp, после ноутбука. Ответ — в чат, не в репозиторий: в нём числа.
--
-- Что сделать: в блоке p вписать месяц (последний закрытый, первое число) и, если сверяете подразделение, —
-- его ключ (mng_unit_rk; пусто — вся компания). Запустить и прислать таблицу вместе с числом мастер-источника
-- и названием, откуда оно (дашборд, вкладка, фильтры).
--
-- Запрос считает посещаемость офиса за месяц шестью способами. Посещаемость = посещения ÷ рабочие дни.
--   А  источник целиком: все сотрудники с рабочим днём (usr_cross_data.office_traffic_attendance)
--   Б  А, но только те, кто есть в численности ноутбука в этом месяце
--   В  Б + тип численности «Активная» — так считает отчёт по умолчанию
--   Г  В + покраска HQ — так считают отчёты HQ
--   Д  ряды ноутбука как в отчёте: посещения — к одной строке человека в месяце (last_row_flg = 1)
--   Е  как ноутбук TP 2.0: посещения — к каждой строке человека; кто перешёл внутри месяца, считается дважды
-- Какая строка совпала с мастер-источником — та и есть его правило: скажите — переведу отчёт на него.
-- Если совпала Г — посещаемость, как желательная и нежелательная текучесть, считаем только по HQ и «Активной».
-- ============================================================================
with p (m, unit_rk) as (
    values (date '2026-09-01', null::text)
),
src as (
    select o.mdm_employee_rk, count(*) as wd, sum(coalesce(o.office_visit_flg, 0)) as ov
    from usr_cross_data.office_traffic_attendance o, p
    where o.work_day_flg = 1 and date_trunc('month', o.calendar_dt) = p.m
    group by o.mdm_employee_rk
),
r as (
    select s.mdm_employee_rk, s.last_row_flg, s.act_type_nm, s.paint_cd, s.work_day_amt, s.office_visit_amt
    from all_metrics_with_performance_and_office_traffic_and_grt s, p
    where s.report_month = p.m and s.leaf_lvl > 0
      and (p.unit_rk is null or p.unit_rk in (s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text,
           s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text, s.lvl9_rk::text, s.lvl10_rk::text,
           s.lvl11_rk::text))
),
who as (
    select mdm_employee_rk,
           max((act_type_nm = 'Активная')::int) as act,
           max((act_type_nm = 'Активная' and lower(coalesce(paint_cd, '')) = 'hq')::int) as hq
    from r where last_row_flg = 1 group by mdm_employee_rk
),
v (n, variant, visits, days) as (
    select 1, 'А. источник целиком', sum(ov), sum(wd) from src, p where p.unit_rk is null
    union all select 2, 'Б. только из численности ноутбука', sum(ov), sum(wd) from src where mdm_employee_rk in (select mdm_employee_rk from who)
    union all select 3, 'В. Б + «Активная» (отчёт по умолчанию)', sum(ov), sum(wd) from src where mdm_employee_rk in (select mdm_employee_rk from who where act = 1)
    union all select 4, 'Г. В + покраска HQ', sum(ov), sum(wd) from src where mdm_employee_rk in (select mdm_employee_rk from who where hq = 1)
    union all select 5, 'Д. ряды ноутбука, одна строка человека', sum(office_visit_amt), sum(work_day_amt) from r where last_row_flg = 1 and act_type_nm = 'Активная'
    union all select 6, 'Е. как TP 2.0: к каждой строке человека', sum(s.ov), sum(s.wd)
        from r join src s using (mdm_employee_rk) where r.act_type_nm = 'Активная'
)
select n, variant, visits, days, round(100.0 * visits / nullif(days, 0), 1) as attendance_pct
from v order by n;

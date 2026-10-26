-- =============================================================================
-- TeamPulse Hub · проверки таблиц — до выгрузки (поставка 58: SQL вместо Python)
-- Каждая проверка — одно число. Обязательная не сошлась — ошибка со списком, и параграф выгрузки
-- (to click) со старыми данными в отчёте не запускается. Справочные (INFO) выгрузку не останавливают.
-- Результат по каждой — таблица teampulse_hub_chk (её же показывает второй запрос).
-- =============================================================================
drop table if exists teampulse_hub_chk;
create table teampulse_hub_chk as
select 1 as n, 'корень - люди: численность последнего месяца'::text as check_nm, 1 as must,
       ((select sum(hc_cnt) from teampulse_hub_series
          where node_rk = (select root_rk from teampulse_hub_meta)
            and report_month = (select last_month from teampulse_hub_meta))
       - (select sum(hc_total_cnt) from all_metrics_with_performance_and_office_traffic_and_grt
          where leaf_lvl > 0 and report_month = (select last_month from teampulse_hub_meta)))::float8 as val
union all
select 2 as n, 'корень - люди: увольнения за всё время'::text as check_nm, 1 as must,
       ((select sum(fire_cnt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta))
       - (select sum(fire_amt) from all_metrics_with_performance_and_office_traffic_and_grt where leaf_lvl > 0))::float8 as val
union all
select 3 as n, 'корень - люди: перформанс за всё время'::text as check_nm, 1 as must,
       ((select sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) from teampulse_hub_series
          where node_rk = (select root_rk from teampulse_hub_meta))
       - (select sum(perf_normal + perf_low + perf_high + perf_gray) from all_metrics_with_performance_and_office_traffic_and_grt
          where leaf_lvl > 0))::float8 as val
union all
select 4 as n, 'корень - разрез по полу (численность)'::text as check_nm, 1 as must,
       ((select sum(hc_cnt) from teampulse_hub_series
          where node_rk = (select root_rk from teampulse_hub_meta)
            and report_month = (select last_month from teampulse_hub_meta))
       - (select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key = 'g'))::float8 as val
union all
select 5 as n, 'повторы ключа «узел x месяц x срез»'::text as check_nm, 1 as must,
       ((select count(*) from (select 1 from teampulse_hub_series
                                group by node_rk, report_month, paint_cd, it_cd, staff_cd, act_cd
                                having count(*) > 1) t))::float8 as val
union all
select 6 as n, 'узлов, у которых нет родителя в справочнике (кроме корня)'::text as check_nm, 1 as must,
       ((select count(*) from teampulse_hub_unit u
        where u.parent_rk <> '' and not exists (select 1 from teampulse_hub_unit p where p.unit_rk = u.parent_rk)))::float8 as val
union all
select 7 as n, 'переводы: строк без флага (в / из без флага юнита и типа)'::text as check_nm, 1 as must,
       ((select count(*) from teampulse_hub_trf where trf_kind in ('i', 'o')
        and fu + fa + fp + fi + fs = 0))::float8 as val
union all
select 8 as n, 'переводы: строк без людей'::text as check_nm, 1 as must,
       ((select count(*) from teampulse_hub_trf where trf_cnt <= 0))::float8 as val
union all
select 9 as n, 'корней'::text as check_nm, 1 as must,
       ((select count(*) - 1 from teampulse_hub_unit where parent_rk = ''))::float8 as val
union all
select 10 as n, 'узлов, где подразделения больше узла (численность)'::text as check_nm, 1 as must,
       ((select count(*) from teampulse_hub_unit u
        join (select node_rk, sum(hc_cnt) as hc from teampulse_hub_series
                     where report_month = (select last_month from teampulse_hub_meta) group by 1) h on h.node_rk = u.unit_rk
        left join (select u2.parent_rk, sum(h2.hc) as hc
                   from teampulse_hub_unit u2
                   join (select node_rk, sum(hc_cnt) as hc from teampulse_hub_series
                     where report_month = (select last_month from teampulse_hub_meta) group by 1) h2 on h2.node_rk = u2.unit_rk
                   group by 1) k on k.parent_rk = u.unit_rk
        where h.hc - coalesce(k.hc, 0) < -0.5))::float8 as val
union all
select 11 as n, 'корень - люди: рабочие дни и посещения офиса за всё время'::text as check_nm, 1 as must,
       ((select sum(wday_amt + ovis_amt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta))
       - (select sum(coalesce(work_day_amt, 0) + coalesce(office_visit_amt, 0)) from all_metrics_with_performance_and_office_traffic_and_grt where leaf_lvl > 0))::float8 as val
union all
select 12 as n, 'корень - люди: бронирования за всё время'::text as check_nm, 1 as must,
       ((select sum(bk_amt + bkv_amt + vsv_amt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta))
       - (select sum(coalesce(booking_amt, 0) + coalesce(booking_viol_amt, 0) + coalesce(visit_viol_amt, 0)) from all_metrics_with_performance_and_office_traffic_and_grt
          where leaf_lvl > 0))::float8 as val
union all
select 13 as n, 'календарь - ряды: рабочие дни и посещения двух последних месяцев (корень)'::text as check_nm, 1 as must,
       ((select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key in ('dw', 'do'))
       - (select sum(wday_amt + ovis_amt) from teampulse_hub_series
          where node_rk = (select root_rk from teampulse_hub_meta) and report_month >= ((select last_month from teampulse_hub_meta) - interval '1 month')::date))::float8 as val
union all
select 14 as n, 'города - посещения последнего месяца (корень)'::text as check_nm, 0 as must,
       (coalesce((select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key = 'oc'), 0)
       - (select sum(ovis_amt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta) and report_month = (select last_month from teampulse_hub_meta)))::float8 as val
union all
select 15 as n, 'вакансии: корень - снимок (открытые на конец последнего месяца)'::text as check_nm, 0 as must,
       (coalesce((select sum(vac_open_cnt) from teampulse_hub_vacancy
                   where node_rk = (select root_rk from teampulse_hub_meta)
                     and report_month = (select last_month from teampulse_hub_meta)), 0)
       - coalesce((select sum(open_cnt) from structure_x_vacancy where report_month = (select last_month from teampulse_hub_meta)), 0))::float8 as val
union all
select 16 as n, 'вакансии: корень - снимок (закрытые за всё время сетки)'::text as check_nm, 0 as must,
       (coalesce((select sum(vac_close_cnt) from teampulse_hub_vacancy where node_rk = (select root_rk from teampulse_hub_meta)), 0)
       - coalesce((select sum(close_cnt) from structure_x_vacancy
                   where report_month >= (select grid_start from teampulse_hub_meta)), 0))::float8 as val
distributed randomly;

select n, check_nm, val,
       case when must = 0 then 'INFO' when abs(coalesce(val, 0)) < 0.5 then 'OK' else 'FAIL' end as result
from teampulse_hub_chk
order by n;

select case when count(*) = 0 then 'таблицы TeamPulse Hub сходятся'
            else ('ТАБЛИЦЫ TeamPulse Hub НЕ СХОДЯТСЯ: '
                  || string_agg(check_nm || ' = ' || coalesce(val, 0)::text, '; '))::int::text
       end as result
from teampulse_hub_chk
where must = 1 and abs(coalesce(val, 0)) >= 0.5;

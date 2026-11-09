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
select 7 as n, 'переводы: строк без флага (в / из без флага юнита, типа и специализации)'::text as check_nm, 1 as must,
       ((select count(*) from teampulse_hub_trf where trf_kind in ('i', 'o')
        and fu + fa + fp + fi + fs + fsp = 0))::float8 as val
union all
select 8 as n, 'переводы: строк без людей'::text as check_nm, 1 as must,
       ((select count(*) from teampulse_hub_trf where trf_cnt <= 0))::float8 as val
union all
select 9 as n, 'корней'::text as check_nm, 1 as must,
       ((select count(*) - 1 from teampulse_hub_unit where parent_rk = ''))::float8 as val
union all
-- 09.11 (владелец: «дерево идёт из центральной витрины как оно есть, менять логику структуры и привязки людей
-- запрещено»): дерево и люди — по цепочкам витрины как есть. Если в витрине у узла два родителя (месяц реорганизации),
-- сумма подразделений бывает больше узла — это данные витрины, не ошибка сборки: проверка справочная, выгрузку не держит
select 10 as n, 'узлов, где подразделения больше узла (численность; справочно — так в витрине)'::text as check_nm, 0 as must,
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
select 13 as n, 'календарь - ряды: рабочие дни и посещения с месяца перед закрытым по текущий (корень)'::text as check_nm, 1 as must,
       ((select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key in ('dw', 'do'))
       - (select sum(wday_amt + ovis_amt) from teampulse_hub_series
          where node_rk = (select root_rk from teampulse_hub_meta) and report_month >= ((select cm from teampulse_hub_cal) - interval '1 month')::date))::float8 as val
union all
select 14 as n, 'увольнения по инициатору и месяцу - ряды (корень, вся сетка)'::text as check_nm, 1 as must,
       ((select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key = 'xim')
       - (select sum(fire_cnt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta)
          and report_month >= (select grid_start from teampulse_hub_meta)))::float8 as val
union all
select 15 as n, 'мониторинг: люди в сегментах прогулов, выходных и звонков - люди (корень, вся сетка)'::text as check_nm, 1 as must,
       ((select sum(ab25_cnt + ab5_cnt + we25_cnt + we5_cnt + t23_cnt + t35_cnt + t5_cnt) from teampulse_hub_series
          where node_rk = (select root_rk from teampulse_hub_meta))
       - (select sum((absence_segment_cd in ('2-5', '5+'))::int + (weekend_segment_cd in ('2-5', '5+'))::int
                     + (talk_segment_cd in ('20-30%', '30-50%', '50%+'))::int) from all_metrics_with_performance_and_office_traffic_and_grt
          where leaf_lvl > 0 and report_month >= (select grid_start from teampulse_hub_meta)))::float8 as val
union all
select 16 as n, 'T-рост: статусы роста - численность последнего месяца (корень)'::text as check_nm, 1 as must,
       ((select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key = 'rs')
       - (select sum(hc_cnt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta) and report_month = (select last_month from teampulse_hub_meta)))::float8 as val
union all
select 17 as n, 'T-рост: заявки с итогом по месяцам - заявки (корень, вся сетка)'::text as check_nm, 0 as must,
       (coalesce((select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key = 'rm'), 0)
       - (select count(*) from structure_x_rost where leaf_lvl > 0 and finish_month >= (select grid_start from teampulse_hub_meta)
          and finish_month <= (select last_month from teampulse_hub_meta) and (is_approved = 1 or is_declined = 1)))::float8 as val
union all
select 18 as n, 'города - посещения последнего закрытого месяца (корень)'::text as check_nm, 0 as must,
       (coalesce((select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key = 'oc'), 0)
       - (select sum(ovis_amt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta) and report_month = (select cm from teampulse_hub_cal)))::float8 as val
union all
select 19 as n, 'вакансии: корень - снимок (открытые на конец последнего месяца)'::text as check_nm, 0 as must,
       (coalesce((select sum(vac_open_cnt) from teampulse_hub_vacancy
                   where node_rk = (select root_rk from teampulse_hub_meta)
                     and report_month = (select last_month from teampulse_hub_meta)), 0)
       - coalesce((select sum(open_cnt) from structure_x_vacancy where report_month = (select last_month from teampulse_hub_meta)), 0))::float8 as val
union all
select 20 as n, 'профили - люди: численность последнего месяца'::text as check_nm, 1 as must,
       ((select sum(cnt) from teampulse_hub_prof)
       - (select sum(hc_total_cnt) from all_metrics_with_performance_and_office_traffic_and_grt where leaf_lvl > 0 and report_month = (select last_month from teampulse_hub_meta)))::float8 as val
union all
select 21 as n, 'мониторинг: категории - численность (корень, вся сетка)'::text as check_nm, 1 as must,
       ((select sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta))
       - (select sum(hc_cnt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta)))::float8 as val
union all
select 22 as n, 'найм: источник найма не со дня найма (всё время)'::text as check_nm, 1 as must,
       ((select count(*) from all_metrics_with_performance_and_office_traffic_and_grt a
          join (select distinct on (mdm_employee_rk, date_trunc('month', calendar_dt))
                       mdm_employee_rk::text as rk, date_trunc('month', calendar_dt)::date as m,
                       coalesce(source_type_nm::text, '-') as v
                from usr_cross_data.hr_executive_proteus
                where (coalesce(hire_flg::text, '0') = '1' or coalesce(transfer_candidate_flg::text, '0') = '1'
                    or coalesce(transfer_internal_flg::text, '0') = '1')
                order by mdm_employee_rk, date_trunc('month', calendar_dt), calendar_dt desc) h
            on h.rk = a.mdm_employee_rk::text and h.m = a.report_month
          where coalesce(a.hire_cnt, 0) + coalesce(a.transfer_candidate_amt, 0) + coalesce(a.transfer_internal_amt, 0) > 0
            and a.source_type_nm::text <> h.v))::float8 as val
union all
select 23 as n, 'найм: наймов без источника в день найма (справочно, всё время)'::text as check_nm, 0 as must,
       ((select count(*) from all_metrics_with_performance_and_office_traffic_and_grt
          where coalesce(hire_cnt, 0) + coalesce(transfer_candidate_amt, 0) + coalesce(transfer_internal_amt, 0) > 0
            and last_row_flg = 1 and source_type_nm::text = '-'))::float8 as val
union all
select 24 as n, 'вакансии: корень - снимок (закрытые за всё время сетки)'::text as check_nm, 0 as must,
       (coalesce((select sum(vac_close_cnt) from teampulse_hub_vacancy where node_rk = (select root_rk from teampulse_hub_meta)), 0)
       - coalesce((select sum(close_cnt) from structure_x_vacancy
                   where report_month >= (select grid_start from teampulse_hub_meta)), 0))::float8 as val
union all
select 27 as n, 'водопад: незамкнутые строки (конец - начало - найм + отток - в + из)'::text as check_nm, 1 as must,
       ((select count(*) from (select 1 from teampulse_hub_flow
                                group by node_rk, report_month, sp_cd, paint_cd, it_cd, staff_cd, act_cd
                                having abs(sum(fin_cnt) - sum(beg_cnt) - sum(hire_cnt) + sum(fire_cnt)
                                           - sum(tin_cnt) + sum(tout_cnt)) > 0.5) t))::float8 as val
union all
select 28 as n, 'водопад: конец = численность series (узел x месяц x срез, строки юнитов; нулевой паддинг ССЧ не в счёт)'::text as check_nm, 1 as must,
       ((select count(*) from (
            select f.node_rk, f.report_month, f.paint_cd, f.it_cd, f.staff_cd, f.act_cd
            from (select node_rk, report_month, paint_cd, it_cd, staff_cd, act_cd, sum(fin_cnt) as fin
                  from teampulse_hub_flow where sp_cd = '-' group by 1, 2, 3, 4, 5, 6) f
            full join (select node_rk, report_month, paint_cd, it_cd, staff_cd, act_cd, sum(hc_cnt) as hc
                       from teampulse_hub_series group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = f.node_rk and s.report_month = f.report_month and s.paint_cd = f.paint_cd
             and s.it_cd = f.it_cd and s.staff_cd = f.staff_cd and s.act_cd = f.act_cd
            where abs(coalesce(f.fin, 0) - coalesce(s.hc, 0)) > 0.5) t))::float8 as val
union all
select 29 as n, 'AI-недели: повторы ключа «узел x неделя»'::text as check_nm, 1 as must,
       ((select count(*) from (select 1 from teampulse_hub_aiw
                                group by node_rk, week having count(*) > 1) t))::float8 as val
union all
select 30 as n, 'AI-разрезы недели: повторы ключа «узел x ключ x значение»'::text as check_nm, 1 as must,
       ((select count(*) from (select 1 from teampulse_hub_aix
                                group by node_rk, k, v having count(*) > 1) t))::float8 as val
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

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
select 18 as n, 'города - посещения последнего месяца данных (корень)'::text as check_nm, 0 as must,
       (coalesce((select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key = 'oc'), 0)
       - (select sum(ovis_amt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta) and report_month = (select lm from teampulse_hub_cal)))::float8 as val
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
-- 09.11: справочно (must = 0). Найм и переводы витрины движения отчёт не читает (они — из переходов hub · 5, как мастер);
-- из витрины — только численность на начало и конец (№ 28) и отток (№ 32). Замыкание водопада отчёта — № 34
select 27 as n, 'водопад: незамкнутые строки витрины движения (справочно: отчёт берёт из неё только численность и отток)'::text as check_nm, 0 as must,
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
union all
-- 09.11 (сверка с мастер-отчётом Executive Report: водопад мастера замыкается без остатка): водопад отчёта у корня, срез
-- «Активная», последние 12 месяцев — численность на конец первого месяца + найм + в - отток - из = на конец последнего;
-- найм и переводы — строки дня события (hub · 5, правило датасета при фильтре по умолчанию), численность и отток — ряды.
-- Значение — остаток. Обязательная с 09.11: на бою 0 после правки «Перевод-» (выход из типа — по флагу строки, как мастер)
select 34 as n, 'водопад отчёта у корня («Активная», 12 мес.): остаток'::text as check_nm, 1 as must,
       ((select coalesce(sum(case when report_month = c.lm then hc_cnt end), 0)
                - coalesce(sum(case when report_month = (date_trunc('month', c.lm) - interval '11 month')::date then hc_cnt end), 0)
                + coalesce(sum(case when report_month > (date_trunc('month', c.lm) - interval '11 month')::date then fire_cnt end), 0)
         from teampulse_hub_series, teampulse_hub_cal c
         where node_rk = (select root_rk from teampulse_hub_meta) and act_cd = 'Активная')
       - (select coalesce(sum(case when trf_kind = 'h' or (trf_kind = 'i' and in_ok = 0 and cv_k <> '') then trf_cnt else 0 end), 0)
               + coalesce(sum(case when trf_kind = 'i' and in_ok = 1 and (fu = 1 or fa = 1) then trf_cnt else 0 end), 0)
               - coalesce(sum(case when trf_kind = 'o' and (fu = 1 or fa = 1) then trf_cnt else 0 end), 0)
          from teampulse_hub_trf, teampulse_hub_cal c
          where node_rk = (select root_rk from teampulse_hub_meta) and act_cd = 'Активная'
            and report_month > (date_trunc('month', c.lm) - interval '11 month')::date and report_month <= c.lm))::float8 as val
union all
-- 09.11 (владелец: «отчёт обязан быть консистентным, логика расчёта метрики не может быть разная»): отток водопада =
-- «Ушли, чел» рядов в каждой ячейке узел x месяц x срез (строки юнитов, вся сетка водопада). Найм отчёта (и водопада) —
-- события дня найма из переходов (hub · 5, вид h и переходы в найм), датасет считает его там; найм рядов и строк водопада
-- (hire_cnt / hco_cnt) отчёт не читает — здесь не сверяется
select 32 as n, 'водопад: отток = ряды отчёта (узел x месяц x срез)'::text as check_nm, 1 as must,
       ((select count(*) from (
            select coalesce(f.node_rk, s.node_rk) as node_rk
            from (select node_rk, report_month, paint_cd, it_cd, staff_cd, act_cd,
                         sum(hire_cnt) as hire, sum(hco_cnt) as hco, sum(fire_cnt) as fire
                  from teampulse_hub_flow where sp_cd = '-'
                  group by 1, 2, 3, 4, 5, 6) f
            full join (select node_rk, report_month, paint_cd, it_cd, staff_cd, act_cd,
                              sum(hire_cnt) as hire, sum(hco_cnt) as hco, sum(fire_cnt) as fire
                       from teampulse_hub_series
                       where report_month >= (select grid_start from teampulse_hub_cal)
                       group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = f.node_rk and s.report_month = f.report_month and s.paint_cd = f.paint_cd
             and s.it_cd = f.it_cd and s.staff_cd = f.staff_cd and s.act_cd = f.act_cd
            where abs(coalesce(f.fire, 0) - coalesce(s.fire, 0)) > 0.5) t))::float8 as val
union all
-- 09.11 (владелец: «две методологии на одну метрику категорически запрещены»): каждый разрез = своей метрике рядов в каждой
-- ячейке узел x срез (x месяц): численность последнего месяца, отток с начала года (разбивки найма — из переходов hub · 5),
-- посещения по городам (закрытый месяц) и календарь (рабочие дни и посещения по месяцам), заявки «Роста» (одобрено /
-- отклонено по месяцу итога = gapr / gdec). Значение — расходящихся ячеек
select 33 as n, 'разрезы = ряды отчёта (численность, отток, офис; узел x срез)'::text as check_nm, 1 as must,
       ((select count(*) from (
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('g') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('a') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('e') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('t') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('gr') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('s') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('c') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('o') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('w') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('r') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('sp') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('tc') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('rg') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('ws') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('mh') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('sp1') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xr') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xi') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xp') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xt') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xg') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xs') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xsp') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xtc') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('oc') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(ovis_amt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('dw') and true group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(wday_amt) as n from teampulse_hub_series where report_month between ((select cm from teampulse_hub_cal) - interval '1 month')::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('do') and true group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(ovis_amt) as n from teampulse_hub_series where report_month between ((select cm from teampulse_hub_cal) - interval '1 month')::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key = 'rm' and split_part(mx_val, '|', 4) = 'ok' group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(gapr_cnt) as n from teampulse_hub_series
                       where gapr_cnt > 0 group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select k.mx_key, s.node_rk
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key = 'rm' and split_part(mx_val, '|', 4) = 'no' group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(gdec_cnt) as n from teampulse_hub_series
                       where gdec_cnt > 0 group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
        ) t))::float8 as val
union all
-- 10.11 (владелец: «человек не должен считаться дважды ни при каких фильтрах»): строки переводов по людям и дням
-- (teampulse_hub_trf0) — сколько раз у человека за день в одном узле вышло больше одной строки входа (найм или перевод «в»)
-- или выхода, и сколько строк «из» пришлось на день увольнения. В таблицу отчёта такие строки сводятся в одну (hub · 5 trf),
-- поэтому числа не задваиваются; не ноль здесь — повод разобрать, какие ветки пересеклись (справочно)
select 35 as n, 'переводы: повторные строки человека за день в узле (сведены в одну)'::text as check_nm, 0 as must,
       ((select count(*) from (select 1 from teampulse_hub_trf0
                               group by node_rk, e, ev_dt, case when trf_kind = 'o' then 'o' else 'i' end having count(*) > 1) t)
        + (select count(*) from teampulse_hub_trf0 where trf_kind = 'o' and fx_day = 1))::float8 as val
union all
-- и обязательная: в таблице отчёта у человека за день в узле не больше одной строки входа и одной строки выхода. Таблица
-- отчёта хранит счётчики, поэтому сверяем их сумму с числом пар «человек, день, узел, сторона» в строках по людям
select 36 as n, 'переводы: один человек за день в узле — одна строка входа и одна выхода'::text as check_nm, 1 as must,
       ((select coalesce(sum(trf_cnt), 0) from teampulse_hub_trf)
        - (select count(*) from (select 1 from teampulse_hub_trf0 where not (trf_kind = 'o' and fx_day = 1)
                                 group by node_rk, e, ev_dt, case when trf_kind = 'o' then 'o' else 'i' end) g))::float8 as val
union all
-- 10.11, поставка 135 (владелец: «численность на движении одна, на структуре другая»): справочно — люди, у которых в
-- последний день данных один и тот же узел стоит в цепочке дважды. Такой человек входит в узел дважды уже в витрине
-- (строки двух уровней); в отчёте числа узла при этом одни на всех вкладках, но больше, чем людей. Не ноль — повод
-- показать цепочку владельцам витрины
select 37 as n, 'структура: люди с повтором узла в своей цепочке (последний день; справочно - так в витрине)'::text as check_nm, 0 as must,
       ((select count(*) from usr_cross_data.hr_executive_proteus x
         where x.calendar_dt = (select max(calendar_dt) from usr_cross_data.hr_executive_proteus)
           and (
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl1_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl2_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl3_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl4_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl5_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl6_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl7_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl8_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl9_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-') or
              nullif(nullif(x.lvl10_mapped_management_unit_rk::text, ''), '-') = nullif(nullif(x.lvl11_mapped_management_unit_rk::text, ''), '-')
           )))::float8 as val
union all
-- 38 (12.11): сегменты посещаемости согласованы - база руководителей + база остальных = общая база офиса; сегмент не
-- больше целого (рабочие дни и посещения руководителей - часть общих). Любая строка рядов с нарушением - выгрузки нет
select 38 as n, 'посещаемость: база сегментов = общая база, сегмент не больше целого (строк рядов с нарушением)'::text as check_nm, 1 as must,
       (select count(*) from teampulse_hub_series
        where coalesce(hob_cnt, 0) + coalesce(nob_cnt, 0) <> coalesce(obase_cnt, 0)
           or coalesce(hwd_amt, 0) > coalesce(wday_amt, 0) or coalesce(hov_amt, 0) > coalesce(ovis_amt, 0)
           or coalesce(hob_cnt, 0) < 0 or coalesce(nob_cnt, 0) < 0)::float8 as val
union all
-- 39, 40 (12.11, владелец: структура - один в один из витрины; неладное в ней подсвечиваем, а не чиним в отчёте).
-- 39: узлы последнего месяца, у которых в строках витрины больше одного родителя (часть строк со старым путём): в
-- дереве такой узел встаёт под одного из родителей, а люди считаются по путям строк - суммы детей и родителя могут не
-- сойтись. 40: юниты с больше чем одним путём. Не ноль - разбираться в источнике (hr_executive_proteus); список узлов
-- - запрос в AGENT.md, раздел «Структура: проверки 39-40»
select 39 as n, 'структура: узлов с несколькими родителями в витрине (разобраться в источнике)'::text as check_nm, 0 as must,
       (select count(*) from (
            select y.rk from (
                select unnest(a.ra) as rk, generate_subscripts(a.ra, 1) as lv, a.ra
                from (select distinct (ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text, s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text, s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl] as ra
                      from all_metrics_with_performance_and_office_traffic_and_grt s
                      where s.report_month = (select lm from teampulse_hub_cal) and s.leaf_lvl > 0) a
            ) y
            where y.lv > 1 and y.rk <> '-'
            group by y.rk
            having count(distinct y.ra[y.lv - 1]) > 1) z)::float8 as val
union all
select 40 as n, 'структура: юнитов с несколькими путями в витрине (разобраться в источнике)'::text as check_nm, 0 as must,
       (select count(*) from (
            select s.mng_unit_rk
            from all_metrics_with_performance_and_office_traffic_and_grt s
            where s.report_month = (select lm from teampulse_hub_cal) and s.leaf_lvl > 0
            group by s.mng_unit_rk
            having count(distinct array_to_string((ARRAY[s.lvl1_rk::text, s.lvl2_rk::text, s.lvl3_rk::text, s.lvl4_rk::text, s.lvl5_rk::text, s.lvl6_rk::text, s.lvl7_rk::text, s.lvl8_rk::text, s.lvl9_rk::text, s.lvl10_rk::text, s.lvl11_rk::text])[1:s.leaf_lvl], '|')) > 1) z)::float8 as val
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

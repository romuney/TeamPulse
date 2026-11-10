-- ============================================================================
-- 5. Отладка логики на реальных данных — Helicopter, параграф gp, после запуска ноутбука (файл 1).
-- ОДИН запрос — ОДНА таблица: выделить весь файл и выполнить, результат переслать целиком. Ничего не пишет, только
-- читает таблицы ноутбука teampulse_hub_* и источник по дням.
--
-- Параметры — блок p в начале запроса: unit — ключ подразделения (unit_rk; null — корень отчёта; найти ключ — poisk,
-- блок 0), m — месяц, первое число (null — последний закрытый), poisk — часть имени подразделения (null — без блока 0).
-- Срез — как в отчёте по умолчанию: тип численности «Активная», все покраски, IT-коды и штат.
--
-- Колонки ответа: n — номер блока, blok — что проверяется, stroka — месяц / покраска / разрез, ord — порядок
-- показателей, pokazatel — имя показателя, znachenie — число. Блоки:
--   0 поиск подразделения по части имени (только с poisk)
--   1 как мастер-отчёт (Executive Report, «Активная», 12 мес.): численность, найм (из него БГ и стажёры), отток,
--     «Перевод+» / «Перевод-», водопад окна (ostatok = 0; *_unit_only у корня = 0) — сверять с бордом мастера по месяцам
--   2 разбор hub checks № 33 и № 27: какой разрез расходится с рядами (ячеек, разница, у корня); незамкнутые строки
--     витрины движения по виду и месяцу — пусто, если проверки чистые
--   3 мониторинг по покраске за месяц m: hc = v_monitoringe
--   4 месячная текучесть: отток / среднесписочная * 100
--   5 срок закрытия вакансий: медиана по месяцам и за период январь..m
--   6 повторные строки источника за день с флагом перевода (ноутбук их схлопывает)
--   7 профили численности и средний возраст: lyudey_v_profilyah = chislennost
--   8 источник найма на день найма против последнего значения месяца
--   9 посещаемость за месяц m по покраске, как мастер «Посещаемость и бронирование офисов» (допуск ±1 п.п.)
--  10 посещения по шагам за месяц cm: источник -> таблица людей -> города -> отчёт (где теряются посещения по городам)
--  11 формулы мастера прямо по источнику по дням (найм, отток, Перевод+, Перевод-) рядом с отчётом: d_* = 0
--  12 «Движение по специализациям» всей компании как в отчёте: начало, найм, в, отток, из, конец, ostatok = 0 у каждой;
--     m_i / m_o — переводы в / из по формулам мастера прямо из источника, d_i / d_o = отчёт - мастер (должны быть 0)
--  13 переводы по специализациям при фильтре покраски HQ (вся компания, «Активная» + HQ): в отчёте (i, o) и по формулам
--     мастера (m_i, m_o); d_i и d_o должны быть 0 у каждой специализации
-- Ожидаемые числа сверки — в чате, не в репозитории. Проверено на стенде PostgreSQL (stand/nb_tp20.py --hub).
-- 09.11: файл — один запрос (было 13 отдельных); убраны устаревшие: водопад витрины движения и «откуда прочее» (найм и
-- переводы отчёта — из строк дня события, водопад сходится без «прочего»), переводы по специализациям по флагу уровня
-- (с 129-в — сумма флагов, как карточки «Переводы»)
-- ============================================================================
with p as (
    select null::text as unit,                     -- ключ подразделения (unit_rk); null — корень отчёта
           null::date as m,                        -- месяц (первое число); null — последний закрытый месяц
           null::text as poisk                     -- часть имени подразделения для блока 0; null — блока нет
),
u as (select coalesce((select unit from p), (select root_rk from teampulse_hub_meta)) as rk,
             coalesce((select m from p), (select cm from teampulse_hub_cal)) as m),
-- 0. поиск подразделения по части имени: ключ — в параметр unit
b0 as (
    select unit_rk, unit_lvl, unit_nm, kids_cnt from teampulse_hub_unit
    where (select poisk from p) is not null and unit_nm ilike '%' || (select poisk from p) || '%'
    order by unit_lvl, unit_nm limit 50
),
-- 1. как мастер-отчёт (HR Executive Report, дефолт борда: «Активная», 12 месяцев): численность на последний день месяца;
--    найм = найм в компанию + «Перевод в БГ» + «Перевод стажера в штат»; отток; «Перевод+» — вход в периметр (тип
--    численности, у подразделения — и его флаг); «Перевод-» — выход, месяц «день события + 1». Строка «водопад» — окно:
--    численность на конец первого месяца + найм + Перевод+ - отток - Перевод- = на конец последнего, ostatok = 0.
--    *_unit_only — переводы только по флагу юнита (без смены типа): у корня мастер их не считает — у корня 0
b1w as (select (date_trunc('month', lm) - interval '11 month')::date as m0, lm::date as m1 from teampulse_hub_cal),
b1s as (
    select report_month as m, sum(hc_cnt) as hc, sum(fire_cnt) as fire from teampulse_hub_series
    where node_rk = (select rk from u) and act_cd = 'Активная' group by 1
),
b1t as (
    select report_month as m,
           sum(case when trf_kind = 'h' or (trf_kind = 'i' and in_ok = 0 and cv_k <> '') then trf_cnt else 0 end) as hire,
           sum(case when trf_kind = 'i' and in_ok = 0 and cv_k = 'c' then trf_cnt else 0 end) as hire_bg,
           sum(case when trf_kind = 'i' and in_ok = 0 and cv_k = 's' then trf_cnt else 0 end) as hire_intern,
           sum(case when trf_kind = 'i' and in_ok = 1 and (fu = 1 or fa = 1) then trf_cnt else 0 end) as tin,
           sum(case when trf_kind = 'o' and (fu = 1 or fa = 1) then trf_cnt else 0 end) as tout,
           sum(case when trf_kind = 'i' and in_ok = 1 and fu = 1 and fa = 0 then trf_cnt else 0 end) as tin_unit_only,
           sum(case when trf_kind = 'o' and fu = 1 and fa = 0 then trf_cnt else 0 end) as tout_unit_only
    from teampulse_hub_trf where node_rk = (select rk from u) and act_cd = 'Активная' group by 1
),
b1 as (
    select s.m, s.hc, coalesce(t.hire, 0) as hire, coalesce(t.hire_bg, 0) as hire_bg, coalesce(t.hire_intern, 0) as hire_intern,
           s.fire, coalesce(t.tin, 0) as tin, coalesce(t.tout, 0) as tout,
           coalesce(t.tin_unit_only, 0) as tin_unit_only, coalesce(t.tout_unit_only, 0) as tout_unit_only
    from b1s s left join b1t t on t.m = s.m
    where s.m between (select m0 from b1w) and (select m1 from b1w)
),
b1x as (
    select to_char(m, 'YYYY-MM') as k, hc, hire, hire_bg, hire_intern, fire, tin, tout, tin_unit_only, tout_unit_only,
           null::numeric as ostatok
    from b1
    union all
    select 'водопад ' || to_char((select m0 from b1w), 'YYYY-MM') || '..' || to_char((select m1 from b1w), 'YYYY-MM'),
           sum(case when m = (select m1 from b1w) then hc end),
           sum(case when m > (select m0 from b1w) then hire end), sum(case when m > (select m0 from b1w) then hire_bg end),
           sum(case when m > (select m0 from b1w) then hire_intern end), sum(case when m > (select m0 from b1w) then fire end),
           sum(case when m > (select m0 from b1w) then tin end), sum(case when m > (select m0 from b1w) then tout end),
           sum(case when m > (select m0 from b1w) then tin_unit_only end), sum(case when m > (select m0 from b1w) then tout_unit_only end),
           sum(case when m = (select m1 from b1w) then hc end) - sum(case when m = (select m0 from b1w) then hc end)
           - sum(case when m > (select m0 from b1w) then hire - fire + tin - tout end)
    from b1
),
-- 2. разбор hub checks № 33 (разрез, ячеек с расхождением, разница разрез - ряды, у корня) и № 27 (незамкнутые строки
--    витрины движения по виду и месяцу: остаток и суммы найма, оттока, переводов этих строк). Пусто — проверки чистые
d33 as (

            select 'g'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('g') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'a'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('a') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'e'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('e') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 't'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('t') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'gr'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('gr') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 's'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('s') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'c'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('c') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'o'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('o') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'w'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('w') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'r'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('r') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'sp'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('sp') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'tc'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('tc') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'rg'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('rg') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'ws'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('ws') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'mh'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('mh') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'sp1'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('sp1') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(hc_cnt) as n from teampulse_hub_series where report_month = (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xr'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xr') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xi'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xi') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xp'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xp') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xt'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xt') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xg'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xg') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xs'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xs') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xsp'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xsp') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'xtc'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('xtc') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(fire_cnt) as n from teampulse_hub_series where report_month between date_trunc('year', (select lm from teampulse_hub_cal))::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'oc'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('oc') and true group by 1, 2, 3, 4, 5, 6) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, ''::text as m, sum(ovis_amt) as n from teampulse_hub_series where report_month = (select cm from teampulse_hub_cal) group by 1, 2, 3, 4, 5) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'dw'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('dw') and true group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(wday_amt) as n from teampulse_hub_series where report_month between ((select cm from teampulse_hub_cal) - interval '1 month')::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'do'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key in ('do') and true group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(ovis_amt) as n from teampulse_hub_series where report_month between ((select cm from teampulse_hub_cal) - interval '1 month')::date and (select lm from teampulse_hub_cal) group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'rm_ok'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key = 'rm' and split_part(mx_val, '|', 4) = 'ok' group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(gapr_cnt) as n from teampulse_hub_series
                       where gapr_cnt > 0 group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
            union all
            select 'rm_no'::text as mx_key, coalesce(k.node_rk, s.node_rk) as node_rk, coalesce(k.n, 0) - coalesce(s.n, 0) as d
            from (select mx_key, node_rk, paint_cd, it_cd, staff_cd, act_cd, substr(mx_val, 1, 7) as m, sum(mx_n) as n from teampulse_hub_mix
                  where mx_key = 'rm' and split_part(mx_val, '|', 4) = 'no' group by 1, 2, 3, 4, 5, 6, 7) k
            full join (select node_rk, paint_cd, it_cd, staff_cd, act_cd, to_char(report_month, 'YYYY-MM') as m, sum(gdec_cnt) as n from teampulse_hub_series
                       where gdec_cnt > 0 group by 1, 2, 3, 4, 5, 6) s
              on s.node_rk = k.node_rk and s.paint_cd = k.paint_cd and s.it_cd = k.it_cd and s.staff_cd = k.staff_cd
             and s.act_cd = k.act_cd and s.m is not distinct from k.m
            where abs(coalesce(k.n, 0) - coalesce(s.n, 0)) > 0.5
        ),
r27 as (
    select case when sp_cd = '-' then 'подразделение' else 'специализация' end as kind, report_month,
           sum(fin_cnt) - sum(beg_cnt) - sum(hire_cnt) + sum(fire_cnt) - sum(tin_cnt) + sum(tout_cnt) as ost,
           sum(hire_cnt) as hire, sum(fire_cnt) as fire, sum(tin_cnt) as tin, sum(tout_cnt) as tout
    from teampulse_hub_flow
    group by node_rk, report_month, sp_cd, paint_cd, it_cd, staff_cd, act_cd, case when sp_cd = '-' then 'подразделение' else 'специализация' end
    having abs(sum(fin_cnt) - sum(beg_cnt) - sum(hire_cnt) + sum(fire_cnt) - sum(tin_cnt) + sum(tout_cnt)) > 0.5
),
b2 as (
    select '33 ' || mx_key as k, count(*) as cells, sum(d) as sum_diff, sum(abs(d)) as sum_abs_diff,
           sum(case when node_rk = (select root_rk from teampulse_hub_meta) then d else 0 end) as root_diff,
           null::numeric as hire, null::numeric as fire, null::numeric as tin, null::numeric as tout
    from d33 group by mx_key
    union all
    select '27 ' || kind || ' ' || to_char(report_month, 'YYYY-MM'), count(*), sum(ost), sum(abs(ost)), null,
           sum(hire), sum(fire), sum(tin), sum(tout)
    from r27 group by kind, report_month
),
-- 3. мониторинг за месяц m по покраске: численность на конец месяца = люди с категорией (hc = v_monitoringe)
b3 as (
    select coalesce(paint_cd, 'ИТОГО') as k, sum(hc_cnt) as hc, sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) as v_monitoringe,
           sum(pnor_cnt) as norma, sum(plow_cnt) as nedorabotka, sum(phig_cnt) as pererabotka, sum(pgry_cnt) as ne_razmecheno
    from teampulse_hub_series
    where node_rk = (select rk from u) and report_month = (select m from u) and act_cd = 'Активная'
    group by rollup(paint_cd)
),
-- 4. месячная текучесть: отток / среднесписочная * 100 (точка графика и «Тек. мес.» таблицы подразделений)
b4 as (
    select to_char(report_month, 'YYYY-MM') as k, sum(fire_cnt) as fire, sum(avg_cnt) as ssch,
           100.0 * sum(fire_cnt) / nullif(sum(avg_cnt), 0) as turnover_m_pct
    from teampulse_hub_series where node_rk = (select rk from u) and act_cd = 'Активная' group by 1
),
-- 5. срок закрытия вакансий: медиана по вакансиям месяца и периода январь..m (не медиана медиан), дней без Hold
b5v as (
    select report_month, ttf_d from teampulse_hub_vacancy, generate_series(1, greatest(vac_ttf_cnt, 0)::int)
    where node_rk = (select rk from u) and ttf_d is not null
),
b5 as (
    select to_char(report_month, 'YYYY-MM') as k, count(*) as closed,
           percentile_cont(0.5) within group (order by ttf_d) as median_days, avg(ttf_d) as mean_days
    from b5v group by 1
    union all
    select 'период ' || to_char(date_trunc('year', (select m from u)), 'YYYY-MM') || '..' || to_char((select m from u), 'YYYY-MM'),
           count(*), percentile_cont(0.5) within group (order by ttf_d), avg(ttf_d)
    from b5v where report_month between date_trunc('year', (select m from u))::date and (select m from u)
),
-- 6. повторные строки источника за день с флагом перевода (ноутбук схлопывает их — перевод не удваивается)
b6 as (
    select to_char(date_trunc('month', calendar_dt), 'YYYY-MM') as k, count(*) as days_with_repeats, sum(n - 1) as extra_rows
    from (
        select mdm_employee_rk, calendar_dt::date as calendar_dt, count(*) as n
        from usr_cross_data.hr_executive_proteus
        where calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date and calendar_dt >= (select grid_start from teampulse_hub_cal)
          and (coalesce(lvl1_mngt_unit_in_trsf_flg::text, '0') = '1' or coalesce(lvl1_mngt_unit_out_trsf_flg::text, '0') = '1'
               or coalesce(transfer_to_specialization_flg::text, '0') = '1' or coalesce(transfer_out_specialization_flg::text, '0') = '1'
               or coalesce(transfer_to_active_type_flg::text, '0') = '1' or coalesce(transfer_out_active_type_flg::text, '0') = '1')
        group by 1, 2 having count(*) > 1
    ) d
    group by 1
),
-- 7. профили численности последнего месяца (поддерево узла) и средний возраст: сумма профилей = численность
b7sub as (select unit_rk from teampulse_hub_unit where '|' || path_rk || '|' like '%|' || (select rk from u) || '|%'),
b7pr as (
    select cnt, nullif(split_part(pf, ':', 2), '')::numeric as age from teampulse_hub_prof
    where node_rk in (select unit_rk from b7sub) and act_cd = 'Активная'
),
b7 as (
    select 'последний месяц'::text as k, (select sum(cnt) from b7pr) as lyudey_v_profilyah,
           (select sum(hc_cnt) from teampulse_hub_series where node_rk = (select rk from u)
              and report_month = (select last_month from teampulse_hub_meta) and act_cd = 'Активная') as chislennost,
           (select sum(age * cnt) / nullif(sum(case when age is not null then cnt end), 0) from b7pr) as sredniy_vozrast,
           (select sum(cnt) from b7pr where age is null) as bez_vozrasta
),
-- 8. источник найма: на день найма (так берёт ноутбук) против последнего значения месяца; differ — расходятся
b8h as (
    select mdm_employee_rk, date_trunc('month', calendar_dt)::date as m, coalesce(source_type_nm::text, '-') as src,
           row_number() over (partition by mdm_employee_rk, date_trunc('month', calendar_dt) order by calendar_dt desc) as rn_last
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date and calendar_dt >= (select grid_start from teampulse_hub_cal)
),
b8e as (
    select distinct on (mdm_employee_rk, date_trunc('month', calendar_dt))
           mdm_employee_rk, date_trunc('month', calendar_dt)::date as m, coalesce(source_type_nm::text, '-') as src_hire
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date and calendar_dt >= (select grid_start from teampulse_hub_cal)
      and (coalesce(hire_flg::text, '0') = '1' or coalesce(transfer_candidate_flg::text, '0') = '1'
           or coalesce(transfer_internal_flg::text, '0') = '1')
    order by mdm_employee_rk, date_trunc('month', calendar_dt), calendar_dt desc
),
b8 as (
    select to_char(e.m, 'YYYY-MM') as k, count(*) as hires, sum((e.src_hire <> h.src)::int) as differ,
           sum((e.src_hire = '-')::int) as no_value_on_hire_day
    from b8e e join b8h h on h.mdm_employee_rk = e.mdm_employee_rk and h.m = e.m and h.rn_last = 1
    group by 1
),
-- 9. посещаемость за месяц m по покраске, как мастер-отчёт «Посещаемость и бронирование офисов»
b9s as (
    select paint_cd, sum(wday_amt) as wday, sum(ovis_amt) as ovis, sum(fwday_amt) as fwday, sum(fovis_amt) as fovis,
           sum(bk_amt) as bk, sum(bkv_amt) as bkv, sum(vsv_amt) as vsv, sum(vbk_amt) as vbk
    from teampulse_hub_series
    where node_rk = (select rk from u) and report_month = (select m from u) and act_cd = 'Активная'
    group by 1
),
-- 10. посещения по шагам за месяц cm (hub checks № 18 / № 33: сумма по городам меньше посещений) — где теряются. У корня:
--     src_visits — источник посещений (база мастера: активные с закреплённым офисом, главный офис дня), из них
--     src_no_city — без города; tbl_visits — посещения в таблице людей (office_visit_amt строк last_row_flg = 1),
--     tbl_city_json — сумма по городам из office_city_visits_json тех же строк, tbl_visits_no_json — посещения строк без
--     json, tbl_leaf0 — посещения строк вне дерева (leaf_lvl = 0); rep_visits — ряды отчёта (ovis), rep_city — разрез
--     по городам (oc). Должно быть: src = tbl = rep, tbl_city_json = tbl_visits, rep_city = rep_visits
b10s as (
    select sum(case when coalesce(main_office_visit_rn, 0) = 1 and active_office_emp_flg = 'Да' then coalesce(office_visit_flg, 0) else 0 end) as src_visits,
           sum(case when coalesce(main_office_visit_rn, 0) = 1 and active_office_emp_flg = 'Да'
                     and coalesce(trim(office_city_nm::text), '') in ('', '-') then coalesce(office_visit_flg, 0) else 0 end) as src_no_city
    from usr_cross_data.office_traffic_attendance
    where calendar_dt >= (select cm from teampulse_hub_cal) and calendar_dt < ((select cm from teampulse_hub_cal) + interval '1 month')::date
      and work_day_flg = 1 and active_type_nm = 'Активная'
),
b10t as (
    select sum(coalesce(office_visit_amt, 0)) as tbl_visits,
           sum(case when office_city_visits_json is null then coalesce(office_visit_amt, 0) else 0 end) as tbl_visits_no_json,
           sum(case when leaf_lvl = 0 then coalesce(office_visit_amt, 0) else 0 end) as tbl_leaf0
    from all_metrics_with_performance_and_office_traffic_and_grt
    where report_month = (select cm from teampulse_hub_cal)
),
b10j as (
    select sum(coalesce((j.v ->> 'visit_count')::numeric, 0)) as tbl_city_json
    from (select json_array_elements(office_city_visits_json::json) as v
          from all_metrics_with_performance_and_office_traffic_and_grt
          where report_month = (select cm from teampulse_hub_cal) and office_city_visits_json is not null) j
),
b10 as (
    select 'месяц ' || to_char((select cm from teampulse_hub_cal), 'YYYY-MM') as k, s.src_visits, s.src_no_city,
           t.tbl_visits, j.tbl_city_json, t.tbl_visits_no_json, t.tbl_leaf0,
           (select sum(ovis_amt) from teampulse_hub_series where node_rk = (select root_rk from teampulse_hub_meta)
              and report_month = (select cm from teampulse_hub_cal)) as rep_visits,
           (select sum(mx_n) from teampulse_hub_mix where node_rk = (select root_rk from teampulse_hub_meta) and mx_key = 'oc') as rep_city
    from b10s s cross join b10t t cross join b10j j
),
-- 11. формулы мастера (Executive Report, дефолт: «Активная», вся компания) прямо по источнику по дням — рядом с отчётом
--     (блок 1). Строка дня в периметре — тип численности дня «Активная»; событие дня — его флаги: m_hire — найм в компанию,
--     в БГ или стажёр в штат; m_fire — увольнение; m_tin — вход в тип (флаг to_active) без найма; m_tout — выход из типа
--     (флаг out_active) без увольнения, месяц «день + 1». rep_* — отчёт (как блок 1), d_* = rep - m (должно быть 0)
b11d as (
    select mdm_employee_rk as e, calendar_dt::date as dt,
           max((coalesce(hire_flg::text, '0') = '1' or coalesce(transfer_candidate_flg::text, '0') = '1'
                or coalesce(transfer_internal_flg::text, '0') = '1')::int) as h,
           max((coalesce(fire_flg::text, '0') = '1')::int) as f,
           max((coalesce(transfer_to_active_type_flg::text, '0') = '1')::int) as ti,
           max((coalesce(transfer_out_active_type_flg::text, '0') = '1')::int) as tu
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
      and calendar_dt >= (select m0 from b1w) and calendar_dt < ((select m1 from b1w) + interval '1 month')::date
      and active_type_nm = 'Активная'
    group by 1, 2
),
b11m as (
    select m, sum(h) as m_hire, sum(f) as m_fire, sum(ti) as m_tin, sum(tu) as m_tout
    from (
        select date_trunc('month', dt)::date as m, h, f, case when h = 0 then ti else 0 end as ti, 0 as tu from b11d
        union all
        select date_trunc('month', dt + 1)::date, 0, 0, 0, case when f = 0 then tu else 0 end from b11d
    ) x
    group by 1
),
b11 as (
    select to_char(r.m, 'YYYY-MM') as k, m.m_hire, r.hire as rep_hire, m.m_fire, r.fire as rep_fire,
           m.m_tin, r.tin as rep_tin, m.m_tout, r.tout as rep_tout,
           r.hire - m.m_hire as d_hire, r.fire - m.m_fire as d_fire, r.tin - m.m_tin as d_tin, r.tout - m.m_tout as d_tout
    from b1 r left join b11m m on m.m = r.m
    where r.m > (select m0 from b1w)
),
-- 12. «Движение по специализациям» всей компании (корень, «Активная», с января по последний месяц) — как в отчёте: на начало
--     (конец декабря) и на конец, отток — витрина движения по специализациям; найм — дни найма (специализация дня найма);
--     переводы в / из — флаги источника (юнит, тип численности, смена специализации). ostatok = конец - начало - найм -
--     в + отток + из (должен быть 0 у каждой специализации). Люди без специализации — строка «Не указано»
b12y as (select date_trunc('year', lm)::date as y0, lm::date as m1 from teampulse_hub_cal),
b12f as (
    select sp_cd as sp, sum(case when report_month = (select y0 from b12y) then beg_cnt else 0 end) as b,
           sum(case when report_month = (select m1 from b12y) then fin_cnt else 0 end) as e, sum(fire_cnt) as f
    from teampulse_hub_flow
    where node_rk = (select rk from u) and act_cd = 'Активная' and sp_cd <> '-'
      and report_month between (select y0 from b12y) and (select m1 from b12y)
    group by 1
),
b12t as (
    select case when sp_cd = '-' then 'Не указано' else sp_cd end as sp,
           sum(case when trf_kind = 'h' or (trf_kind = 'i' and in_ok = 0 and cv_k <> '') then trf_cnt else 0 end) as h,
           sum(case when trf_kind = 'i' and in_ok = 1 and (fu = 1 or fa = 1 or fsp = 1) then trf_cnt else 0 end) as i,
           sum(case when trf_kind = 'o' and (fu = 1 or fa = 1 or fsp = 1) then trf_cnt else 0 end) as o
    from teampulse_hub_trf
    where node_rk = (select rk from u) and act_cd = 'Активная'
      and report_month between (select y0 from b12y) and (select m1 from b12y)
    group by 1
),
-- формулы мастера по источнику (Executive Report, фильтр «Активная» и разрез по специализации): строка дня в периметре —
-- тип дня «Активная»; «в» — флаг входа в тип или в специализацию без найма (найм, БГ, стажёр в штат), «из» — флаг выхода
-- из типа или из специализации без увольнения, месяц «день + 1»; специализация — этой строки
b12d as (
    select mdm_employee_rk as e, calendar_dt::date as dt,
           min(translate(coalesce(nullif(trim(employee_specialization_desc::text), ''), '-'), E'	
|', '  /')) as sp,
           max((coalesce(hire_flg::text, '0') = '1' or coalesce(transfer_candidate_flg::text, '0') = '1'
                or coalesce(transfer_internal_flg::text, '0') = '1')::int) as h,
           max((coalesce(fire_flg::text, '0') = '1')::int) as f,
           max((coalesce(transfer_to_active_type_flg::text, '0') = '1' or coalesce(transfer_to_specialization_flg::text, '0') = '1')::int) as ti,
           max((coalesce(transfer_out_active_type_flg::text, '0') = '1' or coalesce(transfer_out_specialization_flg::text, '0') = '1')::int) as tu
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
      and calendar_dt >= (select y0 from b12y) - 1 and calendar_dt < ((select m1 from b12y) + interval '1 month')::date
      and active_type_nm = 'Активная'
    group by 1, 2
),
b12m as (
    select case when sp = '-' then 'Не указано' else sp end as sp, sum(i) as m_i, sum(o) as m_o
    from (
        select sp, case when h = 0 and dt >= (select y0 from b12y) then ti else 0 end as i, 0 as o from b12d
        union all
        select sp, 0, case when f = 0 and dt + 1 >= (select y0 from b12y) and dt + 1 < ((select m1 from b12y) + interval '1 month')::date
                           then tu else 0 end from b12d
    ) x
    group by 1
),
b12 as (
    select coalesce(f.sp, t.sp) as k, coalesce(m.m_i, 0) as m_i, coalesce(m.m_o, 0) as m_o,
           coalesce(t.i, 0) - coalesce(m.m_i, 0) as d_i, coalesce(t.o, 0) - coalesce(m.m_o, 0) as d_o, coalesce(f.b, 0) as b, coalesce(t.h, 0) as h, coalesce(t.i, 0) as i,
           coalesce(f.f, 0) as f, coalesce(t.o, 0) as o, coalesce(f.e, 0) as e,
           coalesce(f.e, 0) - coalesce(f.b, 0) - coalesce(t.h, 0) - coalesce(t.i, 0) + coalesce(f.f, 0) + coalesce(t.o, 0) as ostatok
    from b12f f full join b12t t on t.sp = f.sp
    left join b12m m on m.sp = coalesce(f.sp, t.sp)
),
-- 13. переводы по специализациям при фильтре покраски HQ (вся компания, «Активная» + HQ, с января): в отчёте (i, o) и по
--     формулам мастера по источнику (m_i, m_o); d_* = отчёт - мастер (должно быть 0). Строка дня в периметре — тип «Активная»
--     и покраска HQ; «в» — флаг входа в тип, в HQ или в специализацию без найма, «из» — флаг выхода без увольнения, месяц
--     «день + 1». Один день человека — одно событие, даже если в этот день сменились и покраска, и специализация
b13t as (
    select case when sp_cd = '-' then 'Не указано' else sp_cd end as sp,
           sum(case when trf_kind = 'i' and in_ok = 1 and (fu = 1 or fa = 1 or fp = 1 or fsp = 1) then trf_cnt else 0 end) as i,
           sum(case when trf_kind = 'o' and (fu = 1 or fa = 1 or fp = 1 or fsp = 1) then trf_cnt else 0 end) as o
    from teampulse_hub_trf
    where node_rk = (select root_rk from teampulse_hub_meta) and act_cd = 'Активная' and paint_cd = 'HQ'
      and report_month between (select y0 from b12y) and (select m1 from b12y)
    group by 1
),
b13d as (
    select mdm_employee_rk as e, calendar_dt::date as dt,
           min(translate(coalesce(nullif(trim(employee_specialization_desc::text), ''), '-'), E'	
|', '  /')) as sp,
           max((coalesce(hire_flg::text, '0') = '1' or coalesce(transfer_candidate_flg::text, '0') = '1'
                or coalesce(transfer_internal_flg::text, '0') = '1')::int) as h,
           max((coalesce(fire_flg::text, '0') = '1')::int) as f,
           max((coalesce(transfer_to_active_type_flg::text, '0') = '1' or coalesce(transfer_to_hq_flg::text, '0') = '1'
                or coalesce(transfer_to_specialization_flg::text, '0') = '1')::int) as ti,
           max((coalesce(transfer_out_active_type_flg::text, '0') = '1' or coalesce(transfer_out_hq_flg::text, '0') = '1'
                or coalesce(transfer_out_specialization_flg::text, '0') = '1')::int) as tu
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= (date_trunc('year', current_date - 1) - interval '3 year')::date
      and calendar_dt >= (select y0 from b12y) - 1 and calendar_dt < ((select m1 from b12y) + interval '1 month')::date
      and active_type_nm = 'Активная' and emp_specialization_oper_code = 'HQ'
    group by 1, 2
),
b13m as (
    select case when sp = '-' then 'Не указано' else sp end as sp, sum(i) as m_i, sum(o) as m_o
    from (
        select sp, case when h = 0 and dt >= (select y0 from b12y) then ti else 0 end as i, 0 as o from b13d
        union all
        select sp, 0, case when f = 0 and dt + 1 >= (select y0 from b12y) and dt + 1 < ((select m1 from b12y) + interval '1 month')::date
                           then tu else 0 end from b13d
    ) x
    group by 1
),
b13 as (
    select coalesce(t.sp, m.sp) as k, coalesce(t.i, 0) as i, coalesce(t.o, 0) as o, coalesce(m.m_i, 0) as m_i, coalesce(m.m_o, 0) as m_o,
           coalesce(t.i, 0) - coalesce(m.m_i, 0) as d_i, coalesce(t.o, 0) - coalesce(m.m_o, 0) as d_o
    from b13t t full join b13m m on m.sp = t.sp
    where coalesce(t.i, 0) + coalesce(t.o, 0) + coalesce(m.m_i, 0) + coalesce(m.m_o, 0) > 0
)
select 0 as n, 'поиск подразделения'::text as blok, (unit_rk || ' ' || unit_nm)::text as stroka,
       unnest(array[1, 2]) as ord, unnest(array['unit_lvl', 'kids_cnt']::text[]) as pokazatel,
       unnest(array[(unit_lvl)::numeric, (kids_cnt)::numeric]) as znachenie
from b0
union all
select 1 as n, 'как мастер-отчёт: Активная, 12 мес.'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) as ord, unnest(array['hc', 'hire', 'hire_bg', 'hire_intern', 'fire', 'tin', 'tout', 'tin_unit_only', 'tout_unit_only', 'ostatok']::text[]) as pokazatel,
       unnest(array[(hc)::numeric, (hire)::numeric, (hire_bg)::numeric, (hire_intern)::numeric, (fire)::numeric, (tin)::numeric, (tout)::numeric, (tin_unit_only)::numeric, (tout_unit_only)::numeric, (ostatok)::numeric]) as znachenie
from b1x
union all
select 2 as n, 'разбор проверок 33 и 27'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3, 4, 5, 6, 7, 8]) as ord, unnest(array['cells', 'sum_diff', 'sum_abs_diff', 'root_diff', 'hire', 'fire', 'tin', 'tout']::text[]) as pokazatel,
       unnest(array[(cells)::numeric, (sum_diff)::numeric, (sum_abs_diff)::numeric, (root_diff)::numeric, (hire)::numeric, (fire)::numeric, (tin)::numeric, (tout)::numeric]) as znachenie
from b2
union all
select 3 as n, 'мониторинг по покраске (месяц m)'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3, 4, 5, 6]) as ord, unnest(array['hc', 'v_monitoringe', 'norma', 'nedorabotka', 'pererabotka', 'ne_razmecheno']::text[]) as pokazatel,
       unnest(array[(hc)::numeric, (v_monitoringe)::numeric, (norma)::numeric, (nedorabotka)::numeric, (pererabotka)::numeric, (ne_razmecheno)::numeric]) as znachenie
from b3
union all
select 4 as n, 'месячная текучесть'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3]) as ord, unnest(array['fire', 'ssch', 'turnover_m_pct']::text[]) as pokazatel,
       unnest(array[(fire)::numeric, (round(ssch, 1))::numeric, (round(turnover_m_pct, 2))::numeric]) as znachenie
from b4
union all
select 5 as n, 'срок закрытия вакансий'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3]) as ord, unnest(array['closed', 'median_days', 'mean_days']::text[]) as pokazatel,
       unnest(array[(closed)::numeric, (median_days)::numeric, (round(mean_days::numeric, 1))::numeric]) as znachenie
from b5
union all
select 6 as n, 'повторные строки источника за день'::text as blok, (k)::text as stroka,
       unnest(array[1, 2]) as ord, unnest(array['days_with_repeats', 'extra_rows']::text[]) as pokazatel,
       unnest(array[(days_with_repeats)::numeric, (extra_rows)::numeric]) as znachenie
from b6
union all
select 7 as n, 'профили и средний возраст'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3, 4]) as ord, unnest(array['lyudey_v_profilyah', 'chislennost', 'sredniy_vozrast', 'bez_vozrasta']::text[]) as pokazatel,
       unnest(array[(lyudey_v_profilyah)::numeric, (chislennost)::numeric, (round(sredniy_vozrast, 2))::numeric, (bez_vozrasta)::numeric]) as znachenie
from b7
union all
select 8 as n, 'источник найма на день найма'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3]) as ord, unnest(array['hires', 'differ', 'no_value_on_hire_day']::text[]) as pokazatel,
       unnest(array[(hires)::numeric, (differ)::numeric, (no_value_on_hire_day)::numeric]) as znachenie
from b8
union all
select 9 as n, 'посещаемость (месяц m)'::text as blok, (paint_cd)::text as stroka,
       unnest(array[1, 2, 3, 4, 5, 6, 7, 8]) as ord, unnest(array['attendance_pct', 'fix_attendance_pct', 'bookings_no_visit', 'bookings_with_visit', 'visits_no_booking', 'visits_with_booking', 'no_visit_share_pct', 'no_booking_share_pct']::text[]) as pokazatel,
       unnest(array[(round(100.0 * ovis / nullif(wday, 0), 2))::numeric, (round(100.0 * fovis / nullif(fwday, 0), 2))::numeric, (bkv)::numeric, (bk - bkv)::numeric, (vsv)::numeric, (vbk)::numeric, (round(100.0 * bkv / nullif(bk, 0), 2))::numeric, (round(100.0 * vsv / nullif(ovis, 0), 2))::numeric]) as znachenie
from b9s
union all
select 11 as n, 'формулы мастера по источнику и отчёт'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) as ord, unnest(array['m_hire', 'rep_hire', 'm_fire', 'rep_fire', 'm_tin', 'rep_tin', 'm_tout', 'rep_tout', 'd_hire', 'd_fire', 'd_tin', 'd_tout']::text[]) as pokazatel,
       unnest(array[(m_hire)::numeric, (rep_hire)::numeric, (m_fire)::numeric, (rep_fire)::numeric, (m_tin)::numeric, (rep_tin)::numeric, (m_tout)::numeric, (rep_tout)::numeric, (d_hire)::numeric, (d_fire)::numeric, (d_tin)::numeric, (d_tout)::numeric]) as znachenie
from b11
union all
select 12 as n, 'движение по специализациям (с января, Активная)'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) as ord, unnest(array['b', 'h', 'i', 'f', 'o', 'e', 'ostatok', 'm_i', 'm_o', 'd_i', 'd_o']::text[]) as pokazatel,
       unnest(array[(b)::numeric, (h)::numeric, (i)::numeric, (f)::numeric, (o)::numeric, (e)::numeric, (ostatok)::numeric, (m_i)::numeric, (m_o)::numeric, (d_i)::numeric, (d_o)::numeric]) as znachenie
from b12
union all
select 13 as n, 'переводы по специализациям при фильтре HQ (с января, Активная + HQ)'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3, 4, 5, 6]) as ord, unnest(array['i', 'o', 'm_i', 'm_o', 'd_i', 'd_o']::text[]) as pokazatel,
       unnest(array[(i)::numeric, (o)::numeric, (m_i)::numeric, (m_o)::numeric, (d_i)::numeric, (d_o)::numeric]) as znachenie
from b13
union all
select 10 as n, 'посещения по шагам (месяц cm)'::text as blok, (k)::text as stroka,
       unnest(array[1, 2, 3, 4, 5, 6, 7, 8]) as ord, unnest(array['src_visits', 'src_no_city', 'tbl_visits', 'tbl_city_json', 'tbl_visits_no_json', 'tbl_leaf0', 'rep_visits', 'rep_city']::text[]) as pokazatel,
       unnest(array[(src_visits)::numeric, (src_no_city)::numeric, (tbl_visits)::numeric, (tbl_city_json)::numeric, (tbl_visits_no_json)::numeric, (tbl_leaf0)::numeric, (rep_visits)::numeric, (rep_city)::numeric]) as znachenie
from b10
order by n, stroka, ord;

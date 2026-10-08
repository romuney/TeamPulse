SELECT section, item, value
-- ============================================================================
-- 0в. Разведка prod_proteus.hr_structure_overall, второй заход — ОДИН запрос.
-- SQL Lab: вставить целиком, выполнить (Ctrl+Enter), ответ — «Скопировать
-- в буфер» или CSV. Строк в ответе — около 150.
--
-- Что выяснилось в 0б: значения юнита включают всё его поддерево (численность
-- одинакова на первых уровнях), ССЧ = (численность + лаг) / 2, лаг — численность
-- того же ключа месяцем раньше. Здесь — то, без чего не написать датасет:
-- накопительные ли потоки и где считается перевод, сходится ли баланс
-- компании, кого нанимают и что такое «найм→акт», на какую численность
-- считается перформанс, юниты с двумя родителями, люди прямо в узлах,
-- реорганизации и свежесть данных.
--
-- ОТВЕТ МАСКИРОВАН, как и в 0б: имён и ключей юнитов нет, все суммы — в
-- промилле (‰), но база другая — численность компании (верхний юнит)
-- в последнем месяце = 1000‰. «Прошлый месяц» — последний полный.
--
-- Разделы: 1 уровни · 2 компания по месяцам · 3 за 12 месяцев по значениям
-- атрибутов · 4 перформанс · 5 дерево · 6 юниты по месяцам и год назад ·
-- 7 значения атрибутов во времени · 8 свежесть. Проверено на ClickHouse 24.8.
-- ============================================================================
FROM
(
    -- 1. Прошлый (полный) месяц по уровням. Значения юнита включают поддерево, поэтому
    --    численность одинакова на верхних уровнях. Если и потоки одинаковы — они тоже
    --    накопительные; если переводы на верхнем уровне около нуля — перевод считается
    --    только там, где человек пересёк границу юнита. Остаток уровня — изменение
    --    численности к позапрошлому месяцу, которого нет в потоках
    SELECT 1 AS n, '1 уровни, прошлый месяц' AS section, toUInt32(ifNull(lvl, 0)) AS ord,
           concat('уровень ', ifNull(toString(lvl), 'NULL')) AS item,
           concat('юнитов ', toString(units),
           ' · числ ', ifNull(toString(round((emp) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · лаг ', ifNull(toString(round((lag) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · ССЧ ', ifNull(toString(round((ssch) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · найм ', ifNull(toString(round((hire) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · найм→акт ', ifNull(toString(round((hact) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · увольн ', ifNull(toString(round((fire) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · regret ', ifNull(toString(round((regret) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · перев вход ', ifNull(toString(round((tin) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · выход ', ifNull(toString(round((tout) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · внутр ', ifNull(toString(round((tint) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · кандидаты ', ifNull(toString(round((tcand) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · perf норм ', ifNull(toString(round((pn) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · низк ', ifNull(toString(round((pl) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · выс ', ifNull(toString(round((ph) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · сер ', ifNull(toString(round((pg) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · Δ к позапрошлому ', ifNull(toString(round((emp - e_prev) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · остаток ', ifNull(toString(round((emp - e_prev - (hire - fire + tin - tout)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL')) AS value
    FROM
    (
        SELECT lvl, uniqExactIf(mngt_unit_rk, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)) AS units,
               ifNull(sumIf(employee_amt, month = addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -1)), 0) AS e_prev,
               ifNull(sumIf(employee_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS emp,
               ifNull(sumIf(lag_employee_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS lag,
               ifNull(sumIf(ssch_employee_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS ssch,
               ifNull(sumIf(hire_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS hire,
               ifNull(sumIf(hire_to_active_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS hact,
               ifNull(sumIf(fire_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS fire,
               ifNull(sumIf(regret_fire_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS regret,
               ifNull(sumIf(transfer_in_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS tin,
               ifNull(sumIf(transfer_out_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS tout,
               ifNull(sumIf(transfer_internal_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS tint,
               ifNull(sumIf(transfer_candidate_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS tcand,
               ifNull(sumIf(perf_normal, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS pn,
               ifNull(sumIf(perf_low, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS pl,
               ifNull(sumIf(perf_high, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS ph,
               ifNull(sumIf(perf_gray, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS pg
        FROM prod_proteus.hr_structure_overall
        WHERE month BETWEEN addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -1) AND addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)
        GROUP BY lvl
    )

    UNION ALL

    -- 2. Компания (верхний юнит) по месяцам: сходится ли баланс
    --    «численность − прошлый месяц = найм − увольнения + переводы» и что остаётся.
    --    Большой остаток — приток или отток, которого нет ни в найме, ни в увольнениях
    SELECT 2 AS n, '2 компания по месяцам' AS section, toUInt32(toYYYYMM(m)) AS ord, toString(m) AS item,
           concat('числ ', ifNull(toString(round((emp) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · Δ к прошлому ', if(prev < 0, '—', ifNull(toString(round((emp - prev) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL')),
           ' · лаг ', ifNull(toString(round((lag) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · Δ по лагу ', ifNull(toString(round((emp - lag) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · найм ', ifNull(toString(round((hire) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · найм→акт ', ifNull(toString(round((hact) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · увольн ', ifNull(toString(round((fire) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · regret ', ifNull(toString(round((regret) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · перев вход ', ifNull(toString(round((tin) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · выход ', ifNull(toString(round((tout) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · внутр ', ifNull(toString(round((tint) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · кандидаты ', ifNull(toString(round((tcand) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · остаток ', if(prev < 0, '—', ifNull(toString(round((emp - prev - (hire - fire + tin - tout)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL')),
           ' · остаток с найм→акт ', if(prev < 0, '—', ifNull(toString(round((emp - prev - (hact - fire + tin - tout)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL')),
           ' · ССЧ ', ifNull(toString(round((ssch) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · текучесть % ', ifNull(if((ssch) = 0, '—', toString(round((fire) / (ssch) * 100, 1))), '—'),
           ' · perf/числ ', ifNull(if((emp) = 0, '—', toString(round((pn + pl + ph + pg) / (emp), 3))), '—'),
           ' · оценённых % ', ifNull(if((emp) = 0, '—', toString(round((pn + pl + ph) / (emp) * 100, 1))), '—'),
           ' · низк среди оценённых % ', ifNull(if((pn + pl + ph) = 0, '—', toString(round((pl) / (pn + pl + ph) * 100, 1))), '—'),
           ' · выс среди оценённых % ', ifNull(if((pn + pl + ph) = 0, '—', toString(round((ph) / (pn + pl + ph) * 100, 1))), '—')) AS value
    FROM
    (
        SELECT *, lagInFrame(emp, 1, toFloat64(-1)) OVER (ORDER BY m ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS prev
        FROM
        (
            SELECT month AS m,
                   ifNull(sum(employee_amt), 0) AS emp,
                   ifNull(sum(lag_employee_amt), 0) AS lag,
                   ifNull(sum(ssch_employee_amt), 0) AS ssch,
                   ifNull(sum(hire_amt), 0) AS hire,
                   ifNull(sum(hire_to_active_amt), 0) AS hact,
                   ifNull(sum(fire_amt), 0) AS fire,
                   ifNull(sum(regret_fire_amt), 0) AS regret,
                   ifNull(sum(transfer_in_amt), 0) AS tin,
                   ifNull(sum(transfer_out_amt), 0) AS tout,
                   ifNull(sum(transfer_internal_amt), 0) AS tint,
                   ifNull(sum(transfer_candidate_amt), 0) AS tcand,
                   ifNull(sum(perf_normal), 0) AS pn,
                   ifNull(sum(perf_low), 0) AS pl,
                   ifNull(sum(perf_high), 0) AS ph,
                   ifNull(sum(perf_gray), 0) AS pg
            FROM prod_proteus.hr_structure_overall
            WHERE lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall) AND month IS NOT NULL
            GROUP BY m
        )
    )

    UNION ALL

    -- 3. Компания за 12 полных месяцев по значениям каждого атрибута: кого нанимают,
    --    кто уходит, где «найм→акт», переводы кандидатов и перформанс. Остаток —
    --    изменение численности за год, которого нет в потоках: смена типа или
    --    договора, притоки без найма
    SELECT 3 AS n, concat('3 за 12 мес · ', kv.1) AS section, toUInt32(rn) AS ord, kv.2 AS item,
           concat('числ прошлый месяц ', ifNull(toString(round((emp_full) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · найм ', ifNull(toString(round((hire) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · найм→акт ', ifNull(toString(round((hact) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · увольн ', ifNull(toString(round((fire) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · regret ', ifNull(toString(round((regret) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · перев вход ', ifNull(toString(round((tin) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · выход ', ifNull(toString(round((tout) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · внутр ', ifNull(toString(round((tint) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · кандидаты ', ifNull(toString(round((tcand) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · Δ за 12 мес ', ifNull(toString(round((emp_full - emp_y0) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · остаток ', ifNull(toString(round((emp_full - emp_y0 - (hire - fire + tin - tout)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · текучесть в мес % ', ifNull(if((ssch) = 0, '—', toString(round((fire) / (ssch) * 100, 1))), '—'),
           ' · perf/числ ', ifNull(if((emp) = 0, '—', toString(round((pn + pl + ph + pg) / (emp), 3))), '—'),
           ' · оценённых % ', ifNull(if((emp) = 0, '—', toString(round((pn + pl + ph) / (emp) * 100, 1))), '—')) AS value
    FROM
    (
        SELECT kv, ifNull(sumIf(employee_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS emp_full,
               ifNull(sumIf(employee_amt, month = addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS emp_y0,
               ifNull(sumIf(employee_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS emp,
               ifNull(sumIf(lag_employee_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS lag,
               ifNull(sumIf(ssch_employee_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS ssch,
               ifNull(sumIf(hire_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS hire,
               ifNull(sumIf(hire_to_active_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS hact,
               ifNull(sumIf(fire_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS fire,
               ifNull(sumIf(regret_fire_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS regret,
               ifNull(sumIf(transfer_in_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS tin,
               ifNull(sumIf(transfer_out_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS tout,
               ifNull(sumIf(transfer_internal_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS tint,
               ifNull(sumIf(transfer_candidate_amt, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS tcand,
               ifNull(sumIf(perf_normal, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS pn,
               ifNull(sumIf(perf_low, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS pl,
               ifNull(sumIf(perf_high, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS ph,
               ifNull(sumIf(perf_gray, month > addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)), 0) AS pg,
               row_number() OVER (PARTITION BY kv.1 ORDER BY sumIf(employee_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)) DESC) AS rn
        FROM prod_proteus.hr_structure_overall
        ARRAY JOIN [
            ('active_type_gr_nm', ifNull(active_type_gr_nm, 'NULL')),
            ('active_type_nm', ifNull(active_type_nm, 'NULL')),
            ('emp_specialization_oper_code', ifNull(emp_specialization_oper_code, 'NULL')),
            ('emp_specialization_it_code', ifNull(emp_specialization_it_code, 'NULL')),
            ('employment_relation_type_desc', ifNull(employment_relation_type_desc, 'NULL'))
        ] AS kv
        WHERE lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall) AND month BETWEEN addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12) AND addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)
        GROUP BY kv
    )

    UNION ALL

    -- 4. Перформанс компании в прошлом месяце: тип численности × покраска.
    --    Кого оценивают (доля оценённых), на какую численность считается perf
    SELECT 4 AS n, '4 перформанс, прошлый месяц' AS section, toUInt32(rn) AS ord, concat(g, ' · ', o) AS item,
           concat('числ ', ifNull(toString(round((emp) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · норм ', ifNull(toString(round((pn) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · низк ', ifNull(toString(round((pl) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · выс ', ifNull(toString(round((ph) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · сер ', ifNull(toString(round((pg) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · perf/числ ', ifNull(if((emp) = 0, '—', toString(round((pn + pl + ph + pg) / (emp), 3))), '—'),
           ' · оценённых % ', ifNull(if((emp) = 0, '—', toString(round((pn + pl + ph) / (emp) * 100, 1))), '—'),
           ' · низк среди оценённых % ', ifNull(if((pn + pl + ph) = 0, '—', toString(round((pl) / (pn + pl + ph) * 100, 1))), '—'),
           ' · выс среди оценённых % ', ifNull(if((pn + pl + ph) = 0, '—', toString(round((ph) / (pn + pl + ph) * 100, 1))), '—')) AS value
    FROM
    (
        SELECT ifNull(active_type_gr_nm, 'NULL') AS g, ifNull(emp_specialization_oper_code, 'NULL') AS o,
               ifNull(sum(employee_amt), 0) AS emp,
               ifNull(sum(lag_employee_amt), 0) AS lag,
               ifNull(sum(ssch_employee_amt), 0) AS ssch,
               ifNull(sum(hire_amt), 0) AS hire,
               ifNull(sum(hire_to_active_amt), 0) AS hact,
               ifNull(sum(fire_amt), 0) AS fire,
               ifNull(sum(regret_fire_amt), 0) AS regret,
               ifNull(sum(transfer_in_amt), 0) AS tin,
               ifNull(sum(transfer_out_amt), 0) AS tout,
               ifNull(sum(transfer_internal_amt), 0) AS tint,
               ifNull(sum(transfer_candidate_amt), 0) AS tcand,
               ifNull(sum(perf_normal), 0) AS pn,
               ifNull(sum(perf_low), 0) AS pl,
               ifNull(sum(perf_high), 0) AS ph,
               ifNull(sum(perf_gray), 0) AS pg,
               row_number() OVER (ORDER BY sum(employee_amt) DESC) AS rn
        FROM prod_proteus.hr_structure_overall
        WHERE lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall) AND month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)
        GROUP BY g, o
    )

    UNION ALL

    SELECT 4 AS n, '4 перформанс, прошлый месяц' AS section, toUInt32(100) AS ord, 'на какую численность считается perf (компания)' AS item,
           concat('perf всего / числ ', ifNull(if((emp) = 0, '—', toString(round((pn + pl + ph + pg) / (emp), 3))), '—'),
           ' · / (числ + увольн) ', ifNull(if((emp + fire) = 0, '—', toString(round((pn + pl + ph + pg) / (emp + fire), 3))), '—'),
           ' · / (числ + увольн + выход) ', ifNull(if((emp + fire + tout) = 0, '—', toString(round((pn + pl + ph + pg) / (emp + fire + tout), 3))), '—'),
           ' · / (лаг + найм) ', ifNull(if((lag + hire) = 0, '—', toString(round((pn + pl + ph + pg) / (lag + hire), 3))), '—'),
           ' · / ССЧ ', ifNull(if((ssch) = 0, '—', toString(round((pn + pl + ph + pg) / (ssch), 3))), '—'),
           ' · / лаг ', ifNull(if((lag) = 0, '—', toString(round((pn + pl + ph + pg) / (lag), 3))), '—')) AS value
    FROM
    (
        SELECT ifNull(sum(employee_amt), 0) AS emp,
               ifNull(sum(lag_employee_amt), 0) AS lag,
               ifNull(sum(ssch_employee_amt), 0) AS ssch,
               ifNull(sum(hire_amt), 0) AS hire,
               ifNull(sum(hire_to_active_amt), 0) AS hact,
               ifNull(sum(fire_amt), 0) AS fire,
               ifNull(sum(regret_fire_amt), 0) AS regret,
               ifNull(sum(transfer_in_amt), 0) AS tin,
               ifNull(sum(transfer_out_amt), 0) AS tout,
               ifNull(sum(transfer_internal_amt), 0) AS tint,
               ifNull(sum(transfer_candidate_amt), 0) AS tcand,
               ifNull(sum(perf_normal), 0) AS pn,
               ifNull(sum(perf_low), 0) AS pl,
               ifNull(sum(perf_high), 0) AS ph,
               ifNull(sum(perf_gray), 0) AS pg
        FROM prod_proteus.hr_structure_overall
        WHERE lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall) AND month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)
    )

    UNION ALL

    -- 5. Дерево. Дубли ключа и юниты с несколькими родителями (вся таблица)
    SELECT 5 AS n, '5 дерево' AS section, toUInt32(1) AS ord, 'дубли ключа' AS item,
           concat('строк ', toString(rows),
           ' · ключей месяц × юнит × 5 атрибутов ', toString(k1),
           ' · с родителем в ключе ', toString(k2),
           ' · юнит-месяцев с 2+ родителями ', toString(um_multi),
           ' · таких юнитов ', toString(u_multi),
           ' · месяцев ', toString(m_multi)) AS value
    FROM
    (
        SELECT count() AS rows,
               uniqExact((month, mngt_unit_rk, active_type_gr_nm, active_type_nm, emp_specialization_oper_code, emp_specialization_it_code, employment_relation_type_desc)) AS k1,
               uniqExact((month, mngt_unit_rk, parent_mngt_unit_rk, active_type_gr_nm, active_type_nm, emp_specialization_oper_code, emp_specialization_it_code, employment_relation_type_desc)) AS k2
        FROM prod_proteus.hr_structure_overall
    ) AS x
    CROSS JOIN
    (
        SELECT count() AS um_multi, uniqExact(rk) AS u_multi, uniqExact(m) AS m_multi
        FROM
        (
            SELECT month AS m, mngt_unit_rk AS rk
            FROM prod_proteus.hr_structure_overall
            GROUP BY m, rk
            HAVING uniqExact(ifNull(parent_mngt_unit_rk, '')) > 1
        )
    ) AS y

    UNION ALL

    -- 5б. Копии строк юнита с двумя родителями: одинаковы ли числа (тогда юнит
    --     считается один раз, а не дважды)
    SELECT 5 AS n, '5 дерево' AS section, toUInt32(2) AS ord, 'копии строк у юнитов с 2+ родителями' AS item,
           concat('групп ', toString(count()),
           ' · числ совпадает ', toString(countIf(e_lo = e_hi)),
           ' · различается ', toString(countIf(e_lo != e_hi)),
           ' · числ одной копии ', ifNull(toString(round((sum(e_hi)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL')) AS value
    FROM
    (
        SELECT month, mngt_unit_rk, count() AS c,
               min(ifNull(employee_amt, 0)) AS e_lo, max(ifNull(employee_amt, 0)) AS e_hi
        FROM prod_proteus.hr_structure_overall
        WHERE month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)
        GROUP BY month, mngt_unit_rk, active_type_gr_nm, active_type_nm, emp_specialization_oper_code, emp_specialization_it_code, employment_relation_type_desc
        HAVING c > 1
    )

    UNION ALL

    -- 5в. Прошлый месяц: где сидят люди — в листьях или прямо в узлах с подразделениями.
    --     свои люди узла = численность узла − сумма численности детей
    SELECT 5 AS n, '5 дерево' AS section, toUInt32(10 + lv) AS ord, concat('где сидят люди · уровень ', toString(lv)) AS item,
           concat('юнитов ', toString(count()),
           ' · листьев ', toString(countIf(hit = 0)),
           ' · с подразделениями ', toString(countIf(hit = 1)),
           ' · из них со своими людьми ', toString(countIf(hit = 1 AND own > 0.5)),
           ' · меньше суммы детей ', toString(countIf(hit = 1 AND own < -0.5)),
           ' · люди в листьях ', ifNull(toString(round((sumIf(u_emp, hit = 0)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · прямо в узлах ', ifNull(toString(round((sumIf(own, hit = 1 AND own > 0)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · численность уровня ', ifNull(toString(round((sum(u_emp)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL')) AS value
    FROM
    (
        SELECT u.lv AS lv, u.u_emp AS u_emp, ifNull(k.hit, 0) AS hit, u.u_emp - ifNull(k.c_emp, 0) AS own
        FROM (
            SELECT rk, any(lv) AS lv, sum(e) AS u_emp
            FROM
            (
                SELECT ifNull(mngt_unit_rk, '') AS rk, any(ifNull(lvl, 0)) AS lv, max(ifNull(employee_amt, 0)) AS e
                FROM prod_proteus.hr_structure_overall
                WHERE month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)
                GROUP BY rk, active_type_gr_nm, active_type_nm, emp_specialization_oper_code, emp_specialization_it_code, employment_relation_type_desc
            )
            GROUP BY rk
        ) AS u
        LEFT JOIN (
            SELECT ifNull(parent_mngt_unit_rk, '') AS prk, sum(ifNull(employee_amt, 0)) AS c_emp, toUInt8(1) AS hit
            FROM prod_proteus.hr_structure_overall
            WHERE month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1) AND parent_mngt_unit_rk IS NOT NULL
            GROUP BY prk
        ) AS k ON u.rk = k.prk
    )
    GROUP BY lv

    UNION ALL

    SELECT 5 AS n, '5 дерево' AS section, toUInt32(30) AS ord, 'где сидят люди · всего' AS item,
           concat('в листьях ', ifNull(toString(round((sumIf(u_emp, hit = 0)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · прямо в узлах ', ifNull(toString(round((sumIf(own, hit = 1 AND own > 0)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · сумма ', ifNull(toString(round((sumIf(u_emp, hit = 0) + sumIf(own, hit = 1 AND own > 0)) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL'),
           ' · численность компании ', ifNull(toString(round((sumIf(u_emp, lv = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall))) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL')) AS value
    FROM
    (
        SELECT u.lv AS lv, u.u_emp AS u_emp, ifNull(k.hit, 0) AS hit, u.u_emp - ifNull(k.c_emp, 0) AS own
        FROM (
            SELECT rk, any(lv) AS lv, sum(e) AS u_emp
            FROM
            (
                SELECT ifNull(mngt_unit_rk, '') AS rk, any(ifNull(lvl, 0)) AS lv, max(ifNull(employee_amt, 0)) AS e
                FROM prod_proteus.hr_structure_overall
                WHERE month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)
                GROUP BY rk, active_type_gr_nm, active_type_nm, emp_specialization_oper_code, emp_specialization_it_code, employment_relation_type_desc
            )
            GROUP BY rk
        ) AS u
        LEFT JOIN (
            SELECT ifNull(parent_mngt_unit_rk, '') AS prk, sum(ifNull(employee_amt, 0)) AS c_emp, toUInt8(1) AS hit
            FROM prod_proteus.hr_structure_overall
            WHERE month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1) AND parent_mngt_unit_rk IS NOT NULL
            GROUP BY prk
        ) AS k ON u.rk = k.prk
    )

    UNION ALL

    -- 5г. Верхние уровни во всех месяцах: один ли юнит и одинакова ли численность
    SELECT 5 AS n, '5 дерево' AS section, toUInt32(31) AS ord, 'верхний и второй уровень по месяцам' AS item,
           concat('месяцев ', toString(count()),
           ' · на верхнем уровне не один юнит ', toString(countIf(u1 != 1)),
           ' · на втором не один ', toString(countIf(u2 != 1)),
           ' · численность второго ≠ верхнего ', toString(countIf(abs(e1 - e2) > 0.5))) AS value
    FROM
    (
        SELECT month, uniqExactIf(mngt_unit_rk, lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)) AS u1, uniqExactIf(mngt_unit_rk, lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall) + 1) AS u2,
               ifNull(sumIf(employee_amt, lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0) AS e1, ifNull(sumIf(employee_amt, lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall) + 1), 0) AS e2
        FROM prod_proteus.hr_structure_overall
        GROUP BY month
    )

    UNION ALL

    -- 5д. Прошлый месяц: у родителя есть строка на каждое сочетание атрибутов ребёнка?
    --     (атрибуты — свойства человека, поэтому у родителя их должно быть не меньше)
    SELECT 5 AS n, '5 дерево' AS section, toUInt32(32) AS ord, 'сочетания атрибутов детей у родителя' AS item,
           concat('ключей у детей ', toString(count()),
           ' · нет у родителя ', toString(countIf(ifNull(p.hit, 0) = 0)),
           ' · у родителя меньше ', toString(countIf(ifNull(p.hit, 0) = 1 AND ifNull(p.pe, 0) + 0.5 < c.ce))) AS value
    FROM
    (
        SELECT ifNull(parent_mngt_unit_rk, '') AS rk, ifNull(active_type_gr_nm, '') AS a1, ifNull(active_type_nm, '') AS a2, ifNull(emp_specialization_oper_code, '') AS a3, ifNull(emp_specialization_it_code, '') AS a4, ifNull(employment_relation_type_desc, '') AS a5, sum(ifNull(employee_amt, 0)) AS ce
        FROM prod_proteus.hr_structure_overall
        WHERE month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1) AND parent_mngt_unit_rk IS NOT NULL
        GROUP BY rk, a1, a2, a3, a4, a5
    ) AS c
    LEFT JOIN
    (
        SELECT ifNull(mngt_unit_rk, '') AS rk, ifNull(active_type_gr_nm, '') AS a1, ifNull(active_type_nm, '') AS a2, ifNull(emp_specialization_oper_code, '') AS a3, ifNull(emp_specialization_it_code, '') AS a4, ifNull(employment_relation_type_desc, '') AS a5, sum(ifNull(employee_amt, 0)) AS pe, toUInt8(1) AS hit
        FROM prod_proteus.hr_structure_overall
        WHERE month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)
        GROUP BY rk, a1, a2, a3, a4, a5
    ) AS p USING (rk, a1, a2, a3, a4, a5)

    UNION ALL

    -- 6. Юниты по месяцам: появились, исчезли, сменили родителя или уровень (реорганизации).
    --    В первом месяце сравнивать не с чем
    SELECT 6 AS n, '6 юниты по месяцам' AS section, toUInt32(toYYYYMM(a.cm)) AS ord, toString(a.cm) AS item,
           concat('юнитов ', toString(a.units),
           ' · новых ', if(a.cm = (SELECT min(month) FROM prod_proteus.hr_structure_overall), '—', toString(a.new_u)),
           ' · исчезло ', toString(ifNull(g.gone_u, 0)),
           ' · сменили родителя ', toString(a.moved_u),
           ' · сменили уровень ', toString(a.relvl_u)) AS value
    FROM
    (
        SELECT c.m AS cm, count() AS units, countIf(ifNull(p.hit, 0) = 0) AS new_u,
               countIf(ifNull(p.hit, 0) = 1 AND ifNull(p.prk, '') != c.prk) AS moved_u,
               countIf(ifNull(p.hit, 0) = 1 AND ifNull(p.lv, 0) != c.lv) AS relvl_u
        FROM (
            SELECT ifNull(month, toDate(0)) AS m, ifNull(mngt_unit_rk, '') AS rk, any(ifNull(parent_mngt_unit_rk, '')) AS prk, any(ifNull(lvl, 0)) AS lv
            FROM prod_proteus.hr_structure_overall
            GROUP BY m, rk
        ) AS c
        LEFT JOIN (
            SELECT addMonths(ifNull(month, toDate(0)), 1) AS m, ifNull(mngt_unit_rk, '') AS rk, any(ifNull(parent_mngt_unit_rk, '')) AS prk, any(ifNull(lvl, 0)) AS lv, toUInt8(1) AS hit
            FROM prod_proteus.hr_structure_overall
            GROUP BY m, rk
        ) AS p
        ON c.m = p.m AND c.rk = p.rk
        GROUP BY cm
    ) AS a
    LEFT JOIN
    (
        SELECT p.m AS gm, countIf(ifNull(c.hit, 0) = 0) AS gone_u
        FROM (
            SELECT addMonths(ifNull(month, toDate(0)), 1) AS m, ifNull(mngt_unit_rk, '') AS rk
            FROM prod_proteus.hr_structure_overall
            GROUP BY m, rk
        ) AS p
        LEFT JOIN (
            SELECT ifNull(month, toDate(0)) AS m, ifNull(mngt_unit_rk, '') AS rk, toUInt8(1) AS hit
            FROM prod_proteus.hr_structure_overall
            GROUP BY m, rk
        ) AS c
        ON p.m = c.m AND p.rk = c.rk
        WHERE p.m <= (SELECT max(month) FROM prod_proteus.hr_structure_overall)
        GROUP BY gm
    ) AS g ON a.cm = g.gm

    UNION ALL

    -- 6б. Юниты прошлого месяца, которые были год назад: можно ли сравнивать год к году
    SELECT 6 AS n, '6 юниты год назад' AS section, toUInt32(100 + lv) AS ord, concat('уровень ', toString(lv)) AS item,
           concat('юнитов ', toString(count()),
           ' · были год назад ', toString(countIf(ifNull(o.hit, 0) = 1)),
           ' · из них с тем же родителем ', toString(countIf(ifNull(o.hit, 0) = 1 AND ifNull(o.prk, '') = cur.prk)),
           ' · доля численности уровня в юнитах, что были % ', ifNull(if((sum(u_emp)) = 0, '—', toString(round((sumIf(u_emp, ifNull(o.hit, 0) = 1)) / (sum(u_emp)) * 100, 1))), '—')) AS value
    FROM
    (
        SELECT ifNull(mngt_unit_rk, '') AS rk, any(ifNull(lvl, 0)) AS lv, any(ifNull(parent_mngt_unit_rk, '')) AS prk,
               sum(ifNull(employee_amt, 0)) AS u_emp
        FROM prod_proteus.hr_structure_overall
        WHERE month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)
        GROUP BY rk
    ) AS cur
    LEFT JOIN
    (
        SELECT ifNull(mngt_unit_rk, '') AS rk, any(ifNull(parent_mngt_unit_rk, '')) AS prk, toUInt8(1) AS hit
        FROM prod_proteus.hr_structure_overall
        WHERE month = addMonths(addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1), -12)
        GROUP BY rk
    ) AS o USING (rk)
    GROUP BY lv

    UNION ALL

    -- 7. Значения атрибутов во времени (по компании): когда появились и пропали
    SELECT 7 AS n, concat('7 значения во времени · ', kv.1) AS section, toUInt32(rn) AS ord, kv.2 AS item,
           concat('с ', ifNull(toString(m1), 'NULL'),
           ' · по ', ifNull(toString(m2), 'NULL'),
           ' · месяцев ', toString(nm),
           ' · числ прошлый месяц ', ifNull(toString(round((e_full) / greatest(ifNull((SELECT sum(employee_amt) FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0), 1) * 1000, 2)), 'NULL')) AS value
    FROM
    (
        SELECT kv, min(month) AS m1, max(month) AS m2, uniqExact(month) AS nm,
               ifNull(sumIf(employee_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS e_full,
               row_number() OVER (PARTITION BY kv.1 ORDER BY min(month), count() DESC) AS rn
        FROM prod_proteus.hr_structure_overall
        ARRAY JOIN [
            ('active_type_gr_nm', ifNull(active_type_gr_nm, 'NULL')),
            ('active_type_nm', ifNull(active_type_nm, 'NULL')),
            ('emp_specialization_oper_code', ifNull(emp_specialization_oper_code, 'NULL')),
            ('emp_specialization_it_code', ifNull(emp_specialization_it_code, 'NULL')),
            ('employment_relation_type_desc', ifNull(employment_relation_type_desc, 'NULL'))
        ] AS kv
        WHERE lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)
        GROUP BY kv
    )

    UNION ALL

    -- 8. Свежесть: какой сегодня день на сервере и какая часть месяца уже в таблице
    SELECT 8 AS n, '8 свежесть' AS section, toUInt32(1) AS ord, 'сегодня и последний месяц' AS item,
           concat('сегодня ', toString(today()),
           ' · последний месяц ', ifNull(toString((SELECT max(month) FROM prod_proteus.hr_structure_overall)), 'NULL'),
           ' · день месяца ', ifNull(toString(dateDiff('day', (SELECT max(month) FROM prod_proteus.hr_structure_overall), today()) + 1), 'NULL'),
           ' · найм к прошлому месяцу % ', ifNull(if((h_full) = 0, '—', toString(round((h_last) / (h_full) * 100, 1))), '—'),
           ' · увольн % ', ifNull(if((f_full) = 0, '—', toString(round((f_last) / (f_full) * 100, 1))), '—'),
           ' · перев вход % ', ifNull(if((i_full) = 0, '—', toString(round((i_last) / (i_full) * 100, 1))), '—'),
           ' · численность к прошлому месяцу % ', ifNull(if((e_full) = 0, '—', toString(round((e_last) / (e_full) * 100, 1))), '—')) AS value
    FROM
    (
        SELECT ifNull(sumIf(hire_amt, month = (SELECT max(month) FROM prod_proteus.hr_structure_overall)), 0) AS h_last, ifNull(sumIf(hire_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS h_full,
               ifNull(sumIf(fire_amt, month = (SELECT max(month) FROM prod_proteus.hr_structure_overall)), 0) AS f_last, ifNull(sumIf(fire_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS f_full,
               ifNull(sumIf(transfer_in_amt, month = (SELECT max(month) FROM prod_proteus.hr_structure_overall)), 0) AS i_last, ifNull(sumIf(transfer_in_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS i_full,
               ifNull(sumIf(employee_amt, month = (SELECT max(month) FROM prod_proteus.hr_structure_overall)), 0) AS e_last, ifNull(sumIf(employee_amt, month = addMonths((SELECT max(month) FROM prod_proteus.hr_structure_overall), -1)), 0) AS e_full
        FROM prod_proteus.hr_structure_overall
        WHERE lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)
    )
)
ORDER BY n, section, ord, item;

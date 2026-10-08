SELECT section, item, value
-- ============================================================================
-- 0б. Разведка prod_proteus.hr_structure_overall — ОДИН запрос на все проверки.
-- SQL Lab: вставить целиком, выполнить (Ctrl+Enter), ответ — «Скопировать
-- в буфер» или CSV — прислать. Строк в ответе — от сотни до четырёхсот,
-- меньше лимита SQL Lab в 1000.
-- Разделы: 1 таблица целиком · 2 каждая колонка · 3 по месяцам ·
-- 4 дерево юнитов (последний месяц) · 5 значения справочников (последний
-- месяц) · 6 сверки показателей. Людей в таблице нет — только юниты и суммы.
-- Проверено на ClickHouse 24.8.
-- ============================================================================
FROM
(
    -- 1. Таблица целиком: строки, период, юниты, уровни, зерно
    SELECT 1 AS n, '1 таблица' AS section, kv.1 AS ord, kv.2 AS item, kv.3 AS value
    FROM
    (
        SELECT count() AS rows, uniqExact(month) AS months, min(month) AS m1, max(month) AS m2,
               uniqExact(mngt_unit_rk) AS units, min(lvl) AS l1, max(lvl) AS l2,
               uniqExact((month, mngt_unit_rk)) AS unit_months,
               uniqExact((month, mngt_unit_rk, active_type_gr_nm, active_type_nm, emp_specialization_oper_code, emp_specialization_it_code, employment_relation_type_desc)) AS grain_keys
        FROM prod_proteus.hr_structure_overall
    )
    ARRAY JOIN [
        (1, 'строк', toString(rows)),
        (2, 'месяцев', concat(toString(months), ': ', ifNull(toString(m1), 'NULL'), ' — ', ifNull(toString(m2), 'NULL'))),
        (3, 'юнитов mngt_unit_rk', toString(units)),
        (4, 'уровни lvl', concat(ifNull(toString(l1), 'NULL'), ' — ', ifNull(toString(l2), 'NULL'))),
        (5, 'строк на юнит в месяц', toString(round(rows / greatest(unit_months, 1), 2))),
        (6, 'зерно: месяц × юнит × 5 атрибутов',
            concat(toString(grain_keys), ' ключей на ', toString(rows), ' строк',
                   if(grain_keys = rows, ' — строка уникальна', ' — есть повторы ключа')))
    ] AS kv

    UNION ALL

    -- 2. Каждая колонка: разных, NULL, пустых, мин, макс, сумма, отрицательных, дробных
    SELECT 2, '2 колонки', kv.1, kv.2, kv.3
    FROM
    (
        SELECT
            uniqExact(month) AS c1_u, countIf(isNull(month)) AS c1_n,
            min(month) AS c1_lo, max(month) AS c1_hi,
            uniqExact(mngt_unit_rk) AS c2_u, countIf(isNull(mngt_unit_rk)) AS c2_n,
            countIf(mngt_unit_rk = '') AS c2_e, min(mngt_unit_rk) AS c2_lo, max(mngt_unit_rk) AS c2_hi,
            uniqExact(mngt_unit_nm) AS c3_u, countIf(isNull(mngt_unit_nm)) AS c3_n,
            countIf(mngt_unit_nm = '') AS c3_e, min(mngt_unit_nm) AS c3_lo, max(mngt_unit_nm) AS c3_hi,
            uniqExact(lvl) AS c4_u, countIf(isNull(lvl)) AS c4_n,
            min(lvl) AS c4_lo, max(lvl) AS c4_hi, sum(lvl) AS c4_s, countIf(lvl < 0) AS c4_neg, countIf(lvl != floor(lvl)) AS c4_fr,
            uniqExact(parent_mngt_unit_rk) AS c5_u, countIf(isNull(parent_mngt_unit_rk)) AS c5_n,
            countIf(parent_mngt_unit_rk = '') AS c5_e, min(parent_mngt_unit_rk) AS c5_lo, max(parent_mngt_unit_rk) AS c5_hi,
            uniqExact(parent_mngt_unit_nm) AS c6_u, countIf(isNull(parent_mngt_unit_nm)) AS c6_n,
            countIf(parent_mngt_unit_nm = '') AS c6_e, min(parent_mngt_unit_nm) AS c6_lo, max(parent_mngt_unit_nm) AS c6_hi,
            uniqExact(parent_lvl) AS c7_u, countIf(isNull(parent_lvl)) AS c7_n,
            min(parent_lvl) AS c7_lo, max(parent_lvl) AS c7_hi, sum(parent_lvl) AS c7_s, countIf(parent_lvl < 0) AS c7_neg, countIf(parent_lvl != floor(parent_lvl)) AS c7_fr,
            uniqExact(active_type_gr_nm) AS c8_u, countIf(isNull(active_type_gr_nm)) AS c8_n,
            countIf(active_type_gr_nm = '') AS c8_e, min(active_type_gr_nm) AS c8_lo, max(active_type_gr_nm) AS c8_hi,
            uniqExact(active_type_nm) AS c9_u, countIf(isNull(active_type_nm)) AS c9_n,
            countIf(active_type_nm = '') AS c9_e, min(active_type_nm) AS c9_lo, max(active_type_nm) AS c9_hi,
            uniqExact(emp_specialization_oper_code) AS c10_u, countIf(isNull(emp_specialization_oper_code)) AS c10_n,
            countIf(emp_specialization_oper_code = '') AS c10_e, min(emp_specialization_oper_code) AS c10_lo, max(emp_specialization_oper_code) AS c10_hi,
            uniqExact(emp_specialization_it_code) AS c11_u, countIf(isNull(emp_specialization_it_code)) AS c11_n,
            countIf(emp_specialization_it_code = '') AS c11_e, min(emp_specialization_it_code) AS c11_lo, max(emp_specialization_it_code) AS c11_hi,
            uniqExact(employment_relation_type_desc) AS c12_u, countIf(isNull(employment_relation_type_desc)) AS c12_n,
            countIf(employment_relation_type_desc = '') AS c12_e, min(employment_relation_type_desc) AS c12_lo, max(employment_relation_type_desc) AS c12_hi,
            uniqExact(employee_amt) AS c13_u, countIf(isNull(employee_amt)) AS c13_n,
            min(employee_amt) AS c13_lo, max(employee_amt) AS c13_hi, sum(employee_amt) AS c13_s, countIf(employee_amt < 0) AS c13_neg, countIf(employee_amt != floor(employee_amt)) AS c13_fr,
            uniqExact(transfer_candidate_amt) AS c14_u, countIf(isNull(transfer_candidate_amt)) AS c14_n,
            min(transfer_candidate_amt) AS c14_lo, max(transfer_candidate_amt) AS c14_hi, sum(transfer_candidate_amt) AS c14_s, countIf(transfer_candidate_amt < 0) AS c14_neg, countIf(transfer_candidate_amt != floor(transfer_candidate_amt)) AS c14_fr,
            uniqExact(transfer_internal_amt) AS c15_u, countIf(isNull(transfer_internal_amt)) AS c15_n,
            min(transfer_internal_amt) AS c15_lo, max(transfer_internal_amt) AS c15_hi, sum(transfer_internal_amt) AS c15_s, countIf(transfer_internal_amt < 0) AS c15_neg, countIf(transfer_internal_amt != floor(transfer_internal_amt)) AS c15_fr,
            uniqExact(hire_amt) AS c16_u, countIf(isNull(hire_amt)) AS c16_n,
            min(hire_amt) AS c16_lo, max(hire_amt) AS c16_hi, sum(hire_amt) AS c16_s, countIf(hire_amt < 0) AS c16_neg, countIf(hire_amt != floor(hire_amt)) AS c16_fr,
            uniqExact(hire_to_active_amt) AS c17_u, countIf(isNull(hire_to_active_amt)) AS c17_n,
            min(hire_to_active_amt) AS c17_lo, max(hire_to_active_amt) AS c17_hi, sum(hire_to_active_amt) AS c17_s, countIf(hire_to_active_amt < 0) AS c17_neg, countIf(hire_to_active_amt != floor(hire_to_active_amt)) AS c17_fr,
            uniqExact(fire_amt) AS c18_u, countIf(isNull(fire_amt)) AS c18_n,
            min(fire_amt) AS c18_lo, max(fire_amt) AS c18_hi, sum(fire_amt) AS c18_s, countIf(fire_amt < 0) AS c18_neg, countIf(fire_amt != floor(fire_amt)) AS c18_fr,
            uniqExact(regret_fire_amt) AS c19_u, countIf(isNull(regret_fire_amt)) AS c19_n,
            min(regret_fire_amt) AS c19_lo, max(regret_fire_amt) AS c19_hi, sum(regret_fire_amt) AS c19_s, countIf(regret_fire_amt < 0) AS c19_neg, countIf(regret_fire_amt != floor(regret_fire_amt)) AS c19_fr,
            uniqExact(transfer_in_amt) AS c20_u, countIf(isNull(transfer_in_amt)) AS c20_n,
            min(transfer_in_amt) AS c20_lo, max(transfer_in_amt) AS c20_hi, sum(transfer_in_amt) AS c20_s, countIf(transfer_in_amt < 0) AS c20_neg, countIf(transfer_in_amt != floor(transfer_in_amt)) AS c20_fr,
            uniqExact(transfer_out_amt) AS c21_u, countIf(isNull(transfer_out_amt)) AS c21_n,
            min(transfer_out_amt) AS c21_lo, max(transfer_out_amt) AS c21_hi, sum(transfer_out_amt) AS c21_s, countIf(transfer_out_amt < 0) AS c21_neg, countIf(transfer_out_amt != floor(transfer_out_amt)) AS c21_fr,
            uniqExact(perf_normal) AS c22_u, countIf(isNull(perf_normal)) AS c22_n,
            min(perf_normal) AS c22_lo, max(perf_normal) AS c22_hi, sum(perf_normal) AS c22_s, countIf(perf_normal < 0) AS c22_neg, countIf(perf_normal != floor(perf_normal)) AS c22_fr,
            uniqExact(perf_low) AS c23_u, countIf(isNull(perf_low)) AS c23_n,
            min(perf_low) AS c23_lo, max(perf_low) AS c23_hi, sum(perf_low) AS c23_s, countIf(perf_low < 0) AS c23_neg, countIf(perf_low != floor(perf_low)) AS c23_fr,
            uniqExact(perf_high) AS c24_u, countIf(isNull(perf_high)) AS c24_n,
            min(perf_high) AS c24_lo, max(perf_high) AS c24_hi, sum(perf_high) AS c24_s, countIf(perf_high < 0) AS c24_neg, countIf(perf_high != floor(perf_high)) AS c24_fr,
            uniqExact(perf_gray) AS c25_u, countIf(isNull(perf_gray)) AS c25_n,
            min(perf_gray) AS c25_lo, max(perf_gray) AS c25_hi, sum(perf_gray) AS c25_s, countIf(perf_gray < 0) AS c25_neg, countIf(perf_gray != floor(perf_gray)) AS c25_fr,
            uniqExact(lag_employee_amt) AS c26_u, countIf(isNull(lag_employee_amt)) AS c26_n,
            min(lag_employee_amt) AS c26_lo, max(lag_employee_amt) AS c26_hi, sum(lag_employee_amt) AS c26_s, countIf(lag_employee_amt < 0) AS c26_neg, countIf(lag_employee_amt != floor(lag_employee_amt)) AS c26_fr,
            uniqExact(ssch_employee_amt) AS c27_u, countIf(isNull(ssch_employee_amt)) AS c27_n,
            min(ssch_employee_amt) AS c27_lo, max(ssch_employee_amt) AS c27_hi, sum(ssch_employee_amt) AS c27_s, countIf(ssch_employee_amt < 0) AS c27_neg, countIf(ssch_employee_amt != floor(ssch_employee_amt)) AS c27_fr
        FROM prod_proteus.hr_structure_overall
    )
    ARRAY JOIN [
        (1, 'month · Nullable(Date)', concat('разных ', toString(c1_u), ' · NULL ', toString(c1_n), ' · мин ', ifNull(toString(c1_lo), 'NULL'), ' · макс ', ifNull(toString(c1_hi), 'NULL'))),
        (2, 'mngt_unit_rk · Nullable(String)', concat('разных ', toString(c2_u), ' · NULL ', toString(c2_n), ' · пустых ', toString(c2_e), ' · мин «', ifNull(c2_lo, ''), '» · макс «', ifNull(c2_hi, ''), '»')),
        (3, 'mngt_unit_nm · Nullable(String)', concat('разных ', toString(c3_u), ' · NULL ', toString(c3_n), ' · пустых ', toString(c3_e), ' · мин «', ifNull(c3_lo, ''), '» · макс «', ifNull(c3_hi, ''), '»')),
        (4, 'lvl · Nullable(Int32)', concat('разных ', toString(c4_u), ' · NULL ', toString(c4_n), ' · мин ', ifNull(toString(c4_lo), 'NULL'), ' · макс ', ifNull(toString(c4_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c4_s, 2)), 'NULL'), ' · отриц ', toString(c4_neg), ' · дробных ', toString(c4_fr))),
        (5, 'parent_mngt_unit_rk · Nullable(String)', concat('разных ', toString(c5_u), ' · NULL ', toString(c5_n), ' · пустых ', toString(c5_e), ' · мин «', ifNull(c5_lo, ''), '» · макс «', ifNull(c5_hi, ''), '»')),
        (6, 'parent_mngt_unit_nm · Nullable(String)', concat('разных ', toString(c6_u), ' · NULL ', toString(c6_n), ' · пустых ', toString(c6_e), ' · мин «', ifNull(c6_lo, ''), '» · макс «', ifNull(c6_hi, ''), '»')),
        (7, 'parent_lvl · Nullable(Float64)', concat('разных ', toString(c7_u), ' · NULL ', toString(c7_n), ' · мин ', ifNull(toString(c7_lo), 'NULL'), ' · макс ', ifNull(toString(c7_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c7_s, 2)), 'NULL'), ' · отриц ', toString(c7_neg), ' · дробных ', toString(c7_fr))),
        (8, 'active_type_gr_nm · Nullable(String)', concat('разных ', toString(c8_u), ' · NULL ', toString(c8_n), ' · пустых ', toString(c8_e), ' · мин «', ifNull(c8_lo, ''), '» · макс «', ifNull(c8_hi, ''), '»')),
        (9, 'active_type_nm · Nullable(String)', concat('разных ', toString(c9_u), ' · NULL ', toString(c9_n), ' · пустых ', toString(c9_e), ' · мин «', ifNull(c9_lo, ''), '» · макс «', ifNull(c9_hi, ''), '»')),
        (10, 'emp_specialization_oper_code · Nullable(String)', concat('разных ', toString(c10_u), ' · NULL ', toString(c10_n), ' · пустых ', toString(c10_e), ' · мин «', ifNull(c10_lo, ''), '» · макс «', ifNull(c10_hi, ''), '»')),
        (11, 'emp_specialization_it_code · Nullable(String)', concat('разных ', toString(c11_u), ' · NULL ', toString(c11_n), ' · пустых ', toString(c11_e), ' · мин «', ifNull(c11_lo, ''), '» · макс «', ifNull(c11_hi, ''), '»')),
        (12, 'employment_relation_type_desc · Nullable(String)', concat('разных ', toString(c12_u), ' · NULL ', toString(c12_n), ' · пустых ', toString(c12_e), ' · мин «', ifNull(c12_lo, ''), '» · макс «', ifNull(c12_hi, ''), '»')),
        (13, 'employee_amt · Nullable(Float64)', concat('разных ', toString(c13_u), ' · NULL ', toString(c13_n), ' · мин ', ifNull(toString(c13_lo), 'NULL'), ' · макс ', ifNull(toString(c13_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c13_s, 2)), 'NULL'), ' · отриц ', toString(c13_neg), ' · дробных ', toString(c13_fr))),
        (14, 'transfer_candidate_amt · Nullable(Float64)', concat('разных ', toString(c14_u), ' · NULL ', toString(c14_n), ' · мин ', ifNull(toString(c14_lo), 'NULL'), ' · макс ', ifNull(toString(c14_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c14_s, 2)), 'NULL'), ' · отриц ', toString(c14_neg), ' · дробных ', toString(c14_fr))),
        (15, 'transfer_internal_amt · Nullable(Float64)', concat('разных ', toString(c15_u), ' · NULL ', toString(c15_n), ' · мин ', ifNull(toString(c15_lo), 'NULL'), ' · макс ', ifNull(toString(c15_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c15_s, 2)), 'NULL'), ' · отриц ', toString(c15_neg), ' · дробных ', toString(c15_fr))),
        (16, 'hire_amt · Nullable(Float64)', concat('разных ', toString(c16_u), ' · NULL ', toString(c16_n), ' · мин ', ifNull(toString(c16_lo), 'NULL'), ' · макс ', ifNull(toString(c16_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c16_s, 2)), 'NULL'), ' · отриц ', toString(c16_neg), ' · дробных ', toString(c16_fr))),
        (17, 'hire_to_active_amt · Nullable(Float64)', concat('разных ', toString(c17_u), ' · NULL ', toString(c17_n), ' · мин ', ifNull(toString(c17_lo), 'NULL'), ' · макс ', ifNull(toString(c17_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c17_s, 2)), 'NULL'), ' · отриц ', toString(c17_neg), ' · дробных ', toString(c17_fr))),
        (18, 'fire_amt · Nullable(Float64)', concat('разных ', toString(c18_u), ' · NULL ', toString(c18_n), ' · мин ', ifNull(toString(c18_lo), 'NULL'), ' · макс ', ifNull(toString(c18_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c18_s, 2)), 'NULL'), ' · отриц ', toString(c18_neg), ' · дробных ', toString(c18_fr))),
        (19, 'regret_fire_amt · Nullable(Float64)', concat('разных ', toString(c19_u), ' · NULL ', toString(c19_n), ' · мин ', ifNull(toString(c19_lo), 'NULL'), ' · макс ', ifNull(toString(c19_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c19_s, 2)), 'NULL'), ' · отриц ', toString(c19_neg), ' · дробных ', toString(c19_fr))),
        (20, 'transfer_in_amt · Nullable(Float64)', concat('разных ', toString(c20_u), ' · NULL ', toString(c20_n), ' · мин ', ifNull(toString(c20_lo), 'NULL'), ' · макс ', ifNull(toString(c20_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c20_s, 2)), 'NULL'), ' · отриц ', toString(c20_neg), ' · дробных ', toString(c20_fr))),
        (21, 'transfer_out_amt · Nullable(Float64)', concat('разных ', toString(c21_u), ' · NULL ', toString(c21_n), ' · мин ', ifNull(toString(c21_lo), 'NULL'), ' · макс ', ifNull(toString(c21_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c21_s, 2)), 'NULL'), ' · отриц ', toString(c21_neg), ' · дробных ', toString(c21_fr))),
        (22, 'perf_normal · Nullable(Float64)', concat('разных ', toString(c22_u), ' · NULL ', toString(c22_n), ' · мин ', ifNull(toString(c22_lo), 'NULL'), ' · макс ', ifNull(toString(c22_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c22_s, 2)), 'NULL'), ' · отриц ', toString(c22_neg), ' · дробных ', toString(c22_fr))),
        (23, 'perf_low · Nullable(Float64)', concat('разных ', toString(c23_u), ' · NULL ', toString(c23_n), ' · мин ', ifNull(toString(c23_lo), 'NULL'), ' · макс ', ifNull(toString(c23_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c23_s, 2)), 'NULL'), ' · отриц ', toString(c23_neg), ' · дробных ', toString(c23_fr))),
        (24, 'perf_high · Nullable(Float64)', concat('разных ', toString(c24_u), ' · NULL ', toString(c24_n), ' · мин ', ifNull(toString(c24_lo), 'NULL'), ' · макс ', ifNull(toString(c24_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c24_s, 2)), 'NULL'), ' · отриц ', toString(c24_neg), ' · дробных ', toString(c24_fr))),
        (25, 'perf_gray · Nullable(Float64)', concat('разных ', toString(c25_u), ' · NULL ', toString(c25_n), ' · мин ', ifNull(toString(c25_lo), 'NULL'), ' · макс ', ifNull(toString(c25_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c25_s, 2)), 'NULL'), ' · отриц ', toString(c25_neg), ' · дробных ', toString(c25_fr))),
        (26, 'lag_employee_amt · Nullable(Float64)', concat('разных ', toString(c26_u), ' · NULL ', toString(c26_n), ' · мин ', ifNull(toString(c26_lo), 'NULL'), ' · макс ', ifNull(toString(c26_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c26_s, 2)), 'NULL'), ' · отриц ', toString(c26_neg), ' · дробных ', toString(c26_fr))),
        (27, 'ssch_employee_amt · Nullable(Float64)', concat('разных ', toString(c27_u), ' · NULL ', toString(c27_n), ' · мин ', ifNull(toString(c27_lo), 'NULL'), ' · макс ', ifNull(toString(c27_hi), 'NULL'), ' · сумма ', ifNull(toString(round(c27_s, 2)), 'NULL'), ' · отриц ', toString(c27_neg), ' · дробных ', toString(c27_fr)))
    ] AS kv

    UNION ALL

    -- 3. По месяцам: суммы всех строк. «числ прошл» — численность прошлого месяца,
    --    её сверяем с лагом; «верх» — численность только верхнего уровня
    SELECT 3, '3 месяцы', toUInt32(toYYYYMM(month)), toString(month),
           concat('строк ', toString(rows), ' · юнитов ', toString(units),
                  ' · числ ', toString(round(emp, 1)), ' · верх ', toString(round(emp_top, 1)),
                  ' · лаг ', toString(round(lag, 1)), ' · числ прошл ', if(prev_emp < 0, '—', toString(round(prev_emp, 1))),
                  ' · ССЧ ', toString(round(ssch, 1)),
                  ' · найм ', toString(round(hire, 1)), ' · найм→акт ', toString(round(hire_act, 1)),
                  ' · увольн ', toString(round(fire, 1)), ' · regret ', toString(round(regret, 1)),
                  ' · перев вход ', toString(round(t_in, 1)), ' · выход ', toString(round(t_out, 1)),
                  ' · внутр ', toString(round(t_int, 1)), ' · кандидаты ', toString(round(t_cand, 1)),
                  ' · perf норм ', toString(round(p_n, 1)), ' низк ', toString(round(p_l, 1)),
                  ' выс ', toString(round(p_h, 1)), ' сер ', toString(round(p_g, 1)))
    FROM
    (
        SELECT *, lagInFrame(emp, 1, toFloat64(-1)) OVER (ORDER BY month ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS prev_emp
        FROM
        (
            SELECT month, count() AS rows, uniqExact(mngt_unit_rk) AS units,
                   ifNull(sum(employee_amt), 0) AS emp,
                   ifNull(sumIf(employee_amt, lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)), 0) AS emp_top,
                   ifNull(sum(lag_employee_amt), 0) AS lag, ifNull(sum(ssch_employee_amt), 0) AS ssch,
                   ifNull(sum(hire_amt), 0) AS hire, ifNull(sum(hire_to_active_amt), 0) AS hire_act,
                   ifNull(sum(fire_amt), 0) AS fire, ifNull(sum(regret_fire_amt), 0) AS regret,
                   ifNull(sum(transfer_in_amt), 0) AS t_in, ifNull(sum(transfer_out_amt), 0) AS t_out,
                   ifNull(sum(transfer_internal_amt), 0) AS t_int, ifNull(sum(transfer_candidate_amt), 0) AS t_cand,
                   ifNull(sum(perf_normal), 0) AS p_n, ifNull(sum(perf_low), 0) AS p_l,
                   ifNull(sum(perf_high), 0) AS p_h, ifNull(sum(perf_gray), 0) AS p_g
            FROM prod_proteus.hr_structure_overall
            WHERE month IS NOT NULL
            GROUP BY month
        )
    )

    UNION ALL

    -- 4а. Дерево на последний месяц: юниты и численность по уровням.
    --     Одинаковая численность на всех уровнях — значения накопительные
    --     (юнит включает подразделения); растёт вглубь — у юнита только свои люди
    SELECT 4, '4 дерево', toUInt32(ifNull(lvl, 0)), concat('уровень ', ifNull(toString(lvl), 'NULL')),
           concat('юнитов ', toString(uniqExact(mngt_unit_rk)), ' · строк ', toString(count()),
                  ' · числ ', toString(round(ifNull(sum(employee_amt), 0), 1)))
    FROM prod_proteus.hr_structure_overall
    WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall)
    GROUP BY lvl

    UNION ALL

    -- 4б. Связность дерева на последний месяц
    SELECT 4, '4 дерево', 100 + kv.1, kv.2, kv.3
    FROM
    (
        SELECT
            uniqExactIf(mngt_unit_rk, parent_mngt_unit_rk IS NULL) AS roots,
            countIf(parent_lvl IS NOT NULL AND lvl IS NOT NULL AND parent_lvl != lvl - 1) AS lvl_gap,
            (SELECT count() FROM (SELECT mngt_unit_rk FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall)
                                  GROUP BY mngt_unit_rk HAVING uniqExact(mngt_unit_nm) > 1)) AS multi_name,
            (SELECT count() FROM (SELECT mngt_unit_rk FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall)
                                  GROUP BY mngt_unit_rk HAVING uniqExact(ifNull(parent_mngt_unit_rk, '')) > 1)) AS multi_parent,
            (SELECT count() FROM (SELECT DISTINCT parent_mngt_unit_rk AS rk FROM prod_proteus.hr_structure_overall
                                  WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND parent_mngt_unit_rk IS NOT NULL)
             WHERE rk NOT IN (SELECT mngt_unit_rk FROM prod_proteus.hr_structure_overall WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND mngt_unit_rk IS NOT NULL)) AS orphans
        FROM prod_proteus.hr_structure_overall
        WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall)
    )
    ARRAY JOIN [
        (1, 'корней (родитель пуст)', toString(roots)),
        (2, 'строк, где parent_lvl ≠ lvl − 1', toString(lvl_gap)),
        (3, 'юнитов с несколькими именами', toString(multi_name)),
        (4, 'юнитов с несколькими родителями', toString(multi_parent)),
        (5, 'родителей, которых нет среди юнитов', toString(orphans))
    ] AS kv

    UNION ALL

    -- 4в. Родитель против суммы детей на последний месяц: накопительные ли значения
    SELECT 4, '4 дерево', 200, 'родитель против суммы детей',
           concat('родителей ', toString(count()),
                  ' · равно ', toString(countIf(abs(p_amt - c_amt) < 0.5)),
                  ' · родитель больше ', toString(countIf(p_amt >= c_amt + 0.5)),
                  ' · родитель меньше ', toString(countIf(p_amt + 0.5 <= c_amt)))
    FROM
    (
        SELECT parent_mngt_unit_rk AS rk, sum(employee_amt) AS c_amt
        FROM prod_proteus.hr_structure_overall
        WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND parent_mngt_unit_rk IS NOT NULL
        GROUP BY rk
    ) AS c
    INNER JOIN
    (
        SELECT mngt_unit_rk AS rk, sum(employee_amt) AS p_amt
        FROM prod_proteus.hr_structure_overall
        WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall) AND mngt_unit_rk IS NOT NULL
        GROUP BY rk
    ) AS p USING (rk)

    UNION ALL

    -- 5. Значения справочников на последний месяц: до 40 самых частых
    SELECT 5, concat('5 справочник · ', kv.1), toUInt32(rn), kv.2,
           concat('строк ', toString(rows), ' · юнитов ', toString(units), ' · числ ', toString(round(emp, 1)))
    FROM
    (
        SELECT kv, count() AS rows, uniqExact(mngt_unit_rk) AS units, ifNull(sum(employee_amt), 0) AS emp,
               row_number() OVER (PARTITION BY kv.1 ORDER BY count() DESC) AS rn
        FROM prod_proteus.hr_structure_overall
        ARRAY JOIN [
            ('active_type_gr_nm', ifNull(toString(active_type_gr_nm), 'NULL')),
            ('active_type_nm', ifNull(toString(active_type_nm), 'NULL')),
            ('emp_specialization_oper_code', ifNull(toString(emp_specialization_oper_code), 'NULL')),
            ('emp_specialization_it_code', ifNull(toString(emp_specialization_it_code), 'NULL')),
            ('employment_relation_type_desc', ifNull(toString(employment_relation_type_desc), 'NULL')),
            ('lvl', ifNull(toString(lvl), 'NULL')),
            ('parent_lvl', ifNull(toString(parent_lvl), 'NULL'))
        ] AS kv
        WHERE month = (SELECT max(month) FROM prod_proteus.hr_structure_overall)
        GROUP BY kv
        ORDER BY kv.1, rows DESC
        LIMIT 40 BY kv.1
    )

    UNION ALL

    -- 6. Сверки показателей по всей таблице
    SELECT 6, '6 сверки', kv.1, kv.2, kv.3
    FROM
    (
        SELECT
            countIf(regret_fire_amt > fire_amt) AS regret_over,
            countIf(hire_to_active_amt > hire_amt) AS hire_act_over,
            countIf(perf_normal + perf_low + perf_high + perf_gray > employee_amt + 0.5) AS perf_over,
            sum(perf_normal + perf_low + perf_high + perf_gray) / greatest(sum(employee_amt), 1) AS perf_share,
            sum(ssch_employee_amt) / greatest(sum((employee_amt + lag_employee_amt) / 2), 1) AS ssch_ratio,
            countIf(employee_amt = 0 AND lag_employee_amt = 0 AND hire_amt = 0 AND fire_amt = 0) AS empty_rows
        FROM prod_proteus.hr_structure_overall
    )
    ARRAY JOIN [
        (1, 'строк, где regret больше увольнений', toString(regret_over)),
        (2, 'строк, где найм→акт больше найма', toString(hire_act_over)),
        (3, 'строк, где perf больше численности', toString(perf_over)),
        (4, 'perf всех видов к численности', toString(round(perf_share, 3))),
        (5, 'ССЧ к (числ + лаг) / 2', toString(round(ssch_ratio, 3))),
        (6, 'строк без людей и движения', toString(empty_rows))
    ] AS kv
)
ORDER BY n, section, ord, item;

-- ============================================================================
-- 5. SQL Lab — проверки пробника TeamPulse Hub (база CROSS)
--
-- Выделите один запрос — от SELECT до точки с запятой — и выполните (Ctrl+Enter).
-- Ответы с абсолютными числами в репозиторий НЕ кладите: репозиторий публичный.
-- Сверяйте их сами с тем, что показывает отчёт и что вы знаете из HR-отчётности.
-- ============================================================================


-- 1. Численность компании по месяцам — верхний юнит, без фильтров. «Ждали»: ровно
--    те же числа, что карточка «Общая численность» на One-pager пробника по месяцам
--    (наведите на спарклайн), и то, что вы знаете из HR-отчётности. Последний месяц
--    в таблице может быть неполным — в отчёт он не идёт.
SELECT month,
       sum(ifNull(employee_amt, 0)) AS hc_total,
       sumIf(ifNull(employee_amt, 0), active_type_gr_nm = 'Активная') AS hc_active,
       sum(ifNull(hire_amt, 0)) AS hire,
       sum(ifNull(fire_amt, 0)) AS fire,
       round(sum(ifNull(fire_amt, 0)) / greatest(sum(ifNull(ssch_employee_amt, 0)), 1) * 100, 2) AS turnover_m_pct
FROM prod_proteus.hr_structure_overall
WHERE lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall)
GROUP BY month
ORDER BY month;


-- 2. Юниты третьего уровня в последнем полном месяце. «Ждали»: те же юниты и та же
--    численность, что в таблице «Подразделения» пробника на уровне ниже «Компании».
SELECT mngt_unit_nm, sum(ifNull(employee_amt, 0)) AS hc_total
FROM prod_proteus.hr_structure_overall
WHERE lvl = (SELECT min(lvl) FROM prod_proteus.hr_structure_overall) + 2
  AND month = (SELECT if(max(month) >= toStartOfMonth(today()), addMonths(max(month), -1), max(month))
               FROM prod_proteus.hr_structure_overall)
GROUP BY mngt_unit_nm
ORDER BY hc_total DESC;


-- 3. Из чего состоит ответ датасета: вместо строки-комментария ниже вставьте SQL датасета
--    (файл 2) целиком. Считает ответ без фильтров — сколько строк каждой роли и сколько
--    килобайт. «Ждали»: meta 1, scope 1, base 1, dict 1, end 1, c / g / x — подразделения
--    трёх уровней; всего строк меньше «Лимита строк» чарта (50 000).
SELECT role, count() AS rows_n,
       round(sum(length(id) + length(pid) + length(nm) + length(j)
         + length(m_hc) + length(m_act) + length(m_avg) + length(m_hire) + length(m_fire)
         + length(m_reg) + length(m_tin) + length(m_tout) + length(m_plow) + length(m_prat)) / 1024) AS kb
FROM (
  -- сюда — SQL датасета (файл 2) целиком
) AS t
GROUP BY role
ORDER BY rows_n DESC;

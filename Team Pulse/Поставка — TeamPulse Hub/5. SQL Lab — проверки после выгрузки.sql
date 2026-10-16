-- ============================================================================
-- 5. SQL Lab — проверки пробника TeamPulse Hub (база CROSS)
--
-- Выделите один запрос — от SELECT до точки с запятой — и выполните (Ctrl+Enter).
-- Ответы с абсолютными числами в репозиторий НЕ кладите: репозиторий публичный.
-- Сверяйте их сами с тем, что показывает отчёт и что вы знаете из HR-отчётности.
-- ============================================================================


-- Схема таблицы — от 16.10.2026 (49 колонок): месяц `report_month`, юнит `mng_unit_rk`, его уровень
-- `leaf_lvl`, путь `lvl1_nm`…`lvl11_nm`. СТРОКА — ЛЮДИ СВОЕГО ЮНИТА, НЕ ПОДДЕРЕВА (ответ 0д, 16.10):
-- компания — сумма всех строк месяца, подразделение — сумма строк, чей путь с него начинается.
-- Юнит с двумя путями лежит в таблице дважды — берутся строки его меньшего пути в месяце,
-- простой суммой, как в датасете.


-- 1. Численность компании по месяцам, без фильтров. «Ждали»: ровно те же числа, что
--    карточка «Общая численность» на One-pager пробника по месяцам (наведите на
--    спарклайн), и то, что вы знаете из HR-отчётности. Последний месяц в таблице может
--    быть неполным — в отчёт он не идёт. ССЧ — полусумма активной с прошлым месяцем, как
--    в датасете; ssch_table — колонка таблицы, для сравнения.
SELECT report_month, hc_total, hc_active,
       (hc_active + lagInFrame(hc_active, 1, hc_active) OVER (ORDER BY report_month
          ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)) / 2 AS ssch,
       ssch_table, hire, fire,
       round(fire / greatest(ssch, 1) * 100, 2) AS turnover_m_pct
FROM (
  SELECT report_month, sum(e) AS hc_total, sum(ea) AS hc_active, sum(sa) AS ssch_table,
         sum(hi) AS hire, sum(fi) AS fire
  FROM (
    SELECT report_month, ifNull(hc_total_cnt, 0) AS e, ifNull(hc_active_cnt, 0) AS ea,
           ifNull(ssch_hc_active_cnt, 0) AS sa, ifNull(hire_amt, 0) AS hi, ifNull(fire_amt, 0) AS fi,
           arrayStringConcat(arraySlice(arrayMap(x -> ifNull(x, ''), [lvl1_nm, lvl2_nm, lvl3_nm, lvl4_nm, lvl5_nm, lvl6_nm, lvl7_nm, lvl8_nm, lvl9_nm, lvl10_nm, lvl11_nm]), 1, toInt32(ifNull(leaf_lvl, 0))), '\t') AS p, min(p) OVER (PARTITION BY report_month, mng_unit_rk) AS pm
    FROM prod_proteus.hr_structure_overall
  ) AS t
  WHERE p = pm
  GROUP BY report_month
) AS c
ORDER BY report_month;


-- 2. Подразделения второго и третьего уровня в последнем полном месяце — сумма по началу
--    пути. «Ждали»: те же подразделения и та же численность, что в таблице «Подразделения»
--    пробника (под «Компанией» — тот из уровней, что показан первым).
SELECT d AS lvl, arrayElement(splitByChar('\t', pf), d) AS nm, sum(e) AS hc_total
FROM (
  SELECT d, arrayStringConcat(arraySlice(splitByChar('\t', p), 1, d), '\t') AS pf, e
  FROM (
    SELECT ifNull(hc_total_cnt, 0) AS e, arrayStringConcat(arraySlice(arrayMap(x -> ifNull(x, ''), [lvl1_nm, lvl2_nm, lvl3_nm, lvl4_nm, lvl5_nm, lvl6_nm, lvl7_nm, lvl8_nm, lvl9_nm, lvl10_nm, lvl11_nm]), 1, toInt32(ifNull(leaf_lvl, 0))), '\t') AS p,
           min(p) OVER (PARTITION BY mng_unit_rk) AS pm
    FROM prod_proteus.hr_structure_overall
    WHERE report_month = (SELECT if(max(report_month) >= toStartOfMonth(today()), addMonths(max(report_month), -1), max(report_month))
                          FROM prod_proteus.hr_structure_overall)
  ) AS u
  ARRAY JOIN [2, 3] AS d
  WHERE p = pm AND length(splitByChar('\t', p)) >= d
) AS t
GROUP BY d, pf
ORDER BY d, hc_total DESC;


-- 3. Из чего состоит ответ датасета: вместо строки-комментария ниже вставьте SQL датасета
--    (файл 2) целиком. Считает ответ без фильтров — сколько строк каждой роли и сколько
--    килобайт. «Ждали»: meta 1, scope 1, base 1, dict 1, end 1, c / g / x — подразделения
--    трёх уровней; всего строк меньше «Лимита строк» чарта (50 000).
SELECT role, count() AS rows_n,
       round(sum(length(id) + length(pid) + length(nm) + length(j)
         + length(m_hc) + length(m_act) + length(m_avg) + length(m_hire) + length(m_fire)
         + length(m_reg) + length(m_tin) + length(m_tout)
         + length(m_pnor) + length(m_plow) + length(m_phig) + length(m_pgry)
         + length(m_wday) + length(m_ovis) + length(m_gapr) + length(m_gdec) + length(mx)) / 1024) AS kb
FROM (
  -- сюда — SQL датасета (файл 2) целиком
) AS t
GROUP BY role
ORDER BY rows_n DESC, role;

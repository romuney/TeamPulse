-- ============================================================================
-- 5. SQL Lab — проверки пробника TeamPulse Hub (база CROSS)
--
-- Выделите один запрос — от SELECT до точки с запятой — и выполните (Ctrl+Enter).
-- Ответы с абсолютными числами в репозиторий НЕ кладите: репозиторий публичный.
-- Сверяйте их сами с тем, что показывает отчёт и что вы знаете из HR-отчётности.
-- ============================================================================


-- Схема таблицы — от 16.10.2026 (49 колонок): месяц `report_month`, юнит `mng_unit_rk`, его уровень
-- `leaf_lvl`, путь `lvl1_nm`…`lvl11_nm`. Юнит с двумя путями лежит в таблице дважды —
-- запросы, как и датасет, берут каждую строку «месяц × юнит × ВСЕ атрибуты» один раз (max).


-- 1. Численность компании по месяцам — верхний юнит, без фильтров. «Ждали»: ровно
--    те же числа, что карточка «Общая численность» на One-pager пробника по месяцам
--    (наведите на спарклайн), и то, что вы знаете из HR-отчётности. Последний месяц
--    в таблице может быть неполным — в отчёт он не идёт.
SELECT report_month,
       sum(e) AS hc_total,
       sum(ea) AS hc_active,
       sum(hi) AS hire,
       sum(fi) AS fire,
       round(sum(fi) / greatest(sum(sa), 1) * 100, 2) AS turnover_m_pct
FROM (
  SELECT report_month, gender, type_age, experience_group_nm, grade, seniority, employee_contract_type,
           legal_organization, employee_stream, employment_relation_type, employment_relation_type_gr_nm,
           active_type_gr_nm, emp_specialization_it_code, fire_reason_group, fire_initiative,
         max(ifNull(hc_total_cnt, 0)) AS e, max(ifNull(hc_active_cnt, 0)) AS ea,
         max(ifNull(ssch_hc_active_cnt, 0)) AS sa, max(ifNull(hire_amt, 0)) AS hi, max(ifNull(fire_amt, 0)) AS fi
  FROM prod_proteus.hr_structure_overall
  WHERE mng_unit_rk = (SELECT argMin(mng_unit_rk, leaf_lvl) FROM prod_proteus.hr_structure_overall WHERE leaf_lvl > 0)
  GROUP BY report_month, gender, type_age, experience_group_nm, grade, seniority, employee_contract_type,
           legal_organization, employee_stream, employment_relation_type, employment_relation_type_gr_nm,
           active_type_gr_nm, emp_specialization_it_code, fire_reason_group, fire_initiative
) AS t
GROUP BY report_month
ORDER BY report_month;


-- 2. Юниты третьего уровня в последнем полном месяце. «Ждали»: те же юниты и та же
--    численность, что в таблице «Подразделения» пробника на уровне ниже «Компании».
SELECT nm, sum(e) AS hc_total
FROM (
  SELECT mng_unit_rk, gender, type_age, experience_group_nm, grade, seniority, employee_contract_type,
           legal_organization, employee_stream, employment_relation_type, employment_relation_type_gr_nm,
           active_type_gr_nm, emp_specialization_it_code, fire_reason_group, fire_initiative,
         any(arrayElement([lvl1_nm, lvl2_nm, lvl3_nm, lvl4_nm, lvl5_nm, lvl6_nm, lvl7_nm, lvl8_nm, lvl9_nm, lvl10_nm, lvl11_nm], ifNull(leaf_lvl, 0))) AS nm,
         max(ifNull(hc_total_cnt, 0)) AS e
  FROM prod_proteus.hr_structure_overall
  WHERE leaf_lvl = (SELECT min(leaf_lvl) FROM prod_proteus.hr_structure_overall WHERE leaf_lvl > 0) + 2
    AND report_month = (SELECT if(max(report_month) >= toStartOfMonth(today()), addMonths(max(report_month), -1), max(report_month))
                        FROM prod_proteus.hr_structure_overall)
  GROUP BY mng_unit_rk, gender, type_age, experience_group_nm, grade, seniority, employee_contract_type,
           legal_organization, employee_stream, employment_relation_type, employment_relation_type_gr_nm,
           active_type_gr_nm, emp_specialization_it_code, fire_reason_group, fire_initiative
) AS t
GROUP BY mng_unit_rk, nm
ORDER BY hc_total DESC;


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
ORDER BY rows_n DESC;

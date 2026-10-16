SELECT section, item, value
-- ============================================================================
-- 0д. prod_proteus.hr_structure_overall, схема 16.10.2026 (разведка 4, 49 колонок) —
-- ВТОРОЙ ЗАХОД (16.10). Первый ответ показал: строка — люди СВОЕГО юнита, не поддерева
-- (верхний юнит — 3 человека, у 2 705 из 3 095 юнитов дети больше родителя). Поэтому
-- «компания» здесь — сумма ВСЕХ строк месяца, а не верхний юнит.
-- ОДИН запрос. SQL Lab: вставить целиком, выполнить (Ctrl+Enter), ответ —
-- «Скопировать в буфер» или CSV. Строк в ответе — около 150.
--
-- Зачем. Таблица денормализована и дополнена атрибутами. Пробник с 15.10 строит по
-- ним разрезы состава и увольнений, недоработку и переработку. Значения атрибутов и
-- смысл части колонок восстановлены из названий — запрос проверяет их на данных:
--   1 значения    — все значения каждого атрибута человека и их доля численности
--                   компании (‰) за последний полный месяц; у причины и инициативы
--                   увольнения — доля увольнений с начала года. По ним чарт упорядочит
--                   категории (возраст, стаж, грейд, сеньорность) и разложит инициативу
--                   на «сотрудник / работодатель / другое»;
--   2 дерево      — глубины, юниты с двумя путями, одинаковые пути у разных ключей,
--                   юниты без родителя по пути;
--   3 поддерево   — подтверждение 16.10: строки юнита — только его люди (юнит меньше суммы детей по пути);
--   4 численность — активная ≤ общей, ССЧ = (активная + лаг) / 2, regret ≤ увольнений;
--   5 мониторинг  — perf_normal + low + high + gray против численности: на ком
--                   считается мониторинг и что такое Gray (знаменатель недоработки);
--   6 увольнения  — у всех ли строк увольнения есть причина и инициатива;
--   7 колонки 16.10 — делят ли active_type_gr_nm, IT-код и группа типа отношений строки
--                   «месяц × юнит × атрибуты» (если да — датасет поставки 17 занижал
--                   численность, поставка 22 это чинит), что значит тип активности
--                   рядом с hc_active_cnt и из каких типов отношений состоит группа.
--
-- ОТВЕТ МАСКИРОВАН, как 0б–0г: имён и ключей юнитов нет; численность — в промилле (‰)
-- от численности компании (все строки месяца) в последнем полном месяце. «Последний
-- полный месяц» — как в датасете: если в таблице есть строки текущего месяца, это
-- прошлый. Проверено на ClickHouse 24.8 (симуляция таблицы, stand/sim_hso.py).
-- ============================================================================
FROM
(
WITH
  cal AS (
    SELECT toDate(max(report_month)) AS mx0, if(mx0 >= toStartOfMonth(today()), addMonths(mx0, -1), mx0) AS lm
    FROM prod_proteus.hr_structure_overall
  ),
  top AS (SELECT min(leaf_lvl) AS tl FROM prod_proteus.hr_structure_overall WHERE leaf_lvl > 0),
  -- компания, последний полный месяц: все строки (копии путей одного юнита — один раз)
  co AS (
    SELECT u, g, a, t, gr, s, c, o, w, r, rq, ag, ic, fr, fi,
           max(toFloat64(ifNull(hc_total_cnt, 0))) AS e, max(toFloat64(ifNull(hc_active_cnt, 0))) AS ea,
           max(toFloat64(ifNull(lag_hc_active_cnt, 0))) AS lg, max(ifNull(ssch_hc_active_cnt, 0)) AS ss,
           max(toFloat64(ifNull(fire_amt, 0))) AS f, max(toFloat64(ifNull(regret_fire_amt, 0))) AS rg,
           max(ifNull(perf_normal, 0)) AS pn, max(ifNull(perf_low, 0)) AS pl, max(ifNull(perf_high, 0)) AS ph,
           max(ifNull(perf_gray, 0)) AS pg
    FROM
    (
      SELECT *, ifNull(mng_unit_rk, '') AS u, ifNull(gender, '∅') AS g, ifNull(type_age, '∅') AS a, ifNull(experience_group_nm, '∅') AS t,
             ifNull(grade, '∅') AS gr, ifNull(seniority, '∅') AS s, ifNull(employee_contract_type, '∅') AS c,
             ifNull(legal_organization, '∅') AS o, ifNull(employee_stream, '∅') AS w,
             ifNull(employment_relation_type, '∅') AS r, ifNull(employment_relation_type_gr_nm, '∅') AS rq,
             ifNull(active_type_gr_nm, '∅') AS ag, ifNull(emp_specialization_it_code, '∅') AS ic,
             ifNull(fire_reason_group, '∅') AS fr, ifNull(fire_initiative, '∅') AS fi
      FROM prod_proteus.hr_structure_overall
      WHERE report_month = (SELECT lm FROM cal)
    )
    GROUP BY u, g, a, t, gr, s, c, o, w, r, rq, ag, ic, fr, fi
  ),
  base AS (SELECT greatest(sum(e), 1) AS b FROM co),
  -- увольнения компании с начала года — по причине и инициативе
  fy AS (
    SELECT fr, fi, sum(f) AS f
    FROM
    (
      SELECT report_month, ifNull(mng_unit_rk, '') AS u, ifNull(fire_reason_group, '∅') AS fr, ifNull(fire_initiative, '∅') AS fi,
             gender, type_age, experience_group_nm, grade, seniority, employee_contract_type,
             legal_organization, employee_stream, employment_relation_type,
             employment_relation_type_gr_nm, active_type_gr_nm, emp_specialization_it_code,
             max(toFloat64(ifNull(fire_amt, 0))) AS f
      FROM prod_proteus.hr_structure_overall
      WHERE report_month BETWEEN toStartOfYear((SELECT lm FROM cal)) AND (SELECT lm FROM cal)
      GROUP BY report_month, u, fr, fi, gender, type_age, experience_group_nm, grade, seniority,
               employee_contract_type, legal_organization, employee_stream, employment_relation_type,
               employment_relation_type_gr_nm, active_type_gr_nm, emp_specialization_it_code
    )
    GROUP BY fr, fi
  ),
  fyt AS (SELECT greatest(sum(f), 1) AS ft FROM fy),
  -- пути юнитов последнего полного месяца
  tp AS (
    SELECT DISTINCT ifNull(mng_unit_rk, '') AS u0, toInt32(ifNull(leaf_lvl, 0)) AS l0,
           arrayStringConcat(arraySlice(arrayMap(x -> ifNull(x, ''), [lvl1_nm, lvl2_nm, lvl3_nm, lvl4_nm, lvl5_nm,
             lvl6_nm, lvl7_nm, lvl8_nm, lvl9_nm, lvl10_nm, lvl11_nm]), 1, l0), '\t') AS p0
    FROM prod_proteus.hr_structure_overall
    WHERE report_month = (SELECT lm FROM cal) AND mng_unit_rk IS NOT NULL
  ),
  -- юнит последнего месяца: численность своих строк (копии путей — один раз)
  ue AS (
    SELECT u1, sum(e1) AS e
    FROM
    (
      SELECT ifNull(mng_unit_rk, '') AS u1, max(toFloat64(ifNull(hc_total_cnt, 0))) AS e1
      FROM prod_proteus.hr_structure_overall
      WHERE report_month = (SELECT lm FROM cal)
      GROUP BY u1, gender, type_age, experience_group_nm, grade, seniority, employee_contract_type,
               legal_organization, employee_stream, employment_relation_type, employment_relation_type_gr_nm,
               active_type_gr_nm, emp_specialization_it_code, fire_reason_group, fire_initiative
    )
    GROUP BY u1
  ),
  st AS (SELECT u0, any(l0) AS lv, min(p0) AS ps, count() AS np FROM tp GROUP BY u0),
  par AS (
    SELECT s.u0 AS u, s.lv AS lv, ifNull(p.u0, '') AS pu
    FROM st AS s
    LEFT JOIN (SELECT p0 AS pk, min(u0) AS u0 FROM tp GROUP BY p0) AS p
      ON p.pk = if(s.lv > 1, arrayStringConcat(arraySlice(splitByChar('\t', s.ps), 1, s.lv - 1), '\t'), '#root')
  ),
  kidsum AS (SELECT pu, sum(e) AS ke FROM par AS x INNER JOIN ue AS y ON y.u1 = x.u WHERE pu != '' GROUP BY pu),
  -- 7. компания, последний месяц, СЫРЫЕ строки; копии путей юнита — один раз (по пути)
  raw7 AS (
    SELECT toFloat64(ifNull(hc_total_cnt, 0)) AS e7,
           tuple(mng_unit_rk, gender, type_age, experience_group_nm, grade, seniority, employee_contract_type, legal_organization,
                 employee_stream, employment_relation_type, fire_reason_group, fire_initiative) AS k46
    FROM prod_proteus.hr_structure_overall
    WHERE report_month = (SELECT lm FROM cal)
      AND (mng_unit_rk, arrayStringConcat(arrayMap(x -> ifNull(x, ''), [lvl1_nm, lvl2_nm, lvl3_nm, lvl4_nm, lvl5_nm,
             lvl6_nm, lvl7_nm, lvl8_nm, lvl9_nm, lvl10_nm, lvl11_nm]), '\t')) IN (SELECT u0, min(p9) FROM
             (SELECT mng_unit_rk AS u0, arrayStringConcat(arrayMap(x -> ifNull(x, ''), [lvl1_nm, lvl2_nm, lvl3_nm, lvl4_nm, lvl5_nm,
             lvl6_nm, lvl7_nm, lvl8_nm, lvl9_nm, lvl10_nm, lvl11_nm]), '\t') AS p9
              FROM prod_proteus.hr_structure_overall WHERE report_month = (SELECT lm FROM cal)) GROUP BY u0)
  ),
  old7 AS (SELECT sum(m7) AS e46 FROM (SELECT k46, max(e7) AS m7 FROM raw7 GROUP BY k46))
SELECT * FROM
(
  -- 1. значения атрибутов: доля численности компании, ‰
  SELECT 1 AS o, '1 значения: ' || k AS section, v AS item,
         toString(round(n / (SELECT b FROM base) * 1000, 1)) || ' ‰' AS value
  FROM
  (
    SELECT tupleElement(x, 1) AS k, tupleElement(x, 2) AS v, sum(tupleElement(x, 3)) AS n
    FROM (SELECT arrayJoin([('gender', g, e), ('type_age', a, e), ('experience_group_nm', t, e), ('grade', gr, e),
                            ('seniority', s, e), ('employee_contract_type', c, e), ('legal_organization', o, e),
                            ('employee_stream', w, e), ('employment_relation_type', r, e),
                            ('employment_relation_type_gr_nm', rq, e), ('active_type_gr_nm', ag, e),
                            ('emp_specialization_it_code', ic, e)]) AS x FROM co)
    GROUP BY k, v
  )
  UNION ALL
  -- увольнения с начала года: причина и инициатива, доля увольнений
  SELECT 2 AS o, '1 значения: ' || k AS section, v AS item,
         toString(round(n / (SELECT ft FROM fyt) * 1000, 1)) || ' ‰ увольнений' AS value
  FROM
  (
    SELECT tupleElement(x, 1) AS k, tupleElement(x, 2) AS v, sum(tupleElement(x, 3)) AS n
    FROM (SELECT arrayJoin([('fire_reason_group', fr, f), ('fire_initiative', fi, f)]) AS x FROM fy WHERE f > 0)
    GROUP BY k, v
  )
  UNION ALL
  SELECT 3 AS o, '1 значения: увольнения с начала года' AS section, 'всего, ‰ от численности' AS item,
         toString(round((SELECT ft FROM fyt) / (SELECT b FROM base) * 1000, 1)) AS value
  UNION ALL
  -- 2. дерево
  SELECT 4 AS o, '2 дерево' AS section, 'юнитов в последнем месяце' AS item, toString(count()) AS value FROM st
  UNION ALL SELECT 4 AS o, '2 дерево' AS section, 'глубины leaf_lvl: уровень → юнитов' AS item,
         arrayStringConcat(arrayMap(x -> toString(x.1) || '→' || toString(x.2), arraySort(groupArray((lv, n)))), ' ') AS value
    FROM (SELECT lv, count() AS n FROM st GROUP BY lv)
  UNION ALL SELECT 4 AS o, '2 дерево' AS section, 'юнитов с двумя и более путями' AS item, toString(countIf(np > 1)) AS value FROM st
  UNION ALL SELECT 4 AS o, '2 дерево' AS section, 'разных имён на уровне 1 (корней)' AS item, toString(uniqExact(splitByChar('\t', ps)[1])) AS value FROM st
  UNION ALL SELECT 4 AS o, '2 дерево' AS section, 'узлов дерева (все начала путей) / из них со своими строками' AS item,
         toString(uniqExact(pf)) || ' / ' || toString((SELECT uniqExact(ps) FROM st)) AS value
    FROM (SELECT arrayStringConcat(arraySlice(splitByChar('\t', ps), 1, d), '\t') AS pf FROM st ARRAY JOIN range(1, lv + 1) AS d)
  UNION ALL SELECT 4 AS o, '2 дерево' AS section, 'путей, общих для разных ключей' AS item, toString(count()) AS value
    FROM (SELECT p0 FROM tp GROUP BY p0 HAVING uniqExact(u0) > 1)
  UNION ALL SELECT 4 AS o, '2 дерево' AS section, 'юнитов без родителя по пути (кроме корня)' AS item, toString(countIf(pu = '' AND lv > (SELECT tl FROM top))) AS value FROM par
  UNION ALL
  -- 3. поддерево: юнит не меньше суммы детей
  SELECT 5 AS o, '3 поддерево' AS section, 'юнитов с детьми' AS item, toString(count()) AS value FROM kidsum
  UNION ALL SELECT 5 AS o, '3 поддерево' AS section, 'из них юнит меньше суммы детей' AS item, toString(countIf(y.e + 0.5 < x.ke)) AS value
    FROM kidsum AS x INNER JOIN ue AS y ON y.u1 = x.pu
  UNION ALL SELECT 5 AS o, '3 поддерево' AS section, 'медиана: люди детей по пути / свои люди юнита' AS item,
         toString(round(median(if(y.e > 0, x.ke / y.e, 0)), 3)) AS value
    FROM kidsum AS x INNER JOIN ue AS y ON y.u1 = x.pu
  UNION ALL
  -- 4. численность и ССЧ (верхний юнит, последний месяц)
  SELECT 6 AS o, '4 численность' AS section, 'активная / общая' AS item, toString(round(sum(ea) / greatest(sum(e), 1), 3)) AS value FROM co
  UNION ALL SELECT 6 AS o, '4 численность' AS section, 'ССЧ / ((активная + лаг) / 2)' AS item, toString(round(sum(ss) / greatest(sum(ea + lg) / 2, 1), 3)) AS value FROM co
  UNION ALL SELECT 6 AS o, '4 численность' AS section, 'строк, где ССЧ ≠ (активная + лаг) / 2' AS item, toString(countIf(abs(ss - (ea + lg) / 2) > 0.01)) AS value FROM co
  UNION ALL SELECT 6 AS o, '4 численность' AS section, 'regret / увольнения за месяц' AS item, toString(round(sum(rg) / greatest(sum(f), 1), 3)) AS value FROM co
  UNION ALL
  -- 5. мониторинг: сумма четырёх категорий против численности
  SELECT 7 AS o, '5 мониторинг' AS section, '(нормал + недоработка + переработка + Gray) / общая' AS item, toString(round(sum(pn + pl + ph + pg) / greatest(sum(e), 1), 3)) AS value FROM co
  UNION ALL SELECT 7 AS o, '5 мониторинг' AS section, '(нормал + недоработка + переработка + Gray) / активная' AS item, toString(round(sum(pn + pl + ph + pg) / greatest(sum(ea), 1), 3)) AS value FROM co
  UNION ALL SELECT 7 AS o, '5 мониторинг' AS section, 'доли: нормал · недоработка · переработка · Gray' AS item,
         arrayStringConcat(arrayMap(x -> toString(round(x / greatest(sum(pn + pl + ph + pg), 1) * 100, 1)) || '%',
           [sum(pn), sum(pl), sum(ph), sum(pg)]), ' · ') AS value FROM co
  UNION ALL SELECT 7 AS o, '5 мониторинг' AS section, 'строк с дробным perf_*' AS item, toString(countIf(pn + pl + ph + pg != floor(pn + pl + ph + pg))) AS value FROM co
  UNION ALL SELECT 7 AS o, '5 мониторинг' AS section, 'Gray у штатных / у нештатных, доля' AS item,
         toString(round(sumIf(pg, r = 'Штатный сотрудник') / greatest(sumIf(pn + pl + ph + pg, r = 'Штатный сотрудник'), 1), 3)) || ' / ' ||
         toString(round(sumIf(pg, r != 'Штатный сотрудник') / greatest(sumIf(pn + pl + ph + pg, r != 'Штатный сотрудник'), 1), 3)) AS value FROM co
  UNION ALL
  -- 6. увольнения: причина и инициатива есть у строк увольнения
  SELECT 8 AS o, '6 увольнения' AS section, 'доля увольнений без причины (∅)' AS item, toString(round(sumIf(f, fr = '∅') / greatest(sum(f), 1), 3)) AS value FROM fy
  UNION ALL SELECT 8 AS o, '6 увольнения' AS section, 'доля увольнений без инициативы (∅)' AS item, toString(round(sumIf(f, fi = '∅') / greatest(sum(f), 1), 3)) AS value FROM fy
  UNION ALL SELECT 8 AS o, '6 увольнения' AS section, 'численность в строках с причиной увольнения, ‰' AS item,
         toString(round(sumIf(e, fr != '∅') / (SELECT b FROM base) * 1000, 1)) AS value FROM co
  UNION ALL
  -- 7. колонки 16.10: делят ли строки, тип активности, группа типа отношений
  SELECT 9 AS o, '7 колонки 16.10' AS section, 'строк компании: ключ без новых колонок / все (один путь юнита)' AS item,
         toString(uniqExact(k46)) || ' / ' || toString(count()) AS value FROM raw7
  UNION ALL SELECT 9 AS o, '7 колонки 16.10' AS section, 'численность: склейка без новых колонок (поставка 17) / сумма строк' AS item,
         toString(round((SELECT e46 FROM old7) / greatest(sum(e7), 1), 4)) AS value FROM raw7
  UNION ALL SELECT 9 AS o, '7 колонки 16.10' AS section, 'active_type_gr_nm «' || ag || '»: активная / общая' AS item,
         toString(round(sum(ea) / greatest(sum(e), 1), 3)) AS value FROM co GROUP BY ag
  UNION ALL SELECT 9 AS o, '7 колонки 16.10' AS section, 'группа «' || rq || '»: типы отношений' AS item,
         arrayStringConcat(arraySort(groupUniqArray(r)), ' · ') AS value FROM co GROUP BY rq
)
ORDER BY o, section, item
)

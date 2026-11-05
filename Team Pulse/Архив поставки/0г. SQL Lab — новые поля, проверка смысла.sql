SELECT section, item, value
-- ============================================================================
-- 0г. Новые поля prod_proteus.hr_structure_overall (разведка 12.10.2026) — ОДИН запрос.
-- SQL Lab: вставить целиком, выполнить (Ctrl+Enter), ответ — «Скопировать в буфер»
-- или CSV. Строк в ответе — около 60.
--
-- Зачем. В таблице появились work_day_amt, office_visit_amt и grt_approve /
-- decline / cancel / inprogress_cnt. Пробник считает по ним две метрики:
--   посещаемость офиса = office_visit_amt / work_day_amt;
--   T-рост: одобрено, отклонено, конверсия = одобрено / (одобрено + отклонено).
-- Это допущения: смысл колонок в описании таблицы помечен «уточнить». Запрос
-- проверяет их на данных:
--   1 колонки     — NULL, нули, отрицательные, дробные;
--   2 компания    — по месяцам: дней на человека (work_day / численность), доля
--                   дней в офисе, заявки GRT на 1000 человек и их конверсия;
--   3 уровни      — накопительные ли новые колонки по поддереву, как численность
--                   (тогда сумма по уровням 1–3 одинакова и юнит не меньше суммы детей);
--   4 на ком      — у какой численности новые колонки: активная / прочие, покраска, штат;
--   5 согласованность — визитов не больше дней, одобренных не больше численности.
--
-- ОТВЕТ МАСКИРОВАН, как 0б и 0в: имён и ключей юнитов нет, суммы — в промилле (‰)
-- от численности компании (верхний юнит) в последнем полном месяце, остальное —
-- отношения. «Последний полный месяц» — как в датасете: если в таблице есть
-- строки текущего месяца, это прошлый. Проверено на ClickHouse 24.8.
-- ============================================================================
FROM
(
WITH
  cal AS (
    SELECT toDate(max(month)) AS mx, if(mx >= toStartOfMonth(today()), addMonths(mx, -1), mx) AS lm
    FROM prod_proteus.hr_structure_overall
  ),
  top AS (SELECT min(lvl) AS tl FROM prod_proteus.hr_structure_overall),
  base AS (
    SELECT greatest(sum(ifNull(employee_amt, 0)), 1) AS b
    FROM prod_proteus.hr_structure_overall
    WHERE month = (SELECT lm FROM cal) AND lvl = (SELECT tl FROM top)
  ),
  -- верхний юнит по месяцам (последние 13 полных месяцев)
  co AS (
    SELECT month AS m, sum(ifNull(employee_amt, 0)) AS e, sum(ifNull(work_day_amt, 0)) AS wd,
           sum(ifNull(office_visit_amt, 0)) AS ov, sum(ifNull(grt_approve_cnt, 0)) AS ga,
           sum(ifNull(grt_decline_cnt, 0)) AS gd, sum(ifNull(grt_cancel_cnt, 0)) AS gc,
           sum(ifNull(grt_inprogress_cnt, 0)) AS gi
    FROM prod_proteus.hr_structure_overall
    WHERE lvl = (SELECT tl FROM top) AND month BETWEEN addMonths((SELECT lm FROM cal), -12) AND (SELECT lm FROM cal)
    GROUP BY m
  ),
  -- юнит последнего полного месяца: свои строки (копии юнита с двумя родителями — один раз)
  un AS (
    SELECT rk, any(prk) AS prk, any(lv) AS lv, sum(e) AS e, sum(wd) AS wd, sum(ov) AS ov,
           sum(ga) AS ga, sum(gd) AS gd, sum(gi) AS gi
    FROM
    (
      SELECT ifNull(mngt_unit_rk, '') AS rk, min(ifNull(parent_mngt_unit_rk, '')) AS prk, any(lvl) AS lv,
             max(ifNull(employee_amt, 0)) AS e, max(ifNull(work_day_amt, 0)) AS wd,
             max(ifNull(office_visit_amt, 0)) AS ov, max(toFloat64(ifNull(grt_approve_cnt, 0))) AS ga,
             max(toFloat64(ifNull(grt_decline_cnt, 0))) AS gd, max(toFloat64(ifNull(grt_inprogress_cnt, 0))) AS gi
      FROM prod_proteus.hr_structure_overall
      WHERE month = (SELECT lm FROM cal)
      GROUP BY rk, active_type_gr_nm, emp_specialization_oper_code, emp_specialization_it_code, employment_relation_type
    )
    GROUP BY rk
  ),
  -- родитель против суммы прямых детей
  pc AS (
    SELECT p.rk AS rk, p.wd AS pwd, p.ov AS pov, p.ga AS pga, p.e AS pe,
           c.wd AS cwd, c.ov AS cov, c.ga AS cga, c.e AS ce
    FROM un AS p
    INNER JOIN (SELECT prk, sum(wd) AS wd, sum(ov) AS ov, sum(ga) AS ga, sum(e) AS e FROM un WHERE prk != '' GROUP BY prk) AS c
      ON c.prk = p.rk
  )
SELECT * FROM
(
  -- 1. Колонки за всё время
  SELECT 1 AS n, '1 колонки' AS section, toUInt32(o) AS ord, col AS item,
         concat('строк с NULL ‰ ', toString(round(nul / greatest(cnt, 1) * 1000, 2)),
                ' · с нулём ‰ ', toString(round(zer / greatest(cnt, 1) * 1000, 2)),
                ' · отрицательных ', toString(neg), ' · дробных ', toString(frac)) AS value
  FROM
  (
    SELECT kv.1 AS col, kv.2 AS o, count() AS cnt, countIf(isNull(kv.3)) AS nul, countIf(kv.3 = 0) AS zer,
           countIf(kv.3 < 0) AS neg, countIf(kv.3 != floor(kv.3)) AS frac
    FROM prod_proteus.hr_structure_overall
    ARRAY JOIN [('work_day_amt', 1, work_day_amt), ('office_visit_amt', 2, office_visit_amt),
                ('grt_approve_cnt', 3, toFloat64(grt_approve_cnt)), ('grt_decline_cnt', 4, toFloat64(grt_decline_cnt)),
                ('grt_cancel_cnt', 5, toFloat64(grt_cancel_cnt)), ('grt_inprogress_cnt', 6, toFloat64(grt_inprogress_cnt))] AS kv
    GROUP BY col, o
  )

  UNION ALL

  -- 2. Компания по месяцам: дни на человека ≈ 17–22 значит «человеко-дни за месяц»;
  --    доля дней в офисе 0–100 % — посещаемость; GRT на 1000 человек и конверсия
  SELECT 2 AS n, '2 компания по месяцам' AS section, toUInt32(toYYYYMM(m)) AS ord, toString(m) AS item,
         concat('дней на человека ', toString(round(wd / greatest(e, 1), 2)),
                ' · в офисе % ', if(wd = 0, '—', toString(round(ov / wd * 100, 1))),
                ' · GRT ‰: одобрено ', toString(round(ga / (SELECT b FROM base) * 1000, 2)),
                ' · отклонено ', toString(round(gd / (SELECT b FROM base) * 1000, 2)),
                ' · отменено ', toString(round(gc / (SELECT b FROM base) * 1000, 2)),
                ' · в процессе ', toString(round(gi / (SELECT b FROM base) * 1000, 2)),
                ' · конверсия % ', if(ga + gd = 0, '—', toString(round(ga / (ga + gd) * 100, 1)))) AS value
  FROM co

  UNION ALL

  -- 3. Накопительность по поддереву: суммы по уровням (‰) и родитель против детей
  SELECT 3 AS n, '3 уровни, последний полный месяц' AS section, toUInt32(ifNull(lv, 0)) AS ord,
         concat('уровень ', toString(lv)) AS item,
         concat('численность ‰ ', toString(round(sum(e) / (SELECT b FROM base) * 1000, 1)),
                ' · дни на человека компании ', toString(round(sum(wd) / (SELECT b FROM base), 2)),
                ' · визиты на человека компании ', toString(round(sum(ov) / (SELECT b FROM base), 2)),
                ' · одобрено ‰ ', toString(round(sum(ga) / (SELECT b FROM base) * 1000, 2)),
                ' · в процессе ‰ ', toString(round(sum(gi) / (SELECT b FROM base) * 1000, 2))) AS value
  FROM un
  WHERE lv <= (SELECT tl FROM top) + 5
  GROUP BY lv

  UNION ALL

  SELECT 3 AS n, '3 уровни, последний полный месяц' AS section, toUInt32(100) AS ord, 'родитель против суммы детей' AS item,
         concat('родителей ', toString(count()),
                ' · юнит ≥ детей, % — численность ', toString(round(countIf(pe >= ce - 0.5) / greatest(count(), 1) * 100, 1)),
                ' · дни ', toString(round(countIf(pwd >= cwd - 0.5) / greatest(count(), 1) * 100, 1)),
                ' · визиты ', toString(round(countIf(pov >= cov - 0.5) / greatest(count(), 1) * 100, 1)),
                ' · одобрено ', toString(round(countIf(pga >= cga - 0.5) / greatest(count(), 1) * 100, 1)),
                ' · Σ детей / Σ юнитов — дни ', toString(round(sum(cwd) / greatest(sum(pwd), 1), 3)),
                ' · численность ', toString(round(sum(ce) / greatest(sum(pe), 1), 3))) AS value
  FROM pc

  UNION ALL

  -- 4. На ком новые колонки: верхний юнит, последние 12 полных месяцев, ‰ от суммы колонки
  SELECT 4 AS n, '4 на ком, 12 месяцев' AS section, toUInt32(o) AS ord, concat(kv.1, ' = ', kv.2) AS item,
         concat('численность ‰ ', toString(round(sum(e) / greatest(any(te), 1) * 1000, 1)),
                ' · дни ‰ ', toString(round(sum(wd) / greatest(any(twd), 1) * 1000, 1)),
                ' · визиты ‰ ', toString(round(sum(ov) / greatest(any(tov), 1) * 1000, 1)),
                ' · GRT решения ‰ ', toString(round(sum(g) / greatest(any(tg), 1) * 1000, 1))) AS value
  FROM
  (
    SELECT ifNull(employee_amt, 0) AS e, ifNull(work_day_amt, 0) AS wd, ifNull(office_visit_amt, 0) AS ov,
           toFloat64(ifNull(grt_approve_cnt, 0) + ifNull(grt_decline_cnt, 0)) AS g,
           [('тип численности', ifNull(active_type_gr_nm, 'NULL'), 1),
            ('покраска', ifNull(emp_specialization_oper_code, 'NULL'), 2),
            ('штат', if(ifNull(employment_relation_type, '') = 'Штатный сотрудник', 'Штат', 'Не штат'), 3)] AS kvs,
           sum(e) OVER () AS te, sum(wd) OVER () AS twd, sum(ov) OVER () AS tov, sum(g) OVER () AS tg
    FROM prod_proteus.hr_structure_overall
    WHERE lvl = (SELECT tl FROM top) AND month BETWEEN addMonths((SELECT lm FROM cal), -11) AND (SELECT lm FROM cal)
  )
  ARRAY JOIN kvs AS kv
  GROUP BY kv.1, kv.2, kv.3 AS o

  UNION ALL

  -- 5. Согласованность по строкам таблицы за всё время
  SELECT 5 AS n, '5 согласованность' AS section, toUInt32(1) AS ord, 'строки' AS item,
         concat('визитов больше дней, ‰ строк ', toString(round(countIf(ifNull(office_visit_amt, 0) > ifNull(work_day_amt, 0)) / greatest(count(), 1) * 1000, 2)),
                ' · дней больше 23 × численность, ‰ ', toString(round(countIf(ifNull(work_day_amt, 0) > 23 * ifNull(employee_amt, 0)) / greatest(count(), 1) * 1000, 2)),
                ' · одобрено больше численности, ‰ ', toString(round(countIf(ifNull(grt_approve_cnt, 0) > ifNull(employee_amt, 0)) / greatest(count(), 1) * 1000, 2)),
                ' · GRT при нулевой численности, ‰ ', toString(round(countIf(ifNull(employee_amt, 0) = 0 AND ifNull(grt_approve_cnt, 0) + ifNull(grt_decline_cnt, 0) + ifNull(grt_inprogress_cnt, 0) > 0) / greatest(count(), 1) * 1000, 2))) AS value
  FROM prod_proteus.hr_structure_overall
)
)
ORDER BY n, section, ord, item;

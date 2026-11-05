SELECT section, item, value
-- ============================================================================
-- 0е. prod_proteus.teampulse_hub_* — четыре таблицы ноутбука «1. Helicopter — ноут TeamPulse
-- Hub.yaml» (meta, unit, series, mix), 19.10.2026, версия 20.10 (после поставки 36). ОДИН запрос.
-- SQL Lab, база CROSS: вставить целиком, выполнить (Ctrl+Enter), ответ — «Скопировать в буфер»
-- или CSV, в чат. Строк в ответе — около 60.
--
-- 20.10, после первого ответа: с поставки 36 у series и mix есть тип численности act_cd
-- («Активная» / «Прочие»), у series — найм в компанию hco_cnt, а ССЧ считается по численности
-- строки. Первая версия запроса act_cd не знала: на таблицах нового ноутбука она показывала
-- «дубли узел × месяц × срез» и «ССЧ ≠» там, где их нет (две строки на срез — активная и
-- прочие). Теперь act_cd и hco_cnt — матчером, как в файле 2а: есть колонка — проверка по ней,
-- нет (ноутбук до 20.10) — как раньше. Добавлено: тип численности у корня и сходимость
-- водопада с начала года отдельно по активной и по всей численности.
-- 22.10, поставка 60: act_cd — тип численности целиком (Активная, Подрядчики, Декрет…). Поставка 61: «активная»
-- в запросе — тип «Активная», без подрядчиков, как в отчёте по умолчанию.
--
-- Зачем. Разведка 19.10 восстановила схему таблиц по SQL датасета 174609 (файл 2а): число
-- строк, физические типы и период оттуда не видны, а в каталоге DataDetective таблиц нет.
-- Запрос проверяет на самих таблицах то, что ноутбук обещает:
--   1 meta     — последний месяц (с поставки 46 — и текущий незакрытый), сетка, когда собраны таблицы (built_at), версия;
--   2 типы     — физический тип каждой колонки, есть ли head_login;
--   3 дерево   — узлы по уровням, корни, родитель без узла, путь против уровня и ключа,
--                число детей, логины руководителей;
--   4 ряды     — строки и месяцы series, месяцы вне сетки, узлы без справочника, дубли,
--                значения покраски / IT / штата / типа численности, численность компании по
--                месяцам, активная ≤ общей, regret ≤ увольнений, ССЧ = (численность + прошлый
--                месяц) / 2, дети ≤ родителя, водопад у корня с начала года (активная и вся:
--                найм, отток, переводы — с поставки 49 из переходов teampulse_hub_trf, как в датасете
--                2а, «прочие изменения»), мониторинг, посещаемость, T-рост, переходы у корня;
--   5 разрезы  — каждый ключ mx_key: сколько строк и значений, доля пустых, сходится ли сумма с
--                series (численность — последний месяц, x* — увольнения с начала года).
--
-- ОТВЕТ МАСКИРОВАН, как 0б–0д: имён, ключей юнитов и логинов нет; численность — в промилле
-- (‰) от численности компании (корень, все срезы) в последнем месяце. Проверено на
-- ClickHouse 24.8 (таблицы ноутбука на синтетике stand/nb_tp20.py --hub, один и два корня,
-- с head_login и без, шесть настроек сервера, в том числе профиль боя). Каждая строка ответа
-- считается в своём FROM (SELECT … AS v0): без этого старый анализатор теряет скалярные
-- подзапросы во второй и следующих ветках UNION ALL.
-- ============================================================================
FROM
(
WITH
  cal AS (
    SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
           toInt64(ifNull(n_months, 0)) AS nm0, toInt64(ifNull(ytd_idx, 0)) AS iy0,
           ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d
    FROM prod_proteus.teampulse_hub_meta
    LIMIT 1
  ),
  -- head_login — матчером, в подзапросе без JOIN, как в файле 2а: нет колонки — пусто
  un AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt64(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm, toInt64(ifNull(kids_cnt, 0)) AS kd, ifNull(path_rk, '') AS pth,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd,
           length(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')])) AS hcol
    FROM prod_proteus.teampulse_hub_unit
  ),
  sr AS (
    SELECT ifNull(node_rk, '') AS u, ifNull(report_month, toDate('1970-01-01')) AS m,
           ifNull(paint_cd, '∅') AS pa, ifNull(it_cd, '∅') AS it, ifNull(staff_cd, '∅') AS st,
           toFloat64(ifNull(hc_cnt, 0)) AS hc, toFloat64(ifNull(act_cnt, 0)) AS ac, toFloat64(ifNull(avg_cnt, 0)) AS av,
           toFloat64(ifNull(hire_cnt, 0)) AS hi, toFloat64(ifNull(fire_cnt, 0)) AS fi, toFloat64(ifNull(reg_cnt, 0)) AS rg,
           toFloat64(ifNull(tin_cnt, 0)) AS ti, toFloat64(ifNull(tout_cnt, 0)) AS tt,
           toFloat64(ifNull(pnor_cnt, 0)) AS pn, toFloat64(ifNull(plow_cnt, 0)) AS pl,
           toFloat64(ifNull(phig_cnt, 0)) AS ph, toFloat64(ifNull(pgry_cnt, 0)) AS pg,
           toFloat64(ifNull(wday_amt, 0)) AS wd, toFloat64(ifNull(ovis_amt, 0)) AS ov,
           toFloat64(ifNull(gapr_cnt, 0)) AS ga, toFloat64(ifNull(gdec_cnt, 0)) AS gd,
           -- с 20.10: тип численности и найм в компанию; нет колонки — «∅» и найм как раньше
           ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)],
             CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') AS ty,
           ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hco_cnt$') APPLY(toFloat64)],
             [toFloat64(hire_cnt)]), 1), 0) AS hk
    FROM prod_proteus.teampulse_hub_series
  ),
  mx AS (
    SELECT ifNull(node_rk, '') AS u, ifNull(mx_key, '∅') AS k, ifNull(mx_val, '∅') AS v, toFloat64(ifNull(mx_n, 0)) AS n
    FROM prod_proteus.teampulse_hub_mix
  ),
  -- корень в последнем месяце, все срезы: знаменатель ‰; увольнения и regret с начала года
  co AS (
    SELECT sumIf(hc, m = (SELECT lm FROM cal)) AS H,
           sumIf(fi, m BETWEEN toStartOfYear((SELECT lm FROM cal)) AND (SELECT lm FROM cal)) AS F,
           sumIf(rg, m BETWEEN toStartOfYear((SELECT lm FROM cal)) AND (SELECT lm FROM cal)) AS RG
    FROM sr
    WHERE u = (SELECT r FROM cal)
  ),
  -- узел в последнем месяце (все срезы) и с начала года
  nl AS (
    SELECT u AS nu, sumIf(hc, m = (SELECT lm FROM cal)) AS nh, sumIf(ac, m = (SELECT lm FROM cal)) AS na,
           sumIf(fi, m BETWEEN toStartOfYear((SELECT lm FROM cal)) AND (SELECT lm FROM cal)) AS nf
    FROM sr
    GROUP BY u
  ),
  ml AS (SELECT u AS mu, k AS mk, sum(n) AS mn FROM mx GROUP BY u, k),
  -- переводы у корня с начала года — как их считает датасет 2а (с поставки 59 — правило мастер-отчёта):
  -- «Активная» без фильтров — строка «в» / «из» с типом «Активная» и флагом юнита или типа численности
  -- (выбран один тип — флаг типа засчитан как есть; кандидат и стажёр — найм, не
  -- перевод); вся численность — только флаг юнита
  tr AS (
    SELECT sum(toFloat64(ifNull(trf_cnt, 0)) * (ifNull(trf_kind, '') = 'i' AND ifNull(act_cd, '') = 'Активная'
             AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1)
             AND ifNull(in_ok, 1) = 1)) AS tai,
           sum(toFloat64(ifNull(trf_cnt, 0)) * (ifNull(trf_kind, '') = 'o' AND ifNull(act_cd, '') = 'Активная'
             AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1))) AS tao,
           sum(toFloat64(ifNull(trf_cnt, 0)) * (ifNull(trf_kind, '') = 'i' AND ifNull(fu, 0) = 1)) AS tvi,
           sum(toFloat64(ifNull(trf_cnt, 0)) * (ifNull(trf_kind, '') = 'o' AND ifNull(fu, 0) = 1)) AS tvo,
           count() AS tn, uniqExact(report_month) AS tmn,
           countIf(ifNull(trf_kind, '') = 'i') AS tki, countIf(ifNull(trf_kind, '') = 'o') AS tko, countIf(ifNull(trf_kind, '') = 'h') AS tks
    FROM prod_proteus.teampulse_hub_trf
    WHERE report_month BETWEEN toStartOfYear((SELECT lm FROM cal)) AND (SELECT lm FROM cal)
      AND node_rk = (SELECT r FROM cal)
  )

SELECT '1 meta' AS section, 1 AS ord, 'последний месяц · сетка с · месяцев · индекс января' AS item,
       v0 AS value
FROM (SELECT concat(toString((SELECT lm FROM cal)), ' · ', toString((SELECT m0 FROM cal)), ' · ', toString((SELECT nm0 FROM cal)),
              ' · ', toString((SELECT iy0 FROM cal))) AS v0)
UNION ALL
SELECT '1 meta' AS section, 2 AS ord, 'сегодня · дата данных (data_dt, с поставки 46) · собрано (built_at) · версия (schema_ver)' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(today()), ' · ',
                            ifNull(any(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^data_dt$') APPLY(toString)], CAST(['—'], 'Array(Nullable(String))')), 1)), '—'),
                            ' · ', ifNull(toString(any(built_at)), '—'), ' · ', ifNull(toString(any(schema_ver)), '—'))
        FROM prod_proteus.teampulse_hub_meta) AS v0)
UNION ALL
SELECT '1 meta' AS section, 3 AS ord, 'строк в meta (ждали 1)' AS item,
       v0 AS value
FROM (SELECT toString((SELECT count() FROM prod_proteus.teampulse_hub_meta)) AS v0)
UNION ALL
SELECT '1 meta' AS section, 4 AS ord, 'корень: общий «all» / свой юнит · детей у корня · юнит по умолчанию' AS item,
       v0 AS value
FROM (SELECT concat(if((SELECT r FROM cal) = 'all', 'общий «all»', 'свой юнит'), ' · ',
              toString((SELECT count() FROM un WHERE pid = (SELECT r FROM cal) AND id != '')), ' · ',
              multiIf((SELECT d FROM cal) = (SELECT r FROM cal), 'корень',
                      (SELECT count() FROM un WHERE id = (SELECT d FROM cal) AND pid = (SELECT r FROM cal)) > 0, 'ребёнок корня',
                      (SELECT count() FROM un WHERE id = (SELECT d FROM cal)) > 0, 'другой узел', 'НЕТ В unit')) AS v0)
UNION ALL
SELECT '2 типы' AS section, 1 AS ord, 'meta' AS item,
       v0 AS value
FROM (SELECT (SELECT concat('last_month ', toTypeName(last_month), ' · grid_start ', toTypeName(grid_start), ' · n_months ', toTypeName(n_months),
                      ' · ytd_idx ', toTypeName(ytd_idx), ' · root_rk ', toTypeName(root_rk), ' · def_rk ', toTypeName(def_rk))
        FROM prod_proteus.teampulse_hub_meta LIMIT 1) AS v0)
UNION ALL
SELECT '2 типы' AS section, 2 AS ord, 'unit' AS item,
       v0 AS value
FROM (SELECT (SELECT concat('unit_rk ', toTypeName(unit_rk), ' · parent_rk ', toTypeName(parent_rk), ' · unit_lvl ', toTypeName(unit_lvl),
                      ' · unit_nm ', toTypeName(unit_nm), ' · kids_cnt ', toTypeName(kids_cnt), ' · path_rk ', toTypeName(path_rk))
        FROM prod_proteus.teampulse_hub_unit LIMIT 1) AS v0)
UNION ALL
SELECT '2 типы' AS section, 3 AS ord, 'unit.head_login' AS item,
       v0 AS value
FROM (SELECT if((SELECT max(hcol) FROM un) > 0, 'есть', 'НЕТ (ноутбук до 19.10 — логины пустые)') AS v0)
UNION ALL
SELECT '2 типы' AS section, 4 AS ord, 'series: ключи и счётчики' AS item,
       v0 AS value
FROM (SELECT (SELECT concat('node_rk ', toTypeName(node_rk), ' · report_month ', toTypeName(report_month), ' · paint_cd ', toTypeName(paint_cd),
                      ' · it_cd ', toTypeName(it_cd), ' · staff_cd ', toTypeName(staff_cd), ' · hc_cnt ', toTypeName(hc_cnt),
                      ' · act_cnt ', toTypeName(act_cnt), ' · avg_cnt ', toTypeName(avg_cnt), ' · hire_cnt ', toTypeName(hire_cnt),
                      ' · fire_cnt ', toTypeName(fire_cnt), ' · reg_cnt ', toTypeName(reg_cnt), ' · tin_cnt ', toTypeName(tin_cnt),
                      ' · tout_cnt ', toTypeName(tout_cnt))
        FROM prod_proteus.teampulse_hub_series LIMIT 1) AS v0)
UNION ALL
SELECT '2 типы' AS section, 5 AS ord, 'series: мониторинг, посещаемость, T-рост' AS item,
       v0 AS value
FROM (SELECT (SELECT concat('pnor_cnt ', toTypeName(pnor_cnt), ' · plow_cnt ', toTypeName(plow_cnt), ' · phig_cnt ', toTypeName(phig_cnt),
                      ' · pgry_cnt ', toTypeName(pgry_cnt), ' · wday_amt ', toTypeName(wday_amt), ' · ovis_amt ', toTypeName(ovis_amt),
                      ' · gapr_cnt ', toTypeName(gapr_cnt), ' · gdec_cnt ', toTypeName(gdec_cnt))
        FROM prod_proteus.teampulse_hub_series LIMIT 1) AS v0)
UNION ALL
SELECT '2 типы' AS section, 6 AS ord, 'с 20.10: series.act_cd (тип численности) · series.hco_cnt (найм в компанию) · mix.act_cd' AS item,
       v0 AS value
FROM (SELECT concat(
        (SELECT if(length(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)])) > 0, 'есть', 'НЕТ')
         FROM prod_proteus.teampulse_hub_series LIMIT 1), ' · ',
        (SELECT if(length(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hco_cnt$') APPLY(toFloat64)])) > 0, 'есть', 'НЕТ')
         FROM prod_proteus.teampulse_hub_series LIMIT 1), ' · ',
        (SELECT if(length(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)])) > 0, 'есть', 'НЕТ')
         FROM prod_proteus.teampulse_hub_mix LIMIT 1)) AS v0)
UNION ALL
SELECT '2 типы' AS section, 7 AS ord, 'mix' AS item,
       v0 AS value
FROM (SELECT (SELECT concat('node_rk ', toTypeName(node_rk), ' · paint_cd ', toTypeName(paint_cd), ' · it_cd ', toTypeName(it_cd),
                      ' · staff_cd ', toTypeName(staff_cd), ' · mx_key ', toTypeName(mx_key), ' · mx_val ', toTypeName(mx_val),
                      ' · mx_n ', toTypeName(mx_n))
        FROM prod_proteus.teampulse_hub_mix LIMIT 1) AS v0)
UNION ALL
SELECT '3 дерево' AS section, 1 AS ord, 'узлов · разных ключей · пустых имён' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(count()), ' · ', toString(uniqExact(id)), ' · ', toString(countIf(nm = ''))) FROM un) AS v0)
UNION ALL
SELECT '3 дерево' AS section, 2 AS ord, 'узлов по уровням (уровень:узлов)' AS item,
       v0 AS value
FROM (SELECT (SELECT arrayStringConcat(arrayMap(x -> concat(toString(x.1), ':', toString(x.2)), arraySort(groupArray((l1, c1)))), ' ')
        FROM (SELECT lv AS l1, count() AS c1 FROM un GROUP BY lv)) AS v0)
UNION ALL
SELECT '3 дерево' AS section, 3 AS ord, 'корней (parent_rk пустой) · родитель не найден в unit' AS item,
       v0 AS value
FROM (SELECT concat(toString((SELECT count() FROM un WHERE pid = '')), ' · ',
              toString((SELECT count() FROM un WHERE pid != '' AND pid NOT IN (SELECT id FROM un)))) AS v0)
UNION ALL
SELECT '3 дерево' AS section, 4 AS ord, 'путь: последний ключ ≠ unit_rk · длина ≠ уровня · предпоследний ≠ parent_rk' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(countIf(arrayElement(splitByChar('|', pth), -1) != id)), ' · ',
                      toString(countIf(length(splitByChar('|', pth)) != lv)), ' · ',
                      toString(countIf(pid != '' AND arrayElement(splitByChar('|', pth), -2) != pid)))
        FROM un) AS v0)
UNION ALL
SELECT '3 дерево' AS section, 5 AS ord, 'kids_cnt не равно числу детей (узлов)' AS item,
       v0 AS value
FROM (SELECT toString((SELECT count() FROM un AS a LEFT JOIN (SELECT pid AS kp, count() AS kc FROM un WHERE pid != '' GROUP BY pid) AS b ON b.kp = a.id
                 WHERE a.kd != ifNull(b.kc, 0))) AS v0)
UNION ALL
SELECT '3 дерево' AS section, 6 AS ord, 'логин руководителя: заполнен у узлов · у узлов с людьми в последнем месяце' AS item,
       v0 AS value
FROM (SELECT concat(toString((SELECT countIf(hd != '') FROM un)), ' из ', toString((SELECT count() FROM un)), ' · ',
              toString((SELECT countIf(hd != '') FROM un WHERE id IN (SELECT nu FROM nl WHERE nh > 0))), ' из ',
              toString((SELECT count() FROM un WHERE id IN (SELECT nu FROM nl WHERE nh > 0)))) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 1 AS ord, 'строк series · месяцы с … по · разных месяцев' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(count()), ' · ', toString(min(m)), ' … ', toString(max(m)), ' · ', toString(uniqExact(m))) FROM sr) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 2 AS ord, 'строк позже последнего месяца · раньше сетки (датасет их не берёт)' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(countIf(m > (SELECT lm FROM cal))), ' · ', toString(countIf(m < (SELECT m0 FROM cal)))) FROM sr) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 3 AS ord, 'узлов series нет в unit · узлов unit без строк в последнем месяце' AS item,
       v0 AS value
FROM (SELECT concat(toString((SELECT uniqExact(u) FROM sr WHERE u NOT IN (SELECT id FROM un))), ' · ',
              toString((SELECT count() FROM un WHERE id NOT IN (SELECT u FROM sr WHERE m = (SELECT lm FROM cal))))) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 4 AS ord, 'дублей узел × месяц × срез × тип численности (ждали 0)' AS item,
       v0 AS value
FROM (SELECT toString((SELECT count() FROM (SELECT u, m, pa, it, st, ty FROM sr GROUP BY u, m, pa, it, st, ty HAVING count() > 1))) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 5 AS ord, 'покраска paint_cd: значение ‰ (последний месяц, корень)' AS item,
       v0 AS value
FROM (SELECT (SELECT arrayStringConcat(arrayMap(x -> concat(x.2, ' ', toString(x.1)), arrayReverseSort(groupArray((p1, v1)))), ' · ')
        FROM (SELECT pa AS v1, round(1000 * sum(hc) / nullIf((SELECT H FROM co), 0)) AS p1 FROM sr
              WHERE u = (SELECT r FROM cal) AND m = (SELECT lm FROM cal) GROUP BY pa)) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 6 AS ord, 'IT-код it_cd: значение ‰' AS item,
       v0 AS value
FROM (SELECT (SELECT arrayStringConcat(arrayMap(x -> concat(x.2, ' ', toString(x.1)), arrayReverseSort(groupArray((p1, v1)))), ' · ')
        FROM (SELECT it AS v1, round(1000 * sum(hc) / nullIf((SELECT H FROM co), 0)) AS p1 FROM sr
              WHERE u = (SELECT r FROM cal) AND m = (SELECT lm FROM cal) GROUP BY it)) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 7 AS ord, 'штат staff_cd: значение ‰' AS item,
       v0 AS value
FROM (SELECT (SELECT arrayStringConcat(arrayMap(x -> concat(x.2, ' ', toString(x.1)), arrayReverseSort(groupArray((p1, v1)))), ' · ')
        FROM (SELECT st AS v1, round(1000 * sum(hc) / nullIf((SELECT H FROM co), 0)) AS p1 FROM sr
              WHERE u = (SELECT r FROM cal) AND m = (SELECT lm FROM cal) GROUP BY st)) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 8 AS ord, 'тип численности act_cd: значение ‰ (∅ — колонки нет, ноутбук до 20.10)' AS item,
       v0 AS value
FROM (SELECT (SELECT arrayStringConcat(arrayMap(x -> concat(x.2, ' ', toString(x.1)), arrayReverseSort(groupArray((p1, v1)))), ' · ')
        FROM (SELECT ty AS v1, round(1000 * sum(hc) / nullIf((SELECT H FROM co), 0)) AS p1 FROM sr
              WHERE u = (SELECT r FROM cal) AND m = (SELECT lm FROM cal) GROUP BY ty)) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 9 AS ord, 'численность компании по месяцам сетки, ‰ последнего (месяц:‰)' AS item,
       v0 AS value
FROM (SELECT (SELECT arrayStringConcat(arrayMap(x -> concat(formatDateTime(x.1, '%y-%m'), ':', toString(x.2)), arraySort(groupArray((m1, p1)))), ' ')
        FROM (SELECT m AS m1, round(1000 * sum(hc) / nullIf((SELECT H FROM co), 0)) AS p1 FROM sr
              WHERE u = (SELECT r FROM cal) AND m BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal) GROUP BY m)) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 10 AS ord, 'строк: активная > общей · regret > увольнений · отрицательных мер' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(countIf(ac > hc + 0.001)), ' · ', toString(countIf(rg > fi + 0.001)), ' · ',
                      toString(countIf(least(hc, ac, av, hi, fi, rg, ti, tt, pn, pl, ph, pg, wd, ov, ga, gd) < 0)))
        FROM sr) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 11 AS ord, 'ССЧ последнего месяца ≠ (численность + прошлый месяц) / 2 (ноутбук с 20.10) · ≠ (активная + прошлый) / 2 (до 20.10): строк из' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(countIf(abs(a.av - (a.hc + ifNull(b.hc, 0)) / 2) > 0.01)), ' · ',
                      toString(countIf(abs(a.av - (a.ac + ifNull(b.ac, 0)) / 2) > 0.01)), ' из ', toString(count()))
        FROM (SELECT u, pa, it, st, ty, av, hc, ac FROM sr WHERE m = (SELECT lm FROM cal)) AS a
        LEFT JOIN (SELECT u AS bu, pa AS bpa, it AS bit, st AS bst, ty AS bty, hc, ac FROM sr WHERE m = addMonths((SELECT lm FROM cal), -1)) AS b
          ON b.bu = a.u AND b.bpa = a.pa AND b.bit = a.it AND b.bst = a.st AND b.bty = a.ty) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 12 AS ord, 'узлов, у которых дети вместе больше самого узла (последний месяц; ждали 0)' AS item,
       v0 AS value
FROM (SELECT toString((SELECT count() FROM
                   (SELECT un.pid AS pp, sum(nl.nh) AS kh FROM un INNER JOIN nl ON nl.nu = un.id WHERE un.pid != '' GROUP BY un.pid) AS k
                   INNER JOIN nl AS p ON p.nu = k.pp
                 WHERE k.kh > p.nh + 0.5)) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 13 AS ord, 'водопад у корня с начала года, «Активная»: изменение численности · найм · отток · переводы в · из · прочие изменения (‰; найм — по методологии, hire_cnt)' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(round(1000 * (sumIf(hc, m = (SELECT lm FROM cal)) - sumIf(hc, m = addMonths(toStartOfYear((SELECT lm FROM cal)), -1)))
                                     / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * sumIf(hi, m >= toStartOfYear((SELECT lm FROM cal))) / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * sumIf(fi, m >= toStartOfYear((SELECT lm FROM cal))) / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * (SELECT tai FROM tr) / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * (SELECT tao FROM tr) / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * (sumIf(hc, m = (SELECT lm FROM cal)) - sumIf(hc, m = addMonths(toStartOfYear((SELECT lm FROM cal)), -1))
                                             - sumIf(hi - fi, m >= toStartOfYear((SELECT lm FROM cal))) - (SELECT tai FROM tr) + (SELECT tao FROM tr))
                                     / nullIf((SELECT H FROM co), 0))))
        FROM sr WHERE u = (SELECT r FROM cal) AND m BETWEEN addMonths(toStartOfYear((SELECT lm FROM cal)), -1) AND (SELECT lm FROM cal) AND ty = 'Активная') AS v0)
UNION ALL
SELECT '4 ряды' AS section, 14 AS ord, 'водопад у корня с начала года, вся численность: изменение численности · найм · отток · переводы в · из · прочие изменения (‰; найм — в компанию, hco_cnt)' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(round(1000 * (sumIf(hc, m = (SELECT lm FROM cal)) - sumIf(hc, m = addMonths(toStartOfYear((SELECT lm FROM cal)), -1)))
                                     / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * sumIf(hk, m >= toStartOfYear((SELECT lm FROM cal))) / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * sumIf(fi, m >= toStartOfYear((SELECT lm FROM cal))) / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * (SELECT tvi FROM tr) / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * (SELECT tvo FROM tr) / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(1000 * (sumIf(hc, m = (SELECT lm FROM cal)) - sumIf(hc, m = addMonths(toStartOfYear((SELECT lm FROM cal)), -1))
                                             - sumIf(hk - fi, m >= toStartOfYear((SELECT lm FROM cal))) - (SELECT tvi FROM tr) + (SELECT tvo FROM tr))
                                     / nullIf((SELECT H FROM co), 0))))
        FROM sr WHERE u = (SELECT r FROM cal) AND m BETWEEN addMonths(toStartOfYear((SELECT lm FROM cal)), -1) AND (SELECT lm FROM cal)) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 16 AS ord, 'переводы (с поставки 59 — правило мастер-отчёта): строк у корня с начала года · месяцев · в / из / найм' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(tn), ' · ', toString(tmn), ' · ', toString(tki), ' / ', toString(tko), ' / ', toString(tks)) FROM tr) AS v0)
UNION ALL
SELECT '4 ряды' AS section, 15 AS ord, 'корень, последний месяц: норма + недоработка + переработка + Gray к численности ‰ · посещаемость % · T-рост одобрено %' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(round(1000 * sum(pn + pl + ph + pg) / nullIf((SELECT H FROM co), 0))), ' · ',
                      toString(round(100 * sum(ov) / nullIf(sum(wd), 0), 1)), ' · ',
                      toString(round(100 * sum(ga) / nullIf(sum(ga + gd), 0), 1)))
        FROM sr WHERE u = (SELECT r FROM cal) AND m = (SELECT lm FROM cal)) AS v0)
UNION ALL
SELECT '5 разрезы' AS section, 0 AS ord, 'ключи mx_key: всего строк mix · ключей' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(count()), ' · ', toString(uniqExact(k))) FROM mx) AS v0)
UNION ALL
SELECT '5 разрезы' AS section, 1 AS ord, concat(k1, ' — ', transform(k1,
         ['g', 'a', 't', 'gr', 's', 'c', 'o', 'w', 'r', 'xr', 'xq', 'xi', 'xp', 'xt', 'xg', 'xs'],
         ['пол', 'возраст', 'стаж', 'грейд', 'сеньорность', 'тип договора', 'юрлицо', 'стрим', 'тип отношений',
          'причина ухода', 'regret по причине', 'инициатива ухода', 'причина|инициатива', 'стаж ушедших', 'грейд ушедших', 'стрим ушедших'],
         'НЕИЗВЕСТНЫЙ КЛЮЧ')) AS item,
       concat('строк ', toString(c1), ' · значений ', toString(v1), ' · пустых ', toString(e1), '‰ · сумма у корня ', toString(s1),
              '‰ от ', multiIf(k1 = 'xq', 'regret с начала года', startsWith(k1, 'x'), 'увольнений с начала года', 'численности'),
              ' (ждали 1000)') AS value
FROM
(
  SELECT k AS k1, count() AS c1, uniqExact(v) AS v1,
         round(1000 * sumIf(n, u = (SELECT r FROM cal) AND v = '') / nullIf(sumIf(n, u = (SELECT r FROM cal)), 0)) AS e1,
         round(1000 * sumIf(n, u = (SELECT r FROM cal))
               / nullIf(multiIf(k = 'xq', (SELECT RG FROM co), startsWith(k, 'x'), (SELECT F FROM co), (SELECT H FROM co)), 0)) AS s1
  FROM mx
  GROUP BY k
)
UNION ALL
SELECT '5 разрезы' AS section, 90 AS ord, 'узлов, где пол (g) в сумме ≠ численности узла · причина (xr) ≠ увольнениям с начала года' AS item,
       v0 AS value
FROM (SELECT concat(toString((SELECT count() FROM nl LEFT JOIN (SELECT mu, mn FROM ml WHERE mk = 'g') AS g ON g.mu = nl.nu
                        WHERE abs(ifNull(g.mn, 0) - nl.nh) > 0.5)), ' · ',
              toString((SELECT count() FROM nl LEFT JOIN (SELECT mu, mn FROM ml WHERE mk = 'xr') AS x ON x.mu = nl.nu
                        WHERE abs(ifNull(x.mn, 0) - nl.nf) > 0.5))) AS v0)
)
ORDER BY section, ord, item

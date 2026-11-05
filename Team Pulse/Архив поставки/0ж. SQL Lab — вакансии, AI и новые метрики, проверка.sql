-- ============================================================================
-- 0ж. Проверка новых витрин поставки 50 (21.10) — SQL Lab Proteus, ClickHouse, запрос целиком.
-- Ответ — в чат. Что смотрим:
--   1 вакансии  teampulse_hub_vacancy: строки и месяцы; узлы вне справочника; у корня — открыто на
--               конец последнего месяца, закрыто и новые с начала года, средний срок закрытия, доля
--               закрытых джунами; статусы открытых, каналы закрытых — топ значений (‰ от открытых /
--               закрытых); корень = сумма детей (каждая вакансия — в одном юните)
--   2 AI        teampulse_hub_ai: строки и месяцы; узлы вне справочника; проникновение у корня и
--               по компании за последние месяцы; шкала проникновения (0–100 или 0–1?)
--   3 обычные   series.nreg_cnt: обычные (non-regrettable) увольнения у корня с начала года ‰ от всех
--               увольнений; строк, где обычных больше, чем всех (ждали 0)
--   4 разрезы   mix: специализации (sp), тип компании (tc), источник найма (hk), путь в команду (hch) —
--               сколько значений и сходится ли сумма с численностью / наймом у корня
-- Числа людей и вакансий — в промилле (‰) от численности компании в последнем месяце, как 0е.
-- Проверено на ClickHouse 24.8 (таблицы ноутбука на синтетике stand/nb_tp20.py --hub, шесть
-- настроек сервера). Каждая строка ответа считается в своём FROM (SELECT … AS v0), как 0е.
-- ============================================================================
SELECT section, item, value
FROM
(
WITH
  cal AS (
    SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0, ifNull(root_rk, '') AS r
    FROM prod_proteus.teampulse_hub_meta
    LIMIT 1
  ),
  un AS (SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid FROM prod_proteus.teampulse_hub_unit),
  co AS (
    SELECT sumIf(toFloat64(ifNull(hc_cnt, 0)), report_month = (SELECT lm FROM cal)) AS H
    FROM prod_proteus.teampulse_hub_series
    WHERE node_rk = (SELECT r FROM cal)
  ),
  vc AS (
    SELECT ifNull(node_rk, '') AS vu, toDate(assumeNotNull(report_month)) AS vm,
           ifNull(status, '') AS vs, ifNull(channel, '') AS vk, ifNull(cand_lvl, '') AS vq,
           toFloat64(ifNull(vac_open_cnt, 0)) AS vo, toFloat64(ifNull(vac_close_cnt, 0)) AS vcl,
           toFloat64(ifNull(vac_new_cnt, 0)) AS vn, toFloat64(ifNull(vac_ttf_days, 0)) AS vd, toFloat64(ifNull(vac_ttf_cnt, 0)) AS vt
    FROM prod_proteus.teampulse_hub_vacancy
  ),
  ai AS (
    SELECT ifNull(node_rk, '') AS au, toDate(assumeNotNull(report_month)) AS am,
           toFloat64(ifNull(ai_wau, 0)) AS aw, toFloat64(ifNull(ai_pen, 0)) AS ap, toFloat64(ifNull(ai_pen_co, 0)) AS ac
    FROM prod_proteus.teampulse_hub_ai
  )
SELECT '1 вакансии' AS section, 1 AS ord, 'строк · месяцы с … по · узлов · узлов нет в справочнике' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(count()), ' · ', toString(min(vm)), ' … ', toString(max(vm)), ' · ', toString(uniqExact(vu)), ' · ',
                            toString(uniqExactIf(vu, vu NOT IN (SELECT id FROM un))))
              FROM vc) AS v0)
UNION ALL
SELECT '1 вакансии' AS section, 2 AS ord, 'корень: открыто на конец последнего месяца · закрыто с начала года · новые с начала года (‰ от численности)' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(round(1000 * sumIf(vo, vm = (SELECT lm FROM cal)) / nullIf((SELECT H FROM co), 0))), ' · ',
                            toString(round(1000 * sumIf(vcl, vm >= toStartOfYear((SELECT lm FROM cal))) / nullIf((SELECT H FROM co), 0))), ' · ',
                            toString(round(1000 * sumIf(vn, vm >= toStartOfYear((SELECT lm FROM cal))) / nullIf((SELECT H FROM co), 0))))
              FROM vc WHERE vu = (SELECT r FROM cal)) AS v0)
UNION ALL
SELECT '1 вакансии' AS section, 3 AS ord, 'корень с начала года: средний срок закрытия, дн · доля закрытых джунами, %' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(round(sumIf(vd, vm >= toStartOfYear((SELECT lm FROM cal))) /
                                           nullIf(sumIf(vt, vm >= toStartOfYear((SELECT lm FROM cal))), 0), 1)), ' · ',
                            toString(round(100 * sumIf(vcl, vm >= toStartOfYear((SELECT lm FROM cal)) AND vq = 'Junior') /
                                           nullIf(sumIf(vcl, vm >= toStartOfYear((SELECT lm FROM cal))), 0), 1)))
              FROM vc WHERE vu = (SELECT r FROM cal)) AS v0)
UNION ALL
SELECT '1 вакансии' AS section, 4 AS ord, 'корень: статусы открытых на последний день (значение:‰ открытых)' AS item,
       v0 AS value
FROM (SELECT (SELECT arrayStringConcat(arraySlice(arrayMap(x -> concat(x.1, ':', toString(x.2)),
                         arrayReverseSort(x -> x.2, groupArray((s1, n1)))), 1, 8), ' ')
              FROM (SELECT vs AS s1, round(1000 * sum(vo) / nullIf((SELECT sum(vo) FROM vc WHERE vu = (SELECT r FROM cal)
                                                                    AND vm = (SELECT lm FROM cal) AND vs != ''), 0)) AS n1
                    FROM vc WHERE vu = (SELECT r FROM cal) AND vm = (SELECT lm FROM cal) AND vs != '' GROUP BY vs)) AS v0)
UNION ALL
SELECT '1 вакансии' AS section, 5 AS ord, 'корень: каналы закрытых с начала года (значение:‰ закрытых)' AS item,
       v0 AS value
FROM (SELECT (SELECT arrayStringConcat(arraySlice(arrayMap(x -> concat(x.1, ':', toString(x.2)),
                         arrayReverseSort(x -> x.2, groupArray((s1, n1)))), 1, 8), ' ')
              FROM (SELECT vk AS s1, round(1000 * sum(vcl) / nullIf((SELECT sum(vcl) FROM vc WHERE vu = (SELECT r FROM cal)
                                                                     AND vm >= toStartOfYear((SELECT lm FROM cal))), 0)) AS n1
                    FROM vc WHERE vu = (SELECT r FROM cal) AND vm >= toStartOfYear((SELECT lm FROM cal)) GROUP BY vk)) AS v0)
UNION ALL
SELECT '1 вакансии' AS section, 6 AS ord, 'узлов, где дети вместе больше узла (открыто, последний месяц; ждали 0)' AS item,
       v0 AS value
FROM (SELECT toString((SELECT count() FROM
        (SELECT un.pid AS pp, sum(o1) AS ko FROM un
         INNER JOIN (SELECT vu AS u1, sum(vo) AS o1 FROM vc WHERE vm = (SELECT lm FROM cal) GROUP BY vu) AS c ON c.u1 = un.id
         WHERE un.pid != '' GROUP BY un.pid) AS k
        INNER JOIN (SELECT vu AS u2, sum(vo) AS o2 FROM vc WHERE vm = (SELECT lm FROM cal) GROUP BY vu) AS p ON p.u2 = k.pp
        WHERE k.ko > p.o2 + 0.5)) AS v0)
UNION ALL
SELECT '2 AI' AS section, 1 AS ord, 'строк · месяцы с … по · узлов · узлов нет в справочнике' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(count()), ' · ', toString(min(am)), ' … ', toString(max(am)), ' · ', toString(uniqExact(au)), ' · ',
                            toString(uniqExactIf(au, au NOT IN (SELECT id FROM un))))
              FROM ai) AS v0)
UNION ALL
SELECT '2 AI' AS section, 2 AS ord, 'корень, последние 3 месяца: месяц — проникновение · по компании (как в источнике)' AS item,
       v0 AS value
FROM (SELECT (SELECT arrayStringConcat(groupArray(concat(toString(am), ' — ', toString(round(ap, 1)), ' · ', toString(round(ac, 1)))), ' | ')
              FROM (SELECT am, ap, ac FROM ai WHERE au = (SELECT r FROM cal) ORDER BY am DESC LIMIT 3)) AS v0)
UNION ALL
SELECT '2 AI' AS section, 3 AS ord, 'шкала проникновения: мин · макс (ждали 0…100; до 1 — источник в долях, нужна правка)' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(round(min(ap), 3)), ' · ', toString(round(max(ap), 3))) FROM ai) AS v0)
UNION ALL
SELECT '3 обычные' AS section, 1 AS ord, 'корень с начала года: обычные (non-regrettable) ‰ от всех увольнений · regrettable ‰ · строк, где обычных больше всех' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(
          toString(round(1000 * sumIf(toFloat64(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'),
                                  [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0)),
                                  node_rk = (SELECT r FROM cal) AND report_month >= toStartOfYear((SELECT lm FROM cal))) /
                     nullIf(sumIf(toFloat64(ifNull(fire_cnt, 0)), node_rk = (SELECT r FROM cal) AND report_month >= toStartOfYear((SELECT lm FROM cal))), 0))), ' · ',
          toString(round(1000 * sumIf(toFloat64(ifNull(reg_cnt, 0)), node_rk = (SELECT r FROM cal) AND report_month >= toStartOfYear((SELECT lm FROM cal))) /
                     nullIf(sumIf(toFloat64(ifNull(fire_cnt, 0)), node_rk = (SELECT r FROM cal) AND report_month >= toStartOfYear((SELECT lm FROM cal))), 0))), ' · ',
          toString(countIf(toFloat64(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'),
                                  [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0)) > toFloat64(ifNull(fire_cnt, 0)) + 0.5)))
        FROM prod_proteus.teampulse_hub_series) AS v0)
UNION ALL
SELECT '4 разрезы' AS section, 1 AS ord, 'корень: значений специализаций (sp) · типов компании (tc) · источников найма (hk) · путей в команду (hch)' AS item,
       v0 AS value
FROM (SELECT (SELECT concat(toString(uniqExactIf(mx_val, mx_key = 'sp')), ' · ', toString(uniqExactIf(mx_val, mx_key = 'tc')), ' · ',
                            toString(uniqExactIf(mx_val, mx_key = 'hk')), ' · ', toString(uniqExactIf(mx_val, mx_key = 'hch')))
              FROM prod_proteus.teampulse_hub_mix WHERE node_rk = (SELECT r FROM cal)) AS v0)
UNION ALL
SELECT '4 разрезы' AS section, 2 AS ord, 'корень: сумма sp − численность последнего месяца · сумма hk − найм с начала года (активная; ждали 0 · 0)' AS item,
       v0 AS value
FROM (SELECT concat(
        toString(round((SELECT sum(toFloat64(ifNull(mx_n, 0))) FROM prod_proteus.teampulse_hub_mix WHERE node_rk = (SELECT r FROM cal) AND mx_key = 'sp')
                       - (SELECT H FROM co))), ' · ',
        toString(round((SELECT sum(toFloat64(ifNull(mx_n, 0))) FROM prod_proteus.teampulse_hub_mix
                        WHERE node_rk = (SELECT r FROM cal) AND mx_key = 'hk' AND ifNull(act_cd, '') = 'Активная')
                       - (SELECT sum(toFloat64(ifNull(hire_cnt, 0))) FROM prod_proteus.teampulse_hub_series
                          WHERE node_rk = (SELECT r FROM cal) AND ifNull(act_cd, '') = 'Активная'
                            AND report_month >= toStartOfYear((SELECT lm FROM cal)))))) AS v0)
)
ORDER BY section, ord, item

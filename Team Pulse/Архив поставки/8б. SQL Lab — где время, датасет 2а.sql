-- ============================================================================
-- 8б. SQL Lab — где время: датасет TeamPulse Hub (файл 2). 7 блоков, каждый — один SELECT.
-- Как запускать: вставить файл в SQL Lab (база ClickHouse, где prod_proteus) → выделить мышью один блок
-- от строки «-- Блок N» до «;» → Run (с выделением запускается только оно) → записать время из строки
-- результата (например 00:00:04.21). Так по очереди все блоки, по порядку.
--   Повтор (если есть 5 минут): все блоки, кроме первого, ещё раз, заменив в первой строке блока «1 AS run»
--   на «2 AS run» — метка внутри запроса, иначе повтор может прийти из кеша.
--   Прислать: время каждого прогона (блок · прогон · секунды) и таблицы ответов (они маленькие: роль, строк,
--   КБ; в блоке 1 — версия, настройки, строки таблиц). Имён и чисел людей в ответах нет.
-- Что меряем: время ответа SQL Lab = разбор текста в SQL Lab + план ClickHouse + чтение.
--   2 против 3 и 4 против 5 — новый датасет против прежнего (--old) на одних данных и в одну сессию; строк
--   у ролей должно совпасть, КБ у нового меньше (поставка 109: fsm только за год, без tsm / xsm)
--   2 − 7  ≈ чтение таблиц (план у них одинаковый)     7 − 1  ≈ разбор текста и план
-- Стенд масштаба боя (stand/hub_scale.py: 11 932 узла, series 1,3 млн строк, ClickHouse 24.8), замер поставки 53:
--   компания, было       разбор текста Proteus  6,1 с · ClickHouse  4,5 с (из них план  3,8 с) · ответ  4,8 МБ
--   команда, было        разбор текста Proteus  6,2 с · ClickHouse  4,0 с (из них план  4,1 с) · ответ  1,8 МБ
--   команда + HQ, было   разбор текста Proteus  6,7 с · ClickHouse  4,3 с (из них план  4,3 с) · ответ  1,7 МБ
--   компания, стало      разбор текста Proteus  1,8 с · ClickHouse  1,2 с (из них план  0,7 с) · ответ  4,8 МБ
--   команда, стало       разбор текста Proteus  1,8 с · ClickHouse  1,0 с (из них план  0,8 с) · ответ  1,8 МБ
--   команда + HQ, стало  разбор текста Proteus  2,0 с · ClickHouse  1,0 с (из них план  0,8 с) · ответ  1,8 МБ
-- Команда в блоках 4–6 подбирается внутри запроса (узел 7-го уровня с наибольшим числом подразделений):
-- какая — в колонке scope. Только читает; собран stand/hub_timing.py из файла 2а.
-- ============================================================================

-- Блок 1 — версия, настройки, таблицы
SELECT 1 AS run, part, metric, value
FROM (
  SELECT '1 ClickHouse' AS part, 'версия' AS metric, version() AS value
  UNION ALL SELECT '1 ClickHouse', 'без перезапуска', formatReadableTimeDelta(uptime())
  UNION ALL SELECT '2 настройка', s.1, s.2 FROM (SELECT arrayJoin([
        ('allow_experimental_analyzer', toString(getSetting('allow_experimental_analyzer'))),
        ('max_threads', toString(getSetting('max_threads'))),
        ('max_execution_time', toString(getSetting('max_execution_time'))),
        ('max_memory_usage', toString(getSetting('max_memory_usage'))),
        ('max_memory_usage_for_user', toString(getSetting('max_memory_usage_for_user'))),
        ('max_bytes_before_external_group_by', toString(getSetting('max_bytes_before_external_group_by'))),
        ('max_concurrent_queries_for_user', toString(getSetting('max_concurrent_queries_for_user'))),
        ('max_result_bytes', toString(getSetting('max_result_bytes'))),
        ('use_uncompressed_cache', toString(getSetting('use_uncompressed_cache'))),
        ('use_query_cache', toString(getSetting('use_query_cache'))),
        ('load_balancing', toString(getSetting('load_balancing'))),
        ('readonly', toString(getSetting('readonly'))),
        ('prefer_column_name_to_alias', toString(getSetting('prefer_column_name_to_alias'))),
        ('join_use_nulls', toString(getSetting('join_use_nulls'))),
        ('group_by_use_nulls', toString(getSetting('group_by_use_nulls'))),
        ('max_query_size', toString(getSetting('max_query_size'))),
        ('max_parser_depth', toString(getSetting('max_parser_depth'))),
        ('max_ast_elements', toString(getSetting('max_ast_elements'))),
        ('max_expanded_ast_elements', toString(getSetting('max_expanded_ast_elements')))]) AS s)
  UNION ALL SELECT '3 таблица', 'teampulse_hub_meta', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_meta
  UNION ALL SELECT '3 таблица', 'teampulse_hub_unit', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_unit
  UNION ALL SELECT '3 таблица', 'teampulse_hub_series', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_series
  UNION ALL SELECT '3 таблица', 'teampulse_hub_mix', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_mix
  UNION ALL SELECT '3 таблица', 'teampulse_hub_trf', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_trf
  UNION ALL SELECT '3 таблица', 'teampulse_hub_vacancy', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_vacancy
  UNION ALL SELECT '3 таблица', 'teampulse_hub_ai', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_ai
)
ORDER BY part, metric
;

-- Блок 2 — компания (первое открытие)
SELECT 1 AS run, '2 компания' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
       any(if(role = 'scope', concat(id, ' · уровень ', toString(lvl), ' · подразделений ', toString(kids)), '')) AS scope
FROM (
SELECT role AS role, id AS id, pid AS pid, lvl AS lvl, nm AS nm, kids AS kids, j AS j, ms AS ms, mx AS mx 
FROM (SELECT role, id, pid, lvl, nm, kids, j, ms, mx
FROM
(
WITH
  cx0 AS (
    SELECT (lm, m0, n, r, d, dd, s,
            if(ok, arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                               arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3)), CAST([], 'Array(Tuple(String, UInt8))')),
            zr, ok, fl, an) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, fl,
             if(fl, [r], arrayMap(x -> x.1, arrayFilter(x -> x.4 = 'a.user' AND x.4 != '' AND x.1 != '', al))) AS zr,
             length(zr) > 0 AS ok,
             arrayDistinct(arrayFlatten(arrayMap(z -> splitByChar('|', arrayElement(arrayFilter(x -> x.1 = z, al), 1).3), zr))) AS an,
             if(0,
                '', if(fl, d, if(ok, zr[1], ''))) AS s,
             arrayMap(x -> x.1, arrayFilter(x -> x.2 = s AND x.1 != '', al)) AS d1,
             arrayMap(x -> x.1, arrayFilter(x -> has(d1, x.2), al)) AS d2,
             arrayMap(x -> x.1, arrayFilter(x -> has(d2, x.2), al)) AS d3
      FROM
      (
        SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
               toUInt32(ifNull(n_months, 0)) AS n, ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d,
               ifNull(toString(data_dt), '') AS dd
        FROM prod_proteus.teampulse_hub_meta
        LIMIT 1
      ) AS mt
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''), ifNull(path_rk, ''),
                                     lowerUTF8(trimBoth(ifNull(toString(head_login), ''))))) AS al
                  FROM prod_proteus.teampulse_hub_unit) AS ua
      CROSS JOIN (SELECT has(CAST([], 'Array(String)'), 'a.user') AS fl) AS fa
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, splitByChar('|', ifNull(path_rk, '')) AS ph,
           ifNull(toString(head_login), '') AS hd,
           replaceAll(replaceAll(ifNull(toString(head_nm), ''), char(9), ' '), char(10), ' ') AS hn
    FROM prod_proteus.teampulse_hub_unit
  ),
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, ifNull(toString(act_cd), '∅') AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
    FROM prod_proteus.teampulse_hub_series
    WHERE report_month = (SELECT lm FROM cx)
    GROUP BY u7, v7a, v7b, v7c, v7d
    HAVING n7 > 0
  ),
  fdv AS (
    SELECT (arraySort(groupUniqArray(v7a)), arraySort(groupUniqArray(v7b)), arraySort(groupUniqArray(v7c)),
            arraySort(groupUniqArray(v7d))) AS fv
    FROM fdb
  ),
  fdr AS (
    SELECT u7 AS fr,
           arrayStringConcat(arraySort(groupArray(concat(toString(toUInt32(
             (((indexOf(tupleElement((SELECT fv FROM fdv), 1), v7a) - 1) * length(tupleElement((SELECT fv FROM fdv), 2)) + indexOf(tupleElement((SELECT fv FROM fdv), 2), v7b) - 1)
              * length(tupleElement((SELECT fv FROM fdv), 3)) + indexOf(tupleElement((SELECT fv FROM fdv), 3), v7c) - 1)
             * length(tupleElement((SELECT fv FROM fdv), 4)) + indexOf(tupleElement((SELECT fv FROM fdv), 4), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  mj AS (
    SELECT concat('{"lm":"', toString((SELECT lm FROM cx)), '","m0":"', toString((SELECT m0 FROM cx)),
             '","n":', toString((SELECT n FROM cx)), ',"today":"', toString(today()),
             '","root":"', (SELECT r FROM cx), '","scope":"', (SELECT s FROM cx),
             '","def":"', (SELECT d FROM cx), '","ok":', toString(toUInt8((SELECT ok FROM cx))),
             ',"full":', toString(toUInt8((SELECT fl FROM cx))), ',"zone":', toJSONString((SELECT zr FROM cx)),
             ',"dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
             ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,fwday,fovis,vbk,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,hit,din,dout,hcd,hst,bk,bkv,vsv,hwd,hov,rh,nrh,avh,fh,hch,ab25,ab5,we25,we5,t23,t35,t5,hrs,hrn,tlk,gah,gdh,hrw,pdw,tkw,fbeg,fhire,ffire,ftin,ftout,ffin"',
             ',"req":', toJSONString(CAST([], 'Array(String)')),
             ',"paint":', toJSONString(CAST([], 'Array(String)')),
             ',"it":', toJSONString(CAST([], 'Array(String)')),
             ',"staff":', toJSONString(CAST([], 'Array(String)')),
             ',"act":', toJSONString(array('Активная')),
             ',"act_def":', toJSONString(array('Активная')),
             ',"vals":', (SELECT concat('{"paint":', toJSONString(groupArrayIf((v, e), g = 1)), ',"it":', toJSONString(groupArrayIf((v, e), g = 2)),
                 ',"staff":', toJSONString(groupArrayIf((v, e), g = 3)), ',"act":', toJSONString(groupArrayIf((v, e), g = 4)), '}')
  FROM (
    SELECT gv.1 AS g, gv.2 AS v, sum(ifNull(hc_cnt, 0)) AS e
    FROM prod_proteus.teampulse_hub_series
    ARRAY JOIN [(1, ifNull(paint_cd, '-')), (2, ifNull(it_cd, '-')), (3, ifNull(staff_cd, '-')), (4, ifNull(toString(act_cd), '∅'))] AS gv
    WHERE node_rk = (SELECT r FROM cx) AND report_month = (SELECT lm FROM cx)
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(pks), 1), ':d') FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = (SELECT s FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(n))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
      FROM cx
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, (SELECT n FROM cx) AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has((SELECT arrayMap(y -> y.1, pks) FROM cx), x), ph) AS mp
                FROM st2 WHERE has(ph, (SELECT s FROM cx))) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = (SELECT s FROM cx))
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = (SELECT lm FROM cx), toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, spx AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(toString(sp_cd), '') AS spx, toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)) AS th, toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AS ti, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND ifNull(fu, 0) = 1) AS tu,
               toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND NOT (ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AND (((fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS ci, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND NOT (ifNull(fu, 0) = 1) AND ((fu = 1 OR fa = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS co
        FROM prod_proteus.teampulse_hub_trf
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx)) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, 'fsm' AS k3, concat(kv.1, spx, '|', mo) AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y-%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear((SELECT lm FROM cx))) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = (SELECT lm FROM cx)) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip(['b|', 'h|', 'f|', 'i|', 'o|', 'e|'], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND ifNull(n, 0) > 0
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT (SELECT r FROM cx) AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT *
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j,
         '' AS ms, '' AS mx

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm, s.kd AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(pks) AS pe FROM cx)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, (SELECT s FROM cx) AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx
  FROM arh AS h
  WHERE (SELECT ok FROM cx)

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM (SELECT *, hasAny(ph, (SELECT zr FROM cx)) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE (SELECT ok FROM cx) AND (t.iz OR has((SELECT an FROM cx), t.id))

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS ms, '' AS mx
)
)
ORDER BY o, lvl, nm, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 3 — компания — прежний 2а
SELECT 1 AS run, '3 компания, прежний' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
       any(if(role = 'scope', concat(id, ' · уровень ', toString(lvl), ' · подразделений ', toString(kids)), '')) AS scope
FROM (
SELECT role AS role, id AS id, pid AS pid, lvl AS lvl, nm AS nm, kids AS kids, j AS j, ms AS ms, mx AS mx 
FROM (SELECT role, id, pid, lvl, nm, kids, j, ms, mx
FROM
(
WITH
  cx0 AS (
    SELECT (lm, m0, n, r, d, dd, s,
            if(ok, arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                               arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3)), CAST([], 'Array(Tuple(String, UInt8))')),
            zr, ok, fl, an) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, fl,
             if(fl, [r], arrayMap(x -> x.1, arrayFilter(x -> x.4 = 'a.user' AND x.4 != '' AND x.1 != '', al))) AS zr,
             length(zr) > 0 AS ok,
             arrayDistinct(arrayFlatten(arrayMap(z -> splitByChar('|', arrayElement(arrayFilter(x -> x.1 = z, al), 1).3), zr))) AS an,
             if(0,
                '', if(fl, d, if(ok, zr[1], ''))) AS s,
             arrayMap(x -> x.1, arrayFilter(x -> x.2 = s AND x.1 != '', al)) AS d1,
             arrayMap(x -> x.1, arrayFilter(x -> has(d1, x.2), al)) AS d2,
             arrayMap(x -> x.1, arrayFilter(x -> has(d2, x.2), al)) AS d3
      FROM
      (
        SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
               toUInt32(ifNull(n_months, 0)) AS n, ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d,
               ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^data_dt$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') AS dd
        FROM prod_proteus.teampulse_hub_meta
        LIMIT 1
      ) AS mt
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''), ifNull(path_rk, ''),
                                     lowerUTF8(trimBoth(arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))))))) AS al
                  FROM prod_proteus.teampulse_hub_unit) AS ua
      CROSS JOIN (SELECT has(CAST([], 'Array(String)'), 'a.user') AS fl) AS fa
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, splitByChar('|', ifNull(path_rk, '')) AS ph,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd,
           replaceAll(replaceAll(arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_nm$')]))), char(9), ' '), char(10), ' ') AS hn
    FROM prod_proteus.teampulse_hub_unit
  ),
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
    FROM prod_proteus.teampulse_hub_series
    WHERE report_month = (SELECT lm FROM cx)
    GROUP BY u7, v7a, v7b, v7c, v7d
    HAVING n7 > 0
  ),
  fdv AS (
    SELECT (arraySort(groupUniqArray(v7a)), arraySort(groupUniqArray(v7b)), arraySort(groupUniqArray(v7c)),
            arraySort(groupUniqArray(v7d))) AS fv
    FROM fdb
  ),
  fdr AS (
    SELECT u7 AS fr,
           arrayStringConcat(arraySort(groupArray(concat(toString(toUInt32(
             (((indexOf(tupleElement((SELECT fv FROM fdv), 1), v7a) - 1) * length(tupleElement((SELECT fv FROM fdv), 2)) + indexOf(tupleElement((SELECT fv FROM fdv), 2), v7b) - 1)
              * length(tupleElement((SELECT fv FROM fdv), 3)) + indexOf(tupleElement((SELECT fv FROM fdv), 3), v7c) - 1)
             * length(tupleElement((SELECT fv FROM fdv), 4)) + indexOf(tupleElement((SELECT fv FROM fdv), 4), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(array(sum(toFloat64(ifNull(hc_cnt, 0))), sum(toFloat64(ifNull(act_cnt, 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(pnor_cnt, 0))), sum(toFloat64(ifNull(plow_cnt, 0))), sum(toFloat64(ifNull(phig_cnt, 0))), sum(toFloat64(ifNull(pgry_cnt, 0))), sum(toFloat64(ifNull(wday_amt, 0))), sum(toFloat64(ifNull(ovis_amt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fwday_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fovis_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^vbk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(11, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^bk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^bkv_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^vsv_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hwd_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hov_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(5, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ab25_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ab5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^we25_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^we5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t23_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t35_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrs_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrn_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^tlk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrs_sum_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^plan_day_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^tlk_sum_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 1), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1)), 0)))), arrayWithConstant(17, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'h' OR (ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 0)), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^cv_k$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') = 'c'), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^cv_k$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') = 's'), 0)))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 1), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1)), 0)))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE ifNull(node_rk, '') IN (SELECT concat(tupleElement(arrayJoin(pks), 1), ':d') FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), array(sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), array(sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(hc_cnt, 0)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), array(sum(toFloat64(ifNull(vac_open_cnt, 0))), sum(toFloat64(ifNull(vac_close_cnt, 0))), sum(toFloat64(ifNull(vac_new_cnt, 0))), sum(toFloat64(ifNull(vac_ttf_days, 0))), sum(toFloat64(ifNull(vac_ttf_cnt, 0))), sum(toFloat64(ifNull(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0), 0)))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), array(sum(toFloat64(ifNull(beg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_unit$') APPLY(toFloat64)], [toFloat64(1)]), 1) = 1 OR NOT (lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_act_cd$') APPLY(toString)], ['']), 1)) IN ('активная')))), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_unit$') APPLY(toFloat64)], [toFloat64(1)]), 1) = 1 OR NOT (lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_act_cd$') APPLY(toString)], ['']), 1)) IN ('активная')))), 0))), sum(toFloat64(ifNull(fin_cnt, 0))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(array(sum(toFloat64(ifNull(hc_cnt, 0))), sum(toFloat64(ifNull(act_cnt, 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(pnor_cnt, 0))), sum(toFloat64(ifNull(plow_cnt, 0))), sum(toFloat64(ifNull(phig_cnt, 0))), sum(toFloat64(ifNull(pgry_cnt, 0))), sum(toFloat64(ifNull(wday_amt, 0))), sum(toFloat64(ifNull(ovis_amt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fwday_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fovis_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^vbk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(11, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^bk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^bkv_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^vsv_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hwd_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hov_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(5, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ab25_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ab5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^we25_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^we5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t23_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t35_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrs_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrn_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^tlk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrs_sum_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^plan_day_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^tlk_sum_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(6, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') = (SELECT s FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(n))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
      FROM cx
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, (SELECT n FROM cx) AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has((SELECT arrayMap(y -> y.1, pks) FROM cx), x), ph) AS mp
                FROM st2 WHERE has(ph, (SELECT s FROM cx))) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR ifNull(node_rk, '') = (SELECT s FROM cx))
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = (SELECT lm FROM cx), toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT node_rk, ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^sp_cd$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') AS spx, formatDateTime(report_month, '%Y-%m') AS mo, toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'h' OR (ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 0)) AS th, toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AS ti, toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND ifNull(fu, 0) = 1) AS tu,
               toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND NOT (ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AND (((ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 1) OR ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fsp$') APPLY(toFloat64)], [toFloat64(-1)]), 1), -1) = 1)) AS ci, toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND NOT (ifNull(fu, 0) = 1) AND ((ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1) OR ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fsp$') APPLY(toFloat64)], [toFloat64(-1)]), 1), -1) = 1)) AS co
        FROM prod_proteus.teampulse_hub_trf
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx)) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      )
      ARRAY JOIN [('tsh', spx, th), ('tsi', spx, ti), ('tso', spx, tu), ('tci', spx, ci), ('tco', spx, co),
                  ('tsm', concat('h|', spx, '|', mo), th), ('tsm', concat('i|', spx, '|', mo), ti), ('tsm', concat('o|', spx, '|', mo), tu),
                  ('tsm', concat('ci|', spx, '|', mo), ci), ('tsm', concat('co|', spx, '|', mo), co)] AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, 'fsm' AS k3, kv.1 AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y-%m') AS mo,
               toFloat64(ifNull(beg_cnt, 0)) AS vb, toFloat64(ifNull(hire_cnt, 0)) AS vh,
               toFloat64(ifNull(fire_cnt, 0)) AS vf, toFloat64(ifNull(tin_cnt, 0)) * toFloat64((arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_unit$') APPLY(toFloat64)], [toFloat64(1)]), 1) = 1 OR arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_sp$') APPLY(toFloat64)], [toFloat64(0)]), 1) = 1 OR NOT (lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_act_cd$') APPLY(toString)], ['']), 1)) IN ('активная')))) AS vi,
               toFloat64(ifNull(tout_cnt, 0)) * toFloat64((arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_unit$') APPLY(toFloat64)], [toFloat64(1)]), 1) = 1 OR arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_sp$') APPLY(toFloat64)], [toFloat64(0)]), 1) = 1 OR NOT (lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_act_cd$') APPLY(toString)], ['']), 1)) IN ('активная')))) AS vo, toFloat64(ifNull(fin_cnt, 0)) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN [(concat('b|', spx, '|', mo), vb), (concat('h|', spx, '|', mo), vh),
                  (concat('f|', spx, '|', mo), vf), (concat('i|', spx, '|', mo), vi),
                  (concat('o|', spx, '|', mo), vo), (concat('e|', spx, '|', mo), ve)] AS kv
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND ifNull(n, 0) > 0
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ttf_d$') APPLY(toFloat64)],
                                        CAST([NULL], 'Array(Nullable(Float64))')), 1) AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT (SELECT r FROM cx) AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT *
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         concat('{"lm":"', toString((SELECT lm FROM cx)), '","m0":"', toString((SELECT m0 FROM cx)),
                '","n":', toString((SELECT n FROM cx)), ',"today":"', toString(today()),
                '","root":"', (SELECT r FROM cx), '","scope":"', (SELECT s FROM cx),
                '","def":"', (SELECT d FROM cx), '","ok":', toString(toUInt8((SELECT ok FROM cx))),
                ',"full":', toString(toUInt8((SELECT fl FROM cx))), ',"zone":', toJSONString((SELECT zr FROM cx)),
                ',"dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
                ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,fwday,fovis,vbk,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,hit,din,dout,hcd,hst,bk,bkv,vsv,hwd,hov,rh,nrh,avh,fh,hch,ab25,ab5,we25,we5,t23,t35,t5,hrs,hrn,tlk,gah,gdh,hrw,pdw,tkw,fbeg,fhire,ffire,ftin,ftout,ffin"',
                ',"req":', toJSONString(CAST([], 'Array(String)')),
                ',"paint":', toJSONString(CAST([], 'Array(String)')),
                ',"it":', toJSONString(CAST([], 'Array(String)')),
                ',"staff":', toJSONString(CAST([], 'Array(String)')),
                ',"act":', toJSONString(array('Активная')),
                ',"act_def":', toJSONString(array('Активная')),
                ',"vals":', (SELECT concat('{"paint":', toJSONString(groupArrayIf((v, e), g = 1)), ',"it":', toJSONString(groupArrayIf((v, e), g = 2)),
                 ',"staff":', toJSONString(groupArrayIf((v, e), g = 3)), ',"act":', toJSONString(groupArrayIf((v, e), g = 4)), '}')
  FROM (
    SELECT gv.1 AS g, gv.2 AS v, sum(ifNull(hc_cnt, 0)) AS e
    FROM prod_proteus.teampulse_hub_series
    ARRAY JOIN [(1, ifNull(paint_cd, '-')), (2, ifNull(it_cd, '-')), (3, ifNull(staff_cd, '-')), (4, ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅'))] AS gv
    WHERE node_rk = (SELECT r FROM cx) AND report_month = (SELECT lm FROM cx)
    GROUP BY g, v ORDER BY e DESC, v)),
                ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
                ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
                ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS j,
         '' AS ms, '' AS mx

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm, s.kd AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(pks) AS pe FROM cx)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, (SELECT s FROM cx) AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx
  FROM arh AS h
  WHERE (SELECT ok FROM cx)

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM (SELECT *, hasAny(ph, (SELECT zr FROM cx)) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE (SELECT ok FROM cx) AND (t.iz OR has((SELECT an FROM cx), t.id))

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS ms, '' AS mx
)
)
ORDER BY o, lvl, nm, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 4 — команда + HQ
SELECT 1 AS run, '4 команда + HQ' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
       any(if(role = 'scope', concat(id, ' · уровень ', toString(lvl), ' · подразделений ', toString(kids)), '')) AS scope
FROM (
SELECT role AS role, id AS id, pid AS pid, lvl AS lvl, nm AS nm, kids AS kids, j AS j, ms AS ms, mx AS mx 
FROM (SELECT role, id, pid, lvl, nm, kids, j, ms, mx
FROM
(
WITH
  cx0 AS (
    SELECT (lm, m0, n, r, d, dd, s,
            if(ok, arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                               arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3)), CAST([], 'Array(Tuple(String, UInt8))')),
            zr, ok, fl, an) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, fl,
             if(fl, [r], arrayMap(x -> x.1, arrayFilter(x -> x.4 = 'a.user' AND x.4 != '' AND x.1 != '', al))) AS zr,
             length(zr) > 0 AS ok,
             arrayDistinct(arrayFlatten(arrayMap(z -> splitByChar('|', arrayElement(arrayFilter(x -> x.1 = z, al), 1).3), zr))) AS an,
             if(arrayExists(x -> x.1 = (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7) AND hasAny(splitByChar('|', x.3), zr), al),
                (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7), if(fl, d, if(ok, zr[1], ''))) AS s,
             arrayMap(x -> x.1, arrayFilter(x -> x.2 = s AND x.1 != '', al)) AS d1,
             arrayMap(x -> x.1, arrayFilter(x -> has(d1, x.2), al)) AS d2,
             arrayMap(x -> x.1, arrayFilter(x -> has(d2, x.2), al)) AS d3
      FROM
      (
        SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
               toUInt32(ifNull(n_months, 0)) AS n, ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d,
               ifNull(toString(data_dt), '') AS dd
        FROM prod_proteus.teampulse_hub_meta
        LIMIT 1
      ) AS mt
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''), ifNull(path_rk, ''),
                                     lowerUTF8(trimBoth(ifNull(toString(head_login), ''))))) AS al
                  FROM prod_proteus.teampulse_hub_unit) AS ua
      CROSS JOIN (SELECT has(CAST([], 'Array(String)'), 'a.user') AS fl) AS fa
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, splitByChar('|', ifNull(path_rk, '')) AS ph,
           ifNull(toString(head_login), '') AS hd,
           replaceAll(replaceAll(ifNull(toString(head_nm), ''), char(9), ' '), char(10), ' ') AS hn
    FROM prod_proteus.teampulse_hub_unit
  ),
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, ifNull(toString(act_cd), '∅') AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
    FROM prod_proteus.teampulse_hub_series
    WHERE report_month = (SELECT lm FROM cx)
    GROUP BY u7, v7a, v7b, v7c, v7d
    HAVING n7 > 0
  ),
  fdv AS (
    SELECT (arraySort(groupUniqArray(v7a)), arraySort(groupUniqArray(v7b)), arraySort(groupUniqArray(v7c)),
            arraySort(groupUniqArray(v7d))) AS fv
    FROM fdb
  ),
  fdr AS (
    SELECT u7 AS fr,
           arrayStringConcat(arraySort(groupArray(concat(toString(toUInt32(
             (((indexOf(tupleElement((SELECT fv FROM fdv), 1), v7a) - 1) * length(tupleElement((SELECT fv FROM fdv), 2)) + indexOf(tupleElement((SELECT fv FROM fdv), 2), v7b) - 1)
              * length(tupleElement((SELECT fv FROM fdv), 3)) + indexOf(tupleElement((SELECT fv FROM fdv), 3), v7c) - 1)
             * length(tupleElement((SELECT fv FROM fdv), 4)) + indexOf(tupleElement((SELECT fv FROM fdv), 4), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  mj AS (
    SELECT concat('{"lm":"', toString((SELECT lm FROM cx)), '","m0":"', toString((SELECT m0 FROM cx)),
             '","n":', toString((SELECT n FROM cx)), ',"today":"', toString(today()),
             '","root":"', (SELECT r FROM cx), '","scope":"', (SELECT s FROM cx),
             '","def":"', (SELECT d FROM cx), '","ok":', toString(toUInt8((SELECT ok FROM cx))),
             ',"full":', toString(toUInt8((SELECT fl FROM cx))), ',"zone":', toJSONString((SELECT zr FROM cx)),
             ',"dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
             ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,fwday,fovis,vbk,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,hit,din,dout,hcd,hst,bk,bkv,vsv,hwd,hov,rh,nrh,avh,fh,hch,ab25,ab5,we25,we5,t23,t35,t5,hrs,hrn,tlk,gah,gdh,hrw,pdw,tkw,fbeg,fhire,ffire,ftin,ftout,ffin"',
             ',"req":', toJSONString(array((SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7))),
             ',"paint":', toJSONString(array('HQ')),
             ',"it":', toJSONString(CAST([], 'Array(String)')),
             ',"staff":', toJSONString(CAST([], 'Array(String)')),
             ',"act":', toJSONString(array('Активная')),
             ',"act_def":', toJSONString(array('Активная')),
             ',"vals":', (SELECT concat('{"paint":', toJSONString(groupArrayIf((v, e), g = 1)), ',"it":', toJSONString(groupArrayIf((v, e), g = 2)),
                 ',"staff":', toJSONString(groupArrayIf((v, e), g = 3)), ',"act":', toJSONString(groupArrayIf((v, e), g = 4)), '}')
  FROM (
    SELECT gv.1 AS g, gv.2 AS v, sum(ifNull(hc_cnt, 0)) AS e
    FROM prod_proteus.teampulse_hub_series
    ARRAY JOIN [(1, ifNull(paint_cd, '-')), (2, ifNull(it_cd, '-')), (3, ifNull(staff_cd, '-')), (4, ifNull(toString(act_cd), '∅'))] AS gv
    WHERE node_rk = (SELECT r FROM cx) AND report_month = (SELECT lm FROM cx)
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fp = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fp = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(pks), 1), ':d') FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_paint_cd), '')) IN ('hq') AND lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_paint_cd), '')) IN ('hq') AND lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = (SELECT s FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(n))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
      FROM cx
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, (SELECT n FROM cx) AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has((SELECT arrayMap(y -> y.1, pks) FROM cx), x), ph) AS mp
                FROM st2 WHERE has(ph, (SELECT s FROM cx))) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = (SELECT s FROM cx))
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = (SELECT lm FROM cx), toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, spx AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(toString(sp_cd), '') AS spx, toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)) AS th, toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AS ti, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND ifNull(fu, 0) = 1) AS tu,
               toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND NOT (ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AND (((fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS ci, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND NOT (ifNull(fu, 0) = 1) AND ((fu = 1 OR fp = 1 OR fa = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS co
        FROM prod_proteus.teampulse_hub_trf
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx)) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, 'fsm' AS k3, concat(kv.1, spx, '|', mo) AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y-%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear((SELECT lm FROM cx))) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_paint_cd), '')) IN ('hq') AND lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_paint_cd), '')) IN ('hq') AND lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = (SELECT lm FROM cx)) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
          AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip(['b|', 'h|', 'f|', 'i|', 'o|', 'e|'], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND ifNull(n, 0) > 0
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT (SELECT r FROM cx) AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT *
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j,
         '' AS ms, '' AS mx

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm, s.kd AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(pks) AS pe FROM cx)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, (SELECT s FROM cx) AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx
  FROM arh AS h
  WHERE (SELECT ok FROM cx)

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM (SELECT *, hasAny(ph, (SELECT zr FROM cx)) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE (SELECT ok FROM cx) AND (t.iz OR has((SELECT an FROM cx), t.id))

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS ms, '' AS mx
)
)
ORDER BY o, lvl, nm, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 5 — команда + HQ — прежний 2а
SELECT 1 AS run, '5 команда + HQ, прежний' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
       any(if(role = 'scope', concat(id, ' · уровень ', toString(lvl), ' · подразделений ', toString(kids)), '')) AS scope
FROM (
SELECT role AS role, id AS id, pid AS pid, lvl AS lvl, nm AS nm, kids AS kids, j AS j, ms AS ms, mx AS mx 
FROM (SELECT role, id, pid, lvl, nm, kids, j, ms, mx
FROM
(
WITH
  cx0 AS (
    SELECT (lm, m0, n, r, d, dd, s,
            if(ok, arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                               arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3)), CAST([], 'Array(Tuple(String, UInt8))')),
            zr, ok, fl, an) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, fl,
             if(fl, [r], arrayMap(x -> x.1, arrayFilter(x -> x.4 = 'a.user' AND x.4 != '' AND x.1 != '', al))) AS zr,
             length(zr) > 0 AS ok,
             arrayDistinct(arrayFlatten(arrayMap(z -> splitByChar('|', arrayElement(arrayFilter(x -> x.1 = z, al), 1).3), zr))) AS an,
             if(arrayExists(x -> x.1 = (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7) AND hasAny(splitByChar('|', x.3), zr), al),
                (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7), if(fl, d, if(ok, zr[1], ''))) AS s,
             arrayMap(x -> x.1, arrayFilter(x -> x.2 = s AND x.1 != '', al)) AS d1,
             arrayMap(x -> x.1, arrayFilter(x -> has(d1, x.2), al)) AS d2,
             arrayMap(x -> x.1, arrayFilter(x -> has(d2, x.2), al)) AS d3
      FROM
      (
        SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
               toUInt32(ifNull(n_months, 0)) AS n, ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d,
               ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^data_dt$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') AS dd
        FROM prod_proteus.teampulse_hub_meta
        LIMIT 1
      ) AS mt
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''), ifNull(path_rk, ''),
                                     lowerUTF8(trimBoth(arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))))))) AS al
                  FROM prod_proteus.teampulse_hub_unit) AS ua
      CROSS JOIN (SELECT has(CAST([], 'Array(String)'), 'a.user') AS fl) AS fa
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, splitByChar('|', ifNull(path_rk, '')) AS ph,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd,
           replaceAll(replaceAll(arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_nm$')]))), char(9), ' '), char(10), ' ') AS hn
    FROM prod_proteus.teampulse_hub_unit
  ),
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
    FROM prod_proteus.teampulse_hub_series
    WHERE report_month = (SELECT lm FROM cx)
    GROUP BY u7, v7a, v7b, v7c, v7d
    HAVING n7 > 0
  ),
  fdv AS (
    SELECT (arraySort(groupUniqArray(v7a)), arraySort(groupUniqArray(v7b)), arraySort(groupUniqArray(v7c)),
            arraySort(groupUniqArray(v7d))) AS fv
    FROM fdb
  ),
  fdr AS (
    SELECT u7 AS fr,
           arrayStringConcat(arraySort(groupArray(concat(toString(toUInt32(
             (((indexOf(tupleElement((SELECT fv FROM fdv), 1), v7a) - 1) * length(tupleElement((SELECT fv FROM fdv), 2)) + indexOf(tupleElement((SELECT fv FROM fdv), 2), v7b) - 1)
              * length(tupleElement((SELECT fv FROM fdv), 3)) + indexOf(tupleElement((SELECT fv FROM fdv), 3), v7c) - 1)
             * length(tupleElement((SELECT fv FROM fdv), 4)) + indexOf(tupleElement((SELECT fv FROM fdv), 4), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(array(sum(toFloat64(ifNull(hc_cnt, 0))), sum(toFloat64(ifNull(act_cnt, 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(pnor_cnt, 0))), sum(toFloat64(ifNull(plow_cnt, 0))), sum(toFloat64(ifNull(phig_cnt, 0))), sum(toFloat64(ifNull(pgry_cnt, 0))), sum(toFloat64(ifNull(wday_amt, 0))), sum(toFloat64(ifNull(ovis_amt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fwday_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fovis_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^vbk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(11, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^bk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^bkv_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^vsv_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hwd_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hov_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(5, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ab25_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ab5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^we25_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^we5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t23_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t35_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrs_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrn_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^tlk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrs_sum_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^plan_day_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^tlk_sum_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 1), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND (ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1)), 0)))), arrayWithConstant(17, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'h' OR (ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 0)), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^cv_k$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') = 'c'), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^cv_k$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') = 's'), 0)))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 1), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND (ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1)), 0)))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE ifNull(node_rk, '') IN (SELECT concat(tupleElement(arrayJoin(pks), 1), ':d') FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), array(sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), array(sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(hc_cnt, 0)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), array(sum(toFloat64(ifNull(vac_open_cnt, 0))), sum(toFloat64(ifNull(vac_close_cnt, 0))), sum(toFloat64(ifNull(vac_new_cnt, 0))), sum(toFloat64(ifNull(vac_ttf_days, 0))), sum(toFloat64(ifNull(vac_ttf_cnt, 0))), sum(toFloat64(ifNull(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0), 0)))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), array(sum(toFloat64(ifNull(beg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_unit$') APPLY(toFloat64)], [toFloat64(1)]), 1) = 1 OR NOT (lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_paint_cd$') APPLY(toString)], ['']), 1)) IN ('hq') AND lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_act_cd$') APPLY(toString)], ['']), 1)) IN ('активная')))), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_unit$') APPLY(toFloat64)], [toFloat64(1)]), 1) = 1 OR NOT (lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_paint_cd$') APPLY(toString)], ['']), 1)) IN ('hq') AND lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_act_cd$') APPLY(toString)], ['']), 1)) IN ('активная')))), 0))), sum(toFloat64(ifNull(fin_cnt, 0))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(array(sum(toFloat64(ifNull(hc_cnt, 0))), sum(toFloat64(ifNull(act_cnt, 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(pnor_cnt, 0))), sum(toFloat64(ifNull(plow_cnt, 0))), sum(toFloat64(ifNull(phig_cnt, 0))), sum(toFloat64(ifNull(pgry_cnt, 0))), sum(toFloat64(ifNull(wday_amt, 0))), sum(toFloat64(ifNull(ovis_amt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fwday_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fovis_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^vbk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(11, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^bk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^bkv_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^vsv_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hwd_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hov_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(5, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ab25_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ab5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^we25_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^we5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t23_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t35_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^t5_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrs_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrn_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^tlk_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hrs_sum_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^plan_day_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^tlk_sum_amt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(6, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') = (SELECT s FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(n))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
      FROM cx
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, (SELECT n FROM cx) AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has((SELECT arrayMap(y -> y.1, pks) FROM cx), x), ph) AS mp
                FROM st2 WHERE has(ph, (SELECT s FROM cx))) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR ifNull(node_rk, '') = (SELECT s FROM cx))
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = (SELECT lm FROM cx), toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT node_rk, ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^sp_cd$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') AS spx, formatDateTime(report_month, '%Y-%m') AS mo, toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'h' OR (ifNull(trf_kind, '') = 'i' AND (ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 0)) AS th, toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AS ti, toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND ifNull(fu, 0) = 1) AS tu,
               toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND NOT (ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AND (((ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1) AND ifNull(in_ok, 1) = 1) OR ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fsp$') APPLY(toFloat64)], [toFloat64(-1)]), 1), -1) = 1)) AS ci, toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND NOT (ifNull(fu, 0) = 1) AND ((ifNull(fu, 0) = 1 OR ifNull(fp, 0) = 1 OR ifNull(fa, 0) = 1) OR ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fsp$') APPLY(toFloat64)], [toFloat64(-1)]), 1), -1) = 1)) AS co
        FROM prod_proteus.teampulse_hub_trf
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx)) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      )
      ARRAY JOIN [('tsh', spx, th), ('tsi', spx, ti), ('tso', spx, tu), ('tci', spx, ci), ('tco', spx, co),
                  ('tsm', concat('h|', spx, '|', mo), th), ('tsm', concat('i|', spx, '|', mo), ti), ('tsm', concat('o|', spx, '|', mo), tu),
                  ('tsm', concat('ci|', spx, '|', mo), ci), ('tsm', concat('co|', spx, '|', mo), co)] AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, 'fsm' AS k3, kv.1 AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y-%m') AS mo,
               toFloat64(ifNull(beg_cnt, 0)) AS vb, toFloat64(ifNull(hire_cnt, 0)) AS vh,
               toFloat64(ifNull(fire_cnt, 0)) AS vf, toFloat64(ifNull(tin_cnt, 0)) * toFloat64((arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_unit$') APPLY(toFloat64)], [toFloat64(1)]), 1) = 1 OR arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_sp$') APPLY(toFloat64)], [toFloat64(0)]), 1) = 1 OR NOT (lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_paint_cd$') APPLY(toString)], ['']), 1)) IN ('hq') AND lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_act_cd$') APPLY(toString)], ['']), 1)) IN ('активная')))) AS vi,
               toFloat64(ifNull(tout_cnt, 0)) * toFloat64((arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_unit$') APPLY(toFloat64)], [toFloat64(1)]), 1) = 1 OR arrayElement(arrayConcat(CAST([], 'Array(Float64)'), [COLUMNS('^chg_sp$') APPLY(toFloat64)], [toFloat64(0)]), 1) = 1 OR NOT (lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_paint_cd$') APPLY(toString)], ['']), 1)) IN ('hq') AND lowerUTF8(arrayElement(arrayConcat(CAST([], 'Array(String)'), [COLUMNS('^oth_act_cd$') APPLY(toString)], ['']), 1)) IN ('активная')))) AS vo, toFloat64(ifNull(fin_cnt, 0)) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN [(concat('b|', spx, '|', mo), vb), (concat('h|', spx, '|', mo), vh),
                  (concat('f|', spx, '|', mo), vf), (concat('i|', spx, '|', mo), vi),
                  (concat('o|', spx, '|', mo), vo), (concat('e|', spx, '|', mo), ve)] AS kv
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND ifNull(n, 0) > 0
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^ttf_d$') APPLY(toFloat64)],
                                        CAST([NULL], 'Array(Nullable(Float64))')), 1) AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT (SELECT r FROM cx) AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT *
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         concat('{"lm":"', toString((SELECT lm FROM cx)), '","m0":"', toString((SELECT m0 FROM cx)),
                '","n":', toString((SELECT n FROM cx)), ',"today":"', toString(today()),
                '","root":"', (SELECT r FROM cx), '","scope":"', (SELECT s FROM cx),
                '","def":"', (SELECT d FROM cx), '","ok":', toString(toUInt8((SELECT ok FROM cx))),
                ',"full":', toString(toUInt8((SELECT fl FROM cx))), ',"zone":', toJSONString((SELECT zr FROM cx)),
                ',"dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
                ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,fwday,fovis,vbk,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,hit,din,dout,hcd,hst,bk,bkv,vsv,hwd,hov,rh,nrh,avh,fh,hch,ab25,ab5,we25,we5,t23,t35,t5,hrs,hrn,tlk,gah,gdh,hrw,pdw,tkw,fbeg,fhire,ffire,ftin,ftout,ffin"',
                ',"req":', toJSONString(array((SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7))),
                ',"paint":', toJSONString(array('HQ')),
                ',"it":', toJSONString(CAST([], 'Array(String)')),
                ',"staff":', toJSONString(CAST([], 'Array(String)')),
                ',"act":', toJSONString(array('Активная')),
                ',"act_def":', toJSONString(array('Активная')),
                ',"vals":', (SELECT concat('{"paint":', toJSONString(groupArrayIf((v, e), g = 1)), ',"it":', toJSONString(groupArrayIf((v, e), g = 2)),
                 ',"staff":', toJSONString(groupArrayIf((v, e), g = 3)), ',"act":', toJSONString(groupArrayIf((v, e), g = 4)), '}')
  FROM (
    SELECT gv.1 AS g, gv.2 AS v, sum(ifNull(hc_cnt, 0)) AS e
    FROM prod_proteus.teampulse_hub_series
    ARRAY JOIN [(1, ifNull(paint_cd, '-')), (2, ifNull(it_cd, '-')), (3, ifNull(staff_cd, '-')), (4, ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅'))] AS gv
    WHERE node_rk = (SELECT r FROM cx) AND report_month = (SELECT lm FROM cx)
    GROUP BY g, v ORDER BY e DESC, v)),
                ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
                ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
                ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS j,
         '' AS ms, '' AS mx

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm, s.kd AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(pks) AS pe FROM cx)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, (SELECT s FROM cx) AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx
  FROM arh AS h
  WHERE (SELECT ok FROM cx)

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM (SELECT *, hasAny(ph, (SELECT zr FROM cx)) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE (SELECT ok FROM cx) AND (t.iz OR has((SELECT an FROM cx), t.id))

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS ms, '' AS mx
)
)
ORDER BY o, lvl, nm, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 6 — команда
SELECT 1 AS run, '6 команда' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
       any(if(role = 'scope', concat(id, ' · уровень ', toString(lvl), ' · подразделений ', toString(kids)), '')) AS scope
FROM (
SELECT role AS role, id AS id, pid AS pid, lvl AS lvl, nm AS nm, kids AS kids, j AS j, ms AS ms, mx AS mx 
FROM (SELECT role, id, pid, lvl, nm, kids, j, ms, mx
FROM
(
WITH
  cx0 AS (
    SELECT (lm, m0, n, r, d, dd, s,
            if(ok, arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                               arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3)), CAST([], 'Array(Tuple(String, UInt8))')),
            zr, ok, fl, an) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, fl,
             if(fl, [r], arrayMap(x -> x.1, arrayFilter(x -> x.4 = 'a.user' AND x.4 != '' AND x.1 != '', al))) AS zr,
             length(zr) > 0 AS ok,
             arrayDistinct(arrayFlatten(arrayMap(z -> splitByChar('|', arrayElement(arrayFilter(x -> x.1 = z, al), 1).3), zr))) AS an,
             if(arrayExists(x -> x.1 = (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7) AND hasAny(splitByChar('|', x.3), zr), al),
                (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7), if(fl, d, if(ok, zr[1], ''))) AS s,
             arrayMap(x -> x.1, arrayFilter(x -> x.2 = s AND x.1 != '', al)) AS d1,
             arrayMap(x -> x.1, arrayFilter(x -> has(d1, x.2), al)) AS d2,
             arrayMap(x -> x.1, arrayFilter(x -> has(d2, x.2), al)) AS d3
      FROM
      (
        SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
               toUInt32(ifNull(n_months, 0)) AS n, ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d,
               ifNull(toString(data_dt), '') AS dd
        FROM prod_proteus.teampulse_hub_meta
        LIMIT 1
      ) AS mt
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''), ifNull(path_rk, ''),
                                     lowerUTF8(trimBoth(ifNull(toString(head_login), ''))))) AS al
                  FROM prod_proteus.teampulse_hub_unit) AS ua
      CROSS JOIN (SELECT has(CAST([], 'Array(String)'), 'a.user') AS fl) AS fa
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, splitByChar('|', ifNull(path_rk, '')) AS ph,
           ifNull(toString(head_login), '') AS hd,
           replaceAll(replaceAll(ifNull(toString(head_nm), ''), char(9), ' '), char(10), ' ') AS hn
    FROM prod_proteus.teampulse_hub_unit
  ),
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, ifNull(toString(act_cd), '∅') AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
    FROM prod_proteus.teampulse_hub_series
    WHERE report_month = (SELECT lm FROM cx)
    GROUP BY u7, v7a, v7b, v7c, v7d
    HAVING n7 > 0
  ),
  fdv AS (
    SELECT (arraySort(groupUniqArray(v7a)), arraySort(groupUniqArray(v7b)), arraySort(groupUniqArray(v7c)),
            arraySort(groupUniqArray(v7d))) AS fv
    FROM fdb
  ),
  fdr AS (
    SELECT u7 AS fr,
           arrayStringConcat(arraySort(groupArray(concat(toString(toUInt32(
             (((indexOf(tupleElement((SELECT fv FROM fdv), 1), v7a) - 1) * length(tupleElement((SELECT fv FROM fdv), 2)) + indexOf(tupleElement((SELECT fv FROM fdv), 2), v7b) - 1)
              * length(tupleElement((SELECT fv FROM fdv), 3)) + indexOf(tupleElement((SELECT fv FROM fdv), 3), v7c) - 1)
             * length(tupleElement((SELECT fv FROM fdv), 4)) + indexOf(tupleElement((SELECT fv FROM fdv), 4), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  mj AS (
    SELECT concat('{"lm":"', toString((SELECT lm FROM cx)), '","m0":"', toString((SELECT m0 FROM cx)),
             '","n":', toString((SELECT n FROM cx)), ',"today":"', toString(today()),
             '","root":"', (SELECT r FROM cx), '","scope":"', (SELECT s FROM cx),
             '","def":"', (SELECT d FROM cx), '","ok":', toString(toUInt8((SELECT ok FROM cx))),
             ',"full":', toString(toUInt8((SELECT fl FROM cx))), ',"zone":', toJSONString((SELECT zr FROM cx)),
             ',"dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
             ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,fwday,fovis,vbk,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,hit,din,dout,hcd,hst,bk,bkv,vsv,hwd,hov,rh,nrh,avh,fh,hch,ab25,ab5,we25,we5,t23,t35,t5,hrs,hrn,tlk,gah,gdh,hrw,pdw,tkw,fbeg,fhire,ffire,ftin,ftout,ffin"',
             ',"req":', toJSONString(array((SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7))),
             ',"paint":', toJSONString(CAST([], 'Array(String)')),
             ',"it":', toJSONString(CAST([], 'Array(String)')),
             ',"staff":', toJSONString(CAST([], 'Array(String)')),
             ',"act":', toJSONString(array('Активная')),
             ',"act_def":', toJSONString(array('Активная')),
             ',"vals":', (SELECT concat('{"paint":', toJSONString(groupArrayIf((v, e), g = 1)), ',"it":', toJSONString(groupArrayIf((v, e), g = 2)),
                 ',"staff":', toJSONString(groupArrayIf((v, e), g = 3)), ',"act":', toJSONString(groupArrayIf((v, e), g = 4)), '}')
  FROM (
    SELECT gv.1 AS g, gv.2 AS v, sum(ifNull(hc_cnt, 0)) AS e
    FROM prod_proteus.teampulse_hub_series
    ARRAY JOIN [(1, ifNull(paint_cd, '-')), (2, ifNull(it_cd, '-')), (3, ifNull(staff_cd, '-')), (4, ifNull(toString(act_cd), '∅'))] AS gv
    WHERE node_rk = (SELECT r FROM cx) AND report_month = (SELECT lm FROM cx)
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(pks), 1), ':d') FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = (SELECT s FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(n))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
      FROM cx
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, (SELECT n FROM cx) AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has((SELECT arrayMap(y -> y.1, pks) FROM cx), x), ph) AS mp
                FROM st2 WHERE has(ph, (SELECT s FROM cx))) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = (SELECT s FROM cx))
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = (SELECT lm FROM cx), toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, spx AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(toString(sp_cd), '') AS spx, toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)) AS th, toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AS ti, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND ifNull(fu, 0) = 1) AS tu,
               toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND NOT (ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AND (((fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS ci, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND NOT (ifNull(fu, 0) = 1) AND ((fu = 1 OR fa = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS co
        FROM prod_proteus.teampulse_hub_trf
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx)) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, 'fsm' AS k3, concat(kv.1, spx, '|', mo) AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y-%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear((SELECT lm FROM cx))) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = (SELECT lm FROM cx)) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip(['b|', 'h|', 'f|', 'i|', 'o|', 'e|'], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND ifNull(n, 0) > 0
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT (SELECT r FROM cx) AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT *
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j,
         '' AS ms, '' AS mx

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm, s.kd AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(pks) AS pe FROM cx)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, (SELECT s FROM cx) AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx
  FROM arh AS h
  WHERE (SELECT ok FROM cx)

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM (SELECT *, hasAny(ph, (SELECT zr FROM cx)) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE (SELECT ok FROM cx) AND (t.iz OR has((SELECT an FROM cx), t.id))

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS ms, '' AS mx
)
)
ORDER BY o, lvl, nm, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 7 — компания, таблицы фактов пустые — только разбор и план
SELECT 1 AS run, '7 только план' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
       any(if(role = 'scope', concat(id, ' · уровень ', toString(lvl), ' · подразделений ', toString(kids)), '')) AS scope
FROM (
SELECT role AS role, id AS id, pid AS pid, lvl AS lvl, nm AS nm, kids AS kids, j AS j, ms AS ms, mx AS mx 
FROM (SELECT role, id, pid, lvl, nm, kids, j, ms, mx
FROM
(
WITH
  cx0 AS (
    SELECT (lm, m0, n, r, d, dd, s,
            if(ok, arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                               arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3)), CAST([], 'Array(Tuple(String, UInt8))')),
            zr, ok, fl, an) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, fl,
             if(fl, [r], arrayMap(x -> x.1, arrayFilter(x -> x.4 = 'a.user' AND x.4 != '' AND x.1 != '', al))) AS zr,
             length(zr) > 0 AS ok,
             arrayDistinct(arrayFlatten(arrayMap(z -> splitByChar('|', arrayElement(arrayFilter(x -> x.1 = z, al), 1).3), zr))) AS an,
             if(0,
                '', if(fl, d, if(ok, zr[1], ''))) AS s,
             arrayMap(x -> x.1, arrayFilter(x -> x.2 = s AND x.1 != '', al)) AS d1,
             arrayMap(x -> x.1, arrayFilter(x -> has(d1, x.2), al)) AS d2,
             arrayMap(x -> x.1, arrayFilter(x -> has(d2, x.2), al)) AS d3
      FROM
      (
        SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
               toUInt32(ifNull(n_months, 0)) AS n, ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d,
               ifNull(toString(data_dt), '') AS dd
        FROM prod_proteus.teampulse_hub_meta
        LIMIT 1
      ) AS mt
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''), ifNull(path_rk, ''),
                                     lowerUTF8(trimBoth(ifNull(toString(head_login), ''))))) AS al
                  FROM prod_proteus.teampulse_hub_unit) AS ua
      CROSS JOIN (SELECT has(CAST([], 'Array(String)'), 'a.user') AS fl) AS fa
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, splitByChar('|', ifNull(path_rk, '')) AS ph,
           ifNull(toString(head_login), '') AS hd,
           replaceAll(replaceAll(ifNull(toString(head_nm), ''), char(9), ' '), char(10), ' ') AS hn
    FROM prod_proteus.teampulse_hub_unit
  ),
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, ifNull(toString(act_cd), '∅') AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
    FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0)
    WHERE report_month = (SELECT lm FROM cx)
    GROUP BY u7, v7a, v7b, v7c, v7d
    HAVING n7 > 0
  ),
  fdv AS (
    SELECT (arraySort(groupUniqArray(v7a)), arraySort(groupUniqArray(v7b)), arraySort(groupUniqArray(v7c)),
            arraySort(groupUniqArray(v7d))) AS fv
    FROM fdb
  ),
  fdr AS (
    SELECT u7 AS fr,
           arrayStringConcat(arraySort(groupArray(concat(toString(toUInt32(
             (((indexOf(tupleElement((SELECT fv FROM fdv), 1), v7a) - 1) * length(tupleElement((SELECT fv FROM fdv), 2)) + indexOf(tupleElement((SELECT fv FROM fdv), 2), v7b) - 1)
              * length(tupleElement((SELECT fv FROM fdv), 3)) + indexOf(tupleElement((SELECT fv FROM fdv), 3), v7c) - 1)
             * length(tupleElement((SELECT fv FROM fdv), 4)) + indexOf(tupleElement((SELECT fv FROM fdv), 4), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  mj AS (
    SELECT concat('{"lm":"', toString((SELECT lm FROM cx)), '","m0":"', toString((SELECT m0 FROM cx)),
             '","n":', toString((SELECT n FROM cx)), ',"today":"', toString(today()),
             '","root":"', (SELECT r FROM cx), '","scope":"', (SELECT s FROM cx),
             '","def":"', (SELECT d FROM cx), '","ok":', toString(toUInt8((SELECT ok FROM cx))),
             ',"full":', toString(toUInt8((SELECT fl FROM cx))), ',"zone":', toJSONString((SELECT zr FROM cx)),
             ',"dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
             ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,fwday,fovis,vbk,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,hit,din,dout,hcd,hst,bk,bkv,vsv,hwd,hov,rh,nrh,avh,fh,hch,ab25,ab5,we25,we5,t23,t35,t5,hrs,hrn,tlk,gah,gdh,hrw,pdw,tkw,fbeg,fhire,ffire,ftin,ftout,ffin"',
             ',"req":', toJSONString(CAST([], 'Array(String)')),
             ',"paint":', toJSONString(CAST([], 'Array(String)')),
             ',"it":', toJSONString(CAST([], 'Array(String)')),
             ',"staff":', toJSONString(CAST([], 'Array(String)')),
             ',"act":', toJSONString(array('Активная')),
             ',"act_def":', toJSONString(array('Активная')),
             ',"vals":', (SELECT concat('{"paint":', toJSONString(groupArrayIf((v, e), g = 1)), ',"it":', toJSONString(groupArrayIf((v, e), g = 2)),
                 ',"staff":', toJSONString(groupArrayIf((v, e), g = 3)), ',"act":', toJSONString(groupArrayIf((v, e), g = 4)), '}')
  FROM (
    SELECT gv.1 AS g, gv.2 AS v, sum(ifNull(hc_cnt, 0)) AS e
    FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0)
    ARRAY JOIN [(1, ifNull(paint_cd, '-')), (2, ifNull(it_cd, '-')), (3, ifNull(staff_cd, '-')), (4, ifNull(toString(act_cd), '∅'))] AS gv
    WHERE node_rk = (SELECT r FROM cx) AND report_month = (SELECT lm FROM cx)
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0)
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0)
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0)
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(pks), 1), ':d') FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0)
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0)
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0)
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_flow WHERE 0)
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0)
      WHERE node_rk = (SELECT s FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(n))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
      FROM cx
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, (SELECT n FROM cx) AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM (SELECT * FROM prod_proteus.teampulse_hub_prof WHERE 0) AS p
    INNER JOIN (SELECT id, arrayLast(x -> has((SELECT arrayMap(y -> y.1, pks) FROM cx), x), ph) AS mp
                FROM st2 WHERE has(ph, (SELECT s FROM cx))) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM (SELECT * FROM prod_proteus.teampulse_hub_mix WHERE 0)
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = (SELECT s FROM cx))
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = (SELECT lm FROM cx), toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0)
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, spx AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(toString(sp_cd), '') AS spx, toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)) AS th, toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AS ti, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND ifNull(fu, 0) = 1) AS tu,
               toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND NOT (ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AND (((fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS ci, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND NOT (ifNull(fu, 0) = 1) AND ((fu = 1 OR fa = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS co
        FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0)
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx)) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, 'fsm' AS k3, concat(kv.1, spx, '|', mo) AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y-%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear((SELECT lm FROM cx))) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = (SELECT lm FROM cx)) AS ve
        FROM (SELECT * FROM prod_proteus.teampulse_hub_flow WHERE 0)
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip(['b|', 'h|', 'f|', 'i|', 'o|', 'e|'], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM (SELECT * FROM prod_proteus.teampulse_hub_aiw WHERE 0)
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx)
          AND week >= (SELECT addDays(max(week), -105) FROM (SELECT * FROM prod_proteus.teampulse_hub_aiw WHERE 0))
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM (SELECT * FROM prod_proteus.teampulse_hub_aix WHERE 0)
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND ifNull(n, 0) > 0
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0)
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT (SELECT r FROM cx) AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT *
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j,
         '' AS ms, '' AS mx

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm, s.kd AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(pks) AS pe FROM cx)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, (SELECT s FROM cx) AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx
  FROM arh AS h
  WHERE (SELECT ok FROM cx)

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM (SELECT *, hasAny(ph, (SELECT zr FROM cx)) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE (SELECT ok FROM cx) AND (t.iz OR has((SELECT an FROM cx), t.id))

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS ms, '' AS mx
)
)
ORDER BY o, lvl, nm, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

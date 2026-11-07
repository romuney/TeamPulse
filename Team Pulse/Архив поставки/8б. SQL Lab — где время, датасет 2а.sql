-- ============================================================================
-- 8б. SQL Lab — где время: датасет TeamPulse Hub (файл 2). 13 блоков, каждый — один SELECT.
-- Как запускать: вставить файл в SQL Lab (база ClickHouse, где prod_proteus) → выделить мышью один блок
-- от строки «-- Блок N» до «;» → Run (с выделением запускается только оно) → записать время из строки
-- результата (например 00:00:04.21). Так по очереди все блоки, по порядку.
--   Повтор (если есть 5 минут): все блоки, кроме первого, ещё раз, заменив в первой строке блока «1 AS run»
--   на «2 AS run» — метка внутри запроса, иначе повтор может прийти из кеша.
--   Прислать: время каждого прогона (блок · прогон · секунды) и таблицы ответов (они маленькие: роль, строк,
--   КБ; в блоке 1 — версия, настройки, строки таблиц). Имён и чисел людей в ответах нет.
-- Что меряем: время ответа SQL Lab = разбор текста в SQL Lab + план ClickHouse + чтение.
--   4 и 6 против 2 — сколько добавляет выбор команды и фильтр
--   2 − 7  ≈ чтение таблиц (план у них одинаковый)     7 − 1  ≈ разбор текста и план
--   2 − N (N = 8…) ≈ цена одной части датасета: в блоке N чтение её таблиц заменено пустой выборкой, остальное как в 2
-- Стенд масштаба боя (stand/hub_scale.py: 11 932 узла, series 1,3 млн строк, ClickHouse 24.8), замер поставки 53:
--   компания, было       разбор текста Proteus  6,1 с · ClickHouse  4,5 с (из них план  3,8 с) · ответ  4,8 МБ
--   команда, было        разбор текста Proteus  6,2 с · ClickHouse  4,0 с (из них план  4,1 с) · ответ  1,8 МБ
--   команда + HQ, было   разбор текста Proteus  6,7 с · ClickHouse  4,3 с (из них план  4,3 с) · ответ  1,7 МБ
--   компания, стало      разбор текста Proteus  1,8 с · ClickHouse  1,2 с (из них план  0,7 с) · ответ  4,8 МБ
--   команда, стало       разбор текста Proteus  1,8 с · ClickHouse  1,0 с (из них план  0,8 с) · ответ  1,8 МБ
--   команда + HQ, стало  разбор текста Proteus  2,0 с · ClickHouse  1,0 с (из них план  0,8 с) · ответ  1,8 МБ
-- Команда в блоках 4–6 подбирается внутри запроса (узел 7-го уровня с наибольшим числом подразделений):
-- какая — в колонке scope. Только читает; собран stand/hub_timing.py из файла 2.
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
  UNION ALL SELECT '3 таблица', 'teampulse_hub_flow', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_flow
  UNION ALL SELECT '3 таблица', 'teampulse_hub_aiw', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_aiw
  UNION ALL SELECT '3 таблица', 'teampulse_hub_aix', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_aix
  UNION ALL SELECT '3 таблица', 'teampulse_hub_prof', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_prof
  UNION ALL SELECT '3 таблица', 'teampulse_hub_pfd', concat(toString(count()), ' строк · узлов кластера ', toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_pfd
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fp = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fp = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fp = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_paint_cd), '')) IN ('hq') AND lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_paint_cd), '')) IN ('hq') AND lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_paint_cd), '')) IN ('hq') AND lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_paint_cd), '')) IN ('hq') AND lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
    ARRAY JOIN [(1, ifNull(paint_cd, '-')), (2, ifNull(it_cd, '-')), (3, ifNull(staff_cd, '-')), (4, ifNull(toString(act_cd), '∅'))] AS gv
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0) AS teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0) AS teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0) AS teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_flow WHERE 0) AS teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM (SELECT * FROM prod_proteus.teampulse_hub_prof WHERE 0) AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM (SELECT * FROM prod_proteus.teampulse_hub_mix WHERE 0) AS teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0) AS teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, spx AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(toString(sp_cd), '') AS spx, toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)) AS th, toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AS ti, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND ifNull(fu, 0) = 1) AS tu,
               toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND NOT (ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AND (((fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS ci, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND NOT (ifNull(fu, 0) = 1) AND ((fu = 1 OR fa = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS co
        FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0) AS teampulse_hub_trf
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM (SELECT * FROM prod_proteus.teampulse_hub_flow WHERE 0) AS teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM (SELECT * FROM prod_proteus.teampulse_hub_aiw WHERE 0) AS teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM (SELECT * FROM prod_proteus.teampulse_hub_aiw WHERE 0) AS teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM (SELECT * FROM prod_proteus.teampulse_hub_aix WHERE 0) AS teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0) AS teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 8 — компания без части: медианы подразделений того же размера (peer)
SELECT 1 AS run, '8 без: медианы подразделений того же размера (peer)' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 9 — компания без части: переводы по специализациям в разрезах (fsm)
SELECT 1 AS run, '9 без: переводы по специализациям в разрезах (fsm)' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM (SELECT * FROM prod_proteus.teampulse_hub_flow WHERE 0) AS teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 10 — компания без части: AI: недели и разрезы (aw, aix)
SELECT 1 AS run, '10 без: AI: недели и разрезы (aw, aix)' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM (SELECT * FROM prod_proteus.teampulse_hub_aiw WHERE 0) AS teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM (SELECT * FROM prod_proteus.teampulse_hub_aiw WHERE 0) AS teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM (SELECT * FROM prod_proteus.teampulse_hub_aix WHERE 0) AS teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 11 — компания без части: разрезы состава (mix)
SELECT 1 AS run, '11 без: разрезы состава (mix)' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM (SELECT * FROM prod_proteus.teampulse_hub_mix WHERE 0) AS teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 12 — компания без части: прочие разрезы: вакансии, переводы, профили
SELECT 1 AS run, '12 без: прочие разрезы: вакансии, переводы, профили' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM (SELECT * FROM prod_proteus.teampulse_hub_prof WHERE 0) AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0) AS teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, spx AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, ifNull(toString(sp_cd), '') AS spx, toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)) AS th, toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AS ti, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND ifNull(fu, 0) = 1) AS tu,
               toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND NOT (ifNull(fu, 0) = 1 AND ifNull(in_ok, 1) = 1) AND (((fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS ci, toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND NOT (ifNull(fu, 0) = 1) AND ((fu = 1 OR fa = 1) OR ifNull(toFloat64(fsp), -1) = 1)) AS co
        FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0) AS teampulse_hub_trf
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0) AS teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM (SELECT * FROM prod_proteus.teampulse_hub_pfd WHERE 0) AS teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 13 — компания без части: ряды по месяцам (mm)
SELECT 1 AS run, '13 без: ряды по месяцам (mm)' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0) AS teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0) AS teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0) AS teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_flow WHERE 0) AS teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 14 — компания без части: числа окна выбора юнита (fdb)
SELECT 1 AS run, '14 без: числа окна выбора юнита (fdb)' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

-- Блок 15 — компания без части: ряд HQ (mh)
SELECT 1 AS run, '15 без: ряд HQ (mh)' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(ms) + length(mx)) / 1024) AS kb,
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
      CROSS JOIN (SELECT toUInt8(1) AS fl) AS fa
    )
  ),
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  pmc AS (
    SELECT if(dd = '' OR toDate(dd) >= toLastDayOfMonth(lm), lm, addMonths(lm, -1)) AS mc FROM cx
  ),
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(a) * 100 AS v_tm,
           sum(lo) / sum(al) * 100 AS v_uw, sum(hi) / sum(al) * 100 AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(ovis_amt) AS ov, sum(wday_amt) AS wd
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hc9 >= 1000, 4, hc9 >= 300, 3, hc9 >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (SELECT hc9, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                   ('office_att', v_oa)]) AS kv FROM pnv WHERE hc9 >= 30)
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
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
    WHERE report_month = cxlm
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
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
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
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v)),
             ',"fdv":{"paint":', toJSONString(tupleElement((SELECT fv FROM fdv), 1)), ',"it":', toJSONString(tupleElement((SELECT fv FROM fdv), 2)),
             ',"staff":', toJSONString(tupleElement((SELECT fv FROM fdv), 3)),
             ',"act":', toJSONString(if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), CAST([], 'Array(String)'), tupleElement((SELECT fv FROM fdv), 4))), '}}') AS mj0
  ),
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(pnor_cnt)), sum(toFloat64(plow_cnt)), sum(toFloat64(phig_cnt)), sum(toFloat64(pgry_cnt)), sum(toFloat64(wday_amt)), sum(toFloat64(ovis_amt)), sum(toFloat64(ifNull(toFloat64(fwday_amt), 0))), sum(toFloat64(ifNull(toFloat64(fovis_amt), 0))), sum(toFloat64(ifNull(toFloat64(vbk_amt), 0))), sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(11, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(bk_amt), 0))), sum(toFloat64(ifNull(toFloat64(bkv_amt), 0))), sum(toFloat64(ifNull(toFloat64(vsv_amt), 0))), sum(toFloat64(ifNull(toFloat64(hwd_amt), 0))), sum(toFloat64(ifNull(toFloat64(hov_amt), 0))))), arrayWithConstant(5, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(ab25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(ab5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we25_cnt), 0))), sum(toFloat64(ifNull(toFloat64(we5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t23_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t35_cnt), 0))), sum(toFloat64(ifNull(toFloat64(t5_cnt), 0))), sum(toFloat64(ifNull(toFloat64(hrs_amt), 0))), sum(toFloat64(ifNull(toFloat64(hrn_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_amt), 0))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(ifNull(toFloat64(hrs_sum_amt), 0))), sum(toFloat64(ifNull(toFloat64(plan_day_cnt), 0))), sum(toFloat64(ifNull(toFloat64(tlk_sum_amt), 0))))), arrayWithConstant(6, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(17, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'h' OR (trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0)))))), arrayWithConstant(2, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 'c'))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') = 's'))))), arrayWithConstant(31, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(27, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (fu = 1 OR fa = 1) AND ifNull(in_ok, 1) = 1))), sum(toFloat64(toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (fu = 1 OR fa = 1)))))), arrayWithConstant(33, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d')) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(51, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(gapr_cnt)), sum(toFloat64(gdec_cnt)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(36, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))), sum(toFloat64(avg_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(hc_cnt)))), arrayWithConstant(21, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(20, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(vac_open_cnt)), sum(toFloat64(vac_close_cnt)), sum(toFloat64(vac_new_cnt)), sum(toFloat64(vac_ttf_days)), sum(toFloat64(vac_ttf_cnt)), sum(toFloat64(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0))))), arrayWithConstant(36, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(56, toFloat64(0)), arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(beg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(toFloat64(ifNull(tin_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(toFloat64(ifNull(tout_cnt, 0)) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))))), sum(toFloat64(fin_cnt))))) AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant(62, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 63)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month)))) AS i6, arrayConcat(arrayMap(x -> ifNull(x, 0), array(sum(toFloat64(hc_cnt)), sum(toFloat64(act_cnt)), sum(toFloat64(avg_cnt)), sum(toFloat64(hire_cnt)), sum(toFloat64(fire_cnt)), sum(toFloat64(reg_cnt)), sum(toFloat64(ifNull(toFloat64(nreg_cnt), 0))))), arrayWithConstant(55, toFloat64(0))) AS a6
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0) AS teampulse_hub_series
      WHERE node_rk = cxs AND report_month BETWEEN cxm0 AND cxlm AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant(62, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, 63)) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arraySort(groupArray((k3, v3, n4))) AS ls,
           arrayStringConcat(arrayMap(i -> concat(if(i > 1 AND ls[i].1 = ls[i - 1].1, '', ls[i].1), '\t', ls[i].2, '\t',
                                                  toString(round(ls[i].3, 1))), arrayEnumerate(ls)), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')))
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR node_rk = cxs)
        AND ifNull(mx_key, '') != 'xsm'
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm)
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
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month >= toStartOfYear(cxlm) AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная'))
      )
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso', 'tci', 'tco'], [th, ti, tu, ci, co]) AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)) AS vb,
               toFloat64(hire_cnt) AS vh,
               toFloat64(fire_cnt) AS vf, toFloat64(tin_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vi,
               toFloat64(tout_cnt) * toFloat64((ifNull(toFloat64(chg_unit), toFloat64(1)) = 1 OR ifNull(toFloat64(chg_sp), toFloat64(0)) = 1 OR NOT (lowerUTF8(ifNull(toString(oth_act_cd), '')) IN ('активная')))) AS vo,
               toFloat64(fin_cnt) * (report_month = cxlm) AS ve
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm AND report_month >= toStartOfYear(cxlm)
          AND (ifNull(toString(act_cd), '∅') = '∅' OR lowerUTF8(ifNull(toString(act_cd), '∅')) IN ('активная')) AND ifNull(sp_cd, '-') <> '-'
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], [vb, vh, vf, vi, vo, ve]) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      UNION ALL
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1))
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      UNION ALL
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      UNION ALL
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT tupleElement(arrayJoin(cxpk), 1)) AND report_month BETWEEN cxm0 AND cxlm
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      UNION ALL
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= 40000
      UNION ALL
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND 40000
    )
    GROUP BY u3
  )
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta', j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  UNION ALL

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         ifNull(x.mxs, '') AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  LEFT JOIN mxr AS x ON x.mu = p.pn
  WHERE p.po <= 2 OR a.lv5 > 0

  UNION ALL
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok

  UNION ALL
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))

  UNION ALL
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, ms, mx
 LIMIT 50000
)
GROUP BY role
ORDER BY kb DESC
;

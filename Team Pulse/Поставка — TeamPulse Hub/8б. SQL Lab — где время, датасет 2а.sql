-- ============================================================================
-- 8б. SQL Lab — где время: датасет 2а (поставка 53). 7 блоков, каждый — один SELECT.
-- Как запускать: вставить файл в SQL Lab (база ClickHouse, где prod_proteus) → выделить мышью один блок
-- от строки «-- Блок N» до «;» → Run (с выделением запускается только оно) → записать время из строки
-- результата (например 00:00:04.21). Так по очереди все блоки, по порядку.
--   Повтор (если есть 5 минут): все блоки, кроме первого, ещё раз, заменив в первой строке блока «1 AS run»
--   на «2 AS run» — метка внутри запроса, иначе повтор может прийти из кеша.
--   Прислать: время каждого прогона (блок · прогон · секунды) и таблицы ответов (они маленькие: роль, строк,
--   КБ; в блоке 1 — версия, настройки, строки таблиц). Имён и чисел людей в ответах нет.
-- Что меряем: время ответа SQL Lab = разбор текста в SQL Lab + план ClickHouse + чтение.
--   2 против 3 и 4 против 5 — новый 2а против прежнего на одних данных и в одну сессию; ответы (строк, КБ)
--   должны совпасть, кроме разбивки КБ: метрики теперь в одной колонке
--   2 − 7  ≈ чтение таблиц (план у них одинаковый)     7 − 1  ≈ разбор текста и план
-- Стенд масштаба боя (stand/hub_scale.py: 11 932 узла, series 1,3 млн строк, ClickHouse 24.8):
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
            arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                        arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3))) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, d AS s,
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
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''))) AS al FROM prod_proteus.teampulse_hub_unit) AS ua
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd
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
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(array(sum(toFloat64(ifNull(hc_cnt, 0))), sum(toFloat64(ifNull(act_cnt, 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(pnor_cnt, 0))), sum(toFloat64(ifNull(plow_cnt, 0))), sum(toFloat64(ifNull(phig_cnt, 0))), sum(toFloat64(ifNull(pgry_cnt, 0))), sum(toFloat64(ifNull(wday_amt, 0))), sum(toFloat64(ifNull(ovis_amt, 0))), sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64((lowerUTF8(ifNull(t_act_cd, '')) IN ('активная')) AND (ifNull(trf_kind, '') = 'i' OR (ifNull(trf_kind, '') = 's' AND ifNull(in_ok, 0) = 1 AND NOT (lowerUTF8(ifNull(f_act_cd, '')) IN ('активная'))))), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64((lowerUTF8(ifNull(f_act_cd, '')) IN ('активная')) AND (ifNull(trf_kind, '') = 'o' OR (ifNull(trf_kind, '') = 's' AND ifNull(out_ok, 0) = 1 AND NOT (lowerUTF8(ifNull(t_act_cd, '')) IN ('активная'))))), 0)))), arrayWithConstant(17, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(17, toFloat64(0)), array(sum(toFloat64(ifNull(vac_open_cnt, 0))), sum(toFloat64(ifNull(vac_close_cnt, 0))), sum(toFloat64(ifNull(vac_new_cnt, 0))), sum(toFloat64(ifNull(vac_ttf_days, 0))), sum(toFloat64(ifNull(vac_ttf_cnt, 0))), sum(toFloat64(ifNull(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0), 0)))), arrayWithConstant(3, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(23, toFloat64(0)), array(sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_pen, 0))), sum(toFloat64(ifNull(ai_pen_co, 0))))) AS a2
      FROM prod_proteus.teampulse_hub_ai
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(26, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 27)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
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
                '","def":"', (SELECT d FROM cx),
                '","dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
                ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,aiw,aip,aic"',
                ',"req":', toJSONString(CAST([], 'Array(String)')),
                ',"paint":', toJSONString(CAST([], 'Array(String)')),
                ',"it":', toJSONString(CAST([], 'Array(String)')),
                ',"staff":', toJSONString(CAST([], 'Array(String)')),
                ',"act":', toJSONString(array('Активная')),
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

  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', t.hd, '\t', ifNull(f.fds, '')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM st2 AS t
  LEFT JOIN fdr AS f ON f.fr = t.id

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
SELECT 1 AS run, '3 компания, прежний' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(m_hc) + length(m_act) + length(m_avg) + length(m_hire) + length(m_fire) + length(m_reg) + length(m_nreg) + length(m_tin) + length(m_tout) + length(m_pnor) + length(m_plow) + length(m_phig) + length(m_pgry) + length(m_wday) + length(m_ovis) + length(m_gapr) + length(m_gdec) + length(m_vop) + length(m_vcl) + length(m_vap) + length(m_vtd) + length(m_vtn) + length(m_vjn) + length(m_aiw) + length(m_aip) + length(m_aic) + length(mx)) / 1024) AS kb,
       any(if(role = 'scope', concat(id, ' · уровень ', toString(lvl), ' · подразделений ', toString(kids)), '')) AS scope
FROM (
SELECT role AS role, id AS id, pid AS pid, lvl AS lvl, nm AS nm, kids AS kids, j AS j, m_hc AS m_hc, m_act AS m_act, m_avg AS m_avg, m_hire AS m_hire, m_fire AS m_fire, m_reg AS m_reg, m_nreg AS m_nreg, m_tin AS m_tin, m_tout AS m_tout, m_pnor AS m_pnor, m_plow AS m_plow, m_phig AS m_phig, m_pgry AS m_pgry, m_wday AS m_wday, m_ovis AS m_ovis, m_gapr AS m_gapr, m_gdec AS m_gdec, m_vop AS m_vop, m_vcl AS m_vcl, m_vap AS m_vap, m_vtd AS m_vtd, m_vtn AS m_vtn, m_vjn AS m_vjn, m_aiw AS m_aiw, m_aip AS m_aip, m_aic AS m_aic, mx AS mx 
FROM (SELECT role, id, pid, lvl, nm, kids, j,
       m_hc, m_act, m_avg, m_hire, m_fire, m_reg, m_nreg, m_tin, m_tout, m_pnor, m_plow, m_phig, m_pgry, m_wday, m_ovis, m_gapr, m_gdec, m_vop, m_vcl, m_vap, m_vtd, m_vtn, m_vjn, m_aiw, m_aip, m_aic, mx
FROM
(
WITH

cal AS (
    SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
           toUInt32(ifNull(n_months, 0)) AS n, toUInt32(ifNull(ytd_idx, 0)) AS iy,
           ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d,

ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^data_dt$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') AS dd
    FROM prod_proteus.teampulse_hub_meta
    LIMIT 1
  ),

st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, ifNull(path_rk, '') AS pth,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd
    FROM prod_proteus.teampulse_hub_unit
  ),

fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
    FROM prod_proteus.teampulse_hub_series
    WHERE report_month = (SELECT lm FROM cal)
    GROUP BY u7, v7a, v7b, v7c, v7d
    HAVING n7 > 0
  ),
  fdv AS (
    SELECT arraySort(groupUniqArray(v7a)) AS fa, arraySort(groupUniqArray(v7b)) AS fb,
           arraySort(groupUniqArray(v7c)) AS fc, arraySort(groupUniqArray(v7d)) AS fe
    FROM fdb
  ),
  fdr AS (
    SELECT u7 AS fr,
           arrayStringConcat(arraySort(groupArray(concat(toString(toUInt32(
             (((indexOf((SELECT fa FROM fdv), v7a) - 1) * length((SELECT fb FROM fdv)) + indexOf((SELECT fb FROM fdv), v7b) - 1)
              * length((SELECT fc FROM fdv)) + indexOf((SELECT fc FROM fdv), v7c) - 1)
             * length((SELECT fe FROM fdv)) + indexOf((SELECT fe FROM fdv), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  req AS (SELECT any(id) AS q, count() AS c FROM st2 WHERE 0),
  sc AS (SELECT if(req.c > 0, req.q, (SELECT d FROM cal)) AS s FROM req),

d1 AS (SELECT id FROM st2 WHERE pid = (SELECT s FROM sc) AND id != ''),
  d2 AS (SELECT id FROM st2 WHERE pid IN (SELECT id FROM d1)),
  d3 AS (SELECT id FROM st2 WHERE pid IN (SELECT id FROM d2)),

pick AS (
    SELECT s AS id, toUInt8(1) AS o FROM sc
    UNION ALL SELECT r AS id, toUInt8(2) AS o FROM cal
    UNION ALL SELECT id, toUInt8(5) AS o FROM d1
    UNION ALL SELECT id, toUInt8(6) AS o FROM d2
    UNION ALL SELECT id, toUInt8(7) AS o FROM d3
  ),

mm AS (
    SELECT u2 AS rk, i2 AS idx,
           sum(e0) AS e,
           sum(ea0) AS ea,
           sum(sa0) AS sa,
           sum(hi0) AS hi,
           sum(fi0) AS fi,
           sum(rg0) AS rg,
           sum(nr0) AS nr,
           sum(ti0) AS ti,
           sum(tu0) AS tu,
           sum(pn0) AS pn,
           sum(pl0) AS pl,
           sum(ph0) AS ph,
           sum(pg0) AS pg,
           sum(wd0) AS wd,
           sum(ov0) AS ov,
           sum(ga0) AS ga,
           sum(gd0) AS gd,
           sum(vo0) AS vo,
           sum(vk0) AS vk,
           sum(vn0) AS vn,
           sum(vd0) AS vd,
           sum(vt0) AS vt,
           sum(vj0) AS vj,
           sum(aw0) AS aw,
           sum(ap0) AS ap,
           sum(ac0) AS ac
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i2,
             toFloat64(ifNull(hc_cnt, 0)) AS e0,
             toFloat64(ifNull(act_cnt, 0)) AS ea0,
             toFloat64(ifNull(avg_cnt, 0)) AS sa0,
             toFloat64(ifNull(hire_cnt, 0)) AS hi0,
             toFloat64(ifNull(fire_cnt, 0)) AS fi0,
             toFloat64(ifNull(reg_cnt, 0)) AS rg0,
             toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)) AS nr0,
             toFloat64(ifNull(0, 0)) AS ti0,
             toFloat64(ifNull(0, 0)) AS tu0,
             toFloat64(ifNull(pnor_cnt, 0)) AS pn0,
             toFloat64(ifNull(plow_cnt, 0)) AS pl0,
             toFloat64(ifNull(phig_cnt, 0)) AS ph0,
             toFloat64(ifNull(pgry_cnt, 0)) AS pg0,
             toFloat64(ifNull(wday_amt, 0)) AS wd0,
             toFloat64(ifNull(ovis_amt, 0)) AS ov0,
             toFloat64(ifNull(gapr_cnt, 0)) AS ga0,
             toFloat64(ifNull(gdec_cnt, 0)) AS gd0,
             toFloat64(ifNull(0, 0)) AS vo0,
             toFloat64(ifNull(0, 0)) AS vk0,
             toFloat64(ifNull(0, 0)) AS vn0,
             toFloat64(ifNull(0, 0)) AS vd0,
             toFloat64(ifNull(0, 0)) AS vt0,
             toFloat64(ifNull(0, 0)) AS vj0,
             toFloat64(ifNull(0, 0)) AS aw0,
             toFloat64(ifNull(0, 0)) AS ap0,
             toFloat64(ifNull(0, 0)) AS ac0
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT id FROM pick)
        AND report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
        AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅'))))
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i2,
             toFloat64(0) AS e0,
             toFloat64(0) AS ea0,
             toFloat64(0) AS sa0,
             toFloat64(0) AS hi0,
             toFloat64(0) AS fi0,
             toFloat64(0) AS rg0,
             toFloat64(0) AS nr0,
             toFloat64(ifNull(trf_cnt, 0)) * toFloat64((has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(t_act_cd, '')))) AND (ifNull(trf_kind, '') = 'i' OR (ifNull(trf_kind, '') = 's' AND ifNull(in_ok, 0) = 1 AND NOT (has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(f_act_cd, ''))))))) AS ti0,
             toFloat64(ifNull(trf_cnt, 0)) * toFloat64((has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(f_act_cd, '')))) AND (ifNull(trf_kind, '') = 'o' OR (ifNull(trf_kind, '') = 's' AND ifNull(out_ok, 0) = 1 AND NOT (has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(t_act_cd, ''))))))) AS tu0,
             toFloat64(0) AS pn0,
             toFloat64(0) AS pl0,
             toFloat64(0) AS ph0,
             toFloat64(0) AS pg0,
             toFloat64(0) AS wd0,
             toFloat64(0) AS ov0,
             toFloat64(0) AS ga0,
             toFloat64(0) AS gd0,
             toFloat64(0) AS vo0,
             toFloat64(0) AS vk0,
             toFloat64(0) AS vn0,
             toFloat64(0) AS vd0,
             toFloat64(0) AS vt0,
             toFloat64(0) AS vj0,
             toFloat64(0) AS aw0,
             toFloat64(0) AS ap0,
             toFloat64(0) AS ac0
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT id FROM pick)
        AND report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i2,
             toFloat64(0) AS e0,
             toFloat64(0) AS ea0,
             toFloat64(0) AS sa0,
             toFloat64(0) AS hi0,
             toFloat64(0) AS fi0,
             toFloat64(0) AS rg0,
             toFloat64(0) AS nr0,
             toFloat64(0) AS ti0,
             toFloat64(0) AS tu0,
             toFloat64(0) AS pn0,
             toFloat64(0) AS pl0,
             toFloat64(0) AS ph0,
             toFloat64(0) AS pg0,
             toFloat64(0) AS wd0,
             toFloat64(0) AS ov0,
             toFloat64(0) AS ga0,
             toFloat64(0) AS gd0,
             toFloat64(ifNull(vac_open_cnt, 0)) AS vo0,
             toFloat64(ifNull(vac_close_cnt, 0)) AS vk0,
             toFloat64(ifNull(vac_new_cnt, 0)) AS vn0,
             toFloat64(ifNull(vac_ttf_days, 0)) AS vd0,
             toFloat64(ifNull(vac_ttf_cnt, 0)) AS vt0,
             toFloat64(ifNull(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0), 0)) AS vj0,
             toFloat64(0) AS aw0,
             toFloat64(0) AS ap0,
             toFloat64(0) AS ac0
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT id FROM pick)
        AND report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i2,
             toFloat64(0) AS e0,
             toFloat64(0) AS ea0,
             toFloat64(0) AS sa0,
             toFloat64(0) AS hi0,
             toFloat64(0) AS fi0,
             toFloat64(0) AS rg0,
             toFloat64(0) AS nr0,
             toFloat64(0) AS ti0,
             toFloat64(0) AS tu0,
             toFloat64(0) AS pn0,
             toFloat64(0) AS pl0,
             toFloat64(0) AS ph0,
             toFloat64(0) AS pg0,
             toFloat64(0) AS wd0,
             toFloat64(0) AS ov0,
             toFloat64(0) AS ga0,
             toFloat64(0) AS gd0,
             toFloat64(0) AS vo0,
             toFloat64(0) AS vk0,
             toFloat64(0) AS vn0,
             toFloat64(0) AS vd0,
             toFloat64(0) AS vt0,
             toFloat64(0) AS vj0,
             toFloat64(ifNull(ai_wau, 0)) AS aw0,
             toFloat64(ifNull(ai_pen, 0)) AS ap0,
             toFloat64(ifNull(ai_pen_co, 0)) AS ac0
      FROM prod_proteus.teampulse_hub_ai
      WHERE node_rk IN (SELECT id FROM pick)
        AND report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
      UNION ALL
      SELECT id AS u2, toInt32(0) AS i2,
             toFloat64(0) AS e0,
             toFloat64(0) AS ea0,
             toFloat64(0) AS sa0,
             toFloat64(0) AS hi0,
             toFloat64(0) AS fi0,
             toFloat64(0) AS rg0,
             toFloat64(0) AS nr0,
             toFloat64(0) AS ti0,
             toFloat64(0) AS tu0,
             toFloat64(0) AS pn0,
             toFloat64(0) AS pl0,
             toFloat64(0) AS ph0,
             toFloat64(0) AS pg0,
             toFloat64(0) AS wd0,
             toFloat64(0) AS ov0,
             toFloat64(0) AS ga0,
             toFloat64(0) AS gd0,
             toFloat64(0) AS vo0,
             toFloat64(0) AS vk0,
             toFloat64(0) AS vn0,
             toFloat64(0) AS vd0,
             toFloat64(0) AS vt0,
             toFloat64(0) AS vj0,
             toFloat64(0) AS aw0,
             toFloat64(0) AS ap0,
             toFloat64(0) AS ac0
      FROM pick
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk,
           sumForEach(arrayMap(i -> if(i = idx, e, 0), range((SELECT n FROM cal)))) AS a_hc,
           sumForEach(arrayMap(i -> if(i = idx, ea, 0), range((SELECT n FROM cal)))) AS a_act,
           sumForEach(arrayMap(i -> if(i = idx, sa, 0), range((SELECT n FROM cal)))) AS a_avg,
           sumForEach(arrayMap(i -> if(i = idx, hi, 0), range((SELECT n FROM cal)))) AS a_hire,
           sumForEach(arrayMap(i -> if(i = idx, fi, 0), range((SELECT n FROM cal)))) AS a_fire,
           sumForEach(arrayMap(i -> if(i = idx, rg, 0), range((SELECT n FROM cal)))) AS a_reg,
           sumForEach(arrayMap(i -> if(i = idx, nr, 0), range((SELECT n FROM cal)))) AS a_nreg,
           sumForEach(arrayMap(i -> if(i = idx, ti, 0), range((SELECT n FROM cal)))) AS a_tin,
           sumForEach(arrayMap(i -> if(i = idx, tu, 0), range((SELECT n FROM cal)))) AS a_tout,
           sumForEach(arrayMap(i -> if(i = idx, pn, 0), range((SELECT n FROM cal)))) AS a_pnor,
           sumForEach(arrayMap(i -> if(i = idx, pl, 0), range((SELECT n FROM cal)))) AS a_plow,
           sumForEach(arrayMap(i -> if(i = idx, ph, 0), range((SELECT n FROM cal)))) AS a_phig,
           sumForEach(arrayMap(i -> if(i = idx, pg, 0), range((SELECT n FROM cal)))) AS a_pgry,
           sumForEach(arrayMap(i -> if(i = idx, wd, 0), range((SELECT n FROM cal)))) AS a_wday,
           sumForEach(arrayMap(i -> if(i = idx, ov, 0), range((SELECT n FROM cal)))) AS a_ovis,
           sumForEach(arrayMap(i -> if(i = idx, ga, 0), range((SELECT n FROM cal)))) AS a_gapr,
           sumForEach(arrayMap(i -> if(i = idx, gd, 0), range((SELECT n FROM cal)))) AS a_gdec,
           sumForEach(arrayMap(i -> if(i = idx, vo, 0), range((SELECT n FROM cal)))) AS a_vop,
           sumForEach(arrayMap(i -> if(i = idx, vk, 0), range((SELECT n FROM cal)))) AS a_vcl,
           sumForEach(arrayMap(i -> if(i = idx, vn, 0), range((SELECT n FROM cal)))) AS a_vap,
           sumForEach(arrayMap(i -> if(i = idx, vd, 0), range((SELECT n FROM cal)))) AS a_vtd,
           sumForEach(arrayMap(i -> if(i = idx, vt, 0), range((SELECT n FROM cal)))) AS a_vtn,
           sumForEach(arrayMap(i -> if(i = idx, vj, 0), range((SELECT n FROM cal)))) AS a_vjn,
           sumForEach(arrayMap(i -> if(i = idx, aw, 0), range((SELECT n FROM cal)))) AS a_aiw,
           sumForEach(arrayMap(i -> if(i = idx, ap, 0), range((SELECT n FROM cal)))) AS a_aip,
           sumForEach(arrayMap(i -> if(i = idx, ac, 0), range((SELECT n FROM cal)))) AS a_aic
    FROM mm
    GROUP BY rk
  ),

mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT id FROM pick) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅'))))
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL

SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5,
               arrayFilter(x -> x.3 > 0, [
                 ('vs', ifNull(status, ''), if(report_month = (SELECT lm FROM cal) AND ifNull(status, '') != '', toFloat64(ifNull(vac_open_cnt, 0)), 0)),
                 ('vr', ifNull(search_reason, ''), if(report_month = (SELECT lm FROM cal), toFloat64(ifNull(vac_open_cnt, 0)), 0)),
                 ('vp', ifNull(specialization, ''), if(report_month = (SELECT lm FROM cal), toFloat64(ifNull(vac_open_cnt, 0)), 0)),
                 ('vl', ifNull(position_lvl, ''), if(report_month = (SELECT lm FROM cal), toFloat64(ifNull(vac_open_cnt, 0)), 0)),
                 ('vk', ifNull(channel, ''), if(report_month >= toStartOfYear((SELECT lm FROM cal)), toFloat64(ifNull(vac_close_cnt, 0)), 0)),
                 ('vq', ifNull(cand_lvl, ''), if(report_month >= toStartOfYear((SELECT lm FROM cal)), toFloat64(ifNull(vac_close_cnt, 0)), 0))]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT id FROM pick) AND report_month >= toStartOfYear((SELECT lm FROM cal))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
    )
    GROUP BY u3
  )
SELECT *
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         concat('{"lm":"', toString((SELECT lm FROM cal)), '","m0":"', toString((SELECT m0 FROM cal)),
                '","n":', toString((SELECT n FROM cal)), ',"today":"', toString(today()),
                '","root":"', (SELECT r FROM cal), '","scope":"', ifNull((SELECT s FROM sc), ''),
                '","def":"', (SELECT d FROM cal),
                '","dt":"', (SELECT dd FROM cal), '","schema":"hub-2","cuts":["paint","it","staff"', if(has((SELECT fe FROM fdv), '∅'), '', ',"act"'), ']',
                ',"req":', toJSONString(CAST([], 'Array(String)')),
                ',"paint":', toJSONString(CAST([], 'Array(String)')),
                ',"it":', toJSONString(CAST([], 'Array(String)')),
                ',"staff":', toJSONString(CAST([], 'Array(String)')),
                ',"act":', toJSONString(array('Активная')),
                ',"vals":{"paint":', (SELECT toJSONString(groupArray((v, e))) FROM (
  SELECT ifNull(paint_cd, '-') AS v, sum(ifNull(hc_cnt, 0)) AS e
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT r FROM cal) AND report_month = (SELECT lm FROM cal)
  GROUP BY v ORDER BY e DESC, v)), ',"it":', (SELECT toJSONString(groupArray((v, e))) FROM (
  SELECT ifNull(it_cd, '-') AS v, sum(ifNull(hc_cnt, 0)) AS e
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT r FROM cal) AND report_month = (SELECT lm FROM cal)
  GROUP BY v ORDER BY e DESC, v)), ',"staff":', (SELECT toJSONString(groupArray((v, e))) FROM (
  SELECT ifNull(staff_cd, '-') AS v, sum(ifNull(hc_cnt, 0)) AS e
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT r FROM cal) AND report_month = (SELECT lm FROM cal)
  GROUP BY v ORDER BY e DESC, v)),
                ',"act":', (SELECT toJSONString(groupArray((v, e))) FROM (
  SELECT ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅'), '-') AS v, sum(ifNull(hc_cnt, 0)) AS e
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT r FROM cal) AND report_month = (SELECT lm FROM cal)
  GROUP BY v ORDER BY e DESC, v)),
                '},"fdv":{"paint":', toJSONString((SELECT fa FROM fdv)), ',"it":', toJSONString((SELECT fb FROM fdv)),
                ',"staff":', toJSONString((SELECT fc FROM fdv)),
                ',"act":', toJSONString(if(has((SELECT fe FROM fdv), '∅'), CAST([], 'Array(String)'), (SELECT fe FROM fdv))), '}}') AS j,
         '' AS m_hc, '' AS m_act, '' AS m_avg, '' AS m_hire, '' AS m_fire, '' AS m_reg, '' AS m_nreg, '' AS m_tin, '' AS m_tout, '' AS m_pnor, '' AS m_plow, '' AS m_phig, '' AS m_pgry, '' AS m_wday, '' AS m_ovis, '' AS m_gapr, '' AS m_gdec, '' AS m_vop, '' AS m_vcl, '' AS m_vap, '' AS m_vtd, '' AS m_vtn, '' AS m_vjn, '' AS m_aiw, '' AS m_aip, '' AS m_aic, '' AS mx

  UNION ALL

  SELECT p.o AS o, multiIf(p.o = 1, 'scope', p.o = 2, 'base', p.o = 5, 'c', p.o = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm, s.kd AS kids, '' AS j,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_hc), ',') AS m_hc,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_act), ',') AS m_act,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_avg), ',') AS m_avg,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_hire), ',') AS m_hire,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_fire), ',') AS m_fire,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_reg), ',') AS m_reg,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_nreg), ',') AS m_nreg,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_tin), ',') AS m_tin,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_tout), ',') AS m_tout,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_pnor), ',') AS m_pnor,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_plow), ',') AS m_plow,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_phig), ',') AS m_phig,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_pgry), ',') AS m_pgry,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_wday), ',') AS m_wday,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_ovis), ',') AS m_ovis,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_gapr), ',') AS m_gapr,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_gdec), ',') AS m_gdec,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vop), ',') AS m_vop,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vcl), ',') AS m_vcl,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vap), ',') AS m_vap,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vtd), ',') AS m_vtd,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vtn), ',') AS m_vtn,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vjn), ',') AS m_vjn,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_aiw), ',') AS m_aiw,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_aip), ',') AS m_aip,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_aic), ',') AS m_aic,
         ifNull(x.mxs, '') AS mx
  FROM pick AS p
  INNER JOIN st2 AS s ON s.id = p.id
  INNER JOIN arr AS a ON a.rk = p.id
  LEFT JOIN mxr AS x ON x.mu = p.id
  WHERE p.o <= 2
     OR arraySum(a.a_hc) + arraySum(a.a_hire) + arraySum(a.a_fire) + arraySum(a.a_tin) + arraySum(a.a_tout) > 0

  UNION ALL

  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', t.hd, '\t', ifNull(f.fds, '')))), '\n') AS j,
         '' AS m_hc, '' AS m_act, '' AS m_avg, '' AS m_hire, '' AS m_fire, '' AS m_reg, '' AS m_nreg, '' AS m_tin, '' AS m_tout, '' AS m_pnor, '' AS m_plow, '' AS m_phig, '' AS m_pgry, '' AS m_wday, '' AS m_ovis, '' AS m_gapr, '' AS m_gdec, '' AS m_vop, '' AS m_vcl, '' AS m_vap, '' AS m_vtd, '' AS m_vtn, '' AS m_vjn, '' AS m_aiw, '' AS m_aip, '' AS m_aic, '' AS mx
  FROM st2 AS t
  LEFT JOIN fdr AS f ON f.fr = t.id

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS m_hc, '' AS m_act, '' AS m_avg, '' AS m_hire, '' AS m_fire, '' AS m_reg, '' AS m_nreg, '' AS m_tin, '' AS m_tout, '' AS m_pnor, '' AS m_plow, '' AS m_phig, '' AS m_pgry, '' AS m_wday, '' AS m_ovis, '' AS m_gapr, '' AS m_gdec, '' AS m_vop, '' AS m_vcl, '' AS m_vap, '' AS m_vtd, '' AS m_vtn, '' AS m_vjn, '' AS m_aiw, '' AS m_aip, '' AS m_aic, '' AS mx
)
)
ORDER BY o, lvl, nm, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, m_hc, m_act, m_avg, m_hire, m_fire, m_reg, m_nreg, m_tin, m_tout, m_pnor, m_plow, m_phig, m_pgry, m_wday, m_ovis, m_gapr, m_gdec, m_vop, m_vcl, m_vap, m_vtd, m_vtn, m_vjn, m_aiw, m_aip, m_aic, mx
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
            arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                        arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3))) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, if(arrayExists(x -> x.1 = (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7), al), (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7), d) AS s,
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
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''))) AS al FROM prod_proteus.teampulse_hub_unit) AS ua
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd
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
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(array(sum(toFloat64(ifNull(hc_cnt, 0))), sum(toFloat64(ifNull(act_cnt, 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(pnor_cnt, 0))), sum(toFloat64(ifNull(plow_cnt, 0))), sum(toFloat64(ifNull(phig_cnt, 0))), sum(toFloat64(ifNull(pgry_cnt, 0))), sum(toFloat64(ifNull(wday_amt, 0))), sum(toFloat64(ifNull(ovis_amt, 0))), sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64((lowerUTF8(ifNull(t_paint_cd, '')) IN ('hq') AND lowerUTF8(ifNull(t_act_cd, '')) IN ('активная')) AND (ifNull(trf_kind, '') = 'i' OR (ifNull(trf_kind, '') = 's' AND ifNull(in_ok, 0) = 1 AND NOT (lowerUTF8(ifNull(f_paint_cd, '')) IN ('hq') AND lowerUTF8(ifNull(f_act_cd, '')) IN ('активная'))))), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64((lowerUTF8(ifNull(f_paint_cd, '')) IN ('hq') AND lowerUTF8(ifNull(f_act_cd, '')) IN ('активная')) AND (ifNull(trf_kind, '') = 'o' OR (ifNull(trf_kind, '') = 's' AND ifNull(out_ok, 0) = 1 AND NOT (lowerUTF8(ifNull(t_paint_cd, '')) IN ('hq') AND lowerUTF8(ifNull(t_act_cd, '')) IN ('активная'))))), 0)))), arrayWithConstant(17, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(17, toFloat64(0)), array(sum(toFloat64(ifNull(vac_open_cnt, 0))), sum(toFloat64(ifNull(vac_close_cnt, 0))), sum(toFloat64(ifNull(vac_new_cnt, 0))), sum(toFloat64(ifNull(vac_ttf_days, 0))), sum(toFloat64(ifNull(vac_ttf_cnt, 0))), sum(toFloat64(ifNull(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0), 0)))), arrayWithConstant(3, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(23, toFloat64(0)), array(sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_pen, 0))), sum(toFloat64(ifNull(ai_pen_co, 0))))) AS a2
      FROM prod_proteus.teampulse_hub_ai
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(26, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 27)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
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
                '","def":"', (SELECT d FROM cx),
                '","dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
                ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,aiw,aip,aic"',
                ',"req":', toJSONString(array((SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7))),
                ',"paint":', toJSONString(array('HQ')),
                ',"it":', toJSONString(CAST([], 'Array(String)')),
                ',"staff":', toJSONString(CAST([], 'Array(String)')),
                ',"act":', toJSONString(array('Активная')),
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

  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', t.hd, '\t', ifNull(f.fds, '')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM st2 AS t
  LEFT JOIN fdr AS f ON f.fr = t.id

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
SELECT 1 AS run, '5 команда + HQ, прежний' AS block, role, count() AS rows_n, round(sum(length(role) + length(id) + length(pid) + length(nm) + length(j) + length(m_hc) + length(m_act) + length(m_avg) + length(m_hire) + length(m_fire) + length(m_reg) + length(m_nreg) + length(m_tin) + length(m_tout) + length(m_pnor) + length(m_plow) + length(m_phig) + length(m_pgry) + length(m_wday) + length(m_ovis) + length(m_gapr) + length(m_gdec) + length(m_vop) + length(m_vcl) + length(m_vap) + length(m_vtd) + length(m_vtn) + length(m_vjn) + length(m_aiw) + length(m_aip) + length(m_aic) + length(mx)) / 1024) AS kb,
       any(if(role = 'scope', concat(id, ' · уровень ', toString(lvl), ' · подразделений ', toString(kids)), '')) AS scope
FROM (
SELECT role AS role, id AS id, pid AS pid, lvl AS lvl, nm AS nm, kids AS kids, j AS j, m_hc AS m_hc, m_act AS m_act, m_avg AS m_avg, m_hire AS m_hire, m_fire AS m_fire, m_reg AS m_reg, m_nreg AS m_nreg, m_tin AS m_tin, m_tout AS m_tout, m_pnor AS m_pnor, m_plow AS m_plow, m_phig AS m_phig, m_pgry AS m_pgry, m_wday AS m_wday, m_ovis AS m_ovis, m_gapr AS m_gapr, m_gdec AS m_gdec, m_vop AS m_vop, m_vcl AS m_vcl, m_vap AS m_vap, m_vtd AS m_vtd, m_vtn AS m_vtn, m_vjn AS m_vjn, m_aiw AS m_aiw, m_aip AS m_aip, m_aic AS m_aic, mx AS mx 
FROM (SELECT role, id, pid, lvl, nm, kids, j,
       m_hc, m_act, m_avg, m_hire, m_fire, m_reg, m_nreg, m_tin, m_tout, m_pnor, m_plow, m_phig, m_pgry, m_wday, m_ovis, m_gapr, m_gdec, m_vop, m_vcl, m_vap, m_vtd, m_vtn, m_vjn, m_aiw, m_aip, m_aic, mx
FROM
(
WITH

cal AS (
    SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
           toUInt32(ifNull(n_months, 0)) AS n, toUInt32(ifNull(ytd_idx, 0)) AS iy,
           ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d,

ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^data_dt$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') AS dd
    FROM prod_proteus.teampulse_hub_meta
    LIMIT 1
  ),

st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, ifNull(path_rk, '') AS pth,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd
    FROM prod_proteus.teampulse_hub_unit
  ),

fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
    FROM prod_proteus.teampulse_hub_series
    WHERE report_month = (SELECT lm FROM cal)
    GROUP BY u7, v7a, v7b, v7c, v7d
    HAVING n7 > 0
  ),
  fdv AS (
    SELECT arraySort(groupUniqArray(v7a)) AS fa, arraySort(groupUniqArray(v7b)) AS fb,
           arraySort(groupUniqArray(v7c)) AS fc, arraySort(groupUniqArray(v7d)) AS fe
    FROM fdb
  ),
  fdr AS (
    SELECT u7 AS fr,
           arrayStringConcat(arraySort(groupArray(concat(toString(toUInt32(
             (((indexOf((SELECT fa FROM fdv), v7a) - 1) * length((SELECT fb FROM fdv)) + indexOf((SELECT fb FROM fdv), v7b) - 1)
              * length((SELECT fc FROM fdv)) + indexOf((SELECT fc FROM fdv), v7c) - 1)
             * length((SELECT fe FROM fdv)) + indexOf((SELECT fe FROM fdv), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  req AS (SELECT any(id) AS q, count() AS c FROM st2 WHERE id = (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7)),
  sc AS (SELECT if(req.c > 0, req.q, (SELECT d FROM cal)) AS s FROM req),

d1 AS (SELECT id FROM st2 WHERE pid = (SELECT s FROM sc) AND id != ''),
  d2 AS (SELECT id FROM st2 WHERE pid IN (SELECT id FROM d1)),
  d3 AS (SELECT id FROM st2 WHERE pid IN (SELECT id FROM d2)),

pick AS (
    SELECT s AS id, toUInt8(1) AS o FROM sc
    UNION ALL SELECT r AS id, toUInt8(2) AS o FROM cal
    UNION ALL SELECT id, toUInt8(5) AS o FROM d1
    UNION ALL SELECT id, toUInt8(6) AS o FROM d2
    UNION ALL SELECT id, toUInt8(7) AS o FROM d3
  ),

mm AS (
    SELECT u2 AS rk, i2 AS idx,
           sum(e0) AS e,
           sum(ea0) AS ea,
           sum(sa0) AS sa,
           sum(hi0) AS hi,
           sum(fi0) AS fi,
           sum(rg0) AS rg,
           sum(nr0) AS nr,
           sum(ti0) AS ti,
           sum(tu0) AS tu,
           sum(pn0) AS pn,
           sum(pl0) AS pl,
           sum(ph0) AS ph,
           sum(pg0) AS pg,
           sum(wd0) AS wd,
           sum(ov0) AS ov,
           sum(ga0) AS ga,
           sum(gd0) AS gd,
           sum(vo0) AS vo,
           sum(vk0) AS vk,
           sum(vn0) AS vn,
           sum(vd0) AS vd,
           sum(vt0) AS vt,
           sum(vj0) AS vj,
           sum(aw0) AS aw,
           sum(ap0) AS ap,
           sum(ac0) AS ac
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i2,
             toFloat64(ifNull(hc_cnt, 0)) AS e0,
             toFloat64(ifNull(act_cnt, 0)) AS ea0,
             toFloat64(ifNull(avg_cnt, 0)) AS sa0,
             toFloat64(ifNull(hire_cnt, 0)) AS hi0,
             toFloat64(ifNull(fire_cnt, 0)) AS fi0,
             toFloat64(ifNull(reg_cnt, 0)) AS rg0,
             toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)) AS nr0,
             toFloat64(ifNull(0, 0)) AS ti0,
             toFloat64(ifNull(0, 0)) AS tu0,
             toFloat64(ifNull(pnor_cnt, 0)) AS pn0,
             toFloat64(ifNull(plow_cnt, 0)) AS pl0,
             toFloat64(ifNull(phig_cnt, 0)) AS ph0,
             toFloat64(ifNull(pgry_cnt, 0)) AS pg0,
             toFloat64(ifNull(wday_amt, 0)) AS wd0,
             toFloat64(ifNull(ovis_amt, 0)) AS ov0,
             toFloat64(ifNull(gapr_cnt, 0)) AS ga0,
             toFloat64(ifNull(gdec_cnt, 0)) AS gd0,
             toFloat64(ifNull(0, 0)) AS vo0,
             toFloat64(ifNull(0, 0)) AS vk0,
             toFloat64(ifNull(0, 0)) AS vn0,
             toFloat64(ifNull(0, 0)) AS vd0,
             toFloat64(ifNull(0, 0)) AS vt0,
             toFloat64(ifNull(0, 0)) AS vj0,
             toFloat64(ifNull(0, 0)) AS aw0,
             toFloat64(ifNull(0, 0)) AS ap0,
             toFloat64(ifNull(0, 0)) AS ac0
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT id FROM pick)
        AND report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
        AND has(arrayMap(x -> lowerUTF8(x), array('HQ')), lowerUTF8(ifNull(paint_cd, '-'))) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅'))))
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i2,
             toFloat64(0) AS e0,
             toFloat64(0) AS ea0,
             toFloat64(0) AS sa0,
             toFloat64(0) AS hi0,
             toFloat64(0) AS fi0,
             toFloat64(0) AS rg0,
             toFloat64(0) AS nr0,
             toFloat64(ifNull(trf_cnt, 0)) * toFloat64((has(arrayMap(x -> lowerUTF8(x), array('HQ')), lowerUTF8(ifNull(t_paint_cd, ''))) AND has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(t_act_cd, '')))) AND (ifNull(trf_kind, '') = 'i' OR (ifNull(trf_kind, '') = 's' AND ifNull(in_ok, 0) = 1 AND NOT (has(arrayMap(x -> lowerUTF8(x), array('HQ')), lowerUTF8(ifNull(f_paint_cd, ''))) AND has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(f_act_cd, ''))))))) AS ti0,
             toFloat64(ifNull(trf_cnt, 0)) * toFloat64((has(arrayMap(x -> lowerUTF8(x), array('HQ')), lowerUTF8(ifNull(f_paint_cd, ''))) AND has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(f_act_cd, '')))) AND (ifNull(trf_kind, '') = 'o' OR (ifNull(trf_kind, '') = 's' AND ifNull(out_ok, 0) = 1 AND NOT (has(arrayMap(x -> lowerUTF8(x), array('HQ')), lowerUTF8(ifNull(t_paint_cd, ''))) AND has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(t_act_cd, ''))))))) AS tu0,
             toFloat64(0) AS pn0,
             toFloat64(0) AS pl0,
             toFloat64(0) AS ph0,
             toFloat64(0) AS pg0,
             toFloat64(0) AS wd0,
             toFloat64(0) AS ov0,
             toFloat64(0) AS ga0,
             toFloat64(0) AS gd0,
             toFloat64(0) AS vo0,
             toFloat64(0) AS vk0,
             toFloat64(0) AS vn0,
             toFloat64(0) AS vd0,
             toFloat64(0) AS vt0,
             toFloat64(0) AS vj0,
             toFloat64(0) AS aw0,
             toFloat64(0) AS ap0,
             toFloat64(0) AS ac0
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN (SELECT id FROM pick)
        AND report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i2,
             toFloat64(0) AS e0,
             toFloat64(0) AS ea0,
             toFloat64(0) AS sa0,
             toFloat64(0) AS hi0,
             toFloat64(0) AS fi0,
             toFloat64(0) AS rg0,
             toFloat64(0) AS nr0,
             toFloat64(0) AS ti0,
             toFloat64(0) AS tu0,
             toFloat64(0) AS pn0,
             toFloat64(0) AS pl0,
             toFloat64(0) AS ph0,
             toFloat64(0) AS pg0,
             toFloat64(0) AS wd0,
             toFloat64(0) AS ov0,
             toFloat64(0) AS ga0,
             toFloat64(0) AS gd0,
             toFloat64(ifNull(vac_open_cnt, 0)) AS vo0,
             toFloat64(ifNull(vac_close_cnt, 0)) AS vk0,
             toFloat64(ifNull(vac_new_cnt, 0)) AS vn0,
             toFloat64(ifNull(vac_ttf_days, 0)) AS vd0,
             toFloat64(ifNull(vac_ttf_cnt, 0)) AS vt0,
             toFloat64(ifNull(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0), 0)) AS vj0,
             toFloat64(0) AS aw0,
             toFloat64(0) AS ap0,
             toFloat64(0) AS ac0
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN (SELECT id FROM pick)
        AND report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i2,
             toFloat64(0) AS e0,
             toFloat64(0) AS ea0,
             toFloat64(0) AS sa0,
             toFloat64(0) AS hi0,
             toFloat64(0) AS fi0,
             toFloat64(0) AS rg0,
             toFloat64(0) AS nr0,
             toFloat64(0) AS ti0,
             toFloat64(0) AS tu0,
             toFloat64(0) AS pn0,
             toFloat64(0) AS pl0,
             toFloat64(0) AS ph0,
             toFloat64(0) AS pg0,
             toFloat64(0) AS wd0,
             toFloat64(0) AS ov0,
             toFloat64(0) AS ga0,
             toFloat64(0) AS gd0,
             toFloat64(0) AS vo0,
             toFloat64(0) AS vk0,
             toFloat64(0) AS vn0,
             toFloat64(0) AS vd0,
             toFloat64(0) AS vt0,
             toFloat64(0) AS vj0,
             toFloat64(ifNull(ai_wau, 0)) AS aw0,
             toFloat64(ifNull(ai_pen, 0)) AS ap0,
             toFloat64(ifNull(ai_pen_co, 0)) AS ac0
      FROM prod_proteus.teampulse_hub_ai
      WHERE node_rk IN (SELECT id FROM pick)
        AND report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
      UNION ALL
      SELECT id AS u2, toInt32(0) AS i2,
             toFloat64(0) AS e0,
             toFloat64(0) AS ea0,
             toFloat64(0) AS sa0,
             toFloat64(0) AS hi0,
             toFloat64(0) AS fi0,
             toFloat64(0) AS rg0,
             toFloat64(0) AS nr0,
             toFloat64(0) AS ti0,
             toFloat64(0) AS tu0,
             toFloat64(0) AS pn0,
             toFloat64(0) AS pl0,
             toFloat64(0) AS ph0,
             toFloat64(0) AS pg0,
             toFloat64(0) AS wd0,
             toFloat64(0) AS ov0,
             toFloat64(0) AS ga0,
             toFloat64(0) AS gd0,
             toFloat64(0) AS vo0,
             toFloat64(0) AS vk0,
             toFloat64(0) AS vn0,
             toFloat64(0) AS vd0,
             toFloat64(0) AS vt0,
             toFloat64(0) AS vj0,
             toFloat64(0) AS aw0,
             toFloat64(0) AS ap0,
             toFloat64(0) AS ac0
      FROM pick
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk,
           sumForEach(arrayMap(i -> if(i = idx, e, 0), range((SELECT n FROM cal)))) AS a_hc,
           sumForEach(arrayMap(i -> if(i = idx, ea, 0), range((SELECT n FROM cal)))) AS a_act,
           sumForEach(arrayMap(i -> if(i = idx, sa, 0), range((SELECT n FROM cal)))) AS a_avg,
           sumForEach(arrayMap(i -> if(i = idx, hi, 0), range((SELECT n FROM cal)))) AS a_hire,
           sumForEach(arrayMap(i -> if(i = idx, fi, 0), range((SELECT n FROM cal)))) AS a_fire,
           sumForEach(arrayMap(i -> if(i = idx, rg, 0), range((SELECT n FROM cal)))) AS a_reg,
           sumForEach(arrayMap(i -> if(i = idx, nr, 0), range((SELECT n FROM cal)))) AS a_nreg,
           sumForEach(arrayMap(i -> if(i = idx, ti, 0), range((SELECT n FROM cal)))) AS a_tin,
           sumForEach(arrayMap(i -> if(i = idx, tu, 0), range((SELECT n FROM cal)))) AS a_tout,
           sumForEach(arrayMap(i -> if(i = idx, pn, 0), range((SELECT n FROM cal)))) AS a_pnor,
           sumForEach(arrayMap(i -> if(i = idx, pl, 0), range((SELECT n FROM cal)))) AS a_plow,
           sumForEach(arrayMap(i -> if(i = idx, ph, 0), range((SELECT n FROM cal)))) AS a_phig,
           sumForEach(arrayMap(i -> if(i = idx, pg, 0), range((SELECT n FROM cal)))) AS a_pgry,
           sumForEach(arrayMap(i -> if(i = idx, wd, 0), range((SELECT n FROM cal)))) AS a_wday,
           sumForEach(arrayMap(i -> if(i = idx, ov, 0), range((SELECT n FROM cal)))) AS a_ovis,
           sumForEach(arrayMap(i -> if(i = idx, ga, 0), range((SELECT n FROM cal)))) AS a_gapr,
           sumForEach(arrayMap(i -> if(i = idx, gd, 0), range((SELECT n FROM cal)))) AS a_gdec,
           sumForEach(arrayMap(i -> if(i = idx, vo, 0), range((SELECT n FROM cal)))) AS a_vop,
           sumForEach(arrayMap(i -> if(i = idx, vk, 0), range((SELECT n FROM cal)))) AS a_vcl,
           sumForEach(arrayMap(i -> if(i = idx, vn, 0), range((SELECT n FROM cal)))) AS a_vap,
           sumForEach(arrayMap(i -> if(i = idx, vd, 0), range((SELECT n FROM cal)))) AS a_vtd,
           sumForEach(arrayMap(i -> if(i = idx, vt, 0), range((SELECT n FROM cal)))) AS a_vtn,
           sumForEach(arrayMap(i -> if(i = idx, vj, 0), range((SELECT n FROM cal)))) AS a_vjn,
           sumForEach(arrayMap(i -> if(i = idx, aw, 0), range((SELECT n FROM cal)))) AS a_aiw,
           sumForEach(arrayMap(i -> if(i = idx, ap, 0), range((SELECT n FROM cal)))) AS a_aip,
           sumForEach(arrayMap(i -> if(i = idx, ac, 0), range((SELECT n FROM cal)))) AS a_aic
    FROM mm
    GROUP BY rk
  ),

mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT id FROM pick) AND has(arrayMap(x -> lowerUTF8(x), array('HQ')), lowerUTF8(ifNull(paint_cd, '-'))) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR has(arrayMap(x -> lowerUTF8(x), array('Активная')), lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅'))))
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL

SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5,
               arrayFilter(x -> x.3 > 0, [
                 ('vs', ifNull(status, ''), if(report_month = (SELECT lm FROM cal) AND ifNull(status, '') != '', toFloat64(ifNull(vac_open_cnt, 0)), 0)),
                 ('vr', ifNull(search_reason, ''), if(report_month = (SELECT lm FROM cal), toFloat64(ifNull(vac_open_cnt, 0)), 0)),
                 ('vp', ifNull(specialization, ''), if(report_month = (SELECT lm FROM cal), toFloat64(ifNull(vac_open_cnt, 0)), 0)),
                 ('vl', ifNull(position_lvl, ''), if(report_month = (SELECT lm FROM cal), toFloat64(ifNull(vac_open_cnt, 0)), 0)),
                 ('vk', ifNull(channel, ''), if(report_month >= toStartOfYear((SELECT lm FROM cal)), toFloat64(ifNull(vac_close_cnt, 0)), 0)),
                 ('vq', ifNull(cand_lvl, ''), if(report_month >= toStartOfYear((SELECT lm FROM cal)), toFloat64(ifNull(vac_close_cnt, 0)), 0))]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN (SELECT id FROM pick) AND report_month >= toStartOfYear((SELECT lm FROM cal))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
    )
    GROUP BY u3
  )
SELECT *
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         concat('{"lm":"', toString((SELECT lm FROM cal)), '","m0":"', toString((SELECT m0 FROM cal)),
                '","n":', toString((SELECT n FROM cal)), ',"today":"', toString(today()),
                '","root":"', (SELECT r FROM cal), '","scope":"', ifNull((SELECT s FROM sc), ''),
                '","def":"', (SELECT d FROM cal),
                '","dt":"', (SELECT dd FROM cal), '","schema":"hub-2","cuts":["paint","it","staff"', if(has((SELECT fe FROM fdv), '∅'), '', ',"act"'), ']',
                ',"req":', toJSONString(array((SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7))),
                ',"paint":', toJSONString(array('HQ')),
                ',"it":', toJSONString(CAST([], 'Array(String)')),
                ',"staff":', toJSONString(CAST([], 'Array(String)')),
                ',"act":', toJSONString(array('Активная')),
                ',"vals":{"paint":', (SELECT toJSONString(groupArray((v, e))) FROM (
  SELECT ifNull(paint_cd, '-') AS v, sum(ifNull(hc_cnt, 0)) AS e
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT r FROM cal) AND report_month = (SELECT lm FROM cal)
  GROUP BY v ORDER BY e DESC, v)), ',"it":', (SELECT toJSONString(groupArray((v, e))) FROM (
  SELECT ifNull(it_cd, '-') AS v, sum(ifNull(hc_cnt, 0)) AS e
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT r FROM cal) AND report_month = (SELECT lm FROM cal)
  GROUP BY v ORDER BY e DESC, v)), ',"staff":', (SELECT toJSONString(groupArray((v, e))) FROM (
  SELECT ifNull(staff_cd, '-') AS v, sum(ifNull(hc_cnt, 0)) AS e
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT r FROM cal) AND report_month = (SELECT lm FROM cal)
  GROUP BY v ORDER BY e DESC, v)),
                ',"act":', (SELECT toJSONString(groupArray((v, e))) FROM (
  SELECT ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅'), '-') AS v, sum(ifNull(hc_cnt, 0)) AS e
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT r FROM cal) AND report_month = (SELECT lm FROM cal)
  GROUP BY v ORDER BY e DESC, v)),
                '},"fdv":{"paint":', toJSONString((SELECT fa FROM fdv)), ',"it":', toJSONString((SELECT fb FROM fdv)),
                ',"staff":', toJSONString((SELECT fc FROM fdv)),
                ',"act":', toJSONString(if(has((SELECT fe FROM fdv), '∅'), CAST([], 'Array(String)'), (SELECT fe FROM fdv))), '}}') AS j,
         '' AS m_hc, '' AS m_act, '' AS m_avg, '' AS m_hire, '' AS m_fire, '' AS m_reg, '' AS m_nreg, '' AS m_tin, '' AS m_tout, '' AS m_pnor, '' AS m_plow, '' AS m_phig, '' AS m_pgry, '' AS m_wday, '' AS m_ovis, '' AS m_gapr, '' AS m_gdec, '' AS m_vop, '' AS m_vcl, '' AS m_vap, '' AS m_vtd, '' AS m_vtn, '' AS m_vjn, '' AS m_aiw, '' AS m_aip, '' AS m_aic, '' AS mx

  UNION ALL

  SELECT p.o AS o, multiIf(p.o = 1, 'scope', p.o = 2, 'base', p.o = 5, 'c', p.o = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm, s.kd AS kids, '' AS j,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_hc), ',') AS m_hc,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_act), ',') AS m_act,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_avg), ',') AS m_avg,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_hire), ',') AS m_hire,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_fire), ',') AS m_fire,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_reg), ',') AS m_reg,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_nreg), ',') AS m_nreg,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_tin), ',') AS m_tin,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_tout), ',') AS m_tout,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_pnor), ',') AS m_pnor,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_plow), ',') AS m_plow,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_phig), ',') AS m_phig,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_pgry), ',') AS m_pgry,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_wday), ',') AS m_wday,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_ovis), ',') AS m_ovis,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_gapr), ',') AS m_gapr,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_gdec), ',') AS m_gdec,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vop), ',') AS m_vop,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vcl), ',') AS m_vcl,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vap), ',') AS m_vap,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vtd), ',') AS m_vtd,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vtn), ',') AS m_vtn,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_vjn), ',') AS m_vjn,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_aiw), ',') AS m_aiw,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_aip), ',') AS m_aip,
         arrayStringConcat(arrayMap(x -> toString(round(x, 1)), a.a_aic), ',') AS m_aic,
         ifNull(x.mxs, '') AS mx
  FROM pick AS p
  INNER JOIN st2 AS s ON s.id = p.id
  INNER JOIN arr AS a ON a.rk = p.id
  LEFT JOIN mxr AS x ON x.mu = p.id
  WHERE p.o <= 2
     OR arraySum(a.a_hc) + arraySum(a.a_hire) + arraySum(a.a_fire) + arraySum(a.a_tin) + arraySum(a.a_tout) > 0

  UNION ALL

  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', t.hd, '\t', ifNull(f.fds, '')))), '\n') AS j,
         '' AS m_hc, '' AS m_act, '' AS m_avg, '' AS m_hire, '' AS m_fire, '' AS m_reg, '' AS m_nreg, '' AS m_tin, '' AS m_tout, '' AS m_pnor, '' AS m_plow, '' AS m_phig, '' AS m_pgry, '' AS m_wday, '' AS m_ovis, '' AS m_gapr, '' AS m_gdec, '' AS m_vop, '' AS m_vcl, '' AS m_vap, '' AS m_vtd, '' AS m_vtn, '' AS m_vjn, '' AS m_aiw, '' AS m_aip, '' AS m_aic, '' AS mx
  FROM st2 AS t
  LEFT JOIN fdr AS f ON f.fr = t.id

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS m_hc, '' AS m_act, '' AS m_avg, '' AS m_hire, '' AS m_fire, '' AS m_reg, '' AS m_nreg, '' AS m_tin, '' AS m_tout, '' AS m_pnor, '' AS m_plow, '' AS m_phig, '' AS m_pgry, '' AS m_wday, '' AS m_ovis, '' AS m_gapr, '' AS m_gdec, '' AS m_vop, '' AS m_vcl, '' AS m_vap, '' AS m_vtd, '' AS m_vtn, '' AS m_vjn, '' AS m_aiw, '' AS m_aip, '' AS m_aic, '' AS mx
)
)
ORDER BY o, lvl, nm, id) AS virtual_table GROUP BY role, id, pid, lvl, nm, kids, j, m_hc, m_act, m_avg, m_hire, m_fire, m_reg, m_nreg, m_tin, m_tout, m_pnor, m_plow, m_phig, m_pgry, m_wday, m_ovis, m_gapr, m_gdec, m_vop, m_vcl, m_vap, m_vtd, m_vtn, m_vjn, m_aiw, m_aip, m_aic, mx
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
            arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                        arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3))) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, if(arrayExists(x -> x.1 = (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7), al), (SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7), d) AS s,
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
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''))) AS al FROM prod_proteus.teampulse_hub_unit) AS ua
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd
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
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(array(sum(toFloat64(ifNull(hc_cnt, 0))), sum(toFloat64(ifNull(act_cnt, 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(pnor_cnt, 0))), sum(toFloat64(ifNull(plow_cnt, 0))), sum(toFloat64(ifNull(phig_cnt, 0))), sum(toFloat64(ifNull(pgry_cnt, 0))), sum(toFloat64(ifNull(wday_amt, 0))), sum(toFloat64(ifNull(ovis_amt, 0))), sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64((lowerUTF8(ifNull(t_act_cd, '')) IN ('активная')) AND (ifNull(trf_kind, '') = 'i' OR (ifNull(trf_kind, '') = 's' AND ifNull(in_ok, 0) = 1 AND NOT (lowerUTF8(ifNull(f_act_cd, '')) IN ('активная'))))), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64((lowerUTF8(ifNull(f_act_cd, '')) IN ('активная')) AND (ifNull(trf_kind, '') = 'o' OR (ifNull(trf_kind, '') = 's' AND ifNull(out_ok, 0) = 1 AND NOT (lowerUTF8(ifNull(t_act_cd, '')) IN ('активная'))))), 0)))), arrayWithConstant(17, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(17, toFloat64(0)), array(sum(toFloat64(ifNull(vac_open_cnt, 0))), sum(toFloat64(ifNull(vac_close_cnt, 0))), sum(toFloat64(ifNull(vac_new_cnt, 0))), sum(toFloat64(ifNull(vac_ttf_days, 0))), sum(toFloat64(ifNull(vac_ttf_cnt, 0))), sum(toFloat64(ifNull(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0), 0)))), arrayWithConstant(3, toFloat64(0))) AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(23, toFloat64(0)), array(sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_pen, 0))), sum(toFloat64(ifNull(ai_pen_co, 0))))) AS a2
      FROM prod_proteus.teampulse_hub_ai
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(26, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 27)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
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
                '","def":"', (SELECT d FROM cx),
                '","dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
                ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,aiw,aip,aic"',
                ',"req":', toJSONString(array((SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl = 7))),
                ',"paint":', toJSONString(CAST([], 'Array(String)')),
                ',"it":', toJSONString(CAST([], 'Array(String)')),
                ',"staff":', toJSONString(CAST([], 'Array(String)')),
                ',"act":', toJSONString(array('Активная')),
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

  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', t.hd, '\t', ifNull(f.fds, '')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM st2 AS t
  LEFT JOIN fdr AS f ON f.fr = t.id

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
            arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                        arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3))) AS c0
    FROM
    (
      SELECT lm, m0, n, r, d, dd, d AS s,
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
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''))) AS al FROM prod_proteus.teampulse_hub_unit) AS ua
    )
  ),
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd
    FROM prod_proteus.teampulse_hub_unit
  ),
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
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
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(array(sum(toFloat64(ifNull(hc_cnt, 0))), sum(toFloat64(ifNull(act_cnt, 0))), sum(toFloat64(ifNull(avg_cnt, 0))), sum(toFloat64(ifNull(hire_cnt, 0))), sum(toFloat64(ifNull(fire_cnt, 0))), sum(toFloat64(ifNull(reg_cnt, 0))), sum(toFloat64(ifNull(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0), 0)))), arrayWithConstant(2, toFloat64(0)), array(sum(toFloat64(ifNull(pnor_cnt, 0))), sum(toFloat64(ifNull(plow_cnt, 0))), sum(toFloat64(ifNull(phig_cnt, 0))), sum(toFloat64(ifNull(pgry_cnt, 0))), sum(toFloat64(ifNull(wday_amt, 0))), sum(toFloat64(ifNull(ovis_amt, 0))), sum(toFloat64(ifNull(gapr_cnt, 0))), sum(toFloat64(ifNull(gdec_cnt, 0)))), arrayWithConstant(9, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0)
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(7, toFloat64(0)), array(sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64((lowerUTF8(ifNull(t_act_cd, '')) IN ('активная')) AND (ifNull(trf_kind, '') = 'i' OR (ifNull(trf_kind, '') = 's' AND ifNull(in_ok, 0) = 1 AND NOT (lowerUTF8(ifNull(f_act_cd, '')) IN ('активная'))))), 0))), sum(toFloat64(ifNull(toFloat64(ifNull(trf_cnt, 0)) * toFloat64((lowerUTF8(ifNull(f_act_cd, '')) IN ('активная')) AND (ifNull(trf_kind, '') = 'o' OR (ifNull(trf_kind, '') = 's' AND ifNull(out_ok, 0) = 1 AND NOT (lowerUTF8(ifNull(t_act_cd, '')) IN ('активная'))))), 0)))), arrayWithConstant(17, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_trf WHERE 0)
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(17, toFloat64(0)), array(sum(toFloat64(ifNull(vac_open_cnt, 0))), sum(toFloat64(ifNull(vac_close_cnt, 0))), sum(toFloat64(ifNull(vac_new_cnt, 0))), sum(toFloat64(ifNull(vac_ttf_days, 0))), sum(toFloat64(ifNull(vac_ttf_cnt, 0))), sum(toFloat64(ifNull(if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0), 0)))), arrayWithConstant(3, toFloat64(0))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_vacancy WHERE 0)
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month)))) AS i2, arrayConcat(arrayWithConstant(23, toFloat64(0)), array(sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_pen, 0))), sum(toFloat64(ifNull(ai_pen_co, 0))))) AS a2
      FROM (SELECT * FROM prod_proteus.teampulse_hub_ai WHERE 0)
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant(26, toFloat64(0)) AS a2
      FROM cx
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, 27)) AS tr,
           arraySum(x -> x[1] + x[4] + x[5] + x[8] + x[9], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM (SELECT * FROM prod_proteus.teampulse_hub_mix WHERE 0)
      WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND (ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅') = '∅' OR lowerUTF8(ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')) IN ('активная'))
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
        WHERE ifNull(node_rk, '') IN (SELECT tupleElement(arrayJoin(pks), 1) FROM cx) AND report_month >= toStartOfYear((SELECT lm FROM cx))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
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
                '","def":"', (SELECT d FROM cx),
                '","dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement((SELECT fv FROM fdv), 4), '∅'), '', ',"act"'), ']',
                ',"mk":"hc,act,avg,hire,fire,reg,nreg,tin,tout,pnor,plow,phig,pgry,wday,ovis,gapr,gdec,vop,vcl,vap,vtd,vtn,vjn,aiw,aip,aic"',
                ',"req":', toJSONString(CAST([], 'Array(String)')),
                ',"paint":', toJSONString(CAST([], 'Array(String)')),
                ',"it":', toJSONString(CAST([], 'Array(String)')),
                ',"staff":', toJSONString(CAST([], 'Array(String)')),
                ',"act":', toJSONString(array('Активная')),
                ',"vals":', (SELECT concat('{"paint":', toJSONString(groupArrayIf((v, e), g = 1)), ',"it":', toJSONString(groupArrayIf((v, e), g = 2)),
                 ',"staff":', toJSONString(groupArrayIf((v, e), g = 3)), ',"act":', toJSONString(groupArrayIf((v, e), g = 4)), '}')
  FROM (
    SELECT gv.1 AS g, gv.2 AS v, sum(ifNull(hc_cnt, 0)) AS e
    FROM (SELECT * FROM prod_proteus.teampulse_hub_series WHERE 0)
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

  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', t.hd, '\t', ifNull(f.fds, '')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM st2 AS t
  LEFT JOIN fdr AS f ON f.fr = t.id

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

-- ============================================================================
-- 5а. SQL Lab — водопад сходится: численность, найм, отток и переводы по таблицам ноутбука
-- (поставка 56). База CROSS, после выгрузки teampulse_hub_* новым ноутбуком (файл 1 или 1а).
--
-- Выделите запрос целиком — от SELECT до точки с запятой — и выполните (Ctrl+Enter). Ответ — в чат:
-- строка на месяц, только суммы по всей компании, без людей.
--
-- Что считается — ровно как в датасете 2а при настройках отчёта по умолчанию (вся компания, активная
-- численность, без других фильтров):
--   hc       численность на конец месяца (у текущего — на дату данных)
--   d_hc     изменение к прошлому месяцу
--   hire     найм по дню события: найм в компанию (вид h) и переходы кандидатов учебных юнитов и стажёров
--            в активную (in_ok = 0)
--   fire     увольнения
--   tin/tout переводы в активную численность компании и из неё (по флагам источника)
--   prochee  «прочее» водопада: d_hc − (hire − fire + tin − tout). Ждём 0 во всех месяцах, кроме первого
--            (у него нет прошлого месяца в таблице)
--   x_in/out смены без флага источника, по видам x…: пришёл без найма или перевода, ушёл без увольнения
--            или перевода. Если prochee не 0 — он должен быть равен x_in − x_out, и тогда это сбой
--            данных; если не равен — пришлите ответ, разберём
--
-- Другой выбор — поменяйте условие в двух местах, отмеченных «←»: например HQ на активной —
--   series: paint_cd = 'HQ' AND act_cd = 'Активная';
--   trf:    (t_paint_cd = 'HQ' AND t_act_cd = 'Активная') и (f_paint_cd = 'HQ' AND f_act_cd = 'Активная')
-- Подразделение — в обоих местах «node_rk = (SELECT …)» поставьте ключ юнита: node_rk = 'ключ'.
-- ============================================================================
SELECT m, hc,
       hc - lagInFrame(hc, 1, hc) OVER (ORDER BY m ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS d_hc,
       hire, fire, tin, tout,
       d_hc - (hire - fire + tin - tout) AS prochee,
       x_in, x_out
FROM (
  SELECT report_month AS m,
         sum(if(act_cd = 'Активная', ifNull(hc_cnt, 0), 0)) AS hc,                          -- ← выбор
         sum(if(act_cd = 'Активная', ifNull(fire_cnt, 0), 0)) AS fire                       -- ← выбор
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT any(root_rk) FROM prod_proteus.teampulse_hub_meta)
  GROUP BY m
) AS s
LEFT JOIN (
  SELECT m,
         sum(if(k = 'h' AND ti OR k IN ('i', 's') AND ent AND ok = 0, n, 0)) AS hire,
         sum(if(k IN ('i', 's') AND ent AND ok = 1, n, 0)) AS tin,
         sum(if(fi AND (k = 'o' OR k = 's' AND oo = 1 AND NOT ti), n, 0)) AS tout,
         sum(if(k IN ('xi', 'xa') AND ti OR k = 'xs' AND ti AND NOT fi, n, 0)) AS x_in,
         sum(if(k IN ('xo', 'xd') AND fi OR k = 'xs' AND fi AND NOT ti, n, 0)) AS x_out
  FROM (
    SELECT report_month AS m, trf_kind AS k, ifNull(trf_cnt, 0) AS n, ifNull(in_ok, 1) AS ok, ifNull(out_ok, 1) AS oo,
           t_act_cd = 'Активная' AS ti,                                                     -- ← выбор «после»
           f_act_cd = 'Активная' AS fi,                                                     -- ← выбор «до»
           ti AND (trf_kind = 'i' OR trf_kind = 's' AND NOT fi) AS ent
    FROM prod_proteus.teampulse_hub_trf
    WHERE node_rk = (SELECT any(root_rk) FROM prod_proteus.teampulse_hub_meta)
  ) AS r
  GROUP BY m
) AS t USING (m)
ORDER BY m;

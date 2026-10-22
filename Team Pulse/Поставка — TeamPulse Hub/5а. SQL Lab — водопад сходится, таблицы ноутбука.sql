-- ============================================================================
-- 5а. SQL Lab — водопад: численность, найм, отток и переводы по таблицам ноутбука (поставки 56, 59).
-- База CROSS, после выгрузки teampulse_hub_* новым ноутбуком (файл 1 или 1а).
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
--   tin/tout переводы в активную численность и из неё — с поставки 59 по правилу мастер-отчёта: строка с флагом
--            юнита или типа численности, состояние строки — «Активная»
--   prochee  «прочее» водопада: d_hc − (hire − fire + tin − tout). Мастер-отчёт считает переводы по флагам
--            источника как есть, поэтому prochee — это изменения численности без флага (или флаги без
--            изменения). Первый месяц не в счёт: у него нет прошлого месяца в таблице
--
-- Другой выбор — поменяйте условия, отмеченные «←»: например HQ на активной —
--   series: paint_cd = 'HQ' AND act_cd = 'Активная';
--   trf:    paint_cd = 'HQ' AND act_cd = 'Активная', флаги — fu, fa и fp (покраска выбрана одним значением)
-- Подразделение — в обоих местах «node_rk = (SELECT …)» поставьте ключ юнита: node_rk = 'ключ'.
-- ============================================================================
SELECT m, hc,
       hc - lagInFrame(hc, 1, hc) OVER (ORDER BY m ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS d_hc,
       hire, fire, tin, tout,
       d_hc - (hire - fire + tin - tout) AS prochee
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
         sum(if(k = 'h' OR k = 'i' AND f AND ok = 0, n, 0)) AS hire,
         sum(if(k = 'i' AND f AND ok = 1, n, 0)) AS tin,
         sum(if(k = 'o' AND f, n, 0)) AS tout
  FROM (
    SELECT report_month AS m, trf_kind AS k, ifNull(trf_cnt, 0) AS n, ifNull(in_ok, 1) AS ok,
           ifNull(fu, 0) = 1 OR ifNull(fa, 0) = 1 AS f                                        -- ← флаги выбора
    FROM prod_proteus.teampulse_hub_trf
    WHERE node_rk = (SELECT any(root_rk) FROM prod_proteus.teampulse_hub_meta)
      AND act_cd = 'Активная'                                                                -- ← выбор
  ) AS r
  GROUP BY m
) AS t USING (m)
ORDER BY m;

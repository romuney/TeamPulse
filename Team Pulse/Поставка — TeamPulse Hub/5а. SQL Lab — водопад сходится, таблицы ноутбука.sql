-- ============================================================================
-- 5а. SQL Lab — водопад: численность, найм, отток и переводы по таблицам ноутбука (поставки 56, 59, 60).
-- База CROSS, после выгрузки teampulse_hub_* новым ноутбуком (файл 1 или 1а).
--
-- Выделите запрос целиком — от SELECT до точки с запятой — и выполните (Ctrl+Enter). Ответ — в чат:
-- строка на месяц, только суммы по всей компании, без людей.
--
-- Что считается — ровно как в датасете 2а при настройках отчёта по умолчанию (вся компания, «Активные» —
-- типы численности «Активная» и «Подрядчики», без других фильтров):
--   hc       численность на конец месяца (у текущего — на дату данных)
--   d_hc     изменение к прошлому месяцу
--   hire     найм по дню события: найм в компанию (вид h) и переходы кандидатов учебных юнитов и стажёров
--            в «Активные» (in_ok = 0)
--   fire     увольнения
--   tin/tout переводы в «Активные» и из них — по правилу мастер-отчёта: строка с флагом юнита или типа
--            численности, тип строки — «Активная» или «Подрядчики». Смена типа — перевод, только если соседний
--            день (x_act_cd) вне «Активных»: подрядчик в штат — не перевод
--   prochee  «прочее» водопада: d_hc − (hire − fire + tin − tout). Мастер-отчёт считает переводы по флагам
--            источника как есть, поэтому prochee — это изменения численности без флага (или флаги без
--            изменения). Первый месяц не в счёт: у него нет прошлого месяца в таблице
--
-- Другой выбор — поменяйте условия, отмеченные «←»: например HQ на «Активных» —
--   series: paint_cd = 'HQ' AND act_cd IN ('Активная', 'Подрядчики');
--   trf:    то же, флаги — fu, fa (с x_act_cd, как ниже) и fp (покраска выбрана одним значением)
-- Один тип (только «Активная») — act_cd = 'Активная', а флаг типа — просто fa = 1.
-- Подразделение — в обоих местах «node_rk = (SELECT …)» поставьте ключ юнита: node_rk = 'ключ'.
-- ============================================================================
SELECT m, hc,
       hc - lagInFrame(hc, 1, hc) OVER (ORDER BY m ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS d_hc,
       hire, fire, tin, tout,
       d_hc - (hire - fire + tin - tout) AS prochee
FROM (
  SELECT report_month AS m,
         sum(if(act_cd IN ('Активная', 'Подрядчики'), ifNull(hc_cnt, 0), 0)) AS hc,         -- ← выбор
         sum(if(act_cd IN ('Активная', 'Подрядчики'), ifNull(fire_cnt, 0), 0)) AS fire      -- ← выбор
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
           ifNull(fu, 0) = 1                                                                   -- ← флаги выбора
             OR ifNull(fa, 0) = 1 AND ifNull(x_act_cd, '') NOT IN ('Активная', 'Подрядчики') AS f
    FROM prod_proteus.teampulse_hub_trf
    WHERE node_rk = (SELECT any(root_rk) FROM prod_proteus.teampulse_hub_meta)
      AND act_cd IN ('Активная', 'Подрядчики')                                               -- ← выбор
  ) AS r
  GROUP BY m
) AS t USING (m)
ORDER BY m;

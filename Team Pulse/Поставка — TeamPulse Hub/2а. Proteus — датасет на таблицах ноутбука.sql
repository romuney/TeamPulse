{#- ============================================================================
    teampulse_hub — датасет чарта TeamPulse Hub на таблицах ноутбука сборки
    («1. Helicopter — ноут TeamPulse Hub.yaml»). Замена файла 2, когда ноутбук запущен и
    таблицы prod_proteus.teampulse_hub_* выгружены. Ответ — тот же по формату: чарт (файл 3)
    не меняется.

    Запрос не кешируется и выполняется на каждое открытие и смену юнита или фильтров, поэтому
    здесь нет ни одного тяжёлого шага. Всё посчитано в ноутбуке:
      teampulse_hub_meta    календарь отчёта, корень, юнит по умолчанию (1 строка)
      teampulse_hub_unit    узлы нынешней структуры: родитель, уровень, имя, подразделения, путь
      teampulse_hub_series  узел × месяц × срез: ряды по всему поддереву узла, ССЧ, переводы через
                            границу узла
      teampulse_hub_mix     узел × срез × разрез × значение: численность и увольнения по разрезам
    Датасет выбирает узлы ответа (выбранный юнит, база, три уровня под ним), суммирует их строки
    по выбранным срезам и собирает ответ.

    Строки различаются колонкой role, порядок задан ORDER BY:
      meta   1 строка, j — JSON: lm, m0, n, сегодня, корень, выбранный юнит, юнит по умолчанию,
             фильтры (cuts), эхо применённых фильтров, значения фильтров с численностью компании
      scope  выбранный юнит          base  вся компания под теми же фильтрами
      dict   1 строка, j — «id \t pid \t уровень \t детей \t имя» через \n: предки выбранного
             юнита и пять верхних уровней
      c / g / x  подразделения на один, два, три уровня ниже выбранного
      end    маркер «ответ целиком»
    Массивы m_* — месяцы от января прошлого года до последнего закрытого, строкой через запятую;
    mx — разрезы «ключ \t значение \t число» через \n (как в файле 2).

    Фильтры — кросс-фильтры чарта: unit_f — ключ узла, paint_f — покраска, it_f — IT-код,
    staff_f — «Штат» / «Не штат». Сравнение без учёта регистра (чарт шлёт «NonIT» и «Hq»).
    Колонки-носители в SELECT не выводятся. id узла — ключ юнита из источника.
    Проверено на ClickHouse 24.8: ноутбук целиком на синтетике по людям и дням (stand/nb_tp20.py
    --hub), шесть настроек сервера; ответ сверен с правдой по людям и с файлом 2.
============================================================================ -#}
{#- Строковый литерал ClickHouse: сначала слэш → \\, затем кавычка → '' (не \': лексер
    sqlparse Proteus его не понимает — тихо меняет ответ); слэши в конце — repeat(char(92), N). -#}
{% macro qs(v) -%}
{%- set s = v|string -%}{%- set t = s.rstrip('\\') -%}
{%- if t|length < s|length -%}concat('{{ t|replace('\\', '\\\\')|replace("'", "''") }}', repeat(char(92), {{ s|length - t|length }}))
{%- else -%}'{{ s|replace('\\', '\\\\')|replace("'", "''") }}'{%- endif -%}
{%- endmacro %}
{#- Массив строк для has() и toJSONString(); пустой — типизированный. array(…), а не […]:
    «]» в значении sqlparse принял бы за конец имени [..] и сбил строки (значений ≤ 20). -#}
{% macro qa(values) -%}
{%- if values|length == 0 -%}CAST([], 'Array(String)'){%- else -%}array({% for v in values %}{{ qs(v) }}{% if not loop.last %}, {% endif %}{% endfor %}){%- endif -%}
{%- endmacro %}
{#- Значения фильтров собираются циклом: при сохранении датасета Proteus отдаёт
    вместо списка AlwaysTrueObject — у него нет ни длины, ни «+». -#}
{% set unit_req = [] %}{% for v in (filter_values('unit_f') or []) %}{% if v|string|trim != '' and unit_req|length < 1 %}{% set _ = unit_req.append(v|string|trim) %}{% endif %}{% endfor %}
{% set CUTS = [['paint', 'paint_f', "ifNull(paint_cd, '-')"], ['it', 'it_f', "ifNull(it_cd, '-')"], ['staff', 'staff_f', "ifNull(staff_cd, '-')"]] %}
{% set F = {} %}
{% for c in CUTS %}{% set vals = [] %}{% for v in (filter_values(c[1]) or []) %}{% if v|string != '' and vals|length < 20 %}{% set _ = vals.append(v|string) %}{% endif %}{% endfor %}{% set _ = F.update({c[0]: vals}) %}{% endfor %}
{#- Строка проходит фильтры: значение в выбранном списке без учёта регистра; не выбран — 1. -#}
{% macro cond() -%}
{%- set parts = [] -%}
{%- for c in CUTS -%}{%- if F[c[0]]|length > 0 -%}{%- set _ = parts.append('has(arrayMap(x -> lowerUTF8(x), ' ~ qa(F[c[0]]) ~ '), lowerUTF8(' ~ c[2] ~ '))') -%}{%- endif -%}{%- endfor -%}
{{- parts|join(' AND ') if parts else '1' -}}
{%- endmacro %}
{#- Массив месяцев строкой: дроби только у ССЧ (полусумма) и мониторинга. -#}
{% macro out(a) -%}arrayStringConcat(arrayMap(x -> toString(round(x, 1)), {{ a }}), ','){%- endmacro %}
{% set M = [['hc', 'e', 'hc_cnt'], ['act', 'ea', 'act_cnt'], ['avg', 'sa', 'avg_cnt'], ['hire', 'hi', 'hire_cnt'], ['fire', 'fi', 'fire_cnt'], ['reg', 'rg', 'reg_cnt'], ['tin', 'ti', 'tin_cnt'], ['tout', 'tu', 'tout_cnt'], ['pnor', 'pn', 'pnor_cnt'], ['plow', 'pl', 'plow_cnt'], ['phig', 'ph', 'phig_cnt'], ['pgry', 'pg', 'pgry_cnt'], ['wday', 'wd', 'wday_amt'], ['ovis', 'ov', 'ovis_amt'], ['gapr', 'ga', 'gapr_cnt'], ['gdec', 'gd', 'gdec_cnt']] %}
{#- Значения фильтра с численностью компании за последний закрытый месяц (окно настройки). -#}
{% macro vals(col) -%}
(SELECT toJSONString(groupArray((v, e))) FROM (
  SELECT ifNull({{ col }}, '-') AS v, sum(ifNull(hc_cnt, 0)) AS e
  FROM prod_proteus.teampulse_hub_series
  WHERE node_rk = (SELECT r FROM cal) AND report_month = (SELECT lm FROM cal)
  GROUP BY v ORDER BY e DESC, v))
{%- endmacro %}
{#- Пустые колонки для служебных строк (meta, dict, end). -#}
{% macro blank() -%}{% for m in M %}'' AS m_{{ m[0] }}, {% endfor %}'' AS mx{%- endmacro %}
{#- Запрос начинается с SELECT, цепочка CTE — внутри: так его без правок принимает и SQL Lab. -#}
SELECT role, id, pid, lvl, nm, kids, j,
       {% for m in M %}m_{{ m[0] }}, {% endfor %}mx
FROM
(
WITH
  -- Календарь, корень и юнит по умолчанию — из ноутбука (псевдонимы нигде не совпадают с
  -- колонками, из которых считаются: на таком совпадении новый анализатор ClickHouse 24.8
  -- отдаёт пустой скалярный подзапрос)
  cal AS (
    SELECT toDate(assumeNotNull(last_month)) AS lm, toDate(assumeNotNull(grid_start)) AS m0,
           toUInt32(ifNull(n_months, 0)) AS n, toUInt32(ifNull(ytd_idx, 0)) AS iy,
           ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d
    FROM prod_proteus.teampulse_hub_meta
    LIMIT 1
  ),
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, ifNull(path_rk, '') AS pth
    FROM prod_proteus.teampulse_hub_unit
  ),
  req AS (SELECT any(id) AS q, count() AS c FROM st2 WHERE {% if unit_req %}id = {{ qs(unit_req[0]) }}{% else %}0{% endif %}),
  sc AS (SELECT if(req.c > 0, req.q, (SELECT d FROM cal)) AS s FROM req),
  -- Три уровня вниз от выбранного юнита
  d1 AS (SELECT id FROM st2 WHERE pid = (SELECT s FROM sc) AND id != ''),
  d2 AS (SELECT id FROM st2 WHERE pid IN (SELECT id FROM d1)),
  d3 AS (SELECT id FROM st2 WHERE pid IN (SELECT id FROM d2)),
  -- Предки выбранного юнита — его путь без него самого
  anc AS (SELECT arrayPopBack(splitByChar('|', any(pth))) AS arr FROM st2 WHERE id = (SELECT s FROM sc)),
  -- Узлы ответа: o — порядок строк в ответе
  pick AS (
    SELECT s AS id, toUInt8(1) AS o FROM sc
    UNION ALL SELECT r AS id, toUInt8(2) AS o FROM cal
    UNION ALL SELECT id, toUInt8(5) AS o FROM d1
    UNION ALL SELECT id, toUInt8(6) AS o FROM d2
    UNION ALL SELECT id, toUInt8(7) AS o FROM d3
  ),
  -- Ряды узлов ответа под фильтрами; нулевая строка — чтобы узел без людей получил массивы
  mm AS (
    SELECT u2 AS rk, i2 AS idx,
{%- for m in M %}
           sum({{ m[1] }}0) AS {{ m[1] }}{% if not loop.last %},{% endif %}
{%- endfor %}
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i2,
{%- for m in M %}
             toFloat64(ifNull({{ m[2] }}, 0)) AS {{ m[1] }}0{% if not loop.last %},{% endif %}
{%- endfor %}
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN (SELECT id FROM pick)
        AND report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
        AND {{ cond() }}
      UNION ALL
      SELECT id AS u2, toInt32(0) AS i2,
{%- for m in M %}
             toFloat64(0) AS {{ m[1] }}0{% if not loop.last %},{% endif %}
{%- endfor %}
      FROM pick
    )
    GROUP BY u2, i2
  ),
  arr AS (
    SELECT rk,
{%- for m in M %}
           sumForEach(arrayMap(i -> if(i = idx, {{ m[1] }}, 0), range((SELECT n FROM cal)))) AS a_{{ m[0] }}{% if not loop.last %},{% endif %}
{%- endfor %}
    FROM mm
    GROUP BY rk
  ),
  -- Разрезы узлов ответа под фильтрами: «ключ \t значение \t число» через \n, отсортировано
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      WHERE node_rk IN (SELECT id FROM pick) AND {{ cond() }}
      GROUP BY u3, k3, v3
      HAVING n4 > 0
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
                '","schema":"hub-1","cuts":["paint","it","staff"]',
                ',"req":', toJSONString({{ qa(unit_req) }}),
                ',"paint":', toJSONString({{ qa(F['paint']) }}),
                ',"it":', toJSONString({{ qa(F['it']) }}),
                ',"staff":', toJSONString({{ qa(F['staff']) }}),
                ',"vals":{"paint":', {{ vals('paint_cd') }}, ',"it":', {{ vals('it_cd') }}, ',"staff":', {{ vals('staff_cd') }},
                '}}') AS j,
         {{ blank() }}

  UNION ALL

  SELECT p.o AS o, multiIf(p.o = 1, 'scope', p.o = 2, 'base', p.o = 5, 'c', p.o = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm, s.kd AS kids, '' AS j,
{%- for m in M %}
         {{ out('a.a_' ~ m[0]) }} AS m_{{ m[0] }},
{%- endfor %}
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
                                             toString(t.kd), '\t', t.nm0))), '\n') AS j,
         {{ blank() }}
  FROM st2 AS t
  WHERE t.lv <= (SELECT min(lv) FROM st2) + 4 OR has((SELECT arr FROM anc), t.id) OR t.id = (SELECT s FROM sc)

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, {{ blank() }}
)
)
ORDER BY o, lvl, nm, id

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
             фильтры (cuts), эхо применённых фильтров, значения фильтров с численностью компании,
             словари распределения fdv (порядок значений, по которому кодируется fd)
      scope  выбранный юнит          base  вся компания под теми же фильтрами
      dict   1 строка, j — все узлы: «id \t pid \t уровень \t детей \t имя \t руководитель \t fd»
             через \n. Руководитель — логин (head_login таблицы юнитов; колонки нет — пусто).
             fd — численность узла в последнем месяце по сочетаниям значений фильтров без учёта
             применённых: «код:число» через пробел, код = ((номер покраски × число IT + номер IT) ×
             число значений штата + номер штата) × число типов численности + номер типа (номера —
             в meta.fdv; без act_cd типов один). Окно настройки считает по нему «сколько людей
             попадёт в выбор» без запроса (19.10, как в HRBP HUB)
      c / g / x  подразделения на один, два, три уровня ниже выбранного
      end    маркер «ответ целиком»
    Массивы m_* — месяцы от января прошлого года до последнего (и текущего незакрытого), строкой через запятую;
    mx — разрезы «ключ \t значение \t число» через \n (как в файле 2).

    Фильтры — кросс-фильтры чарта: unit_f — ключ узла, paint_f — покраска (HQ, Line, Support),
    it_f — IT-код (IT, Digital, NonIT), staff_f — «Штат» / «Не штат», act_f — тип численности
    (20.10): без фильтра — «Активная» (отчёт по умолчанию на активной численности), «Вся» — все
    строки. Сравнение без учёта регистра (чарт шлёт «Hq»). act_cd и hco_cnt читаются матчером:
    таблицы ноутбука до 20.10 их не знают — тогда фильтра типа нет (meta.cuts без «act»), отчёт
    по всей численности, найм — hire_cnt.
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
{#- Тип численности строки: act_cd матчером; колонки нет — «∅» (строка проходит любой фильтр типа). -#}
{% set AC = "ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')" %}
{% set CUTS = [['paint', 'paint_f', "ifNull(paint_cd, '-')"], ['it', 'it_f', "ifNull(it_cd, '-')"], ['staff', 'staff_f', "ifNull(staff_cd, '-')"], ['act', 'act_f', AC]] %}
{% set F = {} %}
{% for c in CUTS %}{% set vals = [] %}{% for v in (filter_values(c[1]) or []) %}{% if v|string != '' and vals|length < 20 %}{% set _ = vals.append(v|string) %}{% endif %}{% endfor %}{% set _ = F.update({c[0]: vals}) %}{% endfor %}
{#- Тип численности: не выбран — «Активная»; «Вся» — без фильтра. -#}
{% set av = [] %}{% for v in F['act'] %}{% set _ = av.append(v|lower) %}{% endfor %}
{% if 'вся' in av or 'all' in av %}{% set _ = F.update({'act': []}) %}{% elif av|length == 0 %}{% set _ = F.update({'act': ['Активная']}) %}{% endif %}
{% set act_only = F['act']|length == 1 and (F['act'][0]|lower) == 'активная' %}
{#- Найм: на активной — по методологии HR (hire_cnt: в компанию + из учебной группы в боевую +
    стажёры в штат), на всей — найм в компанию с любым типом (hco_cnt; нет колонки — hire_cnt). -#}
{% set HCO = "ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hco_cnt$') APPLY(toFloat64)], [toFloat64(hire_cnt)]), 1), 0)" %}
{#- Строка проходит фильтры: значение в выбранном списке без учёта регистра; не выбран — 1. -#}
{% macro cond() -%}
{%- set parts = [] -%}
{%- for c in CUTS -%}{%- if F[c[0]]|length > 0 -%}{%- set hv = 'has(arrayMap(x -> lowerUTF8(x), ' ~ qa(F[c[0]]) ~ '), lowerUTF8(' ~ c[2] ~ '))' -%}{%- set _ = parts.append(("(" ~ c[2] ~ " = '∅' OR " ~ hv ~ ")") if c[0] == 'act' else hv) -%}{%- endif -%}{%- endfor -%}
{{- parts|join(' AND ') if parts else '1' -}}
{%- endmacro %}
{#- Массив месяцев строкой: дроби только у ССЧ (полусумма) и мониторинга. -#}
{% macro out(a) -%}arrayStringConcat(arrayMap(x -> toString(round(x, 1)), {{ a }}), ','){%- endmacro %}
{% set M = [['hc', 'e', 'hc_cnt'], ['act', 'ea', 'act_cnt'], ['avg', 'sa', 'avg_cnt'], ['hire', 'hi', 'hire_cnt' if act_only else HCO], ['fire', 'fi', 'fire_cnt'], ['reg', 'rg', 'reg_cnt'], ['tin', 'ti', 'tin_cnt'], ['tout', 'tu', 'tout_cnt'], ['pnor', 'pn', 'pnor_cnt'], ['plow', 'pl', 'plow_cnt'], ['phig', 'ph', 'phig_cnt'], ['pgry', 'pg', 'pgry_cnt'], ['wday', 'wd', 'wday_amt'], ['ovis', 'ov', 'ovis_amt'], ['gapr', 'ga', 'gapr_cnt'], ['gdec', 'gd', 'gdec_cnt']] %}
{#- Значения фильтра с численностью компании за последний месяц (окно настройки). -#}
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
           ifNull(root_rk, '') AS r, ifNull(def_rk, '') AS d,
           -- дата данных (текущий незакрытый месяц) — матчером: старая таблица без data_dt даёт ''
           ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^data_dt$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '') AS dd
    FROM prod_proteus.teampulse_hub_meta
    LIMIT 1
  ),
  -- head_login — матчером, в подзапросе без JOIN (так его видят оба анализатора): таблица без
  -- колонки (ноутбук не перезапущен) даёт пустой логин, отчёт работает (как в HRBP HUB)
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, ifNull(path_rk, '') AS pth,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd
    FROM prod_proteus.teampulse_hub_unit
  ),
  -- Численность последнего месяца по значениям фильтров (ряды узла — уже вся ветка); fa / fb /
  -- fc — порядок значений, по которому кодируется сочетание (в meta — fdv)
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, {{ AC }} AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
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
  req AS (SELECT any(id) AS q, count() AS c FROM st2 WHERE {% if unit_req %}id = {{ qs(unit_req[0]) }}{% else %}0{% endif %}),
  sc AS (SELECT if(req.c > 0, req.q, (SELECT d FROM cal)) AS s FROM req),
  -- Три уровня вниз от выбранного юнита
  d1 AS (SELECT id FROM st2 WHERE pid = (SELECT s FROM sc) AND id != ''),
  d2 AS (SELECT id FROM st2 WHERE pid IN (SELECT id FROM d1)),
  d3 AS (SELECT id FROM st2 WHERE pid IN (SELECT id FROM d2)),
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
                '","dt":"', (SELECT dd FROM cal), '","schema":"hub-2","cuts":["paint","it","staff"', if(has((SELECT fe FROM fdv), '∅'), '', ',"act"'), ']',
                ',"req":', toJSONString({{ qa(unit_req) }}),
                ',"paint":', toJSONString({{ qa(F['paint']) }}),
                ',"it":', toJSONString({{ qa(F['it']) }}),
                ',"staff":', toJSONString({{ qa(F['staff']) }}),
                ',"act":', toJSONString({{ qa(F['act']) }}),
                ',"vals":{"paint":', {{ vals('paint_cd') }}, ',"it":', {{ vals('it_cd') }}, ',"staff":', {{ vals('staff_cd') }},
                ',"act":', {{ vals(AC) }},
                '},"fdv":{"paint":', toJSONString((SELECT fa FROM fdv)), ',"it":', toJSONString((SELECT fb FROM fdv)),
                ',"staff":', toJSONString((SELECT fc FROM fdv)),
                ',"act":', toJSONString(if(has((SELECT fe FROM fdv), '∅'), CAST([], 'Array(String)'), (SELECT fe FROM fdv))), '}}') AS j,
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
                                             toString(t.kd), '\t', t.nm0, '\t', t.hd, '\t', ifNull(f.fds, '')))), '\n') AS j,
         {{ blank() }}
  FROM st2 AS t
  LEFT JOIN fdr AS f ON f.fr = t.id

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, {{ blank() }}
)
)
ORDER BY o, lvl, nm, id

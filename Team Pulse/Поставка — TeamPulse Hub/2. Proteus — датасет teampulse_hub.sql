{#- ============================================================================
    teampulse_hub — датасет единственного чарта TeamPulse Hub (Proteus, база CROSS).
    Пробник: всё, что даёт prod_proteus.hr_structure_overall (SOURCES.md §18).

    В этой таблице цифры юнита УЖЕ включают всё его поддерево. Поэтому юнит
    берётся своими строками, а подразделения не складываются никогда: сумма
    детей дала бы двойной счёт. Люди прямо в юните («Напрямую в «X»») — это
    юнит минус его прямые подразделения; разницу считает чарт.

    Один ответ везёт всё, что чарту нужно до следующей смены юнита или фильтров:
    выбранный юнит, три уровня подразделений под ним, всю компанию под теми же
    фильтрами (база сравнения), путь от корня и верхние уровни для выбора юнита.
    Вкладки, раскрытие строк, выбор метрик, проценты и светофор — в чарте.

    Строки различаются колонкой role, порядок задан ORDER BY:
      meta   1 строка, j — JSON: последний полный месяц (lm), первый месяц сетки (m0),
             число месяцев (n), сегодня, корень, выбранный юнит, юнит по умолчанию,
             эхо применённых фильтров и значения фильтров с численностью компании
      scope  выбранный юнит
      base   вся компания под теми же фильтрами — база сравнения
      dict   1 строка, j — юниты для пути и выбора: «id \t pid \t уровень \t детей \t имя»
             через \n — предки выбранного юнита и пять верхних уровней
      c      подразделения на уровень ниже выбранного (pid — выбранный)
      g      на два уровня ниже (pid — строка c)
      x      на три уровня ниже (pid — строка g)
      end    маркер «ответ целиком» — всегда последняя строка
    У юнитов kids — сколько у него своих подразделений («ниже ещё N»).
    Юнит без людей и движения под выбранными фильтрами не едет (кроме scope и base).

    Массивы m_* — месяцы от января прошлого года до последнего полного (n штук),
    строкой через запятую. Процентов нет: чарт делит числитель на знаменатель.
      m_hc   численность на конец месяца        m_act  она же, тип «Активная»
      m_avg  ССЧ                                m_hire найм         m_fire увольнения
      m_reg  нежелательные увольнения           m_tin  переводы в   m_tout переводы из
      m_plow оценка «низкая»                    m_prat оценённые: норма + низкая + высокая
    Текущий месяц неполный и в ответ не едет: если в таблице уже есть строки
    текущего календарного месяца, последний полный — прошлый.

    Кросс-фильтры эмитит сам чарт (самовлияние включено): unit_f — id юнита,
    paint_f — покраска (Hq, Line, Support, -), it_f — IT-специализация (IT, Digital,
    NonIT, -), staff_f — «Штат» / «Не штат». Колонки-носители в SELECT не выводятся,
    иначе Superset повесит авто-IN на внешний запрос. id юнита — 12 знаков md5 ключа.

    Проверено на ClickHouse 24.8 на симуляции таблицы по людям: оба анализатора,
    join_use_nulls = 1, prefer_column_name_to_alias = 1 — ответ один и тот же.
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
{% set unit_req = [] %}{% for v in (filter_values('unit_f') or []) %}{% if v|string|trim != '' and unit_req|length < 1 %}{% set _ = unit_req.append(v|string|trim|lower) %}{% endif %}{% endfor %}
{% set CUTS = [['paint', 'paint_f', "ifNull(emp_specialization_oper_code, '-')"], ['it', 'it_f', "ifNull(emp_specialization_it_code, '-')"], ['staff', 'staff_f', "if(ifNull(employment_relation_type_desc, '') = 'Штатный сотрудник', 'Штат', 'Не штат')"]] %}
{% set F = {} %}
{% for c in CUTS %}{% set vals = [] %}{% for v in (filter_values(c[1]) or []) %}{% if v|string != '' and vals|length < 20 %}{% set _ = vals.append(v|string) %}{% endif %}{% endfor %}{% set _ = F.update({c[0]: vals}) %}{% endfor %}
{#- Строка проходит фильтры: значение в выбранном списке; фильтр не выбран — 1. -#}
{% macro cond() -%}
{%- set parts = [] -%}
{%- for c in CUTS -%}{%- if F[c[0]]|length > 0 -%}{%- set _ = parts.append('has(' ~ qa(F[c[0]]) ~ ', ' ~ c[2] ~ ')') -%}{%- endif -%}{%- endfor -%}
{{- parts|join(' AND ') if parts else '1' -}}
{%- endmacro %}
{#- Массив месяцев строкой: дроби только у ССЧ (полусумма). -#}
{% macro out(a) -%}arrayStringConcat(arrayMap(x -> toString(round(x, 1)), {{ a }}), ','){%- endmacro %}
{% set M = [['hc', 'e'], ['act', 'ea'], ['avg', 'sa'], ['hire', 'hi'], ['fire', 'fi'], ['reg', 'rg'], ['tin', 'ti'], ['tout', 'tu'], ['plow', 'pl'], ['prat', 'pr']] %}
{#- Запрос начинается с SELECT, цепочка CTE — внутри: так его без правок принимает и SQL Lab
    (там пропускаются только SELECT и DESCRIBE) — датасет можно проверить целиком. -#}
SELECT role, id, pid, lvl, nm, kids, j,
       m_hc, m_act, m_avg, m_hire, m_fire, m_reg, m_tin, m_tout, m_plow, m_prat
FROM
(
WITH
  -- Календарь: последний полный месяц и сетка от января прошлого года
  cal AS (
    SELECT toDate(ifNull(max(month), toDate('1970-01-01'))) AS mx,
           if(mx >= toStartOfMonth(today()), addMonths(mx, -1), mx) AS lm,
           toStartOfYear(addYears(lm, -1)) AS m0,
           toUInt32(dateDiff('month', m0, lm) + 1) AS n
    FROM prod_proteus.hr_structure_overall
  ),
  -- Дерево последнего полного месяца. У юнита с двумя родителями берём одного
  -- (псевдоним нигде не совпадает с колонкой, из которой считается: на таком
  -- совпадении новый анализатор ClickHouse 24.8 отдаёт пустой скалярный подзапрос)
  st AS (
    SELECT u0 AS rk, min(p0) AS prk, any(l0) AS lv, any(n0) AS nm
    FROM
    (
      SELECT ifNull(mngt_unit_rk, '') AS u0, ifNull(parent_mngt_unit_rk, '') AS p0,
             toInt32(ifNull(lvl, 0)) AS l0, translate(ifNull(mngt_unit_nm, ''), '\t\n', '  ') AS n0
      FROM prod_proteus.hr_structure_overall
      WHERE month = (SELECT lm FROM cal) AND mngt_unit_rk IS NOT NULL
    )
    GROUP BY u0
  ),
  st2 AS (
    SELECT rk, prk, lv, nm, lower(hex(substring(MD5(rk), 1, 6))) AS id,
           if(prk = '', '', lower(hex(substring(MD5(prk), 1, 6)))) AS pid
    FROM st
  ),
  kd AS (SELECT prk AS kr, toUInt32(count()) AS k FROM st WHERE prk != '' GROUP BY prk),
  -- Корень и юнит по умолчанию: если у корня один ребёнок (вся компания — один
  -- юнит), отчёт открывается с него — иначе первый уровень таблицы был бы одной строкой
  rt AS (SELECT any(rk) AS r FROM st WHERE prk = ''),
  dflt AS (SELECT if(count() = 1, any(rk), (SELECT r FROM rt)) AS d FROM st WHERE prk = (SELECT r FROM rt)),
  req AS (SELECT any(rk) AS q, count() AS c FROM st2 WHERE {% if unit_req %}id = {{ qs(unit_req[0]) }}{% else %}0{% endif %}),
  sc AS (SELECT if(req.c > 0, req.q, dflt.d) AS s FROM req CROSS JOIN dflt),
  -- Три уровня вниз от выбранного юнита
  d1 AS (SELECT rk FROM st WHERE prk = (SELECT s FROM sc) AND rk != ''),
  d2 AS (SELECT rk FROM st WHERE prk IN (SELECT rk FROM d1)),
  d3 AS (SELECT rk FROM st WHERE prk IN (SELECT rk FROM d2)),
  -- Предки выбранного юнита — путь от корня (уровней не больше 12)
  up AS (SELECT groupArray(rk) AS ks, groupArray(prk) AS ps FROM st),
  anc AS (
    SELECT arrayFilter(x -> x != '', [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12]) AS arr
    FROM
    (
      SELECT (SELECT s FROM sc) AS s0,
             ps[indexOf(ks, s0)] AS a1, ps[indexOf(ks, a1)] AS a2, ps[indexOf(ks, a2)] AS a3,
             ps[indexOf(ks, a3)] AS a4, ps[indexOf(ks, a4)] AS a5, ps[indexOf(ks, a5)] AS a6,
             ps[indexOf(ks, a6)] AS a7, ps[indexOf(ks, a7)] AS a8, ps[indexOf(ks, a8)] AS a9,
             ps[indexOf(ks, a9)] AS a10, ps[indexOf(ks, a10)] AS a11, ps[indexOf(ks, a11)] AS a12
      FROM up
    )
  ),
  -- Юниты, по которым нужны ряды: o — порядок строк в ответе
  pick AS (
    SELECT s AS rk, toUInt8(1) AS o FROM sc
    UNION ALL SELECT r AS rk, toUInt8(2) AS o FROM rt
    UNION ALL SELECT rk, toUInt8(5) AS o FROM d1
    UNION ALL SELECT rk, toUInt8(6) AS o FROM d2
    UNION ALL SELECT rk, toUInt8(7) AS o FROM d3
  ),
  -- Месяц × юнит под фильтрами. Копии строк юнита с двумя родителями считаются один раз
  -- (max по ключу «месяц × юнит × атрибуты»); нулевая строка — чтобы юнит без людей
  -- под фильтрами всё равно получил массивы
  mm AS (
    SELECT u1 AS rk, i1 AS idx, sum(e0) AS e, sum(ea0) AS ea, sum(sa0) AS sa, sum(hi0) AS hi, sum(fi0) AS fi,
           sum(rg0) AS rg, sum(ti0) AS ti, sum(tu0) AS tu, sum(pl0) AS pl, sum(pr0) AS pr
    FROM
    (
      SELECT ifNull(mngt_unit_rk, '') AS u1,
             toUInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(month)))) AS i1,
             max(ifNull(employee_amt, 0)) AS e0,
             max(if(ifNull(active_type_gr_nm, '') = 'Активная', ifNull(employee_amt, 0), 0)) AS ea0,
             max(ifNull(ssch_employee_amt, 0)) AS sa0,
             max(ifNull(hire_amt, 0)) AS hi0,
             max(ifNull(fire_amt, 0)) AS fi0,
             max(ifNull(regret_fire_amt, 0)) AS rg0,
             max(ifNull(transfer_in_amt, 0)) AS ti0,
             max(ifNull(transfer_out_amt, 0)) AS tu0,
             max(ifNull(perf_low, 0)) AS pl0,
             max(ifNull(perf_normal, 0) + ifNull(perf_low, 0) + ifNull(perf_high, 0)) AS pr0
      FROM prod_proteus.hr_structure_overall
      WHERE month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
        AND ifNull(mngt_unit_rk, '') IN (SELECT rk FROM pick)
        AND {{ cond() }}
      GROUP BY u1, i1, active_type_gr_nm, active_type_nm, emp_specialization_oper_code,
               emp_specialization_it_code, employment_relation_type_desc
      UNION ALL
      SELECT rk AS u1, toUInt32(0) AS i1, toFloat64(0) AS e0, toFloat64(0) AS ea0, toFloat64(0) AS sa0,
             toFloat64(0) AS hi0, toFloat64(0) AS fi0, toFloat64(0) AS rg0, toFloat64(0) AS ti0,
             toFloat64(0) AS tu0, toFloat64(0) AS pl0, toFloat64(0) AS pr0
      FROM pick
    )
    GROUP BY u1, i1
  ),
  arr AS (
    SELECT rk,
{%- for m in M %}
           sumForEach(arrayMap(i -> if(i = idx, {{ m[1] }}, 0), range((SELECT n FROM cal)))) AS a_{{ m[0] }}{% if not loop.last %},{% endif %}
{%- endfor %}
    FROM mm
    GROUP BY rk
  )
SELECT *
FROM
(
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         concat('{"lm":"', toString((SELECT lm FROM cal)), '","m0":"', toString((SELECT m0 FROM cal)),
                '","n":', toString((SELECT n FROM cal)), ',"today":"', toString(today()),
                '","root":"', ifNull((SELECT id FROM st2 WHERE rk = (SELECT r FROM rt)), ''),
                '","scope":"', ifNull((SELECT id FROM st2 WHERE rk = (SELECT s FROM sc)), ''),
                '","def":"', ifNull((SELECT id FROM st2 WHERE rk = (SELECT d FROM dflt)), ''),
                '","req":', toJSONString({{ qa(unit_req) }}),
                ',"paint":', toJSONString({{ qa(F['paint']) }}),
                ',"it":', toJSONString({{ qa(F['it']) }}),
                ',"staff":', toJSONString({{ qa(F['staff']) }}),
                ',"vals":{"paint":', (SELECT toJSONString(groupArray((v, e))) FROM (
                    SELECT ifNull(emp_specialization_oper_code, '-') AS v, sum(ifNull(employee_amt, 0)) AS e
                    FROM prod_proteus.hr_structure_overall
                    WHERE month = (SELECT lm FROM cal) AND ifNull(mngt_unit_rk, '') = (SELECT r FROM rt)
                    GROUP BY v ORDER BY e DESC)),
                ',"it":', (SELECT toJSONString(groupArray((v, e))) FROM (
                    SELECT ifNull(emp_specialization_it_code, '-') AS v, sum(ifNull(employee_amt, 0)) AS e
                    FROM prod_proteus.hr_structure_overall
                    WHERE month = (SELECT lm FROM cal) AND ifNull(mngt_unit_rk, '') = (SELECT r FROM rt)
                    GROUP BY v ORDER BY e DESC)),
                ',"staff":', (SELECT toJSONString(groupArray((v, e))) FROM (
                    SELECT if(ifNull(employment_relation_type_desc, '') = 'Штатный сотрудник', 'Штат', 'Не штат') AS v,
                           sum(ifNull(employee_amt, 0)) AS e
                    FROM prod_proteus.hr_structure_overall
                    WHERE month = (SELECT lm FROM cal) AND ifNull(mngt_unit_rk, '') = (SELECT r FROM rt)
                    GROUP BY v ORDER BY e DESC)),
                '}}') AS j,
         '' AS m_hc, '' AS m_act, '' AS m_avg, '' AS m_hire, '' AS m_fire, '' AS m_reg, '' AS m_tin,
         '' AS m_tout, '' AS m_plow, '' AS m_prat

  UNION ALL

  SELECT p.o AS o, multiIf(p.o = 1, 'scope', p.o = 2, 'base', p.o = 5, 'c', p.o = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm AS nm, toUInt32(ifNull(k.k, 0)) AS kids, '' AS j,
{%- for m in M %}
         {{ out('a.a_' ~ m[0]) }} AS m_{{ m[0] }}{% if not loop.last %},{% endif %}
{%- endfor %}
  FROM pick AS p
  INNER JOIN st2 AS s ON s.rk = p.rk
  INNER JOIN arr AS a ON a.rk = p.rk
  LEFT JOIN kd AS k ON k.kr = p.rk
  WHERE p.o <= 2
     OR arraySum(a.a_hc) + arraySum(a.a_hire) + arraySum(a.a_fire) + arraySum(a.a_tin) + arraySum(a.a_tout) > 0

  UNION ALL

  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(groupArray(concat(s.id, '\t', s.pid, '\t', toString(s.lv), '\t',
                                             toString(ifNull(k.k, 0)), '\t', s.nm)), '\n') AS j,
         '' AS m_hc, '' AS m_act, '' AS m_avg, '' AS m_hire, '' AS m_fire, '' AS m_reg, '' AS m_tin,
         '' AS m_tout, '' AS m_plow, '' AS m_prat
  FROM st2 AS s
  LEFT JOIN kd AS k ON k.kr = s.rk
  WHERE s.lv <= (SELECT min(lv) FROM st) + 4 OR has((SELECT arr FROM anc), s.rk) OR s.rk = (SELECT s FROM sc)

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS m_hc, '' AS m_act, '' AS m_avg, '' AS m_hire, '' AS m_fire, '' AS m_reg, '' AS m_tin,
         '' AS m_tout, '' AS m_plow, '' AS m_prat
)
)
ORDER BY o, lvl, nm

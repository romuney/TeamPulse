{#- ============================================================================
    teampulse_hub — датасет единственного чарта TeamPulse Hub (Proteus, база CROSS).
    Пробник: всё, что даёт prod_proteus.hr_structure_overall (SOURCES.md §18).
    Схема таблицы — разведка 16.10.2026 (describe физического датасета 175625, 49 колонок).

    Строка таблицы — люди СВОЕГО юнита, не поддерева (ответ 0д, 16.10: верхний юнит —
    3 человека, у 2 705 из 3 095 юнитов дети больше родителя). Поэтому итог узла —
    сумма строк, чей путь начинается с пути узла: сам юнит и всё под ним. Дерево —
    все начала путей последнего месяца, включая уровни без своих строк (корень,
    промежуточные звенья). Люди прямо в юните («Напрямую в «X»») — узел минус его
    прямые подразделения, то есть его свои строки; разницу считает чарт.

    Дерево денормализовано: путь юнита — имена уровней lvl1_nm … lvl11_nm, глубина —
    leaf_lvl. Узел — путь целиком (id — 12 знаков md5 пути): имена в разных ветках
    повторяются, а полный путь — нет. История приводится к структуре последнего месяца:
    строки юнита за все месяцы едут по его пути последнего месяца (юнит переехал —
    его прошлое переезжает с ним); юнита в последнем месяце нет — по своему пути.
    Юнит с двумя путями берёт меньший; копии строк считаются один раз (max по ключу
    «месяц × юнит × атрибуты»). В ключе — ВСЕ атрибуты строки: колонка, которой нет
    в ключе, но которая делит строки (16.10: active_type_gr_nm, IT-код, группа типа
    отношений), склеила бы разных людей в одну строку и занизила численность.
    Переводы на верхних уровнях включают переходы между своими же подразделениями
    (в таблице только юнит «из» и юнит «в» по отдельности) — сальдо верное, в и из
    по отдельности завышены.

    Один ответ везёт всё, что чарту нужно до следующей смены юнита или фильтров:
    выбранный юнит, три уровня подразделений под ним, всю компанию под теми же
    фильтрами (база сравнения), путь от корня и верхние уровни для выбора юнита.
    Вкладки, раскрытие строк, выбор метрик, проценты и светофор — в чарте.

    Строки различаются колонкой role, порядок задан ORDER BY:
      meta   1 строка, j — JSON: последний полный месяц (lm), первый месяц сетки (m0),
             число месяцев (n), сегодня, корень, выбранный юнит, юнит по умолчанию,
             какие фильтры датасет умеет (cuts), эхо применённых фильтров и значения
             фильтра штата с численностью компании
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
      m_hc   численность на конец месяца (hc_total_cnt)     m_act  активная (hc_active_cnt)
      m_avg  ССЧ активной (ssch_hc_active_cnt)              m_hire найм     m_fire увольнения
      m_reg  нежелательные увольнения                        m_tin  переводы в   m_tout переводы из
      m_pnor мониторинг: нормал   m_plow недоработка   m_phig переработка   m_pgry Gray (perf_*)
      m_wday отработанные человеко-дни   m_ovis посещения офиса, человеко-дни
      m_gapr заявки T-роста (GRT): одобрено   m_gdec отклонено

    mx — разрезы юнита строками «ключ \t значение \t число» через \n:
      численность последнего полного месяца (hc_total_cnt) по атрибуту человека —
        g пол · a возраст · t опыт (experience_group_nm) · gr грейд · s сеньорность ·
        c формат работы (employee_contract_type: гибрид / офис / удалённо) · o юрлицо ·
        w стрим · r тип отношений (штат / не штат);
      увольнения с начала года (fire_amt) —
        xr по причине · xq нежелательные по причине (regret_fire_amt) · xi по инициативе ·
        xp причина|инициатива · xt по опыту · xg по грейду · xs по стриму.
    Пустое значение атрибута — пустая строка; чарт подписывает его «Не указано».

    Текущий месяц неполный и в ответ не едет: если в таблице уже есть строки
    текущего календарного месяца, последний полный — прошлый.

    Фильтры. Покраски (Hq / Line / Support) в таблице нет — кросс-фильтр paint_f датасет
    пропускает. IT-специализация (emp_specialization_it_code) вернулась 16.10 — it_f снова
    работает, в meta.cuts — it и staff. Кросс-фильтры эмитит сам чарт (самовлияние включено):
    unit_f — id юнита, it_f — IT / Digital / NonIT / «-», staff_f — «Штат» / «Не штат»
    (employment_relation_type = 'Штатный сотрудник').
    Колонки-носители в SELECT не выводятся, иначе Superset повесит авто-IN на
    внешний запрос. id юнита — 12 знаков md5 его пути.

    Порядок строк однозначен (ORDER BY … id: имена юнитов повторяются), списки в j и mx
    отсортированы — ответ не зависит от плана запроса.
    Проверено на ClickHouse 24.8 на симуляции таблицы по людям (stand/sim_hso.py):
    оба анализатора, join_use_nulls = 1, prefer_column_name_to_alias = 1 — ответ один и тот же.
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
{% set CUTS = [['it', 'it_f', "ifNull(emp_specialization_it_code, '-')"], ['staff', 'staff_f', "if(ifNull(employment_relation_type, '') = 'Штатный сотрудник', 'Штат', 'Не штат')"]] %}
{% set F = {} %}
{% for c in CUTS %}{% set vals = [] %}{% for v in (filter_values(c[1]) or []) %}{% if v|string != '' and vals|length < 20 %}{% set _ = vals.append(v|string) %}{% endif %}{% endfor %}{% set _ = F.update({c[0]: vals}) %}{% endfor %}
{#- Строка проходит фильтры: значение в выбранном списке; фильтр не выбран — 1. -#}
{% macro cond() -%}
{%- set parts = [] -%}
{%- for c in CUTS -%}{%- if F[c[0]]|length > 0 -%}{%- set _ = parts.append('has(' ~ qa(F[c[0]]) ~ ', ' ~ c[2] ~ ')') -%}{%- endif -%}{%- endfor -%}
{{- parts|join(' AND ') if parts else '1' -}}
{%- endmacro %}
{#- Массив месяцев строкой: дроби только у ССЧ (полусумма) и мониторинга. -#}
{% macro out(a) -%}arrayStringConcat(arrayMap(x -> toString(round(x, 1)), {{ a }}), ','){%- endmacro %}
{#- Атрибут строки: пусто вместо NULL, без табов и переводов строк (разделители mx). -#}
{% macro at(col) -%}translate(ifNull({{ col }}, ''), '\t\n|', '  /'){%- endmacro %}
{% set M = [['hc', 'e'], ['act', 'ea'], ['avg', 'sa'], ['hire', 'hi'], ['fire', 'fi'], ['reg', 'rg'], ['tin', 'ti'], ['tout', 'tu'], ['pnor', 'pn'], ['plow', 'pl'], ['phig', 'ph'], ['pgry', 'pg'], ['wday', 'wd'], ['ovis', 'ov'], ['gapr', 'ga'], ['gdec', 'gd']] %}
{% set LV = ['lvl1_nm', 'lvl2_nm', 'lvl3_nm', 'lvl4_nm', 'lvl5_nm', 'lvl6_nm', 'lvl7_nm', 'lvl8_nm', 'lvl9_nm', 'lvl10_nm', 'lvl11_nm'] %}
{#- Пустые колонки для служебных строк (meta, dict, end). -#}
{% macro blank() -%}{% for m in M %}'' AS m_{{ m[0] }}, {% endfor %}'' AS mx{%- endmacro %}
{#- Запрос начинается с SELECT, цепочка CTE — внутри: так его без правок принимает и SQL Lab
    (там пропускаются только SELECT и DESCRIBE) — датасет можно проверить целиком. -#}
SELECT role, id, pid, lvl, nm, kids, j,
       {% for m in M %}m_{{ m[0] }}, {% endfor %}mx
FROM
(
WITH
  -- Календарь: последний полный месяц и сетка от января прошлого года
  cal AS (
    SELECT toDate(ifNull(max(report_month), toDate('1970-01-01'))) AS mx0,
           if(mx0 >= toStartOfMonth(today()), addMonths(mx0, -1), mx0) AS lm,
           toStartOfYear(addYears(lm, -1)) AS m0,
           toUInt32(dateDiff('month', m0, lm) + 1) AS n,
           toUInt32(dateDiff('month', m0, toStartOfYear(lm))) AS iy
    FROM prod_proteus.hr_structure_overall
  ),
  -- Ключ юнита → его путь в последнем полном месяце (имена уровней от корня через таб;
  -- путей два — меньший). Строки юнита за прошлые месяцы пойдут по этому пути: переезд и
  -- переименование не рвут ряды — история пересчитана на нынешнюю структуру
  lmr AS (
    SELECT ifNull(mng_unit_rk, '') AS u0,
           min(arrayStringConcat(arraySlice(arrayMap(x -> translate(ifNull(x, ''), '\t\n', '  '), [{{ LV|join(', ') }}]),
                                            1, toInt32(ifNull(leaf_lvl, 0))), '\t')) AS pk0
    FROM prod_proteus.hr_structure_overall
    WHERE report_month = (SELECT lm FROM cal) AND mng_unit_rk IS NOT NULL AND ifNull(leaf_lvl, 0) > 0
    GROUP BY u0
  ),
  -- Узлы дерева — все начала путей: и юниты со своими людьми, и уровни над ними без своих
  -- строк (в таблице строка — люди СВОЕГО юнита, у верхних уровней строк может не быть).
  -- Узел — его путь (rk), родитель — путь без последнего имени (псевдонимы нигде не совпадают
  -- с колонками, из которых считаются: на таком совпадении новый анализатор ClickHouse 24.8
  -- отдаёт пустой скалярный подзапрос)
  st AS (
    SELECT DISTINCT arrayStringConcat(arraySlice(a5, 1, d5), '\t') AS rk,
           arrayStringConcat(arraySlice(a5, 1, d5 - 1), '\t') AS prk, toInt32(d5) AS lv, a5[d5] AS nm
    FROM (SELECT splitByChar('\t', pk0) AS a5 FROM lmr WHERE pk0 != '')
    ARRAY JOIN arrayEnumerate(a5) AS d5
  ),
  st2 AS (
    SELECT rk, prk, lv, nm, lower(hex(substring(MD5(rk), 1, 6))) AS id,
           if(prk = '', '', lower(hex(substring(MD5(prk), 1, 6)))) AS pid
    FROM st
  ),
  kd AS (SELECT prk AS kr, toUInt32(count()) AS k FROM st WHERE prk != '' GROUP BY prk),
  -- Корень и юнит по умолчанию: если у корня один ребёнок (вся компания — один
  -- юнит), отчёт открывается с него — иначе первый уровень таблицы был бы одной строкой
  rt AS (SELECT argMin(rk, (lv, rk)) AS r FROM st WHERE prk = ''),
  dflt AS (SELECT if(count() = 1, any(rk), (SELECT r FROM rt)) AS d FROM st WHERE prk = (SELECT r FROM rt)),
  req AS (SELECT any(rk) AS q, count() AS c FROM st2 WHERE {% if unit_req %}id = {{ qs(unit_req[0]) }}{% else %}0{% endif %}),
  sc AS (SELECT if(req.c > 0, req.q, dflt.d) AS s FROM req CROSS JOIN dflt),
  -- Три уровня вниз от выбранного юнита
  d1 AS (SELECT rk FROM st WHERE prk = (SELECT s FROM sc) AND rk != ''),
  d2 AS (SELECT rk FROM st WHERE prk IN (SELECT rk FROM d1)),
  d3 AS (SELECT rk FROM st WHERE prk IN (SELECT rk FROM d2)),
  -- Глубина корня и выбранного юнита; предки выбранного юнита — начала его пути
  -- (скалярный подзапрос бывает Nullable — массив из него только через ifNull)
  dep AS (
    SELECT splitByChar('\t', ifNull((SELECT s FROM sc), '')) AS sa6,
           toUInt32(length(splitByChar('\t', ifNull((SELECT r FROM rt), '')))) AS rl,
           toUInt32(length(sa6)) AS sl
  ),
  anc AS (
    SELECT arrayMap(d -> arrayStringConcat(arraySlice(sa6, 1, d), '\t'), range(1, sl)) AS arr FROM dep
  ),
  -- Юниты, по которым нужны ряды: o — порядок строк в ответе
  pick AS (
    SELECT s AS rk, toUInt8(1) AS o FROM sc
    UNION ALL SELECT r AS rk, toUInt8(2) AS o FROM rt
    UNION ALL SELECT rk, toUInt8(5) AS o FROM d1
    UNION ALL SELECT rk, toUInt8(6) AS o FROM d2
    UNION ALL SELECT rk, toUInt8(7) AS o FROM d3
  ),
  -- Строки под фильтрами на ключе «месяц × юнит × атрибуты»: копии строк юнита с двумя
  -- родителями (одинаковые, разные только пути) считаются один раз; путь строки — меньший
  b00 AS (
    SELECT u1, i1, g1, a1, t1, gr1, s1, c1, o1, w1, r1, rq1, ag1, ic1, fr1, fi1, min(pr0) AS pr1,
           max(toFloat64(ifNull(hc_total_cnt, 0))) AS e,
           max(toFloat64(ifNull(hc_active_cnt, 0))) AS ea,
           max(ifNull(ssch_hc_active_cnt, 0)) AS sa,
           max(toFloat64(ifNull(hire_amt, 0))) AS hi,
           max(toFloat64(ifNull(fire_amt, 0))) AS fi,
           max(toFloat64(ifNull(regret_fire_amt, 0))) AS rg,
           max(toFloat64(ifNull(transfer_in_amt, 0))) AS ti,
           max(toFloat64(ifNull(transfer_out_amt, 0))) AS tu,
           max(ifNull(perf_normal, 0)) AS pn,
           max(ifNull(perf_low, 0)) AS pl,
           max(ifNull(perf_high, 0)) AS ph,
           max(ifNull(perf_gray, 0)) AS pg,
           max(ifNull(work_day_amt, 0)) AS wd,
           max(ifNull(office_visit_amt, 0)) AS ov,
           max(toFloat64(ifNull(grt_approve_cnt, 0))) AS ga,
           max(toFloat64(ifNull(grt_decline_cnt, 0))) AS gd
    FROM
    (
      SELECT *, ifNull(mng_unit_rk, '') AS u1,
             arrayStringConcat(arraySlice(arrayMap(x -> translate(ifNull(x, ''), '\t\n', '  '), [{{ LV|join(', ') }}]),
                                          1, toInt32(ifNull(leaf_lvl, 0))), '\t') AS pr0,
             toUInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i1,
             {{ at('gender') }} AS g1, {{ at('type_age') }} AS a1, {{ at('experience_group_nm') }} AS t1,
             {{ at('grade') }} AS gr1, {{ at('seniority') }} AS s1, {{ at('employee_contract_type') }} AS c1,
             {{ at('legal_organization') }} AS o1, {{ at('employee_stream') }} AS w1,
             {{ at('employment_relation_type') }} AS r1, {{ at('employment_relation_type_gr_nm') }} AS rq1,
             {{ at('active_type_gr_nm') }} AS ag1, {{ at('emp_specialization_it_code') }} AS ic1,
             {{ at('fire_reason_group') }} AS fr1,
             {{ at('fire_initiative') }} AS fi1
      FROM prod_proteus.hr_structure_overall
      WHERE report_month BETWEEN (SELECT m0 FROM cal) AND (SELECT lm FROM cal)
        AND {{ cond() }}
    )
    GROUP BY u1, i1, g1, a1, t1, gr1, s1, c1, o1, w1, r1, rq1, ag1, ic1, fr1, fi1
  ),
  -- Путь строки — нынешний путь её юнита (юнита больше нет — путь из самой строки);
  -- строка входит в каждый узел, с которого её путь начинается: в корень и в выбранный
  -- юнит с тремя уровнями под ним. Итог узла — сумма строк его ветки
  b01 AS (
    SELECT b.*, if(ifNull(m.pk0, '') != '', ifNull(m.pk0, ''), b.pr1) AS cp1
    FROM b00 AS b LEFT JOIN lmr AS m ON m.u0 = b.u1
  ),
  b0 AS (
    SELECT * EXCEPT (u1, cp1, pr1), np1 AS u1
    FROM b01
    ARRAY JOIN arrayMap(d -> arrayStringConcat(arraySlice(splitByChar('\t', cp1), 1, d), '\t'),
                        arrayFilter(d -> d = (SELECT rl FROM dep)
                                      OR (d >= (SELECT sl FROM dep) AND d <= (SELECT sl FROM dep) + 3),
                                    range(1, length(splitByChar('\t', cp1)) + 1))) AS np1
    WHERE np1 IN (SELECT rk FROM pick)
  ),
  -- Месяц × юнит; нулевая строка — чтобы юнит без людей под фильтрами всё равно получил массивы
  mm AS (
    SELECT u2 AS rk, i2 AS idx, sum(e0) AS e, sum(ea0) AS ea, sum(sa0) AS sa, sum(hi0) AS hi, sum(fi0) AS fi,
           sum(rg0) AS rg, sum(ti0) AS ti, sum(tu0) AS tu, sum(pn0) AS pn, sum(pl0) AS pl, sum(ph0) AS ph,
           sum(pg0) AS pg, sum(wd0) AS wd, sum(ov0) AS ov, sum(ga0) AS ga, sum(gd0) AS gd
    FROM
    (
      SELECT u1 AS u2, i1 AS i2, e AS e0, ea AS ea0, sa AS sa0, hi AS hi0, fi AS fi0, rg AS rg0, ti AS ti0,
             tu AS tu0, pn AS pn0, pl AS pl0, ph AS ph0, pg AS pg0, wd AS wd0, ov AS ov0, ga AS ga0, gd AS gd0
      FROM b0
      UNION ALL
      SELECT rk AS u2, toUInt32(0) AS i2, toFloat64(0) AS e0, toFloat64(0) AS ea0, toFloat64(0) AS sa0,
             toFloat64(0) AS hi0, toFloat64(0) AS fi0, toFloat64(0) AS rg0, toFloat64(0) AS ti0,
             toFloat64(0) AS tu0, toFloat64(0) AS pn0, toFloat64(0) AS pl0, toFloat64(0) AS ph0,
             toFloat64(0) AS pg0, toFloat64(0) AS wd0, toFloat64(0) AS ov0, toFloat64(0) AS ga0, toFloat64(0) AS gd0
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
  -- Разрезы юнита: численность последнего полного месяца по атрибутам человека
  -- и увольнения с начала года — по причине, инициативе, опыту, грейду, стриму
  mxa AS (
    SELECT u3, k3, v3, sum(n3) AS n4
    FROM
    (
      SELECT u1 AS u3, tupleElement(t3, 1) AS k3, tupleElement(t3, 2) AS v3, tupleElement(t3, 3) AS n3
      FROM
      (
        SELECT u1, arrayJoin([('g', g1, e), ('a', a1, e), ('t', t1, e), ('gr', gr1, e), ('s', s1, e),
                              ('c', c1, e), ('o', o1, e), ('w', w1, e), ('r', r1, e)]) AS t3
        FROM b0
        WHERE i1 = (SELECT n FROM cal) - 1 AND e > 0
      )
      UNION ALL
      SELECT u1 AS u3, tupleElement(t4, 1) AS k3, tupleElement(t4, 2) AS v3, tupleElement(t4, 3) AS n3
      FROM
      (
        SELECT u1, arrayJoin([('xr', fr1, fi), ('xq', fr1, rg), ('xi', fi1, fi), ('xp', concat(fr1, '|', fi1), fi),
                              ('xt', t1, fi), ('xg', gr1, fi), ('xs', w1, fi)]) AS t4
        FROM b0
        WHERE i1 >= (SELECT iy FROM cal) AND fi > 0
      )
    )
    GROUP BY u3, k3, v3
    HAVING n4 > 0
  ),
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM mxa
    GROUP BY u3
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
                '","schema":"2026-10-16","cuts":["it","staff"]',
                ',"req":', toJSONString({{ qa(unit_req) }}),
                ',"paint":[],"it":', toJSONString({{ qa(F['it']) }}),
                ',"staff":', toJSONString({{ qa(F['staff']) }}),
                ',"vals":{"paint":[],"it":', (SELECT toJSONString(groupArray((v, e))) FROM (
                    SELECT ifNull(emp_specialization_it_code, '-') AS v, sum(toFloat64(ifNull(hc_total_cnt, 0))) AS e
                    FROM prod_proteus.hr_structure_overall
                    WHERE report_month = (SELECT lm FROM cal)
                    GROUP BY v ORDER BY e DESC, v)),
                ',"staff":', (SELECT toJSONString(groupArray((v, e))) FROM (
                    SELECT if(ifNull(employment_relation_type, '') = 'Штатный сотрудник', 'Штат', 'Не штат') AS v,
                           sum(toFloat64(ifNull(hc_total_cnt, 0))) AS e
                    FROM prod_proteus.hr_structure_overall
                    WHERE report_month = (SELECT lm FROM cal)
                    GROUP BY v ORDER BY e DESC, v)),
                '}}') AS j,
         {{ blank() }}

  UNION ALL

  SELECT p.o AS o, multiIf(p.o = 1, 'scope', p.o = 2, 'base', p.o = 5, 'c', p.o = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm AS nm, toUInt32(ifNull(k.k, 0)) AS kids, '' AS j,
{%- for m in M %}
         {{ out('a.a_' ~ m[0]) }} AS m_{{ m[0] }},
{%- endfor %}
         ifNull(x.mxs, '') AS mx
  FROM pick AS p
  INNER JOIN st2 AS s ON s.rk = p.rk
  INNER JOIN arr AS a ON a.rk = p.rk
  LEFT JOIN kd AS k ON k.kr = p.rk
  LEFT JOIN mxr AS x ON x.mu = p.rk
  WHERE p.o <= 2
     OR arraySum(a.a_hc) + arraySum(a.a_hire) + arraySum(a.a_fire) + arraySum(a.a_tin) + arraySum(a.a_tout) > 0

  UNION ALL

  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(s.id, '\t', s.pid, '\t', toString(s.lv), '\t',
                                             toString(ifNull(k.k, 0)), '\t', s.nm))), '\n') AS j,
         {{ blank() }}
  FROM st2 AS s
  LEFT JOIN kd AS k ON k.kr = s.rk
  WHERE s.lv <= (SELECT min(lv) FROM st) + 4 OR has((SELECT arr FROM anc), s.rk) OR s.rk = (SELECT s FROM sc)

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, {{ blank() }}
)
)
ORDER BY o, lvl, nm, id

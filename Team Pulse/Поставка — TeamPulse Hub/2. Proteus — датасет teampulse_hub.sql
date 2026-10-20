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
    Юнит с двумя путями едет двумя копиями строк — берутся строки его меньшего пути в
    месяце, простой суммой (поставка 25; раньше — max по ключу «месяц × юнит × атрибуты»:
    колонка, которой нет в ключе, но которая делит строки, склеивала разных людей).
    Переводы на верхних уровнях включают переходы между своими же подразделениями
    (в таблице только юнит «из» и юнит «в» по отдельности) — сальдо верное, в и из
    по отдельности завышены.

    Один ответ везёт всё, что чарту нужно до следующей смены юнита или фильтров:
    выбранный юнит, три уровня подразделений под ним, всю компанию под теми же
    фильтрами (база сравнения), путь от корня и верхние уровни для выбора юнита.
    Вкладки, раскрытие строк, выбор метрик, проценты и светофор — в чарте.

    Строки различаются колонкой role, порядок задан ORDER BY:
      meta   1 строка, j — JSON: последний месяц (lm, и текущий незакрытый; dt — дата данных), первый месяц сетки (m0),
             число месяцев (n), сегодня, корень, выбранный юнит, юнит по умолчанию,
             какие фильтры датасет умеет (cuts), эхо применённых фильтров, значения
             фильтров IT и штата с численностью компании (копии путей — один раз) и словари
             распределения fdv — порядок значений, по которому кодируется fd в dict
      scope  выбранный юнит
      base   вся компания под теми же фильтрами — база сравнения
      dict   1 строка, j — все узлы дерева для пути и выбора юнита: «id \t pid \t уровень \t
             детей \t имя \t руководитель \t fd» через \n. Руководителя (логин) в таблице нет —
             поле пустое. fd — численность узла (всей ветки) в последнем месяце по
             сочетаниям значений фильтров, без учёта применённых: «код:число» через пробел,
             код = номер IT × число значений штата + номер штата (номера — в meta.fdv). По нему
             окно настройки считает «сколько людей попадёт в выбор» сразу, без запроса (19.10,
             как в HRBP HUB)
      c      подразделения на уровень ниже выбранного (pid — выбранный)
      g      на два уровня ниже (pid — строка c)
      x      на три уровня ниже (pid — строка g)
      end    маркер «ответ целиком» — всегда последняя строка
    У юнитов kids — сколько у него своих подразделений («ниже ещё N»).
    Юнит без людей и движения под выбранными фильтрами не едет (кроме scope и base).

    Массивы m_* — месяцы от января прошлого года до последнего полного (n штук),
    строкой через запятую. Процентов нет: чарт делит числитель на знаменатель.
      m_hc   численность на конец месяца (hc_total_cnt)     m_act  активная (hc_active_cnt)
      m_avg  ССЧ = (численность месяца + прошлого) / 2 по ряду узла под фильтрами: на активной
             (по умолчанию) — ССЧ активной; колонку ssch_hc_active_cnt датасет не читает:
             ноутбук сборки считает её LAG по дробным сочетаниям атрибутов, и новое сочетание
             (найм) берёт ССЧ целиком (стенд: +5%)
      m_hire найм: на активной — в компанию + из учебной группы в боевую + стажёры в штат
             (методология DD), на всей — найм в компанию (hire_cnt)
      m_fire увольнения
      m_reg  нежелательные увольнения                        m_tin  переводы в   m_tout переводы из
      m_pnor мониторинг: нормал   m_plow недоработка   m_phig переработка   m_pgry Gray (perf_*)
      m_wday отработанные человеко-дни   m_ovis посещения офиса, человеко-дни
      m_gapr заявки T-роста (GRT): одобрено   m_gdec отклонено

    mx — разрезы юнита строками «ключ \t значение \t число» через \n:
      численность последнего месяца (hc_total_cnt) по атрибуту человека —
        g пол · a возраст · t опыт (experience_group_nm) · gr грейд · s сеньорность ·
        c формат работы (employee_contract_type: гибрид / офис / удалённо) · o юрлицо ·
        w стрим · r тип отношений (штат / не штат);
      увольнения с начала года (fire_amt) —
        xr по причине · xq нежелательные по причине (regret_fire_amt) · xi по инициативе ·
        xp причина|инициатива · xt по опыту · xg по грейду · xs по стриму.
    Пустое значение атрибута (NULL или «-», как пишет ноутбук сборки) — пустая строка; чарт
    подписывает его «Не указано».

    Текущий месяц неполный и в ответ не едет: если в таблице уже есть строки
    текущего календарного месяца, последний полный — прошлый.

    Фильтры. Покраски (Hq / Line / Support) в таблице нет — кросс-фильтр paint_f датасет
    пропускает. IT-специализация (emp_specialization_it_code) вернулась 16.10 — it_f снова
    работает, в meta.cuts — it и staff. Кросс-фильтры эмитит сам чарт (самовлияние включено):
    unit_f — id юнита, it_f — IT / Digital / NonIT / «-», staff_f — «Штат» / «Не штат»
    (employment_relation_type = 'Штатный сотрудник'), act_f — тип численности (20.10,
    active_type_gr_nm): без фильтра — «Активная» (отчёт по умолчанию на активной численности),
    «Вся» — все строки. На всей численности найм — hire_cnt (найм в компанию с любым типом,
    ноутбук с 20.10; нет колонки — как на активной), ССЧ — полусумма численности строк фильтра.
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
{% set CUTS = [['it', 'it_f', "ifNull(emp_specialization_it_code, '-')"], ['staff', 'staff_f', "if(ifNull(employment_relation_type, '') = 'Штатный сотрудник', 'Штат', 'Не штат')"], ['act', 'act_f', "if(ifNull(active_type_gr_nm, '') = 'Активная', 'Активная', 'Прочие')"]] %}
{% set F = {} %}
{% for c in CUTS %}{% set vals = [] %}{% for v in (filter_values(c[1]) or []) %}{% if v|string != '' and vals|length < 20 %}{% set _ = vals.append(v|string) %}{% endif %}{% endfor %}{% set _ = F.update({c[0]: vals}) %}{% endfor %}
{#- Тип численности: не выбран — «Активная»; «Вся» — без фильтра. -#}
{% set av = [] %}{% for v in F['act'] %}{% set _ = av.append(v|lower) %}{% endfor %}
{% if 'вся' in av or 'all' in av %}{% set _ = F.update({'act': []}) %}{% elif av|length == 0 %}{% set _ = F.update({'act': ['Активная']}) %}{% endif %}
{% set act_only = F['act']|length == 1 and (F['act'][0]|lower) == 'активная' %}
{#- Строка проходит фильтры: значение в выбранном списке; фильтр не выбран — 1. Без учёта
    регистра: ноутбук сборки пишет IT-код «nonIT», чарт шлёт «NonIT». -#}
{% macro cond() -%}
{%- set parts = [] -%}
{%- for c in CUTS -%}{%- if F[c[0]]|length > 0 -%}{%- set _ = parts.append('has(arrayMap(x -> lowerUTF8(x), ' ~ qa(F[c[0]]) ~ '), lowerUTF8(' ~ c[2] ~ '))') -%}{%- endif -%}{%- endfor -%}
{{- parts|join(' AND ') if parts else '1' -}}
{%- endmacro %}
{#- Массив месяцев строкой: дроби только у ССЧ (полусумма) и мониторинга. -#}
{% macro out(a) -%}arrayStringConcat(arrayMap(x -> toString(round(x, 1)), {{ a }}), ','){%- endmacro %}
{#- Атрибут строки: пусто вместо NULL, без табов и переводов строк (разделители mx). -#}
{% macro at(col) -%}translate(ifNull({{ col }}, ''), '\t\n|', '  /'){%- endmacro %}
{% set M = [['hc', 'e'], ['act', 'ea'], ['avg', 'sa'], ['hire', 'hi'], ['fire', 'fi'], ['reg', 'rg'], ['tin', 'ti'], ['tout', 'tu'], ['pnor', 'pn'], ['plow', 'pl'], ['phig', 'ph'], ['pgry', 'pg'], ['wday', 'wd'], ['ovis', 'ov'], ['gapr', 'ga'], ['gdec', 'gd']] %}
{% set LV = ['lvl1_nm', 'lvl2_nm', 'lvl3_nm', 'lvl4_nm', 'lvl5_nm', 'lvl6_nm', 'lvl7_nm', 'lvl8_nm', 'lvl9_nm', 'lvl10_nm', 'lvl11_nm'] %}
{#- Значение разреза в ответе: «-» — пустое (ноутбук сборки TP 2.0 пишет coalesce(…, '-')),
    отдаётся пустой строкой — чарт подписывает её «Не указано». Меняется только в ответе (mx). -#}
{% macro nd(c) -%}if({{ c }} = '-', '', {{ c }}){%- endmacro %}
{#- Путь юнита строки: имена уровней от корня через таб (табы и переводы строк в именах — пробелы). -#}
{% macro pth() -%}arrayStringConcat(arraySlice(arrayMap(x -> translate(ifNull(x, ''), '\t\n', '  '), [{{ LV|join(', ') }}]), 1, toInt32(ifNull(leaf_lvl, 0))), '\t'){%- endmacro %}
{#- Пустые колонки для служебных строк (meta, dict, end). -#}
{% macro blank() -%}{% for m in M %}'' AS m_{{ m[0] }}, {% endfor %}'' AS mx{%- endmacro %}
{#- Запрос начинается с SELECT, цепочка CTE — внутри: так его без правок принимает и SQL Lab
    (там пропускаются только SELECT и DESCRIBE) — датасет можно проверить целиком. -#}
SELECT role, id, pid, lvl, nm, kids, j,
       {% for m in M %}m_{{ m[0] }}, {% endfor %}mx
FROM
(
WITH
  -- Календарь: последний месяц таблицы — и текущий незакрытый тоже (dd — дата данных, вчера:
  -- отчёт показывает метрики на актуальную дату, как HRBP HUB), сетка от января прошлого года и
  -- месяц перед ней (mp: ССЧ января — полусумма с декабрём; hp — есть ли он в таблице)
  cal AS (
    SELECT toDate(ifNull(max(report_month), toDate('1970-01-01'))) AS mx0,
           mx0 AS lm,
           if(mx0 >= toStartOfMonth(today()), toString(greatest(yesterday(), mx0)), '') AS dd,
           toStartOfYear(addYears(lm, -1)) AS m0,
           toUInt32(dateDiff('month', m0, lm) + 1) AS n,
           toUInt32(dateDiff('month', m0, toStartOfYear(lm))) AS iy,
           addMonths(m0, -1) AS mp,
           toUInt8(toDate(ifNull(min(report_month), toDate('2100-01-01'))) <= mp) AS hp
    FROM prod_proteus.hr_structure_overall
  ),
  -- Ключ юнита → его путь в последнем месяце (имена уровней от корня через таб;
  -- путей два — меньший). Строки юнита за прошлые месяцы пойдут по этому пути: переезд и
  -- переименование не рвут ряды — история пересчитана на нынешнюю структуру
  lmr AS (
    SELECT ifNull(mng_unit_rk, '') AS u0,
           min({{ pth() }}) AS pk0
    FROM prod_proteus.hr_structure_overall
    WHERE report_month = (SELECT lm FROM cal) AND mng_unit_rk IS NOT NULL AND ifNull(leaf_lvl, 0) > 0
    GROUP BY u0
  ),
  -- Численность последнего месяца по значениям фильтров (без применённых): у юнита —
  -- по его пути (копий нет), у узла — сумма ветки. Окно настройки по ней считает «сколько
  -- людей попадёт в выбор» без запроса (19.10, как в HRBP HUB). fa / fb — порядок значений,
  -- по которому кодируется сочетание (в meta — fdv)
  fdb AS (
    SELECT {{ pth() }} AS p7, {{ CUTS[0][2] }} AS v7a, {{ CUTS[1][2] }} AS v7b, {{ CUTS[2][2] }} AS v7c,
           sum(toFloat64(ifNull(hc_total_cnt, 0))) AS n7
    FROM prod_proteus.hr_structure_overall
    WHERE report_month = (SELECT lm FROM cal)
      AND (ifNull(mng_unit_rk, ''), {{ pth() }}) IN (SELECT u0, pk0 FROM lmr)
    GROUP BY p7, v7a, v7b, v7c
    HAVING n7 > 0
  ),
  fdv AS (SELECT arraySort(groupUniqArray(v7a)) AS fa, arraySort(groupUniqArray(v7b)) AS fb,
                 arraySort(groupUniqArray(v7c)) AS fc FROM fdb),
  fdr AS (
    SELECT r7 AS fr, arrayStringConcat(arraySort(groupArray(concat(toString(c7), ':', toString(round(m7))))), ' ') AS fds
    FROM
    (
      SELECT np7 AS r7,
             toUInt32(((indexOf((SELECT fa FROM fdv), v7a) - 1) * length((SELECT fb FROM fdv))
                       + indexOf((SELECT fb FROM fdv), v7b) - 1) * length((SELECT fc FROM fdv))
                      + indexOf((SELECT fc FROM fdv), v7c) - 1) AS c7,
             sum(n7) AS m7
      FROM fdb
      ARRAY JOIN arrayMap(d -> arrayStringConcat(arraySlice(splitByChar('\t', p7), 1, d), '\t'),
                          range(1, length(splitByChar('\t', p7)) + 1)) AS np7
      GROUP BY r7, c7
    )
    GROUP BY r7
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
  -- Глубина корня и выбранного юнита (скалярный подзапрос бывает Nullable — массив из него
  -- только через ifNull). Справочник с 19.10 — всё дерево, предки отдельно не нужны
  dep AS (
    SELECT splitByChar('\t', ifNull((SELECT s FROM sc), '')) AS sa6,
           toUInt32(length(splitByChar('\t', ifNull((SELECT r FROM rt), '')))) AS rl,
           toUInt32(length(sa6)) AS sl
  ),
  -- Юниты, по которым нужны ряды: o — порядок строк в ответе
  pick AS (
    SELECT s AS rk, toUInt8(1) AS o FROM sc
    UNION ALL SELECT r AS rk, toUInt8(2) AS o FROM rt
    UNION ALL SELECT rk, toUInt8(5) AS o FROM d1
    UNION ALL SELECT rk, toUInt8(6) AS o FROM d2
    UNION ALL SELECT rk, toUInt8(7) AS o FROM d3
  ),
  -- Строки под фильтрами. Юнит с двумя родителями едет двумя путями — те же люди дважды:
  -- берутся строки одного пути юнита в месяце (меньшего) простой суммой. Ключа из атрибутов
  -- нет: колонка, которой датасет не знает и которая делит строки (16.10 — тип активности,
  -- IT-код; дальше — уровень перевода), разных людей не склеит. Меньший путь — подзапросом
  -- «юнит × месяц», а не окном: окно сортирует все строки (на стенде в масштабе боя +4 с)
  b00 AS (
    SELECT u1, i1, g1, a1, t1, gr1, s1, c1, o1, w1, r1, rq1, ag1, ic1, fr1, fi1, pr0 AS pr1,
           sum(e0) AS e, sum(ea0) AS ea, toFloat64(0) AS sa, sum(hi0) AS hi, sum(fi0) AS fi, sum(rg0) AS rg,
           sum(ti0) AS ti, sum(tu0) AS tu, sum(pn0) AS pn, sum(pl0) AS pl, sum(ph0) AS ph, sum(pg0) AS pg,
           sum(wd0) AS wd, sum(ov0) AS ov, sum(ga0) AS ga, sum(gd0) AS gd
    FROM
    (
      SELECT ifNull(mng_unit_rk, '') AS u1, {{ pth() }} AS pr0,
             toInt32(dateDiff('month', (SELECT m0 FROM cal), toDate(assumeNotNull(report_month)))) AS i1,
             {{ at('gender') }} AS g1, {{ at('type_age') }} AS a1, {{ at('experience_group_nm') }} AS t1,
             {{ at('grade') }} AS gr1, {{ at('seniority') }} AS s1, {{ at('employee_contract_type') }} AS c1,
             {{ at('legal_organization') }} AS o1, {{ at('employee_stream') }} AS w1,
             {{ at('employment_relation_type') }} AS r1, {{ at('employment_relation_type_gr_nm') }} AS rq1,
             {{ at('active_type_gr_nm') }} AS ag1, {{ at('emp_specialization_it_code') }} AS ic1,
             {{ at('fire_reason_group') }} AS fr1, {{ at('fire_initiative') }} AS fi1,
             toFloat64(ifNull(hc_total_cnt, 0)) AS e0, toFloat64(ifNull(hc_active_cnt, 0)) AS ea0,
             -- найм, как в методологии DD: найм в компанию + перевод из учебной группы в боевую +
             -- перевод стажёров в штат (transfer_candidate_amt / transfer_internal_amt — матчером:
             -- нет колонок — найм в компанию, как раньше)
             {% set HDD = "toFloat64(ifNull(hire_amt, 0)) + arraySum(arrayMap(x -> ifNull(x, 0), arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^transfer_(candidate|internal)_amt$') APPLY(toFloat64)])))" %}
             -- на всей численности — найм в компанию с любым типом (hire_cnt; нет колонки — как выше)
             {% if act_only %}{{ HDD }}{% else %}ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hire_cnt$') APPLY(toFloat64)], [{{ HDD }}]), 1), 0){% endif %} AS hi0,
             toFloat64(ifNull(fire_amt, 0)) AS fi0,
             toFloat64(ifNull(regret_fire_amt, 0)) AS rg0, toFloat64(ifNull(transfer_in_amt, 0)) AS ti0,
             toFloat64(ifNull(transfer_out_amt, 0)) AS tu0, ifNull(perf_normal, 0) AS pn0, ifNull(perf_low, 0) AS pl0,
             ifNull(perf_high, 0) AS ph0, ifNull(perf_gray, 0) AS pg0, ifNull(work_day_amt, 0) AS wd0,
             ifNull(office_visit_amt, 0) AS ov0, toFloat64(ifNull(grt_approve_cnt, 0)) AS ga0,
             toFloat64(ifNull(grt_decline_cnt, 0)) AS gd0
      FROM prod_proteus.hr_structure_overall
      WHERE report_month BETWEEN (SELECT mp FROM cal) AND (SELECT lm FROM cal)
        AND {{ cond() }}
        AND (ifNull(mng_unit_rk, ''), report_month, {{ pth() }}) IN (
          SELECT ifNull(mng_unit_rk, '') AS u9, report_month AS m9, min({{ pth() }}) AS p9
          FROM prod_proteus.hr_structure_overall
          WHERE report_month BETWEEN (SELECT mp FROM cal) AND (SELECT lm FROM cal)
          GROUP BY u9, m9)
    )
    GROUP BY u1, i1, g1, a1, t1, gr1, s1, c1, o1, w1, r1, rq1, ag1, ic1, fr1, fi1, pr0
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
      SELECT rk AS u2, toInt32(0) AS i2, toFloat64(0) AS e0, toFloat64(0) AS ea0, toFloat64(0) AS sa0,
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
           sumForEach(arrayMap(i -> if(i = idx, {{ m[1] }}, 0), range((SELECT n FROM cal)))) AS a_{{ m[0] }},
{%- endfor %}
           sumIf(e, idx = -1) AS p_hc
    FROM mm
    GROUP BY rk
  ),
  -- Разрезы юнита: численность последнего месяца по атрибутам человека
  -- и увольнения с начала года — по причине, инициативе, опыту, грейду, стриму
  mxa AS (
    SELECT u3, k3, v3, sum(n3) AS n4
    FROM
    (
      SELECT u1 AS u3, tupleElement(t3, 1) AS k3, tupleElement(t3, 2) AS v3, tupleElement(t3, 3) AS n3
      FROM
      (
        SELECT u1, arrayJoin([('g', {{ nd('g1') }}, e), ('a', {{ nd('a1') }}, e), ('t', {{ nd('t1') }}, e),
                              ('gr', {{ nd('gr1') }}, e), ('s', {{ nd('s1') }}, e), ('c', {{ nd('c1') }}, e),
                              ('o', {{ nd('o1') }}, e), ('w', {{ nd('w1') }}, e), ('r', {{ nd('r1') }}, e)]) AS t3
        FROM b0
        WHERE i1 = (SELECT n FROM cal) - 1 AND e > 0
      )
      UNION ALL
      SELECT u1 AS u3, tupleElement(t4, 1) AS k3, tupleElement(t4, 2) AS v3, tupleElement(t4, 3) AS n3
      FROM
      (
        SELECT u1, arrayJoin([('xr', {{ nd('fr1') }}, fi), ('xq', {{ nd('fr1') }}, rg), ('xi', {{ nd('fi1') }}, fi),
                              ('xp', concat({{ nd('fr1') }}, '|', {{ nd('fi1') }}), fi),
                              ('xt', {{ nd('t1') }}, fi), ('xg', {{ nd('gr1') }}, fi), ('xs', {{ nd('w1') }}, fi)]) AS t4
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
                '","dt":"', (SELECT dd FROM cal), '","schema":"2026-10-20","cuts":["it","staff","act"]',
                ',"req":', toJSONString({{ qa(unit_req) }}),
                ',"paint":[],"it":', toJSONString({{ qa(F['it']) }}),
                ',"staff":', toJSONString({{ qa(F['staff']) }}),
                ',"act":', toJSONString({{ qa(F['act']) }}),
                ',"vals":{"paint":[],"it":', (SELECT toJSONString(groupArray((v, e))) FROM (
                    SELECT ifNull(emp_specialization_it_code, '-') AS v, sum(toFloat64(ifNull(hc_total_cnt, 0))) AS e
                    FROM prod_proteus.hr_structure_overall
                    WHERE report_month = (SELECT lm FROM cal)
                      AND (ifNull(mng_unit_rk, ''), {{ pth() }}) IN (SELECT u0, pk0 FROM lmr)
                    GROUP BY v ORDER BY e DESC, v)),
                ',"staff":', (SELECT toJSONString(groupArray((v, e))) FROM (
                    SELECT if(ifNull(employment_relation_type, '') = 'Штатный сотрудник', 'Штат', 'Не штат') AS v,
                           sum(toFloat64(ifNull(hc_total_cnt, 0))) AS e
                    FROM prod_proteus.hr_structure_overall
                    WHERE report_month = (SELECT lm FROM cal)
                      AND (ifNull(mng_unit_rk, ''), {{ pth() }}) IN (SELECT u0, pk0 FROM lmr)
                    GROUP BY v ORDER BY e DESC, v)),
                ',"act":', (SELECT toJSONString(groupArray((v, e))) FROM (
                    SELECT {{ CUTS[2][2] }} AS v, sum(toFloat64(ifNull(hc_total_cnt, 0))) AS e
                    FROM prod_proteus.hr_structure_overall
                    WHERE report_month = (SELECT lm FROM cal)
                      AND (ifNull(mng_unit_rk, ''), {{ pth() }}) IN (SELECT u0, pk0 FROM lmr)
                    GROUP BY v ORDER BY e DESC, v)),
                '},"fdv":{"paint":[],"it":', toJSONString((SELECT fa FROM fdv)), ',"staff":', toJSONString((SELECT fb FROM fdv)),
                ',"act":', toJSONString((SELECT fc FROM fdv)), '}}') AS j,
         {{ blank() }}

  UNION ALL

  SELECT p.o AS o, multiIf(p.o = 1, 'scope', p.o = 2, 'base', p.o = 5, 'c', p.o = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm AS nm, toUInt32(ifNull(k.k, 0)) AS kids, '' AS j,
{%- for m in M %}
{%- if m[0] == 'avg' %}
         {{ out("arrayMap(i -> (a.a_hc[i] + if(i = 1, if((SELECT hp FROM cal) = 1, a.p_hc, a.a_hc[1]), a.a_hc[i - 1])) / 2, arrayEnumerate(a.a_hc))") }} AS m_avg,
{%- else %}
         {{ out('a.a_' ~ m[0]) }} AS m_{{ m[0] }},
{%- endif %}
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
                                             toString(ifNull(k.k, 0)), '\t', s.nm, '\t\t', ifNull(f.fds, '')))), '\n') AS j,
         {{ blank() }}
  FROM st2 AS s
  LEFT JOIN kd AS k ON k.kr = s.rk
  LEFT JOIN fdr AS f ON f.fr = s.rk

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, {{ blank() }}
)
)
ORDER BY o, lvl, nm, id

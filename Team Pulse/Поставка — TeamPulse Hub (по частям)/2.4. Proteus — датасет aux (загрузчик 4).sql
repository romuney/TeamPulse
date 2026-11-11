{#- TeamPulse Hub, дашборд «по частям». ЧАСТЬ aux — загрузчик 4: AI-инструменты и база похожих подразделений.
    Собрано stand/mk_split.py из датасета обычной поставки (файл 2): тот же текст, отличается одна строка —
    {% set PART = 'aux' %}. Руками не править: правка — в файле 2, затем скрипт. Описание строк и колонок ответа —
    в шапке файла 2. Колонки: role, id, pid, lvl, nm, kids, j, ms, mx. Первая строка части — role = 'part'. -#}
{#- Строковый литерал ClickHouse: сначала слэш → \\, затем кавычка → '' (не \': лексер
    sqlparse Proteus его не понимает — тихо меняет ответ); слэши в конце — repeat(char(92), N). -#}
{% macro qs(v) -%}
{%- set s = v|string -%}{%- set t = s.rstrip('\\') -%}
{%- if t|length < s|length -%}concat('{{ t|replace('\\', '\\\\')|replace("'", "''") }}', repeat(char(92), {{ s|length - t|length }}))
{%- else -%}'{{ s|replace('\\', '\\\\')|replace("'", "''") }}'{%- endif -%}
{%- endmacro %}
{#- Массив строк для toJSONString(); пустой — типизированный. array(…), а не […]:
    «]» в значении sqlparse принял бы за конец имени [..] и сбил строки (значений ≤ 20). -#}
{% macro qa(values) -%}
{%- if values|length == 0 -%}CAST([], 'Array(String)'){%- else -%}array({% for v in values %}{{ qs(v) }}{% if not loop.last %}, {% endif %}{% endfor %}){%- endif -%}
{%- endmacro %}
{#- Значения фильтра строчными — кортеж для IN: ClickHouse строит множество один раз. -#}
{% macro ql(values) -%}({% for v in values %}{{ qs(v|lower) }}{% if not loop.last %}, {% endif %}{% endfor %}){%- endmacro %}
{#- Значения фильтров собираются циклом: при сохранении датасета Proteus отдаёт
    вместо списка AlwaysTrueObject — у него нет ни длины, ни «+». -#}
{% set unit_req = [] %}{% for v in (filter_values('unit_f') or []) %}{% if v|string|trim != '' and unit_req|length < 1 %}{% set _ = unit_req.append(v|string|trim) %}{% endif %}{% endfor %}
{#- Поставка 69: ПОЛНЫЙ ДОСТУП — логины, которые видят всю компанию. Впишите их строчными в кавычках через
    запятую, например: {% set FULL = ['ivanov', 'petrova'] %}. Пустой список — полного доступа по списку нет ни у кого.
    12.11-в: таблица прав teampulse_hub_access — ДОПОЛНЕНИЕ к прежнему доступу, а не замена: список FULL и зона
    руководителя (head_login) работают как до неё; строки таблицы прав только добавляют логину юниты (см. cx0). -#}
{% set FULL = [] %}
{#- Поставка «по частям» (11.11): тот же датасет отдаёт либо весь ответ (PART = 'all' — один чарт, как раньше), либо одну
    часть для чарта-загрузчика. Части: dict — справочник узлов (от фильтров не зависит: датасет главного чарта); core — meta,
    ряды узлов ответа и строка HQ (первый экран); people — разрезы из teampulse_hub_mix и профили; flow — разрезы
    переводов, водопада и вакансий; aux — AI-инструменты и база похожих подразделений (peer). Файлы частей пишет
    stand/mk_split.py: меняется только эта строка. У части первая строка — role = 'part': какая часть и эхо применённых фильтров
    (по нему главный чарт сводит части одного выбора). -#}
{% set PART = 'aux' %}
{% set P_ALL = PART == 'all' %}{% set P_DICT = PART in ('all', 'dict') %}{% set P_CORE = PART in ('all', 'core') %}
{% set P_PPL = PART in ('all', 'people') %}{% set P_FLOW = PART in ('all', 'flow') %}{% set P_AUX = PART in ('all', 'aux') %}
{% set P_MX = P_PPL or P_FLOW or P_AUX %}
{#- UNION ALL между ветками, которые есть в части: перед первой веткой пусто -#}
{% set U1 = [] %}{% set U2 = [] %}
{% macro ua(us) -%}{%- if us|length > 0 -%}UNION ALL{%- endif -%}{%- set _ = us.append(1) -%}{%- endmacro %}
{#- логин входит в ключ кэша: Proteus ищет вызов current_username() внутри {{ }} на одной строке -#}
{% macro me() -%}{{ qs((current_username() or '')|string|trim|lower) }}{%- endmacro %}
{#- Тип численности строки: act_cd матчером; колонки нет — «∅» (строка проходит любой фильтр типа). -#}
{% set AC = "ifNull(toString(act_cd), '∅')" %}
{% set CUTS = [['paint', 'paint_f', "ifNull(paint_cd, '-')"], ['it', 'it_f', "ifNull(it_cd, '-')"], ['staff', 'staff_f', "ifNull(staff_cd, '-')"], ['act', 'act_f', AC]] %}
{% set F = {} %}
{% for c in CUTS %}{% set vals = [] %}{% for v in (filter_values(c[1]) or []) %}{% if v|string != '' and vals|length < 20 %}{% set _ = vals.append(v|string) %}{% endif %}{% endfor %}{% set _ = F.update({c[0]: vals}) %}{% endfor %}
{#- Тип численности (поставка 60): любой набор типов active_type_nm; не выбран — ACT_DEF: «Активная», без
    подрядчиков (поставка 61; подрядчиков добавляют в фильтре); «Вся» — без фильтра. act_on — выбран хоть один тип. -#}
{% set ACT_DEF = ['Активная'] %}
{% set av = [] %}{% for v in F['act'] %}{% set _ = av.append(v|lower) %}{% endfor %}
{% if 'вся' in av or 'all' in av %}{% set _ = F.update({'act': []}) %}{% elif av|length == 0 %}{% set _ = F.update({'act': ACT_DEF}) %}{% endif %}
{% set act_on = F['act']|length > 0 %}
{#- Обычные (non-regrettable) увольнения — матчером: нет колонки — ноль. Найм — HI ниже (события дня найма). -#}
{% set NREG = "ifNull(toFloat64(nreg_cnt), 0)" %}
{#- Строка проходит фильтры: значение в выбранном списке без учёта регистра; не выбран — 1. -#}
{% macro cond() -%}
{%- set parts = [] -%}
{%- for c in CUTS -%}{%- if F[c[0]]|length > 0 -%}{%- set hv = 'lowerUTF8(' ~ c[2] ~ ') IN ' ~ ql(F[c[0]]) -%}{%- set _ = parts.append(("(" ~ c[2] ~ " = '∅' OR " ~ hv ~ ")") if c[0] == 'act' else hv) -%}{%- endif -%}{%- endfor -%}
{{- ('[' ~ parts|join(' AND ') ~ '][1]') if parts else '1' -}}
{%- endmacro %}
{#- 31.10-б, п. 6: «Рост HQ» — только HQ-заявки по смыслу данных, фильтр покраски его не меняет: условие без покраски
    (IT-код, штат, тип численности — как выбраны). По нему — ряды gah gdh (одобренные и отклонённые) и разрезы rm rq rs. -#}
{% macro cond_np() -%}
{%- set parts = [] -%}
{%- for c in CUTS -%}{%- if c[0] != 'paint' and F[c[0]]|length > 0 -%}{%- set hv = 'lowerUTF8(' ~ c[2] ~ ') IN ' ~ ql(F[c[0]]) -%}{%- set _ = parts.append(("(" ~ c[2] ~ " = '∅' OR " ~ hv ~ ")") if c[0] == 'act' else hv) -%}{%- endif -%}{%- endfor -%}
{{- ('[' ~ parts|join(' AND ') ~ '][1]') if parts else '1' -}}
{%- endmacro %}
{#- Файл 6, п. 4: «Рост HQ» — только по численности HQ: покраска HQ вместо выбранной (фильтр покраски вкладку не меняет),
    IT-код, штат и тип численности — как выбраны. По нему — ряды gah gdh и разрезы rm rq rs (были — cond_np, без покраски:
    итог совпадал с «Все»). -#}
{% macro cond_rh() -%}
{{- "[lowerUTF8(ifNull(paint_cd, '-')) IN ('hq')][1] AND " ~ cond_np() -}}
{%- endmacro %}
{#- Поставка 65: строка hq — светофор «Как уходит HQ?» всегда по активной численности HQ: покраска HQ и тип «Активная»
    вместо выбранных в фильтрах, IT-код и штат — как выбраны. -#}
{% macro cond_hq() -%}
{%- set parts = ["lowerUTF8(ifNull(paint_cd, '-')) IN ('hq')", "(" ~ AC ~ " = '∅' OR lowerUTF8(" ~ AC ~ ") IN " ~ ql(ACT_DEF) ~ ")"] -%}
{%- for c in CUTS -%}{%- if c[0] in ('it', 'staff') and F[c[0]]|length > 0 -%}{%- set _ = parts.append('lowerUTF8(' ~ c[2] ~ ') IN ' ~ ql(F[c[0]])) -%}{%- endif -%}{%- endfor -%}
{{- '[' ~ parts|join(' AND ') ~ '][1]' -}}
{%- endmacro %}
{#- Переводы (поставка 59) — как в мастер-отчёте (старый TeamPulse: transfer_in / transfer_out), сверено на выборках
    боя. Строка переходов ноутбука — событие дня с флагом источника; срез строки — состояние этого дня (фильтры —
    в WHERE). Перевод засчитан, если у строки флаг юнита этого уровня (fu) или смены атрибута, по которому выбран
    фильтр: fa — тип численности (по умолчанию «Активная»), fp — покраска, fi — IT-код, fs — тип оформления. Без
    фильтра смена атрибута — не перевод. Флаг смены засчитан как есть и при фильтре из нескольких значений:
    Подрядчики → Активная при выборе «Активная + Подрядчики» — и «из», и «в», как в мастер-отчёте (поставка 63,
    сверено на выгрузке боя 22.10; x_… больше не нужны).
    in_ok = 0 — кандидат или стажёр: из «в» исключается всегда (как в transfers.yaml); при выборе типов — найм.
    Найм (hit) — по дню события: найм в компанию (вид h) и, при выборе типов, такие переходы. -#}
{% set FK = {'act': 'fa', 'paint': 'fp', 'it': 'fi', 'staff': 'fs'} %}
{#- Поставка 109 (скорость разбора): флаги и вид перехода без ifNull — они стоят только внутри сумм, а NULL в сумме
    не считается, как и 0 (под NOT эти выражения не стоят; FU и in_ok — с ifNull: там NULL значил бы другое) -#}
{% set fl = ['fu = 1'] %}{% for c in CUTS %}{% if F[c[0]]|length > 0 %}{% set _ = fl.append(FK[c[0]] ~ ' = 1') %}{% endif %}{% endfor %}
{% set FLG = '(' ~ fl|join(' OR ') ~ ')' %}
{#- Поставка 105 (06.11, владелец): перевод замкнутого водопада (teampulse_hub_flow) — вход в периметр отчёта или выход из
    него: периметр — узел + выбранные фильтры. Засчитан, если человек пришёл в узел извне или ушёл из него (chg_unit),
    или другая сторона перехода (oth_*: у «в» — откуда, у «из» — куда) вне выбранных фильтров: Support → HQ при фильтре
    HQ — перевод, при HQ + Support или без фильтра покраски — нет. У строк специализаций смена специализации (chg_sp) —
    всегда перевод. Колонок нет (ноутбук до правки 06.11) — перевод засчитан всегда. -#}
{% macro fchg(c, d) -%}ifNull(toFloat64({{ c }}), toFloat64({{ d }})){%- endmacro %}
{% macro foth(c) -%}lowerUTF8(ifNull(toString({{ c }}), '')){%- endmacro %}
{% set FO = {'act': 'oth_act_cd', 'paint': 'oth_paint_cd', 'it': 'oth_it_cd', 'staff': 'oth_staff_cd'} %}
{% set fo = [] %}{% for c in CUTS %}{% if F[c[0]]|length > 0 %}{% set _ = fo.append(foth(FO[c[0]]) ~ ' IN ' ~ ql(F[c[0]])) %}{% endif %}{% endfor %}
{% set OTHIN = '(' ~ (fo|join(' AND ') if fo else '1') ~ ')' %}
{% set FLW = '(' ~ fchg('chg_unit', 1) ~ ' = 1 OR NOT ' ~ OTHIN ~ ')' %}
{% set FLWS = '(' ~ fchg('chg_unit', 1) ~ ' = 1 OR ' ~ fchg('chg_sp', 0) ~ ' = 1 OR NOT ' ~ OTHIN ~ ')' %}
{% set FTI = "toFloat64(ifNull(tin_cnt, 0)) * toFloat64(" ~ FLW ~ ")" %}
{% set FTU = "toFloat64(ifNull(tout_cnt, 0)) * toFloat64(" ~ FLW ~ ")" %}
{#- 09.11 (стенд в пропорциях боя, мастер-отчёт): in_ok = 0 — день перехода из учебной группы в боевую или стажёра в штат.
    При выбранных типах численности это найм (HI), не перевод. При «Вся» флаги «Перевод в БГ» / «Перевод стажера в штат»
    в периметр не входят, переход — не событие: строка этого дня — перевод по флагу юнита или специализации, как любая -#}
{% set INOK = "ifNull(in_ok, 1) = 1" if act_on else "1" %}
{% set TI = "toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND " ~ FLG ~ " AND " ~ INOK ~ ")" %}
{#- 09.11 (владелец: «найм — событие дня найма, никакого двойного счёта; активная численность — просто фильтр»): найм везде —
    «Найм, чел», найм водопада, найм по специализациям, строка HQ, разбивки найма (источник, канал, грейд, специализация) —
    одни и те же строки переходов: найм в компанию (вид h) со срезом дня найма и, при выбранных типах численности, переход
    из учебной группы в боевую или стажёра в штат (вид i, in_ok = 0) — по его флагу, как мастер-отчёт (Executive Report:
    при фильтре типа численности флаги «Перевод в БГ» и «Перевод стажера в штат» входят в периметр сами, без флага
    смены типа или юнита; было — с флагом FLG). Нанят в Support и в том же периоде
    переведён в HQ — при фильтре HQ это перевод «в», не найм. Было: ряды hire_cnt / hco_cnt (срез конца месяца) — водопад
    при фильтрах не сходился -#}
{% macro hi_e(on) -%}
toFloat64(trf_cnt) * toFloat64(trf_kind = 'h'{{ " OR (trf_kind = 'i' AND ifNull(in_ok, 1) = 0 AND ifNull(toString(cv_k), '') != '')" if on else "" }})
{%- endmacro %}
{% set HI = hi_e(act_on) %}
{% set TU = "toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND " ~ FLG ~ ")" %}
{#- Поставка 65: вид перехода в найм (cv_k: c — из учебной группы в боевую, s — стажёр в штат) — матчером. Найм по
    видам — те же переходы, что во второй части HI (только при выбранных типах численности). -#}
{% set CVK = "ifNull(toString(cv_k), '')" %}
{#- 28.10: специализация строки переходов (sp_cd) — матчером; нет колонки — пусто, строки отбрасываются. -#}
{#- 09.11 (бой: строка людей без специализации в «Движении по специализациям» несла только переводы): нет специализации
    ('-' в переходах) — «Не указано», строка со всеми колонками (в витрине движения sp_cd = 'Не указано') -#}
{% set SPC = "if(ifNull(toString(sp_cd), '-') = '-', 'Не указано', toString(sp_cd))" %}
{#- 31.10, п. 10; поставка 90 (заказчик): переводы по специализациям — по флагам переводов под фильтры (TI / TU: вход в
    выбор и выход из него) ИЛИ по флагу смены специализации transfer_to / transfer_out_specialization_flg (fsp строки
    переходов, матчером) — смена специализации и внутри выбора тоже перевод; строка одна — перевод один. Тогда «на начало +
    найм + переводы в − отток − переводы из = на конец» сходится по каждой специализации и в ИТОГО. Таблица ноутбука до
    31.10 колонки fsp не знает (−1) — только переводы юнита. -#}
{% set FSP = "ifNull(toFloat64(fsp), -1)" %}
{#- 03.11, поставка 103 (файл 9, п. 9): переводы по специализациям — только флаг юнита своего уровня (fu узла:
    lvlN_mngt_unit_in / out_trsf_flg этого уровня; у «напрямую» — любой флаг юнита строки). Перемещение между
    подразделениями внутри узла переводом узла не считается. Смена специализации или среза без смены юнита этого
    уровня (fsp, флаги фильтров) — отдельно: ci / co («внутри юнита»), чтобы строка специализации сходилась:
    на начало + найм + в − отток − из + (ci − co) = на конец. -#}
{% set FU = "ifNull(fu, 0) = 1" %}
{#- 09.11 (владелец: «пользоваться только флагами, суммой флагов»): переводы строки специализации — флаги in / out источника:
    юнит уровня узла и атрибуты под фильтрами (FLG, как карточки «Переводы») и смена специализации (fsp) -#}
{% set SPI = "toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND (" ~ FLG ~ " OR " ~ FSP ~ " = 1) AND " ~ INOK ~ ")" %}
{% set SPU = "toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND (" ~ FLG ~ " OR " ~ FSP ~ " = 1))" %}
{% set SI = "toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND " ~ FU ~ " AND ifNull(in_ok, 1) = 1)" %}
{% set SU = "toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND " ~ FU ~ ")" %}
{% set CI = "toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND NOT (" ~ FU ~ " AND ifNull(in_ok, 1) = 1) AND ((" ~ FLG ~ " AND ifNull(in_ok, 1) = 1) OR " ~ FSP ~ " = 1))" %}
{% set CO = "toFloat64(trf_cnt) * toFloat64(trf_kind = 'o' AND NOT (" ~ FU ~ ") AND (" ~ FLG ~ " OR " ~ FSP ~ " = 1))" %}
{#- Поставка 66: ряд таблицы series — матчером: таблица ноутбука до 66 колонки не знает — нули. -#}
{% macro optf(c) -%}ifNull(toFloat64({{ c }}), 0){%- endmacro %}
{% macro hk(v) -%}
{%- if act_on -%}toFloat64(trf_cnt) * toFloat64(trf_kind = 'i' AND ifNull(in_ok, 1) = 0 AND {{ CVK }} = '{{ v }}'){%- else -%}toFloat64(0){%- endif -%}
{%- endmacro %}
{#- Метрики: ключ, таблица (s — series, t — trf, d — trf «напрямую», v — vacancy, a — ai, g/h — series-срезы,
    w — flow: замкнутый водопад поставки 105: узел × месяц × срез, строки юнитов teampulse_hub_flow sp = '-';
    fin = beg + hire - fire + tin - tout по построению), выражение. Порядок — порядок в ms. -#}
{% set M = [['hc', 's', 'hc_cnt'], ['act', 's', 'act_cnt'], ['avg', 's', 'avg_cnt'], ['hire', 't', HI], ['fire', 's', 'fire_cnt'], ['reg', 's', 'reg_cnt'], ['nreg', 's', NREG], ['tin', 't', TI], ['tout', 't', TU], ['pnor', 's', 'pnor_cnt'], ['plow', 's', 'plow_cnt'], ['phig', 's', 'phig_cnt'], ['pgry', 's', 'pgry_cnt'], ['wday', 's', 'wday_amt'], ['ovis', 's', 'ovis_amt'], ['fwday', 's', optf('fwday_amt')], ['obase', 's', optf('obase_cnt')], ['hob', 's', optf('hob_cnt')], ['nob', 's', optf('nob_cnt')], ['fovis', 's', optf('fovis_amt')], ['vbk', 's', optf('vbk_amt')], ['gapr', 's', 'gapr_cnt'], ['gdec', 's', 'gdec_cnt'], ['vop', 'v', 'vac_open_cnt'], ['vcl', 'v', 'vac_close_cnt'], ['vap', 'v', 'vac_new_cnt'], ['vtd', 'v', 'vac_ttf_days'], ['vtn', 'v', 'vac_ttf_cnt'], ['vjn', 'v', "if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0)"], ['hit', 't', HI], ['din', 'd', TI], ['dout', 'd', TU], ['hcd', 't', hk('c')], ['hst', 't', hk('s')], ['bk', 's', optf('bk_amt')], ['bkv', 's', optf('bkv_amt')], ['vsv', 's', optf('vsv_amt')], ['hwd', 's', optf('hwd_amt')], ['hov', 's', optf('hov_amt')], ['rh', 'h', 'reg_cnt'], ['nrh', 'h', NREG], ['avh', 'h', 'avg_cnt'], ['fh', 'h', 'fire_cnt'], ['hch', 'h', 'hc_cnt'], ['ab25', 's', optf('ab25_cnt')], ['ab5', 's', optf('ab5_cnt')], ['we25', 's', optf('we25_cnt')], ['we5', 's', optf('we5_cnt')], ['t23', 's', optf('t23_cnt')], ['t35', 's', optf('t35_cnt')], ['t5', 's', optf('t5_cnt')], ['hrs', 's', optf('hrs_amt')], ['hrn', 's', optf('hrn_cnt')], ['tlk', 's', optf('tlk_amt')], ['gah', 'g', 'gapr_cnt'], ['gdh', 'g', 'gdec_cnt'], ['hrw', 's', optf('hrs_sum_amt')], ['pdw', 's', optf('plan_day_cnt')], ['tkw', 's', optf('tlk_sum_amt')], ['fbeg', 'w', 'beg_cnt'], ['fhire', 't', HI], ['ffire', 'w', 'fire_cnt'], ['ftin', 'w', FTI], ['ftout', 'w', FTU], ['ffin', 'w', 'fin_cnt']] %}
{% set MI = {} %}{% for m in M %}{% set _ = MI.update({m[0]: loop.index}) %}{% endfor %}
{#- Метрики таблицы одним массивом: суммы по колонкам (быстрее, чем суммировать массивы построчно), чужие
    этой таблице — нули отрезками arrayWithConstant (короче текст). array(…), а не […]: в переводах внутри стоят
    значения фильтров, и «]» в значении sqlparse принял бы за конец имени [..]. -#}
{#- keep — только эти ключи таблицы (остальные — нули): поставка 109, строка hq светофора берёт hc act avg hire fire reg nreg.
    Поставка 109 (скорость разбора в Proteus: reindent sqlparse платит за каждую скобку): сумма — sum(toFloat64(x)) без
    ifNull у каждой метрики, NULL суммы (все строки группы NULL) — в 0 одним arrayMap на отрезок; итог тот же -#}
{% macro vec(src, keep=None) -%}
{#- поставка 113-к (скорость разбора в Proteus): вектор месяца — один литерал […], нули чужих метрик — 0. sqlparse читает
    литерал без «]» внутри одним именем (гайд SP-07, SP-16): скобки сумм ему не видны (у компании «(» 1 064 → 749) -#}
{%- set xs = [] -%}
{%- for m in M -%}
{%- if m[1] == src and (keep is none or m[0] in keep) -%}{%- set _ = xs.append('sum(toFloat64(' ~ m[2] ~ '))') -%}
{%- else -%}{%- set _ = xs.append('0') -%}{%- endif -%}
{%- endfor -%}
arrayMap(x -> ifNull(x, 0), [{{ xs|join(', ') }}])
{%- endmacro %}
{#- Узлы ответа (множество для IN) и месяц строки от начала сетки — через проекцию общего скаляра. -#}
{% set PK = '(SELECT tupleElement(arrayJoin(cxpk), 1))' %}
{#- Поставка 64: «напрямую в юните» — узлы ответа с ':d' (переводы людей в самом юните, без подразделений) -#}
{% set PKD = "(SELECT concat(tupleElement(arrayJoin(cxpk), 1), ':d'))" %}
{% set IDX = "toInt32(dateDiff('month', cxm0, toDate(assumeNotNull(report_month))))" %}
{% set GRID = 'report_month BETWEEN cxm0 AND cxlm' %}
{% set FV = '(SELECT fv FROM fdv)' %}
{#- Значения фильтров с численностью компании за последний месяц (окно настройки) — одним проходом:
    JSON-объект «разрез → [{v, e}]», значения по убыванию численности. -#}
{% set VALS %}(SELECT concat('{"paint":', toJSONString(groupArrayIf((v, e), g = 1)), ',"it":', toJSONString(groupArrayIf((v, e), g = 2)),
                 ',"staff":', toJSONString(groupArrayIf((v, e), g = 3)), ',"act":', toJSONString(groupArrayIf((v, e), g = 4)), '}')
  FROM (
    SELECT gv.1 AS g, gv.2 AS v, sum(ifNull(hc_cnt, 0)) AS e
    FROM prod_proteus.teampulse_hub_series
    ARRAY JOIN [(1, ifNull(paint_cd, '-')), (2, ifNull(it_cd, '-')), (3, ifNull(staff_cd, '-')), (4, {{ AC }})] AS gv
    WHERE node_rk = cxr AND report_month = cxlm
    GROUP BY g, v ORDER BY e DESC, v))
{%- endset %}
{#- Запрос начинается с SELECT, цепочка CTE — внутри: так его без правок принимает и SQL Lab. -#}
SELECT role, id, pid, lvl, nm, kids, j, ms, mx
FROM
(
WITH
  {#- Контекст одним скаляром: календарь, корень, юнит по умолчанию, дата данных, выбранный юнит (из
      фильтра, если он есть в структуре, иначе по умолчанию) и узлы ответа с порядком строк: 1 — выбранный,
      2 — корень, 5–7 — один, два, три уровня под выбранным. Псевдонимы не совпадают с колонками, из
      которых считаются (иначе новый анализатор 24.8 отдаёт пустой скаляр). #}
  cx0 AS (
    SELECT (lm, m0, n, r, d, dd, s,
            if(ok, arrayConcat([(s, toUInt8(1)), (r, toUInt8(2))], arrayMap(x -> (x, toUInt8(5)), d1),
                               arrayMap(x -> (x, toUInt8(6)), d2), arrayMap(x -> (x, toUInt8(7)), d3)), CAST([], 'Array(Tuple(String, UInt8))')),
            zr, ok, fl, an) AS c0
    FROM
    (
      {#- поставка 69, доступ: fl — полный доступ; zr — корни зоны (вся компания у полного доступа, иначе подразделения,
          где логин — руководитель); узел в зоне — корень зоны есть в его пути; s — запрошенный юнит, если он в зоне,
          иначе юнит по умолчанию (полный доступ) или первый корень зоны #}
      {#- 12.11-б (бой: суперюзеру открылся случайный юнит): вся компания — у кого открыт корень ИЛИ единственный потомок
          корня (корень технический: под ним одна «компания», и права выдают на неё). У корня несколько потомков — только корень #}
      SELECT lm, m0, n, r, d, dd,
             has({{ qa(FULL) }}, {{ me() }}) OR has(zq, r) OR (arrayCount(x -> x.2 = r, al) = 1 AND has(zq, tupleElement(arrayFirst(x -> x.2 = r, al), 1))) AS fl,
             {#- 12.11, бой (Code 241, 10 ГиБ): зона считалась лямбдой по юнитам логина с захватом всего справочника al — у
                 логина с тысячами строк доступа справочник копировался на каждом шаге. Теперь корни зоны (zq) и их предки
                 (anq) приходят готовыми из соединения таблиц (fa), лямбд с захватом растущих массивов нет #}
             if(fl, [r], zq) AS zr,
             length(zr) > 0 AS ok,
             if(fl, [r], anq) AS an,
             if({% if unit_req %}hasAny(splitByChar('|', tupleElement(arrayFirst(x -> x.1 = {{ qs(unit_req[0]) }}, al), 3)), zr){% else %}0{% endif %},
                {{ qs(unit_req[0]) if unit_req else "''" }}, if(fl, d, if(ok, zr[1], ''))) AS s,
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
      {#- 12.11 (владелец: единый источник прав): доступ — из teampulse_hub_access (ноутбук: уникальные пары «логин, юнит» из
          usr_cross_data.new_access_to_digest_line). au — юниты логина; логин открывает юнит и всё под ним; есть корень — вся
          компания. Таблица прав дополняет список FULL и зону руководителя, а не заменяет их (12.11-в) #}
      {#- au — все юниты логина; zq — корни его зоны: юниты логина, которые есть в структуре отчёта и у которых ни один
          предок не открыт этому же логину (юнит под уже открытым юнитом отдельным корнем не нужен); anq — узлы путей к корням #}
      {#- 12.11-г (бой: у суперюзера в таблице прав строки на все юниты, кроме двух верхних уровней-заглушек — отчёт видел
          сотни отдельных корней вместо компании). Узел открыт, если открыт он сам, его предок ИЛИ все листья под ним:
          AUQ — юниты логина (таблица прав + где он руководитель, 12.11-в); UX — узлы над хотя бы одним закрытым листом
          (лист закрыт, если в его пути нет юнита из AUQ). Открытый узел — не из UX; корень зоны — открытый узел, чей
          родитель закрыт. Открыто всё — корень отчёта не в UX, это полный доступ. Множества — через IN (хеш), без лямбд
          с захватом больших массивов (урок Code 241) #}
      {%- set AUQ = "(SELECT ifNull(toString(unit_rk), '') FROM prod_proteus.teampulse_hub_access WHERE lowerUTF8(trimBoth(ifNull(toString(login), ''))) = " ~ me() ~ " AND " ~ me() ~ " != '' UNION ALL SELECT ifNull(unit_rk, '') FROM prod_proteus.teampulse_hub_unit WHERE lowerUTF8(trimBoth(ifNull(toString(head_login), ''))) = " ~ me() ~ " AND " ~ me() ~ " != '')" %}
      {%- set UX = "(SELECT arrayJoin(splitByChar('|', ifNull(path_rk, ''))) FROM prod_proteus.teampulse_hub_unit WHERE ifNull(kids_cnt, 0) = 0 AND ifNull(unit_rk, '') IN (SELECT lf FROM (SELECT ifNull(unit_rk, '') AS lf, splitByChar('|', ifNull(path_rk, '')) AS lph FROM prod_proteus.teampulse_hub_unit WHERE ifNull(kids_cnt, 0) = 0) ARRAY JOIN lph AS la GROUP BY lf HAVING max(la IN " ~ AUQ ~ ") = 0))" %}
      CROSS JOIN (SELECT {#- корни зоны — сверху вниз по уровню: первым (юнит по умолчанию) идёт самый верхний, а не случайный #}
                         arrayMap(x -> x.2, arraySort(groupArray((t.lv, t.id)))) AS zq, arrayDistinct(arrayFlatten(groupArray(t.ph))) AS anq
                  FROM (SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pr, splitByChar('|', ifNull(path_rk, '')) AS ph,
                               toInt32(ifNull(unit_lvl, 0)) AS lv
                        FROM prod_proteus.teampulse_hub_unit) AS t
                  WHERE t.id != '' AND t.id NOT IN {{ UX }} AND (t.pr = '' OR t.pr IN {{ UX }})) AS fa
    )
  ),
  {#- поставка 113-и (скорость: 8б на бою — почти всё время в разборе и плане запроса): контекст — скаляр ctx и его поля
      короткими псевдонимами (cxlm … cxan). Ссылка «cxlm» — для нового анализатора отдельная копия cx0 с её
      лямбдами: 79 копий разбирались 2,3 с (стенд, ClickHouse 24.8), с псевдонимами — 0,6 с; ответ тот же. Имена с cx —
      не колонки таблиц (prefer_column_name_to_alias) #}
  (SELECT c0 FROM cx0) AS ctx, ctx.1 AS cxlm, ctx.2 AS cxm0, ctx.3 AS cxn, ctx.4 AS cxr, ctx.5 AS cxd, ctx.6 AS cxdd,
  ctx.7 AS cxs, ctx.8 AS cxpk, ctx.9 AS cxzr, ctx.10 AS cxok, ctx.11 AS cxfl, ctx.12 AS cxan,
  {#- поставка 90: cm — последний закрытый месяц, как cm ноутбука (teampulse_hub_cal): последний месяц, если дата данных —
      его последний день или он январь, иначе месяц перед ним; даты данных нет (старая таблица) — вчера, но не позже конца
      месяца. «С начала года» — январь..cm #}
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT ctx AS c)
  ),
  {#- head_login и head_nm (поставка 66) — матчером: таблица без колонки даёт пустой логин и имя #}
  {#- поставка 113 (владелец 07.11: «медиана должна работать как база — фильтруем, и она пересчитывается»): распределение
      метрик по ВСЕМ подразделениям компании под теми же фильтрами, что и база, по группам размера (численность на закрытый
      месяц: 1 — 30–99, 2 — 100–299, 3 — 300–999, 4 — 1000+; меньше 30 — не в счёт). Метрики — те же формулы, что у чарта, за
      январь–закрытый месяц (закрытый: последний, если дата данных — его последний день, иначе предыдущий):
      turnover_y — сумма месячных «уходы ÷ ССЧ», turnover_m — Σ уходов ÷ Σ ССЧ, underwork / overwork — Σ категории ÷ Σ четырёх,
      office_att — Σ посещений ÷ Σ рабочих дней. Строка peer: «метрика, группа, подразделений, p25, p50, p75» #}
  {% if P_AUX %}
  pmc AS (
    {#- поставка 137 (владелец: «все метрики — по текущую доступную дату»): окно базы — январь..последний месяц данных,
        вместе с незакрытым (было — по закрытый); fr — доля незакрытого месяца по дням: с этим весом его ССЧ входит в
        знаменатель turnover_m, как у чарта (periodTotal) #}
    SELECT lm AS mc, if(dd = '' OR toDate(substring(dd, 1, 10)) >= toLastDayOfMonth(lm), 1.,
                        toDayOfMonth(toDate(substring(dd, 1, 10))) / toDayOfMonth(toLastDayOfMonth(lm))) AS fr FROM cx
  ),
  {#- поставка 118 (владелец 07.11: «база — похожие по численности подразделения — по всему отчёту»): ещё четыре метрики.
      tgrowth_conv — Σ одобренных ÷ Σ рассмотренных заявок «Роста» (узел — от 5 заявок, как порог чарта), booking_viol —
      Σ броней без посещения ÷ Σ броней: ряды узла под теми же фильтрами (pnv). time_to_fill — медиана сроков вакансий,
      закрытых январь–закрытый месяц (узел — от 3 вакансий): вакансии не люди, фильтров у них нет (pvt), группа — по
      численности узла под фильтрами, как у остальных. ai_penetration — WAU ÷ численность без стажёров последней полной
      недели (неделя закончилась не позже даты данных), без фильтров, группа — по этой численности (pai), как на вкладке AI.
      Медиана срока — как у чарта (medianOf): при чётном числе вакансий — полусумма двух средних (две точки 0,5 и 0,500001) #}
  {#- поставка 125 (владелец 08.11: «недоработчиков больше, чем в базе», а база — 0%): в базу недо- и переработки шли и подразделения без
      мониторинга — у них все люди «не размечено», доли 0%, и база по группе выходила 0%. Теперь подразделение входит в базу
      этих двух метрик, только если «не размечено» — не больше половины людей за те же месяцы (gy × 2 ≤ al), как в чарте
      (D.monJudged); формулы долей прежние #}
  pnv AS (
    SELECT pu, sum(h) AS hc9, sumIf(f / a * 100, a > 0) AS v_ty, sum(f) / sum(aw) * 100 AS v_tm,
           [if(sum(gy) * 2 <= sum(al), sum(lo) / sum(al) * 100, nan)][1] AS v_uw,
           [if(sum(gy) * 2 <= sum(al), sum(hi) / sum(al) * 100, nan)][1] AS v_ow, sum(ov) / sum(wd) * 100 AS v_oa,
           [if(sum(ga) + sum(gd) >= 5, sum(ga) / (sum(ga) + sum(gd)) * 100, nan)][1] AS v_tc, [sum(bv) / sum(bk) * 100][1] AS v_bv
    FROM (
      SELECT ifNull(node_rk, '') AS pu, sumIf(toFloat64(hc_cnt), report_month = mc) AS h, sum(toFloat64(avg_cnt)) AS a,
             sum(toFloat64(avg_cnt) * if(report_month = mc, fr, 1.)) AS aw,
             sum(toFloat64(fire_cnt)) AS f, sum(plow_cnt) AS lo, sum(phig_cnt) AS hi,
             sum(pnor_cnt + plow_cnt + phig_cnt + pgry_cnt) AS al, sum(pgry_cnt) AS gy, sum(ovis_amt) AS ov, sum(wday_amt) AS wd,
             [sum(toFloat64(gapr_cnt))][1] AS ga, [sum(toFloat64(gdec_cnt))][1] AS gd, [sum({{ optf('bk_amt') }})][1] AS bk,
             [sum({{ optf('bkv_amt') }})][1] AS bv
      FROM prod_proteus.teampulse_hub_series, pmc
      WHERE report_month BETWEEN toStartOfYear(mc) AND mc AND {{ cond() }}
      GROUP BY pu, report_month
    )
    GROUP BY pu
  ),
  pvt AS (
    SELECT [ifNull(node_rk, '')][1] AS tu, [sum(toFloat64(vac_ttf_cnt))][1] AS t_n,
           [quantilesExactWeighted(0.5, 0.500001)(toFloat64(ttf_d), toUInt64(round(toFloat64(vac_ttf_cnt))))][1] AS mq,
           (mq[1] + mq[2]) / 2 AS v_tf
    FROM prod_proteus.teampulse_hub_vacancy, pmc
    WHERE [report_month BETWEEN toStartOfYear(mc) AND mc AND ttf_d IS NOT NULL AND ifNull(vac_ttf_cnt, 0) > 0][1]
    GROUP BY tu
  ),
  pai AS (
    SELECT [ifNull(node_rk, '')][1] AS pu, [sum(toFloat64(ifNull(ai_heads, 0)))][1] AS ah,
           [sum(toFloat64(ifNull(ai_wau, 0))) * 100 / nullIf(ah, 0)][1] AS v_ai
    FROM prod_proteus.teampulse_hub_aiw
    WHERE week = (SELECT max(week) FROM prod_proteus.teampulse_hub_aiw
                  WHERE [addDays(toDate(assumeNotNull(week)), 6) <= ifNull(toDateOrNull(substring(cxdd, 1, 10)), today() - 1)][1])
    GROUP BY pu
  ),
  {#- поставка 122 (критик на 49 человек: подразделение входило в свою же базу вместе с предками и потомками — граница
      четверти была его же значением, «хуже базы» решало округление): из распределения исключены выбранный юнит, его
      предки (узлы из его пути) и потомки (узлы, в пути которых он есть). У всей компании так исключается всё — базы нет,
      как и должно быть: с собой не сравниваем #}
  plin AS (
    SELECT [ifNull(unit_rk, '')][1] AS xu FROM prod_proteus.teampulse_hub_unit
    WHERE [has(splitByChar('|', ifNull(path_rk, '')), cxs) OR has(splitByChar('|', ifNull((SELECT any(path_rk) FROM prod_proteus.teampulse_hub_unit WHERE unit_rk = cxs), '')), ifNull(unit_rk, ''))][1]
  ),
  peer AS (
    SELECT arrayStringConcat(arraySort(groupArray(concat(k, '\t', toString(b), '\t', toString(n), '\t',
             arrayStringConcat(arrayMap(q -> toString(round(q, 2)), qs), '\t')))), '\n') AS pj
    FROM (
      SELECT kv.1 AS k, multiIf(hb >= 1000, 4, hb >= 300, 3, hb >= 100, 2, 1) AS b, count() AS n,
             quantilesExact(0.25, 0.5, 0.75)(kv.2) AS qs
      FROM (
        SELECT hc9 AS hb, arrayJoin([('turnover_y', v_ty), ('turnover_m', v_tm), ('underwork', v_uw), ('overwork', v_ow),
                                     ('office_att', v_oa), ('tgrowth_conv', v_tc), ('booking_viol', v_bv),
                                     ('time_to_fill', if(t_n >= 3, v_tf, nan))]) AS kv
        FROM pnv LEFT JOIN pvt ON tu = pu WHERE hc9 >= 30 AND pu NOT IN (SELECT xu FROM plin)
        UNION ALL
        SELECT ah AS hb, ('ai_penetration', v_ai) AS kv FROM pai WHERE [ah >= 30][1] AND pu NOT IN (SELECT xu FROM plin)
      )
      WHERE isFinite(kv.2)
      GROUP BY k, b
    )
  ),
  {% endif %}
  {% if P_CORE or P_DICT or P_PPL %}
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, splitByChar('|', ifNull(path_rk, '')) AS ph,
           ifNull(toString(head_login), '') AS hd,
           replaceAll(replaceAll(ifNull(toString(head_nm), ''), char(9), ' '), char(10), ' ') AS hn
    FROM prod_proteus.teampulse_hub_unit
  ),
  {% endif %}
  {#- Численность последнего месяца по значениям фильтров (ряды узла — уже вся ветка); fv — порядок значений,
      по которому кодируется сочетание (в meta — fdv) #}
  {% if P_CORE or P_DICT %}
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, {{ AC }} AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
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
  {% endif %}
  {% if P_DICT %}
  fdr AS (
    SELECT u7 AS fr,
           arrayStringConcat(arraySort(groupArray(concat(toString(toUInt32(
             (((indexOf(tupleElement({{ FV }}, 1), v7a) - 1) * length(tupleElement({{ FV }}, 2)) + indexOf(tupleElement({{ FV }}, 2), v7b) - 1)
              * length(tupleElement({{ FV }}, 3)) + indexOf(tupleElement({{ FV }}, 3), v7c) - 1)
             * length(tupleElement({{ FV }}, 4)) + indexOf(tupleElement({{ FV }}, 4), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  {% endif %}
  {#- Поставка 109 (скорость разбора в Proteus): JSON строки meta — здесь, а не в последнем SELECT. reindent sqlparse для
      каждой скобки заново проходит текст от начала запроса: скобки в конце текста — самые дорогие #}
  {% if P_CORE %}
  mj AS (
    SELECT concat('{"lm":"', toString(cxlm), '","m0":"', toString(cxm0),
             '","n":', toString(cxn), ',"today":"', toString(today()),
             '","root":"', cxr, '","scope":"', cxs,
             '","def":"', cxd, '","ok":', toString(toUInt8(cxok)),
             ',"full":', toString(toUInt8(cxfl)), ',"zone":', toJSONString(cxzr),
             ',"dt":"', cxdd, '","schema":"hub-2","enc":"a1","cuts":["paint","it","staff"', if(has(tupleElement({{ FV }}, 4), '∅'), '', ',"act"'), ']',
             ',"mk":"{% for m in M %}{{ m[0] }}{% if not loop.last %},{% endif %}{% endfor %}"',
             ',"req":', toJSONString({{ qa(unit_req) }}),
             ',"paint":', toJSONString({{ qa(F['paint']) }}),
             ',"it":', toJSONString({{ qa(F['it']) }}),
             ',"staff":', toJSONString({{ qa(F['staff']) }}),
             ',"act":', toJSONString({{ qa(F['act']) }}),
             ',"act_def":', toJSONString({{ qa(ACT_DEF) }}),
             ',"vals":', {{ VALS }},
             ',"fdv":{"paint":', toJSONString(tupleElement({{ FV }}, 1)), ',"it":', toJSONString(tupleElement({{ FV }}, 2)),
             ',"staff":', toJSONString(tupleElement({{ FV }}, 3)),
             ',"act":', toJSONString(if(has(tupleElement({{ FV }}, 4), '∅'), CAST([], 'Array(String)'), tupleElement({{ FV }}, 4))), '}}') AS mj0
  ),
  {#- Метрики узлов ответа под фильтрами: узел × месяц × массив метрик (по строке от каждой таблицы); нулевые
      строки — все месяцы каждого узла: ряд узла без людей и месяцы без строк — нули #}
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('s') }} AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN {{ PK }} AND {{ GRID }} AND {{ cond() }}
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('t') }} AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN {{ PK }} AND {{ GRID }} AND {{ cond() }}
      GROUP BY u2, i2
      UNION ALL
      {#- поставка 64: din / dout — переводы «напрямую в юните» (узел юнит:d ноутбука) в строку юнита #}
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, {{ IDX }} AS i2, {{ vec('d') }} AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk IN {{ PKD }} AND {{ GRID }} AND {{ cond() }}
      GROUP BY u2, i2
      UNION ALL
      {#- 31.10-б, п. 6; файл 6, п. 4: одобренные и отклонённые заявки «Роста» по численности HQ — у каждого узла ответа #}
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('g') }} AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN {{ PK }} AND {{ GRID }} AND {{ cond_rh() }}
      GROUP BY u2, i2
      UNION ALL
      {#- поставка 69: нежелательные, желательные и ССЧ по активной численности HQ — у каждого узла ответа #}
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('h') }} AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk IN {{ PK }} AND {{ GRID }} AND {{ cond_hq() }}
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('v') }} AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE node_rk IN {{ PK }} AND {{ GRID }}
      GROUP BY u2, i2
      UNION ALL
      {#- поставка 105: замкнутый водопад юнита — строки юнитов teampulse_hub_flow (sp = '-'):
          fbeg / fhire / ffire / ftin / ftout / ffin; конец = начало + найм − отток + в − из по построению,
          при любых фильтрах срезов. Нули на все месяцы добавляет ветка cx ниже.
          06.11: комментарий закрыт без минуса перед решёткой — иначе Jinja съедал перенос и UNION ALL склеивался
          с SELECT (ALLSELECT) #}
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('w') }} AS a2
      FROM prod_proteus.teampulse_hub_flow
      WHERE node_rk IN {{ PK }} AND {{ GRID }} AND {{ cond() }} AND ifNull(sp_cd, '-') = '-'
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(cxpk), 1) AS u2, toInt32(arrayJoin(range(cxn))) AS i2, arrayWithConstant({{ M|length }}, toFloat64(0)) AS a2
    )
    GROUP BY u2, i2
  ),
  {#- Узел: ряды метрик (метрика × месяц) и lv5 — есть ли численность, найм, увольнения или переводы. Месяцы —
      сортировкой, а не поиском в лямбде: лямбда копирует захваченный массив на каждом шаге (+0,8 с у компании) #}
  arr AS (
    SELECT rk, arrayMap(k -> arrayMap(g -> g[k], gr), range(1, {{ M|length + 1 }})) AS tr,
           arraySum(x -> x[{{ MI.hc }}] + x[{{ MI.hire }}] + x[{{ MI.fire }}] + x[{{ MI.tin }}] + x[{{ MI.tout }}], gr) AS lv5
    FROM (
      SELECT u2 AS rk, arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i2, s2)))), 1, any(nn)) AS gr
      FROM (SELECT u2, i2, s2, cxn AS nn FROM mm)
      GROUP BY u2
    )
  ),
  {#- Поставка 65: ряды выбранного юнита под «HQ + Активная» — светофор HQ; нулевые строки — все месяцы #}
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT {{ IDX }} AS i6, {{ vec('s', ['hc', 'act', 'avg', 'fire', 'reg', 'nreg']) }} AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE node_rk = cxs AND {{ GRID }} AND {{ cond_hq() }}
      GROUP BY i6
      UNION ALL
      {#- 09.11: найм строки HQ — те же события дня найма (HI); тип численности у строки HQ выбран всегда («Активная») #}
      {%- set HIQ = hi_e(true) %}
      SELECT {{ IDX }} AS i6, arrayMap(x -> ifNull(x, 0), [{% for m in M %}{{ ('sum(' ~ HIQ ~ ')') if m[0] == 'hire' else '0' }}{% if not loop.last %}, {% endif %}{% endfor %}]) AS a6
      FROM prod_proteus.teampulse_hub_trf
      WHERE node_rk = cxs AND {{ GRID }} AND {{ cond_hq() }}
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(cxn))) AS i6, arrayWithConstant({{ M|length }}, toFloat64(0)) AS a6
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, {{ M|length + 1 }})) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, cxn AS nh FROM mh)
    )
  ),
  {% endif %}
  {#- Поставка 103: профили численности последнего месяца (teampulse_hub_prof) — точные пересечения разрезов. Строка
      ноутбука — нижний юнит человека; здесь — узел ответа: ближайший к нему узел из ответа по пути (у подразделений
      третьего уровня — всё поддерево, у остальных узлов — люди «напрямую»). Только внутри выбранного юнита, под всеми
      фильтрами. Больше PF_MAX строк — профилей нет (отчёт режет срез оценкой, как раньше) #}
  {%- set PF_MAX = 40000 %}
  {% if P_PPL %}
  pfr AS (
    SELECT u.mp AS u3, 'pf' AS k3, ifNull(p.pf, '') AS v3, sum(toFloat64(ifNull(p.cnt, 0))) AS n4
    FROM prod_proteus.teampulse_hub_prof AS p
    INNER JOIN (SELECT id, arrayLast(x -> has(arrayMap(y -> y.1, cxpk), x), ph) AS mp
                FROM st2 WHERE has(ph, cxs)) AS u ON u.id = ifNull(p.node_rk, '')
    WHERE {{ cond() }} AND u.mp != ''
    GROUP BY u3, v3
    HAVING n4 > 0
  ),
  {% endif %}
  {#- Разрезы узлов ответа под фильтрами: «ключ \t значение \t число» через \n, отсортировано. Поставка 113-з (ответ легче):
      ключ — только у первой строки своего ключа, у следующих пусто (чарт берёт ключ прошлой строки). 07.11, бой: первая версия
      брала ls[i - 1] в лямбде arrayMap — лямбда копирует захваченный массив на каждом шаге, у узла с десятками тысяч строк это
      квадрат по памяти (Code 241, 10 ГиБ). Теперь без лямбды: блок ключа «ключ» + строки «\t значение \t число», блоки — через \n #}
  {% if P_MX %}
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(kb)), '\n') AS mxs
    FROM
    (
    SELECT u3, concat(k3, arrayStringConcat(arraySort(groupArray(concat('\t', v3, '\t', toString(round(n4, 1))))), '\n')) AS kb
    FROM
    (
      {% if P_PPL %}{{ ua(U1) }}
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      {#- 31.10-б, п. 6; файл 6, п. 4: разрезы «Роста» (rm rq rs) — по численности HQ (cond_rh), остальные — под все фильтры #}
      WHERE node_rk IN {{ PK }}
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND {{ cond() }} OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND {{ cond_rh() }})
        {#- поставка 66: календарь посещений по дням, 26.10-б: увольнения по инициатору и месяцу — только у выбранного юнита #}
        {#- поставка 71: T-рост (rm, rq, rs) был только у выбранного юнита; файл 6, п. 3 и 6 — у каждого узла: выбор строки
            таблицы подразделений фильтрует все блоки вкладки «Рост HQ». Поставка 100 (ревью): так же уходы по инициатору (xim),
            движение по специализациям (tsh tsi tso sp0 sp1); только у юнита — календарь (dw do) и возраст по разрезам (es en:
            ~2,5 КБ на узел; у подразделения средний возраст точный по e, срезы — оценкой от юнита) #}
        {#- поставка 136, п. 19: посещения и рабочие дни города по месяцам (ocm ocdm) — динамика посещаемости выбранного
            города: только у выбранного юнита. П. 17: календарь по дням (dw do) — ещё и у подразделений первого уровня
            (строки таблицы): клик по строке пересчитывает календарь и дни недели #}
        AND (ifNull(mx_key, '') NOT IN ('es', 'en', 'ocm', 'ocdm', 'dw', 'do') OR node_rk = cxs
             OR (ifNull(mx_key, '') IN ('dw', 'do') AND node_rk IN (SELECT id FROM st2 WHERE pid = cxs)))
        {#- поставка 109 (скорость): помесячные уходы по специализации xsm заменены замкнутым водопадом fsm (поставка 105) —
            в ответ не идут #}
        AND ifNull(mx_key, '') != 'xsm'
        {#- 09.11: разбивки найма — из переходов (ветка ниже); ключи найма таблицы разрезов ноутбука до 09.11 не читаем #}
        AND ifNull(mx_key, '') NOT IN ('hk', 'hch', 'hg', 'hsp', 'hko', 'hcho', 'hgo', 'hspo')
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      {% endif %}
      {% if P_FLOW %}{{ ua(U1) }}
      {#- 09.11 (владелец): найм с начала года по источнику (hk), каналу (hch: найм в компанию / из учебной группы в боевую /
          стажёр в штат), грейду (hg) и специализации (hsp) — те же события дня найма, что «Найм, чел» (HI): срез, грейд,
          источник и специализация — дня найма. В сумме по каждому разрезу — «Найм, чел» с начала года. Грейд и источник —
          колонки hg_cd / hs_cd переходов (ноутбук 09.11: сначала прогон ноутбука, потом датасет) #}
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, kv.2 AS v3, sum(hv) AS n4
      FROM
      (
        SELECT node_rk, {{ HI }} AS hv,
               [ifNull(toString(hs_cd), ''), if(trf_kind = 'h', 'Найм в компанию', if({{ CVK }} = 'c', 'Из учебной группы в боевую', 'Стажёр в штат')),
                ifNull(toString(hg_cd), ''), {{ SPC }}, ifNull(toString(hn_cd), '')] AS hx
        FROM prod_proteus.teampulse_hub_trf
        WHERE node_rk IN {{ PK }} AND report_month >= toStartOfYear(cxlm) AND {{ cond() }} AND trf_kind IN ('h', 'i')
      )
      {#- поставка 137, п. 4: hsn — сеньорность дня найма (колонка hn_cd переходов, ноутбук 137: сначала прогон, потом датасет) #}
      ARRAY JOIN arrayZip(['hk', 'hch', 'hg', 'hsp', 'hsn'], hx) AS kv
      WHERE hv > 0
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      {% endif %}
      {% if P_FLOW %}{{ ua(U1) }}
      {#- вакансии: открытые на конец последнего месяца по статусу (vs), причине (vr), специализации (vp),
          уровню позиции (vl); закрытые с начала года по каналу (vk) и уровню кандидата (vq). Поставка 106 (владелец): закрытые —
          с 1 января по дату данных, вместе с незакрытым месяцем (было январь..cm): итог сходится с мастер-отчётом #}
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = cxlm, toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               toFloat64(ifNull(vac_close_cnt, 0)) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN {{ PK }} AND report_month >= toStartOfYear(cxlm)
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      {% endif %}
      {% if P_FLOW %}{{ ua(U1) }}
      {#- 28.10, п. 1: найм, переводы в и из с начала года по специализации; поставка 106 (владелец): с 1 января по дату
          данных, вместе с незакрытым месяцем (было январь..cm); поставка 100 (ревью) — у каждого узла ответа #}
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, spx AS v3, sum(kv.2) AS n4
      FROM
      (
        {#- 09.11 (владелец: только флаги источника, их сумма): переводы по специализациям — флаги карточек «Переводы» (юнит
            уровня узла, атрибуты под фильтрами) и флаг смены специализации (SPI / SPU). Было: флаг юнита своего уровня
            (SI / SU) + «внутри юнита» (CI / CO) #}
        SELECT node_rk, {{ SPC }} AS spx, [{{ HI }}, {{ SPI }}, {{ SPU }}] AS tv
        FROM prod_proteus.teampulse_hub_trf
        WHERE node_rk IN {{ PK }} AND report_month >= toStartOfYear(cxlm) AND {{ cond() }}
      )
      {#- поставка 101: здесь же шла помесячная детализация tsm («вид|специализация|ГГГГ-ММ»); поставка 109 (скорость) — снята:
          её заменил замкнутый водопад fsm (поставка 105), чарт tsm не читает #}
      {#- поставка 109 (скорость разбора): ключ и число — arrayZip двух массивов, а не пять кортежей со скобками #}
      ARRAY JOIN arrayZip(['tsh', 'tsi', 'tso'], tv) AS kv
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      {% endif %}
      {% if P_FLOW %}{{ ua(U1) }}
      {#- 09.11: помесячные переводы по специализации у каждого узла ответа (tsm «i|специализация|ГГГГ-ММ», «o|…») — помесячная
          детализация «Движения по специализациям»: найм и отток там из fsm, переводы — отсюда, тем же правилом #}
      SELECT ifNull(node_rk, '') AS u3, 'tsm' AS k3, concat(kv.1, '|', spx, '|', mo) AS v3, sum(kv.2) AS n4
      FROM
      (
        SELECT node_rk, {{ SPC }} AS spx, formatDateTime(report_month, '%Y-%m') AS mo, [{{ SPI }}, {{ SPU }}] AS tv
        FROM prod_proteus.teampulse_hub_trf
        WHERE node_rk IN {{ PK }} AND report_month >= toStartOfYear(cxlm) AND {{ cond() }}
      )
      ARRAY JOIN arrayZip(['i', 'o'], tv) AS kv
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      {% endif %}
      {% if P_FLOW %}{{ ua(U1) }}
      {#- поставка 105: движение по специализациям — замкнутый водопад строки специализации, помесячно:
          «вид|специализация|ГГГГ-ММ», виды b начало, h найм, f отток, i переводы в, o переводы из, e конец;
          e = b + h − f + i − o по построению (принадлежность — последняя строка человека в месяце; перевод —
          любое изменение строки: смена специализации, юнита, типа численности). «Внутри юнита» отдельно нет:
          перемещение внутри узла — «o» для старой строки и «i» для новой. Заменяет tsm/ci/co в отчёте;
          tsi/tso/tsh (переводы по флагам, сверенные с мастер-эталонами) остаются для вкладки «Переводы».
          Поставка 109 (скорость): чарт берёт fsm только с января года последнего месяца по последний месяц — начало (b)
          января, конец (e) последнего месяца, события h f i o помесячно; остальная сетка не отдаётся (было ~56% ответа) #}
      {#- поставка 113-ж (ответ легче): строка на специализацию «*специализация|ГГГГ|события» — событие «вид ММ:число» через
          запятую, вид цифрой (1 b, 2 h, 3 f, 4 i, 5 o, 6 e); чарт разворачивает в прежние «вид|специализация|ГГГГ-ММ» #}
      SELECT u3, 'fsm' AS k3, concat('*', spx, '|', yr, '|', arrayStringConcat(arraySort(groupArray(ev)), ',')) AS v3, toFloat64(1) AS n4
      FROM
      (
      SELECT ifNull(node_rk, '') AS u3, spx, yr, concat(toString(kv.1), mo, ':', toString(round(sum(kv.2), 1))) AS ev
      FROM
      (
        {#- поставка 109 (скорость разбора): числа без ifNull — NULL в сумме не считается, как и 0 #}
        SELECT node_rk, ifNull(sp_cd, '-') AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               [toFloat64(beg_cnt) * (report_month = toStartOfYear(cxlm)), toFloat64(0), toFloat64(fire_cnt),
                toFloat64(tin_cnt) * toFloat64({{ FLWS }}), toFloat64(tout_cnt) * toFloat64({{ FLWS }}),
                toFloat64(fin_cnt) * (report_month = cxlm)] AS vv
        FROM prod_proteus.teampulse_hub_flow
        WHERE node_rk IN {{ PK }} AND {{ GRID }} AND report_month >= toStartOfYear(cxlm)
          AND {{ cond() }} AND ifNull(sp_cd, '-') <> '-'
        UNION ALL
        {#- 09.11: найм строки специализации — события дня найма (HI), специализация дня найма #}
        SELECT node_rk, {{ SPC }} AS spx, formatDateTime(report_month, '%Y') AS yr, formatDateTime(report_month, '%m') AS mo,
               [toFloat64(0), {{ HI }}, toFloat64(0), toFloat64(0), toFloat64(0), toFloat64(0)] AS vv
        FROM prod_proteus.teampulse_hub_trf
        WHERE node_rk IN {{ PK }} AND {{ GRID }} AND report_month >= toStartOfYear(cxlm)
          AND {{ cond() }} AND trf_kind IN ('h', 'i')
      )
      ARRAY JOIN arrayZip([1, 2, 3, 4, 5, 6], vv) AS kv
      GROUP BY u3, spx, yr, mo, kv.1
      HAVING sum(kv.2) > 0
      )
      GROUP BY u3, spx, yr
      {% endif %}
      {% if P_AUX %}{{ ua(U1) }}
      {#- поставка 106: AI по неделям — у каждого узла ответа последние 16 недель источника (105 дней от последней недели;
          последняя неделя может быть неполной): «ГГГГ-ММ-ДД|WAU,численность,%». Численность — без стажёров, человек
          в узле один раз за неделю (ноутбук). Фильтры среза на AI не действуют — условия cond здесь нет #}
      SELECT u8 AS u3, 'aw' AS k3, concat(toString(w8), '|', arrayStringConcat(arrayMap(x -> toString(round(x, 2)), a8), ',')) AS v3,
             toFloat64(1) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u8, toDate(assumeNotNull(week)) AS w8,
               [sum(toFloat64(ifNull(ai_wau, 0))), sum(toFloat64(ifNull(ai_heads, 0))),
                sum(toFloat64(ifNull(ai_wau, 0))) * 100.0 / nullIf(sum(toFloat64(ifNull(ai_heads, 0))), 0)] AS a8
        FROM prod_proteus.teampulse_hub_aiw
        WHERE node_rk IN {{ PK }}
          AND week >= (SELECT addDays(max(week), -105) FROM prod_proteus.teampulse_hub_aiw)
        GROUP BY u8, w8
      )
      WHERE a8[2] > 0
      {% endif %}
      {% if P_AUX %}{{ ua(U1) }}
      {#- поставка 106: «Кто пользуется?» и «Как пользуется?» — разрезы последней полной недели (teampulse_hub_aix ноутбука:
          стажёры aih aiu ait aif, покраска и инструменты aph apt, инструменты aut, дни в неделю auf, инструментов на человека
          aun, сообщения aum auc auk, неделя aik) — у каждого узла ответа, без cond: срезы на AI не действуют. Поставка 113-б:
          сочетания разрезов aip (кросс-фильтр «Кто пользуется») — только у выбранного юнита: у всех узлов ответ вырос бы #}
      SELECT ifNull(node_rk, '') AS u3, ifNull(k, '') AS k3, ifNull(v, '') AS v3, toFloat64(ifNull(n, 0)) AS n4
      FROM prod_proteus.teampulse_hub_aix
      WHERE node_rk IN {{ PK }} AND ifNull(n, 0) > 0 AND (ifNull(k, '') != 'aip' OR node_rk = cxs)
      {% endif %}
      {% if P_FLOW %}{{ ua(U1) }}
      {#- поставка 103 (файл 9, п. 4): срок закрытия — медиана по вакансиям. vt — распределение сроков закрытых вакансий
          «ГГГГ-ММ|дней» → вакансий за всю сетку, у каждого узла ответа (ttf_d — срок вакансии без холда, ноутбук 2_11;
          матчером: таблица до поставки 103 колонки не знает — разреза нет, срок — средний, как раньше) #}
      SELECT u9 AS u3, 'vt' AS k3, concat(formatDateTime(rm9, '%Y-%m'), '|', toString(toInt64(td9))) AS v3, sum(n9) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u9, toDate(assumeNotNull(report_month)) AS rm9,
               CAST(ttf_d, 'Nullable(Float64)') AS td9,
               toFloat64(ifNull(vac_ttf_cnt, 0)) AS n9
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE node_rk IN {{ PK }} AND {{ GRID }}
      )
      WHERE td9 IS NOT NULL
      GROUP BY u3, v3
      HAVING n4 > 0
      {% endif %}
      {% if P_PPL %}{{ ua(U1) }}
      {#- поставка 103: профили (pf) и их словарь (pfd «разрез¦значение» → номер + 1) — у корня (строка base) #}
      SELECT u3, k3, v3, n4 FROM pfr WHERE (SELECT count() FROM pfr) <= {{ PF_MAX }}
      {% endif %}
      {% if P_PPL %}{{ ua(U1) }}
      SELECT cxr AS u3, 'pfd' AS k3, concat(ifNull(k, ''), '¦', ifNull(v, '')) AS v3, toFloat64(ifNull(i, 0) + 1) AS n4
      FROM prod_proteus.teampulse_hub_pfd
      WHERE (SELECT count() FROM pfr) BETWEEN 1 AND {{ PF_MAX }}
      {% endif %}
    )
    GROUP BY u3, k3
    )
    GROUP BY u3
  )
  {% else %}
  zz AS (SELECT 1 AS z1)
  {% endif %}
{#- поставка 111: ответ легче — Proteus пишет каждую русскую букву в JSON как \u04xx (6 знаков). Текстовые колонки
    nm, j, mx (кроме j строки meta) — кириллица одним ASCII-знаком: латиница и знаки !#$%&*+;<=>?@_^ — с префиксом ^,
    затем 66 букв (а–я, ё, А–Я, Ё) → a–z, A–Z, !#$%&*+;<=>?@_ (translateUTF8). Чарт расшифровывает по meta.enc = 'a1'.
    Числа и порядок строк не меняются. #}
SELECT o, role, id, pid, lvl, translateUTF8(replaceRegexpAll(nm_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS nm, kids,
       if(role = 'meta'{% if not P_ALL %} OR role = 'part'{% endif %}, j_, translateUTF8(replaceRegexpAll(j_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_')) AS j, ms, translateUTF8(replaceRegexpAll(mx_, '([A-Za-z!#$%&*+;<=>?@_^])', '^\\1'), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=>?@_') AS mx, nm_
FROM
(
  {% if not P_ALL %}
  {#- строка части: какая часть и эхо запроса — юнит из unit_f (req), применённый юнит (scope), применённые фильтры; у главного
      чарта по эху сводятся части одного выбора. bt — отметка сборки данных (built_at ноутбука): части кэшируются в Proteus
      порознь, и после обновления таблиц одна может прийти из старого кэша — части с разной отметкой главный чарт не сводит,
      а перезапрашивает. Не кодируется (как meta) #}
  {{ ua(U2) }}
  SELECT toUInt8(0) AS o, 'part' AS role, '{{ PART }}' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         concat('{"v":1,"p":"{{ PART }}","ok":', toString(toUInt8(cxok)), ',"scope":"', cxs, '","def":"', cxd,
                '","req":', toJSONString({{ qa(unit_req) }}),
                ',"paint":', toJSONString({{ qa(F['paint']) }}), ',"it":', toJSONString({{ qa(F['it']) }}),
                ',"staff":', toJSONString({{ qa(F['staff']) }}), ',"act":', toJSONString({{ qa(F['act']) }}),
                ',"bt":"', (SELECT toString(any(built_at)) FROM prod_proteus.teampulse_hub_meta), '"}') AS j_,
         '' AS ms, '' AS mx_
  {% endif %}
  {% if P_CORE %}
  {{ ua(U2) }}
  SELECT toUInt8(0) AS o, 'meta' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT mj0 FROM mj) AS j_,
         '' AS ms, '' AS mx_

  {{ ua(U2) }}

  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         s.id AS id, s.pid AS pid, s.lv AS lvl, s.nm0 AS nm_, s.kd AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), a.tr), ';') AS ms,
         {% if P_MX %}ifNull(x.mxs, ''){% else %}''{% endif %} AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN st2 AS s ON s.id = p.pn
  INNER JOIN arr AS a ON a.rk = p.pn
  {% if P_MX %}LEFT JOIN mxr AS x ON x.mu = p.pn{% endif %}
  WHERE p.po <= 2 OR a.lv5 > 0

  {{ ua(U2) }}

  {#- поставка 65: светофор HQ — выбранный юнит под «HQ + Активная» #}
  SELECT toUInt8(4) AS o, 'hq' AS role, cxs AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx_
  FROM arh AS h
  WHERE cxok
  {% endif %}
  {% if P_MX and not P_CORE %}
  {#- часть с разрезами: только узлы ответа, у которых разрезы есть; имена, уровни и ряды — в части core #}
  {{ ua(U2) }}
  SELECT p.po AS o, multiIf(p.po = 1, 'scope', p.po = 2, 'base', p.po = 5, 'c', p.po = 6, 'g', 'x') AS role,
         p.pn AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids, '' AS j_, '' AS ms, x.mxs AS mx_
  FROM (SELECT tupleElement(pe, 1) AS pn, tupleElement(pe, 2) AS po FROM (SELECT arrayJoin(cxpk) AS pe)) AS p
  INNER JOIN mxr AS x ON x.mu = p.pn
  {% endif %}
  {% if P_DICT %}
  {{ ua(U2) }}

  {#- поставка 69: справочник — зона логина и предки корней зоны (у предков — только имя: путь над отчётом) #}
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j_,
         '' AS ms, '' AS mx_
  FROM (SELECT *, hasAny(ph, cxzr) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE cxok AND (t.iz OR has(cxan, t.id))
  {% endif %}
  {% if P_AUX %}
  {{ ua(U2) }}

  {#- поставка 113: распределение метрик по подразделениям того же размера под фильтрами (CTE peer) #}
  SELECT toUInt8(8) AS o, 'peer' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         (SELECT pj FROM peer) AS j_, '' AS ms, '' AS mx_
  WHERE cxok
  {% endif %}

  {{ ua(U2) }}

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm_, toUInt32(0) AS kids,
         '' AS j_, '' AS ms, '' AS mx_
)
)
ORDER BY o, lvl, nm_, id

{#- ============================================================================
    teampulse_hub — датасет чарта TeamPulse Hub на таблицах ноутбука сборки
    («1. Helicopter — ноут TeamPulse Hub.yaml»). Замена файла 2, когда ноутбук запущен и
    таблицы prod_proteus.teampulse_hub_* выгружены.

    Всё посчитано в ноутбуке, датасет только выбирает и складывает:
      teampulse_hub_meta    календарь отчёта, корень, юнит по умолчанию (1 строка)
      teampulse_hub_unit    узлы нынешней структуры: родитель, уровень, имя, подразделения, путь
      teampulse_hub_series  узел × месяц × срез: ряды по всему поддереву узла, ССЧ
      teampulse_hub_mix     узел × срез × разрез × значение: численность и увольнения по разрезам
      teampulse_hub_trf     переводы как в мастер-отчёте: узел × месяц × в / из / найм × срез дня × флаги —
                            переводы считаются под выбранные фильтры (с поставки 59)
      teampulse_hub_vacancy вакансии: узел × месяц × разрезы вакансии; фильтры среза на них не действуют
      teampulse_hub_ai      AI-инструменты: узел × месяц — WAU, проникновение; фильтры среза не действуют
    Таблиц trf, vacancy, ai нет (ноутбук до поставок 49 и 50) — датасет падает: сначала ноутбук.

    Поставка 53 (21.10) — скорость. Замер боя (файлы 8, 8б): запрос ждал 7–12 с, и почти всё — не чтение
    таблиц, а разбор длинного текста в Proteus и план ClickHouse. Поэтому:
      - метрики — одной колонкой ms вместо 26 колонок m_*: текст в 3 раза короче, обёртка Proteus
        группирует 9 колонок вместо 34;
      - календарь, выбранный юнит и узлы ответа — один скаляр cx0 (гайд CH-06), а не цепочка CTE,
        которую ClickHouse 24.8 разворачивал заново в каждой из восьми ссылок (73 чтения в плане);
      - фильтры — «lowerUTF8(колонка) IN (…)» по константе, без лямбды на строку (CH-20).
    Ответ тот же, кроме упаковки метрик (стенд: строки, справочник и разрезы совпали с прежним 2а).
    Чарт читает оба вида ответа (файл 3 с поставки 53).

    Строки различаются колонкой role, порядок задан ORDER BY:
      meta   1 строка, j — JSON: lm, m0, n, сегодня, корень, выбранный юнит, юнит по умолчанию,
             фильтры (cuts), эхо применённых фильтров, значения фильтров с численностью компании,
             словари распределения fdv, mk — порядок метрик в ms
      scope  выбранный юнит          base  вся компания под теми же фильтрами
      hq     выбранный юнит под «HQ + Активная» (поставка 65, светофор «Как уходит HQ?»): покраска HQ и тип
             «Активная» вместо выбранных, IT-код и штат — как выбраны; ряды только из teampulse_hub_series
      dict   1 строка, j — все узлы: «id \t pid \t уровень \t детей \t имя \t логин руководителя \t fd \t имя
             руководителя» через \n (имя — с поставки 66; окно настройки ищет и по нему). fd — численность узла в последнем месяце по сочетаниям значений фильтров без учёта
             применённых: «код:число» через пробел, код = ((номер покраски × число IT + номер IT) ×
             число значений штата + номер штата) × число типов численности + номер типа (номера —
             в meta.fdv). Окно настройки считает по нему «сколько людей попадёт в выбор» без запроса
      c / g / x  подразделения на один, два, три уровня ниже выбранного
      end    маркер «ответ целиком»
    ms — метрики узла в порядке meta.mk через «;», у каждой — месяцы от января прошлого года до
    последнего через запятую. mx — разрезы «ключ \t значение \t число» через \n.
    Метрики: hc act avg hire fire reg nreg tin tout — численность, активная, ССЧ, найм, увольнения,
    regrettable, non-regrettable, переводы в выбор и из выбора; pnor plow phig pgry — мониторинг;
    wday ovis — человеко-дни и посещения офиса; gapr gdec — T-рост; vop vcl vap vtd vtn vjn — вакансии
    (открыто на конец месяца, закрыто, новые, дни и число закрытых, закрыто джунами); aiw aip aic — AI.
    hit — найм по дню события; din dout — переводы в и из «напрямую в юните» (люди в самом юните, без его
    подразделений; поставка 64): у мастер-отчёта это свой узел, «юнит минус подразделения» для переводов не верен.
    hcd hst — найм по видам (поставка 65): из учебной группы в боевую и стажёр в штат — части hit; найм в компанию =
    hit − hcd − hst. Колонка cv_k переходов — матчером: таблица ноутбука до 65 её не знает — обе нули.
    Поставка 66 (посещения Адели): bk bkv vsv — дней с бронью, бронь без посещения, посещение без брони; hwd hov —
    рабочие дни и посещения руководителей. Колонки рядов — матчером: таблица ноутбука до 66 их не знает — нули.
    В mx — разрезы ноутбука и вакансии (vs vr vp vl — открытые последнего месяца, vk vq — закрытые с
    начала года). Поставка 66: mh — численность руководителей (1) и остальных; oc ocp — посещения и люди по городу
    офиса за месяц; dw do — календарь посещений по дням, только у выбранного юнита.
    Поставка 90: «с начала года» — с января по последний закрытый месяц (cm в cx: последний месяц, если дата данных —
    его последний день или он январь, иначе месяц перед ним), без неполного текущего: в ноутбуке (cm в
    teampulse_hub_cal) — увольнения и найм по разрезам, «Рост», города офиса; здесь — vk vq и tsh tsi tso.
    26.10-б: xim — увольнения по инициатору и месяцу («инициатор|ГГГГ-ММ»), тоже только у выбранного юнита.
    28.10, п. 1: tsh tsi tso — найм (как hit), переводы в и из (как tin / tout) с начала года по специализации строки
    перехода (sp_cd), только у выбранного юнита. Колонка sp_cd — матчером: таблица ноутбука до 28.10 её не знает — разрезов
    нет, отчёт показывает движение по специализациям без переводов. 31.10, п. 10: tsi tso — по флагам смены специализации
    источника (fsp); п. 7: sp0 — численность по специализации на начало года, тоже только у выбранного юнита; поставка 90:
    sp1 — на конец последнего закрытого месяца, тоже только у выбранного юнита.
    31.10-б, п. 1: es en — сумма возрастов и людей с возрастом по «разрез|значение» (средний возраст категории), тоже только
    у выбранного юнита.
    Поставка 69 (27.10, ответы Антона):
      - rh nrh avh — нежелательные и желательные увольнения и ССЧ по активной численности HQ (покраска HQ и тип
        «Активная» вместо выбранных, IT-код и штат — как выбраны) у каждого узла ответа и у базы: эти две текучести
        всегда считаются по HQ (вопрос 4); файл 6, п. 2: fh — увольнения, hch — численность там же, у каждого узла: «Как уходит HQ»
        считается по выбранной строке таблицы подразделений, а не только по строке hq;
      - доступ по зоне видимости, как в TeamPulse (вопрос 10): логины из FULL видят всю компанию; остальные — свою
        ветку вниз: подразделения, где логин — руководитель (teampulse_hub_unit.head_login), и всё под ними. Выбрать
        подразделение выше зоны нельзя — запрос откатывается на зону. Справочник dict — зона и предки её корней (у
        предков без численности — только для пути). База для сравнения (base) и значения фильтров — общие, как в
        TeamPulse. Логина без зоны — только meta с ok 0 («нет доступа»). Логин — в ключе кэша (вызов в {{ }});
      - детализации переводов (поставка 63) больше нет: была нужна для сверки (вопрос 6).

    Фильтры — кросс-фильтры чарта: unit_f — ключ узла, paint_f — покраска (HQ, Line, Support),
    it_f — IT-код (IT, Digital, NonIT), staff_f — «Штат» / «Не штат», act_f — типы численности
    (active_type_nm, любой набор, с поставки 60): без фильтра — «Активная», без подрядчиков (поставка 61;
    meta.act_def), «Вся» — все строки. Сравнение без учёта регистра (чарт шлёт «Hq»).
    act_cd, hco_cnt, nreg_cnt, head_login, data_dt читаются матчером: таблицы старого ноутбука их не
    знают — отчёт работает без них. Колонки-носители в SELECT не выводятся. id узла — ключ юнита.
    Проверено на ClickHouse 24.8: стенд по людям и дням (stand/nb_tp20.py --hub), шесть настроек
    сервера, ответ сверен с правдой по людям и с прежним 2а; масштаб боя — stand/hub_scale.py.
============================================================================ -#}
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
    запятую, например: {% set FULL = ['ivanov', 'petrova'] %}. Пустой список — полного доступа нет ни у кого. -#}
{% set FULL = [] %}
{#- логин входит в ключ кэша: Proteus ищет вызов current_username() внутри {{ }} на одной строке -#}
{% macro me() -%}{{ qs((current_username() or '')|string|trim|lower) }}{%- endmacro %}
{#- Тип численности строки: act_cd матчером; колонки нет — «∅» (строка проходит любой фильтр типа). -#}
{% set AC = "ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^act_cd$') APPLY(toString)], CAST(['∅'], 'Array(Nullable(String))')), 1), '∅')" %}
{% set CUTS = [['paint', 'paint_f', "ifNull(paint_cd, '-')"], ['it', 'it_f', "ifNull(it_cd, '-')"], ['staff', 'staff_f', "ifNull(staff_cd, '-')"], ['act', 'act_f', AC]] %}
{% set F = {} %}
{% for c in CUTS %}{% set vals = [] %}{% for v in (filter_values(c[1]) or []) %}{% if v|string != '' and vals|length < 20 %}{% set _ = vals.append(v|string) %}{% endif %}{% endfor %}{% set _ = F.update({c[0]: vals}) %}{% endfor %}
{#- Тип численности (поставка 60): любой набор типов active_type_nm; не выбран — ACT_DEF: «Активная», без
    подрядчиков (поставка 61; подрядчиков добавляют в фильтре); «Вся» — без фильтра. act_on — выбран хоть один тип. -#}
{% set ACT_DEF = ['Активная'] %}
{% set av = [] %}{% for v in F['act'] %}{% set _ = av.append(v|lower) %}{% endfor %}
{% if 'вся' in av or 'all' in av %}{% set _ = F.update({'act': []}) %}{% elif av|length == 0 %}{% set _ = F.update({'act': ACT_DEF}) %}{% endif %}
{% set act_on = F['act']|length > 0 %}
{#- Найм: при выборе типов — по методологии HR (hire_cnt), на всей — найм в компанию с любым типом (hco_cnt;
    нет колонки — hire_cnt). Обычные (non-regrettable) увольнения — матчером: нет колонки — ноль. -#}
{% set NREG = "ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^nreg_cnt$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0)" %}
{% set HCO = "ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^hco_cnt$') APPLY(toFloat64)], [toFloat64(hire_cnt)]), 1), 0)" %}
{#- Строка проходит фильтры: значение в выбранном списке без учёта регистра; не выбран — 1. -#}
{% macro cond() -%}
{%- set parts = [] -%}
{%- for c in CUTS -%}{%- if F[c[0]]|length > 0 -%}{%- set hv = 'lowerUTF8(' ~ c[2] ~ ') IN ' ~ ql(F[c[0]]) -%}{%- set _ = parts.append(("(" ~ c[2] ~ " = '∅' OR " ~ hv ~ ")") if c[0] == 'act' else hv) -%}{%- endif -%}{%- endfor -%}
{{- parts|join(' AND ') if parts else '1' -}}
{%- endmacro %}
{#- 31.10-б, п. 6: «Рост HQ» — только HQ-заявки по смыслу данных, фильтр покраски его не меняет: условие без покраски
    (IT-код, штат, тип численности — как выбраны). По нему — ряды gah gdh (одобренные и отклонённые) и разрезы rm rq rs. -#}
{% macro cond_np() -%}
{%- set parts = [] -%}
{%- for c in CUTS -%}{%- if c[0] != 'paint' and F[c[0]]|length > 0 -%}{%- set hv = 'lowerUTF8(' ~ c[2] ~ ') IN ' ~ ql(F[c[0]]) -%}{%- set _ = parts.append(("(" ~ c[2] ~ " = '∅' OR " ~ hv ~ ")") if c[0] == 'act' else hv) -%}{%- endif -%}{%- endfor -%}
{{- parts|join(' AND ') if parts else '1' -}}
{%- endmacro %}
{#- Файл 6, п. 4: «Рост HQ» — только по численности HQ: покраска HQ вместо выбранной (фильтр покраски вкладку не меняет),
    IT-код, штат и тип численности — как выбраны. По нему — ряды gah gdh и разрезы rm rq rs (были — cond_np, без покраски:
    итог совпадал с «Все»). -#}
{% macro cond_rh() -%}
{{- "lowerUTF8(ifNull(paint_cd, '-')) IN ('hq') AND " ~ cond_np() -}}
{%- endmacro %}
{#- Поставка 65: строка hq — светофор «Как уходит HQ?» всегда по активной численности HQ: покраска HQ и тип «Активная»
    вместо выбранных в фильтрах, IT-код и штат — как выбраны. -#}
{% macro cond_hq() -%}
{%- set parts = ["lowerUTF8(ifNull(paint_cd, '-')) IN ('hq')", "(" ~ AC ~ " = '∅' OR lowerUTF8(" ~ AC ~ ") IN " ~ ql(ACT_DEF) ~ ")"] -%}
{%- for c in CUTS -%}{%- if c[0] in ('it', 'staff') and F[c[0]]|length > 0 -%}{%- set _ = parts.append('lowerUTF8(' ~ c[2] ~ ') IN ' ~ ql(F[c[0]])) -%}{%- endif -%}{%- endfor -%}
{{- parts|join(' AND ') -}}
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
{% set fl = ['ifNull(fu, 0) = 1'] %}{% for c in CUTS %}{% if F[c[0]]|length > 0 %}{% set _ = fl.append('ifNull(' ~ FK[c[0]] ~ ', 0) = 1') %}{% endif %}{% endfor %}
{% set FLG = '(' ~ fl|join(' OR ') ~ ')' %}
{% set TI = "toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND " ~ FLG ~ " AND ifNull(in_ok, 1) = 1)" %}
{% set HI = "toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'h'" ~ (" OR (ifNull(trf_kind, '') = 'i' AND " ~ FLG ~ " AND ifNull(in_ok, 1) = 0)" if act_on else "") ~ ")" %}
{% set TU = "toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND " ~ FLG ~ ")" %}
{#- Поставка 65: вид перехода в найм (cv_k: c — из учебной группы в боевую, s — стажёр в штат) — матчером. Найм по
    видам — те же переходы, что во второй части HI (только при выбранных типах численности). -#}
{% set CVK = "ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^cv_k$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '')" %}
{#- 28.10: специализация строки переходов (sp_cd) — матчером; нет колонки — пусто, строки отбрасываются. -#}
{% set SPC = "ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^sp_cd$') APPLY(toString)], CAST([''], 'Array(Nullable(String))')), 1), '')" %}
{#- 31.10, п. 10; поставка 90 (заказчик): переводы по специализациям — по флагам переводов под фильтры (TI / TU: вход в
    выбор и выход из него) ИЛИ по флагу смены специализации transfer_to / transfer_out_specialization_flg (fsp строки
    переходов, матчером) — смена специализации и внутри выбора тоже перевод; строка одна — перевод один. Тогда «на начало +
    найм + переводы в − отток − переводы из = на конец» сходится по каждой специализации и в ИТОГО. Таблица ноутбука до
    31.10 колонки fsp не знает (−1) — только переводы юнита. -#}
{% set FSP = "ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^fsp$') APPLY(toFloat64)], [toFloat64(-1)]), 1), -1)" %}
{% set SI = "toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND ((" ~ FLG ~ " AND ifNull(in_ok, 1) = 1) OR " ~ FSP ~ " = 1))" %}
{% set SU = "toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'o' AND (" ~ FLG ~ " OR " ~ FSP ~ " = 1))" %}
{#- Поставка 66: ряд таблицы series — матчером: таблица ноутбука до 66 колонки не знает — нули. -#}
{% macro optf(c) -%}ifNull(arrayElement(arrayConcat(CAST([], 'Array(Nullable(Float64))'), [COLUMNS('^{{ c }}$') APPLY(toFloat64)], [toFloat64(0)]), 1), 0){%- endmacro %}
{% macro hk(v) -%}
{%- if act_on -%}toFloat64(ifNull(trf_cnt, 0)) * toFloat64(ifNull(trf_kind, '') = 'i' AND {{ FLG }} AND ifNull(in_ok, 1) = 0 AND {{ CVK }} = '{{ v }}'){%- else -%}toFloat64(0){%- endif -%}
{%- endmacro %}
{#- Метрики: ключ, таблица (s — series, t — trf, v — vacancy, a — ai), выражение. Порядок — порядок в ms. -#}
{% set M = [['hc', 's', 'hc_cnt'], ['act', 's', 'act_cnt'], ['avg', 's', 'avg_cnt'], ['hire', 's', 'hire_cnt' if act_on else HCO], ['fire', 's', 'fire_cnt'], ['reg', 's', 'reg_cnt'], ['nreg', 's', NREG], ['tin', 't', TI], ['tout', 't', TU], ['pnor', 's', 'pnor_cnt'], ['plow', 's', 'plow_cnt'], ['phig', 's', 'phig_cnt'], ['pgry', 's', 'pgry_cnt'], ['wday', 's', 'wday_amt'], ['ovis', 's', 'ovis_amt'], ['gapr', 's', 'gapr_cnt'], ['gdec', 's', 'gdec_cnt'], ['vop', 'v', 'vac_open_cnt'], ['vcl', 'v', 'vac_close_cnt'], ['vap', 'v', 'vac_new_cnt'], ['vtd', 'v', 'vac_ttf_days'], ['vtn', 'v', 'vac_ttf_cnt'], ['vjn', 'v', "if(ifNull(cand_lvl, '') = 'Junior', vac_close_cnt, 0)"], ['aiw', 'a', 'ai_wau'], ['aip', 'a', 'ai_pen'], ['aic', 'a', 'ai_pen_co'], ['hit', 't', HI], ['din', 'd', TI], ['dout', 'd', TU], ['hcd', 't', hk('c')], ['hst', 't', hk('s')], ['bk', 's', optf('bk_amt')], ['bkv', 's', optf('bkv_amt')], ['vsv', 's', optf('vsv_amt')], ['hwd', 's', optf('hwd_amt')], ['hov', 's', optf('hov_amt')], ['rh', 'h', 'reg_cnt'], ['nrh', 'h', NREG], ['avh', 'h', 'avg_cnt'], ['fh', 'h', 'fire_cnt'], ['hch', 'h', 'hc_cnt'], ['ab25', 's', optf('ab25_cnt')], ['ab5', 's', optf('ab5_cnt')], ['we25', 's', optf('we25_cnt')], ['we5', 's', optf('we5_cnt')], ['t23', 's', optf('t23_cnt')], ['t35', 's', optf('t35_cnt')], ['t5', 's', optf('t5_cnt')], ['hrs', 's', optf('hrs_amt')], ['hrn', 's', optf('hrn_cnt')], ['tlk', 's', optf('tlk_amt')], ['gah', 'g', 'gapr_cnt'], ['gdh', 'g', 'gdec_cnt']] %}
{% set MI = {} %}{% for m in M %}{% set _ = MI.update({m[0]: loop.index}) %}{% endfor %}
{#- Метрики таблицы одним массивом: суммы по колонкам (быстрее, чем суммировать массивы построчно), чужие
    этой таблице — нули отрезками arrayWithConstant (короче текст). array(…), а не […]: в переводах внутри стоят
    значения фильтров, и «]» в значении sqlparse принял бы за конец имени [..]. -#}
{% macro vec(src) -%}
{%- set parts = [] -%}{%- set run = {'z': 0, 's': []} -%}
{%- for m in M -%}
{%- if m[1] == src -%}
{%- if run.z -%}{%- set _ = parts.append('arrayWithConstant(' ~ run.z ~ ', toFloat64(0))') -%}{%- set _ = run.update({'z': 0}) -%}{%- endif -%}
{%- set _ = run.s.append('sum(toFloat64(ifNull(' ~ m[2] ~ ', 0)))') -%}
{%- else -%}
{%- if run.s -%}{%- set _ = parts.append('array(' ~ run.s|join(', ') ~ ')') -%}{%- set _ = run.update({'s': []}) -%}{%- endif -%}
{%- set _ = run.update({'z': run.z + 1}) -%}
{%- endif -%}
{%- endfor -%}
{%- if run.s -%}{%- set _ = parts.append('array(' ~ run.s|join(', ') ~ ')') -%}{%- endif -%}
{%- if run.z -%}{%- set _ = parts.append('arrayWithConstant(' ~ run.z ~ ', toFloat64(0))') -%}{%- endif -%}
arrayConcat({{ parts|join(', ') }})
{%- endmacro %}
{#- Узлы ответа (множество для IN) и месяц строки от начала сетки — через проекцию общего скаляра. -#}
{% set PK = '(SELECT tupleElement(arrayJoin(pks), 1) FROM cx)' %}
{#- Поставка 64: «напрямую в юните» — узлы ответа с ':d' (переводы людей в самом юните, без подразделений) -#}
{% set PKD = "(SELECT concat(tupleElement(arrayJoin(pks), 1), ':d') FROM cx)" %}
{% set IDX = "toInt32(dateDiff('month', (SELECT m0 FROM cx), toDate(assumeNotNull(report_month))))" %}
{% set GRID = 'report_month BETWEEN (SELECT m0 FROM cx) AND (SELECT lm FROM cx)' %}
{% set FV = '(SELECT fv FROM fdv)' %}
{#- Значения фильтров с численностью компании за последний месяц (окно настройки) — одним проходом:
    JSON-объект «разрез → [{v, e}]», значения по убыванию численности. -#}
{% set VALS %}(SELECT concat('{"paint":', toJSONString(groupArrayIf((v, e), g = 1)), ',"it":', toJSONString(groupArrayIf((v, e), g = 2)),
                 ',"staff":', toJSONString(groupArrayIf((v, e), g = 3)), ',"act":', toJSONString(groupArrayIf((v, e), g = 4)), '}')
  FROM (
    SELECT gv.1 AS g, gv.2 AS v, sum(ifNull(hc_cnt, 0)) AS e
    FROM prod_proteus.teampulse_hub_series
    ARRAY JOIN [(1, ifNull(paint_cd, '-')), (2, ifNull(it_cd, '-')), (3, ifNull(staff_cd, '-')), (4, {{ AC }})] AS gv
    WHERE node_rk = (SELECT r FROM cx) AND report_month = (SELECT lm FROM cx)
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
      SELECT lm, m0, n, r, d, dd, fl,
             if(fl, [r], arrayMap(x -> x.1, arrayFilter(x -> x.4 = {{ me() }} AND x.4 != '' AND x.1 != '', al))) AS zr,
             length(zr) > 0 AS ok,
             arrayDistinct(arrayFlatten(arrayMap(z -> splitByChar('|', arrayElement(arrayFilter(x -> x.1 = z, al), 1).3), zr))) AS an,
             if({% if unit_req %}arrayExists(x -> x.1 = {{ qs(unit_req[0]) }} AND hasAny(splitByChar('|', x.3), zr), al){% else %}0{% endif %},
                {{ qs(unit_req[0]) if unit_req else "''" }}, if(fl, d, if(ok, zr[1], ''))) AS s,
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
      CROSS JOIN (SELECT groupArray((ifNull(unit_rk, ''), ifNull(parent_rk, ''), ifNull(path_rk, ''),
                                     lowerUTF8(trimBoth(arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))))))) AS al
                  FROM prod_proteus.teampulse_hub_unit) AS ua
      CROSS JOIN (SELECT has({{ qa(FULL) }}, {{ me() }}) AS fl) AS fa
    )
  ),
  {#- поставка 90: cm — последний закрытый месяц, как cm ноутбука (teampulse_hub_cal): последний месяц, если дата данных —
      его последний день или он январь, иначе месяц перед ним; даты данных нет (старая таблица) — вчера, но не позже конца
      месяца. «С начала года» — январь..cm #}
  cx AS (
    SELECT c.1 AS lm, c.2 AS m0, c.3 AS n, c.4 AS r, c.5 AS d, c.6 AS dd, c.7 AS s, c.8 AS pks, c.9 AS zr, c.10 AS ok, c.11 AS fl, c.12 AS an,
           if(toMonth(c.1) = 1 OR ifNull(toDateOrNull(substring(c.6, 1, 10)), least(today() - 1, addDays(addMonths(c.1, 1), -1)))
                                  >= addDays(addMonths(c.1, 1), -1), c.1, addMonths(c.1, -1)) AS cm
    FROM (SELECT (SELECT c0 FROM cx0) AS c)
  ),
  {#- head_login и head_nm (поставка 66) — матчером: таблица без колонки даёт пустой логин и имя #}
  st2 AS (
    SELECT ifNull(unit_rk, '') AS id, ifNull(parent_rk, '') AS pid, toInt32(ifNull(unit_lvl, 0)) AS lv,
           ifNull(unit_nm, '') AS nm0, toUInt32(ifNull(kids_cnt, 0)) AS kd, splitByChar('|', ifNull(path_rk, '')) AS ph,
           arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_login$')]))) AS hd,
           replaceAll(replaceAll(arrayStringConcat(arrayMap(x -> ifNull(x, ''), arrayConcat(CAST([], 'Array(Nullable(String))'), [COLUMNS('^head_nm$')]))), char(9), ' '), char(10), ' ') AS hn
    FROM prod_proteus.teampulse_hub_unit
  ),
  {#- Численность последнего месяца по значениям фильтров (ряды узла — уже вся ветка); fv — порядок значений,
      по которому кодируется сочетание (в meta — fdv) #}
  fdb AS (
    SELECT ifNull(node_rk, '') AS u7, ifNull(paint_cd, '-') AS v7a, ifNull(it_cd, '-') AS v7b,
           ifNull(staff_cd, '-') AS v7c, {{ AC }} AS v7d, sum(toFloat64(ifNull(hc_cnt, 0))) AS n7
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
             (((indexOf(tupleElement({{ FV }}, 1), v7a) - 1) * length(tupleElement({{ FV }}, 2)) + indexOf(tupleElement({{ FV }}, 2), v7b) - 1)
              * length(tupleElement({{ FV }}, 3)) + indexOf(tupleElement({{ FV }}, 3), v7c) - 1)
             * length(tupleElement({{ FV }}, 4)) + indexOf(tupleElement({{ FV }}, 4), v7d) - 1)), ':', toString(round(n7))))), ' ') AS fds
    FROM fdb
    GROUP BY u7
  ),
  {#- Метрики узлов ответа под фильтрами: узел × месяц × массив метрик (по строке от каждой таблицы); нулевые
      строки — все месяцы каждого узла: ряд узла без людей и месяцы без строк — нули #}
  mm AS (
    SELECT u2, i2, sumForEach(a2) AS s2
    FROM
    (
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('s') }} AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN {{ PK }} AND {{ GRID }} AND {{ cond() }}
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('t') }} AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE ifNull(node_rk, '') IN {{ PK }} AND {{ GRID }} AND {{ cond() }}
      GROUP BY u2, i2
      UNION ALL
      {#- поставка 64: din / dout — переводы «напрямую в юните» (узел юнит:d ноутбука) в строку юнита #}
      SELECT substring(ifNull(node_rk, ''), 1, length(ifNull(node_rk, '')) - 2) AS u2, {{ IDX }} AS i2, {{ vec('d') }} AS a2
      FROM prod_proteus.teampulse_hub_trf
      WHERE ifNull(node_rk, '') IN {{ PKD }} AND {{ GRID }} AND {{ cond() }}
      GROUP BY u2, i2
      UNION ALL
      {#- 31.10-б, п. 6; файл 6, п. 4: одобренные и отклонённые заявки «Роста» по численности HQ — у каждого узла ответа #}
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('g') }} AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN {{ PK }} AND {{ GRID }} AND {{ cond_rh() }}
      GROUP BY u2, i2
      UNION ALL
      {#- поставка 69: нежелательные, желательные и ССЧ по активной численности HQ — у каждого узла ответа #}
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('h') }} AS a2
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') IN {{ PK }} AND {{ GRID }} AND {{ cond_hq() }}
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('v') }} AS a2
      FROM prod_proteus.teampulse_hub_vacancy
      WHERE ifNull(node_rk, '') IN {{ PK }} AND {{ GRID }}
      GROUP BY u2, i2
      UNION ALL
      SELECT ifNull(node_rk, '') AS u2, {{ IDX }} AS i2, {{ vec('a') }} AS a2
      FROM prod_proteus.teampulse_hub_ai
      WHERE ifNull(node_rk, '') IN {{ PK }} AND {{ GRID }}
      GROUP BY u2, i2
      UNION ALL
      SELECT tupleElement(arrayJoin(pks), 1) AS u2, toInt32(arrayJoin(range(n))) AS i2, arrayWithConstant({{ M|length }}, toFloat64(0)) AS a2
      FROM cx
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
      FROM (SELECT u2, i2, s2, (SELECT n FROM cx) AS nn FROM mm)
      GROUP BY u2
    )
  ),
  {#- Поставка 65: ряды выбранного юнита под «HQ + Активная» — светофор HQ; нулевые строки — все месяцы #}
  mh AS (
    SELECT i6, sumForEach(a6) AS s6
    FROM
    (
      SELECT {{ IDX }} AS i6, {{ vec('s') }} AS a6
      FROM prod_proteus.teampulse_hub_series
      WHERE ifNull(node_rk, '') = (SELECT s FROM cx) AND {{ GRID }} AND {{ cond_hq() }}
      GROUP BY i6
      UNION ALL
      SELECT toInt32(arrayJoin(range(n))) AS i6, arrayWithConstant({{ M|length }}, toFloat64(0)) AS a6
      FROM cx
    )
    GROUP BY i6
  ),
  arh AS (
    SELECT arrayMap(k -> arrayMap(g -> g[k], gh), range(1, {{ M|length + 1 }})) AS th
    FROM (
      SELECT arraySlice(arrayMap(x -> x.2, arraySort(groupArray((i6, s6)))), 1, any(nh)) AS gh
      FROM (SELECT i6, s6, (SELECT n FROM cx) AS nh FROM mh)
    )
  ),
  {#- Разрезы узлов ответа под фильтрами: «ключ \t значение \t число» через \n, отсортировано #}
  mxr AS (
    SELECT u3 AS mu, arrayStringConcat(arraySort(groupArray(concat(k3, '\t', v3, '\t', toString(round(n4, 1))))), '\n') AS mxs
    FROM
    (
      SELECT ifNull(node_rk, '') AS u3, ifNull(mx_key, '') AS k3, ifNull(mx_val, '') AS v3, sum(toFloat64(ifNull(mx_n, 0))) AS n4
      FROM prod_proteus.teampulse_hub_mix
      {#- 31.10-б, п. 6; файл 6, п. 4: разрезы «Роста» (rm rq rs) — по численности HQ (cond_rh), остальные — под все фильтры #}
      WHERE ifNull(node_rk, '') IN {{ PK }}
        AND (ifNull(mx_key, '') NOT IN ('rm', 'rq', 'rs') AND {{ cond() }} OR ifNull(mx_key, '') IN ('rm', 'rq', 'rs') AND {{ cond_rh() }})
        {#- поставка 66: календарь посещений по дням, 26.10-б: увольнения по инициатору и месяцу — только у выбранного юнита #}
        {#- поставка 71: T-рост (rm, rq, rs) был только у выбранного юнита; файл 6, п. 3 и 6 — у каждого узла: выбор строки
            таблицы подразделений фильтрует все блоки вкладки «Рост HQ». Поставка 100 (ревью): так же уходы по инициатору (xim),
            движение по специализациям (tsh tsi tso sp0 sp1); только у юнита — календарь (dw do) и возраст по разрезам (es en:
            ~2,5 КБ на узел; у подразделения средний возраст точный по e, срезы — оценкой от юнита) #}
        AND (ifNull(mx_key, '') NOT IN ('dw', 'do', 'es', 'en') OR ifNull(node_rk, '') = (SELECT s FROM cx))
      GROUP BY u3, k3, v3
      HAVING n4 > 0
      UNION ALL
      {#- вакансии: открытые на конец последнего месяца по статусу (vs), причине (vr), специализации (vp),
          уровню позиции (vl); закрытые с начала года по каналу (vk) и уровню кандидата (vq) — поставка 90: январь..cm #}
      SELECT u5 AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT ifNull(node_rk, '') AS u5, if(report_month = (SELECT lm FROM cx), toFloat64(ifNull(vac_open_cnt, 0)), 0) AS vo,
               if(report_month <= (SELECT cm FROM cx), toFloat64(ifNull(vac_close_cnt, 0)), 0) AS vc,
               arrayFilter(x -> x.3 > 0, [('vs', ifNull(status, ''), if(ifNull(status, '') != '', vo, 0)), ('vr', ifNull(search_reason, ''), vo),
                 ('vp', ifNull(specialization, ''), vo), ('vl', ifNull(position_lvl, ''), vo), ('vk', ifNull(channel, ''), vc),
                 ('vq', ifNull(cand_lvl, ''), vc)]) AS kvs
        FROM prod_proteus.teampulse_hub_vacancy
        WHERE ifNull(node_rk, '') IN {{ PK }} AND report_month >= toStartOfYear((SELECT lm FROM cx))
      )
      ARRAY JOIN kvs AS kv
      GROUP BY u3, k3, v3
      UNION ALL
      {#- 28.10, п. 1: найм, переводы в и из с начала года по специализации; поставка 90: январь..cm; поставка 100 (ревью) —
          у каждого узла ответа (было — только у выбранного юнита) #}
      SELECT ifNull(node_rk, '') AS u3, kv.1 AS k3, kv.2 AS v3, sum(kv.3) AS n4
      FROM
      (
        SELECT node_rk, {{ SPC }} AS spx, {{ HI }} AS th, {{ SI }} AS ti, {{ SU }} AS tu
        FROM prod_proteus.teampulse_hub_trf
        WHERE ifNull(node_rk, '') IN {{ PK }} AND report_month >= toStartOfYear((SELECT cm FROM cx))
          AND report_month <= (SELECT cm FROM cx) AND {{ cond() }}
      )
      ARRAY JOIN [('tsh', spx, th), ('tsi', spx, ti), ('tso', spx, tu)] AS kv
      WHERE spx != ''
      GROUP BY u3, k3, v3
      HAVING n4 > 0
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
                '","def":"', (SELECT d FROM cx), '","ok":', toString(toUInt8((SELECT ok FROM cx))),
                ',"full":', toString(toUInt8((SELECT fl FROM cx))), ',"zone":', toJSONString((SELECT zr FROM cx)),
                ',"dt":"', (SELECT dd FROM cx), '","schema":"hub-2","cuts":["paint","it","staff"', if(has(tupleElement({{ FV }}, 4), '∅'), '', ',"act"'), ']',
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
                ',"act":', toJSONString(if(has(tupleElement({{ FV }}, 4), '∅'), CAST([], 'Array(String)'), tupleElement({{ FV }}, 4))), '}}') AS j,
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

  {#- поставка 65: светофор HQ — выбранный юнит под «HQ + Активная» #}
  SELECT toUInt8(4) AS o, 'hq' AS role, (SELECT s FROM cx) AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids, '' AS j,
         arrayStringConcat(arrayMap(r1 -> arrayStringConcat(arrayMap(x -> toString(round(x, 1)), r1), ','), h.th), ';') AS ms,
         '' AS mx
  FROM arh AS h
  WHERE (SELECT ok FROM cx)

  UNION ALL

  {#- поставка 69: справочник — зона логина и предки корней зоны (у предков — только имя: путь над отчётом) #}
  SELECT toUInt8(3) AS o, 'dict' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         arrayStringConcat(arraySort(groupArray(concat(t.id, '\t', t.pid, '\t', toString(t.lv), '\t',
                                             toString(t.kd), '\t', t.nm0, '\t', if(t.iz, t.hd, ''), '\t', if(t.iz, ifNull(f.fds, ''), ''),
                                             '\t', if(t.iz, t.hn, ''), '\t', if(t.iz, '', 'a')))), '\n') AS j,
         '' AS ms, '' AS mx
  FROM (SELECT *, hasAny(ph, (SELECT zr FROM cx)) AS iz FROM st2) AS t
  LEFT JOIN fdr AS f ON f.fr = t.id
  WHERE (SELECT ok FROM cx) AND (t.iz OR has((SELECT an FROM cx), t.id))

  UNION ALL

  SELECT toUInt8(9) AS o, 'end' AS role, '' AS id, '' AS pid, toInt32(0) AS lvl, '' AS nm, toUInt32(0) AS kids,
         '' AS j, '' AS ms, '' AS mx
)
)
ORDER BY o, lvl, nm, id

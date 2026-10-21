-- ============================================================================
-- click_calc_relevant.sql
-- SQL-версия «расчёта на клике» по строке сводной таблицы переводов (Proteus).
-- Заточена под ОГРАНИЧЕННЫЙ набор атрибутов и собирает события как в JS
-- getDetailRows(): только те переводы, где изменился хотя бы один релевантный
-- атрибут, и (опционально) совпадающие с выбранным путём иерархии сводной.
--
-- Релевантные атрибуты (ключи attr_changes_json ↔ флаги transfer_to_*_flg):
--   - Покраска:                  oper_code        -> transfer_to_hq_flg
--   - ИТ / нон-ИТ:               it_code          -> transfer_to_it_flg
--   - Управленческая структура:  mgmt_lvl3..12    -> transfer_to_lvl3..12_management_flg
--   - Тип численности:           active_type      -> transfer_to_active_type_flg
--   - Тип оформления:            employment_relation_type -> transfer_to_employment_relation_type_flg
--
-- Логика «клика» = выбор пути сводной (attribute_group -> attribute_name
-- -> transition_from -> transition_to). Здесь путь передаётся параметрами
-- (click_attribute / click_from / click_to) и применяется через макрос
-- click_path_filter(). Без параметров возвращаются ВСЕ релевантные события.
-- ============================================================================

-- ── Макрос: событие релевантно, если изменился ХОТЯ БЫ ОДИН из релевантных
-- атрибутов. Аналог isRelevantTransfer() из JS, но через флаги источника. ──
{% macro selected_relevant_transfer_expr() %}
(
    transfer_to_hq_flg = 1                          -- покраска (oper_code)
 OR transfer_to_it_flg = 1                          -- ИТ / нон-ИТ (it_code)
 OR transfer_to_lvl3_management_flg = 1             -- УС, уровень 3
 OR transfer_to_lvl4_management_flg = 1
 OR transfer_to_lvl5_management_flg = 1
 OR transfer_to_lvl6_management_flg = 1
 OR transfer_to_lvl7_management_flg = 1
 OR transfer_to_lvl8_management_flg = 1
 OR transfer_to_lvl9_management_flg = 1
 OR transfer_to_lvl10_management_flg = 1
 OR transfer_to_lvl11_management_flg = 1
 OR transfer_to_lvl12_management_flg = 1            -- УС, уровень 12
 OR transfer_to_active_type_flg = 1                 -- тип численности
 OR transfer_to_employment_relation_type_flg = 1    -- тип оформления
)
{% endmacro %}

-- ── Макрос: «клик» по пути сводной. ──
-- click_attribute  = ключ релевантного атрибута (oper_code, it_code,
--                    mgmt_lvl3..12, active_type, employment_relation_type)
-- click_from       = transition_from (значение атрибута ДО) — опционально
-- click_to         = transition_to   (значение атрибута ПОСЛЕ) — опционально
-- Если атрибут не задан — фильтр по переходу не применяется.
{% macro click_path_filter() %}
{% if filter_values('click_attribute')|length %}
  {% set a = filter_values('click_attribute')[0] %}
  {# словарь: ключ атрибута -> (флаг, prev-колонка, next-колонка) #}
  {% set attr_map = {
      'oper_code':               ('transfer_to_hq_flg',                     'prev_emp_specialization_oper_code', 'emp_specialization_oper_code'),
      'it_code':                 ('transfer_to_it_flg',                     'prev_emp_specialization_it_code',   'emp_specialization_it_code'),
      'active_type':             ('transfer_to_active_type_flg',            'prev_active_type_nm',              'active_type_nm'),
      'employment_relation_type':('transfer_to_employment_relation_type_flg','prev_employment_relation_type_desc','employment_relation_type_desc'),
      'mgmt_lvl3':  ('transfer_to_lvl3_management_flg',  'prev_lvl3_management_unit_nm',  'lvl3_management_unit_nm'),
      'mgmt_lvl4':  ('transfer_to_lvl4_management_flg',  'prev_lvl4_management_unit_nm',  'lvl4_management_unit_nm'),
      'mgmt_lvl5':  ('transfer_to_lvl5_management_flg',  'prev_lvl5_management_unit_nm',  'lvl5_management_unit_nm'),
      'mgmt_lvl6':  ('transfer_to_lvl6_management_flg',  'prev_lvl6_management_unit_nm',  'lvl6_management_unit_nm'),
      'mgmt_lvl7':  ('transfer_to_lvl7_management_flg',  'prev_lvl7_management_unit_nm',  'lvl7_management_unit_nm'),
      'mgmt_lvl8':  ('transfer_to_lvl8_management_flg',  'prev_lvl8_management_unit_nm',  'lvl8_management_unit_nm'),
      'mgmt_lvl9':  ('transfer_to_lvl9_management_flg',  'prev_lvl9_management_unit_nm',  'lvl9_management_unit_nm'),
      'mgmt_lvl10': ('transfer_to_lvl10_management_flg', 'prev_lvl10_management_unit_nm', 'lvl10_management_unit_nm'),
      'mgmt_lvl11': ('transfer_to_lvl11_management_flg', 'prev_lvl11_management_unit_nm', 'lvl11_management_unit_nm'),
      'mgmt_lvl12': ('transfer_to_lvl12_management_flg', 'prev_lvl12_management_unit_nm', 'lvl12_management_unit_nm')
  } %}
  {% if a in attr_map %}
    {% set flg = attr_map[a][0] %}
    {% set prev_col = attr_map[a][1] %}
    {% set next_col = attr_map[a][2] %}
    AND {{ flg }} = 1
    {% if filter_values('click_from')|length %}
    AND {{ prev_col }} = '{{ filter_values('click_from')[0] }}'
    {% endif %}
    {% if filter_values('click_to')|length %}
    AND {{ next_col }} = '{{ filter_values('click_to')[0] }}'
    {% endif %}
  {% else %}
    AND 1 = 0
  {% endif %}
{% endif %}
{% endmacro %}

-- ── Период (та же логика, что в chart.sql) ──
WITH base AS (
    SELECT
        mdm_employee_rk,
        mdm_employee_nm AS employee_name,
        business_dt_new_transfer AS transfer_date,
        company_hire_dt,
        company_fire_dt,
        wrk_email_address_txt,
        toStartOfMonth(business_dt_new_transfer) AS business_dt_month,

        -- значение атрибута ПОСЛЕ перевода = next_* колонка источника
        emp_specialization_oper_code,            -- покраска (after)
        emp_specialization_it_code,              -- ИТ/нон-ИТ (after)
        lvl3_management_unit_nm, lvl4_management_unit_nm, lvl5_management_unit_nm,
        lvl6_management_unit_nm, lvl7_management_unit_nm, lvl8_management_unit_nm,
        lvl9_management_unit_nm, lvl10_management_unit_nm, lvl11_management_unit_nm,
        lvl12_management_unit_nm,                -- УС (after)
        active_type_nm,                          -- тип численности (after)
        employment_relation_type_desc,           -- тип оформления (after)

        -- значение атрибута ДО перевода = prev_* колонка источника
        prev_emp_specialization_oper_code, prev_emp_specialization_it_code,
        prev_lvl3_management_unit_nm, prev_lvl4_management_unit_nm,
        prev_lvl5_management_unit_nm, prev_lvl6_management_unit_nm,
        prev_lvl7_management_unit_nm, prev_lvl8_management_unit_nm,
        prev_lvl9_management_unit_nm, prev_lvl10_management_unit_nm,
        prev_lvl11_management_unit_nm, prev_lvl12_management_unit_nm,
        prev_active_type_nm, prev_employment_relation_type_desc,

        -- релевантность события (как isRelevantTransfer в JS)
        {{ selected_relevant_transfer_expr() }} AS relevant_flg

    FROM prod_proteus.mdm_employee_d AS t
    prewhere 1=1
    {% if filter_values('calendar_date')|length %}
      {% if 'Последние 12 месяцев' in filter_values('calendar_date') %}
      and toYYYYMM(business_dt) >= toYYYYMM(subtractMonths(date_trunc('month', today()),10))
      {% elif 'Последние 6 месяцев' in filter_values('calendar_date') %}
      and toYYYYMM(t.business_dt) >= toYYYYMM(subtractMonths(today(), 4))
      {% elif 'Последние 3 месяца' in filter_values('calendar_date') %}
      and toYYYYMM(t.business_dt) >= toYYYYMM(subtractMonths(today(), 1))
      {% elif 'Пользовательский период' in filter_values('calendar_date') %}
      and toYYYYMM(t.business_dt) > toYYYYMM(toDateTime({{filter_values('business_dt_start')}}[1]/1000))
        and toYYYYMM(t.business_dt) <= toYYYYMM(toDateTime({{filter_values('business_dt_end')}}[1]/1000))
      {% else %}
      and toYYYYMM(t.business_dt) >= toYYYYMM(subtractMonths(date_trunc('month', today()),10))
      {% endif %}
    {% else %}
      and toYYYYMM(t.business_dt) >= toYYYYMM(subtractMonths(date_trunc('month', today()),10))
    {% endif %}
    WHERE 1=1
      -- событие обязано быть релевантным (хотя бы один нужный атрибут изменился)
      AND {{ selected_relevant_transfer_expr() }} = 1
      -- "на клике": фильтр по выбранному пути сводной (атрибут + переход)
      {{ click_path_filter() }}
      -- исключаем найм и кандидатов (как в chart.sql)
      AND company_hire_flg = 0
      {% if filter_values('active_type_nm')|length or 'Активная' in filter_values('employee_type') %}
      AND transfer_candidate_flg = 0
      AND transfer_internal_flg = 0
      {% endif %}
)
SELECT
    mdm_employee_rk AS employee_id,
    employee_name,
    transfer_date,
    company_hire_dt,
    company_fire_dt,
    wrk_email_address_txt,
    formatDateTime(business_dt_month, '%Y-%m') AS period_month,

    -- "На клике": фильтр по выбранному пути сводной (атрибут + переход)
    -- применяется в CTE base через макрос click_path_filter.
    -- Ниже — детальные old/new по релевантным атрибутам (как getDetailRows).
    ifNull(prev_emp_specialization_oper_code, '') AS pokraska_from,
    ifNull(emp_specialization_oper_code, '')     AS pokraska_to,
    ifNull(prev_emp_specialization_it_code, '')  AS it_from,
    ifNull(emp_specialization_it_code, '')       AS it_to,
    ifNull(prev_lvl3_management_unit_nm, '')     AS mgmt_lvl3_from, ifNull(lvl3_management_unit_nm, '') AS mgmt_lvl3_to,
    ifNull(prev_lvl4_management_unit_nm, '')     AS mgmt_lvl4_from, ifNull(lvl4_management_unit_nm, '') AS mgmt_lvl4_to,
    ifNull(prev_lvl5_management_unit_nm, '')     AS mgmt_lvl5_from, ifNull(lvl5_management_unit_nm, '') AS mgmt_lvl5_to,
    ifNull(prev_lvl6_management_unit_nm, '')     AS mgmt_lvl6_from, ifNull(lvl6_management_unit_nm, '') AS mgmt_lvl6_to,
    ifNull(prev_lvl7_management_unit_nm, '')     AS mgmt_lvl7_from, ifNull(lvl7_management_unit_nm, '') AS mgmt_lvl7_to,
    ifNull(prev_lvl8_management_unit_nm, '')     AS mgmt_lvl8_from, ifNull(lvl8_management_unit_nm, '') AS mgmt_lvl8_to,
    ifNull(prev_lvl9_management_unit_nm, '')     AS mgmt_lvl9_from, ifNull(lvl9_management_unit_nm, '') AS mgmt_lvl9_to,
    ifNull(prev_lvl10_management_unit_nm, '')    AS mgmt_lvl10_from, ifNull(lvl10_management_unit_nm, '') AS mgmt_lvl10_to,
    ifNull(prev_lvl11_management_unit_nm, '')    AS mgmt_lvl11_from, ifNull(lvl11_management_unit_nm, '') AS mgmt_lvl11_to,
    ifNull(prev_lvl12_management_unit_nm, '')    AS mgmt_lvl12_from, ifNull(lvl12_management_unit_nm, '') AS mgmt_lvl12_to,
    ifNull(prev_active_type_nm, '')              AS active_type_from,
    ifNull(active_type_nm, '')                   AS active_type_to,
    ifNull(prev_employment_relation_type_desc, '') AS employment_relation_type_from,
    ifNull(employment_relation_type_desc, '')      AS employment_relation_type_to
FROM base
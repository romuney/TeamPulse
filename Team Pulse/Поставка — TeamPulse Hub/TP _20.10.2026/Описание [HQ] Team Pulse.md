# [HQ - отчет] Team Pulse — описание ноутбука

## Назначение
Ежедневный отчётный ноутбук (cron `0 32 08 1/1 * ? *`, 08:32 UTC), который строит HR-отчёт **Team Pulse для HQ**: численность, найм, отток, переводы, текучесть, стаж, причины увольнения, инициатива, regrettable/non-regrettable и total turnover.

Все расчёты ведутся по сегменту **HQ** (`emp_specialization_oper_code = 'Hq'`, `active_type_nm = 'Активная'`) по уровням оргструктуры lvl2–lvl11. Параметр отчёта — дата отчётного месяца (`$form_multiselect_1`).

## Источники данных (GP, сервис cross)
- `usr_cross_data.hr_executive_proteus` — основной источник по сотрудникам (флаги hire/fire/transfer, атрибуты, grade, стаж, причины увольнения, regrettable/non_regrettable).
- `usr_cross_pub.cross_management_unit` — справочник оргструктуры (добавляет `new_management_unit_nm`).
- `usr_cross_data.it_fire_initiative_spch`, `usr_cross_data.iskl_fire_initiative_spch` — данные IT/Исключённых сегментов (ожидаются в `tables_wait`).
- `usr_mlpa.ai_bi_all_copilots_usage_digest_monthly/weekly` — использование AI-продуктов (отдельный блок).

## Архитектура
Промежуточные и финальные витрины создаются в GP (`usr_wrk.*`), затем выгружаются в ClickHouse (`prod_proteus.*`) через обёртку `gp_to_click_with_retry` (3 попытки с паузами 30/60 сек). После выгрузки проставляются владельцы таблиц.

## Основные блоки и метрики

### 1. Базовые срезы: численность / найм / отток
- **hire_employee** — найм по каналам привлечения (перевод кандидата, стажёр в штат, найм активных).
- **atributy_nayma** — витрина атрибутов найма (grade-группировка, найм за текущий/прошлый год) → `prod_proteus.atributy_nayma`.
- **outflow_employee / ottok_employee** — отток (`fire_flg=1`) с атрибутами и parent-уровнями.
- **last_day_of_month** — численность на конец месяца (`last_day_of_month_flg=1`, `fire_flg=0`).
- **naym_employee** — найм с parent-уровнями и каналами.
- **Скелет** — объединение distinct-комбинаций (month, unit, атрибуты).
- **Итог -срез/найм/отток** — `last_day_ottok_naym_all` — главная сводная (employee_amt, ottok_amt, hire_naym_amt, perevod_v_bg, perevod_stazhera_v_shtat_amt, naym_amt, grade). Ядро, от которого зависят многие витрины.
- **last_day_ottok_naym** — фильтр по выбранному месяцу → `prod_proteus.last_day_ottok_naym`.

### 2. Динамика численности и waterfall
- **dinamika_aktivnoy_chislennosti** — помесячная динамика активной численности HQ.
- **Handlebars** — `dinamika_aktivnoy_chislennosti_new` (данные за 12 мес) → CH.
- **Handlebars waterfall** — `waterfall_chislennosti_new` (движение персонала: start/end, fire, hire, transfer_in/out) → CH.
- **union переводы + / -** — переводы «в» и «из» по типам (Тип численности / УС / HQ|nonHQ).
- **waterfall_perevody** — waterfall переводов по типам → CH.

### 3. Изменения по подразделениям и специализациям
- **izmeneniye_po_podrazdeleniyam** — изменения по подразделениям: численность, отток, найм, переводы, spch (среднесписочная), tekuchest (текучесть = ottok/spch), прирост за год → CH.
- **izmeneniya_po_spetsializatsiyam** — аналогичный конвейер по специализациям → CH.

### 4. Атрибуты оттока (годовые срезы)
- **atributy_ottoka_year** — отток за текущий/прошлый год по атрибутам → CH.
- **seniority_ottoka_year** — отток/текучесть по стажу за год.
- **stream_ottoka_year** — отток/текучесть по специализации/стриму за год.
- **grade_ottoka_year** — отток/текучесть по грейдам за год → CH.

### 5. Текучесть по юнитам / стаж+причины / инициатива
- **ottok_unit / employee_count_reason_group** — отток и численность по юнитам.
- **experience_group_fire_reason** — текучесть по стажу+причине за год → CH.
- **experience_fire_reason_group** — текучесть по причине+инициативе за год → CH.
- **tekuchest_hq** — сводная текучесть HQ (стаж+причина+инициатива+юнит).

### 6. Текучесть накопленная и regrettable/non-regrettable/total
- **fire_initiative_spch** — помесячная текучесть по инициативе с накоплением за год → CH.
- **regrettable_set_hq** — накопленная YTD-текучесть regrettable с плановыми коридорами → `prod_proteus.hq_regrettable_set`.
- **non_regrettable_set_hq** — накопленная YTD-текучесть non-regrettable → `prod_proteus.hq_non_regrettable_set`.
- **total_set_hq** — накопленная YTD-текучесть total с benchmark → `prod_proteus.total_set_hq`.

### 7. «Подмена» (объединение HQ + IT + ISKL)
Создаёт `usr_wrk.general_*` таблицы — объединение HQ-данных (кроме юнита `ccb024088065af4df3337021924784ec`) + `it_*` + `iskl_*` версий для всех ключевых витрин. Делает отчёт полным по всем сегментам. Затем **gp_to_click** массово выгружает все `general_*` в `prod_proteus.*` с `upload_mode='replace'`.

### 8. Владельцы таблиц и refresh дашборда
- **table_owners** — `set_table_owners` для всех `prod_proteus.*` таблиц (владельцы: d.i.dyachenko, a.a.varnavskiy, r.kazantsev, a.khisamova).
- **refresh_dashboard** (dashboard_id=34136) — **отключён** (enabled=false), автообновление дашборда в текущей конфигурации не выполняется.

### 9. Новые блоки
- **team_structure** — детальная численность на конец месяца с возрастом и `new_management_unit_nm` → `prod_proteus.team_structure`.
- **AI-продукты** — `ai_digest_monthly` / `ai_digest_weekly` (использование AI-копилотов: avg_wau, penetration) → CH.

## Логика ключевых метрик
- **Численность (employee_amt)**: `COUNT(mdm_employee_rk)` при `last_day_of_month_flg=1 AND fire_flg=0`, фильтр HQ/Активная.
- **Найм (naym_amt)**: `hire_flg=1 AND active_type_nm='Активная'`. Каналы: `perevod_v_bg`, `perevod_stazhera_v_shtat_amt`.
- **Отток (ottok_amt)**: `fire_flg=1`.
- **Переводы**: флаги `transfer_to_*` / `lvl_mngt_unit_in_trsf_flg` (в) и `transfer_out_*` / `lvl_mngt_unit_out_trsf_flg` (из).
- **Среднесписочная (spch)**: `(lag_employee_amt + employee_amt)/2`.
- **Текучесть (tekuchest)**: `ottok_amt / spch` (защита от деления на 0).
- **Накопленная YTD-текучесть**: `sum(tek_month)` по году с плановыми коридорами (plan_min/max, benchmark_max).
- **Regrettable/Non-regrettable**: по флагам `regrettable_fire_flg` / `non_regrettable_fire_flg`.
- **Стаж**: группы `experience_group_nm` («Стаж менее 3 мес» … «Стаж более 5 лет»).
- **Причины увольнения**: `fire_reason`, `fire_reason_group`; **инициатива**: `fire_initiative`.
- **Grade**: группировка 7–19 как есть, 20+ объединяется в «20+».
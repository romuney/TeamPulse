-- ============================================================================
-- 0а. SQL Lab — структура таблицы ClickHouse
--
-- Зачем: по ответам на эти запросы я пойму таблицу — колонки и типы, ключи,
-- зерно (что одна строка), какие колонки справочные, за какой период данные —
-- и сопоставлю её с метриками отчёта (SOURCES.md, §5, §7 и §17).
--
-- Как:
--   1. Замените во всём файле my_db на имя базы, my_table — на имя таблицы
--      (Ctrl+H в SQL Lab). Таблиц несколько — прогоните файл для каждой.
--   2. Выполняйте запросы по одному: выделите запрос → Run (Ctrl+Enter).
--   3. Результат каждого — «Скопировать в буфер» или CSV — пришлите в чат
--      с номером запроса. Широкие ответы (4–6) — одной строкой, это нормально.
--
-- Персональные данные не нужны. Запросы 1–5 их не показывают (только имена
-- колонок, типы и счётчики). В 6 и 7 перечислите в EXCEPT СВОИ колонки с ФИО,
-- почтой, логином, табельным номером, зарплатой — их имена видны в ответе
-- на запрос 2. Внимание: EXCEPT молча пропускает имя, которого в таблице нет,
-- поэтому fio и email ниже — только пример, их надо заменить своими.
--
-- Проверено на ClickHouse 24.8 (версия боевого кластера по HRBP HUB).
-- ============================================================================


-- 1. Карточка таблицы: движок, ключи партиционирования и сортировки,
--    сколько строк и сколько места.
SELECT database, name, engine, partition_key, sorting_key, primary_key, sampling_key,
       total_rows, formatReadableSize(total_bytes) AS size, comment
FROM system.tables
WHERE database = 'my_db' AND name = 'my_table';


-- 2. Колонки: тип, значение по умолчанию, комментарий, входит ли в ключи,
--    вес на диске.
SELECT position, name, type, default_kind, default_expression, comment,
       is_in_partition_key, is_in_sorting_key, is_in_primary_key,
       formatReadableSize(data_compressed_bytes) AS size
FROM system.columns
WHERE database = 'my_db' AND table = 'my_table'
ORDER BY position;


-- 3. Полный DDL одной строкой: кодеки, TTL, настройки. Если SQL Lab не
--    пропускает SHOW — не страшно, 1 и 2 говорят почти то же.
SHOW CREATE TABLE my_db.my_table;


-- 4. Сколько разных значений в каждой колонке — одна строка, колонка на
--    колонку. Видно зерно (что уникально), справочники (мало значений)
--    и колонки-константы. Это счётчики, самих значений здесь нет.
SELECT count() AS rows, * APPLY(uniq)
FROM my_db.my_table;


-- 5. Заполненность: сколько непустых значений в каждой колонке
--    (NULL не считается; пустая строка считается).
SELECT count() AS rows, * APPLY(count)
FROM my_db.my_table;


-- 6. Диапазоны: минимум и максимум по каждой колонке — даты, коды, числа.
--    В EXCEPT — СВОИ колонки с ФИО, почтой, логином, табельным, зарплатой:
--    минимум колонки с ФИО — это чьё-то имя.
SELECT 'min' AS what, * EXCEPT (fio, email) APPLY(min) FROM my_db.my_table
UNION ALL
SELECT 'max', * EXCEPT (fio, email) APPLY(max) FROM my_db.my_table;


-- 7. Двадцать строк для примера — без персональных данных.
--    EXCEPT — те же колонки, что в 6. Ключ сотрудника заменён хешем: по нему
--    видно, что строки одного человека повторяются, а кто он — нет. Своё имя
--    колонки-ключа впишите вместо employee_id.
SELECT * EXCEPT (fio, email) REPLACE (cityHash64(employee_id) % 100000 AS employee_id)
FROM my_db.my_table
LIMIT 20;


-- 8. Строки по месяцам: за какой период данные и нет ли провалов.
--    Вместо report_dt — своя колонка даты (её видно в ответе на 2).
SELECT toStartOfMonth(report_dt) AS month, count() AS rows
FROM my_db.my_table
GROUP BY month
ORDER BY month;


-- 9. Соседние таблицы в той же базе: что ещё есть рядом.
SELECT name, engine, total_rows, formatReadableSize(total_bytes) AS size, comment
FROM system.tables
WHERE database = 'my_db'
ORDER BY name;


-- ---------------------------------------------------------------------------
-- После ответов на 1–9 могу попросить ещё два — подставьте свои колонки:
-- ---------------------------------------------------------------------------

-- 10. Значения справочной колонки (покраска, грейд, тип оформления…) —
--     той, где в ответе на 4 мало разных значений (до ~50).
SELECT paint AS value, count() AS rows
FROM my_db.my_table
GROUP BY value
ORDER BY rows DESC
LIMIT 50;


-- 11. Зерно: одна ли строка на сотрудника и месяц. Совпало keys с rows —
--     да; keys меньше — у человека в месяце несколько строк (переводы,
--     совместительство), и это важно для численности.
SELECT count() AS rows, uniqExact(employee_id, report_dt) AS keys
FROM my_db.my_table;

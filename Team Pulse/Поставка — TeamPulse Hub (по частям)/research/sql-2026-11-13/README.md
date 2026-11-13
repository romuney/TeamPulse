# Локальный SQL-эксперимент, 13 ноября 2026

Это исследовательские инструменты и числовые результаты. В Proteus устанавливаются
только файлы 2.1 и 2.4 из корня поставки. Эти скрипты не являются миграциями продовой БД.

Описание выводов и ограничений: `../../8. Исследование SQL 13.11.2026.md`.
Все данные синтетические. Архив корпоративного прогона и ЧД-данные сюда не включены.

## Что сохранено

- `scale-*-results.json`: три чередующихся прогона, отдельные времена SQL-пути и CH.
- `parallel-query-results.json`: шесть параллельных запусков, точные хеши ответов.
- `scale-*-profile.json`, `*-plan.txt`: счётчики движка и видимая часть EXPLAIN.
- `small*-summary.json`, `large-single-summary.json`: точная сверка результатов.
- `release-*`: проверки фактических файлов поставки (добавлены после завершения gate).

В опубликованных копиях полей старого формата `rows_read/bytes_read/elapsed` даны
однозначные названия `result_rows/result_bytes/driver_elapsed`: это выход chdb,
не чтение исходных таблиц. `baseline_text_refs` — текстовые упоминания FROM в
исходном варианте; не счётчик исполненных чтений кандидата. Значения сохранены.
`strict_equal=false` не является PASS; причины и ограничения описаны в отчёте.

## Повторение на синтетике

Python 3.12; chdb==3.1.2 (SELECT version(): 24.8.4.1), sqlparse==0.4.3,
Jinja2==3.0.3, MarkupSafe==2.0.1, sqlglot==26.33.0, psycopg2-binary,
pandas, pyarrow, PyYAML. Для M2 отдельно sqlparse==0.4.4 через PYTHONPATH.
Нужны PostgreSQL 16 и существующие `Team Pulse/stand/nb_tp20.py` и
`hub_scale_clone.py`. PostgreSQL — замена DAL/GP на синтетике, не модель плана GP.

1. Задать `TP_SQL_STUDY` на новый локальный каталог (по умолчанию
   `/tmp/tp-sql-study`). Запустить `python snapshot.py`: исходные пять SQL
   замораживаются на a2a34e0, ordinary берётся из неизменённой обычной поставки.
   Snapshot нельзя перезаписывать между A/B. После будущих изменений ordinary
   восстановить его из того же коммита перед новым исследованием.
2. Поднять отдельный PostgreSQL. Из `Team Pulse` выполнить
   `python stand/nb_tp20.py --pg SOCKET:PORT --user USER --hub "$TP_SQL_STUDY/small"`.
   Большой набор: `python stand/hub_scale_clone.py "$TP_SQL_STUDY/small/db" "$TP_SQL_STUDY/scale" 1`.
3. `python study.py "$TP_SQL_STUDY/scale" --prepare --label scale --users '["tester","full.leaves","branch.user"]'`.
   Это создаёт только тестовые tpbench_zone/tpbench_fdb и синтетические права.
   Они нужны исследованию предрасчётов, но **не нужны опубликованным SQL**.
4. `python study.py "$TP_SQL_STUDY/scale" --bench --measure-only --parts core --variants base,scan --user full.leaves --label scale-scan`.
   Для aux: `--parts aux --variants base,peer --label scale-peer`.
   `--measure-only` сохраняет строгие несовпадения, не допускает погрешность.
   Для точного oracle использовать `--threads 1` без `--measure-only`.
5. Счётчики: `python profile_queries.py --label scale-scan --parts core --variants base,scan`.
   Для aux аналогично. SQL берётся из сохранённых выполненных текстов шага 4.
6. Release gate — `../../tests/sql-parity.py`; fixture прав расширяется функцией
   `check_candidate.seed()` и `study.py --prepare` на малом синтетическом наборе.
   Для chdb на macOS добавить к пути БД `?config-file=.../ch-config.xml`.
   Основной профиль `--settings 1:1:0`, oracle `--threads 1`.

Для параллельного опыта нужны пять независимых копий scale в
`parallel-db-{dict,core,people,flow,aux}`. На APFS использовался `cp -cR`;
после копирования **все абсолютные симлинки metadata/data перенаправлены внутрь
соответствующей копии**, иначе движки открывают исходную БД. Проверить ссылки
перед запуском. Затем `python parallel.py --candidate query --pairs 3 --label parallel-query`.
Один поток на каждый CH, общий барьер; инициализация движков не входит во время.
Это конкурирующие локальные процессы, а не общий корпоративный CH-кластер.

Не запускать `--prepare` на корпоративных таблицах. Встроенная проверка ограничивает
подготовку каталогом TP_SQL_STUDY; используйте только специально созданный стенд.

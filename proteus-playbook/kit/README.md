# kit — инструменты стенда Proteus

**Зачем.** Это общие инструменты для любого борда в Proteus. Они проверяют поставку до того, как владелец вставит её
руками: что Superset 2.0.1 сделает с SQL датасета до ClickHouse, пройдёт ли SQL сохранение, сколько стоит разбор, как
собрать папку поставки и как сжать и проверить JS чарта. Правила, на которых они построены, описаны в главах:
02-superset-path.md (SP), 03-access-cache.md (AC), 04-clickhouse.md (CH), 13-stand.md (ST) и 14-delivery.md (DV).
Результаты прогонов на четырёх проектах лежат в [RESULTS.md](RESULTS.md) (Python) и [RESULTS.js.md](RESULTS.js.md) (JS).

| Файл | Что делает | Правила |
|---|---|---|
| `setup.sh` | venv на Python 3.12 с версиями боя; второй venv с sqlparse 0.4.4; node-пакеты (terser, eslint, playwright) | ST-01 |
| `superset201.py` | путь Superset 2.0.1 над SQL датасета: рендер, ключ кэша, strip_comments, обёртка, reindent, бюджеты, враждебный ввод, сверка на chdb | SP-01…SP-23, AC-07…AC-09, ST-12…ST-17 |
| `sqlgate.py` | гейт сохранения и SQL Lab: sqlglot 23–30, алиас в GROUP BY, `\x`, кортежный CAST, SETTINGS/FORMAT/`;`, лексер, `system` | SP-04, SP-09, SP-12, CH-04, CH-17, PL-04, ST-15, ST-32 |
| `pack_template.py` | шаблон сборщика папки поставки: COPIES, сжатие JS, id чартов, штамп, `--check`, `--gate` | DV-03…DV-06, DV-09, DV-24 |
| `min.cjs`, `eslint.chart.cjs`, `board-check.js`, `sbx/` | JS: сжатие, no-undef, разметка борда, модель песочницы | раздел «JS» ниже |

Скратч (миры chdb, дампы, логи) держите вне репозиториев. Данные боя в kit не кладите (AC-16).

---

## Установка

```bash
bash kit/setup.sh                     # ~/.venvs/proteus-kit и ~/.venvs/proteus-sp044, node-пакеты глобально
KIT_VENV=/путь SP044_VENV=/путь bash kit/setup.sh
SP044=0 bash kit/setup.sh             # без второго venv
NPM=0 bash kit/setup.sh               # без node-пакетов
BROWSER=1 bash kit/setup.sh           # ещё и Chromium для kit/sbx (≈150 МБ)
```

Скрипт берёт `uv`, если он есть, иначе `python3.12 -m venv`. В конце он печатает версии и `SELECT version()` из chdb.
Должно быть `24.8.4.1`, `true` (новый анализатор), `262144` (`max_query_size`).

| Пакет | Версия | Почему |
|---|---|---|
| chdb | 2.1.1 | = ClickHouse 24.8.4.1 (в бою 24.8.15.1). 3.0–3.2 — тоже 24.8, а 4.x — уже 26.x и годится только вторым движком (ST-01) |
| sqlparse | 0.3.0 | Superset 2.0.1: `sqlparse==0.3.0  # PINNED!`. Патч лексера Superset ставит `superset201.py` |
| sqlparse (второй venv) | 0.4.4 | вторая модель: Superset 2.1.3 / 3.0 с тем же литералом. Бой adoption ведёт себя так (RESULTS.md, п. 4) |
| jinja2 / markupsafe | 3.0.3 / 2.0.1 | как в `requirements/base.txt` 2.0.1; на Python 3.12 ставятся (проверено 08.10). Не встанут — скрипт возьмёт jinja2 3.0.x/3.1 и скажет об этом |
| sqlglot | 26.33.0 | модель проверки форка «Некорректный SQL запрос». Версии 23–30 дают тот же отказ на алиасе в GROUP BY. Версии < 15 не годятся: они не знают `CAST(x, 'T')` и роняют рабочие датасеты |
| pyyaml, psycopg2-binary | любые | выгрузки Proteus (YAML) и стенд GP на PostgreSQL 16 |
| terser / eslint / playwright | 5.51.2 / 10.1.0 / 1.56.1 | версии закреплены: с другим terser `pack --check` расходится |

Другие версии sqlglot ставьте каталогом, а не в venv: `pip install --target ~/sg/23.17.0 sqlglot==23.17.0`.
Затем передайте их в `sqlgate.py --sqlglot-dirs ~/sg/23.17.0,~/sg/30.0.0`.

---

## Python

### superset201.py — путь Superset 2.0.1 над SQL датасета

Повторяет исходник 2.0.1 буквально:
- `jinja_context.py`: `SandboxedEnvironment(undefined=DebugUndefined)`, `safe_proxy`, `ExtraCache`, `where_in`;
- `sql_parse.py`: патч лексера и `ParsedQuery`;
- `connectors/sqla/models.py`: `get_rendered_sql`, `get_from_clause`, `get_query_str_extended`, `get_df`;
- `connectors/sqla/utils.py`: сохранение и синхронизация столбцов.

Для каждого варианта рендера инструмент печатает:

1. **Сохранение** (AlwaysTrueObject, логин сохраняющего). Нет `strip_comments`, «только SELECT», одна инструкция, затем
   текст + `"\nLIMIT 1000"`. С `--run` этот текст исполняется на chdb (SP-05).
2. **Открытие** (`--user`, `--filters`, `--url-params`). Шаги `strip('\t\r\n; ')` → `format(strip_comments)` → `split` →
   `ParsedQuery` / «только чтение» → обёртка `SELECT <Измерения> FROM (…) AS virtual_table GROUP BY <Измерения> LIMIT N`
   → `format(reindent)` → `parse_sql` (SP-01, SP-13). Если носитель — колонка датасета, к обёртке добавляется
   `WHERE … IN` (SP-14).
3. **Размеры и бюджеты.** КБ рендера, датасета, обёртки и текста после reindent. Токены лексера, «(» по тексту и по
   лексеру, глубина скобок. Время каждого шага. Жёсткие пределы: `max_query_size` 262 144 Б после reindent,
   токенов < 10 000, глубина < 100 (SP-15…SP-17). Мягкие ориентиры: reindent ≤ 1 с, разбор ради ключа ≤ 0,5 с.
4. **Ключ кэша.** `ExtraCache.regex` 2.0–4.0 и 4.1+ по сырому тексту и по тексту без `{# #}` (SP-20, AC-07…AC-09).
   Инструмент показывает, какие значения при рендере попали в ключ, и выносит вердикт: «личный», «общий», «рендер
   впустую» или **«ОПАСНО»** — вызов есть, а регулярка его не видит, и ответ одного пользователя уйдёт другому. Тут же —
   цена в Superset: холодное открытие (POST + воркер + забор `qc-…`) и открытие из кэша (SP-22).
5. **Лексер.** Видит ли sqlparse строки так же, как ClickHouse (sqlglot), и убрал ли `strip_comments` только
   комментарии (SP-12).
6. **`--run`.** Прямой запуск отрендеренного текста против текста после пути. Сравнивается множество строк по
   «Измерениям», потому что GROUP BY схлопывает дубли и не держит порядок. Если ответ разный, прямой запуск повторяется
   ещё раз: ответ может быть недетерминирован, тогда сверка невозможна, и это отдельная находка.
7. **`--hostile`.** Значения носителей и параметров адреса получают хвост из набора `O'Brien; x`, `a]b`, `x -- y`,
   `x // y`, `# x`, `a\`, `a;b`, `Отдел «Альфа» — 1`. Если носитель шаблон спрашивает, а вы его не задали, туда
   подставляется сам хвост. Проверка: одна инструкция, лексер в фазе, ответ на chdb тот же. Ошибки, которые уже есть
   при открытии, не повторяются (SP-11, ST-14).

```bash
PY=~/.venvs/proteus-kit/bin/python          # модель 0.3.0 + патч 2.0.1
PY44=~/.venvs/proteus-sp044/bin/python      # модель 0.4.4 + патч 2.1.3 / 3.0 — гоняйте и её

# личный датасет (логин в ключе), колонки — из верхнего SELECT, исполнение на мире стенда
$PY kit/superset201.py proteus/report.data.sql --user b.kotov --cols auto --run --db stand/.chdb24 --hostile

# 5 колонок, носители из файла, параметр адреса, функция, которой нет в chdb 2.1.1
$PY kit/superset201.py "Поставка/1. Датасет.sql" --user a.user --cols role,k,v,n,j \
    --filters @stand/worst.json --url-params '{"dl_f": "flt:office_desc=Офис 1"}' \
    --run --db stand/.db --ch-sub 'base64Encode\(=>(' --matrix

# только сохранение; JSON для регресса; тексты шагов — в скратч
$PY kit/superset201.py dataset.sql --save-only --json > /tmp/ss.json
$PY kit/superset201.py dataset.sql --dump /tmp/ss_dump --open-only
```

Флаги: `--limit` (лимит строк чарта, 50 000), `--no-groupby` (обёртка без GROUP BY для сравнения), `--settings`
(можно несколько) или `--matrix` (новый анализатор, старый, новый с `join_use_nulls`/`prefer_column_name_to_alias`/
`group_by_use_nulls` — CH-03), `--extra-text` (предикат автозаполнения, WHERE/HAVING чарта, RLS — их тоже читает
регулярка ключа), `--no-patch` (лексер без патча Superset), `--max-reindent-s`, `--max-key-s`.
Код выхода: 0 — чисто, 1 — ошибка пути, лексера, бюджета или сверки, 2 — ошибка вызова.

**Модулем** — из своего `stand/check.py`, чтобы каждый вариант регресса шёл путём Superset (ST-12):

```python
import sys; sys.path.insert(0, '<playbook>/kit')
import superset201 as ss
ss.lexer_patch()                                            # до первого разбора
r = ss.render(text, user='a.user', filters={'unit_f': ['u1']}, url_params={}, save=False)
p = ss.chart_path(r.text, ['role', 'k', 'v', 'n', 'j'])     # p['error'], p['steps'], p['texts']['executed']
assert not p['error'] and not ss.lexer_problems(r.text)
rows, sec, err = ss.ch_run(p['texts']['executed'], db='stand/.db')
key = ss.cache_key_report(text, r)                          # вердикт ключа и значения в нём
```

**Чего модель не знает:**
- `SQL_QUERY_MUTATOR` форка;
- RLS;
- точный экран диалекта у `url_param(escape_result=True)` — моделируется удвоением кавычки, это вывод;
- собственную проверку форка при сохранении — её закрывает `sqlgate.py`;
- версию sqlparse в бою — поэтому моделей две.

На стенде есть поправки к chdb (ST-21):
- `base64Encode` нет — заменяется через `--ch-sub`;
- длинное и короткое тире в тексте запроса chdb превращает в `--`, поэтому значения с тире на стенде не проверить.

### sqlgate.py — гейт сохранения и SQL Lab

```bash
$PY kit/sqlgate.py proteus/report.data.sql --user a.user --cols auto \
    --sqlglot-dirs ~/sg/23.17.0,~/sg/25.34.0,~/sg/28.10.0,~/sg/30.0.0
$PY kit/sqlgate.py --sqllab "Поставка/10. Проверка на бою.sql" "Поставка/0. Инструкция.md"
```

Для датасета проверяются три текста:
- **сохранение** — AlwaysTrue, и тот же текст с `LIMIT 1000`;
- **открытие** — `--user`, `--filters`, `--url-params`;
- **обёртка чарта**.

В каждом тексте ищутся:
- ошибка разбора sqlglot в формате форка «…→место←…»;
- больше одного оператора или не запрос;
- алиас в GROUP BY — ищется по токенам, даже если sqlglot его пропустил (SP-04);
- `\x..` в литерале (SP-09);
- кортежный тип строкой в CAST (CH-17);
- SETTINGS, FORMAT, `;` в середине, `AS MATERIALIZED` (CH-04);
- остатки Jinja;
- сбой лексера sqlparse (SP-12).

Одна и та же причина в нескольких вариантах печатается одной строкой, варианты — в скобках.

**`--sqllab`** проверяет файл для SQL Lab (PL-04, ST-32). Из `.md` берутся блоки ```sql. Проверки:
- слово `system` в любом месте, даже в комментарии, — ошибка;
- `SHOW` — ошибка;
- `REPLACE` — предупреждение: отказ на нём боем не подтверждён;
- один запрос: если в файле сборник, каждый запрос проверяется отдельно, а на файл выдаётся предупреждение;
- первым словом SELECT или DESCRIBE; WITH — предупреждение, не проверено в бою;
- **`LIMIT N BY` на верхнем уровне** — ошибка. SQL Lab 2.0.1 считает его лимитом строк: `query.limit = min(N, окно)`,
  затем LIMIT заменяется на N + 1, и на экране остаётся N строк всего ответа (`sqllab/command.py`, `sql_lab.py`;
  [исходник 2.0.1][не проверено в бою]). Обычный `LIMIT N` безвреден.

### pack_template.py — шаблон сборщика папки поставки

Скопируйте файл в `stand/pack.py` проекта и заполните блок «НАСТРОЙКИ»: `REPORT`, `DELIVERY`, `DATE` (дату — руками,
иначе `--check` разойдётся на следующий день), `BOARD_IDS` и `COPIES`.

COPIES — это кортежи `(исходник, «N. Название.ext», вид, [(строка, замена)], [флаги min.cjs])`. Подстановка варианта
(DV-04) требует, чтобы строка встречалась в исходнике ровно один раз. Виды:

| Вид | Что делает сборщик | Шапка |
|---|---|---|
| `dataset` | `{% set BUILD = '…' %}` → поставка/дата/sha12 (для эха в `meta.build`, DV-09) | `{# … #}` (в SQL не попадает) |
| `sqllab` | падает на `system` и `SHOW` | `-- …` |
| `js` | `node kit/min.cjs 'шапка' --check --budget КБ --kbps 50` + `node --check`; печатает КБ и секунды отправки (DV-06) | preamble terser |
| `css` | заглушки `chart-id-000000…` → id из `BOARD_IDS`; нет id — заглушка остаётся, и шапка просит Ctrl+H (DV-24, DV-05) | `/* … */` |
| `snippet` | то же целым словом (сниппет DevTools, DV-30) | `// …` |
| `json` | проверка `json.loads`, без шапки | — |
| `py`, `raw` | шапка `#` / байт в байт | — |

```bash
python3 stand/pack.py            # пишет только изменившиеся файлы; печатает «файл → новый / записан / без изменений»
python3 stand/pack.py --check    # ничего не пишет; «ok / РАЗНЫЕ / НЕТ»; код 1, если хоть один разошёлся
PLAYBOOK_PY=~/.venvs/proteus-kit/bin/python python3 stand/pack.py --gate   # + kit/sqlgate.py по SQL поставки
```

Строка «Заменить в «Что нового»» — готовый список файлов для раздела инструкции (DV-11). Где лежит kit: переменная
`PLAYBOOK_KIT`, по умолчанию `<корень>/kit`.

### Проверка в бою: какой лексер у Proteus

Это два запроса для SQL Lab, по одному на выполнение. В них нет `system`. [вывод][не проверено в бою]

```sql
SELECT length(['x', '[y]']) AS n, 'a -- b' AS s
```
- sqlparse 0.3.0 (с патчем или без) читает `['x', '[y]` как имя T-SQL, принимает `-- b' AS s` за комментарий и
  вырезает его. Ожидание: синтаксическая ошибка ClickHouse.
- sqlparse ≥ 0.4.3. Ожидание: `n = 2`, `s = 'a -- b'`.

```sql
SELECT 'O\'K; c' AS t
```
- Патч Superset стоит (любая версия 2.0–3.x). Ожидание: две инструкции, ошибка.
- Патча нет. Ожидание: `t = O'K; c`.

Если первый запрос ответил `2` и `a -- b`, бой работает как второй venv (0.4.4). Тогда модель 0.3.0 нужна только как
запас.

---

## JS (min.cjs, eslint, board-check, sbx)

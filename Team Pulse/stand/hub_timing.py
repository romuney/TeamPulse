# Файл «где время» для датасета 2а (поставки 52–53, гайд DV-28 / PL-05) и замер того же на стенде масштаба.
#
#   ~/.venvs/proteus-kit/bin/python stand/hub_timing.py [--old <прежний 2а>]          # собрать файл 8б
#   ~/.venvs/proteus-kit/bin/python stand/hub_timing.py --run <db> [--old …]           # + исполнить блоки на chdb
#   ~/.venvs/proteus-kit/bin/python stand/hub_timing.py --bench <db> [--old …]         # путь Proteus целиком в шапку
#
# <db> — каталог chdb с таблицами teampulse_hub_* (stand/hub_scale.py — масштаб боя, ноутбук стенда — малый).
# Венв kit (kit/setup.sh): рендер Jinja и разбор sqlparse — как в Proteus (proteus-playbook/kit/superset201.py).
# --old — прежний текст 2а (до поставки 53: git show 4aa6bdb:"Team Pulse/Поставка — TeamPulse Hub/2а. …"):
# его блоки идут вперемешку с новыми, чтобы сравнить в одной сессии SQL Lab (A/B, гайд ST-18).
#
# Блоки 8б — по одному SELECT, без Jinja и без запретных слов SQL Lab (PL-04):
#   1  версия, настройки ClickHouse, строки и узлы кластера каждой таблицы
#   2  датасет как его исполняет чарт (обёртка Proteus с GROUP BY) — компания, без фильтров
#   3  то же прежним 2а (с --old)
#   4  команда + покраска HQ: узел 7-го уровня с наибольшим числом подразделений (подбор внутри запроса)
#   5  то же прежним 2а (с --old)
#   6  команда без фильтров
#   7  компания, но таблицы фактов пустые (WHERE 0) — время разбора и плана без чтения
# Ответ каждого блока свёрнут до «роль → строк, КБ»: ClickHouse считает все колонки (длины), а в SQL Lab
# не едут мегабайты.
import argparse, json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'proteus-playbook', 'kit'))
import superset201 as k                                     # noqa: E402
import sqlparse                                             # noqa: E402

DIR = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub')
SRC = os.path.join(DIR, '2а. Proteus — датасет на таблицах ноутбука.sql')
OUT = os.path.join(DIR, '8б. SQL Lab — где время, датасет 2а.sql')
TEAM = '__TP_TEAM__'
# команда — внутри запроса: узел 7-го уровня с наибольшим числом подразделений (в бою 1 846 узлов 7-го уровня)
TEAM_SQL = ("(SELECT argMax(ifNull(unit_rk, ''), toUInt32(ifNull(kids_cnt, 0))) FROM prod_proteus.teampulse_hub_unit "
            "WHERE unit_lvl = 7)")
FACTS = ['series', 'mix', 'trf', 'vacancy', 'ai']
PROD = 'allow_experimental_analyzer = 1, prefer_column_name_to_alias = 1'
SETTINGS = ['allow_experimental_analyzer', 'max_threads', 'max_execution_time', 'max_memory_usage', 'max_memory_usage_for_user',
            'max_bytes_before_external_group_by', 'max_concurrent_queries_for_user', 'max_result_bytes', 'use_uncompressed_cache',
            'use_query_cache', 'load_balancing', 'readonly', 'prefer_column_name_to_alias', 'join_use_nulls', 'group_by_use_nulls',
            'max_query_size', 'max_parser_depth', 'max_ast_elements', 'max_expanded_ast_elements']
TABLES = ['meta', 'unit', 'series', 'mix', 'trf', 'vacancy', 'ai']


def cols(src):
    """«Измерения» датасета — колонки его верхнего SELECT (2а до поставки 53 — 34 колонки m_* циклом по M, с 53 — 9)"""
    text = open(src).read()
    m = re.search(r'^SELECT (role, [^\n{]+)\nFROM', text, re.M)
    if m:
        return [c.strip() for c in m.group(1).split(',')]
    mk = re.search(r"{% set M = \[(.+?)\] %}", text).group(1)
    return ['role', 'id', 'pid', 'lvl', 'nm', 'kids', 'j'] + ['m_' + x for x in re.findall(r"\['(\w+)', '", mk)] + ['mx']


def dataset(filters, wrap=True, src=SRC):
    """Текст, который ClickHouse получает от чарта: рендер → strip_comments → обёртка (без reindent: на план
    ClickHouse пробелы не влияют, а текст в SQL Lab вдвое короче)."""
    cs = cols(src)
    r = k.render(open(src).read(), user='a.user', filters=filters, columns=cs)
    assert not r.error, r.error
    k.lexer_patch()
    sql = sqlparse.format(r.text.strip('\t\r\n; '), strip_comments=True)
    return k.wrap(sql, cs, 50000, True, None) if wrap else sql


def collapse(sql, label, src=SRC):
    size = ' + '.join(f'length({c})' for c in cols(src) if c not in ('lvl', 'kids'))
    return (f"SELECT 1 AS run, '{label}' AS block, role, count() AS rows_n, round(sum({size}) / 1024) AS kb,\n"
            f"       any(if(role = 'scope', concat(id, ' · уровень ', toString(lvl), ' · подразделений ', toString(kids)), '')) AS scope\n"
            f"FROM (\n{sql}\n)\nGROUP BY role\nORDER BY kb DESC")


def info():
    st = ',\n        '.join(f"('{s}', toString(getSetting('{s}')))" for s in SETTINGS)
    tb = '\n'.join(f"  UNION ALL SELECT '3 таблица', 'teampulse_hub_{t}', concat(toString(count()), ' строк · узлов кластера ', "
                   f"toString(uniqExact(hostName()))) FROM prod_proteus.teampulse_hub_{t}" for t in TABLES)
    return (f"SELECT 1 AS run, part, metric, value\nFROM (\n"
            f"  SELECT '1 ClickHouse' AS part, 'версия' AS metric, version() AS value\n"
            f"  UNION ALL SELECT '1 ClickHouse', 'без перезапуска', formatReadableTimeDelta(uptime())\n"
            f"  UNION ALL SELECT '2 настройка', s.1, s.2 FROM (SELECT arrayJoin([\n        {st}]) AS s)\n{tb}\n)\n"
            f"ORDER BY part, metric")


def blocks(old=None):
    team = lambda f, src=SRC: dataset(f, src=src).replace(f"'{TEAM}'", TEAM_SQL)
    company = dataset({})
    plan = company
    for t in FACTS:
        plan = plan.replace(f'FROM prod_proteus.teampulse_hub_{t}', f'FROM (SELECT * FROM prod_proteus.teampulse_hub_{t} WHERE 0)')
    hq = {'unit_f': [TEAM], 'paint_f': ['HQ']}
    b = [('1', 'версия, настройки, таблицы', info()),
         ('2', 'компания (первое открытие)', collapse(company, '2 компания'))]
    if old:
        b.append(('3', 'компания — прежний 2а', collapse(dataset({}, src=old), '3 компания, прежний', old)))
    b.append(('4', 'команда + HQ', collapse(team(hq), '4 команда + HQ')))
    if old:
        b.append(('5', 'команда + HQ — прежний 2а', collapse(team(hq, old), '5 команда + HQ, прежний', old)))
    b += [('6', 'команда', collapse(team({'unit_f': [TEAM]}), '6 команда')),
          ('7', 'компания, таблицы фактов пустые — только разбор и план', collapse(plan, '7 только план'))]
    assert all(TEAM not in s for _, _, s in b) and all(TEAM_SQL in s for n, _, s in b if n in '456')
    return b


HEAD = """-- ============================================================================
-- 8б. SQL Lab — где время: датасет 2а (поставка 53). {nb} блоков, каждый — один SELECT.
-- Как запускать: вставить файл в SQL Lab (база ClickHouse, где prod_proteus) → выделить мышью один блок
-- от строки «-- Блок N» до «;» → Run (с выделением запускается только оно) → записать время из строки
-- результата (например 00:00:04.21). Так по очереди все блоки, по порядку.
--   Повтор (если есть 5 минут): все блоки, кроме первого, ещё раз, заменив в первой строке блока «1 AS run»
--   на «2 AS run» — метка внутри запроса, иначе повтор может прийти из кеша.
--   Прислать: время каждого прогона (блок · прогон · секунды) и таблицы ответов (они маленькие: роль, строк,
--   КБ; в блоке 1 — версия, настройки, строки таблиц). Имён и чисел людей в ответах нет.
-- Что меряем: время ответа SQL Lab = разбор текста в SQL Lab + план ClickHouse + чтение.
--   {ab}
--   2 − 7  ≈ чтение таблиц (план у них одинаковый)     7 − 1  ≈ разбор текста и план
-- Стенд масштаба боя (stand/hub_scale.py: 11 932 узла, series 1,3 млн строк, ClickHouse 24.8):
{bench}
-- Команда в блоках 4–6 подбирается внутри запроса (узел 7-го уровня с наибольшим числом подразделений):
-- какая — в колонке scope. Только читает; собран stand/hub_timing.py из файла 2а.
-- ============================================================================
"""


def build(bench_note=None, old=None):
    if bench_note is None:
        # без --bench — замер стенда из прежней шапки 8б, чтобы пересборка его не стирала
        old = open(OUT).read() if os.path.exists(OUT) else ''
        m = re.search(r'ClickHouse 24\.8\):\n((?:--   .*\n)+)', old)
        bench_note = m.group(1).rstrip('\n') if m else '--   (замер стенда не приложен: --bench <db>)'
    bl = blocks(old)
    ab = ('2 против 3 и 4 против 5 — новый 2а против прежнего на одних данных и в одну сессию; ответы (строк, КБ)\n'
          '--   должны совпасть, кроме разбивки КБ: метрики теперь в одной колонке' if old else
          '4 и 6 против 2 — сколько добавляет выбор команды и фильтр')
    out = [HEAD.format(bench=bench_note, nb=len(bl), ab=ab)]
    for n, title, sql in bl:
        out.append(f'-- Блок {n} — {title}\n{sql}\n;\n')
    text = '\n'.join(out)
    low = text.lower()
    # SQL Lab Proteus: только SELECT / DESCRIBE, без слов system и SHOW даже в комментариях (PL-04)
    assert 'system' not in low and not re.search(r'\bshow\b', low) and not re.search(r'\*\s*replace\s*\(', low)
    for part in re.split(r'(?m)^;\s*$', text):
        code = re.sub(r'(?m)^\s*--.*$', '', part).strip()
        assert not code or code.lower().startswith('select'), code[:60]
    open(OUT, 'w').write(text)
    return text


def ch(db):
    from chdb import session
    s = session.Session(db)

    def q(sql, fmt='JSONCompact'):
        t0 = time.perf_counter()
        r = s.query(sql.rstrip().rstrip(';') + '\nSETTINGS ' + PROD, fmt)
        return time.perf_counter() - t0, r.bytes()
    return q


def run(db, old=None):
    q = ch(db)
    for n, title, sql in blocks(old):
        q(sql)                                             # прогрев: первый прогон после заливки не в счёт (ST-18)
        dt = min(q(sql)[0] for _ in range(3))
        rows = json.loads(q(sql)[1])['data']
        brief = '' if n == '1' else ' · '.join(f'{r[2]} {r[3]}/{int(r[4])} КБ' for r in rows)
        print(f'  блок {n}  {dt:5.2f} с  {title}' + (f'  [{brief}]' if brief else ''))


def bench(db, old=None):
    """Путь Proteus целиком на стенде: разбор текста (модель kit) + ClickHouse (план и исполнение) + ответ."""
    q = ch(db)
    team = json.loads(q(TEAM_SQL[1:-1])[1])['data'][0][0]
    lines = []
    cases = [('компания', {}, SRC), ('команда', {'unit_f': [team]}, SRC), ('команда + HQ', {'unit_f': [team], 'paint_f': ['HQ']}, SRC)]
    if old:
        cases = [(n + ', было', f, old) for n, f, _ in cases] + [(n + ', стало', f, s) for n, f, s in cases]
    for name, f, src in cases:
        cs = cols(src)
        r = k.render(open(src).read(), user='a.user', filters=f, columns=cs)
        cp = k.chart_path(r.text, cs)
        assert not cp['error'], cp['error']
        sql = cp['texts']['final']
        q(sql)
        ex = min(q(sql)[0] for _ in range(3))
        pl = min(q('EXPLAIN PLAN ' + sql, 'TSV')[0] for _ in range(2))
        _, b = q(sql)
        c = lambda x: f'{x:4.1f}'.replace('.', ',')
        lines.append(f'--   {name:20s} разбор текста Proteus {c(sum(cp["steps"].values()))} с · ClickHouse {c(ex)} с '
                     f'(из них план {c(pl)} с) · ответ {c(len(b) / 1024 / 1024)} МБ')
    return '\n'.join(lines)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', help='каталог chdb: исполнить блоки 8б')
    ap.add_argument('--bench', help='каталог chdb: путь Proteus целиком, вписать итог в шапку 8б')
    ap.add_argument('--old', help='прежний текст 2а: его блоки — рядом с новыми')
    a = ap.parse_args()
    note = bench(a.bench, a.old) if a.bench else None
    if note:
        print(note)
    text = build(note, a.old)
    print(f'{os.path.basename(OUT)}: {len(text.encode()) / 1024:.1f} КБ')
    if a.run:
        run(a.run, a.old)
    sys.stdout.flush()
    os._exit(0)

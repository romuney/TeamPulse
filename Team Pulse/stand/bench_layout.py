# Замер предложения «Предложения — физическая таблица под датасет.md» (папка поставки):
# нынешняя таблица + файл 2 против двух раскладок физики под виртуальный датасет.
#
#   python3 stand/bench_layout.py <hso.csv из sim_hso.py> <папка> [копий, 25]
#
# 1. Стенд в масштабе боя: таблица симуляции × N копий веток уровня 3 и ниже
#    (25 копий — 2,4 млн строк, как в бою; юнитов и уровней меньше, чем в бою).
# 2. Таблицы предложения — SQL из приложения файла предложений, как есть (проверяется
#    ровно тот текст, что читает владелец витрины).
# 3. Датасеты под них — из файла 2 заменой головы (календарь, дерево, строки по узлам):
#    A — факт с путём ключами (hr_fact), Б — свёртка по узлам (hr_fact_node).
# 4. Ответ A и Б против файла 2 — байт в байт; время, чтения таблиц в плане, длина SQL.
import collections, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dataset
from dataset import CFG
from chdb import session

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub')
DOC = os.path.join(DIR, 'Предложения — физическая таблица под датасет.md')
FILE2 = dataset.SQL
BOJ = 'allow_experimental_analyzer = 1, prefer_column_name_to_alias = 1'


def scale(db, csv_path, k):
    src = open(os.path.join(HERE, 'load_hso.py'), encoding='utf-8').read()
    schema = re.search(r'SCHEMA = f"""(.*?)"""', src, re.S).group(1)
    schema = schema.replace('{LVL}', ', '.join(f'lvl{i}_nm Nullable(String)' for i in range(1, 12)))
    s = session.Session(db)
    s.query('CREATE DATABASE IF NOT EXISTS prod_proteus')
    s.query('DROP TABLE IF EXISTS prod_proteus.hr_structure_overall')
    s.query(f'CREATE TABLE prod_proteus.hr_structure_overall ({schema}) ENGINE = MergeTree ORDER BY tuple()')
    cols = [c.strip().split(' ')[0] for c in schema.replace('\n', ' ').split(',') if c.strip()]
    sub = {'mng_unit_rk': "concat(mng_unit_rk, '#', toString(k))", 'lvl3_nm': "concat(lvl3_nm, ' #', toString(k))"}
    sel = ', '.join(f"if(k = 0 OR ifNull(leaf_lvl, 0) < 3, {c}, {sub[c]})" if c in sub else c for c in cols)
    s.query(f"""INSERT INTO prod_proteus.hr_structure_overall
        SELECT {sel} FROM file('{csv_path}', CSV, '{schema}') AS f, (SELECT number AS k FROM numbers({k})) AS n
        WHERE k = 0 OR ifNull(leaf_lvl, 0) >= 3""")
    return s


def build(s):
    doc = open(DOC, encoding='utf-8').read()
    sql = doc[doc.index('## Приложение'):]
    sql = sql[sql.index('```sql') + 6:]
    sql = sql[:sql.index('```')]
    for t in ('hr_fact_node', 'hr_fact', 'hr_unit', 'hr_unit_path', 'hr_calendar'):
        s.query(f'DROP TABLE IF EXISTS prod_proteus.{t}')
    for st in (x for x in sql.split(';') if 'CREATE TABLE' in x):
        name = st[st.index('CREATE TABLE') + 13:].split()[0]
        t = time.time()
        s.query(st)
        n = str(s.query(f'SELECT count() FROM {name}', 'TSV')).strip()
        print(f'  {name:30} {time.time() - t:5.1f} с · строк {n}')


COLS = """toInt32(dateDiff('month', (SELECT m0 FROM cal), report_month)) AS i1,
           gender AS g1, type_age AS a1, experience_group_nm AS t1, grade AS gr1, seniority AS s1,
           employee_contract_type AS c1, legal_organization AS o1, employee_stream AS w1,
           employment_relation_type AS r1, fire_reason_group AS fr1, fire_initiative AS fi1,
           hc_total_cnt AS e, hc_active_cnt AS ea, toFloat64(0) AS sa, hire_amt AS hi, fire_amt AS fi,
           regret_fire_amt AS rg, transfer_in_amt AS ti, transfer_out_amt AS tu, perf_normal AS pn, perf_low AS pl,
           perf_high AS ph, perf_gray AS pg, work_day_amt AS wd, office_visit_amt AS ov,
           grt_approve_cnt AS ga, grt_decline_cnt AS gd"""
HEAD = """  cal AS (
    SELECT toDate(maxIf(report_month, is_closed = 1)) AS lm, toStartOfYear(addYears(lm, -1)) AS m0,
           toUInt32(dateDiff('month', m0, lm) + 1) AS n, toUInt32(dateDiff('month', m0, toStartOfYear(lm))) AS iy,
           addMonths(m0, -1) AS mp, toUInt8(min(report_month) <= mp) AS hp
    FROM prod_proteus.hr_calendar
  ),
  st AS (SELECT rk, prk, lv, nm FROM prod_proteus.hr_unit),
  st2 AS (SELECT rk, prk, lv, nm, rk AS id, prk AS pid FROM st),
  kd AS (SELECT prk AS kr, toUInt32(count()) AS k FROM st WHERE prk != '' GROUP BY prk),
  rt AS (SELECT argMin(rk, (lv, rk)) AS r FROM st WHERE prk = ''),
  dflt AS (SELECT if(count() = 1, any(rk), (SELECT r FROM rt)) AS d FROM st WHERE prk = (SELECT r FROM rt)),
  req AS (SELECT any(rk) AS q, count() AS c FROM st2 WHERE {% if unit_req %}id = {{ qs(unit_req[0]) }}{% else %}0{% endif %}),
  sc AS (SELECT if(req.c > 0, req.q, dflt.d) AS s FROM req CROSS JOIN dflt),
  d1 AS (SELECT rk FROM st WHERE prk = (SELECT s FROM sc) AND rk != ''),
  d2 AS (SELECT rk FROM st WHERE prk IN (SELECT rk FROM d1)),
  d3 AS (SELECT rk FROM st WHERE prk IN (SELECT rk FROM d2)),
  anc AS (SELECT arrayPopBack(groupArrayArray(path)) AS arr FROM prod_proteus.hr_unit WHERE rk = (SELECT s FROM sc)),
  pick AS (
    SELECT s AS rk, toUInt8(1) AS o FROM sc
    UNION ALL SELECT r AS rk, toUInt8(2) AS o FROM rt
    UNION ALL SELECT rk, toUInt8(5) AS o FROM d1
    UNION ALL SELECT rk, toUInt8(6) AS o FROM d2
    UNION ALL SELECT rk, toUInt8(7) AS o FROM d3
  ),
"""
B0 = {
    'A': f"""  b0 AS (
    SELECT u1, {COLS}
    FROM prod_proteus.hr_fact
    ARRAY JOIN arrayFilter(x -> has((SELECT groupArray(rk) FROM pick), x), cur_path) AS u1
    WHERE report_month BETWEEN (SELECT mp FROM cal) AND (SELECT lm FROM cal) AND {{{{ cond() }}}}
  ),
""",
    'B': f"""  b0 AS (
    SELECT node_rk AS u1, {COLS}
    FROM prod_proteus.hr_fact_node
    WHERE node_rk IN (SELECT rk FROM pick)
      AND report_month BETWEEN (SELECT mp FROM cal) AND (SELECT lm FROM cal) AND {{{{ cond() }}}}
  ),
"""}


def variants(out):
    src = open(FILE2, encoding='utf-8').read()
    a, b = src.index('  -- Календарь: последний полный месяц'), src.index('  -- Месяц × юнит; нулевая строка')
    paths = {}
    for k, b0 in B0.items():
        v = src[:a] + HEAD + b0 + src[b:]
        v = v.replace('''"ifNull(emp_specialization_it_code, '-')"''', '"emp_specialization_it_code"')
        v = v.replace("SELECT ifNull(emp_specialization_it_code, '-') AS v,", 'SELECT emp_specialization_it_code AS v,')
        v = v.replace("\n                      AND (ifNull(mng_unit_rk, ''), {{ pth() }}) IN (SELECT u0, pk0 FROM lmr)", '')
        v = v.replace('FROM prod_proteus.hr_structure_overall\n                    WHERE report_month = (SELECT lm FROM cal)',
                      'FROM prod_proteus.hr_fact\n                    WHERE report_month = (SELECT lm FROM cal)')
        body = v[v.index('SELECT role'):]
        assert 'hr_structure_overall' not in body, k
        paths[k] = os.path.join(out, f'dataset_{k}.sql')
        open(paths[k], 'w', encoding='utf-8').write(v)
    return paths


def run(s, path, flt, st=BOJ, tries=2):
    dataset.SQL = path
    q = dataset.render(flt).strip().rstrip(';')
    best, out = 1e9, ''
    for _ in range(tries):
        t = time.time()
        out = str(s.query(q + ('\nSETTINGS ' + st if st else ''), 'TSV'))
        best = min(best, time.time() - t)
    return out, best, q


def main():
    csv_path, out = sys.argv[1], sys.argv[2]
    k = int(sys.argv[3]) if len(sys.argv) > 3 else 25
    os.makedirs(out, exist_ok=True)
    s = scale(os.path.join(out, 'db'), csv_path, k)
    print(str(s.query("""SELECT 'стенд: строк', count(), 'юнитов', uniqExact(mng_unit_rk), 'месяцев', uniqExact(report_month)
                         FROM prod_proteus.hr_structure_overall""", 'TSV')).strip().replace('\t', ' '))
    print('таблицы предложения (SQL из приложения):')
    build(s)
    P = {'сейчас': FILE2, **variants(out)}
    base, _, _ = run(s, FILE2, {}, tries=1)
    mid = [l.split('\t')[1] for l in base.splitlines() if l.split('\t')[0] == 'c'][0]
    cases = [('без фильтров', {}), ('IT', {'it_f': ['IT']}), ('штат', {'staff_f': ['Штат']}),
             ('юнит уровнем ниже', {'unit_f': [mid]}), ('IT + штат', {'it_f': ['IT'], 'staff_f': ['Штат']})]
    ok = True
    print(f"{'':20}" + ''.join(f'{n:>12}' for n in P))
    for name, flt in cases:
        res = {n: run(s, p, flt) for n, p in P.items()}
        same = all(r[0] == res['сейчас'][0] for r in res.values())
        ok &= same
        print(f'{name:20}' + ''.join(f'{r[1]:>10.2f} с' for r in res.values()) + ('   ответ тот же' if same else '   РАЗНИЦА'))
    flt = cases[-1][1]
    for n, p in P.items():
        outs, tm = set(), []
        for cname, st in CFG.items():
            o, t, _ = run(s, p, flt, st, tries=1)
            outs.add(o)
            tm.append(f'{t:.1f}')
        q = run(s, p, {}, tries=1)[2]
        plan = str(s.query('EXPLAIN PLAN ' + q + '\nSETTINGS allow_experimental_analyzer = 1', 'TSV'))
        reads = collections.Counter(re.findall(r'ReadFromMergeTree \(prod_proteus\.([^)]*)\)', plan))
        print(f'{n:7} 6 настроек: ответов {len(outs)}, с {" / ".join(tm)} · чтений в плане {dict(reads)} · SQL {len(q)} знаков')
        ok &= len(outs) == 1
    print('ИТОГ:', 'ответ тот же' if ok else 'есть расхождения')
    return ok


if __name__ == '__main__':
    sys.exit(0 if main() else 1)

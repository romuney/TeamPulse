# Стенд датасета teampulse_hub: шаблон Jinja → SQL → ClickHouse 24.8 (chdb).
#
#   python dataset.py DB [--unit ID] [--staff Штат]                         — ответ строками
#   python dataset.py DB --check                                            — полная сверка
#
# DB — папка chdb с prod_proteus.hr_structure_overall (sim_hso.py + load_hso.py), схема 16.10.2026 (49 колонок).
# Правда «прямо по таблице» склейки не повторяет: юнит — строки ОДНОГО его пути, простая сумма.
# Так сверка ловит и копии строк юнита с двумя родителями, и атрибут, которого нет в зерне склейки.
# Как в Proteus: filter_values(колонка) — значения кросс-фильтра, current_username() — логин.
# --check гоняет ответ при обоих анализаторах и при join_use_nulls / prefer_column_name_to_alias,
# в том числе в профиле боя (новый анализатор + prefer_column_name_to_alias = 1)
# (ответы обязаны совпасть) и сверяет его с тем, что считается прямо по таблице.
import argparse, hashlib, json, os, sys
import jinja2
from chdb import session

HERE = os.path.dirname(os.path.abspath(__file__))
SQL = os.path.join(HERE, '..', 'Поставка — TeamPulse Hub', '2. Proteus — датасет teampulse_hub.sql')
CFG = {
    'default': '',
    'old analyzer': 'allow_experimental_analyzer = 0',
    'join_use_nulls': 'join_use_nulls = 1',
    'old + nulls + prefer': 'allow_experimental_analyzer = 0, join_use_nulls = 1, prefer_column_name_to_alias = 1, group_by_use_nulls = 1',
    'new + nulls + prefer': 'allow_experimental_analyzer = 1, join_use_nulls = 1, prefer_column_name_to_alias = 1, group_by_use_nulls = 1',
    # профиль боя (SQL Lab владельца, 09.10): ClickHouse 24.8.15.1, новый анализатор, prefer_column_name_to_alias = 1
    'бой (new + prefer)': 'allow_experimental_analyzer = 1, prefer_column_name_to_alias = 1',
}
T = 'prod_proteus.hr_structure_overall'


def render(filters, user='tester'):
    env = jinja2.Environment(extensions=['jinja2.ext.do'])
    tpl = env.from_string(open(SQL, encoding='utf-8').read())
    return tpl.render(filter_values=lambda col: list(filters.get(col, [])),
                      current_username=lambda: user)


def query(s, sql, settings=''):
    """ответ как его получает чарт: записи JSON, по одной на строку"""
    out = str(s.query(sql + ('\nSETTINGS ' + settings if settings else ''), 'JSONEachRow'))
    rows = [json.loads(l) for l in out.splitlines() if l.strip()]
    return out, rows


def uid(rk):
    return hashlib.md5(rk.encode()).hexdigest()[:12]


def run(db, filters, settings=''):
    s = session.Session(db)
    return query(s, render(filters), settings)


KEYS = ['hc', 'act', 'avg', 'hire', 'fire', 'reg', 'tin', 'tout', 'pnor', 'plow', 'phig', 'pgry',
        'wday', 'ovis', 'gapr', 'gdec']
ATTRS = ['gender', 'type_age', 'experience_group_nm', 'grade', 'seniority', 'employee_contract_type',
         'legal_organization', 'employee_stream', 'employment_relation_type', 'fire_reason_group', 'fire_initiative']
LV = ', '.join(f"ifNull(lvl{i}_nm, '')" for i in range(1, 12))
PATH = f"concat({', '.join(f'ifNull(lvl{i}_nm, ' + chr(39) + chr(39) + '), ' + chr(39) + '/' + chr(39) for i in range(1, 12))})"


def arrays(row):
    return {k: [float(x) for x in row['m_' + k].split(',')] for k in KEYS}


def mx_of(row):
    out = {}
    for line in row['mx'].split('\n'):
        if line:
            k, v, n = line.split('\t')
            out.setdefault(k, {})[v] = float(n)
    return out


def tree(s, lm):
    """дерево последнего полного месяца прямо по таблице: путь → родитель (схема 15.10)"""
    paths = {}
    for line in str(s.query(f"""SELECT DISTINCT mng_unit_rk, leaf_lvl, {LV} FROM {T}
                                 WHERE report_month = '{lm}' AND mng_unit_rk IS NOT NULL""", 'TSV')).strip().splitlines():
        f = line.split('\t')
        rk, lv = f[0], int(f[1])
        paths.setdefault(rk, []).append((tuple(f[2:2 + lv]), lv))
    by_path = {}
    for rk, ps in paths.items():
        for p, _ in ps:
            by_path[p] = min(by_path.get(p, rk), rk)
    st = {}
    for rk, ps in paths.items():
        p, lv = min(ps)
        par = by_path.get(p[:-1], '') if lv > 1 else ''
        st[rk] = dict(prk=par, lv=lv, nm=p[-1])
    return st


def check(db):
    s = session.Session(db)
    ok = True

    def fail(msg):
        nonlocal ok
        ok = False
        print('  FAIL', msg)

    lm = str(s.query(f"SELECT if(max(report_month) >= toStartOfMonth(today()), addMonths(max(report_month), -1), max(report_month)) FROM {T}", 'TSV')).strip()
    st = tree(s, lm)
    kids = {}
    for rk, u in st.items():
        kids.setdefault(u['prk'], []).append(rk)
    root = min((rk for rk, u in st.items() if u['prk'] == ''), key=lambda r: st[r]['lv'])
    dflt = kids[root][0] if len(kids.get(root, [])) == 1 else root
    by_id = {uid(rk): rk for rk in st}
    deep = next(rk for rk, u in st.items() if u['lv'] == max(x['lv'] for x in st.values()))
    mid = next(rk for rk in kids.get(dflt, []) if kids.get(rk))
    dup = [n for n in {u['nm'] for u in st.values()} if sum(1 for u in st.values() if u['nm'] == n) > 1]
    print(f'дерево: {len(st)} юнитов, повторов имён {len(dup)} — родитель по полному пути')

    # ряд датасета → колонка таблицы
    DIRECT = {'hc': 'hc_total_cnt', 'act': 'hc_active_cnt', 'avg': 'ssch_hc_active_cnt', 'reg': 'regret_fire_amt',
              'plow': 'perf_low', 'pgry': 'perf_gray', 'wday': 'work_day_amt', 'gapr': 'grt_approve_cnt'}
    grp = ', '.join(ATTRS)

    def one_path(rk, cond, when):
        """строки юнита одного пути (меньшего в каждом месяце) — без склейки по атрибутам"""
        return f"""(SELECT * FROM (SELECT *, {PATH} AS pth_, min({PATH}) OVER (PARTITION BY report_month) AS mp_ FROM {T}
                   WHERE mng_unit_rk = '{rk}' AND ({cond}) AND {when}) WHERE pth_ = mp_)"""

    def direct(rk, cond='1', col='hc_total_cnt'):
        """ряд юнита прямо по таблице: строки одного пути, простая сумма"""
        when = f"report_month BETWEEN toStartOfYear(addYears(toDate('{lm}'), -1)) AND '{lm}'"
        q = f"""SELECT report_month, sum(toFloat64(ifNull({col}, 0))) FROM {one_path(rk, cond, when)} GROUP BY report_month ORDER BY report_month"""
        return {l.split('\t')[0]: float(l.split('\t')[1]) for l in str(s.query(q, 'TSV')).strip().splitlines() if l}

    def direct_by(rk, attr, col, cond, win):
        """разрез прямо по таблице: численность за последний месяц или увольнения с начала года"""
        when = f"report_month = '{lm}'" if win == 'last' else f"report_month BETWEEN toStartOfYear(toDate('{lm}')) AND '{lm}'"
        q = f"""SELECT ifNull({attr}, '') AS v, sum(toFloat64(ifNull({col}, 0))) AS e FROM {one_path(rk, cond, when)} GROUP BY v HAVING e > 0"""
        return {l.split('\t')[0]: float(l.split('\t')[1]) for l in str(s.query(q, 'TSV')).strip().splitlines() if l}

    STAFF = "employment_relation_type = 'Штатный сотрудник'"
    IT = "ifNull(emp_specialization_it_code, '-') IN ('IT', 'Digital')"
    cases = [
        ('без фильтров', {}, dflt, '1'),
        ('штат', {'staff_f': ['Штат']}, dflt, STAFF),
        ('не штат, уровнем ниже', {'staff_f': ['Не штат'], 'unit_f': [uid(mid)]}, mid, f"NOT ({STAFF}) OR employment_relation_type IS NULL"),
        ('IT и Digital (с 16.10), покраска пропускается', {'paint_f': ['Hq'], 'it_f': ['IT', 'Digital']}, dflt, IT),
        ('IT + штат, уровнем ниже', {'it_f': ['IT'], 'staff_f': ['Штат'], 'unit_f': [uid(mid)]}, mid,
         f"ifNull(emp_specialization_it_code, '-') = 'IT' AND {STAFF}"),
        ('самый глубокий юнит', {'unit_f': [uid(deep)]}, deep, '1'),
        ('корень', {'unit_f': [uid(root)]}, root, '1'),
        ('чужой id', {'unit_f': ['ffffffffffff']}, dflt, '1'),
        ('кавычка в фильтре', {'staff_f': ["Штат' OR 1=1 --"]}, dflt, "0"),
    ]
    for name, flt, want, cond in cases:
        print(f'— {name}')
        outs = {}
        for cname, st_ in CFG.items():
            try:
                out, rows = query(s, render(flt), st_)
                outs[cname] = (out, rows)
            except Exception as e:
                fail(f'{cname}: {str(e)[:300]}')
        if len({o[0] for o in outs.values()}) != 1:
            fail('ответы при разных настройках сервера различаются')
        if 'default' not in outs:
            continue
        rows = outs['default'][1]
        roles = [r['role'] for r in rows]
        if roles[0] != 'meta' or roles[-1] != 'end' or roles[1:4] != ['scope', 'base', 'dict']:
            fail(f'порядок ролей {roles[:5]} … {roles[-2:]}')
        order = {'meta': 0, 'scope': 1, 'base': 2, 'dict': 3, 'c': 5, 'g': 6, 'x': 7, 'end': 9}
        if [order[r] for r in roles] != sorted(order[r] for r in roles):
            fail('роли не по порядку')
        meta = json.loads(rows[0]['j'])
        if meta['lm'] != lm or meta['n'] != len(arrays(rows[1])['hc']):
            fail(f"календарь: lm {meta['lm']} против {lm}, n {meta['n']}")
        if meta['cuts'] != ['it', 'staff'] or meta['paint'] != [] or meta['it'] != flt.get('it_f', []):
            fail(f"meta: cuts {meta['cuts']} / paint {meta['paint']} / it {meta['it']}")
        if not meta['vals'].get('it'):
            fail('meta: нет значений фильтра IT')
        sc = rows[1]
        if sc['id'] != uid(want):
            fail(f"выбран {sc['id']}, ждали {uid(want)} ({st[want]['nm']})")
        if meta['scope'] != sc['id'] or meta['root'] != uid(root) or meta['def'] != uid(dflt):
            fail('meta: scope / root / def')
        if meta['staff'] != flt.get('staff_f', []):
            fail(f"эхо фильтра штата: {meta['staff']}")
        # ряды выбранного юнита и базы — как прямо по таблице
        months = [r for r in sorted(direct(root, '1'))]
        for row, rk in ((sc, want), (rows[2], root)):
            for key, col in DIRECT.items():
                d = direct(rk, cond, col)
                got = arrays(row)[key]
                exp = [round(d.get(m, 0.0), 1) for m in months]
                if got != exp:
                    fail(f"{row['role']}: ряд {key} ({col}) не сходится с таблицей\n    {got}\n    {exp}")
        # разрезы mx — как прямо по таблице: состав за месяц и увольнения с начала года
        for row, rk in ((sc, want), (rows[2], root)):
            mx = mx_of(row)
            for k, attr, col, win in (('g', 'gender', 'hc_total_cnt', 'last'), ('gr', 'grade', 'hc_total_cnt', 'last'),
                                      ('r', 'employment_relation_type', 'hc_total_cnt', 'last'),
                                      ('xr', 'fire_reason_group', 'fire_amt', 'ytd'),
                                      ('xq', 'fire_reason_group', 'regret_fire_amt', 'ytd'),
                                      ('xt', 'experience_group_nm', 'fire_amt', 'ytd')):
                exp = {v: round(n, 1) for v, n in direct_by(rk, attr, col, cond, win).items()}
                if mx.get(k, {}) != exp:
                    fail(f"{row['role']}: разрез {k} не сходится\n    {mx.get(k)}\n    {exp}")
            hc_last = arrays(row)['hc'][-1]
            if abs(sum(mx.get('g', {}).values()) - hc_last) > .5:
                fail(f"{row['role']}: сумма разреза по полу {sum(mx.get('g', {}).values())} ≠ численность {hc_last}")
        # дети, внуки, правнуки — ровно по дереву последнего полного месяца
        lvl_rows = {'c': [], 'g': [], 'x': []}
        for r in rows:
            if r['role'] in lvl_rows:
                lvl_rows[r['role']].append(r)
        ids = {r['id']: r for r in rows if r['role'] in ('scope', 'c', 'g', 'x')}
        for r in lvl_rows['c']:
            if r['pid'] != sc['id']:
                fail(f"c {r['nm']}: pid не выбранный юнит")
        for role, prole in (('g', 'c'), ('x', 'g')):
            for r in lvl_rows[role]:
                if r['pid'] not in ids or ids[r['pid']]['role'] != prole:
                    fail(f"{role} {r['nm']}: родитель не из {prole}")
        exp_c = {uid(rk) for rk in kids.get(want, [])}
        got_c = {r['id'] for r in lvl_rows['c']}
        if not got_c <= exp_c:
            fail('c: лишние юниты')
        missing = exp_c - got_c
        for m_id in missing:      # пропустить можно только юнит без людей и движения под фильтрами
            d = direct(by_id[m_id], cond)
            if any(d.values()):
                fail(f'c: пропущен юнит с людьми {st[by_id[m_id]]["nm"]}')
        for r in lvl_rows['x']:
            if int(r['kids']) != len(kids.get(by_id[r['id']], [])):
                fail(f"x {r['nm']}: kids {r['kids']}")
        own = arrays(sc)['hc'][-1] - sum(arrays(r)['hc'][-1] for r in lvl_rows['c'])
        if own < -0.5:
            print(f'  внимание: юнит меньше суммы детей на {-own} (юнит с двумя родителями)')
        dict_lines = [l.split('\t') for l in rows[3]['j'].split('\n') if l]
        dict_ids = {l[0] for l in dict_lines}
        a, path = want, []
        while a:
            path.append(uid(a))
            a = st[a]['prk']
        if not set(path) <= dict_ids:
            fail('dict: нет пути от корня')
        print(f"  ок: строк {len(rows)} · c {len(lvl_rows['c'])} · g {len(lvl_rows['g'])} · x {len(lvl_rows['x'])}"
              f" · в справочнике {len(dict_lines)} · свои люди {own:g} · {len(outs)} настроек сервера")
    print('ИТОГ:', 'всё сходится' if ok else 'есть расхождения')
    return ok


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('db')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--unit')
    ap.add_argument('--paint', action='append')
    ap.add_argument('--it', action='append')
    ap.add_argument('--staff', action='append')
    ap.add_argument('--sql', action='store_true', help='только напечатать SQL после Jinja')
    ap.add_argument('--json', help='сохранить ответ массивом JSON — так его получает чарт (data)')
    a = ap.parse_args()
    if a.check:
        sys.exit(0 if check(a.db) else 1)
    flt = {}
    if a.unit:
        flt['unit_f'] = [a.unit]
    for k in ('paint', 'it', 'staff'):
        if getattr(a, k):
            flt[k + '_f'] = getattr(a, k)
    if a.sql:
        print(render(flt))
        sys.exit(0)
    out, rows = run(a.db, flt)
    if a.json:
        json.dump(rows, open(a.json, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'{len(rows)} строк → {a.json}')
    else:
        print(out)

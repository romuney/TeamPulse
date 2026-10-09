# Стенд датасета teampulse_hub: шаблон Jinja → SQL → ClickHouse 24.8 (chdb).
#
#   python dataset.py DB [--unit ID] [--paint Hq] [--it IT] [--staff Штат]   — ответ строками
#   python dataset.py DB --check                                            — полная сверка
#
# DB — папка chdb с prod_proteus.hr_structure_overall (sim_hso.py + load_hso.py).
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


def arrays(row):
    keys = ['hc', 'act', 'avg', 'hire', 'fire', 'reg', 'tin', 'tout', 'plow', 'prat']
    return {k: [float(x) for x in row['m_' + k].split(',')] for k in keys}


def check(db):
    s = session.Session(db)
    ok = True

    def fail(msg):
        nonlocal ok
        ok = False
        print('  FAIL', msg)

    # структура последнего полного месяца — прямо по таблице, без датасета
    lm = str(s.query(f"SELECT if(max(month) >= toStartOfMonth(today()), addMonths(max(month), -1), max(month)) FROM {T}", 'TSV')).strip()
    st = {}
    for line in str(s.query(f"""SELECT mngt_unit_rk, min(ifNull(parent_mngt_unit_rk, '')), any(lvl), any(mngt_unit_nm)
                                 FROM {T} WHERE month = '{lm}' GROUP BY mngt_unit_rk""", 'TSV')).strip().splitlines():
        rk, prk, lv, nm = line.split('\t')
        st[rk] = dict(prk=prk, lv=int(lv), nm=nm)
    kids = {}
    for rk, u in st.items():
        kids.setdefault(u['prk'], []).append(rk)
    root = next(rk for rk, u in st.items() if u['prk'] == '')
    dflt = kids[root][0] if len(kids.get(root, [])) == 1 else root
    by_id = {uid(rk): rk for rk in st}
    deep = next(rk for rk, u in st.items() if u['lv'] == max(x['lv'] for x in st.values()))
    mid = next(rk for rk in kids.get(dflt, []) if kids.get(rk))

    def direct(rk, cond='1'):
        """ряд численности юнита прямо по таблице: копии строк юнита с двумя родителями — один раз"""
        q = f"""SELECT m, sum(e) FROM (SELECT month AS m, max(ifNull(employee_amt, 0)) AS e FROM {T}
                WHERE mngt_unit_rk = '{rk}' AND {cond} AND month BETWEEN toStartOfYear(addYears(toDate('{lm}'), -1)) AND '{lm}'
                GROUP BY m, active_type_gr_nm, active_type_nm, emp_specialization_oper_code,
                         emp_specialization_it_code, employment_relation_type_desc) GROUP BY m ORDER BY m"""
        return {l.split('\t')[0]: float(l.split('\t')[1]) for l in str(s.query(q, 'TSV')).strip().splitlines() if l}

    cases = [
        ('без фильтров', {}, dflt, '1'),
        ('Hq', {'paint_f': ['Hq']}, dflt, "ifNull(emp_specialization_oper_code, '-') = 'Hq'"),
        ('IT + Digital, штат', {'it_f': ['IT', 'Digital'], 'staff_f': ['Штат']}, dflt,
         "ifNull(emp_specialization_it_code, '-') IN ('IT', 'Digital') AND employment_relation_type_desc = 'Штатный сотрудник'"),
        ('юнит уровнем ниже', {'unit_f': [uid(mid)]}, mid, '1'),
        ('самый глубокий юнит', {'unit_f': [uid(deep)]}, deep, '1'),
        ('корень', {'unit_f': [uid(root)]}, root, '1'),
        ('чужой id', {'unit_f': ['ffffffffffff']}, dflt, '1'),
        ('кавычка в фильтре', {'paint_f': ["Hq' OR 1=1 --"]}, dflt, "0"),
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
        sc = rows[1]
        if sc['id'] != uid(want):
            fail(f"выбран {sc['id']}, ждали {uid(want)} ({st[want]['nm']})")
        if meta['scope'] != sc['id'] or meta['root'] != uid(root) or meta['def'] != uid(dflt):
            fail('meta: scope / root / def')
        for k, col in (('paint', 'paint_f'), ('it', 'it_f'), ('staff', 'staff_f')):
            if meta[k] != flt.get(col, []):
                fail(f'эхо фильтра {k}: {meta[k]}')
        # ряд выбранного юнита и базы — как прямо по таблице
        months = [r for r in sorted(direct(root, '1'))]
        for row, rk in ((sc, want), (rows[2], root)):
            d = direct(rk, cond)
            got = arrays(row)['hc']
            exp = [d.get(m, 0.0) for m in months]
            if got != exp:
                fail(f"{row['role']}: ряд численности не сходится с таблицей\n    {got}\n    {exp}")
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
        # люди прямо в выбранном юните: юнит минус дети — не меньше нуля в последнем месяце
        own = arrays(sc)['hc'][-1] - sum(arrays(r)['hc'][-1] for r in lvl_rows['c'])
        if own < -0.5:
            print(f'  внимание: юнит меньше суммы детей на {-own} (юнит с двумя родителями)')
        # справочник: путь от корня до выбранного
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

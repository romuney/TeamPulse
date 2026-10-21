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
    """ответ как его получает чарт: записи JSON, по одной на строку; метрики 2а с поставки 53 (ms) —
    развёрнуты в m_*, как в прежнем ответе (сверки стенда читают m_*)"""
    out = str(s.query(sql + ('\nSETTINGS ' + settings if settings else ''), 'JSONEachRow'))
    rows = expand([json.loads(l) for l in out.splitlines() if l.strip()])
    return out, rows


def expand(rows):
    """ms («;» между метриками в порядке meta.mk) → колонки m_<метрика>"""
    meta = next((r for r in rows if r.get('role') == 'meta'), None)
    if not meta or 'ms' not in meta:
        return rows
    mk = json.loads(meta['j']).get('mk', '').split(',')
    for r in rows:
        ms = r.pop('ms', '')
        if r.get('role') in ('scope', 'base', 'c', 'g', 'x'):
            r.update({'m_' + k: v for k, v in zip(mk, ms.split(';'))})
        else:
            r.update({'m_' + k: '' for k in mk})
    return rows


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


ALL_ATTRS = ['gender', 'type_age', 'experience_group_nm', 'grade', 'seniority', 'employee_contract_type',
             'legal_organization', 'employee_stream', 'employment_relation_type', 'employment_relation_type_gr_nm',
             'active_type_gr_nm', 'emp_specialization_it_code', 'fire_reason_group', 'fire_initiative']
COLS = ['hc_total_cnt', 'hc_active_cnt', 'ssch_hc_active_cnt', 'hire_amt', 'fire_amt', 'regret_fire_amt',
        'transfer_in_amt', 'transfer_out_amt', 'perf_normal', 'perf_low', 'perf_high', 'perf_gray',
        'work_day_amt', 'office_visit_amt', 'grt_approve_cnt', 'grt_decline_cnt',
        # найм по методологии DD — найм в компанию + эти два перевода (в правде складываются в hire_amt)
        'transfer_candidate_amt', 'transfer_internal_amt']
# разделитель уровней в выгрузке — «‖»: таб в TSV приходит экранированным
PATHX = f"arrayStringConcat(arraySlice([{LV}], 1, toInt32(ifNull(leaf_lvl, 0))), '‖')"


def nd(v):
    """«-» — пустое значение (ноутбук сборки TP 2.0: coalesce(…, '-')): в ответе — пустая строка"""
    return '' if v == '-' else v


def load_rows(s, lm):
    """строки окна прямо из таблицы — правда считается в Python, без SQL датасета: юнит с двумя
    путями — строки его меньшего пути в месяце, простой суммой (строки с одинаковым ключом в одном
    пути — разные люди: их делит колонка, которой в ключе нет)"""
    q = f"""SELECT toString(report_month), ifNull(mng_unit_rk, ''), {PATHX},
                   {', '.join(f"ifNull({a}, '')" for a in ALL_ATTRS)},
                   {', '.join(f'toFloat64(ifNull({c}, 0))' for c in COLS)}
            FROM {T} WHERE report_month BETWEEN addMonths(toStartOfYear(addYears(toDate('{lm}'), -1)), -1) AND '{lm}'"""
    rows, best = {}, {}
    na = len(ALL_ATTRS)
    for line in str(s.query(q, 'TSV')).splitlines():
        f = line.split('\t')
        if len(f) < 3:
            continue
        m, rk = f[0], f[1]
        tail = f[-(na + len(COLS)):]
        path = f[2].replace('‖', '\t')
        attrs = tuple(tail[:na])
        vals = [float(x) for x in tail[na:]]
        vals[COLS.index('hire_amt')] += vals[COLS.index('transfer_candidate_amt')] + vals[COLS.index('transfer_internal_amt')]
        best[(m, rk)] = min(best.get((m, rk), path), path)
        key = (m, rk, path, attrs)
        if key in rows:
            rows[key]['v'] = [a + b for a, b in zip(rows[key]['v'], vals)]
        else:
            rows[key] = dict(m=m, rk=rk, path=path, a=dict(zip(ALL_ATTRS, attrs)), v=vals)
    return [r for r in rows.values() if r['path'] == best[(r['m'], r['rk'])]]


def tree(rows, lm):
    """дерево последнего полного месяца: путь юнита (меньший) и все его начала — узлы"""
    lmp = {}
    for r in rows:
        if r['m'] == lm and r['rk'] and r['path']:
            lmp[r['rk']] = min(lmp.get(r['rk'], r['path']), r['path'])
    nodes = {}
    for p in lmp.values():
        parts = p.split('\t')
        for d in range(1, len(parts) + 1):
            np_ = '\t'.join(parts[:d])
            nodes[np_] = dict(prk='\t'.join(parts[:d - 1]), lv=d, nm=parts[d - 1])
    return lmp, nodes


def check(db):
    s = session.Session(db)
    ok = True

    def fail(msg):
        nonlocal ok
        ok = False
        print('  FAIL', msg)

    lm = str(s.query(f"SELECT max(report_month) FROM {T}", 'TSV')).strip()   # 20.10: и текущий незакрытый
    allrows = load_rows(s, lm)
    lmp, st = tree(allrows, lm)
    for r in allrows:                       # путь строки — нынешний путь её юнита
        r['cp'] = lmp.get(r['rk']) or r['path']
    kids = {}
    for np_, u in st.items():
        kids.setdefault(u['prk'], []).append(np_)
    root = min((np_ for np_, u in st.items() if u['prk'] == ''), key=lambda p: (st[p]['lv'], p))
    dflt = kids[root][0] if len(kids.get(root, [])) == 1 else root
    by_id = {uid(p): p for p in st}
    deep = max(st, key=lambda p: (st[p]['lv'], p))
    mid = next(p for p in sorted(kids.get(dflt, [])) if kids.get(p))
    own = sum(1 for p in st if any(r['cp'] == p for r in allrows if r['m'] == lm))
    print(f'дерево: {len(st)} узлов, из них со своими строками {own} — итог узла по пути')
    mp = sorted({r['m'] for r in allrows})
    months, mp = (mp[1:], mp[0]) if len(mp) > 1 and mp[0] < str(int(lm[:4]) - 1) + '-01-01' else (mp, None)
    KI = {k: COLS.index(c) for k, c in zip(KEYS, COLS)}

    def under(r, p):
        return r['cp'] == p or r['cp'].startswith(p + '\t')

    def truth(p, pred):
        sub = [r for r in allrows if under(r, p) and pred(r)]
        ser = {k: [0.0] * len(months) for k in KEYS}
        mi = {m: i for i, m in enumerate(months)}
        prev = 0.0
        for r in sub:
            if r['m'] == mp:
                prev += r['v'][KI['hc']]
                continue
            for k in KEYS:
                ser[k][mi[r['m']]] += r['v'][KI[k]]
        # ССЧ — полусумма численности строк фильтра с прошлым месяцем (на активной — ССЧ активной);
        # у первого месяца — с месяцем перед сеткой
        hc = ser['hc']
        ser['avg'] = [(hc[i] + (hc[i - 1] if i else (prev if mp else hc[0]))) / 2 for i in range(len(hc))]
        ser = {k: [round(x, 1) for x in v] for k, v in ser.items()}
        mx = {}
        y0 = lm[:4] + '-01-01'
        for r in sub:
            if r['m'] == lm and r['v'][0] > 0:
                for k, a in (('g', 'gender'), ('gr', 'grade'), ('r', 'employment_relation_type'), ('c', 'employee_contract_type'),
                             ('o', 'legal_organization'), ('w', 'employee_stream')):
                    v = nd(r['a'][a])
                    mx.setdefault(k, {}).setdefault(v, 0.0)
                    mx[k][v] += r['v'][0]
            if r['m'] >= y0 and r['v'][4] > 0:
                for k, a, col in (('xr', 'fire_reason_group', 4), ('xq', 'fire_reason_group', 5), ('xt', 'experience_group_nm', 4),
                                  ('xs', 'employee_stream', 4)):
                    if r['v'][col] > 0:
                        v = nd(r['a'][a])
                        mx.setdefault(k, {}).setdefault(v, 0.0)
                        mx[k][v] += r['v'][col]
        mx = {k: {v: round(n, 1) for v, n in d.items() if n > 0} for k, d in mx.items()}
        return ser, mx, sub

    STAFF = lambda r: r['a']['employment_relation_type'] == 'Штатный сотрудник'
    ITC = lambda r: (r['a']['emp_specialization_it_code'] or '-')
    ACT = lambda r: r['a']['active_type_gr_nm'] == 'Активная'
    ACTL = lambda r: 'Активная' if ACT(r) else 'Прочие'
    cases = [
        ('без фильтров', {}, dflt, lambda r: True),
        ('штат', {'staff_f': ['Штат']}, dflt, STAFF),
        ('не штат, уровнем ниже', {'staff_f': ['Не штат'], 'unit_f': [uid(mid)]}, mid, lambda r: not STAFF(r)),
        ('IT и Digital, покраска пропускается', {'paint_f': ['Hq'], 'it_f': ['IT', 'Digital']}, dflt, lambda r: ITC(r) in ('IT', 'Digital')),
        ('IT строчными (регистр не важен)', {'it_f': ['it']}, dflt, lambda r: ITC(r) == 'IT'),
        ('IT + штат, уровнем ниже', {'it_f': ['IT'], 'staff_f': ['Штат'], 'unit_f': [uid(mid)]}, mid, lambda r: ITC(r) == 'IT' and STAFF(r)),
        ('самый глубокий юнит', {'unit_f': [uid(deep)]}, deep, lambda r: True),
        ('корень (своих строк нет)', {'unit_f': [uid(root)]}, root, lambda r: True),
        ('чужой id', {'unit_f': ['ffffffffffff']}, dflt, lambda r: True),
        ('кавычка в фильтре', {'staff_f': ["Штат' OR 1=1 --"]}, dflt, lambda r: False),
        # 20.10: тип численности — по умолчанию (случаи выше) «Активная», «Вся» — все строки
        ('вся численность', {'act_f': ['Вся']}, dflt, lambda r: True),
        ('вся численность + штат, уровнем ниже', {'act_f': ['Вся'], 'staff_f': ['Штат'], 'unit_f': [uid(mid)]}, mid, STAFF),
        ('только прочие (не активная)', {'act_f': ['Прочие']}, dflt, lambda r: not ACT(r)),
    ]
    fd_all = {}
    for name, flt, want, pred0 in cases:
        print(f'— {name}')
        pred = pred0 if 'act_f' in flt else (lambda r, p0=pred0: p0(r) and ACT(r))
        act_echo = [] if flt.get('act_f') == ['Вся'] else flt.get('act_f', ['Активная'])
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
        if meta['lm'] != lm or meta['n'] != len(arrays(rows[1])['hc']) or meta['n'] != len(months):
            fail(f"календарь: lm {meta['lm']} против {lm}, n {meta['n']}")
        # 20.10: месяц таблицы текущий — dt (дата данных) вчера, иначе пусто
        import datetime as _d
        y = _d.date.today() - _d.timedelta(days=1)
        want_dt = max(y, _d.date.fromisoformat(lm)).isoformat() if lm >= _d.date.today().replace(day=1).isoformat() else ''
        if meta.get('dt') != want_dt:
            fail(f"дата данных: dt {meta.get('dt')!r} против {want_dt!r}")
        if meta['cuts'] != ['it', 'staff', 'act'] or meta['paint'] != [] or meta['it'] != flt.get('it_f', []):
            fail(f"meta: cuts {meta['cuts']} / paint {meta['paint']} / it {meta['it']}")
        sc = rows[1]
        if sc['id'] != uid(want):
            fail(f"выбран {sc['id']}, ждали {uid(want)} ({st[want]['nm']})")
        if meta['scope'] != sc['id'] or meta['root'] != uid(root) or meta['def'] != uid(dflt):
            fail('meta: scope / root / def')
        if meta['staff'] != flt.get('staff_f', []):
            fail(f"эхо фильтра штата: {meta['staff']}")
        if meta.get('act') != act_echo:
            fail(f"эхо типа численности: {meta.get('act')} против {act_echo}")
        # значения фильтров — численность компании без копий путей, фильтры их не режут
        for key, lab in (('it', ITC), ('staff', lambda r: 'Штат' if STAFF(r) else 'Не штат'), ('act', ACTL)):
            exp = {}
            for r in allrows:
                if r['m'] == lm and r['rk'] and r['path']:
                    exp[lab(r)] = exp.get(lab(r), 0.0) + r['v'][0]
            got = {x['v']: x['e'] for x in meta['vals'][key]}
            if {k: round(v, 1) for k, v in got.items()} != {k: round(v, 1) for k, v in exp.items() if v or k in got}:
                fail(f"meta.vals.{key}: {got} против {exp}")
        # ряды и разрезы выбранного юнита и базы — как прямо по строкам таблицы
        for row, p in ((sc, want), (rows[2], root)):
            ser, mx_t, _ = truth(p, pred)
            got = arrays(row)
            for k in KEYS:
                if got[k] != ser[k]:
                    fail(f"{row['role']}: ряд {k} не сходится со строками таблицы\n    {got[k]}\n    {ser[k]}")
            mx = mx_of(row)
            for k, exp in mx_t.items():
                if mx.get(k, {}) != exp:
                    fail(f"{row['role']}: разрез {k} не сходится\n    {mx.get(k)}\n    {exp}")
            if abs(sum(mx.get('g', {}).values()) - got['hc'][-1]) > .5:
                fail(f"{row['role']}: сумма разреза по полу ≠ численность")
        # дети, внуки, правнуки — ровно по дереву; сумма детей не больше узла
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
        exp_c = {uid(p) for p in kids.get(want, [])}
        got_c = {r['id'] for r in lvl_rows['c']}
        if not got_c <= exp_c:
            fail('c: лишние юниты')
        for m_id in exp_c - got_c:
            ser, _, _ = truth(by_id[m_id], pred)
            if any(sum(v) for v in ser.values()):
                fail(f'c: пропущен юнит с людьми {st[by_id[m_id]]["nm"]}')
        for r in lvl_rows['c'][:3] + lvl_rows['g'][:3]:
            ser, _, _ = truth(by_id[r['id']], pred)
            if arrays(r)['hc'] != ser['hc']:
                fail(f"{r['role']} {r['nm']}: численность не сходится со строками")
        for r in lvl_rows['x']:
            if int(r['kids']) != len(kids.get(by_id[r['id']], [])):
                fail(f"x {r['nm']}: kids {r['kids']}")
        own_ = arrays(sc)['hc'][-1] - sum(arrays(r)['hc'][-1] for r in lvl_rows['c'])
        if own_ < -0.5:
            fail(f'юнит меньше суммы детей на {-own_}')
        dict_lines = [l.split('\t') for l in rows[3]['j'].split('\n') if l]
        dict_ids = {l[0] for l in dict_lines}
        a, path = want, []
        while a:
            path.append(uid(a))
            a = st[a]['prk']
        if not set(path) <= dict_ids:
            fail('dict: нет пути от корня')
        # 19.10: справочник — всё дерево; fd — численность узла в последнем месяце по сочетаниям
        # IT × штат без применённых фильтров (окно настройки считает по нему выбор без запроса)
        if dict_ids != {uid(p) for p in st}:
            fail(f'dict: узлов {len(dict_ids)}, в дереве {len(st)}')
        fdv = meta.get('fdv') or {}
        fa, fb, fc = fdv.get('it') or [], fdv.get('staff') or [], fdv.get('act') or []
        if not fa or not fb or not fc:
            fail('meta.fdv: нет словарей распределения')
        else:
            exp_fd = {}
            for r in allrows:
                if r['m'] != lm or not r['v'][0]:
                    continue
                c = (fa.index(ITC(r)) * len(fb) + fb.index('Штат' if STAFF(r) else 'Не штат')) * len(fc) + fc.index(ACTL(r))
                parts = r['cp'].split('\t')
                for d in range(1, len(parts) + 1):
                    k = '\t'.join(parts[:d])
                    exp_fd.setdefault(uid(k), {}).setdefault(c, 0.0)
                    exp_fd[uid(k)][c] += r['v'][0]
            bad = 0
            for l in dict_lines:
                got_fd = {int(x.split(':')[0]): float(x.split(':')[1]) for x in (l[6] if len(l) > 6 else '').split(' ') if x}
                want_fd = {c: round(n) for c, n in exp_fd.get(l[0], {}).items() if round(n)}
                if got_fd != want_fd or (len(l) > 5 and l[5] != ''):
                    bad += 1
            if bad:
                fail(f'dict: fd не сходится со строками у {bad} узлов')
            fd_all.setdefault('fd', set()).add(rows[3]['j'])
        print(f"  ок: строк {len(rows)} · c {len(lvl_rows['c'])} · g {len(lvl_rows['g'])} · x {len(lvl_rows['x'])}"
              f" · в справочнике {len(dict_lines)} · свои люди {own_:g} · {len(outs)} настроек сервера")
    if len(fd_all.get('fd', ())) != 1:
        fail('dict: справочник зависит от применённых фильтров или юнита')
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

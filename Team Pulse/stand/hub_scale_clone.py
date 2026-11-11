# Стенд масштаба боя по НЫНЕШНЕЙ схеме таблиц: дерево боевого размера, строки — клоны малого стенда с людьми.
#
#   python3 stand/hub_scale_clone.py <малый стенд>/db <новый каталог chdb> [масштаб]
#
# Зачем: stand/hub_scale.py знает таблицы на 21.10 (нет flow, aiw, aix, prof, pfd и новых колонок) — датасет на нём не
# исполняется. Здесь схема берётся у малого стенда (stand/nb_tp20.py --hub: её пишет сам ноутбук), поэтому она всегда
# нынешняя. Дерево — как в бою (hub_scale.tree: 11 932 узла, 11 уровней, листья на разных уровнях). Каждому листу
# большого дерева назначается лист малого стенда-образец: его строки копируются листу и всем его предкам (у узла — сумма
# по поддереву, как у ноутбука). Людей выходит порядка численности боя (лист малого стенда ≈ 8 человек).
# Чем стенд НЕ похож на бой: значений разрезов столько же, сколько в малом стенде (городов, специализаций меньше) —
# ответ легче боевого; переводы «напрямую в юните» (узлы :d) и профили предков не копируются.
# Замер датасета на нём — как у малого: stand/split_check.py, а время — тем же текстом через модель разбора Proteus.
import os, shutil, sys, time
from chdb import session

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hub_scale  # noqa: E402

P = 'prod_proteus.teampulse_hub_'
# измерения-числа (остальные числа — меры, складываются); строки и даты — измерения всегда
INT_DIMS = {'flow': ['chg_unit', 'chg_sp'], 'trf': ['fu', 'fa', 'fp', 'fi', 'fs', 'in_ok', 'fsp'], 'vacancy': ['ttf_d']}
NODE_TABLES = ['series', 'mix', 'trf', 'flow', 'vacancy', 'aiw', 'aix']
BATCHES = 8


def main():
    small, big = sys.argv[1], sys.argv[2]
    scale = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    s0 = session.Session(small)
    q0 = lambda sql, f='TSV': str(s0.query(sql, f))
    schema = {}
    for t in NODE_TABLES + ['prof', 'pfd', 'meta', 'unit']:
        schema[t] = [l.split('\t')[:2] for l in q0(f'DESCRIBE {P}{t}').strip().split('\n')]
    leaves = q0(f"SELECT unit_rk FROM {P}unit WHERE ifNull(kids_cnt, 0) = 0 AND unit_rk IN (SELECT node_rk FROM {P}series)").split()
    tmp = os.path.join(os.path.dirname(os.path.abspath(big)), '_scale_csv')
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    for t in NODE_TABLES + ['prof', 'pfd', 'meta']:
        open(os.path.join(tmp, t + '.csv'), 'w', encoding='utf-8').write(q0(f'SELECT * FROM {P}{t}', 'CSVWithNames'))
    s0.close()

    nodes, kids, size, path = hub_scale.tree(scale)
    if os.path.exists(big):
        shutil.rmtree(big)
    s = session.Session(big)
    q = lambda sql: str(s.query(sql, 'TSV'))
    q('CREATE DATABASE IF NOT EXISTS prod_proteus')
    for t, cols in schema.items():
        q(f"CREATE TABLE {P}{t} ({', '.join(c + ' ' + ty for c, ty in cols)}) ENGINE = MergeTree ORDER BY tuple()")
        if t in NODE_TABLES + ['prof']:
            q(f"CREATE TABLE prod_proteus.s_{t} ({', '.join(c + ' ' + ty for c, ty in cols)}) ENGINE = MergeTree ORDER BY tuple()")
            q(f"INSERT INTO prod_proteus.s_{t} SELECT * FROM file('{tmp}/{t}.csv', 'CSVWithNames')")
    q(f"INSERT INTO {P}pfd SELECT * FROM file('{tmp}/pfd.csv', 'CSVWithNames')")
    q(f"INSERT INTO {P}meta SELECT * REPLACE('{nodes[0][0]}' AS root_rk, '{nodes[1][0]}' AS def_rk) FROM file('{tmp}/meta.csv', 'CSVWithNames')")
    # справочник и карта «лист → образец, предки»
    q('CREATE TABLE prod_proteus.lmap (leaf String, tpl String, anc Array(String), b UInt8) ENGINE = MergeTree ORDER BY tuple()')
    lf = [u for u, _, _ in nodes if u not in kids]
    for i in range(0, len(nodes), 2000):
        part = nodes[i:i + 2000]
        q(f'INSERT INTO {P}unit (unit_rk, parent_rk, unit_lvl, unit_nm, kids_cnt, path_rk, head_login, head_nm) VALUES ' + ','.join(
            "('%s','%s',%d,'Подразделение %s уровня %d',%d,'%s','login.%s','Руководитель %s')"
            % (u, p, lvl, u, lvl, len(kids.get(u, [])), path[u], u, u) for u, p, lvl in part))
    for i in range(0, len(lf), 2000):
        q('INSERT INTO prod_proteus.lmap VALUES ' + ','.join(
            "('%s','%s',[%s],%d)" % (u, leaves[hash(u) % len(leaves)], ','.join("'%s'" % a for a in path[u].split('|')), j % BATCHES)
            for j, u in enumerate(lf[i:i + 2000], i)))
    t00 = time.time()
    for t in NODE_TABLES:
        cols = schema[t]
        dims = [c for c, ty in cols if c != 'node_rk' and (('String' in ty) or ('Date' in ty) or c in INT_DIMS.get(t, []))]
        meas = [c for c, ty in cols if c != 'node_rk' and c not in dims]
        sel = ', '.join(['a AS node_rk'] + dims + ['sum(%s) AS %s' % (c, c) for c in meas])
        order = ', '.join(c for c, _ in cols)
        for b in range(BATCHES):
            q(f"""INSERT INTO {P}{t} ({order}) SELECT {order} FROM (
                    SELECT {sel} FROM prod_proteus.s_{t} AS x INNER JOIN (SELECT tpl, anc FROM prod_proteus.lmap WHERE b = {b}) AS m ON x.node_rk = m.tpl
                    ARRAY JOIN m.anc AS a GROUP BY a{''.join(', ' + d for d in dims)})""")
        # предки собраны по пачкам листьев — досвести узлы, попавшие в несколько пачек
        q(f"CREATE TABLE prod_proteus.f_{t} AS {P}{t} ENGINE = MergeTree ORDER BY tuple()")
        q(f"""INSERT INTO prod_proteus.f_{t} ({order}) SELECT {order} FROM (
                SELECT {', '.join(['node_rk'] + dims + ['sum(%s) AS %s' % (c, c) for c in meas])} FROM {P}{t} GROUP BY node_rk{''.join(', ' + d for d in dims)})""")
        q(f'DROP TABLE {P}{t}')
        q(f'RENAME TABLE prod_proteus.f_{t} TO {P}{t}')
        q(f'DROP TABLE prod_proteus.s_{t}')
        print('  %s: %s строк (%.0f с)' % (t, q(f'SELECT count() FROM {P}{t}').strip(), time.time() - t00), flush=True)
    pc = ', '.join(c for c, _ in schema['prof'])
    q(f"INSERT INTO {P}prof ({pc}) SELECT {pc.replace('node_rk', 'm.leaf AS node_rk', 1)} FROM prod_proteus.s_prof AS x INNER JOIN prod_proteus.lmap AS m ON x.node_rk = m.tpl")
    q('DROP TABLE prod_proteus.s_prof')
    q('DROP TABLE prod_proteus.lmap')
    hc = q(f"SELECT sum(hc_cnt) FROM {P}series WHERE node_rk = '{nodes[0][0]}' AND report_month = (SELECT max(report_month) FROM {P}series) AND act_cd = 'Активная'").strip()
    print(f'{big}: узлов {len(nodes)}, листьев {len(lf)}, активная численность компании в последнем месяце {hc}; prof {q(f"SELECT count() FROM {P}prof").strip()}')
    s.close()
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
    sys.stdout.flush()
    os._exit(0)

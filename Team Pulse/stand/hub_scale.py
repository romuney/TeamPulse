# Стенд масштаба боя для датасета 2а: таблицы teampulse_hub_* в chdb (ClickHouse 24.8) без людей и ноутбука.
# Дерево — как в бою (0е, 20.10: 11 932 узла, по уровням 1:1 2:1 3:10 4:64 … 11:1599), листья на разных уровнях.
# Строк у узла — по размеру поддерева: срезов (покраска × IT × штат × тип) у листа 2–3, у верхних узлов все 36.
# Пессимистично к бою: series ≈ 1,3 млн строк (в бою 624 тыс. до разреза типа численности).
#
#   python3 stand/hub_scale.py <каталог chdb> [масштаб]     # масштаб 1 — бой, 0.1 — быстрый прогон
# Системный python3 с chdb 3.x (ClickHouse 24.8.4): в chdb 2.1 venv kit каждый запрос — отдельный запуск, заливка там висит.
#
# Каталог пересоздаётся. Время и план датасета на нём — stand/hub_timing.py --bench.
import math, os, random, shutil, sys
from chdb import session

LEVELS = [1, 1, 10, 64, 305, 958, 1846, 2480, 2464, 2204, 1599]
P = 'prod_proteus.teampulse_hub_'
# срез по номеру 0..35: покраска × IT × штат × тип численности
SLICE = """['HQ','Line','Support'][intDiv(k, 12) % 3 + 1] AS paint_cd, ['IT','Digital','NonIT'][intDiv(k, 4) % 3 + 1] AS it_cd,
        ['Штат','Не штат'][intDiv(k, 2) % 2 + 1] AS staff_cd, ['Активная','Неактивная'][k % 2 + 1] AS act_cd"""
KS = "arrayMap(j -> (cityHash64(rk) + j * 7) % 36, range(c))"        # срезы узла
MON = "addMonths(toDate('2024-01-01'), mi)"                           # 34 месяца, как в бою
MIX_KEYS = ("['g','sn','tn','ag','sx','ed','ci','rg','fm','le','st','ty','rs','ri','xg','xs','xt','sp','tc','xsp','xtc',"
            "'hk','hch','hg','hsp','bl']")
TABLES = {
    'meta': "last_month Date, data_dt Date, grid_start Date, n_months Int64, ytd_idx Int64, root_rk String, def_rk String, "
            "built_at String, schema_ver String",
    'unit': "unit_rk String, parent_rk String, unit_lvl Int64, unit_nm String, kids_cnt Int64, path_rk String, head_login String",
    'series': "node_rk String, report_month Date, paint_cd String, it_cd String, staff_cd String, act_cd String, hc_cnt Int64, "
              "act_cnt Int64, avg_cnt Float64, hire_cnt Int64, hco_cnt Int64, fire_cnt Int64, reg_cnt Int64, nreg_cnt Int64, "
              "tin_cnt Int64, tout_cnt Int64, pnor_cnt Float64, plow_cnt Float64, phig_cnt Float64, pgry_cnt Float64, "
              "wday_amt Float64, ovis_amt Float64, gapr_cnt Float64, gdec_cnt Float64",
    'mix': "node_rk String, paint_cd String, it_cd String, staff_cd String, act_cd String, mx_key String, mx_val String, mx_n Int64",
    'trf': "node_rk String, report_month Date, trf_kind String, f_paint_cd String, f_it_cd String, f_staff_cd String, "
           "f_act_cd String, t_paint_cd String, t_it_cd String, t_staff_cd String, t_act_cd String, in_ok Int64, out_ok Int64, "
           "trf_cnt Int64",
    'vacancy': "node_rk String, report_month Date, channel String, search_reason String, cand_lvl String, position_lvl String, "
               "specialization String, status String, vac_open_cnt Float64, vac_close_cnt Float64, vac_new_cnt Float64, "
               "vac_ttf_days Float64, vac_ttf_cnt Float64",
    'ai': "report_month Date, node_rk String, ai_wau Float64, ai_pen Float64, ai_pen_co Float64",
}
FILL = {
    'series': f"""SELECT rk, {MON}, {SLICE}, h, h, h * 0.98, intDiv(h, 30), intDiv(h, 25), intDiv(h, 40), intDiv(h, 80),
       intDiv(h, 70), intDiv(h, 90), intDiv(h, 95), h * 0.7, h * 0.1, h * 0.1, h * 0.1, h * 20.5, h * 0.3, intDiv(h, 50), intDiv(h, 200)
FROM (SELECT rk, mi, k, toInt64(greatest(1, intDiv(sz, c) + cityHash64(rk, mi, k) % 3)) AS h
      FROM prod_proteus.tmp_nd ARRAY JOIN range(34) AS mi ARRAY JOIN {KS} AS k)""",
    'mix': f"""SELECT rk, {SLICE}, kk, concat('Значение ', toString(vi)), toInt64(1 + cityHash64(rk, k, kk, vi) % 20)
FROM (SELECT rk, k, kk, vi FROM prod_proteus.tmp_nd ARRAY JOIN {KS} AS k ARRAY JOIN {MIX_KEYS} AS kk
      ARRAY JOIN range(toUInt32(least(25, 1 + intDiv(sz, 6 * c)))) AS vi)""",
    'trf': f"""SELECT rk, {MON}, ['i','o','s'][k % 3 + 1], ['HQ','Line','Support'][k % 3 + 1], ['IT','Digital','NonIT'][k % 3 + 1],
       'Штат', 'Активная', ['HQ','Line','Support'][(k + 1) % 3 + 1], ['IT','Digital','NonIT'][(k + 2) % 3 + 1],
       ['Штат','Не штат'][k % 2 + 1], 'Активная', k % 2, (k + 1) % 2, toInt64(1 + k % 3)
FROM prod_proteus.tmp_nd ARRAY JOIN range(34) AS mi ARRAY JOIN range(toUInt32(intDiv(c, 2))) AS k""",
    'vacancy': f"""SELECT rk, {MON}, concat('Канал ', toString(k % 5)), ['Замена','Новый','Прочее'][k % 3 + 1],
       ['Junior','Middle','Senior','Other'][k % 4 + 1], concat('L', toString(k % 6)), concat('Спец ', toString(k % 9)),
       concat('Статус ', toString(k % 7)), 1 + k % 3, k % 2, k % 2, 30 * (k % 2), k % 2
FROM prod_proteus.tmp_nd ARRAY JOIN range(34) AS mi ARRAY JOIN range(toUInt32(if(sz > 20, intDiv(c, 2), 0))) AS k""",
    'ai': "SELECT addMonths(toDate('2025-11-01'), mi), rk, intDiv(sz, 3), 33.3, 30.1 FROM prod_proteus.tmp_nd ARRAY JOIN range(12) AS mi",
}


def tree(scale, seed=52):
    rnd = random.Random(seed)
    nodes, prev = [], []
    for lvl, n in enumerate(LEVELS, 1):
        n = n if lvl <= 2 else max(1, round(n * scale))
        cur = ['%d%06d' % (lvl, i) for i in range(n)]
        nodes += [(u, '' if lvl == 1 else rnd.choice(prev), lvl) for u in cur]
        # родитель следующего уровня — и с уровней выше: листья на разных уровнях, как в бою
        prev = cur if lvl < 3 else cur + rnd.sample(prev, len(prev) // 4)
    kids = {}
    for u, p, _ in nodes:
        kids.setdefault(p, []).append(u)
    size, path = {}, {}
    for u, _, _ in reversed(nodes):
        size[u] = (rnd.randint(3, 15) if u not in kids else 0) + sum(size[c] for c in kids.get(u, []))
    for u, p, _ in nodes:
        path[u] = (path[p] + '|' if p else '') + u
    return nodes, kids, size, path


def build(db, scale=1.0):
    nodes, kids, size, path = tree(scale)
    if os.path.exists(db):
        shutil.rmtree(db)
    s = session.Session(db)
    q = lambda sql: s.query(sql, 'TSV').bytes().decode()
    q('CREATE DATABASE IF NOT EXISTS prod_proteus')
    for t, cols in TABLES.items():
        # колонки Nullable — как у выгрузки ноутбука (gp_to_click), без ключа сортировки
        cols = ', '.join(f'{c.split()[0]} Nullable({c.split()[1]})' for c in cols.split(', '))
        q(f'CREATE TABLE {P}{t} ({cols}) ENGINE = MergeTree ORDER BY tuple()')
    q(f"INSERT INTO {P}meta VALUES ('2026-10-01', '2026-10-20', '2025-01-01', 22, 12, '{nodes[0][0]}', '{nodes[1][0]}', '', 'hub-2')")
    # chdb 2.1 исполняет каждый запрос отдельно — Memory между запросами не живёт
    q('CREATE TABLE prod_proteus.tmp_nd (rk String, sz UInt32, c UInt8) ENGINE = MergeTree ORDER BY tuple()')
    for i in range(0, len(nodes), 2000):
        part = nodes[i:i + 2000]
        q(f'INSERT INTO {P}unit VALUES ' + ','.join(
            "('%s','%s',%d,'Подразделение «%s» уровня %d — длинное название',%d,'%s','login.%s')"
            % (u, p, lvl, u, lvl, len(kids.get(u, [])), path[u], u) for u, p, lvl in part))
        q('INSERT INTO prod_proteus.tmp_nd VALUES ' + ','.join(
            "('%s',%d,%d)" % (u, size[u], min(36, 1 + int(math.log2(max(1, size[u])) / 1.4))) for u, _, _ in part))
    for t, sql in FILL.items():
        q(f'INSERT INTO {P}{t} {sql}')
    q('DROP TABLE prod_proteus.tmp_nd')
    print(f'{db}: узлов {len(nodes)}, людей {size[nodes[0][0]]}; строк — ' + ', '.join(
        f"{t} {q(f'SELECT count() FROM {P}{t}').strip()}" for t in TABLES if t != 'meta'))


if __name__ == '__main__':
    build(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 1.0)
    sys.stdout.flush()
    os._exit(0)          # chdb держит процесс на выходе — выходим сразу

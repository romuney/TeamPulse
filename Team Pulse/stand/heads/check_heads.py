# Сверка выгрузки руководителей с отчётом TeamPulse Hub: каждая строка Excel — как карточка/таблица отчёта у того же юнита.
#
#   python3 stand/heads/check_heads.py <выгрузка.csv> <каталог chdb>   [--from-pg]   # --from-pg: таблицы из PG стенда в chdb
#
# Выгрузку (HEADS_DF → csv) даёт прогон ноутбука на стенде (stand/nb_tp20.py --hub … --yaml <ноут выгрузки>). Отчёт —
# датасет (файл 2) на chdb с фильтром юнита и покраски (HQ, затем Support) и чарт (файл 3) в браузере: значения берутся
# из модели чарта (window.TPDATA) — те же функции, что рисуют карточки: lastVal(reportLeaves(…)), vacancyBreakdown.
import csv, json, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import dataset  # noqa: E402
from chdb import session  # noqa: E402

ROOT = os.path.join(HERE, '..', '..')
dataset.SQL = os.path.join(ROOT, 'Поставка — TeamPulse Hub', '2. Proteus — датасет TeamPulse Hub.sql')
CHART = os.path.join(ROOT, 'Поставка — TeamPulse Hub', '3. Proteus — чарт TeamPulse Hub.js')
TABLES = ['meta', 'unit', 'series', 'mix', 'trf', 'trfe', 'vacancy', 'aiw', 'aix', 'prof', 'pfd', 'flow', 'access']

HOST = '''<!doctype html><html><head><meta charset="utf-8"></head><body>
<div _echarts_instance_="ec_1" style="position:relative;width:1200px;height:800px"></div>
<script>var data=%s;function applyCrossFilter(){};</script><script>%s</script></body></html>'''
PROBE = '''() => {
  const D = window.TPDATA, S = D.DEFAULT_STATE, lp = D.reportLeaves(S), v = k => D.lastVal(lp, k);
  const vb = D.vacancyBreakdown(lp), r = n => ((vb && vb.reason || []).find(x => x.name === n) || {}).value || 0;
  return {scope: D.REAL.scopeId, hc: v('hc_total'), grow: v('net_ytd'), jun: v('junior_share'), nonregret: v('nonregret'),
          regret: v('regret'), vac_new: r('Новый'), vac_rep: r('Замена')};
}'''


def answer(s, unit, paint):
    out, _ = dataset.query(s, dataset.render({'unit_f': [unit], 'paint_f': [paint]}).strip().rstrip(';'), '')
    return [json.loads(l) for l in out.splitlines() if l.strip()]


def main():
    rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
    db = sys.argv[2]
    if '--from-pg' in sys.argv:
        import nb_tp20
        pg = nb_tp20.PG(dict(host='/tmp/pgt', port='55432', user='pg', dbname='postgres'))
        up = nb_tp20.gp_to_click_mock(pg, os.path.dirname(db.rstrip('/')))
        for t in TABLES:
            up(gp_table='teampulse_hub_' + t, clickhouse_table='prod_proteus.teampulse_hub_' + t)
    import subprocess
    chart = open(CHART, encoding='utf-8').read()
    s = session.Session(db)
    tmp = tempfile.mkdtemp()
    jobs = []
    for row in rows:
        for paint in ('Hq', 'Support'):
            path = os.path.join(tmp, f"{row['unit_rk']}_{paint}.html")
            open(path, 'w', encoding='utf-8').write(HOST % (json.dumps(answer(s, row['unit_rk'], paint), ensure_ascii=False, default=str), chart))
            jobs.append({'key': row['unit_rk'] + '|' + paint, 'path': path})
    json.dump(jobs, open(os.path.join(tmp, 'jobs.json'), 'w'))
    open(os.path.join(tmp, 'probe.js'), 'w', encoding='utf-8').write(PROBE)
    R = json.loads(subprocess.run(['node', os.path.join(HERE, 'probe.cjs'), os.path.join(tmp, 'jobs.json'), os.path.join(tmp, 'probe.js')],
                                  capture_output=True, text=True, check=True).stdout)
    bad = 0
    names = {'hc': 'численность HQ', 'sup': 'численность Support', 'grow': 'прирост', 'jun': '% джунов HQ',
             'vac_new': 'активные вакансии новые', 'vac_rep': 'активные вакансии замены', 'nonregret': 'желательная',
             'regret': 'нежелательная'}
    for row in rows:
        u = row['unit_rk']
        hq, sp = R[u + '|Hq'], R[u + '|Support']
        want = {'hc': hq['hc'], 'sup': sp['hc'], 'grow': hq['grow'], 'jun': hq['jun'], 'vac_new': hq['vac_new'],
                'vac_rep': hq['vac_rep'], 'nonregret': hq['nonregret'], 'regret': hq['regret']}
        got = {}
        for k, nm in names.items():
            col = next(c for c in row if c == nm or (k in ('grow', 'nonregret', 'regret') and c.startswith(nm)))
            got[k] = float(row[col]) if row[col] not in ('', None) else None
        diff = [k for k in want if not ((want[k] is None and got[k] is None) or
                                        (want[k] is not None and got[k] is not None and abs(float(want[k]) - got[k]) < 0.006))]
        ok = hq['scope'] == u and sp['scope'] == u and not diff
        bad += not ok
        print(('  ok   ' if ok else '  FAIL ') + f"{row['руководитель']:>10} {row['юнит']:<16}" +
              ' '.join(f'{k}={got[k]}' + ('' if k not in diff else f'(отчёт {want[k]})') for k in want) +
              ('' if hq['scope'] == u else f'  [отчёт открыл {hq["scope"]}]'))
    s.close()
    print('выгрузка руководителей: ' + ('все строки совпадают с отчётом' if not bad else f'расхождений: {bad}'))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()

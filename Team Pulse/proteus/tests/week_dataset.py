"""Weekly monitoring branch of the shipping single dataset (mx key «mw») on local ClickHouse (chdb).
Renders the real template with report filters, runs only the «mw» branch (between /*mw<*/ and /*>mw*/) against a synthetic
prod_proteus.teampulse_hub_series_week and checks: filters through cond(), 16-week window from the last source week,
sums per node × week, empty nodes absent (not zeros). Optional argv[1]: write chart rows (role/id/mx) for week.cjs.
"""
import datetime, json, sys, tempfile
from pathlib import Path
from jinja2 import Environment
from chdb import session

root = Path(__file__).resolve().parents[2]
sql = next((root / 'Поставка — TeamPulse Hub').glob('2. *.sql')).read_text()
tpl = Environment(extensions=['jinja2.ext.do']).from_string(sql)

def branch(filters):
    q = tpl.render(current_username=lambda: 'test_user', filter_values=lambda k: filters.get(k, []))
    assert q.count('/*mw<*/') == 1, 'mw branch must be in the single delivery (PART all)'
    b = q.split('/*mw<*/', 1)[1].split('/*>mw*/', 1)[0]
    return b.replace('(SELECT tupleElement(arrayJoin(cxpk), 1))', "('1', '11', '22')")

last = datetime.date(2026, 11, 16)                       # Monday of the last source week
weeks = [last - datetime.timedelta(days=7 * i) for i in range(20)][::-1]
rows = []
for w in weeks:
    for node, paint, base in (('1', 'HQ', 10), ('1', 'Line', 4), ('11', 'HQ', 6), ('11', 'Line', 4), ('22', 'HQ', 4)):
        hc = base
        rows.append((node, w, paint, 'IT', 'Штат', 'Активная', hc, 8.0 * hc, hc, 12.5 * (hc - 1), hc - 1, 1, hc - 3, 1, 1))
# a node whose people have no work days in the window -> no rows at all

with tempfile.TemporaryDirectory() as tmp:
    db = session.Session(tmp)
    db.query('CREATE DATABASE prod_proteus')
    db.query('''CREATE TABLE prod_proteus.teampulse_hub_series_week (node_rk Nullable(String), report_week Nullable(Date),
      paint_cd Nullable(String), it_cd Nullable(String), staff_cd Nullable(String), act_cd Nullable(String),
      hc_cnt Nullable(Int64), work_time_h Nullable(Float64), share_talk Nullable(Float64), wt_sum Nullable(Float64),
      wt_n Nullable(Int64), tk_sum Nullable(Float64), tk_n Nullable(Int64), over_cnt Nullable(Int64), norm_cnt Nullable(Int64),
      under_cnt Nullable(Int64), grey_cnt Nullable(Int64)) ENGINE=Memory''')
    vals = ','.join(f"('{r[0]}','{r[1]}','{r[2]}','{r[3]}','{r[4]}','{r[5]}',{r[6]},NULL,NULL,{r[7]},{r[8]},{r[9]},{r[10]},"
                    f"{r[11]},{r[12]},{r[13]},{r[14]})" for r in rows)
    db.query('INSERT INTO prod_proteus.teampulse_hub_series_week (node_rk, report_week, paint_cd, it_cd, staff_cd, act_cd, hc_cnt, '
             'work_time_h, share_talk, wt_sum, wt_n, tk_sum, tk_n, over_cnt, norm_cnt, under_cnt, grey_cnt) VALUES ' + vals)
    def run(filters):
        out = str(db.query('SELECT u3, v3 FROM (' + branch(filters) + ') ORDER BY u3, v3', 'TabSeparatedRaw')).strip().split('\n')
        return [tuple(x.split('\t')) for x in out if x]
    allr = run({})
    got = {}
    for u, v in allr:
        wk, nums = v.split('|')
        got[(u, wk)] = [float(x) for x in nums.split(',')]
    wks = sorted({k[1] for k in got})
    assert len(wks) == 16 and wks[0] == str(last - datetime.timedelta(days=105)) and wks[-1] == str(last), wks
    assert got[('1', str(last))] == [14, 112, 14, 12.5 * 12, 12, 2, 8, 2, 2], got[('1', str(last))]
    assert got[('22', str(last))][0] == 4 and len(got[('22', str(last))]) == 9
    hq = {(u, v.split('|')[0]): float(v.split('|')[1].split(',')[0]) for u, v in run({'paint_f': ['HQ']})}
    assert hq[('1', str(last))] == 10 and hq[('11', str(last))] == 6, hq          # Line slices filtered out by cond()
    assert not run({'paint_f': ['Support']}), 'filtered-out selection gives no rows, not zeros'
    db.close()
print('PASS: mw branch — filters via cond(), 16 source weeks, sums per node × week, empty selection without zero rows')
if len(sys.argv) > 1:
    by = {}
    for u, v in allr:
        by.setdefault(u, []).append('mw\t' + v + '\t1')
    Path(sys.argv[1]).write_text(json.dumps({'last': str(last), 'mx': {u: '\n'.join(x) for u, x in by.items()}}, ensure_ascii=False))

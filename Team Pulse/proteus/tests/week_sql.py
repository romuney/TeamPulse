"""Weekly monitoring SQL («hub · 3в») on synthetic PostgreSQL data (GP decode/DISTRIBUTED BY adapted).
WEEK_TEST_DSN must point to an isolated test database; every object is created in a temporary schema and rolled back.
Checks the owner's decisions of 26.11: a week is counted whole (no month split), unit = end of the Sunday's month
(last data month if that month has no data yet), sums for exact re-aggregation. Prints aggregate rows only.
"""
import datetime, json, os, re, sys
from pathlib import Path
import psycopg2
import yaml

ROOT = Path(__file__).resolve().parents[2]
SQL = (ROOT / 'stand/hub_nb/sql_3v_week.sql').read_text()
nb = yaml.safe_load(next((ROOT / 'Поставка — TeamPulse Hub').glob('1. *.yaml')).read_text())
par = next(p for p in nb['paragraphs'] if p['title'].startswith('hub · 3в'))
assert par.get('isEnabled', True) and par['code'].strip() == SQL.strip(), 'notebook paragraph differs from stand/hub_nb'
pg = SQL.replace("decode(ec.attendance_group_nm, 'Работа', 1, 0)", "case when ec.attendance_group_nm = 'Работа' then 1 else 0 end")
pg = re.sub(r'\s+distributed by \([^)]+\)', '', pg, flags=re.I)

conn = psycopg2.connect(os.environ['WEEK_TEST_DSN'])
cur = conn.cursor()
try:
    cur.execute('create schema wk_t; set search_path = wk_t, public;'
                'create schema prod_v_sse_crossdata; create schema prod_v_hrmart;')
    cur.execute('''
      create table prod_v_sse_crossdata.performance_metric_d(mdm_employee_rk int, calendar_dt date,
        reduced_duration_hour numeric, duration_hour numeric, talk_call_duration_h numeric, performance_category text);
      create table prod_v_hrmart.mdm_employee_attendance(mdm_employee_rk int, attendance_dt date, attendance_group_nm text);
      create table wk_t.all_metrics_with_performance_and_office_traffic_and_grt(mdm_employee_rk int, report_month date,
        last_row_flg int, leaf_lvl int, mng_unit_rk text, paint_cd text, emp_specialization_it_code text,
        employment_relation_type text, act_type_nm text, lvl1_rk text, lvl2_rk text, lvl3_rk text, lvl4_rk text,
        lvl5_rk text, lvl6_rk text, lvl7_rk text, lvl8_rk text, lvl9_rk text, lvl10_rk text, lvl11_rk text);
      create table wk_t.teampulse_hub_cal(pre text); insert into wk_t.teampulse_hub_cal values ('');
      create table wk_t.teampulse_hub_upath(unit_rk text, cp text);
      insert into wk_t.teampulse_hub_upath values ('11', '1|11'), ('22', '1|22');''')
    cur.execute('select extract(year from current_date)::int')
    y = cur.fetchone()[0]
    d = lambda m, dd: f'{y}-{m:02d}-{dd:02d}'
    # The week Mon 31.08 – Sun 06.09 of the current year crosses August/September (true for 2026); pick any year's
    # Monday nearest to 31.08 so the test is calendar-independent.
    cur.execute(f"select date_trunc('week', '{d(9, 3)}'::date)::date")
    mon = cur.fetchone()[0]
    days = [mon + datetime.timedelta(days=i) for i in range(5)]
    rows = []
    # e1: unit 11 both months; 3 normal + 2 low over the whole week; hours 8,8,9,9,9; talk 1,1,2,2,2
    for i, (cat, h, t) in enumerate([('normal', 8, 1), ('low', 8, 1), ('low', 9, 2), ('normal', 9, 2), ('normal', 9, 2)]):
        rows.append((1, days[i], None, h, t, cat))
    # e2: unit 11 in the Monday's month, unit 22 in the Sunday's month; high every day, 10 h, no calls
    for i in range(5):
        rows.append((2, days[i], None, 10, 0, 'high'))
    # e3: Line paint, unit 11; zero hours all week -> share is undefined (tk_n smaller than hc)
    for i in range(5):
        rows.append((3, days[i], None, 0, 0, 'grey'))
    # e4: only a weekend day without the «Работа» day type -> not in the week at all
    rows.append((4, mon + datetime.timedelta(days=5), None, 5, 1, 'normal'))
    # e1 next week fully inside one month: reduced_duration_hour > 7 wins over duration_hour
    nxt = [mon + datetime.timedelta(days=7 + i) for i in range(5)]
    for i in range(5):
        rows.append((1, nxt[i], 7.5, 6, 1.5, 'normal'))
    # e1, a week whose Sunday falls into a month the HR table does not have yet -> unit of the last data month
    sunday_m2 = (mon + datetime.timedelta(days=6)).replace(day=1)
    nxt_month = (sunday_m2 + datetime.timedelta(days=32)).replace(day=1)
    W3 = nxt_month - datetime.timedelta(days=(nxt_month.weekday() or 7))       # Monday before the 1st of next month
    for i in range(5):
        rows.append((1, W3 + datetime.timedelta(days=i), None, 8, 1, 'normal'))
    cur.executemany('insert into prod_v_sse_crossdata.performance_metric_d values (%s,%s,%s,%s,%s,%s)', rows)
    cur.execute("insert into prod_v_hrmart.mdm_employee_attendance select mdm_employee_rk, calendar_dt, "
                "case when extract(dow from calendar_dt) in (0, 6) then 'Выходной' else 'Работа' end "
                "from prod_v_sse_crossdata.performance_metric_d")
    m1, m2 = days[0].replace(day=1), (mon + datetime.timedelta(days=6)).replace(day=1)
    am = [(1, m1, '11', 'HQ'), (1, m2, '11', 'HQ'), (2, m1, '11', 'HQ'), (2, m2, '22', 'HQ'), (3, m1, '11', 'Line'), (3, m2, '11', 'Line')]
    cur.executemany("insert into wk_t.all_metrics_with_performance_and_office_traffic_and_grt(mdm_employee_rk, report_month, "
                    "last_row_flg, leaf_lvl, mng_unit_rk, paint_cd, emp_specialization_it_code, employment_relation_type, "
                    "act_type_nm, lvl1_rk, lvl2_rk) values (%s,%s,1,2,%s,%s,'IT','Штатный сотрудник','Активная','1',%s)",
                    [(e, m, u, p, u) for e, m, u, p in am])
    cur.execute(pg)
    cur.execute('select node_rk, report_week, paint_cd, hc_cnt, wt_sum, wt_n, tk_sum, tk_n, over_cnt, norm_cnt, under_cnt, '
                'grey_cnt from wk_t.teampulse_hub_series_week order by 1, 2, 3')
    out = cur.fetchall()
    by = {(r[0], r[1], r[2]): r for r in out}
    W1 = mon
    # One person = one row a week: the root counts e1, e2, e3 once each in the month-crossing week.
    assert sum(r[3] for k, r in by.items() if k[0] == '1' and k[1] == W1) == 3, out
    e1 = by[('11', W1, 'HQ')]
    assert e1[3] == 1 and e1[9] == 1 and e1[10] == 0, e1                     # whole week: 3 normal > 2 low -> normal
    assert abs(float(e1[4]) - 8.6) < 1e-9 and e1[5] == 1, e1                 # (8+8+9+9+9)/5
    assert abs(float(e1[6]) - 8 / 43 * 100) < 1e-9 and e1[7] == 1, e1        # avg(talk)/avg(hours)*100 over the week
    assert by[('22', W1, 'HQ')][3] == 1 and by[('22', W1, 'HQ')][8] == 1      # e2 — unit of the Sunday's month
    assert ('11', W1, 'HQ') in by and by[('11', W1, 'HQ')][3] == 1            # e2 is not also counted in unit 11
    e3 = by[('11', W1, 'Line')]
    assert e3[3] == 1 and e3[5] == 1 and e3[7] == 0 and e3[11] == 1, e3       # zero hours: share undefined, not 0
    assert not any(r[1] == mon + datetime.timedelta(days=5) for r in out)
    W2 = nxt[0]
    w2 = by[('11', W2, 'HQ')]
    assert w2[3] == 1 and abs(float(w2[4]) - 7.5) < 1e-9 and abs(float(w2[6]) - 20) < 1e-9, w2
    assert W3.month == sunday_m2.month and (W3 + datetime.timedelta(days=6)).month != W3.month
    assert by[('11', W3, 'HQ')][3] == 1, 'week into a month without HR data keeps the last data month unit'
    print('PASS: whole weeks across months, one row per person, unit of the Sunday month, category over all work days, '
          'sums for exact re-aggregation, undefined share kept out of tk_n, weekend-only person excluded, '
          'week into a month without HR data')
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(json.dumps([[str(c) if not isinstance(c, (int, float)) else c for c in r] for r in out],
                                                ensure_ascii=False, default=str))
finally:
    conn.rollback()
    conn.close()

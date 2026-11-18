"""Run the delivery's review SQL on synthetic PostgreSQL data (GP DISTRIBUTED BY removed).
REVIEW_TEST_DSN must point to an isolated test database; tables roll back after this run.
Outputs only aggregate fixtures, never employee-level data.
"""
import json, os, re, sys
from pathlib import Path
import psycopg2

ROOT=Path(__file__).resolve().parents[2]
SQL=(ROOT/'stand/hub_nb/sql_review.sql').read_text()
SQL=re.sub(r'\s+distributed by \([^)]+\)', '', SQL, flags=re.I)
conn=psycopg2.connect(os.environ['REVIEW_TEST_DSN'])
cur=conn.cursor()
try:
    cur.execute('select extract(year from current_date)::int')
    year=cur.fetchone()[0]
    cur.execute('''create schema usr_cross_data; create schema prod_v_hrmart;
      create table usr_cross_data.eligible(mdm_employee_rk int,eligible_flg int);
      create table prod_v_hrmart.summary_evaluation(mdm_employee_rk int,business_dt date,
        status_desc text,summary_score text,deleted_flg int default 0,valid_to_dttm timestamp default '5999-01-01');
      create table teampulse_hub_cal(lm date,pre text,dt date);
      insert into teampulse_hub_cal values(date_trunc('month',current_date)::date,'',current_date);
      create table teampulse_hub_upath(unit_rk text,cp text);
      insert into teampulse_hub_upath values('11','1|11'),('22','1|22');
      create table teampulse_hub_mix(node_rk text,paint_cd text,it_cd text,staff_cd text,act_cd text,
        mx_key text,mx_val text,mx_n numeric);
      insert into teampulse_hub_mix values('legacy','HQ','IT','Штат','Активная','gr','H1',42);
      create table all_metrics_with_performance_and_office_traffic_and_grt(
        mdm_employee_rk int,mng_unit_rk text,report_month date,leaf_lvl int,hc_total_cnt int,
        paint_cd text,emp_specialization_it_code text,employment_relation_type text,act_type_nm text,
        grade text,experience_group_nm text,specialization text,
        lvl1_rk text,lvl2_rk text,lvl3_rk text,lvl4_rk text,lvl5_rk text,lvl6_rk text,
        lvl7_rk text,lvl8_rk text,lvl9_rk text,lvl10_rk text,lvl11_rk text);
      insert into all_metrics_with_performance_and_office_traffic_and_grt
        (mdm_employee_rk,mng_unit_rk,report_month,leaf_lvl,hc_total_cnt,paint_cd,emp_specialization_it_code,
         employment_relation_type,act_type_nm,grade,experience_group_nm,specialization,lvl1_rk,lvl2_rk)
        select i,case when i=13 then '22' else '11' end,date_trunc('month',current_date)::date,2,1,
          case when i=13 then 'Line' else 'HQ' end,'IT','Штатный сотрудник','Активная',
          case when i=7 then null when i<4 then 'H1' else 'G1' end,
          case when i<5 then 'До 1 года' else '1–3 года' end,
          case when i=8 then null else 'Разработка' end,'1',case when i=13 then '22' else '11' end
        from generate_series(1,13) i;
      insert into usr_cross_data.eligible select i,case when i=9 then 0 else 1 end from generate_series(1,13) i where i<>10;
    ''')
    def rating(person,y,score,status='Оценка выставлена',deleted=0,until='5999-01-01'):
        cur.execute('insert into prod_v_hrmart.summary_evaluation values(%s,%s,%s,%s,%s,%s)',
                    (person,f'{y}-01-01',status,score,deleted,until))
    for person,current,prev in [(1,'3','2'),(2,'0','1'),(3,'4',None),(4,'2',None),(5,'2','2'),
                                (6,'4',None),(7,'5',None),(8,None,'0'),(9,'4','0'),(10,'4',None),
                                (11,'1',None),(12,'0',None),(13,'4','2')]:
        if current is not None:rating(person,year,current,'Калибровка' if person==6 else 'Оценка выставлена')
        if prev is not None:rating(person,year-1,prev)
    rating(4,year-2,'1');rating(11,year-3,'0')
    rating(11,year-1,'2','Оценка руководителем');rating(12,year-1,'3','Калибровка')
    rating(1,year,'1',until=f'{year}-02-01');rating(3,year-2,'1',deleted=1)
    rating(3,year+1,'1')
    cur.execute(SQL)
    cur.execute("select node_rk,paint_cd,it_cd,staff_cd,act_cd,mx_key,mx_val,mx_n from teampulse_hub_review_test where mx_key <> 'rvmeta' order by 1,6,7")
    rows=cur.fetchall();nodes={}
    for node,paint,it,staff,act,k,v,n in rows:
        m=nodes.setdefault(node,{}).setdefault(k,{})
        m[v]=m.get(v,0)+int(n)
    cur.execute('select * from teampulse_hub_mix')
    assert cur.fetchall()==[('legacy','HQ','IT','Штат','Активная','gr','H1',42)], 'Review must preserve the shared production mix'
    cur.execute("select mx_val from teampulse_hub_review_test where mx_key='rvmeta'")
    assert cur.fetchone()[0]==str(year)
    expected=dict(all=13,eligible=11,rated=8,up=2,down=1,same=1,first=2,unpaired=2,missing=3)
    assert nodes['1']['rvc']==expected,(nodes['1']['rvc'],expected)
    assert nodes['1']['rvfirst']=={'0':1,'4':1}
    assert nodes['1']['rvtr']=={'1|0':1,'2|3':1,'2|4':1}
    assert nodes['11']['rvc']['eligible']==10 and nodes['22']['rvc']['eligible']==1
    assert nodes['1']['rvgr']['|na']==1 and nodes['1']['rvsp']['|na']==1
    # Same snapshot/filters: the HQ slice excludes the one Line employee.
    cur.execute("select sum(mx_n) from teampulse_hub_review_test where node_rk='1' and paint_cd='HQ' and mx_key='rvc' and mx_val='eligible'")
    assert cur.fetchone()[0]==10
    if len(sys.argv)>1:Path(sys.argv[1]).write_text(json.dumps({'version':f'hub-2-review-1|{year}','nodes':nodes},ensure_ascii=False))
    # Contract failures must not silently pick a row or multiply HR counts.
    for violation in ('eligible','rating','snapshot'):
        cur.execute('savepoint invalid_contract')
        if violation=='eligible':cur.execute('insert into usr_cross_data.eligible values(1,1)')
        elif violation=='rating':rating(1,year,'4')
        else:cur.execute("insert into all_metrics_with_performance_and_office_traffic_and_grt select * from all_metrics_with_performance_and_office_traffic_and_grt where mdm_employee_rk=1")
        if violation=='snapshot':
            # Identical snapshots deduplicate; conflicting attributes must fail.
            cur.execute("update all_metrics_with_performance_and_office_traffic_and_grt set grade='Conflicting' where ctid=(select max(ctid) from all_metrics_with_performance_and_office_traffic_and_grt where mdm_employee_rk=1)")
        try:cur.execute(SQL)
        except psycopg2.errors.RaiseException as e:assert 'Review:' in str(e)
        else:raise AssertionError('Duplicate contract was accepted: '+violation)
        cur.execute('rollback to savepoint invalid_contract')
    print('PASS: annual SQL, final statuses, score 0, eligibility, all-history first review, missing year, source NULLs, current SCD2, deleted/future records, HR filters, 3 duplicate failures')
finally:
    conn.rollback();conn.close()

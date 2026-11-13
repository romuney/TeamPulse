import sys,time,json,re,hashlib,argparse
from pathlib import Path
import os
R=Path(__file__).resolve().parents[4]
sys.path[:0]=[str(R/'proteus-playbook/kit'),str(R/'Team Pulse/stand')]
import superset201 as k, split_check as sc
from chdb import session
OUT=Path(os.environ.get('TP_SQL_STUDY', '/tmp/tp-sql-study'))
COLS='role id pid lvl nm kids j ms mx'.split()
P='prod_proteus.'
def template(part):
 if part=='all': return (OUT/'source-snapshot/ordinary.sql').read_text().replace('{% set FULL = [] %}', "{% set FULL = ['tester'] %}")
 paths=list((OUT/'source-snapshot').glob('2.* '+part+' *.sql'))
 assert len(paths)==1,(part,paths)
 return paths[0].read_text().replace('{% set FULL = [] %}',"{% set FULL = ['tester'] %}")
def render(part,user='tester',filters=None,variant='base'):
 # Substitute before rendering: the unchanged me() macro applies trim/lower,
 # FULL-only impersonation and the same escaping as the ordinary dataset.
 source=template(part)
 if variant!='base': source=candidate_template(source,variant)
 r=k.render(source,user=user,filters=filters or {},columns=COLS)
 assert not r.error,r.error
 return r.text

def fa(sql):
 mark='arrayMap(x -> x.2, arraySort(groupArray((t.lv, t.id)))) AS zq'
 pos=sql.index(mark); a=sql.rfind('CROSS JOIN (SELECT',0,pos); b=sql.index(') AS fa',pos)+len(') AS fa')
 assert a>=0
 return a,b,sql[a+len('CROSS JOIN ('):b-len(') AS fa')]
def fdb(sql):
 a=sql.index('fdb AS ('); b=sql.index('fdv AS (',a); end=sql.rfind(')',a,b)
 return a,end+1,sql[a+len('fdb AS ('):end]
def candidate_template(sql,variant):
 assert variant in ('base','zone','fdb','both','scan','scan_both','peer','peer_both','query','query_both'),variant
 if variant.startswith('query'):
  from query_variant import transform,transform_peer
  sql=transform_peer(transform(sql))
  variant='both' if variant=='query_both' else 'base'
 if variant.startswith('peer'):
  from query_variant import transform_peer
  sql=transform_peer(sql)
  variant='both' if variant=='peer_both' else 'base'
 if variant.startswith('scan'):
  from query_variant import transform
  sql=transform(sql)
  variant='both' if variant=='scan_both' else 'base'
 if variant in ('zone','both'):
  a,b,_=fa(sql)
  sql=sql[:a]+"CROSS JOIN (SELECT any(zq) AS zq, any(anq) AS anq FROM prod_proteus.tpbench_zone WHERE login = {{ me() }}) AS fa"+sql[b:]
 if variant in ('fdb','both') and 'fdb AS (' in sql:
  a,b,_=fdb(sql);sql=sql[:a]+'fdb AS (SELECT * FROM prod_proteus.tpbench_fdb)'+sql[b:]
 return sql

def blocks(mx):
 # Order within a block is immaterial, but multiplicity is not: the browser
 # accumulates duplicate metric rows. Preserve all fields rather than a set.
 out=[];key=''
 for line in (mx or '').split('\n'):
  if not line: continue
  fields=line.split('\t')
  if fields[0]: key=fields[0]
  out.append(tuple([key]+fields[1:]))
 return sorted(out)
def canonical(raw):
 rows=raw if isinstance(raw,list) else [json.loads(l) for l in str(raw).splitlines() if l]
 out=[]
 keys=set()
 for r in rows:
  r=dict(r)
  key=(r['role'],r['id']);assert key not in keys,('duplicate row key',key)
  keys.add(key)
  if r.get('role')=='meta':
   j=json.loads(r['j']);j.pop('today',None);r['j']=j
  elif r.get('role')=='part':r['j']=json.loads(r['j'])
  r['mx']=blocks(r.get('mx',''))
  out.append(r)
 return json.dumps(sorted(out,key=lambda r:(r['role'],r['id'])),sort_keys=True,ensure_ascii=False)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('db');ap.add_argument('--measure-only',action='store_true');ap.add_argument('--threads',type=int,default=4);ap.add_argument('--prepare',action='store_true');ap.add_argument('--bench',action='store_true');ap.add_argument('--parts',default='dict,core,people,flow,aux');ap.add_argument('--variants',default='base,zone,fdb,both');ap.add_argument('--repeats',type=int,default=3);ap.add_argument('--label',default='small');ap.add_argument('--user',default='tester');ap.add_argument('--filters',default='{}');ap.add_argument('--users',help='explicit JSON principal sample; omitted = all access/head principals');args=ap.parse_args()
 s=session.Session(args.db+'?config-file='+str(OUT/'ch-config.xml'));q=lambda sql,fmt='JSONEachRow':s.query(sql,fmt)
 assert '24.8.' in str(q('SELECT version()','TSV'))
 q('SET allow_experimental_analyzer=1, prefer_column_name_to_alias=1, max_threads='+str(args.threads)+', max_memory_usage=4000000000')
 if args.prepare:
  assert Path(args.db).resolve().is_relative_to(OUT.resolve()),'test-only preparation must stay below /tmp/tp-sql-study'
  tables=str(q('SHOW TABLES FROM prod_proteus','TSV')).split()
  if 'teampulse_hub_access' not in tables:
   q('CREATE TABLE prod_proteus.teampulse_hub_access (login Nullable(String),unit_rk Nullable(String)) ENGINE=MergeTree ORDER BY tuple()')
  # Seed rights even when the notebook already created access. Existing rows
  # remain untouched and repeated preparation must not introduce duplicates.
  q("INSERT INTO prod_proteus.teampulse_hub_access SELECT 'full.leaves',unit_rk FROM prod_proteus.teampulse_hub_unit WHERE kids_cnt=0 AND unit_rk NOT IN (SELECT ifNull(unit_rk,'') FROM prod_proteus.teampulse_hub_access WHERE login='full.leaves')")
  q("INSERT INTO prod_proteus.teampulse_hub_access SELECT 'branch.user',unit_rk FROM (SELECT unit_rk FROM prod_proteus.teampulse_hub_unit WHERE unit_lvl=4 ORDER BY unit_rk LIMIT 1) WHERE unit_rk NOT IN (SELECT ifNull(unit_rk,'') FROM prod_proteus.teampulse_hub_access WHERE login='branch.user')")
  # Cover every effective principal, including head-only and empty logins.
  # An unknown login is intentionally absent: aggregate any(Array) yields []
  # and the unchanged cx0 determines no-access instead of borrowing a zone.
  users=['tester','']
  principals=str(q("SELECT DISTINCT lowerUTF8(trimBoth(ifNull(toString(login),''))) AS login FROM (SELECT login FROM prod_proteus.teampulse_hub_access UNION ALL SELECT head_login AS login FROM prod_proteus.teampulse_hub_unit) ORDER BY login"))
  users+= [r['login'] for r in map(json.loads,principals.splitlines())]
  users=list(dict.fromkeys(users))
  users_total=len(users)
  if args.users is not None:
   users=list(dict.fromkeys(str(u).strip().lower() for u in json.loads(args.users)))
  q('DROP TABLE IF EXISTS prod_proteus.tpbench_zone')
  q('CREATE TABLE prod_proteus.tpbench_zone (login String,zq Array(String),anq Array(String)) ENGINE=MergeTree ORDER BY login')
  t=time.perf_counter();per_user=[]
  for u in users:
   user_start=time.perf_counter()
   _,_,body=fa(render('core',u))
   literal="'"+u.replace('\\','\\\\').replace("'","\\'")+"'"
   q("INSERT INTO prod_proteus.tpbench_zone SELECT "+literal+",zq,anq FROM ("+body+")")
   per_user.append({'login':u,'seconds':time.perf_counter()-user_start})
  zone_s=time.perf_counter()-t
  _,_,body=fdb(render('core'))
  body=body.replace('cxlm',"(SELECT toDate(assumeNotNull(last_month)) FROM prod_proteus.teampulse_hub_meta LIMIT 1)")
  q('DROP TABLE IF EXISTS prod_proteus.tpbench_fdb');t=time.perf_counter();q('CREATE TABLE prod_proteus.tpbench_fdb ENGINE=MergeTree ORDER BY u7 AS '+body)
  info={'users':len(users),'users_total':users_total,'sampled':args.users is not None,'zone_users':per_user,'zone_prepare_s':zone_s,'fdb_prepare_s':time.perf_counter()-t,'rows':{name:int(str(q('SELECT count() FROM prod_proteus.'+name,'TSV')).strip()) for name in ['teampulse_hub_unit','teampulse_hub_series','teampulse_hub_access','tpbench_fdb']}}
  print(json.dumps(info),flush=True);(OUT/(args.label+'-prepare.json')).write_text(json.dumps(info,indent=2))
 if args.bench:
  results=[];compiled={};rendered={};filters=json.loads(args.filters)
  for part in args.parts.split(','):
   raw=render(part,args.user,filters)
   counts={t:len(re.findall('FROM prod_proteus.teampulse_hub_'+t+r'\b',raw)) for t in ['unit','access','series','trf','flow','vacancy']}
   for variant in args.variants.split(','):
    sql=raw if variant=='base' else render(part,args.user,filters,variant)
    t=time.perf_counter();p=k.chart_path(sql,COLS);assert not p['error'],p['error'];path_seconds=time.perf_counter()-t
    compiled[part,variant]=p['texts']['executed'];rendered[part,variant]=sql
    cache=OUT/(args.label+'-sql');cache.mkdir(exist_ok=True)
    (cache/(part+'-'+variant+'.sql')).write_text(compiled[part,variant])
    print('compiled',args.label,part,variant,round(path_seconds,3),flush=True)
    results.append({'part':part,'variant':variant,'path_s':path_seconds,'key_parse_s':p['parse_for_key'],'steps':p['steps'],'sql_bytes':len(sql.encode()),'baseline_text_refs':counts,'path_samples':[path_seconds],'key_samples':[p['parse_for_key']],'ch_s':[]})
  expect={}
  for repeat in range(args.repeats):
   order=results if repeat%2==0 else list(reversed(results))
   for item in order:
    if repeat:
     t=time.perf_counter();check=k.chart_path(rendered[item['part'],item['variant']],COLS);assert not check['error'],check['error']
     assert check['texts']['executed']==compiled[item['part'],item['variant']]
     item['path_samples'].append(time.perf_counter()-t);item['key_samples'].append(check['parse_for_key'])
    t=time.perf_counter();raw=q(compiled[item['part'],item['variant']]);elapsed=time.perf_counter()-t
    value=canonical(raw);part=item['part']
    if part not in expect:expect[part]=value
    same=value==expect[part]
    item.setdefault('strict_equal',[]).append(same)
    if not args.measure_only:assert same,('RESULT MISMATCH',part,item['variant'],repeat)
    item['ch_s'].append(elapsed);item['response_bytes']=len(str(raw).encode());item['sha256']=hashlib.sha256(value.encode()).hexdigest()
    for field,dest in [('rows_read','result_rows'),('bytes_read','result_bytes'),('elapsed','driver_elapsed')]:
     v=getattr(raw,field);item.setdefault(dest,[]).append(v() if callable(v) else v)
    print(args.label,repeat,part,item['variant'],round(elapsed,3),'PASS' if same else 'STRICT_MISMATCH',flush=True)
    (OUT/(args.label+'-results.json')).write_text(json.dumps(results,indent=2))
 s.close()
if __name__=='__main__':main()

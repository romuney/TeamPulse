"""Synthetic-only oracle for materialized SQL constituents; never a deploy tool.

--prepare seeds additional rights/head cases and rebuilds snapshots in the local
study DB. Every candidate part is checked against its untouched SQL equivalent;
both sets of parts must also merge to the ordinary all response. Counters retain
duplicate mx entries, and duplicate (role,id) envelopes fail explicitly.
"""
import argparse,json,subprocess,sys,time
from pathlib import Path
import study as st

def quote(s):return "'"+str(s).replace('\\','\\\\').replace("'","''")+"'"
def rows(raw):return [json.loads(line) for line in str(raw).splitlines() if line.strip()]
def connection(db):
 s=st.session.Session(db)
 s.query('SET allow_experimental_analyzer=1, prefer_column_name_to_alias=1, max_threads=4, max_memory_usage=4000000000')
 return s
def seed(db):
 assert Path(db).resolve().is_relative_to(st.OUT.resolve()),'synthetic study database only'
 s=connection(db);q=lambda sql:s.query(sql,'JSONEachRow')
 units=rows(q('SELECT unit_rk AS id,parent_rk AS pid,path_rk AS path,unit_lvl AS lvl,kids_cnt AS kids,head_login AS head FROM prod_proteus.teampulse_hub_unit ORDER BY unit_lvl,unit_rk'))
 branches=[u for u in units if u['lvl']==4 and u['kids']>0]
 assert len(branches)>=2,'fixture needs two populated branches'
 leaves=[u for u in units if u['kids']==0];assert len(leaves)>2
 def grant(login,ids):
  if not ids:return
  sql='SELECT '+quote(login)+',unit_rk FROM prod_proteus.teampulse_hub_unit WHERE unit_rk IN ('+','.join(map(quote,ids))+')'
  sql+=' AND unit_rk NOT IN (SELECT ifNull(unit_rk,\'\') FROM prod_proteus.teampulse_hub_access WHERE login='+quote(login)+')'
  q('INSERT INTO prod_proteus.teampulse_hub_access '+sql)
 # Preserve the original head's access, then give test-only heads actual rights
 # via head_login with no access row on that branch. This exercises the union.
 for branch,principal in zip(branches[:2],['tpstudy.combined','tpstudy.head.only']):
  if branch['head'] and branch['head']!=principal:grant(branch['head'],[branch['id']])
  q('ALTER TABLE prod_proteus.teampulse_hub_unit UPDATE head_login='+quote(principal)+' WHERE unit_rk='+quote(branch['id'])+' SETTINGS mutations_sync=2')
 grant('tpstudy.combined',[u['id'] for u in leaves if branches[0]['id'] not in u['path'].split('|')])
 grant('tpstudy.partial',[u['id'] for u in leaves[1:]])
 grant('tpstudy.multi',[leaves[0]['id'],leaves[-1]['id']])
 s.close()

def main():
 ap=argparse.ArgumentParser();ap.add_argument('db');ap.add_argument('--prepare',action='store_true');ap.add_argument('--variants',default='both');ap.add_argument('--parts',default='dict,core,people,flow,aux');ap.add_argument('--label',default='small');ap.add_argument('--case',action='append',help='exact case name, repeatable');args=ap.parse_args()
 if args.prepare:
  seed(args.db)
  subprocess.run([sys.executable,str(Path(__file__).with_name('study.py')),args.db,'--prepare','--label','small-checked'],check=True)
 s=connection(args.db);q=lambda sql:s.query(sql,'JSONEachRow')
 units=rows(q('SELECT unit_rk AS id,parent_rk AS pid,path_rk AS path,unit_lvl AS lvl,kids_cnt AS kids,head_login AS head FROM prod_proteus.teampulse_hub_unit ORDER BY unit_lvl,unit_rk'))
 root=units[0]['id'];branch=next(u for u in units if u['lvl']==4)
 leaf=next(u for u in units if not u['kids'] and branch['id'] in u['path'].split('|'))
 cases=[
  ('full-admin','tester',{}),('all-leaves','full.leaves',{}),
  ('all-leaves-plus-head','tpstudy.combined',{}),('one-leaf-missing','tpstudy.partial',{}),
  ('head-only','tpstudy.head.only',{}),('multiple-roots','tpstudy.multi',{}),
  ('branch','branch.user',{}),('branch-child','branch.user',{'unit_f':[leaf['id']]}),
  ('outside-zone','branch.user',{'unit_f':[root]}),('unknown-unit','branch.user',{'unit_f':['does-not-exist']}),
  ('unknown-login','nobody.at.all',{}),('blank-login','',{}),
  ('normalized-login','  TPSTUDY.HEAD.ONLY  ',{}),
  ('admin-as-branch','tester',{'as_f':['  BRANCH.USER  ']}),
  ('admin-as-noaccess','tester',{'as_f':['nobody.at.all']}),
  ('nonadmin-as-ignored','branch.user',{'as_f':['tester']}),
  ('granularity-filters','tester',{'unit_f':[branch['id']],'paint_f':['Hq'],'it_f':['IT'],'staff_f':['Штат']}),
  ('all-headcount','tester',{'act_f':['Вся']}),
  ('hq-only','tester',{'paint_f':['Hq']}),
  ('line-all','tester',{'paint_f':['Line'],'act_f':['Вся']}),
  ('empty-selected-data','tester',{'paint_f':['does-not-exist'],'act_f':['does-not-exist']}),
 ]
 if args.case:cases=[c for c in cases if c[0] in args.case]
 variants=args.variants.split(',');selected=args.parts.split(',');assert set(selected)<=set(st.sc.PARTS)
 results=[];part_checks=0;row_count=0;started=time.perf_counter()
 def execute(part,user,filters,variant='base'):
  sql=st.render(part,user,filters,variant)
  path=st.k.chart_path(sql,st.COLS);assert not path['error'],path['error']
  result=rows(q(path['texts']['executed']))
  st.canonical(result)  # fail duplicate envelopes before merge can overwrite
  assert sum(r['role']=='end' for r in result)==1,(part,variant,'missing/multiple end')
  return result
 def equal(a,b,where):
  if st.canonical(a)!=st.canonical(b):
   (st.OUT/'checker-mismatch.json').write_text(json.dumps({'where':where,'actual':a,'golden':b},ensure_ascii=False))
   raise AssertionError((where,'mismatch details in checker-mismatch.json'))
 for name,user,filters in cases:
  t=time.perf_counter();whole=execute('all',user,filters)
  golden={p:execute(p,user,filters) for p in st.sc.PARTS}
  all_without_end=[r for r in whole if r['role']!='end']
  equal(st.sc.merge(golden),all_without_end,(name,'ordinary parts vs ordinary all'))
  meta=json.loads(next(r['j'] for r in whole if r['role']=='meta'))
  if name in ['all-leaves','all-leaves-plus-head']:assert meta['full']==1,(name,'must actually cover all leaves')
  if name=='one-leaf-missing':assert meta['full']==0 and meta['ok']==1,(name,'must retain a partial zone')
  if name in ['head-only','multiple-roots']:assert meta['ok']==1 and meta['full']==0,(name,'fixture lacks restricted access')
  if name=='multiple-roots':assert len(meta['zone'])>=2,(name,'fixture needs multiple roots')
  if name in ['unknown-login','blank-login','admin-as-noaccess']:assert meta['ok']==0,(name,'expected no access')
  case_rows=0
  for variant in variants:
   actual=dict(golden)
   for p in selected:
    actual[p]=execute(p,user,filters,variant);equal(actual[p],golden[p],(name,variant,p))
    part_checks+=1;case_rows+=len(actual[p]);row_count+=len(actual[p])
   echoes=[json.loads(next(r['j'] for r in actual[p] if r['role']=='part')) for p in st.sc.PARTS]
   keys=['ok','scope','req','paint','it','staff','act','bt']
   assert all({k:e[k] for k in keys}=={k:echoes[0][k] for k in keys} for e in echoes),name
   equal(st.sc.merge(actual),all_without_end,(name,variant,'merged candidate vs ordinary all'))
  result={'case':name,'variants':variants,'parts':len(selected)*len(variants),'candidate_rows':case_rows,'seconds':time.perf_counter()-t,'ok':True}
  results.append(result);print('PASS',name,'parts',result['parts'],'rows',case_rows,'seconds',round(result['seconds'],2),flush=True)
  (st.OUT/(args.label+'-check-results.json')).write_text(json.dumps(results,indent=2))
 s.close()
 summary={'cases':len(cases),'parts_tested':selected,'part_comparisons':part_checks,'candidate_rows':row_count,'merged_vs_ordinary_all':len(cases)*len(variants),'seconds':time.perf_counter()-started,'PASS':True}
 (st.OUT/(args.label+'-check-summary.json')).write_text(json.dumps(summary,indent=2))
 print(json.dumps(summary),flush=True)
if __name__=='__main__':main()

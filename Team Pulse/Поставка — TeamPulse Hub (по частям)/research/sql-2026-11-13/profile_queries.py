import json,time,argparse
import study as t
from chdb import session
EVENTS=['SelectedRows','SelectedBytes','SelectedMarks','ReadBufferFromFileDescriptorReadBytes']
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--label',default='scale-main');ap.add_argument('--parts',default='dict,core,people,flow,aux');ap.add_argument('--variants',default='base,both');a=ap.parse_args()
 s=session.Session(str(t.OUT/'scale')+'?config-file='+str(t.OUT/'ch-config.xml'));q=lambda sql,fmt='JSONEachRow':s.query(sql,fmt)
 q('SET allow_experimental_analyzer=1,prefer_column_name_to_alias=1,max_threads=4,max_memory_usage=4000000000')
 def snap():
  return {r['event']:int(r['value']) for r in map(json.loads,str(q('SELECT event,value FROM system.events WHERE event IN ('+','.join(repr(e) for e in EVENTS)+')')).splitlines())}
 x=snap();y=snap();overhead={e:y.get(e,0)-x.get(e,0) for e in EVENTS}
 out=[]
 for part in a.parts.split(','):
  for variant in a.variants.split(','):
   sql=(t.OUT/(a.label+'-sql')/(part+'-'+variant+'.sql')).read_text()
   plan=str(q('EXPLAIN indexes=1 '+sql,'TSV'));(t.OUT/(a.label+'-'+part+'-'+variant+'-plan.txt')).write_text(plan)
   before=snap();r=q(sql);after=snap()
   row={'part':part,'variant':variant,'events_minus_probe':{e:after.get(e,0)-before.get(e,0)-overhead[e] for e in EVENTS},'merge_tree_steps':plan.count('ReadFromMergeTree'),'probe_overhead':overhead}
   out.append(row);print(json.dumps(row),flush=True)
 (t.OUT/(a.label+'-profile.json')).write_text(json.dumps(out,indent=2));s.close()
if __name__=='__main__':main()

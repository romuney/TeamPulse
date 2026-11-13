"""Classify exact four-thread mismatches, without tolerance or numeric PASS."""
import json,collections,hashlib
from decimal import Decimal
import study as t
s=t.session.Session(str(t.OUT/'scale')+'?config-file='+str(t.OUT/'ch-config.xml'))
s.query('SET allow_experimental_analyzer=1,prefer_column_name_to_alias=1,max_threads=4,max_memory_usage=4000000000')
reference=None;out=[]
for index,variant in enumerate(['base','scan','scan','base','base','scan']):
 raw=s.query((t.OUT/'scale-scan-sql'/('core-'+variant+'.sql')).read_text(),'JSONEachRow')
 canonical=t.canonical(raw);rows=json.loads(canonical)
 if reference is None:reference=rows
 assert [(r['role'],r['id']) for r in rows]==[(r['role'],r['id']) for r in reference]
 fields=collections.Counter();deltas=collections.Counter();count=0
 for a,b in zip(reference,rows):
  assert a.keys()==b.keys()
  for key in a:
   if a[key]==b[key]:continue
   assert key=='ms',('unexpected field',a['role'],a['id'],key)
   aa=a[key].split(';');bb=b[key].split(';');assert len(aa)==len(bb)
   for slot,(u,v) in enumerate(zip(aa,bb)):
    if u==v:continue
    assert slot in (51,53,58),('unexpected metric',slot)
    uu=u.split(',');vv=v.split(',');assert len(uu)==len(vv)
    for x,y in zip(uu,vv):
     if x==y:continue
     delta=abs(Decimal(x)-Decimal(y));deltas[str(delta)]+=1;fields[str(slot)]+=1;count+=1
 entry={'run':index,'variant':variant,'rows':len(rows),'strict_equal':rows==reference,'differing_cells':count,'metric_slots_zero_based':dict(fields),'absolute_decimal_deltas':dict(deltas),'sha256':hashlib.sha256(canonical.encode()).hexdigest()}
 out.append(entry);print(json.dumps(entry),flush=True)
(t.OUT/'four-thread-classification.json').write_text(json.dumps(out,indent=2))
s.close()

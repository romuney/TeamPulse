"""Synthetic concurrent request stage: 5 isolated embedded CH engines on APFS clones.
Not a distributed ClickHouse/Superset server or a production latency prediction.
All variants use the same aggregate CPU budget (one CH thread per part).
"""
import sys,json,time,multiprocessing as mp,argparse,hashlib,subprocess
from pathlib import Path
import study as t

def worker(db,part,variant,barrier,queue):
 from chdb import session
 s=session.Session(db+'?config-file='+str(t.OUT/'ch-config.xml'))
 try:
  s.query('SET allow_experimental_analyzer=1,prefer_column_name_to_alias=1,max_threads=1,max_memory_usage=2000000000')
  barrier.wait(timeout=60);start=time.perf_counter()
  raw=t.render(part,'full.leaves',variant=variant)
  p=t.k.chart_path(raw,t.COLS);assert not p['error'],p['error'];parsed=time.perf_counter()
  r=s.query(p['texts']['executed'],'JSONEachRow');end=time.perf_counter()
  digest=hashlib.sha256(t.canonical(r).encode()).hexdigest()
  queue.put({'part':part,'variant':variant,'start':start,'end':end,'path_s':parsed-start,'ch_s':end-parsed,'sha256':digest,'bytes':len(str(r).encode())})
 except BaseException as e:queue.put({'part':part,'error':str(e)})
 finally:s.close()

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--candidate',default='both');ap.add_argument('--pairs',type=int,default=3);ap.add_argument('--label',default='parallel');args=ap.parse_args()
 ctx=mp.get_context('spawn');parts=t.sc.PARTS;out=[];hashes={}
 for i in range(args.pairs):
  for variant in (['base',args.candidate] if i%2==0 else [args.candidate,'base']):
   barrier=ctx.Barrier(6);queue=ctx.Queue();procs=[]
   for part in parts:
    db=str(t.OUT/('parallel-db-'+part));assert Path(db).exists(),db
    p=ctx.Process(target=worker,args=(db,part,variant,barrier,queue));p.start();procs.append(p)
   barrier.wait(timeout=60);results=[queue.get(timeout=240) for _ in parts]
   for p in procs:p.join(30)
   assert all('error' not in r for r in results),results
   begin=min(r['start'] for r in results)
   for r in results:
    r['done_s']=r['end']-begin
    hashes.setdefault(r['part'],r['sha256']);r['strict_equal']=r['sha256']==hashes[r['part']]
   item={'pair':i,'variant':variant,'first_data_s':max(r['done_s'] for r in results if r['part'] in ('dict','core')),'all_data_s':max(r['done_s'] for r in results),'parts':results}
   out.append(item);print(json.dumps({k:v for k,v in item.items() if k!='parts'}),flush=True)
   (t.OUT/(args.label+'-results.json')).write_text(json.dumps(out,indent=2))
if __name__=='__main__':main()

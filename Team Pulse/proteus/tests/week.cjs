/* Weekly monitoring: dataset rows (mx «mw» from week_dataset.py) -> real adapter -> D.monWeekly. No employee data.
   usage: node week.cjs mw.json [rows-out.json]  (rows-out — chart rows for the browser check) */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'../..');
const mw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
function model(mx,dt){
  const ctx=vm.createContext({window:{},document:{},console,Set,Map,Date,Number});
  const load=f=>vm.runInContext('(function(){'+fs.readFileSync(path.join(root,f),'utf8')+'\n})();',ctx,{filename:f});
  const y=+dt.slice(0,4);
  const rows=[{role:'meta',j:JSON.stringify({lm:dt.slice(0,7)+'-01',m0:(y-1)+'-01-01',n:23,root:'1',scope:'1',def:'1',ok:1,full:1,dt,schema:'hub-2',
    mk:'hc,act,avg,hire,fire,reg,tin,tout,pnor,plow,phig,pgry',act:['Активная'],act_def:['Активная']})}];
  ['1','11','22'].forEach(id=>rows.push({role:id==='1'?'scope':'c',id,pid:id==='1'?'':'1',lvl:id==='1'?1:2,nm:id==='1'?'Синтетическая компания':'Отдел '+id,
    kids:id==='1'?2:0,j:'{}',ms:Array.from({length:12},()=>Array(23).fill(10).join(',')).join(';'),mx:mx[id]||''}));
  load('proteus/real.js');ctx.window.TP_REAL=ctx.window.TPREAL.build(rows);load('data.js');
  const D=ctx.window.TPDATA;return {D,rows,lp:p=>D.leavesUnder(p||D.REAL.scopePath).map(x=>x.path)};
}
// a missing week inside the series -> a gap, not zeros
const gapWk='2026-10-12';
const mx=Object.fromEntries(Object.entries(mw.mx).map(([k,v])=>[k,v.split('\n').filter(l=>k!=='1'||!l.includes('\t'+gapWk+'|')).join('\n')]));
const M=model(mx,'2026-11-18'), D=M.D, W=D.monWeekly(M.lp());
assert(W&&W.weekly&&W.weeks.length===16,'16 weeks incl. the gap');
const last=W.weeks[W.weeks.length-1], gap=W.weeks.find(x=>x.gap);
assert.equal(last.label,'16.11');assert.equal(last.hc,14);
assert(Math.abs(last.hours-8)<1e-9&&Math.abs(last.talk-12.5)<1e-9,'hours and talk from sums: Σ/n');
assert(last.pt&&/данные по 18\.11/.test(last.full)&&/Неделя не закрыта/.test(last.ptNote),'Sunday 22.11 after data date 18.11 -> partial');
assert(W.weeks[W.weeks.length-2].cl&&!last.cl,'last closed week drives cards and table');
assert(gap&&gap.label==='12.10'&&gap.hc===null&&gap.hours===null&&gap.under===null,'missing week is a gap with no values');
assert.equal(W.weeks.filter(x=>x.cl).length,1);
assert.equal(last.under+last.normal+last.over+last.grey,last.hc);
// the selected unit's own node row, not a sum of leaves (people are counted once per ancestor)
const u22=D.monWeekly(M.lp(D.leavesUnder(D.REAL.scopePath).map(x=>x.path).find(p=>/22$/.test(p))));
assert(u22&&u22.weeks[u22.weeks.length-1].hc===4,'leaf 22');
// no mw at all (dataset before 26.11) -> null: «нет недельных данных»
assert.strictEqual(model({},'2026-11-18').D.monWeekly(model({},'2026-11-18').lp()),null);
// mw exists for other nodes but not for this unit under the filters -> empty weeks, not null and not zeros
const M2=model({'11':mw.mx['11']},'2026-11-18'), e=M2.D.monWeekly(M2.lp(M2.D.leavesUnder(M2.D.REAL.scopePath).map(x=>x.path).find(p=>/22$/.test(p))));
assert(e&&e.weeks.length===0,'filtered-out unit: empty weeks');
// a week across the new year names both years
const M3=model({'1':'mw\t2025-12-29|5,40,5,50,5,1,3,1,0\t1\nmw\t2026-01-05|5,40,5,50,5,1,3,1,0\t1'},'2026-01-20');
const y=M3.D.monWeekly(M3.lp()).weeks;
assert(/29\.12\.2025–04\.01\.2026/.test(y[0].full)&&!/2026/.test(y[1].full),y.map(x=>x.full).join(' | '));
// inconsistent source row (categories do not add up to people) -> error state, not numbers
const M4=model({'1':'mw\t2026-11-02|5,40,5,50,5,1,3,0,0\t1'},'2026-11-18'), er=M4.D.monWeekly(M4.lp());
assert(er&&er.error&&er.weeks.length===0,'inconsistent week -> error');
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(M.rows));
console.log('PASS: mw rows -> adapter -> weekly model: node row not leaf sum, Σ/n hours and talk, partial week by data date, gaps not zeros, null vs empty, year-boundary label, inconsistent source -> error');

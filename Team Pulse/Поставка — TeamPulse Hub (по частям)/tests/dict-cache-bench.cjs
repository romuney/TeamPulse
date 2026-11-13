/* Optional CPU benchmark, not a pass/fail performance threshold.
   node tests/dict-cache-bench.cjs
   Synthetic 504-node parser input; ~2 MB decoded dictionary is made with an
   ignored trailing column to isolate text decoding, NOT to imitate production.
   Four fresh copies per trial model repeated applies. No browser/network time. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {patch}=require('../src/dict-cache.cjs');
const source=fs.readFileSync(path.join(__dirname,'../../proteus/real.js'),'utf8');
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2);return s.replace(a,b)};
const context=s=>{const c={window:{}};vm.createContext(c);vm.runInContext(s,c);return c};
const contexts={golden:context(source),memo:context(patch(source,replace))};
const ascii='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+;<=~?@_'.replace('~','>');
const cyr='абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const arm=s=>Array.from(s).map(c=>cyr.includes(c)?ascii[cyr.indexOf(c)]:(ascii.includes(c)||c==='^'?'^'+c:c)).join('');
const nodeRows=[['R','',1]];
for(let i=0;i<11;i++)nodeRows.push(['A'+i,'R',2]);
for(let i=0;i<110;i++)nodeRows.push(['B'+i,'A'+Math.floor(i/10),3]);
for(let i=0;i<382;i++)nodeRows.push(['C'+i,'B'+(i%110),4]);
const kids={},hc={};nodeRows.forEach(([id])=>kids[id]=[]);
nodeRows.forEach(([id,pid])=>{if(pid)kids[pid].push(id)});
nodeRows.slice().reverse().forEach(([id])=>hc[id]=kids[id].length?kids[id].reduce((n,k)=>n+hc[k],0):40);
const row=(role,x={})=>Object.assign({role,id:'',pid:'',lvl:0,kids:0,nm:'',j:'',ms:'',mx:''},x);
const keys='hc act avg hire fire reg tin tout pnor plow phig pgry'.split(' ');
const metrics=n=>[n,n,n,n*.1,n*.05,n*.01,n*.02,n*.02,n*.7,n*.1,n*.1,n*.1]
  .map(v=>Array(23).fill(v).join(',')).join(';');
const pad='Синтетические метаданные '.repeat(90);
const dict=nodeRows.map(([id,pid,lvl])=>[id,pid,lvl,kids[id].length,'Тестовый отдел '+id,'','0:40','','',pad].join('\t')).join('\n');
const rows=[row('meta',{j:JSON.stringify({n:23,m0:'2025-01',lm:'2026-11',dt:'2026-11-10',root:'R',scope:'R',def:'R',req:[],ok:1,full:1,cuts:[],mk:keys.join(','),enc:'a1'})}),
  row('dict',{j:arm(dict)})];
for(const [id,pid,lvl] of nodeRows)rows.push(row({1:'scope',2:'c',3:'g',4:'x'}[lvl],
  {id,pid,lvl,kids:kids[id].length,nm:arm('Тестовый отдел '+id),ms:metrics(hc[id])}));
rows.push(row('base',{ms:metrics(hc.R)}),row('end'));
const payload=JSON.stringify(rows),samples={golden:[],memo:[]};
const fingerprint=m=>JSON.stringify({nodes:m.nodes,scope:m.scopeId,pick:m.pick,
  series:m.nodes.map(n=>[n.path,m.series(n.path,'hc_total'),m.series(n.path,'hire')])});
let reference;
function trial(name){
  const c=contexts[name];if(c.window.__pvtState)c.window.__pvtState.tp.dictDecoded=null;
  const copies=Array.from({length:4},()=>JSON.parse(payload)); // copying outside timing
  let model;const start=process.hrtime.bigint();
  for(const input of copies)model=c.window.TPREAL.build(input);
  const ms=Number(process.hrtime.bigint()-start)/1e6, output=fingerprint(model);
  if(reference===undefined)reference=output;else assert.equal(output,reference,'golden model parity');
  return ms;
}
// Warm code, then clear memo at the start of EVERY measured trial. Each trial
// therefore includes one unavoidable first decode plus three possible hits.
trial('golden');trial('memo');
for(let i=0;i<6;i++){
  const order=i%2?['memo','golden']:['golden','memo'];
  for(const name of order)samples[name].push(trial(name));
}
const median=a=>{a=a.slice().sort((x,y)=>x-y);return (a[2]+a[3])/2};
console.log(JSON.stringify({nodes:nodeRows.length,dictUtf8Bytes:Buffer.byteLength(dict),
  appliesPerTrial:4,order:'AB/BA alternating, 6 trials each',
  medianMs:{golden:+median(samples.golden).toFixed(2),memo:+median(samples.memo).toFixed(2)},
  samplesMs:samples,parity:'equal',limit:'synthetic pure parser only; not first-screen, SQL, network or paint'},null,2));

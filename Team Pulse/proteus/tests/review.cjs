/* Synthetic SQL output -> real adapter -> model -> shared UI. No employee data. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'../..');
const fixture=JSON.parse(fs.readFileSync(process.argv[2]||'/tmp/tp-review-fixture.json','utf8'));
const context=vm.createContext({window:{},document:{},console,Set,Map,Date,Number});
function load(file){vm.runInContext('(function(){'+fs.readFileSync(path.join(root,file),'utf8')+'\n})();',context,{filename:file})}
load('data.js');
let D=context.window.TPDATA;
const data=D.reviewFromMix(fixture.nodes['1'],fixture.version);
assert.equal(data.state,'ready');assert.equal(data.c.eligible,11);assert.equal(data.c.up,2);assert.equal(data.c.first,2);
assert.equal(data.c.unpaired,2);assert.equal(data.c.missing,3);
const h1=data.gr.find(r=>r.name==='H1');assert.equal(h1.low,100/3);assert.equal(h1.high,200/3);
assert(data.gr.some(r=>r.name==='Не указано'&&r.missing===1));
const g1=data.gr.find(r=>r.name==='G1');assert.equal(g1.low,200/7);assert.equal(g1.high,100/7); // denominator includes two missing final ratings
assert.equal(D.reviewFromMix({},fixture.version).state,'empty');
assert.equal(D.reviewFromMix({},'').state,'unavailable');
for(const reason of ['missing-field','unsupported-type'])assert.equal(D.reviewFromMix({},'hub-2-review-2|'+reason).state,'schema');
assert.equal(D.reviewFromMix({},'hub-2-review-1|2026').state,'unavailable');
const broken=JSON.parse(JSON.stringify(fixture.nodes['1']));broken.rvc.up++;
assert.equal(D.reviewFromMix(broken,fixture.version).state,'error');
assert.equal(D.reviewFromMix(fixture.nodes['1'],'hub-2-review-2|'+(+fixture.version.split('|')[1]+1)).state,'error');
const marker={};marker[fixture.version.split('|')[1]]=3;
const zero={rvc:{all:3},rvyear:marker};assert.equal(D.reviewFromMix(zero,fixture.version).state,'ready');
const noCurrent={rvyear:marker,rvc:{all:3,eligible:3,missing:3},rvgr:{'H1|b':3,'H1|na':3},rvt:{'|b':3,'|na':3},rvsp:{'|b':3,'|na':3}};
const noCurrentData=D.reviewFromMix(noCurrent,fixture.version);assert.equal(noCurrentData.state,'ready');assert.equal(noCurrentData.gr[0].low,0);
// Exercise the real row protocol and residual leaf aggregation, not only the pure helper.
function pack(m){return Object.keys(m).flatMap(k=>Object.keys(m[k]).map(v=>[k,v,m[k][v]].join('\t'))).join('\n')}
const year=+fixture.version.split('|')[1];
const rows=[{role:'meta',j:JSON.stringify({lm:year+'-11-01',m0:(year-1)+'-01-01',n:23,root:'1',scope:'1',def:'1',ok:1,full:1,dt:year+'-11-18',schema:'hub-2',rv:fixture.version,mk:'hc,act,avg,hire,fire,reg,tin,tout,pnor,plow,phig,pgry',act:['Активная'],act_def:['Активная']})}];
['1','11','22'].forEach(id=>rows.push({role:id==='1'?'scope':'c',id,pid:id==='1'?'':'1',lvl:id==='1'?1:2,nm:id==='1'?'Синтетическая компания':'Отдел '+id,kids:id==='1'?2:0,j:'{}',ms:Array.from({length:12},(_,i)=>Array(23).fill(i<3?fixture.nodes[id].rvc.all:0).join(',')).join(';'),mx:pack(fixture.nodes[id])}));
load('proteus/real.js');
context.window.TP_REAL=context.window.TPREAL.build(rows);
load('data.js');D=context.window.TPDATA;
const lp=D.leavesUnder(D.REAL.scopePath).map(x=>x.path);
const actual=D.reviewData(lp);
assert.equal(actual.state,'ready');assert.equal(actual.c.eligible,11);
// Model changes with actual leaf selection; no cached total from the previous scope.
const perLeaf=lp.map(p=>D.reviewData([p])).filter(x=>x.state==='ready');
assert(perLeaf.some(x=>x.c.eligible===10));assert(perLeaf.some(x=>x.c.eligible===1));
load('draw.js');load('ui.js');
const U=context.window.TPUI,html=U.ratingTable({title:'Грейд',kind:'grade',rows:actual.gr});
assert(html.includes('33,3%'));assert(html.includes('66,7%'));assert(!html.includes('<a '));assert(html.includes('Все eligible'));
assert(html.includes('Доля 0–1</th><th'));assert(html.indexOf('Доля 3–4</th>')>html.indexOf('Доля 0–1</th>'));
assert(U.ratingTable({title:'x',kind:'grade',rows:[{name:'x',n:0,missing:0,cells:[0,0,0,0,0],low:null,high:null}]}).includes('—'));
assert(!U.ratingTable({title:'x',kind:'grade',rows:[{name:'<img src=x onerror=1>',n:1,missing:1,cells:[0,0,0,0,0],low:0,high:0}]}).includes('<img'));
if(process.env.REVIEW_BROWSER_ROWS)fs.writeFileSync(process.env.REVIEW_BROWSER_ROWS,JSON.stringify(rows));
console.log('PASS: SQL aggregate fixture -> real adapter -> eligible denominator, history categories, filters/units, empty/unavailable/error, null vs zero, display rounding, escaping and plain labels');

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
// Headers stay one line (delivery 117): short labels, full wording in the shared tooltip.
assert(html.includes('% 0–1</th><th'));assert(html.indexOf('% 3–4</th>')>html.indexOf('% 0–1</th>'));assert(html.includes('Доля с оценкой 3–4'));
assert(U.ratingTable({title:'x',kind:'grade',rows:[{name:'x',n:0,missing:0,cells:[0,0,0,0,0],low:null,high:null}]}).includes('—'));
assert(!U.ratingTable({title:'x',kind:'grade',rows:[{name:'<img src=x onerror=1>',n:1,missing:1,cells:[0,0,0,0,0],low:0,high:0}]}).includes('<img src=x'));
// Rating marks: without mascot.js the scale falls back to number + name text, never a broken <img>.
assert(!html.includes('<img'));D.REVIEW_SCALE.forEach((name,i)=>assert(html.includes('<b>'+i+'</b>&nbsp;'+name)));
load('mascot.js');
const iconHtml=U.ratingTable({title:'Грейд',kind:'grade',rows:actual.gr});
D.REVIEW_SCALE.forEach((name,i)=>{
  const m=U.scoreMark(i), src=context.window.TPMASCOT.srcOf('rv'+i);
  assert(src.startsWith('data:image/webp;base64,')&&m.includes('src="'+src+'"'),'icon '+i);
  assert(m.includes('alt="'+i+' — '+name+'"')&&m.includes('width="24" height="24"'),'alt/size '+i);
  assert(iconHtml.includes(src),'header icon '+i);
});
assert.equal((iconHtml.match(/<img class="rv-ico"/g)||[]).length,5);
assert(iconHtml.includes('33,3%')&&iconHtml.includes('66,7%'));
// Specializations: top 10 by eligible count (ties keep source order), the rest behind the shared expandable row.
const spec=Array.from({length:13},(_,i)=>{const n=[5,9,9,1,7,3,3,8,2,6,4,1,2][i],cells=[0,0,n-1,0,0];
  return {name:'S'+i,n,missing:1,cells,low:0,high:0}});
const totalOf=h=>h.split('<tr class="total top">')[1].split('</tr>')[0].replace(/^<td class="txt">.*?<\/td>/,'');
const plain=U.ratingTable({title:'Спец',kind:'spec',rows:spec});
const collapsed=U.ratingTable({title:'Спец',kind:'spec',rows:spec,top:10,restKey:'rest:rvsp',restOpen:false,restWord:['специализация','специализации','специализаций']});
const opened=U.ratingTable({title:'Спец',kind:'spec',rows:spec,top:10,restKey:'rest:rvsp',restOpen:true,restWord:['специализация','специализации','специализаций']});
const names=h=>[...h.matchAll(/<span class="row-body">([^<]+)/g)].map(m=>m[1]);
assert.deepEqual(names(collapsed),['Итого','S1','S2','S7','S4','S9','S0','S10','S5','S6','S8','Остальные']);
assert(collapsed.includes('3 специализации')&&collapsed.includes('data-btexp="rest:rvsp"')&&!collapsed.includes('class="lvl2"'));
assert.deepEqual(names(opened).slice(12),['S12','S3','S11']);assert.equal((opened.match(/class="lvl2"/g)||[]).length,3);
assert.equal(totalOf(collapsed),totalOf(plain));assert.equal(totalOf(opened),totalOf(plain)); // totals over all rows
const restTr=collapsed.slice(collapsed.indexOf('data-btexp="rest:rvsp"'));assert(/<td>4<\/td><td>3<\/td>/.test(restTr)); // S12+S3+S11: 2+1+1 eligible, 3 without rating
const ten=U.ratingTable({title:'Спец',kind:'spec',rows:spec.slice(0,10),top:10,restKey:'rest:rvsp'});
assert(!ten.includes('Остальные')&&!ten.includes('data-btexp'));
assert.deepEqual([...ten.matchAll(/<td class="txt">([^<]+)/g)].map(m=>m[1]),['Итого','S1','S2','S7','S4','S9','S0','S5','S6','S8','S3']); // same ranking without the rest row
assert.equal(spec.map(r=>r.name).join(),'S0,S1,S2,S3,S4,S5,S6,S7,S8,S9,S10,S11,S12'); // display only: source rows untouched
// One table, three cuts: one header, one total (each cut lays out all eligible), section rubrics, top-10 inside its section.
const grade=[{name:'G',n:60,missing:13,cells:[0,0,47,0,0],low:0,high:0}];
const sect=U.ratingTable({title:'Распределение',groups:[{name:'Грейд',rows:grade},{name:'Стаж',rows:[]},
  {name:'Специализация',rows:spec,top:10,restKey:'rest:rvsp',restOpen:false,restWord:['специализация','специализации','специализаций']}]});
assert.equal((sect.match(/<tr class="total top">/g)||[]).length,1);assert.equal((sect.match(/<thead>/g)||[]).length,1);
assert.deepEqual([...sect.matchAll(/<tr class="hx-sec"><td class="txt" colspan="10">([^<]+)/g)].map(m=>m[1]),['Грейд','Специализация']); // empty cut skipped
assert.equal(totalOf(sect),totalOf(plain));assert(sect.includes('3 специализации'));
assert.equal((sect.match(/caret-spacer/g)||[]).length,1+1+10); // total, grade row and top-10 aligned with the caret of «Остальные»
if(process.env.REVIEW_BROWSER_ROWS)fs.writeFileSync(process.env.REVIEW_BROWSER_ROWS,JSON.stringify(rows));
console.log('PASS: SQL aggregate fixture -> real adapter -> eligible denominator, history categories, filters/units, empty/unavailable/error, null vs zero, display rounding, escaping and plain labels, rating icons with text fallback, specialization top-10 with expandable rest');

/* Golden insight calculations and exact HTML are the oracle; only repeated
   preparation in one synchronous render is allowed to disappear. */
'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {execFileSync}=require('child_process');
const {patch}=require('../src/insight-cache.cjs');
const root=path.join(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'unique anchor: '+a);return s.replace(a,b)};
const original=read('insights.js'),patched=patch(original,replace);
const rows=JSON.parse(execFileSync(process.env.PYTHON_BIN||'python3',['-c',
 "import importlib.util,json,sys; s=importlib.util.spec_from_file_location('fixture',sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(json.dumps(m.dataset('all',[],rich=True)))",
 path.join(__dirname,'fixture_server.py')],{encoding:'utf8'}));
function make(source,real){
 const c={window:{},document:{},console};vm.createContext(c);
 if(real){vm.runInContext(read('proteus/real.js'),c);c.fixture=JSON.stringify(rows);vm.runInContext('window.TP_REAL=window.TPREAL.build(JSON.parse(fixture))',c)}
 for(const f of ['data.js','draw.js','ui.js'])vm.runInContext(read(f),c,{filename:f});
 source=source.replace('function metricFact(m,S,rl,bl){','function metricFact(m,S,rl,bl){window.work=(window.work||0)+1;');
 vm.runInContext(source,c,{filename:'insights.js'});
 vm.runInContext('window.S=Object.assign({},window.TPDATA.DEFAULT_STATE)',c);
 return c;
}
const run=(c,s)=>vm.runInContext(s,c);
const snap=v=>JSON.stringify(v,(_,x)=>typeof x==='number'&&!Number.isFinite(x)?['nonfinite',String(x)]:x===undefined?['undefined']:x);
function prepare(c,settings){c.settings=JSON.stringify(settings);run(c,`Object.assign(window.S,JSON.parse(settings));window.TPDATA.setHcMode(window.S.hcType);window.TPDATA.setVerdictScope(window.S);window.rl=window.TPDATA.reportLeaves(window.S);window.bl=window.TPDATA.benchmarkLeaves(window.S)`)}
const call=`window.TPINSIGHTS.cards(window.S,window.rl,window.bl,true)`;
let compared=0;
for(const real of [false,true]){
 const a=make(original,real),b=make(patched,real);
 const units=run(a,'window.TPDATA.NODES.filter(n=>!n.outside&&!n.direct).slice(0,4).map(n=>n.path)');
 for(const unit of units)for(const hcType of ['active','all'])for(const hiddenMetrics of [[],['turnover_m','underwork']]){
  const settings={unit,hcType,hiddenMetrics};prepare(a,settings);prepare(b,settings);
  const body=`(()=>{const I=window.TPINSIGHTS,S=window.S,rl=window.rl,bl=window.bl;
   return [I.overview(S,rl,bl,true),I.cards(S,rl,bl,true),I.cards(S,rl,bl,false),
    I.cards(S,rl,bl,true,I.TAB_SKIP.turnover),
    window.TPDATA.BLOCKS.map(x=>{const r=I.blockSummary(x.key,S,rl,bl);return [r,I.lastSev]}),
    I.cards(S,rl.slice(0,1),bl,true),I.cards(S,rl,[],true)];})()`;
  const golden=run(a,body),candidate=run(b,'window.TPINSIGHTS.withRenderFrame(()=>'+body+')');
  assert.equal(snap(candidate),snap(golden),'golden full output '+JSON.stringify(settings));compared++;
 }
 prepare(a,{});prepare(b,{});
 const before=run(b,'window.work||0');run(b,call);run(b,call);
 assert(run(b,'window.work')>before,'outside frame executes golden functions');
 run(b,'window.work=0');
 const same=run(b,`window.TPINSIGHTS.withRenderFrame(()=>{const first=${call};const work=window.work;
  const second=${call};return [work,window.work,first===second,first[0]===second[0]]})`);
 assert.equal(same[0],same[1],'identical preparation reused');assert(same[0]>0);
 assert.equal(same[2],false);if(run(b,call).length)assert.equal(same[3],false);
 run(b,`window.customCalls=0;window.TPINSIGHTS.withRenderFrame(()=>{const custom={has:()=>{window.customCalls++;return false}};window.TPINSIGHTS.cards(window.S,window.rl,window.bl,true,custom);window.firstCustom=window.customCalls;window.TPINSIGHTS.cards(window.S,window.rl,window.bl,true,custom)})`);
 assert.equal(run(b,'window.customCalls'),run(b,'window.firstCustom*2'),'custom skip.has side effects are not memoized');
 const golden=snap(run(a,call));
 const restored=run(b,`window.TPINSIGHTS.withRenderFrame(()=>{const first=${call};
  if(first[0]){first[0].head='mutated';first[0].fact.v=-999;first[0].pills.push('mutated')}
  first.push({changed:true});return ${call}})`);
 assert.equal(snap(restored),golden,'nested returned values cannot corrupt memo');
 run(b,`try{window.TPINSIGHTS.withRenderFrame(()=>{${call};throw new Error('expected')})}catch(e){if(e.message!=='expected')throw e}`);
 const prior=run(b,'window.work');run(b,call);assert(run(b,'window.work')>prior,'exception releases frame');
 run(b,`window.TPINSIGHTS.withRenderFrame(()=>{${call};window.TPINSIGHTS.withRenderFrame(()=>${call});window.afterNested=window.work;${call}})`);
 assert(run(b,'window.work>window.afterNested'),'nested frame does not revive stale parent');
 // Distinguish all values (including undefined/null) and mutations of the same
 // state object or skip Set; no object identity shortcut or hash collisions.
 run(b,`window.TPINSIGHTS.withRenderFrame(()=>{const I=window.TPINSIGHTS,sk=new Set();I.cards(window.S,window.rl,window.bl,true,sk);
   sk.add('hc_total');window.changedSkip=I.cards(window.S,window.rl,window.bl,true,sk);
   window.S.hiddenMetrics=['hc_total'];window.changedState=${call};})`);
 run(a,`window.changedSkip=window.TPINSIGHTS.cards(window.S,window.rl,window.bl,true,new Set(['hc_total']));window.S.hiddenMetrics=['hc_total'];window.changedState=${call}`);
 assert.equal(snap(run(b,'[window.changedSkip,window.changedState]')),snap(run(a,'[window.changedSkip,window.changedState]')));
}
// The wrapper preserves result/arguments and releases memo on any throw. It
// can be installed after the delivery's render instrumentation/refresh patch.
const app='function render(keepScroll,quiet){return operation(keepScroll,quiet)}';
const c={window:{TPINSIGHTS:{withRenderFrame(fn){this.active=true;try{return fn()}finally{this.active=false}}}},operation:(a,b)=>{if(a==='throw')throw Error('expected');return [a,b]}};
vm.createContext(c);vm.runInContext(patch(app,replace),c);
assert.equal(snap(run(c,'render(1,2)')),'[1,2]');assert.throws(()=>run(c,'render("throw")'),/expected/);assert.equal(c.window.TPINSIGHTS.active,false);
assert.throws(()=>patch('unrelated source',replace),/source/);
console.log('PASS: '+compared+' golden scenarios; exact facts/cards/SVG/blockSummary/lastSev; frame-only reuse, mutated state/skip/result isolation, exception and nested cleanup');

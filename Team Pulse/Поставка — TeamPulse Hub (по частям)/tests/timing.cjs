const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..','..');
const patch=require('../src/frame-ready.cjs');
const replace=(src,a,b)=>{assert.equal(src.split(a).length,2);return src.replace(a,b)};
const prelude=patch(fs.readFileSync(path.join(root,'proteus/prelude.js'),'utf8'),replace);
const ready=prelude.slice(prelude.indexOf('let frameReady='),prelude.indexOf('window.TP_REAL='));
function fixture(){
  const frames=[],timers=new Map(),messages=[],store={};let id=0;
  const ctx={store,root:{parentNode:{}},window:{parent:{postMessage:m=>messages.push(m)}},
    requestAnimationFrame:f=>frames.push(f),setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},
    clearTimeout:i=>timers.delete(i),atob:s=>Buffer.from(s,'base64').toString('binary'),
    btoa:s=>Buffer.from(s,'binary').toString('base64')};
  vm.runInNewContext(ready+'\nsayReady();',ctx);
  return {frames,timers,messages,store,ctx,flush(){for(const [i,t] of [...timers])if(!t.ms){timers.delete(i);t.fn()}}};
}
let x=fixture();
assert.equal(x.messages.length,0,'no marker during model/app initialization or early emit');
x.frames.shift()();assert.equal(x.messages.length,0,'rAF alone is before paint');
x.flush();assert.equal(x.messages.length,1,'parent loader released after rendering turn');
assert.deepEqual([...x.timers.values()].map(t=>t.ms),[400,1500],'ready retries start after readiness');
x=fixture();x.store.readyEpoch++;x.frames.shift()();x.flush();
assert.equal(x.messages.length,0,'an obsolete root must not release the loader');
x=fixture();x.ctx.root.parentNode=null;x.frames.shift()();x.flush();
assert.equal(x.messages.length,0,'removed root must not signal ready');

let now=0;const window={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/timing.js'),'utf8'),
  {window,performance:{now:()=>now},Date});
const t=window.TP_TIMING,perf=window.__pvtState.tp.perf;
let frame=t.begin({people:true});
t.measure('model',()=>{now=15});
t.measure('data',()=>{now=18});
t.end(frame);now=25;t.afterFrame(frame);
assert.equal(frame.phasesMs.model,15);assert.equal(frame.phasesMs.data,3);
assert.equal(frame.frameOpportunityMs,25);
frame=t.begin({});t.end(frame);t.intent();t.afterFrame(frame);
assert.equal(frame.frameOpportunityMs,null);assert.equal(frame.superseded,true);
for(let i=0;i<50;i++){frame=t.begin({});t.end(frame)}
assert.equal(perf.frames.length,40,'bounded local telemetry');
assert(perf.frames.every(f=>Object.keys(f).every(k=>[
  'id','intent','intentAtMs','startMs','partsReady','phasesMs','applyEndMs','frameOpportunityMs','superseded'
].includes(k))),'no raw data or filter fields');
assert.throws(()=>t.measure('model',()=>{throw new Error('unchanged error')}),/unchanged error/);
console.log('PASS: delayed readiness, stale roots, phase timings, superseded frames, bounded diagnostic schema');

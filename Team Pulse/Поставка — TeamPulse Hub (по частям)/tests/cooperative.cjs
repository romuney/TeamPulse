'use strict';
const vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8');
const source=read('timing.js')+'\n'+read('parts.js'),refresh=read('refresh.js');

// Run the real scheduler AND publication/refresh code. Model and API preparation
// are observable stubs here; prepare.cjs and browser parity test their numbers.
// The clock executes one macro task at a time, permitting real input boundaries
// between preparation stages instead of draining all same-time timers at once.
function fixture(){
  let now=0,id=0,task=0,receive,held=false,fail=null;
  const timers=new Map(),events=[],errors=[];
  const later=(fn,ms=0)=>{timers.set(++id,{at:now+ms,fn});return id};
  const row=(part,scope='a',stamp='v1')=>[
    {role:'part',id:part,j:JSON.stringify({scope,req:[scope],bt:stamp})},
    ...(part==='core'?[{role:'meta',j:JSON.stringify({scope,req:[scope],cuts:[]})},
      {role:'scope',id:scope,mx:''}]:part==='dict'?[]:[{role:'scope',id:scope,mx:part}]),
    {role:'end'}];
  const api=(real,parts)=>({REAL:real,parts,mode:'active',
    partsWait:()=>['people','flow','aux'].filter(p=>!parts.have[p]),
    partsLate:()=>parts.late||[],setHcMode(mode){this.mode=mode},setVerdictScope(s){this.scope=s.unit}});
  const w={addEventListener:(_,f)=>receive=f,removeEventListener(){},
    top:{frames:[]}};
  const state=()=>({real:w.TP_REAL,data:w.TPDATA,parts:w.TP_PARTS,
    model:w.TPDATA&&w.TPDATA.REAL,dom:c.dom});
  const same=(before,label)=>{const after=state();Object.keys(before).forEach(k=>assert.strictEqual(after[k],before[k],label+' '+k))};
  const c={window:w,data:row('dict'),Date:{now:()=>now},setTimeout:later,clearTimeout:i=>timers.delete(i),
    document:{body:null,activeElement:null,querySelectorAll:()=>[],querySelector:()=>held?{}:null},
    ROOTEL:{contains:()=>false,querySelectorAll:()=>[]},ENV:{scroller:{scrollTop:0}},
    on(){},$:()=>null,_navKey:null,_navMemo:{},renderHead(){},renderNav(){},
    render(){
      assert.strictEqual(w.TPDATA,c.D,'app API identity');
      assert.strictEqual(w.TP_REAL,c.D.REAL,'model and API publish together');
      assert.strictEqual(w.TP_PARTS,c.D.parts,'readiness and API publish together');
      c.dom=c.D.REAL;events.push({phase:'commit',task,scope:c.D.REAL.scope,parts:{...w.TP_PARTS.have},mode:c.D.mode});
    },
    TP_PREPARE_DATA(real,parts){
      events.push({phase:'data',task,scope:real.scope});
      if(fail==='data'){fail=null;throw new Error('synthetic data failure')}
      return api(real,parts);
    },
    TP_RUN(rows){
      events.push({phase:'initial',task});
      const scope=JSON.parse(rows.find(r=>r.role==='meta').j).scope;
      const real={scope,missing:[]};w.TP_REAL=real;c.D=w.TPDATA=api(real,w.TP_PARTS);
      c.STORE=w.__pvtState.tp;c.STORE.pending=null;
      c.S=c.STORE.S={tab:'onepager',unit:scope,hcType:'active'};
      vm.runInContext(refresh,c);c.render();
    }};
  w.TPREAL={build(rows){
    const scope=JSON.parse(rows.find(r=>r.role==='meta').j).scope;
    events.push({phase:'model',task,scope});
    if(fail==='model'){fail=null;throw new Error('synthetic model failure')}
    assert(!rows.some(r=>r.prepared),'parser receives fresh copied rows');
    rows.forEach(r=>{r.prepared=true});
    return {scope,missing:[],detail:rows.filter(r=>r.role==='scope').map(r=>r.mx).join('|')};
  }};
  vm.createContext(c);vm.runInContext(source,c);
  function step(){
    const first=[...timers].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
    if(!first)throw new Error('no scheduled task');
    const [i,t]=first;timers.delete(i);now=Math.max(now,t.at);task++;
    try{t.fn()}catch(e){errors.push(e)}
  }
  function until(predicate,label){let limit=200;while(!predicate()&&limit--)step();assert(predicate(),label)}
  function send(part,scope='a',hash=part+scope){task++;receive({data:{type:'TP_PART',v:1,h:hash,rows:row(part,scope)}})}
  function phase(name,count=1){until(()=>events.filter(e=>e.phase===name).length>=count,'phase '+name);return events.filter(e=>e.phase===name).at(-1)}
  function start(){send('core');phase('initial');assert(!events.some(e=>e.phase==='model'||e.phase==='data'),'first core stays synchronous');return state()}
  return {w,c,events,errors,state,same,step,until,send,phase,start,hold:v=>held=v,
    fail:v=>fail=v,jump:v=>now=v,get now(){return now},get task(){return task}};
}

let x=fixture(),old=x.start();
x.send('people');const model=x.phase('model');x.same(old,'after model');
const data=x.phase('data');x.same(old,'after data');
// Settings can change between phases; commit must use the latest user state.
x.c.S.hcType='all';const commit=x.phase('commit',2);
assert(model.task<data.task&&data.task<commit.task,'model/data/commit are three distinct macro tasks');
assert.strictEqual(x.w.TPDATA,old.data,'refresh preserves app API identity');
assert.notStrictEqual(x.w.TP_REAL,old.real);assert.equal(commit.mode,'all');
assert.equal(commit.parts.people,true);assert.equal(x.errors.length,0);

for(const boundary of ['model','data']){
  // A newer selection invalidates the old-core candidate before new data arrives.
  x=fixture();old=x.start();x.send('people');x.phase(boundary);
  x.w.__pvtState.tp.latestRequestedSig='|b|all|all|all|all';
  x.step();x.same(old,'intent cancels after '+boundary);
  x.send('core','b');x.phase('initial',2);
  assert.equal(x.events.filter(e=>e.phase==='commit').at(-1).scope,'b');
  assert.equal(x.events.filter(e=>e.phase==='commit'&&e.scope==='a').length,1,'old selection never recommitted');

  // A changed core without an explicit pending intent also cancels old work.
  x=fixture();x.start();x.send('people');x.phase(boundary);x.send('core','b');x.phase('initial',2);
  assert.equal(x.events.filter(e=>e.phase==='commit'&&e.scope==='a').length,1,'old core cancelled at '+boundary);

  // A later part must supersede, not be overwritten by, a prepared partial API.
  x=fixture();old=x.start();x.send('people');x.phase(boundary);x.send('flow');x.step();x.same(old,'new part cancels '+boundary);
  x.phase('commit',2);const applied=x.events.filter(e=>e.phase==='commit').at(-1);
  assert.equal(applied.parts.flow,true,'latest flow retained');assert.equal(applied.parts.people,true);
  assert.equal(x.events.filter(e=>e.phase==='commit').length,2,'obsolete partial candidate never published');

  // Dialog opening after preparation begins pauses all later stages.
  x=fixture();old=x.start();x.send('people');x.phase(boundary);x.hold(true);
  const n=x.events.length;x.step();x.step();x.same(old,'dialog holds '+boundary);assert.equal(x.events.length,n);
  x.hold(false);x.phase('commit',2);assert.equal(x.errors.length,0);
}

for(const failure of ['model','data']){
  x=fixture();old=x.start();x.fail(failure);x.send('people');x.phase(failure);
  x.same(old,'failed '+failure+' is unpublished');
  // A subsequent identical response must not be blocked by an abandoned job.
  x.w.__pvtState.tp.recheckParts();x.phase('commit',2);
  assert.equal(x.events.filter(e=>e.phase==='commit').at(-1).parts.people,true);
  assert.equal(x.errors.length,1,'original parser failure remains observable');
  assert.equal(x.errors[0].message,'synthetic '+failure+' failure','rethrow preserves original failure');
}

// Deadline changes while a dialog is open require a fresh readiness snapshot.
x=fixture();x.start();x.send('people');x.phase('data');x.hold(true);x.jump(21000);x.step();x.hold(false);
x.phase('commit',2);assert.deepEqual([...x.w.TP_PARTS.late],['flow','aux']);

console.log('PASS: actual scheduler/refresh macro-task stages, atomic publication, latest settings, stale intent/core/part cancellation, dialog pause, first-core priority, error recovery, deadline readiness');

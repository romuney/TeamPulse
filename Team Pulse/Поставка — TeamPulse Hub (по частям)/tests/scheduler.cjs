const vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../src/parts.js'),'utf8');
function fixture(){
  let now=0,id=0,receive,held=false;
  const timers=new Map(),runs=[],updates=[],asks=[];
  const later=(fn,ms)=>{timers.set(++id,{at:now+ms,fn});return id};
  const row=(p,sig='a',bt='v1')=>[{role:'part',id:p,j:JSON.stringify({scope:sig,bt})},{role:'end'}];
  const w={addEventListener:(t,f)=>receive=f,removeEventListener(){}};
  w.top={frames:[{frames:[],postMessage:m=>asks.push({at:now,...m})}]};
  vm.runInNewContext(src,{window:w,data:row('dict'),document:{body:null,querySelectorAll:()=>[],querySelector:()=>held?{}:null},
    Date:{now:()=>now},setTimeout:later,clearTimeout:t=>timers.delete(t),TP_RUN(){
      runs.push({at:now,have:{...w.TP_PARTS.have}});
      const store=w.__pvtState.tp;store.pending=null;
      store.updateParts=(rows,changed)=>{updates.push({at:now,changed:[...changed]});return true};
    }});
  function tick(to){
    while(timers.size){const [i,t]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(t.at>to)break;
      timers.delete(i);now=t.at;t.fn()}
    now=to;
  }
  function send(p,at,sig='a',bt='v1',h=p+sig+bt){tick(at);receive({data:{type:'TP_PART',v:1,h,rows:row(p,sig,bt)}})}
  function hello(p,at){tick(at);receive({data:{type:'TP_HELLO',v:1,part:p,h:p},source:{postMessage:m=>asks.push({at:now,target:p,...m})}})}
  return {w,runs,updates,asks,tick,send,hello,hold:v=>held=v};
}
let x=fixture();x.send('core',1000);x.send('people',1010);x.send('flow',1020);x.tick(1030);
assert.equal(x.runs[0].at,1030,'background must not postpone first core paint');
x.send('aux',2000);x.tick(2300);assert.equal(x.runs.length,1);assert.equal(x.updates.length,1);
assert.equal(x.updates[0].at,2060,'ready background response has only a 60 ms batch window');
x.send('aux',2400);x.tick(2800);assert.equal(x.updates.length,1,'duplicate ignored');
for(const tab of ['structure','movement','turnover','hiring','tgrowth','monitor','office','ai','onepager']){
  x=fixture();for(const [i,p] of ['core','people','flow','aux'].entries())x.send(p,100+i*10);x.tick(500);
  const st=x.w.__pvtState.tp;st.S={tab};st.pending={sig:'new'};
  x.send('core',1000,'b');x.tick(1100);
  const needed=[...x.w.TPPARTS.needs(tab)];
  if(needed.length)assert.equal(x.runs.length,1,tab+': wait only active dependencies');
  needed.forEach((p,i)=>x.send(p,1200+i*100,'b'));x.tick(1500);
  assert.equal(x.runs.length,2,tab+': ready without other tabs');
  assert.equal(x.w.TP_PARTS.sig.split('|')[2],'b');
}
x=fixture();x.send('core',100);x.tick(200);x.hold(true);x.send('people',300);x.tick(1000);
assert.equal(x.updates.length,0,'open dialog retained');x.hold(false);x.tick(1600);assert.equal(x.updates.length,1);
assert(x.asks.at(-1).parts.every(p=>p!=='core'&&p!=='people'),'only missing parts polled');
x=fixture();x.send('core',100);x.tick(200);x.send('people',300,'a','old');x.tick(600);
assert.equal(x.w.TP_PARTS.mixed,true,'mixed build detected');assert.equal(x.w.TP_PARTS.have.people,false);
x.send('people',700,'b');x.tick(1000);assert.equal(x.w.TP_PARTS.have.people,false,'other filter never merged');
x.send('people',1100,'a');x.tick(1500);assert.equal(x.w.TP_PARTS.have.people,true);
x=fixture();x.hello('people',100);x.hello('flow',110);x.hello('aux',120);
assert(!x.asks.some(a=>a.target),'heavy replies are not requested before core');
x.hello('core',130);assert.equal(x.asks.at(-1).target,'core');
x.send('core',200);x.tick(229);
assert(!x.asks.some(a=>a.target==='people'),'core must paint before background handoff');
x.tick(230);
assert.equal(x.runs.length,1);
assert.deepEqual([...x.asks.at(-1).parts],['people','flow','aux']);
x=fixture();x.send('core',200);x.tick(230);
assert.deepEqual([...x.asks.at(-1).parts],['people','flow','aux'],'request ready replies even when earlier HELLO was lost');
console.log('PASS: scheduler, active dependencies for 9 tabs, incremental refresh, dialogs, selective polling, mixed/stale responses');

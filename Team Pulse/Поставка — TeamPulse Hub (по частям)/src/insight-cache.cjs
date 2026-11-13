/* Reuse pure insight preparation only inside one synchronous render.
   No model, access, filter decision or result survives the frame. The golden
   functions and blockSummary's lastSev assignment remain unchanged. The app
   sets the data/verdict scope before reading insights and must not replace D
   or change its verdict scope between memoized calls in that render. */
'use strict';
const helper=`
let tpInsightFrame=null;
function withRenderFrame(fn){
  const previous=tpInsightFrame;
  tpInsightFrame=[];
  try{return fn()}finally{
    tpInsightFrame=previous;
    // A nested render may have changed state; do not revive its parent's memo.
    if(previous)previous.length=0;
  }
}
function tpInsightKey(v){
  if(v===null)return ['null'];
  const t=typeof v;
  if(t==='undefined')return ['undefined'];
  if(t==='number')return ['number',v===0&&1/v<0?'-0':String(v)];
  if(t==='string'||t==='boolean')return [t,v];
  if(t!=='object')throw new Error('uncacheable insight input');
  const p=Object.getPrototypeOf(v);
  if(!Array.isArray(v)&&p!==Object.prototype&&p!==null)throw new Error('uncacheable insight input');
  return [Array.isArray(v)?'array':'object',Array.isArray(v)?v.length:p===null,
    Object.keys(v).map(k=>[k,tpInsightKey(v[k])])];
}
function tpInsightCopy(v,seen){
  if(typeof v==='function'||typeof v==='symbol')throw new Error('uncacheable insight output');
  if(v===null||typeof v!=='object')return v;
  const p=Object.getPrototypeOf(v);
  if(!Array.isArray(v)&&p!==Object.prototype&&p!==null)throw new Error('uncacheable insight output');
  if(seen.has(v))return seen.get(v);
  const out=Array.isArray(v)?new Array(v.length):Object.create(p);
  seen.set(v,out);
  Object.keys(v).forEach(k=>{Object.defineProperty(out,k,{value:tpInsightCopy(v[k],seen),writable:true,enumerable:true,configurable:true})});
  return out;
}
function tpInsightMemo(kind,fn,S,rl,bl,all,skip){
  if(!tpInsightFrame)return fn(S,rl,bl,all,skip);
  if(skip&&(Object.getPrototypeOf(skip)!==Set.prototype||skip.has!==Set.prototype.has))return fn(S,rl,bl,all,skip);
  let key;
  try{key=JSON.stringify(tpInsightKey([S,rl,bl,all,skip?Array.from(skip):null,D.hcMode()]))}
  catch(e){return fn(S,rl,bl,all,skip)}
  const hit=tpInsightFrame.find(e=>e.kind===kind&&e.key===key);
  if(hit)return tpInsightCopy(hit.value,new Map());
  const value=fn(S,rl,bl,all,skip);
  try{
    const saved=tpInsightCopy(value,new Map());
    if(tpInsightFrame.length>=16)tpInsightFrame.shift();
    tpInsightFrame.push({kind:kind,key:key,value:saved});
  }catch(e){/* Unknown future output types keep the uncached golden path. */}
  return value;
}
function overview(S,rl,bl,all){return tpInsightMemo('overview',tpOverviewFresh,S,rl,bl,all)}
function cards(S,rl,bl,all,skip){return tpInsightMemo('cards',tpCardsFresh,S,rl,bl,all,skip)}
`;
function patch(src,replace){
  if(src.includes('function cards(S,rl,bl,all,skip){')){
    src=replace(src,'function overview(S,rl,bl,all){','function tpOverviewFresh(S,rl,bl,all){');
    src=replace(src,'function cards(S,rl,bl,all,skip){','function tpCardsFresh(S,rl,bl,all,skip){');
    return replace(src,'window.TPINSIGHTS={',helper+'\nwindow.TPINSIGHTS={withRenderFrame,');
  }
  if(src.includes('function render(keepScroll,quiet){')){
    return replace(src,'function render(keepScroll,quiet){',`function render(keepScroll,quiet){
  const run=()=>tpRenderFresh(keepScroll,quiet);
  const I=window.TPINSIGHTS;
  return I&&I.withRenderFrame?I.withRenderFrame(run):run();
}
function tpRenderFresh(keepScroll,quiet){`);
  }
  throw new Error('Split build: insight cache source is not insights.js or app.js');
}
module.exports={patch};

/* The parent can process postMessage while this iframe is still building its
   model. Only release its loader after the browser has had a rendering turn.
   This changes the readiness handshake, not the report or its data. */
module.exports=function(src,replace){
  src=replace(src,'const sayReady=function(){','let frameReady=false;\nconst sayReady=function(){\n  if(!frameReady)return;');
  return replace(src,`sayReady();
(store.readyT||[]).forEach(clearTimeout);
store.readyT=[setTimeout(sayReady,400),setTimeout(sayReady,1500)];`, `
(store.readyT||[]).forEach(clearTimeout);
store.readyT=[];
const readyEpoch=store.readyEpoch=(store.readyEpoch||0)+1;
const readyAfterFrame=()=>{
  if(store.readyEpoch!==readyEpoch||!root.parentNode)return;
  frameReady=true;
  sayReady();
  store.readyT.push(setTimeout(sayReady,400),setTimeout(sayReady,1500));
};
const queueReady=()=>{
  if(store.readyEpoch===readyEpoch)store.readyT.push(setTimeout(readyAfterFrame,0));
};
if(typeof requestAnimationFrame==='function')requestAnimationFrame(queueReady);
else queueReady();`);
};

const fs=require('fs'), path=require('path');
const local=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
function replace(src,from,to){
  if(src.split(from).length!==2)throw new Error('Split build: incompatible source anchor: '+from.slice(0,90));
  return src.replace(from,to);
}
function read(root,file){
  if(file==='proteus/parts.js')return local('parts.js');
  if(file==='proteus/loader.js')return local('loader.js');
  let src=fs.readFileSync(path.join(root,file),'utf8');
  if(file==='app.js'){
    src=replace(src,': D.partsWait(S.tab).length ? partWaitView(S.tab)',
      ': (D.partsWait(S.tab).length || STORE.previewTab===S.tab) ? partWaitView(S.tab)+SC.corePreview(S)');
    src=replace(src,'/* ---------- старт ---------- */',local('refresh.js')+'\n/* ---------- старт ---------- */');
    const start=src.indexOf('function partWaitView(tab){'), end=src.indexOf('/*:split*/',start);
    if(start<0||end<0)throw new Error('Split build: missing partWaitView');
    src=src.slice(0,start)+local('status.js')+'\n'+src.slice(end);
    src=replace(src,'  const mask=maskOf(next);','  const mask=maskOf(next);\n  STORE.latestRequestedSig=sig;\n  if(STORE.recheckParts)STORE.recheckParts();');
    src=replace(src,'    if(changed){if(next.unit!==S.unit)',
      '    if(changed||(STORE.pending&&STORE.pending.sig!==sigOf(next))){if(next.unit!==S.unit)');
    src=replace(src,"    STORE.warn='Фильтры не применились:","    STORE.latestRequestedSig=echoSig();\n    STORE.warn='Фильтры не применились:");
    src=replace(src,'function render(keepScroll,quiet){',`function render(keepScroll,quiet){
  if(STORE.previewTab&&STORE.previewTab!==S.tab)STORE.previewTab=null;
  if(STORE.pending&&STORE.recheckParts)STORE.recheckParts();`);
    src=replace(src,'Догружаю детали…',"'+(S.tab!=='onepager'&&!D.partsWait(S.tab).length?'Вкладка готова · другие разделы загружаются':'Догружаю детали…')+'");
  }
  if(file==='styles.css')src+='\n.part-wait.tp-part-status{min-height:0;align-items:flex-start;text-align:left;padding:16px;margin-bottom:16px;gap:8px}.tp-details-ready{position:fixed;right:24px;bottom:24px;z-index:20;max-width:calc(100% - 48px)}\n';
  if(file==='screens/_block.js')src+='\n'+local('preview.js');
  return src;
}
module.exports={read};

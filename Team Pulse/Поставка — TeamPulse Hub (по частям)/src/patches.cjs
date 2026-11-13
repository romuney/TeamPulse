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
  if(file==='data.js'){
    // Rendering readiness only. The scheduler still applies a new core as soon
    // as the active tab's own data is ready; facts remain usable in preview.
    src=replace(src,"const PART_NAMES=", "Object.keys(BLOCK_PARTS).forEach(k=>{if(BLOCK_PARTS[k].indexOf('aux')<0)BLOCK_PARTS[k].push('aux')});\nconst PART_NAMES=");
  }
  // Readiness is presentation state, not a change to the golden data model.
  // Recompute from the current API after each background merge.
  if(file==='screens/_block.js'){
    src=replace(src,'const DEV_TABS={','function devOf(bk,sub){\nconst DEV_TABS={');
    src=replace(src,'function devOf(bk,sub){\n  const lv=DEV_LIVE[bk];','  const lv=DEV_LIVE[bk];');
  }
  if(file==='app.js'){
    src=replace(src,'function navDev(bk){','function navDev(bk){return "";');
    src=replace(src,"if(D.partsWait(bk).length)return null;","if(D.partsWait(bk).length||D.partsWait('onepager').indexOf('aux')>=0)return null;");
    src=replace(src,"? SC.onepager.render(S,openRows)","? (D.partsWait('onepager').length||STORE.previewTab==='onepager' ? partWaitView('onepager')+SC.quickSummary(S) : SC.onepager.render(S,openRows))");
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
  if(file==='screens/onepager.js'){
    src=replace(src,'function blockDevTag(bk){','function blockDevTag(bk){return "";');
    src=src.replaceAll('Метрики без источника: цифры условные, выводов по ним нет.','Данные этих показателей не получены. Выводы по ним не строятся.')
      .replaceAll('В разработке','Нет данных').replaceAll(' в разработке',' без данных');
  }
  if(file==='ui.js'){
    const a=src.indexOf('function devTip(stage){'), b=src.indexOf('/* План по каталогу',a);
    if(a<0||b<0)throw new Error('Split build: missing availability UI');
    src=src.slice(0,a)+`function devTip(){return {title:'Нет данных',text:'Ответ для этого показателя не получен. Выводы по нему не строятся.'}}
function devTag(stage,small){return '<span class="dev-tag'+(small?' sm':'')+'"'+tipAttr(devTip())+'>нет данных</span>'}
function devNote(d){return d?'<div class="dev-note" role="status">Не все данные вкладки получены. Обновите отчёт; если это повторится, сообщите владельцу.</div>':''}
`+src.slice(b);
    src=src.replaceAll('Метрика в разработке: цифры условные, поэтому выводов нет.','Данные показателя не получены, поэтому выводов нет.')
      .replaceAll('В разработке: цифры условные.','Данные не получены.')
      .replaceAll('в разработке','нет данных').replaceAll('в разраб.','без данных');
  }
  if(file==='styles.css')src+='\n.part-wait.tp-part-status{min-height:0;align-items:flex-start;text-align:left;padding:16px;margin-bottom:16px;gap:8px}.tp-details-ready{position:fixed;right:24px;bottom:24px;z-index:20;max-width:calc(100% - 48px)}.tp-quick-table{width:100%;border-collapse:collapse;background:#fff}.tp-quick-table th,.tp-quick-table td{padding:14px 16px;text-align:left;border-bottom:1px solid #e0e3e7}.tp-quick-table tbody th{font-weight:400}.tp-quick-table td:nth-child(2){font-weight:700;font-size:20px;white-space:nowrap}@media(max-width:600px){.tp-quick-table th,.tp-quick-table td{padding:10px 6px}.tp-quick-table .btn{font-size:12px;padding:6px}}\n';
  if(file==='screens/_block.js')src+='\n'+local('preview.js');
  return src;
}
module.exports={read};

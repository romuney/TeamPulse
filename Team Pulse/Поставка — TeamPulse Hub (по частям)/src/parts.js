/* ============================================================================
   proteus/parts.js — поставка «по частям» (11.11): главный чарт собирает ответ из частей.

   Зачем. Код чарта уходит на сервер в каждом запросе данных (гайд F11), а один большой датасет долго разбирается и
   считается. Поэтому отчёт разложен на несколько чартов одного дашборда:
     - главный чарт (этот код, весь интерфейс) — датасет dict: справочник узлов, от фильтров не зависит. Сам себя
       главный чарт не фильтрует, поэтому после выбора юнита или фильтра его тяжёлый код больше никуда не едет;
     - чарты-загрузчики (proteus/loader.js, ~1 КБ кода) — датасеты core, people, flow, aux: Proteus запрашивает их
       параллельно, ответ загрузчик передаёт сюда по каналу postMessage (гайд MC-12, MC-15).
   Экран появляется, как только пришла часть core (ряды узлов — первый экран); вкладки, которым нужны разрезы из
   people / flow / aux, показывают значок загрузки, пока их часть не пришла.

   Протокол (версия v = 1; оба участника меняются одной поставкой, гайд MC-16):
     TP_HELLO {v, part, id, n, h}        загрузчик → все фреймы: «у меня новый ответ» (без данных — короткое сообщение;
                                         h — отпечаток ответа: тот же ответ главный чарт второй раз не просит)
     TP_ASK   {v}                        главный → загрузчику (в ответ на HELLO — адресно; при старте — всем фреймам)
     TP_PART  {v, part, id, n, h, rows}  загрузчик → главному, адресно (ev.source): строки ответа как есть
   Первая строка каждой части — role = 'part': какая часть и эхо применённых фильтров. Части сводятся только с
   одинаковым эхом (гайд MC-06): экран задаёт core, разрезы другого выбора к нему не приклеиваются.

   Датасет главного чарта отдал целый ответ (строки part нет) — отчёт работает одним чартом, как раньше.
   window.TPPARTS — функции свода (их же проверяет стенд); запуск — внизу, только в сборке чарта (TP_RUN).
   ========================================================================== */
(function(){
'use strict';
const V=1, MX=['people','flow','aux'], NODE={scope:1,base:1,c:1,g:1,x:1};
const str=v=>v==null?'':String(v);
const NEEDS={structure:['people'],movement:['people','flow'],turnover:['people','flow'],hiring:['people','flow'],
  tgrowth:['people'],monitor:['people'],office:['people'],ai:['aux'],onepager:[]};
function needs(tab){return NEEDS[tab]||[]}
/* Same normalized signature as app.js echoSig(), read only the tiny meta row.
   Keep the last user intent even after pending has completed. */
function requestSig(rows){
  const row=rows.find(r=>str(r.role)==='meta');
  if(!row)return null;
  let m;try{m=JSON.parse(row.j)}catch(e){return null}
  const list=k=>(Array.isArray(m[k])?m[k]:[]).map(str);
  const one=(k,map)=>{const a=list(k);return a.length===1&&map[a[0]]?map[a[0]]:'all'};
  const act=list('act').map(v=>v.toLowerCase()), def=(list('act_def').length?list('act_def'):['Активная']).map(v=>v.toLowerCase());
  const cuts=Array.isArray(m.cuts)?m.cuts:['paint','it','staff'];
  const hc=cuts.indexOf('act')<0||!act.length?'all':act.length===def.length&&act.every(v=>def.indexOf(v)>=0)?'active':'set:'+act.sort().join(',');
  return [str(m.as),list('req')[0]||'',one('paint',{Hq:'HQ',Line:'Line',Support:'Support'}),
    one('it',{IT:'IT',Digital:'Digital',NonIT:'nonIT'}),one('staff',{'Штат':'staff','Не штат':'nonstaff'}),hc].join('|');
}

/* строка part ответа: какая часть, подпись выбора (эхо), есть ли доступ и маркер конца ответа; null — строки нет */
function echoOf(rows){
  let pr=null, end=false;
  (Array.isArray(rows)?rows:[]).forEach(r=>{const role=str(r&&r.role);if(role==='part')pr=r;else if(role==='end')end=true});
  if(!pr)return null;
  let j={};
  try{j=JSON.parse(str(pr.j))||{}}catch(e){j={}}
  const a=k=>(Array.isArray(j[k])?j[k]:[]).map(str).join(',');
  return {p:str(pr.id),sig:[str(j.as),a('req'),str(j.scope),a('paint'),a('it'),a('staff'),a('act')].join('|'),bt:str(j.bt),ok:j.ok!==0,end:end};
}
/* свод частей: строки core — основа (meta, ряды и имена узлов, HQ); разрезы people / flow / aux того же выбора
   дописываются узлу по (role, id) — блок ключа начинается с ключа, порядок блоков не важен; база похожих (peer) и
   справочник (dict) — своими строками. Строки копируются: модель чарта расшифровывает текст на месте.
   Части кэшируются в Proteus порознь: часть того же выбора с другой отметкой сборки данных (bt) — из старого кэша, к
   core она не приклеивается (mixed: такие есть — отчёт попросит загрузчики перезапросить мимо кэша).
   → {rows, sig, have:{dict, people, flow, aux}, mixed} или null, пока нет core */
function merge(P){
  const core=P&&P.core;
  if(!core)return null;
  const rows=[], by={}, have={};
  let end=core.end, mixed=false;
  core.rows.forEach(r=>{
    const role=str(r.role);
    if(role==='part'||role==='end')return;
    const c=Object.assign({},r);
    rows.push(c);
    if(NODE[role])by[role+'\n'+str(r.id)]=c;
  });
  MX.forEach(p=>{
    let part=P[p]&&P[p].by&&P[p].by[core.sig];
    if(part&&str(part.bt)!==str(core.bt)){mixed=true;part=null}
    have[p]=!!part;
    if(!part)return;
    end=end&&part.end;
    part.rows.forEach(r=>{
      const role=str(r.role);
      if(NODE[role]){
        const t=by[role+'\n'+str(r.id)];
        if(t&&r.mx)t.mx=t.mx?t.mx+'\n'+str(r.mx):str(r.mx);
      }else if(role==='peer')rows.push(Object.assign({},r));
    });
  });
  have.dict=!!P.dict;
  if(P.dict){
    end=end&&P.dict.end;
    P.dict.rows.forEach(r=>{if(str(r.role)==='dict')rows.push(Object.assign({},r))});
  }
  if(end)rows.push({role:'end',id:'',pid:'',lvl:0,nm:'',kids:0,j:'',ms:'',mx:''});
  return {rows:rows,sig:core.sig,have:have,mixed:mixed};
}
window.TPPARTS={V:V,MX:MX,echoOf:echoOf,merge:merge,needs:needs};

/* ---------- запуск: только в сборке чарта «по частям» (TP_RUN — отчёт целиком, функцией от строк ответа) ---------- */
if(typeof TP_RUN!=='function')return;
const ST=window.__pvtState||(window.__pvtState={});
const store=ST.tp||(ST.tp={});
const own=typeof data!=='undefined'&&Array.isArray(data)?data:[];
const mine=echoOf(own);
(store.partsT||[]).forEach(clearTimeout);
store.partsT=[];
if(store.partsOn){try{window.removeEventListener('message',store.partsOn)}catch(e){}}
store.partsOn=null;
/* целый ответ (PART = 'all') — один чарт, как раньше */
if(!mine){window.TP_PARTS=null;TP_RUN(own);return}
/* нет зоны доступа — экран «Нет доступа» сразу, частей не ждём */
if(!mine.ok){window.TP_PARTS=null;TP_RUN([{role:'meta',id:'',pid:'',lvl:0,nm:'',kids:0,j:'{"ok":0}',ms:'',mx:''}]);return}

const P=store.parts||(store.parts={seen:{}});
P.dict={rows:own,end:mine.end};
const later=(fn,ms)=>{const t=setTimeout(fn,ms);store.partsT.push(t);return t};
/* журнал канала (последние 60 событий: мс от старта, событие) — для разбора «что и когда пришло» на бою: window.__pvtState.tp.parts.log */
P.log=P.log||[];
const T00=P.t00||(P.t00=Date.now());
const note=ev=>{P.log.push([Date.now()-T00,ev]);if(P.log.length>60)P.log.shift()};
note('start');
/* сообщение всем фреймам борда (гайд MC-12): обход от window.top, свой window пропускаем */
function bcast(msg){
  try{
    (function walk(w,d){
      if(d>5)return;
      for(let i=0;i<w.frames.length;i++){
        const f=w.frames[i];
        if(f!==window){try{f.postMessage(msg,'*')}catch(e){}}
        try{walk(f,d+1)}catch(e2){}
      }
    })(window.top,0);
  }catch(e){}
}
const WAIT_MS=1500, LATE_MS=20000;
const t0=Date.now();
let shown=null, shownSig=null, shownCore=null, shownParts={};
const deferred={};
function askDeferred(){
  Object.keys(deferred).forEach(p=>{delete deferred[p]});
  // HELLO may have arrived before this main chart existed. Explicitly ask all
  // missing parts after the first paint instead of waiting for the 1.5 s poll.
  const missing=lacking();
  if(missing.length)bcast({type:'TP_ASK',v:V,parts:missing});
}
/* чего не хватает показанному выбору: части разрезов и сам core */
function lacking(){
  if(!P.core)return ['core'];
  return MX.filter(p=>{const x=P[p]&&P[p].by&&P[p].by[P.core.sig];return !(x&&str(x.bt)===str(P.core.bt))});
}
/* Until core, retain the board's existing flame loader. The iframe stays
   transparent; no second loading scene and no early ready marker. */
function boot(late){
  const hosts=document.querySelectorAll('[_echarts_instance_]');
  const host=hosts.length?hosts[hosts.length-1]:document.body;
  if(!host)return;
  document.documentElement.style.background='transparent';
  if(document.body)document.body.style.background='transparent';
  if(!late)return;
  let el=host.querySelector('.tp-boot-error');
  if(el)return;
  if(host!==document.body&&getComputedStyle(host).position==='static')host.style.position='relative';
  el=document.createElement('div');el.className='tp-boot-error tp-overlay';
  el.style.cssText='position:absolute;inset:0;z-index:10;background:#fff;padding:32px;box-sizing:border-box;font:14px Arial,sans-serif';
  el.innerHTML='<p role="alert">Данные отчёта не пришли. Обновите дашборд; если это повторится, сообщите владельцу отчёта.</p>';
  host.appendChild(el);
  try{
    let raw=atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    while(raw.length%3)raw+='\0';
    const url='data:image/png;base64,'+btoa(raw+'TP-HUB-READY');
    window.parent.postMessage({type:'ECHARTS_UPDATE_DATA_URL',dataUrl:url,payload:{dataUrl:url}},'*');
  }catch(e){}
}
/* отчёт сейчас занят окном (настройка, тур, словарь): пересборку от догрузившейся части откладываем, чтобы окно не
   закрылось под рукой; новый выбор (другой core) не ждёт */
function held(){
  try{return !!document.querySelector('.tp-overlay .ovl:not(.hidden), .tr-layer')}catch(e){return false}
}
function run(force){
  if(!P.core){boot(Date.now()-t0>LATE_MS);return}
  if(store.latestRequestedSig&&P.core.reqSig!==store.latestRequestedSig)return;
  const lack=lacking(), late=Date.now()-(P.core.at||t0)>LATE_MS;
  // While applying a filter, keep the previous screen labelled as updating until
  // the active tab is usable. Other tabs do not extend this wait.
  const required=needs(store.S&&store.S.tab||'onepager');
  const waiting=required.filter(p=>lack.indexOf(p)>=0);
  const mixed=MX.some(p=>{const x=P[p]&&P[p].by[P.core.sig];return x&&str(x.bt)!==str(P.core.bt)});
  if(store.pending&&P.core.ok&&waiting.length&&!late&&!mixed){note('wait active '+waiting.join('+'));return}
  const stamps={};
  MX.forEach(p=>{const x=P[p]&&P[p].by[P.core.sig];stamps[p]=x&&str(x.bt)===str(P.core.bt)?x.h||'ready':''});
  const key=P.core.sig+'#'+(P.core.h||'')+'#'+MX.map(p=>stamps[p]).join('|')+(late&&lack.length?'L':'')+(mixed?'M':'');
  if(key===shown&&!store.pending)return;
  const same=shownSig===P.core.sig&&shownCore===P.core.h&&!store.pending;
  if(!force&&same&&held()){later(()=>run(),400);return}
  const timing=window.TP_TIMING;
  const frame=timing.begin({people:lack.indexOf('people')<0,flow:lack.indexOf('flow')<0,aux:lack.indexOf('aux')<0});
  const m=timing.measure('merge',()=>merge(P));
  const changed=MX.filter(p=>shownParts[p]!==stamps[p]);
  note('run '+MX.filter(p=>m.have[p]).join('+')+(late&&lack.length?' late':'')+(m.mixed?' mixed':''));
  /* window.TP_PARTS — что знает отчёт о частях: какие пришли к показанному выбору, какие не пришли за LATE_MS */
  window.TP_PARTS={sig:m.sig,have:m.have,late:late?lack:[],again:shownSig===m.sig,mixed:m.mixed};
  try{
    if(!(same&&!m.mixed&&typeof store.updateParts==='function'&&store.updateParts(m.rows,changed)))TP_RUN(m.rows);
  }finally{timing.end(frame)}
  const firstPaint=!shownCore;
  shown=key;shownSig=m.sig;shownCore=P.core.h;shownParts=stamps;
  note('ran');
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>later(()=>timing.afterFrame(frame),0));
  // Paint usable core before cloning megabytes of background responses.
  if(firstPaint||Object.keys(deferred).length){
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>later(askDeferred,0));
    else later(askDeferred,0);
  }
}
/* core — сразу (первый экран); догрузившиеся разрезы — пачкой: части приходят почти одновременно, и отчёт
   пересобирается один раз, а не на каждую (не дольше BATCH_MAX от первой в пачке) */
const BATCH=60, BATCH_MAX=180;
let runT=null, batch0=0, fastPending=false;
const soon=fast=>{
  // Background arrivals cannot cancel the first core paint.
  if(fastPending&&!fast)return;
  clearTimeout(runT);
  if(fast){fastPending=true;batch0=0;runT=later(()=>{fastPending=false;run()},30);return}
  if(!batch0)batch0=Date.now();
  runT=later(()=>{batch0=0;run()},Math.max(30,Math.min(BATCH,BATCH_MAX-(Date.now()-batch0))));
};
store.recheckParts=()=>soon(true);
/* пока показанному выбору чего-то не хватает — «пришлите ответ» всем загрузчикам раз в 1,5 с (загрузчик мог ответить
   раньше, чем главный чарт начал слушать, или его сообщение потерялось); через LATE_MS — пересборка с причиной */
let asking=false, asks=0;
function watch(){
  asks=0;
  if(asking)return;
  asking=true;
  (function ask(){
    const lack=shownCore?lacking():['core'];
    if(!lack.length||asks>=80){asking=false;return}
    asks++;
    bcast({type:'TP_ASK',v:V,parts:lack});
    if(Date.now()-((P.core&&P.core.at)||t0)>LATE_MS)run();
    later(ask,WAIT_MS);
  })();
}
function take(d){
  const e=echoOf(d.rows);
  if(!e||(e.p!=='core'&&MX.indexOf(e.p)<0))return;
  const reqSig=e.p==='core'?requestSig(d.rows):null;
  if(e.p==='core'&&store.latestRequestedSig&&reqSig!==store.latestRequestedSig){note('ignore stale core');return}
  /* тот же ответ второй раз (Proteus перерисовывает чарт прежними данными) — не берём: отпечаток h считает загрузчик */
  const h=str(d.h);
  if(P.seen[e.p]===h&&(e.p==='core'?P.core&&P.core.sig===e.sig:P[e.p]&&P[e.p].by[e.sig]))return;
  P.seen[e.p]=h;
  note('take '+e.p+(P.core&&e.p!=='core'&&e.sig!==P.core.sig?' (другой выбор)':''));
  if(e.p==='core'){
    P.core={rows:d.rows,sig:e.sig,bt:e.bt,end:e.end,ok:e.ok,at:Date.now(),h:h,reqSig:reqSig};
    /* разрезы прежних выборов больше не нужны: остаются части показанного выбора и последняя пришедшая */
    MX.forEach(p=>{const m=P[p];if(m)Object.keys(m.by).forEach(s=>{if(s!==e.sig&&s!==m.last)delete m.by[s]})});
    soon(true);watch();
    return;
  }
  const m=P[e.p]||(P[e.p]={by:{},last:''});
  const keep=P.core?P.core.sig:null;
  Object.keys(m.by).forEach(s=>{if(s!==keep)delete m.by[s]});
  m.by[e.sig]={rows:d.rows,bt:e.bt,end:e.end,h:h};
  m.last=e.sig;
  if(P.core&&e.sig===P.core.sig)soon(!!store.pending&&needs(store.S&&store.S.tab).indexOf(e.p)>=0);
}
store.partsOn=function(ev){
  const d=ev&&ev.data;
  if(!d||d.v!==V)return;
  if(d.type==='TP_HELLO'){
    if(P.seen[str(d.part)]===str(d.h))return;
    note('hello '+str(d.part));
    if(!shownCore&&d.part!=='core'){deferred[str(d.part)]=ev.source;return}
    try{ev.source.postMessage({type:'TP_ASK',v:V},'*')}catch(e){}
  }else if(d.type==='TP_PART'&&Array.isArray(d.rows))take(d);
};
window.addEventListener('message',store.partsOn);
run(true);
watch();
})();

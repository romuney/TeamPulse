/* ============================================================================
   app.js — ядро TeamPulse Hub: состояние, URL, шапка, навигация, модалка,
   роутер и обработчики событий. Разметку экранов не собирает — этим заняты
   screens/*.js. Рисованием занят draw.js, общими элементами — ui.js.

   Порядок загрузки жёсткий:
     data.js → draw.js → ui.js → insights.js → screens/_block.js →
     screens/<блоки>.js → screens/onepager.js → app.js

   Если правишь конкретный экран — файл этого экрана в screens/, а не здесь.
   ========================================================================== */
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS, M=window.TPMASCOT;
const $=s=>document.querySelector(s);
const esc=U.esc;

/* ---------- состояние ---------- */
/* hiddenMetrics копируем, а не берём ссылку из DEFAULT_STATE: иначе правка набора
   метрик молча мутировала бы дефолт, и «Всё» перестало бы возвращать всё */
let S=Object.assign({},D.DEFAULT_STATE,{hiddenMetrics:D.DEFAULT_STATE.hiddenMetrics.slice(),
  mixSel:D.DEFAULT_STATE.mixSel.slice()});
let DRAFT=null;              /* черновик фильтров в модалке */
let pulseOpen=false;         /* раскрыт ли словарь метрик Пульса */
const openRows=new Set();    /* раскрытые строки OnePager */
const expanded=new Set();    /* раскрытые узлы в сводной таблице */
/* раскрытые стримы в двухуровневой разбивке состава. Живёт рядом с expanded и
   по той же причине: это состояние показа, а не отчёта, и в ссылку не едет */
const mixOpen=new Set();

/* ---------- URL ---------- */
function urlParams(){
  const p=new URLSearchParams({unit:S.unit,paint:S.paint,it:S.itSeg,staff:S.staffType,tab:S.tab});
  /* набор метрик едет в ссылке скрытыми ключами: пустой параметр = показано всё */
  if(S.hiddenMetrics&&S.hiddenMetrics.length)p.set('hide',S.hiddenMetrics.join(','));
  /* Срез состава и оси конструктора — в ссылку: «покажи грейды у женщин» это
     ровно то, что пересылают друг другу, а собирать его заново руками у
     получателя ссылки нет причин. Дефолтные значения не пишем: параметры,
     которые ничего не меняют, делают ссылку нечитаемой. */
  if(S.mixSel&&S.mixSel.length)p.set('mix',S.mixSel.join(','));
  if(S.mixRows!==D.DEFAULT_STATE.mixRows)p.set('mxr',S.mixRows);
  if(S.mixCols!==D.DEFAULT_STATE.mixCols)p.set('mxc',S.mixCols||'');
  if(S.mixMode!==D.DEFAULT_STATE.mixMode)p.set('mxm',S.mixMode);
  return p;
}
function readURL(){
  const q=new URLSearchParams(location.search);
  const map={unit:'unit',paint:'paint',it:'itSeg',staff:'staffType',tab:'tab',sub:'subTab'};
  Object.entries(map).forEach(([k,f])=>{const v=q.get(k);if(v)S[f]=v});
  const hide=q.get('hide');
  if(hide!=null)S.hiddenMetrics=D.sanitizeHidden(hide.split(',').filter(Boolean));
  const mix=q.get('mix');
  /* sliceParse выбрасывает неизвестные разрезы и категории и режет длину до
     SLICE_MAX — ссылка из прошлой версии не должна ломать экран */
  if(mix!=null)S.mixSel=D.sliceParse(mix.split(',').filter(Boolean)).map(x=>x.id);
  const mxr=q.get('mxr'), mxc=q.get('mxc'), mxm=q.get('mxm');
  if(mxr&&D.MIX_BY_KEY[mxr])S.mixRows=mxr;
  if(mxc!=null)S.mixCols=D.MIX_BY_KEY[mxc]?mxc:'';
  if(mxm&&['abs','row','col'].indexOf(mxm)>=0)S.mixMode=mxm;
  if(!D.NODE_BY_PATH[S.unit])S.unit=D.DEFAULT_STATE.unit;
}
function writeURL(){history.replaceState(null,'','?'+urlParams().toString())}
function shareLink(){return location.origin+location.pathname+'?'+urlParams().toString()}

/* ---------- шапка и навигация ---------- */
function renderHead(){
  const n=D.NODE_BY_PATH[S.unit];
  $('#crumbs').innerHTML=D.ancestorsOf(S.unit).map((a,i,arr)=>
    i===arr.length-1
      ? '<span>'+esc(a.name)+'</span>'
      : '<button data-crumb="'+a.path+'">'+esc(a.name)+'</button><span class="sep">/</span>'
  ).join('');
  $('#unitTitle').innerHTML=esc(n.name)+'<span class="lvl">'+esc(D.levelLabel(n.level))+'</span>';
  /* Нет разрезов — нет и плашки «Разрезы не выбраны»: пустое состояние занимало
     строку и притягивало взгляд, ничего при этом не сообщая. Остаются только
     чипы базы сравнения, они есть всегда. */
  const chips=D.filterChips(S);
  let html=chips.map(c=>'<span class="chip">'+esc(c.label)+'<button class="x" data-unchip="'+c.k+'"'+
    U.tipAttr({title:'Снять разрез',text:c.label})+'>×</button></span>').join('');
  html+='<span class="chip bench">Сравнение: <b>'+esc(D.benchmarkLabel(S))+'</b></span>';
  html+='<span class="chip bench">'+D.fmtInt(D.reportLeaves(S).length)+' команд в отборе</span>';
  $('#chips').innerHTML=html;
  $('#periodBadge').textContent=D.PERIOD_LABEL;
}
function renderNav(){
  /* блок, у которого пользователь отключил все метрики, из навигации уходит */
  $('#navBlocks').innerHTML=D.visibleBlocks(S).map(b=>
    '<button class="nav-i'+(S.tab===b.key?' active':'')+'" data-tab="'+b.key+'"><span class="ico"></span>'+esc(b.name)+'</button>').join('');
  document.querySelectorAll('.nav-i[data-tab="onepager"]').forEach(b=>b.classList.toggle('active',S.tab==='onepager'));
}

/* ---------- маскот ----------
   Дежурный огонёк рисуется ПОСЛЕ вставки экрана: его эмоция читает
   TPINSIGHTS.lastSev, а та выставляется во время сборки детальной вкладки.
   Порядок важен: иначе огонёк показывал бы эмоцию предыдущей вкладки. */
function renderMascot(){
  if(!M)return;
  $('#navFoot').innerHTML=M.dock(S,pulseOpen);
  $('#pulseHost').innerHTML=pulseOpen?M.panel(S):'';
}
function pulse(on){
  if(pulseOpen===on)return;
  pulseOpen=on;renderMascot();
}
/* Статичные места маскота: логотип и строка-разводка в справке.
   Рисуются один раз на старте — от состояния отчёта они не зависят. */
function mountStaticMascots(){
  if(!M)return;
  /* В логотипе огонька больше нет: на экране одновременно жили дежурный огонёк,
     огоньки в AI-плашках и логотип — персонаж переставал считываться. */
  /* Шапки модалок: у каждой своя роль огонька — настройщик с ключом и тот,
     кто показывает, куда смотреть. Один персонаж ведёт пользователя везде. */
  const sp=$('#setupPulse');
  if(sp)sp.innerHTML=M.img('setup',54);
  const htp=$('#helpTopPulse');
  if(htp)htp.innerHTML=M.img('point',54);
  /* В справке огонёк остаётся только в шапке модалки: в разводке внизу
     он был вторым портретом в одном окне и отвлекал от текста правила. */
  const hp=$('#helpPulse');
  if(hp)hp.innerHTML=
    '<span>Это — правила чтения всего отчёта. А что означает конкретная метрика — '+
    'спросите у <b>Пульса</b>: он внизу слева и знает метрики той вкладки, где вы стоите.</span>';
}

/* ---------- модалка настройки ---------- */
function openSetup(){
  DRAFT={unit:S.unit,paint:S.paint,itSeg:S.itSeg,staffType:S.staffType,
    hiddenMetrics:(S.hiddenMetrics||[]).slice()};
  const opts=D.NODES.filter(n=>n.level<=4).sort((a,b)=>a.sort-b.sort);
  $('#selUnit').innerHTML=opts.map(n=>
    '<option value="'+n.path+'"'+(n.path===DRAFT.unit?' selected':'')+'>'+
    ' '.repeat((n.level-1)*3)+esc(n.name)+'</option>').join('');
  paintOpts();
  $('#setupOvl').classList.remove('hidden');
}
function paintOpts(){
  const row=(id,list,field)=>{
    $(id).innerHTML=list.map(o=>'<button class="opt'+(DRAFT[field]===o.key?' on':'')+'" data-f="'+field+'" data-v="'+o.key+'">'+esc(o.name)+'</button>').join('');
  };
  row('#optPaint',D.PAINTS,'paint');
  row('#optIt',D.ITSEGS,'itSeg');
  row('#optStaff',D.STAFFTYPES,'staffType');
  metricOpts();
  const d=Object.assign({},S,DRAFT);
  const rl=D.reportLeaves(d), bl=D.benchmarkLeaves(d);
  $('#benchPreview').innerHTML='Ваша команда: <b>'+esc(D.NODE_BY_PATH[d.unit].name)+'</b>, '+D.fmtInt(rl.length)+' команд, '+
    D.fmtVal('hc_total',D.lastVal(rl,'hc_total'))+' чел.<br>Все метрики будут сравниваться с базой <b>'+
    esc(D.benchmarkLabel(d))+'</b> — '+D.fmtVal('hc_total',D.lastVal(bl,'hc_total'))+' чел.';
}
/* ---------- выбор метрик в модалке ----------
   Пресет только проставляет галочки: после него набор донастраивается руками,
   и подсветка пресета гаснет (activePreset вернёт null на своей комбинации). */
function metricOpts(){
  const hid=new Set(DRAFT.hiddenMetrics), cur=D.activePreset(DRAFT);
  $('#optPreset').innerHTML=D.METRIC_PRESETS.map(p=>
    '<button class="opt'+(cur===p.key?' on':'')+'" data-mpreset="'+p.key+'">'+esc(p.name)+'</button>').join('');
  $('#metricPick').innerHTML=D.BLOCKS.map(b=>{
    const items=D.metricsOfBlock(b.key).map(m=>{
      /* обязательная метрика — та же строка, но кнопка неактивна: показать её
         в списке нужно, иначе непонятно, почему она есть в отчёте */
      if(D.LOCKED_METRICS.has(m.key))return '<button class="mp-i on lock" disabled'+
        U.tipAttr({title:m.name,text:'Базовая метрика отчёта, отключить нельзя.'})+
        '><span class="box"></span><span class="nm">'+esc(m.name)+'</span><span class="lk">всегда</span></button>';
      return '<button class="mp-i'+(hid.has(m.key)?'':' on')+'" data-mtoggle="'+m.key+'"'+
        U.tipAttr({title:m.name,text:m.hint||''})+
        '><span class="box"></span><span class="nm">'+esc(m.name)+'</span></button>';
    }).join('');
    return '<div class="mpick-g"><div class="mpick-h">'+esc(b.name)+'</div>'+
      '<div class="mpick-l">'+items+'</div></div>';
  }).join('');
  const hidB=D.BLOCKS.length-D.visibleBlocks(DRAFT).length;
  $('#metricCount').innerHTML='Выбрано <b>'+D.visibleCount(DRAFT)+'</b> из '+D.METRICS.length+' метрик'+
    (cur?'':' — свой набор')+'. Отключённые уходят из one-pager, KPI-карточек и столбцов сводных '+
    'таблиц; графики в детальных листах остаются.'+
    (hidB?' Блоков скрыто целиком: <b>'+hidB+'</b> — они исчезнут и из меню слева.':'');
}
/* ---------- Срез состава ----------
   Один срез на разрез: клик по «Senior» после «Junior» не складывает их, а
   заменяет — две категории одного разреза в пересечении дают ноль, и таблица
   молча опустела бы. Дальше SLICE_MAX атрибутов срез не растёт: на третьем
   начинаются доли от долей, и в клетке остаётся полчеловека. Уходит самый
   старый — так последний клик пользователя всегда виден в результате.
   Повторный клик по уже взятому снимает ровно его. */
function toggleMix(spec){
  const want=String(spec).split(',').filter(Boolean);
  let cur=D.sliceParse(S.mixSel).map(p=>p.id);
  if(want.every(id=>cur.indexOf(id)>=0)){
    S.mixSel=cur.filter(id=>want.indexOf(id)<0);return;
  }
  want.forEach(id=>{
    const dim=id.split(':')[0];
    cur=cur.filter(x=>x.split(':')[0]!==dim);
    cur.push(id);
  });
  while(cur.length>D.SLICE_MAX)cur.shift();
  S.mixSel=cur;
}

function toggleMetric(key){
  if(D.LOCKED_METRICS.has(key))return;
  const hid=new Set(DRAFT.hiddenMetrics);
  hid.has(key)?hid.delete(key):hid.add(key);
  DRAFT.hiddenMetrics=D.sanitizeHidden([...hid]);
  metricOpts();
}
function closeSetup(){$('#setupOvl').classList.add('hidden');DRAFT=null}
function applySetup(){
  Object.assign(S,DRAFT);
  /* главная метрика таблицы могла оказаться скрытой — пусть блок выберет заново */
  if(S.mainMetric&&!D.metricVisible(S.mainMetric,S))S.mainMetric=null;
  openRows.clear();closeSetup();render();
}

/* ---------- доступность ---------- */
function navOpen(on){
  const nav=$('#sideNav'),scr=$('#navScrim'),btn=$('#navToggle');if(!nav)return;
  nav.classList.toggle('open',on);scr.classList.toggle('open',on);
  btn.setAttribute('aria-expanded',String(on));
}
function enhanceA11y(){
  document.querySelectorAll('.nav-i').forEach(x=>{x.setAttribute('aria-current',x.classList.contains('active')?'page':'false')});
  document.querySelectorAll('.mrow,.urow,.mx-cell').forEach(x=>{x.tabIndex=0;x.setAttribute('role','button')});
  document.querySelectorAll('.ai-h').forEach(x=>{x.tabIndex=0;x.setAttribute('role','button');x.setAttribute('aria-expanded',String(S.aiOpen===x.dataset.ai))});
}

/* ---------- роутер ----------
   Экраны возвращают строку разметки, а не пишут в DOM сами. Поэтому весь
   рендер — одна вставка, после которой графики перемеряются под фактическую
   ширину контейнера (в разметке они уже нарисованы при номинальной 900px). */
/* keepScroll=true — перерисовка внутри того же экрана (раскрыли метрику,
   выбрали строку, переключили под-вкладку). Прыгать наверх при клике по
   метрике нельзя: пользователь теряет ту самую строку, которую только что открыл. */
function render(keepScroll){
  const y=keepScroll?(window.pageYOffset||0):0;
  /* вкладка скрытого (или несуществующего) блока — уводим на one-pager. Одна
     точка на всё: и ссылка с ?tab=tgrowth&hide=…, и отключение метрик в модалке */
  if(S.tab!=='onepager'&&!(D.BLOCK_BY_KEY[S.tab]&&D.blockVisible(S.tab,S))){S.tab='onepager';S.subTab=null}
  G.reset();
  renderHead();renderNav();writeURL();
  $('#view').innerHTML = S.tab==='onepager'
    ? SC.onepager.render(S,openRows)
    : SC.renderBlock(S,expanded,mixOpen);
  /* true — проиграть анимацию появления графиков */
  G.remeasure($('#view'),true);
  renderMascot();
  enhanceA11y();navOpen(false);
  if(keepScroll)window.scrollTo(0,y);
  else window.scrollTo({top:0,behavior:'smooth'});
}

/* перерисовка графиков под новую ширину окна, без пересчёта данных */
let _rz=null;
window.addEventListener('resize',()=>{
  clearTimeout(_rz);_rz=setTimeout(()=>G.remeasure($('#view')),140);
});

/* ---------- события ----------
   Все слушатели висят на document, поэтому stopPropagation внутри одного
   не глушит соседей. Порядок проверок внутри обработчика важен: более
   специфичные цели проверяются раньше общих (.urow ловит всё подряд). */
document.addEventListener('click',e=>{
  const t=e.target;

  /* Словарь Пульса закрывается кликом мимо. Проверка стоит ПЕРВОЙ и без
     return: клик мимо панели должен и её закрыть, и сработать по назначению. */
  if(pulseOpen&&!t.closest('#pulsePanel')&&!t.closest('#pulseDock'))pulse(false);
  if(t.closest('#pulseDock')){pulse(!pulseOpen);return}
  if(t.closest('#pulseClose')){pulse(false);return}
  if(t.closest('#pulseToHelp')){pulse(false);$('#helpOvl').classList.remove('hidden');return}

  /* модалки и кнопки шапки */
  if(t.closest('#btnSetup')){openSetup();return}
  if(t.closest('#btnApply')){applySetup();return}
  if(t.closest('#btnCancel')){closeSetup();return}
  if(t.closest('#btnReset')&&DRAFT){DRAFT.paint='all';DRAFT.itSeg='all';DRAFT.staffType='all';paintOpts();return}
  if(t.closest('#btnLink')){
    navigator.clipboard&&navigator.clipboard.writeText(shareLink());
    $('#btnLink').textContent='Ссылка скопирована';
    setTimeout(()=>$('#btnLink').textContent='Скопировать ссылку',1600);return;
  }
  if(t.closest('#btnHelp')){$('#helpOvl').classList.remove('hidden');return}
  if(t.closest('#btnHelpClose')){$('#helpOvl').classList.add('hidden');return}
  if(t.id==='setupOvl'){closeSetup();return}
  if(t.id==='helpOvl'){$('#helpOvl').classList.add('hidden');return}
  if(t.closest('#navToggle')){navOpen(!$('#sideNav').classList.contains('open'));return}
  if(t.id==='navScrim'){navOpen(false);return}

  /* выбор метрик — раньше общей проверки .opt: кнопки пресетов тоже .opt, но
     без data-f, и общий обработчик записал бы в DRAFT undefined */
  const mp=t.closest('[data-mpreset]');
  if(mp&&DRAFT){DRAFT.hiddenMetrics=D.hiddenForPreset(mp.dataset.mpreset);metricOpts();return}
  const mt=t.closest('[data-mtoggle]');
  if(mt&&DRAFT){toggleMetric(mt.dataset.mtoggle);return}

  /* содержимое клетки матрицы — раньше общей ветки .opt: кнопки режима тоже
     .opt, но без data-f, и общий обработчик записал бы в DRAFT undefined */
  const mm=t.closest('[data-mixmode]');
  if(mm){S.mixMode=mm.dataset.mixmode;render(true);return}

  const opt=t.closest('.opt');
  if(opt&&DRAFT){DRAFT[opt.dataset.f]=opt.dataset.v;paintOpts();return}

  /* навигация по разделам */
  const tab=t.closest('[data-tab]');
  if(tab){S.tab=tab.dataset.tab;S.subTab=null;S.mainMetric=null;S.selNode=null;openRows.clear();render();return}
  const sub=t.closest('[data-subtab]');
  if(sub){S.subTab=sub.dataset.subtab;render(true);return}
  const cr=t.closest('[data-crumb]');
  if(cr){S.unit=cr.dataset.crumb;openRows.clear();render();return}
  const un=t.closest('[data-unchip]');
  if(un){S[un.dataset.unchip]='all';render();return}

  /* дерево подразделений.
     Каретка ИТОГО ходит первой: одна кнопка на всё дерево, а не на свою строку.
     data-expall=1 — раскрыть всё, 0 — свернуть; в какую сторону, решает разметка,
     она же и рисует каретку в нужную сторону. */
  const exAll=t.closest('[data-expall]');
  if(exAll){
    e.stopPropagation();
    expanded.clear();
    if(exAll.dataset.expall==='1')SC.expandableRows(SC.currentRoot(S)).forEach(p=>expanded.add(p));
    render(true);return;
  }
  const ex=t.closest('[data-exp]');
  if(ex){e.stopPropagation();const p=ex.dataset.exp;expanded.has(p)?expanded.delete(p):expanded.add(p);render(true);return}
  const dr=t.closest('[data-drill]');
  if(dr){e.stopPropagation();S.drillRoot=dr.dataset.drill;S.selNode=null;expanded.clear();render();return}
  if(t.closest('[data-undrill]')){S.drillRoot=null;S.selNode=null;expanded.clear();render();return}

  /* Срез состава — СТРОГО до .urow: строка разбивки и есть .urow, и общий
     обработчик выбора подразделения перехватил бы её первым. */
  if(t.closest('[data-mixclear]')){S.mixSel=[];render(true);return}
  if(t.closest('[data-mixswap]')){
    const r=S.mixRows;S.mixRows=S.mixCols||r;S.mixCols=S.mixCols?r:'';render(true);return;
  }
  /* Общая каретка двухуровневой разбивки: раскрыть или свернуть ВСЕ стримы.
     Идёт первой из кареток — она стоит в строке ИТОГО, у которой своих
     обработчиков нет, но правило «от частного к общему» держим и здесь. */
  const bxa=t.closest('[data-btexpall]');
  if(bxa){
    e.stopPropagation();
    const [dim,on]=bxa.dataset.btexpall.split('|');
    [...mixOpen].forEach(k=>{if(k.indexOf(dim+':')===0)mixOpen.delete(k)});
    if(on==='1')(D.MIX_BY_KEY[dim].cats||[]).forEach(c=>mixOpen.add(c.id));
    render(true);return;
  }
  /* каретка стрима — раньше среза: она стоит ВНУТРИ строки, у которой есть
     data-mix, и общий обработчик среза перехватил бы клик по ней */
  const bx=t.closest('[data-btexp]');
  if(bx){
    e.stopPropagation();
    const k=bx.dataset.btexp;
    mixOpen.has(k)?mixOpen.delete(k):mixOpen.add(k);
    render(true);return;
  }
  const mx=t.closest('[data-mix]');
  if(mx){e.stopPropagation();toggleMix(mx.dataset.mix);render(true);return}

  /* Легенда графика — СТРОГО до .urow: в правой панели график лежит рядом
     с таблицей, и клик по легенде не должен уходить в выбор строки. */
  const lg=t.closest&&t.closest('.lg[data-sid]');
  if(lg){
    e.stopPropagation();
    if(!lg.classList.contains('lock')){
      const box=lg.closest('.svgchart[data-cid]');
      if(box)G.toggleSeries(box.getAttribute('data-cid'),lg.getAttribute('data-sid'));
    }
    return;
  }

  /* раскрытие строк */
  const ai=t.closest('[data-ai]');
  if(ai){S.aiOpen=S.aiOpen===ai.dataset.ai?null:ai.dataset.ai;render(true);return}
  /* Общая каретка блока one-pager: графики всех метрик блока разом.
     Строго до `.mrow` — кнопка живёт в шапке таблицы, но клик по ней не должен
     проваливаться в раскрытие строки, если разметка когда-нибудь съедет. */
  const opa=t.closest('[data-opexpall]');
  if(opa){
    e.stopPropagation();
    const [bk,on]=opa.dataset.opexpall.split('|');
    D.metricsOfBlock(bk).forEach(m=>openRows.delete(m.key));
    if(on==='1')D.visibleMetricsOfBlock(bk,S).forEach(m=>openRows.add(m.key));
    render(true);return;
  }
  const mr=t.closest('.mrow');
  if(mr){const k=mr.dataset.metric;openRows.has(k)?openRows.delete(k):openRows.add(k);render(true);return}
  const ur=t.closest('.urow');
  if(ur&&ur.dataset.node){S.selNode=S.selNode===ur.dataset.node?null:ur.dataset.node;render(true);return}

  if(t.closest('.nav-i')&&innerWidth<=780)navOpen(false);
});
document.addEventListener('change',e=>{
  if(e.target.id==='selUnit'&&DRAFT){DRAFT.unit=e.target.value;paintOpts();return}
  const ax=e.target.closest&&e.target.closest('[data-mixaxis]');
  if(ax){
    const v=e.target.value;
    if(ax.dataset.mixaxis==='rows'){S.mixRows=v;if(S.mixCols===v)S.mixCols=''}
    else{S.mixCols=v===S.mixRows?'':v}
    render(true);
  }
});

/* Наведение на пункт легенды гасит чужие серии. focusin/focusout — то же
   самое с клавиатуры: без них при ходьбе табом непонятно, где ты. */
function lgHover(e,on){
  const t=e.target;
  if(!t||!t.closest)return;
  const lg=t.closest('.lg[data-sid]');
  if(!lg)return;
  const box=lg.closest('.svgchart');
  if(box)G.highlight(box,on?lg.getAttribute('data-sid'):null);
}
document.addEventListener('mouseover',e=>lgHover(e,true));
document.addEventListener('mouseout',e=>lgHover(e,false));
document.addEventListener('focusin',e=>lgHover(e,true));
document.addEventListener('focusout',e=>lgHover(e,false));
document.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.mrow,.urow,.ai-h,.mx-cell')){e.preventDefault();e.target.click()}
  /* У SVGElement может не быть .click() — зовём обработчик напрямую.
     После перерисовки узла больше нет, поэтому фокус возвращаем вручную. */
  if((e.key==='Enter'||e.key===' ')&&e.target.closest){
    const lg=e.target.closest('.lg[data-sid]');
    if(lg){
      e.preventDefault();
      if(!lg.classList.contains('lock')){
        const box=lg.closest('.svgchart[data-cid]'), sid=lg.getAttribute('data-sid');
        if(box&&G.toggleSeries(box.getAttribute('data-cid'),sid)){
          const back=box.querySelector('.lg[data-sid="'+sid+'"]');
          if(back&&back.focus)back.focus();
        }
      }
      return;
    }
  }
  if(e.key==='Escape'){closeSetup();$('#helpOvl').classList.add('hidden');navOpen(false);pulse(false)}
});

/* ---------- старт ---------- */
mountStaticMascots();
readURL();render();

/* первый вход: справка «Как читать отчёт» работает онбордингом.
   ?tour=0 — не показывать: нужно, чтобы скриншот сразу показывал отчёт. */
try{
  if(!localStorage.getItem('tp_onboarded')&&location.search.indexOf('tour=0')<0){
    $('#helpOvl').classList.remove('hidden');
    $('#btnHelpClose').addEventListener('click',()=>localStorage.setItem('tp_onboarded','1'),{once:true});
  }
}catch(e){}

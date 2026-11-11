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
/* Чарт Proteus (итерация 31): proteus/prelude.js кладёт в window.TP_ENV корень
   отчёта внутри хоста ECharts, прокручиваемый контейнер, хранилище, которое
   переживает перезапуск скрипта на каждый ответ датасета, регистрацию слушателей
   и отправку кросс-фильтра. Без TP_ENV — обычная страница макета. */
const ENV=window.TP_ENV||null;
const ROOTEL=ENV?ENV.root:document, STORE=ENV?ENV.store:null;
const $=s=>ROOTEL.querySelector(s);
const $$=s=>ROOTEL.querySelectorAll(s);
const on=(t,type,fn,opt)=>ENV?ENV.on(t,type,fn,opt):t.addEventListener(type,fn,opt);
const esc=U.esc;

/* ---------- состояние ---------- */
/* hiddenMetrics копируем, а не берём ссылку из DEFAULT_STATE: иначе правка набора
   метрик молча мутировала бы дефолт, и «Всё» перестало бы возвращать всё */
let S=Object.assign({},D.DEFAULT_STATE,{hiddenMetrics:D.DEFAULT_STATE.hiddenMetrics.slice(),
  mixSel:D.DEFAULT_STATE.mixSel.slice()});
let DRAFT=null;              /* черновик фильтров в модалке */
let pulseOpen=false;         /* раскрыт ли словарь метрик Пульса */
/* В Proteus множества и стек живут в хранилище TP_ENV: скрипт перезапускается
   на каждый ответ датасета, а раскрытия и выбор вкладки терять нельзя */
const keep=(k,v)=>STORE?(STORE[k]||(STORE[k]=v)):v;
const openRows=keep('openRows',new Set());    /* раскрытые строки OnePager */
const expanded=keep('expanded',new Set());    /* раскрытые узлы в сводной таблице */
/* раскрытые стримы в двухуровневой разбивке состава. Живёт рядом с expanded и
   по той же причине: это состояние показа, а не отчёта, и в ссылку не едет */
const mixOpen=keep('mixOpen',new Set());
/* «← Назад»: юниты отчёта до переходов, не больше 10 (механика HRBP HUB).
   Состояние показа, как expanded: в ссылку не едет — по ссылке открывается
   юнит, а не история того, как к нему пришли. */
const unitBack=keep('unitBack',[]);
/* имена юнитов из стека: после перехода прежнего юнита в ответе датасета нет */
const unitNames=keep('unitNames',{});
/* поиск по сводной таблице подразделений — тоже состояние показа */
let tq='';
/* Ширина колонок рабочей зоны (итерации 30, 32): режим — таблица
   подразделений слева от графиков ('both', по умолчанию) или графики во всю
   ширину ('charts'), доля таблицы после
   перетаскивания разделителя (null — раскладка по умолчанию). Один выбор
   на все блоки: «мне нужна таблица» — предпочтение, а не свойство
   вкладки. В ссылку не едет, как и раскрытия. */
let splitMode=null, splitUnit=null, splitShare=null;   /* null — авто: маленькая команда свёрнута (30.10) */

/* ---------- URL ---------- */
function urlParams(){
  const p=new URLSearchParams({unit:S.unit,paint:S.paint,it:S.itSeg,staff:S.staffType,tab:S.tab});
  if(S.hcType==='all')p.set('hc','all');
  /* свой набор типов численности (поставка 61) — списком через «|» */
  if(S.hcType==='set'&&S.hcSet&&S.hcSet.length){p.set('hc','set');p.set('hct',S.hcSet.join('|'))}
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
  if(ENV)return;
  const q=new URLSearchParams(location.search);
  const map={unit:'unit',paint:'paint',it:'itSeg',staff:'staffType',hc:'hcType',tab:'tab',sub:'subTab'};
  Object.entries(map).forEach(([k,f])=>{const v=q.get(k);if(v)S[f]=v});
  if(S.hcType==='set')Object.assign(S,D.hcNorm((q.get('hct')||'').split('|').filter(Boolean).length?
    q.get('hct').split('|').filter(Boolean):D.HC_DEF));
  else if(S.hcType!=='all')S.hcType='active';
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
  if(!D.NODE_BY_PATH[S.unit]||D.isTech(S.unit))S.unit=D.DEFAULT_STATE.unit;
}
/* в Proteus адресной строки у чарта нет: состояние живёт в TP_ENV.store */
function writeURL(){if(ENV)return;history.replaceState(null,'','?'+urlParams().toString())}
function shareLink(){return location.origin+location.pathname+'?'+urlParams().toString()}

/* ---------- переход к юниту ----------
   Одна точка на все переходы: «Открыть юнит» у строки таблицы и в шапке
   правой панели, путь над отчётом, «↑ Уровнем выше», модалка настройки.
   Юнит до перехода уходит в стек «← Назад»; back=true — шаг по самому стеку.
   Раскрытия, выбор строки и поиск относятся к прежнему дереву — сбрасываются. */
function pushBack(p){
  if(unitBack[unitBack.length-1]===p)return;
  unitBack.push(p);
  if(unitBack.length>10)unitBack.shift();
}
function goUnit(p,back){
  if(ENV){requestUnit(p,back);return}
  if(!D.NODE_BY_PATH[p]||p===S.unit)return;
  if(!back)pushBack(S.unit);
  S.unit=p;S.selNode=null;S.offCity=null;
  expanded.clear();openRows.clear();tq='';
  render();
}

/* ---------- Proteus: юнит и фильтры меняет датасет ----------
   В ответе датасета — три уровня под выбранным юнитом, фильтры применил SQL.
   Поэтому переход в юнит и смена фильтра — кросс-фильтр самому себе, как в
   HRBP HUB: чарт шлёт маску целиком, Proteus перезапрашивает датасет и
   перезапускает скрипт с новым ответом, а состояние показа ждёт в TP_ENV.store.
   Пока ответа нет, отчёт показывает прежний юнит, приглушённый, с чипом
   «Загружаю…». */
function unitId(p){
  if(!p)return null;
  if(p==='T')return D.REAL.rootId;
  const last=p.split('/').pop();
  return last==='·'?null:last;
}
/* юнит по умолчанию: в пробнике — тот, что датасет отдаёт без фильтра юнита (meta.def; нет пути — корень окна выбора) */
function defUnit(){
  if(!D.REAL)return D.DEFAULT_STATE.unit;
  const p=D.REAL.pick&&D.REAL.pick.path?D.REAL.pick.path(D.REAL.defId||D.REAL.rootId):null;
  const u=p||(D.REAL.pick&&D.REAL.pick.root)||'T';
  return D.isTech(u)?D.TOP:u;
}
function curReq(){return {as:ENV&&D.REAL?D.REAL.asLogin:'',unit:S.unit,paint:S.paint,itSeg:S.itSeg,staffType:S.staffType,hcType:S.hcType,hcSet:(S.hcSet||[]).slice()}}
/* подпись типа численности: набор по умолчанию, все или свой набор (строчными, по алфавиту) */
function hcSig(st){return st.hcType==='set'?'set:'+(st.hcSet||[]).map(x=>String(x).toLowerCase()).sort().join(','):st.hcType}
/* Подпись запроса и эхо ответа (21.10, правка Антона: «фильтр не всегда срабатывает с первого раза»).
   Чарт перезапускается на каждый ответ — и на устаревший: Proteus перерисовывает чарт прежними данными
   сразу после кросс-фильтра, а при двух быстрых выборах ответы приходят не по порядку. Раньше любой
   ответ снимал «Загружаю…» — и показывал прежний выбор, как будто фильтр не применился. Теперь ответ
   принимается, только если его эхо (юнит из unit_f и применённые фильтры) совпадает с последним
   запросом; на устаревший — ждём дальше, а если нужный не пришёл, один раз шлём ту же маску с меткой
   tp_nonce (колонки нет в датасете: ключ кэша новый, Proteus перезапрашивает; гайд MC-03, MC-08). */
const STALE_WAIT=15000, MAX_RESEND=1;
function sigOf(st){
  const id=unitId(st.unit), c=D.REAL.cuts;
  return [st.as||'',id===D.REAL.defId?'':id,c.has('paint')?st.paint:'all',c.has('it')?st.itSeg:'all',
    c.has('staff')?st.staffType:'all',c.has('act')?hcSig(st):'all'].join('|');
}
function echoSig(){
  const a=D.REAL.applied;
  return [D.REAL.asLogin||'',D.REAL.req[0]||'',a.paint,a.itSeg,a.staffType,D.REAL.cuts.has('act')?hcSig(a):'all'].join('|');
}
function emitPend(mask,nonce){
  return ENV.emit(nonce?mask.concat([{column:'tp_nonce',operator:'IN',value:[String(Date.now())]}]):mask);
}
let _pendT=null, _staleT=null;
/* маска кросс-фильтров запроса (вынесена из request в поставке 63: ею же пользуется детализация переводов) */
function maskOf(next){
  const id=unitId(next.unit), mask=[];
  /* 12.11-д: «смотреть как логин» (только администратор; чужой маске датасет не верит) — в каждой маске, пока включено */
  if(next.as)mask.push({column:'as_f',operator:'IN',value:[next.as]});
  /* юнит по умолчанию не шлём: ответ без фильтра юнита общий для всех */
  if(id&&id!==D.REAL.defId)mask.push({column:'unit_f',operator:'IN',value:[id]});
  [['paint','paint_f'],['itSeg','it_f'],['staffType','staff_f']].forEach(([k,col])=>{
    const v=next[k]!=='all'&&D.REAL.cuts.has(col.replace('_f',''))?D.REAL.filterValue(k,next[k]):null;
    if(v)mask.push({column:col,operator:'IN',value:[v]});
  });
  /* тип численности: «Активная» — ответ датасета по умолчанию, не шлём; все типы («Вся») и свой набор — act_f */
  if(next.hcType==='all'&&D.REAL.cuts.has('act'))mask.push({column:'act_f',operator:'IN',value:[D.REAL.filterValue('hcType','all')]});
  if(next.hcType==='set'&&D.REAL.cuts.has('act'))mask.push({column:'act_f',operator:'IN',value:(next.hcSet||[]).slice()});
  return mask;
}
function request(next){
  const id=unitId(next.unit);
  if(!id)return;
  const sig=sigOf(next), was=STORE.pending;
  /* 12.11 (итерация «настройки, One Pager, мониторинг», п. 4): новое действие — плашка ошибки прошлого запроса («Ответ не
     пришёл за 45 секунд») снимается сразу, при любом исходе; ошибка нового запроса встанет уже от него */
  STORE.warn='';STORE.warnSig=null;
  /* уже показано — запроса нет (MC-03: повтор той же маски Proteus может не перезапросить) */
  if(sig===echoSig()&&!was){render();return}
  /* тот же выбор уже в пути: не дублируем; если ждём дольше STALE_WAIT — повтор с меткой */
  if(was&&was.sig===sig){
    if(Date.now()-was.at>STALE_WAIT&&was.tries<MAX_RESEND+1){was.tries++;was.at=Date.now();emitPend(was.mask,true)}
    renderHead();return;
  }
  const mask=maskOf(next);
  const nm=(D.NODE_BY_PATH[next.unit]||{}).name||unitNames[next.unit]||'';
  unitNames[next.unit]=nm;
  unitNames[S.unit]=(D.NODE_BY_PATH[S.unit]||{}).name||unitNames[S.unit]||'';
  STORE.pending={unit:next.unit,name:nm,at:Date.now(),sig:sig,mask:mask,tries:0,flt:next.unit===S.unit};
  STORE.warn='';
  clearTimeout(_staleT);
  /* выбор снова тот, что на экране (ушли и вернулись, пока ждали ответа) — маска та же, что у
     показанного ответа: Proteus её может не перезапросить, поэтому с меткой */
  if(!(sig===echoSig()?emitPend(mask,true):ENV.emit(mask))){
    STORE.pending=null;
    STORE.warn='Фильтры не применились: здесь нет кросс-фильтра — откройте чарт на дашборде.';
  }
  ROOTEL.classList.toggle('tp-busy',!!STORE.pending);
  /* ответа нет 45 секунд — говорим об этом, а не ждём молча */
  clearTimeout(_pendT);
  _pendT=setTimeout(()=>{
    if(!STORE.pending)return;
    STORE.warnSig=STORE.pending.sig;
    STORE.pending=null;ROOTEL.classList.remove('tp-busy');
    STORE.warn='Ответ не пришёл за 45 секунд. Проверьте кросс-фильтры чарта в настройках дашборда.';
    renderHead();
  },45000);
  renderHead();
}
function requestUnit(p,back){
  if(p===S.unit||!unitId(p))return;
  if(!back)pushBack(S.unit);
  request(Object.assign(curReq(),{unit:p}));
}
/* Пришёл ответ: юнит и фильтры — те, что применил датасет (DEFAULT_STATE в
   режиме пробника). Сменился юнит — раскрытия, выбор строки и поиск относятся
   к прежнему дереву и сбрасываются; вкладка, метрики и раскладка остаются. */
function arrive(){
  const prev=STORE.S;
  if(prev){
    Object.assign(S,prev,{unit:D.DEFAULT_STATE.unit,paint:D.DEFAULT_STATE.paint,
      itSeg:D.DEFAULT_STATE.itSeg,staffType:D.DEFAULT_STATE.staffType,hcType:D.DEFAULT_STATE.hcType,
      hcSet:D.DEFAULT_STATE.hcSet.slice()});
    const ui=STORE.ui||{};
    tq=ui.tq||'';splitMode=ui.splitMode==='charts'||ui.splitMode==='both'?ui.splitMode:null;splitUnit=ui.splitUnit||null;splitShare=ui.splitShare!=null?ui.splitShare:null;
    if(prev.unit!==S.unit){S.selNode=null;expanded.clear();openRows.clear();tq=''}
  }
  const pend=STORE.pending;
  /* 12.11, п. 4: ответ на запрос, по которому уже показана «Ответ не пришёл за 45 секунд», всё-таки пришёл — плашка
     снимается: она говорит о состоянии текущего запроса, а не о прошлой неудаче */
  if(!pend&&STORE.warnSig!=null&&STORE.warnSig===echoSig()){STORE.warn='';STORE.warnSig=null}
  /* ответ не на последний запрос (устаревший или перерисовка прежними данными): ждём нужный.
     Пришёл позже секунды после запроса — это настоящий старый ответ; нужный не пришёл за
     STALE_WAIT — один повтор той же маски с меткой */
  if(pend&&pend.sig&&pend.sig!==echoSig()){
    ROOTEL.classList.add('tp-busy');
    const late=Date.now()-pend.at>1000;
    clearTimeout(_staleT);
    if(late&&pend.tries<MAX_RESEND)_staleT=setTimeout(()=>{
      const p=STORE.pending;
      if(p!==pend||p.tries>=MAX_RESEND)return;
      p.tries++;p.at=Date.now();emitPend(p.mask,true);renderHead();
    },STALE_WAIT);
    clearTimeout(_pendT);
    _pendT=setTimeout(()=>{
      if(STORE.pending!==pend)return;
      STORE.warnSig=pend.sig;
      STORE.pending=null;ROOTEL.classList.remove('tp-busy');
      STORE.warn='Ответ не пришёл за 45 секунд. Проверьте кросс-фильтры чарта в настройках дашборда.';
      renderHead();
    },Math.max(1000,45000-(Date.now()-pend.at)));
  }else if(pend){
    STORE.pending=null;clearTimeout(_pendT);clearTimeout(_staleT);
    /* новый запрос (юнит, фильтры) — экран начинается сверху: прежнюю прокрутку забываем */
    STORE.scroll=null;
    ROOTEL.classList.remove('tp-busy');
    /* смена «Смотреть как» просит юнит по умолчанию — у другого логина он свой: это не «юнит не открылся» */
    STORE.warn=!pend.asSw&&pend.unit!==S.unit&&D.REAL.scopeId!==unitId(pend.unit)
      ?'«'+(pend.name||'Юнит')+'» не открылся: его нет в данных последнего полного месяца.':'';
  }
  if(D.REAL.truncated)STORE.warn='Ответ датасета обрезан лимитом строк чарта — часть подразделений не показана. '+
    'Поднимите «Лимит строк» в настройках чарта.';
  if(D.REAL.noMeta)STORE.warn='В ответе нет служебной строки meta: датасет не тот или «Лимит строк» слишком мал.';
  if(D.REAL.missing.length)STORE.warn='В данных чарта нет колонок: '+D.REAL.missing.join(', ')+
    ' — добавьте их в «Измерения» чарта.';
  unitNames[S.unit]=(D.NODE_BY_PATH[S.unit]||{}).name||'';
  const bl=$('#btnLink');if(bl)bl.style.display='none';
  ROOTEL.classList.add('tp-pilot');
  const lg=$('.logo small');if(lg)lg.textContent='Hub · пробник';
  return pend?(STORE.pending?'stale':true):false;
}
/* поставка «по частям»: экран вкладки, пока её данные не пришли от загрузчика, — значок загрузки и что именно ждём; экран
   вкладки не собирается (без разрезов он был бы неполным). Часть не пришла за срок — причина и что проверить */
/*split:*/
function partWaitView(tab){
  const b=D.BLOCK_BY_KEY[tab]||{}, w=D.partsWait(tab), late=D.partsLate(tab);
  const what=w.map(p=>D.PART_NAMES[p]||p).join(', ');
  return '<div class="part-wait'+(late.length?' late':'')+'" role="status" aria-live="polite">'+(late.length?'':'<span class="pw-sp" aria-hidden="true"></span>')+
    '<b>'+(late.length?'Данные вкладки «'+esc(b.name||'')+'» не пришли':'Загружаю данные вкладки «'+esc(b.name||'')+'»…')+'</b>'+
    '<span>'+(late.length
      ?'Не ответил загрузчик: '+esc(late.map(p=>D.PART_NAMES[p]||p).join(', '))+'. Проверьте, что чарты-загрузчики TeamPulse Hub есть на дашборде и загрузились, затем обновите дашборд.'
      :'Осталось: '+esc(what)+'. Вкладка откроется сама, как только данные придут.')+'</span></div>';
}
/*:split*/
/* Чипы пробника в шапке: ожидание ответа, предупреждение и что здесь живое */
/* Пункт меню блока в разработке (14.10): целиком — полосатая метка, частично —
   полосатый квадратик с подсказкой, сколько вкладок ещё без источника. */
function navDev(bk){
  const st=SC.blockDev(bk);
  if(!st)return '';
  const subs=(SC.blocks[bk]||{}).subTabs||[], n=subs.filter(t=>SC.devOf(bk,t[0])).length;
  return st==='full'?'<span class="nav-dev full"'+U.tipAttr({title:'В разработке',text:'Данных по блоку пока нет: цифры условные.'})+'>в разраб.</span>'
    :'<span class="nav-dev part"'+U.tipAttr({title:'Частично в разработке',text:'Цифры условные на '+n+' '+U.plural(n,['вкладке','вкладках','вкладках'])+' из '+subs.length+'.'})+'></span>';
}
function pilotChips(){
  let h='';
  const p=STORE.pending;
  /* ожидание ответа — карточкой с огоньками над отчётом (#tpLoad), не чипом: здесь только её подпись */
  const ln=$('#tpLoadN');
  if(ln)ln.textContent=p&&p.name?(p.flt?'Фильтры для «'+p.name+'»':'«'+p.name+'»'):'';
  if(STORE.warn)h+='<span class="chip warn">'+esc(STORE.warn)+'</span>';
  /* поставка «по частям»: первый экран уже показан, а часть деталей ещё в пути — говорим об этом, а не меняем цифры молча */
  /*split:*/
  const pw=D.partsWait('onepager');
  if(pw.length&&!p)h+='<span class="chip part"'+U.tipAttr({title:D.partsLate('onepager').length?'Часть данных не пришла':'Данные догружаются',
    text:'Первый экран уже готов. '+(D.partsLate('onepager').length?'Не пришли':'Ещё в пути')+': '+pw.map(x=>D.PART_NAMES[x]||x).join(', ')+'.',
    note:'Пока их нет, выводы и сравнения с базой могут быть неполными — они обновятся сами.'})+'>'+
    (D.partsLate('onepager').length?'<span class="pc-x">!</span>Часть данных не пришла':'<span class="pc-sp" aria-hidden="true"></span>Догружаю детали…')+'</span>';
  /*:split*/
  /* 12.11 (итерация «переносы, интерфейс, AI», п. 2): служебной плашки «О данных» в шапке нет */
  return h;
}

/* ---------- шапка и навигация ---------- */
function renderHead(){
  /* поставка 69: выше зоны доступа — нельзя: предок корня зоны (anc) не кнопка и не «Уровнем выше» */
  /* 11.11: технический верхний уровень (D.TECH) — ни в пути, ни в «Уровнем выше» */
  const n=D.NODE_BY_PATH[S.unit], par0=D.NODE_BY_PATH[n.parent], par=par0&&!par0.anc&&!D.isTech(par0.path)?par0:null;
  const pp=unitBack[unitBack.length-1];
  const prev=D.NODE_BY_PATH[pp]||(pp&&unitNames[pp]?{name:unitNames[pp]}:null);
  /* «← Назад» и «↑ Уровнем выше» стоят перед путём: путь отвечает «где я»,
     кнопки — «как вернуться». Предки в пути кликабельны, как и раньше. */
  const nav=(prev?'<button class="nb" data-uback="1"'+U.tipAttr({title:'Назад',
      text:'Вернуться к «'+prev.name+'».'})+'><span class="nb-ar" aria-hidden="true">←</span>Назад</button>':'')+
    (par?'<button class="nb" data-crumb="'+par.path+'"'+U.tipAttr({title:'Уровнем выше',
      text:'Перейти к «'+par.name+'».'})+'><span class="nb-ar" aria-hidden="true">↑</span>Уровнем выше</button>':'');
  $('#crumbs').innerHTML=(nav?'<span class="nbs">'+nav+'</span>':'')+D.ancestorsOf(S.unit).filter(a=>!D.isTech(a.path)).map((a,i,arr)=>
    i===arr.length-1
      ? '<span>'+esc(a.name)+'</span>'
      : (a.anc?'<span>'+esc(a.name)+'</span>':'<button data-crumb="'+a.path+'">'+esc(a.name)+'</button>')+'<span class="sep">/</span>'
  ).join('');
  $('#unitTitle').innerHTML=esc(n.name)+'<span class="lvl">'+esc(D.levelLabel(n.level))+'</span>';
  /* Нет разрезов — нет и плашки «Разрезы не выбраны»: пустое состояние занимало
     строку и притягивало взгляд, ничего при этом не сообщая. Остаются только
     чипы базы сравнения, они есть всегда. */
  const chips=D.filterChips(S);
  /* 12.11-д: администратор смотрит чужими глазами — первым чипом, с крестиком «вернуться к себе» */
  let html=(ENV&&D.REAL&&D.REAL.adm&&D.REAL.asLogin?'<span class="chip as"'+U.tipAttr({title:'Смотреть как пользователь',
    text:'Отчёт посчитан так, как его видит логин «'+D.REAL.asLogin+'»: его подразделения, юнит по умолчанию и цифры. Крестик — вернуться к себе.'})+
    '>Глазами: <b>'+esc(D.REAL.asLogin)+'</b><button class="x" data-asoff="1"'+U.tipAttr({title:'Вернуться к себе'})+'>×</button></span>':'')+chips.map(c=>'<span class="chip">'+esc(c.label)+'<button class="x" data-unchip="'+c.k+'"'+
    U.tipAttr({title:'Снять фильтр',text:c.label})+'>×</button></span>').join('');
  /* поставка 117 (владелец: «у нас есть база — при наведении расшифровка: похожие по численности подразделения с учётом
     фильтров»): чип называет базу этого отчёта — группу численности; без базы — с чем сравниваем вместо неё */
  const pe0=D.peerOf('turnover_y');
  html+=pe0?'<span class="chip bench"'+U.baseTip(null,pe0)+'>База: <b>подразделения '+esc(pe0.bandName)+' чел</b></span>'
    :'<span class="chip bench"'+U.tipAttr({title:'С чем сравниваем',text:D.isSmall()?'В команде меньше '+D.SMALL_N+' человек — доли не сравниваем. Количества сравниваем:'
      :'Подразделений такого же размера для сравнения нет. Сравниваем:',
      list:['с целью, где она есть','со всей компанией с теми же фильтрами','с прошлым годом']})+
      '>Сравнение: <b>'+esc(D.coName(S,'nom'))+'</b></span>';
  /* тип численности по умолчанию — чипом без крестика: отчёт на «Активной», и это видно */
  if(S.hcType==='active'&&(!ENV||D.REAL.cuts.has('act')))html+='<span class="chip bench"'+
    U.tipAttr({title:'Тип численности: '+D.HC_DEF.join(', '),text:'Весь отчёт — по типу численности «'+D.HC_DEF.join('», «')+
      '». Подрядчики и другие типы — «Настрой свой дашборд» → «Тип численности».'})+
    '>Тип численности: <b>'+esc(D.HC_DEF.join(', '))+'</b></span>';
  /* после перехода в отдел команд в отборе бывает одна — «1 команд» не пишем */
  const nT=D.unitsInScope(S);
  /* 30.10, критики: «в шапке 30 подразделений в таблице, а видно три» — первый уровень и сколько всего в дереве */
  /* поставка 121: сквозной уровень (единственное подразделение с теми же людьми) не считаем — D.passRoot */
  const n1=D.rowsOf(D.passRoot(S.unit)).length;
  html+='<span class="chip bench">'+(n1?D.fmtInt(n1)+' '+U.plural(n1,D.UNIT_WORDS)+' ниже'+(nT>n1?' · '+D.fmtInt(nT)+' в дереве':'')
    :'без подразделений ниже')+'</span>';
  /* Период — чипом рядом с базой, а не отдельной плашкой справа: плашка
     повторяла свежесть данных в шапке и забирала место у кнопок. Здесь он
     остаётся и в печатной версии, где шапка приложения скрыта. */
  /* поставка 121 (критики 119: «Период: ноябрь 2025 — 12 октября 2026» рядом со строкой «Числа — за 1 января – 12 октября»
     читалось как период чисел): это окно мини-графиков «12 мес» и водопада — так и подписано */
  /* поставка 126 (владелец 08.11, фото главной: «вот тут прям какая-то куча текста»): чип «12 мес.: декабрь — ноябрь» снят —
     второй период рядом с «числа с 1 января» путал; окно мини-графиков подписано в подсказке колонки «12 мес» главной,
     окно водопада — в его заголовке («с 1 декабря …») */
  if(ENV)html+=pilotChips();
  $('#chips').innerHTML=html;
  const fr=$('#freshness');
  /* 20.10: последний месяц — текущий, данные по дату данных; закрыт — как раньше */
  if(fr)fr.innerHTML='<span class="dot"></span>'+(D.PARTIAL?'данные на <b>'+esc(D.ASOF_LABEL)+'</b>':'закрытый месяц <b>'+esc(D.CMP.cur)+'</b>');
}
/* 30.10, шаг 1 (критики: «красные точки у 5 из 8 пунктов — ощущение пожара»): красная точка — только у блока, вывод
   которого «Требует действий»; остальные — серые. Тот же источник, что у вывода блока, — точка и вывод не спорят */
/* 31.10 (поставка 82, «подлагивает»): сигналы всех блоков пересчитывались на каждый клик — шаг главы, вкладку,
   сортировку — до четверти времени клика. Сигнал зависит от среза, не от того, что открыто: кэш по срезу */
const NAV_UI=new Set(['tab','subTab','tsort','spmSort','exitIni','mixSel','mixRows','mixCols','mixMode',
  'mxFull','aiOpen','offCity','offSeg','rostSt','aiSel']);
let _navKey=null, _navMemo={};
function navSig(bk){
  /* поставка «по частям»: разрезы блока ещё грузятся — сигнала нет (вместо точки — значок загрузки) */
  /*split:*/if(D.partsWait(bk).length)return null;/*:split*/
  const k=JSON.stringify(S,(n,v)=>NAV_UI.has(n)?undefined:v);
  if(k!==_navKey){_navKey=k;_navMemo={}}
  return _navMemo[bk]||(_navMemo[bk]=navSig0(bk));
}
function navSig0(bk){
  const I=window.TPINSIGHTS;
  if(!I||!I.blockSummary)return D.blockSignal(bk,S).state==='bad'?'bad':'neutral';
  /* поставка 120 (критики 119): точка — по тяжести вывода блока, как мини-навигация главной: требует действий — красная,
     посмотреть — жёлтая, только хорошие новости — зелёная */
  try{const sv=I.blockSummary(bk,S,D.reportLeaves(S),D.benchmarkLeaves(S)).sev;
    return sv==='high'?'bad':sv==='mid'?'warn':sv==='good'?'good':'neutral'}catch(e){return 'neutral'}
}
/* 11.11, владелец: у каждой вкладки — свой значок; на узком экране (и по кнопке) панель сворачивается до значков, название —
   в подсказке. Точка сигнала блока — на углу значка, только если сигнал есть */
const NAV_IC={
  onepager:'<rect x="3.5" y="3.5" width="7" height="8" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/>',
  structure:'<rect x="9" y="3" width="6" height="5" rx="1.3"/><rect x="3" y="16" width="6" height="5" rx="1.3"/><rect x="15" y="16" width="6" height="5" rx="1.3"/><path d="M12 8v4M6 16v-4h12v4"/>',
  movement:'<path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6M9.5 12.5 6 16l3.5 3.5"/>',
  turnover:'<path d="M13 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H13M10 12h10M17 8.5l3.5 3.5-3.5 3.5"/>',
  hiring:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M18.5 7.5v6M15.5 10.5h6"/>',
  tgrowth:'<path d="M3 18l6-6 4 4 7.5-7.5M15 8.5h5.5V14"/>',
  monitor:'<path d="M3 12.5h4l2.5-6.5 5 13 2.5-6.5h4"/>',
  office:'<rect x="4" y="3" width="11" height="18" rx="1.3"/><path d="M15 9h4a1 1 0 0 1 1 1v11M8 7.5h3M8 11.5h3M8 15.5h3M2.5 21h19"/>',
  ai:'<path d="M11 3.5l1.9 4.9 4.9 1.9-4.9 1.9L11 17.1l-1.9-4.9-4.9-1.9 4.9-1.9z"/><path d="M18.5 14.5l.8 2.1 2.2.9-2.2.8-.8 2.2-.9-2.2-2.1-.8 2.1-.9z"/>'};
const navIc=(k,sig)=>'<span class="ni-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '+
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(NAV_IC[k]||'<circle cx="12" cy="12" r="4"/>')+'</svg>'+
  '<span class="ico'+(sig?' sig-'+sig:'')+'"></span></span>';
/* поставка «по частям»: у вкладки, чьи данные ещё грузятся, — кольцо загрузки на значке; не пришли за срок — метка «!» */
const navWait=k=>{
  /*split:*/
  if(k!=='onepager'&&D.partsWait(k).length)
    return D.partsLate(k).length?'<span class="ni-w late" aria-label="Данные не загрузились"></span>':'<span class="ni-w" aria-label="Данные загружаются"></span>';
  /*:split*/
  return '';
};
const navBtn=(k,name,sig,tail)=>'<button class="nav-i'+(S.tab===k?' active':'')+(navWait(k)?' wait':'')+'" data-tab="'+k+'" aria-label="'+esc(name)+'"'+
  (navMini()?U.tipAttr({title:name}):'')+'>'+navIc(k,sig).replace('</span></span>','</span>'+navWait(k)+'</span>')+'<span class="ni-t">'+esc(name)+'</span>'+(tail||'')+'</button>';
function renderNav(){
  const one=$('#navOne');if(one)one.innerHTML=navBtn('onepager','One-pager',null,'');
  /* блок, у которого пользователь отключил все метрики, из навигации уходит */
  $('#navBlocks').innerHTML=D.visibleBlocks(S).map(b=>
    /* точка у пункта — худший сигнал блока, тем же цветом, что в мини-навигации
       One-pager: в какой блок идти, видно с любой вкладки */
    navBtn(b.key,b.name,navSig(b.key),navDev(b.key))).join('');
}
/* свёрнутая панель: выбор пользователя (кнопка) запоминается; пока его нет — по ширине окна (уже 1280px — значки) */
const NAV_MINI_W=1280;
/* 11.11, итерация «MoM и меню», п. 3 («кнопка не работает»): в песочнице Proteus хранилища браузера нет — выбор держим в памяти
   отчёта (STORE переживает перезапуск скрипта на каждый ответ датасета), localStorage — только запасной */
let NAV_PREF=null;
function navPref(){
  if(STORE&&STORE.navMini!=null)return STORE.navMini;
  if(NAV_PREF!=null)return NAV_PREF;
  try{const v=localStorage.getItem('tp_nav_mini');return v==='1'?true:v==='0'?false:null}catch(e){return null}
}
function setNavPref(v){NAV_PREF=v;if(STORE)STORE.navMini=v;try{localStorage.setItem('tp_nav_mini',v?'1':'0')}catch(e){}}
function navMini(){const p=navPref();return p!=null?p:window.innerWidth<NAV_MINI_W}
function applyNavMini(){
  /* класс — на корне отчёта (в Proteus — контейнер чарта, иначе body) */
  const el=ROOTEL&&ROOTEL.classList?ROOTEL:document.body;if(!el||!el.classList)return false;
  const on=navMini(), was=el.classList.contains('nav-mini');
  el.classList.toggle('nav-mini',on);
  const b=$('#navMini');
  if(b){b.setAttribute('aria-expanded',String(!on));b.setAttribute('aria-label',on?'Развернуть панель':'Свернуть панель');
    b.setAttribute('title',on?'Развернуть панель':'Свернуть до значков')}
  return was!==on;
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
  /* загрузка (21.10, заказчик): огоньки по очереди — собирает с ключом, считает, готово; видна только
     с .tp-busy, пока датасет отвечает (styles.css) */
  const tl=$('#tpLoad');
  if(tl)tl.innerHTML='<div class="ld-f">'+M.img('setup',52)+M.img('base',52)+M.img('ok',52)+'</div>'+
    '<div class="ld-c"><span>Собираем данные…</span><span>Считаем метрики…</span><span>Готовим выводы…</span></div>'+
    '<div class="ld-n" id="tpLoadN"></div>';
}

/* ---------- модалка настройки ---------- */
function openSetup(){
  DRAFT={unit:S.unit,paint:S.paint,itSeg:S.itSeg,staffType:S.staffType,hcType:S.hcType,hcSet:(S.hcSet||[]).slice(),
    hiddenMetrics:(S.hiddenMetrics||[]).slice()};
  HCDD=false;
  UT={q:'',open:{}};
  $('#utQ').value='';
  paintOpts();
  asGrp();
  $('#setupOvl').classList.remove('hidden');
  utCenter();
}
/* 12.11-д, «Смотреть как пользователь» (владелец: разбирать жалобы «вижу не те цифры» — как именно настроен доступ
   логина). Блок есть только у администраторов (meta.adm: логин в списке FULL датасета). Отчёт перезапрашивается
   с кросс-фильтром as_f: датасет считает зону, юнит по умолчанию и цифры так, как их видит этот логин */
function asGrp(){
  const g=$('#asGrp');if(!g)return;
  const on=!!(ENV&&D.REAL&&D.REAL.adm);
  g.classList.toggle('hidden',!on);
  if(!on)return;
  const cur=D.REAL.asLogin;
  $('#asNow').innerHTML=cur?'Сейчас отчёт — глазами <b>'+esc(cur)+'</b>. <button class="lnk" data-asoff="1">Вернуться к себе</button>':'';
  $('#asQ').value='';
}
function viewAs(login){
  const l=String(login||'').trim().toLowerCase();
  if(!ENV||!D.REAL||!D.REAL.adm||l===(D.REAL.asLogin||''))return;
  closeSetup();
  /* у другого логина своя зона: история «Назад», раскрытия и выбор строки — от прежнего дерева */
  unitBack.length=0;S.selNode=null;expanded.clear();openRows.clear();tq='';
  request(Object.assign(curReq(),{as:l,unit:defUnit()}));
  if(STORE.pending)STORE.pending.asSw=1;
}
/* выбранная строка — посередине списка (прокрутка только у списка, не у окна) */
function utCenter(){
  const l=$('#utList'), c=l&&l.querySelector('.ut-r.cur');
  if(l)l.scrollTop=c?Math.max(0,c.offsetTop-l.offsetTop-l.clientHeight/2+c.offsetHeight/2):0;
}
/* ---------- Дерево выбора юнита (19.10, как в HRBP HUB) ----------
   Всё дерево (в пробнике — справочник датасета): компания и два уровня под ней раскрыты,
   путь к выбранному — тоже; глубже — по стрелке. Поиск — по названию, логину и имени
   руководителя (имя — с поставки 66), без запроса. Число у строки — сколько людей попадёт в выбор с набранными
   фильтрами (последний закрытый месяц); прежний датасет без fd — без чисел. */
let UT={q:'',open:{}};
const UT_MAX=600;
function utOpen(p,lvl0){
  if(UT.open.hasOwnProperty(p))return UT.open[p];
  if(DRAFT&&(DRAFT.unit===p||DRAFT.unit.indexOf(p+'/')===0))return true;
  const i=D.PICK.info(p);
  return !!i&&i.lvl<lvl0+2;
}
function utCount(p){
  const n=D.draftCount(p,DRAFT);
  return n==null?'':'<span class="ut-c'+(n?'':' zero')+'">'+D.fmtInt(n)+'</span>';
}
function utHl(text,q){
  const at=q?text.toLowerCase().indexOf(q):-1;
  return at<0?esc(text):esc(text.slice(0,at))+'<mark class="ut-hl">'+esc(text.slice(at,at+q.length))+'</mark>'+esc(text.slice(at+q.length));
}
/* руководитель под именем юнита (поставка 83, как в таблице подразделений): в строке — только логин; ФИ, логин и
   численность — в подсказке на строке; уровня нет. Поиск по ФИ работает по-прежнему (utListHTML) */
function utHead(i,q){
  return i.head?'<span class="ut-h">'+utHl(i.head,q)+'</span>':'';
}
function utRow(p,i,depth,tw,extra){
  /* 12.11-б: предок зоны доступа — строка структуры: не выбирается, без числа людей */
  if(i.anc)return '<div class="ut-r anc" role="presentation"'+(depth!=null?' style="padding-left:'+(9+depth*16)+'px"':'')+
    U.tipAttr({title:i.name,text:'У вас нет доступа к этому уровню целиком — только к подразделениям ниже.'})+'><span class="ut-sp"></span>'+
    '<span class="ut-n">'+esc(i.name)+'</span></div>';
  const n=D.draftCount(p,DRAFT);
  return '<div class="ut-r'+(DRAFT.unit===p?' cur':'')+'" data-upick="'+esc(p)+'" role="option" aria-selected="'+(DRAFT.unit===p)+'"'+
    (depth!=null?' style="padding-left:'+(9+depth*16)+'px"':'')+
    U.unitTip(i.name,n==null?null:D.fmtInt(n)+' чел',{name:i.hname,login:i.head})+'>'+tw+
    '<span class="ut-n">'+(extra&&extra.name||esc(i.name))+(extra&&extra.path?'<span class="ut-p">'+esc(extra.path)+'</span>':'')+
    utHead(i,extra&&extra.q||'')+'</span>'+utCount(p)+'</div>';
}
function utListHTML(){
  const q=UT.q.trim().toLowerCase(), P=D.PICK, root=P.info(P.root), lvl0=root?root.lvl:1;
  if(!q){
    const out={s:'',n:0};
    const walk=(p,depth)=>{
      const i=P.info(p);
      if(!i||out.n>=UT_MAX)return;
      out.n++;
      /* 12.11-б: несколько корней зоны — дерево идёт сверху через предков (строки-предки раскрыты всегда) */
      const kids=i.kids?(P.treeRoots?P.treeKids(p):P.kids(p)):[], open=kids.length&&(i.anc||utOpen(p,lvl0));
      out.s+=utRow(p,i,depth,kids.length?'<button class="ut-tw" data-utw="'+esc(p)+'" aria-expanded="'+!!open+'">'+(open?'▾':'▸')+'</button>':'<span class="ut-sp"></span>');
      if(open)kids.map(k=>[k,P.info(k)]).filter(x=>x[1]).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ru'))
        .forEach(x=>walk(x[0],depth+1));
    };
    /* поставка 69: окно начинается с корней зоны доступа (у полного доступа — корень компании) */
    (P.treeRoots||P.roots||[P.root]).forEach(r=>walk(r,0));
    return out.s;
  }
  /* поиск: по названию, логину и имени руководителя (имя — с поставки 66; «Иван Петров» находится и по фамилии);
     сначала совпадение с начала слова, выше уровнем */
  const hits=[];
  P.all().forEach(p=>{
    const i=P.info(p);if(!i)return;
    const an=i.name.toLowerCase().indexOf(q), ah=i.head?i.head.toLowerCase().indexOf(q):-1,
      hn=(i.hname||'').toLowerCase(), am=hn.indexOf(q);
    if(an<0&&ah<0&&am<0)return;
    const start=an===0||(an<0&&(ah===0||am===0||(am>0&&hn[am-1]===' ')));
    hits.push({p,i,byHead:an<0,rank:(start?0:1)*100+i.lvl});
  });
  if(!hits.length)return '<div class="ut-none">Ничего не найдено</div>';
  hits.sort((a,b)=>a.rank-b.rank||a.i.name.localeCompare(b.i.name,'ru'));
  return hits.slice(0,80).map(h=>{
    const chain=h.p.split('/'), names=[];
    for(let k=Math.max(1,chain.length-4);k<chain.length;k++){const q=chain.slice(0,k).join('/'), x=D.isTech(q)?null:P.info(q);if(x)names.push(x.name)}
    return utRow(h.p,h.i,null,'<span class="ut-sp"></span>',{name:h.byHead?esc(h.i.name):utHl(h.i.name,q),
      path:names.join(' › '),q:h.byHead?q:''});
  }).join('')+(hits.length>80?'<div class="ut-none">Показаны 80 из '+hits.length+' — уточните запрос</div>':'');
}
function utRender(){
  $('#utList').innerHTML=utListHTML();
  const cnt=D.draftCount(DRAFT.unit,DRAFT)!=null;
  $('#utHint').innerHTML=(cnt?'Цифры — сколько людей попадёт в выбор ('+esc(D.PARTIAL?'на '+D.ASOF_LABEL:D.CMP.cur)+'). ':'')+'Ваша команда; на базу сравнения не влияет.';
}
function paintOpts(){
  /* у значения фильтра — сколько людей попадёт в выбор, если нажать (19.10, как в HRBP HUB) */
  const row=(id,list,field)=>{
    $(id).innerHTML=list.map(o=>{
      const n=D.draftCount(DRAFT.unit,Object.assign({},DRAFT,{[field]:o.key}));
      return '<button class="opt'+(DRAFT[field]===o.key?' on':'')+'" data-f="'+field+'" data-v="'+o.key+'">'+esc(o.name)+
        (n==null?'':'<span class="opt-n">'+D.fmtInt(n)+'</span>')+'</button>';
    }).join('');
  };
  $('#optHc').innerHTML=hcDdHTML();
  row('#optPaint',D.PAINTS,'paint');
  row('#optIt',D.ITSEGS,'itSeg');
  row('#optStaff',D.STAFFTYPES,'staffType');
  /* пробник: фильтра, которого нет в meta.cuts, в окне нет (файл 2 — без покраски; таблицы
     ноутбука до 20.10 — без типа численности) */
  if(ENV)[['#optPaint','paint'],['#optIt','it'],['#optHc','act']].forEach(([id,c])=>{
    const g=$(id)&&$(id).closest('.fgrp');if(g)g.style.display=D.REAL.cuts.has(c)?'':'none';
  });
  utRender();
  metricOpts();
  const d=Object.assign({},S,DRAFT);
  /* итог «после Применить»: юнит и база с набранными фильтрами; без fd (прежний датасет) —
     численность по уже применённым, как раньше */
  const tn=D.draftCount(d.unit,d), bn=D.draftCount(D.PICK.base||D.PICK.root,d);
  const nm=(D.PICK.info(d.unit)||D.NODE_BY_PATH[d.unit]||{}).name||'';
  const rl=D.reportLeaves(d), bl=D.benchmarkLeaves(d);
  /* 12.11 (владелец: «в настройках база — вся компания, 79 тыс., а в шапке — подразделения 30–99 чел»): база в окне — та же,
     что в шапке: подразделения той же группы численности с теми же фильтрами (D.peerOf). Группа — по численности команды
     с набранными фильтрами; выбор как в отчёте — группа и наличие базы из ответа датасета. Нет базы (команда меньше 30 или
     таких подразделений мало) — «сравниваем со всей компанией», число компании — только если оно посчитано (у логина с
     ограниченной зоной компании в справочнике нет — числа нет, а не старое число без фильтров) */
  const teamN=tn!=null?tn:D.lastVal(rl,'hc_total');
  const same=d.unit===S.unit&&d.paint===S.paint&&d.itSeg===S.itSeg&&d.staffType===S.staffType&&hcSig(d)===hcSig(S);
  const pe=same?D.peerOf('turnover_y'):null, band=same?(pe?pe.band:0):D.bandN(teamN);
  const coN=bn!=null?bn:same?D.lastVal(bl,'hc_total'):null;
  $('#benchPreview').innerHTML=(tn!=null?'После «Применить» — ваша команда: <b>':'Ваша команда: <b>')+esc(nm)+'</b>, '+
    D.fmtVal('hc_total',teamN)+' чел.<br>'+(band?'База сравнения: <b>подразделения '+esc(D.PEER_BAND_NAME[band])+' чел</b> — такого же размера, с теми же фильтрами.'
      :'Подразделений такого же размера для сравнения нет'+(teamN!=null&&teamN<D.SMALL_N?' (в команде меньше '+D.SMALL_N+' человек)':'')+
       '. Сравниваем со <b>'+esc(D.coName(d,'ins'))+'</b>'+(coN!=null?', '+D.fmtVal('hc_total',coN)+' чел.':'.'));
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
      /* на активной численности «Активная численность» и есть «Численность» — отдельно её нет */
      if(m.key==='hc_active'&&(DRAFT||S).hcType!=='all')return '<button class="mp-i lock" disabled'+
        U.tipAttr({title:m.name,text:'На активной численности совпадает с «Численностью» и отдельно не показывается.'})+
        '><span class="box"></span><span class="nm">'+esc(m.name)+'</span><span class="lk">= численность</span></button>';
      if(D.LOCKED_METRICS.has(m.key))return '<button class="mp-i on lock" disabled'+
        U.tipAttr({title:m.name,text:'На ней держится весь отчёт, поэтому её не отключить.'})+
        '><span class="box"></span><span class="nm">'+esc(m.name)+'</span><span class="lk">всегда</span></button>';
      return '<button class="mp-i'+(hid.has(m.key)?'':' on')+'" data-mtoggle="'+m.key+'"'+
        U.tipAttr({title:m.name,text:U.metricText(m)})+
        '><span class="box"></span><span class="nm">'+esc(m.name)+'</span></button>';
    }).join('');
    /* 12.11 (итерация «настройки, One Pager, мониторинг», п. 1): у AI метрик-строк нет — галочки управляют его графиками
       (вкладка AI и One Pager): «Проникновение» и «Активные пользователи» */
    const ai=b.key==='ai'?D.AI_CHARTS.map(x=>'<button class="mp-i'+(hid.has(x[0])?'':' on')+'" data-mtoggle="'+x[0]+'"'+
      U.tipAttr({title:x[1],text:'График по неделям на вкладке «AI-инструменты» и на One-pager.'})+
      '><span class="box"></span><span class="nm">'+esc(x[1])+'</span></button>').join(''):'';
    if(!items&&!ai)return '';
    return '<div class="mpick-g"><div class="mpick-h">'+esc(b.name)+'</div>'+
      '<div class="mpick-l">'+items+ai+'</div></div>';
  }).join('');
  const hidB=D.BLOCKS.length-D.visibleBlocks(DRAFT).length;
  $('#metricCount').innerHTML='Выбрано <b>'+D.visibleCount(DRAFT)+'</b> из '+D.SHOWN.length+' метрик'+
    (cur?'':' — свой набор')+'. Отключённые пропадут из One-pager, карточек и таблиц; графики в блоках останутся.'+
    (hidB?' Скрыто блоков: <b>'+hidB+'</b> — они уйдут и из меню слева.':'');
}
/* ---------- Срез состава ----------
   Один срез на разрез: клик по «Senior» после «Junior» не складывает их, а
   заменяет — две категории одного разреза в пересечении дают ноль, и таблица
   молча опустела бы. Дальше SLICE_MAX атрибутов срез не растёт: на третьем
   начинаются доли от долей, и в клетке остаётся полчеловека. Уходит самый
   старый — так последний клик пользователя всегда виден в результате.
   Повторный клик по уже взятому снимает ровно его. */
/* 21.10, файл «Структура»: Shift+клик (add) — множественный выбор внутри разреза:
   категория добавляется к уже выбранным того же разреза («Junior или Middle»), повторный
   Shift+клик снимает только её. Обычный клик по-прежнему заменяет категорию разреза. */
function toggleMix(spec,add){
  const want=String(spec).split(',').filter(Boolean);
  let cur=D.sliceParse(S.mixSel).map(p=>p.id);
  if(want.every(id=>cur.indexOf(id)>=0)){
    S.mixSel=cur.filter(id=>want.indexOf(id)<0);return;
  }
  want.forEach(id=>{
    const dim=id.split(':')[0];
    if(!add)cur=cur.filter(x=>x.split(':')[0]!==dim);
    if(cur.indexOf(id)<0)cur.push(id);
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
function closeSetup(){$('#setupOvl').classList.add('hidden');DRAFT=null;HCDD=false}

/* Тип численности (поставка 61): все значения active_type_nm выпадающим списком — их много. Кнопка — выбор и
   сколько людей в нём; в списке — каждый тип с галочкой и числом людей. По умолчанию отмечена «Активная» */
let HCDD=false;
function hcDdHTML(){
  const d=DRAFT, sel=D.hcSel(d), n=D.draftCount(d.unit,d), lc=x=>String(x).toLowerCase();
  const on=t=>!sel||sel.map(lc).indexOf(lc(t))>=0;
  const v=d.hcType==='all'?'Все типы':D.hcTypesShort(d.hcType==='set'?d.hcSet:D.HC_DEF);
  const nn=x=>x==null?'':'<span class="opt-n">'+D.fmtInt(x)+'</span>';
  return '<div class="hcd'+(HCDD?' open':'')+'" id="hcDd"><button type="button" class="hcd-b" data-hcdd aria-expanded="'+HCDD+'">'+
    '<span class="hcd-v">'+esc(v)+'</span>'+nn(n)+'<span class="hcd-c"></span></button><div class="hcd-p">'+
    '<div class="hcd-l">'+
    /* 12.11, п. 2: «Выбрать все» — первая строка: все типы одним нажатием; отмечены не все — черта (часть), все — галочка.
       Повторное нажатие при всех отмеченных возвращает набор по умолчанию (совсем без типов выбор не бывает) */
    (D.HC_TYPES.length>1?'<button type="button" class="mp-i hcd-all'+(d.hcType==='all'?' on':' part')+'" data-hcall aria-pressed="'+(d.hcType==='all')+'">'+
      '<span class="box"></span><span class="nm">Выбрать все</span>'+nn(D.draftCount(d.unit,Object.assign({},d,{hcType:'all',hcSet:[]})))+'</button>':'')+
    D.HC_TYPES.map(t=>'<button type="button" class="mp-i'+(on(t)?' on':'')+'" data-hct="'+esc(t)+'"><span class="box"></span>'+
      '<span class="nm">'+esc(t==='-'?'Без типа':t)+'</span>'+nn(D.draftCount(d.unit,Object.assign({},d,{hcType:'set',hcSet:[t]})))+
      '</button>').join('')+'</div></div></div>';
}
/* галочка типа: хотя бы один тип остаётся отмеченным; набор по умолчанию и «все» узнаются сами (hcNorm) */
function hcToggle(t){
  const lc=x=>String(x).toLowerCase(), cur=D.hcSel(DRAFT)||D.HC_TYPES.slice();
  const next=cur.map(lc).indexOf(lc(t))>=0?cur.filter(x=>lc(x)!==lc(t)):cur.concat([t]);
  if(next.length)Object.assign(DRAFT,D.hcNorm(next));
}
function applySetup(){
  /* в Proteus юнит и фильтры меняет датасет: уходит кросс-фильтр, а выбор
     метрик — состояние показа, он применяется сразу */
  if(ENV){
    const changed=DRAFT.unit!==S.unit||DRAFT.paint!==S.paint||DRAFT.itSeg!==S.itSeg||DRAFT.staffType!==S.staffType||
      hcSig(DRAFT)!==hcSig(S);
    S.hiddenMetrics=DRAFT.hiddenMetrics.slice();
    if(S.mainMetric&&!D.metricVisible(S.mainMetric,S))S.mainMetric=null;
    const next={as:D.REAL.asLogin,unit:DRAFT.unit,paint:DRAFT.paint,itSeg:DRAFT.itSeg,staffType:DRAFT.staffType,hcType:DRAFT.hcType,
      hcSet:(DRAFT.hcSet||[]).slice()};
    openRows.clear();closeSetup();
    if(changed){if(next.unit!==S.unit)pushBack(S.unit);request(next)}else render();
    return;
  }
  /* смена юнита в модалке — тоже переход: прежний уходит в «← Назад» */
  if(DRAFT.unit!==S.unit){pushBack(S.unit);S.selNode=null;expanded.clear();tq=''}
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
  $$('.nav-i').forEach(x=>{x.setAttribute('aria-current',x.classList.contains('active')?'page':'false')});
  $$('.mrow,.urow,.mx-cell').forEach(x=>{x.tabIndex=0;x.setAttribute('role','button')});
}

/* ---------- роутер ----------
   Экраны возвращают строку разметки, а не пишут в DOM сами. Поэтому весь
   рендер — одна вставка, после которой графики перемеряются под фактическую
   ширину контейнера (в разметке они уже нарисованы при номинальной 900px). */
/* keepScroll=true — перерисовка внутри того же экрана (раскрыли метрику,
   выбрали строку, переключили под-вкладку). Прыгать наверх при клике по
   метрике нельзя: пользователь теряет ту самую строку, которую только что открыл. */
/* quiet=true — перерисовка без анимации графиков: набор в поиске по таблице
   перерисовывает экран на каждую букву, и линии не должны рисоваться заново. */
/* Прокрутка ВНУТРИ панелей (итерация 32, фидбэк 12.10: «при клике на разрез
   не должно быть скролла вверх — нужно оставаться на своём месте»). innerHTML
   заменяет и прокручиваемые контейнеры, и их scrollTop обнулялся, хотя
   прокрутку страницы render(true) уже держал. Теперь держит и их; панель
   графиков начинает сверху только при смене вкладки или главы — там другой
   экран, и стоять посередине чужого нечему. */
const INNER_SCROLL=['.split-l .tbl-wrap','.split-r .panel-b','.st-rail'];
/* 12.11 (итерация «переносы, интерфейс, AI», п. 1): переносы в текстах экрана. Название в кавычках-ёлочках («Блок 2») —
   цельным куском: не рвётся между строк, а если не помещается в остаток строки — уходит на следующую целиком (inline-block
   .nw; название длиннее строки переносится внутри себя — без обрезки и горизонтальной прокрутки). Число и его единица
   (%, п.п., чел, дн, ч, мес) — через неразрывный пробел. Проход по текстовым узлам после вставки экрана; SVG не трогаем */
const NB_RE=/(\d)[ \u2009](?=(?:%|п\.\s?п\.|чел|дн[\s.,;)]|дн$|дня|дней|день|ч[\s.,;)\/]|ч$|мес|раз[\s.,;)а]|нед|млн|тыс))/g;
const NW_RE=/(«[^«»]{2,80}»[,.:;!?…)]?)/;
function tidyText(root){
  if(!root||typeof document.createTreeWalker!=='function'||typeof NodeFilter==='undefined')return;
  const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null), list=[];
  for(let n=tw.nextNode();n;n=tw.nextNode())list.push(n);
  list.forEach(n=>{
    const p=n.parentNode;
    if(!p||!p.closest||p.closest('svg,script,style,textarea,input,.nw'))return;
    let t=n.nodeValue;
    if(!t||t.length<3)return;
    const t2=t.replace(NB_RE,'$1\u00a0');
    if(t2!==t){n.nodeValue=t2;t=t2}
    if(t.indexOf('«')<0)return;
    const parts=t.split(NW_RE);
    if(parts.length<2)return;
    const fr=document.createDocumentFragment();
    parts.forEach((s,i)=>{
      if(!s)return;
      if(i%2){const sp=document.createElement('span');sp.className='nw';sp.textContent=s;fr.appendChild(sp)}
      else fr.appendChild(document.createTextNode(s));
    });
    p.replaceChild(fr,n);
  });
}
let lastView='';
function render(keepScroll,quiet){
  D.setHcMode(S.hcType);                 /* макет: ряды по типу численности (в пробнике — датасет) */
  D.setVerdictScope(S);                  /* поставка 110: один вердикт — малый отчёт и база = сам юнит */
  const sc=ENV?ENV.scroller:null;
  const y=keepScroll?(sc?sc.scrollTop:(window.pageYOffset||0)):0;
  const view=S.tab+'|'+(S.subTab||'');
  const inner=keepScroll?INNER_SCROLL.map(q=>{const el=$(q);return el?[el.scrollTop,el.scrollLeft]:null}):[];
  /* 23.10: полка выбора появляется со срезом и уходит со сбросом — таблица и графики под ней остаются на том же
     месте экрана: прокрутку сдвигаем на столько, на сколько сдвинулась сетка «таблица · графики» */
  const splitAt=()=>{const a=$('#view .split');if(!a||!a.getBoundingClientRect)return null;
    const t=a.getBoundingClientRect().top;return sc?t-sc.getBoundingClientRect().top+sc.scrollTop:t+(window.pageYOffset||0)};
  const at0=keepScroll?splitAt():null;
  /* вкладка скрытого (или несуществующего) блока — уводим на one-pager. Одна
     точка на всё: и ссылка с ?tab=tgrowth&hide=…, и отключение метрик в модалке */
  if(S.tab!=='onepager'&&!(D.BLOCK_BY_KEY[S.tab]&&D.blockVisible(S.tab,S))){S.tab='onepager';S.subTab=null}
  G.reset();
  applyNavMini();renderHead();renderNav();writeURL();
  if(G.lazy)G.lazy(true);
  try{
    $('#view').innerHTML = S.tab==='onepager'
      ? SC.onepager.render(S,openRows)
      /*split:*/: D.partsWait(S.tab).length ? partWaitView(S.tab)/*:split*/
      : SC.renderBlock(S,expanded,mixOpen,{tq,split:{mode:splitUnit===S.unit?splitMode:null,share:splitShare}});
  }finally{if(G.lazy)G.lazy(false)}
  tidyText($('#view'));tidyText($('#chips'));
  /* true — проиграть анимацию появления графиков */
  G.remeasure($('#view'),!quiet);
  /* после смены вкладки или главы (S.subTab подставляется при сборке) */
  const sameView=view===lastView||(S.tab+'|'+(S.subTab||''))===lastView;
  if(keepScroll)INNER_SCROLL.forEach((q,i)=>{
    const el=$(q), v=inner[i];
    if(!el||!v)return;
    if(q!=='.split-l .tbl-wrap'&&!sameView)return;
    el.scrollTop=v[0];el.scrollLeft=v[1];
  });
  lastView=S.tab+'|'+(S.subTab||'');
  stickTotals();
  renderMascot();
  enhanceA11y();navOpen(false);
  let yy=y;
  if(keepScroll&&sameView&&at0!=null&&at0<y+(sc?sc.clientHeight:window.innerHeight)/2){const at1=splitAt();if(at1!=null)yy+=at1-at0}
  if(sc){if(keepScroll)sc.scrollTop=yy;else if(sc.scrollTo)sc.scrollTo({top:0,behavior:'smooth'})}
  else if(keepScroll)window.scrollTo(0,yy);
  else window.scrollTo({top:0,behavior:'smooth'});
  spyBlocks();navFree();
  if(STORE){STORE.S=S;STORE.ui={tq,splitMode,splitUnit,splitShare}}
}

/* Крест в матрицах (итерация 32, фидбэк 12.10): строку подсвечивает CSS
   по :hover, столбец — этот обработчик классом x-col. Индекс — по cellIndex;
   строки-разделы с colspan (группы тепловой таблицы) пропускаем. */
function crossCol(td,on){
  const tb=td&&td.closest&&td.closest('.mxtable');
  if(!tb)return;
  $$('.mxtable .x-col').forEach(x=>x.classList.remove('x-col'));
  if(!on||td.cellIndex<1)return;
  const i=td.cellIndex, n=td.parentNode.cells.length;
  [].forEach.call(tb.rows,r=>{if(r.cells.length===n&&r.cells[i])r.cells[i].classList.add('x-col')});
}
on(document,'mouseover',e=>{const td=e.target.closest&&e.target.closest('.mxtable td');if(td)crossCol(td,true)});
/* Связка «пункт ↔ график» в раскрытой строке One-pager (13.10, сверх HRBP
   HUB): наведение на пункт «Что видно» подсвечивает его номерную отметку и
   месяцы на полотне; наведение на месяц полотна или на отметку — пункты,
   которые о нём говорят. Только классы, без перерисовки: на ресайзе полотно
   пересобирается и подсветка просто сбрасывается. */
function opClear(box){
  box.classList.remove('lk');
  [].forEach.call(box.querySelectorAll('.lit'),x=>x.classList.remove('lit'));
}
function opLit(box,mis,lis){
  opClear(box);
  const mks=lis.map(x=>x.getAttribute('data-mk')).filter(Boolean);
  if(!mis.length&&!mks.length)return;
  box.classList.add('lk');
  mis.forEach(i=>[].forEach.call(box.querySelectorAll('.mkb[data-mi="'+i+'"]'),x=>x.classList.add('lit')));
  mks.forEach(n=>[].forEach.call(box.querySelectorAll('.mk[data-mk="'+n+'"]'),x=>x.classList.add('lit')));
  lis.forEach(x=>x.classList.add('lit'));
}
const miOf=el=>(el.getAttribute('data-mi')||'').split(',').filter(Boolean);
function opHover(e,over){
  const t=e.target, box=t&&t.closest&&t.closest('[data-oplink]');
  if(!box)return;
  if(!over){if(!(e.relatedTarget&&box.contains(e.relatedTarget)))opClear(box);return}
  const li=t.closest('.op-ins li');
  if(li){opLit(box,miOf(li),[li]);return}
  const col=t.closest('.op-stc [data-mi]');
  if(col){
    const i=col.getAttribute('data-mi');
    opLit(box,[i],[].filter.call(box.querySelectorAll('.op-ins li'),x=>miOf(x).indexOf(i)>=0));
    return;
  }
  opClear(box);
}
on(document,'mouseover',e=>opHover(e,true));
on(document,'mouseout',e=>opHover(e,false));
on(document,'mouseout',e=>{const td=e.target.closest&&e.target.closest('.mxtable td');
  if(td&&!(e.relatedTarget&&td.contains(e.relatedTarget)))crossCol(td,false)});

/* Липкий ИТОГО встаёт ровно под шапку таблицы. Шапка переносится по словам
   и бывает в две-три строки, а константа 29px оставляла под ней половину
   итога — с деревом на три уровня таблица прокручивается внутри панели
   чаще, и это стало видно. Высоту шапки меряем после отрисовки и на ресайз. */
function stickTotals(){
  $$('.ptable.dense').forEach(t=>{
    const h=t.tHead?t.tHead.getBoundingClientRect().height:0;
    if(h)t.style.setProperty('--thead-h',Math.round(h)+'px');
  });
  /* 30.10: шаги главы прилипают ровно под липкую шапку карточки графиков — её высота зависит от переносов */
  $$('.split-r,.split-l').forEach(r=>{const ph=r.querySelector(':scope>.panel-h');
    if(ph)r.style.setProperty('--rph',Math.round(ph.getBoundingClientRect().height)+'px')});
  phStuck();
}
/* 31.10 (поставка 82): полоса цвета фона над липкой шапкой карточки (прячет уезжающее содержимое и держит углы)
   нужна, только когда шапка прилипла; в покое она ложилась на тень сводки над карточкой — «артефакт справа» */
let _ps=0;
function phStuck(){_ps=0;$$('.split>.panel').forEach(p=>{const ph=p.querySelector(':scope>.panel-h');
  if(ph)p.classList.toggle('ph-stuck',ph.getBoundingClientRect().top-p.getBoundingClientRect().top>1)});
  /* 31.10: подложка ряда пилюль — тоже только когда он прилип (наверху она срезала тень вывода и углов карточек) */
  $$('.sel-row').forEach(r=>{const n=r.nextElementSibling;
    r.classList.toggle('sr-stuck',!!n&&n.getBoundingClientRect().top<r.getBoundingClientRect().bottom+10)})}
on(ENV?ENV.scroller:window,'scroll',()=>{if(!_ps)_ps=requestAnimationFrame(phStuck)},{passive:true});

/* ---------- разделитель «таблица | графики» ----------
   Тянется мышью или пальцем: доля пишется в переменные сетки на лету, без
   render(), графики перемеряются под новую ширину раз в 60 мс и ещё раз —
   когда отпустили. Каждой колонке остаётся минимум 340px. */
function splitBounds(box){
  const room=box.getBoundingClientRect().width-16;
  return [Math.max(.2,340/room),Math.min(.8,1-340/room)];
}
function applySplit(box,share){
  const gut=box.querySelector('[data-split]');
  if(share==null){
    box.classList.remove('custom');
    box.style.removeProperty('--split-l');box.style.removeProperty('--split-r');
    if(gut)gut.removeAttribute('aria-valuenow');
    return;
  }
  box.classList.add('custom');
  box.style.setProperty('--split-l',(share*100).toFixed(2)+'fr');
  box.style.setProperty('--split-r',((1-share)*100).toFixed(2)+'fr');
  if(gut)gut.setAttribute('aria-valuenow',String(Math.round(share*100)));
}
function relayout(){G.remeasure($('#view'));stickTotals()}
/* к таблице подразделений и главам блока (или к таблицам метрик главной) */
function toDetails(id){const el=$(id||'#bk-det');if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'})}
let _sd=null;
on(document,'pointerdown',e=>{
  const gut=e.target.closest&&e.target.closest('[data-split]');
  if(!gut||e.button>0)return;
  const box=gut.parentNode, r=box.getBoundingClientRect(), b=splitBounds(box);
  e.preventDefault();
  try{gut.setPointerCapture(e.pointerId)}catch(_){}
  document.body.classList.add('split-drag');
  const move=ev=>{
    splitShare=Math.max(b[0],Math.min(b[1],(ev.clientX-r.left-8)/(r.width-16)));
    applySplit(box,splitShare);
    if(!_sd)_sd=setTimeout(()=>{_sd=null;relayout()},60);
  };
  const up=()=>{
    gut.removeEventListener('pointermove',move);
    gut.removeEventListener('pointerup',up);gut.removeEventListener('pointercancel',up);
    document.body.classList.remove('split-drag');
    clearTimeout(_sd);_sd=null;relayout();
  };
  gut.addEventListener('pointermove',move);
  gut.addEventListener('pointerup',up);gut.addEventListener('pointercancel',up);
});
/* двойной клик по разделителю — раскладка по умолчанию */
on(document,'dblclick',e=>{
  const gut=e.target.closest&&e.target.closest('[data-split]');
  if(!gut)return;
  splitShare=null;applySplit(gut.parentNode,null);relayout();
});

/* ---------- мини-навигация One-pager: какой блок сейчас на экране ----------
   Текущим считается последний блок, чей заголовок уже прошёл под липкую полосу. */
let _spy=0;
function spyBlocks(){
  _spy=0;
  const nav=$('.op-nav');
  if(!nav)return;
  const edge=nav.getBoundingClientRect().bottom+48;   /* с запасом на отступ прыжка */
  let cur=null;
  $$('.block-h[id^="op-"]').forEach(h=>{if(h.getBoundingClientRect().top<=edge)cur=h.id.slice(3)});
  nav.querySelectorAll('[data-jump]').forEach(b=>b.classList.toggle('on',b.dataset.jump===cur));
}
on(ENV?ENV.scroller:window,'scroll',()=>{if(!_spy)_spy=requestAnimationFrame(spyBlocks)},{passive:true});
/* 30.10: «Сводка» слева примыкает к белой шапке отчёта прямым углом; когда шапка уехала вверх, угол плавно
   скругляется (сводка круглая со всех сторон), вернулись наверх — снова смыкается с шапкой */
let _nf=0;
function navFree(){_nf=0;const nv=$('.nav'),rh=$('.reporthead');if(!nv||!rh||!ROOTEL.classList)return;
  ROOTEL.classList.toggle('nav-free',rh.getBoundingClientRect().bottom<=nv.getBoundingClientRect().top+16)}
on(ENV?ENV.scroller:window,'scroll',()=>{if(!_nf)_nf=requestAnimationFrame(navFree)},{passive:true});
/* 30.10 (запись прокрутки по кадрам): пока колёсико крутит страницу, наведение не срабатывает —
   иначе под неподвижным курсором вспыхивают столбцы и строки, которые проезжают мимо */
let _scT=0;
on(ENV?ENV.scroller:window,'scroll',()=>{document.documentElement.classList.add('is-scrolling');
  clearTimeout(_scT);_scT=setTimeout(()=>document.documentElement.classList.remove('is-scrolling'),160)},{passive:true});
/* Proteus перезапускает скрипт не только на ответ датасета, но и на ресайз и перерисовку ячейки
   (гайд, CJ-10): prelude.js ставит новый корень, и прокрутка начиналась бы сверху — 20.10, видео
   заказчика: во вкладке блока отчёт каждые пару секунд «прыгал» к выводу. Прокрутку экрана и
   панелей держим в хранилище и возвращаем на перезапуске того же вида (старт, ниже). */
const viewKey=()=>S.tab+'|'+(S.subTab||'')+'|'+S.unit;
let _sv=0;
function saveScroll(){
  _sv=0;
  if(!STORE||!ENV)return;
  STORE.scroll={k:viewKey(),y:ENV.scroller.scrollTop,
    inner:INNER_SCROLL.map(q=>{const el=$(q);return el?[el.scrollTop,el.scrollLeft]:null})};
}
if(ENV)on(ROOTEL,'scroll',()=>{if(!_sv)_sv=requestAnimationFrame(saveScroll)},{passive:true,capture:true});

/* перерисовка графиков под новую ширину окна, без пересчёта данных */
let _rz=null;
on(window,'resize',()=>{
  clearTimeout(_rz);_rz=setTimeout(()=>{if(applyNavMini())renderNav();G.remeasure($('#view'));stickTotals()},140);
});

/* ---------- события ----------
   Все слушатели висят на document, поэтому stopPropagation внутри одного
   не глушит соседей. Порядок проверок внутри обработчика важен: более
   специфичные цели проверяются раньше общих (.urow ловит всё подряд). */
on(document,'click',e=>{
  const t=e.target;

  /* Словарь Пульса закрывается кликом мимо. Проверка стоит ПЕРВОЙ и без
     return: клик мимо панели должен и её закрыть, и сработать по назначению. */
  if(pulseOpen&&!t.closest('#pulsePanel')&&!t.closest('#pulseDock'))pulse(false);
  if(t.closest('#pulseDock')){pulse(!pulseOpen);return}
  if(t.closest('#pulseClose')){pulse(false);return}
  if(t.closest('#pulseToHelp')){pulse(false);tourStart(S.tab==='onepager'?'onepager':'block');return}

  /* модалки и кнопки шапки */
  if(t.closest('#btnSetup')){openSetup();return}
  if(t.closest('#btnApply')){applySetup();return}
  if(t.closest('[data-asgo]')){viewAs($('#asQ').value);return}
  if(t.closest('[data-asoff]')){viewAs('');return}
  if(t.closest('#btnCancel')){closeSetup();return}
  /* 07.11 (замер 111 на бою: «кнопка не срабатывает»): сбрасывала только покраску и типы, а юнит оставляла — если менялся
     только юнит, нажатие ничего не меняло. Теперь и юнит — по умолчанию (тот, что открывается без фильтра юнита) */
  /* 12.11, п. 3: сброс возвращает и все галочки блока «Метрики» (вместе с графиками AI); применяется той же «Применить» */
  if(t.closest('#btnReset')&&DRAFT){DRAFT.paint='all';DRAFT.itSeg='all';DRAFT.staffType='all';DRAFT.hcType='active';DRAFT.hcSet=[];
    DRAFT.hiddenMetrics=[];
    DRAFT.unit=defUnit();UT={q:'',open:{}};$('#utQ').value='';
    paintOpts();utCenter();return}
  if(t.closest('#btnLink')){
    navigator.clipboard&&navigator.clipboard.writeText(shareLink());
    $('#btnLink').textContent='Ссылка скопирована';
    setTimeout(()=>$('#btnLink').textContent='Скопировать ссылку',1600);return;
  }
  /* 11.11: «Как читать отчёт» — интерактивный тур по текущей вкладке (был текст справки) */
  if(t.closest('#btnHelp')){tourStart(S.tab==='onepager'?'onepager':'block');return}
  if(t.id==='setupOvl'){closeSetup();return}
  /* детализация переводов (поставка 63) */
  if(t.closest('#navToggle')){navOpen(!$('#sideNav').classList.contains('open'));return}
  /* 11.11: свернуть / развернуть панель до значков — выбор запоминается; графики перемеряются под новую ширину */
  if(t.closest('#navMini')){
    setNavPref(!navMini());
    applyNavMini();renderNav();renderMascot();setTimeout(relayout,240);return}
  if(t.id==='navScrim'){navOpen(false);return}

  /* тип численности: кнопка раскрывает список, галочка — тип; раньше общей
     проверки .opt. Клик мимо открытого списка его закрывает и идёт дальше (например, «Применить») */
  if(DRAFT&&t.closest('[data-hcdd]')){HCDD=!HCDD;paintOpts();return}
  if(DRAFT&&t.closest('[data-hcall]')){
    Object.assign(DRAFT,DRAFT.hcType==='all'?{hcType:'active',hcSet:[]}:D.hcNorm(D.HC_TYPES.slice()));paintOpts();return}
  const hct=t.closest('[data-hct]');
  if(hct&&DRAFT){hcToggle(hct.dataset.hct);paintOpts();return}
  if(HCDD&&DRAFT&&!t.closest('#hcDd')){HCDD=false;const dd=$('#hcDd');if(dd)dd.classList.remove('open')}

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
  /* дерево юнита: стрелка раскрывает, строка выбирает */
  const tw=t.closest('[data-utw]');
  if(tw&&DRAFT){const p=tw.dataset.utw;UT.open[p]=tw.getAttribute('aria-expanded')!=='true';utRender();return}
  const up=t.closest('[data-upick]');
  if(up&&DRAFT){DRAFT.unit=up.dataset.upick;
    const nm=(D.PICK.info(DRAFT.unit)||{}).name;if(nm&&!D.NODE_BY_PATH[DRAFT.unit])unitNames[DRAFT.unit]=nm;
    paintOpts();return}

  /* выводы главной и блока: переход к подразделению, «подробнее ниже» */
  if(t.closest('[data-opscroll]')){toDetails('#op-all');return}
  const og=t.closest('[data-opgo]');
  if(og){
    /* поставка 128: третья часть — шаг блока («turnover||hq» — сразу «Как уходит HQ?») */
    const [bk,p,sub]=og.dataset.opgo.split('|');
    S.tab=bk;S.subTab=sub||null;S.mainMetric=null;S.selNode=p||null;openRows.clear();render();toDetails();return;
  }
  if(t.closest('[data-blkjump]')){toDetails();return}
  const ws=t.closest('[data-wsel]');
  if(ws){S.selNode=ws.dataset.wsel;render(true);toDetails();return}

  /* навигация по разделам */
  const tab=t.closest('[data-tab]');
  /* 27.10-в, п. 21: выбранное слева подразделение остаётся выбранным на всех вкладках — KPI каждой вкладки по нему */
  if(tab){S.tab=tab.dataset.tab;S.subTab=null;S.mainMetric=null;openRows.clear();render();return}
  const sub=t.closest('[data-subtab]');
  if(sub){S.subTab=sub.dataset.subtab;render(true);return}
  /* масштаб динамики один на все детальные вкладки: переключили на «год к
     году» в текучести — в мониторинге тоже год, иначе соседние экраны
     оказались бы в разных календарях */
  const jp=t.closest('[data-jump]');
  if(jp){const el=$('#op-'+jp.dataset.jump);
    if(el)el.scrollIntoView({behavior:'smooth',block:'start'});return}
  /* путь и «↑ Уровнем выше» — переход, как «Открыть юнит»: со стеком «Назад» */
  const cr=t.closest('[data-crumb]');
  if(cr){goUnit(cr.dataset.crumb);return}
  if(t.closest('[data-uback]')){const p=unitBack.pop();if(p)goUnit(p,true);return}
  const un=t.closest('[data-unchip]');
  if(un){
    /* снятый фильтр — к умолчанию: у типа численности это «Активная», у остальных — «все» */
    const dv=un.dataset.unchip==='hcType'?'active':'all', ex=un.dataset.unchip==='hcType'?{hcSet:[]}:{};
    if(ENV){request(Object.assign(curReq(),{[un.dataset.unchip]:dv},ex));return}
    S[un.dataset.unchip]=dv;Object.assign(S,ex);render();return;
  }

  /* дерево подразделений.
     Каретка ИТОГО ходит первой: одна кнопка на всё дерево, а не на свою строку.
     data-expall=1 — раскрыть всё, 0 — свернуть; в какую сторону, решает разметка,
     она же и рисует каретку в нужную сторону. */
  const exAll=t.closest('[data-expall]');
  if(exAll){
    e.stopPropagation();
    expanded.clear();
    if(exAll.dataset.expall==='1')SC.expandableRows(SC.currentRoot(S)).forEach(p=>expanded.add(p));
    render(true,true);return;
  }
  const ex=t.closest('[data-exp]');
  if(ex){e.stopPropagation();const p=ex.dataset.exp;expanded.has(p)?expanded.delete(p):expanded.add(p);render(true,true);return}
  /* «во всю ширину» и полоса свёрнутой панели — один обработчик: режим едет в атрибуте */
  const smode=t.closest('[data-splitmode]');
  if(smode){splitMode=smode.dataset.splitmode;splitUnit=S.unit;render(true);return}
  /* «Открыть юнит» живёт ВНУТРИ строки .urow — проверка строго до неё, иначе
     клик по иконке снимал бы выбор строки вместо перехода */
  const ou=t.closest('[data-openunit]');
  if(ou){e.stopPropagation();goUnit(ou.dataset.openunit);return}
  /* поле поиска стоит в шапке панели — клик в него ничего не выбирает */
  if(t.closest('.tsearch'))return;

  /* Срез состава — СТРОГО до .urow: строка разбивки и есть .urow, и общий
     обработчик выбора подразделения перехватил бы её первым. */
  if(t.closest('[data-mixclear]')){S.mixSel=[];render(true);return}
  if(t.closest('[data-selclear]')){S.mixSel=[];S.selNode=null;S.offSeg=null;S.offCity=null;S.aiSel=[];render(true);return}
  /* поставка 113-б: AI «Кто пользуется» — кросс-фильтр по строкам разрезов; повторный клик снимает */
  if(t.closest('[data-aiclear]')){S.aiSel=[];render(true);return}
  const ais=t.closest('[data-aisel]');
  if(ais){const v=ais.dataset.aisel, a=(S.aiSel||[]).slice(), i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);S.aiSel=a;render(true);return}
  /* посещаемость (22.10): сегмент и город — свой фильтр вкладки, складываются; повторный клик снимает */
  if(t.closest('[data-offclear]')){S.offSeg=null;S.offCity=null;render(true);return}
  const osg=t.closest('[data-offseg]');
  if(osg){S.offSeg=S.offSeg===osg.dataset.offseg?null:osg.dataset.offseg;render(true);return}
  const oct=t.closest('[data-offcity]');
  if(oct){S.offCity=S.offCity===oct.dataset.offcity?null:oct.dataset.offcity;render(true);return}
  if(t.closest('[data-mixswap]')){
    /* специализация — только в строках (файл «Структура») */
    if(S.mixRows==='spec'||!S.mixCols)return;
    const r=S.mixRows;S.mixRows=S.mixCols;S.mixCols=r;render(true);return;
  }
  /* мониторинг (21.10): «Месяцы / Недели», отметка периода кликом по столбику или точке
     (повторный клик снимает), сортировка таблицы подразделений по колонке */
  /* 26.10-б: переключатель инициатора у «Текучести по инициатору» */
  const ei=t.closest('[data-exitini]');
  if(ei){S.exitIni=ei.dataset.exitini;render(true);return}
  /* 27.10-в, п. 8: статус роста — его тепловая таблица на вкладке «Как растут по грейдам?» */
  const rs=t.closest('[data-rostst]');
  if(rs){S.rostSt=rs.dataset.rostst;render(true,true);return}   /* поставка 131: меняется только таблица — графики без повторной анимации */
  const tso=t.closest('[data-tsort]');
  if(tso){S.tsort=tso.dataset.tsort;render(true,true);return}
  const sps=t.closest('[data-spmsort]');
  if(sps){S.spmSort=sps.dataset.spmsort;render(true,true);return}
  /* конструктор на весь экран и обратно */
  const fs=t.closest('[data-mxfull]');
  if(fs){S.mxFull=fs.dataset.mxfull==='1';render(true);return}
  /* Shift+клик по строке стрима — все его специализации (срез по стриму); обычный клик
     по ней раскрывает стрим (обработчик каретки ниже) */
  const grp=e.shiftKey&&t.closest('[data-mixgrp]');
  if(grp){e.stopPropagation();toggleMix(grp.dataset.mixgrp,true);render(true);return}
  /* Общая каретка двухуровневой разбивки: раскрыть или свернуть ВСЕ стримы.
     Идёт первой из кареток — она стоит в строке ИТОГО, у которой своих
     обработчиков нет, но правило «от частного к общему» держим и здесь. */
  const bxa=t.closest('[data-btexpall]');
  if(bxa){
    e.stopPropagation();
    const [dim,on]=bxa.dataset.btexpall.split('|');
    [...mixOpen].forEach(k=>{if(k.indexOf(dim+':')===0)mixOpen.delete(k)});
    /* «exitinit» — инициаторы увольнения (14.10), остальное — разрезы состава */
    const keys=dim==='exitinit'?D.EXIT_INITIATORS.map(x=>'exitinit:'+x.key)
      :((D.MIX_BY_KEY[dim]||{}).cats||[]).map(c=>c.id);
    if(on==='1')keys.forEach(k=>mixOpen.add(k));
    render(true,true);return;
  }
  /* каретка стрима — раньше среза: она стоит ВНУТРИ строки, у которой есть
     data-mix, и общий обработчик среза перехватил бы клик по ней */
  const bx=t.closest('[data-btexp]');
  if(bx){
    e.stopPropagation();
    const k=bx.dataset.btexp;
    mixOpen.has(k)?mixOpen.delete(k):mixOpen.add(k);
    render(true,true);return;   /* 09.11, поставка 130: графики те же — без повторной анимации */
  }
  const mx=t.closest('[data-mix]');
  if(mx){e.stopPropagation();toggleMix(mx.dataset.mix,e.shiftKey);render(true);return}

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
    /* 12.11: у AI строки One-pager — его графики (ключи D.AI_CHARTS) */
    if(bk==='ai'){D.AI_CHARTS.forEach(x=>openRows.delete(x[0]));if(on==='1')D.aiChartsOn(S).forEach(k=>openRows.add(k))}
    render(true);return;
  }
  const mr=t.closest('.mrow');
  if(mr){const k=mr.dataset.metric;openRows.has(k)?openRows.delete(k):openRows.add(k);render(true);return}
  /* факт «Что видно в данных»: раскрыть строку его метрики и подвести к ней */
  const of=t.closest('[data-opfact]');
  if(of){
    const k=of.dataset.opfact;openRows.add(k);render(true);
    const r=ROOTEL.querySelector('.mrow[data-metric="'+k+'"]');
    if(r)r.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  /* история (итерация 32): «Где сосредоточено» и «Показать «X»» выбирают
     подразделение так же, как клик по строке сводной таблицы — графики главы
     перестраиваются по нему. Повторный клик выбор не снимает: кнопка зовёт
     показать, а не переключить. */
  const sn=t.closest('[data-selnode]');
  if(sn&&sn.dataset.selnode){S.selNode=sn.dataset.selnode;render(true);return}
  const ur=t.closest('.urow');
  if(ur&&ur.dataset.node){S.selNode=S.selNode===ur.dataset.node?null:ur.dataset.node;render(true);return}

  if(t.closest('.nav-i')&&innerWidth<=780)navOpen(false);
});
/* Поиск по таблице: перерисовка на каждую букву, без анимации графиков,
   с возвратом фокуса и каретки в поле — иначе после первой буквы ввод
   обрывался бы. */
function searchInput(v,pos){
  tq=v;
  render(true,true);
  const n=$('[data-tsearch]');
  if(n&&n.focus){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}
}
on(document,'input',e=>{
  if(e.target.id==='utQ'&&DRAFT){UT.q=e.target.value;utRender();$('#utList').scrollTop=0;return}
  const s=e.target.closest&&e.target.closest('[data-tsearch]');
  if(s)searchInput(s.value,s.selectionStart);
});
on(document,'change',e=>{
  const ax=e.target.closest&&e.target.closest('[data-mixaxis]');
  if(ax){
    const v=e.target.value;
    /* одинаковые строки и колонки выбрать можно — конструктор подскажет выбрать разные */
    if(ax.dataset.mixaxis==='rows')S.mixRows=v;
    else S.mixCols=v;
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
on(document,'mouseover',e=>lgHover(e,true));
on(document,'mouseout',e=>lgHover(e,false));
on(document,'focusin',e=>lgHover(e,true));
on(document,'focusout',e=>lgHover(e,false));
/* 12.11-д: Enter в поле «Смотреть как» — то же, что «Показать» (формы нет: песочница Proteus запрещает отправку форм) */
on(document,'keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='asQ'){e.preventDefault();viewAs(e.target.value)}});
on(document,'keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.mrow,.urow,.mx-cell')){e.preventDefault();e.target.click()}
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
  /* разделитель с клавиатуры: ← → по 5% */
  if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.target.matches&&e.target.matches('[data-split]')){
    e.preventDefault();
    const box=e.target.parentNode, b=splitBounds(box), l=box.querySelector('.split-l');
    const cur=splitShare!=null?splitShare:l.getBoundingClientRect().width/(box.getBoundingClientRect().width-16);
    splitShare=Math.max(b[0],Math.min(b[1],cur+(e.key==='ArrowRight'?.05:-.05)));
    applySplit(box,splitShare);relayout();return;
  }
  /* Escape в поле поиска сначала очищает поиск */
  if(e.key==='Escape'&&tq&&e.target.matches&&e.target.matches('[data-tsearch]')){searchInput('',0);return}
  /* Escape (файл «Структура»): сначала выход из полноэкранного конструктора, потом — сброс
     всех срезов состава; окна и меню закрываются, как раньше */
  /* тур: Esc — закрыть, ← → — шаги */
  if(TOUR){
    if(e.key==='Escape'){tourEnd();return}
    if(e.key==='ArrowRight'){tourAct('next');e.preventDefault();return}
    if(e.key==='ArrowLeft'){tourAct('back');e.preventDefault();return}
  }
  if(e.key==='Escape'){
    const ovl=!$('#setupOvl').classList.contains('hidden');
    closeSetup();navOpen(false);pulse(false);
    if(!ovl&&S.mxFull){S.mxFull=false;render(true);return}
    /* мониторинг: Escape снимает выбор строки таблицы */
    if(!ovl&&S.tab==='monitor'&&S.selNode){S.selNode=null;render(true);return}
    if(!ovl&&S.tab==='office'&&(S.offSeg||S.offCity)){S.offSeg=null;S.offCity=null;render(true);return}
    if(!ovl&&S.tab==='ai'&&S.aiSel&&S.aiSel.length){S.aiSel=[];render(true);return}
    if(!ovl&&S.mixSel&&S.mixSel.length){S.mixSel=[];render(true);return}
    /* ревью 100: подсказка «Повторный клик или Escape — снять выбор» — Escape снимает выбранное подразделение на всех вкладках */
    if(!ovl&&S.selNode){S.selNode=null;render(true)}
  }
});

/* ---------- старт ---------- */
mountStaticMascots();
/* ?tour=0 читаем ДО первого рендера: render() переписывает адрес своими
   параметрами, и после него флага в location.search уже нет — справка
   открывалась поверх скриншота, хотя её просили не показывать. */
readURL();
/* перезапуск без нового запроса (ресайз, перерисовка) — тот же вид на том же месте, без анимации */
const pend0=ENV&&arrive(), back=ENV&&(!pend0||pend0==='stale')&&STORE.scroll;
/* поставка «по частям»: части кэшируются в Proteus порознь — после обновления таблиц одна может прийти из старого кэша
   (отметка сборки данных не та, что у core). Такая часть к ответу не приклеена; просим загрузчики перезапросить этот же
   выбор мимо кэша (метка tp_nonce — как у повтора устаревшего ответа), не чаще раза в минуту на выбор */
/*split:*/
if(ENV&&window.TP_PARTS&&window.TP_PARTS.mixed&&!STORE.pending){
  const rk=echoSig(), rp=STORE.repair||(STORE.repair={});
  if(!rp[rk]||Date.now()-rp[rk]>60000){rp[rk]=Date.now();emitPend(maskOf(curReq()),true)}
}
/*:split*/
/* поставка «по частям»: тот же выбор, догрузилась часть разрезов — тот же вид на том же месте, без анимации */
let again=false;
/*split:*/again=!!(window.TP_PARTS&&window.TP_PARTS.again)&&!pend0;/*:split*/
render(!!back||again,!!back||again);
if(back&&back.k===viewKey()){
  ENV.scroller.scrollTop=back.y;
  INNER_SCROLL.forEach((q,i)=>{const el=$(q), v=back.inner&&back.inner[i];if(el&&v){el.scrollTop=v[0];el.scrollLeft=v[1]}});
  stickTotals();
}

/* ---------- Тур «Как читать отчёт» (11.11, владелец: «как в HRBP HUB — интерактивный гид, а не стена текста») ----------
   Экран затемняется, нужный элемент — в синей рамке, рядом карточка со стрелкой: что это и что будет по клику; «Назад /
   Далее», ✕, Esc, стрелки ← →. Шаг «нажми — будет» (demo): «Показать» нажимает цель тем же обработчиком, что и мышь, —
   или пользователь нажимает сам, и тур идёт дальше. lock — подсвеченное только показываем (клик не проходит). drawer —
   шаг внутри окна «Настрой свой дашборд»: тур сам открывает и закрывает окно. Цели нет (нет строк, скрытый блок) — шаг
   пропускается. Тур One-pager в конце ведёт в тур вкладки блока. Слой тура — в корне отчёта, вне #view: перерисовка
   экрана его не стирает. */
let TOUR=null, tourEl=null;
const TOUR_NAME={onepager:'One-pager',block:'Вкладка блока'};
function tourIntro(){
  const pl=(c,t)=>'<span class="tr-pl '+c+'">'+t+'</span>';
  return '<ul class="tr-ul">'+
    '<li>Числа — <b>с 1 января по '+esc(D.ASOF_LABEL||'дату данных')+'</b>, против того же периода прошлого года.</li>'+
    '<li>Цвет — оценка: '+pl('good','лучше')+pl('bad','хуже')+pl('neu','на уровне или без оценки')+'. Численность, найм и переводы не окрашиваем: больше — не значит лучше.</li>'+
    '<li>С чем сравниваем: где есть цель KPI — с ней, иначе — с подразделениями похожего размера («база») или со всей компанией с теми же фильтрами.</li>'+
    '<li>Подразделение, фильтры и метрики — в «Настрой свой дашборд». Наведите на число или ⓘ — подсказка объяснит, что это и как посчитано.</li></ul>';
}
function tourSteps(v){
  const st=[], add=o=>{if(o.need===undefined||o.need)st.push(o)};
  if(v==='onepager'){
    add({intro:true,title:'TeamPulse за минуту',html:tourIntro()});
    add({sel:'#sideNav',title:'Разделы отчёта',html:'<b>One-pager</b> — главное на одном экране, ниже — блоки метрик с подробностями. '+
      'Точка на значке — сигнал блока: красная — есть что разбирать. Кнопка сверху сворачивает панель до значков.'});
    add({sel:'#crumbs',lock:true,title:'Где вы',html:'Путь к подразделению: клик по уровню — перейти к нему, «↑ Уровнем выше» — к родителю.'});
    add({sel:'#chips',lock:true,title:'Фильтры и сравнение',html:'Применённые фильтры (× снимает фильтр), с чем сравниваем и тип численности.'});
    add({sel:'#btnSetup',demo:true,done:()=>!$('#setupOvl').classList.contains('hidden'),title:'Настрой свой дашборд',
      html:'Подразделение, фильтры и метрики — в одном окне.',hint:'Нажмите на подсвеченную кнопку или «Показать».'});
    add({sel:'#setupOvl .sc-org',drawer:true,lock:true,title:'Управленческая структура',
      html:'Дерево подразделений с поиском по названию, имени и логину руководителя. Справа — сколько людей попадёт в выбор с текущими фильтрами.'});
    add({sel:'#setupOvl .sc-flt',drawer:true,lock:true,title:'Фильтры',
      html:'Тип численности, покраска, IT, штат. Фильтры задают и вашу команду, и базу сравнения; внизу — кто получится после «Применить».'});
    add({sel:'#setupOvl .sc-met',drawer:true,lock:true,title:'Метрики',
      html:'Какие метрики показывать: наборы сверху или флажки по одной. Выключенные пропадут из One-pager, карточек и таблиц.'});
    add({sel:'#setupOvl .modal-f',drawer:true,lock:true,title:'Применить',
      html:'«Применить» пересчитывает отчёт, «Отмена» закрывает окно без изменений, «Сбросить фильтры» возвращает как по умолчанию.'});
    add({sel:'.op-h',title:'Главное на дату данных',html:'Ниже — выводы по подразделению. Как они отобраны — в ⓘ под заголовком.'});
    add({sel:'#view .in-card',title:'Карточка вывода',html:'Статус (требует действий, посмотреть, хорошая новость), главная цифра, с чем сравнили, '+
      'где это происходит и что сделать. Ссылка внизу открывает нужный блок.'});
    add({sel:'#view .in-sumrow',title:'Остальное — одной строкой',html:'Сколько метрик в норме и сколько — для справки, без оценки. Клик — список.'});
    add({sel:'#view .op-nav',title:'Блоки на странице',html:'Переход к таблице блока ниже. Цифра — сколько в блоке выводов.'});
    add({sel:'#view tr.mrow',demo:true,at:'left',done:()=>openRows.size>0,title:'Метрика',
      html:'Строка — метрика за период, изменение за месяц и год к году, 12 месяцев и ориентир. Нажмите — откроется её динамика.',
      hint:'Нажмите на подсвеченную строку или «Показать».'});
    add({sel:'#view tr.detail-row .op-stc',title:'Этот год и прошлый',html:'Синяя линия — этот год, серая — прошлый, пунктир — ориентир. '+
      'Цифры в кружках — точки из «Что видно» справа: наведите на пункт — точка подсветится.'});
    add({sel:'#view tr.detail-row .op-sts',title:'Что видно и о метрике',html:'Главное по метрике и как она считается.'});
    add({sel:'#pulseDock',last:true,next:'block',title:'Словарь метрик',html:'Все метрики текущей вкладки: что значит, как считаем, что лучше — выше или ниже.'});
  }else{
    add({sel:'#view .bk-top',title:'Вывод блока',html:'Главное по блоку одной фразой: статус, числа и что сделать.'});
    add({sel:'#view .split .panel',title:'Подразделения',html:'«Итого» — ваше подразделение, ниже — три уровня под ним (▸ раскрывает строку). '+
      'Клик по строке — графики справа покажут только её. Поиск — по названию и логину.'});
    add({sel:'#view .st-steps',title:'Вопросы блока',html:'Блок разбит на вопросы: «Сколько?», «Почему?», «Кто?». Переключайте — справа ответ на выбранный.'});
    add({sel:'#view .st-head',title:'Ответ',html:'Заголовок — главный вывод шага, ниже — числа. «Зачем смотреть» и «Что с этим делать» — как читать и что предпринять.'});
    add({sel:'#view .st-main .svgchart, #view .st-main .pf-s, #view .st-main table',title:'Графики и таблицы',
      html:'На графиках синяя линия — этот год, серая — прошлый, пунктир — цель или база. Наведите — значения месяца; клик по легенде '+
      'прячет ряд. Строки таблиц кликаются — выбор пересчитывает соседние.'});
    /* 12.11, п. 4: кнопки «Детальный дашборд» больше нет — шага о ней тоже; последний шаг — графики и таблицы */
    st[st.length-1].last=true;
  }
  return st;
}
function tourLayer(){
  if(tourEl&&tourEl.parentNode)return tourEl;
  const host=ENV&&ENV.root?ENV.root:document.body;
  tourEl=document.createElement('div');
  tourEl.className='tr-layer';
  tourEl.innerHTML=['t','b','l','r','h'].map(k=>'<div class="tr-sh" data-tb="'+k+'"></div>').join('')+
    '<div class="tr-ring"></div><div class="tr-card" role="dialog" aria-modal="true" aria-label="Как читать отчёт"></div>'+
    '<span class="tr-clk"></span><span class="tr-cur"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">'+
    '<path d="M5 2.5v16.2l4.3-4.1 2.9 6.6 2.6-1.1-2.9-6.5h6z" fill="#1f2530" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg></span>';
  host.appendChild(tourEl);
  tourEl.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-tact]');if(b)tourAct(b.getAttribute('data-tact'))});
  return tourEl;
}
const tourQ=c=>tourEl?tourEl.querySelector('.'+c):null;
function tourEls(step){
  if(!step||!step.sel)return [];
  const el=$(step.sel);
  if(!el)return [];
  const r=el.getBoundingClientRect();
  return r.width>0&&r.height>0?[el]:[];
}
function tourBox(el,l,t,w,h){el.style.left=Math.round(l)+'px';el.style.top=Math.round(t)+'px';
  el.style.width=Math.max(0,Math.round(w))+'px';el.style.height=Math.max(0,Math.round(h))+'px'}
/* карточка — со стороны, где помещается (снизу, сверху, справа, слева); стрелка смотрит в центр цели */
function tourPlace(r){
  const card=tourQ('tr-card'), arr=card&&card.querySelector('.tr-arr');
  if(!card||!arr)return;
  const W=window.innerWidth, H=window.innerHeight, m=12, g=14, cw=card.offsetWidth, ch=card.offsetHeight;
  let side='', left, top;
  if(!r){left=(W-cw)/2;top=Math.max(m,(H-ch)/2)}
  else{
    const cx=(r.l+r.r)/2, cy=(r.t+r.b)/2;
    const fits={bottom:r.b+g+ch<=H-m,top:r.t-g-ch>=m,right:r.r+g+cw<=W-m,left:r.l-g-cw>=m};
    side=['bottom','top','right','left'].find(s=>fits[s])||'';
    if(side==='bottom'){top=r.b+g;left=cx-cw/2}
    else if(side==='top'){top=r.t-g-ch;left=cx-cw/2}
    else if(side==='right'){left=r.r+g;top=cy-ch/2}
    else if(side==='left'){left=r.l-g-cw;top=cy-ch/2}
    else{left=W-cw-m;top=H-ch-m}
  }
  left=Math.max(m,Math.min(left,W-cw-m));top=Math.max(m,Math.min(top,H-ch-m));
  card.style.left=Math.round(left)+'px';card.style.top=Math.round(top)+'px';
  arr.className='tr-arr'+(side?' tr-a-'+side:'');
  if(side==='bottom'||side==='top'){arr.style.left=Math.round(Math.max(14,Math.min(cw-24,(r.l+r.r)/2-left-5)))+'px';arr.style.top=''}
  else if(side){arr.style.top=Math.round(Math.max(14,Math.min(ch-24,(r.t+r.b)/2-top-5)))+'px';arr.style.left=''}
}
/* шторки, рамка и карточка — по текущему месту цели (прокрутка, ресайз, перерисовка) */
function tourPos(){
  const t=TOUR;
  if(!t||!tourEl||tourEl.style.display!=='block')return;
  const step=tourSteps(t.view)[t.i];
  if(!step)return;
  const els=tourEls(step), W=window.innerWidth, H=window.innerHeight;
  let r=null;
  if(els.length){
    const u=els[0].getBoundingClientRect(), pd=step.pad==null?6:step.pad;
    r={l:Math.max(0,u.left-pd),t:Math.max(0,u.top-pd),r:Math.min(W,u.right+pd),b:Math.min(H,u.bottom+pd)};
    if(r.r-r.l<4||r.b-r.t<4)r=null;
  }
  const Q=k=>tourEl.querySelector('[data-tb="'+k+'"]'), ring=tourQ('tr-ring');
  if(r){
    tourBox(Q('t'),0,0,W,r.t);tourBox(Q('b'),0,r.b,W,H-r.b);tourBox(Q('l'),0,r.t,r.l,r.b-r.t);tourBox(Q('r'),r.r,r.t,W-r.r,r.b-r.t);
    tourBox(Q('h'),r.l,r.t,step.lock?r.r-r.l:0,step.lock?r.b-r.t:0);
    ring.style.display='block';tourBox(ring,r.l,r.t,r.r-r.l,r.b-r.t);
  }else{
    tourBox(Q('t'),0,0,W,H);['b','l','r','h'].forEach(k=>tourBox(Q(k),0,0,0,0));ring.style.display='none';
  }
  tourPlace(r);
}
function tourCard(list,i,step,done){
  const b=(i>0?'<button type="button" class="btn" data-tact="back">Назад</button>':'<button type="button" class="btn" data-tact="close">Закрыть</button>')+
    (step.demo&&!done?'<button type="button" class="btn" data-tact="next">Далее</button><button type="button" class="btn primary" data-tact="demo">Показать</button>'
    :step.last&&!step.next?'<button type="button" class="btn primary" data-tact="close">Готово</button>'
    :'<button type="button" class="btn primary" data-tact="'+(step.last?'nexttab':'next')+'">'+(step.intro?'Начать':step.last?'Дальше':'Далее')+'</button>');
  return '<span class="tr-arr"></span><div class="tr-ch"><span class="tr-cs">'+esc(TOUR_NAME[TOUR.view])+' · '+(i+1)+' из '+list.length+'</span>'+
    '<button type="button" class="tr-x" data-tact="close" aria-label="Закрыть тур">✕</button></div>'+
    '<div class="tr-ct">'+esc(step.title)+'</div><div class="tr-cx">'+step.html+'</div>'+
    (step.demo&&!done&&step.hint?'<div class="tr-hint">'+esc(step.hint)+'</div>':'')+
    (step.last&&step.next?'<div class="tr-hint">Дальше — тур по вкладке блока: таблица подразделений, вопросы и графики.</div>':'')+
    '<div class="tr-cf">'+b+'</div>';
}
function tourShow(){
  const t=TOUR, list=tourSteps(t.view), step=list[t.i];
  if(!step){tourEnd();return}
  /* шаги про окно настройки — с открытым окном, остальные — с закрытым */
  const open=!$('#setupOvl').classList.contains('hidden');
  if(!!step.drawer!==open){if(step.drawer)openSetup();else closeSetup()}
  const els=tourEls(step);
  if(step.sel&&!els.length){tourGo(t.i+(t.dir||1),t.dir||1);return}
  t.was=step.demo?!!step.done():false;t.busy=false;
  const L=tourLayer();
  L.style.display='block';
  tourQ('tr-cur').style.display='none';
  if(els.length){
    const r=els[0].getBoundingClientRect();
    if(r.top<60||r.bottom>window.innerHeight-60)try{els[0].scrollIntoView({block:r.height>window.innerHeight-200?'start':'center'})}catch(e){}
  }
  tourQ('tr-card').innerHTML=tourCard(list,t.i,step,t.was);
  tourPos();
  const pb=L.querySelector('.tr-cf .primary');if(pb&&pb.focus)pb.focus({preventScroll:true});
}
function tourGo(i,dir){
  const t=TOUR;if(!t)return;
  if(i>=tourSteps(t.view).length){tourEnd();return}
  if(i<0){i=0;dir=1}
  t.i=i;t.dir=dir;tourShow();
}
function tourStart(view){
  pulse(false);
  TOUR={view:view,i:0,dir:1,was:false,busy:false};
  tourShow();
}
function tourEnd(){
  TOUR=null;
  if(tourEl)tourEl.style.display='none';
  closeSetup();
}
/* после клика и перерисовки: шаг «нажми — будет» сделан — следующий; иначе подсветка — по новому месту цели */
function tourSync(){
  const t=TOUR;if(!t)return;
  const step=tourSteps(t.view)[t.i];
  if(step&&step.demo&&!t.was&&!t.busy&&step.done()){tourGo(t.i+1,1);return}
  tourPos();
}
/* «Показать»: курсор едет от кнопки к цели и «нажимает» — клик идёт по-настоящему */
function tourDemo(){
  const t=TOUR;if(!t||t.busy)return;
  const step=tourSteps(t.view)[t.i], els=tourEls(step);
  if(!els.length)return;
  const r=els[0].getBoundingClientRect(), cur=tourQ('tr-cur'), clk=tourQ('tr-clk');
  const x=step.at==='left'?r.left+Math.min(140,r.width/3):r.left+r.width/2, y=r.top+r.height/2;
  const fire=()=>{t.busy=false;cur.style.display='none';if(TOUR!==t)return;const now=tourEls(step);if(now.length&&!step.done())now[0].click();setTimeout(tourSync,80)};
  let still=false;try{still=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
  if(still||!cur.animate){fire();return}
  t.busy=true;
  const btn=tourEl.querySelector('[data-tact="demo"]'), br=btn?btn.getBoundingClientRect():{left:x,top:y+90,width:0,height:0};
  cur.style.transition='none';cur.style.left=Math.round(br.left+br.width/2)+'px';cur.style.top=Math.round(br.top+br.height/2)+'px';
  cur.style.display='block';cur.getBoundingClientRect();cur.style.transition='';
  cur.style.left=Math.round(x-5)+'px';cur.style.top=Math.round(y-2.5)+'px';
  setTimeout(()=>{
    clk.style.left=Math.round(x)+'px';clk.style.top=Math.round(y)+'px';
    clk.animate([{opacity:.9,transform:'scale(.35)'},{opacity:0,transform:'scale(1.5)'}],{duration:450,easing:'ease-out'});
    setTimeout(fire,220);
  },700);
}
function tourAct(a){
  if(!TOUR)return;
  if(a==='next')tourGo(TOUR.i+1,1);
  else if(a==='back')tourGo(TOUR.i-1,-1);
  else if(a==='demo')tourDemo();
  else if(a==='close')tourEnd();
  else if(a==='nexttab'){
    /* тур вкладки блока — на первом видимом блоке, если сейчас One-pager */
    if(S.tab==='onepager'){const b=D.visibleBlocks(S)[0];if(b){S.tab=b.key;S.subTab=null;render()}}
    TOUR={view:'block',i:0,dir:1,was:false,busy:false};tourShow();
  }
}
on(window,'resize',()=>{if(TOUR)tourPos()});
on(ROOTEL,'scroll',()=>{if(TOUR)tourPos()},{passive:true,capture:true});
on(document,'click',()=>{if(TOUR)setTimeout(tourSync,60)});
/* показа «при первом входе» нет (как в HRBP HUB: Proteus не помнит первый вход) — тур только кнопкой «Как читать отчёт» */

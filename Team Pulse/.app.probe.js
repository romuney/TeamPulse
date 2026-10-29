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
  if(!D.NODE_BY_PATH[S.unit])S.unit=D.DEFAULT_STATE.unit;
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
function curReq(){return {unit:S.unit,paint:S.paint,itSeg:S.itSeg,staffType:S.staffType,hcType:S.hcType,hcSet:(S.hcSet||[]).slice()}}
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
  return [id===D.REAL.defId?'':id,c.has('paint')?st.paint:'all',c.has('it')?st.itSeg:'all',
    c.has('staff')?st.staffType:'all',c.has('act')?hcSig(st):'all'].join('|');
}
function echoSig(){
  const a=D.REAL.applied;
  return [D.REAL.req[0]||'',a.paint,a.itSeg,a.staffType,D.REAL.cuts.has('act')?hcSig(a):'all'].join('|');
}
function emitPend(mask,nonce){
  return ENV.emit(nonce?mask.concat([{column:'tp_nonce',operator:'IN',value:[String(Date.now())]}]):mask);
}
let _pendT=null, _staleT=null;
/* маска кросс-фильтров запроса (вынесена из request в поставке 63: ею же пользуется детализация переводов) */
function maskOf(next){
  const id=unitId(next.unit), mask=[];
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
      STORE.pending=null;ROOTEL.classList.remove('tp-busy');
      STORE.warn='Ответ не пришёл за 45 секунд. Проверьте кросс-фильтры чарта в настройках дашборда.';
      renderHead();
    },Math.max(1000,45000-(Date.now()-pend.at)));
  }else if(pend){
    STORE.pending=null;clearTimeout(_pendT);clearTimeout(_staleT);
    /* новый запрос (юнит, фильтры) — экран начинается сверху: прежнюю прокрутку забываем */
    STORE.scroll=null;
    ROOTEL.classList.remove('tp-busy');
    STORE.warn=pend.unit!==S.unit&&D.REAL.scopeId!==unitId(pend.unit)
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
  const ph=$('#planHost');
  if(ph)ph.innerHTML=U.planTable(D.DEV_PLAN);
  return pend?(STORE.pending?'stale':true):false;
}
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
  h+='<span class="chip pilot"'+U.tipAttr({title:'Пробник на настоящих данных',
    text:'Настоящие цифры:',
    list:['численность, найм, отток, переводы','текучесть, нежелательная и желательная','посещаемость офиса и T-рост — если данные уже пришли'],
    note:'С полосатой меткой «в разработке» — условные цифры. Данные по '+(D.PARTIAL?D.ASOF_LABEL:D.CMP.cur)+' включительно: текущий месяц ещё не закрыт.'})+
    /* 30.10, шаг 1: служебная метка — коротко, подробности в подсказке */
    '><span class="pl-t">О данных</span></span>';
  return h;
}

/* ---------- шапка и навигация ---------- */
function renderHead(){
  /* поставка 69: выше зоны доступа — нельзя: предок корня зоны (anc) не кнопка и не «Уровнем выше» */
  const n=D.NODE_BY_PATH[S.unit], par0=D.NODE_BY_PATH[n.parent], par=par0&&!par0.anc?par0:null;
  const pp=unitBack[unitBack.length-1];
  const prev=D.NODE_BY_PATH[pp]||(pp&&unitNames[pp]?{name:unitNames[pp]}:null);
  /* «← Назад» и «↑ Уровнем выше» стоят перед путём: путь отвечает «где я»,
     кнопки — «как вернуться». Предки в пути кликабельны, как и раньше. */
  const nav=(prev?'<button class="nb" data-uback="1"'+U.tipAttr({title:'Назад',
      text:'Вернуться к «'+prev.name+'».'})+'>← Назад</button>':'')+
    (par?'<button class="nb" data-crumb="'+par.path+'"'+U.tipAttr({title:'Уровнем выше',
      text:'Перейти к «'+par.name+'».'})+'>↑ Уровнем выше</button>':'');
  $('#crumbs').innerHTML=(nav?'<span class="nbs">'+nav+'</span>':'')+D.ancestorsOf(S.unit).map((a,i,arr)=>
    i===arr.length-1
      ? '<span>'+esc(a.name)+'</span>'
      : (a.anc?'<span>'+esc(a.name)+'</span>':'<button data-crumb="'+a.path+'">'+esc(a.name)+'</button>')+'<span class="sep">/</span>'
  ).join('');
  $('#unitTitle').innerHTML=esc(n.name)+'<span class="lvl">'+esc(D.levelLabel(n.level))+'</span>';
  /* Нет разрезов — нет и плашки «Разрезы не выбраны»: пустое состояние занимало
     строку и притягивало взгляд, ничего при этом не сообщая. Остаются только
     чипы базы сравнения, они есть всегда. */
  const chips=D.filterChips(S);
  let html=chips.map(c=>'<span class="chip">'+esc(c.label)+'<button class="x" data-unchip="'+c.k+'"'+
    U.tipAttr({title:'Снять фильтр',text:c.label})+'>×</button></span>').join('');
  html+='<span class="chip bench"'+U.tipAttr({title:'База сравнения',text:'С этим сравниваются все метрики отчёта: та же метрика по всей компании с вашими фильтрами.'})+
    '>База: <b>'+esc(D.benchmarkLabel(S))+'</b></span>';
  /* тип численности по умолчанию — чипом без крестика: отчёт на «Активной», и это видно */
  if(S.hcType==='active'&&(!ENV||D.REAL.cuts.has('act')))html+='<span class="chip bench"'+
    U.tipAttr({title:'Тип численности: '+D.HC_DEF.join(', '),text:'Весь отчёт — по типу численности «'+D.HC_DEF.join('», «')+
      '». Подрядчики и другие типы — «Настрой свой дашборд» → «Тип численности».'})+
    '>Тип численности: <b>'+esc(D.HC_DEF.join(', '))+'</b></span>';
  /* после перехода в отдел команд в отборе бывает одна — «1 команд» не пишем */
  const nT=D.unitsInScope(S);
  html+='<span class="chip bench">'+D.fmtInt(nT)+' '+U.plural(nT,D.UNIT_WORDS)+(ENV?' в таблице':' в отчёте')+'</span>';
  /* Период — чипом рядом с базой, а не отдельной плашкой справа: плашка
     повторяла свежесть данных в шапке и забирала место у кнопок. Здесь он
     остаётся и в печатной версии, где шапка приложения скрыта. */
  html+='<span class="chip bench">Период: <b>'+esc(D.PARTIAL?D.PERIOD_LABEL.split(' — ')[0]+' — '+D.ASOF_LABEL:D.PERIOD_LABEL)+'</b></span>';
  if(ENV)html+=pilotChips();
  $('#chips').innerHTML=html;
  const fr=$('#freshness');
  /* 20.10: последний месяц — текущий, данные по дату данных; закрыт — как раньше */
  if(fr)fr.innerHTML='<span class="dot"></span>'+(D.PARTIAL?'данные на <b>'+esc(D.ASOF_LABEL)+'</b>':'закрытый месяц <b>'+esc(D.CMP.cur)+'</b>');
}
/* 30.10, шаг 1 (критики: «красные точки у 5 из 8 пунктов — ощущение пожара»): красная точка — только у блока, вывод
   которого «Требует действий»; остальные — серые. Тот же источник, что у вывода блока, — точка и вывод не спорят */
function navSig(bk){
  const I=window.TPINSIGHTS;
  if(!I||!I.blockSummary)return D.blockSignal(bk,S).state==='bad'?'bad':'neutral';
  try{return I.blockSummary(bk,S,D.reportLeaves(S),D.benchmarkLeaves(S)).sev==='high'?'bad':'neutral'}catch(e){return 'neutral'}
}
function renderNav(){
  /* блок, у которого пользователь отключил все метрики, из навигации уходит */
  $('#navBlocks').innerHTML=D.visibleBlocks(S).map(b=>
    /* точка у пункта — худший сигнал блока, тем же цветом, что в мини-навигации
       One-pager: в какой блок идти, видно с любой вкладки */
    '<button class="nav-i'+(S.tab===b.key?' active':'')+'" data-tab="'+b.key+'"><span class="ico sig-'+navSig(b.key)+'"></span>'+esc(b.name)+
      navDev(b.key)+'</button>').join('');
  $$('.nav-i[data-tab="onepager"]').forEach(b=>b.classList.toggle('active',S.tab==='onepager'));
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
  const htp=$('#helpTopPulse');
  if(htp)htp.innerHTML=M.img('point',54);
  /* В справке огонёк остаётся только в шапке модалки: в разводке внизу
     он был вторым портретом в одном окне и отвлекал от текста правила. */
  const hp=$('#helpPulse');
  if(hp)hp.innerHTML=
    '<span>Здесь — как читать весь отчёт. Что значит конкретная метрика, подскажет <b>Пульс</b> внизу слева.</span>';
}

/* ---------- модалка настройки ---------- */
function openSetup(){
  DRAFT={unit:S.unit,paint:S.paint,itSeg:S.itSeg,staffType:S.staffType,hcType:S.hcType,hcSet:(S.hcSet||[]).slice(),
    hiddenMetrics:(S.hiddenMetrics||[]).slice()};
  HCDD=false;
  UT={q:'',open:{}};
  $('#utQ').value='';
  paintOpts();
  $('#setupOvl').classList.remove('hidden');
  utCenter();
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
/* руководитель под именем юнита: «Имя Фамилия · логин»; что совпало с поиском — подсвечено (поставка 66) */
function utHead(i,q){
  const hn=i.hname||'', hl=i.head||'';
  if(!hn&&!hl)return '';
  return '<span class="ut-h"'+U.tipAttr({title:'Руководитель подразделения',text:hn&&hl?hn+' · '+hl:hn||hl})+'>'+
    (hn?utHl(hn,q):'')+(hn&&hl?' · ':'')+(hl?utHl(hl,q):'')+'</span>';
}
function utRow(p,i,depth,tw,extra){
  return '<div class="ut-r'+(DRAFT.unit===p?' cur':'')+'" data-upick="'+esc(p)+'" role="option" aria-selected="'+(DRAFT.unit===p)+'"'+
    (depth!=null?' style="padding-left:'+(9+depth*16)+'px"':'')+'>'+tw+
    '<span class="ut-n">'+(extra&&extra.name||esc(i.name))+(extra&&extra.path?'<span class="ut-p">'+esc(extra.path)+'</span>':'')+
    utHead(i,extra&&extra.q||'')+'</span>'+
    '<span class="ut-l">ур. '+i.lvl+'</span>'+utCount(p)+'</div>';
}
function utListHTML(){
  const q=UT.q.trim().toLowerCase(), P=D.PICK, root=P.info(P.root), lvl0=root?root.lvl:1;
  if(!q){
    const out={s:'',n:0};
    const walk=(p,depth)=>{
      const i=P.info(p);
      if(!i||out.n>=UT_MAX)return;
      out.n++;
      const kids=i.kids?P.kids(p):[], open=kids.length&&utOpen(p,lvl0);
      out.s+=utRow(p,i,depth,kids.length?'<button class="ut-tw" data-utw="'+esc(p)+'" aria-expanded="'+!!open+'">'+(open?'▾':'▸')+'</button>':'<span class="ut-sp"></span>');
      if(open)kids.map(k=>[k,P.info(k)]).filter(x=>x[1]).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ru'))
        .forEach(x=>walk(x[0],depth+1));
    };
    /* поставка 69: окно начинается с корней зоны доступа (у полного доступа — корень компании) */
    (P.roots||[P.root]).forEach(r=>walk(r,0));
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
    for(let k=Math.max(1,chain.length-4);k<chain.length;k++){const x=P.info(chain.slice(0,k).join('/'));if(x)names.push(x.name)}
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
  $('#benchPreview').innerHTML=(tn!=null?'После «Применить» — ваша команда: <b>':'Ваша команда: <b>')+esc(nm)+'</b>, '+
    D.fmtVal('hc_total',tn!=null?tn:D.lastVal(rl,'hc_total'))+' чел.<br>База сравнения: <b>'+
    esc(D.benchmarkLabel(d))+'</b>, '+D.fmtVal('hc_total',bn!=null?bn:D.lastVal(bl,'hc_total'))+' чел.';
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
    return '<div class="mpick-g"><div class="mpick-h">'+esc(b.name)+'</div>'+
      '<div class="mpick-l">'+items+'</div></div>';
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
    const next={unit:DRAFT.unit,paint:DRAFT.paint,itSeg:DRAFT.itSeg,staffType:DRAFT.staffType,hcType:DRAFT.hcType,
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
let lastView='';
function render(keepScroll,quiet){
  D.setHcMode(S.hcType);                 /* макет: ряды по типу численности (в пробнике — датасет) */
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
  renderHead();renderNav();writeURL();
  $('#view').innerHTML = S.tab==='onepager'
    ? SC.onepager.render(S,openRows)
    : SC.renderBlock(S,expanded,mixOpen,{tq,split:{mode:splitUnit===S.unit?splitMode:null,share:splitShare}});
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
  spyBlocks();requestAnimationFrame(navFree);
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
  $$('.split-r').forEach(r=>{const ph=r.querySelector(':scope>.panel-h');
    if(ph)r.style.setProperty('--rph',Math.round(ph.getBoundingClientRect().height)+'px')});
}

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
function navFree(){_nf=0;const nv=$('.nav'),rh=$('.reporthead');if(!nv||!rh)return;
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
  clearTimeout(_rz);_rz=setTimeout(()=>{G.remeasure($('#view'));stickTotals()},140);
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
  if(t.closest('#pulseToHelp')){pulse(false);$('#helpOvl').classList.remove('hidden');return}

  /* модалки и кнопки шапки */
  if(t.closest('#btnSetup')){openSetup();return}
  if(t.closest('#btnApply')){applySetup();return}
  if(t.closest('#btnCancel')){closeSetup();return}
  if(t.closest('#btnReset')&&DRAFT){DRAFT.paint='all';DRAFT.itSeg='all';DRAFT.staffType='all';DRAFT.hcType='active';DRAFT.hcSet=[];
    paintOpts();return}
  if(t.closest('#btnLink')){
    navigator.clipboard&&navigator.clipboard.writeText(shareLink());
    $('#btnLink').textContent='Ссылка скопирована';
    setTimeout(()=>$('#btnLink').textContent='Скопировать ссылку',1600);return;
  }
  if(t.closest('#btnHelp')){$('#helpOvl').classList.remove('hidden');return}
  if(t.closest('#btnHelpClose')){$('#helpOvl').classList.add('hidden');return}
  if(t.id==='setupOvl'){closeSetup();return}
  /* детализация переводов (поставка 63) */
  if(t.id==='helpOvl'){$('#helpOvl').classList.add('hidden');return}
  if(t.closest('#navToggle')){navOpen(!$('#sideNav').classList.contains('open'));return}
  if(t.id==='navScrim'){navOpen(false);return}

  /* тип численности: кнопка раскрывает список, галочка — тип; раньше общей
     проверки .opt. Клик мимо открытого списка его закрывает и идёт дальше (например, «Применить») */
  if(DRAFT&&t.closest('[data-hcdd]')){HCDD=!HCDD;paintOpts();return}
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
    const [bk,p]=og.dataset.opgo.split('|');
    S.tab=bk;S.subTab=null;S.mainMetric=null;S.selNode=p;openRows.clear();render();toDetails();return;
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
    render(true);return;
  }
  const ex=t.closest('[data-exp]');
  if(ex){e.stopPropagation();const p=ex.dataset.exp;expanded.has(p)?expanded.delete(p):expanded.add(p);render(true);return}
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
  if(rs){S.rostSt=rs.dataset.rostst;render(true);return}
  const gr=t.closest('[data-mongran]');
  if(gr){S.monGran=gr.dataset.mongran;S.monMark=null;render(true);return}
  const pm=t.closest('[data-pmark]');
  if(pm){e.stopPropagation();const i=+pm.dataset.pmark;S.monMark=S.monMark===i?null:i;render(true);return}
  const tso=t.closest('[data-tsort]');
  if(tso){S.tsort=tso.dataset.tsort;render(true);return}
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
  if(e.key==='Escape'){
    const ovl=!$('#setupOvl').classList.contains('hidden')||!$('#helpOvl').classList.contains('hidden');
    closeSetup();$('#helpOvl').classList.add('hidden');navOpen(false);pulse(false);
    if(!ovl&&S.mxFull){S.mxFull=false;render(true);return}
    /* мониторинг: Escape снимает отметку периода и выбор строки таблицы */
    if(!ovl&&S.tab==='monitor'&&(S.monMark!=null||S.selNode)){S.monMark=null;S.selNode=null;render(true);return}
    if(!ovl&&S.tab==='office'&&(S.offSeg||S.offCity)){S.offSeg=null;S.offCity=null;render(true);return}
    if(!ovl&&S.mixSel&&S.mixSel.length){S.mixSel=[];render(true)}
  }
});

/* ---------- старт ---------- */
mountStaticMascots();
/* ?tour=0 читаем ДО первого рендера: render() переписывает адрес своими
   параметрами, и после него флага в location.search уже нет — справка
   открывалась поверх скриншота, хотя её просили не показывать. */
const noTour=ENV?true:location.search.indexOf('tour=0')>=0;
readURL();
/* перезапуск без нового запроса (ресайз, перерисовка) — тот же вид на том же месте, без анимации */
const pend0=ENV&&arrive(), back=ENV&&(!pend0||pend0==='stale')&&STORE.scroll;
render(!!back,!!back);
if(back&&back.k===viewKey()){
  ENV.scroller.scrollTop=back.y;
  INNER_SCROLL.forEach((q,i)=>{const el=$(q), v=back.inner&&back.inner[i];if(el&&v){el.scrollTop=v[0];el.scrollLeft=v[1]}});
  stickTotals();
}

/* первый вход: справка «Как читать отчёт» работает онбордингом.
   ?tour=0 — не показывать: нужно, чтобы скриншот сразу показывал отчёт. */
try{
  if(!localStorage.getItem('tp_onboarded')&&!noTour){
    $('#helpOvl').classList.remove('hidden');
    $('#btnHelpClose').addEventListener('click',()=>localStorage.setItem('tp_onboarded','1'),{once:true});
  }
}catch(e){}

module.exports={go:(t,sub)=>{S.tab=t;S.subTab=sub||null;S.selNode=null;render();return $("#view").innerHTML},
  top:t=>{S.tab=t;S.subTab=null;S.selNode=null;render();return $("#view").innerHTML},
  home0:()=>{S.tab="onepager";S.aiOpen=null;render();return $("#view").innerHTML},
  op:list=>{S.tab="onepager";openRows.clear();(list||[]).forEach(k=>openRows.add(k));render();return $("#view").innerHTML},
  hide:list=>{S.hiddenMetrics=list.slice();S.mainMetric=null},
  expAll:()=>{expanded.clear();SC.expandableRows(SC.currentRoot(S)).forEach(p=>expanded.add(p));render(true);return $("#view").innerHTML},
  expClear:()=>{expanded.clear()},
  sel:p=>{S.selNode=p;render(true);return $("#view").innerHTML},
  unit:p=>{goUnit(p);return S.unit},
  back:()=>{const p=unitBack.pop();if(p)goUnit(p,true);return S.unit},
  stack:()=>unitBack.slice(),
  search:q=>{tq=q;render(true,true);return $("#view").innerHTML},
  crumbs:()=>{renderHead();return $("#crumbs").innerHTML},
  setupHc:()=>{openSetup();const h=$("#optHc").innerHTML+$("#benchPreview").innerHTML;closeSetup();return h},
  hcPick:list=>{openSetup();list.forEach(hcToggle);paintOpts();const r=hcSig(DRAFT)+"#"+$("#optHc").innerHTML;closeSetup();return r},
  setupUnits:q=>{openSetup();if(q){UT.q=q;utRender()}const h=$("#utList").innerHTML+$("#benchPreview").innerHTML+$("#optStaff").innerHTML;closeSetup();return h},
  home:()=>{S.unit=D.DEFAULT_STATE.unit;unitBack.length=0;tq="";S.selNode=null;expanded.clear()},
  split:(m,sh)=>{splitMode=m;splitUnit=S.unit;splitShare=sh;render(true);return $("#view").innerHTML},
  mix:list=>{S.mixSel=(list||[]).slice()},
  mixClick:spec=>{toggleMix(spec);return S.mixSel.slice()},
  mixOpen:list=>{mixOpen.clear();(list||[]).forEach(k=>mixOpen.add(k));render();return $("#view").innerHTML},
  link:()=>shareLink(),
  tab:()=>S.tab, nav:()=>$("#navBlocks").innerHTML, st:()=>S,
  chips:()=>{renderHead();return $("#chips").innerHTML}};
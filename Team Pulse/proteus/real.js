/* ============================================================================
   proteus/real.js — модель пробника из ответа датасета teampulse_hub.
   Неймспейс: window.TPREAL. В чарте Proteus загружается ПЕРЕД data.js:
   prelude.js кладёт результат build(data) в window.TP_REAL, и data.js берёт
   оттуда календарь, дерево юнитов и ряды метрик, у которых есть источник.
   Без TP_REAL макет работает как раньше, на генераторе.

   Что важно про данные (SOURCES.md §18): цифры юнита в hr_structure_overall
   уже включают всё его поддерево. Поэтому:
   - ряд юнита — его собственная строка ответа, а не сумма детей;
   - люди прямо в юните — отдельный «лист» «Напрямую в «X»» = юнит минус его
     прямые подразделения из ответа. Сумма листьев под юнитом ровно равна
     юниту, и вся агрегация макета (сумма листьев, потом деление) остаётся
     верной без единой правки;
   - юнит третьего уровня вниз — лист целиком; у него kids — сколько своих
     подразделений («ниже ещё N»).
   База сравнения — отдельный лист 'BASE': строка base ответа (вся компания
   под теми же фильтрами).

   Схема таблицы 15.10.2026 (разведка 3): perf_* — мониторинг (нормал, недоработка,
   переработка, Gray), mx — разрезы юнита: состав последнего месяца по атрибутам
   человека и увольнения с начала года по причине, инициативе, опыту, грейду,
   стриму. Разрез «Напрямую в «X»» — тоже юнит минус дети, по каждому значению.
   ========================================================================== */
(function(){
'use strict';
const MONTH_ABBR=['янв.','февр.','март','апр.','май','июнь','июль','авг.','сент.','окт.','нояб.','дек.'];
const MONTH_NOM=['январь','февраль','март','апрель','май','июнь','июль','август',
                 'сентябрь','октябрь','ноябрь','декабрь'];
/* колонка датасета → ключ ряда макета (ключи метрик и служебных рядов data.js) */
/* 15.10, схема 3: perf_* — категории мониторинга работы (недоработка и переработка
   живые); m_plow прежней схемы (оценка «низкая») значит теперь «недоработка». */
const COLS=['hc','act','avg','hire','fire','reg','tin','tout','pnor','plow','phig','pgry'];
/* Ряды из колонок, добавленных в таблицу к 12.10.2026 (разведка 2): отработанные
   человеко-дни, посещения офиса и решения по заявкам T-роста (GRT). Они
   НЕОБЯЗАТЕЛЬНЫЕ: датасет прежней версии их не везёт, и тогда посещаемость
   и T-рост остаются заглушками «демо», а не падают и не встают нулями. */
/* Поставка 50 (21.10, из прод-ноутбуков HQ и УС): обычные увольнения (nreg), вакансии (vop — открыто
   на конец месяца, vcl — закрыто, vap — новые, vtd/vtn — дни и число закрытых для срока, vjn — закрыто
   джунами) и AI (aiw — WAU, aip / aic — проникновение по юниту и компании). Тоже необязательные; вакансии
   и AI — без фильтров среза (не люди) */
/* Поставка 66 (посещения Адели): bk bkv vsv — дни с бронью, бронь без прихода, приход без брони; hwd hov — рабочие дни
   и посещения руководителей (у остальных — wds ovs: всё минус руководители) */
const OPT=['wday','ovis','gapr','gdec','nreg','vop','vcl','vap','vtd','vtn','vjn','aiw','aip','aic','hit','din','dout','hcd','hst',
  'bk','bkv','vsv','hwd','hov','rh','nrh','avh',
  /* файл 6, п. 2: уходы по активной численности HQ у каждого узла — HQ-текучесть «Как уходит HQ» по выбранной строке */
  'fh',
  /* 31.10-б, п. 6: одобренные и отклонённые заявки «Роста» без фильтра покраски — вкладка «Рост HQ» от него не зависит */
  'gah','gdh',
  /* поставка 71 (мониторинг по дням Адели): люди в сегментах прогулов (ab25 ab5), работы в выходной (we25 we5) и доли
     звонков (t23 t35 t5); сумма средних часов дня (hrs) и звонков (tlk) по людям с часами, сколько их (hrn) */
  'ab25','ab5','we25','we5','t23','t35','t5','hrs','hrn','tlk'];
const KEY={hc_total:'hc',hc_active:'act',hc_avg:'avg',hire:'hire',attrition:'fire',
  transfer_in:'tin',transfer_out:'tout',regret_cnt:'reg',
  /* поставка 69 (Антон, вопрос 4): желательная и нежелательная — всегда по активной численности HQ узла */
  regret_hq_cnt:'rh',nonregret_hq_cnt:'nrh',hc_avg_hq:'avh',attrition_hq_cnt:'fh',
  perf_norm:'pnor',perf_low:'plow',perf_high:'phig',perf_gray:'pgry',
  wday:'wday',ovis:'ovis',tgrowth_pass:'gapr',tgrowth_deny:'gdec',
  nonregret_cnt:'nreg',vac_open:'vop',vac_closed:'vcl',vac_new:'vap',ttf_days:'vtd',ttf_n:'vtn',vac_jun:'vjn',
  ai_wau:'aiw',ai_penetration:'aip',ai_pen_co:'aic',ai_den:'aid',
  /* поставка 65: найм по видам — из учебной группы в боевую, стажёр в штат (части hit) */
  hire_cand:'hcd',hire_int:'hst',
  bk_days:'bk',bk_noshow:'bkv',bk_walkin:'vsv',wday_lead:'hwd',ovis_lead:'hov',wday_staff:'wds',ovis_staff:'ovs',
  mon_ab25:'ab25',mon_ab5:'ab5',mon_we25:'we25',mon_we5:'we5',mon_t23:'t23',mon_t35:'t35',mon_t5:'t5',
  mon_hrs:'hrs',mon_hrn:'hrn',mon_tlk:'tlk'};
/* метрики, которые оживают, когда в ответе есть их колонки */
const LIVE_WITH={office_att:['wday','ovis'],tgrowth_pass:['gapr'],tgrowth_deny:['gdec'],tgrowth_conv:['gapr','gdec'],
  nonregret:['nreg'],vac_open:['vop'],vac_closed:['vcl'],time_to_fill:['vtd','vtn'],junior_share:['vjn','vcl'],
  ai_wau:['aiw'],ai_penetration:['aip'],booking_viol:['bk','bkv','vsv']};
/* колонки, которые оживляют метрику, только если в них есть данные: пустая витрина (нет источника
   вакансий или AI, нет флага обычного увольнения) даёт нули — метрика остаётся «в разработке» */
const LIVE_NZ=['nreg','vop','vcl','aiw','aip','hit','bk','hwd'];
/* Метрики без источника в hr_structure_overall: в пробнике — заглушки на генераторе
   макета (по численности юнита), с пометкой «демо». План подключения —
   «Поставка — TeamPulse Hub/План метрик.md». */
const STUB=['nonregret','vac_open','vac_closed','time_to_fill','hire_plan','junior_share',
  'tgrowth_pass','tgrowth_deny','tgrowth_conv','review_up',
  'office_att','booking_viol','ai_penetration','ai_wau'];
/* План подключения живёт в data.js (D.DEV_PLAN; 15.10 — по каталогу графиков HQ и УС):
   им размечены и макет, и пробник — «в разработке» у метрик, вкладок и блоков. */
/* значения фильтров в датасете ↔ ключи фильтров макета */
const PAINT_V={HQ:'Hq',Line:'Line',Support:'Support'};
const IT_V={IT:'IT',Digital:'Digital',nonIT:'NonIT'};
const STAFF_V={staff:'Штат',nonstaff:'Не штат'};
/* тип численности (20.10): «Активная» — ответ датасета по умолчанию, «Вся» — act_f */
const ACT_V={active:'Активная',all:'Вся'};

function str(v){return v==null?'':String(v)}
function num(v){const n=+v;return isFinite(n)?n:0}
function parseArr(s,n){
  const a=str(s).split(','), out=new Array(n);
  for(let i=0;i<n;i++)out[i]=i<a.length?num(a[i]):0;
  return out;
}
function ym(s){const p=str(s).split('-');return {y:+p[0]||1970,m:(+p[1]||1)-1}}
function invert(o){const r={};Object.keys(o).forEach(k=>{r[o[k]]=k});return r}
/* разрезы юнита: «ключ \t значение \t число» через \n → {ключ:{значение:число}}.
   27.10-в, п. 19: грейды 20 и выше — одной категорией «20+» (состав, уходы и найм по грейду) */
const GRADE_MX={gr:1,xg:1,hg:1};
function gradeOf(v){const g=/^\s*(?:грейд\s*)?(\d+)\s*$/i.exec(v);return g&&+g[1]>=20?'20+':v}
function parseMx(s){
  const out={};
  str(s).split('\n').forEach(line=>{
    if(!line)return;
    const f=line.split('\t');
    if(f.length<3)return;
    const o=out[f[0]]=out[f[0]]||{}, v=GRADE_MX[f[0]]?gradeOf(f[1]):f[1];
    o[v]=(o[v]||0)+num(f[2]);
  });
  return out;
}
/* «Напрямую в «X»»: юнит минус прямые дети по каждому значению каждого разреза */
function mxMinus(u,kids){
  const out={};
  Object.keys(u).forEach(k=>{
    if(k==='dw'||k==='do'||k==='xim')return;   /* календарь посещений и уходы по инициатору — только у выбранного юнита */
    Object.keys(u[k]).forEach(v=>{
      let s=u[k][v];
      kids.forEach(c=>{s-=((c[k]||{})[v]||0)});
      s=Math.round(s*10)/10;
      if(s>0)(out[k]=out[k]||{})[v]=s;
    });
  });
  return out;
}
/* пары «значение, численность» из meta.vals: toJSONString отдаёт и объекты, и массивы */
function pairs(list){
  return (list||[]).map(x=>Array.isArray(x)?{v:str(x[0]),n:num(x[1])}:{v:str(x.v),n:num(x.e)});
}

/* все колонки датасета: каждую нужно добавить в «Измерения» чарта. Необязательные
   (OPT) в список «нет колонок» не попадают — без них метрики остаются «демо». */
const FIELDS=['role','id','pid','lvl','nm','kids','j'].concat(COLS.map(c=>'m_'+c)).concat(['mx']);
const FIELDS_OPT=OPT.map(c=>'m_'+c);
/* датасет 2а с поставки 53: метрики узла одной колонкой ms — ряды через «;» в порядке meta.mk
   (текст запроса втрое короче, обёртка Proteus группирует 9 колонок вместо 34) */
const FIELDS_MS=['role','id','pid','lvl','nm','kids','j','ms','mx'];

function build(data){
  const rows=Array.isArray(data)?data:[];
  let meta={};
  try{meta=JSON.parse(str((rows.find(r=>str(r.role)==='meta')||{}).j)||'{}')}catch(e){meta={}}
  /* ряд метрики c строки r: прежний ответ — колонка m_c, новый — c-й отрезок ms */
  const mk=str(meta.mk)?str(meta.mk).split(','):null, mkAt={};
  if(mk)mk.forEach((c,i)=>{mkAt[c]=i});
  const msOf=r=>r._ms||(r._ms=str(r.ms).split(';'));
  const raw=mk?(r,c)=>(c in mkAt?msOf(r)[mkAt[c]]:undefined):(r,c)=>r['m_'+c];
  const hasCol=mk?c=>c in mkAt:c=>('m_'+c) in rows[0];
  /* поле, которого нет в «Измерениях», приходит undefined — массивы молча стали бы
     нулями; поэтому чарт называет пропущенные колонки сам */
  const missing=rows.length?(mk?FIELDS_MS:FIELDS).filter(f=>!(f in rows[0])):[];
  /* необязательные ряды — только если колонка есть в ответе */
  const nz=c=>rows.some(r=>/[1-9]/.test(str(raw(r,c))));
  const have=new Set(rows.length?OPT.filter(c=>hasCol(c)&&(LIVE_NZ.indexOf(c)<0||nz(c))):[]);
  const cols=COLS.concat(OPT.filter(c=>have.has(c)));
  /* AI (поставка 50): проникновение — доля, по листьям не складывается. Знаменатель источника
     восстанавливается из неё (aid = WAU × 100 / проникновение) и складывается, как численность:
     проникновение узла = Σ WAU / Σ aid — ровно доля источника */
  const AID=have.has('aip')&&have.has('aiw');
  if(AID)cols.push('aid');
  /* сегмент «Сотрудники» посещаемости — всё минус руководители: ряды складываются, как численность */
  const SEG=have.has('hwd')&&have.has('hov')&&have.has('wday')&&have.has('ovis');
  if(SEG)cols.push('wds','ovs');
  /* поставка 56: найм по дню события (hit — из переходов ноутбука: найм в компанию и, на активной, переходы
     кандидатов и стажёров) — тем же счётом, что переводы, поэтому водопад сходится без «прочего». Прежние
     таблицы его не везут (нули) — тогда найм из рядов, как раньше */
  const HIT=have.has('hit'), GAH=have.has('gah');
  const parseSer=r=>{
    const ser={};
    cols.forEach(c=>{if(c!=='aid'&&c!=='wds'&&c!=='ovs')ser[c]=parseArr(raw(r,c),n)});
    if(AID)ser.aid=ser.aiw.map((w,k)=>ser.aip[k]?+(w*100/ser.aip[k]).toFixed(3):0);
    if(SEG){ser.wds=ser.wday.map((w,k)=>w-ser.hwd[k]);ser.ovs=ser.ovis.map((v,k)=>v-ser.hov[k])}
    if(HIT)ser.hire=ser.hit;
    if(GAH){ser.gapr=ser.gah;ser.gdec=ser.gdh}
    return ser;
  };
  const stub=new Set(STUB.filter(k=>!(LIVE_WITH[k]&&LIVE_WITH[k].every(c=>have.has(c)))));
  const by=role=>rows.filter(r=>str(r.role)===role);
  const sc0=by('scope')[0];
  const n=Math.max(1,num(meta.n)||(sc0?str(raw(sc0,'hc')).split(',').length:0)||1);
  const m0=ym(meta.m0);

  /* календарь: сетка от января прошлого года, окно — последние 12 месяцев */
  const monthsExt=[];
  for(let i=0;i<n;i++){
    const t=m0.y*12+m0.m+i, y=Math.floor(t/12), m=t%12;
    monthsExt.push({y,m,label:MONTH_ABBR[m],isYearStart:m===0});
  }
  const N=Math.min(12,n), pre=n-N, months=monthsExt.slice(pre);
  const nm=mm=>MONTH_NOM[mm.m]+' '+mm.y;
  const periodLabel=nm(months[0])+' — '+nm(months[months.length-1]);
  /* дата данных (20.10, ноутбук meta.data_dt → «dt»): последний месяц — текущий, данные по этот
     день. Нет даты или она не в последнем месяце — месяц считается закрытым */
  const lmM=months[months.length-1], dm=/^(\d{4})-(\d{2})-(\d{2})/.exec(str(meta.dt));
  const asof=dm&&+dm[1]===lmM.y&&+dm[2]-1===lmM.m?{y:lmM.y,m:lmM.m,d:+dm[3]}:null;

  /* юниты: справочник + строки дерева с рядами. С 19.10 справочник — всё дерево: «id, родитель,
     уровень, детей, имя, логин руководителя, fd» (fd — численность узла в последнем месяце по
     сочетаниям значений фильтров, «код:число» через пробел; код — номера значений в meta.fdv
     смешанной системой: покраска, IT, штат, пустой словарь — разреза нет). Прежний датасет —
     пять полей: тогда в окне настройки нет ни логинов, ни чисел «после применения». С поставки 66 восьмое
     поле — имя руководителя (окно настройки ищет и по нему). */
  const byId={};
  str((by('dict')[0]||{}).j).split('\n').forEach(line=>{
    if(!line)return;
    const f=line.split('\t'), nw=f.length>=7;
    /* поставка 69: девятое поле «a» — предок корня зоны доступа: только имя для пути, выбрать нельзя */
    byId[f[0]]={id:f[0],pid:f[1]||'',lvl:num(f[2]),kids:num(f[3]),name:nw?f[4]:f.slice(4).join('\t'),
      head:nw?str(f[5]).trim():'',fd:nw?str(f[6]):'',hname:nw?str(f[7]).trim():'',anc:f[8]==='a'};
  });
  const DEPTH={scope:0,c:1,g:2,x:3};
  const units=[];
  rows.forEach(r=>{
    const role=str(r.role);
    if(!(role in DEPTH))return;
    const u={id:str(r.id),pid:str(r.pid),lvl:num(r.lvl),kids:num(r.kids),name:str(r.nm),depth:DEPTH[role],ser:{},
      mx:parseMx(r.mx)};
    u.ser=parseSer(r);
    units.push(u);
    byId[u.id]=Object.assign(byId[u.id]||{head:'',fd:'',hname:''},{id:u.id,pid:u.pid,lvl:u.lvl,kids:u.kids,name:u.name});
  });
  const scopeU=units.find(u=>u.depth===0)||null;
  let rootId=str(meta.root)||(scopeU?scopeU.id:'');

  /* пути: корень — 'T' (как «вся компания» макета), дальше id через '/' */
  const pathMemo={};
  function pathOf(id,guard){
    if(pathMemo[id]!==undefined)return pathMemo[id];
    if(id===rootId)return (pathMemo[id]='T');
    const u=byId[id];
    if(!u||!u.pid||(guard||0)>16)return (pathMemo[id]=null);
    const pp=pathOf(u.pid,(guard||0)+1);
    return (pathMemo[id]=pp==null?null:pp+'/'+id);
  }
  /* обрезанный ответ без пути до корня: выбранный юнит становится корнем */
  if(scopeU&&pathOf(scopeU.id)==null){
    Object.keys(pathMemo).forEach(k=>{delete pathMemo[k]});
    rootId=scopeU.id;
  }

  const lastOf=a=>a[n-1]||0;
  const nodes=[], series={}, mixes={};
  /* поставка 64: переводы не складываются по листьям — у мастер-отчёта «напрямую в юните» свой узел (din / dout
     ноутбука), и переход из корня юнита в его подразделение для юнита внутренний, а для листьев — перевод. Поэтому
     лист «Напрямую» берёт din / dout, а у юнита с подразделениями переводы — своя строка (trfOwn: data.js берёт её,
     когда считает ровно листья этого юнита) */
  const DIN=have.has('din')&&have.has('dout'), trfOwn={};
  /* в модель отчёта — как до 19.10: юниты ответа, путь к выбранному и пять верхних уровней;
     весь справочник — только окну настройки (pick ниже): 11 тыс. узлов в NODES замедлили бы
     каждый обход дерева */
  const lv0=Object.keys(byId).reduce((m,id)=>Math.min(m,byId[id].lvl||99),99);
  const keep=new Set(units.map(u=>u.id));
  for(let a=scopeU?scopeU.id:'',g=0;a&&byId[a]&&g<20;a=byId[a].pid,g++)keep.add(a);
  keep.add(rootId);
  Object.keys(byId).forEach(id=>{
    const u=byId[id];
    if(!keep.has(id)&&!(u.lvl&&u.lvl<=lv0+4))return;
    const p=pathOf(id);
    if(p==null)return;
    const parts=p.split('/');
    nodes.push({id:id,path:p,parent:parts.length>1?parts.slice(0,-1).join('/'):null,level:u.lvl||parts.length,
      name:u.name||'—',sort:0,leaf:false,kids:u.kids,outside:true,anc:u.anc,head:u.head||u.hname?{name:u.hname||'',login:u.head}:null});
  });
  const nodeBy={};
  nodes.forEach(x=>{nodeBy[x.path]=x});

  /* дерево ответа: лист — юнит третьего уровня вниз или юнит без детей в ответе;
     у юнита с детьми — лист «Напрямую в «X»», если разница не нулевая */
  const kidsIn={};
  units.forEach(u=>{if(u.depth>0)(kidsIn[u.pid]=kidsIn[u.pid]||[]).push(u)});
  units.forEach(u=>{
    const p=pathOf(u.id), node=nodeBy[p];
    if(!node)return;
    node.outside=false;
    node.sort=-lastOf(u.ser.hc);
    const ch=u.depth<3?(kidsIn[u.id]||[]):[];
    if(!ch.length){
      node.leaf=true;
      if(u.depth===3)node.below=u.kids;
      series[p]=u.ser;mixes[p]=u.mx;
      return;
    }
    const own={};
    let any=false;
    cols.forEach(c=>{
      own[c]=u.ser[c].map((v,i)=>{
        let s=v;ch.forEach(k=>{s-=k.ser[c][i]});
        s=Math.round(s*10)/10;
        if(Math.abs(s)>1e-9)any=true;
        return s;
      });
    });
    if(DIN){
      own.tin=u.ser.din.slice();own.tout=u.ser.dout.slice();
      if(own.tin.some(v=>v)||own.tout.some(v=>v))any=true;
      trfOwn[p]={transfer_in:u.ser.tin,transfer_out:u.ser.tout};
    }
    if(any){
      const dp=p+'/·';
      /* Строка видна, только если в юните сейчас есть свои люди (как в HRBP HUB):
         без них в ней остались бы лишь переводы между детьми юнита — для суммы
         они нужны (лист участвует в агрегации всегда), а строкой читались бы
         как ошибка. */
      const dn={id:u.id+'·',path:dp,parent:p,level:(u.lvl||0)+1,name:'Напрямую в «'+u.name+'»',
        sort:Infinity,leaf:true,direct:true,kids:0,outside:false,hide:!(own.hc[n-1]>0)};
      nodes.push(dn);nodeBy[dp]=dn;
      series[dp]=own;mixes[dp]=mxMinus(u.mx,ch.map(k=>k.mx));
    }
  });
  const baseRow=by('base')[0];
  if(baseRow){
    series.BASE=parseSer(baseRow);mixes.BASE=parseMx(baseRow.mx);
  }
  /* поставка 65: светофор «Как уходит HQ?» — выбранный юнит под «HQ + Активная» (строка hq; датасет до 65 — без неё) */
  const hqRow=by('hq')[0];
  /* 31.10-б, п. 2: желательная и нежелательная HQ считаются по rh / nrh / avh, а датасет отдаёт их только узлам и базе — у
     строки hq они нулевые, и светофор показывал 0 при любом выборе. Строка hq уже по активной численности HQ выбранного
     юнита: её reg / nreg (non-regrettable — желательные) / avg и есть эти ряды */
  if(hqRow&&str(hqRow.ms||hqRow.m_hc)){const h=series.HQ=parseSer(hqRow);
    [['rh','reg'],['nrh','nreg'],['avh','avg']].forEach(p=>{if(h[p[1]])h[p[0]]=h[p[1]].slice()})}

  /* Окно настройки (19.10, как в HRBP HUB): дерево всего справочника, логин руководителя и
     «сколько людей попадёт в выбор» — по fd, без запроса. Пути — как у модели ('T/id/…'). */
  const fdv=meta.fdv&&typeof meta.fdv==='object'?meta.fdv:null;
  const FDK=['paint','it','staff','act'].filter(k=>fdv&&Array.isArray(fdv[k])&&fdv[k].length);
  const fdOk=!!FDK.length&&Object.keys(byId).some(id=>byId[id].fd);
  const kidsBy={};
  Object.keys(byId).forEach(id=>{const p=byId[id].pid;if(p&&byId[p])(kidsBy[p]=kidsBy[p]||[]).push(id)});
  const idOfPath=p=>p==='T'?rootId:String(p).split('/').pop();
  /* fd узла → [[номер по каждому разрезу FDK…, число], …]; разбор — при первом обращении */
  function fdOf(id){
    const u=byId[id];
    if(!u)return [];
    if(u._fd)return u._fd;
    u._fd=str(u.fd).split(' ').filter(Boolean).map(x=>{
      const at=x.indexOf(':');let c=parseInt(x.slice(0,at),10);const d=[];
      for(let k=FDK.length-1;k>=0;k--){const L=fdv[FDK[k]].length;d[k]=c%L;c=Math.floor(c/L)}
      return d.concat([num(x.slice(at+1))]);
    });
    return u._fd;
  }
  /* поставка 69, доступ по зоне: корни зоны (полный доступ — корень компании); окно выбора начинается с них */
  const zoneIds=(Array.isArray(meta.zone)?meta.zone:[]).map(str).filter(id=>byId[id]);
  const zoneRoots=meta.full===1||!zoneIds.length?['T']:zoneIds.map(id=>pathOf(id)).filter(Boolean);
  const pick={
    ok:fdOk,
    root:zoneRoots[0],roots:zoneRoots,base:'T',
    kids(p){const id=idOfPath(p);return (kidsBy[id]||[]).filter(k=>!byId[k].anc).map(k=>pathOf(k)).filter(Boolean)},
    info(p){const u=byId[idOfPath(p)];return u?{name:u.name||'—',lvl:u.lvl,head:u.head||'',hname:u.hname||'',kids:(kidsBy[u.id]||[]).length}:null},
    all(){return Object.keys(byId).filter(id=>!byId[id].anc).map(id=>pathOf(id)).filter(Boolean)},
    /* люди узла в последнем месяце при значениях фильтров sel {paint,it,staff,act: значение, набор значений
       (тип численности — поставка 61) или null}; null — нет fd */
    count(p,sel){
      if(!fdOk||(byId[idOfPath(p)]||{}).anc)return null;
      const want=FDK.map(k=>sel&&sel[k]!=null?[].concat(sel[k]).map(v=>String(v).toLowerCase()):null);
      let s=0;
      fdOf(idOfPath(p)).forEach(r=>{
        for(let k=0;k<FDK.length;k++)if(want[k]&&want[k].indexOf(String(fdv[FDK[k]][r[k]]).toLowerCase())<0)return;
        s+=r[FDK.length];
      });
      return Math.round(s);
    }
  };

  const pv=invert(PAINT_V), iv=invert(IT_V), sv=invert(STAFF_V);
  const cuts=new Set(Array.isArray(meta.cuts)?meta.cuts.map(str):['paint','it','staff']);
  const one=(list,map)=>{const a=(list||[]).map(str);return a.length===1&&map[a[0]]?map[a[0]]:'all'};
  const vals=meta.vals||{};
  /* тип численности (поставка 61): набор по умолчанию — meta.act_def (у 2а до поставки 60 его нет — «Активная»),
     типы — все значения ответа: сначала набор по умолчанию, дальше по численности компании */
  const actDef=(Array.isArray(meta.act_def)&&meta.act_def.length?meta.act_def:['Активная']).map(str);
  const actNow=(Array.isArray(meta.act)?meta.act:[]).map(str);
  const lc=a=>a.map(x=>x.toLowerCase());
  const sameSet=(a,b)=>a.length===b.length&&lc(a).every(x=>lc(b).indexOf(x)>=0);
  const actN={};pairs(vals.act).forEach(x=>{actN[x.v]=x.n});
  const actTypes=!cuts.has('act')?[]:(fdv&&Array.isArray(fdv.act)&&fdv.act.length?fdv.act.map(str):Object.keys(actN))
    .filter(v=>v&&v!=='∅')
    .sort((a,b)=>{
      const da=lc(actDef).indexOf(a.toLowerCase()), db=lc(actDef).indexOf(b.toLowerCase());
      if(da>=0||db>=0)return (da<0?99:da)-(db<0?99:db);
      return (actN[b]||0)-(actN[a]||0)||a.localeCompare(b,'ru');
    });
  const hcType=!cuts.has('act')||!actNow.length?'all':sameSet(actNow,actDef)?'active':'set';
  return {
    n,pre,months,monthsExt,periodLabel,
    lm:str(meta.lm),today:str(meta.today),asof,
    rootId,scopeId:scopeU?scopeU.id:rootId,
    scopePath:scopeU?(pathOf(scopeU.id)||'T'):'T',
    defId:str(meta.def),
    /* эхо запроса (21.10): какой юнит просили (unit_f) — пусто, если юнит по умолчанию; по нему чарт
       отличает ответ на свой запрос от устаревшего */
    req:(Array.isArray(meta.req)?meta.req:[]).map(str),
    truncated:!rows.some(r=>str(r.role)==='end'),
    missing,noMeta:!by('meta').length,
    /* поставка 69: логин без зоны доступа — датасет отдаёт только meta с ok 0 */
    noAccess:meta.ok===0,
    empty:!scopeU,
    nodes,
    applied:{paint:one(meta.paint,pv),itSeg:one(meta.it,iv),staffType:one(meta.staff,sv),
      /* тип численности: датасет без него (таблицы ноутбука до 20.10) отдаёт всю; эхо = набор по умолчанию —
         'active', пустое — 'all', иначе — свой набор */
      hcType,hcSet:hcType==='set'?actNow:[]},
    actTypes,actDef,
    /* какие фильтры датасет умеет (файл 2 — без покраски; без act_cd — без типа численности) */
    cuts,
    vals:{paint:pairs(vals.paint),it:pairs(vals.it),staff:pairs(vals.staff),act:pairs(vals.act)},
    pick,
    stub,
    /* есть ли в ответе необязательная колонка (без m_) */
    has(c){return have.has(c)},
    /* ряд по ключу метрики макета; null — у ключа нет источника (дальше генератор) */
    series(path,key){
      const s=series[path], c=KEY[key];
      return s&&c&&s[c]?s[c]:null;
    },
    hasSeries(path){return !!series[path]},
    /* поставка 64: переводы юнита с подразделениями — своей строкой (не сумма листьев); null — нет */
    trfOwn(path,key){const o=trfOwn[path];return o&&o[key]?o[key]:null},
    trfOwnPaths(){return Object.keys(trfOwn)},
    /* разрезы листа (или 'BASE'): {ключ:{значение:число}}; null — нет данных */
    mix(path){return mixes[path]||null},
    /* поставка 66: календарь посещений выбранного юнита — {dw:{дата:людей с рабочим днём}, do:{дата:из них в офисе}};
       null — в ответе его нет */
    dayMix(){const m=scopeU&&scopeU.mx;return m&&m.dw&&Object.keys(m.dw).length?{dw:m.dw,do:m.do||{}}:null},
    /* 26.10-б: разрез выбранного юнита (xim — увольнения по инициатору и месяцу); null — нет в ответе */
    scopeMix(k){const m=scopeU&&scopeU.mx;return m&&m[k]&&Object.keys(m[k]).length?m[k]:null},
    /* значения разреза с числом по базе — для категорий; значение, которого в базе
       нет (не должно быть: листья внутри компании), добавляется с числом листа */
    mixVals(k){
      const acc=Object.assign({},(mixes.BASE||{})[k]||{});
      Object.keys(mixes).forEach(p=>{const m=mixes[p][k];if(m)Object.keys(m).forEach(v=>{if(!(v in acc))acc[v]=m[v]})});
      return acc;
    },
    lastHc(path){const s=series[path];return s?lastOf(s.hc):0},
    idOf(path){const node=nodeBy[path];return node?node.id:null},
    /* значения фильтров для кросс-фильтра: ключ макета → значение колонки датасета */
    filterValue(kind,key){return ({paint:PAINT_V,itSeg:IT_V,staffType:STAFF_V,hcType:ACT_V}[kind]||{})[key]||null}
  };
}

window.TPREAL={build,FIELDS,FIELDS_MS,FIELDS_OPT,OPT,LIVE_WITH,STUB,PAINT_V,IT_V,STAFF_V,ACT_V};
})();

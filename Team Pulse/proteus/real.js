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
const OPT=['wday','ovis','gapr','gdec'];
const KEY={hc_total:'hc',hc_active:'act',hc_avg:'avg',hire:'hire',attrition:'fire',
  transfer_in:'tin',transfer_out:'tout',regret_cnt:'reg',
  perf_norm:'pnor',perf_low:'plow',perf_high:'phig',perf_gray:'pgry',
  wday:'wday',ovis:'ovis',tgrowth_pass:'gapr',tgrowth_deny:'gdec'};
/* метрики, которые оживают, когда в ответе есть их колонки */
const LIVE_WITH={office_att:['wday','ovis'],tgrowth_pass:['gapr'],tgrowth_deny:['gdec'],tgrowth_conv:['gapr','gdec']};
/* Метрики без источника в hr_structure_overall: в пробнике — заглушки на генераторе
   макета (по численности юнита), с пометкой «демо». План подключения —
   «Поставка — TeamPulse Hub/План метрик.md». */
const STUB=['vac_open','vac_closed','time_to_fill','hire_plan','junior_share',
  'tgrowth_pass','tgrowth_deny','tgrowth_conv','tgrowth_tat','review_up',
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
/* разрезы юнита: «ключ \t значение \t число» через \n → {ключ:{значение:число}} */
function parseMx(s){
  const out={};
  str(s).split('\n').forEach(line=>{
    if(!line)return;
    const f=line.split('\t');
    if(f.length<3)return;
    (out[f[0]]=out[f[0]]||{})[f[1]]=num(f[2]);
  });
  return out;
}
/* «Напрямую в «X»»: юнит минус прямые дети по каждому значению каждого разреза */
function mxMinus(u,kids){
  const out={};
  Object.keys(u).forEach(k=>{
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

function build(data){
  const rows=Array.isArray(data)?data:[];
  /* поле, которого нет в «Измерениях», приходит undefined — массивы молча стали бы
     нулями; поэтому чарт называет пропущенные колонки сам */
  const missing=rows.length?FIELDS.filter(f=>!(f in rows[0])):[];
  /* необязательные ряды — только если колонка есть в ответе */
  const have=new Set(rows.length?OPT.filter(c=>('m_'+c) in rows[0]):[]);
  const cols=COLS.concat(OPT.filter(c=>have.has(c)));
  const stub=new Set(STUB.filter(k=>!(LIVE_WITH[k]&&LIVE_WITH[k].every(c=>have.has(c)))));
  const by=role=>rows.filter(r=>str(r.role)===role);
  let meta={};
  try{meta=JSON.parse(str((by('meta')[0]||{}).j)||'{}')}catch(e){meta={}}
  const n=Math.max(1,num(meta.n)||parseArr((by('scope')[0]||{}).m_hc,0).length||1);
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

  /* юниты: справочник + строки дерева с рядами. С 19.10 справочник — всё дерево: «id, родитель,
     уровень, детей, имя, логин руководителя, fd» (fd — численность узла в последнем месяце по
     сочетаниям значений фильтров, «код:число» через пробел; код — номера значений в meta.fdv
     смешанной системой: покраска, IT, штат, пустой словарь — разреза нет). Прежний датасет —
     пять полей: тогда в окне настройки нет ни логинов, ни чисел «после применения». */
  const byId={};
  str((by('dict')[0]||{}).j).split('\n').forEach(line=>{
    if(!line)return;
    const f=line.split('\t'), nw=f.length>=7;
    byId[f[0]]={id:f[0],pid:f[1]||'',lvl:num(f[2]),kids:num(f[3]),name:nw?f[4]:f.slice(4).join('\t'),
      head:nw?str(f[5]).trim():'',fd:nw?str(f[6]):''};
  });
  const DEPTH={scope:0,c:1,g:2,x:3};
  const units=[];
  rows.forEach(r=>{
    const role=str(r.role);
    if(!(role in DEPTH))return;
    const u={id:str(r.id),pid:str(r.pid),lvl:num(r.lvl),kids:num(r.kids),name:str(r.nm),depth:DEPTH[role],ser:{},
      mx:parseMx(r.mx)};
    cols.forEach(c=>{u.ser[c]=parseArr(r['m_'+c],n)});
    units.push(u);
    byId[u.id]=Object.assign(byId[u.id]||{head:'',fd:''},{id:u.id,pid:u.pid,lvl:u.lvl,kids:u.kids,name:u.name});
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
      name:u.name||'—',sort:0,leaf:false,kids:u.kids,outside:true,head:u.head?{name:'',login:u.head}:null});
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
    const b={};
    cols.forEach(c=>{b[c]=parseArr(baseRow['m_'+c],n)});
    series.BASE=b;mixes.BASE=parseMx(baseRow.mx);
  }

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
  const pick={
    ok:fdOk,
    root:'T',
    kids(p){const id=idOfPath(p);return (kidsBy[id]||[]).map(k=>pathOf(k)).filter(Boolean)},
    info(p){const u=byId[idOfPath(p)];return u?{name:u.name||'—',lvl:u.lvl,head:u.head||'',kids:(kidsBy[u.id]||[]).length}:null},
    all(){return Object.keys(byId).map(id=>pathOf(id)).filter(Boolean)},
    /* люди узла в последнем месяце при значениях фильтров sel {paint,it,staff,act: значение или null}; null — нет fd */
    count(p,sel){
      if(!fdOk)return null;
      const want=FDK.map(k=>sel&&sel[k]!=null?String(sel[k]).toLowerCase():null);
      let s=0;
      fdOf(idOfPath(p)).forEach(r=>{
        for(let k=0;k<FDK.length;k++)if(want[k]!=null&&String(fdv[FDK[k]][r[k]]).toLowerCase()!==want[k])return;
        s+=r[FDK.length];
      });
      return Math.round(s);
    }
  };

  const pv=invert(PAINT_V), iv=invert(IT_V), sv=invert(STAFF_V);
  const cuts=new Set(Array.isArray(meta.cuts)?meta.cuts.map(str):['paint','it','staff']);
  const one=(list,map)=>{const a=(list||[]).map(str);return a.length===1&&map[a[0]]?map[a[0]]:'all'};
  const vals=meta.vals||{};
  return {
    n,pre,months,monthsExt,periodLabel,
    lm:str(meta.lm),today:str(meta.today),
    rootId,scopeId:scopeU?scopeU.id:rootId,
    scopePath:scopeU?(pathOf(scopeU.id)||'T'):'T',
    defId:str(meta.def),
    truncated:!rows.some(r=>str(r.role)==='end'),
    missing,noMeta:!by('meta').length,
    empty:!scopeU,
    nodes,
    applied:{paint:one(meta.paint,pv),itSeg:one(meta.it,iv),staffType:one(meta.staff,sv),
      /* тип численности: датасет без него (таблицы ноутбука до 20.10) отдаёт всю */
      hcType:cuts.has('act')&&(meta.act||[]).map(str).some(v=>v.toLowerCase()==='активная')?'active':'all'},
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
    /* разрезы листа (или 'BASE'): {ключ:{значение:число}}; null — нет данных */
    mix(path){return mixes[path]||null},
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

window.TPREAL={build,FIELDS,FIELDS_OPT,OPT,LIVE_WITH,STUB,PAINT_V,IT_V,STAFF_V,ACT_V};
})();

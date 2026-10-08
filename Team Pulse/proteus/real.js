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
   ========================================================================== */
(function(){
'use strict';
const MONTH_ABBR=['янв.','февр.','март','апр.','май','июнь','июль','авг.','сент.','окт.','нояб.','дек.'];
const MONTH_NOM=['январь','февраль','март','апрель','май','июнь','июль','август',
                 'сентябрь','октябрь','ноябрь','декабрь'];
/* колонка датасета → ключ ряда макета (ключи метрик и служебных рядов data.js) */
const COLS=['hc','act','avg','hire','fire','reg','tin','tout','plow','prat'];
const KEY={hc_total:'hc',hc_active:'act',hc_avg:'avg',hire:'hire',attrition:'fire',
  transfer_in:'tin',transfer_out:'tout',regret_cnt:'reg',plow:'plow',prated:'prat'};
/* Метрики без источника в hr_structure_overall: в пробнике — заглушки на генераторе
   макета (по численности юнита), с пометкой «демо». План подключения —
   «Поставка — TeamPulse Hub/План метрик.md». */
const STUB=['vac_open','vac_closed','time_to_fill','hire_plan','junior_share',
  'tgrowth_pass','tgrowth_deny','tgrowth_conv','tgrowth_tat','underwork','review_up',
  'office_att','booking_viol','ai_penetration','ai_wau'];
/* План подключения метрик — тот же, что в «Поставка — TeamPulse Hub/План метрик.md»:
   справка пробника показывает его таблицей (U.planTable). Этап 0 — то, что уже живое. */
const PLAN=[
  {stage:'0',what:'Численность общая и активная, найм, отток, переводы, прирост с начала года, '+
    'текучесть месячная и накопительная, прогноз, замещение, найм на 100, доля внутреннего найма, regret, '+
    'низкая оценка; дерево юнитов, покраска, IT, штат',src:'hr_structure_overall',now:'живые'},
  {stage:'1',what:'Разбивки состава по типу численности, типу договора, покраске и IT',
    src:'hr_structure_overall — новые строки датасета',now:'демо'},
  {stage:'2',what:'Вакансии, срок закрытия, план найма, воронка, доля джунов, каналы найма',
    src:'vacancy_daily_for_digest, plan_fact_tf_rabota, atributy_nayma, junior_ratio_hr_digest',now:'демо'},
  {stage:'3',what:'Причины и инициаторы увольнений, стаж и грейд ушедших',
    src:'ys_all_fire_initiative, initiative_reason_unit_tekuchest',now:'демо'},
  {stage:'4',what:'Состав: грейд, сеньорность, пол, возраст, стаж, формат работы, юрлицо, регион, стрим',
    src:'mdm_employee_structure_d → ноут Helicopter, как в HRBP HUB',now:'демо'},
  {stage:'5',what:'Ревью и недоработка',src:'review_digest_us, review_table_ys; недоработка — уточнить',now:'демо'},
  {stage:'6',what:'T-рост: заявки, решения, конверсия, T@T',src:'сервис «Рост» (дашборд 34136)',now:'демо'},
  {stage:'7',what:'Посещаемость офиса и бронирование',src:'СКУД и система бронирования (дашборд 34136)',now:'демо'},
  {stage:'8',what:'AI: проникновение и активные пользователи',src:'penetration_unit, penetration_company, wau',now:'демо'}
];
/* значения фильтров в датасете ↔ ключи фильтров макета */
const PAINT_V={HQ:'Hq',Line:'Line',Support:'Support'};
const IT_V={IT:'IT',Digital:'Digital',nonIT:'NonIT'};
const STAFF_V={staff:'Штат',nonstaff:'Не штат'};

function str(v){return v==null?'':String(v)}
function num(v){const n=+v;return isFinite(n)?n:0}
function parseArr(s,n){
  const a=str(s).split(','), out=new Array(n);
  for(let i=0;i<n;i++)out[i]=i<a.length?num(a[i]):0;
  return out;
}
function ym(s){const p=str(s).split('-');return {y:+p[0]||1970,m:(+p[1]||1)-1}}
function invert(o){const r={};Object.keys(o).forEach(k=>{r[o[k]]=k});return r}
/* пары «значение, численность» из meta.vals: toJSONString отдаёт и объекты, и массивы */
function pairs(list){
  return (list||[]).map(x=>Array.isArray(x)?{v:str(x[0]),n:num(x[1])}:{v:str(x.v),n:num(x.e)});
}

/* все колонки датасета: каждую нужно добавить в «Измерения» чарта */
const FIELDS=['role','id','pid','lvl','nm','kids','j'].concat(COLS.map(c=>'m_'+c));

function build(data){
  const rows=Array.isArray(data)?data:[];
  /* поле, которого нет в «Измерениях», приходит undefined — массивы молча стали бы
     нулями; поэтому чарт называет пропущенные колонки сам */
  const missing=rows.length?FIELDS.filter(f=>!(f in rows[0])):[];
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

  /* юниты: справочник (путь и верхние уровни) + строки дерева с рядами */
  const byId={};
  str((by('dict')[0]||{}).j).split('\n').forEach(line=>{
    if(!line)return;
    const f=line.split('\t');
    byId[f[0]]={id:f[0],pid:f[1]||'',lvl:num(f[2]),kids:num(f[3]),name:f.slice(4).join('\t')};
  });
  const DEPTH={scope:0,c:1,g:2,x:3};
  const units=[];
  rows.forEach(r=>{
    const role=str(r.role);
    if(!(role in DEPTH))return;
    const u={id:str(r.id),pid:str(r.pid),lvl:num(r.lvl),kids:num(r.kids),name:str(r.nm),depth:DEPTH[role],ser:{}};
    COLS.forEach(c=>{u.ser[c]=parseArr(r['m_'+c],n)});
    units.push(u);
    byId[u.id]=Object.assign(byId[u.id]||{},{id:u.id,pid:u.pid,lvl:u.lvl,kids:u.kids,name:u.name});
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
  const nodes=[], series={};
  Object.keys(byId).forEach(id=>{
    const u=byId[id], p=pathOf(id);
    if(p==null)return;
    const parts=p.split('/');
    nodes.push({id:id,path:p,parent:parts.length>1?parts.slice(0,-1).join('/'):null,level:u.lvl||parts.length,
      name:u.name||'—',sort:0,leaf:false,kids:u.kids,outside:true});
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
      series[p]=u.ser;
      return;
    }
    const own={};
    let any=false;
    COLS.forEach(c=>{
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
      series[dp]=own;
    }
  });
  const baseRow=by('base')[0];
  if(baseRow){
    const b={};
    COLS.forEach(c=>{b[c]=parseArr(baseRow['m_'+c],n)});
    series.BASE=b;
  }

  const pv=invert(PAINT_V), iv=invert(IT_V), sv=invert(STAFF_V);
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
    applied:{paint:one(meta.paint,pv),itSeg:one(meta.it,iv),staffType:one(meta.staff,sv)},
    vals:{paint:pairs(vals.paint),it:pairs(vals.it),staff:pairs(vals.staff)},
    stub:new Set(STUB),
    /* ряд по ключу метрики макета; null — у ключа нет источника (дальше генератор) */
    series(path,key){
      const s=series[path], c=KEY[key];
      return s&&c?s[c]:null;
    },
    hasSeries(path){return !!series[path]},
    lastHc(path){const s=series[path];return s?lastOf(s.hc):0},
    idOf(path){const node=nodeBy[path];return node?node.id:null},
    /* значения фильтров для кросс-фильтра: ключ макета → значение колонки датасета */
    filterValue(kind,key){return ({paint:PAINT_V,itSeg:IT_V,staffType:STAFF_V}[kind]||{})[key]||null}
  };
}

window.TPREAL={build,FIELDS,STUB,PLAN,PAINT_V,IT_V,STAFF_V};
})();

/* ============================================================
   TeamPulse Hub — мок-данные (детерминированный генератор)
   Итерация 1. Контракт см. SPEC.md
   На проде эти структуры приходят из хранилища.
   ============================================================ */

/* ---------- PRNG ---------- */
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rng(seed){return mulberry32(hashStr(seed))}

/* ---------- Периоды: 12 мес (июль 2025 — июнь 2026) ---------- */
const MONTH_ABBR=['янв.','февр.','март','апр.','май','июнь','июль','авг.','сент.','окт.','нояб.','дек.'];
const MONTHS=(function(){
  const seq=[[2025,6],[2025,7],[2025,8],[2025,9],[2025,10],[2025,11],[2026,0],[2026,1],[2026,2],[2026,3],[2026,4],[2026,5]];
  return seq.map(([y,m])=>({y,m,label:MONTH_ABBR[m],isYearStart:m===0}));
})();
const N=MONTHS.length, LAST=N-1;
const PERIOD_LABEL='июль 2025 — июнь 2026';

/* Расширенная сетка: 6 месяцев до окна (янв.–июнь 2025) + сами 12.
   Нужна только для накопительной текучести: YTD июля 2025 считается с января 2025,
   которого в окне нет. Наружу отдаются всегда 12 точек окна. */
const PRE=6;
const MONTHS_EXT=(function(){
  const out=[];
  for(let m=0;m<PRE;m++)out.push({y:2025,m,label:MONTH_ABBR[m],isYearStart:m===0});
  return out.concat(MONTHS);
})();
const NEXT=MONTHS_EXT.length;
/* для каждой точки расширенной сетки — индекс января её календарного года */
const YEAR_START_EXT=MONTHS_EXT.map(function(mm){
  for(let j=0;j<NEXT;j++)if(MONTHS_EXT[j].y===mm.y&&MONTHS_EXT[j].m===0)return j;
  return 0;
});

/* ---------- Блоки ---------- */
const BLOCKS=[
{key:'structure',name:'Структура численности',hint:'Сколько людей в команде и как это меняется.',drillUrl:'#/detail/structure'},
{key:'movement',name:'Движение персонала',hint:'Найм, отток и переводы в команду и из неё.',drillUrl:'#/detail/movement'},
{key:'turnover',name:'Отток и текучесть',hint:'Темпы увольнений и их причины.',drillUrl:'#/detail/turnover'},
{key:'hiring',name:'Найм и вакансии',hint:'Открытые и закрытые вакансии, скорость закрытия.',drillUrl:'#/detail/hiring'},
{key:'tgrowth',name:'T-рост',hint:'Прошли и отказано, конверсия в повышение.',drillUrl:'#/detail/tgrowth'},
{key:'monitor',name:'Мониторинг работы',hint:'Лоу-перформеры и недоработчики.',drillUrl:'#/detail/monitor'},
{key:'office',name:'Посещаемость офисов',hint:'Средняя посещаемость и её динамика.',drillUrl:'#/detail/office'}
];
const BLOCK_BY_KEY=Object.fromEntries(BLOCKS.map(b=>[b.key,b]));

/* ---------- Конфиг метрик ----------
   better: 'lower'|'higher'|'flat'   fmt: 'int'|'pct'|'days'
   kpi: только для метрик с жёстким KPI (сравнение с KPI, а не со средней)
   anchor: базовый уровень по компании на последний месяц (для генерации) */
const METRICS=[
{key:'hc_active',block:'structure',name:'Активная численность',short:'Активные',fmt:'int',better:'flat',unit:'чел',anchor:null,hint:'Сотрудники без длительных отсутствий на конец месяца.'},
{key:'hc_total',block:'structure',name:'Общая численность',short:'Всего',fmt:'int',better:'flat',unit:'чел',anchor:null,hint:'Списочная численность на конец месяца, включая декреты и длительные отсутствия.'},
{key:'hc_avg',block:'structure',name:'Среднесписочная численность',short:'Среднеспис.',fmt:'int',better:'flat',unit:'чел',anchor:null,hint:'Средняя списочная численность за месяц: (начало + конец) / 2. Знаменатель всех расчётов текучести.'},
{key:'hire',block:'movement',name:'Найм',short:'Найм',fmt:'int',better:'flat',unit:'чел',anchor:null,hint:'Принятые за месяц.'},
{key:'attrition',block:'movement',name:'Отток',short:'Отток',fmt:'int',better:'lower',unit:'чел',anchor:null,hint:'Уволившиеся за месяц (все причины).'},
{key:'transfer_in',block:'movement',name:'Переводы в команду',short:'Перев. в',fmt:'int',better:'flat',unit:'чел',anchor:null,hint:'Внутренние переходы из других команд.'},
{key:'transfer_out',block:'movement',name:'Переводы из команды',short:'Перев. из',fmt:'int',better:'flat',unit:'чел',anchor:null,hint:'Внутренние переходы в другие команды.'},
{key:'turnover_m',block:'turnover',name:'Текучесть месячная',short:'Тек. мес',fmt:'pct',better:'lower',unit:'%',anchor:null,
  derived:{num:'attrition',den:'hc_avg',scale:100},hint:'Отток за месяц к среднесписочной численности этого месяца, в процентах.'},
{key:'turnover_y',block:'turnover',name:'Текучесть накопительная',short:'Тек. накоп.',fmt:'pct',better:'lower',unit:'%',anchor:null,
  ytd:'turnover_m',hint:'Сумма месячной текучести с января текущего года. Обнуляется каждый январь и растёт до декабря.'},
{key:'regret',block:'turnover',name:'Regrettable текучесть',short:'Regret',fmt:'pct',better:'lower',unit:'%',anchor:5.1,kpi:{green:4,red:7},hint:'Нежелательные уходы ценных сотрудников. По HQ есть KPI.'},
{key:'vac_open',block:'hiring',name:'Открытые вакансии',short:'Открытые',fmt:'int',better:'flat',unit:'шт',anchor:null,hint:'Вакансии в работе на конец месяца.'},
{key:'vac_closed',block:'hiring',name:'Закрытые вакансии',short:'Закрытые',fmt:'int',better:'higher',unit:'шт',anchor:null,hint:'Вакансии, закрытые за месяц.'},
{key:'time_to_fill',block:'hiring',name:'Срок закрытия вакансии',short:'Time-to-fill',fmt:'days',better:'lower',unit:'дн',anchor:47,hint:'Среднее время от открытия до закрытия вакансии.'},
{key:'tgrowth_pass',block:'tgrowth',name:'Прошли T-рост',short:'Прошли',fmt:'int',better:'higher',unit:'чел',anchor:null,hint:'Сотрудники с положительным решением по T-росту.'},
{key:'tgrowth_deny',block:'tgrowth',name:'Отказано в T-росте',short:'Отказано',fmt:'int',better:'lower',unit:'чел',anchor:null,hint:'Заявки с отрицательным решением.'},
{key:'tgrowth_conv',block:'tgrowth',name:'Конверсия T-роста',short:'Конверсия',fmt:'pct',better:'higher',unit:'%',anchor:68,hint:'Доля положительных решений от всех заявок.'},
{key:'low_perf',block:'monitor',name:'Лоу-перформеры',short:'Лоу-перф',fmt:'pct',better:'lower',unit:'%',anchor:4.2,hint:'Доля сотрудников с низкой результативностью.'},
{key:'underwork',block:'monitor',name:'Недоработчики',short:'Недораб.',fmt:'pct',better:'lower',unit:'%',anchor:6.8,hint:'Доля сотрудников с недоработкой нормы времени.'},
{key:'office_att',block:'office',name:'Посещаемость офиса',short:'Офис',fmt:'pct',better:'higher',unit:'%',anchor:58,hint:'Средняя доля рабочих дней в офисе.'}
];
const METRIC_BY_KEY=Object.fromEntries(METRICS.map(m=>[m.key,m]));
function metricsOfBlock(k){return METRICS.filter(m=>m.block===k)}
const COUNT_METRICS=new Set(['hc_active','hc_total','hc_avg','hire','attrition','transfer_in','transfer_out','vac_open','vac_closed','tgrowth_pass','tgrowth_deny']);

/* ---------- Сравнимость с базой ----------
   Сравниваем только относительные метрики: проценты и сроки.
   Абсолютные счётные с базой не сравниваются: 212 человек против 2 968 по компании —
   это разница масштаба, а не оценка. То же с наймом, вакансиями и T-ростом в штуках.
   Явный cmp:false/true в конфиге метрики перекрывает правило. */
function comparable(key){
  const m=METRIC_BY_KEY[key];if(!m)return false;
  if(m.cmp!=null)return !!m.cmp;
  return !COUNT_METRICS.has(key);
}

/* ---------- Выбор метрик пользователем ----------
   В state лежат СКРЫТЫЕ метрики (`hiddenMetrics`), а не показанные. Так пустой
   список означает «показать всё», и новая метрика в METRICS появляется в отчёте
   сама, а не теряется у тех, кто уже настроил дашборд.

   Две метрики численности выключить нельзя: активная — опора всего отчёта,
   общая — знаменатель долей и подпись «N чел» в каждой строке сводной таблицы.
   Заодно это гарантирует, что блок structure никогда не пустой. */
const LOCKED_METRICS=new Set(['hc_active','hc_total']);

/* Пресеты — только проставляют галочки, дальше набор донастраивается руками.
   `keys:null` — весь список; остальные перечисляют показанные метрики. */
const METRIC_PRESETS=[
{key:'all',name:'Всё',keys:null},
{key:'turnover',name:'Текучесть',keys:['hc_active','hc_total','hc_avg','attrition','turnover_m','turnover_y','regret']},
{key:'hiring',name:'Найм',keys:['hc_active','hc_total','hire','vac_open','vac_closed','time_to_fill']},
{key:'min',name:'Минимум',keys:['hc_active','hc_total','turnover_m','regret']}
];

function hiddenSet(S){
  const h=(S&&S.hiddenMetrics)||[];
  return h instanceof Set?h:new Set(h);
}
/* убирает из списка мусор: неизвестные ключи и попытку скрыть обязательную метрику */
function sanitizeHidden(list){
  return (list||[]).filter(k=>METRIC_BY_KEY[k]&&!LOCKED_METRICS.has(k));
}
function metricVisible(key,S){
  if(LOCKED_METRICS.has(key))return true;
  return !hiddenSet(S).has(key);
}
function visibleMetricsOfBlock(bk,S){return metricsOfBlock(bk).filter(m=>metricVisible(m.key,S))}
/* блок без единой показанной метрики уходит и из OnePager, и из навигации */
function visibleBlocks(S){return BLOCKS.filter(b=>visibleMetricsOfBlock(b.key,S).length>0)}
function blockVisible(bk,S){return visibleMetricsOfBlock(bk,S).length>0}
function visibleCount(S){return METRICS.filter(m=>metricVisible(m.key,S)).length}
function hiddenForPreset(pk){
  const p=METRIC_PRESETS.find(x=>x.key===pk);
  if(!p||!p.keys)return [];
  const keep=new Set(p.keys);
  return sanitizeHidden(METRICS.filter(m=>!keep.has(m.key)).map(m=>m.key));
}
/* какой пресет описывает текущий набор; null — ручная комбинация */
function activePreset(S){
  const cur=sanitizeHidden([...hiddenSet(S)]).sort().join(',');
  const p=METRIC_PRESETS.find(x=>hiddenForPreset(x.key).sort().join(',')===cur);
  return p?p.key:null;
}

/* ---------- Причины увольнений (размерность блока turnover) ---------- */
const EXIT_REASONS=[
{key:'better_offer',name:'Лучшее предложение',share:0.28,regret:true},
{key:'manager',name:'Отношения с руководителем',share:0.14,regret:true},
{key:'no_growth',name:'Нет роста и развития',share:0.17,regret:true},
{key:'burnout',name:'Выгорание и нагрузка',share:0.12,regret:true},
{key:'performance',name:'Не справился с задачами',share:0.11,regret:false},
{key:'relocation',name:'Релокация и личные',share:0.09,regret:false},
{key:'other',name:'Прочее и не заполнено',share:0.09,regret:false}
];

/* ---------- Атрибуты фильтров ---------- */
const PAINTS=[{key:'all',name:'Все покраски',chip:null},{key:'HQ',name:'HQ',chip:'HQ'},{key:'Line',name:'Line',chip:'Line'},{key:'Support',name:'Support',chip:'Support'}];
const ITSEGS=[{key:'all',name:'IT и nonIT',chip:null},{key:'IT',name:'Только IT',chip:'IT'},{key:'nonIT',name:'Только nonIT',chip:'nonIT'}];
const STAFFTYPES=[{key:'all',name:'Штат и не штат',chip:null},{key:'staff',name:'Только штат',chip:'штат'},{key:'nonstaff',name:'Только не штат',chip:'не штат'}];

/* ---------- Оргдерево ----------
   level 1 компания, 2 блок, 3 департамент, 4 управление, 5 отдел, 6 команда (лист) */
const LEVEL_NAME={1:'Компания',2:'Блок',3:'Департамент',4:'Управление',5:'Отдел',6:'Команда'};
const LEVEL_SHORT={2:'Блок',3:'Деп.',4:'Упр.',5:'Отд.',6:'Ком.'};
const MAX_LEVEL=6;
const BLOCK_DEFS=[
{id:'01',name:'Технологические платформы',seg:'IT'},
{id:'02',name:'Розничные продукты',seg:'IT'},
{id:'03',name:'Кредитный конвейер',seg:'IT'},
{id:'04',name:'Платежи и переводы',seg:'IT'},
{id:'05',name:'Данные и ML',seg:'IT'},
{id:'06',name:'Инфраструктура',seg:'IT'},
{id:'07',name:'Клиентский сервис',seg:'nonIT'},
{id:'08',name:'Операционный блок',seg:'nonIT'}
];
/* ---------- Реалистичные названия подразделений ---------- */
const NAME_POOL={
  IT:{
    3:['Мобильная разработка','Веб-платформа','Бэкенд и интеграции','Архитектура решений','Качество и тестирование','Цифровые продукты'],
    4:['Разработка iOS','Разработка Android','Фронтенд-разработка','Сервисы и API','Автоматизация тестирования','Платформенные сервисы','Интеграционная шина','DevOps и релизы'],
    5:['Команда платежей','Команда онбординга','Команда личного кабинета','Команда уведомлений','Команда поиска','Команда каталога','Команда авторизации','Команда отчётности'],
    6:['Группа разработки','Группа поддержки','Группа аналитики','Группа внедрения']
  },
  nonIT:{
    3:['Клиентский сервис','Операционная поддержка','Качество обслуживания','Бизнес-процессы','Сопровождение клиентов','Административный блок'],
    4:['Контакт-центр','Поддержка первой линии','Разбор обращений','Бек-офис операций','Контроль качества','Обучение и методология','Документооборот','Планирование ресурсов'],
    5:['Голосовая поддержка','Текстовые каналы','Премиальный сегмент','Малый бизнес','Рекламации','Верификация','Сверка операций','Сервисный деск'],
    6:['Группа дневной смены','Группа вечерней смены','Группа эскалаций','Группа контроля']
  }
};
const usedNames=new Set();
function pickName(level,seg,path){
  const pool=(NAME_POOL[seg==='nonIT'?'nonIT':'IT'][level])||NAME_POOL.IT[6];
  const r=rng('nm'+path);
  for(let i=0;i<pool.length*3;i++){
    const cand=pool[Math.floor(r()*pool.length)];
    const key=path.split('/').slice(0,-1).join('/')+'|'+cand;
    if(!usedNames.has(key)){usedNames.add(key);return cand}
  }
  return pool[0];
}

const NODES=[];
const ROOT={id:'T',path:'T',parent:null,level:1,name:'Вся компания',sort:0,leaf:false};
NODES.push(ROOT);
let sortCtr=1;
const pad2=n=>String(n).padStart(2,'0');
function nodeCode(path){return path.split('/').slice(1).map(s=>String(parseInt(s,10))).join('.')}

function leafAttrs(path,blockSeg){
  const rp=rng('paint'+path)();
  const paint = rp<0.42?'HQ':(rp<0.78?'Line':'Support');
  const it = blockSeg==='nonIT' ? (rng('it'+path)()<0.18?'IT':'nonIT') : (rng('it'+path)()<0.82?'IT':'nonIT');
  const staff = rng('st'+path)()<0.86?'staff':'nonstaff';
  const gr=rng('gr'+path), tn=rng('tn'+path);
  const gw=[0.10+gr()*0.5,0.55+gr()*0.5,0.40+gr()*0.4,0.10+gr()*0.2];
  const gs=gw.reduce((a,b)=>a+b,0);
  const grades=gw.map(x=>x/gs);
  const tw=[0.25+tn()*0.4,0.45+tn()*0.4,0.30+tn()*0.5];
  const ts=tw.reduce((a,b)=>a+b,0);
  const tenure=tw.map(x=>x/ts);
  return {paint,it,staff,grades,tenure};
}

function genChildren(node,blockSeg){
  if(node.level>=MAX_LEVEL)return;
  const r=rng('br'+node.path);
  const nc = node.level===2?3+Math.floor(r()*2) : node.level===3?2+Math.floor(r()*2) : 2;
  for(let i=0;i<nc;i++){
    const cp=node.path+'/'+pad2(i+1), cl=node.level+1;
    let isLeaf = cl>=MAX_LEVEL ? true : (cl>=4 && rng('leaf'+cp)()<0.35);
    const cn={id:cp,path:cp,parent:node.path,level:cl,name:pickName(cl,blockSeg,cp),sort:sortCtr++,leaf:isLeaf};
    if(isLeaf)Object.assign(cn,leafAttrs(cp,blockSeg));
    NODES.push(cn);
    if(!isLeaf)genChildren(cn,blockSeg);
  }
}
BLOCK_DEFS.forEach(b=>{
  const bp='T/'+b.id;
  const bn={id:b.id,path:bp,parent:'T',level:2,name:b.name,sort:sortCtr++,leaf:false,seg:b.seg};
  NODES.push(bn);
  genChildren(bn,b.seg);
});
const NODE_BY_PATH=Object.fromEntries(NODES.map(n=>[n.path,n]));
function childrenOf(p){return NODES.filter(n=>n.parent===p).sort((a,b)=>a.sort-b.sort)}
function descendantsOf(p){return NODES.filter(n=>n.path===p||n.path.startsWith(p+'/'))}
function leavesUnder(p){return descendantsOf(p).filter(n=>n.leaf)}
function ancestorsOf(p){const seg=p.split('/');const out=[];for(let i=1;i<=seg.length;i++){const q=seg.slice(0,i).join('/');if(NODE_BY_PATH[q])out.push(NODE_BY_PATH[q])}return out}
function levelLabel(l){return LEVEL_NAME[l]||('ур. '+l)}
/* узлы уровня -1 / -2 от выбранного; если детей нет — сам узел */
function nodesBelow(path,depth){
  let cur=[NODE_BY_PATH[path]];
  for(let d=0;d<depth;d++){
    const next=[];
    cur.forEach(n=>{const k=childrenOf(n.path);next.push(...(k.length?k:[n]))});
    cur=[...new Map(next.map(n=>[n.path,n])).values()];
  }
  return cur.sort((a,b)=>a.sort-b.sort);
}

/* ---------- Фильтр листьев ---------- */
function leafPasses(leafPath,st){
  const n=NODE_BY_PATH[leafPath];if(!n||!n.leaf)return false;
  if(st.paint!=='all'&&n.paint!==st.paint)return false;
  if(st.itSeg!=='all'&&n.it!==st.itSeg)return false;
  if(st.staffType!=='all'&&n.staff!==st.staffType)return false;
  return true;
}
/* популяция отчёта: подразделение + атрибуты */
function reportLeaves(st){return leavesUnder(st.drillRoot||st.unit).map(l=>l.path).filter(p=>leafPasses(p,st))}
/* ГЛАВНОЕ ПРАВИЛО: база сравнения = те же атрибуты, вся компания */
function benchmarkLeaves(st){return leavesUnder('T').map(l=>l.path).filter(p=>leafPasses(p,st))}
function benchmarkLabel(st){
  const parts=[];
  if(st.paint!=='all')parts.push(st.paint);
  if(st.itSeg!=='all')parts.push(st.itSeg);
  if(st.staffType!=='all')parts.push(st.staffType==='staff'?'штат':'не штат');
  return parts.length?('всё '+parts.join(' ')):'вся компания';
}
function filterChips(st){
  const out=[];
  if(st.paint!=='all')out.push({k:'paint',label:st.paint});
  if(st.itSeg!=='all')out.push({k:'itSeg',label:st.itSeg});
  if(st.staffType!=='all')out.push({k:'staffType',label:st.staffType==='staff'?'штат':'не штат'});
  return out;
}

/* ---------- Ряды по листу ---------- */
const _sc={};
function leafBase(leafPath){
  if(_sc['b'+leafPath])return _sc['b'+leafPath];
  const r=rng('base'+leafPath);
  /* vol — «характер» команды: у одних ровно, у других рвано. Разброс нужен,
     чтобы месячную текучесть было с чем сравнивать между подразделениями. */
  const v={hc:14+Math.floor(r()*46), lvl:r(), vol:0.55+r()*1.5};
  _sc['b'+leafPath]=v;return v;
}
function wave(seed,i,amp){return Math.sin((hashStr(seed)%100)/16+i/2.1)*amp}

/* Сезонность по календарному месяцу: увольнения пикуют после годовой премии
   (февраль–март) и в сентябре, проваливаются в декабре; найм — зеркально. */
const SEAS_ATTR=[0.95,1.36,1.28,1.06,0.86,1.00,1.14,1.04,1.18,0.98,0.86,0.70];
const SEAS_HIRE=[0.82,1.12,1.24,1.16,0.96,0.90,0.76,0.94,1.28,1.20,1.04,0.66];

/* Расширенный ряд на 18 точек — внутренняя кухня для накопительной текучести.
   Наружу через metricSeries отдаются только 12 точек окна. */
function seriesExt(leafPath,key){
  const ck='x|'+leafPath+'|'+key;
  if(_sc[ck])return _sc[ck];
  const m=METRIC_BY_KEY[key]||{}, b=leafBase(leafPath), n=NODE_BY_PATH[leafPath]||{};
  const out=new Array(NEXT);

  /* среднесписочная: полусумма численности на начало и конец месяца */
  if(key==='hc_avg'){
    const t=seriesExt(leafPath,'hc_total');
    for(let i=0;i<NEXT;i++)out[i]=+(((i?t[i-1]:t[0])+t[i])/2).toFixed(1);
    _sc[ck]=out;return out;
  }
  /* производная метрика: числитель / знаменатель (текучесть месячная) */
  if(m.derived){
    const num=seriesExt(leafPath,m.derived.num), den=seriesExt(leafPath,m.derived.den);
    for(let i=0;i<NEXT;i++)out[i]=den[i]?+((num[i]/den[i])*(m.derived.scale||1)).toFixed(2):0;
    _sc[ck]=out;return out;
  }
  /* накопительная с начала календарного года (текучесть годовая) */
  if(m.ytd){
    const src=seriesExt(leafPath,m.ytd);
    for(let i=0;i<NEXT;i++){let s=0;for(let j=YEAR_START_EXT[i];j<=i;j++)s+=src[j];out[i]=+s.toFixed(2)}
    _sc[ck]=out;return out;
  }

  const r=rng('ser'+leafPath+key);
  /* Счётная метрика: ожидание = численность × месячная ставка × сезонность × «рваность».
     Округление стохастическое (floor(x + случайное)) — оно сохраняет среднее на длинном
     ряде, тогда как Math.round систематически завышает малые величины.
     Ставки месячные: отток ~1,0–1,9% — это 13–23% годовых, живой корпоративный диапазон. */
  const cg=function(rate,seas,amp,seed,i){
    const f=Math.max(0.12,1+wave(seed,i,amp*b.vol)+(r()-0.5)*amp*b.vol);
    return Math.max(0,Math.floor(b.hc*rate*seas*f+r()));
  };
  for(let i=0;i<NEXT;i++){
    const cm=MONTHS_EXT[i].m, vol=b.vol;
    const trend=(i-(NEXT-1)/2)/(NEXT-1);
    let v;
    if(key==='hc_total'){ v=Math.max(3,Math.round(b.hc*(1+trend*0.07)+wave(leafPath,i,1.5*vol)+(r()-0.5)*1.6*vol)); }
    else if(key==='hc_active'){ v=Math.max(2,Math.round(seriesExt(leafPath,'hc_total')[i]*(0.88+r()*0.09))); }
    else if(key==='hire'){ v=cg(0.0135+b.lvl*0.0075,SEAS_HIRE[cm],0.60,leafPath+'h',i); }
    else if(key==='attrition'){ v=cg(0.0100+b.lvl*0.0090,SEAS_ATTR[cm],0.55,leafPath+'a',i); }
    else if(key==='transfer_in'){ v=cg(0.0060,1,0.70,leafPath+'ti',i); }
    else if(key==='transfer_out'){ v=cg(0.0065,1,0.70,leafPath+'to',i); }
    else if(key==='vac_open'){ v=cg(0.0420,1,0.45,leafPath+'vo',i); }
    else if(key==='vac_closed'){ v=cg(0.0140,SEAS_HIRE[cm],0.65,leafPath+'vc',i); }
    else if(key==='tgrowth_pass'){ v=cg(0.0090,1,0.75,leafPath+'tp',i); }
    else if(key==='tgrowth_deny'){ v=cg(0.0045,1,0.85,leafPath+'td',i); }
    else {
      const a=m.anchor||10;
      const skew=(b.lvl-0.5)*a*0.55 + (n.paint==='HQ'?-a*0.06:n.paint==='Line'?a*0.08:0) + (n.it==='nonIT'?a*0.05:0);
      v=Math.max(0,+(a+skew+wave(leafPath+key,i,a*0.17*vol)+(r()-0.5)*a*0.13*vol).toFixed(1));
    }
    out[i]=v;
  }
  _sc[ck]=out;return out;
}

/* публичный ряд — всегда 12 точек окна */
function metricSeries(leafPath,key){
  const ck='s|'+leafPath+'|'+key;
  if(_sc[ck])return _sc[ck];
  const out=seriesExt(leafPath,key).slice(PRE);
  _sc[ck]=out;return out;
}

/* причины увольнений: раскладка attrition по реасонам */
function reasonSeries(leafPaths,reasonKey){
  const total=aggregate(leafPaths,'attrition');
  const rs=EXIT_REASONS.find(x=>x.key===reasonKey);
  const r=rng('rs'+reasonKey);
  return total.map((t,i)=>Math.max(0,Math.round(t*rs.share*(0.82+r()*0.36))));
}

/* ---------- Агрегация с кешем ---------- */
const _ac=new Map();
/* Агрегация на расширенной сетке (18 точек).
   Производные метрики считаются как сумма числителей / сумма знаменателей —
   это точная групповая текучесть, а не среднее из процентов по листьям.
   Накопительные суммируются из уже агрегированной месячной. */
function aggregateExt(leafPaths,key){
  if(!leafPaths.length)return new Array(NEXT).fill(0);
  const ck='x'+key+'#'+leafPaths.length+'#'+hashStr(leafPaths.join(','));
  if(_ac.has(ck))return _ac.get(ck);
  const m=METRIC_BY_KEY[key]||{};
  const out=new Array(NEXT).fill(0);
  if(m.derived){
    const num=aggregateExt(leafPaths,m.derived.num), den=aggregateExt(leafPaths,m.derived.den);
    for(let i=0;i<NEXT;i++)out[i]=den[i]?+((num[i]/den[i])*(m.derived.scale||1)).toFixed(2):0;
  } else if(m.ytd){
    const src=aggregateExt(leafPaths,m.ytd);
    for(let i=0;i<NEXT;i++){let s=0;for(let j=YEAR_START_EXT[i];j<=i;j++)s+=src[j];out[i]=+s.toFixed(2)}
  } else if(COUNT_METRICS.has(key)){
    for(let i=0;i<NEXT;i++){let s=0;leafPaths.forEach(p=>{s+=seriesExt(p,key)[i]});out[i]=+s.toFixed(1)}
  } else {
    for(let i=0;i<NEXT;i++){
      let num=0,den=0;
      leafPaths.forEach(p=>{const w=seriesExt(p,'hc_total')[i];num+=seriesExt(p,key)[i]*w;den+=w});
      out[i]=den?+(num/den).toFixed(1):0;
    }
  }
  _ac.set(ck,out);return out;
}
function aggregate(leafPaths,key){
  if(!leafPaths.length)return new Array(N).fill(0);
  const ck=key+'#'+leafPaths.length+'#'+hashStr(leafPaths.join(','));
  if(_ac.has(ck))return _ac.get(ck);
  const out=aggregateExt(leafPaths,key).slice(PRE);
  _ac.set(ck,out);return out;
}
function lastVal(leafPaths,key){return aggregate(leafPaths,key)[LAST]}

/* ---------- Сравнение и светофор ---------- */
function deltas(series){
  const cur=series[LAST];
  return {mom:+(cur-series[LAST-1]).toFixed(1), yoy:+(cur-series[0]).toFixed(1)};
}
/* Настоящий YoY: последний месяц окна против того же месяца год назад.
   Берётся с расширенной сетки — июнь 2026 против июня 2025, а не против июля 2025.
   Для накопительной текучести это единственный осмысленный вариант: сравнивать
   июньский YTD с июльским YTD прошлого года бессмысленно, там разное число месяцев. */
function deltasOf(leafPaths,key){
  const e=aggregateExt(leafPaths,key), i=NEXT-1;
  return {mom:+(e[i]-e[i-1]).toFixed(2), yoy:+(e[i]-e[i-12]).toFixed(2)};
}
/* отклонение от базы — в светофор с мёртвой зоной 5% */
function compareState(key,val,base){
  const m=METRIC_BY_KEY[key];
  if(base==null||!base)return'neutral';
  if(!comparable(key))return'neutral';
  if(m.better==='flat')return'neutral';
  const rel=(val-base)/Math.abs(base);
  if(Math.abs(rel)<0.05)return'warn';
  const good=m.better==='lower'?rel<0:rel>0;
  return good?'good':'bad';
}
function stateForKpi(key,val,kpi){
  const m=METRIC_BY_KEY[key];if(!kpi)return'neutral';
  if(m.better==='lower')return val<=kpi.green?'good':(val>=kpi.red?'bad':'warn');
  return val>=kpi.green?'good':(val<=kpi.red?'bad':'warn');
}
/* есть ли у метрики жёсткий KPI в текущей настройке (regret — только по HQ) */
function kpiFor(key,st){
  const m=METRIC_BY_KEY[key];
  if(!m.kpi)return null;
  if(key==='regret'&&st.paint!=='HQ')return null;
  return m.kpi;
}

/* ---------- Форматирование ---------- */
function fmtInt(v){return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'\u2009')}
function fmtVal(key,v){
  if(v==null)return'—';
  const m=METRIC_BY_KEY[key];if(!m)return String(v);
  if(m.fmt==='int')return fmtInt(v);
  if(m.fmt==='days')return (+v).toFixed(0).replace('.',',')+'\u2009дн';
  return (+v).toFixed(1).replace('.',',')+'%';
}
function fmtDelta(key,v){
  const m=METRIC_BY_KEY[key];if(v==null)return'—';
  const s=v>0?'+':'';
  if(m.fmt==='int')return s+fmtInt(v);
  if(m.fmt==='days')return s+(+v).toFixed(0)+'\u2009дн';
  return s+(+v).toFixed(1).replace('.',',')+'\u2009п.п.';
}
function fmtCompact(v){return Math.abs(v)>=1000?(v/1000).toFixed(1).replace('.',',')+'K':fmtInt(v)}

/* ---------- Дефолтный state ---------- */
const DEFAULT_STATE={unit:'T/01',paint:'HQ',itSeg:'all',staffType:'all',period:PERIOD_LABEL,
  tab:'onepager',subTab:null,drillRoot:null,selNode:null,aiOpen:false,
  /* скрытые пользователем метрики; пусто = показаны все */
  hiddenMetrics:[]};

/* ---------- Разрезы состава численности ---------- */
const GRADES=[{key:'j',name:'Junior',color:'#a8c4ea'},{key:'m',name:'Middle',color:'#7fa8dd'},
              {key:'s',name:'Senior',color:'#5f86c2'},{key:'l',name:'Lead и выше',color:'#3f5e93'}];
const TENURES=[{key:'t0',name:'До 1 года',color:'#cdbf97'},{key:'t1',name:'1–3 года',color:'#9fae6a'},
               {key:'t3',name:'Больше 3 лет',color:'#5f9d8a'}];
const STAFFMIX=[{key:'staff',name:'Штат',color:'#5f86c2'},{key:'nonstaff',name:'Не штат',color:'#cdbf97'}];

/* состав группы листьев по выбранному разрезу: возвращает массив человек по категориям */
/* lp — массив ПУТЕЙ листьев, а атрибуты лежат на узле: без разыменования
   через NODE_BY_PATH все доли выходили равными, а «штат» весь падал в «не штат». */
function mixParts(lp,dim){
  const cats=dim==='grade'?GRADES:dim==='tenure'?TENURES:STAFFMIX;
  const out=cats.map(()=>0);
  lp.forEach(p=>{
    const n=NODE_BY_PATH[p]||{};
    const hc=lastVal([p],'hc_total');
    if(dim==='staff'){ out[n.staff==='staff'?0:1]+=hc; return }
    const w=dim==='grade'?n.grades:n.tenure;
    cats.forEach((c,i)=>{out[i]+=hc*(w?w[i]:1/cats.length)});
  });
  return out.map(x=>Math.round(x));
}
function mixCats(dim){return dim==='grade'?GRADES:dim==='tenure'?TENURES:STAFFMIX}

/* ---------- Посещаемость офисов: подневно, по дням недели, по офисам ----------
   ВАЖНО: ни подневных отметок, ни привязки людей к офисам в модели нет — здесь
   они выдуманы так же, как коэффициенты воронки найма. Соблюдается строго одно:
   среднее по будням календаря равно метрике `office_att` за тот же месяц. Иначе
   календарь и линия динамики противоречили бы друг другу на соседних вкладках.
   При подключении к хранилищу это первое, что заменяется фактами. */
const OFFICES=[
{key:'msk-vs',name:'Водный стадион',city:'Москва'},
{key:'msk-gv',name:'Грузинский вал',city:'Москва'},
{key:'spb-nv',name:'Невский',city:'Санкт-Петербург'},
{key:'ekb-rd',name:'Радищева',city:'Екатеринбург'},
{key:'kzn-pf',name:'Профсоюзная',city:'Казань'},
{key:'nng-rd',name:'Родионова',city:'Нижний Новгород'}
];
const DOW_NAME=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const DOW_SHORT=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
/* родительный падеж — только для подсказок вида «15 июня 2026, понедельник» */
const MONTH_GEN=['января','февраля','марта','апреля','мая','июня','июля','августа',
                 'сентября','октября','ноября','декабря'];
const CAL_MONTH=LAST;              /* календарь строится за последний месяц окна */
const DOW_MONTHS=3;                /* дни недели усредняем за 3 месяца: по одному выборка коротка */

function lpSeed(lp,salt){return 'off'+salt+'#'+lp.length+'#'+hashStr(lp.join(','))}

/* Подневная посещаемость за месяц mIdx.
   dow: 0 = понедельник … 6 = воскресенье (getDay() отдаёт неделю с воскресенья). */
function attDays(lp,mIdx){
  mIdx=mIdx==null?CAL_MONTH:mIdx;
  const mm=MONTHS[mIdx], base=lp.length?aggregate(lp,'office_att')[mIdx]:0;
  const nd=new Date(mm.y,mm.m+1,0).getDate();
  const r=rng(lpSeed(lp,'day'+mIdx));
  /* профиль недели: ядро вторник–четверг, пятница самая пустая */
  const SHAPE=[0.96,1.09,1.12,1.03,0.80];
  const days=[];
  for(let d=1;d<=nd;d++){
    const dow=(new Date(mm.y,mm.m,d).getDay()+6)%7, we=dow>=5;
    days.push({day:d,dow:dow,weekend:we,k:we?0.05+r()*0.09:SHAPE[dow]*(0.9+r()*0.2)});
  }
  /* нормировка будней: их среднее обязано совпасть с office_att этого месяца */
  const wd=days.filter(x=>!x.weekend), mean=wd.reduce((a,x)=>a+x.k,0)/(wd.length||1);
  days.forEach(x=>{x.val=+(x.weekend?base*x.k:base*x.k/mean).toFixed(1);delete x.k});
  return {y:mm.y,m:mm.m,label:mm.label,base:base,
    first:(new Date(mm.y,mm.m,1).getDay()+6)%7,days:days};
}

/* ---------- Последние CAL_DAYS дней, разложенные по месяцам ----------
   Календарь показывает не «текущий месяц», а скользящее окно: месяц второго
   числа — это два дня и ноль смысла. Окно почти всегда пересекает границу
   месяцев, поэтому наружу отдаётся МАССИВ блоков, по одному на затронутый
   месяц; экран рисует их сетками рядом. Если окно уложилось в один месяц,
   блок будет один — отдельного случая в коде для этого нет.

   Каждый блок несёт `first` — день недели своего ПЕРВОГО попавшего в окно дня,
   а не первого числа месяца: сетка должна начинаться с той колонки, где день
   реально стоит в неделе.

   Конец окна — CAL_TODAY, «сегодня» отчёта. */
const CAL_DAYS=30;
/* «Сегодня» макета — число последнего месяца периода, по которое есть подневные
   данные. В проде это вчерашняя дата, и последний месяц почти всегда неполный:
   ровно ради этого случая календарь и стал скользящим окном.

   Здесь дата зафиксирована серединой месяца, иначе двухмесячная раскладка
   никогда бы не показалась: период заканчивается 30 июня, в июне ровно 30 дней,
   и окно совпало бы с месяцем — то есть выглядело бы точно как прежний
   «календарный месяц», а смысл правки пропал бы.

   ДОПУЩЕНИЕ: месячные метрики июня при этом остаются полными — генератор считает
   их по месяцу целиком. Подневный слой и месячный расходятся на этом ровно так же,
   как расходятся воронка найма и реальные этапы: это макет, и в UI сказано. */
const CAL_TODAY=15;
function attLast(lp,n){
  n=n||CAL_DAYS;
  const out=[];
  let need=n, mIdx=LAST;
  let to=Math.min(CAL_TODAY,new Date(MONTHS[LAST].y,MONTHS[LAST].m+1,0).getDate());
  while(need>0&&mIdx>=0){
    const blk=attDays(lp,mIdx);
    const take=Math.min(need,to);
    const from=to-take+1;
    const days=blk.days.filter(d=>d.day>=from&&d.day<=to);
    out.unshift({y:blk.y,m:blk.m,label:blk.label,base:blk.base,
      from:from,to:to,full:from===1&&to===blk.days.length,
      first:days.length?days[0].dow:0,days:days});
    need-=take; mIdx--;
    if(mIdx>=0)to=new Date(MONTHS[mIdx].y,MONTHS[mIdx].m+1,0).getDate();
  }
  return out;
}

/* Среднее по дням недели за последние DOW_MONTHS месяцев */
function attByDow(lp,months){
  months=months||DOW_MONTHS;
  const acc=DOW_NAME.map(()=>({s:0,n:0}));
  for(let i=Math.max(0,LAST-months+1);i<=LAST;i++){
    attDays(lp,i).days.forEach(d=>{acc[d.dow].s+=d.val;acc[d.dow].n++});
  }
  return acc.map((a,i)=>({name:DOW_NAME[i],value:a.n?+(a.s/a.n).toFixed(1):0,weekend:i>=5}));
}

/* Рейтинг офисов: доли людей и посещаемость по офису выдуманы, но численность
   в сумме равна численности отбора — иначе таблица спорила бы с KPI-карточкой. */
function officeRank(lp){
  const r=rng(lpSeed(lp,'rank'));
  const hc=lastVal(lp,'hc_total'), base=lastVal(lp,'office_att');
  const w=OFFICES.map(()=>0.4+r()*1.6), sw=w.reduce((a,x)=>a+x,0);
  let left=hc;
  const rows=OFFICES.map((o,i)=>{
    const last=i===OFFICES.length-1;
    const people=last?Math.max(0,left):Math.min(left,Math.round(hc*(w[i]/sw)));
    left-=people;
    return {key:o.key,name:o.name,city:o.city,hc:people,
      att:+Math.max(12,Math.min(96,base*(0.72+r()*0.6))).toFixed(1)};
  });
  return rows.filter(x=>x.hc>0).sort((a,b)=>b.att-a.att);
}

/* итоговый прирост численности за период */
function netGrowth(lp){
  const hc=aggregate(lp,'hc_total');
  return hc[LAST]-hc[0];
}

window.TPDATA={GRADES,TENURES,STAFFMIX,mixParts,mixCats,netGrowth,MONTHS,N,LAST,PERIOD_LABEL,BLOCKS,BLOCK_BY_KEY,METRICS,METRIC_BY_KEY,metricsOfBlock,
  OFFICES,DOW_NAME,DOW_SHORT,MONTH_GEN,CAL_MONTH,CAL_DAYS,CAL_TODAY,DOW_MONTHS,
  attDays,attLast,attByDow,officeRank,
  COUNT_METRICS,EXIT_REASONS,PAINTS,ITSEGS,STAFFTYPES,NODES,NODE_BY_PATH,ROOT,LEVEL_NAME,LEVEL_SHORT,
  childrenOf,descendantsOf,leavesUnder,ancestorsOf,levelLabel,nodesBelow,
  leafPasses,reportLeaves,benchmarkLeaves,benchmarkLabel,filterChips,
  metricSeries,reasonSeries,aggregate,lastVal,deltas,deltasOf,compareState,stateForKpi,kpiFor,comparable,
  LOCKED_METRICS,METRIC_PRESETS,sanitizeHidden,metricVisible,visibleMetricsOfBlock,visibleBlocks,
  blockVisible,visibleCount,hiddenForPreset,activePreset,
  fmtInt,fmtVal,fmtDelta,fmtCompact,DEFAULT_STATE,
  PRE,NEXT,MONTHS_EXT,YEAR_START_EXT,seriesExt,aggregateExt};

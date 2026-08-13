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

/* ---------- С чем сравнивается изменение ----------
   MoM и YoY — это конкретные два месяца, а не абстрактное «за месяц». Пока
   в интерфейсе стояло просто «+3», приходилось догадываться, относительно
   чего: базы сравнения, начала периода или прошлого месяца. Подписи собираются
   здесь, чтобы во всех местах отчёта стоял один и тот же месяц.
   Дательный падеж — для «к маю», именительный — для заголовков и подсказок. */
const MONTH_DAT=['январю','февралю','марту','апрелю','маю','июню','июлю','августу',
                 'сентябрю','октябрю','ноябрю','декабрю'];
/* родительный падеж — подсказки календаря («15 июня 2026, понедельник») и
   изменения («июнь 2026 против мая 2026») */
const MONTH_GEN=['января','февраля','марта','апреля','мая','июня','июля','августа',
                 'сентября','октября','ноября','декабря'];
const MONTH_NOM=['январь','февраль','март','апрель','май','июнь','июль','август',
                 'сентябрь','октябрь','ноябрь','декабрь'];
const CUR_M=MONTHS[LAST], PREV_M=MONTHS[LAST-1];
const YOY_M={y:CUR_M.y-1,m:CUR_M.m};                      /* тот же месяц год назад */
function monthNom(mm){return MONTH_NOM[mm.m]+' '+mm.y}    /* «июнь 2026» */
function monthGen(mm){return MONTH_GEN[mm.m]+' '+mm.y}    /* «июня 2026» */
const CMP={
  cur:monthNom(CUR_M),
  /* короткая подпись стоит прямо в пилюле изменения, полная — в шапках колонок */
  momShort:'к '+MONTH_DAT[PREV_M.m],
  momFull:'к '+MONTH_DAT[PREV_M.m]+' '+PREV_M.y,
  /* у года год обязателен и в короткой подписи: «к июню» читалось бы как MoM */
  yoy:'к '+MONTH_DAT[YOY_M.m]+' '+YOY_M.y,
  momTip:{title:'Изменение за месяц',
    text:monthNom(CUR_M)+' против '+monthGen(PREV_M)+'. Не отклонение от базы сравнения: '+
      'база стоит отдельной строкой в карточке.'},
  yoyTip:{title:'Изменение за год',
    text:monthNom(CUR_M)+' против '+monthGen(YOY_M)+' — тот же месяц год назад, а не начало периода.'}
};

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
/* База «с начала года» для метрик вида ytdDelta: численность на 31 декабря —
   это значение ПРЕДЫДУЩЕГО месяца перед январём. Для первой половины окна
   (июль–декабрь 2025) декабрь 2024 в сетку не попадает, и базой служит первая
   точка сетки; на последний месяц окна, по которому читаются KPI-карточки,
   это не влияет — там база честный декабрь 2025. */
function ytdBase(i){const j=YEAR_START_EXT[i];return j>0?j-1:0}

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
/* Среднесписочная численность в списке метрик не стоит: как строка отчёта она
   ничего не сообщала руководителю (это всегда полусумма двух соседних значений
   численности), а место в таблице и карточку занимала. Ряд `hc_avg` остался —
   он знаменатель текучести и считается в seriesExt по ключу. */
{key:'hire',block:'movement',name:'Найм',short:'Найм',fmt:'int',better:'flat',unit:'чел',anchor:null,hint:'Принятые за месяц.'},
{key:'attrition',block:'movement',name:'Отток',short:'Отток',fmt:'int',better:'lower',unit:'чел',anchor:null,hint:'Уволившиеся за месяц (все причины).'},
{key:'transfer_in',block:'movement',name:'Переводы в команду',short:'Перев. в',fmt:'int',better:'flat',unit:'чел',anchor:null,hint:'Внутренние переходы из других команд.'},
{key:'transfer_out',block:'movement',name:'Переводы из команды',short:'Перев. из',fmt:'int',better:'flat',unit:'чел',anchor:null,hint:'Внутренние переходы в другие команды.'},
/* Итог движения персонала: найм + переводы в − отток − переводы из за вычетом
   прочих изменений. Пять потоков без итога не отвечали на вопрос «команда
   выросла или нет» — считать в уме четыре числа приходилось самому. */
/* short'ы блока движения держим короткими намеренно: колонок в сводной таблице
   стало пять, и «Прирост с НГ» отправлял последнюю колонку под горизонтальный
   скролл на ноутбучной ширине. Полное имя и пояснение живут в подсказке шапки. */
{key:'net_ytd',block:'movement',name:'Прирост с начала года',short:'Прирост',fmt:'int',better:'flat',unit:'чел',anchor:null,
  ytdDelta:'hc_total',hint:'Изменение общей численности с начала календарного года: значение на конец месяца минус численность на 31 декабря.'},
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
/* hc_avg метрикой отчёта не является, но в этом наборе остаётся: он управляет
   не только сравнимостью, но и способом агрегации (сумма, а не среднее). */
const COUNT_METRICS=new Set(['hc_active','hc_total','hc_avg','hire','attrition','transfer_in','transfer_out','net_ytd','vac_open','vac_closed','tgrowth_pass','tgrowth_deny']);

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
{key:'turnover',name:'Текучесть',keys:['hc_active','hc_total','attrition','turnover_m','turnover_y','regret']},
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
  /* Доли по разрезам состава здесь больше не считаются: их выдаёт mixWeights
     лениво и по одному ключу разреза. Держать девять векторов на каждом листе
     ради трёх таблиц, которые рисуются за рендер, незачем — да и список
     разрезов теперь живёт в MIX_DIMS, а не в полях узла. */
  return {paint,it,staff};
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
  /* прирост с начала года: значение месяца минус значение на 31 декабря */
  if(m.ytdDelta){
    const src=seriesExt(leafPath,m.ytdDelta);
    for(let i=0;i<NEXT;i++)out[i]=+(src[i]-src[ytdBase(i)]).toFixed(1);
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
  } else if(m.ytdDelta){
    /* считается из уже агрегированного ряда, а не суммой по листьям: результат
       тот же (разность линейна), но без прохода по всем листьям дважды */
    const src=aggregateExt(leafPaths,m.ytdDelta);
    for(let i=0;i<NEXT;i++)out[i]=+(src[i]-src[ytdBase(i)]).toFixed(1);
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
/* минус типографский: у «Прироста с начала года» значение бывает отрицательным,
   и дефис рядом с плюсом в соседней пилюле выглядит короче и ниже */
function fmtInt(v){return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'\u2009').replace('-','\u2212')}
function fmtVal(key,v){
  if(v==null)return'—';
  const m=METRIC_BY_KEY[key];if(!m)return String(v);
  if(m.fmt==='int')return fmtInt(v);
  if(m.fmt==='days')return (+v).toFixed(0).replace('.',',')+'\u2009дн';
  return (+v).toFixed(1).replace('.',',')+'%';
}
/* Минус во всех дельтах типографский. Раньше его подставлял только deltaChip,
   а пилюля «К базе» в сводной таблице, которая зовёт fmtDelta напрямую,
   оставалась с дефисом: два соседних элемента одного экрана писали минус по-разному. */
function fmtDelta(key,v){
  const m=METRIC_BY_KEY[key];if(v==null)return'—';
  const s=v>0?'+':'';
  if(m.fmt==='int')return s+fmtInt(v);
  if(m.fmt==='days')return s+(+v).toFixed(0).replace('-','\u2212')+'\u2009дн';
  return s+(+v).toFixed(1).replace('.',',').replace('-','\u2212')+'\u2009п.п.';
}
function fmtCompact(v){return Math.abs(v)>=1000?(v/1000).toFixed(1).replace('.',',')+'K':fmtInt(v)}

/* ---------- Дефолтный state ---------- */
const DEFAULT_STATE={unit:'T/01',paint:'HQ',itSeg:'all',staffType:'all',period:PERIOD_LABEL,
  tab:'onepager',subTab:null,drillRoot:null,selNode:null,aiOpen:false,
  /* скрытые пользователем метрики; пусто = показаны все */
  hiddenMetrics:[],
  /* срез состава: не больше SLICE_MAX категорий, по одной на разрез */
  mixSel:[],
  /* оси конструктора «Свой срез» и содержимое ячейки */
  mixRows:'seniority',mixCols:'gender',mixMode:'abs'};

/* ============================================================================
   Разрезы состава численности

   Разрезов девять, и это список, а не набор веток в if: атрибуты в HR-борде
   заводятся постоянно (юрлицо, формат работы, стрим), и каждый новый не должен
   означать правку разбивки, матрицы, конструктора и среза по отдельности.
   Экран берёт разрезы группами (MIX_GROUPS), конструктор — всем списком.

   ГРЕЙД И СЕНЬОРНОСТЬ — РАЗНЫЕ ВЕЩИ. Грейд — числовой уровень должности,
   сеньорность — текстовый уровень специалиста. Связаны, но не совпадают:
   Senior на третьем грейде и Senior на четвёртом — обычное дело. Поэтому
   разреза два, а не один, и связь между ними задана явно (GRADE_BY_SEN).

   Шкалы: у порядковых разрезов (грейд, сеньорность, стаж, возраст) — одна
   последовательная шкала светлое→тёмное, порядок обязан читаться. У номинальных
   (пол, юрлицо, стрим, формат, занятость) — различимые тона: порядка у них нет,
   и градиент врал бы про него.
   ========================================================================== */
/* ---------- Цвет: ОДИН НА ГРУППУ РАЗРЕЗОВ, а не на категорию ----------
   Внутри одной разбивки все полосы одного цвета. Величину несёт длина полосы,
   и раскрашивать строки в разные цвета — значит кодировать одно и то же дважды:
   цвет начинает выглядеть смыслом, которого в нём нет. Формулировка заказчика:
   «разница между барчартами зашита в длину, поэтому цвета мы не меняем».

   Цвет при этом не пропадает, а меняет работу: он различает ГРУППЫ разрезов.
   Квалификация синяя, люди лиловые, оформление песочное, стримы зелёные —
   на какой вкладке стоишь, видно по цвету полос, не читая заголовок. В своём
   срезе полоса красится по группе выбранного разреза, поэтому цвет остаётся
   признаком семьи атрибута и там. */
const MIX_GROUP_COLOR={qual:'#5f86c2',people:'#8b8fc0',contract:'#cdbf97',stream:'#5f9d8a'};
const MIX_COLOR_DEF='#5f86c2';
function dimColor(dimKey){
  const d=MIX_BY_KEY[dimKey];
  return (d&&MIX_GROUP_COLOR[d.group])||MIX_COLOR_DEF;
}

/* Сеньорность → грейд. Строка — сеньорность, столбец — грейд, сумма строки 1.
   Без этой таблицы грейд бросался бы независимо, и матрица «грейд × сеньорность»
   показала бы Junior на пятом грейде — то есть ровно то, ради чего заказчик
   и просил развести два разреза. */
const GRADE_BY_SEN=[
  [0.55,0.40,0.05,0.00,0.00],   /* Junior      */
  [0.05,0.45,0.42,0.08,0.00],   /* Middle      */
  [0.00,0.06,0.44,0.42,0.08],   /* Senior      */
  [0.00,0.00,0.10,0.45,0.45]    /* Lead и выше */
];

const MIX_DIMS=[
{key:'grade',name:'Грейд',short:'Грейд',ord:true,group:'qual',
 hint:'Числовой уровень должности. Не то же самое, что сеньорность: она про уровень специалиста, грейд — про позицию в системе грейдов.',
 cats:[{key:'g1',name:'Грейд 1'},{key:'g2',name:'Грейд 2'},{key:'g3',name:'Грейд 3'},
       {key:'g4',name:'Грейд 4'},{key:'g5',name:'Грейд 5'}]},
{key:'seniority',name:'Сеньорность',short:'Сеньорность',ord:true,group:'qual',
 hint:'Текстовый уровень специалиста. С грейдом связан, но не равен ему.',
 cats:[{key:'j',name:'Junior',w:1.00},{key:'m',name:'Middle',w:1.70},
       {key:'s',name:'Senior',w:1.25},{key:'l',name:'Lead и выше',w:0.42}]},
{key:'gender',name:'Пол',short:'Пол',group:'people',
 hint:'Разрез нужен вместе с другими: сам по себе он ни о чём не говорит, а «пол × грейд» показывает, ровно ли распределены уровни.',
 cats:[{key:'f',name:'Женщины',wIT:0.85,wNon:1.75},{key:'m',name:'Мужчины',wIT:1.90,wNon:0.95}]},
{key:'age',name:'Возрастная группа',short:'Возраст',ord:true,group:'people',
 cats:[{key:'a0',name:'До 25 лет',w:0.50},{key:'a25',name:'25–34 года',w:1.90},
       {key:'a35',name:'35–44 года',w:1.15},{key:'a45',name:'45 лет и старше',w:0.40}]},
{key:'tenure',name:'Стаж в компании',short:'Стаж',ord:true,group:'people',
 cats:[{key:'t0',name:'До 1 года',w:1.00},{key:'t1',name:'1–3 года',w:1.35},
       {key:'t3',name:'Больше 3 лет',w:0.90}]},
{key:'employment',name:'Тип занятости',short:'Занятость',group:'contract',
 hint:'Форма оформления. Штат — трудовой договор; всё остальное — не штат, и фильтр «штат / не штат» в шапке режет ровно по этой границе.',
 cats:[{key:'tk',name:'Штат (ТК РФ)'},{key:'gph',name:'ГПХ',w:1.15},{key:'ip',name:'ИП',w:0.95},
       {key:'sz',name:'Самозанятый',w:0.80},{key:'out',name:'Аутстафф',w:0.55}]},
{key:'worksite',name:'Формат работы',short:'Формат',group:'contract',
 cats:[{key:'off',name:'Офис',w:1.10},{key:'hyb',name:'Гибрид',w:1.60},
       {key:'rem',name:'Дистанционно',w:0.80}]},
{key:'legal',name:'Юрлицо',short:'Юрлицо',group:'contract',
 hint:'Юрлицо у подразделения одно: доля не размазывается между несколькими.',
 cats:[{key:'l1',name:'Основное юрлицо',w:0.50},{key:'l2',name:'Технологии',w:0.24},
       {key:'l3',name:'Сервис',w:0.16},{key:'l4',name:'Регионы',w:0.10}]},
{key:'stream',name:'Стрим и специализация',short:'Стрим',group:'stream',sort:true,childDim:'spec',
 hint:'Чем люди занимаются. Разрез двухуровневый: каретка раскрывает стрим до специализаций внутри него.',
 cats:[{key:'dev',name:'Разработка',kids:['be','fe','mob','core']},
       {key:'qa',name:'Тестирование',kids:['qaa','qam']},
       {key:'ana',name:'Аналитика',kids:['sa','ba']},
       {key:'ops',name:'DevOps и инфраструктура',kids:['dop','sre','net']},
       {key:'ml',name:'Данные и ML',kids:['de','mlm','bi']},
       {key:'des',name:'Дизайн',kids:['ux','res']},
       {key:'prod',name:'Продукт и проекты',kids:['pm','pjm']},
       {key:'sup',name:'Поддержка клиентов',kids:['l1','l2','vip']},
       {key:'back',name:'Операции и бэк-офис',kids:['ver','rec','doc']},
       {key:'adm',name:'Управление и администрирование',kids:['lead','adf']}]},
/* Специализации — нижний уровень стрима. Веса заданы ЗДЕСЬ, а вес стрима
   складывается из детей (см. mixWeights): иначе уровни разъезжались бы, и
   раскрытая каретка показывала бы сумму, не равную строке над ней. */
{key:'spec',name:'Специализация',short:'Специализация',group:'stream',sort:true,parentDim:'stream',
 hint:'Нижний уровень стрима. Отдельным разрезом нужен в конструкторе: в матрице специализация — такая же ось, как остальные.',
 cats:[{key:'be',name:'Бэкенд',parent:'dev',wIT:1.20,wNon:0.02},
       {key:'fe',name:'Фронтенд',parent:'dev',wIT:0.85,wNon:0.02},
       {key:'mob',name:'Мобильная разработка',parent:'dev',wIT:0.75,wNon:0.005},
       {key:'core',name:'Платформа и ядро',parent:'dev',wIT:0.40,wNon:0.005},
       {key:'qaa',name:'Автоматизация тестирования',parent:'qa',wIT:0.65,wNon:0.02},
       {key:'qam',name:'Ручное тестирование',parent:'qa',wIT:0.45,wNon:0.03},
       {key:'sa',name:'Системный анализ',parent:'ana',wIT:0.50,wNon:0.20},
       {key:'ba',name:'Бизнес-анализ',parent:'ana',wIT:0.40,wNon:0.30},
       {key:'dop',name:'DevOps и релизы',parent:'ops',wIT:0.28,wNon:0.02},
       {key:'sre',name:'SRE и надёжность',parent:'ops',wIT:0.18,wNon:0.01},
       {key:'net',name:'Сети и оборудование',parent:'ops',wIT:0.14,wNon:0.02},
       {key:'de',name:'Дата-инженерия',parent:'ml',wIT:0.22,wNon:0.04},
       {key:'mlm',name:'ML и моделирование',parent:'ml',wIT:0.18,wNon:0.02},
       {key:'bi',name:'BI и отчётность',parent:'ml',wIT:0.15,wNon:0.04},
       {key:'ux',name:'Продуктовый дизайн',parent:'des',wIT:0.25,wNon:0.07},
       {key:'res',name:'Исследования',parent:'des',wIT:0.10,wNon:0.03},
       {key:'pm',name:'Продакт-менеджмент',parent:'prod',wIT:0.35,wNon:0.15},
       {key:'pjm',name:'Проектное управление',parent:'prod',wIT:0.25,wNon:0.20},
       {key:'l1',name:'Первая линия',parent:'sup',wIT:0.05,wNon:1.40},
       {key:'l2',name:'Вторая линия',parent:'sup',wIT:0.03,wNon:0.80},
       {key:'vip',name:'Премиальный сегмент',parent:'sup',wIT:0.02,wNon:0.40},
       {key:'ver',name:'Верификация',parent:'back',wIT:0.04,wNon:0.70},
       {key:'rec',name:'Сверка операций',parent:'back',wIT:0.03,wNon:0.65},
       {key:'doc',name:'Документооборот',parent:'back',wIT:0.03,wNon:0.55},
       {key:'lead',name:'Руководители',parent:'adm',wIT:0.18,wNon:0.30},
       {key:'adf',name:'Административные функции',parent:'adm',wIT:0.12,wNon:0.30}]}
];
const MIX_BY_KEY=Object.fromEntries(MIX_DIMS.map(d=>[d.key,d]));
MIX_DIMS.forEach(d=>{
  d.color=MIX_GROUP_COLOR[d.group]||MIX_COLOR_DEF;
  d.cats.forEach(c=>{c.dim=d.key;c.id=d.key+':'+c.key});
});

/* Группы разрезов = под-вкладки состава. Правило раскладки одно: на вкладке
   не больше трёх таблиц. Четвёртая уже не влезает в рабочую зону ноутбука,
   а вкладка с прокруткой на два экрана перестаёт быть вкладкой. */
const MIX_GROUPS=[
{key:'qual',name:'Квалификация',dims:['grade','seniority'],
 title:'Квалификация: грейд и сеньорность'},
{key:'people',name:'Люди',dims:['gender','age','tenure'],
 title:'Кто эти люди: пол, возраст, стаж'},
{key:'contract',name:'Оформление',dims:['employment','worksite','legal'],
 title:'Как оформлены и где работают'},
{key:'stream',name:'Стримы',dims:['stream'],
 title:'Стримы и специализации'}
];

/* Доли категорий внутри одного листа. Считаются лениво и кешируются: держать
   девять векторов на каждом из 204 листьев незачем — за один рендер экран
   спрашивает от силы три разреза. */
const _mixW=new Map();
function mixWeights(leafPath,dimKey){
  const ck=leafPath+'|'+dimKey;
  if(_mixW.has(ck))return _mixW.get(ck);
  const dim=MIX_BY_KEY[dimKey], n=NODE_BY_PATH[leafPath]||{};
  const r=rng('mixw'+dimKey+leafPath);
  let w;
  if(dim.childDim){
    /* Верхний уровень — сумма детей, а не свой бросок: раскрытая каретка
       обязана давать в сумме ровно строку над собой. */
    const kid=MIX_BY_KEY[dim.childDim], kw=mixWeights(leafPath,dim.childDim);
    const at={};kid.cats.forEach((c,i)=>{at[c.key]=i});
    w=dim.cats.map(c=>c.kids.reduce((a,k)=>a+(kw[at[k]]||0),0));
  } else if(dimKey==='grade'){
    const sw=mixWeights(leafPath,'seniority');
    w=dim.cats.map((c,j)=>sw.reduce((a,s,i)=>a+s*GRADE_BY_SEN[i][j],0));
  } else if(dimKey==='employment'){
    /* Согласовано с фильтром «штат / не штат» в шапке: штатный лист весь в ТК,
       нештатный делится между ГПХ, ИП, самозанятыми и аутстаффом. Иначе отбор
       «только штат» показывал бы людей на ГПХ. */
    w=dim.cats.map((c,i)=>n.staff==='staff'?(i===0?1:0)
                        :(i===0?0:Math.max(0.02,(c.w||1)*(0.6+r()*0.8))));
  } else if(dimKey==='legal'){
    /* Юрлицо одно на подразделение: единица в одной категории, а не доли. */
    const acc=[];let s=0;
    dim.cats.forEach(c=>{s+=c.w||1;acc.push(s)});
    const x=r()*s, hit=acc.findIndex(a=>x<=a);
    w=dim.cats.map((c,i)=>i===(hit<0?0:hit)?1:0);
  } else {
    w=dim.cats.map(c=>{
      const base=n.it==='nonIT'?(c.wNon!=null?c.wNon:(c.w!=null?c.w:1))
                              :(c.wIT!=null?c.wIT:(c.w!=null?c.w:1));
      return Math.max(0.02,base*(0.6+r()*0.8));
    });
  }
  const s=w.reduce((a,b)=>a+b,0)||1;
  const out=w.map(x=>x/s);
  _mixW.set(ck,out);return out;
}

/* ---------- Связи между разрезами ----------
   Без связей матрица бесполезна: если атрибуты независимы, «% по строке» даёт
   одни и те же 25/75 в каждой строке, и смотреть на неё незачем. Ровно тот
   вопрос, ради которого матрица и заводится («грейды у женщин и у мужчин
   стоят одинаково?»), остался бы без ответа по построению.

   Пары со связью перечислены здесь; всё остальное внутри листа независимо.
   Список отдаётся наружу (MIX_LINKS) и подписывается в сноске под матрицей —
   выдуманная связь обязана быть названа, а не выглядеть находкой в данных. */
/* Шкала наклона задаётся по категориям ПЕРВОГО разреза, а знак тянет ко
   ВТОРОЙ категории второго: плюс — к первой в его списке, минус — к последней. */
const SEN_GENDER_TILT=[0.30,0.05,-0.18,-0.40];   /* + к женщинам (первая), − к мужчинам */
const AGE_TENURE_TILT=[0.45,0.10,-0.22,-0.40];   /* + к «до 1 года», − к «больше 3 лет» */
const MIX_LINKS=[
{a:'seniority',b:'grade',exact:GRADE_BY_SEN,
 label:'сеньорность и грейд (Junior не сидит на пятом грейде)'},
{a:'seniority',b:'gender',tilt:SEN_GENDER_TILT,
 label:'сеньорность и пол (доля женщин падает с уровнем)'},
{a:'age',b:'tenure',tilt:AGE_TENURE_TILT,
 label:'возраст и стаж (кто старше, тот дольше в компании)'}
];
const MIX_LINK_TEXT=MIX_LINKS.map(l=>l.label).join('; ');

/* Связь вносится множителем, а потом распределение возвращается к исходным
   маргиналам (IPF, десяток итераций). Это принципиально: обе одномерные
   разбивки обязаны остаться ТЕМИ ЖЕ, что на соседних вкладках. Иначе матрица
   спорила бы с таблицами, из которых собрана, — а сходимость чисел между
   экранами в этом отчёте дороже любой связи. */
function ipfJoint(wr,wc,bias){
  let m=wr.map((a,i)=>wc.map((b,j)=>Math.max(1e-9,a*b*bias[i][j])));
  for(let t=0;t<12;t++){
    m=m.map((row,i)=>{const sr=row.reduce((x,y)=>x+y,0)||1;return row.map(v=>v*wr[i]/sr)});
    const cs=wc.map((_,j)=>m.reduce((x,r)=>x+r[j],0)||1);
    m=m.map(row=>row.map((v,j)=>v*wc[j]/cs[j]));
  }
  return m;
}
/* Перекос из шкалы наклона: первая категория второго разреза тянется вверх,
   последняя — вниз, промежуточные линейно между ними. */
function tiltBias(tilt,nc){
  return tilt.map(t=>Array.from({length:nc},(_,j)=>
    Math.exp(t*(nc<2?0:1-2*j/(nc-1)))));
}

/* Совместное распределение двух разрезов внутри одного листа. */
function linkOf(a,b){return MIX_LINKS.find(l=>(l.a===a&&l.b===b)||(l.a===b&&l.b===a))||null}
/* «Считать совместно, а не перемножать» — и для заданной связи, и для уровней
   одного разреза. Объявлено выше sliceShare, потому что нужно им обоим. */
function joined(a,b){return !!(linkOf(a,b)||nestOf(a,b))}
/* Пара «стрим → специализация» — не два независимых атрибута, а уровни одного:
   специализация лежит ровно в одном стриме. Поэтому совместное распределение
   здесь блочно-диагональное и точное. Без этого случая матрица «стрим ×
   специализация» показывала бы бэкендеров в поддержке клиентов, а срез
   «Разработка + Бэкенд» считался бы как пересечение независимых событий —
   то есть заметно меньше, чем самих бэкендеров. */
function nestOf(a,b){
  const A=MIX_BY_KEY[a], B=MIX_BY_KEY[b];
  if(A&&A.childDim===b)return {top:a,kid:b,flip:false};
  if(B&&B.childDim===a)return {top:b,kid:a,flip:true};
  return null;
}
function mixJoint(leafPath,rowKey,colKey){
  const wr=mixWeights(leafPath,rowKey), wc=mixWeights(leafPath,colKey);
  const nest=nestOf(rowKey,colKey);
  if(nest){
    const kid=MIX_BY_KEY[nest.kid], kw=mixWeights(leafPath,nest.kid);
    const topCats=MIX_BY_KEY[nest.top].cats;
    const m=topCats.map(tc=>kid.cats.map((kc,j)=>kc.parent===tc.key?kw[j]:0));
    return nest.flip ? kid.cats.map((_,j)=>topCats.map((__,i)=>m[i][j])) : m;
  }
  const link=linkOf(rowKey,colKey);
  if(!link)return wr.map(a=>wc.map(b=>a*b));
  const flip=link.a===colKey;
  if(link.exact){
    /* точная связь: доли второго разреза выведены из первого, маргиналы
       сходятся по построению, выравнивать нечего */
    return flip ? wr.map((_,i)=>wc.map((s,j)=>s*link.exact[j][i]))
                : wr.map((s,i)=>link.exact[i].map(g=>s*g));
  }
  const bias=tiltBias(link.tilt,flip?wr.length:wc.length);
  return flip ? ipfJoint(wr,wc,wr.map((_,i)=>wc.map((__,j)=>bias[j][i])))
              : ipfJoint(wr,wc,bias);
}

/* Округление долей до людей по наибольшим остаткам. Округлять каждую долю
   отдельно нельзя: сумма разъезжается с численностью, и ИТОГО таблицы начинает
   спорить с карточкой KPI над ней — на один-двух человек, но заметно. */
function roundParts(vals,total){
  const fl=vals.map(v=>Math.floor(v));
  let rest=Math.max(0,Math.round(total)-fl.reduce((a,b)=>a+b,0));
  const idx=vals.map((v,i)=>i).sort((a,b)=>(vals[b]-fl[b])-(vals[a]-fl[a]));
  for(let k=0;k<rest&&idx.length;k++)fl[idx[k%idx.length]]++;
  return fl;
}

/* Вес листа с учётом среза, НО без той части среза, которая приходится на
   сам показываемый разрез. Правило перекрёстной фильтрации: срез действует на
   всё, кроме таблицы, из которой его взяли. Иначе клик по «Senior» схлопнул бы
   таблицу сеньорности в одну строку, и переключиться на Middle стало бы нечем.
   Второй сторонний атрибут (срез из двух) домножается независимо — то же
   допущение, что и в матрице. */
function otherParts(sel,skip){
  return sliceParse(sel).filter(p=>skip.indexOf(p.dim.key)<0);
}
function shareBesides(leafPath,parts){
  if(!parts.length)return 1;
  return sliceShare(leafPath,parts);
}

/* Состав группы листьев по разрезу: массив человек по категориям.
   lp — массив ПУТЕЙ листьев, атрибуты берутся по пути через mixWeights.
   sel — активный срез: он режет таблицу, но не по её собственному разрезу. */
/* Доли листа по разрезу с учётом стороннего среза. Совместное распределение
   берётся со связанным разрезом, если он среди сторонних есть, — иначе с
   первым; остальные домножаются независимо, как и в матрице. */
function partsWeight(leafPath,dimKey,parts){
  const dim=MIX_BY_KEY[dimKey];
  if(!parts.length)return mixWeights(leafPath,dimKey);
  let k=parts.findIndex(p=>joined(dimKey,p.dim.key));
  if(k<0)k=0;
  const j=mixJoint(leafPath,dimKey,parts[k].dim.key);
  const rest=sliceShare(leafPath,parts.filter((_,i)=>i!==k));
  return dim.cats.map((_,i)=>j[i][parts[k].idx]*rest);
}
/* skip — какие разрезы среза не применять. По умолчанию свой собственный;
   матрица передаёт обе свои оси, чтобы её края считались ровно так же, как
   разбивки, которые она обязана повторять. */
function mixParts(lp,dimKey,sel,skip){
  const dim=MIX_BY_KEY[dimKey];
  if(!dim)return [];
  /* нижний уровень считается через дерево: вкладка «Стримы» и разбивка по
     специализациям обязаны показывать одни и те же числа */
  if(dim.parentDim){
    const at={}, out=dim.cats.map(()=>0);
    dim.cats.forEach((c,i)=>{at[c.key]=i});
    mixTree(lp,dim.parentDim,sel,skip).forEach(n=>n.kids.forEach(k=>{out[at[k.cat.key]]=k.value}));
    return out;
  }
  const raw=mixRaw(lp,dimKey,sel,skip||[dimKey]);
  return roundParts(raw,raw.reduce((a,b)=>a+b,0));
}
function mixCats(dimKey){return (MIX_BY_KEY[dimKey]||{cats:[]}).cats}

/* ---------- Двухуровневый разрез: стрим → специализации ----------
   Округляется СВЕРХУ ВНИЗ: сначала стримы к численности отбора, потом
   специализации внутри каждого стрима — к его уже округлённому значению.
   Иначе раскрытая каретка показывала бы дочерние строки, которые в сумме
   не дают строку над ними: 15+12 под стримом со значением 26.

   Наружу — и дерево (`mixTree`), и плоский вектор по нижнему уровню:
   `mixParts` для дочернего разреза берёт числа отсюда же, поэтому вкладка
   «Стримы» и разбивка по специализациям в конструкторе показывают одно и то же. */
function mixRaw(lp,dimKey,sel,skip){
  const dim=MIX_BY_KEY[dimKey];
  const parts=otherParts(sel,skip||[dimKey]);
  const raw=dim.cats.map(()=>0);
  lp.forEach(p=>{
    const hc=lastVal([p],'hc_total'), w=partsWeight(p,dimKey,parts);
    dim.cats.forEach((c,i)=>{raw[i]+=hc*w[i]});
  });
  return raw;
}
function mixTree(lp,dimKey,sel,skipExtra){
  const dim=MIX_BY_KEY[dimKey], kid=MIX_BY_KEY[dim.childDim];
  /* Оба уровня исключаются из среза одинаково: они живут в одной таблице,
     и отфильтруй нижний по «Разработке» — дети остальных стримов обнулятся,
     а сами стримы останутся, и сумма детей перестанет равняться родителю. */
  const skip=[dimKey,dim.childDim].concat(skipExtra||[]);
  const rawTop=mixRaw(lp,dimKey,sel,skip), rawKid=mixRaw(lp,dim.childDim,sel,skip);
  const at={};kid.cats.forEach((c,i)=>{at[c.key]=i});
  const top=roundParts(rawTop,rawTop.reduce((a,b)=>a+b,0));
  return dim.cats.map((c,i)=>{
    const idx=c.kids.map(k=>at[k]);
    const vals=roundParts(idx.map(j=>rawKid[j]),top[i]);
    return {cat:c,value:top[i],
      kids:idx.map((j,n)=>({cat:kid.cats[j],value:vals[n]}))};
  });
}

/* Округление матрицы С СОХРАНЕНИЕМ КРАЁВ. Просто округлить все клетки разом
   мало: итог колонки в матрице тогда расходится с той же категорией в обычной
   разбивке на соседней вкладке — «Женщины 54» против «Женщины 53». Один
   человек, но это ровно тот случай, когда пользователь перестаёт верить обеим
   таблицам. Поэтому сначала округляются края (тем же методом, что и разбивка,
   так что совпадают с ней ровно), а потом целые люди раскладываются по клеткам
   в порядке убывания дробной части, но только туда, где ещё не выбрана квота
   и строки, и колонки. */
function roundMatrix(raw,rowTot,colTot){
  const out=raw.map(r=>r.map(v=>Math.floor(v)));
  const needR=rowTot.map((t,i)=>t-out[i].reduce((a,b)=>a+b,0));
  const needC=colTot.map((t,j)=>t-out.reduce((a,r)=>a+r[j],0));
  /* Клетки со структурным нулём (Junior на пятом грейде) из раздачи исключены:
     доложить туда человека ради схождения края — значит нарисовать в матрице
     то, чего в модели нет. Такие нули остаются нулями. */
  const cells=[];
  raw.forEach((r,i)=>r.forEach((v,j)=>{if(v>1e-9)cells.push({i:i,j:j,f:v-out[i][j]})}));
  cells.sort((a,b)=>b.f-a.f);
  let moved=1;
  while(moved){
    moved=0;
    cells.forEach(c=>{
      if(needR[c.i]>0&&needC[c.j]>0){out[c.i][c.j]++;needR[c.i]--;needC[c.j]--;moved++}
    });
  }
  /* Довод остатка. Сначала ищем разрешённую клетку на пересечении строки и
     колонки, которым не хватает. Если такой нет (в строке остались одни
     структурные нули), доводим обменом по циклу: +1 в разрешённую клетку этой
     строки, −1 у соседней строки в той же колонке, +1 у неё в нужной. Итог
     ровно тот же — строка и колонка получили по человеку, — а нули остались
     нулями. Без обмена приходилось бы выбирать между сходящимся краем и
     честной матрицей, и Lead оказывался на первом грейде. */
  const R=out.length, C=out[0].length;
  for(let guard=0;guard<4096;guard++){
    let i=-1,j=-1;
    for(let a=0;a<R&&i<0;a++){
      if(needR[a]<=0)continue;
      for(let b=0;b<C;b++)if(needC[b]>0&&raw[a][b]>1e-9){i=a;j=b;break}
    }
    if(i>=0){out[i][j]++;needR[i]--;needC[j]--;continue}
    i=needR.findIndex(v=>v>0);j=needC.findIndex(v=>v>0);
    if(i<0||j<0)break;
    let done=false;
    for(let k=0;k<C&&!done;k++){
      if(raw[i][k]<=1e-9)continue;
      for(let r=0;r<R&&!done;r++){
        if(r===i||out[r][k]<=0||raw[r][j]<=1e-9)continue;
        out[i][k]++;out[r][k]--;out[r][j]++;
        needR[i]--;needC[j]--;done=true;
      }
    }
    if(!done){out[i][j]++;needR[i]--;needC[j]--}
  }
  return out;
}

/* Матрица «строки × колонки» в людях. Итоги строк и колонок совпадают с теми же
   разрезами в обычных разбивках, сумма клеток — с численностью в карточках.
   Срез по третьему атрибуту матрицу режет, срез по её собственным осям — нет. */
function mixMatrix(lp,rowKey,colKey,sel){
  const R=MIX_BY_KEY[rowKey], C=MIX_BY_KEY[colKey];
  if(!R||!C)return [];
  const parts=otherParts(sel,[rowKey,colKey]);
  const raw=R.cats.map(()=>C.cats.map(()=>0));
  let sum=0;
  lp.forEach(p=>{
    const hc=lastVal([p],'hc_total')*shareBesides(p,parts), j=mixJoint(p,rowKey,colKey);
    sum+=hc;
    R.cats.forEach((_,i)=>C.cats.forEach((__,k)=>{raw[i][k]+=hc*j[i][k]}));
  });
  /* Края берутся у ТЕХ ЖЕ разбивок, что показаны на вкладках, а не считаются
     заново: только так матрица не расходится с ними на человека. */
  const axes=[rowKey,colKey];
  return roundMatrix(raw,mixParts(lp,rowKey,sel,axes),mixParts(lp,colKey,sel,axes));
}

/* ---------- Срез состава ----------
   Клик по строке разбивки берёт срез: численность в карточках и в таблице
   подразделений пересчитывается по доле этой категории. Дальше двух атрибутов
   срез не идёт — на третьем начинаются доли от долей, и в клетке остаётся
   полчеловека. Режутся только счётные метрики численности: проценты умножать
   на долю состава бессмысленно, а найм и отток модель по атрибутам не знает. */
/* Сколько атрибутов держит срез. Два — это было ограничение МОДЕЛИ МАКЕТА,
   а не продукта: на выдуманных долях третий атрибут давал доли от долей.
   Ограничение снято — срез держит по одной категории на разрез, сколько их
   ни возьми. На реальных данных это обычный фильтр по сотруднику, и резать
   по трём атрибутам нормально; в макете при этом честно считается совместное
   распределение для связанных пар и независимое для остальных. */
const SLICE_MAX=MIX_DIMS.length;
const SLICE_KEYS=new Set(['hc_total','hc_active']);
function sliceable(key){return SLICE_KEYS.has(key)}
function sliceParse(sel){
  return (sel||[]).map(id=>{
    const [dk,ck]=String(id).split(':'), dim=MIX_BY_KEY[dk];
    if(!dim)return null;
    const i=dim.cats.findIndex(c=>c.key===ck);
    return i<0?null:{id:dim.key+':'+ck,dim:dim,idx:i,cat:dim.cats[i]};
  }).filter(Boolean).slice(0,SLICE_MAX);
}
function sliceLabel(sel){return sliceParse(sel).map(p=>p.cat.name).join(' · ')}
/* Доля листа, попадающая в срез. Для пары разрезов берётся совместное
   распределение — то же самое, что стоит в клетке матрицы, иначе срез по клику
   расходился бы с числом, по которому кликнули. */
function sliceShare(leafPath,parts){
  if(!parts.length)return 1;
  if(parts.length===1)return mixWeights(leafPath,parts[0].dim.key)[parts[0].idx];
  /* Связанные пары берутся совместным распределением — иначе срез по клику
     разошёлся бы с числом в клетке матрицы, по которому кликнули. Всё
     остальное перемножается как независимое. */
  const used=[]; let v=1;
  for(let i=0;i<parts.length;i++){
    if(used.indexOf(i)>=0)continue;
    let pair=-1;
    for(let j=i+1;j<parts.length;j++){
      if(used.indexOf(j)<0&&joined(parts[i].dim.key,parts[j].dim.key)){pair=j;break}
    }
    if(pair<0)continue;
    v*=mixJoint(leafPath,parts[i].dim.key,parts[pair].dim.key)[parts[i].idx][parts[pair].idx];
    used.push(i,pair);
  }
  parts.forEach((p,i)=>{if(used.indexOf(i)<0)v*=mixWeights(leafPath,p.dim.key)[p.idx]});
  /* пара без связи считается независимой — как и в матрице */
  if(!used.length&&parts.length===2)return v;
  return v;
}
function aggregateSlice(lp,key,sel){
  const parts=sliceParse(sel);
  if(!parts.length||!sliceable(key)||!lp.length)return aggregate(lp,key);
  const ck='sl|'+key+'|'+parts.map(p=>p.id).join(',')+'#'+lp.length+'#'+hashStr(lp.join(','));
  if(_ac.has(ck))return _ac.get(ck);
  const out=new Array(N).fill(0);
  for(let i=0;i<N;i++){
    let s=0;
    lp.forEach(p=>{s+=metricSeries(p,key)[i]*sliceShare(p,parts)});
    /* НЕ до десятых: 53,46 округлилось бы сначала до 53,5, а потом до 54 —
       и карточка показывала бы 54 там, где разбивка честно считает 53.
       Двойное округление на срезе даёт расхождение ровно в одного человека,
       то есть ровно то, из-за чего перестают верить обеим таблицам. */
    out[i]=+s.toFixed(4);
  }
  _ac.set(ck,out);return out;
}
function lastValSlice(lp,key,sel){return aggregateSlice(lp,key,sel)[LAST]}
/* Изменение к прошлому месяцу по срезу: на расширенную сетку срез не ходит,
   поэтому MoM считается по окну — для численности это тот же прошлый месяц. */
function sliceDeltaMoM(lp,key,sel){
  const s=aggregateSlice(lp,key,sel);
  return +(s[LAST]-s[LAST-1]).toFixed(1);
}

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
/* MONTH_GEN (родительный падеж) объявлен в шапке файла: его читает и календарь
   («15 июня 2026, понедельник»), и подсказка изменения («против мая 2026»). */
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

/* ---------- Последние CAL_MONTHS месяцев ----------
   Календарь показывает не «текущий месяц» и не скользящее окно в N дней,
   а последние два КАЛЕНДАРНЫХ месяца: предыдущий целиком, текущий — по
   сегодняшний день.

   Почему не «текущий месяц»: человек, зашедший второго числа, видел две клетки.
   Почему не окно в 30 дней: оно резало предыдущий месяц по произвольному числу
   (17–31 мая), и месяц переставал быть месяцем — сравнивать «кусок мая»
   с «куском июня» бессмысленно, а статистика за май частично терялась.

   Теперь раскладка предсказуема: слева всегда полный месяц, справа текущий
   ровно настолько, насколько он прожит. Первого июня справа будет один день,
   но весь май при этом на месте.

   Наружу — МАССИВ блоков; экран рисует их сетками рядом. Блок несёт `first`,
   день недели своего первого числа: сетка обязана начинаться с той колонки,
   где день реально стоит в неделе. */
const CAL_MONTHS=2;
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
function attLast(lp,months){
  months=months||CAL_MONTHS;
  const out=[];
  for(let i=Math.max(0,LAST-months+1);i<=LAST;i++){
    const blk=attDays(lp,i);
    /* обрезается ТОЛЬКО текущий месяц и только справа: прошлые месяцы
       показываются целиком, иначе теряется их статистика */
    const to=i===LAST?Math.min(CAL_TODAY,blk.days.length):blk.days.length;
    out.push({y:blk.y,m:blk.m,label:blk.label,base:blk.base,
      from:1,to:to,full:to===blk.days.length,
      first:blk.first,days:blk.days.filter(d=>d.day<=to)});
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

window.TPDATA={MIX_DIMS,MIX_BY_KEY,MIX_GROUPS,MIX_GROUP_COLOR,dimColor,GRADE_BY_SEN,MIX_LINKS,MIX_LINK_TEXT,
  mixParts,mixCats,mixTree,mixMatrix,mixWeights,mixJoint,roundParts,roundMatrix,otherParts,
  SLICE_MAX,sliceable,sliceParse,sliceLabel,sliceShare,aggregateSlice,lastValSlice,sliceDeltaMoM,
  netGrowth,MONTHS,N,LAST,PERIOD_LABEL,CMP,BLOCKS,BLOCK_BY_KEY,METRICS,METRIC_BY_KEY,metricsOfBlock,
  OFFICES,DOW_NAME,DOW_SHORT,MONTH_GEN,CAL_MONTH,CAL_MONTHS,CAL_TODAY,DOW_MONTHS,
  attDays,attLast,attByDow,officeRank,
  COUNT_METRICS,EXIT_REASONS,PAINTS,ITSEGS,STAFFTYPES,NODES,NODE_BY_PATH,ROOT,LEVEL_NAME,LEVEL_SHORT,
  childrenOf,descendantsOf,leavesUnder,ancestorsOf,levelLabel,nodesBelow,
  leafPasses,reportLeaves,benchmarkLeaves,benchmarkLabel,filterChips,
  metricSeries,reasonSeries,aggregate,lastVal,deltas,deltasOf,compareState,stateForKpi,kpiFor,comparable,
  LOCKED_METRICS,METRIC_PRESETS,sanitizeHidden,metricVisible,visibleMetricsOfBlock,visibleBlocks,
  blockVisible,visibleCount,hiddenForPreset,activePreset,
  fmtInt,fmtVal,fmtDelta,fmtCompact,DEFAULT_STATE,
  PRE,NEXT,MONTHS_EXT,YEAR_START_EXT,seriesExt,aggregateExt};

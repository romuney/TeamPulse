/* ============================================================================
   screens/_block.js — общий каркас детальной вкладки и реестр экранов.
   Неймспейс: window.TPSCREENS. Загружается ПЕРВЫМ среди screens/*.

   Каркас одинаков для всех восьми блоков: заголовок → инсайт → KPI блока →
   две колонки (таблица подразделений слева, содержимое справа).
   Блок-специфичное живёт в своём файле и регистрируется так:

     TPSCREENS.blocks.turnover = {
       subTabs:   [['dynamics','Динамика'],['reasons','Причины']],
       defaultSub:'dynamics',
       title(sub){ return '...' },      // заголовок правой панели
       view(ctx){ return '<html>' }     // тело правой панели
     };

   ctx, который получает view():
     S          — состояние (только читать)
     b          — определение блока из D.BLOCKS
     sub        — активная под-вкладка
     lp         — пути листьев ВЫБРАННОГО узла (клик по строке таблицы)
     rl, bl     — листья отбора и базы сравнения
     rows       — строки сводной таблицы (первый уровень, без раскрытий и поиска)
     root, sel  — пути юнита отчёта и выбранного узла
     benchLabel — подпись базы сравнения
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, INS=window.TPINSIGHTS, STY=window.TPSTORY;
const esc=U.esc;

const blocks={};

/* ---------- общие помощники, доступны экранам ---------- */
/* Корень сводной таблицы — юнит отчёта. Временного корня (drillRoot и кнопки ↓)
   больше нет: глубже трёх уровней ведёт переход в юнит, а он меняет сам юнит
   отчёта — с путём, «← Назад» и ссылкой (итерация 29, механика HRBP HUB). */
function currentRoot(S){return S.unit}
/* Глубина сводной таблицы: три уровня вниз от юнита отчёта. Глубже — «Открыть
   юнит» у выбранной строки. Переключателя глубины нет намеренно: на шести
   уровнях имя сжималось бы в столбик, а длинный список переставал читаться. */
const TREE_DEPTH=3;
function rowLeaves(path,S){return D.leavesUnder(path).map(l=>l.path).filter(p=>D.leafPasses(p,S))}
function sumS(s){return s.reduce((a,b)=>a+b,0)}
/* основная метрика таблицы: первая сравнимая среди ВЫБРАННЫХ метрик блока,
   иначе просто первая выбранная. Скрытая метрика главной быть не может —
   от неё зависит колонка «К базе» и подсветка строк. */
function blockMain(bk,S){
  const m=D.METRIC_BY_KEY[S.mainMetric];
  if(m&&m.block===bk&&D.metricVisible(m.key,S))return S.mainMetric;
  const mets=D.visibleMetricsOfBlock(bk,S);
  return (mets.find(x=>D.comparable(x.key))||mets[0]).key;
}
/* Строки, у которых есть что раскрывать в пределах трёх уровней: первый
   и второй уровень с детьми. Ими и только ими управляет каретка в ИТОГО —
   «раскрыть всё» открывает все три уровня разом. У строки третьего уровня
   каретки нет, даже если под ней есть подразделения: туда ведёт переход. */
function expandableRows(root){
  const out=[];
  (function walk(p,d){
    D.rowsOf(p).forEach(n=>{
      if(d<TREE_DEPTH&&D.rowsOf(n.path).length){out.push(n.path);walk(n.path,d+1)}
    });
  })(root,1);
  return out;
}
/* isEmpty(path) — у подразделения под текущими фильтрами никого нет. Такие
   строки уходят вниз своего уровня и приглушаются: «0 чел» с нулями во всех
   колонках занимали столько же места, сколько живые команды, и разрывали
   список. Порядок внутри живых и внутри пустых — как в оргдереве. */
/* Три уровня вниз (TREE_DEPTH): раскрытая строка добавляет своих детей,
   кнопкой или кареткой ИТОГО. У юнита без подразделений (команды) строк нет —
   экран говорит об этом словами, а не повторяет ИТОГО второй строкой.
   q — поиск: дерево обходится целиком в пределах трёх уровней, остаются
   находки (hit) и их предки (anc) — свёрнутый родитель находку не прячет. */
function pivotRows(root,expanded,isEmpty,q){
  const rows=[], emp=isEmpty||(()=>false), needle=String(q||'').trim().toLowerCase();
  const order=list=>list.filter(n=>!emp(n.path)).concat(list.filter(n=>emp(n.path)));
  (function walk(p,d){
    order(D.rowsOf(p)).forEach(n=>{
      /* kidsOf: в пробнике у юнита третьего уровня дети в ответ не едут —
         их число приходит из датасета («ниже ещё N») */
      const kids=D.kidsOf(n.path);
      rows.push({n:n,depth:d,empty:emp(n.path),kids:kids});
      if(kids&&d<TREE_DEPTH&&(needle||expanded.has(n.path)))walk(n.path,d+1);
    });
  })(root,1);
  if(!needle)return rows;
  const hits=rows.filter(r=>r.n.name.toLowerCase().indexOf(needle)>=0).map(r=>r.n.path);
  return rows.filter(r=>{
    r.hit=hits.indexOf(r.n.path)>=0;
    r.anc=!r.hit&&hits.some(h=>h.indexOf(r.n.path+'/')===0);
    return r.hit||r.anc;
  });
}
/* Имя того, что сейчас показано в правой панели: выбранная строка таблицы,
   иначе юнит отчёта. Именно этим именем
   подписана синяя линия в легенде: «значение» ничего не объясняет. */
function selLabel(S){
  const n=D.NODE_BY_PATH[S.selNode]||D.NODE_BY_PATH[S.unit];
  return n?n.name:'Ваша команда';
}
/* ---------- Динамика: только «год к году» ----------
   13.10 заказчик: «убери 12 мес, оставь только год к году» — как в HRBP HUB.
   Переключателя масштаба больше нет: каждый график динамики стоит на оси
   янв.–дек., этот год против прошлого. Ориентир — тот же выбор, что везде:
   цель KPI или база, и только для текущего года. База не рисуется в двух
   случаях: у несравнимых метрик (там она вводит в заблуждение) и у метрик с
   утверждённым KPI — на полотне остаются пороги цели, и вторая пунктирная
   линия рядом с ними спорила бы с ними за роль ориентира.

   Все метрики — линиями (13.10, второй заход: счётные потоки барами с серой
   «тенью» прошлого года рядом с линиями сбивали с толку). Этот год — яркая
   линия, прошлый — бледная. */
/* цвет линии потока — тот же, что на вкладках блока: пришли — C_IN, ушли —
   C_OUT; одиночные метрики — кобальтом */
const YOY_COLOR={attrition:G.C_OUT,transfer_out:G.C_OUT,tgrowth_deny:G.C_OUT,
  hire:G.C_IN,transfer_in:G.C_IN,vac_closed:G.C_IN,tgrowth_pass:G.C_IN,vac_open:G.C_VAC,ai_wau:G.C_AI};
function yoyChart(key,lp,bl,S,opt){
  opt=opt||{};
  const kpi=D.kpiFor(key,S), cmp=D.comparable(key)&&!kpi, bench=D.benchmarkLabel(S);
  const y=D.yoySeries(lp,key), by=cmp?D.yoySeries(bl,key).cur:null;
  const col=opt.color||YOY_COLOR[key]||G.C_LINE;
  /* счётный поток (найм, уход…) — бар этого года, позади прозрачный бар прошлого (15.10) */
  const flow=!!(D.METRIC_BY_KEY[key]||{}).flow;
  const legend=(flow?[{name:String(D.YEAR_CUR),color:G.soft(col)},{name:String(D.YEAR_PREV),color:col,ghost:true}]
      :[{name:String(D.YEAR_CUR),color:col},{name:String(D.YEAR_PREV),color:G.C_PREV}])
    .concat(cmp?[{name:bench,color:G.C_BENCH,dash:true}]:[]);
  /* gap — заливка разрыва с базой светофором (итерация 32): где линия лучше
     базы — зелёным, где хуже — красным, в мёртвой зоне ±5% — без заливки */
  return G.chart('yoy',{metricKey:key,cur:y.cur,prev:y.prev,bench:by},
    Object.assign({legend,benchName:bench,kpi:kpi,h:300,fill:true,gap:cmp},opt,{color:col}));
}
/* Метрика главы: одно полотно «год к году» с ориентиром. Акценты истории
   (opt.ann) приходят по окну отчёта — на ось года их переводит draw.js. */
function metricLine(key,lp,bl,S,opt){return yoyChart(key,lp,bl,S,opt)}
/* Несколько метрик одной главы — панели друг под другом, у каждой своя шкала
   и своя легенда «этот год / прошлый»; клик по ней скрывает линию во всех
   панелях графика. items: [{key, name, color, ann}] */
function yoyPanels(lp,items,opt){
  return G.chart('panels',{panels:items.map(it=>{
    const y=D.yoySeries(lp,it.key);
    return {name:it.name,key:it.key,cur:y.cur,prev:y.prev,color:it.color||YOY_COLOR[it.key]||G.C_LINE,ann:it.ann||null};
  })},Object.assign({h:520,fill:true,
    legend:[{name:String(D.YEAR_CUR)},{name:String(D.YEAR_PREV)}]},opt||{}));
}
/* Пара встречных потоков (пришли / ушли) на оси года — «ежики»: приход
   барами вверх, уход вниз, прошлый год — прозрачными барами позади (15.10). opt.legend — имена
   двух потоков; пункты «этот год» и «прошлый» добавляются здесь. */
function yoyPair(lp,aKey,bKey,opt){
  const raw=opt&&opt.legend||[], src=raw.map(it=>Object.assign({},it,{color:G.soft(it.color)}));
  const cA=raw[0]?raw[0].color:G.C_IN, cB=raw[1]?raw[1].color:G.C_OUT;
  const lg=src.concat([{name:String(D.YEAR_CUR),split:[G.soft(cA),G.soft(cB)]},
    {name:String(D.YEAR_PREV),split:[cA,cB],ghost:true}]);
  return G.chart('pair',{a:Object.assign({key:aKey},D.yoySeries(lp,aKey)),b:Object.assign({key:bKey},D.yoySeries(lp,bKey))},
    Object.assign({h:300,fill:true,aName:lg[0]&&lg[0].name,bName:lg[1]&&lg[1].name},opt||{},{legend:lg}));
}

/* Спарклайн в карточке KPI блока (рекомендация бизнес-анализа: динамика
   читается без перехода на график). Тот же спарклайн, что в колонке «12 мес»
   one-pager: серая линия, у метрики со светофором точка каждого месяца
   окрашена сравнением с базой этого месяца или с целью KPI и пунктир
   ориентира; у метрики без оценки — только последняя точка. */
function cardSpark(key,ser,st,S,bl){
  const kpi=D.kpiFor(key,S);
  /* 14.10: в KPI-карточках спарклайн без точек, ориентир — только цель KPI
     и база у «Проникновения AI» (там же подпись «по компании») */
  return G.sparkLine(ser,st,84,24,{key:key,kpi:kpi,ink:true,dots:false,
    base:cardBase(key,kpi)?D.aggregate(bl,key):null});
}
/* Сравнение с базой в KPI-карточке — только у «Проникновения AI» (14.10). */
function cardBase(key,kpi){return !kpi&&key==='ai_penetration'&&D.comparable(key)}
/* Значение того же месяца год назад — прямо из расширенной сетки, а не
   «значение минус изменение»: у доли без знаменателя изменения нет. */
function yearAgo(lp,key){return D.aggregateExt(lp,key)[D.NEXT-13]}

/* ---------- пробник: что на вкладке — заглушка ----------
   В Proteus (TP_REAL) живые только метрики и ряды из hr_structure_overall:
   численность, движение, текучесть, regret и оценки. Разбивки по атрибутам,
   которых в таблице нет, и метрики без источника — демо на генераторе, и
   вкладка говорит об этом плашкой над содержимым. '*' — все под-вкладки блока. */
/* ---------- Что на вкладке в разработке (14.10) ----------
   t — что здесь не настоящее, need — что нужно (иначе — из плана этапа),
   part — вкладка частично живая. '*' — все под-вкладки блока. Одна карта и
   для плашки над содержимым, и для отметки шага, и для пункта меню блока. */
const DEV_TABS={
  structure:{'*':{stage:4,t:'Доли по грейду, сеньорности, полу, возрасту, стажу, региону, формату и стримам — заглушка: этих '+
    'атрибутов нет в hr_structure_overall. Живая только численность.'}},
  turnover:{reasons:{stage:3,t:'Инициаторы и причины увольнений — заглушка: их нет в hr_structure_overall. Живой только отток в ИТОГО.'},
    who:{stage:3,t:'Стаж, грейд и стрим ушедших — заглушка. Живой только отток в ИТОГО.',need:'атрибуты ушедших на дату увольнения (витрина оттока) и ответ 0а'}},
  hiring:{vacancies:{stage:2,t:'Вакансии и срок закрытия — заглушка: нужен источник вакансий (vacancy_daily_for_digest).'},
    plan:{stage:2,part:true,t:'План найма — заглушка (plan_fact_tf_rabota); факт — живой найм.'},
    profile:{stage:2,part:true,t:'Каналы и грейд найма — заглушка (atributy_nayma); живой только найм в ИТОГО.'}},
  tgrowth:{'*':{stage:6,t:'T-рост — заглушка: нужны заявки и решения сервиса «Рост».'}},
  monitor:{both:{stage:5,t:'Недоработка и «улучшили оценку» — заглушка: нужны табель и review_digest_us.'},
    review:{stage:5,t:'Итоги ревью — заглушка (review_digest_us).'}},
  office:{'*':{stage:7,t:'Посещаемость и бронирование — заглушка: нужны СКУД и система бронирования.'}},
  ai:{'*':{stage:8,t:'AI-инструменты — заглушка: нужна AI-витрина (penetration_unit, wau).'}}
};
/* Колонки разведки 12.10 оживляют часть вкладок: решения и конверсию T-роста
   и посещаемость за месяц. Там отметки нет, на соседних — уточнённый текст:
   что из блока живое, а что ещё нет. Без колонок — прежние записи DEV_TABS. */
const DEV_LIVE={
  tgrowth:{live:['tgrowth_conv'],subs:['flow'],
    '*':{stage:6,t:'Типы заявок, T@T и статусы по грейдам — заглушка: в hr_structure_overall есть только решения по заявкам '+
      '(GRT) — они и конверсия на вкладке «Растут ли люди внутри?» живые.'}},
  office:{live:['office_att'],subs:['dynamics'],
    '*':{stage:7,t:'Календарь по дням, города, «кто ходит» и бронирование — заглушка: в hr_structure_overall посещения есть '+
      'только суммой за месяц по юниту. Посещаемость на вкладке «Ходят больше или меньше?» — живая.'}}
};
function devOf(bk,sub){
  const lv=DEV_LIVE[bk];
  if(lv&&lv.live.every(k=>!D.isDev(k)))return lv.subs.indexOf(sub)>=0?null:lv['*'];
  const d=DEV_TABS[bk]||{};
  return d[sub]||d['*']||null;
}
/* Блок целиком: 'full' — все под-вкладки в разработке, 'part' — часть, '' — живой */
function blockDev(bk){
  const subs=(blocks[bk]||{}).subTabs||[], st=subs.map(t=>devOf(bk,t[0]));
  if(!subs.length||!st.some(Boolean))return '';
  return st.every(x=>x&&!x.part)?'full':'part';
}
/* Плашка над содержимым вкладки. В пробнике вывод главы по заглушке не
   строится (book → demo): утверждать по сгенерированной цифре нельзя. */
function demoNoteFor(bk,sub){return D.REAL&&devOf(bk,sub)?'1':''}

/* ---------- рендер детальной вкладки ----------
   view — состояние показа, которое в ссылку не едет: tq — поиск по таблице. */
function renderBlock(S,expanded,mixOpen,view){
  const b=D.BLOCK_BY_KEY[S.tab];
  const mod=blocks[b.key];
  /* под-вкладка проверяется по списку блока: после перекомпоновки вкладок ссылка
     с ?sub=speed или ?sub=conv ведёт в никуда, и экран собирался бы наполовину */
  if(!S.subTab||!mod.subTabs.some(t=>t[0]===S.subTab))S.subTab=mod.defaultSub;
  const root=currentRoot(S), rootNode=D.NODE_BY_PATH[root];
  const rl=D.reportLeaves(S), bl=D.benchmarkLeaves(S);
  const mainK=blockMain(b.key,S);
  /* Срез состава живёт только на «Структуре численности» и только там читается.
     Гейт по блоку не перестраховка: подпись «N чел» под именем подразделения
     стоит на КАЖДОЙ вкладке, и без него срез, взятый в составе, молча ужимал бы
     численность в оттоке и найме — там, где его никто не брал и не видит.
     Режутся только счётные метрики численности, остальное `lastValSlice`
     пропускает через обычную агрегацию (`D.sliceable`). */
  const slice=b.key==='structure'?D.sliceParse(S.mixSel):[];
  const selIds=slice.map(p=>p.id);
  const val=(lp,key)=>D.lastValSlice(lp,key,selIds);
  /* mets — выбранные пользователем метрики блока. Отсюда и столбцы сводной
     таблицы, и KPI-карточки над ней. Графики в правой панели от набора
     не зависят: они рисуют смысл блока, а не список метрик. */
  const mets=D.visibleMetricsOfBlock(b.key,S);

  if(!rl.length){
    return '<div class="page-h"><h2>'+esc(b.name)+'</h2><p>'+esc(b.hint)+'</p></div>'+
      U.empty('Нет данных по выбранным разрезам','Снимите один из разрезов в шапке отчёта.');
  }
  const tq=String(view&&view.tq||'').trim();
  const isEmpty=p=>!rowLeaves(p,S).length;
  const rows=pivotRows(root,expanded,isEmpty,tq);
  /* инсайт про концентрацию считается по первому уровню всегда — от
     раскрытий и набранного поиска он зависеть не должен */
  const baseRows=pivotRows(root,new Set(),isEmpty);
  /* выбранной может быть только строка внутри юнита отчёта: после перехода
     прежний выбор указывал бы мимо таблицы */
  const sel=S.selNode&&D.NODE_BY_PATH[S.selNode]&&S.selNode.indexOf(root+'/')===0?S.selNode:root;
  const selNode=D.NODE_BY_PATH[sel];

  /* 1 · заголовок: название слева, переход на детальный дашборд справа.
     Метрика с KPI из «сравнимых с базой» вычтена: она сравнивается с целью,
     и обещать по ней базу в подзаголовке было бы неправдой. */
  const kpiMets=mets.filter(m=>D.kpiFor(m.key,S));
  const cmpMets=mets.filter(m=>D.comparable(m.key)&&!D.kpiFor(m.key,S));
  const cmpTxt=(cmpMets.length
      ? 'Сравнение с базой <b>'+esc(D.benchmarkLabel(S))+'</b>.'
      : kpiMets.length?'':'Метрики блока абсолютные — с базой не сравниваются.')+
    (kpiMets.length?' У метрик с утверждённым KPI сравнение идёт с целью, а не с базой.':'');
  /* «Детальный дашборд» ведёт туда, где блок есть в Proteus: при покраске HQ —
     в HQ-версию 34136, иначе в общую 34661; HQ-блоки — всегда в 34136. */
  const dash=D.blockDash(b.key,S);
  let h='<div class="page-h"><div class="ph-row"><h2>'+esc(b.name)+'</h2>'+
    '<a class="btn dash" href="'+(dash?dash.href:b.drillUrl)+'" target="_blank" rel="noopener"'+
    (dash?U.tipAttr({title:'Дашборд Proteus '+dash.id,text:'«'+dash.name+'» — детальный слой этого блока.',
      note:dash.only?'Блок есть только в этой версии дашборда.'
        :'Блок есть в обеих версиях: при покраске HQ открывается HQ-версия, иначе общая.'}):'')+
    '>Детальный дашборд'+U.icoExt()+'</a></div>'+
    '<p>'+esc(b.hint)+' '+cmpTxt+'</p></div>';

  /* 2 · инсайт */
  h+=INS.html({S,b,mainK,rl,bl,rows:baseRows,rowLeaves:p=>rowLeaves(p,S)});

  /* 4 · KPI блока
     Дельта и ориентир разведены по строкам карточки: в первой — изменение и
     месяц, с которым оно сравнивается, во второй — цель KPI или база. Пока
     они стояли в одной строке, «+3» и «база 4,1%» читались как одно
     сравнение, хотя это два разных. Классы n2…n5 держат ровно столько колонок,
     сколько метрик: у движения персонала их теперь пять. */
  /* n1…n8: колонок ровно столько, сколько метрик. После итерации 28 у движения
     персонала их семь — полоса на ноутбуке переносится на два ряда по четыре. */
  h+='<div class="kpis compact n'+Math.min(8,mets.length)+'">';
  mets.forEach(m=>{
    const sliced=selIds.length&&D.sliceable(m.key);
    const ser=sliced?D.aggregateSlice(rl,m.key,selIds):D.aggregate(rl,m.key);
    const v=val(rl,m.key);
    /* Изменение по срезу считается по окну, а не по расширенной сетке: срез
       на неё не ходит. Для численности это тот же прошлый месяц. */
    const mom=sliced?D.sliceDeltaMoM(rl,m.key,selIds):D.deltasOf(rl,m.key).mom;
    const kpi=D.kpiFor(m.key,S), bv=D.lastVal(bl,m.key);
    const st=kpi?D.stateForKpi(m.key,v,kpi):D.compareState(m.key,v,bv);
    h+=U.kpiCard({label:m.name,tag:D.isDev(m.key)?U.devTag(D.devStage(m.key)):'',
      q:U.infoDot(m.key),
      value:D.fmtVal(m.key,v),
      row1:U.momChip(m.key,mom)+cardSpark(m.key,ser,st,S,bl),
      row2:kpi?'<span class="k-sub">цель '+D.fmtVal(m.key,kpi.green)+'</span><span class="kpi-tag">KPI</span>'
           :cardBase(m.key,kpi)?U.byCompany(m.key,bv,S):'',
      /* по срезу состава прошлогоднего значения нет: срез живёт только в окне */
      row3:sliced?'':'год назад <b>'+D.fmtVal(m.key,yearAgo(rl,m.key))+'</b>'});
  });
  h+='</div>';

  /* 4a · что сейчас срезано. Плашка стоит под карточками, а не только в той
     таблице, по которой кликнули: без неё «191 → 59» в карточке выглядит
     поломкой отчёта, а не ответом на свой же клик. */
  h+=U.sliceNote(slice,'в карточках и в таблице подразделений численность показана '+
    'по срезу; база сравнения и инсайты считаются по всему отбору');

  /* 5 · две колонки. Когда колонок метрик шесть и больше (движение персонала,
     найм после итерации 28), сводной таблице нужно больше места, чем графику:
     левая колонка становится шире — иначе главная метрика и «К базе» уезжали
     за край панели под горизонтальную прокрутку. */
  const wideL=mets.length>=7;
  /* Таблица подразделений — по выбору (итерация 32): m-both — таблица слева,
     графики справа (по умолчанию: таблица — основа фильтрации), m-charts —
     графики во всю ширину; share — доля
     таблицы после перетаскивания разделителя (null — раскладка по умолчанию).
     Разметка всегда полная — обе панели и разделитель, — а что видно, решает CSS:
     ниже 1121px (широкой таблице — 1241px) показанная таблица встаёт над графиками. */
  const sp=view&&view.split||{};
  const mode=sp.mode==='charts'?'charts':'both', share=sp.share!=null?sp.share:null;
  h+='<div class="split'+(wideL?' wide-l':'')+' m-'+mode+(share!=null?' custom':'')+'"'+
    (share!=null?' style="--split-l:'+(share*100).toFixed(2)+'fr;--split-r:'+((1-share)*100).toFixed(2)+'fr"':'')+'>';

  /* Состояние каретки ИТОГО: пока раскрыто не всё — она предлагает раскрыть,
     и только когда раскрыты все раскрываемые строки — свернуть. */
  const expandable=expandableRows(root);
  const allOpen=expandable.length>0&&expandable.every(p=>expanded.has(p));

  /* 5a · сводная таблица подразделений
     Колонки «К базе» / «К цели KPI» больше нет (итерация 32, заказчик: «непонятно,
     по какой логике он появляется»). Ориентир — база или цель — живёт в
     KPI-карточках над таблицей и на графиках главы. */
  const totalCells=mets.map(m=>'<td'+(m.key===mainK?' class="lead"':'')+'>'+D.fmtVal(m.key,val(rl,m.key))+'</td>').join('');
  let tbl='<table class="ptable dense tree"><thead><tr><th class="txt"'+
    U.tipAttr({title:'Подразделение',text:'Три уровня вниз от «'+rootNode.name+'». Глубже — выберите строку и откройте её '+
      'юнит иконкой у правого края имени.'})+'>Подразделение</th>'+
    mets.map(m=>'<th'+U.tipAttr({title:m.name,text:m.hint||''})+'>'+esc(m.short)+
      (D.isDev(m.key)?U.devTag(D.devStage(m.key),true):'')+'</th>').join('')+
    '</tr></thead><tbody>'+
    /* ИТОГО первой строкой: при длинном списке итог не должен уезжать под скролл.
       Каретка у ИТОГО раскрывает и сворачивает ВСЁ дерево разом: раскрывать
       десяток подразделений по одному, чтобы увидеть вторые уровни, — работа,
       которую строка итога может сделать одним кликом. Заодно «ИТОГО» встаёт
       на ту же вертикаль, что и названия подразделений под ним: без каретки
       оно было сдвинуто влево на её ширину. */
    '<tr class="total top"><td class="txt"><span class="row-label">'+
    /* при поиске дерево раскрыто принудительно — общей каретке там делать нечего */
    (expandable.length&&!tq
      ? '<button class="caret-btn"'+(allOpen?' data-open="1"':'')+
        ' data-expall="'+(allOpen?'0':'1')+'" aria-label="'+(allOpen?'Свернуть всё':'Развернуть всё')+'"'+
        U.tipAttr({title:allOpen?'Свернуть всё':'Развернуть всё',
          text:'Все три уровня подразделений сразу.'})+'>'+
        (allOpen?'▾':'▸')+'</button>'
      : '<span class="caret-spacer"></span>')+
    '<span class="row-body">ИТОГО</span></span></td>'+totalCells+
    '</tr>';
  rows.forEach(r=>{
    const lp=rowLeaves(r.n.path,S);
    const canExp=!tq&&r.kids>0&&r.depth<TREE_DEPTH, isOpen=expanded.has(r.n.path), isSel=sel===r.n.path;
    /* На границе глубины подразделения ниже не показаны — говорим, сколько их
       и как до них дойти. Число — прямые подразделения, а не все потомки. */
    const below=r.depth===TREE_DEPTH&&r.kids>0?r.kids:0;
    tbl+='<tr class="urow'+(r.depth>1?' lvl'+r.depth:'')+(r.empty?' empty':'')+(isSel?' sel':'')+
      (tq?(r.hit?' hit':' anc'):'')+'" data-node="'+r.n.path+'">'+
      '<td class="txt"><span class="row-label">'+
      (canExp?'<button class="caret-btn"'+(isOpen?' data-open="1"':'')+' data-exp="'+r.n.path+'" aria-label="'+
        (isOpen?'Свернуть':'Раскрыть')+'">'+(isOpen?'▾':'▸')+'</button>':'<span class="caret-spacer"></span>')+
      '<span class="row-body">'+(tq?U.hlText(r.n.name,tq):esc(r.n.name))+
      '<span class="unit-sub">'+esc(r.n.direct?'без подразделения':D.LEVEL_SHORT[r.n.level]||D.levelLabel(r.n.level))+' · '+
        D.fmtVal('hc_total',val(lp,'hc_total'))+' чел'+
      (below?' · <span class="below"'+U.tipAttr({title:'Ниже ещё '+below+' '+U.plural(below,['подразделение','подразделения','подразделений']),
          text:'Таблица показывает три уровня вниз. Глубже — выберите строку и откройте её юнит иконкой у правого края имени.'})+
        '>ниже ещё '+below+'</span>':'')+'</span>'+U.unitHead(r.n)+'</span>'+
      /* переход — только у выбранной строки: клик по строке выбирает, а не уводит */
      /* «Напрямую в «X»» — не юнит, открывать нечего */
      (isSel&&!r.n.direct?U.openUnitBtn(r.n.path,r.n.name):'')+'</span></td>'+
      mets.map(m=>'<td'+(m.key===mainK?' class="lead"':'')+'>'+
        (D.directNA(r.n,m.key)?'—':D.fmtVal(m.key,val(lp,m.key)))+'</td>').join('')+'</tr>';
  });
  /* пустые состояния — строкой в таблице, а не вместо неё: ИТОГО остаётся */
  const ncol=1+mets.length;
  if(!rows.length)tbl+='<tr class="tree-empty"><td class="txt" colspan="'+ncol+'">'+
    (tq?'Подразделений с «'+esc(tq)+'» в трёх уровнях вниз нет. Глубже — откройте юнит; другое подразделение '+
        'компании — в «Настрой свой дашборд».'
      :'У «'+esc(rootNode.name)+'» нет подразделений уровнем ниже — все цифры в строке ИТОГО.')+'</td></tr>';
  tbl+='</tbody></table>';
  /* Подсказка о глубине — в подзаголовке панели: три уровня вниз, глубже —
     переходом. Пока взят срез состава, подзаголовок говорит о нём. */
  h+=U.panel({cls:'split-l',title:'Подразделения',
    subHtml:slice.length?esc('численность по срезу: '+D.sliceLabel(selIds))
      :'три уровня вниз · глубже — откройте юнит '+U.icoOpen(),
    tabs:U.searchBox({q:view&&view.tq||'',placeholder:'Поиск по таблице'}),
    body:tbl,bodyCls:'tbl-wrap'})+U.splitGut(share);

  /* 5b · правая панель — история блока по главам (итерация 32, концепция B).
     Глава = под-вкладка. TPSTORY считает по выбранному узлу вопрос, ответ и
     сигнал каждой главы (степпер), вывод и факты текущей главы и что подписать
     на её графиках (ctx.ann — экраны передают это в опции графиков). */
  const ctx={S,b,sub:S.subTab,lp:rowLeaves(sel,S),rl,bl,rows:baseRows,root,sel,
    mixOpen:mixOpen||new Set(),benchLabel:D.benchmarkLabel(S)};
  const bookC=STY.book(b.key,mod.subTabs,S.subTab,{S,lp:ctx.lp,bl,sel,bench:ctx.benchLabel},
    k=>!!demoNoteFor(b.key,k));
  const ch=bookC.cur;
  ctx.ann=ch.ann||{};ctx.story=ch;
  /* шаг в разработке помечен прямо в степпере — вкладку видно, не открывая */
  bookC.chapters.forEach(c=>{const d=devOf(b.key,c.key);c.dev=d?(d.part?'part':'full'):'';c.devStage=d?d.stage:null});
  const body=U.story({
    steps:U.chapters(bookC.chapters,S.subTab),
    head:U.storyHead(ch.head,ch.lede,ch.act,ch.why,ch.todo),
    main:U.devNote(devOf(b.key,S.subTab))+mod.view(ctx),
    rail:U.storyRail({facts:ch.facts,focus:ch.focus,act:ch.act})});
  /* У выбранной строки переход дублируется в шапке правой панели — рядом
     с её именем, там, куда смотрят, читая её графики. */
  h+=U.panel({cls:'split-r',title:mod.title(S.subTab),
    subHtml:esc(selNode.name)+(sel!==root?' · выбрано'+(selNode.direct?'':U.openUnitBtn(sel,selNode.name,'Открыть юнит')):' · всё подразделение')+
      (bookC.chapters.length>1?' · глава '+(bookC.idx+1)+' из '+bookC.chapters.length:''),
    hBtn:U.unitToggle(mode==='both'),
    body:body,bodyCls:'st-on'});

  return h+'</div>';
}

window.TPSCREENS={blocks,renderBlock,currentRoot,rowLeaves,sumS,blockMain,pivotRows,
  expandableRows,devOf,blockDev,metricLine,yoyChart,yoyPanels,yoyPair,selLabel,yearAgo,TREE_DEPTH};
})();

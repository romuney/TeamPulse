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
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, INS=window.TPINSIGHTS;
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
    D.childrenOf(p).forEach(n=>{
      if(d<TREE_DEPTH&&D.childrenOf(n.path).length){out.push(n.path);walk(n.path,d+1)}
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
    order(D.childrenOf(p)).forEach(n=>{
      const kids=D.childrenOf(n.path).length;
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
/* Линия метрики с базой. База не рисуется в двух случаях: у несравнимых метрик
   (там она вводит в заблуждение) и у метрик с утверждённым KPI — на графике
   остаются пороги цели, и вторая пунктирная линия рядом с ними спорила бы с
   ними за роль ориентира. */
/* График «год к году» — тот же выбор ориентира, что и у metricLine:
   цель KPI или база, и только для текущего года. */
function yoyChart(key,lp,bl,S,opt){
  const kpi=D.kpiFor(key,S), cmp=D.comparable(key)&&!kpi, bench=D.benchmarkLabel(S);
  const y=D.yoySeries(lp,key), by=cmp?D.yoySeries(bl,key).cur:null;
  /* у накопительной метрики с прогнозом (fc) декабрь получает точку run-rate:
     «чем закончится год, если темп сохранится» читается прямо на полотне */
  const fcK=(D.METRIC_BY_KEY[key]||{}).fc;
  const legend=[{name:String(D.YEAR_CUR),color:G.C_LINE},{name:String(D.YEAR_PREV),color:G.C_PREV}]
    .concat(cmp?[{name:bench,color:G.C_BENCH,dash:true}]:[]);
  return G.chart('yoy',{metricKey:key,cur:y.cur,prev:y.prev,bench:by},
    Object.assign({legend,benchName:bench,kpi:kpi,fc:fcK?D.lastVal(lp,fcK):null,h:300,fill:true},opt||{}));
}
/* Переключатель «12 мес / год к году» для вкладок, где динамика нарисована
   панелями: в режиме года каждая метрика получает своё полотно год к году. */
function dynWrap(ctx,rollHtml,items){
  if(ctx.S.dyn!=='yoy')return U.dynSwitch('roll')+rollHtml;
  return U.dynSwitch('yoy')+items.map(it=>yoyChart(it.key,ctx.lp,ctx.bl,ctx.S,
    {title:it.title,h:it.h||250,fill:false})).join('');
}
/* Заголовок графика, который в режиме «год к году» остаётся на скользящем окне
   (дивергент, водопад: их ось — двенадцать месяцев подряд, календарного года у
   них нет). Под переключателем «Год к году» такой график без подписи читался бы
   как тоже календарный — называем окно прямо в заголовке. */
function winTitle(S,title){return S.dyn==='yoy'?title+' · 12 мес, '+D.PERIOD_LABEL:title}
function metricLine(key,lp,bl,S,opt){
  if(S.dyn==='yoy'&&!(opt&&opt.noSwitch))
    return U.dynSwitch('yoy')+yoyChart(key,lp,bl,S,Object.assign({},opt||{},
      {title:(opt&&opt.title?opt.title+' · ':'')+'год к году'}));
  const kpi=D.kpiFor(key,S), cmp=D.comparable(key)&&!kpi, bench=D.benchmarkLabel(S);
  return (opt&&opt.noSwitch?'':U.dynSwitch('roll'))+G.chart('line',{metricKey:key,series:D.aggregate(lp,key),bench:cmp?D.aggregate(bl,key):null},
    Object.assign({legend:cmp?[{name:selLabel(S),color:G.C_LINE},{name:bench,color:G.C_BENCH,dash:true}]:null,
      benchName:bench,kpi:kpi,h:300,fill:true},opt||{}));
}

/* Спарклайн в карточке KPI блока (рекомендация бизнес-анализа: динамика
   читается без перехода на график). Правило то же, что в колонке «12 мес»
   one-pager: у метрики без оценки — тёмно-серая линия с поднятой шкалой,
   у метрики со светофором — линия цвета оценки, месяц сравнивается с базой
   этого месяца или с целью KPI. */
function cardSpark(key,ser,st,S,bl){
  const m=D.METRIC_BY_KEY[key], kpi=D.kpiFor(key,S);
  const noEval=!kpi&&(!D.comparable(key)||m.better==='flat');
  return G.sparkLine(ser,noEval?'neutral':st,84,24,{key:key,kpi:kpi,ink:noEval,fit:noEval,
    base:!kpi&&D.comparable(key)?D.aggregate(bl,key):null});
}
/* Значение того же месяца год назад — прямо из расширенной сетки, а не
   «значение минус изменение»: у доли без знаменателя изменения нет. */
function yearAgo(lp,key){return D.aggregateExt(lp,key)[D.NEXT-13]}

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
  const mainK=blockMain(b.key,S), mainM=D.METRIC_BY_KEY[mainK];
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
    h+=U.kpiCard({label:m.name,
      q:U.infoDot(m.key),
      value:D.fmtVal(m.key,v),
      row1:U.momChip(m.key,mom)+cardSpark(m.key,ser,st,S,bl),
      row2:kpi?'<span class="k-sub">цель '+D.fmtVal(m.key,kpi.green)+'</span><span class="kpi-tag">KPI</span>'
           :D.comparable(m.key)?'<span class="k-sub">база '+D.fmtVal(m.key,bv)+'</span>':U.noCmpMark(),
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
  const wideL=mets.length+(D.comparable(mainK)||D.kpiFor(mainK,S)?1:0)>=7;
  h+='<div class="split'+(wideL?' wide-l':'')+'">';

  /* Состояние каретки ИТОГО: пока раскрыто не всё — она предлагает раскрыть,
     и только когда раскрыты все раскрываемые строки — свернуть. */
  const expandable=expandableRows(root);
  const allOpen=expandable.length>0&&expandable.every(p=>expanded.has(p));

  /* 5a · сводная таблица подразделений
     Ориентир колонки один и тот же для всей таблицы: цель KPI, если она у
     главной метрики есть, иначе средняя по базе. Сравнивать подразделение с
     базой, когда по метрике утверждён KPI, — значит мерить не тем. */
  const kpiMain=D.kpiFor(mainK,S);
  const benchMain=kpiMain?kpiMain.green:D.lastVal(bl,mainK);
  const showVs=D.comparable(mainK)||!!kpiMain;
  const totalCells=mets.map(m=>'<td'+(m.key===mainK?' class="lead"':'')+'>'+D.fmtVal(m.key,val(rl,m.key))+'</td>').join('');
  let tbl='<table class="ptable dense tree"><thead><tr><th class="txt"'+
    U.tipAttr({title:'Подразделение',text:'Три уровня вниз от «'+rootNode.name+'». Глубже — выберите строку и откройте её '+
      'юнит иконкой у правого края имени.'})+'>Подразделение</th>'+
    mets.map(m=>'<th'+U.tipAttr({title:m.name,text:m.hint||''})+'>'+esc(m.short)+'</th>').join('')+
    (showVs?'<th class="vs">'+(kpiMain?'К цели KPI':'К базе')+'<span class="hint-col">'+esc(mainM.short)+'</span></th>':'')+
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
    (showVs?'<td class="vs"><span class="cell neutral">'+D.fmtVal(mainK,benchMain)+'</span></td>':'')+
    '</tr>';
  rows.forEach(r=>{
    const lp=rowLeaves(r.n.path,S);
    const v=D.lastVal(lp,mainK);
    const st=kpiMain?D.stateForKpi(mainK,v,kpiMain):D.compareState(mainK,v,benchMain);
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
      '<span class="unit-sub">'+esc(D.LEVEL_SHORT[r.n.level]||D.levelLabel(r.n.level))+' · '+
        D.fmtVal('hc_total',val(lp,'hc_total'))+' чел'+
      (below?' · <span class="below"'+U.tipAttr({title:'Ниже ещё '+below+' '+U.plural(below,['подразделение','подразделения','подразделений']),
          text:'Таблица показывает три уровня вниз. Глубже — выберите строку и откройте её юнит иконкой у правого края имени.'})+
        '>ниже ещё '+below+'</span>':'')+'</span></span>'+
      /* переход — только у выбранной строки: клик по строке выбирает, а не уводит */
      (isSel?U.openUnitBtn(r.n.path,r.n.name):'')+'</span></td>'+
      mets.map(m=>'<td'+(m.key===mainK?' class="lead"':'')+'>'+D.fmtVal(m.key,val(lp,m.key))+'</td>').join('')+
      /* у пустого подразделения 0% — не «лучше базы», а отсутствие людей */
      (showVs?'<td class="vs">'+(r.empty||v==null||benchMain==null?'<span class="cell neutral">—</span>'
        :'<span class="cell '+st+'">'+D.fmtDelta(mainK,+(v-benchMain).toFixed(4))+'</span>')+'</td>':'')+'</tr>';
  });
  /* пустые состояния — строкой в таблице, а не вместо неё: ИТОГО остаётся */
  const ncol=1+mets.length+(showVs?1:0);
  if(!rows.length)tbl+='<tr class="tree-empty"><td class="txt" colspan="'+ncol+'">'+
    (tq?'Подразделений с «'+esc(tq)+'» в трёх уровнях вниз нет. Глубже — откройте юнит; другое подразделение '+
        'компании — в «Настрой свой дашборд».'
      :'У «'+esc(rootNode.name)+'» нет подразделений уровнем ниже — все цифры в строке ИТОГО.')+'</td></tr>';
  tbl+='</tbody></table>';
  /* Подсказка о глубине — в подзаголовке панели: три уровня вниз, глубже —
     переходом. Пока взят срез состава, подзаголовок говорит о нём. */
  h+=U.panel({cls:'split-l',title:'Подразделения',
    subHtml:slice.length?esc('численность по срезу: '+D.sliceLabel(selIds))
      :'три уровня вниз · глубже: выберите строку и откройте юнит '+U.icoOpen(),
    tabs:U.searchBox({q:view&&view.tq||'',placeholder:'Поиск по таблице'}),
    body:tbl,bodyCls:'tbl-wrap'});

  /* 5b · правая панель — содержимое блока */
  const ctx={S,b,sub:S.subTab,lp:rowLeaves(sel,S),rl,bl,rows:baseRows,root,sel,
    mixOpen:mixOpen||new Set(),benchLabel:D.benchmarkLabel(S)};
  /* У выбранной строки переход дублируется в шапке правой панели — рядом
     с её именем, там, куда смотрят, читая её графики. */
  h+=U.panel({cls:'split-r',title:mod.title(S.subTab),
    subHtml:esc(selNode.name)+(sel!==root?' · выбрано'+U.openUnitBtn(sel,selNode.name,'Открыть юнит'):' · всё подразделение'),
    tabs:U.subTabs(mod.subTabs,S.subTab),body:mod.view(ctx)});

  return h+'</div>';
}

window.TPSCREENS={blocks,renderBlock,currentRoot,rowLeaves,sumS,blockMain,pivotRows,
  expandableRows,metricLine,yoyChart,dynWrap,winTitle,selLabel,yearAgo,TREE_DEPTH};
})();

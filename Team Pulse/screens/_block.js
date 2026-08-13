/* ============================================================================
   screens/_block.js — общий каркас детальной вкладки и реестр экранов.
   Неймспейс: window.TPSCREENS. Загружается ПЕРВЫМ среди screens/*.

   Каркас одинаков для всех семи блоков: заголовок → инсайт → тулбар →
   KPI блока → две колонки (таблица подразделений слева, содержимое справа).
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
     rows       — строки сводной таблицы
     root, sel  — пути текущего корня и выбранного узла
     benchLabel — подпись базы сравнения
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, INS=window.TPINSIGHTS;
const esc=U.esc;

const blocks={};

/* ---------- общие помощники, доступны экранам ---------- */
function currentRoot(S){return S.drillRoot||S.unit}
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
/* Строки первого уровня, у которых есть что раскрывать. Ими и только ими
   управляет каретка в ИТОГО: глубже второго уровня сводная таблица не идёт,
   поэтому «раскрыть всё» — это ровно они. */
function expandableRows(root){
  return D.nodesBelow(root,1).filter(n=>D.childrenOf(n.path).length).map(n=>n.path);
}
function pivotRows(root,expanded){
  const rows=[];
  D.nodesBelow(root,1).forEach(n=>{
    rows.push({n:n,depth:1});
    if(expanded.has(n.path))D.childrenOf(n.path).forEach(c=>rows.push({n:c,depth:2}));
  });
  return rows;
}
/* Имя того, что сейчас показано в правой панели: выбранная строка таблицы,
   иначе временный корень, иначе выбранное подразделение. Именно этим именем
   подписана синяя линия в легенде: «значение» ничего не объясняет. */
function selLabel(S){
  const n=D.NODE_BY_PATH[S.selNode]||D.NODE_BY_PATH[S.drillRoot]||D.NODE_BY_PATH[S.unit];
  return n?n.name:'Ваша команда';
}
/* Линия метрики с базой. База не рисуется в двух случаях: у несравнимых метрик
   (там она вводит в заблуждение) и у метрик с утверждённым KPI — на графике
   остаются пороги цели, и вторая пунктирная линия рядом с ними спорила бы с
   ними за роль ориентира. */
function metricLine(key,lp,bl,S,opt){
  const kpi=D.kpiFor(key,S), cmp=D.comparable(key)&&!kpi, bench=D.benchmarkLabel(S);
  return G.chart('line',{metricKey:key,series:D.aggregate(lp,key),bench:cmp?D.aggregate(bl,key):null},
    Object.assign({legend:cmp?[{name:selLabel(S),color:G.C_LINE},{name:bench,color:G.C_BENCH,dash:true}]:null,
      benchName:bench,kpi:kpi,h:300,fill:true},opt||{}));
}

/* ---------- рендер детальной вкладки ---------- */
function renderBlock(S,expanded,mixOpen){
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
  const rows=pivotRows(root,expanded);
  const sel=S.selNode&&D.NODE_BY_PATH[S.selNode]?S.selNode:root;
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
  let h='<div class="page-h"><div class="ph-row"><h2>'+esc(b.name)+'</h2>'+
    '<a class="btn dash" href="'+b.drillUrl+'" target="_blank" rel="noopener">Детальный дашборд'+U.icoExt()+'</a></div>'+
    '<p>'+esc(b.hint)+' '+cmpTxt+'</p></div>';

  /* 2 · инсайт */
  h+=INS.html({S,b,mainK,rl,bl,rows,rowLeaves:p=>rowLeaves(p,S)});

  /* 3 · тулбар только при временном корне */
  if(S.drillRoot){
    h+='<div class="toolbar slim"><div class="sp"></div>'+
      '<button class="btn" data-undrill="1">↑ Вернуться к '+esc(D.NODE_BY_PATH[S.unit].name)+'</button></div>'+
      '<div class="note-inline">Временный корень: <b>'+esc(rootNode.name)+'</b>. База сравнения не меняется.</div>';
  }

  /* 4 · KPI блока
     Дельта и ориентир разведены по строкам карточки: в первой — изменение и
     месяц, с которым оно сравнивается, во второй — цель KPI или база. Пока
     они стояли в одной строке, «+3» и «база 4,1%» читались как одно
     сравнение, хотя это два разных. Классы n2…n5 держат ровно столько колонок,
     сколько метрик: у движения персонала их теперь пять. */
  h+='<div class="kpis compact'+(mets.length<=5?' n'+mets.length:'')+'">';
  mets.forEach(m=>{
    const v=val(rl,m.key);
    /* Изменение по срезу считается по окну, а не по расширенной сетке: срез
       на неё не ходит. Для численности это тот же прошлый месяц. */
    const mom=selIds.length&&D.sliceable(m.key)
      ? D.sliceDeltaMoM(rl,m.key,selIds) : D.deltasOf(rl,m.key).mom;
    const kpi=D.kpiFor(m.key,S), bv=D.lastVal(bl,m.key);
    h+=U.kpiCard({label:m.name,
      q:U.infoDot(m.key),
      value:D.fmtVal(m.key,v),
      row1:U.momChip(m.key,mom),
      row2:kpi?'<span class="k-sub">цель '+D.fmtVal(m.key,kpi.green)+'</span><span class="kpi-tag">KPI</span>'
           :D.comparable(m.key)?'<span class="k-sub">база '+D.fmtVal(m.key,bv)+'</span>':U.noCmpMark()});
  });
  h+='</div>';

  /* 4a · что сейчас срезано. Плашка стоит под карточками, а не только в той
     таблице, по которой кликнули: без неё «191 → 59» в карточке выглядит
     поломкой отчёта, а не ответом на свой же клик. */
  h+=U.sliceNote(slice,'в карточках и в таблице подразделений численность показана '+
    'по срезу; база сравнения и инсайты считаются по всему отбору');

  /* 5 · две колонки */
  h+='<div class="split">';

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
  let tbl='<table class="ptable dense"><thead><tr><th class="txt">Подразделение</th>'+
    mets.map(m=>'<th'+U.tipAttr({title:m.name,text:m.hint||''})+'>'+esc(m.short)+'</th>').join('')+
    (showVs?'<th class="vs">'+(kpiMain?'К цели KPI':'К базе')+'<span class="hint-col">'+esc(mainM.short)+'</span></th>':'')+
    '<th></th></tr></thead><tbody>'+
    /* ИТОГО первой строкой: при длинном списке итог не должен уезжать под скролл.
       Каретка у ИТОГО раскрывает и сворачивает ВСЁ дерево разом: раскрывать
       десяток подразделений по одному, чтобы увидеть вторые уровни, — работа,
       которую строка итога может сделать одним кликом. Заодно «ИТОГО» встаёт
       на ту же вертикаль, что и названия подразделений под ним: без каретки
       оно было сдвинуто влево на её ширину. */
    '<tr class="total top"><td class="txt"><span class="row-label">'+
    (expandable.length
      ? '<button class="caret-btn"'+(allOpen?' data-open="1"':'')+
        ' data-expall="'+(allOpen?'0':'1')+'" aria-label="'+(allOpen?'Свернуть всё':'Развернуть всё')+'"'+
        U.tipAttr({title:allOpen?'Свернуть всё':'Развернуть всё',
          text:'Вторые уровни всех подразделений сразу.'})+'>'+
        (allOpen?'▾':'▸')+'</button>'
      : '<span class="caret-spacer"></span>')+
    '<span class="row-body">ИТОГО</span></span></td>'+totalCells+
    (showVs?'<td class="vs"><span class="cell neutral">'+D.fmtVal(mainK,benchMain)+'</span></td>':'')+
    '<td></td></tr>';
  rows.forEach(r=>{
    const lp=rowLeaves(r.n.path,S);
    const v=D.lastVal(lp,mainK);
    const st=kpiMain?D.stateForKpi(mainK,v,kpiMain):D.compareState(mainK,v,benchMain);
    const kids=D.childrenOf(r.n.path).length, canExp=r.depth===1&&kids>0;
    tbl+='<tr class="urow'+(r.depth===2?' lvl2':'')+(sel===r.n.path?' sel':'')+'" data-node="'+r.n.path+'">'+
      '<td class="txt"><span class="row-label">'+
      (canExp?'<button class="caret-btn"'+(expanded.has(r.n.path)?' data-open="1"':'')+' data-exp="'+r.n.path+'" aria-label="Раскрыть">'+(expanded.has(r.n.path)?'▾':'▸')+'</button>':'<span class="caret-spacer"></span>')+
      '<span class="row-body">'+esc(r.n.name)+
      '<span class="unit-sub">'+D.fmtVal('hc_total',val(lp,'hc_total'))+' чел</span></span></span></td>'+
      mets.map(m=>'<td'+(m.key===mainK?' class="lead"':'')+'>'+D.fmtVal(m.key,val(lp,m.key))+'</td>').join('')+
      (showVs?'<td class="vs"><span class="cell '+st+'">'+D.fmtDelta(mainK,+(v-benchMain).toFixed(1))+'</span></td>':'')+
      '<td>'+(kids>0?'<button class="btn ghost xs" data-drill="'+r.n.path+'"'+
        U.tipAttr({title:'Сделать корнем',
          text:'Показать детей «'+r.n.name+'» отдельным списком. База сравнения не меняется.'})+'>↓</button>':'')+'</td></tr>';
  });
  tbl+='</tbody></table>';
  h+=U.panel({cls:'split-l',title:'Подразделения',
    sub:slice.length?'численность по срезу: '+D.sliceLabel(selIds)
                    :'клик по строке фильтрует правую панель',
    body:tbl,bodyCls:'tbl-wrap'});

  /* 5b · правая панель — содержимое блока */
  const ctx={S,b,sub:S.subTab,lp:rowLeaves(sel,S),rl,bl,rows,root,sel,
    mixOpen:mixOpen||new Set(),benchLabel:D.benchmarkLabel(S)};
  h+=U.panel({cls:'split-r',title:mod.title(S.subTab),
    sub:selNode.name+(sel!==root?' · выбрано':' · всё подразделение'),
    tabs:U.subTabs(mod.subTabs,S.subTab),body:mod.view(ctx)});

  return h+'</div>';
}

window.TPSCREENS={blocks,renderBlock,currentRoot,rowLeaves,sumS,blockMain,pivotRows,
  expandableRows,metricLine,selLabel};
})();

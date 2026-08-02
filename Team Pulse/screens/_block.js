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
/* линия метрики с базой; для несравнимых метрик база не рисуется — она вводит в заблуждение */
function metricLine(key,lp,bl,S,opt){
  const cmp=D.comparable(key), bench=D.benchmarkLabel(S);
  return G.chart('line',{metricKey:key,series:D.aggregate(lp,key),bench:cmp?D.aggregate(bl,key):null},
    Object.assign({legend:cmp?[{name:selLabel(S),color:G.C_LINE},{name:bench,color:G.C_BENCH,dash:true}]:null,
      benchName:bench,kpi:D.kpiFor(key,S),h:300,fill:true},opt||{}));
}

/* ---------- рендер детальной вкладки ---------- */
function renderBlock(S,expanded){
  const b=D.BLOCK_BY_KEY[S.tab];
  const mod=blocks[b.key];
  /* под-вкладка проверяется по списку блока: после перекомпоновки вкладок ссылка
     с ?sub=speed или ?sub=conv ведёт в никуда, и экран собирался бы наполовину */
  if(!S.subTab||!mod.subTabs.some(t=>t[0]===S.subTab))S.subTab=mod.defaultSub;
  const root=currentRoot(S), rootNode=D.NODE_BY_PATH[root];
  const rl=D.reportLeaves(S), bl=D.benchmarkLeaves(S);
  const mainK=blockMain(b.key,S), mainM=D.METRIC_BY_KEY[mainK];
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

  /* 1 · заголовок: название слева, переход на детальный дашборд справа */
  const cmpMets=mets.filter(m=>D.comparable(m.key));
  let h='<div class="page-h"><div class="ph-row"><h2>'+esc(b.name)+'</h2>'+
    '<a class="btn dash" href="'+b.drillUrl+'" target="_blank" rel="noopener">Детальный дашборд'+U.icoExt()+'</a></div>'+
    '<p>'+esc(b.hint)+' '+(cmpMets.length
      ? 'Сравнение с базой <b>'+esc(D.benchmarkLabel(S))+'</b>.'
      : 'Метрики блока абсолютные — с базой не сравниваются.')+'</p></div>';

  /* 2 · инсайт */
  h+=INS.html({S,b,mainK,rl,bl,rows,rowLeaves:p=>rowLeaves(p,S)});

  /* 3 · тулбар только при временном корне */
  if(S.drillRoot){
    h+='<div class="toolbar slim"><div class="sp"></div>'+
      '<button class="btn" data-undrill="1">↑ Вернуться к '+esc(D.NODE_BY_PATH[S.unit].name)+'</button></div>'+
      '<div class="note-inline">Временный корень: <b>'+esc(rootNode.name)+'</b>. База сравнения не меняется.</div>';
  }

  /* 4 · KPI блока */
  h+='<div class="kpis compact'+(mets.length<=4?' n'+mets.length:'')+'">';
  mets.forEach(m=>{
    const sr=D.aggregate(rl,m.key), v=sr[D.LAST], dl=D.deltasOf(rl,m.key);
    const kpi=D.kpiFor(m.key,S), bv=D.lastVal(bl,m.key);
    h+=U.kpiCard({label:m.name,
      q:U.infoDot(m.key),
      value:D.fmtVal(m.key,v),
      row1:U.deltaChip(m.key,dl.mom)+
        (kpi?'<span class="k-sub">цель '+D.fmtVal(m.key,kpi.green)+'</span>'
           :D.comparable(m.key)?'<span class="k-sub">база '+D.fmtVal(m.key,bv)+'</span>':U.noCmpMark())+
        (kpi?'<span class="kpi-tag">KPI</span>':'')});
  });
  h+='</div>';

  /* 5 · две колонки */
  h+='<div class="split">';

  /* 5a · сводная таблица подразделений */
  const benchMain=D.lastVal(bl,mainK);
  const showVs=D.comparable(mainK);
  const totalCells=mets.map(m=>'<td'+(m.key===mainK?' class="lead"':'')+'>'+D.fmtVal(m.key,D.lastVal(rl,m.key))+'</td>').join('');
  let tbl='<table class="ptable dense"><thead><tr><th class="txt">Подразделение</th>'+
    mets.map(m=>'<th'+U.tipAttr({title:m.name,text:m.hint||''})+'>'+esc(m.short)+'</th>').join('')+
    (showVs?'<th class="vs">К базе<span class="hint-col">'+esc(mainM.short)+'</span></th>':'')+
    '<th></th></tr></thead><tbody>'+
    /* ИТОГО первой строкой: при длинном списке итог не должен уезжать под скролл */
    '<tr class="total top"><td class="txt">ИТОГО</td>'+totalCells+
    (showVs?'<td class="vs"><span class="cell neutral">'+D.fmtVal(mainK,benchMain)+'</span></td>':'')+
    '<td></td></tr>';
  rows.forEach(r=>{
    const lp=rowLeaves(r.n.path,S);
    const v=D.lastVal(lp,mainK), st=D.compareState(mainK,v,benchMain);
    const kids=D.childrenOf(r.n.path).length, canExp=r.depth===1&&kids>0;
    tbl+='<tr class="urow'+(r.depth===2?' lvl2':'')+(sel===r.n.path?' sel':'')+'" data-node="'+r.n.path+'">'+
      '<td class="txt"><span class="row-label">'+
      (canExp?'<button class="caret-btn"'+(expanded.has(r.n.path)?' data-open="1"':'')+' data-exp="'+r.n.path+'" aria-label="Раскрыть">'+(expanded.has(r.n.path)?'▾':'▸')+'</button>':'<span class="caret-spacer"></span>')+
      '<span class="row-body">'+esc(r.n.name)+
      '<span class="unit-sub">'+D.fmtVal('hc_total',D.lastVal(lp,'hc_total'))+' чел</span></span></span></td>'+
      mets.map(m=>'<td'+(m.key===mainK?' class="lead"':'')+'>'+D.fmtVal(m.key,D.lastVal(lp,m.key))+'</td>').join('')+
      (showVs?'<td class="vs"><span class="cell '+st+'">'+D.fmtDelta(mainK,+(v-benchMain).toFixed(1))+'</span></td>':'')+
      '<td>'+(kids>0?'<button class="btn ghost xs" data-drill="'+r.n.path+'"'+
        U.tipAttr({title:'Сделать корнем',
          text:'Показать детей «'+r.n.name+'» отдельным списком. База сравнения не меняется.'})+'>↓</button>':'')+'</td></tr>';
  });
  tbl+='</tbody></table>';
  h+=U.panel({cls:'split-l',title:'Подразделения',sub:'клик по строке фильтрует правую панель',
    body:tbl,bodyCls:'tbl-wrap'});

  /* 5b · правая панель — содержимое блока */
  const ctx={S,b,sub:S.subTab,lp:rowLeaves(sel,S),rl,bl,rows,root,sel,benchLabel:D.benchmarkLabel(S)};
  h+=U.panel({cls:'split-r',title:mod.title(S.subTab),
    sub:selNode.name+(sel!==root?' · выбрано':' · всё подразделение'),
    tabs:U.subTabs(mod.subTabs,S.subTab),body:mod.view(ctx)});

  return h+'</div>';
}

window.TPSCREENS={blocks,renderBlock,currentRoot,rowLeaves,sumS,blockMain,pivotRows,metricLine,selLabel};
})();

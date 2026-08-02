/* ============================================================================
   screens/onepager.js — сводка по всем метрикам на одном экране.
   Семь блоков таблицами, у каждой метрики значение, MoM, YoY, спарклайн и
   сравнение с базой. Клик по строке раскрывает график метрики внутри таблицы.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, SC=window.TPSCREENS;
const esc=U.esc;

const HERO=['hc_total','hire','attrition','turnover_y','regret','office_att'];

/* Имя выбранного подразделения — именно им подписана синяя линия в легенде. */
function unitName(S){const n=D.NODE_BY_PATH[S.unit];return n?n.name:'Ваша команда'}

/* ---------- тексты сводки ---------- */
function worstMetrics(S,rl,bl,limit){
  const out=[];
  D.METRICS.forEach(m=>{
    /* отключённая метрика не должна всплывать в тексте сводки: пользователь
       не найдёт её ни в таблице, ни в KPI */
    if(!D.metricVisible(m.key,S))return;
    if(m.better==='flat')return;
    const v=D.lastVal(rl,m.key), bv=D.lastVal(bl,m.key), kpi=D.kpiFor(m.key,S);
    const st=kpi?D.stateForKpi(m.key,v,kpi):D.compareState(m.key,v,bv);
    if(st==='bad')out.push({m,v,bv,base:kpi?kpi.green:bv,kpi:!!kpi});
  });
  return out.slice(0,limit||3);
}
function bestMetrics(S,rl,bl,limit){
  const out=[];
  D.METRICS.forEach(m=>{
    if(!D.metricVisible(m.key,S))return;
    if(m.better==='flat')return;
    const v=D.lastVal(rl,m.key), bv=D.lastVal(bl,m.key);
    if(D.compareState(m.key,v,bv)==='good')out.push({m,v,bv});
  });
  return out.slice(0,limit||2);
}
function lead(S,rl,bl){
  const hc=D.lastVal(rl,'hc_total'), w=worstMetrics(S,rl,bl,3);
  return 'В отборе <b>'+D.fmtInt(hc)+' чел</b> из '+D.fmtInt(rl.length)+' команд, база сравнения — <b>'+
    esc(D.benchmarkLabel(S))+'</b>. '+
    (w.length?'Требуют внимания: '+w.map(x=>esc(x.m.name)).join(', ')+'.':'Критичных отклонений от базы нет.');
}
function bullets(S,rl,bl){
  const out=[];
  worstMetrics(S,rl,bl,3).forEach(x=>{
    out.push('<b>'+esc(x.m.name)+'</b>: '+D.fmtVal(x.m.key,x.v)+' при '+(x.kpi?'цели KPI ':'базе ')+
      D.fmtVal(x.m.key,x.base)+'. Отклонение '+D.fmtDelta(x.m.key,+(x.v-x.base).toFixed(1))+
      ' — смотрите разбивку по подразделениям в блоке «'+esc(D.BLOCK_BY_KEY[x.m.block].name)+'».');
  });
  bestMetrics(S,rl,bl,2).forEach(x=>{
    out.push('<b>'+esc(x.m.name)+'</b> лучше базы: '+D.fmtVal(x.m.key,x.v)+' против '+D.fmtVal(x.m.key,x.bv)+'.');
  });
  out.push('Сравнение пересчитано под ваши разрезы: смените покраску или разрез IT — и база, и выводы изменятся.');
  out.push('Численность, найм и переводы не окрашиваются светофором: отклонение от базы здесь не оценка, а факт масштаба.');
  return out;
}

/* ---------- рендер ---------- */
function render(S,openRows){
  const rl=D.reportLeaves(S), bl=D.benchmarkLeaves(S);
  if(!rl.length)return U.empty('Нет данных по выбранным разрезам',
    'В этом подразделении нет команд, подходящих под текущие фильтры. Снимите один из разрезов в шапке.');

  let h='<div class="page-h"><h2>Сводка по всем метрикам</h2>'+
    '<p>Все ключевые метрики команды на одном экране: значение, изменение за месяц и за год, динамика и '+
    'сравнение с базой <b>'+esc(D.benchmarkLabel(S))+'</b>. Нажмите на строку, чтобы развернуть график.</p></div>';

  /* AI-подсказка сразу под заголовком — как на детальных экранах. Внизу страницы
     её никто не дочитывал: сначала вывод, потом цифры. */
  h+=U.aiBlock('op','Как читать эту сводку',lead(S,rl,bl),bullets(S,rl,bl),S.aiOpen==='op','insight');

  /* KPI-стрип: только выбранные метрики. hc_total и hc_active выключить нельзя,
     поэтому стрип не может опустеть целиком. */
  h+='<div class="kpis">';
  HERO.filter(k=>D.metricVisible(k,S)).forEach(k=>{
    const s=D.aggregate(rl,k), v=s[D.LAST], dl=D.deltasOf(rl,k);
    const kpi=D.kpiFor(k,S), bv=D.lastVal(bl,k);
    const st=kpi?D.stateForKpi(k,v,kpi):D.compareState(k,v,bv);
    h+=U.kpiCard({label:D.METRIC_BY_KEY[k].name,
      q:U.infoDot(k),
      value:D.fmtVal(k,v),
      row1:U.deltaChip(k,dl.mom)+G.sparkLine(s,st,84,24,{key:k,base:D.comparable(k)?D.aggregate(bl,k):null}),
      row2:(D.comparable(k)?'<span class="k-sub">база '+D.fmtVal(k,bv)+'</span>':U.noCmpMark())+
        (kpi?'<span class="kpi-tag">KPI</span>':'')});
  });
  h+='</div>'+U.trafficLegend();

  /* блоки: пропускаем те, где отключены все метрики */
  D.visibleBlocks(S).forEach(b=>{
    h+='<div class="block-h"><span class="block-name">'+esc(b.name)+'</span>'+
      '<span class="block-hint">'+esc(b.hint)+'</span>'+
      '<button class="btn ghost" data-tab="'+b.key+'">Подробнее →</button></div>';
    let t='<table class="mtable">'+
      /* колонка «12 мес» без фиксированной ширины: забирает всю свободную
         ширину на широком экране, а спарклайн тянется вместе с ней */
      '<colgroup><col style="width:28%"><col style="width:12%"><col style="width:10%"><col style="width:10%"><col><col style="width:19%"></colgroup>'+
      '<thead><tr><th>Метрика</th><th class="num">Значение</th><th class="num">За месяц</th>'+
      '<th class="num">За год</th><th class="mid">12 мес</th><th class="mid">Сравнение с базой</th></tr></thead><tbody>';
    D.visibleMetricsOfBlock(b.key,S).forEach(m=>{
      const s=D.aggregate(rl,m.key), v=s[D.LAST], dl=D.deltasOf(rl,m.key);
      const kpi=D.kpiFor(m.key,S), bv=D.lastVal(bl,m.key);
      const st=kpi?D.stateForKpi(m.key,v,kpi):D.compareState(m.key,v,bv);
      /* база помесячно: спарклайн красит КАЖДЫЙ месяц по своему месяцу базы,
         а не весь ряд по последнему значению */
      const bser=D.comparable(m.key)?D.aggregate(bl,m.key):null;
      t+='<tr class="mrow" data-metric="'+m.key+'">'+
        '<td class="m-name bar-'+st+'">'+esc(m.name)+'<span class="m-sub">'+esc(m.hint)+'</span></td>'+
        '<td class="m-val">'+D.fmtVal(m.key,v)+'</td>'+
        '<td class="col-num">'+U.deltaChip(m.key,dl.mom)+'</td>'+
        '<td class="col-num">'+U.deltaChip(m.key,dl.yoy)+'</td>'+
        '<td class="col-spark">'+G.sparkBars(s,st,180,28,
          {key:m.key,base:bser,flat:!D.comparable(m.key)})+'</td>'+
        '<td class="col-tgt">'+U.targetCell(m.key,v,bv,kpi)+'</td></tr>';
      /* график раскрытой строки рисуется сразу в разметке — отдельного монтирования не нужно */
      if(openRows.has(m.key)){
        const cmp=D.comparable(m.key);
        t+='<tr class="detail-row"><td colspan="6"><div class="detail-chart">'+
          G.chart('line',{metricKey:m.key,series:s,bench:bser},
            {title:m.name+(cmp?' — динамика и база сравнения':' — динамика'),
             /* серии подписаны именами, иначе непонятно, что за синяя линия */
             legend:cmp?[{name:unitName(S),color:G.C_LINE},{name:D.benchmarkLabel(S),color:G.C_BENCH,dash:true}]:null,
             benchName:D.benchmarkLabel(S),
             kpi:kpi,h:280})+'</div></td></tr>';
      }
    });
    h+=U.panel({body:t+'</tbody></table>'});
  });

  return h;
}

SC.onepager={render,HERO};
})();

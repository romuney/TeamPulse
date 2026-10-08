/* ============================================================================
   screens/monitor.js — Мониторинг работы.

   «Динамика» — недоработчики, лоу-перформеры и доля улучшивших оценку в ревью
   панелями. Все шкалы от нуля: раньше ось резалась под диапазон значений, и
   колебание 6,1→6,9% выглядело обвалом. Ревью — ступенька: цикл раз в полгода.
   «Ревью» (итерация 28, дашборд 34661) — итоги последнего цикла: динамика
   оценок к прошлому циклу и оценки по грейду, стажу и роли.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;

SC.blocks.monitor={
  subTabs:[['both','Динамика'],['review','Ревью']],
  defaultSub:'both',
  title(sub){return sub==='review'?'Итоги ревью: последний цикл, '+D.CMP.cur
    :'Недоработчики, лоу-перформеры и ревью'},
  view(ctx){
    if(ctx.sub==='review'){
      const rv=D.reviewProfile(ctx.lp);
      /* Три группы в одной тепловой таблице, а не три таблицы: вопрос один —
         «у кого оценки выше», и группы читаются в одних колонках. ИТОГО — общее
         распределение оценок; края каждой группы с ним сходятся. */
      return U.btStack([
        U.btGroup({cap:'Динамика к прошлому циклу',capSub:'оценённые в цикле',head:'',
          valueHead:'Человек',metricKey:'hc_total',compact:true,
          items:rv.dyn.map(x=>({name:x.name,note:x.note,value:x.value,color:G.C_LOWPERF}))}),
        '<div class="bt-group"><div class="bt-cap">Оценки по группам<span class="bt-sub">доля в строке</span></div>'+
        U.heatTable({cols:rv.scores.map(x=>({name:x.name,tip:x.full})),
          total:{name:'ИТОГО',cells:rv.scores.map(x=>x.value)},
          groups:rv.groups.map(g=>({name:g.name,rows:g.rows.map((n,i)=>({name:n,cells:g.cells[i]}))}))})+
        '</div>'])+'<div class="tbl-note">«Улучшили оценку» — метрика блока: оценённые и улучшившие считаются '+
        'парой, как текучесть. Шкала оценок, первая оценка и разбивки по группам в макете сгенерированы; '+
        'на проде это summary_score, year_evaluation и management_head_flg из review_digest_us (дашборд 34661).</div>';
    }
    return SC.dynWrap(ctx,G.chart('panels',{panels:[
      {name:'Недоработчики, %',key:'underwork',type:'line',series:D.aggregate(ctx.lp,'underwork'),color:G.C_UNDER},
      {name:'Лоу-перформеры, %',key:'low_perf',type:'line',series:D.aggregate(ctx.lp,'low_perf'),color:G.C_LOWPERF},
      {name:'Улучшили оценку в ревью, %',key:'review_up',type:'line',series:D.aggregate(ctx.lp,'review_up'),color:G.C_LINE}
    ]},{h:520,fill:true}),[
      {key:'underwork',title:'Недоработчики, % · год к году'},
      {key:'low_perf',title:'Лоу-перформеры, % · год к году'},
      {key:'review_up',title:'Улучшили оценку в ревью, % · год к году'}]);
  }
};
})();

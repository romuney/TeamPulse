/* ============================================================================
   screens/monitor.js — Мониторинг работы.

   «Динамика» — недоработчики и доля улучшивших оценку в ревью панелями.
   «Лоу-перформеры» сняты 15.10: такого понятия в компании нет; мониторинг по
   каталогу HQ — недоработка, переработка, звонки, прогулы, выходные (план). Все шкалы от нуля: раньше ось резалась под диапазон значений, и
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
    :'Недоработчики и ревью'},
  view(ctx){
    if(ctx.sub==='review'){
      const rv=D.reviewProfile(ctx.lp);
      /* Три группы в одной тепловой таблице, а не три таблицы: вопрос один —
         «у кого оценки выше», и группы читаются в одних колонках. ИТОГО — общее
         распределение оценок; края каждой группы с ним сходятся. */
      return U.btStack([
        U.btGroup({cap:'По сравнению с прошлым ревью',capSub:'кого оценили',head:'',
          valueHead:'Человек',metricKey:'hc_total',compact:true,
          items:rv.dyn.map(x=>({name:x.name,note:x.note,value:x.value,color:G.C_REVIEW}))}),
        '<div class="bt-group"><div class="bt-cap">Оценки по группам<span class="bt-sub">доля людей в строке</span></div>'+
        U.heatTable({cols:rv.scores.map(x=>({name:x.name,tip:x.full})),
          total:{name:'ИТОГО',cells:rv.scores.map(x=>x.value)},
          groups:rv.groups.map(g=>({name:g.name,rows:g.rows.map((n,i)=>({name:n,cells:g.cells[i]}))}))})+
        '</div>'])+'<div class="tbl-note">Доли в строке складываются в 100%. Сколько это человек — в подсказке.</div>';
    }
    return SC.yoyPanels(ctx.lp,[
      {name:'Недоработчики, %',key:'underwork',color:G.C_UNDER,ann:ctx.ann.underwork},
      {name:'Улучшили оценку в ревью, %',key:'review_up',color:G.C_LINE,ann:ctx.ann.review_up}]);
  }
};
})();

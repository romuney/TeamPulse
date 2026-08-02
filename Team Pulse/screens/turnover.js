/* ============================================================================
   screens/turnover.js — Отток и текучесть.

   Отток и текучесть — разные сущности, поэтому у каждой своя панель со своей
   шкалой от нуля, а не два бара рядом на одной оси:

     1. Отток, чел          — счётный факт за месяц, бары
     2. Текучесть месячная  — отток / среднесписочная за месяц, линия
     3. Текучесть накопительная — сумма месячных с января, линия. Обнуляется
        каждый январь, поэтому в январе она равна месячной, а к декабрю
        доходит до годового значения.

   Причины увольнений — ТАБЛИЦА с полосами в ячейках, не бар-чарт.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, SC=window.TPSCREENS;

SC.blocks.turnover={
  subTabs:[['dynamics','Отток и текучесть'],['reasons','Причины увольнений']],
  defaultSub:'dynamics',
  title(sub){return sub==='reasons'?'Причины увольнений за период':'Отток и текучесть по месяцам'},
  view(ctx){
    const lp=ctx.lp;
    if(ctx.sub==='reasons'){
      /* ★ — нежелательный уход; сортировка по убыванию, как в разборе «сверху вниз» */
      return U.barTable({head:'Причина увольнения',metricKey:'attrition',sort:true,
        items:D.EXIT_REASONS.map(r=>({name:r.name,value:SC.sumS(D.reasonSeries(lp,r.key)),
          mark:r.regret,color:r.regret?G.C_REGRET:G.C_NOREG}))})+
        '<div class="tbl-note">★ — нежелательный уход: причина, на которую компания могла повлиять.</div>';
    }
    /* Текучесть — всегда линия: это темп, а не количество. Барами остаётся
       только отток, потому что отток — счётные люди за месяц. */
    return G.chart('panels',{panels:[
      {name:'Отток, чел',key:'attrition',type:'bar',series:D.aggregate(lp,'attrition'),color:G.C_OUT},
      {name:'Текучесть месячная, %',key:'turnover_m',type:'line',series:D.aggregate(lp,'turnover_m'),color:G.C_LINE},
      {name:'Текучесть накопительная с января, %',key:'turnover_y',type:'line',series:D.aggregate(lp,'turnover_y'),color:G.C_TURN_Y}
    ]},{h:520,fill:true});
  }
};
})();

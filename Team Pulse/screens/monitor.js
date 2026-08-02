/* ============================================================================
   screens/monitor.js — Мониторинг работы.
   Недоработчики и лоу-перформеры двумя панелями. Обе шкалы от нуля: раньше
   ось резалась под диапазон значений и колебание 6,1→6,9% выглядело обвалом.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, SC=window.TPSCREENS;

SC.blocks.monitor={
  subTabs:[['both','Динамика']],
  defaultSub:'both',
  title(){return 'Недоработчики и лоу-перформеры'},
  view(ctx){
    return G.chart('panels',{panels:[
      {name:'Недоработчики, %',key:'underwork',type:'line',series:D.aggregate(ctx.lp,'underwork'),color:G.C_UNDER},
      {name:'Лоу-перформеры, %',key:'low_perf',type:'line',series:D.aggregate(ctx.lp,'low_perf'),color:G.C_LOWPERF}
    ]},{h:360,fill:true});
  }
};
})();

/* ============================================================================
   screens/tgrowth.js — T-рост. Одна вкладка на весь блок: сверху конверсия
   в повышение с базой сравнения, снизу то, из чего она считается — прошли вверх,
   отказано вниз от общего нуля.

   Раньше это были две под-вкладки. Разводить их незачем: конверсия и есть
   отношение этих двух рядов, а вопрос «почему она просела» закрывается тем, что
   оба графика видны сразу — упал числитель или вырос знаменатель. На высоте
   рабочей зоны после итерации 19 они помещаются вместе.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, SC=window.TPSCREENS;

SC.blocks.tgrowth={
  subTabs:[['flow','Конверсия и решения']],
  defaultSub:'flow',
  title(){return 'Конверсия в повышение и решения по заявкам'},
  view(ctx){
    return SC.metricLine('tgrowth_conv',ctx.lp,ctx.bl,ctx.S,{h:300,title:'Конверсия T-роста, %'})+
      G.chart('diverge',
        {up:D.aggregate(ctx.lp,'tgrowth_pass'),down:D.aggregate(ctx.lp,'tgrowth_deny'),
         upKey:'tgrowth_pass',downKey:'tgrowth_deny'},
        {h:300,fill:true,title:'Из чего она считается, чел',
         legend:[{name:'Прошли',color:G.C_IN},{name:'Отказано',color:G.C_OUT}]});
  }
};
})();

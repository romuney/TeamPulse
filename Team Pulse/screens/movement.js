/* ============================================================================
   screens/movement.js — Движение персонала. По два графика на каждой вкладке:

   «Баланс за период»  — динамика численности сверху, водопад её изменения снизу.
                         Численность и потоки, которые её двигают, читаются вместе:
                         линия показывает, ЧТО получилось, водопад — из чего.
   «Найм, отток и переводы» — внешние потоки сверху (найм / отток), внутренние
                         снизу (переводы в команду / из команды). Обе пары —
                         дивергентные бары: один бар, разрезанный осью, а не два
                         рядом, и одна шкала на оба плеча.

   «Замещение и темпы» — растёт ли команда (итерация 28, бизнес-анализ):
                         коэффициент замещения сверху, найм и отток на 100
                         человек снизу. Темпы, в отличие от людей, сравнимы
                         с базой и между командами разного размера.

   Два fill-графика в панели делят её высоту пополам без правок CSS.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, SC=window.TPSCREENS;

function balancedSteps(lp){
  const hc=D.aggregate(lp,'hc_total'), begin=hc[0], end=hc[D.LAST];
  const hire=SC.sumS(D.aggregate(lp,'hire')), tin=SC.sumS(D.aggregate(lp,'transfer_in'));
  const attr=-SC.sumS(D.aggregate(lp,'attrition')), tout=-SC.sumS(D.aggregate(lp,'transfer_out'));
  /* «Прочие изменения» закрывают разрыв: численность генерируется независимо
     от потоков, и молча спрятать невязку было бы обманом */
  return [{name:'Начало',value:begin,total:true},{name:'Найм',value:hire},
    {name:'Переводы в',value:tin},{name:'Отток',value:attr},{name:'Переводы из',value:tout},
    {name:'Прочее',value:end-(begin+hire+tin+attr+tout)},{name:'Конец',value:end,total:true}];
}

SC.blocks.movement={
  subTabs:[['balance','Баланс за период'],['dynamics','Найм, отток и переводы'],['rates','Замещение и темпы']],
  defaultSub:'balance',
  title(sub){return sub==='dynamics'
    ? 'Внешние и внутренние потоки по месяцам'
    : sub==='rates'?'Растёт ли команда: замещение и темпы потоков'
    : 'Численность и из чего сложилось её изменение'},
  view(ctx){
    if(ctx.sub==='rates'){
      /* Отток на 100 человек — это и есть текучесть месячная (та же формула),
         поэтому нижнее плечо берёт её ряд, а не заводит дубль. Одна шкала на
         оба плеча: темпы прихода и ухода сравниваются длиной бара. */
      return SC.metricLine('replace_ratio',ctx.lp,ctx.bl,ctx.S,
          {h:300,title:'Коэффициент замещения'})+
        G.chart('diverge',
        {up:D.aggregate(ctx.lp,'hire_rate'),down:D.aggregate(ctx.lp,'turnover_m'),
         upKey:'hire_rate',downKey:'turnover_m'},
        {h:300,fill:true,title:SC.winTitle(ctx.S,'Найм и отток на 100 человек, %'),
         upName:'Найм на 100 человек',downName:'Отток на 100 человек (текучесть)',
         legend:[{name:'Найм на 100',color:G.C_IN},{name:'Отток на 100',color:G.C_OUT}]});
    }
    if(ctx.sub==='dynamics'){
      return G.chart('diverge',
        {up:D.aggregate(ctx.lp,'hire'),down:D.aggregate(ctx.lp,'attrition'),
         upKey:'hire',downKey:'attrition'},
        {h:300,fill:true,title:'Найм и отток, чел',
         legend:[{name:'Приняли',color:G.C_IN},{name:'Уволились',color:G.C_OUT}]})+
        G.chart('diverge',
        {up:D.aggregate(ctx.lp,'transfer_in'),down:D.aggregate(ctx.lp,'transfer_out'),
         upKey:'transfer_in',downKey:'transfer_out'},
        /* та же гамма, что у найма и оттока: человек пришёл — C_IN, ушёл — C_OUT.
           Отдельный «приглушённый» цвет для внутренних переводов заводить нельзя,
           иначе водопад рядом красит те же переводы зелёным и красным. */
        {h:300,fill:true,title:'Переводы внутри компании, чел',
         legend:[{name:'В команду',color:G.C_IN},{name:'Из команды',color:G.C_OUT}]});
    }
    return SC.metricLine('hc_total',ctx.lp,ctx.bl,ctx.S,{h:300,title:'Общая численность, чел'})+
      G.chart('waterfall',{steps:balancedSteps(ctx.lp)},{h:300,fill:true,
        title:SC.winTitle(ctx.S,'Из чего сложилось изменение за период'),
        legend:[{name:'Итог месяца',color:G.C_TOTAL},{name:'Приход',color:G.C_IN},{name:'Уход',color:G.C_OUT}]});
  }
};
})();

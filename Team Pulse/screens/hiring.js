/* ============================================================================
   screens/hiring.js — Найм и вакансии.

   «Вакансии и срок закрытия» — три панели друг под другом: открытые, закрытые,
   срок закрытия. Отдельной вкладки у срока больше нет: на весь экран одна линия
   из двенадцати точек — это пустая трата экрана, а рядом с объёмом вакансий она
   отвечает на понятный вопрос «стало ли дольше при том же потоке».
   Панели, а не два бара рядом: у каждой своя шкала от нуля, ось X общая.

   «Воронка» осталась отдельно: у неё своя геометрия и своя оговорка про источник.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, SC=window.TPSCREENS;

/* Коэффициенты воронки — допущение макета, реального источника под ними нет.
   При подключении к хранилищу заменить на фактические этапы. */
const FUNNEL=[['Открыто вакансий',1],['Передано офферов',0.63],['Принято офферов',0.49],['Вышли на работу',0.41]];

SC.blocks.hiring={
  subTabs:[['vacancies','Вакансии и срок закрытия'],['funnel','Воронка']],
  defaultSub:'vacancies',
  title(sub){return sub==='funnel'?'Воронка найма':'Вакансии и скорость их закрытия'},
  view(ctx){
    const lp=ctx.lp;
    if(ctx.sub==='funnel'){
      const open=SC.sumS(D.aggregate(lp,'vac_open')), closed=SC.sumS(D.aggregate(lp,'vac_closed'));
      const items=FUNNEL.map(([name,k],i)=>({name,
        value:i===FUNNEL.length-1?Math.max(closed,Math.round(open*k)):Math.round(open*k)}));
      return G.chart('funnel',{items},{fill:true,h:Math.max(300,items.length*74)})+
        '<div class="tbl-note">Этапы после открытия вакансии — допущение макета: коэффициенты 0,63 / 0,49 / 0,41. Реального источника под ними пока нет.</div>';
    }
    /* срок закрытия — линией: это темп, а не количество, ровно как текучесть
       в блоке оттока. Барами остаются штуки вакансий. */
    return G.chart('panels',{panels:[
      {name:'Открытые вакансии, шт',key:'vac_open',type:'bar',series:D.aggregate(lp,'vac_open'),color:G.C_VAC},
      {name:'Закрытые вакансии, шт',key:'vac_closed',type:'bar',series:D.aggregate(lp,'vac_closed'),color:G.C_IN},
      {name:'Срок закрытия вакансии, дн',key:'time_to_fill',type:'line',series:D.aggregate(lp,'time_to_fill'),color:G.C_LINE}
    ]},{h:520,fill:true});
  }
};
})();

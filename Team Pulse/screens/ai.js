/* ============================================================================
   screens/ai.js — AI-инструменты. Восьмой блок, итерация 28.

   В HQ-дашборде Proteus 34136 был блок AI-метрик — проникновение AI-инструментов
   «по команде против компании» и средний WAU, — а в Hub его не было вовсе:
   самый заметный разрыв бизнес-анализа. «Команда против компании» — ровно та
   механика, на которой стоит весь отчёт: база сравнения выводится из фильтров.

   «Проникновение»        — доля сотрудников с AI за неделю против базы и
                            активные пользователи (WAU) по месяцам.
   «Инструменты и стримы» — чем пользуются и где: по инструментам и по стримам.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;
const esc=U.esc;

SC.blocks.ai={
  subTabs:[['adoption','Проникновение'],['tools','Инструменты и стримы']],
  defaultSub:'adoption',
  title(sub){return sub==='tools'?'Чем пользуются и в каких стримах':'Внедрение AI-инструментов'},
  view(ctx){
    if(ctx.sub==='tools'){
      const ai=D.aiProfile(ctx.lp);
      /* Проценты не складываются: человек с двумя инструментами в общем
         проникновении один. Поэтому ни ИТОГО, ни «Доли» — общий процент
         назван в подписи таблицы. */
      const tbl=(cap,capSub,items,barHead)=>U.btGroup({cap:cap,capSub:capSub,head:'',metricKey:'ai_penetration',
        valueHead:'Сотрудников',barHead:barHead,share:false,total:false,compact:true,items:items});
      return U.btStack([
        tbl('Инструменты','хотя бы раз за неделю · всего '+D.fmtVal('ai_penetration',ai.pen),
          ai.tools.map(t=>({name:t.name,value:t.value,color:G.C_AI})),'Сравнение инструментов'),
        tbl('Стримы',D.CMP.cur,ai.streams.slice().sort((a,b)=>b.value-a.value)
          .map(x=>({name:x.name,note:D.fmtInt(x.hc)+' чел',value:x.value,color:G.C_AI})),'Сравнение стримов')])+
        '<div class="tbl-note">Среднее по стримам, взвешенное по людям, равно проникновению отбора. '+
        'Инструменты пересекаются, поэтому их проценты не складываются в общий. Разбивки в макете '+
        'сгенерированы; на проде — penetration_unit, penetration_company и wau из AI-витрины '+
        'дашборда 34136, по инструменту и стриму сотрудника.</div>';
    }
    return SC.metricLine('ai_penetration',ctx.lp,ctx.bl,ctx.S,{h:300,title:'Проникновение AI, %'})+
      G.chart('bars',{metricKey:'ai_wau',series:D.aggregate(ctx.lp,'ai_wau')},
        {h:300,fill:true,title:'Активные пользователи AI (WAU), чел',color:G.C_AI});
  }
};
})();

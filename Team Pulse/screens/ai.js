/* ============================================================================
   screens/ai.js — AI-инструменты. Восьмой блок, итерация 28.

   В HQ-дашборде Proteus 34136 был блок AI-метрик — проникновение AI-инструментов
   «по команде против компании» и средний WAU, — а в Hub его не было вовсе:
   самый заметный разрыв бизнес-анализа. «Команда против компании» — ровно та
   механика, на которой стоит весь отчёт: база сравнения выводится из фильтров.

   «Проникновение»        — доля сотрудников с AI за неделю против базы и
                            активные пользователи (WAU) по месяцам.
   «Инструменты»          — чем пользуются. Разбивка по стримам снята 15.10:
                            в каталоге HQ — «по покраске в разрезе инструментов»
                            (в плане подключения).
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;

SC.blocks.ai={
  subTabs:[['adoption','Проникновение'],['tools','Инструменты']],
  defaultSub:'adoption',
  title(sub){return sub==='tools'?'Какими AI-инструментами пользуются':'Внедрение AI-инструментов'},
  view(ctx){
    if(ctx.sub==='tools'){
      const ai=D.aiProfile(ctx.lp);
      /* Проценты не складываются: человек с двумя инструментами в общем
         проникновении один. Поэтому ни ИТОГО, ни «Доли» — общий процент
         назван в подписи таблицы. */
      const tbl=(cap,capSub,items,barHead)=>U.btGroup({cap:cap,capSub:capSub,head:'',metricKey:'ai_penetration',
        valueHead:'Сотрудников',barHead:barHead,share:false,total:false,compact:true,items:items});
      return tbl('Инструменты','хотя бы раз за неделю · всего '+D.fmtVal('ai_penetration',ai.pen),
          ai.tools.map(t=>({name:t.name,value:t.value,color:G.C_AI})),'Сравнение инструментов')+
        '<div class="tbl-note">Инструменты пересекаются, поэтому их проценты не складываются в общий. Разбивка '+
        'в макете сгенерирована; на проде — AI-витрина дашборда 34136 (penetration_unit, wau) по инструменту.</div>';
    }
    return SC.metricLine('ai_penetration',ctx.lp,ctx.bl,ctx.S,{h:300,title:'Проникновение AI, %',ann:ctx.ann.ai_penetration})+
      SC.yoyChart('ai_wau',ctx.lp,ctx.bl,ctx.S,
        {h:300,title:'Активные пользователи AI (WAU), чел',color:G.C_AI,ann:ctx.ann.ai_wau});
  }
};
})();

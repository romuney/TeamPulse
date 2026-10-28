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

/* 28.10, п. 4: графики из «Готовности данных» — по неделям, частота, инструментов на человека, воронка сообщений и
   топ задач, проникновение по IT-коду и инструменту, стажёры, конструктор. Числа условные (D.aiUsage) */
const esc=U.esc;
function tbl(cap,sub,head,rows){
  return '<div class="bt-group"><div class="bt-cap">'+esc(cap)+(sub?'<span class="bt-sub">'+esc(sub)+'</span>':'')+'</div>'+
    '<table class="ptable stable dense"><thead><tr>'+head.map((h,i)=>'<th'+(i?'':' class="txt"')+'>'+esc(h)+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map(r=>'<tr'+(r.cls?' class="'+r.cls+'"':'')+'>'+r.c.map((v,i)=>'<td'+(i?'':' class="txt"')+'>'+
      esc(String(v))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function bars(cap,sub,items,valueHead){
  return U.btGroup({cap:cap,capSub:sub,head:'',valueHead:valueHead||'Человек',metricKey:'hc_total',compact:true,
    items:items.map(x=>({name:x.name,value:x.value,color:G.C_AI}))});
}
function usage(u){
  const P=v=>D.fmtVal('ai_penetration',v), I=D.fmtInt;
  return G.chart('pline',{periods:u.weeks,key:'pen'},{title:'Проникновение AI по неделям, %',name:'Проникновение',fmt:'pct',h:200})+
    G.chart('pline',{periods:u.weeks,key:'wau'},{title:'Активные пользователи AI по неделям (WAU), чел',name:'WAU',fmt:'int',h:200})+
    U.btStack([bars('Частота использования','дней с AI за неделю · активные пользователи',u.freq),
      bars('Инструментов на человека','активные пользователи',u.per)])+
    tbl('Воронка сообщений','инструменты разработчика · за неделю',['','Сообщений'],
      [{c:['Все сообщения',I(u.msgs)]},{c:['Классифицированы',I(u.cls)]},{c:['Не классифицированы',I(u.msgs-u.cls)]}])+
    U.btStack(u.dev.map(d=>bars('Топ задач: '+d.name,'сообщений · всего '+I(d.msgs),d.tasks,'Сообщений')))+
    tbl('Проникновение по IT-коду и инструменту','% численности сегмента',['IT-код','Численность'].concat(u.tools.map(t=>t.name)),
      u.bySeg.map(x=>({c:[x.name,I(x.hc)].concat(x.cells.map(P))})))+
    tbl('Стажёры','пользуются ли AI и как часто',['','Значение'],
      [{c:['Стажёров',I(u.intern.hc)]},{c:['Пользуются AI',I(u.intern.act)+' · '+P(u.intern.pen)]},
       {c:['1–2 дня в неделю',I(u.intern.freq[0])]},{c:['3–4 дня',I(u.intern.freq[1])]},{c:['5 дней и больше',I(u.intern.freq[2])]}]
       .concat(u.intern.tools.map(t=>({c:[t.name,P(t.value)]}))))+
    tbl('Конструктор: IT-код × покраска','численность, активные пользователи, проникновение',
      ['IT-код · покраска','Численность','Активные','Проникновение'],u.cons.map(x=>({c:[x.seg+' · '+x.paint,I(x.hc),I(x.act),P(x.pen)]})))+
    '<div class="tbl-note">Все графики вкладки — условные: нужна недельная AI-выгрузка по людям (план подключения, этап 8).</div>';
}

SC.blocks.ai={
  subTabs:[['adoption','Проникновение'],['tools','Инструменты'],['usage','Как пользуются']],
  defaultSub:'adoption',
  title(sub){return sub==='tools'?'Какими AI-инструментами пользуются':sub==='usage'?'Как пользуются AI: частота, задачи, сегменты'
    :'Внедрение AI-инструментов'},
  view(ctx){
    if(ctx.sub==='usage')return usage(D.aiUsage(ctx.lp));
    if(ctx.sub==='tools'){
      const ai=D.aiProfile(ctx.lp);
      /* Проценты не складываются: человек с двумя инструментами в общем
         проникновении один. Поэтому ни ИТОГО, ни «Доли» — общий процент
         назван в подписи таблицы. */
      const tbl=(cap,capSub,items,barHead)=>U.btGroup({cap:cap,capSub:capSub,head:'',metricKey:'ai_penetration',
        valueHead:'Сотрудников',barHead:barHead,share:false,total:false,compact:true,items:items});
      return tbl('Инструменты','хотя бы раз за неделю · всего '+D.fmtVal('ai_penetration',ai.pen),
          ai.tools.map(t=>({name:t.name,value:t.value,color:G.C_AI})),'Сравнение инструментов')+
        '<div class="tbl-note">Проценты не складываются: один человек может пользоваться несколькими инструментами.</div>';
    }
    /* 26.10, AI BI.md: под WAU пунктиром — численность команды, от которой считается проникновение (знаменатель
       источника; в макете — активная численность) */
    const den=D.yoySeries(ctx.lp,D.METRIC_BY_KEY.ai_penetration.derived.den).cur;
    return SC.metricLine('ai_penetration',ctx.lp,ctx.bl,ctx.S,{h:300,title:'Проникновение AI, %',ann:ctx.ann.ai_penetration})+
      SC.yoyChart('ai_wau',ctx.lp,ctx.bl,ctx.S,
        {h:300,title:'Активные пользователи AI (WAU), чел',color:G.C_AI,ann:ctx.ann.ai_wau,ref:{name:'Численность команды',cur:den}});
  }
};
})();

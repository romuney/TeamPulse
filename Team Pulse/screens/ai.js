/* ============================================================================
   screens/ai.js — AI-инструменты. Восьмой блок, итерация 28.

   В HQ-дашборде Proteus 34136 был блок AI-метрик — проникновение AI-инструментов
   «по команде против компании» и средний WAU, — а в Hub его не было вовсе:
   самый заметный разрыв бизнес-анализа. «Команда против компании» — ровно та
   механика, на которой стоит весь отчёт: база сравнения выводится из фильтров.

   31.10 (файл «AI.md»): три раздела без сравнения с прошлым годом —
   «Пользуются ли AI?»  — проникновение и активные пользователи одной линией за 12 месяцев, месяц / неделя;
   «Кто пользуется?»    — стажёры, инструменты по покраске IT / Digital / NonIT, конструктор;
   «Как пользуется?»    — частота, инструментов на человека, топ инструментов, воронка и классификация сообщений.
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
function bars(cap,sub,items,valueHead,o){
  return U.btGroup(Object.assign({cap:cap,capSub:sub,head:'',valueHead:valueHead||'Человек',metricKey:'hc_total',compact:true,
    items:items.map(x=>({name:x.name,note:x.note,value:x.value,color:G.C_AI}))},o||{}));
}
/* проценты — без колонки «Доля» и без ИТОГО: проценты не складываются */
const pctBars=(cap,sub,items,head)=>bars(cap,sub,items,head||'% людей',{metricKey:'ai_penetration',share:false,total:false});

/* 31.10, файл «AI.md», п. 1 и 4: без сравнения с прошлым годом — одна линия за последние 12 месяцев (ось — месяцы окна
   отчёта, сколько их есть), переключатель «Месяц / Неделя». Проникновение и активные пользователи по месяцам — из
   источника (знаменатель проникновения — численность того же месяца под фильтрами); по неделям — условно (D.aiUsage) */
function adoption(ctx){
  const S=ctx.S, gran=S.aiGran==='w'?'w':'m', u=D.aiUsage(ctx.lp);
  const pen=D.aggregate(ctx.lp,'ai_penetration'), wau=D.aggregate(ctx.lp,'ai_wau');
  const P=gran==='w'?u.weeks:D.MONTHS.map((m,i)=>({label:m.label,full:D.MONTH_NOM[m.m]+' '+m.y,pen:pen[i],wau:wau[i]}));
  const per=gran==='w'?'по неделям':'по месяцам';
  return '<div class="mon-bar">'+U.segToggle('data-aigran',[['m','Месяц'],['w','Неделя']],gran)+
      '<span class="mon-note">'+(gran==='w'?'12 последних закрытых недель':'Последние 12 месяцев')+'</span></div>'+
    (gran==='w'?U.devNote({stage:8,part:true,t:'По неделям — пока условно: нужна недельная AI-выгрузка. По месяцам — настоящие данные.'}):'')+
    G.chart('pline',{periods:P,key:'pen'},{title:'Проникновение AI '+per+', %',name:'Проникновение',fmt:'pct',color:G.C_AI,h:230})+
    G.chart('pline',{periods:P,key:'wau'},{title:'Активные пользователи AI '+per+', чел',name:'Активные пользователи',fmt:'int',color:G.C_AI,h:230})+
    '<div class="tbl-note">Проникновение — активные пользователи AI к численности того же периода под выбранными фильтрами.</div>';
}
/* п. 3: «Кто пользуется?» — стажёры (сколько и сколько из них с AI, инструменты, частота), ниже — инструменты × покраска
   IT / Digital / NonIT и конструктор IT-код × покраска */
function who(u){
  const P=v=>D.fmtVal('ai_penetration',v), I=D.fmtInt, it=u.intern;
  const segs=u.bySeg;
  return U.btStack([
      bars('Стажёры','сколько стажёров и сколько из них пользуются AI',
        [{name:'Стажёров',value:it.hc},{name:'Пользуются AI',note:P(it.pen)+' стажёров',value:it.act}],'Человек',{share:false,total:false}),
      pctBars('Какими инструментами пользуются стажёры','% стажёров · хотя бы раз за неделю',it.tools.slice().sort((a,b)=>b.value-a.value)),
      bars('Как часто пользуются стажёры','дней с AI за неделю · стажёры с AI',
        [{name:'1–2 дня',value:it.freq[0]},{name:'3–4 дня',value:it.freq[1]},{name:'5 дней и больше',value:it.freq[2]}])])+
    tbl('Инструменты по покраске','% численности сегмента · IT / Digital / NonIT',
      ['Инструмент'].concat(segs.map(x=>x.name+' · '+I(x.hc)+' чел')),
      u.tools.map((t,j)=>({c:[t.name].concat(segs.map(x=>P(x.cells[j])))})))+
    tbl('Конструктор: IT-код × покраска','численность, активные пользователи, проникновение',
      ['IT-код · покраска','Численность','Активные','Проникновение'],u.cons.map(x=>({c:[x.seg+' · '+x.paint,I(x.hc),I(x.act),P(x.pen)]})))+
    '<div class="tbl-note">Проценты по инструментам не складываются: один человек может пользоваться несколькими.</div>';
}
/* п. 5: «Как пользуется?» — частота, инструментов на человека, топ инструментов, воронка и классификация сообщений */
function usage(u){
  const I=D.fmtInt, act=u.per.reduce((a,x)=>a+x.value,0);
  /* инструментов на человека: распределение активных пользователей; среднее — «4 и больше» считаем как 4 (нижняя граница) */
  const avg=act?u.per.reduce((a,x,i)=>a+x.value*(i+1),0)/act:0;
  /* классификация: задачи по всем инструментам разработчика, сумма = классифицированные сообщения */
  const cls={};u.dev.forEach(d=>d.tasks.forEach(t=>{cls[t.name]=(cls[t.name]||0)+t.value}));
  const clsItems=Object.keys(cls).map(k=>({name:k,value:cls[k]})).sort((a,b)=>b.value-a.value);
  return U.btStack([
      bars('Частота использования','дней с AI за неделю · активные пользователи',u.freq),
      bars('Инструментов на человека','активные пользователи · в среднем '+(Math.round(avg*10)/10).toString().replace('.',',')+' (4+ считаем за 4)',u.per),
      pctBars('Топ инструментов','% сотрудников · хотя бы раз за неделю',u.tools.slice().sort((a,b)=>b.value-a.value),'% сотрудников'),
      bars('Воронка сообщений','инструменты разработчика · за неделю',
        [{name:'Все сообщения',value:u.msgs},{name:'Классифицированы',note:Math.round(u.cls/(u.msgs||1)*100)+'%',value:u.cls},
         {name:'Не классифицированы',note:Math.round((u.msgs-u.cls)/(u.msgs||1)*100)+'%',value:u.msgs-u.cls}],'Сообщений',{share:false,total:false}),
      bars('Классификация сообщений','классифицированные сообщения по задачам · всего '+I(u.cls),clsItems,'Сообщений')])+
    '<div class="tbl-note">Классифицированные и не классифицированные в сумме дают все сообщения; классы — только у классифицированных.</div>';
}

SC.blocks.ai={
  /* 31.10, «AI.md», п. 2: три раздела — пользуются ли, кто, как */
  subTabs:[['adoption','Пользуются ли AI?'],['who','Кто пользуется?'],['usage','Как пользуется?']],
  defaultSub:'adoption',
  title(sub){return sub==='who'?'Кто пользуется AI':sub==='usage'?'Как пользуются AI: частота, инструменты, сообщения'
    :'Пользуются ли AI: проникновение и активные пользователи'},
  view(ctx){
    if(ctx.sub==='usage')return usage(D.aiUsage(ctx.lp));
    if(ctx.sub==='who')return who(D.aiUsage(ctx.lp));
    return adoption(ctx);
  }
};
})();

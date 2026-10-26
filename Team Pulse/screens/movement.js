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
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;

/* 20.10: начало — численность на 1-е число первого месяца окна (а не на конец этого месяца:
   его найм и отток уже в потоках, и месяц уходил в «Прочее»), конец — на дату данных; даты —
   под подписями «Начало» и «Конец» */
/* поставка 63: детализация переводов — кто перевёлся, по месяцам, со сверкой с отчётом и выгрузкой */
const TRD_BTN='<div class="trd-open"><button class="btn ghost" data-trd="1">Кто перевёлся — детализация переводов</button>'+
  '<span class="tbl-note">Подразделение — выбранная строка таблицы, иначе юнит отчёта.</span></div>';
function balancedSteps(lp){
  const hc=D.aggregate(lp,'hc_total'), begin=hc[0], end=hc[D.LAST];
  const hire=D.winSum(lp,'hire'), tin=D.winSum(lp,'transfer_in');
  const attr=-D.winSum(lp,'attrition'), tout=-D.winSum(lp,'transfer_out');
  /* 21.10, поставка 56: найм, отток и переводы покрывают всё движение (методология переводов) — «Прочее»
     бывает только при сбое данных: изменение численности без события в источнике. Ноль — столбца нет;
     не ноль — столбец с объяснением, молча спрятать невязку было бы обманом */
  const other=end-(begin+hire+tin+attr+tout);
  return [{name:'Начало',sub:D.WIN_FROM,value:begin,total:true},{name:'Найм',value:hire},
    {name:'Переводы в',value:tin},{name:'Отток',value:attr},{name:'Переводы из',value:tout}].concat(
    Math.abs(other)<0.5?[]:[{name:'Прочее',value:other,note:D.REAL?'Изменение численности без найма, увольнения или '+
      'перевода в источнике — сбой данных. Найм, отток и переводы покрывают всё движение людей.':
      'В демо численность и потоки генерируются независимо.'}],
    [{name:'Конец',sub:D.WIN_TO,value:end,total:true}]);
}

/* 26.10-б, правки п. 1: «Движение по специализациям» — после переводов: с начала года пришли и ушли по специализации,
   сальдо и двусторонняя полоса (ушли — влево, пришли — вправо, общая шкала). Первые 12 по обороту, остальные — одной
   строкой. Только специализации с движением */
function specMove(lp){
  const rs=D.specMovement(lp);
  if(!rs.length)return '';
  const top=rs.slice(0,12), rest=rs.slice(12);
  if(rest.length)top.push({name:'Остальные',note:rest.length+' '+U.plural(rest.length,['специализация','специализации','специализаций']),
    hire:rest.reduce((a,z)=>a+z.hire,0),exit:rest.reduce((a,z)=>a+z.exit,0),
    net:rest.reduce((a,z)=>a+z.net,0),tip:rest.map(z=>z.name).join(', ')});
  const max=Math.max(1,...top.map(z=>Math.max(z.hire,z.exit))), w=v=>(v/max*100).toFixed(1)+'%', esc=U.esc;
  const sg=v=>(v>0?'+':'')+D.fmtInt(v);
  return '<div class="bt-group spm"><div class="bt-cap">Движение по специализациям<span class="bt-sub">с начала года, чел</span></div>'+
    '<table class="ptable btable compact"><colgroup><col><col style="width:64px"><col style="width:64px"><col style="width:68px">'+
    '<col style="width:34%"></colgroup><thead><tr><th class="txt"></th><th class="num">Пришли</th><th class="num">Ушли</th>'+
    '<th class="num">Сальдо</th><th class="bar-th">Ушли · пришли</th></tr></thead><tbody>'+
    top.map(z=>'<tr'+(z.tip?U.tipAttr({title:'Остальные',text:z.tip}):'')+'><td class="txt">'+esc(z.name)+
      (z.note?'<span class="unit-sub">'+esc(z.note)+'</span>':'')+'</td>'+
      '<td class="num">'+D.fmtInt(z.hire)+'</td><td class="num">'+D.fmtInt(z.exit)+'</td>'+
      '<td class="num spm-n '+(z.net>0?'pos':z.net<0?'neg':'')+'">'+sg(z.net).replace('-','−')+'</td>'+
      '<td class="barcell"><span class="dvbar"><span class="dv-l"><i style="width:'+w(z.exit)+'"></i></span>'+
      '<span class="dv-r"><i style="width:'+w(z.hire)+'"></i></span></span></td></tr>').join('')+'</tbody></table>'+
    '<div class="tbl-note">С начала года; переводов по специализациям в данных нет.</div></div>';
}

SC.blocks.movement={
  /* Итерация 32 (фидбэк 12.10): «вначале waterfall, а потом только динамики»,
     и вся динамика — численность, найм и отток, переводы — на одном листе,
     «чтобы было видно, что на что повлияло». Глава «Замещение и темпы»
     снята: коэффициент замещения и найм на 100 человек на отдельном листе
     читались как непонятные метрики. Сами метрики остались в карточках
     и в таблице подразделений — их можно скрыть в «Настрой свой дашборд». */
  subTabs:[['balance','Обзор за год'],['dynamics','Динамика по месяцам']],
  defaultSub:'balance',
  title(sub){return sub==='dynamics'
    ? 'Численность, найм, отток и переводы по месяцам'
    : 'Из чего сложилось изменение численности'},
  view(ctx){
    if(ctx.sub==='dynamics'){
      return SC.metricLine('hc_total',ctx.lp,ctx.bl,ctx.S,{h:240,title:'Численность, чел',ann:ctx.ann.hc_total})+
        SC.yoyPair(ctx.lp,'hire','attrition',
        {h:240,title:'Найм и отток, чел',
         legend:[{name:'Приняли',color:G.C_IN},{name:'Уволились',color:G.C_OUT}]})+
        /* та же гамма, что у найма и оттока: человек пришёл — C_IN, ушёл — C_OUT.
           Отдельный «приглушённый» цвет для внутренних переводов заводить нельзя,
           иначе водопад рядом красит те же переводы зелёным и красным. */
        SC.yoyPair(ctx.lp,'transfer_in','transfer_out',
        {h:240,title:'Переводы внутри компании, чел',
         legend:[{name:'В команду',color:G.C_IN},{name:'Из команды',color:G.C_OUT}]})+TRD_BTN+specMove(ctx.lp);
    }
    /* обзор: водопад года и то, что из него нужно вынести (story.js — insights) */
    return G.chart('waterfall',{steps:balancedSteps(ctx.lp)},{h:300,fill:true,
        title:'Изменение численности, чел',
        legend:[{name:'Начало и конец',color:G.C_TOTAL},{name:'Пришли',color:G.soft(G.C_IN)},{name:'Ушли',color:G.soft(G.C_OUT)}]})+
      U.storyFacts(ctx.story&&ctx.story.insights,'Что важно')+TRD_BTN;
  }
};
})();

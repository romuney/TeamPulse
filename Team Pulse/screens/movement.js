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
function balancedSteps(lp){
  const hc=D.aggregate(lp,'hc_total'), begin=hc[0], end=hc[D.LAST];
  const hire=D.winSum(lp,'hire'), tin=D.winSum(lp,'transfer_in');
  const attr=-D.winSum(lp,'attrition'), tout=-D.winSum(lp,'transfer_out');
  /* 21.10, поставка 56: найм, отток и переводы покрывают всё движение (методология переводов) — «Прочее»
     бывает только при сбое данных: изменение численности без события в источнике. Ноль — столбца нет;
     не ноль — столбец с объяснением, молча спрятать невязку было бы обманом */
  const other=end-(begin+hire+tin+attr+tout);
  return [{name:'Начало',sub:'на конец '+D.WIN_FROM,value:begin,total:true},{name:'Найм',value:hire},
    {name:'Переводы в',value:tin},{name:'Отток',value:attr},{name:'Переводы из',value:tout}].concat(
    Math.abs(other)<0.5?[]:[{name:'Прочее',value:other,note:D.REAL?'Изменение численности без найма, увольнения или '+
      'перевода в источнике — сбой данных. Найм, отток и переводы покрывают всё движение людей.':
      'В демо численность и потоки генерируются независимо.'}],
    [{name:'Конец',sub:D.WIN_TO,value:end,total:true}]);
}

/* 26.10-б, правки п. 1: «Движение по специализациям» — после переводов: с начала года по специализации.
   27.10-в, п. 5: «Остальные» раскрываются вторым уровнем, как регион в «Структуре»; «сальдо» → «итого».
   28.10, п. 1: четыре составляющих — найм, переводы в, отток, переводы из; итого = найм + в − отток − из; полоса:
   влево — отток и переводы из, вправо — найм и переводы в (общая шкала). ИТОГО первой строкой = карточкам с начала
   года. Пробник без переводов по специализации (ноутбук до 28.10) — без двух колонок переводов */
function specMove(lp,ctx){
  const rs=D.specMovement(lp);
  if(!rs.length)return '';
  const trf=!D.REAL||D.SPM_TRF, K='rest:spm', open=!!(ctx&&ctx.mixOpen.has(K)), top=rs.slice(0,12), rest=rs.slice(12);
  const S=(a,k)=>a.reduce((t,z)=>t+z[k],0), agg=(a,o)=>Object.assign(o,{hire:S(a,'hire'),tin:S(a,'tin'),exit:S(a,'exit'),
    tout:S(a,'tout'),net:S(a,'net')});
  if(rest.length)top.push(agg(rest,{name:'Остальные',note:rest.length+' '+U.plural(rest.length,['специализация','специализации','специализаций']),
    exp:1}));
  const tot=agg(rs,{name:'ИТОГО',total:1});
  if(open)rest.forEach(z=>top.push(Object.assign({sub:1},z)));
  const tree=rest.length>0, esc=U.esc;
  const lbl=z=>!tree?'':z.exp?'<button class="caret-btn"'+(open?' data-open="1"':'')+' data-btexp="'+K+'" aria-label="'+
    (open?'Свернуть':'Раскрыть')+'">'+(open?'▾':'▸')+'</button>':'<span class="caret-spacer"></span>';
  /* 29.10, п. 1: ровно четыре колонки — найм, переводы в, отток, переводы из (без «Итого» и полосы) */
  const cols=[['hire','Найм']].concat(trf?[['tin','Переводы в']]:[]).concat([['exit','Отток']]).concat(trf?[['tout','Переводы из']]:[]);
  const row=z=>'<tr'+(z.total?' class="total top"':z.exp?' class="urow" data-btexp="'+K+'"'+U.tipAttr({title:'Остальные',
        text:open?'Клик — свернуть.':'Кликни, чтобы посмотреть остальные.'}):z.sub?' class="lvl2"':'')+'><td class="txt">'+
      (tree?'<span class="row-label">'+(z.total?'<span class="caret-spacer"></span>':lbl(z))+'<span class="row-body">':'')+esc(z.name)+
      (z.note?'<span class="unit-sub">'+esc(z.note)+'</span>':'')+(tree?'</span></span>':'')+'</td>'+
      cols.map(c=>'<td class="num">'+D.fmtInt(z[c[0]])+'</td>').join('')+'</tr>';
  return '<div class="bt-group spm"><div class="bt-cap">Движение по специализациям<span class="bt-sub">с начала года, чел</span></div>'+
    '<div class="mx-wrap"><table class="ptable btable compact spm4"><colgroup><col>'+cols.map(()=>'<col style="width:62px">').join('')+
    '</colgroup><thead><tr><th class="txt"></th>'+cols.map(c=>'<th class="num">'+c[1]+'</th>').join('')+'</tr></thead><tbody>'+
    row(tot)+top.map(row).join('')+'</tbody></table></div>'+
    '<div class="tbl-note">С начала года; ИТОГО — как в карточках движения.'+(trf?'':' Переводы по специализациям появятся, когда ноутбук отчёта обновят.')+'</div></div>';
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
         legend:[{name:'В команду',color:G.C_IN},{name:'Из команды',color:G.C_OUT}]})+specMove(ctx.lp,ctx);
    }
    /* обзор: водопад года и то, что из него нужно вынести (story.js — insights) */
    return G.chart('waterfall',{steps:balancedSteps(ctx.lp)},{h:300,fill:true,
        title:'Изменение численности, чел',
        legend:[{name:'Начало и конец',color:G.C_TOTAL},{name:'Пришли',color:G.soft(G.C_IN)},{name:'Ушли',color:G.soft(G.C_OUT)}]})+
      U.storyFacts(ctx.story&&ctx.story.insights,'Что важно');
  }
};
})();

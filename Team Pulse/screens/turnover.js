/* ============================================================================
   screens/turnover.js — Отток и текучесть.

   Отток и текучесть — разные сущности, поэтому у каждой своя панель со своей
   шкалой от нуля, а не два бара рядом на одной оси:

     1. Отток, чел          — счётный факт за месяц, бары
     2. Текучесть месячная  — отток / среднесписочная за месяц, линия
     3. Текучесть накопительная — сумма месячных с января, линия. Обнуляется
        каждый январь, поэтому в январе она равна месячной, а к декабрю
        доходит до годового значения.

   Причины увольнений — ТАБЛИЦА с полосами в ячейках, не бар-чарт.

   Итерация 28 (бизнес-анализ, дашборд 34661): «Почему уходят» — инициатор
   увольнения над причинами; «Кто уходит» — стаж на момент ухода, грейд и
   стрим ушедших. Окно у всех разбивок — с начала года: так их считает Proteus
   («отток YTD по грейду, стажу, специализации»), и так же копится
   накопительная текучесть на соседней вкладке.

   26.10, правки: «Как уходит HQ?» — светофор: текучесть HQ, желательная и нежелательная с начала года против
   порогов прод-отчёта HQ, всегда по активной численности HQ (D.hqLight): фильтры покраски и типа численности
   на неё не действуют. Карточки — те же kpiCard, что в полосе KPI блока; под ними — те же панели «год к году».
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, SC=window.TPSCREENS;

/* светофор «Как уходит HQ?» — та же таблица, что светофор One-pager: полоса сигнала у названия, значение, изменения
   к прошлому месяцу и году, спарклайн, ориентир (цель или коридор) с сигналом */
function hqView(ctx){
  const h=D.hqLight(ctx.S);
  if(!h)return U.empty('Светофору HQ нужны данные','Они придут со следующим обновлением отчёта. Пока — поставьте в шапке покраску «HQ» и тип «Активная».');
  if(!h.hc)return U.empty('В подразделении нет HQ-сотрудников','Светофор считается только по активной численности HQ.');
  const f=(k,v)=>D.fmtVal(k,v), esc=U.esc, cap1=x=>x.charAt(0).toUpperCase()+x.slice(1);
  const tgt=r=>{const c=U.targetCell(r.key,r.v,null,r.kpi);
    return r.kpi&&r.kpi.red!==r.kpi.green?c.replace('цель '+f(r.key,r.kpi.green),'коридор '+f(r.key,r.kpi.green)+'–'+f(r.key,r.kpi.red)):c};
  /* правая панель узкая — колонки светофора: метрика, значение, год назад, ориентир с сигналом */
  const t='<table class="mtable hq-tl"><colgroup><col style="width:40%"><col style="width:15%"><col style="width:16%"><col></colgroup>'+
    '<thead><tr><th>Метрика</th><th class="num">Значение</th><th class="num">Год назад</th>'+
    '<th class="mid"'+U.tipAttr({title:'Ориентир',text:'Порог отчёта HQ: цель или коридор на этот месяц — доля годового.'})+
    '>Ориентир</th></tr></thead><tbody>'+
    h.rows.map(r=>'<tr class="mrow"><td class="m-name bar-'+r.st+'">'+esc(r.label)+U.infoDot(r.key)+'</td>'+
      '<td class="m-val">'+f(r.key,r.v)+'</td><td class="col-num">'+(r.ya==null?'—':f(r.key,r.ya))+'</td>'+
      '<td class="col-tgt">'+tgt(r)+'</td></tr>').join('')+'</tbody></table>';
  const color={turnover_y:G.C_TURN_Y,nonregret:G.C_OUT,regret:G.C_REGRET};
  return '<div class="tbl-note hq-note">Всегда по активной численности HQ: покраска и тип численности в шапке здесь не действуют, '+
      'IT-код и штат — действуют.</div>'+t+
    G.chart('panels',{panels:h.rows.map(r=>({name:r.label+', %',key:r.key,cur:r.yoy.cur,prev:r.yoy.prev,color:color[r.key]}))},
      {h:520,fill:true,legend:[{name:String(D.YEAR_CUR)},{name:String(D.YEAR_PREV)}]})+
    '<div class="tbl-note">Ориентир на месяц — доля годового порога отчёта HQ: бенчмарк текучести 15% за год (у IT — 12%), '+
      'коридор желательной 5–15%, цель нежелательной — 4%. Желательная и нежелательная пока не сходятся с мастер-источником.</div>';
}

SC.blocks.turnover={
  subTabs:[['dynamics','Отток и текучесть'],['reasons','Почему уходят'],['who','Кто уходит'],['hq','Как уходит HQ']],
  defaultSub:'dynamics',
  title(sub){return sub==='reasons'?'Почему уходят: инициатор и причины'
    :sub==='who'?'Кто уходит: стаж, грейд, стрим'
    :sub==='hq'?'Как уходит HQ: текучесть с начала года против порогов'
    :'Отток и текучесть по месяцам'},
  view(ctx){
    const lp=ctx.lp, ytd=' с начала года';
    if(ctx.sub==='hq')return hqView(ctx);
    if(ctx.sub==='reasons'){
      /* Инициатор — сумма причин: у каждой причины ровно один инициатор, поэтому
         две таблицы не расходятся. ★ — нежелательный уход; причины по убыванию,
         как в разборе «сверху вниз». Шапки первых колонок пустые: имя таблицы
         стоит подписью прямо над ней (правило 10f). */
      const rs=D.exitReasons(lp,'ytd');
      const initName=k=>(D.EXIT_INITIATORS.find(x=>x.key===k)||{}).name||'';
      /* Инициатор раскрывается в топ-3 своих причин (14.10, заказчик): строка
         инициатора — сумма причин, под ней три самые частые. Состояние — в том
         же наборе раскрытых строк, что у стримов (ключи «exitinit:…»). */
      const open=ctx.mixOpen||new Set(), ini=D.exitInitiators(lp,'ytd'), items=[];
      const topOf=k=>rs.filter(r=>r.init===k&&r.value>0).sort((a,b)=>b.value-a.value).slice(0,3);
      ini.forEach(x=>{
        const k='exitinit:'+x.key, top=topOf(x.key), on=top.length>0&&open.has(k);
        items.push({name:x.name,note:on?'':x.note,value:x.value,color:G.C_OUT,depth:1,exp:top.length?k:null,open:on});
        if(on)top.forEach(r=>items.push({name:r.name,value:r.value,color:r.regret?G.C_REGRET:G.C_NOREG,
          mark:r.regret,depth:2}));
      });
      const expable=ini.filter(x=>topOf(x.key).length);
      return U.btStack([
        U.btGroup({cap:'Инициатор увольнения',capSub:ytd+' · раскройте — три главные причины',head:'',valueHead:'Человек',
          metricKey:'attrition',compact:true,tree:true,items:items,
          expAll:{key:'exitinit',open:expable.length>0&&expable.every(x=>open.has('exitinit:'+x.key))}}),
        U.btGroup({cap:'Причины увольнений',capSub:ytd,head:'',valueHead:'Человек',metricKey:'attrition',sort:true,compact:true,
          items:rs.map(r=>({name:r.name,note:initName(r.init).toLowerCase(),value:r.value,
            mark:r.regret,color:r.regret?G.C_REGRET:G.C_NOREG}))})])+
        '<div class="tbl-note">★ — нежелательный уход: причина, на которую компания могла повлиять. '+
        'ИТОГО — отток с начала года ('+U.esc(D.YTD_RANGE)+').</div>';
    }
    if(ctx.sub==='who'){
      /* Ранний уход — первые 12 месяцев (испытательный срок и первый год): это
         качество найма и адаптации, а не текучесть вообще. Его доля названа
         в подписи, чтобы не складывать две строки в уме. */
      const ex=D.exitProfile(lp,'ytd');
      const early=ex.tenure.filter(t=>t.early).reduce((a,t)=>a+t.value,0);
      const grp=(cap,sub,items,sort,top)=>U.btGroup({cap:cap,capSub:sub,head:'',valueHead:'Человек',
        metricKey:'attrition',compact:true,sort:!!sort,items:items.map(x=>({name:x.name,value:x.value,color:G.C_OUT})),
        top:top?top.n:0,restWord:top?top.word:null});
      return U.btStack([
        grp('Стаж на момент ухода',ytd+(ex.total?' · ранний уход, до года: '+D.fmtInt(early)+' чел, '+
          U.pct(early/ex.total*100):''),ex.tenure),
        grp('Грейд',ytd,ex.grade),
        /* стримов на верхних уровнях десятки — первые 8 и «Остальные» (16.10) */
        grp('Стрим',ytd,ex.stream,true,{n:8,word:['стрим','стрима','стримов']})])+
        '<div class="tbl-note">ИТОГО — отток с начала года ('+U.esc(D.YTD_RANGE)+'). Стаж и грейд — на дату ухода.</div>';
    }
    /* Текучесть — всегда линия: это темп, а не количество. Барами остаётся
       только отток, потому что отток — счётные люди за месяц. Все три — год
       к году (13.10): накопительная на оси года обнуляется в январе у обоих
       лет и сравнивается месяц в месяц. */
    return SC.yoyPanels(lp,[
      {name:'Отток, чел',key:'attrition',color:G.C_OUT,ann:ctx.ann.attrition},
      {name:'Текучесть месячная, %',key:'turnover_m',color:G.C_LINE},
      {name:'Текучесть накопительная, %',key:'turnover_y',color:G.C_TURN_Y}]);
  }
};
})();

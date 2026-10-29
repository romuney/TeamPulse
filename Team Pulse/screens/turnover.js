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

   26.10-б: «Почему уходят» — сверху «Текучесть по инициатору» (initChart), под ней таблицы.
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
    return r.kpi&&r.kpi.red!==r.kpi.green?c.replace('цель '+f(r.key,r.kpi.green),'коридор '+f(r.key,r.kpi.green).replace('%','')+'–'+f(r.key,r.kpi.red)):c};
  /* правая панель узкая — колонки светофора: метрика, значение, год назад, ориентир с сигналом */
  const t='<table class="mtable hq-tl"><colgroup><col style="width:43%"><col style="width:14%"><col style="width:15%"><col></colgroup>'+
    '<thead><tr><th>Метрика</th><th class="num">Значение</th><th class="num">Год назад</th>'+
    '<th class="mid"'+U.tipAttr({title:'Ориентир',text:'Порог отчёта HQ: цель или коридор на этот месяц — доля годового.'})+
    '>Ориентир</th></tr></thead><tbody>'+
    h.rows.map(r=>'<tr class="mrow"><td class="m-name bar-'+r.st+'">'+esc(r.label)+U.infoDot(r.key)+'</td>'+
      '<td class="m-val">'+f(r.key,r.v)+'</td><td class="col-num">'+(r.ya==null?'—':f(r.key,r.ya))+'</td>'+
      '<td class="col-tgt">'+tgt(r)+'</td></tr>').join('')+'</tbody></table>';
  const color={turnover_y:G.C_TURN_Y,nonregret:G.C_OUT,regret:G.C_REGRET};
  /* 26.10-б, правки п. 4–5: значения — накопительно по последнему закрытому месяцу (незакрытый — только на графиках);
     данные блока сверены */
  return '<div class="tbl-note hq-note"><span class="live-tag ok"'+U.tipAttr(D.VERIFIED_TIP)+'>✓ сверены</span> '+
      'Накопительно по '+esc(D.MONTH_NOM[h.month.m])+(D.PARTIAL?' (закрытый месяц; '+esc(D.MONTH_NOM[D.ASOF.m])+' — на графиках)':'')+
      '. По активной численности HQ: покраску и тип численности из шапки не учитываем, IT-код и штат — да.</div>'+t+
    /* 27.10-в, п. 6: у HQ текучести незакрытый месяц тоже вызревает — пунктиром, как у желательной и нежелательной */
    G.chart('panels',{panels:h.rows.map(r=>({name:r.label+', %',key:r.key,cur:r.yoy.cur,prev:r.yoy.prev,color:color[r.key],mature:true}))},
      {h:520,fill:true,legend:[{name:String(D.YEAR_CUR)},{name:String(D.YEAR_PREV)}]})+
    '<div class="tbl-note">Ориентир — доля годового порога отчёта HQ: 15% (у IT — 12%), 5–15%, 4%.</div>';
}

/* 26.10-б, правки п. 8: «Текучесть по инициатору» — первым в «Почему уходят»: месячная текучесть уходов выбранного
   инициатора год к году; переключатель инициатора — справа сверху (только инициаторы с уходами), по умолчанию — с
   наибольшим числом уходов. Без линии базы: это часть текучести, не метрика целиком */
const INI_SHORT={emp:'Сотрудник',org:'Работодатель',oth:'Другое'};
function initChart(ctx){
  const xs=D.exitInitTurnover(ctx.lp);
  if(!xs)return U.devNote({stage:'0',t:'Придёт со следующим обновлением отчёта.'});
  if(!xs.length)return '';
  const c=xs.find(x=>x.key===ctx.S.exitIni)||xs.slice().sort((a,b)=>b.n-a.n)[0];
  return '<div class="ch-blk"><div class="ch-bar"><span class="ch-ttl">Текучесть по инициатору, %</span>'+
      U.segToggle('data-exitini',xs.map(x=>[x.key,INI_SHORT[x.key]||x.name]),c.key)+'</div>'+
    SC.metricLine('turnover_m',ctx.lp,ctx.bl,ctx.S,{yser:{cur:c.cur,prev:c.prev},noBench:true,h:240,fill:false,
      color:G.C_OUT,tipName:'Текучесть: '+c.name.charAt(0).toLowerCase()+c.name.slice(1)})+'</div>'+
    /* 27.10-в, п. 11: под ней — накопительная того же инициатора (переключатель общий): сумма месячной с января, как
       «Текучесть накопительная»; в сумме по инициаторам — она и есть */
    '<div class="ch-blk"><div class="ch-bar"><span class="ch-ttl">Накопительная текучесть по инициатору, %</span></div>'+
    SC.metricLine('turnover_y',ctx.lp,ctx.bl,ctx.S,{yser:{cur:cumY(c.cur),prev:cumY(c.prev)},noBench:true,kpi:null,h:240,
      fill:false,color:G.C_OUT,tipName:'Накопительная: '+c.name.charAt(0).toLowerCase()+c.name.slice(1)})+'</div>';
}
/* сумма месячной с января по ряду года; месяцы без значения остаются пустыми */
function cumY(a){let t=0;return a.map(v=>v==null?null:+(t+=v).toFixed(2))}

SC.cumY=cumY;
SC.blocks.turnover={
  subTabs:[['dynamics','Отток и текучесть'],['reasons','Почему уходят'],['who','Кто уходит'],['hq','Как уходит HQ']],
  defaultSub:'dynamics',
  title(sub){return sub==='reasons'?'Почему уходят: инициатор и причины'
    :sub==='who'?'Кто уходит: стаж, грейд, стрим'
    :sub==='hq'?'Как уходит HQ: светофор текучести'
    :'Отток и текучесть по месяцам'},
  view(ctx){
    const lp=ctx.lp, ytd=' с начала года';
    if(ctx.sub==='hq')return hqView(ctx);
    if(ctx.sub==='reasons'){
      /* Инициатор — по каждому уходу (пары «причина|инициатор»): одна причина бывает у разных инициаторов, поэтому
         у причины со смешанными инициаторами подпись — «сотрудник 24 · работодатель 4». ★ — нежелательный уход; причины по убыванию,
         как в разборе «сверху вниз». Шапки первых колонок пустые: имя таблицы
         стоит подписью прямо над ней (правило 10f). */
      const rs=D.exitReasons(lp,'ytd');
      const initName=k=>(D.EXIT_INITIATORS.find(x=>x.key===k)||{}).name||'';
      /* 26.10, ревью критиков: у причины — и число нежелательных («нежелат. 9»): ★ одна не раскладывала 17 нежелательных */
      const reasonInit=r=>{const sp=r.split||{}, ks=Object.keys(sp).filter(k=>Math.round(sp[k])>0);
        return (ks.length>1?ks.map(k=>INI_SHORT[k].toLowerCase()+' '+Math.round(sp[k])).join(' · '):initName(ks[0]||r.init).toLowerCase())+
          (r.regretN?' · нежелат. '+r.regretN:'')};
      /* Инициатор раскрывается в топ-3 своих причин (14.10, заказчик): строка
         инициатора — сумма причин, под ней три самые частые. Состояние — в том
         же наборе раскрытых строк, что у стримов (ключи «exitinit:…»). */
      const open=ctx.mixOpen||new Set(), ini=D.exitInitiators(lp,'ytd'), items=[];
      const topOf=k=>(ini.find(x=>x.key===k)||{top:[]}).top;
      ini.forEach(x=>{
        const k='exitinit:'+x.key, top=topOf(x.key), on=top.length>0&&open.has(k);
        items.push({name:x.name,note:on?'':x.note,value:x.value,color:G.C_OUT,depth:1,exp:top.length?k:null,open:on});
        if(on)top.forEach(r=>items.push({name:r.name,value:r.value,color:r.regret?G.C_REGRET:G.C_NOREG,
          mark:r.regret,depth:2}));
      });
      const expable=ini.filter(x=>topOf(x.key).length);
      return initChart(ctx)+U.btStack([
        U.btGroup({cap:'Инициатор увольнения',capSub:ytd+' · раскройте — три главные причины',head:'',valueHead:'Человек',
          metricKey:'attrition',compact:true,tree:true,items:items,
          expAll:{key:'exitinit',open:expable.length>0&&expable.every(x=>open.has('exitinit:'+x.key))}}),
        U.btGroup({cap:'Причины увольнений',capSub:ytd,head:'',valueHead:'Человек',metricKey:'attrition',sort:true,compact:true,
          items:rs.map(r=>({name:r.name,note:reasonInit(r),value:r.value,
            mark:r.regret,color:r.regret?G.C_REGRET:G.C_NOREG}))})])+
        '<div class="tbl-note">'+(rs.some(r=>r.regret)?'★ — у причины больше половины уходов нежелательные. ':'')+
        'ИТОГО — отток с начала года ('+U.esc(D.YTD_RANGE)+').</div>';
    }
    if(ctx.sub==='who'){
      /* Ранний уход — первые 12 месяцев (испытательный срок и первый год): это
         качество найма и адаптации, а не текучесть вообще. Его доля названа
         в подписи, чтобы не складывать две строки в уме. */
      const ex=D.exitProfile(lp,'ytd');
      const early=ex.tenure.filter(t=>t.early).reduce((a,t)=>a+t.value,0);
      /* 26.10, ревью критиков: под строкой — доля группы в команде; уходят чаще своей доли (×1,2 и на 3 человека
         больше ожидаемого) — сказано прямо */
      const grp=(cap,sub,items,dim,sort,top)=>{const ts=D.teamShare(lp,dim);return U.btGroup(Object.assign({cap:cap,capSub:sub,head:'',valueHead:'Человек',
        metricKey:'attrition',compact:true,sort:!!sort,items:items.map(x=>{const t=ts[x.name], e=t*ex.total;
          return {name:x.name,note:t!=null?'в команде '+U.pct(t*100)+(x.value>=1.2*e&&x.value-e>=3?' · уходят чаще своей доли':''):'',value:x.value,color:G.C_OUT}}),
        top:top?top.n:0,restWord:top?top.word:null},top?SC.rest(ctx,'x'+dim,top.n,top.word):{}))};
      return U.btStack([
        grp('Стаж на момент ухода',ytd+(ex.total?' · ранний уход, до года: '+D.fmtInt(early)+' чел, '+
          U.pct(early/ex.total*100):''),ex.tenure,'tenure'),
        grp('Грейд',ytd,ex.grade,'grade'),
        /* стримов на верхних уровнях десятки — первые 8 и «Остальные» (16.10) */
        grp('Стрим',ytd,ex.stream,'stream',true,{n:8,word:['стрим','стрима','стримов']})])+
        '<div class="tbl-note">ИТОГО — отток с начала года ('+U.esc(D.YTD_RANGE)+'). Стаж и грейд — на дату ухода, доля в команде — '+
        'по численности на последний месяц.</div>';
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

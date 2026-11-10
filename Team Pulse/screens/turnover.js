/* ============================================================================
   screens/turnover.js — Отток и текучесть.

   Отток и текучесть — разные сущности, поэтому у каждой своя панель со своей
   шкалой от нуля, а не два бара рядом на одной оси:

     1. Отток, чел          — счётный факт за месяц, бары
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
   26.10, правки: «Как уходит HQ?» — текучесть HQ, желательная и нежелательная с начала года (поставка 103, файл 9,
   п. 10: без целей — факт и сравнение с прошлым годом), всегда по активной численности HQ (D.hqLight): фильтры покраски и типа численности
   на неё не действуют. Карточки — те же kpiCard, что в полосе KPI блока; под ними — те же панели «год к году».
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, SC=window.TPSCREENS;

/* светофор «Как уходит HQ?» — та же таблица, что светофор One-pager: полоса сигнала у названия, значение, изменения
   к прошлому месяцу и году, спарклайн, ориентир (цель или коридор) с сигналом */
function hqView(ctx){
  const h=D.hqLight(ctx.S,ctx.lp,ctx.sel);
  if(!h)return U.empty('Светофору HQ нужны данные','Они придут со следующим обновлением отчёта. Пока — поставьте в шапке покраску «HQ» и тип «Активная».');
  if(!h.hc)return U.empty('В подразделении нет HQ-сотрудников','Светофор считается только по активной численности HQ.');
  const esc=U.esc;
  /* поставка 90 (заказчик): таблица светофора снята — значения, год назад и пороги есть в тексте главы и в строке итога
     над каждым графиком */
  const color={turnover_y:G.C_TURN_Y,nonregret:G.C_OUT,regret:G.C_REGRET};
  /* 26.10-б, правки п. 4–5: значения — накопительно по последнему закрытому месяцу (незакрытый — только на графиках);
     данные блока сверены */
  /* поставка 136, п. 12 (владелец): пометки «✓ сверены» в разделе «Как уходит HQ» нет; расчёты и числа — те же */
  return '<div class="tbl-note hq-note">'+
      /* поставка 137, п. 3: накопительно по дату данных — с текущим месяцем */
      'Накопительно с 1 января по '+esc(D.ASOF_LABEL)+
      '. По активной численности HQ: покраску и тип численности из шапки не учитываем, IT-код и штат — да.</div>'+
    /* поставка 110 (A3): HQ меньше 30 человек — линии без оценки, один уход заметно сдвигает долю */
    (h.hc<D.SMALL_N?'<div class="tbl-note">В HQ '+D.fmtInt(h.hc)+' '+U.plural(h.hc,['человек','человека','человек'])+
      ': один уход сдвигает текучесть примерно на '+String(Math.round(1000/h.hc)/10).replace('.',',')+' п.п. Доли не оцениваем.</div>'
      /* поставка 138, п. 6: HQ от 30 человек, но ниже порога строки (100 — текучесть и желательная, 50 — нежелательная) */
      :h.rows.some(r=>r.low)?'<div class="tbl-note">'+U.esc(D.TURN_LOW_NOTE)+' Порог численности HQ: текучесть и желательная — от '+
        D.turnMin('turnover_y')+' человек, нежелательная — от '+D.turnMin('regret')+'.</div>':'')+
    /* 27.10-в, п. 6: у HQ текучести незакрытый месяц тоже вызревает — пунктиром, как у желательной и нежелательной */
    G.chart('panels',{panels:h.rows.map(r=>({name:r.label+', %',key:r.key,cur:r.yoy.cur,prev:r.yoy.prev,color:color[r.key],mature:true,
      /* поставка 128 (владелец 08.11: «цели на шаге HQ»): цель — коридором по оси года, как на графиках KPI, и значением в строке
         итога (цель закрытого месяца — годовая × номер месяца ÷ 12) */
      kpi:r.kpi,
      /* поставка 128 (аудит: «доли не оцениваем», а чип текучести HQ красный — цвет брался по численности всего подразделения):
         в HQ меньше 30 человек — чип изменения без цвета, как и написано выше */
      period:Object.assign({},D.periodTotal(h.lp,r.key,r.yoy)||{},h.hc<D.SMALL_N||r.low?{good:null}:{},
        r.kpi?{ref:'цель '+D.fmtVal(r.key,r.kpi.green)+(r.kpi.hi!=null?', верхний порог '+D.fmtVal(r.key,r.kpi.hi):'')+
          (r.st==='bad'?(r.kpi.hi!=null&&r.v>r.kpi.hi?' — выше порога':' — хуже'):r.st==='good'?' — лучше':'')}:{})}))},
      {h:720,fill:true,legend:[{name:String(D.YEAR_CUR)},{name:String(D.YEAR_PREV)}]})+
    (h.rows.some(r=>r.kpi)?'<div class="tbl-note">Цели — годовые, как в отчёте HQ: текучесть HQ — '+
      D.fmtVal('turnover_y',(h.rows[0].kpi||{annual:{}}).annual.green)+' за год, нежелательная — не выше '+
      D.fmtVal('regret',(h.rows[2].kpi||{annual:{}}).annual.green)+', желательная — не ниже '+D.fmtVal('nonregret',(h.rows[1].kpi||{annual:{}}).annual.green)+
      ((h.rows[1].kpi||{annual:{}}).annual.hi!=null?' и не выше '+D.fmtVal('nonregret',h.rows[1].kpi.annual.hi):'')+
      '. На дату данных — их доля: годовая × прошедшая часть года; на графиках — пунктиром.</div>':'');
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
  /* 06.11, заказчик: заголовок — внутри графика, в одной строке с легендой, как у всех графиков (отдельной HTML-строкой
     он оставлял под собой пустую строку легенды — большой отступ до «В среднем за месяц»); переключатель — справа над ним */
  /* поставка 138, п. 9 (владелец: «месячную текучесть и все упоминания с вкладки оттока убрать»): помесячный график текучести
     по инициатору снят — остаётся накопительная того же инициатора (переключатель над ней); в сумме по инициаторам — она
     и есть «Текучесть накопительная» */
  return '<div class="ch-blk"><div class="ch-bar ch-bar-r">'+
      U.segToggle('data-exitini',xs.map(x=>[x.key,INI_SHORT[x.key]||x.name]),c.key)+'</div>'+
    SC.metricLine('turnover_y',ctx.lp,ctx.bl,ctx.S,{yser:{cur:cumY(c.cur),prev:cumY(c.prev)},noBench:true,kpi:null,h:280,
      title:'Накопительная текучесть по инициатору, %',
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
    :sub==='hq'?'Как уходит HQ: текучесть накопительно'
    :'Отток и текучесть по месяцам'},
  view(ctx){
    const lp=ctx.lp, ytd=' '+D.CNT_TEXT;   /* поставка 106: разбивки — по дату данных */
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
        U.btGroup({cap:'Инициатор увольнения',capSub:ytd,head:'',valueHead:'Чел',
          metricKey:'attrition',compact:true,tree:true,items:items,
          expAll:{key:'exitinit',open:expable.length>0&&expable.every(x=>open.has('exitinit:'+x.key))}}),
        U.btGroup({cap:'Причины увольнений',capSub:ytd,head:'',valueHead:'Чел',metricKey:'attrition',sort:true,compact:true,
          items:rs.map(r=>({name:r.name,note:reasonInit(r),value:r.value,
            mark:r.regret,color:r.regret?G.C_REGRET:G.C_NOREG}))})])+
        (rs.some(r=>r.regret)?'<div class="tbl-note">★ — у причины больше половины уходов нежелательные.</div>':'');
    }
    if(ctx.sub==='who'){
      /* Ранний уход — первые 12 месяцев (испытательный срок и первый год): это
         качество найма и адаптации, а не текучесть вообще. Его доля — в выводе шага и в степпере. */
      const ex=D.exitProfile(lp,'ytd');
      /* 09.11, поставка 130 (владелец: «"уходят чаще, чем в среднем" — странно: для этого нужна текучесть группы; опираемся только на долю в
         оттоке»): строки — сколько ушло и какая это доля оттока, без сравнения с долей в команде */
      const grp=(cap,sub,items,dim,sort,top)=>U.btGroup(Object.assign({cap:cap,capSub:sub,head:'',valueHead:'Чел',
        metricKey:'attrition',compact:true,sort:!!sort,items:items.map(x=>({name:x.name,value:x.value,color:G.C_OUT})),
        top:top?top.n:0,restWord:top?top.word:null},top?SC.rest(ctx,'x'+dim,top.n,top.word):{}));
      return U.btStack([
        /* поставка 116: «ранний уход, до года» — уже в выводе шага и в степпере; подпись — период, итог — справа */
        grp('Стаж на момент ухода',ytd,ex.tenure,'tenure'),
        grp('Грейд',ytd,ex.grade,'grade'),
        /* стримов на верхних уровнях десятки — первые 8 и «Остальные» (16.10) */
        grp('Стрим',ytd,ex.stream,'stream',true,{n:8,word:['стрим','стрима','стримов']})])+
        '<div class="tbl-note">Стаж и грейд — на дату ухода.</div>';
    }
    /* Текучесть — всегда линия: это темп, а не количество. Барами остаётся
       только отток, потому что отток — счётные люди за месяц. Все три — год
       к году (13.10): накопительная на оси года обнуляется в январе у обоих
       лет и сравнивается месяц в месяц. */
    return SC.yoyPanels(lp,[
      {name:'Отток, чел',key:'attrition',color:G.C_OUT,ann:ctx.ann.attrition},
      /* поставка 138, п. 9 (владелец): месячной текучести на вкладке оттока нет */
      {name:'Текучесть накопительная, %',key:'turnover_y',color:G.C_TURN_Y}],{h:720,bl:ctx.bl,S:ctx.S});
  }
};
})();

/* ============================================================================
   screens/onepager.js — главная: сначала выводы, потом метрики.
   20.10 (вариант A, одобрен заказчиком): сводка одной фразой, до четырёх
   карточек выводов («Требует действий», «Посмотреть», «Хорошая новость») с
   людьми, мини-графиком, «Что сделать» и переходом; «В норме» — строкой.
   «Все метрики» — прежняя сводка: KPI-карточки и семь блоков таблицами, у
   каждой метрики значение, MoM, YoY, спарклайн и ориентир; клик по строке
   раскрывает график «год к году» с разбором «Что видно» (механика HRBP HUB).
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, SC=window.TPSCREENS;
const esc=U.esc;

/* Шапка-дайджест (рекомендация бизнес-анализа: «свести численность, текучесть
   YTD, долю джунов и проникновение AI в единую шапку»). Восемь карточек —
   две строки по четыре: поток людей, текучесть, найм, AI и офис. */
const HERO=['hc_total','hire','attrition','turnover_y','regret','junior_share','ai_penetration','office_att'];

/* Второй ряд карточки-героя у счётной метрики. Пометка «не сравнивается»
   занимала место и ничего не сообщала — три карточки из шести кончались ею.
   Здесь её место отдано контексту из той же метрики: у потока людей — сумма
   за 12 месяцев (месячное «3» ничего не говорит о масштабе), у численности —
   прирост с начала года. Оценки по-прежнему нет: это факты, а не сравнение. */
function heroContext(k,s,rl){
  if(k==='hc_total'){
    const ytd=D.lastVal(rl,'net_ytd');
    return '<span class="k-sub">с начала года <b>'+D.fmtDelta('net_ytd',ytd)+'</b></span>';
  }
  if(D.METRIC_BY_KEY[k].fmt==='int')
    return '<span class="k-sub">за год <b>'+D.fmtVal(k,SC.sumS(s))+'</b> чел</span>';
  return '';
}
/* Сравнение с базой в KPI-карточке — только у «Проникновения AI» (14.10,
   заказчик): у остальных карточек оно дублировало колонку «Сравнение» таблицы
   и перегружало полосу. Подпись — «по компании», а не «база». */
const cardBase=(k,kpi)=>!kpi&&k==='ai_penetration'&&D.comparable(k);
/* Метрика без оценки: нет цели KPI, и она либо несравнима, либо «больше не
   значит лучше» — у её спарклайна нет цветных точек и пунктира ориентира. */
const noEval=(m,kpi)=>!kpi&&(!D.comparable(m.key)||m.better==='flat');

/* ---------- «О метрике» в раскрытой строке ----------
   Как в HRBP HUB: что это, как считаем (дробью, словами) и с чем сравниваем.
   Имена слагаемых — по-русски: служебных рядов в METRICS нет. */
const PART={regret_m:'regrettable текучесть за месяц',hc_avg:'средняя численность за месяц',pf_plan:'план найма',hire_jun:'принятые джуны',
  rev_eval:'оценённые в ревью',rev_up:'улучшили оценку',ovis:'дни в офисе',
  wday:'отработанные дни',regret_cnt:'нежелательные уходы',
  tgrowth_pass:'одобренные заявки',tgrowth_deny:'отклонённые заявки'};
/* строчная — только первая буква: «T-рост», «AI», «WAU» остаются как есть */
const partName=k=>{const n=PART[k]||(D.METRIC_BY_KEY[k]||{}).name||k;return n.charAt(0).toLowerCase()+n.slice(1)};
/* Формула метрики — MathML (14.10, заказчик: «формулы выделять и использовать
   MathML»): дробь — <mfrac>, накопление с января — Σ с пределами, × 100 у
   процентов. Слова формулы — <mtext>, экранированные esc(). Под формулой —
   окно расчёта словами. Шрифт формулы — Arial, как везде в отчёте (styles.css). */
const mt=t=>'<mtext>'+esc(t)+'</mtext>';
function fracML(dv){
  const den=Array.isArray(dv.den)?'<mrow>'+dv.den.map(k=>mt(partName(k))).join('<mo>+</mo>')+'</mrow>':mt(partName(dv.den));
  return '<mfrac>'+mt(partName(dv.num))+den+'</mfrac>'+(dv.scale===100?'<mo>×</mo><mn>100</mn>':'');
}
function formulaOf(m){
  if(m.derived)return {ml:fracML(m.derived),
    note:[m.derived.scale===100?'в процентах':'',m.derived.win==='ytd'?'с начала года':'за месяц'].filter(Boolean).join(', ')};
  if(m.ytd){
    /* накопительная: сумма месячных значений с января по текущий месяц */
    const ch=D.defOf(m.ytd), body=ch.derived?fracML(ch.derived):mt(partName(m.ytd));
    return {ml:'<munderover><mo class="sum">∑</mo>'+mt('январь')+mt(D.MONTH_NOM[D.CUR_LEN-1])+'</munderover>'+body,
      note:'по месяцам с января, обнуляется каждый январь'};
  }
  return null;
}
function about(m,S){
  const kpi=D.kpiFor(m.key,S), fr=formulaOf(m);
  let h='<p class="op-stp">'+esc(m.hint)+'</p>';
  if(fr)h+='<div class="op-math" aria-label="Как считаем"><math display="block">'+fr.ml+'</math>'+
    (fr.note?'<div class="op-frs">'+esc(fr.note[0].toUpperCase()+fr.note.slice(1))+'</div>':'')+'</div>';
  const ref=kpi?'Ориентир: цель KPI '+D.fmtVal(m.key,kpi.green)+', порог '+D.fmtVal(m.key,kpi.red)
    :D.comparable(m.key)?'Ориентир: база «'+D.benchmarkLabel(S)+'» за тот же месяц':
     m.better==='flat'?'Без оценки: больше — не значит лучше':'Без оценки: это количество, оно зависит от размера команды';
  return h+'<div class="op-frs">'+esc(ref)+'.</div>';
}
/* Пояснение к выводам главной: какие пороги и что не оценивается. */
function obsInfo(S){
  const O=window.TPINSIGHTS.OBS, C=window.TPINSIGHTS.CARD;
  return '<span class="info"'+U.tipAttr({title:'Как отобраны выводы',
    text:'Считается правилами по тем же числам, без ИИ. В выводы попадает:',
    list:['метрика хуже или лучше ориентира на '+Math.round(O.dev*100)+'% и больше',
      'заметно изменилась за год',
      'ухудшается '+O.trend+' месяца подряд',
      'всплеск уходов и сдвиг численности'],
    note:'Ориентир — цель KPI, а где её нет — база «'+D.benchmarkLabel(S)+'». Порядок — по людям сверх ориентира. '+
      'Подразделение названо, если на него приходится больше половины отклонения; меньше '+C.small+' человек — не оцениваем.'})+
    ' aria-label="Как отобраны выводы">i</span>';
}

/* ---------- Карточка вывода ----------
   c — TPINSIGHTS.cards(): заголовок и «Что сделать» уже собраны там, body —
   с <b> вокруг людей и имён. Мини-график ведёт к строке метрики в «Все
   метрики», кнопка — во вкладку блока или сразу к подразделению. */
function insightCard(c){
  const go=c.btn.go?' data-opgo="'+esc(c.btn.go)+'"':' data-tab="'+esc(c.btn.tab)+'"';
  return '<div class="in-card '+c.sev+'"><div class="in-t"><span class="in-tag">'+esc(c.tag)+'</span>'+
    '<span class="in-blk">· '+esc(c.blockName)+'</span></div>'+
    '<div class="in-row"><div class="in-txt"><div class="in-h">'+esc(c.head)+'</div>'+
      (c.body?'<div class="in-b">'+c.body+'</div>':'')+'</div>'+
    (c.chart?'<button class="in-mini" data-opfact="'+esc(c.key)+'"'+U.tipAttr({title:D.METRIC_BY_KEY[c.key].name,
      text:'Этот год против ориентира.',note:'Нажмите — откроется подробный график.'})+'>'+c.chart+'</button>':'')+'</div>'+
    '<div class="in-a"><span class="in-do">'+c.todo+'</span><button class="btn in-go"'+go+'>'+esc(c.btn.label)+'</button></div></div>';
}
/* «В норме»: живые метрики без выводов — значением в пилюле; клик открывает
   строку метрики в «Все метрики». Заглушки — отдельной пилюлей «в разработке». */
function normOf(S,rl,all){
  const has=new Set(all.map(c=>c.key));
  return D.METRICS.filter(m=>D.metricVisible(m.key,S)&&!D.isStub(m.key)&&!has.has(m.key)&&D.lastVal(rl,m.key)!=null);
}
function normRow(S,rl,ok){
  const NP=7, dev=D.METRICS.filter(m=>D.metricVisible(m.key,S)&&D.isStub(m.key)).length;
  return '<div class="in-ok"><span class="in-okt"'+U.tipAttr({title:'В норме',
      text:'Метрики без заметных отклонений от ориентира и от прошлого года. Количества (численность, найм) не оцениваются — показаны значением.'})+
    '>✓ В норме</span>'+
    ok.slice(0,NP).map(m=>'<button class="in-pill" data-opfact="'+m.key+'"'+U.tipAttr({title:m.name,text:m.hint})+'>'+
      esc(m.name)+' <b>'+D.fmtVal(m.key,D.lastVal(rl,m.key))+'</b></button>').join('')+
    (ok.length>NP?'<button class="in-pill more" data-opall="1">+'+(ok.length-NP)+' '+U.plural(ok.length-NP,['метрика','метрики','метрик'])+'</button>':'')+
    (dev?'<button class="in-pill dev" data-opall="1"'+U.tipAttr({title:'В разработке',text:'Метрики без источника: цифры условные, выводов по ним нет.'})+'>'+
      dev+' в разработке</button>':'')+
    (ok.length?'':'<span class="in-none">всё, что оценивается, — в выводах выше</span>')+'</div>';
}

/* Метка у имени блока: весь блок без источника — «в разработке · этап N»,
   часть вкладок — «частично в разработке». */
function blockDevTag(bk){
  const st=SC.blockDev(bk);
  if(!st)return '';
  if(st==='part')return '<span class="dev-tag"'+U.tipAttr({title:'Частично в разработке',
    text:'На части вкладок блока цифры пока условные.',note:'Такие вкладки отмечены полосками в блоке.'})+'>частично в разраб.</span>';
  const d=(SC.blocks[bk].subTabs||[]).map(t=>SC.devOf(bk,t[0])).find(Boolean);
  return U.devTag(d?d.stage:null);
}

/* ---------- рендер ---------- */
function render(S,openRows,opAll){
  const rl=D.reportLeaves(S), bl=D.benchmarkLeaves(S), I=window.TPINSIGHTS;
  if(!rl.length)return U.empty('Под эти фильтры никто не попал',
    'Снимите один из фильтров в шапке.');

  /* 1 · заголовок: за какой месяц, чья команда, по какой численности и с чем сравниваем */
  const node=D.NODE_BY_PATH[S.unit]||{}, hc=D.lastVal(rl,'hc_total')||0;
  let h='<div class="page-h"><h2>Главное за '+esc(D.CMP.cur)+'</h2>'+
    '<p>'+esc(node.name||'Команда')+' · '+D.fmtInt(hc)+' '+U.plural(Math.round(hc),['человек','человека','человек'])+' · '+
    (S.hcType==='all'?'вся численность':'активная численность')+' · сравнение с базой <b>'+esc(D.benchmarkLabel(S))+
    '</b> и прошлым годом'+obsInfo(S)+'</p></div>';

  /* 2 · сводка и карточки выводов. Видно четыре, остальные (до восьми) — по
     «Ещё N»: та же кнопка data-ai, что раскрывала «Что видно в данных». */
  const all=I.cards(S,rl,bl,true), list=all.slice(0,I.OBS.max), ok=normOf(S,rl,all), open=S.aiOpen==='op';
  I.lastSev=list.length?list[0].sev:'none';
  h+='<div class="in-lead">'+U.aiIco(true)+'<div class="in-lt">'+I.lead(S,rl,list,ok.length)+'</div></div>';
  if(list.length){
    h+='<div class="in-grid">'+(open?list:list.slice(0,I.CARD.show)).map(insightCard).join('')+'</div>';
    if(list.length>I.CARD.show)h+='<button class="in-more-c" data-ai="op">'+(open?'Свернуть ▴':'Ещё '+(list.length-I.CARD.show)+' '+
      U.plural(list.length-I.CARD.show,['вывод','вывода','выводов'])+' ▾')+'</button>';
  }
  h+=normRow(S,rl,ok);

  /* 3 · «Все метрики» — прежняя сводка, по кнопке. Раскрытие — состояние показа
     (app.js, opAll), в ссылку не едет. */
  h+='<div class="in-all"><span>Все метрики — карточки и таблицы по блокам: значение, изменение за месяц и год, ориентир</span>'+
    '<button class="btn in-go" data-opall="'+(opAll?'0':'1')+'">'+(opAll?'Свернуть все метрики ▴':'Показать все метрики ▾')+'</button></div>';
  if(!opAll)return h;

  /* Готовность к живым данным (14.10): сколько метрик уже считается из
     источника и что подключать дальше — одной строкой, план раскрывается. */
  const live=D.METRICS.filter(m=>!D.isDev(m.key)).length;
  if(live<D.METRICS.length)h+=U.devSummary({live,total:D.METRICS.length,plan:D.DEV_PLAN});

  /* KPI-стрип: только выбранные метрики. hc_total и hc_active выключить нельзя,
     поэтому стрип не может опустеть целиком. */
  /* восемь карточек — по четыре в ряд; если часть скрыта, полоса тянется сама */
  const heroKeys=HERO.filter(k=>D.metricVisible(k,S));
  h+='<div class="kpis'+(heroKeys.length>6?' n4':'')+'">';
  heroKeys.forEach(k=>{
    const s=D.aggregate(rl,k), v=s[D.LAST], dl=D.deltasOf(rl,k);
    const kpi=D.kpiFor(k,S), bv=D.lastVal(bl,k);
    const st=kpi?D.stateForKpi(k,v,kpi):D.compareState(k,v,bv);
    /* Есть KPI — сравниваемся с ним, и базы в карточке нет вовсе: два ориентира
       рядом заставляли выбирать, по какому судить. Нет KPI — база как раньше. */
    h+=U.kpiCard({label:D.METRIC_BY_KEY[k].name,tag:D.isDev(k)?U.devTag(D.devStage(k)):'',
      q:U.infoDot(k),
      value:D.fmtVal(k,v),
      row1:U.momChip(k,dl.mom)+
        G.sparkLine(s,st,84,24,{key:k,kpi:kpi,base:cardBase(k,kpi)?D.aggregate(bl,k):null,ink:true,dots:false}),
      row2:(kpi?'<span class="k-sub">цель '+D.fmtVal(k,kpi.green)+'</span><span class="kpi-tag">KPI</span>'
             :cardBase(k,kpi)?U.byCompany(k,bv,S):heroContext(k,s,rl)),
      /* год назад — тем же месяцем: число, которое в таблице стоит пилюлей
         «за год», здесь названо значением, чтобы его было с чем сверить */
      row3:'год назад <b>'+D.fmtVal(k,SC.yearAgo(rl,k))+'</b>'});
  });
  h+='</div>'+U.trafficLegend();

  /* мини-навигация по блокам: липкая, с точкой худшего сигнала */
  h+=U.blockNav(D.visibleBlocks(S).map(b=>Object.assign({key:b.key,name:b.name},D.blockSignal(b.key,S))));

  /* блоки: пропускаем те, где отключены все метрики */
  D.visibleBlocks(S).forEach(b=>{
    h+='<div class="block-h" id="op-'+b.key+'"><span class="block-name">'+esc(b.name)+blockDevTag(b.key)+'</span>'+
      '<span class="block-hint">'+esc(b.hint)+'</span>'+
      '<button class="btn ghost" data-tab="'+b.key+'">Подробнее →</button></div>';
    /* Месяц сравнения подписан в шапке колонки, а не у каждой строки: «за месяц»
       само по себе не говорило, с чем сравнивается число, а повторять «к маю»
       девятнадцать раз незачем. */
    const thSub=s=>'<span class="th-sub">'+esc(s)+'</span>';
    /* Общая каретка предлагает свернуть только когда раскрыты ВСЕ строки блока */
    const bMets=D.visibleMetricsOfBlock(b.key,S);
    const allOpen=bMets.length>0&&bMets.every(m=>openRows.has(m.key));
    let t='<table class="mtable">'+
      /* колонка «12 мес» без фиксированной ширины: забирает всю свободную
         ширину на широком экране, а спарклайн тянется вместе с ней */
      '<colgroup><col style="width:26%"><col style="width:12%"><col style="width:10%"><col style="width:10%"><col>'+
      '<col style="width:19%"><col style="width:28px"></colgroup>'+
      '<thead><tr><th>Метрика</th><th class="num">Значение</th>'+
      '<th class="num">За месяц'+thSub(D.CMP.momFull)+'</th>'+
      '<th class="num">За год'+thSub(D.CMP.yoy)+'</th><th class="mid">12 мес</th>'+
      '<th class="mid">Ориентир'+thSub('цель KPI или база')+'</th>'+
      /* Общая каретка стоит над колонкой строчных кареток: строки блока
         раскрывают графики по одной, и раскрыть их разом должно быть можно
         одной кнопкой — правило то же, что у ИТОГО в сводной таблице. */
      '<th class="col-caret">'+U.allCaret('data-opexpall',b.key+'|'+(allOpen?'0':'1'),allOpen,
        'Графики всех метрик блока разом.')+'</th></tr></thead><tbody>';
    bMets.forEach(m=>{
      const s=D.aggregate(rl,m.key), v=s[D.LAST], dl=D.deltasOf(rl,m.key);
      const kpi=D.kpiFor(m.key,S), bv=D.lastVal(bl,m.key);
      const st=kpi?D.stateForKpi(m.key,v,kpi):D.compareState(m.key,v,bv);
      /* база помесячно: спарклайн красит КАЖДЫЙ месяц по своему месяцу базы,
         а не весь ряд по последнему значению. У метрики с KPI базы нет ни в
         спарклайне, ни на раскрытом графике: ориентир там один — цель. */
      const bser=!kpi&&D.comparable(m.key)?D.aggregate(bl,m.key):null;
      const open=openRows.has(m.key);
      t+='<tr class="mrow'+(open?' open':'')+'" data-metric="'+m.key+'">'+
        '<td class="m-name bar-'+st+'">'+esc(m.name)+(D.isDev(m.key)?U.devTag(D.devStage(m.key)):'')+'<span class="m-sub">'+esc(m.hint)+'</span></td>'+
        '<td class="m-val">'+D.fmtVal(m.key,v)+'</td>'+
        '<td class="col-num">'+U.deltaChip(m.key,dl.mom,{tip:D.CMP.momTip})+'</td>'+
        '<td class="col-num">'+U.deltaChip(m.key,dl.yoy,{tip:D.CMP.yoyTip})+'</td>'+
        /* Короткая динамика — у всех метрик одним видом, спарклайном (13.10:
           «где-то барчарты, где-то лайнчарты»). Оценка по месяцам — цветом
           точек, ориентир — пунктиром; у метрики без оценки точек нет. */
        '<td class="col-spark">'+G.sparkLine(s,st,180,28,{key:m.key,base:bser,kpi:kpi,ink:noEval(m,kpi),dots:false})+'</td>'+
        '<td class="col-tgt">'+U.targetCell(m.key,v,bv,kpi)+'</td>'+
        '<td class="col-caret">'+U.rowCaret(open)+'</td></tr>';
      /* график раскрытой строки рисуется сразу в разметке — отдельного монтирования не нужно */
      if(open){
        /* Механика HRBP HUB (13.10): слева год к году с номерными отметками,
           справа «Что видно» с теми же номерами и «О метрике». Полотна
           «12 мес» больше нет — вся динамика отчёта год к году. */
        const st=window.TPINSIGHTS.yoyStory(m.key,S,rl,bl);
        t+='<tr class="detail-row"><td colspan="7"><div class="detail-chart">'+U.opStory(
          SC.yoyChart(m.key,rl,bl,S,{title:'Этот год и прошлый',h:280,fill:false,
            marks:st.marks,link:true}),st,about(m,S))+'</div></td></tr>';
      }
    });
    h+=U.panel({body:t+'</tbody></table>'});
  });

  return h;
}

SC.onepager={render,HERO,insightCard};
})();

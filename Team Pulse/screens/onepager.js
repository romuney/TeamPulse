/* ============================================================================
   screens/onepager.js — сводка по всем метрикам на одном экране.
   Семь блоков таблицами, у каждой метрики значение, MoM, YoY, спарклайн и
   сравнение с базой. Клик по строке раскрывает график «год к году» с
   разбором «Что видно» (механика HRBP HUB); над таблицами — «Что видно
   в данных» по отбору целиком.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, SC=window.TPSCREENS;
const esc=U.esc;

/* Шапка-дайджест (рекомендация бизнес-анализа: «свести численность, текучесть
   YTD, долю джунов и проникновение AI в единую шапку»). Восемь карточек —
   две строки по четыре: поток людей, текучесть, найм, AI и офис. */
const HERO=['hc_total','hire','attrition','turnover_y','regret','junior_share','ai_penetration','office_att'];

/* Счёт сигналов и сдвиги за год для полосы «Пульс команды».
   Сигнал — та же развилка, что везде: цель KPI, иначе база; несравнимые и
   «больше не значит лучше» — без оценки. Сдвиги берём только у относительных
   метрик: у счётных «2 → 4 человека» даёт +100% и забивает весь список. */
function pulse(S,rl,bl){
  let good=0,bad=0,neu=0;const mv=[];
  D.METRICS.forEach(m=>{
    if(!D.metricVisible(m.key,S))return;
    /* пробник: заглушка не сигнал и не сдвиг — цифра сгенерирована */
    if(D.isStub(m.key))return;
    const v=D.lastVal(rl,m.key), kpi=D.kpiFor(m.key,S);
    const st=m.better==='flat'?'neutral':kpi?D.stateForKpi(m.key,v,kpi):D.compareState(m.key,v,D.lastVal(bl,m.key));
    if(st==='good')good++;else if(st==='bad')bad++;else neu++;
    if(m.better==='flat'||m.fmt==='int')return;
    const yoy=D.deltasOf(rl,m.key).yoy;
    /* доля без знаменателя в одном из месяцев — сдвига нет, а не «минус всё» */
    if(v==null||yoy==null)return;
    const prev=v-yoy;
    const rel=prev?Math.abs(yoy)/Math.abs(prev):0;
    if(rel>=0.05)mv.push({key:m.key,name:m.name,block:m.block,cur:v,prev,yoy,rel});
  });
  mv.sort((a,b)=>b.rel-a.rel);
  return {good,bad,neu,movers:mv.slice(0,3)};
}
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
const PART={regret_m:'нежелательная текучесть месячная',hc_avg:'среднесписочная численность',pf_plan:'план найма',hire_jun:'принятые джуны',
  rev_eval:'оценённые в цикле ревью',rev_up:'улучшившие оценку',ovis:'посещения офиса',
  wday:'отработанные человеко-дни',plow:'оценка «низкая»',prated:'оценённые',regret_cnt:'нежелательные увольнения'};
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
     m.better==='flat'?'Ориентира нет: «больше» здесь не значит «лучше»':'Ориентира нет: абсолютная величина зависит от размера команды';
  return h+'<div class="op-frs">'+esc(ref)+'.</div>';
}
/* Пояснение к «Что видно в данных»: какие пороги и что не оценивается. */
function obsInfo(S){
  const O=window.TPINSIGHTS.OBS;
  return '<span class="info"'+U.tipAttr({title:'Что видно в данных',
    text:'Главное по отбору целиком: где метрика заметно хуже или лучше ориентира, заметно изменилась к прошлому году или ухудшается подряд, всплески уходов и сдвиг численности.',
    note:'В список попадает отклонение от '+Math.round(O.dev*100)+'% ориентира (цель KPI, иначе база «'+D.benchmarkLabel(S)+
      '»), тренд — от '+O.trend+' месяцев подряд. Численность, найм и переводы светофором не оцениваются.'})+' aria-label="Как отобраны факты">i</span>';
}

/* Метка у имени блока: весь блок без источника — «в разработке · этап N»,
   часть вкладок — «частично в разработке». */
function blockDevTag(bk){
  const st=SC.blockDev(bk);
  if(!st)return '';
  if(st==='part')return '<span class="dev-tag"'+U.tipAttr({title:'Частично в разработке',
    text:'Часть вкладок блока — заглушка: источника данных пока нет. Какие именно — отмечено в степпере блока.'})+'>частично в разраб.</span>';
  const d=(SC.blocks[bk].subTabs||[]).map(t=>SC.devOf(bk,t[0])).find(Boolean);
  return U.devTag(d?d.stage:null);
}

/* ---------- рендер ---------- */
function render(S,openRows){
  const rl=D.reportLeaves(S), bl=D.benchmarkLeaves(S);
  if(!rl.length)return U.empty('Нет данных по выбранным разрезам',
    'В этом подразделении нет команд, подходящих под текущие фильтры. Снимите один из разрезов в шапке.');

  let h='<div class="page-h"><h2>Сводка по всем метрикам</h2>'+
    '<p>Все ключевые метрики команды на одном экране: значение, изменение '+esc(D.CMP.momFull)+
    ' и '+esc(D.CMP.yoy)+', динамика и сравнение с базой <b>'+esc(D.benchmarkLabel(S))+
    '</b>; там, где есть утверждённый KPI, метрика сравнивается с целью, а не с базой. '+
    'Нажмите на строку — откроется график «год к году» и разбор по пунктам.</p></div>';

  /* «Что видно в данных» сразу под заголовком (HRBP HUB, 13.10): сначала
     вывод, потом цифры. Раньше здесь была AI-подсказка «Как читать эту
     сводку» — её пороги и оговорки переехали в ⓘ панели. */
  h+=U.obsPanel(window.TPINSIGHTS.overview(S,rl,bl),S.aiOpen==='op',obsInfo(S));

  /* Готовность к живым данным (14.10): сколько метрик уже считается из
     источника и что подключать дальше — одной строкой, план раскрывается. */
  const live=D.METRICS.filter(m=>!D.isDev(m.key)).length;
  if(live<D.METRICS.length)h+=U.devSummary({live,total:D.METRICS.length,plan:D.DEV_PLAN});

  /* Пульс команды: счёт сигналов и главные сдвиги за год — до таблиц,
     чтобы первые пять секунд на экране отвечали «что изменилось». */
  h+=U.pulseStrip(pulse(S,rl,bl));

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
      '<th class="mid">Сравнение'+thSub('база или цель KPI')+'</th>'+
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

SC.onepager={render,HERO};
})();

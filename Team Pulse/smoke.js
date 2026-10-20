/* ============================================================================
   Смоук-тест без браузера: node smoke.js

   Прогоняет render() по всем вкладкам и под-вкладкам на минимальном DOM-стабе.
   Ловит падения, пустые экраны и нарушения правил визуализации.

   Экраны собирают разметку строками, а draw.js рисует SVG тоже строкой, поэтому
   тест проходит по всему рисовальному коду по-настоящему — без браузера и без
   заглушек графической библиотеки.
   ========================================================================== */
const fs=require('fs'), path=require('path'), dir=__dirname;

/* ---------- минимальный DOM ---------- */
function El(){return{innerHTML:'',textContent:'',style:{},dataset:{},tabIndex:0,
  offsetWidth:200,offsetHeight:100,clientWidth:0,
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  setAttribute(){},getAttribute(){return null},removeAttribute(){},remove(){},appendChild(){},
  addEventListener(){},closest(){return null},matches(){return false},click(){},
  querySelectorAll(){return[]},querySelector(){return null},
  getBoundingClientRect(){return{left:0,top:0,bottom:0,right:0,width:100,height:20}}}}
/* один и тот же селектор должен отдавать один и тот же узел, иначе innerHTML теряется */
const NODES=new Map();
const pick=k=>{if(!NODES.has(k))NODES.set(k,El());return NODES.get(k)};
const doc={querySelector:pick,querySelectorAll(){return[]},getElementById:k=>pick('#'+k),
  addEventListener(){},createElement(){return El()},body:{appendChild(){}}};
global.window={addEventListener(){},scrollTo(){},innerWidth:1440,innerHeight:900};
global.document=doc;
global.location={search:'',origin:'http://localhost',pathname:'/'};
global.history={replaceState(){}};
global.navigator={};global.innerWidth=1440;global.innerHeight=900;
global.setTimeout=global.setTimeout;global.clearTimeout=global.clearTimeout;
global.localStorage={getItem(){return'1'},setItem(){}};

/* порядок как в index.html */
['data.js','draw.js','ui.js','insights.js','story.js',
 'screens/_block.js','screens/structure.js','screens/movement.js','screens/turnover.js',
 'screens/hiring.js','screens/tgrowth.js','screens/monitor.js','screens/office.js','screens/ai.js',
 'screens/onepager.js'].forEach(f=>require(path.join(dir,f)));

/* app.js держит state в замыкании — добавляем экспорт-хвост во временную копию */
const probe=path.join(dir,'.app.probe.js');
fs.writeFileSync(probe,fs.readFileSync(path.join(dir,'app.js'),'utf8')+
  '\nmodule.exports={go:(t,sub)=>{S.tab=t;S.subTab=sub||null;S.selNode=null;render();return $("#view").innerHTML},'+
  /* one-pager с раскрытыми строками: каретка и график живут именно в них */
  '\n  op:list=>{S.tab="onepager";openRows.clear();(list||[]).forEach(k=>openRows.add(k));render();return $("#view").innerHTML},'+
  '\n  hide:list=>{S.hiddenMetrics=list.slice();S.mainMetric=null},'+
  /* каретка ИТОГО живёт в app.js, а не в разметке: дёргаем её обработчик напрямую */
  '\n  expAll:()=>{expanded.clear();SC.expandableRows(SC.currentRoot(S)).forEach(p=>expanded.add(p));'+
  'render(true);return $("#view").innerHTML},'+
  '\n  expClear:()=>{expanded.clear()},'+
  /* итерация 29: выбор строки, переход в юнит, стек «Назад», путь, поиск */
  '\n  sel:p=>{S.selNode=p;render(true);return $("#view").innerHTML},'+
  '\n  unit:p=>{goUnit(p);return S.unit},'+
  '\n  back:()=>{const p=unitBack.pop();if(p)goUnit(p,true);return S.unit},'+
  '\n  stack:()=>unitBack.slice(),'+
  '\n  search:q=>{tq=q;render(true,true);return $("#view").innerHTML},'+
  '\n  crumbs:()=>{renderHead();return $("#crumbs").innerHTML},'+
  '\n  setupHc:()=>{openSetup();const h=$("#optHc").innerHTML+$("#benchPreview").innerHTML;closeSetup();return h},'+
  '\n  setupUnits:q=>{openSetup();if(q){UT.q=q;utRender()}const h=$("#utList").innerHTML+$("#benchPreview").innerHTML+$("#optStaff").innerHTML;closeSetup();return h},'+
  '\n  home:()=>{S.unit=D.DEFAULT_STATE.unit;unitBack.length=0;tq="";S.selNode=null;expanded.clear()},'+
  /* итерация 30: ширина колонок — режим и доля таблицы */
  '\n  split:(m,sh)=>{splitMode=m;splitShare=sh;render(true);return $("#view").innerHTML},'+
  /* срез состава живёт в S, но кликом его ставит обработчик — зовём его напрямую */
  '\n  mix:list=>{S.mixSel=(list||[]).slice()},'+
  '\n  mixClick:spec=>{toggleMix(spec);return S.mixSel.slice()},'+
  '\n  mixOpen:list=>{mixOpen.clear();(list||[]).forEach(k=>mixOpen.add(k));render();return $("#view").innerHTML},'+
  '\n  link:()=>shareLink(),'+
  '\n  tab:()=>S.tab, nav:()=>$("#navBlocks").innerHTML, st:()=>S,'+
  '\n  chips:()=>{renderHead();return $("#chips").innerHTML}};');
const A=require(probe);
fs.unlinkSync(probe);

/* под-вкладки берём из самих экранов, чтобы список не расходился с кодом */
const SC=window.TPSCREENS;
const CASES=[['onepager',null]];
Object.keys(SC.blocks).forEach(k=>{
  SC.blocks[k].subTabs.forEach(([sub])=>CASES.push([k,sub]));
});

let bad=0, warn=0, allHtml='';
CASES.forEach(([t,s])=>{
  const name=(t+' / '+(s||'—')).padEnd(24);
  try{
    const html=A.go(t,s);
    allHtml+=html;
    if(html.length<400){bad++;console.log(name,'ПУСТО');return}

    /* графики, а не все теги svg: иконки интерфейса тоже рисуются в svg */
    const svgs=(html.match(/class="svgchart/g)||[]).length;
    const tables=(html.match(/<table/g)||[]).length;
    const total=t==='onepager'?'н/п':(/<tr class="total top"/.test(html)?'да':'НЕТ');
    const nocmp=(html.match(/не сравнивается/g)||[]).length;

    /* правила визуализации, которые тест обязан ловить */
    const notes=[];
    if(/<svg[^>]*>(?![\s\S]*?<\/svg>)/.test(html)&&svgs!==(html.match(/<\/svg>/g)||[]).length)notes.push('НЕЗАКРЫТЫЙ SVG');
    if(/echarts/i.test(html))notes.push('ОСТАЛСЯ ECHARTS');
    if(notes.length){warn++;}

    console.log(name,'html',String(html.length).padStart(6),
      '| svg',String(svgs).padStart(2),'| таблиц',String(tables).padStart(2),
      '| ИТОГО сверху:',total,'| «не сравнивается»:',String(nocmp).padStart(2),
      notes.length?('| '+notes.join(', ')):'');
  }catch(e){bad++;console.log(name,'ОШИБКА:',e.message)}
});

/* ---------- проверки правил, общие для всего отчёта ---------- */
console.log();
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI;
const rl=D.reportLeaves(D.DEFAULT_STATE);
const checks=[];

/* 1. ось значений всегда от нуля. С 13.10 вся динамика — год к году:
   проверяем полотно года — этот год (закрытые месяцы) и прошлый целиком */
const uwY=D.yoySeries(rl,'underwork');
const svgUW=G.chart('yoy',{metricKey:'underwork',cur:uwY.cur,prev:uwY.prev},{h:280});
/* у точек есть class="dot" ПЕРЕД cx, и старый регекс `<circle cx=` не ловил ничего:
   массив был пуст, и обе проверки оси проходили вакуумно. Ищем cy где бы он ни стоял. */
const ys=[...svgUW.matchAll(/<circle[^>]*\scy="([\d.]+)"/g)].map(m=>+m[1]);
checks.push(['проверка оси видит точки: этот год по закрытым месяцам и прошлый целиком',ys.length===D.CUR_LEN+12]);
const zeroLine=[...svgUW.matchAll(/<line x1="[\d.]+" y1="([\d.]+)"[^>]*stroke="#c9cdd6"/g)].map(m=>+m[1])[0];
checks.push(['ось от нуля: все точки выше базовой линии',ys.every(y=>y<zeroLine)]);
checks.push(['ось от нуля: диапазон 6,1–6,9% не растянут на всю высоту',
  (Math.max(...ys)-Math.min(...ys))<(zeroLine*0.5)]);

/* 2. ось Y не рисуется */
checks.push(['ось Y отсутствует',!/axisY|tick-y/.test(svgUW)]);

/* 3. накопительная текучесть обнуляется в январе */
const ty=D.aggregate(rl,'turnover_y'), tm=D.aggregate(rl,'turnover_m');
const jan=D.MONTHS.findIndex(m=>m.isYearStart);
checks.push(['накопительная текучесть обнуляется в январе',Math.abs(ty[jan]-tm[jan])<0.01]);
checks.push(['накопительная растёт внутри года',ty[jan+1]>ty[jan]&&ty[D.LAST]>ty[jan]]);

/* 4. текучесть = отток / среднесписочная */
const att=D.aggregate(rl,'attrition'), avg=D.aggregate(rl,'hc_avg');
checks.push(['текучесть = отток / среднесписочная × 100',
  Math.abs(tm[D.LAST]-att[D.LAST]/avg[D.LAST]*100)<0.02]);

/* 5. разбивки — таблицы, а не графики */
const brk=SC.blocks.structure.view({S:D.DEFAULT_STATE,sub:'qual',lp:rl,bl:rl});
checks.push(['разбивки по атрибутам — таблица',/<table/.test(brk)&&!/<svg/.test(brk)]);
const rsn=SC.blocks.turnover.view({S:D.DEFAULT_STATE,sub:'reasons',lp:rl,bl:rl});
checks.push(['причины увольнений — таблица',/<table/.test(rsn)&&!/<svg/.test(rsn)]);

/* 6. пара потоков (найм / отток) — год к году линиями (13.10, второй заход):
   две яркие линии этого года, бледные — прошлого; баров и серой «тени» нет.
   Ряды синтетические: у каждой линии точка на каждый закрытый месяц. */
const yr=(a,b)=>({cur:D.MONTH_ABBR.map((_,i)=>i<D.CUR_LEN?a+i%3:null),prev:D.MONTH_ABBR.map((_,i)=>b+i%4)});
/* 14.10: пара — «ежики»: приход барами вверх, уход вниз; линий нет («четыре линии на
   одном графике — жесть»); 15.10: прошлый год — прозрачные бары позади, без засечек */
const dv=G.chart('pair',{a:Object.assign({key:'hire'},yr(4,5)),b:Object.assign({key:'attrition'},yr(2,3))},
  {h:300,legend:[{name:'Приняли',color:G.C_IN},{name:'Уволились',color:G.C_OUT},{name:'2026'},{name:'2025',ghost:true}]});
const barsOf=(cls,sid)=>(dv.match(new RegExp('class="bar '+cls+'" data-s="'+sid+'"','g'))||[]).length;
checks.push(['пара потоков — «ежики»: бары вверх и вниз, прошлый год прозрачными барами позади, без линий и засечек',
  barsOf('up','a')===D.CUR_LEN&&barsOf('dn','b')===D.CUR_LEN&&(dv.match(/class="bar (up|dn) ghost"[^>]*data-s="prev"/g)||[]).length===24&&
  !/class="tick"/.test(dv)&&
  !/class="ln/.test(dv)&&/data-sid="a"/.test(dv)&&/data-sid="cur"/.test(dv)&&/data-sid="prev"/.test(dv)]);

/* 7. цифры на графиках чёрные: за смысл отвечает цвет бара, а не подписи */
const LOUD=/fill="#(f51f1f|12b048|d11414|0a8f3c)"/;
checks.push(['подписи значений не красятся светофором',!LOUD.test(dv)&&!LOUD.test(svgUW)]);

/* 8. стандартных title-тултипов в отчёте больше нет — только наши data-tip */
checks.push(['ни одного стандартного title=',!/\stitle="/.test(allHtml)]);
checks.push(['кастомные тултипы есть на каждом экране',
  (allHtml.match(/data-tip="/g)||[]).length>200]);

/* 9. светофор: два цвета плюс серый, жёлтого нет нигде */
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8').replace(/\s+/g,'');
const appSrc=fs.readFileSync(path.join(dir,'app.js'),'utf8');
checks.push(['в светофоре нет жёлтого: stateColor(warn) серый',
  G.stateColor('warn')===G.C_FLAT&&G.stateColor('good')!==G.C_FLAT]);
checks.push(['жёлтого нет в графиках и легендах отчёта',
  !/#dbb968/i.test(allHtml)&&!/#ffe6a0/i.test(allHtml)&&!/#f59300/i.test(allHtml)]);
checks.push(['пилюли и рамки «на уровне» не красятся жёлтым токеном',
  !/\.sig-chip\.warn\{[^}]*--warn/.test(css)&&!/\.cell\.warn\{[^}]*--warn/.test(css)&&
  !/\.m-name\.bar-warn\{[^}]*--warn/.test(css)&&!/\.kpi-tag\{[^}]*--warn/.test(css)]);

/* высота рабочей зоны считается от экрана — иначе верхние блоки не прокрутить */
checks.push(['высота .split привязана к высоте экрана',
  css.includes('.split{height:clamp(520px,calc(100vh-var(--head-h)-28px)')]);

/* 9б. изменения показываются знаком, а не стрелкой; пустого состояния фильтров нет */
/* у пилюли изменения теперь есть свои атрибуты (подсказка «июнь против мая»),
   поэтому знак ищем не сразу за классом, а за концом открывающего тега */
checks.push(['дельты без стрелок: только + и −',
  !/<span class="delta[^>]*>[^<]*[↑↓→]/.test(allHtml)&&
  /<span class="delta[^>]*>\+/.test(allHtml)]);
checks.push(['нулевое изменение — просто ноль',
  U.deltaChip('hire',0).replace(/<[^>]+>/g,'')==='0']);
/* у turnover_m рост плохой, у vac_closed — хороший, у hire (better:flat) без оценки */
checks.push(['знак говорит направление, класс — оценку',
  /delta down/.test(U.deltaChip('turnover_m',1.4))&&/delta up/.test(U.deltaChip('turnover_m',-1.4))&&
  /delta up/.test(U.deltaChip('vac_closed',3))&&/delta neu/.test(U.deltaChip('hire',3))]);
checks.push(['переход на детальный дашборд — иконка, а не символ ↗',
  /class="ico-ext"/.test(allHtml)&&!/↗/.test(allHtml)]);
checks.push(['минус во всех дельтах типографский, а не дефис',
  !/>\s*-\d/.test(allHtml)&&/−/.test(D.fmtDelta('hire',-3))&&/−/.test(D.fmtDelta('turnover_m',-1.4))]);

/* ---- итерация 23: с чем сравнивается изменение и с чем — сама метрика ---- */

/* «+3» без подписи читалось как отклонение от базы. Месяц сравнения стоит
   в пилюле KPI-карточек и в шапках колонок one-pager. */
(function(){
  const opHtml=A.go('onepager',null), mvHtml=A.go('movement','balance');
  checks.push(['в карточке KPI подписан месяц, с которым сравнивается изменение',
    /<span class="d-vs">к маю<\/span>/.test(opHtml)&&/<span class="d-vs">к маю<\/span>/.test(mvHtml)]);
  checks.push(['подпись месяца берётся из одного места, а не пишется руками',
    D.CMP.momShort==='к '+'маю'&&D.CMP.momFull==='к маю 2026'&&D.CMP.yoy==='к июню 2025']);
  checks.push(['шапки колонок «за месяц» и «за год» называют свои месяцы',
    opHtml.indexOf('За месяц<span class="th-sub">'+D.CMP.momFull)>0&&
    opHtml.indexOf('За год<span class="th-sub">'+D.CMP.yoy)>0]);
  /* в строках таблицы месяц не повторяется: он уже назван в шапке */
  checks.push(['в колонках таблицы месяц не дублируется у каждой строки',
    (opHtml.match(/class="d-vs"/g)||[]).length<=SC.onepager.HERO.length]);

  /* Строка one-pager раскрывает график — и об этом теперь говорит каретка */
  checks.push(['у строки one-pager есть каретка раскрытия справа',
    (opHtml.match(/<td class="col-caret"><span class="row-caret"/g)||[]).length>=15]);
  checks.push(['каретка раскрытой строки развёрнута вниз',
    /class="row-caret on"/.test(A.op(['regret']))&&
    /<td colspan="7">/.test(A.op(['regret']))]);

  /* Карточки KPI выравниваются по строкам: перенос заголовка в одной карточке
     не должен сдвигать цифры в ней относительно соседних. */
  /* у движения персонала карточек столько, сколько выбранных метрик блока:
     после итерации 28 их семь (замещение и найм на 100 человек) */
  const nMv=D.visibleMetricsOfBlock('movement',A.st()).length;
  checks.push(['карточка KPI всегда из пяти строк: две строки сравнения плюс «год назад»',
    (function(){
      const cards=mvHtml.match(/<div class="kpi">[\s\S]*?<\/div><\/div>/g)||[];
      return cards.length===nMv&&cards.every(c=>(c.match(/<div class="k-row">/g)||[]).length===2)&&
        (mvHtml.match(/<div class="k-row k-yoy">/g)||[]).length===nMv;
    })()]);
  checks.push(['полоса KPI выровнена subgrid, а не надеждой на короткие заголовки',
    /\.kpi\{display:grid;grid-template-rows:subgrid;grid-row:span5;row-gap:0\}/.test(css)&&
    /@supports\(grid-template-rows:subgrid\)/.test(css)]);
  checks.push(['метрики движения персонала стоят своим числом колонок',
    nMv===5&&new RegExp('class="kpis compact n'+nMv+'"').test(mvHtml)&&
    new RegExp('\\.kpis\\.n'+nMv+'\\{grid-template-columns:repeat\\('+nMv).test(css)]);
})();

/* Есть утверждённый KPI — сравниваемся с ним, и базы рядом нет: два ориентира
   заставляли выбирать, по какому судить. */
(function(){
  const S0=D.DEFAULT_STATE, rl0=D.reportLeaves(S0), bl0=D.benchmarkLeaves(S0);
  const kpi=D.kpiFor('regret',S0), v=D.lastVal(rl0,'regret');
  const cell=U.targetCell('regret',v,D.lastVal(bl0,'regret'),kpi);
  checks.push(['метрика с KPI сравнивается с целью, а не с базой',
    !!kpi&&/цель/.test(cell)&&!/база/.test(cell)]);
  const opHtml=A.go('onepager',null);
  /* сравнение ищем в видимом тексте карточки: слово «база» встречается ещё и
     внутри подсказки к пилюле изменения, и по нему проверять нельзя */
  const cards=opHtml.match(/<div class="kpi">[\s\S]*?<\/div><\/div>/g)||[];
  const card=cards.filter(c=>/Regrettable текучесть/.test(c))[0]||'';
  const subs=(card.match(/<span class="k-sub">[^<]*</g)||[]).join('|');
  checks.push(['в hero-карточке метрики с KPI стоит цель, а базы нет',
    /цель 4,0%/.test(subs)&&!/база/.test(subs)&&/kpi-tag/.test(card)]);
  /* на раскрытом графике та же развилка: пороги KPI вместо линии базы */
  const line=SC.metricLine('regret',rl0,bl0,S0,{});
  checks.push(['у метрики с KPI на графике пороги цели, а не линия базы',
    />цель 4,0%</.test(line)&&/>порог 7,0%</.test(line)&&!/class="lnb" data-s="bench"/.test(line)]);
  /* без KPI (regret вне HQ) поведение прежнее: линия базы на месте */
  const S1=Object.assign({},S0,{paint:'Line'});
  checks.push(['без KPI метрика возвращается к сравнению с базой',
    !D.kpiFor('regret',S1)&&/class="lnb" data-s="bench"/.test(SC.metricLine('regret',D.reportLeaves(S1),D.benchmarkLeaves(S1),S1,{}))]);
})();

/* Среднесписочная ушла из отчёта, но осталась знаменателем текучести;
   на её место в движении персонала встал прирост с начала года. В подсказках
   «как считается» (calc, методология HR) она упоминается — это не строка отчёта:
   ищем её только как текст элемента, не внутри data-tip. */
checks.push(['среднесписочной численности нет среди метрик отчёта',
  !D.METRIC_BY_KEY['hc_avg']&&!/>Среднесписочная/.test(allHtml)&&D.METRICS.length===27]);
/* 19.10: определения — по методологии HR из Data Detective: у численности, найма, оттока,
   переводов и текучести есть «как считается» (calc), он виден в «i» и в словаре «Пульс» */
checks.push(['метрики численности, движения и текучести описаны по методологии HR (calc в «i» и словаре)',
  ['hc_active','hc_total','hire','attrition','transfer_in','transfer_out','turnover_m','turnover_y','regret']
    .every(k=>D.METRIC_BY_KEY[k].calc&&U.infoDot(k).includes(U.esc(G.tipHtml({text:D.METRIC_BY_KEY[k].calc})).slice(0,40)))&&
  /стажёров в штат/.test(D.METRIC_BY_KEY.hire.calc)&&/полусумма активной/.test(D.METRIC_BY_KEY.turnover_m.calc)]);
checks.push(['ряд hc_avg жив: текучесть по-прежнему считается',
  D.aggregate(rl,'hc_avg')[D.LAST]>0]);
(function(){
  const hc=D.aggregate(rl,'hc_total'), ny=D.aggregate(rl,'net_ytd');
  /* декабрь предыдущего года — точка перед январём окна */
  const jan=D.MONTHS.findIndex(m=>m.isYearStart);
  checks.push(['прирост с начала года = численность минус её значение на 31 декабря',
    Math.abs(ny[D.LAST]-(hc[D.LAST]-hc[jan-1]))<0.01&&ny[jan]===+(hc[jan]-hc[jan-1]).toFixed(1)]);
  checks.push(['прирост стоит в движении персонала и с базой не сравнивается',
    D.METRIC_BY_KEY['net_ytd'].block==='movement'&&!D.comparable('net_ytd')]);
})();
(function(){
  const st=A.st(), keep=[st.paint,st.itSeg,st.staffType];
  st.paint='all';st.itSeg='all';st.staffType='all';
  const empty=A.chips();
  st.paint=keep[0];st.itSeg=keep[1];st.staffType=keep[2];
  const withChip=A.chips();
  checks.push(['без разрезов плашка «Разрезы не выбраны» не рисуется',
    !/Разрезы не выбраны/.test(empty)&&!/chip empty/.test(empty)]);
  checks.push(['чипы базы сравнения остаются всегда',
    /chip bench/.test(empty)&&/chip bench/.test(withChip)]);
})();

/* 10. перекомпоновка под-вкладок: что где лежит после итерации 20 */
const subsOf=k=>SC.blocks[k].subTabs.map(t=>t[0]).join(',');
/* 14.10: первым — «Портрет команды», «Оформление» и «География» — одна глава */
/* 15.10: четыре главы — два обзора, стримы таблицей и конструктор («вкладок перебор») */
checks.push(['состав: два обзора, стримы таблицей и конструктор',
  subsOf('structure')==='portrait,work,stream,custom'&&SC.blocks.structure.defaultSub==='portrait']);
/* итерация 28 (бизнес-анализ): план-факт и профиль найма, заявки и статусы
   роста, бронирование и «кто ходит» встали своими вкладками; срок закрытия
   по-прежнему панелью к вакансиям, конверсия T-роста — рядом с решениями */
checks.push(['срок закрытия не отдельная вкладка, план-факт и профиль найма — свои; воронки нет (15.10)',
  subsOf('hiring')==='vacancies,plan,profile']);
checks.push(['T-рост: конверсия с решениями на одной вкладке, заявки и статусы — на своих',
  subsOf('tgrowth')==='flow,requests,statuses']);
checks.push(['офис — календарь, города, кто ходит, бронирование, динамика',
  subsOf('office')==='calendar,offices,people,booking,dynamics']);
checks.push(['AI — проникновение, инструменты и стримы',subsOf('ai')==='adoption,tools']);
/* неизвестная под-вкладка из старой ссылки не должна ломать экран */
checks.push(['неизвестная под-вкладка откатывается на дефолтную',
  A.go('hiring','speed').length>400&&A.go('tgrowth','conv').length>400]);

const balHtml=A.go('movement','balance'), flowHtml=A.go('movement','dynamics');
/* считаем графики, а не теги <svg>: иконка перехода на детальный дашборд — тоже svg */
const svgN=s=>(s.match(/class="svgchart/g)||[]).length;
/* итерация 32 (фидбэк 12.10): обзор — водопад и «что нужно знать»; вся
   динамика — численность, найм и отток, переводы — на одном листе */
checks.push(['движение: обзор и динамика, «Замещение и темпы» снята',subsOf('movement')==='balance,dynamics']);
checks.push(['обзор движения: водопад и «что нужно знать» под ним',
  svgN(balHtml)===1&&/Из чего сложилось изменение/.test(balHtml)&&/<div class="st-ins">/.test(balHtml)]);
checks.push(['динамика движения: численность, найм и отток, переводы на одном листе',
  svgN(flowHtml)===3&&/Численность, чел/.test(flowHtml)&&/Найм и отток, чел/.test(flowHtml)&&
  /Переводы внутри компании, чел/.test(flowHtml)]);
checks.push(['вакансии: три панели, включая срок закрытия',
  /Срок закрытия вакансии, дн/.test(A.go('hiring','vacancies'))]);
checks.push(['T-рост: конверсия и её составляющие вместе',
  svgN(A.go('tgrowth','flow'))===2]);

/* 11. офисы: календарь, дни недели таблицей, рейтинг, честная сноска */
const calHtml=A.go('office','calendar');
const calDays=D.attDays(D.reportLeaves(D.DEFAULT_STATE));
const wdMean=(a=>+(a.reduce((s,x)=>s+x.val,0)/a.length).toFixed(1))(calDays.days.filter(d=>!d.weekend));
checks.push(['календарь: 7 колонок дней недели и ячейка на каждый день месяца',
  D.DOW_SHORT.every(d=>calHtml.indexOf('>'+d+'<')>0)&&
  (calHtml.match(/class="barg"/g)||[]).length>=calDays.days.length]);
checks.push(['календарь сходится с метрикой: среднее по будням = office_att',
  Math.abs(wdMean-calDays.base)<0.15]);
checks.push(['календарь не красится светофором',
  !/#80cf9a|#ef8c8c|#dbb968/i.test(G.chart('calendar',{cal:calDays},{h:340}))]);
checks.push(['дни недели — таблица, а не бар-чарт',
  /День недели/.test(calHtml)&&/Воскресенье/.test(calHtml)]);

/* Календарь показывает скользящее окно, а не календарный месяц: второго числа
   «текущий месяц» — это два дня и ноль смысла. Окно пересекает границу месяцев,
   поэтому блоков может быть два, и рисуются они сетками рядом. */
(function(){
  const lp=D.reportLeaves(D.DEFAULT_STATE);
  const blocks=D.attLast(lp);
  checks.push(['календарь показывает последние '+D.CAL_MONTHS+' месяца, а не один',
    blocks.length===D.CAL_MONTHS]);
  /* Ключевое правило раскладки: обрезается ТОЛЬКО текущий месяц и только справа.
     Прошлый месяц обязан быть полным — иначе его статистика теряется, а «кусок
     мая» рядом с «куском июня» не с чем сравнивать. */
  checks.push(['прошлый месяц показан целиком, обрезан только текущий',
    blocks.slice(0,-1).every(b=>b.full)&&
    (function(){
      const last=blocks[blocks.length-1];
      const monthDays=new Date(D.MONTHS[D.LAST].y,D.MONTHS[D.LAST].m+1,0).getDate();
      return last.m===D.MONTHS[D.LAST].m&&last.to===Math.min(D.CAL_TODAY,monthDays);
    })()]);
  checks.push(['дни в блоке идут подряд с первого числа',
    blocks.every(b=>b.from===1&&b.days.length===b.to&&b.days[0].day===1)]);
  checks.push(['на экране офиса обе сетки подписаны своим месяцем',
    blocks.every(b=>calHtml.indexOf('>'+b.label+' '+b.y+'<')>0)]);
  /* сетка обязана начинаться с той колонки, где 1-е число реально стоит в неделе */
  checks.push(['сетка блока стартует с дня недели 1-го числа',
    blocks.every(b=>b.first===b.days[0].dow)]);
  /* клетка квадратная: вытянутый прямоугольник читается как таблица,
     а месяцы разной длины рядом получали бы клетки разной формы */
  checks.push(['клетка календаря квадратная',
    (function(){
      const h=G.chart('calendar',{blocks:blocks},{h:520});
      const c=[...h.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"/g)]
        .map(m=>({w:+m[1],h:+m[2]})).filter(r=>r.w>20);
      return c.length>0&&c.every(r=>Math.abs(r.w-r.h)<0.01);
    })()]);

  /* двухмесячное окно: две сетки рядом, 14 колонок, обе подписаны месяцем */
  const feb=D.attDays(lp,7), mar=D.attDays(lp,8);
  const two=[{y:feb.y,m:feb.m,label:feb.label,base:feb.base,from:22,to:feb.days.length,full:false,
              first:feb.days[21].dow,days:feb.days.filter(d=>d.day>=22)},
             {y:mar.y,m:mar.m,label:mar.label,base:mar.base,from:1,to:23,full:false,
              first:mar.days[0].dow,days:mar.days.filter(d=>d.day<=23)}];
  const h2=G.chart('calendar',{blocks:two},{h:400});
  const cells2=[...h2.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)]
    .map(m=>({x:+m[1],w:+m[2]})).filter(r=>r.w>20);
  const cols=[...new Set(cells2.map(c=>Math.round(c.x)))].length;
  checks.push(['окно через границу месяцев рисуется двумя сетками рядом',
    cols===14&&cells2.length===two[0].days.length+two[1].days.length]);
  checks.push(['у каждой сетки своя подпись месяца',
    h2.indexOf('>'+feb.label+' '+feb.y+'<')>0&&h2.indexOf('>'+mar.label+' '+mar.y+'<')>0]);
  /* Шкала одна на оба месяца: свой максимум в каждом красил бы одинаковый
     процент по-разному слева и справа, и месяцы стало бы нельзя сравнить. */
  const wd=two.reduce((a,b)=>a.concat(b.days.filter(d=>!d.weekend).map(d=>d.val)),[]);
  checks.push(['шкала интенсивности одна на оба месяца',
    h2.indexOf('чаще, до '+G.niceMax(wd).toFixed(1).replace('.',','))>0]);

  /* Клетка стала тесной — значение уходит в подсказку, заливка остаётся.
     Лучше честный хитмап, чем налезающие друг на друга цифры. */
  const many=[two[0],two[1],two[0],two[1]];
  const h4=G.chart('calendar',{blocks:many},{h:400});
  const vals=(h4.match(/font-weight="700" text-anchor="middle" class="fade"[^>]*>\d/g)||[]).length;
  checks.push(['при тесной клетке значение уходит в подсказку, а заливка остаётся',
    vals===0&&/class="barg"/.test(h4)&&/Посещаемость/.test(h4)]);
})();
/* 15.10, редполитика: что цифры условные, говорит плашка «в разработке», а не сноска с кухней макета */
checks.push(['условные данные помечены плашкой «в разработке»',
  /class="dev-note/.test(calHtml)&&/class="dev-note/.test(A.go('office','offices'))]);
const cities=D.officeByCity(D.reportLeaves(D.DEFAULT_STATE)), offHtml=A.go('office','offices');
checks.push(['города: сумма людей = численность отбора, сортировка по посещаемости',
  cities.reduce((a,o)=>a+o.hc,0)===D.lastVal(D.reportLeaves(D.DEFAULT_STATE),'hc_total')&&
  cities.every((o,i)=>!i||cities[i-1].att>=o.att)]);
checks.push(['рейтинга офисов нет (15.10), в таблице городов нет колонки «Доля»',
  !/Сравнение офисов/.test(offHtml)&&/Сравнение городов/.test(offHtml)&&!/<th>Доля<\/th>/.test(offHtml)]);

/* 12. выбор метрик пользователем: отключённое не должно попадать ни в строки
   one-pager, ни в столбцы сводной таблицы, ни в KPI-карточки */
A.hide(['transfer_in','transfer_out']);
const opHid=A.go('onepager',null), mvHid=A.go('movement','balance');
checks.push(['скрытая метрика не попала в строки one-pager',
  !/Переводы в команду/.test(opHid)&&/Найм/.test(opHid)]);
checks.push(['скрытая метрика не попала в столбцы сводной таблицы',
  !/Перев\. в/.test(mvHid)&&!/Переводы в команду/.test(mvHid)&&/Отток/.test(mvHid)]);

/* 20.10: тип численности. По умолчанию весь отчёт — на активной; «Вся» — все, кто числится.
   В макете «Активная» пересчитывает численность и потоки в доле активной, производные — от них */
(function(){
  const st=A.st(), rl0=D.reportLeaves(D.DEFAULT_STATE);
  D.setHcMode('all');
  const tAll=D.lastVal(rl0,'hc_total'), aAll=D.lastVal(rl0,'hc_active');
  const hAll=D.aggregate(rl0,'hire').reduce((x,y)=>x+y,0), fAll=D.aggregate(rl0,'attrition').reduce((x,y)=>x+y,0);
  D.setHcMode('active');
  const tAct=D.lastVal(rl0,'hc_total'), hAct=D.aggregate(rl0,'hire').reduce((x,y)=>x+y,0);
  const fAct=D.aggregate(rl0,'attrition').reduce((x,y)=>x+y,0), avg=D.aggregate(rl0,'hc_avg'), tm=D.lastVal(rl0,'turnover_m');
  const setupHc=A.setupHc(), chipsAct=A.chips();
  st.hcType='all';
  const opAll=A.go('onepager',null), chipsAll=A.chips(), linkAll=A.link();
  st.hcType='active';
  const opAct=A.go('onepager',null);
  checks.push(['тип численности: по умолчанию активная, «Вся» — все; потоки, ССЧ и текучесть — по выбранному типу',
    D.DEFAULT_STATE.hcType==='active'&&st.hcType==='active'&&tAct===aAll&&tAct<tAll&&hAct<=hAll&&fAct<=fAll&&
    Math.abs(avg[D.LAST]-(tAct+D.aggregate(rl0,'hc_total')[D.LAST-1])/2)<0.6&&tm>0]);
  checks.push(['тип численности в настройке, чипах и ссылке: «Численность: активная» по умолчанию, «вся численность» снимается крестиком',
    /data-f="hcType" data-v="active"/.test(setupHc)&&/class="opt on" data-f="hcType" data-v="active"/.test(setupHc)&&
    /Вся численность<span class="opt-n">/.test(setupHc)&&/Численность: <b>активная<\/b>/.test(chipsAct)&&
    /data-unchip="hcType"/.test(chipsAll)&&/вся численность/.test(chipsAll)&&!/Численность: <b>активная/.test(chipsAll)&&
    /hc=all/.test(linkAll)&&D.benchmarkLabel({paint:'all',itSeg:'all',staffType:'all',hcType:'all'})==='вся компания, вся численность']);
  checks.push(['на всей численности видны и «Численность», и «Активная численность», на активной — одна',
    /Активная численность/.test(opAll)&&!/Активная численность/.test(opAct)&&/Численность/.test(opAct)]);
})();

/* обязательные метрики численности не скрываются даже явным списком */
A.hide(['hc_active','hc_total']);
const opLock=A.go('onepager',null);
/* 20.10: на активной численности (по умолчанию) «Активная численность» = «Численность» и
   отдельно не показывается; на всей численности видны обе */
checks.push(['обязательные метрики численности не скрываются',
  /Численность/.test(opLock)&&!D.metricVisible('hc_active',{hiddenMetrics:[]})&&
  D.metricVisible('hc_active',{hiddenMetrics:['hc_active'],hcType:'all'})&&
  D.metricVisible('hc_total',{hiddenMetrics:['hc_total'],hcType:'all'})]);

/* блок без единой выбранной метрики уходит из навигации, из one-pager и не открывается */
A.hide(D.metricsOfBlock('tgrowth').map(m=>m.key));
const opNoTg=A.go('onepager',null);
A.go('tgrowth','flow');
/* план подключения в сводке готовности называет этапы, в том числе T-рост, — его не считаем */
checks.push(['пустой блок исчез из one-pager',!/id="op-tgrowth"/.test(opNoTg)&&
  !/T-рост/.test(opNoTg.replace(/<details class="dev-sum"[\s\S]*?<\/details>/,''))]);
checks.push(['пустой блок исчез из навигации',!/T-рост/.test(A.nav())]);
checks.push(['вкладка пустого блока уводит на one-pager',A.tab()==='onepager']);

/* полный прогон всех экранов на урезанном наборе метрик */
A.hide(D.hiddenForPreset('min'));
let hidBad=0;
CASES.forEach(([t,s])=>{
  if(t!=='onepager'&&!D.blockVisible(t,{hiddenMetrics:D.hiddenForPreset('min')}))return;
  try{if(A.go(t,s).length<400)hidBad++}catch(e){hidBad++}
});
checks.push(['все экраны собираются на пресете «Минимум»',hidBad===0]);
A.hide([]);

/* 13. итерация 22: подсказки конструктором, halo, серии и легенды, токены ---- */

checks.push(['подсказки собраны конструктором, а не склейкой тегов',
  (allHtml.match(/t-h/g)||[]).length>100&&(allHtml.match(/t-r/g)||[]).length>100&&
  (allHtml.match(/t-v/g)||[]).length>100&&!/&amp;lt;b/.test(allHtml)]);
checks.push(['подписи значений на графиках имеют halo',
  (allHtml.match(/stroke-width="3\.2"/g)||[]).length>50]);

/* Кегль в подсказке не кодирует порядок строки. Раньше класс `pri` вешался
   на первую строку по счёту, и в дивергенте «Приняли» выходило крупнее
   «Уволились» — просто потому что найм стоит первым в массиве. */
(function(){
  const lp=D.reportLeaves(D.DEFAULT_STATE), bl=D.benchmarkLeaves(D.DEFAULT_STATE);
  const tipsOf=h=>[...h.matchAll(/data-tip="([^"]*)"/g)].map(m=>m[1]);
  checks.push(['в подсказке все значения одного кегля: класса pri больше нет',
    !/t-r pri|class="t-r pri/.test(allHtml)&&!/\.t-r\.pri/.test(css)]);
  /* база отличается цветом, а не размером: класс вешается по пунктирному
     маркеру, тому же, что в легенде графика */
  const ty=D.yoySeries(lp,'turnover_m');
  const line=G.chart('yoy',{metricKey:'turnover_m',cur:ty.cur,prev:ty.prev,
    bench:D.yoySeries(bl,'turnover_m').cur},{benchName:'база'});
  const lt=tipsOf(line)[0]||'';
  checks.push(['база в подсказке помечена как bench и красится серым',
    (lt.match(/t-r bench/g)||[]).length===1&&/\.tip\.t-r\.bench\.t-v\{color:var\(--muted\)/.test(css)]);
  /* пара потоков — две равнозначные метрики одного потока: ни одна не выделена */
  const dv=G.chart('pair',{a:Object.assign({key:'hire'},D.yoySeries(lp,'hire')),
    b:Object.assign({key:'attrition'},D.yoySeries(lp,'attrition'))},{});
  const dt=tipsOf(dv)[0]||'';
  /* январь: оба плеча за оба года — четыре равноправные строки */
  checks.push(['равнозначные метрики в подсказке не выделяются друг перед другом',
    (dt.match(/t-r bench/g)||[]).length===0&&(dt.match(/t-r&quot;/g)||[]).length===4]);
})();

/* Таблицы набраны ролями, которые шкала для них и заводила: тело — «основной
   текст таблиц», шапки — «шапки колонок». До этого тело шло кеглем СНОСОК
   (--fs-note), а шапки — служебных подписей (--fs-micro): главное содержимое
   отчёта было мельче, чем предписывает его собственная роль. */
checks.push(['тело сводной таблицы набрано ролью основного текста, а не сносок',
  /\.ptable\.dense\{font-size:var\(--fs-body\)\}/.test(css)&&
  !/\.ptable\.dense\{font-size:var\(--fs-note\)\}/.test(css)]);
checks.push(['шапки колонок набраны ролью шапок, а не служебных подписей',
  /\.ptable\.denseth\{padding:8px6px;font-size:var\(--fs-cap\)\}/.test(css)]);
checks.push(['таблицы слева и справа одного кегля',
  /\.split-r\.ptable\{font-size:var\(--fs-body\)\}/.test(css)]);
checks.push(['легенда рисуется группами .lg с data-sid',
  (allHtml.match(/class="lg[^"]*" data-sid="/g)||[]).length>5]);
checks.push(['марки графиков помечены data-s',
  (allHtml.match(/data-s="/g)||[]).length>200]);

/* легенда кликается: серия пропадает из графика и из шкалы, пункт помечен,
   последнюю серию выключить нельзя; у панелей — тоже (13.10: «легенды не
   интерактивные» — у панелей кнопок не было вовсе) */
(function(){
  const legend=[{name:'Приняли',color:G.C_IN},{name:'Уволились',color:G.C_OUT},{name:'2026'},{name:'2025',ghost:true}];
  const yr=(a,k)=>({cur:D.MONTH_ABBR.map((_,i)=>i<D.CUR_LEN?a+i%k:null),prev:D.MONTH_ABBR.map((_,i)=>a+1+i%k)});
  const html=G.chart('pair',{a:Object.assign({key:'hire'},yr(10,5)),b:Object.assign({key:'attrition'},yr(4,3))},
    {title:'Проверка пары',legend,h:320});
  const cid=(html.match(/data-cid="(\w+)"/)||[])[1];
  const el=pick('.svgchart[data-cid="'+cid+'"]'); el.clientWidth=900;
  G.toggleSeries(cid,'b');G.toggleSeries(cid,'prev');
  const h1=el.innerHTML;
  checks.push(['выключенный поток пары исчезает, выключенный прошлый год — его бары тоже',
    !/data-s="b"/.test(h1)&&/data-s="a"/.test(h1)&&!/ghost/.test(h1)]);
  /* выключили этот год — прошлый становится обычными барами */
  G.toggleSeries(cid,'prev');G.toggleSeries(cid,'cur');
  const hc=el.innerHTML;
  checks.push(['пара: без этого года прошлый — обычными барами; год и поток не выключить оба',
    /class="bar up" data-s="prev"/.test(hc)&&!/ghost/.test(hc)&&
    G.toggleSeries(cid,'prev')===false]);
  G.toggleSeries(cid,'cur');G.toggleSeries(cid,'prev');
  checks.push(['выключенный пункт легенды помечен, последнюю серию выключить нельзя',
    /class="lg dead" data-sid="b"/.test(h1)&&G.toggleSeries(cid,'a')===false]);
  G.toggleSeries(cid,'b');G.toggleSeries(cid,'prev');
  /* у пункта легенды подсказка, что он нажимается */
  checks.push(['у пункта легенды подсказка «клик — скрыть»',/data-sid="a"[^>]*data-tip="[^"]*Клик — скрыть/.test(el.innerHTML)]);
  const ph=SC.yoyPanels(D.reportLeaves(D.DEFAULT_STATE),[{key:'turnover_m',name:'Текучесть, %'},{key:'attrition',name:'Отток, чел'}]);
  const pc=(ph.match(/data-cid="(\w+)"/)||[])[1], pe=pick('.svgchart[data-cid="'+pc+'"]'); pe.clientWidth=900;
  const okT=G.toggleSeries(pc,'prev'), p1=pe.innerHTML;
  checks.push(['у панелей легенда «этот год / прошлый» кликается: прошлый год скрыт во всех панелях',
    okT&&(ph.match(/class="lg" data-sid="prev"/g)||[]).length===2&&(p1.match(/class="lg dead" data-sid="prev"/g)||[]).length===2&&
    !/data-s="prev"/.test(p1.replace(/<g class="lg[^>]*>/g,''))]);
  G.toggleSeries(pc,'prev');
})();

/* календарь: сетка и шкала интенсивности не липнут к левому краю */
(function(){
  const cal=D.attDays(D.reportLeaves(D.DEFAULT_STATE));
  const h=G.chart('calendar',{cal},{h:340});
  const xs=[...h.matchAll(/\sx="(-?[\d.]+)"/g)].map(m=>+m[1]);
  /* CAL_PAD=16, а не общий PAD_X=6: прижатая к краям плитка выглядит вставкой
     в панель, а не её содержимым. При двух месяцах сетка занимает всю ширину,
     и без собственного поля оно схлопнулось бы до 6px. */
  checks.push(['у календаря есть боковые поля',xs.length>0&&Math.min.apply(null,xs)>=16]);

  /* Клетка ограничена потолком, а сетка центрируется. Без потолка календарь
     растягивается во всю ширину панели и перестаёт читаться как месяц. */
  const big=G.chart('calendar',{cal},{h:520});
  const rc=[...big.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
    .map(m=>({x:+m[1],y:+m[2],w:+m[3],h:+m[4]}));
  const cells=rc.filter(r=>r.w>20), scale=rc.filter(r=>r.w===17);
  checks.push(['календарь не растягивается во всю ширину: у клетки есть потолок',
    cells.length>0&&cells.every(c=>c.w<=72.01&&c.h<=72.01)]);
  checks.push(['сетка календаря центрирована: поля слева и справа равны',
    (function(){
      const l=Math.min.apply(null,cells.map(c=>c.x));
      const r=900-Math.max.apply(null,cells.map(c=>c.x+c.w));
      return l>20&&Math.abs(l-r)<1.5;
    })()]);
  /* Шкала под сеткой упиралась в таблицу дней недели, которая идёт следом
     за графиком, и читалась как подпись к ней, а не как легенда календаря. */
  checks.push(['шкала календаря стоит НАД сеткой, а не под ней',
    scale.length>0&&cells.length>0&&
    Math.max.apply(null,scale.map(s=>s.y))<Math.min.apply(null,cells.map(c=>c.y))]);
})();

/* Под календарём стоит таблица дней недели, и расстояние до неё обязано быть тем
   же --chart-gap, что между любыми двумя графиками. Пока календарь был fill, он
   забирал всю высоту панели, клетка упиралась в потолок, а излишек оставался
   пустотой ВНУТРИ графика: 26px на ноутбуке и ~500px на большом мониторе. */
(function(){
  const svgH=s=>+((s.match(/<svg[^>]*\sheight="([\d.]+)"/)||[])[1]);
  const blocks=D.attLast(rl);
  checks.push(['календарь стоит своей высотой: у него нет fill',
    (calHtml.match(/class="svgchart/g)||[]).length===1&&
    !/class="svgchart fill"/.test(calHtml)]);
  /* высокий контейнер не должен добавлять графику пустоты снизу */
  checks.push(['высота календаря не зависит от высоты контейнера',
    svgH(G.chart('calendar',{blocks:blocks},{}))===
    svgH(G.chart('calendar',{blocks:blocks},{h:900}))]);
  /* низкий контейнер по-прежнему ужимает клетку: вылезать из панели нельзя */
  checks.push(['низкий контейнер ужимает клетку календаря, а не обрезает сетку',
    svgH(G.chart('calendar',{blocks:blocks},{h:240}))<
    svgH(G.chart('calendar',{blocks:blocks},{}))]);
  checks.push(['график без fill не тянется на остаток панели',
    /\.split-r\.panel-b>\.svgchart\{flex:none\}/.test(css)]);
  /* На телефоне панель становится блочной, flex-gap гаснет — расстояние
     до соседнего блока возвращается маргином, и оно то же самое */
  checks.push(['в блочной раскладке зазор в панели тот же --chart-gap',
    /\.split-r\.panel-b>\*\+\*\{margin-top:var\(--chart-gap\)\}/.test(css)&&
    /\.split-r\.panel-b>\.tbl-note\{margin-top:var\(--chart-gap\)\}/.test(css)]);
})();

/* Каретка у ИТОГО: раскрыть и свернуть всё дерево одним кликом, а не десятью */
(function(){
  const closed=A.go('structure','breakdown');
  checks.push(['у ИТОГО есть каретка на всё дерево',
    /<tr class="total top"><td class="txt"><span class="row-label"><button class="caret-btn" data-expall="1"/.test(closed)]);
  checks.push(['«ИТОГО» стоит на той же вертикали, что и названия подразделений',
    /data-expall="1"[^>]*>▸<\/button><span class="row-body">ИТОГО<\/span>/.test(closed)]);
  const open=A.expAll();
  checks.push(['каретка ИТОГО раскрывает все раскрываемые строки',
    (open.match(/<tr class="urow lvl2/g)||[]).length>0&&
    (open.match(/<tr class="urow lvl2/g)||[]).length>(closed.match(/<tr class="urow lvl2/g)||[]).length]);
  checks.push(['раскрыв всё, каретка ИТОГО предлагает свернуть',
    /data-expall="0" aria-label="Свернуть всё"/.test(open)&&/data-expall="0"[^>]*>▾</.test(open)]);
  A.expClear();
})();

/* Расстояние между графиками в стопке задают ДВА механизма — GAP внутри
   chart('panels') и CSS-зазор между двумя отдельными chart(). Пока величины
   расходились, «Найм, отток и переводы» показывал ~25px, а «Отток и текучесть»
   ~42px: одинаковый по смыслу зазор выглядел разным на соседних вкладках. */
(function(){
  const js=fs.readFileSync(path.join(dir,'draw.js'),'utf8');
  const inJs=(js.match(/const STACK_GAP=(\d+)/)||[])[1];
  const inCss=(css.match(/--chart-gap:(\d+)px/)||[])[1];
  checks.push(['зазор между графиками один: STACK_GAP в draw.js = --chart-gap в CSS',
    !!inJs&&inJs===inCss]);
  checks.push(['панели берут зазор из общей константы, а не из своего числа',
    /const GAP=STACK_GAP/.test(js)]);
  /* ось X устроена одинаково во всех видах: одна функция оси года (yoyAxis) —
     ею рисуются и одиночный график, и панели, и пара потоков */
  /* 14.10: у «ежиков» месяцы под нижними барами — своя строка, остальное — yoyAxis */
  checks.push(['ось X у панелей на том же отступе, что у остальных графиков',
    (js.match(/txt\(X\(i\),bot\+15,lb,/g)||[]).length===1&&(js.match(/s\+=yoyAxis\(X,bandW,top,bot,nowI[,)]/g)||[]).length===1&&!/bot\+13/.test(js)]);
})();

/* ============================================================================
   Итерация 24: состав численности — группы разрезов, срез по клику, матрица
   ========================================================================== */
(function(){
  const dims=D.MIX_DIMS, byKey=D.MIX_BY_KEY;

  /* 1. Разрезов девять, и это реестр, а не ветки в if */
  checks.push(['разрезы состава объявлены списком: от грейда до специализации',
    dims.map(d=>d.key).join(',')===
    'grade,seniority,gender,age,tenure,employment,contract,worksite,legal,region,stream,spec']);
  checks.push(['грейд и сеньорность — РАЗНЫЕ разрезы: числовой и текстовый',
    byKey.grade.cats.every(c=>/^Грейд \d$/.test(c.name))&&
    byKey.seniority.cats.map(c=>c.name).join(',')==='Junior,Middle,Senior,Lead и выше']);
  checks.push(['у каждой категории есть составной id «разрез:категория»',
    dims.every(d=>d.cats.every(c=>c.id===d.key+':'+c.key&&c.dim===d.key))]);
  /* ЦВЕТ ОДИН НА ТАБЛИЦУ. Величину несёт длина полосы; красить строки разными
     цветами — кодировать одно и то же дважды. Цвет различает ГРУППЫ разрезов. */
  checks.push(['цвет один на разрез, а не на категорию',
    dims.every(d=>/^#[0-9a-f]{6}$/i.test(d.color)&&d.cats.every(c=>c.color==null))]);
  /* 14.10: «все бары одного цвета, как квалификация, сейчас радуга» */
  checks.push(['все группы разрезов одним цветом — тоном квалификации',
    (function(){
      const c=Object.keys(D.MIX_GROUP_COLOR).map(k=>D.MIX_GROUP_COLOR[k]);
      return c.every(Boolean)&&new Set(c).size===1&&c[0]===D.MIX_GROUP_COLOR.qual;
    })()]);
  checks.push(['разрезы одной группы красятся одинаково',
    D.MIX_GROUPS.every(g=>new Set(g.dims.map(k=>D.dimColor(k))).size===1)]);
  /* в собранной разбивке ровно один цвет полосы на таблицу */
  (function(){
    const html=A.go('structure','stream');
    const groups=html.split('<div class="bt-group">').slice(1);
    checks.push(['в собранной разбивке полосы одного цвета',
      groups.length===1&&groups.every(g=>{
        const cols=[...g.matchAll(/;background:(#[0-9a-f]{6})/gi)].map(m=>m[1].toLowerCase());
        return cols.length>1&&new Set(cols).size===1;
      })]);
  })();

  /* 2. Раскладка по вкладкам: не больше четырёх разбивок на одной (14.10: лёгкие
     таблицы без шапки и ИТОГО — «Как оформлены и где» держит четыре разреза) */
  /* 15.10: каждый разрез — ровно в одном месте: стримы таблицей, остальное в двух обзорах */
  checks.push(['каждый разрез состава стоит ровно в одной главе',
    (function(){
      const who=A.go('structure','portrait'), work=A.go('structure','work'), str=A.go('structure','stream');
      const at=k=>[who,work,str].filter(h=>new RegExp('data-mix="'+k+':').test(h)).length;
      return ['seniority','grade','tenure','age','gender','employment','worksite','region','legal','stream'].every(k=>at(k)===1)&&
        !/data-mix="seniority:/.test(work)&&!/data-mix="stream:/.test(who);
    })()]);
  checks.push(['каждая группа ссылается на существующие разрезы',
    D.MIX_GROUPS.every(g=>g.dims.every(k=>!!byKey[k]))]);
  checks.push(['длинный разрез стоит на своей вкладке один',
    D.MIX_GROUPS.find(g=>g.dims.indexOf('stream')>=0).dims.length===1&&
    byKey.stream.cats.length>=8]);

  /* 3. Доли сходятся с численностью: округление общее, а не поклеточное */
  const hc=D.lastVal(rl,'hc_total');
  checks.push(['сумма разбивки равна численности отбора у ВСЕХ разрезов',
    dims.every(d=>D.mixParts(rl,d.key).reduce((a,b)=>a+b,0)===Math.round(hc))]);
  const mtx=D.mixMatrix(rl,'seniority','grade');
  checks.push(['сумма клеток матрицы равна численности отбора',
    [].concat(...mtx).reduce((a,b)=>a+b,0)===Math.round(hc)]);
  /* Края матрицы обязаны совпасть с обычной разбивкой по тому же разрезу:
     «Женщины 54» в матрице против «Женщины 53» на соседней вкладке — один
     человек, но после него не верят обеим таблицам. Проверяем ВСЕ пары. */
  (function(){
    let bad=0;
    dims.forEach(a=>dims.forEach(b=>{
      if(a.key===b.key)return;
      const M=D.mixMatrix(rl,a.key,b.key);
      const rt=M.map(r=>r.reduce((x,y)=>x+y,0));
      const ct=b.cats.map((_,j)=>M.reduce((x,r)=>x+r[j],0));
      if(rt.join()!==D.mixParts(rl,a.key).join())bad++;
      if(ct.join()!==D.mixParts(rl,b.key).join())bad++;
    }));
    checks.push(['края всех матриц сходятся с одномерными разбивками',bad===0]);
  })();
  /* Связи между разрезами не должны ломать одномерные доли: IPF возвращает
     распределение к тем же маргиналам, иначе матрица спорит с таблицей. */
  checks.push(['связь разрезов не сдвигает одномерные разбивки',
    D.MIX_LINKS.length>=2&&
    D.mixMatrix(rl,'seniority','gender').map(r=>r.reduce((a,b)=>a+b,0)).join()===
      D.mixParts(rl,'seniority').join()]);
  checks.push(['связь видна: доля женщин падает от Junior к Lead',
    (function(){
      const M=D.mixMatrix(rl,'seniority','gender');
      const sh=M.map(r=>r[0]/(r[0]+r[1]));
      return sh[0]>sh[3];
    })()]);
  checks.push(['под матрицей сказано, как её читать, — без кухни макета',
    /Сумма клеток равна численности в карточках/.test(A.go('structure','custom'))&&
    !/в макете/.test(A.go('structure','custom'))]);
  checks.push(['матрица «сеньорность × грейд» диагональная: связь разрезов задана, а не выдумана',
    mtx[0][4]===0&&mtx[3][0]===0&&mtx[0][0]>0&&mtx[3][4]>0]);
  /* пара без заданной связи считается независимо — и это ровно то, что сказано в сноске */
  const gg=D.mixMatrix(rl,'gender','worksite');
  checks.push(['независимая пара разрезов тоже сходится по сумме',
    [].concat(...gg).reduce((a,b)=>a+b,0)===Math.round(hc)]);

  /* 4. Тип занятости согласован с фильтром «штат / не штат» в шапке */
  (function(){
    const st=Object.assign({},D.DEFAULT_STATE,{staffType:'staff'});
    const only=D.reportLeaves(st), parts=D.mixParts(only,'employment');
    checks.push(['отбор «только штат» не показывает людей на ГПХ, ИП и аутстаффе',
      parts.slice(1).every(v=>v===0)&&parts[0]===Math.round(D.lastVal(only,'hc_total'))]);
  })();

  /* 5. Клик по строке разбивки берёт срез */
  const qual=A.go('structure','portrait');
  checks.push(['куски обзора кликаются: у них есть data-mix',
    /<span class="dk(?: big)?" data-mix="seniority:s" style="flex:/.test(qual)&&
    /<div class="bar" data-mix="grade:g1"/.test(qual)]);
  const hcAll=D.lastVal(rl,'hc_total'), hcSen=D.lastValSlice(rl,'hc_total',['seniority:s']);
  checks.push(['срез режет численность, а не оставляет её прежней',
    hcSen>0&&hcSen<hcAll]);
  checks.push(['срез двух атрибутов уже первого',
    D.lastValSlice(rl,'hc_total',['seniority:s','gender:f'])<hcSen]);
  checks.push(['проценты и сроки срезу не поддаются: режутся только счётные численности',
    D.sliceable('hc_total')&&D.sliceable('hc_active')&&
    !D.sliceable('turnover_m')&&!D.sliceable('office_att')&&
    D.lastValSlice(rl,'turnover_m',['seniority:s'])===D.lastVal(rl,'turnover_m')]);

  /* Карточка KPI и ИТОГО соседней разбивки — одно и то же число.
     Двойное округление (сначала до десятых, потом до целых) давало 54 в
     карточке против 53 в таблице: один человек, но после него не верят обеим. */
  (function(){
    let bad=0,n=0;
    /* Уровни одного разреза (стрим и специализация) из сверки исключены:
       срез по стриму не режет разбивку по специализациям — это тот же разрез,
       и схлопнуть его собственной категорией нельзя, иначе не переключиться. */
    const same=(a,b)=>a.childDim===b.key||b.childDim===a.key;
    dims.forEach(d=>d.cats.forEach(c=>{
      const one=[c.id], card=D.fmtVal('hc_total',D.lastValSlice(rl,'hc_total',one));
      dims.filter(x=>x.key!==d.key&&!same(x,d)).forEach(other=>{
        n++;
        if(card!==D.fmtVal('hc_total',D.mixParts(rl,other.key,one).reduce((a,b)=>a+b,0)))bad++;
      });
    }));
    checks.push(['карточка и ИТОГО разбивки под срезом дают одно число ('+n+' пар)',bad===0]);
  })();

  /* 6. Срез виден в карточках, в таблице подразделений и в плашке */
  A.mix(['seniority:s']);
  const sliced=A.go('structure','portrait');
  checks.push(['срез подписан плашкой под карточками KPI',
    /note-inline slice/.test(sliced)&&/Срез состава/.test(sliced)&&
    /data-mixclear="1"/.test(sliced)]);
  checks.push(['карточка KPI показывает численность по срезу',
    new RegExp('<div class="k-val">'+D.fmtVal('hc_total',hcSen)+'</div>').test(sliced)]);
  const totRow=(sliced.match(/<tr class="total top">[\s\S]*?<\/tr>/)||[''])[0];
  checks.push(['ИТОГО таблицы подразделений тоже по срезу',
    totRow.indexOf('>'+D.fmtVal('hc_total',hcSen)+'<')>=0&&
    totRow.indexOf('>'+D.fmtVal('hc_total',hcAll)+'<')<0]);
  checks.push(['выбранный кусок обзора помечен',
    /<span class="dk on(?: big)?" data-mix="seniority:s" style="flex:/.test(sliced)]);

  /* 7. Срез НЕ протекает на другие вкладки: подпись «N чел» стоит везде */
  const movSliced=A.go('movement','balance');
  A.mix([]);
  const movPlain=A.go('movement','balance');
  checks.push(['срез состава не протекает в другие блоки',
    movSliced===movPlain&&!/note-inline slice/.test(movSliced)]);

  /* 8. Матрица: таблица, синяя шкала, без светофора */
  A.mix([]);
  const cust=A.go('structure','custom');
  checks.push(['матрица — таблица, а не график',/<table class="ptable mxtable/.test(cust)&&
    !/<svg[^>]*class="svgchart/.test(cust)]);
  checks.push(['у матрицы есть конструктор осей и кнопка обмена',
    /data-mixaxis="rows"/.test(cust)&&/data-mixaxis="cols"/.test(cust)&&
    /data-mixswap="1"/.test(cust)]);
  checks.push(['клетка матрицы берёт срез сразу по двум атрибутам',
    /data-mix="seniority:[a-z]+,gender:[a-z]+"/.test(cust)||
    /data-mix="[a-z]+:[a-z0-9]+,[a-z]+:[a-z0-9]+"/.test(cust)]);
  const cellCols=[...cust.matchAll(/class="mx-cell[^"]*"[^>]*style="background:([^;]+);/g)].map(m=>m[1]);
  checks.push(['шкала матрицы синяя монохромная, как у календаря',
    cellCols.length>0&&cellCols.every(c=>{
      const [r,g,b]=c.match(/\d+/g).map(Number);return b>=r&&b>=g;
    })]);
  checks.push(['в матрице нет светофора',
    !new RegExp(G.C_GREEN+'|'+G.C_RED,'i').test(cust)]);
  checks.push(['первая колонка матрицы липкая: строку видно и после прокрутки вбок',
    /\.mxtabletd\.txt\{position:sticky/.test(css)&&/\.mx-wrap\{overflow-x:auto/.test(css)]);

  /* 9. Механика среза: один на разрез, не длиннее SLICE_MAX, повтор снимает */
  A.mix([]);
  checks.push(['второй клик по тому же разрезу заменяет категорию, а не складывает',
    (A.mixClick('seniority:j'),A.mixClick('seniority:s')).join(',')==='seniority:s']);
  checks.push(['категории разных разрезов складываются в срез',
    (A.mixClick('gender:f'),A.mixClick('worksite:rem')).length===3]);
  checks.push(['срез из трёх атрибутов режет сильнее, чем из двух',
    D.lastValSlice(rl,'hc_total',['seniority:s','gender:m','worksite:rem'])<
    D.lastValSlice(rl,'hc_total',['seniority:s','gender:m'])]);
  A.mix(['seniority:s']);
  checks.push(['повторный клик по взятой категории снимает её',
    A.mixClick('seniority:s').length===0]);
  checks.push(['ссылка переживает срез и оси конструктора',
    (A.mix(['seniority:s','gender:f']),/mix=seniority%3As%2Cgender%3Af/.test(A.link()))]);
  A.mix([]);

  /* 10. Стрим — двухуровневый разрез: каретка раскрывает специализации */
  (function(){
    const tree=D.mixTree(rl,'stream');
    checks.push(['специализации в сумме дают ровно свой стрим',
      tree.every(n=>n.kids.reduce((a,k)=>a+k.value,0)===n.value)]);
    checks.push(['стримы в сумме дают численность отбора',
      tree.reduce((a,n)=>a+n.value,0)===Math.round(hc)]);
    checks.push(['разбивка по специализациям и дерево стримов — одни и те же числа',
      D.mixParts(rl,'spec').join()===[].concat(...tree.map(n=>n.kids.map(k=>k.value))).join()]);
    /* уровни одного разреза не перемножаются как независимые */
    checks.push(['срез «стрим + его специализация» равен самой специализации',
      D.lastValSlice(rl,'hc_total',['stream:dev','spec:be'])===
      D.lastValSlice(rl,'hc_total',['spec:be'])]);
    checks.push(['срез «стрим + чужая специализация» пуст',
      D.lastValSlice(rl,'hc_total',['stream:dev','spec:l1'])===0]);
    const mx=D.mixMatrix(rl,'stream','spec');
    checks.push(['матрица «стрим × специализация» блочно-диагональная',
      mx.every((r,i)=>r.every((v,j)=>
        v===0||D.MIX_BY_KEY.spec.cats[j].parent===D.MIX_BY_KEY.stream.cats[i].key))]);
    const html=A.go('structure','stream');
    checks.push(['у стрима есть каретка, а сами специализации свёрнуты',
      /<button class="caret-btn" data-btexp="stream:dev"/.test(html)&&
      !/data-mix="spec:be"/.test(html)]);
    const open=A.mixOpen(['stream:dev']);
    checks.push(['раскрытая каретка показывает специализации вторым уровнем',
      /<tr class="urow lvl2" data-mix="spec:be"/.test(open)&&
      /data-open="1" data-btexp="stream:dev"/.test(open)]);
    /* ИТОГО не должно удвоиться: дети уже сидят в родительской строке */
    /* ищем внутри самой разбивки: ИТОГО сводной таблицы подразделений стоит
       на странице раньше и до правки перехватывало проверку на себя */
    const grp=(open.match(/<div class="bt-group">[\s\S]*?<\/table>/)||[''])[0];
    /* заголовок первой колонки не повторяет название разреза над таблицей */
    /* 14.10: таблицы структуры «лёгкие» — без шапки колонок и без ИТОГО:
       итог стоит в карточке над ними, повторять его у каждого разреза незачем */
    checks.push(['таблицы структуры: подпись над таблицей, без шапки колонок и без ИТОГО',
      /<div class="bt-cap">Стрим и специализация/.test(grp)&&!/<thead>/.test(grp)&&!/ИТОГО/.test(grp)&&
      D.MIX_GROUPS.every(g=>{const v=A.go('structure',g.key).split('<div class="bt-stack lite">')[1]||'';
        return v&&!/class="total/.test(v)&&!/<thead>/.test(v)&&/class="ptable btable dense lite"/.test(v)})]);
    /* то же правило во всех таблицах, у которых имя стоит прямо над ними */
    checks.push(['ни одна таблица не повторяет своё название в шапке колонки',
      /<thead><tr><th class="txt"><\/th>/.test(A.go('turnover','reasons'))&&
      /<thead><tr><th class="txt"><\/th>/.test(A.go('office','offices'))]);
    /* верхний уровень двухуровневой разбивки складывается в численность:
       дети уже сидят в родительской строке и второй раз не считаются */
    A.go('structure','stream');
    const open2=A.mixOpen(['stream:dev']);
    const grp2=(open2.match(/<div class="bt-group">[\s\S]*?<\/table>/)||[''])[0];
    const topSum=[...grp2.matchAll(/<tr class="urow(?: sel)?" data-mix="stream:[^"]*"[\s\S]*?<td class="lead">([\d ]+)/g)]
      .reduce((a,m)=>a+(+m[1].replace(/ /g,'')),0);
    checks.push(['верхний уровень двухуровневой разбивки складывается в численность',
      topSum===Math.round(hc)]);
    /* ПРАВИЛО: у таблицы с каретками в строках обязана быть общая каретка —
       без строки ИТОГО она стоит в подписи таблицы */
    checks.push(['у двухуровневой разбивки есть общая каретка в подписи',
      /<span class="bt-all"><button class="caret-btn" data-btexpall="stream\|1"/.test(html)]);
    /* в остальных разбивках ИТОГО по-прежнему первой строкой */
    checks.push(['ИТОГО стоит первой строкой в разбивках вне структуры и в сводной таблице',
      /<tbody>[\s\S]{0,40}<tr class="total top"/.test(A.go('turnover','reasons'))]);
    /* проверка выше уходила на вкладку текучести — возвращаемся, иначе
       A.mixOpen отрисует не тот экран */
    A.go('structure','stream');
    const allOpen=A.mixOpen(D.MIX_BY_KEY.stream.cats.map(c=>c.id));
    checks.push(['раскрыв всё, общая каретка предлагает свернуть',
      /data-open="1" data-btexpall="stream\|0"/.test(allOpen)&&
      (allOpen.match(/<tr class="urow lvl2/g)||[]).length===D.MIX_BY_KEY.spec.cats.length]);
    A.mixOpen([]);
  })();

  /* 11. Мусор в ссылке не ломает экран */
  checks.push(['неизвестный разрез из ссылки выбрасывается',
    D.sliceParse(['nosuch:x','seniority:s','seniority:nope']).map(p=>p.id).join(',')==='seniority:s']);
})();

/* Общая каретка есть у КАЖДОЙ таблицы с каретками в строках — иначе десять
   строк раскрываются по одной. Проверяем все три такие таблицы отчёта. */
(function(){
  const one=A.op([]);
  checks.push(['у таблицы метрик one-pager есть общая каретка блока',
    /<th class="col-caret"><button class="caret-btn" data-opexpall="structure\|1"/.test(one)]);
  checks.push(['общая каретка блока раскрывает графики всех его метрик',
    (function(){
      const opened=A.op(D.metricsOfBlock('turnover').map(m=>m.key));
      return /data-open="1" data-opexpall="turnover\|0"/.test(opened)&&
        (opened.match(/<tr class="detail-row"/g)||[]).length>=3;
    })()]);
  A.op([]);
  /* и в сводной таблице подразделений — она была первой, правило пришло оттуда */
  checks.push(['общая каретка есть во всех трёх таблицах с каретками',
    /data-expall="1"/.test(A.go('structure','portrait'))&&
    /data-btexpall="stream\|1"/.test(A.go('structure','stream'))&&
    /data-opexpall="/.test(A.op([]))]);
})();

/* заголовки одной роли — один кегль: имя графика, имя панели и шапка бар-таблицы */
checks.push(['заголовки графиков и панелей одного кегля',
  /const TTL_SZ=12/.test(fs.readFileSync(path.join(dir,'draw.js'),'utf8'))&&
  /\.bt-cap\{[^}]*font-size:12px/.test(css)]);

/* Типографика: вес — иерархия, а не украшение. Пока жирным было набрано всё,
   выделять стало нечем; проверка держит шкалу и не даёт вернуть восьмисотый.

   Итерация 28: в Proteus работает только Arial, а у него ДВА начертания.
   500 браузер рисует обычным, 600 — жирным, и прежняя шкала из четырёх ролей
   там схлопывалась: всё полужирное выходило таким же жирным, как заголовки.
   Поэтому весов два, и проверки держат именно это. */
checks.push(['в :root два начертания: обычное 400 и жирное 700',
  /--fw-body:400/.test(css)&&/--fw-bold:700/.test(css)&&
  /--fw-med:var\(--fw-body\)/.test(css)&&/--fw-lead:var\(--fw-body\)/.test(css)]);
checks.push(['веса 800 в отчёте не осталось',!/font-weight:800/.test(css)]);
(function(){
  /* каждое font-weight в правилах — один из двух токенов; промежуточных 500/600
     и алиасов --fw-med / --fw-lead в правилах нет */
  const ws=[...css.matchAll(/font-weight:([^;}]+)/g)].map(m=>m[1]);
  checks.push(['в стилях только два веса: каждое font-weight — обычный или жирный токен',
    ws.length>50&&ws.every(w=>w==='var(--fw-body)'||w==='var(--fw-bold)')]);
  /* то же в SVG: подписи графиков 400 или 700, полужирного там тоже нет */
  const sw=[...allHtml.matchAll(/font-weight="(\d+)"/g)].map(m=>m[1]);
  checks.push(['на графиках только два веса подписей',
    sw.length>100&&sw.every(w=>w==='400'||w==='700')]);
  /* только Arial: ни веб-шрифта, ни другой гарнитуры в стеке */
  const fams=[...css.matchAll(/font-family:([^;}]+)/g)].map(m=>m[1]);
  const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
  checks.push(['шрифт — только Arial: в стилях, на графиках и без веб-шрифта',
    fams.length>0&&fams.every(f=>f==='Arial,sans-serif'||f==='inherit')&&
    G.FONT==='Arial, sans-serif'&&/font-family="Arial, sans-serif"/.test(allHtml)&&
    !/fonts\.googleapis|Inter|Helvetica/.test(html)]);
  /* активная вкладка жирная, а соседние не прыгают: ширина жирной подписи
     зарезервирована невидимой копией */
  checks.push(['активная вкладка жирная, ширина под жирную подпись зарезервирована',
    /\.sub-tab\.active\{[^}]*font-weight:var\(--fw-bold\)/.test(css)&&
    /\.sub-tab::after\{content:attr\(data-text\)/.test(css)&&
    /class="(sub-tab|st-step)[^"]*" data-subtab="[^"]+" data-text="/.test(allHtml)&&
    /\.st-step\.on\.st-q\{font-weight:var\(--fw-bold\)\}/.test(css)]);
})();
checks.push(['числа и имена строк — обычным, главное число и ИТОГО — жирным',
  /\.ptabletd\{[^}]*font-weight:var\(--fw-body\)/.test(css)&&
  /\.ptabletd\.txt\{[^}]*font-weight:var\(--fw-body\)/.test(css)&&
  /\.ptable\.densetd\.lead\{font-weight:var\(--fw-bold\)/.test(css)&&
  /\.ptabletr\.totaltd\{[^}]*font-weight:var\(--fw-bold\)/.test(css)]);

/* токены: три шкалы в :root, литеральных цветов в экранах не осталось */
checks.push(['в :root есть шкала расстояний, роли кеглей и радиусы',
  /--s1:2px/.test(css)&&/--s10:24px/.test(css)&&
  /--fs-micro:9\.5px/.test(css)&&/--fs-hero:24px/.test(css)&&
  /--r1:3px/.test(css)&&/--r5:16px/.test(css)]);
checks.push(['третьей палитры нет: в экранах ни одного литерального цвета',
  fs.readdirSync(path.join(dir,'screens')).filter(f=>f.endsWith('.js'))
    .every(f=>!/#[0-9a-fA-F]{6}/.test(fs.readFileSync(path.join(dir,'screens',f),'utf8')))]);

/* ============================================================================
   Итерация 28: дообогащение по бизнес-анализу 07.10.2026 (пробелы против
   дашбордов Proteus 34661 / 34136 и рекомендации). Главное правило новых
   разбивок: ИТОГО — это метрика отчёта за то же окно, а не отдельное число.
   ========================================================================== */
(function(){
  const S0=D.DEFAULT_STATE, rl0=D.reportLeaves(S0), bl0=D.benchmarkLeaves(S0);
  const near=(a,b,eps)=>a!=null&&b!=null&&Math.abs(a-b)<=(eps||0.051);
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const ytd=k=>D.sumWin(D.aggregate(rl0,k),'ytd');

  checks.push(['восемь блоков: AI-инструменты — восьмой, двадцать семь метрик (15.10: + «Переработчики»), сравнимых пятнадцать',
    D.BLOCKS.length===8&&D.BLOCKS[7].key==='ai'&&D.metricsOfBlock('ai').length===2&&
    D.METRICS.length===27&&D.METRICS.filter(m=>D.comparable(m.key)).length===15]);

  /* --- производные метрики: формулы --- */
  const e=k=>D.aggregate(rl0,k)[D.LAST];
  /* 15.10: замещение, найм на 100, прогноз текучести и лоу-перформеры сняты —
     их нет в каталоге графиков HQ и УС */
  checks.push(['выдуманных метрик нет: только то, что есть в каталоге HQ и УС',
    ['replace_ratio','hire_rate','turnover_fc','low_perf'].every(k=>!D.METRIC_BY_KEY[k])&&
    D.METRICS.every(m=>D.AUD_LABEL[m.aud])]);
  checks.push(['проникновение AI = активные пользователи / активная численность',
    near(e('ai_penetration'),e('ai_wau')/e('hc_active')*100,0.006)]);
  checks.push(['прогноза на декабрь нет: run-rate снят вместе с метрикой',
    !/прогноз/.test(SC.yoyChart('turnover_y',rl0,bl0,S0,{}))]);

  /* --- разбивки сходятся со своими метриками --- */
  const hp=D.hiringProfile(rl0,'ytd');
  checks.push(['профиль найма: джуны = доля джунов, переводы = доля внутреннего найма',
    hp.total===ytd('hire')&&sum(hp.seniority.map(x=>x.value))===hp.total&&
    sum(hp.grade.map(x=>x.value))===hp.total&&sum(hp.channels.map(x=>x.value))===hp.total&&
    near(hp.jun/hp.total*100,e('junior_share'))&&near(hp.tin/(hp.total+hp.tin)*100,e('internal_share'))]);
  const pf=D.planFact(rl0);
  checks.push(['план-факт: факт — найм из «Движения», выполнение = метрике, типы складываются',
    pf.fact[0]===ytd('hire')&&pf.plan[0]===ytd('pf_plan')&&pf.closed[0]===ytd('vac_closed')&&
    pf.open[0]===e('vac_open')&&near(pf.done[0],e('hire_plan'))&&
    ['plan','fact','closed','open','overdue','replace','junior'].every(k=>pf[k][0]===pf[k][1]+pf[k][2])&&
    pf.status.every(x=>x.vals[0]===x.vals[1]+x.vals[2])&&sum(pf.status.map(x=>x.vals[0]))===pf.open[0]]);
  const rs=D.exitReasons(rl0,'ytd'), ini=D.exitInitiators(rl0,'ytd'), ex=D.exitProfile(rl0,'ytd');
  checks.push(['инициатор увольнения — сумма причин, ИТОГО обеих — отток с начала года',
    sum(rs.map(x=>x.value))===ytd('attrition')&&sum(ini.map(x=>x.value))===ytd('attrition')&&
    D.EXIT_INITIATORS.every(i=>ini.find(x=>x.key===i.key).value===
      sum(rs.filter(r=>r.init===i.key).map(r=>r.value)))]);
  checks.push(['кто уходит: стаж, грейд и стрим ушедших в сумме — отток с начала года',
    ['tenure','grade','stream'].every(k=>sum(ex[k].map(x=>x.value))===ytd('attrition'))]);
  const tg=D.tgrowthProfile(rl0), gp=D.mixParts(rl0,'grade');
  checks.push(['статусы роста: строки = разбивке по грейдам, «рост состоялся» = прошли за 12 мес',
    tg.rows.every((r,i)=>sum(r.cells)===gp[i])&&
    sum(tg.rows.map(r=>r.cells[0]))===Math.min(tg.pass,sum(gp))&&
    sum(tg.types.map(t=>t.pass))===tg.pass&&sum(tg.types.map(t=>t.deny))===tg.deny]);
  const rv=D.reviewProfile(rl0);
  checks.push(['ревью: «улучшили» = метрике, края каждой группы сходятся с общим распределением',
    sum(rv.dyn.map(x=>x.value))===rv.E&&near(rv.U/rv.E*100,e('review_up'))&&
    rv.groups.every(g=>rv.scores.every((sc,j)=>sum(g.cells.map(r=>r[j]))===sc.value)&&
      g.cells.every((r,i)=>sum(r)===g.tot[i]))]);
  const bk=D.bookingQuality(rl0);
  checks.push(['бронирование: доля нарушений в таблице = метрике блока',
    bk.ok+bk.noshow+bk.walkin===bk.total&&near(bk.viol/bk.total*100,e('booking_viol'),0.06)]);
  const wavg=rows=>sum(rows.map(r=>r.hc*r.att))/sum(rows.map(r=>r.hc));
  checks.push(['посещаемость по грейдам и по роли с локацией в среднем = посещаемости отбора',
    near(wavg(D.attByGrade(rl0)),e('office_att'),0.11)&&near(wavg(D.attByRoleLoc(rl0)),e('office_att'),0.11)&&
    sum(D.attByRoleLoc(rl0).map(r=>r.hc))===Math.round(e('hc_total'))]);
  const ai=D.aiProfile(rl0);
  checks.push(['AI: ни один инструмент не выше общего проникновения, стримов нет (15.10)',
    !ai.streams&&ai.tools.every(t=>t.value<=ai.pen)&&!/Сравнение стримов/.test(A.go('ai','tools'))]);
  /* 14.10: «Оформление» и «География» — одна глава «Как оформлены и где работают» */
  checks.push(['регион — разрез главы «Как оформлены и где», матрица «регион × специализация» сходится',
    /data-mix="region:msk"/.test(A.go('structure','work'))&&
    sum([].concat(...D.mixMatrix(rl0,'region','spec')))===Math.round(e('hc_total'))&&
    /Москва и область/.test(A.go('structure','work'))]);

  /* --- доля без знаменателя: прочерк, а не ноль --- */
  const empty=D.leavesUnder('T').map(l=>l.path).find(p=>D.sumWin(D.aggregate([p],'hire'),'ytd')===0);
  checks.push(['доля без знаменателя — прочерк без оценки, а не ноль',
    !!empty&&D.lastVal([empty],'junior_share')===null&&D.fmtVal('junior_share',null)==='—'&&
    D.compareState('junior_share',null,20)==='neutral'&&U.deltaChip('junior_share',null).replace(/<[^>]+>/g,'')==='—'&&
    /нет данных/.test(U.targetCell('hire_plan',null,null,{green:95,red:80}))]);

  /* --- раскладка и детальный слой --- */
  checks.push(['«Детальный дашборд» ведёт в ту версию Proteus, где блок есть',
    D.blockDash('structure',{paint:'HQ'}).id==='34136'&&D.blockDash('structure',{paint:'Line'}).id==='34661'&&
    D.blockDash('ai',{paint:'Line'}).id==='34136'&&D.blockDash('monitor',{paint:'HQ'}).id==='34661'&&
    /href="#\/proteus\/34136"/.test(A.go('ai','adoption'))]);
  const op=A.go('onepager',null);
  checks.push(['шапка one-pager — дайджест из восьми карточек: с джунами и проникновением AI',
    SC.onepager.HERO.length===8&&SC.onepager.HERO.indexOf('junior_share')>=0&&
    SC.onepager.HERO.indexOf('ai_penetration')>=0&&/<div class="kpis n4">/.test(op)]);
  const mv=A.go('movement','balance');
  checks.push(['в карточках KPI блока есть спарклайн',
    (mv.match(/<div class="kpi">[\s\S]*?<\/div><\/div>/g)||[]).filter(c=>/class="spark"/.test(c)).length===D.metricsOfBlock('movement').length]);
  /* 15.10: после чистки по каталогу ни в одном блоке нет 7 метрик — широкой
     таблицы нет, но правило раскладки остаётся на случай новых метрик */
  checks.push(['широкая сводная таблица — от 7 метрик (сейчас таких блоков нет), ниже 1240px встаёт над графиком',
    D.BLOCKS.every(b=>D.metricsOfBlock(b.key).length<7)&&!/class="split wide-l/.test(mv)&&
    /\.split\.wide-l\{grid-template-columns:minmax\(min-content,\.9fr\)/.test(css)&&
    /@media\(max-width:1240px\)\{\.split\.wide-l\{grid-template-columns:1fr;height:auto\}/.test(css)]);
  checks.push(['имя подразделения липкое: широкая таблица прокручивается внутри панели',
    /\.split-l\.ptable\.densetd\.txt\{position:sticky;left:0/.test(css)]);
  /* 15.10, редполитика (TEXT_GUIDE.md): сноски — как читать таблицу, а не как устроены данные */
  checks.push(['сноски вкладок без кухни: ни «на проде», ни «в макете», ни имён таблиц',
    [['hiring','plan'],['hiring','profile'],['turnover','reasons'],['turnover','who'],['monitor','review'],
     ['office','booking'],['ai','tools'],['tgrowth','statuses']].every(([b,sb])=>{
      const h=A.go(b,sb), notes=(h.match(/<div class="tbl-note">[\s\S]*?<\/div>/g)||[]).join(' ');
      return notes&&!/на проде|в макете|сгенерирован|_[a-z]+_|SOURCES|дашборд \d/i.test(notes);
    })]);
})();

/* ============================================================================
   Итерация 29: дерево подразделений на три уровня и переход в юнит
   (механика HRBP HUB). Таблица показывает −1…−3 от юнита отчёта, глубже —
   «Открыть юнит» у выбранной строки; переход меняет сам юнит, путь над
   отчётом кликабелен, «← Назад» возвращает к юниту до перехода.
   ========================================================================== */
(function(){
  A.home();
  const U0=D.DEFAULT_STATE.unit, n0=D.NODE_BY_PATH[U0];
  const under=lvl=>D.NODES.filter(n=>n.path.indexOf(U0+'/')===0&&n.level===n0.level+lvl);
  const lv1=under(1), lv2=under(2), lv3=under(3);
  const ex=SC.expandableRows(U0);
  checks.push(['«раскрыть всё» открывает два уровня кареток — таблица уходит на три уровня вниз',
    SC.TREE_DEPTH===3&&ex.length>0&&
    ex.every(p=>{const d=D.NODE_BY_PATH[p].level-n0.level;return d>=1&&d<=2&&D.childrenOf(p).length>0})&&
    ex.some(p=>D.NODE_BY_PATH[p].level===n0.level+2)]);

  const closed=A.go('turnover','dynamics');
  checks.push(['свёрнутая таблица — только первый уровень, с подписью уровня',
    (closed.match(/ data-node="/g)||[]).length===lv1.length&&
    !/<tr class="urow lvl2/.test(closed)&&/<span class="unit-sub">Деп\. · /.test(closed)]);
  const open=A.expAll();
  const rows3=(open.match(/<tr class="urow lvl3[^"]*" data-node="/g)||[]).length;
  checks.push(['раскрытая таблица — все три уровня, третий без кареток',
    (open.match(/<tr class="urow lvl2[^"]*" data-node="/g)||[]).length===lv2.length&&
    rows3===lv3.length&&rows3>0&&
    !/<tr class="urow lvl3[^"]*" data-node="[^"]+"><td class="txt"><span class="row-label"><button class="caret-btn"/.test(open)&&
    /<tr class="urow lvl2[^"]*" data-node="[^"]+"><td class="txt"><span class="row-label"><button class="caret-btn"/.test(open)]);
  const deep=lv3.filter(n=>D.childrenOf(n.path).length);
  checks.push(['на границе глубины — «ниже ещё N»: сколько подразделений осталось ниже',
    deep.length>0&&(open.match(/class="below"/g)||[]).length===deep.length&&
    new RegExp('ниже ещё '+D.childrenOf(deep[0].path).length+'<').test(open)]);
  checks.push(['каретка ИТОГО обещает все три уровня',
    /Все три уровня подразделений разом/.test(closed)]);
  A.expClear();

  /* --- выбор и переход --- */
  checks.push(['без выбора строки кнопки перехода нет — клик по строке не уводит',
    !/data-openunit=/.test(closed)]);
  const pick=lv1[0].path, picked=A.sel(pick);
  checks.push(['у выбранной строки и в шапке правой панели — «Открыть»',
    (picked.match(new RegExp('data-openunit="'+pick+'"','g'))||[]).length===2&&
    new RegExp('<tr class="urow[^"]* sel" data-node="'+pick+'">[\\s\\S]*?data-openunit="'+pick+'"').test(picked)&&
    />Открыть<\/button>/.test(picked)]);
  checks.push(['кнопки ↓ и временного корня больше нет',
    !/data-drill|data-undrill|Временный корень/.test(picked)&&!('drillRoot' in D.DEFAULT_STATE)]);

  const before=A.crumbs();
  checks.push(['путь над отчётом: «↑ Уровнем выше», «Назад» до первого перехода нет',
    new RegExp('data-crumb="'+n0.parent+'"[^>]*>↑ Уровнем выше').test(before)&&!/data-uback/.test(before)]);
  A.unit(pick);
  const after=A.go('turnover','dynamics'), cr=A.crumbs();
  checks.push(['«Открыть юнит» делает строку юнитом отчёта: его дети — новый первый уровень',
    A.st().unit===pick&&
    (after.match(/ data-node="/g)||[]).length===D.childrenOf(pick).length&&
    D.reportLeaves(A.st()).every(p=>p.indexOf(pick+'/')===0)]);
  checks.push(['после перехода путь ведёт назад: «← Назад» и предки кликабельны',
    /data-uback="1"[^>]*>← Назад/.test(cr)&&new RegExp('data-crumb="'+U0+'"').test(cr)&&
    A.stack().slice(-1)[0]===U0]);
  checks.push(['ссылка открывает юнит, в который перешли',
    A.link().indexOf('unit='+encodeURIComponent(pick))>0]);
  A.back();
  checks.push(['«← Назад» возвращает к юниту до перехода и снимает себя',
    A.st().unit===U0&&A.stack().length===0&&!/data-uback/.test(A.crumbs())]);
  A.home();A.unit('T');
  checks.push(['у компании целиком уровня выше нет',
    !/Уровнем выше/.test(A.crumbs())]);

  /* --- команда без подразделений: пустое состояние словами, все экраны живы --- */
  const leaf=D.NODES.find(n=>n.leaf&&n.path.indexOf(U0+'/')===0&&n.level===6);
  A.home();A.unit(leaf.path);
  const lv=A.go('turnover','dynamics');
  let alive=true;
  D.BLOCKS.forEach(b=>SC.blocks[b.key].subTabs.forEach(t=>{
    try{if(!A.go(b.key,t[0]))alive=false}catch(err){alive=false}
  }));
  checks.push(['у команды без подразделений — строка «нет подразделений уровнем ниже», экраны собираются',
    /class="tree-empty"/.test(lv)&&/нет подразделений уровнем ниже/.test(lv)&&!/ data-node="/.test(lv)&&alive]);
  /* 19.10: выбор юнита — дерево как в HRBP HUB: путь к выбранному раскрыт, у строки — логин
     руководителя и сколько людей попадёт в выбор; поиск — и по логину */
  const su=A.setupUnits(), hd=D.NODE_BY_PATH[leaf.path].head;
  const sq=A.setupUnits(hd.login.slice(0,5));
  checks.push(['в настройке юнит глубже управления виден в дереве и выбран; логин, числа, поиск по логину',
    new RegExp('class="ut-r cur" data-upick="'+leaf.path+'"').test(su)&&/class="ut-h"/.test(su)&&/class="ut-c/.test(su)&&
    /После «Применить»/.test(su)&&/class="opt-n"/.test(su)&&
    /<mark class="ut-hl">/.test(sq)&&new RegExp('data-upick="'+leaf.path+'"').test(sq)]);

  /* --- поиск по таблице --- */
  A.home();
  const q='Команда', found=A.search(q);
  const hitRows=(found.match(/<tr class="urow[^"]* hit" data-node="[^"]+"/g)||[]).map(x=>x.match(/data-node="([^"]+)"/)[1]);
  const ancRows=(found.match(/<tr class="urow[^"]* anc" data-node="[^"]+"/g)||[]).map(x=>x.match(/data-node="([^"]+)"/)[1]);
  const expect=lv1.concat(lv2,lv3).filter(n=>n.name.indexOf(q)>=0).map(n=>n.path);
  checks.push(['поиск находит в трёх уровнях и показывает находки вместе с предками',
    hitRows.length===expect.length&&hitRows.length>0&&expect.every(p=>hitRows.indexOf(p)>=0)&&
    ancRows.every(a=>hitRows.some(h=>h.indexOf(a+'/')===0))&&
    /<mark class="hl">Команда<\/mark>/.test(found)]);
  checks.push(['при поиске каретки не нужны — дерево раскрыто по находкам',
    !/data-exp="/.test(found)&&!/data-expall="/.test(found)]);
  checks.push(['поиск без находок говорит, где искать дальше',
    /В трёх уровнях вниз нет «нетакого»/.test(A.search('нетакого'))]);
  A.home();
  checks.push(['ступени дерева держатся на любой ширине, кнопка перехода и поиск — из токенов',
    /\.split-l\.ptable\.densetr\.lvl2td\.txt\{padding-left:calc\(var\(--pad-cell\)\+16px\)\}/.test(css)&&
    /\.split-l\.ptable\.densetr\.lvl3td\.txt\{padding-left:calc\(var\(--pad-cell\)\+32px\)\}/.test(css)&&
    /\.open-unit\{[^}]*color:var\(--act\)/.test(css)&&/mark\.hl\{background:var\(--act-line\)/.test(css)]);
  A.go('onepager',null);
})();

/* ============================================================================
   Итерация 30: ширина колонок рабочей зоны (механика HRBP HUB). Разделитель
   между таблицей и графиками тянется, любую панель можно развернуть во всю
   ширину — вторая сворачивается в полосу со своим именем.
   ========================================================================== */
(function(){
  A.home();A.go('turnover','dynamics');
  const both=A.split('both',null);
  checks.push(['между таблицей и графиками — разделитель: separator с клавиатурой и подсказкой',
    /<div class="split-gut" data-split="1" role="separator" aria-orientation="vertical"[^>]*tabindex="0"/.test(both)&&
    /class="split m-both"/.test(both)&&!/class="split[^"]* custom"/.test(both)]);
  checks.push(['переключатель таблицы — свитч с подписью в углу шапки панели графиков, иконок «во всю ширину» нет',
    /<div class="h-txt has-btn"><span>Отток и текучесть по месяцам<\/span>[\s\S]*?<button class="unit-toggle on" data-splitmode="charts" role="switch" aria-checked="true"[\s\S]*?<span class="ut-l">Подразделения<\/span><\/button><\/div>/.test(both)&&
    /\.panel-h\.h-txt>\.unit-toggle\{position:absolute;right:0/.test(css)&&
    !/split-btn|split-rail|data-splitmode="table"/.test(both)]);
  const chs=A.split('charts',null);
  checks.push(['графики во всю ширину: переключатель предлагает показать таблицу, разметка таблицы на месте',
    /class="split m-charts"/.test(chs)&&
    /<button class="unit-toggle" data-splitmode="both" role="switch" aria-checked="false"/.test(chs)&&
    /class="panel split-l"/.test(chs)]);
  checks.push(['таблица подразделений по умолчанию видна — основа фильтрации; старое «table» читается как обе колонки',
    /let splitMode='both'/.test(appSrc)&&/splitMode=ui\.splitMode==='charts'\?'charts':'both'/.test(appSrc)&&
    /class="split m-both"/.test(A.split('table',null))]);
  const cust=A.split('both',0.62);
  A.go('onepager',null);
  checks.push(['доля после перетаскивания — переменные сетки, separator знает своё значение',
    /class="split m-both custom" style="--split-l:62\.00fr;--split-r:38\.00fr"/.test(cust)&&
    /aria-valuenow="62"/.test(cust)]);
  A.split('both',null);
  checks.push(['раскладка колонок: разделитель — третья колонка, минимум 340px, узкий экран не трогаем',
    /\.split\{display:grid;grid-template-columns:minmax\(min-content,\.7fr\)16pxminmax\(400px,1\.3fr\);column-gap:0;row-gap:16px/.test(css)&&
    /\.split\.custom\{grid-template-columns:minmax\(340px,var\(--split-l\)\)16pxminmax\(340px,var\(--split-r\)\)\}/.test(css)&&
    /\.split-gut\{display:none\}/.test(css)&&
    /@media\(min-width:1121px\)\{\.split>\.split-gut\{display:flex\}/.test(css)&&
    /\.split\.m-charts>\.split-l,\.split\.m-charts>\.split-gut\{display:none\}/.test(css)&&
    /\.split\.wide-l\.wide-l\{grid-template-columns:1fr;column-gap:0\}/.test(css)]);
  checks.push(['каркас борда не шире --shell и стоит по центру, шапка выровнена по его краям',
    /--shell:1760px/.test(css)&&/\.layout\{max-width:var\(--shell\);margin:0auto/.test(css)&&
    /\.apphead-top\{padding-left:max\(22px,calc\(\(100%-var\(--shell\)\)\/2\+22px\)\)/.test(css)]);
})();

/* ============================================================================
   Итерация 32: история по главам. Правая панель — степпер глав, заголовок-вывод,
   колонка «Что важно / Где сосредоточено / Что сделать / Дальше»; тексты считает
   story.js из тех же рядов, что рисуют графики.
   ========================================================================== */
(function(){
  const STY=window.TPSTORY;
  A.home();
  /* каждая глава каждого блока считается без исключений — на отборе по
     умолчанию, на одной команде и на подразделении без людей в отборе */
  const st0=D.DEFAULT_STATE;
  const team=D.NODES.find(n=>D.childrenOf(n.path).length===0&&D.leavesUnder(n.path).length);
  const probes=[{sel:st0.unit},{sel:team.path}];
  let thrown=[], noHead=[];
  probes.forEach(pr=>{
    const S=Object.assign({},st0);
    const c={S:S,lp:D.leavesUnder(pr.sel).map(l=>l.path).filter(p=>D.leafPasses(p,S)),
      bl:D.benchmarkLeaves(S),sel:pr.sel,bench:D.benchmarkLabel(S)};
    Object.keys(STY.CH).forEach(bk=>Object.keys(STY.CH[bk]).forEach(k=>{
      try{const r=STY.CH[bk][k](c)||{};if(!r.head&&k!=='custom'&&pr.sel===st0.unit)noHead.push(bk+'/'+k)}
      catch(e){thrown.push(bk+'/'+k+': '+e.message)}
    }));
  });
  if(thrown.length)console.log('    главы с ошибкой:',thrown.join('; '));
  if(noHead.length)console.log('    главы без вывода:',noHead.join('; '));
  checks.push(['история: каждая глава каждого блока считается без ошибок и с выводом',
    !thrown.length&&!noHead.length]);
  /* фидбэк 12.10: «зачем смотреть и что с этим делать» у каждой главы,
     каждый размеченный термин есть в словаре и объяснён */
  const whyMiss=[], termBad=[];
  D.BLOCKS.forEach(b=>SC.blocks[b.key].subTabs.forEach(t=>{
    const w0=(STY.WHY[b.key]||{})[t[0]], w=typeof w0==='function'?w0():w0;
    if(!w||!w[0]||!w[1])whyMiss.push(b.key+'/'+t[0]);
    (w||[]).join(' ').replace(/\{\{([^}|]+)(?:\|[^}]+)?\}\}/g,(m,term)=>{if(!STY.glossary(term))termBad.push(term)});
  }));
  if(termBad.length)console.log('    термины без определения:',termBad.join(', '));
  checks.push(['история: у каждой главы «зачем смотреть» и «что делать», все термины объяснены',
    !whyMiss.length&&!termBad.length&&/<div class="st-why">/.test(A.go('monitor','both'))&&
    /<span class="term" tabindex="0"/.test(A.go('monitor','both'))]);
  /* у каждой под-вкладки — своя глава с вопросом */
  const qMiss=D.BLOCKS.flatMap(b=>SC.blocks[b.key].subTabs.filter(t=>!STY.Q[b.key]||!STY.Q[b.key][t[0]]).map(t=>b.key+'/'+t[0]));
  checks.push(['история: у каждой под-вкладки есть вопрос главы',!qMiss.length]);
  /* экран: степпер на все главы, текущая отмечена, вывод и колонка на месте */
  const to=A.go('turnover','dynamics');
  const nSteps=(to.match(/class="st-step[^"]*" data-subtab=/g)||[]).length;
  checks.push(['история: степпер на все вкладки блока, текущая отмечена, «вкладка 1 из 3» в шапке',
    nSteps===SC.blocks.turnover.subTabs.length&&/class="st-step on" data-subtab="dynamics"/.test(to)&&
    /вкладка 1 из 3/.test(to)&&/<div class="st-head"><h3>/.test(to)&&/<aside class="st-rail">/.test(to)&&
    !/class="st-next"/.test(to)]);
  /* цифры вывода — те же, что на графике */
  const rl=D.reportLeaves(st0), n12=D.aggregate(rl,'attrition').reduce((a,b)=>a+b,0);
  checks.push(['история: число уходов в выводе сходится с суммой баров графика',
    to.indexOf('<b>'+D.fmtInt(n12)+'\u00a0')>=0]);
  /* акценты на графике: заметка «пик года» на полосе, остальное НЕ приглушено
     (13.10: «всё остальное стало нечитабельным») */
  checks.push(['история: пик подписан на графике полосой, прочие месяцы не приглушены',
    />пик года<\/text>/.test(to)&&!/fill-opacity="\.38"/.test(allHtml)]);
  /* 16.10, заказчик: «не нужно затенять 2026 год — он весь одного цвета, инсайты выделяй
     по-другому». Бары этого года в одной панели — одной заливкой (цвет легенды); акцент —
     контур основным цветом и светлая полоса за месяцем. */
  const mainFills=[...to.matchAll(/<path d="[^"]*" fill="([^"]+)" class="bar up" data-s="main"( stroke="[^"]+")?/g)];
  checks.push(['бары этого года одного цвета; акцент — контуром и полосой, а не другой заливкой',
    mainFills.length>=6&&new Set(mainFills.map(m=>m[1])).size===1&&mainFills.some(m=>m[2])&&
    mainFills.filter(m=>m[2]).length<mainFills.length]);
  /* динамика — только линии: баров «год к году» нет нигде */
  /* 14.10: счётные потоки — барами; 15.10: прошлый год — тем же цветом, шире и почти
     прозрачно позади бара этого года; обычный бар прошлого — только если этот год выключен */
  checks.push(['потоки год к году — бары этого года, прошлый — прозрачный бар позади',
    /class="bar up" data-s="main"/.test(allHtml)&&/class="bar up ghost" fill-opacity="0?\.18" data-s="prev"/.test(allHtml)&&
    !/class="tick"/.test(allHtml)&&
    !/class="bar (up|dn)"[^>]*data-s="prev"/.test(allHtml)&&!G.C_GHOST&&
    D.METRICS.filter(m=>m.flow).map(m=>m.key).sort().join()==='attrition,hire,tgrowth_deny,tgrowth_pass,transfer_in,transfer_out,vac_closed']);
  /* разрыв с базой залит светофором хотя бы на одной главе */
  checks.push(['история: разрыв линии с базой залит цветом светофора',/class="gapf"/.test(allHtml)]);
  /* палитра A: одиночные метрики — кобальтом, цвет только у потоков */
  checks.push(['палитра «смысловая»: одиночные метрики — кобальтом, потоки — насыщенными тонами',
    G.C_VAC===G.C_LINE&&G.C_UNDER===G.C_LINE&&G.C_REVIEW===G.C_LINE&&G.C_AI===G.C_LINE&&
    G.C_HIRE==='#14A38B'&&G.C_FIRE==='#8A4FD8']);
  /* бары и полосы — мягкие ступени (13.10): водопад, полосы таблиц */
  const bal=A.go('movement','balance'), rsn2=A.go('turnover','reasons');
  checks.push(['бары мягкие: водопад мятный/сиреневый, полосы таблиц мягкие',
    G.soft(G.C_IN)==='#66C8AE'&&G.soft(G.C_OUT)==='#A88AD9'&&/fill="#66C8AE"[^>]*class="bar up"/.test(bal)&&
    /fill="#A88AD9"[^>]*class="bar up"/.test(bal)&&!/fill="#14A38B"[^>]*class="bar/.test(bal)&&
    /background:#A88AD9/.test(rsn2)&&!/background:#8A4FD8/.test(rsn2)&&/--bar-soft:#7FA2E6/.test(css)]);
  /* жирное в тексте истории собирается только через richText — без сырой разметки */
  checks.push(['история: текст экранируется, жирное — только через **…**',
    U.richText('a<b>**x**')==='a&lt;b&gt;<b>x</b>']);
  A.go('onepager',null);
})();

/* 13.10: только «год к году» и «Что видно» по механике HRBP HUB */
(function(){
  const I=window.TPINSIGHTS;
  checks.push(['переключателя «12 мес / Год к году» нет нигде: ни кнопок, ни состояния, ни стилей',
    !/data-dyn=|dyn-switch/.test(allHtml)&&!/dyn-switch/.test(css)&&!('dyn' in D.DEFAULT_STATE)&&!U.dynSwitch]);
  /* все графики динамики детальных вкладок стоят на оси года: у колонок месяца
     data-mi 0–11, скользящих видов в движке больше нет */
  checks.push(['скользящих графиков в движке нет: только год к году, водопад, календарь',
    !G.SERIES.line&&!G.SERIES.bars&&!G.SERIES.funnel&&/data-mi="11"/.test(A.go('turnover','dynamics'))&&
    /data-mi="11"/.test(A.go('movement','dynamics'))&&/data-mi="11"/.test(A.go('hiring','vacancies'))]);
  const S0=D.DEFAULT_STATE, rl0=D.reportLeaves(S0), bl0=D.benchmarkLeaves(S0);
  const ov=I.overview(S0,rl0,bl0), op=A.op([]);
  checks.push(['one-pager: «Что видно в данных» над таблицами, факты ведут к строкам метрик',
    /<div class="ai insight obs sev-/.test(op)&&ov.length>0&&ov.length<=I.OBS.max&&
    ov.every(x=>D.METRIC_BY_KEY[x.key]&&x.lead&&['high','mid','good'].indexOf(x.sev)>=0)&&
    (op.match(/class="obs-li" data-opfact="/g)||[]).length===Math.min(3,ov.length)]);
  /* раскрытая строка: номера пунктов «Что видно» = номерные отметки на полотне */
  const keys=['turnover_y','attrition','hire_plan','hc_total','regret'];
  const opened=A.op(keys);
  const lis=[...opened.matchAll(/<li data-mk="(\d+)" data-mi="(\d+)"/g)].length;
  const mks=[...opened.matchAll(/<g class="mk fade" data-mk="(\d+)" data-mi="(\d+)"/g)].length;
  checks.push(['раскрытая строка: график «год к году» + «Что видно» + «О метрике», номера пунктов = отметки',
    (opened.match(/<div class="op-story" data-oplink="1">/g)||[]).length===keys.length&&
    /<div class="op-sth">Что видно<\/div>/.test(opened)&&/<div class="op-sth">О метрике<\/div>/.test(opened)&&
    lis>=keys.length+2&&lis===mks&&!/12 мес и (база|цель)/.test(opened)]);
  /* каждый пункт подсвечивает свои месяцы: полосы связки есть на 0–11 */
  checks.push(['связка пункт ↔ график: у полотна полосы месяцев, у пунктов — их месяцы',
    (opened.match(/class="mkb" data-mi="/g)||[]).length===12*keys.length&&
    [...opened.matchAll(/<li[^>]* data-mi="([\d,]*)"/g)].every(m=>m[1].split(',').every(i=>i===''||(+i>=0&&+i<12)))]);
  const st=I.yoyStory('turnover_y',S0,rl0,bl0);
  checks.push(['факты метрики: номера слева направо, без двух отметок в одну точку',
    st.marks.length>=2&&st.marks.every((m,i,a)=>!i||a[i-1].i<m.i||(a[i-1].i===m.i&&a[i-1].s==='main'&&m.s==='prev'))&&
    new Set(st.marks.map(m=>m.i+m.s)).size===st.marks.length&&!/п\.п\.\./.test(st.items.map(x=>x.html).join(''))]);
  /* короткая динамика One-pager — одним видом: спарклайн у каждой метрики,
     баров-спарклайнов нет; у метрик с оценкой точки месяцев цветом светофора */
  const cells=[...op.matchAll(/<td class="col-spark">([\s\S]*?)<\/td>/g)].map(m=>m[1]);
  /* 14.10: точек нет ни в колонке, ни в KPI-карточках — они есть в раскрытом графике */
  const dotRe=/<path d="M[\d. ]+h0" stroke="[^"]+" stroke-width="(4|6)"/;
  const cardsH=(op.match(/<div class="kpis[\s\S]*?<div class="legend/)||[''])[0];
  checks.push(['короткая динамика One-pager — только линии-спарклайны, без точек (и в KPI-карточках)',
    !G.sparkBars&&cells.length>20&&cells.every(c=>/<svg[^>]*class="spark"/.test(c)&&!/class="sb"/.test(c)&&!dotRe.test(c))&&
    /vector-effect="non-scaling-stroke"/.test(cells[0])&&cardsH.length>0&&!dotRe.test(cardsH)]);
  /* сравнение с базой в KPI-карточках — только у «Проникновения AI», подпись «по компании» */
  checks.push(['KPI-карточки: «по компании» только у «Проникновения AI», «база» нигде',
    (cardsH.match(/по компании /g)||[]).length===(D.metricVisible('ai_penetration',S0)?1:0)&&!/>база /.test(cardsH)&&
    !/>база /.test((A.go('ai','adoption').match(/<div class="kpis[\s\S]*?<\/div><\/div><\/div>/)||[''])[0])]);
  A.op([]);
})();

/* 14.10: «Портрет команды» — первая глава структуры: три графика с выводами,
   клик по куску — срез, рассказ пересчитывается под срез */
(function(){
  A.mix([]);
  const pt=A.go('structure','portrait');
  /* 15.10: два обзора в стиле портрета — сверху обзор (пилюля), ниже разбивка */
  const wk=A.go('structure','work');
  /* 16.10: разделы — в двух колонках, выровненных по высоте (pt-cols), без пустот между
     ними; «Пол» и «Возраст» — отдельными разделами, «Тип договора» — своим */
  /* 20.10, вариант E: «Кто в команде?» — 3 раздела (квалификация, опыт, «Пол и возраст»), легенды
     под шкалой нет — тонкая полоса базы, края шкалы; грейды — столбиками (вариант D) */
  checks.push(['обзоры: «Кто в команде?» — 3 раздела без легенды, грейды столбиками, «Как оформлены и где?» — 5; у каждого вывод; куски кликаются',
    (pt.match(/<section class="pt-s/g)||[]).length===3&&(pt.match(/<h4>/g)||[]).length===3&&/<h4 class="pt-h2">/.test(pt)&&
    />Пол и возраст</.test(pt)&&!/class="pt-key seg"/.test(pt)&&/class="pt-thin"/.test(pt)&&/class="pt-ends"/.test(pt)&&
    /<div class="pt-cols"><section/.test(pt)&&/<div class="pt-cols"><section/.test(wk)&&!/class="pt-2"/.test(pt+wk)&&
    /data-mix="contract:/.test(wk)&&
    (pt.match(/<span(?: class="[^"]*")? data-mix="seniority:[^"]*" style="flex:[^"]*;background:var\(--pt-s\d\)"/g)||[]).length===4&&
    (pt.match(/<div class="bar" data-mix="grade:/g)||[]).length===5&&/class="pt-col gr"/.test(pt)&&
    (pt.match(/class="pt-man t\d"/g)||[]).length===10&&
    /class="a" data-mix="gender:f"/.test(pt)&&(pt.match(/<i class="[fm]" data-mix="age:a\d+,gender:[fm]"/g)||[]).length===8&&
    /Типичный человек в команде — /.test(pt)&&
    (wk.match(/<section class="pt-s/g)||[]).length===5&&(wk.match(/<h4>/g)||[]).length===5&&
    /<span class="a" data-mix="employment:tk"/.test(wk)&&/<span class="b" style/.test(wk)&&
    (wk.match(/<tr class="urow[^"]*" data-mix="employment:/g)||[]).length===4&&
    (wk.match(/<div class="[^"]*" data-mix="worksite:/g)||[]).length===3&&
    (wk.match(/<tr class="urow[^"]*" data-mix="region:/g)||[]).length===7&&
    (wk.match(/<tr class="urow[^"]*" data-mix="legal:/g)||[]).length===4]);
  /* 16.10, заказчик: «юрлиц и регионов на высоких уровнях будет очень много — брать топ».
     Матрица: длинная ось — 8 + «Остальные» (не срез), сумма та же; стримы ушедших — 8 строк. */
  {
    const S0=A.st(), r0=S0.mixRows, c0=S0.mixCols;
    S0.mixRows='spec';S0.mixCols='stream';
    const cu=A.go('structure','custom');
    S0.mixRows=r0;S0.mixCols=c0;
    const body=((cu.split('class="ptable mxtable')[1]||'').split('<tbody>')[1]||'').split('</tbody>')[0], nRows=(body.match(/<tr/g)||[]).length;
    const tot=(cu.match(/<tr class="total">[\s\S]*?<td class="mx-tot">([^<]+)</)||[])[1];
    const hcAll=D.fmtInt(Math.round(D.lastVal(D.reportLeaves(A.st()),'hc_total')));
    const who=A.go('turnover','who'), st=(who.split('bt-group').find(x=>/>Стрим</.test(x))||'');
    checks.push(['длинные разрезы — топ: матрица 8 + «Остальные» (не срез), сумма та же; стримы ушедших — не больше 8',
      D.MIX_BY_KEY.spec.cats.length>9&&nRows===10&&/class="mx-pick mx-rest row"/.test(cu)&&!/data-mix="null/.test(cu)&&
      tot===hcAll&&(st.match(/<tr/g)||[]).length<=10]);
  }
  /* 16.10, заказчик: «почему тут пустые точки без линии?» — скрытая линия была
     постоянным свойством .ln, а не кадром анимации: без анимации (скриншот, печать,
     PDF) год оставался кружками без линии. Скрыта — только в @keyframes. */
  checks.push(['линия года видна и без анимации: stroke-dashoffset:1 только в @keyframes',
    /\.svgchart\.anim\.ln\{stroke-dasharray:1;animation:tp-draw/.test(css)&&
    (css.replace(/\/\*[\s\S]*?\*\//g,'').match(/stroke-dashoffset:1/g)||[]).length===1&&/@keyframestp-draw\{from\{stroke-dashoffset:1\}/.test(css)]);
  /* 16.10, заказчик: «все таблицы и вертикальные списки с барчартами — одинаковая
     высота строки и одинаковое форматирование». Списки портрета и «Где сосредоточено» —
     та же таблица-разбивка; строка, полоса и шрифт — один стандарт в конце styles.css. */
  const cssStd=css.replace(/\s+/g,'');
  checks.push(['одна строка на весь отчёт: списки с полосами — таблица-разбивка, высота 36px, полоса одна, старых правил нет',
    /<table class="ptable btable lite pt-tb">/.test(wk)&&/<table class="ptable btable lite st-focus">/.test(A.go('turnover','dynamics'))&&
    /:root\{--row-h:36px;--row-sec-h:28px;--bar-h:10px;--bar-r:2px;/.test(cssStd)&&
    /#view\.ptable>tbody>tr>td\{height:var\(--row-h\)/.test(cssStd)&&
    !/\.pt-hb\{|\.pt-row|height:40px;padding-top:4px|\.btable\.lite\.cellbar\{height:8px|\.st-focustd\.bari/.test(cssStd)]);
  A.mix(['seniority:s']);
  const ps=A.go('structure','portrait');
  const n=(ps.match(/(\d+)\s+человека?<\/b>\s+в срезе/)||[])[1];
  const S0=A.st(), rl=D.reportLeaves(S0);
  const want=D.mixParts(rl,'gender',['seniority:s']).reduce((a,b)=>a+b,0);
  checks.push(['портрет под срезом: «В срезе «Senior»», численность среза, выбранное выделено, матрица = разбивке',
    /В срезе «Senior» типичный человек — Senior-/.test(ps)&&+n===want&&/Выбран «Senior»/.test(ps)&&
    /class="dk on(?: big)?" data-mix="seniority:s"/.test(ps)&&!/class="[^"]*\bon(?: big)?" data-mix="seniority:/.test(pt)&&
    (()=>{const m=D.mixMatrix(rl,'age','gender',['seniority:s']), g=D.mixParts(rl,'gender',['seniority:s']);
      return m.reduce((a,r)=>a+r[0],0)===g[0]&&m.reduce((a,r)=>a+r[1],0)===g[1]})()]);
  A.mix([]);
})();

/* 14.10: «в разработке» видно в макете — метрики, главы, блоки, сводка готовности */
(function(){
  const op=A.op([]), nav=A.nav();
  const devK=D.METRICS.filter(m=>D.isDev(m.key)).map(m=>m.key);
  checks.push(['«в разработке»: у метрик без источника метка с этапом, у живых — нет',
    devK.length>5&&devK.every(k=>D.devStage(k)!=null)&&!D.isDev('hc_total')&&!D.isDev('turnover_m')&&
    !D.isDev('office_att')&&(op.match(/class="dev-tag"/g)||[]).length>=devK.length&&!/demo-tag/.test(op)]);
  checks.push(['«в разработке»: сводка готовности на One-pager с планом этапов',
    /class="dev-sum"/.test(op)&&new RegExp('<b>'+(D.METRICS.length-devK.length)+' из '+D.METRICS.length+'</b>').test(op)&&
    (op.match(/<tr class="plan-(live|dev|todo|extra)">/g)||[]).length===D.DEV_PLAN.reduce((a,g)=>a+g.rows.length,0)]);
  /* 15.10: план — каталог графиков HQ и УС; у каждой строки «для кого» и статус */
  const pn=D.planCount();
  checks.push(['план по каталогу: у строк «для кого» и статус, есть что добавить и что решить',
    D.DEV_PLAN.every(g=>g.rows.every(r=>D.AUD_LABEL[r.aud]&&D.PLAN_NOW[r.now]&&(r.now!=='dev'||D.devPlan(r.stage))))&&
    pn.todo>0&&pn.extra>0&&/ещё добавить/.test(op)&&/class="aud-tag hq"/.test(op)&&/class="aud-tag us"/.test(op)&&
    !/[Вв]оронка найма|[Лл]оу-перформ|[Пп]рогноз текучести/.test(op)]);
  checks.push(['«в разработке»: в навигации блок целиком (AI, офис нет — посещаемость живая) и частично',
    /data-tab="ai"[^>]*>[\s\S]*?nav-dev full/.test(nav)&&/data-tab="hiring"[^>]*>[\s\S]*?nav-dev part/.test(nav)&&
    !/data-tab="movement"[^>]*>[^<]*<span class="ico[^"]*"><\/span>[^<]*<span class="nav-dev/.test(nav)&&SC.blockDev('office')==='part']);
  const hv=A.go('hiring','vacancies'), hp=A.go('hiring','plan'), mv=A.go('movement',null);
  checks.push(['«в разработке»: плашка вкладки — источник и «что нужно» по-человечески, шаги степпера помечены',
    /class="dev-note"[\s\S]*?источник: данные о вакансиях[\s\S]*?Что нужно:/.test(hv)&&/class="dev-note part"/.test(hp)&&
    /st-step[^"]*dev-full/.test(hv)&&/st-step[^"]*dev-part/.test(hv)&&!/dev-note/.test(mv)]);
})();

/* ============================================================================
   15.10 — редполитика (TEXT_GUIDE.md): тексты для руководителя. Во всём, что
   видно на экране и в подсказках, — ни технических имён (таблицы, поля, «макет»,
   «заглушка»), ни старых названий метрик. Сканируются все вкладки, One-pager
   с планом, шапка и статичные окна index.html.
   ========================================================================== */
(function(){
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<script[\s\S]*?<\/script>/g,'');
  const text=allHtml+A.chips()+html;
  if(process.env.TP_DUMP)fs.writeFileSync(process.env.TP_DUMP,text);
  const BAN=[/hr_structure_overall|vacancy_daily|plan_fact_tf|atributy_nayma|junior_ratio|ys_all_fire|initiative_reason|mdm_employee|review_digest|review_table|sigareta|penetration_(unit|company)|office_visit_amt|work_day_amt|grt_[a-z]+_cnt|fire_initiative|fire_reason|mapping_channel|summary_score|management_head/,
    /заглушк|демо-данн|в макете|на проде|сгенерирован|ответ 0а|SOURCES\.md|ClickHouse|Helicopter|датасет/i,
    /Нежелательная текучесть|Прошли T-рост|Отказано в T-росте|Тип занятости|Дистанционно|Штат \(ТК РФ\)|Time-to-fill|[Лл]оу-перформ|Прогноз (годовой )?текучести/,
    /степпер|[Пп]озитивное направление|Снять разрез|Сбросить разрезы|глава \d+ из/];
  const hits=[];
  BAN.forEach(re=>{const m=text.match(new RegExp(re.source,re.flags.replace('g','')+'g'));if(m)hits.push(...new Set(m))});
  if(hits.length)console.log('    найдено:',hits.slice(0,12).join(' | '));
  checks.push(['тексты для руководителя: без технических имён и старых названий (TEXT_GUIDE.md)',!hits.length]);
  /* одно понятие — одно название: имя метрики в карточке, таблице и подсказке берётся из METRICS */
  const names=D.METRICS.map(m=>m.name);
  checks.push(['словарь: названия метрик уникальны и совпадают с TEXT_GUIDE.md',
    new Set(names).size===names.length&&
    names.every(n=>fs.readFileSync(path.join(__dirname,'TEXT_GUIDE.md'),'utf8').indexOf('| '+n+' |')>=0)]);
  /* подсказка не одним куском: абзацы и списки собираются конструктором */
  checks.push(['подсказки умеют абзацы и списки',
    /t-li/.test(text)&&/class=&quot;t-x&quot;&gt;[^&]*&lt;\/span&gt;&lt;span class=&quot;t-x/.test(text)]);
})();

checks.forEach(([name,ok])=>{if(!ok)bad++;console.log((ok?'  ok  ':'  FAIL')+'  '+name)});

console.log();
console.log(bad?('ПРОВАЛОВ: '+bad):'все экраны собрались, правила соблюдены');
process.exit(bad?1:0);

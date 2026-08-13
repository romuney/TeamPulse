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
  querySelectorAll(){return[]},
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
['data.js','draw.js','ui.js','insights.js',
 'screens/_block.js','screens/structure.js','screens/movement.js','screens/turnover.js',
 'screens/hiring.js','screens/tgrowth.js','screens/monitor.js','screens/office.js',
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
  /* срез состава живёт в S, но кликом его ставит обработчик — зовём его напрямую */
  '\n  mix:list=>{S.mixSel=(list||[]).slice()},'+
  '\n  mixClick:spec=>{toggleMix(spec);return S.mixSel.slice()},'+
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

/* 1. ось значений всегда от нуля */
const uw=D.aggregate(rl,'underwork');
const svgUW=G.chart('line',{metricKey:'underwork',series:uw},{h:280});
/* у точек есть class="dot" ПЕРЕД cx, и старый регекс `<circle cx=` не ловил ничего:
   массив был пуст, и обе проверки оси проходили вакуумно. Ищем cy где бы он ни стоял. */
const ys=[...svgUW.matchAll(/<circle[^>]*\scy="([\d.]+)"/g)].map(m=>+m[1]);
checks.push(['проверка оси видит точки: их ровно по числу месяцев',ys.length===D.N]);
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

/* 6. дивергентный чарт: один бар, разрезанный осью, а не два рядом */
const dv=G.chart('diverge',{up:D.aggregate(rl,'hire'),down:att,upKey:'hire',downKey:'attrition'},{h:300});
const xUp=[...dv.matchAll(/<path d="M([\d.]+) [^>]*class="bar up"/g)].map(m=>+m[1]);
/* низ дивергента тоже path: у бара вниз скругляется нижний край */
const xDn=[...dv.matchAll(/<path d="M([\d.]+) [^>]*class="bar dn"/g)].map(m=>+m[1]);
checks.push(['дивергент: приход и уход на ОДНОЙ вертикали',
  xUp.length===D.N&&xDn.length===D.N&&xUp.every((x,i)=>Math.abs(x-xDn[i])<0.01)]);

/* 7. цифры на графиках чёрные: за смысл отвечает цвет бара, а не подписи */
const LOUD=/fill="#(f51f1f|12b048|d11414|0a8f3c)"/;
checks.push(['подписи значений не красятся светофором',!LOUD.test(dv)&&!LOUD.test(svgUW)]);

/* 8. стандартных title-тултипов в отчёте больше нет — только наши data-tip */
checks.push(['ни одного стандартного title=',!/\stitle="/.test(allHtml)]);
checks.push(['кастомные тултипы есть на каждом экране',
  (allHtml.match(/data-tip="/g)||[]).length>200]);

/* 9. светофор: два цвета плюс серый, жёлтого нет нигде */
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8').replace(/\s+/g,'');
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
  checks.push(['карточка KPI всегда из четырёх строк',
    (function(){
      const cards=mvHtml.match(/<div class="kpi">[\s\S]*?<\/div><\/div>/g)||[];
      return cards.length===5&&cards.every(c=>(c.match(/<div class="k-row">/g)||[]).length===2);
    })()]);
  checks.push(['полоса KPI выровнена subgrid, а не надеждой на короткие заголовки',
    /\.kpi\{display:grid;grid-template-rows:subgrid;grid-row:span4;row-gap:0\}/.test(css)&&
    /@supports\(grid-template-rows:subgrid\)/.test(css)]);
  checks.push(['пять метрик движения персонала стоят пятью колонками',
    /class="kpis compact n5"/.test(mvHtml)&&/\.kpis\.n5\{grid-template-columns:repeat\(5/.test(css)]);
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
  const card=cards.filter(c=>/Regrettable/.test(c))[0]||'';
  const subs=(card.match(/<span class="k-sub">[^<]*</g)||[]).join('|');
  checks.push(['в hero-карточке метрики с KPI стоит цель, а базы нет',
    /цель 4,0%/.test(subs)&&!/база/.test(subs)&&/kpi-tag/.test(card)]);
  /* на раскрытом графике та же развилка: пороги KPI вместо линии базы */
  const line=SC.metricLine('regret',rl0,bl0,S0,{});
  checks.push(['у метрики с KPI на графике пороги цели, а не линия базы',
    /KPI /.test(line)&&!/class="lnb"/.test(line)]);
  /* без KPI (regret вне HQ) поведение прежнее: линия базы на месте */
  const S1=Object.assign({},S0,{paint:'Line'});
  checks.push(['без KPI метрика возвращается к сравнению с базой',
    !D.kpiFor('regret',S1)&&/class="lnb"/.test(SC.metricLine('regret',D.reportLeaves(S1),D.benchmarkLeaves(S1),S1,{}))]);
})();

/* Среднесписочная ушла из отчёта, но осталась знаменателем текучести;
   на её место в движении персонала встал прирост с начала года. */
checks.push(['среднесписочной численности нет среди метрик отчёта',
  !D.METRIC_BY_KEY['hc_avg']&&!/Среднесписочная/.test(allHtml)&&D.METRICS.length===19]);
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
checks.push(['состав разложен по группам плюс конструктор',
  subsOf('structure')==='qual,people,contract,stream,custom']);
checks.push(['срок закрытия больше не отдельная вкладка',
  subsOf('hiring')==='vacancies,funnel']);
checks.push(['T-рост собран в одну вкладку',subsOf('tgrowth')==='flow']);
checks.push(['офис — календарь, рейтинг, динамика',
  subsOf('office')==='calendar,offices,dynamics']);
/* неизвестная под-вкладка из старой ссылки не должна ломать экран */
checks.push(['неизвестная под-вкладка откатывается на дефолтную',
  A.go('hiring','speed').length>400&&A.go('tgrowth','conv').length>400]);

const balHtml=A.go('movement','balance'), flowHtml=A.go('movement','dynamics');
/* считаем графики, а не теги <svg>: иконка перехода на детальный дашборд — тоже svg */
const svgN=s=>(s.match(/class="svgchart/g)||[]).length;
checks.push(['баланс: динамика численности + водопад на одном экране',
  svgN(balHtml)===2&&/Общая численность, чел/.test(balHtml)&&
  /Из чего сложилось изменение/.test(balHtml)]);
checks.push(['потоки: наймоток сверху, переводы снизу',
  svgN(flowHtml)===2&&/Найм и отток, чел/.test(flowHtml)&&
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
checks.push(['выдуманные данные помечены сноской',
  /реального источника под ними пока нет/.test(calHtml)&&
  /реального источника под ними пока нет/.test(A.go('office','offices'))]);
const rank=D.officeRank(D.reportLeaves(D.DEFAULT_STATE));
checks.push(['рейтинг офисов: сумма людей = численность отбора, сортировка по посещаемости',
  rank.reduce((a,o)=>a+o.hc,0)===D.lastVal(D.reportLeaves(D.DEFAULT_STATE),'hc_total')&&
  rank.every((o,i)=>!i||rank[i-1].att>=o.att)]);
checks.push(['в рейтинге нет колонки «Доля»: доля процента в сумме процентов не считается',
  !/<th>Доля<\/th>/.test(A.go('office','offices'))]);

/* 12. выбор метрик пользователем: отключённое не должно попадать ни в строки
   one-pager, ни в столбцы сводной таблицы, ни в KPI-карточки */
A.hide(['transfer_in','transfer_out']);
const opHid=A.go('onepager',null), mvHid=A.go('movement','balance');
checks.push(['скрытая метрика не попала в строки one-pager',
  !/Переводы в команду/.test(opHid)&&/Найм/.test(opHid)]);
checks.push(['скрытая метрика не попала в столбцы сводной таблицы',
  !/Перев\. в/.test(mvHid)&&!/Переводы в команду/.test(mvHid)&&/Отток/.test(mvHid)]);

/* обязательные метрики численности не скрываются даже явным списком */
A.hide(['hc_active','hc_total']);
const opLock=A.go('onepager',null);
checks.push(['обязательные метрики численности не скрываются',
  /Активная численность/.test(opLock)&&/Общая численность/.test(opLock)&&
  D.metricVisible('hc_active',{hiddenMetrics:['hc_active']})]);

/* блок без единой выбранной метрики уходит из навигации, из one-pager и не открывается */
A.hide(D.metricsOfBlock('tgrowth').map(m=>m.key));
const opNoTg=A.go('onepager',null);
A.go('tgrowth','flow');
checks.push(['пустой блок исчез из one-pager',!/T-рост/.test(opNoTg)]);
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
  (allHtml.match(/t-v/g)||[]).length>100&&!/&lt;b&gt;/.test(allHtml)]);
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
  const line=G.chart('line',{metricKey:'turnover_m',series:D.aggregate(lp,'turnover_m'),
    bench:D.aggregate(bl,'turnover_m')},{benchName:'база'});
  const lt=tipsOf(line)[0]||'';
  checks.push(['база в подсказке помечена как bench и красится серым',
    (lt.match(/t-r bench/g)||[]).length===1&&/\.tip\.t-r\.bench\.t-v\{color:var\(--muted\)/.test(css)]);
  /* дивергент — две равнозначные метрики одного потока: ни одна не выделена */
  const dv=G.chart('diverge',{up:D.aggregate(lp,'hire'),down:D.aggregate(lp,'attrition'),
    upKey:'hire',downKey:'attrition'},{});
  const dt=tipsOf(dv)[0]||'';
  checks.push(['равнозначные метрики в подсказке не выделяются друг перед другом',
    (dt.match(/t-r bench/g)||[]).length===0&&(dt.match(/t-r&quot;/g)||[]).length===2]);
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

/* дивергент на одном плече: шкала перестраивается, последнюю серию не выключить */
(function(){
  const legend=[{name:'Приняли',color:G.C_IN},{name:'Уволились',color:G.C_OUT}];
  const up=D.MONTHS.map((m,i)=>10+i), down=D.MONTHS.map((m,i)=>4+i%3);
  const html=G.chart('diverge',{up,down,upKey:'hired',downKey:'left'},
    {title:'Проверка дивергента',legend,h:320});
  const cid=(html.match(/data-cid="(\w+)"/)||[])[1];
  const el=pick('.svgchart[data-cid="'+cid+'"]'); el.clientWidth=900;
  const zeroOf=s=>+((s.match(/<line x1="6" y1="([\d.]+)"[^>]*stroke="#c9cdd6"/)||[])[1]);
  const z0=zeroOf(html);
  G.toggleSeries(cid,'dn');
  const h1=el.innerHTML;
  checks.push(['выключенное плечо дивергента исчезает, а шкала перестраивается',
    !/class="bar dn"/.test(h1)&&/class="bar up"/.test(h1)&&zeroOf(h1)>z0]);
  checks.push(['выключенный пункт легенды помечен, последнюю серию выключить нельзя',
    /class="lg dead" data-sid="dn"/.test(h1)&&G.toggleSeries(cid,'up')===false]);
  G.toggleSeries(cid,'dn');           /* возвращаем оба плеча */
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
  /* ось X устроена одинаково во всех видах: подпись месяца на bot+15 везде */
  checks.push(['ось X у панелей на том же отступе, что у остальных графиков',
    !/axisX\([^)]*bot\+13\)/.test(js)]);
})();

/* ============================================================================
   Итерация 24: состав численности — группы разрезов, срез по клику, матрица
   ========================================================================== */
(function(){
  const dims=D.MIX_DIMS, byKey=D.MIX_BY_KEY;

  /* 1. Разрезов девять, и это реестр, а не ветки в if */
  checks.push(['разрезы состава объявлены списком: грейд, сеньорность, пол, возраст, стаж, занятость, формат, юрлицо, стрим',
    dims.map(d=>d.key).join(',')===
    'grade,seniority,gender,age,tenure,employment,worksite,legal,stream']);
  checks.push(['грейд и сеньорность — РАЗНЫЕ разрезы: числовой и текстовый',
    byKey.grade.cats.every(c=>/^Грейд \d$/.test(c.name))&&
    byKey.seniority.cats.map(c=>c.name).join(',')==='Junior,Middle,Senior,Lead и выше']);
  checks.push(['у каждой категории есть цвет и составной id «разрез:категория»',
    dims.every(d=>d.cats.every(c=>/^#[0-9a-f]{6}$/i.test(c.color)&&c.id===d.key+':'+c.key))]);

  /* 2. Раскладка по вкладкам: не больше трёх разбивок на одной */
  checks.push(['на вкладке состава не больше трёх разбивок',
    D.MIX_GROUPS.every(g=>g.dims.length<=3&&g.dims.length>0)]);
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
  checks.push(['выдуманные связи названы в сноске под матрицей',
    /Связи между атрибутами в макете/.test(A.go('structure','custom'))&&
    D.MIX_LINK_TEXT.length>20]);
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
  const qual=A.go('structure','qual');
  checks.push(['строка разбивки кликается: у неё есть data-mix',
    /<tr class="urow" data-mix="seniority:s"/.test(qual)&&
    /<tr class="urow" data-mix="grade:g1"/.test(qual)]);
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
    dims.forEach(d=>d.cats.forEach(c=>{
      const one=[c.id], card=D.fmtVal('hc_total',D.lastValSlice(rl,'hc_total',one));
      dims.filter(x=>x.key!==d.key).forEach(other=>{
        n++;
        if(card!==D.fmtVal('hc_total',D.mixParts(rl,other.key,one).reduce((a,b)=>a+b,0)))bad++;
      });
    }));
    checks.push(['карточка и ИТОГО разбивки под срезом дают одно число ('+n+' пар)',bad===0]);
  })();

  /* 6. Срез виден в карточках, в таблице подразделений и в плашке */
  A.mix(['seniority:s']);
  const sliced=A.go('structure','qual');
  checks.push(['срез подписан плашкой под карточками KPI',
    /note-inline slice/.test(sliced)&&/Срез состава/.test(sliced)&&
    /data-mixclear="1"/.test(sliced)]);
  checks.push(['карточка KPI показывает численность по срезу',
    new RegExp('<div class="k-val">'+D.fmtVal('hc_total',hcSen)+'</div>').test(sliced)]);
  const totRow=(sliced.match(/<tr class="total top">[\s\S]*?<\/tr>/)||[''])[0];
  checks.push(['ИТОГО таблицы подразделений тоже по срезу',
    totRow.indexOf('>'+D.fmtVal('hc_total',hcSen)+'<')>=0&&
    totRow.indexOf('>'+D.fmtVal('hc_total',hcAll)+'<')<0]);
  checks.push(['выбранная строка разбивки помечена',
    /<tr class="urow sel" data-mix="seniority:s"/.test(sliced)]);

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
  checks.push(['срез не растёт дальше двух атрибутов',
    (A.mixClick('gender:f'),A.mixClick('worksite:rem')).length===D.SLICE_MAX]);
  A.mix(['seniority:s']);
  checks.push(['повторный клик по взятой категории снимает её',
    A.mixClick('seniority:s').length===0]);
  checks.push(['ссылка переживает срез и оси конструктора',
    (A.mix(['seniority:s','gender:f']),/mix=seniority%3As%2Cgender%3Af/.test(A.link()))]);
  A.mix([]);

  /* 10. Мусор в ссылке не ломает экран */
  checks.push(['неизвестный разрез из ссылки выбрасывается',
    D.sliceParse(['nosuch:x','seniority:s','seniority:nope']).map(p=>p.id).join(',')==='seniority:s']);
})();

/* заголовки одной роли — один кегль: имя графика, имя панели и шапка бар-таблицы */
checks.push(['заголовки графиков и панелей одного кегля',
  /const TTL_SZ=12/.test(fs.readFileSync(path.join(dir,'draw.js'),'utf8'))&&
  /\.bt-cap\{[^}]*font-size:12px/.test(css)]);

/* токены: три шкалы в :root, литеральных цветов в экранах не осталось */
checks.push(['в :root есть шкала расстояний, роли кеглей и радиусы',
  /--s1:2px/.test(css)&&/--s10:24px/.test(css)&&
  /--fs-micro:9\.5px/.test(css)&&/--fs-hero:24px/.test(css)&&
  /--r1:3px/.test(css)&&/--r5:16px/.test(css)]);
checks.push(['третьей палитры нет: в экранах ни одного литерального цвета',
  fs.readdirSync(path.join(dir,'screens')).filter(f=>f.endsWith('.js'))
    .every(f=>!/#[0-9a-fA-F]{6}/.test(fs.readFileSync(path.join(dir,'screens',f),'utf8')))]);

checks.forEach(([name,ok])=>{if(!ok)bad++;console.log((ok?'  ok  ':'  FAIL')+'  '+name)});

console.log();
console.log(bad?('ПРОВАЛОВ: '+bad):'все экраны собрались, правила соблюдены');
process.exit(bad?1:0);

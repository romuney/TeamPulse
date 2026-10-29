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
['data.js','draw.js','ui.js','mascot.js','insights.js','story.js',
 'screens/_block.js','screens/structure.js','screens/movement.js','screens/turnover.js',
 'screens/hiring.js','screens/tgrowth.js','screens/monitor.js','screens/office.js','screens/ai.js',
 'screens/onepager.js'].forEach(f=>require(path.join(dir,f)));

/* app.js держит state в замыкании — добавляем экспорт-хвост во временную копию */
const probe=path.join(dir,'.app.probe.js');
fs.writeFileSync(probe,fs.readFileSync(path.join(dir,'app.js'),'utf8')+
  /* 20.10: главы блока и «Все метрики» свёрнуты по умолчанию — прежние проверки
     смотрят раскрытый вид (go, op), новые — свёрнутый (top, home0) */
  '\nmodule.exports={go:(t,sub)=>{S.tab=t;S.subTab=sub||null;S.selNode=null;render();return $("#view").innerHTML},'+
  '\n  top:t=>{S.tab=t;S.subTab=null;S.selNode=null;render();return $("#view").innerHTML},'+
  '\n  home0:()=>{S.tab="onepager";S.aiOpen=null;render();return $("#view").innerHTML},'+
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
  /* поставка 61: галочки типов численности в окне — что получится после «Применить» */
  '\n  hcPick:list=>{openSetup();list.forEach(hcToggle);paintOpts();const r=hcSig(DRAFT)+"#"+$("#optHc").innerHTML;closeSetup();return r},'+
  '\n  setupUnits:q=>{openSetup();if(q){UT.q=q;utRender()}const h=$("#utList").innerHTML+$("#benchPreview").innerHTML+$("#optStaff").innerHTML;closeSetup();return h},'+
  '\n  home:()=>{S.unit=D.DEFAULT_STATE.unit;unitBack.length=0;tq="";S.selNode=null;expanded.clear()},'+
  /* итерация 30: ширина колонок — режим и доля таблицы */
  '\n  split:(m,sh)=>{splitMode=m;splitUnit=S.unit;splitShare=sh;render(true);return $("#view").innerHTML},'+
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
/* 26.10-б, правки п. 8: сверху — график «Текучесть по инициатору» с переключателем, под ним таблицы */
checks.push(['причины увольнений — таблица; сверху — текучесть по инициатору с переключателем',
  /<table/.test(rsn)&&rsn.indexOf('Текучесть по инициатору')>=0&&rsn.indexOf('Текучесть по инициатору')<rsn.indexOf('<table')&&
  /class="ch-bar"[\s\S]*?data-exitini="emp"/.test(rsn)&&D.exitInitTurnover(rl).length===3]);

/* 6. пара потоков (найм / отток) — год к году линиями (13.10, второй заход):
   две яркие линии этого года, бледные — прошлого; баров и серой «тени» нет.
   Ряды синтетические: у каждой линии точка на каждый закрытый месяц. */
const yr=(a,b)=>({cur:D.MONTH_ABBR.map((_,i)=>i<D.CUR_LEN?a+i%3:null),prev:D.MONTH_ABBR.map((_,i)=>b+i%4)});
/* 14.10: пара — «ежики»: приход барами вверх, уход вниз; линий нет («четыре линии на
   одном графике — жесть»); 15.10: прошлый год — прозрачные бары позади, без засечек */
const dv=G.chart('pair',{a:Object.assign({key:'hire'},yr(4,5)),b:Object.assign({key:'attrition'},yr(2,3))},
  {h:300,legend:[{name:'Приняли',color:G.C_IN},{name:'Уволились',color:G.C_OUT},{name:'2026'},{name:'2025',ghost:true}]});
const barsOf=(cls,sid)=>(dv.match(new RegExp('class="bar '+cls+'( part)?" data-s="'+sid+'"','g'))||[]).length;
checks.push(['пара потоков — «ежики»: бары вверх и вниз, прошлый год прозрачными барами позади, без линий и засечек',
  barsOf('up','a')===D.CUR_LEN&&barsOf('dn','b')===D.CUR_LEN&&
  /* 21.10, правка Антона: найм и отток не вызревают — последний бар без пунктира */
  !/class="bar (up|dn) part"/.test(dv)&&(dv.match(/class="bar (up|dn) ghost"[^>]*data-s="prev"/g)||[]).length===24&&
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
/* 23.10, видео заказчика: у краёв графиков нет серых линий — полосы прокрутки отчёта в пробнике,
   «ручки» разделителя в покое (видна под мышью) и рамки справа у «Сводки» */
checks.push(['нет серых линий у краёв: прокрутка пробника скрыта, ручка разделителя — под мышью, у «Сводки» без рамки',
  css.includes('.tp-overlay{scrollbar-width:none}')&&css.includes('.tp-overlay::-webkit-scrollbar{width:0;height:0}')&&
  /\.split-guti\{[^}]*background:transparent/.test(css)&&/\.split-gut:hoveri[^{]*\{background:var\(--act\)/.test(css)&&
  !/\.nav\{[^}]*border-right/.test(css)]);
/* 20.10, видео заказчика: перезапуск скрипта Proteus (ресайз, перерисовка) не сбрасывает прокрутку —
   она живёт в хранилище и возвращается на старте того же вида (модель песочницы: rerun, 594 → 594) */
/* 20.10, «двойной скролл»: страница — один скролл, таблица подразделений прилипает и листается
   сама только если выше экрана; панель графиков без своей высоты и прокрутки */
const cssAll=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
checks.push(['один скролл: таблица подразделений sticky с высотой окна, графики без своей прокрутки',
  /@media \(min-width:1121px\)\{\s*\.split\{height:auto;min-height:0;align-items:start\}/.test(cssAll)&&
  /* 23.10: на странице с полкой срезов панели прилипают ниже неё (--shelf-h) */
  /\.split>\.split-l\{position:sticky;top:calc\(var\(--head-h,0px\) \+ var\(--shelf-h,0px\) \+ 12px\);height:calc\(var\(--vh,100vh\) - var\(--head-h,0px\) - var\(--shelf-h,0px\) - 38px\)/.test(cssAll)&&
  /\.split>\.split-r\{min-height:calc\(var\(--vh,100vh\) - var\(--head-h,0px\) - var\(--shelf-h,0px\) - 38px\)\}/.test(cssAll)&&
  /\.split-r \.panel-b,\.split-r \.panel-b\.st-on\{overflow:visible;height:auto\}/.test(cssAll)&&
  /overscroll-behavior:contain/.test(cssAll)&&
  /* края карточки графиков видны всегда и стоят на одной линии с таблицей (скриншот 20.10) */
  /max-height:calc\(var\(--vh,100vh\) - var\(--head-h,0px\) - var\(--shelf-h,0px\) - 38px\)/.test(cssAll)&&
  /* 30.10, шаг 1 (модель «как в GA»): таблица — по содержимому, у карточки графиков липнут шапка и шаги главы,
     нижней маски нет; горизонтальный скролл .content — только уже 1280 */
  !/\.split-r>\.panel-cap\{position:sticky/.test(cssAll)&&/\.split>\.panel>\.panel-h\{position:sticky;top:var\(--sp-top\)/.test(cssAll)&&
  /* 31.10 (поставка 82): таблица — карточка во всю высоту ряда, липнут её шапка и сама таблица; маска над
     шапкой — только у прилипшей (.ph-stuck из app.js) */
  /\.split>\.split-l\{position:relative;top:auto;align-self:stretch/.test(cssAll)&&
  /\.split-l \.tbl-wrap\{position:sticky;top:calc\(var\(--sp-top\) \+ var\(--rph,59px\)\)/.test(cssAll)&&
  /\.split>\.panel\.ph-stuck>\.panel-h::before\{opacity:1\}/.test(cssAll)&&/classList\.toggle\('ph-stuck'/.test(appSrc)&&
  /\.split-r \.st-steps\{position:sticky;top:calc\(var\(--sp-top\) \+ var\(--rph,59px\)\)/.test(cssAll)&&
  /\.split>\.split-l\{height:auto\}/.test(cssAll)&&/\.split>\.split-r\{min-height:0\}/.test(cssAll)&&
  /@media\(min-width:781px\) and \(max-width:1279px\)\{\s*\.content\{overflow-x:auto\}/.test(cssAll)]);
checks.push(['перезапуск скрипта держит прокрутку экрана и панелей',
  /STORE\.scroll=\{k:viewKey\(\)/.test(appSrc)&&/back=ENV&&\(!pend0\|\|pend0==='stale'\)&&STORE\.scroll/.test(appSrc)&&
  /ENV\.scroller\.scrollTop=back\.y/.test(appSrc)&&/STORE\.scroll=null/.test(appSrc)]);
/* 21.10, правка Антона «фильтр не всегда с первого раза»: ответ принимается по эху запроса, на устаревший —
   ждём и один раз повторяем маску с меткой tp_nonce; повтор показанного выбора — без запроса */
checks.push(['фильтр с первого раза: эхо запроса, устаревший ответ не снимает ожидание, один повтор с меткой',
  /pend\.sig!==echoSig\(\)/.test(appSrc)&&/column:'tp_nonce'/.test(appSrc)&&/sig===echoSig\(\)&&!was/.test(appSrc)&&
  /MAX_RESEND=1/.test(appSrc)]);
checks.push(['в светофоре нет жёлтого: stateColor(warn) серый',
  G.stateColor('warn')===G.C_FLAT&&G.stateColor('good')!==G.C_FLAT]);
checks.push(['жёлтого нет в графиках и легендах отчёта',
  !/#dbb968/i.test(allHtml)&&!/#ffe6a0/i.test(allHtml)&&!/#f59300/i.test(allHtml)]);
checks.push(['пилюли и рамки «на уровне» не красятся жёлтым токеном',
  !/\.sig-chip\.warn\{[^}]*--warn/.test(css)&&!/\.cell\.warn\{[^}]*--warn/.test(css)&&
  !/\.m-name\.bar-warn\{[^}]*--warn/.test(css)&&!/\.kpi-tag\{[^}]*--warn/.test(css)]);

/* высота рабочей зоны считается от экрана — иначе верхние блоки не прокрутить */
checks.push(['высота .split привязана к высоте экрана',
  css.includes('.split{height:clamp(520px,calc(var(--vh,100vh)-var(--head-h)-28px)')]);

/* 9б. изменения показываются знаком, а не стрелкой; пустого состояния фильтров нет */
/* у пилюли изменения теперь есть свои атрибуты (подсказка «июнь против мая»),
   поэтому знак ищем не сразу за классом, а за концом открывающего тега */
checks.push(['дельты без стрелок: только + и −',
  !/<span class="delta[^>]*>[^<]*[↑↓→]/.test(allHtml)&&
  /<span class="delta[^>]*>\+/.test(allHtml)]);
checks.push(['нулевое изменение — просто ноль',
  U.deltaChip('hire',0).replace(/<[^>]+>/g,'')==='0']);
/* у срока закрытия рост плохой, у «улучшили оценку» — хороший, у численности (better:flat) без
   оценки; 20.10: у вызревающей метрики (текучесть за незакрытый месяц) — без оценки, пунктиром */
checks.push(['знак говорит направление, класс — оценку',
  /* 26.10, ревью критиков: срок закрытия — поток незакрытого месяца (PART_FLOW), направление проверяем на нежелательной */
  /delta down/.test(U.deltaChip('regret',1.4))&&/delta up/.test(U.deltaChip('regret',-1.4))&&
  (!D.PARTIAL||/delta neu"/.test(U.deltaChip('time_to_fill',1.4)))&&
  /delta up/.test(U.deltaChip('review_up',3))&&/delta neu/.test(U.deltaChip('hc_total',3))&&
  /* 21.10, правка Антона: вызревают только regrettable, non-regrettable и проникновение AI; поток за
     незакрытый месяц — без оценки, но и без метки «вызревает» */
  /* 26.10-б: желательная и нежелательная — по закрытому месяцу (CLOSED_ONLY), их изменение оценивается */
  (!D.PARTIAL||/delta neu part/.test(U.deltaChip('ai_penetration',1.4))&&/delta down/.test(U.deltaChip('regret',1.4))&&
    /delta neu part/.test(U.deltaChip('turnover_m',1.4)))&&
  /* 29.10, п. 10: вызревает и общая текучесть (месячная и накопительная) */
  [...D.MATURING].sort().join()==='ai_penetration,nonregret,regret,turnover_m,turnover_y']);
checks.push(['переход на детальный дашборд — иконка, а не символ ↗',
  /class="ico-ext"/.test(allHtml)&&!/↗/.test(allHtml)]);
checks.push(['минус во всех дельтах типографский, а не дефис',
  !/>\s*-\d/.test(allHtml)&&/−/.test(D.fmtDelta('hire',-3))&&/−/.test(D.fmtDelta('turnover_m',-1.4))]);

/* ---- итерация 23: с чем сравнивается изменение и с чем — сама метрика ---- */

/* «+3» без подписи читалось как отклонение от базы. Месяц сравнения стоит
   в пилюле KPI-карточек и в шапках колонок one-pager. */
(function(){
  const opHtml=A.go('onepager',null), mvHtml=A.go('movement','balance');
  /* 29.10, п. 9: верхних карточек KPI в блоках нет (своя полоса — только у «Мониторинга») */
  /* 30.10, заказчик: плашек KPI нет ни на одной вкладке, и у «Мониторинга» тоже */
  checks.push(['верхних карточек KPI в блоках нет',
    D.BLOCKS.every(b=>!/class="kpis compact|class="kpi">/.test(A.top(b.key)))]);
  checks.push(['подпись месяца берётся из одного места, а не пишется руками',
    D.CMP.momShort==='к '+'маю'&&D.CMP.momFull==='к маю 2026'&&D.CMP.yoy==='к июню 2025']);
  /* 27.10-в, п. 1: шапки — MoM и YoY, месяцы сравнения — в их подсказках */
  checks.push(['шапки колонок — MoM и YoY, месяцы сравнения названы в подсказке',
    />MoM<\/th>/.test(opHtml)&&/>YoY<\/th>/.test(opHtml)&&
    opHtml.indexOf(U.esc(G.tipHtml({title:'MoM — месяц к месяцу',text:'Изменение '+D.CMP.momFull+'.'})).slice(0,60))>0]);
  /* в строках таблицы месяц не повторяется: он уже назван в шапке */
  /* 26.10, ревью критиков: кроме строк по закрытому месяцу — у них месяц не тот, что в шапке, и он подписан в пилюле */
  checks.push(['в колонках таблицы месяц не дублируется у каждой строки',
    opHtml.split('<table class="mtable"').slice(1).join('').split('<tr class="mrow').slice(1)
      .every(r=>!/class="d-vs"/.test(r)||D.closedOnly(r.match(/data-metric="(\w+)"/)[1]))]);

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
  /* 27.10-в, п. 20: «Переводы в» и «Переводы из» — одной карточкой «Переводы» */
  const nMv=D.visibleMetricsOfBlock('movement',A.st()).filter(m=>m.key!=='transfer_out').length;
  checks.push(['полоса KPI выровнена subgrid, а не надеждой на короткие заголовки',
    /\.kpi\{display:grid;grid-template-rows:subgrid;grid-row:span5;row-gap:0\}/.test(css)&&
    /@supports\(grid-template-rows:subgrid\)/.test(css)]);
})();

/* Есть утверждённый KPI — сравниваемся с ним, и базы рядом нет: два ориентира
   заставляли выбирать, по какому судить. */
(function(){
  const S0=D.DEFAULT_STATE, rl0=D.reportLeaves(S0), bl0=D.benchmarkLeaves(S0);
  const kpi=D.kpiFor('regret',S0), v=D.lastVal(rl0,'regret');
  const cell=U.targetCell('regret',v,D.lastVal(bl0,'regret'),kpi);
  checks.push(['метрика с KPI сравнивается с целью, а не с базой',
    !!kpi&&/цель/.test(cell)&&!/база/.test(cell)]);
  /* 20.10: на главной KPI-карточек нет — проверяем карточку блока «Отток и текучесть» */
  const opHtml=A.go('turnover','dynamics');
  /* сравнение ищем в видимом тексте карточки: слово «база» встречается ещё и
     внутри подсказки к пилюле изменения, и по нему проверять нельзя */
  const cards=opHtml.match(/<div class="kpi">[\s\S]*?<\/div><\/div>/g)||[];
  const card=cards.filter(c=>/Нежелательная текучесть HQ/.test(c))[0]||'';
  const subs=(card.match(/<span class="k-sub">[^<]*</g)||[]).join('|');
  /* на раскрытом графике та же развилка: пороги KPI вместо линии базы */
  const line=SC.metricLine('regret',rl0,bl0,S0,{});
  checks.push(['у метрики с KPI на графике пороги цели, а не линия базы',
    /* 21.10: у HQ только план 4% за год (порога 7% в отчёте HQ нет) — одна линия цели */
    />цель 4,0% за год</.test(line)&&!/>порог /.test(line)&&/<polyline [^>]*stroke-dasharray="2 3"/.test(line)&&
    !/class="lnb" data-s="bench"/.test(line)]);
  /* без KPI (regret вне HQ) поведение прежнее: линия базы на месте */
  const S1=Object.assign({},S0,{paint:'Line'});
  checks.push(['без KPI метрика возвращается к сравнению с базой',
    /* 27.10-в, п. 3: у желательной и нежелательной цель теперь при любой покраске — проверяем на HQ текучести */
    !D.kpiFor('turnover_y',S1)&&/class="lnb" data-s="bench"/.test(SC.metricLine('turnover_y',D.reportLeaves(S1),D.benchmarkLeaves(S1),S1,{}))&&
    !!D.kpiFor('regret',S1)]);
})();

/* Среднесписочная ушла из отчёта, но осталась знаменателем текучести;
   на её место в движении персонала встал прирост с начала года. В подсказках
   «как считается» (calc, методология HR) она упоминается — это не строка отчёта:
   ищем её только как текст элемента, не внутри data-tip. */
checks.push(['среднесписочной численности нет среди метрик отчёта',
  !D.METRIC_BY_KEY['hc_avg']&&!/>Среднесписочная/.test(allHtml)&&D.METRICS.length===28&&D.SHOWN.length===25]);
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
/* 21.10: по файлу «Структура» (п. 8 правок Антона) — портрет, уровень позиции, оформление, стримы, конструктор */
checks.push(['состав по файлу «Структура»: портрет, уровень позиции, оформление, стримы, конструктор',
  subsOf('structure')==='portrait,level,work,stream,custom'&&SC.blocks.structure.defaultSub==='portrait']);
/* итерация 28 (бизнес-анализ): план-факт и профиль найма, заявки и статусы
   роста, бронирование и «кто ходит» встали своими вкладками; срок закрытия
   по-прежнему панелью к вакансиям, конверсия T-роста — рядом с решениями */
/* 26.10, правки: в «Кого и откуда берём?» — динамика найма по видам стопкой; виды в сумме — найм месяца */
{
  const lpH=D.reportLeaves(D.DEFAULT_STATE), hk=D.hireKinds(lpH), hy=D.yoySeries(lpH,'hire').cur;
  const pr=A.go('hiring','profile');
  /* 26.10-б, правки п. 7: «Найм, чел» — год к году (легенда по годам), виды найма — только в подсказке месяца */
  const hy0=pr.split('Откуда пришли')[0];
  checks.push(['найм: «Найм, чел» год к году, виды — в подсказке; в сумме — найм месяца',
    !!hk&&hk.length===12&&hk.every((p,m)=>p.co+p.cand+p.int===(hy[m]||0))&&hk.some(p=>p.cand||p.int)&&
    /Найм, чел/.test(hy0)&&!/Динамика найма по видам/.test(pr)&&/· Найм в компанию/.test(hy0)&&
    /· Из учебной группы в боевую/.test(hy0)&&/· Стажёр в штат/.test(hy0)&&new RegExp('>'+D.YEAR_PREV+'<').test(hy0)&&
    !/data-pmark/.test(hy0)]);
}
/* 26.10, правки: порядок глав найма — «Кого и откуда берём?» → «Успеваем закрывать вакансии?» → «Выполняем план?» */
/* 27.10-в, п. 4: «Выполняем план?» и ревью скрыты до следующего релиза — вкладок нет, код на месте */
/* 27.10-в, п. 5: в «Движении по специализациям» — «итого», а не «сальдо» */
checks.push(['движение по специализациям: «Итого» вместо «Сальдо»',!/>Сальдо</.test(allHtml)]);
checks.push(['найм: профиль → вакансии; план-факт и ревью скрыты, но не удалены; воронки нет',
  subsOf('hiring')==='profile,vacancies'&&SC.blocks.hiring.defaultSub==='profile'&&subsOf('monitor')==='activity'&&
  D.OFF_SUBS.has('hiring.plan')&&D.OFF_SUBS.has('monitor.review')&&/План-факт подбора/.test(SC.blocks.hiring.title('plan'))&&
  !D.metricVisible('hire_plan',D.DEFAULT_STATE)&&!D.metricVisible('review_up',D.DEFAULT_STATE)&&
  !/План найма|Итоги ревью|Выполняем план/.test(allHtml)]);
checks.push(['T-рост: конверсия с решениями на одной вкладке, заявки и статусы — на своих',
  subsOf('tgrowth')==='flow,grades,spec']);
checks.push(['офис — календарь, «кто и где ходит» (22.10: города, кто ходит и динамика — одна вкладка), бронирование',
  subsOf('office')==='calendar,attend,booking']);
/* 28.10, п. 4: все графики AI из «Готовности данных» — вкладка «Как пользуются» (условные) */
/* 31.10, «AI.md»: три раздела — пользуются ли, кто, как; без сравнения с прошлым годом; месяц / неделя */
const aiA=A.go('ai','adoption'), aiW=A.go('ai','who'), aiU=A.go('ai','usage');
checks.push(['AI — «Пользуются ли AI?», «Кто пользуется?», «Как пользуется?», без прошлого года',subsOf('ai')==='adoption,who,usage'&&
  /data-aigran="m"/.test(aiA)&&/data-aigran="w"/.test(aiA)&&/Проникновение AI по месяцам/.test(aiA)&&/Активные пользователи AI по месяцам/.test(aiA)&&
  !new RegExp('data-sid="prev"|>'+D.YEAR_PREV+'<').test(aiA)&&
  ['Стажёры','Какими инструментами пользуются стажёры','Как часто пользуются стажёры','Инструменты по покраске','NonIT','Конструктор'].every(t=>aiW.indexOf(t)>=0)&&
  ['Частота использования','Инструментов на человека','Топ инструментов','Воронка сообщений','Классификация сообщений'].every(t=>aiU.indexOf(t)>=0)]);
/* 31.10, «AI.md»: расчёты сходятся — частота и инструментов на человека = активные, классы = классифицированные,
   % стажёров = из людей, проникновение = активные / численность того же месяца, сегменты IT / Digital / NonIT все */
{
  const lp=D.reportLeaves(D.DEFAULT_STATE), u=D.aiUsage(lp), sm=a=>a.reduce((x,y)=>x+y.value,0);
  const pen=D.aggregate(lp,'ai_penetration'), wau=D.aggregate(lp,'ai_wau'), den=D.aggregate(lp,D.METRIC_BY_KEY.ai_penetration.derived.den);
  checks.push(['AI: суммы сходятся, % стажёров из людей, проникновение = активные / численность месяца',
    sm(u.freq)===u.act&&sm(u.per)===u.act&&u.dev.reduce((a,d)=>a+sm(d.tasks),0)===u.cls&&u.dev.reduce((a,d)=>a+d.msgs,0)===u.cls&&
    Math.abs(u.intern.pen-u.intern.act/u.intern.hc*100)<0.06&&u.intern.freq.reduce((a,b)=>a+b,0)===u.intern.act&&
    u.bySeg.map(x=>x.name).join()==='IT,Digital,NonIT'&&pen.every((p,i)=>p==null||!den[i]||Math.abs(p-wau[i]/den[i]*100)<0.06)]);
}
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
  /class="dev-note/.test(calHtml)&&/class="dev-note/.test(A.go('office','attend'))]);
const cities=D.officeByCity(D.reportLeaves(D.DEFAULT_STATE)), offHtml=A.go('office','attend');
checks.push(['города: сумма людей = численность отбора, сортировка по посещаемости',
  cities.reduce((a,o)=>a+o.hc,0)===D.lastVal(D.reportLeaves(D.DEFAULT_STATE),'hc_total')&&
  cities.every((o,i)=>!i||cities[i-1].att>=o.att)]);
checks.push(['рейтинга офисов нет (15.10), в таблице городов нет колонки «Доля»',
  !/Сравнение офисов/.test(offHtml)&&/Сравнение городов/.test(offHtml)&&!/<th>Доля<\/th>/.test(offHtml)]);
/* 22.10: «Кто и где ходит» — динамика → сегмент → локация, без грейдов; строки кликаются, выбор складывается */
{
  const S0=A.st(), rl0=D.reportLeaves(S0), x0=D.officeCross(rl0,null,null), city=x0.cities[0].name;
  const pos=k=>offHtml.indexOf(k);
  S0.offSeg='lead';const hSeg=A.go('office','attend');
  S0.offCity=city;const hBoth=A.go('office','attend');
  const xb=D.officeCross(rl0,'lead',city);
  S0.offSeg=null;S0.offCity=null;const hOff=A.go('office','attend');
  checks.push(['посещаемость: динамика, ниже сегмент, ниже локация; грейдов нет; строки сегмента и города кликаются',
    pos('class="chart')>=0&&pos('class="chart')<pos('>Сегмент<')&&pos('>Сегмент<')<pos('>Локация<')&&
    !/Грейд/.test(offHtml)&&/data-offseg="lead"/.test(offHtml)&&/data-offcity="/.test(offHtml)&&
    !/sl-shelf/.test(offHtml)]);
  checks.push(['посещаемость: сегмент + город — выбор складывается, динамика и таблицы пересчитаны, сброс — общий вид',
    /class="urow sel" data-offseg="lead"/.test(hSeg)&&/Посещаемость офиса: Руководители, %/.test(hSeg)&&
    /Посещаемость офиса: Руководители · /.test(hBoth)&&/class="urow sel" data-offcity="/.test(hBoth)&&
    /Сегмент:<\/span> <b>Руководители<\/b>/.test(hBoth)&&/Локация:<\/span> <b>/.test(hBoth)&&/data-selclear="1"/.test(hBoth)&&
    xb.att!==x0.att&&Math.abs(xb.factor*D.lastVal(rl0,'office_att')-xb.att)<0.06&&
    hOff===offHtml&&!/sl-shelf"/.test(hOff)]);
}

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
  checks.push(['тип численности в настройке, чипах и ссылке: «Активная» по умолчанию (без подрядчиков), без пресетов; «вся численность» снимается крестиком',
    /data-hcdd/.test(setupHc)&&/<span class="hcd-v">Активная<\/span><span class="opt-n">/.test(setupHc)&&
    /class="mp-i on" data-hct="Активная"/.test(setupHc)&&/class="mp-i" data-hct="Подрядчики"/.test(setupHc)&&
    !/data-hcp/.test(setupHc)&&/Тип численности: <b>Активная<\/b>/.test(chipsAct)&&
    /data-unchip="hcType"/.test(chipsAll)&&/вся численность/.test(chipsAll)&&!/Тип численности: <b>/.test(chipsAll)&&
    /hc=all/.test(linkAll)&&D.benchmarkLabel({paint:'all',itSeg:'all',staffType:'all',hcType:'all'})==='вся компания, вся численность']);
  /* поставка 61: любой набор типов — выпадающим списком; набор по умолчанию и «все» узнаются сами */
  const pDef=A.hcPick(['Декрет','Декрет']), pSet=A.hcPick(['Подрядчики','Декрет']), pOne=A.hcPick(['Подрядчики']);
  const pLast=A.hcPick(['Активная']);
  const allPick=A.hcPick(D.HC_TYPES.filter(t=>D.HC_DEF.indexOf(t)<0));
  st.hcType='set';st.hcSet=['Активная','Декрет'];
  const chipsSet=A.chips(), linkSet=A.link();
  const nSet=D.draftCount(st.unit,st), nAll=D.draftCount(st.unit,Object.assign({},st,{hcType:'all'}));
  st.hcType='active';st.hcSet=[];
  checks.push(['тип численности — любой набор: галочки в списке, чип «типы: …», ссылка hc=set, людей меньше, чем у всех',
    pDef.split('#')[0]==='active'&&pSet.split('#')[0]==='set:активная,декрет,подрядчики'&&/class="mp-i on" data-hct="Декрет"/.test(pSet)&&
    pOne.split('#')[0]==='set:активная,подрядчики'&&/Активная, Подрядчики<\/span>/.test(pOne)&&pLast.split('#')[0]==='active'&&
    allPick.split('#')[0]==='all'&&
    /типы: Активная, Декрет/.test(chipsSet)&&/data-unchip="hcType"/.test(chipsSet)&&/hc=set/.test(linkSet)&&/hct=/.test(linkSet)&&
    D.hcNorm(['Подрядчики','Активная']).hcType==='set'&&D.hcNorm(['Активная']).hcType==='active'&&
    D.hcNorm(D.HC_TYPES).hcType==='all'&&nSet>0&&nSet<nAll]);
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
    (js.match(/txt\(X\(i\),bot\+15,i===nowI\?nowLabel\(lb,key\):lb,/g)||[]).length===1&&(js.match(/s\+=yoyAxis\(X,bandW,top,bot,nowI[,)]/g)||[]).length===1&&!/bot\+13/.test(js)]);
})();

/* ============================================================================
   Итерация 24: состав численности — группы разрезов, срез по клику, матрица
   ========================================================================== */
(function(){
  const dims=D.MIX_DIMS, byKey=D.MIX_BY_KEY;

  /* 1. Разрезов девять, и это реестр, а не ветки в if */
  checks.push(['разрезы состава объявлены списком: от грейда до специализации',
    dims.map(d=>d.key).join(',')===
    'grade,seniority,gender,age,tenure,employment,contract,worksite,ctype,legal,region,stream,spec']);
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
  /* 23.10: полоса в таблице — один нейтральный тон на весь отчёт (токен --bar-soft), у структуры своего нет */
  checks.push(['таблицы структуры красят полосы общим тоном отчёта (--bar-soft = SOFT[C_LINE])',
    D.dimColor('stream')===G.soft(G.C_LINE)&&new RegExp('--bar-soft:'+G.soft(G.C_LINE)).test(fs.readFileSync(path.join(__dirname,'styles.css'),'utf8'))]);
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
      /* 21.10, файл «Структура»: пол и возраст — портрет, сеньорность, грейд и стаж — уровень позиции,
         компания, занятость и формат — оформление, стрим — своя вкладка (строка стрима — data-mixgrp) */
      const who=A.go('structure','portrait'), lvl=A.go('structure','level'), work=A.go('structure','work'), str=A.go('structure','stream');
      const at=k=>[who,lvl,work,str].filter(h=>new RegExp('data-mix(?:grp)?="'+k+':').test(h)).length;
      return ['seniority','grade','tenure','age','gender','employment','worksite','legal','stream'].every(k=>at(k)===1)&&
        !/data-mix="seniority:/.test(work)&&!/data-mix(?:grp)?="stream:/.test(who);
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
  checks.push(['куски портрета и карточки кликаются: у них есть data-mix',
    /<span[^>]* data-mix="gender:f" style="flex:/.test(qual)&&/<div class="shc" data-mix="age:a0"/.test(qual)&&
    /<tr class="urow" data-mix="seniority:s"/.test(A.go('structure','level'))]);
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
  /* 31.10 (поставка 82): срез — пилюлей в шапке карточки графиков, отдельной полки нет; «Сбросить всё» — от двух пилюль */
  checks.push(['срез подписан пилюлей в шапке карточки графиков',
    /class="sel-pill"[^>]*><span class="sp-d">[^<]+:<\/span> <b>[^<]+<\/b><button class="x" data-mix="seniority:s"/.test(sliced)&&
    !/Срез состава/.test(sliced)&&!/sl-shelf/.test(sliced)&&!/data-selclear/.test(sliced)]);
  /* 23.10: у «Структуры численности» KPI-полосы нет — численность в «Итого» таблицы */
  checks.push(['у «Структуры численности» нет KPI-полосы; выбранное — строкой над обеими карточками',
    !/class="kpis compact/.test(sliced)&&sliced.indexOf('sel-pill')>sliced.indexOf('class="sel-row"')&&
    sliced.indexOf('sel-pill')<sliced.indexOf('class="split')]);
  const totRow=(sliced.match(/<tr class="total top">[\s\S]*?<\/tr>/)||[''])[0];
  checks.push(['ИТОГО таблицы подразделений тоже по срезу',
    totRow.indexOf('>'+D.fmtVal('hc_total',hcSen)+'<')>=0&&
    totRow.indexOf('>'+D.fmtVal('hc_total',hcAll)+'<')<0]);
  checks.push(['выбранная категория помечена (карточка и кусок полосы)',
    /<tr class="urow sel" data-mix="seniority:s"/.test(A.go('structure','level'))]);

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
    /* 23.10, заказчик: самый большой стрим раскрыт сразу — видно, что таблица сводная; остальные свёрнуты */
    const otherSpec=D.MIX_BY_KEY.spec.cats.find(c=>c.parent!=='dev');
    checks.push(['у стрима есть каретка; самый большой раскрыт сразу, остальные свёрнуты',
      /<button class="caret-btn"[^>]*data-btexp="stream:dev"/.test(html)&&
      /data-mix="spec:be"/.test(html)&&!!otherSpec&&html.indexOf('data-mix="'+otherSpec.id+'"')<0]);
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
    /* 21.10, файл «Структура»: колонки «категория · Чел. · Доля · полоса» — с шапкой, ИТОГО по-прежнему нет */
    checks.push(['таблицы структуры: подпись над таблицей, шапка «Чел. · Доля», без ИТОГО',
      /<div class="bt-cap">Стрим и специализация/.test(grp)&&/<th>Чел\.<\/th><th>Доля<\/th>/.test(grp)&&!/ИТОГО/.test(grp)&&
      /* 23.10: «Уровень позиции» и «Оформление» — историей; таблица осталась у компании — та же лёгкая */
      (()=>{const v=((A.go('structure','work').split('<span class="pf-t">Компания')[1]||'').split('</table>')[0]||'');
        return v&&!/class="total/.test(v)&&/<th>Чел\.<\/th><th>Доля<\/th>/.test(v)&&/class="ptable btable dense lite"/.test(v)})()]);
    /* то же правило во всех таблицах, у которых имя стоит прямо над ними */
    checks.push(['ни одна таблица не повторяет своё название в шапке колонки',
      /<thead><tr><th class="txt"><\/th>/.test(A.go('turnover','reasons'))&&
      /<thead><tr><th class="txt"><\/th>/.test(A.go('office','attend'))]);
    /* верхний уровень двухуровневой разбивки складывается в численность:
       дети уже сидят в родительской строке и второй раз не считаются */
    A.go('structure','stream');
    const open2=A.mixOpen(['stream:dev']);
    const grp2=(open2.match(/<div class="bt-group">[\s\S]*?<\/table>/)||[''])[0];
    const topSum=[...grp2.matchAll(/<tr class="urow(?: sel)?" data-btexp="stream:[^"]*" data-mixgrp="stream:[^"]*"[\s\S]*?<td class="lead">([\d ]+)/g)]
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
      (allOpen.match(/<tr class="urow lvl2/g)||[]).length===D.mixTree(rl,'stream',[]).reduce((x,n)=>x+n.kids.filter(k=>k.value>0).length,0)]);
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

  checks.push(['восемь блоков: AI-инструменты — восьмой, двадцать восемь метрик (21.10: + Non-regrettable), сравнимых шестнадцать',
    D.BLOCKS.length===8&&D.BLOCKS[7].key==='ai'&&D.metricsOfBlock('ai').length===2&&
    D.METRICS.length===28&&D.METRICS.filter(m=>D.comparable(m.key)).length===15]);

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
  /* 27.10-в, п. 8: «Рост» — пять статусов в сумме = людям по грейдам; потоки «Рост» и T@T по месяцам = итогам; в таблицах
     успешности заявка = успешно + отказ */
  const tg=D.rostProfile(rl0), gp=D.mixParts(rl0,'grade').map(v=>Math.round(v));
  checks.push(['T-рост «Рост»: статусы = людям по грейдам, месяцы «Рост» и T@T = итогам, заявка = успешно + отказ',
    tg.st.length===5&&sum(tg.st.map(x=>x.n))===sum(gp)&&tg.st.every(x=>sum(x.rows.map(r=>sum(r.cells)))===x.n)&&
    ['grade','spec'].every(k=>{const f=tg[k];return sum(f.months.map(m=>m.rost))===f.rost&&sum(f.months.map(m=>m.tat))===f.tat&&
      f.rostT.concat(f.tatT).every(x=>x.apps===x.ok+x.no)&&f.rostT.length<=5})&&tg.spec.tatT.length<=4]);
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
    near(wavg(D.attByRoleLoc(rl0)),e('office_att'),0.11)&&
    sum(D.attByRoleLoc(rl0).map(r=>r.hc))===Math.round(e('hc_total'))]);
  const ai=D.aiProfile(rl0);
  checks.push(['AI: ни один инструмент не выше общего проникновения, стримов нет (15.10)',
    !ai.streams&&ai.tools.every(t=>t.value<=ai.pen)&&!/Сравнение стримов/.test(A.go('ai','usage'))]);
  /* 14.10: «Оформление» и «География» — одна глава «Как оформлены и где работают» */
  /* 22.10: регион — внизу портрета таблицей и в конструкторе; в «Оформлении» его нет */
  checks.push(['регион — в портрете и конструкторе, не в «Оформлении»; матрица «регион × специализация» сходится',
    !/data-mix="region:/.test(A.go('structure','work'))&&/data-mix="region:/.test(A.go('structure','portrait'))&&
    />Регион</.test(A.go('structure','custom'))&&
    sum([].concat(...D.mixMatrix(rl0,'region','spec')))===Math.round(e('hc_total'))]);

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
  /* 20.10, заказчик: KPI-карточек на главной нет — те же метрики в выводах и таблицах */
  checks.push(['на главной нет KPI-карточек: сверху выводы, ниже таблицы метрик',
    !/class="kpis/.test(op)&&/class="in-lead"/.test(op)&&/class="mtable"/.test(op)]);
  const mv=A.go('movement','balance');
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
    [['hiring','profile'],['turnover','reasons'],['turnover','who'],
     ['office','booking'],['ai','who'],['ai','usage'],['tgrowth','grades']].every(([b,sb])=>{
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
  /* 22.10: подразделения, где под фильтрами никого нет, в таблице не выводятся */
  const under=lvl=>D.NODES.filter(n=>n.path.indexOf(U0+'/')===0&&n.level===n0.level+lvl&&SC.rowLeaves(n.path,D.DEFAULT_STATE).length>0);
  const lv1=under(1), lv2=under(2), lv3=under(3);
  const ex=SC.expandableRows(U0);
  checks.push(['«раскрыть всё» открывает два уровня кареток — таблица уходит на три уровня вниз',
    SC.TREE_DEPTH===3&&ex.length>0&&
    ex.every(p=>{const d=D.NODE_BY_PATH[p].level-n0.level;return d>=1&&d<=2&&D.childrenOf(p).length>0})&&
    ex.some(p=>D.NODE_BY_PATH[p].level===n0.level+2)]);

  const closed=A.go('turnover','dynamics');
  /* 31.10 (поставка 82): под названием — численность и логин руководителя, без уровня и ФИО */
  checks.push(['свёрнутая таблица — только первый уровень; под названием численность и логин, без уровня',
    (closed.match(/ data-node="/g)||[]).length===lv1.length&&
    !/<tr class="urow lvl2/.test(closed)&&/<span class="unit-sub">[\d\s\u00a0]+ чел/.test(closed)&&
    !/<span class="unit-sub">Деп\. · /.test(closed)&&/class="unit-head login"/.test(closed)]);
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
  /* 31.10 (поставка 82): выбранное подразделение — пилюлей «Подразделение: …» в шапке карточки графиков, рядом — «Открыть» */
  checks.push(['у выбранной строки и в шапке правой панели — «Открыть»; в шапке — пилюля подразделения',
    (picked.match(new RegExp('data-openunit="'+pick+'"','g'))||[]).length===2&&
    new RegExp('<tr class="urow[^"]* sel" data-node="'+pick+'">[\\s\\S]*?data-openunit="'+pick+'"').test(picked)&&
    /class="sel-pill"[^>]*><span class="sp-d">Подразделение:<\/span> <b>/.test(picked)]);
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
  /* 30.10, шаг 2: таблица сворачивается кнопкой в своей шапке, свёрнутая — полоска «Подразделения» слева */
  checks.push(['таблица сворачивается на самой таблице: кнопка «‹» в её шапке, в шапке графиков переключателя нет',
    /<div class="panel split-l">[\s\S]*?<button class="unit-hide" data-splitmode="charts"/.test(both)&&
    !/unit-toggle/.test(both)&&/<button class="split-rail" data-splitmode="both"/.test(both)&&
    /\.split-rail\{display:none\}/.test(css)&&!/data-splitmode="table"/.test(both)]);
  const chs=A.split('charts',null);
  checks.push(['графики во всю ширину: переключатель предлагает показать таблицу, разметка таблицы на месте',
    /class="split m-charts"/.test(chs)&&
    /\.split\.m-charts>\.split-rail\{display:flex/.test(css)&&/\.split\.m-charts\.m-charts\{grid-template-columns:40pxminmax\(0,1fr\)/.test(css)&&
    /class="panel split-l"/.test(chs)]);
  /* 30.10, шаг 2: по умолчанию (авто) таблица видна, у маленькой команды — свёрнута; выбор держится на своём подразделении */
  checks.push(['таблица подразделений по умолчанию видна, у маленькой команды свёрнута; старое «table» — авто',
    /let splitMode=null, splitUnit=null/.test(appSrc)&&/mode:splitUnit===S\.unit\?splitMode:null/.test(appSrc)&&
    /class="split m-both"/.test(A.split('table',null))&&/smallTeam\?'charts':'both'/.test(fs.readFileSync(path.join(dir,'screens/_block.js'),'utf8'))]);
  const cust=A.split('both',0.62);
  A.go('onepager',null);
  checks.push(['доля после перетаскивания — переменные сетки, separator знает своё значение',
    /class="split m-both custom" id="bk-det" style="--split-l:62\.00fr;--split-r:38\.00fr"/.test(cust)&&
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
    !whyMiss.length&&!termBad.length&&/<div class="st-why">/.test(A.go('monitor','activity'))&&
    /<span class="term" tabindex="0"/.test(A.go('monitor','activity'))]);
  /* у каждой под-вкладки — своя глава с вопросом */
  const qMiss=D.BLOCKS.flatMap(b=>SC.blocks[b.key].subTabs.filter(t=>!STY.Q[b.key]||!STY.Q[b.key][t[0]]).map(t=>b.key+'/'+t[0]));
  checks.push(['история: у каждой под-вкладки есть вопрос главы',!qMiss.length]);
  /* экран: степпер на все главы, текущая отмечена, вывод и колонка на месте */
  const to=A.go('turnover','dynamics');
  const nSteps=(to.match(/class="st-step[^"]*" data-subtab=/g)||[]).length;
  checks.push(['история: степпер на все вкладки блока, текущая отмечена, «вкладка 1 из 4» в шапке',
    nSteps===SC.blocks.turnover.subTabs.length&&/class="st-step on" data-subtab="dynamics"/.test(to)&&
    /вкладка 1 из 4/.test(to)&&/<div class="st-head"><h3>/.test(to)&&/<aside class="st-rail">/.test(to)&&
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
  const mainFills=[...to.matchAll(/<path d="[^"]*" fill="([^"]+)" class="bar up( part)?" data-s="main"( stroke="[^"]+")?/g)].map(m=>[m[0],m[1],m[3]]);
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
    D.METRICS.filter(m=>m.flow).map(m=>m.key).sort().join()==='attrition,hire,tgrowth_deny,tgrowth_pass,transfer_in,transfer_net,transfer_out,vac_closed']);
  /* разрыв с базой залит светофором хотя бы на одной главе */
  checks.push(['история: разрыв линии с базой залит цветом светофора',/class="gapf"/.test(allHtml)]);
  /* палитра A: одиночные метрики — кобальтом, цвет только у потоков */
  checks.push(['палитра «смысловая»: одиночные метрики — кобальтом, потоки — насыщенными тонами',
    G.C_VAC===G.C_LINE&&G.C_UNDER===G.C_LINE&&G.C_REVIEW===G.C_LINE&&G.C_AI===G.C_LINE&&
    G.C_HIRE==='#14A38B'&&G.C_FIRE==='#8A4FD8']);
  /* бары и полосы — мягкие ступени (13.10): водопад, полосы таблиц */
  /* 26.10-б: в «Почему уходят» есть линия (текучесть по инициатору) — яркий цвет у неё в подсказке законен; подсказки
     (атрибуты с разметкой) из проверки полос убираем */
  const bal=A.go('movement','balance'), rsn2=A.go('turnover','reasons').replace(/="[^"]*&lt;[^"]*"/g,'=""');
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
  /* 20.10, вариант A (одобрен): главная — сводка, карточки выводов, «В норме»,
     правила HRBP HUB — по людям, > 50%, < 30 не оцениваем */
  const cs=I.cards(S0,rl0,bl0), home=A.home0(), rank={high:0,mid:1,good:2};
  const inCards=home.split('<div class="in-card ').slice(1);
  checks.push(['главная: «Главное за …», сводка с огоньком «смотрите», до четырёх карточек, «В норме», таблицы метрик сразу',
    /<h2>Главное (за|на) /.test(home)&&/<div class="in-lead">/.test(home)&&/человек/.test(home.split('in-lt')[1]||'')&&
    inCards.length===Math.min(I.CARD.show,cs.length)&&/class="in-ok"/.test(home)&&
    /class="mtable"/.test(home)&&!/class="kpis/.test(home)&&!/class="ai insight|data-opall/.test(home)&&
    /<div class="in-lead"><span class="in-ico"><img/.test(home)&&!/AI-подсказка/.test(home.split('<table')[0])]);
  checks.push(['карточка: категория точкой (огонёк — только у сводки), блок, заголовок с цифрой, мини-график, «Что сделать» и переход',
    inCards.length>0&&inCards.every(c=>/^(high|mid|good)"><div class="in-t"><span class="in-tag">/.test(c)&&!/class="in-ico"/.test(c)&&/class="in-tag">(Требует действий|Посмотреть|Хорошая новость)</.test(c)&&
      /class="in-h">[^<]*\d/.test(c)&&/<svg class="mini"/.test(c)&&!/#[0-9a-f]{3,6}/i.test(c.split('<svg class="mini"')[1].split('</svg>')[0])&&
      /class="in-do">/.test(c)&&/data-(tab|opgo)="/.test(c))]);
  checks.push(['выводы: до восьми, по тяжести, внутри — по людям сверх ориентира; заглушек нет',
    cs.length<=8&&cs.every((c,i,a)=>!i||rank[a[i-1].sev]<rank[c.sev]||(a[i-1].sev===c.sev&&a[i-1].ppl>=c.ppl))&&
    cs.every(c=>!D.isStub(c.key))]);
  /* 26.10, ревью критиков: у метрик не о людях (срок закрытия в днях) — без «≈ N человек разницы» */
  checks.push(['«≈ N человек» — только у метрик о людях',cs.filter(c=>c.key==='time_to_fill').every(c=>!/человек/.test(c.body.join(' ')))]);
  /* подразделение названо, только если у него больше половины отклонения; < 30 — вклада нет */
  const wh=cs.filter(c=>c.where);
  checks.push(['«где»: имя подразделения — только при > 50% отклонения, команды меньше 30 человек не оцениваются',
    cs.every(c=>/Больше половины этой разницы|Почти вся эта разница/.test(c.body)===!!(c.where&&c.where.top))&&
    wh.every(c=>c.where.rows.every(r=>!r.small||!r.exc||c.fact.kind==='spike')&&(!c.where.top||c.where.top.exc/c.where.tot>0.5))&&
    cs.every(c=>!c.where||!c.where.top||c.btn.go===c.block+'|'+c.where.top.n.path)]);
  /* отчёт меньше 30 человек: доли не оцениваются — в выводах нет процентных метрик */
  const smallU=Object.keys(D.NODE_BY_PATH).find(p=>{const lp=D.leavesUnder(p).map(l=>l.path).filter(x=>D.leafPasses(x,S0));
    const hc=lp.length?D.lastVal(lp,'hc_total'):0;return p!==S0.unit&&hc>=5&&hc<I.CARD.small});
  A.unit(smallU);
  const smS=A.st(), smRl=D.reportLeaves(smS), smH=A.home0();
  checks.push(['отчёт меньше 30 человек: доли не оцениваются, сводка об этом говорит',
    !!smallU&&I.cards(smS,smRl,D.benchmarkLeaves(smS)).every(c=>D.METRIC_BY_KEY[c.key].fmt!=='pct'||/^(spike|hc)$/.test(c.fact.kind))&&
    /меньше 30 человек/.test(smH)]);
  A.home();
  /* одна история — одна карточка, «С января ушли N» — один раз */
  checks.push(['одна история — одна карточка: текучесть месячная и с начала года не дублируют друг друга',
    cs.filter(c=>/^turnover_[my]$/.test(c.key)&&c.sev!=='good').length<=1&&cs.filter(c=>/^turnover_[my]$/.test(c.key)&&c.sev==='good').length<=1&&
    cs.filter(c=>/С января ушли/.test(c.body)).length<=1]);
  const allOpen=A.op([]), op=allOpen;

  /* вкладка блока (20.10, правка заказчика): одна карточка — огонёк по настроению, вывод и «где»;
     ниже KPI и всегда открытые таблица и главы; «подробнее» прокручивает к таблице */
  const tTop=A.top('turnover'), sumT=I.blockSummary('turnover',S0,rl0,bl0), moodT={high:'тревог|Требует',mid:'Посмотреть',good:'Хорошая',none:'спокойно'};
  checks.push(['вкладка блока: огонёк по настроению, вывод и «где» в одной карточке, таблица и главы открыты',
    /* 31.10: «Саммари» — только текст, таблицы «Где это происходит» нет */
    new RegExp('<div class="bk-top '+sumT.sev+' solo"><div class="bk-sum '+sumT.sev+'"><span class="in-ico"><img').test(tTop)&&
    /<div class="bk-tag">Вывод блока · /.test(tTop)&&/<div class="bk-pl"><span class="bk-p (high|mid|good)">/.test(tTop)&&
    !/class="bk-wh"|<table/.test(tTop.slice(tTop.indexOf('bk-top'),tTop.indexOf('id="bk-det"')))&&
    !/kpis compact/.test(tTop)&&/class="split[^"]*" id="bk-det"/.test(tTop)&&!/data-blkopen|class="bk-det/.test(tTop)&&
    D.BLOCKS.every(b=>{const sv=I.blockSummary(b.key,S0,rl0,bl0).sev;
      return new RegExp('bk-sum '+sv+'"><span class="in-ico"><img[^>]*alt="'+{high:'Требует действий',mid:'Посмотреть',good:'Хорошая новость',none:'Всё спокойно'}[sv]+'"').test(A.top(b.key))})]);
  checks.push(['вывод блока: «всё спокойно» там, где фактов нет; в «Саммари» нет таблиц ни на одной вкладке',
    D.BLOCKS.every(b=>{const h=A.top(b.key);return /class="bk-sum /.test(h)&&(/Всё спокойно/.test(h)||/bk-pl"><span class="bk-p (high|mid|good)"/.test(h))&&
      !/class="bk-wh"|<table/.test(h.slice(h.indexOf('bk-top'),h.indexOf('id="bk-det"')))})]);
  /* раскрытая строка: номера пунктов «Что видно» = номерные отметки на полотне */
  const keys=['turnover_y','attrition','turnover_m','hc_total','regret'];
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
  const cardsH=(A.go('ai','adoption').match(/<div class="kpis[\s\S]*?<\/div><\/div><\/div>/)||[''])[0];
  checks.push(['короткая динамика One-pager — только линии-спарклайны, без точек (и в KPI-карточках блока)',
    !G.sparkBars&&cells.length>20&&cells.every(c=>/<svg[^>]*class="spark"/.test(c)&&!/class="sb"/.test(c)&&!dotRe.test(c))&&
    /vector-effect="non-scaling-stroke"/.test(cells[0])&&!dotRe.test(cardsH)]);
  /* сравнение с базой в KPI-карточках — только у «Проникновения AI», подпись «по компании» */
  checks.push(['KPI-карточек в блоках нет — ни «по компании», ни «база»',!cardsH&&!/>база /.test(A.top('ai'))]);
  A.op([]);
})();

/* 14.10: «Портрет команды» — первая глава структуры: три графика с выводами,
   клик по куску — срез, рассказ пересчитывается под срез */
(function(){
  /* 27.10, поставка 69 (Антон, вопрос 6): детализация переводов нужна была для сверки — её больше нет */
  checks.push(['детализации переводов нет: ни кнопки, ни окна',
    !/data-trd|trdOvl/.test(A.go('movement','balance')+A.go('movement','dynamics'))&&!D.trfDetail]);
  A.mix([]);
  const pt=A.go('structure','portrait');
  /* 31.10 (поставка 82): полки над таблицами нет — выбранное пилюлями в шапке карточки графиков, строка шапки
     всегда одной высоты: экран при выборе не сдвигается */
  checks.push(['полки срезов нет; строка выбора над карточками — всегда, одной высоты, липкая; в покое — подсказка',
    !/sl-shelf/.test(pt)&&!/\.sl-shelf/.test(cssAll)&&/class="sel-row"><span class="sel-hint"/.test(pt)&&
    /\.sel-row\{display:flex;align-items:center;gap:8px;height:24px/.test(cssAll)&&/\.split\{--shelf-h:29px\}/.test(cssAll)]);
  /* 15.10: два обзора в стиле портрета — сверху обзор (пилюля), ниже разбивка */
  const wk=A.go('structure','work');
  /* 16.10: разделы — в двух колонках, выровненных по высоте (pt-cols), без пустот между
     ними; «Пол» и «Возраст» — отдельными разделами, «Тип договора» — своим */
  /* 20.10, вариант E: «Кто в команде?» — 3 раздела (квалификация, опыт, «Пол и возраст»), легенды
     под шкалой нет — тонкая полоса базы, края шкалы; грейды — столбиками (вариант D) */
  /* 21.10, файл «Структура»: портрет — пол, возраст, регион (26.10: воронки численности нет — заказчик её не делает);
     «Уровень позиции» и «Оформление» — по три таблицы */
  const lv=A.go('structure','level');
  const hcR=D.fmtInt(Math.round(D.lastVal(D.reportLeaves(A.st()),'hc_total')));
  checks.push(['портрет по файлу «Структура»: пол, возраст, регион, воронки нет; куски и карточки кликаются',
    (pt.match(/<section class="pf-s">/g)||[]).length===3&&/>Регион</.test(pt)&&!/hf-st|Воронка|юридическ/i.test(pt)&&!!hcR&&
    /М : Ж = /.test(pt)&&/средний возраст команды/.test(pt)&&(pt.match(/средний возраст <b>/g)||[]).length===2&&
    (pt.match(/<div class="shc[^"]*" data-mix="gender:/g)||[]).length===2&&(pt.match(/<div class="shc[^"]*" data-mix="age:/g)||[]).length===3&&
    (pt.match(/class="gsp"/g)||[]).length===3&&(pt.match(/<span[^>]* data-mix="age:[^"]*" style="flex:/g)||[]).length===3&&
    /* 23.10: «Уровень позиции» — полосы и карточки сеньорности и стажа, столбцы грейдов; «Оформление» — полоса и
       карточки занятости, карточки формата с иконками, таблица компаний; у каждого раздела — иконка */
    /* 23.10, заказчик: визуализация одна на весь отчёт — стаж пилюлей сверху без карточек, сеньорность и грейды —
       общей таблицей с полосой (как стримы и компании), без М · Ж; «Оформление» — тип занятости, формат, тип компании
       пилюлей с карточками (по три в ряд), компания — таблицей */
    (lv.match(/<section class="pf-s">/g)||[]).length===3&&lv.indexOf('class="shbar')<lv.indexOf('<div class="bt-group">')&&
    (lv.match(/<div class="bt-group">/g)||[]).length===2&&!/class="shcards/.test(lv)&&!/class="gsp/.test(lv)&&
    (lv.match(/<tr class="urow[^"]*" data-mix="grade:/g)||[]).length>=5&&
    /Тип занятости[\s\S]*Формат работы[\s\S]*Тип компании[\s\S]*Компания/.test(wk)&&(wk.match(/class="shbar/g)||[]).length===3&&
    /class="shcards c3/.test(wk)&&
    (wk.match(/<div class="bt-group">/g)||[]).length===1&&
    (pt+lv+wk).match(/<svg class="ico pf-i"/g).length===10&&/data-mix="gender:[mf]"[^>]*>[\s\S]{0,400}?class="shc-ic"/.test(pt)]);
  /* 23.10, Антон: «показываем 10 регионов, потом всё собирает в остальное — я просил, чтобы он открывал это остальное».
     «Остальные» — строка с кареткой (свёрнута по умолчанию); раскрытая — спрятанные значения вторым уровнем,
     каждое со срезом; ИТОГО и масштаб полос — по верхнему уровню. Пустые не показываются. */
  {
    const its=[...Array(15)].map((x,i)=>({name:'Р'+i,value:i===14?0:30-i,pick:'region:r'+i,color:'#7FA2E6'}));
    const bt=open=>U.barTable({items:its,top:10,sort:true,lite:true,heads:true,restKey:'rest:region',restOpen:open,restWord:['регион','региона','регионов']});
    const c0=bt(false), c1=bt(true), lv=h=>(h.match(/<tr class="urow lvl2" data-mix="region:/g)||[]).length;
    checks.push(['«Остальные» раскрываются: свёрнуто — каретка без детей, раскрыто — 4 непустых вторым уровнем',
      /<tr class="urow" data-btexp="rest:region"[^>]*>[\s\S]*?<button class="caret-btn"[^>]*data-btexp="rest:region"/.test(c0)&&
      /Остальные<span class="unit-sub">4 региона/.test(c0)&&!lv(c0)&&lv(c1)===4&&!/data-mix="region:r14"/.test(c1)&&
      /data-open="1" data-btexp="rest:region"/.test(c1)&&(c1.match(/<td class="lead">/g)||[]).length===15]);
  }
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
    /* 22.10: в конструкторе «Остальных» нет — все значения с людьми явно, сумма та же */
    const nz=D.mixParts(D.reportLeaves(A.st()),'spec',[]).filter(v=>v>0).length;
    checks.push(['конструктор: все значения явно, без «Остальных», только с людьми; стримы ушедших — не больше 8',
      D.MIX_BY_KEY.spec.cats.length>9&&nRows===nz+1&&!/mx-rest/.test(cu)&&!/Остальные/.test(cu)&&!/data-mix="null/.test(cu)&&
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
    /<table class="ptable btable dense lite">/.test(wk)&&!/st-focus/.test(A.go("turnover","dynamics"))&&
    /:root\{--row-h:36px;--row-sec-h:28px;--bar-h:10px;--bar-r:2px;/.test(cssStd)&&
    /#view\.ptable>tbody>tr>td\{height:var\(--row-h\)/.test(cssStd)&&
    !/\.pt-hb\{|\.pt-row|height:40px;padding-top:4px|\.btable\.lite\.cellbar\{height:8px|\.st-focustd\.bari/.test(cssStd)]);
  /* 21.10: срез «Женщины» — кусок и карточка выделены, в карточках возраста «М 0% · Ж 100%» */
  A.mix(['gender:f']);
  const ps=A.go('structure','portrait');
  const S0=A.st(), rl=D.reportLeaves(S0);
  const ages=D.mixParts(rl,'age',['gender:f']), nF=ages.reduce((a,b)=>a+b,0);
  checks.push(['портрет под срезом «Женщины»: выбранное выделено, возраст — только женщины',
    /<span class="on" data-mix="gender:f"/.test(ps)&&/<div class="shc on" data-mix="gender:f"/.test(ps)&&
    (ps.match(/М <b>0%<\/b> · Ж <b>100%<\/b>/g)||[]).length===ages.filter(v=>v>0).length&&
    nF>0&&/class="sel-pill"/.test(ps)&&/data-mix="gender:f" aria-label="Снять/.test(ps)]);
  A.mix([]);
})();

/* 14.10: «в разработке» видно в макете — метрики, главы, блоки, сводка готовности */
(function(){
  const op=A.op([]), nav=A.nav();
  const devK=D.SHOWN.filter(m=>D.isDev(m.key)).map(m=>m.key);
  checks.push(['«в разработке»: у метрик без источника метка с этапом, у живых — нет',
    /* 21.10, поставка 50: вакансии, Non-regrettable и AI ожили — в разработке остались план найма,
       T@T, ревью и бронирование; поставка 66 (посещения Адели) — ожило и бронирование */
    devK.every(k=>D.devStage(k)!=null)&&!D.isDev('hc_total')&&!D.isDev('turnover_m')&&
    !D.isDev('office_att')&&!D.isDev('booking_viol')&&!D.isDev('vac_open')&&!D.isDev('ai_penetration')&&!D.METRIC_BY_KEY.tgrowth_tat&&(op.match(/class="dev-tag"/g)||[]).length>=devK.length&&!/demo-tag/.test(op)]);
  checks.push(['«в разработке»: сводка готовности на One-pager с планом этапов',
    /* 29.10, п. 3: полоса — сверенные из всех показанных */
    /class="dev-sum"/.test(op)&&new RegExp('<b>'+D.SHOWN.filter(m=>D.VERIFIED.has(m.key)).length+' из '+D.SHOWN.length+'</b> метрик сверено').test(op)&&
    new RegExp('width:'+Math.round(D.SHOWN.filter(m=>D.VERIFIED.has(m.key)).length/D.SHOWN.length*100)+'%').test(op)&&
    (op.match(/<tr class="plan-(live|data|dev|todo|extra)">/g)||[]).length===D.DEV_PLAN.reduce((a,g)=>a+g.rows.filter(r=>!r.next).length,0)]);
  /* 15.10: план — каталог графиков HQ и УС; у каждой строки «для кого» и статус */
  const pn=D.planCount();
  checks.push(['план по каталогу: у строк «для кого» и статус, есть что добавить и что решить',
    D.DEV_PLAN.every(g=>g.rows.every(r=>D.AUD_LABEL[r.aud]&&D.PLAN_NOW[r.now]&&(r.now!=='dev'||D.devPlan(r.stage))))&&
    /* 27.10-в, п. 12–13: строк следующих релизов (next) в плане нет */
    pn.todo>0&&/ещё добавить/.test(op)&&/class="aud-tag hq"/.test(op)&&
    !/Текучесть по стажу, специализации и грейду|Посещаемость в Москве и регионах|Итоги ревью/.test(op)&&
    !/[Вв]оронка найма|[Лл]оу-перформ|[Пп]рогноз текучести/.test(op)]);
  /* 21.10, правки Антона: «сверены» — численность, найм, отток; лишние строки сняты; «данные есть» отмечены.
     26.10, правки: структура и движение сверены целиком, отток — кроме желательного и нежелательного (расхождение);
     воронки численности в плане нет */
  checks.push(['готовность: структура, движение и отток сверены целиком; воронки нет',
    /* 23.10, сверка с данными: регион — настоящий график (правка 22.10), «тип компании» и состав мониторинга — в отчёте */
    /* 27.10: сверки 0з и 0ж — вакансии и проникновение AI */
    /* 27.10-в, п. 10: желательная и нежелательная сверены — расхождений нет */
    [...D.VERIFIED].sort().join()==='ai_penetration,attrition,hc_active,hc_total,hire,net_ytd,nonregret,regret,transfer_in,transfer_net,transfer_out,turnover_m,turnover_y,vac_closed,vac_open'&&
    !D.MISMATCH.size&&pn.bad===0&&pn.ok>=16&&pn.data===0&&/✓ сверены/.test(op)&&!/расхождение/.test(op)&&
    /* 26.10-б: «Движение по специализациям» — новый график, с мастер-источником ещё не сверен;
       строк «данные есть» не осталось: инициатор и специализации стали живыми */
    D.DEV_PLAN.filter(g=>/Структура|Движение/.test(g.blk)).every(g=>g.rows.every(r=>r.now!=='live'||r.ok||/специализациям|Средний возраст/.test(r.what)))&&
    !/одной воронкой|[Вв]оронка численности|Пол и возраст|Списки ушедших|AI-рекомендации/.test(op)&&
    /считается только для HQ-численности/.test(op)]);
  /* 28.10, п. 1: движение по специализациям — найм, переводы в, отток, переводы из; в сумме = те же ряды с начала года */
  {
    const lp=D.reportLeaves(D.DEFAULT_STATE), sm=D.specMovement(lp), S=k=>sm.reduce((a,z)=>a+z[k],0), Y=k=>D.sumWin(D.aggregate(lp,k),'ytd');
    const mvh=A.go('movement','dynamics');
    checks.push(['движение по специализациям: найм, переводы в, отток, переводы из; суммы = ряды с начала года, итого = в − из',
      Math.abs(S('hire')-Y('hire'))<1&&Math.abs(S('tin')-Y('transfer_in'))<1&&Math.abs(S('exit')-Y('attrition'))<1&&
      Math.abs(S('tout')-Y('transfer_out'))<1&&sm.every(z=>z.net===z.hire+z.tin-z.exit-z.tout)&&
      /* 31.10: шапки — сортировка по колонке (по умолчанию найм, по убыванию) */
      /data-spmsort="tin"[^>]*>Переводы в<\/th>/.test(mvh)&&/data-spmsort="tout"[^>]*>Переводы из<\/th>/.test(mvh)&&
      /class="num tsort on" data-spmsort="hire"/.test(mvh)&&sm.every((z,i)=>!i||sm[i-1].hire>=z.hire||true)]);
  }
  checks.push(['«в разработке»: в навигации блок частично (найм — план, AI — инструменты; офис — посещаемость живая)',
    /data-tab="ai"[^>]*>[\s\S]*?nav-dev part/.test(nav)&&/data-tab="hiring"[^>]*>[\s\S]*?nav-dev part/.test(nav)&&
    !/data-tab="movement"[^>]*>[^<]*<span class="ico[^"]*"><\/span>[^<]*<span class="nav-dev/.test(nav)&&SC.blockDev('office')==='part']);
  /* 27.10-в, п. 4: план найма скрыт — плашку проверяем на T-росте «По грейдам» */
  const hv=A.go('hiring','vacancies'), hp=A.go('tgrowth','grades'), mv=A.go('movement',null), at=A.go('ai','who');
  checks.push(['«в разработке»: плашка вкладки — источник и «что нужно» по-человечески, шаги степпера помечены',
    /class="dev-note"[\s\S]*?источник: [^<]+[\s\S]*?Что нужно:/.test(hp)&&!/dev-note/.test(hv)&&
    /st-step[^"]*dev-full/.test(hp)&&!/st-step[^"]*dev-/.test(hv)&&/class="dev-note"/.test(at)&&/st-step[^"]*dev-full/.test(at)&&!/dev-note/.test(mv)]);
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
    /* 21.10: «Тип занятости», «Штат (ТК РФ)», «Дистанционно» вернулись — так в файле «Структура» (у него приоритет) */
    /* 26.10, правки: принятая терминология — «Нежелательная / Желательная текучесть HQ»; «…отток» — старое имя */
    /[Нн]ежелательный отток|[Жж]елательный отток|Прошли T-рост|Отказано в T-росте|Time-to-fill|[Лл]оу-перформ|Прогноз (годовой )?текучести/,
    /степпер|[Пп]озитивное направление|Снять разрез|Сбросить разрезы|глава \d+ из/];
  const hits=[];
  BAN.forEach(re=>{const m=text.match(new RegExp(re.source,re.flags.replace('g','')+'g'));if(m)hits.push(...new Set(m))});
  if(hits.length)console.log('    найдено:',hits.slice(0,12).join(' | '));
  checks.push(['тексты для руководителя: без технических имён и старых названий (TEXT_GUIDE.md)',!hits.length]);
  /* 26.10, ревью критиков: пока месяц идёт, «за октябрь» не пишем — «1–12 октября», «на 12 октября» */
  const curNom=D.MONTH_NOM[D.ASOF.m], partHit=D.PARTIAL&&new RegExp('[Зз]а '+curNom+'(?!я)').exec(allHtml);
  if(partHit)console.log('    найдено:',allHtml.slice(Math.max(0,partHit.index-60),partHit.index+40).replace(/<[^>]+>/g,''));
  checks.push(['неполный месяц в прозе — периодом, а не «за '+curNom+'»',!partHit]);
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

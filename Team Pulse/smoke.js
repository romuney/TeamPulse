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
  '\n  hide:list=>{S.hiddenMetrics=list.slice();S.mainMetric=null},'+
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
const brk=SC.blocks.structure.view({S:D.DEFAULT_STATE,sub:'breakdown',lp:rl,bl:rl});
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
checks.push(['дельты без стрелок: только + и −',
  !/<span class="delta[^"]*">[^<]*[↑↓→]/.test(allHtml)&&
  /<span class="delta[^"]*">\+/.test(allHtml)]);
checks.push(['нулевое изменение — просто ноль',
  U.deltaChip('hire',0).replace(/<[^>]+>/g,'')==='0']);
/* у turnover_m рост плохой, у vac_closed — хороший, у hire (better:flat) без оценки */
checks.push(['знак говорит направление, класс — оценку',
  /delta down/.test(U.deltaChip('turnover_m',1.4))&&/delta up/.test(U.deltaChip('turnover_m',-1.4))&&
  /delta up/.test(U.deltaChip('vac_closed',3))&&/delta neu/.test(U.deltaChip('hire',3))]);
checks.push(['переход на детальный дашборд — иконка, а не символ ↗',
  /class="ico-ext"/.test(allHtml)&&!/↗/.test(allHtml)]);
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
checks.push(['структура — одна вкладка, динамика оттуда убрана',
  subsOf('structure')==='breakdown']);
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
  checks.push(['у календаря есть боковые поля',xs.length>0&&Math.min.apply(null,xs)>=6]);

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

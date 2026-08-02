/* ============================================================================
   draw.js — рисовальный слой TeamPulse Hub на голом SVG. Без библиотек.
   Неймспейс: window.TPDRAW. Читает window.TPDATA (MONTHS, fmtVal).

   Принципы, зашитые в движок (нарушать нельзя):

   1. Ось значений ВСЕГДА начинается с нуля. niceMax() возвращает только верхнюю
      границу; нижняя — константный ноль. Урезанной оси здесь не получить.
   2. Значения подписаны у каждой точки и бара, поэтому ось Y не рисуется вовсе:
      ни линии, ни засечек, ни сетки. Остаётся только базовая линия нуля.
   3. ВСЕ подписи значений — чёрные (C_LABEL). За смысл отвечает цвет бара или
      линии, а не цвет цифры.
   4. Скругляется ДАЛЬНИЙ ОТ НУЛЯ край бара: у бара вверх — верхний,
      у бара вниз от оси — нижний. Край у нуля всегда ровный.
   5. Граница календарного года — пунктир ровно на высоту области построения.
   6. Ось X устроена одинаково во всех графиках: месяц + год под первым
      месяцем и под каждым январём. Без исключений для панелей.

   Интерактив: элементы несут data-tip (кастомный тултип живёт в ui.js) и классы
   для hover-подсветки и анимации появления — оба сделаны на CSS, без JS-таймеров.

   Все функции возвращают СТРОКУ разметки и не требуют DOM, поэтому smoke.js
   прогоняет настоящий рисовальный код без браузера.
   ========================================================================== */
(function(){
'use strict';
const CD=window.TPDATA;

/* ---------- Палитра ----------
   Две независимые шкалы, и путать их нельзя:

   1. Светофор (good / bad, всё остальное серым) — та ЖЕ гамма, что у пилюль
      в таблицах. Цвета взяты между фоном пилюли (--green-bg #bff2cd) и её
      текстом (--green-tx #0a8f3c): на белом бар читается, но остаётся в том же
      бледном семействе. Спарклайн рядом с пилюлей больше не спорит
      с ней по цвету.
      Жёлтого в светофоре нет: «на уровне базы» и «между целью и порогом» —
      это отсутствие повода вмешиваться, и цветом оно не выделяется. Три
      сигнальных цвета на одном экране заставляли руководителя решать,
      к какому из них присматриваться.
   2. Потоки людей (найм / увольнение / переводы / численность) — фирменная
      гамма HR-дашбордов. Это НЕ оценка: увольнение сиреневое, а не
      красное, именно чтобы не читаться как «плохо». */
const FONT='Inter, Helvetica, Arial, sans-serif';
const C_LABEL='#2b2b2b';                    /* единственный цвет цифр на графиках */
const C_AXIS='#8a909c', C_DIV='#e4e7ec', C_ZERO='#c9cdd6';
const C_LINE='#3b6fe0', C_BENCH='#9aa0ac';

/* светофор — гамма пилюль. C_FLAT работает и на «без оценки», и на «на уровне» */
const C_GREEN='#80cf9a', C_RED='#ef8c8c', C_FLAT='#c7c8cc';

/* потоки людей */
const C_HIRE='#97dece',      /* найм, приход */
      C_HIRE_D='#0ea293',    /* найм, насыщенный тон */
      C_HIRE_I='#009dae',    /* внутренний найм */
      C_FIRE='#ac87c5',      /* увольнение, уход */
      C_TR_IN='#85cdfd',     /* перевод внутрь */
      C_TR_OUT='#3c84ab',    /* перевод наружу */
      C_CNT='#c7c8cc',       /* численность, итоги */
      C_OTHER='#686d76';     /* прочее */
const C_IN=C_HIRE, C_OUT=C_FIRE, C_TOTAL=C_CNT;   /* старые имена — для экранов */

/* Цвета отдельных метрик. Раньше они стояли литералами в screens/*.js —
   это была третья палитра помимо :root и этого файла, и при смене оттенка
   приходилось искать по всем экранам. Контроль: grep по screens/*.js — пусто. */
const C_VAC='#7fb0c8',        /* открытые вакансии */
      C_UNDER='#c08a3e',      /* недоработчики */
      C_LOWPERF='#b4576f',    /* лоу-перформеры */
      C_OFFICE='#5f86c2',     /* посещаемость офиса в календаре */
      C_REGRET='#e8918f',     /* нежелательный уход */
      C_NOREG='#9aa8bd',      /* обычный уход */
      C_TURN_Y='#8b6fc0';     /* текучесть накопительная */
const PALETTE=[C_TR_IN,C_HIRE_I,C_HIRE_D,C_HIRE,C_FIRE,C_TR_OUT,C_CNT,C_OTHER];

/* ---------- Утилиты ---------- */
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function num(v){return Math.round(v*100)/100}
function textW(s,size){return String(s).length*size*0.56}
function mLabel(i){const m=CD.MONTHS[i];return m.label+' '+m.y}
/* ---------- Единый конструктор подсказки ----------
   Один формат на все подсказки отчёта. Иерархия сверху вниз: контекст (месяц,
   категория) мелким приглушённым, затем пары «подпись — значение» с маркером
   серии, снизу служебное за волосяной линией.

   Раньше каждое место собирало строку руками, и получалось два блочных <b>
   подряд — заголовок и значение, — между которыми висел обрубок «Имя метрики:».
   Жирным было всё, и глазу не за что было зацепиться.

   Живёт в draw.js, а не в ui.js, только из-за порядка загрузки: draw.js
   не может звать ui.js. ui.js реэкспортирует это как U.tipAttr — у экранов
   одна точка входа.

   {title, text, rows:[{label,value,color,dash}], note:'…'|['…','…']}
   Все поля необязательны. Строк-значений держим не больше трёх, сносок — двух:
   подсказка объясняет точку, а не заменяет таблицу.

   ВАЖНО: конструктор экранирует входы САМ. Вызывающий передаёт сырой текст,
   без esc() — иначе в подсказке будут видны &quot; и &amp;. */
function tipHtml(o){
  if(o==null)return '';
  if(typeof o==='string')return o;          /* строку тоже принимаем: не все места объектные */
  let s='';
  if(o.title)s+='<span class="t-h">'+esc(o.title)+'</span>';
  if(o.text)s+='<span class="t-x">'+esc(o.text)+'</span>';
  (o.rows||[]).forEach((r,i)=>{
    if(!r)return;
    const mk=r.color
      ? '<i class="t-m'+(r.dash?' dash':'')+'" style="'+
        (r.dash?'border-top-color:':'background:')+r.color+'"></i>'
      : '';
    s+='<span class="t-r'+(i?'':' pri')+'">'+mk+
       '<span class="t-l">'+esc(r.label)+'</span>'+
       '<b class="t-v">'+esc(r.value)+'</b></span>';
  });
  const ns=o.note==null?[]:(Array.isArray(o.note)?o.note:[o.note]);
  ns.forEach(n=>{if(n)s+='<span class="t-n">'+esc(n)+'</span>'});
  return s;
}
/* data-tip читает делегированный обработчик в ui.js */
function tip(o){return ' data-tip="'+esc(tipHtml(o))+'"'}

/* Верхняя граница шкалы — «круглое» число не ниже максимума. Низ всегда 0. */
function niceMax(vals){
  let m=0;
  vals.forEach(v=>{if(v!=null&&isFinite(v)&&Math.abs(v)>m)m=Math.abs(v)});
  if(m===0)return 1;
  const p=Math.pow(10,Math.floor(Math.log10(m))), n=m/p;
  const s=n<=1?1:n<=1.2?1.2:n<=1.5?1.5:n<=2?2:n<=2.5?2.5:n<=3?3:n<=4?4:n<=5?5:n<=6?6:n<=8?8:10;
  return s*p;
}

/* halo — белая подложка под цифрой: текст рисуется ДВАЖДЫ — сначала
   толстой белой обводкой, потом заливкой поверх. paint-order НЕ используем:
   если целевой инструмент его не знает, обводка ляжет поверх глифа и съест цифру.
   Обе копии несут один класс и одну задержку, иначе подложка мигнёт раньше текста. */
function txt(x,y,s,o){
  o=o||{};
  const common='<text x="'+num(x)+'" y="'+num(y)+'" font-size="'+(o.size||11)+'"'
    +(o.weight?' font-weight="'+o.weight+'"':'')
    +sAttr(o.s)
    +' text-anchor="'+(o.anchor||'middle')+'"'
    +(o.cls?' class="'+o.cls+'"':'')
    +(o.delay?' style="animation-delay:'+o.delay+'ms"':'');
  const body='>'+esc(s)+'</text>';
  const face=common+' fill="'+(o.fill||C_LABEL)+'"'+body;
  if(!o.halo)return face;
  return common+' fill="#fff" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"'
    +' aria-hidden="true"'+body+face;
}
function line(x1,y1,x2,y2,color,w,dash){
  return '<line x1="'+num(x1)+'" y1="'+num(y1)+'" x2="'+num(x2)+'" y2="'+num(y2)+'"'
    +' stroke="'+color+'" stroke-width="'+(w||1)+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
}
function rect(x,y,w,h,fill,r,extra){
  return '<rect x="'+num(x)+'" y="'+num(y)+'" width="'+num(Math.max(0,w))+'" height="'+num(Math.max(0,h))+'"'
    +(r?' rx="'+r+'"':'')+' fill="'+fill+'"'+(extra||'')+'/>';
}
/* Бар со скруглением ТОЛЬКО сверху. Низ ровный — правило 4. */
function barUp(x,y,w,h,fill,extra){
  h=Math.max(0,h);
  const r=Math.min(3,w/2,h);
  if(h<=0.5)return'';
  return '<path d="M'+num(x)+' '+num(y+h)+'V'+num(y+r)+'Q'+num(x)+' '+num(y)+' '+num(x+r)+' '+num(y)
    +'H'+num(x+w-r)+'Q'+num(x+w)+' '+num(y)+' '+num(x+w)+' '+num(y+r)+'V'+num(y+h)+'Z"'
    +' fill="'+fill+'"'+(extra||'')+'/>';
}
/* Бар вниз от нуля — зеркало barUp: верх прижат к оси и ровный,
   скругляется нижний край. Правило одно: мягкий край смотрит от нуля. */
function barDown(x,y,w,h,fill,extra){
  h=Math.max(0,h);
  const r=Math.min(3,w/2,h);
  if(h<=0.5)return'';
  return '<path d="M'+num(x)+' '+num(y)+'V'+num(y+h-r)+'Q'+num(x)+' '+num(y+h)+' '+num(x+r)+' '+num(y+h)
    +'H'+num(x+w-r)+'Q'+num(x+w)+' '+num(y+h)+' '+num(x+w)+' '+num(y+h-r)+'V'+num(y)+'Z"'
    +' fill="'+fill+'"'+(extra||'')+'/>';
}
function svg(w,h,body,cls){
  return '<svg viewBox="0 0 '+num(w)+' '+num(h)+'" width="'+num(w)+'" height="'+num(h)+'"'
    +' class="chart'+(cls?' '+cls:'')+'" font-family="'+FONT+'"'
    +' role="img" style="display:block;overflow:visible">'+body+'</svg>';
}

/* Заголовок графика, имя панели в drawPanels и .bt-cap в разметке — ОДНА роль.
   Раньше они выглядели по-трём разному и читались как три разных уровня. */
const TTL_SZ=12, TTL_W=700, C_INK='#1f1f1f';

/* ---------- Серии ----------
   Легенда — не картинка, а список серий графика. Порядок пунктов
   легенды совпадает с порядком id: seriesOf(kind,legend)[i] — серия i-го пункта.

   ВАЖНО: id серии живёт в ОТДЕЛЬНОМ атрибуте data-s, а НЕ в class.
   В классе уже лежат `bar up`, `bar dn`, `ln`, `lnb`, `dot` — и smoke.js
   сверяет эти литералы посимвольно. Любой лишний класс там ломает проверку. */
const SERIES={line:['main','bench'],diverge:['up','dn'],
              waterfall:['total','in','out'],bars:['main']};
/* каскад держится на композиции — выключать типы столбцов в нём бессмысленно,
   остаётся только подсветка */
const LOCKED={waterfall:1};
const C_OFF='#c7c8cc';
function seriesOf(kind,legend){
  if(!legend||!legend.length)return[];
  const ids=SERIES[kind]||[];
  return legend.map((it,i)=>ids[i]||'');
}
function sAttr(sid){return sid?' data-s="'+sid+'"':''}
const NOSET={has:function(){return false},size:0};
function offOf(o){return (o&&o.off&&o.off.has)?o.off:NOSET}

/* ---------- Шапка: заголовок слева, легенда справа ----------
   Легенда называет серии своими именами: «Платформенные сервисы» и «всё HQ IT»,
   а не «значение» и «база сравнения» — иначе непонятно, что за синяя линия. */
function header(w,title,legend,ctx){
  ctx=ctx||{};
  const off=ctx.off, lock=LOCKED[ctx.kind];
  let s='';
  if(title)s+=txt(0,12,title,{size:TTL_SZ,weight:TTL_W,fill:C_INK,anchor:'start'});
  if(legend&&legend.length){
    const ids=seriesOf(ctx.kind,legend);
    let x=w;
    for(let i=legend.length-1;i>=0;i--){
      const it=legend[i], sid=ids[i], tw=textW(it.name,11.5);
      const dead=!!(sid&&off&&off.has&&off.has(sid));
      const col=dead?C_OFF:it.color;
      x-=tw;
      const tx=x, mx=x-6-16;
      let g='';
      g+=txt(tx,12,it.name,{size:11.5,fill:dead?C_AXIS:C_LABEL,anchor:'start'});
      g+=it.dash?line(mx,8.5,mx+16,8.5,col,2.2,'5 3'):rect(mx,4.5,16,8,col,2);
      /* выключенная серия — не просто бледнее: бледное читается как «малое
         значение». Перечёркиваем подпись — это однозначное «скрыто». */
      if(dead)g+=line(tx-1,8.5,tx+tw+1,8.5,C_AXIS,1.2);
      if(!sid){s+=g;x-=16+14;continue}
      /* По <text> клик ловится только по глифам — между буквами дыры.
         Поэтому сверху лежит прозрачная ловушка на весь пункт. */
      s+='<g class="lg'+(lock?' lock':'')+(dead?' dead':'')+'" data-sid="'+sid+'"'
        +' tabindex="0" role="button"'
        +' aria-pressed="'+(dead?'false':'true')+'"'
        +' aria-label="'+esc(it.name)+(lock?'':(dead?': включить':': скрыть'))+'">'
        +g
        +'<rect class="hit" x="'+num(mx-4)+'" y="0" width="'+num(tw+16+6+8)+'" height="18"/>'
        +'</g>';
      x-=16+14;
    }
  }
  return s;
}
function headH(title,legend){return (title||(legend&&legend.length))?24:0}

/* ---------- Ось X: месяцы + границы календарных лет ----------
   Одна функция на все графики и НИКАКИХ режимов: раньше у верхних панелей
   год не подписывался, и выходило, что один и тот же январь на соседних
   панелях подписан по-разному. Год стоит под первым месяцем и под каждым
   январём — везде. */
function axisX(x0,bandW,plotTop,plotBot,labelY){
  let s='';
  CD.MONTHS.forEach((m,i)=>{
    const cx=x0+bandW*(i+0.5);
    s+=txt(cx,labelY,m.label,{size:10.5,fill:C_AXIS});
    if(m.isYearStart&&i>0&&plotBot>plotTop)s+=line(x0+bandW*i,plotTop,x0+bandW*i,plotBot,C_DIV,1,'4 3');
    if(i===0||m.isYearStart)s+=txt(cx,labelY+12,m.y,{size:10.5,weight:700,fill:C_AXIS});
  });
  return s;
}
/* ---------- Единая геометрия графиков ----------
   Все виды считают отступы от этих констант и ни одного числа в коде
   больше не пишут: разъехавшиеся на пару пикселей отступы читаются как грязь. */
const AXIS_H=30;        /* месяц + год под ним — единая высота оси везде */
const HEAD_GAP=8;       /* воздух под заголовком — один на все графики */
const VAL_SZ=11, VAL_W=700;  /* ЕДИНСТВЕННЫЙ кегль подписи значения */
const VAL_DY=9;         /* отступ базовой линии подписи от марки */
const VAL_ASC=8.5;      /* высота цифры при VAL_SZ */
/* место над самой высокой маркой: подпись целиком плюс воздух до заголовка */
const LBL_ROOM=Math.ceil(VAL_DY+VAL_ASC+HEAD_GAP);   /* = 26 */
const PAD_X=6;          /* боковые поля области построения — включая календарь */
const DRAW_MS=760;      /* столько же длится отрисовка линии в CSS (.ln) */
/* Воздух между двумя графиками, стоящими друг под другом. ОДНА величина на два
   разных механизма, и в этом весь смысл константы:
     · внутри chart('panels') панели рисуются в одном SVG — здесь это отступ
       между осью X верхней панели и заголовком нижней;
     · два отдельных chart() в одной панели разделяет CSS-зазор `--chart-gap`
       в `.split-r .panel-b`.
   Пока величины расходились, «Найм, отток и переводы» показывал ~25px между
   графиками, а «Отток и текучесть» ~42px — заголовок нижнего графика липнул
   к оси верхнего, и на соседних вкладках одно и то же расстояние читалось
   по-разному. Меняешь здесь — меняй `--chart-gap` в styles.css, это сверяет
   отдельная проверка в smoke.js. */
const STACK_GAP=26;
/* общие атрибуты подписи значения: один кегль, одна жирность, белая подложка */
function valOpt(o){return Object.assign({size:VAL_SZ,weight:VAL_W,halo:true,cls:'fade'},o||{})}

/* ============================================================================
   1. Линейный график
   ========================================================================== */
function drawLine(a,w,h){
  const key=a.metricKey, ser=a.series, bench=a.bench, o=a.opt||{};
  const nm=CD.METRIC_BY_KEY[key]||{};
  const hh=headH(o.title,o.legend);
  h=h||o.h||300;
  /* Значение базы в конце линии убрано: непонятно, что это за число.
     База читается по тултипу, поэтому справа больше не нужен вылет. */
  const plotTop=hh+LBL_ROOM, plotBot=h-AXIS_H;
  const x0=PAD_X, plotW=w-PAD_X*2, bandW=plotW/CD.N;
  /* выключенная серия уходит и из шкалы, и из подсказки: просто спрятать
     линию, оставив её в расчёте максимума, — значит оставить пустое место ни о чём */
  const off=offOf(o);
  const showMain=!off.has('main'), showBench=!!bench&&!off.has('bench');
  const all=(showMain?ser.slice():[]).concat(showBench?bench:[]);
  if(o.kpi){all.push(o.kpi.green);all.push(o.kpi.red)}
  const max=niceMax(all);
  const Y=v=>plotBot-(v/max)*(plotBot-plotTop);

  let s=header(w,o.title,o.legend,{kind:'line',off:o.off});
  s+=axisX(x0,bandW,plotTop,plotBot,plotBot+15);
  s+=line(x0,plotBot,x0+plotW,plotBot,C_ZERO,1);

  if(o.kpi){
    [['green',C_GREEN],['red',C_RED]].forEach(([k,c])=>{
      const y=Y(o.kpi[k]);
      s+=line(x0,y,x0+plotW,y,c,1.4,'2 3');
      /* подпись живёт ПОД своим пунктиром: над линией она наезжала на подпись точки */
      s+=txt(x0+plotW-2,y+VAL_DY+2,'KPI '+CD.fmtVal(key,o.kpi[k]),valOpt({anchor:'end'}));
    });
  }

  /* база — пунктир, и пунктир нельзя рисовать через dashoffset (это тот же
     атрибут), поэтому у неё отдельный класс с обычным проявлением */
  if(showBench){
    let d='';
    bench.forEach((v,i)=>{d+=(i?'L':'M')+num(x0+bandW*(i+0.5))+' '+num(Y(v))});
    s+='<path class="lnb"'+sAttr('bench')+' d="'+d+'" fill="none" stroke="'+C_BENCH+'" stroke-width="2" stroke-dasharray="5 3"/>';
  }

  /* pathLength="1" приводит длину любой ломаной к единице — только так линию
     можно рисовать слева направо одним CSS-правилом, без знания геометрии */
  if(showMain){
    let d='';
    ser.forEach((v,i)=>{d+=(i?'L':'M')+num(x0+bandW*(i+0.5))+' '+num(Y(v))});
    s+='<path class="ln"'+sAttr('main')+' pathLength="1" d="'+d+'" fill="none" stroke="'+C_LINE+'"'
      +' stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
  }

  ser.forEach((v,i)=>{
    const cx=x0+bandW*(i+0.5), cy=Y(v);
    /* база — не сноска, а вторая строка значений: сравнивают именно её с первой,
       и маркеры здесь те же, что в легенде графика */
    const t={title:mLabel(i),
      rows:(showMain?[{label:nm.name||key,value:CD.fmtVal(key,v),color:C_LINE}]:[])
        .concat(showBench?[{label:o.benchName||'база',value:CD.fmtVal(key,bench[i]),
                        color:C_BENCH,dash:true}]:[])};
    /* точка вспыхивает ровно тогда, когда до неё дошла линия */
    const dly=DRAW_MS*(i/Math.max(1,ser.length-1))*0.9;
    s+='<g class="ptg"'+tip(t)+'>';
    s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(hh)+'" width="'+num(bandW)+'" height="'+num(plotBot-hh)+'"/>';
    if(showBench)s+='<circle class="dotb"'+sAttr('bench')+' cx="'+num(cx)+'" cy="'+num(Y(bench[i]))+'" r="0" fill="'+C_BENCH+'"/>';
    if(showMain)s+='<circle class="dot"'+sAttr('main')+' cx="'+num(cx)+'" cy="'+num(cy)+'" r="3.4" fill="#fff" stroke="'+C_LINE+'"'
      +' stroke-width="2" style="animation-delay:'+num(dly)+'ms"/>';
    s+='</g>';
    /* подпись выходит ОДНОВРЕМЕННО со своей точкой: цифра и точка — это один
       факт, и появляться они должны вместе, вслед за кончиком линии */
    if(showMain)s+=txt(cx,cy-VAL_DY,CD.fmtVal(key,v),valOpt({delay:dly,s:'main'}));
  });
  return svg(w,h,s);
}

/* ============================================================================
   2. Бары по месяцам
   ========================================================================== */
function drawBars(a,w,h){
  const key=a.metricKey, ser=a.series, o=a.opt||{};
  const nm=CD.METRIC_BY_KEY[key]||{};
  const hh=headH(o.title,o.legend);
  h=h||o.h||280;
  const plotTop=hh+LBL_ROOM, plotBot=h-AXIS_H;
  const x0=PAD_X, plotW=w-PAD_X*2, bandW=plotW/CD.N;
  const max=niceMax(ser);
  const Y=v=>plotBot-(v/max)*(plotBot-plotTop);
  const bw=Math.min(46,bandW*0.66);

  let s=header(w,o.title,o.legend,{kind:'bars',off:o.off});
  s+=axisX(x0,bandW,plotTop,plotBot,plotBot+15);
  s+=line(x0,plotBot,x0+plotW,plotBot,C_ZERO,1);
  const col=o.color||C_LINE;
  ser.forEach((v,i)=>{
    const cx=x0+bandW*(i+0.5), y=Y(v);
    const t={title:mLabel(i),rows:[{label:nm.name||key,value:CD.fmtVal(key,v),color:col}]};
    s+='<g class="barg"'+tip(t)+'>';
    s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(hh)+'" width="'+num(bandW)+'" height="'+num(plotBot-hh)+'"/>';
    s+=barUp(cx-bw/2,y,bw,plotBot-y,col,' class="bar up"'+sAttr('main')+' style="animation-delay:'+(i*26)+'ms"');
    s+='</g>';
    s+=txt(cx,y-VAL_DY,CD.fmtVal(key,v),valOpt({delay:240+i*26,s:'main'}));
  });
  return svg(w,h,s);
}

/* ============================================================================
   3. Дивергентные бары: пришли вверх, ушли вниз — СТРОГО в одной вертикали,
      как один бар, разрезанный осью X. Не рядом: рядом стоящие бары читаются
      как две разные категории, а это один поток в двух направлениях.
      Шкала одна на оба плеча, иначе плечи визуально несравнимы.
   ========================================================================== */
function drawDiverge(a,w,h){
  const up=a.up, down=a.down, o=a.opt||{};
  const upKey=o.upKey||a.upKey, downKey=o.downKey||a.downKey;
  const upName=o.upName||(CD.METRIC_BY_KEY[upKey]||{}).name||'Пришли';
  const downName=o.downName||(CD.METRIC_BY_KEY[downKey]||{}).name||'Ушли';
  const hh=headH(o.title,o.legend);
  h=h||o.h||320;
  const top=hh+LBL_ROOM, bot=h-AXIS_H;
  const off=offOf(o);
  const showUp=!off.has('up'), showDn=!off.has('dn');
  const x0=PAD_X, plotW=w-PAD_X*2, bandW=plotW/CD.N;

  /* На одном плече дивергент ПЕРЕСТРАИВАЕТСЯ, а не просто теряет половину:
     оставшаяся пустая половина читалась бы как «там нули». Остался найм — ноль
     уезжает вниз и это обычный бар-чарт; остался отток — ноль уезжает наверх,
     бары растут вниз, а снизу резервируется место под подписи значений.
     Подписи месяцев в обоих случаях остаются под графиком. */
  let zero, armUp, armDn, max;
  if(showUp&&showDn){
    zero=top+(bot-top)/2;
    /* одна шкала на верх и низ; из плеча вычитается место под подпись */
    armUp=armDn=Math.max(8,(bot-top)/2-LBL_ROOM);
    max=niceMax(up.concat(down));
  }else if(showUp){
    zero=bot; armUp=Math.max(8,bot-top); armDn=0;
    max=niceMax(up);
  }else{
    zero=top; armUp=0; armDn=Math.max(8,bot-top-LBL_ROOM);
    max=niceMax(down);
  }
  const bw=Math.min(40,bandW*0.58);        /* толще, раз бары больше не делят полосу */

  let s=header(w,o.title,o.legend,{kind:'diverge',off:o.off});
  s+=axisX(x0,bandW,top,bot,bot+15);
  s+=line(x0,zero,x0+plotW,zero,C_ZERO,1);

  up.forEach((v,i)=>{
    const cx=x0+bandW*(i+0.5);
    const hu=showUp?(v/max)*armUp:0, hd=showDn?(down[i]/max)*armDn:0;
    /* оба плеча — равноправные строки значений: это один поток в двух
       направлениях, и нижнее плечо не служебная сноска */
    const t={title:mLabel(i),rows:(showUp?[
      {label:upName,value:CD.fmtVal(upKey,v),color:C_IN}]:[]).concat(showDn?[
      {label:downName,value:CD.fmtVal(downKey,down[i]),color:C_OUT}]:[])};
    s+='<g class="barg"'+tip(t)+'>';
    s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(hh)+'" width="'+num(bandW)+'" height="'+num(bot-hh)+'"/>';
    if(showUp)s+=barUp(cx-bw/2,zero-hu,bw,hu,C_IN,' class="bar up"'+sAttr('up')+' style="animation-delay:'+(i*26)+'ms"');
    if(showDn)s+=barDown(cx-bw/2,zero,bw,hd,C_OUT,' class="bar dn"'+sAttr('dn')+' style="animation-delay:'+(i*26)+'ms"');
    s+='</g>';
    /* подписи только чёрные — правило 3 */
    if(showUp)s+=txt(cx,zero-hu-VAL_DY,CD.fmtVal(upKey,v),valOpt({delay:240+i*26,s:'up'}));
    if(showDn)s+=txt(cx,Math.min(zero+hd+VAL_DY+4,bot-2),CD.fmtVal(downKey,down[i]),valOpt({delay:240+i*26,s:'dn'}));
  });
  return svg(w,h,s);
}

/* ============================================================================
   4. Панели друг под другом. У КАЖДОЙ своя ось X под ней: одна общая ось внизу
      заставляла глазами бегать через весь блок. Каждая шкала — от нуля.
   ========================================================================== */
function drawPanels(a,w,h){
  const ps=a.panels, o=a.opt||{};
  const x0=PAD_X, plotW=w-PAD_X*2, bandW=plotW/CD.N;
  /* GAP и HEAD урезаны на 4 и 2 пикселя ровно на то, на сколько вырос LBL_ROOM
     (18 → 26): иначе трёхпанельный график растёт на 24px и в правой панели
     появляется скролл. */
  const GAP=STACK_GAP;     /* воздух между осью X и заголовком следующей панели */
  const HEAD=16;           /* полоса заголовка панели — в неё график не заходит */
  const PLOT_MIN=70;
  /* заголовок + место под подпись самого высокого бара + график + ось + воздух */
  const minPanel=HEAD+LBL_ROOM+PLOT_MIN+AXIS_H+GAP;
  h=Math.max(h||o.h||340,ps.length*minPanel+14);
  const panelH=(h-14)/ps.length;
  let s='';
  ps.forEach((p,pi)=>{
    const base=pi*panelH;
    /* бары и их подписи начинаются СТРОГО под заголовком: раньше самый
       высокий бар на экране вакансий наезжал на имя панели */
    const top=base+HEAD+LBL_ROOM;
    const bot=base+panelH-AXIS_H-GAP;
    const max=niceMax(p.series);
    const Y=v=>bot-(v/max)*(bot-top);
    const nm=CD.METRIC_BY_KEY[p.key]||{};
    s+=txt(0,base+11,p.name,{size:TTL_SZ,weight:TTL_W,fill:C_INK,anchor:'start'});
    s+=line(x0,bot,x0+plotW,bot,C_ZERO,1);
    CD.MONTHS.forEach((m,i)=>{if(m.isYearStart&&i>0)s+=line(x0+bandW*i,top,x0+bandW*i,bot,C_DIV,1,'4 3')});

    /* панели вступают каскадом сверху вниз, а не все разом */
    const pd=pi*140;
    if(p.type==='line'){
      let d='';
      p.series.forEach((v,i)=>{d+=(i?'L':'M')+num(x0+bandW*(i+0.5))+' '+num(Y(v))});
      s+='<path class="ln" pathLength="1" d="'+d+'" fill="none" stroke="'+(p.color||C_LINE)+'"'
        +' stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"'
        +' style="animation-delay:'+pd+'ms"/>';
      p.series.forEach((v,i)=>{
        const cx=x0+bandW*(i+0.5), cy=Y(v);
        const t={title:mLabel(i),rows:[{label:p.name,value:CD.fmtVal(p.key,v),color:p.color||C_LINE}]};
        const dly=pd+DRAW_MS*(i/Math.max(1,p.series.length-1))*0.9;
        s+='<g class="ptg"'+tip(t)+'>';
        s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(top-12)+'" width="'+num(bandW)+'" height="'+num(bot-top+12)+'"/>';
        s+='<circle class="dot" cx="'+num(cx)+'" cy="'+num(cy)+'" r="3.1" fill="#fff" stroke="'+(p.color||C_LINE)+'"'
          +' stroke-width="1.9" style="animation-delay:'+num(dly)+'ms"/>';
        s+='</g>';
        s+=txt(cx,cy-VAL_DY,CD.fmtVal(p.key,v),valOpt({delay:dly}));
      });
    } else {
      const bw=Math.min(42,bandW*0.64);
      p.series.forEach((v,i)=>{
        const cx=x0+bandW*(i+0.5), y=Y(v);
        const t={title:mLabel(i),rows:[{label:p.name,value:CD.fmtVal(p.key,v),color:p.color||C_LINE}]};
        s+='<g class="barg"'+tip(t)+'>';
        s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(top-12)+'" width="'+num(bandW)+'" height="'+num(bot-top+12)+'"/>';
        s+=barUp(cx-bw/2,y,bw,bot-y,p.color||C_LINE,' class="bar up" style="animation-delay:'+(pd+i*24)+'ms"');
        s+='</g>';
        s+=txt(cx,y-VAL_DY,CD.fmtVal(p.key,v),valOpt({delay:pd+300+i*24}));
      });
    }
    /* у каждой панели СВОЯ полная ось — с месяцами и годами, как везде.
       Отступ подписи от оси тот же, что у остальных видов (bot+15): пара
       пикселей разницы читалась как «панели устроены немного иначе». */
    s+=axisX(x0,bandW,bot,bot,bot+15);
  });
  return svg(w,h,s);
}

/* ============================================================================
   5. Водопад баланса. Итоги — серые (это уровни, а не изменения),
      приход и уход — пастельные. Все подписи чёрные.
   ========================================================================== */
function drawWaterfall(a,w,h){
  const steps=a.steps, o=a.opt||{};
  const hh=headH(o.title,o.legend);
  h=h||o.h||320;
  const plotTop=hh+LBL_ROOM, plotBot=h-AXIS_H;
  const x0=PAD_X, plotW=w-PAD_X*2, bandW=plotW/steps.length;
  let acc=0; const lv=[];
  steps.forEach(st=>{
    if(st.total){acc=st.value;lv.push({from:0,to:st.value,total:true})}
    else{const from=acc;acc+=st.value;lv.push({from,to:acc,total:false})}
  });
  const max=niceMax(lv.map(x=>Math.max(x.from,x.to)));
  const Y=v=>plotBot-(v/max)*(plotBot-plotTop);
  const bw=Math.min(74,bandW*0.62);

  let s=header(w,o.title,o.legend,{kind:'waterfall'});
  s+=line(x0,plotBot,x0+plotW,plotBot,C_ZERO,1);
  steps.forEach((st,i)=>{
    const cx=x0+bandW*(i+0.5), g=lv[i];
    const yTop=Y(Math.max(g.from,g.to)), yBot=Y(Math.min(g.from,g.to));
    const col=st.total?C_TOTAL:(st.value>=0?C_IN:C_OUT);
    const sid=st.total?'total':(st.value>=0?'in':'out');
    const lab=(st.total?'':(st.value>0?'+':''))+CD.fmtInt(st.value);
    const t={title:st.name,
      rows:[{label:st.total?'Уровень':'Изменение',value:lab,color:col}],
      note:st.total?null:'накоплено: '+CD.fmtInt(g.to)+' чел'};
    s+='<g class="barg"'+tip(t)+'>';
    s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(hh)+'" width="'+num(bandW)+'" height="'+num(plotBot-hh)+'"/>';
    s+=barUp(cx-bw/2,yTop,bw,Math.max(2,yBot-yTop),col,' class="bar up"'+sAttr(sid)+' style="animation-delay:'+(i*34)+'ms"');
    s+='</g>';
    s+=txt(cx,yTop-VAL_DY,lab,valOpt({delay:240+i*34,s:sid}));
    s+=txt(cx,plotBot+15,st.name,{size:10.5,fill:C_AXIS});
    if(i<steps.length-1)s+=line(cx+bw/2,Y(g.to),x0+bandW*(i+1.5)-bw/2,Y(g.to),C_DIV,1,'3 2');
  });
  return svg(w,h,s);
}

/* ============================================================================
   6. Воронка. Полосы центрированы по вертикальной оси, поэтому силуэт
      действительно сужается — это воронка, а не столбик горизонтальных баров.
      Слева от полосы — фактическое значение, справа — конверсия к предыдущему
      этапу. Названия этапов над полосой.
   ========================================================================== */
function drawFunnel(a,w,h){
  const items=a.items, o=a.opt||{};
  const hh=headH(o.title,o.legend);
  const n=items.length;
  h=h||o.h||(hh+n*62+16);
  const rowH=(h-hh-12)/n;
  const max=niceMax(items.map(x=>x.value));
  const cx=w/2;
  const sideW=64;                                  /* колонки под цифры слева и справа */
  const maxBar=Math.max(60,w-sideW*2-20);
  let s=header(w,o.title,o.legend);
  items.forEach((it,i)=>{
    const y=hh+i*rowH+16, bh=Math.max(14,rowH-26);
    const bwv=(it.value/max)*maxBar;
    const conv=i>0&&items[i-1].value?(it.value/items[i-1].value*100):null;
    const t={title:it.name,
      rows:[{label:'Значение',value:CD.fmtInt(it.value),color:PALETTE[i%PALETTE.length]}],
      note:[conv!=null?'конверсия с предыдущего этапа: '+conv.toFixed(0)+'%':null,
            'от первого этапа: '+(items[0].value?(it.value/items[0].value*100).toFixed(0):'—')+'%']};
    s+=txt(cx,y-4,it.name,{size:11,weight:600,fill:C_AXIS});
    s+='<g class="barg"'+tip(t)+'>';
    s+='<rect class="hit" x="0" y="'+num(y-14)+'" width="'+num(w)+'" height="'+num(bh+18)+'"/>';
    s+=rect(cx-bwv/2,y,bwv,bh,PALETTE[i%PALETTE.length],3,' class="bar fn" style="animation-delay:'+(i*40)+'ms"');
    s+='</g>';
    s+=txt(cx-bwv/2-8,y+bh*0.72,CD.fmtInt(it.value),valOpt({anchor:'end',delay:200+i*40}));
    if(conv!=null)s+=txt(cx+bwv/2+8,y+bh*0.72,conv.toFixed(0)+'%',valOpt({anchor:'start',delay:200+i*40}));
    /* соединители, подчёркивающие сужение */
    if(i<n-1){
      const nb=(items[i+1].value/max)*maxBar, ny=hh+(i+1)*rowH+16;
      s+='<path class="fnlink" d="M'+num(cx-bwv/2)+' '+num(y+bh)+'L'+num(cx-nb/2)+' '+num(ny)
        +'M'+num(cx+bwv/2)+' '+num(y+bh)+'L'+num(cx+nb/2)+' '+num(ny)+'" fill="none" stroke="'+C_DIV+'" stroke-width="1"/>';
    }
  });
  return svg(w,h,s);
}

/* ============================================================================
   7. Спарклайны.
      Ширина 100% с preserveAspectRatio="none": в таблице OnePager колонка
      «12 мес» тянется вместе с окном, и спарклайн должен тянуться с ней.
      Текста внутри нет, поэтому растяжение ничего не искажает.

      Цвет — ПО МЕСЯЦАМ, а не один на весь ряд: раньше метрика хуже базы
      красила все 12 баров, хотя часть месяцев была лучше. Теперь каждый бар
      сравнивается со своим месяцем базы.
   ========================================================================== */
function sparkSvg(w,h,body){
  return '<svg viewBox="0 0 '+num(w)+' '+num(h)+'" width="100%" height="'+num(h)+'"'
    +' preserveAspectRatio="none" class="spark" role="img" style="display:block">'+body+'</svg>';
}
/* Цвет светофора берётся из гаммы пилюль — бар и пилюля рядом должны читаться
   как одна и та же оценка, а не как два разных языка. */
/* warn сюда тоже попадает и красится серым — отдельного цвета у него больше нет */
function stateColor(st){return st==='good'?C_GREEN:st==='bad'?C_RED:C_FLAT}

function sparkBars(series,state,w,h,o){
  o=o||{};w=w||120;h=h||26;
  const n=series.length, gap=w/n, bw=gap*0.68;
  const key=o.key, base=o.base, flat=o.flat;
  /* Шкала. От нуля столбики честны по величине, но при малом размахе
     (численность 175 → 191) все двенадцать месяцев выглядят одинаково и
     динамика пропадает. Поэтому при размахе меньше 40% от максимума низ
     шкалы поднимается под минимум ряда: колонка «12 мес» показывает форму
     изменения, а точные значения всё равно живут в подсказке и соседних
     столбцах. Полный масштаб от нуля остаётся на детальных графиках. */
  const mn=Math.min.apply(null,series), mx=Math.max.apply(null,series), rng=mx-mn;
  let lo=0, hi=niceMax(series);
  if(rng>0&&mx>0&&rng/mx<0.4){lo=Math.max(0,mn-rng*0.45);hi=mx+rng*0.12}
  const span=(hi-lo)||1;
  let s='';
  series.forEach((v,i)=>{
    const bh=Math.max(1.5,((v-lo)/span)*(h-2));
    /* окраска месяца: сравниваем с базой ЭТОГО месяца */
    const st=(flat||!base||!key)?state
      :CD.compareState(key,v,base[i]);
    const t=key?{title:mLabel(i),
      rows:[{label:(CD.METRIC_BY_KEY[key]||{}).name||'',value:CD.fmtVal(key,v),color:stateColor(st)}]
        .concat(base?[{label:'база',value:CD.fmtVal(key,base[i]),color:C_BENCH,dash:true}]:[])}:null;
    s+='<g class="sbg"'+(t?tip(t):'')+'>';
    s+='<rect class="hit" x="'+num(i*gap)+'" y="0" width="'+num(gap)+'" height="'+num(h)+'"/>';
    s+=rect(i*gap+(gap-bw)/2,h-bh,bw,bh,stateColor(st),1,' class="sb"');
    s+='</g>';
  });
  return sparkSvg(w,h,s);
}
function sparkLine(series,state,w,h,o){
  o=o||{};w=w||120;h=h||26;
  const max=niceMax(series), n=series.length;
  const col=stateColor(state), key=o.key, base=o.base;
  /* PAD — не косметика: svg тянется preserveAspectRatio="none", и точка радиусом 2
     на самом краю viewBox срезалась ровно наполовину. Отступ по краям и сверху
     держит крайние точки целиком внутри картинки. */
  const PAD=3.5, TOP=3.5;
  const X=i=>n>1?PAD+i/(n-1)*(w-2*PAD):w/2;
  const Y=v=>h-PAD-(v/max)*(h-PAD-TOP);
  let d='';
  series.forEach((v,i)=>{d+=(i?'L':'M')+num(X(i))+' '+num(Y(v))});
  let s='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.7"'
    +' stroke-linejoin="round" stroke-linecap="round"/>';
  s+='<circle cx="'+num(X(n-1))+'" cy="'+num(Y(series[n-1]))+'" r="2" fill="'+col+'"/>';
  /* Наведение: под курсором подсвечивается ИМЕННО тот месяц, о котором говорит
     тултип. Без этого по спарклайну было непонятно, какую точку он описывает.
     Всё на CSS (.spg:hover), никаких обработчиков. */
  if(key)series.forEach((v,i)=>{
    const gapw=w/n, cx=X(i), cy=Y(v);
    const t={title:mLabel(i),
      rows:[{label:(CD.METRIC_BY_KEY[key]||{}).name||'',value:CD.fmtVal(key,v),color:col}]
        .concat(base?[{label:'база',value:CD.fmtVal(key,base[i]),color:C_BENCH,dash:true}]:[])};
    s+='<g class="spg"'+tip(t)+'>';
    s+='<rect class="hit" x="'+num(i*gapw)+'" y="0" width="'+num(gapw)+'" height="'+num(h)+'"/>';
    s+='<line class="spgd" x1="'+num(cx)+'" y1="0" x2="'+num(cx)+'" y2="'+num(h)+'" stroke="'+col+'"/>';
    s+='<circle class="spdot" cx="'+num(cx)+'" cy="'+num(cy)+'" r="2.6" fill="#fff" stroke="'+col+'" stroke-width="1.6"/>';
    s+='</g>';
  });
  return sparkSvg(w,h,s);
}

/* ============================================================================
   Реестр графиков.
   chart() рисует сразу при номинальной ширине — значит smoke.js без браузера
   прогоняет весь рисовальный код. В браузере app.js вызывает remeasure(), и
   график перерисовывается под фактические размеры контейнера: кегль подписей
   остаётся 10–11px на любом экране (масштабировать SVG целиком нельзя — на
   телефоне подписи стали бы нечитаемыми, меняется геометрия).

   opt.fill — брать высоту из контейнера, а не из opt.h: график должен занимать
   всю правую панель, а не висеть маленьким в её верхней части.
   ========================================================================== */
/* ---------- Календарь посещаемости ----------
   Месячная сетка Пн–Вс: в ячейке день месяца и процент, заливка по интенсивности.

   Шкала МОНОХРОМНАЯ синяя, а не светофор, и это принципиально: 5% в субботу —
   не «плохо», офис в выходной закономерно пуст. Выходные вообще выведены из
   шкалы отдельным светлым тоном, иначе они забирали бы весь тёмный конец
   градиента на себя и будни между собой стали бы неразличимы.
   Ось Y тут отсутствует по определению, значение подписано в каждой ячейке —
   оба правила визуализации соблюдены без специальных усилий. */
const CAL_LO=[234,241,253], CAL_HI=[43,94,197];   /* #eaf1fd → #2b5ec5 */
function mixRGB(a,b,t){
  const c=[0,1,2].map(i=>Math.round(a[i]+(b[i]-a[i])*t));
  return 'rgb('+c[0]+','+c[1]+','+c[2]+')';
}
function drawCalendar(a,w,h){
  /* На вход — МАССИВ месячных блоков: окно последних 30 дней почти всегда
     пересекает границу месяцев, и тогда рядом стоят две сетки. Один блок —
     не отдельный случай, а частный: код тот же. */
  const blocks=a.blocks||[a.cal], o=a.opt||{};
  const hh=headH(o.title,o.legend);
  /* шапка дней недели живёт по тому же HEAD_GAP, что и воздух под заголовком графиков */
  const DOW_H=HEAD_GAP+9, SCALE_H=26, MON_H=17, gap=4, BLOCK_GAP=22;
  const n=blocks.length;
  const rows=Math.max.apply(null,blocks.map(b=>Math.ceil((b.first+b.days.length)/7)));
  h=h||o.h||(hh+SCALE_H+MON_H+DOW_H+rows*52);
  /* Шкала интенсивности стоит СРАЗУ ПОД ЗАГОЛОВКОМ, а не под сеткой. Снизу она
     упиралась в таблицу дней недели, которая идёт следом за графиком, и читалась
     как подпись к этой таблице, а не как легенда календаря. */
  const scaleY=hh+6, gridTop=hh+SCALE_H+MON_H+DOW_H;
  /* Потолок клетки. Без него на широкой панели сетка растягивается во всю ширину,
     клетка уходит за сотню пикселей, и месяц перестаёт читаться как месяц —
     остаются просто крупные плитки. Остаток ширины уходит в поля слева и справа:
     сетка центрируется, и прижатой к краям она больше не выглядит. */
  const CELL_MAX=72;
  /* У календаря собственное боковое поле, больше общего PAD_X. Это не область
     построения с осями, а плитка: прижатая к самым краям, она выглядит вставкой
     в панель, а не её содержимым. При одном месяце поля даёт центрирование,
     при двух сетка занимает всю ширину — и без этой константы поля схлопнулись
     бы до 6px. */
  const CAL_PAD=16;
  const availW=(w-CAL_PAD*2-BLOCK_GAP*(n-1))/n;
  const cw=Math.min(CELL_MAX,(availW-gap*6)/7);
  const ch=Math.max(22,Math.min(CELL_MAX,(h-gridTop-gap*(rows-1))/rows));
  const gridW=cw*7+gap*6, totalW=gridW*n+BLOCK_GAP*(n-1);
  const x0=Math.max(CAL_PAD,(w-totalW)/2);
  /* высота по факту содержимого: при упёршейся в потолок клетке тянуть SVG
     на всю высоту контейнера незачем — внизу будет просто пустое место */
  const hUsed=Math.min(h,gridTop+rows*ch+(rows-1)*gap);
  /* Шкала ОДНА на все блоки: свой максимум в каждом месяце красил бы одинаковый
     процент по-разному слева и справа, и сравнить месяцы стало бы нельзя. */
  const allWd=blocks.reduce((acc,b)=>acc.concat(b.days.filter(d=>!d.weekend).map(d=>d.val)),[]);
  const max=niceMax(allWd);
  const num1=v=>(+v).toFixed(1).replace('.',',');
  /* Подписи в клетке рисуются, только если помещаются. Два месяца рядом ужимают
     клетку вдвое, и втиснуть туда и число месяца, и процент уже нельзя. Тогда
     остаётся хитмап — заливка честно несёт величину, а точное число живёт
     в подсказке. Налезающие друг на друга цифры хуже их отсутствия. */
  const showVal=cw>=30&&ch>=22, showDay=ch>=34&&cw>=34;

  let s=header(w,o.title,o.legend);
  blocks.forEach((b,bi)=>{
    const bx=x0+bi*(gridW+BLOCK_GAP);
    /* подпись месяца над своей сеткой: без неё два блока рядом неразличимы */
    s+=txt(bx,hh+SCALE_H+12,b.label+' '+b.y,
      {size:TTL_SZ,weight:TTL_W,fill:C_INK,anchor:'start'});
    CD.DOW_SHORT.forEach((d,i)=>{
      s+=txt(bx+i*(cw+gap)+cw/2,gridTop-6,d,{size:10,weight:700,fill:i>=5?C_AXIS:C_LABEL});
    });
    b.days.forEach((d,di)=>{
      /* позиция считается от ПЕРВОГО дня окна в этом месяце, а не от первого
         числа: окно может начинаться с середины месяца */
      const idx=b.first+di, x=bx+(idx%7)*(cw+gap), y=gridTop+Math.floor(idx/7)*(ch+gap);
      const t=Math.max(0,Math.min(1,d.val/max));
      const fill=d.weekend?'#f4f5f7':mixRGB(CAL_LO,CAL_HI,t);
      /* на тёмной половине шкалы цифра белая, иначе её не прочесть */
      const ink=d.weekend?C_AXIS:(t>0.62?'#fff':C_LABEL);
      const dly=(bi*40)+di*9;
      s+='<g class="barg"'+tip({
        title:d.day+' '+CD.MONTH_GEN[b.m]+' '+b.y+', '+CD.DOW_NAME[d.dow].toLowerCase(),
        rows:[{label:'Посещаемость',value:num1(d.val)+' %',color:fill}],
        note:d.weekend?'выходной: офис работает по дежурствам'
                      :'среднее по будням месяца: '+num1(b.base)+' %'})+'>';
      s+=rect(x,y,cw,ch,fill,7,' class="fade" style="animation-delay:'+dly+'ms"');
      if(showDay)s+=txt(x+6,y+13,String(d.day),{size:9.5,weight:700,fill:ink,anchor:'start',
        cls:'fade',delay:dly});
      /* halo здесь не нужен: цвет цифры уже выбран под заливку ячейки */
      if(showVal)s+=txt(x+cw/2,y+(showDay?ch/2+9:ch/2+4),num1(d.val),
        {size:VAL_SZ,weight:VAL_W,fill:ink,cls:'fade',delay:60+dly});
      s+='</g>';
    });
  });

  /* шкала интенсивности: 5 ступеней плюс отдельный образец выходного дня */
  const sy=scaleY, sw=17, sh=10;
  let x=x0;      /* шкала начинается от левого края сетки, а не от края SVG */
  s+=txt(x,sy+9,'реже',{size:10.5,fill:C_AXIS,anchor:'start'});x+=textW('реже',10.5)+7;
  for(let i=0;i<5;i++){s+=rect(x,sy,sw,sh,mixRGB(CAL_LO,CAL_HI,i/4),2);x+=sw+3}
  x+=4;
  s+=txt(x,sy+9,'чаще, до '+num1(max)+' %',{size:10.5,fill:C_AXIS,anchor:'start'});
  x+=textW('чаще, до '+num1(max)+' %',10.5)+16;
  s+=rect(x,sy,sw,sh,'#f4f5f7',2);x+=sw+6;
  s+=txt(x,sy+9,'выходной',{size:10.5,fill:C_AXIS,anchor:'start'});
  return svg(w,hUsed,s);
}

const KINDS={line:drawLine,bars:drawBars,diverge:drawDiverge,panels:drawPanels,
             waterfall:drawWaterfall,funnel:drawFunnel,calendar:drawCalendar};
const NOMINAL_W=900, NOMINAL_H=null;
let _specs=new Map(), _sid=0;
/* Какие серии выключены. Живёт ОТДЕЛЬНО от _specs и НЕ чистится в reset():
   по решению заказчика выключение помнится в пределах сессии — переживает
   смену вкладки и сбрасывается только перезагрузкой страницы.
   Ключ — kind|title|cid: один cid ненадёжен (счётчик обнуляется каждый рендер),
   один заголовок — тоже (заголовков может не быть). */
const _off=new Map();

function build(spec,w,h){return KINDS[spec.kind](spec.args,Math.max(320,w),h||null)}

function chart(kind,args,opt){
  opt=Object.assign({},opt||{});
  const id='k'+(++_sid);
  opt._key=kind+'|'+(opt.title||'')+'|'+id;
  opt.off=_off.get(opt._key)||new Set();
  const spec={kind,args:Object.assign({},args,{opt}),opt};
  _specs.set(id,spec);
  return '<div class="svgchart'+(opt.fill?' fill':'')+'" data-cid="'+id+'">'+
    build(spec,NOMINAL_W,NOMINAL_H)+'</div>';
}

/* animate=true — только на первую отрисовку после рендера. На resize анимацию
   не проигрываем: дёргающиеся при каждом ресайзе графики раздражают. */
function remeasure(root,animate){
  if(!root||!root.querySelectorAll)return;
  const nodes=root.querySelectorAll('.svgchart[data-cid]');
  for(let i=0;i<nodes.length;i++){
    const el=nodes[i], sp=_specs.get(el.getAttribute('data-cid'));
    if(!sp)continue;
    const w=el.clientWidth||(el.parentNode&&el.parentNode.clientWidth)||NOMINAL_W;
    const h=sp.opt.fill?(el.clientHeight||sp.opt.h||null):(sp.opt.h||null);
    el.innerHTML=build(sp,w,h);
    if(animate){el.classList.remove('anim');void el.offsetWidth;el.classList.add('anim')}
  }
}
/* ---------- Перерисовка ОДНОГО графика ----------
   Легенде нельзя звать render(): тот пересобирает весь экран и теряет
   скролл и раскрытые строки. remeasure() тоже не годится — он перебирает все. */
function redraw(cid,hi){
  if(typeof document==='undefined')return;
  const el=document.querySelector('.svgchart[data-cid="'+cid+'"]');
  const sp=_specs.get(cid);
  if(!el||!sp)return;
  const w=el.clientWidth||(el.parentNode&&el.parentNode.clientWidth)||NOMINAL_W;
  const h=sp.opt.fill?(el.clientHeight||sp.opt.h||null):(sp.opt.h||null);
  el.innerHTML=build(sp,w,h);
  highlight(el,hi);
}

/* Подсветка серии: атрибут на контейнер плюс класс на марки активной серии.
   Через :has() не делаем — поддержка в целевом инструменте не гарантирована. */
function highlight(el,sid){
  if(!el||!el.querySelectorAll)return;
  const all=el.querySelectorAll('[data-s]');
  for(let i=0;i<all.length;i++)all[i].classList.remove('hi');
  if(!sid){el.removeAttribute('data-hi');return}
  el.setAttribute('data-hi',sid);
  const on=el.querySelectorAll('[data-s="'+sid+'"]');
  for(let i=0;i<on.length;i++)on[i].classList.add('hi');
}

/* ---------- Выключение серии по клику в легенде ---------- */
function toggleSeries(cid,sid){
  const sp=_specs.get(cid);
  if(!sp||!sid||LOCKED[sp.kind])return false;
  const ids=seriesOf(sp.kind,sp.opt.legend).filter(Boolean);
  if(ids.indexOf(sid)<0)return false;
  const off=sp.opt.off;
  if(off.has(sid))off.delete(sid);
  /* последнюю серию выключить нельзя: пустой график — не состояние данных */
  else if(ids.length-off.size<=1)return false;
  else off.add(sid);
  _off.set(sp.opt._key,off);
  redraw(cid,null);
  return true;
}

/* _off сознательно НЕ чистим — см. комментарий у его объявления */
function reset(){_specs=new Map();_sid=0}

window.TPDRAW={chart,remeasure,redraw,highlight,toggleSeries,reset,seriesOf,SERIES,LOCKED,
  sparkBars,sparkLine,niceMax,textW,esc,stateColor,tipHtml,
  FONT,PALETTE,C_LINE,C_BENCH,C_GREEN,C_RED,C_IN,C_OUT,C_LABEL,C_AXIS,C_DIV,C_TOTAL,
  C_HIRE,C_HIRE_D,C_HIRE_I,C_FIRE,C_TR_IN,C_TR_OUT,C_CNT,C_OTHER,C_FLAT,
  C_VAC,C_UNDER,C_LOWPERF,C_OFFICE,C_REGRET,C_NOREG,C_TURN_Y};
})();

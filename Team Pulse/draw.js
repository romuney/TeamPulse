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
   5. Динамика — только год к году (13.10, заказчик: «убери 12 мес»): ось X
      во всех графиках динамики — янв.–дек. календарного года, этот год
      против прошлого; текущий месяц подписан жирно и отмечен линией «вы
      здесь». Год называет легенда, а не подпись месяца: на оси оба года сразу.

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
/* Только Arial — как и во всём отчёте: в Proteus другие гарнитуры не работают.
   У Arial два начертания, поэтому веса подписей здесь тоже только 400 и 700. */
const FONT='Arial, sans-serif';
const C_LABEL='#2b2b2b';                    /* единственный цвет цифр на графиках */
const C_AXIS='#8a909c', C_DIV='#e4e7ec', C_ZERO='#c9cdd6';
const C_LINE='#245FD4', C_BENCH='#9aa0ac';

/* светофор — гамма пилюль. C_FLAT работает и на «без оценки», и на «на уровне» */
const C_GREEN='#80cf9a', C_RED='#ef8c8c', C_FLAT='#c7c8cc';

/* потоки людей. Итерация 32 — палитра «смысловая» (вариант A, выбор заказчика):
   пастельные тона читались «блёкло», и валидатор палитры это подтвердил — четыре
   из семи прежних цветов были ниже порога насыщенности (читаются как серые),
   а вакансии и уход почти не различались (ΔE 11,9 при пороге 15). Теперь
   цвет кодирует смысл, а не номер метрики: одиночная метрика — кобальтом
   C_LINE (эталон, не меняется), цвет есть только у потоков людей. Набор
   кобальт · найм · уход · переводы проходит все проверки (насыщенность,
   светлота, различимость в т. ч. при дальтонизме); контраст голубого перевода
   ниже 3:1, поэтому его значения подписаны всегда. */
const C_HIRE='#14A38B',      /* найм, приход */
      C_HIRE_D='#0E8A74',    /* найм, насыщенный тон */
      C_HIRE_I='#0E95C7',    /* внутренний найм */
      C_FIRE='#8A4FD8',      /* увольнение, уход */
      C_TR_IN='#2E9BE0',     /* перевод внутрь */
      C_TR_OUT='#2448A8',    /* перевод наружу */
      C_CNT='#c7c8cc',       /* численность, итоги */
      C_OTHER='#686d76';     /* прочее */
const C_IN=C_HIRE, C_OUT=C_FIRE, C_TOTAL=C_CNT;   /* старые имена — для экранов */

/* Цвета отдельных метрик. Раньше они стояли литералами в screens/*.js —
   это была третья палитра помимо :root и этого файла, и при смене оттенка
   приходилось искать по всем экранам. Контроль: grep по screens/*.js — пусто. */
/* С итерации 32 одиночные метрики — кобальтом C_LINE: отдельный «свой» цвет
   у каждой (горчичный у недоработчиков, пыльно-розовый у лоу-перформеров)
   ничего не кодировал, а заказчик читал их как блёклые и случайные. Имена
   оставлены — экраны ссылаются на них, и смена тона не требует правок там. */
const C_VAC=C_LINE,            /* открытые вакансии */
      C_UNDER=C_LINE,          /* недоработчики */
      C_LOWPERF=C_LINE,        /* лоу-перформеры */
      C_OFFICE=C_LINE,         /* посещаемость офиса в таблицах */
      C_REGRET='#8A4FD8',      /* нежелательный уход — тон ухода */
      C_NOREG='#CDBEF0',       /* обычный уход — светлый тон ухода */
      C_TURN_Y=C_LINE,         /* текучесть накопительная */
      /* Использование AI — данные, а не AI-подсказка: фиолетовый --ai занят
         плашками Пульса, и столбики WAU в нём читались бы как подсказка. */
      C_AI=C_LINE;
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
    /* Класс `bench`, а не «первая строка». Раньше первая строка по счёту
       получала увеличенный кегль — и в дивергенте «Приняли» выходило крупнее
       «Уволились» просто потому, что найм стоит первым в массиве. Размер
       кодировал порядок в коде, а не значимость. Теперь все значения одного
       кегля, а база сравнения отличается цветом; признак базы надёжный —
       у неё пунктирный маркер, тот же, что в легенде графика. */
    s+='<span class="t-r'+(r.dash?' bench':'')+'">'+mk+
       '<span class="t-l">'+esc(r.label)+'</span>'+
       '<b class="t-v">'+esc(r.value)+'</b></span>';
  });
  const ns=o.note==null?[]:(Array.isArray(o.note)?o.note:[o.note]);
  ns.forEach(n=>{if(n)s+='<span class="t-n">'+esc(n)+'</span>'});
  return s;
}
/* data-tip читает делегированный обработчик в ui.js */
function tip(o){return ' data-tip="'+esc(tipHtml(o))+'"'}

/* Ломаная с разрывами. Значение null — «не из чего считать» (доля потока при
   нуле принятых): линия рвётся, а не падает в ноль. Ноль на графике читался бы
   как факт — «джунов не брали», хотя на деле в месяце просто не было найма. */
function polyD(vals,X,Y){
  let d='',pen=false;
  vals.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?'L':'M')+num(X(i))+' '+num(Y(v));pen=true});
  return d;
}
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
  const r=Math.min(2,w/2,h);   /* скругление марок 2px — ДС Proteus Adoption */
  if(h<=0.5)return'';
  return '<path d="M'+num(x)+' '+num(y+h)+'V'+num(y+r)+'Q'+num(x)+' '+num(y)+' '+num(x+r)+' '+num(y)
    +'H'+num(x+w-r)+'Q'+num(x+w)+' '+num(y)+' '+num(x+w)+' '+num(y+r)+'V'+num(y+h)+'Z"'
    +' fill="'+fill+'"'+(extra||'')+'/>';
}
/* Бар вниз от нуля — зеркало barUp: верх прижат к оси и ровный,
   скругляется нижний край. Правило одно: мягкий край смотрит от нуля. */
function barDown(x,y,w,h,fill,extra){
  h=Math.max(0,h);
  const r=Math.min(2,w/2,h);   /* скругление марок 2px — ДС Proteus Adoption */
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
const SERIES={yoy:['main','prev','bench'],diverge:['up','dn','prev'],
              waterfall:['total','in','out']};
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

/* Ось X всех графиков динамики — двенадцать месяцев календарного года
   (yoyAxis ниже): с 13.10 скользящего окна «12 мес» на графиках нет. */
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

/* ---------- Акценты истории (итерация 32) ----------
   Глава истории называет на графике то, о чём говорит её заголовок: пик года,
   максимум, текущий месяц. ann = {hi:[i…], notes:[{i, t}]} приходит из
   story.js через экран — индексами окна отчёта; на ось года их переводит
   yoyAnn. Месяцы из hi рисуются полным тоном, остальные бары — приглушённо
   (fill-opacity, а не другой класс: smoke сверяет class="bar up"
   посимвольно); у приглушённых подпись значения серая и обычного веса, но
   стоит — правило «подпись у каждого бара» не отменяется. Заметка — короткая
   подпись над значением месяца на светлой полосе; под неё у полотна
   резервируется ANN_ROOM сверху, чтобы она не уходила в заголовок. */
const ANN_ROOM=16, C_BAND='#f3f4f7';
function annOf(o){return o&&o.ann&&(o.ann.hi||o.ann.notes)?o.ann:null}
/* подпись заметки; yTop — верх марки месяца */
function annText(ann,i,cx,yTop,x0,plotW){
  const n=ann&&ann.notes&&ann.notes.find(z=>z.i===i);
  if(!n)return'';
  const tw=textW(n.t,10.5), y=yTop-VAL_DY-VAL_ASC-5;
  /* у края полотна подпись прижимается внутрь, а не обрезается */
  const xl=x0+2, xr=x0+plotW-2;
  let x=cx, a='middle';
  if(cx-tw/2<xl){x=xl;a='start'}else if(cx+tw/2>xr){x=xr;a='end'}
  return txt(x,y,n.t,{size:10.5,weight:700,fill:C_INK,anchor:a,halo:true,cls:'fade'});
}
/* Заливка разрыва линии с базой: зелёным, где метрика лучше базы, красным —
   где хуже, без заливки в мёртвой зоне ±5%. Это тот же светофор, что у
   пилюль, и та же логика compareState — глава «видна» без чтения цифр. */
function gapFill(key,ser,bench,XL,Y){
  let s='';
  for(let i=0;i<ser.length-1;i++){
    const a=ser[i],b=ser[i+1],c=bench[i],d=bench[i+1];
    if(a==null||b==null||c==null||d==null)continue;
    const st=CD.compareState(key,(a+b)/2,(c+d)/2);
    if(st!=='good'&&st!=='bad')continue;
    s+='<path class="gapf" d="M'+num(XL(i))+' '+num(Y(a))+'L'+num(XL(i+1))+' '+num(Y(b))+
      'L'+num(XL(i+1))+' '+num(Y(d))+'L'+num(XL(i))+' '+num(Y(c))+'Z" fill="'+(st==='good'?C_GREEN:C_RED)+'" fill-opacity=".22"/>';
  }
  return s;
}

/* ---------- Шаг подписей: подписываем через одну, если не помещаются ----------
   Правило «подпись над каждой точкой» держится, пока подпись уже полосы
   месяца. На суженной панели (у блоков с широкой сводной таблицей) двенадцать
   процентов вставали вплотную и сливались в одну строку цифр. Тогда подписи
   идут через одну — считая от последнего месяца, он подписан всегда, — а
   значения остальных живут в подсказке. Тот же размен, что у календаря:
   налезающие друг на друга цифры хуже их отсутствия. */
function labelStep(vals,key,bandW){
  let mw=0;
  vals.forEach(v=>{if(v!=null)mw=Math.max(mw,textW(CD.fmtVal(key,v),VAL_SZ))});
  return Math.max(1,Math.ceil((mw+5)/Math.max(1,bandW)));
}
function lblAt(i,last,step){return (last-i)%step===0}

/* ---------- Пороги KPI: подписи справа от полотна ----------
   Подпись порога стояла внутри полотна под своим пунктиром и налезала на
   подписи точек, как только метрика подходила к цели, — а это ровно тот
   момент, ради которого пороги рисуют. Теперь у полотна справа своё поле,
   и подписи «цель» и «порог» стоят в нём на уровне своих линий: с данными
   они физически не пересекаются. Близкие пороги разводятся по вертикали. */
function kpiRoom(key,kpi){
  if(!kpi)return 0;
  return Math.ceil(Math.max(textW('порог '+CD.fmtVal(key,kpi.red),10.5),
    textW('цель '+CD.fmtVal(key,kpi.green),10.5)))+12;
}
function kpiLines(key,kpi,xL,xR,Y){
  let s='';
  const ys=[Y(kpi.green),Y(kpi.red)], ty=ys.slice();
  if(Math.abs(ty[0]-ty[1])<13){const m=(ty[0]+ty[1])/2, up=ty[0]<=ty[1]?-1:1;ty[0]=m+up*6.5;ty[1]=m-up*6.5}
  [['green',C_GREEN,'цель '],['red',C_RED,'порог ']].forEach(([k,c,lb],i)=>{
    s+=line(xL,ys[i],xR,ys[i],c,1.4,'2 3');
    s+=txt(xR+6,ty[i]+3.5,lb+CD.fmtVal(key,kpi[k]),{size:10.5,fill:C_AXIS,anchor:'start'});
  });
  return s;
}

/* ---------- Год к году: общие части ---------- */
const C_PREV='#b9bdc6', C_NOW='#dfe3ea';
const C_SPARK_INK='#8a909c';   /* спарклайн метрики без оценки — тон подписей осей */
/* Прошлый год у баров — «тень» за баром текущего года: шире и бледнее. Бар
   этого года стоит перед ней, и выше он прошлогоднего или ниже — видно без
   цифр. Рядом стоящие бары читались бы как две разные категории. */
const C_GHOST='#d5d9e0';
/* Номерная отметка факта «Что видно» (One-pager, механика HRBP HUB): кружок
   с номером на точке, о которой говорит пункт списка рядом с графиком. */
const C_MK='#1f1f1f', C_MK_PREV='#7d8494';

/* Месяц скользящего окна на оси года: {i: месяц 0–11, s: серия}. Акценты
   историй (story.js) считают индексы по окну отчёта, а ось года календарная:
   пик в августе прошлого года ложится на бледную линию, текущий месяц — на
   линию этого года. Месяц вне двух лет оси — null. */
function yoyPos(i){
  const m=CD.MONTHS[i];
  if(!m)return null;
  return m.y===CD.YEAR_CUR?{i:m.m,s:'main'}:m.y===CD.YEAR_PREV?{i:m.m,s:'prev'}:null;
}
function yoyAnn(ann){
  if(!ann)return null;
  const hi=[],notes=[];
  (ann.hi||[]).forEach(i=>{const p=yoyPos(i);if(p)hi.push(p)});
  (ann.notes||[]).forEach(n=>{const p=yoyPos(n.i);if(p)notes.push({i:p.i,s:p.s,t:n.t})});
  return {hi:ann.hi?hi:null,notes:notes};
}
function yoyRoom(ya,marks){return (ya&&ya.notes.length?ANN_ROOM:0)+(marks&&marks.length?5:0)}
/* Легенда панели «год к году»: этот год цветом панели, прошлый — серым. */
function yoyKey(w,y,col,bar){
  const it=[[String(CD.YEAR_CUR),col],[String(CD.YEAR_PREV),bar?C_GHOST:C_PREV]];
  let x=w,s='';
  for(let i=it.length-1;i>=0;i--){
    const tw=textW(it[i][0],11.5);x-=tw;
    s+=txt(x,y+12,it[i][0],{size:11.5,fill:C_LABEL,anchor:'start'})+rect(x-22,y+4.5,16,8,it[i][1],2);
    x-=16+14;
  }
  return s;
}
/* Месяцы оси года: на узком полотне — через один от января, текущий подписан
   всегда и жирно. «Вы здесь» — тонкая сплошная: пунктиром уже сказаны цель и база. */
function yoyAxis(X,bandW,top,bot,nowI){
  let s=line(X(nowI),top-6,X(nowI),bot,C_NOW,1);
  CD.MONTH_ABBR.forEach((lb,i)=>{
    if(bandW>=31||i%2===0||i===nowI)
      s+=txt(X(i),bot+15,lb,i===nowI?{size:10.5,weight:700,fill:C_LABEL}:{size:10.5,fill:C_AXIS});
  });
  return s+line(X(0)-bandW/2,bot,X(11)+bandW/2,bot,C_ZERO,1);
}
/* Подсветка месяцев для связки «пункт списка ↔ график»: невидимые полосы,
   которые проявляет класс on (app.js — наведение на пункт «Что видно»). */
const C_LINK='#E6EEFC';         /* подсветка месяца — бледный тон кобальта */
function yoyBands(x0,bandW,top,bot){
  let s='';
  for(let i=0;i<12;i++)s+=rect(x0+bandW*i+2,top-12,bandW-4,bot-top+12,C_LINK,6,' class="mkb" data-mi="'+i+'"');
  return s;
}
function mkMark(cx,cy,m,dly){
  return '<g class="mk fade" data-mk="'+m.n+'" data-mi="'+m.i+'" style="animation-delay:'+num(dly)+'ms">'+
    '<circle cx="'+num(cx)+'" cy="'+num(cy)+'" r="8" fill="'+(m.s==='prev'?C_MK_PREV:C_MK)+'" stroke="#fff" stroke-width="1.6"/>'+
    txt(cx,cy+3.6,String(m.n),{size:10.5,weight:700,fill:'#fff'})+'</g>';
}

/* ============================================================================
   1. Год к году — механика HRBP HUB на голом SVG
   ----------------------------------------------------------------------------
   С 13.10 это ЕДИНСТВЕННЫЙ масштаб динамики в отчёте (заказчик: «убери 12 мес,
   оставь только год к году»). Ось — двенадцать месяцев календарного года, на
   ней этот год и прошлый одной формы записи: линия к линии, бар к бару.
   Текущий год — насыщенный, с подписями; прошлый — бледная линия или «тень»
   за баром, без подписей (значения — в подсказке месяца).

   Ориентир один — цель KPI или база, и только для текущего года: прошлогодней
   базы на полотне нет, иначе рядом оказались бы четыре линии и два вопроса.
   Разрыв с базой залит светофором (gap), как на линии истории.

   Отличия от ECharts-версии HRBP, и они осознанные — здесь действуют правила
   этого движка:
     · шкала от нуля (правило 1), поэтому оси Y нет, а значения подписаны;
     · год не подписывается под январём (правило 6 здесь не применимо): на оси
       лежат ОБА года сразу, и год называет легенда, а не подпись месяца.
   Прошлогоднее значение подписано в последнем закрытом месяце: это и есть
   «год к году» из таблицы, и его видно без наведения.

   Одна функция рисует полотно в заданной области — её зовут и отдельный
   график (drawYoy), и панели друг под другом (drawPanels с yoy).
     p  = {key, cur[12], prev[12], bench?, type:'line'|'bar', color, kpi, fc,
           ann (уже на оси года), marks:[{i, s, n}], gap, off, benchName, link}
     ar = {x0, plotW, top, bot, hitTop, delay}
   ========================================================================== */
function yoyPlot(p,ar){
  const key=p.key, cur=p.cur, prev=p.prev, bench=p.bench||null, off=p.off||NOSET;
  const nm=CD.METRIC_BY_KEY[key]||{}, bar=p.type==='bar', col=p.color||C_LINE;
  const x0=ar.x0, plotW=ar.plotW, top=ar.top, bot=ar.bot, bandW=plotW/12, d0=ar.delay||0;
  const showMain=!off.has('main'), showPrev=!off.has('prev'), showBench=!!bench&&!off.has('bench');
  const nowI=CD.CUR_LEN-1, ya=p.ann||null, marks=p.marks||[];
  const all=[].concat(showMain?cur:[],showPrev?prev:[],showBench?bench:[]).filter(v=>v!=null);
  if(p.kpi){all.push(p.kpi.green);all.push(p.kpi.red)}
  /* p.fc — прогноз на декабрь (run-rate): пунктир от последнего закрытого
     месяца до декабря. Рисуется только у накопительной метрики и только пока
     год не закрыт — в декабре прогноз совпал бы с фактом. */
  const fc=!bar&&showMain&&p.fc!=null&&nowI<11&&cur[nowI]!=null?p.fc:null;
  if(fc!=null)all.push(fc);
  const max=niceMax(all);
  const Y=v=>bot-(v/max)*(bot-top), X=i=>x0+bandW*(i+0.5);
  const big=(i,s)=>!!(ya&&ya.hi&&ya.hi.some(z=>z.i===i&&z.s===s));
  const lit=(i,s)=>!ya||!ya.hi||big(i,s);
  const noteAt=(i,s)=>ya&&ya.notes.find(z=>z.i===i&&z.s===s);
  const mkAt=(i,s)=>marks.find(z=>z.i===i&&z.s===s);
  let s='';
  (ya?ya.notes:[]).forEach(n=>{s+=rect(x0+bandW*n.i+2,top-ANN_ROOM-4,bandW-4,bot-top+ANN_ROOM+4,C_BAND,6)});
  if(p.link)s+=yoyBands(x0,bandW,top,bot);
  s+=yoyAxis(X,bandW,top,bot,nowI);
  if(p.kpi)s+=kpiLines(key,p.kpi,x0,x0+plotW,Y);
  if(p.gap&&showMain&&showBench)s+=gapFill(key,cur,bench,X,Y);
  const gw=Math.min(44,bandW*0.7), bw=Math.min(26,bandW*0.42);
  if(!bar){
    if(showPrev)s+='<path class="lnb"'+sAttr('prev')+' d="'+polyD(prev,X,Y)+'" fill="none" stroke="'+C_PREV+'"'
      +' stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>';
    if(showBench)s+='<path class="lnb"'+sAttr('bench')+' d="'+polyD(bench,X,Y)+'" fill="none" stroke="'+C_BENCH+'"'
      +' stroke-width="2" stroke-dasharray="5 3"/>';
    if(showMain)s+='<path class="ln"'+sAttr('main')+' pathLength="1" d="'+polyD(cur,X,Y)+'" fill="none" stroke="'+col+'"'
      +' stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"'+(d0?' style="animation-delay:'+d0+'ms"':'')+'/>';
    if(fc!=null){
      /* прогноз — не факт: тонкий пунктир того же цвета и полая точка, подпись
         прижата к правому краю, чтобы не вылезать за полотно */
      s+='<path class="lnb"'+sAttr('main')+' d="M'+num(X(nowI))+' '+num(Y(cur[nowI]))+'L'+num(X(11))+' '+num(Y(fc))+'"'
        +' fill="none" stroke="'+col+'" stroke-width="1.6" stroke-dasharray="2 4" stroke-linecap="round"/>';
      s+='<circle class="dotb"'+sAttr('main')+' cx="'+num(X(11))+'" cy="'+num(Y(fc))+'" r="3.4" fill="#fff" stroke="'+col+'" stroke-width="1.6" stroke-dasharray="2 2"/>';
      s+=txt(X(11)+bandW*0.45,Y(fc)-VAL_DY,'прогноз '+CD.fmtVal(key,fc),valOpt({anchor:'end',s:'main',fill:col}));
    }
  }
  const yC=CD.YEAR_CUR, yP=CD.YEAR_PREV, step=labelStep(cur,key,bar?bw*1.9:bandW);
  let lbl='', mk='';
  for(let i=0;i<12;i++){
    const c=cur[i], pv=prev[i], b=bench?bench[i]:null, cx=X(i);
    const rows=[];
    if(showMain&&c!=null)rows.push({label:String(yC),value:CD.fmtVal(key,c),color:col});
    if(showPrev&&pv!=null)rows.push({label:String(yP),value:CD.fmtVal(key,pv),color:bar?C_GHOST:C_PREV});
    if(showBench&&b!=null)rows.push({label:p.benchName||'база',value:CD.fmtVal(key,b),color:C_BENCH,dash:true});
    if(fc!=null&&i===11)rows.push({label:'прогноз на декабрь',value:CD.fmtVal(key,fc),color:col,dash:true});
    const note=c!=null&&pv!=null?'Год к году: '+CD.fmtDelta(key,+(c-pv).toFixed(2))
      :c==null?(fc!=null&&i===11?'Прогноз — run-rate: темп с начала года, пересчитанный на 12 месяцев'
        :'Месяц '+yC+' ещё не закрыт'):null;
    const nmM=CD.MONTH_NOM[i];
    const dly=d0+DRAW_MS*(i/Math.max(1,nowI))*0.9;
    s+='<g class="'+(bar?'barg':'ptg')+'" data-mi="'+i+'"'+tip({title:nmM[0].toUpperCase()+nmM.slice(1)+(nm.name?' · '+nm.name:''),rows,note})+'>';
    s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(ar.hitTop)+'" width="'+num(bandW)+'" height="'+num(bot-ar.hitTop)+'"/>';
    if(bar){
      if(showPrev&&pv!=null)s+=barUp(cx-gw/2,Y(pv),gw,bot-Y(pv),C_GHOST,' class="bar up"'+sAttr('prev')+' style="animation-delay:'+(d0+i*26)+'ms"');
      /* приглушённый бар этого года стоит на белой подложке: полупрозрачный
         поверх тени он смешивался бы с ней в третий, ничей цвет */
      const on=lit(i,'main'), st=' style="animation-delay:'+(d0+60+i*26)+'ms"';
      if(showMain&&c!=null&&!on)s+=barUp(cx-bw/2,Y(c),bw,bot-Y(c),'#fff',' class="bar up"'+st);
      if(showMain&&c!=null)s+=barUp(cx-bw/2,Y(c),bw,bot-Y(c),col,' class="bar up"'+sAttr('main')+(on?'':' fill-opacity=".38"')+st);
    }else{
      const bp=big(i,'prev')||!!noteAt(i,'prev');
      if(showPrev&&pv!=null)s+='<circle class="dotb"'+sAttr('prev')+' cx="'+num(cx)+'" cy="'+num(Y(pv))+'" r="'+(bp?4:2.4)+'" fill="'+C_PREV+'"/>';
      const bm=big(i,'main');
      if(showMain&&c!=null)s+='<circle class="dot"'+sAttr('main')+' cx="'+num(cx)+'" cy="'+num(Y(c))+'" r="'+(bm?4.6:3.4)+'" fill="'+(bm?col:'#fff')+'" stroke="'+col+'"'
        +' stroke-width="2" style="animation-delay:'+num(dly)+'ms"/>';
    }
    s+='</g>';
    /* Подписи. У последнего закрытого месяца подписаны обе линии, и подписи
       разведены по разные стороны: верхняя точка — над собой, нижняя — под
       собой. Иначе на близких значениях цифры легли бы одна на другую.
       У точки с номерной отметкой подпись отодвинута от кружка. */
    if(showMain&&c!=null&&(lblAt(i,nowI,step)||big(i,'main')||mkAt(i,'main'))){
      const both=!bar&&i===nowI&&showPrev&&pv!=null, below=both&&pv>c;
      const sh=mkAt(i,'main')?5:0, on=!bar||lit(i,'main');
      lbl+=txt(cx,below?Y(c)+VAL_DY+VAL_ASC+sh:Y(c)-VAL_DY-sh,CD.fmtVal(key,c),
        valOpt(on?{delay:dly,s:'main'}:{delay:dly,s:'main',weight:400,fill:C_AXIS}));
      if(both)lbl+=txt(cx,below?Y(pv)-VAL_DY-(mkAt(i,'prev')?5:0):Y(pv)+VAL_DY+VAL_ASC+(mkAt(i,'prev')?5:0),CD.fmtVal(key,pv),
        valOpt({s:'prev',fill:C_AXIS,weight:400}));
    }
    /* две отметки в одном месяце на близких значениях (этот год и прошлый
       почти равны) разводятся в стороны, а подпись остаётся одна */
    const twin=!!(mkAt(i,'main')&&mkAt(i,'prev')&&c!=null&&pv!=null&&Math.abs(Y(c)-Y(pv))<17);
    /* прошлогодняя точка с акцентом или отметкой — подписана: о ней говорит текст */
    if(showPrev&&pv!=null&&!twin&&!(i===nowI&&!bar&&showMain&&c!=null)&&(big(i,'prev')||noteAt(i,'prev')||mkAt(i,'prev')))
      lbl+=txt(cx,Y(pv)-VAL_DY-(mkAt(i,'prev')?5:0),CD.fmtVal(key,pv),valOpt({s:'prev',fill:C_AXIS,weight:400}));
    const nt=noteAt(i,'main')||noteAt(i,'prev');
    if(nt){
      const v=nt.s==='prev'?pv:c;
      if(v!=null)lbl+=annText({notes:[{i:i,t:nt.t}]},i,cx,Y(v),x0,plotW);
    }
    ['main','prev'].forEach(sr=>{
      const m=mkAt(i,sr), v=sr==='prev'?pv:c;
      if(m&&v!=null&&(sr==='prev'?showPrev:showMain))mk+=mkMark(cx+(twin?(sr==='prev'?9:-9):0),Y(v),m,dly);
    });
  }
  return s+lbl+mk;
}
function drawYoy(a,w,h){
  const o=a.opt||{};
  const hh=headH(o.title,o.legend);
  h=h||o.h||280;
  const ya=yoyAnn(annOf(o));
  const plotTop=hh+LBL_ROOM+yoyRoom(ya,o.marks), plotBot=h-AXIS_H+12;
  const x0=PAD_X, plotW=w-PAD_X*2-kpiRoom(a.metricKey,o.kpi);
  return svg(w,h,header(w,o.title,o.legend,{kind:'yoy',off:o.off})+
    yoyPlot({key:a.metricKey,cur:a.cur,prev:a.prev,bench:a.bench,type:o.type,color:o.color,kpi:o.kpi,fc:o.fc,
      ann:ya,marks:o.marks,gap:o.gap,off:offOf(o),benchName:o.benchName,link:o.link},
      {x0:x0,plotW:plotW,top:plotTop,bot:plotBot,hitTop:hh}));
}

/* ============================================================================
   2. Дивергентные бары: пришли вверх, ушли вниз — СТРОГО в одной вертикали,
      как один бар, разрезанный осью X. Не рядом: рядом стоящие бары читаются
      как две разные категории, а это один поток в двух направлениях.
      Шкала одна на оба плеча, иначе плечи визуально несравнимы.
      С 13.10 — год к году: ось янв.–дек., плечи этого года цветом, прошлого —
      «тенью» за ними (шире и бледнее), шкала одна на оба плеча и оба года.
      a.up / a.down = {cur[12], prev[12]}. Тень выключается из легенды (серия prev).
      На одном плече дивергент ПЕРЕСТРАИВАЕТСЯ: остался найм — ноль уезжает
      вниз, остался отток — наверх; пустая половина читалась бы как «нули».
   ========================================================================== */
function drawDiverge(a,w,h){
  const o=a.opt||{}, upKey=a.upKey, downKey=a.downKey;
  const upName=o.upName||(CD.METRIC_BY_KEY[upKey]||{}).name||'Пришли';
  const downName=o.downName||(CD.METRIC_BY_KEY[downKey]||{}).name||'Ушли';
  const hh=headH(o.title,o.legend);
  h=h||o.h||320;
  const top=hh+LBL_ROOM, bot=h-AXIS_H+12;
  const off=offOf(o), showUp=!off.has('up'), showDn=!off.has('dn'), showPrev=!off.has('prev');
  const x0=PAD_X, plotW=w-PAD_X*2, bandW=plotW/12, nowI=CD.CUR_LEN-1, X=i=>x0+bandW*(i+0.5);
  const U=a.up, Dn=a.down;
  const vals=[].concat(showUp?U.cur:[],showUp&&showPrev?U.prev:[],showDn?Dn.cur:[],showDn&&showPrev?Dn.prev:[]);
  let zero, armUp, armDn;
  if(showUp&&showDn){zero=top+(bot-top)/2;armUp=armDn=Math.max(8,(bot-top)/2-LBL_ROOM)}
  else if(showUp){zero=bot;armUp=Math.max(8,bot-top);armDn=0}
  else{zero=top;armUp=0;armDn=Math.max(8,bot-top-LBL_ROOM)}
  const max=niceMax(vals);
  const gw=Math.min(40,bandW*0.66), bw=Math.min(24,bandW*0.4);
  const step=Math.max(labelStep(U.cur,upKey,bw*1.9),labelStep(Dn.cur,downKey,bw*1.9));
  let s=header(w,o.title,o.legend,{kind:'diverge',off:o.off});
  s+=line(X(nowI),top-6,X(nowI),bot,C_NOW,1);
  CD.MONTH_ABBR.forEach((lb,i)=>{
    if(bandW>=31||i%2===0||i===nowI)
      s+=txt(X(i),bot+15,lb,i===nowI?{size:10.5,weight:700,fill:C_LABEL}:{size:10.5,fill:C_AXIS});
  });
  s+=line(x0,zero,x0+plotW,zero,C_ZERO,1);
  const yC=String(CD.YEAR_CUR), yP=String(CD.YEAR_PREV);
  for(let i=0;i<12;i++){
    const cx=X(i), u=U.cur[i], up=U.prev[i], d=Dn.cur[i], dp=Dn.prev[i];
    const H=(v,arm)=>v==null?0:(v/max)*arm;
    const rows=[];
    if(showUp){if(u!=null)rows.push({label:upName+' · '+yC,value:CD.fmtVal(upKey,u),color:C_IN});
      if(showPrev&&up!=null)rows.push({label:upName+' · '+yP,value:CD.fmtVal(upKey,up),color:C_GHOST})}
    if(showDn){if(d!=null)rows.push({label:downName+' · '+yC,value:CD.fmtVal(downKey,d),color:C_OUT});
      if(showPrev&&dp!=null)rows.push({label:downName+' · '+yP,value:CD.fmtVal(downKey,dp),color:C_GHOST})}
    const nmM=CD.MONTH_NOM[i];
    s+='<g class="barg" data-mi="'+i+'"'+tip({title:nmM[0].toUpperCase()+nmM.slice(1),rows,
      note:u==null&&d==null?'Месяц '+yC+' ещё не закрыт':null})+'>';
    s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(hh)+'" width="'+num(bandW)+'" height="'+num(bot-hh)+'"/>';
    if(showPrev){
      if(showUp&&up!=null)s+=barUp(cx-gw/2,zero-H(up,armUp),gw,H(up,armUp),C_GHOST,' class="bar up"'+sAttr('prev')+' style="animation-delay:'+(i*26)+'ms"');
      if(showDn&&dp!=null)s+=barDown(cx-gw/2,zero,gw,H(dp,armDn),C_GHOST,' class="bar dn"'+sAttr('prev')+' style="animation-delay:'+(i*26)+'ms"');
    }
    if(showUp&&u!=null)s+=barUp(cx-bw/2,zero-H(u,armUp),bw,H(u,armUp),C_IN,' class="bar up"'+sAttr('up')+' style="animation-delay:'+(60+i*26)+'ms"');
    if(showDn&&d!=null)s+=barDown(cx-bw/2,zero,bw,H(d,armDn),C_OUT,' class="bar dn"'+sAttr('dn')+' style="animation-delay:'+(60+i*26)+'ms"');
    s+='</g>';
    const lb=lblAt(i,nowI,step);
    /* подпись — над выше стоящим из двух баров месяца, чтобы не резать тень */
    if(showUp&&u!=null&&lb)s+=txt(cx,zero-Math.max(H(u,armUp),showPrev&&up!=null?H(up,armUp):0)-VAL_DY,CD.fmtVal(upKey,u),valOpt({delay:240+i*26,s:'up'}));
    if(showDn&&d!=null&&lb)s+=txt(cx,Math.min(zero+Math.max(H(d,armDn),showPrev&&dp!=null?H(dp,armDn):0)+VAL_DY+4,bot-2),CD.fmtVal(downKey,d),valOpt({delay:240+i*26,s:'dn'}));
  }
  return svg(w,h,s);
}

/* ============================================================================
   3. Панели друг под другом. У КАЖДОЙ своя ось X под ней: одна общая ось внизу
      заставляла глазами бегать через весь блок. Каждая шкала — от нуля.
      С 13.10 — год к году: у каждой панели ось янв.–дек. и своя легенда
      «этот год / прошлый» цветом панели. p = {name, key, type, cur[12],
      prev[12], color, ann (по окну отчёта — переводится на ось года)}.
   ========================================================================== */
function drawPanels(a,w,h){
  const ps=a.panels, o=a.opt||{};
  const GAP=STACK_GAP;     /* воздух между осью X и заголовком следующей панели */
  const x0=PAD_X, plotW=w-PAD_X*2, HEAD=16, PLOT_MIN=70, AX=AXIS_H-12;
  const yas=ps.map(p=>yoyAnn(annOf(p)));
  const minPanel=HEAD+LBL_ROOM+PLOT_MIN+AX+GAP+(yas.some(ya=>yoyRoom(ya))?ANN_ROOM:0);
  h=Math.max(h||o.h||340,ps.length*minPanel+14);
  const panelH=(h-14)/ps.length;
  let s='';
  ps.forEach((p,pi)=>{
    const base=pi*panelH, ya=yas[pi];
    const top=base+HEAD+LBL_ROOM+yoyRoom(ya), bot=base+panelH-AX-GAP;
    s+=txt(0,base+11,p.name,{size:TTL_SZ,weight:TTL_W,fill:C_INK,anchor:'start'});
    s+=yoyKey(w,base-1,p.color||C_LINE,p.type==='bar');
    s+=yoyPlot({key:p.key,cur:p.cur,prev:p.prev,type:p.type,color:p.color,ann:ya,off:NOSET},
      {x0:x0,plotW:plotW,top:top,bot:bot,hitTop:top-12,delay:pi*140});
  });
  return svg(w,h,s);
}

/* ============================================================================
   4. Водопад баланса. Итоги — серые (это уровни, а не изменения),
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
   5. Воронка. Полосы центрированы по вертикальной оси, поэтому силуэт
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
    s+=txt(cx,y-4,it.name,{size:11,weight:400,fill:C_AXIS});
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
   6. Спарклайны.
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

/* Строка подсказки спарклайна с тем, с чем метрика сравнивается: цель KPI, если
   она есть, иначе база. Одна функция на оба спарклайна — иначе колонка «12 мес»
   и hero-карточка объясняли бы один и тот же месяц по-разному. */
function cmpRow(key,i,base,kpi){
  if(kpi)return [{label:'цель KPI',value:CD.fmtVal(key,kpi.green),color:C_BENCH,dash:true}];
  return base?[{label:'база',value:CD.fmtVal(key,base[i]),color:C_BENCH,dash:true}]:[];
}
/* Оценка месяца: есть KPI — только против него, базы здесь уже нет. */
function cmpState(key,v,i,base,kpi,flat,state){
  if(kpi)return CD.stateForKpi(key,v,kpi);
  return (flat||!base||!key)?state:CD.compareState(key,v,base[i]);
}

function sparkBars(series,state,w,h,o){
  o=o||{};w=w||120;h=h||26;
  const n=series.length, gap=w/n, bw=gap*0.68;
  const key=o.key, base=o.base, flat=o.flat, kpi=o.kpi;
  /* Шкала. От нуля столбики честны по величине, но при малом размахе
     (численность 175 → 191) все двенадцать месяцев выглядят одинаково и
     динамика пропадает. Поэтому при размахе меньше 40% от максимума низ
     шкалы поднимается под минимум ряда: колонка «12 мес» показывает форму
     изменения, а точные значения всё равно живут в подсказке и соседних
     столбцах. Полный масштаб от нуля остаётся на детальных графиках. */
  const vals=series.filter(v=>v!=null);
  const mn=vals.length?Math.min.apply(null,vals):0, mx=vals.length?Math.max.apply(null,vals):0, rng=mx-mn;
  let lo=0, hi=niceMax(series);
  if(rng>0&&mx>0&&rng/mx<0.4){lo=Math.max(0,mn-rng*0.45);hi=mx+rng*0.12}
  const span=(hi-lo)||1;
  let s='';
  series.forEach((v,i)=>{
    if(v==null)return;
    const bh=Math.max(1.5,((v-lo)/span)*(h-2));
    /* окраска месяца: с целью KPI, а при её отсутствии — с базой ЭТОГО месяца */
    const st=cmpState(key,v,i,base,kpi,flat,state);
    const t=key?{title:mLabel(i),
      rows:[{label:(CD.METRIC_BY_KEY[key]||{}).name||'',value:CD.fmtVal(key,v),color:stateColor(st)}]
        .concat(cmpRow(key,i,base,kpi))}:null;
    s+='<g class="sbg"'+(t?tip(t):'')+'>';
    s+='<rect class="hit" x="'+num(i*gap)+'" y="0" width="'+num(gap)+'" height="'+num(h)+'"/>';
    s+=rect(i*gap+(gap-bw)/2,h-bh,bw,bh,stateColor(st),1,' class="sb"');
    s+='</g>';
  });
  return sparkSvg(w,h,s);
}
function sparkLine(series,state,w,h,o){
  o=o||{};w=w||120;h=h||26;
  const n=series.length;
  /* o.ink — спарклайн метрики без оценки в колонке «12 мес». Бледно-серые бары
     там сливались с фоном: цвета у такой метрики нет по правилу, значит форму
     должна нести сама линия — тёмно-серая, тонкая, с последней точкой.
     o.fit — та же поднятая шкала, что у sparkBars при малом размахе: численность
     175 → 191 от нуля — прямая. На детальных графиках шкала остаётся от нуля. */
  const col=o.ink?C_SPARK_INK:stateColor(state), key=o.key, base=o.base, kpi=o.kpi;
  const vals=series.filter(v=>v!=null);
  const mn=vals.length?Math.min.apply(null,vals):0, mx=vals.length?Math.max.apply(null,vals):0, rg=mx-mn;
  let lo=0, max=niceMax(series);
  if(o.fit&&rg>0&&mx>0&&rg/mx<0.4){lo=Math.max(0,mn-rg*0.45);max=mx+rg*0.12}
  /* прирост с начала года уходит в минус — линия не должна проваливаться под низ */
  if(mn<0){lo=mn;max=Math.max(mx,0)+(rg||1)*0.08}
  /* PAD — не косметика: svg тянется preserveAspectRatio="none", и точка радиусом 2
     на самом краю viewBox срезалась ровно наполовину. Отступ по краям и сверху
     держит крайние точки целиком внутри картинки. */
  const PAD=3.5, TOP=3.5;
  const X=i=>n>1?PAD+i/(n-1)*(w-2*PAD):w/2;
  const Y=v=>h-PAD-((v-lo)/((max-lo)||1))*(h-PAD-TOP);
  let s='<path d="'+polyD(series,X,Y)+'" fill="none" stroke="'+col+'" stroke-width="1.7"'
    +' stroke-linejoin="round" stroke-linecap="round"/>';
  if(series[n-1]!=null)s+='<circle cx="'+num(X(n-1))+'" cy="'+num(Y(series[n-1]))+'" r="'+(o.ink?2.6:2)+'" fill="'+col+'"/>';
  /* Наведение: под курсором подсвечивается ИМЕННО тот месяц, о котором говорит
     тултип. Без этого по спарклайну было непонятно, какую точку он описывает.
     Всё на CSS (.spg:hover), никаких обработчиков. */
  if(key)series.forEach((v,i)=>{
    if(v==null)return;
    const gapw=w/n, cx=X(i), cy=Y(v);
    const t={title:mLabel(i),
      rows:[{label:(CD.METRIC_BY_KEY[key]||{}).name||'',value:CD.fmtVal(key,v),color:col}]
        .concat(cmpRow(key,i,base,kpi))};
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
const CAL_LO=[238,244,255], CAL_HI=[36,95,212];   /* #EEF4FF → #245FD4: шкала активного тона */
function mixRGB(a,b,t){
  const c=[0,1,2].map(i=>Math.round(a[i]+(b[i]-a[i])*t));
  return 'rgb('+c[0]+','+c[1]+','+c[2]+')';
}
/* Шкала интенсивности для матрицы состава — ТА ЖЕ синяя, что у календаря,
   и по той же причине: «много» в клетке не значит «плохо», значит «здесь люди».
   Светофор тут был бы ложным сигналом, а вторая шкала в отчёте — вторым языком.
   heatInk отдаёт цвет цифры: на тёмном конце шкалы чёрная цифра не читается. */
function heat(t){return mixRGB(CAL_LO,CAL_HI,Math.max(0,Math.min(1,t||0)))}
function heatInk(t){return (t||0)>0.58?'#ffffff':C_LABEL}

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
  /* Высота КОНТЕЙНЕРА, а не самого календаря. Может не прийти вовсе — тогда
     календарь стоит собственной высотой, и размер клетки держат только ширина
     и потолок CELL_MAX. Именно так он и стоит на экране офиса: высота там
     ничего не должна решать, иначе один и тот же календарь получался бы
     разным на ноутбуке и на большом мониторе. */
  const hBox=h||o.h||0;
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
  /* Клетка КВАДРАТНАЯ: считаем и по ширине, и по высоте, берём меньшее.
     Вытянутый прямоугольник читается как таблица, а не как день календаря,
     а месяцы разной длины рядом получали бы клетки разной формы.
     Заданная высота контейнера участвует как ещё один потолок — из него
     календарь вылезать не должен; без неё потолок один, CELL_MAX. */
  const byH=hBox?(hBox-gridTop-gap*(rows-1))/rows:CELL_MAX;
  const cell=Math.max(22,Math.min(CELL_MAX,(availW-gap*6)/7,byH));
  const cw=cell, ch=cell;
  const gridW=cw*7+gap*6, totalW=gridW*n+BLOCK_GAP*(n-1);
  const x0=Math.max(CAL_PAD,(w-totalW)/2);
  /* Высота SVG — РОВНО по содержимому. Тянуть её до высоты контейнера нельзя:
     клетка упирается в потолок, остаток превращается в пустую полосу внизу
     картинки, и она отодвигает то, что стоит под графиком, — разрыв между
     календарём и таблицей дней недели рос вместе с высотой экрана. */
  const hUsed=gridTop+rows*ch+(rows-1)*gap;
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
      if(showDay)s+=txt(x+6,y+13,String(d.day),{size:9.5,weight:400,fill:ink,anchor:'start',
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

const KINDS={yoy:drawYoy,diverge:drawDiverge,panels:drawPanels,
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
  /* opt.cls — модификатор контейнера: 'narrow' — график не шире 760px
     (воронка: растянутая на всю панель, она читалась «сумасшедшей») */
  return '<div class="svgchart'+(opt.fill?' fill':'')+(opt.cls?' '+opt.cls:'')+'" data-cid="'+id+'">'+
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
  sparkBars,sparkLine,niceMax,textW,esc,stateColor,tipHtml,heat,heatInk,
  FONT,PALETTE,C_LINE,C_BENCH,C_PREV,C_GHOST,C_GREEN,C_RED,C_IN,C_OUT,C_LABEL,C_AXIS,C_DIV,C_TOTAL,
  C_HIRE,C_HIRE_D,C_HIRE_I,C_FIRE,C_TR_IN,C_TR_OUT,C_CNT,C_OTHER,C_FLAT,
  C_VAC,C_UNDER,C_LOWPERF,C_OFFICE,C_REGRET,C_NOREG,C_TURN_Y,C_AI};
})();

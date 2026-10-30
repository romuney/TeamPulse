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
   у каждой (горчичный у недоработчиков, пыльно-розовый у оценок ревью)
   ничего не кодировал, а заказчик читал их как блёклые и случайные. Имена
   оставлены — экраны ссылаются на них, и смена тона не требует правок там. */
const C_VAC=C_LINE,            /* открытые вакансии */
      C_UNDER=C_LINE,          /* недоработчики */
      C_REVIEW=C_LINE,         /* ревью (лоу-перформеры сняты 15.10) */
      C_OFFICE=C_LINE,         /* посещаемость офиса в таблицах */
      C_REGRET='#8A4FD8',      /* нежелательный уход — тон ухода */
      C_NOREG='#CDBEF0',       /* обычный уход — светлый тон ухода */
      C_TURN_Y=C_LINE,         /* текучесть накопительная */
      /* Использование AI — данные, а не AI-подсказка: фиолетовый --ai занят
         плашками Пульса, и столбики WAU в нём читались бы как подсказка. */
      C_AI=C_LINE;
/* 27.10-в, T-рост: статусы «повторно в росте» и «нет заявки», отказ в тепловой таблице успешности */
/* поставка 83 (задача 3): потоки «Рост» и T@T — один зелёный, у T@T с прозрачностью 50% (#…80) */
/* файл 6, п. 5: прошлый год Рост / T@T — серый (тон прошлого года отчёта) и серый с прозрачностью */
const C_ROST={again:'#E8A33D',none:'#9AA0AC',rost:'#8fd8a9',tat:'#8fd8a980',rostP:'#b9bdc6',tatP:'#b9bdc680'};
const PALETTE=[C_TR_IN,C_HIRE_I,C_HIRE_D,C_HIRE,C_FIRE,C_TR_OUT,C_CNT,C_OTHER];

/* ---------- Бары и полосы — мягкие ступени тех же тонов ----------
   13.10, заказчик: «барчарт занимает много места и краски — сделаешь супер
   ярким, режет глаз; линия тонкая, ей яркость нужна, пастельная линия
   некрасива». Поэтому у одного потока два тона: насыщенный — для линии,
   мягкий — для бара, полосы в ячейке, водопада. Мятный и сиреневый —
   как в исходной гамме отчёта, но с насыщенностью выше порога «читается
   серым»: пара найм/уход проходит валидатор палитры (светлота, насыщенность,
   различимость в т. ч. при дальтонизме); контраст с белым ниже 3:1, поэтому
   у баров всегда подписи значений. */
const SOFT={};
SOFT[C_HIRE]='#66C8AE';          /* мятный — найм, приход */
SOFT[C_FIRE]='#A88AD9';          /* сиреневый — уход */
SOFT[C_LINE]='#7FA2E6';          /* пыльный голубой — одиночная метрика (= --bar-soft) */
SOFT[C_HIRE_I]='#5FA5DE';        /* внутренний найм, перевод внутрь */
SOFT[C_TR_IN]='#5FA5DE';
SOFT[C_HIRE_D]='#4FB89B';
SOFT[C_TR_OUT]='#7F93CF';
function soft(c){return SOFT[c]||c}

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

   {title, text, list:['…'], rows:[{label,value,color,dash}], note:'…'|['…','…']}
   Все поля необязательны. В text: перенос строки — новый абзац, строка с «• » —
   пункт списка, **…** — жирное (15.10, редполитика TEXT_GUIDE.md: «не одним куском»).
   list — тот же список массивом. Строк-значений держим не больше трёх, сносок — двух:
   подсказка объясняет точку, а не заменяет таблицу.

   ВАЖНО: конструктор экранирует входы САМ. Вызывающий передаёт сырой текст,
   без esc() — иначе в подсказке будут видны &quot; и &amp;. */
const tipB=t=>esc(t).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');
function tipList(items){
  return items.length?'<span class="t-ul">'+items.map(x=>'<span class="t-li">'+tipB(x)+'</span>').join('')+'</span>':'';
}
/* абзацы и пункты: span, а не p/ul — подсказка живёт и в SVG-атрибуте, и в HTML */
function tipText(t){
  let s='', li=[];
  String(t).split('\n').forEach(l=>{
    if(/^•\s*/.test(l)){li.push(l.replace(/^•\s*/,''));return}
    s+=tipList(li);li=[];
    if(l.trim())s+='<span class="t-x">'+tipB(l)+'</span>';
  });
  return s+tipList(li);
}
function tipHtml(o){
  if(o==null)return '';
  if(typeof o==='string')return o;          /* строку тоже принимаем: не все места объектные */
  let s='';
  if(o.title)s+='<span class="t-h">'+esc(o.title)+'</span>';
  if(o.text)s+=tipText(o.text);
  if(o.list)s+=tipList(o.list.filter(Boolean));
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
  ns.forEach(n=>{if(n)s+='<span class="t-n">'+tipB(n)+'</span>'});
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
/* Бар вниз от нуля («ежики» пары потоков): скругляется дальний от нуля край — низ. */
function barDn(x,y,w,h,fill,extra){
  h=Math.max(0,h);
  const r=Math.min(2,w/2,h);
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
const SERIES={yoy:['main','prev','bench'],pair:['a','b','cur','prev'],panels:['main','prev'],
              waterfall:['total','in','out'],stack:['under','normal','over','grey']};
/* каскад держится на композиции — выключать типы столбцов в нём бессмысленно,
   остаётся только подсветка */
const LOCKED={waterfall:1};
const C_OFF='#c7c8cc';
function seriesOf(kind,legend){
  if(!legend||!legend.length)return[];
  const ids=SERIES[kind]||[];
  return legend.map((it,i)=>it.id||ids[i]||'');
}
function sAttr(sid){return sid?' data-s="'+sid+'"':''}
const NOSET={has:function(){return false},size:0};
function offOf(o){return (o&&o.off&&o.off.has)?o.off:NOSET}

/* ---------- Шапка: заголовок слева, легенда справа ----------
   Легенда называет серии своими именами: «Платформенные сервисы» и «всё HQ IT»,
   а не «значение» и «база сравнения» — иначе непонятно, что за синяя линия. */
/* Пункт легенды. Серия с id — кнопка: клик скрывает её (app.js →
   toggleSeries), наведение гасит чужие серии; подсказка говорит, что пункт
   нажимается (13.10: «легенды не интерактивные» — нажимались, но этого не
   было видно, а у панелей кнопок не было вовсе). Возвращает {s, x}: x —
   левый край пункта, следующий встаёт левее. */
function lgItem(x,y,it,sid,off,lock){
  const tw=textW(it.name,11.5), dead=!!(sid&&off&&off.has&&off.has(sid)), col=dead?C_OFF:it.color;
  x-=tw;
  const tx=x, mx=x-6-16;
  let g=txt(tx,y+12,it.name,{size:11.5,fill:dead?C_AXIS:C_LABEL,anchor:'start'});
  /* thin — линия прошлого года у пары потоков: бледная линия, а не плашка */
  /* split — год у пары потоков: верх цветом прихода, низ цветом ухода (14.10);
     ghost — прошлый год у потоков: тот же цвет, почти прозрачный (15.10) */
  const go=it.ghost&&!dead?' fill-opacity="'+GHOST_OP+'"':'';
  g+=it.dash?line(mx,y+8.5,mx+16,y+8.5,col,2.2,'5 3'):it.thin?line(mx,y+8.5,mx+16,y+8.5,col,2.2)
    :it.split?rect(mx,y+4.5,16,4,dead?C_OFF:it.split[0],1,go)+rect(mx,y+8.5,16,4,dead?C_OFF:it.split[1],1,go)
    :rect(mx,y+4.5,16,8,col,2,go);
  /* выключенная серия — не просто бледнее: бледное читается как «малое
     значение». Перечёркиваем подпись — это однозначное «скрыто» (поставка 96: заказчик оставил этот вид) */
  if(dead)g+=line(tx-1,y+8.5,tx+tw+1,y+8.5,C_AXIS,1.2);
  if(!sid)return {s:g,x:x-16-14};
  /* По <text> клик ловится только по глифам — между буквами дыры.
     Поэтому сверху лежит прозрачная ловушка на весь пункт. */
  return {x:x-16-14,s:'<g class="lg'+(lock?' lock':'')+(dead?' dead':'')+'" data-sid="'+sid+'"'
    +' tabindex="0" role="button" aria-pressed="'+(dead?'false':'true')+'"'
    +' aria-label="'+esc(it.name)+(lock?'':(dead?': включить':': скрыть'))+'"'
    +tip({title:it.name,text:lock?'Эту серию не скрыть: график держится на ней.':dead?'Клик — вернуть.':'Клик — скрыть, наведение — подсветить.'})+'>'
    +g+'<rect class="hit" x="'+num(mx-4)+'" y="'+num(y)+'" width="'+num(tw+16+6+8)+'" height="18"/></g>'};
}
/* 27.10-в, п. 18: узкий график — легенда не помещается рядом с заголовком и встаёт второй строкой под ним */
function wraps(w,title,legend){
  return !!(w&&title&&legend&&legend.length&&textW(title,TTL_SZ)+legend.reduce((v,it)=>v+textW(it.name,11.5)+30,0)+24>w);
}
function header(w,title,legend,ctx){
  ctx=ctx||{};
  const off=ctx.off, lock=LOCKED[ctx.kind];
  let s='';
  if(title)s+=txt(0,12,title,{size:TTL_SZ,weight:TTL_W,fill:C_INK,anchor:'start'});
  if(legend&&legend.length){
    const ids=seriesOf(ctx.kind,legend), y=wraps(w,title,legend)?22:0;
    let x=w;
    for(let i=legend.length-1;i>=0;i--){const r=lgItem(x,y,legend[i],ids[i],off,lock);s+=r.s;x=r.x}
  }
  return s;
}
function headH(title,legend,w){return (title||(legend&&legend.length))?24+(wraps(w,title,legend)?22:0):0}

/* Ось X всех графиков динамики — двенадцать месяцев календарного года
   (yoyAxis ниже): с 13.10 скользящего окна «12 мес» на графиках нет. */
/* ---------- Единая геометрия графиков ----------
   Все виды считают отступы от этих констант и ни одного числа в коде
   больше не пишут: разъехавшиеся на пару пикселей отступы читаются как грязь. */
const AXIS_H=30;        /* месяц + год под ним — единая высота оси везде */
const HEAD_GAP=8;       /* воздух под заголовком — один на все графики */
/* 30.10, типограф: подписи значений — обычным начертанием, жирная только у текущего месяца (VAL_NOW) */
const VAL_SZ=11, VAL_W=400, VAL_NOW=700;  /* ЕДИНСТВЕННЫЙ кегль подписи значения */
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
   yoyAnn. Месяцы из hi у линии — залитой точкой, у баров — светлой полосой за
   месяцем и контуром бара; бары этого года все одного тона (16.10: «не нужно затенять 2026 год»),
   подпись у каждого бара. Заметка — короткая
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
  const a=kpi.annual||kpi, suf=kpi.annual?' за год':'';
  return Math.ceil(Math.max(textW('порог '+CD.fmtVal(key,a.red)+suf,10.5),
    textW('цель '+CD.fmtVal(key,a.green)+suf,10.5)))+12;
}
/* 21.10, поставка 50: годовая цель прод-отчёта HQ (kpi.annual) — коридор по оси года: в месяце i
   цель — годовая × (i + 1) / 12, к декабрю — годовая; подпись справа — годовая «за год». Цель и
   порог совпадают (бенчмарк) — одна линия */
function kpiSlope(key,kpi,xL,xR,Y){
  const a=kpi.annual, bw=(xR-xL)/12, X=i=>xL+bw*(i+0.5);
  const pts=v=>Array.from({length:12},(_,i)=>X(i).toFixed(1)+','+Y(v*(i+1)/12).toFixed(1)).join(' ');
  const rows=a.green===a.red?[['green',C_RED,'цель ']]:[['green',C_GREEN,'цель '],['red',C_RED,'порог ']];
  const ty=rows.map(([k])=>Y(a[k]));
  if(ty.length===2&&Math.abs(ty[0]-ty[1])<13){const m=(ty[0]+ty[1])/2, up=ty[0]<=ty[1]?-1:1;ty[0]=m+up*6.5;ty[1]=m-up*6.5}
  let s='';
  rows.forEach(([k,c,lb],i)=>{
    s+='<polyline points="'+pts(a[k])+'" fill="none" stroke="'+c+'" stroke-width="1.4" stroke-dasharray="2 3"/>';
    s+=txt(xR+6,ty[i]+3.5,lb+CD.fmtVal(key,a[k])+' за год',{size:10.5,fill:C_AXIS,anchor:'start'});
  });
  return s;
}
function kpiLines(key,kpi,xL,xR,Y){
  if(kpi.annual)return kpiSlope(key,kpi,xL,xR,Y);
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
/* Номерная отметка факта «Что видно» (One-pager, механика HRBP HUB): кружок
   с номером на точке, о которой говорит пункт списка рядом с графиком. */
const C_MK='#1f1f1f', C_MK_PREV='#7d8494';
/* Прошлый год у баров потоков (15.10): бар того же цвета, чуть шире и почти
   прозрачный — позади бара этого года. Засечки (14.10) заказчику не легли:
   «выглядят стрёмно, особенно на пустых месяцах». Выключили этот год в
   легенде — прошлый становится обычным баром. */
const GHOST_OP=.18;
/* 23.10, заказчик: численность — серыми барами, как во всех отчётах (линией она читалась другой метрикой). Прошлый
   год — тот же прозрачный бар позади, но тоном подписей осей: серый на 18% от серого не видно */
const HC_BARS=new Set(['hc_total','hc_active','hc_avg']);
function asBars(key){return !!(CD.METRIC_BY_KEY[key]||{}).flow||HC_BARS.has(key)}
function ghostCol(col){return col===C_CNT?C_AXIS:col}
const ghostW=(bw,bandW)=>Math.min(bandW*0.86,bw*1.5);

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
/* Легенда панели «год к году»: этот год цветом панели, прошлый — серым.
   Пункты — те же кнопки, что в шапке графика (lgItem): клик скрывает линию
   во всех панелях графика, наведение подсвечивает её. */
function yoyKey(w,y,col,off,lock,flow,bn){
  /* поставка 96: bn — имя базы, если у панели есть её линия */
  const it=(flow?[{name:String(CD.YEAR_CUR),color:soft(col)},{name:String(CD.YEAR_PREV),color:ghostCol(col),ghost:true}]
    :[{name:String(CD.YEAR_CUR),color:col},{name:String(CD.YEAR_PREV),color:C_PREV}]).concat(bn?[{name:bn,color:C_BENCH,dash:true}]:[]),
    ids=['main','prev','bench'];
  let x=w,s='';
  for(let i=it.length-1;i>=0;i--){const r=lgItem(x,y,it[i],ids[i],off,lock);s+=r.s;x=r.x}
  return s;
}
/* Месяцы оси года: на узком полотне — через один от января, текущий подписан
   всегда и жирно. «Вы здесь» — тонкая сплошная: пунктиром уже сказаны цель и база. */
/* Незакрытый месяц (20.10): у последнего месяца на оси — по какое число данные: «1–19 окт.»
   у вызревающей метрики (поток за неполный месяц), «19 окт.» у состояния (численность на дату) */
function nowLabel(lb,key){return CD.PARTIAL?(CD.matures(key)||CD.partFlow(key)?'1–':'')+CD.ASOF.d+' '+CD.MONTH_ABBR_GEN[CD.ASOF.m]:lb}
/* поставка 95 (заказчик): «может измениться», а не «вырастет» — к концу месяца значение не обязательно растёт */
const PART_NOTE=k=>'Месяц не закрыт: данные по '+CD.ASOF_LABEL+', значение может измениться к концу месяца.';
/* 26.10, ревью критиков: у неполного месяца потока — период вместо имени месяца и без «год к году» (12 дней против
   полного месяца давали ложное «−9»); будущие месяцы — «ещё впереди», а не «не закрыт» */
const tipMon=(i,nowI,pf)=>pf&&i===nowI&&CD.PARTIAL?'1–'+CD.ASOF.d+' '+CD.MONTH_GEN[i]:CD.MONTH_NOM[i].replace(/^./,x=>x.toUpperCase());
const tipAhead=(i,nowI)=>i>nowI?tipMon(i)+' '+CD.YEAR_CUR+' ещё впереди — показан '+CD.YEAR_PREV:'Месяц ещё не закрыт';
/* 31.10, п. 8: текущий (незакрытый) месяц — подписью обычным шрифтом, как остальные; акцент — на закрытом месяце (жирная
   подпись месяца и значения). Месяц закрыт — он и есть закрытый. Поставка 90: штрихуется сам бар незакрытого месяца —
   мягким цветом ряда, бледнее закрытых, без контура; не полоса за ним (фон читался как «обратите внимание») */
const closedIdx=nowI=>CD.PARTIAL?nowI-1:nowI;
let _hid=0;
function hatchFill(col){
  const id='tpH'+(++_hid);
  return ['<defs><pattern id="'+id+'" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'+
    '<rect width="5" height="5" fill="'+soft(col)+'" fill-opacity=".18"/><rect width="2" height="5" fill="'+soft(col)+'" fill-opacity=".7"/></pattern></defs>','url(#'+id+')'];
}
/* поставка 90: на узкой оси (13" и уже) незакрытый месяц — коротко («окт.», неполноту говорит штриховка), чтобы рядом
   поместилась жирная подпись закрытого месяца — она видна всегда */
const axLbl=(lb,i,nowI,key,nr)=>[i===nowI&&!nr?nowLabel(lb,key):lb,
  i===closedIdx(nowI)?{size:10.5,weight:700,fill:C_LABEL}:{size:10.5,fill:C_AXIS}];
/* поставка 93 (заказчик): выделение оси на месяцах итога снято — «толсто и грязно»; итог — строкой над графиком */
function yoyAxis(X,bandW,top,bot,nowI,bars,key){
  /* у баров черты «вы здесь» нет (15.10): она резала бар последнего месяца */
  let s=bars?'':line(X(nowI),top-6,X(nowI),bot,C_NOW,1);
  CD.MONTH_ABBR.forEach((lb,i)=>{
    /* «1–12 окт.» шире месяца: на узкой оси соседей не подписываем — иначе «сен1–12 окт.нояб.» (ревью критиков, 24) */
    if(bandW>=31||i%2===0||i===nowI||i===closedIdx(nowI)){
      const a=axLbl(lb,i,nowI,key,bandW<56);s+=txt(X(i),bot+15,a[0],a[1]);
    }
  });
  return s+line(X(0)-bandW/2,bot,X(11)+bandW/2,bot,C_ZERO,1);
}
/* Подсветка месяцев для связки «пункт списка ↔ график»: невидимые полосы,
   которые проявляет класс on (app.js — наведение на пункт «Что видно»). */
/* 31.10, п. 2: самая яркая клетка тепловых таблиц «Роста» — ffc3b1 с прозрачностью cc */
const C_HEAT_RGB='255,195,177', HEAT_MAX=0.8;
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
   ней этот год и прошлый — ВСЕГДА линиями, у любой метрики, и счётной тоже
   (13.10, второй заход: бары с серой «тенью» прошлого года сбивали с толку
   рядом с линиями). Текущий год — насыщенная линия с подписями; прошлый —
   бледная, без подписей (значения — в подсказке месяца).

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
     p  = {key, cur[12], prev[12], bench?, color, kpi,
           ann (уже на оси года), marks:[{i, s, n}], gap, off, benchName, link}
     ar = {x0, plotW, top, bot, hitTop, delay}
   ========================================================================== */
function yoyPlot(p,ar){
  const key=p.key, cur=p.cur, prev=p.prev, bench=p.bench||null, off=p.off||NOSET;
  const nm=CD.METRIC_BY_KEY[key]||{}, col=p.color||C_LINE, flow=asBars(key);
  const x0=ar.x0, plotW=ar.plotW, top=ar.top, bot=ar.bot, bandW=plotW/12, d0=ar.delay||0;
  const showMain=!off.has('main'), showPrev=!off.has('prev'), showBench=!!bench&&!off.has('bench');
  const nowI=CD.CUR_LEN-1, ya=p.ann||null, marks=p.marks||[];
  const all=[].concat(showMain?cur:[],showPrev?prev:[],showBench?bench:[]).filter(v=>v!=null);
  if(p.kpi){const a=p.kpi.annual||p.kpi;all.push(a.green);all.push(a.red)}
  const max=niceMax(all);
  const Y=v=>bot-(v/max)*(bot-top), X=i=>x0+bandW*(i+0.5);
  const big=(i,s)=>!!(ya&&ya.hi&&ya.hi.some(z=>z.i===i&&z.s===s));
  const noteAt=(i,s)=>ya&&ya.notes.find(z=>z.i===i&&z.s===s);
  const mkAt=(i,s)=>marks.find(z=>z.i===i&&z.s===s);
  let s='';
  (ya?ya.notes:[]).forEach(n=>{s+=rect(x0+bandW*n.i+2,top-ANN_ROOM-4,bandW-4,bot-top+ANN_ROOM+4,C_BAND,6)});
  /* Бары: акцент главы — светлая полоса за месяцем и контур бара, а не другой тон
     (16.10, заказчик: «не нужно затенять 2026 год — он весь одного цвета, инсайты
     выделяй по-другому»). У заметки полоса уже есть — второй не рисуем. */
  if(flow&&ya&&ya.hi)ya.hi.forEach(z=>{if(z.s==='main'&&!ya.notes.some(n=>n.i===z.i))
    s+=rect(x0+bandW*z.i+2,top-4,bandW-4,bot-top+4,C_BAND,6)});
  /* 27.10, Антон (вопрос 2): ставка незакрытого месяца на линии — серая полоса за месяцем, точка полая, подпись «· 12 дн» */
  /* p.mature — вызревает и метрика, у которой это не свойство ключа (HQ текучесть в «Как уходит HQ?», 27.10-в, п. 6) */
  const part=p.mature?CD.PARTIAL:CD.matures(key), curS=part?cur.map((v,i)=>i===nowI?null:v):cur;
  const pl=!flow&&CD.PARTIAL&&CD.partFlow(key)&&!part;
  if(p.link)s+=yoyBands(x0,bandW,top,bot);
  s+=yoyAxis(X,bandW,top,bot,nowI,flow,key);
  /* вызревающий последний месяц: линия к нему — пунктиром, точка и бар — пунктирным контуром */
  if(p.kpi)s+=kpiLines(key,p.kpi,x0,x0+plotW,Y);
  if(p.gap&&showMain&&showBench)s+=gapFill(key,cur,bench,X,Y);
  /* Счётный поток (найм, уход, переводы, решения) — барами (14.10, заказчик:
     «всё, что связано с наймом и оттоком, — обязательно барчарты»): этот год —
     мягким баром, прошлый — позади него тем же цветом, шире и почти прозрачно
     (15.10). Выключили этот год — прошлый становится обычным баром. */
  const bw=Math.max(6,Math.min(30,bandW*0.58)), gw=ghostW(bw,bandW);
  if(showPrev&&!flow)s+='<path class="lnb"'+sAttr('prev')+' d="'+polyD(prev,X,Y)+'" fill="none" stroke="'+C_PREV+'"'
    +' stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>';
  if(showBench)s+='<path class="lnb"'+sAttr('bench')+' d="'+polyD(bench,X,Y)+'" fill="none" stroke="'+C_BENCH+'"'
    +' stroke-width="2" stroke-dasharray="5 3"/>';
  /* 29.10, п. 6: прошлый год — весь позади этого: его точки и бары рисуются до линии и точек этого года (раньше они
     лежали в группах месяцев поверх линии этого года) */
  /* поставка 98 (заказчик): у незакрытого месяца бар и точка прошлого года есть, как у остальных месяцев («без них
     странно»); не сравниваем их только словами — у него нет подписи значения прошлого года и «год к году» в подсказке */
  const noPrev=i=>CD.PARTIAL&&i===nowI&&showMain;
  /* бар частями снизу вверх; hz — незакрытый месяц: каждая часть своей штриховкой */
  const stk=(A,cols,i,cx,w,sr,hz)=>{let r='',yb=bot;A.forEach((a,k)=>{const hh=(a[i]||0)/max*(bot-top), hk=hz&&hatchFill(cols[k]);
    if(hh>0.5){r+=(hk?hk[0]:'')+barUp(cx-w/2,yb-hh,w,hh,hk?hk[1]:cols[k],' class="bar up'+(hk?' part':sr==='prev'?' ghost':'')+'"'+sAttr(sr));yb-=hh}});return r};
  /* засечки: тонкая вертикаль от оси X к каждой точке этого года — месяц точки читается без поиска по оси */
  if(showMain&&!flow)cur.forEach((c,i)=>{if(c!=null)s+=line(X(i),bot,X(i),Y(c),C_DIV,1)});
  for(let i=0;i<12;i++){
    const pv=prev[i], cx=X(i);
    if(!showPrev||pv==null)continue;
    const bp=big(i,'prev')||!!noteAt(i,'prev');
    /* файл 6, п. 5: p.parts — бар частями (Рост и T@T «Роста»): прошлый год — теми же частями своими цветами (серый и серый
       с прозрачностью), позади этого */
    if(flow&&p.parts)s+=stk(p.parts.prev,p.parts.pcol,i,cx,showMain?gw:bw,'prev');
    else if(flow)s+=showMain
      ?barUp(cx-gw/2,Y(pv),gw,bot-Y(pv),ghostCol(col),' class="bar up ghost" fill-opacity="'+GHOST_OP+'"'+sAttr('prev'))
      :barUp(cx-bw/2,Y(pv),bw,bot-Y(pv),soft(col),' class="bar up"'+sAttr('prev'));
    else s+='<circle class="dotb"'+sAttr('prev')+' cx="'+num(cx)+'" cy="'+num(Y(pv))+'" r="'+(bp?4:2.4)+'" fill="'+C_PREV+'"/>';
  }
  if(showMain&&!flow)s+='<path class="ln"'+sAttr('main')+' pathLength="1" d="'+polyD(curS,X,Y)+'" fill="none" stroke="'+col+'"'
    +' stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"'+(d0?' style="animation-delay:'+d0+'ms"':'')+'/>';
  if(showMain&&!flow&&part&&nowI>0&&cur[nowI]!=null&&cur[nowI-1]!=null)s+='<path class="lnp"'+sAttr('main')+' d="'+
    polyD([cur[nowI-1],cur[nowI]],i=>X(nowI-1+i),Y)+'" fill="none" stroke="'+col+'" stroke-opacity=".45" stroke-width="2.2" stroke-dasharray="4 3" stroke-linecap="round"/>';
  const yC=CD.YEAR_CUR, yP=CD.YEAR_PREV, step=labelStep(cur,key,bandW);
  let lbl='', mk='';
  for(let i=0;i<12;i++){
    const c=cur[i], pv=prev[i], b=bench?bench[i]:null, cx=X(i);
    const rows=[];
    if(showMain&&c!=null)rows.push({label:String(yC),value:CD.fmtVal(key,c),color:col});
    /* p.tipRows(i) — части значения этого года в подсказке (26.10-б: виды найма), сериями на графике их нет */
    if(showMain&&c!=null&&p.tipRows)p.tipRows(i).forEach(r=>rows.push(r));
    if(showPrev&&pv!=null)rows.push({label:String(yP),value:CD.fmtVal(key,pv),color:C_PREV});
    if(showBench&&b!=null)rows.push({label:p.benchName||'база',value:CD.fmtVal(key,b),color:C_BENCH,dash:true});
    const pf=part||CD.partFlow(key), note=pf&&i===nowI?PART_NOTE(key):c!=null&&pv!=null?'Год к году: '+CD.fmtDelta(key,+(c-pv).toFixed(2))
      :c==null?tipAhead(i,nowI):null;
    const dly=d0+DRAW_MS*(i/Math.max(1,nowI))*0.9;
    s+='<g class="ptg" data-mi="'+i+'"'+tip({title:tipMon(i,nowI,pf)+((p.tipName||nm.name)?' · '+(p.tipName||nm.name):''),rows,note})+'>';
    s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(ar.hitTop)+'" width="'+num(bandW)+'" height="'+num(bot-ar.hitTop)+'"/>';
    /* акцент главы — крупная залитая точка у линии и светлая полоса за месяцем
       у баров; остальные точки, бары и подписи не приглушаются (13.10: «всё
       остальное стало нечитабельным»; 16.10: «год весь одного цвета») */
    const bm=big(i,'main');
    if(flow){
      /* прошлый год — позади (нарисован до этого года, выше); этот год — весь одним тоном, как в легенде; акцент — полосой за месяцем (выше)
         и контуром основным цветом, заливка та же */
      const hz=CD.PARTIAL&&i===nowI&&hatchFill(col);
      if(showMain&&c!=null&&p.parts)s+=stk(p.parts.cur,p.parts.col,i,cx,bw,'main',hz);
      else if(showMain&&c!=null)s+=(hz?hz[0]:'')+barUp(cx-bw/2,Y(c),bw,bot-Y(c),hz?hz[1]:soft(col),' class="bar up'+(hz?' part':'')+'"'+sAttr('main')+
        (bm&&!hz?' stroke="'+col+'" stroke-width="1.6"':'')+' style="animation-delay:'+num(dly*0.5)+'ms"');
    }else{
      if(showMain&&c!=null)s+='<circle class="dot"'+sAttr('main')+' cx="'+num(cx)+'" cy="'+num(Y(c))+'" r="'+(bm?4.6:3.4)+'" fill="'+(bm&&!(pl&&i===nowI)?col:'#fff')+'" stroke="'+col+'"'
        +' stroke-width="2"'+(part&&i===nowI?' stroke-opacity=".45"':'')+' style="animation-delay:'+num(dly)+'ms"/>';
    }
    s+='</g>';
    /* Подписи. У последнего закрытого месяца подписаны обе линии, и подписи
       разведены по разные стороны: верхняя точка — над собой, нижняя — под
       собой. Иначе на близких значениях цифры легли бы одна на другую.
       У точки с номерной отметкой подпись отодвинута от кружка. */
    if(flow&&showMain&&c!=null&&(lblAt(i,nowI,step)||big(i,'main')||mkAt(i,'main'))){
      /* подпись — над баром этого года, даже если прозрачный бар прошлого выше:
         над ним цифра читалась как его значение */
      lbl+=txt(cx,Y(c)-VAL_DY-(mkAt(i,'main')?5:0),CD.fmtVal(key,c),valOpt({delay:dly,s:'main',weight:i===closedIdx(nowI)?VAL_NOW:VAL_W}));
    }else if(flow&&!showMain&&showPrev&&pv!=null&&lblAt(i,nowI,step)){
      /* этот год выключен — прошлый показан обычными барами и подписан так же */
      lbl+=txt(cx,Y(pv)-VAL_DY,CD.fmtVal(key,pv),valOpt({s:'prev'}));
    }else if(!flow&&showMain&&c!=null&&(lblAt(i,nowI,step)||big(i,'main')||mkAt(i,'main'))){
      /* под точкой у оси места нет (значение около нуля): там подпись легла бы на месяц — тогда над точкой */
      const rm=v=>Y(v)+VAL_DY+VAL_ASC<bot-2, both=i===nowI&&showPrev&&pv!=null&&!noPrev(i), below=both&&pv>c&&rm(c);
      const sh=mkAt(i,'main')?5:0;
      lbl+=txt(cx,below?Y(c)+VAL_DY+VAL_ASC+sh:Y(c)-VAL_DY-sh,CD.fmtVal(key,c)+(pl&&i===nowI?' · '+CD.ASOF.d+' дн':''),valOpt({delay:dly,s:'main',weight:i===closedIdx(nowI)?VAL_NOW:VAL_W}));
      if(both)lbl+=txt(cx,below||!rm(pv)?Y(pv)-VAL_DY-(mkAt(i,'prev')?5:0):Y(pv)+VAL_DY+VAL_ASC+(mkAt(i,'prev')?5:0),CD.fmtVal(key,pv),
        valOpt({s:'prev',fill:C_AXIS,weight:400}));
    }
    /* две отметки в одном месяце на близких значениях (этот год и прошлый
       почти равны): подпись остаётся одна */
    const twin=!!(mkAt(i,'main')&&mkAt(i,'prev')&&c!=null&&pv!=null&&Math.abs(Y(c)-Y(pv))<17);
    /* прошлогодняя точка с акцентом или отметкой — подписана: о ней говорит текст */
    if(showPrev&&pv!=null&&!twin&&!(i===nowI&&showMain&&c!=null&&!flow)&&!(flow&&!showMain)&&(big(i,'prev')||noteAt(i,'prev')||mkAt(i,'prev')))
      lbl+=txt(cx,Y(pv)-VAL_DY-(mkAt(i,'prev')?5:0),CD.fmtVal(key,pv),valOpt({s:'prev',fill:C_AXIS,weight:400}));
    const nt=noteAt(i,'main')||noteAt(i,'prev');
    if(nt){
      const v=nt.s==='prev'?pv:c;
      if(v!=null)lbl+=annText({notes:[{i:i,t:nt.t}]},i,cx,Y(v),x0,plotW);
    }
    /* отметка стоит ровно на своей точке; две в одном месте (точки двух лет
       совпали) — рисуется одна, этого года: разводить их в стороны нельзя,
       тогда обе «не совпадают с точками» (14.10) */
    ['main','prev'].forEach(sr=>{
      const m=mkAt(i,sr), v=sr==='prev'?pv:c;
      if(sr==='prev'&&twin&&showMain)return;
      if(m&&v!=null&&(sr==='prev'?showPrev:showMain))mk+=mkMark(cx,Y(v),m,dly);
    });
  }
  return s+lbl+mk;
}
/* 31.10: итог за период (CD.periodTotal) — одна строка под шапкой графика: тип итога первым словом, этот год жирным,
   прошлый серым, изменение — плашкой (зелёная/красная, если направление однозначно, иначе серая). Черта под осью —
   месяцы, вошедшие в итог. Ширину кусков меряем шрифтом на canvas (оценка textW по числу букв уводила значение вправо) */
let _mc;
function measureW(t,size,bold){
  if(_mc===undefined)try{_mc=document.createElement('canvas').getContext('2d')}catch(e){_mc=null}
  if(!_mc)return textW(t,size);
  _mc.font=(bold?'bold ':'')+size+'px '+FONT;return _mc.measureText(String(t)).width;
}
const PERIOD_H=20, PT_BG={g:'#e6f6ec',b:'#fdecec',n:'#eef0f3'}, PT_FG={g:'#0a8f3c',b:'#d11414',n:'#5b616d'};
/* куски строки — группами [текст, жирный?, плашка?]; группа, что не влезает в ширину, уходит на новую строку
   (узкий экран), разделитель « · » в начале строки снимаем. У пары (p.parts) — оба потока, у каждого — год назад */
function periodLine(p,y,w){
  if(!p)return {s:'',h:0};
  const gs=p.parts?[[[p.head+': ']]].concat(p.parts.map((q,i)=>[[(i?' · ':'')+q.name+' '],[q.cur,1]].concat(q.prev!=null?[[' (год назад '+q.prev+')']]:[]))):
    [[[p.head+': '],[p.cur,1]]].concat(p.prev!=null?[[[' · год назад '+p.prev]]]:[],p.delta?[[[p.delta,1,p.good==null?'n':p.good?'g':'b']]]:[]);
  const W=q=>q[2]?measureW(q[0],10.5,1)+18:measureW(q[0],q[1]?12:11,q[1])+(q[1]?2:0);
  let x=0,n=0,s='';
  gs.forEach(g=>{
    if(x&&x+g.reduce((t,q)=>t+W(q),0)>w){x=0;y+=15;n++;g[0]=[g[0][0].replace(/^ · /,'')].concat(g[0].slice(1))}
    g.forEach(q=>{const tw=W(q);
      s+=q[2]?rect(x+6,y-11.5,tw-6,15,PT_BG[q[2]],7.5)+txt(x+3+tw/2,y-0.5,q[0],{size:10.5,weight:700,fill:PT_FG[q[2]]}):
        txt(x,y,q[0],{size:q[1]?12:11,weight:q[1]?700:0,fill:q[1]?C_INK:C_AXIS,anchor:'start'});
      x+=tw});
  });
  return {s:'<g class="pt-line">'+s+'</g>',h:PERIOD_H+n*15};
}
function drawYoy(a,w,h){
  const o=a.opt||{};
  const hh=headH(o.title,o.legend,w), pt=periodLine(o.period,hh+11,w), ph=pt.h;
  h=h||o.h||280;
  const ya=yoyAnn(annOf(o));
  const plotTop=hh+ph+LBL_ROOM+yoyRoom(ya,o.marks), plotBot=h-AXIS_H+12;
  const x0=PAD_X, plotW=w-PAD_X*2-kpiRoom(a.metricKey,o.kpi);
  return svg(w,h,header(w,o.title,o.legend,{kind:'yoy',off:o.off})+pt.s+
    yoyPlot({key:a.metricKey,cur:a.cur,prev:a.prev,bench:a.bench,color:o.color,kpi:o.kpi,
      ann:ya,marks:o.marks,gap:o.gap,period:o.period,off:offOf(o),benchName:o.benchName,link:o.link,tipRows:o.tipRows,tipName:o.tipName,parts:o.parts},
      {x0:x0,plotW:plotW,top:plotTop,bot:plotBot,hitTop:hh}));
}

/* ============================================================================
   2. Пара встречных потоков — пришли и ушли (найм / отток, переводы, решения
      T-роста) — год к году «ежиками»: приход барами вверх от нуля, уход —
      вниз (14.10, заказчик: «барчарты вверх-вниз, как ежики были, которые ты
      зачем-то убрал»; две линии этого года и две прошлого — «четыре линии на
      одном графике, это жесть»). Прошлый год — позади баров этого, тем же
      цветом, шире и почти прозрачно (15.10: засечки «выглядят стрёмно»).
      Легенда: два потока, этот год и прошлый. Выключили этот год — прошлый
      становится обычными барами.
      Шкала одна на оба потока: высота бара — люди, ноль между ними сдвигается
      так, чтобы большему потоку хватило места.
      a.a / a.b = {key, cur[12], prev[12]}; серии легенды — a, b, cur, prev.
   ========================================================================== */
function drawPair(a,w,h){
  const o=a.opt||{}, A=a.a, B=a.b;
  const nameA=o.aName||(CD.METRIC_BY_KEY[A.key]||{}).name||'', nameB=o.bName||(CD.METRIC_BY_KEY[B.key]||{}).name||'';
  const h0=headH(o.title,o.legend,w), pt=periodLine(o.period,h0+11,w), hh=h0+pt.h;
  h=h||o.h||300;
  const off=offOf(o), sA=!off.has('a'), sB=!off.has('b'), sC=!off.has('cur'), sP=!off.has('prev');
  const x0=PAD_X, plotW=w-PAD_X*2, bandW=plotW/12, nowI=CD.CUR_LEN-1, X=i=>x0+bandW*(i+0.5);
  const cA=o.aColor||C_IN, cB=o.bColor||C_OUT, fA=soft(cA), fB=soft(cB);
  const vals=(S)=>[].concat(sC?S.cur:[],sP||!sC?S.prev:[]).filter(v=>v!=null);
  const mA=sA?niceMax(vals(A)):0, mB=sB?niceMax(vals(B)):0;
  const top=hh+LBL_ROOM, bot=h-22-LBL_ROOM+6;
  const u=(bot-top)/((mA+mB)||1), y0=top+mA*u;
  const bw=Math.max(6,Math.min(28,bandW*0.56)), gw=ghostW(bw,bandW);
  let s=header(w,o.title,o.legend,{kind:'pair',off:o.off})+pt.s;
  const part=CD.matures(A.key)&&sC;
  CD.MONTH_ABBR.forEach((lb,i)=>{
    if(bandW>=31||i%2===0||i===nowI||i===closedIdx(nowI)){
      const a=axLbl(lb,i,nowI,A.key,bandW<56);s+=txt(X(i),h-6,a[0],a[1]);
    }
  });
  const yC=String(CD.YEAR_CUR), yP=String(CD.YEAR_PREV);
  const stepA=labelStep(A.cur,A.key,bandW), stepB=labelStep(B.cur,B.key,bandW), step=Math.max(stepA,stepB);
  let lbl='';
  for(let i=0;i<12;i++){
    const cx=X(i), va=A.cur[i], vb=B.cur[i], pa=A.prev[i], pb=B.prev[i];
    const rows=[];
    if(sA){if(va!=null)rows.push({label:nameA+' · '+yC,value:CD.fmtVal(A.key,va),color:fA});
      if(pa!=null)rows.push({label:nameA+' · '+yP,value:CD.fmtVal(A.key,pa),color:C_PREV})}
    if(sB){if(vb!=null)rows.push({label:nameB+' · '+yC,value:CD.fmtVal(B.key,vb),color:fB});
      if(pb!=null)rows.push({label:nameB+' · '+yP,value:CD.fmtVal(B.key,pb),color:C_PREV})}
    const pf=part||CD.partFlow(A.key), dly=DRAW_MS*(i/Math.max(1,nowI))*0.5;
    s+='<g class="ptg" data-mi="'+i+'"'+tip({title:tipMon(i,nowI,pf),rows,
      note:pf&&i===nowI?PART_NOTE(A.key):va==null&&vb==null?tipAhead(i,nowI):null})+'>';
    s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(hh)+'" width="'+num(bandW)+'" height="'+num(bot-hh)+'"/>';
    /* вверх — приход, вниз — уход. Прошлый год — позади, шире и почти прозрачно
       тем же цветом; выключили этот год — прошлый обычными барами */
    const up=sC?va:(sP?pa:null), dn=sC?vb:(sP?pb:null), go=' fill-opacity="'+GHOST_OP+'"';
    if(sC&&sP&&sA&&pa!=null)s+=barUp(cx-gw/2,y0-pa*u,gw,pa*u,cA,' class="bar up ghost"'+go+sAttr('prev'));
    if(sC&&sP&&sB&&pb!=null)s+=barDn(cx-gw/2,y0,gw,pb*u,cB,' class="bar dn ghost"'+go+sAttr('prev'));
    const pz=CD.PARTIAL&&sC&&i===nowI, hA=pz&&hatchFill(cA), hB=pz&&hatchFill(cB);
    if(sA&&up!=null)s+=(hA?hA[0]:'')+barUp(cx-bw/2,y0-up*u,bw,up*u,hA?hA[1]:fA,' class="bar up'+(pz?' part':'')+'"'+sAttr(sC?'a':'prev')+' style="animation-delay:'+num(dly)+'ms"');
    if(sB&&dn!=null)s+=(hB?hB[0]:'')+barDn(cx-bw/2,y0,bw,dn*u,hB?hB[1]:fB,' class="bar dn'+(pz?' part':'')+'"'+sAttr(sC?'b':'prev')+' style="animation-delay:'+num(dly)+'ms"');
    s+='</g>';
    if(!lblAt(i,nowI,step))continue;
    /* ноль не подписываем: у переводов он в каждом втором месяце и забивает полотно */
    /* подпись — у конца бара, который показан обычным: прозрачный бар прошлого
       года позади её не сдвигает */
    const wt=sC&&i===closedIdx(nowI)?VAL_NOW:VAL_W;
    if(sA&&up)lbl+=txt(cx,y0-up*u-VAL_DY,CD.fmtVal(A.key,up),valOpt({delay:dly,s:sC?'a':'prev',weight:wt}));
    if(sB&&dn)lbl+=txt(cx,y0+dn*u+VAL_DY+VAL_ASC,CD.fmtVal(B.key,dn),valOpt({delay:dly,s:sC?'b':'prev',weight:wt}));
  }
  /* ноль — поверх баров: от него растут оба потока */
  s+=line(x0,y0,x0+plotW,y0,C_ZERO,1);
  return svg(w,h,s+lbl);
}

/* ============================================================================
   3. Панели друг под другом. У КАЖДОЙ своя ось X под ней: одна общая ось внизу
      заставляла глазами бегать через весь блок. Каждая шкала — от нуля.
      С 13.10 — год к году: у каждой панели ось янв.–дек. и своя легенда
      «этот год / прошлый» цветом панели. p = {name, key, type, cur[12],
      prev[12], color, ann (по окну отчёта — переводится на ось года)}.
   ========================================================================== */
/* Минимальная высота панелей: меньше неё полотно не сжимается, и chart()
   ставит её контейнеру в style — иначе svg вылезал бы из контейнера, и под
   ним в прокрутке панели не оставалось бы воздуха (13.10). */
function panelsMin(ps){
  const minPanel=16+LBL_ROOM+70+(AXIS_H-12)+STACK_GAP+(ps.some(p=>yoyRoom(yoyAnn(annOf(p))))?ANN_ROOM:0)+(ps.some(p=>p.period)?PERIOD_H:0);
  /* воздух GAP нужен МЕЖДУ панелями, под последней он — лишняя дыра */
  return ps.length*minPanel-STACK_GAP+14;
}
function drawPanels(a,w,h){
  const ps=a.panels, o=a.opt||{}, off=offOf(o);
  const GAP=STACK_GAP;     /* воздух между осью X и заголовком следующей панели */
  const x0=PAD_X, plotW=w-PAD_X*2, HEAD=16, AX=AXIS_H-12;
  const yas=ps.map(p=>yoyAnn(annOf(p)));
  h=Math.max(h||o.h||340,panelsMin(ps));
  const panelH=(h-14+GAP)/ps.length;
  let s='';
  ps.forEach((p,pi)=>{
    const base=pi*panelH, ya=yas[pi];
    /* поставка 98: легенда не помещается рядом с названием (узкая панель, есть «вся компания») — второй строкой под ним */
    const bn=p.bench&&o.benchName, kw=[String(CD.YEAR_CUR),String(CD.YEAR_PREV)].concat(bn?[bn]:[]).reduce((a,t)=>a+textW(t,11.5)+30,0),
      kr=textW(p.name,TTL_SZ)+kw+16>w?18:0;
    const pt=periodLine(p.period,base+HEAD+kr+13,w), top=base+HEAD+kr+pt.h+LBL_ROOM+yoyRoom(ya), bot=base+panelH-AX-GAP;
    s+=txt(0,base+11,p.name,{size:TTL_SZ,weight:TTL_W,fill:C_INK,anchor:'start'});
    s+=pt.s;
    s+=yoyKey(w,base-1+kr,p.color||C_LINE,off,false,asBars(p.key),bn);
    s+=yoyPlot({key:p.key,cur:p.cur,prev:p.prev,bench:p.bench,benchName:o.benchName,color:p.color,ann:ya,off:off,mature:p.mature,period:p.period},
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
  const hh=headH(o.title,o.legend,w);
  h=h||o.h||320;
  /* вторая строка подписи — дата у «Начало» и «Конец» (20.10) */
  const subs=steps.some(st=>st.sub), plotTop=hh+LBL_ROOM, plotBot=h-AXIS_H-(subs?13:0);
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
    const col=st.total?C_TOTAL:soft(st.value>=0?C_IN:C_OUT);
    const sid=st.total?'total':(st.value>=0?'in':'out');
    const lab=(st.total?'':(st.value>0?'+':''))+CD.fmtInt(st.value);
    const t={title:st.name+(st.sub?' · '+st.sub:''),
      rows:[{label:st.total?'Уровень':'Изменение',value:lab,color:col}],
      note:st.note||(st.total?null:'накоплено: '+CD.fmtInt(g.to)+' чел')};
    s+='<g class="barg"'+tip(t)+'>';
    s+='<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(hh)+'" width="'+num(bandW)+'" height="'+num(plotBot-hh)+'"/>';
    s+=barUp(cx-bw/2,yTop,bw,Math.max(2,yBot-yTop),col,' class="bar up"'+sAttr(sid)+' style="animation-delay:'+(i*34)+'ms"');
    s+='</g>';
    s+=txt(cx,yTop-VAL_DY,lab,valOpt({delay:240+i*34,s:sid}));
    s+=txt(cx,plotBot+15,st.name,{size:10.5,fill:C_AXIS});
    if(st.sub)s+=txt(cx,plotBot+28,st.sub,{size:10,fill:C_AXIS});
    if(i<steps.length-1)s+=line(cx+bw/2,Y(g.to),x0+bandW*(i+1.5)-bw/2,Y(g.to),C_DIV,1,'3 2');
  });
  return svg(w,h,s);
}

/* ============================================================================
   5. Спарклайны.
      Ширина 100% с preserveAspectRatio="none": в таблице OnePager колонка
      «12 мес» тянется вместе с окном, и спарклайн должен тянуться с ней.
      Текста внутри нет, поэтому растяжение ничего не искажает.

      Цвет — ПО МЕСЯЦАМ, а не один на весь ряд: метрика хуже базы не красит
      весь год, если часть месяцев была лучше. Каждая точка сравнивается со
      своим месяцем базы или с целью KPI.
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

/* Один вид короткой динамики на весь One-pager (13.10, заказчик: «сделай все
   спарклайнами, а то где-то барчарты, а где-то лайнчарты»), как в HRBP HUB:
   линия ряда — нейтральная серая, у метрики с оценкой ТОЧКА каждого месяца
   окрашена по ориентиру этого месяца (цель KPI, иначе база того же месяца) —
   так оценка по месяцам, ради которой были цветные бары, осталась; последний
   месяц — точка крупнее. Тонкий пунктир — сам ориентир (линия базы или цель).
   У метрики без оценки точек нет, кроме последней: цвета у неё нет по правилу.

   Шкала подбирается по данным (и по ориентиру): от нуля численность 175 → 191
   — прямая, а спарклайн показывает форму; точные значения — в подсказке и
   соседних столбцах. Полный масштаб от нуля остаётся на графиках «год к году».

   svg тянется по ширине ячейки (preserveAspectRatio="none"), поэтому у линий
   vector-effect="non-scaling-stroke", а точки — пути нулевой длины с круглым
   концом и той же поправкой: растянутый по ширине кружок стал бы эллипсом,
   а штрих линии — толще на подъёмах, чем на ровных участках. */
const NSS=' vector-effect="non-scaling-stroke"';
function sDot(x,y,d,col,cls){
  return '<path'+(cls?' class="'+cls+'"':'')+' d="M'+num(x)+' '+num(y)+'h0" stroke="'+col+'" stroke-width="'+d+'"'+
    ' stroke-linecap="round"'+NSS+'/>';
}
/* Мини-график карточки вывода (главная «сначала выводы», 20.10): этот год —
   линией цвета оценки карточки (цвет — CSS по классу карточки), ориентир —
   пунктиром с подписью, точка последнего месяца. Без наведения: подробный
   график — по клику, строкой метрики в «Все метрики». */
function miniYoy(cur,ref,lbl,w,h){
  w=w||150;h=h||56;
  const vals=cur.concat(ref||[]).filter(v=>v!=null&&isFinite(v));
  if(!vals.length)return '';
  const mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals), rg=mx-mn||Math.abs(mx)||1;
  let lo=mn-rg*0.15;const hi=mx+rg*0.15;if(mn>=0&&lo<0)lo=0;
  const n=Math.max(cur.length,ref?ref.length:0), PAD=5, TOP=16;
  const X=i=>n>1?PAD+i/(n-1)*(w-2*PAD):w/2, Y=v=>h-PAD-(v-lo)/((hi-lo)||1)*(h-PAD-TOP);
  let s=ref?'<path class="mn-ref" d="'+polyD(ref,X,Y)+'"'+NSS+'/>':'', last=-1;
  s+='<path class="mn-l" d="'+polyD(cur,X,Y)+'"'+NSS+'/>';
  cur.forEach((v,i)=>{if(v!=null)last=i});
  if(last>=0)s+='<circle class="mn-d" cx="'+num(X(last))+'" cy="'+num(Y(cur[last]))+'" r="3.5"/>';
  if(lbl)s+='<text class="mn-t" x="'+(w-PAD)+'" y="11" text-anchor="end">'+esc(lbl)+'</text>';
  return '<svg class="mini" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" aria-hidden="true">'+s+'</svg>';
}
function sparkLine(series,state,w,h,o){
  o=o||{};w=w||120;h=h||26;
  const n=series.length, key=o.key, base=o.base, kpi=o.kpi;
  /* o.ink — у метрики нет оценки: без цветных точек */
  const ev=!o.ink&&!!key;
  const refs=kpi?series.map(()=>kpi.green):(base&&ev?base:null);
  const vals=series.concat(refs||[]).filter(v=>v!=null);
  const mn=vals.length?Math.min.apply(null,vals):0, mx=vals.length?Math.max.apply(null,vals):0, rg=mx-mn;
  let lo=mn-rg*0.12, max=mx+rg*0.12;
  /* ровный ряд — серединой полосы, а не прижатым к краю */
  if(!(rg>0)){const m=mx||1;lo=mn-Math.abs(m)*0.1;max=mx+Math.abs(m)*0.1}
  if(mn>=0&&lo<0)lo=0;
  /* PAD — поле по краям и сверху: точка на самом краю viewBox срезалась бы */
  const PAD=4, TOP=4;
  const X=i=>n>1?PAD+i/(n-1)*(w-2*PAD):w/2;
  const Y=v=>h-PAD-((v-lo)/((max-lo)||1))*(h-PAD-TOP);
  let s='';
  if(refs)s+='<path d="'+polyD(refs,X,Y)+'" fill="none" stroke="'+C_BENCH+'" stroke-width="1" stroke-dasharray="3 2"'+NSS+'/>';
  /* вызревающий последний месяц — последний отрезок пунктиром (20.10) */
  const part=key&&CD.matures(key)&&n>1&&series[n-1]!=null&&series[n-2]!=null;
  s+='<path d="'+polyD(part?series.slice(0,n-1):series,X,Y)+'" fill="none" stroke="'+C_SPARK_INK+'" stroke-width="1.6"'
    +' stroke-linejoin="round" stroke-linecap="round"'+NSS+'/>';
  if(part)s+='<path d="M'+num(X(n-2))+' '+num(Y(series[n-2]))+'L'+num(X(n-1))+' '+num(Y(series[n-1]))+'" fill="none" stroke="'+C_SPARK_INK+
    '" stroke-width="1.6" stroke-dasharray="3 2" stroke-linecap="round"'+NSS+'/>';
  let last=-1;
  series.forEach((v,i)=>{if(v!=null)last=i});
  const stAt=(v,i)=>ev?cmpState(key,v,i,base,kpi,false,state):'neutral';
  /* o.dots===false — без точек вовсе (14.10, заказчик: «во всех .col-spark и в
     KPI убрать точки — они есть в подробном графике при раскрытии»): только
     линия и пунктир ориентира; месяц под курсором по-прежнему подсвечивается */
  if(o.dots!==false)series.forEach((v,i)=>{
    if(v==null||(!ev&&i!==last))return;
    const st=stAt(v,i), col=ev?stateColor(st):C_SPARK_INK;
    s+=sDot(X(i),Y(v),i===last?6:4,col);
  });
  /* Наведение: под курсором подсвечивается ИМЕННО тот месяц, о котором говорит
     тултип. Всё на CSS (.spg:hover), никаких обработчиков. */
  if(key)series.forEach((v,i)=>{
    if(v==null)return;
    const gapw=w/n, cx=X(i), cy=Y(v), col=ev?stateColor(stAt(v,i)):C_SPARK_INK;
    const t={title:mLabel(i),
      rows:[{label:(CD.METRIC_BY_KEY[key]||{}).name||'',value:CD.fmtVal(key,v),color:col}]
        .concat(cmpRow(key,i,base,kpi))};
    s+='<g class="spg"'+tip(t)+'>';
    s+='<rect class="hit" x="'+num(i*gapw)+'" y="0" width="'+num(gapw)+'" height="'+num(h)+'"/>';
    s+='<line class="spgd" x1="'+num(cx)+'" y1="0" x2="'+num(cx)+'" y2="'+num(h)+'" stroke="'+col+'"'+NSS+'/>';
    s+=sDot(cx,cy,7,col,'spdot');
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
  const allWd=blocks.reduce((acc,b)=>acc.concat(b.days.filter(d=>!d.weekend&&d.val!=null).map(d=>d.val)),[]);
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
      /* поставка 66: на настоящих у нерабочего дня значения нет (null) — клетка как у выходного */
      const t=Math.max(0,Math.min(1,(d.val||0)/max)), nv=d.val==null;
      const fill=d.weekend?'#f4f5f7':mixRGB(CAL_LO,CAL_HI,t);
      /* на тёмной половине шкалы цифра белая, иначе её не прочесть */
      const ink=d.weekend?C_AXIS:(t>0.62?'#fff':C_LABEL);
      const dly=(bi*40)+di*9;
      s+='<g class="barg"'+tip({
        title:d.day+' '+CD.MONTH_GEN[b.m]+' '+b.y+', '+CD.DOW_NAME[d.dow].toLowerCase(),
        rows:nv?[]:[{label:'Посещаемость',value:num1(d.val)+'%',color:fill}],
        note:d.weekend?(nv&&d.dow<5?'нерабочий день':'выходной'):'посещаемость месяца: '+num1(b.base)+'%'})+'>';
      s+=rect(x,y,cw,ch,fill,7,' class="fade" style="animation-delay:'+dly+'ms"');
      if(showDay)s+=txt(x+6,y+13,String(d.day),{size:9.5,weight:400,fill:ink,anchor:'start',
        cls:'fade',delay:dly});
      /* halo здесь не нужен: цвет цифры уже выбран под заливку ячейки */
      if(showVal&&!nv)s+=txt(x+cw/2,y+(showDay?ch/2+9:ch/2+4),num1(d.val),
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
  s+=txt(x,sy+9,'чаще, до '+num1(max)+'%',{size:10.5,fill:C_AXIS,anchor:'start'});
  x+=textW('чаще, до '+num1(max)+'%',10.5)+16;
  s+=rect(x,sy,sw,sh,'#f4f5f7',2);x+=sw+6;
  s+=txt(x,sy+9,'выходной',{size:10.5,fill:C_AXIS,anchor:'start'});
  return svg(w,hUsed,s);
}

/* ============================================================================
   7. Мониторинг рабочей активности (21.10, файл Антона). Ось — периоды (недели или
      месяцы), а не янв.–дек.: это не «год к году», а последние недели мониторинга.
      stack — состав по категориям столбиками: снизу недоработка (её рост читается от
      нуля), дальше нормал, переработка и сверху «не размечено»; над столбиком — всего
      людей, разбивка — в подсказке. Клик по столбику отмечает период (data-pmark) на
      всех графиках вкладки, клик по легенде скрывает категорию.
      pline — линия по тем же периодам: отмеченный период — полосой и крупной точкой.
      Цвета категорий прошли валидатор палитры (светлота, насыщенность, различимость
      в т. ч. при дальтонизме); контраст с белым ниже 3:1 — значения в подсказке и в KPI.
   ========================================================================== */
const C_MON={under:'#E8A33D',normal:'#7FA2E6',over:'#C2513F',grey:'#D3D5DA',
  /* второй тон разбивки в KPI-карточках: «дольше 2 недель», «больше 50%», «больше 5 дней» */
  under2:'#A86B12',over2:'#7F2A1D',talk0:'#C3D3F5',talk:'#245FD4',talk2:'#1545A3',per:'#9AA0AC',per2:'#5B616D'};
const MON_CATS=[['under','Недоработка'],['normal','Нормал'],['over','Переработка'],['grey','Не размечено']];
function perAxis(P,X,h,mark,bandW){
  const step=bandW<30?3:bandW<44?2:1, last=P.length-1;
  return P.map((p,i)=>i===mark||(last-i)%step===0?txt(X(i),h-8,p.label,i===mark?{size:10.5,weight:700,fill:C_LABEL}:{size:10.5,fill:C_AXIS}):'').join('');
}
function drawStack(a,w,h){
  /* 26.10-б: найм по видам ушёл в подсказку «Найм, чел» — категории снова только мониторинга */
  /* a.cats (27.10-в, T-рост) — свои категории [ключ, имя, цвет]; без них — категории мониторинга */
  const o=a.opt||{}, P=a.periods, off=offOf(o), mark=a.mark, CATS=a.cats||MON_CATS, COL=a.cats?{}:C_MON;
  if(a.cats)a.cats.forEach(c=>{COL[c[0]]=c[2]});
  const cats=CATS.filter(c=>!off.has(c[0]));
  /* узкая панель: легенда не влезает рядом с заголовком — встаёт второй строкой (header / headH), график выше на строку */
  const two=wraps(w,o.title,o.legend), hh=headH(o.title,o.legend,w);
  h=(h||o.h||260)+(two?22:0);
  const x0=PAD_X, plotW=w-PAD_X*2, bandW=plotW/P.length, X=i=>x0+bandW*(i+0.5);
  const tot=P.map(p=>cats.reduce((v,c)=>v+(p[c[0]]||0),0));
  const max=niceMax(tot), top=hh+LBL_ROOM, bot=h-AXIS_H+6, Y=v=>bot-v/max*(bot-top);
  const bw=Math.max(8,Math.min(42,bandW*0.6));
  let s=header(w,o.title,o.legend,{kind:'stack',off:o.off});
  P.forEach((p,i)=>{
    const cx=X(i), on=mark===i, dly=i*28;
    const live=cats.filter(c=>(p[c[0]]||0)>0);
    let acc=0, segs='';
    live.forEach((c,ci)=>{
      const v=p[c[0]], y1=Y(acc+v), y0=Y(acc), lastSeg=ci===live.length-1;
      /* 2px просвет между кусками — цвета соседей не сливаются */
      const yt=y1+(lastSeg?0:1), yb=y0-(ci?1:0);
      const ex=' class="bar up"'+sAttr(c[0])+' style="animation-delay:'+dly+'ms"';
      segs+=lastSeg?barUp(cx-bw/2,yt,bw,yb-yt,COL[c[0]],ex):rect(cx-bw/2,yt,bw,Math.max(0,yb-yt),COL[c[0]],0,ex);
      acc+=v;
    });
    const t=tot[i];
    const all=p.hc||tot[i];
    s+='<g class="barg pmk'+(on?' on':'')+'" data-pmark="'+i+'"'+tip({title:p.full,
      rows:CATS.map(c=>({label:c[1],value:CD.fmtInt(p[c[0]]||0)+' · '+(all?Math.round((p[c[0]]||0)/all*100):0)+'%',color:off.has(c[0])?C_OFF:COL[c[0]]})),
      note:a.cats?'Всего — '+CD.fmtInt(all)+(a.unit||'')+'.':(on?'Период отмечен на линиях. Клик — снять отметку. ':'Клик — отметить период на линиях. ')+'Всего — '+CD.fmtInt(all)+' чел.'})+'>'+
      (on?rect(cx-bandW/2+1,hh+2,bandW-2,bot-hh-2,C_LINK,4):'')+
      '<rect class="hit" x="'+num(cx-bandW/2)+'" y="'+num(hh)+'" width="'+num(bandW)+'" height="'+num(bot-hh)+'"/>'+segs+'</g>';
    if(t)s+=txt(cx,Y(t)-VAL_DY,CD.fmtInt(t),valOpt({delay:200+dly}));
  });
  s+=line(x0,bot,x0+plotW,bot,C_ZERO,1)+perAxis(P,X,h,mark,bandW);
  return svg(w,h,s);
}
function drawPline(a,w,h){
  const o=a.opt||{}, P=a.periods, key=a.key, mark=a.mark, col=o.color||C_LINE;
  const fmt=v=>v==null?'—':o.fmt==='int'?CD.fmtInt(v):o.fmt==='pct'?(Math.round(v*10)/10).toFixed(1).replace('.',',')+'%':(Math.round(v*10)/10).toFixed(1).replace('.',',');
  const vals=P.map(p=>p[key]);
  const hh=headH(o.title,null);
  h=h||o.h||200;
  const x0=PAD_X, plotW=w-PAD_X*2, bandW=plotW/P.length, X=i=>x0+bandW*(i+0.5);
  const max=niceMax(vals), top=hh+LBL_ROOM, bot=h-AXIS_H+6, Y=v=>bot-v/max*(bot-top);
  let s=header(w,o.title,null,{});
  if(mark!=null&&P[mark])s+=rect(X(mark)-bandW/2+1,hh+2,bandW-2,bot-hh-2,C_LINK,4);
  s+=line(x0,bot,x0+plotW,bot,C_ZERO,1);
  s+='<path class="ln" d="'+polyD(vals,X,Y)+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  const step=bandW<30?3:bandW<44?2:1, last=P.length-1;
  let lbl='';
  vals.forEach((v,i)=>{
    const on=i===mark;
    s+='<g class="ptg pmk" data-pmark="'+i+'"'+tip({title:P[i].full,rows:[{label:o.name||'',value:fmt(v),color:col}],
      note:on?'Период отмечен. Клик — снять отметку.':'Клик — отметить период на всех графиках.'})+'>'+
      '<rect class="hit" x="'+num(X(i)-bandW/2)+'" y="'+num(hh)+'" width="'+num(bandW)+'" height="'+num(bot-hh)+'"/>'+
      (v==null?'':'<circle cx="'+num(X(i))+'" cy="'+num(Y(v))+'" r="'+(on?4.5:2.6)+'" fill="'+(on?col:'#fff')+'" stroke="'+col+'" stroke-width="2"/>')+'</g>';
    if(v!=null&&(on||(last-i)%step===0))lbl+=txt(X(i),Y(v)-VAL_DY,fmt(v),valOpt({delay:300+i*20}));
  });
  return svg(w,h,s+lbl+perAxis(P,X,h,mark,bandW));
}

const KINDS={yoy:drawYoy,pair:drawPair,panels:drawPanels,
             waterfall:drawWaterfall,calendar:drawCalendar,stack:drawStack,pline:drawPline};
const NOMINAL_W=900, NOMINAL_H=null;
let _specs=new Map(), _sid=0;
/* Какие серии выключены. Живёт ОТДЕЛЬНО от _specs и НЕ чистится в reset():
   по решению заказчика выключение помнится в пределах сессии — переживает
   смену вкладки и сбрасывается только перезагрузкой страницы.
   Ключ — kind|title|cid: один cid ненадёжен (счётчик обнуляется каждый рендер),
   один заголовок — тоже (заголовков может не быть). */
const _off=new Map();

const CH_H=280, CH_MAIN=360;
function build(spec,w,h){return KINDS[spec.kind](spec.args,Math.max(320,w),h||null)}

function chart(kind,args,opt){
  opt=Object.assign({},opt||{});
  const id='k'+(++_sid);
  opt._key=kind+'|'+(opt.title||'')+'|'+id;
  /* 31.10, п. 6: opt.offDef — серии, выключенные по умолчанию (линия базы «Вся компания»): в легенде перечёркнута,
     клик включает; выбор помнится в сессии, как любое выключение */
  opt.off=_off.get(opt._key)||new Set(opt.offDef||[]);
  const spec={kind,args:Object.assign({},args,{opt}),opt};
  _specs.set(id,spec);
  /* opt.cls — модификатор контейнера */
  /* поставка 97 (заказчик: «пользователь воспринимает каждый график отдельно — высоты должны быть одни»): две высоты на
     весь отчёт — CH_H у каждого графика, в том числе у каждой панели группы, и CH_MAIN у единственного главного графика
     вкладки (opt.main, водопад); растягивания под свободное место нет. Календарь посещений — своей сеткой дней */
  if(kind!=='calendar'){opt.fill=false;opt.h=kind==='panels'?CH_H*args.panels.length:opt.main?CH_MAIN:CH_H}
  const mh=kind==='panels'?panelsMin(args.panels):0;
  return '<div class="svgchart'+(opt.fill?' fill':'')+(opt.cls?' '+opt.cls:'')+'" data-cid="'+id+'"'+
    (mh?' style="min-height:'+mh+'px'+(kind==='panels'?';--np:'+args.panels.length:'')+'"':'')+'>'+(_lazy?'':build(spec,NOMINAL_W,NOMINAL_H))+'</div>';
}
/* 31.10 (поставка 82): экран приложения сразу перемеряет графики под настоящую ширину — черновое полотно 900px
   строилось и разбиралось браузером зря (треть времени клика). На время сборки экрана app.js включает «ленивый»
   режим: контейнер пустой, полотно рисует remeasure(). Вне него (проверки в node, другие вызовы) — как раньше */
let _lazy=false;
function lazy(on){_lazy=!!on&&typeof HTMLElement!=='undefined'}

/* animate=true — только на первую отрисовку после рендера. На resize анимацию
   не проигрываем: дёргающиеся при каждом ресайзе графики раздражают. */
function remeasure(root,animate){
  if(!root||!root.querySelectorAll)return;
  /* 31.10 (поставка 82, «подлагивает»): сначала меряем все полотна, потом пишем — чтение размера после
     записи innerHTML заставляло браузер пересчитывать раскладку на каждом графике (до трети времени клика) */
  /* Два прохода: сначала графики своей высоты, потом «заполняющие» — их высота зависит от соседей */
  const nodes=root.querySelectorAll('.svgchart[data-cid]');
  [false,true].forEach(fill=>{
    const job=[];
    for(let i=0;i<nodes.length;i++){
      const el=nodes[i], sp=_specs.get(el.getAttribute('data-cid'));
      if(!sp||!!sp.opt.fill!==fill)continue;
      const w=el.clientWidth||(el.parentNode&&el.parentNode.clientWidth)||NOMINAL_W;
      job.push([el,sp,w,fill?(el.clientHeight||sp.opt.h||null):(sp.opt.h||null)]);
    }
    /* анимация висит на детях полотна, а они только что созданы заново — перезапуск без лишнего пересчёта раскладки */
    job.forEach(j=>{j[0].innerHTML=build(j[1],j[2],j[3]);if(animate)j[0].classList.add('anim')});
  });
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
  /* у пары две группы: потоки (a, b) и годы (cur, prev) — в каждой хоть одна
     серия остаётся: без потока или без года рисовать нечего */
  const grp=sp.kind==='pair'?(sid==='a'||sid==='b'?['a','b']:['cur','prev']):ids;
  if(off.has(sid))off.delete(sid);
  /* последнюю серию выключить нельзя: пустой график — не состояние данных */
  else if(grp.filter(x=>!off.has(x)).length<=1)return false;
  else off.add(sid);
  _off.set(sp.opt._key,off);
  redraw(cid,null);
  return true;
}

/* _off сознательно НЕ чистим — см. комментарий у его объявления */
function reset(){_specs=new Map();_sid=0;_hid=0}

window.TPDRAW={C_HEAT_RGB,HEAT_MAX,chart,lazy,miniYoy,remeasure,redraw,highlight,toggleSeries,reset,seriesOf,SERIES,LOCKED,
  sparkLine,niceMax,textW,esc,stateColor,tipHtml,heat,heatInk,soft,asBars,ghostCol,
  FONT,PALETTE,C_LINE,C_BENCH,C_PREV,C_GREEN,C_RED,C_IN,C_OUT,C_LABEL,C_AXIS,C_DIV,C_TOTAL,
  C_HIRE,C_HIRE_D,C_HIRE_I,C_FIRE,C_TR_IN,C_TR_OUT,C_CNT,C_OTHER,C_FLAT,C_ROST,
  C_VAC,C_UNDER,C_REVIEW,C_OFFICE,C_REGRET,C_NOREG,C_TURN_Y,C_AI,C_MON,MON_CATS};
})();

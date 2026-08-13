/* ============================================================================
   ui.js — общие UI-примитивы TeamPulse Hub. Неймспейс: window.TPUI.
   Загружается после data.js и draw.js, до screens/* и app.js.

   Здесь живёт вся разметка, которую переиспользуют экраны: карточки KPI,
   чипы дельт, ячейка сравнения с базой, плашка инсайта, под-вкладки и —
   главное — barTable(): разбивка настоящей HTML-таблицей с полосой внутри
   ячейки. Не график в виде таблицы, а таблица.

   Правило разбивки по файлам: экран НЕ пишет разметку сам. Ни SVG-строк,
   ни <table>. Всё через TPUI и TPDRAW — тогда общим элементам физически
   негде разойтись между экранами.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW;

function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

/* Русское склонение по числу: «1 специализация», «2 специализации»,
   «5 специализаций». Отдельной функцией, потому что подписей вида «N чего-то»
   в отчёте будет больше одной, а «3 специализации» руками пишется правильно
   ровно до первого стрима с одной или с пятью. */
function plural(n,forms){
  const a=Math.abs(n)%100, b=a%10;
  return forms[a>4&&a<21?2:b===1?0:b>1&&b<5?1:2];
}

/* ============================================================================
   Кастомный тултип — ЕДИНСТВЕННЫЙ тултип в отчёте.

   Стандартный HTML-title запрещён: он появляется через секунду, выглядит
   системным и не умеет в вёрстку. Любой элемент — и в SVG, и в разметке —
   объявляет подсказку через data-tip. Содержимое собирает единый
   конструктор TPDRAW.tipHtml: {title, text, rows, note}. Руками теги не клеим.

   Обработчик один и висит на document, поэтому графики можно перерисовывать
   сколько угодно: подписываться заново не нужно.
   ========================================================================== */
let _tipEl=null, _tipFor=null;
function tipNode(){
  if(!_tipEl){
    _tipEl=document.createElement('div');
    _tipEl.className='tip';_tipEl.setAttribute('role','tooltip');
    document.body.appendChild(_tipEl);
  }
  return _tipEl;
}
function placeTip(el,x,y){
  const w=el.offsetWidth||220, h=el.offsetHeight||60;
  let left=x+16, top=y-h-14;
  if(left+w>window.innerWidth-10)left=x-w-16;
  if(left<10)left=10;
  if(top<10)top=y+20;
  el.style.left=Math.round(left)+'px';el.style.top=Math.round(top)+'px';
}
function showTip(target,x,y){
  const el=tipNode();
  if(_tipFor!==target){_tipFor=target;el.innerHTML=target.getAttribute('data-tip')||''}
  el.classList.add('on');
  placeTip(el,x,y);
}
function hideTip(){if(_tipEl){_tipEl.classList.remove('on')}_tipFor=null}
function tipTarget(e){
  const t=e.target;
  return t&&t.closest?t.closest('[data-tip]'):null;
}
function bindTips(){
  if(!document.addEventListener)return;
  document.addEventListener('mousemove',e=>{
    const t=tipTarget(e);
    if(t)showTip(t,e.clientX,e.clientY);else if(_tipFor)hideTip();
  },{passive:true});
  document.addEventListener('mouseleave',hideTip,true);
  document.addEventListener('click',hideTip,true);
  window.addEventListener('scroll',hideTip,true);
}
bindTips();

/* Готовит атрибут подсказки. Экраны и ui зовут только его — руками data-tip
   нигде не пишем, иначе экранирование разъедется.
   Разметку собирает G.tipHtml — один конструктор на SVG и на HTML,
   и он же экранирует входы: снаружи esc() вызывать НЕ надо. */
function tipAttr(o){return ' data-tip="'+esc(G.tipHtml(o))+'"'}
const tip=tipAttr;                       /* короткий алиас для экранов */

/* ---------- Чип изменения: направление + окраска по смыслу метрики ---------- */
/* Направление изменения — знаком, а не стрелкой.
   Стрелка и цвет кодировали один и тот же факт двумя способами, и их приходилось
   сверять между собой: ↓ у текучести это хорошо, ↓ у найма — ни хорошо, ни плохо.
   Теперь знак говорит «в какую сторону», цвет — «хорошо это или плохо», и оба
   читаются с одного взгляда. Нет изменения — просто ноль, без значка.

   o.vs — с чем сравнивается («к маю»). Подпись живёт ВНУТРИ пилюли: «+3» без
   неё читалось как отклонение от базы, а не как изменение за месяц, и понять
   это можно было только зная, как устроен отчёт. В колонках таблицы, где месяц
   уже подписан в шапке, vs не передаётся — там он был бы повторён у каждой
   строки. o.tip — подсказка с полной формулировкой («июнь 2026 против мая 2026»). */
function deltaChip(key,dv,o){
  const m=D.METRIC_BY_KEY[key];
  const vs=o&&o.vs?'<span class="d-vs">'+esc(o.vs)+'</span>':'';
  const at=o&&o.tip?tipAttr(o.tip):'';
  if(dv===0)return '<span class="delta flat"'+at+'>0'+vs+'</span>';
  /* типографский минус подставляет сам fmtDelta — здесь его больше не чиним:
     пока чинили тут, пилюля «К базе» в сводной таблице оставалась с дефисом */
  const txt=D.fmtDelta(key,dv);
  if(m.better==='flat')return '<span class="delta neu"'+at+'>'+txt+vs+'</span>';
  const good=m.better==='lower'?dv<0:dv>0;
  return '<span class="delta '+(good?'up':'down')+'"'+at+'>'+txt+vs+'</span>';
}
/* Пилюля изменения за месяц с подписью месяца — ровно то, что стоит в карточках
   KPI на всех экранах. Отдельная функция, чтобы подпись и подсказка не
   разъезжались между one-pager и детальными вкладками. */
function momChip(key,dv){return deltaChip(key,dv,{vs:D.CMP.momShort,tip:D.CMP.momTip})}

/* Иконка перехода на внешний дашборд. Символ ↗ брался из шрифта и в разных
   начертаниях получался то мелким, то съехавшим по базовой линии. */
function icoExt(){
  return '<svg class="ico-ext" viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" '+
    'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+
    '<path d="M8.4 2.4h3.2v3.2"/><path d="M11.6 2.4 6.9 7.1"/>'+
    '<path d="M9.7 8.3v2.2a1.1 1.1 0 0 1-1.1 1.1H3.5a1.1 1.1 0 0 1-1.1-1.1V5.4a1.1 1.1 0 0 1 1.1-1.1h2.2"/></svg>';
}

/* ---------- Каретка раскрытия строки ----------
   Строка сводной таблицы one-pager раскрывает график метрики, но узнать об
   этом можно было только случайным кликом: ни значка, ни курсора-указателя
   в конце строки не было. Каретка стоит последней колонкой — там, где взгляд
   заканчивает читать строку, — и разворачивается вниз, когда график открыт.
   Отдельной кнопкой её не делаем: кликается вся строка, и вторая точка входа
   в то же действие только сбивала бы с толку. */
function rowCaret(open){
  return '<span class="row-caret'+(open?' on':'')+'"'+
    tipAttr({title:open?'Свернуть график':'Показать динамику',
      text:'Клик по строке раскрывает график метрики за 12 месяцев прямо в таблице.'})+
    ' aria-hidden="true">'+(open?'▾':'▸')+'</span>';
}

/* ---------- Общая каретка «раскрыть / свернуть всё» ----------
   ПРАВИЛО ОТЧЁТА: если в таблице есть каретки в строках, у неё ОБЯЗАНА быть
   общая. Раскрывать десять строк по одной, чтобы увидеть, что внутри, — работа,
   которую одна кнопка делает за один клик. Пока раскрыто не всё, кнопка
   предлагает раскрыть; сворачивать — только когда раскрыто всё.

   Одна функция на все такие таблицы: сводную по подразделениям, двухуровневые
   разбивки состава и метрики one-pager. Разойтись по виду и поведению им теперь
   негде — а до этого каждая таблица заводила свою кнопку или не заводила вовсе. */
function allCaret(attr,val,open,tipText){
  return '<button class="caret-btn"'+(open?' data-open="1"':'')+
    ' '+attr+'="'+esc(val)+'" aria-label="'+(open?'Свернуть всё':'Развернуть всё')+'"'+
    tipAttr({title:open?'Свернуть всё':'Развернуть всё',text:tipText})+
    '>'+(open?'▾':'▸')+'</button>';
}

/* ---------- Значок справки ----------
   Один значок на весь отчёт. Раньше их было два: «?» в OnePager с тултипом по
   наведению и квадратная «i» в блоках, открывавшая попап по клику. Два разных
   значка для одного и того же смысла заставляли гадать, что откроется, а клик
   ради одной строки описания — лишнее действие. Теперь везде круглая «i»,
   раскрывается наведением через общий тултип. Начертание — шрифт интерфейса
   (Georgia в прежней кнопке выбивалась из набора). */
function infoDot(key){
  const m=D.METRIC_BY_KEY[key];if(!m)return'';
  const dir=m.better==='lower'?'снижение':m.better==='higher'?'рост':'нейтральная метрика';
  return '<span class="info"'+tipAttr({title:m.name,
    text:m.hint||'Описание метрики пока не задано.',
    note:'Единица: '+(m.unit||'—')+'. Позитивное направление: '+dir+'.'})+' aria-label="О метрике">i</span>';
}

const NOCMP_HINT='Абсолютная величина зависит от размера подразделения: сравнение с базой здесь ничего не значит.';
function noCmpMark(){return '<span class="nocmp"'+tipAttr({title:'Сравнение отключено',text:NOCMP_HINT})+'>не сравнивается</span>'}

/* ---------- Ячейка «сравнение с базой» / «против KPI» ----------
   Порядок проверок не косметика: **есть утверждённый KPI — сравниваем с ним,
   и только с ним**. Средняя по базе рядом с целью KPI заставляла выбирать,
   по какому из двух чисел судить, хотя ответ один: цель важнее средней. */
function targetCell(key,val,baseVal,kpi){
  if(kpi){
    const st=D.stateForKpi(key,val,kpi), m=D.METRIC_BY_KEY[key];
    const badTxt=m.better==='lower'?'выше порога':'ниже порога';
    return '<div class="tgt"><span class="kpi-tag">KPI</span> <b>цель '+D.fmtVal(key,kpi.green)+'</b>'+
      '<span class="sig-chip '+st+'">'+(st==='good'?'в цели':st==='warn'?'зона риска':badTxt)+'</span></div>';
  }
  if(!D.comparable(key))return '<div class="tgt">'+noCmpMark()+'</div>';
  if(baseVal==null)return '<div class="tgt">—</div>';
  const st=D.compareState(key,val,baseVal), diff=val-baseVal, m=D.METRIC_BY_KEY[key];
  const lbl=m.better==='flat'
    ? (Math.abs(diff)<0.05?'как база':(diff>0?'выше базы':'ниже базы'))
    : (st==='good'?'лучше базы':st==='bad'?'хуже базы':'на уровне');
  return '<div class="tgt"><b>'+D.fmtVal(key,baseVal)+'</b><span class="sig-chip '+st+'">'+lbl+'</span></div>';
}

/* ---------- Плашка предрасчитанного инсайта ----------
   lead приходит с разметкой (<b> вокруг цифр). В свёрнутом виде его нельзя
   просто экранировать — тогда в строке видны сами теги. Снимаем теги,
   оставляя текст; в раскрытом виде разметка работает как задумано. */
function aiBlock(id,title,lead,bullets,open,cls){
  const plain=String(lead).replace(/<[^>]+>/g,'');
  return '<div class="ai'+(cls?' '+cls:'')+'"><div class="ai-h" data-ai="'+id+'">'+
    aiIco(open)+'<span class="ai-t">'+esc(title)+'</span>'+
    '<span class="ai-lead">'+(open?'':esc(plain))+'</span>'+
    '<span class="ai-tag">'+(open?'свернуть':'подробнее')+'</span>'+
    '<span class="ai-caret">'+(open?'▲':'▼')+'</span></div>'+
    (open?'<div class="ai-b">'+lead+'<ul>'+bullets.map(b=>'<li>'+b+'</li>').join('')+'</ul></div>':'')+'</div>';
}

/* ---------- Значок AI-плашки ----------
   Раньше здесь был квадратик с буквами AI. Теперь — фиолетовый огонёк с
   повязкой AI: подсказки по всему отчёту подаёт один и тот же персонаж,
   а не аббревиатура.

   Размер зависит от состояния плашки. Свёрнутая — 36 px, и огонёк телом
   выходит за верхнюю границу: внутри строки больше места нет, а на 22 px
   персонажа просто не было видно. Раскрытая — 54 px: место появилось,
   и подробный разбор подаёт уже полноценный персонаж.

   Если mascot.js по какой-то причине не подключён, возвращаемся к текстовому
   варианту: плашка не должна разваливаться. */
function aiIco(big){
  const M=window.TPMASCOT;
  const im=M?M.img('ai',big?54:36,{alt:'AI-подсказка Пульса'}):'';
  return im?'<span class="ai-ico pic'+(big?' big':'')+'">'+im+'</span>'
           :'<span class="ai-ico">AI</span>';
}

/* ---------- Карточка KPI ----------
   Четыре строки РОВНО ВСЕГДА: заголовок, значение, первый ряд, второй ряд.
   Пустой второй ряд рисуется тоже — иначе карточки в одной полосе состоят из
   разного числа строк, и выровнять их по строкам нечем.

   Выравнивание держит CSS: полоса .kpis — grid, карточка — subgrid на четыре
   строки родителя. Поэтому длинный заголовок, переносящийся на две строки
   («Прирост с начала года» в узкой колонке), добавляет вторую строку ВСЕМ
   заголовкам полосы, и значения, дельты и подписи базы остаются на одном
   уровне. До этого перенос в одной карточке сдвигал её цифры вниз, и полоса
   KPI переставала читаться как строка. Лишняя строка воздуха — приемлемая
   цена; съехавшие цифры — нет. */
function kpiCard(o){
  return '<div class="kpi"><div class="k-label">'+esc(o.label)+(o.q||'')+'</div>'+
    '<div class="k-val">'+o.value+'</div>'+
    '<div class="k-row">'+(o.row1||'')+'</div>'+
    '<div class="k-row">'+(o.row2||'')+'</div></div>';
}

/* ============================================================================
   barTable — разбивка таблицей. Именно таблица, а не горизонтальный бар-чарт.

   Колонки: название · значение · доля · полоса.
   Полоса живёт ВНУТРИ ячейки и растёт от левого края — так строки читаются
   сверху вниз как список, а длины сравниваются по общему левому старту.
   Масштаб полосы — от нуля до максимума по столбцу, как и везде в отчёте.

   o.items    — [{name, value, note, color, mark, node, pick, on}]
   o.metricKey— чем форматировать значение
   o.head     — заголовок первой колонки
   o.sort     — сортировать по убыванию значения
   o.total    — дописать строку ИТОГО
   o.compact  — плотный вариант для нескольких таблиц на одном экране

   Строка кликается двумя способами: `node` уводит в подразделение, `pick` берёт
   срез состава («покажи только Senior»). Оба дают строке класс `.urow`, поэтому
   курсор, ховер и выделение у них те же, что у сводной таблицы слева, — новых
   правил взаимодействия в отчёте не заводится.
   ========================================================================== */
function barTable(o){
  let items=o.items.slice();
  if(o.sort)items.sort((a,b)=>b.value-a.value);
  const key=o.metricKey||'hc_total';
  /* Итог и масштаб полосы считаются по ВЕРХНЕМУ уровню: дочерние строки уже
     учтены в родительской, и складывать их второй раз — удвоить ИТОГО. */
  const topItems=items.filter(x=>x.depth!==2);
  const sum=topItems.reduce((a,x)=>a+x.value,0);
  const max=G.niceMax(topItems.map(x=>x.value));

  /* share:false — для процентных метрик: доля одного процента в сумме процентов
     ничего не значит, а колонка «Доля» делает вид, что значит. */
  const withShare=o.share!==false;
  let h='<table class="ptable btable'+(o.compact?' dense':'')+'">'+
    '<colgroup><col style="width:'+(o.compact?'40%':'34%')+'"><col style="width:14%">'+
    (withShare?'<col style="width:11%">':'')+'<col></colgroup>'+
    '<thead><tr><th class="txt">'+esc(o.head||'Категория')+'</th>'+
    '<th>'+esc(o.valueHead||'Значение')+'</th>'+(withShare?'<th>Доля</th>':'')+
    '<th class="txt bar-th">'+esc(o.barHead||'Распределение')+'</th></tr></thead><tbody>';

  items.forEach(x=>{
    const share=sum?x.value/sum*100:0;
    /* клик по строке: либо переход в подразделение, либо срез по категории */
    const cls=[x.node||x.pick?'urow':'',x.on?'sel':'',x.depth===2?'lvl2':''].filter(Boolean).join(' ');
    const hook=(cls?' class="'+cls+'"':'')+
      (x.node?' data-node="'+esc(x.node)+'"':'')+
      (x.pick?' data-mix="'+esc(x.pick)+'"'+
        tipAttr({title:x.name,
          text:x.on?'Срез по этой категории уже взят. Клик снимает его.'
                   :'Клик берёт срез: численность в карточках и в таблице подразделений пересчитается по этой категории.'}):'');
    /* Двухуровневая разбивка: каретка раскрывает верхний уровень. Разметка та
       же, что в сводной таблице подразделений (`row-label` + `caret-btn`),
       чтобы раскрытие в отчёте выглядело и работало одинаково везде. */
    const caret=!o.tree?''
      :x.exp?'<button class="caret-btn"'+(x.open?' data-open="1"':'')+' data-btexp="'+esc(x.exp)+'"'+
        ' aria-label="'+(x.open?'Свернуть':'Раскрыть')+'"'+
        tipAttr({title:x.open?'Свернуть':'Раскрыть',text:'Специализации внутри стрима.'})+
        '>'+(x.open?'▾':'▸')+'</button>'
      :'<span class="caret-spacer"></span>';
    const nm='<span class="row-body">'+(x.mark?'<span class="rt-mark"'+tipAttr({title:'Нежелательный уход',text:'Причина, на которую компания могла повлиять.'})+'>★</span> ':'')+esc(x.name)+
      (x.note?'<span class="unit-sub">'+esc(x.note)+'</span>':'')+'</span>';
    h+='<tr'+hook+'>'+
      '<td class="txt">'+(o.tree?'<span class="row-label">'+caret+nm+'</span>':nm)+'</td>'+
      '<td class="lead">'+D.fmtVal(key,x.value)+'</td>'+
      (withShare?'<td>'+share.toFixed(share<10?1:0).replace('.',',')+'%</td>':'')+
      '<td class="barcell"'+tipAttr({title:x.name,
        rows:[{label:o.valueHead||'Значение',value:D.fmtVal(key,x.value),color:x.color||G.C_LINE}]
          .concat(withShare?[{label:'доля',value:share.toFixed(share<10?1:0).replace('.',',')+'%'}]:[]),
        note:x.tip||null})+
        '><span class="cellbar"><i style="width:'+(x.value/max*100).toFixed(1)+'%'+
        (x.color?';background:'+x.color:'')+'"></i></span></td></tr>';
  });

  if(o.total!==false){
    /* Общая каретка живёт в строке ИТОГО — там же, где в сводной таблице
       подразделений. Заодно «ИТОГО» встаёт на ту же вертикаль, что и названия
       строк над ним: без каретки оно было сдвинуто влево на её ширину. */
    const allBtn=o.expAll
      ? allCaret('data-btexpall',o.expAll.key+'|'+(o.expAll.open?'0':'1'),o.expAll.open,
          'Все вторые уровни разом.')
      : (o.tree?'<span class="caret-spacer"></span>':'');
    h+='<tr class="total"><td class="txt">'+
      (o.tree?'<span class="row-label">'+allBtn+'<span class="row-body">ИТОГО</span></span>':'ИТОГО')+
      '</td><td class="lead">'+D.fmtVal(key,sum)+'</td>'+
      (withShare?'<td>100%</td>':'')+'<td class="barcell"></td></tr>';
  }
  return h+'</tbody></table>';
}

/* ---------- Разбивка с подписью ----------
   Подпись разреза и сама таблица — один элемент: пока `.bt-group` собирался
   в экране, соседние экраны рисовали заголовок разбивки по-своему. Значок «i»
   тот же, что у метрик: у разрезов бывает что пояснить (грейд ≠ сеньорность),
   и объяснение должно жить там же, где название. */
function btGroup(o){
  return '<div class="bt-group"><div class="bt-cap">'+esc(o.cap)+
    (o.tip?'<span class="info"'+tipAttr(o.tip)+' aria-label="О разрезе">i</span>':'')+
    /* Уточнение среза стоит В ПОДПИСИ таблицы, а не только в общей плашке:
       иначе «ИТОГО 59» под заголовком «Грейд» читается как ошибка данных. */
    (o.capSub?'<span class="bt-sub">'+esc(o.capSub)+'</span>':'')+
    '</div>'+barTable(o)+'</div>';
}
function btStack(list){return '<div class="bt-stack">'+list.join('')+'</div>'}

/* ============================================================================
   matrixTable — состав в двух разрезах сразу: строки × колонки.

   Зачем вообще матрица. Одна разбивка отвечает «сколько у нас Senior», но
   вопрос руководителя обычно другой: «а по грейдам девушки и мальчики стоят
   одинаково?». Двумя таблицами подряд на него не ответить — их приходится
   сличать глазами. Матрица ставит оба разреза на одни оси, и ответ читается
   строкой и столбцом.

   Почему таблица, а не тепловая картинка. Правило разбивок в проекте одно:
   разбивка по атрибутам — настоящая `<table>` с числом в клетке. Заливка здесь
   не заменяет число, а помогает найти взглядом, где густо: сначала читается
   пятно, потом цифра.

   Шкала заливки — СИНЯЯ МОНОХРОМНАЯ, та же, что у календаря офиса, и это не
   светофор. Много людей в клетке — не «плохо» и не «хорошо», это просто много
   людей. Красить состав светофором значило бы выносить оценку там, где её нет.

   o.rowDim/o.colDim — разрезы из D.MIX_DIMS
   o.cells           — матрица людей [строка][колонка]
   o.mode            — 'abs' люди · 'row' % по строке · 'col' % по колонке
   o.sel             — Set взятых срезов (id вида 'grade:g2')
   ========================================================================== */
function pct(v){return v.toFixed(v<10&&v>0?1:0).replace('.',',')+'%'}
function mxPick(id,name,on,cls){
  return '<button class="mx-pick'+(on?' on':'')+(cls?' '+cls:'')+'" data-mix="'+esc(id)+'"'+
    tipAttr({title:name,text:on?'Срез по этой категории уже взят. Клик снимает его.'
                               :'Клик берёт срез по этой категории.'})+
    '>'+esc(name)+'</button>';
}
function matrixTable(o){
  const R=o.rowDim, C=o.colDim, cells=o.cells, mode=o.mode||'abs';
  const sel=o.sel||new Set();
  const rowSum=cells.map(r=>r.reduce((a,b)=>a+b,0));
  const colSum=C.cats.map((_,j)=>cells.reduce((a,r)=>a+r[j],0));
  const all=rowSum.reduce((a,b)=>a+b,0);
  const maxCell=Math.max(1,...cells.map(r=>Math.max(...r)));

  /* Интенсивность клетки: в режиме людей — от максимальной клетки, в режимах
     долей — сама доля. Иначе в «% по строке» клетка со 100% в маленькой строке
     красилась бы бледнее клетки с 40% в большой, хотя написано в ней больше. */
  const shade=(v,i,j)=>mode==='abs'?v/maxCell
    :mode==='row'?(rowSum[i]?v/rowSum[i]:0):(colSum[j]?v/colSum[j]:0);
  /* Проценты в строке (в колонке) обязаны давать 100: 37,5 и 62,5 округлённые
     по отдельности дают 38 и 63, и строка из двух клеток показывает 101%.
     Округляем группой, тем же методом наибольших остатков, что и людей. */
  const pctRow=cells.map((r,i)=>rowSum[i]?D.roundParts(r.map(v=>v/rowSum[i]*100),100):r.map(()=>0));
  const pctCol=C.cats.map((_,j)=>colSum[j]
    ?D.roundParts(cells.map(r=>r[j]/colSum[j]*100),100):cells.map(()=>0));
  const show=(v,i,j)=>mode==='abs'?D.fmtInt(v)
    :mode==='row'?(rowSum[i]?pctRow[i][j]+'%':'—')
                 :(colSum[j]?pctCol[j][i]+'%':'—');

  /* Какая часть среза до матрицы дошла, а какая нет. Без этой строки «ИТОГО 38»
     под карточкой на 11 человек читается как ошибка: срез по оси матрицы её
     собственную ось не режет, и сказать об этом надо там же, где стоят числа. */
  let h=(o.cap?'<div class="mx-cap">'+esc(o.cap)+'</div>':'')+
    '<div class="mx-wrap"><table class="ptable mxtable dense">'+
    '<thead><tr><th class="txt mx-corner"><span class="mx-r">'+esc(R.short||R.name)+'</span>'+
    '<span class="mx-c">'+esc(C.short||C.name)+' →</span></th>'+
    C.cats.map(c=>'<th class="mx-h">'+mxPick(c.id,c.name,sel.has(c.id))+'</th>').join('')+
    '<th class="mx-tot">Всего</th></tr></thead><tbody>';

  R.cats.forEach((rc,i)=>{
    h+='<tr'+(sel.has(rc.id)?' class="mx-on"':'')+'>'+
      '<td class="txt">'+mxPick(rc.id,rc.name,sel.has(rc.id),'row')+'</td>';
    C.cats.forEach((cc,j)=>{
      const v=cells[i][j], t=shade(v,i,j);
      h+='<td class="mx-cell'+(v?'':' zero')+'" data-mix="'+esc(rc.id+','+cc.id)+'"'+
        (v?' style="background:'+G.heat(t)+';color:'+G.heatInk(t)+'"':'')+
        tipAttr({title:rc.name+' · '+cc.name,
          rows:[{label:'людей',value:D.fmtVal('hc_total',v),color:G.heat(Math.max(0.35,t))},
                {label:'от строки',value:rowSum[i]?pct(v/rowSum[i]*100):'—'},
                {label:'от колонки',value:colSum[j]?pct(v/colSum[j]*100):'—'}],
          note:'Клик берёт срез сразу по двум атрибутам.'})+
        '>'+(v?show(v,i,j):'—')+'</td>';
    });
    h+='<td class="mx-tot">'+D.fmtInt(rowSum[i])+'</td></tr>';
  });

  /* Итоги колонок стоят ПОД своими клетками и по их выравниванию — по центру;
     общий итог живёт в колонке «Всего» и выровнен как она, по правому краю.
     Одно выравнивание на всю строку ставило бы число мимо своей колонки. */
  h+='<tr class="total"><td class="txt">ИТОГО</td>'+
    colSum.map(v=>'<td class="mx-sum">'+D.fmtInt(v)+'</td>').join('')+
    '<td class="mx-tot">'+D.fmtInt(all)+'</td></tr>';
  return h+'</tbody></table></div>';
}

/* ---------- Конструктор среза: две оси и содержимое клетки ----------
   Две оси, а не дерево группировок. Группированная таблица «пол → внутри
   грейды» отвечает на тот же вопрос, но читается вниз одной колонкой: чтобы
   сравнить грейды у женщин и у мужчин, взгляд прыгает через всю таблицу.
   На двух осях сравнение — это соседние клетки строки. Третья ось на борде
   не нужна: она уже про выгрузку, а не про «посмотреть». */
function mixPicker(o){
  const dims=o.dims, none='<option value=""'+(o.cols?'':' selected')+'>— без колонок</option>';
  const opts=(cur,skip)=>dims.filter(d=>d.key!==skip).map(d=>
    '<option value="'+d.key+'"'+(d.key===cur?' selected':'')+'>'+esc(d.name)+'</option>').join('');
  const modes=[['abs','Люди'],['row','% по строке'],['col','% по колонке']];
  return '<div class="mx-bar">'+
    '<div class="ctl"><label>Строки</label>'+
      '<select data-mixaxis="rows">'+opts(o.rows,o.cols)+'</select></div>'+
    '<button class="btn ghost mx-swap" data-mixswap="1"'+
      tipAttr({title:'Поменять оси местами',text:'Строки станут колонками, колонки — строками.'})+
      ' aria-label="Поменять оси местами">⇄</button>'+
    '<div class="ctl"><label>Колонки</label>'+
      '<select data-mixaxis="cols">'+none+opts(o.cols,o.rows)+'</select></div>'+
    (o.cols?'<div class="ctl"><label>В клетке</label><div class="opts tight">'+
      modes.map(m=>'<button class="opt'+(o.mode===m[0]?' on':'')+'" data-mixmode="'+m[0]+'">'+
        esc(m[1])+'</button>').join('')+'</div></div>':'')+
    '</div>';
}

/* ---------- Плашка взятого среза ----------
   Срез обязан быть виден там, где он меняет цифры, — рядом с карточками, а не
   только в таблице, по которой кликнули. Иначе «191 → 59» выглядит поломкой
   отчёта. Чип снимается кликом, как разрезы в шапке. */
function sliceNote(parts,extra){
  if(!parts.length)return'';
  return '<div class="note-inline slice">'+
    '<span class="sl-t">Срез состава:</span>'+
    parts.map(p=>'<span class="chip sl">'+esc(p.dim.short||p.dim.name)+': <b>'+esc(p.cat.name)+'</b>'+
      '<button class="x" data-mix="'+esc(p.id)+'"'+
      tipAttr({title:'Снять срез',text:p.dim.name+': '+p.cat.name})+'>×</button></span>').join('')+
    '<span class="sl-x">'+esc(extra||'')+'</span>'+
    '<button class="btn ghost xs" data-mixclear="1">Сбросить</button></div>';
}

/* ---------- Панель с шапкой ---------- */
function panel(o){
  const tabs=o.tabs||'';
  return '<div class="panel'+(o.cls?' '+o.cls:'')+'">'+
    (o.title?'<div class="panel-h'+(tabs?' with-tabs':'')+'"><div class="h-txt"><span>'+o.title+'</span>'+
      (o.sub?'<span class="sub">'+esc(o.sub)+'</span>':'')+'</div>'+tabs+'</div>':'')+
    '<div class="panel-b'+(o.bodyCls?' '+o.bodyCls:'')+'">'+o.body+'</div></div>';
}

/* ---------- Под-вкладки ---------- */
function subTabs(list,active){
  if(!list||list.length<2)return'';
  return '<div class="sub-tabs">'+list.map(t=>'<button class="sub-tab'+(active===t[0]?' active':'')+
    '" data-subtab="'+t[0]+'">'+esc(t[1])+'</button>').join('')+'</div>';
}

/* ---------- Пустое состояние ----------
   Пустой экран — единственное место, где маскоту есть что добавить к смыслу:
   спящий огонёк читается быстрее серой надписи и сразу говорит, что отчёт
   не сломался, а просто ничего не нашлось. */
function empty(title,text){
  const M=window.TPMASCOT;
  return '<div class="empty">'+(M?'<div class="empty-pic">'+M.img('nodata',96)+'</div>':'')+
    '<b>'+esc(title)+'</b>'+esc(text)+'</div>';
}

/* ---------- Легенда светофора ---------- */
function trafficLegend(){
  /* два цвета и серый: жёлтого в светофоре нет. «На уровне ±5%» и «без оценки»
     делят один серый — оба означают «повода вмешиваться нет». */
  return '<div class="legend"><span class="sw"><span class="dot" style="background:#bff2cd"></span>лучше базы</span>'+
    '<span class="sw"><span class="dot" style="background:#ffcccc"></span>хуже базы</span>'+
    '<span class="sw"><span class="dot" style="background:#f3f4f6"></span>на уровне ±5% или без оценки: '+
    'больше не значит лучше</span></div>';
}

window.TPUI={esc,plural,tipAttr,tip,deltaChip,momChip,icoExt,rowCaret,allCaret,noCmpMark,infoDot,NOCMP_HINT,targetCell,aiBlock,aiIco,kpiCard,
  barTable,btGroup,btStack,matrixTable,mixPicker,sliceNote,pct,panel,subTabs,empty,trafficLegend};
})();

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

   o.items    — [{name, value, note, color, mark}]
   o.metricKey— чем форматировать значение
   o.head     — заголовок первой колонки
   o.sort     — сортировать по убыванию значения
   o.total    — дописать строку ИТОГО
   o.compact  — плотный вариант для нескольких таблиц на одном экране
   ========================================================================== */
function barTable(o){
  let items=o.items.slice();
  if(o.sort)items.sort((a,b)=>b.value-a.value);
  const key=o.metricKey||'hc_total';
  const sum=items.reduce((a,x)=>a+x.value,0);
  const max=G.niceMax(items.map(x=>x.value));

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
    h+='<tr'+(x.node?' class="urow" data-node="'+esc(x.node)+'"':'')+'>'+
      '<td class="txt"><span class="row-body">'+(x.mark?'<span class="rt-mark"'+tipAttr({title:'Нежелательный уход',text:'Причина, на которую компания могла повлиять.'})+'>★</span> ':'')+esc(x.name)+
      (x.note?'<span class="unit-sub">'+esc(x.note)+'</span>':'')+'</span></td>'+
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
    h+='<tr class="total"><td class="txt">ИТОГО</td><td class="lead">'+D.fmtVal(key,sum)+'</td>'+
      (withShare?'<td>100%</td>':'')+'<td class="barcell"></td></tr>';
  }
  return h+'</tbody></table>';
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

window.TPUI={esc,tipAttr,tip,deltaChip,momChip,icoExt,rowCaret,noCmpMark,infoDot,NOCMP_HINT,targetCell,aiBlock,aiIco,kpiCard,
  barTable,panel,subTabs,empty,trafficLegend};
})();

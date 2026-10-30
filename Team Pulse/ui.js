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
  if(_tipFor!==target){_tipFor=target;el.innerHTML=target.getAttribute('data-tip')||target.getAttribute('data-ell')||''}
  el.classList.add('on');
  placeTip(el,x,y);
}
function hideTip(){if(_tipEl){_tipEl.classList.remove('on')}_tipFor=null}
/* Название в строке таблицы всегда в одну строку (16.10): не влезло — многоточие,
   а полный текст — та же подсказка, что везде, если своей у строки нет. */
const ELL='.ptable td.txt .row-body,.ptable td.txt .unit-sub,.mtable .m-sub';
function tipTarget(e){
  const t=e.target;
  if(!t||!t.closest)return null;
  const d=t.closest('[data-tip]');
  if(d)return d;
  const c=t.closest(ELL);
  if(c&&(c.scrollWidth>c.clientWidth+1||c.scrollHeight>c.clientHeight+1)){
    /* у названия — только оно само, без второй строки под ним */
    const txt=[...c.childNodes].filter(n=>!(n.classList&&n.classList.contains('unit-sub'))).map(n=>n.textContent).join('').trim();
    c.setAttribute('data-ell',G.tipHtml({title:txt}));
    return c;
  }
  return null;
}
function bindTips(){
  if(!document.addEventListener)return;
  /* В чарте Proteus скрипт перезапускается на каждый ответ датасета: слушатели
     регистрирует TP_ENV.on, и прошлый прогон их снимает (proteus/prelude.js) */
  const E=window.TP_ENV, on=(t,ty,fn,o)=>E?E.on(t,ty,fn,o):t.addEventListener(ty,fn,o);
  on(document,'mousemove',e=>{
    const t=tipTarget(e);
    if(t)showTip(t,e.clientX,e.clientY);else if(_tipFor)hideTip();
  },{passive:true});
  on(document,'mouseleave',hideTip,true);
  on(document,'click',hideTip,true);
  on(window,'scroll',hideTip,true);
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
  /* у отношения без знаменателя изменения нет — прочерк, а не «минус всё» */
  if(dv==null)return '<span class="delta flat"'+at+'>—'+vs+'</span>';
  if(dv===0)return '<span class="delta flat"'+at+'>0'+vs+'</span>';
  /* типографский минус подставляет сам fmtDelta — здесь его больше не чиним:
     пока чинили тут, пилюля «К базе» в сводной таблице оставалась с дефисом */
  const txt=D.fmtDelta(key,dv);
  /* поставка 90: изменения — только по закрытым месяцам и периодам, незакрытый месяц в пилюли не попадает */
  /* заглушку не оцениваем и цветом пилюли (ревью критиков 26.10) */
  if(m.better==='flat'||D.isStub(key))return '<span class="delta neu"'+at+'>'+txt+vs+'</span>';
  const good=m.better==='lower'?dv<0:dv>0;
  return '<span class="delta '+(good?'up':'down')+'"'+at+'>'+txt+vs+'</span>';
}
/* Пилюля изменения за месяц с подписью месяца — ровно то, что стоит в карточках
   KPI на всех экранах. Отдельная функция, чтобы подпись и подсказка не
   разъезжались между one-pager и детальными вкладками. */
/* Иконка перехода на внешний дашборд. Символ ↗ брался из шрифта и в разных
   начертаниях получался то мелким, то съехавшим по базовой линии. */
function icoExt(){
  return '<svg class="ico-ext" viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" '+
    'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+
    '<path d="M8.4 2.4h3.2v3.2"/><path d="M11.6 2.4 6.9 7.1"/>'+
    '<path d="M9.7 8.3v2.2a1.1 1.1 0 0 1-1.1 1.1H3.5a1.1 1.1 0 0 1-1.1-1.1V5.4a1.1 1.1 0 0 1 1.1-1.1h2.2"/></svg>';
}

/* ---------- «Открыть юнит» (итерация 29, механика HRBP HUB) ----------
   Сводная таблица показывает три уровня вниз; глубже — переходом в юнит:
   отчёт встаёт на выбранное подразделение, и под ним открываются следующие
   три уровня. Кнопка — иконка «вход» и только у ВЫБРАННОЙ строки: клик по
   строке выбирает её для правой панели и никуда не уводит, случайного
   перехода нет. Та же кнопка с подписью стоит в шапке правой панели. */
function icoOpen(){
  return '<svg class="ico-open" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" '+
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+
    '<path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/><path d="M9 16l4-4-4-4"/><path d="M13 12H3"/></svg>';
}
function openUnitBtn(path,name,label){
  return '<button class="open-unit'+(label?' with-label':'')+'" data-openunit="'+esc(path)+'" aria-label="Открыть «'+esc(name)+'»"'+
    tipAttr({title:'Открыть подразделение',
      text:'Весь отчёт перестроится на «'+name+'»: карточки, таблица и One-pager.\nБаза сравнения останется прежней.',
      note:'Вернуться — «← Назад» над отчётом.'})+'>'+icoOpen()+(label?esc(label):'')+'</button>';
}

/* 30.10, шаг 2 (заказчик: «подразделения должны отключаться прямо на блоке с подразделениями»): кнопка
   «свернуть» — в шапке таблицы; свёрнутая таблица — узкая полоска слева от графиков, клик раскрывает обратно */
function unitHide(){
  return '<button class="unit-hide" data-splitmode="charts" aria-label="Свернуть таблицу подразделений"'+
    tipAttr({title:'Свернуть таблицу',text:'Графики займут всю ширину. Вернуть — полоска «Подразделения» слева.'})+
    '><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
}
function unitRail(n){
  return '<button class="split-rail" data-splitmode="both" aria-label="Показать таблицу подразделений"'+
    tipAttr({title:'Подразделения',text:n?'Таблица подразделений: клик по строке — графики этого подразделения.'
      :'Подразделений уровнем ниже нет — в таблице только ИТОГО.'})+
    '><span class="sr-ch" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="sr-t">Подразделения'+(n?' · '+n:'')+'</span></button>';
}
/* Разделитель — настоящий separator: тянется мышью и пальцем, ← → двигают
   его с клавиатуры, двойной клик возвращает ширину по умолчанию. */
function splitGut(share){
  return '<div class="split-gut" data-split="1" role="separator" aria-orientation="vertical" '+
    'aria-label="Ширина таблицы подразделений" aria-valuemin="20" aria-valuemax="80"'+
    (share!=null?' aria-valuenow="'+Math.round(share*100)+'"':'')+' tabindex="0"'+
    tipAttr({title:'Ширина колонок',text:'Потяните, чтобы дать больше места таблице или графикам.',
      note:'Двойной клик — вернуть как было.'})+'><i></i></div>';
}

/* ---------- Поиск по таблице ----------
   Ищет среди показанного — трёх уровней вниз от юнита отчёта, без запроса.
   Находка выводится вместе с предками: «Группа поддержки» без родителя не
   говорит, чья она. Совпадение подсвечено, остальной текст строки — нет. */
function icoSearch(){
  return '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" '+
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
}
function searchBox(o){
  return '<label class="tsearch">'+icoSearch()+'<input type="search" data-tsearch="1" autocomplete="off" '+
    'placeholder="'+esc(o.placeholder)+'" aria-label="'+esc(o.placeholder)+'" value="'+esc(o.q||'')+'"></label>';
}
function hlText(text,q){
  const s=String(text==null?'':text), n=String(q||'').trim().toLowerCase();
  const at=n?s.toLowerCase().indexOf(n):-1;
  if(at<0)return esc(s);
  return esc(s.slice(0,at))+'<mark class="hl">'+esc(s.slice(at,at+n.length))+'</mark>'+esc(s.slice(at+n.length));
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
    tipAttr({title:open?'Свернуть':'Показать график',
      text:'График «этот год и прошлый» и что на нём видно.'})+
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
/* «Лучше, когда ниже» — словами, а не «позитивное направление: снижение» */
function betterWord(m){
  return m.better==='lower'?'Лучше, когда ниже.':m.better==='higher'?'Лучше, когда выше.':'Без оценки: больше — не значит лучше.';
}
/* что это и как считается (calc — по методологии HR из Data Detective): подсказка «i» и шапки
   таблиц показывают оба, подпись под названием метрики — только hint */
function metricText(m){return (m.hint||'')+(m.calc?'\n'+m.calc:'')+
  (D.VERIFIED.has(m.key)?'\nДанные сверены с мастер-источником: число в отчёте совпадает с ним.':'')+
  (D.MISMATCH.has(m.key)?'\nРасхождение с мастер-источником: число настоящее, но пока не совпадает с ним — ищем причину.':'')}
function infoDot(key){
  const m=D.METRIC_BY_KEY[key];if(!m)return'';
  return '<span class="info"'+tipAttr({title:m.name,text:metricText(m),note:betterWord(m)})+' aria-label="О метрике">i</span>';
}

const NOCMP_HINT='Это количество, а не доля: оно зависит от размера подразделения, поэтому с базой не сравнивается.';
function noCmpMark(){return '<span class="nocmp"'+tipAttr({title:'Без сравнения',text:NOCMP_HINT})+'>—</span>'} /* 30.10, шаг 1: прочерк вместо «не сравнивается» в каждой строке; почему — в подсказке */
/* Руководитель юнита под именем строки (14.10): «Имя Фамилия · логин».
   Нет данных (пробник без источника, строка «Напрямую в «X»») — ничего. */
/* 31.10 (поставки 82–83): в строке подразделения — численность и логин руководителя; без уровня и ФИ.
   Логина нет — в строке ничего, в подсказке «—». q — подсветка найденного */
function unitHead(n,q){
  const l=n&&n.head&&n.head.login;
  return l?'<span class="unit-head login">'+(q?hlText(l,q):esc(l))+'</span>':'';
}
/* подсказка по наведению на подразделение (поставка 83): численность, ФИ и логин руководителя; пустое — «—» */
function unitTip(name,hc,head){
  head=head||{};
  return tipAttr({title:name,rows:[{label:'Численность',value:hc==null||hc===''?'—':hc},
    {label:'Руководитель',value:head.name||'—'},{label:'Логин',value:head.login||'—'}]});
}
/* ---------- Ячейка «сравнение с базой» / «против KPI» ----------
   Порядок проверок не косметика: **есть утверждённый KPI — сравниваем с ним,
   и только с ним**. Средняя по базе рядом с целью KPI заставляла выбирать,
   по какому из двух чисел судить, хотя ответ один: цель важнее средней. */
function targetCell(key,val,baseVal,kpi){
  /* Значения нет (доля без знаменателя) — оценки нет: «ниже порога» про
     команду, у которой в окне не было ни одного найма, было бы неправдой. */
  if(val==null)return '<div class="tgt">'+(kpi?'<span class="kpi-tag">KPI</span> <b>цель '+D.fmtVal(key,kpi.green)+'</b>'
    :D.comparable(key)&&baseVal!=null?'<b>'+D.fmtVal(key,baseVal)+'</b>':'')+
    '<span class="sig-chip neutral">нет данных</span></div>';
  if(kpi){
    const st=D.stateForKpi(key,val,kpi), m=D.METRIC_BY_KEY[key];
    const badTxt=m.better==='lower'?'выше порога':'ниже порога';
    return '<div class="tgt"><span class="kpi-tag">KPI</span> <b>цель '+D.fmtVal(key,kpi.green)+'</b>'+
      /* 26.10, ревью критиков: без оценки (заглушка) — «без оценки», а не «ниже порога» при 157,6% от цели */
      '<span class="sig-chip '+st+'">'+(st==='good'?'в цели':st==='warn'?'зона риска':st==='bad'?badTxt:'без оценки')+'</span></div>';
  }
  if(!D.comparable(key))return '<div class="tgt">'+noCmpMark()+'</div>';
  if(baseVal==null)return '<div class="tgt">—</div>';
  const st=D.compareState(key,val,baseVal), diff=val-baseVal, m=D.METRIC_BY_KEY[key];
  const lbl=m.better==='flat'
    ? (Math.abs(diff)<0.05?'как база':(diff>0?'выше базы':'ниже базы'))
    : (st==='good'?'лучше базы':st==='bad'?'хуже базы':st==='warn'?'на уровне':'без оценки');
  return '<div class="tgt"><b>'+D.fmtVal(key,baseVal)+'</b><span class="sig-chip '+st+'">'+lbl+'</span></div>';
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
/* ---------- Раскрытая строка One-pager: график и «Что видно» ----------
   Механика HRBP HUB (13.10): слева полотно «год к году» с номерными
   отметками, справа — пункты «Что видно» с теми же номерами и «О метрике».
   Сверх HRBP пункт и график связаны наведением в обе стороны (app.js,
   data-mk / data-mi): навёл на пункт — на графике подсвечены его отметка и
   месяц; навёл на месяц графика — подсвечены пункты о нём.
   st = TPINSIGHTS.yoyStory(): html пунктов уже собран и экранирован там. */
function opStory(chart,st,about){
  let l='';
  if(st.stub)l='<p class="op-stp">Метрика в разработке: цифры условные, поэтому выводов нет.</p>';
  else if(st.items.length)l='<ol class="op-ins">'+st.items.map(it=>
    '<li'+(it.n?' data-mk="'+it.n+'"':'')+' data-mi="'+(it.mi||[]).join(',')+'">'+
    (it.n?'<i class="op-insn'+(it.s==='prev'?' prev':'')+'">'+it.n+'</i>':'<i class="op-insb"></i>')+
    '<span>'+it.html+'</span></li>').join('')+'</ol>';
  /* поставка 69: у маленькой команды пунктов может не быть — честная строка вместо пустого места */
  else l='<p class="op-stp">Заметных изменений за год нет.</p>';
  return '<div class="op-story" data-oplink="1"><div class="op-stc">'+chart+'</div><div class="op-sts">'+
    (l?'<div class="op-sth">Что видно</div>'+l:'')+
    '<div class="op-sta"><div class="op-sth">О метрике</div>'+about+'</div></div></div>';
}
/* ============================================================================
   barTable — разбивка таблицей. Именно таблица, а не горизонтальный бар-чарт.

   Колонки: название · значение · доля · полоса.
   Полоса живёт ВНУТРИ ячейки и растёт от левого края — так строки читаются
   сверху вниз как список, а длины сравниваются по общему левому старту.
   Масштаб полосы — от нуля до максимума по столбцу, как и везде в отчёте.

   o.items    — [{name, value, note, color, mark, node, pick, on}]
   o.metricKey— чем форматировать значение
   o.head     — заголовок первой колонки; пустой, если над таблицей уже стоит
                её название (иначе одно и то же написано дважды подряд)
   o.sort     — сортировать по убыванию значения
   o.total    — дописать строку ИТОГО
   o.compact  — плотный вариант для нескольких таблиц на одном экране

   Строка кликается двумя способами: `node` уводит в подразделение, `pick` берёт
   срез состава («покажи только Senior»). Оба дают строке класс `.urow`, поэтому
   курсор, ховер и выделение у них те же, что у сводной таблицы слева, — новых
   правил взаимодействия в отчёте не заводится.
   ========================================================================== */
/* 23.10, Антон: горизонтальная полоса — в шкале 0–100%, не от максимума выборки: у счётной величины — доля от
   итога (tot), у процентной метрики — сам процент; от максимума — только у величин без процента (срок в днях) */
function barW(key,v,tot,max){
  const m=D.METRIC_BY_KEY[key]||{};
  const w=m.fmt==='pct'?v:tot?v/tot*100:max?v/max*100:0;
  return Math.max(0,Math.min(100,w||0));
}
function barTable(o){
  /* 22.10: только строки, которые есть в данных — категория без людей (0 или нет значения) не
     выводится; выбранная в срезе остаётся, чтобы её можно было снять. o.keepZero — таблица, где
     ноль сам по себе ответ (например, «приход без брони — 0») */
  let items=o.items.filter(x=>o.keepZero||x.on||(x.value!=null&&x.value!==0&&x.value===x.value));
  if(o.sort)items.sort((a,b)=>b.value-a.value);
  /* o.top — длинный плоский список (стримы на верхних уровнях, 16.10): первые
     o.top и строка «Остальные»; кто в ней — в подсказке полосы. Одну лишнюю
     строку не сворачиваем, выбранное в срезе остаётся на виду. */
  if(o.top&&!o.tree&&items.length>o.top+1){
    const keep=items.slice(0,o.top).concat(items.slice(o.top).filter(x=>x.on));
    const rest=items.filter(x=>keep.indexOf(x)<0), shown=rest.slice().sort((a,b)=>b.value-a.value).slice(0,8);
    /* в остальных никого — строку «Остальные 0» не рисуем */
    /* 23.10, Антон: «Остальные» раскрываются, как стрим (o.restKey — ключ раскрытия, o.restOpen — раскрыта ли):
       под строкой — спрятанные значения вторым уровнем, по каждому — срез */
    const restRow={name:'Остальные',note:rest.length+' '+plural(rest.length,o.restWord||['значение','значения','значений']),
      value:rest.reduce((a,x)=>a+x.value,0),color:rest[0].color,
      /* 29.10, п. 4: в подсказке не список значений, а их число и «кликни» (раскрываются) */
      tip:o.restKey?(o.restOpen?'Клик — свернуть.':'Кликни, чтобы посмотреть остальные.'):
        rest.length+' '+plural(rest.length,o.restWord||['значение','значения','значений'])};
    if(o.restKey)Object.assign(restRow,{exp:o.restKey,open:!!o.restOpen,restRow:true});
    items=!rest.some(x=>x.value)?keep:keep.concat([restRow]).concat(o.restKey&&o.restOpen?
      rest.slice().sort((a,b)=>b.value-a.value).map(x=>Object.assign({},x,{depth:2})):[]);
  }
  const tree=o.tree||items.some(x=>x.restRow);
  const key=o.metricKey||'hc_total';
  /* Итог и масштаб полосы считаются по ВЕРХНЕМУ уровню: дочерние строки уже
     учтены в родительской, и складывать их второй раз — удвоить ИТОГО. */
  const topItems=items.filter(x=>x.depth!==2);
  const sum=topItems.reduce((a,x)=>a+x.value,0);
  const max=G.niceMax(topItems.map(x=>x.value));

  /* share:false — для процентных метрик: доля одного процента в сумме процентов
     ничего не значит, а колонка «Доля» делает вид, что значит. */
  const withShare=o.share!==false;
  /* lite (14.10, структура): без шапки колонок и без ИТОГО — число и доля
     понятны сами («53 · 28%»), а итог уже стоит в карточке над таблицей;
     строки ниже, цифры без жирного. «Одно и то же десять раз» — фидбэк. */
  const lite=!!o.lite;
  let h='<table class="ptable btable'+(o.compact?' dense':'')+(lite?' lite':'')+'">'+
    '<colgroup><col style="width:'+(lite?'34%':o.compact?'40%':'34%')+'"><col style="width:'+(lite?'9%':'14%')+'">'+
    (withShare?'<col style="width:'+(lite?'9%':'11%')+'">':'')+'<col></colgroup>'+
    (lite&&!o.heads?'':'<thead><tr><th class="txt">'+esc(o.head||'')+'</th>'+
    '<th>'+esc(o.valueHead||'Значение')+'</th>'+(withShare?'<th>Доля</th>':'')+
    '<th class="txt bar-th">'+esc(o.barHead||'Распределение')+'</th></tr></thead>')+'<tbody>';

  /* ИТОГО ПЕРВОЙ СТРОКОЙ — так же, как в сводной таблице подразделений.
     Пока итог стоял снизу в одной таблице и сверху в другой, пользователю
     приходилось искать его заново на каждом экране. Все таблицы отчёта
     считываются одинаково: сначала итог, потом из чего он сложился. */
  if(o.total!==false&&!lite){
    const allBtn=o.expAll
      ? allCaret('data-btexpall',o.expAll.key+'|'+(o.expAll.open?'0':'1'),o.expAll.open,
          'Все вторые уровни разом.')
      : (o.tree?'<span class="caret-spacer"></span>':'');
    h+='<tr class="total top"><td class="txt">'+
      (o.tree?'<span class="row-label">'+allBtn+'<span class="row-body">ИТОГО</span></span>':'ИТОГО')+
      '</td><td class="lead">'+D.fmtVal(key,sum)+'</td>'+
      (withShare?'<td>100%</td>':'')+'<td class="barcell"></td></tr>';
  }

  items.forEach(x=>{
    const share=sum?x.value/sum*100:0;
    /* клик по строке: либо переход в подразделение, либо срез по категории */
    const cls=[x.node||x.pick||x.attr||x.restRow?'urow':'',x.on?'sel':'',x.depth===2?'lvl2':''].filter(Boolean).join(' ');
    /* expRow (21.10, файл «Структура»): строка стрима раскрывается кликом по ней самой,
       Shift+клик выбирает все специализации стрима (срез по стриму) */
    const hook=(cls?' class="'+cls+'"':'')+
      (x.node?' data-node="'+esc(x.node)+'"':'')+
      /* x.attr (22.10, посещаемость): свой фильтр вкладки — строка кликается, выбор складывается */
      (x.attr?' '+x.attr+tipAttr({title:x.name,text:x.on?'Выбрано. Клик — снять.':(x.attrTip||'Клик — показать только «'+x.name+'».')}):'')+
      (x.restRow?' data-btexp="'+esc(x.exp)+'"'+tipAttr({title:x.name,text:x.open?'Клик — свернуть.':'Кликни, чтобы посмотреть остальные.'})
      :x.pick&&x.expRow?' data-btexp="'+esc(x.exp)+'" data-mixgrp="'+esc(x.pick)+'"'+
        tipAttr({title:x.name,
          text:(x.open?'Клик — свернуть специализации.':'Клик — раскрыть специализации.')+
            (x.on?' Стрим выбран целиком; Shift+клик — снять.':' Shift+клик — выбрать все специализации стрима.')})
      :x.pick?' data-mix="'+esc(x.pick)+'"'+
        tipAttr({title:x.name,
          text:x.on?'Срез выбран. Клик — снять.'
                   :'Клик — срез по «'+x.name+'»: пересчитаются все разрезы, карточки и таблица подразделений. Shift+клик — добавить к срезу.'}):'');
    /* Двухуровневая разбивка: каретка раскрывает верхний уровень. Разметка та
       же, что в сводной таблице подразделений (`row-label` + `caret-btn`),
       чтобы раскрытие в отчёте выглядело и работало одинаково везде. */
    const caret=!tree?''
      :x.exp?'<button class="caret-btn"'+(x.open?' data-open="1"':'')+' data-btexp="'+esc(x.exp)+'"'+
        ' aria-label="'+(x.open?'Свернуть':'Раскрыть')+'"'+
        tipAttr({title:x.open?'Свернуть':'Раскрыть',text:x.restRow?'Значения, не вошедшие в первые строки.':o.expTip||'Что внутри этой строки.'})+
        '>'+(x.open?'▾':'▸')+'</button>'
      :'<span class="caret-spacer"></span>';
    /* лёгкие таблицы (структура): длинное название без пояснения — в две строки, а не многоточием (19.10) */
    const nm='<span class="row-body'+(lite&&!x.note?' two':'')+'">'+(x.mark?'<span class="rt-mark"'+tipAttr({title:'Нежелательный уход',text:'Причина, на которую компания могла повлиять: оплата, рост, руководитель.'})+'>★</span> ':'')+esc(x.name)+
      (x.note?'<span class="unit-sub">'+esc(x.note)+'</span>':'')+'</span>';
    h+='<tr'+hook+'>'+
      '<td class="txt">'+(tree?'<span class="row-label">'+caret+nm+'</span>':nm)+'</td>'+
      '<td class="lead">'+D.fmtVal(key,x.value)+'</td>'+
      (withShare?'<td>'+share.toFixed(share<10?1:0).replace('.',',')+'%</td>':'')+
      '<td class="barcell"'+tipAttr({title:x.name,
        rows:[{label:o.valueHead||'Значение',value:D.fmtVal(key,x.value),color:G.soft(x.color||G.C_LINE)}]
          .concat(withShare?[{label:'доля',value:share.toFixed(share<10?1:0).replace('.',',')+'%'}]:[]),
        note:x.tip||null})+
        '><span class="cellbar"><i style="width:'+barW(key,x.value,withShare?sum:0,max).toFixed(1)+'%'+
        /* полоса в ячейке — мягкий тон цвета строки: это фон под числом */
        (x.color?';background:'+G.soft(x.color):'')+'"></i></span></td></tr>';
  });

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
    /* без строки ИТОГО общая каретка двухуровневой разбивки — в подписи */
    (o.lite&&o.expAll?'<span class="bt-all">'+allCaret('data-btexpall',o.expAll.key+'|'+(o.expAll.open?'0':'1'),o.expAll.open,
      'Все вторые уровни разом.')+(o.expAll.open?'свернуть всё':'раскрыть всё')+'</span>':'')+
    '</div>'+barTable(o)+'</div>';
}
function btStack(list,cls){return '<div class="bt-stack'+(cls?' '+cls:'')+'">'+list.join('')+'</div>'}

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
function mxPick(id,name,on,cls,cat){
  /* «Остальные» длинной оси — не категория, срезом не берётся: кто в ней — в подсказке */
  if(cat&&cat.other)return '<span class="mx-pick mx-rest'+(cls?' '+cls:'')+'"'+tipAttr({title:'Остальные',text:cat.note||''})+'>'+esc(name)+'</span>';
  return '<button class="mx-pick'+(on?' on':'')+(cls?' '+cls:'')+'" data-mix="'+esc(id)+'"'+
    tipAttr({title:name,text:on?'Срез выбран. Клик — снять.':'Клик — показать только «'+name+'».'})+
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
    C.cats.map(c=>'<th class="mx-h">'+mxPick(c.id,c.name,sel.has(c.id),'',c)+'</th>').join('')+
    '<th class="mx-tot">Итого</th></tr></thead><tbody>';

  R.cats.forEach((rc,i)=>{
    h+='<tr'+(sel.has(rc.id)?' class="mx-on"':'')+'>'+
      '<td class="txt">'+mxPick(rc.id,rc.name,sel.has(rc.id),'row',rc)+'</td>';
    C.cats.forEach((cc,j)=>{
      const v=cells[i][j], t=shade(v,i,j);
      const rest=rc.other||cc.other;
      h+='<td class="mx-cell'+(v?'':' zero')+(rest?' rest':'')+'"'+(rest?'':' data-mix="'+esc(rc.id+','+cc.id)+'"')+
        (v?' style="background:'+G.heat(t)+';color:'+G.heatInk(t)+'"':'')+
        tipAttr({title:rc.name+' · '+cc.name,
          rows:[{label:'людей',value:D.fmtVal('hc_total',v),color:G.heat(Math.max(0.35,t))},
                {label:'от строки',value:rowSum[i]?pct(v/rowSum[i]*100):'—'},
                {label:'от колонки',value:colSum[j]?pct(v/colSum[j]*100):'—'}],
          note:rest?'«Остальные» — несколько категорий сразу, срезом не берётся.':'Клик — срез сразу по двум разрезам.'})+
        '>'+(v?show(v,i,j):'—')+'</td>';
    });
    h+='<td class="mx-tot">'+D.fmtInt(rowSum[i])+'</td></tr>';
  });

  /* Итоги колонок стоят ПОД своими клетками и по их выравниванию — по центру;
     общий итог живёт в колонке «Всего» и выровнен как она, по правому краю.
     Одно выравнивание на всю строку ставило бы число мимо своей колонки. */
  h+='<tr class="total"><td class="txt">Итого</td>'+
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
/* 21.10, файл «Структура»: строки и колонки — из списка измерений конструктора
   (o.rowDims / o.colDims: специализация — только в строках), «Метрика» — Чел. / % строки /
   % колонки, кнопка полного экрана. Одно и то же измерение в строках и колонках выбрать
   можно — тогда вместо таблицы подсказка. */
function mixPicker(o){
  const opts=(list,cur)=>list.map(d=>
    '<option value="'+d.key+'"'+(d.key===cur?' selected':'')+'>'+esc(d.name)+'</option>').join('');
  const modes=[['abs','Чел.'],['row','% строки'],['col','% колонки']];
  return '<div class="mx-bar">'+
    '<div class="ctl"><label>Строки</label>'+
      '<select data-mixaxis="rows">'+opts(o.rowDims,o.rows)+'</select></div>'+
    '<button class="btn ghost mx-swap" data-mixswap="1"'+
      tipAttr({title:'Поменять местами',text:'Строки станут колонками, колонки — строками.'+(o.swapNo?'\n'+o.swapNo:'')})+
      (o.swapNo?' disabled':'')+' aria-label="Поменять оси местами">⇄</button>'+
    '<div class="ctl"><label>Колонки</label>'+
      '<select data-mixaxis="cols">'+opts(o.colDims,o.cols)+'</select></div>'+
    '<div class="ctl"><label>Метрика</label><div class="opts tight">'+
      modes.map(m=>'<button class="opt'+(o.mode===m[0]?' on':'')+'" data-mixmode="'+m[0]+'">'+
        esc(m[1])+'</button>').join('')+'</div></div>'+
    '<button class="btn ghost mx-fs" data-mxfull="'+(o.full?'0':'1')+'"'+
      tipAttr({title:o.full?'Свернуть':'На весь экран',text:o.full?'Вернуться в отчёт. То же — Escape.':'Таблица на весь экран: удобно, когда измерение длинное.'})+'>'+
      (o.full?'✕ Свернуть':'⤢ На весь экран')+'</button>'+
    '</div>';
}
/* легенда тепловой заливки конструктора: «меньше → больше» той же синей шкалой */
function heatLegend(){
  return '<div class="mx-lg"><span>меньше</span><i style="background:linear-gradient(90deg,'+
    [0.04,0.25,0.5,0.75,1].map(t=>G.heat(t)).join(',')+')"></i><span>больше</span></div>';
}

/* ---------- Что выбрано: пилюли в шапке карточки графиков ----------
   31.10 (поставка 82, заказчик): отдельная липкая полка над таблицами вставлялась в поток — страница прыгала,
   отступы между блоками менялись, полоса выглядела чужой. Теперь всё выбранное кликом — подразделение в таблице,
   срез структуры, сегмент и город посещаемости — пилюлями в строке под заголовком карточки графиков: она и так
   липкая, место строки занято всегда, при выборе ничего не сдвигается. chips: [{dim, cat, attr — атрибут «×», tip}] */
function selBar(chips){
  if(!chips.length)return '';
  return '<span class="sel-bar">'+chips.map(c=>'<span class="sel-pill"'+(c.tip?tipAttr({title:c.dim+': '+c.cat,text:c.tip}):'')+'>'+
      '<span class="sp-d">'+esc(c.dim)+':</span> <b>'+esc(c.cat)+'</b>'+
      '<button class="x" '+c.attr+' aria-label="Снять: '+esc(c.dim)+'">×</button></span>').join('')+
    (chips.length>1?'<button class="sel-clear" data-selclear="1"'+tipAttr({title:'Сбросить всё',text:'Снять весь выбор. То же — клавиша Escape.'})+'>Сбросить всё</button>':'')+
    '</span>';
}
function sliceChips(parts,tip){
  return parts.map(p=>({dim:p.dim.short||p.dim.name,cat:p.cat.name,attr:'data-mix="'+esc(p.id)+'"',tip:tip}));
}

/* ============================================================================
   Портрет сотрудника (21.10, файл «Структура», п. 8 Антона): полоса долей и карточки
   категорий (26.10: воронки численности нет). Клик по куску полосы или по карточке — срез
   (data-mix), Shift+клик — добавить категорию того же разреза.
   ========================================================================== */
/* Полоса долей: кусок — доля, внутри — доля в процентах, если влезает. seg.bg — цвет
   (токен), seg.dk — тёмный фон, текст белый. Выбранная в срезе категория — с обводкой,
   остальные куски того же разреза тогда приглушены. */
function shareBar(o){
  const tot=o.segs.reduce((a,x)=>a+x.n,0)||1, any=o.segs.some(x=>x.on);
  return '<div class="shbar'+(any?' has-on':'')+'">'+o.segs.filter(x=>x.n>0).map(x=>{
    const p=Math.round(x.n/tot*100);
    return '<span class="'+[x.dk?'dk':'',x.on?'on':''].filter(Boolean).join(' ')+'" data-mix="'+esc(x.id)+'"'+
      ' style="flex:'+(x.n/tot*100).toFixed(2)+' 1 0;background:'+x.bg+'"'+
      tipAttr({title:x.name,rows:[{label:'Человек',value:D.fmtInt(x.n)},{label:'Доля',value:(x.n>0&&!p?'<1':p)+'%'}],
        note:x.on?'Срез взят. Клик — снять.':'Клик — срез по «'+x.name+'». Shift+клик — добавить к срезу.'})+'>'+
      (p>=6?'<em class="shb-t">'+(o.names&&p>=14?esc(x.name)+' ':'')+'<b>'+p+'%</b></em>':'')+'</span>';
  }).join('')+'</div>';
}
/* Карточки категорий под полосой: метка цвета, имя, число и строка пояснения
   (sub — разметка: средний возраст, «М 58% · Ж 42%»). */
function shareCards(o){
  const any=o.cards.some(x=>x.on);
  /* 23.10, Антон: до четырёх карточек — в один ряд, больше — по три в ряд (без «одной в последней строке» там,
     где этого можно избежать); ширина у всех одна */
  const n=o.cards.length, cols=n<=4?n:3;
  return '<div class="shcards c'+cols+(any?' has-on':'')+'">'+o.cards.map(x=>
    '<div class="shc'+(x.on?' on':'')+'" data-mix="'+esc(x.id)+'"'+
      tipAttr({title:x.name,text:x.on?'Срез взят. Клик — снять.':'Клик — срез по «'+x.name+'»: пересчитаются все разрезы, карточки и таблица подразделений. Shift+клик — добавить к срезу.'})+'>'+
      '<div class="shc-h">'+(x.icon?'<span class="shc-ic" style="color:'+x.bg+'">'+ico(x.icon)+'</span>':'<i style="background:'+x.bg+'"></i>')+esc(x.name)+'</div>'+
      '<div class="shc-n"><b>'+D.fmtInt(x.n)+'</b> чел</div>'+
      (x.sub?'<div class="shc-s">'+x.sub+'</div>':'')+'</div>').join('')+'</div>';
}
/* «М 58% · Ж 42%» с узкой полосой на два цвета — расклад пола внутри категории */
function genderSplit(m,f){
  const t=m+f;
  if(!t)return '<span class="gsp-x">нет людей</span>';
  const pm=Math.round(m/t*100), pf=100-pm;
  return '<span class="gsp"><span class="gsp-t">М <b>'+pm+'%</b> · Ж <b>'+pf+'%</b></span>'+
    '<span class="gsp-b"><i class="m" style="flex:'+pm+' 1 0"></i><i class="f" style="flex:'+pf+' 1 0"></i></span></span>';
}
/* Иконки разделов «Структуры численности» (23.10, заказчик: «на SVG — иконки: мальчик, девочка, возраст, уровень»).
   Линейные, 24×24, цвет — currentColor: в заголовке — тоном подписи, в карточке — цветом категории. */
const ICO={
  people:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3 3 0 0 1 0 5.6M21 20c0-2.6-1.6-4.8-3.8-5.6',
  male:'M12 7.5a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6zM8.5 22v-6.5H7v-4A2.5 2.5 0 0 1 9.5 9h5a2.5 2.5 0 0 1 2.5 2.5v4h-1.5V22',
  female:'M12 7.5a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6zM9.5 22v-5H6.5l2.8-6.4A2.6 2.6 0 0 1 11.7 9h.6a2.6 2.6 0 0 1 2.4 1.6l2.8 6.4h-3V22',
  hourglass:'M6 2.5h12M6 21.5h12M7.5 2.5c0 4.8 4.5 6 4.5 9.5s-4.5 4.7-4.5 9.5M16.5 2.5c0 4.8-4.5 6-4.5 9.5s4.5 4.7 4.5 9.5',
  pin:'M12 21.5s7-6.3 7-11.7a7 7 0 1 0-14 0c0 5.4 7 11.7 7 11.7zM12 12.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  stairs:'M3 20h5v-4.5h5V11h5V6.5h3',
  grade:'M5 20v-4M10 20v-8M15 20V8M20 20V4',
  calendar:'M4 5.5h16V20H4zM4 10h16M8.5 3v4.5M15.5 3v4.5M8 14h2M12 14h2M8 17h2',
  case:'M3.5 8h17v12h-17zM9 8V5h6v3M3.5 13.5h17',
  office:'M5 21V3.5h10V21M15 9h4.5v12M8 7.5h4M8 11h4M8 14.5h4M3 21h18',
  hybrid:'M2.5 21V10l5.5-4.5 5.5 4.5v11M13.5 21v-9H21v9M1.5 21h21M6.5 14h3M6.5 17.5h3M16 15h2.5',
  home:'M3 11 12 3.8 21 11M5.5 9.5V20h13V9.5M10 20v-5.5h4V20',
  company:'M3 21V7.5L9 4.5V21M9 21V10h6v11M15 21v-8h6v8M2 21h20',
  layers:'M12 3 21 8l-9 5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5'
};
function ico(name,cls){
  const d=ICO[name];
  return d?'<svg class="ico '+(cls||'')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+d+'"/></svg>':'';
}
/* Заголовок раздела портрета: иконка, имя и подпись справа от него (соотношение, средний возраст) */
function pfHead(name,aside,icon){
  return '<div class="pf-h">'+(icon?ico(icon,'pf-i'):'')+'<span class="pf-t">'+esc(name)+'</span>'+(aside?'<span class="pf-a">'+aside+'</span>':'')+'</div>';
}

/* ============================================================================
   Мониторинг рабочей активности (21.10, файл Антона)
   ========================================================================== */
/* 30.10: KPI-полоса мониторинга снята (заказчик: «убери плашки KPI на всех вкладках»), monKpi удалён */
/* переключатель «Месяцы / Недели» — те же кнопки-опции, что в конструкторе */
function segToggle(attr,opts,cur){
  return '<div class="opts tight seg-t">'+opts.map(x=>'<button class="opt'+(x[0]===cur?' on':'')+'" '+attr+'="'+esc(x[0])+'">'+esc(x[1])+'</button>').join('')+'</div>';
}
/* ---------- Панель с шапкой ---------- */
/* subHtml — подзаголовок с разметкой (кнопка «Открыть юнит», иконка в
   подсказке о глубине); обычный sub по-прежнему экранируется.
   hBtn — кнопка в углу заголовка («во всю ширину»): стоит поверх своего
   поля справа и не отнимает места у поиска и вкладок — иначе шапка росла
   на строку. */
function panel(o){
  const tabs=o.tabs||'';
  const sub=o.subHtml?o.subHtml:o.sub?esc(o.sub):'';
  return '<div class="panel'+(o.cls?' '+o.cls:'')+'">'+
    (o.title?'<div class="panel-h'+(tabs?' with-tabs':'')+'"><div class="h-txt'+(o.hBtn?' has-btn':'')+'"><span>'+o.title+'</span>'+
      (sub?'<span class="sub">'+sub+'</span>':'')+(o.hBtn||'')+'</div>'+tabs+'</div>':'')+
    '<div class="panel-b'+(o.bodyCls?' '+o.bodyCls:'')+'">'+o.body+'</div>'+
    /* foot — нижний край карточки, который прилипает к низу окна (правая панель блока, «один скролл») */
    (o.foot?'<div class="panel-cap" aria-hidden="true"></div>':'')+'</div>';
}

/* ============================================================================
   История по главам (итерация 32, концепция B). Правая панель детальной
   вкладки: степпер глав → заголовок-вывод → графики главы, рядом колонка
   «Что важно / Где сосредоточено / Что сделать / Дальше». Тексты считает
   story.js; здесь только разметка.
   ========================================================================== */
/* **жирное** → <b>; всё остальное экранируется */
/* {{Термин|форма}} → термин с определением в подсказке (словарь TPSTORY.GL);
   нет такого термина в словаре — остаётся просто текст */
function richText(t){
  return esc(t==null?'':t).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/\{\{([^}|]+)(?:\|([^}]+))?\}\}/g,(m,term,shown)=>{
      const def=window.TPSTORY&&window.TPSTORY.glossary?window.TPSTORY.glossary(term):null;
      const txt=shown||term;
      return def?'<span class="term" tabindex="0"'+tipAttr({title:term,text:def})+'>'+txt+'</span>':txt;
    });
}
/* Степпер: шаг = под-вкладка. data-subtab — тот же обработчик, что у вкладок;
   data-text — резерв ширины жирной подписи (правило 10d). Под вопросом —
   короткий ответ и точка сигнала: зелёная, красная или серая (светофор). */
function chapters(list,active){
  if(!list||list.length<2)return'';
  return '<div class="st-steps n'+Math.min(6,list.length)+'" role="tablist">'+list.map((c,i)=>{
    const on=c.key===active;
    /* глава в разработке (14.10): шаг заштрихован, номер — в полосу, вместо
       ответа — «в разработке · этап N» (текстом: пилюля в узком шаге
       обрезалась). Частично живая — ответ остаётся, номер в полосу светлее. */
    /* 15.10: без «этап N» — номер этапа руководителю ничего не говорит; он в подсказке */
    const dev=c.dev==='full'?'<span class="st-s st-dev">в разработке</span>':'';
    const dp=c.devStage!=null?D.devPlan(c.devStage):null;
    return '<button class="st-step'+(on?' on':'')+(c.dev?' dev-'+c.dev:'')+'" data-subtab="'+esc(c.key)+'" data-text="'+esc(c.q)+'" role="tab" aria-selected="'+on+'"'+
      tipAttr({title:(i+1)+'. '+c.q,text:c.dev==='full'?'В разработке: цифры условные.'+(dp?'\nИсточник: '+dp.src+'.':'')
        :c.sum?String(c.sum):c.name,note:c.dev==='part'?'Часть цифр на вкладке условная.':c.name})+'>'+
      '<span class="st-n">'+(i+1)+'</span><span class="st-tx"><span class="st-q">'+esc(c.q)+'</span>'+
      (dev||(c.sum?'<span class="st-s"><i class="st-dot '+esc(c.st||'n')+'"></i>'+esc(c.sum)+'</span>':''))+'</span></button>';
  }).join('')+'</div>';
}
/* act — «Что сделать» строкой под выводом. Она видна, только пока колонка
   выводов стоит под графиками (узкая панель, таблица подразделений слева):
   иначе главный совет главы был бы под сгибом. Когда колонка встаёт сбоку,
   строку прячет CSS — совет уже в колонке. */
/* why / todo — «Зачем смотреть» и «Что с этим делать»: обычным текстом, не
   в подсказке (фидбэк 12.10); термины в них — с определениями по наведению */
const ST_ACT=false;
function storyHead(head,lede,act,why,todo){
  if(!head&&!lede&&!why)return'';
  return '<div class="st-head">'+(head?'<h3>'+richText(head)+'</h3>':'')+(lede?'<p>'+richText(lede)+'</p>':'')+
    (why||todo?'<div class="st-why">'+(why?'<p><b>Зачем смотреть.</b> '+richText(why)+'</p>':'')+
      (todo?'<p><b>Что с этим делать.</b> '+richText(todo)+'</p>':'')+'</div>':'')+
    /* 30.10, шаг 1: совет «Что сделать» — один на вкладку, в выводе блока сверху; здесь и в колонке справа его нет
       (критики: «начните с 3.3» и «начните с 3.1» на одном экране) */
    (act&&ST_ACT?'<div class="st-act-in"><span>'+richText(act.text)+'</span>'+
      (act.node?'<button class="btn xs" data-selnode="'+esc(act.node)+'">Показать «'+esc(act.name)+'»</button>':'')+'</div>':'')+
    '</div>';
}
/* o: {facts, focus:{cap,rows:[{name,val,w,st,path}]}, act:{text,node,name}}.
   Кнопки «Дальше» нет (итерация 32, заказчик): к следующей главе ведёт степпер
   сверху, а кнопка внизу колонки только занимала место. */
function storyRail(o){
  let h='';
  const facts=(o.facts||[]).filter(Boolean);
  if(facts.length)h+='<div class="st-sec"><div class="st-cap">Что важно</div><ul class="st-facts">'+
    facts.map(x=>'<li>'+richText(x)+'</li>').join('')+'</ul></div>';
  /* 29.10, п. 5: в саммари главы — только текст: таблица «Где …» дублировала таблицу подразделений слева, её больше
     нет; где сосредоточено — одной фразой в «Что сделать» (o.act) */
  if(o.act&&ST_ACT)h+='<div class="st-act"><div class="st-cap">Что сделать</div><p>'+richText(o.act.text)+'</p>'+
    (o.act.node?'<button class="btn xs" data-selnode="'+esc(o.act.node)+'">Показать «'+esc(o.act.name)+'»</button>':'')+'</div>';
  return h?'<aside class="st-rail">'+h+'</aside>':'';
}
/* Список выводов внутри главы (обзор «Движения персонала»): то, что нужно
   вынести из графика, — прямо под ним, а не в колонке сбоку. */
function storyFacts(list,cap){
  const f=(list||[]).filter(Boolean);
  if(!f.length)return'';
  return '<div class="st-ins"><div class="st-cap">'+esc(cap||'Что важно')+'</div><ul>'+
    f.map(x=>'<li>'+richText(x)+'</li>').join('')+'</ul></div>';
}
/* Обёртка главы. main — содержимое под-вкладки как есть (графики, таблицы). */
function story(o){
  return '<div class="st-wrap">'+(o.steps||'')+'<div class="st-grid'+(o.rail?' has-rail':'')+'">'+
    '<div class="st-main">'+(o.head||'')+o.main+'</div>'+(o.rail||'')+'</div></div>';
}

/* ---------- Под-вкладки ---------- */
function subTabs(list,active){
  if(!list||list.length<2)return'';
  /* data-text — невидимая жирная копия подписи (styles.css, итерация 28):
     активная вкладка жирная, и без резерва ширины ряд прыгал бы при переключении */
  return '<div class="sub-tabs">'+list.map(t=>'<button class="sub-tab'+(active===t[0]?' active':'')+
    '" data-subtab="'+t[0]+'" data-text="'+esc(t[1])+'">'+esc(t[1])+'</button>').join('')+'</div>';
}

/* ============================================================================
   statTable — таблица показателей: строки — разные величины, колонки — срезы.
   План-факт подбора («Всего · Массовый · Профильный»), заявки «Роста» по типу.

   Это не разбивка. Строки не складываются в итог и у каждой свой формат
   (люди, проценты, дни), поэтому полосы в ячейке здесь нет: её длина
   сравнивала бы несравнимое. Если первая колонка — итог среза («Всего»),
   она жирная: сначала итог, потом из чего сложился — как ИТОГО первой
   строкой в разбивках (правило 10e).

   o.cols   — подписи колонок            o.fmts — формат по колонке (по умолчанию int)
   o.head   — шапка первой колонки; пустая, если имя таблицы стоит над ней (10f)
   o.firstTotal — первая колонка итоговая (по умолчанию да)
   o.rows   — {name, note, fmt, vals, sub, total, state:[good|bad|…], tip}
              или {sec:'Заголовок секции'} — рубрика внутри таблицы
   ========================================================================== */
function statTable(o){
  const nc=o.cols.length, first=o.firstTotal!==false;
  let h='<table class="ptable stable dense"><thead><tr><th class="txt">'+esc(o.head||'')+'</th>'+
    o.cols.map((c,j)=>'<th'+(j===0&&first?' class="st-tot"':'')+'>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>';
  /* 22.10: строка без данных (все значения пустые или 0) не выводится, рубрика без строк — тоже */
  const has=r=>r.total||r.vals.some(v=>v!=null&&v!==0);
  const rows=o.rows.filter(r=>r.sec||has(r)).filter((r,i,a)=>!r.sec||(a[i+1]&&!a[i+1].sec));
  rows.forEach(r=>{
    if(r.sec){h+='<tr class="st-sec"><td class="txt" colspan="'+(nc+1)+'">'+esc(r.sec)+'</td></tr>';return}
    const cls=[r.total?'total top':'',r.sub?'st-sub':''].filter(Boolean).join(' ');
    h+='<tr'+(cls?' class="'+cls+'"':'')+(r.tip?tipAttr(r.tip):'')+'><td class="txt">'+esc(r.name)+
      (r.note?'<span class="unit-sub">'+esc(r.note)+'</span>':'')+'</td>'+
      r.vals.map((v,j)=>{
        const txt=D.fmtNum(r.fmt||(o.fmts&&o.fmts[j])||'int',v);
        /* оценка строки (выполнение плана к цели) — той же пилюлей, что «К базе»
           в сводной таблице: один язык светофора на весь отчёт */
        const st=r.state&&r.state[j];
        return '<td'+(j===0&&first&&!r.total?' class="lead"':'')+'>'+
          (st&&v!=null?'<span class="cell '+st+'">'+txt+'</span>':txt)+'</td>';
      }).join('')+'</tr>';
  });
  return h+'</tbody></table>';
}

/* ============================================================================
   heatTable — матрица долей без среза по клику: строки — группы людей,
   колонки — категории (статусы роста, оценки ревью).

   В клетке % по строке: группы разного размера сравниваются только долями,
   а людей видно в подсказке и в последней колонке. Заливка — та же синяя
   монохромная шкала, что у матрицы состава и календаря: это распределение,
   а не оценка, и светофор здесь соврал бы. Насыщенность считается от самой
   большой доли таблицы, иначе при долях 5–40% вся матрица была бы бледной.

   o.cols   — [{name, tip}]                 o.corner — подпись над колонкой строк
   o.total  — {name, cells} — итоговая строка, первой (правило 10e)
   o.groups — [{name, rows:[{name, cells}]}]; при нескольких группах имя группы
              стоит строкой-рубрикой (грейд · стаж · роль в одной таблице)
   ========================================================================== */
function heatTable(o){
  const nc=o.cols.length;
  const sumOf=c=>c.reduce((a,b)=>a+b,0);
  const all=(o.total?[o.total]:[]).concat(...o.groups.map(g=>g.rows));
  let top=0;
  all.forEach(r=>{const t=sumOf(r.cells);if(t)r.cells.forEach(v=>{top=Math.max(top,v/t)})});
  top=top||1;
  const row=(r,cls)=>{
    const t=sumOf(r.cells);
    /* проценты строки дают ровно 100: округляются группой, как в матрице состава */
    const pc=t?D.roundParts(r.cells.map(v=>v/t*100),100):r.cells.map(()=>0);
    return '<tr'+(cls?' class="'+cls+'"':'')+'><td class="txt">'+esc(r.name)+'</td>'+
      r.cells.map((v,j)=>{
        const k=t?v/t/top:0;
        return '<td class="mx-cell'+(v?'':' zero')+'"'+(v?' style="background:'+G.heat(k)+';color:'+G.heatInk(k)+'"':'')+
          tipAttr({title:r.name+' · '+o.cols[j].name,
            rows:[{label:'доля в строке',value:t?pc[j]+'%':'—',color:G.heat(Math.max(0.35,k))},
                  {label:'человек',value:D.fmtInt(v)}],
            note:o.cols[j].tip||null})+'>'+(t?pc[j]+'%':'—')+'</td>';
      }).join('')+'<td class="mx-tot">'+D.fmtInt(t)+'</td></tr>';
  };
  let h='<div class="mx-wrap"><table class="ptable mxtable hxtable dense"><thead><tr>'+
    '<th class="txt mx-corner">'+(o.corner?'<span class="mx-r">'+esc(o.corner)+'</span>':'')+'</th>'+
    o.cols.map(c=>'<th class="mx-h"'+(c.tip?tipAttr({title:c.name,text:c.tip}):'')+'>'+esc(c.name)+'</th>').join('')+
    '<th class="mx-tot">'+esc(o.totHead||'Человек')+'</th></tr></thead><tbody>';
  if(o.total)h+=row(o.total,'total top');
  /* 22.10: строка без людей (все клетки 0) — её нет в данных, не выводится; группа без строк — тоже */
  o.groups.forEach(g=>{
    const rows=g.rows.filter(r=>sumOf(r.cells)>0);
    if(!rows.length)return;
    if(o.groups.length>1)h+='<tr class="hx-sec"><td class="txt" colspan="'+(nc+2)+'">'+esc(g.name)+'</td></tr>';
    rows.forEach(r=>{h+=row(r)});
  });
  return h+'</tbody></table></div>';
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
/* ---------- Мини-навигация One-pager ----------
   Семь таблиц подряд — длинный скролл без ориентиров. Липкая полоса блоков
   с точкой худшего сигнала: красная — есть метрика хуже ориентира, зелёная —
   только лучше, серая — сигналов нет. Цифра — число красных. Клик прокручивает
   к блоку, текущий блок подсвечивается по мере прокрутки (app.js). */
function blockNav(items){
  return '<nav class="op-nav" aria-label="Блоки сводки">'+items.map(it=>
    '<button class="op-nav-i" data-jump="'+it.key+'"'+tipAttr({title:it.name,
      text:it.bad?'Хуже ориентира: **'+it.bad+' '+plural(it.bad,['метрика','метрики','метрик'])+'**.'
        :it.good?'Хуже ориентира — ничего. Лучше — '+it.good+'.':'Всё на уровне ориентира или без оценки.'})+'>'+
    '<span class="sig '+it.state+'"></span>'+esc(it.name)+
    (it.bad?'<span class="op-nav-n">'+it.bad+'</span>':'')+'</button>').join('')+'</nav>';
}
function trafficLegend(){
  /* два цвета и серый: жёлтого в светофоре нет. «На уровне ±5%» и «без оценки»
     делят один серый — оба означают «повода вмешиваться нет». */
  /* 26.10, ревью критиков: цвет пилюль изменений — к прошлому периоду, а не к ориентиру */
  return '<div class="legend"><span class="sw"><span class="dot" style="background:#bff2cd"></span>лучше</span>'+
    '<span class="sw"><span class="dot" style="background:#ffcccc"></span>хуже</span>'+
    '<span class="sw"><span class="dot" style="background:#f3f4f6"></span>на уровне (±5%) или без оценки</span>'+
    /* 30.10, шаг 2: пояснение — в подсказке, под выводами меньше букв */
    '<span class="sw lg-note"'+tipAttr({title:'Как читать цвета',text:'Колонка «Ориентир» — к цели KPI, а где её нет — к базе: та же метрика по всей компании с теми же фильтрами. Колонки MoM и YoY — к прошлому периоду.'})+
    '>как читать</span></div>';
}

/* ============================================================================
   Пробник Proteus (итерация 31): метрика или разбивка без источника — заглушка
   на генераторе макета, и это сказано прямо у её имени.
   ========================================================================== */
/* ---------- «В разработке» (14.10) ----------
   Заказчик: «подсветить ярче, что в разработке, — не так, как демо-данные, —
   чтобы понимать, что ещё доработать». Серая пунктирная метка «демо» читалась
   как сноска. Теперь это полосатая «строительная» плашка: метрика, вкладка или
   блок без источника данных видны сразу, с номером этапа плана и тем, что
   для него нужно. Не оценка и не светофор: свой тон (--dev-*), не красный и
   не зелёный. Рисуется и в макете, и в пробнике (D.isDev). */
function devTip(stage){
  const p=stage!=null?D.devPlan(stage):null;
  return {title:'В разработке'+(stage!=null&&stage!=='—'&&stage!=='0'?' · этап '+stage+' из 8':''),
    text:'Данных пока нет: цифры условные и показывают, где появится показатель.'+(p?'\nИсточник: **'+p.src+'**.':''),
    note:'Весь план — на One-pager, «Готовность данных».'};
}
function devTag(stage,small){
  /* 15.10: «в разраб.» — полная «в разработке» раздувала шапки колонок и карточки;
     полностью — в подсказке, на плашке вкладки и в меню */
  return '<span class="dev-tag'+(small?' sm':'')+'"'+tipAttr(devTip(stage))+'>в разраб.</span>';
}
/* Плашка вкладки: d = {stage, t — что здесь не настоящее, need — что нужно, part} */
function devNote(d){
  if(!d)return '';
  const p=d.stage!=null?D.devPlan(d.stage):null, need=d.need||(p&&p.need!=='—'?p.need:'');
  /* 15.10: плашка — одной строкой («очень много места занимает»): статус и что
     нужно; что именно здесь заглушка — в подсказке по «i» */
  /* 15.10, редполитика: «ждём: данные о вакансиях», а не «нужно: имена таблиц и ответ 0а» */
  return '<div class="dev-note'+(d.part?' part':'')+'"><span class="dev-h">'+(d.part?'Частично в разработке':'В разработке')+'</span>'+
    (p?'<span class="dev-need">источник: '+esc(p.src)+'</span>':'')+
    (d.t?'<span class="info"'+tipAttr({title:d.part?'Частично в разработке':'В разработке',
      text:d.t,note:need?'Что нужно: '+need+'.':null})+' aria-label="Что здесь условно">i</span>':'')+'</div>';
}
/* План по каталогу (15.10): графики HQ и УС, сгруппированные по блокам борта.
   Что · для кого · где сейчас · откуда и что нужно. Тот же план — в справке
   и в сводке готовности на One-pager. */
function planNow(r){
  if(r.now==='live'&&r.bad)return '<span class="live-tag bad"'+tipAttr(D.MISMATCH_TIP)+'>расхождение</span>';
  if(r.now==='live'&&r.ok)return '<span class="live-tag ok"'+tipAttr(D.VERIFIED_TIP)+'>✓ сверены</span>';
  return r.now==='live'?'<span class="live-tag">настоящие</span>'
    :r.now==='dev'?devTag(r.stage)
    :'<span class="plan-tag '+r.now+'">'+esc(D.PLAN_NOW[r.now])+'</span>';
}
function planTable(groups){
  const n=D.planCount();
  return '<label>План Team Pulse 2.0</label><div class="fhint">Всё, что есть в дашбордах HQ и УС, — по блокам отчёта.</div>'+
    '<ul class="plan-lg">'+
      '<li><span class="live-tag ok">✓ сверены</span> настоящие и сверены с мастер-источником: число в отчёте совпадает с ним — '+n.ok+'</li>'+
      /* 27.10-в, п. 10: расхождений не осталось — пункт легенды только когда они есть */
      (n.bad?'<li><span class="live-tag bad">расхождение</span> настоящие, но с мастер-источником пока не сходятся — '+n.bad+'</li>':'')+
      '<li><span class="live-tag">настоящие</span> уже на настоящих данных — '+(n.live-n.ok-n.bad)+'</li>'+
      '<li><span class="plan-tag data">данные есть</span> данные пришли, графика ещё нет — '+n.data+'</li>'+
      '<li>'+devTag(null,false)+' в отчёте есть, цифры пока условные — '+n.dev+'</li>'+
      '<li><span class="plan-tag todo">добавить</span> в отчёте ещё нет — '+n.todo+'</li>'+
      '<li><span class="plan-tag extra">решить</span> в отчёте есть, в дашбордах HQ и УС нет — '+n.extra+'</li></ul>'+
    '<table class="plan-t"><thead><tr><th>Что</th><th>Для кого</th><th>Сейчас</th><th>Откуда · что нужно</th></tr></thead><tbody>'+
    /* 27.10-в, п. 12–13: строки следующих релизов (next) в плане не показываем */
    groups.map(g=>'<tr class="plan-g"><td colspan="4">'+esc(g.blk)+'</td></tr>'+g.rows.filter(r=>!r.next).map(r=>{
      const st=D.devPlan(r.stage), src=r.src||(st?st.src:''), need=r.need||(r.now!=='live'&&st&&st.need!=='—'?st.need:'');
      return '<tr class="plan-'+r.now+'"><td>'+esc(r.what)+'</td><td><span class="aud-tag '+r.aud+'">'+esc(D.AUD_LABEL[r.aud])+
        '</span></td><td>'+planNow(r)+'</td><td>'+(r.stage&&r.stage!=='0'&&r.stage!=='—'&&r.now!=='live'?'<b>этап '+esc(r.stage)+'</b> · ':'')+
        esc(src)+(need?'<span class="plan-need">'+esc(need)+'</span>':'')+
        (r.hq?'<span class="plan-need">считается только для HQ-численности</span>':'')+'</td></tr>';
    }).join('')).join('')+'</tbody></table>';
}
/* Сводка готовности на One-pager: сколько метрик на живых данных, сколько
   графиков каталога ещё добавить. Раскрывается в полный план. o = {live, total, plan} */
/* 29.10, п. 3 (решение — Дарья Стонис): полоса — сколько метрик уже сверено с мастер-источником, из всех метрик
   отчёта; на настоящих данных и в разработке — рядом числом. o.ver — сверенные из показанных */
const U_TIPV=()=>'<span class="info"'+tipAttr(D.VERIFIED_TIP)+' aria-label="Что значит «сверено»">i</span>';
function devSummary(o){
  const ver=o.ver==null?D.VERIFIED.size:o.ver, pc=o.total?Math.round(ver/o.total*100):0, n=D.planCount();
  return '<details class="dev-sum"><summary><span class="dev-sum-h">Готовность данных</span>'+
    '<span class="dev-sum-bar" role="img" aria-label="'+pc+'% метрик сверено"><i style="width:'+pc+'%"></i></span>'+
    '<span class="dev-sum-n"><b>'+ver+' из '+o.total+'</b> метрик сверено'+U_TIPV()+' · на настоящих данных '+o.live+
      (o.total-o.live?' · <span class="dev-tag sm-in">в разраб. '+(o.total-o.live)+'</span>':'')+
      (D.MISMATCH.size?' · <span class="live-tag bad"'+tipAttr(D.MISMATCH_TIP)+'>расхождение '+D.MISMATCH.size+'</span>':'')+
      (n.todo?' · <span class="plan-tag todo">ещё добавить '+n.todo+'</span>':'')+'</span>'+
    '<span class="dev-sum-more">весь план ▾</span></summary>'+
    '<div class="dev-sum-b">'+planTable(o.plan)+'</div></details>';
}

window.TPUI={metricText,storyFacts,richText,chapters,storyHead,storyRail,story,devTag,devNote,devSummary,planTable,blockNav,opStory,esc,plural,tipAttr,tip,deltaChip,icoExt,rowCaret,allCaret,noCmpMark,unitHead,unitTip,infoDot,NOCMP_HINT,targetCell,
  barTable,btGroup,btStack,matrixTable,mixPicker,heatLegend,selBar,sliceChips,pct,panel,subTabs,empty,trafficLegend,
  shareBar,shareCards,genderSplit,pfHead,ico,barW,segToggle,
  statTable,heatTable,icoOpen,openUnitBtn,searchBox,hlText,unitHide,unitRail,splitGut};
})();

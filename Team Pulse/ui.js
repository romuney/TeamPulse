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
    tipAttr({title:'Открыть юнит',
      text:'Отчёт встанет на «'+name+'»: карточки, таблица на три уровня ниже него, one-pager и ссылка — по нему. '+
        'База сравнения не меняется.',
      note:'Вернуться — «← Назад» или путь над отчётом.'})+'>'+icoOpen()+(label?esc(label):'')+'</button>';
}

/* ---------- Таблица подразделений: показать / скрыть (итерация 32) ----------
   Таблица — основа фильтрации и видна по умолчанию; убрать её, чтобы отдать
   графикам всю ширину, можно одним переключателем — свитч с подписью, а не пара
   иконок «развернуть / свернуть»:
   по иконке было не понять, что именно развернётся. Переключатель стоит в правом
   углу шапки панели графиков — это место не сдвигается ни в одном режиме.
   shown — видна ли таблица сейчас. */
function unitToggle(shown){
  const lbl=shown?'Скрыть таблицу подразделений':'Показать таблицу подразделений';
  return '<button class="unit-toggle'+(shown?' on':'')+'" data-splitmode="'+(shown?'charts':'both')+'"'+
    ' role="switch" aria-checked="'+(shown?'true':'false')+'" aria-label="'+lbl+'"'+
    tipAttr({title:lbl,text:shown?'Графики снова займут всю ширину.'
      :'Слева встанет таблица подразделений: клик по строке покажет графики этого подразделения.',
      note:shown?'Ширину колонок можно тянуть за разделитель; двойной клик — как было.':''})+
    '><span class="ut-sw" aria-hidden="true"><i></i></span><span class="ut-l">Подразделения</span></button>';
}
/* Разделитель — настоящий separator: тянется мышью и пальцем, ← → двигают
   его с клавиатуры, двойной клик возвращает ширину по умолчанию. */
function splitGut(share){
  return '<div class="split-gut" data-split="1" role="separator" aria-orientation="vertical" '+
    'aria-label="Ширина таблицы подразделений" aria-valuemin="20" aria-valuemax="80"'+
    (share!=null?' aria-valuenow="'+Math.round(share*100)+'"':'')+' tabindex="0"'+
    tipAttr({title:'Ширина колонок',text:'Потяните, чтобы дать больше места таблице или графикам.',
      note:'Двойной клик — как было; стрелки ← → — с клавиатуры.'})+'><i></i></div>';
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
    tipAttr({title:open?'Свернуть график':'Показать динамику',
      text:'Клик по строке раскрывает график «год к году» и выводы по метрике прямо в таблице.'})+
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
/* Руководитель юнита под именем строки (14.10): «Имя Фамилия · логин».
   Нет данных (пробник без источника, строка «Напрямую в «X»») — ничего. */
function unitHead(n){
  const h=n&&n.head;
  if(!h||!(h.name||h.login))return '';
  return '<span class="unit-head"'+tipAttr({title:'Руководитель',text:(h.name||'')+(h.login?' · '+h.login:'')})+'>'+
    esc(h.name||'')+(h.login?' <span class="login">'+esc(h.login)+'</span>':'')+'</span>';
}
/* Строка сравнения в KPI-карточке «по компании X» (14.10: вместо «база X»;
   осталась только у «Проникновения AI»). Что именно за база — в подсказке. */
function byCompany(key,bv,S){
  return '<span class="k-sub"'+tipAttr({title:'По компании',text:'То же значение по всей компании под теми же фильтрами: «'+
    D.benchmarkLabel(S)+'».'})+'>по компании '+D.fmtVal(key,bv)+'</span>';
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
/* ---------- Раскрытая строка One-pager: график и «Что видно» ----------
   Механика HRBP HUB (13.10): слева полотно «год к году» с номерными
   отметками, справа — пункты «Что видно» с теми же номерами и «О метрике».
   Сверх HRBP пункт и график связаны наведением в обе стороны (app.js,
   data-mk / data-mi): навёл на пункт — на графике подсвечены его отметка и
   месяц; навёл на месяц графика — подсвечены пункты о нём.
   st = TPINSIGHTS.yoyStory(): html пунктов уже собран и экранирован там. */
function opStory(chart,st,about){
  let l='';
  if(st.stub)l='<p class="op-stp">Метрика пока на демо-данных — выводов по ней нет.</p>';
  else if(st.items.length)l='<ol class="op-ins">'+st.items.map(it=>
    '<li'+(it.n?' data-mk="'+it.n+'"':'')+' data-mi="'+(it.mi||[]).join(',')+'">'+
    (it.n?'<i class="op-insn'+(it.s==='prev'?' prev':'')+'">'+it.n+'</i>':'<i class="op-insb"></i>')+
    '<span>'+it.html+'</span></li>').join('')+'</ol>';
  return '<div class="op-story" data-oplink="1"><div class="op-stc">'+chart+'</div><div class="op-sts">'+
    (l?'<div class="op-sth">Что видно</div>'+l:'')+
    '<div class="op-sta"><div class="op-sth">О метрике</div>'+about+'</div></div></div>';
}
/* ---------- «Что видно в данных» над таблицами One-pager ----------
   HRBP HUB: верхнеуровневые факты, по одному на метрику, а не мешанина
   юнитов. Первые три видны сразу, остальные — по «Ещё N». Клик по факту
   раскрывает строку его метрики: там график и разбор по пунктам. */
const OBS_SEV={high:'требует действий',mid:'стоит внимания',good:'позитив'};
function obsPanel(list,open,info){
  const sev=list.length?list[0].sev:'none';
  let h='<div class="ai insight obs sev-'+sev+'"><div class="obs-h">'+aiIco(false)+
    '<span class="ai-t">Что видно в данных</span>'+(info||'')+
    (list.length?'<span class="ai-sev '+sev+'">'+OBS_SEV[sev]+'</span>':'<span class="obs-none">Заметных отклонений нет.</span>')+'</div>';
  if(list.length){
    h+='<ul class="obs-list">'+(open?list:list.slice(0,3)).map(x=>
      '<li class="obs-li" data-opfact="'+esc(x.key)+'" tabindex="0" role="button"><i class="obs-dot '+x.sev+'"></i>'+
      '<div><b>'+esc(x.lead)+'.</b> '+(x.body?esc(x.body)+' ':'')+'<span class="obs-go">график →</span></div></li>').join('')+'</ul>';
    if(list.length>3)h+='<button class="obs-more" data-ai="op">'+(open?'Свернуть ▴':'Ещё '+(list.length-3)+' ▾')+'</button>';
  }
  return h+'</div>';
}
function kpiCard(o){
  return '<div class="kpi"><div class="k-label">'+esc(o.label)+(o.tag||'')+(o.q||'')+'</div>'+
    '<div class="k-val">'+o.value+'</div>'+
    '<div class="k-row">'+(o.row1||'')+'</div>'+
    '<div class="k-row">'+(o.row2||'')+'</div>'+
    /* пятая строка — «год назад»: рисуется всегда, как и второй ряд, иначе
       subgrid потерял бы общий шаг строк у карточек с ней и без неё */
    '<div class="k-row k-yoy">'+(o.row3||'')+'</div></div>';
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
  /* lite (14.10, структура): без шапки колонок и без ИТОГО — число и доля
     понятны сами («53 · 28%»), а итог уже стоит в карточке над таблицей;
     строки ниже, цифры без жирного. «Одно и то же десять раз» — фидбэк. */
  const lite=!!o.lite;
  let h='<table class="ptable btable'+(o.compact?' dense':'')+(lite?' lite':'')+'">'+
    '<colgroup><col style="width:'+(lite?'34%':o.compact?'40%':'34%')+'"><col style="width:'+(lite?'9%':'14%')+'">'+
    (withShare?'<col style="width:'+(lite?'9%':'11%')+'">':'')+'<col></colgroup>'+
    (lite?'':'<thead><tr><th class="txt">'+esc(o.head||'')+'</th>'+
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
        rows:[{label:o.valueHead||'Значение',value:D.fmtVal(key,x.value),color:G.soft(x.color||G.C_LINE)}]
          .concat(withShare?[{label:'доля',value:share.toFixed(share<10?1:0).replace('.',',')+'%'}]:[]),
        note:x.tip||null})+
        '><span class="cellbar"><i style="width:'+(x.value/max*100).toFixed(1)+'%'+
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
    '<div class="panel-b'+(o.bodyCls?' '+o.bodyCls:'')+'">'+o.body+'</div></div>';
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
    const dev=c.dev==='full'?'<span class="st-s st-dev">в разработке'+(c.devStage!=null?' · этап '+esc(c.devStage):'')+'</span>'
      :'';
    return '<button class="st-step'+(on?' on':'')+(c.dev?' dev-'+c.dev:'')+'" data-subtab="'+esc(c.key)+'" data-text="'+esc(c.q)+'" role="tab" aria-selected="'+on+'"'+
      tipAttr({title:(i+1)+'. '+c.q,text:c.dev==='full'?'В разработке: источника данных пока нет'+(c.devStage!=null?' (этап '+c.devStage+' плана)':'')+'.'
        :c.sum?String(c.sum):c.name,note:c.dev==='part'?'Часть данных вкладки — заглушка.':c.name})+'>'+
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
function storyHead(head,lede,act,why,todo){
  if(!head&&!lede&&!why)return'';
  return '<div class="st-head">'+(head?'<h3>'+richText(head)+'</h3>':'')+(lede?'<p>'+richText(lede)+'</p>':'')+
    (why||todo?'<div class="st-why">'+(why?'<p><b>Зачем смотреть.</b> '+richText(why)+'</p>':'')+
      (todo?'<p><b>Что с этим делать.</b> '+richText(todo)+'</p>':'')+'</div>':'')+
    (act?'<div class="st-act-in"><span>'+richText(act.text)+'</span>'+
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
  const fo=o.focus;
  if(fo&&fo.rows&&fo.rows.length)h+='<div class="st-sec"><div class="st-cap">'+esc(fo.cap||'Где сосредоточено')+'</div>'+
    '<table class="st-focus"><tbody>'+fo.rows.map(r=>'<tr data-selnode="'+esc(r.path)+'"'+
      tipAttr({title:r.name,text:'Клик — графики этой главы по «'+r.name+'».'})+'><td class="nm">'+esc(r.name)+'</td>'+
      '<td class="v'+(r.st?' '+esc(r.st):'')+'">'+esc(r.val)+'</td>'+
      '<td class="bar"><i style="width:'+Math.max(4,Math.round((r.w||0)*100))+'%"></i></td></tr>').join('')+
    '</tbody></table></div>';
  if(o.act)h+='<div class="st-act"><div class="st-cap">Что сделать</div><p>'+richText(o.act.text)+'</p>'+
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
  o.rows.forEach(r=>{
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
  o.groups.forEach(g=>{
    if(o.groups.length>1)h+='<tr class="hx-sec"><td class="txt" colspan="'+(nc+2)+'">'+esc(g.name)+'</td></tr>';
    g.rows.forEach(r=>{h+=row(r)});
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
/* ============================================================================
   pulseStrip — «Пульс команды»: одна полоса над KPI, отвечающая на два вопроса
   до чтения таблиц. Слева — сколько метрик сейчас лучше и хуже своего
   ориентира (цель KPI или база), полосой с тем же светофором, что у пилюль.
   Справа — главные сдвиги за год: относительные метрики с самым большим
   изменением к тому же месяцу прошлого года. Клик по сдвигу ведёт в блок.

   o = {good, bad, neu, movers:[{key,name,block,cur,prev,yoy}]}
   ========================================================================== */
/* ---------- Мини-навигация One-pager ----------
   Семь таблиц подряд — длинный скролл без ориентиров. Липкая полоса блоков
   с точкой худшего сигнала: красная — есть метрика хуже ориентира, зелёная —
   только лучше, серая — сигналов нет. Цифра — число красных. Клик прокручивает
   к блоку, текущий блок подсвечивается по мере прокрутки (app.js). */
function blockNav(items){
  return '<nav class="op-nav" aria-label="Блоки сводки">'+items.map(it=>
    '<button class="op-nav-i" data-jump="'+it.key+'"'+tipAttr({title:it.name,
      text:it.bad?it.bad+' '+plural(it.bad,['метрика','метрики','метрик'])+' хуже ориентира.'
        :it.good?'Хуже ориентира — ничего, лучше — '+it.good+'.':'Сигналов нет: метрики на уровне или без оценки.'})+'>'+
    '<span class="sig '+it.state+'"></span>'+esc(it.name)+
    (it.bad?'<span class="op-nav-n">'+it.bad+'</span>':'')+'</button>').join('')+'</nav>';
}
function pulseStrip(o){
  const tot=Math.max(1,o.good+o.bad+o.neu);
  const seg=(n,c)=>n?'<i class="'+c+'" style="flex:'+n+'"></i>':'';
  let h='<div class="pulse-strip"><div class="ps-score">'+
    '<div class="ps-h">Сигналы · '+esc(D.CMP.cur)+'</div>'+
    '<div class="ps-num"><b class="g">'+o.good+'</b><span>лучше ориентира</span>'+
      '<b class="r">'+o.bad+'</b><span>хуже</span>'+
      '<b class="n">'+o.neu+'</b><span>на уровне или без оценки</span></div>'+
    '<div class="ps-bar" role="img" aria-label="'+o.good+' лучше, '+o.bad+' хуже, '+o.neu+' без сигнала из '+tot+'">'+
      seg(o.good,'g')+seg(o.bad,'r')+seg(o.neu,'n')+'</div></div>';
  h+='<div class="ps-movers"><div class="ps-h">Главные сдвиги за год<span class="ps-sub">'+esc(D.CMP.yoy)+'</span></div>';
  if(!o.movers.length)h+='<div class="ps-empty">Сдвигов больше ±5% к прошлому году нет.</div>';
  o.movers.forEach(mv=>{
    h+='<button class="ps-mv" data-tab="'+mv.block+'"'+tipAttr({title:mv.name,
        text:'Было '+D.fmtVal(mv.key,mv.prev)+' в '+D.CMP.yoy.replace(/^к /,'')+', стало '+D.fmtVal(mv.key,mv.cur)+'. Клик — открыть блок.'})+'>'+
      '<span class="ps-n">'+esc(mv.name)+'</span>'+
      '<span class="ps-v">'+D.fmtVal(mv.key,mv.prev)+' → <b>'+D.fmtVal(mv.key,mv.cur)+'</b></span>'+
      deltaChip(mv.key,mv.yoy)+'</button>';
  });
  return h+'</div></div>';
}
function trafficLegend(){
  /* два цвета и серый: жёлтого в светофоре нет. «На уровне ±5%» и «без оценки»
     делят один серый — оба означают «повода вмешиваться нет». */
  return '<div class="legend"><span class="sw"><span class="dot" style="background:#bff2cd"></span>лучше базы</span>'+
    '<span class="sw"><span class="dot" style="background:#ffcccc"></span>хуже базы</span>'+
    '<span class="sw"><span class="dot" style="background:#f3f4f6"></span>на уровне ±5% или без оценки: '+
    'больше не значит лучше</span></div>';
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
  return {title:'В разработке'+(stage!=null?' · этап '+stage+' плана':''),
    text:'Источника данных пока нет: в Proteus здесь заглушка — цифра сгенерирована по численности юнита, чтобы было видно, где она будет стоять.'+
      (p?' Источник: '+p.src+'.':''),
    note:p&&p.need&&p.need!=='—'?'Что нужно: '+p.need+'.':'План подключения — «Как читать отчёт» → «План подключения данных».'};
}
function devTag(stage,small){
  return '<span class="dev-tag'+(small?' sm':'')+'"'+tipAttr(devTip(stage))+'>в разработке</span>';
}
/* Плашка вкладки: d = {stage, t — что здесь не настоящее, need — что нужно, part} */
function devNote(d){
  if(!d)return '';
  const p=d.stage!=null?D.devPlan(d.stage):null, need=d.need||(p&&p.need!=='—'?p.need:'');
  return '<div class="dev-note'+(d.part?' part':'')+'"><div class="dev-b">'+
    '<span class="dev-h">'+(d.part?'Частично в разработке':'В разработке')+(d.stage!=null?' · этап '+esc(d.stage)+' плана':'')+'</span>'+
    '<span class="dev-t">'+esc(d.t||'')+'</span>'+
    (need?'<span class="dev-need"><b>Что нужно:</b> '+esc(need)+'</span>':'')+'</div></div>';
}
/* План подключения данных в справке и в сводке готовности: этап · что · откуда · что нужно · сейчас */
function planTable(rows){
  return '<label>План подключения данных</label><div class="fhint">Живое — то, что уже есть в '+
    'hr_structure_overall. Остальное помечено «в разработке» и становится живым по этапам:</div>'+
    '<table class="plan-t"><thead><tr><th>Этап</th><th>Что</th><th>Источник</th><th>Что нужно</th><th>Сейчас</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td>'+esc(r.stage)+'</td><td>'+esc(r.what)+'</td><td>'+esc(r.src)+'</td><td>'+esc(r.need||'')+'</td><td>'+
      (r.now==='живые'?'<span class="live-tag">живые</span>':devTag(r.stage==='—'?null:r.stage))+'</td></tr>').join('')+'</tbody></table>';
}
/* Сводка готовности на One-pager: сколько метрик на живых данных и что
   подключать дальше. Раскрывается в полный план. o = {live, total, next:[plan]} */
function devSummary(o){
  const pc=o.total?Math.round(o.live/o.total*100):0;
  return '<details class="dev-sum"><summary><span class="dev-sum-h">Готовность к живым данным</span>'+
    '<span class="dev-sum-bar" role="img" aria-label="'+pc+'% метрик на живых данных"><i style="width:'+pc+'%"></i></span>'+
    '<span class="dev-sum-n"><b>'+o.live+' из '+o.total+'</b> метрик на живых данных · '+
      '<span class="dev-tag sm-in">в разработке '+(o.total-o.live)+'</span></span>'+
    '<span class="dev-sum-more">план подключения ▾</span></summary>'+
    '<div class="dev-sum-b">'+planTable(o.plan)+'</div></details>';
}

window.TPUI={storyFacts,richText,chapters,storyHead,storyRail,story,devTag,devNote,devSummary,planTable,blockNav,pulseStrip,opStory,obsPanel,esc,plural,tipAttr,tip,deltaChip,momChip,icoExt,rowCaret,allCaret,noCmpMark,byCompany,unitHead,infoDot,NOCMP_HINT,targetCell,aiBlock,aiIco,kpiCard,
  barTable,btGroup,btStack,matrixTable,mixPicker,sliceNote,pct,panel,subTabs,empty,trafficLegend,
  statTable,heatTable,icoOpen,openUnitBtn,searchBox,hlText,unitToggle,splitGut};
})();

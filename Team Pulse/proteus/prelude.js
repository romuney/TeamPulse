/* ============================================================================
   proteus/prelude.js — вход чарта Proteus. Proteus перезапускает скрипт целиком
   на каждый ответ датасета; этот файл выполняется ДО модулей макета:
   1. хост — последний [_echarts_instance_] (контракт кастомного чарта, как в
      HRBP HUB): холст прячем, корень отчёта — наш div поверх, он же и
      прокручивается; корень прошлого прогона снимаем;
   2. стили и разметку index.html кладём строками из сборки (TP_CSS, TP_HTML);
   3. слушатели прошлого прогона снимаем — иначе каждый ответ добавлял бы ещё
      один обработчик клика, и одно нажатие срабатывало бы несколько раз;
   4. window.TP_REAL — модель из ответа (real.js), window.TP_ENV — окружение
      для app.js: корень, хранилище между прогонами, слушатели, кросс-фильтр.
   5. документ и хост — overflow:hidden, window.onerror пропускает «ResizeObserver loop»
      (иначе песочница гасит чарт, SB-03 гайда).
   data и applyCrossFilter — то, что Proteus даёт скрипту чарта.
   ========================================================================== */
(function(){
'use strict';
const ST=window.__pvtState||(window.__pvtState={});
const store=ST.tp||(ST.tp={});
(store.listeners||[]).forEach(l=>{try{l.t.removeEventListener(l.type,l.fn,l.opt)}catch(e){}});
store.listeners=[];

const hosts=document.querySelectorAll('[_echarts_instance_]');
const host=hosts.length?hosts[hosts.length-1]:document.body;
/* песочница Proteus гасит чарт на ЛЮБУЮ ошибку окна, и на безвредное «ResizeObserver loop…»
   (полосы прокрутки Windows при сужении iframe): документ и хост не прокручиваются — своя
   прокрутка только в .tp-overlay; window.onerror пропускает мимо песочницы только это событие
   (гайд proteus-playbook, SB-03; так у detail_list с 06.10) */
host.style.overflow='hidden';
document.documentElement.style.overflow='hidden';
if(document.body)document.body.style.overflow='hidden';
const onErr0=window.onerror;
if(!(onErr0&&onErr0.__roSkip)){                 /* перезапуск скрипта: второй раз не оборачивать */
  const onErr=function(msg){
    if(/ResizeObserver loop/i.test(String(msg)))return true;
    return typeof onErr0==='function'?onErr0.apply(this,arguments):false;
  };
  onErr.__roSkip=true;
  window.onerror=onErr;
}
Array.prototype.forEach.call(host.querySelectorAll('canvas'),c=>{c.style.display='none'});
Array.prototype.forEach.call(document.querySelectorAll('.tp-overlay, body > .tip'),
  n=>{if(n.parentNode)n.parentNode.removeChild(n)});

let css=document.querySelector('style[data-tp]');
if(!css){
  css=document.createElement('style');
  css.setAttribute('data-tp','1');
  (document.head||document.body).appendChild(css);
}
css.textContent=TP_CSS;

const root=document.createElement('div');
root.className='tp-overlay';
root.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;overflow:auto;'+
  'z-index:10;box-sizing:border-box;';
if(host!==document.body&&getComputedStyle(host).position==='static')host.style.position='relative';
host.appendChild(root);
root.innerHTML=TP_HTML;
/* 27.10-в, п. 22: высота плитки дашборда — левая навигация по ней, а не по окну браузера (100vh больше плитки, и низ
   навигации уходил за край); прокручивается содержимое, навигация видна целиком */
const vh=()=>root.style.setProperty('--vh',root.clientHeight+'px');
vh();window.addEventListener('resize',vh);store.listeners.push({t:window,type:'resize',fn:vh});

/* 10.11 (владелец: «заходим на дашборд — пустое место»): корень отчёта стоит и непрозрачен — говорим странице «отчёт
   отрисован». Другого канала к родителю у песочницы нет: шлём PNG 1×1 с маркером в канал скриншотов, Proteus кладёт его
   в img.echarts-plugin ячейки, и CSS борда (файл 4, блок 4) по маркеру убирает значок загрузки Proteus поверх отчёта —
   дальше ожидание показывает сам отчёт (.tp-load). Маркер — 12 байт ASCII = 16 знаков base64, тот же, что в
   proteus/board_css.js; байты PNG дополнены до кратности 3, чтобы маркер стоял в строке как есть (гайд SB-11).
   Повтор через 0,4 и 1,5 с — страховка: платформа может записать в ту же картинку свой снимок (SB-14) */
const sayReady=function(){
  try{
    if(!window.parent||window.parent===window||typeof btoa!=='function')return;
    let raw=atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    while(raw.length%3)raw+='\0';
    const url='data:image/png;base64,'+btoa(raw+'TP-HUB-READY');
    window.parent.postMessage({type:'ECHARTS_UPDATE_DATA_URL',dataUrl:url,payload:{dataUrl:url}},'*');
  }catch(e){}
};
sayReady();
(store.readyT||[]).forEach(clearTimeout);
store.readyT=[setTimeout(sayReady,400),setTimeout(sayReady,1500)];

window.TP_REAL=window.TPREAL.build(typeof data!=='undefined'?data:[]);
/* поставка 69: нет зоны доступа — экран «Нет доступа», дальше отчёт не собирается (tpStop ловит обёртка сборки) */
if(window.TP_REAL.noAccess){
  root.innerHTML='<div class="tp-noacc"><b>Нет доступа к отчёту</b><span>Отчёт показывает подразделения, где вы '+
    'руководитель. Если доступ нужен — напишите владельцу отчёта.</span></div>';
  throw {tpStop:1};
}
window.TP_ENV={root:root,scroller:root,store:store,
  on(t,type,fn,opt){t.addEventListener(type,fn,opt);store.listeners.push({t:t,type:type,fn:fn,opt:opt})},
  /* маска целиком (юнит + фильтры), пустых значений не шлём — как в HRBP HUB */
  emit(mask){
    if(typeof applyCrossFilter!=='function')return false;
    sayReady();                          /* перед запросом: маркер на месте, значок Proteus поверх отчёта не встанет */
    applyCrossFilter(mask);
    return true;
  }};
})();

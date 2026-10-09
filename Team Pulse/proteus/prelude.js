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

window.TP_REAL=window.TPREAL.build(typeof data!=='undefined'?data:[]);
window.TP_ENV={root:root,scroller:root,store:store,
  on(t,type,fn,opt){t.addEventListener(type,fn,opt);store.listeners.push({t:t,type:type,fn:fn,opt:opt})},
  /* маска целиком (юнит + фильтры), пустых значений не шлём — как в HRBP HUB */
  emit(mask){
    if(typeof applyCrossFilter!=='function')return false;
    applyCrossFilter(mask);
    return true;
  }};
})();

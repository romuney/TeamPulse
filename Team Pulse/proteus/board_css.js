/* ============================================================================
   proteus/board_css.js — блок 4 «Загрузка» в CSS борда (файл 4 поставки): node proteus/board_css.js

   Загрузка отчёта на борде — из наших огоньков (10.11, владелец: «заходим на дашборд — пустое место, для пользователя
   ничего не происходит; можем ли сделать из наших огонёчков?»). Рисунок — тот же, что карточка ожидания внутри отчёта
   (styles.css .tp-load): три огонька по очереди и три подписи. Он собран в один SVG с анимацией и лежит в CSS борда
   переменной --tp-load; картинки огоньков берём из mascot.js (WebP 112 px, 3–4 КБ каждая).

   Скрипт пересобирает только блок 4 — от строки «==== 4. Загрузка» до строки «==== 6. Поля борда». Остальной файл
   правится руками. Менять рисунок или подписи — здесь, затем запустить скрипт.
   ========================================================================== */
const fs=require('fs'), path=require('path'), dir=path.join(__dirname,'..');
const OUT=path.join(dir,'Поставка — TeamPulse Hub','4. CSS борда (дописать в конец).css');
const ID='814002';
/* маркер «отчёт отрисован» — 12 байт ASCII = 16 знаков base64 (гайд SB-11); тот же — в proteus/prelude.js */
const MARK=Buffer.from('TP-HUB-READY').toString('base64');

const ms=fs.readFileSync(path.join(dir,'mascot.js'),'utf8');
const i0=ms.indexOf('const IMG='), i1=ms.indexOf('};',i0);
const IMG=eval('('+ms.slice(i0+'const IMG='.length,i1+1)+')');
const W=240, H=120, PX=52, GAP=10, X0=(W-PX*3-GAP*2)/2;
const img=(k,i)=>'<image class="f'+(i?' f'+(i+1):'')+'" x="'+(X0+i*(PX+GAP))+'" y="10" width="'+PX+'" height="'+PX+
  '" href="data:image/webp;base64,'+IMG[k]+'"/>';
const cap=(t,i)=>'<text class="c'+(i?' c'+(i+1):'')+'" x="'+W/2+'" y="98">'+t+'</text>';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><style>'+
  '.f{opacity:0;transform-box:fill-box;transform-origin:50% 100%;animation:p 3s infinite both}.f2{animation-delay:.45s}.f3{animation-delay:.9s}'+
  '.c{opacity:0;font:700 15px Arial,Helvetica,sans-serif;fill:#1f1f1f;text-anchor:middle;animation:c 6s infinite both}.c2{animation-delay:2s}.c3{animation-delay:4s}'+
  '@keyframes p{0%{opacity:0;transform:translateY(10px) scale(.4)}10%{opacity:1;transform:translateY(-8px) scale(1.12)}16%,78%{opacity:1;transform:none}88%,100%{opacity:0;transform:scale(.85)}}'+
  '@keyframes c{0%{opacity:0}5%,28%{opacity:1}33%,100%{opacity:0}}'+
  '</style>'+['setup','base','ok'].map(img).join('')+
  ['Собираем данные…','Считаем метрики…','Готовим выводы…'].map(cap).join('')+'</svg>';
const uri='data:image/svg+xml;base64,'+Buffer.from(svg,'utf8').toString('base64');
const HOLD='.dashboard-component-chart-holder:is(.dashboard-chart-id-'+ID+', :has(#chart-id-'+ID+'))';
const CELL='.dashboard-chart-id-'+ID;

const block=`/* ==== 4. Загрузка ==================================================================================================
   Пока отчёта нет, на его месте — белая карточка и наши огоньки с подписями: тот же рисунок, что карточка ожидания
   внутри отчёта. Блок собирает скрипт proteus/board_css.js — длинную строку с рисунком руками не править.
   Как устроено:
     · рисунок лежит ФОНОМ самой ячейки (холдера): её размер задан рядом борда и не зависит от того, что Proteus
       положил внутрь на время загрузки. Фон под отчётом и виден всё время, пока отчёт не отрисован; отрисованный
       отчёт закрывает его сам — условий «когда показать» нет, поэтому пустого места не бывает;
     · значок загрузки Proteus: пока в ячейке нет iframe — спрятан (огоньки уже на фоне); iframe есть, а отчёт ещё
       не отрисован — показан тем же рисунком поверх iframe;
     · когда отчёт отрисован, он шлёт маркер «готов» (канал скриншотов, ${MARK}) — значок Proteus поверх
       отчёта больше не нужен: у отчёта своя карточка ожидания;
     · заглушку Proteus «Не было получено данных…» до появления iframe прячем, как раньше. Ошибка запроса видна. */
${HOLD} {
  --tp-load: url("${uri}");
  background: #fff var(--tp-load) center / ${W}px ${H}px no-repeat !important;
}
${CELL}:not(:has(iframe)) .slice_container {
  visibility: hidden !important;
}
${CELL}:not(:has(iframe)) img.loading,
${CELL}:not(:has(iframe)) [aria-label="Loading"] {
  display: none !important;
}
${HOLD}:has(iframe) .chart-container {
  position: relative !important;
}
${HOLD}:has(iframe) img.loading,
${HOLD}:has(iframe) [aria-label="Loading"] {
  content: var(--tp-load) !important;
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  width: ${W}px !important;
  height: ${H}px !important;
  margin: -${H/2}px 0 0 -${W/2}px !important;
  padding: 0 !important;
  transform: none !important;
  object-fit: contain !important;
  background: #fff !important;
  z-index: 99 !important;
}
${CELL}:has(img.echarts-plugin[src*="${MARK}"]) img.loading,
${CELL}:has(img.echarts-plugin[src*="${MARK}"]) [aria-label="Loading"] {
  display: none !important;
}

`;
let css=fs.readFileSync(OUT,'utf8');
const a=css.indexOf('/* ==== 4. Загрузка'), b=css.indexOf('/* ==== 6. Поля борда');
if(a<0||b<0||b<a)throw new Error('в файле 4 нет границ блока 4');
css=css.slice(0,a)+block+css.slice(b);
fs.writeFileSync(OUT,css);
console.log('блок 4 собран: рисунок '+Math.round(uri.length/1024*10)/10+' КБ, файл '+Math.round(Buffer.byteLength(css)/1024*10)/10+' КБ, маркер '+MARK);

/* ============================================================================
   proteus/build.js — сборка чарта Proteus из исходников макета.

     cd "Team Pulse/proteus" && npm install && node build.js

   Выход — «Поставка — TeamPulse Hub/3. Proteus — чарт TeamPulse Hub.js»: один
   файл, который владелец вставляет в чарт ECHARTS. Исходник один — макет: те же
   data.js, draw.js, ui.js, экраны и app.js, что на GitHub Pages; в Proteus они
   работают в режиме пробника (proteus/real.js + prelude.js).

   Шаги:
   1. styles.css и разметка index.html (без <script>) — строками TP_CSS и TP_HTML;
   2. real.js → prelude.js → модули макета в порядке index.html, каждый — своей
      функцией: верхнеуровневые имена файлов не встречаются друг с другом;
   3. всё — в try: упал модуль — в хосте видно сообщение, а не пустая ячейка;
   4. Babel → ES5 (кастомный чарт Proteus — только ES5, как у HRBP HUB),
      комментарии исходников вырезаются — в них подробности для разработки;
   5. проверка: разбор acorn как ES5, нет запрещённого (getElementById, console,
      eval), в конце — глобальный option с пустым scatter (контракт Proteus);
   6. сжатие terser (min.cjs — копия kit/min.cjs гайда proteus-playbook, terser 5.51.2):
      без комментариев и пробелов, короткие локальные имена, строка TP_CSS — без
      комментариев и лишних пробелов; верхний уровень и option не трогаются. Proteus
      шлёт код чарта в form_data.jsx КАЖДОГО запроса данных (отправка у владельца
      ≈50 КБ/с), поэтому у сборки бюджет BUDGET_KIB — больше него сборка не пишется.
      Сборку проверяет min.cjs (ES5, option на верхнем уровне, имена верхнего
      уровня на месте, нет кода из строки).
   ========================================================================== */
const fs=require('fs'), path=require('path');
const babel=require('@babel/core'), acorn=require('acorn');
const MIN=require('./min.cjs');
/* бюджет сборки, КиБ (09.10: без сжатия 524, сжатая 333, из них картинки маскота ≈72 — base64 WebP в mascot.js).
   12.10, итерация 32: 340 → 370. История по главам (story.js) — почти целиком русский текст выводов,
   строки terser не сжимает: story.js +25 КиБ, со стилями и компонентами сборка 333 → 367 КиБ.
   Цена — ≈+0,7 с отправки на запрос при 50 КБ/с (код чарта едет в каждом POST, CJ-21).
   12.10, правки по фидбэку: 370 → 390. «Зачем смотреть / что делать» у 24 глав и словарь
   терминов — ещё ≈14 КиБ текста, сборка 381 КиБ (≈7,6 с на запрос при 50 КБ/с). Если вес
   станет важнее — первый кандидат на сжатие картинки маскота (≈72 КиБ base64 в mascot.js).
   13.10: 390 → 400. «Что видно» по механике HRBP HUB на One-pager (insights.js: факты метрики
   и сводка «Что видно в данных» — снова русский текст) и полотна «год к году» для баров,
   панелей и дивергента. Скользящие графики «12 мес» из движка удалены (≈−7 КиБ), итог —
   ≈393 КиБ, +0,2 с на запрос при 50 КБ/с.
   14.10, «в разработке» и портрет команды: 400 → 420. План подключения (D.DEV_PLAN) теперь общий
   для макета и пробника — дубль PLAN из real.js удалён (−2 КиБ), но плашки вкладок с «что нужно»,
   сводка готовности и полосатые стили — +13 КиБ: ≈406 КиБ.
   14.10, «Портрет команды»: 420 → 430. Глава портрета — шесть разделов со своими видами графиков
   (HTML, не SVG-движок) и выводами — +17 КиБ, сборка ≈423 КиБ (≈8,5 с на запрос при 50 КБ/с, +0,3 с).
   15.10: бары потоков, «ежики» пар, два обзора структуры вместо портрета и трёх табличных глав — 426 КиБ.
   19.10, портрет на настоящих значениях: 430 → 435. Пилюля на любое число ступеней (цвета между
   опорными, ключ с долей базы), порядок «Junior+» и «Стаж менее 3 мес», «<1%» — +2,2 КиБ; мёртвые
   правила CSS (toolbar, sr-only, no-insight и др.) убраны — −1,2 КиБ: сборка 431 КиБ.
   19.10, окно настройки как в HRBP HUB: 435 → 445. Дерево юнитов с поиском по логину
   руководителя, числа «сколько попадёт в выбор» у строк и кнопок фильтров (fd справочника),
   тултипы в стиле борда — +8 КиБ: сборка ≈439 КиБ (+0,15 с на запрос при 50 КБ/с). Дальше
   первый кандидат на сжатие — картинки маскота (≈72 КиБ base64 в mascot.js).
   20.10, методология HR и фильтр «Численность»: 445 → 450. «Как считается» у девяти метрик
   (подсказки, словарь «Пульс»), тип численности в окне настройки, шапке и режиме макета —
   ≈+6 КиБ: сборка ≈445 КиБ.
   20.10, «сначала выводы» (главная — карточки выводов, вкладка блока — вывод и «где это
   происходит»): 450 → 465. Движок карточек, мини-графики и стили — ≈+18 КиБ, сняты плашки
   «Что видно в данных», «Главное в блоке» и полоса «Пульс команды» — ≈−4 КиБ: сборка ≈461 КиБ
   (+0,3 с на запрос к 445). Сжатие картинок маскота — всё ещё первый кандидат. Поставка 41: KPI-карточки
   главной сняты — ≈459 КиБ.
   20.10, текущий незакрытый месяц (как в HRBP HUB): 465 → 470. Дата данных, пунктир и «1–19 окт.»
   у вызревающих метрик, выводы по последнему закрытому, даты начала и конца в водопаде — ≈+5 КиБ:
   сборка ≈467 КиБ (+0,1 с на запрос). Сжатие картинок маскота — по-прежнему первый кандидат.
   21.10, поставка 50 (метрики из прод-ноутбуков HQ и УС): 470 → 480. Вакансии, Non-regrettable, AI,
   коридор годовых целей HQ, вакансии в разрезах и найм по источникам — ≈+7 КиБ: сборка ≈474 КиБ.
   22.10, поставка 61 (тип численности — выпадающий список всех типов): 480 → 490. Список, пресеты
   «Активные» и «Все типы», набор в адресе и в эхе фильтров — ≈+5 КиБ: сборка ≈484 КиБ (+0,1 с на запрос).
   22.10, поставка 62 (правки интерфейса 22.10): 490 → 500. Вкладка «Кто и где ходит», полка срезов, регион,
   специализации внутри стрима, блоки мониторинга — ≈+5 КиБ: сборка ≈489 КиБ.
   22.10, поставка 63 (детализация переводов): 500 → 515. Окно событий, сверка с отчётом, выгрузка CSV, генератор
   событий макета — ≈+12 КиБ: сборка ≈501 КиБ (+0,2 с на запрос).
   26.10, поставка 67 (итерация 26.10-б и подпись инициаторов у причин): 515 → 516 — ≈+0,02 с на запрос.
   27.10, поставка 68 (15 правок по ревью критиков: закрытый месяц в текстах глав, «Где это происходит» долей разницы,
   доля группы в «Кто уходит?», прочерк долей у команд меньше 30 человек, подсказки неполного месяца): 516 → 520 —
   ≈+0,08 с на запрос. Картинки маскота уже сжаты (WebP q≈80): пересжатие даёт меньше 2 КиБ.
   27.10, итерация 27.10-в (22 пункта: T-рост по «Росту» тремя вкладками, нарушения брони по городам, накопительная по
   инициатору, «Остальные» раскрываются везде, доступ по зоне из поставки 69): 520 → 524 — ≈+0,08 с на запрос. Детализацию
   переводов (−12 КиБ) и прежние «Заявки и T@T» со «Статусами по грейдам» уже вычистили. */
const BUDGET_KIB=524;
const dir=path.join(__dirname,'..');
const OUT=path.join(dir,'Поставка — TeamPulse Hub','3. Proteus — чарт TeamPulse Hub.js');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');

/* порядок как в index.html, плюс модель и вход Proteus впереди */
const FILES=['proteus/real.js','proteus/prelude.js','data.js','draw.js','ui.js','mascot.js','insights.js','story.js',
  'screens/_block.js','screens/structure.js','screens/movement.js','screens/turnover.js','screens/hiring.js',
  'screens/tgrowth.js','screens/monitor.js','screens/office.js','screens/ai.js','screens/onepager.js','app.js'];

const index=read('index.html');
const body=index.slice(index.indexOf('<body>')+6,index.lastIndexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g,'')
  .replace(/<!--[\s\S]*?-->/g,'')
  .replace(/\n\s*\n+/g,'\n').trim();
const css=read('styles.css');

const HEAD=`// ============================================================================
// TeamPulse Hub — чарт Proteus (тип ECHARTS), пробник. СОБРАН АВТОМАТИЧЕСКИ:
// не правьте здесь — правка живёт в исходниках макета (папка «Team Pulse»),
// сборка: cd "Team Pulse/proteus" && node build.js.
// Данные — датасет teampulse_hub (файл 2, схема таблицы 15.10.2026). «Измерения» чарта —
// все колонки датасета: role, id, pid, lvl, nm, kids, j, m_hc, m_act, m_avg, m_hire, m_fire,
// m_reg, m_tin, m_tout, m_pnor, m_plow, m_phig, m_pgry, mx
// (+ необязательные m_wday, m_ovis, m_gapr, m_gdec). Метрик нет, сортировки нет.
// Визуализация — HTML и SVG поверх хоста ECharts; холст пустой (option ниже).
// Кросс-фильтры чарт шлёт сам себе: unit_f и staff_f (покраски и IT в таблице с 15.10 нет).
// ============================================================================
`;
let src='var TP_CSS='+JSON.stringify(css)+';\nvar TP_HTML='+JSON.stringify(body)+';\n'+
  'try{\n'+FILES.map(f=>'/* '+f+' */\n(function(){\n'+read(f)+'\n})();').join('\n')+
  '\n}catch(err){if(!(err&&err.tpStop)){\n'+
  '  var _h=document.querySelectorAll("[_echarts_instance_]");\n'+
  '  var _box=_h.length?_h[_h.length-1]:document.body, _m=document.createElement("div");\n'+
  '  _m.style.cssText="position:absolute;inset:0;padding:24px;font:14px Arial,sans-serif;color:#d11414;background:#fff;z-index:20";\n'+
  '  _m.textContent="TeamPulse Hub: ошибка чарта — "+(err&&err.message?err.message:String(err));\n'+
  '  _box.appendChild(_m);\n'+
  '}}\n';

const out=babel.transformSync(src,{
  sourceType:'script',comments:false,compact:false,babelrc:false,configFile:false,
  presets:[[require.resolve('@babel/preset-env'),{targets:{ie:'11'},modules:false,useBuiltIns:false}]]
}).code;
/* контракт Proteus: option — глобальный, последним выражением, не мутируется */
const tail='\n// ---------- Пустой option: холст ECharts не используется ----------\n'+
  'option = { animation: false, xAxis: { show: false, type: "value" }, yAxis: { show: false, type: "value" },\n'+
  '  series: [{ type: "scatter", data: [] }] };\n';
const result=HEAD+out+tail;

/* проверки собранного */
const fail=[];
try{acorn.parse(result,{ecmaVersion:5,sourceType:'script'})}
catch(e){fail.push('не ES5: '+e.message)}
[[/\bgetElementById\b/,'getElementById'],[/\bconsole\./,'console'],[/\beval\(/,'eval'],
 [/=>/,'стрелочная функция'],[/`/,'шаблонная строка']].forEach(([re,name])=>{
  const body=result.replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''");
  if(re.test(body))fail.push('в коде есть '+name);
});
if(!/\noption = \{[^\n]*\n[^\n]*\};\n$/.test(result))fail.push('option не последний');
if(fail.length){console.error('СБОРКА НЕ ПРОШЛА:\n  '+fail.join('\n  '));process.exit(1)}

/* 6. сжатие: шапка — комментарием сборки, код — terser, TP_CSS — cssMin */
const head=HEAD.replace(/^\/\/ ?/gm,'').replace(/^=+\n|\n=+\n$/g,'').trim();
MIN.minifyChart(out+tail,head,{cssVars:['TP_CSS']}).then(r=>{
  const code=r.code, v=MIN.verify(code,out+tail);
  if(!/(^|[;}\n])option=\{[^]*\};?\n$/.test(code))v.fails.push('option не последний после сжатия');
  if(Buffer.byteLength(code)>BUDGET_KIB*1024)v.fails.push('больше бюджета '+BUDGET_KIB+' КиБ: '+(Buffer.byteLength(code)/1024).toFixed(1)+' КиБ');
  v.warns.forEach(t=>console.error('  ! '+t));
  if(!v.ok||v.fails.length){console.error('СЖАТИЕ НЕ ПРОШЛО:\n  '+v.fails.join('\n  '));process.exit(1)}
  fs.writeFileSync(OUT,code);
  const kb=n=>(n/1024).toFixed(0)+' КиБ';
  console.log('чарт собран: '+path.relative(dir,OUT)+' — '+kb(Buffer.byteLength(code))+
    ' (до сжатия '+kb(Buffer.byteLength(result))+'; '+r.notes.join('; ')+', разметка '+kb(Buffer.byteLength(body))+
    '; бюджет '+BUDGET_KIB+' КиБ, ≈'+(Buffer.byteLength(code)/1024/50).toFixed(1)+' с отправки на запрос при 50 КБ/с), ES5 и сборка проверены');
}).catch(e=>{console.error('СЖАТИЕ НЕ ПРОШЛО: '+(e.message||e));process.exit(1)});

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
/* бюджет сборки, КиБ (09.10: без сжатия 524, сжатая 333, из них картинки маскота ≈72 — base64 WebP в mascot.js) */
const BUDGET_KIB=340;
const dir=path.join(__dirname,'..');
const OUT=path.join(dir,'Поставка — TeamPulse Hub','3. Proteus — чарт TeamPulse Hub.js');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');

/* порядок как в index.html, плюс модель и вход Proteus впереди */
const FILES=['proteus/real.js','proteus/prelude.js','data.js','draw.js','ui.js','mascot.js','insights.js',
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
// Данные — датасет teampulse_hub (файл 2). «Измерения» чарта — все колонки
// датасета: role, id, pid, lvl, nm, kids, j, m_hc, m_act, m_avg, m_hire, m_fire,
// m_reg, m_tin, m_tout, m_plow, m_prat. Метрик нет, сортировки нет.
// Визуализация — HTML и SVG поверх хоста ECharts; холст пустой (option ниже).
// Кросс-фильтры чарт шлёт сам себе: unit_f, paint_f, it_f, staff_f.
// ============================================================================
`;
let src='var TP_CSS='+JSON.stringify(css)+';\nvar TP_HTML='+JSON.stringify(body)+';\n'+
  'try{\n'+FILES.map(f=>'/* '+f+' */\n(function(){\n'+read(f)+'\n})();').join('\n')+
  '\n}catch(err){\n'+
  '  var _h=document.querySelectorAll("[_echarts_instance_]");\n'+
  '  var _box=_h.length?_h[_h.length-1]:document.body, _m=document.createElement("div");\n'+
  '  _m.style.cssText="position:absolute;inset:0;padding:24px;font:14px Arial,sans-serif;color:#d11414;background:#fff;z-index:20";\n'+
  '  _m.textContent="TeamPulse Hub: ошибка чарта — "+(err&&err.message?err.message:String(err));\n'+
  '  _box.appendChild(_m);\n'+
  '}\n';

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
  if(Buffer.byteLength(code)>BUDGET_KIB*1024)v.fails.push('больше бюджета '+BUDGET_KIB+' КиБ: '+(Buffer.byteLength(code)/1024).toFixed(0)+' КиБ');
  v.warns.forEach(t=>console.error('  ! '+t));
  if(!v.ok||v.fails.length){console.error('СЖАТИЕ НЕ ПРОШЛО:\n  '+v.fails.join('\n  '));process.exit(1)}
  fs.writeFileSync(OUT,code);
  const kb=n=>(n/1024).toFixed(0)+' КиБ';
  console.log('чарт собран: '+path.relative(dir,OUT)+' — '+kb(Buffer.byteLength(code))+
    ' (до сжатия '+kb(Buffer.byteLength(result))+'; '+r.notes.join('; ')+', разметка '+kb(Buffer.byteLength(body))+
    '; бюджет '+BUDGET_KIB+' КиБ, ≈'+(Buffer.byteLength(code)/1024/50).toFixed(1)+' с отправки на запрос при 50 КБ/с), ES5 и сборка проверены');
}).catch(e=>{console.error('СЖАТИЕ НЕ ПРОШЛО: '+(e.message||e));process.exit(1)});

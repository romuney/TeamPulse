/* Isolated experimental build. Writes only the two charts beside this file.
   Shared sources are read-only; exact patch anchors fail on incompatible updates. */
const fs=require('fs'), path=require('path');
const dep=require('module').createRequire(path.join(__dirname,'..','proteus','build.js'));
const babel=dep('@babel/core'), acorn=dep('acorn'), MIN=dep('./min.cjs');
const patches=require('./src/patches.cjs');
const BUDGET_KIB = 652;
const dir=path.join(__dirname,'..');
const OUT=path.join(dir,'Поставка — TeamPulse Hub','3. Proteus — чарт TeamPulse Hub.js');
const read0=f=>patches.read(dir,f);
/* 11.11, поставка «по частям»: код и стили между метками-комментариями «split:» … «:split» (ожидание частей ответа) нужны только
   главному чарту дашборда из нескольких чартов; из сборки одного чарта они вырезаются — её вес не растёт */
let SPLIT=false;
const read=f=>SPLIT?read0(f):read0(f).replace(/\/\*split:\*\/[\s\S]*?\/\*:split\*\//g,'');

/* порядок как в index.html, плюс модель и вход Proteus впереди */
const FILES=['proteus/real.js','proteus/prelude.js','data.js','draw.js','ui.js','mascot.js','insights.js','story.js',
  'screens/_block.js','screens/structure.js','screens/movement.js','screens/turnover.js','screens/hiring.js',
  'screens/tgrowth.js','screens/monitor.js','screens/office.js','screens/ai.js','screens/onepager.js','app.js'];

/* 31.10, поставка 85 (вес чарта): в Proteus модель данных (window.TP_REAL) и окружение (window.TP_ENV) есть ВСЕГДА —
   их кладёт prelude.js до модулей (нет доступа — сборка останавливается раньше). Проверки «макет или Proteus» в исходниках
   (REAL, D.REAL, ENV) в сборке заменяются константой «да», и сжатие выбрасывает демо-ветки и генератор макета целиком.
   Макет и smoke.js работают на исходниках как раньше. Подставляются только условия: if(X), X?…:…, !X, X&&…;
   обращения к полям (REAL.months, ENV.scroller) и объявления не трогаются. */
function fold(src){
  let n=0;const r=(re,to)=>{src=src.replace(re,(...m)=>{n++;return typeof to==='function'?to(...m):to})};
  ['(?:D\\.)?REAL','ENV'].forEach(nm=>{
    r(new RegExp('if\\(\\s*'+nm+'\\s*\\)','g'),'if(!0)');
    r(new RegExp('!'+nm+'(?![\\w.$])','g'),'!1');
    r(new RegExp('(^|[^\\w.$])'+nm+'(?=\\s*(?:\\?(?!\\.)|&&))','g'),(m,pre)=>pre+'!0');
  });
  fold.n=(fold.n||0)+n;
  return src;
}
/* 31.10, поставка 89 (итог за период, вес чарта): в неймспейсах window.TP… (TPDATA, TPDRAW, TPUI, …) и SC.экран
   в сборке остаются только имена, к которым обращаются модули чарта (.имя); остальное — помощники макета и smoke.js,
   сжатие выбрасывает их вместе с кодом. Макет и smoke.js работают на исходниках как раньше. */
let SRC={};
function prune(src){
  return src.replace(/(window\.TP[A-Z]+|SC\.[a-z]+)=\{([^{}]*)\};/g,(all,ns,body)=>{
    const rest=FILES.map(f=>SRC[f]).join('\n').replace(all,'');
    const keep=body.split(',').filter(e=>{const n=e.trim();
      if(!/^[A-Za-z_$][\w$]*$/.test(n))return true;
      const ok=new RegExp('\\.'+n+'(?![\\w$])').test(rest);if(!ok)prune.n=(prune.n||0)+1;return ok});
    return ns+'={'+keep.join(',')+'};';
  });
}
const index=read0('index.html');
const body=index.slice(index.indexOf('<body>')+6,index.lastIndexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g,'')
  .replace(/<!--[\s\S]*?-->/g,'')
  .replace(/\n\s*\n+/g,'\n').trim();


const HEAD=`// ============================================================================
// TeamPulse Hub — чарт Proteus (тип ECHARTS), пробник. СОБРАН АВТОМАТИЧЕСКИ:
// не правьте здесь — правка живёт в исходниках макета (папка «Team Pulse»),
// сборка: node "Team Pulse/Поставка — TeamPulse Hub (по частям)/build.cjs".
// Данные — датасет teampulse_hub (файл 2, схема таблицы 15.10.2026). «Измерения» чарта —
// все колонки датасета: role, id, pid, lvl, nm, kids, j, m_hc, m_act, m_avg, m_hire, m_fire,
// m_reg, m_tin, m_tout, m_pnor, m_plow, m_phig, m_pgry, mx
// (+ необязательные m_wday, m_ovis, m_gapr, m_gdec). Метрик нет, сортировки нет.
// Визуализация — HTML и SVG поверх хоста ECharts; холст пустой (option ниже).
// Кросс-фильтры чарт шлёт сам себе: unit_f и staff_f (покраски и IT в таблице с 15.10 нет).
// ============================================================================
`;
/* 11.11, поставка «по частям»: тот же отчёт вторым выходом — главный чарт дашборда из нескольких чартов. Модули те же;
   отличие — обёртка: отчёт целиком лежит в функции TP_RUN(data), а proteus/parts.js собирает ответ из частей, которые
   присылают чарты-загрузчики (proteus/loader.js), и вызывает TP_RUN на каждую догрузившуюся часть. Код загрузчика — третий
   выход (сжатый loader.js). Папка — «Поставка — TeamPulse Hub (по частям)»; датасеты частей и остальное пишет
   stand/mk_split.py. Бюджет главного чарта — свой (BUDGET_SPLIT_KIB): parts.js, экран ожидания вкладки и значки загрузки ≈ +10 КиБ к сборке одного
   чарта; этот код едет на сервер только при открытии дашборда — после выбора юнита или фильтра главный чарт не запрашивается. */
const SPLIT_DIR=path.join(dir,'Поставка — TeamPulse Hub (по частям)');
const OUT_MAIN=path.join(SPLIT_DIR,'3. Proteus — главный чарт TeamPulse Hub.js');
const OUT_LOADER=path.join(SPLIT_DIR,'3а. Proteus — чарт-загрузчик (один код на четыре чарта).js');
const BUDGET_SPLIT_KIB = BUDGET_KIB + 12;
const HEAD_MAIN=`// ============================================================================
// TeamPulse Hub — ГЛАВНЫЙ чарт дашборда «по частям» (тип ECHARTS). СОБРАН АВТОМАТИЧЕСКИ:
// не правьте здесь — правка живёт в исходниках макета (папка «Team Pulse»),
// сборка: node "Team Pulse/Поставка — TeamPulse Hub (по частям)/build.cjs".
// Датасет главного чарта — часть dict (справочник узлов). Остальные части (core, people, flow, aux)
// присылают чарты-загрузчики того же дашборда по каналу postMessage (proteus/parts.js).
// «Измерения» чарта — все колонки датасета: role, id, pid, lvl, nm, kids, j, ms, mx. Метрик и сортировки нет.
// Кросс-фильтры главный чарт шлёт загрузчикам (области — JSON дашборда из поставки), себя не фильтрует.
// ============================================================================
`;
const ERR_TAIL='\n}catch(err){if(!(err&&err.tpStop)){\n'+
  '  var _h=document.querySelectorAll("[_echarts_instance_]");\n'+
  '  var _box=_h.length?_h[_h.length-1]:document.body, _m=document.createElement("div");\n'+
  '  _m.style.cssText="position:absolute;inset:0;padding:24px;font:14px Arial,sans-serif;color:#d11414;background:#fff;z-index:20";\n'+
  '  _m.textContent="TeamPulse Hub: ошибка чарта — "+(err&&err.message?err.message:String(err));\n'+
  '  _box.appendChild(_m);\n'+
  '}}\n';
const mods=()=>FILES.map(f=>{
  const code=/^proteus\//.test(f)?read(f):prune(fold(read(f)));
  return f==='data.js'?'function TP_REBUILD_DATA(){\n'+code+'\n}\nTP_REBUILD_DATA();'
    :'/* '+f+' */\n(function(){\n'+code+'\n})();';
}).join('\n');
/* контракт Proteus: option — глобальный, последним выражением, не мутируется */
const tail='\n// ---------- Пустой option: холст ECharts не используется ----------\n'+
  'option = { animation: false, xAxis: { show: false, type: "value" }, yAxis: { show: false, type: "value" },\n'+
  '  series: [{ type: "scatter", data: [] }] };\n';

function make(split){
  SPLIT=split;SRC={};FILES.forEach(f=>{SRC[f]=read(f)});prune.n=0;
  const css=read('styles.css');
  const HD=split?HEAD_MAIN:HEAD, OUTF=split?OUT_MAIN:OUT, BUD=split?BUDGET_SPLIT_KIB:BUDGET_KIB;
  /* один чарт: модули выполняются сразу; «по частям»: модули — тело TP_RUN(data), запускает parts.js */
  let src='var TP_CSS='+JSON.stringify(css)+';\nvar TP_HTML='+JSON.stringify(body)+';\n'+(split
    ?'function TP_RUN(data){\ntry{\n'+mods()+ERR_TAIL+'}\ntry{\n/* proteus/parts.js */\n(function(){\n'+read('proteus/parts.js')+'\n})();'+ERR_TAIL
    :'try{\n'+mods()+ERR_TAIL);

  const out=babel.transformSync(src,{
    sourceType:'script',comments:false,compact:false,babelrc:false,configFile:false,
    presets:[[dep.resolve('@babel/preset-env'),{targets:{ie:'11'},modules:false,useBuiltIns:false}]]
  }).code;
  const result=HD+out+tail;

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
  const head=HD.replace(/^\/\/ ?/gm,'').replace(/^=+\n|\n=+\n$/g,'').trim();
  /* поставка 85: перед основным сжатием — проход terser без переименований в несколько итераций: после подстановки
     констант (fold) выпадают демо-ветки, за ними — ставшие ненужными функции генератора макета */
  return dep('terser').minify(out+tail,{ecma:5,toplevel:false,mangle:false,
    compress:{toplevel:false,keep_fargs:true,passes:3,unused:true,dead_code:true,reduce_funcs:false},format:{comments:false,beautify:true}})
  .then(pre=>MIN.minifyChart(pre.code,head,{cssVars:['TP_CSS']}).then(r=>({r,src:pre.code})))
  .then(({r,src})=>{
    const code=r.code, v=MIN.verify(code,src);
    if(!/(^|[;}\n])option=\{[^]*\};?\n$/.test(code))v.fails.push('option не последний после сжатия');
    if(split&&!/function TP_RUN\(/.test(code))v.fails.push('в главном чарте нет TP_RUN');
    /* 12.11 (правка сегментов посещаемости, проверка сборки): в чарте есть ключи рядов базы сегментов и подпись «A из N» */
    ['office_hob','office_nob','"hob"','"nob"',' из '].forEach(t=>{if(code.indexOf(t)<0)v.fails.push('в сборке нет «'+t+'» (база сегментов посещаемости)')});
    if(Buffer.byteLength(code)>BUD*1024)v.fails.push('больше бюджета '+BUD+' КиБ: '+(Buffer.byteLength(code)/1024).toFixed(1)+' КиБ');
    v.warns.forEach(t=>console.error('  ! '+t));
    if(!v.ok||v.fails.length){console.error('СЖАТИЕ НЕ ПРОШЛО:\n  '+v.fails.join('\n  '));process.exit(1)}
    fs.mkdirSync(path.dirname(OUTF),{recursive:true});
    fs.writeFileSync(OUTF,code);
    const kb=n=>(n/1024).toFixed(0)+' КиБ';
    console.log((split?'главный чарт «по частям» собран: ':'чарт собран: ')+path.relative(dir,OUTF)+' — '+kb(Buffer.byteLength(code))+
      ' (до сжатия '+kb(Buffer.byteLength(result))+'; '+r.notes.join('; ')+', разметка '+kb(Buffer.byteLength(body))+
      '; бюджет '+BUD+' КиБ, ≈'+(Buffer.byteLength(code)/1024/50).toFixed(1)+' с отправки на запрос при 50 КБ/с), ES5 и сборка проверены; вне сборки имён: '+(prune.n||0)+'');
  });
}
/* чарт-загрузчик: исходник уже ES5; сжатие — тем же min.cjs, шапка — коротким комментарием */
function makeLoader(){
  const srcL=read('proteus/loader.js');
  try{acorn.parse(srcL,{ecmaVersion:5,sourceType:'script'})}
  catch(e){console.error('ЗАГРУЗЧИК НЕ ПРОШЁЛ: не ES5: '+e.message);process.exit(1)}
  const headL='TeamPulse Hub — чарт-загрузчик дашборда «по частям» (тип ECHARTS). СОБРАН АВТОМАТИЧЕСКИ из proteus/loader.js.\n'+
    'Один и тот же код для всех четырёх загрузчиков: часть (core, people, flow, aux) задаёт датасет чарта.\n'+
    '«Измерения» чарта — все колонки датасета: role, id, pid, lvl, nm, kids, j, ms, mx. Метрик и сортировки нет.';
  const codeOnly=srcL.replace(/^\/\/[^\n]*\n/gm,'');
  return MIN.minifyChart(codeOnly,headL,{}).then(r=>{
    const v=MIN.verify(r.code,codeOnly);
    if(!v.ok||v.fails.length){console.error('СЖАТИЕ ЗАГРУЗЧИКА НЕ ПРОШЛО:\n  '+v.fails.join('\n  '));process.exit(1)}
    fs.mkdirSync(path.dirname(OUT_LOADER),{recursive:true});
    fs.writeFileSync(OUT_LOADER,r.code);
    console.log('чарт-загрузчик собран: '+path.relative(dir,OUT_LOADER)+' — '+Buffer.byteLength(r.code)+' Б');
  });
}
make(true).then(makeLoader)
  .catch(e=>{console.error('СЖАТИЕ НЕ ПРОШЛО: '+(e.message||e));process.exit(1)});

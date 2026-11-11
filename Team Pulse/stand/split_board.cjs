/* Сценарии дашборда «по частям» в браузере (стенд stand/serve_split.py должен быть запущен):

     node stand/split_board.cjs [http://127.0.0.1:8767] [каталог для снимков]

   1. Сверка с одним чартом: текст каждой вкладки у дашборда «по частям» = тексту одного чарта на целом датасете —
      при открытии и после выбора подразделения.
   2. Запросы: при открытии — по одному на чарт; после выбора подразделения главный чарт (dict) не перезапрашивается,
      загрузчики — по одному разу, маска — юнит.
   3. Задержка части: вкладка, чьи разрезы ещё в пути, показывает ожидание и открывается сама; первый экран — по core.
   4. Медленный core при новом выборе: прежний экран не разваливается на «ожидание вкладки».
   5. Загрузчик не отвечает: через 20 с — причина в шапке и на вкладке, остальное работает.
   6. Главный чарт в своей области (борд без JSON областей): отчёт работает, просто главный перезапрашивается.
   7. Кросс-фильтр уже применён при открытии: отчёт открывается на этом подразделении.
   8. Часть из старого кэша (другая отметка сборки данных): к ответу не приклеивается, загрузчики перезапрашиваются
      мимо кэша, отчёт собирается целиком. */
const {chromium}=require('playwright');
const BASE=process.argv[2]||'http://127.0.0.1:8767', SHOTS=process.argv[3]||null;
let bad=0;
const ok=(c,msg)=>{if(!c)bad++;console.log((c?'  ok   ':'  FAIL ')+msg)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function open(b,q){
  const p=await b.newPage({viewport:{width:1440,height:900}});
  p.errs=[];
  p.on('pageerror',e=>p.errs.push(e.message));
  await p.goto(BASE+'/'+(q?'?'+q:''));
  p.main=()=>p.frames().find(f=>/c=dict|c=all/.test(f.url()));
  p.ev=fn=>p.main().evaluate(fn);
  p.st=()=>p.evaluate(()=>window.__stand);
  /* отчёт стоит, ничего не ждёт и не догружает */
  p.settled=async(ms)=>{
    const t0=Date.now();
    for(;;){
      const s=await p.ev(()=>{const r=document.querySelector('.tp-overlay:not(.tp-boot)');
        return !!r&&!!document.querySelector('#view')&&!r.classList.contains('tp-busy')&&!document.querySelector('.ni-w')&&
          !document.querySelector('.chip.part')}).catch(()=>false);
      if(s){await sleep(350);return true}
      if(Date.now()-t0>(ms||15000))return false;
      await sleep(100);
    }
  };
  p.tabs=()=>p.ev(()=>[...document.querySelectorAll('.nav-i')].map(e=>e.dataset.tab));
  p.go=async t=>{await p.ev('document.querySelector(\'.nav-i[data-tab="'+t+'"]\').click()');await sleep(250)};
  /* выбрать подразделение: строка таблицы → кнопка «Открыть» у выбранной строки */
  p.pickRow=async()=>{
    await p.ev(()=>{const r=[...document.querySelectorAll('tr.urow[data-node]')].find(x=>!x.classList.contains('total')&&x.dataset.node&&x.dataset.node!=='T');r.click()});
    await sleep(300);
  };
  p.openUnit=()=>p.ev(()=>document.querySelector('[data-openunit]').click());
  p.drill=async()=>{await p.pickRow();await p.openUnit()};
  p.view=()=>p.ev(()=>document.querySelector('#view').innerText.replace(/\s+/g,' ').trim());
  p.texts=async()=>{const o={};for(const t of await p.tabs()){await p.go(t);o[t]=await p.view()}return o};
  return p;
}
function same(a,b,what){
  const ks=Object.keys(a);
  const diff=ks.filter(k=>a[k]!==b[k]);
  ok(ks.length>=8&&!diff.length,what+': текст '+ks.length+' вкладок совпадает с одним чартом'+(diff.length?' — расходятся: '+diff.join(', '):''));
  diff.slice(0,2).forEach(k=>{const x=a[k],y=b[k]||'';let i=0;while(i<x.length&&x[i]===y[i])i++;
    console.log('       '+k+' @'+i+'\n         части: …'+x.slice(Math.max(0,i-60),i+100)+'\n         один:  …'+y.slice(Math.max(0,i-60),i+100))});
}

(async()=>{
  const b=await chromium.launch();

  /* 1–2. сверка и запросы */
  const sp=await open(b,''), on=await open(b,'single=1');
  ok(await sp.settled()&&await on.settled(),'оба дашборда открылись');
  let st=await sp.st();
  ok(['dict','core','people','flow','aux'].every(c=>st.req[c]===1),'открытие: по одному запросу на чарт — '+JSON.stringify(st.req));
  same(await sp.texts(),await on.texts(),'открытие');
  if(SHOTS){await sp.go('onepager');await sp.screenshot({path:SHOTS+'/split_onepager.png'})}
  for(const p of [sp,on]){await p.go('structure');await p.drill()}
  await sleep(400);
  ok(await sp.settled()&&await on.settled(),'выбор подразделения: оба дашборда показали новое');
  st=await sp.st();
  ok(st.req.dict===1&&['core','people','flow','aux'].every(c=>st.req[c]===2),'выбор подразделения: главный чарт не перезапрошен, загрузчики — по разу — '+JSON.stringify(st.req));
  ok(st.masks.length===1&&st.masks[0].some(m=>m.column==='unit_f'),'маска — юнит: '+JSON.stringify(st.masks[0]));
  same(await sp.texts(),await on.texts(),'после выбора подразделения');
  ok(!sp.errs.length&&!on.errs.length,'ошибок страницы нет'+(sp.errs.concat(on.errs).length?': '+sp.errs.concat(on.errs).join(' | '):''));
  const log=await sp.ev(()=>window.__pvtState.tp.parts.log.map(x=>x[0]+' '+x[1]).join(' · '));
  console.log('       журнал канала: '+log);
  await sp.close();await on.close();

  /* 3. задержка части people */
  const d=await open(b,'delay=people:6000');
  await sleep(3000);
  const first=await d.ev(()=>({view:!!document.querySelector('#view'),wait:[...document.querySelectorAll('.nav-i.wait')].map(e=>e.dataset.tab),
    chip:!!document.querySelector('.chip.part')}));
  ok(first.view&&first.wait.indexOf('structure')>=0&&first.wait.indexOf('ai')<0&&first.chip,
    'people в пути: первый экран уже есть, у вкладок людей — значок загрузки ('+first.wait.join(', ')+'), в шапке — «Догружаю детали»');
  await d.go('structure');
  const w=await d.ev(()=>{const e=document.querySelector('.part-wait');return e?e.innerText.replace(/\s+/g,' '):''});
  ok(/Загружаю данные вкладки/.test(w)&&/разрезы людей/.test(w),'вкладка без своей части — экран ожидания: «'+w.slice(0,90)+'»');
  if(SHOTS)await d.screenshot({path:SHOTS+'/split_wait.png'});
  ok(await d.settled(12000),'часть пришла — ожидание снято');
  const after=await d.ev(()=>({wait:!!document.querySelector('.part-wait'),tab:(document.querySelector('.nav-i.active')||{dataset:{}}).dataset.tab,
    n:document.querySelector('#view').innerText.length}));
  ok(!after.wait&&after.tab==='structure'&&after.n>300,'вкладка открылась сама, пользователь остался на ней');
  await d.close();

  /* 4. новый выбор при медленном core: старый экран не превращается в «ожидание вкладки» */
  const s=await open(b,'');
  await s.settled();
  await s.go('structure');
  await s.pickRow();
  const before=await s.view();
  await s.evaluate(()=>{DELAY.core=3500});
  await s.openUnit();
  await sleep(2200);                                   /* people / flow / aux нового выбора уже пришли, core — ещё нет */
  const mid=await s.ev(()=>({busy:document.querySelector('.tp-overlay').classList.contains('tp-busy'),wait:!!document.querySelector('.part-wait'),
    nav:document.querySelectorAll('.ni-w').length}));
  ok(mid.busy&&!mid.wait&&!mid.nav&&(await s.view())===before,'core нового выбора в пути: прежний экран на месте, приглушён, без «ожидания вкладки»');
  ok(await s.settled(9000)&&(await s.view())!==before,'core пришёл — показан новый выбор');
  await s.close();

  /* 5. загрузчик aux не отвечает */
  const x=await open(b,'drop=aux');
  await sleep(2500);
  const x0=await x.ev(()=>({view:!!document.querySelector('#view'),wait:[...document.querySelectorAll('.nav-i.wait')].map(e=>e.dataset.tab)}));
  ok(x0.view&&x0.wait.join()==='ai','aux молчит: отчёт открыт, ждёт только вкладка AI');
  await sleep(20500);
  const x1=await x.ev(()=>({chip:(document.querySelector('.chip.part')||{innerText:''}).innerText,late:!!document.querySelector('.ni-w.late')}));
  await x.go('ai');
  const x2=await x.ev(()=>(document.querySelector('.part-wait.late')||{innerText:''}).innerText.replace(/\s+/g,' '));
  ok(/не пришла/.test(x1.chip)&&x1.late&&/не пришли/.test(x2)&&/Не ответил загрузчик/.test(x2),'через 20 с — причина: «'+x1.chip.trim()+'», на вкладке: «'+x2.slice(0,80)+'»');
  await x.go('structure');
  ok((await x.view()).length>300&&!(await x.ev(()=>!!document.querySelector('.part-wait'))),'остальные вкладки работают');
  if(SHOTS){await x.go('ai');await x.screenshot({path:SHOTS+'/split_late.png'})}
  await x.close();

  /* 6. главный чарт в своей области */
  const f=await open(b,'self=1');
  await f.settled();
  await f.go('structure');
  const f0=await f.view();
  await f.drill();
  await sleep(400);
  ok(await f.settled()&&(await f.view())!==f0,'главный чарт в своей области: выбор подразделения работает');
  st=await f.st();
  ok(st.req.dict===2,'… и главный чарт перезапрошен (этого и избегает JSON областей): dict '+st.req.dict);
  await f.close();

  /* 7. кросс-фильтр применён при открытии */
  const u0=await open(b,'');
  await u0.settled();await u0.go('structure');
  await u0.drill();await sleep(400);await u0.settled();
  const mask=(await u0.st()).masks[0], uid=mask.find(m=>m.column==='unit_f').value[0];
  await u0.go('turnover');
  const want=await u0.view();
  await u0.close();
  const u=await open(b,'unit='+encodeURIComponent(uid));
  await u.settled();await u.go('turnover');
  ok((await u.view())===want&&(await u.st()).req.dict===1,'фильтр юнита уже применён при открытии — отчёт открылся на нём (вкладка «Отток» та же)');
  await u.close();

  /* 8. часть people — из старого кэша */
  const c=await open(b,'stale=people');
  ok(await c.settled(15000),'часть из старого кэша: отчёт собрался целиком');
  st=await c.st();
  ok(st.masks.length===1&&st.masks[0].some(m=>m.column==='tp_nonce')&&st.req.people===2&&st.req.dict===1,
    '… после одного перезапроса загрузчиков мимо кэша (метка tp_nonce): '+JSON.stringify(st.req));
  await c.go('structure');
  ok((await c.view()).length>300&&!(await c.ev(()=>!!document.querySelector('.part-wait'))),'вкладка людей открыта на свежих данных');
  console.log('       журнал канала: '+await c.ev(()=>window.__pvtState.tp.parts.log.map(x=>x[0]+' '+x[1]).join(' · ')));
  await c.close();

  await b.close();
  console.log(bad?'сценарии «по частям»: есть провалы ('+bad+')':'сценарии «по частям»: все проверки прошли');
  process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(2)});

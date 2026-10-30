/* ============================================================================
   Смоук пробника без браузера: node proteus/smoke_real.js ответ.json [ещё.json …]

   Ответ — массив строк датасета teampulse_hub, как его получает чарт (stand/dataset.py
   --json). Модель строит proteus/real.js, дальше грузятся те же файлы, что в чарте,
   и проверяется то, на чём держится пробник:
   - лист «Напрямую в «X»» плюс дети ровно дают юнит — по каждому ряду и месяцу,
     поэтому агрегация макета (сумма листьев, потом деление) остаётся верной;
   - ИТОГО отчёта — строка выбранного юнита, база — строка base;
   - текучесть, regret, недоработка и переработка — по формулам из настоящих рядов;
   - разрезы состава и увольнений (колонка mx, схема 15.10) — те же числа, что в ответе;
   - все 29 экранов собираются, заглушки помечены «демо», живые метрики — нет.
   Каждый ответ — в отдельном процессе: модули читают модель один раз при загрузке.
   ========================================================================== */
const fs=require('fs'), path=require('path'), cp=require('child_process');
const dir=path.join(__dirname,'..');

if(process.argv.length>3){            /* несколько ответов — каждый своим процессом */
  let fails=0;
  process.argv.slice(2).forEach(f=>{
    const r=cp.spawnSync(process.execPath,[__filename,f],{stdio:'inherit'});
    if(r.status)fails++;
  });
  process.exit(fails?1:0);
}
const file=process.argv[2];
if(!file){console.error('нужен файл ответа датасета (stand/dataset.py --json)');process.exit(2)}
const rows=JSON.parse(fs.readFileSync(file,'utf8'));

function El(){return{innerHTML:'',textContent:'',style:{},dataset:{},tabIndex:0,
  offsetWidth:200,offsetHeight:100,clientWidth:0,
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  setAttribute(){},getAttribute(){return null},removeAttribute(){},remove(){},appendChild(){},
  addEventListener(){},closest(){return null},matches(){return false},click(){},
  querySelectorAll(){return[]},querySelector(){return null},
  getBoundingClientRect(){return{left:0,top:0,bottom:0,right:0,width:100,height:20}}}}
const NODES=new Map();
const pick=k=>{if(!NODES.has(k))NODES.set(k,El());return NODES.get(k)};
const doc={querySelector:pick,querySelectorAll(){return[]},getElementById:k=>pick('#'+k),
  addEventListener(){},createElement(){return El()},body:{appendChild(){}}};
global.window={addEventListener(){},scrollTo(){},innerWidth:1440,innerHeight:900};
global.document=doc;
global.location={search:'',origin:'http://localhost',pathname:'/'};
global.history={replaceState(){}};
global.navigator={};global.innerWidth=1440;global.innerHeight=900;
global.localStorage={getItem(){return'1'},setItem(){}};

require(path.join(__dirname,'real.js'));
window.TP_REAL=window.TPREAL.build(rows);
['data.js','draw.js','ui.js','mascot.js','insights.js','story.js',
 'screens/_block.js','screens/structure.js','screens/movement.js','screens/turnover.js',
 'screens/hiring.js','screens/tgrowth.js','screens/monitor.js','screens/office.js','screens/ai.js',
 'screens/onepager.js'].forEach(f=>require(path.join(dir,f)));
const probe=path.join(dir,'.app.probe.real.js');
fs.writeFileSync(probe,fs.readFileSync(path.join(dir,'app.js'),'utf8')+
  '\nmodule.exports={go:(t,sub)=>{S.tab=t;S.subTab=sub||null;S.selNode=null;render();return $("#view").innerHTML},'+
  '\n  top:t=>{S.tab=t;S.subTab=null;S.selNode=null;render();return $("#view").innerHTML},'+
  '\n  home0:()=>{S.tab="onepager";S.aiOpen=null;render();return $("#view").innerHTML},'+
  '\n  expAll:()=>{expanded.clear();SC.expandableRows(SC.currentRoot(S)).forEach(p=>expanded.add(p));render(true);return $("#view").innerHTML},'+
  '\n  op:list=>{S.tab="onepager";openRows.clear();(list||[]).forEach(k=>openRows.add(k));render();return $("#view").innerHTML},'+
  '\n  setup:q=>{openSetup();if(q){UT.q=q;utRender()}const h=$("#utList").innerHTML+"|"+$("#benchPreview").innerHTML+"|"+$("#optStaff").innerHTML;closeSetup();return h},'+
  '\n  mixOpen:list=>{mixOpen.clear();(list||[]).forEach(k=>mixOpen.add(k));render();return $("#view").innerHTML},'+
  '\n  head:()=>{render();return $("#crumbs").innerHTML},'+
  '\n  st:()=>S};');
const A=require(probe);
fs.unlinkSync(probe);

const D=window.TPDATA, R=window.TP_REAL, SC=window.TPSCREENS;
let bad=0;
const ok=(cond,msg)=>{if(!cond){bad++;console.log('  FAIL',msg)}else console.log('  ok  ',msg)};
const near=(a,b)=>Math.abs(a-b)<1e-6;
const name=path.basename(file);
console.log('— '+name+': '+D.NODE_BY_PATH[D.DEFAULT_STATE.unit].name+', '+D.PERIOD_LABEL+
  ', фильтры '+[D.DEFAULT_STATE.paint,D.DEFAULT_STATE.itSeg,D.DEFAULT_STATE.staffType].join(' / '));

/* 1. дерево: лист «Напрямую» + дети = юнит, по каждому ряду и месяцу */
const scopeRow=rows.find(r=>r.role==='scope'), baseRow=rows.find(r=>r.role==='base');
/* ряд метрики строки: прежний ответ — колонка m_c, датасет 2а с поставки 53 — отрезок ms в порядке meta.mk */
const MK=(()=>{const m=rows.find(r=>r.role==='meta');try{const k=JSON.parse(m.j).mk;return k?String(k).split(','):null}catch(e){return null}})();
const arr=(r,c)=>String(MK?String(r.ms).split(';')[MK.indexOf(c)]:r['m_'+c]).split(',').map(Number);
/* поставка 56: найм модели — по дню события (hit), если датасет его везёт */
const KEYS=[['hc_total','hc'],['hc_active','act'],['hc_avg','avg'],['hire',R.has('hit')?'hit':'hire'],['attrition','fire'],
  ['transfer_in','tin'],['transfer_out','tout'],['regret_cnt','reg'],
  ['perf_norm','pnor'],['perf_low','plow'],['perf_high','phig'],['perf_gray','pgry']]
  /* колонки разведки 12.10 — если ответ их везёт */
  /* 31.10-б, п. 6: заявки «Роста» — из gah / gdh (без фильтра покраски), если ответ их везёт */
  .concat([['wday','wday'],['ovis','ovis'],['tgrowth_pass',R.has('gah')?'gah':'gapr'],['tgrowth_deny',R.has('gah')?'gdh':'gdec']].filter(([,c])=>R.has(c)))
  /* поставка 71: мониторинг по дням — люди в сегментах, суммы часов и звонков */
  .concat(['ab25','ab5','we25','we5','t23','t35','t5','hrs','hrn','tlk'].filter(c=>R.has(c)).map(c=>['mon_'+c,c]));
let treeOk=true, checked=0;
rows.filter(r=>['scope','c','g','x'].indexOf(r.role)>=0).forEach(r=>{
  const node=D.NODES.find(n=>n.id===r.id);
  if(!node){treeOk=false;console.log('    нет узла',r.nm);return}
  const lp=D.leavesUnder(node.path).map(l=>l.path).filter(p=>D.leafPasses(p,D.DEFAULT_STATE));
  KEYS.forEach(([k,c])=>{
    const agg=D.aggregateExt(lp,k), want=arr(r,c);
    want.forEach((v,i)=>{if(!near(agg[i],v)){treeOk=false}});
  });
  checked++;
});
ok(treeOk,'сумма листьев под каждым юнитом ответа = его строке ('+checked+' юнитов × '+KEYS.length+' рядов × '+R.n+' мес)');
const rl=D.reportLeaves(D.DEFAULT_STATE), bl=D.benchmarkLeaves(D.DEFAULT_STATE);
ok(near(D.lastVal(rl,'hc_total'),arr(scopeRow,'hc')[R.n-1]),'ИТОГО = численность выбранного юнита в последнем полном месяце');
ok(bl.length===1&&near(D.lastVal(bl,'hc_total'),arr(baseRow,'hc')[R.n-1]),'база = строка base (вся компания под фильтрами)');
ok(D.MONTHS.length===12&&D.MONTHS_EXT.length===R.n&&D.MONTHS[11].y*12+D.MONTHS[11].m===+R.lm.slice(0,4)*12+(+R.lm.slice(5,7))-1,
  'окно — 12 месяцев до последнего полного ('+R.lm+'), сетка — с января прошлого года');

/* 2. формулы из настоящих рядов */
const i=R.n-1;
{
  const pn=arr(scopeRow,'pnor')[i], pl=arr(scopeRow,'plow')[i], ph=arr(scopeRow,'phig')[i], pg=arr(scopeRow,'pgry')[i], t=pn+pl+ph+pg;
  ok(near(D.aggregate(rl,'underwork')[D.LAST],t?+(pl/t*100).toFixed(2):null)&&near(D.aggregate(rl,'overwork')[D.LAST],t?+(ph/t*100).toFixed(2):null)&&
    !D.isStub('underwork')&&!D.isStub('overwork'),
    'недоработчики и переработчики = недоработка / переработка ко всем четырём категориям мониторинга — живые');
}
/* разрезы (схема 15.10): численность по разрезу за последний месяц и увольнения
   с начала года — ровно числа колонки mx выбранного юнита */
{
  const mx={};
  /* 27.10-в, п. 19: грейды 20 и выше в отчёте — одной категорией «20+» */
  String(scopeRow.mx||'').split('\n').forEach(l=>{if(!l)return;const f=l.split('\t'), o=mx[f[0]]=mx[f[0]]||{},
    v=f[0]==='gr'&&/^\d+$/.test(f[1])&&+f[1]>=20?'20+':f[1];o[v]=(o[v]||0)+ +f[2]});
  const hcL=arr(scopeRow,'hc')[i];
  const dimOk=['gender','grade','seniority','tenure','employment'].every(k=>{
    const parts=D.mixParts(rl,k), cats=D.mixCats(k), src=mx[{gender:'g',grade:'gr',seniority:'s',tenure:'t',employment:'r'}[k]]||{};
    return Math.abs(parts.reduce((a,b)=>a+b,0)-hcL)<0.5&&cats.every((c,j)=>Math.abs(parts[j]-(src[c.raw]||0))<0.5);
  });
  ok(dimOk,'разрезы состава — числа из данных: пол, грейд, сеньорность, стаж, тип оформления (сумма = численность)');
  const ytd=D.sumWin(D.aggregate(rl,'attrition'),'ytd'), rs=D.exitReasons(rl,'ytd'), ini=D.exitInitiators(rl,'ytd'), ex=D.exitProfile(rl,'ytd');
  const sum=a=>a.reduce((x,y)=>x+y.value,0);
  ok(sum(rs)===ytd&&sum(ini)===ytd&&['tenure','grade','stream'].every(k=>sum(ex[k])===ytd)&&
    rs.every(r=>r.value===Math.round((mx.xr||{})[r.name==='Не указано'?'':r.name]||0)),
    'увольнения с начала года по причине, инициатору, стажу, грейду, стриму — из данных, в сумме = отток ('+ytd+')');
  const regY=D.sumWin(D.aggregate(rl,'regret_cnt'),'ytd'), regN=rs.reduce((x,r)=>x+(r.regretN||0),0);
  ok(Math.abs(regN-regY)<=rs.length*0.5,'нежелательные уходы по причинам — по людям, в сумме = regret с начала года ('+regN+' / '+regY+')');
  /* 16.10, ответ 0д: employee_contract_type — формат работы («Гибридный»), а не тип договора */
  /* 21.10, поставка 50: специализации (mx «sp») — если ноутбук их собрал */
  /* 22.10, поставка 62: регион (rg) и специализации внутри стрима (ws) — если ноутбук их собрал */
  const hasRg=Object.keys(R.mixVals('rg')).length>0, hasWs=Object.keys(R.mixVals('ws')).length>0;
  const st=D.MIX_BY_KEY.stream, sp=D.MIX_BY_KEY.spec;
  ok(!!D.MIX_BY_KEY.worksite&&!D.MIX_BY_KEY.contract&&!!D.MIX_BY_KEY.region===hasRg&&
    !!sp===(Object.keys(R.mixVals(hasWs?'ws':'sp')).length>0)&&
    (!hasWs||!!st&&st.childDim==='spec'&&sp.cats.every(c=>c.short&&c.raw.indexOf('|')>=0)&&
      st.cats.reduce((a,c)=>a+c.kids.length,0)===sp.cats.filter(c=>st.cats.some(x=>x.raw===c.raw.split('|')[0])).length),
    'формат работы — из employee_contract_type; типа договора нет; регион — '+(hasRg?'из данных':'нет в ответе')+
    '; специализации — '+(hasWs?'внутри стрима (ws)':sp?'плоским списком':'нет в ответе'));
  /* 16.10: IT-специализация вернулась в таблицу — фильтр IT снова работает. Покраска — только
     в датасете 2а (таблицы ноутбука): тогда и её значения приходят в meta */
  const hub=R.cuts.has('paint');
  ok(R.cuts.has('it')&&R.cuts.has('staff')&&R.vals.it.length>0&&(!hub||R.vals.paint.length>0)&&
    D.DEFAULT_STATE.paint===(R.applied.paint||'all')&&D.DEFAULT_STATE.itSeg===(R.applied.itSeg||'all'),
    'фильтры: IT и штат — есть, покраска — '+(hub?'есть (датасет 2а)':'нет')+'; значения пришли в meta');
  /* 20.10: тип численности — датасет без фильтра отдаёт активную, с «Вся» — всю; таблицы без
     act_cd (ноутбук до 20.10) — всю и без фильтра. На активной «Численность» = «Активная» */
  const metaRow=rows.find(r=>String(r.role)==='meta'), meta=metaRow?JSON.parse(metaRow.j):{};
  const actEcho=(meta.act||[]).map(String);
  /* 22.10, поставка 61: набор по умолчанию — meta.act_def («Активная», без подрядчиков); эхо без
     значений — вся численность; другой набор — свой (hcSet). Список типов — все значения active_type_nm */
  const actDef=(meta.act_def||['Активная']).map(String), lc=a=>a.map(v=>v.toLowerCase()).sort().join('|');
  const hcWant=!R.cuts.has('act')||!actEcho.length?'all':lc(actEcho)===lc(actDef)?'active':'set';
  const hcS=D.aggregate(rl,'hc_total'), acS=D.aggregate(rl,'hc_active');
  ok(R.applied.hcType===hcWant&&D.DEFAULT_STATE.hcType===hcWant&&
    (hcWant!=='active'||hcS.every((v,k)=>Math.abs(v-acS[k])<0.01))&&
    (hcWant!=='all'||hcS[D.LAST]>=acS[D.LAST])&&!D.metricVisible('hc_active',D.DEFAULT_STATE)===(hcWant!=='all')&&
    (hcWant!=='set'||lc(R.applied.hcSet)===lc(actEcho))&&
    (!R.cuts.has('act')||(R.vals.act.length>0&&R.filterValue('hcType','all')==='Вся'&&R.actTypes.length>0&&
      actDef.every(v=>lc(R.actTypes).split('|').indexOf(v.toLowerCase())>=0))),
    'тип численности: '+(R.cuts.has('act')?({active:'по умолчанию ('+actDef.join(' + ')+')',all:'вся',set:'свой набор'})[hcWant]+
      ', типов в списке '+R.actTypes.length:'фильтра нет (таблицы до 20.10)')+
    ', численность '+hcS[D.LAST]+' / активная '+acS[D.LAST]);
}
const fire=arr(scopeRow,'fire'), avg=arr(scopeRow,'avg'), reg=arr(scopeRow,'reg');
const jan0=()=>D.MONTHS_EXT.findIndex((m,k)=>k<=i&&m.m===0&&m.y===D.MONTHS_EXT[i].y);
const tm=avg[i]?+(fire[i]/avg[i]*100).toFixed(2):null;
ok(near(D.lastVal(rl,'turnover_m'),tm),'текучесть месячная = увольнения / ССЧ × 100 ('+tm+'%)');
const jan=D.MONTHS_EXT.findIndex((m,k)=>k<=i&&m.m===0&&m.y===D.MONTHS_EXT[i].y);
let ty=0;for(let k=jan;k<=i;k++)ty+=avg[k]?+(fire[k]/avg[k]*100).toFixed(2):0;
ok(near(D.lastVal(rl,'turnover_y'),+ty.toFixed(2)),'текучесть накопительная = сумма месячных с января');
/* 26.10-б: желательная и нежелательная — по последнему закрытому месяцу (D.lastIdx), накопительно с его января */
/* поставка 69 (Антон, вопрос 4): с рядами rh / nrh / avh — всегда по активной численности HQ узла */
const ic=D.lastIdx('regret')+R.pre, janC=D.MONTHS_EXT.findIndex((m,k)=>k<=ic&&m.m===0&&m.y===D.MONTHS_EXT[ic].y);
const HQR=R.has('rh')&&R.has('nrh')&&R.has('avh'), avR=HQR?arr(scopeRow,'avh'):avg, rgR=HQR?arr(scopeRow,'rh'):reg;
let ry=0;for(let k=janC;k<=ic;k++)ry+=avR[k]?+(rgR[k]/avR[k]*100).toFixed(2):0;
ok(near(D.lastVal(rl,'regret'),+ry.toFixed(2)),'regret = накопительная доля нежелательных увольнений к ССЧ'+(HQR?' HQ':'')+(ic<i?' (закрытый месяц)':''));
ok(D.isStub('vac_open')===!R.has('vop')&&D.isStub('ai_penetration')===!R.has('aip')&&D.isStub('nonregret')===!R.has('nreg')&&
  !D.isStub('turnover_m')&&!D.isStub('hc_total'),
  'заглушки помечены: вакансии, AI и желательный отток — '+(R.has('vop')?'живые (поставка 50)':'демо')+', численность и текучесть — живые');
/* 21.10, поставка 50: метрики из прод-ноутбуков HQ и УС — по формулам из настоящих рядов */
if(R.has('nreg')){
  const nr=arr(scopeRow,HQR?'nrh':'nreg');
  let ny=0;for(let k=janC;k<=ic;k++)ny+=avR[k]?+(nr[k]/avR[k]*100).toFixed(2):0;
  ok(near(D.lastVal(rl,'nonregret'),+ny.toFixed(2)),'желательный отток = накопительная доля желательных увольнений к ССЧ'+(HQR?' HQ':''));
}
if(R.has('vop')){
  const vo=arr(scopeRow,'vop'), vc=arr(scopeRow,'vcl'), vd=arr(scopeRow,'vtd'), vn=arr(scopeRow,'vtn'), vj=arr(scopeRow,'vjn');
  let cj=0,cc=0;for(let k=jan0();k<=i;k++){cj+=vj[k];cc+=vc[k]}
  ok(near(D.lastVal(rl,'vac_open'),vo[i])&&near(D.lastVal(rl,'vac_closed'),vc[i])&&
    near(D.aggregate(rl,'time_to_fill')[D.LAST],vn[i]?+(vd[i]/vn[i]).toFixed(2):null)&&
    near(D.lastVal(rl,'junior_share'),cc?+(cj/cc*100).toFixed(2):null),
    'вакансии: открытые, закрытые, срок = дни / закрытые, доля джунов = закрытые джунами / закрытые с начала года');
  const vb=D.vacancyBreakdown(rl), sumK=k=>rl.reduce((a,p)=>{const o=(R.mix(p)||{})[k]||{};return a+Object.keys(o).reduce((x,v)=>x+o[v],0)},0);
  ok(!!vb&&Math.abs(vb.status.reduce((a,r)=>a+r.value,0)-sumK('vs'))<=vb.status.length,
    'вакансии в разрезах: статусы открытых — из колонки mx');
}
if(R.has('aip')){
  /* ниже компании доля собрана из листьев (WAU ÷ знаменатель), витрина округляет её до десятых */
  ok(Math.abs(D.lastVal(rl,'ai_penetration')-arr(scopeRow,'aip')[i])<0.051&&near(D.lastVal(rl,'ai_wau'),arr(scopeRow,'aiw')[i]),
    'AI: проникновение и WAU — из витрины, как в отчёте HQ');
}
if(Object.keys(R.mixVals('hk')).length){
  const hp=D.hiringProfile(rl,'ytd');
  const tot=rl.reduce((a,p)=>{const o=(R.mix(p)||{}).hk||{};return a+Object.keys(o).reduce((x,v)=>x+o[v],0)},0);
  ok(Math.abs(hp.channels.reduce((a,c)=>a+c.value,0)-tot)<=hp.channels.length,'найм по источникам — из колонки mx (как atributy_nayma HQ)');
}
/* колонки разведки 12.10: с ними посещаемость и T-рост живые, без них — «демо», и
   чарт не жалуется на «нет колонок» (они необязательные) */
const NEWC=['wday','ovis','gapr','gdec'], hasNew=NEWC.every(c=>R.has(c));
if(hasNew){
  const wd=arr(scopeRow,'wday')[i], ov=arr(scopeRow,'ovis')[i], ga=arr(scopeRow,R.has('gah')?'gah':'gapr')[i], gd=arr(scopeRow,R.has('gah')?'gdh':'gdec')[i];
  ok(near(D.lastVal(rl,'office_att'),wd?+(ov/wd*100).toFixed(2):null),'посещаемость = посещения офиса / отработанные дни × 100');
  ok(near(D.lastVal(rl,'tgrowth_pass'),ga)&&near(D.lastVal(rl,'tgrowth_deny'),gd)&&
    near(D.aggregate(rl,'tgrowth_conv')[D.LAST],ga+gd?+(ga/(ga+gd)*100).toFixed(2):null),
    'T-рост: одобрено, отклонено, конверсия = одобрено / (одобрено + отклонено)');
  /* поставка 66 (посещения Адели): с рядами бронирований бронирование живое */
  const BK=R.has('bk');
  ok(!D.isStub('office_att')&&!D.isStub('tgrowth_conv')&&!D.METRIC_BY_KEY.tgrowth_tat&&D.isStub('booking_viol')===!BK,
    'посещаемость и решения T-роста — живые, T@T — демо, бронирование — '+(BK?'живое':'демо'));
}else{
  ok(NEWC.every(c=>!R.has(c))&&D.isStub('office_att')&&D.isStub('tgrowth_conv')&&!R.missing.length,
    'ответ без колонок 12.10: посещаемость и T-рост — демо, «нет колонок» не поднимается');
}

/* 3. экраны */
const CASES=[['onepager',null]];
Object.keys(SC.blocks).forEach(k=>SC.blocks[k].subTabs.forEach(([sub])=>CASES.push([k,sub])));
let scrOk=true, html='';
CASES.forEach(([t,s])=>{
  try{const h=A.go(t,s);if(!h||h.length<300){scrOk=false;console.log('    пустой экран',t,s)}html+=h}
  catch(e){scrOk=false;console.log('    падает',t,s,e.message)}
});
ok(scrOk,'все '+CASES.length+' экранов собираются на модели пробника');
/* 16.10, заказчик: «юрлиц и регионов на высоких уровнях будет очень много — брать топ».
   В обзоре длинный список — 6 строк и «Остальные», у стримов ушедших — 8 и «Остальные». */
{
  /* 21.10, файл «Структура»: «Оформление» — три таблицы; компаний на верхних уровнях десятки —
     6 строк и «Остальные» (16.10); длинные названия — в две строки, а не многоточием (19.10) */
  const nLeg=Object.keys(R.mix('BASE')&&R.mixVals('o')||{}).length, wk=A.go('structure','work');
  /* 23.10: «Оформление» историей — у компании заголовок раздела с иконкой, под ним таблица: первые 8 и «Остальные» */
  const sec=((wk.split('<span class="pf-t">Компания')[1]||'').split('</table>')[0]||'');
  /* 23.10, Антон: «Остальные» — сама строка urow и раскрывается (data-btexp="rest:legal") */
  const rows=(sec.match(/<tr class="urow/g)||[]).length, rest=/>Остальные<span class="unit-sub">\d+ компани/.test(sec)&&/data-btexp="rest:legal"/.test(sec);
  /* 22.10: все компании с людьми, без «Остальных» */
  const nLive=D.MIX_BY_KEY.legal?D.mixParts(D.reportLeaves(A.st()),'legal',A.st().mixSel||[]).filter(v=>v>0).length:0;
  ok(!nLeg||(nLive<=9?rows===nLive&&!rest:rows===9&&rest),'компании на «Оформлении»: '+(nLive<=9?'все '+nLive:'первые 8 и «Остальные»'));
  /* 23.10, Антон: «Остальные» раскрываются — спрятанные компании и регионы вторым уровнем, каждая со срезом */
  if(rest){
    const op=A.mixOpen(['rest:legal']), s2=((op.split('<span class="pf-t">Компания')[1]||'').split('</table>')[0]||'');
    ok((s2.match(/<tr class="urow lvl2" data-mix="legal:/g)||[]).length===nLive-8&&/data-open="1" data-btexp="rest:legal"/.test(s2),
      'раскрытые «Остальные» показывают '+(nLive-8)+' компаний вторым уровнем');
    A.mixOpen([]);
  }
  const nRg=D.MIX_BY_KEY.region?D.mixParts(D.reportLeaves(A.st()),'region',A.st().mixSel||[]).filter(v=>v>0).length:0;
  if(nRg>11){
    const pc=A.go('structure','portrait'), po=A.mixOpen(['rest:region']), cnt=h=>(h.match(/<tr class="urow lvl2" data-mix="region:/g)||[]).length;
    ok(/data-btexp="rest:region"/.test(pc)&&!cnt(pc)&&cnt(po)===nRg-10,'регионы: первые 10 и «Остальные», раскрываются ('+(nRg-10)+' вторым уровнем)');
    A.mixOpen([]);
  }
  ok((wk.match(/<div class="bt-group">/g)||[]).length===1&&/class="shbar/.test(wk)&&/class="row-body two"/.test(wk),
    'оформление: полоса и карточки, формат — карточками, компании таблицей; длинные названия — в две строки');
  /* 31.10-б, п. 1: средний возраст внутри категории и в срезе — по es / en выбранного юнита */
  if(R.scopeMix('es')){
    const lpA=D.reportLeaves(A.st()), Gd=D.MIX_BY_KEY.gender, es=R.scopeMix('es'), en=R.scopeMix('en');
    const fi=Gd.cats.findIndex(c=>/^ж|жен|female/i.test(c.raw)), want=k=>en['g|'+k]?es['g|'+k]/en['g|'+k]:null;
    const aw=D.avgAge(lpA,[],'gender',fi), sw=D.avgAge(lpA,['gender:'+Gd.cats[fi].key]);
    const ag=D.MIX_BY_KEY.age, ac=ag&&ag.cats.find(c=>en['a|'+c.raw]>0), sa=ac?D.avgAge(lpA,['age:'+ac.key]):1;
    ok(aw!=null&&Math.abs(aw-want(Gd.cats[fi].raw))<0.01&&sw!=null&&Math.abs(sw-aw)<0.01&&sa!=null,
      'средний возраст: женщины '+(aw==null?'—':aw.toFixed(1))+', в срезе «Женщины» — то же, срез по возрасту — '+(sa==null?'—':sa.toFixed(1)));
  }
  /* 31.10-б, п. 9: кросс-фильтр «руководители / сотрудники × город» */
  if(Object.keys(R.mixVals('ocpl')||{}).length){
    const lpA=D.reportLeaves(A.st()), x=D.officeCross(lpA,null,null), xl=D.officeCross(lpA,'lead',null), xs=D.officeCross(lpA,'staff',null);
    const sum=a=>a.reduce((t,c)=>t+c.visits,0), c0=x.cities[0], xc=D.officeCross(lpA,null,c0.name);
    ok(x.cross&&sum(xl.cities)+sum(xs.cities)===sum(x.cities)&&sum(xl.cities)<sum(x.cities)&&
      xc.city&&xc.city.people.lead+xc.city.people.staff===c0.people&&/data-offcity=/.test(A.go('office','attend')),
      'офис: руководители '+sum(xl.cities)+' + сотрудники '+sum(xs.cities)+' = '+sum(x.cities)+' посещений; в «'+c0.name+'» — '+
      xc.city.people.lead+' рук. и '+xc.city.people.staff+' сотр.');
  }
  /* поставка 65: светофор «Как уходит HQ?» — по строке hq (покраска HQ и тип «Активная» вместо фильтров отчёта);
     датасет без неё — по scope, только если фильтры и так «HQ + Активная», иначе — просьба обновить датасет */
  {
    const h=D.hqLight(A.st()), hv=A.go('turnover','hq');
    if(R.hasSeries('HQ')){
      /* 26.10-б: все три — по последнему закрытому месяцу, «накопительно» вместо «YTD», блок сверен */
      const want=D.aggregate(['HQ'],'turnover_y')[D.LAST-(D.PARTIAL?1:0)];
      ok(!!h&&h.lp[0]==='HQ'&&h.rows.length===3&&h.rows[0].v===want&&!/hq-tl/.test(hv)&&
        !/<tr class="mrow"/.test(hv)&&/HQ текучесть накопительная/.test(hv)&&!/YTD/.test(hv.split('hq-note')[1]||'')&&
        /hq-note"><span class="live-tag ok"/.test(hv),
        'светофор HQ по строке hq: '+h.rows.map(r=>r.label.split(' ')[0]+' '+D.fmtVal(r.key,r.v)).join(', ')+' · HQ '+h.hc+' чел');
      /* 31.10-б, п. 2: желательная (non-regrettable, nreg) и нежелательная (reg) — из рядов строки hq: накопительно = сумма
         уходов с января / ССЧ месяца… как ряд метрики; при уходах в строке — не ноль */
      const L=D.LAST-(D.PARTIAL?1:0), sum=k=>D.aggregate(['HQ'],k).slice(0,L+1).reduce((a,b)=>a+b,0);
      ok(['nonregret','regret'].every((k,i)=>{const r=h.rows.find(x=>x.key===k), n=sum(i?'regret_cnt':'nonregret_cnt');
        return n===0||r.v>0}),'желательная и нежелательная HQ накопительно — не нули: '+
        h.rows.slice(1).map(r=>D.fmtVal(r.key,r.v)).join(' / '));
      /* файл 6, п. 2: ряды HQ у каждого узла (fh rh nrh avh) — светофор по выбранной строке: на всём юните = строка hq,
         у подразделения ниже — свои числа */
      if(D.HQN){
        const st=A.st(), hn=D.hqLight(st,D.reportLeaves(st),st.unit);
        const kid=D.NODES.find(n=>n.parent===st.unit&&!n.direct&&!n.hide), hk=kid&&D.hqLight(st,D.leavesUnder(kid.path).map(l=>l.path),kid.path);
        ok(!!hn&&hn.rows.every((r,i)=>Math.abs(r.v-h.rows[i].v)<0.051)&&hn.hc===h.hc&&(!hk||hk.rows.some((r,i)=>r.v!==hn.rows[i].v)),
          'светофор HQ по узлам = строка hq ('+hn.rows.map(r=>D.fmtVal(r.key,r.v)).join(', ')+')'+(hk?'; «'+kid.name.slice(0,3)+'…»: '+
          hk.rows.map(r=>D.fmtVal(r.key,r.v)).join(', ')+' · HQ '+hk.hc+' чел':''));
      }
    }else ok(h?A.st().paint==='HQ'&&A.st().hcType==='active':/Светофору HQ нужны данные/.test(hv),
      'светофор HQ без строки hq: '+(h?'по scope (фильтры «HQ + Активная»)':'просьба обновить датасет'));
  }
  /* поставка 65: динамика найма по видам — из рядов hit, hcd, hst датасета 2а; виды в сумме — найм месяца */
  {
    const lpS=D.reportLeaves(A.st()), hk=D.hireKinds(lpS), pr=A.go('hiring','profile');
    if(R.has('hcd')){
      const hy=D.yoySeries(lpS,'hire').cur;
      /* 26.10-б: «Найм, чел» год к году, виды — в подсказке месяца */
      ok(!!hk&&hk.every((p,m)=>p.co+p.cand+p.int===(hy[m]||0))&&/Найм, чел/.test(pr)&&/· Из учебной группы в боевую/.test(pr),
        'найм по видам: '+['co','cand','int'].map(k=>k+' '+hk.reduce((a,p)=>a+p[k],0)).join(', ')+' с января');
    }else ok(!hk&&/Найм, чел/.test(pr)&&!/· Найм в компанию/.test(pr.split('Откуда пришли')[0]),
      'найм по видам без hcd / hst — «Найм, чел» без видов в подсказке, не выдуманные числа');
  }
  /* портрет на настоящих значениях: пол — полоса и карточки, возраст — кусок на каждую группу с людьми,
     каждый окрашен; среднего возраста в пробнике нет (появится с таблицей состава). 26.10: воронки численности нет
     совсем — и плашки «в разработке» на портрете нет (специализации, формат работы и регион — настоящие) */
  const pt=A.go('structure','portrait'), ages=D.mixCats('age');
  const segs=(pt.split('<div class="shbar')[2]||'').split('</div>')[0].match(/<span[^>]*>/g)||[];
  const ageN=D.mixParts(D.reportLeaves(A.st()),'age').filter(v=>v>0).length;
  ok(/<div class="shbar/.test(pt)&&segs.length===ageN&&segs.every(x=>/background:var\(--pt-(s\d|na)\)/.test(x))&&
    /* поставка 73: средний возраст — только с полем age (разрез e) */
    !/class="dev-note/.test(pt)&&!/Воронка/.test(pt)&&/средний возраст/.test(pt)===(D.avgAge(D.reportLeaves(A.st()),[])!=null),
    'портрет на настоящих значениях: '+ages.length+' возрастных групп полосой, каждая окрашена; без воронки и «в разработке»');
  /* уровень позиции: сеньорность по ступеням (Junior+ сразу за Junior, n/a в конце), стаж — по сроку */
  const sen=D.mixCats('seniority').map(c=>c.name), ten=D.mixCats('tenure');
  const na=n=>/^\s*(n\/?a|н\/?д|не указан[оа]?|-)\s*$/i.test(n);
  const plusOk=sen.every((n,i)=>!/\+$/.test(n)||sen.indexOf(n.slice(0,-1))<0||sen[i-1]===n.slice(0,-1));
  const naLast=sen.every((n,i)=>!na(n)||sen.slice(i).every(na));
  const tb=ten.filter(c=>!c.na).map(c=>D.bound(c.name,'mon')), tenOk=tb.every((v,i)=>!i||v>=tb[i-1]);
  const lv=A.go('structure','level');
  /* 23.10: стаж — пилюлей сверху, «Стаж» в подписях не повторяется; сеньорность и грейды — общими таблицами */
  ok(plusOk&&naLast&&tenOk&&(lv.match(/<section class="pf-s">/g)||[]).length===3&&(lv.match(/<div class="bt-group">/g)||[]).length===2&&
    lv.indexOf('class="shbar')<lv.indexOf('<div class="bt-group">')&&ten.every(c=>!/^\s*стаж\s/i.test(c.name)),
    'уровень позиции на настоящих значениях: '+sen.length+' ступеней и '+ten.length+' групп стажа по порядку, стаж пилюлей без слова «Стаж», сеньорность и грейды таблицами');
  /* мониторинг на настоящих данных: пока нет витрины по неделям — месяцы из основной таблицы */
  const mo=A.go('monitor','activity'), MD=D.monData(rl);
  if(R.has('hrn')&&MD&&MD.daily){
    /* поставка 71: мониторинг по дням — KPI последнего закрытого месяца = строке выбранного юнита, линии часов и звонков */
    const lc=MD.months[MD.months.length-1], k=R.n-1-(D.PARTIAL?1:0), v=c=>arr(scopeRow,c)[k];
    const hrs=v('hrs'), hrn=v('hrn'), tlk=v('tlk');
    ok(['ab25','ab5','we25','we5','t23','t35','t5'].every(c=>lc[c]===Math.round(v(c)))&&
       near(lc.hours,hrn?+(hrs/hrn).toFixed(2):null)&&near(lc.talk,hrs?+(tlk/hrs*100).toFixed(1):null)&&
       !/class="kpi mk/.test(mo)&&!/mon-ph/.test(mo)&&/Доля звонков в Толк/.test(mo)&&/data-pmark="0"/.test(mo),
      'мониторинг по дням: прогулы '+(lc.ab25+lc.ab5)+', выходные '+(lc.we25+lc.we5)+', звонки 20–30% '+lc.t23+
      ', '+lc.hours+' ч/день, звонки '+lc.talk+'% — как в строке юнита; линии часов и звонков, плашек KPI нет (30.10)');
  }else ok(!/class="kpi mk/.test(mo)&&/data-pmark="0"/.test(mo)&&!/data-mongran/.test(mo),
    'мониторинг: категории по месяцам из основной таблицы, недели и звонки — «в разработке»');
  /* 19.10, заказчик: окно настройки как в HRBP HUB — дерево всего справочника, логин руководителя
     и поиск по нему, у строк и кнопок фильтров — сколько людей попадёт в выбор (fd справочника) */
  {
    const su=A.setup(), rowsN=(su.match(/data-upick="/g)||[]).length;
    if(R.pick.ok){
      /* поставка 69: у зоны доступа дерево начинается с её корня, у корня — численность выбранного юнита-корня */
      const zr=R.pick.root, zEsc=zr.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const top=+((su.match(new RegExp('data-upick="'+zEsc+'"[^>]*>[\\s\\S]*?<span class="ut-c[^"]*">([\\d\\s ]+)<'))||[])[1]||'').replace(/\s/g,'');
      const baseHc=zr==='T'?Math.round(arr(baseRow,'hc')[R.n-1]):R.pick.count(zr,{act:D.hcSel(D.DEFAULT_STATE)});
      const sv=(su.split('|')[2].match(/<span class="opt-n">([\d\s ]+)</g)||[]).map(x=>+x.replace(/\D/g,''));
      const hd=R.pick.all().map(p=>R.pick.info(p)).find(i=>i&&i.head);
      const sq=hd?A.setup(hd.head.slice(0,4)):'';
      ok(rowsN>0&&top===baseHc&&sv.length===3&&sv[1]+sv[2]===sv[0]&&/После «Применить»/.test(su)&&
         (!hd||(/<mark class="ut-hl">/.test(sq)&&/class="ut-h"/.test(su))),
        'окно настройки: дерево '+R.pick.all().length+' узлов, у корня '+top+(zr==='T'?' = компания':' = корень зоны')+', штат + не штат = все'+
        (hd?', поиск по логину':', логинов в справочнике нет'));
    } else ok(rowsN>0&&!/class="ut-c/.test(su)&&!/opt-n/.test(su),'окно настройки: прежний датасет без fd — дерево без чисел');
  }
  /* поставка 69 (Антон, вопрос 10): зона доступа — выбрать можно только свою ветку; предки корня зоны в пути
     текстом, без кнопок и без «Уровнем выше» */
  if(R.pick.root!=='T'){
    const anc=D.NODES.filter(n=>n.anc), hd=A.head(), su=A.setup();
    ok(anc.length>0&&R.pick.all().every(p=>!(D.NODE_BY_PATH[p]||{}).anc)&&
       anc.every(n=>hd.indexOf('data-crumb="'+n.path+'"')<0&&su.indexOf('data-upick="'+n.path+'"')<0)&&
       (D.DEFAULT_STATE.unit!==R.pick.root||!/Уровнем выше/.test(hd))&&R.noAccess===false,
      'зона доступа: '+R.pick.roots.length+' корень, '+anc.length+' предка в пути текстом, выбрать выше зоны нельзя');
  }
  /* поставка 66 (посещения Адели): «Офис» на настоящих — календарь из разрезов dw / do выбранного юнита (в сумме —
     рабочие дни двух месяцев), бронирование и руководители — из рядов ответа, города офиса — из разреза oc; имя
     руководителя в окне настройки и поиск по нему */
  if(D.OFF_LIVE.cal&&D.OFF_LIVE.bk&&D.OFF_LIVE.seg&&D.OFF_LIVE.city){
    const cal=D.attLast(rl), sw=D.attByDow(rl).reduce((a,d)=>a+d.w,0);
    /* поставка 90: офисные разрезы — за закрытый месяц, календарь — два закрытых месяца */
    const L=R.n-1-(D.LAST-D.PER_I), wd2=arr(scopeRow,'wday')[L]+arr(scopeRow,'wday')[L-1];
    const bk=arr(scopeRow,'bk')[L], bkv=arr(scopeRow,'bkv')[L], vsv=arr(scopeRow,'vsv')[L];
    const hwd=arr(scopeRow,'hwd')[L], hov=arr(scopeRow,'hov')[L];
    const x=D.officeCross(rl,null,null), viol=D.perVal(rl,'booking_viol');
    const oc=x.cities.reduce((a,c)=>a+c.visits,0);
    const raw=String(scopeRow.mx).split('\n').filter(l=>l.indexOf('oc\t')===0).reduce((a,l)=>a+ +l.split('\t')[2],0);
    const ofA2=A.go('office','attend'), ofB2=A.go('office','booking');
    ok(cal.length===2&&Math.round(sw)===Math.round(wd2)&&near(viol,bk+vsv?+((bkv+vsv)/(bk+vsv)*100).toFixed(2):null)&&
       x.segs[0].att===(hwd?+(hov/hwd*100).toFixed(1):0)&&Math.round(oc)===Math.round(raw)&&/Город офиса/.test(ofA2)&&
       /Бронь без прихода/.test(ofB2),
      'офис на настоящих: календарь — рабочие дни '+Math.round(sw)+' = ряды двух месяцев, нарушения брони '+
      D.fmtVal('booking_viol',viol)+', руководители '+x.segs[0].att+'%, городов '+x.cities.length);
    const hn=R.pick.all().map(p=>R.pick.info(p)).find(i=>i&&/ /.test(i.hname)), last=hn?hn.hname.split(' ').pop():'';
    const sq=hn?A.setup(last.slice(0,4).toLowerCase()):'';
    /* поставка 83: в строке дерева — логин руководителя, ФИ и численность — в подсказке; поиск по фамилии работает */
    ok(!!hn&&sq.indexOf(hn.name)>=0&&sq.indexOf('<span class="ut-h">'+hn.head)>=0&&sq.indexOf(hn.hname)>=0&&
       !/class="ut-l"/.test(sq),
      'окно настройки: логин под юнитом, ФИ — в подсказке, поиск по фамилии («'+last.slice(0,4)+'»)');
  }
  /* 26.10-б, правки п. 8: текучесть по инициатору — из разреза xim выбранного юнита; в сумме по инициаторам — текучесть
     месячная; график первым в «Почему уходят», таблицы под ним. П. 1: движение по специализациям — из hsp / xsp */
  {
    const xs=D.exitInitTurnover(rl), rv=A.go('turnover','reasons'), mv=A.go('movement','dynamics');
    if(R.scopeMix&&R.scopeMix('xim')){
      const y=D.yoySeries(rl,'turnover_m'), sumAt=i=>xs.reduce((a,x)=>a+(x.cur[i]||0),0);
      ok(xs.length>0&&y.cur.every((v,i)=>v==null||Math.abs(sumAt(i)-v)<0.05)&&
        rv.indexOf('Текучесть по инициатору')<rv.indexOf('bt-cap">Инициатор увольнения')&&
        /data-exitini=/.test(rv),'текучесть по инициатору: '+xs.map(x=>x.name).join(', ')+' — в сумме текучесть месячная, график над таблицами');
      /* 27.10-в, п. 11: накопительная по инициатору — под месячной; в сумме по инициаторам — текучесть накопительная */
      const yy=D.yoySeries(rl,'turnover_y'), cumAt=i=>xs.reduce((a,x)=>a+(SC.cumY(x.cur)[i]||0),0);
      ok(yy.cur.every((v,i)=>v==null||Math.abs(cumAt(i)-v)<0.1)&&
        rv.indexOf('Накопительная текучесть по инициатору')>rv.indexOf('Текучесть по инициатору')&&
        rv.indexOf('Накопительная текучесть по инициатору')<rv.indexOf('bt-cap">Инициатор увольнения'),
        'накопительная по инициатору — под месячной, в сумме = текучесть накопительная');
    }else ok(xs===null&&/Придёт со следующим обновлением отчёта/.test(rv),'текучесть по инициатору: датасет без xim — «в разработке»');
    const sm=D.specMovement(rl), h=Object.values(R.mixVals('hsp')||{}).length;
    ok(!h||sm.length>0&&/Движение по специализациям/.test(mv)&&mv.indexOf('Движение по специализациям')>mv.indexOf('Переводы внутри компании')&&
      /* 31.10, п. 7: строки — и специализации без движения, но с численностью на начало или конец */
      sm.every(z=>z.hire+z.tin+z.exit+z.tout+(z.hc0||0)+(z.hc1||0)>0)&&sm.every(z=>z.hc1!=null),
      'движение по специализациям: '+sm.length+' специализаций, после переводов, на начало и конец');
  }
  const nSt=Object.keys(R.mixVals('xs')||{}).length, who=A.go('turnover','who');
  const st=(who.split('bt-group').find(x=>/>Стрим</.test(x))||'');
  ok(nSt<=9||/>Остальные<span class="unit-sub">\d+ стрим/.test(st)||(st.match(/<tr/g)||[]).length<=10,
    'стримы ушедших: '+(nSt<=9?'все '+nSt:'8 из '+nSt+' и «Остальные»'));
}
let exp='';
try{A.go('turnover','dynamics');exp=A.expAll();ok(true,'«раскрыть всё» на дереве пробника')}
catch(e){ok(false,'«раскрыть всё» падает: '+e.message)}
const shown=R.nodes.filter(n=>n.direct&&!n.hide&&n.path.split('/').length-D.DEFAULT_STATE.unit.split('/').length<=3);
ok(/Напрямую в «/.test(exp)===shown.length>0,'строка «Напрямую в «X»» в раскрытой таблице — там, где есть свои люди ('+shown.length+')');
ok(R.nodes.filter(n=>n.direct&&n.hide).every(n=>!new RegExp('data-node="'+n.path.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')+'"').test(exp)),
  'пустая «Напрямую» не показана, но в суммах участвует (сверка листьев выше)');
ok(!/data-openunit="[^"]*\/·"/.test(exp),'у строки «Напрямую» нет «Открыть юнит»');
ok(!/NaN|undefined/.test(html.replace(/data-[a-z-]+="[^"]*"/g,'')),'в разметке нет NaN и undefined');
ok(/dev-tag/.test(html)&&/dev-sum/.test(html),'метрики без источника помечены «в разработке», сводка готовности на One-pager');
/* плашки «в разработке» по вкладкам: с колонками 12.10 у живых вкладок плашки нет */
const tgF=A.go('tgrowth','flow'), ofD=A.go('office','attend'), ofC=A.go('office','calendar'), ofB=A.go('office','booking');
/* поставка 66: посещения Адели в ответе — вкладки «Офиса» без «в разработке» */
const OFL=D.OFF_LIVE, offAll=OFL.cal&&OFL.seg&&OFL.city&&OFL.bk;
ok(hasNew?!/dev-note/.test(tgF)&&(offAll?!/dev-note/.test(ofD+ofC+ofB)
           :/Посещаемость по месяцам — настоящая/.test(ofD)&&/Посещаемость за месяц — настоящая/.test(ofC))
         :/dev-note/.test(tgF)&&/dev-note/.test(ofD),
  hasNew?'плашки: решения T-роста и посещаемость — без «в разработке», '+(offAll?'вкладки офиса — тоже':'календарь офиса — с уточнением')
        :'плашки: T-рост и посещаемость — «в разработке»');
/* 27.10-в, п. 19: грейды 20 и выше — одной категорией «20+», после 19; п. 5 и 15: «Остальные» городов офиса раскрываются */
{
  const rawG=new Set();rows.forEach(r=>String(r.mx||'').split('\n').forEach(l=>{const f=l.split('\t');if(/^(gr|xg|hg)$/.test(f[0])&&+f[1]>=20)rawG.add(f[1])}));
  if(rawG.size){
    const gc=D.MIX_BY_KEY.grade.cats.map(c=>c.name), ex=D.exitProfile(rl,'ytd').grade.map(x=>x.name);
    ok(gc.filter(n=>/20\+/.test(n)).length===1&&!gc.some(n=>/^(Грейд )?2\d$/.test(n))&&/20\+/.test(gc.filter(n=>!/Не указано/.test(n)).slice(-1)[0])&&
      ex.some(n=>/20\+/.test(n))&&!ex.some(n=>/^(Грейд )?2\d$/.test(n)),'грейды '+[...rawG].sort().join(', ')+' — одной категорией «20+» в конце: '+gc.join(', '));
  }
  const at=A.go('office','attend'), nC=(at.match(/data-btexp="rest:ocity"/g)||[]).length;
  if(nC){const op=A.mixOpen(['rest:ocity']);A.mixOpen([]);
    ok(/class="urow" data-btexp="rest:ocity"/.test(at)&&(op.match(/<tr class="lvl2"/g)||[]).length>=1,'города офиса: первые 10 и «Остальные», раскрываются')}
}
/* 27.10-в, п. 14: нарушения брони по городам (разрезы ov / ob) — после «Бронирований и посещений», в сумме = нарушениям
   бронирования месяца; без разрезов в ответе — строка «появятся со следующим обновлением», не условные числа */
{
  const vc=D.violByCity(rl), bq=D.bookingQuality(rl), bk=A.go('office','booking');
  if(D.OFF_LIVE.vcity)ok(vc.length>0&&Math.abs(vc.reduce((a,c)=>a+c.viol,0)-bq.viol)<=vc.length&&
      bk.indexOf('Нарушения бронирования по городам')>bk.indexOf('Бронирования и посещения'),
    'нарушения брони по городам: '+vc.length+' городов, в сумме '+vc.reduce((a,c)=>a+c.viol,0)+' = нарушениям месяца '+bq.viol);
  else if(D.OFF_LIVE.bk)ok(vc===null&&/появятся, когда ноутбук отчёта обновят/.test(bk),'нарушения брони по городам: ответ без разреза — «появятся»');
}
/* поставка 71: T-рост по разрезам «Роста» выбранного юнита (rs, rm, rq) — статусы в сумме = людям разреза, успешно
   закрытые по месяцам = rm, успешность = rq; вкладки без «в разработке». Без разрезов — условные цифры с плашкой */
{
  const tg=A.go('tgrowth','grades'), ts=A.go('tgrowth','spec');
  if(D.ROST_LIVE){
    const mx={};String(scopeRow.mx||'').split('\n').forEach(l=>{const f=l.split('\t');if(/^r[smq]$/.test(f[0]))(mx[f[0]]=mx[f[0]]||{})[f[1]]=+f[2]});
    const sm=o=>Object.keys(o||{}).reduce((a,k)=>a+o[k],0), p=D.rostProfile(rl);
    /* на графике — 12 месяцев отчёта; rm — с начала сетки */
    /* файл 6, п. 5: год к году частями — этот год (по текущий месяц) и прошлый; части в сумме = месяцу */
    const okM=t=>Object.keys(mx.rm||{}).filter(k=>{const f=k.split('|'), y=+f[0].slice(0,4), m=+f[0].slice(5,7)-1;
      return f[3]==='ok'&&f[1].indexOf(t)>=0&&(y===D.YEAR_PREV||y===D.YEAR_CUR&&m<D.CUR_LEN)}).reduce((a,k)=>a+mx.rm[k],0);
    const pm=f=>{const y=f.yoy, s=a=>a.reduce((x,v)=>x+v,0);return y.cur.every((v,m)=>v===y.rost[m]+y.tat[m])&&y.prev.every((v,m)=>v===y.prevR[m]+y.prevT[m])?s(y.cur)+s(y.prev):-1};
    const rq=(t,fl)=>Object.keys(mx.rq||{}).filter(k=>{const f=k.split('|');return f[0]===t&&f[1]===fl}).reduce((a,k)=>a+mx.rq[k],0);
    const pa=x=>x.reduce((a,r)=>a+r.apps,0);
    /* поставка 73: итог «за 12 месяцев» — как эталон «Роста», по окну rq (с начала месяца год назад) */
    const rqOk=t=>Object.keys(mx.rq||{}).filter(k=>{const f=k.split('|');return f[0]===t&&f[2]==='ok'}).reduce((a,k)=>a+mx.rq[k],0);
    ok(p.real&&p.hc===sm(mx.rs)&&p.st.reduce((a,s)=>a+s.n,0)===p.hc&&pm(p.grade)===okM('g')&&pm(p.spec)===okM('s')&&p.grade.rost+p.grade.tat===rqOk('g')&&p.spec.rost+p.spec.tat===rqOk('s')&&
       pa(p.grade.tatT)===rq('g','1')&&pa(p.grade.rostT)<=rq('g','0')&&!/dev-note/.test(tg+ts),
      'T-рост по «Росту»: статусы '+p.st.map(s=>s.key+' '+s.n).join(', ')+' = '+p.hc+' чел; успешно закрытые по месяцам — грейд '+
      pm(p.grade)+', специализация '+pm(p.spec)+'; без «в разработке»');
  }else ok(/dev-/.test(tg),'T-рост по грейдам: без разрезов «Роста» — условные цифры с плашкой');
}
/* 28.10, п. 1: движение по специализациям — найм, переводы в, отток, переводы из; с переходами по специализации (tsh)
   в сумме = картам с начала года (найм — по дню события, переводы — как карточки); без них — без колонок переводов */
{
  const sm=D.specMovement(rl), S=k=>sm.reduce((a,z)=>a+z[k],0), Y=k=>D.sumWin(D.aggregate(rl,k),'ytd'), mv=A.go('movement','dynamics');
  /* 31.10, п. 10: с флагами смены специализации (ноутбук с поставки 87: есть sp0) переводы в и из — смены специализации, с
     переводами юнита не сравниваются; на начало + движение = на конец не требуется (флаги и численность — разные срезы) */
  const FSP=!!R.scopeMix('sp0');
  if(D.SPM_TRF)ok(Math.abs(S('hire')-Y('hire'))<=sm.length&&(FSP||Math.abs(S('tin')-Y('transfer_in'))<=sm.length&&
      Math.abs(S('tout')-Y('transfer_out'))<=sm.length)&&Math.abs(S('exit')-Y('attrition'))<=sm.length&&/Переводы из<\/th>/.test(mv)&&
      (!FSP||/На начало<\/th>/.test(mv)&&S('hc1')>0),
    'движение по специализациям: найм '+S('hire')+' = '+Y('hire')+', в '+S('tin')+' = '+Y('transfer_in')+', отток '+S('exit')+' = '+
      Y('attrition')+', из '+S('tout')+' = '+Y('transfer_out'));
  else ok(!/Переводы из<\/th>/.test(mv)&&(!sm.length||/появятся, когда ноутбук отчёта обновят/.test(mv)),'движение по специализациям: без переходов по специализации — найм и отток');
  /* поставка 90 (заказчик): переводы по специализациям — флаги переводов под фильтры ИЛИ смены специализации, на конец — на
     конец закрытого месяца (sp1): на начало + найм + переводы в − отток − переводы из = на конец — в ИТОГО и по строкам */
  if(D.SPM_TRF&&R.scopeMix('sp1')){
    const bal=z=>z.hc0+z.hire+z.tin-z.exit-z.tout-z.hc1, off=sm.filter(z=>Math.abs(bal(z))>0.5);
    ok(Math.abs(S('hc0')+S('hire')+S('tin')-S('exit')-S('tout')-S('hc1'))<=0.5&&!off.length,
      'движение по специализациям сходится: '+S('hc0')+' + '+S('hire')+' + '+S('tin')+' − '+S('exit')+' − '+S('tout')+' = '+S('hc1')+
      (off.length?'; не сходятся строки: '+off.map(z=>z.name+' '+bal(z)).join(', '):''));
  }
}
/* ревью 100: у выбранного подразделения (строка ниже юнита) — его же уходы по инициатору и движение по специализациям:
   в сумме по инициаторам — его текучесть, таблица специализаций сходится, отток = его отток с начала года */
{
  const st=A.st(), kids=D.NODES.filter(n=>n.parent===st.unit&&!n.direct&&!n.hide);
  if(R.scopeMix('xim')&&kids.length&&D.NODES.some(n=>n.leaf&&!n.direct&&n.parent&&(R.mix(n.path)||{}).xim)){
    const bad=[];
    kids.forEach(k=>{
      const lp=D.leavesUnder(k.path).map(l=>l.path), xs=D.exitInitTurnover(lp)||[], y=D.yoySeries(lp,'turnover_m');
      if(!y.cur.every((v,i)=>v==null||Math.abs(xs.reduce((a,x)=>a+(x.cur[i]||0),0)-v)<0.05))bad.push(k.name+': инициатор');
      if(D.SPM_TRF&&R.scopeMix('sp1')){
        const sm=D.specMovement(lp), S=q=>sm.reduce((a,z)=>a+z[q],0);
        if(Math.abs(S('hc0')+S('hire')+S('tin')-S('exit')-S('tout')-S('hc1'))>0.5||
          Math.abs(S('exit')-D.sumWin(D.aggregate(lp,'attrition'),'ytd'))>0.5)bad.push(k.name+': специализации');
      }
    });
    ok(!bad.length,'по подразделениям ('+kids.length+'): инициатор = текучесть, специализации сходятся'+(bad.length?' — '+bad.join('; '):''));
  }
}
/* поставка 73, 29.10, п. 8: средний возраст — из разреза e (возраст в годах) выбранного юнита */
{
  const e={};String(scopeRow.mx||'').split('\n').forEach(l=>{const f=l.split('\t');if(f[0]==='e')e[f[1]]=+f[2]});
  const n=Object.values(e).reduce((a,b)=>a+b,0), want=n?Object.keys(e).reduce((a,k)=>a+(+k)*e[k],0)/n:null;
  const got=D.avgAge(rl,[]), ps=A.go('structure','portrait');
  if(n)ok(Math.abs(got-want)<0.01&&/средний возраст команды/.test(ps),'средний возраст '+got.toFixed(1)+' — из поля age ('+n+' чел), в портрете');
  else ok(got==null,'средний возраст: без поля age — не показан');
}
/* история по главам (итерация 32): по демо-цифрам выводов нет, по живым — есть */
/* поставка 50: с витриной вакансий глава вакансий живая — демо-глава тогда «Итоги ревью» */
/* 27.10-в, п. 4: ревью скрыто — демо-глава теперь «Кто пользуется?» вкладки AI (31.10) */
const hv=R.has('vop')?A.go('ai','who'):A.go('hiring','vacancies'), td=A.go('turnover','dynamics');
/* «Зачем смотреть» на демо-главе есть — это объяснение, а не вывод из цифр */
ok(!/<div class="st-head"><h3>/.test(hv)&&/<div class="st-head"><h3>/.test(td)&&/<div class="st-why">/.test(hv),
  'история: у демо-главы нет вывода (только «зачем смотреть»), у живой (отток) — есть');

/* One-pager (13.10, механика HRBP HUB): у живых метрик — факты с отметками на
   полотне «год к году», у заглушек — честное «выводов нет»; в «Что видно в данных»
   заглушек нет */
const all=D.METRICS.filter(m=>D.metricVisible(m.key,D.DEFAULT_STATE)).map(m=>m.key);
const opAll=A.op(all), stories=opAll.split('<div class="op-story"').slice(1);
const live=all.filter(k=>!D.isStub(k)), stubs=all.filter(k=>D.isStub(k));
const ov=window.TPINSIGHTS.overview(D.DEFAULT_STATE,D.reportLeaves(D.DEFAULT_STATE),D.benchmarkLeaves(D.DEFAULT_STATE));
/* поставка 69: в формулах «О метрике» нет технических имён рядов */
const techIn=stories.map(x=>(x.match(/<mtext>([a-z_]+)<\/mtext>/g)||[])).flat();
ok(!techIn.length,'формулы «О метрике» — словами, без технических имён'+(techIn.length?': '+techIn.join(' '):''));
ok(stories.length===all.length&&
   stories.filter(x=>/поэтому выводов нет/.test(x)).length===stubs.length&&
   stories.filter(x=>/<ol class="op-ins">|Заметных изменений за год нет/.test(x)).length===live.length&&
   ov.every(x=>!D.isStub(x.key))&&A.op([])&&true,
  'one-pager: «Что видно» у '+live.length+' живых метрик, у '+stubs.length+' заглушек — «выводов нет», в сводке заглушек нет');
if(stories.filter(x=>/<ol class="op-ins">|Заметных изменений за год нет/.test(x)).length!==live.length)
  console.log('       без «Что видно»: '+all.filter((k,i)=>!D.isStub(k)&&!/<ol class="op-ins">/.test(stories[i]||'')).join(', ')+
    '\n       '+all.map((k,i)=>!D.isStub(k)&&!/<ol class="op-ins">/.test(stories[i]||'')?stories[i].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,400):'').filter(Boolean).join('\n       '));

/* 20.10, «сначала выводы»: карточки на настоящих числах — без заглушек, одна история —
   одна карточка, у каждого блока есть вывод (или «всё спокойно») и «где это происходит» */
{
  const I=window.TPINSIGHTS, S0=D.DEFAULT_STATE, cs=I.cards(S0,D.reportLeaves(S0),D.benchmarkLeaves(S0)), home=A.home0();
  const tops=D.visibleBlocks(S0).map(b=>A.top(b.key));
  ok(/<div class="in-lead">/.test(home)&&cs.every(c=>!D.isStub(c.key)&&c.head&&/class="mini"/.test(c.chart))&&
    cs.filter(c=>/С января ушли/.test(c.body)).length<=1&&
    /* 30.10, шаг 2: без подразделений ниже «где» не показывается — карточка вывода во всю ширину */
    /* 31.10: «Саммари» — только текст, без таблиц (файл итерации, п. 2 и 6) */
    tops.every(h=>/class="bk-sum (high|mid|good|none)"/.test(h)&&/bk-top [a-z]+ solo/.test(h)&&!/class="bk-wh"/.test(h)&&/id="bk-det"/.test(h)),
    'главная и блоки «сначала выводы»: '+cs.length+' '+(cs.length===1?'вывод':'выводов')+' без заглушек, у '+tops.length+' блоков — вывод текстом, без таблиц');
/* поставка 81: T-рост — направление перехода «текущее → желаемое» в таблицах смены грейда и специализации */
{
  const rp=D.rostProfile(D.reportLeaves(D.DEFAULT_STATE)), rows=rp.grade.rostT.concat(rp.spec.rostT);
  const newRq=rows.length&&rows.some(x=>/ → /.test(x.name));
  ok(!rows.length||newRq||!Object.keys(window.TP_REAL.scopeMix('rq')||{}).some(v=>v.split('|').length>4),
    'T-рост: строки смены грейда и специализации — «текущее → желаемое»'+(newRq?' ('+rows[0].name+')':' (ответ до поставки 81 — только желаемое)'));
}
}
/* 30.10: доли и средние, которые за неполный месяц неточны, в таблицах и выводах — по закрытому месяцу */
ok(['time_to_fill','tgrowth_conv','underwork','overwork'].every(k=>!D.PARTIAL||D.lastIdx(k)===D.LAST-1),
  'срок закрытия, конверсия T-роста, недоработчики и переработчики — по закрытому месяцу');
/* поставка 89: итог за период на графиках — потоки суммой с января по закрытый месяц, накопительная — на закрытый месяц,
   численность — сейчас; тот же период год назад; в шапке графика найма — строка итога */
{
  const lp=D.reportLeaves(D.DEFAULT_STATE), c=D.CUR_LEN-1-(D.PARTIAL?1:0), sum=a=>a.slice(0,c+1).reduce((t,v)=>t+(v||0),0);
  const yh=D.yoySeries(lp,'hire'), ph=D.periodTotal(lp,'hire'), yt=D.yoySeries(lp,'turnover_y'), pt=D.periodTotal(lp,'turnover_y');
  const yc=D.yoySeries(lp,'hc_total'), pc=D.periodTotal(lp,'hc_total'), hire=A.top('hiring');
  ok(c<0||ph&&Math.abs(ph.v-sum(yh.cur))<1e-9&&Math.abs(ph.pv-sum(yh.prev))<1e-9&&/^Всего за /.test(ph.head)&&
    pt&&pt.v===yt.cur[c]&&/^На конец /.test(pt.head)&&pc&&pc.v===yc.cur[D.CUR_LEN-1]&&!pc.strip&&
    /class="pt-line"/.test(hire),
    'итог за период: найм '+(ph&&ph.cur)+' ('+(ph&&ph.head)+'), год назад '+(ph&&ph.prev)+'; накопительная текучесть и численность — на дату');
}
console.log(bad?'ПРОВАЛ: '+bad+' проверок':'пробник: все проверки прошли');
process.exit(bad?1:0);

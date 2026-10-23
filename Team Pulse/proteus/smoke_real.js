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
  .concat([['wday','wday'],['ovis','ovis'],['tgrowth_pass','gapr'],['tgrowth_deny','gdec']].filter(([,c])=>R.has(c)));
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
  ok(near(D.lastVal(rl,'underwork'),t?+(pl/t*100).toFixed(2):null)&&near(D.lastVal(rl,'overwork'),t?+(ph/t*100).toFixed(2):null)&&
    !D.isStub('underwork')&&!D.isStub('overwork'),
    'недоработчики и переработчики = недоработка / переработка ко всем четырём категориям мониторинга — живые');
}
/* разрезы (схема 15.10): численность по разрезу за последний месяц и увольнения
   с начала года — ровно числа колонки mx выбранного юнита */
{
  const mx={};
  String(scopeRow.mx||'').split('\n').forEach(l=>{if(!l)return;const f=l.split('\t');(mx[f[0]]=mx[f[0]]||{})[f[1]]=+f[2]});
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
let ry=0;for(let k=jan;k<=i;k++)ry+=avg[k]?+(reg[k]/avg[k]*100).toFixed(2):0;
ok(near(D.lastVal(rl,'regret'),+ry.toFixed(2)),'regret = накопительная доля нежелательных увольнений к ССЧ');
ok(D.isStub('vac_open')===!R.has('vop')&&D.isStub('ai_penetration')===!R.has('aip')&&D.isStub('nonregret')===!R.has('nreg')&&
  !D.isStub('turnover_m')&&!D.isStub('hc_total'),
  'заглушки помечены: вакансии, AI и желательный отток — '+(R.has('vop')?'живые (поставка 50)':'демо')+', численность и текучесть — живые');
/* 21.10, поставка 50: метрики из прод-ноутбуков HQ и УС — по формулам из настоящих рядов */
if(R.has('nreg')){
  const nr=arr(scopeRow,'nreg');
  let ny=0;for(let k=jan0();k<=i;k++)ny+=avg[k]?+(nr[k]/avg[k]*100).toFixed(2):0;
  ok(near(D.lastVal(rl,'nonregret'),+ny.toFixed(2)),'желательный отток = накопительная доля желательных увольнений к ССЧ');
}
if(R.has('vop')){
  const vo=arr(scopeRow,'vop'), vc=arr(scopeRow,'vcl'), vd=arr(scopeRow,'vtd'), vn=arr(scopeRow,'vtn'), vj=arr(scopeRow,'vjn');
  let cj=0,cc=0;for(let k=jan0();k<=i;k++){cj+=vj[k];cc+=vc[k]}
  ok(near(D.lastVal(rl,'vac_open'),vo[i])&&near(D.lastVal(rl,'vac_closed'),vc[i])&&
    near(D.lastVal(rl,'time_to_fill'),vn[i]?+(vd[i]/vn[i]).toFixed(2):null)&&
    near(D.lastVal(rl,'junior_share'),cc?+(cj/cc*100).toFixed(2):null),
    'вакансии: открытые, закрытые, срок = дни / закрытые, доля джунов = закрытые джунами / закрытые с начала года');
  const vb=D.vacancyBreakdown(rl), sumK=k=>rl.reduce((a,p)=>{const o=(R.mix(p)||{})[k]||{};return a+Object.keys(o).reduce((x,v)=>x+o[v],0)},0);
  ok(!!vb&&Math.abs(vb.status.reduce((a,r)=>a+r.value,0)-sumK('vs'))<=vb.status.length,
    'вакансии в разрезах: статусы открытых — из колонки mx');
}
if(R.has('aip')){
  ok(near(D.lastVal(rl,'ai_penetration'),arr(scopeRow,'aip')[i])&&near(D.lastVal(rl,'ai_wau'),arr(scopeRow,'aiw')[i]),
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
  const wd=arr(scopeRow,'wday')[i], ov=arr(scopeRow,'ovis')[i], ga=arr(scopeRow,'gapr')[i], gd=arr(scopeRow,'gdec')[i];
  ok(near(D.lastVal(rl,'office_att'),wd?+(ov/wd*100).toFixed(2):null),'посещаемость = посещения офиса / отработанные дни × 100');
  ok(near(D.lastVal(rl,'tgrowth_pass'),ga)&&near(D.lastVal(rl,'tgrowth_deny'),gd)&&
    near(D.lastVal(rl,'tgrowth_conv'),ga+gd?+(ga/(ga+gd)*100).toFixed(2):null),
    'T-рост: одобрено, отклонено, конверсия = одобрено / (одобрено + отклонено)');
  ok(!D.isStub('office_att')&&!D.isStub('tgrowth_conv')&&D.isStub('tgrowth_tat')&&D.isStub('booking_viol'),
    'посещаемость и решения T-роста — живые, T@T и бронирование — демо');
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
  const rows=(sec.match(/<tr class="urow/g)||[]).length+(/>Остальные<span class="unit-sub">/.test(sec)?1:0), rest=/>Остальные<span class="unit-sub">\d+ компани/.test(sec);
  /* 22.10: все компании с людьми, без «Остальных» */
  const nLive=D.MIX_BY_KEY.legal?D.mixParts(D.reportLeaves(A.st()),'legal',A.st().mixSel||[]).filter(v=>v>0).length:0;
  ok(!nLeg||(nLive<=9?rows===nLive&&!rest:rows===9&&rest),'компании на «Оформлении»: '+(nLive<=9?'все '+nLive:'первые 8 и «Остальные»'));
  ok((wk.match(/<div class="bt-group">/g)||[]).length===1&&/class="shbar/.test(wk)&&/class="row-body two"/.test(wk),
    'оформление: полоса и карточки, формат — карточками, компании таблицей; длинные названия — в две строки');
  /* портрет на настоящих значениях: пол — полоса и карточки, возраст — кусок на каждую группу с людьми,
     каждый окрашен; воронки и среднего возраста в пробнике нет (появятся с таблицей состава) */
  const pt=A.go('structure','portrait'), ages=D.mixCats('age');
  const segs=(pt.split('<div class="shbar')[2]||'').split('</div>')[0].match(/<span[^>]*>/g)||[];
  const ageN=D.mixParts(D.reportLeaves(A.st()),'age').filter(v=>v>0).length;
  ok(/<div class="shbar/.test(pt)&&segs.length===ageN&&segs.every(x=>/background:var\(--pt-(s\d|na)\)/.test(x))&&
    /class="dev-note/.test(pt)&&!/средний возраст/.test(pt),
    'портрет на настоящих значениях: '+ages.length+' возрастных групп полосой, каждая окрашена; воронка — «в разработке»');
  /* уровень позиции: сеньорность по ступеням (Junior+ сразу за Junior, n/a в конце), стаж — по сроку */
  const sen=D.mixCats('seniority').map(c=>c.name), ten=D.mixCats('tenure');
  const na=n=>/^\s*(n\/?a|н\/?д|не указан[оа]?|-)\s*$/i.test(n);
  const plusOk=sen.every((n,i)=>!/\+$/.test(n)||sen.indexOf(n.slice(0,-1))<0||sen[i-1]===n.slice(0,-1));
  const naLast=sen.every((n,i)=>!na(n)||sen.slice(i).every(na));
  const tb=ten.filter(c=>!c.na).map(c=>D.bound(c.name,'mon')), tenOk=tb.every((v,i)=>!i||v>=tb[i-1]);
  const lv=A.go('structure','level');
  ok(plusOk&&naLast&&tenOk&&(lv.match(/<section class="pf-s">/g)||[]).length===3&&/class="cch/.test(lv),
    'уровень позиции на настоящих значениях: '+sen.length+' ступеней и '+ten.length+' групп стажа по порядку, грейды столбцами');
  /* мониторинг на настоящих данных: пока нет витрины по неделям — месяцы из основной таблицы */
  const mo=A.go('monitor','activity');
  ok(/class="kpi mk"/.test(mo)&&/к прошлому месяцу/.test(mo)&&/class="kpi mk dev"/.test(mo)&&/data-pmark="0"/.test(mo)&&!/data-mongran/.test(mo),
    'мониторинг: категории по месяцам из основной таблицы, недели и звонки — «в разработке»');
  /* 19.10, заказчик: окно настройки как в HRBP HUB — дерево всего справочника, логин руководителя
     и поиск по нему, у строк и кнопок фильтров — сколько людей попадёт в выбор (fd справочника) */
  {
    const su=A.setup(), rowsN=(su.match(/data-upick="/g)||[]).length;
    if(R.pick.ok){
      const top=+((su.match(/data-upick="T"[^>]*>[\s\S]*?<span class="ut-c[^"]*">([\d\s ]+)</)||[])[1]||'').replace(/\s/g,'');
      const baseHc=Math.round(arr(baseRow,'hc')[R.n-1]);
      const sv=(su.split('|')[2].match(/<span class="opt-n">([\d\s ]+)</g)||[]).map(x=>+x.replace(/\D/g,''));
      const hd=R.pick.all().map(p=>R.pick.info(p)).find(i=>i&&i.head);
      const sq=hd?A.setup(hd.head.slice(0,4)):'';
      ok(rowsN>0&&top===baseHc&&sv.length===3&&sv[1]+sv[2]===sv[0]&&/После «Применить»/.test(su)&&
         (!hd||(/<mark class="ut-hl">/.test(sq)&&/class="ut-h"/.test(su))),
        'окно настройки: дерево '+R.pick.all().length+' узлов, у корня '+top+' = компания, штат + не штат = все'+
        (hd?', поиск по логину':', логинов в справочнике нет'));
    } else ok(rowsN>0&&!/class="ut-c/.test(su)&&!/opt-n/.test(su),'окно настройки: прежний датасет без fd — дерево без чисел');
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
const tgF=A.go('tgrowth','flow'), ofD=A.go('office','attend'), ofC=A.go('office','calendar');
ok(hasNew?!/dev-note/.test(tgF)&&/Посещаемость по месяцам — настоящая/.test(ofD)&&/Посещаемость за месяц — настоящая/.test(ofC)
         :/dev-note/.test(tgF)&&/dev-note/.test(ofD),
  hasNew?'плашки: решения T-роста и посещаемость — без «в разработке», календарь офиса — с уточнением'
        :'плашки: T-рост и посещаемость — «в разработке»');
/* история по главам (итерация 32): по демо-цифрам выводов нет, по живым — есть */
/* поставка 50: с витриной вакансий глава вакансий живая — демо-глава тогда «Итоги ревью» */
const hv=R.has('vop')?A.go('monitor','review'):A.go('hiring','vacancies'), td=A.go('turnover','dynamics');
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
ok(stories.length===all.length&&
   stories.filter(x=>/поэтому выводов нет/.test(x)).length===stubs.length&&
   stories.filter(x=>/<ol class="op-ins">/.test(x)).length===live.length&&
   ov.every(x=>!D.isStub(x.key))&&A.op([])&&true,
  'one-pager: «Что видно» у '+live.length+' живых метрик, у '+stubs.length+' заглушек — «выводов нет», в сводке заглушек нет');
if(stories.filter(x=>/<ol class="op-ins">/.test(x)).length!==live.length)
  console.log('       без «Что видно»: '+all.filter((k,i)=>!D.isStub(k)&&!/<ol class="op-ins">/.test(stories[i]||'')).join(', ')+
    '\n       '+all.map((k,i)=>!D.isStub(k)&&!/<ol class="op-ins">/.test(stories[i]||'')?stories[i].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,400):'').filter(Boolean).join('\n       '));

/* 20.10, «сначала выводы»: карточки на настоящих числах — без заглушек, одна история —
   одна карточка, у каждого блока есть вывод (или «всё спокойно») и «где это происходит» */
{
  const I=window.TPINSIGHTS, S0=D.DEFAULT_STATE, cs=I.cards(S0,D.reportLeaves(S0),D.benchmarkLeaves(S0)), home=A.home0();
  const tops=D.visibleBlocks(S0).map(b=>A.top(b.key));
  ok(/<div class="in-lead">/.test(home)&&cs.every(c=>!D.isStub(c.key)&&c.head&&/class="mini"/.test(c.chart))&&
    cs.filter(c=>/С января ушли/.test(c.body)).length<=1&&
    tops.every(h=>/class="bk-sum (high|mid|good|none)"/.test(h)&&/Где это происходит/.test(h)&&/id="bk-det"/.test(h)),
    'главная и блоки «сначала выводы»: '+cs.length+' '+(cs.length===1?'вывод':'выводов')+' без заглушек, у '+tops.length+' блоков — вывод и «где»');
}
console.log(bad?'ПРОВАЛ: '+bad+' проверок':'пробник: все проверки прошли');
process.exit(bad?1:0);

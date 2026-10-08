/* ============================================================================
   Смоук пробника без браузера: node proteus/smoke_real.js ответ.json [ещё.json …]

   Ответ — массив строк датасета teampulse_hub, как его получает чарт (stand/dataset.py
   --json). Модель строит proteus/real.js, дальше грузятся те же файлы, что в чарте,
   и проверяется то, на чём держится пробник:
   - лист «Напрямую в «X»» плюс дети ровно дают юнит — по каждому ряду и месяцу,
     поэтому агрегация макета (сумма листьев, потом деление) остаётся верной;
   - ИТОГО отчёта — строка выбранного юнита, база — строка base;
   - текучесть, regret и низкая оценка — по формулам из настоящих рядов;
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
  querySelectorAll(){return[]},
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
['data.js','draw.js','ui.js','insights.js',
 'screens/_block.js','screens/structure.js','screens/movement.js','screens/turnover.js',
 'screens/hiring.js','screens/tgrowth.js','screens/monitor.js','screens/office.js','screens/ai.js',
 'screens/onepager.js'].forEach(f=>require(path.join(dir,f)));
const probe=path.join(dir,'.app.probe.real.js');
fs.writeFileSync(probe,fs.readFileSync(path.join(dir,'app.js'),'utf8')+
  '\nmodule.exports={go:(t,sub)=>{S.tab=t;S.subTab=sub||null;S.selNode=null;render();return $("#view").innerHTML},'+
  '\n  expAll:()=>{expanded.clear();SC.expandableRows(SC.currentRoot(S)).forEach(p=>expanded.add(p));render(true);return $("#view").innerHTML},'+
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
const arr=(r,c)=>String(r['m_'+c]).split(',').map(Number);
const KEYS=[['hc_total','hc'],['hc_active','act'],['hc_avg','avg'],['hire','hire'],['attrition','fire'],
  ['transfer_in','tin'],['transfer_out','tout'],['regret_cnt','reg'],['plow','plow'],['prated','prat']];
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
ok(treeOk,'сумма листьев под каждым юнитом ответа = его строке ('+checked+' юнитов × 10 рядов × '+R.n+' мес)');
const rl=D.reportLeaves(D.DEFAULT_STATE), bl=D.benchmarkLeaves(D.DEFAULT_STATE);
ok(near(D.lastVal(rl,'hc_total'),arr(scopeRow,'hc')[R.n-1]),'ИТОГО = численность выбранного юнита в последнем полном месяце');
ok(bl.length===1&&near(D.lastVal(bl,'hc_total'),arr(baseRow,'hc')[R.n-1]),'база = строка base (вся компания под фильтрами)');
ok(D.MONTHS.length===12&&D.MONTHS_EXT.length===R.n&&D.MONTHS[11].y*12+D.MONTHS[11].m===+R.lm.slice(0,4)*12+(+R.lm.slice(5,7))-1,
  'окно — 12 месяцев до последнего полного ('+R.lm+'), сетка — с января прошлого года');

/* 2. формулы из настоящих рядов */
const i=R.n-1, fire=arr(scopeRow,'fire'), avg=arr(scopeRow,'avg'), reg=arr(scopeRow,'reg');
const tm=avg[i]?+(fire[i]/avg[i]*100).toFixed(2):null;
ok(near(D.lastVal(rl,'turnover_m'),tm),'текучесть месячная = увольнения / ССЧ × 100 ('+tm+'%)');
const jan=D.MONTHS_EXT.findIndex((m,k)=>k<=i&&m.m===0&&m.y===D.MONTHS_EXT[i].y);
let ty=0;for(let k=jan;k<=i;k++)ty+=avg[k]?+(fire[k]/avg[k]*100).toFixed(2):0;
ok(near(D.lastVal(rl,'turnover_y'),+ty.toFixed(2)),'текучесть накопительная = сумма месячных с января');
let ry=0;for(let k=jan;k<=i;k++)ry+=avg[k]?+(reg[k]/avg[k]*100).toFixed(2):0;
ok(near(D.lastVal(rl,'regret'),+ry.toFixed(2)),'regret = накопительная доля нежелательных увольнений к ССЧ');
const pl=arr(scopeRow,'plow')[i], pr=arr(scopeRow,'prat')[i];
ok(near(D.lastVal(rl,'low_perf'),pr?+(pl/pr*100).toFixed(2):null),'низкая оценка = «низкая» / оценённые');
ok(D.isStub('vac_open')&&D.isStub('ai_penetration')&&!D.isStub('turnover_m')&&!D.isStub('hc_total'),
  'заглушки помечены: вакансии и AI — демо, численность и текучесть — живые');

/* 3. экраны */
const CASES=[['onepager',null]];
Object.keys(SC.blocks).forEach(k=>SC.blocks[k].subTabs.forEach(([sub])=>CASES.push([k,sub])));
let scrOk=true, html='';
CASES.forEach(([t,s])=>{
  try{const h=A.go(t,s);if(!h||h.length<300){scrOk=false;console.log('    пустой экран',t,s)}html+=h}
  catch(e){scrOk=false;console.log('    падает',t,s,e.message)}
});
ok(scrOk,'все '+CASES.length+' экранов собираются на модели пробника');
let exp='';
try{A.go('turnover','dynamics');exp=A.expAll();ok(true,'«раскрыть всё» на дереве пробника')}
catch(e){ok(false,'«раскрыть всё» падает: '+e.message)}
const shown=R.nodes.filter(n=>n.direct&&!n.hide&&n.path.split('/').length-D.DEFAULT_STATE.unit.split('/').length<=3);
ok(/Напрямую в «/.test(exp)===shown.length>0,'строка «Напрямую в «X»» в раскрытой таблице — там, где есть свои люди ('+shown.length+')');
ok(R.nodes.filter(n=>n.direct&&n.hide).every(n=>!new RegExp('data-node="'+n.path.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')+'"').test(exp)),
  'пустая «Напрямую» не показана, но в суммах участвует (сверка листьев выше)');
ok(!/data-openunit="[^"]*\/·"/.test(exp),'у строки «Напрямую» нет «Открыть юнит»');
ok(!/NaN|undefined/.test(html.replace(/data-[a-z-]+="[^"]*"/g,'')),'в разметке нет NaN и undefined');
ok(/demo-tag/.test(html),'метрики без источника помечены «демо»');

console.log(bad?'ПРОВАЛ: '+bad+' проверок':'пробник: все проверки прошли');
process.exit(bad?1:0);

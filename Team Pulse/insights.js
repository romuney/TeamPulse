/* ============================================================================
   insights.js — движок предрасчитанных инсайтов. Неймспейс: window.TPINSIGHTS.

   Это не текстовый шаблон, а отбор фактов по порогам. Правило: нет факта выше
   порога — нет блока инсайтов, вместо него одна строка «отклонений нет».
   Никакой воды.

   Пороги вынесены сюда, чтобы крутить их не задевая экраны.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW;
const esc=U.esc;

const INS_GAP=10;      /* порог отклонения от базы или KPI, % */
const INS_TREND=3;     /* длина направленного тренда, месяцев */

function isBad(m,v,base){return m.better==='lower'?v>base:m.better==='higher'?v<base:false}

/* ============================================================================
   «Что видно» — механика HRBP HUB (13.10, заказчик: «в one-pager сделай
   инсайты как в HRBP HUB»). Два уровня, как там:
     · overview — «Что видно в данных» над таблицами: один факт на метрику и
       по отбору целиком (хуже ориентира → иначе заметно изменилась к
       прошлому году → иначе ухудшение подряд → иначе заметно лучше
       ориентира), плюс всплеск уходов и сдвиг численности за год;
     · yoyStory — факты истории метрики у её раскрытой строки: до пяти
       пунктов, у каждого с номером — отметка на графике «год к году».
   Пороги — те же, что у фактов блоков: 10% ориентира, тренд 3 месяца.
   ========================================================================== */
/* max 8 — как в HRBP HUB (UI-25): по одному факту на метрику, всего до восьми */
const OBS={dev:INS_GAP/100,yoyPp:3,trend:INS_TREND,max:8,spikeX:2,spikeMin:3};
/* Потоки за месяц: у них «с начала года» — сумма, и её есть с чем сравнить
   год назад. У остатков (численность, открытые вакансии) суммы нет. */
const FLOW=new Set(['hire','attrition','transfer_in','transfer_out','vac_closed','tgrowth_pass','tgrowth_deny']);
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const rel=(a,b)=>b?Math.abs(a-b)/Math.abs(b):0;
const range=n=>Array.from({length:n},(_,i)=>i);
/* копится с января: сумма (текучесть накопительная) или доля с начала года —
   у таких «рост подряд» и «худший месяц» ничего не значат */
const accum=m=>!!(m.ytd||m.ytdDelta||(m.derived&&m.derived.win==='ytd'));
const absD=(k,d)=>D.fmtDelta(k,Math.abs(d)).replace('+','');
/* точка в конце фразы — если её там ещё нет («3,9 п.п.» уже кончается точкой) */
const dot=t=>/[.!?]$/.test(t)?t:t+'.';
/* месяц расширенной сетки: имя и место на оси года */
function extMonth(j){
  const mm=D.MONTHS_EXT[j];
  return {name:D.MONTH_NOM[mm.m]+(mm.y===D.YEAR_CUR?'':' '+mm.y),
    pos:mm.y===D.YEAR_CUR?{i:mm.m,s:'main'}:mm.y===D.YEAR_PREV?{i:mm.m,s:'prev'}:null};
}
/* ориентир метрики: цель KPI или база того же месяца оси года */
function refOf(key,S,bl){
  const kpi=D.kpiFor(key,S);
  /* годовая цель HQ (поставка 50) — в месяце i оси года её доля: годовая × (i + 1) / 12, как коридор на графике */
  if(kpi)return {kpi:kpi,w:'цели',at:kpi.annual?i=>+(kpi.annual.green*(i+1)/12).toFixed(2):()=>kpi.green};
  if(!D.comparable(key))return null;
  const b=D.yoySeries(bl,key).cur;
  return {w:'базы',at:i=>b[i]};
}
function stateAt(key,v,ref,i){
  if(!ref||v==null||ref.at(i)==null)return 'neutral';
  return ref.kpi?D.stateForKpi(key,v,ref.kpi):D.compareState(key,v,ref.at(i));
}
function cmpWords(key,st,ref,i){
  const r=D.fmtVal(key,ref.at(i));
  return (st==='good'?'лучше ':st==='bad'?'хуже ':'на уровне ')+ref.w+' '+r;
}
function trendWord(m){return (m.better==='higher'?'снижение ':'рост ')+OBS.trend+' '+U.plural(OBS.trend,['месяц','месяца','месяцев'])+' подряд'}
/* ухудшение trend месяцев подряд и на dev за них — по расширенной сетке,
   поэтому январь продолжает декабрь: {a, b, from} или null */
/* L — месяц расширенной сетки, от которого смотрим (по умолчанию последний; у вызревающей
   метрики в незакрытом месяце — последний закрытый, factL) */
function worsening(m,ext,L){
  if(m.better==='flat'||accum(m))return null;
  if(L==null)L=D.NEXT-1;
  const n=OBS.trend, v0=ext[L-n];
  if(v0==null)return null;
  let prev=v0;
  for(let i=L-n+1;i<=L;i++){
    const v=ext[i];
    if(v==null||(m.better==='higher'?v>=prev:v<=prev))return null;
    prev=v;
  }
  return rel(prev,v0)>=OBS.dev?{a:v0,b:prev,from:L-n}:null;
}

/* Факты истории одной метрики для раскрытой строки One-pager:
   {items:[{n?, i?, s?, mi:[месяцы], html}], marks:[{i, s, n}]}. С номером —
   у точки графика (i — месяц 0–11, s — 'main' этот год | 'prev' прошлый);
   без номера — вывод без точки (темп к декабрю, сколько месяцев хуже
   ориентира), mi — какие месяцы он подсвечивает на графике. */
function yoyStory(key,S,rl,bl){
  const m=D.METRIC_BY_KEY[key];
  if(!m||D.isStub(key))return {items:[],marks:[],stub:!!m};
  const y=D.yoySeries(rl,key), cur=y.cur, prev=y.prev, b=D.CUR_LEN-1, v=cur[b];
  if(v==null)return {items:[],marks:[]};
  const f=x=>esc(D.fmtVal(key,x)), ref=refOf(key,S,bl), flat=m.better==='flat', out=[];
  /* 1. Сейчас и ориентир */
  const st=stateAt(key,v,ref,b);
  /* незакрытый месяц: у потока — «по 19.10» с пояснением (20.10) */
  out.push({i:b,s:'main',html:'<b>'+esc(cap(D.MONTH_NOM[b]))+' — '+f(v)+'</b>'+U.matureTag(key,true)+
    (ref&&!flat&&ref.at(b)!=null?', '+esc(cmpWords(key,st,ref,b))+'.':'.')});
  /* 2. Год назад — тот же месяц */
  const pv=prev[b];
  if(pv!=null){
    const d=+(v-pv).toFixed(4);
    const w=!d?'столько же':flat?(d>0?'больше на ':'меньше на ')+absD(key,d)
      :((m.better==='lower')===(d>0)?'хуже':'лучше')+' на '+absD(key,d);
    /* Точки двух лет почти совпадают (меньше 8% высоты полотна) — две отметки
       легли бы друг на друга, а разведённые в стороны «не совпадают с
       точками» (14.10). Тогда у пункта нет своего номера: на графике одна
       отметка этого года, а пункт подсвечивает тот же месяц. */
    const top=Math.max.apply(null,cur.concat(prev,ref?range(12).map(k=>ref.at(k)):[],ref&&ref.kpi?[(ref.kpi.annual||ref.kpi).red]:[])
      .filter(x=>x!=null&&isFinite(x)).concat([0]));
    const near=top>0&&Math.abs(v-pv)/top<0.08;
    out.push(near?{mi:[b],html:'<b>Год назад — '+f(pv)+'</b>: сейчас '+esc(dot(w))}
      :{i:b,s:'prev',html:'<b>Год назад — '+f(pv)+'</b>: сейчас '+esc(dot(w))});
  }
  /* 3. Экстремум года: у накопительной суммы — месяц, добавивший больше всех;
     у доли с начала года — ничего (январь у неё шумный); иначе худший месяц
     этого года, у нейтральных — максимум */
  if(m.ytd&&b>0){
    let best=-1,inc=0;
    for(let j=0;j<=b;j++){const a0=j?cur[j-1]:0,a1=cur[j];if(a1!=null&&a0!=null&&a1-a0>inc){inc=a1-a0;best=j}}
    if(best>=0)out.push({i:best,s:'main',html:'<b>Больше всего прибавил '+esc(D.MONTH_NOM[best])+'</b>: '+
      esc(D.fmtDelta(key,+inc.toFixed(2)))+' за месяц.'});
  }else if(!accum(m)&&b>0){
    let wi=-1;
    for(let k=0;k<=b;k++){
      if(cur[k]==null)continue;
      if(wi<0||(m.better==='higher'?cur[k]<cur[wi]:cur[k]>cur[wi]))wi=k;
    }
    if(wi>=0&&wi!==b&&rel(cur[wi],v)>=0.05)
      out.push({i:wi,s:'main',html:'<b>'+(flat?'Максимум года':'Худший месяц года')+' — '+esc(D.MONTH_NOM[wi])+'</b>: '+f(cur[wi])+'.'});
  }
  /* 4. Ухудшение подряд */
  const tr=flat?null:worsening(m,D.aggregateExt(rl,key));
  if(tr){
    const em=extMonth(tr.from);
    out.push({i:em.pos?em.pos.i:-1,s:em.pos?em.pos.s:'main',html:'<b>'+esc(cap(trendWord(m)))+'</b>: '+
      esc(em.name)+' '+f(tr.a)+' → '+esc(D.MONTH_NOM[b])+' '+f(tr.b)+'.'});
  }
  /* 5. Вывод без точки. 15.10: «к декабрю при таком темпе» снят вместе с
     прогнозом годовой текучести — в каталоге HQ и УС прогноза нет */
  if(FLOW.has(key)&&b>0){
    let ys=0,yp=0;
    for(let k=0;k<=b;k++){ys+=cur[k]||0;yp+=prev[k]||0}
    const d=ys-yp;
    out.push({mi:range(b+1),html:'<b>С начала года — '+esc(D.fmtInt(ys))+'</b>, год назад за те же месяцы — '+
      esc(D.fmtInt(yp))+(d?' ('+esc(D.fmtDelta(key,d))+')':'')+'.'});
  }else if(!flat&&ref&&b>=2){
    const bad=range(b+1).filter(k=>stateAt(key,cur[k],ref,k)==='bad');
    out.push(bad.length
      ?{mi:bad,html:'Хуже '+ref.w+' — '+bad.length+' '+
        U.plural(bad.length,['месяц','месяца','месяцев'])+' из '+(b+1)+' в этом году.'}
      :{mi:range(b+1),html:'Все '+(b+1)+' '+U.plural(b+1,['месяц','месяца','месяцев'])+' этого года — не хуже '+ref.w+'.'});
  }
  /* Номера — слева направо по графику: читается «пункт → точка». Вторая
     отметка в ту же точку не ставится — пункт остаётся без номера, но
     подсвечивает свой месяц. */
  const numd=out.filter(it=>it.i!=null&&it.i>=0).sort((a,c)=>a.i-c.i||(a.s==='main'?-1:1));
  const marks=[];
  numd.forEach(it=>{
    if(marks.some(z=>z.i===it.i&&z.s===it.s)){it.mi=[it.i];delete it.i;return}
    it.n=marks.length+1;it.mi=[it.i];marks.push({i:it.i,s:it.s,n:it.n});
  });
  out.sort((a,c)=>(a.n||99)-(c.n||99));
  return {items:out,marks:marks};
}

/* Один факт на метрику по отбору целиком: {key, sev, pri, w, lead, body} и сырые
   поля для карточек главной — kind ('dev' | 'yoy' | 'trend'), v, ref, kpi, pv, tr. */
/* Выводы по вызревающей метрике в незакрытом месяце — по последнему закрытому (20.10): неполный
   месяц против полного дал бы ложное «лучше, чем год назад». mon — «сентябрь» для подписи. */
function factL(key){return D.NEXT-1-(D.matures(key)||D.partFlow(key)?1:0)}
function monOf(L){return L===D.NEXT-1?'':D.MONTH_NOM[D.MONTHS_EXT[L].m]}
function metricFact(m,S,rl,bl){
  const key=m.key, ext=D.aggregateExt(rl,key), L=factL(key), v=ext[L], mon=monOf(L);
  if(v==null)return null;
  /* цель — того же месяца, что и факт (у вызревающей — последнего закрытого) */
  const kpi=D.kpiAt(key,S,D.MONTHS_EXT[L].m), ref=kpi?kpi.green:(D.comparable(key)?D.aggregateExt(bl,key)[L]:null);
  const st=ref==null?'neutral':kpi?D.stateForKpi(key,v,kpi):D.compareState(key,v,ref);
  const f=x=>D.fmtVal(key,x), w=kpi?'цели':'базы', pv=ext[L-12];
  const ago=pv!=null?'Год назад — '+f(pv)+'.':'';
  const tr=worsening(m,ext,L), nm=m.name+(mon?' за '+mon:'');
  if(st==='bad'&&rel(v,ref)>=OBS.dev)
    return {key,sev:kpi?'high':'mid',pri:1,w:rel(v,ref),lead:nm+' '+f(v)+' — хуже '+w+' '+f(ref),
      body:ago+(tr?' '+cap(trendWord(m))+'.':''),kind:'dev',v,ref,kpi,pv,tr,L,mon};
  /* год к году: 10% от прошлого значения или 3 п.п. у долей */
  if(pv!=null&&m.better!=='flat'&&m.fmt!=='int'&&Math.abs(v-pv)>=(m.fmt==='pct'?0.5:1e-9)&&
     (rel(v,pv)>=OBS.dev||(m.fmt==='pct'&&Math.abs(v-pv)>=OBS.yoyPp))){
    const worse=m.better==='lower'?v>pv:v<pv;
    return {key,sev:worse?'mid':'good',pri:2,w:rel(v,pv),
      lead:nm+' '+f(v)+' — '+(worse?'хуже':'лучше')+', чем год назад ('+f(pv)+')',
      body:ref!=null?cap(w==='цели'?'цель':'база')+' — '+f(ref)+'.':'',kind:'yoy',v,ref,kpi,pv,L,mon};
  }
  if(tr)return {key,sev:'mid',pri:3,w:rel(tr.b,tr.a),lead:m.name+': '+trendWord(m),
    body:cap(extMonth(tr.from).name)+' '+f(tr.a)+' → '+D.MONTH_NOM[D.MONTHS_EXT[L].m]+' '+f(tr.b)+'.',kind:'trend',v,ref,kpi,pv,tr,L,mon};
  if(st==='good'&&rel(v,ref)>=OBS.dev)
    return {key,sev:'good',pri:1,w:rel(v,ref),lead:nm+' '+f(v)+' — лучше '+w+' '+f(ref),body:ago,kind:'dev',v,ref,kpi,pv,L,mon};
  return null;
}
const MONTH_IN=['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];
function overview(S,rl,bl,all){
  const out=[], L=D.NEXT-1;
  D.METRICS.forEach(m=>{
    if(!D.metricVisible(m.key,S)||D.isStub(m.key))return;
    const x=metricFact(m,S,rl,bl);
    if(x)out.push(x);
  });
  /* всплеск уходов: последний месяц против среднего за 11 до него */
  if(D.metricVisible('attrition',S)){
    /* всплеск — по последнему закрытому месяцу: в незакрытом уходы ещё копятся */
    const La=factL('attrition'), a=D.aggregateExt(rl,'attrition'), last=a[La]||0;
    let usual=0;for(let i=La-11;i<La;i++)usual+=a[i]||0;usual/=11;
    if(last>=OBS.spikeMin&&last>=OBS.spikeX*usual)
      out.push({key:'attrition',sev:last>=3*usual?'high':'mid',pri:0,w:last-usual,
        lead:'Всплеск уходов в '+MONTH_IN[D.MONTHS_EXT[La].m]+
          ': '+D.fmtInt(last)+' — обычно '+(usual<1?'меньше одного':'около '+D.fmtInt(Math.round(usual)))+' в месяц',
        body:'Уволились за месяц, по любой причине.',kind:'spike',v:last,usual,L:La});
  }
  /* численность за год: найм, уходы, переводы — из чего сложилось */
  const hc=D.aggregateExt(rl,'hc_total'), from=hc[L-12], to=hc[L];
  if(from&&Math.abs(to-from)/from>=OBS.dev){
    const sm=k=>D.aggregate(rl,k).reduce((x,y)=>x+(y||0),0);
    const dp=Math.round(Math.abs(to-from)/from*100);
    out.push({key:'hc_total',sev:'mid',pri:5,w:0,
      lead:'Численность '+(to>from?'+':'−')+dp+'% за год: '+D.fmtInt(from)+' → '+D.fmtInt(to),
      body:'Найм '+D.fmtInt(sm('hire'))+', отток '+D.fmtInt(sm('attrition'))+', переводы в команду '+
        D.fmtInt(sm('transfer_in'))+' и из неё '+D.fmtInt(sm('transfer_out'))+'.',kind:'hc',v:to,pv:from,L});
  }
  const rank={high:0,mid:1,good:2};
  out.sort((a,c)=>rank[a.sev]-rank[c.sev]||a.pri-c.pri||c.w-a.w);
  return all?out:out.slice(0,OBS.max);
}

/* ============================================================================
   Карточки выводов — главная «сначала выводы» (вариант A) и вывод вкладки
   блока (одобрены заказчиком 20.10). Факты те же, что в overview, а подача и
   отбор — правилами HRBP HUB (гайд, UI-24 и UI-25):
     · ранжируем по людям сверх ориентира, а не по процентам (excess);
     · подразделение называем, только если на него приходится больше половины
       отклонения; подразделения меньше 30 человек не оцениваем — и долей у
       отчёта меньше 30 человек тоже не оцениваем: слишком мало людей;
     · до восьми фактов.
   «Что сделать» — шаблон по метрике (CARD_TODO), «что происходит» для сводки —
   короткая фраза (SAY). Считается правилами по тем же числам, без ИИ.
   ========================================================================== */
const CARD={small:30,conc:0.5,show:4};
const PPL=['человек','человека','человек'], LEAVE=['уход','ухода','уходов'];
/* в чём считать отклонение — по числителю метрики; null — не люди и не штуки (дни в офисе, дни открытия вакансий:
   «≈ 171 человек» у срока закрытия — дни × вакансии, ревью критиков 26.10) */
const NOUN={attrition:LEAVE,regret_cnt:LEAVE,tgrowth_pass:['заявка','заявки','заявок'],
  vac_closed:['вакансия','вакансии','вакансий'],ovis:null,ttf_days:null};
/* доли не людей: дни в офисе, нарушения брони, заявки T-роста (макет) */
const NOPPL=new Set(['office_att','booking_viol','tgrowth_conv']);
const TODO_LEAVE='разобрать уходы: причины и кто уходит';
const CARD_TODO={attrition:TODO_LEAVE,turnover_m:TODO_LEAVE,turnover_y:TODO_LEAVE,
  regret:'поговорить с сильными сотрудниками из зоны риска: кого давно не повышали, у кого высокая оценка',
  hire_plan:'сверить план с рекрутером: какие вакансии просрочены и почему',
  time_to_fill:'посмотреть, какие вакансии открыты дольше всего, и пересмотреть требования',
  vac_closed:'посмотреть, какие вакансии открыты дольше всего, и пересмотреть требования',
  underwork:'посмотреть, кто недорабатывает второй месяц подряд, и обсудить с руководителями',
  overwork:'проверить нагрузку у переработчиков: отпуска, перераспределение задач',
  review_up:'посмотреть, у кого оценка не растёт два ревью подряд',
  office_att:'договориться с командой об общих офисных днях',
  booking_viol:'напомнить команде о брони мест',
  tgrowth_conv:'разобрать отклонённые заявки на T-рост с руководителями',
  tgrowth_deny:'разобрать отклонённые заявки на T-рост с руководителями',
  tgrowth_tat:'проверить, кого давно не повышали',
  ai_penetration:'показать AI-инструменты тем, кто ещё не пробовал',
  hc_total:'сверить изменение численности с планом'};
/* «что происходит» коротко: [хуже, лучше] */
const SAY={turnover_m:['уходят чаще','уходят реже'],turnover_y:['уходят чаще','уходят реже'],
  regret:['нежелательных уходов больше','нежелательных уходов меньше'],
  time_to_fill:['вакансии закрываются дольше','вакансии закрываются быстрее'],
  vac_closed:['вакансий закрывают меньше','вакансий закрывают больше'],
  underwork:['недорабатывающих больше','недорабатывающих меньше'],
  overwork:['перерабатывающих больше','перерабатывающих меньше'],
  review_up:['оценку в ревью улучшают реже','оценку в ревью улучшают чаще'],
  office_att:['в офис ходят реже','в офис ходят чаще'],
  booking_viol:['нарушений брони больше','нарушений брони меньше'],
  tgrowth_conv:['T-рост одобряют реже','T-рост одобряют чаще'],
  tgrowth_pass:['T-рост одобряют реже','T-рост одобряют чаще'],
  tgrowth_deny:['T-рост отклоняют чаще','T-рост отклоняют реже'],
  tgrowth_tat:['повышения ждут дольше','повышения ждут меньше'],
  ai_penetration:['AI пользуются реже','AI пользуются чаще']};
const SEV_TAG={high:'Требует действий',mid:'Посмотреть',good:'Хорошая новость'};
/* одна история «уходят чаще / реже» — одна карточка */
const SAME={turnover_m:'leave',turnover_y:'leave',attrition:'leave'};
/* строчная — только если вторая буква строчная: «AI», «T@T» остаются */
const lc=t=>/^.[a-zа-яё]/.test(t)?t.charAt(0).toLowerCase()+t.slice(1):t;
const ppl=(n,noun)=>D.fmtInt(n)+' '+U.plural(Math.round(n),noun||PPL);
function say(f){
  const m=D.METRIC_BY_KEY[f.key], bad=f.sev!=='good';
  if(f.kind==='spike')return 'всплеск уходов в '+MONTH_IN[D.MONTHS_EXT[f.L].m];
  if(f.kind==='hc')return 'численность '+(f.v>f.pv?'выросла':'сократилась')+' на '+Math.round(Math.abs(f.v-f.pv)/f.pv*100)+'% за год';
  if(f.kind==='trend')return lc(m.name)+' '+(f.tr.b>f.tr.a?'растёт':'снижается')+' '+OBS.trend+' месяца подряд';
  if(f.key==='hire_plan'&&f.kind==='dev')return bad?'найм отстаёт от плана':'план найма выполняется с запасом';
  const st=(SAY[f.key]||[lc(m.name)+' хуже',lc(m.name)+' лучше'])[bad?0:1];
  return st+(f.kind==='yoy'?', чем год назад':f.key==='regret'&&f.kpi?' цели':f.kpi?', чем по цели':', чем по базе');
}
/* дробь метрики: своя или месячной, если накопительная — сумма месячных ('sum') */
function ratioDef(m){
  if(m.derived)return m.derived;
  const ch=m.ytd&&D.defOf(m.ytd);
  return ch&&ch.derived?Object.assign({},ch.derived,{win:'sum'}):null;
}
/* знаменатель: за месяц, с начала года ('ytd') или в среднем за месяц с января ('sum') */
function denOf(lp,dv,L){
  const ks=Array.isArray(dv.den)?dv.den:[dv.den], y0=D.YEAR_START_EXT[L];
  if(!dv.win)return ks.reduce((a,k)=>a+(D.aggregateExt(lp,k)[L]||0),0);
  let s=0;
  ks.forEach(k=>{const e=D.aggregateExt(lp,k);for(let i=y0;i<=L;i++)s+=e[i]||0});
  return dv.win==='sum'?s/(L-y0+1):s;
}
/* Отклонение в штуках: |v − ref| в долях знаменателя → {n, noun, win}; не люди — null. w — вес для «Где это
   происходит»: у числителя не в штуках (NOUN null) — |v − ref| × знаменатель, без существительного */
function excess(key,lp,v,ref,L,w){
  const m=D.METRIC_BY_KEY[key];
  if(v==null||ref==null||NOPPL.has(key))return null;
  if(L==null)L=factL(key);
  const dv=ratioDef(m);
  if(dv)return NOUN[dv.num]===null&&!w?null:{n:Math.abs(v-ref)/(dv.scale||1)*denOf(lp,dv,L),noun:NOUN[dv.num]||PPL,win:dv.win};
  if(m.fmt==='pct')return {n:Math.abs(v-ref)/100*(D.aggregateExt(lp,'hc_total')[L]||0),noun:PPL,win:m.ytd?'sum':null};
  if(m.fmt==='int')return {n:Math.abs(v-ref),noun:NOUN[key]||PPL,win:null};
  return null;
}
/* первый уровень под юнитом отчёта — его листья под фильтрами и численность */
function unitsOf(S){
  return D.rowsOf(S.unit).map(n=>{
    const lp=D.leavesUnder(n.path).map(l=>l.path).filter(p=>D.leafPasses(p,S));
    return {n,lp,hc:lp.length?D.lastVal(lp,'hc_total')||0:0};
  }).filter(u=>u.lp.length);
}
/* Где это происходит: вклад подразделений в отклонение факта (люди сверх
   ориентира). top — подразделение больше чем с половиной вклада. */
function whereOf(f,S){
  const m=D.METRIC_BY_KEY[f.key], L=f.L!=null?f.L:D.NEXT-1;
  const rows=unitsOf(S).map(u=>{
    const r={n:u.n,hc:u.hc,small:u.hc<CARD.small,exc:0,v:null};
    if(f.kind==='spike'){
      const a=D.aggregateExt(u.lp,'attrition');let us=0;
      for(let i=L-11;i<L;i++)us+=a[i]||0;
      r.v=a[L]||0;r.ref=us/11;r.exc=Math.max(0,r.v-r.ref);return r;
    }
    const e=D.aggregateExt(u.lp,f.key), ref=f.kind==='yoy'?e[L-12]:f.ref;
    r.v=e[L];r.ref=ref;
    if(!r.small&&r.v!=null&&ref!=null&&isBad(m,r.v,ref)){const x=excess(f.key,u.lp,r.v,ref,L,1);r.exc=x?x.n:0}
    return r;
  });
  rows.sort((a,c)=>c.exc-a.exc||c.hc-a.hc);
  const tot=rows.reduce((a,r)=>a+r.exc,0), top=tot>0&&rows[0].exc/tot>CARD.conc?rows[0]:null;
  return {rows,tot,top,share:top?top.exc/tot:0};
}
/* ряд для мини-графика: этот год с января против ориентира; до апреля — 12 месяцев окна */
function miniOf(f,rl,bl){
  const k=f.kind==='spike'?'attrition':f.key, fv=x=>D.fmtVal(k,x), L=D.NEXT-1;
  const kpi=f.kind==='dev'&&f.kpi, base=f.kind==='dev'&&!kpi;
  let cur,ref;
  if(D.CUR_LEN>=4){
    const y=D.yoySeries(rl,k);cur=y.cur.slice(0,D.CUR_LEN);
    ref=base?D.yoySeries(bl,k).cur.slice(0,D.CUR_LEN):y.prev.slice(0,D.CUR_LEN);
  }else{
    const e=D.aggregateExt(rl,k), at=i=>i<0?null:e[i];
    cur=range(12).map(i=>at(L-11+i));
    ref=base?D.aggregate(bl,k):range(12).map(i=>at(L-23+i));
  }
  /* годовая цель HQ — по месяцам её доля (коридор), как на большом графике */
  const ann=kpi&&f.kpi.annual, moy=i=>D.CUR_LEN>=4?i:(D.MONTHS_EXT[L-11+i]||{}).m;
  if(kpi)ref=cur.map((_,i)=>ann?(moy(i)==null?null:+(ann.green*(moy(i)+1)/12).toFixed(2)):f.kpi.green);
  return G.miniYoy(cur,ref,kpi?'цель '+fv(f.kpi.green):base?'база':'год назад');
}
/* Карточка факта: {key, block, sev, tag, head, body, todo, btn, chart, ppl, where} */
function cardOf(f,S,rl,bl){
  const m=D.METRIC_BY_KEY[f.key], bad=f.sev!=='good', fv=x=>D.fmtVal(f.key,x);
  const bk=f.kind==='spike'&&D.blockVisible('turnover',S)?'turnover':m.block, b=D.BLOCK_BY_KEY[bk];
  let head=f.lead;
  const mn=m.name+(f.mon?' за '+f.mon:'');
  if(f.kind==='dev')head=mn+' '+fv(f.v)+(f.kpi?' при цели '+fv(f.ref):' — '+(f.v>f.ref?'выше':'ниже')+', чем по базе ('+fv(f.ref)+')');
  else if(f.kind==='yoy')head=mn+' '+fv(f.v)+' — '+(f.v>f.pv?'выше':'ниже')+', чем год назад ('+fv(f.pv)+')';
  else if(f.kind==='trend')head=m.name+' '+(f.tr.b>f.tr.a?'растёт':'снижается')+' '+OBS.trend+' месяца подряд: '+fv(f.tr.a)+' → '+fv(f.tr.b);
  const body=[];
  /* уходы — сначала людьми: сколько ушло с января и сколько год назад за те же месяцы.
     Фраза одна на все выводы (cards ставит её только в первый) */
  let leave='';
  const Lf=f.L!=null?f.L:D.NEXT-1, y0=D.YEAR_START_EXT[Lf];
  if(SAME[f.key]&&f.kind!=='trend'&&Lf>y0){
    /* по последнему закрытому месяцу (factL): незакрытый ещё не досчитан */
    const e=D.aggregateExt(rl,'attrition');let a=0,p=0;
    for(let i=y0;i<=Lf;i++){a+=e[i]||0;p+=e[i-12]||0}
    const d=Math.round(a)-Math.round(p);
    leave='С января'+(f.mon?' по '+f.mon:'')+' ушли <b>'+ppl(a)+'</b> — '+(d?'на '+D.fmtInt(Math.abs(d))+' '+(d>0?'больше':'меньше')+', чем за те же месяцы год назад'
      :'столько же, сколько год назад за те же месяцы')+'.';
  }
  const x=f.kind==='dev'?excess(f.key,rl,f.v,f.ref,Lf):f.kind==='yoy'?excess(f.key,rl,f.v,f.pv,Lf)
    :f.kind==='trend'?excess(f.key,rl,f.tr.b,f.tr.a,Lf):f.kind==='spike'?{n:f.v-f.usual,noun:LEAVE}:null;
  const n=x?Math.round(x.n):0, q=n>=1?'<b>≈ '+ppl(n,x.noun)+'</b>':'';
  if(q){
    const w=f.kpi?'цели':'базы', when=x.win?' с начала года':f.kind==='dev'?' за месяц':'';
    if(f.kind==='yoy')body.push('<!--ppl-->Это '+q+' разницы с прошлым годом.');
    else if(f.kind==='trend')body.push('За '+OBS.trend+' месяца — '+q+'.');
    else if(f.kind==='spike')body.push('Это '+q+' сверх обычного.');
    else if(m.better==='higher')body.push(bad?'До '+(f.kpi?'цели':'уровня базы')+' не хватает '+q+'.':'Это на '+q+' больше '+w+'.');
    else body.push(bad?'Это '+q+' сверх '+w+when+'.':'Это на '+q+' меньше '+w+when+'.');
  }
  const wh=bad&&/^(dev|yoy|spike)$/.test(f.kind)?whereOf(f,S):null;
  if(wh&&wh.top)body.push((wh.share>=0.8?'Почти вся эта разница':'Больше половины этой разницы')+' — в <b>«'+esc(wh.top.n.name)+'»</b>.');
  if(f.kind==='dev'&&f.pv!=null&&!leave)body.push('Год назад — '+esc(fv(f.pv))+'.');
  if(f.kind==='dev'&&f.tr)body.push(esc(cap(trendWord(m)))+'.');
  let todo='Держать курс: отдельных действий не нужно.';
  if(bad){
    const t=f.kind==='spike'?'разобрать уходы за '+D.MONTH_NOM[D.MONTHS_EXT[Lf].m]+': причины и подразделения'
      :CARD_TODO[f.key]||'открыть блок и посмотреть, где отклонение';
    const h=wh&&wh.top&&wh.top.n.head, who=h&&(h.login||h.name);
    todo='<b>Что сделать:</b> '+(wh&&wh.top?'начать с «'+esc(wh.top.n.name)+'»'+(who?' ('+esc(who)+')':'')+' — ':'')+esc(t)+'.';
  }
  return {key:f.key,fact:f,block:bk,blockName:b.name,sev:f.sev,tag:SEV_TAG[f.sev],head,body,leave,todo,
    ppl:n,where:wh,chart:miniOf(f,rl,bl),
    btn:wh&&wh.top?{label:'Показать подразделение',go:bk+'|'+wh.top.n.path}:{label:'Открыть «'+b.name+'»',tab:bk}};
}
/* Отчёт меньше 30 человек: доли не оцениваются — остаются всплеск и численность */
function smallReport(rl){const hc=D.lastVal(rl,'hc_total');return hc!=null&&hc<CARD.small}
/* Все карточки по отбору: по тяжести, внутри — по людям сверх ориентира; до восьми */
function cards(S,rl,bl,all){
  const sm=smallReport(rl), rank={high:0,mid:1,good:2};
  const list=overview(S,rl,bl,true).filter(f=>!(sm&&D.METRIC_BY_KEY[f.key].fmt==='pct'&&f.kind!=='spike'&&f.kind!=='hc'))
    .map((f,i)=>Object.assign(cardOf(f,S,rl,bl),{i}));
  list.sort((a,c)=>rank[a.sev]-rank[c.sev]||c.ppl-a.ppl||a.i-c.i);
  /* одна история — одна карточка: текучесть месячная и с начала года об одном
     («уходят чаще») — остаётся первая; «С января ушли N» — тоже один раз, а там,
     где её нет, — разница людьми */
  const seen=new Set();let said=false;
  const out=list.filter(c=>{const g=c.fact.kind!=='spike'&&SAME[c.key];if(!g)return true;
    const k=g+(c.sev==='good');if(seen.has(k))return false;seen.add(k);return true});
  out.forEach(c=>{
    const b=c.body.slice();
    if(c.leave&&!said){said=true;b.unshift(c.leave);if(c.fact.kind==='yoy')b.splice(b.findIndex(t=>/^<!--ppl-->/.test(t)),1)}
    c.body=b.join(' ').replace(/<!--ppl-->/g,'');
  });
  return all?out:out.slice(0,OBS.max);
}
/* Сводка над карточками: команда растёт или нет (±5% с начала года — стабильна),
   главное хуже и лучше, сколько в норме */
function lead(S,rl,list,norm){
  const hc=D.lastVal(rl,'hc_total')||0, net=D.lastVal(rl,'net_ytd')||0, d0=hc-net;
  const team=!d0||Math.abs(net)/d0<0.05?'Команда стабильна':net>0?'Команда растёт':'Команда сокращается';
  const bad=list.find(c=>c.sev!=='good'), good=list.find(c=>c.sev==='good');
  const nAct=list.filter(c=>c.sev!=='good').length;
  let h='<b>'+esc(team+(bad?', но '+say(bad.fact):good?', и '+say(good.fact):', заметных отклонений нет'))+'.</b> '+
    esc(ppl(hc))+' — '+(net?'на '+D.fmtInt(Math.abs(net))+' '+(net>0?'больше':'меньше')+', чем на начало года':'столько же, сколько на начало года')+'.';
  if(smallReport(rl))h+=' В команде меньше '+CARD.small+' человек — доли (текучесть, проценты) не оцениваем: слишком мало людей.';
  h+=nAct?' Ниже — '+nAct+' '+U.plural(nAct,['вывод, на который','вывода, на которые','выводов, на которые'])+' стоит потратить время':' Требующего действий нет';
  return h+(norm?'; остальные '+norm+' '+U.plural(norm,['метрика','метрики','метрик'])+' в норме.':'.');
}
/* Вывод блока: заголовок, до трёх фактов по номерам, «Что сделать», где это
   происходит. Нет фактов — «всё спокойно» и что проверено. */
function blockSummary(bk,S,rl,bl){
  const list=cards(S,rl,bl,true).filter(c=>c.block===bk||(c.fact.kind==='spike'&&bk==='movement'));
  const sev=list.length?list[0].sev:'none';
  window.TPINSIGHTS.lastSev=sev;
  if(!list.length)return {sev,list};
  const bad=list.find(c=>c.sev!=='good'), good=list.find(c=>c.sev==='good');
  const tail=c=>c.where&&c.where.top?' — '+(c.where.share>=0.8?'почти всё':'больше половины')+' в «'+c.where.top.n.name+'»':'';
  const head=bad&&good&&good!==list[0]?cap(say(good.fact))+', но '+say(bad.fact)+tail(bad)
    :cap(say(list[0].fact))+tail(list[0]);
  return {sev,list,head,todo:(bad||list[0]).todo};
}

/* lastSev — тяжесть последнего отрисованного инсайта: её читает mascot.js,
   чтобы эмоция огонька совпадала с тем, что пользователь видит в плашке. */
window.TPINSIGHTS={yoyStory,overview,cards,lead,blockSummary,whereOf,unitsOf,excess,CARD,SEV_TAG,OBS,INS_GAP,INS_TREND,lastSev:'none'};
})();

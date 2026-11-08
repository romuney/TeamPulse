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
const OBS={dev:INS_GAP/100,trend:INS_TREND,max:8,spikeX:2,spikeMin:3};
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
  if(!D.comparable(key)||D.isSelfBase())return null;
  /* поставка 117: у метрики есть база (подразделения похожей численности) — оценка по ней, а помесячной базы нет;
     сравнение месяцев со всей компанией рядом с оценкой «к базе» спорило бы с ней — его нет */
  if(D.peerOf(key))return null;
  const b=D.yoySeries(bl,key).cur;
  return {w:'всей компании',co:true,at:i=>b[i]};
}
function stateAt(key,v,ref,i){
  if(!ref||v==null||ref.at(i)==null)return 'neutral';
  return ref.kpi?D.stateForKpi(key,v,ref.kpi):D.compareState(key,v,ref.at(i));
}
function cmpWords(key,st,ref,i){
  const r=D.fmtVal(key,ref.at(i));
  /* поставка 117: со всей компанией — «лучше, чем во всей компании (1,6%)» */
  if(ref.co)return (st==='good'?'лучше, чем ':st==='bad'?'хуже, чем ':'на уровне ')+(st==='good'||st==='bad'?'во ':'')+
    (st==='good'||st==='bad'?'всей компании':'всей компании')+' ('+r+')';
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
  /* поставка 90: «сейчас» — последний закрытый месяц (у состояний — сегодня), незакрытый — только на графике */
  const y=D.yoySeries(rl,key), cur=y.cur, prev=y.prev, b=STOCK.has(key)?D.CUR_LEN-1:D.PER_C, v=cur[b];
  const f=x=>esc(D.fmtVal(key,x)), ref=refOf(key,S,bl), flat=m.better==='flat', out=[];
  /* поставка 128 (аудит, владелец 08.11: «выводы обязательно должны совпадать»): пункты 1–2 были про один закрытый месяц
     («Сентябрь — 14,4%, хуже, чем во всей компании»), а строка рядом — итог за период с вердиктом «на уровне»; у неоценённых
     метрик пункт говорил «на уровне», у всей компании — сравнивал её с собой. Теперь пункт 1 — тот же итог и тот же вердикт,
     что у строки (D.periodTotal, D.verdictState), пункт 2 — год назад за те же месяцы, словом по тому же правилу, что цвет
     чипа «год к году» (D.deltaState) */
  const P=D.periodTotal(rl,key)||{}, V=D.verdictState(key,S,rl,bl), pt=P.stock||/^На конец /.test(P.head||'');
  if(P.v==null&&v==null)return {items:[],marks:[]};
  const kpi=D.kpiAt(key,S,D.MONTHS[D.PER_I].m), pe=kpi?null:D.peerOf(key,rl);
  const refV=kpi?kpi.green:pe?pe.p50:D.comparable(key)&&!D.isSelfBase()?(D.periodTotal(bl,key)||{}).v:null;
  const rw=kpi?'цели':pe?'базы':'всей компании';
  const why=D.isSmall(key)?'без оценки: в команде меньше '+D.SMALL_N+' человек — смотрим людей'
    :D.thin(key,rl)?'без оценки: мало событий':!D.monJudged(key,rl)?'без оценки: в мониторинге размечено меньше половины людей':'';
  const say=flat||P.v==null?'':V==='good'?'лучше '+rw+(refV!=null?' ('+D.fmtVal(key,refV)+')':'')
    :V==='bad'?'хуже '+rw+(refV!=null?' ('+D.fmtVal(key,refV)+')':''):V==='warn'?'на уровне '+rw+(refV!=null?' ('+D.fmtVal(key,refV)+')':''):why;
  /* 1. Итог за период и ориентир — как в строке */
  if(P.v!=null)out.push(Object.assign(pt?{i:b,s:'main',pin:1}:{mi:range(b+1),pin:1},
    {html:'<b>'+esc(cap(P.head||''))+' — '+f(P.v)+'</b>'+(say?': '+esc(say)+'.':'.')}));
  /* 2. Год назад — за тот же период */
  const pv=P.pv;
  if(P.v!=null&&pv!=null){
    const d=+(P.v-pv).toFixed(2), ds=D.deltaState(key,P.v,pv,rl);
    const w=!d||P.delta==='без изменений'?'столько же':flat?(d>0?'больше на ':'меньше на ')+absD(key,d)
      :ds==='bad'?'хуже на '+absD(key,d):ds==='good'?'лучше на '+absD(key,d):(d>0?'больше':'меньше')+' на '+absD(key,d);
    /* Точки двух лет почти совпадают (меньше 8% высоты полотна) — две отметки
       легли бы друг на друга, а разведённые в стороны «не совпадают с
       точками» (14.10). Тогда у пункта нет своего номера: на графике одна
       отметка этого года, а пункт подсвечивает тот же месяц. */
    const top=Math.max.apply(null,cur.concat(prev,ref?range(12).map(k=>ref.at(k)):[],ref&&ref.kpi?[(ref.kpi.annual||ref.kpi).red]:[])
      .filter(x=>x!=null&&isFinite(x)).concat([0]));
    const near=top>0&&Math.abs(v-pv)/top<0.08;
    out.push(!pt?{mi:range(b+1),pin:2,html:'<b>Год назад за те же месяцы — '+f(pv)+'</b>: сейчас '+esc(dot(w))}
      :near?{mi:[b],pin:2,html:'<b>Год назад — '+f(pv)+'</b>: сейчас '+esc(dot(w))}
      :{i:b,s:'prev',pin:2,html:'<b>Год назад — '+f(pv)+'</b>: сейчас '+esc(dot(w))});
  }
  /* 3. Экстремум года: у накопительной суммы — месяц, добавивший больше всех;
     у доли с начала года — ничего (январь у неё шумный); иначе худший месяц
     этого года, у нейтральных — максимум */
  if(m.ytd&&b>0){
    let best=-1,inc=0;
    for(let j=0;j<=b;j++){const a0=j?cur[j-1]:0,a1=cur[j];if(a1!=null&&a0!=null&&a1-a0>inc){inc=a1-a0;best=j}}
    if(best>=0)out.push({i:best,s:'main',html:'<b>Больше всего прибавил '+esc(D.MONTH_NOM[best])+'</b>: '+
      esc(D.fmtDelta(key,+inc.toFixed(2)))+' за месяц.'});
  }else if(!accum(m)&&b>0&&v!=null&&!D.eventsOf(key,rl)){
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
  /* поставка 128: сумма потока за закрытые месяцы («Янв.–сент. — 57») снята — итог периода уже в пунктах 1–2, а второе окно
     рядом с «по 12 октября» путало */
  if(!FLOW.has(key)&&!flat&&ref&&b>=2&&(V==='bad'||V==='good')){
    /* поставка 128: помесячный счёт — только в поддержку вердикта периода («хуже» — сколько месяцев хуже; «лучше» — что ни
       одного хуже); при «на уровне» и «без оценки» он спорил бы со строкой («на уровне», но «хуже 6 месяцев из 9») */
    const bad=range(b+1).filter(k=>stateAt(key,cur[k],ref,k)==='bad');
    const rw=ref.co?', чем во всей компании':' '+ref.w;
    if(V==='bad'&&bad.length)out.push({mi:bad,html:'Хуже'+rw+' — '+bad.length+' '+
        U.plural(bad.length,['месяц','месяца','месяцев'])+' из '+(b+1)+' в этом году.'});
    else if(V==='good'&&!bad.length)out.push({mi:range(b+1),html:'Все '+(b+1)+' '+U.plural(b+1,['месяц','месяца','месяцев'])+' этого года — не хуже'+rw+'.'});
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
  out.sort((a,c)=>(a.pin||9)-(c.pin||9)||(a.n||99)-(c.n||99));
  return {items:out,marks:marks};
}

/* Один факт на метрику по отбору целиком: {key, sev, pri, w, lead, body} и сырые
   поля для карточек главной — kind ('dev' | 'yoy' | 'trend'), v, ref, kpi, pv, tr. */
/* Выводы по вызревающей метрике в незакрытом месяце — по последнему закрытому (20.10): неполный
   месяц против полного дал бы ложное «лучше, чем год назад». mon — «сентябрь» для подписи. */
/* Поставка 90 (заказчик: «однозначная интерпретация цифр»): факт — за то же окно, что итог под графиком
   (D.periodTotal): с января по последний закрытый месяц против тех же месяцев прошлого года; состояния — сейчас.
   L — закрытый месяц (тренд, «где это происходит», люди сверх ориентира), mon — его имя для «С января по …» */
const STOCK=new Set(['hc_total','hc_active','hc_avg','vac_open','ai_wau']);
/* поставка 106: количества (FLOW) — по дату данных, с незакрытым месяцем; доли — по закрытый */
function factL(key){return D.NEXT-1-(STOCK.has(key)||FLOW.has(key)||D.PER_PART||!D.PARTIAL?0:1)}
function monOf(L){return D.MONTH_NOM[D.MONTHS_EXT[L].m]}
const perOf=(lp,k)=>D.periodTotal(lp,k)||{};
function metricFact(m,S,rl,bl){
  const key=m.key, ext=D.aggregateExt(rl,key), L=factL(key), P=perOf(rl,key), v=P.v, mon=monOf(L);
  if(v==null)return null;
  /* поставка 110 (критики 07.11): мало событий (срок по 1–2 вакансиям, конверсия по 1–4 заявкам) — выводов нет */
  if(D.thin(key,rl))return null;
  /* поставка 120 (критик на 49 человек: «Нежелательных уходов больше, чем год назад 14,3%» по HQ из 17 человек, хотя вкладка
     HQ эти доли не оценивает): доли HQ при HQ меньше 30 человек — без выводов, как доли малой команды */
  if(D.isSmallHq(key))return null;
  /* поставка 125: недо- и переработка у подразделения, где размечено меньше половины людей, — без выводов: 0% там значит
     «нет данных мониторинга» (D.monJudged) */
  if(!D.monJudged(key,rl))return null;
  /* цель — закрытого месяца (у накопительных — её доля к этому месяцу), база и год назад — за тот же период;
     поставка 110: база = сам отчёт (вся компания) — с собой не сравниваем, ориентир — цель или прошлый год */
  const kpi=D.kpiAt(key,S,D.MONTHS_EXT[L].m);
  /* поставка 113: без цели, но с распределением подразделений того же размера (под теми же фильтрами) — ориентир медиана,
     оценка по четвертям (D.peerState); иначе — база, как раньше */
  const pe=kpi?null:D.peerOf(key,rl);
  const ref=kpi?kpi.green:pe?pe.p50:(D.comparable(key)&&!D.isSelfBase()?perOf(bl,key).v:null);
  const st=ref==null?'neutral':kpi?D.stateForKpi(key,v,kpi):pe?D.peerState(key,v,pe,rl):D.monJudged(key,bl)?D.compareState(key,v,ref):'neutral';
  /* поставка 117: ориентир — «цель», «база» (подразделения похожей численности, подсказка у чипа) или «вся компания» */
  const f=x=>D.fmtVal(key,x), w=kpi?'цели':pe?'базы':'всей компании', pv=P.pv;
  const peerSay=good=>(good?'лучше':'хуже')+' базы '+f(pe.p50);
  const ago=pv!=null?'Год назад — '+f(pv)+'.':'';
  /* поставка 99: окно периода названо в шапке экрана, у имени метрики — только «сейчас» у состояний */
  const tr=worsening(m,ext,L), nm=m.name+(STOCK.has(key)?', сейчас':'');
  /* поставка 110 («один вердикт»): у цели KPI «хуже» — то же, что красный цвет строки (stateForKpi); у базы — порог
     10% (compareState); метрика в цели не получает «хуже, чем год назад» — строка таблицы зелёная */
  if(st==='bad'&&(kpi||pe||rel(v,ref)>=OBS.dev))
    return {key,sev:kpi?'high':'mid',pri:1,w:rel(v,ref),lead:nm+' '+f(v)+' — '+(pe?peerSay(false):kpi?'хуже '+w+' '+f(ref)
      :'хуже, чем во всей компании ('+f(ref)+')')+(D.yoyMove(key,rl)==='better'?', но лучше, чем год назад ('+f(pv)+')':''),
      body:ago+(tr?' '+cap(trendWord(m))+'.':''),kind:'dev',yo:D.yoyMove(key,rl)==='better'?'better':null,v,ref,kpi,pv,tr,L,mon,peer:pe};
  /* год к году: 10% от прошлого значения. Поставка 120 (критики 119, «один вердикт»: «лучше базы» в строке и «Посмотреть ·
     больше, чем год назад» в карточке; «T-рост одобряют чаще» в выводе блока и «как год назад» в главе): второй порог —
     3 п.п. у долей — снят, и у метрики, которую уже оценил ориентир (цель, база, компания: «лучше» или «на уровне»),
     изменение к прошлому году — справка в строке, а не отдельный вывод */
  /* поставка 128 (аудит): «на уровне ориентира» больше не прячет заметный сдвиг к году — глава уже говорила «на уровне базы, но
     хуже, чем год назад», чип года в строке красный, а главная писала «в норме». Сдвиг — по D.yoyMove (тому же правилу, что
     цвет чипа); при «на уровне» — вывод «на уровне …, но хуже/лучше, чем год назад» (lvl) */
  const mv=m.better!=='flat'&&m.fmt!=='int'?D.yoyMove(key,rl):null;
  if(pv!=null&&mv&&(ref==null||st==='neutral'||st==='warn')){
    const worse=mv==='worse', lvl=st==='warn';
    return {key,sev:worse?'mid':'good',pri:2,w:rel(v,pv),
      lead:nm+' '+f(v)+' — '+(lvl?'на уровне '+(pe?'базы '+f(ref):kpi?'цели '+f(ref):'всей компании ('+f(ref)+')')+', но ':'')+
        (worse?'хуже':'лучше')+', чем год назад ('+f(pv)+')',
      body:ref!=null?(kpi?'Цель':pe?'База':'Вся компания')+' — '+f(ref)+'.':'',kind:'yoy',lvl,v,ref,kpi,pv,L,mon,peer:pe};
  }
  if(tr)return {key,sev:'mid',pri:3,w:rel(tr.b,tr.a),lead:m.name+': '+trendWord(m),
    body:cap(extMonth(tr.from).name)+' '+f(tr.a)+' → '+D.MONTH_NOM[D.MONTHS_EXT[L].m]+' '+f(tr.b)+'.',kind:'trend',v,ref,kpi,pv,tr,L,mon};
  if(st==='good'&&(pe||rel(v,ref)>=OBS.dev))
    return {key,sev:'good',pri:1,w:rel(v,ref),lead:nm+' '+f(v)+' — '+(pe?peerSay(true):kpi?'лучше '+w+' '+f(ref)
      :'лучше, чем во всей компании ('+f(ref)+')')+(D.yoyMove(key,rl)==='worse'?', но хуже, чем год назад ('+f(pv)+')':''),
      body:ago,kind:'dev',yo:D.yoyMove(key,rl)==='worse'?'worse':null,v,ref,kpi,pv,L,mon,peer:pe};
  return null;
}
const MONTH_IN=['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];
/* поставка 121 (критики-руководители 119: у команды из 22 ушли 9 при 3 год назад, у команды из 7 — 4 при 2, а главная писала
   «Требующего действий нет»): отток группы меньше 30 человек — в людях. Вывод, если уходов на 3 больше, чем год назад, или с
   1 января ушла четверть состава на 1 января (и хотя бы 3 человека). node — подразделение, о котором вывод (иначе — отчёт) */
const TIMES={2:'вдвое',3:'втрое',4:'вчетверо'};
function pplLeave(lp,node){
  const P=perOf(lp,'attrition'), a=Math.round(P.v||0), pa=P.pv==null?null:Math.round(P.pv);
  const L=D.NEXT-1, hc=D.aggregateExt(lp,'hc_total'), h0=Math.round(hc[D.YEAR_START_EXT[L]-1]||0);
  if(a<SMALL_PPL||!(pa!=null&&a-pa>=SMALL_PPL||h0>0&&a/h0>=0.25))return null;
  const x=pa?a/pa:null, xi=x&&Math.abs(x-Math.round(x))<0.05?Math.round(x):null;
  const vs=pa==null?'':!pa?' — год назад не уходил никто':TIMES[xi]?' — '+TIMES[xi]+' больше, чем год назад ('+pa+')'
    :a>pa?' — на '+(a-pa)+' больше, чем год назад ('+pa+')':a<pa?' — год назад ушли '+pa:' — столько же, сколько год назад';
  const ex=D.exitProfile(lp,'ytd'), last=ex.tenure[ex.tenure.length-1], sen=last&&!last.early?last.value:0;
  const tout=Math.round(perOf(lp,'transfer_out').v||0), nm=node?'«'+node.name+'»':'';
  const pills=[];
  if(sen&&(sen>=2||sen*3>=a))pills.push('со стажем '+esc(lc(last.name))+' — <b>'+sen+'</b>');
  if(tout)pills.push('ещё перевелись в другие подразделения — '+tout);
  /* «требует действий» — ушло больше 40% состава на 1 января или и на 3 больше прошлого года, и четверть состава */
  return {key:'attrition',kind:node?'uppl':'ppl',sev:h0>0&&(a/h0>=0.4||pa!=null&&a-pa>=SMALL_PPL&&a/h0>=0.25)?'high':'mid',pri:0,w:h0?a/h0:a,v:a,pv:pa,L,
    node:node?node.path:null,lead:(node?'В '+nm+' ушли ':'Ушли ')+ppl(a)+vs,say:(node?'в '+nm+' ':'')+'ушли '+ppl(a)+(h0?' из '+h0:''),pills,
    big:{v:D.fmtInt(a),name:'ушли с 1 января'+(h0?' — из '+h0+' на 1 января':''),chip:pa!=null&&a!==pa?(a>pa?'+':'−')+Math.abs(a-pa)+' к году назад':'',cls:'down'},
    kp:(node?esc(node.name)+': ушли ':'Ушли ')+'<b>'+a+'</b>'+(pa!=null?' · год назад '+pa:''),
    todo:node?'поговорить с руководителем '+nm+': кто ушёл, почему и кто из оставшихся под риском'
      :'разобрать с HRBP каждый уход — причина и кто ещё под риском; закрепить наставника за каждым новичком'};
}
/* поставка 121 (критик на 7 человек: отклонённая заявка на рост при уходе с причиной «Нет роста» видна только в «Росте HQ»):
   у команды меньше 30 человек отклонённые заявки — событием в людях */
function pplDeny(lp,S){
  if(!D.metricVisible('tgrowth_deny',S)||D.isStub('tgrowth_deny'))return null;
  const P=perOf(lp,'tgrowth_deny'), n=Math.round(P.v||0);
  if(n<1)return null;
  const rs=D.exitReasons(lp,'ytd')||[], gr=rs.filter(r=>/рост|карьер|развит|повыш/i.test(r.name)).reduce((t,r)=>t+(r.value||0),0);
  return {key:'tgrowth_deny',kind:'ppl',sev:'mid',pri:1,w:n,v:n,L:D.NEXT-1,
    lead:U.plural(n,['Отклонена','Отклонены','Отклонено'])+' '+n+' '+U.plural(n,['заявка','заявки','заявок'])+' на рост'+(gr?', а из-за роста уже '+(gr===1?'ушёл ':'ушли ')+ppl(gr):''),
    say:'отклонены заявки на рост',
    pills:['отклонено с 1 января <b>'+n+'</b>'+(P.pv!=null?' · год назад '+Math.round(P.pv):'')].concat(gr?['ушли с причиной про рост — <b>'+gr+'</b>']:[]),
    big:{v:D.fmtInt(n),name:U.plural(n,['отклонённая заявка','отклонённые заявки','отклонённых заявок'])+' на T-рост',chip:'',cls:'down'},
    kp:'Отклонено заявок на рост <b>'+n+'</b>',
    todo:'обсудить с каждым, кому отказали, план роста: отказ без плана — частый предвестник ухода'};
}
function pplRegret(rl,S){
  const kk=((D.defOf('regret_m')||{}).derived||{}).num||'regret_cnt', L=factL('regret'), y0=D.YEAR_START_EXT[L];
  const cnt=lp=>{const e=D.aggregateExt(lp,kk);let a=0,p=0;for(let i=y0;i<=L;i++){a+=e[i]||0;p+=i>=12?e[i-12]||0:0}return {a:Math.round(a),p:Math.round(p)}};
  const c=cnt(rl);
  if(c.a<2||c.a<=c.p)return null;
  const h=D.hqLight(S,null,null), hc=h?h.hc:null;
  const us=unitsOf(S).map(u=>({u,t:cnt(u.lp).a})).filter(z=>z.t>0).sort((a,b)=>b.t-a.t), wh=us[0]&&us[0].t>=Math.ceil(c.a*0.8)?us[0].u:null;
  return {key:'regret',kind:'ppl',sev:'mid',pri:1,w:c.a,v:c.a,pv:c.p,L,node:wh?wh.n.path:null,
    lead:'Нежелательных уходов в HQ — '+c.a+', год назад '+c.p,
    say:'нежелательных уходов в HQ больше, чем год назад: '+c.a+' против '+c.p,
    pills:(hc?['в HQ '+ppl(hc)+': доли не оцениваем — смотрим людей']:[]).concat(wh?[(c.a>1?'почти все':'это')+' — <b>«'+esc(wh.n.name)+'»</b>']:[]),
    big:{v:D.fmtInt(c.a),name:'нежелательных уходов в HQ с января по '+monOf(L),chip:'+'+(c.a-c.p)+' к году назад',cls:'down'},
    kp:'Нежелательные уходы HQ <b>'+c.a+'</b> · год назад '+c.p,
    todo:'разобрать каждый нежелательный уход с HRBP: что не удержало и кто из сильных сотрудников ещё под риском'};
}
/* поставка 121 (критики 119: у малой команды вывод блока — одна и та же заглушка «Без оценки» на 7–8 вкладках): главный факт
   блока в людях; null — общая строка «без оценки» */
function smallFact(bk,S,rl){
  const n=k=>Math.round(perOf(rl,k).v||0), pv=k=>{const p=perOf(rl,k).pv;return p==null?null:Math.round(p)};
  const ago=k=>pv(k)!=null?' · год назад '+pv(k):'';
  try{
    if(bk==='movement'){const h=n('hire'),ti=n('transfer_in'),a=n('attrition'),to=n('transfer_out');
      return {head:cap(D.CNT_TEXT)+' пришли '+(h+ti)+', ушли '+(a+to),
        pills:['найм <b>'+h+'</b>'+ago('hire'),'переводом в команду <b>'+ti+'</b>','уволились <b>'+a+'</b>'+ago('attrition'),'перевелись из команды <b>'+to+'</b>']}}
    if(bk==='turnover'){const a=n('attrition');if(!a)return {head:cap(D.CNT_TEXT)+' никто не уволился',pills:[]};
      const ex=D.exitProfile(rl,'ytd'), last=ex.tenure[ex.tenure.length-1], early=ex.tenure.filter(t=>t.early).reduce((t,x)=>t+x.value,0);
      return {head:'Уволились '+ppl(a)+(pv('attrition')!=null?' — год назад '+pv('attrition'):''),
        pills:[early?'со стажем до года — <b>'+early+'</b>':'',last&&!last.early&&last.value?'со стажем '+esc(lc(last.name))+' — <b>'+last.value+'</b>':''].filter(Boolean)}}
    if(bk==='hiring'&&D.metricVisible('vac_open',S)){const o=Math.round(perOf(rl,'vac_open').v||0);
      return {head:'Открытых вакансий — '+o+(pv('vac_open')!=null?' (год назад '+pv('vac_open')+')':''),pills:['закрыто с 1 января <b>'+n('vac_closed')+'</b>'+ago('vac_closed')]}}
    if(bk==='tgrowth'&&D.metricVisible('tgrowth_pass',S)){const p=n('tgrowth_pass'), d=n('tgrowth_deny');
      return {head:p+d?'Заявок на рост с 1 января: одобрено '+p+', отклонено '+d:'Заявок на рост с 1 января не было',pills:[]}}
    if(bk==='monitor'){const md=D.monData(rl);if(!md||!md.months.length)return null;
      const W=md.months, ci=W.findIndex(p=>p.cl), i0=ci<0?W.length-1:ci, c=W[i0], p=W[i0-1];
      return {head:c.full+': недорабатывали '+ppl(c.under)+', перерабатывали '+c.over,pills:p?['месяцем раньше — '+p.under+' и '+p.over]:[]}}
    if(bk==='ai'){const cw=D.aiCur(D.aiWeeks(rl));if(!cw||!cw.hc)return null;
      return {head:'Пользуются AI '+cw.wau+' из '+ppl(cw.hc),pills:[]}}
  }catch(e){return null}
  return null;
}
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
  /* поставка 121 (критики-руководители 119): у группы меньше 30 человек выводы — в людях. Отчёт меньше 30 — его отток и
     отклонённые заявки на рост; отчёт больше — отток подразделений первого уровня меньше 30 человек (до двух самых
     заметных): «В «Команда 2.3.2» ушли 4 из 8» было видно только на вкладке «Движение» */
  if(D.metricVisible('attrition',S)&&!D.isStub('attrition')){
    if(smallReport(rl)){const f=pplLeave(rl,null);if(f)out.push(f)}
    else unitsOf(S).filter(u=>u.hc<CARD.small).map(u=>pplLeave(u.lp,u.n)).filter(Boolean)
      .sort((a,c)=>c.w-a.w).slice(0,2).forEach(f=>out.push(f));
  }
  if(smallReport(rl)){const f=pplDeny(rl,S);if(f)out.push(f)}
  /* поставка 121 (критик на 49 человек: для HQ меньше 30 человек — как для малых команд, числа в людях): нежелательные уходы
     малой HQ — в людях, если их хотя бы 2 и больше, чем год назад */
  else if(D.isSmallHq('regret')&&D.metricVisible('regret',S)&&!D.isStub('regret')){const f=pplRegret(rl,S);if(f)out.push(f)}
  /* численность за год: найм, уходы, переводы — из чего сложилось */
  /* 30.10, критики: рост был назван тремя способами (+13% за год, +30 с начала года, водопад) — карточка теперь
     с начала года, как сводка над карточками: на конец декабря → сейчас, потоки — тоже с января */
  const hc=D.aggregateExt(rl,'hc_total'), y0=D.YEAR_START_EXT[L], from=hc[y0-1], to=hc[L];
  /* поставка 110 (критики: «−13% с начала года» у команды из 7 — это один человек): меньше 30 человек — сдвиг в людях,
     вывод — от 3 человек; больше — как раньше, от 10% */
  const smallHc=from!=null&&from<D.SMALL_N, hcMove=from&&(smallHc?Math.abs(Math.round(to)-Math.round(from))>=3:Math.abs(to-from)/from>=OBS.dev);
  if(hcMove){
    /* поставка 90: численность — сейчас, потоки — с января по закрытый месяц, с подписью */
    const Lc=factL('hire'), sm=k=>{const e=D.aggregateExt(rl,k);let x=0;for(let i=y0;i<=Lc;i++)x+=e[i]||0;return x};
    const dp=Math.round(Math.abs(to-from)/from*100);
    const dn=Math.abs(Math.round(to)-Math.round(from));
    out.push({key:'hc_total',sev:'mid',pri:5,w:0,
      lead:smallHc?'Численность '+(to>from?'выросла':'сократилась')+' на '+ppl(dn)+' с начала года: '+D.fmtInt(from)+' → '+D.fmtInt(to)
        :'Численность '+(to>from?'+':'−')+dp+'% с начала года: '+D.fmtInt(from)+' → '+D.fmtInt(to),
      body:cap(D.CNT_TEXT)+': найм '+D.fmtInt(sm('hire'))+', отток '+D.fmtInt(sm('attrition'))+', переводы в команду '+
        D.fmtInt(sm('transfer_in'))+' и из неё '+D.fmtInt(sm('transfer_out'))+'.',kind:'hc',v:to,pv:from,L});
  }
  /* поставка 110 (критики 07.11, C2): хвост вакансий — открытых в 1,5 раза больше, чем год назад, и хотя бы на 5 больше;
     было — «Вакансии закрываются быстрее… держать курс» при 86 открытых против 49 */
  if(D.metricVisible('vac_open',S)&&!D.isStub('vac_open')){
    const P=perOf(rl,'vac_open'), v=P.v, pv=P.pv;
    if(v!=null&&pv!=null&&pv>=5&&v>=1.5*pv&&v-pv>=5){
      const x=Math.round(v/pv*10)/10, xs=String(x).replace('.',',');
      out.push({key:'vac_open',sev:'mid',pri:2,w:(v-pv)/pv,kind:'vac',v,pv,L,
        lead:'Открытых вакансий в '+xs+' раза больше, чем год назад',
        say:'открытых вакансий в '+xs+' раза больше, чем год назад',
        todo:'посмотреть, какие вакансии висят дольше всего, и решить, нужны ли они ещё'});
    }
  }
  /* поставка 110 (C4): текучесть HQ против ориентира (15% в год, у IT — 12%), когда покраска HQ не выбрана — светофор
     «Как уходит HQ?» её видит, а главная молчала; меньше 30 человек в HQ — не оцениваем */
  if(S.paint!=='HQ'&&D.metricVisible('turnover_y',S)&&D.hqLight){
    const h=D.hqLight(S,null,null), r=h&&h.hc>=CARD.small&&h.rows.find(x=>x.key==='turnover_y');
    const Lh=D.LAST-(D.PARTIAL?1:0), kpi=r&&D.kpiAt('turnover_y',Object.assign({},S,{paint:'HQ'}),D.MONTHS[Lh].m);
    if(r&&r.v!=null&&kpi&&kpi.green&&r.v>=kpi.green*(1+OBS.dev)){
      const fv=x=>D.fmtVal('turnover_y',x), yr=kpi.annual?' ('+fv(kpi.annual.green)+' в год)':'';
      /* поставка 121 (критики 119: карточка беднее остальных — ни людей, ни года назад, ни графика, а 10 п.п. из её 24,6% — желательные
         уходы, которые хвалит соседняя карточка): численность HQ, год назад, желательная и нежелательная части, ряд по месяцам */
      const rv=k=>(h.rows.find(x=>x.key===k)||{}).v;
      out.push({key:'turnover_y',sev:'high',pri:1,w:rel(r.v,kpi.green),kind:'hqb',v:r.v,ref:kpi.green,L,
        hq:{hc:h.hc,ya:r.ya,nr:rv('nonregret'),rg:rv('regret'),cur:r.yoy?r.yoy.cur:null,ann:kpi.annual?kpi.annual.green:null},
        lead:'Текучесть HQ выше ориентира'+yr,
        say:'текучесть HQ выше ориентира',todo:'разобрать уходы HQ — кто уходит и почему, вкладка «Как уходит HQ?»'});
    }
  }
  /* поставка 110 (C3, критики: «нет ответа, какое подразделение в беде»): подразделение первого уровня, которое хуже всего
     отчёта по трём метрикам и больше (на 10% и хотя бы на 2 человека), — одной карточкой; меньше 30 человек — не оцениваем */
  {
    const U1=unitsOf(S).filter(u=>u.hc>=CARD.small), RM=['turnover_m','regret','underwork','office_att','ai_penetration']
      .filter(k=>D.metricVisible(k,S)&&!D.isStub(k)&&D.comparable(k));
    if(U1.length>=2){
      let worst=null;
      U1.forEach(u=>{
        const bad=[];
        RM.forEach(k=>{const m=D.METRIC_BY_KEY[k], uv=perOf(u.lp,k).v, rv=perOf(rl,k).v;
          if(uv==null||rv==null||!isBad(m,uv,rv)||rel(uv,rv)<OBS.dev)return;
          const x=excess(k,u.lp,uv,rv,factL(k),1);if(x&&x.n>=2)bad.push(k)});
        const to=perOf(u.lp,'transfer_out').v||0;
        if(to>=5&&u.hc&&to/u.hc>=0.2)bad.push('transfer_out');
        if(bad.length>=3&&(!worst||bad.length>worst.bad.length||bad.length===worst.bad.length&&u.hc>worst.u.hc))worst={u,bad};
      });
      if(worst){
        const nm=k=>lc(D.METRIC_BY_KEY[k].short||D.METRIC_BY_KEY[k].name), names=worst.bad.map(nm);
        out.push({key:worst.bad[0],sev:'mid',pri:3,w:worst.bad.length,kind:'unit',L,node:worst.u.n.path,
          lead:'«'+worst.u.n.name+'» хуже остальной команды по '+worst.bad.length+' '+U.plural(worst.bad.length,['метрике','метрикам','метрикам'])+': '+names.join(', '),
          say:'«'+worst.u.n.name+'» хуже остальной команды по '+worst.bad.length+' '+U.plural(worst.bad.length,['метрике','метрикам','метрикам']),
          todo:'открыть подразделение и пройти по этим метрикам — с руководителем «'+worst.u.n.name+'»'});
      }
    }
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
  ai_penetration:'показать AI-инструменты тем, кто ещё не пробовал',
  hc_total:'сверить изменение численности с планом',
  vac_open:'посмотреть, какие вакансии висят дольше всего, и решить, нужны ли они ещё'};
/* поставка 110 (C7, критики: совет «кого давно не повышали» при главной причине «Лучшее предложение»): совет по
   нежелательной текучести — от главной причины нежелательных уходов; причины нет — общий шаблон */
/* поставка 121 (критики 119: KPI нежелательной текучести — по HQ, а «главная причина» — по всем уходам: «9 из 17»; при ничьей
   1 : 1 : 1 одна из причин всё равно «главная»): охват подписан, при ничьей — «причины разные» и разбор поимённо */
function regretTodo(rl,S){
  const rs=D.exitReasons(rl,'ytd')||[], k=r=>r.regretN!=null?r.regretN:(r.regret?r.value:0);
  const srt=rs.filter(r=>k(r)>0).sort((a,b)=>k(b)-k(a)), tot=rs.reduce((a,r)=>a+k(r),0), top=srt[0];
  if(!top||tot<2)return null;
  const scope=S&&S.paint!=='HQ'?', по всем нежелательным уходам, не только HQ':'';
  const tied=srt.filter(r=>k(r)===k(top));
  if(tied.length>1)return 'разобрать нежелательные уходы поимённо с руководителями: причины разные — '+
    tied.slice(0,3).map(r=>'«'+r.name+'»').join(', ')+' поровну, по '+k(top)+' из '+tot+scope;
  const n=top.name;
  const adv=/предлож|зарплат|компенсац|доход|оплат/i.test(n)?'сверить зарплаты сильных сотрудников с рынком'
    :/рост|карьер|развит|повыш/i.test(n)?'поговорить с сильными сотрудниками о росте: кого давно не повышали'
    :/нагрузк|выгоран|переработ|график/i.test(n)?'проверить нагрузку у сильных сотрудников'
    :/руковод|конфликт|климат/i.test(n)?'разобрать эти уходы с руководителями команд'
    :'поговорить с сильными сотрудниками из зоны риска';
  return adv+': главная причина нежелательных уходов — «'+n+'» ('+k(top)+' из '+tot+scope+')';
}
/* «что происходит» коротко: [хуже, лучше] */
const SAY={turnover_m:['уходят чаще','уходят реже'],turnover_y:['уходят чаще','уходят реже'],
  regret:['нежелательных уходов больше','нежелательных уходов меньше'],
  /* поставка 110 (C8): у желательной выше — лучше; направление — прямо в словах, без «лучше, чем по цели» */
  nonregret:['желательных уходов меньше','желательных уходов больше'],
  time_to_fill:['вакансии закрываются дольше','вакансии закрываются быстрее'],
  vac_closed:['вакансий закрывают меньше','вакансий закрывают больше'],
  underwork:['недорабатывающих больше','недорабатывающих меньше'],
  overwork:['перерабатывающих больше','перерабатывающих меньше'],
  review_up:['оценку в ревью улучшают реже','оценку в ревью улучшают чаще'],
  office_att:['в офис ходят реже','в офис ходят чаще'],
  booking_viol:['броней без посещения больше','броней без посещения меньше'],
  tgrowth_conv:['T-рост одобряют реже','T-рост одобряют чаще'],
  tgrowth_pass:['T-рост одобряют реже','T-рост одобряют чаще'],
  tgrowth_deny:['T-рост отклоняют чаще','T-рост отклоняют реже'],
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
  if(f.kind==='hc')return 'численность '+(f.v>f.pv?'выросла':'сократилась')+' на '+(f.pv<D.SMALL_N?ppl(Math.abs(Math.round(f.v)-Math.round(f.pv)))
    :Math.round(Math.abs(f.v-f.pv)/f.pv*100)+'%')+' с начала года';
  if(f.kind==='vac'||f.kind==='unit'||f.kind==='hqb'||f.kind==='ppl'||f.kind==='uppl')return f.say;
  if(f.kind==='trend')return lc(m.name)+' '+(f.tr.b>f.tr.a?'растёт':'снижается')+' '+OBS.trend+' месяца подряд';
  if(f.key==='hire_plan'&&f.kind==='dev')return bad?'найм отстаёт от плана':'план найма выполняется с запасом';
  const st=(SAY[f.key]||[lc(m.name)+' хуже',lc(m.name)+' лучше'])[bad?0:1];
  if(f.key==='nonregret'&&f.kpi&&f.kind==='dev')return st+' цели'+(bad?' — с теми, с кем готовы расстаться, расстаёмся реже':' — это к лучшему');
  /* поставка 117: «чем в базе» (подразделения похожей численности) или «чем во всей компании» — не «чем по базе» */
  const yo=f.kind==='dev'&&f.yo?', но '+(SAY[f.key]||[lc(m.name)+' хуже',lc(m.name)+' лучше'])[f.yo==='worse'?0:1].split(' ').pop()+', чем год назад':'';
  return st+(f.kind==='yoy'?', чем год назад':f.key==='regret'&&f.kpi?' цели':f.kpi?', чем по цели':f.peer?', чем в базе':', чем во всей компании')+yo;
}
/* дробь метрики: своя или месячной, если накопительная — сумма месячных ('sum') */
function ratioDef(m){
  if(m.derived)return m.derived;
  const ch=m.ytd&&D.defOf(m.ytd);
  return ch&&ch.derived?Object.assign({},ch.derived,{win:'sum'}):null;
}
/* знаменатель: поставка 90 — за период (сумма месяцев с января), у накопительной доли — с начала года ('ytd'),
   у накопительной суммы месячных — в среднем за месяц с января ('sum') */
function denOf(lp,dv,L){
  const ks=Array.isArray(dv.den)?dv.den:[dv.den], y0=D.YEAR_START_EXT[L];
  let s=0;
  ks.forEach(k=>{const e=D.aggregateExt(lp,k);for(let i=y0;i<=L;i++)s+=e[i]||0});
  return dv.win==='sum'||STATE_NUM.has(dv.num)?s/(L-y0+1):s;
}
/* поставка 98 (критик-аналитик): у долей-состояний (недоработчики, переработчики, пользователи AI) разница в людях — в
   среднем за месяц, а не сумма за месяцы (было «≈ 2 316 человек» — человеко-месяцы); у долей-событий (уходы, заявки) —
   сумма событий за период, она и есть «сколько уходов сверх» */
const STATE_NUM=new Set(['perf_low','perf_high','ai_wau']);
/* Отклонение в штуках: |v − ref| в долях знаменателя → {n, noun, win}; не люди — null. w — вес для «Где это
   происходит»: у числителя не в штуках (NOUN null) — |v − ref| × знаменатель, без существительного */
function excess(key,lp,v,ref,L,w){
  const m=D.METRIC_BY_KEY[key];
  if(v==null||ref==null||NOPPL.has(key))return null;
  if(L==null)L=factL(key);
  const dv=ratioDef(m);
  if(dv)return NOUN[dv.num]===null&&!w?null:{n:Math.abs(v-ref)/(dv.scale||1)*denOf(lp,dv,L),noun:NOUN[dv.num]||PPL,
    win:STATE_NUM.has(dv.num)?'mon':dv.win};
  if(m.fmt==='pct')return {n:Math.abs(v-ref)/100*(D.aggregateExt(lp,'hc_total')[L]||0),noun:PPL,win:m.ytd?'sum':null};
  if(m.fmt==='int')return {n:Math.abs(v-ref),noun:NOUN[key]||PPL,win:null};
  return null;
}
/* первый уровень под юнитом отчёта — его листья под фильтрами и численность */
function unitsOf(S){
  /* поставка 121: первый уровень, где подразделений хотя бы два (сквозной — пропускаем) */
  return D.rowsOf(D.passRoot(S.unit)).map(n=>{
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
    const p=perOf(u.lp,f.key), ref=f.kind==='yoy'?p.pv:f.ref;
    r.v=p.v;r.ref=ref;
    /* 30.10, критики: «Деп 3.3 — 100%, хотя у Деп 3.1 текучесть втрое выше»: вклад — в людях, он у маленького
       подразделения тоже честный; «меньше 30 человек» гасит только его процент, а не вклад */
    if(r.v!=null&&ref!=null&&isBad(m,r.v,ref)){const x=excess(f.key,u.lp,r.v,ref,L,1);r.exc=x?x.n:0}
    return r;
  });
  rows.sort((a,c)=>c.exc-a.exc||c.hc-a.hc);
  /* поставка 110 (критики: «больше половины — Деп 2.2», а у Деп 2.3 на одного человека меньше): называем, только если
     подразделение впереди следующего хотя бы на 2 человека */
  const tot=rows.reduce((a,r)=>a+r.exc,0), lead2=rows[0]&&rows[0].exc-((rows[1]||{}).exc||0)>=2;
  const top=tot>0&&lead2&&rows[0].exc/tot>CARD.conc?rows[0]:null;
  /* поставка 121 (критик блока: проблема в двух подразделениях из трёх — не назван никто): одного нет, а на двух первых
     почти всё отклонение (от 80%, у каждого — от 2 человек) — называем оба */
  const top2=!top&&tot>0&&rows.length>=3&&rows[1].exc>=2&&(rows[0].exc+rows[1].exc)/tot>=0.8?[rows[0],rows[1]]:null;
  return {rows,tot,top,top2,share:top?top.exc/tot:0};
}
/* поставка 121: мини-график текучести HQ — с января против ориентира (его доля к каждому месяцу) */
function hqMini(f){
  const q=f.hq;if(!q||!q.cur||!q.ann||D.CUR_LEN<2)return '';
  const cur=q.cur.slice(0,D.CUR_LEN), ref=cur.map((_,i)=>+(q.ann*(i+1)/12).toFixed(2));
  return G.miniYoy(cur,ref,'ориентир '+D.fmtVal('turnover_y',q.ann)+' в год');
}
/* ряд для мини-графика: этот год с января против ориентира; до апреля — 12 месяцев окна */
function miniOf(f,rl,bl){
  const k=f.kind==='spike'?'attrition':f.key, fv=x=>D.fmtVal(k,x), L=D.NEXT-1;
  /* поставка 113: у вывода по медиане ряда медианы по месяцам нет — мини-график против прошлого года */
  const kpi=f.kind==='dev'&&f.kpi, base=f.kind==='dev'&&!kpi&&!f.peer;
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
  return G.miniYoy(cur,ref,kpi?'цель '+fv(f.kpi.green):base?'вся компания':'год назад');
}
/* Карточка факта: {key, block, sev, tag, head, body, todo, btn, chart, ppl, where} */
function cardOf(f,S,rl,bl){
  const m=D.METRIC_BY_KEY[f.key], bad=f.sev!=='good', fv=x=>D.fmtVal(f.key,x);
  const bk=(f.kind==='spike'||f.key==='attrition'&&/^u?ppl$/.test(f.kind))&&D.blockVisible('turnover',S)?'turnover':m.block, b=D.BLOCK_BY_KEY[bk];
  /* поставка 99 (критики: «технический заголовок»): заголовок — что происходит человеческим языком (say), число — крупно
     отдельной строкой с именем метрики, отклонение — цветным чипом; у месячных долей — «в среднем за месяц» */
  let head=f.lead;
  const mn=m.name+(STOCK.has(f.key)?', сейчас':'');
  if(f.kind==='dev'||f.kind==='yoy')head=cap(say(f));
  else if(f.kind==='trend')head=m.name+' '+(f.tr.b>f.tr.a?'растёт':'снижается')+' '+OBS.trend+' месяца подряд: '+fv(f.tr.a)+' → '+fv(f.tr.b);
  const cmpV=f.kind==='dev'?f.ref:f.kind==='yoy'?f.pv:null, dv=cmpV==null?null:+(f.v-cmpV).toFixed(2);
  const big=f.kind==='dev'||f.kind==='yoy'?{v:fv(f.v),name:mn+(/^(turnover_m|underwork|overwork|ai_penetration)$/.test(f.key)?', в среднем за месяц':''),
    chip:dv==null?'':D.fmtDelta(f.key,dv)+(f.kind==='dev'?(f.kpi?' к цели ':f.peer?' к базе ':' к компании ')+fv(f.ref):' к году назад '+fv(f.pv)),
    /* поставка 117: у чипа «к базе» — расшифровка базы в подсказке */
    chipTip:f.kind==='dev'&&f.peer&&!f.kpi?{key:f.key,pe:f.peer}:null,
    cls:bad?'down':'up'}
    /* поставка 110: у новых выводов (HQ против ориентира, хвост вакансий) — то же крупное число с чипом, что у остальных */
    :f.kind==='hqb'?{v:fv(f.v),name:'Текучесть HQ, накопительно',chip:D.fmtDelta('turnover_y',+(f.v-f.ref).toFixed(2))+' к ориентиру '+fv(f.ref),cls:'down'}
    :f.kind==='vac'?{v:D.fmtInt(f.v),name:'Открытые вакансии, сейчас',chip:'+'+D.fmtInt(f.v-f.pv)+' к году назад '+D.fmtInt(f.pv),cls:'down'}
    /* поставка 121: вывод в людях (малая группа) — число и подпись приходят с фактом */
    :f.kind==='ppl'||f.kind==='uppl'?f.big:null;
  const body=[];
  /* уходы — сначала людьми: сколько ушло с января и сколько год назад за те же месяцы.
     Фраза одна на все выводы (cards ставит её только в первый) */
  let leave='';
  const Lf=f.L!=null?f.L:D.NEXT-1, y0=D.YEAR_START_EXT[Lf];
  if(SAME[f.key]&&!/^(trend|hqb|unit|ppl|uppl)$/.test(f.kind)&&Lf>y0){
    /* поставка 106: уходы людьми — по дату данных, год назад — те же дни (как итог под графиком, periodTotal) */
    const P=D.periodTotal(rl,'attrition')||{}, a=P.v||0, p=P.pv||0;
    const d=Math.round(a)-Math.round(p);
    leave=cap(D.CNT_TEXT)+' ушли <b>'+ppl(a)+'</b> — '+(d?'на '+D.fmtInt(Math.abs(d))+' '+(d>0?'больше':'меньше')+', чем за те же дни год назад'
      :'столько же, сколько год назад за те же дни')+'.';
  }
  const x=f.kind==='dev'?excess(f.key,rl,f.v,f.ref,Lf):f.kind==='yoy'?excess(f.key,rl,f.v,f.pv,Lf)
    :f.kind==='trend'?excess(f.key,rl,f.tr.b,f.tr.a,Lf):f.kind==='spike'?{n:f.v-f.usual,noun:LEAVE}:null;
  const n=x?Math.round(x.n):0, q=n>=1?'<b>≈ '+ppl(n,x.noun)+(x.win==='mon'?' в месяц':'')+'</b>':'';
  /* 30.10, шаг 2: те же факты короткими пилюлями — «меньше букв, главное видно сразу» */
  const pills=[];
  if(leave){const P=D.periodTotal(rl,'attrition')||{};
    pills.push('ушли '+esc(D.CNT_SPAN)+' <b>'+D.fmtInt(Math.round(P.v||0))+'</b> · год назад '+D.fmtInt(Math.round(P.pv||0)))}
  if(f.pills)f.pills.forEach(t=>pills.push(t));
  /* поставка 90: у ухода год к году разница людьми — в пилюле «ушли …»; «≈ N разницы» из ставки ей противоречил бы */
  if(q&&!(leave&&f.kind==='yoy'))pills.push(f.kind==='yoy'?q+' разницы с прошлым годом':f.kind==='trend'?q+' за '+OBS.trend+' мес.':f.kind==='spike'?q+' сверх обычного'
    :m.better==='higher'?(bad?'не хватает '+q:'на '+q+' больше '+(f.kpi?'цели':f.peer?'базы':'всей компании')):q+(bad?' сверх ':' ниже ')+(f.kpi?'цели':f.peer?'базы':'уровня всей компании'));
  if(q){
    const w=f.kpi?'цели':f.peer?'базы':'уровня всей компании', when=' '+D.PER_TEXT;
    if(f.kind==='yoy')body.push('<!--ppl-->Это '+q+' разницы с прошлым годом.');
    else if(f.kind==='trend')body.push('За '+OBS.trend+' месяца — '+q+'.');
    else if(f.kind==='spike')body.push('Это '+q+' сверх обычного.');
    else if(m.better==='higher')body.push(bad?'До '+(f.kpi?'цели':f.peer?'уровня базы':'уровня всей компании')+' не хватает '+q+'.':'Это на '+q+' больше '+w+'.');
    else body.push(bad?'Это '+q+' сверх '+w+when+'.':'Это на '+q+' меньше '+w+when+'.');
  }
  const wh=bad&&/^(dev|yoy|spike)$/.test(f.kind)?whereOf(f,S):null;
  if(wh&&wh.top)body.push((wh.share>=0.8?'Почти вся эта разница':'Больше половины этой разницы')+' — в <b>«'+esc(wh.top.n.name)+'»</b>.');
  if(wh&&wh.top)pills.push((wh.share>=0.8?'почти всё':'больше половины')+' — <b>«'+esc(wh.top.n.name)+'»</b>');
  const two=wh&&wh.top2?'<b>«'+esc(wh.top2[0].n.name)+'»</b> и <b>«'+esc(wh.top2[1].n.name)+'»</b>':'';
  if(two){body.push('Почти вся эта разница — в '+two+'.');pills.push('почти всё — '+two)}
  if(f.kind==='hqb'&&f.hq){const q=f.hq, over=Math.round((f.v-f.ref)/100*q.hc);
    if(over>=1)pills.push('<b>≈ '+ppl(over)+'</b> сверх ориентира · в HQ '+ppl(q.hc));
    /* два ориентира в карточке путали (критик блока): годовой и его доля к закрытому месяцу — одной строкой */
    if(q.ann)pills.push('ориентир '+fv(q.ann)+' в год, к '+D.MONTH_DAT[D.MONTHS_EXT[f.L].m]+' — '+fv(f.ref));
    if(q.nr!=null&&q.rg!=null){pills.push('из них желательные '+fv(q.nr)+', нежелательные '+fv(q.rg)+', прочие '+fv(Math.max(0,f.v-q.nr-q.rg)));
      body.push('Без желательных уходов — '+esc(fv(Math.max(0,f.v-q.nr)))+' при ориентире '+esc(fv(f.ref))+'.')}}
  const sub=f.kind==='dev'&&f.pv!=null?'год назад '+fv(f.pv):f.kind==='hqb'&&f.hq&&f.hq.ya!=null?'год назад '+fv(f.hq.ya):'';
  /* поставка 125 (фото владельца 08.11: «год назад X» и тут же «Год назад — X»): год назад уже стоит строкой под числом
     (sub) — фразу «Год назад — …» в текст карточки без пилюль больше не добавляем */
  if(f.kind==='dev'&&f.tr)body.push(esc(cap(trendWord(m)))+'.');
  let todo='Держать курс: отдельных действий не нужно.';
  if(bad){
    const t=f.todo?f.todo:f.kind==='spike'?'разобрать уходы за '+D.MONTH_NOM[D.MONTHS_EXT[Lf].m]+': причины и подразделения'
      :f.key==='regret'&&regretTodo(rl,S)||CARD_TODO[f.key]||'открыть блок и посмотреть, где отклонение';
    /* поставка 110 (критики): без логина руководителя в тексте — имя подразделения достаточно */
    todo='<b>Что сделать:</b> '+(wh&&wh.top?'начать с «'+esc(wh.top.n.name)+'» — ':wh&&wh.top2?'начать с «'+esc(wh.top2[0].n.name)+'» и «'+esc(wh.top2[1].n.name)+'» — ':'')+esc(t)+'.';
  }
  /* пилюля-итог для вывода блока: метрика, значение и с чем сравниваем */
  const ref=f.kind==='dev'?(f.kpi?'цель ':f.peer?'база ':'компания ')+fv(f.ref):f.kind==='yoy'?'год назад '+fv(f.pv)
    :f.kind==='trend'?fv(f.tr.a)+' → '+fv(f.tr.b):'';
  /* поставка 120 (критики 119: плашка «Текучесть накопительная 31,9%» в выводе блока — это текучесть HQ, рядом 20,7% под тем же
     именем): у вывода по HQ — своё имя и ориентир */
  const kp=f.kp?f.kp:f.kind==='hqb'?'Текучесть HQ с января <b>'+esc(fv(f.v))+'</b> · ориентир '+esc(fv(f.ref))
    :esc(mn)+' <b>'+esc(fv(f.kind==='trend'?f.tr.b:f.v))+'</b>'+(ref?' · '+esc(ref):'');
  return {key:f.key,fact:f,block:bk,blockName:b.name,sev:f.sev,tag:SEV_TAG[f.sev],head,body,leave,todo,pills,kp,big,sub,
    ppl:n,where:wh,chart:f.kind==='hqb'?hqMini(f):/^(unit|uppl)$/.test(f.kind)||f.kind==='ppl'&&f.key!=='attrition'?'':miniOf(f,rl,bl),
    /* поставка 110 (E8): подсказка мини-графика — с чем он сравнивает, а не служебная фраза */
    chartTip:'По месяцам '+(D.CUR_LEN>=4?'с начала года':'за 12 месяцев')+' против '+(f.kind==='dev'&&!f.peer?(f.kpi?'цели':'всей компании'):'прошлого года')+'.',
    btn:wh&&wh.top?{label:'Показать подразделение',go:bk+'|'+wh.top.n.path}:f.node?{label:'Показать подразделение',go:bk+'|'+f.node}
      :{label:'Открыть «'+b.name+'»',tab:bk}};
}
/* Отчёт меньше 30 человек: доли не оцениваются — остаются всплеск и численность */
const SMALL_OK=new Set(['underwork','overwork']), SMALL_PPL=3;
function smallReport(rl){const hc=D.lastVal(rl,'hc_total');return hc!=null&&hc<CARD.small}
/* Все карточки по отбору: по тяжести, внутри — по людям сверх ориентира; до восьми */
function cards(S,rl,bl,all){
  const sm=smallReport(rl), rank={high:0,mid:1,good:2};
  /* 30.10, критики (маленькая команда: «переработка у 7 из 17, а отчёт пишет всё спокойно»): доли недоработчиков и
     переработчиков — это люди; у маленькой команды их оцениваем, если разница — от SMALL_PPL человек */
  const list=overview(S,rl,bl,true).map((f,i)=>Object.assign(cardOf(f,S,rl,bl),{i}))
    .filter(c=>!(sm&&D.METRIC_BY_KEY[c.key].fmt==='pct'&&c.fact.kind!=='spike'&&c.fact.kind!=='hc'&&
      !(SMALL_OK.has(c.key)&&c.sev!=='good'&&c.ppl>=SMALL_PPL)));
  list.sort((a,c)=>rank[a.sev]-rank[c.sev]||c.ppl-a.ppl||a.i-c.i);
  /* одна история — одна карточка: текучесть месячная и с начала года об одном
     («уходят чаще») — остаётся первая; «С января ушли N» — тоже один раз, а там,
     где её нет, — разница людьми */
  /* поставка 110 (C5, критики: «Уходят реже, чем год назад» при 61 и 61 ушедших — ставка упала только от роста команды):
     хорошая новость про уходы — только если людей ушло хотя бы на 2 меньше */
  const Pa=D.periodTotal(rl,'attrition')||{}, fewer=Pa.pv!=null&&Pa.v!=null&&Pa.pv-Pa.v>=2;
  const list2=list.filter(c=>!(c.sev==='good'&&SAME[c.key]&&/^(dev|yoy|trend)$/.test(c.fact.kind)&&!fewer));
  const seen=new Set();let said=false;
  const out=list2.filter(c=>{const g=!/^(spike|hqb|unit|uppl)$/.test(c.fact.kind)&&SAME[c.key];if(!g)return true;
    const k=g+(c.sev==='good');if(seen.has(k))return false;seen.add(k);return true});
  out.forEach(c=>{
    const b=c.body.slice();
    if(c.leave&&!said){said=true;b.unshift(c.leave);if(c.fact.kind==='yoy')b.splice(b.findIndex(t=>/^<!--ppl-->/.test(t)),1)}
    else if(c.leave)c.pills=c.pills.filter(t=>!/^ушли /.test(t));
    c.body=b.join(' ').replace(/<!--ppl-->/g,'');
  });
  return all?out:out.slice(0,OBS.max);
}
/* Сводка над карточками: команда растёт или нет (±5% с начала года — стабильна),
   главное хуже и лучше, сколько в норме */
function lead(S,rl,list,norm){
  const hc=D.lastVal(rl,'hc_total')||0, net=D.lastVal(rl,'net_ytd')||0, d0=hc-net;
  /* поставка 110 (критики): у команды меньше 30 человек «растёт / сокращается» — от 2 человек, а не от 5% (один человек) */
  const stable=!d0||(d0<CARD.small?Math.abs(Math.round(net))<2:Math.abs(net)/d0<0.05);
  /* поставка 110: на уровне всей компании — «Компания», а не «Команда» */
  /* поставка 120 (критики 119: «Команда стабильна» при 27 уходах и 30 переводах из команды, у команды из 7 — 4 ухода и
     2 перевода): «стабильна» — только когда мало и самих уходов. Уволились и перевелись из команды с 1 января от 15%
     состава на начало года (у команды меньше 30 человек — от 3 человек) — «численность почти не изменилась», и отдельной
     фразой, сколько людей сменилось */
  const nOut=k=>Math.round((perOf(rl,k).v)||0), att=nOut('attrition'), tout=D.metricVisible('transfer_out',S)?nOut('transfer_out'):0;
  const churn=d0>0&&(d0<CARD.small?att+tout>=SMALL_PPL:(att+tout)/d0>=0.25);
  const who=D.isSelfBase()?'Компания':'Команда', team=stable&&churn?'Численность почти не изменилась':who+(stable?' стабильна':net>0?' растёт':' сокращается');
  /* сдвиг численности уже сказан словом «растёт / сокращается» — в сводке не повторяем («растёт, но выросла на 10%») */
  const bad=list.find(c=>c.sev!=='good'&&c.fact.kind!=='hc'), good=list.find(c=>c.sev==='good');
  const nAct=list.filter(c=>c.sev!=='good').length;
  let h='<b>'+esc(team+(bad?', но '+say(bad.fact):good?', и '+say(good.fact):stable&&churn?'':', заметных отклонений нет'))+'.</b> '+
    esc(ppl(hc))+' — '+(net?'на '+D.fmtInt(Math.abs(net))+' '+(net>0?'больше':'меньше')+', чем на начало года':'столько же, сколько на начало года')+'.';
  /* у всей компании «переводы из команды» — смена типа численности, а не другие подразделения: их здесь не называем */
  /* вывод об уходах малой команды уже сказал, сколько ушло, — фразу о смене людей не повторяем */
  if(churn&&(stable||d0<CARD.small)&&!(bad&&bad.fact.kind==='ppl'&&bad.key==='attrition')){const tt=tout&&!D.isSelfBase()?', перевелись в другие подразделения '+D.fmtInt(tout):'';
    h+=' '+esc(stable?'Но людей сменилось много: '+D.CNT_TEXT+' уволились '+D.fmtInt(att)+tt+'.':cap(D.CNT_TEXT)+' уволились '+D.fmtInt(att)+tt+'.')}
  if(smallReport(rl))h+=' В команде меньше '+CARD.small+' человек — доли не оцениваем: один человек сдвигает их на несколько пунктов; смотрим людей.';
  /* поставка 126 (владелец: «куча текста» над карточками): «Ниже — N выводов…, и N хороших новостей; ещё N метрик в норме»
     повторяло карточки под сводкой и строку счётчиков под ними — снято; остаётся «требующего действий нет», если так */
  return h+(nAct?'':' Требующего действий нет.');
}
/* Вывод блока: заголовок, до трёх фактов по номерам, «Что сделать», где это
   происходит. Нет фактов — «всё спокойно» и что проверено. */
function blockSummary(bk,S,rl,bl){
  const list=cards(S,rl,bl,true).filter(c=>c.block===bk||(c.fact.kind==='spike'&&bk==='movement'));
  const sev=list.length?list[0].sev:'none';
  window.TPINSIGHTS.lastSev=sev;
  if(!list.length)return {sev,list};
  const bad=list.find(c=>c.sev!=='good'), good=list.find(c=>c.sev==='good');
  const tail=c=>c.where&&c.where.top?' — '+(c.where.share>=0.8?'почти всё':'больше половины')+' в «'+c.where.top.n.name+'»'
    :c.where&&c.where.top2?' — почти всё в «'+c.where.top2[0].n.name+'» и «'+c.where.top2[1].n.name+'»':'';
  const head=bad&&good&&good!==list[0]?cap(say(good.fact))+', но '+say(bad.fact)+tail(bad)
    :cap(say(list[0].fact))+tail(list[0]);
  return {sev,list,head,todo:(bad||list[0]).todo};
}

/* lastSev — тяжесть последнего отрисованного инсайта: её читает mascot.js,
   чтобы эмоция огонька совпадала с тем, что пользователь видит в плашке. */
window.TPINSIGHTS={yoyStory,overview,cards,lead,blockSummary,smallFact,whereOf,unitsOf,excess,CARD,SEV_TAG,OBS,INS_GAP,INS_TREND,lastSev:'none'};
})();

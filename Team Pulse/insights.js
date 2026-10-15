/* ============================================================================
   insights.js — движок предрасчитанных инсайтов. Неймспейс: window.TPINSIGHTS.

   Это не текстовый шаблон, а отбор фактов по порогам. Правило: нет факта выше
   порога — нет блока инсайтов, вместо него одна строка «отклонений нет».
   Никакой воды.

   Пороги вынесены сюда, чтобы крутить их не задевая экраны.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI;
const esc=U.esc;

const INS_GAP=10;      /* порог отклонения от базы или KPI, % */
const INS_TREND=3;     /* длина направленного тренда, месяцев */
const INS_CONC=50;     /* доля одного подразделения в общем отклонении, % */

function relGap(v,base){return base?((v-base)/Math.abs(base))*100:0}
function trendLen(ser){
  let up=1,dn=1;
  for(let i=ser.length-1;i>0;i--){if(ser[i]>ser[i-1])up++;else break}
  for(let i=ser.length-1;i>0;i--){if(ser[i]<ser[i-1])dn++;else break}
  return up>=dn?{dir:'up',len:up}:{dir:'dn',len:dn};
}
function isBad(m,v,base){return m.better==='lower'?v>base:m.better==='higher'?v<base:false}

/* ctx: {S, b, mainK, rl, bl, rows, rowLeaves} */
function build(ctx){
  const S=ctx.S, b=ctx.b, mainK=ctx.mainK, rl=ctx.rl, bl=ctx.bl, rows=ctx.rows;
  const out=[];
  /* факты только по выбранным метрикам: инсайт про отключённую метрику
     некуда проверить — её нет ни в таблице, ни в KPI-карточках */
  D.visibleMetricsOfBlock(b.key,S).forEach(m=>{
    if(m.better==='flat')return;
    /* пробник: у заглушки («демо») выводов нет — цифра сгенерирована */
    if(D.isStub(m.key))return;
    const ser=D.aggregate(rl,m.key), v=ser[D.LAST];
    /* доля без знаменателя (в окне не было ни одного найма) — фактов нет */
    if(v==null)return;
    const kpi=D.kpiFor(m.key,S);
    const base=kpi?kpi.green:D.lastVal(bl,m.key);
    /* разрыв считаем только там, где сравнение осмысленно; тренд — у любой метрики */
    if((D.comparable(m.key)||kpi)&&base!=null&&isFinite(base)){
      const gap=relGap(v,base), bad=isBad(m,v,base);
      if(Math.abs(gap)>=INS_GAP){
        /* разница — в единицах метрики (п.п., дни), а не «на 23%» от процента:
           у долей относительный процент читается двояко (TEXT_GUIDE.md, п. 6) */
        out.push({sev:bad?(Math.abs(gap)>=25?3:2):1,metric:m,
          text:'<b>'+esc(m.name)+'</b> — '+D.fmtVal(m.key,v)+', '+(bad?'хуже':'лучше')+' '+(kpi?'цели':'базы')+' ('+
            D.fmtVal(m.key,base)+') на '+esc(dot(absD(m.key,v-base)))});
      }
    }
    const t=trendLen(ser);
    if(t.len>=INS_TREND){
      const worsening=(m.better==='lower'&&t.dir==='up')||(m.better==='higher'&&t.dir==='dn');
      out.push({sev:worsening?2:1,metric:m,
        text:'<b>'+esc(m.name)+'</b> '+(t.dir==='up'?'растёт':'снижается')+' '+t.len+' '+
          U.plural(t.len,['месяц','месяца','месяцев'])+' подряд: '+
          D.fmtVal(m.key,ser[D.LAST-t.len+1])+' → '+D.fmtVal(m.key,v)+(worsening?'. Это плохой знак.':'. Это хороший знак.')});
    }
  });

  /* концентрация отклонения в одном подразделении */
  const mM=D.METRIC_BY_KEY[mainK];
  if(mM.better!=='flat'&&rows.length>1&&(D.comparable(mainK)||D.kpiFor(mainK,S))){
    const kpi=D.kpiFor(mainK,S);
    const base=kpi?kpi.green:D.lastVal(bl,mainK);
    const tops=rows.filter(r=>r.depth===1).map(r=>{
      const lp=ctx.rowLeaves(r.n.path);
      const v=D.lastVal(lp,mainK), hc=D.lastVal(lp,'hc_total');
      return {name:r.n.name,v:v,hc:hc,exc:v!=null&&isBad(mM,v,base)?Math.abs(v-base)*Math.max(hc,1):0};
    });
    const total=tops.reduce((a,x)=>a+x.exc,0);
    if(total>0){
      const top=tops.slice().sort((a,b2)=>b2.exc-a.exc)[0];
      const share=top.exc/total*100;
      if(share>=INS_CONC)out.push({sev:3,metric:mM,
        /* имя метрики — в кавычках и как есть: «по проникновение ai» ломало
           и падеж, и аббревиатуру */
        text:'Больше всего тянет вниз <b>«'+esc(top.name)+'»</b>: на него приходится '+share.toFixed(0)+'% отставания по метрике «'+
          esc(mM.name)+'». У него '+D.fmtVal(mainK,top.v)+' при '+(kpi?'цели ':'базе ')+D.fmtVal(mainK,base)+
          ', '+D.fmtInt(top.hc)+' чел. Начните с него.'});
    }
  }
  out.sort((a,b2)=>b2.sev-a.sev);
  return out;
}

function html(ctx){
  const S=ctx.S, b=ctx.b;
  const ins=build(ctx);
  const id='ins-'+b.key, open=S.aiOpen===id;
  if(!ins.length){
    /* дежурный огонёк в подвале навигации отражает ту же оценку, что и
       плашка инсайта — собственной он не изобретает, иначе два источника
       правды разошлись бы на одном экране */
    window.TPINSIGHTS.lastSev='none';
    /* «Отклонений нет» — такая же работа движка, как и найденный инсайт:
       отбор прошёл, просто ничего выше порогов не нашлось. Поэтому здесь такая
       же AI-плашка, а не серая строчка: место подсказки на экране одно и то
       же на всех вкладках, и раскрывается оно везде одинаково. */
    const vis=D.visibleMetricsOfBlock(b.key,S).filter(m=>!D.isStub(m.key));
    const hasCmp=vis.some(m=>D.comparable(m.key));
    const nChk=vis.filter(m=>m.better!=='flat').length;
    const lead=hasCmp
      ? 'Всё спокойно: метрики блока близки к базе <b>«'+esc(D.benchmarkLabel(S))+'»</b>, устойчивых трендов нет.'
      : 'Всё спокойно: устойчивых трендов нет. Метрики блока — количества, с базой они не сравниваются.';
    const bl2=[];
    if(hasCmp)bl2.push('Проверили <b>'+nChk+' '+U.plural(nChk,['метрику','метрики','метрик'])+
      '</b>: ни одна не отличается от базы больше чем на '+INS_GAP+'%.');
    bl2.push('Ни одна метрика не растёт и не падает '+INS_TREND+' месяца подряд.');
    bl2.push('Нет подразделения, которое одно тянуло бы блок вниз.');
    return U.aiBlock(id,'Главное в блоке',lead,bl2,open,'insight sev-none');
  }
  const maxSev=ins[0].sev;
  const sevCls=maxSev>=3?'high':maxSev===2?'mid':'good';
  window.TPINSIGHTS.lastSev=sevCls;
  const sevTxt=maxSev>=3?'требует действий':maxSev===2?'стоит внимания':'позитив';
  const lead=ins[0].text.replace(/<[^>]+>/g,'');
  let h='<div class="ai insight sev-'+sevCls+'"><div class="ai-h" data-ai="'+id+'">'+
    U.aiIco(open)+'<span class="ai-t">Главное в блоке</span>'+
    '<span class="ai-lead">'+(open?'':esc(lead))+'</span>'+
    '<span class="ai-sev '+sevCls+'">'+sevTxt+'</span>'+
    '<span class="ai-tag">'+(open?'свернуть':'подробнее')+'</span>'+
    '<span class="ai-caret">'+(open?'▲':'▼')+'</span></div>';
  if(open){
    h+='<div class="ai-b"><ul>'+ins.slice(0,4).map(x=>'<li>'+x.text+'</li>').join('')+'</ul>'+
      '<div class="ins-note">Здесь только заметное: отличие от ориентира больше '+INS_GAP+
      '%, рост или падение '+INS_TREND+' месяца подряд, одно подразделение тянет вниз весь блок.</div></div>';
  }
  return h+'</div>';
}

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
const OBS={dev:INS_GAP/100,yoyPp:3,trend:INS_TREND,max:6,spikeX:2,spikeMin:3};
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
  if(kpi)return {kpi:kpi,w:'цели',at:()=>kpi.green};
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
function worsening(m,ext){
  if(m.better==='flat'||accum(m))return null;
  const L=D.NEXT-1, n=OBS.trend, v0=ext[L-n];
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
  out.push({i:b,s:'main',html:'<b>'+esc(cap(D.MONTH_NOM[b]))+' — '+f(v)+'</b>'+
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
    const top=Math.max.apply(null,cur.concat(prev,ref?range(12).map(k=>ref.at(k)):[],ref&&ref.kpi?[ref.kpi.red]:[])
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

/* Один факт на метрику по отбору целиком: {key, sev, pri, w, lead, body}. */
function metricFact(m,S,rl,bl){
  const key=m.key, ext=D.aggregateExt(rl,key), L=D.NEXT-1, v=ext[L];
  if(v==null)return null;
  const kpi=D.kpiFor(key,S), ref=kpi?kpi.green:(D.comparable(key)?D.lastVal(bl,key):null);
  const st=ref==null?'neutral':kpi?D.stateForKpi(key,v,kpi):D.compareState(key,v,ref);
  const f=x=>D.fmtVal(key,x), w=kpi?'цели':'базы', pv=ext[L-12];
  const ago=pv!=null?'Год назад — '+f(pv)+'.':'';
  const tr=worsening(m,ext);
  if(st==='bad'&&rel(v,ref)>=OBS.dev)
    return {key,sev:kpi?'high':'mid',pri:1,w:rel(v,ref),lead:m.name+' '+f(v)+' — хуже '+w+' '+f(ref),
      body:ago+(tr?' '+cap(trendWord(m))+'.':'')};
  /* год к году: 10% от прошлого значения или 3 п.п. у долей */
  if(pv!=null&&m.better!=='flat'&&m.fmt!=='int'&&Math.abs(v-pv)>=(m.fmt==='pct'?0.5:1e-9)&&
     (rel(v,pv)>=OBS.dev||(m.fmt==='pct'&&Math.abs(v-pv)>=OBS.yoyPp))){
    const worse=m.better==='lower'?v>pv:v<pv;
    return {key,sev:worse?'mid':'good',pri:2,w:rel(v,pv),
      lead:m.name+' '+f(v)+' — '+(worse?'хуже':'лучше')+', чем год назад ('+f(pv)+')',
      body:ref!=null?cap(w==='цели'?'цель':'база')+' — '+f(ref)+'.':''};
  }
  if(tr)return {key,sev:'mid',pri:3,w:rel(tr.b,tr.a),lead:m.name+': '+trendWord(m),
    body:cap(extMonth(tr.from).name)+' '+f(tr.a)+' → '+D.MONTH_NOM[D.CUR_LEN-1]+' '+f(tr.b)+'.'};
  if(st==='good'&&rel(v,ref)>=OBS.dev)
    return {key,sev:'good',pri:1,w:rel(v,ref),lead:m.name+' '+f(v)+' — лучше '+w+' '+f(ref),body:ago};
  return null;
}
function overview(S,rl,bl){
  const out=[], L=D.NEXT-1;
  D.METRICS.forEach(m=>{
    if(!D.metricVisible(m.key,S)||D.isStub(m.key))return;
    const x=metricFact(m,S,rl,bl);
    if(x)out.push(x);
  });
  /* всплеск уходов: последний месяц против среднего за 11 до него */
  if(D.metricVisible('attrition',S)){
    const a=D.aggregateExt(rl,'attrition'), last=a[L]||0;
    let usual=0;for(let i=L-11;i<L;i++)usual+=a[i]||0;usual/=11;
    if(last>=OBS.spikeMin&&last>=OBS.spikeX*usual)
      out.push({key:'attrition',sev:last>=3*usual?'high':'mid',pri:0,w:last-usual,
        lead:'Всплеск уходов в '+['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'][D.MONTHS_EXT[L].m]+
          ': '+D.fmtInt(last)+' — обычно '+(usual<1?'меньше одного':'около '+D.fmtInt(Math.round(usual)))+' в месяц',
        body:'Уволились за месяц, по любой причине.'});
  }
  /* численность за год: найм, уходы, переводы — из чего сложилось */
  const hc=D.aggregateExt(rl,'hc_total'), from=hc[L-12], to=hc[L];
  if(from&&Math.abs(to-from)/from>=OBS.dev){
    const sm=k=>D.aggregate(rl,k).reduce((x,y)=>x+(y||0),0);
    const dp=Math.round(Math.abs(to-from)/from*100);
    out.push({key:'hc_total',sev:'mid',pri:5,w:0,
      lead:'Численность '+(to>from?'+':'−')+dp+'% за год: '+D.fmtInt(from)+' → '+D.fmtInt(to),
      body:'Найм '+D.fmtInt(sm('hire'))+', отток '+D.fmtInt(sm('attrition'))+', переводы в команду '+
        D.fmtInt(sm('transfer_in'))+' и из неё '+D.fmtInt(sm('transfer_out'))+'.'});
  }
  const rank={high:0,mid:1,good:2};
  out.sort((a,c)=>rank[a.sev]-rank[c.sev]||a.pri-c.pri||c.w-a.w);
  return out.slice(0,OBS.max);
}

/* lastSev — тяжесть последнего отрисованного инсайта: её читает mascot.js,
   чтобы эмоция огонька совпадала с тем, что пользователь видит в плашке. */
window.TPINSIGHTS={build,html,yoyStory,overview,OBS,INS_GAP,INS_TREND,INS_CONC,lastSev:'none'};
})();

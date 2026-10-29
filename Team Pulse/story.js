/* ============================================================================
   story.js — движок историй. Неймспейс: window.TPSTORY. Итерация 32.

   Правая панель детальной вкладки — не набор графиков, а история по главам
   (концепция B, выбор заказчика: «экран, который мы переключаем, должен
   отвечать на вопрос, а не только показывать метрику»). Глава = под-вкладка
   блока. Для каждой главы движок считает по данным:

     q      — вопрос главы («Сколько уходит?») — подпись шага в степпере;
     sum    — короткий ответ под вопросом («34 ухода за год»);
     st     — сигнал шага: good / bad / n. Тот же светофор, что везде:
              зелёный и красный, остальное серым; у метрик без оценки — n;
     head   — заголовок-вывод над графиками (утверждение, а не название);
     lede   — одна фраза с цифрами, на которых держится вывод;
     facts  — 2–3 факта для колонки «Что важно»;
     focus  — «Где сосредоточено»: подразделения уровнем ниже по метрике главы;
     act    — «Что сделать», когда есть явная точка приложения сил;
     ann    — что подписать на графиках главы: {metricKey: {hi:[i], notes:[{i,t}]}}.

   Как и insights.js, это не шаблон, а отбор фактов по данным: нет повода —
   нет «Что сделать», нет всплеска — нет заметки «пик» на графике. Всё
   считается из тех же рядов, что рисуют графики главы, поэтому цифры в тексте
   и на полотне не расходятся. Жирное в тексте — **так**: разметку собирает
   TPUI.richText, здесь её нет.

   Заглушки пробника (D.isStub, демо-вкладки) выводов не получают: цифра
   сгенерирована, и утверждать по ней что-либо нельзя.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI;

/* ---------- язык ---------- */
const PREP=['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];
const DOW_IN={'Понедельник':'в понедельник','Вторник':'во вторник','Среда':'в среду','Четверг':'в четверг',
  'Пятница':'в пятницу','Суббота':'в субботу','Воскресенье':'в воскресенье'};
const PPL=['человек','человека','человек'], EXITS=['уход','ухода','уходов'], HIRES=['найм','найма','наймов'];
const pl=(n,f)=>D.fmtInt(n)+' '+U.plural(n,f);
const mPrep=i=>'в '+PREP[D.MONTHS[i].m];
const mNom=i=>D.MONTH_NOM[D.MONTHS[i].m];
const f=(k,v)=>D.fmtVal(k,v);
const pc=(a,b)=>b?Math.round(a/b*100):0;
const minus=n=>String(n).replace('-','−');
const signed=n=>(n>0?'+':'')+minus(D.fmtInt(n));

/* ---------- ряды ---------- */
function leaves(S,path){return D.leavesUnder(path).map(l=>l.path).filter(p=>D.leafPasses(p,S))}
const ser=(lp,k)=>D.aggregate(lp,k);
const sum=a=>a.reduce((x,y)=>x+(y||0),0);
const s12=(lp,k)=>sum(ser(lp,k));
const ytd=(lp,k)=>D.sumWin(ser(lp,k),'ytd');
function argmax(a){let j=-1;a.forEach((v,i)=>{if(v!=null&&(j<0||v>a[j]))j=i});return j}
function argmin(a){let j=-1;a.forEach((v,i)=>{if(v!=null&&(j<0||v<a[j]))j=i});return j}
function median(a){const b=a.filter(v=>v!=null).slice().sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:0}
/* Месяц оценки в тексте глав: у потоков незакрытого месяца и вызревающих — последний закрытый, как у выводов главной
   (ревью критиков 26.10: «вакансии закрываются дольше» и «конверсия за октябрь» считались по 1–12 октября) */
const jIdx=k=>D.LAST-(D.partFlow(k)||D.closedOnly(k)?1:0);
function yearAgo(lp,k){return D.aggregateExt(lp,k)[D.NEXT-13-(D.LAST-jIdx(k))]}
/* оценка метрики так же, как в карточке: цель KPI, иначе база, иначе без оценки; i — месяц оценки */
function judge(k,c){
  const i=jIdx(k), v=ser(c.lp,k)[i], kpi=D.kpiAt(k,c.S,D.MONTHS[i].m);
  const base=kpi?kpi.green:(D.comparable(k)?ser(c.bl,k)[i]:null);
  let st='n';
  if(v!=null&&base!=null){
    const s=kpi?D.stateForKpi(k,v,kpi):D.compareState(k,v,base);
    st=s==='good'?'good':s==='bad'?'bad':'n';
  }
  return {v:v,base:base,kpi:kpi,st:st,i:i,k:k};
}
/* «в базе «всё HQ»» — база всегда названа, как в чипе шапки */
const inBase=c=>'в базе «'+c.bench+'»';
/* всплеск: месяц заметно выше обычного — иначе «пик» на графике шум */
function spikeAt(a,minAbs){
  const i=argmax(a);
  return i>=0&&a[i]>=Math.max(minAbs||3,median(a)*1.8)?i:-1;
}
/* акценты графика: месяц-заметка и текущий месяц полным тоном */
function annFor(i,t){
  const hi=[D.LAST];
  if(i>=0&&i!==D.LAST)hi.unshift(i);
  return {hi:hi,notes:i>=0?[{i:i,t:t}]:[]};
}

/* ---------- «Где сосредоточено» ----------
   Подразделения уровнем ниже выбранного узла. Счётная метрика — сумма за
   окно и доля от итога; относительная — значение и оценка к базе.
   act — точка приложения сил: доля подразделения в метрике заметно выше его
   доли в людях (на 8 п.п. и больше, и хотя бы три события). */
function kids(c){
  return D.rowsOf(c.sel).map(n=>({n:n,lp:leaves(c.S,n.path)})).filter(r=>r.lp.length);
}
function focusCount(c,k,o){
  const rs=kids(c);
  if(rs.length<2)return {};
  const val=lp=>o.win==='ytd'?ytd(lp,k):o.win==='last'?(D.lastVal(lp,k)||0):o.win==='win'?D.winSum(lp,k):s12(lp,k);
  const rows=rs.map(r=>({path:r.n.path,name:r.n.name,v:val(r.lp),hc:D.lastVal(r.lp,'hc_total')||0}));
  const tot=sum(rows.map(r=>r.v)), hc=sum(rows.map(r=>r.hc));
  if(!tot)return {};
  rows.sort((a,b)=>b.v-a.v);
  /* 23.10, Антон: полоса — доля от суммы по подразделениям (шкала 0–100%), не от максимума */
  const focus={cap:o.cap,rows:rows.slice(0,4).map(r=>({name:r.name,val:D.fmtInt(r.v),w:r.v/tot,path:r.path}))};
  const top=rows[0], sv=pc(top.v,tot), sh=pc(top.hc,hc);
  /* 26.10-б, правки: «46% общего оттока при 36% общей численности» — доля в итоге метрики против доли в численности */
  const act=top.v>=3&&sv-sh>=8?{text:'Начните с «'+top.name+'»: **'+sv+'%** '+o.what+' при **'+sh+'%** общей численности.',
    node:top.path,name:top.name}:null;
  return {focus:focus,act:act};
}
function focusRate(c,k,cap){
  const rs=kids(c);
  if(rs.length<2)return {};
  const i=jIdx(k), kpi=D.kpiAt(k,c.S,D.MONTHS[i].m), base=kpi?kpi.green:ser(c.bl,k)[i];
  const m=D.METRIC_BY_KEY[k];
  const rows=rs.map(r=>{
    const v=ser(r.lp,k)[i];
    const s=v==null||base==null?'neutral':kpi?D.stateForKpi(k,v,kpi):D.compareState(k,v,base);
    return {path:r.n.path,name:r.n.name,v:v,st:s==='good'?'good':s==='bad'?'bad':'n'};
  }).filter(r=>r.v!=null);
  if(rows.length<2)return {};
  /* хуже — выше: сортируем так, чтобы первой стояла строка, которую разбирать */
  const dir=m.better==='higher'?1:-1;
  rows.sort((a,b)=>dir*(a.v-b.v));
  const mx=Math.max.apply(null,rows.map(r=>r.v))||1, sm=rows.reduce((a,r)=>a+Math.max(0,r.v),0);
  const focus={cap:cap,rows:rows.slice(0,4).map(r=>({name:r.name,val:f(k,r.v),w:U.barW(k,r.v,m.fmt==='pct'?0:sm,mx)/100,st:r.st,path:r.path}))};
  const bad=rows.filter(r=>r.st==='bad');
  const act=bad.length===1?{text:(kpi?'Не дотягивает до цели только «':'Хуже базы только «')+bad[0].name+'»: **'+f(k,bad[0].v)+'** при '+
    (kpi?'цели ':'базе ')+f(k,base)+'.',node:bad[0].path,name:bad[0].name}:null;
  return {focus:focus,act:act};
}

/* ---------- главы по блокам ---------- */
const Q={
  /* 21.10, файл «Структура»: вкладки называются как в файле */
  structure:{portrait:'Портрет сотрудника',level:'Уровень позиции',work:'Оформление',stream:'Стримы',custom:'Конструктор'},
  movement:{balance:'Растём или сжимаемся?',dynamics:'Что двигало численность?'},
  turnover:{dynamics:'Сколько уходит?',reasons:'Почему уходят?',who:'Кто уходит?',hq:'Как уходит HQ?'},
  hiring:{vacancies:'Успеваем закрывать вакансии?',plan:'Выполняем план?',profile:'Кого и откуда берём?'},
  tgrowth:{flow:'Растут ли люди внутри?',grades:'Как растут по грейдам?',spec:'Как меняют специализацию?'},
  monitor:{activity:'Рабочая активность',review:'Как прошло ревью?'},
  office:{calendar:'Когда ходят?',attend:'Кто и где ходит?',booking:'Соблюдают бронь?'},
  ai:{adoption:'Пользуются ли AI?',tools:'Чем пользуются?',usage:'Как пользуются?'}
};

/* сравнение с базой одной фразой: «чаще / реже / на уровне» */
function vsBase(j,c,more,less,same){
  /* 30.10, критики: «Конверсия на уровне базы» при пустом значении — за месяц нет событий, так и пишем */
  if(j.v==null)return 'За '+mNom(j.i)+' нет данных — не с чем сравнить';
  return (j.st==='bad'||j.st==='good'
    ? ((j.v>j.base)?more:less)+', чем '+inBase(c)
    : same+' «'+c.bench+'»')+yoyTail(j,c,more,less);
}
/* 30.10, критики («две точки сравнения»): глава сравнивает с базой, вывод блока — с прошлым годом. Если год к году
   картина обратная, заголовок говорит обе вещи сразу: «Повышают чаще, чем в базе, но реже, чем год назад» */
const ADV=t=>t.split(' ').pop();
function yoyTail(j,c,more,less){
  const py=j.k?yearAgo(c.lp,j.k):null;
  if(py==null||j.v==null||!py||Math.abs(j.v-py)/Math.abs(py)<0.05)return '';
  const up=j.v>py, vsB=j.st==='bad'||j.st==='good'?j.v>j.base:null;
  const t=up?more:less;
  return vsB===up?'':', но '+(vsB==null?t.charAt(0).toLowerCase()+t.slice(1):ADV(t))+', чем год назад';
}

/* значение за месяц и база; пустое — «нет данных», а не «— при базе 37,5%» */
const valAt=(k,j)=>j.v==null?'нет данных':'**'+f(k,j.v)+'**'+(j.base!=null?' при базе '+f(k,j.base):'');
const CH={};

/* ===== Отток и текучесть ===== */
CH.turnover={
  dynamics(c){
    const a=ser(c.lp,'attrition'), n12=sum(a), y=ytd(c.lp,'attrition');
    if(!n12)return {sum:'уходов не было',st:'good',head:'За 12 месяцев никто не ушёл',
      lede:'Ни одного увольнения за '+D.PERIOD_LABEL+'.'};
    /* 15.10: «прогноз годовой текучести» снят (нет в каталоге HQ/УС) — темп
       ухода судим по накопительной текучести, как «Текучесть YoY KPI» */
    const fc=judge('turnover_y',c), tm=judge('turnover_m',c), ya=yearAgo(c.lp,'turnover_y');
    const pk=spikeAt(a,3);
    let head=(fc.st==='bad'?'Уходят чаще, чем '+inBase(c):fc.st==='good'?'Уходят реже, чем '+inBase(c)
      :'Темп ухода — на уровне базы «'+c.bench+'»')+yoyTail(fc,c,'Уходят чаще','Уходят реже');
    if(pk>=0)head+=(/, но /.test(head)?'; ':', но ')+mPrep(pk)+' был всплеск';
    const fo=focusCount(c,'attrition',{cap:'Где уходят · за год',what:'общего оттока'});
    /* 26.10, ревью критиков: ставки — по последнему закрытому месяцу (jIdx), уходы — людьми с января */
    return {sum:pl(y,EXITS)+' с января',st:fc.st,head:head,
      lede:'За 12 месяцев ушли **'+pl(n12,PPL)+'**, с января — **'+D.fmtInt(y)+'**. Текучесть с января по '+mNom(fc.i)+' — **'+
        f('turnover_y',fc.v)+'**'+(ya!=null?' (год назад '+f('turnover_y',ya)+')':'')+'.',
      facts:[pk>=0?'Пик — **'+mNom(pk)+'**: '+pl(a[pk],EXITS):null,
        'Текучесть за '+mNom(tm.i)+' — '+valAt('turnover_m',tm),
        ya!=null&&fc.v!=null?'Текучесть накопительная к прошлому году: **'+D.fmtDelta('turnover_y',+(fc.v-ya).toFixed(2))+'**':null],
      focus:fo.focus,act:fo.act,ann:{attrition:annFor(pk,'пик года')}};
  },
  reasons(c){
    const rs=D.exitReasons(c.lp,'ytd'), ini=D.exitInitiators(c.lp,'ytd');
    const tot=sum(rs.map(r=>r.value));
    if(!tot)return {sum:'уходов не было',st:'n',head:'С января никто не ушёл'};
    const top=rs.slice().sort((a,b)=>b.value-a.value)[0];
    const by=k=>(ini.find(x=>x.key===k)||{value:0}).value, org=by('org');
    const rg=judge('regret',c);
    /* 26.10, ревью критиков: нежелательные — за тот же период, что карточка (с января по последний закрытый месяц, счёт
       regret_cnt ÷ отток), и одним определением. Заголовок — главная причина с числом: «не из-за компании» спорил с
       тем, что «Лучшее предложение» и «Нет роста» — рычаги руководителя */
    const Le=D.NEXT-1-(D.LAST-rg.i), y0=D.YEAR_START_EXT[Le];
    const cum=k=>{const e=D.aggregateExt(c.lp,k);let t=0;for(let i=y0;i<=Le;i++)t+=e[i]||0;return Math.round(t)};
    const reg=cum('regret_cnt'), out=cum('attrition'), rp=pc(reg,out);
    return {sum:rp+'% — нежелательные',st:rg.st,
      head:rp>=50?rp+'% уходов — нежелательные: главная причина — «'+top.name+'»'
        :org*2>tot?'Большинство уходов — по инициативе работодателя: '+org+' из '+tot
        :'Главная причина ухода — «'+top.name+'»: '+top.value+' из '+tot,
      lede:'С января ушли **'+pl(tot,PPL)+'**: '+by('emp')+' — по своей инициативе, '+org+' — по инициативе работодателя. '+
        'С января по '+mNom(rg.i)+' нежелательных уходов (ушли сами, со стажем от года и сильной оценкой) — **'+reg+' из '+out+'**.',
      facts:rs.slice().sort((a,b)=>b.value-a.value).slice(0,3).map(r=>'«'+r.name+'» — **'+r.value+'**'+(r.regret?' ★':'')),
      act:top.regret&&top.value>=2?{text:'Разберите «'+top.name+'»: **'+top.value+' из '+tot+'** уходов с января.'}:null};
  },
  who(c){
    const ex=D.exitProfile(c.lp,'ytd'), tot=ex.total;
    if(!tot)return {sum:'уходов не было',st:'n',head:'С января никто не ушёл'};
    const early=sum(ex.tenure.filter(t=>t.early).map(t=>t.value)), ep=pc(early,tot);
    const g=ex.grade[argmax(ex.grade.map(x=>x.value))], s=ex.stream.slice().sort((a,b)=>b.value-a.value)[0];
    /* 26.10, ревью критиков: заголовок — по наибольшему перекосу «доля в уходах против доли в команде» (×1,2 и на 3
       человека больше ожидаемого); перекоса нет — как раньше, по стажу */
    let sk=null;
    [['tenure','группы стажа'],['grade','грейда'],['stream','стрима']].forEach(([d,w])=>{const ts=D.teamShare(c.lp,d);
      ex[d].forEach(x=>{const t=ts[x.name], e=t*tot;if(t!=null&&x.value>=1.2*e&&x.value-e>=3&&(!sk||x.value-e>sk.d))sk={d:x.value-e,x,t,w}})});
    return {sum:ep+'% — в первый год',st:ep>=40||sk?'bad':'n',
      head:sk?'Чаще своей доли уходят из '+sk.w+' «'+sk.x.name+'»: '+pc(sk.x.value,tot)+'% уходов при '+Math.round(sk.t*100)+'% команды'
        :ep>=30?ep+'% ушедших не проработали и года':'Уходят в основном опытные: '+(100-ep)+'% — со стажем больше года',
      lede:'С января ушли **'+pl(tot,PPL)+'**, из них **'+early+'** — со стажем до года. Больше всего уходов — в грейде «'+
        g.name+'» ('+g.value+') и в стриме «'+s.name+'» ('+s.value+').',
      facts:ex.tenure.map(t=>t.name+' — **'+t.value+'**'),
      act:ep>=40?{text:'Ранний уход — вопрос найма и адаптации: проверьте онбординг тех, кто пришёл за последний год.'}:null};
  },
  /* 26.10, правки: светофор HQ — по активной численности HQ, что бы ни стояло в фильтрах покраски и типа */
  hq(c){
    const h=D.hqLight(c.S);
    if(!h)return {sum:'нет данных',st:'n',head:'Светофору HQ нужны данные'};
    if(!h.hc)return {sum:'нет HQ',st:'n',head:'В подразделении нет HQ-сотрудников'};
    const t=h.rows[0], nr=h.rows[1], rg=h.rows[2], bad=h.rows.filter(r=>r.st==='bad');
    const nm={turnover_y:'текучесть HQ',nonregret:'желательная текучесть HQ',regret:'нежелательная текучесть HQ'};
    const tgt=r=>r.kpi?(r.kpi.red!==r.kpi.green?'коридор '+f(r.key,r.kpi.green)+'–'+f(r.key,r.kpi.red):'цель '+f(r.key,r.kpi.green)):'без цели';
    return {sum:'текучесть '+f('turnover_y',t.v),st:bad.length?'bad':h.rows.every(r=>r.st==='good')?'good':'n',
      head:bad.length?(bad.length===3?'Все три показателя HQ выше порога':U.esc(bad.map(r=>nm[r.key]).join(' и ').replace(/^./,x=>x.toUpperCase()))+
        ' — выше порога'):'HQ уходит в пределах порогов',
      /* 26.10-б: накопительно с января по последний закрытый месяц — незакрытый ещё вызревает */
      lede:'Активная численность HQ — **'+pl(h.hc,PPL)+'**. Накопительно с января по '+D.MONTH_NOM[h.month.m]+': текучесть **'+
        f('turnover_y',t.v)+'** ('+tgt(t)+'), желательная **'+f('nonregret',nr.v)+'** ('+tgt(nr)+'), нежелательная **'+
        f('regret',rg.v)+'** ('+tgt(rg)+').',
      facts:h.rows.map(r=>r.ya!=null?r.label.replace(/ накопительн\S+/,'')+' год назад к этому месяцу — **'+f(r.key,r.ya)+'**':null)};
  }
};

/* ===== Движение персонала =====
   Итерация 32: обзор (водопад + «что нужно знать» под ним) и одна глава
   динамики по месяцам; глава «Замещение и темпы» снята. */
CH.movement={
  balance(c){
    const hc=ser(c.lp,'hc_total'), begin=hc[0], end=hc[D.LAST], net=end-begin;
    const ws=k=>D.winSum(c.lp,k);
    const hire=ws('hire'), tin=ws('transfer_in'), attr=ws('attrition'), tout=ws('transfer_out');
    const other=net-(hire+tin-attr-tout);
    const mx=argmax(hc);
    /* с первого месяца окна (водопад начинается с его численности), а не «за год»; 26.10, ревью критиков: и «Где
       нанимают» — за то же окно (было 12 месяцев против 11 у водопада: «43 из 117») */
    const since=' '+D.WIN_SINCE;
    const fo=focusCount(c,'hire',{cap:'Где нанимают ·'+since,what:'общего найма',win:'win'});
    const fr=fo.focus?fo.focus.rows:[], top=fr[0], tie=fr[1]&&fr[1].val===top.val;
    /* с 1 января — то, что показывает карточка численности: прирост и что его дало */
    const j0=D.MONTHS.findIndex(m=>m.y===D.YEAR_CUR), yt=k=>ytd(c.lp,k);
    return {sum:signed(net)+since,st:'n',
      head:net>0?'Команда выросла на '+pl(net,PPL)+since:net<0?'Команда сократилась на '+pl(-net,PPL)+since
        :'Численность'+since+' не изменилась',
      lede:'Численность на конец '+D.WIN_FROM+' — **'+D.fmtInt(begin)+'**, '+D.WIN_TO+' — **'+D.fmtInt(end)+'**. Водопад показывает, что сдвинуло численность: '+
        'найм и переводы в команду поднимают её, отток и переводы из команды — опускают.',
      insights:[
        hire>=attr?'Найм покрывает отток: пришли **'+hire+'**, ушли **'+attr+'**'
          :'Найм не покрывает отток: пришли **'+hire+'**, ушли **'+attr+'**',
        tin!==tout?'Переводы: **+'+tin+'** в команду и **'+minus(-tout)+'** из неё — '+
          (tin<tout?'команда отдаёт людей другим подразделениям':'команда получает людей из других подразделений')
          :'Переводы уравновешены: по **'+tin+'** в обе стороны',
        other?'Прочие изменения — **'+signed(other)+'**: то, что не объясняют найм, отток и переводы (смена типа численности, реорганизации)':null,
        mx!==D.LAST&&mx!==0?'Максимум численности — **'+D.fmtInt(hc[mx])+'** '+mPrep(mx):null,
        top?(tie?'Больше всего нанимают «'+top.name+'» и «'+fr[1].name+'»: по **'+top.val+'**':'Больше всего нанимает «'+top.name+'»: **'+top.val+'**')+' из '+hire:null,
        j0>0?'С 1 января: **'+signed(end-hc[j0-1])+'** — найм '+yt('hire')+', отток '+yt('attrition')+', переводы +'+yt('transfer_in')+' / '+minus(-yt('transfer_out')):null],
      focus:fo.focus,act:fo.act};
  },
  dynamics(c){
    const hc=ser(c.lp,'hc_total'), ws=k=>D.winSum(c.lp,k), since=' '+D.WIN_SINCE;
    /* 26.10, ревью критиков: окно — то же, что у водопада на соседнем шаге (117, а не 126 за 12 месяцев) */
    const h=ws('hire'), a=ws('attrition'), ti=ws('transfer_in'), to=ws('transfer_out');
    const mx=argmax(hc);
    const fo=focusCount(c,'attrition',{cap:'Где уходят ·'+since,what:'общего оттока',win:'win'});
    /* пики — по месяцам этого года, как на оси графиков; равные месяцы перечислены */
    const pk=(k,w)=>{const y=D.yoySeries(c.lp,k).cur, mv=Math.max.apply(null,y.map(v=>v||0)), at=[];
      y.forEach((v,i)=>{if(mv&&v===mv)at.push(PREP[i])});return at.length?w+' в '+at.join(' и ')+': **'+mv+'**':null};
    return {sum:'+'+h+' / '+minus(-a),st:'n',
      head:h>a?'Найм перекрывает отток: пришли '+h+', ушли '+a+since:h<a?'Отток больше найма: пришли '+h+', ушли '+a+since
        :'Найм и отток'+since+' сравнялись: по '+h,
      lede:'С конца '+D.WIN_FROM+' приняли **'+pl(h,PPL)+'**, ушли **'+pl(a,PPL)+'**; переводами пришли '+ti+', ушли '+to+
        '. Сверху — итог, ниже — потоки, которые его двигали: видно, какой месяц что сдвинул.',
      facts:[pk('hire','Больше всего приняли'),pk('attrition','Больше всего ушли')],
      focus:fo.focus,act:fo.act,ann:{hc_total:annFor(mx!==D.LAST&&mx!==0?mx:-1,'максимум')}};
  }
};

/* ===== Найм и вакансии ===== */
CH.hiring={
  vacancies(c){
    const vo=ser(c.lp,'vac_open'), op=vo[D.LAST], cl=s12(c.lp,'vac_closed'), t=judge('time_to_fill',c);
    const pk=argmax(vo), note=pk>=0&&pk!==D.LAST&&vo[pk]>op?pk:-1;
    const fo=focusCount(c,'vac_open',{cap:'Где открыты вакансии',what:'всех открытых вакансий',win:'last'});
    return {sum:f('time_to_fill',t.v)+' на вакансию',st:t.st,
      head:vsBase(t,c,'Вакансии закрываются дольше','Вакансии закрываются быстрее','Скорость закрытия — на уровне базы'),
      lede:'Сейчас открыто **'+op+'**, за 12 месяцев закрыто **'+cl+'**. Срок закрытия за '+mNom(t.i)+' — '+valAt('time_to_fill',t)+'.',
      facts:[note>=0?'Больше всего открытых было '+mPrep(note)+': **'+vo[note]+'**':null],
      focus:fo.focus,act:fo.act,ann:{vac_open:annFor(note,'пик')}};
  },
  plan(c){
    const p=judge('hire_plan',c), pf=D.planFact(c.lp,c.S);
    const work=(pf.status.find(x=>x.key==='work')||{vals:[0]}).vals[0];
    const kp=p.kpi;
    return {sum:f('hire_plan',p.v)+' плана',st:p.st,
      head:p.v==null?'План найма на этот год не задан'
        :p.st==='bad'?'План найма отстаёт: '+f('hire_plan',p.v)+(kp?' при цели '+f('hire_plan',kp.green):'')
        :p.st==='good'?'План найма выполняется: '+f('hire_plan',p.v)
        :'План найма — '+f('hire_plan',p.v)+(kp?': между целью '+f('hire_plan',kp.green)+' и порогом '+f('hire_plan',kp.red):''),
      lede:'С начала года нанято **'+pf.fact[0]+'** из **'+pf.plan[0]+'** по плану. В работе '+work+
        ' '+U.plural(work,['вакансия','вакансии','вакансий'])+', просрочено **'+pf.overdue[0]+'**.',
      facts:pf.cols.slice(1).map((n,i)=>n+': **'+pf.fact[i+1]+' из '+pf.plan[i+1]+'**'),
      act:p.st==='bad'&&pf.overdue[0]?{text:'Начните с просроченных вакансий: **'+pf.overdue[0]+'** — они и тянут план вниз.'}:null,
      ann:{hire_plan:{hi:[D.LAST]}}};
  },
  profile(c){
    const hp=D.hiringProfile(c.lp,'ytd');
    if(!hp.total)return {sum:'найма не было',st:'n',head:'С января никого не наняли'};
    const ch=hp.channels.slice().sort((a,b)=>b.value-a.value), top=ch[0];
    return {sum:pl(hp.total,PPL)+' с января',st:'n',
      head:'«'+top.name+'» — главный канал найма: '+top.value+' из '+hp.total,
      lede:'С начала года наняли **'+pl(hp.total,PPL)+'** и ещё **'+hp.tin+'** перешли из других подразделений. Джунов среди '+
        'принятых — **'+hp.jun+'** ('+pc(hp.jun,hp.total)+'%).',
      facts:ch.slice(0,3).map(x=>'«'+x.name+'» — **'+x.value+'**')};
  }
};

/* ===== T-рост ===== */
CH.tgrowth={
  flow(c){
    const cv=judge('tgrowth_conv',c), ps=s12(c.lp,'tgrowth_pass'), dn=s12(c.lp,'tgrowth_deny');
    const fo=focusRate(c,'tgrowth_conv','Конверсия по подразделениям');
    return {sum:'конверсия '+f('tgrowth_conv',cv.v),st:cv.st,
      head:vsBase(cv,c,'Повышают чаще','Повышают реже','Конверсия T-роста — на уровне базы'),
      lede:'За 12 месяцев одобрено **'+ps+'** '+U.plural(ps,['заявка','заявки','заявок'])+', отклонено **'+dn+'**. Конверсия за '+
        mNom(cv.i)+' — '+valAt('tgrowth_conv',cv)+'.',
      focus:fo.focus,act:fo.act,ann:{tgrowth_conv:{hi:[cv.i]}}};
  },
  /* 27.10-в, п. 8: «Как растут по грейдам?» и «Как меняют специализацию?» — по описанию вкладки «Рост» дашборда HQ */
  grades(c){
    const p=D.rostProfile(c.lp), n=k=>(p.st.find(x=>x.key===k)||{n:0}).n;
    if(!p.hc)return {sum:'нет людей',st:'n'};
    return {sum:pl(n('done'),PPL)+' прошли рост',st:'n',
      head:'Рост за 12 месяцев — у '+pc(n('done'),p.hc)+'% людей',
      lede:'Прошли рост **'+n('done')+'**, сейчас в росте — **'+(n('first')+n('again'))+'**, заявка отклонена у **'+n('denied')+
        '**, без заявки — **'+n('none')+'**. Повышений грейда в «Росте» — **'+p.grade.rost+'**, в T@T — **'+p.grade.tat+'**.'};
  },
  spec(c){
    const p=D.rostProfile(c.lp), s=p.spec, t=s.rostT[0];
    return {sum:(s.rost+s.tat)+' смен специализации',st:'n',
      head:'Специализацию сменили по '+(s.rost+s.tat)+' '+U.plural(s.rost+s.tat,['заявке','заявкам','заявкам']),
      lede:'За 12 месяцев в «Росте» — **'+s.rost+'**, в T@T — **'+s.tat+'**.'+(t?' Чаще всего просятся в «'+t.name+'»: '+t.apps+' '+
        U.plural(t.apps,['заявка','заявки','заявок'])+', отказ — '+pc(t.no,t.apps)+'%.':'')};
  }
};

/* ===== Мониторинг работы ===== */
CH.monitor={
  /* «Рабочая активность» (21.10, файл Антона): последняя закрытая неделя против прошлой */
  activity(c){
    const md=D.monData(c.lp);
    if(!md)return {sum:'нет данных',st:'n'};
    const W=md.weeks||md.months, cur=W[W.length-1], prev=W[W.length-2]||cur;
    const pc1=v=>cur.hc?(Math.round(v/cur.hc*1000)/10).toFixed(1).replace('.',','):'0';
    const du=cur.under-prev.under, dv=cur.over-prev.over, sg=v=>(v>0?'+':v<0?'−':'')+Math.abs(v);
    const worse=du>0||dv>0, both=du>0&&dv>0;
    return {sum:'недор. '+cur.under+' · перераб. '+cur.over,st:both?'bad':worse?'n':'good',
      head:'Недоработка — '+cur.under+' чел ('+pc1(cur.under)+'%), переработка — '+cur.over+' чел ('+pc1(cur.over)+'%)',
      lede:md.monthly?cur.full+' к прошлому месяцу: недоработка **'+sg(du)+'**, переработка **'+sg(dv)+'**.'
        :'Неделя '+cur.full.replace('Неделя ','')+' к прошлой: недоработка **'+sg(du)+'**, переработка **'+sg(dv)+'**. '+
        'Дольше двух недель подряд в недоработке — **'+cur.u2p+'**, в переработке — **'+cur.o2p+'**.'};
  },
  review(c){
    const rv=D.reviewProfile(c.lp), by=k=>(rv.dyn.find(x=>x.key===k)||{value:0}).value;
    const up=by('up'), dn=by('down');
    return {sum:'улучшили '+up+', ухудшили '+dn,st:judge('review_up',c).st,
      head:up>dn?'Оценки растут: улучшили '+up+', ухудшили '+dn:up<dn?'Оценки снижаются: ухудшили '+dn+', улучшили '+up
        :'Улучшили и ухудшили оценку поровну',
      lede:'В цикле оценены **'+pl(rv.E,PPL)+'**: без изменений — '+by('same')+', первая оценка — '+by('first')+'.'};
  }
};

/* ===== Посещаемость офисов ===== */
CH.office={
  calendar(c){
    const wd=D.attByDow(c.lp).filter(d=>!d.weekend);
    if(!wd.length)return {sum:'нет данных',st:'n'};
    const b=wd[argmax(wd.map(d=>d.value))], w=wd[argmin(wd.map(d=>d.value))];
    return {sum:'пик '+DOW_IN[b.name],st:'n',
      head:'Чаще всего ходят '+DOW_IN[b.name]+', реже всего — '+DOW_IN[w.name],
      lede:'Разница — **'+Math.round(b.value-w.value)+' п.п.**: '+f('office_att',b.value)+' против '+f('office_att',w.value)+
        ' в среднем за '+D.DOW_MONTHS+' месяца.'};
  },
  /* 22.10: «Кто и где ходит» — динамика, сегмент, локация; выбор сегмента и города — в c.S */
  attend(c){
    const S=c.S||{}, x=D.officeCross(c.lp,S.offSeg,S.offCity);
    const lbl=[x.seg?x.seg.name:'',x.city?x.city.name:''].filter(Boolean).join(' · ');
    if(lbl)return {sum:lbl+' — '+f('office_att',x.att),st:'n',
      head:'Посещаемость: '+lbl+' — '+f('office_att',x.att),
      lede:'По всему отбору — **'+f('office_att',D.lastVal(c.lp,'office_att'))+'** за '+D.CMP.span+'. Снять выбор — Escape.'};
    const segs=x.segs.filter(s=>s.hc), cs=x.cities.filter(r=>r.hc);
    const v=judge('office_att',c), ya=yearAgo(c.lp,'office_att');
    const fo=focusRate(c,'office_att','Посещаемость по подразделениям');
    const sg=segs.length>1?segs.slice().sort((a,b)=>b.att-a.att):null, cb=cs.length>1?cs.slice().sort((a,b)=>b.att-a.att):null;
    return {sum:f('office_att',v.v),st:v.st,
      head:vsBase(v,c,'В офис ходят чаще','В офис ходят реже','Посещаемость — на уровне базы')+
        (v.base!=null?': '+f('office_att',v.v)+' против '+f('office_att',v.base):''),
      lede:[ya!=null?'Год назад — **'+f('office_att',ya)+'**':'',
        sg?'«'+sg[0].name+'» — **'+f('office_att',sg[0].att)+'**, «'+sg[sg.length-1].name+'» — **'+f('office_att',sg[sg.length-1].att)+'**':'',
        cb?'чаще всего ходят в «'+cb[0].name+'» (**'+f('office_att',cb[0].att)+'**)':''].filter(Boolean).join('; ')+'.',
      focus:fo.focus,act:fo.act,ann:{office_att:{hi:[D.LAST]}}};
  },
  booking(c){
    const v=judge('booking_viol',c), bk=D.bookingQuality(c.lp);
    return {sum:f('booking_viol',v.v)+' нарушений',st:v.st,
      head:vsBase(v,c,'Бронь нарушают чаще','Бронь нарушают реже','Нарушения брони — на уровне базы'),
      lede:'За '+bk.month+' — **'+D.fmtInt(bk.noshow)+'** человеко-дней брони без прихода и **'+D.fmtInt(bk.walkin)+
        '** приходов без брони.',
      ann:{booking_viol:{hi:[D.LAST]}}};
  }
};

/* ===== AI-инструменты ===== */
CH.ai={
  adoption(c){
    const p=judge('ai_penetration',c), s0=yearAgo(c.lp,'ai_penetration'), wau=D.lastVal(c.lp,'ai_wau');
    const fo=focusRate(c,'ai_penetration','Проникновение по подразделениям');
    return {sum:f('ai_penetration',p.v),st:p.st,
      head:vsBase(p,c,'AI пользуются больше','AI пользуются меньше','Проникновение AI — на уровне базы')+
        (p.base!=null?': '+f('ai_penetration',p.v)+' против '+f('ai_penetration',p.base):''),
      /* 26.10, ревью критиков: «за год» — к тому же месяцу год назад, как в карточке (было — к первому месяцу окна) */
      lede:s0!=null&&p.v!=null?'За год проникновение '+(p.v>=s0?'выросло':'снизилось')+' с **'+f('ai_penetration',s0)+
        '** до **'+f('ai_penetration',p.v)+'**; активных пользователей в неделю — **'+D.fmtInt(wau)+'**.':'',
      focus:fo.focus,act:fo.act,ann:{ai_penetration:{hi:[D.LAST]},ai_wau:{hi:[D.LAST]}}};
  },
  tools(c){
    const ai=D.aiProfile(c.lp);
    const ts=ai.tools.slice().sort((a,b)=>b.value-a.value), t=ts[0], w=ts[ts.length-1];
    if(!t)return {sum:'нет данных',st:'n'};
    return {sum:'лидер — «'+t.name+'»',st:'n',
      head:'«'+t.name+'» — самый популярный инструмент: '+f('ai_penetration',t.value)+' сотрудников',
      lede:'Реже всего пользуются «'+w.name+'» — **'+f('ai_penetration',w.value)+'**. Всего AI пользуются **'+
        f('ai_penetration',ai.pen)+'** сотрудников.'};
  }
};

/* ===== Структура численности ===== */
function mixTop(lp,dk){
  const dim=D.MIX_BY_KEY[dk], cats=D.mixCats(dk), parts=D.mixParts(lp,dk), tot=sum(parts);
  if(!tot)return null;
  const i=argmax(parts);
  return {dim:dim,name:cats[i].name,share:pc(parts[i],tot),n:parts[i],tot:tot};
}
CH.structure={};
D.MIX_GROUPS.forEach(g=>{
  CH.structure[g.key]=function(c){
    const tops=g.dims.map(dk=>mixTop(c.lp,dk)).filter(Boolean);
    if(!tops.length)return {sum:'нет людей',st:'n'};
    const t=tops[0];
    return {sum:'«'+t.name+'» — '+t.share+'%',st:'n',
      head:'«'+t.name+'» — самая большая группа: '+t.share+'% людей',
      lede:'Всего в команде **'+pl(t.tot,PPL)+'**. '+tops.slice(1).map(x=>x.dim.name+': больше всего — «'+x.name+'» (**'+x.share+'%**)').join('; ')+
        (tops.length>1?'.':'')};
  };
});
CH.structure.custom=function(){return {sum:'два измерения',st:'n'}};
/* «Уровень позиции» (21.10): сеньорность, грейд, стаж — самая большая группа каждого */
CH.structure.level=function(c){
  const sel=c.S.mixSel||[], parts=D.sliceParse(sel);
  const tops=['seniority','grade','tenure'].filter(k=>D.MIX_BY_KEY[k]&&!parts.some(p=>p.dim.key===k)).map(k=>{
    const v=D.mixParts(c.lp,k,sel), i=argmax(v);
    return {dim:D.MIX_BY_KEY[k],name:D.mixCats(k)[i].name,share:pc(v[i],sum(v)),tot:sum(v)};
  }).filter(t=>t.tot);
  if(!tops.length)return {sum:'нет людей',st:'n'};
  const t=tops[0];
  return {sum:'«'+t.name+'» — '+t.share+'%',st:'n',
    head:'Больше всего — «'+t.name+'»: '+t.share+'% команды',
    lede:tops.slice(1).map(x=>x.dim.name+': чаще всего — «'+x.name+'» (**'+x.share+'%**)').join('; ')+(tops.length>1?'.':'')};
};

/* «Портрет команды» (14.10): вся структура одним рассказом — типичный человек
   в команде, чем люди заняты, чем команда не похожа на компанию. Срез (клик по
   куску графика) режет и рассказ: «Senior» — портрет сеньоров. */
const ROLE={dev:'разработчик',qa:'тестировщик',ana:'аналитик',ops:'DevOps-инженер',ml:'инженер данных',
  des:'дизайнер',prod:'менеджер продукта',sup:'специалист поддержки',back:'специалист бэк-офиса',adm:'руководитель'};
const SEN={j:'Junior',m:'Middle',s:'Senior',l:'Lead'};
const AGE_OF={a0:'до 25 лет',a25:'25–30 лет',a30:'старше 30 лет'};
const TEN_OF={t0:'в компании меньше года',t1:'в компании 1–3 года',t3:'в компании больше 3 лет'};
/* разрезы, по которым команда сравнивается с базой (тот же список рисует профиль) */
/* 15.10: только разрезы главы «Кто в команде?» — оформление и место у своей главы */
const PROF=['seniority','grade','tenure','age','gender'];
function profDevs(c,inSel){
  const sel=c.S.mixSel||[], out=[];
  PROF.forEach(k=>{
    if(inSel(k))return;
    const t=D.mixParts(c.lp,k,sel), b=D.mixParts(c.bl,k,sel), st=sum(t), sb=sum(b);
    if(!st||!sb)return;
    D.mixCats(k).forEach((cat,i)=>out.push({dim:D.MIX_BY_KEY[k],cat:cat,t:t[i]/st*100,b:b[i]/sb*100,d:(t[i]/st-b[i]/sb)*100}));
  });
  return out.sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
}
const pp=v=>Math.round(v)+'%';
/* Пробник (схема 15.10): категории — значения из таблицы, их ключи не совпадают с
   ключами макета. Подписи — по ключу, если он известен, иначе по имени категории. */
const senOf=c=>SEN[c.key]||c.name;
const roleOf=c=>ROLE[c.key]||'сотрудник стрима «'+c.name+'»';
const ageOf=c=>AGE_OF[c.key]||c.name.toLowerCase();
const tenOf=c=>TEN_OF[c.key]||'в компании: '+c.name.toLowerCase();
const SENIOR_UP=/senior|lead|head|chief|сеньор|лид|ведущ|руковод|expert|эксперт|principal/i;
CH.structure.portrait=function(c){
  const sel=c.S.mixSel||[], P=k=>D.mixParts(c.lp,k,sel), B=k=>D.mixParts(c.bl,k,sel);
  /* Разрез, по которому взят срез, своей таблицей срез не режет (правило
     перекрёстной фильтрации) — поэтому в рассказе он не «самый частый», а
     просто тот, что выбран, и доли по нему не называются: в срезе они 100%. */
  const parts=D.sliceParse(sel), inSel=k=>parts.find(p=>p.dim.key===k||(k==='stream'&&p.dim.key==='spec'));
  const mode=k=>{const q=inSel(k);if(q)return {cat:q.cat,fixed:true};
    const p=P(k), i=argmax(p);return {cat:D.mixCats(k)[i],n:p[i],share:pc(p[i],sum(p))}};
  const tk=['gender','age','tenure','seniority','grade'].find(k=>!inSel(k));
  const tot=tk?sum(P(tk)):0;
  if(!tot)return {sum:'нет людей',st:'n'};
  const sn=mode('seniority'), ag=mode('age'), tn=mode('tenure');
  const tree=D.mixTree(c.lp,'stream',sel).slice().sort((a,b)=>b.value-a.value);
  const stQ=inSel('stream'), top=stQ&&stQ.dim.key==='stream'?tree.find(n=>n.cat.id===stQ.cat.id)||tree[0]:tree[0];
  /* «меньше года» — все группы стажа до года: в настоящих данных их три (менее 3 мес,
     3–6 мес, 6–12 мес, 19.10), а не одна первая */
  const early=D.mixCats('tenure').map(c=>D.bound(c.name,'mon')<12), e=a=>sum(a.filter((_,i)=>early[i]));
  const ten=P('tenure'), tenB=B('tenure'), n0=pc(e(ten),sum(ten)), b0=pc(e(tenB),sum(tenB));
  const devs=profDevs(c,inSel), big=devs[0]&&Math.abs(devs[0].d)>=5?devs[0]:null;
  const cmp=x=>'«'+x.cat.name+'» — **'+pp(x.t)+'** против '+pp(x.b)+' в базе';
  const role=stQ&&stQ.dim.key==='spec'?'«'+stQ.cat.name+'»':roleOf(top.cat);
  const who=SEN[sn.cat.key]&&ROLE[top.cat.key]?SEN[sn.cat.key]+'-'+role+' '+ageOf(ag.cat)+', '+tenOf(tn.cat)
    :senOf(sn.cat)+', '+role+', '+ageOf(ag.cat)+', '+tenOf(tn.cat);
  const lede=[stQ?null:'**'+pc(top.value,tot)+'%** — «'+top.cat.name+'»',
    sn.fixed?null:'**'+sn.share+'%** — '+senOf(sn.cat),
    tn.fixed?null:'**'+n0+'%** — меньше года в компании'].filter(Boolean);
  return {sum:pl(tot,PPL)+' · '+senOf(sn.cat),st:'n',
    head:parts.length?'В срезе «'+D.sliceLabel(sel)+'» типичный человек — '+who:'Типичный человек в команде — '+who,
    lede:'**'+pl(tot,PPL)+'**'+(parts.length?' в срезе':'')+(lede.length?': '+lede.join(', '):'')+'. '+
      (big?'Сильнее всего от базы «'+c.bench+'» отличается '+big.dim.short.toLowerCase()+': '+cmp(big)+'.'
          :'По составу команда похожа на базу «'+c.bench+'»: нигде расхождение не доходит до 5 п.п.')};
};

/* «Оформление» (21.10, файл «Структура»): штат и самый частый формат работы */
CH.structure.work=function(c){
  const sel=c.S.mixSel||[], P=k=>D.mixParts(c.lp,k,sel), B=k=>D.mixParts(c.bl,k,sel);
  const parts=D.sliceParse(sel), inSel=k=>parts.find(p=>p.dim.key===k);
  const sh=(k,i)=>{const p=P(k),b=B(k);return {t:pc(p[i],sum(p)),b:pc(b[i],sum(b)),n:sum(p)}};
  const st=sh('employment',0);
  if(!st.n)return {sum:'нет людей',st:'n'};
  const fm=D.MIX_BY_KEY.worksite&&!inSel('worksite')?(()=>{const p=P('worksite'), i=argmax(p);return D.mixCats('worksite')[i]})():null;
  return {sum:'штат '+st.t+'%',st:'n',
    head:'В штате '+st.t+'% команды'+(fm?', чаще всего — '+fm.name.toLowerCase():''),
    lede:'**'+pl(st.n,PPL)+'**'+(parts.length?' в срезе':'')+'. Штат — **'+st.t+'%**'+(Math.abs(st.t-st.b)>=5?' при '+st.b+'% в базе «'+c.bench+'»':', как в базе «'+c.bench+'»')+'.'};
};

/* ---------- Зачем смотреть и что с этим делать (итерация 32, фидбэк 12.10) ----------
   «Когда я смотрю: а что мне с этим делать? Что мне это даёт? Зачем я смотрю
   на этот график?» — у каждой главы две фразы обычным текстом под выводом.
   Термины размечены {{Термин|форма в тексте}}: подчёркнуты пунктиром, при
   наведении — определение из словаря GL. Определения метрик и разрезов берутся
   из data.js (hint / tip) — те же, что в справке и в «i» у карточек, чтобы
   одно и то же слово не объяснялось в отчёте двумя способами. */
const GL={
  'Грейд':{dim:'grade'},
  'Сеньорность':{dim:'seniority'},
  'Стрим':{text:'Профессиональное направление: разработка, тестирование, аналитика. Внутри стрима — специализации.'},
  'Водопад':{text:'График-лестница: от численности на конец первого месяца окна прибавляем пришедших, вычитаем ушедших — и получаем численность сейчас.'},
  'Текучесть':{metric:'turnover_m',add:'\nУчитывает размер команды, поэтому её можно сравнивать с другими командами и с базой.'},
  'Среднесписочная численность':{text:'Полусумма активной численности на конец прошлого и этого месяца — упрощённый способ из методологии HR. Знаменатель текучести.'},
  'Активная численность':{metric:'hc_active'},
  'База':{text:'Та же метрика по всей компании с теми же фильтрами, что в шапке.\nПереход в подразделение базу не меняет.'},
  'Нежелательный уход':{text:'Уход, о котором компания сожалеет. По методологии HR: сотрудник ушёл сам, не из-за релокации, со стажем от 12 месяцев; MLTIIP, грейд 15+ с оценкой от 2 или оценка от 3. В причинах отмечен ★.\nИз таких уходов считается нежелательная текучесть.'},
  'Нежелательная текучесть HQ':{metric:'regret'},
  'Желательная текучесть HQ':{metric:'nonregret'},
  'Срок закрытия вакансии':{metric:'time_to_fill'},
  'Выполнение плана найма':{metric:'hire_plan'},
  'T-рост':{text:'Карьерный рост внутри компании: сотрудник подаёт заявку на повышение грейда или смену специализации, её одобряют или отклоняют.'},
  'Конверсия T-роста':{metric:'tgrowth_conv'},
  'T@T':{text:'Поток заявок T-роста рядом с «Ростом»: у заявки указан уровень T@T.'},
  'Недоработчики':{metric:'underwork'},
  'Переработчики':{metric:'overwork'},
  'Ревью':{text:'Оценка результатов работы, раз в полгода. Между ревью значения не меняются.'},
  'Нарушения бронирования':{metric:'booking_viol'},
  'Посещаемость офиса':{metric:'office_att'},
  'Проникновение AI':{metric:'ai_penetration'},
  'WAU':{metric:'ai_wau'}
};
function glossary(term){
  const g=GL[term];
  if(!g)return null;
  const dm=g.dim?(D.MIX_BY_KEY[g.dim]||{}):null;
  const gm=g.metric?(D.METRIC_BY_KEY[g.metric]||{}):null;
  const base=gm?(gm.hint||'')+(gm.calc?'\n'+gm.calc:''):dm?(dm.hint||dm.tip||''):g.text;
  if(!base)return null;
  return String(base||'')+(g.add||'');
}
const WHY={
  structure:{
    portrait:['Кто в команде: пол, возраст и регион.',
      'Кликните на кусок полосы или карточку — например, «Женщины»: все разрезы, карточки и таблица подразделений пересчитаются по этому срезу.'],
    level:['На каком уровне люди: {{Сеньорность|сеньорность}}, {{Грейд|грейд}} и стаж в компании.',
      'Клик по строке сеньорности или грейда, куску полосы стажа или карточке — срез; Shift+клик — добавить ещё одну категорию того же разреза.'],
    /* формата работы нет в данных пробника (схема 15.10) — тогда и про гибрид молчим */
    work:['В какой компании оформлены люди, на каком типе занятости и в каком формате работают.',
      'Много не штата — проверьте, не держатся ли на нём ключевые роли.'],
    stream:['Из каких {{Стрим|стримов}} состоит команда и где её основная экспертиза.',
      'Стрим из одного-двух человек — точка отказа: с их уходом уйдёт и экспертиза.'],
    custom:['Любые два измерения в одной таблице — например, {{Сеньорность|сеньорность}} × пол или грейд × стаж.',
      'Клик по клетке — срез сразу по двум измерениям. Escape — снять все срезы.']},
  movement:{
    balance:['{{Водопад}} раскладывает изменение численности на найм, отток и переводы: видно, что сдвинуло команду.',
      'Если команда уменьшилась за счёт оттока, а не по плану, — откройте «Отток и текучесть».'],
    dynamics:['По месяцам видно, какой поток и когда двигал численность.',
      'Месяц, где отток выше найма, — сверьте с причинами ухода в «Отток и текучесть».']},
  turnover:{
    dynamics:['{{Текучесть}} — темп ухода с поправкой на размер команды. Её и сравнивают с {{База|базой}}.',
      'Всплеск в одном месяце — найдите подразделение в таблице слева. Текучесть выше, чем год назад, — повод поговорить с руководителями.'],
    reasons:['Причины показывают, на что можно повлиять: у каждой — сколько уходов {{Нежелательный уход|нежелательные}}.',
      'Начните с причины, где больше всего нежелательных уходов: оплата, рост или руководитель.'],
    who:['Стаж, {{Грейд|грейд}} и стрим ушедших показывают, кого именно теряем.',
      'Много уходов в первый год — вопрос найма и адаптации. Уходят опытные — вопрос роста и вознаграждения.'],
    /* 26.10, правки: светофор HQ */
    hq:['Светофор HQ: {{Текучесть|текучесть}}, {{Желательная текучесть HQ|желательная}} и {{Нежелательная текучесть HQ|нежелательная}} '+
      'с начала года против порогов отчёта HQ — всегда по активной численности HQ.',
      'Красная нежелательная — разберите причины с нежелательными уходами в «Почему уходят?». Желательная выше коридора — проверьте, не теряете ли нужных людей.']},
  hiring:{
    vacancies:['Открытые вакансии — это недостающие люди, а {{Срок закрытия вакансии|срок закрытия}} — сколько команда работает не в полном составе.',
      'Вакансии копятся месяцами — пересмотрите требования и каналы подбора.'],
    plan:['{{Выполнение плана найма|Выполнение плана}} показывает, успевает ли подбор за потребностью бизнеса.',
      'Отставание — начните с просроченных вакансий: они и тянут план вниз.'],
    profile:['Откуда приходят люди и какого они {{Грейд|грейда}} — это стоимость и скорость найма.',
      'Сильный канал масштабируйте. Много джунов в найме — заложите наставников.']},
  tgrowth:{
    flow:['{{T-рост}} — карьерный рост внутри компании. {{Конверсия T-роста|Конверсия}} показывает, насколько этот путь работает.',
      'Низкая конверсия — люди пробуют расти и упираются, а это предвестник ухода.'],
    grades:['Кто за год прошёл рост, кто сейчас в процессе, у кого заявок нет — по текущему грейду; повышения — по потокам «Рост» и T@T.',
      'Высокий % отказа на грейде — разберите заявки с руководителями. Много людей без заявок за год — обсудите планы роста.'],
    spec:['Смена специализации — рост вбок: сколько заявок закрыто успешно и куда люди хотят перейти.',
      'Высокий % отказа по специализации — проверьте требования к переходу и поддержку при смене роли.']},
  monitor:{
    activity:['{{Недоработчики|Недоработка}} и {{Переработчики|переработка}} по неделям — ранний сигнал проблем с нагрузкой. Считается под выбранными фильтрами: по умолчанию — вся активная численность.',
      'Клик по строке таблицы — KPI и графики по этой команде; клик по столбику — отметить неделю на линиях. Escape — снять выбор.'],
    review:['Итоги последнего {{Ревью|ревью}}: у кого оценка выросла, у кого упала.',
      'Ухудшивших больше, чем улучшивших, — проверьте нагрузку и цели в этих группах.']},
  office:{
    calendar:['В какие дни офис заполнен, а в какие пустует. От этого зависят командные дни и аренда.',
      'Пустые дни — кандидаты на общий «офисный день» команды.'],
    attend:['{{Посещаемость офиса|Посещаемость}} по месяцам, ниже — руководители и сотрудники, ниже — города, где бывают '+
      'в офисе. Клик по сегменту — динамика по нему.',
      'Руководители ходят реже сотрудников — сверьте с правилами гибрида и бронированием.'],
    booking:['{{Нарушения бронирования|Нарушения брони}} — место забронировали и не пришли или пришли без брони.',
      'Нарушений много — места простаивают, а план офиса расходится с жизнью.']},
  ai:{
    adoption:['{{Проникновение AI|Проникновение}} — какая доля людей пользуется AI каждую неделю, {{WAU}} — сколько это человек.',
      'Отстающие подразделения — кандидаты на обучение и пилоты.'],
    tools:['Какими AI-инструментами пользуются и насколько широко.',
      'Инструмент, которым почти не пользуются, — спросите команду, чего в нём не хватает.'],
    usage:['Как часто и для каких задач пользуются AI: по неделям, по дням в неделю, по сегментам и у стажёров.',
      'Пользуются редко — покажите команде задачи, где AI экономит время; стажёры отстают — добавьте AI в онбординг.']}
};

/* ---------- сборка книги блока ----------
   c: {S, lp, bl, sel, bench}; subTabs — список глав блока; demo(sub) — правда,
   если глава в пробнике демо. Возвращает шаги степпера, текущую главу и
   следующую. Ошибка в одной главе не роняет экран: глава остаётся без вывода. */
function book(bk,subTabs,cur,c,demo){
  const defs=CH[bk]||{}, q=Q[bk]||{};
  const chapters=subTabs.map(([key,name])=>{
    let s={};
    if(!(demo&&demo(key))&&defs[key]){try{s=defs[key](c)||{}}catch(e){s={}}}
    const w0=(WHY[bk]||{})[key], w=typeof w0==='function'?w0():w0;
    return Object.assign({key:key,name:name,q:q[key]||name,st:'n',why:w?w[0]:null,todo:w?w[1]:null},s);
  });
  const i=Math.max(0,chapters.findIndex(x=>x.key===cur));
  return {chapters:chapters,cur:chapters[i],idx:i,next:chapters[i+1]||null};
}

window.TPSTORY={book,Q,CH,judge,GL,WHY,glossary};
})();

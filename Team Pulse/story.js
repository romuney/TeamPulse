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
function yearAgo(lp,k){return D.aggregateExt(lp,k)[D.NEXT-13]}
/* оценка метрики так же, как в карточке: цель KPI, иначе база, иначе без оценки */
function judge(k,c){
  const v=D.lastVal(c.lp,k), kpi=D.kpiFor(k,c.S);
  const base=kpi?kpi.green:(D.comparable(k)?D.lastVal(c.bl,k):null);
  let st='n';
  if(v!=null&&base!=null){
    const s=kpi?D.stateForKpi(k,v,kpi):D.compareState(k,v,base);
    st=s==='good'?'good':s==='bad'?'bad':'n';
  }
  return {v:v,base:base,kpi:kpi,st:st};
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
  const val=lp=>o.win==='ytd'?ytd(lp,k):o.win==='last'?(D.lastVal(lp,k)||0):s12(lp,k);
  const rows=rs.map(r=>({path:r.n.path,name:r.n.name,v:val(r.lp),hc:D.lastVal(r.lp,'hc_total')||0}));
  const tot=sum(rows.map(r=>r.v)), hc=sum(rows.map(r=>r.hc));
  if(!tot)return {};
  rows.sort((a,b)=>b.v-a.v);
  const mx=rows[0].v||1;
  const focus={cap:o.cap,rows:rows.slice(0,4).map(r=>({name:r.name,val:D.fmtInt(r.v),w:r.v/mx,path:r.path}))};
  const top=rows[0], sv=pc(top.v,tot), sh=pc(top.hc,hc);
  const act=top.v>=3&&sv-sh>=8?{text:'Начните с «'+top.name+'»: **'+sv+'%** '+o.what+' при **'+sh+'%** людей.',
    node:top.path,name:top.name}:null;
  return {focus:focus,act:act};
}
function focusRate(c,k,cap){
  const rs=kids(c);
  if(rs.length<2)return {};
  const kpi=D.kpiFor(k,c.S), base=kpi?kpi.green:D.lastVal(c.bl,k);
  const m=D.METRIC_BY_KEY[k];
  const rows=rs.map(r=>{
    const v=D.lastVal(r.lp,k);
    const s=v==null||base==null?'neutral':kpi?D.stateForKpi(k,v,kpi):D.compareState(k,v,base);
    return {path:r.n.path,name:r.n.name,v:v,st:s==='good'?'good':s==='bad'?'bad':'n'};
  }).filter(r=>r.v!=null);
  if(rows.length<2)return {};
  /* хуже — выше: сортируем так, чтобы первой стояла строка, которую разбирать */
  const dir=m.better==='higher'?1:-1;
  rows.sort((a,b)=>dir*(a.v-b.v));
  const mx=Math.max.apply(null,rows.map(r=>r.v))||1;
  const focus={cap:cap,rows:rows.slice(0,4).map(r=>({name:r.name,val:f(k,r.v),w:r.v/mx,st:r.st,path:r.path}))};
  const bad=rows.filter(r=>r.st==='bad');
  const act=bad.length===1?{text:'Хуже базы только «'+bad[0].name+'»: **'+f(k,bad[0].v)+'** при '+
    (kpi?'цели ':'базе ')+f(k,base)+'.',node:bad[0].path,name:bad[0].name}:null;
  return {focus:focus,act:act};
}

/* ---------- главы по блокам ---------- */
const Q={
  structure:{qual:'Какой квалификации?',people:'Кто эти люди?',contract:'Как оформлены?',
    geo:'Где работают?',stream:'В каких стримах?',custom:'Свой срез'},
  movement:{balance:'Растём или сжимаемся?',dynamics:'Кто пришёл и кто ушёл?',rates:'Восполняем ли уходы?'},
  turnover:{dynamics:'Сколько уходит?',reasons:'Почему уходят?',who:'Кто уходит?'},
  hiring:{vacancies:'Успеваем закрывать вакансии?',plan:'Выполняем план?',profile:'Кого и откуда берём?',
    funnel:'Где теряем кандидатов?'},
  tgrowth:{flow:'Растут ли люди внутри?',requests:'Как быстро растут?',statuses:'Кто сейчас в росте?'},
  monitor:{both:'Есть ли проседание?',review:'Как прошло ревью?'},
  office:{calendar:'Когда ходят?',offices:'Какие офисы заполнены?',people:'Кто ходит?',
    booking:'Соблюдают бронь?',dynamics:'Ходят больше или меньше?'},
  ai:{adoption:'Пользуются ли AI?',tools:'Чем и где пользуются?'}
};

/* сравнение с базой одной фразой: «чаще / реже / на уровне» */
function vsBase(j,c,more,less,same){
  return j.st==='bad'||j.st==='good'
    ? ((j.v>j.base)?more:less)+', чем '+inBase(c)
    : same+' «'+c.bench+'»';
}

const CH={};

/* ===== Отток и текучесть ===== */
CH.turnover={
  dynamics(c){
    const a=ser(c.lp,'attrition'), n12=sum(a), y=ytd(c.lp,'attrition');
    if(!n12)return {sum:'уходов не было',st:'good',head:'За 12 месяцев никто не ушёл',
      lede:'Ни одного увольнения в окне '+D.PERIOD_LABEL+'.'};
    const fc=judge('turnover_fc',c), tm=judge('turnover_m',c), ya=yearAgo(c.lp,'turnover_fc');
    const pk=spikeAt(a,3);
    let head=fc.st==='bad'?'Уходят чаще, чем '+inBase(c):fc.st==='good'?'Уходят реже, чем '+inBase(c)
      :'Темп ухода — на уровне базы «'+c.bench+'»';
    if(pk>=0)head+=', но '+mPrep(pk)+' был всплеск';
    const fo=focusCount(c,'attrition',{cap:'Где уходят · 12 мес',what:'уходов'});
    return {sum:pl(n12,EXITS)+' за год',st:fc.st,head:head,
      lede:'За 12 месяцев ушли **'+pl(n12,PPL)+'**, с января — **'+D.fmtInt(y)+'**. Прогноз текучести на год — **'+
        f('turnover_fc',fc.v)+'**'+(ya!=null?' (год назад '+f('turnover_fc',ya)+')':'')+'.',
      facts:[pk>=0?'Пик — **'+mNom(pk)+'**: '+pl(a[pk],EXITS):null,
        'Текучесть за '+mNom(D.LAST)+' — **'+f('turnover_m',tm.v)+'**'+(tm.base!=null?' при базе '+f('turnover_m',tm.base):''),
        ya!=null&&fc.v!=null?'Прогноз к прошлому году: **'+D.fmtDelta('turnover_fc',+(fc.v-ya).toFixed(2))+'**':null],
      focus:fo.focus,act:fo.act,ann:{attrition:annFor(pk,'пик года')}};
  },
  reasons(c){
    const rs=D.exitReasons(c.lp,'ytd'), ini=D.exitInitiators(c.lp,'ytd');
    const tot=sum(rs.map(r=>r.value));
    if(!tot)return {sum:'уходов не было',st:'n',head:'С января никто не ушёл'};
    const top=rs.slice().sort((a,b)=>b.value-a.value)[0];
    const reg=sum(rs.filter(r=>r.regret).map(r=>r.value)), rp=pc(reg,tot);
    const by=k=>(ini.find(x=>x.key===k)||{value:0}).value;
    const rg=judge('regret',c);
    return {sum:rp+'% — нежелательные',st:rg.st,
      head:(rp>=50?rp+'% уходов — нежелательные':'Большинство уходов — не из-за компании')+
        ': главная причина — «'+top.name+'»',
      lede:'С января ушли **'+pl(tot,PPL)+'**: '+by('emp')+' — по своей инициативе, '+by('org')+
        ' — по инициативе компании. Нежелательные (★) — уходы, на которые компания могла повлиять: **'+reg+'**.',
      facts:rs.slice().sort((a,b)=>b.value-a.value).slice(0,3).map(r=>'«'+r.name+'» — **'+r.value+'**'+(r.regret?' ★':'')),
      act:top.regret&&top.value>=2?{text:'Разберите «'+top.name+'»: **'+top.value+' из '+tot+'** уходов с января.'}:null};
  },
  who(c){
    const ex=D.exitProfile(c.lp,'ytd'), tot=ex.total;
    if(!tot)return {sum:'уходов не было',st:'n',head:'С января никто не ушёл'};
    const early=sum(ex.tenure.filter(t=>t.early).map(t=>t.value)), ep=pc(early,tot);
    const g=ex.grade[argmax(ex.grade.map(x=>x.value))], s=ex.stream.slice().sort((a,b)=>b.value-a.value)[0];
    return {sum:ep+'% — в первый год',st:ep>=40?'bad':'n',
      head:ep>=30?ep+'% ушедших не проработали и года':'Уходят в основном опытные: '+(100-ep)+'% — со стажем больше года',
      lede:'С января ушли **'+pl(tot,PPL)+'**, из них **'+early+'** — со стажем до года. Больше всего уходов — в «'+
        g.name+'» ('+g.value+') и в стриме «'+s.name+'» ('+s.value+').',
      facts:ex.tenure.map(t=>t.name+' — **'+t.value+'**'),
      act:ep>=40?{text:'Ранний уход — вопрос найма и адаптации: проверьте онбординг тех, кто пришёл за последний год.'}:null};
  }
};

/* ===== Движение персонала ===== */
CH.movement={
  balance(c){
    const hc=ser(c.lp,'hc_total'), begin=hc[0], end=hc[D.LAST], net=end-begin;
    const hire=s12(c.lp,'hire'), tin=s12(c.lp,'transfer_in'), attr=s12(c.lp,'attrition'), tout=s12(c.lp,'transfer_out');
    const mx=argmax(hc);
    const fo=focusCount(c,'hire',{cap:'Где нанимают · 12 мес',what:'найма'});
    return {sum:signed(net)+' за год',st:'n',
      head:net>0?'Команда выросла на '+pl(net,PPL)+' за год':net<0?'Команда сократилась на '+pl(-net,PPL)+' за год'
        :'Численность за год не изменилась',
      lede:'Было **'+D.fmtInt(begin)+'**, стало **'+D.fmtInt(end)+'**. Пришли '+hire+' по найму и '+tin+
        ' переводом, ушли '+attr+' и '+tout+' переводом.',
      facts:[mx!==D.LAST&&mx!==0?'Максимум — **'+D.fmtInt(hc[mx])+'** '+mPrep(mx):null,
        'Найм против оттока: **'+hire+'** и **'+attr+'**',
        'Переводы: **+'+tin+'** в команду, **'+minus(-tout)+'** из неё'],
      focus:fo.focus,ann:{hc_total:annFor(mx!==D.LAST&&mx!==0?mx:-1,'максимум')}};
  },
  dynamics(c){
    const hs=ser(c.lp,'hire'), as=ser(c.lp,'attrition');
    const h=sum(hs), a=sum(as), ti=s12(c.lp,'transfer_in'), to=s12(c.lp,'transfer_out');
    const ph=argmax(hs), pa=argmax(as);
    const fo=focusCount(c,'attrition',{cap:'Где уходят · 12 мес',what:'уходов'});
    return {sum:'+'+h+' / '+minus(-a),st:'n',
      head:h>a?'Нанимаем больше, чем теряем: +'+(h-a)+' за год':h<a?'Теряем больше, чем нанимаем: '+minus(h-a)+' за год'
        :'Найм и отток за год сравнялись',
      lede:'За 12 месяцев приняли **'+pl(h,PPL)+'**, ушли **'+pl(a,PPL)+'**. Переводами пришли '+ti+', ушли '+to+'.',
      facts:[ph>=0&&hs[ph]?'Больше всего приняли '+mPrep(ph)+': **'+hs[ph]+'**':null,
        pa>=0&&as[pa]?'Больше всего ушли '+mPrep(pa)+': **'+as[pa]+'**':null],
      focus:fo.focus,act:fo.act};
  },
  rates(c){
    const rr=judge('replace_ratio',c), hr=D.lastVal(c.lp,'hire_rate'), tm=D.lastVal(c.lp,'turnover_m');
    const v=rr.v;
    return {sum:v==null?'уходов не было':'замещение '+f('replace_ratio',v),st:'n',
      head:v==null?'Уходов с начала года не было — восполнять нечего'
        :v>=1.05?'Уходы восполняются с запасом: '+f('replace_ratio',v)+' нового на одного ушедшего'
        :v>=0.95?'Уходы восполняются один к одному'
        :'Уходы не восполняются: '+f('replace_ratio',v)+' нового на одного ушедшего',
      lede:'Коэффициент — найм к оттоку с начала года'+(rr.base!=null?', база — '+f('replace_ratio',rr.base):'')+
        '. За '+mNom(D.LAST)+' на 100 человек — **'+f('hire_rate',hr)+'** найма и **'+f('turnover_m',tm)+'** оттока.',
      ann:{replace_ratio:{hi:[D.LAST]}}};
  }
};

/* ===== Найм и вакансии ===== */
CH.hiring={
  vacancies(c){
    const vo=ser(c.lp,'vac_open'), op=vo[D.LAST], cl=s12(c.lp,'vac_closed'), t=judge('time_to_fill',c);
    const pk=argmax(vo), note=pk>=0&&pk!==D.LAST&&vo[pk]>op?pk:-1;
    const fo=focusCount(c,'vac_open',{cap:'Где открыты вакансии',what:'открытых вакансий',win:'last'});
    return {sum:f('time_to_fill',t.v)+' на вакансию',st:t.st,
      head:vsBase(t,c,'Вакансии закрываются дольше','Вакансии закрываются быстрее','Скорость закрытия — на уровне базы'),
      lede:'Сейчас открыто **'+op+'**, за 12 месяцев закрыто **'+cl+'**. Срок закрытия — **'+f('time_to_fill',t.v)+'**'+
        (t.base!=null?' при базе '+f('time_to_fill',t.base):'')+'.',
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
      lede:'С начала года наняли **'+pl(hp.total,PPL)+'** и ещё **'+hp.tin+'** перешли из других команд. Джунов среди '+
        'принятых — **'+hp.jun+'** ('+pc(hp.jun,hp.total)+'%).',
      facts:ch.slice(0,3).map(x=>'«'+x.name+'» — **'+x.value+'**')};
  },
  funnel(c){
    const open=s12(c.lp,'vac_open'), closed=s12(c.lp,'vac_closed');
    return {sum:'этапы — допущение',st:'n',
      head:'Воронка пока на допущениях — выводов по этапам не делаем',
      lede:'За 12 месяцев открыто **'+open+'** '+U.plural(open,['вакансия','вакансии','вакансий'])+', закрыто **'+closed+
        '**. Этапы после открытия — коэффициенты макета: реального источника под ними пока нет.'};
  }
};

/* ===== T-рост ===== */
CH.tgrowth={
  flow(c){
    const cv=judge('tgrowth_conv',c), ps=s12(c.lp,'tgrowth_pass'), dn=s12(c.lp,'tgrowth_deny');
    const fo=focusRate(c,'tgrowth_conv','Конверсия по подразделениям');
    return {sum:'конверсия '+f('tgrowth_conv',cv.v),st:cv.st,
      head:vsBase(cv,c,'Повышают чаще','Повышают реже','Конверсия в повышение — на уровне базы'),
      lede:'За 12 месяцев одобрено **'+ps+'** '+U.plural(ps,['заявка','заявки','заявок'])+', отказано в **'+dn+'**. Конверсия за '+
        mNom(D.LAST)+' — **'+f('tgrowth_conv',cv.v)+'**'+(cv.base!=null?' при базе '+f('tgrowth_conv',cv.base):'')+'.',
      focus:fo.focus,act:fo.act,ann:{tgrowth_conv:{hi:[D.LAST]}}};
  },
  requests(c){
    const t=judge('tgrowth_tat',c), tg=D.tgrowthProfile(c.lp);
    return {sum:f('tgrowth_tat',t.v)+' до повышения',st:t.st,
      head:vsBase(t,c,'До повышения доходят дольше','До повышения доходят быстрее','Время до повышения — на уровне базы'),
      lede:'Заявок за 12 месяцев — **'+(tg.pass+tg.deny)+'**: '+tg.types.map(x=>x.name.toLowerCase()+' — '+(x.pass+x.deny)).join(', ')+
        '. Время до повышения — **'+f('tgrowth_tat',t.v)+'**'+(t.base!=null?' при базе '+f('tgrowth_tat',t.base):'')+'.',
      ann:{tgrowth_tat:{hi:[D.LAST]}}};
  },
  statuses(c){
    const tg=D.tgrowthProfile(c.lp);
    const col=k=>D.TG_STATUS.findIndex(x=>x.key===k);
    const tot=j=>sum(tg.rows.map(r=>r.cells[j]));
    const hc=sum(tg.rows.map(r=>sum(r.cells)));
    if(!hc)return {sum:'нет людей',st:'n'};
    const done=tot(col('done')), inp=tot(col('inprog')), den=tot(col('denied')), none=tot(col('none'));
    const gi=argmax(tg.rows.map(r=>r.cells[col('inprog')])), g=tg.rows[gi];
    return {sum:pl(inp,PPL)+' в процессе',st:'n',
      head:'Без развития за год — '+pc(none,hc)+'% людей',
      lede:'За 12 месяцев рост состоялся у **'+done+'**, в процессе — **'+inp+'**, заявку отклонили у **'+den+'**. '+
        'Больше всего людей в процессе роста — в «'+g.name+'» ('+g.cells[col('inprog')]+').'};
  }
};

/* ===== Мониторинг работы ===== */
CH.monitor={
  both(c){
    const m=[['underwork','Недоработчиков','больше','меньше'],['low_perf','Лоу-перформеров','больше','меньше'],
      ['review_up','Улучшивших оценку','больше','меньше']].map(x=>({key:x[0],who:x[1],j:judge(x[0],c)}));
    const bad=m.filter(x=>x.j.st==='bad'), good=m.filter(x=>x.j.st==='good');
    const b0=bad[0];
    const us=ser(c.lp,'underwork'), pk=argmax(us), note=pk!==D.LAST&&us[pk]!=null&&us[D.LAST]!=null&&us[pk]>us[D.LAST]*1.15?pk:-1;
    const fo=focusRate(c,'underwork','Недоработчики по подразделениям');
    return {sum:bad.length?bad.length+' '+U.plural(bad.length,['показатель','показателя','показателей'])+' хуже базы':'проседания нет',
      st:bad.length?'bad':good.length?'good':'n',
      head:b0?b0.who+' '+(b0.j.v>b0.j.base?'больше':'меньше')+', чем '+inBase(c)+': '+f(b0.key,b0.j.v)+' против '+f(b0.key,b0.j.base)
        :'Проседания нет: показатели '+(good.length?'на уровне базы или лучше':'на уровне базы «'+c.bench+'»'),
      lede:'Недоработчики — **'+f('underwork',m[0].j.v)+'**, лоу-перформеры — **'+f('low_perf',m[1].j.v)+
        '**, улучшили оценку в ревью — **'+f('review_up',m[2].j.v)+'**.',
      focus:fo.focus,act:fo.act,
      ann:{underwork:annFor(note,'пик'),low_perf:{hi:[D.LAST]},review_up:{hi:[D.LAST]}}};
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
  offices(c){
    const rows=D.officeRank(c.lp);
    if(rows.length<2)return {sum:'один офис',st:'n'};
    const b=rows[0], w=rows[rows.length-1];
    return {sum:rows.length+' '+U.plural(rows.length,['офис','офиса','офисов']),st:'n',
      head:'«'+b.name+'» заполнен лучше всех, «'+w.name+'» — хуже всех',
      lede:'«'+b.name+'» ('+b.city+') — **'+f('office_att',b.att)+'**, «'+w.name+'» ('+w.city+') — **'+f('office_att',w.att)+'**.'};
  },
  people(c){
    const g=D.attByGrade(c.lp).filter(x=>x.hc);
    if(g.length<2)return {sum:'нет данных',st:'n'};
    const b=g[argmax(g.map(x=>x.att))], w=g[argmin(g.map(x=>x.att))];
    return {sum:'чаще — «'+b.name+'»',st:'n',
      head:'Чаще всех ходит «'+b.name+'», реже всех — «'+w.name+'»',
      lede:'«'+b.name+'» — **'+f('office_att',b.att)+'**, «'+w.name+'» — **'+f('office_att',w.att)+'** за '+D.CMP.cur+'.'};
  },
  booking(c){
    const v=judge('booking_viol',c), bk=D.bookingQuality(c.lp);
    return {sum:f('booking_viol',v.v)+' нарушений',st:v.st,
      head:vsBase(v,c,'Бронь нарушают чаще','Бронь нарушают реже','Нарушения брони — на уровне базы'),
      lede:'За '+bk.month+' — **'+D.fmtInt(bk.noshow)+'** человеко-дней брони без прихода и **'+D.fmtInt(bk.walkin)+
        '** приходов без брони.',
      ann:{booking_viol:{hi:[D.LAST]}}};
  },
  dynamics(c){
    const v=judge('office_att',c), ya=yearAgo(c.lp,'office_att');
    const fo=focusRate(c,'office_att','Посещаемость по подразделениям');
    return {sum:f('office_att',v.v),st:v.st,
      head:vsBase(v,c,'В офис ходят чаще','В офис ходят реже','Посещаемость — на уровне базы')+
        (v.base!=null?': '+f('office_att',v.v)+' против '+f('office_att',v.base):''),
      lede:ya!=null?'Год назад — **'+f('office_att',ya)+'**, изменение за год — **'+D.fmtDelta('office_att',+(v.v-ya).toFixed(2))+'**':'',
      focus:fo.focus,act:fo.act,ann:{office_att:{hi:[D.LAST]}}};
  }
};

/* ===== AI-инструменты ===== */
CH.ai={
  adoption(c){
    const p=judge('ai_penetration',c), s=ser(c.lp,'ai_penetration'), wau=D.lastVal(c.lp,'ai_wau');
    const fo=focusRate(c,'ai_penetration','Проникновение по подразделениям');
    return {sum:f('ai_penetration',p.v),st:p.st,
      head:vsBase(p,c,'AI пользуются больше','AI пользуются меньше','Проникновение AI — на уровне базы')+
        (p.base!=null?': '+f('ai_penetration',p.v)+' против '+f('ai_penetration',p.base):''),
      lede:s[0]!=null&&p.v!=null?'За год проникновение '+(p.v>=s[0]?'выросло':'снизилось')+' с **'+f('ai_penetration',s[0])+
        '** до **'+f('ai_penetration',p.v)+'**; активных пользователей в неделю — **'+D.fmtInt(wau)+'**.':'',
      focus:fo.focus,act:fo.act,ann:{ai_penetration:{hi:[D.LAST]},ai_wau:{hi:[D.LAST]}}};
  },
  tools(c){
    const ai=D.aiProfile(c.lp);
    const t=ai.tools.slice().sort((a,b)=>b.value-a.value)[0];
    const st=ai.streams.filter(x=>x.hc).slice().sort((a,b)=>b.value-a.value);
    if(!t||!st.length)return {sum:'нет данных',st:'n'};
    return {sum:'лидер — «'+st[0].name+'»',st:'n',
      head:'«'+t.name+'» — самый популярный инструмент: '+f('ai_penetration',t.value)+' сотрудников',
      lede:'Среди стримов больше всего пользуются в «'+st[0].name+'» (**'+f('ai_penetration',st[0].value)+'**), меньше всего — в «'+
        st[st.length-1].name+'» (**'+f('ai_penetration',st[st.length-1].value)+'**).'};
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
      lede:'Всего в отборе **'+pl(t.tot,PPL)+'**. '+tops.slice(1).map(x=>x.dim.name+': больше всего — «'+x.name+'» (**'+x.share+'%**)').join('; ')+
        (tops.length>1?'.':'')};
  };
});
CH.structure.custom=function(){return {sum:'конструктор',st:'n'}};

/* ---------- сборка книги блока ----------
   c: {S, lp, bl, sel, bench}; subTabs — список глав блока; demo(sub) — правда,
   если глава в пробнике демо. Возвращает шаги степпера, текущую главу и
   следующую. Ошибка в одной главе не роняет экран: глава остаётся без вывода. */
function book(bk,subTabs,cur,c,demo){
  const defs=CH[bk]||{}, q=Q[bk]||{};
  const chapters=subTabs.map(([key,name])=>{
    let s={};
    if(!(demo&&demo(key))&&defs[key]){try{s=defs[key](c)||{}}catch(e){s={}}}
    return Object.assign({key:key,name:name,q:q[key]||name,st:'n'},s);
  });
  const i=Math.max(0,chapters.findIndex(x=>x.key===cur));
  return {chapters:chapters,cur:chapters[i],idx:i,next:chapters[i+1]||null};
}

window.TPSTORY={book,Q,CH,judge};
})();

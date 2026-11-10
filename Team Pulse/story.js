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
/* Поставка 90 (заказчик: «однозначная интерпретация цифр»): одно окно для глав — с января по последний закрытый месяц
   (D.PER_TEXT) против тех же месяцев прошлого года; числа — те же, что в строке итога под графиком (D.periodTotal).
   Поставка 99 (критики, заказчик: «январь–сентябрь в каждой строке — как технический заголовок»): окно названо один раз —
   в шапке вкладки (D.PER_NAME); в текстах глав только исключения (за 12 месяцев, за сентябрь, сейчас).
   потоки — сумма, доли — за период целиком, накопительные — на закрытый месяц. Незакрытый месяц в текстах не участвует */
const PT=D.PER_TEXT, PTc=PT.charAt(0).toUpperCase()+PT.slice(1), SP=D.PER_SPAN;
/* поставка 137: последний месяц данных словами — «октябрь» или, если не закрыт, «1–12 октября» */
const MON1=D.PER_PART?'1–'+D.ASOF.d+' '+D.MONTH_GEN[D.ASOF.m]:D.MONTH_NOM[D.PER_C];
const per=(lp,k)=>D.periodTotal(lp,k)||{};
const pn=(lp,k)=>Math.round(per(lp,k).v||0);
const ago=(lp,k)=>{const p=per(lp,k);return p.pv!=null?' (год назад '+f(k,p.pv)+')':''};
function yearAgo(lp,k){const p=per(lp,k);return p.pv!=null?p.pv:null}
/* оценка метрики так же, как в карточке: цель KPI, иначе база, иначе без оценки; значение и база — за период,
   цель — на закрытый месяц (i) */
/* поставка 110 (критики 07.11, «один вердикт»): та же оценка, что у строки таблицы и плашки (D.verdictState) — малый отчёт,
   мало событий (thin) и база = сам юнит (self) отмечены, и заголовок главы говорит о них, а не «на уровне базы» */
function judge(k,c){
  const i=D.PER_I, v=per(c.lp,k).v, kpi=D.kpiAt(k,c.S,D.MONTHS[i].m);
  /* поставка 113: без цели, но с распределением подразделений того же размера — ориентир медиана (и у всей компании) */
  const pe=kpi?null:D.peerOf(k,c.lp);
  const self=!kpi&&!pe&&D.isSelfBase(), base=kpi?kpi.green:pe?pe.p50:(D.comparable(k)&&!self?per(c.bl,k).v:null);
  const thin=D.thin(k,c.lp), ev=D.eventsOf(k,c.lp);
  let st='n';
  if(v!=null&&base!=null&&!thin){
    /* поставка 125: недо- и переработка — только при разметке мониторинга у половины людей и больше (и у компании-ориентира) */
    const s=!D.monJudged(k,c.lp)?'neutral':kpi?D.stateForKpi(k,v,kpi):pe?D.peerState(k,v,pe,c.lp):D.monJudged(k,c.bl)?D.compareState(k,v,base):'neutral';
    st=s==='good'?'good':s==='bad'?'bad':'n';
  }
  /* поставка 136, п. 10: одно основное сравнение (D.mainCmp — то же правило у карточек и выводов блоков). Метрика
     изменилась к тому же периоду прошлого года на 10% и больше — заголовок, значение и точка шага говорят о годе (yoy),
     ориентир в них не участвует; иначе — только об ориентире. py — значение год назад */
  const py=yearAgo(c.lp,k), yoy=v!=null&&!D.isSmall(k)&&D.mainCmp(k,c.lp,c.S)==='yoy';
  if(yoy)st=D.yoyMove(k,c.lp)==='worse'?'bad':'good';
  return {v:v,base:base,kpi:kpi,peer:pe,st:st,i:i,k:k,thin:thin,ev:ev,self:self,small:D.isSmall(k),smallHq:D.isSmallHq(k),low:!D.isSmall(k)&&!!D.turnLow&&D.turnLow(k,c.lp),yoy:yoy,py:py};
}
/* заголовок без сравнения: мало людей, мало событий или база = сам юнит (тогда — с прошлым годом) */
function plainHead(j,c,more,less){
  const m=D.METRIC_BY_KEY[j.k], v=f(j.k,j.v);
  if(j.thin)return m.name+' — '+v+': '+(j.ev.n?'всего '+pl(j.ev.n,j.ev.noun):'нет событий')+', по стольким не оцениваем';
  if(j.small)return m.name+' — '+v+'; '+(j.smallHq?'в HQ':'в команде')+' меньше '+D.SMALL_N+' человек, с ориентиром не сравниваем';
  /* поставка 138, п. 6: текучесть при выборке ниже своего порога (100 / 50 человек) — значение без оценки */
  if(j.low)return m.name+' — '+v+'; численность ниже '+D.turnMin(j.k)+' человек, цветом не оцениваем';
  const py=yearAgo(c.lp,j.k);
  if(py==null||!py)return m.name+' — '+v;
  /* поставка 128: «чаще / реже, чем год назад» — тем же правилом, что чип года и карточки (D.yoyMove) */
  return !D.yoyMove(j.k,c.lp)?m.name+' — '+v+' (год назад '+f(j.k,py)+')':(j.v>py?more:less)+', чем год назад: '+v+' против '+f(j.k,py);
}
/* поставка 117: с чем сравнили — «в базе» (подразделения похожей численности, термин с расшифровкой) или «во всей
   компании» с фильтрами шапки; слово «база» — только для подразделений похожей численности */
/* поставка 136, п. 3: группа сравнения названа словами (термин «База» — в подсказке): «чем в подразделениях похожего размера» */
const inRef=(j,c)=>j&&j.peer?'в {{База|подразделениях похожего размера}}':'во '+D.coName(c.S,'prep');
const lvlRef=(j,c)=>j&&j.peer?'{{База|подразделений похожего размера}}':D.coName(c.S,'gen');
/* всплеск: месяц заметно выше обычного — иначе «пик» на графике шум */
function spikeAt(a,minAbs){
  const i=argmax(a);
  return i>=0&&a[i]>=Math.max(minAbs||3,median(a)*1.8)?i:-1;
}
/* акценты графика: месяц-заметка и текущий месяц полным тоном */
/* поставка 90: полоса-акцент — только у месяца-заметки (пик, максимум); у последнего месяца её нет — фон за баром
   читался как «обратите внимание» (заказчик) */
function annFor(i,t){
  const hi=i>=0?[i]:[];
  return {hi:hi,notes:i>=0?[{i:i,t:t}]:[]};
}

/* ---------- «Где сосредоточено» ----------
   Подразделения уровнем ниже выбранного узла. Счётная метрика — сумма за
   окно и доля от итога; относительная — значение и оценка к базе.
   act — точка приложения сил: доля подразделения в метрике заметно выше его
   доли в людях (на 8 п.п. и больше, и хотя бы три события). */
function kids(c){
  return D.rowsOf(D.passRoot(c.sel)).map(n=>({n:n,lp:leaves(c.S,n.path)})).filter(r=>r.lp.length);
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
  const i=D.PER_I, kpi=D.kpiAt(k,c.S,D.MONTHS[i].m), base=kpi?kpi.green:per(c.bl,k).v;
  const m=D.METRIC_BY_KEY[k];
  /* поставка 117: подразделение оценивается как в таблице — цель, иначе база своей группы численности (peerOf по его
     листьям), иначе вся компания */
  const rows=rs.map(r=>{
    const v=per(r.lp,k).v, pe=kpi?null:D.peerOf(k,r.lp);
    const s=v==null||!D.monJudged(k,r.lp)?'neutral':kpi?D.stateForKpi(k,v,kpi):pe?D.peerState(k,v,pe,r.lp):base==null||!D.monJudged(k,c.bl)?'neutral':D.compareState(k,v,base);
    return {path:r.n.path,name:r.n.name,v:v,pe:pe,st:s==='good'?'good':s==='bad'?'bad':'n'};
  }).filter(r=>r.v!=null);
  if(rows.length<2)return {};
  /* хуже — выше: сортируем так, чтобы первой стояла строка, которую разбирать */
  const dir=m.better==='higher'?1:-1;
  rows.sort((a,b)=>dir*(a.v-b.v));
  const mx=Math.max.apply(null,rows.map(r=>r.v))||1, sm=rows.reduce((a,r)=>a+Math.max(0,r.v),0);
  const focus={cap:cap,rows:rows.slice(0,4).map(r=>({name:r.name,val:f(k,r.v),w:U.barW(k,r.v,m.fmt==='pct'?0:sm,mx)/100,st:r.st,path:r.path}))};
  const bad=rows.filter(r=>r.st==='bad');
  const b0=bad[0];
  const act=bad.length===1?{text:(kpi?'Не дотягивает до цели только «':b0.pe?'Хуже {{База|базы}} только «':'Хуже, чем во всей компании, только «')+
    b0.name+'»: **'+f(k,b0.v)+'** при '+(kpi?'цели '+f(k,base):b0.pe?'{{База|базе}} '+f(k,b0.pe.p50):f(k,base)+' во всей компании')+'.',
    node:b0.path,name:b0.name}:null;
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
  office:{calendar:'Когда ходят?',attend:'Кто и где ходит?'},
  ai:{adoption:'Пользуются ли AI?',who:'Кто пользуется?',interns:'Как используют стажёры?',usage:'Как пользуются?',what:'Что делают?'}
};

/* поставка 127 (владелец 08.11: «нельзя переносить — может, мини-версии заголовков на мелком экране?»): короткие названия
   шагов для узкой панели графиков — одна строка, без ответа; полный вопрос и ответ — в подсказке шага */
const QS={
  structure:{portrait:'Портрет',level:'Уровень',work:'Оформление',stream:'Стримы',custom:'Конструктор'},
  movement:{balance:'Баланс',dynamics:'Что двигало'},
  turnover:{dynamics:'Сколько',reasons:'Почему',who:'Кто',hq:'HQ'},
  hiring:{vacancies:'Вакансии',plan:'План',profile:'Кого берём'},
  tgrowth:{flow:'Растут ли',grades:'Грейды',spec:'Специализация'},
  monitor:{activity:'Активность',review:'Ревью'},
  office:{calendar:'Когда',attend:'Кто и где'},
  ai:{adoption:'Пользуются',who:'Кто',interns:'Стажёры',usage:'Как',what:'Что делают'}
};

/* сравнение с базой одной фразой: «чаще / реже / на уровне» */
function vsBase(j,c,more,less,same,noYoy){
  /* 30.10, критики: «Конверсия на уровне базы» при пустом значении — за месяц нет событий, так и пишем */
  if(j.v==null)return 'Нет данных — не с чем сравнить';
  if(j.thin||j.small||j.low||j.self&&!j.kpi)return plainHead(j,c,more,less);
  /* поставка 136, п. 10: одно сравнение — либо год (изменение от 10%), либо ориентир; хвоста «…, но реже, чем год
     назад» больше нет */
  if(j.yoy)return (j.v>j.py?more:less)+', чем год назад';
  /* поставка 113: ориентир — медиана подразделений того же размера; поставка 117: она и есть «база» */
  return j.st==='bad'||j.st==='good'
    ? ((j.v>j.base)?more:less)+', чем '+inRef(j,c)
    : same.replace(/ — на уровне базы$/,'')+' — на уровне '+lvlRef(j,c);
}
/* значение за период и база; пустое — «нет данных», а не «— при базе 37,5%» */
/* поставка 117: «при базе X» — база с расшифровкой; без базы — «при X во всей компании»; у цели — «при цели X» */
const valAt=(k,j,c)=>j.v==null?'нет данных':'**'+f(k,j.v)+'**'+(j.yoy?' (год назад за тот же период — '+f(k,j.py)+')':j.base!=null&&!j.small&&!j.low&&!j.thin&&!j.self?(j.kpi?' при цели '+f(k,j.base)
  :j.peer?' при {{База|базе}} '+f(k,j.base):' при '+f(k,j.base)+(c?' во '+D.coName(c.S,'prep'):' во всей компании')):'');
const CH={};

/* поставка 121: заголовок «Кто уходит?» у команды меньше 30 человек — в людях, по самой заметной группе стажа */
function smallWho(c,ex,tot,early){
  const last=ex.tenure[ex.tenure.length-1], sen=last&&!last.early?last.value:0, lcf=t=>t.charAt(0).toLowerCase()+t.slice(1);
  const top=ex.tenure.slice().sort((a,b)=>b.value-a.value)[0];
  let left='';
  if(sen&&(sen>=2||sen*3>=tot)){
    const ts=D.teamShare(c.lp,'tenure')||{}, hc=D.lastVal(c.lp,'hc_total')||0, t=ts[last.name];
    if(t!=null)left='; таких в команде осталось '+Math.round(t*hc);
    return 'Ушли '+pl(tot,PPL)+': '+sen+' — со стажем '+lcf(last.name)+left;
  }
  if(early)return 'Ушли '+pl(tot,PPL)+': '+early+' — со стажем до года';
  return 'Ушли '+pl(tot,PPL)+(top&&top.value?': больше всего — со стажем '+lcf(top.name)+' ('+top.value+')':'');
}
/* ===== Отток и текучесть ===== */
CH.turnover={
  dynamics(c){
    const a=ser(c.lp,'attrition').map((v,i)=>i>=D.YTD_FROM&&i<=D.CNT_I?v:null), y=pn(c.lp,'attrition');
    if(!y)return {sum:'уходов не было',st:'good',head:'Никто не ушёл'};
    /* 15.10: «прогноз годовой текучести» снят (нет в каталоге HQ/УС) — темп
       ухода судим по накопительной текучести, как «Текучесть YoY KPI» */
    const fc=judge('turnover_y',c), ya=yearAgo(c.lp,'turnover_y');
    const pk=spikeAt(a,3);
    /* поставка 110 (критики: у команды из 7 «Уходят чаще, чем в базе» над «Всё спокойно»): меньше 30 человек — уходы в людях,
       без сравнения с базой; база = сам юнит — с прошлым годом */
    const yp=Math.round(per(c.lp,'attrition').pv||0), dd=y-yp;
    let head=fc.small?'Ушли '+pl(y,PPL)+(per(c.lp,'attrition').pv!=null?' — '+(dd?'на '+pl(Math.abs(dd),PPL)+' '+(dd>0?'больше':'меньше')+', чем год назад':'столько же, сколько год назад'):'')
      :fc.self?plainHead(Object.assign({},fc,{k:'turnover_y'}),c,'Уходят чаще','Уходят реже')
      /* поставка 136, п. 10: одно сравнение — год (изменение от 10%) или ориентир */
      :fc.yoy?(fc.v>fc.py?'Уходят чаще':'Уходят реже')+', чем год назад'
      :fc.st==='bad'?'Уходят чаще, чем '+inRef(fc,c):fc.st==='good'?'Уходят реже, чем '+inRef(fc,c)
      :'Темп ухода — на уровне '+lvlRef(fc,c);
    /* поставка 131: всплеск месяца — другой факт (число уходов): он в «Что важно» («Пик — март»), в заголовок не приклеиваем */
    const fo=focusCount(c,'attrition',{cap:'Где уходят',what:'общего оттока',win:'ytd'});
    return {sum:pl(y,EXITS),st:fc.st,head:head,
      lede:'Ушли **'+pl(y,PPL)+'**'+ago(c.lp,'attrition')+'. Текучесть накопительная — **'+
        f('turnover_y',fc.v)+'**'+(ya!=null?' (год назад '+f('turnover_y',ya)+')':'')+'.',
      facts:[pk>=0?'Пик — **'+mNom(pk)+'**: '+pl(a[pk],EXITS):null,
        /* поставка 138, п. 9: месячной текучести на вкладке оттока нет */
        ya!=null&&fc.v!=null?'Текучесть накопительная к прошлому году: **'+D.fmtDelta('turnover_y',+(fc.v-ya).toFixed(2))+'**':null],
      focus:fo.focus,act:fo.act,ann:{attrition:annFor(pk,'пик года')}};
  },
  reasons(c){
    const rs=D.exitReasons(c.lp,'ytd'), ini=D.exitInitiators(c.lp,'ytd');
    const tot=sum(rs.map(r=>r.value));
    if(!tot)return {sum:'уходов не было',st:'n',head:'Никто не ушёл'};
    const top=rs.slice().sort((a,b)=>b.value-a.value)[0];
    const by=k=>(ini.find(x=>x.key===k)||{value:0}).value, org=by('org');
    const rg=judge('regret',c);
    /* 26.10, ревью критиков: нежелательные — за тот же период, что карточка (с января по последний закрытый месяц, счёт
       regret_cnt ÷ отток), и одним определением. Заголовок — главная причина с числом: «не из-за компании» спорил с
       тем, что «Лучшее предложение» и «Нет роста» — рычаги руководителя */
    /* поставка 106: людьми — по дату данных, как «Ушли …» и разбивки */
    const cumN=k=>{const e=D.aggregateExt(c.lp,k);let t=0;for(let i=D.YEAR_START_EXT[D.NEXT-1];i<=D.NEXT-1;i++)t+=e[i]||0;return Math.round(t)};
    /* поставка 121 (критики 119: «13% — нежелательные» рядом с «1 из 9» — разные окна): доля нежелательных — из тех же людей,
       что в тексте (по дату данных); у команды меньше 30 человек — людьми */
    const regN=cumN('regret_cnt'), outN=cumN('attrition'), rp=pc(regN,outN);
    /* поставка 121 (критик на 49 человек: «Главная причина — «Лучшее предложение»: 4 из 11», а у «Нет роста» тоже 4): при
       ничьей — «причины разные», без главной */
    const tied=rs.filter(r=>r.value===top.value&&r.value>0), tie=tied.length>1;
    /* поставка 128 (аудит L6: точка шага красная — нежелательная текучесть хуже ориентира, — а заголовок только о причине):
       вердикт нежелательной текучести — в начале заголовка, тем же словом, что строка главной */
    /* выводы о нежелательных уходах без вердикта к ориентиру — в людях у малой HQ или «… чем год назад» — их текстом */
    const rc=(c.cards||[]).find(x=>/^(regret|nonregret)$/.test(x.key)&&/^(yoy|ppl)$/.test(x.fact.kind));
    const rgW=rg.st==='bad'||rg.st==='good'?D.METRIC_BY_KEY.regret.name+' '+f('regret',rg.v)+' — '+(rg.st==='bad'?'хуже':'лучше')+' '+
      (rg.kpi?'цели '+f('regret',rg.base):rg.peer?'{{База|базы}} '+f('regret',rg.base):'всей компании ('+f('regret',rg.base)+')')
      :rc?(rc.fact.kind==='ppl'?rc.fact.lead:rc.head):'';
    return {sum:D.isSmall()?regN+' из '+outN+' — нежелательные':rp+'% — нежелательные',st:rg.st,
      /* поставка 131: одна метрика в заголовке — вердикт нежелательной текучести; главная причина — первой строкой «Что важно» */
      head:rgW?rgW
        :rp>=50&&!tie?rp+'% уходов — нежелательные'
        :org*2>tot?'Большинство уходов — по инициативе работодателя: '+org+' из '+tot
        :tie?'Причины разные: '+tied.slice(0,3).map(r=>'«'+r.name+'»').join(', ')+' — поровну, по '+top.value+' из '+tot
        :'Главная причина ухода — «'+top.name+'»: '+top.value+' из '+tot,
      lede:'Ушли **'+pl(tot,PPL)+'**: '+by('emp')+' — по своей инициативе, '+org+' — по инициативе работодателя. '+
        'Нежелательных уходов (ушли сами, со стажем от года и сильной оценкой) — **'+cumN('regret_cnt')+' из '+cumN('attrition')+'**.',
      facts:rs.slice().sort((a,b)=>b.value-a.value).slice(0,3).map(r=>'«'+r.name+'» — **'+r.value+'**'+(r.regret?' ★':'')),
      act:top.regret&&top.value>=2?{text:'Разберите «'+top.name+'»: **'+top.value+' из '+tot+'** уходов.'}:null};
  },
  who(c){
    const ex=D.exitProfile(c.lp,'ytd'), tot=ex.total;
    if(!tot)return {sum:'уходов не было',st:'n',head:'Никто не ушёл'};
    const early=sum(ex.tenure.filter(t=>t.early).map(t=>t.value)), ep=pc(early,tot);
    const gv=ex.grade.map(x=>x.value), sv=ex.stream.map(x=>x.value), gi=argmax(gv), si=argmax(sv), g=ex.grade[gi], s=ex.stream[si],
      /* поставка 110 (E10): ничья — «поровну», а не лидер */
      gt=tieOf(gv,gi,j=>ex.grade[j].name), stt=tieOf(sv,si,j=>ex.stream[j].name);
    /* поставка 110 (A2): в команде меньше 30 человек — без долей и оценки, в людях */
    const sm=D.isSmall();
    const lt=ex.tenure[ex.tenure.length-1], sn=lt&&!lt.early?lt.value:0, snr=sm&&sn&&(sn>=2||sn*3>=tot);
    return {sum:snr?sn+' из '+tot+' — со стажем '+lt.name.charAt(0).toLowerCase()+lt.name.slice(1):sm?early+' из '+tot+' — в первый год':ep+'% — в первый год',st:!sm&&ep>=40?'warn':'n',
      /* поставка 121 (критики-руководители 119: «Ушли 4 человека: 1 — со стажем до года», а 3 из 4 — со стажем больше 5 лет):
         у малой команды заголовок — по самой большой группе стажа; опытные (последняя группа) — первыми, если их двое и больше
         или треть ушедших; сколько таких осталось в команде — в хвосте */
      head:sm?smallWho(c,ex,tot,early):ep>=30?ep+'% ушедших не проработали и года':'Уходят в основном опытные: '+(100-ep)+'% — со стажем больше года',
      lede:'Ушли **'+pl(tot,PPL)+'**, из них **'+early+'** — со стажем до года. '+(gt.tie?'По грейдам поровну — '+gt.q+' (по '+g.value+')':'Больше всего уходов — в грейде «'+g.name+'» ('+g.value+')')+
        (stt.tie?'; по стримам поровну — '+stt.q+' (по '+s.value+').':(gt.tie?'; по стримам больше всего — ':' и в стриме ')+'«'+s.name+'» ('+s.value+').'),
      facts:ex.tenure.map(t=>t.name+' — **'+t.value+'**'),
      act:!sm&&ep>=40?{text:'Ранний уход — вопрос найма и адаптации: проверьте онбординг тех, кто пришёл за последний год.'}:null};
  },
  /* 26.10, правки: светофор HQ — по активной численности HQ, что бы ни стояло в фильтрах покраски и типа */
  hq(c){
    const h=D.hqLight(c.S,c.lp,c.sel);
    if(!h)return {sum:'нет данных',st:'n',head:'Светофору HQ нужны данные'};
    if(!h.hc)return {sum:'нет HQ',st:'n',head:'В подразделении нет HQ-сотрудников'};
    /* поставка 103 (файл 9, п. 10) — без целей; поставка 128 (владелец 08.11) — с целями: оценка по цели и год к году */
    /* поставка 110 (A3, критики 07.11: «текучесть HQ 66,7%» при одном человеке в HQ): порог малых чисел — по численности
       HQ, знаменателю этих долей, а не по численности выбранной команды */
    if(h.hc<D.SMALL_N){const pp=Math.round(1000/h.hc)/10;
      return {sum:'HQ: '+pl(h.hc,PPL),st:'n',head:'В HQ '+pl(h.hc,PPL)+' — текучесть HQ в процентах не оцениваем',
        lede:'Активная численность HQ — **'+pl(h.hc,PPL)+'**: один уход сдвигает текучесть HQ примерно на **'+
          String(pp).replace('.',',')+' п.п.** Поэтому доли здесь не сравниваем ни с прошлым годом, ни с целями — '+
          'уходы в людях видны на графиках «Отток» и в таблице подразделений. Цели HQ — пунктиром на графиках, для справки.'};}
    const t=h.rows[0], nr=h.rows[1], rg=h.rows[2];
    const nm={turnover_y:'текучесть HQ',nonregret:'желательная текучесть HQ',regret:'нежелательная текучесть HQ'};
    /* поставка 128 (аудит: «выше, чем год назад» при +1,5 п.п. рядом с серым чипом): «выше / ниже» — от 10% разницы, тем же
       порогом, что цвет чипа под графиком (deltaState); меньше — «почти как год назад» */
    const sig=r=>r.ya!=null&&r.v!=null&&(r.ya?Math.abs(r.v-r.ya)/Math.abs(r.ya)>=D.VERDICT_GAP:r.v!==0);
    const up=h.rows.filter(sig);
    const yo=r=>r.ya==null?'года назад нет':!sig(r)?'почти как год назад':(r.v>r.ya?'выше':'ниже')+', чем год назад';
    /* поставка 128 (владелец 08.11: «цели на шаге HQ»): оценка по цели закрытого месяца (D.hqLight, stateForKpi) — первой, тем же
       словом, что вывод блока и карточка «Текучесть HQ выше цели»; год к году — следом */
    /* поставка 138, п. 2: у желательной текучести HQ — коридор «цель … верхний порог»; выше порога — «выше порога», не «хуже цели» */
    /* поставка 138, п. 6: строка ниже порога численности — цель и порог без оценки */
    const over=r=>!r.low&&r.kpi&&r.kpi.hi!=null&&r.v!=null&&r.v>r.kpi.hi;
    const cg=r=>!r.kpi?'':r.low?'цель '+f(r.key,r.kpi.green)+(r.kpi.hi!=null?', верхний порог '+f(r.key,r.kpi.hi):'')+' — без цветовой оценки'
      :over(r)?'верхний порог '+f(r.key,r.kpi.hi)+' — выше':'цель '+f(r.key,r.kpi.green)+(r.st==='bad'?' — хуже':r.st==='good'?' — лучше':'');
    const bad=h.rows.filter(r=>r.st==='bad'), good=h.rows.filter(r=>r.st==='good');
    const capF=x=>x.replace(/^./,y=>y.toUpperCase());
    /* поставка 131: в заголовке одна метрика — первая из тех, что хуже цели; остальные — в тексте ниже, каждая со своей оценкой */
    const head=bad.length?capF(nm[bad[0].key]+' '+f(bad[0].key,bad[0].v)+(over(bad[0])?' — выше верхнего порога '+f(bad[0].key,bad[0].kpi.hi):' — хуже цели '+f(bad[0].key,bad[0].kpi.green)))
      :good.length===h.rows.length?'HQ уходит в пределах целей: текучесть '+f('turnover_y',t.v)+' при цели '+f('turnover_y',t.kpi.green)
      :up.length?capF(nm[t.key]+' '+f('turnover_y',t.v)+' — '+yo(t)):'HQ уходит так же, как год назад';
    const part=r=>'**'+f(r.key,r.v)+'** ('+[cg(r),yo(r)].filter(Boolean).join('; ')+')';
    return {sum:'текучесть HQ '+f('turnover_y',t.v),st:bad.length?'bad':good.length===h.rows.length?'good':'n',
      head:U.esc(head),
      /* 26.10-б: накопительно с января по последний закрытый месяц — незакрытый ещё вызревает */
      /* поставка 131: каждая метрика — своим предложением */
      lede:'Активная численность HQ — **'+pl(h.hc,PPL)+'**. Накопительно с января по '+D.MONTH_NOM[h.month.m]+'. Текучесть — '+
        part(t)+'. Желательная — '+part(nr)+'. Нежелательная — '+part(rg)+'.',
      facts:h.rows.map(r=>r.ya!=null?r.label.replace(/ накопительн\S+/,'')+' год назад к этому месяцу — **'+f(r.key,r.ya)+'**':null)};
  }
};

/* ===== Движение персонала =====
   Итерация 32: обзор (водопад + «что нужно знать» под ним) и одна глава
   динамики по месяцам; глава «Замещение и темпы» снята. */
CH.movement={
  balance(c){
    /* поставка 105: те же числа, что водопад (замкнутая витрина flow_*, если датасет её отдаёт) */
    const F=D.FLOW, hc=ser(c.lp,F?'flow_fin':'hc_total'), begin=hc[0], end=hc[D.LAST], net=end-begin;
    const ws=k=>D.winSum(c.lp,k);
    /* 09.11: переводы — те же, что карточки «Переводы» (флаги in / out), остаток — только изменение без флага (сбой данных) */
    const hire=ws(F?'flow_hire':'hire'), tin=ws('transfer_in'), attr=ws(F?'flow_fire':'attrition'), tout=ws('transfer_out');
    const other=net-(hire+tin-attr-tout);
    const mx=argmax(hc);
    /* с первого месяца окна (водопад начинается с его численности), а не «за год»; 26.10, ревью критиков: и «Где
       нанимают» — за то же окно (было 12 месяцев против 11 у водопада: «43 из 117») */
    /* поставка 90 (заказчик): водопад — единственное место за 12 месяцев, и каждое его число так и подписано;
       «с 1 января» здесь больше не смешиваем */
    /* поставка 121 (критики 119): окно водопада — точными датами, «за 12 месяцев» было неправдой (≈10,5 месяца) */
    const since=' с '+D.WIN_START;
    const fo=focusCount(c,'hire',{cap:'Где нанимают ·'+since,what:'общего найма',win:'win'});
    const fr=fo.focus?fo.focus.rows:[], top=fr[0], tie=fr[1]&&fr[1].val===top.val;
    return {sum:signed(net)+since,st:'n',
      head:net>0?'Команда выросла на '+pl(net,PPL)+since:net<0?'Команда сократилась на '+pl(-net,PPL)+since
        :'Численность'+since+' не изменилась',
      lede:'Численность на конец '+D.WIN_FROM+' — **'+D.fmtInt(begin)+'**, сейчас — **'+D.fmtInt(end)+'**. Водопад показывает, что сдвинуло численность: '+
        'найм и переводы в команду поднимают её, отток и переводы из команды — опускают.',
      insights:[
        (hire>=attr?'Найм покрывает отток':'Найм не покрывает отток')+':'+since+' пришли **'+hire+'**, ушли **'+attr+'**',
        tin!==tout?'Переводы'+since+': **+'+tin+'** в команду и **'+minus(-tout)+'** из неё — '+
          (tin<tout?'команда отдаёт людей другим подразделениям':'команда получает людей из других подразделений')
          :'Переводы уравновешены: по **'+tin+'** в обе стороны',
        other?'Без флага в источнике — **'+signed(other)+'**: изменение численности, у которого нет флага найма, увольнения или перевода (сбой данных)':null,
        mx!==D.LAST&&mx!==0?'Максимум численности — **'+D.fmtInt(hc[mx])+'** '+mPrep(mx):null,
        /* поставка 128 (аудит: «41 из 106» — 41 весь найм подразделения, 106 только приём в компанию из витрины движения): делитель —
           сумма тех же строк, весь найм со стажёрами в штат */
        top?(tie?'Больше всего нанимают «'+top.name+'» и «'+fr[1].name+'»: по **'+top.val+'**':'Больше всего нанимает «'+top.name+'»: **'+top.val+'**')+
          ' из **'+fr.reduce((s,r)=>s+(r.val||0),0)+'**'+since+' — весь найм, со стажёрами в штат':null],
      focus:fo.focus,act:fo.act};
  },
  dynamics(c){
    /* поставка 90: глава с графиками «год к году» — окно графиков (с января по закрытый месяц), не водопада */
    const hc=ser(c.lp,'hc_total'), since='';
    const h=pn(c.lp,'hire'), a=pn(c.lp,'attrition'), ti=pn(c.lp,'transfer_in'), to=pn(c.lp,'transfer_out');
    const mx=argmax(hc);
    const fo=focusCount(c,'attrition',{cap:'Где уходят',what:'общего оттока',win:'ytd'});
    /* пики — по закрытым месяцам этого года, как на оси графиков; равные месяцы перечислены */
    const pk=(k,w)=>{const y=D.yoySeries(c.lp,k).cur.slice(0,D.PER_C+1), mv=Math.max.apply(null,y.map(v=>v||0)), at=[];
      y.forEach((v,i)=>{if(mv&&v===mv)at.push(PREP[i])});return at.length?w+' в '+at.join(' и ')+': **'+mv+'**':null};
    return {sum:'+'+h+' / '+minus(-a),st:'n',
      /* поставка 128 (аудит: глава «пришли 11, ушли 9», а вывод блока над ней — «пришли 15, ушли 13», с переводами): в главе —
         найм и уходы теми же словами, что пилюли вывода («найм 11 · уволились 9»); «пришли / ушли» — только с переводами */
      head:h>a?'Найм перекрывает отток: наняли '+h+', уволились '+a+since:h<a?'Отток больше найма: наняли '+h+', уволились '+a+since
        :'Найм и отток'+since+' сравнялись: по '+h,
      lede:'Приняли **'+pl(h,PPL)+'**'+ago(c.lp,'hire')+', ушли **'+pl(a,PPL)+'**'+ago(c.lp,'attrition')+'; переводами пришли '+ti+', ушли '+to+
        '. Сверху — итог, ниже — потоки, которые его двигали: видно, какой месяц что сдвинул.',
      facts:[pk('hire','Больше всего приняли'),pk('attrition','Больше всего ушли')],
      focus:fo.focus,act:fo.act,ann:{hc_total:annFor(mx!==D.LAST&&mx!==0?mx:-1,'максимум')}};
  }
};

/* ===== Найм и вакансии ===== */
CH.hiring={
  vacancies(c){
    const vo=ser(c.lp,'vac_open'), op=vo[D.LAST], cl=pn(c.lp,'vac_closed'), t=judge('time_to_fill',c);
    const pk=argmax(vo), note=pk>=0&&pk!==D.LAST&&vo[pk]>op?pk:-1;
    const fo=focusCount(c,'vac_open',{cap:'Где открыты вакансии',what:'всех открытых вакансий',win:'last'});
    return {sum:f('time_to_fill',t.v)+' на вакансию',st:t.st,
      /* поставка 128: вывод «открытых вакансий в N раз больше, чем год назад» (вывод блока) — и в заголовке шага */
      /* поставка 131: заголовок — только срок закрытия; вывод «открытых вакансий в N раз больше» — первой строкой «Что важно» */
      head:vsBase(t,c,'Вакансии закрываются дольше','Вакансии закрываются быстрее','Скорость закрытия — на уровне базы'),
      /* поставка 136, п. 2 (владелец: «непонятно, что сравнивается»): главное — только срок закрытия: медиана за период и
         то, с чем она сравнена в заголовке (тот же период прошлого года или ориентир). Открытые и закрытые вакансии —
         другие метрики: каждая своей строкой «Что важно» со своим сравнением */
      lede:t.v==null?'За '+SP+' закрытых вакансий нет — срок закрытия посчитать не по чему.'
        :'Медианный срок закрытия вакансий за '+D.PER_NAME+' — **'+f('time_to_fill',t.v)+'**'+
          (t.thin?'.':t.yoy||t.py!=null&&(t.base==null||t.small||t.self)?', за тот же период прошлого года — **'+f('time_to_fill',t.py)+'**.'
          :t.base!=null&&!t.small&&!t.self?(t.kpi?', цель — **'+f('time_to_fill',t.base)+'**.':t.peer?', {{База|база}} — **'+f('time_to_fill',t.base)+'**.'
            :', во '+D.coName(c.S,'prep')+' — **'+f('time_to_fill',t.base)+'**.'):'.'),
      facts:['Открытых вакансий сейчас — **'+op+'**'+(per(c.lp,'vac_open').pv!=null?' (на ту же дату год назад — '+f('vac_open',per(c.lp,'vac_open').pv)+')':''),
        'Закрыто вакансий '+D.CNT_TEXT+' — **'+cl+'**'+(per(c.lp,'vac_closed').pv!=null?' (за те же дни год назад — '+f('vac_closed',per(c.lp,'vac_closed').pv)+')':''),
        note>=0?'Больше всего открытых было '+mPrep(note)+': **'+vo[note]+'**':null],
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
      ann:{hire_plan:{hi:[D.PER_I]}}};
  },
  profile(c){
    const hp=D.hiringProfile(c.lp,'ytd');
    if(!hp.total)return {sum:'найма не было',st:'n',head:'Никого не наняли'};
    const ch=hp.channels.slice().sort((a,b)=>b.value-a.value), top=ch[0];
    return {sum:pl(hp.total,PPL),st:'n',
      head:'«'+top.name+'» — главный канал найма: '+top.value+' из '+hp.total,
      lede:'Наняли **'+pl(hp.total,PPL)+'**'+ago(c.lp,'hire')+' и ещё **'+hp.tin+'** перешли из других подразделений. '+
        /* ревью 100: доля джунов — та же, что в колонке «Джуны» (на настоящих — среди закрытых вакансий) */
        (D.REAL?'':'Джунов среди принятых — **'+hp.jun+'** ('+pc(hp.jun,hp.total)+'%).'),
      facts:ch.slice(0,3).map(x=>'«'+x.name+'» — **'+x.value+'**')};
  }
};

/* ===== T-рост ===== */
CH.tgrowth={
  flow(c){
    const cv=judge('tgrowth_conv',c), ps=pn(c.lp,'tgrowth_pass'), dn=pn(c.lp,'tgrowth_deny');
    const fo=focusRate(c,'tgrowth_conv','Конверсия по подразделениям');
    /* поставка 128: у команды меньше 30 человек вывод шага — в людях, как карточка «Отклонены заявки на рост» */
    const smD=D.isSmall()&&dn>0;
    return {sum:'конверсия '+f('tgrowth_conv',cv.v),st:cv.st,
      head:smD?U.plural(dn,['Отклонена','Отклонены','Отклонено'])+' '+dn+' '+U.plural(dn,['заявка','заявки','заявок'])+' на рост, одобрено — '+ps+
          (cv.thin?'; конверсию по стольким не оцениваем':'')
        :vsBase(cv,c,'Повышают чаще','Повышают реже','Конверсия T-роста — на уровне базы'),
      /* поставка 128 (аудит: «Одобрено 9, отклонено 2. Конверсия — 87,5%» — счёт по 12 октября, конверсия по сентябрь, 9 из 11 —
         это 81,8%): решения — за то же окно, что конверсия; до даты данных — отдельной фразой, с причиной */
      lede:D.PER_TEXT.replace(/^./,x=>x.toUpperCase())+' одобрено **'+D.perSum(c.lp,'tgrowth_pass')+'** '+U.plural(D.perSum(c.lp,'tgrowth_pass'),['заявка','заявки','заявок'])+
        ', отклонено **'+D.perSum(c.lp,'tgrowth_deny')+'** — конверсия '+valAt('tgrowth_conv',cv,c)+'.',
      focus:fo.focus,act:fo.act,ann:{tgrowth_conv:{hi:[cv.i]}}};
  },
  /* 27.10-в, п. 8: «Как растут по грейдам?» и «Как меняют специализацию?» — по описанию вкладки «Рост» дашборда HQ */
  grades(c){
    const p=D.rostProfile(c.lp), n=k=>(p.st.find(x=>x.key===k)||{n:0}).n;
    if(!p.hc)return {sum:'нет людей',st:'n'};
    return {sum:pl(n('done'),PPL)+' прошли рост',st:'n',
      head:'Рост прошли '+pc(n('done'),p.hc)+'% людей',
      /* поставка 128: окно названо — статусы и повышения за одно окно, январь–закрытый месяц */
      lede:D.PER_TEXT.replace(/^./,x=>x.toUpperCase())+' прошли рост **'+n('done')+'**, сейчас в росте — **'+(n('first')+n('again'))+'**, заявка отклонена у **'+n('denied')+
        '**, без заявки — **'+n('none')+'**. Повышений грейда в «Росте» — **'+p.grade.rost+'**, в T@T — **'+p.grade.tat+'**.'};
  },
  spec(c){
    const p=D.rostProfile(c.lp), s=p.spec, t=s.rostT[0];
    const ns=s.rost+s.tat;
    return {sum:ns?ns+' '+U.plural(ns,['смена','смены','смен'])+' специализации':'смен специализации нет',st:'n',
      head:ns?'Специализацию сменили по '+ns+' '+U.plural(ns,['заявке','заявкам','заявкам']):'Специализацию не меняли',
      lede:'В «Росте» — **'+s.rost+'**, в T@T — **'+s.tat+'**.'+(t?' Чаще всего просятся в «'+t.name+'»: '+t.apps+' '+
        U.plural(t.apps,['заявка','заявки','заявок'])+', отклонено — '+pc(t.no,t.apps)+'%.':'')};
  }
};

/* ===== Мониторинг работы ===== */
/* поставка 104: последняя ЗАКРЫТАЯ неделя (месяц) — незакрытая тоже в ряду, сравнивать её с полной нельзя */
function monStory(c,wk){
    const md=D.monData(c.lp);
    if(!md)return {sum:'нет данных',st:'n'};
    const W=wk&&md.weeks?md.weeks:md.months, ci=W.findIndex(p=>p.cl), i0=ci<0?W.length-1:ci, cur=W[i0], prev=W[i0-1]||cur;
    const pc1=v=>cur.hc?(Math.round(v/cur.hc*1000)/10).toFixed(1).replace('.',','):'0';
    /* поставка 120 (критик компании: «недоработка +7, переработка −11» — непонятно, чего): изменение — в людях */
    const du=cur.under-prev.under, dv=cur.over-prev.over, sg=v=>(v>0?'+':v<0?'−':'')+Math.abs(v)+' чел.';
    const worse=du>0||dv>0, both=du>0&&dv>0;
    /* поставка 90: главное — доли в среднем за месяц с января по закрытый месяц (как итог под графиком), месяц к месяцу — с подписью */
    /* шаг «По неделям» — главное о последней закрытой неделе; «По месяцам» — доли в среднем за месяц с января */
    const pu=per(c.lp,'underwork'), po=per(c.lp,'overwork'), pp=!(wk&&md.weeks)&&pu.v!=null&&po.v!=null;
    /* поставка 125: размечено меньше половины людей — у остальных «не размечено», и 0% там значит «нет данных»: так и пишем,
       доли — для справки, без оценки (D.monJudged) */
    const cov=D.monCover(c.lp);
    if(pp&&!D.monJudged('underwork',c.lp))return {sum:'размечено '+Math.round(cov*100)+'%',st:'n',
      head:'В мониторинге размечено '+Math.round(cov*100)+'% людей — недо- и переработку не оцениваем',
      lede:'У остальных нет записей мониторинга («не размечено»), поэтому 0% здесь значит «нет данных», а не «никто не недорабатывает». '+
        'Недоработчиков — **'+f('underwork',pu.v)+'** в среднем за период '+D.PER_NAME+'. Переработчиков — **'+f('overwork',po.v)+'**.'};
    /* поставка 128 (аудит L6: точка шага красная при нейтральном заголовке, у «0 и 0» — зелёная): точка — по вердикту долей к
       ориентиру (judge, как строка главной и карточки), а не по сдвигу к прошлому месяцу; заголовок говорит этот вердикт */
    const ju=judge('underwork',c), jo=judge('overwork',c), vd=pp&&!D.isSmall();
    const bU=vd&&ju.st==='bad', bO=vd&&jo.st==='bad', gU=vd&&ju.st==='good', gO=vd&&jo.st==='good';
    /* поставка 131 (владелец: «в инсайтах не смешивать в одном предложении несколько метрик»): заголовок — об одной доле (той, у
       которой вердикт; нет вердикта — о недоработке), вторая — своим предложением в тексте ниже; раньше — обе в одной фразе */
    const hU=bU||!bO&&(gU||!gO), hk=hU?'underwork':'overwork', ok=hU?'overwork':'underwork', hp=hU?pu:po, op=hU?po:pu;
    const hj=hU?ju:jo, oj=hU?jo:ju, NM={underwork:'Недоработчиков',overwork:'Переработчиков'};
    /* поставка 136, п. 8 и 10: одно сравнение у каждой доли — год (изменение от 10%, judge.yoy) или ориентир; среднее за
       несколько месяцев подписано «в среднем за период январь–сентябрь» */
    const AV=' в среднем за период '+D.PER_NAME;
    const cw=j=>!vd?null:j.yoy?(j.v>j.py?'больше':'меньше')+', чем год назад':j.st==='bad'?'больше, чем '+inRef(j,c):j.st==='good'?'меньше, чем '+inRef(j,c):null;
    const one=(k,p,j)=>{const w=cw(j);return w?NM[k]+' '+w+': '+f(k,p.v)+AV:NM[k]+' — '+f(k,p.v)+AV};
    /* с чем сравнена доля: год назад за тот же период или ориентир — одно */
    const rf=(k,j)=>!vd?'':j.yoy?'год назад за тот же период — **'+f(k,j.py)+'**'
      :j.base!=null&&!j.thin&&!j.self?(j.kpi?'цель':j.peer?'{{База|база}}':D.coName(c.S,'nom'))+' — **'+f(k,j.base)+'**':'';
    const capS=t=>t?t.charAt(0).toUpperCase()+t.slice(1):t;
    return {sum:pp?'недор. '+f('underwork',pu.v)+' · перераб. '+f('overwork',po.v):'недор. '+cur.under+' · перераб. '+cur.over,
      st:bU||bO?'bad':gU||gO?'good':'n',
      /* поставка 121 (критики 119: «недоработку и переработку смотрим в людях», а заголовок — в процентах и «0,2 чел»): у команды
         меньше 30 человек — последний закрытый месяц в людях */
      head:pp&&D.isSmall()?cur.full+': недорабатывали '+pl(cur.under,PPL)+' (месяцем раньше — '+prev.under+')'
        :pp?one(hk,hp,hj)
        :'Недоработка — '+cur.under+' чел ('+pc1(cur.under)+'%)',
      lede:pp&&D.isSmall()?'Перерабатывали **'+pl(cur.over,PPL)+'** (месяцем раньше — '+prev.over+').'
        :pp?(rf(hk,hj)?capS(rf(hk,hj))+'. ':'')+one(ok,op,oj).replace(f(ok,op.v),'**'+f(ok,op.v)+'**')+
          (rf(ok,oj)?' ('+rf(ok,oj).replace(/\*\*/g,'')+')':'')+'.'
        :'Переработка — **'+cur.over+' чел** ('+pc1(cur.over)+'%).'};
  }

CH.monitor={
  /* «Рабочая активность» (21.10, файл Антона): последняя закрытая неделя против прошлой */
  activity(c){return monStory(c,false)},
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
        ' в среднем за '+(D.DOW_MONTHS===2?mNom(D.PER_I-1)+' и '+MON1:D.DOW_MONTHS+' месяца')+'.'};
  },
  /* 22.10: «Кто и где ходит» — динамика, сегмент, локация; выбор сегмента и города — в c.S */
  attend(c){
    const S=c.S||{}, x=D.officeCross(c.lp,S.offSeg,S.offCity);
    const lbl=[x.seg?x.seg.name:'',x.city?x.city.name:''].filter(Boolean).join(' · ');
    if(lbl)return {sum:x.seg?lbl+' — '+f('office_att',x.att):lbl,st:'n',
      /* ревью 100: у города посещаемости нет — число в заголовке только у сегмента */
      /* файл 8, п. 5: с городом — посещаемость сегмента в офисах этого города (доля рабочих дней) */
      head:x.seg?'Посещаемость: '+x.seg.name+(x.city?' в офисах «'+x.city.name+'»':'')+' — '+f('office_att',x.att):'Город офиса: '+x.city.name,
      lede:'Значение — за '+MON1+'; по всему отбору '+PT+' — **'+f('office_att',per(c.lp,'office_att').v)+'**. Снять выбор — Escape.'};
    /* поставка 110 (A6): группа меньше 3 человек в рассказ не идёт — «Руководители ходят реже» про одного человека (часто читателя) */
    const segs=x.segs.filter(s=>s.hc>=3), cs=x.cities.filter(r=>r.hc>=3);
    const v=judge('office_att',c), ya=yearAgo(c.lp,'office_att');
    const fo=focusRate(c,'office_att','Посещаемость по подразделениям');
    const sg=segs.length>1?segs.slice().sort((a,b)=>b.att-a.att):null, cb=cs.length>1?cs.slice().sort((a,b)=>b.att-a.att):null;
    return {sum:f('office_att',v.v),st:v.st,
      head:vsBase(v,c,'В офис ходят чаще','В офис ходят реже','Посещаемость — на уровне базы')+
        /* поставка 136, п. 10: числа в заголовке — того же сравнения, что слова: год назад или ориентир */
        (v.yoy?': '+f('office_att',v.v)+' против '+f('office_att',v.py):v.base!=null&&!v.small&&!v.thin&&!v.self?': '+f('office_att',v.v)+' против '+f('office_att',v.base):''),
      /* одно предложение — одна группа сравнения: сегменты за закрытый месяц, затем города */
      lede:[sg?'За '+MON1+': «'+sg[0].name+'» — **'+f('office_att',sg[0].att)+'**, «'+sg[sg.length-1].name+'» — **'+f('office_att',sg[sg.length-1].att)+'**.':'',
        cb?'Чаще всего ходят в офисы города «'+cb[0].name+'» — **'+f('office_att',cb[0].att)+'**.':''].filter(Boolean).join(' ')||
        'Посещаемость '+PT+' — **'+f('office_att',v.v)+'**.',
      focus:fo.focus,act:fo.act,ann:{office_att:{hi:[D.PER_I]}}};
  }
};

/* ===== AI-инструменты ===== */
CH.ai={
  /* поставка 106: только недели — последняя полная неделя против четырёх неделями раньше; без сравнения с базой (у AI
     нет месячного ряда, фильтры среза на него не действуют) */
  adoption(c){
    const W=D.aiWeeks(c.lp), cw=D.aiCur(W);
    if(!cw)return {sum:'нет данных',st:'n',head:'Статистики AI-инструментов нет',lede:''};
    /* поставка 110 (A7, C9, критики 07.11): сравнение — с началом окна графика, а не с удобной точкой четыре недели назад
       («+1 п.п. за 4 недели» при −2,8 п.п. за 16); сдвиг меньше 2 человек — «почти без изменений»; в команде меньше 30
       человек — в людях, без процентов */
    const i=W.indexOf(cw), w0=W[0], nw=i, d=w0!==cw?Math.round((cw.pen-w0.pen)*10)/10:null, dn=w0!==cw?cw.wau-w0.wau:null;
    const P=v=>String(v).replace('.',',')+'%', sm=cw.hc<D.SMALL_N, flat=d==null||Math.abs(d)<1||Math.abs(dn)<2;
    const per=' за '+nw+' '+U.plural(nw,['неделю','недели','недель']);
    /* поставка 118: база — подразделения похожей численности (без стажёров, та же неделя); меньше 30 человек — без неё */
    const pe=sm?null:D.peerOf('ai_penetration',c.lp), ps=pe?D.peerState('ai_penetration',cw.pen,pe,c.lp):'neutral';
    const vb=ps==='good'?' — больше, чем в {{База|базе}}':ps==='bad'?' — меньше, чем в {{База|базе}}':'';
    return {sum:sm?D.fmtInt(cw.wau)+' из '+D.fmtInt(cw.hc):P(cw.pen),st:ps==='good'?'good':ps==='bad'?'bad':'n',
      head:(sm?'AI пользуются '+D.fmtInt(cw.wau)+' из '+pl(cw.hc,PPL):'AI пользуются '+P(cw.pen)+' сотрудников')+vb+
        (d==null?'':flat?(vb?';':' —')+per+' почти без изменений':
        sm?' —'+per+' на '+pl(Math.abs(dn),PPL)+' '+(dn>0?'больше':'меньше'):
        (vb?';':' —')+per+' на '+P(Math.abs(d)).replace('%',' п.п.')+' '+(d>0?'больше':'меньше')),
      lede:'За неделю '+cw.full.replace(/^Неделя /,'')+' — **'+D.fmtInt(cw.wau)+'** активных пользователей из **'+D.fmtInt(cw.hc)+
        '** без стажёров'+(pe?' (**'+P(cw.pen)+'**, {{База|база}} — '+f('ai_penetration',pe.p50)+')':'')+'.'+
        (w0!==cw?' В начале окна, '+w0.full.replace(/^Неделя /,'')+', — **'+D.fmtInt(w0.wau)+'**'+(sm?'':' (**'+P(w0.pen)+'**)')+'.':'')};
  },
  /* поставка 112: «Кто пользуется» — какая группа отстаёт или опережает: доля с AI группы против общей, группа от
     10 человек и разница от 10 п.п.; меньше 30 человек в отчёте — в людях, без сравнения групп */
  /* поставка 116: числа — те же, что в таблицах шага: вся численность (сотрудники и стажёры) и разбивки из сочетаний
     (D.aiCross без выбора). Без сочетаний (ноутбук до 113-б) — разрезы ноутбука без стажёров, так и сказано */
  who(c){
    /* поставка 138, п. 13: «Кто пользуется?» — сотрудники без стажёров (сочетания it|0); стажёры — своя глава */
    const u=D.aiUsage(c.lp), x0=D.aiCross(c.lp,['it|0']);
    /* поставка 128 (аудит: строка выбрана — таблицы шага по выбранной группе, а заголовок — по всем): с выбором вывод — по выбранной
       группе, группы — из таблиц, где выбора нет (в таблице с выбором её строки — сама выбранная группа) */
    const sl=((c.S&&c.S.aiSel)||[]).filter(v=>!/^it\|/.test(v)), xs=x0&&sl.length?D.aiCross(c.lp,['it|0'].concat(sl)):null, inS=!!(xs&&sl.length);
    /* поставка 138, п. 11: без грейдов */
    const segs=(inS?xs.dims.filter(d=>d.key!=='it'&&!d.rows.some(r=>r.on)):x0?x0.dims.filter(d=>d.key!=='it'):(u.segs||[])).filter(d=>d.key!=='g');
    const emp=inS?{hc:xs.hc,act:xs.act}:x0?{hc:x0.hc,act:x0.act}:segs.length?segs[0].rows.reduce((a,x)=>({hc:a.hc+x.hc,act:a.act+x.act}),{hc:0,act:0}):null;
    if(inS&&!emp.hc)return {sum:'нет людей',st:'n',head:'В выбранной группе никого нет',lede:'Снимите выбор в таблицах ниже — повторный клик по строке.'};
    if(!emp||!emp.hc)return {sum:'нет данных',st:'n',head:'Данных по группам нет',lede:''};
    /* проценты — тем же форматом, что в таблицах шага («53,0%») */
    const P=v=>f('ai_penetration',v), pen=emp.act*100/emp.hc;
    const itl='';
    if(emp.hc<D.SMALL_N)return {sum:D.fmtInt(emp.act)+' из '+D.fmtInt(emp.hc),st:'n',
      head:(inS?'В выбранной группе AI пользуются ':'AI пользуются ')+D.fmtInt(emp.act)+' из '+pl(emp.hc,PPL),
      lede:(inS?'Выбранная группа':'Сотрудники без стажёров.')+(inS?' меньше ':' В команде меньше ')+D.SMALL_N+
        ' человек — группы между собой не сравниваем: ниже видно, кто именно.'+itl};
    const cand=[];
    /* имя группы с разрезом: «грейд 15», «стаж до 1 года», остальные — как есть */
    const lbl=(k,n)=>k==='t'?'стаж «'+n+'»':'«'+n+'»';
    /* специализаций в таблице — первые 10 по людям: группу, которой не видно, не называем */
    segs.forEach(sg=>(sg.key==='sp'?sg.rows.slice().sort((a,b)=>b.hc-a.hc).slice(0,10):sg.rows).forEach(x=>{if(x.hc>=10&&!/^Не указано$/.test(x.name)&&Math.abs(x.pen-pen)>=10)cand.push(Object.assign({lb:lbl(sg.key,x.name)},x))}));
    const lag=cand.filter(x=>x.pen<pen).sort((a,b)=>(a.pen-pen)*Math.sqrt(a.hc)-(b.pen-pen)*Math.sqrt(b.hc))[0],
      lead=cand.filter(x=>x.pen>pen).sort((a,b)=>(b.pen-pen)*Math.sqrt(b.hc)-(a.pen-pen)*Math.sqrt(a.hc))[0];
    const say=x=>x.lb+' — **'+P(x.pen)+'** ('+D.fmtInt(x.act)+' из '+D.fmtInt(x.hc)+')';
    const inW=inS?' по группе':' в целом', pre=inS?'В выбранной группе ':'';
    return {sum:lag?'отстают: '+lag.lb:lead?'впереди: '+lead.lb:'группы на одном уровне',st:'n',
      head:lag?pre+(inS?'реже':'Реже')+' всего AI пользуются '+lag.lb+': '+P(lag.pen)+' при '+P(pen)+inW
        :lead?pre+(inS?'чаще':'Чаще')+' всего AI пользуются '+lead.lb+': '+P(lead.pen)+' при '+P(pen)+inW
        :(inS?'В выбранной группе во всех заметных':'Во всех заметных')+' группах AI пользуются примерно одинаково — около '+P(pen),
      lede:(inS?'Выбранная группа — **':'Сотрудники без стажёров — **')+P(pen)+'** ('+D.fmtInt(emp.act)+' из '+D.fmtInt(emp.hc)+').'+
        (lead?' Чаще всего — '+say(lead)+'.':'')+(lag?' Реже всего — '+say(lag)+'.':'')+itl};
  },
  /* поставка 138, п. 13: стажёры — своя глава: доля с AI у стажёров (признак витрины); меньше 3 — в людях */
  interns(c){
    const it=D.aiUsage(c.lp).intern||{hc:0,act:0};
    if(!it.hc)return {sum:'стажёров нет',st:'n',head:'Стажёров в подразделении нет',lede:''};
    const P=v=>f('ai_penetration',v), pen=it.act*100/it.hc, few=it.hc<D.SMALL_N;
    return {sum:few?D.fmtInt(it.act)+' из '+D.fmtInt(it.hc):P(pen),st:'n',
      head:few?'AI пользуются '+D.fmtInt(it.act)+' из '+pl(it.hc,['стажёра','стажёров','стажёров']):'AI пользуются '+P(pen)+' стажёров',
      lede:'Стажёров **'+D.fmtInt(it.hc)+'**, активных пользователей AI среди них — **'+D.fmtInt(it.act)+'**.'+
        (few?' Стажёров меньше '+D.SMALL_N+' — долю не сравниваем.':'')};
  },
  usage(c){
    const u=D.aiUsage(c.lp), t=u.tools[0];
    if(!t)return {sum:'нет данных',st:'n'};
    const act=u.freq.reduce((a,x)=>a+x.value,0), often=u.freq.slice(4).reduce((a,x)=>a+x.value,0);
    return {sum:'лидер — «'+t.name+'»',st:'n',
      head:'«'+t.name+'» — самый популярный инструмент: '+f('ai_penetration',t.value)+' сотрудников ('+D.fmtInt(t.n)+' чел.)',
      lede:'Пять дней в неделю и чаще AI пользуются **'+D.fmtInt(often)+'** из **'+D.fmtInt(act)+'** активных пользователей.'};
  },
  /* 07.11 (AI-итерация, п. 5): «Что делают?» — сообщения инструментам разработчика */
  what(c){
    /* поставка 128 (аудит L2: «73%» в заголовке, «73,4%» на полосе ниже): доля — тем же форматом, что полоса (одна десятая) */
    const u=D.aiUsage(c.lp), p=u.msgs?(Math.round(u.cls/u.msgs*1000)/10).toFixed(1).replace('.',','):null;
    const top=u.dev.reduce((a,d)=>a.concat(d.tasks),[]).sort((a,b)=>b.value-a.value)[0];
    if(!u.msgs)return {sum:'нет сообщений',st:'n',head:'Сообщений инструментам разработчика за неделю нет',lede:''};
    return {sum:p+'% классифицированы',st:'n',
      head:top?'Чаще всего инструменты разработчика используют для задачи «'+top.name+'»':'Классифицировано '+p+'% сообщений инструментам разработчика',
      lede:'Всего **'+D.fmtInt(u.msgs)+'** сообщений, из них классифицировано **'+D.fmtInt(u.cls)+'** ('+p+'%).'};
  }
};

/* ===== Структура численности ===== */
function mixTop(lp,dk){
  const dim=D.MIX_BY_KEY[dk], cats=D.mixCats(dk), parts=D.mixParts(lp,dk), tot=sum(parts);
  if(!tot)return null;
  const i=argmax(parts);
  return Object.assign({dim:dim,name:cats[i].name,share:pc(parts[i],tot),n:parts[i],tot:tot},tieOf(parts,i,j=>cats[j].name));
}
/* поставка 110 (E10): ничья — не лидер. q — «A» и «B», top(x, ч) — «больше всего — «A» (43%)» или «поровну «A» и «B» (по 43%)» */
function tieOf(v,i,name){
  const ix=v.map((x,j)=>x===v[i]?j:-1).filter(j=>j>=0), qs=ix.map(j=>'«'+name(j)+'»');
  return {tie:ix.length>1,q:qs.length>1?qs.slice(0,-1).join(', ')+' и '+qs[qs.length-1]:qs[0]};
}
const topSay=(x,lead)=>x.tie?'поровну '+x.q+' (**по '+x.share+'%**)':lead+' «'+x.name+'» (**'+x.share+'%**)';
CH.structure={};
D.MIX_GROUPS.forEach(g=>{
  CH.structure[g.key]=function(c){
    const tops=g.dims.map(dk=>mixTop(c.lp,dk)).filter(Boolean);
    if(!tops.length)return {sum:'нет людей',st:'n'};
    const t=tops[0];
    return {sum:t.tie?'поровну '+t.q:'«'+t.name+'» — '+t.share+'%',st:'n',
      head:t.tie?'Поровну '+t.q+': по '+t.share+'% людей':'«'+t.name+'» — самая большая группа: '+t.share+'% людей',
      lede:'Всего в команде **'+pl(t.tot,PPL)+'**. '+tops.slice(1).map(x=>x.dim.name+': '+topSay(x,'больше всего —')).join('; ')+
        (tops.length>1?'.':'')};
  };
});
CH.structure.custom=function(){return {sum:'два измерения',st:'n'}};
/* «Уровень позиции» (21.10): сеньорность, грейд, стаж — самая большая группа каждого */
CH.structure.level=function(c){
  const sel=c.S.mixSel||[], parts=D.sliceParse(sel);
  const tops=['seniority','grade','tenure'].filter(k=>D.MIX_BY_KEY[k]&&!parts.some(p=>p.dim.key===k)).map(k=>{
    const v=D.mixParts(c.lp,k,sel), i=argmax(v);
    return Object.assign({dim:D.MIX_BY_KEY[k],name:D.mixCats(k)[i].name,share:pc(v[i],sum(v)),tot:sum(v)},tieOf(v,i,j=>D.mixCats(k)[j].name));
  }).filter(t=>t.tot);
  if(!tops.length)return {sum:'нет людей',st:'n'};
  const t=tops[0];
  return {sum:t.tie?'поровну '+t.q:'«'+t.name+'» — '+t.share+'%',st:'n',
    head:t.tie?'Поровну '+t.q+': по '+t.share+'% команды':'Больше всего — «'+t.name+'»: '+t.share+'% команды',
    lede:tops.slice(1).map(x=>x.dim.name+': '+topSay(x,'чаще всего —')).join('; ')+(tops.length>1?'.':'')};
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
CH.structure.portrait=function(c){
  const sel=c.S.mixSel||[], P=k=>D.mixParts(c.lp,k,sel), B=k=>D.mixParts(c.bl,k,sel);
  /* Разрез, по которому взят срез, своей таблицей срез не режет (правило
     перекрёстной фильтрации) — поэтому в рассказе он не «самый частый», а
     просто тот, что выбран, и доли по нему не называются: в срезе они 100%. */
  const parts=D.sliceParse(sel), inSel=k=>parts.find(p=>p.dim.key===k||(k==='stream'&&p.dim.key==='spec'));
  /* поставка 128 (аудит: портрет «7 человек · Junior», а шаг «Уровень» — «поровну Junior и Senior»): ничья — не лидер (tieOf) */
  const mode=k=>{const q=inSel(k);if(q)return {cat:q.cat,fixed:true};
    const p=P(k), i=argmax(p);return Object.assign({cat:D.mixCats(k)[i],n:p[i],share:pc(p[i],sum(p))},tieOf(p,i,j=>D.mixCats(k)[j].name))};
  const tk=['gender','age','tenure','seniority','grade'].find(k=>!inSel(k));
  const tot=tk?sum(P(tk)):0;
  if(!tot)return {sum:'нет людей',st:'n'};
  const sn=mode('seniority'), ag=mode('age'), tn=mode('tenure');
  const tree=D.mixTree(c.lp,'stream',sel).slice().sort((a,b)=>b.value-a.value);
  const stQ=inSel('stream'), top=stQ&&stQ.dim.key==='stream'?tree.find(n=>n.cat.id===stQ.cat.id)||tree[0]:tree[0];
  const stTie=!stQ&&tree.length>1&&tree[1].value===tree[0].value?tieOf(tree.map(n=>n.value),0,j=>tree[j].cat.name):null;
  /* «меньше года» — все группы стажа до года: в настоящих данных их три (менее 3 мес,
     3–6 мес, 6–12 мес, 19.10), а не одна первая */
  const early=D.mixCats('tenure').map(c=>D.bound(c.name,'mon')<12), e=a=>sum(a.filter((_,i)=>early[i]));
  const ten=P('tenure'), tenB=B('tenure'), n0=pc(e(ten),sum(ten)), b0=pc(e(tenB),sum(tenB));
  const devs=profDevs(c,inSel), big=devs[0]&&Math.abs(devs[0].d)>=5?devs[0]:null;
  /* поставка 117: состав сравнивается со всей компанией (с фильтрами шапки), это не «база» */
  const cmp=x=>'«'+x.cat.name+'» — **'+pp(x.t)+'** против '+pp(x.b)+' во '+D.coName(c.S,'prep');
  const role=stQ&&stQ.dim.key==='spec'?'«'+stQ.cat.name+'»':stTie?'стрим — поровну '+stTie.q:roleOf(top.cat);
  const senW=sn.tie?'поровну '+sn.q:senOf(sn.cat), ageW=ag.tie?'возраст — поровну '+ag.q:ageOf(ag.cat), tenW=tn.tie?'стаж — поровну '+tn.q:tenOf(tn.cat);
  const who=!sn.tie&&!stTie&&SEN[sn.cat.key]&&ROLE[top.cat.key]?SEN[sn.cat.key]+'-'+role+' '+ageW+', '+tenW
    :senW+', '+role+', '+ageW+', '+tenW;
  const lede=[stQ?null:stTie?'стримы поровну: '+stTie.q:'**'+pc(top.value,tot)+'%** — «'+top.cat.name+'»',
    sn.fixed?null:sn.tie?'поровну '+sn.q+' (**по '+sn.share+'%**)':'**'+sn.share+'%** — '+senOf(sn.cat),
    tn.fixed?null:'**'+n0+'%** — меньше года в компании'].filter(Boolean);
  /* поставка 128 (аудит): сравнение состава со всей компанией — не у самой компании («похожа на всю компанию») и не у команды
     меньше 30 человек (вывод блока: «доли не оцениваем»); уровень, стаж и стримы — на своих шагах, так и сказано */
  const cmpOk=!D.isSelfBase()&&!D.isSmall();
  return {sum:pl(tot,PPL)+' · '+(sn.tie?'поровну '+sn.q:senOf(sn.cat)),st:'n',
    /* поставка 121 (критики 119: «типичный человек» склеен из самых частых признаков — такого человека может и не быть) */
    head:parts.length?'В срезе «'+D.sliceLabel(sel)+'» чаще всего: '+who:'Чаще всего в команде: '+who,
    lede:'**'+pl(tot,PPL)+'**'+(parts.length?' в срезе':'')+(lede.length?': '+lede.join(', '):'')+'. '+
      (!cmpOk?'':big?'Сильнее всего от '+D.coName(c.S,'gen')+' отличается '+big.dim.short.toLowerCase()+': '+cmp(big)+'. '
          :'По составу команда похожа на '+D.coName(c.S,'acc')+': нигде расхождение не доходит до 5 п.п. ')+
      'Уровень и стаж — на шаге «Уровень позиции», стримы — на шаге «Стримы».'};
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
    head:'В штате '+st.t+'% команды',
    /* поставка 128: со всей компанией — не у неё самой и не у малой команды */
    lede:'**'+pl(st.n,PPL)+'**'+(parts.length?' в срезе':'')+'. Штат — **'+st.t+'%**'+(D.isSelfBase()||D.isSmall()?''
      :Math.abs(st.t-st.b)>=5?' при '+st.b+'% во '+D.coName(c.S,'prep'):', как во '+D.coName(c.S,'prep'))+'.'+
      (fm?' Самый частый формат работы — **'+fm.name.toLowerCase()+'**.':'')};
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
  'Текучесть':{text:'Какая доля команды уволилась за месяц.\n• Считаем: отток ÷ средняя численность × 100%\n'+
    '• Учитывает размер команды, поэтому её можно сравнивать с другими командами и с базой'},
  'Текучесть накопительная':{metric:'turnover_y'},
  'Средняя численность':{text:'Среднее между активной численностью на конец прошлого и этого месяца. На неё делим отток, когда считаем текучесть.'},
  'Активная численность':{metric:'hc_active'},
  'База':{text:D.BASE_DEF},
  'Нежелательный уход':{text:'Уход, о котором компания сожалеет. В причинах отмечен ★.\nПо методологии HR это сотрудник, который:\n'+
    '• ушёл сам, не из-за релокации\n• проработал от 12 месяцев\n• MLTIIP, грейд 15+ с оценкой от 2 или оценка от 3'},
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
  'Посещаемость офиса':{metric:'office_att'},
  'Проникновение AI':{metric:'ai_penetration'},
  'WAU':{metric:'ai_wau'}
};
/* поставка 103 (файл 9, п. 10): термины раздела «Как уходит HQ?» — определения метрик без фраз о целях */
/* поставка 128 (владелец 08.11: цели HQ обязательны): определения — вместе с целями, как у остальных метрик */
Object.assign(GL,{'Текучесть HQ':{metric:'turnover_y'},'Желательная HQ':{metric:'nonregret'},
  'Нежелательная HQ':{metric:'regret'}});
function glossary(term){
  const g=GL[term];
  if(!g)return null;
  if(g.noGoal){const m=D.METRIC_BY_KEY[g.metric]||{}, t=(m.hint||'')+(m.calc?'\n'+m.calc:'');
    return t?(String(t).match(/[^.]+(?:\.|$)\s*/g)||[]).filter(x=>!/[Цц]ел[ьиея]/.test(x)).join('').trim():null}
  const dm=g.dim?(D.MIX_BY_KEY[g.dim]||{}):null;
  const gm=g.metric?(D.METRIC_BY_KEY[g.metric]||{}):null;
  const base=gm?(gm.hint||'')+(gm.calc?'\n'+gm.calc:''):dm?(dm.hint||dm.tip||''):g.text;
  if(!base)return null;
  return String(base||'')+(g.add||'');
}
const WHY={
  structure:{
    portrait:['Кто в команде: пол, возраст и регион.',
      'Сильный перекос по возрасту или региону против компании — учтите его в планах найма и удержания.'],
    level:['На каком уровне люди: {{Сеньорность|сеньорность}}, {{Грейд|грейд}} и стаж в компании.',
      'Много младших при немногих опытных — нагрузка на наставников; проверьте баланс уровней в команде.'],
    /* формата работы нет в данных пробника (схема 15.10) — тогда и про гибрид молчим */
    work:['В какой компании оформлены люди, на каком типе занятости и в каком формате работают.',
      'Много не штата — проверьте, не держатся ли на нём ключевые роли.'],
    stream:['Из каких {{Стрим|стримов}} состоит команда и где её основная экспертиза.',
      'Стрим из одного-двух человек — точка отказа: с их уходом уйдёт и экспертиза.'],
    /* поставка 121 (критики 119: клетки-оценки читались как точный подсчёт): на живых данных — клетки прикидка */
    custom:()=>['Любые два измерения в одной таблице — например, {{Сеньорность|сеньорность}} × пол или грейд × стаж.',
      D.REAL?'Клетки (курсивом) — прикидка по долям подразделений, точны только итоги строк и колонок: смотрите, какие сочетания есть, а не точное число людей.'
        :'Ищите клетки, где людей неожиданно много или мало, — например, младшие без опытных коллег рядом.']},
  movement:{
    balance:['{{Водопад}} раскладывает изменение численности на найм, отток и переводы: видно, что сдвинуло команду.',
      'Если команда уменьшилась за счёт оттока, а не по плану, — откройте «Отток и текучесть».'],
    dynamics:['По месяцам видно, какой поток и когда двигал численность.',
      'Месяц, где отток выше найма, — сверьте с причинами ухода в «Отток и текучесть».']},
  turnover:{
    /* поставка 138, п. 9: на вкладке — только накопительная текучесть (месячная — на One Pager) */
    dynamics:['{{Текучесть накопительная}} — доля команды, ушедшая с 1 января: темп ухода с поправкой на размер команды. Её и сравнивают с {{База|базой}}.',
      'Всплеск в одном месяце — разберите уходы этого месяца: кто ушёл и почему. Текучесть выше, чем год назад, — повод поговорить с руководителями.'],
    reasons:['Причины показывают, на что можно повлиять: у каждой — сколько уходов {{Нежелательный уход|нежелательные}}.',
      'Начните с причины, где больше всего нежелательных уходов: оплата, рост или руководитель.'],
    who:['Стаж, {{Грейд|грейд}} и стрим ушедших показывают, кого именно теряем.',
      'Много уходов в первый год — вопрос найма и адаптации. Уходят опытные — вопрос роста и вознаграждения.'],
    /* 26.10, правки: светофор HQ */
    /* поставка 103 (файл 9, п. 10): без целей — факт и сравнение с прошлым годом */
    hq:['Как уходит HQ: {{Текучесть HQ|текучесть}}, {{Желательная HQ|желательная}} и {{Нежелательная HQ|нежелательная}} '+
      'с начала года против целей HQ и прошлого года — всегда по активной численности HQ.',
      'Нежелательная выше цели или растёт к прошлому году — разберите причины с нежелательными уходами в «Почему уходят?». '+
      'Желательная ниже цели — проверьте, с кем по итогам оценки пора расстаться.']},
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
    grades:['Кто с начала года прошёл рост, кто сейчас в процессе, у кого заявок нет — по текущему грейду; повышения — по потокам «Рост» и T@T.',
      'Высокая доля отклонённых заявок на грейде — разберите заявки с руководителями. Много людей без заявок за год — обсудите планы роста.'],
    spec:['Смена специализации — рост вбок: сколько заявок закрыто успешно и куда люди хотят перейти.',
      'Высокая доля отклонённых заявок по специализации — проверьте требования к переходу и поддержку при смене роли.']},
  monitor:{
    /* поставка 136, п. 9 (владелец: «пояснение перечисляет данные, но не говорит, зачем смотреть»): практическая цель —
       следить за нагрузкой; не оценка эффективности; покрытие — см. строку над графиками */
    activity:['Следите за нагрузкой команды: мониторинг помогает заметить признаки {{Недоработчики|недоработки}} и {{Переработчики|переработки}}. '+
      'Это повод для разговора, а не оценка работы человека. Учитывайте покрытие: данные есть не по всем сотрудникам — сколько размечено, сказано над графиками.',
      'Переработка держится несколько месяцев — проверьте нагрузку и отпуска. Растёт недоработка в одной команде — обсудите с её руководителем загрузку и задачи.'],
    review:['Итоги последнего {{Ревью|ревью}}: у кого оценка выросла, у кого упала.',
      'Ухудшивших больше, чем улучшивших, — проверьте нагрузку и цели в этих группах.']},
  office:{
    calendar:['В какие дни офис заполнен, а в какие пустует. От этого зависят командные дни и аренда.',
      'Пустые дни — кандидаты на общий «офисный день» команды.'],
    /* поставка 136, п. 18 (владелец: «пояснение перечисляет разрезы, но не объясняет пользу»): зачем смотреть посещаемость */
    attend:['Смотрите, какие команды и в каких городах ходят в офис: так видно, насколько востребованы офисы, и проще планировать рабочие места. '+
      'Это не оценка работы сотрудников.',
      'Город или команда ходят заметно реже — сверьте с правилами гибрида и числом мест.']},
  ai:{
    adoption:['{{Проникновение AI|Проникновение}} — какая доля людей пользуется AI каждую неделю, {{WAU}} — сколько это человек.',
      'Отстающие подразделения — кандидаты на обучение и пилоты.'],
    /* поставка 128 (аудит: «клик по строке» там, где строки не кликаются — без сочетаний, например у всей компании) */
    who:c=>['Кто пользуется AI среди сотрудников без стажёров: сверху — общая доля, ниже — по группам.'+
        (c&&c.lp&&D.aiCross(c.lp,[])?' Клик по строке — остальные таблицы только по этой группе.':''),
      'Группа заметно отстаёт — спросите, что мешает: доступ, задачи, обучение.'],
    interns:['Как используют AI стажёры: доля с AI, группы, частота и инструменты — только стажёры.',
      'Стажёры отстают — добавьте AI в онбординг.'],
    usage:['Как часто и чем пользуются AI: дни в неделю, инструментов на человека, топ инструментов и инструменты по покраске.',
      'Пользуются редко — покажите команде задачи, где AI экономит время.'],
    what:['Что делают в AI: сколько сообщений инструментам разработчика классифицировано и по каким задачам.',
      'Много неклассифицированных — уточните классификатор задач; задачи-лидеры — кандидаты на шаблоны и обучение.']}
};

/* ---------- сборка книги блока ----------
   c: {S, lp, bl, sel, bench}; subTabs — список глав блока; demo(sub) — правда,
   если глава в пробнике демо. Возвращает шаги степпера, текущую главу и
   следующую. Ошибка в одной главе не роняет экран: глава остаётся без вывода. */
/* поставка 121 (критик на 7 человек: советы написаны для большого подразделения — «поговорить с руководителями», «отстающие
   подразделения»): у команды меньше 30 человек без подразделений ниже — советы самому руководителю */
/* поставка 128 (аудит L5: «Уходов больше, чем год назад…» у команды, где уходов меньше; «Заявку отклонили…» без отказов): совет
   руководителю малой команды — только когда его условие правда (функция c → текст или null; null — общий совет шага) */
const nP=(c,k)=>Math.round((per(c.lp,k)||{}).v||0), nPv=(c,k)=>{const p=(per(c.lp,k)||{}).pv;return p==null?null:Math.round(p)};
const TODO_LEAF={
  turnover:{dynamics:c=>{const a=nP(c,'attrition'), pa=nPv(c,'attrition');return !a?null:pa!=null&&a>pa?
      'Уходов больше, чем год назад, — поговорите один на один с теми, кто остался: что держит в команде и что может увести.'
      :'Поговорите один на один с теми, кто остался: что держит в команде и что может увести.'},
    reasons:c=>nP(c,'attrition')?'Посмотрите, на какие причины вы могли повлиять — оплата, рост, нагрузка, — и с кем из оставшихся об этом стоит поговорить.':null,
    who:c=>{const ex=D.exitProfile(c.lp,'ytd'), lt=ex.tenure[ex.tenure.length-1];return lt&&!lt.early&&lt.value>0?
      'Ушли опытные — договоритесь, кто подхватит их экспертизу, и закрепите наставника за каждым новичком.':null}},
  hiring:{profile:c=>{const h=nP(c,'hire'), hc=D.lastVal(c.lp,'hc_total')||0;return h>=3||hc&&h/hc>=0.2?
    'Много новичков — закрепите за каждым наставника на первые три месяца.':null}},
  tgrowth:{flow:c=>nP(c,'tgrowth_deny')?'Заявку отклонили — обсудите с сотрудником план роста: отказ без плана — частый предвестник ухода.':null,
    grades:c=>{const p=D.rostProfile(c.lp), n=(p.st.find(x=>x.key==='none')||{n:0}).n;return n?
      'Обсудите планы роста с теми, у кого заявок не было, — особенно с опытными.':null}},
  monitor:{activity:'Недоработка или переработка у одного человека несколько месяцев подряд — повод поговорить один на один.'},
  ai:{adoption:c=>{const cw=D.aiCur(D.aiWeeks(c.lp));return cw&&cw.wau<cw.hc?'Кто не пользуется AI — спросите, что мешает: доступ, задачи, обучение.':null}}};
function book(bk,subTabs,cur,c,demo){
  const defs=CH[bk]||{}, q=Q[bk]||{}, leaf=D.isSmall()&&!!c&&!!c.S&&!D.rowsOf(c.S.unit).length;
  /* поставка 128 (аудит L6): выводы главной (карточки) — один раз на книгу: по ним точки шагов без своего вердикта, и главы
     называют то, о чём эти выводы (c.cards) */
  const I=window.TPINSIGHTS, map=CH_CARDS[bk];
  let cs=null;
  if(map&&c&&c.S&&c.lp&&I&&I.cards&&!demo){try{cs=I.cards(c.S,c.lp,c.bl||D.benchmarkLeaves(c.S),true,(I.TAB_SKIP||{})[bk]).filter(x=>x.block===bk)}catch(e){cs=null}}
  const cx=cs?Object.assign({},c,{cards:cs}):c;
  const chapters=subTabs.map(([key,name])=>{
    let s={};
    if(!(demo&&demo(key))&&defs[key]){try{s=defs[key](cx)||{}}catch(e){s={}}}
    const w0=(WHY[bk]||{})[key], w=typeof w0==='function'?w0(c):w0, l0=leaf&&(TODO_LEAF[bk]||{})[key];
    let lt=null;if(l0){try{lt=typeof l0==='function'?l0(cx):l0}catch(e){lt=null}}
    return Object.assign({key:key,name:name,q:q[key]||name,qs:(QS[bk]||{})[key]||q[key]||name,st:'n',why:w?w[0]:null,todo:lt||(w?w[1]:null)},s);
  });
  /* поставка 128 (аудит L6: «на уровне базы, но хуже, чем год назад» — точка шага серая, а вывод блока «Посмотреть»; у малой
     команды «ушли 4 из 7» — «Требует действий», а точка серая): без своего вердикта (цель, база) точка шага берёт тяжесть
     выводов этого блока о метриках шага — тех, что глава называет: high — красная, mid — жёлтая, только хорошие — зелёная */
  if(cs)chapters.forEach(ch=>{const f=map[ch.key];if(!f)return;
    const my=cs.filter(f);
    /* ухудшение несколько месяцев подряд (вывод «тренд») глава называет сама — в конце заголовка */
    my.filter(x=>x.fact.kind==='trend'&&x.fact.tr&&ch.head&&!/подряд/.test(ch.head)).forEach(x=>{const m=D.METRIC_BY_KEY[x.key], fv=v=>D.fmtVal(x.key,v);
      ch.facts=[m.name+': '+I.OBS.trend+' '+U.plural(I.OBS.trend,['месяц','месяца','месяцев'])+
        ' подряд хуже — **'+fv(x.fact.tr.a)+' → '+fv(x.fact.tr.b)+'**'].concat(ch.facts||[])});
    if(ch.st&&ch.st!=='n')return;
    if(my.some(x=>x.sev==='high'))ch.st='bad';else if(my.some(x=>x.sev==='mid'))ch.st='warn';else if(my.length)ch.st='good'});
  const i=Math.max(0,chapters.findIndex(x=>x.key===cur));
  return {chapters:chapters,cur:chapters[i],idx:i,next:chapters[i+1]||null};
}
/* выводы, о которых говорит глава шага: метрика и вид вывода (yoy — к прошлому году, в том числе «на уровне, но …»; ppl —
   в людях у малых групп; vac — открытые вакансии к году). Вне списка — выводы «где» и тренды: глава о них не говорит */
const kk=(re,kinds)=>x=>re.test(x.key)&&kinds.test(x.fact.kind);
const CH_CARDS={
  turnover:{dynamics:x=>kk(/^(turnover_y|attrition)$/,/^(yoy|ppl)$/)(x)||kk(/^turnover_y$/,/^trend$/)(x),
    reasons:kk(/^(regret|nonregret)$/,/^(yoy|ppl|trend)$/)},
  hiring:{vacancies:x=>kk(/^time_to_fill$/,/^(yoy|trend)$/)(x)||x.fact.kind==='vac'},
  tgrowth:{flow:kk(/^tgrowth_(conv|deny)$/,/^(yoy|ppl|trend)$/)},
  monitor:{activity:kk(/^(underwork|overwork)$/,/^(yoy|trend)$/)},
  office:{attend:kk(/^office_att$/,/^(yoy|trend)$/)}};

window.TPSTORY={book,Q,CH,judge,GL,WHY,glossary,CH_CARDS};
})();

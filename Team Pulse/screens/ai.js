/* ============================================================================
   screens/ai.js — AI-инструменты. Восьмой блок, итерация 28.

   В HQ-дашборде Proteus 34136 был блок AI-метрик — проникновение AI-инструментов
   «по команде против компании» и средний WAU, — а в Hub его не было вовсе:
   самый заметный разрыв бизнес-анализа. «Команда против компании» — ровно та
   механика, на которой стоит весь отчёт: база сравнения выводится из фильтров.

   31.10 (файл «AI.md»): три раздела без сравнения с прошлым годом —
   «Пользуются ли AI?»  — проникновение, активные пользователи и численность по неделям (поставка 106: только недели);
   «Кто пользуется?»    — доля с AI по сегментам: сотрудники и стажёры, покраска, сеньорность, грейд, стаж, специализация (112);
   «Как пользуются?»    — частота, инструментов на человека, топ инструментов, инструменты по покраске (07.11);
   «Что делают?»        — воронка и классификация сообщений (07.11).
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;

/* 28.10, п. 4: графики из «Готовности данных» — частота, инструментов на человека, воронка сообщений и
   топ задач, проникновение по IT-коду и инструменту, стажёры, конструктор. Числа условные (D.aiUsage) */
const esc=U.esc;
function bars(cap,sub,items,valueHead,o){
  return U.btGroup(Object.assign({cap:cap,capSub:sub,head:'',valueHead:valueHead||'Чел',metricKey:'hc_total',compact:true,
    items:items.map(x=>({name:x.name,note:x.note,value:x.value,color:G.C_AI}))},o||{}));
}
/* проценты — без колонки «Доля» и без ИТОГО: проценты не складываются */
const pctBars=(cap,sub,items,head)=>bars(cap,sub,items,head||'Доля, %',{metricKey:'ai_penetration',share:false,total:false});

/* поставка 106 (решение заказчика 06.11): только недели — 16 последних (Пн–Вс), без месяцев и без переключателя. Проникновение,
   активные пользователи и численность — из недельной витрины (D.aiWeeks: численность без стажёров, человек в подразделении
   один раз за неделю). Неполная текущая неделя — бледнее, пунктиром, с пометкой в подсказке.
   07.11 (AI-итерация, п. 1): отдельного графика численности нет — она второй светло-серой линией в «Активных пользователях»
   (одна шкала людей, в легенде и подсказке). Неделя, а не месяц — решение заказчика 06.11 (AI только по неделям) */
const P1=v=>D.fmtNum('pct',v);
/* 12.11 (итерация «настройки, One Pager, мониторинг», п. 1 и 11): графики недельного ряда — одной функцией для вкладки AI и
   One Pager; какие показывать — галочки «AI-инструменты» в «Настрой свой дашборд» (D.aiChartsOn). small — One Pager: ниже и
   без длинной сноски. Данных нет — null */
function aiCharts(lp,S,small,only){
  const W=D.aiWeeks(lp);
  if(!W)return null;
  /* only — один график (раскрытая строка One-pager) */
  const cw=D.aiCur(W), on=new Set(only?[only]:D.aiChartsOn(S));
  /* поставка 128: база — та же, с которой сравнивает глава (неделя cw, без стажёров; меньше 30 человек — без базы) */
  const pe=cw&&cw.hc>=D.SMALL_N?D.peerOf('ai_penetration',lp):null;
  /* поставка 138, п. 7 (владелец: «верните тренд по всей компании»): второй линией — проникновение всей компании за те же недели,
     по прежней логике ряда «по компании»: все сотрудники без стажёров, фильтры шапки на него не действуют. У самой компании — нет */
  const CW=D.isSelfBase()?null:D.aiWeeks(D.benchmarkLeaves(S)), co={};
  (CW||[]).forEach(w=>{co[w.wk]=w.pen});
  const P=W.map(w=>({label:w.label,full:w.full,pen:w.pen,wau:w.wau,hc:w.hc,cl:w.cl,pt:w.pt,co:co[w.wk]!=null?co[w.wk]:null}));
  const coOn=P.some(p=>p.co!=null);
  let h='';
  /* поставка 131: база — значением в строке итога под заголовком (серой отметки на графике нет, как на «год к году») */
  if(on.has('ai_penetration'))h+=G.chart('pline',Object.assign({periods:P,key:'pen',focus:cw?W.indexOf(cw):null},coOn?{key2:'co'}:{}),{title:'Проникновение AI по неделям, %',
      name:coOn?'Подразделение':'Проникновение',name2:'Вся компания',fmt:'pct',color:G.C_AI,h:small?200:220,sm:!!small,period:cw?{head:'Последняя полная неделя, '+cw.label,cur:D.fmtVal('ai_penetration',cw.pen),
        ref:pe?['база',D.fmtVal('ai_penetration',pe.p50)]:null}:null});
  /* поставка 137, п. 8 (владелец): численности на вкладке AI нет — ни второй линии на графике, ни колонки в таблице; она
     остаётся знаменателем проникновения */
  if(on.has('ai_wau'))h+=G.chart('pline',{periods:P,key:'wau',focus:cw?W.indexOf(cw):null},{title:'Активные пользователи AI по неделям, чел',name:'Активные пользователи',
      fmt:'int',color:G.C_AI,h:small?200:240,sm:!!small,period:small&&cw?{head:'Последняя полная неделя, '+cw.label,cur:D.fmtInt(cw.wau)+' чел'}:null});
  return h;
}
SC.aiCharts=aiCharts;
function adoption(ctx){
  const W=D.aiWeeks(ctx.lp), cw=D.aiCur(W), pt=W.some(w=>w.pt);
  const ch=aiCharts(ctx.lp,ctx.S,false);
  return '<div class="mon-bar"><span class="mon-note">Последние '+W.length+' '+U.plural(W.length,['неделя','недели','недель'])+
      ', по неделям (Пн–Вс)'+(pt?' · текущая неделя ещё идёт — бледнее':'')+'</span></div>'+
    (ch||'<div class="tbl-note">Оба графика отключены в «Настрой свой дашборд» → Метрики → AI-инструменты.</div>')+
    '<div class="tbl-note">Проникновение — активные пользователи AI за неделю к численности той же недели без стажёров; человек '+
    'в подразделении считается один раз. Фильтры покраски, IT, штата и типа численности на AI не действуют: здесь — все '+
    'сотрудники подразделения, кроме стажёров, а в шапке — только отобранные фильтрами, поэтому людей здесь бывает заметно больше.'+(cw?' Последняя полная неделя — '+esc(cw.full.replace(/^Неделя /,''))+': '+P1(cw.pen)+'.':'')+'</div>';
}
/* поставка 106: окно — неделя (на настоящих данных — последняя полная неделя витрины, u.week) */
const wk=u=>u.week?' · неделя '+u.week:' · за неделю';
/* 07.11 (AI-итерация, п. 2): доля частей целого — горизонтальная полоса с карточками, как «Пол» и «Возраст» в «Структуре»
   (без среза по клику); пусто — строка «нет данных» вместо полосы */
const AI_NO='var(--pt-na)';
function split(cap,sub,parts,unit,word){
  const tot=parts.reduce((a,x)=>a+(x.n||0),0);
  if(!tot)return '<section class="pf-s">'+U.pfHead(cap,esc(sub),U.icoFor(cap))+'<div class="tbl-note">Нет данных за неделю.</div></section>';
  return '<section class="pf-s">'+U.pfHead(cap,esc(sub),U.icoFor(cap))+
    U.shareBar({static:true,names:true,unit:unit,segs:parts.map((x,i)=>({id:'a'+i,name:x.name,n:x.n,bg:x.bg}))})+
    U.shareCards({static:true,cards:parts.map((x,i)=>({id:'a'+i,name:x.name,n:x.n,unit:word,bg:x.bg,
      sub:'<b>'+P1(x.n/tot*100)+'</b> от '+(unit==='Сообщений'?'всех сообщений':'всех')}))})+'</section>';
}
/* 07.11 (п. 3–4): инструменты — % людей и число людей, порядок — по числу людей (ранг ноутбука), первые 10 и раскрываемое
   «Остальное»: в его итоге каждый человек один раз (rest — уникальные люди с инструментами вне топ-10) */
function tools(ctx,k,cap,sub,items,base,rest,head,cnt){
  return U.btGroup(Object.assign({cap:cap,capSub:sub,head:'',valueHead:'Доля, %',cnt:cnt||'Чел',metricKey:'ai_penetration',
    share:false,total:false,compact:true,restName:'Остальное',
    restAgg:()=>({value:base?rest/base*100:0,n:rest}),
    items:items.map(x=>({name:x.name,value:x.value,n:x.n,color:G.C_AI}))},
    SC.rest(ctx,k,10,['инструмент','инструмента','инструментов'])));
}
/* поставка 112 (владелец 07.11: «у нас информация только про стажёров, должна быть в целом — кто эти люди»): «Кто
   пользуется?» — доля с AI по сегментам без стажёров (покраска, сеньорность, грейд, стаж, специализация — ash / asu
   ноутбука), стажёры — одной строкой рядом с сотрудниками. Группа меньше 3 человек — серым: доля по 1–2 людям не сигнал */
const SEG_SMALL=3;
/* поставка 138, п. 10 и 12 (владелец): в таблицах справа — только «Акт. пользователи» и «Проникновение», названиями как в таблице
   подразделений; численность группы не показываем (она остаётся знаменателем проникновения) */
const AI_ACT='Акт. пользователи', AI_PEN='Проникновение';
const AI_HEAD_TIP='Акт. пользователи — активные пользователи AI за неделю, человек. Проникновение — их доля в численности группы.';
const AI_DIM_SKIP={g:1};   /* поставка 138, п. 11: детализации по грейдам нет */
function segTable(cap,sub,rows,dim,cnt){
  /* keepZero: группа, где никто не пользуется AI (0%), — тоже ответ, а не пустая строка */
  return U.btGroup({cap:cap,capSub:sub,head:'',valueHead:AI_PEN,cnt:cnt||AI_ACT,metricKey:'ai_penetration',
    share:false,total:false,compact:true,keepZero:true,
    items:rows.map(x=>({name:x.name,value:x.pen,n:x.act,color:x.hc<SEG_SMALL?G.C_BENCH:G.C_AI,
      note:x.hc<SEG_SMALL?'мало людей':null,
      tip:x.hc<SEG_SMALL?'В группе меньше '+SEG_SMALL+' человек — долю не сравниваем.':null,
      /* поставка 113-б: кросс-фильтр — строка выбирается, выбор складывается */
      on:!!x.on,attr:dim?'data-aisel="'+esc(dim+'|'+x.key)+'"':null,attrTip:'Клик — остальные таблицы только по «'+x.name+'».'}))});
}
/* поставка 116 (владелец 07.11: «зачем такой фокус на стажёрах? Первая полоса — сколько пользуются от всей численности,
   отдельно — сколько стажёров; дальше все разбивки»; «убери „все люди“»): сверху одна таблица «Пользуются AI» — вся
   численность (сотрудники и стажёры) и строкой стажёры: видно, выше они общего процента или ниже. Строка стажёров — кросс-
   фильтр, как раньше (клик — разбивки только по стажёрам). Ниже — разбивки без подписи «все люди»: уточнение «по выбранной
   группе» — только при выборе; неделя — один раз в подписи верхней таблицы. Таблицы «Сотрудники и стажёры» больше нет */
/* поставка 138, п. 13 (владелец: «на одной вкладке смешаны стажёры и остальные»): «Кто пользуется?» — только сотрудники без
   стажёров (признак стажёра витрины, is_intern_flg: сочетания it|0); стажёры — на своей вкладке «Как используют стажёры?» */
const EMP=['it|0'], INT=['it|1'];
const selOf=S=>(S.aiSel||[]).filter(v=>!/^it\|/.test(v));
function who(ctx,u){
  const S=ctx.S, sel=selOf(S), x=D.aiCross(ctx.lp,EMP.concat(sel)), x0=sel.length?D.aiCross(ctx.lp,EMP):x;
  const pc=(a,h)=>h?a*100/h:0;
  /* без сочетаний — разрезы ноутбука, они и так без стажёров */
  const sg=(u.segs||[])[0], emp=sg?sg.rows.reduce((t,r)=>({hc:t.hc+r.hc,act:t.act+r.act}),{hc:0,act:0}):{hc:0,act:0};
  const all=x0?{hc:x0.hc,act:x0.act}:emp;
  const head=U.btGroup({cap:'Пользуются AI',capSub:'сотрудники без стажёров'+wk(u),head:'',
    valueHead:AI_PEN,cnt:AI_ACT,metricKey:'ai_penetration',share:false,total:false,compact:true,keepZero:true,
    items:[{name:'Сотрудники без стажёров',value:pc(all.act,all.hc),n:all.act,color:G.C_AI}]});
  const note='<div class="tbl-note">Все таблицы — сотрудники без стажёров, неделя '+esc((u.week||'').replace(/^неделя /,''))+
    '; стажёры — на вкладке «Как используют стажёры?». Сеньорность, стаж и специализация — на последний месяц отчёта. '+
    'Группы меньше '+SEG_SMALL+' человек — серым.</div>';
  if(!x){
    const segs=(u.segs||[]).filter(sg=>!AI_DIM_SKIP[sg.key]);
    return (segs.length?U.btStack(segs.map(sg=>segTable(sg.cap,'',sg.key==='sp'?sg.rows.slice().sort((a,b)=>b.hc-a.hc).slice(0,10):sg.rows))):'')+
      (segs.length?note:'');
  }
  const tabs=x.dims.filter(dm=>dm.key!=='it'&&!AI_DIM_SKIP[dm.key]).map(dm=>{
    const sp=dm.key==='sp', srt=dm.rows.slice().sort((a,b)=>b.hc-a.hc);
    const rs=sp?srt.slice(0,10).concat(dm.rows.filter(r=>r.on&&srt.indexOf(r)>=10)):dm.rows;
    return segTable(dm.cap,(sel.length?'по выбранной группе':'')+(sp&&dm.rows.length>10?(sel.length?' · ':'')+'первые 10 из '+dm.rows.length:''),rs,dm.key);
  });
  /* 12.11 (итерация «переносы, интерфейс, AI», п. 6): первой таблицы «Сотрудники без стажёров» нет — детализация начинается с
     покраски; выборка та же (сотрудники без стажёров) */
  return U.btStack([].concat(sel.length?['<div class="tbl-note">Выбрано: '+AI_ACT.toLowerCase()+' — <b>'+D.fmtInt(x.act)+
      '</b> чел, проникновение — <b>'+P1(x.pen)+'</b>.</div>']:[]).concat(tabs))+note;
}
/* поставка 138, п. 13: «Как используют стажёры?» — только стажёры (признак витрины): итог, разрезы, частота и инструменты */
function interns(ctx,u){
  const it=u.intern||{hc:0,act:0};
  if(!it.hc)return U.empty('Стажёров нет','В выбранном подразделении за неделю'+wk(u).replace(' · неделя','')+' стажёров нет.');
  const pc=(a,h)=>h?a*100/h:0, x=D.aiCross(ctx.lp,INT);
  const head=U.btGroup({cap:'Пользуются AI',capSub:'только стажёры'+wk(u),head:'',
    valueHead:AI_PEN,cnt:AI_ACT,metricKey:'ai_penetration',share:false,total:false,compact:true,keepZero:true,
    items:[{name:'Стажёры',value:pc(it.act,it.hc),n:it.act,color:it.hc<SEG_SMALL?G.C_BENCH:G.C_AI,note:it.hc<SEG_SMALL?'мало людей':null}]});
  /* 12.11 (итерация «оформление AI на One Pager», п. 3): у стажёров детализации по сеньорности нет; столбец количества во
     всех таблицах вкладки — «чел.» (в таблицах разрезов это активные пользователи AI среди стажёров — сказано в сноске) */
  const CH='чел.';
  const segs=x?x.dims.filter(dm=>dm.key!=='it'&&dm.key!=='s'&&!AI_DIM_SKIP[dm.key]&&dm.rows.length).map(dm=>{
    const sp=dm.key==='sp', rs=sp?dm.rows.slice().sort((a,b)=>b.hc-a.hc).slice(0,10):dm.rows;
    return segTable(dm.cap,sp&&dm.rows.length>10?'первые 10 из '+dm.rows.length:'',rs,null,CH)}):[];
  const iT=it.tools||[], fr=it.freq||[];
  /* 12.11, п. 8: первой таблицы «Стажёры» нет — детализация начинается с покраски; выборка — те же стажёры */
  return U.btStack([].concat(segs,fr.some(f=>f.value)?[bars('Частота использования','дней с AI в неделю · только стажёры',fr,CH)]:[],
      iT.length?[tools(ctx,'aitooli','Топ инструментов','% и число стажёров',iT,it.hc,it.rest||0,'% стажёров',CH)]:[]))+
    '<div class="tbl-note">Все таблицы — только стажёры (признак стажёра недельной витрины AI), неделя '+esc((u.week||'').replace(/^неделя /,''))+
      '. «чел.» — стажёры, которые пользовались AI за неделю (в «Частоте» и «Топе инструментов» — с этой частотой или инструментом). Проникновение — их доля в числе стажёров той же недели. Группы меньше '+SEG_SMALL+' человек — серым.</div>';
}
/* 07.11 (п. 7): «Инструменты по покраске» — последним блоком «Как пользуются?»: топ-10 инструментов строками, % и число людей
   сегмента, «Остальное» раскрывается (в нём люди сегмента с инструментами вне топ-10 — каждый один раз) */
function byPaint(ctx,u){
  const segs=u.bySeg.filter(x=>x.hc>0);
  if(!segs.length)return '';
  const I=D.fmtInt, rk='rest:aipaint', open=!!(ctx.mixOpen&&ctx.mixOpen.has(rk)), T=u.tools, more=T.length>11;
  /* 12.11 (итерация «переносы, интерфейс, AI», п. 10): в ячейке — только процент; число людей, инструмент, покраска и от чего
     процент — в подсказке. Нет данных — прочерк (с подсказкой), ноль — «0,0%» */
  const two=(p,n,x,nm)=>'<span class="ai-pc"'+U.tipAttr({title:nm+' · '+x.name,
    list:['**Доля** — '+P1(p),'**Людей** — '+I(n)+' чел'],
    note:'Процент — от всех сотрудников покраски «'+x.name+'» без стажёров ('+I(x.hc)+' чел) за ту же неделю.'})+'>'+P1(p)+'</span>';
  const cell=(x,j,nm)=>x.cells[j]==null?'<span class="ai-pc na"'+U.tipAttr({title:nm+' · '+x.name,text:'Нет данных: в этой покраске нет людей за неделю.'})+'>—</span>':two(x.cells[j],x.cnt[j],x,nm);
  const row=(t,j,cls)=>'<tr'+(cls?' class="'+cls+'"':'')+'><td class="txt">'+esc(t.name)+'</td>'+segs.map(x=>'<td>'+cell(x,j,t.name)+'</td>').join('')+'</tr>';
  let body=T.slice(0,more?10:T.length).map((t,j)=>row(t,j,'')).join('');
  if(more){
    const n=T.length-10;
    body+='<tr class="urow" data-btexp="'+rk+'"'+U.tipAttr({title:'Остальное',text:open?'Клик — свернуть.':'Кликни, чтобы посмотреть остальные.'})+
      '><td class="txt"><span class="row-label"><button class="caret-btn"'+(open?' data-open="1"':'')+' data-btexp="'+rk+'">'+(open?'▾':'▸')+
      '</button><span class="row-body">Остальное<span class="unit-sub">'+n+' '+U.plural(n,['инструмент','инструмента','инструментов'])+'</span></span></span></td>'+
      segs.map(x=>'<td>'+two(x.hc?x.rest/x.hc*100:0,x.rest,x,'Остальные инструменты')+'</td>').join('')+'</tr>';
    if(open)body+=T.slice(10).map((t,j)=>row(t,j+10,'lvl2')).join('');
  }
  return '<div class="bt-group"><div class="bt-cap">Инструменты по покраске<span class="bt-sub">% людей покраски без стажёров · число людей — в подсказке'+esc(wk(u))+'</span></div>'+
    '<table class="ptable stable dense ai-paint"><thead><tr><th class="txt">Инструмент</th>'+segs.map(x=>'<th>'+esc(x.name)+'<span class="th-per">'+I(x.hc)+' чел</span></th>').join('')+
    '</tr></thead><tbody>'+body+'</tbody></table></div>';
}
/* «Как пользуются?» — частота, инструментов на человека, топ инструментов, по покраске (последним) */
function usage(ctx,u){
  const act=u.per.reduce((a,x)=>a+x.value,0);
  /* инструментов на человека: распределение активных пользователей; среднее — «4 и больше» считаем как 4 (нижняя граница) */
  /* 12.11, п. 9: среднее — по тем, у кого число инструментов известно */
  const known=u.per.filter(x=>!x.na), kn=known.reduce((a,x)=>a+x.value,0);
  const avg=kn?known.reduce((a,x,i)=>a+x.value*(i+1),0)/kn:0;
  const base=Math.round(u.act&&u.pen?u.act*100/u.pen:0);
  return U.btStack([
      /* поставка 116: «активные пользователи» — в итоге справа («Всего 217 чел») и в выводе шага; подпись в одну строку */
      bars('Частота использования','дней с AI в неделю'+wk(u),u.freq),
      bars('Инструментов на человека','в среднем '+D.fmtNumber(avg)+' (4+ считаем за 4)',u.per),
      /* неделя — один раз, в подписи первой таблицы шага */
      tools(ctx,'aitool','Топ инструментов','% и число сотрудников без стажёров',u.tools,base,u.rest||0,'% сотрудников'),
      byPaint(ctx,u)])+
    '<div class="tbl-note">Проценты по инструментам не складываются: один человек может пользоваться несколькими; в «Остальном» '+
      'каждый человек — один раз.</div>';
}
/* 07.11 (п. 5): «Что делают?» — воронка сообщений (полоса «классифицированы / нет») и классификация по задачам */
function what(u){
  const I=D.fmtInt;
  const cls={};u.dev.forEach(d=>d.tasks.forEach(t=>{cls[t.name]=(cls[t.name]||0)+t.value}));
  const clsItems=Object.keys(cls).map(k=>({name:k,value:cls[k]})).sort((a,b)=>b.value-a.value);
  return split('Воронка сообщений','инструменты разработчика · всего '+I(u.msgs)+wk(u),[{name:'Классифицированы',n:u.cls,bg:G.C_AI},
      {name:'Не классифицированы',n:Math.max(0,u.msgs-u.cls),bg:AI_NO}],'Сообщений','сообщ.')+
    U.btStack([bars('Классификация сообщений','классифицированные сообщения по задачам',clsItems,'Сообщений',{totUnit:' сообщ.'})])+
    '<div class="tbl-note">Классифицированные и не классифицированные в сумме дают все сообщения; классы — только у классифицированных.</div>';
}

/* владелец, 06.11: таблица подразделений, «Кто» и «Как пользуется» — по последней закрытой неделе; даты — в подписи колонок */
function wkPer(){const w=D.aiCur(D.aiWeeks(D.reportLeaves(D.DEFAULT_STATE)));return w?'неделя '+w.full.replace(/^Неделя /,''):'за неделю'}
const AI_ASOF=()=>wkPer().replace(/^./,x=>x.toUpperCase())+' — последняя полная неделя в данных.';
SC.blocks.ai={
  /* поставка 106: таблица подразделений — последняя полная неделя (численность без стажёров, активные, проникновение) */
  cols:[
    {k:'hc',hide:true,name:'Численность, чел',get per(){return wkPer()},tip:'Численность последней полной недели без стажёров — знаменатель проникновения. Фильтры среза на AI не действуют.',
      val:md=>md.hc,na:'Нет недель AI у подразделения.'},
    /* поставка 137, п. 1: дата актуальности AI — своя: последняя полная неделя данных */
    {k:'wau',name:AI_ACT,get per(){return wkPer()},get asof(){return AI_ASOF()},tip:'Акт. пользователи — активные: сколько человек пользовались AI-инструментами в последнюю полную неделю.',
      val:md=>md.wau,share:true,na:'Нет недель AI у подразделения.'},
    {k:'pen',name:'Проникновение',get per(){return wkPer()},get asof(){return AI_ASOF()},tip:'Активные пользователи к численности той же недели без стажёров.',
      val:md=>md.pen,fmt:P1,pct:true,na:'Нет недель AI у подразделения.'}
  ],
  data(lp){return D.aiCur(D.aiWeeks(lp))},
  /* 31.10, «AI.md», п. 2: три раздела — пользуются ли, кто, как */
  /* 07.11 (AI-итерация, п. 5 и 8): четыре раздела — «Как пользуются?» (было «Как пользуется?»), сообщения — в «Что делают?» */
  subTabs:[['adoption','Пользуются ли AI?'],['who','Кто пользуется?'],['interns','Как используют стажёры?'],['usage','Как пользуются?'],['what','Что делают?']],
  defaultSub:'adoption',
  /* поставка 113-б: выбор кросс-фильтра «Кто пользуется» — пилюлями в шапке карточки (как срезы «Структуры» и «Офиса») */
  shelfChips(S){
    if(S.subTab!=='who'||!selOf(S).length)return [];
    const nm={p:'Покраска',s:'Сеньорность',t:'Стаж',sp:'Специализация'};
    return selOf(S).map(v=>{const i=v.indexOf('|'), d=v.slice(0,i), c=v.slice(i+1);
      return {dim:nm[d]||d,cat:d==='it'?(c==='1'?'Стажёры':'Сотрудники'):c==='-'?'Не указано':c,attr:'data-aisel="'+esc(v)+'"',tip:'Клик — снять.'}});
  },
  title(sub){return sub==='who'?'Кто пользуется AI (без стажёров)':sub==='interns'?'Как используют AI стажёры':sub==='usage'?'Как пользуются AI: частота и инструменты'
    :sub==='what'?'Что делают в AI: сообщения и задачи'
    :'Пользуются ли AI: проникновение и активные пользователи'},
  view(ctx){
    /* файл 7, п. 4; поставка 106: у подразделения нет ни одной недели статистики AI — понятная заглушка вместо пустых графиков */
    if(!D.aiWeeks(ctx.lp))return U.empty('Нет статистики AI-инструментов',
      'У «'+((D.NODE_BY_PATH[ctx.sel]||{}).name||'')+'» в недельной витрине AI нет данных. Выберите подразделение выше по дереву '+
      'или проверьте выгрузку статистики AI.');
    if(ctx.sub==='usage')return usage(ctx,D.aiUsage(ctx.lp));
    if(ctx.sub==='who')return who(ctx,D.aiUsage(ctx.lp));
    if(ctx.sub==='interns')return interns(ctx,D.aiUsage(ctx.lp));
    if(ctx.sub==='what')return what(D.aiUsage(ctx.lp));
    return adoption(ctx);
  }
};
})();

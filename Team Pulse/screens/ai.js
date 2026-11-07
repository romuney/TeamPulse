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
const P1=v=>v==null?'—':String(v).replace('.',',')+'%';
function adoption(ctx){
  const W=D.aiWeeks(ctx.lp), cw=D.aiCur(W), pt=W.some(w=>w.pt);
  const P=W.map(w=>({label:w.label,full:w.full,pen:w.pen,wau:w.wau,hc:w.hc,cl:w.cl,pt:w.pt}));
  return '<div class="mon-bar"><span class="mon-note">Последние '+W.length+' '+U.plural(W.length,['неделя','недели','недель'])+
      ', по неделям (Пн–Вс)'+(pt?' · текущая неделя ещё идёт — бледнее':'')+'</span></div>'+
    G.chart('pline',{periods:P,key:'pen'},{title:'Проникновение AI по неделям, %',name:'Проникновение',fmt:'pct',color:G.C_AI,h:220})+
    G.chart('pline',{periods:P,key:'wau',key2:'hc'},{title:'Активные пользователи AI по неделям, чел',name:'Активные пользователи',
      name2:'Численность без стажёров',fmt:'int',color:G.C_AI,h:240})+
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
  if(!tot)return '<section class="pf-s">'+U.pfHead(cap,esc(sub))+'<div class="tbl-note">Нет данных за неделю.</div></section>';
  return '<section class="pf-s">'+U.pfHead(cap,esc(sub))+
    U.shareBar({static:true,names:true,unit:unit,segs:parts.map((x,i)=>({id:'a'+i,name:x.name,n:x.n,bg:x.bg}))})+
    U.shareCards({static:true,cards:parts.map((x,i)=>({id:'a'+i,name:x.name,n:x.n,unit:word,bg:x.bg,
      sub:'<b>'+P1(Math.round(x.n/tot*1000)/10)+'</b> от '+(unit==='Сообщений'?'всех сообщений':'всех')}))})+'</section>';
}
/* 07.11 (п. 3–4): инструменты — % людей и число людей, порядок — по числу людей (ранг ноутбука), первые 10 и раскрываемое
   «Остальное»: в его итоге каждый человек один раз (rest — уникальные люди с инструментами вне топ-10) */
function tools(ctx,k,cap,sub,items,base,rest,head){
  return U.btGroup(Object.assign({cap:cap,capSub:sub,head:'',valueHead:'Доля, %',cnt:'Чел',metricKey:'ai_penetration',
    share:false,total:false,compact:true,restName:'Остальное',
    restAgg:()=>({value:base?Math.round(rest/base*1000)/10:0,n:rest}),
    items:items.map(x=>({name:x.name,value:x.value,n:x.n,color:G.C_AI}))},
    SC.rest(ctx,k,10,['инструмент','инструмента','инструментов'])));
}
/* поставка 112 (владелец 07.11: «у нас информация только про стажёров, должна быть в целом — кто эти люди»): «Кто
   пользуется?» — доля с AI по сегментам без стажёров (покраска, сеньорность, грейд, стаж, специализация — ash / asu
   ноутбука), стажёры — одной строкой рядом с сотрудниками. Группа меньше 3 человек — серым: доля по 1–2 людям не сигнал */
const SEG_SMALL=3;
function segTable(cap,sub,rows,dim){
  /* keepZero: группа, где никто не пользуется AI (0%), — тоже ответ, а не пустая строка */
  return U.btGroup({cap:cap,capSub:sub,head:'',valueHead:'С AI, %',cnt:'С AI, чел',metricKey:'ai_penetration',
    share:false,total:false,compact:true,keepZero:true,
    items:rows.map(x=>({name:x.name,value:x.pen,n:x.act,color:x.hc<SEG_SMALL?G.C_BENCH:G.C_AI,
      note:'из '+D.fmtInt(x.hc)+' чел'+(x.hc<SEG_SMALL?' · мало людей':''),
      tip:x.hc<SEG_SMALL?'В группе меньше '+SEG_SMALL+' человек — долю не сравниваем.':null,
      /* поставка 113-б: кросс-фильтр — строка выбирается, выбор складывается */
      on:!!x.on,attr:dim?'data-aisel="'+esc(dim+'|'+x.key)+'"':null,attrTip:'Клик — остальные таблицы только по «'+x.name+'».'}))});
}
/* поставка 116 (владелец 07.11: «зачем такой фокус на стажёрах? Первая полоса — сколько пользуются от всей численности,
   отдельно — сколько стажёров; дальше все разбивки»; «убери „все люди“»): сверху одна таблица «Пользуются AI» — вся
   численность (сотрудники и стажёры) и строкой стажёры: видно, выше они общего процента или ниже. Строка стажёров — кросс-
   фильтр, как раньше (клик — разбивки только по стажёрам). Ниже — разбивки без подписи «все люди»: уточнение «по выбранной
   группе» — только при выборе; неделя — один раз в подписи верхней таблицы. Таблицы «Сотрудники и стажёры» больше нет */
function who(ctx,u){
  const S=ctx.S, it=u.intern||{hc:0,act:0}, sel=S.aiSel||[], x=D.aiCross(ctx.lp,sel), x0=sel.length?D.aiCross(ctx.lp,[]):x;
  const pc=(a,h)=>h?Math.round(a*1000/h)/10:0;
  /* вся численность: из сочетаний (без выбора), без них — сотрудники по первому разрезу + стажёры */
  const sg=(u.segs||[])[0], emp=sg?sg.rows.reduce((t,r)=>({hc:t.hc+r.hc,act:t.act+r.act}),{hc:0,act:0}):{hc:0,act:0};
  const all=x0?{hc:x0.hc,act:x0.act}:{hc:emp.hc+it.hc,act:emp.act+it.act};
  const itOn=sel.indexOf('it|1')>=0;
  const rows=[{name:'Вся численность',value:pc(all.act,all.hc),n:all.act,color:G.C_AI,note:'из '+D.fmtInt(all.hc)+' чел'}]
    .concat(it.hc?[{name:'Стажёры',value:pc(it.act,it.hc),n:it.act,color:it.hc<SEG_SMALL?G.C_BENCH:G.C_AI,
      note:'из '+D.fmtInt(it.hc)+' чел'+(it.hc<SEG_SMALL?' · мало людей':''),
      tip:it.hc<SEG_SMALL?'Стажёров меньше '+SEG_SMALL+' — долю не сравниваем.':null,
      on:itOn,attr:x?'data-aisel="it|1"':null,attrTip:'Клик — разбивки ниже только по стажёрам.'}]:[]);
  const head=U.btGroup({cap:'Пользуются AI',capSub:(it.hc?'':'стажёров нет · ')+wk(u).replace(/^ · /,''),head:'',
    valueHead:'С AI, %',cnt:'С AI, чел',metricKey:'ai_penetration',share:false,total:false,compact:true,keepZero:true,items:rows});
  if(!x){
    /* сочетаний нет (ноутбук до 113-б или подразделение ниже выбранного) — разрезы без кросс-фильтра (без стажёров) */
    const segs=u.segs||[];
    return head+(segs.length?U.btStack(segs.map(sg=>segTable(sg.cap,'без стажёров',sg.key==='sp'?sg.rows.slice().sort((a,b)=>b.hc-a.hc).slice(0,10):sg.rows))):'');
  }
  const tabs=x.dims.filter(dm=>dm.key!=='it').map(dm=>{
    const sp=dm.key==='sp', srt=dm.rows.slice().sort((a,b)=>b.hc-a.hc);
    const rs=sp?srt.slice(0,10).concat(dm.rows.filter(r=>r.on&&srt.indexOf(r)>=10)):dm.rows;
    return segTable(dm.cap,(x.sel?(itOn?'только стажёры':'по выбранной группе'):'')+(sp&&dm.rows.length>10?(x.sel?' · ':'')+'первые 10 из '+dm.rows.length:''),rs,dm.key);
  });
  return U.btStack([head].concat(x.sel?['<div class="tbl-note">Выбрано: <b>'+D.fmtInt(x.hc)+'</b> чел, с AI — <b>'+D.fmtInt(x.act)+
      '</b> чел ('+P1(x.pen)+').</div>']:[]).concat(tabs))+
    '<div class="tbl-note">«Вся численность» — сотрудники и стажёры за неделю; «Проникновение AI» на первом шаге — без стажёров. '+
      'Клик по строке — остальные таблицы только по этой группе; клик ещё раз — снять. Несколько строк одной таблицы — «или», '+
      'разных таблиц — «и». Сеньорность, грейд, стаж и специализация — на последний месяц отчёта; человека нет в отчёте — '+
      '«Не указано». Группы меньше '+SEG_SMALL+' человек — серым.</div>';
}
/* 07.11 (п. 7): «Инструменты по покраске» — последним блоком «Как пользуются?»: топ-10 инструментов строками, % и число людей
   сегмента, «Остальное» раскрывается (в нём люди сегмента с инструментами вне топ-10 — каждый один раз) */
function byPaint(ctx,u){
  const segs=u.bySeg.filter(x=>x.hc>0);
  if(!segs.length)return '';
  const I=D.fmtInt, rk='rest:aipaint', open=!!(ctx.mixOpen&&ctx.mixOpen.has(rk)), T=u.tools, more=T.length>11;
  /* процент и под ним число людей — колонки сегментов узкие, в одну строку не помещаются */
  const two=(p,n)=>P1(p)+'<span class="unit-sub">'+I(n)+' чел</span>';
  const cell=(x,j)=>x.cells[j]==null?'—':two(x.cells[j],x.cnt[j]);
  const row=(t,j,cls)=>'<tr'+(cls?' class="'+cls+'"':'')+'><td class="txt">'+esc(t.name)+'</td>'+segs.map(x=>'<td>'+cell(x,j)+'</td>').join('')+'</tr>';
  let body=T.slice(0,more?10:T.length).map((t,j)=>row(t,j,'')).join('');
  if(more){
    const n=T.length-10;
    body+='<tr class="urow" data-btexp="'+rk+'"'+U.tipAttr({title:'Остальное',text:open?'Клик — свернуть.':'Кликни, чтобы посмотреть остальные.'})+
      '><td class="txt"><span class="row-label"><button class="caret-btn"'+(open?' data-open="1"':'')+' data-btexp="'+rk+'">'+(open?'▾':'▸')+
      '</button><span class="row-body">Остальное<span class="unit-sub">'+n+' '+U.plural(n,['инструмент','инструмента','инструментов'])+'</span></span></span></td>'+
      segs.map(x=>'<td>'+two(x.hc?Math.round(x.rest/x.hc*1000)/10:0,x.rest)+'</td>').join('')+'</tr>';
    if(open)body+=T.slice(10).map((t,j)=>row(t,j+10,'lvl2')).join('');
  }
  return '<div class="bt-group"><div class="bt-cap">Инструменты по покраске<span class="bt-sub">% и число людей сегмента без стажёров'+esc(wk(u))+'</span></div>'+
    '<table class="ptable stable dense ai-paint"><thead><tr><th class="txt">Инструмент</th>'+segs.map(x=>'<th>'+esc(x.name)+'<span class="th-per">'+I(x.hc)+' чел</span></th>').join('')+
    '</tr></thead><tbody>'+body+'</tbody></table></div>';
}
/* «Как пользуются?» — частота, инструментов на человека, топ инструментов, по покраске (последним) */
function usage(ctx,u){
  const act=u.per.reduce((a,x)=>a+x.value,0);
  /* инструментов на человека: распределение активных пользователей; среднее — «4 и больше» считаем как 4 (нижняя граница) */
  const avg=act?u.per.reduce((a,x,i)=>a+x.value*(i+1),0)/act:0;
  const base=Math.round(u.act&&u.pen?u.act*100/u.pen:0);
  return U.btStack([
      /* поставка 116: «активные пользователи» — в итоге справа («Всего 217 чел») и в выводе шага; подпись в одну строку */
      bars('Частота использования','дней с AI в неделю'+wk(u),u.freq),
      bars('Инструментов на человека','в среднем '+(Math.round(avg*10)/10).toString().replace('.',',')+' (4+ считаем за 4)',u.per),
      tools(ctx,'aitool','Топ инструментов','% и число сотрудников без стажёров'+wk(u),u.tools,base,u.rest||0,'% сотрудников'),
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
    U.btStack([bars('Классификация сообщений','классифицированные сообщения по задачам · всего '+I(u.cls),clsItems,'Сообщений')])+
    '<div class="tbl-note">Классифицированные и не классифицированные в сумме дают все сообщения; классы — только у классифицированных.</div>';
}

/* владелец, 06.11: таблица подразделений, «Кто» и «Как пользуется» — по последней закрытой неделе; даты — в подписи колонок */
function wkPer(){const w=D.aiCur(D.aiWeeks(D.reportLeaves(D.DEFAULT_STATE)));return w?'неделя '+w.full.replace(/^Неделя /,''):'за неделю'}
SC.blocks.ai={
  /* поставка 106: таблица подразделений — последняя полная неделя (численность без стажёров, активные, проникновение) */
  cols:[
    {k:'hc',name:'Численность, чел',get per(){return wkPer()},tip:'Численность последней полной недели без стажёров — знаменатель проникновения. Фильтры среза на AI не действуют.',
      val:md=>md.hc,na:'Нет недель AI у подразделения.'},
    {k:'wau',name:'Активные пользователи',get per(){return wkPer()},tip:'Сколько человек пользовались AI-инструментами в последнюю полную неделю.',
      val:md=>md.wau,share:true,na:'Нет недель AI у подразделения.'},
    {k:'pen',name:'Проникновение',get per(){return wkPer()},tip:'Активные пользователи к численности той же недели без стажёров.',
      val:md=>md.pen,fmt:P1,na:'Нет недель AI у подразделения.'}
  ],
  data(lp){return D.aiCur(D.aiWeeks(lp))},
  /* 31.10, «AI.md», п. 2: три раздела — пользуются ли, кто, как */
  /* 07.11 (AI-итерация, п. 5 и 8): четыре раздела — «Как пользуются?» (было «Как пользуется?»), сообщения — в «Что делают?» */
  subTabs:[['adoption','Пользуются ли AI?'],['who','Кто пользуется?'],['usage','Как пользуются?'],['what','Что делают?']],
  defaultSub:'adoption',
  /* поставка 113-б: выбор кросс-фильтра «Кто пользуется» — пилюлями в шапке карточки (как срезы «Структуры» и «Офиса») */
  shelfChips(S){
    if(S.subTab!=='who'||!(S.aiSel||[]).length)return [];
    const nm={it:'Тип',p:'Покраска',s:'Сеньорность',g:'Грейд',t:'Стаж',sp:'Специализация'};
    return S.aiSel.map(v=>{const i=v.indexOf('|'), d=v.slice(0,i), c=v.slice(i+1);
      return {dim:nm[d]||d,cat:d==='it'?(c==='1'?'Стажёры':'Сотрудники'):c==='-'?'Не указано':c,attr:'data-aisel="'+esc(v)+'"',tip:'Клик — снять.'}});
  },
  title(sub){return sub==='who'?'Кто пользуется AI':sub==='usage'?'Как пользуются AI: частота и инструменты'
    :sub==='what'?'Что делают в AI: сообщения и задачи'
    :'Пользуются ли AI: проникновение и активные пользователи'},
  view(ctx){
    /* файл 7, п. 4; поставка 106: у подразделения нет ни одной недели статистики AI — понятная заглушка вместо пустых графиков */
    if(!D.aiWeeks(ctx.lp))return U.empty('Нет статистики AI-инструментов',
      'У «'+((D.NODE_BY_PATH[ctx.sel]||{}).name||'')+'» в недельной витрине AI нет данных. Выберите подразделение выше по дереву '+
      'или проверьте выгрузку статистики AI.');
    if(ctx.sub==='usage')return usage(ctx,D.aiUsage(ctx.lp));
    if(ctx.sub==='who')return who(ctx,D.aiUsage(ctx.lp));
    if(ctx.sub==='what')return what(D.aiUsage(ctx.lp));
    return adoption(ctx);
  }
};
})();

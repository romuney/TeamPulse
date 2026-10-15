/* ============================================================================
   screens/structure.js — Структура численности.

   Разрезов состава в HR-борде не три и не пять: грейд, сеньорность, пол,
   возраст, стаж, тип занятости, формат работы, юрлицо, стрим — и список
   растёт. Сложить их в одну вкладку нельзя: девять таблиц подряд — это
   прокрутка на три экрана, где ни один разрез не виден целиком.

   Поэтому раскладка трёхслойная:

   0. ДВА ОБЗОРА (15.10) — «Кто в команде?» и «Как оформлены и где?»: вопрос,
      вывод одной фразой, простой график под тип данных, сверху обзор —
      ниже разбивка (см. overviewWho / overviewWork). Каждый разрез — ровно
      в одном месте отчёта.
   1. СТРИМЫ ТАБЛИЦЕЙ — двухуровневый разрез с кареткой (`D.MIX_GROUPS`).
   2. ВКЛАДКА «СВОЙ СРЕЗ» — конструктор: две оси на выбор из всех разрезов.
      Готовые вкладки закрывают частые вопросы, конструктор — редкие, ради
      которых заводить пятую и шестую преднастроенную вкладку бессмысленно
      («покажи грейды отдельно у женщин и у мужчин»).

   КЛИК ПО СТРОКЕ БЕРЁТ СРЕЗ. Разбивка отвечала «сколько у нас Senior», но
   следующий вопрос всегда «а где они сидят» — и на него приходилось смотреть
   в другом отчёте. Теперь клик по строке пересчитывает численность в карточках
   KPI и в таблице подразделений слева по доле этой категории.

   Кольца здесь не появляются: доля читается по числу и полосе точнее, чем
   по углу сектора, а таблица заодно даёт абсолютные значения.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, SC=window.TPSCREENS;

/* Разрез длинный (стрим — десять строк) — сортируем по убыванию: у номинального
   разреза порядка нет, и алфавит ничего не сообщает. У порядковых (грейд, стаж,
   возраст) порядок и есть смысл, их не трогаем.

   ЦВЕТ ПОЛОСЫ ОДИН НА ВСЮ ТАБЛИЦУ и берётся у разреза (`D.dimColor`), а не у
   категории. Величину несёт длина полосы; красить строки в разные цвета —
   кодировать одно и то же дважды. Цвет при этом работает: он различает группы
   разрезов, и по нему видно, на какой вкладке стоишь. */
/* Строки ИТОГО в таблицах структуры нет (14.10): итог стоит в карточке над
   таблицами, и повторять «191 · 100%» над каждым разрезом незачем. Когда
   соседний разрез режет таблицу, её сумма другая — её и пишем у среза. */
function sliceSub(others,sum){
  return others.length?'срез: '+others.map(p=>p.cat.name).join(' · ')+' · '+D.fmtInt(sum)+' чел':'';
}
function dimTable(dim,lp,sel,mixSel){
  const parts=D.mixParts(lp,dim.key,mixSel);
  /* ПЕРЕКРЁСТНАЯ ФИЛЬТРАЦИЯ. Срез, взятый в соседней таблице, режет и эту:
     кликнули «Senior» — грейды показывают грейды сеньоров, и правая панель
     перестаёт спорить с карточками KPI над ней. Своя собственная категория из
     среза исключается, иначе таблица схлопнулась бы в одну строку и вернуться
     к другой категории стало бы нечем. */
  const others=D.otherParts(mixSel,[dim.key]);
  return U.btGroup({cap:dim.name,tip:dim.hint?{title:dim.name,text:dim.hint}:null,
    capSub:sliceSub(others,parts.reduce((a,v)=>a+v,0)),lite:true,
    /* Название разреза уже стоит подписью НАД таблицей — в шапке первой
       колонки его повторять незачем: «Грейд» и сразу под ним «ГРЕЙД» это одно
       и то же, написанное дважды. Подписаны колонки, у которых имя добавляет
       смысл: что за число и в чём оно. */
    head:'',valueHead:'Человек',metricKey:'hc_total',compact:true,sort:!!dim.sort,
    items:dim.cats.map((c,i)=>({name:c.name,value:parts[i],color:D.dimColor(dim.key),
      pick:c.id,on:sel.has(c.id)}))});
}

/* Двухуровневая разбивка: стрим раскрывается кареткой до специализаций.
   Отдельной таблицей специализаций рядом обойтись нельзя — двадцать шесть строк
   без группировки не читаются, а вопрос «из чего состоит разработка» задают
   не ко всем стримам сразу, а к одному. */
function treeTable(dim,lp,sel,mixSel,open){
  const kid=D.MIX_BY_KEY[dim.childDim];
  const tree=D.mixTree(lp,dim.key,mixSel).slice().sort((a,b)=>b.value-a.value);
  const col=D.dimColor(dim.key), items=[];
  tree.forEach(n=>{
    const on=open.has(n.cat.id);
    items.push({name:n.cat.name,value:n.value,color:col,depth:1,
      exp:n.cat.id,open:on,pick:n.cat.id,on:sel.has(n.cat.id),
      note:on?'':D.fmtInt(n.kids.length)+' '+
        U.plural(n.kids.length,['специализация','специализации','специализаций'])});
    if(!on)return;
    n.kids.slice().sort((a,b)=>b.value-a.value).forEach(k=>{
      items.push({name:k.cat.name,value:k.value,color:col,depth:2,
        pick:k.cat.id,on:sel.has(k.cat.id)});
    });
  });
  const others=D.otherParts(mixSel,[dim.key,kid.key]);
  /* Общая каретка предлагает свернуть, только когда раскрыто ВСЁ, — то же
     состояние, что у ИТОГО в сводной таблице подразделений. */
  const allOpen=tree.length>0&&tree.every(n=>open.has(n.cat.id));
  return U.btGroup({cap:dim.name,tip:dim.hint?{title:dim.name,text:dim.hint}:null,
    capSub:sliceSub(others,tree.reduce((a,n)=>a+n.value,0)),lite:true,
    head:'',valueHead:'Человек',metricKey:'hc_total',compact:true,tree:true,items:items,
    expTip:'Специализации внутри стрима.',expAll:{key:dim.key,open:allOpen}});
}

/* ---------- Обзорные главы: «Кто в команде?» и «Как оформлены и где?» ----------
   14.10 — портрет команды (вариант 2 по выбору заказчика): вопрос, вывод одной
   фразой, простой график под тип данных. 15.10 — заказчик: «вкладок перебор,
   портрет и „Какой квалификации? / Кто эти люди?“ дублируют одно и то же;
   сгруппируй в два больших вопроса в стиле портрета: сверху пилюлька —
   обзор, ниже — разбивка». Отсюда две главы вместо четырёх:
     «Кто в команде?»       — квалификация: сеньорность пилюлей, под ней грейды;
                              опыт: «из каждых 10 человек»; пол пилюлей, под
                              ней возраст столбиками, разложенными по полу;
     «Как оформлены и где?» — штат / не штат пилюлей, под ней виды не штата;
                              формат — три цифры; регионы и юрлица — полосами.
   Каждый разрез стоит ровно в одном месте отчёта: стримы — своей главой-
   таблицей, остальное — здесь. Выделено одно — главное или выбранное в
   срезе, остальное серое; база компании — чёрной засечкой или строкой
   «в компании». Клик по куску берёт срез; выводы — story.js (says). */
const pct=(a,b)=>b?Math.round(a/b*100):0;
const sumA=a=>a.reduce((x,y)=>x+y,0);
function ptRows(ctx,k,sel,ren){
  const d=D.MIX_BY_KEY[k], t=D.mixParts(ctx.lp,k,ctx.S.mixSel), b=D.mixParts(ctx.bl,k,ctx.S.mixSel);
  const st=sumA(t), sb=sumA(b);
  const rows=d.cats.map((c,i)=>({id:c.id,name:(ren&&ren[c.key])||c.name,n:t[i],p:pct(t[i],st),b:pct(b[i],sb),on:sel.has(c.id)}));
  return hiOf(rows);
}
/* выделено выбранное в срезе, иначе самое большое */
function hiOf(rows){
  const on=rows.find(r=>r.on), top=rows.reduce((m,r)=>r.n>m.n?r:m,rows[0]);
  rows.forEach(r=>{r.hi=on?r===on:r===top});
  return rows;
}
const NOTE_CUT=': карточки, таблица подразделений и обзор пересчитаются';
function ptTip(r,bench){
  return U.tipAttr({title:r.name,rows:[{label:'Команда',value:D.fmtInt(r.n)+' чел · '+r.p+'%'},{label:bench,value:r.b+'%'}],
    note:!r.id?r.why||null:r.on?'Срез по «'+r.name+'» взят. Клик снимает его.':'Клик — срез по «'+r.name+'»'+NOTE_CUT+'.'});
}
const mixAt=r=>r.id?' data-mix="'+U.esc(r.id)+'"':'';
/* полосы — та же таблица-разбивка, что во всём отчёте (16.10, «одна высота строки
   и одно форматирование у всех таблиц и списков с полосами»): название · люди ·
   доля · полоса с засечкой базы; sort — по убыванию */
function ptBars(rows,bench,o){
  o=o||{};
  const list=ptTop(o.sort?rows.slice().sort((x,y)=>y.n-x.n):rows,o);
  const max=Math.max(1,...list.map(r=>Math.max(r.p,r.b)));
  /* подпись таблицы — как у всех разбивок (bt-cap), а не серой сноской */
  return (o.cap?'<div class="bt-cap pt-cap">'+U.esc(o.cap)+'</div>':'')+
    '<table class="ptable btable lite pt-tb"><colgroup><col><col class="c-n"><col class="c-p"><col class="c-bar"></colgroup><tbody>'+
    list.map(r=>'<tr class="'+(r.id?'urow':'')+(r.hi?' hi':'')+(r.on?' sel':'')+'"'+mixAt(r)+ptTip(r,bench)+'>'+
      '<td class="txt"><span class="row-label"><span class="row-body">'+U.esc(r.name)+
        (r.sub?'<span class="unit-sub">'+U.esc(r.sub)+'</span>':'')+'</span></span></td>'+
      '<td class="lead">'+D.fmtInt(r.n)+'</td><td>'+r.p+'%</td>'+
      '<td class="barcell"><span class="cellbar"><i style="width:'+(r.p/max*100).toFixed(1)+'%"></i>'+
      '<s style="left:'+(r.b/max*100).toFixed(1)+'%"></s></span></td></tr>').join('')+'</tbody></table>';
}
/* Длинный список (юрлица, регионы — на верхних уровнях их десятки, 16.10) —
   первые PT_TOP по численности и строка «Остальные»: сколько их и сколько в
   них людей, кто именно — в подсказке. Выбранное в срезе остаётся на виду,
   даже если оно не в топе. Одну лишнюю строку не сворачиваем. */
const PT_TOP=6;
function ptTop(list,o){
  const n=o.top||0;
  if(!n||list.length<=n+1)return list;
  const keep=list.slice(0,n).concat(list.slice(n).filter(r=>r.on));
  const rest=list.filter(r=>keep.indexOf(r)<0), tot=sumA(list.map(r=>r.n)), rn=sumA(rest.map(r=>r.n));
  const shown=rest.slice().sort((x,y)=>y.n-x.n).slice(0,8);
  if(!rn)return keep;
  return keep.concat([{id:null,name:'Остальные',sub:rest.length+' '+U.plural(rest.length,o.word||['значение','значения','значений']),
    n:rn,p:pct(rn,tot),b:sumA(rest.map(r=>r.b)),hi:false,
    why:'Сложены по численности после первых '+n+': '+shown.map(r=>r.name+' — '+r.p+'%').join(', ')+
      (rest.length>shown.length?' и ещё '+(rest.length-shown.length):'')+'. Срез — по каждому из них в «Своём срезе».'}]);
}
/* пилюля по ступеням: ступени — от светлой к густой, база строкой под ней */
function ptSteps(rows,bench){
  return '<div class="pt-pill seg">'+rows.map((r,i)=>'<span class="s'+i+(r.on?' on':'')+'" data-mix="'+U.esc(r.id)+'" style="flex:'+r.p+' 1 0"'+
    ptTip(r,bench)+'>'+(r.p>=12?'<b>'+U.esc(r.name)+'</b> '+r.p+'%':r.p>=5?r.p+'%':'')+'</span>').join('')+'</div>'+
    '<div class="pt-note">в компании: '+rows.map(r=>U.esc(r.name)+' '+r.b+'%').join(' · ')+'</div>';
}
/* «из каждых 10 человек»: людей раскладываем методом наибольших остатков */
const MAN='<svg viewBox="0 0 16 30" width="22" height="40" aria-hidden="true"><circle cx="8" cy="5" r="4.5" fill="currentColor"/>'+
  '<path d="M1 30V17a7 7 0 0 1 14 0v13z" fill="currentColor"/></svg>';
function ptPeople(rows,bench){
  const ten=D.roundParts(rows.map(r=>r.p/10),10);
  let h='<div class="pt-ppl">';
  rows.forEach((r,i)=>{for(let k=0;k<ten[i];k++)h+='<span class="pt-man t'+i+'" data-mix="'+U.esc(r.id)+'"'+ptTip(r,bench)+'>'+MAN+'</span>'});
  return h+'</div><div class="pt-key">'+rows.map((r,i)=>'<span data-mix="'+U.esc(r.id)+'"'+ptTip(r,bench)+'><i class="t'+i+'"></i>'+
    U.esc(r.name)+' — <b>'+ten[i]+'</b> из 10</span>').join('')+
    '</div><div class="pt-note">в компании '+U.esc(rows[0].name.toLowerCase())+' — '+rows[0].b+'%</div>';
}
/* две категории — одна пилюля на два цвета, доли крупно над ней; кls — палитра
   ('gen' — розовый и синий по просьбе заказчика, 'emp' — выделенное и серое).
   Подпись базы прижимается к краю, если засечка у края: иначе она вылезала
   за пилюлю и наезжала на соседний график (15.10, фото заказчика). */
function ptSplit(a,b,bench,cls){
  const at=a.b<18?' l':a.b>82?' r':'';
  return '<div class="pt-two '+cls+'"><span class="a"><b>'+a.p+'%</b> '+U.esc(a.name.toLowerCase())+'</span>'+
    '<span class="b">'+U.esc(b.name.toLowerCase())+' <b>'+b.p+'%</b></span></div>'+
    '<div class="pt-pill two '+cls+'"><span class="a"'+mixAt(a)+' style="flex:'+a.p+' 1 0"'+ptTip(a,bench)+'></span>'+
    '<span class="b"'+mixAt(b)+' style="flex:'+b.p+' 1 0"'+ptTip(b,bench)+'></span>'+
    '<s class="'+at.trim()+'" style="left:'+a.b+'%"><em>в компании '+a.b+' / '+b.b+'</em></s></div>';
}
/* возраст столбиками, каждый разложен по полу (женщины снизу); база — чертой;
   подпись доли — над столбиком или чертой. m — матрица «возраст × пол». */
function ptAgeSex(rows,m,gen,bench){
  const max=Math.max(1,...rows.map(r=>Math.max(r.p,r.b)))*1.12, tot=sumA(m.map(r=>r[0]+r[1]))||1;
  return '<div class="pt-col">'+rows.map((r,i)=>{const h=r.p/max*100, bh=r.b/max*100, f=m[i][0], mm=m[i][1];
    const seg=(v,g,c)=>'<i class="'+c+'" data-mix="'+U.esc(r.id+','+g.id)+'" style="height:'+(v/tot*100/max*100).toFixed(2)+'%"'+
      U.tipAttr({title:r.name+' · '+g.name.toLowerCase(),rows:[{label:'Человек',value:D.fmtInt(v)},{label:'Доля команды',value:pct(v,tot)+'%'}],
        note:'Клик — срез по возрасту и полу сразу.'})+'></i>';
    return '<div class="c'+(r.hi?' hi':'')+'"><div class="bar" data-mix="'+U.esc(r.id)+'"'+ptTip(r,bench)+'>'+
      '<div class="v" style="bottom:calc('+Math.max(h,bh).toFixed(1)+'% + 5px)">'+r.p+'%</div>'+
      '<div class="stk">'+seg(f,gen[0],'f')+seg(mm,gen[1],'m')+'</div><s style="bottom:'+bh.toFixed(1)+'%"></s></div>'+
      '<div class="n">'+U.esc(r.name)+'</div></div>'}).join('')+'</div>';
}
/* три категории без порядка — три крупные цифры */
function ptTrio(rows,bench){
  return '<div class="pt-trio">'+rows.map(r=>'<div class="'+(r.hi?'hi':'')+'" data-mix="'+U.esc(r.id)+'"'+ptTip(r,bench)+'>'+
    '<b>'+r.p+'%</b><span>'+U.esc(r.name)+'</span><em>компания '+r.b+'%</em></div>').join('')+'</div>';
}
/* Матрица «разрез × разрез»: длинная ось (юрлица, регионы, стримы) — первые MX_TOP
   по численности и «Остальные» одной строкой или колонкой; без этого юрлица
   верхнего уровня растягивали таблицу на десятки колонок (16.10). Порядок
   остальных категорий — как в разрезе; выбранное в срезе остаётся на виду. */
const MX_TOP=8;
function mxAxis(dim,tot,sel){
  const all=dim.cats.map((_,i)=>i);
  if(all.length<=MX_TOP+1)return {dim:dim,grp:all.map(i=>[i])};
  const top=all.slice().sort((a,b)=>tot[b]-tot[a]).slice(0,MX_TOP);
  all.forEach(i=>{if(sel.has(dim.cats[i].id)&&top.indexOf(i)<0)top.push(i)});
  const keep=dim.sort?top.sort((a,b)=>tot[b]-tot[a]):top.sort((a,b)=>a-b), rest=all.filter(i=>keep.indexOf(i)<0);
  return {dim:Object.assign({},dim,{cats:keep.map(i=>dim.cats[i]).concat([{id:null,key:'_rest',other:true,
      name:'Остальные',note:rest.length+' · '+rest.map(i=>dim.cats[i].name).slice(0,8).join(', ')+(rest.length>8?' и ещё '+(rest.length-8):'')}])}),
    grp:keep.map(i=>[i]).concat([rest])};
}
function mxCap(R,C,cells,sel){
  const rt=cells.map(r=>sumA(r)), ct=C.cats.map((_,j)=>sumA(cells.map(r=>r[j])));
  const a=mxAxis(R,rt,sel), b=mxAxis(C,ct,sel);
  return {rowDim:a.dim,colDim:b.dim,cells:a.grp.map(gi=>b.grp.map(gj=>sumA(gi.map(i=>sumA(gj.map(j=>cells[i][j]))))))};
}
function ptSec(says,q,k,body,cls){
  /* в пробнике у заглушки вывода нет (story.js) — тогда подпись вопроса отступает от графика сама */
  return '<section class="pt-s'+(cls?' '+cls:'')+'"><div class="pt-q'+(says[k]?'':' solo')+'">'+U.esc(q)+'</div>'+
    (says[k]?'<h4>'+U.richText(says[k])+'</h4>':'')+body+'</section>';
}
/* Разделы обзора — две колонки, выровненные по высоте браузером (CSS columns,
   раздел не рвётся): порядок — сверху вниз по левой, затем по правой. Раньше
   разделы стояли парами по строкам, и короткий рядом с высоким оставлял пустоту
   (16.10, «не нравится пустое место»). Узко — одна колонка. */
const ptCols=secs=>'<div class="pt-cols">'+secs.filter(Boolean).join('')+'</div>';
const ptLegend=bench=>'<div class="pt-lg"><span><i></i>команда</span><span><s></s>'+U.esc(bench)+'</span></div>';
function ptCtx(ctx){
  return {S:ctx.S,sel:new Set(D.sliceParse(ctx.S.mixSel).map(p=>p.id)),says:(ctx.story||{}).says||{},bench:ctx.benchLabel};
}
/* «Кто в команде?» — квалификация, опыт, пол и возраст */
function overviewWho(ctx){
  const c=ptCtx(ctx), sel=c.sel, bench=c.bench;
  const SEN=ptRows(ctx,'seniority',sel,{l:'Lead+'}), GR=ptRows(ctx,'grade',sel), TEN=ptRows(ctx,'tenure',sel),
    AGE=ptRows(ctx,'age',sel,{a0:'до 25 лет',a45:'45+ лет'}), GEN=ptRows(ctx,'gender',sel);
  if(!sumA(SEN.map(r=>r.n)))return U.empty('Здесь никого нет','Снимите срез или один из фильтров в шапке.');
  /* стаж: выделены новички, а не самая большая группа — история про них */
  if(!TEN.some(r=>r.on))TEN.forEach((r,i)=>{r.hi=i===0});
  const m=D.mixMatrix(ctx.lp,'age','gender',ctx.S.mixSel), gen=D.MIX_BY_KEY.gender.cats;
  /* пол — пилюлей, только если категорий ровно две; в пробнике может быть ещё «не указано» */
  const two=GEN.length===2;
  /* разделы — в две колонки, которые выравниваются по высоте сами (ptCols):
     короткий «Опыт» больше не оставляет дыру рядом с высокой «Квалификацией» */
  /* порядок для колонок: слева квалификация и пол, справа опыт и возраст —
     так высоты сходятся лучше всего; возраст разложен по полу, цвета те же */
  return '<div class="pt-wrap">'+ptLegend(bench)+ptCols([
    ptSec(c.says,'Квалификация','sen',ptSteps(SEN,bench)+ptBars(GR,bench,{cap:'по грейдам'})),
    ptSec(c.says,'Пол','gen','<div class="pt-gen">'+(two?ptSplit(GEN[0],GEN[1],bench,'gen'):ptBars(GEN,bench))+'</div>'),
    ptSec(c.says,'Опыт в компании','ten',ptPeople(TEN,bench)),
    ptSec(c.says,'Возраст','age','<div class="pt-gen">'+
      (two?'<div class="bt-cap pt-cap">женщины и мужчины в каждой группе</div>'+ptAgeSex(AGE,m,gen,bench):ptBars(AGE,bench))+'</div>')])+
    '<div class="pt-more"><button class="pt-go" data-subtab="custom">Пол × грейд и другие пары — в «Своём срезе» →</button></div></div>';
}
/* «Как оформлены и где?» — штат и договор, формат, регионы, юрлица. В пробнике
   (схема 15.10) формата работы и региона нет — их разделы не рисуются, остальные
   встают парами по порядку. */
function overviewWork(ctx){
  const c=ptCtx(ctx), sel=c.sel, bench=c.bench, has=k=>!!D.MIX_BY_KEY[k];
  const EMP=ptRows(ctx,'employment',sel), LEG=has('legal')?ptRows(ctx,'legal',sel):null,
    FMT=has('worksite')?ptRows(ctx,'worksite',sel):null, REG=has('region')?ptRows(ctx,'region',sel):null,
    CON=has('contract')?ptRows(ctx,'contract',sel):null;
  if(!sumA(EMP.map(r=>r.n)))return U.empty('Здесь никого нет','Снимите срез или один из фильтров в шапке.');
  /* штат / не штат — одна пилюля; не штат собран из четырёх видов оформления */
  const non=EMP.slice(1), nonN=sumA(non.map(r=>r.n)), tot=EMP[0].n+nonN;
  /* клик по «не штату» среза не берёт: это четыре категории, срез — по одной из них ниже */
  const staff=EMP[0], other={id:null,name:'Не штат',n:nonN,p:pct(nonN,tot),b:100-staff.b,
    why:non.length+' '+U.plural(non.length,['вид','вида','видов'])+' оформления. Срез — по одному из них в полосах ниже.'};
  const pill=ptSplit(staff,other,bench,'emp');
  hiOf(non);
  /* тип договора — своим разделом (16.10): внутри «Оформления» он делал его втрое
     выше соседа, и рядом с «Форматом работы» зияла пустота */
  const con=CON?(CON.length===2?ptSplit(CON[0],CON[1],bench,'emp'):ptBars(CON,bench,{sort:true})):'';
  return '<div class="pt-wrap">'+ptLegend(bench)+ptCols([
    ptSec(c.says,'Оформление','emp',pill+ptBars(non,bench,{cap:'не штат — по видам оформления'})),
    CON?ptSec(c.says,'Тип договора','con',con):'',
    FMT?ptSec(c.says,'Формат работы','fmt',ptTrio(FMT,bench)):'',
    REG?ptSec(c.says,'Где работают','reg',ptBars(REG,bench,{sort:true,top:PT_TOP,word:['регион','региона','регионов']})):'',
    LEG?ptSec(c.says,'Юрлицо','legal',ptBars(LEG,bench,{sort:true,top:PT_TOP,word:['юрлицо','юрлица','юрлиц']})):''])+'</div>';
}

SC.blocks.structure={
  /* 15.10: четыре главы вместо шести — два обзора, стримы таблицей и конструктор */
  subTabs:[['portrait','Кто в команде'],['work','Оформление и место']].concat(D.MIX_GROUPS.map(g=>[g.key,g.name])).concat([['custom','Свой срез']]),
  defaultSub:'portrait',
  title(sub){
    if(sub==='portrait')return 'Кто в команде: квалификация, опыт, пол и возраст';
    if(sub==='work')return D.MIX_BY_KEY.region?'Как оформлены и где работают':'Как оформлены';
    if(sub!=='custom'){
      const g=D.MIX_GROUPS.find(x=>x.key===sub);
      return g?g.title:'Состав численности по атрибутам';
    }
    return 'Свой срез состава';
  },
  view(ctx){
    if(ctx.sub==='portrait')return overviewWho(ctx);
    if(ctx.sub==='work')return overviewWork(ctx);
    const S=ctx.S, sel=new Set(D.sliceParse(S.mixSel).map(p=>p.id));

    if(ctx.sub!=='custom'){
      const g=D.MIX_GROUPS.find(x=>x.key===ctx.sub)||D.MIX_GROUPS[0];
      const open=ctx.mixOpen||new Set();
      /* Сноска о клике стоит под таблицами, а не над ними: пока среза нет,
         это подсказка, а не сообщение, и место в кадре она забирать не должна.
         Когда срез взят, о нём говорит плашка над рабочей зоной. */
      return U.btStack(g.dims.map(k=>{
        const dim=D.MIX_BY_KEY[k];
        return dim.childDim?treeTable(dim,ctx.lp,sel,S.mixSel,open)
                           :dimTable(dim,ctx.lp,sel,S.mixSel);
      }),'lite')+
        (sel.size?'':'<div class="tbl-note">Клик по строке — срез: карточки и таблица подразделений '+
          'пересчитаются по этой категории.</div>');
    }

    /* Конструктор. Ось колонок можно снять — тогда остаётся обычная разбивка
       одним разрезом: тот же вопрос, что на готовых вкладках, но по любому
       из девяти атрибутов. */
    const rowDim=D.MIX_BY_KEY[S.mixRows]||D.MIX_DIMS[0];
    const colDim=S.mixCols&&S.mixCols!==rowDim.key?D.MIX_BY_KEY[S.mixCols]:null;
    let h=U.mixPicker({dims:D.MIX_DIMS,rows:rowDim.key,cols:colDim?colDim.key:'',mode:S.mixMode});

    if(!colDim){
      h+=rowDim.childDim?treeTable(rowDim,ctx.lp,sel,S.mixSel,ctx.mixOpen||new Set())
                        :dimTable(rowDim,ctx.lp,sel,S.mixSel);
      return h+'<div class="tbl-note">Выберите колонки — получится таблица «разрез × разрез», '+
        'например «грейд × пол».</div>';
    }
    /* Срез по оси матрицы её собственную ось не режет — иначе колонка «Мужчины»
       обнулилась бы и вернуться к ней стало бы нечем. Что при этом дошло до
       чисел, а что нет, пишем прямо над таблицей. */
    const axes=[rowDim.key,colDim.key];
    const outer=D.otherParts(S.mixSel,axes);
    const inner=D.sliceParse(S.mixSel).filter(p=>axes.indexOf(p.dim.key)>=0);
    const cap=[outer.length?'срез: '+outer.map(p=>p.cat.name).join(' · '):'',
      inner.length?'выделено в таблице: '+inner.map(p=>p.cat.name).join(' · '):'']
      .filter(Boolean).join('  ·  ');
    const mx=mxCap(rowDim,colDim,D.mixMatrix(ctx.lp,rowDim.key,colDim.key,S.mixSel),sel);
    h+=U.matrixTable({rowDim:mx.rowDim,colDim:mx.colDim,mode:S.mixMode,sel:sel,cap:cap,cells:mx.cells});
    return h+'<div class="tbl-note">Клик по клетке — срез по двум разрезам сразу, по названию строки '+
      'или колонки — по одному. Сумма клеток равна численности в карточках.</div>';
  }
};
})();

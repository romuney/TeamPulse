/* ============================================================================
   screens/structure.js — Структура численности.

   Разрезов состава в HR-борде не три и не пять: грейд, сеньорность, пол,
   возраст, стаж, тип занятости, формат работы, юрлицо, стрим — и список
   растёт. Сложить их в одну вкладку нельзя: девять таблиц подряд — это
   прокрутка на три экрана, где ни один разрез не виден целиком.

   21.10 — раскладка по файлу «Структура» (п. 8 правок Антона; у файла приоритет):
   1. «Портрет сотрудника» — блоки сверху вниз: пол (полоса М : Ж и две карточки со средним
      возрастом), возраст (полоса до 25 / 25–30 / 30+ и карточки с раскладом М · Ж), регион.
      26.10: воронки численности (юридическая → активная → HQ) нет — заказчик её не делает.
   2. «Уровень позиции» — три таблицы: сеньорность, грейд, стаж.
   3. «Оформление» — три таблицы по убыванию: тип занятости, формат, компания (22.10).
   22.10: регион — таблицей внизу портрета; таблицы вкладок — в столбик; строки — только те,
   что есть в данных; в конструкторе нет «Остальных».
   4. «Стримы» — дерево «стрим → специализации»: клик по стриму раскрывает его,
      Shift+клик выбирает все специализации стрима.
   5. «Конструктор» — сводная таблица двух измерений с тепловой заливкой,
      «Итого» по строкам и колонкам, полный экран.

   КЛИК ПО СТРОКЕ, КУСКУ ПОЛОСЫ, КАРТОЧКЕ ИЛИ КЛЕТКЕ БЕРЁТ СРЕЗ. Срез пересчитывает
   все разрезы (кроме своего), карточки KPI и таблицу подразделений слева; срезы по
   разным разрезам складываются. Shift+клик — несколько категорий одного разреза
   («Junior или Middle»). Escape и «Сбросить всё» снимают срез целиком.

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
function dimTable(dim,lp,sel,mixSel,o){
  o=o||{};
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
    head:'',valueHead:'Чел.',barHead:'',heads:true,metricKey:'hc_total',compact:true,sort:!!(o.sort||dim.sort),
    /* длинный список (компании на верхних уровнях — десятки, 16.10): первые o.top и «Остальные» */
    top:o.top||0,restWord:o.word,restKey:o.restKey,restOpen:o.restOpen,
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
  /* 23.10, заказчик: один стрим раскрыт сразу (самый большой) — видно, что таблица сводная и раскрывается.
     Один раз за сессию: дальше раскрытое — как оставил пользователь */
  if(open&&!open._seeded){open._seeded=true;if(!open.size&&tree[0]&&tree[0].value>0)open.add(tree[0].cat.id)}
  const col=D.dimColor(dim.key), items=[];
  tree.forEach(n=>{
    const on=open.has(n.cat.id), nk=n.kids.filter(k=>k.value>0).length;
    items.push({name:n.cat.name,value:n.value,color:col,depth:1,
      exp:n.cat.id,open:on,pick:n.cat.id,on:sel.has(n.cat.id),expRow:true,
      note:D.fmtInt(nk)+' '+U.plural(nk,['специализация','специализации','специализаций'])});
    if(!on)return;
    /* специализации — только те, что есть в данных (люди есть); на бою имя пары «стрим|специализация» — короткое */
    n.kids.filter(k=>k.value>0||sel.has(k.cat.id)).sort((a,b)=>b.value-a.value).forEach(k=>{
      items.push({name:k.cat.short||k.cat.name,value:k.value,color:col,depth:2,
        pick:k.cat.id,on:sel.has(k.cat.id)});
    });
  });
  const others=D.otherParts(mixSel,[dim.key,kid.key]);
  /* Общая каретка предлагает свернуть, только когда раскрыто ВСЁ, — то же
     состояние, что у ИТОГО в сводной таблице подразделений. */
  const allOpen=tree.length>0&&tree.filter(n=>n.value>0).every(n=>open.has(n.cat.id));
  return U.btGroup({cap:dim.name,tip:dim.hint?{title:dim.name,text:dim.hint}:null,
    capSub:sliceSub(others,tree.reduce((a,n)=>a+n.value,0)),lite:true,
    head:'',valueHead:'Чел.',barHead:'',heads:true,metricKey:'hc_total',compact:true,tree:true,items:items,
    expTip:'Специализации внутри стрима.',expAll:{key:dim.key,open:allOpen}});
}

/* ---------- Портрет сотрудника ----------
   Блоки сверху вниз: пол, возраст, регион (26.10: без воронки численности). */
const sumA=a=>a.reduce((x,y)=>x+y,0);
const pc=(a,b)=>b?Math.round(a/b*100):0;
const num1=v=>v==null?'—':(Math.round(v*10)/10).toFixed(1).replace('.',',');
/* мужчины первыми: «М : Ж» — так в файле; категория пола узнаётся по имени */
const isMale=c=>/^м|муж|male|^m$/i.test(c.name)||c.key==='m';
/* в данных пол в единственном числе («Женщина»), на полосе и карточках — во множественном */
const GEN_PL={'женщина':'Женщины','мужчина':'Мужчины','женский':'Женщины','мужской':'Мужчины'};
const genName=c=>GEN_PL[String(c.name).toLowerCase()]||c.name;
function ratio(m,f){
  if(!m||!f)return '';
  return m>=f?'М : Ж = '+num1(m/f)+' : 1':'М : Ж = 1 : '+num1(f/m);
}
function genderBlock(ctx,sel){
  const S=ctx.S, G=D.MIX_BY_KEY.gender;
  if(!G)return '';
  const v=D.mixParts(ctx.lp,'gender',S.mixSel), cats=G.cats;
  const order=cats.map((c,i)=>i).sort((a,b)=>isMale(cats[b])-isMale(cats[a]));
  const mi=order[0], fi=order[1];
  const segs=order.map(i=>({id:cats[i].id,name:genName(cats[i]),n:v[i],bg:isMale(cats[i])?'var(--pt-m)':cats[i].na?'var(--pt-na)':'var(--pt-f)',on:sel.has(cats[i].id)}));
  const age=i=>{const a=D.avgAge(ctx.lp,S.mixSel,'gender',i);return a==null?'':'средний возраст <b>'+num1(a)+'</b>'};
  /* 23.10: в карточках — фигурки «мальчик / девочка» цветом категории */
  const gIco=c=>c.na?'':isMale(c)?'male':'female';
  return '<section class="pf-s">'+U.pfHead('Пол',ratio(v[mi],v[fi]),'people')+
    U.shareBar({segs:segs,names:true})+
    U.shareCards({cards:order.map(i=>({id:cats[i].id,name:genName(cats[i]),n:v[i],sub:age(i),bg:segs[order.indexOf(i)].bg,
      icon:gIco(cats[i]),on:sel.has(cats[i].id)}))})+'</section>';
}
/* ступени возраста — от светлой к густой, как у порядковых шкал отчёта */
const RAMP=['var(--pt-s1)','var(--pt-s2)','var(--pt-s3)','var(--pt-s4)','var(--pt-s5)'];
function ageBlock(ctx,sel){
  const S=ctx.S, A=D.MIX_BY_KEY.age, G=D.MIX_BY_KEY.gender;
  if(!A)return '';
  const v=D.mixParts(ctx.lp,'age',S.mixSel), m=G?D.mixMatrix(ctx.lp,'age','gender',S.mixSel):null;
  /* матрица свои оси срезом не режет; в карточке возраста срез по полу действует —
     в срезе «Женщины» расклад «М 0% · Ж 100%», а не по всей команде */
  const gSel=G?G.cats.map(c=>sel.has(c.id)):[];
  if(m&&gSel.some(Boolean))m.forEach(r=>r.forEach((_,j)=>{if(!gSel[j])r[j]=0}));
  const gi=G?G.cats.map((c,i)=>i):[], mi=gi.find(i=>isMale(G.cats[i])), fi=gi.find(i=>!isMale(G.cats[i]));
  const known=A.cats.filter(c=>!c.na).length;
  const ri=i=>Math.min(RAMP.length-1,Math.round(i*(RAMP.length-1)/Math.max(1,known-1)));
  const bg=(c,i)=>c.na?'var(--pt-na)':RAMP[ri(i)];
  /* белый текст — только на двух густых ступенях: на светлых (23.10 — палитра светлее) он не читается */
  const segs=A.cats.map((c,i)=>({id:c.id,name:c.name,n:v[i],bg:bg(c,i),dk:!c.na&&ri(i)>=3,on:sel.has(c.id)}));
  const avg=D.avgAge(ctx.lp,S.mixSel);
  return '<section class="pf-s">'+U.pfHead('Возраст',avg==null?'':'средний возраст команды — <b>'+num1(avg)+'</b>','hourglass')+
    U.shareBar({segs:segs,names:true})+
    U.shareCards({cards:A.cats.map((c,i)=>({id:c.id,name:c.name,n:v[i],bg:segs[i].bg,on:sel.has(c.id),
      sub:m&&mi!=null&&fi!=null?U.genderSplit(m[i][mi],m[i][fi]):''}))})+'</section>';
}
/* регион (22.10) — внизу портрета таблицей: регионов десятки, полоса из них не читается. 23.10, заказчик: первые
   десять и «Остальные» (кто в них — в подсказке). Нет разреза или в отборе ни у кого нет региона — блока нет */
function regionBlock(ctx,sel){
  const S=ctx.S, R=D.MIX_BY_KEY.region;
  if(!R||!D.mixParts(ctx.lp,'region',S.mixSel).some(v=>v>0))return '';
  return tableBlock(ctx,'region',sel,'pin',{sort:true,top:10,word:['регион','региона','регионов']});
}
function portrait(ctx){
  const S=ctx.S, sel=new Set(D.sliceParse(S.mixSel).map(p=>p.id));
  if(!Math.round(D.lastValSlice(ctx.lp,'hc_total',S.mixSel)))return U.empty('Здесь никого нет','Снимите срез или один из фильтров в шапке.');
  return '<div class="pf">'+genderBlock(ctx,sel)+ageBlock(ctx,sel)+regionBlock(ctx,sel)+'</div>';
}

/* ---------- «Уровень позиции» и «Оформление» (23.10) ----------
   Заказчик: визуализация одна на весь отчёт — разбивка «сверху вниз» везде одной и той же таблицей с полосой
   (dimTable, как у стримов, компаний, регионов), доля категорий — пилюлей с карточками, как в портрете. Своих
   полос, столбцов и карточек у вкладок нет. «Уровень позиции»: стаж — пилюлей сверху (она же фильтр: клик режет
   сеньорность и грейды), сеньорность и грейды — таблицами (значений бывает много); разбивки М · Ж здесь нет — её
   нет и в «Оформлении», и в «Стримах». «Оформление»: тип занятости, формат работы, тип компании — пилюлей с
   карточками (по три в ряд), компания — таблицей. */
const selOf=S=>new Set(D.sliceParse(S.mixSel).map(p=>p.id));
const has=(ctx,k)=>D.MIX_BY_KEY[k]&&D.mixParts(ctx.lp,k,ctx.S.mixSel).some(v=>v>0);
function topOf(dim,v){
  const tot=sumA(v);let b=-1;v.forEach((x,i)=>{if(x>0&&!dim.cats[i].na&&(b<0||x>v[b]))b=i});
  return b<0||!tot?'':'чаще всего — <b>'+U.esc(dim.cats[b].name)+'</b> ('+pc(v[b],tot)+'%)';
}
/* разбивка таблицей под заголовком раздела с иконкой — та же dimTable, что у стримов и компаний */
function tableBlock(ctx,key,sel,icon,o){
  const S=ctx.S, A=D.MIX_BY_KEY[key];
  /* длинный список — первые N и «Остальные», которые раскрываются (Антон, 23.10) */
  if(o&&o.top)o=Object.assign({restKey:'rest:'+key,restOpen:!!(ctx.mixOpen&&ctx.mixOpen.has('rest:'+key))},o);
  return '<section class="pf-s">'+U.pfHead(A.name,topOf(A,D.mixParts(ctx.lp,key,S.mixSel)),icon)+
    dimTable(Object.assign({},A,{name:'',hint:null}),ctx.lp,sel,S.mixSel,o||{})+'</section>';
}
/* стаж — порядковый: пилюля ступенями от светлой к густой, без карточек */
function tenurePill(ctx,sel){
  const S=ctx.S, A=D.MIX_BY_KEY.tenure, v=D.mixParts(ctx.lp,'tenure',S.mixSel);
  const idx=A.cats.map((c,i)=>i).filter(i=>v[i]>0||sel.has(A.cats[i].id)), known=idx.filter(i=>!A.cats[i].na);
  const ri=i=>Math.min(RAMP.length-1,Math.round(known.indexOf(i)*(RAMP.length-1)/Math.max(1,known.length-1)));
  return '<section class="pf-s">'+U.pfHead(A.name,topOf(A,v),'calendar')+
    U.shareBar({segs:idx.map(i=>{const c=A.cats[i];return {id:c.id,name:c.name,n:v[i],bg:c.na?'var(--pt-na)':RAMP[ri(i)],dk:!c.na&&ri(i)>=3,on:sel.has(c.id)}}),names:true})+'</section>';
}
function levelView(ctx){
  const S=ctx.S, sel=selOf(S);
  if(!Math.round(D.lastValSlice(ctx.lp,'hc_total',S.mixSel)))return U.empty('Здесь никого нет','Снимите срез или один из фильтров в шапке.');
  return '<div class="pf">'+(has(ctx,'tenure')?tenurePill(ctx,sel):'')+(has(ctx,'seniority')?tableBlock(ctx,'seniority',sel,'stairs'):'')+
    (has(ctx,'grade')?tableBlock(ctx,'grade',sel,'grade'):'')+'</div>'+clickNote(sel);
}
/* номинальный разрез: пилюля по убыванию (самое большое — основным тоном, остальные — светлее) и карточки по три в ряд;
   тона через ступень, чтобы соседние куски различались; пятый и дальше — серо-голубой, а не почти белый */
const NOM=['var(--pt-s5)','var(--pt-s3)','var(--pt-s2)','var(--pt-s1)','var(--pt-t1)'];
const WS_ICO=n=>/гибрид/i.test(n)?'hybrid':/удал|дистан/i.test(n)?'home':/офис/i.test(n)?'office':'';
function nomBlock(ctx,key,sel,icon,cardIco){
  const S=ctx.S, A=D.MIX_BY_KEY[key], v=D.mixParts(ctx.lp,key,S.mixSel);
  const idx=A.cats.map((c,i)=>i).filter(i=>v[i]>0||sel.has(A.cats[i].id)).sort((a,b)=>v[b]-v[a]);
  const segs=idx.map((i,k)=>({id:A.cats[i].id,name:A.cats[i].name,n:v[i],bg:A.cats[i].na?'var(--pt-na)':NOM[Math.min(NOM.length-1,k)],dk:k===0&&!A.cats[i].na,on:sel.has(A.cats[i].id)}));
  return '<section class="pf-s">'+U.pfHead(A.name,topOf(A,v),icon)+U.shareBar({segs:segs,names:true})+
    U.shareCards({cards:segs.map(x=>({id:x.id,name:x.name,n:x.n,bg:x.bg,on:x.on,icon:cardIco?cardIco(x.name):'',sub:pc(x.n,sumA(v))+'% команды'}))})+'</section>';
}
function workView(ctx){
  const S=ctx.S, sel=selOf(S);
  if(!Math.round(D.lastValSlice(ctx.lp,'hc_total',S.mixSel)))return U.empty('Здесь никого нет','Снимите срез или один из фильтров в шапке.');
  /* 23.10, Антон: порядок — тип занятости, формат работы, тип компании, компания */
  return '<div class="pf">'+(has(ctx,'employment')?nomBlock(ctx,'employment',sel,'case'):'')+
    (has(ctx,'worksite')?nomBlock(ctx,'worksite',sel,'office',WS_ICO):'')+
    (has(ctx,'ctype')?nomBlock(ctx,'ctype',sel,'company'):'')+
    (has(ctx,'legal')?tableBlock(ctx,'legal',sel,'company',{sort:true,top:8,word:['компания','компании','компаний']}):'')+
    '</div>'+clickNote(sel);
}
function clickNote(sel){
  return sel.size?'':'<div class="tbl-note">Клик по строке, куску полосы или карточке — срез: пересчитаются все разрезы и таблица подразделений. Shift+клик — добавить к срезу.</div>';
}

/* ---------- Конструктор ----------
   Измерения — по файлу «Структура»: сеньорность, грейд, стаж, пол, возраст, стрим,
   компания, занятость, формат, регион; специализация — только в строках (в колонках её
   десятки). 22.10: «Остальных» нет — все значения явно; строк и колонок без людей нет. */
const CON_DIMS=['seniority','grade','tenure','gender','age','stream','ctype','legal','employment','worksite','region'];
const conDims=()=>CON_DIMS.filter(k=>D.MIX_BY_KEY[k]).map(k=>D.MIX_BY_KEY[k]);
function mxAxis(dim,tot,sel){
  const keep=dim.cats.map((_,i)=>i).filter(i=>tot[i]>0||sel.has(dim.cats[i].id));
  if(dim.sort)keep.sort((a,b)=>tot[b]-tot[a]);
  return {dim:Object.assign({},dim,{cats:keep.map(i=>dim.cats[i])}),grp:keep.map(i=>[i])};
}
function mxCap(R,C,cells,sel){
  const rt=cells.map(r=>sumA(r)), ct=C.cats.map((_,j)=>sumA(cells.map(r=>r[j])));
  const a=mxAxis(R,rt,sel), b=mxAxis(C,ct,sel);
  return {rowDim:a.dim,colDim:b.dim,cells:a.grp.map(gi=>b.grp.map(gj=>sumA(gi.map(i=>sumA(gj.map(j=>cells[i][j]))))))};
}
function constructor_(ctx){
  const S=ctx.S, sel=new Set(D.sliceParse(S.mixSel).map(p=>p.id)), dims=conDims();
  const rowList=dims.concat(D.MIX_BY_KEY.spec?[D.MIX_BY_KEY.spec]:[]);
  const R=rowList.find(d=>d.key===S.mixRows)||dims[0];
  const C=dims.find(d=>d.key===S.mixCols)||dims.find(d=>d.key!==R.key);
  let h=U.mixPicker({rowDims:rowList,colDims:dims,rows:R.key,cols:C.key,mode:S.mixMode,full:!!S.mxFull,
    swapNo:R.key==='spec'?'Специализация бывает только в строках.':''});
  if(R.key===C.key){
    h+=U.empty('Выберите разные измерения','В строках и колонках сейчас «'+R.name+'». Поставьте в колонки другое измерение — например, «Пол».');
  } else {
    const axes=[R.key,C.key];
    const outer=D.otherParts(S.mixSel,axes);
    const inner=D.sliceParse(S.mixSel).filter(p=>axes.indexOf(p.dim.key)>=0);
    const cap=[outer.length?'срез: '+outer.map(p=>p.cat.name).join(' · '):'',
      inner.length?'выделено в таблице: '+inner.map(p=>p.cat.name).join(' · '):''].filter(Boolean).join('  ·  ');
    const mx=mxCap(R,C,D.mixMatrix(ctx.lp,R.key,C.key,S.mixSel),sel);
    h+=U.matrixTable({rowDim:mx.rowDim,colDim:mx.colDim,mode:S.mixMode,sel:sel,cap:cap,cells:mx.cells})+
      '<div class="mx-foot">'+U.heatLegend()+'<span class="tbl-note">Клик по клетке — срез сразу по двум измерениям, по названию строки или колонки — по одному. '+
      /* 26.10-б, правки п. 6: итоги строк и колонок — точные (те же числа, что в разбивках вкладки, сумма — численность
         в карточках); клетки — оценка: в данных отчёта по каждому признаку есть только своё распределение, совместного
         (например, «женщины × грейд 13») нет. Клетка — доли признаков, перемноженные по каждому подразделению и подогнанные
         к итогам. Точные клетки — с таблицей состава по людям («Жду от вас», запрос 0к) */
      (D.REAL?'Итоги строк и колонок — точные. <b>Клетки — оценка</b> по долям подразделений: пар признаков в данных нет.'
        :'Сумма клеток равна численности в карточках.')+'</span></div>';
  }
  return S.mxFull?'<div class="mx-full"><div class="mx-full-h">Конструктор состава · '+U.esc((D.NODE_BY_PATH[ctx.sel]||{}).name||'')+'</div>'+h+'</div>':h;
}

SC.blocks.structure={
  /* 21.10, файл «Структура»: портрет и четыре вкладки разрезов */
  subTabs:[['portrait','Портрет сотрудника'],['level','Уровень позиции'],['work','Оформление']]
    .concat(D.MIX_BY_KEY.stream?[['stream','Стримы']]:[]).concat([['custom','Конструктор']]),
  defaultSub:'portrait',
  title(sub){
    if(sub==='portrait')return 'Портрет сотрудника · пол · возраст · регион';
    if(sub==='level')return 'Уровень позиции: сеньорность, грейд, стаж';
    if(sub==='work')return 'Оформление: тип занятости, формат работы, компания';
    if(sub==='stream')return 'Стримы и специализации';
    return 'Конструктор: два измерения в одной таблице';
  },
  view(ctx){
    if(ctx.sub==='portrait')return portrait(ctx);
    /* 23.10: историей, как портрет */
    if(ctx.sub==='level')return levelView(ctx);
    /* 22.10: порядок — тип занятости, формат работы, компания */
    if(ctx.sub==='work')return workView(ctx);
    if(ctx.sub==='stream'){
      const S=ctx.S, sel=new Set(D.sliceParse(S.mixSel).map(p=>p.id)), dim=D.MIX_BY_KEY.stream;
      if(!dim)return U.empty('Стримов нет в данных','');
      return (dim.childDim?treeTable(dim,ctx.lp,sel,S.mixSel,ctx.mixOpen||new Set())
        :U.btStack(['stream','spec'].filter(k=>D.MIX_BY_KEY[k]).map(k=>dimTable(D.MIX_BY_KEY[k],ctx.lp,sel,S.mixSel,{sort:true})),'lite'))+
        '<div class="tbl-note">Клик по стриму — раскрыть специализации, Shift+клик — выбрать все специализации стрима. '+
        'Клик по специализации — срез по ней, Shift+клик — добавить к срезу.</div>';
    }
    return constructor_(ctx);
  }
};
})();

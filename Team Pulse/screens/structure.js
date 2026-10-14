/* ============================================================================
   screens/structure.js — Структура численности.

   Разрезов состава в HR-борде не три и не пять: грейд, сеньорность, пол,
   возраст, стаж, тип занятости, формат работы, юрлицо, стрим — и список
   растёт. Сложить их в одну вкладку нельзя: девять таблиц подряд — это
   прокрутка на три экрана, где ни один разрез не виден целиком.

   Поэтому раскладка трёхслойная:

   0. «ПОРТРЕТ КОМАНДЫ» (14.10) — первая глава: вся структура одним рассказом,
      шесть вопросов с выводами и простыми графиками (см. portrait ниже).
      Таблицы — во второй слой.
   1. ПРЕДНАСТРОЕННЫЕ ВКЛАДКИ по смыслу вопроса — квалификация, люди,
      оформление и место, стримы. Группы объявлены в `D.MIX_GROUPS`, правило:
      на вкладке не больше четырёх лёгких таблиц (без шапки и ИТОГО). Так
      каждая вкладка отвечает на один вопрос целиком.
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
    expAll:{key:dim.key,open:allOpen}});
}

/* ---------- «Портрет команды» (14.10, вариант 2 по выбору заказчика) ----------
   Первая глава структуры — рассказ сверху вниз: вопрос, вывод одной фразой,
   простой график. Первый вариант (карта стримов, профиль из восьми полос,
   пирамида) заказчик не принял: «сложно считывается». Теперь у каждого
   вопроса своя форма — под тип данных, а не одна на всех:
     чем заняты (много категорий)        — горизонтальные полосы, топ-6;
     квалификация (несколько ступеней)   — одна пилюля, разрезанная по ступеням;
     стаж (доля)                         — «из каждых 10 человек» человечками;
     возраст (шкала)                     — столбики;
     пол (две категории)                 — одна пилюля на два цвета;
     формат работы и штат                — три крупные цифры и шкала с отметкой.
   Цветом выделено одно — главное (или выбранное в срезе), остальное серое.
   База компании везде одним языком: чёрная засечка или строка «в компании».
   Клик по куску берёт срез, как строка таблицы; выводы — story.js (says). */
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
function ptTip(r,bench,what){
  return U.tipAttr({title:r.name,rows:[{label:'Команда',value:D.fmtInt(r.n)+' чел · '+r.p+'%'},{label:bench,value:r.b+'%'}],
    note:r.on?'Срез по «'+r.name+'» взят. Клик снимает его.':'Клик — срез по «'+r.name+'»'+(what||'')+'.'});
}
const NOTE_CUT=': карточки, таблица подразделений и портрет пересчитаются';
/* полосы: подпись · полоса с засечкой базы · доля и люди */
function ptBars(rows,bench,more){
  const max=Math.max(1,...rows.map(r=>Math.max(r.p,r.b)));
  return '<div class="pt-hb">'+rows.map(r=>'<div class="pt-row'+(r.hi?' hi':'')+'" data-mix="'+U.esc(r.id)+'"'+ptTip(r,bench,NOTE_CUT)+'>'+
    '<span class="l">'+U.esc(r.name)+'</span><span class="b"><i style="width:'+(r.p/max*100).toFixed(1)+'%"></i>'+
    '<s style="left:'+(r.b/max*100).toFixed(1)+'%"></s></span><span class="v">'+r.p+'%<em>'+D.fmtInt(r.n)+'</em></span></div>').join('')+
    (more?'<div class="pt-more-row">'+U.esc(more)+'</div>':'')+'</div>';
}
/* пилюля по ступеням: ступени — от светлой к густой, база строкой под ней */
function ptSteps(rows,bench){
  return '<div class="pt-pill seg">'+rows.map((r,i)=>'<span class="s'+i+(r.on?' on':'')+'" data-mix="'+U.esc(r.id)+'" style="flex:'+r.p+' 1 0"'+
    ptTip(r,bench,NOTE_CUT)+'>'+(r.p>=12?'<b>'+U.esc(r.name)+'</b> '+r.p+'%':r.p>=5?r.p+'%':'')+'</span>').join('')+'</div>'+
    '<div class="pt-note">в компании: '+rows.map(r=>U.esc(r.name)+' '+r.b+'%').join(' · ')+'</div>';
}
/* «из каждых 10 человек»: людей раскладываем методом наибольших остатков */
const MAN='<svg viewBox="0 0 16 30" width="22" height="40" aria-hidden="true"><circle cx="8" cy="5" r="4.5" fill="currentColor"/>'+
  '<path d="M1 30V17a7 7 0 0 1 14 0v13z" fill="currentColor"/></svg>';
function ptPeople(rows,bench){
  const ten=D.roundParts(rows.map(r=>r.p/10),10);
  let h='<div class="pt-ppl">';
  rows.forEach((r,i)=>{for(let k=0;k<ten[i];k++)h+='<span class="pt-man t'+i+'" data-mix="'+U.esc(r.id)+'"'+ptTip(r,bench,NOTE_CUT)+'>'+MAN+'</span>'});
  return h+'</div><div class="pt-key">'+rows.map((r,i)=>'<span data-mix="'+U.esc(r.id)+'"><i class="t'+i+'"></i>'+U.esc(r.name)+' — <b>'+ten[i]+'</b> из 10</span>').join('')+
    '</div><div class="pt-note">в компании '+U.esc(rows[0].name.toLowerCase())+' — '+rows[0].b+'%</div>';
}
/* столбики по шкале, база — чертой; подпись — над столбиком или чертой */
function ptCols(rows,bench){
  const max=Math.max(1,...rows.map(r=>Math.max(r.p,r.b)))*1.12;
  return '<div class="pt-col">'+rows.map(r=>{const h=r.p/max*100, bh=r.b/max*100;
    return '<div class="c'+(r.hi?' hi':'')+'" data-mix="'+U.esc(r.id)+'"'+ptTip(r,bench,NOTE_CUT)+'><div class="bar">'+
      '<div class="v" style="bottom:calc('+Math.max(h,bh).toFixed(1)+'% + 5px)">'+r.p+'%</div>'+
      '<i style="height:'+h.toFixed(1)+'%"></i><s style="bottom:'+bh.toFixed(1)+'%"></s></div>'+
      '<div class="n">'+U.esc(r.name)+'</div></div>'}).join('')+'</div>';
}
/* две категории — одна пилюля на два цвета, доли крупно над ней */
function ptSplit(a,b,bench){
  return '<div class="pt-two"><span class="a"><b>'+a.p+'%</b> '+U.esc(a.name.toLowerCase())+'</span>'+
    '<span class="b">'+U.esc(b.name.toLowerCase())+' <b>'+b.p+'%</b></span></div>'+
    '<div class="pt-pill two"><span class="a" data-mix="'+U.esc(a.id)+'" style="flex:'+a.p+' 1 0"'+ptTip(a,bench,NOTE_CUT)+'></span>'+
    '<span class="b" data-mix="'+U.esc(b.id)+'" style="flex:'+b.p+' 1 0"'+ptTip(b,bench,NOTE_CUT)+'></span>'+
    '<s style="left:'+a.b+'%"><em>в компании '+a.b+' / '+b.b+'</em></s></div>';
}
/* три категории без порядка — три крупные цифры */
function ptTrio(rows,bench){
  return '<div class="pt-trio">'+rows.map(r=>'<div class="'+(r.hi?'hi':'')+'" data-mix="'+U.esc(r.id)+'"'+ptTip(r,bench,NOTE_CUT)+'>'+
    '<b>'+r.p+'%</b><span>'+U.esc(r.name)+'</span><em>компания '+r.b+'%</em></div>').join('')+'</div>';
}
/* одна доля против ориентира — шкала с отметкой компании */
function ptBullet(r,label,bench){
  return '<div class="pt-bul" data-mix="'+U.esc(r.id)+'"'+ptTip(r,bench,NOTE_CUT)+'><div class="t"><i style="width:'+r.p+'%"></i>'+
    '<s style="left:'+r.b+'%"><em>в компании '+r.b+'%</em></s></div><div class="pt-note"><b>'+r.p+'%</b> '+U.esc(label)+'</div></div>';
}
function portrait(ctx){
  const S=ctx.S, sel=new Set(D.sliceParse(S.mixSel).map(p=>p.id)), says=(ctx.story||{}).says||{}, bench=ctx.benchLabel;
  /* в пробнике у заглушки вывода нет (story.js) — тогда подпись вопроса отступает от графика сама */
  const sec=(q,k,body,cls)=>'<section class="pt-s'+(cls?' '+cls:'')+'"><div class="pt-q'+(says[k]?'':' solo')+'">'+U.esc(q)+'</div>'+
    (says[k]?'<h4>'+U.richText(says[k])+'</h4>':'')+body+'</section>';
  /* стримы — верхний уровень дерева: те же числа, что в главе «В каких стримах?» */
  const tr=D.mixTree(ctx.lp,'stream',S.mixSel), trB=D.mixTree(ctx.bl,'stream',S.mixSel);
  const tot=sumA(tr.map(n=>n.value)), totB=sumA(trB.map(n=>n.value));
  if(!tot)return U.empty('Нет людей в отборе','Снимите срез или один из фильтров в шапке.');
  const ST=hiOf(tr.map((n,i)=>({id:n.cat.id,name:n.cat.name,n:n.value,p:pct(n.value,tot),b:pct(trB[i].value,totB),on:sel.has(n.cat.id)}))
    .sort((x,y)=>y.n-x.n));
  const top6=ST.slice(0,6), rest=ST.slice(6).filter(r=>!r.hi), restN=sumA(rest.map(r=>r.n));
  if(ST.slice(6).some(r=>r.hi))top6.push(ST.slice(6).find(r=>r.hi));
  const more=rest.length?'ещё '+rest.length+' '+U.plural(rest.length,['стрим','стрима','стримов'])+' — '+pct(restN,tot)+'%':'';
  const SEN=ptRows(ctx,'seniority',sel,{l:'Lead+'}), TEN=ptRows(ctx,'tenure',sel), AGE=ptRows(ctx,'age',sel,{a0:'до 25 лет',a45:'45+ лет'}),
    GEN=ptRows(ctx,'gender',sel), FMT=ptRows(ctx,'worksite',sel,{rem:'Удалённо'}), EMP=ptRows(ctx,'employment',sel);
  /* стаж: выделены новички, а не самая большая группа — история про них */
  if(!TEN.some(r=>r.on))TEN.forEach((r,i)=>{r.hi=i===0});
  return '<div class="pt-wrap"><div class="pt-lg"><span><i></i>команда</span><span><s></s>'+U.esc(bench)+'</span></div>'+
    sec('Чем заняты','stream',ptBars(top6,bench,more))+
    '<div class="pt-2">'+sec('Какой квалификации','sen',ptSteps(SEN,bench))+sec('Как давно в компании','ten',ptPeople(TEN,bench))+'</div>'+
    '<div class="pt-2">'+sec('Возраст','age',ptCols(AGE,bench))+sec('Пол','gen',ptSplit(GEN[0],GEN[1],bench))+'</div>'+
    sec('Как работают','work','<div class="pt-2 in">'+ptTrio(FMT,bench)+
      ptBullet(EMP[0],'в штате (ТК РФ), остальные — ГПХ, ИП, самозанятые и аутстафф',bench)+'</div>')+
    '<div class="pt-more"><button class="pt-go" data-subtab="stream">Все стримы и специализации →</button>'+
      '<button class="pt-go" data-subtab="people">Пол, возраст и стаж таблицами →</button>'+
      '<button class="pt-go" data-subtab="custom">Пол × грейд в «Своём срезе» →</button></div></div>';
}

SC.blocks.structure={
  subTabs:[['portrait','Портрет']].concat(D.MIX_GROUPS.map(g=>[g.key,g.name])).concat([['custom','Свой срез']]),
  defaultSub:'portrait',
  title(sub){
    if(sub==='portrait')return 'Портрет команды';
    if(sub!=='custom'){
      const g=D.MIX_GROUPS.find(x=>x.key===sub);
      return g?g.title:'Состав численности по атрибутам';
    }
    return 'Свой срез состава';
  },
  view(ctx){
    if(ctx.sub==='portrait')return portrait(ctx);
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
        (sel.size?'':'<div class="tbl-note">Клик по строке берёт срез: численность '+
          'в карточках и в таблице подразделений пересчитается по этой категории. '+
          'Разрезы складываются — по одной категории на разрез.</div>');
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
      return h+'<div class="tbl-note">Выберите колонки — и разбивка станет матрицей: '+
        'два разреза на одних осях, чтобы сравнивать не таблицы между собой, а клетки строки.</div>';
    }
    /* Срез по оси матрицы её собственную ось не режет — иначе колонка «Мужчины»
       обнулилась бы и вернуться к ней стало бы нечем. Что при этом дошло до
       чисел, а что нет, пишем прямо над таблицей. */
    const axes=[rowDim.key,colDim.key];
    const outer=D.otherParts(S.mixSel,axes);
    const inner=D.sliceParse(S.mixSel).filter(p=>axes.indexOf(p.dim.key)>=0);
    const cap=[outer.length?'срез: '+outer.map(p=>p.cat.name).join(' · '):'',
      inner.length?'по осям матрицы срез не режет: '+inner.map(p=>p.cat.name).join(' · '):'']
      .filter(Boolean).join('  ·  ');
    h+=U.matrixTable({rowDim:rowDim,colDim:colDim,mode:S.mixMode,sel:sel,cap:cap,
      cells:D.mixMatrix(ctx.lp,rowDim.key,colDim.key,S.mixSel)});
    return h+'<div class="tbl-note">Клик по клетке берёт срез сразу по двум атрибутам, '+
      'по названию строки или колонки — по одному. Сумма клеток равна численности '+
      'в карточках над таблицей. Связи между атрибутами в макете заданы только для '+
      'нескольких пар: '+U.esc(D.MIX_LINK_TEXT)+'. Остальные пары внутри команды '+
      'считаются независимыми, и на реальных данных клетки будут другими.</div>';
  }
};
})();

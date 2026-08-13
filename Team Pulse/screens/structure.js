/* ============================================================================
   screens/structure.js — Структура численности.

   Разрезов состава в HR-борде не три и не пять: грейд, сеньорность, пол,
   возраст, стаж, тип занятости, формат работы, юрлицо, стрим — и список
   растёт. Сложить их в одну вкладку нельзя: девять таблиц подряд — это
   прокрутка на три экрана, где ни один разрез не виден целиком.

   Поэтому раскладка двухслойная:

   1. ЧЕТЫРЕ ПРЕДНАСТРОЕННЫЕ ВКЛАДКИ по смыслу вопроса — квалификация, люди,
      оформление, стримы. Группы объявлены в `D.MIX_GROUPS`, правило одно:
      на вкладке не больше трёх таблиц. Так каждая вкладка отвечает на один
      вопрос целиком и помещается в рабочую зону без прокрутки.
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
function dimTable(dim,lp,sel,mixSel){
  const parts=D.mixParts(lp,dim.key,mixSel);
  /* ПЕРЕКРЁСТНАЯ ФИЛЬТРАЦИЯ. Срез, взятый в соседней таблице, режет и эту:
     кликнули «Senior» — грейды показывают грейды сеньоров, и правая панель
     перестаёт спорить с карточками KPI над ней. Своя собственная категория из
     среза исключается, иначе таблица схлопнулась бы в одну строку и вернуться
     к другой категории стало бы нечем. */
  const others=D.otherParts(mixSel,[dim.key]);
  return U.btGroup({cap:dim.name,tip:dim.hint?{title:dim.name,text:dim.hint}:null,
    capSub:others.length?'срез: '+others.map(p=>p.cat.name).join(' · '):'',
    head:dim.short||dim.name,metricKey:'hc_total',compact:true,sort:!!dim.sort,
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
    capSub:others.length?'срез: '+others.map(p=>p.cat.name).join(' · '):'',
    head:dim.short||dim.name,metricKey:'hc_total',compact:true,tree:true,items:items,
    expAll:{key:dim.key,open:allOpen}});
}

SC.blocks.structure={
  subTabs:D.MIX_GROUPS.map(g=>[g.key,g.name]).concat([['custom','Свой срез']]),
  defaultSub:'qual',
  title(sub){
    if(sub!=='custom'){
      const g=D.MIX_GROUPS.find(x=>x.key===sub);
      return g?g.title:'Состав численности по атрибутам';
    }
    return 'Свой срез состава';
  },
  view(ctx){
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
      }))+
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

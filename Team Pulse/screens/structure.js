/* ============================================================================
   screens/structure.js — Структура численности.

   Разрезов состава в HR-борде не три и не пять: грейд, сеньорность, пол,
   возраст, стаж, тип занятости, формат работы, юрлицо, стрим — и список
   растёт. Сложить их в одну вкладку нельзя: девять таблиц подряд — это
   прокрутка на три экрана, где ни один разрез не виден целиком.

   Поэтому раскладка трёхслойная:

   0. «ПОРТРЕТ КОМАНДЫ» (14.10) — первая глава: вся структура одним рассказом,
      тремя графиками с выводами (см. portrait ниже). Таблицы — во второй слой.
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
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, SC=window.TPSCREENS;

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

/* ---------- «Портрет команды» (14.10) ----------
   Первая глава структуры — рассказ, а не стопка таблиц: заказчик просил
   «сторителлинг: кто эти люди, какой квалификации», и чтобы одно и то же не
   повторялось. Три графика — три вопроса, у каждого своя форма:
     чем заняты           — карта стримов и специализаций (treemap);
     чем не похожи на компанию — профиль по восьми разрезам против базы;
     возраст и пол         — пирамида с контуром базы.
   Над каждым графиком — его вывод одной фразой (story.js, says). Клик по куску
   берёт срез, как строка таблицы: портрет пересчитывается под «Senior», и
   рассказ — тоже. Подробности — в главах-таблицах, ссылки «подробно →». */
/* короткие имена категорий для подписей внутри полос профиля */
const SHORT={'seniority:l':'Lead+','age:a0':'<25','age:a25':'25–34','age:a35':'35–44','age:a45':'45+',
  'tenure:t0':'<1 года','tenure:t1':'1–3 года','tenure:t3':'3+ лет','employment:tk':'Штат','employment:sz':'Самозан.',
  'employment:out':'Аутстафф','worksite:rem':'Удалённо','region:msk':'Москва','region:spb':'СПб','region:oth':'Другие',
  'grade:g1':'G1','grade:g2':'G2','grade:g3':'G3','grade:g4':'G4','grade:g5':'G5'};
const PROF_ROWS=[['qual','Квалификация',['seniority','grade']],['people','Люди',['tenure','age','gender']],
  ['work','Как и где работают',['worksite','employment','region']]];
function portrait(ctx){
  const S=ctx.S, sel=new Set(D.sliceParse(S.mixSel).map(p=>p.id)), says=(ctx.story||{}).says||{};
  /* раздел: вопрос заголовком, под ним вывод одной фразой, затем график */
  const say=(q,t)=>'<div class="pt-h">'+U.esc(q)+'</div>'+(t?'<p class="pt-say">'+U.richText(t)+'</p>':'');
  const go=(sub,q)=>'<button class="pt-go" data-subtab="'+sub+'">'+U.esc(q)+' →</button>';
  const tree=D.mixTree(ctx.lp,'stream',S.mixSel);
  let h=U.storyFacts((ctx.story||{}).inFacts,'Что важно')+say('Чем заняты: стримы и специализации',says.tree)+G.chart('treemap',{items:tree.map(n=>({id:n.cat.id,name:n.cat.name,value:n.value,on:sel.has(n.cat.id),
    kids:n.kids.map(k=>({id:k.cat.id,name:k.cat.name,value:k.value,on:sel.has(k.cat.id)}))}))},
    {})+'<div class="pt-more">'+go('stream','Все специализации таблицей')+'</div>';
  const rows=[];
  PROF_ROWS.forEach(([gk,gn,dims])=>dims.forEach(k=>{
    const dim=D.MIX_BY_KEY[k], t=D.mixParts(ctx.lp,k,S.mixSel), b=D.mixParts(ctx.bl,k,S.mixSel), sb=b.reduce((x,y)=>x+y,0)||1;
    const st=t.reduce((x,y)=>x+y,0)||1;
    const cats=dim.cats.map((c,i)=>({id:c.id,name:c.name,short:SHORT[c.id]||c.name,v:t[i],b:b[i]/sb,on:sel.has(c.id)}));
    /* самое заметное отличие строки от базы — словами справа */
    const d=cats.map(c=>({c:c,d:(c.v/st-c.b)*100})).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d))[0];
    const big=d&&Math.abs(d.d)>=3;
    rows.push({group:gk,groupName:gn.toUpperCase(),groupTab:gk,name:dim.short,ord:!!dim.ord,cats:cats,
      dev:{text:big?d.c.short+' '+(d.d>0?'+':'−')+Math.round(Math.abs(d.d))+' п.п.':'как в базе',strong:Math.abs(d.d)>=5}});
  }));
  h+=say('Чем команда не похожа на компанию',says.prof)+G.chart('profile',{rows:rows},{baseLabel:ctx.benchLabel});
  const m=D.mixMatrix(ctx.lp,'age','gender',S.mixSel), mb=D.mixMatrix(ctx.bl,'age','gender',S.mixSel);
  const tot=m.reduce((x,r)=>x+r[0]+r[1],0), totB=mb.reduce((x,r)=>x+r[0]+r[1],0)||1, k=tot/totB;
  const age=D.MIX_BY_KEY.age, gen=D.MIX_BY_KEY.gender;
  h+=say('Возраст и пол',says.pyr)+G.chart('pyramid',{rows:age.cats.map((c,i)=>({name:c.name,l:m[i][0],r:m[i][1],bl:mb[i][0]*k,br:mb[i][1]*k,
      idL:c.id+','+gen.cats[0].id,idR:c.id+','+gen.cats[1].id})).reverse()},
    {left:gen.cats[0].name,right:gen.cats[1].name,baseLabel:ctx.benchLabel})+
    '<div class="pt-more">'+go('people','Пол, возраст и стаж таблицами')+go('custom','Пол × грейд в «Своём срезе»')+'</div>';
  return '<div class="pt-wrap">'+h+'</div>';
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

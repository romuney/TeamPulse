/* Separate annual review screen. Rendering primitives live in ui.js. */
(function(){
'use strict';
const D=window.TPDATA,U=window.TPUI,SC=window.TPSCREENS;
const tabs=[['who','Кого оцениваем'],['how','Как оцениваем']];
function bars(title,items,sub){return U.btGroup({cap:title,capSub:sub||'',head:'',valueHead:'Человек',metricKey:'hc_total',share:false,total:false,
  items:items.map(x=>({name:x[0],value:x[1],tip:x[2]||null}))})}
/* 20.11, решение владельца (п. 1 сверки): исходы оценки — одной разбивкой (DESIGN_SYSTEM 4.6): шесть групп вместе дают всех
   eligible, итог — в подписи таблицы («всего N чел»), доля — от eligible. Расчёты прежние, только раскладка. */
function who(r){
  const c=r.c;
  return bars('Общая численность и eligible',[['Общая численность',c.all],['Из них eligible',c.eligible,'Сотрудники, включённые в оцениваемую популяцию. Это часть общей численности, а не отдельная группа.']],'eligible — часть общей численности')+
    U.reviewNote('Eligible — сотрудники, включённые в оцениваемую популяцию на текущую дату. Общая численность здесь — все сотрудники текущего кадрового снимка под выбранными фильтрами.')+
    (!c.eligible?U.empty('Нет eligible-сотрудников','В выбранной численности нет сотрудников, включённых в ревью.'):
    U.btGroup({cap:'Что с оценкой у eligible',capSub:r.previousYear+' → '+r.year,head:'',valueHead:'Человек',metricKey:'hc_total',share:true,total:true,
      items:[['Улучшили оценку',c.up],['Ухудшили оценку',c.down],['Без изменения оценки',c.same],
        ['Получили первую оценку',c.first,'Первая финальная оценка по всей доступной истории ревью.'],
        ['Без сопоставимой прошлогодней оценки',c.unpaired,'Оценка за этот год есть, за прошлый — нет, но ревью было раньше.'],
        ['Без текущей финальной оценки',c.missing]].map(x=>({name:x[0],value:x[1],tip:x[2]||null}))})+
    U.reviewNote('Шесть групп вместе — все eligible. Первая оценка определяется по истории финальных ревью, а не по пропуску оценки прошлого года.'));
}
/* 20.11, итерация «В работу»: блоки — общей группой отчёта (.bt-group: заголовок 12/700 и подпись), не вложенными карточками;
   оценки — значками (U.scoreMark), переход — «значок → значок» и число людей в своей колонке */
function group(cap,sub,body){return '<div class="bt-group"><div class="bt-cap">'+U.esc(cap)+(sub?'<span class="bt-sub">'+U.esc(sub)+'</span>':'')+'</div>'+body+'</div>'}
const arrow='<span class="rv-arr" aria-hidden="true">→</span>';
function how(r,ctx){
  if(!r.c.eligible)return U.empty('Нет eligible-сотрудников','Измените фильтры или подразделение.');
  const blocks=[U.ratingLegend()];
  blocks.push(group('Переходы между оценками',r.previousYear+' → '+r.year,r.transitions.length?
    U.statTable({head:'Предыдущая → текущая оценка',cols:['Человек'],rows:r.transitions.map(t=>({name:t.previous+' → '+t.current,
      html:'<span class="rv-pair">'+U.scoreMark(t.previous)+arrow+U.scoreMark(t.current)+'</span>',vals:[t.n]}))}):
    U.empty('Нет переходов с изменением оценки','Нужны две сопоставимые финальные оценки разных значений. Неизменившиеся оценки сюда не входят.')));
  /* «n/a» — нет предыдущей оценки: своего значка для него нет (задание: не подбирать), остаётся текстом */
  blocks.push(group('Первые оценки','нет более раннего финального ревью в истории источника',r.c.first?
    U.statTable({head:'Первая оценка',cols:['Человек'],rows:r.first.map(x=>({name:'n/a → '+x.score,
      html:'<span class="rv-pair"><span class="rv-na"'+U.tipAttr({title:'n/a',text:'Предыдущей финальной оценки нет.'})+'>n/a</span>'+arrow+U.scoreMark(x.score)+'</span>',vals:[x.n]}))}):
    U.empty('Нет впервые оценённых сотрудников','Пропуск прошлогодней оценки сам по себе не означает первое ревью.')));
  /* 20.11, решение владельца (п. 3 сверки): три разреза — одной таблицей с рубриками (DESIGN_SYSTEM 4.6e), одна шапка и одно Итого */
  const table=group('Распределение оценок','грейд · стаж · специализация',U.ratingTable({title:'Распределение оценок',groups:[
    {name:'Грейд',rows:r.gr},{name:'Стаж',rows:r.tenure},
    Object.assign({name:'Специализация',rows:r.spec},SC.rest(ctx,'rvsp',10,['специализация','специализации','специализаций']))]}));
  /* подвал матриц — как у матрицы состава (.mx-foot): шкала заливки и сноска под таблицами, а не абзац перед ними */
  return U.btStack(blocks.concat([table]))+
    '<div class="mx-foot">'+U.heatLegend()+'<span class="tbl-note">В клетке — сотрудники с этой оценкой, цвет — их доля среди eligible строки. '+
    'Обе доли справа — тоже от всех eligible строки, включая сотрудников без оценки.</span></div>';
}
const counts=[
  ['eligible','Eligible','Сотрудники, включённые в оцениваемую популяцию.'],
  ['rated','Оценены','Сотрудники с финальной оценкой за год.'],
  ['up','Улучшили','Текущая оценка выше прошлогодней.'],
  ['down','Ухудшили','Текущая оценка ниже прошлогодней.'],
  ['first','Впервые','Первая финальная оценка по доступной истории.']
];
SC.blocks.review={subTabs:tabs,defaultSub:'who',
  cols:counts.map(([k,name,tip])=>({k,name,tip,val:c=>c[k]})),
  data(lp){
    const r=D.reviewData(lp);
    return r.state==='ready'||r.state==='empty'?r.c:null;
  },
  title(sub){return tabs.find(t=>t[0]===sub)[1]},
  view(ctx){
    const r=D.reviewData(ctx.lp);
    let body;
    /* 20.11, TEXT_GUIDE п. 3 и DESIGN_SYSTEM 4.12: без технических слов («поле», «сборка источника»), пустое состояние — с действием */
    if(r.state==='unavailable')body=U.empty('Итогов ревью пока нет','Они появятся, когда в отчёт загрузят данные годового ревью.');
    else if(r.state==='schema')body=U.empty('Итоги ревью не показываем','Данные ревью пришли в неожиданном виде. Сообщите владельцу отчёта.');
    else if(r.state==='error')body=U.empty('Итоги ревью не сходятся','Цифры не показываем, чтобы не ввести в заблуждение. Обновите страницу; если не поможет — сообщите владельцу отчёта.');
    else if(r.state==='empty')body=U.empty('Здесь нет записей ревью','Выберите другое подразделение или снимите один из фильтров в шапке.');
    else body=ctx.sub==='how'?how(r,ctx):who(r);
    /* год ревью — один раз, в шапке правой панели (TEXT_GUIDE п. 6), а не отдельной строкой над главой */
    return body;
  }
};
})();

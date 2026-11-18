/* Separate annual review screen. Rendering primitives live in ui.js. */
(function(){
'use strict';
const D=window.TPDATA,U=window.TPUI,SC=window.TPSCREENS;
const tabs=[['who','Кого оцениваем'],['how','Как оцениваем']];
function bars(title,items,sub){return U.btGroup({cap:title,capSub:sub||'',head:'',valueHead:'Человек',metricKey:'hc_total',share:false,total:false,
  items:items.map(x=>({name:x[0],value:x[1],tip:x[2]||null}))})}
function who(r){
  const c=r.c;
  return bars('Общая численность и eligible',[['Общая численность',c.all],['Из них eligible',c.eligible,'Сотрудники, включённые в оцениваемую популяцию. Это часть общей численности, а не отдельная группа.']],'eligible — часть общей численности')+
    U.reviewNote('Eligible — сотрудники, включённые в оцениваемую популяцию на текущую дату. Общая численность здесь — сотрудники текущего кадрового снимка с записью ревью за выбранный год.')+
    (!c.eligible?U.empty('Нет eligible-сотрудников','В выбранной численности нет сотрудников, включённых в ревью.'):
    !c.rated?U.empty('Нет текущих финальных оценок','Eligible-сотрудники есть, но оценок от 0 до 4 за выбранный год нет.'):
    bars('Изменение оценки',[['Улучшили оценку',c.up],['Ухудшили оценку',c.down],['Получили первую оценку',c.first]],r.previousYear+' → '+r.year)+
    U.reviewNote('Показаны три категории, которые не охватывают всю eligible-популяцию. Первая оценка определяется отдельным флагом по истории финальных ревью, а не пропуском оценки прошлого года.'))+
    bars('Остальные результаты',[['Без изменения оценки',c.same],['Без сопоставимой прошлогодней оценки',c.unpaired],['Без текущей финальной оценки',c.missing]]);
}
function how(r){
  if(!r.c.eligible)return U.empty('Нет eligible-сотрудников','Измените фильтры или подразделение.');
  let h=U.ratingLegend();
  h+=U.panel({title:'Переходы между оценками',sub:r.previousYear+' → '+r.year,body:r.transitions.length?
    U.statTable({head:'Предыдущая → текущая оценка',cols:['Человек'],rows:r.transitions.map(t=>({name:t.previous+' · '+D.REVIEW_SCALE[t.previous]+' → '+t.current+' · '+D.REVIEW_SCALE[t.current],vals:[t.n]}))}):
    U.empty('Нет переходов с изменением оценки','Нужны две сопоставимые финальные оценки разных значений. Неизменившиеся оценки сюда не входят.')});
  h+=U.panel({title:'Первые оценки',sub:'Нет более раннего финального ревью в истории источника',body:r.c.first?
    U.statTable({head:'Первая оценка',cols:['Человек'],rows:r.first.map(x=>({name:'n/a → '+x.score+' · '+x.name,vals:[x.n]}))}):
    U.empty('Нет впервые оценённых сотрудников','Пропуск прошлогодней оценки сам по себе не означает первое ревью.')});
  h+=U.reviewNote('Число в ячейке — сотрудники с этой оценкой. Чем темнее синий, тем больше их доля среди всех eligible в строке. Обе доли считаются от всех eligible строки, включая сотрудников без оценки.');
  [['По грейду','grade',r.gr],['По стажу','tenure',r.tenure],['По специализации','spec',r.spec]].forEach(x=>{
    h+=U.panel({title:x[0],body:U.ratingTable({title:x[0],kind:x[1],rows:x[2]})});
  });
  return h;
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
    if(r.state==='unavailable')body=U.empty('Данные ревью ещё не подключены','Для этой версии отчёта не получен годовой набор данных ревью.');
    else if(r.state==='schema')body=U.empty('Данные ревью недоступны','В источнике отсутствует согласованное поле даты ревью или его формат требует уточнения.');
    else if(r.state==='error')body=U.empty('Не удалось проверить данные ревью','Итоги и распределения не согласованы. Обновите отчёт; если ошибка повторится, проверьте сборку источника.');
    else if(r.state==='empty')body=U.empty('Пустая выборка','В выбранном подразделении и периоде нет подходящих записей ревью.');
    else body=ctx.sub==='how'?how(r):who(r);
    return (r.year?U.reviewNote('Год ревью '+r.year+' · сравнение с '+r.previousYear+' годом'):'')+body;
  }
};
})();

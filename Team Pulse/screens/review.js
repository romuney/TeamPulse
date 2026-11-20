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
    U.reviewNote('Eligible — сотрудники, включённые в оцениваемую популяцию на текущую дату. Общая численность здесь — все сотрудники текущего кадрового снимка под выбранными фильтрами.')+
    (!c.eligible?U.empty('Нет eligible-сотрудников','В выбранной численности нет сотрудников, включённых в ревью.'):
    !c.rated?U.empty('Нет текущих финальных оценок','Eligible-сотрудники есть, но оценок от 0 до 4 за выбранный год нет.'):
    bars('Изменение оценки',[['Улучшили оценку',c.up],['Ухудшили оценку',c.down],['Получили первую оценку',c.first]],r.previousYear+' → '+r.year)+
    U.reviewNote('Показаны три категории, которые не охватывают всю eligible-популяцию. Первая оценка определяется отдельным флагом по истории финальных ревью, а не пропуском оценки прошлого года.'))+
    bars('Остальные результаты',[['Без изменения оценки',c.same],['Без сопоставимой прошлогодней оценки',c.unpaired],['Без текущей финальной оценки',c.missing]]);
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
      html:'<span class="rv-pair"><span class="rv-na" title="Нет предыдущей оценки">n/a</span>'+arrow+U.scoreMark(x.score)+'</span>',vals:[x.n]}))}):
    U.empty('Нет впервые оценённых сотрудников','Пропуск прошлогодней оценки сам по себе не означает первое ревью.')));
  const tables=[['По грейду','grade',r.gr],['По стажу','tenure',r.tenure],['По специализации','spec',r.spec,
    SC.rest(ctx,'rvsp',10,['специализация','специализации','специализаций'])]].map(x=>
    group(x[0],'',U.ratingTable(Object.assign({title:x[0],kind:x[1],rows:x[2]},x[3]||{}))));
  return U.btStack(blocks)+U.reviewNote('Число в ячейке — сотрудники с этой оценкой. Чем темнее синий, тем больше их доля среди всех eligible в строке. Обе доли считаются от всех eligible строки, включая сотрудников без оценки.')+
    U.btStack(tables,'rv-tables');
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
    else body=ctx.sub==='how'?how(r,ctx):who(r);
    return (r.year?U.reviewNote('Год ревью '+r.year+' · сравнение с '+r.previousYear+' годом'):'')+body;
  }
};
})();

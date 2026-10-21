/* ============================================================================
   screens/monitor.js — Мониторинг работы.

   «Динамика» — недоработчики и доля улучшивших оценку в ревью панелями.
   «Лоу-перформеры» сняты 15.10: такого понятия в компании нет; мониторинг по
   каталогу HQ — недоработка, переработка, звонки, прогулы, выходные (план). Все шкалы от нуля: раньше ось резалась под диапазон значений, и
   колебание 6,1→6,9% выглядело обвалом. Ревью — ступенька: цикл раз в полгода.
   «Ревью» (итерация 28, дашборд 34661) — итоги последнего цикла: динамика
   оценок к прошлому циклу и оценки по грейду, стажу и роли.

   21.10 — «Рабочая активность» по файлу Антона «Мониторинг работы»: KPI-полоса из пяти
   показателей за последнюю закрытую неделю (недоработка, переработка, звонки в Talk,
   прогулы, работа в выходные), состав по категориям столбиками (месяцы / недели), линии
   часов в день и доли звонков, в таблице подразделений — колонки мониторинга и
   мини-график недо- и переработки за 12 недель. Клик по строке таблицы пересчитывает KPI
   и графики, клик по столбику отмечает период на линиях, Escape снимает выбор.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;

const C=G.C_MON;
const pctOf=(v,t)=>t?(Math.round(v/t*1000)/10).toFixed(1).replace('.',',')+'%':'—';
/* последняя закрытая неделя и предыдущая; в пробнике без витрины по неделям — месяцы */
function wk(md){const W=md.weeks||md.months;return {cur:W[W.length-1],prev:W[W.length-2]||W[W.length-1]}}
const NOW_ASK='появится с витриной мониторинга по неделям';

SC.blocks.monitor={
  subTabs:[['activity','Рабочая активность'],['review','Ревью']],
  defaultSub:'activity',
  /* KPI-полоса блока (вместо карточек метрик): снимок последней закрытой недели по
     выбранной строке таблицы — клик по строке пересчитывает и её */
  kpis(c){
    const md=D.monData(c.lp);
    if(!md)return '';
    const w=wk(md), cur=w.cur, prev=w.prev, sh=v=>pctOf(v,cur.hc)+' численности';
    /* пробник без витрины по неделям: последний закрытый месяц против прошлого, по основной таблице */
    if(md.monthly)return '<div class="mk-cap">Последний закрытый месяц — <b>'+U.esc(cur.full.toLowerCase())+'</b> · изменение — к прошлому месяцу'+
        ' · активная численность HQ · недели, звонки, прогулы и выходные — с витриной мониторинга</div>'+
      '<div class="kpis compact n5 mks">'+[
      U.monKpi({label:'Недоработка',value:cur.under,share:sh(cur.under),delta:cur.under-prev.under,bad:'up',vs:'к прошлому месяцу',
        info:{title:'Недоработка',text:'Сотрудники с активностью ниже нормы (категории low и super_low) в последнем закрытом месяце.'}}),
      U.monKpi({label:'Переработка',value:cur.over,share:sh(cur.over),delta:cur.over-prev.over,bad:'up',vs:'к прошлому месяцу',
        info:{title:'Переработка',text:'Сотрудники с активностью выше нормы (категории high и super_high) в последнем закрытом месяце.'}}),
      U.monKpi({label:'Звонки в Talk 20–30%',dev:5,devText:NOW_ASK}),
      U.monKpi({label:'Прогулы',dev:5,devText:NOW_ASK}),
      U.monKpi({label:'Работа в выходные',dev:5,devText:NOW_ASK})].join('')+'</div>';
    const wkTip='Неделя '+cur.full.replace('Неделя ','')+' против '+prev.full.replace('Неделя ','')+'.';
    return '<div class="mk-cap">Последняя закрытая неделя — <b>'+U.esc(cur.full.replace('Неделя ',''))+'</b> · сравнение с '+
        U.esc(prev.full.replace('Неделя ',''))+' · активная численность HQ, '+D.fmtInt(cur.hc)+' чел</div>'+
      '<div class="kpis compact n5 mks">'+[
      U.monKpi({label:'Недоработка',value:cur.under,share:sh(cur.under),delta:cur.under-prev.under,bad:'up',deltaTip:wkTip,
        info:{title:'Недоработка',text:'Сотрудники с недельной активностью ниже нормы (категории low и super_low) в последней закрытой неделе.\nРазбивка — сколько недель подряд человек в недоработке.'},
        parts:[{name:'1–2 недели',n:cur.u12,color:C.under},{name:'больше 2 недель',n:cur.u2p,color:C.under2}]}),
      U.monKpi({label:'Переработка',value:cur.over,share:sh(cur.over),delta:cur.over-prev.over,bad:'up',deltaTip:wkTip,
        info:{title:'Переработка',text:'Сотрудники с недельной активностью выше нормы (категории high и super_high).\nРазбивка — сколько недель подряд человек в переработке.'},
        parts:[{name:'1–2 недели',n:cur.o12,color:C.over},{name:'больше 2 недель',n:cur.o2p,color:C.over2}]}),
      U.monKpi({label:'Звонки в Talk 20–30%',value:cur.t23,share:sh(cur.t23),delta:cur.t23-prev.t23,bad:'none',deltaTip:wkTip,
        info:{title:'Звонки в Talk',text:'Сотрудники, у которых разговоры в Talk занимают 20–30% рабочего времени. Ниже — у кого больше.\nИзменение без цвета: какая доля нормальна, зависит от роли.'},
        parts:[{name:'30–50%',n:cur.t35,color:C.talk},{name:'больше 50%',n:cur.t5,color:C.talk2}]}),
      U.monKpi({label:'Прогулы',value:md.ab25+md.ab5,noDelta:'за 12 недель: '+md.period,
        info:{title:'Прогулы',text:'Сотрудники, у которых больше одного дня отсутствия за период — последние 12 закрытых недель.\nПоказатель за период: сравнения с прошлой неделей нет.'},
        parts:[{name:'2–5 дней',n:md.ab25,color:C.per},{name:'больше 5 дней',n:md.ab5,color:C.per2}]}),
      U.monKpi({label:'Работа в выходные',value:md.we25+md.we5,noDelta:'за 12 недель: '+md.period,
        info:{title:'Работа в выходные',text:'Сотрудники, которые выходили на работу в выходные больше одного дня за период — последние 12 закрытых недель.\nПоказатель за период: сравнения с прошлой неделей нет.'},
        parts:[{name:'2–5 дней',n:md.we25,color:C.per},{name:'больше 5 дней',n:md.we5,color:C.per2}]})
    ].join('')+'</div>';
  },
  /* колонки таблицы подразделений: последняя закрытая неделя, сортировка по клику на шапку,
     мини-график — доля недо- и переработки от численности недели за 12 закрытых недель */
  cols:[
    {k:'hc',name:'Чел.',tip:'Активная численность HQ в последней закрытой неделе.',val:md=>wk(md).cur.hc},
    {k:'under',name:'Недоработка',tip:'Недоработка (low и super_low) в последней закрытой неделе, человек.',val:md=>wk(md).cur.under,share:true},
    {k:'over',name:'Переработка',tip:'Переработка (high и super_high) в последней закрытой неделе, человек.',val:md=>wk(md).cur.over,share:true},
    {k:'talk',name:'Talk 20–30%',tip:'Сотрудники, у которых звонки в Talk занимают 20–30% рабочего времени.',val:md=>md.monthly?null:wk(md).cur.t23,share:true},
    {k:'spark',name:'Динамика, %',tip:'Доля недоработки (оранжевая) и переработки (красная) от численности: 12 закрытых недель (в пробнике без витрины по неделям — 6 месяцев).',
      spark:md=>{const W=(md.weeks||md.months).slice(-12), n=W.length-1, u=W.map(x=>x.hc?x.under/x.hc*100:null), o=W.map(x=>x.hc?x.over/x.hc*100:null);
        const f=v=>v==null?'—':(Math.round(v*10)/10).toFixed(1).replace('.',',')+'%';
        return U.miniLines([{vals:u,color:C.under},{vals:o,color:C.over}],{tip:{title:md.weeks?'12 закрытых недель':'6 закрытых месяцев',
          rows:[{label:'Недоработка, '+W[n].label,value:f(u[n]),color:C.under},
                {label:'Переработка, '+W[n].label,value:f(o[n]),color:C.over}],
          note:md.weeks?'Доля от численности недели.':'Доля от численности месяца.'}})}}
  ],
  title(sub){return sub==='review'?'Итоги ревью: последний цикл, '+D.CMP.cur
    :'Мониторинг рабочей активности'},
  view(ctx){
    if(ctx.sub==='review'){
      const rv=D.reviewProfile(ctx.lp);
      /* Три группы в одной тепловой таблице, а не три таблицы: вопрос один —
         «у кого оценки выше», и группы читаются в одних колонках. ИТОГО — общее
         распределение оценок; края каждой группы с ним сходятся. */
      return U.btStack([
        U.btGroup({cap:'По сравнению с прошлым ревью',capSub:'кого оценили',head:'',
          valueHead:'Человек',metricKey:'hc_total',compact:true,
          items:rv.dyn.map(x=>({name:x.name,note:x.note,value:x.value,color:G.C_REVIEW}))}),
        '<div class="bt-group"><div class="bt-cap">Оценки по группам<span class="bt-sub">доля людей в строке</span></div>'+
        U.heatTable({cols:rv.scores.map(x=>({name:x.name,tip:x.full})),
          total:{name:'ИТОГО',cells:rv.scores.map(x=>x.value)},
          groups:rv.groups.map(g=>({name:g.name,rows:g.rows.map((n,i)=>({name:n,cells:g.cells[i]}))}))})+
        '</div>'])+'<div class="tbl-note">Доли в строке складываются в 100%. Сколько это человек — в подсказке.</div>';
    }
    const md=D.monData(ctx.lp);
    if(!md)return U.empty('Нет данных мониторинга','Витрина мониторинга по неделям ещё не подключена к отчёту.');
    const S=ctx.S, gran=md.monthly||S.monGran==='m'?'m':'w';
    const P=gran==='m'?md.months:md.weeks.slice(-12);
    const mark=S.monMark!=null&&S.monMark<P.length?S.monMark:null;
    const mk=mark!=null?P[mark]:null;
    /* пробник без витрины по неделям: месяцы из основной таблицы, линий нет */
    if(md.monthly)return '<div class="mon-bar"><span class="mon-note">'+(mk?'Отмечен период: <b>'+U.esc(mk.full)+'</b> · Escape — снять'
        :'По месяцам, из основной таблицы. Недели, часы в день и звонки в Talk — с витриной мониторинга')+'</span></div>'+
      G.chart('stack',{periods:P,mark:mark},{title:'Состав по категориям, чел',
        legend:G.MON_CATS.map(c=>({name:c[1],color:C[c[0]]})),h:270})+
      U.devNote({stage:5,t:'Часы в день и доля звонков в Talk появятся с витриной мониторинга по неделям.'});
    return '<div class="mon-bar">'+U.segToggle('data-mongran',[['m','Месяцы'],['w','Недели']],gran)+
        '<span class="mon-note">'+(mk?'Отмечен период: <b>'+U.esc(mk.full)+'</b> · Escape — снять':'Клик по столбику отмечает период на линиях')+'</span></div>'+
      G.chart('stack',{periods:P,mark:mark},{title:'Состав по категориям, чел',
        legend:G.MON_CATS.map(c=>({name:c[1],color:C[c[0]]})),h:270})+
      G.chart('pline',{periods:P,key:'hours',mark:mark},{title:'Рабочая активность, ч/день',name:'Часов в день',h:190})+
      G.chart('pline',{periods:P,key:'talk',mark:mark},{title:'Доля звонков в Talk, % рабочего времени',name:'Звонки в Talk',fmt:'pct',h:190});
  }
};
})();

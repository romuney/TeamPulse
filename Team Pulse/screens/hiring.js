/* ============================================================================
   screens/hiring.js — Найм и вакансии.

   «Вакансии и срок закрытия» — три панели друг под другом: открытые, закрытые,
   срок закрытия. Отдельной вкладки у срока больше нет: на весь экран одна линия
   из двенадцати точек — это пустая трата экрана, а рядом с объёмом вакансий она
   отвечает на понятный вопрос «стало ли дольше при том же потоке».
   Панели, а не два бара рядом: у каждой своя шкала от нуля, ось X общая.

   «Воронка» снята 15.10: её нет в каталоге графиков HQ и УС, а коэффициенты
   этапов были допущением макета.

   Итерация 28 (бизнес-анализ, дашборды 34661 и 34136):
   «План-факт»     — выполнение плана найма к цели KPI и таблица по типам найма
                     (массовый / профильный): итог с начала года и воронка
                     вакансий на конец месяца — в работе, готово, backlog, холд.
   «Профиль найма» — откуда пришли (каналы плюс переводы) и грейд принятых
                     (каталог HQ, «Структура найма»). Строка переводов — ровно
                     «Доля внутреннего найма». Сеньорность принятых снята 15.10:
                     в каталоге её нет.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;
const esc=U.esc;

/* Таблица план-факта: строки — показатели, колонки — Всего · Массовый ·
   Профильный. «В т.ч.» не складываются со статусами — это срезы открытых. */
function planTable(lp,S){
  const pf=D.planFact(lp), kpi=D.kpiFor('hire_plan',S);
  return U.statTable({cols:pf.cols,rows:[
    {sec:'С начала года · '+D.YTD_RANGE},
    {name:'План найма',fmt:'int',vals:pf.plan},
    {name:'Принято',note:'тот же найм, что в «Движении персонала»',fmt:'int',vals:pf.fact},
    {name:'Выполнение плана',note:kpi?'цель KPI '+D.fmtVal('hire_plan',kpi.green):'',fmt:'pct',vals:pf.done,
      state:pf.done.map(v=>kpi?D.stateForKpi('hire_plan',v,kpi):'neutral')},
    {name:'Закрыто вакансий',fmt:'int',vals:pf.closed},
    {name:'Закрыто в срок',fmt:'pct',vals:pf.onTime},
    {name:'Среднее время закрытия',fmt:'days',vals:pf.days},
    {name:'Доля закрытых',note:'среди закрытых и открытых',fmt:'pct',vals:pf.share},
    {sec:D.PARTIAL?'Вакансии на '+D.ASOF_LABEL:'Вакансии на конец месяца · '+D.CMP.cur},
    {name:'Открыто',fmt:'int',vals:pf.open}]
    .concat(pf.status.map(x=>({name:x.name,note:x.note,fmt:'int',vals:x.vals,sub:true})))
    .concat([
    {name:'в т.ч. просрочено',note:'открыты дольше нормы',fmt:'int',vals:pf.overdue,sub:true},
    {name:'в т.ч. на замену ушедших',fmt:'int',vals:pf.replace,sub:true},
    {name:'в т.ч. вакансии джунов',fmt:'int',vals:pf.junior,sub:true}])});
}

SC.blocks.hiring={
  /* 26.10, правки: «Кого и откуда берём?» → «Успеваем закрывать вакансии?» → «Выполняем план?» */
  /* 27.10-в, п. 4: «Выполняем план?» скрыт до следующего релиза — вкладка и её код на месте (D.OFF_SUBS) */
  subTabs:[['profile','Профиль найма'],['vacancies','Вакансии и срок закрытия'],['plan','План-факт']].filter(t=>!D.OFF_SUBS.has('hiring.'+t[0])),
  defaultSub:'profile',
  title(sub){return sub==='plan'?'План-факт подбора: массовый и профильный найм'
    :sub==='profile'?'Виды найма и каналы'
    :'Вакансии и скорость их закрытия'},
  view(ctx){
    const lp=ctx.lp;
    if(ctx.sub==='plan'){
      /* Линия без fill: под ней таблица, делить высоту панели не с кем (AGENTS,
         «fill — только когда высоту делят графики»). У выполнения плана есть
         цель, поэтому на полотне её пороги, а не база (правило KPI). */
      return SC.metricLine('hire_plan',lp,ctx.bl,ctx.S,
          {h:250,fill:false,title:'Выполнение плана найма с начала года, %',ann:ctx.ann.hire_plan})+
        planTable(lp,ctx.S)+
        '<div class="tbl-note">Массовый найм — много однотипных позиций, профильный — штучный подбор специалистов. '+
        '«В т.ч.» — часть открытых вакансий, со статусами они не складываются.</div>';
    }
    if(ctx.sub==='profile'){
      const hp=D.hiringProfile(lp,'ytd'), sub=' '+D.PER_TEXT;
      /* 26.10-б, правки п. 7: «Найм, чел» — год к году, как «Отток, чел» (бар этого года, позади — прошлый, легенда по
         годам); виды найма — только в подсказке месяца. Без видов в данных — подсказка без них */
      const hk=D.hireKinds(lp);
      const dyn=SC.metricLine('hire',lp,ctx.bl,ctx.S,{title:'Найм, чел',h:270,fill:false,color:G.C_IN,ann:ctx.ann.hire,
        tipRows:hk?i=>D.HIRE_KINDS.map(c=>({label:'· '+c[1],value:D.fmtInt(hk[i][c[0]]),color:c[2]})):null});
      const tbl=(cap,capSub,items,o)=>U.btGroup(Object.assign({cap:cap,capSub:capSub,head:'',valueHead:'Человек',
        metricKey:'hire',compact:true,items:items},o||{}));
      /* Каналы — по убыванию, переводы — последней строкой и своим цветом
         «внутреннего найма»: это не канал подбора, а другой путь в команду. */
      /* 31.10, файл итерации п. 4: «Откуда пришли» — все строки по убыванию. Итерация 31.10, п. 5: строки «Переводы из
         других команд» нет — в таблице только найм (переводы — во вкладке «Движение персонала») */
      const ch=hp.channels.map(c=>({name:c.name,value:c.value,color:G.C_IN})).sort((a,b)=>b.value-a.value);
      /* 31.10 (поставка 82): «Откуда» и «Как пришли» — один вопрос про путь в команду, идут подряд (на широкой
         панели — рядом), «Грейд принятых» — уже про то, кого взяли */
      return dyn+U.btStack([tbl('Откуда пришли','найм'+sub,ch)]
        /* поставка 50: путь в команду — найм в компанию, из учебной группы, стажёр в штат (как в HQ) */
        .concat(hp.path&&hp.path.length?[tbl('Как пришли',sub,hp.path.map(x=>({name:x.name,value:x.value,color:G.C_IN})),{sort:true})]:[])
        .concat([tbl('Грейд принятых',sub,hp.grade.map(x=>({name:x.name,value:x.value,color:G.C_IN})))]))+
        '<div class="tbl-note">С начала года ('+esc(D.YTD_RANGE)+').</div>';
    }
    /* срок закрытия — линией: это темп, а не количество, ровно как текучесть
       в блоке оттока. Барами остаются штуки вакансий. */
    const panels=SC.yoyPanels(lp,[
      {name:'Открытые вакансии, шт',key:'vac_open',color:G.C_VAC,ann:ctx.ann.vac_open},
      {name:'Закрытые вакансии, шт',key:'vac_closed',color:G.C_IN},
      {name:'Срок закрытия вакансии, дн',key:'time_to_fill',color:G.C_LINE}]);
    /* поставка 50: вакансии в разрезах — из витрины вакансий (пробник); в макете их нет */
    const vb=D.vacancyBreakdown(lp);
    if(!vb)return panels;
    /* 27.10-в, п. 7: специализаций десятки — по убыванию, первые 10 и раскрываемые «Остальные» */
    /* 31.10, файл итерации п. 4: по убыванию — статус, причина, специализация, канал; уровень позиции и кандидата —
       по старшинству (порядковые) */
    const vt=(cap,capSub,items,color,head,rs,ord)=>U.btGroup(Object.assign({cap:cap,capSub:capSub,head:'',valueHead:head,metricKey:'vac_open',
      compact:true,sort:!ord,items:items.map(x=>({name:x.name,value:x.value,color:color}))},rs||{}));
    const open=[['Открытые по статусу',vb.status],['Открытые по причине',vb.reason],['Открытые по уровню позиции',vb.pos,null,1],
      ['Открытые по специализации',vb.spec,SC.rest(ctx,'vspec',10,['специализация','специализации','специализаций'])]]
      .filter(x=>x[1].length).map(x=>vt(x[0],'на '+(D.PARTIAL?D.ASOF_LABEL:D.CMP.cur),x[1],G.C_VAC,'Вакансий',x[2],x[3]));
    const closed=[['Закрытые по каналу',vb.channel],['Закрытые по уровню кандидата',vb.cand,null,1]].filter(x=>x[1].length)
      .map(x=>vt(x[0],D.PER_TEXT,x[1],G.C_IN,'Вакансий',x[2],x[3]));
    return panels+U.btStack(open.slice(0,2))+U.btStack(open.slice(2).concat(closed).slice(0,3))+
      '<div class="tbl-note">Вакансии — по подразделению: фильтры покраски, IT, штата и типа численности на них не действуют.</div>';
  }
};
})();

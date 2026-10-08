/* ============================================================================
   screens/hiring.js — Найм и вакансии.

   «Вакансии и срок закрытия» — три панели друг под другом: открытые, закрытые,
   срок закрытия. Отдельной вкладки у срока больше нет: на весь экран одна линия
   из двенадцати точек — это пустая трата экрана, а рядом с объёмом вакансий она
   отвечает на понятный вопрос «стало ли дольше при том же потоке».
   Панели, а не два бара рядом: у каждой своя шкала от нуля, ось X общая.

   «Воронка» осталась отдельно: у неё своя геометрия и своя оговорка про источник.

   Итерация 28 (бизнес-анализ, дашборды 34661 и 34136):
   «План-факт»     — выполнение плана найма к цели KPI и таблица по типам найма
                     (массовый / профильный): итог с начала года и воронка
                     вакансий на конец месяца — в работе, готово, backlog, холд.
   «Профиль найма» — откуда пришли (каналы плюс переводы), сеньорность и грейд
                     принятых. Строка Junior — ровно «Доля джунов в найме»,
                     строка переводов — ровно «Доля внутреннего найма».
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
    {name:'Доля закрытых',note:'закрытые от закрытых и открытых',fmt:'pct',vals:pf.share},
    {sec:'Вакансии на конец месяца · '+D.CMP.cur},
    {name:'Открыто',fmt:'int',vals:pf.open}]
    .concat(pf.status.map(x=>({name:x.name,note:x.note,fmt:'int',vals:x.vals,sub:true})))
    .concat([
    {name:'в т.ч. просрочено',note:'открыты дольше нормы',fmt:'int',vals:pf.overdue,sub:true},
    {name:'в т.ч. на замену ушедших',fmt:'int',vals:pf.replace,sub:true},
    {name:'в т.ч. вакансии джунов',fmt:'int',vals:pf.junior,sub:true}])});
}

/* Коэффициенты воронки — допущение макета, реального источника под ними нет.
   При подключении к хранилищу заменить на фактические этапы. */
const FUNNEL=[['Открыто вакансий',1],['Передано офферов',0.63],['Принято офферов',0.49],['Вышли на работу',0.41]];

SC.blocks.hiring={
  subTabs:[['vacancies','Вакансии и срок закрытия'],['plan','План-факт'],['profile','Профиль найма'],['funnel','Воронка']],
  defaultSub:'vacancies',
  title(sub){return sub==='funnel'?'Воронка найма'
    :sub==='plan'?'План-факт подбора: массовый и профильный найм'
    :sub==='profile'?'Откуда приходят и кого нанимаем'
    :'Вакансии и скорость их закрытия'},
  view(ctx){
    const lp=ctx.lp;
    if(ctx.sub==='plan'){
      /* Линия без fill: под ней таблица, делить высоту панели не с кем (AGENTS,
         «fill — только когда высоту делят графики»). У выполнения плана есть
         цель, поэтому на полотне её пороги, а не база (правило KPI). */
      return SC.metricLine('hire_plan',lp,ctx.bl,ctx.S,
          {h:250,fill:false,title:'Выполнение плана найма с начала года, %'})+
        planTable(lp,ctx.S)+
        '<div class="tbl-note">Факт плана — найм, закрытые и открытые вакансии — те же ряды, что на '+
        'соседних вкладках. План по месяцам, тип найма, статусы, «в срок», «на замену», «джуны» и '+
        '«просрочено» в макете сгенерированы; на проде это plan_fact_tf_rabota и vacancy_daily_for_digest '+
        '(дашборд 34661). Пороги цели 95% / 80% — черновик, согласовать с заказчиком.</div>';
    }
    if(ctx.sub==='profile'){
      const hp=D.hiringProfile(lp,'ytd'), sub=' с начала года';
      const tbl=(cap,capSub,items,o)=>U.btGroup(Object.assign({cap:cap,capSub:capSub,head:'',valueHead:'Человек',
        metricKey:'hire',compact:true,items:items},o||{}));
      /* Каналы — по убыванию, переводы — последней строкой и своим цветом
         «внутреннего найма»: это не канал подбора, а другой путь в команду. */
      const ch=hp.channels.slice().sort((a,b)=>b.value-a.value).map(c=>({name:c.name,value:c.value,color:G.C_IN}))
        .concat([{name:'Переводы из других команд',note:'их доля и есть доля внутреннего найма',
          value:hp.tin,color:G.C_HIRE_I}]);
      return U.btStack([
        tbl('Откуда пришли','найм и переводы'+sub,ch),
        tbl('Сеньорность принятых',sub,hp.seniority.map((x,i)=>({name:x.name,value:x.value,color:G.C_IN,
          note:i===0?'доля = доля джунов в найме':''}))),
        tbl('Грейд принятых',sub,hp.grade.map(x=>({name:x.name,value:x.value,color:G.C_IN})))])+
        '<div class="tbl-note">Итог — найм с начала года ('+esc(D.YTD_RANGE)+'), в первой таблице — вместе '+
        'с переводами в команду. Каналы и уровни в макете сгенерированы, грейд выведен из сеньорности; '+
        'на проде это mapping_channel_name и атрибуты найма из atributy_nayma (дашборд 34136).</div>';
    }
    if(ctx.sub==='funnel'){
      const open=SC.sumS(D.aggregate(lp,'vac_open')), closed=SC.sumS(D.aggregate(lp,'vac_closed'));
      const items=FUNNEL.map(([name,k],i)=>({name,
        value:i===FUNNEL.length-1?Math.max(closed,Math.round(open*k)):Math.round(open*k)}));
      return G.chart('funnel',{items},{fill:true,h:Math.max(300,items.length*74)})+
        '<div class="tbl-note">Этапы после открытия вакансии — допущение макета: коэффициенты 0,63 / 0,49 / 0,41. Реального источника под ними пока нет.</div>';
    }
    /* срок закрытия — линией: это темп, а не количество, ровно как текучесть
       в блоке оттока. Барами остаются штуки вакансий. */
    return G.chart('panels',{panels:[
      {name:'Открытые вакансии, шт',key:'vac_open',type:'bar',series:D.aggregate(lp,'vac_open'),color:G.C_VAC},
      {name:'Закрытые вакансии, шт',key:'vac_closed',type:'bar',series:D.aggregate(lp,'vac_closed'),color:G.C_IN},
      {name:'Срок закрытия вакансии, дн',key:'time_to_fill',type:'line',series:D.aggregate(lp,'time_to_fill'),color:G.C_LINE}
    ]},{h:520,fill:true});
  }
};
})();

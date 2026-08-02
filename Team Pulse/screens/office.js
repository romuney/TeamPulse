/* ============================================================================
   screens/office.js — Посещаемость офисов. Три под-вкладки:

   «Календарь»      — подневная сетка за последний месяц периода плюс разбивка
                      по дням недели. Отвечает на вопрос «когда людей в офисе
                      больше», на который месячная линия ответить не может.
   «Рейтинг офисов» — где посещаемость выше, с численностью привязанных людей.
   «Динамика»       — месячная линия с базой сравнения (то, что было тут раньше).

   Дни недели — таблицей, а не барами: день недели это атрибут, а для разбивок
   по атрибутам в проекте таблица с полосой в ячейке (то же правило, что у грейдов
   и причин увольнений). Доля отключена: доля одного процента в сумме процентов
   ничего не значит.

   ВНИМАНИЕ: подневных отметок и привязки людей к офисам в модели нет — данные
   сгенерированы, как коэффициенты воронки найма. В UI это помечено сносками,
   иначе на реальных данных их примут за работающий расчёт.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;
const esc=U.esc;

const MOCK_NOTE='Подневные отметки и привязка людей к офисам в макете сгенерированы: '+
  'реального источника под ними пока нет. Среднее по будням ПОЛНОГО месяца совпадает '+
  'с метрикой «посещаемость офиса» за этот месяц; в окне последних дней месяц '+
  'может быть захвачен частично, и тогда среднее по видимым дням от неё отличается.';

SC.blocks.office={
  subTabs:[['calendar','Календарь'],['offices','Рейтинг офисов'],['dynamics','Динамика']],
  defaultSub:'calendar',
  title(sub){return sub==='offices'?'Офисы по посещаемости'
    :sub==='dynamics'?'Посещаемость офиса против базы'
    :'Когда люди приходят в офис'},
  view(ctx){
    if(ctx.sub==='dynamics')return SC.metricLine('office_att',ctx.lp,ctx.bl,ctx.S);

    if(ctx.sub==='offices'){
      const rows=D.officeRank(ctx.lp);
      if(!rows.length)return U.empty('Нет данных по офисам','В отборе нет сотрудников.');
      return U.barTable({head:'Офис',metricKey:'office_att',valueHead:'Посещаемость',
        barHead:'Сравнение офисов',share:false,total:false,
        items:rows.map(o=>({name:o.name,note:o.city+' · '+D.fmtInt(o.hc)+' чел',
          value:o.att,tip:'сотрудников отбора: '+D.fmtInt(o.hc)}))})+
        '<div class="tbl-note">'+esc(MOCK_NOTE)+'</div>';
    }

    /* календарь + дни недели: сетка отвечает «в какие дни», таблица — «в какие
       дни недели», и вместе они читаются как один ответ */
    const blocks=D.attLast(ctx.lp), dow=D.attByDow(ctx.lp);
    return G.chart('calendar',{blocks:blocks},
      {fill:true,h:340,title:'Посещаемость по дням — последние '+D.CAL_DAYS+' дней, %'})+
      '<div class="bt-group"><div class="bt-cap">По дням недели, среднее за '+
      D.DOW_MONTHS+' месяца</div>'+
      U.barTable({head:'День недели',metricKey:'office_att',valueHead:'Посещаемость',
        barHead:'Сравнение дней',share:false,total:false,compact:true,
        items:dow.map(d=>({name:d.name,value:d.value,
          color:d.weekend?G.C_FLAT:G.C_OFFICE,note:d.weekend?'выходной':''}))})+
      '<div class="tbl-note">'+esc(MOCK_NOTE)+'</div></div>';
  }
};
})();

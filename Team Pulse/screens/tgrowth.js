/* ============================================================================
   screens/tgrowth.js — T-рост. Три вкладки:

   «Конверсия и решения» — сверху конверсия в повышение с базой сравнения,
                           снизу то, из чего она считается: прошли вверх,
                           отказано вниз от общего нуля.
   «Заявки и T@T»        — время до повышения и заявки за 12 месяцев по типу:
                           повышение грейда и смена специализации (сервис
                           «Рост» из HQ-дашборда 34136, итерация 28).
   «Статусы по грейдам»  — тепловая таблица «грейд × статус роста»: где люди
                           растут, где застряли, где рост недоступен.

   Конверсия и решения — одна вкладка, а не две: конверсия и есть отношение этих
   двух рядов, и вопрос «почему она просела» закрывается тем, что оба графика
   видны сразу — упал числитель или вырос знаменатель.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;
const esc=U.esc;
const pct=(a,b)=>b?+(a/b*100).toFixed(1):null;

SC.blocks.tgrowth={
  subTabs:[['flow','Конверсия и решения'],['requests','Заявки и T@T'],['statuses','Статусы по грейдам']],
  defaultSub:'flow',
  title(sub){return sub==='requests'?'Заявки на рост и время до повышения'
    :sub==='statuses'?'Статусы карьерного роста по грейдам'
    :'Конверсия T-роста и решения по заявкам'},
  view(ctx){
    if(ctx.sub==='requests'){
      const tg=D.tgrowthProfile(ctx.lp);
      /* Конверсия в таблице — за 12 месяцев, а метрика блока — за месяц:
         окно названо в шапке колонки, чтобы два числа не путали. */
      return SC.metricLine('tgrowth_tat',ctx.lp,ctx.bl,ctx.S,
          {h:250,fill:false,title:'Время до повышения (T@T), мес',ann:ctx.ann.tgrowth_tat})+
        '<div class="bt-group"><div class="bt-cap">Заявки на T-рост по типу<span class="bt-sub">за 12 месяцев</span></div>'+
        U.statTable({cols:['Заявок','Одобрено','Отклонено','Конверсия'],fmts:['int','int','int','pct'],firstTotal:false,
          rows:[{name:'ИТОГО',total:true,vals:[tg.pass+tg.deny,tg.pass,tg.deny,pct(tg.pass,tg.pass+tg.deny)]}]
            .concat(tg.types.map(t=>({name:t.name,vals:[t.pass+t.deny,t.pass,t.deny,pct(t.pass,t.pass+t.deny)]})))})+
        '</div><div class="tbl-note">Те же решения, что на вкладке «Растут ли люди внутри?», за 12 месяцев.</div>';
    }
    if(ctx.sub==='statuses'){
      const tg=D.tgrowthProfile(ctx.lp);
      const tot=D.TG_STATUS.map((_,j)=>tg.rows.reduce((a,r)=>a+r.cells[j],0));
      return U.heatTable({corner:'Грейд',cols:D.TG_STATUS.map(x=>({name:x.name,tip:x.tip})),
          total:{name:'ИТОГО',cells:tot},
          groups:[{name:'Грейд',rows:tg.rows.map(r=>({name:r.name,cells:r.cells}))}]})+
        '<div class="tbl-note">В клетке — доля людей грейда. Сколько это человек — в подсказке и в последней колонке.</div>';
    }
    return SC.metricLine('tgrowth_conv',ctx.lp,ctx.bl,ctx.S,{h:300,title:'Конверсия T-роста, %',ann:ctx.ann.tgrowth_conv})+
      SC.yoyPair(ctx.lp,'tgrowth_pass','tgrowth_deny',
        {h:300,title:'Одобренные и отклонённые заявки',
         legend:[{name:'Одобрено',color:G.C_IN},{name:'Отклонено',color:G.C_OUT}]});
  }
};
})();

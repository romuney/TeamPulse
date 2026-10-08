/* ============================================================================
   screens/turnover.js — Отток и текучесть.

   Отток и текучесть — разные сущности, поэтому у каждой своя панель со своей
   шкалой от нуля, а не два бара рядом на одной оси:

     1. Отток, чел          — счётный факт за месяц, бары
     2. Текучесть месячная  — отток / среднесписочная за месяц, линия
     3. Текучесть накопительная — сумма месячных с января, линия. Обнуляется
        каждый январь, поэтому в январе она равна месячной, а к декабрю
        доходит до годового значения.

   Причины увольнений — ТАБЛИЦА с полосами в ячейках, не бар-чарт.

   Итерация 28 (бизнес-анализ, дашборд 34661): «Почему уходят» — инициатор
   увольнения над причинами; «Кто уходит» — стаж на момент ухода, грейд и
   стрим ушедших. Окно у всех разбивок — с начала года: так их считает Proteus
   («отток YTD по грейду, стажу, специализации»), и так же копится
   накопительная текучесть на соседней вкладке.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI, G=window.TPDRAW, SC=window.TPSCREENS;

SC.blocks.turnover={
  subTabs:[['dynamics','Отток и текучесть'],['reasons','Почему уходят'],['who','Кто уходит']],
  defaultSub:'dynamics',
  title(sub){return sub==='reasons'?'Почему уходят: инициатор и причины'
    :sub==='who'?'Кто уходит: стаж, грейд, стрим'
    :'Отток и текучесть по месяцам'},
  view(ctx){
    const lp=ctx.lp, ytd=' с начала года';
    if(ctx.sub==='reasons'){
      /* Инициатор — сумма причин: у каждой причины ровно один инициатор, поэтому
         две таблицы не расходятся. ★ — нежелательный уход; причины по убыванию,
         как в разборе «сверху вниз». Шапки первых колонок пустые: имя таблицы
         стоит подписью прямо над ней (правило 10f). */
      const rs=D.exitReasons(lp,'ytd');
      const initName=k=>(D.EXIT_INITIATORS.find(x=>x.key===k)||{}).name||'';
      return U.btStack([
        U.btGroup({cap:'Инициатор увольнения',capSub:ytd,head:'',valueHead:'Человек',metricKey:'attrition',compact:true,
          items:D.exitInitiators(lp,'ytd').map(x=>({name:x.name,note:x.note,value:x.value,color:G.C_OUT}))}),
        U.btGroup({cap:'Причины увольнений',capSub:ytd,head:'',valueHead:'Человек',metricKey:'attrition',sort:true,compact:true,
          items:rs.map(r=>({name:r.name,note:initName(r.init).toLowerCase(),value:r.value,
            mark:r.regret,color:r.regret?G.C_REGRET:G.C_NOREG}))})])+
        '<div class="tbl-note">★ — нежелательный уход: причина, на которую компания могла повлиять. '+
        'ИТОГО обеих таблиц — отток с начала года ('+U.esc(D.YTD_RANGE)+'); доли внутри него в макете '+
        'сгенерированы, на проде это fire_initiative и fire_reason из витрины оттока.</div>';
    }
    if(ctx.sub==='who'){
      /* Ранний уход — первые 12 месяцев (испытательный срок и первый год): это
         качество найма и адаптации, а не текучесть вообще. Его доля названа
         в подписи, чтобы не складывать две строки в уме. */
      const ex=D.exitProfile(lp,'ytd');
      const early=ex.tenure.filter(t=>t.early).reduce((a,t)=>a+t.value,0);
      const grp=(cap,sub,items,sort)=>U.btGroup({cap:cap,capSub:sub,head:'',valueHead:'Человек',
        metricKey:'attrition',compact:true,sort:!!sort,items:items.map(x=>({name:x.name,value:x.value,color:G.C_OUT}))});
      return U.btStack([
        grp('Стаж на момент ухода',ytd+(ex.total?' · ранний уход, до года: '+D.fmtInt(early)+' чел, '+
          U.pct(early/ex.total*100):''),ex.tenure),
        grp('Грейд',ytd,ex.grade),
        grp('Стрим',ytd,ex.stream,true)])+
        '<div class="tbl-note">ИТОГО каждой таблицы — отток с начала года ('+U.esc(D.YTD_RANGE)+'). '+
        'Доли в макете сгенерированы: стаж — типовым профилем, грейд и стрим — пропорционально '+
        'численности с поправкой на склонность к уходу. На проде это атрибуты ушедшего на дату увольнения.</div>';
    }
    /* Текучесть — всегда линия: это темп, а не количество. Барами остаётся
       только отток, потому что отток — счётные люди за месяц. */
    return SC.dynWrap(ctx,G.chart('panels',{panels:[
      {name:'Отток, чел',key:'attrition',type:'bar',series:D.aggregate(lp,'attrition'),color:G.C_OUT},
      {name:'Текучесть месячная, %',key:'turnover_m',type:'line',series:D.aggregate(lp,'turnover_m'),color:G.C_LINE},
      {name:'Текучесть накопительная с января, %',key:'turnover_y',type:'line',series:D.aggregate(lp,'turnover_y'),color:G.C_TURN_Y}
    ]},{h:520,fill:true}),[
      {key:'turnover_m',title:'Текучесть месячная, % · год к году'},
      {key:'turnover_y',title:'Текучесть накопительная с января, % · год к году'}]);
  }
};
})();

/* ============================================================================
   screens/tgrowth.js — T-рост. Три вкладки (27.10-в, п. 8 — по описанию вкладки «Рост» дашборда HQ):

   «Растут ли люди внутри?»   — как было: конверсия с базой сравнения, под ней
                                одобренные и отклонённые заявки год к году.
   «Как растут по грейдам?»   — статусы роста людей за 12 месяцев (пять статусов),
                                тепловая таблица выбранного статуса: текущий грейд ×
                                тип роста; повышения грейда — успешно закрытые заявки
                                «Рост» и T@T по месяцам и успешность по желаемому грейду.
   «Как меняют специализацию?» — то же для смены специализации: по месяцам и
                                успешность по желаемой специализации.

   Прежние «Заявки и T@T» и «Статусы по грейдам» (tgrowthProfile) — в истории; новые
   вкладки читают D.rostProfile. Поставка 71: на настоящих данных — разрезы «Роста» выбранного подразделения
   (параграфы Адели); без них — условные числа с плашкой «в разработке».
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;
const esc=U.esc, sum=a=>a.reduce((x,y)=>x+y,0);
/* цвета статусов — как в «Росте»: зелёный, голубой, жёлтый, серый, фиолетовый */
const ST_COL={done:G.C_HIRE,first:G.C_TR_IN,again:G.C_ROST.again,none:G.C_ROST.none,denied:G.C_FIRE};
const C_R=G.C_ROST.rost, C_T=G.C_ROST.tat;
/* заливка клетки: от белого к цвету статуса по доле от максимума таблицы */
function ramp(hex,t){
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)), k=0.08+0.34*Math.max(0,Math.min(1,t));   // 31.10: мягче — не ярче клетки отказов
  return 'rgb('+c.map(v=>Math.round(255+(v-255)*k)).join(',')+')';
}
/* 31.10, п. 2: подсветка таблиц повышения и смены — мягкая, самая яркая клетка — G.C_HEAT_RGB с прозрачностью G.HEAT_MAX */
const soft=(v,t,txt)=>'<td'+(v?' style="background:rgba('+G.C_HEAT_RGB+','+(0.12+(G.HEAT_MAX-0.12)*Math.max(0,Math.min(1,t))).toFixed(2)+')"':'')+'>'+txt+'</td>';
const cell=(v,t,hex,txt)=>'<td'+(v?' style="background:'+ramp(hex,t)+'"':'')+'>'+txt+'</td>';
/* тепловая таблица «текущий грейд × тип роста» в людях; ИТОГО — первой строкой, как во всём отчёте */
function gradeHeat(s){
  const max=Math.max(1,...s.rows.map(r=>Math.max(...r.cells))), tot=s.cols.map((_,j)=>sum(s.rows.map(r=>r.cells[j]))), hex=ST_COL[s.key];
  return '<div class="mx-wrap"><table class="ptable stable dense rost-t"><thead><tr><th class="txt">Текущий грейд</th>'+
    s.cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'<th class="st-tot">Всего</th></tr></thead><tbody>'+
    '<tr class="total top"><td class="txt">ИТОГО</td>'+tot.map(v=>'<td>'+D.fmtInt(v)+'</td>').join('')+'<td>'+D.fmtInt(sum(tot))+'</td></tr>'+
    s.rows.map(r=>'<tr><td class="txt">'+esc(r.name)+'</td>'+r.cells.map(v=>cell(v,v/max,hex,v?D.fmtInt(v):'—')).join('')+
      '<td class="lead">'+D.fmtInt(sum(r.cells))+'</td></tr>').join('')+'</tbody></table></div>';
}
/* успешность заявок потока: заявка, успешно, отказ, % отказа — чем выше отказ, тем краснее */
function succTable(cap,sub,rows,head){
  if(!rows.length)return '';
  const pc=x=>x.apps?x.no/x.apps*100:0, top=Math.max(1,...rows.map(pc));
  const T={apps:sum(rows.map(x=>x.apps)),ok:sum(rows.map(x=>x.ok)),no:sum(rows.map(x=>x.no))};
  const tr=(x,cls)=>'<tr'+(cls?' class="'+cls+'"':'')+'><td class="txt"'+(cls?'':U.tipAttr({title:x.name,
      rows:[{label:'Заявка',value:D.fmtInt(x.apps)},{label:'Успешно',value:D.fmtInt(x.ok)},{label:'Отказ',value:D.fmtInt(x.no)}]}))+'>'+
      esc(x.name)+'</td><td>'+D.fmtInt(x.apps)+'</td><td>'+
    D.fmtInt(x.ok)+'</td><td>'+D.fmtInt(x.no)+'</td>'+(cls?'<td>'+U.pct(pc(x))+'</td>':soft(x.no,pc(x)/top,U.pct(pc(x))))+'</tr>';
  return '<div class="bt-group"><div class="bt-cap">'+esc(cap)+'<span class="bt-sub">'+esc(sub)+'</span></div>'+
    '<table class="ptable stable dense rost-t succ"><thead><tr><th class="txt">'+esc(head)+'</th><th>Заявка</th><th>Успешно</th>'+
    '<th>Отказ</th><th>% отказа</th></tr></thead><tbody>'+tr(Object.assign({name:'ИТОГО'},T),'total top')+
    rows.map(x=>tr(x)).join('')+'</tbody></table></div>';
}
/* закрытые заявки потока по месяцам: «Рост» и T@T столбиком; над графиком — итог за 12 месяцев */
function flowBlock(f,what,head){
  return '<div class="rost-kpi"><b>'+D.fmtInt(f.rost)+'</b> '+U.plural(f.rost,['успешно закрытая заявка','успешно закрытые заявки',
      'успешно закрытых заявок'])+' '+esc(what)+' в «Росте» '+esc(D.PER_TEXT)+' · ещё <b>'+D.fmtInt(f.tat)+'</b> — в T@T</div>'+
    G.chart('stack',{periods:f.months,cats:[['rost','Рост',C_R],['tat','T@T',C_T]],unit:' заявок'},
      {title:head,h:300,legend:[{id:'rost',name:'Рост',color:C_R},{id:'tat',name:'T@T',color:C_T}]});
}
/* 31.10-б, п. 5: повышение грейда по месяцам — год к году с января, как «Найм, чел»: бар этого года, позади прошлый;
   «Рост» и T@T — в подсказке месяца; линии базы нет */
function flowYoy(ctx,f,what,head){
  const y=f.yoy;
  if(!y)return flowBlock(f,what,head);
  return '<div class="rost-kpi"><b>'+D.fmtInt(f.rost)+'</b> '+U.plural(f.rost,['успешно закрытая заявка','успешно закрытые заявки',
      'успешно закрытых заявок'])+' '+esc(what)+' в «Росте» '+esc(D.PER_TEXT)+' · ещё <b>'+D.fmtInt(f.tat)+'</b> — в T@T</div>'+
    SC.metricLine('tgrowth_pass',ctx.lp,ctx.bl,ctx.S,{yser:{cur:y.cur,prev:y.prev},noBench:true,kpi:null,h:300,fill:false,
      color:C_R,title:head,tipName:'повышение грейда',
      tipRows:i=>[{label:'· Рост',value:D.fmtInt(y.rost[i]||0),color:C_R},{label:'· T@T',value:D.fmtInt(y.tat[i]||0),color:C_T}]});
}
function grades(ctx,p){
  const cur=p.st.find(x=>x.key===ctx.S.rostSt)||p.st[0];
  return U.btGroup({cap:'Статусы роста',capSub:p.real?'численность последнего месяца · заявки '+D.PER_TEXT:'активная численность · за 12 месяцев',head:'',valueHead:'Человек',
      metricKey:'hc_total',compact:true,items:p.st.map(s=>({name:s.name,value:s.n,color:ST_COL[s.key],on:s===cur,
        attr:'data-rostst="'+s.key+'"',attrTip:'Клик — «'+s.name+'» по текущему грейду. '+s.tip}))})+
    '<div class="bt-group"><div class="bt-cap">'+esc(cur.name)+': по текущему грейду<span class="bt-sub">человек · '+
      esc(cur.tip)+'</span></div>'+gradeHeat(cur)+'</div>'+
    flowYoy(ctx,p.grade,'на повышение грейда','Повышение грейда по месяцам, заявок')+
    U.btStack([succTable('Повышение грейда: «Рост»','по возрастанию грейдов',p.grade.rostT,'Переход: текущий → желаемый грейд'),
      succTable('Повышение грейда: T@T','по возрастанию грейдов',p.grade.tatT,'Переход: текущий → желаемый грейд')])+
    '<div class="tbl-note">Клик по статусу — его тепловая таблица. Заявок больше, чем людей: у одного их бывает несколько.</div>';
}
function specs(p){
  return flowBlock(p.spec,'на смену специализации','Смена специализации по месяцам: «Рост» и T@T, заявок')+
    U.btStack([succTable('Смена специализации: «Рост»','первые 5 по заявкам',p.spec.rostT,'Переход: текущая → желаемая специализация'),
      succTable('Смена специализации: T@T','первые 4 по заявкам',p.spec.tatT,'Переход: текущая → желаемая специализация')])+
    '<div class="tbl-note">Успешно — заявка закрыта со сменой специализации; % отказа — доля отказов среди заявок.</div>';
}

SC.blocks.tgrowth={
  subTabs:[['flow','Конверсия и решения'],['grades','По грейдам'],['spec','Смена специализации']],
  defaultSub:'flow',
  title(sub){return sub==='grades'?'Как растут по грейдам: статусы роста и повышения'
    :sub==='spec'?'Как меняют специализацию: заявки «Рост» и T@T'
    :'Конверсия T-роста и решения по заявкам'},
  view(ctx){
    if(ctx.sub==='grades')return grades(ctx,D.rostProfile(ctx.lp));
    if(ctx.sub==='spec')return specs(D.rostProfile(ctx.lp));
    return SC.metricLine('tgrowth_conv',ctx.lp,ctx.bl,ctx.S,{h:300,title:'Конверсия T-роста, %',ann:ctx.ann.tgrowth_conv})+
      SC.yoyPair(ctx.lp,'tgrowth_pass','tgrowth_deny',
        {h:300,title:'Одобренные и отклонённые заявки',
         legend:[{name:'Одобрено',color:G.C_IN},{name:'Отклонено',color:G.C_OUT}]});
  }
};
})();

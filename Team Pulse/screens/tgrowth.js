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
/* файл 6, п. 5: прошлый год — серый (Рост) и серый с прозрачностью (T@T), зелёные — только у этого года */
const C_RP=G.C_ROST.rostP, C_TP=G.C_ROST.tatP;
/* заливка клетки: от белого к цвету статуса по доле от максимума таблицы */
function ramp(hex,t){
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)), k=0.08+0.34*Math.max(0,Math.min(1,t));   // 31.10: мягче — не ярче клетки отказов
  return 'rgb('+c.map(v=>Math.round(255+(v-255)*k)).join(',')+')';
}
/* 31.10, п. 2: подсветка таблиц повышения и смены — мягкая, самая яркая клетка — G.C_HEAT_RGB с прозрачностью G.HEAT_MAX */
const soft=(v,t,txt)=>'<td'+(v?' style="background:rgba('+G.C_HEAT_RGB+','+(0.12+(G.HEAT_MAX-0.12)*Math.max(0,Math.min(1,t))).toFixed(2)+')"':'')+'>'+txt+'</td>';
const cell=(v,t,hex,txt)=>'<td'+(v?' style="background:'+ramp(hex,t)+'"':'')+'>'+txt+'</td>';
/* тепловая таблица «текущий грейд × тип роста» в людях; ИТОГО — первой строкой, как во всём отчёте */
/* поставка 117 (владелец: «заголовки в таблицах не должны переноситься на 2 строки»): в шапке — короткие имена типов
   роста, полное — в подсказке; колонка грейдов — «Грейд» (подпись таблицы уже говорит «по текущему грейду») */
const COL_SHORT={'Повышение грейда':'Повышение','Смена специализации':'Смена спец.','Грейд и специализация':'Грейд и спец.'};
const thTip=(full,txt)=>'<th'+(COL_SHORT[full]?U.tipAttr({title:full,text:txt||''}):'')+'>'+esc(COL_SHORT[full]||full)+'</th>';
function gradeHeat(s){
  const max=Math.max(1,...s.rows.map(r=>Math.max(...r.cells))), tot=s.cols.map((_,j)=>sum(s.rows.map(r=>r.cells[j]))), hex=ST_COL[s.key];
  return '<div class="mx-wrap"><table class="ptable stable dense rost-t"><thead><tr><th class="txt">Грейд</th>'+
    s.cols.map(c=>thTip(c,'Людей с заявками этого типа по текущему грейду.')).join('')+'<th class="st-tot">Всего</th></tr></thead><tbody>'+
    '<tr class="total top"><td class="txt">Итого</td>'+tot.map(v=>'<td>'+D.fmtInt(v)+'</td>').join('')+'<td>'+D.fmtInt(sum(tot))+'</td></tr>'+
    s.rows.map(r=>'<tr><td class="txt">'+esc(r.name)+'</td>'+r.cells.map(v=>cell(v,v/max,hex,v?D.fmtInt(v):'—')).join('')+
      '<td class="lead">'+D.fmtInt(sum(r.cells))+'</td></tr>').join('')+'</tbody></table></div>';
}
/* успешность заявок потока: заявка, успешно, отказ, % отказа — чем выше отказ, тем краснее */
/* поставка 120 (критик компании: «Итого» таблицы «первые 5» — сумма только показанных строк; «%» читают как успех): строки
   «Итого» нет, итог по всем заявкам — в подписи (tot — по всем строкам, D.rostProfile rostS / tatS), колонка — «Отказ, %» */
function succTable(cap,sub,rows,head,tot){
  if(!rows.length)return '';
  const pc=x=>x.apps?x.no/x.apps*100:0, top=Math.max(1,...rows.map(pc));
  const T=tot||{apps:sum(rows.map(x=>x.apps)),ok:sum(rows.map(x=>x.ok)),no:sum(rows.map(x=>x.no))};
  const tr=(x,cls)=>'<tr'+(cls?' class="'+cls+'"':'')+'><td class="txt"'+(cls?'':U.tipAttr({title:x.name,
      rows:[{label:'Заявка',value:D.fmtInt(x.apps)},{label:'Успешно',value:D.fmtInt(x.ok)},{label:'Отказ',value:D.fmtInt(x.no)}]}))+'>'+
      esc(x.name)+'</td><td>'+D.fmtInt(x.apps)+'</td><td>'+
    D.fmtInt(x.ok)+'</td><td>'+D.fmtInt(x.no)+'</td>'+(cls||x.apps<3?'<td>'+U.pct(pc(x))+'</td>':soft(x.no,pc(x)/top,U.pct(pc(x))))+'</tr>';
  /* поставка 121 (критик на 22 человека: «100%» красным по одной заявке): меньше 3 заявок в строке — без подсветки */
  return '<div class="bt-group"><div class="bt-cap">'+esc(cap)+'<span class="bt-sub">'+esc(sub)+' · всего заявок <b>'+D.fmtInt(T.apps)+'</b>, успешно '+
      D.fmtInt(T.ok)+', отклонено '+D.fmtInt(T.no)+'</span></div>'+
    '<table class="ptable stable dense rost-t succ"><thead><tr><th class="txt">'+esc(head)+'</th><th>Заявка</th><th>Успешно</th>'+
    '<th>Отклонено</th><th'+U.tipAttr({title:'Отказ, %',text:'Доля отклонённых среди заявок этой строки.'})+'>Отказ, %</th></tr></thead><tbody>'+
    rows.map(x=>tr(x)).join('')+'</tbody></table></div>';
}
/* 31.10-б, п. 5: повышение грейда по месяцам — год к году с января, как «Найм, чел»: бар этого года, позади прошлый;
   линии базы нет. Файл 6, п. 5: бар частями — цветами «Рост» и T@T (C_ROST), прошлый год — серым и серым с прозрачностью;
   п. 7: так же — смена специализации (key — ряд метрики графика для подписей и итога) */
function flowYoy(ctx,f,what,head,tipName){
  const y=f.yoy;
  /* поставка 128 (аудит: «N заявок с 1 января» над графиком, а N — из разреза за январь–закрытый месяц): итог — за окно выводов
     (PER_TEXT), как статусы и таблицы успешности ниже; график идёт по дату данных — если там больше, это сказано тут же */
  const cs=a=>{let x=0;for(let i=0;i<=D.CNT_C;i++)x+=a[i]||0;return x}, cR=cs(y.rost), cT=cs(y.tat);
  return '<div class="rost-kpi"><b>'+D.fmtInt(f.rost)+'</b> '+U.plural(f.rost,['успешно закрытая заявка','успешно закрытые заявки',
      'успешно закрытых заявок'])+' '+esc(what)+' в «Росте» '+esc(D.PER_TEXT)+' · ещё <b>'+D.fmtInt(f.tat)+'</b> — в T@T'+
      (cR!==f.rost||cT!==f.tat?' · по '+esc(D.ASOF_LABEL)+' — '+D.fmtInt(cR)+' и '+D.fmtInt(cT)+', как на графике':'')+'</div>'+
    SC.metricLine('tgrowth_pass',ctx.lp,ctx.bl,ctx.S,{yser:{cur:y.cur,prev:y.prev},noBench:true,kpi:null,h:300,fill:false,
      color:C_R,title:head,tipName:tipName||'повышение грейда',
      parts:{cur:[y.rost,y.tat],prev:[y.prevR,y.prevT],col:[C_R,C_T],pcol:[C_RP,C_TP]},
      legend:[{name:D.YEAR_CUR+': Рост, T@T',split:[C_R,C_T]},{name:D.YEAR_PREV+': Рост, T@T',split:[G.alpha(C_RP,.45),G.alpha(C_TP,.45)]}],
      tipRows:i=>[{label:'· Рост',value:D.fmtInt(y.rost[i]||0),color:C_R},{label:'· T@T',value:D.fmtInt(y.tat[i]||0),color:C_T}]});
}
function grades(ctx,p){
  const cur=p.st.find(x=>x.key===ctx.S.rostSt)||p.st[0];
  /* поставка 128: статусы — по заявкам с итогом с января по закрытый месяц (rs ноутбука), не «с 1 января» по дату и не 12 месяцев */
  return U.btGroup({cap:'Статусы роста',capSub:(p.real?'численность последнего месяца':'активная численность')+' · заявки '+D.PER_TEXT,head:'',valueHead:'Чел',
      metricKey:'hc_total',compact:true,items:p.st.map(s=>({name:s.name,value:s.n,color:ST_COL[s.key],on:s===cur,
        attr:'data-rostst="'+s.key+'"',attrTip:'Клик — «'+s.name+'» по текущему грейду. '+s.tip}))})+
    '<div class="bt-group"><div class="bt-cap">'+esc(cur.name)+': по текущему грейду<span class="bt-sub">человек · '+
      esc(cur.tip)+'</span></div>'+gradeHeat(cur)+'</div>'+
    flowYoy(ctx,p.grade,'на повышение грейда','Повышение грейда по месяцам, заявок')+
    U.btStack([succTable('Повышение грейда: «Рост»','по возрастанию грейдов · '+D.PER_TEXT,p.grade.rostT,'Текущий → желаемый',p.grade.rostS),
      succTable('Повышение грейда: T@T','по возрастанию грейдов · '+D.PER_TEXT,p.grade.tatT,'Текущий → желаемый',p.grade.tatS)])+
    '<div class="tbl-note">Клик по статусу — его тепловая таблица. Заявок больше, чем людей: у одного их бывает несколько.</div>';
}
function specs(ctx,p){
  return flowYoy(ctx,p.spec,'на смену специализации','Смена специализации по месяцам, заявок','смена специализации')+
    U.btStack([succTable('Смена специализации: «Рост»','первые 5 по заявкам · '+D.PER_TEXT,p.spec.rostT,'Текущая → желаемая',p.spec.rostS),
      succTable('Смена специализации: T@T','первые 4 по заявкам · '+D.PER_TEXT,p.spec.tatT,'Текущая → желаемая',p.spec.tatS)])+
    '<div class="tbl-note">Успешно — заявка закрыта со сменой специализации; «Отказ, %» — доля отклонённых среди заявок строки.</div>';
}

SC.blocks.tgrowth={
  subTabs:[['flow','Конверсия и решения'],['grades','По грейдам'],['spec','Смена специализации']],
  defaultSub:'flow',
  title(sub){return sub==='grades'?'Как растут по грейдам: статусы роста и повышения'
    :sub==='spec'?'Как меняют специализацию: заявки «Рост» и T@T'
    :'Конверсия T-роста и решения по заявкам'},
  view(ctx){
    /* поставка 128 (аудит: на «Конверсии» одобрено 53 и отклонено 16, а на «По грейдам» и «Смене специализации» за тот же период —
       54 и 18): это разные даты заявки в источнике — решения (ряды отчёта, как эталон «Роста»: месяц итога) и подача (разрез rm
       «Роста»). До выравнивания ноутбука — подписано на каждом шаге, по какому месяцу считаются заявки */
    const basis=(own,other)=>'<div class="tbl-note">Заявки здесь — '+own+'. На шаге «'+other[0]+'» — '+other[1]+
      ', поэтому их число за тот же период может отличаться.</div>';
    if(ctx.sub==='grades')return grades(ctx,D.rostProfile(ctx.lp))+basis('по месяцу подачи',['Конверсия и решения','по месяцу решения']);
    if(ctx.sub==='spec')return specs(ctx,D.rostProfile(ctx.lp))+basis('по месяцу подачи',['Конверсия и решения','по месяцу решения']);
    return SC.metricLine('tgrowth_conv',ctx.lp,ctx.bl,ctx.S,{h:300,title:'Конверсия T-роста, %',ann:ctx.ann.tgrowth_conv})+
      SC.yoyPair(ctx.lp,'tgrowth_pass','tgrowth_deny',
        {h:300,title:'Одобренные и отклонённые заявки',
         legend:[{name:'Одобрено',color:G.C_IN},{name:'Отклонено',color:G.C_OUT}]})+
      basis('по месяцу решения (одобрение или отказ)',['По грейдам','по месяцу подачи']);
  }
};
})();

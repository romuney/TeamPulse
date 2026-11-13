/* Build-time presentation patches only. The normal One-pager and golden data
   functions remain in use; missing inputs defer just the dependent regions. */
module.exports=function patch(src,replace){
  src=replace(src,'function render(S,openRows){',`
function opMissing(part){return D.partsWait('onepager').indexOf(part)>=0}
function opLate(part){return D.partsLate('onepager').indexOf(part)>=0}
function opWaiting(part){return opLate(part)?'Не удалось загрузить':'Загружается…'}
function opWaitNotice(part){return opLate(part)?'Данные не пришли. Обновите отчёт; если это повторится, сообщите владельцу.':'Данные загружаются.'}
function opPendingRow(key,name,hint,open,part){
  let r='<tr class="mrow tp-op-pending'+(open?' open':'')+'" data-metric="'+esc(key)+'">'+
    '<td class="m-name bar-neutral">'+esc(name)+'<span class="m-sub">'+esc(hint||'')+'</span></td>'+
    '<td class="m-val">—<span class="m-per">'+opWaiting(part)+'</span></td>'+
    '<td class="col-num">—</td><td class="col-num">—</td><td class="col-spark"></td>'+
    '<td class="col-tgt"><span class="tbl-note">'+opWaiting(part)+'</span></td>'+
    '<td class="col-caret">'+U.rowCaret(open)+'</td></tr>';
  if(open)r+='<tr class="detail-row"><td colspan="7"><div class="tbl-note">'+opWaitNotice(part)+'</div></td></tr>';
  return r;
}
function opPendingAi(S,openRows){
  const names={ai_penetration:['Проникновение','Доля сотрудников без стажёров, которые пользовались AI за неделю.'],
    ai_wau:['Активные пользователи','Сколько сотрудников без стажёров пользовались AI за неделю.']};
  return '<table class="mtable"><colgroup><col style="width:26%"><col style="width:12%"><col style="width:10%"><col style="width:10%"><col><col style="width:19%"><col style="width:28px"></colgroup>'+
    '<thead><tr><th>Метрика</th><th class="num">Значение</th><th></th><th></th><th class="mid">Динамика по неделям</th><th class="mid">Ориентир</th><th></th></tr></thead><tbody>'+
    D.aiChartsOn(S).map(key=>opPendingRow(key,names[key][0],names[key][1],openRows.has(key),'aux')).join('')+'</tbody></table>';
}
function render(S,openRows){
  const opComplete=D.partsWait('onepager').length===0, opAux=!opMissing('aux');`);
  src=replace(src,"  const pe0=D.peerOf('turnover_y');","  const pe0=opAux?D.peerOf('turnover_y'):null;");
  src=replace(src,"'Сравнение — '+(pe0?'с базой (подразделения '+pe0.bandName+' чел с теми же фильтрами), ':'')+'со всей компанией и с тем же периодом '+D.YEAR_PREV",
    "opAux?'Сравнение — '+(pe0?'с базой (подразделения '+pe0.bandName+' чел с теми же фильтрами), ':'')+'со всей компанией и с тем же периодом '+D.YEAR_PREV:'Ориентиры для сравнения загружаются.'");
  src=replace(src,'const all=I.cards(S,rl,bl,true), list=all.slice(0,I.CARD.show), more=all.slice(I.CARD.show), ok=normOf(S,rl,all);',
    'const all=opComplete?I.cards(S,rl,bl,true):[], list=all.slice(0,I.CARD.show), more=all.slice(I.CARD.show), ok=opComplete?normOf(S,rl,all):[];');
  src=replace(src,"  h+='<div class=\"in-sumrow\">'+normRow(S,rl,ok,bl,more)+U.trafficLegend()+'</div>';",
    `  h+='<div class="in-sumrow">'+(opComplete?normRow(S,rl,ok,bl,more)+U.trafficLegend():
      '<span class="tbl-note tp-op-summary-pending" role="status">'+(D.partsLate('onepager').length?
        'Не все данные для выводов пришли. Готовыми показателями можно пользоваться.':
        'Выводы и сравнения загружаются. Готовые показатели уже доступны.')+'</span>')+'</div>';`);
  src=replace(src,"      if(!cw){h+=U.panel({body:'<div class=\"tbl-note\">Нет данных об использовании AI за последние недели.</div>'});return}",
    "      if(opMissing('aux')){h+=U.panel({body:opPendingAi(S,openRows)});return}\n      if(!cw){h+=U.panel({body:'<div class=\"tbl-note\">Нет данных об использовании AI за последние недели.</div>'});return}");
  src=replace(src,'    bMets.forEach(m=>{',`    bMets.forEach(m=>{
      // The core has a mean; the final value is the flow distribution's median.
      // Never flash a different statistic while waiting for that distribution.
      if(m.key==='time_to_fill'&&opMissing('flow')){
        t+=opPendingRow(m.key,m.name,m.hint,openRows.has(m.key),'flow');return;
      }`);
  src=replace(src,'      const st=D.verdictState(m.key,S,rl,bl);',
    "      const st=opAux||kpi?D.verdictState(m.key,S,rl,bl):'neutral';");
  src=replace(src,'      const bser=!kpi&&D.comparable(m.key)&&!D.isSelfBase()?D.aggregate(bl,m.key):null;',
    '      const bser=opAux&&!kpi&&D.comparable(m.key)&&!D.isSelfBase()?D.aggregate(bl,m.key):null;');
  src=replace(src,'ink:noEval(m,kpi),dots:false', 'ink:(!opAux&&!kpi)||noEval(m,kpi),dots:false');
  src=replace(src,'U.targetCell(m.key,v,bv,kpi,kpi?null:D.peerOf(m.key,rl),rl,bl,st)',
    `(opAux||kpi||!D.comparable(m.key)?U.targetCell(m.key,v,bv,kpi,kpi?null:D.peerOf(m.key,rl),rl,bl,st):
      '<span class="tbl-note tp-op-target-pending">'+opWaiting('aux')+'</span>')`);
  src=replace(src,'        const st=window.TPINSIGHTS.yoyStory(m.key,S,rl,bl);',`
        if(!opAux){
          t+='<tr class="detail-row"><td colspan="7"><div class="detail-chart">'+
            SC.yoyChart(m.key,rl,bl,S,{title:'Этот год и прошлый',h:280,fill:false,noBench:true})+
            '<div class="tbl-note">'+(opLate('aux')?'Не удалось загрузить данные для выводов и сравнений.':'Выводы и сравнения загружаются.')+'</div>'+about(m,S)+'</div></td></tr>';
          return;
        }
        const st=window.TPINSIGHTS.yoyStory(m.key,S,rl,bl);`);
  src=replace(src,"  const ref=kpi?'Ориентир: цель KPI '",
    "  if(opMissing('aux')&&!kpi&&D.comparable(m.key))return h+'<div class=\"op-frs\">Ориентир: '+opWaiting('aux')+'</div>';\n  const ref=kpi?'Ориентир: цель KPI '");
  return src;
};

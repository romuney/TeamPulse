/* Only core-backed metrics. Missing breakdowns never become zero or mock data. */
(function(){
  const D=window.TPDATA, U=window.TPUI, SC=window.TPSCREENS;
  const keys={onepager:['hc_total','hc_avg','hire','attrition','transfer_in','transfer_out'],structure:['hc_total','hc_avg'],movement:['hire','attrition','transfer_in','transfer_out'],
    turnover:['attrition','turnover_y'],hiring:['hire'],tgrowth:['tgrowth_pass','tgrowth_deny'],
    monitor:['underwork','overwork'],office:['office_att'],ai:[]};
  SC.coreKeys=S=>(keys[S.tab]||[]).filter(k=>D.METRIC_BY_KEY[k]&&!D.isStub(k)&&D.metricVisible(k,S));
  // Only facts whose full inputs are in core. No provisional peer judgments,
  // median vacancy durations or invented values before their parts arrive.
  SC.quickSummary=function(S){
    const lp=D.reportLeaves(S);
    const rows=SC.coreKeys(S).map(k=>{
      const m=D.METRIC_BY_KEY[k],p=D.periodTotal(lp,k)||{};
      return '<tr><th scope="row">'+U.esc(m.name)+(p.stock?', сейчас':'')+'</th><td>'+U.esc(p.cur==null?'—':p.cur)+
        '</td><td><button class="btn" data-tab="'+U.esc(m.block)+'">Открыть раздел</button></td></tr>';
    }).join('');
    return '<section class="tp-core-preview"><h2>Основные показатели</h2><p>'+U.esc(D.CNT_NAME)+
      '. Выводы и сравнения появятся после загрузки всех необходимых данных.</p><table class="tp-quick-table"><thead><tr><th>Показатель</th><th>Значение</th><th>Раздел</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
  };
  SC.corePreview=function(S){
    const ready=SC.coreKeys(S);
    if(!ready.length)return '';
    const lp=D.reportLeaves(S), bl=D.benchmarkLeaves(S);
    return '<section class="tp-core-preview">'+ready.map(k=>U.panel({
        title:D.METRIC_BY_KEY[k].name,
        body:SC.metricLine(k,lp,bl,S,{h:280,fill:false,noBench:D.partsWait('onepager').indexOf('aux')>=0})
      })).join('')+'</section>';
  };
})();

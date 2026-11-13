/* Only core-backed metrics. Missing breakdowns never become zero or mock data. */
(function(){
  const D=window.TPDATA, U=window.TPUI, SC=window.TPSCREENS;
  const keys={structure:['hc_total','hc_avg'],movement:['hire','attrition','transfer_in','transfer_out'],
    turnover:['attrition','turnover_y'],hiring:['hire'],tgrowth:['tgrowth_pass','tgrowth_deny'],
    monitor:['underwork','overwork'],office:['office_att'],ai:[]};
  SC.coreKeys=S=>(keys[S.tab]||[]).filter(k=>D.METRIC_BY_KEY[k]&&!D.isStub(k)&&D.metricVisible(k,S));
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

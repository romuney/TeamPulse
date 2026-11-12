/* Same core response: replace the data API in place, retaining the app closure,
   event handlers, root, focus, expanded rows, filters and chart registry. */
if(STORE){
  STORE.previewTab=null;
  on(ROOTEL,'click',ev=>{
    if(!ev.target.closest||!ev.target.closest('[data-tp-details]'))return;
    STORE.previewTab=null;render(false,true);
  });
  function keepFocus(){
    const el=document.activeElement;
    if(!el||!ROOTEL.contains(el)||!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))return ()=>{};
    const attrs=Array.from(el.attributes).filter(a=>a.name==='id'||a.name==='name'||/^data-/.test(a.name))
      .map(a=>[a.name,a.value]);
    const start=el.selectionStart,end=el.selectionEnd;
    return ()=>{
      if(!attrs.length)return;
      const next=Array.from(ROOTEL.querySelectorAll(el.tagName)).find(n=>attrs.every(a=>n.getAttribute(a[0])===a[1]));
      if(!next)return;
      const y=ENV.scroller.scrollTop;
      try{next.focus({preventScroll:true})}catch(e){next.focus()}
      if(start!=null&&typeof next.setSelectionRange==='function')try{next.setSelectionRange(start,end)}catch(e){}
      ENV.scroller.scrollTop=y;
    };
  }
  STORE.updateParts=function(rows,changed){
    const restoreFocus=keepFocus();
    const preview=$('.tp-core-preview');
    if(preview&&ENV.scroller.scrollTop>80)STORE.previewTab=S.tab;
    const old=D, previous=window.TP_REAL;
    const next=window.TPREAL.build(rows);
    if(next.noAccess||next.noMeta||next.missing.length||next.truncated)return false;
    window.TP_REAL=next;
    try{TP_REBUILD_DATA()}catch(err){window.TP_REAL=previous;window.TPDATA=old;throw err}
    Object.assign(old,window.TPDATA);
    window.TPDATA=old;
    D.setHcMode(S.hcType);D.setVerdictScope(S);
    _navKey=null;_navMemo={};
    // Do not replace the chart a user has scrolled to read with a different layout.
    if(preview&&STORE.previewTab===S.tab){
      const top=preview.getBoundingClientRect().top, notice=$('.part-wait');
      if(notice)notice.outerHTML=partWaitView(S.tab);
      renderHead();renderNav();
      ENV.scroller.scrollTop+=preview.getBoundingClientRect().top-top;
      return true;
    }
    const needs=window.TPPARTS.needs(S.tab);
    // aux carries comparisons used throughout the report, not just AI.
    const affects=S.tab==='onepager'||D.partsWait(S.tab).length||changed.indexOf('aux')>=0||changed.some(p=>needs.indexOf(p)>=0);
    if(affects){render(true,true);restoreFocus()}
    else{renderHead();renderNav()}
    return true;
  };
}

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
    if(!el||!ROOTEL.contains(el)||!el.matches('input,textarea,select,button,a,[tabindex]'))return ()=>{};
    const owner=el.closest('[data-metric],.block-h');
    const ownerKey=owner&&(owner.getAttribute('data-metric')||owner.id);
    const attrs=Array.from(el.attributes).filter(a=>a.name==='id'||a.name==='name'||/^data-/.test(a.name))
      .map(a=>[a.name,a.value]);
    const start=el.selectionStart,end=el.selectionEnd;
    return ()=>{
      if(!attrs.length)return;
      const next=Array.from(ROOTEL.querySelectorAll(el.tagName)).find(n=>{
        if(!attrs.every(a=>n.getAttribute(a[0])===a[1]))return false;
        const box=n.closest('[data-metric],.block-h');
        return !ownerKey||box&&(box.getAttribute('data-metric')||box.id)===ownerKey;
      });
      if(!next)return;
      const y=ENV.scroller.scrollTop;
      try{next.focus({preventScroll:true})}catch(e){next.focus()}
      if(start!=null&&typeof next.setSelectionRange==='function')try{next.setSelectionRange(start,end)}catch(e){}
      ENV.scroller.scrollTop=y;
    };
  }
  function keepReading(){
    if(S.tab!=='onepager'||ENV.scroller.scrollTop<1)return ()=>{};
    const bounds=ENV.scroller.getBoundingClientRect();
    const rows=Array.from(ROOTEL.querySelectorAll('#view .mrow[data-metric],#view .detail-row'));
    const el=rows.find(n=>{const r=n.getBoundingClientRect();return r.bottom>bounds.top+130&&r.top<bounds.bottom});
    if(!el)return ()=>{};
    const detail=el.classList.contains('detail-row'), row=detail?el.previousElementSibling:el;
    const key=row&&row.getAttribute('data-metric'), top=el.getBoundingClientRect().top;
    return ()=>{
      const found=Array.from(ROOTEL.querySelectorAll('#view .mrow[data-metric]')).find(n=>n.getAttribute('data-metric')===key);
      const target=found&&(detail?found.nextElementSibling:found);
      if(target)ENV.scroller.scrollTop+=target.getBoundingClientRect().top-top;
    };
  }
  STORE.updateParts=function(rows,changed){
    const restoreFocus=keepFocus();
    const restoreReading=keepReading();
    const preview=$('.tp-core-preview');
    if(preview&&(ENV.scroller.scrollTop>80||preview.contains(document.activeElement)))STORE.previewTab=S.tab;
    const previousWait=D.partsWait(S.tab).join('|')+'/'+D.partsLate(S.tab).join('|');
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
    const readinessChanged=previousWait!==D.partsWait(S.tab).join('|')+'/'+D.partsLate(S.tab).join('|');
    const affects=S.tab==='onepager'||readinessChanged||changed.indexOf('aux')>=0||changed.some(p=>needs.indexOf(p)>=0);
    if(affects){render(true,true);restoreFocus();restoreReading()}
    else{renderHead();renderNav()}
    return true;
  };
}

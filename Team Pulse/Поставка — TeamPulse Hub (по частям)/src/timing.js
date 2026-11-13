/* Bounded, local diagnostics: numbers, booleans and fixed phase names only.
   No filters, unit identifiers, metric values, response bodies or DOM text. */
(function(){
  const st=window.__pvtState||(window.__pvtState={});
  const store=st.tp||(st.tp={});
  const now=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
  const origin=typeof performance!=='undefined'&&performance.timeOrigin||Date.now()-now();
  const perf=store.perf||(store.perf={version:1,originEpochMs:origin,intent:0,intentAtMs:null,frames:[]});
  let current=null, serial=perf.frames.length?perf.frames[perf.frames.length-1].id:0;
  function record(name,start){
    if(current)current.phasesMs[name]=(current.phasesMs[name]||0)+Math.max(0,now()-start);
  }
  window.TP_TIMING={
    now:now,record:record,
    measure(name,fn){const start=now();try{return fn()}finally{record(name,start)}},
    intent(){perf.intent++;perf.intentAtMs=now()},
    begin(have){
      current={id:++serial,intent:perf.intent,intentAtMs:perf.intentAtMs,startMs:now(),
        partsReady:['people','flow','aux'].filter(p=>have[p]).length,
        phasesMs:{},applyEndMs:null,frameOpportunityMs:null,superseded:false};
      perf.frames.push(current);if(perf.frames.length>40)perf.frames.shift();
      return current;
    },
    end(frame){frame.applyEndMs=now();current=null},
    afterFrame(frame){
      // A rendering opportunity is a timing proxy, never proof of visible pixels.
      // No data is committed here; a newer intent invalidates the old observation.
      frame.superseded=frame.id!==serial||frame.intent!==perf.intent;
      if(!frame.superseded)frame.frameOpportunityMs=now();
    }
  };
})();

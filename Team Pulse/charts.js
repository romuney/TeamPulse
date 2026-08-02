/* ============================================================
   TeamPulse Hub — графика (ECharts + чистый SVG)
   Итерация 3. Единые тултипы, шрифты, палитра.
   ============================================================ */
const FONT='Inter, Helvetica, Arial, sans-serif';
const C_LABEL='#2b2b2b', C_AXIS='#8a909c', C_AXISLINE='rgb(220,224,231)', C_DIV='#e4e7ec';
const C_LINE='#3b6fe0', C_BENCH='#9aa0ac', C_GRID='#f0f1f3';
const C_GREEN='#12b048', C_RED='#f51f1f', C_WARN='#f59300';
const PALETTE=['#5f86c2','#7fb0c8','#8b6fc0','#cdbf97','#9fae6a','#c98aa6','#5f9d8a','#bdbdbd'];
const CD=window.TPDATA;

/* ---------- общие части ---------- */
function xLabels(){return CD.MONTHS.map(m=>m.isYearStart?('{y|'+m.y+'}\n'+m.label):m.label)}
function dividerData(){
  const out=[];
  CD.MONTHS.forEach((m,i)=>{if(i>0&&m.isYearStart)out.push([{coord:[i-0.5,'min']},{coord:[i-0.5,'max']}])});
  return out;
}
function baseXAxis(){
  return {type:'category',data:xLabels(),boundaryGap:true,
    axisLine:{lineStyle:{color:C_AXISLINE}},axisTick:{show:false},
    axisLabel:{fontFamily:FONT,color:C_AXIS,fontSize:11,interval:0,
      rich:{y:{fontFamily:FONT,color:C_AXIS,fontSize:11,fontWeight:'bold'}}}};
}
function markLineTpl(){
  return {symbol:['none','none'],silent:true,animation:false,data:dividerData(),
    label:{show:false},lineStyle:{type:'dashed',color:C_DIV,width:1}};
}
function yAxis(metricKey,pct){
  const m=CD.METRIC_BY_KEY[metricKey]||{};
  return {type:'value',scale:m.fmt!=='int',splitLine:{lineStyle:{color:C_GRID}},
    axisLabel:{fontFamily:FONT,color:C_AXIS,fontSize:10,
      formatter:v=>m.fmt==='int'?CD.fmtCompact(v):(m.fmt==='days'?v:(pct===false?v:v))}};
}
/* единый кастомный тултип */
function tipShell(){
  return {trigger:'axis',axisPointer:{type:'line',lineStyle:{color:'#cfd3da'}},
    backgroundColor:'#fff',borderWidth:0,
    extraCssText:'box-shadow:0 4px 14px rgba(20,28,45,.16);border-radius:10px;padding:10px 12px',
    textStyle:{fontFamily:FONT,color:'#333',fontSize:12}};
}
function tipFormatter(metricKey,minW){
  return function(ps){
    let s='<div style="font-family:'+FONT+';min-width:'+(minW||160)+'px">';
    s+='<div style="color:#8a909c;margin-bottom:7px;font-weight:600">'+String(ps[0].axisValueLabel).replace(/\{y\|(\d+)\}\n?/,'$1 ')+'</div>';
    ps.forEach(p=>{
      if(p.value==null)return;
      s+='<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px">'+
         '<span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+p.color+';margin-right:7px"></span>'+p.seriesName+'</span>'+
         '<b>'+CD.fmtVal(metricKey,p.value)+'</b></div>';
    });
    return s+'</div>';
  };
}
const ANIM={animationDuration:600,animationEasing:'cubicOut'};

/* Единая гамма потоков: пришли — зелёный, ушли — красный.
   Одна и та же пара во всех графиках «прибыло / убыло» (баланс, найм-отток, T-рост). */
const C_IN=C_GREEN, C_OUT=C_RED;

/* Борт бизнесовый: значение должно читаться прямо с графика, без наведения. */
function valueLabel(metricKey,position){
  return {show:true,position:position||'top',fontFamily:FONT,fontSize:10,fontWeight:700,color:'#3a3f4a',
    formatter:p=>(p.value==null||p.value==='-')?'':CD.fmtVal(metricKey,Math.abs(p.value))};
}

/* ---------- 1. Линия: метрика vs бенчмарк (пунктир) + KPI ---------- */
function lineOption(metricKey,series,benchSeries,opt){
  opt=opt||{};
  const m=CD.METRIC_BY_KEY[metricKey];
  const data=[{name:opt.name||m.short,type:'line',smooth:false,symbol:'circle',symbolSize:6,
    lineStyle:{width:2.4,color:C_LINE},itemStyle:{color:C_LINE},data:series,z:5,
    markLine:markLineTpl(),label:valueLabel(metricKey)}];
  if(benchSeries)data.push({name:opt.benchName||'База сравнения',type:'line',smooth:false,symbol:'none',
    lineStyle:{width:2,type:'dashed',color:C_BENCH},itemStyle:{color:C_BENCH},data:benchSeries,z:3,
    endLabel:{show:true,formatter:p=>CD.fmtVal(metricKey,p.value),color:C_BENCH,fontWeight:700,fontFamily:FONT,fontSize:11}});
  if(opt.kpi){
    data[0].markLine=Object.assign({},markLineTpl());
    data.push({name:'KPI',type:'line',data:new Array(CD.N).fill(null),symbol:'none',lineStyle:{width:0},
      markLine:{silent:true,symbol:'none',animation:false,
        data:[{yAxis:opt.kpi.green,lineStyle:{color:C_GREEN,type:'dotted',width:1.6},label:{show:true,position:'insideEndTop',formatter:'KPI '+CD.fmtVal(metricKey,opt.kpi.green),color:C_GREEN,fontSize:10,fontWeight:700,fontFamily:FONT}},
              {yAxis:opt.kpi.red,lineStyle:{color:C_RED,type:'dotted',width:1.6},label:{show:true,position:'insideEndBottom',formatter:'порог '+CD.fmtVal(metricKey,opt.kpi.red),color:C_RED,fontSize:10,fontWeight:700,fontFamily:FONT}}]}});
  }
  /* Заголовок слева, легенда справа: раньше оба садились в левый верхний угол и перекрывались */
  const head=opt.title||opt.legend;
  return Object.assign({
    grid:{left:6,right:opt.benchName?58:16,top:head?46:18,bottom:20,containLabel:true},
    title:opt.title?{text:opt.title,left:0,top:2,textStyle:{fontFamily:FONT,fontSize:13,fontWeight:700,color:'#1f1f1f'}}:undefined,
    legend:opt.legend?{top:2,right:0,left:opt.title?'auto':0,itemWidth:14,itemHeight:9,itemGap:14,padding:0,
      textStyle:{fontFamily:FONT,fontSize:11.5,color:C_LABEL}}:undefined,
    tooltip:Object.assign(tipShell(),{formatter:tipFormatter(metricKey)}),
    xAxis:baseXAxis(),yAxis:yAxis(metricKey),series:data},ANIM);
}

/* ---------- 2. Стек: причины увольнений ---------- */
function stackedOption(seriesDefs,metricKey){
  return Object.assign({
    grid:{left:6,right:16,top:40,bottom:20,containLabel:true},
    legend:{top:6,left:0,itemWidth:13,itemHeight:9,itemGap:12,padding:0,textStyle:{fontFamily:FONT,fontSize:11.5,color:C_LABEL}},
    tooltip:Object.assign(tipShell(),{axisPointer:{type:'shadow'},formatter:tipFormatter(metricKey||'attrition',200)}),
    xAxis:baseXAxis(),yAxis:yAxis(metricKey||'attrition'),
    series:seriesDefs.map((s,i)=>({name:s.name,type:'bar',stack:'st',barMaxWidth:32,
      itemStyle:{color:s.color||PALETTE[i%PALETTE.length],borderRadius:i===seriesDefs.length-1?[3,3,0,0]:0},
      emphasis:{focus:'series'},data:s.data}))},ANIM);
}

/* ---------- 3. Группированные бары ---------- */
function groupedBarOption(seriesDefs,metricKey){
  return Object.assign({
    grid:{left:6,right:16,top:40,bottom:20,containLabel:true},
    legend:{top:6,left:0,itemWidth:13,itemHeight:9,itemGap:12,padding:0,textStyle:{fontFamily:FONT,fontSize:11.5,color:C_LABEL}},
    tooltip:Object.assign(tipShell(),{axisPointer:{type:'shadow'},formatter:tipFormatter(metricKey,180)}),
    xAxis:baseXAxis(),yAxis:yAxis(metricKey),
    series:seriesDefs.map((s,i)=>({name:s.name,type:'bar',barMaxWidth:15,barGap:'12%',
      itemStyle:{color:s.color||PALETTE[i%PALETTE.length],borderRadius:[3,3,0,0]},data:s.data}))},ANIM);
}

/* ---------- 4. Waterfall: движение персонала ---------- */
function waterfallOption(steps){
  const base=[],pos=[],neg=[];let acc=0;
  steps.forEach((s,i)=>{
    if(s.total){base.push(0);pos.push(s.value);neg.push('-');acc=s.value;return}
    if(s.value>=0){base.push(acc);pos.push(s.value);neg.push('-');acc+=s.value}
    else{acc+=s.value;base.push(acc);pos.push('-');neg.push(-s.value)}
  });
  return Object.assign({
    grid:{left:6,right:16,top:16,bottom:20,containLabel:true},
    tooltip:Object.assign(tipShell(),{axisPointer:{type:'shadow'},
      formatter:ps=>{const p=ps.find(x=>x.value!=='-'&&x.seriesName!=='base');if(!p)return'';
        const st=steps[p.dataIndex];
        return '<div style="font-family:'+FONT+'"><div style="color:#8a909c;margin-bottom:5px;font-weight:600">'+st.name+'</div><b style="font-size:15px">'+(st.total?'':(st.value>0?'+':''))+CD.fmtInt(st.value)+' чел</b></div>'}}),
    xAxis:{type:'category',data:steps.map(s=>s.name),axisLine:{lineStyle:{color:C_AXISLINE}},axisTick:{show:false},
      axisLabel:{fontFamily:FONT,color:C_AXIS,fontSize:11,interval:0,width:76,overflow:'break',lineHeight:14}},
    yAxis:{type:'value',splitLine:{lineStyle:{color:C_GRID}},axisLabel:{fontFamily:FONT,color:C_AXIS,fontSize:10,formatter:v=>CD.fmtCompact(v)}},
    series:[
      {name:'base',type:'bar',stack:'w',itemStyle:{color:'transparent'},emphasis:{itemStyle:{color:'transparent'}},data:base,silent:true},
      {name:'Прибыло',type:'bar',stack:'w',barMaxWidth:44,data:pos,
       itemStyle:{color:p=>steps[p.dataIndex].total?'#5f86c2':C_GREEN,borderRadius:[3,3,0,0]},
       label:{show:true,position:'top',fontFamily:FONT,fontSize:11,fontWeight:700,color:'#3a3f4a',formatter:p=>p.value==='-'?'':(steps[p.dataIndex].total?CD.fmtInt(p.value):'+'+CD.fmtInt(p.value))}},
      {name:'Убыло',type:'bar',stack:'w',barMaxWidth:44,data:neg,
       itemStyle:{color:C_RED,borderRadius:[3,3,0,0]},
       label:{show:true,position:'bottom',fontFamily:FONT,fontSize:11,fontWeight:700,color:'#d11414',formatter:p=>p.value==='-'?'':'−'+CD.fmtInt(p.value)}}
    ]},ANIM);
}

/* ---------- 5. Горизонтальные бары: сравнение подразделений ---------- */
function hBarOption(items,metricKey,benchVal){
  const m=CD.METRIC_BY_KEY[metricKey];
  return Object.assign({
    grid:{left:6,right:46,top:10,bottom:12,containLabel:true},
    tooltip:Object.assign(tipShell(),{trigger:'item',
      formatter:p=>'<div style="font-family:'+FONT+'"><div style="color:#8a909c;margin-bottom:5px;font-weight:600">'+p.name+'</div><b style="font-size:15px">'+CD.fmtVal(metricKey,p.value)+'</b>'+(benchVal!=null?'<div style="color:#8a909c;margin-top:4px">база '+CD.fmtVal(metricKey,benchVal)+'</div>':'')+'</div>'}),
    xAxis:{type:'value',splitLine:{lineStyle:{color:C_GRID}},axisLabel:{fontFamily:FONT,color:C_AXIS,fontSize:10,formatter:v=>m.fmt==='int'?CD.fmtCompact(v):v}},
    yAxis:{type:'category',data:items.map(i=>i.name),inverse:true,axisLine:{show:false},axisTick:{show:false},
      axisLabel:{fontFamily:FONT,color:'#3a3f4a',fontSize:11.5,fontWeight:600,width:150,overflow:'truncate'}},
    series:[{type:'bar',barMaxWidth:16,data:items.map(i=>({value:i.value,itemStyle:{color:i.color||'#9fc0f5',borderRadius:[0,3,3,0]}})),
      label:{show:true,position:'right',fontFamily:FONT,fontSize:11.5,fontWeight:700,color:'#3a3f4a',formatter:p=>CD.fmtVal(metricKey,p.value)},
      markLine:benchVal!=null?{silent:true,symbol:'none',animation:false,
        data:[{xAxis:benchVal,lineStyle:{color:C_BENCH,type:'dashed',width:1.6},
          label:{show:true,position:'end',formatter:'база',color:C_BENCH,fontSize:10,fontWeight:700,fontFamily:FONT}}]}:undefined}]},ANIM);
}

/* ---------- 6. Кольцо: доли (причины, разрезы) ---------- */
function donutOption(items,unitLabel){
  const total=items.reduce((s,i)=>s+i.value,0);
  return Object.assign({
    tooltip:Object.assign(tipShell(),{trigger:'item',
      formatter:p=>'<div style="font-family:'+FONT+'"><div style="color:#8a909c;margin-bottom:5px;font-weight:600">'+p.name+'</div><b style="font-size:15px">'+CD.fmtInt(p.value)+' '+(unitLabel||'')+'</b><div style="color:#8a909c;margin-top:3px">'+(total?(p.value/total*100).toFixed(1).replace('.',',') : 0)+'% от всего</div></div>'}),
    legend:{orient:'vertical',right:4,top:'middle',itemWidth:11,itemHeight:9,itemGap:9,width:150,
      textStyle:{fontFamily:FONT,fontSize:11.5,color:C_LABEL},
      formatter:n=>{const it=items.find(x=>x.name===n);return n.length>26?n.slice(0,25)+'…':n}},
    series:[{type:'pie',radius:['52%','76%'],center:['31%','50%'],avoidLabelOverlap:true,
      itemStyle:{borderColor:'#fff',borderWidth:2},
      label:{show:false},labelLine:{show:false},
      emphasis:{scale:true,scaleSize:5,itemStyle:{shadowBlur:10,shadowColor:'rgba(20,28,45,.18)'}},
      data:items.map((i,k)=>({name:i.name,value:i.value,itemStyle:{color:i.color||PALETTE[k%PALETTE.length]}}))}]},ANIM);
}

/* ---------- 7. Sparkline на чистом SVG ---------- */
function sparkSVG(series,state,w,h){
  w=w||120;h=h||26;
  const n=series.length,mn=Math.min(...series),mx=Math.max(...series),rng=(mx-mn)||1;
  const col=state==='bad'?'#f51f1f':state==='good'?'#12b048':state==='warn'?'#f59300':'#9bb6e8';
  const bw=w/n;let bars='';
  series.forEach((v,i)=>{
    const bh=Math.max(2,((v-mn)/rng)*(h-4)+2);
    const x=i*bw+1,y=h-bh;
    const c=i===n-1?col:'#cdd6e6';
    bars+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(bw-2).toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="1.5" fill="'+c+'"/>';
  });
  return '<svg class="spark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+bars+'</svg>';
}
/* мини-линия для KPI-карточек */
function sparkLineSVG(series,state,w,h){
  w=w||120;h=h||26;
  const n=series.length,mn=Math.min(...series),mx=Math.max(...series),rng=(mx-mn)||1;
  const col=state==='bad'?'#f51f1f':state==='good'?'#12b048':state==='warn'?'#f59300':'#3b6fe0';
  const pts=series.map((v,i)=>[(i/(n-1))*(w-3)+1.5,h-2-((v-mn)/rng)*(h-5)]);
  const dstr=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=dstr+' L'+pts[n-1][0].toFixed(1)+' '+h+' L'+pts[0][0].toFixed(1)+' '+h+' Z';
  return '<svg class="spark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+
    '<path d="'+area+'" fill="'+col+'" opacity=".10"/>'+
    '<path d="'+dstr+'" fill="none" stroke="'+col+'" stroke-width="1.8" stroke-linejoin="round"/>'+
    '<circle cx="'+pts[n-1][0].toFixed(1)+'" cy="'+pts[n-1][1].toFixed(1)+'" r="2.4" fill="'+col+'"/></svg>';
}

/* ---------- 8. Воронка найма ---------- */
function funnelOption(items){
  return Object.assign({
    tooltip:Object.assign(tipShell(),{trigger:'item',
      formatter:p=>'<div style="font-family:'+FONT+'"><div style="color:#8a909c;margin-bottom:5px;font-weight:600">'+p.name+'</div><b style="font-size:15px">'+CD.fmtInt(p.value)+'</b></div>'}),
    series:[{type:'funnel',left:'8%',top:10,bottom:10,width:'72%',min:0,
      max:Math.max(...items.map(i=>i.value),1),minSize:'18%',maxSize:'100%',sort:'descending',gap:3,
      label:{show:true,position:'right',fontFamily:FONT,fontSize:11.5,color:C_LABEL,
        formatter:p=>p.name+'  '+CD.fmtInt(p.value)},
      labelLine:{length:12,lineStyle:{color:'#cfd3da'}},
      itemStyle:{borderColor:'#fff',borderWidth:1},
      emphasis:{label:{fontSize:12,fontWeight:700}},
      data:items.map((i,k)=>({name:i.name,value:i.value,itemStyle:{color:i.color||PALETTE[k%PALETTE.length]}}))}]},ANIM);
}

/* ---------- реестр инстансов: защита от дублей при смене вкладок ---------- */
const _inst=new Map();

/* ---------- 11. Бары по месяцам: одна метрика, подпись над каждым баром ---------- */
function barMonthsOption(metricKey,data,opt){
  opt=opt||{};
  return Object.assign({
    grid:{left:6,right:16,top:opt.title?40:16,bottom:20,containLabel:true},
    title:opt.title?{text:opt.title,left:0,top:2,textStyle:{fontFamily:FONT,fontSize:13,fontWeight:700,color:'#1f1f1f'}}:undefined,
    tooltip:Object.assign(tipShell(),{axisPointer:{type:'shadow'},formatter:tipFormatter(metricKey,170)}),
    xAxis:baseXAxis(),yAxis:yAxis(metricKey),
    series:[{name:opt.name||CD.METRIC_BY_KEY[metricKey].short,type:'bar',barMaxWidth:30,
      itemStyle:{color:opt.color||C_LINE,borderRadius:[3,3,0,0]},
      markLine:markLineTpl(),label:valueLabel(metricKey),data:data}]},ANIM);
}

/* ---------- 12. Дивергентные бары по месяцам: прибыло вверх, убыло вниз ---------- */
/* Одна ось X, один столбец растёт вверх, второй вниз от нуля — видно и объём, и сальдо. */
function divergingMonthsOption(up,down,opt){
  opt=opt||{};
  const kUp=opt.upKey,kDn=opt.downKey||opt.upKey;
  const names=[opt.upName||'Прибыло',opt.downName||'Убыло'];
  return Object.assign({
    grid:{left:6,right:16,top:36,bottom:20,containLabel:true},
    legend:{top:2,right:0,itemWidth:13,itemHeight:9,itemGap:14,padding:0,data:names,
      textStyle:{fontFamily:FONT,fontSize:11.5,color:C_LABEL}},
    tooltip:Object.assign(tipShell(),{axisPointer:{type:'shadow'},formatter:ps=>{
      let s='<div style="font-family:'+FONT+';min-width:170px">';
      s+='<div style="color:#8a909c;margin-bottom:7px;font-weight:600">'+String(ps[0].axisValueLabel).replace(/\{y\|(\d+)\}\n?/,'$1 ')+'</div>';
      let net=0;
      ps.forEach(p=>{
        if(p.value==null)return;net+=p.value;
        s+='<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px">'+
           '<span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+p.color+';margin-right:7px"></span>'+p.seriesName+'</span>'+
           '<b>'+CD.fmtVal(p.seriesIndex===0?kUp:kDn,Math.abs(p.value))+'</b></div>';
      });
      return s+'<div style="display:flex;justify-content:space-between;gap:16px;margin-top:6px;padding-top:5px;border-top:1px solid #eef0f3;color:#8a909c">'+
        '<span>Сальдо</span><b style="color:'+(net>=0?C_GREEN:C_RED)+'">'+(net>0?'+':net<0?'−':'')+CD.fmtInt(Math.abs(net))+'</b></div></div>';
    }}),
    xAxis:baseXAxis(),
    yAxis:{type:'value',splitLine:{lineStyle:{color:C_GRID}},
      axisLabel:{fontFamily:FONT,color:C_AXIS,fontSize:10,formatter:v=>CD.fmtCompact(Math.abs(v))}},
    series:[
      {name:names[0],type:'bar',stack:'dv',barMaxWidth:28,z:3,
       itemStyle:{color:C_IN,borderRadius:[3,3,0,0]},markLine:markLineTpl(),
       label:valueLabel(kUp,'top'),data:up},
      {name:names[1],type:'bar',stack:'dv',barMaxWidth:28,z:3,
       itemStyle:{color:C_OUT,borderRadius:[0,0,3,3]},
       label:valueLabel(kDn,'bottom'),data:down.map(v=>-Math.abs(v))}
    ]},ANIM);
}

/* ---------- 13. Стек панелей: одна метрика — одна панель, общая ось X ---------- */
/* Правило отчёта: два бара рядом за один период не рисуем — динамика так не читается.
   panels: [{title, metricKey, series:[{name,type:'bar'|'line',data,color,metricKey}]}] */
function panelsOption(panels){
  const n=panels.length, band=100/n;
  const grids=[],xs=[],ys=[],titles=[],series=[],meta=[],legendNames=[];
  panels.forEach((p,i)=>{
    const last=i===n-1;
    grids.push({left:6,right:16,top:(i*band+8)+'%',height:(band-17)+'%',containLabel:true});
    const ax=baseXAxis();ax.gridIndex=i;
    if(!last)ax.axisLabel=Object.assign({},ax.axisLabel,{show:false});
    xs.push(ax);
    const ay=yAxis(p.metricKey);ay.gridIndex=i;ys.push(ay);
    titles.push({text:p.title,left:0,top:(i*band+0.5)+'%',
      textStyle:{fontFamily:FONT,fontSize:12.5,fontWeight:700,color:'#1f1f1f'}});
    p.series.forEach(s=>{
      const mk=s.metricKey||p.metricKey, isLine=s.type==='line';
      meta.push(mk);legendNames.push(s.name);
      series.push({name:s.name,type:isLine?'line':'bar',xAxisIndex:i,yAxisIndex:i,data:s.data,
        barMaxWidth:28,smooth:false,symbol:'circle',symbolSize:5,z:isLine?5:3,
        itemStyle:{color:s.color||C_LINE,borderRadius:isLine?0:[3,3,0,0]},
        lineStyle:isLine?{width:2.2,color:s.color||C_LINE}:undefined,
        markLine:markLineTpl(),label:valueLabel(mk)});
    });
  });
  return Object.assign({
    title:titles,grid:grids,xAxis:xs,yAxis:ys,
    legend:legendNames.length>n?{top:2,right:0,itemWidth:13,itemHeight:9,itemGap:14,padding:0,
      textStyle:{fontFamily:FONT,fontSize:11.5,color:C_LABEL}}:undefined,
    tooltip:Object.assign(tipShell(),{axisPointer:{type:'shadow',link:[{xAxisIndex:'all'}]},
      formatter:ps=>{
        let s='<div style="font-family:'+FONT+';min-width:190px">';
        s+='<div style="color:#8a909c;margin-bottom:7px;font-weight:600">'+String(ps[0].axisValueLabel).replace(/\{y\|(\d+)\}\n?/,'$1 ')+'</div>';
        ps.forEach(p=>{
          if(p.value==null)return;
          s+='<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px">'+
             '<span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+p.color+';margin-right:7px"></span>'+p.seriesName+'</span>'+
             '<b>'+CD.fmtVal(meta[p.seriesIndex],Math.abs(p.value))+'</b></div>';
        });
        return s+'</div>';
      }}),
    series:series},ANIM);
}

function mount(el,option,onClick){
  if(!el)return null;
  const prev=_inst.get(el);if(prev)prev.dispose();
  const ch=echarts.init(el,null,{renderer:'canvas'});
  ch.setOption(option);
  if(onClick)ch.on('click',onClick);
  _inst.set(el,ch);
  return ch;
}
function disposeAll(){_inst.forEach(c=>c.dispose());_inst.clear()}
function resizeAll(){_inst.forEach(c=>c.resize())}
window.addEventListener('resize',()=>{clearTimeout(window._rz);window._rz=setTimeout(resizeAll,160)});

/* ---------- 9. Состав: горизонтальные 100% стеки по подразделениям ---------- */
function stackShareOption(cats,rowsIn,unitLabel){
  const names=rowsIn.map(r=>r.name);
  const totals=rowsIn.map(r=>r.parts.reduce((a,b)=>a+b,0)||1);
  return Object.assign({
    grid:{left:6,right:52,top:40,bottom:16,containLabel:true},
    legend:{top:6,left:0,itemWidth:13,itemHeight:9,itemGap:12,padding:0,
      textStyle:{fontFamily:FONT,fontSize:11.5,color:C_LABEL}},
    tooltip:Object.assign(tipShell(),{trigger:'axis',axisPointer:{type:'shadow'},
      formatter:ps=>{
        const i=ps[0].dataIndex, tot=totals[i];
        let out='<div style="font-family:'+FONT+'"><div style="color:#8a909c;margin-bottom:7px;font-weight:600">'+names[i]+'</div>';
        ps.forEach(p=>{out+='<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px"><span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+p.color+';margin-right:7px"></span>'+p.seriesName+'</span><b>'+CD.fmtInt(p.value)+' '+(unitLabel||'')+' · '+(p.value/tot*100).toFixed(0)+'%</b></div>'});
        return out+'<div style="margin-top:6px;color:#8a909c">всего '+CD.fmtInt(tot)+' '+(unitLabel||'')+'</div></div>';
      }}),
    xAxis:{type:'value',splitLine:{lineStyle:{color:C_GRID}},axisLabel:{fontFamily:FONT,color:C_AXIS,fontSize:10,formatter:v=>CD.fmtCompact(v)}},
    yAxis:{type:'category',data:names,inverse:true,axisLine:{show:false},axisTick:{show:false},
      axisLabel:{fontFamily:FONT,color:'#3a3f4a',fontSize:11.5,fontWeight:600,width:130,overflow:'truncate'}},
    series:cats.map((c,ci)=>({name:c.name,type:'bar',stack:'s',barMaxWidth:22,
      itemStyle:{color:c.color,borderRadius:ci===cats.length-1?[0,3,3,0]:0},
      data:rowsIn.map(r=>r.parts[ci]),
      label:ci===cats.length-1?{show:true,position:'right',fontFamily:FONT,fontSize:11,fontWeight:700,color:'#3a3f4a',
        formatter:p=>CD.fmtInt(totals[p.dataIndex])}:{show:false}}))},ANIM);
}

/* ---------- 10. Прирост за период: дивергентные бары ---------- */
function divergingOption(items,unitLabel){
  return Object.assign({
    grid:{left:6,right:52,top:14,bottom:14,containLabel:true},
    tooltip:Object.assign(tipShell(),{trigger:'item',
      formatter:p=>'<div style="font-family:'+FONT+'"><div style="color:#8a909c;margin-bottom:5px;font-weight:600">'+p.name+'</div><b style="font-size:15px">'+(p.value>0?'+':'')+CD.fmtInt(p.value)+' '+(unitLabel||'')+'</b></div>'}),
    xAxis:{type:'value',splitLine:{lineStyle:{color:C_GRID}},axisLabel:{fontFamily:FONT,color:C_AXIS,fontSize:10}},
    yAxis:{type:'category',data:items.map(i=>i.name),inverse:true,axisLine:{show:false},axisTick:{show:false},
      axisLabel:{fontFamily:FONT,color:'#3a3f4a',fontSize:11.5,fontWeight:600,width:130,overflow:'truncate'}},
    series:[{type:'bar',barMaxWidth:18,
      data:items.map(i=>({value:i.value,itemStyle:{color:i.value>=0?'#5f9d8a':'#c98aa6',borderRadius:i.value>=0?[0,3,3,0]:[3,0,0,3]}})),
      label:{show:true,position:'right',fontFamily:FONT,fontSize:11,fontWeight:700,color:'#3a3f4a',
        formatter:p=>(p.value>0?'+':'')+CD.fmtInt(p.value)}}]},ANIM);
}

window.TPCHARTS={stackShareOption,divergingOption,FONT,PALETTE,C_LINE,C_BENCH,C_GREEN,C_RED,C_WARN,C_IN,C_OUT,
  lineOption,stackedOption,groupedBarOption,waterfallOption,hBarOption,donutOption,funnelOption,
  barMonthsOption,divergingMonthsOption,panelsOption,
  sparkSVG,sparkLineSVG,mount,disposeAll,resizeAll};

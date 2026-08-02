/* ============================================================================
   insights.js — движок предрасчитанных инсайтов. Неймспейс: window.TPINSIGHTS.

   Это не текстовый шаблон, а отбор фактов по порогам. Правило: нет факта выше
   порога — нет блока инсайтов, вместо него одна строка «отклонений нет».
   Никакой воды.

   Пороги вынесены сюда, чтобы крутить их не задевая экраны.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, U=window.TPUI;
const esc=U.esc;

const INS_GAP=10;      /* порог отклонения от базы или KPI, % */
const INS_TREND=3;     /* длина направленного тренда, месяцев */
const INS_CONC=50;     /* доля одного подразделения в общем отклонении, % */

function relGap(v,base){return base?((v-base)/Math.abs(base))*100:0}
function trendLen(ser){
  let up=1,dn=1;
  for(let i=ser.length-1;i>0;i--){if(ser[i]>ser[i-1])up++;else break}
  for(let i=ser.length-1;i>0;i--){if(ser[i]<ser[i-1])dn++;else break}
  return up>=dn?{dir:'up',len:up}:{dir:'dn',len:dn};
}
function isBad(m,v,base){return m.better==='lower'?v>base:m.better==='higher'?v<base:false}

/* ctx: {S, b, mainK, rl, bl, rows, rowLeaves} */
function build(ctx){
  const S=ctx.S, b=ctx.b, mainK=ctx.mainK, rl=ctx.rl, bl=ctx.bl, rows=ctx.rows;
  const out=[];
  /* факты только по выбранным метрикам: инсайт про отключённую метрику
     некуда проверить — её нет ни в таблице, ни в KPI-карточках */
  D.visibleMetricsOfBlock(b.key,S).forEach(m=>{
    if(m.better==='flat')return;
    const ser=D.aggregate(rl,m.key), v=ser[D.LAST];
    const kpi=D.kpiFor(m.key,S);
    const base=kpi?kpi.green:D.lastVal(bl,m.key);
    /* разрыв считаем только там, где сравнение осмысленно; тренд — у любой метрики */
    if((D.comparable(m.key)||kpi)&&base!=null&&isFinite(base)){
      const gap=relGap(v,base), bad=isBad(m,v,base);
      if(Math.abs(gap)>=INS_GAP){
        out.push({sev:bad?(Math.abs(gap)>=25?3:2):1,metric:m,
          text:'<b>'+esc(m.name)+'</b> '+(bad?'хуже':'лучше')+' '+(kpi?'цели KPI':'базы')+' на '+
            Math.abs(gap).toFixed(0)+'%: '+D.fmtVal(m.key,v)+' против '+D.fmtVal(m.key,base)+'.'});
      }
    }
    const t=trendLen(ser);
    if(t.len>=INS_TREND){
      const worsening=(m.better==='lower'&&t.dir==='up')||(m.better==='higher'&&t.dir==='dn');
      out.push({sev:worsening?2:1,metric:m,
        text:'<b>'+esc(m.name)+'</b> '+(t.dir==='up'?'растёт':'снижается')+' '+t.len+'-й месяц подряд: '+
          D.fmtVal(m.key,ser[D.LAST-t.len+1])+' → '+D.fmtVal(m.key,v)+
          (worsening?' — динамика против вас.':' — динамика в вашу пользу.')});
    }
  });

  /* концентрация отклонения в одном подразделении */
  const mM=D.METRIC_BY_KEY[mainK];
  if(mM.better!=='flat'&&rows.length>1&&(D.comparable(mainK)||D.kpiFor(mainK,S))){
    const kpi=D.kpiFor(mainK,S);
    const base=kpi?kpi.green:D.lastVal(bl,mainK);
    const tops=rows.filter(r=>r.depth===1).map(r=>{
      const lp=ctx.rowLeaves(r.n.path);
      const v=D.lastVal(lp,mainK), hc=D.lastVal(lp,'hc_total');
      return {name:r.n.name,v:v,hc:hc,exc:isBad(mM,v,base)?Math.abs(v-base)*Math.max(hc,1):0};
    });
    const total=tops.reduce((a,x)=>a+x.exc,0);
    if(total>0){
      const top=tops.slice().sort((a,b2)=>b2.exc-a.exc)[0];
      const share=top.exc/total*100;
      if(share>=INS_CONC)out.push({sev:3,metric:mM,
        text:'<b>'+esc(top.name)+'</b> даёт '+share.toFixed(0)+'% всего отклонения по '+esc(mM.name).toLowerCase()+
          ': '+D.fmtVal(mainK,top.v)+' при '+(kpi?'цели ':'базе ')+D.fmtVal(mainK,base)+
          ' на '+D.fmtInt(top.hc)+' чел. Начните разбор с него.'});
    }
  }
  out.sort((a,b2)=>b2.sev-a.sev);
  return out;
}

function html(ctx){
  const S=ctx.S, b=ctx.b;
  const ins=build(ctx);
  const id='ins-'+b.key, open=S.aiOpen===id;
  if(!ins.length){
    /* дежурный огонёк в подвале навигации отражает ту же оценку, что и
       плашка инсайта — собственной он не изобретает, иначе два источника
       правды разошлись бы на одном экране */
    window.TPINSIGHTS.lastSev='none';
    /* «Отклонений нет» — такая же работа движка, как и найденный инсайт:
       отбор прошёл, просто ничего выше порогов не нашлось. Поэтому здесь такая
       же AI-плашка, а не серая строчка: место подсказки на экране одно и то
       же на всех вкладках, и раскрывается оно везде одинаково. */
    const vis=D.visibleMetricsOfBlock(b.key,S);
    const hasCmp=vis.some(m=>D.comparable(m.key));
    const nChk=vis.filter(m=>m.better!=='flat').length;
    const lead=hasCmp
      ? 'Существенных отклонений от базы нет: все метрики блока в пределах <b>'+INS_GAP+
        '%</b> от <b>'+esc(D.benchmarkLabel(S))+'</b>, устойчивых трендов нет.'
      : 'Метрики блока абсолютные, с базой не сравниваются. Устойчивых трендов за период нет.';
    const bl2=[];
    if(hasCmp)bl2.push('Сравнение с базой: проверено метрик — <b>'+nChk+
      '</b>, ни одна не вышла за <b>±'+INS_GAP+'%</b> от '+esc(D.benchmarkLabel(S))+'.');
    else bl2.push('Метрики блока абсолютные: больше или меньше здесь не значит хуже или лучше, сравнение с базой для них не строится.');
    bl2.push('Тренды: нет ни одной метрики, которая шла бы в одну сторону <b>'+INS_TREND+
      '</b> месяца подряд и больше.');
    bl2.push('Концентрация: ни одно подразделение не даёт <b>'+INS_CONC+
      '%</b> и больше отклонения по главной метрике блока.');
    return U.aiBlock(id,'Главное в блоке',lead,bl2,open,'insight sev-none');
  }
  const maxSev=ins[0].sev;
  const sevCls=maxSev>=3?'high':maxSev===2?'mid':'good';
  window.TPINSIGHTS.lastSev=sevCls;
  const sevTxt=maxSev>=3?'требует действий':maxSev===2?'стоит внимания':'позитив';
  const lead=ins[0].text.replace(/<[^>]+>/g,'');
  let h='<div class="ai insight sev-'+sevCls+'"><div class="ai-h" data-ai="'+id+'">'+
    U.aiIco(open)+'<span class="ai-t">Главное в блоке</span>'+
    '<span class="ai-lead">'+(open?'':esc(lead))+'</span>'+
    '<span class="ai-sev '+sevCls+'">'+sevTxt+'</span>'+
    '<span class="ai-tag">'+(open?'свернуть':'подробнее')+'</span>'+
    '<span class="ai-caret">'+(open?'▲':'▼')+'</span></div>';
  if(open){
    h+='<div class="ai-b"><ul>'+ins.slice(0,4).map(x=>'<li>'+x.text+'</li>').join('')+'</ul>'+
      '<div class="ins-note">Показано только то, что вышло за порог: отклонение от базы больше '+INS_GAP+
      '%, тренд от '+INS_TREND+' месяцев или концентрация отклонения выше '+INS_CONC+'% в одном подразделении.</div></div>';
  }
  return h+'</div>';
}

/* lastSev — тяжесть последнего отрисованного инсайта: её читает mascot.js,
   чтобы эмоция огонька совпадала с тем, что пользователь видит в плашке. */
window.TPINSIGHTS={build,html,INS_GAP,INS_TREND,INS_CONC,lastSev:'none'};
})();

/* ============================================================================
   screens/office.js — Посещаемость офисов. Пять под-вкладок:

   «Календарь»      — подневная сетка за последние два месяца периода плюс
                      разбивка по дням недели. Отвечает на вопрос «когда людей
                      в офисе больше», на который месячная линия ответить не может.
   «Кто и где ходит» (22.10: «Города», «Кто ходит» и «Динамика» — одна вкладка, без грейдов):
                      сверху динамика посещаемости, ниже сегмент (руководители /
                      сотрудники), ниже локация (города). Строки кликаются: выбор
                      сегмента и города складывается и пересчитывает динамику и
                      другую таблицу; выбор — на полке срезов, Escape снимает.
   «Бронирование»   — нарушения бронирования: бронь без прихода и приход
                      без брони, динамикой и разбором последнего месяца.

   Дни недели — таблицей, а не барами: день недели это атрибут, а для разбивок
   по атрибутам в проекте таблица с полосой в ячейке (то же правило, что у грейдов
   и причин увольнений). Доля отключена: доля одного процента в сумме процентов
   ничего не значит.

   Поставка 66 (посещения Адели): в пробнике всё это — на настоящих данных, если они есть в ответе
   (D.OFF_LIVE): календарь по дням двух месяцев, сегмент — руководители и сотрудники (клик — их
   динамика), города офиса — посещения последнего месяца (без выбора: город есть у посещения, а не у
   сотрудника), бронирования. Чего нет — генератор макета.
   ========================================================================== */
(function(){
'use strict';
const D=window.TPDATA, G=window.TPDRAW, U=window.TPUI, SC=window.TPSCREENS;
const esc=U.esc;

/* 15.10: сноска «в макете сгенерировано» снята — что цифры условные, говорит
   плашка «в разработке» над вкладкой; сноска объясняет только, как читать */
const CAL_NOTE='Посещаемость дня — доля сотрудников с рабочим днём, которые пришли в офис.';

/* выбор сегмента и города — подпись для графика и полки */
const offLabel=x=>[x.seg?x.seg.name:'',x.city?x.city.name:''].filter(Boolean).join(' · ');

/* Поставка 66: «Кто и где ходит» на настоящих — динамика (по сегменту, если выбран), сегмент со счётом людей,
   города офиса: посещения, люди и доля посещений. Город не выбирается: посещаемости города нет — есть посещения */
function attendReal(ctx,x,lbl,attTbl){
  const S=ctx.S;
  return SC.metricLine('office_att',ctx.lp,ctx.bl,S,{ann:lbl?null:ctx.ann.office_att,yser:x.yser,h:260,fill:false,
      title:'Посещаемость офиса'+(lbl?': '+lbl:'')+', %'})+
    (x.segs.length?attTbl('Сегмент',D.CMP.cur,x.segs.filter(s=>s.hc>0).map(s=>({name:s.name,note:D.fmtInt(s.hc)+' чел',
      value:s.att,color:G.C_OFFICE,on:S.offSeg===s.key,attr:'data-offseg="'+esc(s.key)+'"',
      attrTip:'Клик — динамика посещаемости только у «'+s.name+'».'})),'Сравнение сегментов'):'')+
    (x.cities.length?U.btGroup({cap:'Город офиса',capSub:D.CMP.cur+' · посещения',head:'',valueHead:'Посещений',
      barHead:'Распределение',metricKey:'hc_total',compact:true,total:false,items:x.cities.map(c=>({name:c.name,
        note:D.fmtInt(c.people)+' чел',value:c.visits,color:G.C_OFFICE}))}):'')+
    '<div class="tbl-note">Клик по сегменту — его динамика, Escape — снять. Город — где было посещение: человек бывает в нескольких.</div>';
}

SC.blocks.office={
  subTabs:[['calendar','Календарь'],['attend','Кто и где ходит'],['booking','Бронирование']],
  defaultSub:'calendar',
  title(sub){return sub==='attend'?'Кто и где ходит в офис: динамика, сегмент, локация'
    :sub==='booking'?'Качество бронирования рабочих мест'
    :'Когда люди приходят в офис'},
  /* полка выбора вкладки «Кто и где ходит» — та же, что у структуры: sticky, только когда что-то выбрано */
  shelf(S){
    if(S.subTab!=='attend')return '';
    const seg=S.offSeg?D.OFF_SEGS.find(x=>x.key===S.offSeg):null, chips=[];
    if(seg)chips.push({dim:'Сегмент',cat:seg.name,attr:'data-offseg="'+esc(seg.key)+'"'});
    if(S.offCity&&!D.OFF_LIVE.city)chips.push({dim:'Локация',cat:S.offCity,attr:'data-offcity="'+esc(S.offCity)+'"'});
    return U.shelf({chips:chips,extra:'динамика и таблицы — по выбору',clear:'data-offclear="1"',
      clearTip:'Снять выбор сегмента и локации. То же — клавиша Escape.'});
  },
  view(ctx){
    /* Таблицы посещаемости — проценты: доля процента в сумме процентов ничего
       не значит, поэтому ни колонки «Доля», ни строки ИТОГО у них нет. */
    const attTbl=(cap,capSub,items,barHead)=>U.btGroup({cap:cap,capSub:capSub,head:'',metricKey:'office_att',
      valueHead:'Посещаемость',barHead:barHead,share:false,total:false,compact:true,items:items});

    /* 22.10: динамика → сегмент → локация. Клик по строке сегмента или города — выбор; оба выбора
       складываются («руководители в Москве»): динамика и соседняя таблица считаются по нему */
    if(ctx.sub==='attend'){
      const S=ctx.S, x=D.officeCross(ctx.lp,S.offSeg,S.offCity), lbl=offLabel(x);
      if(!x.cities.length&&!x.segs.some(s=>s.hc))return U.empty('Нет данных о посещаемости','В отборе нет сотрудников.');
      if(x.real)return attendReal(ctx,x,lbl,attTbl);
      return SC.metricLine('office_att',ctx.lp,ctx.bl,S,{ann:lbl?null:ctx.ann.office_att,scale:x.factor,h:260,fill:false,
          title:'Посещаемость офиса'+(lbl?': '+lbl:'')+', %'})+
        attTbl('Сегмент',x.city?x.city.name+' · '+D.CMP.cur:D.CMP.cur,x.segs.filter(s=>s.hc>0).map(s=>({name:s.name,
          note:D.fmtInt(s.hc)+' чел',value:s.att,color:G.C_OFFICE,on:S.offSeg===s.key,attr:'data-offseg="'+esc(s.key)+'"',
          attrTip:'Клик — посещаемость только у «'+s.name+'»: пересчитаются динамика и города.'})),'Сравнение сегментов')+
        attTbl('Локация',x.seg?x.seg.name+' · '+D.CMP.cur:D.CMP.cur,x.cities.filter(c=>c.hc>0).map(c=>({name:c.name,
          note:D.fmtInt(c.hc)+' чел · '+c.offices+' '+U.plural(c.offices,['офис','офиса','офисов']),
          value:c.att,color:G.C_OFFICE,on:S.offCity===c.name,attr:'data-offcity="'+esc(c.name)+'"',
          attrTip:'Клик — посещаемость только в «'+c.name+'»: пересчитаются динамика и сегменты.'})),'Сравнение городов')+
        '<div class="tbl-note">Клик по строке — выбор: динамика и другая таблица пересчитаются. Сегмент и город складываются; '+
          'Escape или «Сбросить всё» — снять. В городе — среднее по его офисам с учётом числа людей.</div>';
    }

    if(ctx.sub==='booking'){
      const bk=D.bookingQuality(ctx.lp);
      /* Человеко-дни, а не люди: один сотрудник за месяц может и прийти без
         брони, и не прийти по брони. Нарушения — две нижние строки. */
      return SC.metricLine('booking_viol',ctx.lp,ctx.bl,ctx.S,
          {h:250,fill:false,title:'Нарушения бронирования, %',ann:ctx.ann.booking_viol})+
        U.btGroup({cap:'Бронирования и посещения',capSub:D.CMP.cur+', человеко-дни',head:'',
          valueHead:'Дней',metricKey:'hc_total',compact:true,keepZero:true,items:[
          {name:'Бронь и приход',value:bk.ok,color:G.C_OFFICE},
          {name:'Бронь без прихода',note:'нарушение: место простояло',value:bk.noshow,color:G.C_OFFICE},
          {name:'Приход без брони',note:'нарушение: место не учтено',value:bk.walkin,color:G.C_OFFICE}]})+
        '<div class="tbl-note">Две нижние строки — нарушения. Их доля и есть «Нарушения бронирования» за '+esc(D.CMP.cur)+'.</div>';
    }

    /* календарь + дни недели: сетка отвечает «в какие дни», таблица — «в какие
       дни недели», и вместе они читаются как один ответ */
    const blocks=D.attLast(ctx.lp), dow=D.attByDow(ctx.lp);
    /* конец периода называем явно: иначе непонятно, почему текущий месяц
       оборван и на каком именно дне */
    const end=blocks[blocks.length-1];
    /* Календарь БЕЗ fill и без своей высоты — единственный такой график в правых
       панелях, и намеренно. fill отдал бы ему всю высоту панели, а клетка всё
       равно упирается в потолок: излишек оставался пустотой между календарём и
       таблицей дней недели и рос вместе с экраном (26px на ноутбуке, 500px на
       большом мониторе). Теперь календарь стоит своей высотой, до таблицы
       ровно --chart-gap, как между любыми двумя графиками, а запас высоты
       копится внизу панели. */
    return G.chart('calendar',{blocks:blocks},
      {title:'Посещаемость по дням — по '+end.to+' '+
        D.MONTH_GEN[end.m]+' '+end.y+', %'})+
      '<div class="bt-group"><div class="bt-cap">По дням недели, среднее за '+
      D.DOW_MONTHS+' месяца</div>'+
      U.barTable({head:'День недели',metricKey:'office_att',valueHead:'Посещаемость',
        barHead:'Сравнение дней',share:false,total:false,compact:true,
        items:dow.map(d=>({name:d.name,value:d.value,
          color:d.weekend?G.C_FLAT:G.C_OFFICE,note:d.weekend?'выходной':''}))})+
      '<div class="tbl-note">'+esc(CAL_NOTE)+'</div></div>';
  }
};
})();

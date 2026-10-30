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
  const S=ctx.S, cc=x.city&&x.city.people;
  /* 31.10-б, п. 9: выбран город — в сегментах люди этого города и их доля (из людей, бывших в офисе города); иначе —
     посещаемость сегментов. Выбор сегмента режет таблицу городов */
  const segTbl=cc?U.btGroup({cap:'Сегмент',capSub:x.city.name+' · '+D.PER_MON+' · были в офисе',head:'',valueHead:'Человек',
      metricKey:'hc_total',compact:true,total:false,items:x.segs.map(s=>({name:s.name,value:cc[s.key],color:G.C_OFFICE,
        on:S.offSeg===s.key,attr:'data-offseg="'+esc(s.key)+'"',attrTip:'Клик — города только у «'+s.name+'».'}))})
    :attTbl('Сегмент',D.PER_MON,x.segs.filter(s=>s.hc>0).map(s=>({name:s.name,note:D.fmtInt(s.hc)+' чел',
      value:s.att,color:G.C_OFFICE,on:S.offSeg===s.key,attr:'data-offseg="'+esc(s.key)+'"',
      attrTip:'Клик — динамика посещаемости и города только у «'+s.name+'».'})),'Сравнение сегментов');
  return SC.metricLine('office_att',ctx.lp,ctx.bl,S,{ann:lbl?null:ctx.ann.office_att,yser:x.yser,h:260,fill:false,
      title:'Посещаемость офиса'+(x.seg?': '+x.seg.name:'')+', %'})+
    (x.segs.length?segTbl:'')+
    /* 27.10-в, п. 15: по убыванию посещений, первые 10 и раскрываемые «Остальные»; 31.10-б, п. 9: колонка «Посещаемость»,
       строка города выбирается (кросс-фильтр с сегментом) */
    (x.cities.length?U.btGroup(Object.assign({cap:'Город офиса',capSub:(x.seg?x.seg.name+' · ':'')+D.PER_MON+' · посещения',head:'',
      valueHead:'Посещаемость',barHead:'Распределение',metricKey:'hc_total',compact:true,total:false,sort:true,items:x.cities.map(c=>Object.assign({name:c.name,
        note:D.fmtInt(c.people)+' чел',value:c.visits,color:G.C_OFFICE},x.cross?{on:S.offCity===c.name,
        attr:'data-offcity="'+esc(c.name)+'"',attrTip:'Клик — сколько руководителей и сотрудников в «'+c.name+'».'}:{}))},
      SC.rest(ctx,'ocity',10,['город','города','городов']))):'')+
    '<div class="tbl-note">Город — где было посещение: человек бывает в нескольких. Посещаемость города — число посещений'+
      (x.cross?'; выбор сегмента и города складывается':'')+'.</div>';
}

SC.blocks.office={
  subTabs:[['calendar','Календарь'],['attend','Кто и где ходит'],['booking','Бронирование']],
  defaultSub:'calendar',
  title(sub){return sub==='attend'?'Кто и где ходит в офис: динамика, сегмент, локация'
    :sub==='booking'?'Качество бронирования рабочих мест'
    :'Когда люди приходят в офис'},
  /* выбор вкладки «Кто и где ходит» — пилюлями в шапке карточки графиков (поставка 82) */
  shelfChips(S){
    if(S.subTab!=='attend')return [];
    const seg=S.offSeg?D.OFF_SEGS.find(x=>x.key===S.offSeg):null, chips=[], tip='Динамика и таблицы — по выбору.';
    if(seg)chips.push({dim:'Сегмент',cat:seg.name,attr:'data-offseg="'+esc(seg.key)+'"',tip:tip});
    if(S.offCity)chips.push({dim:'Локация',cat:S.offCity,attr:'data-offcity="'+esc(S.offCity)+'"',tip:tip});
    return chips;
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
        attTbl('Сегмент',x.city?x.city.name+' · '+D.PER_MON:D.PER_MON,x.segs.filter(s=>s.hc>0).map(s=>({name:s.name,
          note:D.fmtInt(s.hc)+' чел',value:s.att,color:G.C_OFFICE,on:S.offSeg===s.key,attr:'data-offseg="'+esc(s.key)+'"',
          attrTip:'Клик — посещаемость только у «'+s.name+'»: пересчитаются динамика и города.'})),'Сравнение сегментов')+
        attTbl('Локация',x.seg?x.seg.name+' · '+D.PER_MON:D.PER_MON,x.cities.filter(c=>c.hc>0).map(c=>({name:c.name,
          note:D.fmtInt(c.hc)+' чел · '+c.offices+' '+U.plural(c.offices,['офис','офиса','офисов']),
          value:c.att,color:G.C_OFFICE,on:S.offCity===c.name,attr:'data-offcity="'+esc(c.name)+'"',
          attrTip:'Клик — посещаемость только в «'+c.name+'»: пересчитаются динамика и сегменты.'})),'Сравнение городов')+
        '<div class="tbl-note">В городе — среднее по его офисам с учётом числа людей.</div>';
    }

    if(ctx.sub==='booking'){
      const bk=D.bookingQuality(ctx.lp), vc=D.violByCity(ctx.lp);
      /* Человеко-дни, а не люди: один сотрудник за месяц может и прийти без
         брони, и не прийти по брони. Нарушения — две нижние строки. */
      return SC.metricLine('booking_viol',ctx.lp,ctx.bl,ctx.S,
          {h:250,fill:false,title:'Нарушения бронирования, %',ann:ctx.ann.booking_viol})+
        U.btGroup({cap:'Бронирования и посещения',capSub:D.PER_MON+', человеко-дни',head:'',
          valueHead:'Дней',metricKey:'hc_total',compact:true,keepZero:true,items:[
          {name:'Бронь и приход',value:bk.ok,color:G.C_OFFICE},
          {name:'Бронь без прихода',note:'нарушение: место простояло',value:bk.noshow,color:G.C_OFFICE},
          {name:'Приход без брони',note:'нарушение: место не учтено',value:bk.walkin,color:G.C_OFFICE}]})+
        '<div class="tbl-note">Две нижние строки — нарушения. Их доля и есть «Нарушения бронирования» за '+esc(D.PER_MON)+'.</div>'+
        /* 27.10-в, п. 14–15: после «Бронирований и посещений» — нарушения по городам: по убыванию, первые 10 и
           раскрываемые «Остальные» */
        (!vc?'<div class="tbl-note">Нарушения бронирования по городам появятся, когда ноутбук отчёта обновят до поставки 70.</div>'
        :vc.length?U.btGroup(Object.assign({cap:'Нарушения бронирования по городам',capSub:D.PER_MON+', человеко-дни',head:'',
          valueHead:'Нарушений',metricKey:'hc_total',compact:true,total:false,sort:true,items:vc.map(c=>({name:c.name,
            note:c.pct!=null?U.pct(c.pct)+' от дней с бронью':'',value:c.viol,color:G.C_OFFICE}))},
          SC.rest(ctx,'vcity',10,['город','города','городов']))):'');
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
    /* ревью 100: посещения по дням датасет отдаёт только у юнита из фильтра — при выбранной строке говорим это прямо */
    const own=D.REAL&&ctx.sel!==ctx.root?'<div class="tbl-note">Календарь и дни недели — по всему «'+esc((D.NODE_BY_PATH[ctx.root]||{}).name||'')+
      '»: по дням данные есть только у подразделения из фильтра. Чтобы увидеть «'+esc((D.NODE_BY_PATH[ctx.sel]||{}).name||'')+
      '», выберите его в «Настрой свой дашборд».</div>':'';
    return own+G.chart('calendar',{blocks:blocks},
      {title:'Посещаемость по дням — по '+end.to+' '+
        D.MONTH_GEN[end.m]+' '+end.y+', %'})+
      '<div class="bt-group"><div class="bt-cap">По дням недели, среднее за '+
      (D.DOW_MONTHS===2?D.MONTH_NOM[(D.PER_C+11)%12]+' и '+D.MONTH_NOM[D.PER_C]:D.DOW_MONTHS+' месяца')+'</div>'+
      U.barTable({head:'День недели',metricKey:'office_att',valueHead:'Посещаемость',
        barHead:'Сравнение дней',share:false,total:false,compact:true,
        items:dow.map(d=>({name:d.name,value:d.value,
          color:d.weekend?G.C_FLAT:G.C_OFFICE,note:d.weekend?'выходной':''}))})+
      '<div class="tbl-note">'+esc(CAL_NOTE)+'</div></div>';
  }
};
})();

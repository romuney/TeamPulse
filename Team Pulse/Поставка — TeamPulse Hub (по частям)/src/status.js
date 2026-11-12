function partWaitView(tab){
  const b=D.BLOCK_BY_KEY[tab]||{}, w=D.partsWait(tab), late=D.partsLate(tab);
  const ready=SC.coreKeys(S).length>0;
  const title=!w.length?'Подробности готовы':late.length?
    (ready?'Не удалось загрузить подробности':'Не удалось загрузить данные вкладки'):
    (ready?'Основные показатели готовы · подробности загружаются':'Загружаю данные «'+(b.name||'')+'»');
  const text=!w.length?'Основные графики остаются на месте. Можно перейти к полному виду.':late.length?
    (ready?'Готовыми показателями можно пользоваться. ':'')+'Обновите дашборд. Если ошибка повторится, сообщите владельцу отчёта.':
    (ready?'Графики ниже уже доступны. Подробности появятся, когда загрузятся.':'Другими разделами уже можно пользоваться. Эта вкладка откроется после загрузки своих данных.');
  return '<div class="part-wait tp-part-status'+(late.length?' late':'')+'" role="status" aria-live="polite">'+
    '<b>'+esc(title)+'</b><span>'+esc(text)+'</span>'+
    (!w.length?'<button class="btn primary tp-details-ready" data-tp-details="1">Подробности готовы · открыть</button>':'')+'</div>';
}

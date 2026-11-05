// TeamPulse Hub · файл 7а — замер внутри отчёта (консоль iframe чарта): после файла 7 в списке «top»
// слева вверху консоли выбрать iframe отчёта → вставить целиком → Enter. Результат — в буфере обмена.
// Только читает размеры, ничего не меняет.

(function () {
  var L = ['iframe ' + innerWidth + 'x' + innerHeight + ' html ' + document.documentElement.scrollHeight + ' body ' + document.body.scrollHeight];
  var sel = ['.tp-overlay', '.apphead', '.layout', '.nav', '.nav-foot', '.main-col', '.reporthead', '#view', '.split', '.split-r .panel-b'];
  for (var i = 0; i < sel.length; i++) {
    var e = document.querySelector(sel[i]);
    if (!e) continue;
    var b = e.getBoundingClientRect(), s = getComputedStyle(e);
    L.push(sel[i] + ' top ' + Math.round(b.top) + ' bottom ' + Math.round(b.bottom) + ' h ' + Math.round(b.height) +
      ' scroll ' + Math.round(e.scrollTop) + '/' + (e.scrollHeight - e.clientHeight) + ' ov ' + s.overflowY + ' ' + s.display);
  }
  var txt = L.join('\n');
  console.log(txt);
  if (typeof copy === 'function') { copy(txt); console.log('>>> скопировано в буфер обмена'); }
})();

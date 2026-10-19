// TeamPulse Hub · файл 7 — замер высоты отчёта на борде (консоль страницы борда, контекст «top»).
// Борд — не в режиме правки, отчёт прокручен до низа. F12 → Console → вставить целиком → Enter
// (Chrome при первой вставке просит набрать allow pasting). Результат сам копируется в буфер обмена —
// вставьте его в чат. Только читает размеры, ничего не меняет и никуда не отправляет. id чарта вписывать не нужно.

(function () {
  var L = [];
  function R(e) {
    if (!e) return '-';
    var b = e.getBoundingClientRect();
    return 'top ' + Math.round(b.top) + ' bottom ' + Math.round(b.bottom) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height);
  }
  function S(e) {
    var s = getComputedStyle(e);
    return 'h ' + s.height + ' min ' + s.minHeight + ' pad ' + s.padding + ' mar ' + s.margin + ' ov ' + s.overflow + ' ' + s.display;
  }
  var css = '', st = document.querySelectorAll('style');
  for (var i = 0; i < st.length; i++) css += st[i].textContent + '\n';
  var ids = css.match(/chart-id-\d+/g) || [];
  var vh = css.match(/100vh\s*-\s*(\d+)px|-(\d+)px\s*\+\s*100vh/) || [];
  L.push('window ' + innerWidth + 'x' + innerHeight + ' scrollY ' + scrollY + ' page ' + document.documentElement.scrollHeight);
  L.push('ids ' + ids.filter(function (x, n) { return ids.indexOf(x) === n; }).join(',') + ' | vh ' + (vh[1] || vh[2] || '-'));
  L.push('menu ' + R(document.querySelector('#main-menu, header.top')));
  L.push('header ' + R(document.querySelector('.dashboard-header-container, .header-with-actions')));
  L.push('grid ' + R(document.querySelector('.grid-container')));
  var hs = document.querySelectorAll('.dashboard-component-chart-holder');
  for (var j = 0; j < hs.length; j++) {
    var h = hs[j], f = h.querySelector('iframe');
    L.push('', 'CELL ' + h.className, '  ' + R(h) + ' | ' + S(h));
    if (f) L.push('  iframe ' + R(f) + ' attr ' + f.getAttribute('width') + 'x' + f.getAttribute('height') + ' | ' + S(f));
    var e = (f || h).parentElement;
    for (var k = 0; e && e !== document.body && k < 14; k++, e = e.parentElement) {
      var c = String(e.className || '').split(' ').slice(0, 3).join('.');
      L.push('  ^ ' + e.tagName.toLowerCase() + '.' + c + ' ' + R(e) + ' | ' + S(e));
    }
  }
  var txt = L.join('\n');
  console.log(txt);
  if (typeof copy === 'function') { copy(txt); console.log('>>> скопировано в буфер обмена'); }
})();

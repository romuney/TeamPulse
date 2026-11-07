// TeamPulse Hub · файл 8г — из чего состоит ответ датасета (консоль страницы борда, контекст «top»).
// Поставка 109: на бою ответ компании — 23,6 МБ JSON (на стенде 0,5 МБ). Скрипт считает только размеры: сколько КБ
// занимает каждая роль строк (meta, dict, scope, base, c, g, hq) и каждая колонка, и сколько КБ — каждый ключ разреза
// в колонке mx. Содержимое (имена, логины, числа) не печатает, никуда не отправляет, ничего не меняет.
//  1) Открыть борд, F12 → Console, контекст top → вставить файл целиком → Enter.
//  2) Меню борда «⋯» → «Обновить дашборд» (ответ компании), дождаться отчёта.
//  3) Выбрать одну команду → «Применить», дождаться отчёта.
//  4) Набрать  tpSize()  — итог по самому большому и самому маленькому ответу скопируется в буфер, вставьте в чат.

(function () {
  if (window.__tpSize) { console.log('TeamPulse · 8г уже запущен — наберите tpSize()'); return; }
  var S = window.__tpSize = { got: [] };
  var RX = /\/api\/v1\/chart\/data/i;
  function kb(n) { return Math.round(n / 1024); }
  function len(v) { return v == null ? 0 : (typeof v === 'string' ? v.length : JSON.stringify(v).length); }
  // строки ответа Proteus: {result: [{data: [...]}]}; берём массивы, где есть колонка role
  function rowsOf(j) {
    var out = [];
    (j && j.result || []).forEach(function (r) { if (Array.isArray(r.data) && r.data.length && 'role' in r.data[0]) out = out.concat(r.data); });
    return out;
  }
  function analyse(rows, bytes, label) {
    var byRole = {}, byCol = {}, byKey = {}, keyN = {};
    rows.forEach(function (r) {
      var role = String(r.role), z = byRole[role] || (byRole[role] = { n: 0, b: 0 });
      z.n++;
      Object.keys(r).forEach(function (c) { var l = len(r[c]); z.b += l; byCol[c] = (byCol[c] || 0) + l; });
      String(r.mx || '').split('\n').forEach(function (line) {
        if (!line) return;
        var k = line.slice(0, line.indexOf('\t'));
        byKey[k] = (byKey[k] || 0) + line.length + 1; keyN[k] = (keyN[k] || 0) + 1;
      });
    });
    var L = [label + ': ' + rows.length + ' строк, JSON ' + kb(bytes) + ' КБ'];
    L.push('  роли (строк · КБ): ' + Object.keys(byRole).sort(function (a, b) { return byRole[b].b - byRole[a].b; })
      .map(function (k) { return k + ' ' + byRole[k].n + ' · ' + kb(byRole[k].b); }).join(' | '));
    L.push('  колонки (КБ): ' + Object.keys(byCol).sort(function (a, b) { return byCol[b] - byCol[a]; })
      .map(function (k) { return k + ' ' + kb(byCol[k]); }).join(' | '));
    var keys = Object.keys(byKey).sort(function (a, b) { return byKey[b] - byKey[a]; });
    L.push('  mx — 25 самых крупных ключей (КБ · строк): ' + keys.slice(0, 25).map(function (k) { return k + ' ' + kb(byKey[k]) + ' · ' + keyN[k]; }).join(' | '));
    L.push('  mx — остальные ' + Math.max(0, keys.length - 25) + ' ключей вместе: ' + kb(keys.slice(25).reduce(function (a, k) { return a + byKey[k]; }, 0)) + ' КБ');
    // строки meta и dict: длина колонки j отдельно (справочник узлов, значения фильтров)
    rows.filter(function (r) { return r.role === 'meta' || r.role === 'dict'; }).forEach(function (r) {
      L.push('  ' + r.role + '.j: ' + kb(len(r.j)) + ' КБ' + (r.role === 'dict' ? ', узлов в справочнике ' + String(r.j || '').split('\n').length : ''));
    });
    return L.join('\n');
  }
  function take(text, url) {
    try {
      var j = JSON.parse(text), rows = rowsOf(j);
      if (rows.length) S.got.push({ bytes: text.length, rows: rows, url: String(url).replace(/\?.*$/, '') });
    } catch (e) { /* не JSON — пропускаем */ }
  }
  var f0 = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var p = f0.apply(this, arguments);
    if (RX.test(url)) p.then(function (res) { res.clone().text().then(function (t) { take(t, url); }); }).catch(function () {});
    return p;
  };
  var o0 = XMLHttpRequest.prototype.open, s0 = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__tpu = url; return o0.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    var x = this;
    if (RX.test(x.__tpu || '')) x.addEventListener('load', function () { if (typeof x.responseText === 'string') take(x.responseText, x.__tpu); });
    return s0.apply(this, arguments);
  };
  window.tpSizeOf = analyse;
  window.tpSize = function () {
    if (!S.got.length) { console.log('Ответов с данными чарта ещё не было — обновите дашборд или примените фильтр.'); return; }
    var g = S.got.slice().sort(function (a, b) { return b.bytes - a.bytes; });
    var parts = ['TeamPulse Hub · 8г · из чего ответ · ' + new Date().toLocaleString() + ' · ответов поймано: ' + g.length,
      analyse(g[0].rows, g[0].bytes, 'самый большой')];
    if (g.length > 1) parts.push(analyse(g[g.length - 1].rows, g[g.length - 1].bytes, 'самый маленький'));
    var text = parts.join('\n');
    console.log(text);
    try { copy(text); console.log('Скопировано в буфер обмена — вставьте в чат.'); } catch (e) { console.log('Скопируйте текст выше.'); }
  };
  console.log('TeamPulse · 8г: слушаю ответы чарта. Обновите дашборд, примените фильтр, затем наберите tpSize()');
})();

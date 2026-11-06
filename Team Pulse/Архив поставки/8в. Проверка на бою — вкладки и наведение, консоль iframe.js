// TeamPulse Hub · файл 8в — сколько стоят переключение вкладок и наведение мыши (консоль iframe отчёта).
// Поставка 109: «на фронте бывает ощущение лагов» — замер того, что видит человек после загрузки отчёта.
//  1) Открыть борд, дождаться отчёта. F12 → Console → слева вверху в списке контекстов («top ▾») выбрать iframe
//     отчёта (тот же, что для файла 8а) → вставить файл целиком → Enter.
//  2) Скрипт сам пройдёт все вкладки и подвкладки отчёта (около минуты, на экране всё будет переключаться),
//     затем поводит «мышью» по правой панели последней вкладки и вернёт отчёт на первую вкладку.
//  3) Итог скопируется в буфер обмена — вставьте его в чат.
// Колонки: мс — от клика до следующего кадра (сборка и отрисовка вкладки); DOM — элементов на странице;
// длинные задачи — сколько раз главный поток был занят дольше 50 мс и самая длинная из них.
// Только читает и щёлкает по вкладкам отчёта, ничего не меняет в данных и никуда не отправляет.

(async function () {
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var frame = function () { return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); }); };
  var lt = [];
  try {
    new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { lt.push(e.duration); }); })
      .observe({ type: 'longtask' });
  } catch (e) { console.log('Браузер не отдаёт длинные задачи — будут только миллисекунды.'); }
  var nav = document.querySelectorAll('.nav-i[data-tab]');
  if (!nav.length) { console.log('Не вижу вкладок отчёта: в списке контекстов выбран не iframe отчёта.'); return; }
  var dom = function () { return document.querySelectorAll('*').length; };
  var lts = function () { return lt.length ? lt.length + ' (макс ' + Math.round(Math.max.apply(null, lt)) + ' мс)' : '0'; };
  var out = ['TeamPulse Hub · 8в · вкладки и наведение · ' + new Date().toLocaleString() + ' · iframe ' + innerWidth + 'x' +
    innerHeight + ' · ' + (navigator.hardwareConcurrency || '?') + ' ядер · DOM при старте ' + dom()];
  var tabs = Array.prototype.map.call(nav, function (e) { return e.getAttribute('data-tab'); });
  var first = tabs[0];
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    lt.length = 0;
    var a = performance.now();
    document.querySelector('.nav-i[data-tab="' + t + '"]').click();
    await frame();
    var ms = Math.round(performance.now() - a);
    await sleep(400);
    var subs = Array.prototype.map.call(document.querySelectorAll('.st-step[data-subtab]'), function (e) { return e.getAttribute('data-subtab'); });
    var sm = [];
    for (var j = 0; j < subs.length; j++) {
      var el = document.querySelector('.st-step[data-subtab="' + subs[j] + '"]');
      if (!el) continue;
      var b = performance.now();
      el.click();
      await frame();
      sm.push(subs[j] + ' ' + Math.round(performance.now() - b));
      await sleep(250);
    }
    out.push(t + ': ' + ms + ' мс · DOM ' + dom() + ' · подвкладки, мс: ' + (sm.join(', ') || '—') + ' · длинные задачи: ' + lts());
  }
  // наведение: сетка точек по правой панели, на каждой — события, на которые отвечает отчёт
  var pane = document.querySelector('.split-r') || document.body, r = pane.getBoundingClientRect();
  lt.length = 0;
  var n = 0, sync = 0, worst = 0, t0 = performance.now();
  for (var y = r.top + 10; y < Math.min(r.bottom, innerHeight) - 10; y += 24) {
    for (var x = r.left + 10; x < r.right - 10; x += 48) {
      var target = document.elementFromPoint(x, y);
      if (!target) continue;
      var c = performance.now();
      ['pointermove', 'mousemove', 'mouseover'].forEach(function (k) {
        target.dispatchEvent(new MouseEvent(k, { bubbles: true, clientX: x, clientY: y }));
      });
      var d = performance.now() - c;
      sync += d; worst = Math.max(worst, d); n++;
      if (n % 20 === 0) await frame();
    }
  }
  await frame();
  out.push('наведение (' + tabs[tabs.length - 1] + '): ' + n + ' точек за ' + Math.round(performance.now() - t0) + ' мс · обработчики в среднем ' +
    (n ? (sync / n).toFixed(1) : 0) + ' мс, худшая точка ' + Math.round(worst) + ' мс · длинные задачи: ' + lts());
  document.querySelector('.nav-i[data-tab="' + first + '"]').click();
  var text = out.join('\n');
  console.log(text);
  try { copy(text); console.log('Скопировано в буфер обмена — вставьте в чат.'); } catch (e) { console.log('Скопируйте текст выше.'); }
})();

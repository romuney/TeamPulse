// TeamPulse Hub · файл 8а — сколько браузер занят разбором ответа и отрисовкой отчёта (консоль iframe чарта).
// Вместе с файлом 8: сразу после него в списке контекстов консоли слева вверху («top ▾») выбрать iframe
// отчёта → вставить файл целиком → Enter. Дальше шаги файла 8; в конце, не меняя контекст, набрать
// tpRender()  — итог скопируется в буфер обмена, вставьте его в чат вместе с итогом файла 8.
// Proteus на каждый ответ датасета запускает код чарта заново — каждый такой прогон виден здесь пачкой
// «длинных задач» (главный поток занят дольше 50 мс): занят — сумма задач, до тишины — от первой до
// последней. Время — часы компьютера, как в файле 8: строки сводятся по времени.
// Только читает, ничего не меняет и никуда не отправляет.

(function () {
  if (window.__tpRender) { console.log('TeamPulse · уже запущен — наберите tpRender()'); return; }
  var R = window.__tpRender = { lt: [], runs: [] };
  var T0 = performance.timeOrigin || (Date.now() - performance.now());
  function hms(t) { return new Date(T0 + t).toTimeString().slice(0, 8); }
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) { R.lt.push({ t: e.startTime, d: e.duration }); });
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) { console.log('Браузер не отдаёт длинные задачи — будет только число прогонов.'); }
  // новый прогон чарта: прелюдия кладёт свежий корень .tp-overlay
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      for (var i = 0; i < m.addedNodes.length; i++) {
        var n = m.addedNodes[i];
        if (n.classList && n.classList.contains('tp-overlay')) R.runs.push(performance.now());
      }
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.tpRender = function () {
    var L = ['TeamPulse Hub · отрисовка в iframe · ' + new Date().toLocaleString() + ' · iframe ' + innerWidth + 'x' + innerHeight +
      ' · узлов DOM ' + document.getElementsByTagName('*').length +
      (performance.memory ? ' · память JS ' + Math.round(performance.memory.usedJSHeapSize / 1048576) + ' МБ' : ''),
      'пачка | начало | занят мс | до тишины мс | задач | самая длинная мс | прогонов чарта'];
    var lt = R.lt.slice().sort(function (a, b) { return a.t - b.t; }), g = [];
    lt.forEach(function (e) {
      var c = g[g.length - 1];
      if (c && e.t - c.end < 1000) { c.busy += e.d; c.end = Math.max(c.end, e.t + e.d); c.n++; c.max = Math.max(c.max, e.d); }
      else g.push({ t: e.t, end: e.t + e.d, busy: e.d, n: 1, max: e.d });
    });
    g.forEach(function (c, i) {
      var runs = R.runs.filter(function (t) { return t >= c.t - 50 && t <= c.end + 1000; }).length;
      L.push([i + 1, hms(c.t), Math.round(c.busy), Math.round(c.end - c.t), c.n, Math.round(c.max), runs].join(' | '));
    });
    if (!g.length) L.push('длинных задач нет' + (R.runs.length ? ' · прогонов чарта ' + R.runs.length : ''));
    var t = L.join('\n');
    try { copy(t); console.log('Скопировано в буфер обмена — вставьте в чат.'); } catch (e) { console.log('Скопируйте текст ниже.'); }
    console.log(t);
    return g.length + ' пачек';
  };
  console.log('TeamPulse · отрисовка: замер запущен. Дальше — шаги файла 8, в конце здесь же tpRender().');
})();

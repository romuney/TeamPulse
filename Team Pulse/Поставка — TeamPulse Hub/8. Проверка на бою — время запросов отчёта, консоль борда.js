// TeamPulse Hub · файл 8 — сколько времени уходит на запросы отчёта (консоль страницы борда, контекст «top»).
// Только читает время и размеры запросов, ничего не меняет и никуда не отправляет.
//  1) Открыть борд в новой вкладке (не в режиме правки), дождаться отчёта. F12 → Console → вставить файл
//     целиком → Enter (Chrome при первой вставке просит набрать allow pasting). Первая загрузка берётся
//     из истории браузера.
//  2) По желанию — файл 8а в консоли iframe отчёта (время отрисовки).
//  3) Меню борда «⋯» → «Обновить дашборд», дождаться отчёта — запрос мимо кеша.
//  4) «Настрой свой дашборд» → выбрать одну команду → применить, дождаться.
//  5) Там же добавить покраску HQ → применить, дождаться.
//  6) Выбрать другую команду (как руководитель, у которого их несколько) → применить, дождаться.
//  7) Сбросить фильтры (вернуться к компании), дождаться.
//  8) Набрать в консоли  tpPerf()  — итог скопируется в буфер обмена, вставьте его в чат.
// Колонки итога: всего — от отправки до последнего байта; сервер — ожидание первого байта (разбор текста
// в Proteus + ClickHouse + сборка JSON); приём — скачивание; провод / JSON — КБ сжатыми и после распаковки;
// отправлено — тело запроса (в нём код чарта). Холодный запрос Proteus идёт в три шага: POST → 202,
// опросы async_event, GET chart/data/qc-… с данными; строка «итог» — от POST до данных.

(function () {
  if (window.__tpPerf) { console.log('TeamPulse · замер уже запущен — наберите tpPerf()'); return; }
  var RX = /\/api\/v1\/chart\/data|\/superset\/explore_json|\/api\/v1\/async_event/i;
  var P = window.__tpPerf = { res: [], req: [] };
  var T0 = performance.timeOrigin || (Date.now() - performance.now());
  function ms(x) { return x == null || !isFinite(x) ? '' : Math.round(x); }
  function kb(x) { return x ? Math.round(x / 1024) : (x === 0 ? 0 : ''); }
  function hms(t) { return new Date(T0 + t).toTimeString().slice(0, 8); }
  function kind(u) { return /async_event/i.test(u) ? 'опрос' : /\/chart\/data\/qc-/i.test(u) ? 'GET qc' : 'POST'; }
  // фильтры запроса — из тела POST (кросс-фильтры чарта: unit_f, paint_f, it_f, staff_f, act_f)
  function body(b) {
    var o = { size: b && b.length };
    try {
      var j = typeof b === 'string' ? JSON.parse(b) : null, q = j && j.queries && j.queries[0];
      if (!j) return o;
      o.force = j.force === true;
      o.slice = (j.form_data && j.form_data.slice_id) || '';
      if (q) {
        o.flt = (q.filters || []).concat((q.extras && q.extras.adhoc_filters) || []).map(function (x) {
          var c = x.col || x.subject, v = x.val != null ? x.val : x.comparator;
          return c + '=' + (Array.isArray(v) ? v.slice(0, 3).join('|') + (v.length > 3 ? '…' : '') : v);
        }).join(' ') || 'без фильтров';
      }
    } catch (e) { /* не JSON */ }
    return o;
  }
  // 1. время и размеры — Resource Timing: и то, что уже было (первая загрузка), и всё следующее
  function onEntry(e) {
    if (!RX.test(e.name)) return;
    P.res.push({ url: e.name, k: kind(e.name), t: e.startTime, end: e.responseEnd, total: e.duration,
      server: e.responseStart > 0 ? e.responseStart - (e.requestStart || e.startTime) : null,
      dl: e.responseStart > 0 ? e.responseEnd - e.responseStart : null,
      wire: e.encodedBodySize, json: e.decodedBodySize, status: e.responseStatus });
  }
  try {
    new PerformanceObserver(function (l) { l.getEntries().forEach(onEntry); }).observe({ type: 'resource', buffered: true });
  } catch (e) {
    performance.getEntriesByType('resource').forEach(onEntry);
  }
  // 2. содержимое запросов — перехват fetch: метод, тело (фильтры, код чарта), статус, строки, кеш
  if (window.fetch) {
    var f0 = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!RX.test(url) || /async_event/i.test(url)) return f0.apply(this, arguments);
      var r = body(init && init.body);
      r.t = performance.now(); r.url = url; r.method = (init && init.method) || 'GET';
      P.req.push(r);
      return f0.apply(this, arguments).then(function (resp) {
        r.status = resp.status;
        resp.clone().text().then(function (txt) {
          try {
            var j = JSON.parse(txt), q = (j.result || [])[0] || j;
            if (q.rowcount != null || q.data) r.rows = q.rowcount != null ? q.rowcount : q.data.length;
            if (q.is_cached != null) r.cached = !!q.is_cached;
            if (j.job_id || j.channel_id) r.async = true;
          } catch (e) { /* не JSON */ }
        });
        return resp;
      });
    };
  }
  // запись fetch к записи Resource Timing — по адресу и времени старта
  function match(e) {
    var best = null;
    P.req.forEach(function (r) {
      if (r.url && e.url.indexOf(r.url.split('?')[0]) >= 0 && Math.abs(r.t - e.t) < 300 && (!best || Math.abs(r.t - e.t) < Math.abs(best.t - e.t))) best = r;
    });
    return best || {};
  }
  window.tpPerf = function () {
    var nav = performance.getEntriesByType('navigation')[0];
    var L = ['TeamPulse Hub · время запросов отчёта · ' + new Date().toLocaleString() + ' · окно ' + innerWidth + 'x' + innerHeight +
      ' · ' + (navigator.connection ? navigator.connection.effectiveType + ' ' + navigator.connection.downlink + ' Мбит/с' : 'сеть ?')];
    if (nav) L.push('страница: DOM ' + ms(nav.domContentLoadedEventEnd) + ' мс, load ' + ms(nav.loadEventEnd) + ' мс');
    L.push('№ | время | что | статус | всего мс | сервер мс | приём мс | провод КБ | JSON КБ | отправлено КБ | строк | кеш | чарт | фильтры');
    var rs = P.res.slice().sort(function (a, b) { return a.t - b.t; }), n = 0, polls = 0, post = null;
    function flush() {
      if (post && post.last) {
        L.push('   итог от POST до данных: ' + ms(post.last.end - post.t) + ' мс' + (polls ? ', опросов ' + polls : ''));
      }
    }
    rs.forEach(function (e) {
      if (e.k === 'опрос') { polls++; return; }
      var r = match(e);
      if (e.k === 'POST') { flush(); post = e; polls = 0; e.last = e; }
      else if (post) post.last = e;
      n++;
      L.push([n, hms(e.t), e.k, e.status || r.status || '', ms(e.total), ms(e.server), ms(e.dl), kb(e.wire), kb(e.json), kb(r.size),
        r.rows == null ? '' : r.rows, r.cached == null ? '' : (r.cached ? 'да' : 'нет'), r.slice || '',
        (r.force ? 'force ' : '') + (r.flt || (r.t ? '' : 'до вставки скрипта'))].join(' | '));
    });
    flush();
    var t = L.join('\n');
    try { copy(t); console.log('Скопировано в буфер обмена — вставьте в чат.'); } catch (e) { console.log('Скопируйте текст ниже.'); }
    console.log(t);
    return n + ' запросов';
  };
  console.log('TeamPulse · замер запущен (запросов отчёта в истории: ' +
    performance.getEntriesByType('resource').filter(function (e) { return RX.test(e.name); }).length +
    '). Дальше — шаги из шапки файла, в конце tpPerf().');
})();

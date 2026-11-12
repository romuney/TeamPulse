// ============================================================================
// TeamPulse Hub — чарт-загрузчик (поставка «по частям»). Один и тот же код для всех загрузчиков:
// какую часть он везёт (core, people, flow, aux), говорит первая строка ответа — role = 'part'.
// Ничего не рисует: получил ответ датасета — сообщил главному чарту (TP_HELLO, без данных) и по его
// просьбе (TP_ASK) отдал строки адресно (TP_PART). Протокол — proteus/parts.js, версия v = 1.
// Код маленький: он уходит на сервер в каждом запросе чарта (гайд F11).
// «Измерения» чарта — все колонки датасета: role, id, pid, lvl, nm, kids, j, ms, mx. Метрик и сортировки нет.
// ============================================================================
(function () {
  var V = 1;
  var ST = window.__pvtState || (window.__pvtState = {});
  var st = ST.tpl || (ST.tpl = { id: String(Math.random()).slice(2, 10), n: 0, t: [] });
  var rows = (typeof data !== 'undefined' && data && data.length) ? data : [];
  var part = '', h = 2166136261, i, k, s, c;
  // часть — из строки part; отпечаток ответа (FNV-1a по тексту строк): главный чарт не берёт тот же ответ дважды
  for (i = 0; i < rows.length; i++) {
    if (String(rows[i].role) === 'part') part = String(rows[i].id);
    s = String(rows[i].role) + '\n' + String(rows[i].id) + '\n' + String(rows[i].j || '') + '\n' + String(rows[i].ms || '') + '\n' + String(rows[i].mx || '');
    for (k = 0; k < s.length; k++) { c = s.charCodeAt(k); h ^= c & 255; h = (h * 16777619) >>> 0; h ^= c >>> 8; h = (h * 16777619) >>> 0; }
  }
  st.n++;
  var id = st.id, n = st.n, fp = part + ':' + rows.length + ':' + h;
  function bcast(msg) {
    try {
      (function walk(w, d) {
        if (d > 5) return;
        for (var j = 0; j < w.frames.length; j++) {
          var f = w.frames[j];
          if (f !== window) { try { f.postMessage(msg, '*'); } catch (e) { /* чужой фрейм */ } }
          try { walk(f, d + 1); } catch (e2) { /* нет доступа к вложенным */ }
        }
      })(window.top, 0);
    } catch (e) { /* нет window.top — стенд без родителя */ }
  }
  function hello() { bcast({ type: 'TP_HELLO', v: V, part: part, id: id, n: n, h: fp }); }
  if (st.on) { try { window.removeEventListener('message', st.on); } catch (e) { /* прошлый прогон */ } }
  for (i = 0; i < st.t.length; i++) clearTimeout(st.t[i]);
  st.on = function (ev) {
    var d = ev && ev.data;
    if (!d || d.type !== 'TP_ASK' || d.v !== V || !ev.source) return;
    // Optional selector is backwards compatible with v1 broadcast requests.
    if (Array.isArray(d.parts) && d.parts.indexOf(part) < 0) return;
    try { ev.source.postMessage({ type: 'TP_PART', v: V, part: part, id: id, n: n, h: fp, rows: rows }, '*'); } catch (e) { /* главный чарт пересоздан */ }
  };
  window.addEventListener('message', st.on);
  // сообщение могло уйти раньше, чем главный чарт начал слушать: два повтора (он и сам переспрашивает)
  hello();
  st.t = [setTimeout(hello, 600), setTimeout(hello, 2500)];
})();
// ---------- Пустой option: холст ECharts не используется ----------
option = { animation: false, xAxis: { show: false, type: "value" }, yAxis: { show: false, type: "value" },
  series: [{ type: "scatter", data: [] }] };

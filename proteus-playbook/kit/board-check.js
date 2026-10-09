// РАЗМЕТКА БОРДА (DevTools): поля, вкладки, ряды над ними, высота ряда с нашими чартами, правила CSS борда на странице,
// есть ли iframe в каждой ячейке, цепочка ячейки вверх — и какое число поставить в правило «высота ряда по экрану».
// 1. Открыть борд на вкладке с нашими чартами, НЕ в режиме правки, окно — как обычно работаете.
// 2. F12 → Console, вставить всё, Enter (Chrome при первой вставке просит набрать allow pasting — наберите и вставьте снова).
// 3. Прислать вывод целиком (текстом или скрином).
// Только читает размеры и стили элементов страницы: ничего не меняет и никуда не отправляет.
//
// Шаблон playbook (kit/board-check.js, 10-board-css.md). Агенту: заполнить CFG; id чартов — числовые заглушки, каждая
// ровно один раз в строке ids — сборщик поставки подставляет боевые id (kit/pack_template.py, вид snippet).
(function () {
  var CFG = {
    ids: ['000000'],                      // id наших чартов (все вкладки); меряются видимые на текущей вкладке
    gap: 16,                              // поле борда, которого добиваемся (сбоку, сверху, между чартами, от вкладок)
    cssName: 'CSS борда',                 // как файл CSS называется в поставке («файл 9» и т. п.) — для подсказок
    vh: /resizable-container/,            // признак правила «высота по экрану» в CSS борда (вместе с 100vh)
    chain: 24                             // сколько уровней цепочки ячейки вверх печатать
  };
  var out = [], ids = CFG.ids, GAP = CFG.gap;
  function n(v) { return Math.round(v); }
  function name(e) {
    var c = (typeof e.className === 'string' ? e.className : (e.getAttribute('class') || '')).trim();
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (c ? '.' + c.split(/\s+/).join('.') : '');
  }
  function box(e) {                       // координаты от начала страницы (с учётом прокрутки)
    var r = e.getBoundingClientRect();
    return { l: r.left, t: r.top + window.scrollY, r: r.right, b: r.bottom + window.scrollY, w: r.width, h: r.height };
  }
  function idOf(e) { return (/dashboard-chart-id-(\d+)/.exec(e.getAttribute('class') || '') || [])[1] || ''; }
  function sheetsRules() {               // все правила CSS страницы (чужие таблицы без доступа — пропускаем)
    var all = [];
    function walk(rules) {
      for (var j = 0; rules && j < rules.length; j++) {
        if (rules[j].cssRules && !rules[j].selectorText) walk(rules[j].cssRules);   // @media / @supports
        else all.push(rules[j]);
      }
    }
    for (var i = 0; i < document.styleSheets.length; i++) {
      var r = null;
      try { r = document.styleSheets[i].cssRules; } catch (er) { continue; }
      walk(r);
    }
    return all;
  }
  var RULES = sheetsRules(), EDIT = !!document.querySelector('.dashboard--editing');
  out.push('окно ' + window.innerWidth + '×' + window.innerHeight + ', страница прокручена на ' + n(window.scrollY)
    + (EDIT ? ' · РЕЖИМ ПРАВКИ: в нём раскладка другая — выйдите из него и запустите ещё раз' : ''));

  // ── 1. наши ячейки: какие есть, видны ли, есть ли в них iframe и растянут ли он ─────────────────────────────────
  var cells = [];
  for (var i = 0; i < ids.length; i++) {
    var all = document.querySelectorAll('.dashboard-chart-id-' + ids[i]);
    if (!all.length) { out.push('чарт ' + ids[i] + ': ячейки .dashboard-chart-id-' + ids[i] + ' на странице нет (другая вкладка, её ещё не открывали, или id другой)'); continue; }
    for (var k = 0; k < all.length; k++) {
      var c = all[k], B = box(c), fr = c.querySelector('iframe'), img = c.querySelector('img.echarts-plugin');
      if (B.w <= 0) { out.push('чарт ' + ids[i] + ': ячейка есть, но скрыта (другая вкладка)'); continue; }
      var line = 'чарт ' + ids[i] + ': ячейка ' + n(B.l) + ',' + n(B.t) + ' ' + n(B.w) + '×' + n(B.h) + ' (' + name(c).slice(0, 70) + ')';
      if (fr) {
        var F = box(fr), fs = getComputedStyle(fr);
        line += ' · iframe ' + n(F.w) + '×' + n(F.h) + ' (атрибуты ' + fr.getAttribute('width') + '×' + fr.getAttribute('height')
          + ', display ' + fs.display + ', sandbox «' + fr.getAttribute('sandbox') + '»)'
          + ' · поля ячейки вокруг iframe: слева ' + n(F.l - B.l) + ', сверху ' + n(F.t - B.t) + ', справа ' + n(B.r - F.r) + ', снизу ' + n(B.b - F.b);
      } else {
        line += ' · iframe НЕТ (чарт не загрузился, заглушка Proteus или ошибка)';
      }
      if (img && img.getAttribute('src')) line += ' · канал скриншотов: ' + img.getAttribute('src').length + ' знаков';
      out.push(line);
      cells.push({ id: ids[i], el: c, b: B });
    }
  }
  if (!cells.length) {
    out.push('Видимых ячеек наших чартов нет: откройте вкладку с чартами (не в режиме правки) и запустите ещё раз.');
    console.log(out.join('\n'));
    return;
  }
  cells.sort(function (a, b) { return a.b.t - b.b.t || a.b.l - b.b.l; });
  var ref = cells[0], row = cells.filter(function (x) { return Math.abs(x.b.t - ref.b.t) < 4; });
  row.sort(function (a, b) { return a.b.l - b.b.l; });

  // ── 2. поля: слева, справа, между чартами ряда ───────────────────────────────────────────────────────────────
  var cw = document.documentElement.clientWidth, L = row[0].b, R = row[row.length - 1].b, mid = [];
  for (var m = 1; m < row.length; m++) mid.push(n(row[m].b.l - row[m - 1].b.r));
  out.push('поле слева ' + n(L.l) + ' · справа ' + n(cw - R.r) + (mid.length ? ' · между чартами ' + mid.join(', ') : '')
    + '   (цель — ' + GAP + ')' + (document.documentElement.scrollWidth > cw ? ' · ЕСТЬ ГОРИЗОНТАЛЬНАЯ ПРОКРУТКА' : ''));

  // ── 3. вкладки: свои (над рядом) или верхнего уровня (полоса в шапке борда), ряды над ними ─────────────────────
  var tabs = ref.el.closest('.dashboard-component-tabs'), topLevel = !tabs;
  tabs = tabs || document.querySelector('.dashboard-component-tabs');
  var nav = tabs && tabs.querySelector('.ant-tabs-nav');
  var hdr = document.querySelector('.dashboard-header-container') || document.querySelector('.header-with-actions');
  if (!nav) {
    out.push('вкладок нет (.dashboard-component-tabs .ant-tabs-nav не нашёл)');
    if (hdr) out.push('от шапки борда до ряда ' + n(ref.b.t - box(hdr).b) + '   (цель — ' + GAP + ')');
  } else {
    var N = box(nav);
    if (topLevel) out.push('вкладки — верхнего уровня: Superset рисует их полосу в липкой шапке борда, ряды — в сетке под ней');
    out.push('от линии вкладок до чартов ' + n(ref.b.t - N.b) + '   (цель — ' + GAP + ') · полоса вкладок ' + n(N.h) + ' px');
    // у вкладок верхнего уровня полоса — часть шапки: зазор шапка→вкладки должен быть 0, а не поле борда
    if (hdr) out.push('от шапки борда до вкладок ' + n(N.t - box(hdr).b) + '   (цель — ' + (topLevel ? 0 : GAP)
      + (topLevel ? ': полоса вкладок — часть шапки)' : ', больше — над вкладками ряды, ниже)'));
    if (!topLevel) {
      for (var s = (tabs.closest('.dragdroppable') || tabs).previousElementSibling; s; s = s.previousElementSibling) {
        var ch = s.querySelectorAll('[class*="dashboard-chart-id-"]'), sid = [];
        for (var q = 0; q < ch.length; q++) sid.push(idOf(ch[q]));
        out.push('  над вкладками: ' + name(s).slice(0, 80) + ' — ' + n(s.getBoundingClientRect().height) + ' px' + (sid.length ? ', чарты ' + sid.join(', ') : ''));
      }
    }
    var act = nav.querySelector('.ant-tabs-tab-active');
    if (act) {
      var t = act.querySelector('[data-test="editable-title-input"]') || act.querySelector('.editable-title') || act;
      var cs = getComputedStyle(t), af = getComputedStyle(act, '::after'), ic = act.querySelector('.fa, .anticon, [class*="anchor"] i');
      out.push('активная вкладка: ' + cs.fontFamily.split(',')[0] + ' ' + cs.fontSize + ' ' + cs.fontWeight + ', цвет ' + cs.color
        + ', фон ' + getComputedStyle(act).backgroundColor + ', черта ::after ' + af.backgroundColor + ' ' + af.height
        + (ic ? ', значок ссылки — шрифт ' + getComputedStyle(ic).fontFamily.split(',')[0] : ''));
    }
    // украшения владельца на псевдоэлементах (плашка NEW и т. п.) общий сброс `*` не задевает — показать, какие они
    var titles = nav.querySelectorAll('.ant-tabs-tab [data-test="editable-title-input"], .ant-tabs-tab .editable-title');
    for (var z = 0; z < titles.length; z++) {
      ['::before', '::after'].forEach(function (pe) {
        var p = getComputedStyle(titles[z], pe);
        if (p.content && p.content !== 'none' && p.content !== 'normal' && p.content !== '""') {
          out.push('  у вкладки «' + titles[z].textContent.trim().slice(0, 30) + '» ' + pe + ': ' + p.content + ', фон ' + p.backgroundColor
            + ', кегль ' + p.fontSize + ', цвет ' + p.color);
        }
      });
    }
  }

  // ── 4. ряд: верх, высота, зазор до низа окна; число для правила «высота по экрану» ───────────────────────────
  var rc = ref.el.closest('.resizable-container'), need = n(ref.b.t) + GAP;
  out.push('ряд чартов: верх ' + n(ref.b.t) + ' px от начала страницы, высота ' + n(ref.b.h)
    + (rc && rc.style.height ? ' (в раскладке ' + rc.style.height + ')' : '')
    + ', от низа ряда до низа окна ' + n(window.innerHeight - (ref.b.b - window.scrollY)));
  var vhRule = null, vhTop = 0;
  for (var v = 0; v < RULES.length; v++) {
    var txt = RULES[v].cssText || '', mm = /100vh\s*-\s*(\d+)px|-(\d+)px\s*\+\s*100vh/.exec(txt);   // браузер пишет и так, и так
    if (mm && CFG.vh.test(txt)) { vhRule = txt; vhTop = +(mm[1] || mm[2]); break; }
  }
  if (!vhRule) out.push('правило «высота по экрану» (100vh в ' + CFG.vh + ') в CSS страницы не нашёл — в ' + CFG.cssName + ' его нет или вставлен прежний файл');
  else if (EDIT) out.push('высота по экрану: в CSS «100vh - ' + vhTop + 'px»; в режиме правки число не считаю');
  else if (vhTop === need) out.push('высота по экрану: «100vh - ' + vhTop + 'px» — верно, ничего менять не нужно');
  else out.push('высота по экрану: в ' + CFG.cssName + ' «100vh - ' + vhTop + 'px» — замените на «100vh - ' + need + 'px» (Ctrl+H), сохраните, обновите страницу');

  // ── 5. правила CSS с нашими id: что из них сейчас что-то задевает (иначе — у форка другие классы или CSS «scoped») ──
  var mine = [], hit = 0;
  for (var w = 0; w < RULES.length; w++) {
    var sel = RULES[w].selectorText;
    if (!sel) continue;
    for (var u = 0; u < ids.length; u++) {
      if (sel.indexOf('chart-id-' + ids[u]) < 0) continue;
      var ok = '?';
      try { ok = document.querySelector(sel.replace(/::?(before|after|placeholder|selection|-webkit-[\w-]+)\b/g, '')) ? 'да' : 'нет'; } catch (er) { ok = '?'; }
      if (ok === 'да') hit++;
      mine.push('  [' + ok + '] ' + sel.replace(/\s+/g, ' ').slice(0, 150));
      break;
    }
  }
  out.push('правил CSS с нашими id: ' + mine.length + ', из них сейчас что-то задевают: ' + hit
    + (mine.length && !hit ? ' — НИ ОДНО: CSS не вставлен, у форка другие классы или селекторы изменены (см. текст правил ниже)'
      : ' ([нет] — правило для другого состояния: маркер канала, загрузка, другая вкладка)'));
  mine.sort(function (a, b) { return (a.indexOf('[да]') < 0) - (b.indexOf('[да]') < 0); });
  out.push.apply(out, mine.slice(0, 30));
  if (mine.length > 30) out.push('  … ещё ' + (mine.length - 30));

  // ── 6. цепочка опорной ячейки вверх: поля, отступы, фон — по ней правится CSS, если у форка другие классы ─────────
  out.push('— цепочка ячейки ' + ref.id + ' вверх (поля, отступы, фон):');
  for (var e = ref.el, d = 0; e && e !== document.documentElement && d < CFG.chain; e = e.parentElement, d++) {
    var st = getComputedStyle(e), Rb = e.getBoundingClientRect();
    var mg = [st.marginTop, st.marginRight, st.marginBottom, st.marginLeft].join(' '), pd = [st.paddingTop, st.paddingRight, st.paddingBottom, st.paddingLeft].join(' ');
    out.push('  ' + d + ' ' + name(e).slice(0, 110) + ' · ' + n(Rb.left) + ',' + n(Rb.top + window.scrollY) + ' ' + n(Rb.width) + '×' + n(Rb.height)
      + (mg !== '0px 0px 0px 0px' ? ' · поля ' + mg : '') + (pd !== '0px 0px 0px 0px' ? ' · отступы ' + pd : '')
      + (st.backgroundColor !== 'rgba(0, 0, 0, 0)' ? ' · фон ' + st.backgroundColor : '')
      + (st.overflow !== 'visible' ? ' · overflow ' + st.overflow : '') + (st.position === 'sticky' || st.position === 'fixed' ? ' · ' + st.position : ''));
  }
  console.log(out.join('\n'));
})();

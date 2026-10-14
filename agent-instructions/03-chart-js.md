# 03. JS кастомного чарта Proteus

Кастомный чарт (`react_sanbbox`, тип ECHARTS) — JS, который песочница исполняет в iframe **заново на каждый ответ
датасета**. ECharts — пустой холст, всё видимое — свой HTML, CSS и SVG в overlay. Вид —
[01](01-design-system.md), датасет — [02](02-clickhouse-sql.md), CSS борда — [04](04-board-css.md), поведение —
[05](05-ux-patterns.md), поставка — [07](07-delivery-process.md). Коды CJ-, SB-, MC-, DS- — правила `../proteus-playbook/`.

## Главное

1. Каркас — копия шаблона скилла proteus-echarts-builder, БЛОКИ 1–7, ES5, глобальный `option` с пустым scatter последним
   выражением (CJ-01, CJ-02, CJ-04).
2. Состояние — в `window.__pvtState[ns]`; на перезапуске снимай слушатели, наблюдатели, таймеры; снаружи `mount()` — только
   `state.rerender` (CJ-05, CJ-06, CJ-08).
3. Любая ошибка окна гасит чарт: `overflow:hidden` и обёртка `window.onerror` в начале `mount()` (SB-03).
4. Чарт сам называет ошибку поставки текстом (CJ-19).
5. В поставке — сборка terser 5.51.2 с бюджетом: код едет в каждом `chart/data` (CJ-21). Эмит и ожидание — по контракту
   раздела 6 (MC-02, MC-06…MC-08).

---

## 1. Среда

iframe `sandbox="allow-scripts"` без `allow-same-origin`, CSP `connect-src 'none'`, размер — ячейка. Глобалы скрипта:
`data` (строки ответа), `applyCrossFilter` (только на дашборде), `option` (пишешь ты).

| Нужно | Чего нет | Как |
|---|---|---|
| Помнить вид | хранилища и `cookie` — SecurityError, чарт гаснет | `window.__pvtState[ns]`, живёт с iframe |
| «Первый вход», пресет | Proteus вход не помнит | тур — кнопкой, пресет — ссылкой (SB-02) |
| Данные | `fetch`, XHR — запрещены CSP | только ответ своего датасета |
| Сосед | `parent.document`, `top.location` — SecurityError | `postMessage` по `window.top.frames` в `try` (MC-12) |
| За ячейку | родителя не достать | канал скриншотов + CSS борда (SB-11) |
| Диалог | `alert`, `confirm`, `window.open` молчат | своя модалка или плашка |
| Копировать | Clipboard API — NotAllowedError | `textarea` + `execCommand('copy')` в жесте клика (SB-10) |
| Шрифт | `@font-face`, CDN | стек из 01, явно в каждом слое `body` |
| «По экрану» | `innerHeight`, `100vh` = ячейка (до 1 400 px) | видимая часть по IntersectionObserver; ряд — CSS борда (SB-05, SB-06) |
| Адрес борда | `location` — не борд | `document.referrer`, запасной — `meta` (SB-17) |
| Необязательный API | `ResizeObserver`, `animate`, `TextDecoder` | `typeof … !== 'undefined'` или `try` (SB-04) |

**Ошибки окна.** Песочница гасит чарт на любую ошибку окна, даже на «ResizeObserver loop…» от полосы прокрутки Windows.
Вызывай сразу после выбора хоста:

```js
function guardWindow(host) {                       // SB-03
  host.style.overflow = 'hidden';                  // прокрутка — только в overlay и панелях
  document.documentElement.style.overflow = 'hidden';
  if (document.body) document.body.style.overflow = 'hidden';
  var onErr0 = window.onerror;
  if (onErr0 && onErr0.__roSkip) return;           // перезапуск: не оборачивать дважды
  var onErr = function (msg) {
    if (/ResizeObserver loop/i.test(String(msg))) return true;
    return typeof onErr0 === 'function' ? onErr0.apply(this, arguments) : false;
  };
  onErr.__roSkip = true;
  window.onerror = onErr;
}
```

> ⚠ В шаблоне скилла и виджетах Adoption (14.10) обёртки нет, тултипы клампят по `innerHeight`. Их `mount()` вслепую не
> копируй (образец обёртки — TeamPulse `proteus/prelude.js`, видимой части — `visV` HRBP HUB).

**Видимая часть.** Модалку, тултип, карточку тура ставь по `visV()` — линейке полос по 24 px под IntersectionObserver
(код — SB-05). Колесо мыши не блокируй (SB-07).

---

## 2. Каркас и жизненный цикл

**ES5.** Нельзя: `let`/`const`, стрелки, backtick, `class`, деструктуризация, spread, `import`, `fetch`, внешние URL,
`console.*`, `eval`, `new Function`, строка в `setTimeout`, `getElementById` (после перезапуска находит старые узлы —
ищи `overlay.querySelector`). Вместо голых `parent`, `top` — `window.top`, `window.parent`. ES2015+ макета переводит Babel,
не руки (раздел 5).

**БЛОКИ.** Болванку делает `python3 <скилл>/bootstrap.py <папка>` (скилл — `romuney/adoption`, ветка `new`,
`skills/proteus-echarts-builder/`, коммит `e77d754`). Свободны 1 `CFG`, 3 `buildModel`, 4 форматеры, 5 `buildCSS`/`buildHTML`.
Блоки 2 (вход, `state`, `esc`/`num`/`toDate`), 6 (монтаж, тултип, `render`, делегирование) и 7 (`option`) — дословно,
правка только в `[ЗАПОЛНИ]`; служебные `getTip`, `showTip`, `hideTip`, `render`, `trigger` не переименовывай (CJ-01).
Отступления по гайду (`guardWindow`, `visV`, отложенный `relayout`, тултип за курсором) пиши в NOTES с кодом правила.

**Монтаж (CJ-03).** В одном `try` самовызывающейся `mount()`: последний `[_echarts_instance_]` → `guardWindow` → `canvas`
— `display:none` → старый `.<ns>-overlay` удалить → хост `relative` → новый overlay → ровно один `render()`. `catch` пишет
«Ошибка графика: …» в overlay своего хоста и `option` не трогает.

**`option` (CJ-04)** — вне функций, последним, синхронно (песочница читает его сразу, ничего не жди), без мутаций после.
С данными ECharts рисует поверх overlay.

```js
option = { animation: false, xAxis: { show: false, type: 'value' }, yAxis: { show: false, type: 'value' },
  series: [{ type: 'scatter', data: [] }] };
```

**Состояние (CJ-05).** Всё, что читает разметка, — в `state`. Обработчик пишет в `state` и зовёт `render()`, `buildHTML()`
сам ставит активный класс; `classList.add` мимо `state` живёт до перерисовки. Новые ключи доливай каждый запуск: новая
версия скрипта стартует поверх старого состояния.

```js
if (!window.__pvtState) window.__pvtState = {};
var STATE0 = { view: 'main', tip: null, page: 0, pend: null, warn: '', drawn: {}, cache: {}, listeners: [] };
var state = window.__pvtState[CFG.ns] || (window.__pvtState[CFG.ns] = {});
for (var k0 in STATE0) if (STATE0.hasOwnProperty(k0) && !state.hasOwnProperty(k0)) state[k0] = STATE0[k0];
```

> ⚠ Adoption доливает часть ключей руками, шаблон — не доливает. Пиши цикл по `STATE0`.

**Перезапуск (CJ-06, CJ-08).**
- Слушатели overlay — **безусловно**, делегированием, один раз снаружи `render()`: overlay каждый раз новый, флаг «уже
  навешено» убивает интерактив со второй отрисовки.
- Глобальные (`window`, `document`) — через `listen()` / `cleanup()` (раздел 8); первая строка — `if (!overlay.parentNode) return;`.
- Наблюдатели — `disconnect()`, таймеры — `clear*`, по ссылке из `state`. Слои `body > .<ns>-…` — удалить и создать (SB-09).
- Снаружи `mount()` — только `if (state.rerender) state.rerender();`. Прямой `render()` — ReferenceError, чарт погас.

**`render()` и `relayout()` (CJ-07).** `render()`: запомнить прокрутку и фокус → `overlay.innerHTML = buildHTML()` →
вернуть → `renderTip()`. `relayout()`: класс `<ns>-narrow` по `overlay.clientWidth` (не `@media`), SVG `[data-cw]` по месту
при смене ширины > 2 px; `render()` не зовёт. RO на хосте — `setTimeout(relayout, 150)`: синхронная правка размера даёт
петлю RO. Ложный FAIL C4 скилла оспаривай, код не меняй.

---

## 3. Где и как рисовать

ECharts везде — пустой холст. TeamPulse рисует без библиотек и в макете, и в чарте (`draw.js`); в Adoption макет на
ECharts, а виджеты перерисовывают те же графики своим SVG. Инстанс ECharts в чарте не создавай: `option` с данными ложится
поверх overlay, канвас не берёт шрифт, тултип и анимацию профиля (CJ-09).

| Что | Чем |
|---|---|
| Таблица, дерево, KPI, пилюли, плашки | HTML-строка в overlay |
| Линии, бары, воронка, когорты, календарь | SVG строкой: `width = W` измеренной ширины, `viewBox="0 0 W H"` |
| Спарклайн без подписей | SVG `viewBox` + `width:100%` |
| Тултип, линейка, тур, выпадашка | слой в `body`, один раз |

SVG с подписями — по плейсхолдеру `<div data-cw="вид">`: после вставки меряй ширину и рисуй в пикселях, реестр
`{kind, key, draw(width)}` даёт `relayout()` перерисовать по месту.

**Дёшево:**
- **Один проход — одна вставка:** массив строк → `join('')` → один `innerHTML`. `DocumentFragment` — только чтобы
  дописать узлы в контейнер, который нельзя пересоздать («Показать ещё»).
- **Сначала все замеры, потом запись:** чередование «замер → запись» пересчитывает раскладку на каждом шаге.
- **Делегирование:** `mouseover`, `mouseout`, `click` на overlay + `trigger(e.target, 'data-…')`; триггеры — ровно
  `data-tip`, `data-kind`, `data-action`, `data-view`, без префикса (CJ-14).
- **Наведение двигает только тултип,** `innerHTML` тултипа — при смене цели. Тултип за курсором, гаснет в пустоте через
  110 мс, на `mouseout` документа без `relatedTarget`, `blur`, прокрутке (CJ-11, CJ-12).
- **Ввод — точечно:** поиск обновляет `[data-tbox]`, `[data-tcount]`, поле не пересоздаётся, дебаунс 120 мс (CJ-13).
- **Ресайз — 150 мс, прокрутка — `requestAnimationFrame`** с флагом «уже запрошено».
- **В DOM — страница** 50–100 строк; поиск, сортировка, «Копировать» — по модели (CJ-15).
- **Анимация — первый показ** новых данных (`state.drawn`), не на ресайз и наведение (CJ-10).

---

## 4. Данные

Обёртка Proteus — `… FROM (датасет) AS virtual_table GROUP BY <Измерения> LIMIT 50000`: строки уникальны, **порядок не
держится**, обрезка молчит; поля нет в «Измерениях» — нет и в `data` (DS-24, DS-25).

1. Весь массив: `var rawData = (typeof data !== 'undefined' && Array.isArray(data)) ? data : [];`.
2. Первым — проверки поставки (раздел 8).
3. Строки — по роли (`role` / `section`); порядок — в JS по номеру пачки, ключу, `CFG.order` из макета.
4. Распаковка — один раз: `k` через `\n`, поля через `|` или `\t` (пустая строка — ноль строк, не `['']`); ряды
   `'1,5,0,…'` — массив длины сетки календаря; кириллица — `atob` + `TextDecoder('utf-8')` или словарь датасета (`unz`
   Adoption), не свой посимвольный base64 (CJ-18); JSON `meta` — в `try`; числа — `num()`, даты — `toDate()`; дата
   свежести — из ответа (DS-07).
5. Доли, проценты, ранги, дельты — в JS из аддитивных компонентов (DS-04).
6. Модель — в кэш по отпечатку: ресайз перезапускает скрипт с тем же `data` (CJ-17).

```js
var fp = (meta.rq || '') + '|' + rawData.length + '|' + heavyLen + '|' + sigOf(echo);
if (!(state.cache.m && state.cache.m.fp === fp)) state.cache.m = { fp: fp, model: parseAll() };
```

Необязательную колонку новой поставки читай мягко: нет — метрика «демо», без плашки (TeamPulse `OPT` в `real.js`).

---

## 5. Вес кода и сборка

Код лежит в `form_data.jsx` **каждого** POST `chart/data` — открытие, «Применить», кросс-фильтр, даже ответ из кэша.
Отправка у владельца ≈50 КБ/с: **каждые 50 КБ — плюс секунда на каждом действии** (CJ-21).

- **Поставка — terser 5.51.2** через `kit/min.cjs` (`ecma 5`, верхний уровень цел, `ascii_only:false`, шапка-штамп):
  −40–45 % при том же поведении. Версию закрепи (`npm i -g terser@5.51.2`), иначе `--check` сборщика расходится.
- **Исходник — в репозитории, сборка — скриптом** (`.stand/pack.py`, `proteus/build.js`) со штампом и sha12 исходника,
  руками не правится. Сборка — одна строка: проси у владельца текст ошибки целиком.
- **Бюджет — `--budget N` (КиБ).** Поднял — комментарий в сборщике: дата, на что, сколько секунд. На 14.10: Adoption —
  шапка 43 КБ, каталог 105, панель 179 при бюджете 200; TeamPulse — ≈393 КиБ при бюджете 400 (≈8 с на запрос).
  > ⚠ OPTIMIZATION.md и CJ-21 пишут для TeamPulse 333–340 КиБ (09.10); к 13.10 сборка выросла на русских текстах
  > (строки terser не сжимает). Действует бюджет 400 из `build.js`; первый кандидат на сжатие — маскот (≈72 КиБ).
- **Строки весят как есть:** CSS в строке — `--css-var ИМЯ`; картинка base64 — × 4/3 в каждом запросе (WebP q80 в 2× или вон).
- **Загрузчик кода из ответа запрещён:** `new Function`, `eval`, `<script>` уже сломали все JS-чарты борда (CJ-22).
- **Макет на ES2015+** (TeamPulse): модуль — своей функцией в общем `try` → Babel `preset-env` (`targets: {ie: '11'}`,
  `useBuiltIns: false`, `comments: false`) → acorn `ecmaVersion: 5` → запреты вне строк → `option` последним → terser (CJ-23).

---

## 6. Кросс-фильтры и несколько чартов

**Эмит (MC-02…MC-05).**
- `applyCrossFilter([{column, operator: 'IN', value: [строки]}])`. Без `operator` — 400 у **всех** получателей.
- Значения — `String(v)`, без `null` и `''`, **отсортированы** (порядок входит в ключ кэша). Пустой набор — колонку не шли,
  `value: []` роняет получателя. Сброс — `applyCrossFilter([])`.
- Все носители — **одним вызовом** в постоянном порядке: маска заменяется целиком.
- Умолчание и повтор той же маски не шли: холодный запрос того же ответа или вечное ожидание.
- Клики без «Применить» — один эмит через 300 мс после последнего; с «Применить» — `state.stage` и один эмит.
- Носитель — основа + суффикс вкладки (`flt_f`), суффикс — из `meta`; в SELECT и «Измерениях» его нет (SP-14).
- Нет `applyCrossFilter` — сразу плашка «Открой чарт на дашборде: фильтры работают только там».
  > ⚠ Adoption здесь молча выходит из `emit()`. Пиши плашку, как TeamPulse.

**Ожидание (MC-06…MC-08).**
- Датасет отдаёт в `meta` эхо **применённого**. Подпись — одинаково в SQL и JS: колонки по алфавиту, значения
  отсортированы, `"`, `\`, переводы строк выкинуты.
- После эмита `state.pend = {sig, at}`, отчёт приглушён (`opacity:.55`), данные на месте. Снимает **только** ответ с эхом
  `=== sig`.
  > ⚠ TeamPulse снимает ожидание любым ответом. Правило — сверка по эху.
- «Обновляю данные… N с» — секунды текущего запроса со 2-й; `setInterval` 1 с правит только `[data-pendt]`.
- Жёлтая плашка — с 45 с, с причиной и пунктом инструкции. `armPend()` считает остаток от `state.pend.at` и переживает
  перезапуск.
- По таймеру не повторяй. Автоповтор — только на ответ под **прежний** выбор, если нужного нет 10 с, не больше 2 раз: та же
  маска + фиктивный носитель-`nonce`. 60 с тишины — кнопка «Повторить запрос».

**Несколько чартов (MC-09…MC-16).** Области — JSON-метаданными из поставки, не мышкой. Канал — `postMessage` обходом
`window.top.frames` (глубина ≤ 5, всё в `try`), сообщение `{type, v, src, sheet}`, чужие отбрасывай. Ключ выбора шли
соседям сразу; получатель переспрашивает (ASK) раз в 1,5 с, отправитель отвечает всегда. Протокол меняй во всех
участниках одной поставкой.

---

## 7. Стиль кода

Образец — виджеты Adoption `Виджеты/pa-*.chart.js`; сборка из макета — TeamPulse `proteus/`.

- **Шапка файла:** что за чарт, датасет и колонки, какие носители слушает и пишет, откуда сборка.
- **Константы — в `CFG` в начале:** `ns`, `fields`, `order`, `views`, `text`, `colors`, `fonts` (роли кеглей), `spacing`,
  пороги (`selDelay`, `pendingWarnMs`, `pageSize`). В разметке нет литералов цвета и кегля; у числа — «почему так».
- **Имена:** `CFG`, `STATE0`, `state`, `rawData`, `MODEL` — как в шаблоне; модульные константы — `ВЕРХНИМ` (`THIN`,
  `MONTHS`); функции — глагол + объект (`buildModel`, `parseListPack`, `renderTip`, `maskOf`, `sigOf`, `armPend`);
  функции канала — с префиксом проекта (`paBcast`). Классы — `CFG.ns + '-…'`.
- **Одна функция — один тип входа** (`cutName(строка)` ≠ `trName(объект)`); перед сменой сигнатуры — `grep` вызовов (CJ-16).
- **Всё из данных — через `esc()`,** в атрибутах тоже. Тексты интерфейса — в `CFG.text`. Комментарии — о причинах, с кодом
  правила или датой решения владельца.
- **Форматеры (БЛОК 4):** разряды U+2009, минус U+2212, запятая, «—» на `null`/`NaN`. Пиши escape (`' '`), не
  литерал: копипаст подменяет его обычным пробелом.
  > ⚠ В 9 из 10 виджетов Adoption и в сборке 14.10 `THIN` — обычный пробел (0x20): число рвётся переносом. Берёшь код
  > оттуда — замени на `' '`.

| | Макет | Чарт Proteus |
|---|---|---|
| Синтаксис | ES2015+ | ES5 (руками или Babel) |
| Файлы | модули + `index.html` | один файл: исходник + сжатая сборка |
| Состояние, слушатели | переменные, `localStorage`; слушатели один раз | `__pvtState`; реестр со снятием каждый запуск |
| Корень, высота | `document`, `100vh` = экран | overlay последнего хоста, `100vh` = ячейка |

---

## 8. Сниппеты

### Скелет (схема; болванка — только из `bootstrap.py`)

```js
// <name>.chart.js — <что>. Датасет <имя>: role · k · v · n. Пишет: <x_f>. Сборка: <команда>.
var CFG = { ns: 'xx', ver: 3, fields: { role: 'role', k: 'k', v: 'v', n: 'n' },    // БЛОК 1
  rowLimit: 50000, pendingWarnMs: 45000, selDelay: 300, text: {}, colors: {}, fonts: {} };
// БЛОК 2: rawData, STATE0 + долив, esc/num/toDate из шаблона, listen/cleanup
function buildModel() {                                                          // БЛОК 3
  var chk = checkInput(rawData);                                                 // ошибки поставки — первыми
  return chk.err ? chk : { meta: chk.meta, warn: chk.warn, rows: parseRows(chk.meta) };
}
var MODEL = buildModel();
// БЛОК 4: nf, pct, plural.  БЛОК 5: buildCSS(); buildHTML(): if (MODEL.err) return errorHTML(MODEL);
(function mount() {                                                              // БЛОК 6
  try {
    var hosts = document.querySelectorAll('[_echarts_instance_]');
    if (!hosts || !hosts.length) return;
    var host = hosts[hosts.length - 1];
    guardWindow(host);
    cleanup();
    // canvas — display:none; старый overlay — удалить; новый overlay — appendChild (шаблон)
    function render() { /* прокрутка → innerHTML = buildHTML() → прокрутка, фокус → renderTip() */ }
    function relayout() { /* -narrow по clientWidth, SVG [data-cw] по месту */ }
    state.rerender = render;
    overlay.addEventListener('click', onClick);                                  // безусловно: overlay новый
    listen(window, 'message', function (e) { if (!overlay.parentNode) return; /* … */ });
    render();
    if (typeof ResizeObserver !== 'undefined') {
      state.ro = new ResizeObserver(function () { clearTimeout(state.roT); state.roT = setTimeout(relayout, 150); });
      state.ro.observe(host);
    }
    armPend();                                                                   // ожидание — после перезапуска
  } catch (e) { /* «Ошибка графика: …» в overlay последнего хоста (шаблон) */ }
})();
// БЛОК 7: option = { … пустой scatter … };
```

### Снятие слушателей

```js
function listen(target, type, fn, opt) {               // всё глобальное — только так
  target.addEventListener(type, fn, opt);
  state.listeners.push({ t: target, type: type, fn: fn, opt: opt });
}
function cleanup() {                                    // начало mount(), до новых слушателей
  var L = state.listeners || [];
  for (var i = 0; i < L.length; i++) {
    try { L[i].t.removeEventListener(L[i].type, L[i].fn, L[i].opt); } catch (e) { /* узел ушёл */ }
  }
  state.listeners = [];
  if (state.ro && state.ro.disconnect) state.ro.disconnect();
  if (state.visIO && state.visIO.disconnect) state.visIO.disconnect();
  clearTimeout(state.roT); clearTimeout(state.emitT); clearTimeout(state.pendT); clearInterval(state.pendTick);
  state.ro = state.visIO = state.roT = state.emitT = state.pendT = state.pendTick = null;
  var old = document.querySelectorAll('body > .' + CFG.ns + '-tip, body > .' + CFG.ns + '-vis');
  for (var j = 0; j < old.length; j++) old[j].parentNode.removeChild(old[j]);
}
```

### Форматер чисел

```js
var THIN = ' ', MINUS = '−', DASH = '—';
function nf(v, dec) {                                   // 1234567.89 → «1 234 567,9»; «−0» не бывает
  v = typeof v === 'number' ? v : num(v);
  if (v == null || !isFinite(v)) return DASH;
  var s = Math.abs(v).toFixed(dec == null ? 0 : dec).split('.');
  var neg = v < 0 && Number(s.join('.')) !== 0;
  return (neg ? MINUS : '') + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, THIN) + (s[1] ? ',' + s[1] : '');
}
function pct(v, dec) { return v == null || !isFinite(v) ? DASH : nf(v, dec == null ? 1 : dec) + '%'; }
function signed(v, dec) { return v > 0 && nf(v, dec) !== nf(0, dec) ? '+' + nf(v, dec) : nf(v, dec); }
```

В CSS чисел — `font-variant-numeric: tabular-nums`.

### Ошибки поставки (CJ-19)

```js
function checkInput(rows) {
  if (!rows.length) return { err: 'empty' };
  var miss = [], f, meta = null;
  for (f in CFG.fields) if (CFG.fields.hasOwnProperty(f) && !(CFG.fields[f] in rows[0])) miss.push(CFG.fields[f]);
  if (miss.length) return { err: 'columns', missing: miss };
  for (var i = 0; i < rows.length && !meta; i++) if (String(rows[i][CFG.fields.role]) === 'meta') {
    try { meta = JSON.parse(String(rows[i][CFG.fields.v] || '{}')); } catch (e) { return { err: 'meta' }; }
  }
  if (!meta) return { err: 'meta' };
  if (meta.ok === 0) return { err: 'access' };                       // штатная плашка доступа (AC-02)
  if (+meta.ver < CFG.ver) return { err: 'old' };                    // датасет прошлой поставки
  var cut = (meta.rows != null && rows.length !== +meta.rows) || rows.length >= CFG.rowLimit;
  return { meta: meta, warn: cut ? 'cut' : '' };                     // cut — жёлтая плашка поверх данных
}
var ERR_TEXT = {
  empty: 'Датасет не вернул строк: проверь датасет чарта и лимит строк 50 000 (п. N).',
  columns: 'В данных нет колонок — добавь их в «Измерения» чарта (п. N): ',
  meta: 'Ответ неполный: нет строки meta — датасет не тот или лимит строк мал (п. N).',
  old: 'Датасет прошлой поставки: замени SQL из файла N целиком, Save, обнови страницу.',
  cut: 'Ответ обрезан лимитом строк: поставь 50 000 (п. N).'
};
function errorHTML(m) {
  return buildCSS() + '<div class="' + CFG.ns + '-empty">'
    + esc((ERR_TEXT[m.err] || 'Ошибка данных') + (m.missing ? m.missing.join(', ') : '')) + '</div>';
}
```

Пункты — из «0. Инструкция.md». Новый ключ ответа читай с запасным значением: «новый JS + старый SQL» — не пустота.

> ⚠ TeamPulse ловит обрезку по строке `end`, а под `GROUP BY` она может уцелеть. Сверяй `meta.rows` с `data.length` и
> `data.length ≥ лимита` (DS-25).

---

## 9. Паттерны и антипаттерны

| ✅ Делай | ❌ Не делай | Почему |
|---|---|---|
| Копия шаблона, правка в `[ЗАПОЛНИ]` | Каркас «своими словами» | 4 ч и 10 FAIL (CJ-01) |
| `option` глобально, последним, пустой | В IIFE, с данными, после `await` | «option is not defined», график поверх (CJ-04) |
| Выбор в `state` | `classList.add`, локальная `var` | Сброс после перерисовки (CJ-05) |
| Overlay — безусловно, глобальные — реестр | Флаг «уже навешено» для overlay | Со 2-й отрисовки нет интерактива (CJ-06) |
| Снаружи — `state.rerender` | `render()` с верхнего уровня | ReferenceError, чарт погас (CJ-08) |
| `guardWindow` до разметки; RO → отложенный `relayout()` | Прокручиваемый документ; `render()` из RO | Чарт гаснет на Windows, мигание (SB-03, CJ-07) |
| `visV()` | `innerHeight`, `100vh` как экран | «Применить» за краем экрана (SB-05) |
| SVG 1:1 по ширине | `viewBox` + `100%` с подписями | Кегль растёт с ячейкой (CJ-09) |
| Наведение двигает тултип, ввод — точечно | `render()` на `mouseover` и на букву | Тултип моргает, каретка теряется (CJ-11, CJ-13) |
| В DOM — страница; разбор один раз | Все строки; разбор на перезапуске | Секунды на `render()` и ресайз (CJ-15, CJ-17) |
| Ошибка поставки текстом с пунктом | Пустая ячейка, молчаливый `catch` | Круг переписки с владельцем (CJ-19) |
| terser с `--budget`, код целиком в поле JS | Исходник в поставке; загрузчик из ответа | +секунды на действие; сломались все чарты (CJ-21, CJ-22) |
| `IN`, строки, сортировка, один вызов | Без `operator`, `value: []`, вызов на носитель | 400 у получателей, маска стёрта (MC-02) |
| Сверка по эху, плашка с 45 с, без повтора по таймеру | Ожидание до любого ответа, плашка с 9 с, повтор через 6 с | Старые данные, ложная тревога, обрыв запроса (MC-06…MC-08) |
| `execCommand('copy')` первым; своя модалка | Clipboard API первым; `confirm`, `alert` | Ошибка в консоли; диалог молчит (SB-10, SB-01) |

---

## 10. Чек-лист перед сдачей

`<playbook>` — `../proteus-playbook`, `<скилл>` — клон `romuney/adoption`, `skills/proteus-echarts-builder`; запуск — из
корня репозитория, JS-инструментам — `NODE_PATH=$(npm root -g)`.

1. `node --check proteus/<name>.chart.js`.
2. ESLint — 0 ошибок: `node $(npm root -g)/eslint/bin/eslint.js -c <playbook>/kit/eslint.chart.cjs --no-config-lookup
   proteus/<name>.chart.js`. «File ignored…» — провал; предупреждения о `localStorage`, `fetch`, `alert`, `console` — убрать.
3. Скилл по **исходнику**: `python3 <скилл>/check.py proteus/<name>.chart.js` (validate + smoke). FAIL — гипотеза; ложные
   C4, K3b, S11a, S20 — `--accept 'КОД=причина'`, не больше двух.
4. Сборка: `node <playbook>/kit/min.cjs '<шапка>' --check --budget <КиБ> < <исходник> > <файл>` или сборщик проекта (код
   выхода — до записи).
5. `node <playbook>/kit/min.cjs --verify '<файл поставки>'`; `grep -c 'new Function\|eval(\|<script\|localStorage'` — 0.
6. Модель песочницы на **сборке**: `node <playbook>/kit/sbx/run.cjs <сборка> <mock.json> --css <CSS борда> --clicks
   <сценарий>` — все контролы, сужение окна, ещё раз с `--catch listener`. Код 1 — в бою чарт погас бы.
7. Smoke проекта (TeamPulse — `proteus/smoke_real.js`, Adoption — `.stand/wstand.mjs`): три перезапуска — один overlay,
   один тултип, клик срабатывает раз; испорченные ответы — видимый текст; эмиты — `IN`, отсортированы, один на действие.
8. В NOTES и сводке: итоги шагов 1–7 с оспоренными кодами, размер «было → стало, ≈ с отправки».

---

## Где подробнее

- [SKILL.md](../proteus-playbook/SKILL.md), «Не ломать никогда», п. 18–28.
- [07-chart.md](../proteus-playbook/07-chart.md): CJ-01…CJ-23 и «Где гайд уточняет скилл».
- [08-sandbox.md](../proteus-playbook/08-sandbox.md): факты S1–S15, SB-03…SB-05, SB-10, SB-11…SB-18, SB-20.
- [09-multi-chart.md](../proteus-playbook/09-multi-chart.md): эмит MC-02…MC-05, ожидание MC-06…MC-08, канал MC-12…MC-16.
- [05-dataset.md](../proteus-playbook/05-dataset.md): `meta` и целостность DS-03, DS-25; упаковка DS-17, DS-18.
- [11-ui.md](../proteus-playbook/11-ui.md) (UI-11, UI-23), [16-antipatterns.md](../proteus-playbook/16-antipatterns.md) (E–G),
  [OPTIMIZATION.md](../proteus-playbook/OPTIMIZATION.md), [kit/README.md](../proteus-playbook/kit/README.md).

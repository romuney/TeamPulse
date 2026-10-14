# 03. JS кастомного чарта Proteus

Кастомный чарт (`react_sanbbox`, тип ECHARTS) — JS, который песочница исполняет в iframe **заново на каждый ответ
датасета**. ECharts — только пустой холст, всё видимое — свой HTML, CSS и SVG в overlay. Здесь — как писать код, который
переживает перезапуски, не гаснет, быстро разбирает ответ, сам называет ошибки поставки и уезжает к владельцу сжатым.
Вид — [01](01-design-system.md), датасет — [02](02-clickhouse-sql.md), CSS борда — [04](04-board-css.md), поведение —
[05](05-ux-patterns.md), поставка — [07](07-delivery-process.md). Коды (CJ-, SB-, MC-, DS-) — правила `../proteus-playbook/`.

## Главное

1. Каркас — копия шаблона скилла proteus-echarts-builder, БЛОКИ 1–7, только ES5; глобальный `option` с пустым scatter —
   последним выражением файла (CJ-01, CJ-02, CJ-04).
2. Состояние — в `window.__pvtState[ns]`; на перезапуске снимай глобальные слушатели, наблюдатели и таймеры; снаружи
   `mount()` — только `state.rerender` (CJ-05, CJ-06, CJ-08).
3. Любая ошибка окна гасит чарт: в начале `mount()` — `overflow:hidden` у `html`, `body`, хоста и обёртка `window.onerror`
   для «ResizeObserver loop» (SB-03).
4. Нет хранилища, сети, родителя, диалогов; связь — `postMessage`, буфер — `execCommand('copy')`; `innerHeight` и `100vh` —
   высота ячейки (SB-01, SB-05, SB-10).
5. Чарт сам называет ошибку поставки текстом (CJ-19).
6. Код едет в каждом POST `chart/data`: в поставке — terser 5.51.2 через `kit/min.cjs` с бюджетом; загрузчик кода из ответа
   запрещён (CJ-21, CJ-22).
7. Эмит — `IN`, строки, отсортированы, все носители одним вызовом, без `value: []`. Ожидание снимает ответ с эхом выбора,
   жёлтая плашка — с 45 с, без автоповтора по таймеру (MC-02, MC-04, MC-06…MC-08).

---

## 1. Среда

iframe `sandbox="allow-scripts"` без `allow-same-origin`, CSP `connect-src 'none'`, размер — ячейка. Глобалы скрипта:
`data` (строки ответа), `applyCrossFilter` (только на дашборде), `option` (пишешь ты).

| Нужно | Чего нет | Как |
|---|---|---|
| Помнить вид | `localStorage`, `sessionStorage`, `indexedDB`, `cookie` — SecurityError, чарт гаснет | `window.__pvtState[ns]` (живёт, пока жив iframe) |
| «Первый вход», пресет | Proteus вход не помнит | тур — кнопкой; пресет — ссылка и закладка (SB-02) |
| Данные | `fetch`, XHR, WebSocket — CSP | только ответ своего датасета |
| Сосед | `parent.document`, `top.location` — SecurityError | `postMessage` обходом `window.top.frames` в `try` (MC-12) |
| За ячейку | родителя не достать | канал скриншотов + CSS борда (SB-11) |
| Спросить, предупредить | `alert`, `confirm`, `window.open` молча не работают | своя модалка или плашка |
| Копировать | `navigator.clipboard` — NotAllowedError | `textarea` + `execCommand('copy')` в жесте клика (SB-10) |
| Шрифт | `@font-face`, `<link>`, CDN | системный стек из 01, явно в каждом слое `body` |
| «По экрану» | `innerHeight`, `100vh` = ячейка (до 1 400 px) | видимая часть (IntersectionObserver); высота ряда — CSS борда (SB-05, SB-06) |
| Адрес борда | `location` — не борд | `document.referrer`, запасной — `meta` (SB-17) |
| Необязательный API | `ResizeObserver`, `animate`, `matchMedia`, `TextDecoder` | `typeof … !== 'undefined'` или `try`; у промиса — отказ (SB-04) |

**Ошибки окна.** Песочница делает `chart.clear + dispose` на любую ошибку окна, даже на «ResizeObserver loop
completed…», которую на Windows даёт полоса прокрутки документа iframe при сужении. Первая строка `mount()` после выбора
хоста:

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
> копируй: обёртку и видимую часть добавляй (образец — TeamPulse `proteus/prelude.js`, HRBP HUB `visV`).

**Видимая часть.** Модалку, вертикаль тултипа, карточку тура, «не выше экрана» ставь по `visV()` — линейке полос по 24 px
под IntersectionObserver без `root` (код — SB-05). Видно < 120 px или колбэка ещё не было — всё окно; `resize` — линейку
заново. Колесо мыши не блокируй: страницу борда листают над iframe (SB-07).

---

## 2. Каркас и жизненный цикл

**ES5.** Можно: `var`, `function`, конкатенация, `try/catch`, циклы, `forEach`, `JSON`, `atob`, `TextDecoder`. Нельзя:
`let`/`const`, стрелки, backtick, `class`, деструктуризация, spread, `import`/`require`, `fetch`, внешние URL, `console.*`,
`eval`, `new Function`, строка в `setTimeout`, `getElementById` (после перезапуска находит старые узлы — ищи
`overlay.querySelector`). Вместо голых `parent`, `top`, `self` пиши `window.top`, `window.parent`. Современный JS макета
переводит в ES5 Babel, не руки (раздел 5).

**БЛОКИ.** Болванку создаёт `python3 <скилл>/bootstrap.py <папка>` (скилл — `romuney/adoption`, ветка `new`,
`skills/proteus-echarts-builder/`, коммит `e77d754`). Блоки 2, 6, 7 — дословно, правка в `[ЗАПОЛНИ]`; служебные `getTip`,
`showTip`, `hideTip`, `render`, `trigger` не переименовывай и не дублируй (CJ-01).

| Блок | Что | |
|---|---|---|
| 1 `CFG` | `ns`, `fields`, `order`, тексты, токены цвета, кегли, пороги | свободен |
| 2 Вход и состояние | `rawData`, `state`, `esc`, `num`, `toDate`, реестр слушателей | дословно + свои хелперы |
| 3 `buildModel` | проверки поставки, разбор, производные, порядок | свободен |
| 4 Формат | `nf`, `pct`, `plural`, шкалы цвета | свободен |
| 5 Разметка | `buildCSS()` (селекторы от `'.' + CFG.ns`), `buildHTML()` (префикс без точки) | свободен |
| 6 Монтаж | хост, overlay, тултип в `body`, `render`, `relayout`, делегирование | дословно + `[ЗАПОЛНИ]` |
| 7 `option` | пустой scatter, глобально, последним | дословно |

Отступления от шаблона по гайду (`guardWindow`, `visV`, отложенный `relayout`, тултип за курсором) записывай в NOTES чарта
с кодом правила.

**Монтаж (CJ-03).** Внутри одного `try` самовызывающейся `mount()`: последний `[_echarts_instance_]` → `guardWindow` →
`canvas` — `display:none` → старый `.<ns>-overlay` удалить → хост `relative` → новый overlay → ровно один `render()`.
`catch` пишет «Ошибка графика: …» в overlay своего хоста и к `option` не обращается.

**`option` (CJ-04).** Вне функций, последним, синхронно, после — не трогать. До него ничего не жди (`Promise`,
`setTimeout`): песочница читает его сразу. `option` с данными — ECharts рисует поверх overlay.

```js
option = { animation: false, xAxis: { show: false, type: 'value' }, yAxis: { show: false, type: 'value' },
  series: [{ type: 'scatter', data: [] }] };
```

**Состояние (CJ-05).** Всё, что читает разметка (вкладка, выбор, страница, ожидание, кэш разбора), — в `state`. Обработчик
пишет в `state` и зовёт `render()`, `buildHTML()` сам ставит активный класс; `classList.add` мимо `state` живёт до первой
перерисовки. Новые ключи доливай на каждом запуске: новая версия скрипта стартует поверх старого состояния.

```js
if (!window.__pvtState) window.__pvtState = {};
var STATE0 = { view: 'main', tip: null, page: 0, pend: null, warn: '', drawn: {}, cache: {}, listeners: [] };
var state = window.__pvtState[CFG.ns] || (window.__pvtState[CFG.ns] = {});
for (var k0 in STATE0) if (STATE0.hasOwnProperty(k0) && !state.hasOwnProperty(k0)) state[k0] = STATE0[k0];
```

> ⚠ Adoption доливает часть ключей руками, шаблон — не доливает. Пиши цикл по `STATE0`.

**Перезапуск (CJ-06, CJ-08).**
- Слушатели overlay — **безусловно**, делегированием, один раз снаружи `render()`: overlay каждый раз новый. Флаг «уже
  навешено» из `state` тут — интерактив пропадает со второй отрисовки.
- Глобальные (`window`, `document`) — через реестр `listen()` / `cleanup()` (раздел 8); первая строка обработчика —
  `if (!overlay.parentNode) return;`.
- `ResizeObserver`, `IntersectionObserver` — `disconnect()`, таймеры — `clear*`, всё по ссылке из `state`.
- Слои в `body` (тултип, линейка, тур, выпадашка) — удалить старый `body > .<ns>-…`, создать новый (SB-09).
- Снаружи `mount()` (таймер ожидания, канал) — только `if (state.rerender) state.rerender();`. Прямой `render()` —
  ReferenceError, чарт погас.

**`render()` и `relayout()` (CJ-07).** `render()` — запомнить прокрутку и фокус → `overlay.innerHTML = buildHTML()` →
вернуть → `renderTip()`. `relayout()` — только габариты: класс `<ns>-narrow` по `overlay.clientWidth` (не `@media`), SVG
`[data-cw]` по месту при смене ширины > 2 px; `render()` не зовёт. `ResizeObserver` на хосте откладывает `relayout` на
150 мс; синхронная правка размера в колбэке — та самая петля RO. Ложный FAIL C4 скилла оспаривай, код не меняй.

---

## 3. Где и как рисовать

ECharts в обоих проектах — пустой холст. TeamPulse рисует без библиотек и в макете, и в чарте (`draw.js`: SVG по
`clientWidth`). В Adoption макет рисует ECharts (`vendor/echarts`), а виджеты перерисовывают те же графики своим SVG.
Инстанс ECharts в чарте не создавай: `option` с данными ложится поверх overlay, канвас не берёт шрифт, тултип и анимацию
профиля (CJ-09).

| Что | Чем |
|---|---|
| Таблица, дерево, KPI, пилюли, плашки | HTML-строка в overlay |
| Линии, бары, стек, воронка, когорты, календарь | SVG строкой: `width = W` измеренной ширины, `viewBox="0 0 W H"` (1:1) |
| Спарклайн без подписей | SVG `viewBox` + `width:100%` |
| Тултип, линейка, тур, выпадашка | слой в `body`, создаётся один раз |

`viewBox` + `width:100%` у SVG с подписями растит кегль вместе с ячейкой (11 → 20+ px). В разметке — плейсхолдер
`<div data-cw="вид" data-ci="N">`, после вставки меряй ширину и рисуй в пикселях; реестр `{kind, key, draw(width)}` даёт
`relayout()` перерисовать по месту.

**Дёшево:**
- **Один проход — одна вставка.** Разметка — массив строк, `h.join('')`, один `innerHTML`. Не `createElement` на ячейку.
  `DocumentFragment` — только чтобы дописать узлы в живой контейнер, который нельзя пересоздать («Показать ещё»).
- **Сначала замеры, потом запись.** Все `clientWidth` — одним проходом после вставки, затем отрисовка; чередование
  «замер → запись» пересчитывает раскладку на каждом шаге.
- **Делегирование.** `mouseover`, `mouseout`, `click` на overlay + `trigger(e.target, 'data-…')`. Триггеры — ровно
  `data-tip`, `data-kind`, `data-action`, `data-view`, без префикса (CJ-14).
- **Наведение не перерисовывает.** `mousemove` двигает тултип, `innerHTML` тултипа — только при смене цели. Тултип за
  курсором, гаснет в пустоте через 110 мс, на `mouseout` документа без `relatedTarget`, `blur`, прокрутке (CJ-11, CJ-12).
- **Ввод — точечно.** Поиск обновляет `[data-tbox]`, `[data-tcount]`, страницы; поле не пересоздаётся; дебаунс 120 мс (CJ-13).
- **Ресайз и прокрутка — с задержкой.** RO → `setTimeout(relayout, 150)`; `resize` окна — 140–150 мс; `scroll` →
  `requestAnimationFrame` с флагом.
- **В DOM — страница.** 50–100 строк; поиск, сортировка, «Копировать» — по модели (CJ-15).
- **Анимация — первый показ** новых данных: ключ в `state.drawn`, не на ресайз и наведение, `prefers-reduced-motion` —
  без неё (CJ-10).

---

## 4. Данные

Обёртка Proteus — `SELECT <Измерения> FROM (датасет) AS virtual_table GROUP BY <Измерения> LIMIT 50000`: строки уникальны,
**порядок не держится**, обрезка молчит. Поля нет в «Измерениях» — его нет в `data` (DS-24, DS-25).

1. Весь массив: `var rawData = (typeof data !== 'undefined' && Array.isArray(data)) ? data : [];`, не `data[0]`.
2. Первым делом — проверки поставки (раздел 8): колонки, `meta`, `ok`, версия, число строк.
3. Строки — по роли (`role` / `section`), не по индексу. Порядок — в JS: номер пачки, ключ, `CFG.order` из макета.
4. Распаковка — один раз:
   - `k` с переводами строк, поля через `|` или `\t` — `split`; пустая строка — ноль строк, не `['']`;
   - ряды `'1,5,0,…'` — массив фиксированной длины сетки календаря;
   - кириллица тяжёлых ответов — `atob` + `TextDecoder('utf-8')` или словарь сжатия датасета (`unz` у Adoption); свой
     посимвольный base64 съедал 8,9 с из 9,4 (CJ-18);
   - JSON из `meta` — в `try`; числа — `num()`, даты — `toDate()` шаблона; дата свежести — из ответа, не `new Date()` (DS-07).
5. Доли, проценты, ранги, дельты, итоги — в JS из аддитивных компонентов (DS-04).
6. Модель — в кэш по отпечатку: перезапуск с тем же `data` на каждый ресайз не должен разбирать заново (CJ-17).

```js
var fp = (meta.rq || '') + '|' + rawData.length + '|' + heavyLen + '|' + sigOf(echo);
if (!(state.cache.m && state.cache.m.fp === fp)) state.cache.m = { fp: fp, model: parseAll() };
```

Необязательные колонки новой поставки читай мягко: нет — метрика «демо», без плашки (TeamPulse `OPT` в `real.js`).

---

## 5. Вес кода и сборка

Код чарта лежит в `form_data.jsx` **каждого** POST `chart/data`: открытие, «Применить», кросс-фильтр, даже ответ из кэша.
Отправка у владельца ≈50 КБ/с: **каждые 50 КБ — плюс секунда на каждом действии** (CJ-21).

- **Поставка — сборка terser 5.51.2** через `kit/min.cjs`: `ecma 5`, верхний уровень не трогается, `ascii_only:false`,
  шапка-штамп; −40–45 % при том же поведении. Версию закрепи (`npm i -g terser@5.51.2`), иначе `--check` сборщика
  расходится.
- **Исходник — в репозитории, сборка — скриптом** (`.stand/pack.py`, `proteus/build.js`), руками не правится; в шапке —
  «СОБРАН АВТОМАТИЧЕСКИ», путь исходника, sha12. Сборка — одна строка: проси у владельца текст ошибки целиком.
- **Бюджет — флагом** `--budget N` (КиБ). Поднял — комментарий в сборщике: дата, на что ушло, сколько секунд. На 14.10:
  Adoption — шапка 43 КБ, каталог 105, панель 179 при бюджете 200; TeamPulse — ≈393 КиБ при бюджете 400 (≈8 с на запрос).
  > ⚠ OPTIMIZATION.md и CJ-21 пишут для TeamPulse 333–340 КиБ (09.10); с 12–13.10 сборка выросла на русских текстах
  > выводов (строки terser не сжимает). Действует бюджет 400 из `build.js`; первый кандидат на сжатие — маскот (≈72 КиБ).
- **Строки весят как есть.** CSS в строке — `--css-var ИМЯ` или `cssMin()`; картинка base64 — размер × 4/3 в каждом запросе:
  WebP q80 в 2× показанного или вон из сборки.
- **Мёртвое — вон.** Онбординг по `localStorage`, `location`, `history` выкидывай из Proteus-сборки, не выключай флагом.
- **Загрузчик кода из ответа запрещён.** `new Function`, `eval`, `<script>` из ответа уже сломали все JS-чарты борда (CJ-22).
- **Макет на ES2015+** (TeamPulse): каждый модуль — своей функцией в общем `try` с текстом в хосте → Babel `preset-env`
  (`targets: {ie: '11'}`, `useBuiltIns: false`, `comments: false`) → acorn `ecmaVersion: 5` → запреты вне строк → `option`
  последним → terser с бюджетом (CJ-23).

---

## 6. Кросс-фильтры и несколько чартов

**Эмит (MC-02…MC-05).**
- `applyCrossFilter([{column, operator: 'IN', value: [строки]}])`. Без `operator` — 400 у **всех** получателей.
- Значения — `String(v)`, без `null` и `''`, **отсортированы** (порядок входит в ключ кэша). Пустой набор — колонку не шли:
  `value: []` роняет запрос получателя. Сброс — `applyCrossFilter([])`.
- Все носители — **одним вызовом**: маска заменяется целиком. Порядок носителей постоянный.
- Умолчание и повтор той же маски не шли: другой ключ — холодный запрос того же ответа; повтор Proteus может не
  перезапросить.
- Серия кликов без «Применить» — один эмит через 300 мс после последнего; с «Применить» — `state.stage` и один эмит.
- Носитель — основа + суффикс вкладки (`flt_f` / `flt_kf`), суффикс — из `meta`; в SELECT и «Измерения» не попадает (SP-14).
- Нет `applyCrossFilter` — сразу плашка «Открой чарт на дашборде: фильтры работают только там».
  > ⚠ Adoption здесь молча выходит из `emit()`. Пиши плашку, как TeamPulse.

**Ожидание (MC-06…MC-08).**
- Датасет отдаёт в `meta` эхо **применённого** (после своих проверок). Подпись — одинаково в SQL и JS: колонки по алфавиту,
  значения отсортированы, `"`, `\`, переводы строк выкинуты.
- После эмита `state.pend = {sig, at}`, отчёт приглушён (`opacity:.55`), данные на месте. Снимает **только** ответ с эхом
  `=== sig`.
  > ⚠ TeamPulse снимает ожидание любым ответом. Правило — сверка по эху.
- «Обновляю данные… N с» — секунды текущего запроса со 2-й; `setInterval` 1 с правит только `[data-pendt]`.
- Жёлтая плашка — с 45 с (`CFG.pendingWarnMs`), с причиной и пунктом инструкции (области кросс-фильтров в JSON-метаданных
  или «ответ ещё придёт»).
- По таймеру не повторяй. Автоповтор — только если пришёл ответ под **прежний** выбор, а нужного нет 10 с, не больше 2 раз:
  та же маска + фиктивный носитель-`nonce`. 60 с тишины — кнопка «Повторить запрос».
- `armPend()` переживает перезапуск: остаток считает от `state.pend.at`, по истечении зовёт `state.rerender`.

**Несколько чартов (MC-09…MC-16).**
- Области кросс-фильтров — JSON-метаданными по готовому блоку поставки, не мышкой.
- Канал — `postMessage` обходом `window.top.frames` (глубина ≤ 5, свой `window` пропусти, всё в `try`). Сообщение
  `{type, v, src, sheet | cf}`; чужие тип, вкладку, суффикс, версию — отбрасывай. Слушатель `message` — через реестр.
- Ключ нового выбора шли соседям сразу, до ответа Proteus. Получатель просит (ASK) и переспрашивает раз в 1,5 с,
  отправитель отвечает всегда, у получателя — таймаут с текстом причины.
- Протокол канала меняй во всех участниках одной поставкой, версия `v` — в каждом сообщении.

---

## 7. Стиль кода

Образец — виджеты Adoption `Виджеты/pa-*.chart.js`; сборка из макета — TeamPulse `proteus/`.

- **Шапка файла:** что за чарт, датасет и колонки, какие носители слушает и пишет, откуда сборка; контракт и запреты из
  шаблона.
- **Константы — в начале, в `CFG`:** `ns`, `fields`, `order`, `views`, `text`, `colors`, `fonts` (роли кеглей),
  `spacing`, пороги (`selDelay`, `pendingWarnMs`, `pageSize`). В разметке нет литералов цвета и кегля мимо `CFG`. У
  числа — комментарий «почему так».
- **Имена:** `CFG`, `STATE0`, `state`, `rawData`, `MODEL` — как в шаблоне; модульные константы — `ВЕРХНИМ` (`THIN`,
  `MONTHS`, `VIS_STEP`); функции — глагол + объект (`buildModel`, `parseListPack`, `renderTip`, `maskOf`, `sigOf`,
  `armPend`, `copyText`); общие функции канала — с префиксом проекта (`paBcast`). Классы — `CFG.ns + '-…'`.
- **Одна функция — один тип входа** (`cutName(строка)` ≠ `trName(объект)`); перед сменой сигнатуры — `grep` вызовов (CJ-16).
- **Всё из данных — через `esc()`**, и в атрибутах тоже.
- **Комментарии** — по-русски, о причинах, с кодом правила или датой решения владельца. Тексты интерфейса — в `CFG.text`.
- **Форматеры — БЛОК 4:** разряды U+2009, минус U+2212, запятая, «—» на `null`/`NaN`. Пиши escape (`' '`), не
  литерал: редактор и копипаст подменяют его обычным пробелом.
  > ⚠ В 9 из 10 виджетов Adoption и в сборке поставки 14.10 `THIN` — обычный пробел (0x20): число рвётся переносом. Берёшь
  > код оттуда — замени на `' '`.

| | Макет | Чарт Proteus |
|---|---|---|
| Синтаксис | ES2015+ (`const`, стрелки, шаблоны) | ES5 (руками или Babel) |
| Файлы | модули + `index.html` | один файл: исходник + сжатая сборка |
| Состояние | переменные, `localStorage` | `window.__pvtState[ns]` |
| Корень | `document`, `#view` | overlay последнего хоста |
| Слушатели | один раз | реестр со снятием на каждом запуске |
| Данные | генератор | `data` + проверки поставки |
| `100vh` | экран | ячейка |

---

## 8. Сниппеты

### Скелет (схема; болванка — только `bootstrap.py`)

```js
// <name>.chart.js — <что>. Датасет <имя>: role · k · v · n. Пишет: <x_f>. Сборка: <команда>.
// ---------- БЛОК 1: CFG ----------
var CFG = {
  ns: 'xx', ver: 3,                                    // ver — контракт ответа, сверка с meta.ver
  fields: { role: 'role', k: 'k', v: 'v', n: 'n' },
  rowLimit: 50000, pendingWarnMs: 45000, selDelay: 300,
  text: {}, colors: {}, fonts: { family: 'Arial,Helvetica,sans-serif' }   // токены и кегли — из 01
};
// ---------- БЛОК 2 ---------- rawData, STATE0 + долив, esc/num/toDate из шаблона, listen/cleanup
// ---------- БЛОК 3 ----------
function buildModel() {
  var chk = checkInput(rawData);                        // ошибки поставки — первыми
  return chk.err ? chk : { meta: chk.meta, warn: chk.warn, rows: parseRows(chk.meta) };
}
var MODEL = buildModel();
// ---------- БЛОК 4 ---------- nf, pct, plural
// ---------- БЛОК 5 ---------- buildCSS(); buildHTML(): if (MODEL.err) return errorHTML(MODEL);
// ---------- БЛОК 6 ----------
(function mount() {
  try {
    var hosts = document.querySelectorAll('[_echarts_instance_]');
    if (!hosts || !hosts.length) return;
    var host = hosts[hosts.length - 1];
    guardWindow(host);
    cleanup();
    var cvs = host.querySelectorAll('canvas');
    for (var i = 0; i < cvs.length; i++) cvs[i].style.display = 'none';
    var prev = host.querySelector('.' + CFG.ns + '-overlay');
    if (prev) prev.parentNode.removeChild(prev);
    var overlay = document.createElement('div');
    overlay.className = CFG.ns + '-overlay';
    overlay.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:10;overflow:auto;box-sizing:border-box;';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(overlay);
    // getTip/showTip/hideTip/renderTip/trigger — из шаблона; вертикаль showTip — по visV()
    function render() { /* прокрутка → innerHTML = buildHTML() → прокрутка, фокус → renderTip() */ }
    function relayout() { /* -narrow по clientWidth, SVG [data-cw] по месту */ }
    state.rerender = render;
    overlay.addEventListener('mouseover', onOver);      // безусловно: overlay новый
    overlay.addEventListener('mouseout', onOut);
    overlay.addEventListener('click', onClick);
    listen(window, 'message', function (e) { if (!overlay.parentNode) return; /* … */ });
    render();
    if (typeof ResizeObserver !== 'undefined') {
      state.ro = new ResizeObserver(function () { clearTimeout(state.roT); state.roT = setTimeout(relayout, 150); });
      state.ro.observe(host);
    }
    armPend();                                          // ожидание переживает перезапуск
  } catch (e) {
    var hs = document.querySelectorAll('[_echarts_instance_]');
    var box = hs.length ? hs[hs.length - 1].querySelector('.' + CFG.ns + '-overlay') : null;
    if (box) box.innerHTML = '<div style="padding:16px;font:13px Arial,sans-serif;color:#b00020">Ошибка графика: '
      + esc((e && e.message) || e) + '</div>';
  }
})();
// ---------- БЛОК 7 ---------- option = { … пустой scatter … };
```

### Снятие слушателей

```js
function listen(target, type, fn, opt) {               // БЛОК 2: всё глобальное — только так
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
function plural(n, one, few, many) {
  n = Math.abs(Math.round(n)); var a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : (a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many);
}
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
  cut: 'Ответ обрезан: пришло меньше строк, чем отдал датасет. Поставь лимит строк 50 000 (п. N).'
};
function errorHTML(m) {
  return buildCSS() + '<div class="' + CFG.ns + '-empty">'
    + esc((ERR_TEXT[m.err] || 'Ошибка данных') + (m.missing ? m.missing.join(', ') : '')) + '</div>';
}
```

Номера пунктов — из «0. Инструкция.md». Ключ, которого старый датасет не знает, читай с запасным значением: владелец ставит
файлы не одновременно, «новый JS + старый SQL» не должен давать пустоту.

> ⚠ TeamPulse ловит обрезку по строке `end`, а под `GROUP BY` она может уцелеть. Пиши `meta.rows` против `data.length`
> и запасной признак `data.length ≥ лимита` (DS-25).

---

## 9. Паттерны и антипаттерны

| ✅ Делай | ❌ Не делай | Почему |
|---|---|---|
| Копия шаблона, правка в `[ЗАПОЛНИ]` | Каркас «своими словами» | 4 ч и 10 FAIL на переписанном (CJ-01) |
| `option` глобально, последним, пустой | `option` в IIFE, с данными, после `await` | «option is not defined», график поверх overlay (CJ-04) |
| Выбор в `state` | `classList.add`, локальная `var` | Сброс после перерисовки (CJ-05) |
| Overlay — безусловно; глобальные — реестр | Флаг «уже навешено» для overlay | Со 2-й отрисовки нет интерактива (CJ-06) |
| Снаружи — `state.rerender` | `render()` с верхнего уровня | ReferenceError, чарт погас (CJ-08) |
| `guardWindow` до разметки | Прокручиваемый документ iframe | Чарт исчезает на Windows (SB-03) |
| `visV()` | `innerHeight`, `100vh` как экран | «Применить» за краем экрана (SB-05) |
| RO → отложенный `relayout()` | `render()` из RO | Мигание, петля RO (CJ-07) |
| SVG 1:1 по ширине | `viewBox` + `100%` с подписями | Кегль растёт с ячейкой (CJ-09) |
| Наведение двигает тултип | `render()` на `mouseover` | Тултип моргает (CJ-11) |
| Точечно на ввод, возврат прокрутки | `render()` на букву | Каретка и прокрутка теряются (CJ-13) |
| В DOM — страница | Все строки + `display:none` | Секунды на `render()` (CJ-15) |
| Разбор один раз, `atob` + `TextDecoder` | Разбор на перезапуске, свой base64 | Ресайз тормозит, разбор — секунды (CJ-17, CJ-18) |
| Ошибка поставки текстом с пунктом | Пустая ячейка, молчаливый `catch` | Круг переписки с владельцем (CJ-19) |
| terser с `--budget` | Исходник с комментариями в поставке | +секунды на каждом действии (CJ-21) |
| Код целиком в поле JS | Загрузчик из ответа | Сломались все чарты борда (CJ-22) |
| `IN`, строки, сортировка, один вызов | Без `operator`, `value: []`, вызов на носитель | 400 у получателей, маска стёрта (MC-02) |
| Сверка по эху, плашка с 45 с | Ожидание до любого ответа, плашка с 9 с | Старые данные, ложная тревога (MC-06, MC-07) |
| Повтор только по ответу под старый выбор | Повтор по таймеру | Обрыв долгого запроса (MC-08) |
| `execCommand('copy')` первым | Clipboard API первым, «Скопировано» до результата | Ошибка в консоли, подпись врёт (SB-10) |
| Своя модалка | `confirm`, `alert` | Молча не работают (SB-01) |

---

## 10. Чек-лист перед сдачей

`<playbook>` — `../proteus-playbook`, `<скилл>` — клон `romuney/adoption`, `skills/proteus-echarts-builder`. Запуск — из
корня репозитория.

1. `node --check proteus/<name>.chart.js`.
2. ESLint — 0 ошибок: `node $(npm root -g)/eslint/bin/eslint.js -c <playbook>/kit/eslint.chart.cjs --no-config-lookup
   proteus/<name>.chart.js`. «File ignored…» — провал. Предупреждения о `localStorage`, `fetch`, `location`, `alert`,
   `console` — убрать.
3. Скилл по **исходнику**: `NODE_PATH=$(npm root -g) python3 <скилл>/check.py proteus/<name>.chart.js` (validate + smoke).
   FAIL — гипотеза; ложные C4, K3b, S11a, S20 — `--accept 'КОД=причина'`, не больше двух за сдачу.
4. Сборка: `NODE_PATH=$(npm root -g) node <playbook>/kit/min.cjs '<шапка>' --check --budget <КиБ> < <исходник> > <файл>`
   (или сборщик проекта; код выхода — до записи).
5. `node <playbook>/kit/min.cjs --verify '<файл поставки>'`; `grep -c 'new Function\|eval(\|<script\|localStorage'` — 0.
6. Модель песочницы на **сборке**: `NODE_PATH=$(npm root -g) node <playbook>/kit/sbx/run.cjs <сборка> <mock.json>
   --css <CSS борда> --clicks <сценарий>` со всеми контролами и сужением окна, ещё раз с `--catch listener`. Код 1 — в бою
   чарт погас бы.
7. Smoke проекта на ответе стенда (TeamPulse — `node proteus/smoke_real.js ответ.json`, Adoption — `.stand/wstand.mjs`):
   три перезапуска — один overlay, один тултип в `body`, клик срабатывает один раз.
8. Испорченные ответы: без колонки, без `meta`, урезанный, прошлой поставки — видимый текст с пунктом, консоль чистая.
9. Эмиты по шпиону `sbx/run.cjs`: `IN`, непустые отсортированные строки, один вызов на действие, умолчание не шлётся;
   задержка 20 с — секундомер без плашки, 45 с — плашка.
10. В NOTES и сводке: синтаксис, ESLint, вердикт `check.py` с оспоренными кодами, модель песочницы, `--verify`, размер
    «было → стало, ≈ с отправки».

---

## Где подробнее

- [SKILL.md](../proteus-playbook/SKILL.md) — «Не ломать никогда», п. 18–28.
- [07-chart.md](../proteus-playbook/07-chart.md) — каркас (CJ-01…CJ-04), цикл (CJ-05…CJ-08), отрисовка (CJ-09…CJ-16),
  данные (CJ-17…CJ-19), проверка (CJ-20), сборка (CJ-21…CJ-23), «Где гайд уточняет скилл».
- [08-sandbox.md](../proteus-playbook/08-sandbox.md) — факты S1–S15, ошибки окна (SB-03, SB-04), видимая часть (SB-05),
  буфер (SB-10), выход за ячейку (SB-11…SB-16), ссылки (SB-17, SB-18), модель песочницы (SB-20).
- [09-multi-chart.md](../proteus-playbook/09-multi-chart.md) — эмит (MC-02…MC-05), эхо и ожидание (MC-06…MC-08),
  области (MC-09, MC-10), канал (MC-12…MC-16).
- [05-dataset.md](../proteus-playbook/05-dataset.md) — `meta` и целостность (DS-03, DS-25), упаковка (DS-17, DS-18).
- [11-ui.md](../proteus-playbook/11-ui.md) — тултип (UI-11), без сдвига вёрстки (UI-15), ожидание (UI-23).
- [16-antipatterns.md](../proteus-playbook/16-antipatterns.md) — разделы E–G.
- [OPTIMIZATION.md](../proteus-playbook/OPTIMIZATION.md) — «долго грузится»: пять слагаемых времени.
- [kit/README.md](../proteus-playbook/kit/README.md) — `min.cjs`, `eslint.chart.cjs`, `sbx/run.cjs`, `board-check.js`.

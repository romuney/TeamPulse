# 04. CSS борда Proteus

Чарт живёт в iframe-песочнице и до страницы не дотягивается: рамки, шапку Proteus, заглушки, вкладки, поля, высоту
ряда, развороты и затемнение тура делает **только CSS дашборда** («Редактировать дашборд → CSS»). Proteus — форк
Superset **2.1.0**; карта DOM в гайде — по 2.0.1, отличия помечены «2.1.0».

## Главное

1. CSS борда — **самодостаточный файл поставки**. Вставляется целиком вместо прежнего блока своего отчёта, не дельтой.
2. Правила — **только на свои чарты**: ячейку узнавай по классу холдера `.dashboard-chart-id-N` (он есть и на загрузке),
   iframe — по `#chart-id-N`. id в исходнике — числовые заглушки, боевые подставляет сборщик.
3. **Числа не угадывай:** геометрию и классы снимай сниппетом DevTools с живой страницы. Поля, высоту ряда и ширину
   выбирает владелец, его числа — в одном месте файла.
4. Растяжку iframe и разворот ставь **только в паре** с `overflow:hidden` и обёрткой `window.onerror` в чарте (SB-03),
   иначе на Windows чарт гаснет.
5. Шрифт всего, что рисует CSS борда, — **`Arial, Helvetica, sans-serif`**, веса 400 и 700.

## 1. Файл и поставка (BC-01, BC-20, BC-21)

**Блоки** закреплены за назначением навсегда, инструкция ссылается на номер («число в блоке 7»): 1 — ячейки,
2–3 — развороты, 4 — загрузка, 5 — вкладки, 6 — поля и ширина, 7 — высота ряда, 8 — тур (раздел 4).

**Шапка файла:** первая строка `/* ==== <ОТЧЁТ> — CSS борда · НАЧАЛО блока отчёта ==== */`, последняя — `… КОНЕЦ …`;
карта блоков; какие id подставлены, какие заменить руками; строка «Красные „!“ редактора у `:has(…)`, `:not(… *)`,
`max(…)` — линтер их не знает, на работу не влияет».

**Инструкция владельцу.** «Удалите прежний блок (от НАЧАЛО до КОНЕЦ) → вставьте файл целиком в конец → Сохранить →
Cmd/Ctrl+Shift+R». Чужой CSS не трогать.

**Заглушки id** — шесть цифр, уникальных в тексте: `100001`, `100002`… Цвета пиши `#fff`, `rgb()` или с буквами
(`#111111` совпадёт с заглушкой). Буквенные `ID` / `12345` не бери: Ctrl+H заденет `dashboard-chart-id-` и `GRID_ID`.

**Сборка.** Исходник — `proteus/<отчёт>.board.css`, поставку собирает `kit/pack_template.py` (вид `css`): подставляет
`BOARD_IDS`; падает на неуникальной или оставшейся заглушке и на боевом id в исходнике; чарт без id оставляет заглушкой
и просит в шапке заменить руками. Файл поставки руками не правь; правки владельца на борде — в исходник (DV-35).

**Образец** — `../proteus-playbook/templates/board.template.css`: блоки 1–8 с комментариями. Сверь его с пометками
«2.1.0» и «Arial» ниже.

## 2. DOM и селекторы (BC-23)

```
header#main-menu                              ← меню 48 px; страница прокручивается блоком под ним (2.1.0)
div.dashboard[.dashboard--editing]            ← режим правки
 ├ .dashboard-header-container / .header-with-actions   ← липкая шапка борда ~64–65 px
 └ .grid-container > … .grid-content > .dragdroppable-row > … .grid-row > .dragdroppable-column
    └ .resizable-container                    ← высота инлайном, единицы × 8 px
       └ .dashboard-component-chart-holder.dashboard-chart-id-N   ← поле 16, белый фон, рамка 2 px
          └ .chart-slice (display:block у форка)
             ├ [data-test="slice-header"] > .header-title + .header-controls («⋯»)
             └ .dashboard-chart > .chart-container (+ img.loading) > .slice_container (EmptyState)
                └ div > #chart-id-N / .react_sanbbox > iframe   + img.echarts-plugin
```

Класс `dashboard-chart-id-N` стоит **на самом холдере** с первой секунды. `#chart-id-N` до первой отрисовки может не быть.

**2.1.0 (Adoption, разведка 09.10).** Класса `.chart-header` у шапки чарта нет — только `[data-test="slice-header"]` с
`margin-bottom:4px`. Гайд и шаблон пишут `.chart-header`; пиши оба: `:is(.chart-header, [data-test="slice-header"])`.

- **Опора:** холдер и `.dashboard-chart-id-N`, `#chart-id-N`, `.react_sanbbox`, `.chart-slice`, `.dashboard-chart`,
  `.chart-container`, `.slice_container`, `.header-title`, `[data-test="slice-header"]`, `img.echarts-plugin`,
  `img.loading`, `.resizable-container`, `.grid-container`, `.grid-content`, `.dashboard-component-tabs`, `.ant-tabs-*`.
- **Только после сниппета:** `.dashboard--editing`, `.dashboard-header-container`, `#main-menu`; ключ форка
  `is_css_scoped` может отрезать селекторы вне сетки.
- **Нельзя:** emotion-классы `css-…`; цепочки через `>`; `.dashboard-chart-id-N .dashboard-component-chart-holder` и
  `…holder:has(.dashboard-chart-id-N)` — класс на самом холдере, ничего не выберут.

**Специфичность и `!important`.**
- `!important` — норма (форк сам с ним); при `!important` с обеих сторон решает вес, при равном — порядок.
- `:not(#xx-…)` (такого id нет) даёт вес 1,0,0, больше любой цепочки классов форка (до 0,7,1). `xx` — префикс отчёта.
- `:is()` весит как самый сильный аргумент. `:is(.dashboard-chart-id-N, :has(#chart-id-N))` весит как id и перебивает
  `.fade-out` владельца.
- Слой разворота держи с `#chart-id-N`: иначе база `#chart-id-N iframe {width:100% !important}` его перебьёт (BC-09).
- Составной селектор с `:has()…:not()` пиши **одной строкой**: перенос перед `:not` становится пробелом-потомком.
- `:has()` нужен Chromium 105+, Safari 15.4+ или Firefox 121+.

## 3. Замер: сниппет DevTools (BC-22)

**Файл поставки** — «N. Проверка на бою — разметка борда (DevTools).js». Основа — `kit/board-check.js`, собирается
видом `snippet`. Заполни `CHART_IDS` (заглушки, каждая один раз), `EXPECT` (числа блоков 5–7), `VH_TOL` = 2, `CSS_NAME`.

**Добавь из сниппета Adoption** (в kit этого нет): поправку на прокрутку блока под меню, низ липкой шапки (VIS,
раздел 4.6), масштаб браузера, число правил CSS, принятых браузером.

**Требования.** ES5, IIFE, только чтение (`getBoundingClientRect`, `getComputedStyle`, `styleSheets` в try/catch), один
`console.log`. Вывод — «замер · цель — N», готовое «замените 201 на 189 (Ctrl+H)», цепочка ячейки вверх (главный
источник правды о классах форка) и `ИТОГ`.

**Шаги владельцу.** Борд не в режиме правки → F12 → Console, контекст «top» → вставить (Chrome попросит
`allow pasting`) → Enter → прислать вывод целиком. Новый борд: сначала вывод и согласие на числа, потом поставка.

## 4. Типовые задачи

`H` ниже — база ячейки; в файле пиши её полностью:
`.dashboard-component-chart-holder:is(.dashboard-chart-id-100001, .dashboard-chart-id-100002, :has(#chart-id-100001, #chart-id-100002))`.

### 4.1. Без рамки, тени и заголовка, iframe на всю ячейку — блок 1 (BC-02…05, BC-25)

«Рамку» дают поле 16 px и белый фон холдера, шов между чартами выходит 48 вместо 16. Высоту iframe платформа пишет
атрибутом один раз и не пересчитывает.

```css
H { background-color: transparent !important; padding: 0 !important; border: 0 !important;
    box-shadow: none !important; outline: 0 !important; border-radius: 12px !important;
    height: 100% !important; display: flex !important; flex-direction: column !important; }
H .chart-slice, H .dashboard-chart, H .chart-container, H .slice_container, H .slice_container > div, H .react_sanbbox {
  display: flex !important; flex-direction: column !important; flex: 1 1 auto !important; min-height: 0 !important;
  padding: 0 !important; background: transparent !important; box-shadow: none !important; outline: 0 !important; }
.resizable-container:has(> .dashboard-component-chart-holder:is(.dashboard-chart-id-100001, .dashboard-chart-id-100002)) {
  box-shadow: none !important; outline: 0 !important; }
H .chart-container { background: #fff !important; border-radius: 12px !important; }  /* подложка = форма чарта */
H .header-title { display: none !important; }
H .chart-slice { position: relative !important; }
H :is(.chart-header, [data-test="slice-header"]) { position: absolute !important; top: 0 !important;
  right: 0 !important; z-index: 11 !important; margin: 0 !important; }               /* меню «⋯» — поверх */
#chart-id-100001 iframe, #chart-id-100002 iframe { display: block !important; flex: 1 1 auto !important;
  width: 100% !important; height: 100% !important; min-height: 0 !important; border: 0 !important; box-shadow: none !important; }
```

- Меню «⋯» (`.header-controls`) не прячь — оно нужно владельцу. С нативными фильтрами тень холдера оставь (фокус фильтра).

### 4.2. Загрузка — блок 4 (BC-06, BC-07)

```css
/* правила с .dashboard-chart-id-100001 повтори списком для каждого своего id */
.dashboard-chart-id-100001:not(:has(iframe)) .slice_container { visibility: hidden !important; }  /* «Не было получено…» */
.dashboard-chart-id-100001:not(:has(iframe)) .chart-container { position: relative !important; }
/* Adoption 09.10: до данных Proteus пишет высоту в px ещё здесь — иначе заглушка не тянется за рядом */
H:not(:has(iframe)) .slice_container { height: auto !important; }
H:not(:has(iframe)) .dashboard-chart > div:not(.chart-container) { height: 100% !important; width: 100% !important; }
.dashboard-chart-id-100001:not(:has(iframe)) .chart-container::after {
  content: 'Загружаю отчёт…'; position: absolute; left: 0; right: 0; top: calc(50% + 26px); text-align: center;
  font: 400 13px/1.4 Arial, Helvetica, sans-serif; color: #8a909c; pointer-events: none;
  animation: xx-load-pulse 1.6s ease-in-out infinite; }
/* низкая ячейка-шапка: top: calc(50% - 9px); left: calc(50% + 30px); right: auto; text-align: left */
@keyframes xx-load-pulse { 50% { opacity: .6; } }
/* значок Proteus поверх готового чарта — только если у чарта своя плашка пересчёта */
.dashboard-chart-id-100001:has(iframe) :is(img.loading, [aria-label="Loading"]) { display: none !important; }
```

- Своего кольца не рисуй. Датасет всегда отдаёт строку meta (DS-08), иначе ячейка вечно пишет «Загружаю…».
- Заглушка той же формы, что чарт, только при базе по классу, скруглении 12 и карточке чарта во всё окно iframe.

### 4.3. Фон и шрифт (BC-11, BC-16)

- **Фон** борда — `#f6f6f6` (`--dashboard-background`). В чарте документ прозрачный, карточки белые, радиус 12, без
  тени; свой серый холст даёт «заплатку». Под содержимым вкладок у Superset белый фон — зазоры белеют:
  `.dashboard-component-tabs:not(#xx-tabs) :is(.ant-tabs-content-holder, [role="tabpanel"]) { background: var(--dashboard-background, #f6f6f6) !important; }`
- **Шрифт** — только `Arial, Helvetica, sans-serif`, 400/700 (Arial рисует 500 как 400). ⚠ Шаблон и BC-15 ставят
  Inter 500 — устарело (владелец, 14.10). Задавай его только тексту, не `*`: значок ссылки (шрифт иконок) станет
  квадратиком (BC-14).

### 4.4. Вкладки — блок 5 (BC-13…17, BC-24)

Правило всего борда — ляжет и на чужие вкладки, согласуй с владельцем. Ниже ядро, полный блок — в шаблоне.

```css
.dashboard-component-tabs:not(#xx-tabs), .dashboard-component-tabs:not(#xx-tabs) :is(.ant-tabs, .ant-tabs-nav, .ant-tabs-nav-wrap, .ant-tabs-nav-list, .ant-tabs-nav-operations) {
  background: transparent !important; box-shadow: none !important; }
.dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav { margin: 0 0 16px !important; padding: 0 !important;
  border: 0 !important; height: auto !important; min-height: 0 !important; }      /* от линии до чартов — 16 */
.dashboard-component-tabs:not(#xx-tabs) :is(.ant-tabs-nav-wrap, .ant-tabs-nav-list) { gap: 0 !important; align-items: flex-end !important; }
.dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav::before { border-bottom: 1px solid #e7e9ee !important; }
.dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab { position: relative !important;
  margin: 0 40px 0 0 !important; padding: 7px 0 9px !important; border: 0 !important;
  background: transparent !important; border-radius: 0 !important; box-shadow: none !important; }
.dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab :is(.ant-tabs-tab-btn, .editable-title, .editable-title *):not(i):not(.anticon):not([class*="fa-"]):not([class*="anchor"] *) {
  font: 400 14.5px/20px Arial, Helvetica, sans-serif !important; letter-spacing: 0 !important; color: #8a909c !important; }
.dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab-active :is(.ant-tabs-tab-btn, .editable-title, .editable-title *):not(i):not(.anticon):not([class*="fa-"]):not([class*="anchor"] *) {
  color: #23272e !important; }
.dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab-active::after { content: "" !important;
  position: absolute !important; left: 0 !important; right: 0 !important; bottom: 0 !important; height: 2px !important;
  border-radius: 2px 2px 0 0 !important; background: #2b6cff !important; }       /* акцент отчёта */
.dashboard-component-tabs:not(#xx-tabs) .ant-tabs-ink-bar { display: none !important; }
```

- **Один вес у всех вкладок.** Жирная активная сдвигает названия при переключении, а зарезервировать ширину CSS борда
  не может. Внутри чартов ДС выделяет активную 700 — там ширину держит сам чарт.
- **Пилюли форка** бывают и на потомках вкладки: фон, рамки и скругления сбрасывай и с `.ant-tabs-tab *` (шаблон).
- **Значок ссылки** — `position:absolute; left:100%; margin-left:6px`. Шрифт, размер и показ значка не трогай.
- **Вкладки верхнего уровня.** Их полоса — в липкой шапке: дай ей фон страницы и `padding: 0 <поле сбоку>` (BC-17).
- **CSS владельца.** До стилизации прочитай CSS его борда (плашки на `::after`, `.fade-out`). Сверь вид, а не только
  наличие (BC-19).

### 4.5. Поля и максимальная ширина — блок 6 (BC-12)

Поля — вкус владельца. Начни с чисел ниже и покажи вывод сниппета **до** поставки.

```css
.grid-container:not(.dashboard--editing *):not(#xx-grid) { margin: 12px 24px 24px !important; }  /* верх · бока · низ */
html:has(.dashboard-header-container ~ * .dashboard-component-tabs) .grid-container:not(.dashboard--editing *):not(#xx-grid) {
  margin-top: 16px !important; }                    /* вкладки верхнего уровня: от их линии до чартов */
.dashboard-grid .grid-content > :not(:last-child) { margin-bottom: 16px !important; }   /* шов рядов */
/* ультраширокий экран (Adoption 09.10): порог = MAXW + 2 × поле сбоку; правило — ПОСЛЕ полей и того же веса */
@media (min-width: 2448px) {
  .grid-container:not(.dashboard--editing *):not(#xx-grid) { max-width: 2400px !important;
    margin-left: auto !important; margin-right: auto !important; } }
```

- Зазор ячеек в ряду (16) и режим правки не трогай. Divider между чартами не ставь: +33 px.
- **Предел ширины — в одном месте:** лист из нескольких чартов — CSS борда; один чарт на лист — сам чарт (каркас ≤ N px
  по центру, как макет TeamPulse). Блоки внутри чарта на большом экране не центрируй: растут до предела, ниже — пусто.

### 4.6. Высота ряда по экрану — блок 7 (BC-18, SB-06)

В CSS борда `100vh` — окно браузера, внутри iframe — ячейка. Чарт свою высоту странице не сообщает.

```css
.resizable-container:not(.dashboard--editing *):has(.dashboard-chart-id-100001, .dashboard-chart-id-100002):not(:has(.resizable-container .dashboard-chart-id-100001, .resizable-container .dashboard-chart-id-100002)) {
  height: max(560px, calc(100vh - 201px)) !important; }
```

- **TOP (201)** = верх ряда от начала страницы + нижнее поле. Число даёт только сниппет. Chromium хранит правило как
  `-201px + 100vh`, сниппет ищет обе записи.
- **MIN (560)** — под самый высокий обязательный элемент («Применить», выпадашку).
- **`:not(:has(.resizable-container …))`** берёт самый внутренний контейнер: колонка тоже `.resizable-container`.
- **Свежее (Adoption 09.10): ряд под высокой ячейкой-шапкой.** На ноутбуке `100vh − TOP` сжимает ряд в щель, нужен
  нижний предел: `height: max(calc(100vh - 305px), min(800px, calc(100vh - 153px))) !important;`. На мониторе шапка и
  ряд входят ровно в экран; на ноутбуке ряд не ниже 800, но не выше видимого под липкой шапкой. VIS (153) = низ липкой
  шапки + 16 + 24. TOP, MIN, VIS — ручки владельца в одном блоке.
- Правило работает только вместе с 4.1, а 4.1 — только с SB-03.
- «По наполнению» не сделать: длинное прокручивается внутри панелей. Альтернатива — ячейка выше экрана + линейка (SB-05).

### 4.7. Разворот iframe за ячейку — блоки 2–3 (BC-08…10, SB-11…15)

Единственный канал — `postMessage({type:'ECHARTS_UPDATE_DATA_URL', …})`: чарт шлёт PNG 1×1 с маркером (12 байт ASCII =
16 знаков base64, PNG дополнен `\0` до кратности 3), родитель кладёт его в `img.echarts-plugin`, CSS по маркеру
разворачивает iframe прозрачным слоем.

```css
/* «XX-DD-ON-001» → WFgtREQtT04tMDAx */
.dashboard-chart-id-100002:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) :is(.slice_container, .chart-container, .dashboard-chart) {
  overflow: visible !important; }
.dashboard-chart-id-100002:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) #chart-id-100002 { position: relative !important; }
.dashboard-chart-id-100002:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) #chart-id-100002 iframe {
  position: absolute !important; top: 0 !important; left: 0 !important; width: calc(100vw - 48px) !important;
  height: 100% !important; z-index: 998 !important; background: transparent !important; }
```

- Якорь — `#chart-id-N`, а не ячейка с заголовком: иначе строка прыгает. `z-index: 998` — выше сетки, ниже модалок.
- Размер — по назначению: вправо `calc(100vw - 48px)` (ячейка не у левого края — вычти её отступ, иначе горизонтальная
  прокрутка), вниз `min(640px, 85vh)`, подсказке — малый: `calc(100% + 360px)` или `min(260px, 60vh)`.
- Свой маркер на каждое назначение (выпадашка, подсказка, тур), префикс уникален на борде: с одним маркером подсказка
  перестраивает борд под курсором.
- **Проверка в бою** при открытой выпадашке:
  `document.querySelector('.dashboard-chart-id-N img.echarts-plugin')?.src.includes('МАРКЕР')` → `true`.

### 4.8. Тур на весь экран — блок 8 (TR-16, TR-22)

Каждый iframe затемняет только себя. Ведущий чарт шлёт маркер тура: раз в 1,5 с, без разворота, в конце — чистый PNG.
CSS по маркеру красит всё вокруг чартов в `#7c8088` — это `rgba(17,24,39,.55)` поверх белого.

```css
/* M = html:has(.dashboard-chart-id-100001 img.echarts-plugin[src*="WFgtVE9VUi1PTi0x"]) — в файле полностью */
M, M body, M :not(iframe):has(.dashboard-component-chart-holder), M :not(iframe):has(.dashboard-header-container),
M .dashboard-header-container ~ * .dashboard-component-tabs:not(#xx-tabs) {
  background-color: #7c8088 !important; background-image: none !important; }
M .dashboard-header-container, M .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav { position: relative !important; background: #fff !important; }
M #main-menu { position: relative !important; }
M :is(.dashboard-chart-id-100001, .dashboard-chart-id-100002) :is(.chart-header, [data-test="slice-header"]) { visibility: hidden !important; }
M .dashboard-header-container::after, M .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav::after, M #main-menu::after {
  content: "" !important; position: absolute !important; inset: 0 !important;
  background: rgba(17, 24, 39, .55) !important; z-index: 1000 !important; pointer-events: auto !important; }
```

- Своего слоя поверх страницы не делай: `body::after` в бою не появился, его перекрывают слои Proteus.
- Вариант Adoption красит только швы и поля (`body:has(…)` + обёртки ячеек), шапку и вкладки — нет. Бери весь экран.
- Маркер тура шли из чарта, чей канал больше ничем не занят: новый PNG затирает прежний маркер.
- В чарте под шторкой углы карточки прямые, шторки без скругления (TR-22), иначе на углах светлая дуга.
- В бою не подтверждены `.dashboard-header-container` и `#main-menu`: остались светлыми — нужны фото и классы.

### 4.9. Служебные элементы Superset

- **Прятать:** `.header-title`; EmptyState (`.slice_container`, пока нет iframe); `.ant-tabs-ink-bar`; «⋯» ячеек — только в туре.
- **Прятать по условию:** `img.loading` поверх готового чарта — только при своей плашке пересчёта.
- **Вывести из потока, не прятать:** шапку чарта `[data-test="slice-header"]` — меню «⋯» нужно.
- **Не прятать и не двигать:** меню Proteus, шапку борда, нативные фильтры — чужое, классы не подтверждены.

## 5. Пары с чартом

| CSS борда | В чарте обязательно |
|---|---|
| растяжка, разворот | `overflow:hidden` у `html`, `body`, хоста + `onerror`, глушащий только «ResizeObserver loop» (SB-03) |
| ячейка без карточки, подложка | документ прозрачный; карточка во всё окно (`position:fixed`), радиус 12, без тени (UI-08) |
| разворот | маркер в `CFG` = в CSS; повтор 0 / 400 / 1 500 мс; закреп карточки; выпадашка — после разворота (SB-11…15) |
| тур | маркер раз в 1,5 с, конец — чистый PNG; прямые углы под шторкой (TR-22) |
| загрузка | строка meta в любом ответе (DS-08) |
| высота ряда | корень 100 % ячейки; прокрутка внутри панелей; `vh` в чарте не для «по экрану» (SB-05, SB-06) |

## 6. Паттерны ✅ / Антипаттерны ❌

| ✅ Делай | ❌ Не делай | Почему |
|---|---|---|
| Файл отчёта целиком | Дельту «допишите блок» | На новом борде базы нет: рамки, шапка не тянется |
| Ячейку по классу холдера (+ `:has(#chart-id)` для веса) | Только `:has(#chart-id-N)`; глобальный холдер | На загрузке `#chart-id` нет: скачок формы; глобальное ломает чужие чарты |
| Числовые заглушки + сборщик | `ID`, `12345`, ручной Ctrl+H | Задевает классы и данные |
| Тени со всей цепочки сразу | Снимать по частям | «Тень у краёв» две поставки подряд |
| Числа и классы — сниппетом | Высоту и поля по фото; «платформу» в стенде по догадке | Три поставки за вечер; стенд проходил, борд — нет |
| `:not(#xx-…)` + `!important` | Вкладки без веса id | Цепочки форка весят до 0,7,1 |
| Свой маркер, малый разворот подсказке | Подсказку маркером выпадашки | Борд дёргается под курсором |
| Один вес вкладок | Жирную активную | Названия сдвигаются |
| Перекраска обёрток по маркеру тура | Свой слой поверх страницы | Перекрывают слои Proteus |
| `:is(.chart-header, [data-test="slice-header"])` | Только `.chart-header` | В 2.1.0 класса нет: iframe на 4 px ниже |

## 7. Чек-лист перед сдачей

- [ ] Шапка: НАЧАЛО/КОНЕЦ, карта блоков, id, строка про красные «!».
- [ ] Правила — на свои id. Глобальные — только вкладки, поля, шов, и владелец о них знает.
- [ ] Заглушки — шесть цифр, цветов из одних цифр нет. `python3 stand/pack.py --check` — всё `ok`.
- [ ] Шапка чарта — `:is(.chart-header, [data-test="slice-header"])`, меню «⋯» доступно; шрифт — Arial 400/700.
- [ ] Поля, TOP / MIN / VIS, макс. ширина — в одном месте, совпадают с `EXPECT` сниппета.
- [ ] Селекторы `:has`/`:not` — одной строкой; слой разворота с `#chart-id-N`.
- [ ] Пары с чартом (раздел 5) на месте.
- [ ] Стенд `node kit/sbx/run.cjs <чарт> <мок> --css <файл> --id 100001 --clicks <сценарий> --board-check`: ошибок
      окна 0, iframe = ячейке, подложка без iframe той же формы, маркер разворачивает и снимается, окно −17 px не гасит чарт.
- [ ] В поставке — сниппет разметки, в инструкции — шаги, `allow pasting`, стоп-точка «прислать вывод».
- [ ] В инструкции — что проверить глазами: шов 16, без рамок, Cmd+Shift+R без скачка, «⋯» при наведении.
- [ ] В «Что не проверено» перечислены классы без подтверждения в бою.

## Где подробнее

- `../proteus-playbook/10-board-css.md` — BC-01…BC-25, факты B1–B19, карта DOM, каркас файла.
- `../proteus-playbook/templates/board.template.css` — блоки 1–8 целиком.
- `../proteus-playbook/08-sandbox.md` — SB-03 (`overflow` + `onerror`), SB-05/SB-06 (высота), SB-11…SB-15 (разворот).
- `../proteus-playbook/12-tour.md` — TR-16, TR-22.
- `../proteus-playbook/16-antipatterns.md` — H1–H9, F1, F4, I3, I4.
- `../proteus-playbook/kit/README.md` — `board-check.js`, `pack_template.py` (виды `css`, `snippet`), `sbx/run.cjs`.
- `../proteus-playbook/14-delivery.md` — DV-05, DV-24, DV-30, DV-35.

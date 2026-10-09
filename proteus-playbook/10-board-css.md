# 10. CSS борда (BC)

**Зачем глава.** Кастомный чарт `react_sanbbox` живёт в iframe-песочнице размером с ячейку и до страницы борда не
дотягивается. Белая рамка вокруг чарта, шапка Proteus над ним, заглушка «Не было получено данных», вкладки, поля и
высота ряда — всё это правит только CSS дашборда, который владелец вставляет руками («Редактировать дашборд → CSS»).
Глава — как устроить этот файл для любого борда, чем перебивать правила форка и как проверять геометрию на живой
странице. Сторона чарта у разворота iframe (сигнал, PNG с маркером, геометрия по факту, повтор маркера, клик мимо) —
SB-11…SB-15 в 08-sandbox.md; вид внутри чарта — в 11-ui.md; затемнение швов в туре — в 12-tour.md (TR-16).

**Главное в 5 пунктах.**
1. **BC-01.** CSS борда — обязательный самодостаточный файл поставки. Вставляется целиком вместо прежнего блока своего отчёта, а не дельтой.
2. **BC-02 / BC-20.** Правила вешай только на свои чарты (`:has(#chart-id-N)`, `.dashboard-chart-id-N`). id в исходнике — числовые заглушки, боевые подставляет сборщик.
3. **BC-03 / BC-04.** С холдера сними белую карточку (поле 16, фон, тень, рамку), цепочку до iframe переведи во флекс, а iframe растяни `height:100% !important` поверх атрибута.
4. **BC-13 / BC-14.** Правила вкладок форка перебивай весом id `:not(#…)` и `!important`. Шрифт и размеры значков не трогай.
5. **BC-22.** Геометрию и классы меряй сниппетом DevTools на живом борде. Каркас стенда — только регресс, а не истина.

**Метки уверенности.** [бой] — видно в бою (DevTools, скриншот, слова владельца); [исходник 2.0.1] — по исходнику
Superset 2.0.1 и правилам CSS; [владелец дд.мм] — решение владельца; [вывод] — следует из фактов, напрямую не
проверено; [не проверено в бою] — добавка к любой метке. Отдельной метки для браузерного стенда нет. Где правило
проверено в Chromium 141 на каркасе разметки Superset 2.0.1 (стенд detail_list `live.py ?sk=1`, эксперименты
сводки G4), рядом с меткой написано «стенд».

---

## Факты: что окружает iframe

Таблица — опора для всех правил главы. Новый факт вноси сюда с меткой (PL-09, 01-platform.md).

| # | Факт | Значение | Уверенность | Источник |
|---|---|---|---|---|
| B1 | Холдер ячейки | `.dashboard-component.dashboard-component-chart-holder.dashboard-chart-id-N` — один элемент. `padding:16px`, `border:2px solid transparent`, белый фон, `height:100%`. Шов между чартами 48 px = 16 + 16 + 16 | [исходник 2.0.1] (`ChartHolder.jsx`, `chart.less`) + [бой] (борд 60260, 18–19.09) | adoption:memory/proteus-adoption-html-embedding.md |
| B2 | Размер iframe | Платформа пишет `width`/`height` **атрибутами** при монтаже: ячейка − 32/36 px (iframe 1309×1052 в ячейке 1341×1088). Не пересчитывает ни после CSS, ни после F5. По умолчанию iframe строчный (`inline`): снизу щель | [бой] | там же |
| B3 | `.chart-slice` | У форка `display:block`, у апстрима 2.0.1 — emotion-флекс. Часть правил форка — рантаймовые emotion-классы, их нет ни в чанках, ни в сохранённой странице | [бой] | там же |
| B4 | `#chart-id-N` | Обёртка iframe внутри области чарта (`.react_sanbbox`, плагин форка; в апстриме 2.0.1 её нет). До первой отрисовки её может не быть. Один это элемент с `.react_sanbbox` или два вложенных, живьём не снято — селекторы главы работают в обоих случаях. Класс `dashboard-chart-id-N` стоит на холдере и есть всегда | обёртка — [бой] (правила с `#chart-id-N` работают у Adoption) + стенд (оба варианта DOM `fv=a\|b`; на скриншоте с боя — `b`); класс холдера — [исходник 2.0.1] | detail_list:docs/analysis.md (загрузка борда) |
| B5 | Загрузка | Значок `img.loading.floating[aria-label="Loading"]` 50 px лежит в `.chart-container` рядом со `.slice_container`. При перезапросе прежний iframe остаётся, значок встаёт поверх. Пустой ответ (0 строк) — EmptyState «Не было получено данных по этому запросу» внутри `.slice_container`, без iframe | [исходник 2.0.1] (`Chart.jsx`, `SuperChart.tsx`); заглушка при загрузке — [бой] (скриншот 06.10) | — |
| B6 | Поля и зазоры сетки | `.grid-container`: 24 px сверху и снизу, 32 справа, слева 32 (0 при включённых нативных фильтрах со свёрнутой панелью). Зазор ячеек в ряду 16. Зазор рядов — только у рядов верхнего уровня (`.grid-content > div:not(:last-child)`). Полоса вкладок `min-height` 50. Липкая шапка 64. Режим правки — `.dashboard--editing` (предок `.grid-container`, справа панель 438 px) | [исходник 2.0.1] [не проверено в бою] | `DashboardBuilder.tsx`, `grid.less` 2.0.1; detail_list:stand/skeleton.css |
| B7 | Высота ячейки | `.resizable-container`: высота инлайном = единицы сетки × 8 px (re-resizable, без `!important`), потолка нет (`maxHeightMultiple` = MAX_VALUE). Колонка (`Column`) — тоже `.resizable-container` | [исходник 2.0.1] | `ResizableContainer.jsx`, `Column.jsx` |
| B8 | Вкладки форка | Правила с `!important` и длинными цепочками классов: серые пилюли на серой полосе, активная тёмная. Серую полосу и фон под вкладками даёт CSS владельца: `.ant-tabs-nav-wrap, div[role=tabpanel] {background: var(--dashboard-background)}` | [бой] (DevTools 25.09, фото 08.10) | adoption:memory/proteus-adoption-project.md; detail_list:CLAUDE.md |
| B9 | Значок ссылки у вкладки | `span.anchor-link-container … i.short-link-trigger.fa.fa-link` — шрифт иконок FontAwesome; даёт короткую ссылку `…/superset/dashboard/p/…` | [исходник 2.0.1] + [бой] (борд 61354, 08.10) | — |
| B10 | Фон борда | `--dashboard-background` = `#f6f6f6` | [бой] | CSS бордов 7241 и 60260 |
| B11 | Канал к странице | Из песочницы — только `postMessage({type:'ECHARTS_UPDATE_DATA_URL', dataUrl, payload:{dataUrl}})`. Родитель кладёт dataUrl в `img.echarts-plugin` внутри ячейки. Это плагин форка, в 2.0.1 его нет | [бой] (борд 59922, строка ЦА Adoption) | adoption:Виджеты/pa-head.chart.js (шапка файла) |
| B12 | Редактор CSS | Ace (brace 0.11.1). Красный «!» на `:has(` («Expected RPAREN»), 5 ошибок на `:not(.x *)`, предупреждение на `max()`. Текст сохраняется как есть, без проверки | [исходник 2.0.1] (`CssEditor`) + стенд (CSSLint ace 1.4.14) + [бой] (`:has` работает с 10-й поставки DL) | — |
| B13 | `:has()` в браузерах | Chrome и Edge 105+, Safari 15.4+, Firefox 121+. Какие браузеры у коллег, неизвестно | [вывод] [не проверено в бою] | MDN browser-compat-data |
| B14 | Шрифт страницы и iframe | Страница Superset 2.0.1 подключает Inter (`@fontsource/inter`). В iframe-песочнице он не виден. Вкладки и подписи CSS борда могут рисоваться Inter, а чарт — системным шрифтом | [исходник 2.0.1] + стенд | см. UI-04 (11-ui.md) |
| B15 | `vh` по разные стороны | В CSS борда `100vh` — окно браузера. В iframe `100vh` и `innerHeight` — высота ячейки | [исходник 2.0.1] + стенд | см. SB-05 (08-sandbox.md) |
| B16 | `is_css_scoped` | Ключ JSON-метаданных форка (`true` у бордов DL и HRBP). Что делает, неизвестно. Может ограничивать CSS областью дашборда, и тогда селекторы вне сетки (`.dashboard-header-container ~ *`, `.grid-container`) не сработают | [бой] (ключ виден) — эффект [не проверено в бою] | 17-open-questions.md |

### Карта DOM вокруг чарта (Superset 2.0.1 + плагин форка)

Живьём (борд 60260, DevTools) подтверждены цепочка ячейки и разметка вкладок. Классы сетки, режима правки и шапки
(`.grid-container`, `.dashboard--editing`, `.dashboard-header-container`) взяты только из исходника (BC-23).

```
div.dashboard[.dashboard--editing]                 ← режим правки
 └ .dashboard-content > .grid-container             ← поля сетки 24 / 32 px
    └ div > #GRID_ID (вкладки корня) > tabpane
       └ .dashboard-grid > .grid-content
          └ div.dragdroppable.dragdroppable-row       ← шов рядов верхнего уровня
             └ div.with-popover-menu > div.grid-row   ← зазор ячеек 16 px
                └ div.dragdroppable.dragdroppable-column
                   └ .resizable-container             ← высота инлайном (единицы × 8 px)
                      └ .dashboard-component-chart-holder.dashboard-chart-id-N   ← поле 16, белый фон
                         ├ [AnchorLink]                  ← в режиме просмотра
                         └ .chart-slice                  ← у форка display:block
                            ├ .chart-header[data-test=slice-header] > .header-title + .header-controls (меню ⋯)
                            └ .dashboard-chart           ← overflow:hidden
                               └ .chart-container        ← + img.loading (значок загрузки)
                                  └ .slice_container     ← EmptyState «Не было получено данных…»
                                     └ div > #chart-id-N / .react_sanbbox > iframe    ← плагин форка (B4)
                                                         + img.echarts-plugin          ← канал скриншотов
```

```
div.dashboard-component.dashboard-component-tabs
 └ div#TABS-….ant-tabs.ant-tabs-top.ant-tabs-card
    ├ div[role=tablist].ant-tabs-nav > .ant-tabs-nav-wrap > .ant-tabs-nav-list
    │    > .ant-tabs-tab[.ant-tabs-tab-active] > .ant-tabs-tab-btn > … .editable-title
    │                                          + span.anchor-link-container > i.fa.fa-link
    └ .ant-tabs-content-holder > div[role=tabpanel] > .dashboard-component-tabs-content > .dragdroppable-row …
Вкладки верхнего уровня (первая строка борда): полоса — в липкой шапке рядом с .dashboard-header-container,
ряды — прямо в сетке: .dashboard-header-container ~ … .dashboard-component-tabs
```

---

## Правила

### BC-01. Поставляй CSS борда отдельным самодостаточным файлом и вставляй его целиком
- **Почему:** 30.09 новый тестовый дашборд Adoption не унаследовал базовый блок ячеек с боевого: чарты оказались в белых
  рамках, шапка не тянулась по высоте. HRBP 07.10: без файла CSS отчёт был «серым прямоугольником в рамке» с полосой
  «HRBP HUB ⋯». Дельта «допишите только новый блок» исходит из того, что остальное уже стоит, а на новом борде это не так.
- **Как:**
  - Один файл на отчёт со всем, что нужно его чартам: ячейки, загрузка, развороты, тур, вкладки, поля, высота.
  - Блоки нумеруй и закрепляй номер за назначением навсегда, как номера файлов поставки. Карта блоков — в шапке
    файла. Инструкция ссылается на блок и число: «замените 16px в блоках 5 и 6», «число в блоке 7».
  - В шапке файла: что это и куда вставлять, какие id подставлены и что заменить руками (BC-20), предупреждение о
    красных «!» редактора (BC-21).
  - Порядок блоков (как в detail_list, дополнен):
    1. ячейки: холдер, флекс-цепочка, шапка чарта, iframe (BC-03…BC-05);
    2. и 3. развороты по маркерам: выпадашка и подсказка (BC-08…BC-10);
    4. загрузка ячейки и значок поверх отрисованного чарта (BC-06, BC-07);
    5. вкладки (BC-13…BC-17);
    6. поля (BC-12);
    7. высота ряда (BC-18);
    8. тур: швы между чартами (TR-16, 12-tour.md).
  - Текст инструкции: «Редактировать дашборд → CSS → удалите прежний блок этого отчёта → вставьте файл целиком в
    конец → Сохранить → Cmd/Ctrl+Shift+R». Чужой CSS на борде не трогай.
- **Проверка:** На стенде модель борда берёт CSS ровно из папки поставки (detail_list `live.py ?sk=1`, HRBP
  `live.py /board?css=1`); `pack.py --check` сверяет файл с исходником. В бою — пустой тестовый дашборд, на котором
  стоит только этот файл: картинка совпадает со стендом.
- **Уверенность:** [бой] (Adoption 30.09, HRBP 07.10).
- **Образец:** detail_list:proteus/detail-list.board.css (шапка с картой блоков 1–7) → файл 9 поставки.

### BC-02. Вешай правила только на свои чарты
- **Почему:** На бордах владельца рядом стоят чужие чарты и его собственный CSS: на 7241 это ряд «Ссылки на отчёты» и
  плашка NEW. Глобальное правило ломает чужое. У Adoption база глобальная (`:has(.react_sanbbox)`) только потому, что
  весь борд 60260 — свой.
- **Как:**
  - Базу ячейки задавай через холдер — по его классу или по потомку:
    `.dashboard-component-chart-holder:is(.dashboard-chart-id-N, :has(#chart-id-N))`. Класс есть с самого начала, и
    база срабатывает ещё до отрисовки. `:has(#chart-id-N)` — запасной путь на случай, если у форка класс окажется не на
    холдере.
  - Состояния ячейки (маркер, загрузка) — через класс холдера `.dashboard-chart-id-N`.
  - iframe — `#chart-id-N iframe`.
  - Класс `dashboard-chart-id-N` стоит на самом холдере. Форма `.dashboard-chart-id-N .dashboard-component-chart-holder`
    ничего не выберет: у HRBP в файле 4 из пары селекторов работает только второй.
  - База только по `:has(#chart-id-N)` (так у DL и Adoption) до отрисовки не срабатывает: холдер остаётся белым с полем
    16 px, пока грузится чарт (стенд).
  - Вкладки, поля и высота — правила всего борда. Вкладки действуют и на чужие чарты — согласуй это с владельцем.
    Высоту ограничь своими ячейками (BC-18).
  ```css
  /* база ячейки — до и после отрисовки */
  .dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) { … }
  /* состояние «ещё нет iframe» */
  .dashboard-chart-id-000000:not(:has(iframe)) .slice_container { … }
  ```
- **Проверка:** На стенде — чужой чарт в соседнем ряду (detail_list `live.py ?sk=1&links=1`): у него поля и фон
  штатные. Пока чарт грузится, у своего холдера уже нет поля и белого фона. В бою — цепочка своей ячейки в выводе
  сниппета (BC-22).
- **Уверенность:** [вывод] — случая «сломали чужой чарт» не было; класс на холдере — [исходник 2.0.1]; что он стоит на
  предке iframe — [бой] (правила `.dashboard-chart-id-N:has(img…)` разворачивали iframe DL); база по классу до отрисовки — стенд (Chromium 141 на
  разметке 2.0.1) [не проверено в бою].
- **Образец:** detail_list:proteus/detail-list.board.css, блоки 1 и 4 (база по `:has(#chart-id-N)`, состояния по классу).

### BC-03. Снимай с холдера белую карточку: фон, поле 16 px, тень и рамку
- **Почему:** Поле 16 px и белый фон холдера и есть «рамка» вокруг чарта. Шов между чартами был 48 px вместо 16,
  iframe 1056×520 в ячейке 1088×552. Виновника нашёл только сниппет цепочки родителей на живом борде (раунд 12,
  18–19.09), владелец: «УРА сработало».
- **Как:**
  ```css
  .dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) {
    background-color: transparent !important;   /* белая карточка ячейки */
    padding: 0 !important;                       /* поле 16 px — оно и даёт «рамку» */
    box-shadow: none !important;
    border: 0 !important;                        /* 2 px прозрачной рамки 2.0.1 */
  }
  ```
  `box-shadow:none` гасит и подсветку фокуса нативного фильтра (`.fade-in`). На борде с нативными фильтрами это
  заметят — там тень оставь.
- **Проверка:** На стенде шов между чартами 16 px, iframe равен ячейке. В бою — сниппет (BC-22): у холдера нет
  строки «отступы», фон прозрачный.
- **Уверенность:** [бой] (борд 60260, 18–19.09) — фон, поле, тень; `border:0` — [исходник 2.0.1] + стенд detail_list.
- **Образец:** detail_list:proteus/detail-list.board.css, блок 1; adoption:Единый лист — актуальные файлы/9. CSS борда — весь, одним куском (id шапки 803089).css (первое правило).

### BC-04. Растягивай iframe на всю ячейку флекс-цепочкой и `height:100% !important`
- **Почему:** Высоту iframe платформа пишет атрибутом один раз (B2), поэтому внизу ячейки оставалась полоса: «чарт не
  растягивается» (Adoption 30.09). Строчный iframe даёт щель снизу. Флекс у `.chart-slice` нужно задать самому: у форка
  он `block` (B3). emotion ставит `.chart-container{min-height:Npx}` и `.slice_container{height:Npx}`, поэтому без
  `min-height:0` цепочка не сжимается.
- **Как** (ниже `H` — база ячейки из BC-02, `.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, …,
  :has(#chart-id-000000, …))`; в файле пиши её полностью — переменных в селекторах CSS нет):
  ```css
  H { height: 100% !important; display: flex !important; flex-direction: column !important; }
  H .chart-slice, H .dashboard-chart, H .chart-container, H .slice_container, H .slice_container > div, H .react_sanbbox {
    display: flex !important; flex-direction: column !important; flex: 1 1 auto !important;
    min-height: 0 !important; padding: 0 !important; background: transparent !important;
  }
  #chart-id-000000 iframe, #chart-id-111111 iframe {
    display: block !important;      /* строчная щель */
    flex: 1 1 auto !important; width: 100% !important;
    height: 100% !important;        /* поверх атрибута height платформы */
    min-height: 0 !important; border: 0 !important;
  }
  ```
- **Проверка:** На стенде iframe равен ячейке ±0 px при любой высоте ряда (detail_list `click.cjs`, шаг «ряд по окну,
  iframe на всю ячейку»). В бою — в выводе сниппета высота iframe равна высоте холдера.
- **Уверенность:** [бой] (Adoption, борд 60260, 30.09).
- **Образец:** detail_list:proteus/detail-list.board.css, блок 1. У HRBP и TeamPulse файл 4 без `height:100% !important`
  и без цепочки — неполный.

### BC-05. Прячь только заголовок шапки чарта, а меню «⋯» оставляй поверх
- **Почему:** Пустой заголовок занимает строку высоты, а меню («Обновить», «Скачать», «Править») владельцу нужно. HRBP и
  TeamPulse прячут `.header-controls` и `[data-test=slice-header]`: меню нет, «править — через „Графики“».
- **Как:**
  ```css
  H .header-title { display: none !important; }          /* H — база ячейки (BC-02, BC-04) */
  H .chart-slice  { position: relative !important; }
  H .chart-header {
    position: absolute !important; top: 0 !important; right: 0 !important; z-index: 11 !important; margin: 0 !important;
  }
  ```
  Шапку прячь целиком, только если меню перекрывает собственные кнопки чарта в правом верхнем углу. Другой путь —
  резерв ~32 px справа в шапке чарта ([вывод]).
- **Проверка:** В бою, в режиме просмотра: над чартом нет пустой строки, при наведении на правый верх ячейки видно «⋯».
- **Уверенность:** [бой] (Adoption, с 30.09); перекрытие кнопок чарта меню — [не проверено в бою].
- **Образец:** detail_list:proteus/detail-list.board.css, блок 1 (`.header-title`, `.chart-header`).

### BC-06. Закрывай загрузку ячейки CSS-ом: белая подложка, значок Proteus и подпись
- **Почему:** Пока в ячейке нет iframe, Proteus показывает «Не было получено данных по этому запросу» с картинкой.
  Владелец 06.10: «надпись стрёмная». От ответа до первой отрисовки проходит ≈ 0,2–0,3 с, при холодном кэше — секунды.
  Своё кольцо загрузки дублировало значок Proteus («второе кольцо», Adoption 07.10), подпись наезжала на значок. JS
  чарта здесь не помощник: чарта ещё нет.
- **Как:**
  - Условие — «в ячейке ещё нет iframe»: `.dashboard-chart-id-N:not(:has(iframe))`.
  - `.slice_container { visibility:hidden }` прячет заглушку с картинкой.
  - `.chart-container` — белая карточка радиуса 12, как сам чарт, с `position:relative`.
  - Растяжка и снятие белой карточки холдера (BC-03, BC-04) уже действуют: база BC-02 берёт холдер по классу. Если база
    у тебя только по `:has(#chart-id-N)`, повтори растяжку для состояния без iframe отдельным правилом.
  - Подпись — `::after` у `.chart-container` под значком 50 px. В низкой ячейке (шапка) ставь её справа от значка.
  - Своё кольцо не рисуй. Появился iframe — правила снимаются сами.
  ```css
  .dashboard-chart-id-000000:not(:has(iframe)) .slice_container { visibility: hidden !important; }
  .dashboard-chart-id-000000:not(:has(iframe)) .chart-container {
    position: relative !important; background: #fff !important; border-radius: 12px !important;
  }
  .dashboard-chart-id-000000:not(:has(iframe)) .chart-container::after {
    content: 'Загружаю список…'; position: absolute; left: 0; right: 0; top: calc(50% + 26px);
    text-align: center; pointer-events: none; color: #8a909c;
    font: 500 13px/1.4 Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    animation: xx-load-pulse 1.6s ease-in-out infinite;
  }
  /* низкая ячейка: подпись справа от значка */
  .dashboard-chart-id-111111:not(:has(iframe)) .chart-container::after {
    content: 'Загружаю шапку…'; top: calc(50% - 9px); left: calc(50% + 30px); right: auto; text-align: left;
  }
  @keyframes xx-load-pulse { 50% { opacity: .6; } }
  ```
  У Adoption растяжка до отрисовки написана как `.dashboard-component-chart-holder:has(.dashboard-chart-id-N)`. По
  разметке 2.0.1 класс стоит на самом холдере (B1), и такой селектор ищет потомка с этим классом — то есть ничего не
  выберет. Бери холдер по классу, как в базе BC-02 ([вывод] по исходнику и стенду; подтвердить сниппетом BC-22).
- **Предусловие:** датасет всегда отдаёт хотя бы одну строку (meta) — DS-08 (05-dataset.md). Пустой ответ даёт EmptyState
  без iframe навсегда (B5). Тогда под этим CSS ячейка вечно показывает «Загружаю…» без значка. Ошибка запроса остаётся
  видна: при `failed` `.chart-container` не рисуется.
- **Проверка:** На стенде — первая загрузка с задержкой в обоих вариантах DOM (detail_list `live.py ?first=мс&fv=a|b`).
  В бою — Cmd+Shift+R: на месте чартов белые карточки с одним значком и подписью, без картинки-графика. Если надпись
  видна, нужен класс элемента: ПКМ → «Просмотреть код».
- **Уверенность:** [исходник 2.0.1] + стенд; [владелец 06.10] — замена надписи. Пропала ли заглушка в бою, владелец не
  подтверждал — [не проверено в бою].
- **Образец:** detail_list:proteus/detail-list.board.css, блок 4 и подложка в блоке 1; adoption:Единый лист — актуальные
  файлы/9. CSS борда — весь, одним куском (id шапки 803089).css (блок «Загрузка борда»: подпись справа от значка в
  низкой шапке).

### BC-07. Прячь значок загрузки Proteus поверх отрисованного чарта, если у чарта своя плашка пересчёта
- **Почему:** При перезапросе 2.0.1 оставляет прежний iframe и кладёт `img.loading` поверх (B5). 30.09 значок поверх
  своей плашки «Пересчитываем…» был лишним (Adoption).
- **Как:**
  ```css
  .dashboard-chart-id-000000:has(iframe) img.loading,
  .dashboard-chart-id-000000:has(iframe) [aria-label="Loading"] { display: none !important; }
  ```
  - Условие `:has(iframe)` — «чарт уже отрисован», ровно обратное условию BC-06. При первой загрузке iframe ещё нет, и
    значок остаётся — его подписывает BC-06. Adoption пишет то же через `:has(.react_sanbbox)`.
  - `[data-test="loading-indicator"]` в 2.0.1 нет: селектор лишний, но безвредный.
  - Если своей плашки пересчёта у чарта нет, значок не прячь: иначе пользователь не узнает, что идёт запрос
    (UI-23, 11-ui.md).
- **Проверка:** В бою — «Применить»: поверх чарта только своя плашка. Значок виден — прислать класс элемента.
- **Уверенность:** [владелец 30.09] (Adoption); селекторы — [исходник 2.0.1] [не проверено в бою].
- **Образец:** adoption:Единый лист — актуальные файлы/9. CSS борда — весь, одним куском (id шапки 803089).css (блок «Стандартный значок загрузки Proteus — прячем»).

### BC-08. Выводи всплывашку за ячейку только разворотом iframe по маркеру канала скриншотов
- **Почему:** Всё, что шире ячейки, iframe обрезает. Других каналов к странице нет (B11). Приём — костыль владельца
  с борда 59922 (заявка платформе 14.09). В бою работает на строке ЦА и шапке Adoption, у DL 30.09 и 06.10 iframe
  тоже разворачивался. Якорь на ячейке с заголовком давал прыжок строки на высоту заголовка (урок 59922).
- **Как** (сторона CSS; сторона чарта — сигнал и выравнивание PNG — SB-11, геометрия по факту — SB-13, повтор маркера —
  SB-14, 08-sandbox.md):
  1. Чарт шлёт PNG 1×1, к base64 которого приписан маркер: 12 байт ASCII = ровно 16 символов base64
     (`DL-FLT-DD-ON` → `REwtRkxULURELU9O`).
  2. Правила по `.dashboard-chart-id-N:has(img.echarts-plugin[src*="МАРКЕР"])`:
  ```css
  /* ячейки не режут развёрнутый iframe */
  .dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) .slice_container,
  .dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) .chart-container,
  .dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) .dashboard-chart {
    overflow: visible !important;
  }
  /* якорь — #chart-id-N, а не ячейка с заголовком: строка не прыгает */
  .dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) #chart-id-111111 {
    position: relative !important;
  }
  /* слой: вправо на всю ширину борда, выше сетки, прозрачный */
  .dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) #chart-id-111111 iframe {
    position: absolute !important; top: 0 !important; left: 0 !important;
    width: calc(100vw - 48px) !important; height: 100% !important;
    z-index: 998 !important;            /* выше сетки, ниже системных модалок */
    background: transparent !important;
  }
  ```
  3. Размер разворота выбирай по назначению: вправо на всю ширину (`calc(100vw - 48px)`, панель фильтров DL) или вниз
     (`min(640px, 85vh)`, шапка Adoption).
  4. Закрыли — чарт шлёт чистый PNG, правила снимаются сами.
  5. Пока iframe развёрнут, соседний чарт под прозрачным слоем не кликается: клик мимо выпадашки закрывает её
     (сторона чарта — SB-15).
- **Проверка:** На стенде — `ifstand.mjs` (Adoption), `click.cjs` (DL): маркер в `img.echarts-plugin`, iframe
  развёрнут, сосед виден сквозь прозрачный слой. В бою — при открытой выпадашке в Console:
  `document.querySelector('.dashboard-chart-id-N img.echarts-plugin')?.src.includes('МАРКЕР')` → `true`.
- **Уверенность:** [бой] (59922; Adoption 25.09 и 30.09; DL 30.09 и 06.10). Разворот DL на 7241 после правок 06.10 —
  [не проверено в бою].
- **Образец:** detail_list:proteus/detail-list.board.css, блок 2; adoption:Виджеты/pa-head.chart.js (`pngUrl`, `signal`) и
  CSS единого листа (блок шапки 803089).

### BC-09. Держи вес селектора слоя разворота больше веса базы iframe
- **Почему:** Слой без `#chart-id-N` проигрывает базе `#chart-id-N iframe{width:100% !important}`: iframe остаётся шириной
  ячейки (стенд: 300 px вместо 777). При базе по классу (`.react_sanbbox iframe`, Adoption) слой без id выигрывает —
  поэтому у Adoption работает и без id.
- **Как:** Держи `#chart-id-N` и в базе (BC-04), и в селекторе слоя. В комментарии файла пиши: «#chart-id в селекторе —
  сильнее блока 1». Меняешь базу — пересчитай вес слоя.
- **Проверка:** На стенде при маркере `getComputedStyle(iframe).width` равна ширине разворота.
- **Уверенность:** [исходник 2.0.1] (специфичность CSS) + стенд (Chromium 141, эксперимент сводки G4).
- **Образец:** detail_list:proteus/detail-list.board.css, блоки 2–3.

### BC-10. Давай каждому назначению разворота свой маркер, а подсказке — малый разворот
- **Почему:** 30.09 «тултипы дёргаются» (DL): подсказка разворачивала iframe тем же маркером, что выпадашка, и борд
  перестраивался прямо под курсором.
- **Как:**
  - Свой маркер на каждое назначение: выпадашка, подсказка, тур. У DL `REwtRkxULURELU9O` — выпадашка,
    `REwtRkxULVRJUC0x` — подсказка. У Adoption `UEEtQ0EtREQtT04x` — выпадашка, `UEEtU1QtVElQLU9O` — подсказка,
    `UEEtVE9VUi1PTi0x` — тур.
  - Подсказке — ровно столько места, сколько ей нужно: вправо `calc(100% + 360px)` (DL) или вниз `min(260px, 60vh)`
    (Adoption). Ушёл курсор с чарта — iframe сразу обратно.
  - Пока iframe развёрнут, чарт держит ширину и высоту своей карточки (SB-13). То же правило со стороны чарта — SB-12
    (08-sandbox.md).
  - Маркер уникален на борде: у двух отчётов на одном борде — разные префиксы (`DL-`, `PA-`).
- **Проверка:** На стенде — наведение на подсказку не двигает соседние чарты (`getBoundingClientRect` до и после).
- **Уверенность:** [бой] — симптом 30.09; малый разворот — стенд DL [не проверено в бою].
- **Образец:** detail_list:proteus/detail-list.board.css, блок 3; adoption: CSS единого листа (подсказки «Считать»).

### BC-11. Держи холст чарта равным фону борда
- **Почему:** HRBP 07.10: холст `#f4f5f7` на борде `#f6f6f6` давал «серую заплатку». У TeamPulse сейчас так же
  (`--bg:#f4f5f7`, правило `body` уходит в iframe).
- **Как:**
  - Тело и overlay iframe — прозрачные или `#f6f6f6` (B10). Белые панели радиуса 12 лежат поверх. Холдер прозрачный
    (BC-03).
  - Пока iframe развёрнут, фон html, body и хоста прозрачный, иначе развёрнутый iframe закроет соседей белым
    (SB-13, 08-sandbox.md).
  - Подложка загрузки — белая карточка радиуса 12, как чарт, а не серый прямоугольник (BC-06).
  - Вид карточек внутри чарта — UI-08 (11-ui.md).
- **Проверка:** На стенде пиксель в зазоре между чартами и под чартом одного цвета. В бою — сниппет: у холдера фон
  прозрачный, у страницы `rgb(246, 246, 246)`.
- **Уверенность:** [бой] (HRBP 07.10).
- **Образец:** HRBP_HUB:proteus/hrbp-hub.chart.js (`CFG.colors.bg` = `#f6f6f6` с комментарием про заплатку).

### BC-12. Держи на всём борде одно поле — 16 px
- **Почему:** Владелец 18.09 (Adoption): «разрыв между графиками отличается от разрывов внутри чарта». 08.10 (DL):
  «сверху место как сбоку» — над чартами было ≈ 100 px пустоты. Каркас стенда (2.0.1 + пилюли форка) без файла
  CSS: поля 32 / 32 / 24, полоса вкладок 68 px, страница 1289 px. С файлом: 16 / 16 / 16, полоса 37 px, страница
  950 px без прокрутки.
- **Как:**
  ```css
  /* поля сетки (у 2.0.1 — 24 / 32); xx — префикс отчёта, такого id нет — нужен только вес */
  .grid-container:not(.dashboard--editing *):not(#xx-grid) { margin: 16px !important; }
  /* шов рядов верхнего уровня (в том числе в сетке каждой вкладки верхнего уровня) */
  .dashboard-grid .grid-content > :not(:last-child) { margin-bottom: 16px !important; }
  /* ряды во вложенных вкладках: у 2.0.1 правила зазора для них нет — предложение, на форке не проверено */
  .dashboard-component-tabs-content > .dragdroppable-row:not(:last-child) { margin-bottom: 16px !important; }
  ```
  - От линии вкладок до чартов — тоже 16 (margin полосы вкладок, BC-15). Зазор ячеек в ряду — штатные 16.
  - Режим правки не трогай: справа панель конструктора, высоту задаёт ручка.
  - Разделитель (divider) между равноправными чартами не ставь: он добавляет 16 px гаттера и 17 px своей высоты.
  - Слева у 2.0.1 бывает 0 (нативные фильтры со свёрнутой панелью). Правило даёт 16 в обоих случаях.
- **Проверка:** На стенде — detail_list `click.cjs DL_ONLY=board`: поля 16 со всех сторон, без горизонтальной
  прокрутки; режим правки — штатные поля. В бою — сниппет (BC-22): «поле слева · справа · между чартами (цель — 16)».
- **Уверенность:** шов рядов — [бой] (Adoption); поля сетки — [владелец 08.10] [не проверено в бою]; ряды во вложенных
  вкладках — [исходник 2.0.1] [вывод].
- **Образец:** detail_list:proteus/detail-list.board.css, блок 6; adoption: CSS единого листа (шов рядов).

### BC-13. Перебивай правила вкладок форка весом id и `!important`
- **Почему:** У форка правила вкладок с `!important` и цепочками вроде `div.dashboard-component.dashboard-component-tabs
  .ant-tabs.ant-tabs-top.ant-tabs-card > .ant-tabs-nav .ant-tabs-nav-wrap` (вес 0,7,1). Когда `!important` с обеих
  сторон, решает специфичность. 25.09 v1 вкладок Adoption не перебила серую заливку и полосу; v2 с `:not(#pa-tabs-v2)`
  легла.
- **Как:**
  - Каждому селектору добавь `:not(#несуществующий-id)` — вес 1,0,0 больше любой цепочки классов — и `!important`.
    Удвоенный класс `.ant-tabs-tab.ant-tabs-tab` добавляет вес ещё.
  - id свой на отчёт (`#dl-tabs`, `#pa-tabs-v2`). В комментарии пиши: «такого id нет, условие всегда выполнено».
  - Фон, тени, рамки и скругления сбрасывай со всей полосы (`.dashboard-component-tabs`, `.ant-tabs`, `.ant-tabs-nav`,
    `-nav-wrap`, `-nav-list`, `-nav-operations`) и со всех потомков вкладки.
  - Вкладки общие на весь борд: стиль ляжет и на чужие вкладки — согласуй с владельцем.
  ```css
  .dashboard-component-tabs:not(#xx-tabs),
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs,
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav,
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav-wrap,
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav-list,
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav-operations { background: transparent !important; box-shadow: none !important; }
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab,
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab * {
    background: transparent !important; border-color: transparent !important;
    border-radius: 0 !important; box-shadow: none !important;
  }
  ```
- **Проверка:** На стенде — каркас с пилюлями форка (detail_list `stand/skeleton.css`, слой 2): после блока полоса
  37 px вместо 68, фон прозрачный. В бою — сниппет: «активная вкладка: …, фон rgba(0, 0, 0, 0)».
- **Уверенность:** [бой] (Adoption v2, с 25.09) + стенд (`:not(#dl-tabs)` перебивает цепочку форка).
- **Образец:** detail_list:proteus/detail-list.board.css, блок 5.

### BC-14. Не трогай шрифт и размеры значков во вкладках
- **Почему:** 25.09 v2 вкладок Adoption поставила Inter на `*`, и значок ссылки у вкладки (FontAwesome, B9) стал
  квадратиком. v3 Adoption красит при наведении `:hover *` вместе со значками.
- **Как:**
  - `font-family` задавай только вкладке и её тексту: `.ant-tabs-tab`, `.ant-tabs-tab-btn`, `[role="tab"]`,
    `.editable-title`, `.editable-title *`.
  - Сброс отступов, кегля и цвета у потомков — с исключениями значков:
  ```css
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab *:not(i):not(svg):not(svg *):not(.anticon):not([class*="fa-"]):not([class*="icon"]):not([class*="anchor"]):not([class*="anchor"] *) {
    padding: 0 !important; margin: 0 !important;
  }
  ```
  - Значку меняй только отступ от названия и цвет. Наведение красит текст, а не значки.
- **Проверка:** На стенде — `click.cjs`: у значка шрифт иконок, при наведении он `visible`. В бою — сниппет: «значок
  ссылки — шрифт FontAwesome».
- **Уверенность:** [бой] (25.09) + [исходник 2.0.1] (разметка AnchorLink).
- **Образец:** detail_list:proteus/detail-list.board.css, блок 5 (правила шрифта и исключения значков).

### BC-15. Давай всем вкладкам один вес, а активную выделяй цветом и чертой `::after`
- **Почему:** При 600 у активной (Adoption v3) названия сдвигаются при переключении (UI-15, 11-ui.md). DL 08.10:
  «вкладки не подходят». Подчёркивание выбрано вместо сегментов, чтобы вкладки борда не путались с переключателями
  внутри чартов («Таблица | Сводная»).
- **Как:**
  - Вес 500 у всех вкладок. Фиксированный `line-height`, `letter-spacing:0`, `text-transform:none`.
  - Цвета: остальные — `muted` (`#8a909c`), наведение — `ink2` (`#454b55`), активная — `ink` (`#23272e`).
  - Черта активной — `::after` 2 px акцентом отчёта на линии `#e7e9ee` (`.ant-tabs-nav::before`). `.ant-tabs-ink-bar`
    скрой: его двигает скрипт antd.
  - Полоса: `margin: 0 0 16px` (поле борда, BC-12), без высоты и отступов форка, вкладки прижаты к линии
    (`align-items:flex-end`).
  - Если вес активной обязан отличаться, резервируй ширину жирного начертания невидимой копией текста
    (`data-text` + `::after`, как во вкладках TeamPulse).
  ```css
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab-active::after {
    content: "" !important; position: absolute !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
    height: 2px !important; border-radius: 2px 2px 0 0 !important; background: #245FD4 !important;   /* акцент отчёта */
    display: block !important; z-index: 1 !important;
  }
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-ink-bar { display: none !important; }
  ```
- **Проверка:** На стенде — `click.cjs`: вес 500 у активной и у остальных, полоса не выше 40 px; переключение вкладок не
  двигает соседние названия (`getBoundingClientRect`). В бою — сниппет: шрифт, вес, цвет активной и цвет черты.
- **Уверенность:** [владелец 08.10] (DL) [не проверено в бою]; сдвиг названий при разном весе — [вывод].
- **Образец:** detail_list:proteus/detail-list.board.css, блок 5 (цвета DL, черта `#2b6cff`).
- **Спорно:** Adoption v3 до сих пор ставит активной 600 — обновить при следующей правке её CSS.

### BC-16. Крась фон под содержимым вкладок фоном борда
- **Почему:** У 2.0.1 `.ant-tabs-content-holder` белый. Серыми зазоры между чартами во вкладке на 7241 и 60260 делает
  только правило владельца `div[role=tabpanel]{background: var(--dashboard-background)}` (B8). Без него зазоры белые:
  на каркасе точка в зазоре — `rgb(255, 255, 255)`, с правилом — `#f6f6f6`.
- **Как:**
  ```css
  .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-content-holder,
  .dashboard-component-tabs:not(#xx-tabs) [role="tabpanel"] {
    background: var(--dashboard-background, #f6f6f6) !important;
  }
  /* содержимое вкладки — сразу под полосой (у Superset ещё 1 px) */
  .dashboard-component-tabs:not(#xx-tabs) .dashboard-component-tabs-content { margin-top: 0 !important; }
  ```
- **Проверка:** На стенде — каркас без слоя CSS владельца (убрать слой 3 из `skeleton.css`): пиксель в зазоре равен фону
  борда.
- **Уверенность:** [исходник 2.0.1] + стенд; правило фона не стоит ни в одной поставке — [вывод] [не проверено в бою].
- **Образец:** в поставках нет. Ближайшее — правило владельца в CSS борда 7241 (detail_list:stand/skeleton.css, слой 3) и
  `margin-top:0` в detail_list:proteus/detail-list.board.css, блок 5.

### BC-17. Давай полосе вкладок верхнего уровня фон страницы и ставь вкладки вровень с чартами
- **Почему:** Если вкладки — первая строка борда, Superset 2.0.1 рисует их полосу в липкой шапке рядом с
  `.dashboard-header-container`, а ряды кладёт прямо в сетку. Прозрачная полоса при прокрутке показывает содержимое
  под собой. Без бокового отступа вкладки не стоят вровень с чартами.
- **Как:**
  ```css
  .dashboard-header-container ~ * .dashboard-component-tabs:not(#xx-tabs) {
    background: var(--dashboard-background, #f6f6f6) !important;
  }
  .dashboard-header-container ~ * .dashboard-component-tabs:not(#xx-tabs) .ant-tabs-nav {
    margin: 0 !important; padding: 0 16px !important;
  }
  ```
  Липкая часть шапки с такими вкладками = 64 px + полоса. Это число входит в TOP высоты ряда (BC-18) и в поправку
  «видимой части» в чарте (`CFG.vis.cover`, SB-05 в 08-sandbox.md).
- **Проверка:** На стенде — detail_list `live.py ?sk=1&top=1`: фон полосы `rgb(246, 246, 246)`, вкладки с x = 16, до
  чартов 16. В бою — сниппет печатает «вкладки — верхнего уровня».
- **Уверенность:** [исходник 2.0.1] + стенд [не проверено в бою]. `.dashboard-header-container` у форка живьём не
  подтверждён; `is_css_scoped` может отрезать селекторы вне сетки (B16).
- **Образец:** detail_list:proteus/detail-list.board.css, блок 5 (вкладки верхнего уровня).

### BC-18. Задавай высоту ряда «по экрану» правилом CSS борда, кроме режима правки
- **Почему:** Владелец 08.10 (DL): «чтобы чарты растягивались от размеров экрана». Высоту ячейки задаёт раскладка (B7):
  на маленьком экране низ чарта уходит за край, на большом внизу пусто. Чарт свою высоту странице не сообщает, а в CSS
  борда `100vh` — настоящее окно (B15).
- **Как:**
  ```css
  .resizable-container:not(.dashboard--editing *):has(.dashboard-chart-id-000000, .dashboard-chart-id-111111):not(:has(.resizable-container .dashboard-chart-id-000000, .resizable-container .dashboard-chart-id-111111)) {
    height: max(560px, calc(100vh - 230px)) !important;
  }
  ```
  - Селектор пиши одной строкой. Перенос строки между `)` и `:not` — это пробел, то есть комбинатор потомка: правило
    перестанет работать.
  - `:not(:has(.resizable-container …))` берёт самый внутренний контейнер: колонка в 2.0.1 — тоже `.resizable-container`.
  - TOP (здесь 230) — верх ряда от начала страницы плюс нижнее поле. Это оценка. Точное число даёт сниппет (BC-22:
    «замените 230 на N»). На каркасе DL: 201 без ряда над вкладками, 236 с рядом «Ссылки на отчёты», 185 со вкладками
    верхнего уровня.
  - MIN (560) — под самый высокий обязательный элемент: подвал панели с «Применить», выпадашку во всю высоту ряда.
    Лучше полоса прокрутки страницы, чем «Применить» за краем окна.
  - Инлайн-высота re-resizable без `!important`, поэтому правило её перебивает. Работает только вместе с BC-04: iframe
    тянется за ячейкой.
  - Chromium сохраняет правило как `max(560px, -230px + 100vh)` — сниппет ищет обе записи.
  - «По наполнению» сделать нельзя: маркер только включает заранее написанное правило, число CSS из картинки не
    достанет. Длинное прокручивается внутри чарта. Ступени высоты отдельными маркерами (N маркеров — N правил)
    технически возможны, но канал скриншотов уже занят выпадашками и подсказками ([вывод], не делали).
  - Альтернатива — ячейка выше экрана и «видимая часть» в чарте (HRBP; UI-10, SB-05). Сторона чарта у этого правила —
    SB-06 (08-sandbox.md). Для «один экран —
    один ряд» (панель + список) бери это правило. Для длинной страницы в одной высокой ячейке — видимую часть. Линейку
    видимой части держи как страховку и здесь: не лёг CSS — ячейка снова выше экрана.
- **Проверка:** На стенде — detail_list `click.cjs DL_ONLY=board`: окно 950 → ряд 720, 820 → 590, 700 → 560; в режиме
  правки — высота из раскладки (1040). В бою — сниппет (BC-22).
- **Уверенность:** [владелец 08.10] [не проверено в бою]; селектор и запись `-230px + 100vh` — [исходник 2.0.1] + стенд.
- **Образец:** detail_list:proteus/detail-list.board.css, блок 7.

### BC-19. Ищи украшения владельца на псевдоэлементах до общего сброса и проверяй их вид
- **Почему:** `*` не выбирает `::before` и `::after`. Сброс вкладок DL не задел плашку NEW владельца на 7241
  (`span[data-test="editable-title-input"]::after`), и так и надо. Но стенд сверял только текст `content`, а фон и
  кегль подтвердил лишь отдельный замер на каркасе.
- **Как:** До того как стилизовать вкладки и ячейки, прочитай CSS борда владельца (выгрузка дашборда → поле `css`).
  Выпиши его правила, которые касаются тех же элементов: фон `div[role=tabpanel]`, плашка NEW, скругления `.fade-out`.
  Перенеси их в слой CSS владельца на каркасе стенда. Проверяй вид — фон, кегль, цвет, — а не только наличие.
- **Проверка:** На стенде — каркас со слоем CSS владельца: `getComputedStyle(el, '::after')` даёт тот же фон и кегль, что
  без файла отчёта.
- **Уверенность:** стенд (каркас DL: фон `rgb(210, 255, 114)`, 10px — вид не изменился) [не проверено в бою].
- **Образец:** detail_list:stand/skeleton.css (слой 3 — CSS борда 7241 из выгрузки).

### BC-20. Пиши id чартов числовыми заглушками и подставляй боевые сборщиком с проверкой
- **Почему:** 06.10 (DL, 13–14-я поставки) владелец менял id руками в четырёх местах. Adoption при переносе на боевой
  борд просит Ctrl+H по трём id. У TeamPulse буквенная заглушка `ID` и указание «Ctrl+H ID → число»: поиск без учёта
  регистра заденет `id` в `.dashboard-chart-id-ID` и `GRID_ID` (риск, а не случившийся инцидент).
- **Как:**
  - В исходнике — числовые уникальные заглушки (`000000`, `111111`, `222222`…), которых нет в тексте ни в каком
    другом виде. Те же id стенд даёт своим чартам.
  - Сборщик держит таблицу `BOARD_IDS` из JSON-метаданных борда; у тестового и боевого бордов наборы разные. Проверки:
    заглушка встречается; боевого id до подстановки нет; после подстановки заглушек не осталось.
  - Неизвестный id оставь заглушкой. Шапка файла пишет, что подставлено, а что заменить руками.
  - Тот же приём для сниппета DevTools: заглушка ровно один раз в строке конфигурации.
  ```python
  BOARD_IDS = {'000000': '802568', '111111': None}   # None — id ещё нет: заглушка остаётся, шапка просит заменить руками
  for ph, real in BOARD_IDS.items():
      if real:
          assert css.count('chart-id-' + ph) and 'chart-id-' + real not in css
          css = css.replace('chart-id-' + ph, 'chart-id-' + real)
          assert ph not in css
  ```
- **Проверка:** `python3 stand/pack.py --check`.
- **Уверенность:** стенд (`pack.py --check`) + [бой] (ручная замена 06.10).
- **Образец:** detail_list:stand/pack.py (`BOARD_IDS`, `css_for`, `board_check`). Общий шаблон сборщика — kit/;
  правило заглушек для всех файлов поставки — 14-delivery.md.

### BC-21. Предупреждай в шапке файла о красных «!» редактора CSS
- **Почему:** Редактор CSS Proteus (B12) помечает `:has(` как ошибку, на `:not(.x *)` даёт 5 ошибок, на `max()` —
  предупреждение. Правила работают (DL — с 10-й поставки), но владелец пугается «ошибок».
- **Как:** В шапке файла одна строка: «Красные „!“ редактора у строк с `:has(…)`, `:not(… *)` и `max(…)` — линтер их не
  знает, на работу не влияет». Без `:has()` нет ни скоупа по своим чартам, ни маркеров, ни загрузки — заменить его
  нечем. Браузер без `:has` (Chromium младше 105) не применит ни одного блока. Версию корпоративного браузера коллег
  узнай у владельца (17-open-questions.md).
- **Проверка:** В бою «Сохранить» проходит, вид как на стенде.
- **Уверенность:** [бой] (`:has` работает у владельца) + [исходник 2.0.1] (CSSLint Ace); браузеры коллег — [не проверено в бою].
- **Образец:** detail_list:proteus/detail-list.board.css (шапка; дописать `:not(… *)` и `max()`).

### BC-22. Меряй геометрию борда сниппетом DevTools на живой странице, а не догадкой
- **Почему:** 18.09 самодельный стенд Adoption вписал платформе `.chart-slice{display:flex}`, которого у форка нет:
  стенд проходил, а борд — нет, раунды 8–10 ушли впустую. Поле 16 px у холдера нашёл только сниппет цепочки родителей
  на живом борде (раунд 12). Классы вокруг сетки живьём не подтверждены ни в одном проекте (BC-23).
- **Как:**
  - Файл поставки «N. Проверка на бою — разметка борда (DevTools).js»: IIFE на ES5, только читает и печатает текст
    одним `console.log`. Шапка: «F12 → Console → вставить → Enter; ничего не меняет и никуда не отправляет; прислать
    вывод целиком». В инструкции — подсказка про `allow pasting` в Chrome.
  - Что печатает:
    1. окно и предупреждение о режиме правки (тогда чисел не советовать);
    2. поля слева, справа и между чартами против цели;
    3. вкладки — свои или верхнего уровня; от линии вкладок до чартов, высоту полосы, от шапки борда до вкладок;
       ряды над вкладками с id их чартов;
    4. активную вкладку: шрифт, кегль, вес, цвет, фон, черту `::after`, шрифт значка ссылки;
    5. ряд: верх от начала страницы, высоту, высоту из раскладки, зазор до низа окна;
    6. число блока высоты — из CSS на странице (`document.styleSheets` в try/catch, регулярка на обе записи
       `100vh - Npx` и `-Npx + 100vh`) против рекомендованного «верх ряда + поле»;
    7. цепочку от ячейки вверх, до 24 уровней: тег, id, классы, координаты, размеры, ненулевые поля и отступы,
       непрозрачный фон.
  - Выход — строки «что есть · цель — N» и готовое действие: «замените 230 на 236 (Ctrl+H), сохраните, обновите».
  - Цель «от шапки до вкладок» зависит от раскладки: для вкладок верхнего уровня она 0, а не 16. Это недочёт файла 12
    DL.
  - Стенд гоняет тот же текст сниппета, что уезжает владельцу (13-stand.md).
  ```js
  // число блока высоты — как оно стоит в CSS страницы (обе записи браузера)
  var m = /100vh\s*-\s*(\d+)px|-(\d+)px\s*\+\s*100vh/.exec(rule.cssText);
  if (m && /resizable-container/.test(rule.cssText)) top7 = +(m[1] || m[2]);
  ```
- **Проверка:** На стенде — `click.cjs DL_ONLY=board` выполняет файл 12 на каркасе (ответы 201 / 236 / 185 по раскладке).
  В бою — вывод владельца.
- **Уверенность:** [бой] — метод (раунд 12 Adoption); сниппет DL — стенд, в бою ещё не выполнялся [не проверено в бою].
- **Образец:** detail_list:proteus/detail-list.board-check.js (файл 12). Минимальный вариант — однострочник «рамка вокруг
  отчёта» в HRBP_HUB:Поставка — HRBP HUB v2/0. Инструкция.md. Шаблон сниппета — kit/; формат файла и инструкции —
  14-delivery.md.

### BC-23. Сверяй селекторы с картой DOM 2.0.1, а классы вокруг сетки подтверждай живьём
- **Почему:** Proteus — 2.0 с бэкпортами 2.1+ во фронтенде дашборда (F3, 01-platform.md). Часть правил форка —
  рантаймовые emotion-классы (B3), а `.chart-slice` у форка не флекс, в отличие от 2.0.1. Живьём подтверждены цепочка
  ячейки и вкладки (60260). Сетка, режим правки и шапка — только по исходнику, а `is_css_scoped` может менять область
  действия CSS (B16).
- **Как:**
  - Селекторы пиши через пробел (потомок), а не через `>`: между `.dragdroppable-row` и `.grid-row` стоит
    `.with-popover-menu`, между `.grid-row` и `.resizable-container` — `.dragdroppable-column`.
  - Каждый класс, не подтверждённый живьём, помечай в комментарии файла и в разделе «Что не проверено» поставки.
  - Каркас стенда собирай в три слоя: правила из сборки 2.0.1 (чанки CSS, emotion, antd 4), реплика правил форка по
    фото, CSS владельца из выгрузки. Ничего «платформенного» по догадке в стенд не вписывай (13-stand.md).
  - Есть реплика сохранённой страницы живого борда — сверяй геометрию на ней.
- **Проверка:** Сниппет (BC-22) на живом борде печатает цепочку вверх. По ней поправь карту и CSS.
- **Уверенность:** [исходник 2.0.1] + [бой] (цепочка ячейки и вкладок, 60260); классы сетки — [не проверено в бою].
- **Образец:** detail_list:stand/skeleton.css (каркас в три слоя); adoption:memory/proteus-adoption-html-embedding.md
  (цепочка с живого борда).

---

## Каркас файла CSS борда

Сборка правил главы для ряда «панель с выпадашкой (`111111`) + главный чарт (`000000`)». Это эталон блоков, а не
готовый файл: подставь заглушки своего отчёта, маркеры своих чартов (BC-10), префикс `xx` и цвет акцента. Каркас
прогнан в Chromium 141 на разметке Superset 2.0.1 (стенд): до отрисовки холдер прозрачный, без поля, подпись
«Загружаю…», заглушка скрыта; после — iframe на всю ячейку, значок Proteus скрыт; с маркером выпадашки iframe
шириной `100vw − 48`, с маркером подсказки — ячейка + 360 px; поля сетки 16; правило высоты сохраняется как
`max(560px, -230px + 100vh)`.

```css
/* ==========================================================================
   <Отчёт> — CSS борда. Вставить ЦЕЛИКОМ в конец CSS дашборда, прежний блок <Отчёта> — удалить.
   Блоки: 1 — ячейки, 2 — выпадашка панели, 3 — подсказки панели, 4 — загрузка, 5 — вкладки, 6 — поля,
   7 — высота ряда по экрану, 8 — тур (швы).
   id чартов борда уже подставлены: 802568 — <главный чарт>, 803291 — <панель>.   ← пишет сборщик (BC-20)
   Красные «!» редактора у строк с :has(…), :not(… *) и max(…) — линтер их не знает, на работу не влияет.
   ========================================================================== */

/* 1. Ячейки: без белой карточки (и до отрисовки), цепочка до iframe — флекс / 100 %, от шапки чарта — только меню */
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) {
  background-color: transparent !important; padding: 0 !important; box-shadow: none !important; border: 0 !important;
  height: 100% !important; display: flex !important; flex-direction: column !important;
}
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .chart-slice,
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .dashboard-chart,
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .chart-container,
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .slice_container,
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .slice_container > div,
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .react_sanbbox {
  display: flex !important; flex-direction: column !important; flex: 1 1 auto !important;
  min-height: 0 !important; padding: 0 !important; background: transparent !important;
}
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .chart-container { background: #fff !important; border-radius: 12px !important; }   /* подложка размера чарта */
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .header-title { display: none !important; }
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .chart-slice { position: relative !important; }
.dashboard-component-chart-holder:is(.dashboard-chart-id-000000, .dashboard-chart-id-111111, :has(#chart-id-000000, #chart-id-111111)) .chart-header {
  position: absolute !important; top: 0 !important; right: 0 !important; z-index: 11 !important; margin: 0 !important;
}
#chart-id-000000 iframe, #chart-id-111111 iframe {
  display: block !important; flex: 1 1 auto !important; width: 100% !important; height: 100% !important;
  min-height: 0 !important; border: 0 !important;
}

/* 2. Панель — выпадашка вправо поверх соседа (маркер «XX-DD-ON-001») */
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) .slice_container,
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) .chart-container,
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) .dashboard-chart { overflow: visible !important; }
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) #chart-id-111111 { position: relative !important; }
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtREQtT04tMDAx"]) #chart-id-111111 iframe {
  position: absolute !important; top: 0 !important; left: 0 !important; width: calc(100vw - 48px) !important;
  height: 100% !important; z-index: 998 !important; background: transparent !important;
}

/* 3. Панель — подсказки: свой маркер «XX-TIP-ON-01», малый разворот */
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtVElQLU9OLTAx"]) .slice_container,
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtVElQLU9OLTAx"]) .chart-container,
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtVElQLU9OLTAx"]) .dashboard-chart { overflow: visible !important; }
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtVElQLU9OLTAx"]) #chart-id-111111 { position: relative !important; }
.dashboard-chart-id-111111:has(img.echarts-plugin[src*="WFgtVElQLU9OLTAx"]) #chart-id-111111 iframe {
  position: absolute !important; top: 0 !important; left: 0 !important; width: calc(100% + 360px) !important;
  height: 100% !important; z-index: 998 !important; background: transparent !important;
}

/* 4. Загрузка: пока нет iframe — карточка, значок Proteus и подпись; после отрисовки значок Proteus не нужен */
.dashboard-chart-id-000000:not(:has(iframe)) .slice_container,
.dashboard-chart-id-111111:not(:has(iframe)) .slice_container { visibility: hidden !important; }
.dashboard-chart-id-000000:not(:has(iframe)) .chart-container,
.dashboard-chart-id-111111:not(:has(iframe)) .chart-container { position: relative !important; }
.dashboard-chart-id-000000:not(:has(iframe)) .chart-container::after,
.dashboard-chart-id-111111:not(:has(iframe)) .chart-container::after {
  content: 'Загружаю…'; position: absolute; left: 0; right: 0; top: calc(50% + 26px); text-align: center;
  font: 500 13px/1.4 Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #8a909c;
  pointer-events: none; animation: xx-load-pulse 1.6s ease-in-out infinite;
}
@keyframes xx-load-pulse { 50% { opacity: .6; } }
.dashboard-chart-id-000000:has(iframe) img.loading, .dashboard-chart-id-000000:has(iframe) [aria-label="Loading"],
.dashboard-chart-id-111111:has(iframe) img.loading, .dashboard-chart-id-111111:has(iframe) [aria-label="Loading"] {
  display: none !important;
}

/* 5. Вкладки — BC-13…BC-17 целиком (длинный блок): detail_list:proteus/detail-list.board.css, блок 5,
      с заменой #dl-tabs на #xx-tabs и цвета черты на акцент отчёта, плюс фон содержимого (BC-16). */

/* 6. Поля — одно поле 16 px */
.grid-container:not(.dashboard--editing *):not(#xx-grid) { margin: 16px !important; }
.dashboard-grid .grid-content > :not(:last-child) { margin-bottom: 16px !important; }

/* 7. Высота ряда по экрану (230 — уточнить файлом проверки разметки) */
.resizable-container:not(.dashboard--editing *):has(.dashboard-chart-id-000000, .dashboard-chart-id-111111):not(:has(.resizable-container .dashboard-chart-id-000000, .resizable-container .dashboard-chart-id-111111)) {
  height: max(560px, calc(100vh - 230px)) !important;
}

/* 8. Тур — швы между чартами: TR-16 (12-tour.md) */
```

## Что не проверено в бою (кратко; полный список — 17-open-questions.md)

| Вопрос | Как проверить | От чего зависит |
|---|---|---|
| Пропала ли заглушка «Не было получено данных» под блоком загрузки | Cmd+Shift+R на борде; если надпись видна — класс элемента через «Просмотреть код» | BC-06 |
| Классы `.grid-container`, `.dashboard--editing`, `.dashboard-header-container` у форка | вывод сниппета разметки (цепочка вверх) | BC-12, BC-17, BC-18 |
| Что делает `is_css_scoped: true` | вывод сниппета (легли ли блоки 6–7); вопрос администратору Proteus | BC-12, BC-17, BC-18 |
| Точное число TOP для высоты ряда | сниппет разметки: «замените 230 на N» | BC-18 |
| Селекторы значка загрузки форка | «Применить» на борде; если значок виден поверх плашки — класс элемента | BC-07 |
| Браузеры коллег и `:has()` | версия браузера у коллег (Chromium 105+) | все блоки |
| Мешает ли меню «⋯» правым кнопкам шапки чарта | наведение на правый верх ячейки | BC-05 |
| Фон под содержимым вкладок без правила владельца | борд без `div[role=tabpanel]{background:…}` | BC-16 |

## Связанные главы

- 01-platform.md — факты платформы: версия фронтенда, песочница, канал скриншотов (F3, F23).
- 05-dataset.md — DS-08: ответ всегда с meta (предусловие блока загрузки).
- 08-sandbox.md — сторона чарта: SB-05 (видимая часть), SB-06 (ряд по экрану), SB-11…SB-15 (разворот по маркеру),
  SB-20 (модель песочницы на стенде).
- 11-ui.md — вид внутри чарта: UI-04 (шрифт), UI-05 (акцент — тот же у черты вкладок), UI-08 (карточка вровень с
  ячейкой), UI-15 (без скачков вёрстки), UI-23 (своя плашка пересчёта).
- 12-tour.md — TR-16: затемнение швов между чартами по маркеру тура.
- 13-stand.md — каркас дашборда Superset 2.0.1 на стенде, прогон CSS и сниппета.
- 14-delivery.md — заглушки и сборщик поставки, сниппет DevTools в инструкции, стоп-точки.
- 16-antipatterns.md — что ломалось в CSS борда.
- 17-open-questions.md — что подтвердить в бою.

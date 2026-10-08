// ============================================================================
// TeamPulse Hub — чарт Proteus (тип ECHARTS), пробник. СОБРАН АВТОМАТИЧЕСКИ:
// не правьте здесь — правка живёт в исходниках макета (папка «Team Pulse»),
// сборка: cd "Team Pulse/proteus" && node build.js.
// Данные — датасет teampulse_hub (файл 2). «Измерения» чарта — все колонки
// датасета: role, id, pid, lvl, nm, kids, j, m_hc, m_act, m_avg, m_hire, m_fire,
// m_reg, m_tin, m_tout, m_plow, m_prat. Метрик нет, сортировки нет.
// Визуализация — HTML и SVG поверх хоста ECharts; холст пустой (option ниже).
// Кросс-фильтры чарт шлёт сам себе: unit_f, paint_f, it_f, staff_f.
// ============================================================================
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != _typeof(t) || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
var TP_CSS = "/* ===== TeamPulse Hub — дизайн-система (токены из референса HRBP HUB) ===== */\n:root{\n  --bg:#f4f5f7; --card:#ffffff; --line:#e7e9ee; --line2:#eef0f3;\n  --ink:#1f1f1f; --ink2:#3a3f4a; --muted:#8a909c; --muted2:#aab0bb;\n  --green:#12b048; --green-bg:#bff2cd; --green-tx:#0a8f3c;\n  --red:#f51f1f;   --red-bg:#ffcccc;  --red-tx:#d11414;\n  --warn:#f59300;  --warn-bg:#ffe6a0; --warn-tx:#9a6500;\n  /* ---------- Акцент: кобальт ----------\n     Один активный тон на всё: кнопки, выбранная строка, фокус, линия\n     подразделения на графиках. «Активное в интерфейсе» и «активное в данных» —\n     один цвет, отдельного синего в системе больше нет.\n\n     Почему кобальт, а не петроль #0073A0 из ДС Adoption. У всех серых отчёта\n     холодный сине-фиолетовый подтон: OKLCH-тон 263–268°. У #0073A0 тон 235° —\n     на 30° ближе к бирюзе, и рядом с серыми он читался «морским», чужим; к тому\n     же он совпадал по тону с цветами данных (переводы #3c84ab, вакансии) и\n     был вдвое менее насыщен, чем основной синий ведущих систем.\n     #245FD4 = oklch(0.52 0.19 262): тон серых, насыщенность и светлота из\n     коридора Carbon / Primer / Atlassian / Tailwind (тон 257–264°, C 0,16–0,24),\n     контраст с белым 5,7:1. Все ступени ниже — тот же тон 262° в OKLCH. */\n  --act:#245FD4;   --act-ink:#1545A3; --act-line:#C8D8F6;\n  --blue:var(--act); --blue-bg:#EEF4FF;\n  /* полосы в ячейках — светлая ступень того же тона: это фон под числом, а не\n     марка, за которой следят; тёмная полоса перетягивала взгляд с цифры */\n  --bar-soft:#82AAF5;\n  /* фиолетовый палитры — только у AI-подсказок: единственное на экране, что\n     не является ни активным состоянием, ни величиной */\n  --ai:#AA77FF;    --ai-bg:#F1E9FF;   --ai-tx:#6C36C9;\n  --bench:#9aa0ac;\n\n  /* ---------- Шкала расстояний ----------\n     Отступы в макете брались на глаз: 7, 9, 13, 17 пикселей рядом\n     друг с другом читаются как одно и то же, но не совпадают. */\n  --s1:2px;  --s2:4px;  --s3:6px;  --s4:8px;  --s5:10px;\n  --s6:12px; --s7:14px; --s8:16px; --s9:20px; --s10:24px;\n\n  /* ---------- Семь типографических ролей ----------\n     Было двадцать один кегль. Разница в полпикселя не читается как\n     иерархия — она читается как неаккуратность. */\n  --fs-micro:9.5px;  /* служебные подписи в плотных таблицах */\n  --fs-cap:10.5px;   /* шапки колонок, подписи осей */\n  --fs-note:11.5px;  /* сноски и пояснения */\n  --fs-body:12.5px;  /* основной текст таблиц */\n  --fs-lead:13.5px;  /* имена строк и метрик */\n  --fs-head:16px;    /* заголовки блоков */\n  --fs-hero:24px;    /* главное число карточки */\n\n  /* ---------- Два начертания: обычное и жирное ----------\n     В Proteus работает только Arial, а у Arial ровно два начертания —\n     Regular (400) и Bold (700). Промежуточные веса браузер подменяет сам:\n     500 рисует обычным, 600 — жирным. Прежняя шкала из четырёх ролей\n     (400 / 500 / 600 / 700) в Proteus поэтому схлопывалась: всё полужирное —\n     имена строк, шапки, кнопки, пункты меню, пояснения в справке — выходило\n     таким же жирным, как заголовки и итоги, и иерархия пропадала вместе\n     с разницей между 600 и 700.\n\n     Теперь вес отвечает на один вопрос: сюда смотреть или это читать подряд.\n     700 — то, на что смотрят: заголовки, итоги, главное число строки,\n       значение KPI и подсказки, активный пункт, рубрики капсом.\n     400 — всё остальное: данные, имена строк, подписи, сноски, кнопки,\n       пилюли. Второй план отличается цветом и кеглем, а не весом.\n\n     --fw-med и --fw-lead — алиасы обычного начертания: имена токенов не\n     ломаем, но в правилах их больше не используем. Третьего веса в Arial\n     нет, и делать вид, что он есть, — значит снова получить жирное везде. */\n  --fw-body:400; --fw-bold:700;\n  --fw-med:var(--fw-body); --fw-lead:var(--fw-body);\n\n  /* ---------- Пять радиусов плюс пилюля ----------\n     Было четырнадцать значений от 2 до 20 пикселей. */\n  /* Воздух между двумя графиками, стоящими друг под другом. Не из шкалы\n     расстояний намеренно: это не отступ вёрстки, а зеркало константы\n     STACK_GAP из draw.js, которая задаёт то же расстояние между панелями\n     внутри одного SVG. Два механизма, одна величина — иначе на соседних\n     вкладках одинаковый по смыслу зазор выглядит разным. Расхождение\n     ловит проверка в smoke.js. */\n  --chart-gap:26px;\n\n  --r1:3px; --r2:6px; --r3:9px; --r4:12px; --r5:16px; --r-pill:999px;\n  --radius:var(--r4);\n  /* единый левый край текста в ячейках таблиц: было 8/10/12/14 в четырёх местах */\n  --pad-cell:var(--s5);\n  --shadow:0 1px 3px rgba(20,28,45,.06),0 4px 16px rgba(20,28,45,.04);\n  --shadow-lg:0 8px 28px rgba(20,28,45,.16);\n}\n*{box-sizing:border-box}\n/* Макет светлый, и системные контролы обязаны это знать: без color-scheme\n   браузер при тёмной теме ОС рисует нативные списки и полосы прокрутки чёрными. */\n:root{color-scheme:light}\nhtml,body{margin:0;padding:0}\n/* Только Arial: другие гарнитуры в Proteus не работают, а веб-шрифт без\n   сети не грузится. sans-serif — не второй шрифт, а страховка на машине\n   без Arial (Linux): без неё браузер откатился бы к засечному по умолчанию. */\nbody{font-family:Arial,sans-serif;background:var(--bg);color:var(--ink);font-size:14px;-webkit-font-smoothing:antialiased}\nbutton,select,input,textarea{font-family:inherit}\n.hidden{display:none!important}\n\n/* ===== Шапка приложения ===== */\n.apphead{background:#fff;border-bottom:1px solid var(--line)}\n.apphead-top{display:flex;align-items:center;gap:14px;padding:12px 22px}\n.logo{font-weight:var(--fw-bold);font-size:18px;letter-spacing:-.2px;display:flex;align-items:center;gap:9px}\n.logo .mark{width:26px;height:26px;border-radius:var(--r3);background:var(--act);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:var(--fw-bold)}\n.logo small{color:var(--muted);font-weight:var(--fw-body);font-size:12px}\n.apphead .spacer{flex:1}\n.freshness{font-size:var(--fs-note);color:var(--muted);font-weight:var(--fw-body);display:flex;align-items:center;gap:var(--s3)}\n.freshness b{color:var(--ink);font-weight:var(--fw-body)}\n.freshness .dot{width:7px;height:7px;border-radius:50%;background:var(--green);flex:0 0 auto}\n.btn{border:1px solid var(--line);background:#fff;border-radius:var(--r3);padding:8px 14px;font-weight:var(--fw-body);color:var(--ink2);cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:7px;transition:background .15s,border-color .15s}\n.btn:hover{background:#fafbfc;border-color:#d8dce4}\n.btn.primary{background:var(--act);border-color:var(--act);color:#fff}\n.btn.primary:hover{background:var(--act-ink)}\n.btn.ghost{border-color:transparent;color:var(--blue)}\n.btn.ghost:hover{background:var(--blue-bg)}\n\n/* ===== Заголовок отчёта в теле дашборда ===== */\n.reporthead{background:#fff;border-bottom:1px solid var(--line);padding:15px 22px 16px}\n.rh-row{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap}\n.rh-main{min-width:0;flex:1}\n.rh-crumbs{font-size:var(--fs-note);color:var(--muted);font-weight:var(--fw-body);margin-bottom:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n.rh-crumbs .sep{color:var(--muted2)}\n.rh-crumbs button{border:0;background:transparent;padding:0;font:inherit;color:var(--blue);cursor:pointer}\n.rh-crumbs button:hover{text-decoration:underline}\n.rh-title{font-size:23px;font-weight:var(--fw-bold);letter-spacing:-.4px;margin:0 0 8px;line-height:1.2}\n.rh-title .lvl{font-size:11px;font-weight:var(--fw-bold);text-transform:uppercase;letter-spacing:.4px;color:var(--blue);background:var(--blue-bg);border-radius:var(--r2);padding:3px 8px;margin-left:10px;vertical-align:middle}\n.rh-side{display:flex;align-items:center;gap:10px}\n\n/* чипы активных фильтров */\n.chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n.chip{display:inline-flex;align-items:center;gap:7px;border-radius:var(--r-pill);padding:5px 12px;font-size:12px;font-weight:var(--fw-bold);background:var(--blue-bg);color:var(--act-ink);border:1px solid var(--act-line)}\n.chip .x{width:14px;height:14px;border-radius:50%;border:0;background:rgba(36,95,212,.14);color:var(--act-ink);font-size:11px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}\n.chip .x:hover{background:rgba(36,95,212,.28)}\n.chip.bench{background:#f4f5f7;color:var(--ink2);border-color:var(--line);font-weight:var(--fw-body)}\n.chip.bench b{color:var(--ink);font-weight:var(--fw-bold)}\n/* .chip.empty («Разрезы не выбраны») удалён вместе с самим пустым состоянием:\n   плашка занимала строку и ничего не сообщала. */\n\n/* ===== Layout ===== */\n.layout{display:flex;min-height:calc(100vh - 168px);align-items:stretch}\n.nav{width:236px;flex:0 0 236px;background:#fff;border-right:1px solid var(--line);padding:16px 12px 44px}\n.nav-h{font-size:var(--fs-cap);text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:var(--fw-bold);margin:0 0 9px;padding:0 10px}\n.nav-i{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;text-align:left;padding:10px 11px;border-radius:var(--r3);font-size:var(--fs-lead);font-weight:var(--fw-body);color:var(--ink2);cursor:pointer;margin-bottom:2px;transition:background .15s}\n.nav-i:hover{background:#f4f6fa}\n.nav-i.active{background:var(--blue-bg);color:var(--act-ink);font-weight:var(--fw-bold)}\n.nav-i .ico{width:8px;height:8px;border-radius:var(--r1);background:var(--muted2);flex:0 0 auto}\n.nav-i.active .ico{background:var(--blue)}\n/* Точка сигнала блока. Вытесняет и активный синий: у активного пункта уже есть\n   заливка строки, а сигнал на нём важнее, чем повтор выделения. */\n.nav-i .ico.sig-bad{background:var(--red);border-radius:50%}\n.nav-i .ico.sig-good{background:var(--green);border-radius:50%}\n.nav-sep{height:1px;background:var(--line2);margin:12px 8px}\n.content{flex:1;padding:18px 26px 64px;min-width:0;background:var(--bg)}\n\n/* ===== Заголовок страницы/блока ===== */\n.page-h{margin:0 0 16px}\n.page-h h2{font-size:19px;margin:0 0 4px;font-weight:var(--fw-bold);letter-spacing:-.3px}\n.page-h p{margin:0;color:var(--muted);font-size:13px;max-width:900px;line-height:1.45}\n.block-h{display:flex;align-items:baseline;gap:12px;margin:24px 0 9px;flex-wrap:wrap}\n.block-h:first-of-type{margin-top:6px}\n.block-name{font-size:var(--fs-head);font-weight:var(--fw-bold);letter-spacing:-.2px}\n.block-hint{font-size:12px;color:var(--muted);font-weight:var(--fw-body)}\n.block-h .btn{margin-left:auto}\n\n/* ===== KPI ===== */\n.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(176px,1fr));gap:14px;margin-bottom:18px}\n.kpis.n1{grid-template-columns:minmax(0,260px)}\n.kpis.n2{grid-template-columns:repeat(2,minmax(0,1fr))}\n.kpis.n3{grid-template-columns:repeat(3,minmax(0,1fr))}\n.kpis.n4{grid-template-columns:repeat(4,minmax(0,1fr))}\n.kpis.n5{grid-template-columns:repeat(5,minmax(0,1fr))}\n.kpis.compact{gap:12px;margin-bottom:16px}\n.kpis.compact .kpi{padding:13px 15px}\n.kpis.compact .k-val{font-size:var(--fs-hero)}\n.kpis.compact .k-row{margin-top:6px;gap:8px}\n.kpi{background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);padding:15px 17px}\n.kpi .k-label{font-size:var(--fs-note);color:var(--muted);font-weight:var(--fw-body);margin-bottom:7px;display:flex;align-items:center;gap:6px}\n.kpi .k-val{font-size:27px;font-weight:var(--fw-bold);letter-spacing:-.6px;line-height:1.1}\n.kpi .k-row{display:flex;align-items:center;gap:9px;margin-top:8px;flex-wrap:wrap}\n/* пустой второй ряд карточка рисует всегда (ей нужно ровно четыре строки),\n   но воздуха он не занимает */\n.kpi .k-row:empty{margin:0}\n.kpi .k-sub{font-size:var(--fs-note);color:var(--muted);font-weight:var(--fw-body)}\n.kpi .k-sub b{color:var(--ink);font-weight:var(--fw-body)}\n\n/* ---------- Одна высота строк во всей полосе KPI ----------\n   Заголовок метрики в одной карточке переносился на две строки — и её\n   значение, дельта и подпись базы уезжали вниз относительно соседей. Полоса\n   переставала читаться как строка: глазу приходилось искать, где чьё число.\n\n   Карточка объявлена subgrid'ом на пять строк родителя (пятая — «год назад»), поэтому высоту\n   каждой строки задаёт самая высокая карточка полосы: перенёсся заголовок\n   у одного KPI — лишняя строка появилась у всех, зато цифры остались на\n   общем уровне. Это ровно тот размен, который выбрал заказчик.\n\n   Собственные отступы строк сохранены, а gap внутри карточки обнулён: иначе\n   subgrid унаследовал бы междукарточные 14px и разорвал бы карточку. Правило\n   под @supports: без subgrid карточка обязана остаться обычным блоком, иначе\n   grid-row:span 5 растянул бы её по пустым строкам. */\n@supports (grid-template-rows:subgrid){\n  .kpi{display:grid;grid-template-rows:subgrid;grid-row:span 5;row-gap:0}\n}\n\n/* ===== Панели ===== */\n.panel{background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}\n.panel-h{padding:var(--s7) var(--s8);font-weight:var(--fw-bold);font-size:14.5px;border-bottom:1px solid var(--line2);display:flex;align-items:center;justify-content:space-between;gap:12px}\n.panel-h .sub{font-size:var(--fs-note);color:var(--muted);font-weight:var(--fw-body)}\n.panel-b{padding:var(--s7) var(--s8)}\n\n/* ===== Дельты и статусы ===== */\n.delta{display:inline-flex;align-items:center;gap:5px;font-size:var(--fs-note);font-weight:var(--fw-body);padding:3px 7px;border-radius:var(--r2);white-space:nowrap;cursor:help}\n/* «к маю» внутри пилюли: с чем сравнивается изменение. Тише самого числа —\n   число несёт факт, подпись объясняет, откуда он взялся. */\n.delta .d-vs{font-weight:var(--fw-body);font-size:var(--fs-cap);opacity:.72}\n.delta.up{background:var(--green-bg);color:var(--green-tx)}\n.delta.down{background:var(--red-bg);color:var(--red-tx)}\n.delta.flat{background:#f0f1f3;color:var(--muted)}\n.delta.neu{background:#f0f1f3;color:var(--ink2)}\n.sig-chip{display:inline-block;font-size:11px;font-weight:var(--fw-body);padding:3px 8px;border-radius:var(--r2);white-space:nowrap}\n.sig-chip.good{background:var(--green-bg);color:var(--green-tx)}\n/* «на уровне» и «зона риска» — серые: в светофоре осталось два цвета, зелёный\n   и красный. Жёлтый требовал третьего решения там, где решения нет. */\n.sig-chip.warn{background:#f3f4f6;color:var(--muted)}\n.sig-chip.bad{background:var(--red-bg);color:var(--red-tx)}\n.sig-chip.neutral{background:#f3f4f6;color:var(--muted)}\n/* тег KPI — метка «у метрики есть цель», а не оценка: жёлтый читался сигналом */\n.kpi-tag{display:inline-block;font-size:9px;font-weight:var(--fw-bold);text-transform:uppercase;letter-spacing:.3px;padding:2px 6px;border-radius:var(--r2);background:var(--blue-bg);color:var(--act-ink)}\n.spark{display:inline-block;vertical-align:middle}\n\n/* ===== Таблица метрик OnePager ===== */\n.mtable{width:100%;border-collapse:collapse;table-layout:fixed}\n.mtable thead th{font-size:var(--fs-cap);text-transform:uppercase;letter-spacing:.3px;color:var(--muted);font-weight:var(--fw-bold);text-align:left;padding:11px 8px;border-bottom:1px solid var(--line2);white-space:nowrap}\n.mtable thead th.num{text-align:right}\n/* месяц сравнения второй строкой шапки: «за месяц» без него не говорит,\n   с чем сравнивается число. Не капсом — это пояснение, а не имя колонки */\n.mtable thead th .th-sub{display:block;margin-top:2px;font-size:var(--fs-micro);font-weight:var(--fw-body);\n  text-transform:none;letter-spacing:0;color:var(--muted2)}\n.mtable tbody tr{border-bottom:1px solid var(--line2)}\n.mtable tbody tr:last-child{border-bottom:0}\n.mrow{cursor:pointer}\n.mrow:hover{background:#fafbfc}\n.mrow td{padding:11px 8px;vertical-align:middle}\n/* Каретка в конце строки — единственный признак того, что строка раскрывается.\n   Курсор-указатель на всей строке об этом не сообщал: его не видно, пока\n   не наведёшь, а наводить незачем, если не ждёшь, что что-то откроется. */\n.mtable td.col-caret{text-align:center;padding:11px 4px}\n.row-caret{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;\n  border-radius:var(--r2);color:var(--muted);font-size:12px;line-height:1;\n  transition:color .15s,background .15s}\n.mrow:hover .row-caret{color:var(--blue);background:var(--blue-bg)}\n.row-caret.on{color:var(--blue)}\n.m-name{font-weight:var(--fw-body);font-size:var(--fs-lead);border-left:3px solid var(--bench);padding-left:12px!important;word-break:break-word}\n.m-name .m-sub{display:block;font-size:11px;color:var(--muted);font-weight:var(--fw-body);margin-top:2px}\n.m-name.bar-good{border-color:var(--green)}\n.m-name.bar-bad{border-color:var(--red)}\n.m-name.bar-warn{border-color:var(--bench)}\n.m-name.bar-neutral{border-color:var(--bench)}\n.m-val{text-align:right;font-size:var(--fs-head);font-weight:var(--fw-bold);white-space:nowrap}\n.col-num{text-align:right}\n.tgt{font-size:var(--fs-note);color:var(--muted);font-weight:var(--fw-body);line-height:1.4;white-space:nowrap;text-align:right}\n.tgt b{color:var(--ink2);font-weight:var(--fw-body);display:block;font-size:var(--fs-body)}\n.detail-row td{padding:0 16px 16px;background:#fafbfc}\n.detail-chart{height:250px;width:100%}\n/* Единый значок справки: круг с «i». Один значок на весь отчёт — и в KPI\n   блоков, и в OnePager. Начертание — шрифт интерфейса: прежняя Georgia\n   читалась как чужеродная засечка. Раскрывается наведением, не кликом. */\n.info{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;\n  border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--muted);\n  font-family:inherit;font-size:11px;font-weight:var(--fw-bold);line-height:1;letter-spacing:.2px;\n  cursor:help;flex:0 0 auto;user-select:none;transition:border-color .12s,color .12s,background .12s}\n.info:hover{border-color:var(--act);background:var(--blue-bg);color:var(--act)}\n\n/* ===== Сводная таблица подразделений ===== */\n.ptable{width:100%;border-collapse:collapse;font-size:var(--fs-body)}\n.ptable th{font-size:var(--fs-cap);text-transform:uppercase;letter-spacing:.3px;color:var(--muted);font-weight:var(--fw-bold);text-align:right;padding:var(--s5) var(--s4);border-bottom:1px solid var(--line2);white-space:nowrap}\n.ptable th.txt{text-align:left;padding-left:var(--pad-cell)}\n.ptable td{text-align:right;padding:var(--s4);font-weight:var(--fw-body);border-bottom:1px solid var(--line2);white-space:nowrap}\n.ptable td.txt{text-align:left;font-weight:var(--fw-body);padding-left:var(--pad-cell)}\n.ptable tr.urow{cursor:pointer}\n.ptable tr.urow:hover{background:#fafbfc}\n.ptable tr.urow.empty td{color:var(--muted2)}\n.ptable tr.urow.empty .row-body{color:var(--muted);font-weight:var(--fw-body)}\n.ptable tr.urow.empty .cell{opacity:.45}\n.ptable tr.urow.sel{background:#F5F9FE;box-shadow:inset 3px 0 0 var(--act)}\n.ptable tr.total td{border-top:2px solid var(--line);border-bottom:0;font-weight:var(--fw-bold);background:#fafbfc}\n.ptable tr.lvl2 td.txt{padding-left:34px;font-weight:var(--fw-body);color:var(--ink2)}\n.unit-sub{display:block;font-size:var(--fs-cap);color:var(--muted);font-weight:var(--fw-body);margin-top:1px}\n.cell{margin:3px;border-radius:var(--r3);padding:7px 4px;font-weight:var(--fw-body);font-size:var(--fs-body);line-height:1.15}\n.cell.good{background:var(--green-bg);color:var(--green-tx)}\n.cell.bad{background:var(--red-bg);color:var(--red-tx)}\n.cell.warn{background:#f3f4f6;color:var(--ink2)}\n.cell.neutral{background:#f3f4f6;color:var(--ink2)}\n\n/* ===== Переключатели ===== */\n.sub-tabs{display:inline-flex;gap:3px;background:#eef0f3;border-radius:var(--r4);padding:3px;margin:0 0 14px}\n.sub-tab{border:0;background:transparent;padding:8px 15px;border-radius:var(--r3);font-weight:var(--fw-body);font-size:var(--fs-body);color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:background .15s,color .15s}\n.sub-tab:hover{color:var(--ink2)}\n.sub-tab.active{background:#fff;color:var(--ink);box-shadow:var(--shadow);font-weight:var(--fw-bold)}\n.ctl{display:flex;flex-direction:column;gap:5px}\n.ctl label{font-size:var(--fs-cap);text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:var(--fw-bold)}\n.ctl select{appearance:none;border:1px solid var(--line);background:#fff;border-radius:var(--r3);padding:8px 30px 8px 12px;font-size:13px;color:var(--ink);font-weight:var(--fw-body);cursor:pointer;min-width:170px;max-width:100%;text-overflow:ellipsis;\nbackground-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a909c' stroke-width='2.5'><path d='M6 9l6 6 6-6'/></svg>\");background-repeat:no-repeat;background-position:right 10px center}\n.toolbar{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:14px}\n.toolbar .sp{flex:1}\n\n/* ===== AI-подсказка ===== */\n.ai{background:#fff;border:1px solid #e4dcfa;border-left:3px solid var(--ai);border-radius:var(--radius);margin:14px 0 0;overflow:hidden}\n.ai-h{display:flex;align-items:center;gap:10px;padding:12px 15px;cursor:pointer;user-select:none}\n.ai-ico{width:22px;height:22px;border-radius:var(--r2);background:var(--ai-bg);color:var(--ai-tx);font-size:12px;font-weight:var(--fw-bold);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}\n.ai-t{font-size:13px;font-weight:var(--fw-bold);color:var(--ai-tx)}\n.ai-lead{font-size:var(--fs-body);color:var(--ink2);font-weight:var(--fw-body);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ai-caret{color:var(--ai);font-size:11px}\n.ai-b{padding:0 15px 14px 15px;font-size:13px;color:var(--ink2);line-height:1.55}\n.ai-b ul{margin:8px 0 0;padding-left:20px}\n.ai-b li{margin-bottom:5px}\n.ai-b b{color:var(--ink)}\n.ai-tag{font-size:var(--fs-micro);font-weight:var(--fw-body);text-transform:uppercase;letter-spacing:.3px;padding:2px 7px;border-radius:var(--r2);background:var(--ai-bg);color:var(--ai-tx)}\n\n/* ===== Заметки, легенда, пустые состояния ===== */\n.note-inline{font-size:12px;color:var(--muted);background:#fff;border:1px dashed var(--line);border-radius:var(--r3);padding:11px 14px;margin-bottom:14px;line-height:1.5}\n.legend{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:0 0 14px;font-size:12px;color:var(--ink2)}\n.legend .sw{display:inline-flex;align-items:center;gap:6px;font-weight:var(--fw-body)}\n.legend .dot{width:11px;height:11px;border-radius:var(--r1);display:inline-block}\n.empty{background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);padding:38px 22px;text-align:center;color:var(--muted)}\n.empty b{display:block;color:var(--ink);font-size:15px;margin-bottom:6px}\n\n/* ===== Модалка «Настрой свой дашборд» ===== */\n.ovl{position:fixed;inset:0;background:rgba(20,28,45,.42);z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:64px 18px;overflow:auto}\n.modal{background:#fff;border-radius:var(--r5);box-shadow:var(--shadow-lg);width:100%;max-width:620px;overflow:hidden}\n.modal-h{padding:18px 22px 14px;border-bottom:1px solid var(--line2)}\n.modal-h h3{margin:0 0 5px;font-size:18px;font-weight:var(--fw-bold);letter-spacing:-.3px}\n.modal-h p{margin:0;font-size:var(--fs-body);color:var(--muted);line-height:1.45}\n.modal-b{padding:18px 22px 8px}\n.modal-f{padding:14px 22px 18px;border-top:1px solid var(--line2);display:flex;align-items:center;gap:10px;background:#fafbfc}\n.modal-f .sp{flex:1}\n.fgrp{margin-bottom:18px}\n.fgrp>label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:var(--fw-bold);margin-bottom:8px}\n.fgrp .fhint{font-size:var(--fs-note);color:var(--muted);font-weight:var(--fw-body);margin-top:7px;line-height:1.4}\n.opts{display:flex;gap:8px;flex-wrap:wrap}\n.opt{border:1px solid var(--line);background:#fff;border-radius:var(--r3);padding:8px 14px;font-size:13px;font-weight:var(--fw-body);color:var(--ink2);cursor:pointer;transition:all .15s}\n.opt:hover{border-color:#C0CBDF;background:#fafbfc}\n.opt.on{background:var(--act);border-color:var(--act);color:#fff}\n.bench-preview{background:var(--blue-bg);border:1px solid var(--act-line);border-radius:var(--r3);padding:12px 14px;font-size:var(--fs-body);color:var(--act-ink);font-weight:var(--fw-body);line-height:1.5}\n.bench-preview b{color:var(--act-ink)}\n\n/* ----- Выбор метрик: пресеты + чекбоксы по блокам -----\n   Список прокручивается внутри себя, иначе модалка с 19 метриками уезжает\n   за экран и кнопка «Применить» оказывается недостижима. */\n.opts.tight .opt{padding:6px 11px;font-size:12px}\n.mpick{margin-top:10px;border:1px solid var(--line);border-radius:var(--r3);background:#fcfcfd;max-height:236px;overflow-y:auto}\n.mpick-g{padding:9px 11px 11px;border-bottom:1px solid var(--line2)}\n.mpick-g:last-child{border-bottom:0}\n.mpick-h{font-size:var(--fs-cap);text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:var(--fw-bold);margin-bottom:6px}\n.mpick-l{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px}\n.mp-i{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:none;padding:4px 5px;border-radius:var(--r2);font:inherit;font-size:var(--fs-body);font-weight:var(--fw-body);color:var(--muted);cursor:pointer}\n.mp-i:hover{background:#F5F9FE}\n.mp-i.on{color:var(--ink2)}\n.mp-i .box{flex:none;width:15px;height:15px;border:1.5px solid #c9cdd6;border-radius:var(--r1);background:#fff;position:relative}\n.mp-i.on .box{background:var(--act);border-color:var(--act)}\n.mp-i.on .box::after{content:'';position:absolute;left:4px;top:1px;width:4px;height:8px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}\n.mp-i .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.mp-i .lk{margin-left:auto;flex:none;font-size:var(--fs-micro);font-weight:var(--fw-bold);text-transform:uppercase;letter-spacing:.3px;color:var(--muted2)}\n.mp-i.lock{cursor:default}\n.mp-i.lock:hover{background:none}\n.mp-i.lock .box{background:var(--bench);border-color:var(--bench)}\n\n/* ===== Итерация 7: адаптив, доступность, печать ===== */\n:focus-visible{outline:3px solid rgba(36,95,212,.32);outline-offset:2px}\nbutton:focus-visible,a:focus-visible,select:focus-visible{outline-color:var(--act)}\n.skip-link{position:fixed;left:12px;top:-60px;z-index:9999;background:var(--ink);color:#fff;padding:10px 14px;border-radius:var(--r3);font-weight:var(--fw-bold);text-decoration:none;transition:top .15s}\n.skip-link:focus{top:12px}\n.nav-toggle{display:none;border:1px solid var(--line);background:#fff;border-radius:var(--r3);padding:8px 10px;font-weight:var(--fw-bold);color:var(--ink);cursor:pointer}\n.nav-scrim{display:none}\n.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}\n[aria-current=\"page\"]{font-weight:var(--fw-bold)}\n.mrow:focus,.urow:focus{outline:3px solid rgba(36,95,212,.25);outline-offset:-3px;background:#F5F9FE}\n@media (prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}\n\n@media(max-width:1100px){\n  /* классы n2…n5 задают колонки жёстче, чем базовое правило, поэтому на узком\n     экране их приходится переопределять явно — иначе пять карточек движения\n     персонала остались бы впятером и на планшете */\n  .kpis,.kpis.n4,.kpis.n5{grid-template-columns:repeat(3,minmax(160px,1fr))}\n  .content{padding:22px}\n  .reporthead{padding-left:22px;padding-right:22px}\n}\n@media(max-width:780px){\n  .apphead-top{padding:9px 14px}.logo small{display:none}.freshness{display:none}.apphead .ghost{display:none}.nav-toggle{display:inline-flex}\n  .reporthead{padding:14px}.rh-row{align-items:flex-start}.rh-title{font-size:22px}.rh-side{display:none}\n  .layout{display:block}.nav{position:fixed;z-index:120;left:0;top:0;bottom:0;width:min(82vw,300px);transform:translateX(-105%);transition:transform .22s ease;box-shadow:8px 0 28px rgba(20,28,45,.18);padding-top:18px}.nav.open{transform:translateX(0)}\n  .nav-scrim{position:fixed;z-index:110;inset:0;background:rgba(20,28,45,.38)}.nav-scrim.open{display:block}\n  .content{padding:16px}.kpis,.kpis.n3,.kpis.n4,.kpis.n5{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kpi{min-width:0}\n  .toolbar{align-items:stretch}.toolbar .ctl,.toolbar .ctl select{width:100%}.toolbar .sp{display:none}.toolbar>.btn{flex:1;text-align:center;justify-content:center}\n  .panel{overflow-x:auto}.mtable,.ptable{min-width:760px}.page-h h2{font-size:21px}.block-h{align-items:flex-start}\n  .modal{width:calc(100vw - 20px);max-height:92vh}.modal-b{padding:16px}.modal-f{padding:12px;flex-wrap:wrap}\n  .ai-h{align-items:flex-start}.ai-lead{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.ai-tag{display:none}\n}\n@media(max-width:480px){\n  .apphead .primary{padding:8px 10px;font-size:11px}.logo{font-size:14px}.rh-title .lvl{display:block;margin:5px 0 0;width:max-content}\n  .kpis,.kpis.n2,.kpis.n3,.kpis.n4,.kpis.n5{grid-template-columns:1fr}.chips{gap:5px}.chip{font-size:var(--fs-cap)}.sub-tabs{display:flex;overflow-x:auto;width:100%;white-space:nowrap}.sub-tab{padding:8px 11px}\n  .legend{gap:8px 12px}.panel-h{padding:12px}.panel-b{padding:10px}\n  .mpick-l{grid-template-columns:1fr}.mpick{max-height:200px}\n}\n@media print{\n  body{background:#fff}.apphead,.nav,.toolbar,.sub-tabs,.ai-caret,.btn,.nav-scrim{display:none!important}.layout{display:block}.content{padding:0;max-width:none}.reporthead{padding:10px 0;border:0}.panel,.kpi,.ai{box-shadow:none;break-inside:avoid}.detail-chart{height:230px}.chips .x{display:none}\n}\n\n/* ===== Итерация 8: переделка детальных вкладок ===== */\n\n/* Шапка панели: название слева, переключатели справа — там, где меняется график */\n.panel-h.with-tabs{flex-wrap:wrap;row-gap:10px;align-items:center}\n.panel-h .h-txt{display:flex;flex-direction:column;gap:2px;min-width:0}\n.panel-h .h-txt .sub{font-weight:var(--fw-body)}\n.panel-h .sub-tabs{margin:0 0 0 auto;flex:0 0 auto}\n.panel-h .sub-tabs .sub-tab{padding:6px 12px;font-size:12px}\n\n/* Сводная таблица: единая иерархия с каретками */\n.caret-btn{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-right:6px;border:0;background:transparent;border-radius:var(--r2);color:var(--muted);font-size:9px;cursor:pointer;transition:transform .16s,background .15s,color .15s;flex:0 0 auto}\n.caret-btn:hover{background:#eef1f6;color:var(--ink)}\n.caret-btn.open{transform:rotate(90deg);color:var(--act)}\n.caret-spacer{display:inline-block;width:18px;margin-right:6px;flex:0 0 auto}\n.ptable td.txt .row-label{display:flex;align-items:flex-start}\n.ptable td.txt .row-body{min-width:0}\n.ptable tr.lvl2 td.txt{padding-left:26px}\n.ptable tr.lvl2 td.txt .row-body{font-weight:var(--fw-body);color:var(--ink2)}\n.ptable tr.lvl2 td{background:#fcfcfd}\n.ptable tr.lvl2.sel td{background:#F5F9FE}\n.hint-col{font-size:var(--fs-micro);font-weight:var(--fw-body);color:var(--muted);text-transform:none;letter-spacing:0;display:block;margin-top:2px}\n\n/* AI-инсайт сразу под заголовком */\n.ai.insight{margin:0 0 16px}\n.ai.insight .ai-h{padding:13px 15px}\n.ai.insight .ai-b{padding:0 15px 15px 15px}\n.ai-sev{font-size:var(--fs-micro);font-weight:var(--fw-bold);text-transform:uppercase;letter-spacing:.3px;padding:2px 7px;border-radius:var(--r2);flex:0 0 auto}\n.ai-sev.high{background:var(--red-bg);color:var(--red-tx)}\n.ai-sev.mid{background:var(--warn-bg);color:var(--warn-tx)}\n.ai-sev.good{background:var(--green-bg);color:var(--green-tx)}\n.ai.sev-high{border-color:#f6d5d5;border-left-color:var(--red)}\n.ai.sev-mid{border-color:#f7e4c4;border-left-color:var(--warn)}\n.ai.sev-good{border-color:#cfeeda;border-left-color:var(--green)}\n\n/* Состояние «отклонений нет» — одна строка вместо пустой подсказки */\n.no-insight{display:flex;align-items:center;gap:9px;font-size:var(--fs-body);color:var(--muted);background:#fff;border:1px solid var(--line2);border-radius:var(--r3);padding:11px 14px;margin:0 0 16px;font-weight:var(--fw-body)}\n.no-insight .ok-dot{width:8px;height:8px;border-radius:50%;background:var(--green);flex:0 0 auto}\n\n/* ===== Итерация 12: таблица слева, визуализация справа ===== */\n.toolbar.slim{margin:-4px 0 10px;min-height:0}\n.split{display:grid;grid-template-columns:minmax(500px,.95fr) 16px minmax(440px,1.05fr);column-gap:0;row-gap:16px;align-items:stretch;height:clamp(440px,calc(100vh - 330px),620px);min-height:440px}\n.split>.panel{min-height:0;height:100%;display:flex;flex-direction:column}\n.split .panel-h{flex:0 0 auto;min-height:54px}\n.split .panel-b{flex:1;min-height:0}\n.split-l .tbl-wrap{padding:0 0 4px;overflow:auto}\n.split-r .panel-b{padding:var(--s4) var(--s5) var(--s5)}\n/* Тело таблицы — --fs-body, «основной текст таблиц» по шкале ролей.\n   Было --fs-note, то есть кегль СНОСОК: главное содержимое отчёта набиралось\n   мельче, чем предписывает его собственная роль, и на ноутбуке читалось тяжело. */\n.ptable.dense{font-size:var(--fs-body)}\n.ptable.dense th{padding:8px 6px;font-size:var(--fs-cap)}\n/* Колонка имени отдаёт свои 14px пятой метрике: в «Движении персонала» столбцов\n   стало пять, и на ноутбучной ширине таблица уезжала под горизонтальный скролл.\n   Имена подразделений и так переносятся по словам, а числовые колонки ужимать\n   нельзя — там между значениями останется меньше воздуха, чем внутри них. */\n.ptable.dense th.txt{padding-left:var(--pad-cell);min-width:141px}\n.ptable.dense td{padding:7px 6px}\n.ptable.dense td.txt{padding-left:var(--pad-cell);max-width:176px}\n.ptable.dense td.lead{font-weight:var(--fw-bold);color:var(--ink)}\n.ptable.dense .unit-sub{font-size:var(--fs-cap)}\n.ptable.dense .cell{font-size:var(--fs-note);padding:5px 4px;margin:1px}\n.ptable.dense .vs{border-left:1px solid var(--line2)}\n.btn.xs{padding:3px 6px;min-width:24px;font-size:11px}\n/* кнопка «сделать корнем» в плотной таблице занимает ровно свою стрелку:\n   служебная колонка не должна отнимать ширину у колонки метрики */\n.ptable.dense .btn.xs{padding:3px 4px;min-width:22px}\n.ptable.dense td:last-child{padding-left:2px;padding-right:4px}\n/* Порог 1240, а не 1120: минимумы колонок (500+440+16 = 956px) перестают\n   помещаться в контент раньше, чем срабатывал прежний брейкпоинт, и на ширинах\n   1121–1240px рабочая зона вылезала за экран — появлялся горизонтальный скролл\n   всей страницы, а правая панель обрезалась. Теперь узкие минимумы включаются\n   там, где широкие уже не влезают. */\n@media(max-width:1240px){.split{grid-template-columns:minmax(440px,.95fr) 16px minmax(400px,1.05fr)}}\n/* Порог 1110, а не 900: две колонки перестают помещаться раньше, чем экран\n   становится планшетным. Минимумы 440+400+16 = 856px требуют контента шире\n   ~870px, а это ширина окна около 1120. На 901–1120px рабочая зона вылезала\n   за экран, и страница ехала вбок — при том что таблица и график там уже\n   не читались рядом. Ниже порога они встают друг под друга. */\n@media(max-width:1120px){.split{grid-template-columns:1fr;height:auto}.split>.panel{height:auto}.split-l .tbl-wrap{max-height:430px}.split-r .panel-b{height:380px}}\n\n/* ===== Итерация 13: сравнимость, ИТОГО сверху, шапка блока ===== */\n\n/* Заголовок блока и переход на детальный дашборд — одна строка.\n   Кнопка ниже обычной и margin-bottom снят: высокая кнопка растягивала строку,\n   и между заголовком листа и его подзаголовком набегал лишний воздух. */\n.ph-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:0}\n.ph-row h2{margin:0}\n.btn.dash{margin-left:auto;border-color:var(--act-line);background:var(--blue-bg);color:var(--act-ink);font-weight:var(--fw-body);\n  border-radius:var(--r3);padding:6px 12px;text-decoration:none;white-space:nowrap}\n.btn.dash:hover{background:#DDE8FD;border-color:var(--act-line);color:var(--act-ink)}\n.btn.dash .ico-ext{opacity:.8;margin-left:-1px;flex:0 0 auto}\n\n/* Метрика, которую с базой сравнивать бессмысленно */\n.nocmp{display:inline-block;font-size:11px;font-weight:var(--fw-body);color:var(--muted);\n  border:1px dashed var(--line);border-radius:var(--r2);padding:2px 8px;white-space:nowrap;cursor:help}\n.tgt .nocmp{font-weight:var(--fw-body)}\n\n/* ИТОГО первой строкой и шапка таблицы прилипают при скролле */\n.ptable.dense thead th{position:sticky;top:0;z-index:3;background:#fff}\n.ptable tr.total.top td{position:sticky;top:29px;z-index:2;border-top:0;border-bottom:2px solid var(--line);background:#fafbfc}\n\n/* Каретка была почти незаметна */\n.caret-btn{width:23px;height:23px;font-size:12px;color:var(--ink2);margin-right:7px}\n.caret-btn:hover{background:var(--blue-bg);color:var(--act)}\n.caret-btn[data-open]{color:var(--act)}\n.caret-spacer{width:23px;margin-right:7px}\n\n/* ============================================================================\n   Переход с ECharts на собственный SVG (31.07.2026)\n   ========================================================================== */\n\n/* Контейнер графика. Высота задаётся самим SVG в draw.js, поэтому здесь её нет:\n   иначе два источника правды разошлись бы. draw.remeasure() перерисовывает SVG\n   под фактическую ширину, поэтому кегль подписей не масштабируется. */\n.svgchart{width:100%}\n.svgchart svg{display:block;max-width:100%}\n/* Правая панель имеет фиксированную высоту от .split, а панельные графики\n   бывают выше — отдаём прокрутку вместо обрезания. */\n.split-r .panel-b{overflow:auto}\n\n/* ---------- Таблица-разбивка с полосой внутри ячейки ----------\n   Не график в виде таблицы, а таблица: значение и доля читаются числом,\n   полоса рядом даёт форму распределения. Полоса растёт от ЛЕВОГО края —\n   у всех строк общий старт, поэтому длины сравниваются глазом. */\n.btable td.barcell,.btable th.bar-th{text-align:left;padding-left:var(--pad-cell)}\n.btable th.bar-th{padding-left:var(--pad-cell)}\n.cellbar{display:block;width:100%;height:13px;background:#f1f3f6;border-radius:var(--r1);overflow:hidden}\n.cellbar i{display:block;height:100%;border-radius:2px;background:var(--bar-soft);min-width:2px}\n.btable tr.total td{border-bottom:0}\n/* ★ у нежелательных уходов */\n.rt-mark{color:#d9534f;font-weight:var(--fw-bold);margin-right:2px}\n\n/* Несколько разбивок на одном экране: раньше это были четыре под-вкладки\n   с одним кольцом в каждой, и состав команды приходилось перекликивать. */\n.bt-stack{display:flex;flex-direction:column;gap:16px}\n.bt-group{min-width:0}\n/* Заголовок группы — та же роль, что заголовок графика и имя панели в SVG.\n   Три одинаковые по смыслу вещи выглядели по-трём разному (13/700 чёрный,\n   11/800 СЕРЫЙ КАПСОМ, 11.5/700) — теперь везде 12/700 --ink обычным регистром. */\n.bt-cap{font-size:12px;letter-spacing:0;color:var(--ink);\n  font-weight:var(--fw-bold);margin:0 0 6px}\n.bt-group .ptable th{padding-top:6px;padding-bottom:8px}\n\n/* Сноска под таблицей или воронкой: помечаем допущения макета честно */\n.tbl-note{margin-top:var(--s4);font-size:var(--fs-note);color:var(--muted);font-weight:var(--fw-body);line-height:1.45}\n/* в правой панели сноска — прямой ребёнок flex-колонки с gap:10px, и её собственный\n   margin-top складывался с gap: 19px вместо 9px, как везде */\n.split-r .panel-b>.tbl-note{margin-top:0}\n.ins-note{margin-top:var(--s4);font-size:12px;color:var(--muted)}\n.mi-meta{margin-top:6px;color:var(--muted)}\n\n@media(max-width:900px){\n  .split-r .panel-b{overflow:visible}\n  .bt-stack{gap:12px}\n}\n\n/* ============================================================================\n   Итерация 15: единый тултип, анимация появления, ховер, воздух (31.07.2026)\n   ========================================================================== */\n\n/* ---------- Кастомный тултип ----------\n   Стандартный title= выпилен по всему проекту: он ждёт секунду, выглядит\n   системным и не умеет в вёрстку. Здесь — мгновенно, белым, с тенью.\n   Разметку собирает только TPDRAW.tipHtml — руками теги не клеим. */\n/* Три уровня вместо «всё жирное»: контекст сверху приглушён и мелок, значение —\n   единственный акцент, служебное тише всего и отбито волосяной линией.\n   Пары «подпись — значение» выровнены по правому краю значений, поэтому две\n   строки читаются как таблица, а не как проза. Разметку собирает\n   TPDRAW.tipHtml — руками строки больше не клеим. */\n.tip{position:fixed;z-index:400;pointer-events:none;opacity:0;\n  transform:translateY(3px);transition:opacity .11s ease-out,transform .11s ease-out;\n  background:#fff;border:1px solid var(--line);border-radius:var(--r3);\n  box-shadow:0 10px 30px rgba(24,33,50,.18),0 2px 6px rgba(24,33,50,.08);\n  padding:9px 12px;font-size:12px;line-height:1.45;color:var(--ink2);font-weight:var(--fw-body);\n  min-width:148px;max-width:300px;white-space:normal}\n.tip.on{opacity:1;transform:none}\n.tip .t-h{display:block;font-size:var(--fs-cap);font-weight:var(--fw-bold);letter-spacing:.2px;\n  color:var(--muted);margin-bottom:6px}\n.tip .t-x{display:block;font-size:12px;font-weight:var(--fw-body);color:var(--ink2);line-height:1.45}\n.tip .t-r{display:flex;align-items:center;gap:8px;margin-top:4px}\n.tip .t-r:first-child{margin-top:0}\n/* маркер серии повторяет легенду графика: сплошной прямоугольник у значения,\n   пунктирный штрих у базы сравнения */\n.tip .t-m{display:inline-block;flex:0 0 auto;width:10px;height:9px;border-radius:var(--r1);margin:0}\n.tip .t-m.dash{height:0;width:14px;border-radius:0;border-top:2px dashed;background:none}\n.tip .t-l{font-size:var(--fs-note);font-weight:var(--fw-body);color:var(--muted);min-width:0}\n/* Все значения в подсказке — ОДНОГО кегля. Разный размер кодировал порядок\n   строки в массиве, а не смысл: в дивергенте «Приняли» выходило крупнее\n   «Уволились», хотя это две равнозначные метрики одного потока.\n   Значимость теперь несёт цвет: база сравнения серая, метрика чёрная. */\n.tip .t-v{display:inline;margin:0 0 0 auto;font-size:var(--fs-lead);font-weight:var(--fw-bold);\n  color:var(--ink);white-space:nowrap;font-variant-numeric:tabular-nums}\n.tip .t-r.bench .t-v{color:var(--muted)}\n.tip .t-n{display:block;font-size:var(--fs-note);font-weight:var(--fw-body);color:var(--muted);margin-top:5px}\n.tip .t-r+.t-n{margin-top:8px;padding-top:7px;border-top:1px solid var(--line2)}\n.tip .t-n+.t-n{margin-top:2px;padding-top:0;border-top:0}\n.nocmp,.rt-mark,.info,.cellbar{cursor:help}\n\n/* ---------- Анимация появления и ховер в SVG ----------\n   Анимация включается классом .anim, который вешает draw.remeasure(root,true)\n   при рендере экрана. На resize класс не ставится: дёргаться при каждом\n   изменении ширины окна график не должен. */\n@keyframes tp-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}\n@keyframes tp-growx{from{transform:scaleX(0)}to{transform:scaleX(1)}}\n@keyframes tp-fade{from{opacity:0}to{opacity:1}}\n.svgchart.anim .bar{transform-box:fill-box;animation:tp-grow .48s cubic-bezier(.22,.61,.36,1) both}\n.svgchart.anim .bar.up{transform-origin:50% 100%}\n.svgchart.anim .bar.dn{transform-origin:50% 0}\n.svgchart.anim .bar.fn{transform-origin:50% 50%;animation-name:tp-growx}\n/* Линия РИСУЕТСЯ слева направо, а не проявляется целиком: у графика есть\n   направление времени, и глаз должен пройти по нему вместе с линией.\n   Работает это только вместе с pathLength=\"1\" в draw.js — там длина любой\n   ломаной приведена к единице, поэтому dasharray/dashoffset тут константы. */\n@keyframes tp-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}\n.svgchart.anim .ln{stroke-dasharray:1;stroke-dashoffset:1;\n  animation:tp-draw .76s cubic-bezier(.4,0,.2,1) both}\n/* Пунктирная база рисоваться не может — dasharray у неё занят рисунком штриха */\n.svgchart.anim .lnb{animation:tp-fade .5s ease-out both;animation-delay:.1s}\n/* .fade — короткая мягкая вспышка: подписи значений идут в такт со своими\n   точками, поэтому длинное проявление размазало бы бегущую волну */\n.svgchart.anim .fade{animation:tp-fade .3s ease-out both}\n/* Точки вспыхивают по мере того, как до них доходит линия (задержка в draw.js) */\n.svgchart.anim .dot,.svgchart.anim .dotb{animation:tp-fade .3s ease-out both}\n.svgchart.anim .fnlink{animation:tp-fade .4s ease-out both;animation-delay:.3s}\n\n/* Прозрачный прямоугольник-ловушка на всю полосу месяца: попасть в тонкий бар\n   мышью тяжело, а в полосу — легко. fill-opacity:0 вместо fill:none —\n   иначе элемент не участвует в hit-тесте. */\n.hit{fill:#245FD4;fill-opacity:0;transition:fill-opacity .12s}\n.barg:hover .hit,.ptg:hover .hit,.sbg:hover .hit{fill-opacity:.05}\n.barg:hover .bar,.sbg:hover .sb{filter:brightness(1.1) saturate(1.3)}\n.ptg:hover .dot{r:5.2;stroke-width:2.6}\n.ptg:hover .dotb{r:3.4}\n/* Спарклайн: под курсором подсвечивается конкретный месяц — иначе непонятно,\n   про какую точку говорит тултип. Линия-указатель бледная, точка белая. */\n.spdot,.spgd{opacity:0;transition:opacity .12s}\n.spgd{stroke-width:1;opacity:0}\n.spg:hover .spdot{opacity:1}\n.spg:hover .spgd{opacity:.28}\n.svgchart .dot,.svgchart .sb,.svgchart .bar{transition:filter .12s,r .12s,stroke-width .12s}\n\n/* ---------- Легенда как управление сериями ----------\n   Наведение на пункт гасит чужие серии, клик — выключает серию.\n   Два правила вместо :has(): атрибут ставит JS на контейнер. */\n.svgchart[data-hi] [data-s]{opacity:.18}\n.svgchart[data-hi] [data-s].hi{opacity:1}\n.svgchart [data-s]{transition:opacity .14s ease-out}\n.lg{cursor:pointer}\n.lg.lock{cursor:default}\n.lg:hover .hit,.lg:focus-visible .hit{fill-opacity:.07}\n.lg:focus{outline:none}\n.lg:focus-visible .hit{fill-opacity:.12;stroke:var(--act);stroke-width:1.5}\n\n/* График занимает всю правую панель, а не висит в её верхней части */\n/* Высоту SVG задаёт draw.js (у панельных графиков есть минимум, ниже которого\n   ось X начинает наезжать), поэтому тянем контейнер, а не сам SVG: иначе\n   высокий график сплющился бы вместо того, чтобы дать прокрутку. */\n.svgchart.fill{height:100%}\n/* Два графика в одной под-вкладке делят высоту панели пополам: у обоих flex:1.\n   gap нужен, чтобы ось X верхнего не липла к заголовку нижнего. */\n.split-r .panel-b{display:flex;flex-direction:column;gap:var(--chart-gap)}\n.split-r .panel-b>.svgchart.fill{flex:1;min-height:0}\n/* График БЕЗ fill стоит собственной высотой и делить с кем-то её не должен:\n   ни растягиваться на остаток панели, ни сжиматься. Так запас высоты копится\n   ВНИЗУ панели, а до соседнего блока остаётся тот же --chart-gap, что между\n   двумя графиками. Это случай календаря посещаемости: под ним таблица дней\n   недели, и расстояние до неё не может зависеть от высоты монитора. */\n.split-r .panel-b>.svgchart{flex:none}\n/* Правая панель — тот же кегль, что и таблица подразделений слева:\n   разные размеры шрифта в двух колонках одного экрана читаются как ошибка. */\n.split-r .ptable{font-size:var(--fs-body)}\n.split-r .ptable th{font-size:var(--fs-cap)}\n\n/* ---------- OnePager ---------- */\n/* Колонка «12 мес»: спарклайн стоит ПОД своим заголовком по центру и тянется\n   по ширине экрана, а не жмётся к левому краю ячейки. */\n/* Правая половина таблицы — колонки-«карточки», а не числа: спарклайн и пилюля\n   сравнения центрируются каждый в своей колонке, под своим заголовком.\n   Раньше пилюля прижималась к правому краю, и весь запас ширины колонки\n   собирался в один провал слева от неё — из-за этого казалось, что бары\n   съехали влево. Числовые колонки остаются по правому краю: числа\n   сравниваются по разряду. */\n.mtable thead th.mid{text-align:center}\n.mtable td.col-spark{text-align:center;padding:11px 12px}\n.mtable td.col-tgt{text-align:center}\n.mtable td.col-tgt .tgt{text-align:center}\n.mtable td.col-spark .spark{width:100%;display:block}\n.k-row .spark{flex:1 1 auto;min-width:56px;max-width:110px}\n\n/* Раскрытая метрика: воздух сверху и снизу, иначе заголовок графика прижат\n   к верхней границе, а ось X наезжает на следующую метрику. */\n.detail-row td{padding:18px 18px 20px;background:#fafbfc}\n.detail-chart{height:auto;width:100%}\n/* Два полотна рядом (год к году + 12 мес) — половины разделены волосяной\n   линией, а не зазором: это один ответ из двух частей, а не две карточки. */\n.detail-split{display:grid;grid-template-columns:1fr 1fr;gap:0}\n.dsplit{min-width:0;padding:0 var(--s9)}\n.dsplit:first-child{padding-left:0;border-right:1px solid var(--line2)}\n.dsplit:last-child{padding-right:0}\n@media (max-width:1100px){\n  .detail-split{grid-template-columns:1fr;gap:var(--chart-gap)}\n  .dsplit,.dsplit:first-child,.dsplit:last-child{padding:0;border:0}\n}\n\n/* ---------- Переключатель масштаба динамики: 12 мес / год к году ----------\n   Сегмент из дизайн-системы Proteus Adoption: подложка --line2, активный —\n   белая плашка с тенью. Стоит над графиком, а не в шапке панели: шапку уже\n   занимают под-вкладки блока. */\n.dyn-switch{display:inline-flex;gap:3px;background:var(--line2);border-radius:var(--r3);\n  padding:3px;margin:0 0 var(--s6);align-self:flex-start;flex:none}\n.dyn-switch button{border:0;background:transparent;padding:5px var(--s5);border-radius:var(--r2);\n  font:inherit;font-size:var(--fs-note);font-weight:var(--fw-body);color:var(--muted);cursor:pointer;\n  transition:background .15s,color .15s}\n.dyn-switch button:hover{color:var(--ink2)}\n.dyn-switch button.on{background:var(--card);color:var(--ink);box-shadow:var(--shadow);font-weight:var(--fw-bold)}\n\n/* строка «год назад» в KPI-карточке — второй план, тише строки базы */\n.split-r .panel-b>.dyn-switch{margin-bottom:calc(var(--s6) - var(--chart-gap))}\n.pulse-strip{display:grid;grid-template-columns:minmax(260px,1fr) 2fr;gap:var(--s10);background:var(--card);\n  border-radius:var(--radius);box-shadow:var(--shadow);padding:var(--s7) var(--s9);margin:var(--s7) 0 var(--s7)}\n.ps-h{font-size:var(--fs-cap);text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:var(--fw-bold);\n  margin-bottom:var(--s4);display:flex;gap:var(--s4);align-items:baseline}\n.ps-sub{text-transform:none;letter-spacing:0;color:var(--muted);font-weight:var(--fw-body)}\n.ps-num{display:flex;align-items:baseline;gap:var(--s2) var(--s3);flex-wrap:wrap;font-size:var(--fs-note);color:var(--muted);margin-bottom:var(--s4)}\n.ps-num b{font-size:var(--fs-head);font-weight:var(--fw-bold);color:var(--ink)}\n.ps-num b.g{color:var(--green-tx)} .ps-num b.r{color:var(--red-tx)} .ps-num b.n{color:var(--ink2)}\n.ps-num span{margin-right:var(--s4)}\n.ps-bar{display:flex;gap:2px;height:8px;border-radius:var(--r-pill);overflow:hidden}\n.ps-bar i{display:block;min-width:4px}\n.ps-bar i.g{background:#80cf9a} .ps-bar i.r{background:#ef8c8c} .ps-bar i.n{background:#e4e7ec}\n.ps-movers{display:flex;flex-direction:column;min-width:0;border-left:1px solid var(--line2);padding-left:var(--s10)}\n.ps-mv{display:grid;grid-template-columns:minmax(0,1fr) auto 84px;align-items:center;gap:var(--s6);border:0;background:transparent;\n  font:inherit;text-align:left;padding:5px var(--s3);margin:0 calc(-1 * var(--s3));border-radius:var(--r2);cursor:pointer;color:var(--ink2)}\n.ps-mv:hover{background:var(--blue-bg)}\n.ps-mv .delta{justify-self:end}\n.ps-n{font-size:var(--fs-body);font-weight:var(--fw-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ps-v{font-size:var(--fs-note);color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums}\n.ps-v b{color:var(--ink);font-weight:var(--fw-body)}\n.ps-empty{font-size:var(--fs-note);color:var(--muted)}\n@media (max-width:900px){.pulse-strip{grid-template-columns:1fr}.ps-movers{border-left:0;padding-left:0;border-top:1px solid var(--line2);padding-top:var(--s6)}}\n.op-nav{position:sticky;top:var(--head-h,0px);z-index:20;display:flex;gap:var(--s2);flex-wrap:wrap;\n  margin:0 calc(-1 * var(--s3)) var(--s4);padding:var(--s3);background:rgba(244,245,247,.92);\n  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:0 0 var(--r4) var(--r4)}\n.op-nav-i{display:inline-flex;align-items:center;gap:var(--s3);border:1px solid var(--line);background:var(--card);\n  border-radius:var(--r-pill);padding:5px var(--s5);font:inherit;font-size:var(--fs-note);font-weight:var(--fw-body);\n  color:var(--ink2);cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}\n.op-nav-i:hover{border-color:var(--act-line);background:var(--blue-bg)}\n.op-nav-i.on{border-color:var(--act);color:var(--act-ink);background:var(--blue-bg)}\n.op-nav-i .sig{width:7px;height:7px;border-radius:50%;background:#d9dce1;flex:0 0 auto}\n.op-nav-i .sig.bad{background:var(--red)} .op-nav-i .sig.good{background:var(--green)}\n.op-nav-n{font-size:var(--fs-micro);font-weight:var(--fw-bold);color:var(--red-tx);background:var(--red-bg);\n  border-radius:var(--r-pill);padding:0 5px;line-height:15px}\n/* заголовок блока не прячется под липкой полосой при прыжке */\n.block-h[id]{scroll-margin-top:calc(var(--head-h,0px) + 64px)}\n@media print{.op-nav{display:none}}\n.kpi .k-row.k-yoy{margin-top:var(--s2);font-size:var(--fs-note);color:var(--muted)}\n.kpi .k-row.k-yoy b{color:var(--ink);font-weight:var(--fw-body)}\n\n/* ---------- Структура: разбивки не должны слипаться ---------- */\n.bt-stack{gap:28px}\n.bt-group+.bt-group{border-top:1px solid var(--line2);padding-top:22px}\n.bt-cap{margin-bottom:9px}\n.bt-group .ptable th{padding-top:4px;padding-bottom:9px}\n.bt-group .ptable tr.total td{padding-bottom:2px}\n\n@media(max-width:900px){\n  .bt-stack{gap:18px}\n  .bt-group+.bt-group{padding-top:14px}\n  .split-r .panel-b{display:block}\n  .svgchart.fill{height:auto}\n  /* display:block гасит flex-gap, и на телефоне график слипался с тем, что под\n     ним, вплотную. Возвращаем то же расстояние маргином: между графиком и его\n     соседом оно одно на всех ширинах. Сноске margin-top обнулён ради flex-gap —\n     в блочной раскладке обнулять нечего, возвращаем и его. */\n  .split-r .panel-b>*+*{margin-top:var(--chart-gap)}\n  .split-r .panel-b>.tbl-note{margin-top:var(--chart-gap)}\n}\n\n/* ============================================================================\n   Итерация 16: маскот «Пульс» (01.08.2026)\n\n   Огонёк живёт в четырёх местах и нигде не перекрывает отчёт:\n     · логотип в шапке — оранжевый, фирменный;\n     · значок AI-плашки — фиолетовый, с повязкой AI;\n     · подвал левой навигации — дежурный, носит эмоцию вкладки;\n     · пустые состояния — спящий.\n   Пятое место — словарь метрик, но он появляется только по клику.\n\n   Палитру интерфейса маскот не меняет: она остаётся сине-фиолетовой, огонёк\n   работает единственным тёплым пятном. Оранжевый в кнопки и акценты не идёт.\n   ========================================================================== */\n.pulse{display:block;user-select:none;-webkit-user-drag:none;flex:0 0 auto}\n\n/* Логотип: вместо градиентного квадрата-заглушки — сам огонёк */\n.logo .mark.pic{background:none;border-radius:0;width:26px;height:26px;\n  display:inline-flex;align-items:center;justify-content:center}\n\n/* Значок AI-плашки: подложка убрана, персонаж говорит сам за себя */\n.ai-ico.pic{background:none;width:22px;height:22px;padding:0}\n\n/* Разделитель навигации — росчерк кардиограммы. Тот же мотив, что на повязке\n   огонька: один знак, повторённый в разных местах, и есть узнаваемость. */\n.nav-sep{height:12px;background:none;margin:14px 8px 12px;\n  background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='212' height='12' viewBox='0 0 212 12'><path d='M0 6h70l4.5-3.5 5 8 6-11.5 6 14.5 4.5-7.5h108' fill='none' stroke='%23dde1e9' stroke-width='1.6' stroke-linejoin='round' stroke-linecap='round'/></svg>\");\n  background-repeat:no-repeat;background-position:center;background-size:contain}\n\n/* ---------- Дежурный огонёк в подвале навигации ----------\n   .nav становится колонкой, подвал прижимается к её низу через margin-top:auto.\n   Это не оверлей и не плавающая кнопка: своя колонка, перекрыть метрики\n   физически нечем. */\n.nav{display:flex;flex-direction:column}\n/* sticky bottom — на длинных экранах (one-pager) колонка вытягивается на всю\n   высоту страницы, и без этого огонёк уехал бы за нижний край экрана */\n.nav-foot{margin-top:auto;padding-top:18px;position:sticky;bottom:16px;background:#fff}\n.pulse-dock{display:flex;align-items:center;gap:10px;width:100%;text-align:left;\n  border:1px solid var(--line);background:#fff;border-radius:var(--r4);padding:9px 10px;\n  cursor:pointer;font:inherit;transition:border-color .15s,box-shadow .15s,background .15s}\n.pulse-dock:hover{border-color:#d3d9e4;box-shadow:var(--shadow)}\n.pulse-dock.on{border-color:#C0CBDF;background:#fbfcfe;box-shadow:var(--shadow)}\n.pd-av{position:relative;flex:0 0 auto;line-height:0}\n/* Точка состояния дублирует эмоцию огонька формой и цветом: одной картинки\n   мало на 54 px, а подписывать словами нельзя — он молчит. */\n.pd-dot{position:absolute;right:-1px;bottom:1px;width:11px;height:11px;border-radius:50%;\n  border:2px solid #fff;box-shadow:0 0 0 1px rgba(20,28,45,.06)}\n.pd-dot.good{background:var(--green)}\n.pd-dot.warn{background:var(--warn)}\n.pd-dot.bad{background:var(--red)}\n.pd-dot.neutral{background:var(--muted2)}\n.pd-txt{min-width:0;line-height:1.25}\n.pd-txt b{display:block;font-size:13px;font-weight:var(--fw-bold);color:var(--ink);letter-spacing:-.1px}\n.pd-txt span{display:block;font-size:var(--fs-cap);color:var(--muted);font-weight:var(--fw-body);margin-top:2px}\n.pd-caret{margin-left:auto;color:var(--muted2);font-size:11px;font-weight:var(--fw-bold);flex:0 0 auto}\n.pulse-dock:hover .pd-caret{color:var(--act)}\n\n/* ---------- Словарь метрик ----------\n   Выезжает вправо от навигации отдельным слоем: колонку не растягивает,\n   раскладку отчёта не пересчитывает. Закрывается кликом мимо и по Esc. */\n.pulse-panel{position:fixed;left:244px;bottom:16px;z-index:70;width:320px;\n  max-height:min(70vh,620px);display:flex;flex-direction:column;\n  background:#fff;border:1px solid var(--line);border-radius:var(--r4);\n  box-shadow:var(--shadow-lg);overflow:hidden;\n  animation:pp-in .18s cubic-bezier(.22,.61,.36,1) both}\n@keyframes pp-in{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}\n.pp-h{display:flex;align-items:center;gap:10px;padding:12px 12px 11px 13px;\n  border-bottom:1px solid var(--line2);flex:0 0 auto}\n.pp-h-t{min-width:0;line-height:1.25}\n.pp-h-t b{display:block;font-size:var(--fs-lead);font-weight:var(--fw-bold);letter-spacing:-.15px}\n.pp-h-t span{display:block;font-size:11px;color:var(--muted);font-weight:var(--fw-body);margin-top:1px;\n  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.pp-x{margin-left:auto;flex:0 0 auto;border:0;background:transparent;cursor:pointer;\n  color:var(--muted);font-size:13px;line-height:1;padding:6px;border-radius:var(--r2)}\n.pp-x:hover{background:#F5F9FE;color:var(--ink)}\n.pp-b{flex:1;min-height:0;overflow-y:auto;padding:12px 14px 4px}\n.pp-lead{font-size:12px;color:var(--ink2);font-weight:var(--fw-body);line-height:1.5;\n  background:#f7f8fa;border-radius:var(--r3);padding:9px 11px;margin-bottom:12px}\n.pp-g+.pp-g{margin-top:14px;border-top:1px solid var(--line2);padding-top:12px}\n.pp-g-h{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);\n  font-weight:var(--fw-bold);margin-bottom:8px}\n.pp-m+.pp-m{margin-top:11px;border-top:1px dashed var(--line2);padding-top:11px}\n.pp-m-h{font-size:var(--fs-body);font-weight:var(--fw-bold);color:var(--ink);line-height:1.3;\n  display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n.pp-m-d{font-size:var(--fs-note);color:var(--ink2);font-weight:var(--fw-body);line-height:1.5;margin-top:4px}\n.pp-m-f{font-size:var(--fs-cap);color:var(--muted);font-weight:var(--fw-body);margin-top:5px}\n.pp-flag{font-size:9px;font-weight:var(--fw-bold);text-transform:uppercase;letter-spacing:.3px;\n  padding:2px 6px;border-radius:var(--r2);background:#f3f4f6;color:var(--muted)}\n.pp-f{flex:0 0 auto;border-top:1px solid var(--line2);background:#fafbfc;\n  padding:10px 14px;font-size:11px;color:var(--muted);font-weight:var(--fw-body);line-height:1.5}\n.pp-link{border:0;background:none;padding:0;font:inherit;color:var(--blue);\n  cursor:pointer;text-decoration:underline;text-underline-offset:2px}\n\n/* ---------- Разводка со справкой ----------\n   Единственное место, где два входа в объяснения встречаются, — и здесь же\n   сказано, чем они отличаются. */\n.help-pulse{display:flex;align-items:flex-start;gap:11px;margin-top:4px;\n  background:#f7f8fa;border:1px solid var(--line2);border-radius:var(--r4);padding:11px 13px;\n  font-size:12px;color:var(--ink2);font-weight:var(--fw-body);line-height:1.5}\n.help-pulse b{color:var(--ink)}\n\n/* ---------- Пустое состояние и строка «отклонений нет» ---------- */\n.empty-pic{display:flex;justify-content:center;margin-bottom:10px}\n.no-insight .pulse{margin:-2px 0}\n\n@media(max-width:780px){\n  /* Навигация уезжает за экран целиком — вместе с ней и дежурный огонёк.\n     Панель словаря на узком экране разворачивается на всю ширину. */\n  .pulse-panel{left:10px;right:10px;width:auto;bottom:10px;max-height:76vh}\n  .nav-foot{padding-top:22px}\n}\n@media print{.pulse-panel,.nav-foot{display:none!important}}\n\n/* ============================================================================\n   Итерация 17: AI-плашки и модалки (01.08.2026)\n\n   Огонёк на 22 px в строке плашки не читался. Строка при этом не резиновая:\n   вырасти внутрь неё нельзя, только наружу. Поэтому свёрнутая плашка держит\n   огонёк 36 px, который телом выходит за верхнюю границу, а раскрытая —\n   54 px: там места уже достаточно.\n\n   Заодно «предрасчёт» ушёл: плашка раскрывается, значит её метка должна\n   называть действие — «подробнее» / «свернуть».\n   ========================================================================== */\n/* overflow:hidden скрывал бы верх огонька: у .ai нет фоновых слоёв, которые\n   нужно было бы обрезать по скруглению, так что снимаем без последствий */\n.ai{overflow:visible}\n.ai-h{align-items:center}\n.ai-ico.pic{width:36px;height:36px;margin:-14px 0 -6px -3px;\n  filter:drop-shadow(0 4px 8px rgba(93,63,211,.24))}\n.ai-ico.pic.big{width:54px;height:54px;margin:-22px 0 -10px -5px}\n/* плашке нужен запас сверху, иначе выступающий огонёк налезет на соседа */\n.ai.insight{margin-top:10px}\n\n/* Метка стала действием: не заглавные, цвет ссылки, ховер по всей строке */\n.ai-tag{text-transform:none;font-size:11px;letter-spacing:0;padding:3px 9px;\n  background:var(--ai-bg);color:var(--ai-tx);flex:0 0 auto;transition:background .15s}\n.ai-h:hover .ai-tag{background:#e7e0fb}\n/* «Отклонений нет» — та же плашка, но нейтральная: не позитив и не проблема,\n   просто движок отработал и ничего не нашёл */\n.ai.sev-none{border-color:#e4dcfa;border-left-color:#c9bdf0}\n@media(max-width:780px){\n  /* на узком экране огонёк уводим внутрь: выступ там некуда девать */\n  .ai-h{align-items:center}\n  .ai-ico.pic{width:30px;height:30px;margin:-8px 0 -4px -2px}\n  .ai-ico.pic.big{width:42px;height:42px;margin:-12px 0 -6px -3px}\n  .ai-tag{display:inline-flex}\n}\n\n/* ---------- Огонёк в шапках модалок ----------\n   Grid, а не flex: заголовок и подзаголовок остаются отдельными строками,\n   а картинка занимает обе — текст не приходится оборачивать лишним div. */\n.modal-h{display:grid;grid-template-columns:auto 1fr;column-gap:15px;align-items:start}\n.mh-pulse{grid-row:1/3;line-height:0;margin-top:-2px;\n  filter:drop-shadow(0 4px 10px rgba(20,28,45,.14))}\n@media(max-width:780px){\n  .mh-pulse{align-self:center;grid-row:1/3}\n  .mh-pulse img{width:40px!important;height:40px!important}\n}\n\n/* ============================================================================\n   Итерация 18: раскладка борта, градиентные AI-плашки, широкая настройка\n   (01.08.2026)\n\n   Верхняя полоса приложения — единственное, что живёт над всем бортом: в целевом\n   инструменте выше тела дашборда ничего своего не сверстать. Поэтому точки входа\n   в настройку и справку уехали в шапку отчёта, а левая навигация тянется от\n   этой полосы до низа экрана.\n   ========================================================================= */\n:root{--head-h:51px}\n\n.apphead{position:sticky;top:0;z-index:50}\n\n.layout{min-height:calc(100vh - var(--head-h));align-items:stretch}\n.nav{position:sticky;top:var(--head-h);height:calc(100vh - var(--head-h));\n  display:flex;flex-direction:column;overflow-y:auto;padding-bottom:16px}\n.nav-foot{position:static;bottom:auto;padding-top:18px}\n.main-col{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--bg)}\n\n/* Шапка отчёта теперь часть тела борда, а не отдельная полоса на всю ширину */\n.reporthead{padding:16px 26px 15px}\n.rh-row{align-items:flex-end}\n.rh-side{flex-wrap:wrap;justify-content:flex-end;padding-bottom:2px}\n\n/* ---------- AI-плашка: мягкий градиент вместо рамки ----------\n   Обводка с цветной полосой слева читалась как системное предупреждение.\n   Заливка тем же смыслом мягче: цвет подсказывает тяжесть, но не кричит. */\n.ai{border:0;border-left:0;box-shadow:0 1px 2px rgba(20,28,45,.05);\n  background:linear-gradient(103deg,#f4efff 0%,#faf8ff 46%,#fcfcfe 100%)}\n.ai.sev-high{border:0;\n  background:linear-gradient(103deg,#ffeef0 0%,#fdf3f6 38%,#faf7ff 78%,#fcfcfe 100%)}\n.ai.sev-mid{border:0;\n  background:linear-gradient(103deg,#fff5e3 0%,#fdf6ef 38%,#faf7ff 78%,#fcfcfe 100%)}\n.ai.sev-good{border:0;\n  background:linear-gradient(103deg,#e9f9ef 0%,#f4f9f6 38%,#faf8ff 78%,#fcfcfe 100%)}\n.ai.sev-none{border:0;\n  background:linear-gradient(103deg,#f2f4fa 0%,#f8f9fd 46%,#fcfcfe 100%)}\n/* Внутри заливки белый чип «подробнее» держит контраст лучше сиреневого */\n.ai-tag{background:rgba(255,255,255,.72);box-shadow:inset 0 0 0 1px rgba(111,78,216,.16)}\n.ai-h:hover .ai-tag{background:#fff}\n\n/* ---------- Настройка дашборда: два столбца ----------\n   В одну колонку окно не помещалось в ноутбучный экран и уезжало в скролл.\n   Слева — кто мы и в каких разрезах, справа — состав метрик. */\n.modal.wide{max-width:1020px}\n.setup-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);\n  column-gap:26px;align-items:start}\n.setup-cols .sc-col{min-width:0;display:flex;flex-direction:column}\n.setup-cols .sc-col+.sc-col{border-left:1px solid var(--line2);padding-left:26px}\n.setup-cols .fgrp.last{margin-bottom:12px}\n/* Скроллится только список метрик — само окно остаётся целиком на экране */\n.setup-cols .fgrp.last .mpick{max-height:min(48vh,400px)}\n#setupOvl{padding:34px 18px;align-items:center}\n#setupOvl .modal{max-height:calc(100vh - 68px);display:flex;flex-direction:column}\n#setupOvl .modal-b{flex:1;min-height:0;overflow:auto}\n\n/* ---------- Рабочая зона детальной вкладки во весь экран ----------\n   Было: высота .split ограничена 620px. Из-за этого, во-первых, в таблицу\n   подразделений влезало мало строк (на реальных данных их будет заметно\n   больше, чем в моке), во-вторых — страница целиком была едва длиннее экрана,\n   и «прокрутить так, чтобы верхние блоки ушли, а остались только таблица и\n   график» не получалось: докручивать было нечего.\n\n   Теперь .split занимает экран под шапкой приложения. Отсюда оба следствия:\n   таблица высокая, а суммарная длина страницы ровно на высоту заголовка,\n   инсайта и KPI-карточек больше экрана — то есть прокрутка доводит рабочую\n   зону точно под шапку и ничего лишнего в кадре не оставляет.\n   Нижний отступ контента уменьшен с 64 до 24px по той же причине: 64px пустоты\n   внизу означали, что в конце прокрутки .split приподнят над низом экрана.\n   Правило только для широких экранов: ниже 1120px .split уже разложен в одну\n   колонку с height:auto, и фиксировать высоту там нельзя — пороги обязаны совпадать. */\n@media(min-width:1121px){\n  .split{height:clamp(520px,calc(100vh - var(--head-h) - 28px),1280px)}\n  .content{padding-bottom:24px}\n}\n\n@media(max-width:1100px){\n  .reporthead{padding-left:22px;padding-right:22px}\n  .modal.wide{max-width:760px}\n}\n@media(max-width:900px){\n  .setup-cols{grid-template-columns:1fr;row-gap:0}\n  .setup-cols .sc-col+.sc-col{border-left:0;padding-left:0;border-top:1px solid var(--line2);padding-top:16px;margin-top:2px}\n  .setup-cols .fgrp.last .mpick{max-height:236px}\n}\n@media(max-width:780px){\n  /* Мобильная навигация снова выезжающая панель, поэтому sticky тут не нужен */\n  .nav{position:fixed;height:auto;padding-bottom:44px}\n  .apphead{position:static}\n  /* шапка здесь не липкая — полоса блоков прилипает к самому верху */\n  .op-nav{top:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.op-nav::-webkit-scrollbar{display:none}\n  .block-h[id]{scroll-margin-top:64px}\n  .reporthead{padding:14px}\n  /* Кнопки отчёта больше не в шапке приложения — прятать их нельзя */\n  .apphead .ghost{display:inline-flex}\n  .rh-side{display:flex;width:100%;justify-content:flex-start;margin-top:10px}\n  .rh-side .btn{flex:1;justify-content:center}\n  .rh-row{align-items:flex-start}\n}\n@media print{.main-col{display:block}.apphead{display:none!important}}\n\n/* ============================================================================\n   Итерация 19: спарклайны, анимация огонька, чистка повторов (01.08.2026)\n   ========================================================================= */\n\n/* ---------- Столбики «12 мес» на one-pager ----------\n   Колонка тянулась вместе с окном, столбики растягивались на всю её ширину и\n   при высоте 28 px разница между месяцами переставала читаться. Ограничиваем\n   ширину и ставим по центру колонки: та же высота на меньшей ширине даёт\n   заметно более крутой профиль. */\n.mtable td.col-spark .spark{width:min(100%,150px);margin:0 auto}\n.mtable td.col-spark{padding:11px 10px}\n@media(max-width:1100px){.mtable td.col-spark .spark{width:min(100%,132px)}}\n\n/* ---------- Огонёк в AI-плашке растёт плавно ----------\n   При раскрытии рисуется новая картинка, поэтому переход по width невозможен —\n   анимируем масштаб от прежнего размера (36/54 ≈ 0.667) из нижнего левого угла,\n   чтобы огонёк «поднимался», а не выстреливал из центра. */\n@keyframes ai-grow{\n  from{transform:scale(.667);opacity:.55}\n  60%{opacity:1}\n  to{transform:scale(1);opacity:1}\n}\n.ai-ico.pic.big{transform-origin:8% 88%;\n  animation:ai-grow .52s cubic-bezier(.32,.5,.28,1) both}\n@media(prefers-reduced-motion:reduce){.ai-ico.pic.big{animation:none}}\n\n/* ---------- Справка: разводка без второго портрета ---------- */\n.help-pulse{gap:0}\n\n/* ============================================================================\n   Итерация 24: состав численности — срез по клику, матрица, конструктор\n   ========================================================================== */\n\n/* ---------- Подпись разреза со значком «i» ----------\n   У разрезов бывает что пояснить (грейд ≠ сеньорность), и пояснение живёт\n   там же, где название, — значок тот же, что у метрик, второго не заводим. */\n.bt-cap{display:flex;align-items:center;gap:6px}\n\n/* ---------- Плашка взятого среза ----------\n   Стоит под карточками KPI, потому что меняет именно их цифры. Оформлена\n   синим, а не серым пунктиром обычной сноски: это не пояснение, а активное\n   состояние отчёта, которое пользователь включил и должен видеть. */\n.note-inline.slice{display:flex;align-items:center;gap:var(--s4);flex-wrap:wrap;\n  border-style:solid;border-color:var(--act-line);background:var(--blue-bg);color:var(--ink2)}\n.note-inline.slice .sl-t{font-size:var(--fs-cap);text-transform:uppercase;letter-spacing:.3px;\n  font-weight:var(--fw-bold);color:var(--act-ink);flex:0 0 auto}\n.note-inline.slice .chip.sl{background:#fff;border-color:var(--act-line);flex:0 0 auto}\n.note-inline.slice .sl-x{flex:1 1 240px;min-width:0;font-size:var(--fs-note);color:var(--muted)}\n.note-inline.slice .btn.xs{flex:0 0 auto;padding:4px 9px}\n\n/* ---------- Конструктор своего среза ----------\n   Две оси и содержимое клетки стоят одной строкой над таблицей и отделены от\n   неё линией: это орган управления таблицей, а не её часть. */\n.mx-bar{display:flex;align-items:flex-end;gap:var(--s5);flex-wrap:wrap;\n  margin:0 0 var(--s8);padding-bottom:var(--s7);border-bottom:1px solid var(--line2)}\n.mx-bar .ctl select{min-width:148px;padding:7px 28px 7px 10px;font-size:12.5px}\n.mx-bar .opts.tight{gap:4px}\n.mx-bar .opts.tight .opt{padding:6px 9px;font-size:11.5px}\n.mx-bar .mx-swap{margin-bottom:1px;padding:7px 9px;font-size:15px;line-height:1;color:var(--muted)}\n.mx-bar .mx-swap:hover{color:var(--blue)}\n\n/* ---------- Матрица состава ----------\n   Клетки разделены border-spacing, а не линиями сетки: заливка сама рисует\n   границу клетки, а линия поверх заливки читалась бы как третий уровень\n   разметки. Первая колонка и колонка «Всего» заливки не несут — они не часть\n   распределения, а его подписи и итоги.\n   Первая колонка липкая: разрезов с десятью категориями (стрим) хватает,\n   чтобы матрица поехала вбок, и без липкой колонки перестало бы быть понятно,\n   какую строку читаешь. Скролл живёт ВНУТРИ .mx-wrap: горизонтальная прокрутка\n   страницы в отчёте запрещена. */\n.mx-wrap{overflow-x:auto;overflow-y:hidden;padding-bottom:2px}\n.mxtable{border-collapse:separate;border-spacing:2px;width:100%}\n.mxtable th,.mxtable td{border:0;white-space:nowrap}\n.mxtable th.mx-corner{position:sticky;left:0;z-index:2;background:#fff;\n  text-align:left;padding:0 var(--s5) var(--s3) 7px}\n/* Колонка названий забирает весь остаток ширины, клетки стоят своей.\n   Иначе на матрице из двух колонок клетка растягивалась на 180px и двузначное\n   число тонуло в пустоте, а на матрице из десяти — все жались к левому краю. */\n.mxtable td.txt,.mxtable th.mx-corner{width:100%}\n.mxtable td.mx-cell,.mxtable th.mx-h{width:94px}\n.mx-corner .mx-r{display:block;font-size:var(--fs-cap);font-weight:var(--fw-bold);color:var(--ink2);\n  text-transform:uppercase;letter-spacing:.2px}\n.mx-corner .mx-c{display:block;margin-top:2px;font-size:var(--fs-micro);font-weight:var(--fw-bold);\n  color:var(--muted);text-transform:uppercase;letter-spacing:.2px}\n.mxtable th.mx-h{padding:0 0 var(--s3);text-align:center}\n.mxtable th.mx-tot{font-size:var(--fs-cap);text-transform:uppercase;letter-spacing:.2px;\n  color:var(--muted);text-align:right;padding:0 var(--s3) var(--s3) var(--s4)}\n.mxtable td.mx-tot{text-align:right;font-weight:var(--fw-bold);color:var(--ink2);\n  font-size:var(--fs-body);padding:0 var(--s3) 0 var(--s4)}\n.mxtable td.mx-sum{text-align:center;font-weight:var(--fw-bold);color:var(--ink2);font-size:var(--fs-body)}\n.mxtable td.txt{position:sticky;left:0;z-index:1;background:#fff;padding:0 var(--s5) 0 0;max-width:none}\n\n/* Название категории — кнопка: клик по ней берёт срез по одному атрибуту,\n   клик по клетке — сразу по двум. Взятый срез подсвечен так же, как активная\n   опция в модалке: одно состояние «выбрано» на весь отчёт. */\n.mx-pick{border:0;background:transparent;font:inherit;font-size:var(--fs-body);font-weight:var(--fw-body);\n  color:var(--ink2);cursor:pointer;padding:4px 7px;border-radius:var(--r2);max-width:100%;\n  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:background .15s,color .15s}\n.mx-pick.row{display:block;width:100%;text-align:left}\n.mx-pick:hover{background:var(--blue-bg);color:var(--act-ink)}\n.mx-pick.on{background:var(--act);color:#fff}\n\n.mxtable td.mx-cell{text-align:center;font-weight:var(--fw-body);font-size:var(--fs-body);color:var(--ink);\n  background:#f7f8fa;border-radius:var(--r2);padding:7px 9px;min-width:54px;cursor:pointer;\n  transition:box-shadow .12s}\n.mxtable td.mx-cell:hover{box-shadow:inset 0 0 0 2px var(--act)}\n.mxtable td.mx-cell.zero{background:#fafbfc;color:var(--muted2);font-weight:var(--fw-body)}\n.mxtable tr.mx-on td.mx-cell{box-shadow:inset 0 0 0 1px var(--act)}\n.mxtable tr.total td,.mxtable tr.total td.mx-sum{border-top:1px solid var(--line);\n  background:transparent;padding-top:var(--s5)}\n.mxtable tr.total td.txt{font-weight:var(--fw-bold);color:var(--ink);padding-left:7px}\n\n@media(max-width:900px){\n  .mx-bar{flex-direction:column;align-items:stretch;gap:var(--s4)}\n  .mx-bar .ctl select{width:100%}\n  .mx-bar .mx-swap{align-self:flex-end;margin:0}\n  .note-inline.slice .sl-x{flex-basis:100%}\n  /* На узком экране колонка названий больше не забирает остаток ширины:\n     иначе в кадре оставались одни названия, а числа уезжали за правый край,\n     и матрица открывалась пустой. Название переносится по строкам, клетки\n     стоят своей шириной и видны сразу. */\n  /* Общий пол в 760px у .ptable матрице не нужен: у неё свой скролл внутри\n     .mx-wrap, а этот пол растягивал колонку названий на весь экран телефона,\n     и клетки уезжали за правый край — матрица открывалась пустой. */\n  .mxtable{min-width:0}\n  .mxtable td.txt,.mxtable th.mx-corner{width:auto;max-width:132px}\n  .mx-pick.row{white-space:normal;line-height:1.25}\n  /* Пять под-вкладок в одну строку на телефоне не встают. Переносим на вторую,\n     а не прячем за горизонтальный скролл: вкладка, о которой не знаешь, что\n     она есть, — это вкладка, которой нет. */\n  .panel-h .sub-tabs{flex-wrap:wrap;margin-left:0}\n}\n\n/* Уточнение среза в подписи разбивки: та же роль, что «· выбрано» в шапке\n   панели — состояние, а не заголовок, поэтому кегль сноски и серый. */\n.bt-cap .bt-sub{font-size:var(--fs-note);font-weight:var(--fw-body);color:var(--muted);margin-left:2px}\n/* Строка над матрицей: что из среза до неё дошло. Роль та же, что у .bt-sub. */\n.mx-cap{font-size:var(--fs-note);font-weight:var(--fw-body);color:var(--muted);margin:0 0 var(--s5)}\n\n/* ---------- ИТОГО в разбивке стоит сверху, как в сводной таблице ----------\n   Липким его не делаем: разбивка короткая и живёт в панели, где на одном\n   экране их три — три липкие строки спорили бы друг с другом. От сводной\n   таблицы берём только вид: линия под итогом, а не над ним. */\n.btable tr.total.top td{position:static}\n\n/* ============================================================================\n   Итерация 28: Arial и два начертания\n   ========================================================================== */\n\n/* ---------- Активная вкладка жирная, а ряд вкладок не «прыгает» ----------\n   Жирное слово шире обычного: стоило переключить вкладку — и соседние\n   съезжали на несколько пикселей. Поэтому каждая кнопка заранее резервирует\n   ширину своего жирного варианта: невидимая копия подписи нулевой высоты.\n   visibility:hidden убирает копию и из дерева доступности — экранный\n   диктор прочитает подпись один раз. */\n.sub-tab{flex-direction:column;gap:0}\n.dyn-switch button{display:inline-flex;flex-direction:column;align-items:center}\n.sub-tab::after,.dyn-switch button::after{content:attr(data-text);display:block;height:0;overflow:hidden;\n  visibility:hidden;font-weight:var(--fw-bold);pointer-events:none;user-select:none}\n\n/* В справке пояснения — не сноски, а сам текст правила: обычный вес\n   светло-серым там не читался бы, поэтому цвет основного текста. */\n#helpOvl .fgrp .fhint{color:var(--ink2)}\n\n/* ---------- Полоса KPI на 6–8 метрик ----------\n   После итерации 28 у движения персонала семь метрик, у найма шесть, а шапка\n   one-pager стала дайджестом из восьми карточек. Колонка на метрику — только\n   на широком экране: семь карточек по 150px не вмещают пилюлю со спарклайном.\n   Ниже — по четыре в ряд; восемь карточек дайджеста — всегда два ряда по четыре. */\n.kpis.n6{grid-template-columns:repeat(6,minmax(0,1fr))}\n.kpis.n7{grid-template-columns:repeat(7,minmax(0,1fr))}\n.kpis.n8{grid-template-columns:repeat(4,minmax(0,1fr))}\n@media(max-width:1599px){.kpis.n6,.kpis.n7{grid-template-columns:repeat(4,minmax(0,1fr))}}\n@media(max-width:1100px){.kpis.n6,.kpis.n7,.kpis.n8{grid-template-columns:repeat(3,minmax(160px,1fr))}}\n@media(max-width:780px){.kpis.n6,.kpis.n7,.kpis.n8{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media(max-width:480px){.kpis.n6,.kpis.n7,.kpis.n8{grid-template-columns:1fr}}\n\n/* ---------- Таблица показателей (U.statTable) ----------\n   План-факт подбора и заявки «Роста»: строки — разные величины, колонки —\n   срезы. Рубрики секций — тот же капс, что шапки колонок; строки «из них»\n   сдвинуты вправо, как дочерние строки сводной таблицы. Итог здесь первой\n   колонкой, а не строкой — липким его делать нечему. */\n.stable tr.total.top td{position:static}\n.stable tr.st-sec td{text-align:left;padding:var(--s7) var(--s4) var(--s3) var(--pad-cell);font-size:var(--fs-cap);\n  text-transform:uppercase;letter-spacing:.3px;color:var(--muted);font-weight:var(--fw-bold);background:transparent;\n  white-space:normal;max-width:none}\n.stable tbody tr.st-sec:first-child td{padding-top:var(--s3)}\n.stable tr.st-sub td.txt{padding-left:calc(var(--pad-cell) + var(--s7));color:var(--ink2)}\n.stable th.st-tot{color:var(--ink2)}\n.stable td .cell{display:inline-block;margin:0;padding:3px 7px;min-width:56px;text-align:right}\n\n/* ---------- Тепловая таблица долей (U.heatTable) ----------\n   Та же сетка, что у матрицы состава, но клетка не кликается: срез по статусу\n   роста или по оценке ревью ничего бы не пересчитал. Поэтому курсор —\n   подсказка, а подсветка при наведении тише, чем у кликабельной клетки.\n   Шапки — имена категорий в две строки: «В карьерном росте» в одну не встаёт. */\n.hxtable td.mx-cell,.hxtable th.mx-h{width:64px;min-width:46px}\n/* первая колонка — по самому длинному имени строки: общий минимум плотной\n   таблицы (141px под имена подразделений) здесь только распирал матрицу */\n.ptable.hxtable th.txt.mx-corner{min-width:0}\n.hxtable td.mx-cell{cursor:help;font-weight:var(--fw-body)}\n.hxtable td.mx-cell:hover{box-shadow:inset 0 0 0 2px var(--act-line)}\n/* Шапки — кеглем служебных подписей: пять категорий по 13 букв («Соответствует»)\n   кеглем шапок колонок не вставали в правую панель, и матрица уезжала вбок. */\n.hxtable th.mx-h{white-space:normal;vertical-align:bottom;line-height:1.25;font-size:var(--fs-micro);\n  color:var(--muted);text-transform:none;letter-spacing:0;padding:0 var(--s1) var(--s3)}\n.hxtable td.mx-cell{padding:7px var(--s2)}\n.hxtable th.mx-tot{font-size:var(--fs-micro)}\n.hxtable td.txt{padding-left:7px;color:var(--ink2);white-space:nowrap}\n.hxtable tr.total td{border-top:0;border-bottom:1px solid var(--line);padding-top:0;padding-bottom:0;position:static}\n.hxtable tr.total td.txt{color:var(--ink)}\n.hxtable tr.hx-sec td{padding:var(--s6) 0 var(--s2) 7px;font-size:var(--fs-cap);text-transform:uppercase;\n  letter-spacing:.3px;color:var(--muted);font-weight:var(--fw-bold);background:transparent}\n@media(max-width:1300px){.hxtable td.txt{white-space:normal;max-width:132px}}\n\n/* ---------- Сводная таблица с шестью и больше колонками ----------\n   Шапки колонок переносятся по словам: колонка ужимается до самого длинного\n   слова шапки, а не до всей подписи («ПЕРЕВ. ИЗ» → две строки). Пока шапка\n   не переносилась, ширину таблицы задавали подписи, а не числа, и у движения\n   персонала таблица выходила на 716px при панели в 540px. Переносится только\n   то, что не влезает: на широком экране шапка остаётся в одну строку.\n\n   Имя подразделения — липкое: если таблица всё равно шире панели, она\n   прокручивается внутри неё, а строку по-прежнему видно. Фон ячейки берётся\n   у строки, иначе числа проезжали бы под прозрачным именем. */\n.split-l .ptable.dense th{white-space:normal;vertical-align:bottom;line-height:1.2}\n.split-l .ptable.dense th.txt{white-space:nowrap}\n.split-l .ptable.dense tbody tr{background:#fff}\n.split-l .ptable.dense td.txt{position:sticky;left:0;z-index:1;background:inherit}\n.split-l .ptable.dense thead th.txt{left:0;z-index:4}\n.split-l .ptable.dense tr.total.top td.txt{z-index:3}\n.split-l .ptable tr.urow.sel td.txt{box-shadow:inset 3px 0 0 var(--act)}\n\n/* Шире левая колонка — у блоков, где колонок метрик с «К базе» семь и больше.\n   Ниже 1240px двум колонкам места уже нет и широкой таблице: она встаёт над\n   графиком раньше остальных — тем же приёмом, каким все блоки складываются\n   ниже 1120px, и с теми же высотами. */\n.split.wide-l{grid-template-columns:minmax(560px,1.12fr) 16px minmax(440px,.88fr)}\n@media(max-width:1240px){\n  .split.wide-l{grid-template-columns:1fr;height:auto}\n  .split.wide-l>.panel{height:auto}\n  .split.wide-l .split-l .tbl-wrap{max-height:430px}\n  .split.wide-l .split-r .panel-b{height:380px}\n}\n/* Колонка имён — 120px минимум, а не 141: имена подразделений и так\n   переносятся по словам, а на ноутбуке эти 20px решают, видна ли «К базе». */\n.split-l .ptable.dense th.txt{min-width:120px}\n@media(max-width:1300px){\n  .split-l .ptable.dense th,.split-l .ptable.dense td{padding-left:4px;padding-right:4px}\n  .split-l .ptable.dense th.txt,.split-l .ptable.dense td.txt{padding-left:var(--pad-cell)}\n}\n/* Имя подразделения переносится, когда места мало: раньше оно стояло в одну\n   строку и растягивало колонку до 176px. Перенос включается только у тесной\n   таблицы — на широком экране имя по-прежнему в одну строку. */\n.split-l .ptable.dense td.txt{white-space:normal}\n\n/* ---------- Правки после просмотра в браузере (итерация 28) ---------- */\n/* Вкладки в шапке панели переносятся внутри себя: у найма их четыре, и на\n   суженной правой панели ряд выходил за край, последняя вкладка обрезалась. */\n.panel-h .sub-tabs{flex:0 1 auto;flex-wrap:wrap;justify-content:flex-end;max-width:100%}\n/* Липкое имя строки берёт фон своей строки — и у ИТОГО, и у второго уровня */\n.split-l .ptable.dense tr.total td.txt{background:#fafbfc}\n.split-l .ptable.dense tr.lvl2 td.txt{background:#fcfcfd}\n.split-l .ptable.dense tr.lvl2.sel td.txt{background:#F5F9FE}\n/* ИТОГО тепловой таблицы стоит сверху: линия под ним, отступы клеток — как\n   у остальных строк, иначе число съезжало к верхнему краю клетки */\n.hxtable tr.total td.mx-cell{padding:7px var(--s2)}\n/* Таблицы правой панели: на суженной панели имя и пояснение переносятся,\n   а не выталкивают полосу распределения или колонку за край */\n.split-r .btable td.txt,.split-r .btable td.txt .unit-sub,\n.split-r .stable td.txt,.split-r .stable td.txt .unit-sub{white-space:normal}\n\n/* ============================================================================\n   Итерация 29: дерево подразделений на три уровня и переход в юнит\n   (механика HRBP HUB, «Команды»)\n   ========================================================================== */\n\n/* ---------- Ступени дерева ----------\n   16px на уровень — тот же шаг, что был у второго уровня. Правило с запасом\n   специфичности: на узком экране отступ ячеек ужимается до --pad-cell, и без\n   него второй и третий уровни вставали бы на одну вертикаль с первым. */\n.split-l .ptable.dense tr.lvl2 td.txt{padding-left:calc(var(--pad-cell) + 16px)}\n.split-l .ptable.dense tr.lvl3 td.txt{padding-left:calc(var(--pad-cell) + 32px)}\n.ptable tr.lvl3 td{background:#fcfcfd}\n.ptable tr.lvl3 td.txt .row-body{color:var(--ink2)}\n.split-l .ptable.dense tr.lvl3 td.txt{background:#fcfcfd}\n.ptable tr.lvl3.sel td,.split-l .ptable.dense tr.lvl3.sel td.txt{background:#F5F9FE}\n/* имя занимает всё место до кнопки перехода, а не только свою длину */\n.ptable.tree td.txt .row-body{flex:1 1 auto}\n\n/* «ниже ещё N» — на границе глубины: подсказка, а не ссылка */\n.ptable .unit-sub .below{color:var(--muted);border-bottom:1px dotted var(--muted2);cursor:help;white-space:nowrap}\n\n/* ---------- «Открыть юнит» ----------\n   У выбранной строки — у правого края имени, по центру строки: имя липкое,\n   поэтому кнопка видна и при горизонтальной прокрутке широкой таблицы.\n   В шапке правой панели — та же кнопка с подписью, после имени выбранного. */\n.open-unit{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;align-self:center;\n  width:26px;height:26px;margin:-4px -4px -4px var(--s3);padding:0;border:1px solid var(--act-line);\n  border-radius:var(--r2);background:#fff;color:var(--act);cursor:pointer}\n.open-unit:hover{background:var(--blue-bg);border-color:var(--act)}\n.open-unit.with-label{width:auto;height:auto;margin:0 0 0 var(--s3);padding:1px var(--s3) 1px var(--s2);gap:4px;\n  border-color:transparent;background:transparent;font:inherit;color:var(--act);vertical-align:-3px}\n.open-unit.with-label:hover{background:var(--blue-bg);border-color:transparent}\n.panel-h .sub .ico-open{vertical-align:-3px;color:var(--muted)}\n\n/* ---------- Поиск по таблице ---------- */\n/* основа 150px, рост до 220: так поле встаёт в строку с заголовком панели,\n   пока хватает места, и уходит под него, только когда не хватает */\n.tsearch{display:inline-flex;align-items:center;gap:var(--s3);flex:1 1 150px;max-width:220px;min-width:150px;height:30px;\n  margin-left:auto;padding:0 var(--s5);border:1px solid var(--line);border-radius:var(--r-pill);background:#fff;\n  color:var(--muted);font-weight:var(--fw-body);cursor:text}\n.tsearch:focus-within{border-color:var(--act);box-shadow:0 0 0 3px rgba(36,95,212,.14)}\n.tsearch input{flex:1 1 auto;min-width:0;width:100%;height:100%;border:0;outline:0;padding:0;background:transparent;\n  font:inherit;font-size:var(--fs-body);color:var(--ink)}\n.tsearch input::placeholder{color:var(--muted)}\nmark.hl{background:var(--act-line);color:var(--act-ink);border-radius:2px;padding:0 1px}\n/* предки находок — контекст, а не результат: тише */\n.ptable tr.urow.anc td.txt .row-body{color:var(--muted)}\n.ptable tr.tree-empty td.txt{padding:var(--s8) var(--pad-cell);color:var(--muted);white-space:normal;cursor:default}\n\n/* ---------- Путь над отчётом: «← Назад» и «↑ Уровнем выше» ---------- */\n.rh-crumbs .nbs{display:inline-flex;gap:var(--s3);margin-right:var(--s4)}\n.rh-crumbs .nb{display:inline-flex;align-items:center;height:22px;padding:0 var(--s5);border:1px solid var(--line);\n  border-radius:var(--r-pill);background:#fff;color:var(--ink2);font-size:var(--fs-note);white-space:nowrap}\n.rh-crumbs .nb:hover{border-color:var(--act-line);background:var(--blue-bg);color:var(--act-ink);text-decoration:none}\n\n/* ИТОГО — под шапкой, какой бы высоты она ни вышла (--thead-h ставит app.js) */\n.ptable tr.total.top td{top:var(--thead-h,29px)}\n/* В border-collapse рамка липкой ячейки остаётся на месте, а сама ячейка\n   едет: под ИТОГО оставалась щель в 2px, в которую просвечивали строки.\n   Линию под итогом рисует тень внутри ячейки — она едет вместе с ней. */\n.split-l .ptable.dense tr.total.top td{border-bottom:0;box-shadow:inset 0 -2px 0 var(--line)}\n\n/* ============================================================================\n   Итерация 30: ширина колонок рабочей зоны (механика HRBP HUB)\n   Таблицу и графики разводит разделитель — третья колонка сетки шириной\n   в прежний зазор (16px). Его тянут мышью и пальцем, ← → двигают его\n   с клавиатуры, двойной клик возвращает раскладку по умолчанию. Любую\n   панель можно развернуть во всю ширину — вторая сворачивается в полосу\n   со своим именем. Всё это — только пока колонки стоят рядом: ниже 1121px\n   (широкой таблице — 1241px) они и так одна под другой.\n   ========================================================================== */\n.split-gut,.split-rail{display:none}\n.split-gut{position:relative;align-self:stretch;justify-content:center;align-items:center;\n  cursor:col-resize;outline:none;touch-action:none}\n.split-gut i{display:block;width:4px;height:44px;border-radius:var(--r-pill);background:var(--line);\n  transition:background .12s,height .12s}\n.split-gut:hover i,.split-gut:focus-visible i,.split-drag .split-gut i{background:var(--act);height:64px}\n/* пока тянут — курсор и выделение не скачут, подсказка не едет за мышью */\n.split-drag,.split-drag *{cursor:col-resize!important;user-select:none!important}\n.split-drag .tip{visibility:hidden}\n\n.split-btn{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:30px;height:30px;\n  padding:0;border:0;border-radius:var(--r3);background:transparent;color:var(--muted);cursor:pointer}\n.split-btn:hover{background:#eef1f6;color:var(--ink)}\n.split-btn.on{color:var(--act)}\n/* Кнопка — в правом углу блока заголовка, на своём поле: блок растягивается\n   на свободное место строки, поэтому кнопка стоит у края панели, когда поиск\n   или вкладки ушли на вторую строку, и перед ними — когда поместились рядом. */\n.panel-h .h-txt.has-btn{position:relative;flex:1 1 auto;padding-right:38px}\n.panel-h .h-txt>.split-btn{position:absolute;right:0;top:50%;transform:translateY(-50%)}\n\n.split-rail{flex-direction:column;align-items:center;gap:var(--s4);width:40px;padding:var(--s6) 0;\n  border:1px solid var(--line);border-radius:var(--radius);background:var(--card);color:var(--muted);\n  font-size:var(--fs-note);cursor:pointer;box-shadow:var(--shadow)}\n.split-rail:hover{color:var(--act);border-color:var(--act-line);background:var(--blue-bg)}\n.split-rail span{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap}\n.split-rail i{font-style:normal;font-size:11px}\n\n@media(min-width:1121px){\n  .split>.split-gut{display:flex}\n  /* доля после перетаскивания; у каждой колонки остаётся минимум 340px */\n  .split.custom{grid-template-columns:minmax(340px,var(--split-l)) 16px minmax(340px,var(--split-r))}\n  .split.m-table{grid-template-columns:minmax(0,1fr) 40px;column-gap:16px}\n  .split.m-charts{grid-template-columns:40px minmax(0,1fr);column-gap:16px}\n  .split.m-table>.split-r,.split.m-table>.split-gut,\n  .split.m-charts>.split-l,.split.m-charts>.split-gut{display:none}\n  .split.m-table>.split-rail.r,.split.m-charts>.split-rail.l{display:flex}\n}\n/* широкая таблица стоит над графиком до 1240px — там раскладку не трогаем */\n@media(min-width:1121px) and (max-width:1240px){\n  .split.wide-l.wide-l{grid-template-columns:1fr;column-gap:0}\n  .split.wide-l.wide-l>.split-l,.split.wide-l.wide-l>.split-r{display:flex}\n  .split.wide-l.wide-l>.split-gut,.split.wide-l.wide-l>.split-rail{display:none}\n}\n/* одна колонка — кнопкам «во всю ширину» нечего делать, и поле под них не нужно */\n@media(max-width:1120px){.split-btn{display:none}.panel-h .h-txt.has-btn{padding-right:0}}\n@media(min-width:1121px) and (max-width:1240px){.split.wide-l .split-btn{display:none}\n  .split.wide-l .panel-h .h-txt.has-btn{padding-right:0}}\n\n/* ===== Итерация 31: пробник Proteus ==========================================\n   Метрика или разбивка без источника — заглушка на генераторе, и это сказано у\n   её имени серой меткой «демо». Не оценка и не сигнал: ни цвета светофора, ни\n   акцента — пунктирная рамка, как у всего «ещё не настоящего». Видна только в\n   чарте Proteus (TP_REAL): в макете метка не рисуется. */\n.demo-tag{display:inline-block;margin-left:var(--s3);padding:0 var(--s3);border:1px dashed var(--muted2);\n  border-radius:var(--r-pill);font-size:var(--fs-micro);font-weight:var(--fw-body);line-height:15px;\n  color:var(--muted);background:var(--card);vertical-align:1px;text-transform:none;letter-spacing:0;white-space:nowrap}\n.demo-tag.sm{display:block;width:max-content;margin:var(--s1) auto 0;padding:0 var(--s2);line-height:13px}\n.demo-note{display:flex;gap:var(--s4);align-items:baseline;margin:0 0 var(--s6);padding:var(--s4) var(--s5);\n  border:1px dashed var(--muted2);border-radius:var(--r2);font-size:var(--fs-note);line-height:1.4;\n  color:var(--ink2);background:var(--bg)}\n.demo-note .demo-tag{margin-left:0;flex:none}\n/* чипы пробника в шапке: что здесь живое, ожидание ответа, предупреждение */\n.chip.pilot{background:var(--card);color:var(--ink2);border:1px dashed var(--muted2);font-weight:var(--fw-body)}\n.chip.busy{background:var(--card);color:var(--act-ink);border-color:var(--act-line);font-weight:var(--fw-body);\n  animation:tp-busy 1.2s ease-in-out infinite alternate}\n.chip.warn{background:var(--warn-bg);color:var(--warn-tx);border-color:var(--warn-bg);font-weight:var(--fw-body)}\n@keyframes tp-busy{from{opacity:1}to{opacity:.45}}\n/* пока датасет отвечает на переход или фильтр, прежний юнит приглушён */\n.tp-busy #view{opacity:.5;pointer-events:none;transition:opacity .2s}\n/* корень отчёта внутри хоста ECharts: он и прокручивается (prelude.js) */\n.tp-overlay{background:var(--bg)}\n/* «План метрик» в справке — только в пробнике */\n.pilot-only{display:none}\n.tp-pilot .pilot-only{display:block}\n.plan-t{width:100%;border-collapse:collapse;font-size:var(--fs-note);margin-top:var(--s4)}\n.plan-t th,.plan-t td{text-align:left;padding:var(--s3) var(--s4);border-bottom:1px solid var(--line2);vertical-align:top}\n.plan-t th{font-size:var(--fs-cap);font-weight:var(--fw-bold);color:var(--muted);text-transform:uppercase;letter-spacing:.02em}\n.plan-t td:first-child{font-weight:var(--fw-bold);white-space:nowrap}\n";
var TP_HTML = "<a class=\"skip-link\" href=\"#view\">Перейти к отчёту</a>\n<div class=\"nav-scrim\" id=\"navScrim\"></div>\n<header class=\"apphead\">\n  <div class=\"apphead-top\">\n    <button class=\"nav-toggle\" id=\"navToggle\" aria-label=\"Открыть навигацию\" aria-expanded=\"false\">☰</button>\n    <div class=\"logo\"><span class=\"mark\">T</span>TeamPulse&nbsp;<small>Hub · макет</small></div>\n    <div class=\"spacer\"></div>\n    <div class=\"freshness\" id=\"freshness\"></div>\n  </div>\n</header>\n<div class=\"layout\">\n  <nav class=\"nav\" id=\"sideNav\" aria-label=\"Разделы отчёта\">\n    <div class=\"nav-h\">Сводка</div>\n    <button class=\"nav-i\" data-tab=\"onepager\"><span class=\"ico\"></span>One-pager</button>\n    <div class=\"nav-sep\"></div>\n    <div class=\"nav-h\">Блоки метрик</div>\n    <div id=\"navBlocks\"></div>\n    <div class=\"nav-foot\" id=\"navFoot\"></div>\n  </nav>\n  <div class=\"main-col\">\n    <section class=\"reporthead\">\n      <div class=\"rh-row\">\n        <div class=\"rh-main\">\n          <div class=\"rh-crumbs\" id=\"crumbs\"></div>\n          <h1 class=\"rh-title\" id=\"unitTitle\"></h1>\n          <div class=\"chips\" id=\"chips\"></div>\n        </div>\n        <div class=\"rh-side\">\n          <button class=\"btn ghost\" id=\"btnHelp\">Как читать отчёт</button>\n          <button class=\"btn primary\" id=\"btnSetup\">Настрой свой дашборд</button>\n        </div>\n      </div>\n    </section>\n    <main class=\"content\" id=\"view\" tabindex=\"-1\"></main>\n  </div>\n</div>\n<div id=\"pulseHost\"></div>\n<div class=\"ovl hidden\" id=\"setupOvl\">\n  <div class=\"modal wide\">\n    <div class=\"modal-h\">\n      <div class=\"mh-pulse\" id=\"setupPulse\"></div>\n      <h3>Настрой свой дашборд</h3>\n      <p>Выберите подразделение, разрезы и состав метрик. Важно: разрезы одновременно задают и вашу команду, и базу сравнения — то, с чем сравниваются все метрики.</p>\n    </div>\n    <div class=\"modal-b setup-cols\">\n      <div class=\"sc-col\">\n      <div class=\"fgrp\">\n        <label>1 · Подразделение</label>\n        <div class=\"ctl\"><select id=\"selUnit\"></select></div>\n        <div class=\"fhint\">Определяет вашу команду. На базу сравнения не влияет.</div>\n      </div>\n      <div class=\"fgrp\">\n        <label>2 · Покраска</label>\n        <div class=\"opts\" id=\"optPaint\"></div>\n      </div>\n      <div class=\"fgrp\">\n        <label>3 · Разрез IT</label>\n        <div class=\"opts\" id=\"optIt\"></div>\n      </div>\n      <div class=\"fgrp\">\n        <label>4 · Штат и не штат</label>\n        <div class=\"opts\" id=\"optStaff\"></div>\n      </div>\n      <div class=\"bench-preview\" id=\"benchPreview\"></div>\n      </div>\n      <div class=\"sc-col\">\n      <div class=\"fgrp last\">\n        <label>5 · Метрики в отчёте</label>\n        <div class=\"opts tight\" id=\"optPreset\"></div>\n        <div class=\"mpick\" id=\"metricPick\"></div>\n        <div class=\"fhint\" id=\"metricCount\"></div>\n      </div>\n      </div>\n    </div>\n    <div class=\"modal-f\">\n      <button class=\"btn\" id=\"btnReset\">Сбросить разрезы</button>\n      <button class=\"btn\" id=\"btnLink\">Скопировать ссылку</button>\n      <div class=\"sp\"></div>\n      <button class=\"btn\" id=\"btnCancel\">Отмена</button>\n      <button class=\"btn primary\" id=\"btnApply\">Применить</button>\n    </div>\n  </div>\n</div>\n<div class=\"ovl hidden\" id=\"helpOvl\">\n  <div class=\"modal\">\n    <div class=\"modal-h\">\n      <div class=\"mh-pulse\" id=\"helpTopPulse\"></div>\n      <h3>Как читать отчёт</h3>\n      <p>Четыре правила, которые делают весь отчёт понятным.</p>\n    </div>\n    <div class=\"modal-b\">\n      <div class=\"fgrp\">\n        <label>Фильтры управляют и сравнением</label>\n        <div class=\"fhint\">Выбрали HQ — сравнение со всем HQ. Добавили IT — сравнение со всем HQ IT. Текущая база всегда показана серой плашкой в шапке.</div>\n      </div>\n      <div class=\"fgrp\">\n        <label>Цвет — это отклонение от базы</label>\n        <div class=\"legend\" style=\"margin:0\">\n          <span class=\"sw\"><span class=\"dot\" style=\"background:#bff2cd\"></span>лучше базы</span>\n          <span class=\"sw\"><span class=\"dot\" style=\"background:#ffcccc\"></span>хуже базы</span>\n          <span class=\"sw\"><span class=\"dot\" style=\"background:#f3f4f6\"></span>на уровне ±5% или без оценки</span>\n        </div>\n        <div class=\"fhint\">Цветов ровно два: зелёный — есть чем воспользоваться, красный — есть что разбирать. Всё остальное серое, включая отклонение в пределах ±5%: присматриваться там не к чему. Численность, найм и переводы не окрашиваются вообще — больше или меньше здесь не значит хуже или лучше.</div>\n      </div>\n      <div class=\"fgrp\">\n        <label>KPI важнее средней</label>\n        <div class=\"fhint\">Где есть утверждённый KPI (regrettable текучесть по HQ, выполнение плана найма), метрика сравнивается с целью KPI, а не со средней по базе, — и в карточке, и в таблице, и на графике. Базы там нет вовсе: два ориентира рядом заставляли бы выбирать, по какому судить.</div>\n      </div>\n      <div class=\"fgrp\">\n        <label>Изменение — к прошлому месяцу, а не к базе</label>\n        <div class=\"fhint\">Пилюля рядом со значением («+3 к маю») — это изменение месяца к предыдущему, а не отклонение от базы сравнения. Отклонение от базы живёт отдельной строкой: «база 9,0%» в карточке и колонка «Сравнение» в сводной таблице. В колонке «За год» сравнение идёт с тем же месяцем год назад, а не с началом периода.</div>\n      </div>\n      <div class=\"fgrp pilot-only\" id=\"planHost\"></div>\n      <div class=\"help-pulse\" id=\"helpPulse\"></div>\n    </div>\n    <div class=\"modal-f\"><div class=\"sp\"></div><button class=\"btn primary\" id=\"btnHelpClose\">Понятно</button></div>\n  </div>\n</div>";
try {
  (function () {
    (function () {
      'use strict';

      var MONTH_ABBR = ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
      var MONTH_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
      var COLS = ['hc', 'act', 'avg', 'hire', 'fire', 'reg', 'tin', 'tout', 'plow', 'prat'];
      var KEY = {
        hc_total: 'hc',
        hc_active: 'act',
        hc_avg: 'avg',
        hire: 'hire',
        attrition: 'fire',
        transfer_in: 'tin',
        transfer_out: 'tout',
        regret_cnt: 'reg',
        plow: 'plow',
        prated: 'prat'
      };
      var STUB = ['vac_open', 'vac_closed', 'time_to_fill', 'hire_plan', 'junior_share', 'tgrowth_pass', 'tgrowth_deny', 'tgrowth_conv', 'tgrowth_tat', 'underwork', 'review_up', 'office_att', 'booking_viol', 'ai_penetration', 'ai_wau'];
      var PLAN = [{
        stage: '0',
        what: 'Численность общая и активная, найм, отток, переводы, прирост с начала года, ' + 'текучесть месячная и накопительная, прогноз, замещение, найм на 100, доля внутреннего найма, regret, ' + 'низкая оценка; дерево юнитов, покраска, IT, штат',
        src: 'hr_structure_overall',
        now: 'живые'
      }, {
        stage: '1',
        what: 'Разбивки состава по типу численности, типу договора, покраске и IT',
        src: 'hr_structure_overall — новые строки датасета',
        now: 'демо'
      }, {
        stage: '2',
        what: 'Вакансии, срок закрытия, план найма, воронка, доля джунов, каналы найма',
        src: 'vacancy_daily_for_digest, plan_fact_tf_rabota, atributy_nayma, junior_ratio_hr_digest',
        now: 'демо'
      }, {
        stage: '3',
        what: 'Причины и инициаторы увольнений, стаж и грейд ушедших',
        src: 'ys_all_fire_initiative, initiative_reason_unit_tekuchest',
        now: 'демо'
      }, {
        stage: '4',
        what: 'Состав: грейд, сеньорность, пол, возраст, стаж, формат работы, юрлицо, регион, стрим',
        src: 'mdm_employee_structure_d → ноут Helicopter, как в HRBP HUB',
        now: 'демо'
      }, {
        stage: '5',
        what: 'Ревью и недоработка',
        src: 'review_digest_us, review_table_ys; недоработка — уточнить',
        now: 'демо'
      }, {
        stage: '6',
        what: 'T-рост: заявки, решения, конверсия, T@T',
        src: 'сервис «Рост» (дашборд 34136)',
        now: 'демо'
      }, {
        stage: '7',
        what: 'Посещаемость офиса и бронирование',
        src: 'СКУД и система бронирования (дашборд 34136)',
        now: 'демо'
      }, {
        stage: '8',
        what: 'AI: проникновение и активные пользователи',
        src: 'penetration_unit, penetration_company, wau',
        now: 'демо'
      }];
      var PAINT_V = {
        HQ: 'Hq',
        Line: 'Line',
        Support: 'Support'
      };
      var IT_V = {
        IT: 'IT',
        Digital: 'Digital',
        nonIT: 'NonIT'
      };
      var STAFF_V = {
        staff: 'Штат',
        nonstaff: 'Не штат'
      };
      function str(v) {
        return v == null ? '' : String(v);
      }
      function num(v) {
        var n = +v;
        return isFinite(n) ? n : 0;
      }
      function parseArr(s, n) {
        var a = str(s).split(','),
          out = new Array(n);
        for (var i = 0; i < n; i++) out[i] = i < a.length ? num(a[i]) : 0;
        return out;
      }
      function ym(s) {
        var p = str(s).split('-');
        return {
          y: +p[0] || 1970,
          m: (+p[1] || 1) - 1
        };
      }
      function invert(o) {
        var r = {};
        Object.keys(o).forEach(function (k) {
          r[o[k]] = k;
        });
        return r;
      }
      function pairs(list) {
        return (list || []).map(function (x) {
          return Array.isArray(x) ? {
            v: str(x[0]),
            n: num(x[1])
          } : {
            v: str(x.v),
            n: num(x.e)
          };
        });
      }
      var FIELDS = ['role', 'id', 'pid', 'lvl', 'nm', 'kids', 'j'].concat(COLS.map(function (c) {
        return 'm_' + c;
      }));
      function build(data) {
        var rows = Array.isArray(data) ? data : [];
        var missing = rows.length ? FIELDS.filter(function (f) {
          return !(f in rows[0]);
        }) : [];
        var by = function by(role) {
          return rows.filter(function (r) {
            return str(r.role) === role;
          });
        };
        var meta = {};
        try {
          meta = JSON.parse(str((by('meta')[0] || {}).j) || '{}');
        } catch (e) {
          meta = {};
        }
        var n = Math.max(1, num(meta.n) || parseArr((by('scope')[0] || {}).m_hc, 0).length || 1);
        var m0 = ym(meta.m0);
        var monthsExt = [];
        for (var i = 0; i < n; i++) {
          var t = m0.y * 12 + m0.m + i,
            y = Math.floor(t / 12),
            m = t % 12;
          monthsExt.push({
            y: y,
            m: m,
            label: MONTH_ABBR[m],
            isYearStart: m === 0
          });
        }
        var N = Math.min(12, n),
          pre = n - N,
          months = monthsExt.slice(pre);
        var nm = function nm(mm) {
          return MONTH_NOM[mm.m] + ' ' + mm.y;
        };
        var periodLabel = nm(months[0]) + ' — ' + nm(months[months.length - 1]);
        var byId = {};
        str((by('dict')[0] || {}).j).split('\n').forEach(function (line) {
          if (!line) return;
          var f = line.split('\t');
          byId[f[0]] = {
            id: f[0],
            pid: f[1] || '',
            lvl: num(f[2]),
            kids: num(f[3]),
            name: f.slice(4).join('\t')
          };
        });
        var DEPTH = {
          scope: 0,
          c: 1,
          g: 2,
          x: 3
        };
        var units = [];
        rows.forEach(function (r) {
          var role = str(r.role);
          if (!(role in DEPTH)) return;
          var u = {
            id: str(r.id),
            pid: str(r.pid),
            lvl: num(r.lvl),
            kids: num(r.kids),
            name: str(r.nm),
            depth: DEPTH[role],
            ser: {}
          };
          COLS.forEach(function (c) {
            u.ser[c] = parseArr(r['m_' + c], n);
          });
          units.push(u);
          byId[u.id] = Object.assign(byId[u.id] || {}, {
            id: u.id,
            pid: u.pid,
            lvl: u.lvl,
            kids: u.kids,
            name: u.name
          });
        });
        var scopeU = units.find(function (u) {
          return u.depth === 0;
        }) || null;
        var rootId = str(meta.root) || (scopeU ? scopeU.id : '');
        var pathMemo = {};
        function pathOf(id, guard) {
          if (pathMemo[id] !== undefined) return pathMemo[id];
          if (id === rootId) return pathMemo[id] = 'T';
          var u = byId[id];
          if (!u || !u.pid || (guard || 0) > 16) return pathMemo[id] = null;
          var pp = pathOf(u.pid, (guard || 0) + 1);
          return pathMemo[id] = pp == null ? null : pp + '/' + id;
        }
        if (scopeU && pathOf(scopeU.id) == null) {
          Object.keys(pathMemo).forEach(function (k) {
            delete pathMemo[k];
          });
          rootId = scopeU.id;
        }
        var lastOf = function lastOf(a) {
          return a[n - 1] || 0;
        };
        var nodes = [],
          _series = {};
        Object.keys(byId).forEach(function (id) {
          var u = byId[id],
            p = pathOf(id);
          if (p == null) return;
          var parts = p.split('/');
          nodes.push({
            id: id,
            path: p,
            parent: parts.length > 1 ? parts.slice(0, -1).join('/') : null,
            level: u.lvl || parts.length,
            name: u.name || '—',
            sort: 0,
            leaf: false,
            kids: u.kids,
            outside: true
          });
        });
        var nodeBy = {};
        nodes.forEach(function (x) {
          nodeBy[x.path] = x;
        });
        var kidsIn = {};
        units.forEach(function (u) {
          if (u.depth > 0) (kidsIn[u.pid] = kidsIn[u.pid] || []).push(u);
        });
        units.forEach(function (u) {
          var p = pathOf(u.id),
            node = nodeBy[p];
          if (!node) return;
          node.outside = false;
          node.sort = -lastOf(u.ser.hc);
          var ch = u.depth < 3 ? kidsIn[u.id] || [] : [];
          if (!ch.length) {
            node.leaf = true;
            if (u.depth === 3) node.below = u.kids;
            _series[p] = u.ser;
            return;
          }
          var own = {};
          var any = false;
          COLS.forEach(function (c) {
            own[c] = u.ser[c].map(function (v, i) {
              var s = v;
              ch.forEach(function (k) {
                s -= k.ser[c][i];
              });
              s = Math.round(s * 10) / 10;
              if (Math.abs(s) > 1e-9) any = true;
              return s;
            });
          });
          if (any) {
            var dp = p + '/·';
            var dn = {
              id: u.id + '·',
              path: dp,
              parent: p,
              level: (u.lvl || 0) + 1,
              name: 'Напрямую в «' + u.name + '»',
              sort: Infinity,
              leaf: true,
              direct: true,
              kids: 0,
              outside: false,
              hide: !(own.hc[n - 1] > 0)
            };
            nodes.push(dn);
            nodeBy[dp] = dn;
            _series[dp] = own;
          }
        });
        var baseRow = by('base')[0];
        if (baseRow) {
          var b = {};
          COLS.forEach(function (c) {
            b[c] = parseArr(baseRow['m_' + c], n);
          });
          _series.BASE = b;
        }
        var pv = invert(PAINT_V),
          iv = invert(IT_V),
          sv = invert(STAFF_V);
        var one = function one(list, map) {
          var a = (list || []).map(str);
          return a.length === 1 && map[a[0]] ? map[a[0]] : 'all';
        };
        var vals = meta.vals || {};
        return {
          n: n,
          pre: pre,
          months: months,
          monthsExt: monthsExt,
          periodLabel: periodLabel,
          lm: str(meta.lm),
          today: str(meta.today),
          rootId: rootId,
          scopeId: scopeU ? scopeU.id : rootId,
          scopePath: scopeU ? pathOf(scopeU.id) || 'T' : 'T',
          defId: str(meta.def),
          truncated: !rows.some(function (r) {
            return str(r.role) === 'end';
          }),
          missing: missing,
          noMeta: !by('meta').length,
          empty: !scopeU,
          nodes: nodes,
          applied: {
            paint: one(meta.paint, pv),
            itSeg: one(meta.it, iv),
            staffType: one(meta.staff, sv)
          },
          vals: {
            paint: pairs(vals.paint),
            it: pairs(vals.it),
            staff: pairs(vals.staff)
          },
          stub: new Set(STUB),
          series: function series(path, key) {
            var s = _series[path],
              c = KEY[key];
            return s && c ? s[c] : null;
          },
          hasSeries: function hasSeries(path) {
            return !!_series[path];
          },
          lastHc: function lastHc(path) {
            var s = _series[path];
            return s ? lastOf(s.hc) : 0;
          },
          idOf: function idOf(path) {
            var node = nodeBy[path];
            return node ? node.id : null;
          },
          filterValue: function filterValue(kind, key) {
            return ({
              paint: PAINT_V,
              itSeg: IT_V,
              staffType: STAFF_V
            }[kind] || {})[key] || null;
          }
        };
      }
      window.TPREAL = {
        build: build,
        FIELDS: FIELDS,
        STUB: STUB,
        PLAN: PLAN,
        PAINT_V: PAINT_V,
        IT_V: IT_V,
        STAFF_V: STAFF_V
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var ST = window.__pvtState || (window.__pvtState = {});
      var store = ST.tp || (ST.tp = {});
      (store.listeners || []).forEach(function (l) {
        try {
          l.t.removeEventListener(l.type, l.fn, l.opt);
        } catch (e) {}
      });
      store.listeners = [];
      var hosts = document.querySelectorAll('[_echarts_instance_]');
      var host = hosts.length ? hosts[hosts.length - 1] : document.body;
      Array.prototype.forEach.call(host.querySelectorAll('canvas'), function (c) {
        c.style.display = 'none';
      });
      Array.prototype.forEach.call(document.querySelectorAll('.tp-overlay, body > .tip'), function (n) {
        if (n.parentNode) n.parentNode.removeChild(n);
      });
      var css = document.querySelector('style[data-tp]');
      if (!css) {
        css = document.createElement('style');
        css.setAttribute('data-tp', '1');
        (document.head || document.body).appendChild(css);
      }
      css.textContent = TP_CSS;
      var root = document.createElement('div');
      root.className = 'tp-overlay';
      root.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:auto;' + 'z-index:10;box-sizing:border-box;';
      if (host !== document.body && getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(root);
      root.innerHTML = TP_HTML;
      window.TP_REAL = window.TPREAL.build(typeof data !== 'undefined' ? data : []);
      window.TP_ENV = {
        root: root,
        scroller: root,
        store: store,
        on: function on(t, type, fn, opt) {
          t.addEventListener(type, fn, opt);
          store.listeners.push({
            t: t,
            type: type,
            fn: fn,
            opt: opt
          });
        },
        emit: function emit(mask) {
          if (typeof applyCrossFilter !== 'function') return false;
          applyCrossFilter(mask);
          return true;
        }
      };
    })();
  })();
  (function () {
    function hashStr(s) {
      var h = 2166136261 >>> 0;
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
    function mulberry32(a) {
      return function () {
        a |= 0;
        a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function rng(seed) {
      return mulberry32(hashStr(seed));
    }
    var REAL = typeof window !== 'undefined' && window.TP_REAL || null;
    var MONTH_ABBR = ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
    var MONTHS = function () {
      if (REAL) return REAL.months;
      var seq = [[2025, 6], [2025, 7], [2025, 8], [2025, 9], [2025, 10], [2025, 11], [2026, 0], [2026, 1], [2026, 2], [2026, 3], [2026, 4], [2026, 5]];
      return seq.map(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
          y = _ref2[0],
          m = _ref2[1];
        return {
          y: y,
          m: m,
          label: MONTH_ABBR[m],
          isYearStart: m === 0
        };
      });
    }();
    var N = MONTHS.length,
      LAST = N - 1;
    var PERIOD_LABEL = REAL ? REAL.periodLabel : 'июль 2025 — июнь 2026';
    var MONTH_DAT = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];
    var MONTH_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    var MONTH_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    var CUR_M = MONTHS[LAST],
      PREV_M = MONTHS[LAST - 1];
    var YOY_M = {
      y: CUR_M.y - 1,
      m: CUR_M.m
    };
    function monthNom(mm) {
      return MONTH_NOM[mm.m] + ' ' + mm.y;
    }
    function monthGen(mm) {
      return MONTH_GEN[mm.m] + ' ' + mm.y;
    }
    var CMP = {
      cur: monthNom(CUR_M),
      momShort: 'к ' + MONTH_DAT[PREV_M.m],
      momFull: 'к ' + MONTH_DAT[PREV_M.m] + ' ' + PREV_M.y,
      yoy: 'к ' + MONTH_DAT[YOY_M.m] + ' ' + YOY_M.y,
      momTip: {
        title: 'Изменение за месяц',
        text: monthNom(CUR_M) + ' против ' + monthGen(PREV_M) + '. Не отклонение от базы сравнения: ' + 'база стоит отдельной строкой в карточке.'
      },
      yoyTip: {
        title: 'Изменение за год',
        text: monthNom(CUR_M) + ' против ' + monthGen(YOY_M) + ' — тот же месяц год назад, а не начало периода.'
      }
    };
    var PRE = REAL ? REAL.pre : 6;
    var MONTHS_EXT = function () {
      if (REAL) return REAL.monthsExt;
      var out = [];
      for (var m = 0; m < PRE; m++) out.push({
        y: 2025,
        m: m,
        label: MONTH_ABBR[m],
        isYearStart: m === 0
      });
      return out.concat(MONTHS);
    }();
    var NEXT = MONTHS_EXT.length;
    var YEAR_START_EXT = MONTHS_EXT.map(function (mm) {
      for (var j = 0; j < NEXT; j++) if (MONTHS_EXT[j].y === mm.y && MONTHS_EXT[j].m === 0) return j;
      return 0;
    });
    function ytdBase(i) {
      var j = YEAR_START_EXT[i];
      return j > 0 ? j - 1 : 0;
    }
    var BLOCKS = [{
      key: 'structure',
      name: 'Структура численности',
      hint: 'Сколько людей в команде, кто они и где работают.',
      drillUrl: '#/detail/structure',
      dash: ['34661', '34136']
    }, {
      key: 'movement',
      name: 'Движение персонала',
      hint: 'Найм, отток и переводы в команду и из неё; растёт ли команда.',
      drillUrl: '#/detail/movement',
      dash: ['34661', '34136']
    }, {
      key: 'turnover',
      name: 'Отток и текучесть',
      hint: 'Темпы увольнений, прогноз на год, кто и почему уходит.',
      drillUrl: '#/detail/turnover',
      dash: ['34661', '34136']
    }, {
      key: 'hiring',
      name: 'Найм и вакансии',
      hint: 'Вакансии, план-факт подбора, каналы и профиль найма.',
      drillUrl: '#/detail/hiring',
      dash: ['34661', '34136']
    }, {
      key: 'tgrowth',
      name: 'T-рост',
      hint: 'Заявки на рост, решения по ним, время до повышения и статусы по грейдам.',
      drillUrl: '#/detail/tgrowth',
      dash: ['34136']
    }, {
      key: 'monitor',
      name: 'Мониторинг работы',
      hint: 'Лоу-перформеры, недоработка и итоги ревью.',
      drillUrl: '#/detail/monitor',
      dash: ['34661']
    }, {
      key: 'office',
      name: 'Посещаемость офисов',
      hint: 'Посещаемость, офисы и города, качество бронирования.',
      drillUrl: '#/detail/office',
      dash: ['34136']
    }, {
      key: 'ai',
      name: 'AI-инструменты',
      hint: 'Проникновение AI-инструментов и активные пользователи.',
      drillUrl: '#/detail/ai',
      dash: ['34136']
    }];
    var BLOCK_BY_KEY = Object.fromEntries(BLOCKS.map(function (b) {
      return [b.key, b];
    }));
    var PROTEUS_DASH = {
      '34661': 'Team Pulse: Управленческая структура',
      '34136': 'Team Pulse: Управленческая структура HQ'
    };
    function blockDash(bk, st) {
      var ids = (BLOCK_BY_KEY[bk] || {}).dash || [];
      var id = ids.length > 1 ? st && st.paint === 'HQ' ? '34136' : '34661' : ids[0];
      return id ? {
        id: id,
        name: PROTEUS_DASH[id],
        href: '#/proteus/' + id,
        only: ids.length === 1
      } : null;
    }
    var METRICS = [{
      key: 'hc_active',
      block: 'structure',
      name: 'Активная численность',
      short: 'Активные',
      fmt: 'int',
      better: 'flat',
      unit: 'чел',
      anchor: null,
      hint: 'Сотрудники без длительных отсутствий на конец месяца.'
    }, {
      key: 'hc_total',
      block: 'structure',
      name: 'Общая численность',
      short: 'Всего',
      fmt: 'int',
      better: 'flat',
      unit: 'чел',
      anchor: null,
      hint: 'Списочная численность на конец месяца, включая декреты и длительные отсутствия.'
    }, {
      key: 'hire',
      block: 'movement',
      name: 'Найм',
      short: 'Найм',
      fmt: 'int',
      better: 'flat',
      unit: 'чел',
      anchor: null,
      hint: 'Принятые за месяц.'
    }, {
      key: 'attrition',
      block: 'movement',
      name: 'Отток',
      short: 'Отток',
      fmt: 'int',
      better: 'lower',
      unit: 'чел',
      anchor: null,
      hint: 'Уволившиеся за месяц (все причины).'
    }, {
      key: 'transfer_in',
      block: 'movement',
      name: 'Переводы в команду',
      short: 'Перев. в',
      fmt: 'int',
      better: 'flat',
      unit: 'чел',
      anchor: null,
      hint: 'Внутренние переходы из других команд.'
    }, {
      key: 'transfer_out',
      block: 'movement',
      name: 'Переводы из команды',
      short: 'Перев. из',
      fmt: 'int',
      better: 'flat',
      unit: 'чел',
      anchor: null,
      hint: 'Внутренние переходы в другие команды.'
    }, {
      key: 'net_ytd',
      block: 'movement',
      name: 'Прирост с начала года',
      short: 'Прирост',
      fmt: 'int',
      better: 'flat',
      unit: 'чел',
      anchor: null,
      ytdDelta: 'hc_total',
      hint: 'Изменение общей численности с начала календарного года: значение на конец месяца минус численность на 31 декабря.'
    }, {
      key: 'replace_ratio',
      block: 'movement',
      name: 'Коэффициент замещения',
      short: 'Замещ.',
      fmt: 'ratio',
      better: 'flat',
      unit: '×',
      anchor: null,
      derived: {
        num: 'hire',
        den: 'attrition',
        win: 'ytd',
        dp: 4
      },
      hint: 'Найм к оттоку с начала года. Больше 1 — приходит больше людей, чем уходит; меньше 1 — команда не восполняет уходы внешним наймом.'
    }, {
      key: 'hire_rate',
      block: 'movement',
      name: 'Найм на 100 человек',
      short: 'Найм /100',
      fmt: 'pct',
      better: 'flat',
      unit: '%',
      anchor: null,
      derived: {
        num: 'hire',
        den: 'hc_avg',
        scale: 100
      },
      hint: 'Принятые за месяц на 100 человек среднесписочной численности. В отличие от найма в людях, сравнивается с базой. Отток на 100 человек — это текучесть месячная.'
    }, {
      key: 'turnover_m',
      block: 'turnover',
      name: 'Текучесть месячная',
      short: 'Тек. мес',
      fmt: 'pct',
      better: 'lower',
      unit: '%',
      anchor: null,
      derived: {
        num: 'attrition',
        den: 'hc_avg',
        scale: 100
      },
      hint: 'Отток за месяц к среднесписочной численности этого месяца, в процентах.'
    }, {
      key: 'turnover_y',
      block: 'turnover',
      name: 'Текучесть накопительная',
      short: 'Тек. накоп.',
      fmt: 'pct',
      better: 'lower',
      unit: '%',
      anchor: null,
      ytd: 'turnover_m',
      fc: 'turnover_fc',
      hint: 'Сумма месячной текучести с января текущего года. Обнуляется каждый январь и растёт до декабря.'
    }, {
      key: 'regret',
      block: 'turnover',
      name: 'Regrettable текучесть',
      short: 'Regret',
      fmt: 'pct',
      better: 'lower',
      unit: '%',
      anchor: 5.1,
      kpi: {
        green: 4,
        red: 7
      },
      hint: 'Нежелательные уходы ценных сотрудников. По HQ есть KPI.'
    }, {
      key: 'turnover_fc',
      block: 'turnover',
      name: 'Прогноз годовой текучести',
      short: 'Прогноз',
      fmt: 'pct',
      better: 'lower',
      unit: '%',
      anchor: null,
      runRate: 'turnover_y',
      hint: 'Накопительная текучесть с начала года, пересчитанная на 12 месяцев: чем закончится год, если темп увольнений сохранится.'
    }, {
      key: 'vac_open',
      block: 'hiring',
      name: 'Открытые вакансии',
      short: 'Открытые',
      fmt: 'int',
      better: 'flat',
      unit: 'шт',
      anchor: null,
      hint: 'Вакансии в работе на конец месяца.'
    }, {
      key: 'vac_closed',
      block: 'hiring',
      name: 'Закрытые вакансии',
      short: 'Закрытые',
      fmt: 'int',
      better: 'higher',
      unit: 'шт',
      anchor: null,
      hint: 'Вакансии, закрытые за месяц.'
    }, {
      key: 'time_to_fill',
      block: 'hiring',
      name: 'Срок закрытия вакансии',
      short: 'Time-to-fill',
      fmt: 'days',
      better: 'lower',
      unit: 'дн',
      anchor: 47,
      hint: 'Среднее время от открытия до закрытия вакансии.'
    }, {
      key: 'hire_plan',
      block: 'hiring',
      name: 'Выполнение плана найма',
      short: 'План',
      fmt: 'pct',
      better: 'higher',
      unit: '%',
      anchor: null,
      derived: {
        num: 'hire',
        den: 'pf_plan',
        scale: 100,
        win: 'ytd'
      },
      kpi: {
        green: 95,
        red: 80
      },
      hint: 'Принятые к плану найма с начала года — массовый и профильный найм вместе. Факт — тот же найм, что в «Движении персонала». Цель KPI — 95% плана.'
    }, {
      key: 'junior_share',
      block: 'hiring',
      name: 'Доля джунов в найме',
      short: 'Джуны',
      fmt: 'pct',
      better: 'flat',
      unit: '%',
      anchor: null,
      derived: {
        num: 'hire_jun',
        den: 'hire',
        scale: 100,
        win: 'ytd'
      },
      hint: 'Junior среди принятых с начала года. Больше — дешевле найм и больше нагрузка на наставников; меньше — дороже и дольше подбор. Оценки нет: это выбор стратегии, а не результат.'
    }, {
      key: 'internal_share',
      block: 'hiring',
      name: 'Доля внутреннего найма',
      short: 'Внутр.',
      fmt: 'pct',
      better: 'flat',
      unit: '%',
      anchor: null,
      derived: {
        num: 'transfer_in',
        den: ['hire', 'transfer_in'],
        scale: 100,
        win: 'ytd'
      },
      hint: 'Доля пришедших переводом из других команд среди всех пришедших с начала года: какая часть позиций закрыта людьми изнутри компании.'
    }, {
      key: 'tgrowth_pass',
      block: 'tgrowth',
      name: 'Прошли T-рост',
      short: 'Прошли',
      fmt: 'int',
      better: 'higher',
      unit: 'чел',
      anchor: null,
      hint: 'Сотрудники с положительным решением по T-росту.'
    }, {
      key: 'tgrowth_deny',
      block: 'tgrowth',
      name: 'Отказано в T-росте',
      short: 'Отказано',
      fmt: 'int',
      better: 'lower',
      unit: 'чел',
      anchor: null,
      hint: 'Заявки с отрицательным решением.'
    }, {
      key: 'tgrowth_conv',
      block: 'tgrowth',
      name: 'Конверсия T-роста',
      short: 'Конверсия',
      fmt: 'pct',
      better: 'higher',
      unit: '%',
      anchor: 68,
      hint: 'Доля положительных решений от всех заявок.'
    }, {
      key: 'tgrowth_tat',
      block: 'tgrowth',
      name: 'Время до повышения (T@T)',
      short: 'T@T',
      fmt: 'mon',
      better: 'lower',
      unit: 'мес',
      anchor: 16,
      hint: 'Сколько месяцев в среднем прошло от прошлого повышения до нового у тех, кто прошёл T-рост в этом месяце.'
    }, {
      key: 'low_perf',
      block: 'monitor',
      name: 'Лоу-перформеры',
      short: 'Лоу-перф',
      fmt: 'pct',
      better: 'lower',
      unit: '%',
      anchor: 4.2,
      hint: 'Доля сотрудников с низкой результативностью.'
    }, {
      key: 'underwork',
      block: 'monitor',
      name: 'Недоработчики',
      short: 'Недораб.',
      fmt: 'pct',
      better: 'lower',
      unit: '%',
      anchor: 6.8,
      hint: 'Доля сотрудников с недоработкой нормы времени.'
    }, {
      key: 'review_up',
      block: 'monitor',
      name: 'Улучшили оценку в ревью',
      short: 'Улучшили',
      fmt: 'pct',
      better: 'higher',
      unit: '%',
      anchor: null,
      derived: {
        num: 'rev_up',
        den: 'rev_eval',
        scale: 100
      },
      hint: 'Доля сотрудников, у которых оценка последнего цикла ревью выше прошлой. Ревью — раз в полгода, между циклами значение не меняется.'
    }, {
      key: 'office_att',
      block: 'office',
      name: 'Посещаемость офиса',
      short: 'Офис',
      fmt: 'pct',
      better: 'higher',
      unit: '%',
      anchor: 58,
      hint: 'Средняя доля рабочих дней в офисе.'
    }, {
      key: 'booking_viol',
      block: 'office',
      name: 'Нарушения бронирования',
      short: 'Нарушения',
      fmt: 'pct',
      better: 'lower',
      unit: '%',
      anchor: 17,
      hint: 'Доля офисных дней с нарушением — бронь без прихода или приход без брони — от всех дней с бронью или посещением.'
    }, {
      key: 'ai_penetration',
      block: 'ai',
      name: 'Проникновение AI',
      short: 'Проникн.',
      fmt: 'pct',
      better: 'higher',
      unit: '%',
      anchor: null,
      derived: {
        num: 'ai_wau',
        den: 'hc_active',
        scale: 100
      },
      hint: 'Доля сотрудников, которые хотя бы раз за неделю пользовались AI-инструментом, в среднем по неделям месяца.'
    }, {
      key: 'ai_wau',
      block: 'ai',
      name: 'Активные пользователи AI (WAU)',
      short: 'WAU',
      fmt: 'int',
      better: 'flat',
      unit: 'чел',
      anchor: null,
      hint: 'Уникальные пользователи AI-инструментов за неделю, в среднем по неделям месяца.'
    }];
    if (REAL) {
      var ov = {
        regret: {
          ytd: 'regret_m',
          anchor: null,
          hint: 'Нежелательные увольнения к среднесписочной численности, накопительно с января. По HQ есть KPI.'
        },
        low_perf: {
          derived: {
            num: 'plow',
            den: 'prated',
            scale: 100
          },
          anchor: null,
          hint: 'Доля оценки «низкая» среди оценённых в последнем цикле: норма, низкая и высокая. Без оценки — не в счёт.'
        }
      };
      METRICS.forEach(function (m) {
        if (ov[m.key]) Object.assign(m, ov[m.key]);
        if (REAL.stub.has(m.key)) m.stub = true;
      });
    }
    var METRIC_BY_KEY = Object.fromEntries(METRICS.map(function (m) {
      return [m.key, m];
    }));
    var SERVICE_DEF = REAL ? {
      regret_m: {
        derived: {
          num: 'regret_cnt',
          den: 'hc_avg',
          scale: 100
        }
      }
    } : {};
    function defOf(key) {
      return METRIC_BY_KEY[key] || SERVICE_DEF[key] || {};
    }
    function isStub(key) {
      return !!(METRIC_BY_KEY[key] && METRIC_BY_KEY[key].stub);
    }
    function metricsOfBlock(k) {
      return METRICS.filter(function (m) {
        return m.block === k;
      });
    }
    var COUNT_METRICS = new Set(['hc_active', 'hc_total', 'hc_avg', 'hire', 'attrition', 'transfer_in', 'transfer_out', 'net_ytd', 'vac_open', 'vac_closed', 'tgrowth_pass', 'tgrowth_deny', 'ai_wau', 'pf_plan', 'hire_jun', 'rev_eval', 'rev_up', 'regret_cnt', 'plow', 'prated']);
    function comparable(key) {
      var m = METRIC_BY_KEY[key];
      if (!m) return false;
      if (m.cmp != null) return !!m.cmp;
      return !COUNT_METRICS.has(key);
    }
    var LOCKED_METRICS = new Set(['hc_active', 'hc_total']);
    var METRIC_PRESETS = [{
      key: 'all',
      name: 'Всё',
      keys: null
    }, {
      key: 'turnover',
      name: 'Текучесть',
      keys: ['hc_active', 'hc_total', 'attrition', 'turnover_m', 'turnover_y', 'regret', 'turnover_fc']
    }, {
      key: 'hiring',
      name: 'Найм',
      keys: ['hc_active', 'hc_total', 'hire', 'hire_rate', 'vac_open', 'vac_closed', 'time_to_fill', 'hire_plan', 'junior_share', 'internal_share']
    }, {
      key: 'min',
      name: 'Минимум',
      keys: ['hc_active', 'hc_total', 'turnover_m', 'regret']
    }];
    function hiddenSet(S) {
      var h = S && S.hiddenMetrics || [];
      return h instanceof Set ? h : new Set(h);
    }
    function sanitizeHidden(list) {
      return (list || []).filter(function (k) {
        return METRIC_BY_KEY[k] && !LOCKED_METRICS.has(k);
      });
    }
    function metricVisible(key, S) {
      if (LOCKED_METRICS.has(key)) return true;
      return !hiddenSet(S).has(key);
    }
    function visibleMetricsOfBlock(bk, S) {
      return metricsOfBlock(bk).filter(function (m) {
        return metricVisible(m.key, S);
      });
    }
    function visibleBlocks(S) {
      return BLOCKS.filter(function (b) {
        return visibleMetricsOfBlock(b.key, S).length > 0;
      });
    }
    function blockVisible(bk, S) {
      return visibleMetricsOfBlock(bk, S).length > 0;
    }
    function visibleCount(S) {
      return METRICS.filter(function (m) {
        return metricVisible(m.key, S);
      }).length;
    }
    function hiddenForPreset(pk) {
      var p = METRIC_PRESETS.find(function (x) {
        return x.key === pk;
      });
      if (!p || !p.keys) return [];
      var keep = new Set(p.keys);
      return sanitizeHidden(METRICS.filter(function (m) {
        return !keep.has(m.key);
      }).map(function (m) {
        return m.key;
      }));
    }
    function activePreset(S) {
      var cur = sanitizeHidden(_toConsumableArray(hiddenSet(S))).sort().join(',');
      var p = METRIC_PRESETS.find(function (x) {
        return hiddenForPreset(x.key).sort().join(',') === cur;
      });
      return p ? p.key : null;
    }
    var EXIT_REASONS = [{
      key: 'better_offer',
      name: 'Лучшее предложение',
      share: 0.28,
      regret: true,
      init: 'emp'
    }, {
      key: 'manager',
      name: 'Отношения с руководителем',
      share: 0.14,
      regret: true,
      init: 'emp'
    }, {
      key: 'no_growth',
      name: 'Нет роста и развития',
      share: 0.17,
      regret: true,
      init: 'emp'
    }, {
      key: 'burnout',
      name: 'Выгорание и нагрузка',
      share: 0.12,
      regret: true,
      init: 'emp'
    }, {
      key: 'performance',
      name: 'Не справился с задачами',
      share: 0.11,
      regret: false,
      init: 'org'
    }, {
      key: 'relocation',
      name: 'Релокация и личные',
      share: 0.09,
      regret: false,
      init: 'emp'
    }, {
      key: 'other',
      name: 'Прочее и не заполнено',
      share: 0.09,
      regret: false,
      init: 'oth'
    }];
    var EXIT_INITIATORS = [{
      key: 'emp',
      name: 'По инициативе сотрудника'
    }, {
      key: 'org',
      name: 'По инициативе работодателя'
    }, {
      key: 'oth',
      name: 'Другое',
      note: 'соглашение сторон, окончание договора, не заполнено'
    }];
    var PAINTS = [{
      key: 'all',
      name: 'Все покраски',
      chip: null
    }, {
      key: 'HQ',
      name: 'HQ',
      chip: 'HQ'
    }, {
      key: 'Line',
      name: 'Line',
      chip: 'Line'
    }, {
      key: 'Support',
      name: 'Support',
      chip: 'Support'
    }];
    var ITSEGS = REAL ? [{
      key: 'all',
      name: 'IT, Digital и nonIT',
      chip: null
    }, {
      key: 'IT',
      name: 'Только IT',
      chip: 'IT'
    }, {
      key: 'Digital',
      name: 'Только Digital',
      chip: 'Digital'
    }, {
      key: 'nonIT',
      name: 'Только nonIT',
      chip: 'nonIT'
    }] : [{
      key: 'all',
      name: 'IT и nonIT',
      chip: null
    }, {
      key: 'IT',
      name: 'Только IT',
      chip: 'IT'
    }, {
      key: 'nonIT',
      name: 'Только nonIT',
      chip: 'nonIT'
    }];
    var STAFFTYPES = [{
      key: 'all',
      name: 'Штат и не штат',
      chip: null
    }, {
      key: 'staff',
      name: 'Только штат',
      chip: 'штат'
    }, {
      key: 'nonstaff',
      name: 'Только не штат',
      chip: 'не штат'
    }];
    var LEVEL_NAME = REAL ? {
      1: 'Компания'
    } : {
      1: 'Компания',
      2: 'Блок',
      3: 'Департамент',
      4: 'Управление',
      5: 'Отдел',
      6: 'Команда'
    };
    var LEVEL_SHORT = REAL ? {} : {
      2: 'Блок',
      3: 'Деп.',
      4: 'Упр.',
      5: 'Отд.',
      6: 'Ком.'
    };
    var MAX_LEVEL = REAL ? 12 : 6;
    var BLOCK_DEFS = [{
      id: '01',
      name: 'Технологические платформы',
      seg: 'IT'
    }, {
      id: '02',
      name: 'Розничные продукты',
      seg: 'IT'
    }, {
      id: '03',
      name: 'Кредитный конвейер',
      seg: 'IT'
    }, {
      id: '04',
      name: 'Платежи и переводы',
      seg: 'IT'
    }, {
      id: '05',
      name: 'Данные и ML',
      seg: 'IT'
    }, {
      id: '06',
      name: 'Инфраструктура',
      seg: 'IT'
    }, {
      id: '07',
      name: 'Клиентский сервис',
      seg: 'nonIT'
    }, {
      id: '08',
      name: 'Операционный блок',
      seg: 'nonIT'
    }];
    var NAME_POOL = {
      IT: {
        3: ['Мобильная разработка', 'Веб-платформа', 'Бэкенд и интеграции', 'Архитектура решений', 'Качество и тестирование', 'Цифровые продукты'],
        4: ['Разработка iOS', 'Разработка Android', 'Фронтенд-разработка', 'Сервисы и API', 'Автоматизация тестирования', 'Платформенные сервисы', 'Интеграционная шина', 'DevOps и релизы'],
        5: ['Команда платежей', 'Команда онбординга', 'Команда личного кабинета', 'Команда уведомлений', 'Команда поиска', 'Команда каталога', 'Команда авторизации', 'Команда отчётности'],
        6: ['Группа разработки', 'Группа поддержки', 'Группа аналитики', 'Группа внедрения']
      },
      nonIT: {
        3: ['Клиентский сервис', 'Операционная поддержка', 'Качество обслуживания', 'Бизнес-процессы', 'Сопровождение клиентов', 'Административный блок'],
        4: ['Контакт-центр', 'Поддержка первой линии', 'Разбор обращений', 'Бек-офис операций', 'Контроль качества', 'Обучение и методология', 'Документооборот', 'Планирование ресурсов'],
        5: ['Голосовая поддержка', 'Текстовые каналы', 'Премиальный сегмент', 'Малый бизнес', 'Рекламации', 'Верификация', 'Сверка операций', 'Сервисный деск'],
        6: ['Группа дневной смены', 'Группа вечерней смены', 'Группа эскалаций', 'Группа контроля']
      }
    };
    var usedNames = new Set();
    function pickName(level, seg, path) {
      var pool = NAME_POOL[seg === 'nonIT' ? 'nonIT' : 'IT'][level] || NAME_POOL.IT[6];
      var r = rng('nm' + path);
      for (var i = 0; i < pool.length * 3; i++) {
        var cand = pool[Math.floor(r() * pool.length)];
        var key = path.split('/').slice(0, -1).join('/') + '|' + cand;
        if (!usedNames.has(key)) {
          usedNames.add(key);
          return cand;
        }
      }
      return pool[0];
    }
    var NODES = REAL ? REAL.nodes.slice() : [];
    var ROOT = REAL ? NODES.find(function (n) {
      return n.path === 'T';
    }) || {
      id: 'T',
      path: 'T',
      parent: null,
      level: 1,
      name: 'Вся компания',
      sort: 0,
      leaf: false
    } : {
      id: 'T',
      path: 'T',
      parent: null,
      level: 1,
      name: 'Вся компания',
      sort: 0,
      leaf: false
    };
    if (!REAL || !NODES.some(function (n) {
      return n.path === 'T';
    })) NODES.push(ROOT);
    var sortCtr = 1;
    var pad2 = function pad2(n) {
      return String(n).padStart(2, '0');
    };
    function nodeCode(path) {
      return path.split('/').slice(1).map(function (s) {
        return String(parseInt(s, 10));
      }).join('.');
    }
    function leafAttrs(path, blockSeg) {
      var rp = rng('paint' + path)();
      var paint = rp < 0.42 ? 'HQ' : rp < 0.78 ? 'Line' : 'Support';
      var it = blockSeg === 'nonIT' ? rng('it' + path)() < 0.18 ? 'IT' : 'nonIT' : rng('it' + path)() < 0.82 ? 'IT' : 'nonIT';
      var staff = rng('st' + path)() < 0.86 ? 'staff' : 'nonstaff';
      return {
        paint: paint,
        it: it,
        staff: staff
      };
    }
    function genChildren(node, blockSeg) {
      if (node.level >= MAX_LEVEL) return;
      var r = rng('br' + node.path);
      var nc = node.level === 2 ? 3 + Math.floor(r() * 2) : node.level === 3 ? 2 + Math.floor(r() * 2) : 2;
      for (var i = 0; i < nc; i++) {
        var cp = node.path + '/' + pad2(i + 1),
          cl = node.level + 1;
        var isLeaf = cl >= MAX_LEVEL ? true : cl >= 4 && rng('leaf' + cp)() < 0.35;
        var cn = {
          id: cp,
          path: cp,
          parent: node.path,
          level: cl,
          name: pickName(cl, blockSeg, cp),
          sort: sortCtr++,
          leaf: isLeaf
        };
        if (isLeaf) Object.assign(cn, leafAttrs(cp, blockSeg));
        NODES.push(cn);
        if (!isLeaf) genChildren(cn, blockSeg);
      }
    }
    if (!REAL) BLOCK_DEFS.forEach(function (b) {
      var bp = 'T/' + b.id;
      var bn = {
        id: b.id,
        path: bp,
        parent: 'T',
        level: 2,
        name: b.name,
        sort: sortCtr++,
        leaf: false,
        seg: b.seg
      };
      NODES.push(bn);
      genChildren(bn, b.seg);
    });
    var NODE_BY_PATH = Object.fromEntries(NODES.map(function (n) {
      return [n.path, n];
    }));
    function kidsOf(p) {
      var n = NODE_BY_PATH[p];
      if (n && n.below != null) return n.below;
      return rowsOf(p).length;
    }
    function childrenOf(p) {
      return NODES.filter(function (n) {
        return n.parent === p;
      }).sort(function (a, b) {
        return a.sort - b.sort;
      });
    }
    function rowsOf(p) {
      return childrenOf(p).filter(function (n) {
        return !n.hide;
      });
    }
    var DIRECT_NA = new Set(['transfer_in', 'transfer_out', 'internal_share']);
    function directNA(node, key) {
      return !!(node && node.direct && DIRECT_NA.has(key));
    }
    function descendantsOf(p) {
      return NODES.filter(function (n) {
        return n.path === p || n.path.startsWith(p + '/');
      });
    }
    function leavesUnder(p) {
      return descendantsOf(p).filter(function (n) {
        return n.leaf;
      });
    }
    function ancestorsOf(p) {
      var seg = p.split('/');
      var out = [];
      for (var i = 1; i <= seg.length; i++) {
        var q = seg.slice(0, i).join('/');
        if (NODE_BY_PATH[q]) out.push(NODE_BY_PATH[q]);
      }
      return out;
    }
    function levelLabel(l) {
      return LEVEL_NAME[l] || 'ур. ' + l;
    }
    function nodesBelow(path, depth) {
      var cur = [NODE_BY_PATH[path]];
      var _loop = function _loop() {
        var next = [];
        cur.forEach(function (n) {
          var k = childrenOf(n.path);
          next.push.apply(next, _toConsumableArray(k.length ? k : [n]));
        });
        cur = _toConsumableArray(new Map(next.map(function (n) {
          return [n.path, n];
        })).values());
      };
      for (var d = 0; d < depth; d++) {
        _loop();
      }
      return cur.sort(function (a, b) {
        return a.sort - b.sort;
      });
    }
    function leafPasses(leafPath, st) {
      var n = NODE_BY_PATH[leafPath];
      if (!n || !n.leaf) return false;
      if (REAL) return REAL.hasSeries(leafPath);
      if (st.paint !== 'all' && n.paint !== st.paint) return false;
      if (st.itSeg !== 'all' && n.it !== st.itSeg) return false;
      if (st.staffType !== 'all' && n.staff !== st.staffType) return false;
      return true;
    }
    function reportLeaves(st) {
      return leavesUnder(st.unit).map(function (l) {
        return l.path;
      }).filter(function (p) {
        return leafPasses(p, st);
      });
    }
    function benchmarkLeaves(st) {
      if (REAL) return REAL.hasSeries('BASE') ? ['BASE'] : [];
      return leavesUnder('T').map(function (l) {
        return l.path;
      }).filter(function (p) {
        return leafPasses(p, st);
      });
    }
    function unitsInScope(st) {
      if (!REAL) return reportLeaves(st).length;
      return NODES.filter(function (n) {
        return !n.outside && !n.direct && n.path.indexOf(st.unit + '/') === 0;
      }).length;
    }
    var UNIT_WORDS = REAL ? ['подразделение', 'подразделения', 'подразделений'] : ['команда', 'команды', 'команд'];
    function benchmarkLabel(st) {
      var parts = [];
      if (st.paint !== 'all') parts.push(st.paint);
      if (st.itSeg !== 'all') parts.push(st.itSeg);
      if (st.staffType !== 'all') parts.push(st.staffType === 'staff' ? 'штат' : 'не штат');
      return parts.length ? 'всё ' + parts.join(' ') : 'вся компания';
    }
    function filterChips(st) {
      var out = [];
      if (st.paint !== 'all') out.push({
        k: 'paint',
        label: st.paint
      });
      if (st.itSeg !== 'all') out.push({
        k: 'itSeg',
        label: st.itSeg
      });
      if (st.staffType !== 'all') out.push({
        k: 'staffType',
        label: st.staffType === 'staff' ? 'штат' : 'не штат'
      });
      return out;
    }
    var _sc = {};
    function leafBase(leafPath) {
      if (_sc['b' + leafPath]) return _sc['b' + leafPath];
      var r = rng('base' + leafPath);
      var v = {
        hc: 14 + Math.floor(r() * 46),
        lvl: r(),
        vol: 0.55 + r() * 1.5
      };
      if (REAL) v.hc = Math.max(0, Math.round(REAL.lastHc(leafPath)));
      _sc['b' + leafPath] = v;
      return v;
    }
    function wave(seed, i, amp) {
      return Math.sin(hashStr(seed) % 100 / 16 + i / 2.1) * amp;
    }
    var SEAS_ATTR = [0.95, 1.36, 1.28, 1.06, 0.86, 1.00, 1.14, 1.04, 1.18, 0.98, 0.86, 0.70];
    var SEAS_HIRE = [0.82, 1.12, 1.24, 1.16, 0.96, 0.90, 0.76, 0.94, 1.28, 1.20, 1.04, 0.66];
    function ratioAt(get, d, i) {
      var num = get(d.num),
        dens = [].concat(d.den).map(get);
      var from = d.win === 'ytd' ? YEAR_START_EXT[i] : i;
      var n = 0,
        dd = 0;
      var _loop2 = function _loop2(j) {
        n += num[j] || 0;
        dens.forEach(function (x) {
          dd += x[j] || 0;
        });
      };
      for (var j = from; j <= i; j++) {
        _loop2(j);
      }
      return dd ? +(n / dd * (d.scale || 1)).toFixed(d.dp || 2) : null;
    }
    function runRateAt(src, i) {
      var v = src[i];
      return v == null ? null : +(v / (MONTHS_EXT[i].m + 1) * 12).toFixed(2);
    }
    function planK(leafPath) {
      return 0.86 + rng('pk' + leafPath)() * 0.36;
    }
    function juniorP(leafPath) {
      var n = NODE_BY_PATH[leafPath] || {};
      return Math.min(0.7, Math.max(0.05, (n.it === 'nonIT' ? 0.38 : 0.20) + (rng('pj' + leafPath)() - 0.5) * 0.16));
    }
    function aiCurve(leafPath, n) {
      return {
        base: (n.it === 'nonIT' ? 0.18 : 0.34) + (rng('aib' + leafPath)() - 0.5) * 0.16,
        grow: 0.08 + rng('aig' + leafPath)() * 0.14
      };
    }
    var _rev = {};
    function reviewAt(leafPath, key, i, n) {
      var c = i;
      while (c >= 0 && MONTHS_EXT[c].m !== 5 && MONTHS_EXT[c].m !== 11) c--;
      var ck = leafPath + '|' + key + '|' + (c < 0 ? 'pre' : c);
      if (_rev[ck] != null) return _rev[ck];
      var v;
      if (key === 'rev_eval') {
        v = Math.max(1, Math.round(seriesExt(leafPath, 'hc_total')[Math.max(c, 0)] * 0.9));
      } else {
        var e = reviewAt(leafPath, 'rev_eval', i, n),
          r = rng('rvu' + ck);
        var p = 0.13 + 0.17 * r() + (n.paint === 'HQ' ? 0.02 : 0);
        v = 0;
        for (var k = 0; k < e; k++) if (r() < p) v++;
      }
      _rev[ck] = v;
      return v;
    }
    function seriesExt(leafPath, key) {
      var ck = 'x|' + leafPath + '|' + key;
      if (_sc[ck]) return _sc[ck];
      if (REAL) {
        var rs = REAL.series(leafPath, key);
        if (rs) {
          _sc[ck] = rs;
          return rs;
        }
      }
      var m = defOf(key),
        b = leafBase(leafPath),
        n = NODE_BY_PATH[leafPath] || {};
      var out = new Array(NEXT);
      if (key === 'hc_avg') {
        var t = seriesExt(leafPath, 'hc_total');
        for (var i = 0; i < NEXT; i++) out[i] = +(((i ? t[i - 1] : t[0]) + t[i]) / 2).toFixed(1);
        _sc[ck] = out;
        return out;
      }
      if (m.derived) {
        for (var _i = 0; _i < NEXT; _i++) out[_i] = ratioAt(function (k) {
          return seriesExt(leafPath, k);
        }, m.derived, _i);
        _sc[ck] = out;
        return out;
      }
      if (m.runRate) {
        var src = seriesExt(leafPath, m.runRate);
        for (var _i2 = 0; _i2 < NEXT; _i2++) out[_i2] = runRateAt(src, _i2);
        _sc[ck] = out;
        return out;
      }
      if (m.ytd) {
        var _src = seriesExt(leafPath, m.ytd);
        for (var _i3 = 0; _i3 < NEXT; _i3++) {
          var s = 0;
          for (var j = YEAR_START_EXT[_i3]; j <= _i3; j++) s += _src[j];
          out[_i3] = +s.toFixed(2);
        }
        _sc[ck] = out;
        return out;
      }
      if (m.ytdDelta) {
        var _src2 = seriesExt(leafPath, m.ytdDelta);
        for (var _i4 = 0; _i4 < NEXT; _i4++) out[_i4] = +(_src2[_i4] - _src2[ytdBase(_i4)]).toFixed(1);
        _sc[ck] = out;
        return out;
      }
      var r = rng('ser' + leafPath + key);
      var cg = function cg(rate, seas, amp, seed, i) {
        var f = Math.max(0.12, 1 + wave(seed, i, amp * b.vol) + (r() - 0.5) * amp * b.vol);
        return Math.max(0, Math.floor(b.hc * rate * seas * f + r()));
      };
      for (var _i5 = 0; _i5 < NEXT; _i5++) {
        var cm = MONTHS_EXT[_i5].m,
          vol = b.vol;
        var trend = (_i5 - (NEXT - 1) / 2) / (NEXT - 1);
        var v = void 0;
        if (key === 'hc_total') {
          v = Math.max(3, Math.round(b.hc * (1 + trend * 0.07) + wave(leafPath, _i5, 1.5 * vol) + (r() - 0.5) * 1.6 * vol));
        } else if (key === 'hc_active') {
          v = Math.max(2, Math.round(seriesExt(leafPath, 'hc_total')[_i5] * (0.88 + r() * 0.09)));
        } else if (key === 'hire') {
          v = cg(0.0135 + b.lvl * 0.0075, SEAS_HIRE[cm], 0.60, leafPath + 'h', _i5);
        } else if (key === 'attrition') {
          v = cg(0.0100 + b.lvl * 0.0090, SEAS_ATTR[cm], 0.55, leafPath + 'a', _i5);
        } else if (key === 'transfer_in') {
          v = cg(0.0060, 1, 0.70, leafPath + 'ti', _i5);
        } else if (key === 'transfer_out') {
          v = cg(0.0065, 1, 0.70, leafPath + 'to', _i5);
        } else if (key === 'vac_open') {
          v = cg(0.0420, 1, 0.45, leafPath + 'vo', _i5);
        } else if (key === 'vac_closed') {
          v = cg(0.0140, SEAS_HIRE[cm], 0.65, leafPath + 'vc', _i5);
        } else if (key === 'tgrowth_pass') {
          v = cg(0.0090, 1, 0.75, leafPath + 'tp', _i5);
        } else if (key === 'tgrowth_deny') {
          v = cg(0.0045, 1, 0.85, leafPath + 'td', _i5);
        } else if (key === 'pf_plan') {
          v = cg((0.0135 + b.lvl * 0.0075) * planK(leafPath), 0.55 + 0.45 * SEAS_HIRE[cm], 0.30, leafPath + 'pp', _i5);
        } else if (key === 'hire_jun') {
          var h = seriesExt(leafPath, 'hire')[_i5],
            pj = juniorP(leafPath);
          v = 0;
          for (var k = 0; k < h; k++) if (r() < pj) v++;
        } else if (key === 'ai_wau') {
          var ha = seriesExt(leafPath, 'hc_active')[_i5],
            ai = aiCurve(leafPath, n);
          var pAi = Math.min(0.92, Math.max(0.03, ai.base + ai.grow * (_i5 / (NEXT - 1)) + wave(leafPath + 'ai', _i5, 0.02) + (r() - 0.5) * 0.03));
          v = Math.round(ha * pAi);
        } else if (key === 'rev_eval' || key === 'rev_up') {
          v = reviewAt(leafPath, key, _i5, n);
        } else {
          var a = m.anchor || 10;
          var skew = (b.lvl - 0.5) * a * 0.55 + (n.paint === 'HQ' ? -a * 0.06 : n.paint === 'Line' ? a * 0.08 : 0) + (n.it === 'nonIT' ? a * 0.05 : 0);
          v = Math.max(0, +(a + skew + wave(leafPath + key, _i5, a * 0.17 * vol) + (r() - 0.5) * a * 0.13 * vol).toFixed(1));
        }
        out[_i5] = v;
      }
      _sc[ck] = out;
      return out;
    }
    function metricSeries(leafPath, key) {
      var ck = 's|' + leafPath + '|' + key;
      if (_sc[ck]) return _sc[ck];
      var out = seriesExt(leafPath, key).slice(PRE);
      _sc[ck] = out;
      return out;
    }
    function reasonSeries(leafPaths, reasonKey) {
      var total = aggregate(leafPaths, 'attrition');
      var rs = EXIT_REASONS.find(function (x) {
        return x.key === reasonKey;
      });
      var r = rng('rs' + reasonKey);
      return total.map(function (t, i) {
        return Math.max(0, Math.round(t * rs.share * (0.82 + r() * 0.36)));
      });
    }
    var _ac = new Map();
    function aggregateExt(leafPaths, key) {
      if (!leafPaths.length) return new Array(NEXT).fill(0);
      var ck = 'x' + key + '#' + leafPaths.length + '#' + hashStr(leafPaths.join(','));
      if (_ac.has(ck)) return _ac.get(ck);
      var m = defOf(key);
      var out = new Array(NEXT).fill(0);
      if (m.derived) {
        for (var i = 0; i < NEXT; i++) out[i] = ratioAt(function (k) {
          return aggregateExt(leafPaths, k);
        }, m.derived, i);
      } else if (m.runRate) {
        var src = aggregateExt(leafPaths, m.runRate);
        for (var _i6 = 0; _i6 < NEXT; _i6++) out[_i6] = runRateAt(src, _i6);
      } else if (m.ytd) {
        var _src3 = aggregateExt(leafPaths, m.ytd);
        for (var _i7 = 0; _i7 < NEXT; _i7++) {
          var s = 0;
          for (var j = YEAR_START_EXT[_i7]; j <= _i7; j++) s += _src3[j];
          out[_i7] = +s.toFixed(2);
        }
      } else if (m.ytdDelta) {
        var _src4 = aggregateExt(leafPaths, m.ytdDelta);
        for (var _i8 = 0; _i8 < NEXT; _i8++) out[_i8] = +(_src4[_i8] - _src4[ytdBase(_i8)]).toFixed(1);
      } else if (COUNT_METRICS.has(key)) {
        var _loop3 = function _loop3(_i9) {
          var s = 0;
          leafPaths.forEach(function (p) {
            s += seriesExt(p, key)[_i9];
          });
          out[_i9] = +s.toFixed(1);
        };
        for (var _i9 = 0; _i9 < NEXT; _i9++) {
          _loop3(_i9);
        }
      } else {
        var _loop4 = function _loop4(_i0) {
          var num = 0,
            den = 0;
          leafPaths.forEach(function (p) {
            var w = seriesExt(p, 'hc_total')[_i0];
            num += seriesExt(p, key)[_i0] * w;
            den += w;
          });
          out[_i0] = den ? +(num / den).toFixed(1) : 0;
        };
        for (var _i0 = 0; _i0 < NEXT; _i0++) {
          _loop4(_i0);
        }
      }
      _ac.set(ck, out);
      return out;
    }
    function aggregate(leafPaths, key) {
      if (!leafPaths.length) return new Array(N).fill(0);
      var ck = key + '#' + leafPaths.length + '#' + hashStr(leafPaths.join(','));
      if (_ac.has(ck)) return _ac.get(ck);
      var out = aggregateExt(leafPaths, key).slice(PRE);
      _ac.set(ck, out);
      return out;
    }
    function lastVal(leafPaths, key) {
      return aggregate(leafPaths, key)[LAST];
    }
    function deltas(series) {
      var cur = series[LAST];
      return {
        mom: +(cur - series[LAST - 1]).toFixed(1),
        yoy: +(cur - series[0]).toFixed(1)
      };
    }
    function deltasOf(leafPaths, key) {
      var e = aggregateExt(leafPaths, key),
        i = NEXT - 1;
      var d = function d(a, b) {
        return a == null || b == null ? null : +(a - b).toFixed(4);
      };
      return {
        mom: d(e[i], e[i - 1]),
        yoy: d(e[i], e[i - 12])
      };
    }
    var YEAR_CUR = CUR_M.y,
      YEAR_PREV = CUR_M.y - 1;
    var YOY_FROM = MONTHS_EXT.findIndex(function (mm) {
      return mm.y === YEAR_PREV && mm.m === 0;
    });
    var CUR_LEN = CUR_M.m + 1;
    function yoyOf(ext) {
      var prev = ext.slice(YOY_FROM, YOY_FROM + 12);
      var cur = ext.slice(YOY_FROM + 12, YOY_FROM + 12 + CUR_LEN);
      while (cur.length < 12) cur.push(null);
      return {
        prev: prev,
        cur: cur
      };
    }
    function yoySeries(leafPaths, key) {
      return yoyOf(aggregateExt(leafPaths, key));
    }
    function blockSignal(bk, st) {
      var rl = reportLeaves(st),
        bl = benchmarkLeaves(st);
      var good = 0,
        bad = 0;
      if (!rl.length) return {
        good: good,
        bad: bad,
        state: 'neutral'
      };
      visibleMetricsOfBlock(bk, st).forEach(function (m) {
        if (m.better === 'flat') return;
        var v = lastVal(rl, m.key),
          kpi = kpiFor(m.key, st);
        var s = kpi ? stateForKpi(m.key, v, kpi) : compareState(m.key, v, lastVal(bl, m.key));
        if (s === 'good') good++;else if (s === 'bad') bad++;
      });
      return {
        good: good,
        bad: bad,
        state: bad ? 'bad' : good ? 'good' : 'neutral'
      };
    }
    function compareState(key, val, base) {
      var m = METRIC_BY_KEY[key];
      if (val == null || base == null || !base) return 'neutral';
      if (isStub(key)) return 'neutral';
      if (!comparable(key)) return 'neutral';
      if (m.better === 'flat') return 'neutral';
      var rel = (val - base) / Math.abs(base);
      if (Math.abs(rel) < 0.05) return 'warn';
      var good = m.better === 'lower' ? rel < 0 : rel > 0;
      return good ? 'good' : 'bad';
    }
    function stateForKpi(key, val, kpi) {
      var m = METRIC_BY_KEY[key];
      if (!kpi || val == null) return 'neutral';
      if (isStub(key)) return 'neutral';
      if (m.better === 'lower') return val <= kpi.green ? 'good' : val >= kpi.red ? 'bad' : 'warn';
      return val >= kpi.green ? 'good' : val <= kpi.red ? 'bad' : 'warn';
    }
    function kpiFor(key, st) {
      var m = METRIC_BY_KEY[key];
      if (!m.kpi) return null;
      if (key === 'regret' && st.paint !== 'HQ') return null;
      return m.kpi;
    }
    function fmtInt(v) {
      return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009").replace('-', "\u2212");
    }
    function fmtNum(fmt, v) {
      if (v == null || !isFinite(v)) return '—';
      if (fmt === 'int') return fmtInt(v);
      if (fmt === 'days') return (+v).toFixed(0).replace('.', ',') + "\u2009\u0434\u043D";
      if (fmt === 'mon') return (+v).toFixed(1).replace('.', ',') + "\u2009\u043C\u0435\u0441";
      if (fmt === 'ratio') return (+v).toFixed(2).replace('.', ',');
      return (+v).toFixed(1).replace('.', ',') + '%';
    }
    function fmtVal(key, v) {
      if (v == null) return '—';
      var m = METRIC_BY_KEY[key];
      if (!m) return String(v);
      return fmtNum(m.fmt, v);
    }
    function fmtDelta(key, v) {
      var m = METRIC_BY_KEY[key];
      if (v == null) return '—';
      var s = v > 0 ? '+' : '';
      if (m.fmt === 'int') return s + fmtInt(v);
      if (m.fmt === 'days') return s + (+v).toFixed(0).replace('-', "\u2212") + "\u2009\u0434\u043D";
      if (m.fmt === 'mon') return s + (+v).toFixed(1).replace('.', ',').replace('-', "\u2212") + "\u2009\u043C\u0435\u0441";
      if (m.fmt === 'ratio') return s + (+v).toFixed(2).replace('.', ',').replace('-', "\u2212");
      return s + (+v).toFixed(1).replace('.', ',').replace('-', "\u2212") + "\u2009\u043F.\u043F.";
    }
    function fmtCompact(v) {
      return Math.abs(v) >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'K' : fmtInt(v);
    }
    var DEFAULT_STATE = {
      unit: REAL ? REAL.scopePath : 'T/01',
      paint: REAL ? REAL.applied.paint : 'HQ',
      itSeg: REAL ? REAL.applied.itSeg : 'all',
      staffType: REAL ? REAL.applied.staffType : 'all',
      period: PERIOD_LABEL,
      tab: 'onepager',
      subTab: null,
      selNode: null,
      aiOpen: false,
      hiddenMetrics: [],
      mixSel: [],
      mixRows: 'seniority',
      mixCols: 'gender',
      mixMode: 'abs',
      dyn: 'roll'
    };
    var MIX_GROUP_COLOR = {
      qual: '#5f86c2',
      people: '#8b8fc0',
      contract: '#cdbf97',
      geo: '#bf9373',
      stream: '#5f9d8a'
    };
    var MIX_COLOR_DEF = '#5f86c2';
    function dimColor(dimKey) {
      var d = MIX_BY_KEY[dimKey];
      return d && MIX_GROUP_COLOR[d.group] || MIX_COLOR_DEF;
    }
    var GRADE_BY_SEN = [[0.55, 0.40, 0.05, 0.00, 0.00], [0.05, 0.45, 0.42, 0.08, 0.00], [0.00, 0.06, 0.44, 0.42, 0.08], [0.00, 0.00, 0.10, 0.45, 0.45]];
    var MIX_DIMS = [{
      key: 'grade',
      name: 'Грейд',
      short: 'Грейд',
      ord: true,
      group: 'qual',
      hint: 'Числовой уровень должности. Не то же самое, что сеньорность: она про уровень специалиста, грейд — про позицию в системе грейдов.',
      cats: [{
        key: 'g1',
        name: 'Грейд 1'
      }, {
        key: 'g2',
        name: 'Грейд 2'
      }, {
        key: 'g3',
        name: 'Грейд 3'
      }, {
        key: 'g4',
        name: 'Грейд 4'
      }, {
        key: 'g5',
        name: 'Грейд 5'
      }]
    }, {
      key: 'seniority',
      name: 'Сеньорность',
      short: 'Сеньорность',
      ord: true,
      group: 'qual',
      hint: 'Текстовый уровень специалиста. С грейдом связан, но не равен ему.',
      cats: [{
        key: 'j',
        name: 'Junior',
        w: 1.00
      }, {
        key: 'm',
        name: 'Middle',
        w: 1.70
      }, {
        key: 's',
        name: 'Senior',
        w: 1.25
      }, {
        key: 'l',
        name: 'Lead и выше',
        w: 0.42
      }]
    }, {
      key: 'gender',
      name: 'Пол',
      short: 'Пол',
      group: 'people',
      hint: 'Разрез нужен вместе с другими: сам по себе он ни о чём не говорит, а «пол × грейд» показывает, ровно ли распределены уровни.',
      cats: [{
        key: 'f',
        name: 'Женщины',
        wIT: 0.85,
        wNon: 1.75
      }, {
        key: 'm',
        name: 'Мужчины',
        wIT: 1.90,
        wNon: 0.95
      }]
    }, {
      key: 'age',
      name: 'Возрастная группа',
      short: 'Возраст',
      ord: true,
      group: 'people',
      cats: [{
        key: 'a0',
        name: 'До 25 лет',
        w: 0.50
      }, {
        key: 'a25',
        name: '25–34 года',
        w: 1.90
      }, {
        key: 'a35',
        name: '35–44 года',
        w: 1.15
      }, {
        key: 'a45',
        name: '45 лет и старше',
        w: 0.40
      }]
    }, {
      key: 'tenure',
      name: 'Стаж в компании',
      short: 'Стаж',
      ord: true,
      group: 'people',
      cats: [{
        key: 't0',
        name: 'До 1 года',
        w: 1.00
      }, {
        key: 't1',
        name: '1–3 года',
        w: 1.35
      }, {
        key: 't3',
        name: 'Больше 3 лет',
        w: 0.90
      }]
    }, {
      key: 'employment',
      name: 'Тип занятости',
      short: 'Занятость',
      group: 'contract',
      hint: 'Форма оформления. Штат — трудовой договор; всё остальное — не штат, и фильтр «штат / не штат» в шапке режет ровно по этой границе.',
      cats: [{
        key: 'tk',
        name: 'Штат (ТК РФ)'
      }, {
        key: 'gph',
        name: 'ГПХ',
        w: 1.15
      }, {
        key: 'ip',
        name: 'ИП',
        w: 0.95
      }, {
        key: 'sz',
        name: 'Самозанятый',
        w: 0.80
      }, {
        key: 'out',
        name: 'Аутстафф',
        w: 0.55
      }]
    }, {
      key: 'worksite',
      name: 'Формат работы',
      short: 'Формат',
      group: 'geo',
      cats: [{
        key: 'off',
        name: 'Офис',
        w: 1.10
      }, {
        key: 'hyb',
        name: 'Гибрид',
        w: 1.60
      }, {
        key: 'rem',
        name: 'Дистанционно',
        w: 0.80
      }]
    }, {
      key: 'legal',
      name: 'Юрлицо',
      short: 'Юрлицо',
      group: 'contract',
      hint: 'Юрлицо у подразделения одно: доля не размазывается между несколькими.',
      cats: [{
        key: 'l1',
        name: 'Основное юрлицо',
        w: 0.50
      }, {
        key: 'l2',
        name: 'Технологии',
        w: 0.24
      }, {
        key: 'l3',
        name: 'Сервис',
        w: 0.16
      }, {
        key: 'l4',
        name: 'Регионы',
        w: 0.10
      }]
    }, {
      key: 'region',
      name: 'Регион',
      short: 'Регион',
      group: 'geo',
      sort: true,
      hint: 'Где работает сотрудник. Распределённая команда — обычное дело, поэтому регион — атрибут человека, а не подразделения.',
      cats: [{
        key: 'msk',
        name: 'Москва и область',
        wIT: 1.55,
        wNon: 0.95
      }, {
        key: 'spb',
        name: 'Санкт-Петербург',
        wIT: 0.55,
        wNon: 0.35
      }, {
        key: 'vlg',
        name: 'Поволжье',
        wIT: 0.30,
        wNon: 0.55
      }, {
        key: 'url',
        name: 'Урал',
        wIT: 0.22,
        wNon: 0.42
      }, {
        key: 'sib',
        name: 'Сибирь',
        wIT: 0.16,
        wNon: 0.30
      }, {
        key: 'sth',
        name: 'Юг',
        wIT: 0.10,
        wNon: 0.26
      }, {
        key: 'oth',
        name: 'Другие регионы',
        wIT: 0.12,
        wNon: 0.20
      }]
    }, {
      key: 'stream',
      name: 'Стрим и специализация',
      short: 'Стрим',
      group: 'stream',
      sort: true,
      childDim: 'spec',
      hint: 'Чем люди занимаются. Разрез двухуровневый: каретка раскрывает стрим до специализаций внутри него.',
      cats: [{
        key: 'dev',
        name: 'Разработка',
        kids: ['be', 'fe', 'mob', 'core']
      }, {
        key: 'qa',
        name: 'Тестирование',
        kids: ['qaa', 'qam']
      }, {
        key: 'ana',
        name: 'Аналитика',
        kids: ['sa', 'ba']
      }, {
        key: 'ops',
        name: 'DevOps и инфраструктура',
        kids: ['dop', 'sre', 'net']
      }, {
        key: 'ml',
        name: 'Данные и ML',
        kids: ['de', 'mlm', 'bi']
      }, {
        key: 'des',
        name: 'Дизайн',
        kids: ['ux', 'res']
      }, {
        key: 'prod',
        name: 'Продукт и проекты',
        kids: ['pm', 'pjm']
      }, {
        key: 'sup',
        name: 'Поддержка клиентов',
        kids: ['l1', 'l2', 'vip']
      }, {
        key: 'back',
        name: 'Операции и бэк-офис',
        kids: ['ver', 'rec', 'doc']
      }, {
        key: 'adm',
        name: 'Управление и администрирование',
        kids: ['lead', 'adf']
      }]
    }, {
      key: 'spec',
      name: 'Специализация',
      short: 'Специализация',
      group: 'stream',
      sort: true,
      parentDim: 'stream',
      hint: 'Нижний уровень стрима. Отдельным разрезом нужен в конструкторе: в матрице специализация — такая же ось, как остальные.',
      cats: [{
        key: 'be',
        name: 'Бэкенд',
        parent: 'dev',
        wIT: 1.20,
        wNon: 0.02
      }, {
        key: 'fe',
        name: 'Фронтенд',
        parent: 'dev',
        wIT: 0.85,
        wNon: 0.02
      }, {
        key: 'mob',
        name: 'Мобильная разработка',
        parent: 'dev',
        wIT: 0.75,
        wNon: 0.005
      }, {
        key: 'core',
        name: 'Платформа и ядро',
        parent: 'dev',
        wIT: 0.40,
        wNon: 0.005
      }, {
        key: 'qaa',
        name: 'Автоматизация тестирования',
        parent: 'qa',
        wIT: 0.65,
        wNon: 0.02
      }, {
        key: 'qam',
        name: 'Ручное тестирование',
        parent: 'qa',
        wIT: 0.45,
        wNon: 0.03
      }, {
        key: 'sa',
        name: 'Системный анализ',
        parent: 'ana',
        wIT: 0.50,
        wNon: 0.20
      }, {
        key: 'ba',
        name: 'Бизнес-анализ',
        parent: 'ana',
        wIT: 0.40,
        wNon: 0.30
      }, {
        key: 'dop',
        name: 'DevOps и релизы',
        parent: 'ops',
        wIT: 0.28,
        wNon: 0.02
      }, {
        key: 'sre',
        name: 'SRE и надёжность',
        parent: 'ops',
        wIT: 0.18,
        wNon: 0.01
      }, {
        key: 'net',
        name: 'Сети и оборудование',
        parent: 'ops',
        wIT: 0.14,
        wNon: 0.02
      }, {
        key: 'de',
        name: 'Дата-инженерия',
        parent: 'ml',
        wIT: 0.22,
        wNon: 0.04
      }, {
        key: 'mlm',
        name: 'ML и моделирование',
        parent: 'ml',
        wIT: 0.18,
        wNon: 0.02
      }, {
        key: 'bi',
        name: 'BI и отчётность',
        parent: 'ml',
        wIT: 0.15,
        wNon: 0.04
      }, {
        key: 'ux',
        name: 'Продуктовый дизайн',
        parent: 'des',
        wIT: 0.25,
        wNon: 0.07
      }, {
        key: 'res',
        name: 'Исследования',
        parent: 'des',
        wIT: 0.10,
        wNon: 0.03
      }, {
        key: 'pm',
        name: 'Продакт-менеджмент',
        parent: 'prod',
        wIT: 0.35,
        wNon: 0.15
      }, {
        key: 'pjm',
        name: 'Проектное управление',
        parent: 'prod',
        wIT: 0.25,
        wNon: 0.20
      }, {
        key: 'l1',
        name: 'Первая линия',
        parent: 'sup',
        wIT: 0.05,
        wNon: 1.40
      }, {
        key: 'l2',
        name: 'Вторая линия',
        parent: 'sup',
        wIT: 0.03,
        wNon: 0.80
      }, {
        key: 'vip',
        name: 'Премиальный сегмент',
        parent: 'sup',
        wIT: 0.02,
        wNon: 0.40
      }, {
        key: 'ver',
        name: 'Верификация',
        parent: 'back',
        wIT: 0.04,
        wNon: 0.70
      }, {
        key: 'rec',
        name: 'Сверка операций',
        parent: 'back',
        wIT: 0.03,
        wNon: 0.65
      }, {
        key: 'doc',
        name: 'Документооборот',
        parent: 'back',
        wIT: 0.03,
        wNon: 0.55
      }, {
        key: 'lead',
        name: 'Руководители',
        parent: 'adm',
        wIT: 0.18,
        wNon: 0.30
      }, {
        key: 'adf',
        name: 'Административные функции',
        parent: 'adm',
        wIT: 0.12,
        wNon: 0.30
      }]
    }];
    var MIX_BY_KEY = Object.fromEntries(MIX_DIMS.map(function (d) {
      return [d.key, d];
    }));
    MIX_DIMS.forEach(function (d) {
      d.color = MIX_GROUP_COLOR[d.group] || MIX_COLOR_DEF;
      d.cats.forEach(function (c) {
        c.dim = d.key;
        c.id = d.key + ':' + c.key;
      });
    });
    var MIX_GROUPS = [{
      key: 'qual',
      name: 'Квалификация',
      dims: ['grade', 'seniority'],
      title: 'Квалификация: грейд и сеньорность'
    }, {
      key: 'people',
      name: 'Люди',
      dims: ['gender', 'age', 'tenure'],
      title: 'Кто эти люди: пол, возраст, стаж'
    }, {
      key: 'contract',
      name: 'Оформление',
      dims: ['employment', 'legal'],
      title: 'Как оформлены: тип занятости и юрлицо'
    }, {
      key: 'geo',
      name: 'География',
      dims: ['region', 'worksite'],
      title: 'Где работают: регион и формат работы'
    }, {
      key: 'stream',
      name: 'Стримы',
      dims: ['stream'],
      title: 'Стримы и специализации'
    }];
    var _mixW = new Map();
    function mixWeights(leafPath, dimKey) {
      var ck = leafPath + '|' + dimKey;
      if (_mixW.has(ck)) return _mixW.get(ck);
      var dim = MIX_BY_KEY[dimKey],
        n = NODE_BY_PATH[leafPath] || {};
      var r = rng('mixw' + dimKey + leafPath);
      var w;
      if (dim.childDim) {
        var kid = MIX_BY_KEY[dim.childDim],
          kw = mixWeights(leafPath, dim.childDim);
        var at = {};
        kid.cats.forEach(function (c, i) {
          at[c.key] = i;
        });
        w = dim.cats.map(function (c) {
          return c.kids.reduce(function (a, k) {
            return a + (kw[at[k]] || 0);
          }, 0);
        });
      } else if (dimKey === 'grade') {
        var sw = mixWeights(leafPath, 'seniority');
        w = dim.cats.map(function (c, j) {
          return sw.reduce(function (a, s, i) {
            return a + s * GRADE_BY_SEN[i][j];
          }, 0);
        });
      } else if (dimKey === 'employment') {
        w = dim.cats.map(function (c, i) {
          return n.staff === 'staff' ? i === 0 ? 1 : 0 : i === 0 ? 0 : Math.max(0.02, (c.w || 1) * (0.6 + r() * 0.8));
        });
      } else if (dimKey === 'legal') {
        var acc = [];
        var _s = 0;
        dim.cats.forEach(function (c) {
          _s += c.w || 1;
          acc.push(_s);
        });
        var x = r() * _s,
          hit = acc.findIndex(function (a) {
            return x <= a;
          });
        w = dim.cats.map(function (c, i) {
          return i === (hit < 0 ? 0 : hit) ? 1 : 0;
        });
      } else {
        w = dim.cats.map(function (c) {
          var base = n.it === 'nonIT' ? c.wNon != null ? c.wNon : c.w != null ? c.w : 1 : c.wIT != null ? c.wIT : c.w != null ? c.w : 1;
          return Math.max(0.02, base * (0.6 + r() * 0.8));
        });
      }
      var s = w.reduce(function (a, b) {
        return a + b;
      }, 0) || 1;
      var out = w.map(function (x) {
        return x / s;
      });
      _mixW.set(ck, out);
      return out;
    }
    var SEN_GENDER_TILT = [0.30, 0.05, -0.18, -0.40];
    var AGE_TENURE_TILT = [0.45, 0.10, -0.22, -0.40];
    var MIX_LINKS = [{
      a: 'seniority',
      b: 'grade',
      exact: GRADE_BY_SEN,
      label: 'сеньорность и грейд (Junior не сидит на пятом грейде)'
    }, {
      a: 'seniority',
      b: 'gender',
      tilt: SEN_GENDER_TILT,
      label: 'сеньорность и пол (доля женщин падает с уровнем)'
    }, {
      a: 'age',
      b: 'tenure',
      tilt: AGE_TENURE_TILT,
      label: 'возраст и стаж (кто старше, тот дольше в компании)'
    }];
    var MIX_LINK_TEXT = MIX_LINKS.map(function (l) {
      return l.label;
    }).join('; ');
    function ipfJoint(wr, wc, bias) {
      var m = wr.map(function (a, i) {
        return wc.map(function (b, j) {
          return Math.max(1e-9, a * b * bias[i][j]);
        });
      });
      var _loop5 = function _loop5() {
        m = m.map(function (row, i) {
          var sr = row.reduce(function (x, y) {
            return x + y;
          }, 0) || 1;
          return row.map(function (v) {
            return v * wr[i] / sr;
          });
        });
        var cs = wc.map(function (_, j) {
          return m.reduce(function (x, r) {
            return x + r[j];
          }, 0) || 1;
        });
        m = m.map(function (row) {
          return row.map(function (v, j) {
            return v * wc[j] / cs[j];
          });
        });
      };
      for (var t = 0; t < 12; t++) {
        _loop5();
      }
      return m;
    }
    function tiltBias(tilt, nc) {
      return tilt.map(function (t) {
        return Array.from({
          length: nc
        }, function (_, j) {
          return Math.exp(t * (nc < 2 ? 0 : 1 - 2 * j / (nc - 1)));
        });
      });
    }
    function linkOf(a, b) {
      return MIX_LINKS.find(function (l) {
        return l.a === a && l.b === b || l.a === b && l.b === a;
      }) || null;
    }
    function joined(a, b) {
      return !!(linkOf(a, b) || nestOf(a, b));
    }
    function nestOf(a, b) {
      var A = MIX_BY_KEY[a],
        B = MIX_BY_KEY[b];
      if (A && A.childDim === b) return {
        top: a,
        kid: b,
        flip: false
      };
      if (B && B.childDim === a) return {
        top: b,
        kid: a,
        flip: true
      };
      return null;
    }
    function mixJoint(leafPath, rowKey, colKey) {
      var wr = mixWeights(leafPath, rowKey),
        wc = mixWeights(leafPath, colKey);
      var nest = nestOf(rowKey, colKey);
      if (nest) {
        var kid = MIX_BY_KEY[nest.kid],
          kw = mixWeights(leafPath, nest.kid);
        var topCats = MIX_BY_KEY[nest.top].cats;
        var m = topCats.map(function (tc) {
          return kid.cats.map(function (kc, j) {
            return kc.parent === tc.key ? kw[j] : 0;
          });
        });
        return nest.flip ? kid.cats.map(function (_, j) {
          return topCats.map(function (__, i) {
            return m[i][j];
          });
        }) : m;
      }
      var link = linkOf(rowKey, colKey);
      if (!link) return wr.map(function (a) {
        return wc.map(function (b) {
          return a * b;
        });
      });
      var flip = link.a === colKey;
      if (link.exact) {
        return flip ? wr.map(function (_, i) {
          return wc.map(function (s, j) {
            return s * link.exact[j][i];
          });
        }) : wr.map(function (s, i) {
          return link.exact[i].map(function (g) {
            return s * g;
          });
        });
      }
      var bias = tiltBias(link.tilt, flip ? wr.length : wc.length);
      return flip ? ipfJoint(wr, wc, wr.map(function (_, i) {
        return wc.map(function (__, j) {
          return bias[j][i];
        });
      })) : ipfJoint(wr, wc, bias);
    }
    function roundParts(vals, total) {
      var fl = vals.map(function (v) {
        return Math.floor(v);
      });
      var rest = Math.max(0, Math.round(total) - fl.reduce(function (a, b) {
        return a + b;
      }, 0));
      var idx = vals.map(function (v, i) {
        return i;
      }).sort(function (a, b) {
        return vals[b] - fl[b] - (vals[a] - fl[a]);
      });
      for (var k = 0; k < rest && idx.length; k++) fl[idx[k % idx.length]]++;
      return fl;
    }
    function otherParts(sel, skip) {
      return sliceParse(sel).filter(function (p) {
        return skip.indexOf(p.dim.key) < 0;
      });
    }
    function shareBesides(leafPath, parts) {
      if (!parts.length) return 1;
      return sliceShare(leafPath, parts);
    }
    function partsWeight(leafPath, dimKey, parts) {
      var dim = MIX_BY_KEY[dimKey];
      if (!parts.length) return mixWeights(leafPath, dimKey);
      var k = parts.findIndex(function (p) {
        return joined(dimKey, p.dim.key);
      });
      if (k < 0) k = 0;
      var j = mixJoint(leafPath, dimKey, parts[k].dim.key);
      var rest = sliceShare(leafPath, parts.filter(function (_, i) {
        return i !== k;
      }));
      return dim.cats.map(function (_, i) {
        return j[i][parts[k].idx] * rest;
      });
    }
    function mixParts(lp, dimKey, sel, skip) {
      var dim = MIX_BY_KEY[dimKey];
      if (!dim) return [];
      if (dim.parentDim) {
        var at = {},
          out = dim.cats.map(function () {
            return 0;
          });
        dim.cats.forEach(function (c, i) {
          at[c.key] = i;
        });
        mixTree(lp, dim.parentDim, sel, skip).forEach(function (n) {
          return n.kids.forEach(function (k) {
            out[at[k.cat.key]] = k.value;
          });
        });
        return out;
      }
      var raw = mixRaw(lp, dimKey, sel, skip || [dimKey]);
      return roundParts(raw, raw.reduce(function (a, b) {
        return a + b;
      }, 0));
    }
    function mixCats(dimKey) {
      return (MIX_BY_KEY[dimKey] || {
        cats: []
      }).cats;
    }
    function mixRaw(lp, dimKey, sel, skip) {
      var dim = MIX_BY_KEY[dimKey];
      var parts = otherParts(sel, skip || [dimKey]);
      var raw = dim.cats.map(function () {
        return 0;
      });
      lp.forEach(function (p) {
        var hc = lastVal([p], 'hc_total'),
          w = partsWeight(p, dimKey, parts);
        dim.cats.forEach(function (c, i) {
          raw[i] += hc * w[i];
        });
      });
      return raw;
    }
    function mixTree(lp, dimKey, sel, skipExtra) {
      var dim = MIX_BY_KEY[dimKey],
        kid = MIX_BY_KEY[dim.childDim];
      var skip = [dimKey, dim.childDim].concat(skipExtra || []);
      var rawTop = mixRaw(lp, dimKey, sel, skip),
        rawKid = mixRaw(lp, dim.childDim, sel, skip);
      var at = {};
      kid.cats.forEach(function (c, i) {
        at[c.key] = i;
      });
      var top = roundParts(rawTop, rawTop.reduce(function (a, b) {
        return a + b;
      }, 0));
      return dim.cats.map(function (c, i) {
        var idx = c.kids.map(function (k) {
          return at[k];
        });
        var vals = roundParts(idx.map(function (j) {
          return rawKid[j];
        }), top[i]);
        return {
          cat: c,
          value: top[i],
          kids: idx.map(function (j, n) {
            return {
              cat: kid.cats[j],
              value: vals[n]
            };
          })
        };
      });
    }
    function roundMatrix(raw, rowTot, colTot) {
      var out = raw.map(function (r) {
        return r.map(function (v) {
          return Math.floor(v);
        });
      });
      var needR = rowTot.map(function (t, i) {
        return t - out[i].reduce(function (a, b) {
          return a + b;
        }, 0);
      });
      var needC = colTot.map(function (t, j) {
        return t - out.reduce(function (a, r) {
          return a + r[j];
        }, 0);
      });
      var cells = [];
      raw.forEach(function (r, i) {
        return r.forEach(function (v, j) {
          if (v > 1e-9) cells.push({
            i: i,
            j: j,
            f: v - out[i][j]
          });
        });
      });
      cells.sort(function (a, b) {
        return b.f - a.f;
      });
      var moved = 1;
      while (moved) {
        moved = 0;
        cells.forEach(function (c) {
          if (needR[c.i] > 0 && needC[c.j] > 0) {
            out[c.i][c.j]++;
            needR[c.i]--;
            needC[c.j]--;
            moved++;
          }
        });
      }
      var R = out.length,
        C = out[0].length;
      for (var guard = 0; guard < 4096; guard++) {
        var i = -1,
          j = -1;
        for (var a = 0; a < R && i < 0; a++) {
          if (needR[a] <= 0) continue;
          for (var b = 0; b < C; b++) if (needC[b] > 0 && raw[a][b] > 1e-9) {
            i = a;
            j = b;
            break;
          }
        }
        if (i >= 0) {
          out[i][j]++;
          needR[i]--;
          needC[j]--;
          continue;
        }
        i = needR.findIndex(function (v) {
          return v > 0;
        });
        j = needC.findIndex(function (v) {
          return v > 0;
        });
        if (i < 0 || j < 0) break;
        var done = false;
        for (var k = 0; k < C && !done; k++) {
          if (raw[i][k] <= 1e-9) continue;
          for (var r = 0; r < R && !done; r++) {
            if (r === i || out[r][k] <= 0 || raw[r][j] <= 1e-9) continue;
            out[i][k]++;
            out[r][k]--;
            out[r][j]++;
            needR[i]--;
            needC[j]--;
            done = true;
          }
        }
        if (!done) {
          out[i][j]++;
          needR[i]--;
          needC[j]--;
        }
      }
      return out;
    }
    function mixMatrix(lp, rowKey, colKey, sel) {
      var R = MIX_BY_KEY[rowKey],
        C = MIX_BY_KEY[colKey];
      if (!R || !C) return [];
      var parts = otherParts(sel, [rowKey, colKey]);
      var raw = R.cats.map(function () {
        return C.cats.map(function () {
          return 0;
        });
      });
      var sum = 0;
      lp.forEach(function (p) {
        var hc = lastVal([p], 'hc_total') * shareBesides(p, parts),
          j = mixJoint(p, rowKey, colKey);
        sum += hc;
        R.cats.forEach(function (_, i) {
          return C.cats.forEach(function (__, k) {
            raw[i][k] += hc * j[i][k];
          });
        });
      });
      var axes = [rowKey, colKey];
      return roundMatrix(raw, mixParts(lp, rowKey, sel, axes), mixParts(lp, colKey, sel, axes));
    }
    var SLICE_MAX = MIX_DIMS.length;
    var SLICE_KEYS = new Set(['hc_total', 'hc_active']);
    function sliceable(key) {
      return SLICE_KEYS.has(key);
    }
    function sliceParse(sel) {
      return (sel || []).map(function (id) {
        var _String$split = String(id).split(':'),
          _String$split2 = _slicedToArray(_String$split, 2),
          dk = _String$split2[0],
          ck = _String$split2[1],
          dim = MIX_BY_KEY[dk];
        if (!dim) return null;
        var i = dim.cats.findIndex(function (c) {
          return c.key === ck;
        });
        return i < 0 ? null : {
          id: dim.key + ':' + ck,
          dim: dim,
          idx: i,
          cat: dim.cats[i]
        };
      }).filter(Boolean).slice(0, SLICE_MAX);
    }
    function sliceLabel(sel) {
      return sliceParse(sel).map(function (p) {
        return p.cat.name;
      }).join(' · ');
    }
    function sliceShare(leafPath, parts) {
      if (!parts.length) return 1;
      if (parts.length === 1) return mixWeights(leafPath, parts[0].dim.key)[parts[0].idx];
      var used = [];
      var v = 1;
      for (var i = 0; i < parts.length; i++) {
        if (used.indexOf(i) >= 0) continue;
        var pair = -1;
        for (var j = i + 1; j < parts.length; j++) {
          if (used.indexOf(j) < 0 && joined(parts[i].dim.key, parts[j].dim.key)) {
            pair = j;
            break;
          }
        }
        if (pair < 0) continue;
        v *= mixJoint(leafPath, parts[i].dim.key, parts[pair].dim.key)[parts[i].idx][parts[pair].idx];
        used.push(i, pair);
      }
      parts.forEach(function (p, i) {
        if (used.indexOf(i) < 0) v *= mixWeights(leafPath, p.dim.key)[p.idx];
      });
      if (!used.length && parts.length === 2) return v;
      return v;
    }
    function aggregateSlice(lp, key, sel) {
      var parts = sliceParse(sel);
      if (!parts.length || !sliceable(key) || !lp.length) return aggregate(lp, key);
      var ck = 'sl|' + key + '|' + parts.map(function (p) {
        return p.id;
      }).join(',') + '#' + lp.length + '#' + hashStr(lp.join(','));
      if (_ac.has(ck)) return _ac.get(ck);
      var out = new Array(N).fill(0);
      var _loop6 = function _loop6(i) {
        var s = 0;
        lp.forEach(function (p) {
          s += metricSeries(p, key)[i] * sliceShare(p, parts);
        });
        out[i] = +s.toFixed(4);
      };
      for (var i = 0; i < N; i++) {
        _loop6(i);
      }
      _ac.set(ck, out);
      return out;
    }
    function lastValSlice(lp, key, sel) {
      return aggregateSlice(lp, key, sel)[LAST];
    }
    function sliceDeltaMoM(lp, key, sel) {
      var s = aggregateSlice(lp, key, sel);
      return +(s[LAST] - s[LAST - 1]).toFixed(1);
    }
    var OFFICES = [{
      key: 'msk-vs',
      name: 'Водный стадион',
      city: 'Москва'
    }, {
      key: 'msk-gv',
      name: 'Грузинский вал',
      city: 'Москва'
    }, {
      key: 'spb-nv',
      name: 'Невский',
      city: 'Санкт-Петербург'
    }, {
      key: 'ekb-rd',
      name: 'Радищева',
      city: 'Екатеринбург'
    }, {
      key: 'kzn-pf',
      name: 'Профсоюзная',
      city: 'Казань'
    }, {
      key: 'nng-rd',
      name: 'Родионова',
      city: 'Нижний Новгород'
    }];
    var DOW_NAME = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    var DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    var CAL_MONTH = LAST;
    var DOW_MONTHS = 3;
    function lpSeed(lp, salt) {
      return 'off' + salt + '#' + lp.length + '#' + hashStr(lp.join(','));
    }
    function attDays(lp, mIdx) {
      mIdx = mIdx == null ? CAL_MONTH : mIdx;
      var mm = MONTHS[mIdx],
        base = lp.length ? aggregate(lp, 'office_att')[mIdx] : 0;
      var nd = new Date(mm.y, mm.m + 1, 0).getDate();
      var r = rng(lpSeed(lp, 'day' + mIdx));
      var SHAPE = [0.96, 1.09, 1.12, 1.03, 0.80];
      var days = [];
      for (var d = 1; d <= nd; d++) {
        var dow = (new Date(mm.y, mm.m, d).getDay() + 6) % 7,
          we = dow >= 5;
        days.push({
          day: d,
          dow: dow,
          weekend: we,
          k: we ? 0.05 + r() * 0.09 : SHAPE[dow] * (0.9 + r() * 0.2)
        });
      }
      var wd = days.filter(function (x) {
          return !x.weekend;
        }),
        mean = wd.reduce(function (a, x) {
          return a + x.k;
        }, 0) / (wd.length || 1);
      days.forEach(function (x) {
        x.val = +(x.weekend ? base * x.k : base * x.k / mean).toFixed(1);
        delete x.k;
      });
      return {
        y: mm.y,
        m: mm.m,
        label: mm.label,
        base: base,
        first: (new Date(mm.y, mm.m, 1).getDay() + 6) % 7,
        days: days
      };
    }
    var CAL_MONTHS = 2;
    var CAL_TODAY = 15;
    function attLast(lp, months) {
      months = months || CAL_MONTHS;
      var out = [];
      var _loop7 = function _loop7() {
        var blk = attDays(lp, i);
        var to = i === LAST ? Math.min(CAL_TODAY, blk.days.length) : blk.days.length;
        out.push({
          y: blk.y,
          m: blk.m,
          label: blk.label,
          base: blk.base,
          from: 1,
          to: to,
          full: to === blk.days.length,
          first: blk.first,
          days: blk.days.filter(function (d) {
            return d.day <= to;
          })
        });
      };
      for (var i = Math.max(0, LAST - months + 1); i <= LAST; i++) {
        _loop7();
      }
      return out;
    }
    function attByDow(lp, months) {
      months = months || DOW_MONTHS;
      var acc = DOW_NAME.map(function () {
        return {
          s: 0,
          n: 0
        };
      });
      for (var i = Math.max(0, LAST - months + 1); i <= LAST; i++) {
        attDays(lp, i).days.forEach(function (d) {
          acc[d.dow].s += d.val;
          acc[d.dow].n++;
        });
      }
      return acc.map(function (a, i) {
        return {
          name: DOW_NAME[i],
          value: a.n ? +(a.s / a.n).toFixed(1) : 0,
          weekend: i >= 5
        };
      });
    }
    function officeRank(lp) {
      var r = rng(lpSeed(lp, 'rank'));
      var hc = lastVal(lp, 'hc_total'),
        base = lastVal(lp, 'office_att');
      var w = OFFICES.map(function () {
          return 0.4 + r() * 1.6;
        }),
        sw = w.reduce(function (a, x) {
          return a + x;
        }, 0);
      var left = hc;
      var rows = OFFICES.map(function (o, i) {
        var last = i === OFFICES.length - 1;
        var people = last ? Math.max(0, left) : Math.min(left, Math.round(hc * (w[i] / sw)));
        left -= people;
        return {
          key: o.key,
          name: o.name,
          city: o.city,
          hc: people,
          att: +Math.max(12, Math.min(96, base * (0.72 + r() * 0.6))).toFixed(1)
        };
      });
      return rows.filter(function (x) {
        return x.hc > 0;
      }).sort(function (a, b) {
        return b.att - a.att;
      });
    }
    function netGrowth(lp) {
      var hc = aggregate(lp, 'hc_total');
      return hc[LAST] - hc[0];
    }
    var YTD_FROM = MONTHS.findIndex(function (mm) {
      return mm.y === CUR_M.y && mm.m === 0;
    });
    var YTD_RANGE = MONTH_NOM[0] + ' — ' + monthNom(CUR_M);
    function winFrom(win) {
      return win === 'ytd' ? Math.max(0, YTD_FROM) : 0;
    }
    function sumWin(ser, win) {
      var s = 0;
      for (var i = winFrom(win); i <= LAST; i++) s += ser[i] || 0;
      return s;
    }
    function splitBy(total, weights) {
      var sw = weights.reduce(function (a, b) {
        return a + b;
      }, 0) || 1;
      return roundParts(weights.map(function (w) {
        return w / sw * total;
      }), total);
    }
    function jitter(r, w, amp) {
      return w.map(function (x) {
        return x * (1 - amp + r() * amp * 2);
      });
    }
    function jointRound(rowTot, colTot, bias) {
      var T = rowTot.reduce(function (a, b) {
        return a + b;
      }, 0);
      if (!T) return rowTot.map(function () {
        return colTot.map(function () {
          return 0;
        });
      });
      var j = ipfJoint(rowTot.map(function (v) {
        return v / T;
      }), colTot.map(function (v) {
        return v / T;
      }), bias);
      return roundMatrix(j.map(function (row) {
        return row.map(function (v) {
          return v * T;
        });
      }), rowTot, colTot);
    }
    function hcIT(lp) {
      var it = 0,
        all = 0;
      lp.forEach(function (p) {
        var h = lastVal([p], 'hc_total');
        all += h;
        if ((NODE_BY_PATH[p] || {}).it !== 'nonIT') it += h;
      });
      return all ? it / all : 1;
    }
    function exitReasons(lp, win) {
      win = win || 'ytd';
      var total = sumWin(aggregate(lp, 'attrition'), win),
        r = rng(lpSeed(lp, 'rsn' + win));
      var parts = splitBy(total, jitter(r, EXIT_REASONS.map(function (x) {
        return x.share;
      }), 0.25));
      return EXIT_REASONS.map(function (x, i) {
        return {
          key: x.key,
          name: x.name,
          regret: x.regret,
          init: x.init,
          value: parts[i]
        };
      });
    }
    function exitInitiators(lp, win) {
      var rs = exitReasons(lp, win);
      return EXIT_INITIATORS.map(function (x) {
        return {
          key: x.key,
          name: x.name,
          note: x.note || '',
          value: rs.filter(function (r) {
            return r.init === x.key;
          }).reduce(function (a, r) {
            return a + r.value;
          }, 0)
        };
      });
    }
    var EXIT_TENURE = [{
      key: 'm3',
      name: 'До 3 месяцев',
      w: 0.13,
      early: true
    }, {
      key: 'm12',
      name: '3–12 месяцев',
      w: 0.23,
      early: true
    }, {
      key: 'y3',
      name: '1–3 года',
      w: 0.36
    }, {
      key: 'y3p',
      name: 'Больше 3 лет',
      w: 0.28
    }];
    var EXIT_GRADE_K = [1.35, 1.15, 1.0, 0.78, 0.6];
    var EXIT_STREAM_K = {
      dev: 1.0,
      qa: 1.1,
      ana: 0.9,
      ops: 0.85,
      ml: 0.95,
      des: 1.0,
      prod: 0.9,
      sup: 1.45,
      back: 1.2,
      adm: 0.6
    };
    function exitProfile(lp, win) {
      win = win || 'ytd';
      var total = sumWin(aggregate(lp, 'attrition'), win),
        r = rng(lpSeed(lp, 'exp' + win));
      var ten = splitBy(total, jitter(r, EXIT_TENURE.map(function (x) {
        return x.w;
      }), 0.3));
      var gr = splitBy(total, mixParts(lp, 'grade').map(function (v, i) {
        return v * EXIT_GRADE_K[i] + 1e-6;
      }));
      var st = mixTree(lp, 'stream');
      var sr = splitBy(total, st.map(function (n) {
        return n.value * (EXIT_STREAM_K[n.cat.key] || 1) + 1e-6;
      }));
      return {
        total: total,
        tenure: EXIT_TENURE.map(function (x, i) {
          return {
            key: x.key,
            name: x.name,
            early: !!x.early,
            value: ten[i]
          };
        }),
        grade: MIX_BY_KEY.grade.cats.map(function (c, i) {
          return {
            key: c.key,
            name: c.name,
            value: gr[i]
          };
        }),
        stream: st.map(function (n, i) {
          return {
            key: n.cat.key,
            name: n.cat.name,
            value: sr[i]
          };
        })
      };
    }
    var HIRE_CHANNELS = [{
      key: 'ref',
      name: 'Рекомендации сотрудников',
      wIT: 0.22,
      wNon: 0.14
    }, {
      key: 'site',
      name: 'Карьерный сайт и соцсети',
      wIT: 0.14,
      wNon: 0.16
    }, {
      key: 'job',
      name: 'Сайты вакансий',
      wIT: 0.27,
      wNon: 0.42
    }, {
      key: 'hunt',
      name: 'Прямой поиск (хантинг)',
      wIT: 0.21,
      wNon: 0.06
    }, {
      key: 'agency',
      name: 'Кадровые агентства',
      wIT: 0.05,
      wNon: 0.12
    }, {
      key: 'campus',
      name: 'Вузы и стажировки',
      wIT: 0.11,
      wNon: 0.10
    }];
    function hiringProfile(lp, win) {
      win = win || 'ytd';
      var total = sumWin(aggregate(lp, 'hire'), win);
      var jun = Math.min(total, sumWin(aggregate(lp, 'hire_jun'), win));
      var tin = sumWin(aggregate(lp, 'transfer_in'), win);
      var r = rng(lpSeed(lp, 'hpr' + win)),
        it = hcIT(lp);
      var ch = splitBy(total, jitter(r, HIRE_CHANNELS.map(function (c) {
        return c.wIT * it + c.wNon * (1 - it);
      }), 0.25));
      var sen = [jun].concat(splitBy(total - jun, jitter(r, [0.56, 0.32, 0.12], 0.2)));
      var gr = roundParts(MIX_BY_KEY.grade.cats.map(function (c, j) {
        return sen.reduce(function (a, v, i) {
          return a + v * GRADE_BY_SEN[i][j];
        }, 0);
      }), total);
      return {
        total: total,
        jun: jun,
        tin: tin,
        channels: HIRE_CHANNELS.map(function (c, i) {
          return {
            key: c.key,
            name: c.name,
            value: ch[i]
          };
        }),
        seniority: MIX_BY_KEY.seniority.cats.map(function (c, i) {
          return {
            key: c.key,
            name: c.name,
            value: sen[i]
          };
        }),
        grade: MIX_BY_KEY.grade.cats.map(function (c, i) {
          return {
            key: c.key,
            name: c.name,
            value: gr[i]
          };
        })
      };
    }
    function massShare(leafPath) {
      var n = NODE_BY_PATH[leafPath] || {},
        x = rng('ms' + leafPath)();
      return n.it === 'nonIT' ? 0.62 + x * 0.3 : 0.04 + x * 0.16;
    }
    var PF_STATUS = [{
      key: 'work',
      name: 'В работе',
      bias: [1.1, 0.95]
    }, {
      key: 'ready',
      name: 'Готово к выходу',
      note: 'оффер принят, ждём первого дня',
      bias: [1.25, 0.85]
    }, {
      key: 'backlog',
      name: 'Backlog',
      note: 'не взяты в работу',
      bias: [0.8, 1.15]
    }, {
      key: 'hold',
      name: 'Холд',
      note: 'поиск на паузе',
      bias: [0.85, 1.1]
    }];
    function planFact(lp) {
      var ytd = function ytd(k) {
        return sumWin(aggregate(lp, k), 'ytd');
      };
      var P = ytd('pf_plan'),
        F = ytd('hire'),
        C = ytd('vac_closed'),
        O = lastVal(lp, 'vac_open');
      var massOf = function massOf(k, win) {
        return lp.reduce(function (a, p) {
          var ser = metricSeries(p, k),
            v = win ? sumWin(ser, win) : ser[LAST];
          return a + v * massShare(p);
        }, 0);
      };
      var two = function two(tot, raw) {
        var m = Math.max(0, Math.min(tot, Math.round(raw)));
        return [m, tot - m];
      };
      var Pt = two(P, massOf('pf_plan', 'ytd')),
        Ft = two(F, massOf('hire', 'ytd'));
      var Ct = two(C, massOf('vac_closed', 'ytd')),
        Ot = two(O, massOf('vac_open'));
      var r = rng(lpSeed(lp, 'pf'));
      var onTime = [Math.round(Ct[0] * (0.76 + r() * 0.12)), Math.round(Ct[1] * (0.56 + r() * 0.14))];
      var ttf = aggregate(lp, 'time_to_fill'),
        vc = aggregate(lp, 'vac_closed');
      var dd = 0,
        dc = 0;
      for (var i = winFrom('ytd'); i <= LAST; i++) {
        dd += ttf[i] * vc[i];
        dc += vc[i];
      }
      var avg = dc ? dd / dc : null;
      var k = avg && C ? C / (0.55 * Ct[0] + 1.12 * Ct[1]) : 1;
      var days = [avg, avg && Ct[0] ? avg * 0.55 * k : null, avg && Ct[1] ? avg * 1.12 * k : null];
      var stTot = splitBy(O, jitter(r, [0.52, 0.13, 0.19, 0.16], 0.2));
      var st = jointRound(stTot, Ot, PF_STATUS.map(function (x) {
        return x.bias;
      }));
      var part = function part(rate, vary) {
        return Ot.map(function (o, i) {
          return Math.min(o, Math.round(o * rate[i] * (1 - vary + r() * vary * 2)));
        });
      };
      var pct = function pct(a, b) {
        return b ? +(a / b * 100).toFixed(1) : null;
      };
      var col = function col(arr) {
        return [arr[0] + arr[1]].concat(arr);
      };
      var over = part([0.17, 0.27], 0.3),
        repl = part([0.62, 0.34], 0.2),
        jun = part([0.55, 0.18], 0.25);
      return {
        cols: ['Всего', 'Массовый', 'Профильный'],
        plan: col(Pt),
        fact: col(Ft),
        closed: col(Ct),
        open: col(Ot),
        done: [pct(F, P), pct(Ft[0], Pt[0]), pct(Ft[1], Pt[1])],
        share: [pct(C, C + O), pct(Ct[0], Ct[0] + Ot[0]), pct(Ct[1], Ct[1] + Ot[1])],
        onTime: [pct(onTime[0] + onTime[1], C), pct(onTime[0], Ct[0]), pct(onTime[1], Ct[1])],
        days: days,
        status: PF_STATUS.map(function (x, i) {
          return {
            key: x.key,
            name: x.name,
            note: x.note || '',
            vals: col(st[i])
          };
        }),
        overdue: col(over),
        replace: col(repl),
        junior: col(jun)
      };
    }
    var TG_TYPES = [{
      key: 'grade',
      name: 'Повышение грейда',
      w: 0.78
    }, {
      key: 'spec',
      name: 'Смена специализации',
      w: 0.22
    }];
    var TG_STATUS = [{
      key: 'done',
      name: 'Рост состоялся',
      tip: 'Повышение за последние 12 месяцев.'
    }, {
      key: 'inprog',
      name: 'В карьерном росте',
      tip: 'Заявка подана, решение ещё не принято.'
    }, {
      key: 'denied',
      name: 'Заявка отклонена',
      tip: 'Отказ за 12 месяцев, новой заявки нет.'
    }, {
      key: 'none',
      name: 'Нет развития',
      tip: 'Ни повышения, ни заявки за 12 месяцев.'
    }, {
      key: 'na',
      name: 'Рост недоступен',
      tip: 'Потолок грейда для роли или испытательный срок.'
    }];
    function tgrowthProfile(lp) {
      var P = sumWin(aggregate(lp, 'tgrowth_pass'), '12m'),
        Dn = sumWin(aggregate(lp, 'tgrowth_deny'), '12m');
      var r = rng(lpSeed(lp, 'tg'));
      var types = jointRound(splitBy(P + Dn, jitter(r, TG_TYPES.map(function (t) {
        return t.w;
      }), 0.15)), [P, Dn], [[1.12, 0.8], [0.7, 1.6]]);
      var gp = mixParts(lp, 'grade'),
        hc = gp.reduce(function (a, b) {
          return a + b;
        }, 0);
      var done = Math.min(P, hc),
        denied = Math.min(Dn, hc - done);
      var inprog = Math.min(hc - done - denied, Math.round(hc * (0.05 + r() * 0.03)));
      var na = Math.min(hc - done - denied - inprog, Math.round(hc * (0.10 + r() * 0.04)));
      var bias = [[1.25, 1.2, 1.0, 0.85, 0.25], [1.2, 1.15, 1.05, 0.9, 0.45], [1.0, 1.0, 1.0, 1.0, 0.8], [0.75, 0.8, 0.95, 1.1, 1.5], [0.45, 0.5, 0.8, 1.05, 3.2]];
      var cells = jointRound(gp, [done, inprog, denied, hc - done - denied - inprog - na, na], bias);
      return {
        pass: P,
        deny: Dn,
        hc: hc,
        types: TG_TYPES.map(function (t, i) {
          return {
            key: t.key,
            name: t.name,
            pass: types[i][0],
            deny: types[i][1]
          };
        }),
        rows: MIX_BY_KEY.grade.cats.map(function (c, i) {
          return {
            key: c.key,
            name: c.name,
            cells: cells[i]
          };
        })
      };
    }
    var REVIEW_SCORES = [{
      key: 'a',
      name: 'Выдающийся',
      full: 'Выдающийся результат',
      w: 0.07
    }, {
      key: 'b',
      name: 'Выше ожиданий',
      full: 'Результат выше ожиданий',
      w: 0.22
    }, {
      key: 'c',
      name: 'Соответствует',
      full: 'Соответствует ожиданиям',
      w: 0.49
    }, {
      key: 'd',
      name: 'Частично',
      full: 'Частично соответствует ожиданиям',
      w: 0.15
    }, {
      key: 'e',
      name: 'Не соответствует',
      full: 'Не соответствует ожиданиям',
      w: 0.07
    }];
    var REVIEW_DYN = [{
      key: 'up',
      name: 'Улучшили оценку'
    }, {
      key: 'same',
      name: 'Без изменений'
    }, {
      key: 'down',
      name: 'Ухудшили оценку'
    }, {
      key: 'first',
      name: 'Первая оценка',
      note: 'в прошлом цикле ещё не работали'
    }];
    function reviewProfile(lp) {
      var E = lastVal(lp, 'rev_eval'),
        U = Math.min(E, lastVal(lp, 'rev_up')),
        r = rng(lpSeed(lp, 'rv'));
      var first = Math.min(E - U, Math.round(E * (0.09 + r() * 0.05)));
      var rest = splitBy(E - U - first, jitter(r, [0.66, 0.34], 0.15));
      var sc = splitBy(E, jitter(r, REVIEW_SCORES.map(function (x) {
        return x.w;
      }), 0.2));
      var toE = function toE(parts) {
        var t = parts.reduce(function (a, b) {
          return a + b;
        }, 0);
        return t ? roundParts(parts.map(function (v) {
          return v / t * E;
        }), E) : parts.map(function () {
          return 0;
        });
      };
      var ms = 0.09 + r() * 0.05;
      var groups = [{
        key: 'grade',
        name: 'Грейд',
        rows: MIX_BY_KEY.grade.cats.map(function (c) {
          return c.name;
        }),
        tot: toE(mixParts(lp, 'grade')),
        tilt: [-0.25, -0.1, 0, 0.15, 0.3]
      }, {
        key: 'tenure',
        name: 'Стаж в компании',
        rows: MIX_BY_KEY.tenure.cats.map(function (c) {
          return c.name;
        }),
        tot: toE(mixParts(lp, 'tenure')),
        tilt: [-0.15, 0.05, 0.12]
      }, {
        key: 'role',
        name: 'Роль',
        rows: ['Руководители', 'Сотрудники'],
        tot: splitBy(E, [ms, 1 - ms]),
        tilt: [0.3, -0.03]
      }];
      groups.forEach(function (g) {
        g.cells = jointRound(g.tot, sc, tiltBias(g.tilt, sc.length));
      });
      return {
        E: E,
        U: U,
        dyn: REVIEW_DYN.map(function (d, i) {
          return {
            key: d.key,
            name: d.name,
            note: d.note || '',
            value: [U, rest[0], rest[1], first][i]
          };
        }),
        scores: REVIEW_SCORES.map(function (x, i) {
          return {
            key: x.key,
            name: x.name,
            full: x.full,
            value: sc[i]
          };
        }),
        groups: groups
      };
    }
    function workdays(mIdx) {
      var mm = MONTHS[mIdx],
        nd = new Date(mm.y, mm.m + 1, 0).getDate();
      var w = 0;
      for (var d = 1; d <= nd; d++) if ((new Date(mm.y, mm.m, d).getDay() + 6) % 7 < 5) w++;
      return w;
    }
    function bookingQuality(lp) {
      var hc = lastVal(lp, 'hc_total'),
        att = lastVal(lp, 'office_att') / 100,
        v = lastVal(lp, 'booking_viol') / 100;
      var V = Math.round(hc * workdays(LAST) * att),
        r = rng(lpSeed(lp, 'bk'));
      var q = 0.52 + r() * 0.18;
      var T = Math.round(V / (1 - v * q)),
        viol = Math.round(T * v),
        noshow = Math.round(viol * q);
      return {
        total: T,
        ok: T - viol,
        noshow: noshow,
        walkin: viol - noshow,
        viol: viol,
        visits: T - noshow,
        month: monthNom(CUR_M)
      };
    }
    function officeByCity(lp) {
      var by = {};
      officeRank(lp).forEach(function (o) {
        var c = by[o.city] || (by[o.city] = {
          name: o.city,
          hc: 0,
          w: 0,
          offices: 0
        });
        c.hc += o.hc;
        c.w += o.att * o.hc;
        c.offices++;
      });
      return Object.keys(by).map(function (k) {
        return by[k];
      }).map(function (c) {
        return {
          name: c.name,
          hc: c.hc,
          offices: c.offices,
          att: c.hc ? +(c.w / c.hc).toFixed(1) : 0
        };
      }).sort(function (a, b) {
        return b.att - a.att;
      });
    }
    function normAtt(base, hcs, f) {
      var tot = hcs.reduce(function (a, b) {
          return a + b;
        }, 0) || 1,
        mean = hcs.reduce(function (a, v, i) {
          return a + v * f[i];
        }, 0) / tot || 1;
      return f.map(function (x) {
        return +(x * base / mean).toFixed(1);
      });
    }
    function attByGrade(lp) {
      var gp = mixParts(lp, 'grade'),
        r = rng(lpSeed(lp, 'ag'));
      var att = normAtt(lastVal(lp, 'office_att'), gp, [1.08, 1.04, 1.0, 0.95, 0.9].map(function (x) {
        return x * (0.94 + r() * 0.12);
      }));
      return MIX_BY_KEY.grade.cats.map(function (c, i) {
        return {
          key: c.key,
          name: c.name,
          hc: gp[i],
          att: att[i]
        };
      });
    }
    var ROLE_LOC = [{
      key: 'rm',
      name: 'Руководители, Москва',
      code: 'РУК-МСК',
      f: 1.16
    }, {
      key: 'lm',
      name: 'Сотрудники, Москва',
      code: 'ЛИН-МСК',
      f: 1.0
    }, {
      key: 'rt',
      name: 'Руководители, ТЦР',
      code: 'РУК-ТЦР',
      f: 1.06
    }, {
      key: 'lt',
      name: 'Сотрудники, ТЦР',
      code: 'ЛИН-ТЦР',
      f: 0.9
    }];
    function attByRoleLoc(lp) {
      var reg = mixParts(lp, 'region'),
        hc = reg.reduce(function (a, b) {
          return a + b;
        }, 0),
        r = rng(lpSeed(lp, 'arl'));
      var ms = 0.09 + r() * 0.05;
      var c = jointRound([reg[0], hc - reg[0]], splitBy(hc, [ms, 1 - ms]), [[1, 1], [1, 1]]);
      var hcs = [c[0][0], c[0][1], c[1][0], c[1][1]];
      var att = normAtt(lastVal(lp, 'office_att'), hcs, ROLE_LOC.map(function (x) {
        return x.f * (0.95 + r() * 0.1);
      }));
      return ROLE_LOC.map(function (x, i) {
        return {
          key: x.key,
          name: x.name,
          code: x.code,
          hc: hcs[i],
          att: att[i]
        };
      });
    }
    var AI_TOOLS = [{
      key: 'chat',
      name: 'Корпоративный AI-ассистент',
      k: 0.82
    }, {
      key: 'code',
      name: 'AI-помощник разработчика',
      k: 0.5,
      it: true
    }, {
      key: 'kb',
      name: 'AI-поиск по базе знаний',
      k: 0.38
    }, {
      key: 'docs',
      name: 'Генерация документов и писем',
      k: 0.27
    }, {
      key: 'data',
      name: 'AI в аналитике данных',
      k: 0.15
    }];
    var AI_STREAM_K = {
      dev: 1.5,
      qa: 1.25,
      ana: 1.2,
      ops: 1.15,
      ml: 1.6,
      des: 1.1,
      prod: 1.05,
      sup: 0.45,
      back: 0.5,
      adm: 0.8
    };
    function aiProfile(lp) {
      var pen = lastVal(lp, 'ai_penetration') || 0,
        wau = lastVal(lp, 'ai_wau'),
        r = rng(lpSeed(lp, 'ai')),
        it = hcIT(lp);
      var tools = AI_TOOLS.map(function (t) {
        return {
          key: t.key,
          name: t.name,
          value: +Math.min(pen, pen * t.k * (t.it ? Math.min(1, it * 1.2) : 1) * (0.9 + r() * 0.2)).toFixed(1)
        };
      });
      var st = mixTree(lp, 'stream').filter(function (n) {
        return n.value > 0;
      });
      var att = normAtt(pen, st.map(function (n) {
        return n.value;
      }), st.map(function (n) {
        return (AI_STREAM_K[n.cat.key] || 1) * (0.92 + r() * 0.16);
      }));
      return {
        pen: pen,
        wau: wau,
        tools: tools,
        streams: st.map(function (n, i) {
          return {
            key: n.cat.key,
            name: n.cat.name,
            hc: n.value,
            value: Math.min(98, att[i])
          };
        })
      };
    }
    window.TPDATA = {
      REAL: REAL,
      isStub: isStub,
      kidsOf: kidsOf,
      defOf: defOf,
      unitsInScope: unitsInScope,
      UNIT_WORDS: UNIT_WORDS,
      rowsOf: rowsOf,
      directNA: directNA,
      MIX_DIMS: MIX_DIMS,
      MIX_BY_KEY: MIX_BY_KEY,
      MIX_GROUPS: MIX_GROUPS,
      MIX_GROUP_COLOR: MIX_GROUP_COLOR,
      dimColor: dimColor,
      GRADE_BY_SEN: GRADE_BY_SEN,
      MIX_LINKS: MIX_LINKS,
      MIX_LINK_TEXT: MIX_LINK_TEXT,
      mixParts: mixParts,
      mixCats: mixCats,
      mixTree: mixTree,
      mixMatrix: mixMatrix,
      mixWeights: mixWeights,
      mixJoint: mixJoint,
      roundParts: roundParts,
      roundMatrix: roundMatrix,
      otherParts: otherParts,
      SLICE_MAX: SLICE_MAX,
      sliceable: sliceable,
      sliceParse: sliceParse,
      sliceLabel: sliceLabel,
      sliceShare: sliceShare,
      aggregateSlice: aggregateSlice,
      lastValSlice: lastValSlice,
      sliceDeltaMoM: sliceDeltaMoM,
      netGrowth: netGrowth,
      MONTHS: MONTHS,
      N: N,
      LAST: LAST,
      PERIOD_LABEL: PERIOD_LABEL,
      CMP: CMP,
      BLOCKS: BLOCKS,
      BLOCK_BY_KEY: BLOCK_BY_KEY,
      METRICS: METRICS,
      METRIC_BY_KEY: METRIC_BY_KEY,
      metricsOfBlock: metricsOfBlock,
      OFFICES: OFFICES,
      DOW_NAME: DOW_NAME,
      DOW_SHORT: DOW_SHORT,
      MONTH_GEN: MONTH_GEN,
      CAL_MONTH: CAL_MONTH,
      CAL_MONTHS: CAL_MONTHS,
      CAL_TODAY: CAL_TODAY,
      DOW_MONTHS: DOW_MONTHS,
      attDays: attDays,
      attLast: attLast,
      attByDow: attByDow,
      officeRank: officeRank,
      COUNT_METRICS: COUNT_METRICS,
      EXIT_REASONS: EXIT_REASONS,
      PAINTS: PAINTS,
      ITSEGS: ITSEGS,
      STAFFTYPES: STAFFTYPES,
      NODES: NODES,
      NODE_BY_PATH: NODE_BY_PATH,
      ROOT: ROOT,
      LEVEL_NAME: LEVEL_NAME,
      LEVEL_SHORT: LEVEL_SHORT,
      childrenOf: childrenOf,
      descendantsOf: descendantsOf,
      leavesUnder: leavesUnder,
      ancestorsOf: ancestorsOf,
      levelLabel: levelLabel,
      nodesBelow: nodesBelow,
      leafPasses: leafPasses,
      reportLeaves: reportLeaves,
      benchmarkLeaves: benchmarkLeaves,
      benchmarkLabel: benchmarkLabel,
      filterChips: filterChips,
      metricSeries: metricSeries,
      reasonSeries: reasonSeries,
      aggregate: aggregate,
      lastVal: lastVal,
      deltas: deltas,
      deltasOf: deltasOf,
      compareState: compareState,
      stateForKpi: stateForKpi,
      kpiFor: kpiFor,
      comparable: comparable,
      LOCKED_METRICS: LOCKED_METRICS,
      METRIC_PRESETS: METRIC_PRESETS,
      sanitizeHidden: sanitizeHidden,
      metricVisible: metricVisible,
      visibleMetricsOfBlock: visibleMetricsOfBlock,
      visibleBlocks: visibleBlocks,
      blockVisible: blockVisible,
      visibleCount: visibleCount,
      hiddenForPreset: hiddenForPreset,
      activePreset: activePreset,
      fmtInt: fmtInt,
      fmtVal: fmtVal,
      fmtDelta: fmtDelta,
      fmtCompact: fmtCompact,
      DEFAULT_STATE: DEFAULT_STATE,
      PRE: PRE,
      NEXT: NEXT,
      MONTHS_EXT: MONTHS_EXT,
      YEAR_START_EXT: YEAR_START_EXT,
      seriesExt: seriesExt,
      aggregateExt: aggregateExt,
      YEAR_CUR: YEAR_CUR,
      YEAR_PREV: YEAR_PREV,
      CUR_LEN: CUR_LEN,
      MONTH_ABBR: MONTH_ABBR,
      MONTH_NOM: MONTH_NOM,
      yoySeries: yoySeries,
      blockSignal: blockSignal,
      PROTEUS_DASH: PROTEUS_DASH,
      blockDash: blockDash,
      fmtNum: fmtNum,
      EXIT_INITIATORS: EXIT_INITIATORS,
      YTD_FROM: YTD_FROM,
      YTD_RANGE: YTD_RANGE,
      sumWin: sumWin,
      workdays: workdays,
      exitReasons: exitReasons,
      exitInitiators: exitInitiators,
      exitProfile: exitProfile,
      EXIT_TENURE: EXIT_TENURE,
      hiringProfile: hiringProfile,
      HIRE_CHANNELS: HIRE_CHANNELS,
      planFact: planFact,
      PF_STATUS: PF_STATUS,
      tgrowthProfile: tgrowthProfile,
      TG_TYPES: TG_TYPES,
      TG_STATUS: TG_STATUS,
      reviewProfile: reviewProfile,
      REVIEW_SCORES: REVIEW_SCORES,
      REVIEW_DYN: REVIEW_DYN,
      bookingQuality: bookingQuality,
      officeByCity: officeByCity,
      attByGrade: attByGrade,
      attByRoleLoc: attByRoleLoc,
      ROLE_LOC: ROLE_LOC,
      aiProfile: aiProfile,
      AI_TOOLS: AI_TOOLS
    };
  })();
  (function () {
    (function () {
      'use strict';

      var CD = window.TPDATA;
      var FONT = 'Arial, sans-serif';
      var C_LABEL = '#2b2b2b';
      var C_AXIS = '#8a909c',
        C_DIV = '#e4e7ec',
        C_ZERO = '#c9cdd6';
      var C_LINE = '#245FD4',
        C_BENCH = '#9aa0ac';
      var C_GREEN = '#80cf9a',
        C_RED = '#ef8c8c',
        C_FLAT = '#c7c8cc';
      var C_HIRE = '#97dece',
        C_HIRE_D = '#0ea293',
        C_HIRE_I = '#009dae',
        C_FIRE = '#ac87c5',
        C_TR_IN = '#85cdfd',
        C_TR_OUT = '#3c84ab',
        C_CNT = '#c7c8cc',
        C_OTHER = '#686d76';
      var C_IN = C_HIRE,
        C_OUT = C_FIRE,
        C_TOTAL = C_CNT;
      var C_VAC = '#7fb0c8',
        C_UNDER = '#c08a3e',
        C_LOWPERF = '#b4576f',
        C_OFFICE = '#5f86c2',
        C_REGRET = '#e8918f',
        C_NOREG = '#9aa8bd',
        C_TURN_Y = '#8b6fc0',
        C_AI = '#4f9fb5';
      var PALETTE = [C_TR_IN, C_HIRE_I, C_HIRE_D, C_HIRE, C_FIRE, C_TR_OUT, C_CNT, C_OTHER];
      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
          return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
          }[c];
        });
      }
      function num(v) {
        return Math.round(v * 100) / 100;
      }
      function textW(s, size) {
        return String(s).length * size * 0.56;
      }
      function mLabel(i) {
        var m = CD.MONTHS[i];
        return m.label + ' ' + m.y;
      }
      function tipHtml(o) {
        if (o == null) return '';
        if (typeof o === 'string') return o;
        var s = '';
        if (o.title) s += '<span class="t-h">' + esc(o.title) + '</span>';
        if (o.text) s += '<span class="t-x">' + esc(o.text) + '</span>';
        (o.rows || []).forEach(function (r, i) {
          if (!r) return;
          var mk = r.color ? '<i class="t-m' + (r.dash ? ' dash' : '') + '" style="' + (r.dash ? 'border-top-color:' : 'background:') + r.color + '"></i>' : '';
          s += '<span class="t-r' + (r.dash ? ' bench' : '') + '">' + mk + '<span class="t-l">' + esc(r.label) + '</span>' + '<b class="t-v">' + esc(r.value) + '</b></span>';
        });
        var ns = o.note == null ? [] : Array.isArray(o.note) ? o.note : [o.note];
        ns.forEach(function (n) {
          if (n) s += '<span class="t-n">' + esc(n) + '</span>';
        });
        return s;
      }
      function tip(o) {
        return ' data-tip="' + esc(tipHtml(o)) + '"';
      }
      function polyD(vals, X, Y) {
        var d = '',
          pen = false;
        vals.forEach(function (v, i) {
          if (v == null) {
            pen = false;
            return;
          }
          d += (pen ? 'L' : 'M') + num(X(i)) + ' ' + num(Y(v));
          pen = true;
        });
        return d;
      }
      function niceMax(vals) {
        var m = 0;
        vals.forEach(function (v) {
          if (v != null && isFinite(v) && Math.abs(v) > m) m = Math.abs(v);
        });
        if (m === 0) return 1;
        var p = Math.pow(10, Math.floor(Math.log10(m))),
          n = m / p;
        var s = n <= 1 ? 1 : n <= 1.2 ? 1.2 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
        return s * p;
      }
      function txt(x, y, s, o) {
        o = o || {};
        var common = '<text x="' + num(x) + '" y="' + num(y) + '" font-size="' + (o.size || 11) + '"' + (o.weight ? ' font-weight="' + o.weight + '"' : '') + sAttr(o.s) + ' text-anchor="' + (o.anchor || 'middle') + '"' + (o.cls ? ' class="' + o.cls + '"' : '') + (o.delay ? ' style="animation-delay:' + o.delay + 'ms"' : '');
        var body = '>' + esc(s) + '</text>';
        var face = common + ' fill="' + (o.fill || C_LABEL) + '"' + body;
        if (!o.halo) return face;
        return common + ' fill="#fff" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"' + ' aria-hidden="true"' + body + face;
      }
      function line(x1, y1, x2, y2, color, w, dash) {
        return '<line x1="' + num(x1) + '" y1="' + num(y1) + '" x2="' + num(x2) + '" y2="' + num(y2) + '"' + ' stroke="' + color + '" stroke-width="' + (w || 1) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
      }
      function rect(x, y, w, h, fill, r, extra) {
        return '<rect x="' + num(x) + '" y="' + num(y) + '" width="' + num(Math.max(0, w)) + '" height="' + num(Math.max(0, h)) + '"' + (r ? ' rx="' + r + '"' : '') + ' fill="' + fill + '"' + (extra || '') + '/>';
      }
      function barUp(x, y, w, h, fill, extra) {
        h = Math.max(0, h);
        var r = Math.min(2, w / 2, h);
        if (h <= 0.5) return '';
        return '<path d="M' + num(x) + ' ' + num(y + h) + 'V' + num(y + r) + 'Q' + num(x) + ' ' + num(y) + ' ' + num(x + r) + ' ' + num(y) + 'H' + num(x + w - r) + 'Q' + num(x + w) + ' ' + num(y) + ' ' + num(x + w) + ' ' + num(y + r) + 'V' + num(y + h) + 'Z"' + ' fill="' + fill + '"' + (extra || '') + '/>';
      }
      function barDown(x, y, w, h, fill, extra) {
        h = Math.max(0, h);
        var r = Math.min(2, w / 2, h);
        if (h <= 0.5) return '';
        return '<path d="M' + num(x) + ' ' + num(y) + 'V' + num(y + h - r) + 'Q' + num(x) + ' ' + num(y + h) + ' ' + num(x + r) + ' ' + num(y + h) + 'H' + num(x + w - r) + 'Q' + num(x + w) + ' ' + num(y + h) + ' ' + num(x + w) + ' ' + num(y + h - r) + 'V' + num(y) + 'Z"' + ' fill="' + fill + '"' + (extra || '') + '/>';
      }
      function svg(w, h, body, cls) {
        return '<svg viewBox="0 0 ' + num(w) + ' ' + num(h) + '" width="' + num(w) + '" height="' + num(h) + '"' + ' class="chart' + (cls ? ' ' + cls : '') + '" font-family="' + FONT + '"' + ' role="img" style="display:block;overflow:visible">' + body + '</svg>';
      }
      var TTL_SZ = 12,
        TTL_W = 700,
        C_INK = '#1f1f1f';
      var SERIES = {
        line: ['main', 'bench'],
        yoy: ['main', 'prev', 'bench'],
        diverge: ['up', 'dn'],
        waterfall: ['total', 'in', 'out'],
        bars: ['main']
      };
      var LOCKED = {
        waterfall: 1
      };
      var C_OFF = '#c7c8cc';
      function seriesOf(kind, legend) {
        if (!legend || !legend.length) return [];
        var ids = SERIES[kind] || [];
        return legend.map(function (it, i) {
          return ids[i] || '';
        });
      }
      function sAttr(sid) {
        return sid ? ' data-s="' + sid + '"' : '';
      }
      var NOSET = {
        has: function has() {
          return false;
        },
        size: 0
      };
      function offOf(o) {
        return o && o.off && o.off.has ? o.off : NOSET;
      }
      function header(w, title, legend, ctx) {
        ctx = ctx || {};
        var off = ctx.off,
          lock = LOCKED[ctx.kind];
        var s = '';
        if (title) s += txt(0, 12, title, {
          size: TTL_SZ,
          weight: TTL_W,
          fill: C_INK,
          anchor: 'start'
        });
        if (legend && legend.length) {
          var ids = seriesOf(ctx.kind, legend);
          var x = w;
          for (var i = legend.length - 1; i >= 0; i--) {
            var it = legend[i],
              sid = ids[i],
              tw = textW(it.name, 11.5);
            var dead = !!(sid && off && off.has && off.has(sid));
            var col = dead ? C_OFF : it.color;
            x -= tw;
            var tx = x,
              mx = x - 6 - 16;
            var g = '';
            g += txt(tx, 12, it.name, {
              size: 11.5,
              fill: dead ? C_AXIS : C_LABEL,
              anchor: 'start'
            });
            g += it.dash ? line(mx, 8.5, mx + 16, 8.5, col, 2.2, '5 3') : rect(mx, 4.5, 16, 8, col, 2);
            if (dead) g += line(tx - 1, 8.5, tx + tw + 1, 8.5, C_AXIS, 1.2);
            if (!sid) {
              s += g;
              x -= 16 + 14;
              continue;
            }
            s += '<g class="lg' + (lock ? ' lock' : '') + (dead ? ' dead' : '') + '" data-sid="' + sid + '"' + ' tabindex="0" role="button"' + ' aria-pressed="' + (dead ? 'false' : 'true') + '"' + ' aria-label="' + esc(it.name) + (lock ? '' : dead ? ': включить' : ': скрыть') + '">' + g + '<rect class="hit" x="' + num(mx - 4) + '" y="0" width="' + num(tw + 16 + 6 + 8) + '" height="18"/>' + '</g>';
            x -= 16 + 14;
          }
        }
        return s;
      }
      function headH(title, legend) {
        return title || legend && legend.length ? 24 : 0;
      }
      function axisX(x0, bandW, plotTop, plotBot, labelY) {
        var s = '';
        var jan = CD.MONTHS.findIndex(function (m) {
            return m.isYearStart;
          }),
          thin = bandW < 31;
        CD.MONTHS.forEach(function (m, i) {
          var cx = x0 + bandW * (i + 0.5);
          if (!thin || Math.abs(i - jan) % 2 === 0) s += txt(cx, labelY, m.label, {
            size: 10.5,
            fill: C_AXIS
          });
          if (m.isYearStart && i > 0 && plotBot > plotTop) s += line(x0 + bandW * i, plotTop, x0 + bandW * i, plotBot, C_DIV, 1, '4 3');
          if (i === 0 || m.isYearStart) s += txt(cx, labelY + 12, m.y, {
            size: 10.5,
            weight: 700,
            fill: C_AXIS
          });
        });
        return s;
      }
      var AXIS_H = 30;
      var HEAD_GAP = 8;
      var VAL_SZ = 11,
        VAL_W = 700;
      var VAL_DY = 9;
      var VAL_ASC = 8.5;
      var LBL_ROOM = Math.ceil(VAL_DY + VAL_ASC + HEAD_GAP);
      var PAD_X = 6;
      var DRAW_MS = 760;
      var STACK_GAP = 26;
      function valOpt(o) {
        return Object.assign({
          size: VAL_SZ,
          weight: VAL_W,
          halo: true,
          cls: 'fade'
        }, o || {});
      }
      function labelStep(vals, key, bandW) {
        var mw = 0;
        vals.forEach(function (v) {
          if (v != null) mw = Math.max(mw, textW(CD.fmtVal(key, v), VAL_SZ));
        });
        return Math.max(1, Math.ceil((mw + 5) / Math.max(1, bandW)));
      }
      function lblAt(i, last, step) {
        return (last - i) % step === 0;
      }
      function kpiRoom(key, kpi) {
        if (!kpi) return 0;
        return Math.ceil(Math.max(textW('порог ' + CD.fmtVal(key, kpi.red), 10.5), textW('цель ' + CD.fmtVal(key, kpi.green), 10.5))) + 12;
      }
      function kpiLines(key, kpi, xL, xR, Y) {
        var s = '';
        var ys = [Y(kpi.green), Y(kpi.red)],
          ty = ys.slice();
        if (Math.abs(ty[0] - ty[1]) < 13) {
          var m = (ty[0] + ty[1]) / 2,
            up = ty[0] <= ty[1] ? -1 : 1;
          ty[0] = m + up * 6.5;
          ty[1] = m - up * 6.5;
        }
        [['green', C_GREEN, 'цель '], ['red', C_RED, 'порог ']].forEach(function (_ref3, i) {
          var _ref4 = _slicedToArray(_ref3, 3),
            k = _ref4[0],
            c = _ref4[1],
            lb = _ref4[2];
          s += line(xL, ys[i], xR, ys[i], c, 1.4, '2 3');
          s += txt(xR + 6, ty[i] + 3.5, lb + CD.fmtVal(key, kpi[k]), {
            size: 10.5,
            fill: C_AXIS,
            anchor: 'start'
          });
        });
        return s;
      }
      function drawLine(a, w, h) {
        var key = a.metricKey,
          ser = a.series,
          bench = a.bench,
          o = a.opt || {};
        var nm = CD.METRIC_BY_KEY[key] || {};
        var hh = headH(o.title, o.legend);
        h = h || o.h || 300;
        var plotTop = hh + LBL_ROOM,
          plotBot = h - AXIS_H;
        var x0 = PAD_X,
          plotW = w - PAD_X * 2 - kpiRoom(key, o.kpi),
          bandW = plotW / CD.N;
        var off = offOf(o);
        var showMain = !off.has('main'),
          showBench = !!bench && !off.has('bench');
        var all = (showMain ? ser.slice() : []).concat(showBench ? bench : []);
        if (o.kpi) {
          all.push(o.kpi.green);
          all.push(o.kpi.red);
        }
        var max = niceMax(all);
        var Y = function Y(v) {
          return plotBot - v / max * (plotBot - plotTop);
        };
        var s = header(w, o.title, o.legend, {
          kind: 'line',
          off: o.off
        });
        s += axisX(x0, bandW, plotTop, plotBot, plotBot + 15);
        s += line(x0, plotBot, x0 + plotW, plotBot, C_ZERO, 1);
        if (o.kpi) s += kpiLines(key, o.kpi, x0, x0 + plotW, Y);
        var XL = function XL(i) {
          return x0 + bandW * (i + 0.5);
        };
        if (showBench) {
          s += '<path class="lnb"' + sAttr('bench') + ' d="' + polyD(bench, XL, Y) + '" fill="none" stroke="' + C_BENCH + '" stroke-width="2" stroke-dasharray="5 3"/>';
        }
        if (showMain) {
          s += '<path class="ln"' + sAttr('main') + ' pathLength="1" d="' + polyD(ser, XL, Y) + '" fill="none" stroke="' + C_LINE + '"' + ' stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
        }
        var step = labelStep(ser, key, bandW);
        ser.forEach(function (v, i) {
          var cx = x0 + bandW * (i + 0.5),
            cy = Y(v);
          var t = {
            title: mLabel(i),
            rows: (showMain ? [{
              label: nm.name || key,
              value: CD.fmtVal(key, v),
              color: C_LINE
            }] : []).concat(showBench ? [{
              label: o.benchName || 'база',
              value: CD.fmtVal(key, bench[i]),
              color: C_BENCH,
              dash: true
            }] : [])
          };
          var dly = DRAW_MS * (i / Math.max(1, ser.length - 1)) * 0.9;
          s += '<g class="ptg"' + tip(t) + '>';
          s += '<rect class="hit" x="' + num(cx - bandW / 2) + '" y="' + num(hh) + '" width="' + num(bandW) + '" height="' + num(plotBot - hh) + '"/>';
          if (showBench && bench[i] != null) s += '<circle class="dotb"' + sAttr('bench') + ' cx="' + num(cx) + '" cy="' + num(Y(bench[i])) + '" r="0" fill="' + C_BENCH + '"/>';
          if (showMain && v != null) s += '<circle class="dot"' + sAttr('main') + ' cx="' + num(cx) + '" cy="' + num(cy) + '" r="3.4" fill="#fff" stroke="' + C_LINE + '"' + ' stroke-width="2" style="animation-delay:' + num(dly) + 'ms"/>';
          s += '</g>';
          if (showMain && v != null && lblAt(i, ser.length - 1, step)) s += txt(cx, cy - VAL_DY, CD.fmtVal(key, v), valOpt({
            delay: dly,
            s: 'main'
          }));
        });
        return svg(w, h, s);
      }
      var C_PREV = '#b9bdc6',
        C_NOW = '#dfe3ea';
      var C_SPARK_INK = '#8a909c';
      function drawYoy(a, w, h) {
        var key = a.metricKey,
          cur = a.cur,
          prev = a.prev,
          bench = a.bench,
          o = a.opt || {};
        var nm = CD.METRIC_BY_KEY[key] || {};
        var hh = headH(o.title, o.legend);
        h = h || o.h || 280;
        var plotTop = hh + LBL_ROOM,
          plotBot = h - AXIS_H + 12;
        var x0 = PAD_X,
          plotW = w - PAD_X * 2 - kpiRoom(key, o.kpi),
          bandW = plotW / 12;
        var off = offOf(o);
        var showMain = !off.has('main'),
          showPrev = !off.has('prev'),
          showBench = !!bench && !off.has('bench');
        var all = [].concat(showMain ? cur : [], showPrev ? prev : [], showBench ? bench : []).filter(function (v) {
          return v != null;
        });
        if (o.kpi) {
          all.push(o.kpi.green);
          all.push(o.kpi.red);
        }
        var nowI = CD.CUR_LEN - 1;
        var fc = showMain && o.fc != null && nowI < 11 && cur[nowI] != null ? o.fc : null;
        if (fc != null) all.push(fc);
        var max = niceMax(all);
        var Y = function Y(v) {
          return plotBot - v / max * (plotBot - plotTop);
        };
        var X = function X(i) {
          return x0 + bandW * (i + 0.5);
        };
        var s = header(w, o.title, o.legend, {
          kind: 'yoy',
          off: o.off
        });
        s += line(X(nowI), plotTop - 6, X(nowI), plotBot, C_NOW, 1);
        CD.MONTH_ABBR.forEach(function (lb, i) {
          if (bandW >= 31 || i % 2 === 0 || i === nowI) s += txt(X(i), plotBot + 15, lb, i === nowI ? {
            size: 10.5,
            weight: 700,
            fill: C_LABEL
          } : {
            size: 10.5,
            fill: C_AXIS
          });
        });
        s += line(x0, plotBot, x0 + plotW, plotBot, C_ZERO, 1);
        if (o.kpi) s += kpiLines(key, o.kpi, x0, x0 + plotW, Y);
        var path = function path(arr) {
          var d = '',
            pen = false;
          arr.forEach(function (v, i) {
            if (v == null) {
              pen = false;
              return;
            }
            d += (pen ? 'L' : 'M') + num(X(i)) + ' ' + num(Y(v));
            pen = true;
          });
          return d;
        };
        if (showPrev) s += '<path class="lnb"' + sAttr('prev') + ' d="' + path(prev) + '" fill="none" stroke="' + C_PREV + '"' + ' stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>';
        if (showBench) s += '<path class="lnb"' + sAttr('bench') + ' d="' + path(bench) + '" fill="none" stroke="' + C_BENCH + '"' + ' stroke-width="2" stroke-dasharray="5 3"/>';
        if (showMain) s += '<path class="ln"' + sAttr('main') + ' pathLength="1" d="' + path(cur) + '" fill="none" stroke="' + C_LINE + '"' + ' stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
        if (fc != null) {
          s += '<path class="lnb"' + sAttr('main') + ' d="M' + num(X(nowI)) + ' ' + num(Y(cur[nowI])) + 'L' + num(X(11)) + ' ' + num(Y(fc)) + '"' + ' fill="none" stroke="' + C_LINE + '" stroke-width="1.6" stroke-dasharray="2 4" stroke-linecap="round"/>';
          s += '<circle class="dotb"' + sAttr('main') + ' cx="' + num(X(11)) + '" cy="' + num(Y(fc)) + '" r="3.4" fill="#fff" stroke="' + C_LINE + '" stroke-width="1.6" stroke-dasharray="2 2"/>';
          s += txt(X(11) + bandW * 0.45, Y(fc) - VAL_DY, 'прогноз ' + CD.fmtVal(key, fc), valOpt({
            anchor: 'end',
            s: 'main',
            fill: C_LINE
          }));
        }
        var yC = CD.YEAR_CUR,
          yP = CD.YEAR_PREV,
          step = labelStep(cur, key, bandW);
        for (var i = 0; i < 12; i++) {
          var c = cur[i],
            p = prev[i],
            b = bench ? bench[i] : null;
          var rows = [];
          if (showMain && c != null) rows.push({
            label: String(yC),
            value: CD.fmtVal(key, c),
            color: C_LINE
          });
          if (showPrev && p != null) rows.push({
            label: String(yP),
            value: CD.fmtVal(key, p),
            color: C_PREV
          });
          if (showBench && b != null) rows.push({
            label: o.benchName || 'база',
            value: CD.fmtVal(key, b),
            color: C_BENCH,
            dash: true
          });
          if (fc != null && i === 11) rows.push({
            label: 'прогноз на декабрь',
            value: CD.fmtVal(key, fc),
            color: C_LINE,
            dash: true
          });
          var note = c != null && p != null ? 'Год к году: ' + CD.fmtDelta(key, +(c - p).toFixed(2)) : c == null ? fc != null && i === 11 ? 'Прогноз — run-rate: темп с начала года, пересчитанный на 12 месяцев' : 'Месяц ' + yC + ' ещё не закрыт' : null;
          var nmM = CD.MONTH_NOM[i];
          s += '<g class="ptg"' + tip({
            title: nmM[0].toUpperCase() + nmM.slice(1) + (nm.name ? ' · ' + nm.name : ''),
            rows: rows,
            note: note
          }) + '>';
          s += '<rect class="hit" x="' + num(X(i) - bandW / 2) + '" y="' + num(hh) + '" width="' + num(bandW) + '" height="' + num(plotBot - hh) + '"/>';
          if (showPrev && p != null) s += '<circle class="dotb"' + sAttr('prev') + ' cx="' + num(X(i)) + '" cy="' + num(Y(p)) + '" r="2.4" fill="' + C_PREV + '"/>';
          var dly = DRAW_MS * (i / Math.max(1, nowI)) * 0.9;
          if (showMain && c != null) s += '<circle class="dot"' + sAttr('main') + ' cx="' + num(X(i)) + '" cy="' + num(Y(c)) + '" r="3.4" fill="#fff" stroke="' + C_LINE + '"' + ' stroke-width="2" style="animation-delay:' + num(dly) + 'ms"/>';
          s += '</g>';
          if (showMain && c != null && lblAt(i, nowI, step)) {
            var both = i === nowI && showPrev && p != null,
              below = both && p > c;
            s += txt(X(i), below ? Y(c) + VAL_DY + VAL_ASC : Y(c) - VAL_DY, CD.fmtVal(key, c), valOpt({
              delay: dly,
              s: 'main'
            }));
            if (both) s += txt(X(i), below ? Y(p) - VAL_DY : Y(p) + VAL_DY + VAL_ASC, CD.fmtVal(key, p), valOpt({
              s: 'prev',
              fill: C_AXIS,
              weight: 400
            }));
          }
        }
        return svg(w, h, s);
      }
      function drawBars(a, w, h) {
        var key = a.metricKey,
          ser = a.series,
          o = a.opt || {};
        var nm = CD.METRIC_BY_KEY[key] || {};
        var hh = headH(o.title, o.legend);
        h = h || o.h || 280;
        var plotTop = hh + LBL_ROOM,
          plotBot = h - AXIS_H;
        var x0 = PAD_X,
          plotW = w - PAD_X * 2,
          bandW = plotW / CD.N;
        var max = niceMax(ser);
        var Y = function Y(v) {
          return plotBot - v / max * (plotBot - plotTop);
        };
        var bw = Math.min(46, bandW * 0.66);
        var s = header(w, o.title, o.legend, {
          kind: 'bars',
          off: o.off
        });
        s += axisX(x0, bandW, plotTop, plotBot, plotBot + 15);
        s += line(x0, plotBot, x0 + plotW, plotBot, C_ZERO, 1);
        var col = o.color || C_LINE,
          step = labelStep(ser, key, bandW);
        ser.forEach(function (v, i) {
          var cx = x0 + bandW * (i + 0.5),
            y = Y(v || 0);
          var t = {
            title: mLabel(i),
            rows: [{
              label: nm.name || key,
              value: CD.fmtVal(key, v),
              color: col
            }]
          };
          s += '<g class="barg"' + tip(t) + '>';
          s += '<rect class="hit" x="' + num(cx - bandW / 2) + '" y="' + num(hh) + '" width="' + num(bandW) + '" height="' + num(plotBot - hh) + '"/>';
          if (v != null) s += barUp(cx - bw / 2, y, bw, plotBot - y, col, ' class="bar up"' + sAttr('main') + ' style="animation-delay:' + i * 26 + 'ms"');
          s += '</g>';
          if (v != null && lblAt(i, ser.length - 1, step)) s += txt(cx, y - VAL_DY, CD.fmtVal(key, v), valOpt({
            delay: 240 + i * 26,
            s: 'main'
          }));
        });
        return svg(w, h, s);
      }
      function drawDiverge(a, w, h) {
        var up = a.up,
          down = a.down,
          o = a.opt || {};
        var upKey = o.upKey || a.upKey,
          downKey = o.downKey || a.downKey;
        var upName = o.upName || (CD.METRIC_BY_KEY[upKey] || {}).name || 'Пришли';
        var downName = o.downName || (CD.METRIC_BY_KEY[downKey] || {}).name || 'Ушли';
        var hh = headH(o.title, o.legend);
        h = h || o.h || 320;
        var top = hh + LBL_ROOM,
          bot = h - AXIS_H;
        var off = offOf(o);
        var showUp = !off.has('up'),
          showDn = !off.has('dn');
        var x0 = PAD_X,
          plotW = w - PAD_X * 2,
          bandW = plotW / CD.N;
        var zero, armUp, armDn, max;
        if (showUp && showDn) {
          zero = top + (bot - top) / 2;
          armUp = armDn = Math.max(8, (bot - top) / 2 - LBL_ROOM);
          max = niceMax(up.concat(down));
        } else if (showUp) {
          zero = bot;
          armUp = Math.max(8, bot - top);
          armDn = 0;
          max = niceMax(up);
        } else {
          zero = top;
          armUp = 0;
          armDn = Math.max(8, bot - top - LBL_ROOM);
          max = niceMax(down);
        }
        var bw = Math.min(40, bandW * 0.58);
        var step = Math.max(labelStep(up, upKey, bandW), labelStep(down, downKey, bandW));
        var s = header(w, o.title, o.legend, {
          kind: 'diverge',
          off: o.off
        });
        s += axisX(x0, bandW, top, bot, bot + 15);
        s += line(x0, zero, x0 + plotW, zero, C_ZERO, 1);
        up.forEach(function (v, i) {
          var cx = x0 + bandW * (i + 0.5);
          var hu = showUp ? v / max * armUp : 0,
            hd = showDn ? down[i] / max * armDn : 0;
          var t = {
            title: mLabel(i),
            rows: (showUp ? [{
              label: upName,
              value: CD.fmtVal(upKey, v),
              color: C_IN
            }] : []).concat(showDn ? [{
              label: downName,
              value: CD.fmtVal(downKey, down[i]),
              color: C_OUT
            }] : [])
          };
          s += '<g class="barg"' + tip(t) + '>';
          s += '<rect class="hit" x="' + num(cx - bandW / 2) + '" y="' + num(hh) + '" width="' + num(bandW) + '" height="' + num(bot - hh) + '"/>';
          if (showUp) s += barUp(cx - bw / 2, zero - hu, bw, hu, C_IN, ' class="bar up"' + sAttr('up') + ' style="animation-delay:' + i * 26 + 'ms"');
          if (showDn) s += barDown(cx - bw / 2, zero, bw, hd, C_OUT, ' class="bar dn"' + sAttr('dn') + ' style="animation-delay:' + i * 26 + 'ms"');
          s += '</g>';
          var lb = lblAt(i, up.length - 1, step);
          if (showUp && lb) s += txt(cx, zero - hu - VAL_DY, CD.fmtVal(upKey, v), valOpt({
            delay: 240 + i * 26,
            s: 'up'
          }));
          if (showDn && lb) s += txt(cx, Math.min(zero + hd + VAL_DY + 4, bot - 2), CD.fmtVal(downKey, down[i]), valOpt({
            delay: 240 + i * 26,
            s: 'dn'
          }));
        });
        return svg(w, h, s);
      }
      function drawPanels(a, w, h) {
        var ps = a.panels,
          o = a.opt || {};
        var x0 = PAD_X,
          plotW = w - PAD_X * 2,
          bandW = plotW / CD.N;
        var GAP = STACK_GAP;
        var HEAD = 16;
        var PLOT_MIN = 70;
        var minPanel = HEAD + LBL_ROOM + PLOT_MIN + AXIS_H + GAP;
        h = Math.max(h || o.h || 340, ps.length * minPanel + 14);
        var panelH = (h - 14) / ps.length;
        var s = '';
        ps.forEach(function (p, pi) {
          var base = pi * panelH;
          var top = base + HEAD + LBL_ROOM;
          var bot = base + panelH - AXIS_H - GAP;
          var max = niceMax(p.series);
          var Y = function Y(v) {
            return bot - v / max * (bot - top);
          };
          var nm = CD.METRIC_BY_KEY[p.key] || {};
          s += txt(0, base + 11, p.name, {
            size: TTL_SZ,
            weight: TTL_W,
            fill: C_INK,
            anchor: 'start'
          });
          s += line(x0, bot, x0 + plotW, bot, C_ZERO, 1);
          CD.MONTHS.forEach(function (m, i) {
            if (m.isYearStart && i > 0) s += line(x0 + bandW * i, top, x0 + bandW * i, bot, C_DIV, 1, '4 3');
          });
          var pd = pi * 140,
            step = labelStep(p.series, p.key, bandW),
            last = p.series.length - 1;
          if (p.type === 'line') {
            var d = polyD(p.series, function (i) {
              return x0 + bandW * (i + 0.5);
            }, Y);
            s += '<path class="ln" pathLength="1" d="' + d + '" fill="none" stroke="' + (p.color || C_LINE) + '"' + ' stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"' + ' style="animation-delay:' + pd + 'ms"/>';
            p.series.forEach(function (v, i) {
              var cx = x0 + bandW * (i + 0.5),
                cy = Y(v);
              var t = {
                title: mLabel(i),
                rows: [{
                  label: p.name,
                  value: CD.fmtVal(p.key, v),
                  color: p.color || C_LINE
                }]
              };
              var dly = pd + DRAW_MS * (i / Math.max(1, p.series.length - 1)) * 0.9;
              s += '<g class="ptg"' + tip(t) + '>';
              s += '<rect class="hit" x="' + num(cx - bandW / 2) + '" y="' + num(top - 12) + '" width="' + num(bandW) + '" height="' + num(bot - top + 12) + '"/>';
              if (v != null) s += '<circle class="dot" cx="' + num(cx) + '" cy="' + num(cy) + '" r="3.1" fill="#fff" stroke="' + (p.color || C_LINE) + '"' + ' stroke-width="1.9" style="animation-delay:' + num(dly) + 'ms"/>';
              s += '</g>';
              if (v != null && lblAt(i, last, step)) s += txt(cx, cy - VAL_DY, CD.fmtVal(p.key, v), valOpt({
                delay: dly
              }));
            });
          } else {
            var bw = Math.min(42, bandW * 0.64);
            p.series.forEach(function (v, i) {
              var cx = x0 + bandW * (i + 0.5),
                y = Y(v);
              var t = {
                title: mLabel(i),
                rows: [{
                  label: p.name,
                  value: CD.fmtVal(p.key, v),
                  color: p.color || C_LINE
                }]
              };
              s += '<g class="barg"' + tip(t) + '>';
              s += '<rect class="hit" x="' + num(cx - bandW / 2) + '" y="' + num(top - 12) + '" width="' + num(bandW) + '" height="' + num(bot - top + 12) + '"/>';
              s += barUp(cx - bw / 2, y, bw, bot - y, p.color || C_LINE, ' class="bar up" style="animation-delay:' + (pd + i * 24) + 'ms"');
              s += '</g>';
              if (lblAt(i, last, step)) s += txt(cx, y - VAL_DY, CD.fmtVal(p.key, v), valOpt({
                delay: pd + 300 + i * 24
              }));
            });
          }
          s += axisX(x0, bandW, bot, bot, bot + 15);
        });
        return svg(w, h, s);
      }
      function drawWaterfall(a, w, h) {
        var steps = a.steps,
          o = a.opt || {};
        var hh = headH(o.title, o.legend);
        h = h || o.h || 320;
        var plotTop = hh + LBL_ROOM,
          plotBot = h - AXIS_H;
        var x0 = PAD_X,
          plotW = w - PAD_X * 2,
          bandW = plotW / steps.length;
        var acc = 0;
        var lv = [];
        steps.forEach(function (st) {
          if (st.total) {
            acc = st.value;
            lv.push({
              from: 0,
              to: st.value,
              total: true
            });
          } else {
            var from = acc;
            acc += st.value;
            lv.push({
              from: from,
              to: acc,
              total: false
            });
          }
        });
        var max = niceMax(lv.map(function (x) {
          return Math.max(x.from, x.to);
        }));
        var Y = function Y(v) {
          return plotBot - v / max * (plotBot - plotTop);
        };
        var bw = Math.min(74, bandW * 0.62);
        var s = header(w, o.title, o.legend, {
          kind: 'waterfall'
        });
        s += line(x0, plotBot, x0 + plotW, plotBot, C_ZERO, 1);
        steps.forEach(function (st, i) {
          var cx = x0 + bandW * (i + 0.5),
            g = lv[i];
          var yTop = Y(Math.max(g.from, g.to)),
            yBot = Y(Math.min(g.from, g.to));
          var col = st.total ? C_TOTAL : st.value >= 0 ? C_IN : C_OUT;
          var sid = st.total ? 'total' : st.value >= 0 ? 'in' : 'out';
          var lab = (st.total ? '' : st.value > 0 ? '+' : '') + CD.fmtInt(st.value);
          var t = {
            title: st.name,
            rows: [{
              label: st.total ? 'Уровень' : 'Изменение',
              value: lab,
              color: col
            }],
            note: st.total ? null : 'накоплено: ' + CD.fmtInt(g.to) + ' чел'
          };
          s += '<g class="barg"' + tip(t) + '>';
          s += '<rect class="hit" x="' + num(cx - bandW / 2) + '" y="' + num(hh) + '" width="' + num(bandW) + '" height="' + num(plotBot - hh) + '"/>';
          s += barUp(cx - bw / 2, yTop, bw, Math.max(2, yBot - yTop), col, ' class="bar up"' + sAttr(sid) + ' style="animation-delay:' + i * 34 + 'ms"');
          s += '</g>';
          s += txt(cx, yTop - VAL_DY, lab, valOpt({
            delay: 240 + i * 34,
            s: sid
          }));
          s += txt(cx, plotBot + 15, st.name, {
            size: 10.5,
            fill: C_AXIS
          });
          if (i < steps.length - 1) s += line(cx + bw / 2, Y(g.to), x0 + bandW * (i + 1.5) - bw / 2, Y(g.to), C_DIV, 1, '3 2');
        });
        return svg(w, h, s);
      }
      function drawFunnel(a, w, h) {
        var items = a.items,
          o = a.opt || {};
        var hh = headH(o.title, o.legend);
        var n = items.length;
        h = h || o.h || hh + n * 62 + 16;
        var rowH = (h - hh - 12) / n;
        var max = niceMax(items.map(function (x) {
          return x.value;
        }));
        var cx = w / 2;
        var sideW = 64;
        var maxBar = Math.max(60, w - sideW * 2 - 20);
        var s = header(w, o.title, o.legend);
        items.forEach(function (it, i) {
          var y = hh + i * rowH + 16,
            bh = Math.max(14, rowH - 26);
          var bwv = it.value / max * maxBar;
          var conv = i > 0 && items[i - 1].value ? it.value / items[i - 1].value * 100 : null;
          var t = {
            title: it.name,
            rows: [{
              label: 'Значение',
              value: CD.fmtInt(it.value),
              color: PALETTE[i % PALETTE.length]
            }],
            note: [conv != null ? 'конверсия с предыдущего этапа: ' + conv.toFixed(0) + '%' : null, 'от первого этапа: ' + (items[0].value ? (it.value / items[0].value * 100).toFixed(0) : '—') + '%']
          };
          s += txt(cx, y - 4, it.name, {
            size: 11,
            weight: 400,
            fill: C_AXIS
          });
          s += '<g class="barg"' + tip(t) + '>';
          s += '<rect class="hit" x="0" y="' + num(y - 14) + '" width="' + num(w) + '" height="' + num(bh + 18) + '"/>';
          s += rect(cx - bwv / 2, y, bwv, bh, PALETTE[i % PALETTE.length], 3, ' class="bar fn" style="animation-delay:' + i * 40 + 'ms"');
          s += '</g>';
          s += txt(cx - bwv / 2 - 8, y + bh * 0.72, CD.fmtInt(it.value), valOpt({
            anchor: 'end',
            delay: 200 + i * 40
          }));
          if (conv != null) s += txt(cx + bwv / 2 + 8, y + bh * 0.72, conv.toFixed(0) + '%', valOpt({
            anchor: 'start',
            delay: 200 + i * 40
          }));
          if (i < n - 1) {
            var nb = items[i + 1].value / max * maxBar,
              ny = hh + (i + 1) * rowH + 16;
            s += '<path class="fnlink" d="M' + num(cx - bwv / 2) + ' ' + num(y + bh) + 'L' + num(cx - nb / 2) + ' ' + num(ny) + 'M' + num(cx + bwv / 2) + ' ' + num(y + bh) + 'L' + num(cx + nb / 2) + ' ' + num(ny) + '" fill="none" stroke="' + C_DIV + '" stroke-width="1"/>';
          }
        });
        return svg(w, h, s);
      }
      function sparkSvg(w, h, body) {
        return '<svg viewBox="0 0 ' + num(w) + ' ' + num(h) + '" width="100%" height="' + num(h) + '"' + ' preserveAspectRatio="none" class="spark" role="img" style="display:block">' + body + '</svg>';
      }
      function stateColor(st) {
        return st === 'good' ? C_GREEN : st === 'bad' ? C_RED : C_FLAT;
      }
      function cmpRow(key, i, base, kpi) {
        if (kpi) return [{
          label: 'цель KPI',
          value: CD.fmtVal(key, kpi.green),
          color: C_BENCH,
          dash: true
        }];
        return base ? [{
          label: 'база',
          value: CD.fmtVal(key, base[i]),
          color: C_BENCH,
          dash: true
        }] : [];
      }
      function cmpState(key, v, i, base, kpi, flat, state) {
        if (kpi) return CD.stateForKpi(key, v, kpi);
        return flat || !base || !key ? state : CD.compareState(key, v, base[i]);
      }
      function sparkBars(series, state, w, h, o) {
        o = o || {};
        w = w || 120;
        h = h || 26;
        var n = series.length,
          gap = w / n,
          bw = gap * 0.68;
        var key = o.key,
          base = o.base,
          flat = o.flat,
          kpi = o.kpi;
        var vals = series.filter(function (v) {
          return v != null;
        });
        var mn = vals.length ? Math.min.apply(null, vals) : 0,
          mx = vals.length ? Math.max.apply(null, vals) : 0,
          rng = mx - mn;
        var lo = 0,
          hi = niceMax(series);
        if (rng > 0 && mx > 0 && rng / mx < 0.4) {
          lo = Math.max(0, mn - rng * 0.45);
          hi = mx + rng * 0.12;
        }
        var span = hi - lo || 1;
        var s = '';
        series.forEach(function (v, i) {
          if (v == null) return;
          var bh = Math.max(1.5, (v - lo) / span * (h - 2));
          var st = cmpState(key, v, i, base, kpi, flat, state);
          var t = key ? {
            title: mLabel(i),
            rows: [{
              label: (CD.METRIC_BY_KEY[key] || {}).name || '',
              value: CD.fmtVal(key, v),
              color: stateColor(st)
            }].concat(cmpRow(key, i, base, kpi))
          } : null;
          s += '<g class="sbg"' + (t ? tip(t) : '') + '>';
          s += '<rect class="hit" x="' + num(i * gap) + '" y="0" width="' + num(gap) + '" height="' + num(h) + '"/>';
          s += rect(i * gap + (gap - bw) / 2, h - bh, bw, bh, stateColor(st), 1, ' class="sb"');
          s += '</g>';
        });
        return sparkSvg(w, h, s);
      }
      function sparkLine(series, state, w, h, o) {
        o = o || {};
        w = w || 120;
        h = h || 26;
        var n = series.length;
        var col = o.ink ? C_SPARK_INK : stateColor(state),
          key = o.key,
          base = o.base,
          kpi = o.kpi;
        var vals = series.filter(function (v) {
          return v != null;
        });
        var mn = vals.length ? Math.min.apply(null, vals) : 0,
          mx = vals.length ? Math.max.apply(null, vals) : 0,
          rg = mx - mn;
        var lo = 0,
          max = niceMax(series);
        if (o.fit && rg > 0 && mx > 0 && rg / mx < 0.4) {
          lo = Math.max(0, mn - rg * 0.45);
          max = mx + rg * 0.12;
        }
        if (mn < 0) {
          lo = mn;
          max = Math.max(mx, 0) + (rg || 1) * 0.08;
        }
        var PAD = 3.5,
          TOP = 3.5;
        var X = function X(i) {
          return n > 1 ? PAD + i / (n - 1) * (w - 2 * PAD) : w / 2;
        };
        var Y = function Y(v) {
          return h - PAD - (v - lo) / (max - lo || 1) * (h - PAD - TOP);
        };
        var s = '<path d="' + polyD(series, X, Y) + '" fill="none" stroke="' + col + '" stroke-width="1.7"' + ' stroke-linejoin="round" stroke-linecap="round"/>';
        if (series[n - 1] != null) s += '<circle cx="' + num(X(n - 1)) + '" cy="' + num(Y(series[n - 1])) + '" r="' + (o.ink ? 2.6 : 2) + '" fill="' + col + '"/>';
        if (key) series.forEach(function (v, i) {
          if (v == null) return;
          var gapw = w / n,
            cx = X(i),
            cy = Y(v);
          var t = {
            title: mLabel(i),
            rows: [{
              label: (CD.METRIC_BY_KEY[key] || {}).name || '',
              value: CD.fmtVal(key, v),
              color: col
            }].concat(cmpRow(key, i, base, kpi))
          };
          s += '<g class="spg"' + tip(t) + '>';
          s += '<rect class="hit" x="' + num(i * gapw) + '" y="0" width="' + num(gapw) + '" height="' + num(h) + '"/>';
          s += '<line class="spgd" x1="' + num(cx) + '" y1="0" x2="' + num(cx) + '" y2="' + num(h) + '" stroke="' + col + '"/>';
          s += '<circle class="spdot" cx="' + num(cx) + '" cy="' + num(cy) + '" r="2.6" fill="#fff" stroke="' + col + '" stroke-width="1.6"/>';
          s += '</g>';
        });
        return sparkSvg(w, h, s);
      }
      var CAL_LO = [238, 244, 255],
        CAL_HI = [36, 95, 212];
      function mixRGB(a, b, t) {
        var c = [0, 1, 2].map(function (i) {
          return Math.round(a[i] + (b[i] - a[i]) * t);
        });
        return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      }
      function heat(t) {
        return mixRGB(CAL_LO, CAL_HI, Math.max(0, Math.min(1, t || 0)));
      }
      function heatInk(t) {
        return (t || 0) > 0.58 ? '#ffffff' : C_LABEL;
      }
      function drawCalendar(a, w, h) {
        var blocks = a.blocks || [a.cal],
          o = a.opt || {};
        var hh = headH(o.title, o.legend);
        var DOW_H = HEAD_GAP + 9,
          SCALE_H = 26,
          MON_H = 17,
          gap = 4,
          BLOCK_GAP = 22;
        var n = blocks.length;
        var rows = Math.max.apply(null, blocks.map(function (b) {
          return Math.ceil((b.first + b.days.length) / 7);
        }));
        var hBox = h || o.h || 0;
        var scaleY = hh + 6,
          gridTop = hh + SCALE_H + MON_H + DOW_H;
        var CELL_MAX = 72;
        var CAL_PAD = 16;
        var availW = (w - CAL_PAD * 2 - BLOCK_GAP * (n - 1)) / n;
        var byH = hBox ? (hBox - gridTop - gap * (rows - 1)) / rows : CELL_MAX;
        var cell = Math.max(22, Math.min(CELL_MAX, (availW - gap * 6) / 7, byH));
        var cw = cell,
          ch = cell;
        var gridW = cw * 7 + gap * 6,
          totalW = gridW * n + BLOCK_GAP * (n - 1);
        var x0 = Math.max(CAL_PAD, (w - totalW) / 2);
        var hUsed = gridTop + rows * ch + (rows - 1) * gap;
        var allWd = blocks.reduce(function (acc, b) {
          return acc.concat(b.days.filter(function (d) {
            return !d.weekend;
          }).map(function (d) {
            return d.val;
          }));
        }, []);
        var max = niceMax(allWd);
        var num1 = function num1(v) {
          return (+v).toFixed(1).replace('.', ',');
        };
        var showVal = cw >= 30 && ch >= 22,
          showDay = ch >= 34 && cw >= 34;
        var s = header(w, o.title, o.legend);
        blocks.forEach(function (b, bi) {
          var bx = x0 + bi * (gridW + BLOCK_GAP);
          s += txt(bx, hh + SCALE_H + 12, b.label + ' ' + b.y, {
            size: TTL_SZ,
            weight: TTL_W,
            fill: C_INK,
            anchor: 'start'
          });
          CD.DOW_SHORT.forEach(function (d, i) {
            s += txt(bx + i * (cw + gap) + cw / 2, gridTop - 6, d, {
              size: 10,
              weight: 700,
              fill: i >= 5 ? C_AXIS : C_LABEL
            });
          });
          b.days.forEach(function (d, di) {
            var idx = b.first + di,
              x = bx + idx % 7 * (cw + gap),
              y = gridTop + Math.floor(idx / 7) * (ch + gap);
            var t = Math.max(0, Math.min(1, d.val / max));
            var fill = d.weekend ? '#f4f5f7' : mixRGB(CAL_LO, CAL_HI, t);
            var ink = d.weekend ? C_AXIS : t > 0.62 ? '#fff' : C_LABEL;
            var dly = bi * 40 + di * 9;
            s += '<g class="barg"' + tip({
              title: d.day + ' ' + CD.MONTH_GEN[b.m] + ' ' + b.y + ', ' + CD.DOW_NAME[d.dow].toLowerCase(),
              rows: [{
                label: 'Посещаемость',
                value: num1(d.val) + ' %',
                color: fill
              }],
              note: d.weekend ? 'выходной: офис работает по дежурствам' : 'среднее по будням месяца: ' + num1(b.base) + ' %'
            }) + '>';
            s += rect(x, y, cw, ch, fill, 7, ' class="fade" style="animation-delay:' + dly + 'ms"');
            if (showDay) s += txt(x + 6, y + 13, String(d.day), {
              size: 9.5,
              weight: 400,
              fill: ink,
              anchor: 'start',
              cls: 'fade',
              delay: dly
            });
            if (showVal) s += txt(x + cw / 2, y + (showDay ? ch / 2 + 9 : ch / 2 + 4), num1(d.val), {
              size: VAL_SZ,
              weight: VAL_W,
              fill: ink,
              cls: 'fade',
              delay: 60 + dly
            });
            s += '</g>';
          });
        });
        var sy = scaleY,
          sw = 17,
          sh = 10;
        var x = x0;
        s += txt(x, sy + 9, 'реже', {
          size: 10.5,
          fill: C_AXIS,
          anchor: 'start'
        });
        x += textW('реже', 10.5) + 7;
        for (var i = 0; i < 5; i++) {
          s += rect(x, sy, sw, sh, mixRGB(CAL_LO, CAL_HI, i / 4), 2);
          x += sw + 3;
        }
        x += 4;
        s += txt(x, sy + 9, 'чаще, до ' + num1(max) + ' %', {
          size: 10.5,
          fill: C_AXIS,
          anchor: 'start'
        });
        x += textW('чаще, до ' + num1(max) + ' %', 10.5) + 16;
        s += rect(x, sy, sw, sh, '#f4f5f7', 2);
        x += sw + 6;
        s += txt(x, sy + 9, 'выходной', {
          size: 10.5,
          fill: C_AXIS,
          anchor: 'start'
        });
        return svg(w, hUsed, s);
      }
      var KINDS = {
        line: drawLine,
        yoy: drawYoy,
        bars: drawBars,
        diverge: drawDiverge,
        panels: drawPanels,
        waterfall: drawWaterfall,
        funnel: drawFunnel,
        calendar: drawCalendar
      };
      var NOMINAL_W = 900,
        NOMINAL_H = null;
      var _specs = new Map(),
        _sid = 0;
      var _off = new Map();
      function build(spec, w, h) {
        return KINDS[spec.kind](spec.args, Math.max(320, w), h || null);
      }
      function chart(kind, args, opt) {
        opt = Object.assign({}, opt || {});
        var id = 'k' + ++_sid;
        opt._key = kind + '|' + (opt.title || '') + '|' + id;
        opt.off = _off.get(opt._key) || new Set();
        var spec = {
          kind: kind,
          args: Object.assign({}, args, {
            opt: opt
          }),
          opt: opt
        };
        _specs.set(id, spec);
        return '<div class="svgchart' + (opt.fill ? ' fill' : '') + '" data-cid="' + id + '">' + build(spec, NOMINAL_W, NOMINAL_H) + '</div>';
      }
      function remeasure(root, animate) {
        if (!root || !root.querySelectorAll) return;
        var nodes = root.querySelectorAll('.svgchart[data-cid]');
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i],
            sp = _specs.get(el.getAttribute('data-cid'));
          if (!sp) continue;
          var w = el.clientWidth || el.parentNode && el.parentNode.clientWidth || NOMINAL_W;
          var h = sp.opt.fill ? el.clientHeight || sp.opt.h || null : sp.opt.h || null;
          el.innerHTML = build(sp, w, h);
          if (animate) {
            el.classList.remove('anim');
            void el.offsetWidth;
            el.classList.add('anim');
          }
        }
      }
      function redraw(cid, hi) {
        if (typeof document === 'undefined') return;
        var el = document.querySelector('.svgchart[data-cid="' + cid + '"]');
        var sp = _specs.get(cid);
        if (!el || !sp) return;
        var w = el.clientWidth || el.parentNode && el.parentNode.clientWidth || NOMINAL_W;
        var h = sp.opt.fill ? el.clientHeight || sp.opt.h || null : sp.opt.h || null;
        el.innerHTML = build(sp, w, h);
        highlight(el, hi);
      }
      function highlight(el, sid) {
        if (!el || !el.querySelectorAll) return;
        var all = el.querySelectorAll('[data-s]');
        for (var i = 0; i < all.length; i++) all[i].classList.remove('hi');
        if (!sid) {
          el.removeAttribute('data-hi');
          return;
        }
        el.setAttribute('data-hi', sid);
        var on = el.querySelectorAll('[data-s="' + sid + '"]');
        for (var _i1 = 0; _i1 < on.length; _i1++) on[_i1].classList.add('hi');
      }
      function toggleSeries(cid, sid) {
        var sp = _specs.get(cid);
        if (!sp || !sid || LOCKED[sp.kind]) return false;
        var ids = seriesOf(sp.kind, sp.opt.legend).filter(Boolean);
        if (ids.indexOf(sid) < 0) return false;
        var off = sp.opt.off;
        if (off.has(sid)) off.delete(sid);else if (ids.length - off.size <= 1) return false;else off.add(sid);
        _off.set(sp.opt._key, off);
        redraw(cid, null);
        return true;
      }
      function reset() {
        _specs = new Map();
        _sid = 0;
      }
      window.TPDRAW = {
        chart: chart,
        remeasure: remeasure,
        redraw: redraw,
        highlight: highlight,
        toggleSeries: toggleSeries,
        reset: reset,
        seriesOf: seriesOf,
        SERIES: SERIES,
        LOCKED: LOCKED,
        sparkBars: sparkBars,
        sparkLine: sparkLine,
        niceMax: niceMax,
        textW: textW,
        esc: esc,
        stateColor: stateColor,
        tipHtml: tipHtml,
        heat: heat,
        heatInk: heatInk,
        FONT: FONT,
        PALETTE: PALETTE,
        C_LINE: C_LINE,
        C_BENCH: C_BENCH,
        C_PREV: C_PREV,
        C_GREEN: C_GREEN,
        C_RED: C_RED,
        C_IN: C_IN,
        C_OUT: C_OUT,
        C_LABEL: C_LABEL,
        C_AXIS: C_AXIS,
        C_DIV: C_DIV,
        C_TOTAL: C_TOTAL,
        C_HIRE: C_HIRE,
        C_HIRE_D: C_HIRE_D,
        C_HIRE_I: C_HIRE_I,
        C_FIRE: C_FIRE,
        C_TR_IN: C_TR_IN,
        C_TR_OUT: C_TR_OUT,
        C_CNT: C_CNT,
        C_OTHER: C_OTHER,
        C_FLAT: C_FLAT,
        C_VAC: C_VAC,
        C_UNDER: C_UNDER,
        C_LOWPERF: C_LOWPERF,
        C_OFFICE: C_OFFICE,
        C_REGRET: C_REGRET,
        C_NOREG: C_NOREG,
        C_TURN_Y: C_TURN_Y,
        C_AI: C_AI
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        G = window.TPDRAW;
      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
          return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
          }[c];
        });
      }
      function plural(n, forms) {
        var a = Math.abs(n) % 100,
          b = a % 10;
        return forms[a > 4 && a < 21 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2];
      }
      var _tipEl = null,
        _tipFor = null;
      function tipNode() {
        if (!_tipEl) {
          _tipEl = document.createElement('div');
          _tipEl.className = 'tip';
          _tipEl.setAttribute('role', 'tooltip');
          document.body.appendChild(_tipEl);
        }
        return _tipEl;
      }
      function placeTip(el, x, y) {
        var w = el.offsetWidth || 220,
          h = el.offsetHeight || 60;
        var left = x + 16,
          top = y - h - 14;
        if (left + w > window.innerWidth - 10) left = x - w - 16;
        if (left < 10) left = 10;
        if (top < 10) top = y + 20;
        el.style.left = Math.round(left) + 'px';
        el.style.top = Math.round(top) + 'px';
      }
      function showTip(target, x, y) {
        var el = tipNode();
        if (_tipFor !== target) {
          _tipFor = target;
          el.innerHTML = target.getAttribute('data-tip') || '';
        }
        el.classList.add('on');
        placeTip(el, x, y);
      }
      function hideTip() {
        if (_tipEl) {
          _tipEl.classList.remove('on');
        }
        _tipFor = null;
      }
      function tipTarget(e) {
        var t = e.target;
        return t && t.closest ? t.closest('[data-tip]') : null;
      }
      function bindTips() {
        if (!document.addEventListener) return;
        var E = window.TP_ENV,
          on = function on(t, ty, fn, o) {
            return E ? E.on(t, ty, fn, o) : t.addEventListener(ty, fn, o);
          };
        on(document, 'mousemove', function (e) {
          var t = tipTarget(e);
          if (t) showTip(t, e.clientX, e.clientY);else if (_tipFor) hideTip();
        }, {
          passive: true
        });
        on(document, 'mouseleave', hideTip, true);
        on(document, 'click', hideTip, true);
        on(window, 'scroll', hideTip, true);
      }
      bindTips();
      function tipAttr(o) {
        return ' data-tip="' + esc(G.tipHtml(o)) + '"';
      }
      var tip = tipAttr;
      function deltaChip(key, dv, o) {
        var m = D.METRIC_BY_KEY[key];
        var vs = o && o.vs ? '<span class="d-vs">' + esc(o.vs) + '</span>' : '';
        var at = o && o.tip ? tipAttr(o.tip) : '';
        if (dv == null) return '<span class="delta flat"' + at + '>—' + vs + '</span>';
        if (dv === 0) return '<span class="delta flat"' + at + '>0' + vs + '</span>';
        var txt = D.fmtDelta(key, dv);
        if (m.better === 'flat') return '<span class="delta neu"' + at + '>' + txt + vs + '</span>';
        var good = m.better === 'lower' ? dv < 0 : dv > 0;
        return '<span class="delta ' + (good ? 'up' : 'down') + '"' + at + '>' + txt + vs + '</span>';
      }
      function momChip(key, dv) {
        return deltaChip(key, dv, {
          vs: D.CMP.momShort,
          tip: D.CMP.momTip
        });
      }
      function icoExt() {
        return '<svg class="ico-ext" viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" ' + 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + '<path d="M8.4 2.4h3.2v3.2"/><path d="M11.6 2.4 6.9 7.1"/>' + '<path d="M9.7 8.3v2.2a1.1 1.1 0 0 1-1.1 1.1H3.5a1.1 1.1 0 0 1-1.1-1.1V5.4a1.1 1.1 0 0 1 1.1-1.1h2.2"/></svg>';
      }
      function icoOpen() {
        return '<svg class="ico-open" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" ' + 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + '<path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/><path d="M9 16l4-4-4-4"/><path d="M13 12H3"/></svg>';
      }
      function openUnitBtn(path, name, label) {
        return '<button class="open-unit' + (label ? ' with-label' : '') + '" data-openunit="' + esc(path) + '" aria-label="Открыть «' + esc(name) + '»"' + tipAttr({
          title: 'Открыть юнит',
          text: 'Отчёт встанет на «' + name + '»: карточки, таблица на три уровня ниже него, one-pager и ссылка — по нему. ' + 'База сравнения не меняется.',
          note: 'Вернуться — «← Назад» или путь над отчётом.'
        }) + '>' + icoOpen() + (label ? esc(label) : '') + '</button>';
      }
      function icoExpand() {
        return '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" ' + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
      }
      function icoShrink() {
        return '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" ' + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7"/></svg>';
      }
      function splitBtn(side, mode, name) {
        var wide = mode === side;
        var lbl = wide ? 'Вернуть две колонки' : name + ' во всю ширину';
        return '<button class="split-btn' + (wide ? ' on' : '') + '" data-splitmode="' + (wide ? 'both' : side) + '" aria-label="' + esc(lbl) + '"' + tipAttr({
          title: lbl,
          text: wide ? 'Таблица подразделений слева, содержимое вкладки справа.' : (side === 'table' ? 'Правая панель' : 'Таблица подразделений') + ' свернётся в полосу у края — клик по ней вернёт обе колонки.',
          note: 'Ширину колонок можно и тянуть — за разделитель между ними; двойной клик возвращает как было.'
        }) + '>' + (wide ? icoShrink() : icoExpand()) + '</button>';
      }
      function splitRail(pos, label) {
        return '<button class="split-rail ' + pos + '" data-splitmode="both" aria-label="Показать: ' + esc(label) + '"' + tipAttr({
          title: label,
          text: 'Вернуть две колонки: таблица слева, графики справа.'
        }) + '><i aria-hidden="true">' + (pos === 'l' ? '▸' : '◂') + '</i><span>' + esc(label) + '</span></button>';
      }
      function splitGut(share) {
        return '<div class="split-gut" data-split="1" role="separator" aria-orientation="vertical" ' + 'aria-label="Ширина таблицы подразделений" aria-valuemin="20" aria-valuemax="80"' + (share != null ? ' aria-valuenow="' + Math.round(share * 100) + '"' : '') + ' tabindex="0"' + tipAttr({
          title: 'Ширина колонок',
          text: 'Потяните, чтобы дать больше места таблице или графикам.',
          note: 'Двойной клик — как было; стрелки ← → — с клавиатуры.'
        }) + '><i></i></div>';
      }
      function icoSearch() {
        return '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" ' + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
      }
      function searchBox(o) {
        return '<label class="tsearch">' + icoSearch() + '<input type="search" data-tsearch="1" autocomplete="off" ' + 'placeholder="' + esc(o.placeholder) + '" aria-label="' + esc(o.placeholder) + '" value="' + esc(o.q || '') + '"></label>';
      }
      function hlText(text, q) {
        var s = String(text == null ? '' : text),
          n = String(q || '').trim().toLowerCase();
        var at = n ? s.toLowerCase().indexOf(n) : -1;
        if (at < 0) return esc(s);
        return esc(s.slice(0, at)) + '<mark class="hl">' + esc(s.slice(at, at + n.length)) + '</mark>' + esc(s.slice(at + n.length));
      }
      function rowCaret(open) {
        return '<span class="row-caret' + (open ? ' on' : '') + '"' + tipAttr({
          title: open ? 'Свернуть график' : 'Показать динамику',
          text: 'Клик по строке раскрывает график метрики за 12 месяцев прямо в таблице.'
        }) + ' aria-hidden="true">' + (open ? '▾' : '▸') + '</span>';
      }
      function allCaret(attr, val, open, tipText) {
        return '<button class="caret-btn"' + (open ? ' data-open="1"' : '') + ' ' + attr + '="' + esc(val) + '" aria-label="' + (open ? 'Свернуть всё' : 'Развернуть всё') + '"' + tipAttr({
          title: open ? 'Свернуть всё' : 'Развернуть всё',
          text: tipText
        }) + '>' + (open ? '▾' : '▸') + '</button>';
      }
      function infoDot(key) {
        var m = D.METRIC_BY_KEY[key];
        if (!m) return '';
        var dir = m.better === 'lower' ? 'снижение' : m.better === 'higher' ? 'рост' : 'нейтральная метрика';
        return '<span class="info"' + tipAttr({
          title: m.name,
          text: m.hint || 'Описание метрики пока не задано.',
          note: 'Единица: ' + (m.unit || '—') + '. Позитивное направление: ' + dir + '.'
        }) + ' aria-label="О метрике">i</span>';
      }
      var NOCMP_HINT = 'Абсолютная величина зависит от размера подразделения: сравнение с базой здесь ничего не значит.';
      function noCmpMark() {
        return '<span class="nocmp"' + tipAttr({
          title: 'Сравнение отключено',
          text: NOCMP_HINT
        }) + '>не сравнивается</span>';
      }
      function targetCell(key, val, baseVal, kpi) {
        if (val == null) return '<div class="tgt">' + (kpi ? '<span class="kpi-tag">KPI</span> <b>цель ' + D.fmtVal(key, kpi.green) + '</b>' : D.comparable(key) && baseVal != null ? '<b>' + D.fmtVal(key, baseVal) + '</b>' : '') + '<span class="sig-chip neutral">нет данных</span></div>';
        if (kpi) {
          var _st = D.stateForKpi(key, val, kpi),
            _m2 = D.METRIC_BY_KEY[key];
          var badTxt = _m2.better === 'lower' ? 'выше порога' : 'ниже порога';
          return '<div class="tgt"><span class="kpi-tag">KPI</span> <b>цель ' + D.fmtVal(key, kpi.green) + '</b>' + '<span class="sig-chip ' + _st + '">' + (_st === 'good' ? 'в цели' : _st === 'warn' ? 'зона риска' : badTxt) + '</span></div>';
        }
        if (!D.comparable(key)) return '<div class="tgt">' + noCmpMark() + '</div>';
        if (baseVal == null) return '<div class="tgt">—</div>';
        var st = D.compareState(key, val, baseVal),
          diff = val - baseVal,
          m = D.METRIC_BY_KEY[key];
        var lbl = m.better === 'flat' ? Math.abs(diff) < 0.05 ? 'как база' : diff > 0 ? 'выше базы' : 'ниже базы' : st === 'good' ? 'лучше базы' : st === 'bad' ? 'хуже базы' : 'на уровне';
        return '<div class="tgt"><b>' + D.fmtVal(key, baseVal) + '</b><span class="sig-chip ' + st + '">' + lbl + '</span></div>';
      }
      function aiBlock(id, title, lead, bullets, open, cls) {
        var plain = String(lead).replace(/<[^>]+>/g, '');
        return '<div class="ai' + (cls ? ' ' + cls : '') + '"><div class="ai-h" data-ai="' + id + '">' + aiIco(open) + '<span class="ai-t">' + esc(title) + '</span>' + '<span class="ai-lead">' + (open ? '' : esc(plain)) + '</span>' + '<span class="ai-tag">' + (open ? 'свернуть' : 'подробнее') + '</span>' + '<span class="ai-caret">' + (open ? '▲' : '▼') + '</span></div>' + (open ? '<div class="ai-b">' + lead + '<ul>' + bullets.map(function (b) {
          return '<li>' + b + '</li>';
        }).join('') + '</ul></div>' : '') + '</div>';
      }
      function aiIco(big) {
        var M = window.TPMASCOT;
        var im = M ? M.img('ai', big ? 54 : 36, {
          alt: 'AI-подсказка Пульса'
        }) : '';
        return im ? '<span class="ai-ico pic' + (big ? ' big' : '') + '">' + im + '</span>' : '<span class="ai-ico">AI</span>';
      }
      function detailSplit(left, right) {
        return '<div class="detail-split"><div class="dsplit">' + left + '</div><div class="dsplit">' + right + '</div></div>';
      }
      function dynSwitch(mode) {
        var it = [['roll', '12 мес'], ['yoy', 'Год к году']];
        return '<div class="dyn-switch" role="tablist">' + it.map(function (_ref5) {
          var _ref6 = _slicedToArray(_ref5, 2),
            k = _ref6[0],
            n = _ref6[1];
          return '<button class="' + (mode === k ? 'on' : '') + '" data-dyn="' + k + '" data-text="' + esc(n) + '" role="tab" aria-selected="' + (mode === k) + '">' + n + '</button>';
        }).join('') + '</div>';
      }
      function kpiCard(o) {
        return '<div class="kpi"><div class="k-label">' + esc(o.label) + (o.tag || '') + (o.q || '') + '</div>' + '<div class="k-val">' + o.value + '</div>' + '<div class="k-row">' + (o.row1 || '') + '</div>' + '<div class="k-row">' + (o.row2 || '') + '</div>' + '<div class="k-row k-yoy">' + (o.row3 || '') + '</div></div>';
      }
      function barTable(o) {
        var items = o.items.slice();
        if (o.sort) items.sort(function (a, b) {
          return b.value - a.value;
        });
        var key = o.metricKey || 'hc_total';
        var topItems = items.filter(function (x) {
          return x.depth !== 2;
        });
        var sum = topItems.reduce(function (a, x) {
          return a + x.value;
        }, 0);
        var max = G.niceMax(topItems.map(function (x) {
          return x.value;
        }));
        var withShare = o.share !== false;
        var h = '<table class="ptable btable' + (o.compact ? ' dense' : '') + '">' + '<colgroup><col style="width:' + (o.compact ? '40%' : '34%') + '"><col style="width:14%">' + (withShare ? '<col style="width:11%">' : '') + '<col></colgroup>' + '<thead><tr><th class="txt">' + esc(o.head || '') + '</th>' + '<th>' + esc(o.valueHead || 'Значение') + '</th>' + (withShare ? '<th>Доля</th>' : '') + '<th class="txt bar-th">' + esc(o.barHead || 'Распределение') + '</th></tr></thead><tbody>';
        if (o.total !== false) {
          var allBtn = o.expAll ? allCaret('data-btexpall', o.expAll.key + '|' + (o.expAll.open ? '0' : '1'), o.expAll.open, 'Все вторые уровни разом.') : o.tree ? '<span class="caret-spacer"></span>' : '';
          h += '<tr class="total top"><td class="txt">' + (o.tree ? '<span class="row-label">' + allBtn + '<span class="row-body">ИТОГО</span></span>' : 'ИТОГО') + '</td><td class="lead">' + D.fmtVal(key, sum) + '</td>' + (withShare ? '<td>100%</td>' : '') + '<td class="barcell"></td></tr>';
        }
        items.forEach(function (x) {
          var share = sum ? x.value / sum * 100 : 0;
          var cls = [x.node || x.pick ? 'urow' : '', x.on ? 'sel' : '', x.depth === 2 ? 'lvl2' : ''].filter(Boolean).join(' ');
          var hook = (cls ? ' class="' + cls + '"' : '') + (x.node ? ' data-node="' + esc(x.node) + '"' : '') + (x.pick ? ' data-mix="' + esc(x.pick) + '"' + tipAttr({
            title: x.name,
            text: x.on ? 'Срез по этой категории уже взят. Клик снимает его.' : 'Клик берёт срез: численность в карточках и в таблице подразделений пересчитается по этой категории.'
          }) : '');
          var caret = !o.tree ? '' : x.exp ? '<button class="caret-btn"' + (x.open ? ' data-open="1"' : '') + ' data-btexp="' + esc(x.exp) + '"' + ' aria-label="' + (x.open ? 'Свернуть' : 'Раскрыть') + '"' + tipAttr({
            title: x.open ? 'Свернуть' : 'Раскрыть',
            text: 'Специализации внутри стрима.'
          }) + '>' + (x.open ? '▾' : '▸') + '</button>' : '<span class="caret-spacer"></span>';
          var nm = '<span class="row-body">' + (x.mark ? '<span class="rt-mark"' + tipAttr({
            title: 'Нежелательный уход',
            text: 'Причина, на которую компания могла повлиять.'
          }) + '>★</span> ' : '') + esc(x.name) + (x.note ? '<span class="unit-sub">' + esc(x.note) + '</span>' : '') + '</span>';
          h += '<tr' + hook + '>' + '<td class="txt">' + (o.tree ? '<span class="row-label">' + caret + nm + '</span>' : nm) + '</td>' + '<td class="lead">' + D.fmtVal(key, x.value) + '</td>' + (withShare ? '<td>' + share.toFixed(share < 10 ? 1 : 0).replace('.', ',') + '%</td>' : '') + '<td class="barcell"' + tipAttr({
            title: x.name,
            rows: [{
              label: o.valueHead || 'Значение',
              value: D.fmtVal(key, x.value),
              color: x.color || G.C_LINE
            }].concat(withShare ? [{
              label: 'доля',
              value: share.toFixed(share < 10 ? 1 : 0).replace('.', ',') + '%'
            }] : []),
            note: x.tip || null
          }) + '><span class="cellbar"><i style="width:' + (x.value / max * 100).toFixed(1) + '%' + (x.color ? ';background:' + x.color : '') + '"></i></span></td></tr>';
        });
        return h + '</tbody></table>';
      }
      function btGroup(o) {
        return '<div class="bt-group"><div class="bt-cap">' + esc(o.cap) + (o.tip ? '<span class="info"' + tipAttr(o.tip) + ' aria-label="О разрезе">i</span>' : '') + (o.capSub ? '<span class="bt-sub">' + esc(o.capSub) + '</span>' : '') + '</div>' + barTable(o) + '</div>';
      }
      function btStack(list) {
        return '<div class="bt-stack">' + list.join('') + '</div>';
      }
      function pct(v) {
        return v.toFixed(v < 10 && v > 0 ? 1 : 0).replace('.', ',') + '%';
      }
      function mxPick(id, name, on, cls) {
        return '<button class="mx-pick' + (on ? ' on' : '') + (cls ? ' ' + cls : '') + '" data-mix="' + esc(id) + '"' + tipAttr({
          title: name,
          text: on ? 'Срез по этой категории уже взят. Клик снимает его.' : 'Клик берёт срез по этой категории.'
        }) + '>' + esc(name) + '</button>';
      }
      function matrixTable(o) {
        var R = o.rowDim,
          C = o.colDim,
          cells = o.cells,
          mode = o.mode || 'abs';
        var sel = o.sel || new Set();
        var rowSum = cells.map(function (r) {
          return r.reduce(function (a, b) {
            return a + b;
          }, 0);
        });
        var colSum = C.cats.map(function (_, j) {
          return cells.reduce(function (a, r) {
            return a + r[j];
          }, 0);
        });
        var all = rowSum.reduce(function (a, b) {
          return a + b;
        }, 0);
        var maxCell = Math.max.apply(Math, [1].concat(_toConsumableArray(cells.map(function (r) {
          return Math.max.apply(Math, _toConsumableArray(r));
        }))));
        var shade = function shade(v, i, j) {
          return mode === 'abs' ? v / maxCell : mode === 'row' ? rowSum[i] ? v / rowSum[i] : 0 : colSum[j] ? v / colSum[j] : 0;
        };
        var pctRow = cells.map(function (r, i) {
          return rowSum[i] ? D.roundParts(r.map(function (v) {
            return v / rowSum[i] * 100;
          }), 100) : r.map(function () {
            return 0;
          });
        });
        var pctCol = C.cats.map(function (_, j) {
          return colSum[j] ? D.roundParts(cells.map(function (r) {
            return r[j] / colSum[j] * 100;
          }), 100) : cells.map(function () {
            return 0;
          });
        });
        var show = function show(v, i, j) {
          return mode === 'abs' ? D.fmtInt(v) : mode === 'row' ? rowSum[i] ? pctRow[i][j] + '%' : '—' : colSum[j] ? pctCol[j][i] + '%' : '—';
        };
        var h = (o.cap ? '<div class="mx-cap">' + esc(o.cap) + '</div>' : '') + '<div class="mx-wrap"><table class="ptable mxtable dense">' + '<thead><tr><th class="txt mx-corner"><span class="mx-r">' + esc(R.short || R.name) + '</span>' + '<span class="mx-c">' + esc(C.short || C.name) + ' →</span></th>' + C.cats.map(function (c) {
          return '<th class="mx-h">' + mxPick(c.id, c.name, sel.has(c.id)) + '</th>';
        }).join('') + '<th class="mx-tot">Всего</th></tr></thead><tbody>';
        R.cats.forEach(function (rc, i) {
          h += '<tr' + (sel.has(rc.id) ? ' class="mx-on"' : '') + '>' + '<td class="txt">' + mxPick(rc.id, rc.name, sel.has(rc.id), 'row') + '</td>';
          C.cats.forEach(function (cc, j) {
            var v = cells[i][j],
              t = shade(v, i, j);
            h += '<td class="mx-cell' + (v ? '' : ' zero') + '" data-mix="' + esc(rc.id + ',' + cc.id) + '"' + (v ? ' style="background:' + G.heat(t) + ';color:' + G.heatInk(t) + '"' : '') + tipAttr({
              title: rc.name + ' · ' + cc.name,
              rows: [{
                label: 'людей',
                value: D.fmtVal('hc_total', v),
                color: G.heat(Math.max(0.35, t))
              }, {
                label: 'от строки',
                value: rowSum[i] ? pct(v / rowSum[i] * 100) : '—'
              }, {
                label: 'от колонки',
                value: colSum[j] ? pct(v / colSum[j] * 100) : '—'
              }],
              note: 'Клик берёт срез сразу по двум атрибутам.'
            }) + '>' + (v ? show(v, i, j) : '—') + '</td>';
          });
          h += '<td class="mx-tot">' + D.fmtInt(rowSum[i]) + '</td></tr>';
        });
        h += '<tr class="total"><td class="txt">ИТОГО</td>' + colSum.map(function (v) {
          return '<td class="mx-sum">' + D.fmtInt(v) + '</td>';
        }).join('') + '<td class="mx-tot">' + D.fmtInt(all) + '</td></tr>';
        return h + '</tbody></table></div>';
      }
      function mixPicker(o) {
        var dims = o.dims,
          none = '<option value=""' + (o.cols ? '' : ' selected') + '>— без колонок</option>';
        var opts = function opts(cur, skip) {
          return dims.filter(function (d) {
            return d.key !== skip;
          }).map(function (d) {
            return '<option value="' + d.key + '"' + (d.key === cur ? ' selected' : '') + '>' + esc(d.name) + '</option>';
          }).join('');
        };
        var modes = [['abs', 'Люди'], ['row', '% по строке'], ['col', '% по колонке']];
        return '<div class="mx-bar">' + '<div class="ctl"><label>Строки</label>' + '<select data-mixaxis="rows">' + opts(o.rows, o.cols) + '</select></div>' + '<button class="btn ghost mx-swap" data-mixswap="1"' + tipAttr({
          title: 'Поменять оси местами',
          text: 'Строки станут колонками, колонки — строками.'
        }) + ' aria-label="Поменять оси местами">⇄</button>' + '<div class="ctl"><label>Колонки</label>' + '<select data-mixaxis="cols">' + none + opts(o.cols, o.rows) + '</select></div>' + (o.cols ? '<div class="ctl"><label>В клетке</label><div class="opts tight">' + modes.map(function (m) {
          return '<button class="opt' + (o.mode === m[0] ? ' on' : '') + '" data-mixmode="' + m[0] + '">' + esc(m[1]) + '</button>';
        }).join('') + '</div></div>' : '') + '</div>';
      }
      function sliceNote(parts, extra) {
        if (!parts.length) return '';
        return '<div class="note-inline slice">' + '<span class="sl-t">Срез состава:</span>' + parts.map(function (p) {
          return '<span class="chip sl">' + esc(p.dim.short || p.dim.name) + ': <b>' + esc(p.cat.name) + '</b>' + '<button class="x" data-mix="' + esc(p.id) + '"' + tipAttr({
            title: 'Снять срез',
            text: p.dim.name + ': ' + p.cat.name
          }) + '>×</button></span>';
        }).join('') + '<span class="sl-x">' + esc(extra || '') + '</span>' + '<button class="btn ghost xs" data-mixclear="1">Сбросить</button></div>';
      }
      function panel(o) {
        var tabs = o.tabs || '';
        var sub = o.subHtml ? o.subHtml : o.sub ? esc(o.sub) : '';
        return '<div class="panel' + (o.cls ? ' ' + o.cls : '') + '">' + (o.title ? '<div class="panel-h' + (tabs ? ' with-tabs' : '') + '"><div class="h-txt' + (o.hBtn ? ' has-btn' : '') + '"><span>' + o.title + '</span>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + (o.hBtn || '') + '</div>' + tabs + '</div>' : '') + '<div class="panel-b' + (o.bodyCls ? ' ' + o.bodyCls : '') + '">' + o.body + '</div></div>';
      }
      function subTabs(list, active) {
        if (!list || list.length < 2) return '';
        return '<div class="sub-tabs">' + list.map(function (t) {
          return '<button class="sub-tab' + (active === t[0] ? ' active' : '') + '" data-subtab="' + t[0] + '" data-text="' + esc(t[1]) + '">' + esc(t[1]) + '</button>';
        }).join('') + '</div>';
      }
      function statTable(o) {
        var nc = o.cols.length,
          first = o.firstTotal !== false;
        var h = '<table class="ptable stable dense"><thead><tr><th class="txt">' + esc(o.head || '') + '</th>' + o.cols.map(function (c, j) {
          return '<th' + (j === 0 && first ? ' class="st-tot"' : '') + '>' + esc(c) + '</th>';
        }).join('') + '</tr></thead><tbody>';
        o.rows.forEach(function (r) {
          if (r.sec) {
            h += '<tr class="st-sec"><td class="txt" colspan="' + (nc + 1) + '">' + esc(r.sec) + '</td></tr>';
            return;
          }
          var cls = [r.total ? 'total top' : '', r.sub ? 'st-sub' : ''].filter(Boolean).join(' ');
          h += '<tr' + (cls ? ' class="' + cls + '"' : '') + (r.tip ? tipAttr(r.tip) : '') + '><td class="txt">' + esc(r.name) + (r.note ? '<span class="unit-sub">' + esc(r.note) + '</span>' : '') + '</td>' + r.vals.map(function (v, j) {
            var txt = D.fmtNum(r.fmt || o.fmts && o.fmts[j] || 'int', v);
            var st = r.state && r.state[j];
            return '<td' + (j === 0 && first && !r.total ? ' class="lead"' : '') + '>' + (st && v != null ? '<span class="cell ' + st + '">' + txt + '</span>' : txt) + '</td>';
          }).join('') + '</tr>';
        });
        return h + '</tbody></table>';
      }
      function heatTable(o) {
        var _ref7;
        var nc = o.cols.length;
        var sumOf = function sumOf(c) {
          return c.reduce(function (a, b) {
            return a + b;
          }, 0);
        };
        var all = (_ref7 = o.total ? [o.total] : []).concat.apply(_ref7, _toConsumableArray(o.groups.map(function (g) {
          return g.rows;
        })));
        var top = 0;
        all.forEach(function (r) {
          var t = sumOf(r.cells);
          if (t) r.cells.forEach(function (v) {
            top = Math.max(top, v / t);
          });
        });
        top = top || 1;
        var row = function row(r, cls) {
          var t = sumOf(r.cells);
          var pc = t ? D.roundParts(r.cells.map(function (v) {
            return v / t * 100;
          }), 100) : r.cells.map(function () {
            return 0;
          });
          return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td class="txt">' + esc(r.name) + '</td>' + r.cells.map(function (v, j) {
            var k = t ? v / t / top : 0;
            return '<td class="mx-cell' + (v ? '' : ' zero') + '"' + (v ? ' style="background:' + G.heat(k) + ';color:' + G.heatInk(k) + '"' : '') + tipAttr({
              title: r.name + ' · ' + o.cols[j].name,
              rows: [{
                label: 'доля в строке',
                value: t ? pc[j] + '%' : '—',
                color: G.heat(Math.max(0.35, k))
              }, {
                label: 'человек',
                value: D.fmtInt(v)
              }],
              note: o.cols[j].tip || null
            }) + '>' + (t ? pc[j] + '%' : '—') + '</td>';
          }).join('') + '<td class="mx-tot">' + D.fmtInt(t) + '</td></tr>';
        };
        var h = '<div class="mx-wrap"><table class="ptable mxtable hxtable dense"><thead><tr>' + '<th class="txt mx-corner">' + (o.corner ? '<span class="mx-r">' + esc(o.corner) + '</span>' : '') + '</th>' + o.cols.map(function (c) {
          return '<th class="mx-h"' + (c.tip ? tipAttr({
            title: c.name,
            text: c.tip
          }) : '') + '>' + esc(c.name) + '</th>';
        }).join('') + '<th class="mx-tot">' + esc(o.totHead || 'Человек') + '</th></tr></thead><tbody>';
        if (o.total) h += row(o.total, 'total top');
        o.groups.forEach(function (g) {
          if (o.groups.length > 1) h += '<tr class="hx-sec"><td class="txt" colspan="' + (nc + 2) + '">' + esc(g.name) + '</td></tr>';
          g.rows.forEach(function (r) {
            h += row(r);
          });
        });
        return h + '</tbody></table></div>';
      }
      function empty(title, text) {
        var M = window.TPMASCOT;
        return '<div class="empty">' + (M ? '<div class="empty-pic">' + M.img('nodata', 96) + '</div>' : '') + '<b>' + esc(title) + '</b>' + esc(text) + '</div>';
      }
      function blockNav(items) {
        return '<nav class="op-nav" aria-label="Блоки сводки">' + items.map(function (it) {
          return '<button class="op-nav-i" data-jump="' + it.key + '"' + tipAttr({
            title: it.name,
            text: it.bad ? it.bad + ' ' + plural(it.bad, ['метрика', 'метрики', 'метрик']) + ' хуже ориентира.' : it.good ? 'Хуже ориентира — ничего, лучше — ' + it.good + '.' : 'Сигналов нет: метрики на уровне или без оценки.'
          }) + '>' + '<span class="sig ' + it.state + '"></span>' + esc(it.name) + (it.bad ? '<span class="op-nav-n">' + it.bad + '</span>' : '') + '</button>';
        }).join('') + '</nav>';
      }
      function pulseStrip(o) {
        var tot = Math.max(1, o.good + o.bad + o.neu);
        var seg = function seg(n, c) {
          return n ? '<i class="' + c + '" style="flex:' + n + '"></i>' : '';
        };
        var h = '<div class="pulse-strip"><div class="ps-score">' + '<div class="ps-h">Сигналы · ' + esc(D.CMP.cur) + '</div>' + '<div class="ps-num"><b class="g">' + o.good + '</b><span>лучше ориентира</span>' + '<b class="r">' + o.bad + '</b><span>хуже</span>' + '<b class="n">' + o.neu + '</b><span>на уровне или без оценки</span></div>' + '<div class="ps-bar" role="img" aria-label="' + o.good + ' лучше, ' + o.bad + ' хуже, ' + o.neu + ' без сигнала из ' + tot + '">' + seg(o.good, 'g') + seg(o.bad, 'r') + seg(o.neu, 'n') + '</div></div>';
        h += '<div class="ps-movers"><div class="ps-h">Главные сдвиги за год<span class="ps-sub">' + esc(D.CMP.yoy) + '</span></div>';
        if (!o.movers.length) h += '<div class="ps-empty">Сдвигов больше ±5% к прошлому году нет.</div>';
        o.movers.forEach(function (mv) {
          h += '<button class="ps-mv" data-tab="' + mv.block + '"' + tipAttr({
            title: mv.name,
            text: 'Было ' + D.fmtVal(mv.key, mv.prev) + ' в ' + D.CMP.yoy.replace(/^к /, '') + ', стало ' + D.fmtVal(mv.key, mv.cur) + '. Клик — открыть блок.'
          }) + '>' + '<span class="ps-n">' + esc(mv.name) + '</span>' + '<span class="ps-v">' + D.fmtVal(mv.key, mv.prev) + ' → <b>' + D.fmtVal(mv.key, mv.cur) + '</b></span>' + deltaChip(mv.key, mv.yoy) + '</button>';
        });
        return h + '</div></div>';
      }
      function trafficLegend() {
        return '<div class="legend"><span class="sw"><span class="dot" style="background:#bff2cd"></span>лучше базы</span>' + '<span class="sw"><span class="dot" style="background:#ffcccc"></span>хуже базы</span>' + '<span class="sw"><span class="dot" style="background:#f3f4f6"></span>на уровне ±5% или без оценки: ' + 'больше не значит лучше</span></div>';
      }
      var DEMO_TIP = {
        title: 'Демо-данные',
        text: 'Источника для этой метрики пока нет: цифра сгенерирована по настоящей численности юнита, ' + 'чтобы было видно, где она будет стоять. Какой источник и когда — в «Как читать отчёт» → «План метрик».'
      };
      function demoTag(small) {
        return '<span class="demo-tag' + (small ? ' sm' : '') + '"' + tipAttr(DEMO_TIP) + '>демо</span>';
      }
      function demoNote(text) {
        return '<div class="demo-note">' + demoTag() + '<span>' + esc(text) + '</span></div>';
      }
      function planTable(rows) {
        return '<label>План метрик</label><div class="fhint">Пробник показывает то, что уже есть в ' + 'hr_structure_overall. Остальное — заглушки с пометкой «демо»; они становятся живыми по этапам:</div>' + '<table class="plan-t"><thead><tr><th>Этап</th><th>Что</th><th>Источник</th><th>Сейчас</th></tr></thead><tbody>' + rows.map(function (r) {
          return '<tr><td>' + esc(r.stage) + '</td><td>' + esc(r.what) + '</td><td>' + esc(r.src) + '</td><td>' + (r.now === 'демо' ? demoTag() : esc(r.now)) + '</td></tr>';
        }).join('') + '</tbody></table>';
      }
      window.TPUI = {
        demoTag: demoTag,
        demoNote: demoNote,
        planTable: planTable,
        blockNav: blockNav,
        pulseStrip: pulseStrip,
        detailSplit: detailSplit,
        dynSwitch: dynSwitch,
        esc: esc,
        plural: plural,
        tipAttr: tipAttr,
        tip: tip,
        deltaChip: deltaChip,
        momChip: momChip,
        icoExt: icoExt,
        rowCaret: rowCaret,
        allCaret: allCaret,
        noCmpMark: noCmpMark,
        infoDot: infoDot,
        NOCMP_HINT: NOCMP_HINT,
        targetCell: targetCell,
        aiBlock: aiBlock,
        aiIco: aiIco,
        kpiCard: kpiCard,
        barTable: barTable,
        btGroup: btGroup,
        btStack: btStack,
        matrixTable: matrixTable,
        mixPicker: mixPicker,
        sliceNote: sliceNote,
        pct: pct,
        panel: panel,
        subTabs: subTabs,
        empty: empty,
        trafficLegend: trafficLegend,
        statTable: statTable,
        heatTable: heatTable,
        icoOpen: icoOpen,
        openUnitBtn: openUnitBtn,
        searchBox: searchBox,
        hlText: hlText,
        splitBtn: splitBtn,
        splitRail: splitRail,
        splitGut: splitGut
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        U = window.TPUI;
      var esc = U.esc;
      var IMG = {
        'base': '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',
        'ai': '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',
        'ok': 'UklGRtwWAABXRUJQVlA4WAoAAAAQAAAAnwAAnwAAQUxQSIgFAAABsAbb1rFJ0vPml1+WlWhkoW3btm13ZnePbdu27Zm2bdu2zS9u3LhxY/9IP+9z3/kbEROQivnLy1ZOzfYQOHWVRrOMd+APSzeY6Y4pfHpaY+l6DseMFzdtKtUjOKDww55GgwtPLGwkXS+MBgp7NZEZOGO68rEGsjw6Fgh/aDWO45DxIFzZ3TRuwMaFcGV3s1iEMkHlhhmN4rcTQ7mpu0EsjzJx4dyqMVS3m00Cwvcaw4kokyqc0BBWQpjkDms2glmvqk+Wa2d2A2jdhjHpxhXViOn7RvYblCkUhkbMYCiu9yNMqTCYUko3MBTVAQhTa3ZvlVL6jTEc0yYIU62cklJ6F69ySEQrIT5lKPNTGkI67BRJNUq/qpPDqSmdjCCsHMf7dx0x/Tk3chRWT+9CcO3MDaL6ImumlFo3YGRpfnX6FgrGbV0htE9HB1NKf0HJ1Dj4ShxQvhfB3LvpMDOlYYRsnTGFncrX+zIC09NmdMjYxnCht3QLBQNac1w8p3Ga39ZVtoXmBrw56waMeiqfKtpCcwN48ccYdRWWFGyhuTG6U1uz+7uKtdDcGN2osXBKqZY2M4ooDJRp3stulNH8oiL1PIJRSmHDAlXnoBTT/aGqPN9AKKiwTXF2Qiip+4NVYRYgXhSEbcpSXetGWd0frIpyAEJplbVLMkPVi2N+Rkl+iFJeo78cy6AUWPzj5TjVi+T+cqsUi1CKLKxTir94oZSfFGIORpndtV2Gj7oWCvO/zirA9I9hFNuxQ2u3xds4BTfn1Fn1+iCulF14c6U6fZiOU3p11q7PsXQI0JS+uqxKhxCNq2tS3esWA8Km9VgVJUjzG+rxSw8DZbAO09UJU/zDddgRicO5v6rBH9A4MPrz63oRD0R8r/yWoASq/Dy/45BInCeq7P6BRYIxL7fu1/FQhPVy68UIZji3jZFYjP/m9r5onDdbmf0XiwVjQV7Vg3gwwsZ59UhAQ3n1YQSrfDevNZFojMvyWiei6/NazwO6Ia9eNBw/I690BRZMh4Mz6xfzUIwHW5mltdBI3O6cm3JfIRblDyn7L8SCa09u1WN4KMK6ufVihKp8I7cdkFicZ6rMvovGgjKYV/UEHoz4iXn1YgRrXJbX5kg07jY9q8+h0SCsmdXVWEAn59RWPBzl1JyWQQnXebOV0S5IPCj9GX0JDUjYPKOLsJDenU/rGTwg41/5zCNk594qm9XQiMBmZ7NtUMbCbIaDUtbJ5ttYUPtlcxYe1GezOTco4+fZ3BmUc042T4R1dzZGzM4L2RD3/w3aeJ7AG87tQTkvZnNuWLdn8xssqP9k8340JOMb2ewRlDKczaphbZXNbCNkY2E21b14RMiMbNKv0ICMq1O+ByMBKV/NaBANSNg+o9abeDzKQEbpD2g4znNVTpsh4ShfSTm3O+7RCGtklX7gGozzaiuvlYhG/FMp7+pe91iMvszSDkgo6v9JuVf3u4XCitmlTZFA1E9NNbzQLRCWrsMAEoby2VTLISQIt0da9aiuxGIQlqSazhH1CIRjU21XpROA8IdU4x3oFE+5oVWndBydwim39KR6DyFeMuGWnlT3A1Arl3BFT6r/+qCFcuE3rVTCwUeQIimcmArZ/gdmxXHhxTVSOfcH8bIo/HZ6KmnvqSBeDnWe2TiVdrOHQLwMavCudipv67CXQax2LsBX56Uytw95BEy9Rq4K/tneVO7WpqcDJlYLEwVuOmBmKnzf8C0AouYZuak48MwXFlcpwGrgkHMZaSJqPkXuJqKMvP6U5VspzpnrfewSYXQzVTXzkYCPNDNVNWdUufqzW8xN8bb71jviWxe9YEzp27f/9d2bL9VOkXfPXHb1Xfb/+A9/f9FDjzzyyAv4Y4889NDdZ/zw2+/eZ/uV+qZVqfZWUDggLhEAAPBIAJ0BKqAAoAA+SR6LRCKhoRc59hgoBISzAGoI2n+S/FXtwr5+J/Kf2Wa5/e/wp+UvOBmJ9iflv/B6PvWL+m/+h7hH6wf8D0gPXR+3vqP/Zv9rvdZ9H3919QT+3f5/rW/QQ8tv2Uf7P/vP3I9p7MRPxJ8Qv8r+Sfnn+NfU/6nbD8134o/fcY/yF1Dvau+S2Z9Ai6H+D82vrV/xvVR/Wv9d6pf4TxuPtP+K/ZT4B/5n/c/+9/h/Y//3/NV+f/5X/0f6X4Df5V/Y/+l/ePbA9kf7TexF+rqdoing64smA0UrXW7jBvENLrAH4KBf4wtZRbEV9fnJXJgOC1eP2XEh8nMZfyI0n3xrfgnQIEd2FuyisrmKD3HtlyJsUPAkskjvQt41I/m/YfEykhJpIZ+tSc/c5MuW7vYpdaScZLm8iy6pWyDQgm+r5HZ+gAdZcctLRtP4SaVqkgFHXQYgSpGuliDRAw3WYzRaUfntVMqahDEsRSbVeDijsHzi8V6rNALUY/P+E6Uw8yMyNiZS1f0fWDD2KwyIL2IWO4LXrUbFvRiICxiUEqrWtXpLYuj/NIBh50yewWKsypMutOTQmQYEhtsP/UyW+CPEDLfvOMUMZbNC0Wy5XJSc07KclKOK27x1DzsmbnD/LfHOILwx7nYY+h1Iy/skfXudgYnRAEZYiMasNRs1drOzSu8hWuVLU4NKEhFHxQt9O/m7PKNxOV4xivL5VYefrJVPk2zb53Ct+3JSICZhRyo9wNEnR/aoeicFX8b9d7n4ftwbqhHsLKvdOQgA/v6lNlHjbgo4J6s20W3gesKI6vdbGtsXD5art4gL7uR/Z//17545r05fVB5Rc2VFiXeMMPmn9q5RzxqQnXQio0uta60ckAFYZyko3efVsHKx+dN1NhVWAwLbU1/VHjbihub8rguqRZDmpQ7vSWwy/6WwJv43ygDBbewkjj27wcmoyPVrjEY+tqM5a1MN6bhCfgTyO/g5rLdqvkBjCixe5UPud3MyvrNjXhVu3jEz25axNMgL8IVYiMeeIX+NFH7aAANGr1N3aPqFoYdYTbC/vnvb2kVOtvXGMVvHT0InmOdWTBc+kdLeKh/cRD/qD7D8hpb8z5Pxw3/9ywBEEtYKzrl9u2B1s0S+NtKsMMCPTJ4KsqR9VCx5b3YHGixYLIvhw5Ipd6ieAzb0bQKb0pwqVhrVJl4A/GdU4Jge7jL0gNbXh5iIqiJeKY8iTPzh2q44kbKI65134inQq2cuyvQ61rhWOlvX+Bk0THRauOU9Wo8c/i3OAyX1Wsj51fIAiYLq3FJsFAhcpwlvZllm/iA/4PHNf+eavbAUhXznHvedP/BM7zVoap83sW3MssqH+SVoYPvBmXRd/b0/kt5c4B+ASTB9VOCAXyVsi/fv1sRghEjH5UFc56GE/FRkxM+lvb+n409t3vQIFSmBxOUsdRXlkkPAw7/ELEbb65BaEN6hhUuFIPt+AtkhM/BET8S06UQ39hXdfxOqh8+kGdi09h0Jb/w48oPvywYgdI7JPJLZuXJ0aczRr9qIf5JWFP5bQNNKcKKDw5X2MfiQOtKkMY7H/+Zok2YZ0zHMMDD2sZu5oTzp32W35/6FJqJNiWVl8/J7DGOMBh4Yemkdnhg6MnCb9UlGlFCTL3C2YEkthOqzln4JkjdSMZhS315g1LRwuSG9WlYoeJQHhCn7Xvp7O3KR2RbIfTsDf0CzC6rPtl29nrwzM127uAhhaJIXAOl4MS0FtQ10ZsT6IyoA2KwjWvCQyfSoeLx2Co8ePCDRsW2TlzkXzdp2FqA2tsv9ll7kq30cXviD9B4MQHgvtgkiZgfk6vJJefsAURIGMKESyAW0McmzunRT+tzWJwDh8zM9kaV3VwfE7w6Y3UHCjAtzhx5jNJuNsY08VBvJfB0YSe/KeWXW3j9hFjMgwIt3biApPs141jlFzzB37HL+EYnLVtGZU/RTL8arxxPX4AfgcWrYOOOzaf/11+RZmJb//6fTL9+bURr7l0uTzpVhE0eBM8SIPjf6//FHLzVgdffR1+YyRmeAWSoa393HHikCqHtAJMt6R+jA85d+3eNKCZh5b9v9U3vqRsrmp4ajf2onA8NRYg77m4iqoTT7WRp5TmOf5PpTUPKm57+Yz6O3kSqW6JPEUKTFr4iF49Mxo2HqEcrvPEFlRvP04WT2Zu/nx01JzYonuz5NG/ZSxlMIZbBpfXwuTmt0MUHiSYgpBnB5YXob2jFZEYPpkZJ3i+MS8gqTtcflo/Ld9DG2K0FNKTHgj4f17UfFazpv7yMT08FZc3Asd0QoVbab4YicSZX0kucIWoPriLmpfmxjwGJ3D2+n9enp04qh0bEk40AnKahp8TDEglWhebHpIxG8IPeAVBO7kdTuH78IP1gLIbgvJnzZCuTGcPUkLWvGaNVSSCvfTmZUaaaUYYP9RbeYE1Yjnfbctd9bRN2kCQHfw4eGVc9KjMuw4ZjifIh/PKHW91dgyIz+8IXPIFCH/8UFeF/asRWIoN35tvUn29M/4h+dh01Jx0k6GOkN1S96LaJzyDAk7LL/3IbttCY/fC/7b3BQRlSwdjxZq/kBfQpxqweu4jdWv5ZzPCOVcQjNKy37y2FJFW78VBvJQTMHOVgZMEqJ1FPbGevNOOkbEKo/MdGY1OTi9Oy/LM7DVHch4u3zaGizgNAWv/MjVXhkNAVWMQH9IEm8REr7YLXGXcwBBQ1kX2CQ7qef8kP3PFdMM/fJk19vd/uyyQnNUgoq37ec5AVVyDSpStA7YMfz362mcpj+Udi3U+4HwcQD9eohY1O0ydECQ+K5Gp2yNCmGt9tnfhRbRSESGBdX852S8dz3itrJp3Sfpcb2tmr+RjucZdZ4YqAjm7CuHfEq2mWtfpUKo9hPg1uE45LMk24IEsVk39g3JUe6gTfdf4ZjNwazyVThfQ2OUOY6YLOUKs82oc7UV3pMS3bCMd8WbCeLvh3nO+MMth+E5yr1SkTcq6f4VNJJvJZ35apYNXf99vt9a8RkgmIb3ks5mmX7YYYovqgvFb+abq4wo61Hxfy6okHdPdFrC0W/ee85H+3d30Wk2L/Y2KS6Te69emEkN6a1SlCbzMhHbUnbqH2qZvAJJ52yQelT6/+0V3plfMD5O9hgxFQAy+1ASFX3I1l9CmtzL+pJe8sAB/yH/lu5OsNAiVUWIYYAI5p6NH2GyLXMQ3wrbMR3r1lTa7/aLj+FcpoECK5jj4rQye3ctjZfzcCdLYsKLAMklbDTe+KojwR8bv4BeTWrNOyTpMfgaBl9POR/0wkHmwM54j/9KDQvLraH7cYo4KbssYFV5BCWh831WGGpY894sJp4O+mk3MpHdwHC17ciwtu+zRkd5vcd5xU4QbujNtSdLq/J+x80Ol3dZcbHJcMvF3eHxrBgQ3sen5/0U4nAUs8J1Hh5Bd2kXRUt0tqygD9kUtvyuLiIxen2hxhYrnoE56ZWri4Ez4FjxaVRoluEtmcId4JeRLqHHWMnECBVT6/RcfGNF2541F4j76XzUvP6qjtIr9yhgRLrHQUWoCu7AfakuifEhA3ECO5yxXZOcG7l6/Ze5rEHuYjSuCroecyjH6UZRvnMvCqrkNVUr+EvSgOxqLkb6OyHcKJAWDQvY7BAEsksC4UZjA/BH677BAKYqZvkkUpsjBEdx5dUh6EWL8IVcwkAMBYMNb9oGGAzR1Du5NKaEso4g9czw3J+cQOt/KHxTwHMnf2T3QepW5Nq9J/vmam4Kzvq7pwcjtSti141E1f/lauzN8m56fxky0MrFGJKlzj5MStZJ61DBXeoNfZpz+YXMsZqaO5Ory+KVkie7+V59OfR30THqn9fP/9M2PFwn/O11oItPVFzu1+XtWaFSe4TQMXEDEP75mIWqcViGw/5xWyeFUM1eG5afoANhsIb8PYrBest+TMiaNWmM3PytNQVvBlIG61s84fTOAN+t2oiK8IX1FOr9K5HKQdx/J0vpSc73pB5qEpMAPNv4Av43Bg7Afgygcc6P6eNQL7gVzP8chgs47hk8JP3Ghgw1v/3Kr6EHL5YnaFzy3HmNyr/CA/0OpH9TCmCn4xeYx6syhpidkylugtXsP/S2Ht9facxnQ4LkTyrjNLK+t/C+Zy3B0JMXPV3ukz+Q2wt9WCFLYe1Y9syNSGpaxCcThgrNYKwLR5R/B0/AgCkcu00W/KoEU/al8A4Q0uy/+YlZCQ5PT7YAI4YyBu7wXDyXD0qNMN7UTVZSepHUEf0p/+SRCe6XAJJoL+CCkqyqAglqq0AcM6bkrfmUk8SGqV9kYfSUgjIToMuGwfkCxL+AJ8DPvOisxnva3/h5MhDzKsEjTsX9XWFvRxFWt09M1/nv9SqF4X05ZBds/F+Jv8pTyQ96H8DmiVcLLFVTr0HKkWKFInNO1oDVuAOf7G8Q7O0dOA6mMpdpqDL4VtWDoxQnthnMB/k8M79C4Kq0v6j+XFTnqMX+2LvKISp4dv+nbGEFP2uwRQNgHEKISG/AynPsejXkmlX7O/2Q/eZay2nN1KiWoGmp0Xt2TLHNUJT08XhprhxJvdCILr69Miysda5d0rTgUpUlOrMqUGM//xXolB3Pgme+ZMuPiwoWOC2Td4TxxB1od6t+DLT1d9X0GMWPdAUEi85zlZcg7952tcmb5WsbLub9nRnYlkx72AiBKN57nxqseDlXZmtKVvK932I4z8w10xpWg8IUirxn1gMoep4+9u+YOLTEBDh4oogfx+do0kes2FSib5UhI/PNwj1/v5gH7fVJ1gN27CHcNlG4r6xm+QYUudrT2/e1ypjD0ChmVlPVyPSFdZtPStiBpdTi8X47wGpTyg97NXGj6+n+XW500n5EEbP9EoeOv2hAp9cZmdh3w7AiZVOHSMueMvNornRo8NYOdQeUSTlhz2g/E/4ab9zHMLTzLu/X/uABmFqePVed0f9fb3eJHq+FE2NZhbCghzS6YiCxKmHnVCjv5+OBR4LKHAFyWZmtfFwqzopEYT2yKQ5+VoBR4OgxewRIHKCEIcJy59dr3y8DiXwhB3DkAMSk4CJbqrZUMO9SBe+MYgVGCVBAzLb63n1z9aver4xzYry32Sr7ShLEzxurHD+Kh6x56qx3YgsNg3+/bdlwPd1vOZ2twgMcQHpkIlAW+oPxgiAsX6FLGdJuX89MwGL/RlGHiFJi1EfrxE15oG4jQ083g5v4tdB3KMadhzWIqIMxSfKR2fI3jUE2/a3M8qA0Yi23EXIEreb71tqZ5IlVI0JQValW5t6L79DNwCYZN8yhI5bAm2t/B+qux0nGAWc0B8w8NL+gcSM0UnyfBOzgFfbO8ROcHtlguTMzVeTSpoM4v1E/ott2bCbnsjmjP4y+Fgy0MtxXNK7qmUGH3CoeJ2a2nQv85tRMjfAXovnQ30UEVVql8O9CYWTF09JX2MFzXYiCfPiT9PBkaOvEoQFb3DLH9EikSajWI9zWmVfWTaciEhoh82pCIwtXooewXjo97GzoSlkP5TYgHDK791FUzDEKRKDSzHeBG3uLL2FXyqYZ1hpGulzmWL3/RC9CyVag+otvCUK4Tugl3qK9Yex5tZCg67RFI+cJx6y8CoS0XQ0G9J/zIf41MhddRvJLDULulb5u1gLHy0/I0w7qG7UHaCyB2TnVCf8Tp0LLyvl+H4qkc+uDvMR+Y2CZS/T+H00I0ozdY4BryQuMYLt1jpUI1Vx/ffe4j3emmu5CG38ei3waRnXIZLhVCdruxt1hbIasHjl6+bnZHV9qdQPwdTp3AKoEcByuTHe1AdOrmGZw3B5o1B7/BBVPMg4Q8aasK3n7XWV8o8gmEhjti9Kdp+p3ouUmP8OP+mPpf//w2MuK6aFALaZAAAAAA==',
        'warn': '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',
        'alert': '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',
        'nodata': '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',
        'setup': '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',
        'point': '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',
        's_base': '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',
        's_ai': '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'
      };
      function srcOf(role, small) {
        var k = (small ? 's_' : '') + role;
        return IMG[k] ? 'data:image/webp;base64,' + IMG[k] : '';
      }
      function img(role, px, o) {
        o = o || {};
        var small = px <= 40 && (role === 'base' || role === 'ai');
        var s = srcOf(role, small);
        if (!s) return '';
        return '<img class="pulse' + (o.cls ? ' ' + o.cls : '') + '" ' + 'src=' + JSON.stringify(s) + ' width="' + px + '" height="' + px + '" alt="' + esc(o.alt || '') + '"' + (o.alt ? '' : ' aria-hidden="true"') + (o.tip ? U.tipAttr(o.tip) : '') + '>';
      }
      var MOOD = {
        alert: {
          role: 'alert',
          word: 'тревога',
          dot: 'bad',
          tip: {
            title: 'Пульс насторожён',
            text: 'На вкладке есть отклонение, которое требует действий.',
            note: 'Разбор — в плашке «Главное в блоке».'
          }
        },
        warn: {
          role: 'warn',
          word: 'внимание',
          dot: 'warn',
          tip: {
            title: 'Пульс приглядывается',
            text: 'Есть отклонения, на которые стоит посмотреть.',
            note: 'Разбор — в плашке «Главное в блоке».'
          }
        },
        ok: {
          role: 'ok',
          word: 'спокоен',
          dot: 'good',
          tip: {
            title: 'Пульс спокоен',
            text: 'Существенных отклонений от базы на вкладке нет.'
          }
        },
        nodata: {
          role: 'nodata',
          word: 'нет данных',
          dot: 'neutral',
          tip: {
            title: 'Пульс уснул',
            text: 'По выбранным разрезам ничего не нашлось.',
            note: 'Снимите один из разрезов в шапке.'
          }
        }
      };
      function mood(S) {
        if (!D.reportLeaves(S).length) return MOOD.nodata;
        if (S.tab !== 'onepager') {
          var sev = window.TPINSIGHTS && window.TPINSIGHTS.lastSev || 'none';
          return sev === 'high' ? MOOD.alert : sev === 'mid' ? MOOD.warn : MOOD.ok;
        }
        var rl = D.reportLeaves(S),
          bl = D.benchmarkLeaves(S);
        var bad = 0;
        D.METRICS.forEach(function (m) {
          if (!D.metricVisible(m.key, S) || m.better === 'flat') return;
          var v = D.lastVal(rl, m.key),
            kpi = D.kpiFor(m.key, S);
          var st = kpi ? D.stateForKpi(m.key, v, kpi) : D.comparable(m.key) ? D.compareState(m.key, v, D.lastVal(bl, m.key)) : 'neutral';
          if (st === 'bad') bad++;
        });
        return bad >= 3 ? MOOD.alert : bad >= 1 ? MOOD.warn : MOOD.ok;
      }
      function dock(S, open) {
        var m = mood(S);
        return '<button class="pulse-dock' + (open ? ' on' : '') + '" id="pulseDock" aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="pulsePanel"' + U.tipAttr(Object.assign({}, m.tip, {
          note: [].concat(m.tip.note || [], 'Клик — объяснит метрики этой вкладки.')
        })) + '>' + '<span class="pd-av">' + img(m.role, 54, {
          alt: 'Пульс'
        }) + '<span class="pd-dot ' + m.dot + '"></span></span>' + '<span class="pd-txt"><b>Пульс</b><span>словарь метрик<br>этой вкладки</span></span>' + '<span class="pd-caret">' + (open ? '✕' : '▸') + '</span></button>';
      }
      function metricItem(m, S) {
        var dir = m.better === 'lower' ? 'ниже — лучше' : m.better === 'higher' ? 'выше — лучше' : 'нейтральная';
        var kpi = D.kpiFor(m.key, S);
        return '<div class="pp-m"><div class="pp-m-h">' + esc(m.name) + (kpi ? '<span class="kpi-tag">KPI</span>' : '') + (D.comparable(m.key) ? '' : '<span class="pp-flag">не сравнивается</span>') + '</div>' + '<div class="pp-m-d">' + esc(m.hint || 'Описание метрики пока не задано.') + '</div>' + '<div class="pp-m-f">' + esc(m.unit || '—') + ' · ' + dir + (kpi ? ' · цель ' + D.fmtVal(m.key, kpi.green) : '') + '</div></div>';
      }
      function panel(S) {
        var onep = S.tab === 'onepager';
        var b = onep ? null : D.BLOCK_BY_KEY[S.tab];
        var body = '';
        if (onep) {
          var groups = D.visibleBlocks(S).map(function (bl) {
            var mets = D.visibleMetricsOfBlock(bl.key, S);
            return '<div class="pp-g"><div class="pp-g-h">' + esc(bl.name) + '</div>' + mets.map(function (m) {
              return metricItem(m, S);
            }).join('') + '</div>';
          }).join('');
          body = '<div class="pp-lead">Сводка собирает метрики всех блоков. Ниже — что означает каждая из выбранных вами.</div>' + groups;
        } else {
          var mets = D.visibleMetricsOfBlock(b.key, S);
          body = '<div class="pp-lead">' + esc(b.hint) + '</div>' + '<div class="pp-g">' + mets.map(function (m) {
            return metricItem(m, S);
          }).join('') + '</div>';
        }
        return '<aside class="pulse-panel" id="pulsePanel" role="dialog" aria-label="Пульс: словарь метрик">' + '<div class="pp-h">' + '<div class="pp-h-t"><b>Словарь метрик</b><span>' + esc(onep ? 'One-pager' : b.name) + '</span></div>' + '<button class="pp-x" id="pulseClose" aria-label="Закрыть">✕</button></div>' + '<div class="pp-b">' + body + '</div>' + '<div class="pp-f">Здесь — что означает метрика. Как устроен отчёт целиком — ' + '<button class="pp-link" id="pulseToHelp">«Как читать отчёт»</button> в шапке.</div>' + '</aside>';
      }
      window.TPMASCOT = {
        img: img,
        mood: mood,
        dock: dock,
        panel: panel,
        srcOf: srcOf
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        U = window.TPUI;
      var esc = U.esc;
      var INS_GAP = 10;
      var INS_TREND = 3;
      var INS_CONC = 50;
      function relGap(v, base) {
        return base ? (v - base) / Math.abs(base) * 100 : 0;
      }
      function trendLen(ser) {
        var up = 1,
          dn = 1;
        for (var i = ser.length - 1; i > 0; i--) {
          if (ser[i] > ser[i - 1]) up++;else break;
        }
        for (var _i10 = ser.length - 1; _i10 > 0; _i10--) {
          if (ser[_i10] < ser[_i10 - 1]) dn++;else break;
        }
        return up >= dn ? {
          dir: 'up',
          len: up
        } : {
          dir: 'dn',
          len: dn
        };
      }
      function isBad(m, v, base) {
        return m.better === 'lower' ? v > base : m.better === 'higher' ? v < base : false;
      }
      function build(ctx) {
        var S = ctx.S,
          b = ctx.b,
          mainK = ctx.mainK,
          rl = ctx.rl,
          bl = ctx.bl,
          rows = ctx.rows;
        var out = [];
        D.visibleMetricsOfBlock(b.key, S).forEach(function (m) {
          if (m.better === 'flat') return;
          if (D.isStub(m.key)) return;
          var ser = D.aggregate(rl, m.key),
            v = ser[D.LAST];
          if (v == null) return;
          var kpi = D.kpiFor(m.key, S);
          var base = kpi ? kpi.green : D.lastVal(bl, m.key);
          if ((D.comparable(m.key) || kpi) && base != null && isFinite(base)) {
            var gap = relGap(v, base),
              bad = isBad(m, v, base);
            if (Math.abs(gap) >= INS_GAP) {
              out.push({
                sev: bad ? Math.abs(gap) >= 25 ? 3 : 2 : 1,
                metric: m,
                text: '<b>' + esc(m.name) + '</b> ' + (bad ? 'хуже' : 'лучше') + ' ' + (kpi ? 'цели KPI' : 'базы') + ' на ' + Math.abs(gap).toFixed(0) + '%: ' + D.fmtVal(m.key, v) + ' против ' + D.fmtVal(m.key, base) + '.'
              });
            }
          }
          var t = trendLen(ser);
          if (t.len >= INS_TREND) {
            var worsening = m.better === 'lower' && t.dir === 'up' || m.better === 'higher' && t.dir === 'dn';
            out.push({
              sev: worsening ? 2 : 1,
              metric: m,
              text: '<b>' + esc(m.name) + '</b> ' + (t.dir === 'up' ? 'растёт' : 'снижается') + ' ' + t.len + '-й месяц подряд: ' + D.fmtVal(m.key, ser[D.LAST - t.len + 1]) + ' → ' + D.fmtVal(m.key, v) + (worsening ? ' — динамика против вас.' : ' — динамика в вашу пользу.')
            });
          }
        });
        var mM = D.METRIC_BY_KEY[mainK];
        if (mM.better !== 'flat' && rows.length > 1 && (D.comparable(mainK) || D.kpiFor(mainK, S))) {
          var kpi = D.kpiFor(mainK, S);
          var base = kpi ? kpi.green : D.lastVal(bl, mainK);
          var tops = rows.filter(function (r) {
            return r.depth === 1;
          }).map(function (r) {
            var lp = ctx.rowLeaves(r.n.path);
            var v = D.lastVal(lp, mainK),
              hc = D.lastVal(lp, 'hc_total');
            return {
              name: r.n.name,
              v: v,
              hc: hc,
              exc: v != null && isBad(mM, v, base) ? Math.abs(v - base) * Math.max(hc, 1) : 0
            };
          });
          var total = tops.reduce(function (a, x) {
            return a + x.exc;
          }, 0);
          if (total > 0) {
            var top = tops.slice().sort(function (a, b2) {
              return b2.exc - a.exc;
            })[0];
            var share = top.exc / total * 100;
            if (share >= INS_CONC) out.push({
              sev: 3,
              metric: mM,
              text: '<b>' + esc(top.name) + '</b> даёт ' + share.toFixed(0) + '% всего отклонения по метрике «' + esc(mM.name) + '»: ' + D.fmtVal(mainK, top.v) + ' при ' + (kpi ? 'цели ' : 'базе ') + D.fmtVal(mainK, base) + ' на ' + D.fmtInt(top.hc) + ' чел. Начните разбор с него.'
            });
          }
        }
        out.sort(function (a, b2) {
          return b2.sev - a.sev;
        });
        return out;
      }
      function html(ctx) {
        var S = ctx.S,
          b = ctx.b;
        var ins = build(ctx);
        var id = 'ins-' + b.key,
          open = S.aiOpen === id;
        if (!ins.length) {
          window.TPINSIGHTS.lastSev = 'none';
          var vis = D.visibleMetricsOfBlock(b.key, S).filter(function (m) {
            return !D.isStub(m.key);
          });
          var hasCmp = vis.some(function (m) {
            return D.comparable(m.key);
          });
          var nChk = vis.filter(function (m) {
            return m.better !== 'flat';
          }).length;
          var _lead = hasCmp ? 'Существенных отклонений от базы нет: все метрики блока в пределах <b>' + INS_GAP + '%</b> от <b>' + esc(D.benchmarkLabel(S)) + '</b>, устойчивых трендов нет.' : 'Метрики блока абсолютные, с базой не сравниваются. Устойчивых трендов за период нет.';
          var bl2 = [];
          if (hasCmp) bl2.push('Сравнение с базой: проверено метрик — <b>' + nChk + '</b>, ни одна не вышла за <b>±' + INS_GAP + '%</b> от ' + esc(D.benchmarkLabel(S)) + '.');else bl2.push('Метрики блока абсолютные: больше или меньше здесь не значит хуже или лучше, сравнение с базой для них не строится.');
          bl2.push('Тренды: нет ни одной метрики, которая шла бы в одну сторону <b>' + INS_TREND + '</b> месяца подряд и больше.');
          bl2.push('Концентрация: ни одно подразделение не даёт <b>' + INS_CONC + '%</b> и больше отклонения по главной метрике блока.');
          return U.aiBlock(id, 'Главное в блоке', _lead, bl2, open, 'insight sev-none');
        }
        var maxSev = ins[0].sev;
        var sevCls = maxSev >= 3 ? 'high' : maxSev === 2 ? 'mid' : 'good';
        window.TPINSIGHTS.lastSev = sevCls;
        var sevTxt = maxSev >= 3 ? 'требует действий' : maxSev === 2 ? 'стоит внимания' : 'позитив';
        var lead = ins[0].text.replace(/<[^>]+>/g, '');
        var h = '<div class="ai insight sev-' + sevCls + '"><div class="ai-h" data-ai="' + id + '">' + U.aiIco(open) + '<span class="ai-t">Главное в блоке</span>' + '<span class="ai-lead">' + (open ? '' : esc(lead)) + '</span>' + '<span class="ai-sev ' + sevCls + '">' + sevTxt + '</span>' + '<span class="ai-tag">' + (open ? 'свернуть' : 'подробнее') + '</span>' + '<span class="ai-caret">' + (open ? '▲' : '▼') + '</span></div>';
        if (open) {
          h += '<div class="ai-b"><ul>' + ins.slice(0, 4).map(function (x) {
            return '<li>' + x.text + '</li>';
          }).join('') + '</ul>' + '<div class="ins-note">Показано только то, что вышло за порог: отклонение от базы больше ' + INS_GAP + '%, тренд от ' + INS_TREND + ' месяцев или концентрация отклонения выше ' + INS_CONC + '% в одном подразделении.</div></div>';
        }
        return h + '</div>';
      }
      window.TPINSIGHTS = {
        build: build,
        html: html,
        INS_GAP: INS_GAP,
        INS_TREND: INS_TREND,
        INS_CONC: INS_CONC,
        lastSev: 'none'
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        U = window.TPUI,
        G = window.TPDRAW,
        INS = window.TPINSIGHTS;
      var esc = U.esc;
      var blocks = {};
      function currentRoot(S) {
        return S.unit;
      }
      var TREE_DEPTH = 3;
      function _rowLeaves(path, S) {
        return D.leavesUnder(path).map(function (l) {
          return l.path;
        }).filter(function (p) {
          return D.leafPasses(p, S);
        });
      }
      function sumS(s) {
        return s.reduce(function (a, b) {
          return a + b;
        }, 0);
      }
      function blockMain(bk, S) {
        var m = D.METRIC_BY_KEY[S.mainMetric];
        if (m && m.block === bk && D.metricVisible(m.key, S)) return S.mainMetric;
        var mets = D.visibleMetricsOfBlock(bk, S);
        return (mets.find(function (x) {
          return D.comparable(x.key);
        }) || mets[0]).key;
      }
      function expandableRows(root) {
        var out = [];
        (function walk(p, d) {
          D.rowsOf(p).forEach(function (n) {
            if (d < TREE_DEPTH && D.rowsOf(n.path).length) {
              out.push(n.path);
              walk(n.path, d + 1);
            }
          });
        })(root, 1);
        return out;
      }
      function pivotRows(root, expanded, isEmpty, q) {
        var rows = [],
          emp = isEmpty || function () {
            return false;
          },
          needle = String(q || '').trim().toLowerCase();
        var order = function order(list) {
          return list.filter(function (n) {
            return !emp(n.path);
          }).concat(list.filter(function (n) {
            return emp(n.path);
          }));
        };
        (function walk(p, d) {
          order(D.rowsOf(p)).forEach(function (n) {
            var kids = D.kidsOf(n.path);
            rows.push({
              n: n,
              depth: d,
              empty: emp(n.path),
              kids: kids
            });
            if (kids && d < TREE_DEPTH && (needle || expanded.has(n.path))) walk(n.path, d + 1);
          });
        })(root, 1);
        if (!needle) return rows;
        var hits = rows.filter(function (r) {
          return r.n.name.toLowerCase().indexOf(needle) >= 0;
        }).map(function (r) {
          return r.n.path;
        });
        return rows.filter(function (r) {
          r.hit = hits.indexOf(r.n.path) >= 0;
          r.anc = !r.hit && hits.some(function (h) {
            return h.indexOf(r.n.path + '/') === 0;
          });
          return r.hit || r.anc;
        });
      }
      function selLabel(S) {
        var n = D.NODE_BY_PATH[S.selNode] || D.NODE_BY_PATH[S.unit];
        return n ? n.name : 'Ваша команда';
      }
      function yoyChart(key, lp, bl, S, opt) {
        var kpi = D.kpiFor(key, S),
          cmp = D.comparable(key) && !kpi,
          bench = D.benchmarkLabel(S);
        var y = D.yoySeries(lp, key),
          by = cmp ? D.yoySeries(bl, key).cur : null;
        var fcK = (D.METRIC_BY_KEY[key] || {}).fc;
        var legend = [{
          name: String(D.YEAR_CUR),
          color: G.C_LINE
        }, {
          name: String(D.YEAR_PREV),
          color: G.C_PREV
        }].concat(cmp ? [{
          name: bench,
          color: G.C_BENCH,
          dash: true
        }] : []);
        return G.chart('yoy', {
          metricKey: key,
          cur: y.cur,
          prev: y.prev,
          bench: by
        }, Object.assign({
          legend: legend,
          benchName: bench,
          kpi: kpi,
          fc: fcK ? D.lastVal(lp, fcK) : null,
          h: 300,
          fill: true
        }, opt || {}));
      }
      function dynWrap(ctx, rollHtml, items) {
        if (ctx.S.dyn !== 'yoy') return U.dynSwitch('roll') + rollHtml;
        return U.dynSwitch('yoy') + items.map(function (it) {
          return yoyChart(it.key, ctx.lp, ctx.bl, ctx.S, {
            title: it.title,
            h: it.h || 250,
            fill: false
          });
        }).join('');
      }
      function winTitle(S, title) {
        return S.dyn === 'yoy' ? title + ' · 12 мес, ' + D.PERIOD_LABEL : title;
      }
      function metricLine(key, lp, bl, S, opt) {
        if (S.dyn === 'yoy' && !(opt && opt.noSwitch)) return U.dynSwitch('yoy') + yoyChart(key, lp, bl, S, Object.assign({}, opt || {}, {
          title: (opt && opt.title ? opt.title + ' · ' : '') + 'год к году'
        }));
        var kpi = D.kpiFor(key, S),
          cmp = D.comparable(key) && !kpi,
          bench = D.benchmarkLabel(S);
        return (opt && opt.noSwitch ? '' : U.dynSwitch('roll')) + G.chart('line', {
          metricKey: key,
          series: D.aggregate(lp, key),
          bench: cmp ? D.aggregate(bl, key) : null
        }, Object.assign({
          legend: cmp ? [{
            name: selLabel(S),
            color: G.C_LINE
          }, {
            name: bench,
            color: G.C_BENCH,
            dash: true
          }] : null,
          benchName: bench,
          kpi: kpi,
          h: 300,
          fill: true
        }, opt || {}));
      }
      function cardSpark(key, ser, st, S, bl) {
        var m = D.METRIC_BY_KEY[key],
          kpi = D.kpiFor(key, S);
        var noEval = !kpi && (!D.comparable(key) || m.better === 'flat');
        return G.sparkLine(ser, noEval ? 'neutral' : st, 84, 24, {
          key: key,
          kpi: kpi,
          ink: noEval,
          fit: noEval,
          base: !kpi && D.comparable(key) ? D.aggregate(bl, key) : null
        });
      }
      function yearAgo(lp, key) {
        return D.aggregateExt(lp, key)[D.NEXT - 13];
      }
      var DEMO = {
        structure: {
          '*': 'Доли по атрибутам — демо: грейда, пола, возраста, региона и стрима в hr_structure_overall нет. ' + 'Численность в ИТОГО — живая.'
        },
        turnover: {
          reasons: 'Причины и инициаторы увольнений — демо: их нет в hr_structure_overall. Отток в ИТОГО — живой.',
          who: 'Стаж, грейд и стрим ушедших — демо. Отток в ИТОГО — живой.'
        },
        hiring: {
          vacancies: 'Вакансии и срок закрытия — демо: нужен источник вакансий (vacancy_daily_for_digest).',
          plan: 'План найма — демо (plan_fact_tf_rabota), факт — живой найм.',
          profile: 'Каналы, сеньорность и грейд найма — демо (atributy_nayma). Найм в ИТОГО — живой.',
          funnel: 'Воронка — демо: нужен источник вакансий.'
        },
        tgrowth: {
          '*': 'T-рост — демо: нужны заявки и решения сервиса «Рост».'
        },
        monitor: {
          both: 'Низкая оценка — живая; недоработка и улучшение оценки в ревью — демо.',
          review: 'Ревью — демо (review_digest_us).'
        },
        office: {
          '*': 'Посещаемость и бронирование — демо: нужны СКУД и система бронирования.'
        },
        ai: {
          '*': 'AI-инструменты — демо: нужна AI-витрина (penetration_unit, wau).'
        }
      };
      function demoNoteFor(bk, sub) {
        if (!D.REAL) return '';
        var d = DEMO[bk] || {},
          t = d[sub] || d['*'];
        return t ? U.demoNote(t) : '';
      }
      function renderBlock(S, expanded, mixOpen, view) {
        var b = D.BLOCK_BY_KEY[S.tab];
        var mod = blocks[b.key];
        if (!S.subTab || !mod.subTabs.some(function (t) {
          return t[0] === S.subTab;
        })) S.subTab = mod.defaultSub;
        var root = currentRoot(S),
          rootNode = D.NODE_BY_PATH[root];
        var rl = D.reportLeaves(S),
          bl = D.benchmarkLeaves(S);
        var mainK = blockMain(b.key, S),
          mainM = D.METRIC_BY_KEY[mainK];
        var slice = b.key === 'structure' ? D.sliceParse(S.mixSel) : [];
        var selIds = slice.map(function (p) {
          return p.id;
        });
        var val = function val(lp, key) {
          return D.lastValSlice(lp, key, selIds);
        };
        var mets = D.visibleMetricsOfBlock(b.key, S);
        if (!rl.length) {
          return '<div class="page-h"><h2>' + esc(b.name) + '</h2><p>' + esc(b.hint) + '</p></div>' + U.empty('Нет данных по выбранным разрезам', 'Снимите один из разрезов в шапке отчёта.');
        }
        var tq = String(view && view.tq || '').trim();
        var isEmpty = function isEmpty(p) {
          return !_rowLeaves(p, S).length;
        };
        var rows = pivotRows(root, expanded, isEmpty, tq);
        var baseRows = pivotRows(root, new Set(), isEmpty);
        var sel = S.selNode && D.NODE_BY_PATH[S.selNode] && S.selNode.indexOf(root + '/') === 0 ? S.selNode : root;
        var selNode = D.NODE_BY_PATH[sel];
        var kpiMets = mets.filter(function (m) {
          return D.kpiFor(m.key, S);
        });
        var cmpMets = mets.filter(function (m) {
          return D.comparable(m.key) && !D.kpiFor(m.key, S);
        });
        var cmpTxt = (cmpMets.length ? 'Сравнение с базой <b>' + esc(D.benchmarkLabel(S)) + '</b>.' : kpiMets.length ? '' : 'Метрики блока абсолютные — с базой не сравниваются.') + (kpiMets.length ? ' У метрик с утверждённым KPI сравнение идёт с целью, а не с базой.' : '');
        var dash = D.blockDash(b.key, S);
        var h = '<div class="page-h"><div class="ph-row"><h2>' + esc(b.name) + '</h2>' + '<a class="btn dash" href="' + (dash ? dash.href : b.drillUrl) + '" target="_blank" rel="noopener"' + (dash ? U.tipAttr({
          title: 'Дашборд Proteus ' + dash.id,
          text: '«' + dash.name + '» — детальный слой этого блока.',
          note: dash.only ? 'Блок есть только в этой версии дашборда.' : 'Блок есть в обеих версиях: при покраске HQ открывается HQ-версия, иначе общая.'
        }) : '') + '>Детальный дашборд' + U.icoExt() + '</a></div>' + '<p>' + esc(b.hint) + ' ' + cmpTxt + '</p></div>';
        h += INS.html({
          S: S,
          b: b,
          mainK: mainK,
          rl: rl,
          bl: bl,
          rows: baseRows,
          rowLeaves: function rowLeaves(p) {
            return _rowLeaves(p, S);
          }
        });
        h += '<div class="kpis compact n' + Math.min(8, mets.length) + '">';
        mets.forEach(function (m) {
          var sliced = selIds.length && D.sliceable(m.key);
          var ser = sliced ? D.aggregateSlice(rl, m.key, selIds) : D.aggregate(rl, m.key);
          var v = val(rl, m.key);
          var mom = sliced ? D.sliceDeltaMoM(rl, m.key, selIds) : D.deltasOf(rl, m.key).mom;
          var kpi = D.kpiFor(m.key, S),
            bv = D.lastVal(bl, m.key);
          var st = kpi ? D.stateForKpi(m.key, v, kpi) : D.compareState(m.key, v, bv);
          h += U.kpiCard({
            label: m.name,
            tag: D.isStub(m.key) ? U.demoTag() : '',
            q: U.infoDot(m.key),
            value: D.fmtVal(m.key, v),
            row1: U.momChip(m.key, mom) + cardSpark(m.key, ser, st, S, bl),
            row2: kpi ? '<span class="k-sub">цель ' + D.fmtVal(m.key, kpi.green) + '</span><span class="kpi-tag">KPI</span>' : D.comparable(m.key) ? '<span class="k-sub">база ' + D.fmtVal(m.key, bv) + '</span>' : U.noCmpMark(),
            row3: sliced ? '' : 'год назад <b>' + D.fmtVal(m.key, yearAgo(rl, m.key)) + '</b>'
          });
        });
        h += '</div>';
        h += U.sliceNote(slice, 'в карточках и в таблице подразделений численность показана ' + 'по срезу; база сравнения и инсайты считаются по всему отбору');
        var wideL = mets.length + (D.comparable(mainK) || D.kpiFor(mainK, S) ? 1 : 0) >= 7;
        var sp = view && view.split || {};
        var mode = sp.mode === 'table' || sp.mode === 'charts' ? sp.mode : 'both',
          share = sp.share != null ? sp.share : null;
        var subName = (mod.subTabs.find(function (t) {
          return t[0] === S.subTab;
        }) || [])[1] || mod.title(S.subTab);
        h += '<div class="split' + (wideL ? ' wide-l' : '') + ' m-' + mode + (share != null ? ' custom' : '') + '"' + (share != null ? ' style="--split-l:' + (share * 100).toFixed(2) + 'fr;--split-r:' + ((1 - share) * 100).toFixed(2) + 'fr"' : '') + '>' + U.splitRail('l', 'Подразделения');
        var expandable = expandableRows(root);
        var allOpen = expandable.length > 0 && expandable.every(function (p) {
          return expanded.has(p);
        });
        var kpiMain = D.kpiFor(mainK, S);
        var benchMain = kpiMain ? kpiMain.green : D.lastVal(bl, mainK);
        var showVs = D.comparable(mainK) || !!kpiMain;
        var totalCells = mets.map(function (m) {
          return '<td' + (m.key === mainK ? ' class="lead"' : '') + '>' + D.fmtVal(m.key, val(rl, m.key)) + '</td>';
        }).join('');
        var tbl = '<table class="ptable dense tree"><thead><tr><th class="txt"' + U.tipAttr({
          title: 'Подразделение',
          text: 'Три уровня вниз от «' + rootNode.name + '». Глубже — выберите строку и откройте её ' + 'юнит иконкой у правого края имени.'
        }) + '>Подразделение</th>' + mets.map(function (m) {
          return '<th' + U.tipAttr({
            title: m.name,
            text: m.hint || ''
          }) + '>' + esc(m.short) + (D.isStub(m.key) ? U.demoTag(true) : '') + '</th>';
        }).join('') + (showVs ? '<th class="vs">' + (kpiMain ? 'К цели KPI' : 'К базе') + '<span class="hint-col">' + esc(mainM.short) + '</span></th>' : '') + '</tr></thead><tbody>' + '<tr class="total top"><td class="txt"><span class="row-label">' + (expandable.length && !tq ? '<button class="caret-btn"' + (allOpen ? ' data-open="1"' : '') + ' data-expall="' + (allOpen ? '0' : '1') + '" aria-label="' + (allOpen ? 'Свернуть всё' : 'Развернуть всё') + '"' + U.tipAttr({
          title: allOpen ? 'Свернуть всё' : 'Развернуть всё',
          text: 'Все три уровня подразделений сразу.'
        }) + '>' + (allOpen ? '▾' : '▸') + '</button>' : '<span class="caret-spacer"></span>') + '<span class="row-body">ИТОГО</span></span></td>' + totalCells + (showVs ? '<td class="vs"><span class="cell neutral">' + D.fmtVal(mainK, benchMain) + '</span></td>' : '') + '</tr>';
        rows.forEach(function (r) {
          var lp = _rowLeaves(r.n.path, S);
          var v = D.lastVal(lp, mainK);
          var st = kpiMain ? D.stateForKpi(mainK, v, kpiMain) : D.compareState(mainK, v, benchMain);
          var canExp = !tq && r.kids > 0 && r.depth < TREE_DEPTH,
            isOpen = expanded.has(r.n.path),
            isSel = sel === r.n.path;
          var below = r.depth === TREE_DEPTH && r.kids > 0 ? r.kids : 0;
          tbl += '<tr class="urow' + (r.depth > 1 ? ' lvl' + r.depth : '') + (r.empty ? ' empty' : '') + (isSel ? ' sel' : '') + (tq ? r.hit ? ' hit' : ' anc' : '') + '" data-node="' + r.n.path + '">' + '<td class="txt"><span class="row-label">' + (canExp ? '<button class="caret-btn"' + (isOpen ? ' data-open="1"' : '') + ' data-exp="' + r.n.path + '" aria-label="' + (isOpen ? 'Свернуть' : 'Раскрыть') + '">' + (isOpen ? '▾' : '▸') + '</button>' : '<span class="caret-spacer"></span>') + '<span class="row-body">' + (tq ? U.hlText(r.n.name, tq) : esc(r.n.name)) + '<span class="unit-sub">' + esc(r.n.direct ? 'без подразделения' : D.LEVEL_SHORT[r.n.level] || D.levelLabel(r.n.level)) + ' · ' + D.fmtVal('hc_total', val(lp, 'hc_total')) + ' чел' + (below ? ' · <span class="below"' + U.tipAttr({
            title: 'Ниже ещё ' + below + ' ' + U.plural(below, ['подразделение', 'подразделения', 'подразделений']),
            text: 'Таблица показывает три уровня вниз. Глубже — выберите строку и откройте её юнит иконкой у правого края имени.'
          }) + '>ниже ещё ' + below + '</span>' : '') + '</span></span>' + (isSel && !r.n.direct ? U.openUnitBtn(r.n.path, r.n.name) : '') + '</span></td>' + mets.map(function (m) {
            return '<td' + (m.key === mainK ? ' class="lead"' : '') + '>' + (D.directNA(r.n, m.key) ? '—' : D.fmtVal(m.key, val(lp, m.key))) + '</td>';
          }).join('') + (showVs ? '<td class="vs">' + (r.empty || v == null || benchMain == null ? '<span class="cell neutral">—</span>' : '<span class="cell ' + st + '">' + D.fmtDelta(mainK, +(v - benchMain).toFixed(4)) + '</span>') + '</td>' : '') + '</tr>';
        });
        var ncol = 1 + mets.length + (showVs ? 1 : 0);
        if (!rows.length) tbl += '<tr class="tree-empty"><td class="txt" colspan="' + ncol + '">' + (tq ? 'Подразделений с «' + esc(tq) + '» в трёх уровнях вниз нет. Глубже — откройте юнит; другое подразделение ' + 'компании — в «Настрой свой дашборд».' : 'У «' + esc(rootNode.name) + '» нет подразделений уровнем ниже — все цифры в строке ИТОГО.') + '</td></tr>';
        tbl += '</tbody></table>';
        h += U.panel({
          cls: 'split-l',
          title: 'Подразделения',
          subHtml: slice.length ? esc('численность по срезу: ' + D.sliceLabel(selIds)) : 'три уровня вниз · глубже — откройте юнит ' + U.icoOpen(),
          hBtn: U.splitBtn('table', mode, 'Подразделения'),
          tabs: U.searchBox({
            q: view && view.tq || '',
            placeholder: 'Поиск по таблице'
          }),
          body: tbl,
          bodyCls: 'tbl-wrap'
        }) + U.splitGut(share);
        var ctx = {
          S: S,
          b: b,
          sub: S.subTab,
          lp: _rowLeaves(sel, S),
          rl: rl,
          bl: bl,
          rows: baseRows,
          root: root,
          sel: sel,
          mixOpen: mixOpen || new Set(),
          benchLabel: D.benchmarkLabel(S)
        };
        h += U.panel({
          cls: 'split-r',
          title: mod.title(S.subTab),
          subHtml: esc(selNode.name) + (sel !== root ? ' · выбрано' + (selNode.direct ? '' : U.openUnitBtn(sel, selNode.name, 'Открыть юнит')) : ' · всё подразделение'),
          hBtn: U.splitBtn('charts', mode, subName),
          tabs: U.subTabs(mod.subTabs, S.subTab),
          body: demoNoteFor(b.key, S.subTab) + mod.view(ctx)
        }) + U.splitRail('r', subName);
        return h + '</div>';
      }
      window.TPSCREENS = {
        blocks: blocks,
        renderBlock: renderBlock,
        currentRoot: currentRoot,
        rowLeaves: _rowLeaves,
        sumS: sumS,
        blockMain: blockMain,
        pivotRows: pivotRows,
        expandableRows: expandableRows,
        metricLine: metricLine,
        yoyChart: yoyChart,
        dynWrap: dynWrap,
        winTitle: winTitle,
        selLabel: selLabel,
        yearAgo: yearAgo,
        TREE_DEPTH: TREE_DEPTH
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        U = window.TPUI,
        SC = window.TPSCREENS;
      function dimTable(dim, lp, sel, mixSel) {
        var parts = D.mixParts(lp, dim.key, mixSel);
        var others = D.otherParts(mixSel, [dim.key]);
        return U.btGroup({
          cap: dim.name,
          tip: dim.hint ? {
            title: dim.name,
            text: dim.hint
          } : null,
          capSub: others.length ? 'срез: ' + others.map(function (p) {
            return p.cat.name;
          }).join(' · ') : '',
          head: '',
          valueHead: 'Человек',
          metricKey: 'hc_total',
          compact: true,
          sort: !!dim.sort,
          items: dim.cats.map(function (c, i) {
            return {
              name: c.name,
              value: parts[i],
              color: D.dimColor(dim.key),
              pick: c.id,
              on: sel.has(c.id)
            };
          })
        });
      }
      function treeTable(dim, lp, sel, mixSel, open) {
        var kid = D.MIX_BY_KEY[dim.childDim];
        var tree = D.mixTree(lp, dim.key, mixSel).slice().sort(function (a, b) {
          return b.value - a.value;
        });
        var col = D.dimColor(dim.key),
          items = [];
        tree.forEach(function (n) {
          var on = open.has(n.cat.id);
          items.push({
            name: n.cat.name,
            value: n.value,
            color: col,
            depth: 1,
            exp: n.cat.id,
            open: on,
            pick: n.cat.id,
            on: sel.has(n.cat.id),
            note: on ? '' : D.fmtInt(n.kids.length) + ' ' + U.plural(n.kids.length, ['специализация', 'специализации', 'специализаций'])
          });
          if (!on) return;
          n.kids.slice().sort(function (a, b) {
            return b.value - a.value;
          }).forEach(function (k) {
            items.push({
              name: k.cat.name,
              value: k.value,
              color: col,
              depth: 2,
              pick: k.cat.id,
              on: sel.has(k.cat.id)
            });
          });
        });
        var others = D.otherParts(mixSel, [dim.key, kid.key]);
        var allOpen = tree.length > 0 && tree.every(function (n) {
          return open.has(n.cat.id);
        });
        return U.btGroup({
          cap: dim.name,
          tip: dim.hint ? {
            title: dim.name,
            text: dim.hint
          } : null,
          capSub: others.length ? 'срез: ' + others.map(function (p) {
            return p.cat.name;
          }).join(' · ') : '',
          head: '',
          valueHead: 'Человек',
          metricKey: 'hc_total',
          compact: true,
          tree: true,
          items: items,
          expAll: {
            key: dim.key,
            open: allOpen
          }
        });
      }
      SC.blocks.structure = {
        subTabs: D.MIX_GROUPS.map(function (g) {
          return [g.key, g.name];
        }).concat([['custom', 'Свой срез']]),
        defaultSub: 'qual',
        title: function title(sub) {
          if (sub !== 'custom') {
            var g = D.MIX_GROUPS.find(function (x) {
              return x.key === sub;
            });
            return g ? g.title : 'Состав численности по атрибутам';
          }
          return 'Свой срез состава';
        },
        view: function view(ctx) {
          var S = ctx.S,
            sel = new Set(D.sliceParse(S.mixSel).map(function (p) {
              return p.id;
            }));
          if (ctx.sub !== 'custom') {
            var g = D.MIX_GROUPS.find(function (x) {
              return x.key === ctx.sub;
            }) || D.MIX_GROUPS[0];
            var open = ctx.mixOpen || new Set();
            return U.btStack(g.dims.map(function (k) {
              var dim = D.MIX_BY_KEY[k];
              return dim.childDim ? treeTable(dim, ctx.lp, sel, S.mixSel, open) : dimTable(dim, ctx.lp, sel, S.mixSel);
            })) + (sel.size ? '' : '<div class="tbl-note">Клик по строке берёт срез: численность ' + 'в карточках и в таблице подразделений пересчитается по этой категории. ' + 'Разрезы складываются — по одной категории на разрез.</div>');
          }
          var rowDim = D.MIX_BY_KEY[S.mixRows] || D.MIX_DIMS[0];
          var colDim = S.mixCols && S.mixCols !== rowDim.key ? D.MIX_BY_KEY[S.mixCols] : null;
          var h = U.mixPicker({
            dims: D.MIX_DIMS,
            rows: rowDim.key,
            cols: colDim ? colDim.key : '',
            mode: S.mixMode
          });
          if (!colDim) {
            h += rowDim.childDim ? treeTable(rowDim, ctx.lp, sel, S.mixSel, ctx.mixOpen || new Set()) : dimTable(rowDim, ctx.lp, sel, S.mixSel);
            return h + '<div class="tbl-note">Выберите колонки — и разбивка станет матрицей: ' + 'два разреза на одних осях, чтобы сравнивать не таблицы между собой, а клетки строки.</div>';
          }
          var axes = [rowDim.key, colDim.key];
          var outer = D.otherParts(S.mixSel, axes);
          var inner = D.sliceParse(S.mixSel).filter(function (p) {
            return axes.indexOf(p.dim.key) >= 0;
          });
          var cap = [outer.length ? 'срез: ' + outer.map(function (p) {
            return p.cat.name;
          }).join(' · ') : '', inner.length ? 'по осям матрицы срез не режет: ' + inner.map(function (p) {
            return p.cat.name;
          }).join(' · ') : ''].filter(Boolean).join('  ·  ');
          h += U.matrixTable({
            rowDim: rowDim,
            colDim: colDim,
            mode: S.mixMode,
            sel: sel,
            cap: cap,
            cells: D.mixMatrix(ctx.lp, rowDim.key, colDim.key, S.mixSel)
          });
          return h + '<div class="tbl-note">Клик по клетке берёт срез сразу по двум атрибутам, ' + 'по названию строки или колонки — по одному. Сумма клеток равна численности ' + 'в карточках над таблицей. Связи между атрибутами в макете заданы только для ' + 'нескольких пар: ' + U.esc(D.MIX_LINK_TEXT) + '. Остальные пары внутри команды ' + 'считаются независимыми, и на реальных данных клетки будут другими.</div>';
        }
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        G = window.TPDRAW,
        SC = window.TPSCREENS;
      function balancedSteps(lp) {
        var hc = D.aggregate(lp, 'hc_total'),
          begin = hc[0],
          end = hc[D.LAST];
        var hire = SC.sumS(D.aggregate(lp, 'hire')),
          tin = SC.sumS(D.aggregate(lp, 'transfer_in'));
        var attr = -SC.sumS(D.aggregate(lp, 'attrition')),
          tout = -SC.sumS(D.aggregate(lp, 'transfer_out'));
        return [{
          name: 'Начало',
          value: begin,
          total: true
        }, {
          name: 'Найм',
          value: hire
        }, {
          name: 'Переводы в',
          value: tin
        }, {
          name: 'Отток',
          value: attr
        }, {
          name: 'Переводы из',
          value: tout
        }, {
          name: 'Прочее',
          value: end - (begin + hire + tin + attr + tout)
        }, {
          name: 'Конец',
          value: end,
          total: true
        }];
      }
      SC.blocks.movement = {
        subTabs: [['balance', 'Баланс за период'], ['dynamics', 'Найм, отток и переводы'], ['rates', 'Замещение и темпы']],
        defaultSub: 'balance',
        title: function title(sub) {
          return sub === 'dynamics' ? 'Внешние и внутренние потоки по месяцам' : sub === 'rates' ? 'Растёт ли команда: замещение и темпы потоков' : 'Численность и из чего сложилось её изменение';
        },
        view: function view(ctx) {
          if (ctx.sub === 'rates') {
            return SC.metricLine('replace_ratio', ctx.lp, ctx.bl, ctx.S, {
              h: 300,
              title: 'Коэффициент замещения'
            }) + G.chart('diverge', {
              up: D.aggregate(ctx.lp, 'hire_rate'),
              down: D.aggregate(ctx.lp, 'turnover_m'),
              upKey: 'hire_rate',
              downKey: 'turnover_m'
            }, {
              h: 300,
              fill: true,
              title: SC.winTitle(ctx.S, 'Найм и отток на 100 человек, %'),
              upName: 'Найм на 100 человек',
              downName: 'Отток на 100 человек (текучесть)',
              legend: [{
                name: 'Найм на 100',
                color: G.C_IN
              }, {
                name: 'Отток на 100',
                color: G.C_OUT
              }]
            });
          }
          if (ctx.sub === 'dynamics') {
            return G.chart('diverge', {
              up: D.aggregate(ctx.lp, 'hire'),
              down: D.aggregate(ctx.lp, 'attrition'),
              upKey: 'hire',
              downKey: 'attrition'
            }, {
              h: 300,
              fill: true,
              title: 'Найм и отток, чел',
              legend: [{
                name: 'Приняли',
                color: G.C_IN
              }, {
                name: 'Уволились',
                color: G.C_OUT
              }]
            }) + G.chart('diverge', {
              up: D.aggregate(ctx.lp, 'transfer_in'),
              down: D.aggregate(ctx.lp, 'transfer_out'),
              upKey: 'transfer_in',
              downKey: 'transfer_out'
            }, {
              h: 300,
              fill: true,
              title: 'Переводы внутри компании, чел',
              legend: [{
                name: 'В команду',
                color: G.C_IN
              }, {
                name: 'Из команды',
                color: G.C_OUT
              }]
            });
          }
          return SC.metricLine('hc_total', ctx.lp, ctx.bl, ctx.S, {
            h: 300,
            title: 'Общая численность, чел'
          }) + G.chart('waterfall', {
            steps: balancedSteps(ctx.lp)
          }, {
            h: 300,
            fill: true,
            title: SC.winTitle(ctx.S, 'Из чего сложилось изменение за период'),
            legend: [{
              name: 'Итог месяца',
              color: G.C_TOTAL
            }, {
              name: 'Приход',
              color: G.C_IN
            }, {
              name: 'Уход',
              color: G.C_OUT
            }]
          });
        }
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        U = window.TPUI,
        G = window.TPDRAW,
        SC = window.TPSCREENS;
      SC.blocks.turnover = {
        subTabs: [['dynamics', 'Отток и текучесть'], ['reasons', 'Почему уходят'], ['who', 'Кто уходит']],
        defaultSub: 'dynamics',
        title: function title(sub) {
          return sub === 'reasons' ? 'Почему уходят: инициатор и причины' : sub === 'who' ? 'Кто уходит: стаж, грейд, стрим' : 'Отток и текучесть по месяцам';
        },
        view: function view(ctx) {
          var lp = ctx.lp,
            ytd = ' с начала года';
          if (ctx.sub === 'reasons') {
            var rs = D.exitReasons(lp, 'ytd');
            var initName = function initName(k) {
              return (D.EXIT_INITIATORS.find(function (x) {
                return x.key === k;
              }) || {}).name || '';
            };
            return U.btStack([U.btGroup({
              cap: 'Инициатор увольнения',
              capSub: ytd,
              head: '',
              valueHead: 'Человек',
              metricKey: 'attrition',
              compact: true,
              items: D.exitInitiators(lp, 'ytd').map(function (x) {
                return {
                  name: x.name,
                  note: x.note,
                  value: x.value,
                  color: G.C_OUT
                };
              })
            }), U.btGroup({
              cap: 'Причины увольнений',
              capSub: ytd,
              head: '',
              valueHead: 'Человек',
              metricKey: 'attrition',
              sort: true,
              compact: true,
              items: rs.map(function (r) {
                return {
                  name: r.name,
                  note: initName(r.init).toLowerCase(),
                  value: r.value,
                  mark: r.regret,
                  color: r.regret ? G.C_REGRET : G.C_NOREG
                };
              })
            })]) + '<div class="tbl-note">★ — нежелательный уход: причина, на которую компания могла повлиять. ' + 'ИТОГО обеих таблиц — отток с начала года (' + U.esc(D.YTD_RANGE) + '); доли внутри него в макете ' + 'сгенерированы, на проде это fire_initiative и fire_reason из витрины оттока.</div>';
          }
          if (ctx.sub === 'who') {
            var ex = D.exitProfile(lp, 'ytd');
            var early = ex.tenure.filter(function (t) {
              return t.early;
            }).reduce(function (a, t) {
              return a + t.value;
            }, 0);
            var grp = function grp(cap, sub, items, sort) {
              return U.btGroup({
                cap: cap,
                capSub: sub,
                head: '',
                valueHead: 'Человек',
                metricKey: 'attrition',
                compact: true,
                sort: !!sort,
                items: items.map(function (x) {
                  return {
                    name: x.name,
                    value: x.value,
                    color: G.C_OUT
                  };
                })
              });
            };
            return U.btStack([grp('Стаж на момент ухода', ytd + (ex.total ? ' · ранний уход, до года: ' + D.fmtInt(early) + ' чел, ' + U.pct(early / ex.total * 100) : ''), ex.tenure), grp('Грейд', ytd, ex.grade), grp('Стрим', ytd, ex.stream, true)]) + '<div class="tbl-note">ИТОГО каждой таблицы — отток с начала года (' + U.esc(D.YTD_RANGE) + '). ' + 'Доли в макете сгенерированы: стаж — типовым профилем, грейд и стрим — пропорционально ' + 'численности с поправкой на склонность к уходу. На проде это атрибуты ушедшего на дату увольнения.</div>';
          }
          return SC.dynWrap(ctx, G.chart('panels', {
            panels: [{
              name: 'Отток, чел',
              key: 'attrition',
              type: 'bar',
              series: D.aggregate(lp, 'attrition'),
              color: G.C_OUT
            }, {
              name: 'Текучесть месячная, %',
              key: 'turnover_m',
              type: 'line',
              series: D.aggregate(lp, 'turnover_m'),
              color: G.C_LINE
            }, {
              name: 'Текучесть накопительная с января, %',
              key: 'turnover_y',
              type: 'line',
              series: D.aggregate(lp, 'turnover_y'),
              color: G.C_TURN_Y
            }]
          }, {
            h: 520,
            fill: true
          }), [{
            key: 'turnover_m',
            title: 'Текучесть месячная, % · год к году'
          }, {
            key: 'turnover_y',
            title: 'Текучесть накопительная с января, % · год к году'
          }]);
        }
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        G = window.TPDRAW,
        U = window.TPUI,
        SC = window.TPSCREENS;
      var esc = U.esc;
      function planTable(lp, S) {
        var pf = D.planFact(lp),
          kpi = D.kpiFor('hire_plan', S);
        return U.statTable({
          cols: pf.cols,
          rows: [{
            sec: 'С начала года · ' + D.YTD_RANGE
          }, {
            name: 'План найма',
            fmt: 'int',
            vals: pf.plan
          }, {
            name: 'Принято',
            note: 'тот же найм, что в «Движении персонала»',
            fmt: 'int',
            vals: pf.fact
          }, {
            name: 'Выполнение плана',
            note: kpi ? 'цель KPI ' + D.fmtVal('hire_plan', kpi.green) : '',
            fmt: 'pct',
            vals: pf.done,
            state: pf.done.map(function (v) {
              return kpi ? D.stateForKpi('hire_plan', v, kpi) : 'neutral';
            })
          }, {
            name: 'Закрыто вакансий',
            fmt: 'int',
            vals: pf.closed
          }, {
            name: 'Закрыто в срок',
            fmt: 'pct',
            vals: pf.onTime
          }, {
            name: 'Среднее время закрытия',
            fmt: 'days',
            vals: pf.days
          }, {
            name: 'Доля закрытых',
            note: 'закрытые от закрытых и открытых',
            fmt: 'pct',
            vals: pf.share
          }, {
            sec: 'Вакансии на конец месяца · ' + D.CMP.cur
          }, {
            name: 'Открыто',
            fmt: 'int',
            vals: pf.open
          }].concat(pf.status.map(function (x) {
            return {
              name: x.name,
              note: x.note,
              fmt: 'int',
              vals: x.vals,
              sub: true
            };
          })).concat([{
            name: 'в т.ч. просрочено',
            note: 'открыты дольше нормы',
            fmt: 'int',
            vals: pf.overdue,
            sub: true
          }, {
            name: 'в т.ч. на замену ушедших',
            fmt: 'int',
            vals: pf.replace,
            sub: true
          }, {
            name: 'в т.ч. вакансии джунов',
            fmt: 'int',
            vals: pf.junior,
            sub: true
          }])
        });
      }
      var FUNNEL = [['Открыто вакансий', 1], ['Передано офферов', 0.63], ['Принято офферов', 0.49], ['Вышли на работу', 0.41]];
      SC.blocks.hiring = {
        subTabs: [['vacancies', 'Вакансии и срок закрытия'], ['plan', 'План-факт'], ['profile', 'Профиль найма'], ['funnel', 'Воронка']],
        defaultSub: 'vacancies',
        title: function title(sub) {
          return sub === 'funnel' ? 'Воронка найма' : sub === 'plan' ? 'План-факт подбора: массовый и профильный найм' : sub === 'profile' ? 'Откуда приходят и кого нанимаем' : 'Вакансии и скорость их закрытия';
        },
        view: function view(ctx) {
          var lp = ctx.lp;
          if (ctx.sub === 'plan') {
            return SC.metricLine('hire_plan', lp, ctx.bl, ctx.S, {
              h: 250,
              fill: false,
              title: 'Выполнение плана найма с начала года, %'
            }) + planTable(lp, ctx.S) + '<div class="tbl-note">Факт плана — найм, закрытые и открытые вакансии — те же ряды, что на ' + 'соседних вкладках. План по месяцам, тип найма, статусы, «в срок», «на замену», «джуны» и ' + '«просрочено» в макете сгенерированы; на проде это plan_fact_tf_rabota и vacancy_daily_for_digest ' + '(дашборд 34661). Пороги цели 95% / 80% — черновик, согласовать с заказчиком.</div>';
          }
          if (ctx.sub === 'profile') {
            var hp = D.hiringProfile(lp, 'ytd'),
              sub = ' с начала года';
            var tbl = function tbl(cap, capSub, items, o) {
              return U.btGroup(Object.assign({
                cap: cap,
                capSub: capSub,
                head: '',
                valueHead: 'Человек',
                metricKey: 'hire',
                compact: true,
                items: items
              }, o || {}));
            };
            var ch = hp.channels.slice().sort(function (a, b) {
              return b.value - a.value;
            }).map(function (c) {
              return {
                name: c.name,
                value: c.value,
                color: G.C_IN
              };
            }).concat([{
              name: 'Переводы из других команд',
              note: 'их доля и есть доля внутреннего найма',
              value: hp.tin,
              color: G.C_HIRE_I
            }]);
            return U.btStack([tbl('Откуда пришли', 'найм и переводы' + sub, ch), tbl('Сеньорность принятых', sub, hp.seniority.map(function (x, i) {
              return {
                name: x.name,
                value: x.value,
                color: G.C_IN,
                note: i === 0 ? 'доля = доля джунов в найме' : ''
              };
            })), tbl('Грейд принятых', sub, hp.grade.map(function (x) {
              return {
                name: x.name,
                value: x.value,
                color: G.C_IN
              };
            }))]) + '<div class="tbl-note">Итог — найм с начала года (' + esc(D.YTD_RANGE) + '), в первой таблице — вместе ' + 'с переводами в команду. Каналы и уровни в макете сгенерированы, грейд выведен из сеньорности; ' + 'на проде это mapping_channel_name и атрибуты найма из atributy_nayma (дашборд 34136).</div>';
          }
          if (ctx.sub === 'funnel') {
            var open = SC.sumS(D.aggregate(lp, 'vac_open')),
              closed = SC.sumS(D.aggregate(lp, 'vac_closed'));
            var items = FUNNEL.map(function (_ref8, i) {
              var _ref9 = _slicedToArray(_ref8, 2),
                name = _ref9[0],
                k = _ref9[1];
              return {
                name: name,
                value: i === FUNNEL.length - 1 ? Math.max(closed, Math.round(open * k)) : Math.round(open * k)
              };
            });
            return G.chart('funnel', {
              items: items
            }, {
              fill: true,
              h: Math.max(300, items.length * 74)
            }) + '<div class="tbl-note">Этапы после открытия вакансии — допущение макета: коэффициенты 0,63 / 0,49 / 0,41. Реального источника под ними пока нет.</div>';
          }
          return G.chart('panels', {
            panels: [{
              name: 'Открытые вакансии, шт',
              key: 'vac_open',
              type: 'bar',
              series: D.aggregate(lp, 'vac_open'),
              color: G.C_VAC
            }, {
              name: 'Закрытые вакансии, шт',
              key: 'vac_closed',
              type: 'bar',
              series: D.aggregate(lp, 'vac_closed'),
              color: G.C_IN
            }, {
              name: 'Срок закрытия вакансии, дн',
              key: 'time_to_fill',
              type: 'line',
              series: D.aggregate(lp, 'time_to_fill'),
              color: G.C_LINE
            }]
          }, {
            h: 520,
            fill: true
          });
        }
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        G = window.TPDRAW,
        U = window.TPUI,
        SC = window.TPSCREENS;
      var esc = U.esc;
      var pct = function pct(a, b) {
        return b ? +(a / b * 100).toFixed(1) : null;
      };
      SC.blocks.tgrowth = {
        subTabs: [['flow', 'Конверсия и решения'], ['requests', 'Заявки и T@T'], ['statuses', 'Статусы по грейдам']],
        defaultSub: 'flow',
        title: function title(sub) {
          return sub === 'requests' ? 'Заявки на рост и время до повышения' : sub === 'statuses' ? 'Статусы карьерного роста по грейдам' : 'Конверсия в повышение и решения по заявкам';
        },
        view: function view(ctx) {
          if (ctx.sub === 'requests') {
            var tg = D.tgrowthProfile(ctx.lp);
            return SC.metricLine('tgrowth_tat', ctx.lp, ctx.bl, ctx.S, {
              h: 250,
              fill: false,
              title: 'Время до повышения (T@T), мес'
            }) + '<div class="bt-group"><div class="bt-cap">Заявки «Рост» по типу<span class="bt-sub">за 12 месяцев</span></div>' + U.statTable({
              cols: ['Заявок', 'Одобрено', 'Отказано', 'Конверсия'],
              fmts: ['int', 'int', 'int', 'pct'],
              firstTotal: false,
              rows: [{
                name: 'ИТОГО',
                total: true,
                vals: [tg.pass + tg.deny, tg.pass, tg.deny, pct(tg.pass, tg.pass + tg.deny)]
              }].concat(tg.types.map(function (t) {
                return {
                  name: t.name,
                  vals: [t.pass + t.deny, t.pass, t.deny, pct(t.pass, t.pass + t.deny)]
                };
              }))
            }) + '</div><div class="tbl-note">Одобрено и отказано — те же решения, что на графике «Конверсия и решения», ' + 'за 12 месяцев. Деление на типы заявок и T@T в макете сгенерированы; на проде — заявки сервиса «Рост» ' + '(metric_value, T@T в дашборде 34136).</div>';
          }
          if (ctx.sub === 'statuses') {
            var _tg = D.tgrowthProfile(ctx.lp);
            var tot = D.TG_STATUS.map(function (_, j) {
              return _tg.rows.reduce(function (a, r) {
                return a + r.cells[j];
              }, 0);
            });
            return U.heatTable({
              corner: 'Грейд',
              cols: D.TG_STATUS.map(function (x) {
                return {
                  name: x.name,
                  tip: x.tip
                };
              }),
              total: {
                name: 'ИТОГО',
                cells: tot
              },
              groups: [{
                name: 'Грейд',
                rows: _tg.rows.map(function (r) {
                  return {
                    name: r.name,
                    cells: r.cells
                  };
                })
              }]
            }) + '<div class="tbl-note">В клетке — доля людей грейда, людей видно в подсказке и в последней колонке. ' + 'Строки сходятся с разбивкой по грейдам в «Структуре», «рост состоялся» и «заявка отклонена» — ' + 'с решениями за 12 месяцев. «В карьерном росте» и «рост недоступен» в макете сгенерированы.</div>';
          }
          return SC.metricLine('tgrowth_conv', ctx.lp, ctx.bl, ctx.S, {
            h: 300,
            title: 'Конверсия T-роста, %'
          }) + G.chart('diverge', {
            up: D.aggregate(ctx.lp, 'tgrowth_pass'),
            down: D.aggregate(ctx.lp, 'tgrowth_deny'),
            upKey: 'tgrowth_pass',
            downKey: 'tgrowth_deny'
          }, {
            h: 300,
            fill: true,
            title: SC.winTitle(ctx.S, 'Из чего она считается, чел'),
            legend: [{
              name: 'Прошли',
              color: G.C_IN
            }, {
              name: 'Отказано',
              color: G.C_OUT
            }]
          });
        }
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        G = window.TPDRAW,
        U = window.TPUI,
        SC = window.TPSCREENS;
      SC.blocks.monitor = {
        subTabs: [['both', 'Динамика'], ['review', 'Ревью']],
        defaultSub: 'both',
        title: function title(sub) {
          return sub === 'review' ? 'Итоги ревью: последний цикл, ' + D.CMP.cur : 'Недоработчики, лоу-перформеры и ревью';
        },
        view: function view(ctx) {
          if (ctx.sub === 'review') {
            var rv = D.reviewProfile(ctx.lp);
            return U.btStack([U.btGroup({
              cap: 'Динамика к прошлому циклу',
              capSub: 'оценённые в цикле',
              head: '',
              valueHead: 'Человек',
              metricKey: 'hc_total',
              compact: true,
              items: rv.dyn.map(function (x) {
                return {
                  name: x.name,
                  note: x.note,
                  value: x.value,
                  color: G.C_LOWPERF
                };
              })
            }), '<div class="bt-group"><div class="bt-cap">Оценки по группам<span class="bt-sub">доля в строке</span></div>' + U.heatTable({
              cols: rv.scores.map(function (x) {
                return {
                  name: x.name,
                  tip: x.full
                };
              }),
              total: {
                name: 'ИТОГО',
                cells: rv.scores.map(function (x) {
                  return x.value;
                })
              },
              groups: rv.groups.map(function (g) {
                return {
                  name: g.name,
                  rows: g.rows.map(function (n, i) {
                    return {
                      name: n,
                      cells: g.cells[i]
                    };
                  })
                };
              })
            }) + '</div>']) + '<div class="tbl-note">«Улучшили оценку» — метрика блока: оценённые и улучшившие считаются ' + 'парой, как текучесть. Шкала оценок, первая оценка и разбивки по группам в макете сгенерированы; ' + 'на проде это summary_score, year_evaluation и management_head_flg из review_digest_us (дашборд 34661).</div>';
          }
          return SC.dynWrap(ctx, G.chart('panels', {
            panels: [{
              name: 'Недоработчики, %',
              key: 'underwork',
              type: 'line',
              series: D.aggregate(ctx.lp, 'underwork'),
              color: G.C_UNDER
            }, {
              name: 'Лоу-перформеры, %',
              key: 'low_perf',
              type: 'line',
              series: D.aggregate(ctx.lp, 'low_perf'),
              color: G.C_LOWPERF
            }, {
              name: 'Улучшили оценку в ревью, %',
              key: 'review_up',
              type: 'line',
              series: D.aggregate(ctx.lp, 'review_up'),
              color: G.C_LINE
            }]
          }, {
            h: 520,
            fill: true
          }), [{
            key: 'underwork',
            title: 'Недоработчики, % · год к году'
          }, {
            key: 'low_perf',
            title: 'Лоу-перформеры, % · год к году'
          }, {
            key: 'review_up',
            title: 'Улучшили оценку в ревью, % · год к году'
          }]);
        }
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        G = window.TPDRAW,
        U = window.TPUI,
        SC = window.TPSCREENS;
      var esc = U.esc;
      var MOCK_NOTE = 'Подневные отметки и привязка людей к офисам в макете сгенерированы: ' + 'реального источника под ними пока нет. Среднее по будням ПОЛНОГО месяца совпадает ' + 'с метрикой «посещаемость офиса» за этот месяц; в окне последних дней месяц ' + 'может быть захвачен частично, и тогда среднее по видимым дням от неё отличается.';
      SC.blocks.office = {
        subTabs: [['calendar', 'Календарь'], ['offices', 'Офисы и города'], ['people', 'Кто ходит'], ['booking', 'Бронирование'], ['dynamics', 'Динамика']],
        defaultSub: 'calendar',
        title: function title(sub) {
          return sub === 'offices' ? 'Офисы и города по посещаемости' : sub === 'people' ? 'Кто ходит в офис: грейды, роль и локация' : sub === 'booking' ? 'Качество бронирования рабочих мест' : sub === 'dynamics' ? 'Посещаемость офиса против базы' : 'Когда люди приходят в офис';
        },
        view: function view(ctx) {
          if (ctx.sub === 'dynamics') return SC.metricLine('office_att', ctx.lp, ctx.bl, ctx.S);
          var attTbl = function attTbl(cap, capSub, items, barHead) {
            return U.btGroup({
              cap: cap,
              capSub: capSub,
              head: '',
              metricKey: 'office_att',
              valueHead: 'Посещаемость',
              barHead: barHead,
              share: false,
              total: false,
              compact: true,
              items: items
            });
          };
          if (ctx.sub === 'offices') {
            var rows = D.officeRank(ctx.lp);
            if (!rows.length) return U.empty('Нет данных по офисам', 'В отборе нет сотрудников.');
            return U.btStack([attTbl('Офисы', '', rows.map(function (o) {
              return {
                name: o.name,
                note: o.city + ' · ' + D.fmtInt(o.hc) + ' чел',
                value: o.att,
                color: G.C_OFFICE,
                tip: 'сотрудников отбора: ' + D.fmtInt(o.hc)
              };
            }), 'Сравнение офисов'), attTbl('Города', 'среднее по офисам города, взвешенное по людям', D.officeByCity(ctx.lp).map(function (c) {
              return {
                name: c.name,
                note: D.fmtInt(c.hc) + ' чел · ' + c.offices + ' ' + U.plural(c.offices, ['офис', 'офиса', 'офисов']),
                value: c.att,
                color: G.C_OFFICE
              };
            }), 'Сравнение городов')]) + '<div class="tbl-note">' + esc(MOCK_NOTE) + '</div>';
          }
          if (ctx.sub === 'people') {
            return U.btStack([attTbl('Грейд', D.CMP.cur, D.attByGrade(ctx.lp).map(function (g) {
              return {
                name: g.name,
                note: D.fmtInt(g.hc) + ' чел',
                value: g.att,
                color: G.C_OFFICE
              };
            }), 'Сравнение грейдов'), attTbl('Роль и локация', D.CMP.cur, D.attByRoleLoc(ctx.lp).map(function (x) {
              return {
                name: x.name,
                note: x.code + ' · ' + D.fmtInt(x.hc) + ' чел',
                value: x.att,
                color: G.C_OFFICE
              };
            }), 'Сравнение групп')]) + '<div class="tbl-note">Среднее по строкам, взвешенное по людям, равно посещаемости отбора за ' + esc(D.CMP.cur) + '. Москва — регион «Москва и область» из состава, ТЦР — остальные регионы. ' + 'Разбивки в макете сгенерированы: в витрине посещаемости пока нет ни грейда, ни роли ' + '(SOURCES.md, §5.6) — для этих вкладок их нужно добавить.</div>';
          }
          if (ctx.sub === 'booking') {
            var bk = D.bookingQuality(ctx.lp);
            return SC.metricLine('booking_viol', ctx.lp, ctx.bl, ctx.S, {
              h: 250,
              fill: false,
              title: 'Нарушения бронирования, %'
            }) + U.btGroup({
              cap: 'Бронирования и посещения',
              capSub: D.CMP.cur + ', человеко-дни',
              head: '',
              valueHead: 'Дней',
              metricKey: 'hc_total',
              compact: true,
              items: [{
                name: 'Бронь и приход',
                value: bk.ok,
                color: G.C_OFFICE
              }, {
                name: 'Бронь без прихода',
                note: 'нарушение: место простояло',
                value: bk.noshow,
                color: G.C_OFFICE
              }, {
                name: 'Приход без брони',
                note: 'нарушение: место не учтено',
                value: bk.walkin,
                color: G.C_OFFICE
              }]
            }) + '<div class="tbl-note">Доля двух нижних строк — это и есть «Нарушения бронирования» за ' + esc(D.CMP.cur) + '; приходы в сумме — посещения месяца. Подневных броней в макете нет, разбор сгенерирован ' + 'от двух метрик блока; на проде — система бронирования рядом со СКУД.</div>';
          }
          var blocks = D.attLast(ctx.lp),
            dow = D.attByDow(ctx.lp);
          var end = blocks[blocks.length - 1];
          return G.chart('calendar', {
            blocks: blocks
          }, {
            title: 'Посещаемость по дням — по ' + end.to + ' ' + D.MONTH_GEN[end.m] + ' ' + end.y + ', %'
          }) + '<div class="bt-group"><div class="bt-cap">По дням недели, среднее за ' + D.DOW_MONTHS + ' месяца</div>' + U.barTable({
            head: 'День недели',
            metricKey: 'office_att',
            valueHead: 'Посещаемость',
            barHead: 'Сравнение дней',
            share: false,
            total: false,
            compact: true,
            items: dow.map(function (d) {
              return {
                name: d.name,
                value: d.value,
                color: d.weekend ? G.C_FLAT : G.C_OFFICE,
                note: d.weekend ? 'выходной' : ''
              };
            })
          }) + '<div class="tbl-note">' + esc(MOCK_NOTE) + '</div></div>';
        }
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        G = window.TPDRAW,
        U = window.TPUI,
        SC = window.TPSCREENS;
      var esc = U.esc;
      SC.blocks.ai = {
        subTabs: [['adoption', 'Проникновение'], ['tools', 'Инструменты и стримы']],
        defaultSub: 'adoption',
        title: function title(sub) {
          return sub === 'tools' ? 'Чем пользуются и в каких стримах' : 'Внедрение AI-инструментов';
        },
        view: function view(ctx) {
          if (ctx.sub === 'tools') {
            var ai = D.aiProfile(ctx.lp);
            var tbl = function tbl(cap, capSub, items, barHead) {
              return U.btGroup({
                cap: cap,
                capSub: capSub,
                head: '',
                metricKey: 'ai_penetration',
                valueHead: 'Сотрудников',
                barHead: barHead,
                share: false,
                total: false,
                compact: true,
                items: items
              });
            };
            return U.btStack([tbl('Инструменты', 'хотя бы раз за неделю · всего ' + D.fmtVal('ai_penetration', ai.pen), ai.tools.map(function (t) {
              return {
                name: t.name,
                value: t.value,
                color: G.C_AI
              };
            }), 'Сравнение инструментов'), tbl('Стримы', D.CMP.cur, ai.streams.slice().sort(function (a, b) {
              return b.value - a.value;
            }).map(function (x) {
              return {
                name: x.name,
                note: D.fmtInt(x.hc) + ' чел',
                value: x.value,
                color: G.C_AI
              };
            }), 'Сравнение стримов')]) + '<div class="tbl-note">Среднее по стримам, взвешенное по людям, равно проникновению отбора. ' + 'Инструменты пересекаются, поэтому их проценты не складываются в общий. Разбивки в макете ' + 'сгенерированы; на проде — penetration_unit, penetration_company и wau из AI-витрины ' + 'дашборда 34136, по инструменту и стриму сотрудника.</div>';
          }
          return SC.metricLine('ai_penetration', ctx.lp, ctx.bl, ctx.S, {
            h: 300,
            title: 'Проникновение AI, %'
          }) + G.chart('bars', {
            metricKey: 'ai_wau',
            series: D.aggregate(ctx.lp, 'ai_wau')
          }, {
            h: 300,
            fill: true,
            title: 'Активные пользователи AI (WAU), чел',
            color: G.C_AI
          });
        }
      };
    })();
  })();
  (function () {
    (function () {
      'use strict';

      var D = window.TPDATA,
        U = window.TPUI,
        G = window.TPDRAW,
        SC = window.TPSCREENS;
      var esc = U.esc;
      var HERO = ['hc_total', 'hire', 'attrition', 'turnover_y', 'regret', 'junior_share', 'ai_penetration', 'office_att'];
      function unitName(S) {
        var n = D.NODE_BY_PATH[S.unit];
        return n ? n.name : 'Ваша команда';
      }
      function worstMetrics(S, rl, bl, limit) {
        var out = [];
        D.METRICS.forEach(function (m) {
          if (!D.metricVisible(m.key, S)) return;
          if (m.better === 'flat') return;
          var v = D.lastVal(rl, m.key),
            bv = D.lastVal(bl, m.key),
            kpi = D.kpiFor(m.key, S);
          var st = kpi ? D.stateForKpi(m.key, v, kpi) : D.compareState(m.key, v, bv);
          if (st === 'bad') out.push({
            m: m,
            v: v,
            bv: bv,
            base: kpi ? kpi.green : bv,
            kpi: !!kpi
          });
        });
        return out.slice(0, limit || 3);
      }
      function bestMetrics(S, rl, bl, limit) {
        var out = [];
        D.METRICS.forEach(function (m) {
          if (!D.metricVisible(m.key, S)) return;
          if (m.better === 'flat') return;
          var v = D.lastVal(rl, m.key),
            bv = D.lastVal(bl, m.key),
            kpi = D.kpiFor(m.key, S);
          var st = kpi ? D.stateForKpi(m.key, v, kpi) : D.compareState(m.key, v, bv);
          if (st === 'good') out.push({
            m: m,
            v: v,
            bv: kpi ? kpi.green : bv,
            kpi: !!kpi
          });
        });
        return out.slice(0, limit || 2);
      }
      function pulse(S, rl, bl) {
        var good = 0,
          bad = 0,
          neu = 0;
        var mv = [];
        D.METRICS.forEach(function (m) {
          if (!D.metricVisible(m.key, S)) return;
          if (D.isStub(m.key)) return;
          var v = D.lastVal(rl, m.key),
            kpi = D.kpiFor(m.key, S);
          var st = m.better === 'flat' ? 'neutral' : kpi ? D.stateForKpi(m.key, v, kpi) : D.compareState(m.key, v, D.lastVal(bl, m.key));
          if (st === 'good') good++;else if (st === 'bad') bad++;else neu++;
          if (m.better === 'flat' || m.fmt === 'int') return;
          var yoy = D.deltasOf(rl, m.key).yoy;
          if (v == null || yoy == null) return;
          var prev = v - yoy;
          var rel = prev ? Math.abs(yoy) / Math.abs(prev) : 0;
          if (rel >= 0.05) mv.push({
            key: m.key,
            name: m.name,
            block: m.block,
            cur: v,
            prev: prev,
            yoy: yoy,
            rel: rel
          });
        });
        mv.sort(function (a, b) {
          return b.rel - a.rel;
        });
        return {
          good: good,
          bad: bad,
          neu: neu,
          movers: mv.slice(0, 3)
        };
      }
      function heroContext(k, s, rl) {
        if (k === 'hc_total') {
          var ytd = D.lastVal(rl, 'net_ytd');
          return '<span class="k-sub">с начала года <b>' + D.fmtDelta('net_ytd', ytd) + '</b></span>';
        }
        if (D.METRIC_BY_KEY[k].fmt === 'int') return '<span class="k-sub">за 12 мес <b>' + D.fmtVal(k, SC.sumS(s)) + '</b> чел</span>';
        return U.noCmpMark();
      }
      function lead(S, rl, bl) {
        var hc = D.lastVal(rl, 'hc_total'),
          w = worstMetrics(S, rl, bl, 3);
        var nU = D.unitsInScope(S);
        return 'В отборе <b>' + D.fmtInt(hc) + ' чел</b> из ' + D.fmtInt(nU) + ' ' + U.plural(nU, D.UNIT_WORDS) + ', база сравнения — <b>' + esc(D.benchmarkLabel(S)) + '</b>. ' + (w.length ? 'Требуют внимания: ' + w.map(function (x) {
          return esc(x.m.name);
        }).join(', ') + '.' : 'Критичных отклонений от базы нет.');
      }
      function bullets(S, rl, bl) {
        var out = [];
        worstMetrics(S, rl, bl, 3).forEach(function (x) {
          out.push('<b>' + esc(x.m.name) + '</b>: ' + D.fmtVal(x.m.key, x.v) + ' при ' + (x.kpi ? 'цели KPI ' : 'базе ') + D.fmtVal(x.m.key, x.base) + '. Отклонение ' + D.fmtDelta(x.m.key, +(x.v - x.base).toFixed(1)) + ' — смотрите разбивку по подразделениям в блоке «' + esc(D.BLOCK_BY_KEY[x.m.block].name) + '».');
        });
        bestMetrics(S, rl, bl, 2).forEach(function (x) {
          out.push('<b>' + esc(x.m.name) + '</b> лучше ' + (x.kpi ? 'цели KPI' : 'базы') + ': ' + D.fmtVal(x.m.key, x.v) + ' против ' + D.fmtVal(x.m.key, x.bv) + '.');
        });
        out.push('Сравнение пересчитано под ваши разрезы: смените покраску или разрез IT — и база, и выводы изменятся.');
        out.push('Численность, найм и переводы не окрашиваются светофором: отклонение от базы здесь не оценка, а факт масштаба.');
        return out;
      }
      function render(S, openRows) {
        var rl = D.reportLeaves(S),
          bl = D.benchmarkLeaves(S);
        if (!rl.length) return U.empty('Нет данных по выбранным разрезам', 'В этом подразделении нет команд, подходящих под текущие фильтры. Снимите один из разрезов в шапке.');
        var h = '<div class="page-h"><h2>Сводка по всем метрикам</h2>' + '<p>Все ключевые метрики команды на одном экране: значение, изменение ' + esc(D.CMP.momFull) + ' и ' + esc(D.CMP.yoy) + ', динамика и сравнение с базой <b>' + esc(D.benchmarkLabel(S)) + '</b>; там, где есть утверждённый KPI, метрика сравнивается с целью, а не с базой. ' + 'Нажмите на строку — каретка справа развернёт график.</p></div>';
        h += U.aiBlock('op', 'Как читать эту сводку', lead(S, rl, bl), bullets(S, rl, bl), S.aiOpen === 'op', 'insight');
        h += U.pulseStrip(pulse(S, rl, bl));
        var heroKeys = HERO.filter(function (k) {
          return D.metricVisible(k, S);
        });
        h += '<div class="kpis' + (heroKeys.length > 6 ? ' n4' : '') + '">';
        heroKeys.forEach(function (k) {
          var s = D.aggregate(rl, k),
            v = s[D.LAST],
            dl = D.deltasOf(rl, k);
          var kpi = D.kpiFor(k, S),
            bv = D.lastVal(bl, k);
          var st = kpi ? D.stateForKpi(k, v, kpi) : D.compareState(k, v, bv);
          h += U.kpiCard({
            label: D.METRIC_BY_KEY[k].name,
            tag: D.isStub(k) ? U.demoTag() : '',
            q: U.infoDot(k),
            value: D.fmtVal(k, v),
            row1: U.momChip(k, dl.mom) + G.sparkLine(s, st, 84, 24, {
              key: k,
              kpi: kpi,
              base: !kpi && D.comparable(k) ? D.aggregate(bl, k) : null
            }),
            row2: kpi ? '<span class="k-sub">цель ' + D.fmtVal(k, kpi.green) + '</span><span class="kpi-tag">KPI</span>' : D.comparable(k) ? '<span class="k-sub">база ' + D.fmtVal(k, bv) + '</span>' : heroContext(k, s, rl),
            row3: 'год назад <b>' + D.fmtVal(k, SC.yearAgo(rl, k)) + '</b>'
          });
        });
        h += '</div>' + U.trafficLegend();
        h += U.blockNav(D.visibleBlocks(S).map(function (b) {
          return Object.assign({
            key: b.key,
            name: b.name
          }, D.blockSignal(b.key, S));
        }));
        D.visibleBlocks(S).forEach(function (b) {
          h += '<div class="block-h" id="op-' + b.key + '"><span class="block-name">' + esc(b.name) + '</span>' + '<span class="block-hint">' + esc(b.hint) + '</span>' + '<button class="btn ghost" data-tab="' + b.key + '">Подробнее →</button></div>';
          var thSub = function thSub(s) {
            return '<span class="th-sub">' + esc(s) + '</span>';
          };
          var bMets = D.visibleMetricsOfBlock(b.key, S);
          var allOpen = bMets.length > 0 && bMets.every(function (m) {
            return openRows.has(m.key);
          });
          var t = '<table class="mtable">' + '<colgroup><col style="width:26%"><col style="width:12%"><col style="width:10%"><col style="width:10%"><col>' + '<col style="width:19%"><col style="width:28px"></colgroup>' + '<thead><tr><th>Метрика</th><th class="num">Значение</th>' + '<th class="num">За месяц' + thSub(D.CMP.momFull) + '</th>' + '<th class="num">За год' + thSub(D.CMP.yoy) + '</th><th class="mid">12 мес</th>' + '<th class="mid">Сравнение' + thSub('база или цель KPI') + '</th>' + '<th class="col-caret">' + U.allCaret('data-opexpall', b.key + '|' + (allOpen ? '0' : '1'), allOpen, 'Графики всех метрик блока разом.') + '</th></tr></thead><tbody>';
          bMets.forEach(function (m) {
            var s = D.aggregate(rl, m.key),
              v = s[D.LAST],
              dl = D.deltasOf(rl, m.key);
            var kpi = D.kpiFor(m.key, S),
              bv = D.lastVal(bl, m.key);
            var st = kpi ? D.stateForKpi(m.key, v, kpi) : D.compareState(m.key, v, bv);
            var bser = !kpi && D.comparable(m.key) ? D.aggregate(bl, m.key) : null;
            var open = openRows.has(m.key);
            t += '<tr class="mrow' + (open ? ' open' : '') + '" data-metric="' + m.key + '">' + '<td class="m-name bar-' + st + '">' + esc(m.name) + (D.isStub(m.key) ? U.demoTag() : '') + '<span class="m-sub">' + esc(m.hint) + '</span></td>' + '<td class="m-val">' + D.fmtVal(m.key, v) + '</td>' + '<td class="col-num">' + U.deltaChip(m.key, dl.mom, {
              tip: D.CMP.momTip
            }) + '</td>' + '<td class="col-num">' + U.deltaChip(m.key, dl.yoy, {
              tip: D.CMP.yoyTip
            }) + '</td>' + '<td class="col-spark">' + (!kpi && !D.comparable(m.key) ? G.sparkLine(s, 'neutral', 180, 28, {
              key: m.key,
              ink: true,
              fit: true
            }) : G.sparkBars(s, st, 180, 28, {
              key: m.key,
              base: bser,
              kpi: kpi,
              flat: !D.comparable(m.key)
            })) + '</td>' + '<td class="col-tgt">' + U.targetCell(m.key, v, bv, kpi) + '</td>' + '<td class="col-caret">' + U.rowCaret(open) + '</td></tr>';
            if (open) {
              t += '<tr class="detail-row"><td colspan="7"><div class="detail-chart">' + U.detailSplit(SC.yoyChart(m.key, rl, bl, S, {
                title: 'Год к году',
                h: 280,
                fill: false
              }), G.chart('line', {
                metricKey: m.key,
                series: s,
                bench: bser
              }, {
                title: kpi ? '12 мес и цель KPI' : bser ? '12 мес и база' : '12 мес',
                legend: bser ? [{
                  name: unitName(S),
                  color: G.C_LINE
                }, {
                  name: D.benchmarkLabel(S),
                  color: G.C_BENCH,
                  dash: true
                }] : null,
                benchName: D.benchmarkLabel(S),
                kpi: kpi,
                h: 280
              })) + '</div></td></tr>';
            }
          });
          h += U.panel({
            body: t + '</tbody></table>'
          });
        });
        return h;
      }
      SC.onepager = {
        render: render,
        HERO: HERO
      };
    })();
  })();
  (function () {
    var D = window.TPDATA,
      G = window.TPDRAW,
      U = window.TPUI,
      SC = window.TPSCREENS,
      M = window.TPMASCOT;
    var ENV = window.TP_ENV || null;
    var ROOTEL = ENV ? ENV.root : document,
      STORE = ENV ? ENV.store : null;
    var $ = function $(s) {
      return ROOTEL.querySelector(s);
    };
    var $$ = function $$(s) {
      return ROOTEL.querySelectorAll(s);
    };
    var on = function on(t, type, fn, opt) {
      return ENV ? ENV.on(t, type, fn, opt) : t.addEventListener(type, fn, opt);
    };
    var esc = U.esc;
    var S = Object.assign({}, D.DEFAULT_STATE, {
      hiddenMetrics: D.DEFAULT_STATE.hiddenMetrics.slice(),
      mixSel: D.DEFAULT_STATE.mixSel.slice()
    });
    var DRAFT = null;
    var pulseOpen = false;
    var keep = function keep(k, v) {
      return STORE ? STORE[k] || (STORE[k] = v) : v;
    };
    var openRows = keep('openRows', new Set());
    var expanded = keep('expanded', new Set());
    var mixOpen = keep('mixOpen', new Set());
    var unitBack = keep('unitBack', []);
    var unitNames = keep('unitNames', {});
    var tq = '';
    var splitMode = 'both',
      splitShare = null;
    function urlParams() {
      var p = new URLSearchParams({
        unit: S.unit,
        paint: S.paint,
        it: S.itSeg,
        staff: S.staffType,
        tab: S.tab
      });
      if (S.hiddenMetrics && S.hiddenMetrics.length) p.set('hide', S.hiddenMetrics.join(','));
      if (S.mixSel && S.mixSel.length) p.set('mix', S.mixSel.join(','));
      if (S.mixRows !== D.DEFAULT_STATE.mixRows) p.set('mxr', S.mixRows);
      if (S.mixCols !== D.DEFAULT_STATE.mixCols) p.set('mxc', S.mixCols || '');
      if (S.mixMode !== D.DEFAULT_STATE.mixMode) p.set('mxm', S.mixMode);
      if (S.dyn !== D.DEFAULT_STATE.dyn) p.set('dyn', S.dyn);
      return p;
    }
    function readURL() {
      if (ENV) return;
      var q = new URLSearchParams(location.search);
      var map = {
        unit: 'unit',
        paint: 'paint',
        it: 'itSeg',
        staff: 'staffType',
        tab: 'tab',
        sub: 'subTab'
      };
      Object.entries(map).forEach(function (_ref0) {
        var _ref1 = _slicedToArray(_ref0, 2),
          k = _ref1[0],
          f = _ref1[1];
        var v = q.get(k);
        if (v) S[f] = v;
      });
      var hide = q.get('hide');
      if (hide != null) S.hiddenMetrics = D.sanitizeHidden(hide.split(',').filter(Boolean));
      var mix = q.get('mix');
      if (mix != null) S.mixSel = D.sliceParse(mix.split(',').filter(Boolean)).map(function (x) {
        return x.id;
      });
      var mxr = q.get('mxr'),
        mxc = q.get('mxc'),
        mxm = q.get('mxm');
      if (mxr && D.MIX_BY_KEY[mxr]) S.mixRows = mxr;
      if (mxc != null) S.mixCols = D.MIX_BY_KEY[mxc] ? mxc : '';
      if (mxm && ['abs', 'row', 'col'].indexOf(mxm) >= 0) S.mixMode = mxm;
      var dyn = q.get('dyn');
      if (dyn === 'yoy' || dyn === 'roll') S.dyn = dyn;
      if (!D.NODE_BY_PATH[S.unit]) S.unit = D.DEFAULT_STATE.unit;
    }
    function writeURL() {
      if (ENV) return;
      history.replaceState(null, '', '?' + urlParams().toString());
    }
    function shareLink() {
      return location.origin + location.pathname + '?' + urlParams().toString();
    }
    function pushBack(p) {
      if (unitBack[unitBack.length - 1] === p) return;
      unitBack.push(p);
      if (unitBack.length > 10) unitBack.shift();
    }
    function goUnit(p, back) {
      if (ENV) {
        requestUnit(p, back);
        return;
      }
      if (!D.NODE_BY_PATH[p] || p === S.unit) return;
      if (!back) pushBack(S.unit);
      S.unit = p;
      S.selNode = null;
      expanded.clear();
      openRows.clear();
      tq = '';
      render();
    }
    function unitId(p) {
      if (!p) return null;
      if (p === 'T') return D.REAL.rootId;
      var last = p.split('/').pop();
      return last === '·' ? null : last;
    }
    function curReq() {
      return {
        unit: S.unit,
        paint: S.paint,
        itSeg: S.itSeg,
        staffType: S.staffType
      };
    }
    var _pendT = null;
    function request(next) {
      var id = unitId(next.unit);
      if (!id) return;
      var mask = [];
      if (id !== D.REAL.defId) mask.push({
        column: 'unit_f',
        operator: 'IN',
        value: [id]
      });
      [['paint', 'paint_f'], ['itSeg', 'it_f'], ['staffType', 'staff_f']].forEach(function (_ref10) {
        var _ref11 = _slicedToArray(_ref10, 2),
          k = _ref11[0],
          col = _ref11[1];
        var v = next[k] !== 'all' ? D.REAL.filterValue(k, next[k]) : null;
        if (v) mask.push({
          column: col,
          operator: 'IN',
          value: [v]
        });
      });
      var nm = (D.NODE_BY_PATH[next.unit] || {}).name || unitNames[next.unit] || '';
      unitNames[next.unit] = nm;
      unitNames[S.unit] = (D.NODE_BY_PATH[S.unit] || {}).name || unitNames[S.unit] || '';
      STORE.pending = {
        unit: next.unit,
        name: nm,
        at: Date.now()
      };
      STORE.warn = '';
      if (!ENV.emit(mask)) {
        STORE.pending = null;
        STORE.warn = 'Фильтры не применились: здесь нет кросс-фильтра — откройте чарт на дашборде.';
      }
      ROOTEL.classList.toggle('tp-busy', !!STORE.pending);
      clearTimeout(_pendT);
      _pendT = setTimeout(function () {
        if (!STORE.pending) return;
        STORE.pending = null;
        ROOTEL.classList.remove('tp-busy');
        STORE.warn = 'Ответ не пришёл за 45 секунд. Проверьте кросс-фильтры чарта в настройках дашборда.';
        renderHead();
      }, 45000);
      renderHead();
    }
    function requestUnit(p, back) {
      if (p === S.unit || !unitId(p)) return;
      if (!back) pushBack(S.unit);
      request(Object.assign(curReq(), {
        unit: p
      }));
    }
    function arrive() {
      var prev = STORE.S;
      if (prev) {
        Object.assign(S, prev, {
          unit: D.DEFAULT_STATE.unit,
          paint: D.DEFAULT_STATE.paint,
          itSeg: D.DEFAULT_STATE.itSeg,
          staffType: D.DEFAULT_STATE.staffType
        });
        var ui = STORE.ui || {};
        tq = ui.tq || '';
        splitMode = ui.splitMode || 'both';
        splitShare = ui.splitShare != null ? ui.splitShare : null;
        if (prev.unit !== S.unit) {
          S.selNode = null;
          expanded.clear();
          openRows.clear();
          tq = '';
        }
      }
      var pend = STORE.pending;
      STORE.pending = null;
      clearTimeout(_pendT);
      ROOTEL.classList.remove('tp-busy');
      if (pend) STORE.warn = pend.unit !== S.unit && D.REAL.scopeId !== unitId(pend.unit) ? '«' + (pend.name || 'Юнит') + '» не открылся: его нет в данных последнего полного месяца.' : '';
      if (D.REAL.truncated) STORE.warn = 'Ответ датасета обрезан лимитом строк чарта — часть подразделений не показана. ' + 'Поднимите «Лимит строк» в настройках чарта.';
      if (D.REAL.noMeta) STORE.warn = 'В ответе нет служебной строки meta: датасет не тот или «Лимит строк» слишком мал.';
      if (D.REAL.missing.length) STORE.warn = 'В данных чарта нет колонок: ' + D.REAL.missing.join(', ') + ' — добавьте их в «Измерения» чарта.';
      unitNames[S.unit] = (D.NODE_BY_PATH[S.unit] || {}).name || '';
      var bl = $('#btnLink');
      if (bl) bl.style.display = 'none';
      ROOTEL.classList.add('tp-pilot');
      var lg = $('.logo small');
      if (lg) lg.textContent = 'Hub · пробник';
      var ph = $('#planHost');
      if (ph && window.TPREAL) ph.innerHTML = U.planTable(window.TPREAL.PLAN);
    }
    function pilotChips() {
      var h = '';
      var p = STORE.pending;
      if (p) h += '<span class="chip busy">Загружаю «' + esc(p.name || '…') + '»…</span>';
      if (STORE.warn) h += '<span class="chip warn">' + esc(STORE.warn) + '</span>';
      h += '<span class="chip pilot"' + U.tipAttr({
        title: 'Пробник на живых данных',
        text: 'Живое — из hr_structure_overall: численность, найм, увольнения, переводы, текучесть, regret ' + 'и оценки перформанса. Метрики и разбивки с пометкой «демо» — заглушки до подключения своих источников.',
        note: 'Данные — по ' + D.CMP.cur + ' включительно: текущий месяц неполный и в отчёт не идёт.'
      }) + '>Пробник · «демо» — заглушки</span>';
      return h;
    }
    function renderHead() {
      var n = D.NODE_BY_PATH[S.unit],
        par = D.NODE_BY_PATH[n.parent];
      var pp = unitBack[unitBack.length - 1];
      var prev = D.NODE_BY_PATH[pp] || (pp && unitNames[pp] ? {
        name: unitNames[pp]
      } : null);
      var nav = (prev ? '<button class="nb" data-uback="1"' + U.tipAttr({
        title: 'Назад',
        text: 'Вернуться к «' + prev.name + '» — подразделению до последнего перехода.'
      }) + '>← Назад</button>' : '') + (par ? '<button class="nb" data-crumb="' + par.path + '"' + U.tipAttr({
        title: 'Уровнем выше',
        text: 'Перейти к «' + par.name + '».'
      }) + '>↑ Уровнем выше</button>' : '');
      $('#crumbs').innerHTML = (nav ? '<span class="nbs">' + nav + '</span>' : '') + D.ancestorsOf(S.unit).map(function (a, i, arr) {
        return i === arr.length - 1 ? '<span>' + esc(a.name) + '</span>' : '<button data-crumb="' + a.path + '">' + esc(a.name) + '</button><span class="sep">/</span>';
      }).join('');
      $('#unitTitle').innerHTML = esc(n.name) + '<span class="lvl">' + esc(D.levelLabel(n.level)) + '</span>';
      var chips = D.filterChips(S);
      var html = chips.map(function (c) {
        return '<span class="chip">' + esc(c.label) + '<button class="x" data-unchip="' + c.k + '"' + U.tipAttr({
          title: 'Снять разрез',
          text: c.label
        }) + '>×</button></span>';
      }).join('');
      html += '<span class="chip bench">Сравнение: <b>' + esc(D.benchmarkLabel(S)) + '</b></span>';
      var nT = D.unitsInScope(S);
      html += '<span class="chip bench">' + D.fmtInt(nT) + ' ' + U.plural(nT, D.UNIT_WORDS) + (ENV ? ' в таблице' : ' в отборе') + '</span>';
      html += '<span class="chip bench">Период: <b>' + esc(D.PERIOD_LABEL) + '</b></span>';
      if (ENV) html += pilotChips();
      $('#chips').innerHTML = html;
      var fr = $('#freshness');
      if (fr) fr.innerHTML = '<span class="dot"></span>закрытый месяц <b>' + esc(D.CMP.cur) + '</b>';
    }
    function renderNav() {
      $('#navBlocks').innerHTML = D.visibleBlocks(S).map(function (b) {
        return ('<button class="nav-i' + (S.tab === b.key ? ' active' : '') + '" data-tab="' + b.key + '"><span class="ico sig-' + D.blockSignal(b.key, S).state + '"></span>' + esc(b.name) + '</button>'
        );
      }).join('');
      $$('.nav-i[data-tab="onepager"]').forEach(function (b) {
        return b.classList.toggle('active', S.tab === 'onepager');
      });
    }
    function renderMascot() {
      if (!M) return;
      $('#navFoot').innerHTML = M.dock(S, pulseOpen);
      $('#pulseHost').innerHTML = pulseOpen ? M.panel(S) : '';
    }
    function pulse(on) {
      if (pulseOpen === on) return;
      pulseOpen = on;
      renderMascot();
    }
    function mountStaticMascots() {
      if (!M) return;
      var sp = $('#setupPulse');
      if (sp) sp.innerHTML = M.img('setup', 54);
      var htp = $('#helpTopPulse');
      if (htp) htp.innerHTML = M.img('point', 54);
      var hp = $('#helpPulse');
      if (hp) hp.innerHTML = '<span>Это — правила чтения всего отчёта. А что означает конкретная метрика — ' + 'спросите у <b>Пульса</b>: он внизу слева и знает метрики той вкладки, где вы стоите.</span>';
    }
    function openSetup() {
      DRAFT = {
        unit: S.unit,
        paint: S.paint,
        itSeg: S.itSeg,
        staffType: S.staffType,
        hiddenMetrics: (S.hiddenMetrics || []).slice()
      };
      var path = new Set(D.ancestorsOf(S.unit).map(function (a) {
        return a.path;
      }));
      var opts = ENV ? function () {
        var out = [],
          top = D.ROOT.level || 1;
        (function walk(n) {
          if (!n || n.direct) return;
          if (n.level <= top + 3 || path.has(n.path)) out.push(n);
          D.childrenOf(n.path).forEach(walk);
        })(D.ROOT);
        return out;
      }() : D.NODES.filter(function (n) {
        return n.level <= 4 || path.has(n.path);
      }).sort(function (a, b) {
        return a.sort - b.sort;
      });
      $('#selUnit').innerHTML = opts.map(function (n) {
        return '<option value="' + n.path + '"' + (n.path === DRAFT.unit ? ' selected' : '') + '>' + ' '.repeat((n.level - 1) * 3) + esc(n.name) + '</option>';
      }).join('');
      paintOpts();
      $('#setupOvl').classList.remove('hidden');
    }
    function paintOpts() {
      var row = function row(id, list, field) {
        $(id).innerHTML = list.map(function (o) {
          return '<button class="opt' + (DRAFT[field] === o.key ? ' on' : '') + '" data-f="' + field + '" data-v="' + o.key + '">' + esc(o.name) + '</button>';
        }).join('');
      };
      row('#optPaint', D.PAINTS, 'paint');
      row('#optIt', D.ITSEGS, 'itSeg');
      row('#optStaff', D.STAFFTYPES, 'staffType');
      metricOpts();
      var d = Object.assign({}, S, DRAFT);
      var rl = D.reportLeaves(d),
        bl = D.benchmarkLeaves(d);
      $('#benchPreview').innerHTML = 'Ваша команда: <b>' + esc(D.NODE_BY_PATH[d.unit].name) + '</b>, ' + D.fmtInt(D.unitsInScope(d)) + ' ' + U.plural(D.unitsInScope(d), D.UNIT_WORDS) + ', ' + D.fmtVal('hc_total', D.lastVal(rl, 'hc_total')) + ' чел.<br>Все метрики будут сравниваться с базой <b>' + esc(D.benchmarkLabel(d)) + '</b> — ' + D.fmtVal('hc_total', D.lastVal(bl, 'hc_total')) + ' чел.';
    }
    function metricOpts() {
      var hid = new Set(DRAFT.hiddenMetrics),
        cur = D.activePreset(DRAFT);
      $('#optPreset').innerHTML = D.METRIC_PRESETS.map(function (p) {
        return '<button class="opt' + (cur === p.key ? ' on' : '') + '" data-mpreset="' + p.key + '">' + esc(p.name) + '</button>';
      }).join('');
      $('#metricPick').innerHTML = D.BLOCKS.map(function (b) {
        var items = D.metricsOfBlock(b.key).map(function (m) {
          if (D.LOCKED_METRICS.has(m.key)) return '<button class="mp-i on lock" disabled' + U.tipAttr({
            title: m.name,
            text: 'Базовая метрика отчёта, отключить нельзя.'
          }) + '><span class="box"></span><span class="nm">' + esc(m.name) + '</span><span class="lk">всегда</span></button>';
          return '<button class="mp-i' + (hid.has(m.key) ? '' : ' on') + '" data-mtoggle="' + m.key + '"' + U.tipAttr({
            title: m.name,
            text: m.hint || ''
          }) + '><span class="box"></span><span class="nm">' + esc(m.name) + '</span></button>';
        }).join('');
        return '<div class="mpick-g"><div class="mpick-h">' + esc(b.name) + '</div>' + '<div class="mpick-l">' + items + '</div></div>';
      }).join('');
      var hidB = D.BLOCKS.length - D.visibleBlocks(DRAFT).length;
      $('#metricCount').innerHTML = 'Выбрано <b>' + D.visibleCount(DRAFT) + '</b> из ' + D.METRICS.length + ' метрик' + (cur ? '' : ' — свой набор') + '. Отключённые уходят из one-pager, KPI-карточек и столбцов сводных ' + 'таблиц; графики в детальных листах остаются.' + (hidB ? ' Блоков скрыто целиком: <b>' + hidB + '</b> — они исчезнут и из меню слева.' : '');
    }
    function toggleMix(spec) {
      var want = String(spec).split(',').filter(Boolean);
      var cur = D.sliceParse(S.mixSel).map(function (p) {
        return p.id;
      });
      if (want.every(function (id) {
        return cur.indexOf(id) >= 0;
      })) {
        S.mixSel = cur.filter(function (id) {
          return want.indexOf(id) < 0;
        });
        return;
      }
      want.forEach(function (id) {
        var dim = id.split(':')[0];
        cur = cur.filter(function (x) {
          return x.split(':')[0] !== dim;
        });
        cur.push(id);
      });
      while (cur.length > D.SLICE_MAX) cur.shift();
      S.mixSel = cur;
    }
    function toggleMetric(key) {
      if (D.LOCKED_METRICS.has(key)) return;
      var hid = new Set(DRAFT.hiddenMetrics);
      hid.has(key) ? hid.delete(key) : hid.add(key);
      DRAFT.hiddenMetrics = D.sanitizeHidden(_toConsumableArray(hid));
      metricOpts();
    }
    function closeSetup() {
      $('#setupOvl').classList.add('hidden');
      DRAFT = null;
    }
    function applySetup() {
      if (ENV) {
        var changed = DRAFT.unit !== S.unit || DRAFT.paint !== S.paint || DRAFT.itSeg !== S.itSeg || DRAFT.staffType !== S.staffType;
        S.hiddenMetrics = DRAFT.hiddenMetrics.slice();
        if (S.mainMetric && !D.metricVisible(S.mainMetric, S)) S.mainMetric = null;
        var next = {
          unit: DRAFT.unit,
          paint: DRAFT.paint,
          itSeg: DRAFT.itSeg,
          staffType: DRAFT.staffType
        };
        openRows.clear();
        closeSetup();
        if (changed) {
          if (next.unit !== S.unit) pushBack(S.unit);
          request(next);
        } else render();
        return;
      }
      if (DRAFT.unit !== S.unit) {
        pushBack(S.unit);
        S.selNode = null;
        expanded.clear();
        tq = '';
      }
      Object.assign(S, DRAFT);
      if (S.mainMetric && !D.metricVisible(S.mainMetric, S)) S.mainMetric = null;
      openRows.clear();
      closeSetup();
      render();
    }
    function navOpen(on) {
      var nav = $('#sideNav'),
        scr = $('#navScrim'),
        btn = $('#navToggle');
      if (!nav) return;
      nav.classList.toggle('open', on);
      scr.classList.toggle('open', on);
      btn.setAttribute('aria-expanded', String(on));
    }
    function enhanceA11y() {
      $$('.nav-i').forEach(function (x) {
        x.setAttribute('aria-current', x.classList.contains('active') ? 'page' : 'false');
      });
      $$('.mrow,.urow,.mx-cell').forEach(function (x) {
        x.tabIndex = 0;
        x.setAttribute('role', 'button');
      });
      $$('.ai-h').forEach(function (x) {
        x.tabIndex = 0;
        x.setAttribute('role', 'button');
        x.setAttribute('aria-expanded', String(S.aiOpen === x.dataset.ai));
      });
    }
    function render(keepScroll, quiet) {
      var sc = ENV ? ENV.scroller : null;
      var y = keepScroll ? sc ? sc.scrollTop : window.pageYOffset || 0 : 0;
      if (S.tab !== 'onepager' && !(D.BLOCK_BY_KEY[S.tab] && D.blockVisible(S.tab, S))) {
        S.tab = 'onepager';
        S.subTab = null;
      }
      G.reset();
      renderHead();
      renderNav();
      writeURL();
      $('#view').innerHTML = S.tab === 'onepager' ? SC.onepager.render(S, openRows) : SC.renderBlock(S, expanded, mixOpen, {
        tq: tq,
        split: {
          mode: splitMode,
          share: splitShare
        }
      });
      G.remeasure($('#view'), !quiet);
      stickTotals();
      renderMascot();
      enhanceA11y();
      navOpen(false);
      if (sc) {
        if (keepScroll) sc.scrollTop = y;else if (sc.scrollTo) sc.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else if (keepScroll) window.scrollTo(0, y);else window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      spyBlocks();
      if (STORE) {
        STORE.S = S;
        STORE.ui = {
          tq: tq,
          splitMode: splitMode,
          splitShare: splitShare
        };
      }
    }
    function stickTotals() {
      $$('.ptable.dense').forEach(function (t) {
        var h = t.tHead ? t.tHead.getBoundingClientRect().height : 0;
        if (h) t.style.setProperty('--thead-h', Math.round(h) + 'px');
      });
    }
    function splitBounds(box) {
      var room = box.getBoundingClientRect().width - 16;
      return [Math.max(.2, 340 / room), Math.min(.8, 1 - 340 / room)];
    }
    function applySplit(box, share) {
      var gut = box.querySelector('[data-split]');
      if (share == null) {
        box.classList.remove('custom');
        box.style.removeProperty('--split-l');
        box.style.removeProperty('--split-r');
        if (gut) gut.removeAttribute('aria-valuenow');
        return;
      }
      box.classList.add('custom');
      box.style.setProperty('--split-l', (share * 100).toFixed(2) + 'fr');
      box.style.setProperty('--split-r', ((1 - share) * 100).toFixed(2) + 'fr');
      if (gut) gut.setAttribute('aria-valuenow', String(Math.round(share * 100)));
    }
    function relayout() {
      G.remeasure($('#view'));
      stickTotals();
    }
    var _sd = null;
    on(document, 'pointerdown', function (e) {
      var gut = e.target.closest && e.target.closest('[data-split]');
      if (!gut || e.button > 0) return;
      var box = gut.parentNode,
        r = box.getBoundingClientRect(),
        b = splitBounds(box);
      e.preventDefault();
      try {
        gut.setPointerCapture(e.pointerId);
      } catch (_) {}
      document.body.classList.add('split-drag');
      var move = function move(ev) {
        splitShare = Math.max(b[0], Math.min(b[1], (ev.clientX - r.left - 8) / (r.width - 16)));
        applySplit(box, splitShare);
        if (!_sd) _sd = setTimeout(function () {
          _sd = null;
          relayout();
        }, 60);
      };
      var _up = function up() {
        gut.removeEventListener('pointermove', move);
        gut.removeEventListener('pointerup', _up);
        gut.removeEventListener('pointercancel', _up);
        document.body.classList.remove('split-drag');
        clearTimeout(_sd);
        _sd = null;
        relayout();
      };
      gut.addEventListener('pointermove', move);
      gut.addEventListener('pointerup', _up);
      gut.addEventListener('pointercancel', _up);
    });
    on(document, 'dblclick', function (e) {
      var gut = e.target.closest && e.target.closest('[data-split]');
      if (!gut) return;
      splitShare = null;
      applySplit(gut.parentNode, null);
      relayout();
    });
    var _spy = 0;
    function spyBlocks() {
      _spy = 0;
      var nav = $('.op-nav');
      if (!nav) return;
      var edge = nav.getBoundingClientRect().bottom + 48;
      var cur = null;
      $$('.block-h[id^="op-"]').forEach(function (h) {
        if (h.getBoundingClientRect().top <= edge) cur = h.id.slice(3);
      });
      nav.querySelectorAll('[data-jump]').forEach(function (b) {
        return b.classList.toggle('on', b.dataset.jump === cur);
      });
    }
    on(ENV ? ENV.scroller : window, 'scroll', function () {
      if (!_spy) _spy = requestAnimationFrame(spyBlocks);
    }, {
      passive: true
    });
    var _rz = null;
    on(window, 'resize', function () {
      clearTimeout(_rz);
      _rz = setTimeout(function () {
        G.remeasure($('#view'));
        stickTotals();
      }, 140);
    });
    on(document, 'click', function (e) {
      var t = e.target;
      if (pulseOpen && !t.closest('#pulsePanel') && !t.closest('#pulseDock')) pulse(false);
      if (t.closest('#pulseDock')) {
        pulse(!pulseOpen);
        return;
      }
      if (t.closest('#pulseClose')) {
        pulse(false);
        return;
      }
      if (t.closest('#pulseToHelp')) {
        pulse(false);
        $('#helpOvl').classList.remove('hidden');
        return;
      }
      if (t.closest('#btnSetup')) {
        openSetup();
        return;
      }
      if (t.closest('#btnApply')) {
        applySetup();
        return;
      }
      if (t.closest('#btnCancel')) {
        closeSetup();
        return;
      }
      if (t.closest('#btnReset') && DRAFT) {
        DRAFT.paint = 'all';
        DRAFT.itSeg = 'all';
        DRAFT.staffType = 'all';
        paintOpts();
        return;
      }
      if (t.closest('#btnLink')) {
        navigator.clipboard && navigator.clipboard.writeText(shareLink());
        $('#btnLink').textContent = 'Ссылка скопирована';
        setTimeout(function () {
          return $('#btnLink').textContent = 'Скопировать ссылку';
        }, 1600);
        return;
      }
      if (t.closest('#btnHelp')) {
        $('#helpOvl').classList.remove('hidden');
        return;
      }
      if (t.closest('#btnHelpClose')) {
        $('#helpOvl').classList.add('hidden');
        return;
      }
      if (t.id === 'setupOvl') {
        closeSetup();
        return;
      }
      if (t.id === 'helpOvl') {
        $('#helpOvl').classList.add('hidden');
        return;
      }
      if (t.closest('#navToggle')) {
        navOpen(!$('#sideNav').classList.contains('open'));
        return;
      }
      if (t.id === 'navScrim') {
        navOpen(false);
        return;
      }
      var mp = t.closest('[data-mpreset]');
      if (mp && DRAFT) {
        DRAFT.hiddenMetrics = D.hiddenForPreset(mp.dataset.mpreset);
        metricOpts();
        return;
      }
      var mt = t.closest('[data-mtoggle]');
      if (mt && DRAFT) {
        toggleMetric(mt.dataset.mtoggle);
        return;
      }
      var mm = t.closest('[data-mixmode]');
      if (mm) {
        S.mixMode = mm.dataset.mixmode;
        render(true);
        return;
      }
      var opt = t.closest('.opt');
      if (opt && DRAFT) {
        DRAFT[opt.dataset.f] = opt.dataset.v;
        paintOpts();
        return;
      }
      var tab = t.closest('[data-tab]');
      if (tab) {
        S.tab = tab.dataset.tab;
        S.subTab = null;
        S.mainMetric = null;
        S.selNode = null;
        openRows.clear();
        render();
        return;
      }
      var sub = t.closest('[data-subtab]');
      if (sub) {
        S.subTab = sub.dataset.subtab;
        render(true);
        return;
      }
      var jp = t.closest('[data-jump]');
      if (jp) {
        var el = $('#op-' + jp.dataset.jump);
        if (el) el.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        return;
      }
      var dy = t.closest('[data-dyn]');
      if (dy) {
        S.dyn = dy.dataset.dyn;
        render(true);
        return;
      }
      var cr = t.closest('[data-crumb]');
      if (cr) {
        goUnit(cr.dataset.crumb);
        return;
      }
      if (t.closest('[data-uback]')) {
        var p = unitBack.pop();
        if (p) goUnit(p, true);
        return;
      }
      var un = t.closest('[data-unchip]');
      if (un) {
        if (ENV) {
          request(Object.assign(curReq(), _defineProperty({}, un.dataset.unchip, 'all')));
          return;
        }
        S[un.dataset.unchip] = 'all';
        render();
        return;
      }
      var exAll = t.closest('[data-expall]');
      if (exAll) {
        e.stopPropagation();
        expanded.clear();
        if (exAll.dataset.expall === '1') SC.expandableRows(SC.currentRoot(S)).forEach(function (p) {
          return expanded.add(p);
        });
        render(true);
        return;
      }
      var ex = t.closest('[data-exp]');
      if (ex) {
        e.stopPropagation();
        var _p = ex.dataset.exp;
        expanded.has(_p) ? expanded.delete(_p) : expanded.add(_p);
        render(true);
        return;
      }
      var smode = t.closest('[data-splitmode]');
      if (smode) {
        splitMode = smode.dataset.splitmode;
        render(true);
        return;
      }
      var ou = t.closest('[data-openunit]');
      if (ou) {
        e.stopPropagation();
        goUnit(ou.dataset.openunit);
        return;
      }
      if (t.closest('.tsearch')) return;
      if (t.closest('[data-mixclear]')) {
        S.mixSel = [];
        render(true);
        return;
      }
      if (t.closest('[data-mixswap]')) {
        var r = S.mixRows;
        S.mixRows = S.mixCols || r;
        S.mixCols = S.mixCols ? r : '';
        render(true);
        return;
      }
      var bxa = t.closest('[data-btexpall]');
      if (bxa) {
        e.stopPropagation();
        var _bxa$dataset$btexpall = bxa.dataset.btexpall.split('|'),
          _bxa$dataset$btexpall2 = _slicedToArray(_bxa$dataset$btexpall, 2),
          dim = _bxa$dataset$btexpall2[0],
          _on = _bxa$dataset$btexpall2[1];
        _toConsumableArray(mixOpen).forEach(function (k) {
          if (k.indexOf(dim + ':') === 0) mixOpen.delete(k);
        });
        if (_on === '1') (D.MIX_BY_KEY[dim].cats || []).forEach(function (c) {
          return mixOpen.add(c.id);
        });
        render(true);
        return;
      }
      var bx = t.closest('[data-btexp]');
      if (bx) {
        e.stopPropagation();
        var k = bx.dataset.btexp;
        mixOpen.has(k) ? mixOpen.delete(k) : mixOpen.add(k);
        render(true);
        return;
      }
      var mx = t.closest('[data-mix]');
      if (mx) {
        e.stopPropagation();
        toggleMix(mx.dataset.mix);
        render(true);
        return;
      }
      var lg = t.closest && t.closest('.lg[data-sid]');
      if (lg) {
        e.stopPropagation();
        if (!lg.classList.contains('lock')) {
          var box = lg.closest('.svgchart[data-cid]');
          if (box) G.toggleSeries(box.getAttribute('data-cid'), lg.getAttribute('data-sid'));
        }
        return;
      }
      var ai = t.closest('[data-ai]');
      if (ai) {
        S.aiOpen = S.aiOpen === ai.dataset.ai ? null : ai.dataset.ai;
        render(true);
        return;
      }
      var opa = t.closest('[data-opexpall]');
      if (opa) {
        e.stopPropagation();
        var _opa$dataset$opexpall = opa.dataset.opexpall.split('|'),
          _opa$dataset$opexpall2 = _slicedToArray(_opa$dataset$opexpall, 2),
          bk = _opa$dataset$opexpall2[0],
          _on2 = _opa$dataset$opexpall2[1];
        D.metricsOfBlock(bk).forEach(function (m) {
          return openRows.delete(m.key);
        });
        if (_on2 === '1') D.visibleMetricsOfBlock(bk, S).forEach(function (m) {
          return openRows.add(m.key);
        });
        render(true);
        return;
      }
      var mr = t.closest('.mrow');
      if (mr) {
        var _k = mr.dataset.metric;
        openRows.has(_k) ? openRows.delete(_k) : openRows.add(_k);
        render(true);
        return;
      }
      var ur = t.closest('.urow');
      if (ur && ur.dataset.node) {
        S.selNode = S.selNode === ur.dataset.node ? null : ur.dataset.node;
        render(true);
        return;
      }
      if (t.closest('.nav-i') && innerWidth <= 780) navOpen(false);
    });
    function searchInput(v, pos) {
      tq = v;
      render(true, true);
      var n = $('[data-tsearch]');
      if (n && n.focus) {
        n.focus();
        try {
          n.setSelectionRange(pos, pos);
        } catch (_) {}
      }
    }
    on(document, 'input', function (e) {
      var s = e.target.closest && e.target.closest('[data-tsearch]');
      if (s) searchInput(s.value, s.selectionStart);
    });
    on(document, 'change', function (e) {
      if (e.target.id === 'selUnit' && DRAFT) {
        DRAFT.unit = e.target.value;
        paintOpts();
        return;
      }
      var ax = e.target.closest && e.target.closest('[data-mixaxis]');
      if (ax) {
        var v = e.target.value;
        if (ax.dataset.mixaxis === 'rows') {
          S.mixRows = v;
          if (S.mixCols === v) S.mixCols = '';
        } else {
          S.mixCols = v === S.mixRows ? '' : v;
        }
        render(true);
      }
    });
    function lgHover(e, on) {
      var t = e.target;
      if (!t || !t.closest) return;
      var lg = t.closest('.lg[data-sid]');
      if (!lg) return;
      var box = lg.closest('.svgchart');
      if (box) G.highlight(box, on ? lg.getAttribute('data-sid') : null);
    }
    on(document, 'mouseover', function (e) {
      return lgHover(e, true);
    });
    on(document, 'mouseout', function (e) {
      return lgHover(e, false);
    });
    on(document, 'focusin', function (e) {
      return lgHover(e, true);
    });
    on(document, 'focusout', function (e) {
      return lgHover(e, false);
    });
    on(document, 'keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.mrow,.urow,.ai-h,.mx-cell')) {
        e.preventDefault();
        e.target.click();
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest) {
        var lg = e.target.closest('.lg[data-sid]');
        if (lg) {
          e.preventDefault();
          if (!lg.classList.contains('lock')) {
            var box = lg.closest('.svgchart[data-cid]'),
              sid = lg.getAttribute('data-sid');
            if (box && G.toggleSeries(box.getAttribute('data-cid'), sid)) {
              var back = box.querySelector('.lg[data-sid="' + sid + '"]');
              if (back && back.focus) back.focus();
            }
          }
          return;
        }
      }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.matches && e.target.matches('[data-split]')) {
        e.preventDefault();
        var _box2 = e.target.parentNode,
          b = splitBounds(_box2),
          l = _box2.querySelector('.split-l');
        var cur = splitShare != null ? splitShare : l.getBoundingClientRect().width / (_box2.getBoundingClientRect().width - 16);
        splitShare = Math.max(b[0], Math.min(b[1], cur + (e.key === 'ArrowRight' ? .05 : -.05)));
        applySplit(_box2, splitShare);
        relayout();
        return;
      }
      if (e.key === 'Escape' && tq && e.target.matches && e.target.matches('[data-tsearch]')) {
        searchInput('', 0);
        return;
      }
      if (e.key === 'Escape') {
        closeSetup();
        $('#helpOvl').classList.add('hidden');
        navOpen(false);
        pulse(false);
      }
    });
    mountStaticMascots();
    var noTour = ENV ? true : location.search.indexOf('tour=0') >= 0;
    readURL();
    if (ENV) arrive();
    render();
    try {
      if (!localStorage.getItem('tp_onboarded') && !noTour) {
        $('#helpOvl').classList.remove('hidden');
        $('#btnHelpClose').addEventListener('click', function () {
          return localStorage.setItem('tp_onboarded', '1');
        }, {
          once: true
        });
      }
    } catch (e) {}
  })();
} catch (err) {
  var _h = document.querySelectorAll("[_echarts_instance_]");
  var _box = _h.length ? _h[_h.length - 1] : document.body,
    _m = document.createElement("div");
  _m.style.cssText = "position:absolute;inset:0;padding:24px;font:14px Arial,sans-serif;color:#d11414;background:#fff;z-index:20";
  _m.textContent = "TeamPulse Hub: ошибка чарта — " + (err && err.message ? err.message : String(err));
  _box.appendChild(_m);
}
// ---------- Пустой option: холст ECharts не используется ----------
option = { animation: false, xAxis: { show: false, type: "value" }, yAxis: { show: false, type: "value" },
  series: [{ type: "scatter", data: [] }] };

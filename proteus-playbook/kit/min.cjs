// kit/min.cjs — сжатая сборка JS кастомного чарта Proteus (react_sanbbox) для папки поставки.
//
// Зачем. Proteus кладёт код чарта в form_data.jsx КАЖДОГО POST chart/data: открытие борда, «Применить», кросс-фильтр,
// даже ответ из кэша. Тело POST браузер не сжимает; отправка у владельца ≈50 КБ/с (DevTools 07.10), то есть 169 КБ кода —
// 5,8 с на каждый запрос. Сборка без комментариев и пробелов, с короткими локальными именами режет код на 40–45 %
// (playbook: DV-05 в 14-delivery.md, замеры — kit/RESULTS.js.md).
//
// Что НЕ трогается: верхний уровень скрипта. option, data, applyCrossFilter, имена функций и переменных верхнего
// уровня — контракт песочницы и скилла proteus-echarts-builder (toplevel: false и в compress, и в mangle). Кириллица
// остаётся как есть (ascii_only: false): «\uXXXX» втрое длиннее UTF-8. Аргументы функций не выбрасываются (keep_fargs).
//
// Запуск (terser — глобально, версия закреплена: иначе сборка поплывёт и `pack.py --check` разойдётся):
//   npm i -g terser@5.51.2
//   NODE_PATH=$(npm root -g) node kit/min.cjs 'шапка' < proteus/report.chart.js > 'Поставка/2. Чарт.js'
//   NODE_PATH=$(npm root -g) node kit/min.cjs 'шапка' --check < in.js > out.js     # + проверка результата (stderr)
//   NODE_PATH=$(npm root -g) node kit/min.cjs --verify 'Поставка/2. Чарт.js'        # проверить готовую сборку
//   NODE_PATH=$(npm root -g) node kit/min.cjs 'шапка' --css-var TP_CSS < in.js > out.js
//
// Флаги (после шапки, порядок любой):
//   --check            после сжатия проверить результат; провал — код 1, в stdout ничего не пишется;
//   --verify <файл>    только проверка готового файла (без сжатия), сводка — в stdout;
//   --css-var ИМЯ      строку CSS в `var ИМЯ = "…"` верхнего уровня сжать до сборки (без комментариев и лишних
//                      пробелов; правила CSS после сжатия те же — сверка CSSOM в kit/RESULTS.js.md); можно несколько раз;
//   --budget КБ        сборка больше — провал (код 1): каждый КБ кода — в каждом запросе данных;
//   --kbps N           скорость отправки для оценки «≈ с на запрос» (по умолчанию 50 КБ/с).
// Сводка («было → стало КБ, ≈ с отправки») — в stderr, сборка — в stdout. Без флагов вывод байт в байт как у
// detail_list:stand/min.cjs (проверено на чартах DL), так что проект может перейти на kit/min.cjs без смены поставки.
//
// Проверка (--check / --verify):
//   1. разбор acorn как ES5 (ecmaVersion 5, script): в песочнице ES5 — договор скилла; ES2015+ в сборке — ошибка;
//   2. глобальный option: присваивание `option = …` вне функций; если в исходнике это последний оператор — и в сборке;
//   3. имена верхнего уровня (var / function) исходника все на месте (только с --check: исходник под рукой);
//   4. нет eval и new Function (CSP песочницы не проверен, загрузчик кода откачен — DV-06 в 14-delivery.md);
//   5. версия terser = 5.51.2 (иначе — предупреждение: сборка разойдётся с прежней).
// Модуль: require('kit/min.cjs') → { minifyChart, verify, cssMin } для своих сборщиков.
'use strict';

const TERSER_PIN = '5.51.2';
const path = require('path');
const fs = require('fs');

// terser и acorn: из NODE_PATH; acorn — ещё и из зависимостей самого terser (у terser 5 он свой в node_modules)
function need(name) {
  try { return require(name); } catch (e) { /* дальше — рядом с terser */ }
  try {
    const base = path.dirname(require.resolve('terser'));
    return require(require.resolve(name, { paths: [base] }));
  } catch (e) {
    throw new Error('нет модуля ' + name + ': npm i -g terser@' + TERSER_PIN + ' и NODE_PATH=$(npm root -g)');
  }
}

// Параметры terser — ровно как у detail_list:stand/min.cjs (сборка 21-й…27-й поставок, работает в бою)
function terserOptions(head) {
  return {
    ecma: 5,
    toplevel: false,
    compress: { toplevel: false, keep_fargs: true },
    mangle: { toplevel: false },
    // «*/» в шапке закрыл бы комментарий раньше времени
    format: { ascii_only: false, comments: false, preamble: '/* ' + String(head || '').replace(/\*\//g, '* /') + ' */' },
  };
}

// ── CSS: сжатие строки стилей (консервативно: только комментарии и пробелы) ─────────────────────────────────────
// Строки, url(…) и var(…) переносятся как есть (у var() пробел в запасном значении — часть значения: CSSOM его хранит).
// Вне них: пробелы — по одному; вокруг { } ; , > и после «:» — без пробелов; «;» перед «}» — долой. Пробел ПЕРЕД «:»
// остаётся: «.a :hover» (потомок) и «.a:hover» — разные селекторы. «+», «-», «~» не трогаются: calc(100vh - 230px)
// без пробелов ломается. Сверка «правила те же» (CSSOM в Chromium) — kit/RESULTS.js.md.
function cssMin(css) {
  const segs = [];
  let buf = '', i = 0;
  const n = css.length;
  const flush = () => { if (buf) segs.push({ t: buf, keep: false }); buf = ''; };
  const strEnd = (j) => {                                        // конец строки в кавычках, начатой в j
    const q = css[j];
    let k = j + 1;
    while (k < n && css[k] !== q) k += css[k] === '\\' ? 2 : 1;
    return Math.min(k + 1, n);
  };
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {                       // комментарий — долой
      const j = css.indexOf('*/', i + 2);
      i = j < 0 ? n : j + 2;
      buf += ' ';
      continue;
    }
    if (c === '"' || c === "'") {                                // строка — как есть
      const j = strEnd(i);
      flush(); segs.push({ t: css.slice(i, j), keep: true }); i = j;
      continue;
    }
    const fn = /^(url|var)\(/i.exec(css.slice(i, i + 4));
    if (fn && !/[\w-]/.test(css[i - 1] || '')) {                // url(…) / var(…) — как есть, со вложенными скобками
      let j = i + fn[0].length, depth = 1;
      while (j < n && depth) {
        if (css[j] === '"' || css[j] === "'") { j = strEnd(j); continue; }
        if (css[j] === '(') depth++;
        else if (css[j] === ')') depth--;
        j++;
      }
      flush(); segs.push({ t: css.slice(i, j), keep: true }); i = j;
      continue;
    }
    if (/\s/.test(c)) {                                          // пробелы — один
      while (i < n && /\s/.test(css[i])) i++;
      buf += ' ';
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return segs.map((sg) => (sg.keep ? sg.t : sg.t.replace(/ ?([{};,>]) ?/g, '$1').replace(/: /g, ':').replace(/;}/g, '}')))
    .join('').replace(/;}/g, '}').trim();
}

// `var ИМЯ = "…css…"` верхнего уровня → та же строка, сжатая cssMin (JSON-кавычки — как у сборщика TeamPulse)
function shrinkCssVars(src, names) {
  if (!names.length) return { src, notes: [] };
  const acorn = need('acorn');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  const edits = [], notes = [];
  for (const st of ast.body) {
    if (st.type !== 'VariableDeclaration') continue;
    for (const d of st.declarations) {
      if (d.id.type === 'Identifier' && names.indexOf(d.id.name) > -1 && d.init && d.init.type === 'Literal' && typeof d.init.value === 'string') {
        const min = cssMin(d.init.value);
        edits.push([d.init.start, d.init.end, JSON.stringify(min)]);
        notes.push(d.id.name + ': CSS ' + kb(Buffer.byteLength(d.init.value)) + ' → ' + kb(Buffer.byteLength(min)));
      }
    }
  }
  const miss = names.filter((nm) => !notes.some((t) => t.indexOf(nm + ':') === 0));
  if (miss.length) throw new Error('--css-var: нет строки верхнего уровня `var ' + miss.join(', ') + ' = "…"`');
  edits.sort((a, b) => b[0] - a[0]).forEach((e) => { src = src.slice(0, e[0]) + e[2] + src.slice(e[1]); });
  return { src, notes };
}

// ── проверка сборки ──────────────────────────────────────────────────────────────────────────────────────────
// Обход без входа в функции: что выполняется на верхнем уровне скрипта
function walkTop(node, fn) {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  if (/Function/.test(node.type)) return;
  for (const k in node) {
    const v = node[k];
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
    if (Array.isArray(v)) v.forEach((x) => walkTop(x, fn));
    else if (v && typeof v.type === 'string') walkTop(v, fn);
  }
}
function walkAll(node, fn) {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const k in node) {
    const v = node[k];
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
    if (Array.isArray(v)) v.forEach((x) => walkAll(x, fn));
    else if (v && typeof v.type === 'string') walkAll(v, fn);
  }
}
function assignsOption(node) {
  let hit = false;
  walkTop(node, (x) => {
    if (x.type === 'AssignmentExpression' && x.left.type === 'Identifier' && x.left.name === 'option') hit = true;
  });
  return hit;
}
// Имена верхнего уровня: function в теле скрипта и любой var вне функций (terser переносит var в `for (var …)`)
function topNames(ast) {
  const s = new Set();
  for (const st of ast.body) if (st.type === 'FunctionDeclaration') s.add(st.id.name);
  walkTop(ast, (x) => {
    if (x.type === 'VariableDeclaration' && x.kind === 'var') x.declarations.forEach((d) => { if (d.id.type === 'Identifier') s.add(d.id.name); });
  });
  return s;
}

// → { ok, fails: [], warns: [], info: [] }
function verify(code, src) {
  const acorn = need('acorn');
  const fails = [], warns = [], info = [];
  let ast = null;
  try {
    ast = acorn.parse(code, { ecmaVersion: 5, sourceType: 'script' });
    info.push('ES5: разбор acorn (ecmaVersion 5) — ок');
  } catch (e) {
    fails.push('не ES5: ' + e.message + ' — около «' + code.slice(Math.max(0, (e.pos || 0) - 40), (e.pos || 0) + 40).replace(/\s+/g, ' ') + '»');
    try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' }); } catch (e2) { fails.push('не разбирается вовсе: ' + e2.message); }
  }
  if (ast) {
    const optTop = ast.body.some(assignsOption);
    if (!optTop) fails.push('нет глобального option: присваивания `option = …` вне функций (контракт песочницы)');
    else info.push('option: присваивается на верхнем уровне');
    const last = ast.body[ast.body.length - 1];
    let srcAst = null;
    if (src) { try { srcAst = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); } catch (e) { warns.push('исходник не разобран: ' + e.message); } }
    const srcLast = srcAst && srcAst.body[srcAst.body.length - 1];
    if (srcLast && assignsOption(srcLast) && !(last && assignsOption(last))) fails.push('option в исходнике — последний оператор, в сборке — нет');
    if (srcAst) {
      const a = topNames(srcAst), b = topNames(ast), lost = [];
      a.forEach((nm) => { if (!b.has(nm)) lost.push(nm); });
      if (lost.length) fails.push('пропали имена верхнего уровня: ' + lost.slice(0, 12).join(', ') + (lost.length > 12 ? '…' : ''));
      else info.push('имена верхнего уровня: ' + a.size + ' из ' + a.size + ' на месте');
    }
    const bad = [];
    walkAll(ast, (x) => {
      if (x.type === 'CallExpression' && x.callee.type === 'Identifier' && x.callee.name === 'eval') bad.push('eval(…)');
      if (x.type === 'NewExpression' && x.callee.type === 'Identifier' && x.callee.name === 'Function') bad.push('new Function');
    });
    if (bad.length) fails.push('в коде ' + Array.from(new Set(bad)).join(', ') + ': код из строки в песочнице не проверен (DV-06)');
  }
  try {
    const v = require(path.join(path.dirname(require.resolve('terser')), '..', 'package.json')).version;
    if (v !== TERSER_PIN) warns.push('terser ' + v + ' ≠ ' + TERSER_PIN + ': сборка разойдётся с прежней (npm i -g terser@' + TERSER_PIN + ')');
  } catch (e) { /* без terser — только --verify */ }
  return { ok: !fails.length, fails, warns, info };
}

function kb(n) { return (n / 1024).toFixed(1).replace('.', ',') + ' КБ'; }

// исходник → сборка (Promise)
async function minifyChart(src, head, opts) {
  opts = opts || {};
  const { minify } = need('terser');
  const pre = shrinkCssVars(src, opts.cssVars || []);
  const r = await minify(pre.src, terserOptions(head));
  return { code: r.code + '\n', notes: pre.notes };
}

function report(label, code, src, opts) {
  const kbps = opts.kbps || 50, b = Buffer.byteLength(code);
  const lines = [];
  if (src != null) {
    const a = Buffer.byteLength(src);
    const d = a ? Math.round((1 - b / a) * 100) : 0;
    lines.push(label + ': ' + kb(a) + ' → ' + kb(b) + ' (' + (d >= 0 ? '−' + d : '+' + -d) + ' %), ≈'
      + (b / 1024 / kbps).toFixed(1).replace('.', ',') + ' с отправки на запрос при ' + kbps + ' КБ/с (было ≈'
      + (a / 1024 / kbps).toFixed(1).replace('.', ',') + ' с)');
  } else {
    lines.push(label + ': ' + kb(b) + ', ≈' + (b / 1024 / kbps).toFixed(1).replace('.', ',') + ' с отправки на запрос при ' + kbps + ' КБ/с');
  }
  return lines;
}

function parseArgs(argv) {
  const o = { head: null, check: false, verify: null, cssVars: [], budget: 0, kbps: 50 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') o.check = true;
    else if (a === '--verify') o.verify = argv[++i];
    else if (a === '--css-var') o.cssVars.push(argv[++i]);
    else if (a === '--budget') o.budget = +argv[++i];
    else if (a === '--kbps') o.kbps = +argv[++i];
    else if (o.head === null) o.head = a;
    else throw new Error('лишний аргумент: ' + a);
  }
  return o;
}

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { process.stderr.write(e.message + '\n'); process.exit(2); }
  if (o.verify) {                                                 // только проверка готового файла
    const code = fs.readFileSync(o.verify, 'utf8');
    const v = verify(code, null);
    const out = report(path.basename(o.verify), code, null, o).concat(v.info.map((t) => '  ок   ' + t), v.warns.map((t) => '  !    ' + t), v.fails.map((t) => '  FAIL ' + t));
    if (o.budget && Buffer.byteLength(code) > o.budget * 1024) { out.push('  FAIL больше бюджета ' + o.budget + ' КБ'); v.ok = false; }
    process.stdout.write(out.join('\n') + '\n' + (v.ok ? 'сборка годится\n' : 'сборка НЕ годится\n'));
    process.exit(v.ok ? 0 : 1);
  }
  let src = '';
  process.stdin.setEncoding('utf8');
  for await (const d of process.stdin) src += d;
  let res;
  try { res = await minifyChart(src, o.head, o); } catch (e) { process.stderr.write('сжатие не удалось: ' + (e.message || e) + '\n'); process.exit(1); }
  if (o.check || o.budget || o.cssVars.length) {
    const lines = report('сборка', res.code, src, o).concat(res.notes.map((t) => '  ' + t));
    let ok = true;
    if (o.check) {
      const v = verify(res.code, src);
      lines.push(...v.info.map((t) => '  ок   ' + t), ...v.warns.map((t) => '  !    ' + t), ...v.fails.map((t) => '  FAIL ' + t));
      ok = v.ok;
    }
    if (o.budget && Buffer.byteLength(res.code) > o.budget * 1024) { lines.push('  FAIL больше бюджета ' + o.budget + ' КБ'); ok = false; }
    process.stderr.write(lines.join('\n') + '\n');
    if (!ok) process.exit(1);
  }
  process.stdout.write(res.code);
}

module.exports = { minifyChart, verify, cssMin, terserOptions, TERSER_PIN };
if (require.main === module) main();

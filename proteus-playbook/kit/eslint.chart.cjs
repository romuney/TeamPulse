// kit/eslint.chart.cjs — ESLint для JS кастомного чарта Proteus (react_sanbbox): вызов несуществующего имени (no-undef),
// синтаксис ES5, то, чего в песочнице нет. Общий для всех проектов: объединение HRBP_HUB:stand/eslint.chart.cjs и
// detail_list:stand/eslint.chart.cjs плюс глобалы, которые на деле берут чарты adoption и TeamPulse (kit/RESULTS.js.md).
//
// Зачем. node --check ловит только синтаксис, smoke скилла — только то, до чего дошёл клик. HRBP 29.09: сводная
// трансформеров упала на удалённой функции hDelta, и ни одна проверка этого не видела. В песочнице любая ошибка окна
// гасит чарт целиком (SB-03 в 08-sandbox.md) — ReferenceError на редкой ветке = пустая ячейка у коллег.
//
// Запуск — ИЗ КОРНЯ ПРОЕКТА (ESLint 9+ с -c молча пропускает файлы вне текущего каталога: «File ignored because outside
// of base path»):
//   cd <проект> && node $(npm root -g)/eslint/bin/eslint.js -c <playbook>/kit/eslint.chart.cjs --no-config-lookup proteus/*.chart.js
// Нет ESLint — npm i -g eslint (проверено на 10.1.0). Цель: 0 ошибок. Предупреждения читать: неиспользованное и API,
// которых в песочнице нет (работают только внутри try/catch и ничего не дают).
//
// Сборку из поставки (сжатую kit/min.cjs) гонять тоже можно: имена верхнего уровня те же, ошибок должно быть столько же.
'use strict';

// Что даёт браузер внутри iframe sandbox="allow-scripts" (Chromium) и что чарты на деле берут.
// data / applyCrossFilter / option — контракт чарта (option чарт присваивает сам — writable).
const SANDBOX = {
  // контракт Proteus
  data: 'readonly', applyCrossFilter: 'readonly', option: 'writable',
  // окно, документ, таймеры
  window: 'readonly', document: 'readonly', navigator: 'readonly', console: 'readonly', self: 'readonly',
  parent: 'readonly', top: 'readonly', frames: 'readonly', screen: 'readonly', performance: 'readonly',
  getComputedStyle: 'readonly', matchMedia: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly', devicePixelRatio: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
  // наблюдатели и DOM-классы (instanceof, проверки наличия)
  ResizeObserver: 'readonly', IntersectionObserver: 'readonly', MutationObserver: 'readonly',
  Element: 'readonly', HTMLElement: 'readonly', Node: 'readonly', Event: 'readonly', CustomEvent: 'readonly',
  KeyboardEvent: 'readonly', MouseEvent: 'readonly', Image: 'readonly', DOMParser: 'readonly', XMLSerializer: 'readonly',
  // строки, base64, бинарные данные (ответ датасета сжат: atob + TextDecoder — detail_list)
  atob: 'readonly', btoa: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly', escape: 'readonly', unescape: 'readonly',
  ArrayBuffer: 'readonly', DataView: 'readonly', Uint8Array: 'readonly', Uint8ClampedArray: 'readonly', Uint16Array: 'readonly',
  Int8Array: 'readonly', Int16Array: 'readonly', Int32Array: 'readonly', Uint32Array: 'readonly', Float32Array: 'readonly',
  Float64Array: 'readonly', Blob: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Intl: 'readonly',
  // встроенные ES2015+: синтаксис ES5, но объекты в Chromium есть (их берут помощники Babel — TeamPulse)
  Map: 'readonly', Set: 'readonly', WeakMap: 'readonly', Symbol: 'readonly', Promise: 'readonly',
  // есть, но в песочнице не работают — объявлены, чтобы no-undef не путал; предупреждает no-restricted-globals ниже
  localStorage: 'readonly', sessionStorage: 'readonly', indexedDB: 'readonly', fetch: 'readonly', XMLHttpRequest: 'readonly',
  WebSocket: 'readonly', EventSource: 'readonly', location: 'readonly', history: 'readonly',
  alert: 'readonly', confirm: 'readonly', prompt: 'readonly', open: 'readonly',
};

// В песочнице без allow-same-origin / allow-modals / allow-popups и с CSP connect-src 'none' (08-sandbox.md, S5–S6):
const NOT_IN_SANDBOX = [
  ['localStorage', 'SecurityError в песочнице (нет allow-same-origin): ничего не сохранится — только в try/catch (SB-02)'],
  ['sessionStorage', 'SecurityError в песочнице (нет allow-same-origin) — только в try/catch (SB-02)'],
  ['indexedDB', 'SecurityError в песочнице (нет allow-same-origin) — только в try/catch (SB-02)'],
  ['fetch', 'сети у чарта нет: CSP connect-src \'none\' (SB-01) — данные только из датасета'],
  ['XMLHttpRequest', 'сети у чарта нет: CSP connect-src \'none\' (SB-01)'],
  ['WebSocket', 'сети у чарта нет (SB-01)'],
  ['EventSource', 'сети у чарта нет (SB-01)'],
  ['location', 'в песочнице это about:srcdoc, не адрес борда: адрес — document.referrer или meta датасета (SB-17)'],
  ['history', 'навигации у чарта нет: адрес борда не поменять (SB-01, SB-18)'],
  ['alert', 'без allow-modals вызов молча игнорируется'],
  ['confirm', 'без allow-modals вызов молча игнорируется'],
  ['prompt', 'без allow-modals вызов молча игнорируется'],
  ['open', 'без allow-popups окно не откроется'],
].map(([name, message]) => ({ name, message }));

module.exports = [{
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 5, sourceType: 'script', globals: SANDBOX },
  rules: {
    'no-undef': 'error',                                   // главное: имя, которого нет, — ReferenceError в бою
    'no-eval': 'error', 'no-new-func': 'error', 'no-implied-eval': 'error',   // код из строки — не проверен (DV-06)
    'no-restricted-globals': ['warn'].concat(NOT_IN_SANDBOX),
    'no-console': 'warn',                                  // договор скилла: console.* в чарте нет
    'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }],
  },
}];

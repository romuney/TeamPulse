/* ============================================================================
   Сценарий стенда в Chromium: node stand/scenario.js [порт] [папка-скриншотов]
   Стенд (serve.py) уже запущен. Проверяет пробник так, как его увидит владелец:
   первый ответ датасета, все вкладки, переход в юнит кросс-фильтром и «← Назад»,
   фильтр «HQ» через модалку, «План метрик» в справке, метки «демо», ошибки JS
   и то, что слушатели не копятся от прогона к прогону.
   ========================================================================== */
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const port = process.argv[2] || '8766', shots = process.argv[3] || '';
const fs = require('fs'), path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const log = [], ok = (c, m) => { log.push((c ? '  ok   ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
  const shot = async n => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, n + '.png') }); } };
  const runs = () => page.evaluate(() => window.__runs);
  const title = () => page.$eval('#unitTitle', el => el.firstChild.textContent);
  const settle = async before => {
    await page.waitForFunction(b => window.__runs > b && !window.__waiting, before, { timeout: 20000 });
    await page.waitForTimeout(400);
  };

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__runs > 0 && document.querySelector('#view .kpis'), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  ok(await page.$('.tp-overlay #view .kpis') !== null, 'отчёт собран внутри хоста ECharts: ' + await title());
  ok(await page.$eval('[_echarts_instance_] canvas', c => getComputedStyle(c).display === 'none'), 'холст ECharts спрятан');
  const demo = await page.$$eval('.demo-tag', a => a.length);
  ok(demo > 0, 'метки «демо» у заглушек на One-pager: ' + demo);
  ok(await page.$('.chip.pilot') !== null, 'в шапке чип пробника');
  await shot('01-onepager');

  /* все вкладки и под-вкладки */
  const tabs = await page.$$eval('#navBlocks .nav-i[data-tab]', a => a.map(b => b.dataset.tab));
  let screens = 0;
  for (const t of tabs) {
    await page.click('#navBlocks .nav-i[data-tab="' + t + '"]');
    await page.waitForTimeout(250);
    const subs = await page.$$eval('[data-subtab]', a => a.map(b => b.dataset.subtab));
    for (const s of subs) {
      await page.click('[data-subtab="' + s + '"]');
      await page.waitForTimeout(150);
      screens++;
    }
    if (t === 'turnover') await shot('02-turnover');
    if (t === 'hiring') await shot('03-hiring-demo');
  }
  ok(screens >= 28, 'пройдено под-вкладок: ' + screens);

  /* переход в юнит: выбрать первую строку и открыть её — кросс-фильтр и новый ответ */
  await page.click('#navBlocks .nav-i[data-tab="turnover"]');
  await page.waitForTimeout(300);
  const t0 = await title(), r0 = await runs(), lst0 = await page.evaluate(() => window.__pvtState.tp.listeners.length);
  const row = await page.$('tr.urow[data-node]');
  const rowName = await row.$eval('.row-body', el => el.firstChild.textContent);
  await row.click({ position: { x: 40, y: 8 } });
  await page.waitForTimeout(200);
  await page.click('tr.urow.sel [data-openunit]');
  ok(await page.$('.chip.busy') !== null, 'пока датасет отвечает — чип «Загружаю…»');
  await settle(r0);
  const t1 = await title();
  ok(t1 === rowName && t1 !== t0, 'переход в юнит: «' + t0 + '» → «' + t1 + '»');
  const mask = await page.evaluate(() => window.__masks[window.__masks.length - 1]);
  ok(mask.length === 1 && mask[0].column === 'unit_f', 'кросс-фильтр — только unit_f: ' + JSON.stringify(mask));
  const lst1 = await page.evaluate(() => window.__pvtState.tp.listeners.length);
  ok(lst1 === lst0, 'слушатели не копятся от прогона к прогону: ' + lst0 + ' → ' + lst1);
  ok(await page.$eval('.nav-i.active', el => el.dataset.tab) === 'turnover', 'вкладка пережила новый ответ');
  await shot('04-unit');

  /* «← Назад» — снова кросс-фильтр, возвращается прежний юнит */
  const r1 = await runs();
  await page.click('[data-uback]');
  await settle(r1);
  ok(await title() === t0, '«← Назад» вернул «' + t0 + '»');

  /* фильтр HQ через модалку */
  const r2 = await runs();
  await page.click('#btnSetup');
  await page.click('#optPaint .opt[data-v="HQ"]');
  await page.click('#btnApply');
  await settle(r2);
  const m2 = await page.evaluate(() => window.__masks[window.__masks.length - 1]);
  ok(m2.some(x => x.column === 'paint_f' && x.value[0] === 'Hq'), 'фильтр HQ ушёл как paint_f = Hq');
  ok(/HQ/.test(await page.$eval('#chips', el => el.textContent)), 'в шапке чип HQ и база «всё HQ»');
  await shot('05-hq');

  /* снять фильтр крестиком в чипе */
  const r3 = await runs();
  await page.click('[data-unchip="paint"]');
  await settle(r3);
  ok(!/Сравнение: всё HQ/.test(await page.$eval('#chips', el => el.textContent)), 'крестик в чипе снял HQ');

  /* юнит из списка в окне настройки — тоже кросс-фильтр */
  await page.click('#btnSetup');
  const opts = await page.$$eval('#selUnit option', a => a.map(o => ({ v: o.value, t: o.textContent.trim() })));
  ok(opts.length > 3 && !opts.some(o => /Напрямую/.test(o.t)), 'в окне настройки список юнитов деревом, без «Напрямую»: ' + opts.length);
  const pickU = opts.find(o => o.v.split('/').length === 4) || opts[opts.length - 1];
  await page.selectOption('#selUnit', pickU.v);
  const r4 = await runs();
  await page.click('#btnApply');
  await settle(r4);
  ok(await title() === pickU.t, 'юнит из окна настройки открылся: «' + pickU.t + '»');
  await shot('05b-setup-unit');
  const r5 = await runs();
  await page.click('[data-uback]');
  await settle(r5);

  /* справка с планом метрик */
  await page.click('#btnHelp');
  await page.waitForTimeout(200);
  const plan = await page.$$eval('#planHost .plan-t tbody tr', a => a.length);
  ok(plan >= 8, 'в справке «План метрик»: этапов ' + plan);
  await shot('06-plan');
  await page.click('#btnHelpClose');

  /* раскрыть всё — «Напрямую в «X»» и «ниже ещё N» */
  await page.click('[data-expall="1"]');
  await page.waitForTimeout(300);
  const direct = await page.$$eval('tr.urow .row-body', a => a.filter(el => /Напрямую в «/.test(el.textContent)).length);
  ok(direct > 0, 'строки «Напрямую в «X»» в раскрытом дереве: ' + direct);
  await shot('07-tree');

  ok(errs.length === 0, 'ошибок JS нет' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(log.join('\n'));
  await browser.close();
})();

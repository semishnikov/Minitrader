// Сквозной прогон интерфейса в настоящем Chromium: играем всю партию,
// проверяем отсутствие ошибок и внятность экранов.
import puppeteer from '../node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import chromium from '../node_modules/@sparticuz/chromium/build/index.js';

const PORT = process.env.PORT || 8080;
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox'],
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || '/tmp/al2023/lib' },
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('scrollTo')) errors.push(m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle0' });
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const tap = async (sel) => {
  const ok = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  await wait(180);
  return ok;
};

await wait(400);
await tap('.splash [data-act=begin]');
await wait(600);
await tap('.modal [data-act=closeModalBtn]');

const seen = new Set();
let screens = 0;
for (let step = 0; step < 260; step++) {
  const t = await page.evaluate(() => document.querySelector('#screen')?.innerText?.slice(0, 30) || '');
  if (t) seen.add(t.split('\n')[0].slice(0, 20));
  screens++;

  if (await page.evaluate(() => !!document.querySelector('[data-act=newGame]'))) break;
  if (await page.evaluate(() => !!document.querySelector('.modal-layer.on'))) {
    if (await page.evaluate(() => !!document.querySelector('[data-night]'))) {
      await page.evaluate(() => document.querySelector('[data-night]').click()); await wait(350); continue;
    }
    if (await tap('[data-act=finalGo]')) { await wait(400); continue; }
    await tap('[data-act=closeModalBtn]'); continue;
  }

  await tap('.dock__b[data-tab=market]');
  for (let k = 0; k < 3; k++) {
    if (!(await tap('[data-act=bid]'))) break;
    const scouted = await page.evaluate(() => !!document.querySelector('[data-scout]'));
    if (scouted) await tap('[data-scout]');
    await tap('[data-bidgo]');
    if (await page.evaluate(() => !!document.querySelector('.modal-layer.on'))) await tap('[data-cancel]');
  }
  await tap('.dock__b[data-tab=table]');
  for (let k = 0; k < 4; k++) if (!(await tap('[data-act=order]'))) break;
  await tap('.dock__b[data-tab=duel]');
  await tap('[data-act=startDuel]');
  if (await page.evaluate(() => !!document.querySelector('[data-act=maneuver]'))) {
    await page.evaluate(() => document.querySelector('[data-act=maneuver]').click()); await wait(220);
    await tap('[data-act=resolveDuel]'); await wait(300);
  }
  await tap('.dock__b[data-tab=ledger]');
  const btn = await page.evaluate(() => {
    const f = document.querySelector('[data-act=final]');
    if (f) { f.click(); return 'final'; }
    const n = document.querySelector('[data-act=night]');
    if (n) { n.click(); return 'night'; }
    return null;
  });
  if (btn === 'final') { await wait(350); await tap('[data-act=finalGo]'); await wait(400); }
  if (btn === 'night') {
    await wait(350);
    await page.evaluate(() => { const o = document.querySelector('[data-night]') || document.querySelector('[data-act=skipNight]'); if (o) o.click(); });
    await wait(420);
  }
}
const end = await page.evaluate(() => ({
  title: document.querySelector('.modal__title')?.textContent || '',
  coins: document.querySelector('#coinval')?.textContent || '',
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}));
console.log(JSON.stringify({ screens, screensSeen: seen.size, end, errors: errors.slice(0, 4) }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);

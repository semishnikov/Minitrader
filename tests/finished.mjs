// После финала партия не даёт торговать: только итог и новая партия.
import puppeteer from '../node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import chromium from '../node_modules/@sparticuz/chromium/build/index.js';
const PORT = process.env.PORT || 8080;
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox'], headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || '/tmp/al2023/lib' },
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 } });
const page = await b.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle0' });
const wait = (ms = 400) => new Promise(r => setTimeout(r, ms));
await wait(600);
await page.evaluate(() => document.querySelector('.splash [data-act=begin]')?.click());
await wait(800);
await page.evaluate(() => document.querySelector('.modal [data-act=closeModalBtn]')?.click());
await wait(400);
await page.evaluate(async () => {
  const E = await import('/src/core/engine.js');
  const s = E.newGame('done'); s.over = true; s.phase = 'final'; s.day = 6;
  s.result = { win: true, score: 1800, coins: 700, rep: 40, rank: 'Уважаемый торговец' };
  const { rng, ...plain } = s;
  window.__OTBLESKI_SET__(plain);
});
await wait(700);
const state = await page.evaluate(() => ({
  tabs: [...document.querySelectorAll('.dock__b')].map(b => b.dataset.tab),
  hasFinal: !!document.querySelector('[data-act=final]'),
  hasBid: !!document.querySelector('[data-act=bid]'),
  hasResult: !!document.querySelector('[data-act=showResult]'),
  hasNew: !!document.querySelector('[data-act=newGame]'),
}));
const ok = state.tabs.length === 1 && state.tabs[0] === 'ledger'
  && !state.hasFinal && !state.hasBid && state.hasResult && state.hasNew;
console.log(ok ? '✓ сыгранная партия закрыта корректно' : '✗ ' + JSON.stringify(state));
console.log(errs.length ? '✗ ошибки: ' + errs[0] : '✓ без ошибок');
await b.close();
process.exit(ok && !errs.length ? 0 : 1);

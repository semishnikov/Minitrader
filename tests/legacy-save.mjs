// Старый сейв не должен ломать игру. Запуск: node tests/legacy-save.mjs
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
const wait = (ms = 300) => new Promise(r => setTimeout(r, ms));
await wait(600);
const old = await page.evaluate(async () => {
  const E = await import('/src/core/engine.js');
  const s = E.newGame('legacy');
  for (const k of ['deal', 'final', 'orders', 'quota', 'result']) delete s[k];
  return JSON.stringify(s);
});
await page.evaluate((raw) => localStorage.setItem('otbleski.save.v1', raw), old);
await page.reload({ waitUntil: 'networkidle0' });
await wait(1200);
const ok = await page.evaluate(() => document.querySelector('#screen')?.innerHTML.length > 1000);
console.log(ok && !errs.length ? '✓ старый сейв восстановлен' : '✗ провал: ' + (errs[0] || 'пустой экран'));
await b.close();
process.exit(ok && !errs.length ? 0 : 1);

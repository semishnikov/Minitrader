// Обучение: три шага, каждый снимается действием, после третьего не возвращается.
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
const wait = (ms = 350) => new Promise(r => setTimeout(r, ms));
const tip = () => page.evaluate(() => document.querySelector('.tipbar')?.innerText?.replace(/\s+/g, ' ').trim() || '');
await wait(700);
await page.evaluate(() => document.querySelector('.splash [data-act=begin]')?.click());
await wait(900);
await page.evaluate(() => document.querySelector('.modal [data-act=closeModalBtn]')?.click());
await wait(600);

const steps = [await tip()];
await page.evaluate(() => document.querySelector('[data-act=bid]')?.click()); await wait(350);
await page.evaluate(() => document.querySelector('[data-bidgo]')?.click()); await wait(700);
steps.push(await tip());

// скрываем подсказки, чтобы не мешали, и проверяем, что они не возвращаются
await page.evaluate(() => document.querySelector('[data-act=tipSkip]')?.click()); await wait(400);
await page.evaluate(() => document.querySelector('.dock__b[data-tab=table]')?.click()); await wait(500);
const afterSkip = await tip();

const ok1 = steps[0].startsWith('1/3');
const ok2 = steps[1].startsWith('2/3');
const ok3 = afterSkip === '';
console.log(ok1 ? '✓ шаг 1/3 показан' : '✗ нет первого шага: ' + steps[0]);
console.log(ok2 ? '✓ шаг снят действием' : '✗ шаг не сменился: ' + steps[1]);
console.log(ok3 ? '✓ подсказки скрываются' : '✗ подсказка вернулась: ' + afterSkip);
console.log(errs.length ? '✗ ошибки: ' + errs[0] : '✓ без ошибок');
await b.close();
process.exit(ok1 && ok2 && ok3 && !errs.length ? 0 : 1);

// ============================================================================
// ЯРМАРКА ОТБЛЕСКОВ — движок. Чистая логика без DOM: тестируется в Node.
// Валюта одна: монеты (М). Все числа — здесь, чтобы UI ничего не выдумывал.
// ============================================================================
import { Rng, clamp } from './rng.js';
import { CLASSES } from '../data/cards.js';

export const DAYS = 6;
let UID = 0;
export const resetUid = () => { UID = 0; };

export const CLASS_KEYS = ['amber', 'bone', 'porcel', 'glass', 'brass', 'ink'];
export const RARITY_ORDER = ['common', 'fine', 'rare', 'fabled'];
export const RARITY_VALUE = { common: 8, fine: 15, rare: 26, fabled: 42 };
export const RARITY_LABEL = { common: 'рядовая', fine: 'изящная', rare: 'редкая', fabled: 'сказанная' };
export const RARITY_MULT = { common: 1, fine: 1.07, rare: 1.16, fabled: 1.3 };

const NAMES = {
  amber: ['Слеза софоры', 'Пчелиный гребень', 'Янтарь-пузырь', 'Сердце капли', 'Смола с пальцем', 'Пчела в камне'],
  bone: ['Костяной гребень', 'Позвонок старца', 'Челюсть певца', 'Трубка из бедра', 'Палец аббата', 'Клык с насечкой'],
  porcel: ['Чашка с трещиной', 'Блюдце русалки', 'Ваза без дна', 'Голова куклы', 'Суповой сервиз', 'Пиала с изъяном'],
  glass: ['Слепок окна', 'Мениск', 'Линза часовщика', 'Капля собора', 'Плафон', 'Осколок витража'],
  brass: ['Шестерня без зуба', 'Ключ от ниоткуда', 'Верньер', 'Гиря в оправе', 'Метроном', 'Замок без двери'],
  ink: ['Пятно чернил', 'Обрывок письма', 'Подпись без имени', 'Печать нотариуса', 'Письмо без адреса', 'Клякса в форме сердца'],
};

export function baseValue(relic) {
  const ci = CLASS_KEYS.indexOf(relic.class);
  const rar = RARITY_VALUE[relic.rarity] ?? 8;
  return Math.round((10 + ci * 2 + rar) * RARITY_MULT[relic.rarity] * 1.0);
}

export function makeRelic(rng, opts = {}) {
  const cls = opts.class || rng.pick(CLASS_KEYS);
  const rarity = opts.rarity || rng.weighted([['common', 58], ['fine', 28], ['rare', 11], ['fabled', 3]]);
  const name = opts.name || rng.pick(NAMES[cls]);
  const relic = { uid: `u${++UID}`, class: cls, rarity, name };
  relic.base = baseValue(relic);
  if (opts.price) relic.base = opts.price;
  return relic;
}

// ---------------------------------------------------------------- утилиты

export const fmt = (n) => {
  const v = Math.round(n);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
  return (v < 0 ? '−' : '') + s;
};

export function pushLog(s, text, tone = '') {
  s.history.push({ day: s.day, n: ++s.logSeq, text, tone });
  if (s.history.length > 200) s.history.shift();
}

export function addCoins(s, delta, reason) {
  const d = Math.round(delta);
  s.coins = Math.max(0, s.coins + d);
  if (d > 0) s.dayStats.earned += d; else s.dayStats.spent += -d;
  if (reason) pushLog(s, `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} М · ${reason}`, d > 0 ? 'good' : 'bad');
  return d;
}

export function changeRep(s, delta, reason) {
  const before = s.rep;
  s.rep = clamp(s.rep + delta, 0, 100);
  if (reason) pushLog(s, `${delta > 0 ? '+' : '−'}${Math.abs(delta)} реп · ${reason}`, delta > 0 ? 'good' : 'bad');
  return s.rep - before;
}

// ---------------------------------------------------------------- новая игра

export function newGame(seed = 'fairs-' + Date.now()) {
  resetUid();
  const state = {
    seed,
    rng: new Rng(seed),
    day: 1,
    phase: 'morning',
    coins: 620,
    rep: 20,
    maxSlots: 5,
    stash: [],
    actions: 3,
    maxActions: 3,
    inflation: 0,
    orders: [],
    pledges: [],
    rumor: null,          // { cls, dir, until, exposed }
    market: null,
    dayEvent: null,
    bots: [],
    duel: null,
    duelsToday: 0,
    history: [],
    logSeq: 0,
    dayStats: { earned: 0, spent: 0, lotsWon: 0, duels: 0, duelsWon: 0, orders: 0 },
    mods: {},             // накопленные модификаторы с финала
    broker: false,
    flags: {},
    pending: null,
    over: false,
    result: null,
    tutorial: true,
    // «Немая квота»: три скрытых желания домов — их не видно, но их можно нащупать.
    quota: { house: null, class: null, rarity: null, done: false },
    auctionSeq: 0,
    styleHistory: [],
  };
  startDay(state);
  return state;
}

export function startDay(s) {
  s.phase = 'morning';
  s.actions = s.maxActions;
  s.duelsToday = 0;
  s.duel = null;
  s.broker = false;
  s.dayStats = { earned: 0, spent: 0, lotsWon: 0, duels: 0, duelsWon: 0, orders: 0 };
  s.dayEvent = pickDayEvent(s.rng);
  s.rerolled = false;
  makeMarket(s);
  makeOrders(s);
  s.rumor = s.rumor && s.rumor.until >= s.day ? s.rumor : null;
}

// ---------------------------------------------------------------- события дня

const DAY_EVENTS = [
  { id: 'quiet', name: 'Тихий день', desc: 'Публика вялая. Ставки ботов на 10% ниже.', botMod: -0.1 },
  { id: 'fest', name: 'Праздник фонарей', desc: 'Все хотят блеска. Боты ставят на 12% выше.', botMod: 0.12 },
  { id: 'tax', name: 'Пошлина герцога', desc: 'Каждый лот дороже на 8%, но и продажи на 6% выгоднее.', botMod: 0.05, priceMod: 0.08, sellMod: 0.06 },
  { id: 'collector', name: 'День коллекционера', desc: 'Редкое ценят: продажа редких и сказанных +20%.', sellRare: 0.2 },
  { id: 'fog', name: 'Туман', desc: 'Слухи гнилые: провал слуха влетит в репутацию вдвое.', rumorRisk: 2, botMod: 0.02 },
  { id: 'hungry', name: 'Голодный день', desc: 'Ломбард платит на 10% больше, но и выкуп дороже.', pawn: 0.1 },
  { id: 'calm', name: 'Ровный день', desc: 'Обычный торг, без сюрпризов.', botMod: 0 },
];

function pickDayEvent(rng) {
  return rng.pick(DAY_EVENTS);
}

// ---------------------------------------------------------------- РЫНОК

const AUCTION_STYLES = {
  dutch: { name: 'Голландский молоток', tag: 'Цена падает', note: 'Жди, пока цена не упадёт, но лот могут увести.' },
  sealed: { name: 'Слепой аукцион', tag: 'Конверты', note: 'Ставки тайные. Платишь не свою, а вторую ставку + 1.' },
  ladder: { name: 'Лестница', tag: 'Три ступени', note: 'Каждый следующий лот дороже и реже.' },
  brawl: { name: 'Спорный зал', tag: 'Открытый торг', note: 'Боты перебивают. Знай, когда остановиться.' },
};

export function makeMarket(s) {
  const rng = s.rng;
  const styleKeys = Object.keys(AUCTION_STYLES);
  s.styleHistory = s.styleHistory || [];
  const fresh = styleKeys.filter((k) => !s.styleHistory.slice(-2).includes(k));
  const style = s.flags.forceStyle || rng.pick(fresh.length ? fresh : styleKeys);
  s.styleHistory.push(style);
  s.auctionSeq = (s.auctionSeq || 0) + 1;
  s.flags.forceStyle = null;
  const count = style === 'ladder' ? 3 : 4;
  const focus = rng.pick(CLASS_KEYS);
  const priceMod = 1 + (s.dayEvent?.priceMod || 0) + s.inflation * 0.03 + (s.day - 1) * 0.03;
  const lots = [];
  for (let i = 0; i < count; i++) {
    let rarity;
    if (style === 'ladder') rarity = ['fine', 'rare', 'fabled'][i];
    else rarity = rng.weighted([['common', 55], ['fine', 28], ['rare', 13], ['fabled', 4]]);
    const relics = [makeRelic(rng, { class: rng.chance(0.55) ? focus : undefined, rarity })];
    if (style !== 'ladder' && rng.chance(0.24)) relics.push(makeRelic(rng, { class: rng.pick(CLASS_KEYS), rarity: 'common' }));
    const value = relics.reduce((a, r) => a + r.base, 0);
    // Голландский стартует ВЫШЕ ценности (иначе нечего ждать), остальные — ниже.
    // Голландский начинается выше их оценки, но не выше «слепой» оценки зала.
    const startMult = style === 'dutch' ? 1.28 + rng.float(0, 0.18) : 0.52 + rng.float(0, 0.12);
    const start = Math.max(8, Math.round(value * startMult * priceMod));
    lots.push({
      id: `L${i}`,
      relics,
      value,          // «слепая» оценка аукциона, боты ориентируются на неё
      start,
      price: start,   // стартовая цена лота
      current: start, // голландская текущая
      watches: 0,
      done: false,
      winner: null,
      soldPrice: 0,
      bundle: relics.length > 1,
    });
  }
  s.market = {
    style,
    lots,
    focus,
    revealed: false,
  };
  s.bots = makeBots(s);
  // Пределы ботов фиксируются сразу: зал не меняет мнение на каждом клике.
  lots.forEach((lot) => {
    lot.limits = stableLimits(s, lot);
    lot.topBid = lot.limits[0].max;
  });
  return s.market;
}

export function lotPriceNow(lot) {
  if (lot.style === 'dutch') return lot.current;
  return lot.price;
}

export function dutchPrice(lot) {
  const step = Math.min(6, lot.watches || 0);
  return Math.max(Math.round(lot.price * 0.46), Math.round(lot.price * Math.pow(0.865, step)));
}

export function makeBots(s) {
  // Боты живут на ярмарке весь день и тают от покупок. Поэтому бюджет — дневной:
  // в первый день он мал, к финалу растёт. Это даёт игроку «окно» в начале.

  const rng = new Rng(`${s.seed}-bots-${s.day}`);
  const archetypes = [
    { key: 'shark', name: 'Мадам Клык', aggression: 1.18, desc: 'хватает всё яркое' },
    { key: 'owl', name: 'Сова Сигизмунд', aggression: 0.84, desc: 'считает каждую монету' },
    { key: 'fox', name: 'Лис Ренар', aggression: 1.0, desc: 'собирает тройки под мету' },
    { key: 'rat', name: 'Крыса Борис', aggression: 0.94, desc: 'берёт на перепродажу' },
    { key: 'stone', name: 'Камень', aggression: 0.7, desc: 'просто хочет домой' },
  ];
  const picked = rng.shuffle(archetypes).slice(0, 3);
  const meta = rng.pick(CLASS_KEYS);
  return picked.map((b, i) => ({
    ...b,
    id: b.key,
    meta: b.key === 'fox' ? meta : rng.pick(CLASS_KEYS),
    budget: Math.round((60 + s.day * 24) * rng.float(0.85, 1.2) * (1 + s.inflation * 0.03)),
    rivalry: 0,
  }));
}

/**
 * Оценка лота ботом. Боты НЕ знают рынок идеально: их оценка = базовая ценность
 * с личным искажением. Поэтому зал можно переиграть, зная классы и редкости.
 */
export function botValuation(s, bot, lot) {
  if (lot.noBots) return 0;
  const rng = new Rng(`${s.seed}-v-${s.day}-${lot.id}-${bot.id}`);
  let v = lot.relics.reduce((a, r) => {
    let x = r.base;
    if (r.class === bot.meta) x *= 1.24;
    if (r.rarity === 'fabled') x *= 1.08;
    if (bot.key === 'rat') x *= 1.03;
    return a + x;
  }, 0);
  if (lot.relics.length > 1) v *= 0.94; // связки берут неохотно
  v *= 1 + (s.dayEvent?.botMod || 0);
  // Туман зала: бот не видит «справедливую» цену, а угадывает её со своим сдвигом.
  v *= rng.float(0.74, 1.02);      // личное «чутьё» — стабильно в пределах дня
  v *= bot.aggression;
  return Math.round(v);
}

/** Стабильный предел каждого бота на лот. Считается один раз в день. */
export function stableLimits(s, lot) {
  const out = [];
  for (const b of s.bots) {
    const val = botValuation(s, b, lot);
    if (val <= 0) continue;
    const rng = new Rng(`${s.seed}-lim-${s.day}-${lot.id}-${b.id}`);
    const interest = clamp(val / Math.max(8, lot.value) - 0.25, 0, 1.4);
    if (!rng.chance(0.3 + interest * 0.45)) continue;
    const max = Math.max(6, Math.min(b.budget, Math.round(val * rng.float(0.86, 1.0))));
    out.push({ bot: b, max });
  }
  if (!out.length) out.push({ bot: { name: 'Случайный зевака', id: 'passer', desc: 'просто проходил мимо' }, max: Math.round(lot.start * 0.95) });
  return out.sort((a, b) => b.max - a.max);
}

/** Кто в зале готов платить. Без скрытых повторных бросков — честный срез. */
export function bidBots(s, lot) {
  if (lot.limits) return lot.limits;
  lot.limits = stableLimits(s, lot);
  return lot.limits;
}

// ---------------------------------------------------------------- аукцион: ставки

export function lotState(s) {
  return s.market?.lots || [];
}

export function placeBid(s, lotId, amount) {
  const lot = s.market?.lots.find((l) => l.id === lotId);
  if (!lot) return { ok: false, why: 'Лот не найден.' };
  if (lot.done) return { ok: false, why: 'Лот уже ушёл.' };
  if (s.actions < 1) return { ok: false, why: 'Действия на сегодня кончились.' };
  amount = Math.round(amount);
  if (amount <= 0) return { ok: false, why: 'Ставка должна быть больше нуля.' };
  if (amount > s.coins) return { ok: false, why: `Не хватает ${fmt(amount - s.coins)} М.` };
  if (s.stash.length + lot.relics.length > s.maxSlots) return { ok: false, why: 'На столе нет места — избавься от лишнего.' };

  const style = s.market.style;
  if (style === 'dutch') {
    const price = dutchPrice(lot);
    if (amount < price) return { ok: false, why: `Сейчас цена ${fmt(price)} М — ставь не меньше.` };
    return takeLot(s, lot, price, 'молоток упал на твою цену', true);
  }

  // Второй лот за день стоит два действия — торг затягивает.
  const extra = s.dayStats.lotsWon >= 2 ? 2 : s.dayStats.lotsWon >= 1 ? 1 : 0;
  if (s.actions < 1 + extra) return { ok: false, why: 'Второй лот за день отнимает два действия.' };

  const limits = bidBots(s, lot);
  const top = limits[0];
  const second = limits[1] || { max: Math.round(top.max * 0.8) };
  lot.seenTop = Math.max(lot.seenTop || 0, top.max);

  if (style === 'sealed') {
    const won = amount > top.max;
    if (won) {
      // Платишь вторую ставку + 1 — классика закрытого аукциона.
      const pay = Math.min(amount, Math.max(second.max + 1, Math.round(top.max * 0.86)));
      return takeLot(s, lot, pay, `конверт вскрыт: ты дал ${fmt(amount)} М, платишь ${fmt(pay)} М`, true, extra);
    }
    return loseLot(s, lot, top, `конверт «${top.bot.name}» старше — ему хватило ${fmt(top.max)} М`);
  }
  // brawl / ladder — открытый английский торг
  if (amount > top.max) {
    const pay = Math.min(amount, Math.max(second.max + 1, Math.round(top.max * 0.92)));
    return takeLot(s, lot, pay, `молоток: ты дал ${fmt(amount)} М, платишь ${fmt(pay)} М`, true, extra);
  }
  return loseLot(s, lot, top, `${top.bot.name} перебивает: ему хватает ${fmt(top.max)} М`);
}

function takeLot(s, lot, price, note, spendAction = true, extra = 0) {
  s.actions -= (spendAction ? 1 : 0) + extra;
  const lotNames = lot.relics.map((r) => r.name).join(' + ');
  addCoins(s, -price, null);
  lot.relics.forEach((r) => s.stash.push(r));
  lot.done = true;
  lot.winner = 'you';
  lot.soldPrice = price;
  s.dayStats.lotsWon += 1;
  pushLog(s, `−${fmt(price)} М · лот «${lotNames}»`, 'bad');
  s.bots.forEach((b) => (b.budget = Math.max(0, b.budget - Math.round(price * 0.18))));
  const margin = lot.value - price;
  return { ok: true, won: true, price, note, lot, margin };
}

function loseLot(s, lot, top, note) {
  lot.done = true;
  lot.winner = top.bot.name;
  lot.soldPrice = top.max;
  pushLog(s, `Лот ушёл ${top.bot.name} за ${fmt(top.max)} М — проиграно на ${fmt(Math.max(0, top.max - lot.value))} сверх ценности`, 'bad');
  s.bots.forEach((b) => (b.budget = Math.max(0, b.budget - Math.round(top.max * 0.18))));
  return { ok: true, won: false, note, rival: top.bot.name, price: top.max };
}

export function watchLot(s, lotId) {
  const lot = s.market?.lots.find((l) => l.id === lotId);
  if (!lot || lot.done || s.market.style !== 'dutch') return { ok: false };
  lot.watches += 1;
  const takeChance = 0.06 + lot.watches * 0.07;
  if (s.rng.chance(takeChance)) {
    const bot = s.bots[0];
    lot.done = true;
    lot.winner = bot.name;
    lot.soldPrice = dutchPrice(lot);
    pushLog(s, `${bot.name} не выдержал и забрал «${lot.relics[0].name}» — ты зазевался`, 'bad');
    return { ok: true, lost: true, price: lot.soldPrice, bot: bot.name };
  }
  lot.current = dutchPrice(lot);
  return { ok: true, lost: false, price: lot.current };
}

export function passLot(s, lotId) {
  const lot = s.market?.lots.find((l) => l.id === lotId);
  if (!lot || lot.done) return { ok: false };
  const top = bidBots(s, lot)[0];
  lot.done = true;
  lot.winner = top.bot.name;
  lot.soldPrice = top.max;
  return { ok: true, rival: top.bot.name, price: top.max };
}

export function rerollMarket(s) {
  if (s.rerolled) return { ok: false, why: 'Сегодня зал уже меняли.' };
  const cost = 35 + s.day * 8;
  if (s.coins < cost) return { ok: false, why: `Нужно ${cost} М за место в другом зале.` };
  addCoins(s, -cost, 'переезд в другой зал');
  s.rerolled = true;
  makeMarket(s);
  return { ok: true, cost };
}

// ---------------------------------------------------------------- ПРИЛАВОК / ЛОМБАРД

export function sellChance(s, relic) {
  let pct = 1.08 + (s.broker ? 0.08 : 0) + Math.min(0.14, s.rep / 320);
  if (relic.rarity === 'rare' || relic.rarity === 'fabled') pct += s.dayEvent?.sellRare || 0;
  pct += s.dayEvent?.sellMod || 0;
  return pct;
}

export function sellPrice(s, relic) {
  return Math.max(1, Math.round(relic.base * sellChance(s, relic)));
}

export function sellRelic(s, uid) {
  const i = s.stash.findIndex((r) => r.uid === uid);
  if (i < 0) return { ok: false, why: 'Такого предмета нет на столе.' };
  const relic = s.stash[i];
  const price = sellPrice(s, relic);
  s.stash.splice(i, 1);
  addCoins(s, price, `прилавок: ${relic.name}`);
  changeRep(s, 1, 'честная продажа');
  const quota = checkQuota(s, relic);
  return { ok: true, price, relic, quota };
}

export function pawnPrice(s, relic) {
  return Math.round(relic.base * (0.7 + (s.dayEvent?.pawn || 0) + s.inflation * 0.004));
}

export function pawn(s, uid) {
  const i = s.stash.findIndex((r) => r.uid === uid);
  if (i < 0) return { ok: false, why: 'Такого предмета нет на столе.' };
  const relic = s.stash[i];
  const loan = pawnPrice(s, relic);
  const fee = Math.round(loan * (0.09 + s.inflation * 0.008));
  s.stash.splice(i, 1);
  addCoins(s, loan, `ломбард: ${relic.name}`);
  s.pledges.push({ relic, loan, fee, dueDay: s.day + 2 });
  return { ok: true, loan, fee, relic };
}

export function redeemCost(p) {
  return p.loan + p.fee;
}

export function redeem(s, idx) {
  const p = s.pledges[idx];
  if (!p) return { ok: false, why: 'Заклад не найден.' };
  if (s.stash.length >= s.maxSlots) return { ok: false, why: 'Нет места на столе.' };
  const total = redeemCost(p);
  if (s.coins < total) return { ok: false, why: `Не хватает ${fmt(total - s.coins)} М.` };
  addCoins(s, -total, `выкуп: ${p.relic.name}`);
  s.stash.push(p.relic);
  s.pledges.splice(idx, 1);
  changeRep(s, 1, 'вернул вещь');
  return { ok: true };
}

// ---------------------------------------------------------------- СТОЛ

export function tripleClasses(stash) {
  const by = {};
  stash.forEach((r) => { by[r.class] = (by[r.class] || 0) + 1; });
  return Object.keys(by).filter((c) => by[c] >= 3);
}

export function allDifferent(stash) {
  return stash.length >= 4 && new Set(stash.map((r) => r.class)).size === stash.length;
}

export function tableScore(stash) {
  const triples = tripleClasses(stash);
  const diff = allDifferent(stash);
  const sum = stash.reduce((a, r) => a + r.base, 0);
  const bonus = 1 + triples.length * 0.18 + (diff ? 0.12 : 0);
  return {
    sum,
    triples,
    allDifferent: diff,
    bonus,
    power: Math.round(sum * bonus),
    classes: stash.reduce((a, r) => { a[r.class] = (a[r.class] || 0) + 1; return a; }, {}),
  };
}

export function tablePower(s) {
  const t = tableScore(s.stash);
  const repBonus = 1 + s.rep / 500;          // до +20% за репутацию
  const modBonus = 1 + (s.mods.power || 0);
  return Math.round(t.power * repBonus * modBonus);
}

export function slotCost(s) {
  return 60 + (s.maxSlots - 5) * 55 + s.day * 6;
}

export function buySlot(s) {
  if (s.maxSlots >= 8) return { ok: false, why: 'Больше восьми слотов не бывает.' };
  const cost = slotCost(s);
  if (s.coins < cost) return { ok: false, why: `Нужно ${fmt(cost)} М.` };
  addCoins(s, -cost, 'верстак расширен');
  s.maxSlots += 1;
  changeRep(s, 1, 'мастерская растёт');
  return { ok: true, cost };
}

export function craftCost(s) {
  return 24 + s.day * 4;
}

/** Спарить два предмета одного класса и редкости в один выше рангом. 72% успеха. */
export function craft(s, classKey, rarity) {
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx < 0 || idx >= 3) return { ok: false, why: 'Выше сказанного не бывает.' };
  const pool = s.stash.filter((r) => r.class === classKey && r.rarity === rarity);
  if (pool.length < 2) return { ok: false, why: 'Нужны две вещи того же класса и редкости.' };
  const cost = craftCost(s);
  if (s.coins < cost) return { ok: false, why: `Нужно ${fmt(cost)} М за мастерскую.` };
  addCoins(s, -cost, 'спайка в мастерской');
  const [a, b] = pool;
  s.stash = s.stash.filter((r) => r.uid !== a.uid && r.uid !== b.uid);
  if (s.rng.chance(0.72)) {
    const relic = makeRelic(s.rng, { class: classKey, rarity: RARITY_ORDER[idx + 1] });
    s.stash.push(relic);
    changeRep(s, 1, 'удачная спайка');
    pushLog(s, `Спайка удалась: ${relic.name} (${RARITY_LABEL[relic.rarity]})`, 'good');
    return { ok: true, made: relic, broke: false, cost };
  }
  pushLog(s, 'Спайка треснула — обе вещи в осколках', 'bad');
  changeRep(s, -1, 'испорченный товар');
  return { ok: true, broke: true, cost };
}

// ---------------------------------------------------------------- ЗАКАЗЫ ДОМОВ

const HOUSES = [
  { name: 'Дом Ашкрофт', desc: 'собирает янтарь для витрины' },
  { name: 'Ложа Молочника', desc: 'любит фарфор с изъяном' },
  { name: 'Архив Гравёра', desc: 'скупает чернила и подписи' },
  { name: 'Клуб Верньера', desc: 'платит за латунь и стекло' },
];

export function makeOrders(s) {
  if (!s.quota || !s.quota.house) {
    const qr = new Rng(`${s.seed}-quota`);
    s.quota = {
      house: qr.pick(HOUSES).name,
      class: qr.pick(CLASS_KEYS),
      rarity: qr.weighted([['common', 30], ['fine', 40], ['rare', 25], ['fabled', 5]]),
      reward: 0,
      done: false,
    };
    s.quota.reward = Math.round(120 + (RARITY_ORDER.indexOf(s.quota.rarity) + 1) * 45);
  }

  const rng = s.rng;
  const n = 2;
  s.orders = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let cls = rng.pick(CLASS_KEYS);
    let guard = 0;
    while (used.has(cls) && guard++ < 8) cls = rng.pick(CLASS_KEYS);
    used.add(cls);
    const rarity = rng.weighted([['common', 40], ['fine', 33], ['rare', 22], ['fabled', 5]]);
    const house = rng.pick(HOUSES);
    const base = makeRelic(rng, { class: cls, rarity }).base;
    const reward = Math.round(base * (2.0 + rng.float(0, 0.5)) + 45 + s.day * 10);
    s.orders.push({
      id: `O${i}`,
      house: house.name,
      desc: house.desc,
      class: cls,
      rarity,
      reward,
      rep: 2 + (rarity === 'rare' ? 2 : rarity === 'fabled' ? 3 : 0),
      done: false,
      expires: s.day + 1,
    });
  }
}

/** Скрытая квота: если сданная вещь совпала — дом платит премию и раскрывается. */
function checkQuota(s, relic) {
  const q = s.quota;
  if (!q || q.done) return null;
  if (relic.class !== q.class || relic.rarity !== q.rarity) return null;
  q.done = true;
  const bonus = Math.round(q.reward * (1 + (s.day - 1) * 0.12));
  addCoins(s, bonus, `немая квота дома «${q.house}»`);
  changeRep(s, 6, 'дом заметил твой вкус');
  pushLog(s, `Раскрыта квота: «${q.house}» искал ${CLASSES[q.class].name.toLowerCase()} (${RARITY_LABEL[q.rarity]})`, 'good');
  return { house: q.house, bonus, class: q.class, rarity: q.rarity };
}

export function orderReady(s, order) {
  return s.stash.find((r) => r.class === order.class && r.rarity === order.rarity && !order.done);
}

export function fulfilOrder(s, orderId) {
  const order = s.orders.find((o) => o.id === orderId);
  if (!order || order.done) return { ok: false, why: 'Заказ уже закрыт.' };
  const relic = orderReady(s, order);
  if (!relic) return { ok: false, why: 'Нет подходящей вещи на столе.' };
  s.stash = s.stash.filter((r) => r.uid !== relic.uid);
  order.done = true;
  addCoins(s, order.reward, `заказ ${order.house}`);
  changeRep(s, order.rep, 'заказ дома исполнен');
  s.dayStats.orders += 1;
  pushLog(s, `${order.house} забирает «${relic.name}»`, 'good');
  const quota = checkQuota(s, relic);
  return { ok: true, reward: order.reward, relic, rep: order.rep, quota };
}

// ---------------------------------------------------------------- СЛУХИ

export function rumorCost(s) {
  return 30 + s.day * 6;
}

/**
 * Пустить слух о классе. dir +1 — раздуть спрос, −1 — уронить.
 * Купленное дешевле упадёт в цене продажи, но боты перестанут драться.
 * Слух живёт 2 дня. Есть риск разоблачения.
 */
export function plantRumor(s, classKey, dir) {
  const cost = rumorCost(s);
  if (s.coins < cost) return { ok: false, why: `Нужно ${fmt(cost)} М на язык рынка.` };
  if (s.rumor) return { ok: false, why: 'Слух уже гуляет — второй не приживётся.' };
  addCoins(s, -cost, `слух о ${CLASSES[classKey].name.toLowerCase()}`);
  const risk = (0.18 + (dir < 0 ? 0.06 : 0)) * (s.dayEvent?.rumorRisk || 1);
  const exposed = dir < 0 && s.rng.chance(risk);
  if (exposed) {
    changeRep(s, -6, 'тебя поймали на сплетне');
    pushLog(s, 'Газетчик раскрыл твой слух. Город смеётся.', 'bad');
    return { ok: true, exposed: true, cost };
  }
  s.rumor = { cls: classKey, dir, until: s.day + 1 };
  pushLog(s, `Слух о ${CLASSES[classKey].name.toLowerCase()}: ${dir > 0 ? 'ажиотаж' : 'холод'}`, 'warn');
  return { ok: true, exposed: false, cost };
}

// ---------------------------------------------------------------- ДУЭЛИ

export const MANEUVERS = {
  probe: { name: 'Дознание', short: 'вскрыть туз', desc: 'Показать скрытый приём и все карты соперника. Сила не меняется.', cost: 0 },
  feint: { name: 'Обманка', short: '−15% ему', desc: 'Сила соперника −15%. Против «Хитрости» — −25%.', cost: 0 },
  word: { name: 'Слово', short: 'сбить мету', desc: 'Отключает мету соперника (его бонус за класс).', cost: 0 },
  silence: { name: 'Немая сцена', short: 'глушит туз', desc: 'Полностью отключает скрытый приём соперника.', cost: 0 },
  tower: { name: 'Башня', short: '+28% силы', desc: 'Твоя сила +28%, если на столе есть тройка, иначе +8%.', cost: 0 },
  nest: { name: 'Заначка', short: '+24% силы', desc: 'Отдать 35 М и получить +24% силы.', cost: 35 },
  swap: { name: 'Подмена', short: 'забрать мету', desc: 'Забираешь силу его мета-класса: +6 за каждую его вещь этого класса.', cost: 0 },
};

const RIVAL_MODS = [
  { id: 'zeal', name: 'Рвение', desc: '+18% силы', mult: 1.18, tell: 'Соперник стоит ровно, как солдат.' },
  { id: 'guile', name: 'Хитрость', desc: 'крадёт половину твоего бонуса', tell: 'Соперник улыбается нехорошо.' },
  { id: 'iron', name: 'Железо', desc: 'нельзя сбить Словом', tell: 'На нём тяжёлые перстни.' },
  { id: 'greed', name: 'Жадность', desc: 'проиграв, отдаёт вдвое больше', tell: 'Он всё время трогает кошелёк.' },
  { id: 'ghost', name: 'Призрак', desc: '+10%, но туз гаснет от Немой сцены', tell: 'От него не падает тень.' },
];

const RIVAL_NAMES = ['Тень брата', 'Молочник из Конька', 'Гравёр Ада', 'Дама с плюмажем', 'Мальчик с молотком', 'Коллекционер Нелидов', 'Хозяйка Семи Хвостов'];

/**
 * Соперник собирается «под твой стол»: он не слабее и не сильнее на порядок,
 * а ±15% вокруг твоей силы. Победу решают приём, ставка и голова.
 * Редкость его карт влияет на мету и на «Подмену», но не ломает баланс.
 */
export function makeRival(s, tier, myPower) {
  const rng = new Rng(`${s.seed}-riv-${s.day}-${tier}-${s.rng.int(1, 1e9)}`);
  const n = 3 + Math.min(2, tier);
  const cards = [];
  const meta = rng.pick(CLASS_KEYS);
  for (let i = 0; i < n; i++) {
    cards.push(makeRelic(rng, {
      class: rng.chance(0.55) ? meta : undefined,
      rarity: rng.weighted([['common', 38], ['fine', 34], ['rare', 22], ['fabled', 6]]),
    }));
  }
  const ts = tableScore(cards);
  const factor = [0.82, 0.95, 1.08][Math.min(2, tier - 1)] ?? 1;
  const basePower = Math.max(30, Math.round(Math.max(30, myPower) * factor + 6 + s.day * 3));
  const mod = rng.pick(RIVAL_MODS);
  const name = RIVAL_NAMES[(s.day * 2 + tier) % RIVAL_NAMES.length];
  return {
    id: `R${s.day}-${tier}-${++UID}`,
    name,
    cards,
    meta,
    triples: ts.triples,
    basePower,
    mod,
    revealed: false,
    hiddenCards: 1,
    tier,
    tell: mod.tell,
    factor,
  };
}

export function startDuel(s) {
  if (s.duelsToday >= 3) return { ok: false, why: 'Три дуэли в день — зал закрывается.' };
  if (s.stash.length < 1) return { ok: false, why: 'Стол пуст — выставлять нечего.' };
  const tier = [1, 2, 3][s.duelsToday] ?? 1;
  const rival = makeRival(s, tier, tablePower(s));
  s.duel = {
    rival,
    bet: Math.min(s.coins, Math.max(20, Math.round(s.coins * 0.15))),
    maneuver: null,
    stage: 'choose',  // choose -> ready -> result
    result: null,
    day: s.day,
  };
  return { ok: true, duel: s.duel };
}

export function setBet(s, bet) {
  if (!s.duel || s.duel.stage === 'result') return { ok: false };
  s.duel.bet = clamp(Math.round(bet), 0, s.coins);
  return { ok: true, bet: s.duel.bet };
}

export function chooseManeuver(s, key) {
  const d = s.duel;
  if (!d) return { ok: false, why: 'Дуэль не начата.' };
  if (d.stage === 'result') return { ok: false, why: 'Дуэль уже решена.' };
  const m = MANEUVERS[key];
  if (!m) return { ok: false, why: 'Нет такого приёма.' };
  if (d.maneuver && d.maneuver !== key) return { ok: false, why: 'Приём уже выбран. Решительно.' };
  if (m.cost && s.coins < m.cost && d.maneuver !== key) return { ok: false, why: `Нужно ${m.cost} М.` };
  d.maneuver = key;
  d.stage = 'ready';
  if (key === 'probe') {
    d.rival.revealed = true;
    d.rival.hiddenCards = 0;
    d.probed = true;
    return { ok: true, revealed: true, maneuver: m };
  }
  return { ok: true, maneuver: m };
}

/**
 * Модель дуэли. Соперник НЕ виден целиком: пока не потратил «Дознание»,
 * его сила показывается диапазоном. Игрок решает, рискнуть или узнать.
 */
export function duelPreview(s) {
  const d = s.duel;
  if (!d) return null;
  const rival = d.rival;
  const mod = rival.mod;
  const myTable = tableScore(s.stash);
  const myRep = 1 + s.rep / 500;
  let mine = Math.round(myTable.power * myRep);
  let them = rival.basePower;
  const notes = [];
  const known = rival.revealed;

  const metaCount = rival.cards.filter((c) => c.class === rival.meta).length;
  let metaBonus = 0;
  if (metaCount >= 3) metaBonus = Math.round(them * 0.14);
  them += metaBonus;

  let modMult = 1;
  if (mod.id === 'zeal') modMult = 1.18;
  if (mod.id === 'ghost') modMult = 1.1;
  them = Math.round(them * modMult);
  const trueThem = them;

  let m = d.maneuver;
  if (m === 'feint') them = Math.round(them * (mod.id === 'guile' ? 0.75 : 0.85));
  if (m === 'word') { if (metaBonus && mod.id !== 'iron') them -= metaBonus; }
  if (m === 'silence') {
    if (mod.id === 'zeal') them = Math.round(them / 1.18);
    if (mod.id === 'ghost') them = Math.round(them / 1.1);
  }
  if (m === 'tower') mine = Math.round(mine * (myTable.triples.length ? 1.28 : 1.08));
  if (m === 'nest') mine = Math.round(mine * 1.24);
  if (m === 'swap') {
    const n = rival.cards.filter((c) => c.class === rival.meta).length;
    mine += n * 6;
  }
  if (mod.id === 'guile' && m !== 'silence') {
    const bonusPart = Math.max(0, myTable.power - myTable.sum);
    mine -= Math.round(bonusPart * 0.5);
    if (m) notePush(notes, 'Хитрость: соперник съел половину бонуса стола');
  }
  if (mod.id === 'iron' && m === 'word') notePush(notes, 'Железо: Слово его не берёт');

  // Незнание: пока не открыто — показываем коридор ±18%.
  const band = known ? 0 : Math.round(trueThem * 0.18);
  const shownThem = known ? them : them;
  const low = them - band, high = them + band;

  const diff = mine - them;
  const diffLow = mine - high, diffHigh = mine - low;
  return {
    mine, them: shownThem, low, high, band, known,
    diff, diffLow, diffHigh,
    metaBonus, mod, myTable, notes,
    metaCount,
    trueThem,
  };
}

function notePush(arr, t) { if (!arr.includes(t)) arr.push(t); }

export function resolveDuel(s) {
  const d = s.duel;
  if (!d) return { ok: false, why: 'Дуэль не начата.' };
  if (d.stage === 'result') return { ok: false, why: 'Дуэль уже решена.' };
  if (!d.maneuver) return { ok: false, why: 'Выбери приём.' };

  const p = duelPreview(s);
  // Решающий «нерв»: небольшой разброс, но не больше 6%
  const jm = 1 + s.rng.float(-0.03, 0.03);
  const jt = 1 + s.rng.float(-0.03, 0.03);
  const mine = Math.round(p.mine * jm);
  const them = Math.round(p.them * jt);
  const win = mine > them;
  const tie = mine === them;

  const bet = d.bet;
  let payout = 0;
  const greed = d.rival.mod.id === 'greed';
  if (win) {
    payout = Math.round(bet * 0.9 + 35 + s.day * 12 + (greed ? bet * 0.9 : 0) + (bet === 0 ? 15 : 0));
    addCoins(s, payout, `дуэль: ${d.rival.name}`);
    changeRep(s, 3, 'победа в дуэли');
    s.dayStats.duelsWon += 1;
  } else if (tie) {
    payout = 0;
    changeRep(s, 1, 'ничья на грани');
  } else {
    payout = -Math.min(bet, s.coins);
    addCoins(s, payout, `дуэль: ${d.rival.name}`);
    changeRep(s, -1, 'поражение');
  }
  s.duelsToday += 1;
  s.dayStats.duels += 1;

  d.stage = 'result';
  d.result = { win, tie, mine, them, bet, payout, greed };
  return { ok: true, result: d.result };
}

export function closeDuel(s) {
  s.duel = null;
  return { ok: true };
}

// ---------------------------------------------------------------- НОЧЬ

// Ночные события: выбор игрока, все варианты имеют цену.
export const NIGHT_EVENTS = [
  {
    id: 'guest',
    title: 'Ночной гость',
    text: 'В дверь стучит коллекционер. Он предлагает 155% стоимости за любую вещь со стола, но просит выбрать сейчас.',
    options: [
      { key: 'sell', label: 'Продать лучшую', effect: 'sellBest' },
      { key: 'refuse', label: 'Запереть дверь', effect: 'refuse', rep: -1 },
    ],
  },
  {
    id: 'fire',
    title: 'Дым в лавке',
    text: 'Пахнет гарью. Можно залить очаг — 55 М, или рискнуть и потерять часть товара.',
    options: [
      { key: 'pay', label: 'Залить (55 М)', effect: 'payFire' },
      { key: 'risk', label: 'Переждать', effect: 'riskFire' },
    ],
  },
  {
    id: 'bribe',
    title: 'Скандал в зале',
    text: 'Распорядитель аукциона намекает: за 90 М завтра один лот будет без ботов.',
    options: [
      { key: 'pay', label: 'Заплатить (90 М)', effect: 'bribe' },
      { key: 'refuse', label: 'Отказаться', effect: 'decline' },
    ],
  },
  {
    id: 'exchange',
    title: 'Коллекционер из Архива',
    text: 'Архив предлагает обменять две любые вещи на одну редкость. Или не рисковать.',
    options: [
      { key: 'trade', label: 'Обменять (2 → редкость)', effect: 'exchange' },
      { key: 'refuse', label: 'Отказаться', effect: 'decline' },
    ],
  },
  {
    id: 'debt',
    title: 'Старые долги',
    text: 'Ростовщик напоминает о себе. Заплатить 70 М — или пусть пойдёт молва.',
    options: [
      { key: 'pay', label: 'Заплатить (70 М)', effect: 'debtPay' },
      { key: 'risk', label: 'Пусть болтают', effect: 'debtRisk' },
    ],
  },
  {
    id: 'rival',
    title: 'Вызов на утро',
    text: 'Знакомый брокер передаёт вызов: завтра дуэль без ставки, но на репутацию.',
    options: [
      { key: 'accept', label: 'Принять', effect: 'acceptDuel' },
      { key: 'decline', label: 'Отложить', effect: 'decline' },
    ],
  },
];

export function pickNightEvent(s) {
  const rng = s.rng;
  const pool = NIGHT_EVENTS.filter((e) => !s.flags[`ev-${e.id}`]);
  if (!pool.length) return null;
  const ev = rng.pick(pool);
  s.flags[`ev-${ev.id}`] = true;
  return ev;
}

export function guessBestSale(s, pct) {
  if (!s.stash.length) return null;
  const best = [...s.stash].sort((a, b) => b.base - a.base)[0];
  return { relic: best, price: Math.round(best.base * pct) };
}

export function applyNightChoice(s, eventId, key) {
  const ev = NIGHT_EVENTS.find((e) => e.id === eventId);
  if (!ev) return { ok: false };
  const opt = ev.options.find((o) => o.key === key);
  if (!opt) return { ok: false };
  switch (opt.effect) {
    case 'sellBest': {
      if (!s.stash.length) return { ok: false, why: 'Стол пуст.' };
      const best = [...s.stash].sort((a, b) => b.base - a.base)[0];
      const price = Math.round(best.base * 1.55);
      s.stash = s.stash.filter((r) => r.uid !== best.uid);
      addCoins(s, price, `ночной гость: ${best.name}`);
      return { ok: true, text: `Продано «${best.name}» за ${fmt(price)} М.` };
    }
    case 'refuse':
      changeRep(s, opt.rep || 0, 'гость ушёл ни с чем');
      return { ok: true, text: 'Ты запер дверь. Вещи целы.' };
    case 'payFire': {
      if (s.coins < 55) {
        const lost = s.stash.pop();
        return { ok: true, text: 'Денег не хватило. Огонь забрал вещь.' };
      }
      addCoins(s, -55, 'залил очаг');
      return { ok: true, text: 'Огонь потушен, товар цел.' };
    }
    case 'riskFire': {
      if (s.rng.chance(0.5)) {
        const lost = s.stash.pop();
        return { ok: true, text: `Огонь лизнул стол. Потеряно: «${lost?.name || 'ничего'}».` };
      }
      return { ok: true, text: 'Пожар прошёл мимо. Ты сэкономил 55 М.' };
    }
    case 'bribe':
      if (s.coins < 90) return { ok: false, why: 'Не хватает 90 М.' };
      addCoins(s, -90, 'подкуп распорядителя');
      s.flags.bribed = true;
      return { ok: true, text: 'Завтра один лот будет без ботов.' };
    case 'decline':
      return { ok: true, text: 'Ты отказался. Ничего не изменилось.' };
    case 'exchange': {
      if (s.stash.length < 2) return { ok: false, why: 'Нужны две вещи.' };
      const sorted = [...s.stash].sort((a, b) => a.base - b.base);
      const found = s.stash.filter((r) => r.rarity === 'rare' || r.rarity === 'fabled');
      const take = s.stash.filter((r) => !found.includes(r));
      const give = (take.length >= 2 ? take : s.stash).slice(0, 2);
      s.stash = s.stash.filter((r) => !give.includes(r));
      const relic = makeRelic(s.rng, { rarity: 'rare' });
      s.stash.push(relic);
      return { ok: true, text: `Ты отдал две вещи и получил «${relic.name}» (${RARITY_LABEL[relic.rarity]}).` };
    }
    case 'debtPay':
      if (s.coins < 70) return { ok: false, why: 'Не хватает 70 М.' };
      addCoins(s, -70, 'долг закрыт');
      changeRep(s, 2, 'долги честно закрыты');
      return { ok: true, text: 'Долг закрыт. Репутация чиста.' };
    case 'debtRisk':
      changeRep(s, -7, 'долг не закрыт');
      return { ok: true, text: 'Молва пошла. Минус репутация.' };
    case 'acceptDuel':
      s.flags.extraDuel = true;
      changeRep(s, 2, 'принял вызов');
      return { ok: true, text: 'Утром будет лишняя дуэль.' };
    default:
      return { ok: true, text: 'Ничего.' };
  }
}

export function nightLedger(s) {
  const lines = [];
  const rent = 0;
  lines.push({ label: 'Содержание стола', value: -rent });
  const pledgesDue = s.pledges.filter((p) => p.dueDay <= s.day);
  let lost = 0;
  if (pledgesDue.length) {
    lost = pledgesDue.length;
    changeRep(s, -4 * lost, 'заклады пропали в ломбарде');
    s.pledges = s.pledges.filter((p) => p.dueDay > s.day);
  }
  s.inflation = Math.round((s.inflation + 0.22) * 10) / 10;
  if (s.rep > 25) changeRep(s, -2, 'город забывает');
  if (s.broker) addCoins(s, Math.round(30 + s.day * 9), 'комиссия брокера за день');
  return { lines, lost, rent };
}

export function endDay(s) {
  const night = nightLedger(s);
  if (s.day >= DAYS) {
    s.phase = 'final';
    return { ok: true, night, final: true };
  }
  s.day += 1;
  startDay(s);
  if (s.flags.bribed) {
    s.flags.bribed = false;
    s.flags.forceStyle = 'sealed';
    s.market.lots[0].noBots = true;
  }
  return { ok: true, night };
}

// ---------------------------------------------------------------- БРОКЕР

export function brokerPrice(s) {
  return 55 + s.day * 8 + s.inflation * 3;
}

export function hireBroker(s) {
  if (s.broker) return { ok: false, why: 'Брокер уже нанят.' };
  const cost = Math.round(brokerPrice(s));
  if (s.coins < cost) return { ok: false, why: `Нужно ${fmt(cost)} М.` };
  addCoins(s, -cost, 'наём брокера');
  s.broker = true;
  return { ok: true, cost };
}

// ---------------------------------------------------------------- ФИНАЛ

export function championPower(s) {
  // Планка финала видна игроку заранее и не зависит от его стола:
  // это сила «собрания ярмарки» — репутация + касса + день.
  return Math.round(150 + s.rep * 1.1 + Math.min(260, s.coins * 0.05));
}

export function startFinal(s) {
  s.phase = 'final';
  s.final = {
    champion: championPower(s),
    stage: 'intro',
  };
  return s.final;
}

export function resolveFinal(s) {
  const f = s.final;
  if (!f || f.stage === 'done') return { ok: false };
  const mine = tablePower(s);
  const them = f.champion;
  const win = mine >= them;
  const score = s.coins + (win ? 700 : 0) + s.rep * 8 + mine * 2;
  f.mine = mine;
  f.win = win;
  f.score = score;
  f.stage = 'done';
  s.over = true;
  s.result = {
    win,
    score,
    coins: s.coins,
    rep: s.rep,
    rank: rankFor(score, win),
  };
  return { ok: true, result: s.result };
}

function rankFor(score, win) {
  if (!win) return score > 2200 ? 'Перекупщик с именем' : 'Случайный человек на ярмарке';
  if (score >= 4200) return 'Голос Ярмарки';
  if (score >= 3200) return 'Мастер Отблесков';
  if (score >= 2400) return 'Уважаемый торговец';
  return 'Удачливый новичок';
}

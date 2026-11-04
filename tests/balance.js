// Игрок-модели для проверки баланса. node tests/balance.js
import * as E from '/home/user/Minitrader/src/core/engine.js';

// ---------------------------------------------------------------- игроки
const passive = {
  name: 'Пассивный',
  market() {},
  table() {},
  duels() {},
};

/** Обычный игрок: оценивает лот по «видимой» цене, ставит с запасом, боится переплатить. */
function normalPlayer(cfg = {}) {
  return {
    name: 'Обычный',
    market(s) {
      const lots = s.market.lots.filter((l) => !l.done);
      lots.sort((a, b) => a.price / a.value - b.price / b.value);
      for (const lot of lots) {
        if (s.actions <= 0) break;
        const fair = lot.value; // игрок видит справедливую цену (она в UI и есть)
        const startRatio = lot.price / fair;
        if (startRatio > 0.98) continue;
        const budgetCap = Math.round(fair * cfg.overpay);
        const bid = Math.min(s.coins - 30, Math.round(lot.price * 1.15 + 6), budgetCap);
        if (bid > lot.price * 1.4) continue;
        const r = E.placeBid(s, lot.id, bid);
        if (r.ok && r.won) s._stats.bought = (s._stats.bought || 0) + 1;
      }
    },
    table(s) {
      // заказы
      for (const o of s.orders) if (!o.done && E.orderReady(s, o)) E.fulfilOrder(s, o.id);
      // держим классы под тройку и редкость, остальное — на прилавок
      const tri = E.tripleClasses(s.stash);
      const keep = new Set(s.stash.filter((r) => tri.includes(r.class) || r.rarity !== 'common').map((r) => r.uid));
      for (const r of [...s.stash]) if (!keep.has(r.uid) && s.coins < 250) E.sellRelic(s, r.uid);
      if (s.coins > E.slotCost(s) + 180) E.buySlot(s);
      for (const cls of E.CLASS_KEYS) {
        for (const rar of ['common', 'fine']) {
          if (s.stash.filter((r) => r.class === cls && r.rarity === rar).length >= 2 && s.coins > E.craftCost(s) + 120) E.craft(s, cls, rar);
        }
      }
    },
    duels(s) {
      while (s.duelsToday < 3 && s.stash.length >= 2) {
        if (!E.startDuel(s).ok) break;
        E.chooseManeuver(s, cfg.maneuver || 'feint');
        const p = E.duelPreview(s);
        if (p.diff < -30 && s.coins < 200) { E.closeDuel(s); break; }
        E.setBet(s, Math.min(Math.floor(s.coins * 0.2), 150));
        E.resolveDuel(s);
        E.closeDuel(s);
        if (s.coins < 60) break;
      }
    },
  };
}

/** «Эксперт»: знает пределы (модель сильного игрока, который выучил ботов). */
/**
 * «Эксперт» — не просто аккуратная версия обычного игрока.
 * Он: читает цену против каталога, держит тройки, берёт слоты под них,
 * покупает брокера ради квоты, торгуется по коридору силы и уходит из плохих боёв.
 */
function expert() {
  const p = normalPlayer({ overpay: 1.15, maneuver: 'nest' });
  p.name = 'Эксперт';

  p.market = (s) => {
    // 1) Сделка дня: считаем, выгодна ли она по каталогу.
    const d = s.deal;
    if (d && !d.used && d.kind !== 'pawn') {
      const worth = d.relic ? d.relic.base : (d.relics || []).reduce((a, r) => a + r.base, 0);
      if (worth > d.price * 1.05 || d.kind === 'bundles') E.takeDeal(s);
    }
    // 2) Лоты: приоритет — класс, который ждёт дом, и повтор класса на столе.
    const wants = new Set(s.orders.filter((o) => !o.done).map((o) => o.class));
    const lots = s.market.lots.filter((l) => !l.done);
    lots.sort((a, b) => a.price / a.value - b.price / b.value);
    for (const lot of lots) {
      if (s.actions <= 0) break;
      const ratio = lot.price / lot.value;
      if (ratio > 1.05) continue;
      const top = E.bidBots(s, lot)[0];
      if (!top) continue;
      const fitsOrder = lot.relics.some((r) => wants.has(r.class));
      const ceiling = lot.value * (fitsOrder ? 1.3 : 1.1);
      // Перебиваем лидера ровно на шаг: платим минимум, но забираем лот.
      const bid = Math.min(Math.round(top.max + 2), ceiling);
      if (bid > top.max && bid <= s.coins - 50) E.placeBid(s, lot.id, bid);
    }
    // 3) Брокер: раскрывает квоту и поднимает прилавок.
    if (!s.broker && s.coins > E.brokerPrice(s) + 240) E.hireBroker(s);
  };

  p.table = (s) => {
    for (const o of s.orders) if (!o.done && E.orderReady(s, o)) E.fulfilOrder(s, o.id);
    // квота закрывается сама при сдаче/продаже нужной вещи — просто держим её на столе
    const q = s.quota;
    if (s.maxSlots < 8 && s.coins > E.slotCost(s) + 110) E.buySlot(s);
    const tri = E.tripleClasses(s.stash);
    const keep = new Set(s.stash.filter((r) => tri.includes(r.class) || r.rarity !== 'common').map((r) => r.uid));
    for (const r of [...s.stash]) if (!keep.has(r.uid) && s.stash.length > 3) E.sellRelic(s, r.uid);
  };

  p.duels = (s) => {
    let risky = 0;
    while (s.duelsToday < 3 && s.stash.length >= 2) {
      if (!E.startDuel(s).ok) break;
      // Сначала «Дознание» — оно платное, поэтому один раз и только на хорошем столе.
      let best = null;
      for (const k of ['feint', 'tower', 'nest', 'word']) {
        if (!E.chooseManeuver(s, k).ok) continue;
        const q = E.duelPreview(s);
        if (!best || q.diffLow > best.diffLow) best = { k, diffLow: q.diffLow };
      }
      if (!best || best.diffLow <= 0) { E.closeDuel(s); break; }
      E.chooseManeuver(s, best.k);
      const frac = best.diffLow > 25 ? 0.3 : 0.16;
      E.setBet(s, Math.round(s.coins * frac));
      E.resolveDuel(s);
      E.closeDuel(s);
      risky += 1;
      if (s.coins < 100) break;
    }
  };
  return p;
}

// ---------------------------------------------------------------- прогон
function run(player, runs = 300) {
  const agg = { coins: 0, rep: 0, wins: 0, score: 0, finalWin: 0, finals: [], duelsWon: 0, duels: 0 };
  for (let i = 0; i < runs; i++) {
    const s = E.newGame(`b-${player.name}-${i}`);
    s._stats = {};
    let guard = 0;
    while (!s.over && guard++ < 3000) {
      if (s.phase === 'morning') { player.market(s); s.phase = 'table'; }
      else if (s.phase === 'table') { player.table(s); s.phase = 'duel'; }
      else if (s.phase === 'duel') { player.duels(s); s.phase = 'night'; }
      else if (s.phase === 'night') {
        if (s.day >= E.DAYS) { E.startFinal(s); E.resolveFinal(s); }
        else E.endDay(s);
      } else break;
    }
    const r = s.result || { win: false, score: 0 };
    agg.coins += s.coins; agg.rep += s.rep; agg.score += r.score;
    if (r.win) agg.finalWin++;
    agg.duelsWon += s.dayStats?.duelsWon || 0;
    agg.duels += s.dayStats?.duels || 0;
    agg.finals.push(r.rank || '—');
  }
  const n = runs;
  return {
    игрок: player.name,
    монеты: Math.round(agg.coins / n),
    репутация: Math.round(agg.rep / n),
    очков: Math.round(agg.score / n),
    финал: `${Math.round((agg.finalWin / n) * 100)}%`,
    дуэли: `${Math.round((agg.duelsWon / Math.max(1, agg.duels)) * 100)}%`,
  };
}

function clever(){
  const p = normalPlayer({overpay: 1.0, maneuver: 'probe'});
  p.name='Умный';
  p.duels = (s2) => {
    while (s2.duelsToday < 3 && s2.stash.length >= 1) {
      if (!E.startDuel(s2).ok) break;
      E.chooseManeuver(s2, 'probe');
      const opts=['feint','tower','nest'];
      let best=null;
      for (const k of opts){ E.chooseManeuver(s2,k); const q=E.duelPreview(s2); if(!best||q.diff>best.diff) best={k,diff:q.diff}; }
      if (best.diff < -10) { E.closeDuel(s2); break; }
      E.chooseManeuver(s2, best.k);
      E.setBet(s2, Math.round(s2.coins*0.25));
      E.resolveDuel(s2); E.closeDuel(s2);
    }
  };
  p.table = (s2) => {
    for (const o of s2.orders) if (!o.done && E.orderReady(s2,o)) E.fulfilOrder(s2,o.id);
    const tri=E.tripleClasses(s2.stash);
    const keep=new Set(s2.stash.filter(r=>tri.includes(r.class)||r.rarity!=='common').map(r=>r.uid));
    for (const r of [...s2.stash]) if (!keep.has(r.uid) && s2.stash.length>3) E.sellRelic(s2,r.uid);
    if (s2.maxSlots<7 && s2.coins>E.slotCost(s2)+140) E.buySlot(s2);
  };
  return p;
}
console.log(run(passive, 150));
console.log(run(clever(), 200));
console.log(run(normalPlayer({ overpay: 1.0 }), 200));
console.log(run(normalPlayer({ overpay: 1.15 }), 200));
console.log(run(expert(), 200));

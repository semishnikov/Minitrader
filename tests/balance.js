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
function expert() {
  const p = normalPlayer({ overpay: 1.25, maneuver: 'probe' });
  p.name = 'Эксперт';
  p.market = (s) => {
    const lots = s.market.lots.filter((l) => !l.done).sort((a, b) => a.price / a.value - b.price / b.value);
    for (const lot of lots) {
      if (s.actions <= 0) break;
      const top = E.bidBots(s, lot)[0];
      const snipe = Math.round(top.max * 0.97);
      if (snipe < lot.value * 1.02 && snipe < s.coins - 40) E.placeBid(s, lot.id, snipe);
    }
  };
  p.duels = (s) => {
    while (s.duelsToday < 3 && s.stash.length >= 2) {
      if (!E.startDuel(s).ok) break;
      E.chooseManeuver(s, 'probe'); // вскрывает туз
      const opts = ['feint', 'word', 'silence', 'tower', 'swap', 'nest'];
      let best = null;
      for (const k of opts) {
        E.chooseManeuver(s, k);
        const q = E.duelPreview(s);
        if (!best || q.diff > best.diff) best = { k, diff: q.diff };
      }
      E.chooseManeuver(s, best.k);
      if (best.diff < -20 && s.coins < 250) { E.closeDuel(s); break; }
      E.setBet(s, Math.min(Math.floor(s.coins * 0.3), 220));
      E.resolveDuel(s);
      E.closeDuel(s);
      if (s.coins < 80) break;
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

console.log(run(passive, 150));
console.log(run(normalPlayer({ overpay: 1.0 }), 200));
console.log(run(normalPlayer({ overpay: 1.15 }), 200));
console.log(run(expert(), 200));

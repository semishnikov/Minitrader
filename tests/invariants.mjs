// Инварианты экономики: деньги, вещи и правила не должны «течь». Запуск: node tests/invariants.mjs
import * as E from '../src/core/engine.js';
// Тест честности: списываются ли деньги корректно во всех ветках
const tests = [];
function T(name, fn){ try { const r = fn(); tests.push([name, r===true?'OK':'FAIL: '+r]); } catch(e){ tests.push([name,'THROW: '+e.message]); } }

T('ставка больше кассы не проходит', () => {
  const s = E.newGame('t1'); const l = s.market.lots[0];
  const before = s.coins;
  const r = E.placeBid(s, l.id, s.coins + 500);
  return (!r.ok && s.coins === before) || 'ok='+r.ok+' coins='+s.coins;
});
T('пас не тратит действие', () => {
  const s = E.newGame('t2'); const l = s.market.lots[0];
  const a = s.actions; E.passLot(s, l.id);
  return s.actions === a || 'actions '+a+'->'+s.actions;
});
T('победа на аукционе списывает и добавляет вещь', () => {
  const s = E.newGame('t3'); const l = s.market.lots[0];
  const before = s.coins, inv = s.stash.length;
  const r = E.placeBid(s, l.id, l.limits[0].max + 50);
  if (!r.won) return 'не выиграл (случайность)';
  return (s.coins === before - r.price && s.stash.length === inv + l.relics.length) || `coins ${before}->${s.coins} price ${r.price}`;
});
T('продажа на прилавке начисляет и убирает', () => {
  const s = E.newGame('t4'); const l = s.market.lots[0];
  E.placeBid(s, l.id, l.limits[0].max + 50);
  if (!s.stash.length) return 'нечего продавать';
  const before = s.coins, inv = s.stash.length, uid = s.stash[0].uid;
  const r = E.sellRelic(s, uid);
  return (r.ok && s.coins === before + r.price && s.stash.length === inv-1) || 'fail';
});
T('ломбард: залог + выкуп возвращает вещь', () => {
  const s = E.newGame('t5'); const l = s.market.lots[0];
  E.placeBid(s, l.id, l.limits[0].max + 50);
  const uid = s.stash[0].uid; s.coins += 500;
  const p = E.pawn(s, uid);
  if (!p.ok) return 'pawn fail';
  const r = E.redeem(s, 0);
  return (r.ok && s.stash.some(x => x.uid === uid)) || 'redeem fail';
});
T('заказ исполняется только с нужной вещью', () => {
  const s = E.newGame('t6');
  const o = s.orders[0];
  const r1 = E.fulfilOrder(s, o.id);
  if (o.class === undefined) return 'у заказа нет класса';
  return !r1.ok || 'должен был отказать';
});
T('дуэль без приёма не решается', () => {
  const s = E.newGame('t7'); const l = s.market.lots[0];
  E.placeBid(s, l.id, l.limits[0].max + 50);
  E.startDuel(s);
  const r = E.resolveDuel(s);
  return !r.ok || 'решилась без приёма';
});
T('дуэль списывает проигрыш, но не больше ставки', () => {
  const s = E.newGame('t8');
  for (const l of s.market.lots) E.placeBid(s, l.id, l.limits[0].max + 50);
  if (!s.stash.length) return 'нет стола';
  E.startDuel(s); E.chooseManeuver(s, 'feint'); E.setBet(s, 100);
  const before = s.coins;
  const r = E.resolveDuel(s);
  const delta = s.coins - before;
  if (r.result.win) return delta > 0 || 'победа без дохода';
  return delta === -Math.min(100, before) || `списано ${delta}`;
});
T('слот не покупается без денег', () => {
  const s = E.newGame('t9'); s.coins = 0;
  const r = E.buySlot(s);
  return !r.ok || 'купил бесплатно';
});
T('мастерская не съедает вещи при нехватке денег', () => {
  const s = E.newGame('t10'); s.coins = 0;
  const before = s.stash.length;
  const r = E.craft(s, 'amber', 'common');
  return (!r.ok && s.stash.length === before) || 'что-то не так';
});
T('финал завершает игру и не длится дальше', () => {
  const s = E.newGame('t11');
  E.startFinal(s); const r = E.resolveFinal(s);
  const r2 = E.resolveFinal(s);
  return (r.ok && s.over && !r2.ok) || 'финал повторяем';
});
T('все 6 дней проходятся без исключений', () => {
  const s = E.newGame('t12');
  for (let d=0; d<6; d++) { s.phase = 'table'; s.phase = 'duel'; s.phase = 'night'; if (d<5) E.endDay(s); }
  return s.day === 6 || 'day='+s.day;
});
const bad = tests.filter(t => !t[1].startsWith('OK'));
tests.forEach(([n,r]) => console.log((r.startsWith('OK')?'  ✓ ':'  ✗ ') + n + (r.startsWith('OK')?'':' → '+r)));
console.log('\nпровалов:', bad.length, '/', tests.length);

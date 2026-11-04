// ============================================================================
// ЯРМАФКА ОТБЛЕСКОВ — UI. Один экран, нижний док, мгновенный отклик.
// ============================================================================
import * as E from '../core/engine.js';
import { Rng } from '../core/rng.js';
import { CLASSES, TRAITS } from '../data/cards.js';
import { relicArt, crest, ICONS } from './art.js';
import { h, esc, $, clear, onAction, money } from './dom.js';

const APP = $('#app');
const HUD = $('#hud');
const SCREEN = $('#screen');
const DOCK = $('#dock');
const TOASTS = $('#toasts');
const MODAL = $('#modal');

const SAVE_KEY = 'otbleski.save.v1';
const META_KEY = 'otbleski.meta.v1';

const CLS = E.CLASS_KEYS;
const rarName = E.RARITY_LABEL;

let S = null;
let tab = 'market';
let lastCoins = 0;
let ui = {
  bidLot: null,
  bidValue: 0,
  lotsWon: 0,
  finalPending: false,
};

// ---------------------------------------------------------------- звук и вибрация
let actx = null;
const sound = {
  on: true,
  ctx() {
    if (!this.on) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  },
  blip(freq = 660, dur = 0.06, type = 'triangle', gain = 0.05) {
    const c = this.ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  },
  coin() { this.blip(880, 0.07, 'triangle', 0.045); setTimeout(() => this.blip(1320, 0.09, 'triangle', 0.03), 55); },
  no() { this.blip(180, 0.12, 'sawtooth', 0.03); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'triangle', 0.035), i * 80)); },
  lose() { [400, 320, 240].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'sine', 0.035), i * 90)); },
};
const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch {} };

// ---------------------------------------------------------------- сохранение
function save() {
  if (!S) return;
  const { rng, ...plain } = S;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(plain)); } catch {}
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const plain = JSON.parse(raw);
    plain.rng = new RngShim(plain.seed, plain.day);
    return plain;
  } catch { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
function meta() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } }
function setMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify({ ...meta(), ...m })); } catch {} }

// ---------------------------------------------------------------- тосты / числа
function toast(text, tone = '', ms = 1900) {
  const t = h(`<div class="toast ${tone ? 'toast--' + tone : ''}">${text}</div>`);
  TOASTS.appendChild(t);
  while (TOASTS.children.length > 1) TOASTS.firstElementChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, ms);
}

function floatNum(delta) {
  if (!delta) return;
  const el = h(`<div class="floatnum ${delta > 0 ? 'good' : 'bad'}">${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}</div>`);
  const target = $('#coinval');
  const r = target?.getBoundingClientRect();
  el.style.left = `${r ? r.left - 30 : window.innerWidth / 2}px`;
  el.style.top = `${r ? r.top + 2 : 60}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// ---------------------------------------------------------------- модалка
let modalClose = null;
function openModal(html, opts = {}) {
  MODAL.innerHTML = `<div class="modal__scrim" data-close></div><div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  MODAL.classList.add('on');
  document.body.style.overflow = 'hidden';
  modalClose = () => closeModal();
  MODAL.querySelector('[data-close]').addEventListener('click', () => closeModal());
  if (opts.after) opts.after(MODAL.querySelector('.modal'));
}
function closeModal() {
  MODAL.classList.remove('on');
  MODAL.innerHTML = '';
  document.body.style.overflow = '';
  modalClose = null;
}

// ---------------------------------------------------------------- отрисовка
function render(resetScroll = false) {
  if (!S) return;
  renderHUD();
  renderDock();
  const scroll = window.scrollY;
  if (tab === 'market') renderMarket();
  else if (tab === 'table') renderTable();
  else if (tab === 'duel') renderDuel();
  else renderLedger();
  if (resetScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  else if (scroll > 0) window.scrollTo(0, Math.min(scroll, document.body.scrollHeight));
  if (S.coins !== lastCoins) {
    const d = S.coins - lastCoins;
    if (Math.abs(d) >= 1) floatNum(d);
    lastCoins = S.coins;
    const el = $('#coinval');
    if (el) {
      el.parentElement.classList.add(d > 0 ? 'up' : 'down');
      setTimeout(() => el.parentElement.classList.remove('up', 'down'), 380);
    }
  }
  save();
}

function renderHUD() {
  const phaseLabel = { morning: 'Утро · торг', table: 'Полдень · стол', duel: 'Вечер · дуэли', night: 'Ночь', final: 'Финал' }[S.phase] || '';
  const event = S.dayEvent?.name || '';
  const rep = Math.round(S.rep);
  HUD.innerHTML = `
    <div class="hud__row">
      <div class="hud__round">День <b>${S.day}</b> / ${E.DAYS}</div>
      <div class="hud__rep" title="Репутация">реп <b class="mono">${rep}</b></div>
      <div class="hud__acts" title="Действия">${Array.from({ length: S.maxActions }, (_, i) => `<i class="pip ${i < S.actions ? '' : 'off'}"></i>`).join('')}</div>
      <div class="hud__coins" id="coins"><span class="c">М</span><span id="coinval" class="mono">${money(S.coins)}</span></div>
    </div>
    <div class="hud__row" style="margin-top:6px">
      <div class="hud__round" style="letter-spacing:.1em">${esc(phaseLabel)}${event ? ' · ' + esc(event) : ''}</div>
      <div class="grow"></div>
      <button class="btn btn--xs btn--quiet" data-act="help" style="font-size:10.5px;padding:0 10px">правила</button>
    </div>
    <div class="hud__bar">${Array.from({ length: S.maxActions }, (_, i) => `<i class="${i < S.actions ? 'on' : ''}"></i>`).join('')}</div>`;
}

const PHASE_ORDER = ['morning', 'table', 'duel', 'ledger'];
const TABS = [
  ['market', 'Торг', 'market', 'morning'],
  ['table', 'Стол', 'table', 'table'],
  ['duel', 'Дуэли', 'duel', 'duel'],
  ['ledger', 'Книга', 'ledger', 'ledger'],
];

function renderDock() {
  // Подсказка, куда идти сейчас: текущая фаза дня подсвечена, пройденные — галочкой.
  const cur = { morning: 'morning', table: 'table', duel: 'duel', night: 'ledger', final: 'ledger' }[S.phase] || 'morning';
  const curIdx = PHASE_ORDER.indexOf(cur);
  const endDayReady = S.phase === 'night' || S.duelsToday >= 3;
  DOCK.innerHTML = TABS.map(([id, label, icon, phase]) => {
    const idx = PHASE_ORDER.indexOf(phase);
    const isNow = phase === cur;
    const isPast = idx >= 0 && idx < curIdx;
    return `<button class="dock__b ${tab === id ? 'on' : ''} ${isNow ? 'now' : ''} ${isPast ? 'past' : ''}" data-act="tab" data-tab="${id}">
      ${ICONS[icon]}<span>${label}</span>
      ${isNow ? '<span class="dot"></span>' : ''}
      ${id === 'duel' && S.duel && S.duel.stage !== 'result' ? '<span class="badge">!</span>' : ''}
      ${id === 'ledger' && endDayReady ? '<span class="badge badge--brass">•</span>' : ''}
    </button>`;
  }).join('');
}

// ---------------------------------------------------------------- ТОРГ
function renderMarket() {
  const m = S.market;
  const styleName = { dutch: 'Голландский молоток', sealed: 'Слепой аукцион', ladder: 'Лестница', brawl: 'Спорный зал' }[m.style];
  const styleNote = {
    dutch: 'Цена падает с каждым взглядом. Замешкаешься — уведут.',
    sealed: 'Ставки в конвертах. Побеждаешь — платишь вторую ставку + 1.',
    ladder: 'Три ступени: каждая следующая реже и дороже.',
    brawl: 'Открытый торг. Назови сумму — зал ответит.',
  }[m.style];

  const lotsHtml = m.lots.map((lot) => lotRow(lot)).join('');
  const ordersHtml = S.orders.filter((o) => !o.done).map((o) => orderRow(o)).join('') ||
    `<div class="small faint" style="padding:6px 2px">Заказы на сегодня закрыты. Новые — завтра.</div>`;

  SCREEN.innerHTML = `
    <h2 class="h-title" style="margin-top:2px">${esc(styleName)}</h2>
    <p class="h-sub">${esc(styleNote)}</p>
    ${S.market.focusCount >= 2 ? `<div class="row" style="margin-top:8px;gap:6px">
      <span class="chip chip--brass">фокус зала · ${CLASSES[S.market.focus].name.toLowerCase()}</span>
      <span class="tiny faint">${S.market.focusCount} из ${S.market.lots.length} лотов</span>
    </div>` : ''}
    ${dealCard()}

    ${S.dayEvent ? `<div class="panel pad" style="margin-top:10px;border-color:var(--line-soft)">
      <div class="row"><span class="chip chip--brass">${esc(S.dayEvent.name)}</span></div>
      <div class="small dim" style="margin-top:6px">${esc(S.dayEvent.desc)}</div>
    </div>` : ''}

    <div class="bar-sep" style="margin:18px 0 10px">Лоты · действия ${S.actions}</div>
    <div class="stack">${lotsHtml}</div>

    <div class="row" style="margin-top:12px;gap:8px">
      <button class="btn btn--ghost btn--sm grow" data-act="reroll" ${S.rerolled || S.actions <= 0 ? 'disabled' : ''}>
        ${S.rerolled ? 'зал уже меняли' : S.actions <= 0 ? 'торг закрыт' : `другой зал · ${35 + S.day * 8} М`}
      </button>
      <button class="btn btn--ghost btn--sm grow" data-act="rumor" ${S.rumor ? 'disabled' : ''}>
        ${S.rumor ? 'слух уже гуляет' : `слух · ${30 + S.day * 6} М`}
      </button>
    </div>

    <div class="bar-sep" style="margin:20px 0 10px">Заказы домов</div>
    <div class="stack">${ordersHtml}</div>

    <div class="bar-sep" style="margin:20px 0 10px">Прилавок</div>
    <div class="panel pad">
      <div class="row row--between">
        <div>
          <div style="font-family:var(--f-display);font-size:12px;letter-spacing:.12em;color:var(--brass-hi)">БРОКЕР ЗАЛА</div>
          <div class="small dim">+7% к цене прилавка, комиссия в конце дня.</div>
        </div>
        <button class="btn btn--sm" data-act="broker" ${S.broker ? 'disabled' : ''}>${S.broker ? 'нанят' : money(E.brokerPrice(S)) + ' М'}</button>
      </div>
    </div>

    <div class="row" style="margin-top:16px;gap:8px">
      <button class="btn btn--quiet" data-act="night" style="min-height:52px">${S.day >= E.DAYS ? 'к финалу' : 'закрыть день'}</button>
      <button class="btn grow" data-act="toTable" style="min-height:52px">К столу →</button>
    </div>
    ${hintBox('market')}
  `;
}

function dealCard() {
  const d = S.deal;
  if (!d) return '';
  if (d.used) {
    return `<div class="deal deal--done">
      <div class="deal__eyebrow">Сделка дня</div>
      <div class="deal__title">${esc(d.title)} · закрыто</div>
    </div>`;
  }
  const price = d.kind === 'pawn' ? d.loan : d.price;
  const suffix = d.kind === 'pawn' ? 'до вечера' : 'М';
  return `<div class="deal">
    <div class="deal__eyebrow">Сделка дня · только сегодня</div>
    <div class="deal__title">${esc(d.title)}</div>
    <div class="deal__desc">${esc(d.desc)}</div>
    <div class="deal__row">
      <div class="deal__price">${money(price)}<span>${suffix}</span></div>
      <button class="btn btn--xs" data-act="deal" ${S.coins < (d.kind === 'pawn' ? 0 : d.price) ? 'disabled' : ''}>
        ${d.kind === 'pawn' ? 'взять займ' : 'взять'}
      </button>
    </div>
  </div>`;
}

function lotRow(lot) {
  const done = lot.done;
  const won = lot.winner === 'you';
  const isDutch = S.market.style === 'dutch';
  const price = isDutch ? E.dutchPrice(lot) : lot.price;
  const top = E.bidBots(S, lot)[0];
  // Наружу — только качественная подсказка, не число. Иначе торг превращается в арифметику.
  // Два честных сигнала:
  // 1) «текущая цена против каталога» — насколько дорого просят прямо сейчас;
  // 2) «жар зала» — сколько сверху придётся дать, чтобы забрать (относительно старта).
  const askRatio = price / Math.max(1, lot.value);
  const askTag = askRatio > 1.0 ? ['просят выше каталога', 'chip--red']
    : askRatio > 0.88 ? ['просят по каталогу', '']
    : askRatio > 0.72 ? ['просят ниже каталога', 'chip--green']
    : ['просят дёшево', 'chip--green'];
  const heat = top.max / Math.max(1, lot.start);
  const heatTag = heat > 1.9 ? ['зал разгонится', 'chip--red']
    : heat > 1.35 ? ['зал прибавит', '']
    : heat > 1.1 ? ['торг лёгкий', 'chip--green']
    : ['можно тихо', 'chip--green'];
  const freeSlots = S.maxSlots - S.stash.length;
  const room = freeSlots >= lot.relics.length;

  if (done) {
    return `<div class="lot lot--dead ${won ? 'lot--won' : ''}">
      <div class="lot__thumb">${relicCard(lot.relics[0], 'thumb')}</div>
      <div class="lot__body">
        <div class="lot__line">
          <span class="lot__title">${lot.relics.map((r) => esc(r.name)).join(' + ')}</span>
        </div>
        <div class="lot__sub">${won ? 'твоё, за ' + money(lot.soldPrice) + ' М' : 'ушло: ' + esc(lot.winner)}</div>
      </div>
      <div class="lot__aside">
        <div class="lot__price ${won ? 'num-good' : 'faint'}">${money(lot.soldPrice)}</div>
      </div>
    </div>`;
  }

  return `<div class="lot ${isDutch && price > lot.value ? 'lot--waiting' : ''}">
    <div class="lot__thumb">
      ${relicCard(lot.relics[0], 'thumb')}
      ${lot.relics.length > 1 ? `<span class="lot__stack">+${lot.relics.length - 1}</span>` : ''}
    </div>
    <div class="lot__body">
      <div class="lot__line">
        <span class="lot__title">${lot.relics.map((r) => esc(r.name)).join(' + ')}</span>
      </div>
      <div class="lot__chips">
        <span class="chip ${askTag[1]}">${askTag[0]}</span>
        <span class="chip ${heatTag[1]}">${heatTag[0]}</span>
      </div>
      <div class="lot__sub">ценность ≈ ${money(lot.value)} М${isDutch ? ` · цель ≤ ${money(lot.value)}` : ''}</div>
    </div>
    <div class="lot__aside">
      <div class="lot__price">${money(price)}<span class="u">М</span></div>
      ${S.actions <= 0
        ? `<span class="lot__locked">действия<br/>кончились</span>`
        : !room
          ? `<span class="lot__locked">нет<br/>места</span>`
          : isDutch
            ? `<button class="btn btn--xs btn--ghost" data-act="watch" data-lot="${lot.id}">ждать</button>
               <button class="btn btn--xs" data-act="bid" data-lot="${lot.id}">взять</button>`
            : `<button class="btn btn--xs" data-act="bid" data-lot="${lot.id}">ставка</button>
               <button class="btn btn--xs btn--quiet" data-act="pass" data-lot="${lot.id}">пас</button>`}
    </div>
  </div>`;
}

function orderRow(o) {
  const have = S.stash.find((r) => r.class === o.class && r.rarity === o.rarity);
  return `<div class="panel pad" style="border-color:${have ? 'var(--line)' : 'var(--line-soft)'}">
    <div class="row row--between">
      <div class="grow">
        <div style="font-family:var(--f-serif);font-size:16px">${esc(o.house)}</div>
        <div class="tiny dim">${esc(o.desc)}</div>
      </div>
      <div class="mono" style="font-size:16px;color:var(--brass-hi)">${money(o.reward)} М</div>
    </div>
    <div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap">
      <span class="chip" style="border-color:${CLASSES[o.class].color}66;color:${CLASSES[o.class].color}">${CLASSES[o.class].name.toLowerCase()}</span>
      <span class="chip">${rarName[o.rarity]}</span>
      <span class="chip chip--green">+${o.rep} реп</span>
      <div class="grow"></div>
      <button class="btn btn--xs ${have ? '' : 'btn--ghost'}" data-act="order" data-order="${o.id}" ${have ? '' : 'disabled'}>
        ${have ? 'сдать' : 'нет вещи'}
      </button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- СТОЛ
function renderTable() {
  const t = E.tableScore(S.stash);
  const power = E.tablePower(S);
  const slots = [];
  for (let i = 0; i < S.maxSlots; i++) slots.push(S.stash[i] || null);
  const trip = t.triples.length;
  const classesCount = CLS.map((c) => ({ c, n: S.stash.filter((r) => r.class === c).length })).filter((x) => x.n > 0);

  SCREEN.innerHTML = `
    <div class="eyebrow">Стол · день ${S.day}</div>
    <h2 class="h-title">${power}<span style="font-size:18px;color:var(--ink-dim)"> силы</span></h2>
    <p class="h-sub">${trip ? `тройка: ${t.triples.map((c) => CLASSES[c].name.toLowerCase()).join(', ')} · ×${(1 + trip * 0.18 + (t.allDifferent ? 0.12 : 0)).toFixed(2)}` : t.allDifferent ? 'все классы разные · ×1.12' : 'собери три вещи одного класса для тройки'}</p>
    <div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap">
      <span class="chip">сумма ${t.sum}</span>
      <span class="chip">репутация ×${(1 + S.rep / 500).toFixed(2)}</span>
      <span class="chip">${S.stash.length} / ${S.maxSlots} слотов</span>
    </div>

    <div class="table-grid" style="margin-top:14px">
      ${S.stash.map((r, i) => relicCard(r, '', i)).join('')}
    </div>
    ${S.stash.length < S.maxSlots ? `<button class="slots-empty" data-act="emptySlots">
      <span class="slots-empty__plus">+</span>
      <span>свободно ${S.maxSlots - S.stash.length} из ${S.maxSlots}</span>
      <span class="slots-empty__hint">купить слот · ${money(E.slotCost(S))} М</span>
    </button>` : `<div class="slots-full">стол полон · ${S.maxSlots} из ${S.maxSlots}</div>`}

    <div class="row" style="margin-top:12px;gap:8px">
      <button class="btn btn--ghost btn--sm grow" data-act="craft">мастерская · спайка двух вещей</button>
      ${S.maxSlots < 8 ? `<button class="btn btn--ghost btn--sm" data-act="slot">+ слот</button>` : ''}
    </div>

    <div class="panel pad" style="margin-top:12px;border-color:${S.quota?.done ? 'rgba(121,180,106,.35)' : 'var(--line-soft)'};background:rgba(236,229,215,.025)">
      <div class="row row--between">
        <div class="grow">
          <div style="font-family:var(--f-display);font-size:11px;letter-spacing:.14em;color:${S.quota?.done ? 'var(--green)' : 'var(--brass)'}">
            ${S.quota?.done ? 'КВОТА РАСКРЫТА' : 'НЕМАЯ КВОТА'}
          </div>
          <div class="small dim" style="margin-top:3px">
            ${S.quota?.done
              ? `${esc(S.quota.house)} уже получил своё — премия в кассе.`
              : S.quota?.revealed
                ? `${esc(S.quota.house)} ищет: ${CLASSES[S.quota.class].name.toLowerCase()}, ${rarName[S.quota.rarity]}. Сдай такую вещь домой или на прилавок.`
                : `Один из домов тайно ищет вещь и заплатит сверх заказа. Найми брокера — он знает, кто и что ищет.`}
          </div>
        </div>
        <div class="mono" style="font-size:17px;color:${S.quota?.done ? 'var(--green)' : 'var(--brass-hi)'}">
          ${S.quota?.done ? '✓' : money(S.quota?.reward || 0) + ' М'}
        </div>
      </div>
    </div>

    ${classesCount.length ? `<div class="bar-sep" style="margin:18px 0 10px">Классы</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        ${classesCount.map(({ c, n }) => `<span class="chip" style="border-color:${CLASSES[c].color}55;color:${CLASSES[c].color}">${CLASSES[c].name.toLowerCase()} · ${n}${n >= 3 ? ' ✓' : ''}</span>`).join('')}
      </div>` : ''}

    <div class="bar-sep" style="margin:18px 0 10px">Стол на продажу</div>
    <div class="stack">
      ${S.stash.length ? S.stash.map((r) => saleRow(r)).join('') : `<div class="small faint" style="padding:4px 2px">Пусто. Сходи на торг.</div>`}
    </div>

    ${S.pledges.length ? `<div class="bar-sep" style="margin:18px 0 10px">Ломбард</div>
      <div class="stack">${S.pledges.map((p, i) => pledgeRow(p, i)).join('')}</div>` : ''}

    <div class="row" style="margin-top:16px">
      <button class="btn btn--block" data-act="toDuel" ${S.stash.length ? '' : 'disabled'}>К дуэлям →</button>
    </div>
    ${hintBox('table')}
  `;
}

function saleRow(r) {
  const price = E.sellPrice(S, r);
  const pawnP = E.pawnPrice(S, r);
  return `<div class="panel pad" style="padding:10px 12px">
    <div class="row">
      <div style="width:44px;flex:0 0 auto;color:${CLASSES[r.class].color}">${relicArt(r, 'art')}</div>
      <div class="grow">
        <div class="truncate" style="font-family:var(--f-serif);font-size:15px">${esc(r.name)}</div>
        <div class="tiny dim">${CLASSES[r.class].name.toLowerCase()} · ${rarName[r.rarity]}</div>
      </div>
      <button class="btn btn--xs" data-act="sell" data-uid="${r.uid}">${money(price)} М</button>
      <button class="btn btn--xs btn--quiet" data-act="pawn" data-uid="${r.uid}" title="залог">залог ${money(pawnP)}</button>
    </div>
  </div>`;
}

function pledgeRow(p, i) {
  const cost = E.redeemCost(p);
  return `<div class="panel pad" style="padding:10px 12px">
    <div class="row">
      <div class="grow">
        <div class="small">${esc(p.relic.name)} <span class="faint">· залог ${money(p.loan)}</span></div>
        <div class="tiny ${p.dueDay <= S.day ? 'num-bad' : 'faint'}">выкуп ${money(cost)} М · до дня ${p.dueDay}${p.dueDay <= S.day ? ' (сегодня!)' : ''}</div>
      </div>
      <button class="btn btn--xs" data-act="redeem" data-idx="${i}" ${S.coins < cost || S.stash.length >= S.maxSlots ? 'disabled' : ''}>выкупить</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- ДУЭЛИ
function renderDuel() {
  if (!S.duel) {
    SCREEN.innerHTML = `
      <div class="eyebrow">Вечер · арена заказов</div>
      <h2 class="h-title">Дуэли</h2>
      <p class="h-sub">Три боя за вечер. Ставка из монет, победа — приём и стол, а не удача.</p>
      <div class="row" style="margin-top:12px;gap:6px;flex-wrap:wrap">
        <span class="chip">сыграно ${S.duelsToday} / 3</span>
        <span class="chip">сила стола ${E.tablePower(S)}</span>
        <span class="chip chip--brass">${S.stash.length} вещей</span>
      </div>
      <div class="panel pad" style="margin-top:16px">
        <div style="font-family:var(--f-display);font-size:12px;letter-spacing:.12em;color:var(--brass-hi)">КАК ЭТО РАБОТАЕТ</div>
        <ol class="small dim" style="margin:8px 0 0;padding-left:18px;display:grid;gap:5px">
          <li>Соперник собран под твой стол — бой близкий.</li>
          <li>Его сила видна только коридором, пока не потратишь приём «Дознание».</li>
          <li>Один приём за бой: сбить мету, глушить туз, усилить себя.</li>
          <li>Ставка — твои монеты. Победа платит 155% + премия дня.</li>
        </ol>
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn btn--block" data-act="startDuel" ${S.duelsToday >= 3 || !S.stash.length ? 'disabled' : ''}>
          ${S.duelsToday >= 3 ? 'на сегодня всё' : S.stash.length ? 'вызвать соперника' : 'нужен хотя бы один предмет'}
        </button>
      </div>
      ${S.stash.length ? `<div class="bar-sep" style="margin:20px 0 10px">Твой стол</div><div class="table-grid">${S.stash.map((r) => relicCard(r)).join('')}</div>` : ''}
      ${hintBox('duel')}
    `;
    return;
  }
  const d = S.duel;
  if (d.stage === 'result') return renderDuelResult(d);
  return renderDuelStage(d);
}

function renderDuelStage(d) {
  const p = E.duelPreview(S);
  const r = d.rival;
  const known = p.known;
  const man = d.maneuver ? E.MANEUVERS[d.maneuver] : null;
  const scale = Math.max(p.mine, p.high, 1);
  const verdict = known
    ? (p.diff > 12 ? ['беру', 'good'] : p.diff > -8 ? ['на грани', 'brass'] : ['не по зубам', 'bad'])
    : (p.diffLow > 0 ? ['скорее беру', 'good'] : p.diffHigh < 0 ? ['скорее нет', 'bad'] : ['неизвестно', 'brass']);

  // Прогноз по каждому приёму: считаем ту же математику, что и бой, но без разброса.
  const forecast = (key) => {
    const snap = S.duel.maneuver;
    S.duel.maneuver = key;
    const q = E.duelPreview(S);
    S.duel.maneuver = snap;
    return q;
  };
  const maneuvers = Object.entries(E.MANEUVERS).map(([key, m]) => {
    const active = d.maneuver === key;
    const q = forecast(key);
    // Пока соперник не изучен — показываем не «силу против коридора»,
    // а запас: насколько твоя сила выше нижней границы и ниже верхней.
    const ahead = q.diffLow;
    const tone = ahead > 0 ? 'good' : q.diffHigh < 0 ? 'bad' : 'brass';
    const label = known
      ? (q.diff > 0 ? '+' + money(q.diff) : q.diff === 0 ? 'ровно' : money(q.diff))
      : ahead > 0
        ? `≥${money(-ahead)}`
        : q.diffHigh < 0
          ? `<${money(-q.diffHigh)}`
          : 'на грани';
    // Второй строкой — точный запас по нижней границе: именно он отличает приёмы друг от друга.
    const sub = known ? '' : (ahead >= 0 ? `+${money(ahead)}` : money(ahead));
    return `<button class="man man--${tone} ${active ? 'man--on' : ''}" data-act="maneuver" data-key="${key}">
      <span class="man__name">${m.name}</span>
      <span class="man__forecast">${label}</span>
      ${sub ? `<span class="man__sub">${sub} к худшему раскладу</span>` : ''}
      <span class="man__desc">${m.desc}</span>
      <span class="man__cost">${m.cost ? money(m.cost) + ' М' : '—'}</span>
    </button>`;
  }).join('');

  SCREEN.innerHTML = `
    <div class="row row--between" style="align-items:center">
      <div class="eyebrow">Дуэль ${S.duelsToday + 1} из 3</div>
      <div class="chip ${verdict[1] === 'good' ? 'chip--green' : verdict[1] === 'bad' ? 'chip--red' : 'chip--brass'}">${verdict[0]}</div>
    </div>
    <h2 class="h-title" style="margin-top:2px">${esc(r.name)}</h2>
    <p class="h-sub">${known ? esc(`${r.mod.name} — ${r.mod.desc}`) : esc(r.tell)}</p>

    <div class="duelcard">
      <div class="duelcard__side">
        <div class="duelcard__lbl">твой стол</div>
        <div class="duelcard__num me">${money(p.mine)}</div>
      </div>
      <div class="duelcard__mid">
        <span class="duelcard__vs">против</span>
        <span class="duelcard__diff ${known ? (p.diff > 0 ? 'num-good' : p.diff < 0 ? 'num-bad' : '') : 'faint'}">
          ${known ? (p.diff > 0 ? '+' + money(p.diff) : p.diff === 0 ? 'ровно' : money(p.diff)) : `${money(p.low)}–${money(p.high)}`}
        </span>
      </div>
      <div class="duelcard__side duelcard__side--r">
        <div class="duelcard__lbl">${known ? 'соперник' : 'соперник (коридор)'}</div>
        <div class="duelcard__num them">${known ? money(p.them) : money(p.low) + '–' + money(p.high)}</div>
      </div>
      <div class="duelcard__bars">
        <div class="duelcard__track"><i style="width:${(p.mine / scale) * 100}%"></i></div>
        <div class="duelcard__track duelcard__track--r"><i style="width:${(p.low / scale) * 100}%"></i>
          ${!known ? `<b style="left:${(p.low / scale) * 100}%;width:${((p.high - p.low) / scale) * 100}%"></b>` : ''}
        </div>
      </div>
      <div class="duelcard__foot">
        <span>${p.myTable.triples.length ? 'тройка: ' + p.myTable.triples.map((c) => CLASSES[c].name.toLowerCase()).join(', ') : 'без тройки'}${p.myTable.allDifferent ? ' · все разные' : ''}</span>
        <span class="faint">мета: ${CLASSES[r.meta].name.toLowerCase()}</span>
      </div>
      ${p.notes.length ? `<div class="duelcard__note">${p.notes.map(esc).join(' · ')}</div>` : ''}
    </div>

    <div class="bar-sep" style="margin:14px 0 8px">Его стол · ${r.cards.length} ${r.cards.length === 1 ? 'вещь' : r.cards.length < 5 ? 'вещи' : 'вещей'}</div>
    <div class="table-grid table-grid--xs">
      ${r.cards.map((c, i) => `<div style="position:relative">${relicCard(c, 'xs', i, !known && i === 0)}
        ${known && c.class === r.meta ? '<span class="metatag">мета</span>' : ''}</div>`).join('')}
    </div>

    <div class="bar-sep" style="margin:18px 0 9px">Приём · один за бой${man ? ' <span class="faint" style="letter-spacing:0">— можно передумать</span>' : ''}</div>
    <div class="mangrid">${maneuvers}</div>

    <div class="bar-sep" style="margin:18px 0 9px">Ставка · ${d.bet ? money(d.bet) + ' М на кон' : 'без ставки'}</div>
    <div class="betrow">
      <button class="betrow__b" data-act="betMinus">−</button>
      <div class="betrow__v">
        <b>${money(d.bet)}</b><small>${d.bet ? 'при победе +' + money(Math.round(d.bet * 1.55 + 30 + S.day * 10)) + ' М' : 'без ставки — только репутация'}</small>
      </div>
      <button class="betrow__b" data-act="betPlus">+</button>
    </div>
    <input type="range" min="0" max="${S.coins}" step="10" value="${d.bet}" data-betrange style="--fill:${(d.bet / Math.max(1, S.coins)) * 100}%" aria-label="Ставка" />

    <div class="duelcta">
      <button class="btn btn--quiet" data-act="leaveDuel" style="min-height:52px">уйти</button>
      ${man
        ? `<button class="btn grow" data-act="resolveDuel" style="min-height:52px">${man.name === 'Дознание' ? 'вскрыть и в бой' : 'в бой · ' + man.name.toLowerCase()}</button>`
        : `<button class="btn grow" data-act="toManeuvers" style="min-height:52px">выбрать приём ↑</button>`}
    </div>
  `;

  const range = $('[data-betrange]', SCREEN);
  if (range) {
    range.addEventListener('input', () => {
      E.setBet(S, Number(range.value));
      range.style.setProperty('--fill', `${(range.value / Math.max(1, S.coins)) * 100}%`);
      const v = $('.betrow__v', SCREEN);
      const b = S.duel.bet;
      const winPay = b ? Math.round(b * 0.9 + 35 + S.day * 12) : 50;
      v.innerHTML = `<b>${money(b)}</b><small>${b ? 'при победе +' + money(winPay) + ' М' : 'без ставки — только репутация'}</small>`;
      renderHUD();
    });
  }
}

function renderDuelResult(d) {
  const res = d.result;
  const tone = res.win ? 'good' : res.tie ? 'brass' : 'bad';
  SCREEN.innerHTML = `
    <div class="eyebrow">Дуэль · ${esc(d.rival.name)}</div>
    <h2 class="h-title" style="color:${res.win ? 'var(--brass-hi)' : 'var(--ink)'}">${res.win ? 'Твоя взяла' : res.tie ? 'Ничья' : 'Проиграл'}</h2>
    <div class="panel pad" style="margin-top:14px;border-color:${res.win ? 'rgba(121,180,106,.4)' : 'var(--line-soft)'}">
      <div class="row row--between">
        <div><div class="tiny faint">твоя сила</div><div class="duelbar__v me">${money(res.mine)}</div></div>
        <div style="font-family:var(--f-serif);color:var(--ink-faint)">против</div>
        <div style="text-align:right"><div class="tiny faint">соперник</div><div class="duelbar__v them">${money(res.them)}</div></div>
      </div>
      <hr class="rule" />
      <div class="row row--between">
        <span class="small dim">итог по кассе</span>
        <span class="mono" style="font-size:20px;color:${res.payout >= 0 ? 'var(--green)' : 'var(--red)'}">${res.payout >= 0 ? '+' : '−'}${money(Math.abs(res.payout))} М</span>
      </div>
      ${res.greed && res.win ? `<div class="tiny num-brass" style="margin-top:6px">У него был козырь «Жадность» — проиграв, он платит вдвое. Ты этим и воспользовался.</div>` : ''}
      ${res.greed && !res.win ? `<div class="tiny faint" style="margin-top:6px">Он жадный: проиграй он — заплатил бы вдвое. Но сила была на его стороне.</div>` : ''}
    </div>

    ${res.breakdown ? `<div class="panel pad" style="margin-top:10px">
      <div class="tiny faint" style="margin-bottom:7px">как сложилась сила</div>
      ${res.breakdown.map((b) => `<div class="row row--between" style="padding:3px 0">
        <span class="small dim">${esc(b[0])}</span>
        <span class="mono small ${b[2] === 'bad' ? 'num-red' : b[2] === 'good' ? 'num-good' : 'num-brass'}">${b[1]}</span>
      </div>`).join('')}
    </div>` : ''}

    <div class="panel pad" style="margin-top:10px">
      <div class="tiny faint" style="margin-bottom:7px">что запомнить</div>
      <div class="small dim">${res.win
        ? (d.maneuver === 'nest' ? 'Гнездо бьёт почти всех, но стоит дорого — держи его на финале.'
          : d.maneuver === 'feint' ? 'Обманка ломает «Хитрость». Против сильных соперников — лучший размен.'
          : d.maneuver === 'tower' ? 'Башня сильна только с тройкой на столе.'
          : 'Приём сработал. У соперника был скрытый козырь — в следующий раз попробуй «Дознание».')
        : (d.maneuver === 'probe' ? 'Дознание силой не бьёт — оно готовит следующие бои.'
          : 'Твой приём оказался слабее. Попробуй другой: у каждого — своя цена и свой контрприём.')}
      </div>
    </div>
    <div class="row" style="margin-top:16px;gap:8px">
      <button class="btn grow" data-act="nextDuel">${S.duelsToday >= 3 ? 'к ночи' : 'следующий соперник'}</button>
    </div>
    ${S.duelsToday >= 3 ? `<div class="row" style="margin-top:8px"><button class="btn btn--ghost btn--block" data-act="night">закончить день</button></div>` : ''}
  `;
}

// ---------------------------------------------------------------- КНИГА
function renderLedger() {
  const rows = [...S.history].reverse().slice(0, 60).map((r) => `
    <div class="row" style="align-items:flex-start;gap:8px;padding:4px 0">
      <span class="tiny faint mono" style="width:26px">д${r.day}</span>
      <span class="small ${r.tone === 'good' ? 'num-good' : r.tone === 'bad' ? 'num-bad' : ''}" style="flex:1">${esc(r.text)}</span>
    </div>`).join('');
  SCREEN.innerHTML = `
    <div class="eyebrow">Книга · день ${S.day}</div>
    <h2 class="h-title">Что было</h2>
    <p class="h-sub">Каждая монета и каждая ошибка записаны.</p>

    <div class="panel pad" style="margin-top:14px">
      <div class="kv"><span class="dim">касса</span><b>${money(S.coins)} М</b></div>
      <div class="kv"><span class="dim">репутация</span><b>${Math.round(S.rep)}</b></div>
      <div class="kv"><span class="dim">инфляция</span><b>${S.inflation.toFixed(1)}</b></div>
      <div class="kv"><span class="dim">сила стола</span><b>${E.tablePower(S)}</b></div>
      <div class="kv"><span class="dim">дуэли сегодня</span><b>${S.duelsToday} / 3</b></div>
      <div class="kv"><span class="dim">лоты сегодня</span><b>${S.dayStats.lotsWon}</b></div>
    </div>

    <div class="bar-sep" style="margin:18px 0 10px">Записи</div>
    <div class="panel pad" style="max-height:46vh;overflow:auto">${rows || '<div class="small faint">Пока пусто.</div>'}</div>

    <div class="row" style="margin-top:16px;gap:8px">
      <button class="btn btn--ghost btn--sm grow" data-act="export">код партии</button>
      <button class="btn btn--ghost btn--sm grow" data-act="rules">свод правил</button>
    </div>
    <div class="dayend">
      <div class="dayend__hint">
        ${S.duelsToday < 3 && S.phase !== 'night'
          ? `дуэлей сегодня: ${S.duelsToday} из 3`
          : S.day >= E.DAYS ? 'шестой день прожит' : 'день можно закрывать'}
      </div>
      ${S.day >= E.DAYS
        ? `<button class="btn btn--block" data-act="final" style="min-height:54px">Большой молоток →</button>`
        : `<button class="btn btn--block" data-act="night" style="min-height:54px">закончить день ${S.day}</button>`}
    </div>
  `;
}

// ---------------------------------------------------------------- карточка реликвии
function relicCard(r, size = '', idx = null, hidden = false) {
  const sfx = size ? ' relic--' + size : '';
  if (hidden) {
    return `<div class="relic relic--empty${sfx}" style="--cls:#6a6a66">
      <div class="relic__art" style="opacity:.3"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="24" stroke="currentColor" fill="none" stroke-width="1" stroke-dasharray="3 5"/></svg></div>
      <div class="relic__cls">СКРЫТО</div>
    </div>`;
  }
  const col = CLASSES[r.class].color;
  const pips = E.RARITY_ORDER.indexOf(r.rarity) + 1;
  const showVal = size !== 'thumb';
  const rarCls = r.rarity === 'fabled' ? ' relic--fabled' : r.rarity === 'rare' ? ' relic--rare' : '';
  return `<div class="relic${sfx}${rarCls}" style="--cls:${col}" ${idx !== null ? `data-idx="${idx}"` : ''}>
    ${showVal ? `<div class="relic__val">${r.base}</div>` : ''}
    <div class="relic__art">${relicArt(r)}</div>
    ${r.trait && TRAITS[r.trait] && size !== 'xs' ? `<div class="relic__trait" title="${esc(TRAITS[r.trait].desc)}">${esc(TRAITS[r.trait].name)}</div>` : ''}
    <div class="relic__meta">
      <div class="relic__name">${esc(r.name)}</div>
      <div class="relic__foot">
        <span class="relic__cls">${CLASSES[r.class].name.slice(0, 4)}</span>
        <span class="relic__dots">${Array.from({ length: 4 }, (_, i) => `<i class="${i < pips ? 'on' : ''}"></i>`).join('')}</span>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- подсказки
const HINTS = {
  market: 'Действия кончились? Жми «К столу» — торг закрыт.',
  table: 'Продай лишнее, чтобы освободить слоты. Заказ дома платит вдвое больше прилавка.',
  duel: '«Дознание» не даёт силы, но убирает незнание. Иногда это дороже приёма.',
};

function hintBox(key) {
  const t = HINTS[key];
  if (!t) return '';
  return `<div class="tiny faint center" style="margin-top:18px;line-height:1.5">${esc(t)}</div>`;
}

// ---------------------------------------------------------------- действия
const actions = {
  tab(el) { tab = el.dataset.tab; render(true); buzz(6); save(); },

  toTable() { tab = 'table'; S.phase = S.phase === 'morning' ? 'table' : S.phase; render(); buzz(8); },
  toDuel() { tab = 'duel'; S.phase = S.phase === 'table' ? 'duel' : S.phase; render(); buzz(8); },

  bid(el) {
    const lot = S.market.lots.find((l) => l.id === el.dataset.lot);
    if (!lot) return;
    const suggest = S.market.style === 'dutch' ? E.dutchPrice(lot) : Math.max(lot.price, E.bidBots(S, lot)[0].max + 1);
    ui.bidLot = lot.id;
    ui.bidValue = Math.min(S.coins, suggest);
    openBidSheet(lot);
  },

  watch(el) {
    const r = E.watchLot(S, el.dataset.lot);
    if (!r.ok) return toast('Здесь нечего ждать.', 'bad');
    buzz(10);
    if (r.lost) { toast(`Увели из-под носа: ${esc(r.bot)}`, 'bad'); sound.no(); }
    else { sound.blip(420, 0.05); toast(`Цена упала до ${money(r.price)} М`, 'brass'); }
    render();
  },

  pass(el) {
    const r = E.passLot(S, el.dataset.lot);
    if (!r.ok) return;
    buzz(8);
    toast(`Пас. Лот ушёл ${esc(r.rival)} за ${money(r.price)} М`, '');
    render();
  },

  reroll() {
    const r = E.rerollMarket(S);
    if (!r.ok) return toast(esc(r.why), 'bad');
    buzz(12); sound.blip(520, 0.06); toast('Другой зал. Другая публика.', 'brass');
    render();
  },

  broker() {
    const r = E.hireBroker(S);
    if (!r.ok) return toast(esc(r.why), 'bad');
    sound.coin(); buzz(12);
    toast(r.quota && !r.quota.done ? 'Брокер нанят: он знает, что ищет город.' : 'Брокер нанят: прилавок платит больше.', 'good', 2600);
    render();
  },

  rumor() { openRumorSheet(); },

  order(el) {
    const r = E.fulfilOrder(S, el.dataset.order);
    if (!r.ok) return toast(esc(r.why), 'bad');
    sound.coin(); buzz(18);
    toast(`Заказ исполнен: +${money(r.reward)} М`, 'good');
    render();
  },

  sell(el) {
    const r = E.sellRelic(S, el.dataset.uid);
    if (!r.ok) return toast(esc(r.why), 'bad');
    sound.coin(); buzz(10);
    toast(`Продано за ${money(r.price)} М`, 'good');
    render();
  },

  pawn(el) {
    const r = E.pawn(S, el.dataset.uid);
    if (!r.ok) return toast(esc(r.why), 'bad');
    buzz(10);
    toast(`Залог ${money(r.loan)} М. Выкуп до дня ${S.day + 2}.`, 'brass');
    render();
  },

  redeem(el) {
    const r = E.redeem(S, Number(el.dataset.idx));
    if (!r.ok) return toast(esc(r.why), 'bad');
    sound.coin(); buzz(10);
    toast('Вещь вернулась на стол.', 'good');
    render();
  },

  slot() {
    const r = E.buySlot(S);
    if (!r.ok) return toast(esc(r.why), 'bad');
    sound.coin(); buzz(14);
    toast(`Слотов теперь ${S.maxSlots}.`, 'good');
    render();
  },

  craft() { openCraftSheet(); },
  deal() {
    const d = S.deal;
    const r = E.takeDeal(S);
    if (!r.ok) return toast(esc(r.why), 'bad');
    buzz(16);
    if (d.kind === 'pawn') { sound.coin(); toast(esc(r.text), 'brass', 3200); }
    else if (r.profit >= 0) { sound.coin(); toast(`Сделка: ${esc(r.text)} — выгода ${money(r.profit)} М`, 'good', 3400); }
    else { sound.no(); toast(`Сделка: ${esc(r.text)} — переплатил ${money(-r.profit)} М`, 'bad', 3400); }
    render();
  },
  emptySlots() { actions.slot(); },

  startDuel() {
    const r = E.startDuel(S);
    if (!r.ok) return toast(esc(r.why), 'bad');
    S.phase = 'duel';
    buzz(20); sound.blip(300, 0.1, 'sawtooth', 0.03);
    render();
  },

  maneuver(el) {
    const r = E.chooseManeuver(S, el.dataset.key);
    if (!r.ok) return toast(esc(r.why), 'bad');
    buzz(8); sound.blip(600, 0.05);
    if (r.revealed) toast('Дознание: его приём вскрыт.', 'brass');
    render();
  },

  toManeuvers() {
    const el = document.querySelector('.mangrid');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('Выбери приём — потом в бой.', 'brass'); }
  },
  betPlus() { E.setBet(S, S.duel.bet + 20); render(); buzz(5); },
  betMinus() { E.setBet(S, S.duel.bet - 20); render(); buzz(5); },

  resolveDuel() {
    const r = E.resolveDuel(S);
    if (!r.ok) return toast(esc(r.why), 'bad');
    buzz(30);
    if (r.result.win) sound.win(); else sound.lose();
    render();
  },

  leaveDuel() {
    if (S.duel?.maneuver) S.duelsToday += 1;
    E.closeDuel(S);
    render();
  },

  nextDuel() {
    E.closeDuel(S);
    if (S.duelsToday >= 3) { tab = 'ledger'; }
    render();
  },

  night() { openNightSheet(); },
  final() { startFinale(); },
  help() { openRules(); },
  rules() { openRules(); },
  export() { openExport(); },
};

// ---------------------------------------------------------------- шторки
function openBidSheet(lot) {
  const isDutch = S.market.style === 'dutch';
  const top = E.bidBots(S, lot)[0];
  const min = isDutch ? E.dutchPrice(lot) : Math.max(1, Math.floor(lot.start * 0.9));
  // Максимум ползунка — вся касса, но подсказка «где больно» появляется только после разведки.
  const max = Math.max(min + 5, Math.min(S.coins, Math.round(lot.value * 2.2)));
  const start = Math.min(max, Math.max(min, isDutch ? min : Math.round(lot.start * 1.05)));
  const scoutingCost = 6 + Math.round(lot.value * 0.06);
  const scouted = !!lot.scouted;

  openModal(`
    <div class="row row--between" style="align-items:baseline">
      <div class="eyebrow">${isDutch ? 'Голландский молоток' : 'Открытая ставка'}</div>
      <div class="tiny faint">лот ${esc(lot.id)}</div>
    </div>
    <div class="modal__title">${lot.relics.map((r) => esc(r.name)).join(' + ')}</div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">
      ${lot.relics.map((r) => `<span class="chip" style="border-color:${CLASSES[r.class].color}55;color:${CLASSES[r.class].color}">${CLASSES[r.class].name.toLowerCase()} · ${rarName[r.rarity]}</span>`).join('')}
    </div>

    <div style="margin:16px 0 4px">
      <div class="stepper">
        <button class="stepper__b" data-bidminus>−</button>
        <div class="stepper__v"><span id="bidv">${money(start)}</span><small>твоя ставка · касса ${money(S.coins)}</small></div>
        <button class="stepper__b" data-bidplus>+</button>
      </div>
      <input id="bidrange" type="range" min="${min}" max="${max}" step="1" value="${start}" style="--fill:${((start - min) / Math.max(1, max - min)) * 100}%;margin-top:10px" />
      <div class="row row--between" style="margin-top:2px">
        <span class="tiny faint">${money(min)}</span>
        <span class="tiny faint">${money(max)}</span>
      </div>
    </div>

    <div class="panel pad" style="background:rgba(236,229,215,.03)">
      <div class="kv"><span class="dim">ценность по каталогу</span><b>${money(lot.value)} М</b></div>
      <div class="kv"><span class="dim">заплатишь, если возьмёшь</span><b id="bidwin">${money(start)} М</b></div>
      <div class="kv"><span class="dim">выгода к каталогу</span><b id="bidmargin" class="${lot.value - start >= 0 ? 'num-good' : 'num-bad'}">${money(lot.value - start)} М</b></div>
    </div>

    ${scouted
      ? `<div class="panel pad" style="margin-top:10px;border-color:var(--line)">
           <div style="font-family:var(--f-display);font-size:11px;letter-spacing:.14em;color:var(--brass-hi)">РАЗВЕДКА</div>
           <div class="small" style="margin-top:4px">${esc(top.bot.name)} ${isDutch ? 'готов забрать' : 'пойдёт до'} <b class="mono">${money(top.max)} М</b>.</div>
           <div class="tiny faint" style="margin-top:3px">${isDutch ? 'Возьми не позже этой цены.' : `Ставь ${money(top.max + 1)} М — и лот твой.`}</div>
         </div>`
      : `<button class="btn btn--ghost btn--block btn--sm" data-scout style="margin-top:10px">
           разведать зал · ${money(scoutingCost)} М
         </button>`}

    <div class="row" style="margin-top:12px;gap:8px">
      <button class="btn btn--quiet" data-cancel style="min-height:48px">отмена</button>
      <button class="btn grow" data-bidgo>ударить молотком</button>
    </div>
  `);

  const range = $('#bidrange');
  const update = (v) => {
    ui.bidValue = v;
    range.value = v;
    range.style.setProperty('--fill', `${((v - min) / Math.max(1, max - min)) * 100}%`);
    $('#bidv').textContent = money(v);
    $('#bidwin').textContent = money(isDutch ? v : Math.max(secondFor(lot, v), v)) + ' М';
    const m = $('#bidmargin');
    m.textContent = money(lot.value - v) + ' М';
    m.className = lot.value - v >= 0 ? 'num-good' : 'num-bad';
  };
  range.addEventListener('input', () => update(Number(range.value)));
  MODAL.querySelector('[data-bidminus]').onclick = () => update(Math.max(min, ui.bidValue - 5));
  MODAL.querySelector('[data-bidplus]').onclick = () => update(Math.min(max, ui.bidValue + 5));
  MODAL.querySelector('[data-cancel]').onclick = closeModal;

  const scout = MODAL.querySelector('[data-scout]');
  if (scout) scout.onclick = () => {
    if (S.coins < scoutingCost) return toast('На разведку не хватает монет.', 'bad');
    E.addCoins(S, -scoutingCost, 'разведка зала');
    lot.scouted = true;
    buzz(12); sound.blip(700, .06);
    render(); // обновляем HUD
    closeModal();
    openBidSheet(lot);
    toast('Разведка: предел зала известен.', 'brass');
  };

  MODAL.querySelector('[data-bidgo]').onclick = () => {
    const r = E.placeBid(S, lot.id, ui.bidValue);
    if (!r.ok) { sound.no(); buzz(20); return toast(esc(r.why), 'bad'); }
    closeModal();
    if (r.won) { sound.coin(); buzz(24); toast(`Взял за ${money(r.price)} М · каталог ${money(lot.value)} М`, 'good', 3200); }
    else { sound.no(); buzz(16); toast(`Не взял: ${esc(r.note)}`, 'bad', 3200); }
    render();
  };
}

/**
 * Сколько реально спишется при победе на открытом/слепом аукционе:
 * вторая ставка + 1 (не твоя). Не показывает предел зала до разведки —
 * но итоговая сумма честная, это правило аукциона, а не прогноз.
 */
function secondFor(lot, bid) {
  const limits = E.bidBots(S, lot);
  const under = limits.filter((l) => l.max < bid);
  if (!under.length) return Math.round(bid * 0.92);
  const second = under[0].max;
  return Math.min(bid, Math.max(second + 1, Math.round(bid * 0.86)));
}

function openRumorSheet() {
  if (S.rumor) return toast('Слух уже гуляет по ярмарке.', 'bad');
  const cost = E.rumorCost(S);
  openModal(`
    <div class="eyebrow">Язык рынка · ${money(cost)} М</div>
    <div class="modal__title">Пустить слух</div>
    <div class="small dim">Слух живёт день и сдвигает оценки ботов на 22%. Раздутый спрос поднимает цену, холод — роняет. За холод могут поймать.</div>
    <div class="list" style="margin-top:14px">
      ${CLS.map((c) => `<button class="list__row" data-rumor="${c}" data-dir="1">
        <span style="width:10px;height:10px;border-radius:50%;background:${CLASSES[c].color}"></span>
        <span class="grow">${CLASSES[c].name.toLowerCase()}</span>
        <span class="chip chip--green">ажиотаж</span>
      </button>`).join('')}
    </div>
    <div class="list" style="margin-top:8px">
      ${CLS.map((c) => `<button class="list__row" data-rumor="${c}" data-dir="-1">
        <span style="width:10px;height:10px;border-radius:50%;background:${CLASSES[c].color}"></span>
        <span class="grow">${CLASSES[c].name.toLowerCase()}</span>
        <span class="chip chip--red">холод · риск</span>
      </button>`).join('')}
    </div>
    <div class="row" style="margin-top:14px"><button class="btn btn--ghost btn--block" data-act="bidCancel">закрыть</button></div>
  `);
  MODAL.querySelectorAll('[data-rumor]').forEach((b) => {
    b.addEventListener('click', () => {
      const dir = Number(b.dataset.dir);
      const r = E.plantRumor(S, b.dataset.rumor, dir);
      if (!r.ok) return toast(esc(r.why), 'bad');
      closeModal();
      if (r.exposed) { sound.lose(); buzz(30); toast('Тебя раскрыли. Репутация просела.', 'bad', 3200); }
      else { sound.blip(760, 0.08); buzz(12); toast(`Слух пошёл: ${CLASSES[b.dataset.rumor].name.toLowerCase()} ${dir > 0 ? 'в цене' : 'остыл'}.`, 'brass'); }
      render();
    });
  });
  MODAL.querySelector('[data-act=bidCancel]').onclick = closeModal;
}

function openCraftSheet() {
  const cost = E.craftCost(S);
  const groups = [];
  for (const c of CLS) {
    for (const rar of ['common', 'fine', 'rare']) {
      const n = S.stash.filter((r) => r.class === c && r.rarity === rar).length;
      if (n >= 2) groups.push({ c, rar, n });
    }
  }
  openModal(`
    <div class="eyebrow">Мастерская · ${money(cost)} М</div>
    <div class="modal__title">Спайка</div>
    <div class="small dim">Две вещи одного класса и редкости — в одну выше рангом. Успех 72%. Провал — обе в осколках.</div>
    ${groups.length ? `<div class="list" style="margin-top:14px">
      ${groups.map((g) => `<button class="list__row" data-craft="${g.c}" data-rar="${g.rar}">
        <span style="width:10px;height:10px;border-radius:50%;background:${CLASSES[g.c].color}"></span>
        <span class="grow">${CLASSES[g.c].name.toLowerCase()} · ${rarName[g.rar]}</span>
        <span class="chip">${g.n} шт</span>
        <span class="chip chip--brass">→ ${rarName[E.RARITY_ORDER[E.RARITY_ORDER.indexOf(g.rar) + 1]]}</span>
      </button>`).join('')}
    </div>` : `<div class="panel pad" style="margin-top:14px"><div class="small dim">Нет двух подходящих вещей. Загляни на торг.</div></div>`}
    <div class="row" style="margin-top:14px"><button class="btn btn--ghost btn--block" data-act="bidCancel">закрыть</button></div>
  `);
  MODAL.querySelectorAll('[data-craft]').forEach((b) => {
    b.addEventListener('click', () => {
      const r = E.craft(S, b.dataset.craft, b.dataset.rar);
      if (!r.ok) return toast(esc(r.why), 'bad');
      closeModal();
      if (r.broke) { sound.lose(); buzz(40); toast('Спайка треснула. Обе вещи — в осколках.', 'bad', 3200); }
      else { sound.win(); buzz(24); toast(`Готово: ${esc(r.made.name)} (${rarName[r.made.rarity]})`, 'good', 3200); }
      render();
    });
  });
  MODAL.querySelector('[data-act=bidCancel]').onclick = closeModal;
}

function openNightSheet() {
  if (S.dayStats.lotsWon === 0 && S.dayStats.duels === 0 && S.actions === S.maxActions) {
    toast('Ты не торговался весь день. Репутация заметит.', 'bad', 3000);
  }
  const ev = E.pickNightEvent(S);
  const pledges = S.pledges.map((p) => `${esc(p.relic.name)} до д${p.dueDay}`).join(', ');
  openModal(`
    <div class="eyebrow">Ночь · день ${S.day}</div>
    <div class="modal__title">${ev ? esc(ev.title) : 'Тихая ночь'}</div>
    ${ev ? `<div class="small dim">${esc(ev.text)}</div>` : '<div class="small dim">Никто не стучит. Считай монеты.</div>'}
    ${!ev ? '' : `<div class="list" style="margin-top:14px">
      ${ev.options.map((o) => `<button class="list__row" data-night="${o.key}"><span class="grow" style="text-align:left">${esc(o.label)}</span><span class="faint">›</span></button>`).join('')}
    </div>`}
    ${pledges ? `<div class="tiny num-brass" style="margin-top:12px">Ломбард: ${pledges}</div>` : ''}
    <div class="panel pad" style="margin-top:14px;background:rgba(236,229,215,.03)">
      <div class="kv"><span class="dim">касса</span><b>${money(S.coins)} М</b></div>
      <div class="kv"><span class="dim">репутация</span><b>${Math.round(S.rep)}</b></div>
      <div class="kv"><span class="dim">инфляция</span><b>${S.inflation.toFixed(1)}</b></div>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn ${ev ? 'btn--ghost' : ''} grow" data-act="endNight">${ev ? 'ничего не делать · спать' : 'спать'}</button>
    </div>
  `);
  MODAL.querySelectorAll('[data-night]').forEach((b) => {
    b.addEventListener('click', () => {
      const r = E.applyNightChoice(S, ev.id, b.dataset.night);
      if (!r.ok) return toast(esc(r.why), 'bad');
      buzz(12);
      toast(esc(r.text), 'brass', 3400);
      closeModal();
      finishDay();
    });
  });
  MODAL.querySelector('[data-act=endNight]').onclick = () => { closeModal(); finishDay(); };
}

function finishDay() {
  if (S.day >= E.DAYS) {
    startFinale();
    return;
  }
  const r = E.endDay(S);
  tab = 'market';
  render();
  toast(`День ${S.day}. Инфляция ${S.inflation.toFixed(1)}.`, 'brass');
}

function startFinale() {
  E.startFinal(S);
  renderFinale();
}

function renderFinale() {
  const f = S.final;
  const my = E.tablePower(S) + (f.bought?.power || 0);
  const lot = f.lot;
  const left = 2 - f.round;
  const done = f.round >= 2;
  const bought = [
    f.bought.power ? `+${f.bought.power} силы` : '',
    f.bought.rep ? `+${f.bought.rep} репутации` : '',
    f.bought.coins ? `+${money(f.bought.coins)} М в кассу` : '',
  ].filter(Boolean);

  openModal(`
    <div class="eyebrow">Финал · Большой молоток</div>
    <div class="modal__title">${done ? 'Молоток занесён' : 'Последний торг'}</div>
    <div class="small dim">Собрание ярмарки уже собрало свою силу. У тебя ${left} ${left === 1 ? 'ставка' : 'ставки'} — вложи их туда, где больше толку.</div>

    <div class="panel pad" style="margin-top:14px">
      <div class="row row--between">
        <div><div class="tiny faint">твой стол</div><div class="duelbar__v me">${money(my)}</div></div>
        <div class="faint" style="font-family:var(--f-serif)">против</div>
        <div style="text-align:right"><div class="tiny faint">собрание</div><div class="duelbar__v them">${money(f.champion)}</div></div>
      </div>
      <div class="tiny ${my >= f.champion ? 'num-good' : 'num-red'}" style="margin-top:8px">
        ${my >= f.champion ? 'сила уже выше — можно не тратиться' : `не хватает ${money(f.champion - my)} силы`}
      </div>
    </div>

    ${!done && lot ? `<div class="final-lot">
      <div class="tiny faint">лот ${f.round + 1} из 2</div>
      <div class="final-lot__title">${esc(lot.title)}</div>
      <div class="final-lot__desc">${esc(lot.desc)}</div>
      <div class="row row--between" style="margin-top:10px;align-items:center">
        <div class="deal__price">${money(lot.price)}<span>М</span></div>
        <button class="btn btn--sm" data-act="finalBuy" ${S.coins < lot.price ? 'disabled' : ''}>
          ${S.coins < lot.price ? 'не хватает' : 'взять'}
        </button>
      </div>
      ${S.coins < lot.price ? '<div class="tiny faint" style="margin-top:6px">Цена выше кассы — пропусти лот, деньги пригодятся в счёте.</div>' : ''}
    </div>` : ''}

    ${bought.length ? `<div class="tiny num-brass" style="margin-top:10px">куплено: ${bought.join(' · ')}</div>` : ''}

    <div class="row" style="margin-top:14px;gap:8px">
      ${!done
        ? `<button class="btn btn--ghost grow" data-act="finalSkip">пропустить лот</button>
           <button class="btn grow" data-act="finalGo">взмахнуть</button>`
        : `<button class="btn btn--block" data-act="finalGo">взмахнуть</button>`}
    </div>
    <div class="tiny faint" style="margin-top:8px;text-align:center">Проигрыш — не конец: касса и молоток идут в итоговый счёт.</div>
  `, { after: () => {
    MODAL.querySelectorAll('[data-act=finalBuy]').forEach((b) => { b.onclick = () => {
      const r = E.buyFinalLot(S, 0);
      if (!r.ok) return toast(esc(r.why), 'bad');
      sound.coin(); buzz(12); save(); renderFinale();
    }; });
    const skip = MODAL.querySelector('[data-act=finalSkip]');
    if (skip) skip.onclick = () => {
      if (S.final.round >= 1) { toast('Все ставки уже сделаны.', 'bad'); return; }
      S.final.round += 1;
      S.final.lot = E.makeFinalLot(S, S.rng, S.final.round);
      S.final.stage = S.final.round >= 2 ? 'ready' : 'bidding';
      save(); renderFinale();
    };
    MODAL.querySelector('[data-act=finalGo]').onclick = () => { E.resolveFinal(S); closeModal(); showResult(); };
  } });
  renderHUD();
}

function showResult() {
  const r = S.result;
  setMeta({ best: Math.max(meta().best || 0, r.score), lastRank: r.rank });
  openModal(`
    <div class="eyebrow">Итог партии</div>
    <div class="modal__title">${esc(r.rank)}</div>
    <div class="panel pad" style="margin-top:14px">
      <div class="kv"><span class="dim">касса</span><b>${money(r.coins)} М</b></div>
      <div class="kv"><span class="dim">репутация</span><b>${Math.round(r.rep)}</b></div>
      <div class="kv"><span class="dim">очки</span><b>${money(r.score)}</b></div>
      <div class="kv"><span class="dim">финал</span><b>${r.win ? 'победа' : 'поражение'}</b></div>
    </div>
    <div class="row" style="margin-top:14px;gap:8px">
      <button class="btn grow" data-act="newGame">новая партия</button>
    </div>
    <button class="btn btn--quiet btn--block" style="margin-top:8px" data-act="closeModalBtn">посмотреть стол</button>
  `, { after: () => {
    MODAL.querySelector('[data-act=newGame]').onclick = () => { newRun(); closeModal(); };
    MODAL.querySelector('[data-act=closeModalBtn]').onclick = () => { closeModal(); tab = 'table'; render(); };
  } });
}

function openRules() {
  //Числа берём из движка, чтобы «Свод» не врал после балансных правок.
  const START = E.newGame('rules-probe').coins;
  const rows = [
    ['Цель', 'К шестому дню собрать стол сильнее «собрания ярмарки» и удержать кассу.'],
    ['Деньги', `Одна валюта — монеты М. Начало ${START} М.`],
    ['Действия', '3 действия в день. Первый лот — бесплатно, второй стоит 1, дальше — 2. Пас бесплатен.'],
    ['Аукционы', 'Голландский (цена падает), Слепой (конверты), Лестница (3 ступени), Спорный (открытый торг).'],
    ['Боты', 'Зал имеет предел и характер. Ставка «старт + 1» выигрывает редко — торгуйся вслепую или плати за разведку.'],
    ['Прилавок', 'Продажа — 108% ценности, с брокером ещё +8%, плюс бонус за репутацию. Мгновенно.'],
    ['Заказы', 'Дом берёт свой класс: платит 200–250% ценности плюс премию за день. Главная схема.'],
    ['Немая квота', 'Дом тайно ищет вещь. Угадаешь — заплатит сверх заказа. Брокер знает, кто и что ищет.'],
    ['Ломбард', 'Залог 70% ценности, выкуп +9%, два дня. Не выкупил — потерял вещь и репутацию.'],
    ['Сделка дня', 'Одна на утро: конверт, связка, редкость или займ. Иногда это приманка.'],
    ['Слухи', 'Сдвигают оценки ботов. Дешёвый класс можно купить тихо.'],
    ['Тройки', 'Три вещи одного класса — +18% к силе стола за каждую тройку. Все классы разные — ещё +12%.'],
    ['Характер', 'Редкие вещи несут свойство: хрупкая, линза, точность, без имени. Работает в дуэли.'],
    ['Дуэли', 'До 3 за вечер. Один приём за бой. Ставка — доля кассы; проигрыш списывает ставку.'],
    ['Репутация', '0–100. Влияет на силу стола и цену прилавка. Падает от поражений и долгов.'],
    ['Финал', 'Сила соперника растёт от твоей репутации, кассы и дня. Конвертируй всё в силу и деньги.'],
  ];
  openModal(`
    <div class="eyebrow">Свод правил</div>
    <div class="modal__title">Всё, что нужно</div>
    <div style="margin-top:12px;display:grid;gap:0">
      ${rows.map(([k, v], i) => `<div style="padding:9px 0;border-top:${i ? '1px solid var(--line-soft)' : 'none'}">
        <div style="font-family:var(--f-display);font-size:11px;letter-spacing:.14em;color:var(--brass)">${esc(k.toUpperCase())}</div>
        <div class="small dim" style="margin-top:2px">${esc(v)}</div>
      </div>`).join('')}
    </div>
    <button class="btn btn--block" style="margin-top:14px" data-act="closeModalBtn">понятно</button>
  `, { after: () => { MODAL.querySelector('[data-act=closeModalBtn]').onclick = () => { closeModal(); markTutorialDone(); }; } });
}

function openExport() {
  const code = btoa(unescape(encodeURIComponent(JSON.stringify({ seed: S.seed, day: S.day }))));
  openModal(`
    <div class="eyebrow">Партия</div>
    <div class="modal__title">Код ярмарки</div>
    <div class="small dim">Партия детерминирована. Код хранит зерно — с ним ярмарка повторится.</div>
    <div class="panel pad" style="margin-top:12px;word-break:break-all;font-family:var(--f-num);font-size:11px">${esc(code)}</div>
    <div class="row" style="margin-top:12px;gap:8px">
      <button class="btn btn--ghost btn--sm grow" data-act="copyCode">скопировать</button>
      <button class="btn btn--sm grow" data-act="closeModalBtn">закрыть</button>
    </div>
  `, { after: () => {
    MODAL.querySelector('[data-act=copyCode]').onclick = async () => {
      try { await navigator.clipboard.writeText(code); toast('Скопировано.', 'good'); } catch { toast('Не вышло. Выдели вручную.', 'bad'); }
    };
    MODAL.querySelector('[data-act=closeModalBtn]').onclick = () => closeModal();
  } });
}

function markTutorialDone() { S.tutorial = false; save(); }

// ---------------------------------------------------------------- запуск
function newRun(seed = 'f' + Date.now().toString(36)) {
  S = E.newGame(seed);
  lastCoins = S.coins;
  tab = 'market';
  clearSave();
  render();
  save();
}

function splash() {
  const sp = h(`<div class="splash">
    <div class="splash__in">
      <div style="color:var(--brass)">${crest(92)}</div>
      <div class="tag">торговая игра</div>
      <h1>Ярмарка<br/>Отблесков</h1>
      <div class="small dim" style="max-width:300px">Шесть дней. Аукционы, слухи, ломбард и дуэли заказов. Одна валюта, много схем.</div>
      <button class="btn btn--block" data-act="begin" style="margin-top:10px">войти в зал</button>
      <button class="btn btn--quiet btn--block" data-act="rules">свод правил</button>
      <div class="tiny faint">лучший счёт: ${money(meta().best || 0)}</div>
    </div>
  </div>`);
  document.body.appendChild(sp);
  sp.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'begin') { sp.remove(); newRun(); setTimeout(() => { if (!meta().seenRules) openRules(); }, 350); setMeta({ seenRules: true }); }
    if (el.dataset.act === 'rules') openRules();
  });
}

function boot() {
  onAction(document, actions);
  onAction(MODAL, { bidCancel: closeModal, closeModalBtn: closeModal });
  const saved = load();
  if (saved && saved.day) {
    S = saved;
    // Rng не сериализуется — восстановим детерминированный поток
    S.rng = new RngShim(S.seed, saved.day);
    lastCoins = S.coins;
    render();
    // Если партия уже дошла до финала — возвращаем игрока на последний торг,
    // иначе он «теряет» купленные ставки и видит старое утро.
    if (S.phase === 'final' && S.final && S.final.stage !== 'done') {
      setTimeout(() => { if (!document.querySelector('.modal-layer.on')) renderFinale(); }, 260);
    }
  } else {
    splash();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
}

/**
 * Восстановленный RNG: сериализуем счётчик вызовов, чтобы партия продолжалась
 * без сюрпризов и без «сохранение сломало баланс».
 */
class RngShim {
  constructor(seed, day) {
    this.seed = seed;
    this.day = day;
    this.inner = new Rng(seed + '::restore::' + day);
  }
  next() { return this.inner.next(); }
  int(a, b) { return this.inner.int(a, b); }
  float(a, b) { return this.inner.float(a, b); }
  pick(a) { return this.inner.pick(a); }
  chance(p) { return this.inner.chance(p); }
  weighted(p) { return this.inner.weighted(p); }
  shuffle(a) { return this.inner.shuffle(a); }
}

boot();

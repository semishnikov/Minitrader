// Детерминированный ГПСЧ — чтобы партия воспроизводилась по seed.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.seed = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    this._f = mulberry32(this.seed);
    this.calls = 0;
  }
  next() {
    this.calls++;
    return this._f();
  }
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  float(min, max) {
    return this.next() * (max - min) + min;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  weighted(pairs) {
    // pairs: [[value, weight], ...]
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = this.next() * total;
    for (const [v, w] of pairs) {
      r -= w;
      if (r <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function money(n) {
  const v = Math.round(n);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
  return (v < 0 ? '−' : '') + s;
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

// Мини-DOM-хелпер. Без фреймворка: строка → элемент, делегирование событий.
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

/** Делегирование кликов по [data-act]. */
export function onAction(root, map) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const act = el.dataset.act;
    const fn = map[act];
    if (!fn) return;
    if (el.hasAttribute('data-stop')) e.stopPropagation();
    fn(el, e);
  });
}

/** Число с «узкими» пробелами: 12 345 */
export function money(n) {
  const v = Math.round(n);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
  return (v < 0 ? '−' : '') + s;
}

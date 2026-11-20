import { flagUrl } from '../characters/flags.js';
import { RARITY } from '../data/rarity.js';
import { bus } from '../core/events.js';
import { sfx } from '../core/audio.js';

/** Minimal hyperscript helper: h('div.card', {onclick}, 'text', child) */
export function h(sel, attrs, ...kids) {
  const [tag, ...cls] = sel.split('.'); const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
export const ui = () => document.getElementById('ui');
export const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n).toLocaleString();

export function ballAvatar(flag, size = 64, ghost = false) {
  return h('div.ball' + (ghost ? '.ghost' : ''), { style: { '--flag': `url(${flagUrl(flag)})`, '--s': size + 'px' } });
}
export const rarityBadge = r => h('span.badge', { style: { background: RARITY[r].color } }, RARITY[r].label);

export function toast(text, kind = '') {
  let box = document.querySelector('.toasts') ?? ui().appendChild(h('div.toasts'));
  const t = h('div.toast.' + (kind || 'x'), text); box.append(t); setTimeout(() => t.remove(), 3100);
}
bus.on('toast', ({ text, kind }) => toast(text, kind));

/** Bottom-sheet / centred modal. Returns { close, body, el }. */
export function modal(title, body, { onClose } = {}) {
  const body_ = h('div.body', body);
  const close = () => { wrap.remove(); onClose?.(); };
  const wrap = h('div.modal-wrap', { onclick: e => { if (e.target === wrap) { sfx.click(); close(); } } },
    h('div.modal', h('header', h('span.grow', title), h('button.btn.sm', { onclick: () => { sfx.click(); close(); } }, '✕')), body_));
  ui().append(wrap); return { close, body: body_, el: wrap };
}
export const confirmBox = (title, msg, onYes) => {
  const m = modal(title, [h('p', msg), h('div.row', h('button.btn.red.grow', { onclick: () => { m.close(); onYes(); } }, 'Yes'), h('button.btn.grow', { onclick: () => m.close() }, 'Cancel'))]);
};

/** Fullscreen colour wipe between scenes. */
export function wipe(fn) {
  const f = ui().appendChild(h('div.fade-screen'));
  requestAnimationFrame(() => f.classList.add('on'));
  return new Promise(res => setTimeout(async () => { await fn(); f.classList.remove('on'); setTimeout(() => f.remove(), 500); res(); }, 480));
}

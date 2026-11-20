/**
 * Flag provider. Real flags are SVG files from /public/flags (ISO codes); historical and
 * fantasy flags are drawn procedurally on a canvas. Everything resolves to a canvas or a URL.
 */
const SVG_ALIAS = { british: 'gb', mali_empire: 'ml' };
const cache = new Map();   // key -> HTMLCanvasElement (512x340)
const urls = new Map();    // key -> url for CSS backgrounds
const W = 512, H = 340;

const CUSTOM = {
  rome(g) {
    g.fillStyle = '#9b1b1f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f2c230'; g.font = 'bold 120px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('SPQR', W / 2, H / 2 + 8);
    g.fillRect(0, 22, W, 8); g.fillRect(0, H - 30, W, 8);
  },
  su(g) {
    g.fillStyle = '#cc0000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd700'; g.font = 'bold 150px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('☭', 130, 110);
    g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 14 : 34, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(130 + r * Math.cos(a), 235 + r * Math.sin(a)); } g.fill();
  },
  mongol(g) {
    g.fillStyle = '#1b4fa8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f5d44a'; g.beginPath(); g.arc(W / 2, H / 2, 70, 0, 7); g.fill();
    g.fillStyle = '#1b4fa8'; g.beginPath(); g.arc(W / 2 + 22, H / 2 - 6, 56, 0, 7); g.fill();
    g.fillStyle = '#f5d44a'; g.fillRect(W / 2 - 4, 40, 8, 60);
  },
  aztec(g) {
    g.fillStyle = '#16806b'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#f2c230'; g.lineWidth = 14;
    for (let i = 0; i < 4; i++) g.strokeRect(30 + i * 34, 20 + i * 24, W - 60 - i * 68, H - 40 - i * 48);
    g.fillStyle = '#c4301f'; g.beginPath(); g.arc(W / 2, H / 2, 26, 0, 7); g.fill();
  },
  galaxy(g) {
    const gr = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 300);
    gr.addColorStop(0, '#9b5cff'); gr.addColorStop(0.5, '#2b1a6e'); gr.addColorStop(1, '#05030f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
    for (let i = 0; i < 90; i++) { g.globalAlpha = Math.random(); g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    g.globalAlpha = 1;
  },
  rainbow(g) {
    ['#ff3b3b', '#ff9a2e', '#ffe14a', '#3ddc6b', '#3aa0ff', '#8a5cff'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * H / 6, W, H / 6 + 1); });
  },
  gold(g) {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#fff3a8'); gr.addColorStop(0.5, '#e8b923'); gr.addColorStop(1, '#a8740a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  },
  void(g) {
    g.fillStyle = '#05010a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#7a2cff'; g.lineWidth = 6;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.arc(W / 2, H / 2, i * 38, 0, 7); g.stroke(); }
  },
  pirate(g) {
    g.fillStyle = '#111'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = 'bold 190px serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☠', W / 2, H / 2 + 10);
  },
  atlantis(g) {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2fe0d0'); gr.addColorStop(1, '#0b3d91');
    g.fillStyle = gr; g.fillRect(0, 0, W, H); g.strokeStyle = '#e8fffb'; g.lineWidth = 10;
    for (let i = 0; i < 3; i++) { g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, 90 + i * 70 + Math.sin(x / 40) * 18); g.stroke(); }
  }
};
export const isCustomFlag = key => key in CUSTOM;

function fromCanvas(key) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); CUSTOM[key](g); cache.set(key, c); return c;
}

/** URL for CSS/<img> usage; never fails synchronously. */
export function flagUrl(key) {
  if (key in CUSTOM) {
    if (!urls.has(key)) urls.set(key, fromCanvas(key).toDataURL('image/png'));
    return urls.get(key);
  }
  return `/flags/${(SVG_ALIAS[key] ?? key).toLowerCase()}.svg`;
}

const imgCache = new Map();
/** Resolves a drawable (canvas or loaded Image) for the flag. */
export function loadFlag(key) {
  if (key in CUSTOM) return Promise.resolve(fromCanvas(key));
  if (!imgCache.has(key)) {
    imgCache.set(key, new Promise(res => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => res(im); im.onerror = () => res(fromCanvas('gold'));
      im.src = flagUrl(key);
    }));
  }
  return imgCache.get(key);
}

export const flagEmoji = code => /^[a-z]{2}$/i.test(code)
  ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🏳️';

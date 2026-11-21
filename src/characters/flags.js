/**
 * Flag provider. Real flags are SVG files from /public/flags (ISO codes); historical and
 * fantasy flags are drawn procedurally on a canvas. Everything resolves to a canvas or a URL.
 */
const SVG_ALIAS = { british: 'gb', mali_empire: 'ml' };
const cache = new Map();   // key -> HTMLCanvasElement (512x340)
const urls = new Map();    // key -> url for CSS backgrounds
const W = 512, H = 340;

const CUSTOM = {

  cl(g) {
    // Chile: white upper half, red lower half, blue canton in the upper-left,
    // with a centered white five-point star. The entire canton remains visible.
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H / 2);
    g.fillStyle = '#d52b1e'; g.fillRect(0, H / 2, W, H / 2);
    g.fillStyle = '#0039a6'; g.fillRect(0, 0, W / 3, H / 2);
    g.fillStyle = '#ffffff'; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 17 : 40;
      const x = W / 6 + Math.cos(a) * r, y = H / 4 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fill();
  },
  byzantine(g) { g.fillStyle='#b51f2a'; g.fillRect(0,0,W,H); g.fillStyle='#f5d36b'; g.font='bold 190px serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('☧',W/2,H/2); },
  ottoman(g) { g.fillStyle='#e32636'; g.fillRect(0,0,W,H); g.fillStyle='#fff'; g.beginPath(); g.arc(230,170,90,0,7); g.fill(); g.fillStyle='#e32636'; g.beginPath(); g.arc(265,145,72,0,7); g.fill(); g.fillStyle='#fff'; g.font='bold 90px serif'; g.fillText('★',350,200); },
  persian(g) { ['#239f40','#fff','#da0000'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/3,W,H/3)}); g.fillStyle='#da0000';g.font='bold 100px serif';g.textAlign='center';g.fillText('☼',W/2,H/2+30); },
  macedonian(g) { g.fillStyle='#d71920';g.fillRect(0,0,W,H);g.strokeStyle='#f6c945';g.lineWidth=18;for(let i=0;i<8;i++){g.beginPath();g.moveTo(W/2,H/2);g.lineTo(W/2+260*Math.cos(i*Math.PI/4),H/2+260*Math.sin(i*Math.PI/4));g.stroke()}g.beginPath();g.arc(W/2,H/2,75,0,7);g.fillStyle='#f6c945';g.fill(); },
  carthage(g) { g.fillStyle='#7b1520';g.fillRect(0,0,W,H);g.fillStyle='#e8c66a';g.font='bold 170px serif';g.textAlign='center';g.textBaseline='middle';g.fillText('𐤀',W/2,H/2); },
  spanish_empire(g) { g.fillStyle='#aa151b';g.fillRect(0,0,W,H);g.fillStyle='#f1bf00';g.fillRect(0,H/4,W,H/2);g.fillStyle='#aa151b';g.font='bold 70px serif';g.textAlign='center';g.fillText('♜',W/2,H/2+22); },
  portuguese_empire(g) { g.fillStyle='#006600';g.fillRect(0,0,W,H);g.fillStyle='#ff0000';g.fillRect(W*.38,0,W*.62,H);g.fillStyle='#f7d116';g.beginPath();g.arc(W*.4,H/2,70,0,7);g.fill(); },
  french_empire(g) { ['#002395','#fff','#ed2939'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(i*W/3,0,W/3,H)}); },
  german_empire(g) { ['#111','#d00','#ffce00'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/3,W,H/3)}); },
  austro_hungarian(g) { ['#ed2939','#fff','#ed2939'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/3,W,H/3)});g.fillStyle='#d6ad43';g.font='bold 100px serif';g.textAlign='center';g.fillText('⚜',W/2,H/2+30); },
  japanese_empire(g) { g.fillStyle='#fff';g.fillRect(0,0,W,H);g.fillStyle='#bc002d';g.beginPath();g.arc(W/2,H/2,105,0,7);g.fill();g.fillStyle='#fff';g.font='bold 55px serif';g.textAlign='center';g.fillText('旭',W/2,H/2+18); },
  qing(g) { g.fillStyle='#f4d03f';g.fillRect(0,0,W,H);g.fillStyle='#de2910';g.font='bold 180px serif';g.textAlign='center';g.textBaseline='middle';g.fillText('龍',W/2,H/2); },
  russian_empire(g) { ['#fff','#2455a4','#d52b1e'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/3,W,H/3)}); },
  soviet_empire(g) { g.fillStyle='#cc0000';g.fillRect(0,0,W,H);g.fillStyle='#ffd700';g.font='bold 120px serif';g.textAlign='center';g.fillText('☭',W/2,H/2+30); },
  inca(g) { ['#f7d117','#d52b1e','#f7d117'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/3,W,H/3)});g.fillStyle='#7b3f00';g.font='bold 120px serif';g.textAlign='center';g.fillText('☀',W/2,H/2+35); },
  maya(g) { g.fillStyle='#087f5b';g.fillRect(0,0,W,H);g.fillStyle='#f4d03f';g.font='bold 180px serif';g.textAlign='center';g.textBaseline='middle';g.fillText('꩜',W/2,H/2); },
  brazil_empire(g) { g.fillStyle='#fff';g.fillRect(0,0,W,H);g.fillStyle='#009b3a';g.beginPath();g.moveTo(W/2,35);g.lineTo(W-35,H/2);g.lineTo(W/2,H-35);g.lineTo(35,H/2);g.closePath();g.fill();g.fillStyle='#ffdf00';g.beginPath();g.arc(W/2,H/2,75,0,7);g.fill(); },
  khmer(g) { g.fillStyle='#032ea1';g.fillRect(0,0,W,H);g.fillStyle='#e00025';g.fillRect(0,H/4,W,H/2);g.fillStyle='#fff';g.font='bold 90px serif';g.textAlign='center';g.fillText('♜',W/2,H/2+25); },
  songhai(g) { ['#168a45','#f5d547','#d52b1e'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/3,W,H/3)}); },
  ghana_empire(g) { ['#d71920','#fcd116','#168a45'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/3,W,H/3)});g.fillStyle='#111';g.font='bold 100px serif';g.textAlign='center';g.fillText('★',W/2,H/2+30); },
  ethiopian_empire(g) { ['#078930','#fcd116','#da121a'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/3,W,H/3)});g.fillStyle='#fcd116';g.font='bold 95px serif';g.textAlign='center';g.fillText('✦',W/2,H/2+25); },
  mughal(g) { g.fillStyle='#006a4e';g.fillRect(0,0,W,H);g.fillStyle='#f4d03f';g.font='bold 150px serif';g.textAlign='center';g.textBaseline='middle';g.fillText('☪',W/2,H/2); },
  delhi(g) { g.fillStyle='#1b5e20';g.fillRect(0,0,W,H);g.fillStyle='#f4d03f';g.font='bold 150px serif';g.textAlign='center';g.textBaseline='middle';g.fillText('☾',W/2,H/2); },
  vijayanagara(g) { ['#f7d117','#d52b1e','#f7d117'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/3,W,H/3)});g.fillStyle='#7b3f00';g.font='bold 120px serif';g.textAlign='center';g.fillText('⚔',W/2,H/2+35); },
  polish_lithuanian(g) { ['#fff','#d4213d'].forEach((c,i)=>{g.fillStyle=c;g.fillRect(0,i*H/2,W,H/2)});g.fillStyle='#f4d03f';g.font='bold 130px serif';g.textAlign='center';g.fillText('♞',W/2,H/2+45); }
,
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

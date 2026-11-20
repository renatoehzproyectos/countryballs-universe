import meta from '../../data/countryMeta.json';
import geo from '../../data/geo.json';
import { store } from '../../core/store.js';

/** Question generation for Guess the Flag: difficulty tiers, similar-flag groups, SRS for mistakes. */
export const CONTINENTS = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];
export const ALL = Object.entries(meta).filter(([, m]) => m.ind && m.r !== 'Antarctic').map(([code, m]) => ({ code, name: m.n, cont: m.r, area: m.a }));
const BY = Object.fromEntries(ALL.map(c => [c.code, c]));
export const onMap = new Set(geo.regions.map(r => r.id));

const POPULAR = new Set('us gb fr de it es pt br ar mx ca au jp cn in ru kr tr eg za ng nl be se no fi dk ch at pl gr ie ua cz hu ro sa il th vn id ph nz cl co pe cu ma ke'.split(' ').map(x => x.toUpperCase()));
/** 1 = well known, 2 = medium, 3 = obscure. */
export const difficulty = c => POPULAR.has(c.code) ? 1 : c.area > 400000 ? 2 : 3;
const SIMILAR = [['RO', 'TD', 'AD', 'MD'], ['ID', 'MC', 'PL', 'SG'], ['AU', 'NZ', 'FJ', 'TV'], ['IE', 'CI', 'IT', 'MX', 'HU'], ['NO', 'IS', 'DK', 'FI', 'SE'], ['SK', 'SI', 'RU', 'RS', 'HR', 'CZ'],
  ['LU', 'NL', 'PY', 'HR'], ['SD', 'EG', 'YE', 'SY', 'IQ', 'JO', 'PS'], ['GN', 'ML', 'SN', 'CM', 'GH', 'BO'], ['VE', 'CO', 'EC', 'AM'], ['NI', 'HN', 'SV', 'GT', 'AR', 'UY'], ['TN', 'TR', 'DZ', 'MA', 'PK'],
  ['SA', 'PK', 'AF', 'IR', 'BD'], ['BE', 'DE', 'LT', 'GA'], ['CL', 'CU', 'PR', 'TX', 'CZ'], ['LV', 'AT', 'PE', 'CA'], ['MR', 'NG', 'LY', 'BN'], ['BF', 'TG', 'BJ', 'GW', 'MZ'], ['LK', 'MV', 'KW', 'AE', 'OM']];
export const similarOf = code => SIMILAR.filter(g => g.includes(code)).flat().filter(c => c !== code && BY[c]);

const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** Build a 4-option question. `hard` pulls distractors from the same continent / lookalike flags. */
export function makeQuestion(pool, { level = 0, expert = false, rand = Math.random, wrongFirst = true, avoid = new Set() } = {}) {
  let target;
  const wrong = store.state.quiz.wrong.filter(c => BY[c] && pool.some(p => p.code === c) && !avoid.has(c));
  if (wrongFirst && wrong.length && rand() < 0.3) target = BY[wrong[Math.floor(rand() * wrong.length)]];
  else {
    const want = expert ? 3 : level < 4 ? 1 : level < 9 ? 2 : 3, fit = pool.filter(c => !avoid.has(c.code) && (expert ? difficulty(c) >= 2 || similarOf(c.code).length : difficulty(c) <= want));
    const list = fit.length ? fit : pool.filter(c => !avoid.has(c.code)); target = list.length ? list[Math.floor(rand() * list.length)] : pool[Math.floor(rand() * pool.length)];
  }
  const sim = (expert || level > 5) ? similarOf(target.code).map(c => BY[c]) : [];
  const same = ALL.filter(c => c.cont === target.cont && c.code !== target.code);
  const picks = new Set(); const take = src => { for (const c of shuffle([...src])) { if (picks.size >= 3) break; if (c.code !== target.code) picks.add(c); } };
  take(sim.slice(0, 2)); if (level > 3 || expert) take(same); take(ALL);
  const options = shuffle([target, ...picks]); return { target, options };
}
export const poolFor = cont => ALL.filter(c => !cont || c.cont === cont);
export const mapPool = () => ALL.filter(c => onMap.has(c.code));

// ------------- mastery (drives empire unlocks) -------------
const THRESH = 0.8;
export const masteryOf = cont => { const pool = poolFor(cont), m = store.state.quiz.mastered[cont] ?? []; return { have: m.length, total: pool.length, need: Math.ceil(pool.length * THRESH), done: m.length >= Math.ceil(pool.length * THRESH) }; };
export function contDone() { return Object.fromEntries(CONTINENTS.map(c => [c, masteryOf(c).done])); }
export function empiresEarned() {
  const d = contDone(), out = [];
  if (d.Europe) out.push('rome'); if (d.Asia) out.push('mongol'); if (d['North America'] && d['South America']) out.push('aztec');
  if (d.Africa) out.push('mali_empire'); if (CONTINENTS.every(c => d[c])) out.push('british'); return out;
}

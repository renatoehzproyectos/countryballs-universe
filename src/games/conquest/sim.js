import geo from '../../data/geo.json';
import meta from '../../data/countryMeta.json';
import { EMPIRES } from '../../data/empires.js';
import { LANDLOCKED, STRUCTS, structCost, TECHS, WEAPONS, SPACE, SUPERPOWERS, PACTS } from '../../data/conquestData.js';
const parse = s => Object.fromEntries(s.split(' ').map(x => x.split(':')).map(([k, v]) => [k, +v]));
const POP = parse('US:335 CN:1412 IN:1417 ID:275 PK:231 BR:215 NG:218 BD:171 RU:144 MX:128 JP:125 ET:123 PH:115 EG:109 CD:99 VN:98 IR:88 TR:85 DE:83 TH:72 GB:67 FR:68 TZ:65 ZA:60 IT:59 KE:54 MM:54 KR:52 CO:52 ES:47 UG:47 AR:46 DZ:45 SD:46 UA:41 IQ:44 AF:41 PL:38 CA:39 MA:37 SA:36 UZ:35 PE:34 MY:33 AO:35 GH:33 MZ:33 YE:33 NP:30 VE:28 MG:29 CM:27 CI:28 NE:26 AU:26 KP:26 LK:22 BF:22 ML:22 RO:19 CL:19 KZ:19 ZM:19 GT:17 EC:18 NL:17.5 SY:21 SN:17 KH:17 TD:17 SO:17 ZW:16 GN:13 RW:13 BJ:13 BI:13 TN:12 BE:11.6 CU:11 BO:12 HT:11 GR:10.4 CZ:10.5 PT:10.3 SE:10.4 JO:11 DO:11 AZ:10 HU:9.7 AT:9 BY:9.4 CH:8.7 IL:9.5 TG:8.8 SL:8 LA:7.5 PY:6.8 BG:6.8 LY:6.8 RS:6.8 LB:5.5 NI:6.8 SV:6.3 KG:6.7 TM:6.1 DK:5.9 FI:5.5 NO:5.4 SK:5.4 NZ:5.1 IE:5 CR:5.1 LR:5.3 OM:4.6 HR:3.9 GE:3.7 MR:4.7 PA:4.4 UY:3.4 MN:3.4 AM:3 LT:2.8 AL:2.8 QA:2.7 NA:2.6 BW:2.6 SI:2.1 LV:1.9 LS:2.3 EE:1.3 CY:1.3 GY:0.8 BT:0.8 LU:0.65 IS:0.37');
const GDP = parse('US:25000 CN:18000 JP:4200 DE:4100 IN:3400 GB:3100 FR:2800 IT:2000 CA:2100 KR:1700 RU:2000 BR:1900 AU:1700 MX:1400 ES:1400 ID:1300 SA:1100 NL:1000 TR:900 CH:800 PL:690 TH:500 SE:590 BE:580 AR:630 NO:580 AT:480 IL:520 IE:500 NG:470 EG:400 ZA:400 DK:400 PH:400 MY:400 BD:420 VN:410 CO:340 CL:300 FI:280 RO:300 CZ:290 PT:250 NZ:250 GR:220 PE:240 IQ:270 DZ:190 KZ:220 HU:180 UA:160 MA:130 QA:180 PK:350 IR:400 UZ:80 KE:110 ET:126 GH:73 AO:120 TZ:75');
const PC = { Europe: 25, Asia: 7, Africa: 2.2, 'North America': 9, 'South America': 7, Oceania: 18 };
const hash = str => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; };

/**
 * World Conquest — real-time simulation. Pure logic (no DOM), fully JSON-serialisable so the
 * campaign can be autosaved. Time is continuous: the UI calls tick(s) once per game day.
 * Design follows the "Take Over The World!" analysis: map ownership, expansion, economy,
 * war (land + naval), missiles/bombs, diplomacy (alliances, peace, puppets), historical
 * empires, a space race to the Moon, national superpowers and bots.
 */
export const REG = Object.fromEntries(geo.regions.map(r => [r.id, r]));
export const IDS = geo.regions.map(r => r.id);
export const NAME = id => meta[id]?.n ?? id;
export const dist = (a, b) => Math.hypot(REG[a].cx - REG[b].cx, REG[a].cy - REG[b].cy);
export const isCoastal = id => !LANDLOCKED.has(id);
const DEPENDENCIES = new Set(['EH', 'FK', 'GL', 'TF', 'PR', 'NC']);   // start as unclaimed land

// ---------------- adjacency: land borders and fixed sea links ----------------
export const LAND = Object.fromEntries(IDS.map(i => [i, new Set()]));
export const SEA_FIX = Object.fromEntries(IDS.map(i => [i, new Set()]));
for (const id of IDS) for (const b of meta[id]?.b ?? []) if (LAND[b] && b !== id) { LAND[id].add(b); LAND[b].add(id); }
[['GB', 'FR'], ['GB', 'IE'], ['JP', 'KR'], ['ID', 'MY'], ['AU', 'ID'], ['AU', 'PG'], ['NZ', 'AU'], ['IT', 'TN'], ['ES', 'MA'], ['CU', 'US'], ['CU', 'HT'], ['CY', 'TR'], ['CY', 'SY'], ['LK', 'IN'], ['PH', 'VN'], ['PH', 'MY'], ['JP', 'RU'], ['DK', 'SE'], ['IS', 'GB'], ['IS', 'NO'], ['DO', 'JM'], ['JM', 'CU'], ['SA', 'EG'], ['YE', 'SO'], ['MG', 'MZ'], ['GR', 'TR'], ['IT', 'GR'], ['IT', 'HR'], ['TW', 'CN'], ['TW', 'JP'], ['TW', 'PH'], ['FJ', 'AU'], ['PH', 'ID']]
  .forEach(([a, b]) => { if (SEA_FIX[a] && SEA_FIX[b]) { SEA_FIX[a].add(b); SEA_FIX[b].add(a); } });

// ---------------- hooks (UI sets them; the sim never touches the DOM) ----------------
const hooks = { event: null, sfx: null, ai: null };
export const onEvent = f => { hooks.event = f; };
export const onSfx = f => { hooks.sfx = f; };
export const setAI = f => { hooks.ai = f; };
const dirty = new Set(); let relDirty = false;
export const drainDirty = () => { const a = [...dirty]; dirty.clear(); return a; };
export const drainRel = () => { const r = relDirty; relDirty = false; return r; };
export const markAll = () => { IDS.forEach(i => dirty.add(i)); relDirty = true; };
export function log(s, text, tone = '', who = []) {
  s.log.unshift({ t: s.t, text, tone }); if (s.log.length > 70) s.log.length = 70; hooks.event?.({ text, tone, who });
}
const rnd = () => Math.random();

// ---------------- personalities ----------------
const PERS = [
  { id: 'aggressive', label: 'Guerrero', aggr: 1.0, coop: 0.3, trade: 0.3, peace: 0.1 },
  { id: 'opportunist', label: 'Astuto', aggr: 0.6, coop: 0.5, trade: 0.5, peace: 0.3 },
  { id: 'diplomatic', label: 'Amistoso', aggr: 0.15, coop: 1.0, trade: 0.7, peace: 0.8 },
  { id: 'merchant', label: 'Comerciante', aggr: 0.2, coop: 0.6, trade: 1.0, peace: 0.7 },
  { id: 'isolationist', label: 'Tranquilo', aggr: 0.1, coop: 0.1, trade: 0.2, peace: 1.0 }
];
export const persOf = n => PERS.find(p => p.id === n.pers);
const hue = id => Math.floor(hash('c' + id) * 360);
export const colorOf = n => n ? (n.color ?? `hsl(${hue(n.id)} 58% 46%)`) : '#7d8388';
export const NEUTRAL = '#7d8388';

// ---------------- creation ----------------
function makeRegion(id) {
  const m = meta[id], pop = POP[id] ?? Math.max(0.3, +(0.4 + hash('p' + id) * 14 * Math.min(2.5, (REG[id].area / 3000) + 0.4)).toFixed(1));
  const gdp = GDP[id] ?? Math.max(1, Math.round(pop * (PC[m?.r] ?? 6) * (0.4 + hash('g' + id) * 1.4)));
  return {
    owner: DEPENDENCIES.has(id) ? null : id, pop, gdp,
    city: Math.max(1, Math.min(8, 1 + Math.floor(Math.log2(pop / 3 + 1)))),
    fact: gdp > 150 ? Math.min(6, Math.floor(gdp / 700) + 1) : 0,
    infra: gdp > 1500 ? 2 : gdp > 200 ? 1 : 0,
    port: isCoastal(id) && gdp > 400 ? 1 : 0, base: gdp > 3000 ? 1 : 0, space: 0, dmg: 0
  };
}
const BASE = (a, b) => Math.round((hash(a < b ? a + b : b + a) - 0.5) * 30) - (LAND[a]?.has(b) ? 5 : 0);

export function newGame(startId) {
  const s = { v: 2, t: 0, acc: 0, player: startId, regions: {}, nations: {}, wars: [], pacts: [], orders: [], strikes: [], inbox: [], log: [], space: {}, over: null, nid: 1 };
  for (const id of IDS) s.regions[id] = makeRegion(id);
  for (const id of IDS) {
    const reg = s.regions[id]; if (!reg.owner) continue;
    s.nations[id] = {
      id, spId: id, name: meta[id].n, flag: id.toLowerCase(), cap: id, alive: true, regs: [id], bot: id !== startId,
      money: 0, ind: 20 + reg.fact * 10, troops: Math.max(2, Math.round(Math.min(reg.pop * 1.5, reg.gdp / 10))), ships: reg.port ? Math.max(1, Math.round(Math.sqrt(reg.gdp) / 15)) : 0,
      arms: { missile: 0, bomb: 0, nuke: 0 }, tech: {}, research: null, pers: PERS[Math.floor(hash('pe' + id) * PERS.length)].id,
      rel: {}, rep: 60, overlord: null, since: 0, truce: {}, sp: null, emp: null, color: null
    };
    s.nations[id].money = Math.round(60 + econ(s, s.nations[id]).inc * 20);
  }
  const emp = EMPIRES[startId];
  if (emp) {   // starting as an unlocked historical empire (earned in Guess the Flag)
    const regs = emp.regions.filter(r => s.regions[r]?.owner); const cap = regs.includes(emp.capital) ? emp.capital : regs[0];
    const n = { id: emp.id, spId: null, name: emp.name, flag: emp.flag, cap, alive: true, regs: [], bot: false, money: 0, ind: 0, troops: 0, ships: 0, arms: { missile: 0, bomb: 0, nuke: 0 }, tech: {}, research: null, pers: 'diplomatic', rel: {}, rep: 60, overlord: null, since: 0, truce: {}, sp: null, emp: emp.id, color: emp.color };
    for (const r of regs) { const old = s.nations[s.regions[r].owner]; old.regs = old.regs.filter(x => x !== r); s.regions[r].owner = emp.id; n.regs.push(r); n.troops += old.troops; n.ind += old.ind; n.money += Math.round(old.money * 0.6); n.ships += old.ships; if (!old.regs.length) old.alive = false; }
    s.nations[emp.id] = n; s.empFormed = { [emp.id]: emp.id };
    for (const h of emp.mods.hostile ?? []) if (s.nations[h]) { s.nations[h].rel[emp.id] = -40; n.rel[h] = -40; }
  }
  s.empFormed ??= {};
  markAll(); log(s, `¡Empieza la partida de ${s.nations[startId].name}!`, 'good', [startId]); return s;
}

// ---------------- queries ----------------
export const N = (s, id) => s.nations[id];
export const alive = s => Object.values(s.nations).filter(n => n.alive);
export const lvl = (n, p) => ['1', '2', '3'].filter(k => n.tech[p + k]).length;
export const hasTech = (n, t) => !!n.tech[t];
export const rel = (s, a, b) => Math.max(-100, Math.min(100, BASE(a, b) + (s.nations[a].rel[b] ?? 0)));
export function addRel(s, a, b, d) { for (const [x, y] of [[a, b], [b, a]]) { const n = s.nations[x]; if (n) n.rel[y] = Math.max(-140, Math.min(140, (n.rel[y] ?? 0) + d)); } relDirty = true; }
export function modsOf(n) {
  const m = { income: 1, troops: 1, ind: 1, ships: 1, def: 1, range: 0 };
  if (n.emp && EMPIRES[n.emp]) { const e = EMPIRES[n.emp].mods; m.income *= 1 + (e.income - 1) * 0.5; m.troops *= 1 + (e.troops - 1) * 0.5; m.ind *= 1 + (e.equipment - 1) * 0.3; }
  if (n.sp?.on) { const p = SUPERPOWERS[n.spId].passive; for (const [k, v] of Object.entries(p)) { if (k === 'range') m.range += v; else m[k] *= v; } if (n.sp.act > 0 && n.spId === 'CN') m.ind *= 2; }
  return m;
}
export const strength = n => n.troops * (1 + 0.15 * lvl(n, 'mil')) * modsOf(n).troops;
export const popOf = (s, n) => n.regs.reduce((a, r) => a + s.regions[r].pop, 0);
export const gdpOf = (s, n) => n.regs.reduce((a, r) => a + s.regions[r].gdp, 0);
export const count = (s, n, k) => n.regs.reduce((a, r) => a + s.regions[r][k], 0);
export const atWar = (s, a, b) => s.wars.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
export const warOf = (s, a, b) => s.wars.find(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
export const pactOf = (s, a, b, type) => s.pacts.find(p => ((p.a === a && p.b === b) || (p.a === b && p.b === a)) && p.type === type);
export const isAllied = (s, a, b) => !!pactOf(s, a, b, 'alliance');
export const alliesOf = (s, id) => s.pacts.filter(p => p.type === 'alliance' && (p.a === id || p.b === id)).map(p => p.a === id ? p.b : p.a);
export const enemiesOf = (s, id) => s.wars.filter(w => w.a === id || w.b === id).map(w => w.a === id ? w.b : w.a);
export const puppetsOf = (s, id) => alive(s).filter(v => v.overlord === id);
export const ownerNation = (s, rid) => { const o = s.regions[rid].owner; return o ? s.nations[o] : null; };
export const marching = (s, n) => s.orders.filter(o => o.o === n.id && o.kind !== 'expand').reduce((a, o) => a + o.n, 0);
export const troopCap = (s, n) => Math.round(n.regs.reduce((a, r) => a + s.regions[r].pop * 2.5 * (1 + 0.15 * s.regions[r].base), 0) * (1 + 0.05 * lvl(n, 'mil')));
export const navalRange = n => 110 + [0, 50, 130, 130][lvl(n, 'navy')] + modsOf(n).range;
/** Land + sea neighbours of a nation (nations that own a region that touches it). */
export function neighbours(s, id) {
  const out = new Set(); for (const r of s.nations[id].regs) for (const o of LAND[r]) { const ow = s.regions[o].owner; if (ow && ow !== id) out.add(ow); } return [...out];
}
export function landNeighbourRegions(s, id) { const out = new Set(); for (const r of s.nations[id].regs) for (const o of LAND[r]) if (s.regions[o].owner !== id) out.add(o); return [...out]; }

/** Best way for nation `nid` to reach region `rid`: by land (adjacent own region) or by sea (own port in range). */
export function reach(s, nid, rid) {
  const n = s.nations[nid]; let best = null;
  for (const r of LAND[rid]) if (s.regions[r].owner === nid) { const d = dist(r, rid); if (!best || d < best.dist) best = { from: r, kind: 'land', dist: d }; }
  if (best) return best;
  if (!isCoastal(rid) || !n.ships) return null;
  const rng = navalRange(n);
  for (const r of n.regs) { const g = s.regions[r]; if (!g.port) continue; const fixed = SEA_FIX[r].has(rid), d = dist(r, rid); if ((fixed || d <= rng) && (!best || d < best.dist)) best = { from: r, kind: 'sea', dist: d }; }
  return best;
}

// ---------------- economy ----------------
const regIncome = g => g.city * (0.5 + Math.sqrt(g.gdp) / 12) * (1 - g.dmg / 200);
const tradeCount = (s, n) => Math.min(5, s.pacts.filter(p => p.type === 'trade' && (p.a === n.id || p.b === n.id)).length);
const coopCount = (s, n) => Math.min(3, s.pacts.filter(p => p.type === 'coop' && (p.a === n.id || p.b === n.id)).length);
export function econ(s, n) {
  const m = modsOf(n), li = lvl(n, 'ind'); let inc = 0, ind = 0, rp = 0, up = n.troops * 0.02 + n.ships * 0.25;
  for (const r of n.regs) { const g = s.regions[r], k = 1 - g.dmg / 200; inc += regIncome(g); ind += g.fact * (1.5 + Math.sqrt(g.gdp) / 40) * k; rp += g.city * 0.12 + g.fact * 0.3; up += g.base * 0.4 + g.port * 0.2; }
  inc *= (1 + 0.08 * li) * m.income * (1 + 0.06 * tradeCount(s, n)); ind *= (1 + 0.25 * li) * m.ind; rp *= 1 + 0.12 * coopCount(s, n);
  const tribute = s.nations[n.overlord] ? inc * 0.3 : 0, got = puppetsOf(s, n.id).reduce((a, v) => a + econ0(s, v) * 0.3, 0);
  return { inc, ind, rp, up, tribute, got, net: inc - up - tribute + got };
}
const econ0 = (s, n) => { let i = 0; for (const r of n.regs) i += regIncome(s.regions[r]); return i * (1 + 0.08 * lvl(n, 'ind')) * modsOf(n).income; };

export function transfer(s, rid, newOwner) {
  const g = s.regions[rid], old = g.owner ? s.nations[g.owner] : null, nw = s.nations[newOwner];
  if (old) old.regs = old.regs.filter(r => r !== rid);
  g.owner = newOwner; nw.regs.push(rid); dirty.add(rid); relDirty = true;
  g.city = Math.max(1, Math.floor(g.city * 0.85)); g.fact = Math.floor(g.fact * 0.7); g.base = 0; g.space = 0; g.dmg = Math.max(g.dmg, 40);
  if (old) { if (!old.regs.length) kill(s, old.id, newOwner); else if (old.cap === rid) old.cap = old.regs.slice().sort((a, b) => s.regions[b].gdp - s.regions[a].gdp)[0]; }
}
function kill(s, id, by) {
  const n = s.nations[id]; n.alive = false; s.wars = s.wars.filter(w => w.a !== id && w.b !== id); s.pacts = s.pacts.filter(p => p.a !== id && p.b !== id);
  s.orders = s.orders.filter(o => o.o !== id); s.strikes = s.strikes.filter(o => o.o !== id); s.inbox = s.inbox.filter(p => p.from !== id);
  for (const v of alive(s)) if (v.overlord === id) v.overlord = null;
  log(s, `${n.name} desapareció del mapa (lo tomó ${s.nations[by]?.name ?? 'alguien'}).`, id === s.player ? 'bad' : '', [id, by]);
  if (id === s.player && !s.over) s.over = { type: 'lose', why: 'eliminado' };
}

// ---------------- building / recruiting / research ----------------
export function build(s, nid, rid, kind) {
  const n = s.nations[nid], g = s.regions[rid], d = STRUCTS[kind];
  if (g.owner !== nid) return { ok: false, msg: 'Esa zona no es tuya.' };
  if (d.coastal && !isCoastal(rid)) return { ok: false, msg: 'Un puerto necesita costa.' };
  if (d.tech && !hasTech(n, d.tech)) return { ok: false, msg: `Investiga ${TECHS[d.tech].name}.` };
  const f = kind === 'factory' ? 'fact' : kind;
  if (g[f] >= d.max) return { ok: false, msg: 'Ya no caben más.' };
  const c = structCost(kind, g[f]); if (n.money < c) return { ok: false, msg: `Faltan monedas (${c}).` };
  n.money -= c; g[f]++; if (kind === 'city') g.pop *= 1.04; dirty.add(rid);
  return { ok: true, msg: `${d.icon} ${d.name} construida en ${NAME(rid)}.` };
}
export function recruit(s, nid, amt) {
  const n = s.nations[nid], room = troopCap(s, n) - n.troops - marching(s, n); amt = Math.min(amt, Math.floor(room));
  if (amt <= 0) return { ok: false, msg: 'Ya tienes el ejército máximo (construye ciudades o bases).' };
  const m = Math.ceil(amt * 3), i = Math.ceil(amt * 1.5);
  if (n.money < m) return { ok: false, msg: `Faltan monedas (${m}).` }; if (n.ind < i) return { ok: false, msg: `Falta industria (${i}).` };
  n.money -= m; n.ind -= i; n.troops += amt; return { ok: true, msg: `+${amt}k soldados.`, amt };
}
export const shipCost = n => ({ m: Math.round(30 * modsOf(n).ships), i: Math.round(15 * modsOf(n).ships) });
export function buildShip(s, nid, qty = 1) {
  const n = s.nations[nid], c = shipCost(n); if (!n.regs.some(r => s.regions[r].port)) return { ok: false, msg: 'Necesitas un puerto.' };
  if (n.money < c.m * qty || n.ind < c.i * qty) return { ok: false, msg: `Cuesta ${c.m * qty}🪙 ${c.i * qty}🏭.` };
  n.money -= c.m * qty; n.ind -= c.i * qty; n.ships += qty; return { ok: true, msg: `+${qty} barco${qty > 1 ? 's' : ''}.` };
}
export const canResearch = (n, id) => !n.tech[id] && TECHS[id].req.every(r => n.tech[r]);
export function startResearch(s, nid, id) {
  const n = s.nations[nid]; if (!canResearch(n, id)) return { ok: false, msg: 'Aún no puedes investigar eso.' };
  if (n.research?.id === id) return { ok: true }; n.research = { id, got: 0 }; return { ok: true, msg: `Investigando ${TECHS[id].name}.` };
}

// ---------------- weapons ----------------
export function buyWeapon(s, nid, w) {
  const n = s.nations[nid], d = WEAPONS[w]; if (!hasTech(n, d.tech)) return { ok: false, msg: `Investiga ${TECHS[d.tech].name}.` };
  if (n.money < d.m || n.ind < d.i) return { ok: false, msg: `Cuesta ${d.m}🪙 ${d.i}🏭.` };
  n.money -= d.m; n.ind -= d.i; n.arms[w]++; return { ok: true, msg: `${d.icon} ${d.name} lista.` };
}
export function strikeSource(s, nid, w, rid) {
  const n = s.nations[nid], d = WEAPONS[w]; let best = null;
  for (const r of n.regs) { const g = s.regions[r]; if (d.from === 'base' ? !g.base : (r !== n.cap && !g.base)) continue; const x = dist(r, rid); if (x <= d.range && (!best || x < best.dist)) best = { from: r, dist: x }; }
  return best;
}
export function launch(s, nid, w, rid) {
  const n = s.nations[nid], d = WEAPONS[w], g = s.regions[rid];
  if (!n.arms[w]) return { ok: false, msg: 'No tienes de esa arma.' };
  if (g.owner === nid) return { ok: false, msg: 'No apuntes a tu propio país.' };
  if (g.owner && !atWar(s, nid, g.owner)) return { ok: false, msg: 'Solo contra países en guerra contigo.' };
  const src = strikeSource(s, nid, w, rid); if (!src) return { ok: false, msg: d.from === 'base' ? 'Fuera de alcance (necesitas una base cerca).' : 'Fuera de alcance.' };
  n.arms[w]--; const eta = Math.max(1, Math.ceil(src.dist / d.speed));
  s.strikes.push({ id: s.nid++, o: nid, from: src.from, to: rid, w, eta, total: eta }); hooks.sfx?.('launch');
  return { ok: true, msg: `${d.icon} ${d.name} lanzado hacia ${NAME(rid)}.` };
}
function impact(s, st) {
  const A = s.nations[st.o], d = WEAPONS[st.w]; if (!A?.alive) return;
  const hit = [[st.to, 1]]; if (d.radius) for (const id of IDS) if (id !== st.to && dist(id, st.to) <= d.radius && s.regions[id].owner !== st.o) hit.push([id, 0.5]);
  for (const [rid, k] of hit) {
    const g = s.regions[rid], D = g.owner ? s.nations[g.owner] : null, p = d.power * k;
    g.dmg = Math.min(100, g.dmg + 20 * p); g.pop *= 1 - 0.012 * p; dirty.add(rid);
    if (D) { const loss = Math.min(D.troops, D.troops * 0.04 * p + 1.5 * p); D.troops -= loss; }
    for (const b of ['space', 'base', 'port', 'fact', 'city']) { const floor = b === 'city' ? 1 : 0; if (g[b] > floor && rnd() < Math.min(0.9, 0.14 * p)) g[b]--; }
    if (D && !D.bot) hooks.event?.({ text: `💥 ¡${d.name} de ${A.name} cayó sobre ${NAME(rid)}!`, tone: 'bad', who: [D.id] });
  }
  hooks.sfx?.('boom'); if (d.power >= 6) { A.rep = Math.max(0, A.rep - 25); for (const o of alive(s)) if (o.id !== A.id) addRel(s, o.id, A.id, -20); }
  log(s, `${d.icon} ${A.name} atacó ${NAME(st.to)} con ${d.name.toLowerCase()}.`, st.o === s.player ? 'good' : s.regions[st.to].owner === s.player ? 'bad' : '', [st.o, s.regions[st.to].owner]);
}

// ---------------- superpowers ----------------
export const spDef = n => n.spId ? SUPERPOWERS[n.spId] : null;
export function unlockSP(s, nid) {
  const n = s.nations[nid], d = spDef(n); if (!d || n.sp) return { ok: false, msg: 'No disponible.' };
  if (!hasTech(n, d.tech)) return { ok: false, msg: `Investiga ${TECHS[d.tech].name}.` }; if (n.money < d.cost) return { ok: false, msg: `Cuesta ${d.cost}🪙.` };
  n.money -= d.cost; n.sp = { on: true, cd: 0, act: 0 }; log(s, `${d.icon} ¡${n.name} desbloquea su superpoder: ${d.name}!`, 'epic', [nid]); return { ok: true, msg: 'Superpoder desbloqueado.' };
}
export function useSP(s, nid) {
  const n = s.nations[nid], d = spDef(n); if (!n.sp?.on) return { ok: false, msg: 'Aún no lo tienes.' }; if (n.sp.cd > 0) return { ok: false, msg: `Espera ${n.sp.cd} días.` };
  const a = d.act; n.sp.cd = a.cd;
  if (n.spId === 'US') { n.money += 600; n.ind += 120; n.troops += 30; } else if (n.spId === 'CN') n.sp.act = a.days; else if (n.spId === 'RU') n.troops += 40; else if (n.spId === 'GB') n.ships += 8;
  log(s, `${d.icon} ${n.name}: ${a.name}.`, 'epic', [nid]); return { ok: true, msg: a.name + '.' };
}

// ---------------- space race ----------------
export const spaceOf = (s, id) => (s.space[id] ??= { i: 0, left: null });
export const stageDone = (s, n) => spaceOf(s, n.id).i >= SPACE.length;
export function startSpace(s, nid) {
  const n = s.nations[nid], sp = spaceOf(s, nid), st = SPACE[sp.i]; if (!st) return { ok: false };
  if (st.auto || sp.left !== null || st.struct || !st.days) return { ok: false, msg: 'Esta fase no se puede iniciar ahora.' };
  if (st.tech && !hasTech(n, st.tech)) return { ok: false, msg: `Investiga ${TECHS[st.tech].name}.` };
  if (n.money < st.m || n.ind < st.i) return { ok: false, msg: `Cuesta ${st.m}🪙 ${st.i}🏭.` };
  n.money -= st.m; n.ind -= st.i; sp.left = Math.round(st.days * (n.bot ? 1.8 : 1)); log(s, `${st.icon} ${n.name}: ${st.name}.`, nid === s.player ? 'good' : '', [nid]); return { ok: true, msg: st.name + '…' };
}
function spaceTick(s) {
  for (const n of alive(s)) {
    if (!hasTech(n, 'space1') && !s.space[n.id]) continue; const sp = spaceOf(s, n.id); if (sp.i >= SPACE.length) continue;
    if (sp.i === 0 && hasTech(n, 'space1')) sp.i = 1;
    if (sp.i === 1 && n.regs.some(r => s.regions[r].space)) { sp.i = 2; sp.left = null; }
    if ((sp.i === 2 || sp.i === 3) && !n.regs.some(r => s.regions[r].space)) { if (sp.i !== 2 || sp.left !== null) log(s, `🛰 ${n.name} perdió su base espacial.`, 'bad', [n.id]); sp.i = 1; sp.left = null; continue; }
    if (sp.i === 4 && sp.left === null) sp.left = Math.round(SPACE[4].days * (n.bot ? 1.8 : 1));
    if (sp.left !== null && --sp.left <= 0) {
      sp.i++; sp.left = null; const done = SPACE[sp.i - 1];
      log(s, `${done.icon} ${n.name} completó: ${done.name.toLowerCase()}.`, n.id === s.player ? 'epic' : '', [n.id]);
      if (sp.i >= SPACE.length) { s.over = { type: n.id === s.player ? 'win' : 'lose', why: 'luna', winner: n.id }; }
    }
  }
}

// ---------------- historical empires ----------------
export function empireProgress(s, nid, eid) {
  const e = EMPIRES[eid], regs = e.regions.filter(r => s.regions[r]), n = s.nations[nid], own = new Set([...n.regs, ...puppetsOf(s, nid).flatMap(v => v.regs)]);
  const have = regs.filter(r => own.has(r)).length; return { have, need: Math.ceil(regs.length * 0.7), total: regs.length, capital: own.has(e.capital), ok: have >= Math.ceil(regs.length * 0.7) && own.has(e.capital) };
}
function empireTick(s) {
  for (const n of alive(s)) { if (n.emp) continue; for (const e of Object.values(EMPIRES)) {
    if (s.empFormed[e.id]) continue; const p = empireProgress(s, n.id, e.id); if (!p.ok) continue;
    s.empFormed[e.id] = n.id; n.emp = e.id; n.name = e.name; n.flag = e.flag; n.color = e.color; markAll();
    log(s, `👑 ¡${e.name} renace bajo el mando de ${NAME(n.id)}!`, 'epic', [n.id]); hooks.sfx?.('empire'); break; } }
}

// ---------------- diplomacy ----------------
function betray(s, a, pen) { const n = s.nations[a]; n.rep = Math.max(0, n.rep - pen); for (const o of alive(s)) if (o.id !== a) addRel(s, o.id, a, -Math.round(pen / 4)); }
export function breakPact(s, p, breaker) {
  s.pacts.splice(s.pacts.indexOf(p), 1); const other = p.a === breaker ? p.b : p.a, pen = p.type === 'alliance' ? 30 : p.type === 'embassy' ? 4 : 6;
  if (pen > 5) betray(s, breaker, pen); addRel(s, breaker, other, -pen * 1.5); relDirty = true;
  log(s, `${s.nations[breaker].name} rompió: ${PACTS[p.type].name.toLowerCase()} con ${s.nations[other].name}.`, 'bad', [breaker, other]);
}
export function evaluate(s, from, to, type) {
  const a = s.nations[from], b = s.nations[to], P = persOf(b), r = rel(s, to, from) + (a.rep - 50) / 2;
  if (atWar(s, from, to)) return { ok: false, msg: '¡Estamos en guerra!' };
  if (b.overlord === from || a.overlord === to) return { ok: false, msg: 'Ya os une un protectorado.' };
  if (pactOf(s, from, to, type)) return { ok: false, msg: 'Ya existe ese acuerdo.' };
  if (type !== 'embassy' && !pactOf(s, from, to, 'embassy')) return { ok: false, msg: 'Primero hay que establecer relaciones diplomáticas.' };
  const common = enemiesOf(s, from).filter(e => enemiesOf(s, to).includes(e)).length * 12;
  const ratio = strength(a) / Math.max(1, strength(b));
  const score = { embassy: r + P.coop * 10 + 10, coop: r + P.coop * 15 + 4, trade: r + P.trade * 25, alliance: r + P.coop * 20 + common - (b.pers === 'isolationist' ? 25 : 0) + Math.min(15, ratio * 4) - 20 }[type];
  const need = { embassy: -10, coop: 8, trade: 10, alliance: 15 }[type];
  if (score >= need) return { ok: true };
  return { ok: false, msg: a.rep < 30 && type === 'alliance' ? 'Tu fama es muy baja.' : type === 'alliance' ? 'Una alianza necesita más confianza.' : 'Ahora no nos interesa.' };
}
export function sign(s, a, b, type) {
  if (!pactOf(s, a, b, type)) s.pacts.push({ a, b, type, since: s.t }); addRel(s, a, b, type === 'alliance' ? 20 : type === 'embassy' ? 4 : 8); relDirty = true;
  log(s, `${PACTS[type].icon} ${s.nations[a].name} y ${s.nations[b].name}: ${PACTS[type].name.toLowerCase()}.`, 'good', [a, b]);
}
export function propose(s, from, to, type) { const r = evaluate(s, from, to, type); if (r.ok) sign(s, from, to, type); else addRel(s, from, to, -1); return r; }
export function improveRelations(s, from, to) {
  const a = s.nations[from]; if (a.money < 50) return { ok: false, msg: 'Faltan 50🪙.' }; const cd = a.truce['rel' + to] ?? 0; if (cd > s.t) return { ok: false, msg: `Espera ${cd - s.t} días.` };
  a.money -= 50; a.truce['rel' + to] = s.t + 30; addRel(s, from, to, 15); return { ok: true, msg: 'Relaciones mejoradas.' };
}
export function requestAid(s, from, ally) {
  const a = s.nations[ally], n = s.nations[from], cd = n.truce.aid ?? 0; if (cd > s.t) return { ok: false, msg: `Tus aliados necesitan ${cd - s.t} días.` };
  const t = Math.max(1, Math.round(a.troops * 0.1)); a.troops -= t; n.troops += t; n.truce.aid = s.t + 90; return { ok: true, msg: `¡${a.name} envió ${t}k soldados!` };
}
export function becomePuppet(s, over, id) {
  const n = s.nations[id]; n.overlord = over; n.since = s.t; s.pacts = s.pacts.filter(p => !(p.a === id || p.b === id) || p.type === 'embassy');
  for (const e of enemiesOf(s, id)) if (e !== over) endWar(s, id, e, true);
  for (const e of enemiesOf(s, over)) if (!atWar(s, id, e)) s.wars.push({ a: id, b: e, start: s.t, sa: 0, sb: 0 });
  relDirty = true; markAll(); log(s, `🎭 ${n.name} es ahora un estado títere de ${s.nations[over].name}.`, 'epic', [id, over]);
}
export function offerPuppet(s, from, to) {
  const a = s.nations[from], b = s.nations[to]; if (b.overlord) return { ok: false, msg: 'Ya tiene dueño.' }; if (atWar(s, from, to)) return { ok: false, msg: 'Estáis en guerra.' };
  const ratio = strength(a) / Math.max(1, strength(b)); if (ratio < 3.5) return { ok: false, msg: 'No necesitamos tu protección.' }; if (rel(s, to, from) < -30) return { ok: false, msg: 'No nos caes bien.' };
  becomePuppet(s, from, to); return { ok: true, msg: `${b.name} aceptó ser tu estado títere.` };
}
export function release(s, id) { const n = s.nations[id], o = n.overlord; n.overlord = null; addRel(s, id, o, 40); markAll(); log(s, `${n.name} vuelve a ser libre.`, 'good', [id, o]); }
export function annex(s, over, id) {
  const o = s.nations[over], v = s.nations[id]; if (v.overlord !== over) return { ok: false }; if (s.t - v.since < 40) return { ok: false, msg: `Espera ${40 - (s.t - v.since)} días.` };
  if (o.money < 150) return { ok: false, msg: 'Cuesta 150🪙.' }; o.money -= 150; betray(s, over, 6);
  for (const r of [...v.regs]) { const g = s.regions[r]; g.owner = over; o.regs.push(r); dirty.add(r); } v.regs = []; v.alive = false; v.overlord = null; v.troops = 0;
  o.troops += 0; kill0(s, id); markAll(); log(s, `${o.name} anexó a ${v.name}.`, 'epic', [over, id]); return { ok: true, msg: `Anexaste a ${v.name}.` };
}
function kill0(s, id) { s.wars = s.wars.filter(w => w.a !== id && w.b !== id); s.pacts = s.pacts.filter(p => p.a !== id && p.b !== id); s.orders = s.orders.filter(o => o.o !== id); s.inbox = s.inbox.filter(p => p.from !== id); }

// ---------------- war ----------------
export function canDeclare(s, a, b) {
  const A = s.nations[a], B = s.nations[b]; if (a === b || !B?.alive) return { ok: false, msg: 'Objetivo no válido.' };
  if (atWar(s, a, b)) return { ok: false, msg: 'Ya estáis en guerra.' }; if (isAllied(s, a, b)) return { ok: false, msg: 'Es tu aliado: rompe la alianza primero.' };
  if (A.overlord) return { ok: false, msg: 'Un estado títere no declara guerras.' }; if (B.overlord === a || A.overlord === b) return { ok: false, msg: 'Es tu estado títere o tu protector.' };
  if ((A.truce[b] ?? 0) > s.t) return { ok: false, msg: `Hay tregua ${A.truce[b] - s.t} días más.` };
  return { ok: true };
}
export function declareWar(s, a, b) {
  const c = canDeclare(s, a, b); if (!c.ok) return c; const A = s.nations[a], B = s.nations[b];
  s.wars.push({ a, b, start: s.t, sa: 0, sb: 0 }); hooks.sfx?.('war'); relDirty = true;
  log(s, `⚔️ ¡${A.name} declaró la guerra a ${B.name}!`, a === s.player ? 'good' : b === s.player ? 'bad' : '', [a, b]);
  for (const o of alive(s)) {
    if (o.id === a || o.id === b) continue; const sideB = o.overlord === b || (isAllied(s, o.id, b) && !isAllied(s, o.id, a) && rnd() < 0.9), sideA = o.overlord === a || (isAllied(s, o.id, a) && !isAllied(s, o.id, b) && rel(s, o.id, b) < 20 && rnd() < 0.5);
    if (sideB) joinWar(s, o.id, a); else if (sideA) joinWar(s, o.id, b);
  }
  return { ok: true };
}
function joinWar(s, x, enemy) {
  if (x === enemy || atWar(s, x, enemy) || isAllied(s, x, enemy) || !s.nations[enemy]?.alive) return;
  s.wars.push({ a: x, b: enemy, start: s.t, sa: 0, sb: 0, help: true }); relDirty = true; log(s, `${s.nations[x].name} entra en la guerra contra ${s.nations[enemy].name}.`, 'bad', [x, enemy]);
}
export function endWar(s, a, b, silent) {
  const w = warOf(s, a, b); if (w) s.wars.splice(s.wars.indexOf(w), 1); s.nations[a].truce[b] = s.t + 60; s.nations[b].truce[a] = s.t + 60; relDirty = true;
  if (!silent) log(s, `🕊 ¡Paz entre ${s.nations[a].name} y ${s.nations[b].name}!`, 'good', [a, b]);
}
export function warScore(s, a, b) {
  const w = warOf(s, a, b); if (!w) return 0; const mine = w.a === a ? w.sa : w.sb, theirs = w.a === a ? w.sb : w.sa;
  return Math.round(mine * 20 - theirs * 20 + Math.max(-30, Math.min(30, (strength(s.nations[a]) / Math.max(1, strength(s.nations[b])) - 1) * 12)));
}
export function desperation(s, ai, other) {
  const w = warOf(s, ai, other), me = s.nations[ai], o = s.nations[other]; const lost = w ? (w.a === ai ? w.sb : w.sa) : 0, won = w ? (w.a === ai ? w.sa : w.sb) : 0;
  return Math.max(0, Math.min(100, (strength(o) / Math.max(1, strength(me)) - 0.8) * 30 + lost * 14 - won * 10 + (w ? (s.t - w.start) / 6 : 0) + (me.pers === 'isolationist' || me.pers === 'diplomatic' ? 8 : 0)));
}
export const PEACE_NEED = { white: 15, reparations: 32, cede1: 30, cede3: 62, puppet: 80, concede: 4 };
export function peaceDecision(s, proposer, target, deal) {
  const d = desperation(s, target, proposer); if (d >= PEACE_NEED[deal]) return { ok: true };
  return { ok: false, msg: d < 12 ? 'Aún queremos seguir luchando.' : '¡Esas condiciones no nos gustan!' };
}
export function cedeCandidates(s, proposer, target, k) {
  const T = s.nations[target], P = s.nations[proposer]; if (T.regs.length < 2) return [];
  return T.regs.filter(r => r !== T.cap || T.regs.length > k + 1).map(r => [r, Math.min(...P.regs.map(x => dist(x, r)))]).sort((a, b) => a[1] - b[1]).slice(0, Math.min(k, T.regs.length - 1)).map(x => x[0]);
}
export function applyPeace(s, proposer, target, deal) {
  const P = s.nations[proposer], T = s.nations[target];
  if (deal === 'reparations') { const g = Math.round(T.money * 0.4); T.money -= g; P.money += g; }
  else if (deal === 'concede') { const g = Math.min(P.money, 60); P.money -= g; T.money += g; }
  else if (deal === 'cede1' || deal === 'cede3') for (const r of cedeCandidates(s, proposer, target, deal === 'cede1' ? 1 : 3)) transfer(s, r, proposer);
  if (warOf(s, proposer, target)) endWar(s, proposer, target);
  if (deal === 'puppet') becomePuppet(s, proposer, target);
}
export function addProposal(s, p) {
  if (s.inbox.some(x => x.from === p.from && x.kind === p.kind && x.deal === p.deal)) return;
  s.inbox.push({ ...p, id: s.nid++, exp: s.t + 45 }); if (s.inbox.length > 20) s.inbox.shift(); hooks.event?.({ text: `🔔 ${s.nations[p.from].name} te envía un mensaje.`, tone: 'epic', who: [s.player], inbox: true });
}
export function acceptProposal(s, p) {
  s.inbox.splice(s.inbox.indexOf(p), 1);
  if (p.kind === 'peace') { if (atWar(s, p.from, s.player)) applyPeace(s, p.from, s.player, p.deal); }
  else if (!atWar(s, p.from, s.player) && s.nations[p.from].alive) sign(s, p.from, s.player, p.kind);
}

// ---------------- armies ----------------
export function expandCost(rid) { return Math.round(25 + Math.sqrt(REG[rid].area) * 0.6); }
export function expand(s, nid, rid) {
  const n = s.nations[nid], g = s.regions[rid]; if (g.owner) return { ok: false, msg: 'Esa tierra ya tiene dueño.' };
  if (s.orders.some(o => o.kind === 'expand' && o.to === rid && o.o === nid)) return { ok: false, msg: 'Ya la estás reclamando.' };
  const r = reach(s, nid, rid); if (!r) return { ok: false, msg: 'Fuera de tu alcance: necesitas frontera o un puerto cerca.' };
  const c = expandCost(rid); if (n.money < c) return { ok: false, msg: `Faltan monedas (${c}).` };
  n.money -= c; const eta = Math.ceil(r.dist / 4) + 2; s.orders.push({ id: s.nid++, o: nid, from: r.from, to: rid, n: 0, eta, total: eta, kind: 'expand' });
  return { ok: true, msg: `Reclamando ${NAME(rid)}… (${eta} días)` };
}
export function sendArmy(s, nid, rid, frac) {
  const n = s.nations[nid], g = s.regions[rid], D = g.owner ? s.nations[g.owner] : null;
  if (!D) return { ok: false, msg: 'Usa «Expandir» en tierras sin dueño.' }; if (!atWar(s, nid, D.id)) return { ok: false, msg: 'No estás en guerra con ese país.' };
  const r = reach(s, nid, rid); if (!r) return { ok: false, msg: 'Fuera de alcance: necesitas frontera, o puerto + barcos cerca.' };
  let amt = Math.max(1, Math.round(n.troops * frac)); if (n.troops < 1) return { ok: false, msg: 'No tienes soldados.' };
  if (r.kind === 'sea') { const cap = 4 + n.ships * 6; if (amt > cap) amt = cap; }
  n.troops -= amt; const sp = r.kind === 'land' ? 5 * (1 + 0.1 * s.regions[r.from].infra) : 3 * (1 + 0.25 * lvl(n, 'navy')), eta = Math.max(2, Math.ceil(r.dist / sp) + (r.kind === 'sea' ? 2 : 0));
  s.orders.push({ id: s.nid++, o: nid, from: r.from, to: rid, n: amt, eta, total: eta, kind: r.kind });
  return { ok: true, msg: `🪖 ${amt}k soldados ${r.kind === 'sea' ? 'embarcan' : 'marchan'} hacia ${NAME(rid)} (${eta} días).` };
}
function arrive(s, o) {
  const A = s.nations[o.o]; if (!A?.alive) return; const g = s.regions[o.to];
  if (o.kind === 'expand') { if (!g.owner) { g.owner = o.o; A.regs.push(o.to); g.dmg = 0; dirty.add(o.to); relDirty = true; log(s, `🏳 ${A.name} reclamó ${NAME(o.to)}.`, o.o === s.player ? 'good' : '', [o.o]); } else A.money += expandCost(o.to); return; }
  if (g.owner === o.o) { A.troops += o.n; return; }
  if (!g.owner) { g.owner = o.o; A.regs.push(o.to); dirty.add(o.to); A.troops += o.n; return; }
  const D = s.nations[g.owner]; if (!atWar(s, o.o, D.id)) { A.troops += o.n; return; }
  const sea = o.kind === 'sea'; let n = o.n;
  if (sea && D.ships > 0) { const f = Math.min(0.6, D.ships / (A.ships + 1) * 0.2); const lost = Math.round(n * f); n -= lost; const sl = Math.min(D.ships, Math.round(1 + f * 3)); D.ships -= sl; A.ships = Math.max(0, A.ships - Math.round(sl * 0.6)); }
  const share = Math.max(0.1, Math.min(1, 2.2 / Math.pow(D.regs.length, 0.7)));
  let def = D.troops * share * (1 + 0.15 * lvl(D, 'mil')) * modsOf(D).troops * modsOf(D).def * (1 + 0.12 * g.infra) * (1 + 0.2 * g.base) * (o.to === D.cap ? 1.5 : 1) * (1 - g.dmg / 150) * (sea ? 1.25 : 1) * (D.regs.length === 1 ? 1.35 : 1);
  def += alliesOf(s, D.id).filter(x => atWar(s, x, o.o)).reduce((t, x) => t + strength(s.nations[x]) * 0.05, 0);
  const atk = n * (1 + 0.15 * lvl(A, 'mil')) * modsOf(A).troops * (sea ? (lvl(A, 'navy') >= 2 ? 0.95 : 0.8) : 1), w = warOf(s, o.o, D.id);
  if (atk * (0.85 + rnd() * 0.4) > def * (0.85 + rnd() * 0.4)) {
    const lossA = Math.max(1, Math.round(n * Math.min(0.6, 0.15 + 0.35 * def / Math.max(1, atk)))), lossD = Math.min(D.troops, D.troops * share * Math.min(0.7, 0.2 + 0.3 * atk / Math.max(1, def)));
    D.troops -= lossD; A.troops += Math.max(0, n - lossA) * 0.9; if (w) (w.a === o.o ? w.sa++ : w.sb++);
    log(s, `💥 ¡${A.name} conquistó ${NAME(o.to)}!`, o.o === s.player ? 'good' : D.id === s.player ? 'bad' : '', [o.o, D.id]); hooks.sfx?.(o.o === s.player || D.id === s.player ? 'boom' : null);
    transfer(s, o.to, o.o); for (const x of alive(s)) if (x.id !== o.o && x.id !== D.id) addRel(s, x.id, o.o, -1);
  } else {
    D.troops = Math.max(0, D.troops - D.troops * share * 0.25 * Math.min(1, atk / Math.max(1, def))); A.troops += n * 0.2;
    log(s, `El ataque de ${A.name} a ${NAME(o.to)} fracasó.`, o.o === s.player ? 'bad' : D.id === s.player ? 'good' : '', [o.o, D.id]);
  }
}

// ---------------- time ----------------
function victoryTick(s) {
  const tot = IDS.length;
  for (const n of alive(s)) { if (n.overlord) continue; const own = n.regs.length + puppetsOf(s, n.id).reduce((a, v) => a + v.regs.length, 0); if (own / tot >= 0.6) { s.over = { type: n.id === s.player ? 'win' : 'lose', why: 'dominacion', winner: n.id }; return; } }
}
export const share = (s, id) => { const n = s.nations[id]; return (n.regs.length + puppetsOf(s, id).reduce((a, v) => a + v.regs.length, 0)) / IDS.length; };

/** Advance the world by exactly one game day. */
export function tick(s) {
  if (s.over) return; s.t++;
  const list = alive(s);
  for (const n of list) {
    const e = econ(s, n); n.money += e.net; if (n.money < 0) { n.money = 0; n.troops *= 0.996; }
    n.ind += e.ind; if (n.research) { n.research.got += e.rp * (n.bot ? 0.5 : 1); if (n.research.got >= TECHS[n.research.id].cost) { n.tech[n.research.id] = 1; const id = n.research.id; n.research = null; log(s, `🔬 ${n.name} investigó ${TECHS[id].name}.`, n.id === s.player ? 'epic' : '', [n.id]); } }
    if (n.sp) { if (n.sp.cd > 0) n.sp.cd--; if (n.sp.act > 0) n.sp.act--; }
    for (const r of n.regs) { const g = s.regions[r]; if (g.dmg > 0) g.dmg = Math.max(0, g.dmg - 0.4); g.pop *= 1 + 0.00001 * g.city; }
  }
  for (const o of [...s.orders]) if (--o.eta <= 0) { s.orders.splice(s.orders.indexOf(o), 1); arrive(s, o); }
  for (const st of [...s.strikes]) if (--st.eta <= 0) { s.strikes.splice(s.strikes.indexOf(st), 1); impact(s, st); }
  spaceTick(s);
  if (s.t % 5 === 0) { empireTick(s); victoryTick(s); s.inbox = s.inbox.filter(p => p.exp > s.t && s.nations[p.from]?.alive); }
  if (hooks.ai) { const bots = alive(s).filter(n => n.bot); for (let i = 0; i < bots.length; i++) if ((i + s.t) % 6 === 0) hooks.ai(s, bots[i]); }
}

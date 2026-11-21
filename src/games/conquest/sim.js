import geo from '../../data/geo.json';
import meta from '../../data/countryMeta.json';
import { EMPIRES } from '../../data/empires.js';

/**
 * World Conquest simulation — pure logic, no DOM. Everything is serialisable (plain JSON),
 * so a campaign can be saved to the shared profile and resumed later.
 */
const parse = s => Object.fromEntries(s.split(' ').map(x => x.split(':')).map(([k, v]) => [k, +v]));
const POP = parse('US:335 CN:1412 IN:1417 ID:275 PK:231 BR:215 NG:218 BD:171 RU:144 MX:128 JP:125 ET:123 PH:115 EG:109 CD:99 VN:98 IR:88 TR:85 DE:83 TH:72 GB:67 FR:68 TZ:65 ZA:60 IT:59 KE:54 MM:54 KR:52 CO:52 ES:47 UG:47 AR:46 DZ:45 SD:46 UA:41 IQ:44 AF:41 PL:38 CA:39 MA:37 SA:36 UZ:35 PE:34 MY:33 AO:35 GH:33 MZ:33 YE:33 NP:30 VE:28 MG:29 CM:27 CI:28 NE:26 AU:26 KP:26 LK:22 BF:22 ML:22 RO:19 CL:19 KZ:19 ZM:19 GT:17 EC:18 NL:17.5 SY:21 SN:17 KH:17 TD:17 SO:17 ZW:16 GN:13 RW:13 BJ:13 BI:13 TN:12 BE:11.6 CU:11 BO:12 HT:11 GR:10.4 CZ:10.5 PT:10.3 SE:10.4 JO:11 DO:11 AZ:10 HU:9.7 AT:9 BY:9.4 CH:8.7 IL:9.5 TG:8.8 SL:8 LA:7.5 PY:6.8 BG:6.8 LY:6.8 RS:6.8 LB:5.5 NI:6.8 SV:6.3 KG:6.7 TM:6.1 DK:5.9 FI:5.5 NO:5.4 SK:5.4 NZ:5.1 IE:5 CR:5.1 LR:5.3 OM:4.6 HR:3.9 GE:3.7 MR:4.7 PA:4.4 UY:3.4 MN:3.4 AM:3 LT:2.8 AL:2.8 QA:2.7 NA:2.6 BW:2.6 SI:2.1 LV:1.9 LS:2.3 EE:1.3 CY:1.3 GY:0.8 BT:0.8 LU:0.65 IS:0.37');
const GDP = parse('US:25000 CN:18000 JP:4200 DE:4100 IN:3400 GB:3100 FR:2800 IT:2000 CA:2100 KR:1700 RU:2000 BR:1900 AU:1700 MX:1400 ES:1400 ID:1300 SA:1100 NL:1000 TR:900 CH:800 PL:690 TH:500 SE:590 BE:580 AR:630 NO:580 AT:480 IL:520 IE:500 NG:470 EG:400 ZA:400 DK:400 PH:400 MY:400 BD:420 VN:410 CO:340 CL:300 FI:280 RO:300 CZ:290 PT:250 NZ:250 GR:220 PE:240 IQ:270 DZ:190 KZ:220 HU:180 UA:160 MA:130 QA:180 PK:350 IR:400 UZ:80 KE:110 ET:126 GH:73 AO:120 TZ:75');
const PC = { Europe: 25, Asia: 7, Africa: 2.2, 'North America': 9, 'South America': 7, Oceania: 18 };
const hash = str => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; };

export const REG = Object.fromEntries(geo.regions.map(r => [r.id, r]));
export const IDS = geo.regions.map(r => r.id);
export const NAME = id => meta[id]?.n ?? id;

// ---------------- adjacency (land borders + sea links) ----------------
export const ADJ = Object.fromEntries(IDS.map(i => [i, new Set()]));
const link = (a, b) => { if (ADJ[a] && ADJ[b] && a !== b) { ADJ[a].add(b); ADJ[b].add(a); } };
for (const id of IDS) for (const b of meta[id]?.b ?? []) link(id, b);
[['GB', 'FR'], ['GB', 'IE'], ['JP', 'KR'], ['ID', 'MY'], ['AU', 'ID'], ['AU', 'PG'], ['NZ', 'AU'], ['IT', 'TN'], ['ES', 'MA'], ['CU', 'US'], ['CU', 'HT'], ['CY', 'TR'], ['CY', 'SY'], ['LK', 'IN'], ['PH', 'VN'], ['PH', 'MY'], ['JP', 'RU'], ['DK', 'SE'], ['IS', 'GB'], ['IS', 'NO'], ['DO', 'JM'], ['JM', 'CU'], ['TT', 'VE'], ['SA', 'EG'], ['YE', 'SO'], ['MG', 'MZ'], ['GR', 'TR'], ['IT', 'GR'], ['IT', 'HR'], ['IT', 'FR'], ['KR', 'CN'], ['BD', 'MM'], ['FJ', 'AU'], ['SB', 'PG'], ['VU', 'AU'], ['MY', 'SG'], ['TW', 'CN'], ['TW', 'JP'], ['TW', 'PH'], ['PH', 'ID'], ['NZ', 'FJ']].forEach(([a, b]) => link(a, b));
for (const id of IDS) if (ADJ[id].size < 2) {
  const r = REG[id]; IDS.filter(o => o !== id).map(o => [o, Math.hypot(REG[o].cx - r.cx, REG[o].cy - r.cy)]).sort((x, y) => x[1] - y[1]).slice(0, 2).forEach(([o, d]) => { if (d < 160) link(id, o); });
}

// ---------------- construction ----------------
const PERS = [
  { id: 'aggressive', label: 'Guerrero', aggr: 1.0, coop: 0.3, trade: 0.3, peace: 0.1 },
  { id: 'opportunist', label: 'Astuto', aggr: 0.6, coop: 0.5, trade: 0.5, peace: 0.3 },
  { id: 'diplomatic', label: 'Amistoso', aggr: 0.15, coop: 1.0, trade: 0.7, peace: 0.8 },
  { id: 'merchant', label: 'Comerciante', aggr: 0.2, coop: 0.6, trade: 1.0, peace: 0.7 },
  { id: 'isolationist', label: 'Tranquilo', aggr: 0.1, coop: 0.1, trade: 0.2, peace: 1.0 }
];
export const persOf = n => PERS.find(p => p.id === n.pers);
const hue = id => Math.floor(hash('c' + id) * 360);
export const colorOf = (n) => n.color ?? `hsl(${hue(n.id)} 55% 48%)`;

function makeRegion(id) {
  const m = meta[id], pop = POP[id] ?? Math.max(0.3, +(0.4 + hash('p' + id) * 14 * Math.min(2.5, (REG[id].area / 3000) + 0.4)).toFixed(1));
  const gdp = GDP[id] ?? Math.max(1, Math.round(pop * (PC[m?.r] ?? 6) * (0.4 + hash('g' + id) * 1.4)));
  const cities = Math.max(1, Math.min(8, 1 + Math.floor(Math.log2(pop / 3 + 1))));
  return { owner: id, pop, gdp, cities, ci: Math.max(0.4, +(gdp / 30 / cities).toFixed(2)), fact: gdp > 300 ? Math.min(6, Math.floor(gdp / 700) + 1) : 0, infra: gdp > 1500 ? 2 : gdp > 200 ? 1 : 0 };
}
const BASE = (a, b) => Math.round((hash(a < b ? a + b : b + a) - 0.5) * 30) - (ADJ[a]?.has(b) ? 5 : 0);

export function newCampaign(startId /* region code or empire id */) {
  const s = { v: 1, turn: 0, player: startId, regions: {}, nations: {}, wars: [], pacts: [], proposals: [], log: [], over: null, ap: 2, aidCd: 0 };
  for (const id of IDS) s.regions[id] = makeRegion(id);
  for (const id of IDS) {
    const m = meta[id], reg = s.regions[id], troops = Math.max(2, Math.round(Math.min(reg.pop * 1.5, reg.gdp / 10)));
    s.nations[id] = { id, name: m.n, flag: id.toLowerCase(), cap: id, treasury: Math.round(reg.gdp / 30 * 5) + 20, troops, equip: Math.round(troops * 0.6), pers: PERS[Math.floor(hash('pe' + id) * PERS.length)].id, rel: {}, rep: 60, overlord: null, vtype: null, alive: true, regs: [id], mods: { income: 1, troops: 1, equipment: 1 }, atk: 0, factoryBank: 0 };
  }
  const emp = EMPIRES[startId];
  if (emp) {
    const regs = emp.regions.filter(r => s.regions[r]); const cap = regs.includes(emp.capital) ? emp.capital : regs[0];
    const n = { id: emp.id, name: emp.name, flag: emp.flag, cap, treasury: 0, troops: 0, equip: 0, pers: 'diplomatic', rel: {}, rep: 60, overlord: null, vtype: null, alive: true, regs: [], color: emp.color, mods: { ...emp.mods }, atk: 0, factoryBank: 0, empire: true };
    for (const r of regs) { const old = s.nations[s.regions[r].owner]; old.regs = old.regs.filter(x => x !== r); s.regions[r].owner = emp.id; n.regs.push(r); n.troops += s.nations[r].troops; n.equip += s.nations[r].equip; n.treasury += Math.round(s.regions[r].gdp / 30 * 3); if (!old.regs.length) old.alive = false; }
    n.troops = Math.round(n.troops * emp.mods.troops * 0.8); n.equip = Math.round(n.equip * emp.mods.equipment * 0.8); s.nations[emp.id] = n;
    for (const h of emp.mods.hostile ?? []) if (s.nations[h]) { s.nations[h].rel[emp.id] = -40; n.rel[h] = -40; }
  }
  log(s, `¡Empieza la aventura de ${s.nations[startId].name}!`); return s;
}

// ---------------- queries ----------------
export const N = (s, id) => s.nations[id];
export const alive = s => Object.values(s.nations).filter(n => n.alive);
export const ownerOf = (s, rid) => s.regions[rid].owner;
export const rel = (s, a, b) => Math.max(-100, Math.min(100, BASE(a, b) + (s.nations[a].rel[b] ?? 0)));
export function addRel(s, a, b, d) { for (const [x, y] of [[a, b], [b, a]]) { const n = s.nations[x]; if (n) n.rel[y] = Math.max(-140, Math.min(140, (n.rel[y] ?? 0) + d)); } }
export const strength = n => n.troops * (1 + 0.5 * Math.min(1, n.equip / Math.max(1, n.troops)));
export const popOf = (s, n) => n.regs.reduce((a, r) => a + s.regions[r].pop, 0);
export const gdpOf = (s, n) => n.regs.reduce((a, r) => a + s.regions[r].gdp, 0);
export const areaOf = n => n.regs.reduce((a, r) => a + REG[r].area, 0);
export const atWar = (s, a, b) => s.wars.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
export const warOf = (s, a, b) => s.wars.find(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
export const pactOf = (s, a, b, type) => s.pacts.find(p => ((p.a === a && p.b === b) || (p.a === b && p.b === a)) && (!type || p.type === type || (type === 'alliance' && p.type.startsWith('alliance'))));
export const isAllied = (s, a, b) => !!pactOf(s, a, b, 'alliance');
export const alliesOf = (s, id) => s.pacts.filter(p => p.type.startsWith('alliance') && (p.a === id || p.b === id)).map(p => p.a === id ? p.b : p.a);
export const enemiesOf = (s, id) => s.wars.filter(w => w.a === id || w.b === id).map(w => w.a === id ? w.b : w.a);
export const neighbours = (s, id) => { const out = new Set(); for (const r of s.nations[id].regs) for (const o of ADJ[r]) { const ow = s.regions[o].owner; if (ow !== id) out.add(ow); } return [...out]; };
export const borderRegions = (s, atk, def) => { const out = []; for (const r of s.nations[def].regs) for (const o of ADJ[r]) if (s.regions[o].owner === atk) { out.push(r); break; } return out; };
export function income(s, n) {
  let inc = 0; for (const r of n.regs) { const g = s.regions[r]; inc += g.cities * g.ci * (1 + 0.1 * g.infra); }
  inc *= n.mods.income; const trade = s.pacts.filter(p => p.type === 'trade' && (p.a === n.id || p.b === n.id)).reduce((a, p) => { const o = s.nations[p.a === n.id ? p.b : p.a]; return a + 0.1 * Math.min(inc, baseInc(s, o)); }, 0);
  return { base: inc, trade, tribute: 0 };
}
const baseInc = (s, n) => n.regs.reduce((a, r) => a + s.regions[r].cities * s.regions[r].ci, 0) * n.mods.income;
export const upkeep = (s, n) => n.troops * 0.2 + n.regs.reduce((a, r) => a + s.regions[r].fact, 0);
export const netIncome = (s, n) => { const i = income(s, n); let net = i.base + i.trade - upkeep(s, n); if (n.overlord) net -= (i.base) * (n.vtype === 'puppet' ? 0.5 : 0.3); for (const v of s.pacts.length ? [] : []) net += 0; net += vassalTribute(s, n.id); return net; };
const vassalTribute = (s, id) => alive(s).filter(v => v.overlord === id).reduce((a, v) => a + income(s, v).base * (v.vtype === 'puppet' ? 0.5 : 0.3), 0);
export const factories = (s, n) => n.regs.reduce((a, r) => a + s.regions[r].fact, 0);
export const cities = (s, n) => n.regs.reduce((a, r) => a + s.regions[r].cities, 0);
export function log(s, text, tone = '') { s.log.unshift({ t: s.turn, text, tone }); if (s.log.length > 80) s.log.length = 80; }

// ---------------- reputation / betrayal ----------------
function betray(s, a, penalty, text) {
  const n = s.nations[a]; n.rep = Math.max(0, n.rep - penalty); for (const o of alive(s)) if (o.id !== a) addRel(s, o.id, a, -Math.round(penalty / 4));
  if (a === s.player) log(s, `Tu fama baja (${text}).`, 'bad');
}
export function breakPact(s, p, breaker) {
  s.pacts.splice(s.pacts.indexOf(p), 1); const other = p.a === breaker ? p.b : p.a, pen = p.type.startsWith('alliance') ? 30 : p.type === 'nap' ? 20 : 5;
  if (pen > 5) betray(s, breaker, pen, 'rompiste un tratado'); addRel(s, breaker, other, -pen * 1.5);
}

// ---------------- diplomacy ----------------
/** Returns {ok, msg}. AI acceptance depends on relations, reputation, personality and threat. */
export function evaluate(s, from, to, kind) {
  const a = s.nations[from], b = s.nations[to], P = persOf(b), r = rel(s, to, from), repAdj = (a.rep - 50) / 2;
  if (atWar(s, from, to)) return { ok: false, msg: '¡Estamos en batalla!' };
  if (b.overlord === from && kind !== 'release') return { ok: false, msg: 'Ya te obedece.' };
  const common = enemiesOf(s, from).filter(e => enemiesOf(s, to).includes(e)).length * 12;
  switch (kind) {
    case 'alliance-def': { const score = r + repAdj + common + P.coop * 20 - 25 - (b.pers === 'isolationist' ? 25 : 0) + Math.min(15, strength(a) / Math.max(1, strength(b)) * 4); return score >= 20 ? { ok: true } : { ok: false, msg: a.rep < 30 ? 'Tu fama es muy baja.' : r < 10 ? 'No confiamos aún en ti.' : 'Preferimos ir solos.' }; }
    case 'alliance-mil': { const score = r + repAdj + common + P.coop * 20 - 40 - (b.pers === 'isolationist' ? 30 : 0); return score >= 25 ? { ok: true } : { ok: false, msg: 'Una alianza militar necesita más confianza.' }; }
    case 'trade': { const score = r + P.trade * 25 + repAdj - 5; return score >= 10 ? { ok: true } : { ok: false, msg: 'Ahora no queremos comerciar.' }; }
    case 'nap': { const score = r + P.peace * 25 + repAdj - (b.pers === 'aggressive' ? 20 : 0); return score >= 10 ? { ok: true } : { ok: false, msg: 'Preferimos esperar.' }; }
    case 'vassal': { const ratio = strength(a) / Math.max(1, strength(b)); return ratio >= 3 && r > -35 ? { ok: true } : { ok: false, msg: ratio < 3 ? 'No necesitamos protección.' : 'No nos caes bien.' }; }
    default: return { ok: false, msg: '?' };
  }
}
export function sign(s, a, b, type) {
  const old = pactOf(s, a, b); if (old && (type.startsWith('alliance') ? old.type.startsWith('alliance') || old.type === 'nap' : old.type === type)) s.pacts.splice(s.pacts.indexOf(old), 1);
  if (type === 'vassal') { const n = s.nations[b]; n.overlord = a; n.vtype = 'vassal'; s.pacts = s.pacts.filter(p => !(p.a === b || p.b === b) || p.type === 'trade'); for (const e of enemiesOf(s, b)) endWar(s, b, e, true); log(s, `${n.name} ahora es protegido de ${s.nations[a].name}.`, 'good'); return; }
  s.pacts.push({ a, b, type, since: s.turn, until: type === 'nap' ? s.turn + 24 : null }); addRel(s, a, b, type === 'trade' ? 8 : 15);
  log(s, `${s.nations[a].name} y ${s.nations[b].name}: ${type === 'trade' ? 'acuerdo comercial' : type === 'nap' ? 'pacto de no agresión' : type === 'alliance-mil' ? 'alianza militar' : 'alianza defensiva'}.`, 'good');
}
export function propose(s, from, to, kind) {
  const r = evaluate(s, from, to, kind); if (r.ok) sign(s, from, to, kind === 'alliance-def' || kind === 'alliance-mil' || kind === 'trade' || kind === 'nap' || kind === 'vassal' ? kind : kind); else addRel(s, from, to, -1); return r;
}
export function makePuppet(s, id) { const n = s.nations[id]; n.vtype = 'puppet'; betray(s, n.overlord, 8, 'ayudaste a gobernar'); log(s, `${n.name} tiene un gobierno amigo.`); }
export function release(s, id) { const n = s.nations[id], o = n.overlord; n.overlord = null; n.vtype = null; addRel(s, id, o, 40); n.rep = Math.min(100, n.rep + 5); log(s, `${n.name} vuelve a ser libre.`, 'good'); }
export function requestAid(s, from, ally) {
  const a = s.nations[ally], n = s.nations[from]; if (s.aidCd > 0) return { ok: false, msg: `Tus amigos necesitan ${s.aidCd} meses más.` };
  const t = Math.max(1, Math.round(a.troops * 0.1)); a.troops -= t; n.troops += t; s.aidCd = 6; return { ok: true, msg: `¡${a.name} envió ${t}k soldados!` };
}
export function gift(s, from, to, amount) { const a = s.nations[from]; if (a.treasury < amount) return false; a.treasury -= amount; s.nations[to].treasury += amount; addRel(s, from, to, Math.min(25, amount / 4)); return true; }
export function buyEquipment(s, buyer, seller, qty = 10) {
  const b = s.nations[buyer], c = s.nations[seller], cost = qty * 3; if (!pactOf(s, buyer, seller, 'trade') && !isAllied(s, buyer, seller)) return { ok: false, msg: 'Necesitas un acuerdo comercial.' };
  if (b.treasury < cost) return { ok: false, msg: 'No tienes suficiente dinero.' }; if (c.equip < qty + 10) return { ok: false, msg: 'No les sobra equipo.' };
  b.treasury -= cost; c.treasury += cost; c.equip -= qty; b.equip += qty; addRel(s, buyer, seller, 1); return { ok: true, msg: `Compraste ${qty} de equipo por ${cost}.` };
}

// ---------------- war ----------------
export function declareWar(s, a, b) {
  if (atWar(s, a, b) || a === b) return { ok: false, msg: 'Ya estáis en batalla.' };
  const A = s.nations[a], B = s.nations[b]; if (A.overlord === b) return { ok: false, msg: 'No puedes atacar a quien te protege.' };
  const pact = pactOf(s, a, b); if (pact) breakPact(s, pact, a);
  if (!neighbours(s, a).includes(b) && !s.nations[a].regs.some(r => [...ADJ[r]].some(o => s.regions[o].owner === b)) && s.nations[a].regs.length) { /* distant war allowed; attacks still need borders */ }
  s.wars.push({ a, b, start: s.turn, sa: 0, sb: 0 }); sfxWar?.(); log(s, `¡${A.name} desafió a ${B.name} a una batalla!`, 'bad');
  for (const o of alive(s)) { if (o.id === a || o.id === b) continue; const pa = pactOf(s, o.id, a), pb = pactOf(s, o.id, b);
    if (o.overlord === b || (pb && pb.type.startsWith('alliance') && !pa)) join(s, o.id, a);
    else if (o.overlord === a || (pa && pa.type === 'alliance-mil' && rel(s, o.id, a) > 0)) join(s, o.id, b, true); }
  for (const v of alive(s)) if (v.overlord === a && !atWar(s, v.id, b)) s.wars.push({ a: v.id, b, start: s.turn, sa: 0, sb: 0 });
  return { ok: true };
}
let sfxWar = null; export const onWarSfx = f => { sfxWar = f; };
function join(s, ally, enemy, aggressorSide) {
  if (atWar(s, ally, enemy) || isAllied(s, ally, enemy)) return; s.wars.push({ a: ally, b: enemy, start: s.turn, sa: 0, sb: 0 }); log(s, `${s.nations[ally].name} ayuda en la batalla contra ${s.nations[enemy].name}.`, 'bad');
}
export function endWar(s, a, b, silent) { const w = warOf(s, a, b); if (w) s.wars.splice(s.wars.indexOf(w), 1); if (!silent) log(s, `¡Paz entre ${s.nations[a].name} y ${s.nations[b].name}!`, 'good'); }
export const warScore = (s, a, b) => { const w = warOf(s, a, b); if (!w) return 0; const mine = w.a === a ? w.sa : w.sb, theirs = w.a === a ? w.sb : w.sa; return mine * 15 - theirs * 15 + Math.round((strength(s.nations[a]) / Math.max(1, strength(s.nations[b])) - 1) * 10); };

/** Resolve one attack on a region. frac = share of the army committed. */
export function attack(s, atkId, regionId, frac = 0.5) {
  const A = s.nations[atkId], defId = s.regions[regionId].owner, D = s.nations[defId], res = { win: false };
  if (!atWar(s, atkId, defId)) return { ...res, msg: 'No estás en batalla con ese país.' };
  if (!borderRegions(s, atkId, defId).includes(regionId)) return { ...res, msg: 'Esa zona no toca tu frontera.' };
  if (A.atk <= 0) return { ...res, msg: 'Ya no te quedan ataques este mes.' };
  A.atk--; const reg = s.regions[regionId], force = A.troops * frac, aStr = force * (1 + 0.5 * Math.min(1, A.equip / Math.max(1, A.troops))) * (0.85 + Math.random() * 0.4);
  const allyHelp = alliesOf(s, defId).filter(x => atWar(s, x, atkId)).reduce((t, x) => t + strength(s.nations[x]) * 0.1, 0);
  const dStr = (strength(D) * 0.35 + allyHelp) * (1 + 0.12 * reg.infra) * (regionId === D.cap ? 1.6 : 1) * (0.85 + Math.random() * 0.4);
  const w = warOf(s, atkId, defId);
  if (aStr > dStr) {
    res.win = true; const lossA = Math.max(1, Math.round(force * Math.min(0.5, 0.12 + 0.3 * dStr / aStr))), lossD = Math.round(D.troops * (0.12 + 0.08 * Math.random()));
    A.troops = Math.max(1, A.troops - lossA); A.equip = Math.max(0, A.equip - Math.round(lossA * 0.5)); D.troops = Math.max(0, D.troops - lossD); D.equip = Math.max(0, D.equip - Math.round(lossD * 0.5));
    transfer(s, regionId, atkId); if (w) (w.a === atkId ? w.sa++ : w.sb++); res.msg = `¡${A.name} conquistó ${NAME(regionId)}!`; log(s, res.msg, atkId === s.player ? 'good' : defId === s.player ? 'bad' : '');
    for (const o of alive(s)) if (o.id !== atkId && o.id !== defId) addRel(s, o.id, atkId, -1);
  } else {
    const lossA = Math.round(force * (0.25 + 0.3 * Math.random())), lossD = Math.round(D.troops * 0.05); A.troops = Math.max(1, A.troops - lossA); A.equip = Math.max(0, A.equip - Math.round(lossA * 0.5)); D.troops = Math.max(0, D.troops - lossD);
    res.msg = `El ataque de ${A.name} a ${NAME(regionId)} fracasó (-${lossA}k).`; log(s, res.msg, atkId === s.player ? 'bad' : '');
  }
  return res;
}
export function transfer(s, rid, newOwner) {
  const old = s.nations[s.regions[rid].owner], nw = s.nations[newOwner]; old.regs = old.regs.filter(r => r !== rid); nw.regs.push(rid); s.regions[rid].owner = newOwner;
  if (!old.regs.length) kill(s, old.id, newOwner); else if (old.cap === rid) old.cap = old.regs.slice().sort((a, b) => s.regions[b].gdp - s.regions[a].gdp)[0];
}
function kill(s, id, by) {
  const n = s.nations[id]; n.alive = false; s.wars = s.wars.filter(w => w.a !== id && w.b !== id); s.pacts = s.pacts.filter(p => p.a !== id && p.b !== id);
  for (const v of alive(s)) if (v.overlord === id) { v.overlord = null; v.vtype = null; } log(s, `${n.name} se quedó sin territorio (lo tomó ${s.nations[by].name}).`, id === s.player ? 'bad' : '');
}

/** Peace negotiation. deal: 'white' | 'reparations' | 'vassal' | 'puppet' | 'concede' (proposer gives gold). */
export function desperation(s, ai, other) { const w = warOf(s, ai, other); const mine = s.nations[ai], o = s.nations[other]; const lost = w ? (w.a === ai ? w.sb : w.sa) : 0, won = w ? (w.a === ai ? w.sa : w.sb) : 0; return Math.max(0, Math.min(100, (strength(o) / Math.max(1, strength(mine)) - 1) * 30 + lost * 18 - won * 12 + (s.turn - (w?.start ?? s.turn)) * 2)); }
export function peaceDecision(s, proposer, target, deal) {
  const need = { white: 12, reparations: 30, vassal: 55, puppet: 75, concede: 5 }[deal], d = desperation(s, target, proposer);
  return d >= need ? { ok: true } : { ok: false, msg: d < 12 ? 'Aún queremos seguir.' : '¡Eso no nos gusta!' };
}
export function applyPeace(s, proposer, target, deal) {
  const P = s.nations[proposer], T = s.nations[target]; endWar(s, proposer, target);
  if (deal === 'reparations') { const g = Math.round(T.treasury * 0.4); T.treasury -= g; P.treasury += g; log(s, `${T.name} dio ${g} de regalo de paz.`); }
  if (deal === 'vassal' || deal === 'puppet') { sign(s, proposer, target, 'vassal'); if (deal === 'puppet') T.vtype = 'puppet'; }
  if (deal === 'concede') { const g = Math.min(P.treasury, 60); P.treasury -= g; T.treasury += g; }
  if (proposer === s.player || target === s.player) { s.nations[s.player].rep = Math.min(100, s.nations[s.player].rep + 2); if (proposer === s.player || target === s.player) { const winner = deal === 'white' ? null : proposer; } }
  addRel(s, proposer, target, 10);
}

// ---------------- economy actions ----------------
export const costs = { city: r => 60 + 25 * r.cities, factory: r => 80 + 40 * r.fact, infra: r => 50 + 40 * r.infra };
export function build(s, nid, rid, what) {
  const n = s.nations[nid], r = s.regions[rid]; if (r.owner !== nid) return { ok: false, msg: 'No es tu zona.' }; const c = costs[what](r);
  if (what === 'infra' && r.infra >= 5) return { ok: false, msg: 'Caminos al máximo.' }; if (what === 'city' && r.cities >= 12) return { ok: false, msg: 'Ya no caben más ciudades.' };
  if (n.treasury < c) return { ok: false, msg: `Necesitas ${c} de dinero.` }; n.treasury -= c; if (what === 'city') r.cities++; else if (what === 'factory') r.fact++; else r.infra++;
  return { ok: true, msg: `Construiste ${({city:'ciudad',factory:'fábrica',infra:'caminos'})[what]} en ${NAME(rid)} (-${c}).` };
}
export function recruit(s, nid) {
  const n = s.nations[nid], step = Math.max(2, Math.round(n.troops * 0.1)), cg = Math.round(step * 1.5), ce = Math.round(step * 0.5);
  if (n.treasury < cg) return { ok: false, msg: `Necesitas ${cg} de dinero.` }; if (n.equip < ce) return { ok: false, msg: `Necesitas ${ce} de equipo (¡construye fábricas!).` };
  n.treasury -= cg; n.equip -= ce; n.troops += Math.round(step * (n.mods.troops > 1 ? 1.15 : 1)); return { ok: true, msg: `Reclutaste ${step}k soldados.` };
}

// ---------------- turn processing & AI ----------------
export function endTurn(s) {
  s.turn++; s.aidCd = Math.max(0, s.aidCd - 1);
  for (const n of alive(s)) {
    const inc = income(s, n); let net = inc.base + inc.trade - upkeep(s, n);
    if (n.overlord) { const t = inc.base * (n.vtype === 'puppet' ? 0.5 : 0.3); net -= t; s.nations[n.overlord].treasury += t; }
    n.treasury += net; n.factoryBank = 0; n.equip += Math.round(factories(s, n) * 3 * n.mods.equipment);
    if (n.treasury < 0) { n.troops = Math.round(n.troops * 0.9); n.treasury = 0; if (n.id === s.player) log(s, '¡Los soldados se van porque no hay dinero!', 'bad'); }
    const cap = Math.max(3, Math.min(popOf(s, n) * 1.5, gdpOf(s, n) / 10) * n.mods.troops); if (n.troops < cap * 0.5) n.troops += Math.ceil(n.troops * 0.015);
    n.rep += n.rep < 60 ? 0.5 : -0.2; n.atk = 2 + Math.min(3, Math.floor(factories(s, n) / 4));
    for (const a of alliesOf(s, n.id)) addRel(s, n.id, a, 0.5);
  }
  s.pacts = s.pacts.filter(p => { if (p.until && s.turn >= p.until) { log(s, `Terminó el pacto entre ${s.nations[p.a].name} y ${s.nations[p.b].name}.`); return false; } return true; });
  for (const n of alive(s)) if (n.id !== s.player && n.alive) aiTurn(s, n);
  s.proposals = s.proposals.filter(p => s.turn - p.turn < 6 && s.nations[p.from].alive);
  checkEnd(s);
}

function bestTarget(s, n) {
  let best = null;
  for (const e of enemiesOf(s, n.id)) { const E = s.nations[e]; for (const r of borderRegions(s, n.id, e)) { const sc = s.regions[r].gdp / 50 + (r === E.cap ? -3 : 0) + (r === E.cap ? 0 : 1); if (!best || sc > best.sc) best = { r, sc, e }; } }
  return best;
}
function aiTurn(s, n) {
  const P = persOf(n), at = enemiesOf(s, n.id), me = strength(n);
  // economy
  const up = upkeep(s, n);
  if (n.treasury > up * 6 + 30 && n.equip > 4) recruit(s, n.id);
  if (n.treasury > 200 && Math.random() < 0.2) { const rid = n.regs[Math.floor(Math.random() * n.regs.length)]; build(s, n.id, rid, Math.random() < P.aggr ? 'factory' : Math.random() < 0.5 ? 'city' : 'infra'); }
  if (n.overlord) { const o = s.nations[n.overlord]; for (const e of enemiesOf(s, n.overlord)) if (!atWar(s, n.id, e)) s.wars.push({ a: n.id, b: e, start: s.turn, sa: 0, sb: 0 }); if (strength(o) < me * 0.5 && Math.random() < 0.05) { release(s, n.id); log(s, `¡${n.name} volvió a ser libre!`); } }
  // fight
  for (const e of at) { const best = Math.random() < 0.55 ? bestTarget(s, n) : null; if (best && n.atk > 0 && strength(s.nations[best.e]) * 0.35 < me * 0.5 + 1) { attack(s, n.id, best.r, 0.5); if (n.atk > 0 && Math.random() < 0.5) { const b2 = bestTarget(s, n); if (b2) attack(s, n.id, b2.r, 0.4); } } break; }
  for (const e of at) { const w = warOf(s, n.id, e); if (!w) continue; const d = desperation(s, n.id, e); const E = s.nations[e];
    if (d >= 30 && Math.random() < 0.4) { if (e === s.player) { if (!s.proposals.some(p => p.from === n.id && p.kind === 'peace')) s.proposals.push({ from: n.id, kind: 'peace', deal: 'white', turn: s.turn }); } else if (peaceDecision(s, n.id, e, 'white').ok) applyPeace(s, n.id, e, 'white'); }
    else if (d < 5 && strength(E) < me * 0.6 && w.sa + w.sb > 0 && Math.random() < 0.25) { const deal = strength(E) < me * 0.3 ? 'puppet' : 'reparations'; if (e === s.player) { if (!s.proposals.some(p => p.from === n.id && p.kind === 'peace')) s.proposals.push({ from: n.id, kind: 'peace', deal, turn: s.turn, demand: true }); } else if (peaceDecision(s, n.id, e, deal).ok) applyPeace(s, n.id, e, deal); } }
  if (n.overlord) return;
  // diplomacy
  if (Math.random() < 0.12) {
    const pool = neighbours(s, n.id).concat(alive(s).filter(() => Math.random() < 0.03).map(x => x.id)).filter(x => x !== n.id && s.nations[x]?.alive && !atWar(s, n.id, x)); const m = pool[Math.floor(Math.random() * pool.length)];
    if (m) { const r = rel(s, n.id, m), has = pactOf(s, n.id, m);
      const kind = !has && r > 35 && Math.random() < P.coop ? 'alliance-def' : !has && r > 10 && Math.random() < P.trade ? 'trade' : !has && r >= 0 && Math.random() < P.peace * 0.5 ? 'nap' : has?.type === 'nap' && r > 40 ? 'alliance-def' : null;
      if (kind) { if (m === s.player) { if (!s.proposals.some(p => p.from === n.id && p.kind === kind)) s.proposals.push({ from: n.id, kind, turn: s.turn }); } else if (evaluate(s, n.id, m, kind).ok && !s.nations[m].overlord) sign(s, n.id, m, kind); } }
  }
  // aggression
  if (at.length < 2 && Math.random() < 0.005 * P.aggr && n.treasury > up * 3 && s.turn > 12) {
    const need = 3.0 - P.aggr * 0.9; let pick = null;
    for (const m of neighbours(s, n.id)) { const M = s.nations[m]; if (!M.alive || isAllied(s, n.id, m) || M.overlord === n.id || n.overlord) continue; const ally = alliesOf(s, m).reduce((t, x) => t + strength(s.nations[x]) * 0.5, 0); const ratio = me / Math.max(1, strength(M) + ally); if (ratio > need && rel(s, n.id, m) < 30 && (!pick || ratio > pick.ratio)) pick = { m, ratio }; }
    if (pick) declareWar(s, n.id, pick.m);
  }
}

function checkEnd(s) {
  const p = s.nations[s.player]; if (!p.alive || !p.regs.length) { s.over = 'lose'; return; }
  const total = IDS.reduce((a, r) => a + REG[r].area, 0), mine = alive(s).filter(n => n.id === s.player || chain(s, n.id) === s.player).reduce((a, n) => a + areaOf(n), 0);
  if (mine / total >= 0.5 || alive(s).filter(n => n.id !== s.player && chain(s, n.id) !== s.player).length === 0) s.over = 'win';
}
const chain = (s, id) => { let n = s.nations[id], d = 0; while (n.overlord && d++ < 5) n = s.nations[n.overlord]; return n.id; };
export const empireShare = s => { const total = IDS.reduce((a, r) => a + REG[r].area, 0); return alive(s).filter(n => n.id === s.player || chain(s, n.id) === s.player).reduce((a, n) => a + areaOf(n), 0) / total; };
export function startPlayerTurn(s) { s.nations[s.player].atk = 2 + Math.min(3, Math.floor(factories(s, s.nations[s.player]) / 4)); }

import * as SIM from './sim.js';

/** State replication for multiplayer: the host simulates, guests receive per-key deltas. */
const rnd = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v;

export const freshState = () => ({ v: 2, t: 0, acc: 0, player: null, humans: [], regions: {}, nations: {}, wars: [], pacts: [], orders: [], strikes: [], inbox: [], log: [], space: {}, over: null, nid: 1, empFormed: {} });

/** Keys: g (clock/globals) w (wars+pacts) o (armies/strikes/inbox) r<id> (region) n<id> (nation) l<id> (relations). */
export function buildDelta(s, sent, { full = false, slow = false } = {}) {
  const d = {};
  const put = (k, v) => { const str = JSON.stringify(v, rnd); if (full) d[k] = JSON.parse(str); else if (sent.get(k) !== str) { sent.set(k, str); d[k] = JSON.parse(str); } };
  put('g', { t: s.t, over: s.over, nid: s.nid, empFormed: s.empFormed, humans: s.humans, space: s.space });
  // Wars and pacts between bots are huge and irrelevant to guests: only those involving a human are replicated.
  const hs = new Set(s.humans ?? []), mine = x => hs.has(x.a) || hs.has(x.b);
  put('w', { wars: s.wars.filter(mine), pacts: s.pacts.filter(mine) });
  put('o', { orders: s.orders, strikes: s.strikes, inbox: s.inbox });
  for (const id of SIM.IDS) put('r' + id, s.regions[id]);
  // Nations that matter to humans are sent every time; the rest only on "slow" syncs (saves bandwidth).
  const fast = new Set(s.humans ?? []);
  for (const h of [...fast]) { if (!s.nations[h]) continue; for (const x of [...SIM.enemiesOf(s, h), ...SIM.alliesOf(s, h), ...SIM.puppetsOf(s, h).map(v => v.id)]) fast.add(x); }
  for (const n of Object.values(s.nations)) {
    if (!full && !slow && !fast.has(n.id)) continue;
    const { rel, truce, ...core } = n; put('n' + n.id, core); put('l' + n.id, { rel, truce });
  }
  return d;
}

export function applyDelta(s, d) {
  const dirty = []; let rel = false; const keys = Object.keys(d);
  for (const k of keys) {
    const v = d[k], id = k.slice(1);
    if (k === 'g' || k === 'o') Object.assign(s, v);
    else if (k === 'w') { Object.assign(s, v); rel = true; }
    else if (k[0] === 'r') { s.regions[id] = v; dirty.push(id); }
    else if (k[0] === 'n') { const old = s.nations[id]; if (old && (old.overlord !== v.overlord || old.alive !== v.alive || old.bot !== v.bot)) rel = true; s.nations[id] = { rel: old?.rel ?? {}, truce: old?.truce ?? {}, ...v }; }
  }
  for (const k of keys) if (k[0] === 'l' && s.nations[k.slice(1)]) { const n = s.nations[k.slice(1)]; n.rel = d[k].rel; n.truce = d[k].truce; }
  return { dirty, rel };
}

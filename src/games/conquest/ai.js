import * as S from './sim.js';
import { STRUCTS, structCost, TECHS, WEAPONS, SPACE, SUPERPOWERS } from '../../data/conquestData.js';

/**
 * Bots. Each bot "thinks" about once every 6 game days (staggered). They expand, build, recruit,
 * research, make treaties, declare wars, send armies and fleets, fire missiles, ask for peace,
 * unlock superpowers and race to the Moon.
 */
const rnd = Math.random;
const TECH_ORDER = {
  aggressive: ['mil1', 'ind1', 'mil2', 'navy1', 'air', 'rocket', 'mil3', 'ind2', 'nuclear', 'navy2', 'ind3', 'space1', 'space2', 'space3'],
  merchant: ['ind1', 'ind2', 'rocket', 'space1', 'ind3', 'mil1', 'space2', 'space3', 'mil2', 'air', 'navy1', 'nuclear', 'mil3', 'navy2'],
  default: ['ind1', 'mil1', 'ind2', 'rocket', 'mil2', 'space1', 'navy1', 'air', 'ind3', 'space2', 'mil3', 'space3', 'nuclear', 'navy2']
};

function think(s, n) {
  if (!n.alive || s.over) return;
  const P = S.persOf(n), year = 1945 + Math.floor(s.t / 365), e = S.econ(s, n), enemies = S.enemiesOf(s, n.id);

  // research
  if (!n.research) { const order = TECH_ORDER[n.pers] ?? TECH_ORDER.default; const next = order.find(t => S.canResearch(n, t) && (!t.startsWith('space') || year >= 1953)); if (next) S.startResearch(s, n.id, next); }

  // superpower
  if (S.spDef(n) && !n.sp && n.money > SUPERPOWERS[n.spId].cost * 1.4) S.unlockSP(s, n.id);
  if (n.sp?.on && n.sp.cd <= 0 && enemies.length && rnd() < 0.3) S.useSP(s, n.id);

  // economy: build the best thing we can afford
  const wantCity = n.regs.length ? n.regs.slice().sort((a, b) => S.REG[b].area - S.REG[a].area) : [];
  if (n.money > 140) {
    const r = n.regs[Math.floor(rnd() * n.regs.length)], g = s.regions[r];
    const cities = S.count(s, n, 'city'), facts = S.count(s, n, 'fact');
    const options = [];
    if (g.city < STRUCTS.city.max && cities < facts * 2.2 + 4) options.push('city');
    if (g.fact < STRUCTS.factory.max) options.push('factory');
    if (S.isCoastal(r) && !g.port && n.pers !== 'isolationist' && n.money > 260) options.push('port');
    if (enemies.length && g.base < 2 && n.money > 320) options.push('base');
    if (S.hasTech(n, 'space1') && !g.space && !n.regs.some(x => s.regions[x].space) && n.money > 900 && (n.pers === 'merchant' || S.gdpOf(s, n) > 1500)) options.push('space');
    if (options.length) S.build(s, n.id, r, options[Math.floor(rnd() * options.length)]);
  }
  // recruit
  const cap = S.troopCap(s, n), want = enemies.length ? 0.95 : 0.6;
  if (n.troops + S.marching(s, n) < cap * want && n.money > 80) S.recruit(s, n.id, Math.max(2, Math.round(cap * 0.08)));
  if (enemies.length && n.regs.some(r => s.regions[r].port) && n.ships < 3 + n.regs.length) S.buildShip(s, n.id, 1);

  // expansion into unclaimed land
  if (n.money > 120) for (const rid of S.IDS) if (!s.regions[rid].owner && S.reach(s, n.id, rid) && rnd() < 0.5) { S.expand(s, n.id, rid); break; }

  // space race
  if ((S.hasTech(n, 'space1') || s.space[n.id]) && year >= 1954) { const sp = S.spaceOf(s, n.id); const st = SPACE[sp.i]; if (st && !st.auto && !st.struct && sp.left === null) S.startSpace(s, n.id); }

  // peace
  for (const eId of enemies) {
    const E = s.nations[eId]; if (!E?.alive) continue; const d = S.desperation(s, n.id, eId);
    if (S.isHuman(s, E.id)) {
      if (d > 28 && rnd() < 0.25) S.addProposal(s, { from: n.id, to: E.id, kind: 'peace', deal: d > 55 ? 'concede' : 'white' });
      else if (S.desperation(s, E.id, n.id) > 40 && rnd() < 0.2) S.addProposal(s, { from: n.id, to: E.id, kind: 'peace', deal: rnd() < 0.5 ? 'reparations' : 'cede1', demand: true });
    } else if (d > 30 && rnd() < 0.3 && S.peaceDecision(s, n.id, eId, 'white').ok) S.applyPeace(s, n.id, eId, 'white');
  }

  // fire weapons at enemies
  for (const eId of enemies) { const E = s.nations[eId]; if (!E?.alive) continue; for (const w of ['nuke', 'bomb', 'missile']) { if (!n.arms[w]) continue; const targets = E.regs.slice().sort((a, b) => (s.regions[b].space ? 5 : 0) + s.regions[b].fact - (s.regions[a].space ? 5 : 0) - s.regions[a].fact); const t = targets.find(r => S.strikeSource(s, n.id, w, r)); if (t && (w !== 'nuke' || n.pers === 'aggressive' && rnd() < 0.2)) { S.launch(s, n.id, w, t); break; } } }
  for (const w of ['missile', 'bomb']) if (enemies.length && S.hasTech(n, WEAPONS[w].tech) && n.arms[w] < 3 && n.money > 300) S.buyWeapon(s, n.id, w);

  // attacks on current enemies
  const free = n.troops;
  for (const eId of enemies) {
    const E = s.nations[eId]; if (!E?.alive || free < 3) continue;
    const targets = E.regs.map(r => ({ r, reach: S.reach(s, n.id, r) })).filter(x => x.reach);
    if (!targets.length) continue; targets.sort((a, b) => (a.r === E.cap ? 1 : 0) - (b.r === E.cap ? 1 : 0) || a.reach.dist - b.reach.dist);
    const t = targets[0], sh = Math.max(0.1, Math.min(1, 2.2 / Math.pow(E.regs.length, 0.7)));
    const est = S.strength(E) * sh * (E.regs.length === 1 ? 1.35 : 1) * (t.r === E.cap ? 1.5 : 1) * (1 + 0.12 * s.regions[t.r].infra) * (1 + 0.2 * s.regions[t.r].base) * (t.reach.kind === 'sea' ? 1.3 : 1);
    const f = est * 1.5 / Math.max(1, S.strength(n) * (t.reach.kind === 'sea' ? 0.8 : 1));
    if (f <= 0.9 && rnd() < 0.4) S.sendArmy(s, n.id, t.r, Math.max(0.15, f));
  }

  // diplomacy
  if (!n.overlord && rnd() < 0.25) {
    const pool = [...S.neighbours(s, n.id), ...S.alive(s).filter(() => rnd() < 0.03).map(x => x.id)].filter(id => id !== n.id && s.nations[id].alive);
    const o = pool[Math.floor(rnd() * pool.length)];
    if (o && !S.atWar(s, n.id, o)) {
      const O = s.nations[o], r = S.rel(s, n.id, o);
      if (r > -10) {
        const type = !S.pactOf(s, n.id, o, 'embassy') ? 'embassy' : (!S.pactOf(s, n.id, o, 'trade') && P.trade > 0.3) ? 'trade' : (!S.pactOf(s, n.id, o, 'coop') && P.coop > 0.4) ? 'coop' : (!S.pactOf(s, n.id, o, 'alliance') && r > 25 && P.coop > 0.25) ? 'alliance' : null;
        if (type) { if (S.isHuman(s, o)) S.addProposal(s, { from: n.id, to: o, kind: type }); else if (S.evaluate(s, n.id, o, type).ok) S.sign(s, n.id, o, type); }
      }
    }
  }

  // war: pick a weaker neighbour (or sea target)
  if (!n.overlord && enemies.length < 2 && s.t > 150 && s.wars.length < 4 + S.alive(s).length / 18 && rnd() < (0.002 + P.aggr * 0.009) / (1 + n.regs.length / 3)) {
    const cands = S.neighbours(s, n.id).map(id => s.nations[id]).filter(o => o.alive && S.canDeclare(s, n.id, o.id).ok && S.strength(n) > S.strength(o) * (2.6 - P.aggr * 0.7) && (!S.isHuman(s, o.id) || s.t > 540));
    const t = cands.sort((a, b) => (S.rel(s, n.id, a.id)) - S.rel(s, n.id, b.id))[0];
    if (t && S.rel(s, n.id, t.id) < 15 + P.aggr * 20) S.declareWar(s, n.id, t.id);
  }
  // puppets: strong nations protect weak ones; annex old puppets
  if (!n.overlord && P.aggr > 0.5 && rnd() < 0.01) { const w = S.neighbours(s, n.id).map(id => s.nations[id]).find(o => !o.overlord && !S.isHuman(s, o.id) && S.strength(n) > S.strength(o) * 4 && !S.atWar(s, n.id, o.id)); if (w) S.offerPuppet(s, n.id, w.id); }
  for (const v of S.puppetsOf(s, n.id)) if (s.t - v.since > 400 && rnd() < 0.05 && !S.isHuman(s, v.id)) S.annex(s, n.id, v.id);
}
S.setAI(think);
export default think;

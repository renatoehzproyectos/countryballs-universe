import meta from '../../data/countryMeta.json';
import { store } from '../../core/store.js';
import { sfx } from '../../core/audio.js';
import { h, ui, fmt, ballAvatar, modal, confirmBox, toast } from '../../ui/dom.js';
import { createMapView } from '../../ui/mapview.js';
import { addCoins, addProfileXp, checkAchievements } from '../../core/economy.js';
import { EMPIRES, EMPIRE_REQ } from '../../data/empires.js';
import * as S from './sim.js';

const PERS_ICON = { aggressive: '🔥', opportunist: '🦊', diplomatic: '🕊️', merchant: '💰', isolationist: '🏝️' };
const KIND = { 'alliance-def': 'Defensive alliance', 'alliance-mil': 'Military alliance', trade: 'Trade agreement', nap: 'Non-aggression pact', vassal: 'Vassalage', peace: 'Peace' };

/** Game Two — World Conquest. UI layer over sim.js; the campaign is autosaved in the shared profile. */
export default class Conquest {
  constructor(manager) { this.manager = manager; this.s = null; this.sel = null; }

  async mount({ exit }) {
    this.exit = exit; S.onWarSfx(() => sfx.war());
    this.root = h('div', { style: { position: 'fixed', inset: 0, zIndex: 2, background: '#0a3a6b' } });
    this.map = createMapView({ onTap: id => this.#tap(id) }); this.map.el.style.position = 'absolute'; this.root.append(this.map.el);
    this.hud = h('div'); this.sheet = h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '52vh', overflow: 'auto', background: 'var(--panel)', borderRadius: '18px 18px 0 0', padding: '12px 14px calc(14px + env(safe-area-inset-bottom))', boxShadow: '0 -6px 30px #000a', display: 'none', touchAction: 'pan-y' } });
    this.root.append(this.hud, this.sheet); ui().append(this.root);
    this.back = h('button.btn.back', { style: { zIndex: 6 }, onclick: () => { store.save(); this.exit(); } }, '🏠'); ui().append(this.back);
    const saved = store.state.conquest.campaign; if (saved) { this.#menu(); } else this.#setup();
  }
  unmount() { store.save(); this.root?.remove(); this.back?.remove(); }

  // ------------------------------------------------------------ setup
  #menu() {
    const c = store.state.conquest.campaign, pn = c.nations[c.player];
    this.setupState = S.newCampaign('PL'); this.#paintAll(this.setupState, true);
    const m = modal('🗺️ World Conquest', [h('p.mute', 'A campaign is in progress.'), h('div.row', { style: { marginBottom: '10px' } }, ballAvatar(pn.flag, 50), h('div', h('b', pn.name), h('div.mute', `Month ${c.turn} · ${pn.regs.length} regions`))),
      h('button.btn.green', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { this.s = c; m.close(); this.#play(); } }, '▶ Continue campaign'),
      h('button.btn.red', { style: { width: '100%' }, onclick: () => confirmBox('Abandon campaign?', 'Your current campaign will be lost.', () => { store.mutate(st => { st.conquest.campaign = null; }); m.close(); }) }, 'New campaign')], { onClose: () => { if (!this.s) this.#setup(); } });
  }

  #setup() {
    this.s = null; this.setupState = S.newCampaign('PL'); this.#paintAll(this.setupState, true);
    const own = store.state.ownedEmpires;
    this.hud.replaceChildren(h('div.hud-top', { style: { left: '64px' } }, h('div.chip', '🗺️ Choose your nation — tap any country')),
      h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 8px calc(8px + env(safe-area-inset-bottom))', background: 'linear-gradient(transparent,#000a)', display: this.sel ? 'none' : 'block' }, },
        h('div.mute', { style: { fontSize: '12px', margin: '0 4px 4px' } }, '👑 Historical empires'),
        h('div', { style: { display: 'flex', gap: '8px', overflowX: 'auto', touchAction: 'pan-x' } }, Object.values(EMPIRES).map(e => { const ok = own.includes(e.id);
          return h('button.card', { style: { minWidth: '112px', color: 'inherit', opacity: ok ? 1 : 0.6, cursor: 'pointer' }, onclick: () => ok ? this.#empireInfo(e) : toast('🔒 ' + EMPIRE_REQ[e.id] + ' (Guess the Flag)', 'bad') }, ballAvatar(e.flag, 40, !ok), h('div.nm', e.name), h('div.mute', { style: { fontSize: '10px' } }, ok ? 'Unlocked' : '🔒 Locked')); }))));
    this.setupMode = true;
  }
  #empireInfo(e) {
    const m = modal(e.name, h('div', h('div.center', ballAvatar(e.flag, 90)), h('p', e.blurb), h('div.kv', h('span.mute', 'Starting regions'), h('b', e.regions.length), h('span.mute', 'Income'), h('b', '×' + e.mods.income), h('span.mute', 'Army'), h('b', '×' + e.mods.troops), h('span.mute', 'Equipment'), h('b', '×' + e.mods.equipment)),
      h('div', { style: { height: '10px' } }), h('button.btn.gold', { style: { width: '100%' }, onclick: () => { m.close(); this.#begin(e.id); } }, `Play as ${e.name}`)));
  }
  #begin(id) { this.s = S.newCampaign(id); S.startPlayerTurn(this.s); store.mutate(st => { st.conquest.campaign = this.s; }); this.sel = null; this.setupMode = false; this.#play(); this.map.focus(this.s.nations[id].cap, 0.35); }

  // ------------------------------------------------------------ play
  #play() { this.setupMode = false; this.sel = null; this.sheet.style.display = 'none'; S.startPlayerTurn(this.s); this.#buildHud(); this.#paintAll(this.s); this.map.focus(this.s.nations[this.s.player].cap, 0.35); }
  get me() { return this.s.nations[this.s.player]; }

  #buildHud() {
    this.elStats = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }); this.badge = h('span', { style: { background: '#ff4d4d', borderRadius: '9px', padding: '0 6px', marginLeft: '4px', fontSize: '11px' } });
    this.endBtn = h('button.btn.gold', { style: { position: 'absolute', right: '12px', bottom: 'calc(14px + env(safe-area-inset-bottom))', fontSize: '18px', padding: '14px 20px', zIndex: 4 }, onclick: () => this.#endTurn() }, '⏭ End Turn');
    this.hud.replaceChildren(h('div.hud-top', { style: { left: '64px', alignItems: 'flex-start' } }, this.elStats, h('div.grow'), h('div', { style: { display: 'grid', gap: '6px' } },
      h('button.btn.sm', { onclick: () => this.#inbox() }, '🔔', this.badge), h('button.btn.sm', { onclick: () => this.#logModal() }, '📜'), h('button.btn.sm', { onclick: () => this.#menuModal() }, '☰'))), this.endBtn);
    this.#refreshHud();
  }
  #refreshHud() {
    const s = this.s, n = this.me, net = S.netIncome(s, n); if (!this.elStats) return;
    this.elStats.replaceChildren(...[`📅 Month ${s.turn}`, `🪙 ${fmt(n.treasury)} (${net >= 0 ? '+' : ''}${fmt(net)})`, `🪖 ${fmt(n.troops)}k`, `⚙️ ${fmt(n.equip)}`, `🌍 ${(S.empireShare(s) * 100).toFixed(1)}%`, `⚔ ${n.atk}`].map(t => h('span.chip', { style: { padding: '3px 9px', fontSize: '13px', color: t.startsWith('🪙') && net < 0 ? 'var(--bad)' : '' } }, t)));
    this.badge.textContent = s.proposals.length || ''; this.badge.style.display = s.proposals.length ? 'inline' : 'none';
  }

  #paintAll(s, plain) {
    this.paintState = s; const me = s.nations[s.player];
    for (const id of S.IDS) {
      const o = s.nations[s.regions[id].owner]; let stroke = '#0b2a1a', w = 0.35, fill = S.colorOf(o);
      if (!plain) { if (o.id === s.player) { stroke = '#fff'; w = 0.9; } else if (S.atWar(s, s.player, o.id)) { stroke = '#ff3b3b'; w = 1.2; } else if (S.isAllied(s, s.player, o.id)) { stroke = '#3ddc84'; w = 1; } else if (o.overlord === s.player) { stroke = '#ffc933'; w = 1; } else if (S.pactOf(s, s.player, o.id, 'trade')) { stroke = '#4aa3ff'; w = 0.8; } }
      if (this.sel === id) { stroke = '#ffc933'; w = 1.8; }
      this.map.fill(id, fill); this.map.stroke(id, stroke, w);
    }
    if (this.sel) this.map.paths[this.sel]?.parentNode.append(this.map.paths[this.sel]);
  }
  #flash(id, txt) { const r = S.REG[id]; const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('x', r.cx); t.setAttribute('y', r.cy); t.setAttribute('font-size', 10); t.setAttribute('text-anchor', 'middle'); t.textContent = txt; this.map.overlay.append(t); setTimeout(() => t.remove(), 1200); }

  #tap(id) { sfx.click(); this.sel = id; this.#paintAll(this.s ?? this.setupState, !this.s); this.#showRegion(id); }

  #showRegion(id) {
    const s = this.s ?? this.setupState, reg = s.regions[id], n = s.nations[reg.owner], play = !!this.s, me = play ? this.me : null;
    const m = meta[n.cap] ?? meta[id], pop = S.popOf(s, n), gdp = S.gdpOf(s, n), r = play && n.id !== me.id ? S.rel(s, me.id, n.id) : 0;
    const chips = [];
    if (play && n.id !== me.id) { if (S.atWar(s, me.id, n.id)) chips.push('⚔ At war'); if (S.isAllied(s, me.id, n.id)) chips.push('🤝 Allied'); if (S.pactOf(s, me.id, n.id, 'trade')) chips.push('💱 Trade'); if (S.pactOf(s, me.id, n.id, 'nap')) chips.push('🕊 NAP'); if (n.overlord === me.id) chips.push(n.vtype === 'puppet' ? '🎭 Puppet' : '👑 Vassal'); if (n.overlord && n.overlord !== me.id) chips.push('Vassal of ' + s.nations[n.overlord].name); }
    const body = [h('div.row', ballAvatar(n.flag, 54), h('div.grow', h('div', { style: { fontSize: '18px', fontWeight: 800 } }, n.name), h('div.mute', { style: { fontSize: '12px' } }, `Capital ${meta[n.cap]?.cap ?? '—'}${reg.owner !== id ? ` · tapped ${S.NAME(id)}` : ''}`)), h('button.btn.sm', { onclick: () => { this.sel = null; this.sheet.style.display = 'none'; this.#paintAll(s, !play); } }, '✕')),
      chips.length ? h('div.pill-list', { style: { margin: '6px 0' } }, chips.map(c => h('span.chip', { style: { padding: '2px 9px', fontSize: '12px' } }, c))) : null,
      h('div.kv', { style: { fontSize: '13px', margin: '8px 0' } }, ...Object.entries({ 'Population': pop.toFixed(1) + 'M', 'Economy (GDP)': '$' + fmt(gdp) + 'B', 'Military': `${fmt(n.troops)}k troops · ⚙${fmt(n.equip)}`, 'Strength': fmt(S.strength(n)), 'Territory': `${n.regs.length} regions · ${S.cities(s, n)} cities · ${S.factories(s, n)} factories`, 'Treasury': play && n.id !== me.id ? '≈' + fmt(Math.round(n.treasury / 10) * 10) : fmt(n.treasury), 'Income': (S.netIncome(s, n) >= 0 ? '+' : '') + fmt(S.netIncome(s, n)) + '/mo', ...(play && n.id !== me.id ? { 'Personality': `${PERS_ICON[n.pers]} ${S.persOf(n).label}`, 'Relations': `${r > 0 ? '+' : ''}${r}`, 'Reputation': Math.round(n.rep) } : {}) }).flatMap(([k, v]) => [h('span.mute', k), h('b', v)]))];
    if (!play) { body.push(h('button.btn.gold', { style: { width: '100%' }, onclick: () => this.#begin(reg.owner) }, `▶ Play as ${n.name}`)); }
    else if (n.id === me.id) body.push(...this.#ownActions(id));
    else body.push(...this.#diplomacy(n, id));
    this.sheet.replaceChildren(...body); this.sheet.style.display = 'block';
  }

  #act(fn) { const out = fn(this.s); if (out?.msg) toast(out.msg, out.ok === false ? 'bad' : 'good'); store.mutate(() => {}); this.#paintAll(this.s); this.#refreshHud(); if (this.sel) this.#showRegion(this.sel); this.#checkOver(); return out; }
  #btn(label, fn, cls = '', disabled = false) { return h('button.btn.sm' + cls, { disabled, onclick: () => { sfx.click(); fn(); } }, label); }
  #group(title, ...kids) { return h('div', { style: { marginTop: '10px' } }, h('div.mute', { style: { fontSize: '12px', marginBottom: '4px' } }, title), h('div.row.wrap', kids.filter(Boolean))); }

  #ownActions(id) {
    const s = this.s, r = s.regions[id], n = this.me, step = Math.max(2, Math.round(n.troops * 0.1));
    return [this.#group(`🏗 Develop ${S.NAME(id)}`, this.#btn(`🏙 City (${S.costs.city(r)})`, () => this.#act(s => S.build(s, n.id, id, 'city'))), this.#btn(`🏭 Factory (${S.costs.factory(r)})`, () => this.#act(s => S.build(s, n.id, id, 'factory'))), this.#btn(`🛣 Infra ${r.infra}/5 (${S.costs.infra(r)})`, () => this.#act(s => S.build(s, n.id, id, 'infra')))),
      h('div.mute', { style: { fontSize: '11px', margin: '4px 0' } }, `${r.cities} cities · ${r.fact} factories · cities give income, factories make equipment, armies cost upkeep.`),
      this.#group('🪖 Military', this.#btn(`Recruit +${step}k (${Math.round(step * 1.5)}🪙 ${Math.round(step * 0.5)}⚙)`, () => this.#act(s => S.recruit(s, n.id)), '.green')),
      S.alive(s).some(v => v.overlord === n.id) ? this.#group('👑 Dependents', ...S.alive(s).filter(v => v.overlord === n.id).map(v => this.#btn(v.name, () => this.#tap(v.regs[0])))) : null];
  }

  #diplomacy(n, rid) {
    const s = this.s, me = this.me, war = S.atWar(s, me.id, n.id), ally = S.pactOf(s, me.id, n.id, 'alliance'), trade = S.pactOf(s, me.id, n.id, 'trade'), nap = S.pactOf(s, me.id, n.id, 'nap'), mine = n.overlord === me.id;
    const ask = kind => this.#act(s => { const r = S.propose(s, me.id, n.id, kind); if (r.ok) sfx.treaty(); return { ok: r.ok, msg: r.ok ? `${n.name} accepted the ${KIND[kind].toLowerCase()}!` : `${n.name}: “${r.msg}”` }; });
    const out = [];
    if (mine) return [this.#group('👑 Dependent state', this.#btn(n.vtype === 'puppet' ? 'Already a puppet' : 'Install puppet government', () => this.#act(s => { S.makePuppet(s, n.id); return { ok: true, msg: 'Puppet government installed (−8 reputation).' }; }), '', n.vtype === 'puppet'), this.#btn('Release', () => this.#act(s => { S.release(s, n.id); return { ok: true, msg: 'Released.' }; })))];
    if (!war) {
      out.push(this.#group('🤝 Alliance', ally ? [this.#btn('Request aid', () => this.#act(s => S.requestAid(s, me.id, n.id))), this.#btn('Gift 50🪙', () => this.#act(s => ({ ok: S.gift(s, me.id, n.id, 50), msg: 'Gift sent. Relations improve.' }))), this.#btn('Break alliance', () => confirmBox('Break alliance?', 'Betraying an ally costs −30 reputation and angers other nations.', () => this.#act(s => { S.breakPact(s, ally, me.id); return { ok: true, msg: 'Alliance broken.' }; })), '.red')]
        : [this.#btn('Defensive', () => ask('alliance-def')), this.#btn('Military', () => ask('alliance-mil'))]));
      out.push(this.#group('💱 Trade', trade ? [this.#btn('Buy 10⚙ (30🪙)', () => this.#act(s => S.buyEquipment(s, me.id, n.id, 10))), this.#btn('Cancel', () => this.#act(s => { S.breakPact(s, trade, me.id); return { ok: true, msg: 'Agreement cancelled.' }; }))] : [this.#btn('Trade agreement', () => ask('trade'))]));
      out.push(this.#group('🕊 Treaties', nap ? h('span.mute', { style: { fontSize: '12px' } }, `Non-aggression pact until month ${nap.until}`) : this.#btn('Non-aggression pact', () => ask('nap')), !n.overlord ? this.#btn('Offer vassalage', () => ask('vassal')) : null));
    } else {
      const border = S.borderRegions(s, me.id, n.id).includes(rid);
      out.push(this.#group(`⚔ War (score ${S.warScore(s, me.id, n.id)})`, this.#btn(`Attack ${S.NAME(rid)}`, () => this.#attackModal(rid), '.red', !border || me.atk <= 0), this.#btn('Peace talks', () => this.#peaceModal(n))), h('div.mute', { style: { fontSize: '11px' } }, border ? `Attack orders left: ${me.atk}` : 'Only regions on your front line can be attacked.'));
    }
    if (!war) out.push(this.#group('⚔ War', this.#btn('Declare war', () => { const pact = S.pactOf(s, me.id, n.id); const go = () => this.#act(s => { const r = S.declareWar(s, me.id, n.id); return { ok: r.ok, msg: r.ok ? `War declared on ${n.name}!` : r.msg }; }); pact ? confirmBox('Break treaty?', 'Declaring war on a treaty partner is betrayal (−20 to −30 reputation).', go) : go(); }, '.red')));
    return out;
  }

  #attackModal(rid) {
    const m = modal('⚔ Attack ' + S.NAME(rid), h('div', h('p', 'Commit how much of your army?'), h('div.row', [0.25, 0.5, 1].map(f => h('button.btn.red.grow', { onclick: () => { m.close(); const owner = this.s.regions[rid].owner; const out = S.attack(this.s, this.me.id, rid, f); if (out.win) { sfx.boom(); this.#flash(rid, '💥'); store.mutate(st => { st.stats.conquests++; }); addProfileXp(10); checkAchievements(); } else this.#flash(rid, '✖'); this.#act(() => out); this.#showRegion(rid); } }, `${f * 100}%`)))));
  }
  #peaceModal(n) {
    const s = this.s, me = this.me, sc = S.warScore(s, me.id, n.id), deals = [['white', '🕊 White peace', 'End the war, keep borders'], ['reparations', '💰 Reparations', 'They pay 40% of their treasury'], ['vassal', '👑 Vassalize', 'They become your tributary'], ['puppet', '🎭 Puppet', 'Total control (needs total victory)'], ['concede', '🏳 Buy peace (60🪙)', 'Pay them to stop']];
    const m = modal(`Peace with ${n.name}`, [h('p.mute', `War score ${sc}. They will accept if they are desperate enough.`), ...deals.map(([k, t, d]) => h('button.btn', { style: { width: '100%', marginBottom: '6px', textAlign: 'left' }, onclick: () => { const r = S.peaceDecision(s, me.id, n.id, k); if (r.ok) { if (k !== 'white' && sc > 0) store.mutate(st => { st.stats.warsWon++; }); S.applyPeace(s, me.id, n.id, k); sfx.treaty(); m.close(); this.#act(() => ({ ok: true, msg: 'Treaty signed!' })); } else toast(`${n.name}: “${r.msg}”`, 'bad'); } }, h('div', { style: { fontWeight: 800 } }, t), h('div.mute', { style: { fontSize: '12px' } }, d)))]);
  }

  #inbox() {
    const s = this.s, m = modal('🔔 Diplomatic inbox', ''); const render = () => m.body.replaceChildren(...(s.proposals.length ? s.proposals.map(p => { const f = s.nations[p.from];
      const label = p.kind === 'peace' ? (p.demand ? `${f.name} demands: ${p.deal}` : `${f.name} offers white peace`) : `${f.name} proposes: ${KIND[p.kind]}`;
      return h('div.card', { style: { flexDirection: 'row', textAlign: 'left', marginBottom: '8px' } }, ballAvatar(f.flag, 40), h('div.grow', label), h('button.btn.green.sm', { onclick: () => { this.#accept(p); render(); } }, '✔'), h('button.btn.red.sm', { onclick: () => { s.proposals.splice(s.proposals.indexOf(p), 1); this.#refreshHud(); render(); } }, '✖')); }) : [h('p.mute', 'No pending proposals.')])); render();
  }
  #accept(p) {
    const s = this.s; s.proposals.splice(s.proposals.indexOf(p), 1);
    if (p.kind === 'peace') { if (S.atWar(s, p.from, s.player)) S.applyPeace(s, p.from, s.player, p.deal); } else if (!S.atWar(s, p.from, s.player)) S.sign(s, p.from, s.player, p.kind);
    sfx.treaty(); this.#act(() => ({ ok: true, msg: 'Accepted.' }));
  }
  #logModal() { modal('📜 Chronicle', this.s.log.slice(0, 40).map(l => h('div', { style: { padding: '4px 0', borderBottom: '1px solid #fff1', color: l.tone === 'bad' ? 'var(--bad)' : l.tone === 'good' ? 'var(--good)' : '' } }, h('span.mute', `M${l.t} `), l.text))); }
  #menuModal() {
    const s = this.s, m = modal('☰ Campaign', [h('div.kv', h('span.mute', 'Month'), h('b', s.turn), h('span.mute', 'World controlled'), h('b', (S.empireShare(s) * 100).toFixed(1) + '% (win at 50%)'), h('span.mute', 'Reputation'), h('b', Math.round(this.me.rep)), h('span.mute', 'Active wars'), h('b', S.enemiesOf(s, s.player).length)),
      h('div', { style: { height: '10px' } }), h('button.btn', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { this.map.reset(); m.close(); } }, '🌍 Reset map view'), h('button.btn.red', { style: { width: '100%' }, onclick: () => confirmBox('Abandon?', 'Delete this campaign?', () => { m.close(); store.mutate(st => { st.conquest.campaign = null; }); this.s = null; this.#setup(); }) }, 'Abandon campaign')]);
  }

  #endTurn() {
    const s = this.s, before = this.me.regs.length; S.endTurn(s); S.startPlayerTurn(s); sfx.click();
    const lost = before - this.me.regs.length; if (lost > 0) toast(`You lost ${lost} region${lost > 1 ? 's' : ''}!`, 'bad'); else if (s.proposals.length) toast('🔔 New diplomatic proposals', 'epic');
    store.mutate(() => {}); this.#paintAll(s); this.#refreshHud(); if (this.sel) this.#showRegion(this.sel); this.#checkOver();
  }
  #checkOver() {
    const s = this.s; if (!s?.over || this.ended) return; this.ended = true;
    if (s.over === 'win') { store.mutate(st => { st.conquest.wins++; st.conquest.campaign = null; }); addCoins(2000 + s.turn * 5); addProfileXp(300); checkAchievements(); sfx.levelUp(); }
    else store.mutate(st => { st.conquest.campaign = null; });
    const m = modal(s.over === 'win' ? '🏆 Victory!' : '💀 Defeat', [h('p', s.over === 'win' ? `You rule the world in month ${s.turn}! Reward: 🪙 ${2000 + s.turn * 5}` : 'Your nation has fallen.'), h('button.btn.gold', { style: { width: '100%' }, onclick: () => { m.close(); this.ended = false; this.s = null; this.#setup(); } }, 'New campaign')]);
  }
}

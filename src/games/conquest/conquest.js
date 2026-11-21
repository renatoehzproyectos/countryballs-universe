import meta from '../../data/countryMeta.json';
import { store } from '../../core/store.js';
import { sfx } from '../../core/audio.js';
import { h, ui, fmt, ballAvatar, modal, confirmBox, toast } from '../../ui/dom.js';
import { flagUrl } from '../../characters/flags.js';
import { createMapView } from '../../ui/mapview.js';
import { addCoins, addProfileXp, checkAchievements } from '../../core/economy.js';
import { EMPIRES, EMPIRE_REQ } from '../../data/empires.js';
import { STRUCTS, structCost, TECHS, WEAPONS, SPACE, SUPERPOWERS, PACTS, SPEEDS, DAY_SECS, dateOf } from '../../data/conquestData.js';
import * as S from './sim.js';
import './ai.js';

const PERS_ICON = { aggressive: '🔥', opportunist: '🦊', diplomatic: '🕊️', merchant: '💰', isolationist: '🏝️' };
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

/**
 * Game Two — World Conquest (real time). A UI layer over sim.js: continuous time with pause/1×/2×/4×,
 * political map, country selection, expansion, economy, war, missiles, naval invasions, diplomacy,
 * puppets, historical empires, space race, superpowers and bots. The campaign is autosaved.
 */
export default class Conquest {
  constructor(manager) { this.manager = manager; this.s = null; this.sel = null; this.speed = 1; this.tab = null; this.panel = null; }

  async mount({ exit }) {
    this.exit = exit; S.onSfx(k => { if (k && sfx[k]) sfx[k](); else if (k === 'launch') sfx.war(); else if (k === 'empire') sfx.levelUp(); });
    S.onEvent(e => this.#onEvent(e));
    this.root = h('div', { style: { position: 'fixed', inset: 0, zIndex: 2, background: '#0a3a6b' } });
    this.map = createMapView({ onTap: id => this.#tap(id) }); this.map.el.style.position = 'absolute'; this.root.append(this.map.el);
    const defs = svgEl('defs'), cp = svgEl('clipPath', { id: 'cbclip', clipPathUnits: 'userSpaceOnUse' }); cp.append(svgEl('circle', { cx: 0, cy: 0, r: 5 })); defs.append(cp); this.map.svg.prepend(defs);
    this.hud = h('div'); this.sheet = h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '54vh', overflow: 'auto', background: 'var(--panel)', borderRadius: '18px 18px 0 0', padding: '12px 14px calc(14px + env(safe-area-inset-bottom))', boxShadow: '0 -6px 30px #000a', display: 'none', touchAction: 'pan-y', zIndex: 3 } });
    this.root.append(this.hud, this.sheet); ui().append(this.root);
    this.back = h('button.btn.back', { style: { zIndex: 6 }, onclick: () => { this.#save(); this.exit(); } }, '🏠'); ui().append(this.back);
    const saved = store.state.conquest.campaign; if (saved && saved.v === 2 && !saved.over) this.#menu(); else { if (saved) store.mutate(st => { st.conquest.campaign = null; }); this.#setup(); }
  }
  unmount() { this.#stopLoop(); this.#save(); this.root?.remove(); this.back?.remove(); this.panelModal?.close(); }
  #save() { if (this.s && !this.s.over) store.mutate(st => { st.conquest.campaign = this.s; }); store.save(); }
  get me() { return this.s.nations[this.s.player]; }

  // ------------------------------------------------------------ setup
  #menu() {
    const c = store.state.conquest.campaign, pn = c.nations[c.player]; this.setupState = S.newGame('PL'); this.#paintAll(this.setupState, true);
    const m = modal('🗺️ Conquista Mundial', [h('p.mute', 'Tienes una partida empezada.'), h('div.row', { style: { marginBottom: '10px' } }, ballAvatar(pn.flag, 50), h('div', h('b', pn.name), h('div.mute', `${dateOf(c.t).text} · ${pn.regs.length} territorios`))),
      h('button.btn.green', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { this.s = c; m.close(); this.#play(); } }, '▶ Seguir jugando'),
      h('button.btn.red', { style: { width: '100%' }, onclick: () => confirmBox('¿Empezar de nuevo?', 'Se perderá la partida actual.', () => { store.mutate(st => { st.conquest.campaign = null; }); m.close(); }) }, 'Partida nueva')], { onClose: () => { if (!this.s) this.#setup(); } });
  }
  #setup() {
    this.s = null; this.sel = null; this.setupState = S.newGame('PL'); this.#paintAll(this.setupState, true); this.sheet.style.display = 'none'; const own = store.state.ownedEmpires;
    this.hud.replaceChildren(h('div.hud-top', { style: { left: '64px' } }, h('div.chip', '🗺️ Elige tu país: toca uno en el mapa')),
      h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 8px calc(8px + env(safe-area-inset-bottom))', background: 'linear-gradient(transparent,#000a)', zIndex: 2 } },
        h('div.mute', { style: { fontSize: '12px', margin: '0 4px 4px' } }, '👑 Empezar como imperio histórico (también puedes formarlos jugando)'),
        h('div', { style: { display: 'flex', gap: '8px', overflowX: 'auto', touchAction: 'pan-x' } }, Object.values(EMPIRES).map(e => { const ok = own.includes(e.id);
          return h('button.card', { style: { minWidth: '112px', color: 'inherit', opacity: ok ? 1 : 0.6, cursor: 'pointer' }, onclick: () => ok ? this.#empireInfo(e) : toast('🔒 ' + EMPIRE_REQ[e.id] + ' (Adivina la bandera)', 'bad') }, ballAvatar(e.flag, 40, !ok), h('div.nm', e.name), h('div.mute', { style: { fontSize: '10px' } }, ok ? '¡Tuyo!' : '🔒 Bloqueado')); }))));
    this.setupMode = true;
  }
  #empireInfo(e) {
    const m = modal(e.name, h('div', h('div.center', ballAvatar(e.flag, 90)), h('p', e.blurb), h('div.kv', h('span.mute', 'Territorios al empezar'), h('b', e.regions.length), h('span.mute', 'Dinero'), h('b', '×' + e.mods.income), h('span.mute', 'Ejército'), h('b', '×' + e.mods.troops)),
      h('div', { style: { height: '10px' } }), h('button.btn.gold', { style: { width: '100%' }, onclick: () => { m.close(); this.#begin(e.id); } }, `Jugar con ${e.name}`)));
  }
  #begin(id) { this.s = S.newGame(id); store.mutate(st => { st.conquest.campaign = this.s; }); this.sel = null; this.setupMode = false; this.#play(); }

  // ------------------------------------------------------------ real-time loop
  #play() {
    this.setupMode = false; this.sel = null; this.sheet.style.display = 'none'; this.ended = false; this.speed = 1; S.markAll();
    this.#buildHud(); this.#paintAll(this.s); this.#refreshHud(); this.map.focus(this.me.cap, 0.3); this.#startLoop();
  }
  #startLoop() {
    this.#stopLoop(); let last = performance.now(), hudT = 0, saveT = 0;
    const frame = now => {
      this.raf = requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last) / 1000); last = now; const s = this.s; if (!s || s.over) return;
      if (this.speed > 0) { s.acc += dt * this.speed / DAY_SECS; let n = 0; while (s.acc >= 1 && n < 10) { s.acc -= 1; S.tick(s); n++; if (s.over) break; } if (s.acc > 10) s.acc = 0; }
      const dirty = S.drainDirty(); if (dirty.length) this.#paintRegions(dirty); if (S.drainRel()) this.#paintAll(s);
      hudT += dt; if (hudT > 0.25) { hudT = 0; this.#refreshHud(); this.#drawOverlay(); if (this.panel) this.panel(); }
      saveT += dt; if (saveT > 15) { saveT = 0; this.#save(); }
      if (s.over) this.#checkOver();
    };
    this.raf = requestAnimationFrame(frame);
  }
  #stopLoop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  #onEvent(e) {
    const p = this.s?.player; if (!p || !e.who?.includes(p)) return;
    if (e.tone === 'bad' || e.tone === 'good' || e.tone === 'epic') toast(e.text, e.tone);
    if (e.inbox) this.#refreshHud();
  }

  // ------------------------------------------------------------ HUD
  #buildHud() {
    this.elStats = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }); this.badge = h('span', { style: { background: '#ff4d4d', borderRadius: '9px', padding: '0 6px', marginLeft: '4px', fontSize: '11px' } });
    this.speedBtns = SPEEDS.map(v => h('button.btn.sm', { onclick: () => { this.speed = v; sfx.click(); this.#refreshSpeed(); } }, v === 0 ? '⏸' : v + '×'));
    const bar = h('div', { style: { position: 'absolute', left: '10px', bottom: 'calc(14px + env(safe-area-inset-bottom))', display: 'flex', gap: '6px', zIndex: 2 } }, ...this.speedBtns);
    this.hud.replaceChildren(h('div.hud-top', { style: { left: '64px', alignItems: 'flex-start' } }, this.elStats, h('div.grow'), h('div', { style: { display: 'grid', gap: '6px' } },
      h('button.btn.sm', { onclick: () => this.#inbox() }, '🔔', this.badge), h('button.btn.sm', { onclick: () => this.#openPanel('mil') }, '🏛'), h('button.btn.sm', { onclick: () => this.#logModal() }, '📜'), h('button.btn.sm', { onclick: () => this.#menuModal() }, '☰'))), bar);
    this.#refreshSpeed();
  }
  #refreshSpeed() { this.speedBtns?.forEach((b, i) => { b.style.outline = SPEEDS[i] === this.speed ? '3px solid #ffc933' : 'none'; }); }
  #refreshHud() {
    const s = this.s; if (!s || !this.elStats) return; const n = this.me, e = S.econ(s, n), r = n.research;
    const rs = r ? `🔬 ${TECHS[r.id].name} ${Math.floor(r.got / TECHS[r.id].cost * 100)}%` : '🔬 —';
    this.elStats.replaceChildren(...[`📅 ${dateOf(s.t).text}${this.speed === 0 ? ' ⏸' : ''}`, `🪙 ${fmt(n.money)} (${e.net >= 0 ? '+' : ''}${e.net.toFixed(1)}/d)`, `🏭 ${fmt(n.ind)}`, `🪖 ${fmt(n.troops)}k/${fmt(S.troopCap(s, n))}k`, `⚓ ${n.ships}`, rs, `🌍 ${(S.share(s, n.id) * 100).toFixed(1)}% (60 % gana)`].map((t, i) => h('span.chip', { style: { padding: '3px 9px', fontSize: '13px', color: i === 1 && e.net < 0 ? 'var(--bad)' : '' } }, t)));
    this.badge.textContent = s.inbox.length || ''; this.badge.style.display = s.inbox.length ? 'inline' : 'none';
  }

  // ------------------------------------------------------------ map painting
  #fillOf(s, rid) { const o = s.regions[rid].owner; if (!o) return S.NEUTRAL; const n = s.nations[o]; return S.colorOf(n.overlord && s.nations[n.overlord] ? s.nations[n.overlord] : n); }
  #strokeOf(s, rid, plain) {
    let stroke = '#0b2a1a', w = 0.35; const o = s.regions[rid].owner; if (plain || !o) return [stroke, w];
    const n = s.nations[o], p = s.player;
    if (o === p) { stroke = '#fff'; w = 0.9; } else if (S.atWar(s, p, o)) { stroke = '#ff3b3b'; w = 1.2; } else if (S.isAllied(s, p, o)) { stroke = '#3ddc84'; w = 1; } else if (n.overlord === p) { stroke = '#ffc933'; w = 1; } else if (S.pactOf(s, p, o, 'trade')) { stroke = '#4aa3ff'; w = 0.7; }
    return [stroke, w];
  }
  #paintRegions(ids, plain = !this.s) {
    const s = this.s ?? this.setupState; for (const id of ids) { this.map.fill(id, this.#fillOf(s, id)); const [c, w] = this.#strokeOf(s, id, plain); this.map.stroke(id, this.sel === id ? '#ffc933' : c, this.sel === id ? 1.8 : w); }
    if (this.sel) this.map.paths[this.sel]?.parentNode.append(this.map.paths[this.sel]);
  }
  #paintAll(s, plain) { this.#paintRegions(S.IDS, plain ?? !this.s); this.#drawMarkers(s, plain); }
  #ball(n, x, y) {
    const g = svgEl('g', { transform: `translate(${x} ${y})` }); g.append(svgEl('circle', { r: 5.4, fill: S.colorOf(n), stroke: '#000', 'stroke-width': 0.9 }));
    const im = svgEl('image', { x: -5, y: -5, width: 10, height: 10, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#cbclip)' }); im.setAttribute('href', flagUrl(n.flag)); g.append(im);
    for (const sx of [-1, 1]) { g.append(svgEl('circle', { cx: sx * 1.9, cy: -0.6, r: 1.35, fill: '#fff', stroke: '#000', 'stroke-width': 0.35 }), svgEl('circle', { cx: sx * 1.9 + 0.2, cy: -0.4, r: 0.6, fill: '#000' })); }
    return g;
  }
  #drawMarkers(s, plain) {
    this.markers?.remove(); this.markers = svgEl('g'); this.map.overlay.append(this.markers); if (plain || !s.nations) return;
    const p = s.player, show = new Set([p, ...S.enemiesOf(s, p), ...S.alliesOf(s, p), ...S.puppetsOf(s, p).map(v => v.id)]); if (this.sel && s.regions[this.sel]?.owner) show.add(s.regions[this.sel].owner);
    for (const id of [...show].slice(0, 22)) { const n = s.nations[id]; if (n?.alive) this.markers.append(this.#ball(n, S.REG[n.cap].cx, S.REG[n.cap].cy)); }
  }
  #drawOverlay() {
    const s = this.s; if (!s) return; this.fx?.remove(); this.fx = svgEl('g'); this.map.overlay.append(this.fx); const p = s.player; let k = 0;
    const vis = o => o.o === p || S.atWar(s, p, o.o) || S.isAllied(s, p, o.o) || s.regions[o.to].owner === p;
    for (const o of s.orders) { if (!vis(o) || k++ > 60) continue; const a = S.REG[o.from], b = S.REG[o.to], f = 1 - o.eta / o.total, col = o.kind === 'sea' ? '#7fd4ff' : o.kind === 'expand' ? '#ffe45c' : (o.o === p ? '#7dff9a' : '#ff6b6b');
      this.fx.append(svgEl('line', { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, stroke: col, 'stroke-width': 0.9, 'stroke-dasharray': '3 2', opacity: 0.85, 'vector-effect': 'non-scaling-stroke' }));
      const d = svgEl('circle', { cx: a.cx + (b.cx - a.cx) * f, cy: a.cy + (b.cy - a.cy) * f, r: 2.1, fill: col, stroke: '#000', 'stroke-width': 0.4 }); this.fx.append(d); }
    for (const st of s.strikes) { if (k++ > 90) break; const a = S.REG[st.from], b = S.REG[st.to], f = 1 - st.eta / st.total;
      this.fx.append(svgEl('line', { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, stroke: '#ff9a2e', 'stroke-width': 1.1, opacity: 0.8, 'vector-effect': 'non-scaling-stroke' }));
      const t = svgEl('text', { x: a.cx + (b.cx - a.cx) * f, y: a.cy + (b.cy - a.cy) * f, 'font-size': 8, 'text-anchor': 'middle' }); t.textContent = WEAPONS[st.w].icon; this.fx.append(t); }
  }
  #flash(id, txt) { const r = S.REG[id]; const t = svgEl('text', { x: r.cx, y: r.cy, 'font-size': 10, 'text-anchor': 'middle' }); t.textContent = txt; this.map.overlay.append(t); setTimeout(() => t.remove(), 1200); }

  // ------------------------------------------------------------ selection
  #tap(id) { sfx.click(); const prev = this.sel; this.sel = id; this.tab = null; const s = this.s ?? this.setupState; this.#paintRegions([prev, id].filter(Boolean)); this.#drawMarkers(s, !this.s); this.#showRegion(); }
  #close() { const prev = this.sel; this.sel = null; this.sheet.style.display = 'none'; this.#paintRegions([prev].filter(Boolean)); this.#drawMarkers(this.s ?? this.setupState, !this.s); }
  #act(fn) { const out = fn(this.s); if (out?.msg) toast(out.msg, out.ok === false ? 'bad' : 'good'); if (out?.ok !== false) sfx.coin?.(); this.#save(); this.#refreshHud(); if (this.sel) this.#showRegion(); this.panel?.(); return out; }
  #btn(label, fn, cls = '', disabled = false) { return h('button.btn.sm' + cls, { disabled, onclick: () => { sfx.click(); fn(); } }, label); }
  #group(title, ...kids) { return h('div', { style: { marginTop: '10px' } }, h('div.mute', { style: { fontSize: '12px', marginBottom: '4px' } }, title), h('div.row.wrap', kids.flat().filter(Boolean))); }

  #showRegion() {
    const id = this.sel; if (!id) return; const play = !!this.s, s = this.s ?? this.setupState, reg = s.regions[id], n = reg.owner ? s.nations[reg.owner] : null, me = play ? this.me : null;
    if (!n) return this.#showNeutral(id, play);
    const gdp = S.gdpOf(s, n), pop = S.popOf(s, n), r = play && n.id !== me.id ? S.rel(s, me.id, n.id) : 0, chips = [];
    if (play && n.id !== me.id) { if (S.atWar(s, me.id, n.id)) chips.push('⚔ En guerra'); if (S.isAllied(s, me.id, n.id)) chips.push('🤝 Aliado'); for (const t of ['embassy', 'coop', 'trade']) if (S.pactOf(s, me.id, n.id, t)) chips.push(PACTS[t].icon + ' ' + PACTS[t].name); if (n.overlord === me.id) chips.push('🎭 Tu estado títere'); else if (n.overlord) chips.push('🎭 Títere de ' + s.nations[n.overlord].name); }
    if (n.emp) chips.push('👑 ' + EMPIRES[n.emp].name);
    const body = [h('div.row', ballAvatar(n.flag, 54), h('div.grow', h('div', { style: { fontSize: '18px', fontWeight: 800 } }, n.name), h('div.mute', { style: { fontSize: '12px' } }, `Capital ${meta[n.cap]?.cap ?? '—'}${reg.owner !== id ? ` · tocaste ${S.NAME(id)}` : ''}`)), h('button.btn.sm', { onclick: () => this.#close() }, '✕')),
      chips.length ? h('div.pill-list', { style: { margin: '6px 0' } }, chips.map(c => h('span.chip', { style: { padding: '2px 9px', fontSize: '12px' } }, c))) : null,
      h('div.kv', { style: { fontSize: '13px', margin: '8px 0' } }, ...Object.entries({ 'Gente': pop.toFixed(1) + 'M', 'Economía': '$' + fmt(gdp) + 'B', 'Ejército': `${fmt(n.troops)}k · ⚓${n.ships}`, 'Fuerza': fmt(S.strength(n)),
        'Territorio': `${n.regs.length} zonas · ${S.count(s, n, 'city')}🏙 ${S.count(s, n, 'fact')}🏭`, ...(play ? { 'Esta zona': `🏙${reg.city} 🏭${reg.fact} ⚓${reg.port} 🎖${reg.base} 🛰${reg.space}${reg.dmg > 5 ? ' 💥' + Math.round(reg.dmg) + '%' : ''}` } : {}),
        ...(play && n.id !== me.id ? { 'Carácter': `${PERS_ICON[n.pers]} ${S.persOf(n).label}`, 'Amistad': `${r > 0 ? '+' : ''}${r}`, 'Fama': Math.round(n.rep) } : {}) }).flatMap(([k, v]) => [h('span.mute', k), h('b', v)]))];
    if (!play) body.push(h('button.btn.green', { style: { width: '100%' }, onclick: () => this.#begin(reg.owner) }, `✔ Confirmar: jugar con ${n.name}`));
    else if (n.id === me.id) body.push(...this.#ownActions(id));
    else body.push(...this.#diplomacy(n, id));
    this.sheet.replaceChildren(...body.filter(Boolean)); this.sheet.style.display = 'block';
  }
  #showNeutral(id, play) {
    const s = this.s ?? this.setupState, c = S.expandCost(id), rc = play ? S.reach(s, this.s.player, id) : null;
    this.sheet.replaceChildren(h('div.row', h('div.grow', h('div', { style: { fontSize: '18px', fontWeight: 800 } }, '🏳 ' + S.NAME(id)), h('div.mute', { style: { fontSize: '12px' } }, 'Tierra sin dueño: puedes expandirte hasta ella.')), h('button.btn.sm', { onclick: () => this.#close() }, '✕')),
      play ? h('div', { style: { marginTop: '8px' } }, this.#btn(`🏳 Expandir (${c}🪙)`, () => this.#act(s => S.expand(s, s.player, id)), '.green', !rc), h('div.mute', { style: { fontSize: '11px', marginTop: '4px' } }, rc ? `Se alcanza por ${rc.kind === 'land' ? 'tierra' : 'mar (puerto)'}.` : 'Fuera de alcance: necesitas frontera o un puerto cerca.')) : h('div.mute', 'Elige un país con color.'));
    this.sheet.style.display = 'block';
  }

  #ownActions(id) {
    const s = this.s, r = s.regions[id], n = this.me, out = [];
    const bs = Object.entries(STRUCTS).filter(([k]) => !(STRUCTS[k].coastal && !S.isCoastal(id))).map(([k, d]) => { const f = k === 'factory' ? 'fact' : k, have = r[f], full = have >= d.max, need = d.tech && !S.hasTech(n, d.tech);
      return this.#btn(`${d.icon} ${d.name} ${have}/${d.max}${full ? '' : ` (${structCost(k, have)})`}`, () => this.#act(s => S.build(s, n.id, id, k)), '', full || need); });
    out.push(this.#group(`🏗 Construir en ${S.NAME(id)}`, bs), h('div.mute', { style: { fontSize: '11px', margin: '4px 0' } }, 'Ciudades: dinero y gente · Fábricas: industria e investigación · Puerto: barcos e invasiones · Base militar: defensa, ejército y armas · Base espacial: carrera a la Luna.'));
    out.push(this.#group('Mi país', this.#btn('🏛 Abrir panel nacional', () => this.#openPanel('mil'), '.gold'))); return out;
  }

  // ------------------------------------------------------------ other countries: ALLIANCE / WAR
  #diplomacy(n, rid) {
    const s = this.s, me = this.me, war = S.atWar(s, me.id, n.id), mine = n.overlord === me.id, out = [];
    out.push(h('div.row', { style: { marginTop: '8px' } },
      h('button.btn.grow' + (this.tab === 'ally' ? '.green' : ''), { onclick: () => { sfx.click(); this.tab = this.tab === 'ally' ? null : 'ally'; this.#showRegion(); } }, '🤝 ALIANZA'),
      h('button.btn.grow' + (this.tab === 'war' ? '.red' : ''), { onclick: () => { sfx.click(); this.tab = this.tab === 'war' ? null : 'war'; this.#showRegion(); } }, '⚔️ GUERRA')));
    if (mine) out.push(this.#group('🎭 Estado títere', this.#btn('Anexar (150🪙)', () => this.#act(s => S.annex(s, me.id, n.id))), this.#btn('Dar libertad', () => this.#act(s => { S.release(s, n.id); return { ok: true, msg: 'Ahora es libre.' }; }))));
    if (this.tab === 'ally') out.push(...this.#alliancePanel(n));
    if (this.tab === 'war') out.push(...this.#warPanel(n, rid, war));
    return out;
  }
  #alliancePanel(n) {
    const s = this.s, me = this.me, war = S.atWar(s, me.id, n.id); if (war) return [h('p.mute', 'Estáis en guerra: primero haced las paces.')];
    const ask = type => this.#act(s => { const r = S.propose(s, me.id, n.id, type); if (r.ok) sfx.treaty(); return { ok: r.ok, msg: r.ok ? `¡${n.name} aceptó: ${PACTS[type].name.toLowerCase()}!` : `${n.name}: “${r.msg}”` }; });
    const row = type => { const p = S.pactOf(s, me.id, n.id, type); return p ? this.#btn(`${PACTS[type].icon} Romper ${PACTS[type].name.toLowerCase()}`, () => confirmBox('¿Romper el acuerdo?', type === 'alliance' ? 'Traicionar a un aliado baja mucho tu fama.' : 'Se cancelará el acuerdo.', () => this.#act(s => { S.breakPact(s, p, me.id); return { ok: true, msg: 'Acuerdo roto.' }; })), '.red') : this.#btn(`${PACTS[type].icon} ${PACTS[type].name}`, () => ask(type)); };
    const out = [this.#group('Diplomacia', row('embassy'), this.#btn('💬 Mejorar relaciones (50🪙)', () => this.#act(s => S.improveRelations(s, me.id, n.id)))), this.#group('Acuerdos', row('coop'), row('trade'), row('alliance'))];
    if (S.isAllied(s, me.id, n.id)) out.push(this.#group('Aliado', this.#btn('🆘 Pedir ayuda', () => this.#act(s => S.requestAid(s, me.id, n.id)))));
    if (!n.overlord && !S.atWar(s, me.id, n.id)) out.push(this.#group('Protección', this.#btn('🎭 Ofrecer protección (estado títere)', () => this.#act(s => S.offerPuppet(s, me.id, n.id)))));
    out.push(h('div.mute', { style: { fontSize: '11px', marginTop: '6px' } }, 'Primero relaciones diplomáticas; luego cooperación, comercio y alianza. Los aliados no se pueden atacar.')); return out;
  }
  #warPanel(n, rid, war) {
    const s = this.s, me = this.me, out = [];
    if (!war) { const c = S.canDeclare(s, me.id, n.id); out.push(this.#group('Declarar la guerra', this.#btn('⚔ Declarar la guerra a ' + n.name, () => { const go = () => this.#act(s => S.declareWar(s, me.id, n.id)); const pact = s.pacts.filter(p => ((p.a === me.id && p.b === n.id) || (p.a === n.id && p.b === me.id)) && p.type !== 'embassy'); pact.length ? confirmBox('¿Romper los acuerdos?', 'Atacar a un amigo es una traición y baja tu fama.', () => { for (const p of pact) S.breakPact(s, p, me.id); go(); }) : go(); }, '.red', !c.ok && !c.msg?.includes('aliado')), c.ok ? null : h('div.mute', { style: { fontSize: '11px' } }, c.msg))); return out; }
    const rc = S.reach(s, me.id, rid), sc = S.warScore(s, me.id, n.id), cap = rc?.kind === 'sea' ? 4 + me.ships * 6 : Infinity;
    out.push(this.#group(`🪖 Enviar tropas a ${S.NAME(rid)} (puntos ${sc})`, [0.25, 0.5, 0.75, 1].map(f => this.#btn(`${Math.round(f * 100)}% · ${Math.min(cap, Math.max(1, Math.round(me.troops * f)))}k`, () => { const r = this.#act(s => S.sendArmy(s, me.id, rid, f)); if (r.ok) sfx.war?.(); }, '.red', !rc))),
      h('div.mute', { style: { fontSize: '11px' } }, rc ? `Ruta ${rc.kind === 'land' ? 'terrestre' : 'marítima (puerto + barcos, máx. ' + (4 + me.ships * 6) + 'k)'} · ~${Math.max(2, Math.ceil(rc.dist / (rc.kind === 'land' ? 5 : 3)))} días` : 'Fuera de alcance: necesitas frontera, o puerto + barcos cerca.'));
    const wp = Object.entries(WEAPONS).filter(([k, d]) => S.hasTech(me, d.tech));
    if (wp.length) out.push(this.#group('💥 Misiles y bombas', wp.map(([k, d]) => this.#btn(`${d.icon} ${d.name} ×${me.arms[k]}`, () => this.#act(s => S.launch(s, me.id, k, rid)), '.red', !me.arms[k] || !S.strikeSource(s, me.id, k, rid)))));
    out.push(this.#group('Paz', this.#btn('🕊 Hacer las paces', () => this.#peaceModal(n)))); return out;
  }
  #peaceModal(n) {
    const s = this.s, me = this.me, sc = S.warScore(s, me.id, n.id), cd = k => k === 'cede1' ? S.cedeCandidates(s, me.id, n.id, 1) : S.cedeCandidates(s, me.id, n.id, 3);
    const deals = [['white', '🕊 Paz blanca', 'Se acaba la guerra y todo queda igual'], ['reparations', '💰 Reparaciones', 'Te dan el 40 % de su tesoro'], ['cede1', '🗺 Ceder 1 territorio', 'Te entregan su zona más cercana'], ['cede3', '🗺 Ceder 3 territorios', 'Condiciones territoriales duras'], ['puppet', '🎭 Estado títere', 'Se somete a ti y paga tributo'], ['concede', '🏳 Comprar la paz (60🪙)', 'Les das monedas para parar']];
    const m = modal(`Paz con ${n.name}`, [h('p.mute', `Puntos ${sc}. Aceptan según cuánto estén sufriendo.`), ...deals.filter(([k]) => (k !== 'cede1' && k !== 'cede3') || cd(k).length).map(([k, t, d]) => h('button.btn', { style: { width: '100%', marginBottom: '6px', textAlign: 'left' }, onclick: () => { const r = S.peaceDecision(s, me.id, n.id, k); if (r.ok) { S.applyPeace(s, me.id, n.id, k); if (k !== 'white' && k !== 'concede' && sc > 0) store.mutate(st => { st.stats.warsWon++; }); sfx.treaty(); m.close(); this.#act(() => ({ ok: true, msg: '¡Tratado firmado!' })); } else toast(`${n.name}: “${r.msg}”`, 'bad'); } }, h('div', { style: { fontWeight: 800 } }, t), h('div.mute', { style: { fontSize: '12px' } }, d + (k.startsWith('cede') ? ': ' + cd(k).map(S.NAME).join(', ') : ''))))]);
  }

  // ------------------------------------------------------------ national panel (military / tech / space / power / empires)
  #openPanel(tab) {
    this.tab2 = tab; this.panelModal?.close(); const wrap = h('div'), tabs = h('div.row.wrap', { style: { marginBottom: '10px' } }), body = h('div'); wrap.append(tabs, body);
    this.panelModal = modal('🏛 ' + this.me.name, wrap, { onClose: () => { this.panel = null; this.panelModal = null; } });
    let sig = '';
    const draw = (force) => {
      const n = this.me, s = this.s, key = this.tab2 + '|' + Math.floor(s.t / 3) + '|' + Math.round(n.money / 10) + '|' + (n.research?.id ?? '') + '|' + s.inbox.length + this.speed; if (!force && key === sig) return; sig = key;
      tabs.replaceChildren(...[['mil', '🪖 Militar'], ['tech', '🔬 Ciencia'], ['space', '🚀 Espacio'], ['sp', '⭐ Poder'], ['emp', '👑 Imperios']].map(([k, t]) => h('button.btn.sm' + (this.tab2 === k ? '.gold' : ''), { onclick: () => { this.tab2 = k; draw(true); } }, t)));
      body.replaceChildren(...this['#' + this.tab2]());
    };
    this.panel = () => draw(false); this.panelDraw = () => draw(true); draw(true);
  }
  #pa(fn) { const o = this.#act(fn); this.panelDraw?.(); return o; }
  get ['#mil']() { return () => { const s = this.s, n = this.me, e = S.econ(s, n), cap = S.troopCap(s, n), c = S.shipCost(n);
    const out = [h('div.kv', { style: { fontSize: '13px' } }, ...Object.entries({ 'Ingresos': `+${e.inc.toFixed(1)}/día`, 'Gastos': `−${e.up.toFixed(1)}/día`, 'Tributo': `${(e.got - e.tribute) >= 0 ? '+' : ''}${(e.got - e.tribute).toFixed(1)}/día`, 'Industria': `+${e.ind.toFixed(1)}/día`, 'Investigación': `+${e.rp.toFixed(2)}/día`, 'Soldados': `${fmt(n.troops)}k (máx ${fmt(cap)}k, ${fmt(S.marching(s, n))}k en marcha)`, 'Barcos': n.ships, 'Fama': Math.round(n.rep) }).flatMap(([k, v]) => [h('span.mute', k), h('b', v)])),
      this.#group('🪖 Reclutar (3🪙 + 1,5🏭 por 1k)', [5, 20, 50].map(a => this.#btn(`+${a}k`, () => this.#pa(s => S.recruit(s, n.id, a)), '.green'))),
      this.#group(`🚢 Barcos (${c.m}🪙 ${c.i}🏭 c/u, necesitan puerto)`, [1, 5].map(a => this.#btn(`+${a}`, () => this.#pa(s => S.buildShip(s, n.id, a)), '', !n.regs.some(r => s.regions[r].port)))),
      h('h3', '💥 Armas'), ...Object.entries(WEAPONS).map(([k, d]) => { const ok = S.hasTech(n, d.tech); return h('div.row', { style: { marginBottom: '6px', opacity: ok ? 1 : 0.55 } }, h('div.grow', h('div', { style: { fontWeight: 700 } }, `${d.icon} ${d.name} — tienes ${n.arms[k]}`), h('div.mute', { style: { fontSize: '11px' } }, ok ? `${d.desc} Alcance ${d.range}, radio ${d.radius}, ${d.m}🪙 ${d.i}🏭` : '🔒 Investiga ' + TECHS[d.tech].name)), this.#btn('Fabricar', () => this.#pa(s => S.buyWeapon(s, n.id, k)), '', !ok)); }),
      h('div.mute', { style: { fontSize: '11px' } }, 'Lanza armas tocando un país en guerra contigo → GUERRA. Las bombas y misiles salen de bases militares; la atómica también de tu capital.')];
    const pup = S.puppetsOf(s, n.id); if (pup.length) out.push(this.#group('🎭 Estados títere', pup.map(v => this.#btn(v.name, () => { this.panelModal.close(); this.#tap(v.regs[0]); this.map.focus(v.cap, 0.3); })))); return out; }; }
  get ['#tech']() { return () => { const n = this.me, r = n.research; return [h('p.mute', 'La investigación avanza sola con tus ciudades y fábricas.'), ...Object.entries(TECHS).map(([k, d]) => { const done = n.tech[k], can = S.canResearch(n, k), cur = r?.id === k;
      return h('div.row', { style: { marginBottom: '6px', opacity: done || can ? 1 : 0.5 } }, h('div.grow', h('div', { style: { fontWeight: 700 } }, `${d.icon} ${d.name}${done ? ' ✔' : ''}`), h('div.mute', { style: { fontSize: '11px' } }, `${d.desc} · ${d.cost} pts`), cur ? h('div.bar', h('i', { style: { width: Math.floor(r.got / d.cost * 100) + '%' } })) : null), done ? null : this.#btn(cur ? '▶ En curso' : 'Investigar', () => this.#pa(s => S.startResearch(s, n.id, k)), cur ? '.green' : '', !can)); })]; }; }
  get ['#space']() { return () => { const s = this.s, n = this.me, sp = S.spaceOf(s, n.id), out = [h('p.mute', 'Gana sin conquistar el mundo: llega a la Luna y planta tu bandera. ¡Los bots también compiten!')];
    SPACE.forEach((st, i) => { const state = i < sp.i ? '✔' : i === sp.i ? (sp.left !== null ? `⏳ ${sp.left} días` : '▶ Ahora') : '·';
      out.push(h('div.row', { style: { marginBottom: '6px', opacity: i > sp.i ? 0.5 : 1 } }, h('div.grow', h('div', { style: { fontWeight: 700 } }, `${st.icon} ${i + 1}. ${st.name}`), h('div.mute', { style: { fontSize: '11px' } }, [st.tech ? '🔬 ' + TECHS[st.tech].name : '', st.m ? `${st.m}🪙 ${st.i}🏭` : '', st.days ? st.days + ' días' : ''].filter(Boolean).join(' · '))), h('b', state))); });
    const st = SPACE[sp.i];
    if (!st) out.push(h('h3', '🏆 ¡Tu bandera ondea en la Luna!'));
    else if (sp.i === 0) out.push(this.#group('Siguiente paso', h('div.mute', 'Investiga Tecnología espacial I en 🔬 Ciencia.')));
    else if (st.struct) out.push(this.#group('Siguiente paso', h('div.mute', 'Construye una 🛰 Base espacial (600🪙) tocando una de tus zonas.')));
    else if (!st.auto && sp.left === null) out.push(this.#group('Siguiente paso', this.#btn(`${st.icon} ${st.name}`, () => this.#pa(s => S.startSpace(s, n.id)), '.green')));
    const rivals = S.alive(s).filter(x => x.id !== n.id && S.spaceOf(s, x.id).i >= 2).sort((a, b) => S.spaceOf(s, b.id).i - S.spaceOf(s, a.id).i).slice(0, 5);
    if (rivals.length) out.push(h('h3', 'Rivales'), ...rivals.map(x => h('div.row', ballAvatar(x.flag, 28), h('div.grow', x.name), h('b', `fase ${S.spaceOf(s, x.id).i}/${SPACE.length}`))));
    return out; }; }
  get ['#sp']() { return () => { const n = this.me, d = S.spDef(n); if (!d) return [h('p.mute', 'Los superpoderes nacionales existen para Estados Unidos, China, Rusia y Reino Unido.')];
    const out = [h('div.row', h('div', { style: { fontSize: '30px' } }, d.icon), h('div.grow', h('div', { style: { fontWeight: 800 } }, d.name), h('div.mute', { style: { fontSize: '12px' } }, 'Pasivo: ' + d.passiveText)))];
    if (!n.sp) out.push(h('div.mute', `Requiere ${TECHS[d.tech].name} y ${d.cost}🪙.`), this.#btn('🔓 Desbloquear', () => this.#pa(s => S.unlockSP(s, n.id)), '.gold'));
    else out.push(h('div.mute', `Habilidad: ${d.act.name} — ${d.act.text}.`), this.#btn(n.sp.cd > 0 ? `⏳ ${n.sp.cd} días` : '⚡ Usar habilidad', () => this.#pa(s => S.useSP(s, n.id)), '.green', n.sp.cd > 0)); return out; }; }
  get ['#emp']() { return () => { const s = this.s, n = this.me; return [h('p.mute', 'Controla (tú o tus títeres) el 70 % de sus territorios incluyendo la capital y el imperio renacerá con tu nombre.'), ...Object.values(EMPIRES).map(e => { const p = S.empireProgress(s, n.id, e.id), owner = s.empFormed[e.id];
      return h('div.row', { style: { marginBottom: '8px' } }, ballAvatar(e.flag, 40), h('div.grow', h('div', { style: { fontWeight: 700 } }, e.name), h('div.mute', { style: { fontSize: '11px' } }, owner ? (owner === n.id || s.nations[owner]?.emp === e.id && s.nations[owner].id === n.id ? '¡Es tuyo!' : `Formado por ${s.nations[owner]?.name ?? '—'}`) : `${p.have}/${p.need} territorios${p.capital ? '' : ' · falta ' + S.NAME(e.capital)}`), h('div.bar', h('i', { style: { width: Math.min(100, Math.floor(p.have / p.need * 100)) + '%' } })))); })]; }; }

  // ------------------------------------------------------------ inbox, log, menu
  #inbox() {
    const s = this.s, m = modal('🔔 Mensajes', ''); const label = p => { const f = s.nations[p.from]; return p.kind === 'peace' ? (p.demand ? `${f.name} exige: ${p.deal === 'cede1' ? 'una zona tuya' : 'el 40 % de tu tesoro'}` : p.deal === 'concede' ? `${f.name} paga monedas por la paz` : `${f.name} quiere hacer las paces`) : `${f.name} propone: ${PACTS[p.kind].name.toLowerCase()}`; };
    const render = () => m.body.replaceChildren(...(s.inbox.length ? s.inbox.map(p => { const f = s.nations[p.from]; return h('div.card', { style: { flexDirection: 'row', textAlign: 'left', marginBottom: '8px' } }, ballAvatar(f.flag, 40), h('div.grow', label(p)), h('button.btn.green.sm', { onclick: () => { this.#accept(p); render(); } }, '✔'), h('button.btn.red.sm', { onclick: () => { s.inbox.splice(s.inbox.indexOf(p), 1); this.#refreshHud(); render(); } }, '✖')); }) : [h('p.mute', 'No hay mensajes.')])); render();
  }
  #accept(p) { S.acceptProposal(this.s, p); sfx.treaty(); this.#act(() => ({ ok: true, msg: '¡Aceptado!' })); }
  #logModal() { modal('📜 Historia', this.s.log.slice(0, 50).map(l => h('div', { style: { padding: '4px 0', borderBottom: '1px solid #fff1', color: l.tone === 'bad' ? 'var(--bad)' : l.tone === 'good' ? 'var(--good)' : '' } }, h('span.mute', `${dateOf(l.t).text} `), l.text))); }
  #menuModal() {
    const s = this.s, m = modal('☰ Partida', [h('div.kv', h('span.mute', 'Fecha'), h('b', dateOf(s.t).text), h('span.mute', 'Mundo que controlas'), h('b', (S.share(s, s.player) * 100).toFixed(1) + '% (¡60 % gana!)'), h('span.mute', 'Guerras'), h('b', S.enemiesOf(s, s.player).length), h('span.mute', 'Países vivos'), h('b', S.alive(s).length)),
      h('div', { style: { height: '10px' } }), h('button.btn', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { this.map.reset(); m.close(); } }, '🌍 Ver todo el mapa'), h('button.btn', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { m.close(); this.#openPanel('space'); } }, '🚀 Carrera espacial'),
      h('button.btn.red', { style: { width: '100%' }, onclick: () => confirmBox('¿Dejarla?', '¿Borrar esta partida?', () => { m.close(); this.#stopLoop(); store.mutate(st => { st.conquest.campaign = null; }); this.s = null; this.#setup(); }) }, 'Dejar la partida')]);
  }
  #checkOver() {
    const s = this.s; if (!s?.over || this.ended) return; this.ended = true; this.#stopLoop(); const o = s.over, win = o.type === 'win';
    if (win) { store.mutate(st => { st.conquest.wins++; st.conquest.campaign = null; st.stats.conquests += this.me.regs.length; }); const prize = 2000 + Math.floor(s.t / 10); addCoins(prize); addProfileXp(300); checkAchievements(); sfx.levelUp(); this.prize = prize; }
    else store.mutate(st => { st.conquest.campaign = null; });
    const txt = win ? (o.why === 'luna' ? `¡Plantaste tu bandera en la Luna en ${dateOf(s.t).text}! Premio: 🪙 ${this.prize}` : `¡Dominas el mundo en ${dateOf(s.t).text}! Premio: 🪙 ${this.prize}`)
      : o.why === 'luna' ? `${s.nations[o.winner]?.name} plantó su bandera en la Luna y ganó la partida.` : o.why === 'dominacion' ? `${s.nations[o.winner]?.name} domina el mundo.` : 'Tu país se quedó sin territorio.';
    const m = modal(win ? '🏆 ¡Victoria!' : '😢 Derrota', [h('p', txt), h('button.btn.gold', { style: { width: '100%' }, onclick: () => { m.close(); this.ended = false; this.s = null; this.#setup(); } }, 'Partida nueva')]);
  }
}

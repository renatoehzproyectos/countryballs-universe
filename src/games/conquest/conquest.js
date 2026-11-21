import meta from '../../data/countryMeta.json';
import { store } from '../../core/store.js';
import { sfx } from '../../core/audio.js';
import { h, ui, fmt, ballAvatar, modal, confirmBox, toast } from '../../ui/dom.js';
import { flagUrl } from '../../characters/flags.js';
import { createMapView } from '../../ui/mapview.js';
import { addCoins, addProfileXp, checkAchievements } from '../../core/economy.js';
import { EMPIRES, EMPIRE_REQ } from '../../data/empires.js';
import { STRUCTS, structCost, TECHS, WEAPONS, SPACE, SUPERPOWERS, PACTS, SPEEDS, DAY_SECS, dateOf } from '../../data/conquestData.js';
import * as SIM from './sim.js';
import * as NS_ from './netsync.js';
import { multiplayer } from '../../core/multiplayer.js';
import './ai.js';

const PERS_ICON = { aggressive: '🔥', opportunist: '🦊', diplomatic: '🕊️', merchant: '💰', isolationist: '🏝️' };
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

// ---- Multiplayer plumbing. The host runs the simulation; guests run the same UI on replicated state.
// Every mutating call a guest makes is applied locally (instant feedback) and also sent to the host, whose state wins.
let MP = null;       // { role: 'host' | 'guest', conq }
let QUIET = false;   // true while a guest applies an optimistic local command (its events come back from the host)
const ACT = { build: 0, recruit: 0, buildShip: 0, startResearch: 0, buyWeapon: 0, launch: 0, unlockSP: 0, useSP: 0, startSpace: 0, improveRelations: 0, requestAid: 0, declareWar: 0, expand: 0, sendArmy: 0, annex: 0, breakPact: 1, release: 'rel', propose: 0, applyPeace: 0, offerPuppet: 0 };
const S = new Proxy({}, { get(_, k) {
  const f = SIM[k]; if (!MP || typeof f !== 'function') return f;
  if (k === 'peaceDecision') return (...a) => SIM.isHuman(a[0], a[2]) ? { ok: true } : f(...a);
  if (!(k in ACT)) return f;
  return (...a) => {
    const s = a[0];
    if ((k === 'propose' || k === 'applyPeace') && SIM.isHuman(s, a[2])) { MP.conq.mpOffer({ from: a[1], to: a[2], kind: k === 'propose' ? a[3] : 'peace', deal: k === 'applyPeace' ? a[3] : undefined, demand: k === 'applyPeace' && a[3] !== 'white' && a[3] !== 'concede' }); return { ok: true, msg: 'Propuesta enviada.' }; }
    if (k === 'offerPuppet' && SIM.isHuman(s, a[2])) return { ok: false, msg: 'No disponible entre jugadores.' };
    if (MP.role === 'guest') { MP.conq.mpCmd(k, a.slice(1)); QUIET = true; try { return f(...a); } finally { QUIET = false; } }
    return f(...a);
  };
} });

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
    this.mpOffs = [];
    if (multiplayer.role === 'guest') return this.#guestInit();
    if (multiplayer.role === 'host') this.mpOffs.push(multiplayer.on('status', () => { if (this.s && !MP && multiplayer.role === 'host' && multiplayer.code) this.#mpStart(); }));
    const saved = store.state.conquest.campaign; if (saved && saved.v === 2 && !saved.over) this.#menu(); else { if (saved) store.mutate(st => { st.conquest.campaign = null; }); this.#setup(); }
  }
  unmount() { const guest = this.isGuest; this.#mpStop(); this.#stopLoop(); if (!guest) this.#save(); this.root?.remove(); this.back?.remove(); this.panelModal?.close(); }
  #save() { if (this.s && !this.s.over && !this.isGuest) store.mutate(st => { st.conquest.campaign = this.s; }); store.save(); }
  get me() { return this.s?.nations[this.s.player]; }
  get isGuest() { return MP?.role === 'guest'; }
  get isHost() { return MP?.role === 'host'; }

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
  #begin(id) { if (this.isHost) { multiplayer.send({ t: 'cq:restart' }); this.seats.clear(); this.sent.clear(); } this.s = S.newGame(id); store.mutate(st => { st.conquest.campaign = this.s; }); this.sel = null; this.setupMode = false; this.#play(); }

  // ------------------------------------------------------------ real-time loop
  #play() {
    this.setupMode = false; this.sel = null; this.sheet.style.display = 'none'; this.ended = false; this.speed = 1; S.markAll();
    if (!this.isGuest && !MP) SIM.normalizeSolo(this.s);
    if (this.isHost) this.speed = 1;
    this.askedDead = false; this.#buildHud(); this.#paintAll(this.s); this.#refreshHud(); this.map.focus(this.me.cap, 0.3); this.#startLoop();
    if (this.isHost) multiplayer.send({ t: 'cq:invite', name: store.state.name });
    else if (!this.isGuest && multiplayer.role === 'host' && multiplayer.code) this.#mpStart();
  }
  #startLoop() {
    this.#stopLoop(); let last = performance.now(), hudT = 0, saveT = 0;
    const frame = now => {
      this.raf = requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last) / 1000); last = now; const s = this.s; if (!s || s.over) return;
      if (this.speed > 0 && !this.isGuest) { s.acc += dt * this.speed / DAY_SECS; let n = 0; while (s.acc >= 1 && n < 10) { s.acc -= 1; S.tick(s); n++; if (s.over) break; } if (s.acc > 10) s.acc = 0; }
      if (this.isHost) { this.syncT = (this.syncT ?? 0) + dt; if (this.syncT > 0.6) { this.syncT = 0; this.#mpSync(); } }
      const dirty = S.drainDirty(); if (dirty.length) this.#paintRegions(dirty); if (S.drainRel()) this.#paintAll(s);
      hudT += dt; if (hudT > 0.25) { hudT = 0; this.#refreshHud(); this.#drawOverlay(); if (this.panel) this.panel(); if (MP && this.me && !this.me.alive && !s.over && !this.picking && !this.askedDead) { this.askedDead = true; this.#deadModal(); } }
      saveT += dt; if (saveT > 15) { saveT = 0; this.#save(); }
      if (s.over) this.#checkOver();
    };
    this.raf = requestAnimationFrame(frame);
  }
  #stopLoop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  // Visual events: instead of text toasts, the map shows animated rings/emojis where things happen and
  // a compact stack of "flag ⚔️ flag" chips for what concerns the player (tap a chip to jump there).
  #onEvent(e) {
    if (QUIET) return; if (this.isHost) this.#fwd(e);
    const p = this.s?.player; if (!p) return; const fx = e.fx;
    if (fx) {
      const tone = e.tone === 'epic' ? 'epic' : fx.a === p ? 'good' : fx.b === p ? 'bad' : '';
      this.#mapFx(fx, p);
      if (fx.k !== 'blast' && fx.k !== 'claim' && e.who?.includes(p)) this.#chip(fx, tone, p);
      this.#feel(fx, p); return;
    }
    if (!e.who?.includes(p)) return;
    if (e.tone === 'bad' || e.tone === 'good' || e.tone === 'epic') toast(e.text, e.tone);
    if (e.inbox) this.#refreshHud();
  }
  #mapFx(fx, p) {
    if (!fx.at || !S.REG[fx.at]) return; const r = S.REG[fx.at], a = this.s.nations[fx.a];
    this.fxN = (this.fxN ?? 0); if (this.fxN > 14) return; this.fxN++;
    const mine = fx.a === p || fx.b === p, col = fx.k === 'peace' || fx.k === 'pact' ? '#3ddc84' : fx.k === 'claim' ? '#ffe45c' : fx.a === p ? '#7dff9a' : fx.b === p ? '#ff4d4d' : '#ffb347';
    const g = svgEl('g', { transform: `translate(${r.cx} ${r.cy})` }), ring = svgEl('circle', { r: 2, fill: 'none', stroke: col, 'stroke-width': 1.4, class: 'fx-ring', 'vector-effect': 'non-scaling-stroke' });
    const big = fx.k === 'conquer' || fx.k === 'bomb' || fx.k === 'empire' || fx.k === 'sp' || fx.k === 'dead';
    const em = svgEl('text', { 'font-size': big ? 12 : fx.k === 'claim' ? 6 : 9, 'text-anchor': 'middle', class: 'fx-pop' }); em.textContent = fx.icon ?? '💥';
    g.append(ring); if (fx.k !== 'claim') g.append(svgEl('circle', { r: 3, fill: col, opacity: 0.35, class: 'fx-ring' })); g.append(em);
    if (a && (fx.k === 'conquer' || fx.k === 'war')) { const f = svgEl('image', { x: -3, y: 3, width: 6, height: 6, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#cbclip)', class: 'fx-pop' }); f.setAttribute('href', flagUrl(a.flag)); g.append(f); }
    this.map.overlay.append(g); setTimeout(() => { g.remove(); this.fxN--; }, 1500);
  }
  #chip(fx, tone, p) {
    const s = this.s, A = s.nations[fx.a], B = fx.b ? s.nations[fx.b] : null; if (!A) return;
    this.chips ??= h('div.fxchips'); if (!this.chips.isConnected) this.root.append(this.chips);
    const key = `${fx.k}:${fx.a}:${fx.b}`; let c = [...this.chips.children].find(x => x.dataset.k === key);
    if (c) { c.dataset.n = +c.dataset.n + 1; c.querySelector('.n').textContent = '×' + c.dataset.n; c.querySelector('.n').style.display = 'inline'; clearTimeout(c._t); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }
    else {
      const side = n => n ? h('div.fxb', ballAvatar(n.flag, 30)) : null;
      c = h('div.fxchip.' + (tone || 'x'), { 'data-k': key, 'data-n': 1, onclick: () => { sfx.click(); if (fx.at) { this.map.focus(fx.at, 0.18); } } }, side(A), h('span.ic', fx.icon ?? '💥'), side(B), h('span.n', { style: { display: 'none' } }, ''));
      this.chips.prepend(c); while (this.chips.children.length > 4) this.chips.lastChild.remove();
    }
    c._t = setTimeout(() => { c.classList.add('out'); setTimeout(() => c.remove(), 350); }, fx.k === 'war' || fx.k === 'peace' || fx.k === 'sp' || fx.k === 'empire' ? 6500 : 4500);
  }
  #feel(fx, p) {
    const mine = fx.b === p, mineA = fx.a === p;
    if (mine && (fx.k === 'bomb' || fx.k === 'conquer' || fx.k === 'blast')) { this.#vignette(); navigator.vibrate?.(fx.k === 'conquer' ? [60, 40, 90] : 40); }
    if (mineA && fx.k === 'conquer') navigator.vibrate?.(30);
    if (fx.k === 'war' && fx.b === p) {              // war declared on you: sound + auto-pause so you can react
      sfx.war(); navigator.vibrate?.([80, 60, 80]); this.#vignette();
      if (this.speed > 0 && !MP) { this.speed = 0; this.#refreshSpeed(); this.#refreshHud(); } if (fx.at) this.map.focus(fx.at, 0.25);
    } else if (fx.k === 'peace' && (fx.a === p || fx.b === p)) sfx.treaty();
    else if ((fx.k === 'tech' || fx.k === 'sp') && fx.a === p) sfx.levelUp();
  }
  #vignette() {
    if (this.vig?.isConnected) { this.vig.classList.remove('on'); void this.vig.offsetWidth; } else this.vig = this.root.appendChild(h('div.hitflash'));
    this.vig.classList.add('on');
  }

  // ------------------------------------------------------------ multiplayer
  mpCmd(k, args) { multiplayer.send({ t: 'cq:cmd', k, a: args }); }
  mpOffer(p) { if (this.isGuest) multiplayer.send({ t: 'cq:offer', p }); else SIM.addProposal(this.s, p); }
  #fwd(e) { if (!e.fx && !e.inbox && !e.who?.length) return; multiplayer.send({ t: 'cq:ev', e: { text: e.text, tone: e.tone, who: e.who, fx: e.fx, inbox: e.inbox } }); }

  // ---- host
  #mpStart() {
    if (MP || !this.s) return; MP = { role: 'host', conq: this }; this.seats = new Map(); this.sent = new Map(); this.syncN = 0; this.syncT = 0; this.speed = Math.max(1, this.speed);
    this.mpOffs.push(multiplayer.on('message', ({ from, msg }) => this.#hostMsg(from, msg)), multiplayer.on('peer-joined', ({ id }) => multiplayer.send({ t: 'cq:invite', name: store.state.name }, id)),
      multiplayer.on('player-left', p => { if (p.all) [...this.seats.keys()].forEach(k => this.#hostLeft(k)); else this.#hostLeft(p.id); }));
    multiplayer.send({ t: 'cq:invite', name: store.state.name }); this.#buildHud(); this.#refreshHud(); toast('🌐 Conquista multijugador: ¡tus amigos ya pueden unirse!', 'epic');
  }
  #mpStop() {
    this.mpOffs?.forEach(o => o()); this.mpOffs = []; clearInterval(this.helloT);
    if (MP?.role === 'host') { multiplayer.send({ t: 'cq:end' }); if (this.s) SIM.normalizeSolo(this.s); }
    else if (MP?.role === 'guest') multiplayer.send({ t: 'cq:leave' });
    MP = null;
  }
  #mpSync(to = null) {
    const s = this.s; if (!s || !multiplayer.connections.size) return; this.syncN++;
    const d = NS_.buildDelta(s, this.sent, { full: !!to, slow: this.syncN % 5 === 0 });
    if (Object.keys(d).length) multiplayer.send({ t: 'cq:sync', d, full: !!to }, to);
  }
  #hostMsg(from, m) {
    const s = this.s; if (!s || typeof m?.t !== 'string' || !m.t.startsWith('cq:')) return;
    if (m.t === 'cq:hello') { this.#mpSync(from); multiplayer.send({ t: 'cq:invite', name: store.state.name }, from); const own = this.seats.get(from); if (own) multiplayer.send({ t: 'cq:you', id: own }, from); return; }
    if (m.t === 'cq:leave') return this.#hostLeft(from);
    if (m.t === 'cq:pick') {
      const had = this.seats.get(from); if (had && s.nations[had]?.alive) return multiplayer.send({ t: 'cq:you', id: had }, from);
      const name = String(m.name ?? 'Jugador').slice(0, 16), r = SIM.claimSeat(s, m.id, name); if (!r.ok) return multiplayer.send({ t: 'cq:no', msg: r.msg }, from);
      this.seats.set(from, m.id); this.#mpSync(from); multiplayer.send({ t: 'cq:you', id: m.id }, from);
      SIM.log(s, `👤 ${name} juega con ${s.nations[m.id].name}.`, 'epic', s.humans, { k: 'join', icon: '👤', a: m.id, at: s.nations[m.id].cap }); return;
    }
    const nid = this.seats.get(from), n = s.nations[nid]; if (!nid || !n?.alive || n.bot) return;
    if (m.t === 'cq:cmd') {
      const k = m.k, a = Array.isArray(m.a) ? m.a : []; if (!(k in ACT) || typeof SIM[k] !== 'function') return; const idx = ACT[k];
      if (idx === 'rel') { if (s.nations[a[0]]?.overlord !== nid) return; }
      else if (k === 'breakPact') { const p = s.pacts.find(x => x.a === a[0]?.a && x.b === a[0]?.b && x.type === a[0]?.type); if (!p || a[1] !== nid || (p.a !== nid && p.b !== nid)) return; a[0] = p; }
      else if (a[idx] !== nid) return;
      if ((k === 'propose' || k === 'applyPeace' || k === 'offerPuppet') && SIM.isHuman(s, a[1])) return;
      if (k === 'applyPeace' && !SIM.peaceDecision(s, ...a).ok) return;
      try { SIM[k](s, ...a); } catch (e) { console.warn('[cq] cmd failed', k, e); } return;
    }
    if (m.t === 'cq:offer') { const p = m.p ?? {}; if (p.from !== nid || !SIM.isHuman(s, p.to) || p.to === nid || !s.nations[p.to]?.alive) return; if (p.kind !== 'peace' && !PACTS[p.kind]) return; SIM.addProposal(s, { from: nid, to: p.to, kind: p.kind, deal: p.deal, demand: !!p.demand }); return; }
    if (m.t === 'cq:accept') { const p = s.inbox.find(x => x.id === m.id && x.to === nid); if (p) SIM.acceptProposal(s, p); return; }
    if (m.t === 'cq:dismiss') { const i = s.inbox.findIndex(x => x.id === m.id && x.to === nid); if (i >= 0) s.inbox.splice(i, 1); }
  }
  #hostLeft(peerId) {
    const nid = this.seats?.get(peerId), s = this.s; if (!nid || !s) return; this.seats.delete(peerId); const n = s.nations[nid], who = n.pname || n.name;
    SIM.releaseSeat(s, nid); SIM.log(s, `👋 ${who} se desconectó: ${n.name} pasa a la IA.`, '', s.humans, { k: 'leave', icon: '👋', a: nid, at: n.cap });
  }

  // ---- guest
  #guestInit() {
    MP = { role: 'guest', conq: this }; this.s = null; this.sheet.style.display = 'none';
    this.hud.replaceChildren(h('div.hud-top', { style: { left: '64px' } }, h('div.chip', '🌐 Esperando a que el anfitrión inicie Conquista…')));
    this.mpOffs.push(multiplayer.on('message', ({ msg }) => this.#guestMsg(msg)), multiplayer.on('player-left', () => { if (!multiplayer.connections.size) this.#hostGone(); }));
    multiplayer.send({ t: 'cq:hello' }); this.helloT = setInterval(() => { if (!this.s) multiplayer.send({ t: 'cq:hello' }); }, 3000);
  }
  #guestMsg(m) {
    if (typeof m?.t !== 'string' || !m.t.startsWith('cq:')) return;
    if (m.t === 'cq:invite') { if (!this.s) multiplayer.send({ t: 'cq:hello' }); return; }
    if (m.t === 'cq:end') return this.#hostGone();
    if (m.t === 'cq:restart') { this.s = null; this.picking = false; this.ended = false; this.#stopLoop(); this.sheet.style.display = 'none'; this.hud.replaceChildren(h('div.hud-top', { style: { left: '64px' } }, h('div.chip', '🌐 El anfitrión empezó una partida nueva…'))); return; }
    if (m.t === 'cq:no') return toast(m.msg ?? 'No se pudo elegir ese país.', 'bad');
    if (m.t === 'cq:sync') {
      if (m.full || !this.s) { const had = !!this.s; this.#stopLoop(); this.s = NS_.freshState(); this.ended = false; NS_.applyDelta(this.s, m.d); S.markAll(); this.#pickMode(); if (had) this.askedDead = false; return; }
      const { dirty, rel } = NS_.applyDelta(this.s, m.d); S.markDirty(dirty); if (rel) S.markRel();
      if (this.s.over) this.#checkOver(); return;
    }
    if (!this.s) return;
    if (m.t === 'cq:you') { this.s.player = m.id; this.picking = false; this.askedDead = false; this.#close(); this.#play(); return; }
    if (m.t === 'cq:ev') { const e = m.e, p = this.s.player; if (e.text && p && e.who?.includes(p)) { this.s.log.unshift({ t: this.s.t, text: e.text, tone: e.tone }); if (this.s.log.length > 70) this.s.log.length = 70; } this.#onEvent(e); }
  }
  #hostGone() {
    if (this.gone) return; this.gone = true; this.#stopLoop(); this.panelModal?.close();
    const m = modal('🌐 Partida terminada', [h('p', 'El anfitrión salió de la partida.'), h('button.btn.gold', { style: { width: '100%' }, onclick: () => { m.close(); this.exit(); } }, 'Volver al inicio')]);
  }

  // ---- country picking (guests joining, or anyone whose country was wiped out)
  #pickMode() {
    this.picking = true; this.sel = null; this.sheet.style.display = 'none';
    this.hud.replaceChildren(h('div.hud-top', { style: { left: '64px' } }, h('div.chip', '🗺️ Elige un país libre: toca uno en el mapa')));
    this.#paintAll(this.s); this.#drawMarkers(this.s); if (!this.raf) this.#startLoop();
  }
  #showPick(id) {
    const s = this.s, o = s.regions[id].owner, n = o ? s.nations[o] : null;
    if (!n) { this.sheet.replaceChildren(h('div.row', h('div.grow.mute', 'Tierra sin dueño: elige un país con color.'), h('button.btn.sm', { onclick: () => this.#close() }, '✕'))); this.sheet.style.display = 'block'; return; }
    const taken = SIM.isHuman(s, n.id);
    this.sheet.replaceChildren(h('div.row', ballAvatar(n.flag, 54), h('div.grow', h('div', { style: { fontSize: '18px', fontWeight: 800 } }, n.name), h('div.mute', { style: { fontSize: '12px' } }, `${n.regs.length} zonas · 🪖${fmt(n.troops)}k · $${fmt(S.gdpOf(s, n))}B`)), h('button.btn.sm', { onclick: () => this.#close() }, '✕')),
      taken ? h('p.mute', `👤 Ya lo juega ${n.pname || 'otro jugador'}.`) : h('button.btn.green', { style: { width: '100%', marginTop: '8px' }, onclick: () => this.#claim(n.id) }, `✔ Jugar con ${n.name}`));
    this.sheet.style.display = 'block';
  }
  #claim(id) {
    const name = store.state.name || 'Jugador';
    if (this.isGuest) return multiplayer.send({ t: 'cq:pick', id, name });
    const r = SIM.claimSeat(this.s, id, name); if (!r.ok) return toast(r.msg, 'bad');
    this.s.player = id; this.picking = false; this.#close(); this.#play();
  }
  #deadModal() {
    const m = modal('😢 Te eliminaron', [h('p', 'Tu país desapareció, pero la partida sigue. Puedes tomar el control de otro país libre.'), h('button.btn.green', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { m.close(); this.#pickMode(); } }, '🗺️ Elegir otro país'), h('button.btn', { style: { width: '100%' }, onclick: () => m.close() }, '👀 Seguir mirando')]);
  }

  // ------------------------------------------------------------ HUD
  #buildHud() {
    this.elStats = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }); this.badge = h('span', { style: { background: '#ff4d4d', borderRadius: '9px', padding: '0 6px', marginLeft: '4px', fontSize: '11px' } });
    this.speedBtns = (this.speedList = this.isGuest ? [] : this.isHost ? [1, 2, 4] : SPEEDS).map(v => h('button.btn.sm', { onclick: () => { this.speed = v; sfx.click(); this.#refreshSpeed(); } }, v === 0 ? '⏸' : v + '×'));
    const bar = h('div', { style: { position: 'absolute', left: '10px', bottom: 'calc(14px + env(safe-area-inset-bottom))', display: 'flex', gap: '6px', zIndex: 2 } }, ...(this.isGuest ? [h('span.chip', '🌐 Multijugador')] : this.speedBtns));
    this.hud.replaceChildren(h('div.hud-top', { style: { left: '64px', alignItems: 'flex-start' } }, this.elStats, h('div.grow'), h('div', { style: { display: 'grid', gap: '6px' } },
      h('button.btn.sm', { onclick: () => this.#inbox() }, '🔔', this.badge), h('button.btn.sm', { onclick: () => this.#openPanel('mil') }, '🏛'), h('button.btn.sm', { onclick: () => this.#logModal() }, '📜'), h('button.btn.sm', { onclick: () => this.#menuModal() }, '☰'))), bar);
    this.#refreshSpeed();
  }
  #refreshSpeed() { this.speedBtns?.forEach((b, i) => { b.style.outline = this.speedList[i] === this.speed ? '3px solid #ffc933' : 'none'; }); }
  #refreshHud() {
    const s = this.s; if (!s || !this.elStats || !this.me) return; const n = this.me, e = S.econ(s, n), r = n.research;
    const rs = r ? `🔬 ${TECHS[r.id].name} ${Math.floor(r.got / TECHS[r.id].cost * 100)}%` : '🔬 —';
    this.elStats.replaceChildren(...[`📅 ${dateOf(s.t).text}${this.speed === 0 ? ' ⏸' : ''}`, `🪙 ${fmt(n.money)} (${e.net >= 0 ? '+' : ''}${e.net.toFixed(1)}/d)`, `🏭 ${fmt(n.ind)}`, `🪖 ${fmt(n.troops)}k/${fmt(S.troopCap(s, n))}k`, `⚓ ${n.ships}`, rs, `🌍 ${(S.share(s, n.id) * 100).toFixed(1)}% (60 % gana)`].map((t, i) => h('span.chip', { style: { padding: '3px 9px', fontSize: '13px', color: i === 1 && e.net < 0 ? 'var(--bad)' : '' } }, t)));
    const ib = this.#myInbox().length; this.badge.textContent = ib || ''; this.badge.style.display = ib ? 'inline' : 'none';
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
    const p = s.player, show = new Set([p, ...S.enemiesOf(s, p), ...S.alliesOf(s, p), ...S.puppetsOf(s, p).map(v => v.id)]); if (this.sel && s.regions[this.sel]?.owner) show.add(s.regions[this.sel].owner); for (const hid of s.humans ?? []) show.add(hid);
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
    const id = this.sel; if (!id) return; if (this.picking) return this.#showPick(id); const play = !!this.s, s = this.s ?? this.setupState, reg = s.regions[id], n = reg.owner ? s.nations[reg.owner] : null, me = play ? this.me : null;
    if (!n) return this.#showNeutral(id, play);
    const gdp = S.gdpOf(s, n), pop = S.popOf(s, n), r = play && n.id !== me.id ? S.rel(s, me.id, n.id) : 0, chips = [];
    if (play && n.id !== me.id) { if (S.atWar(s, me.id, n.id)) chips.push('⚔ En guerra'); if (S.isAllied(s, me.id, n.id)) chips.push('🤝 Aliado'); for (const t of ['embassy', 'coop', 'trade']) if (S.pactOf(s, me.id, n.id, t)) chips.push(PACTS[t].icon + ' ' + PACTS[t].name); if (n.overlord === me.id) chips.push('🎭 Tu estado títere'); else if (n.overlord) chips.push('🎭 Títere de ' + s.nations[n.overlord].name); }
    if (play && n.id !== me.id && S.isHuman(s, n.id)) chips.push('👤 ' + (n.pname || 'Jugador'));
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
    const ask = type => this.#act(s => { const r = S.propose(s, me.id, n.id, type); const hum = S.isHuman(s, n.id); if (r.ok && !hum) sfx.treaty(); return { ok: r.ok, msg: r.ok ? (hum ? `Propuesta enviada a ${n.name}.` : `¡${n.name} aceptó: ${PACTS[type].name.toLowerCase()}!`) : `${n.name}: “${r.msg}”` }; });
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
  #myInbox() { const s = this.s; return s.inbox.filter(p => (p.to ?? s.player) === s.player); }
  #inbox() {
    const s = this.s, m = modal('🔔 Mensajes', ''); const label = p => { const f = s.nations[p.from], d = { cede1: 'una zona tuya', cede3: 'tres zonas tuyas', reparations: 'el 40 % de tu tesoro', puppet: 'que te sometas (estado títere)' }; return p.kind === 'peace' ? (p.demand ? `${f.name} exige: ${d[p.deal] ?? 'rendición'}` : p.deal === 'concede' ? `${f.name} paga monedas por la paz` : `${f.name} quiere hacer las paces`) : `${f.name} propone: ${PACTS[p.kind].name.toLowerCase()}`; };
    const render = () => { const box = this.#myInbox(); m.body.replaceChildren(...(box.length ? box.map(p => { const f = s.nations[p.from]; return h('div.card', { style: { flexDirection: 'row', textAlign: 'left', marginBottom: '8px' } }, ballAvatar(f.flag, 40), h('div.grow', label(p)), h('button.btn.green.sm', { onclick: () => { this.#accept(p); render(); } }, '✔'), h('button.btn.red.sm', { onclick: () => { this.#dismiss(p); render(); } }, '✖')); }) : [h('p.mute', 'No hay mensajes.')])); }; render();
  }
  #dismiss(p) { if (this.isGuest) multiplayer.send({ t: 'cq:dismiss', id: p.id }); const i = this.s.inbox.indexOf(p); if (i >= 0) this.s.inbox.splice(i, 1); this.#refreshHud(); }
  #accept(p) { if (this.isGuest) { multiplayer.send({ t: 'cq:accept', id: p.id }); QUIET = true; try { S.acceptProposal(this.s, p); } finally { QUIET = false; } } else S.acceptProposal(this.s, p); sfx.treaty(); this.#act(() => ({ ok: true, msg: '¡Aceptado!' })); }
  #logModal() { modal('📜 Historia', this.s.log.slice(0, 50).map(l => h('div', { style: { padding: '4px 0', borderBottom: '1px solid #fff1', color: l.tone === 'bad' ? 'var(--bad)' : l.tone === 'good' ? 'var(--good)' : '' } }, h('span.mute', `${dateOf(l.t).text} `), l.text))); }
  #menuModal() {
    const s = this.s, humans = (s.humans ?? [s.player]).map(id => s.nations[id]).filter(Boolean);
    const m = modal('☰ Partida', [h('div.kv', h('span.mute', 'Fecha'), h('b', dateOf(s.t).text), h('span.mute', 'Mundo que controlas'), h('b', (S.share(s, s.player) * 100).toFixed(1) + '% (¡60 % gana!)'), h('span.mute', 'Guerras'), h('b', S.enemiesOf(s, s.player).length), h('span.mute', 'Países vivos'), h('b', S.alive(s).length)),
      MP ? h('div', { style: { margin: '10px 0' } }, h('div.mute', { style: { fontSize: '12px' } }, '👥 Jugadores'), ...humans.map(n => h('div.row', { style: { marginTop: '4px' } }, ballAvatar(n.flag, 28), h('div.grow', `${n.id === s.player ? 'Tú' : (n.pname || 'Jugador')} · ${n.name}${n.alive ? '' : ' ☠'}`), h('b', (S.share(s, n.id) * 100).toFixed(1) + '%')))) : null,
      h('div', { style: { height: '10px' } }), h('button.btn', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { this.map.reset(); m.close(); } }, '🌍 Ver todo el mapa'), h('button.btn', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { m.close(); this.#openPanel('space'); } }, '🚀 Carrera espacial'),
      this.isGuest ? null : h('button.btn.blue', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { m.close(); multiplayer.openMenu(); } }, `🌐 Multijugador${MP ? ` · sala ${multiplayer.code}` : ': crear sala e invitar'}`),
      this.isGuest ? h('button.btn.red', { style: { width: '100%' }, onclick: () => { m.close(); this.exit(); } }, 'Salir de la partida')
        : h('button.btn.red', { style: { width: '100%' }, onclick: () => confirmBox('¿Dejarla?', MP ? 'Se borrará esta partida y se echará a los invitados.' : '¿Borrar esta partida?', () => { m.close(); this.#mpStop(); this.#stopLoop(); store.mutate(st => { st.conquest.campaign = null; }); this.s = null; this.#setup(); }) }, 'Dejar la partida')]);
  }
  #checkOver() {
    const s = this.s; if (!s?.over || this.ended) return; this.ended = true; if (this.isHost) this.#mpSync(); this.#stopLoop(); const o = s.over, win = o.winner ? o.winner === s.player : o.type === 'win';
    if (win) { store.mutate(st => { st.conquest.wins++; if (!this.isGuest) st.conquest.campaign = null; st.stats.conquests += this.me.regs.length; }); const prize = 2000 + Math.floor(s.t / 10); addCoins(prize); addProfileXp(300); checkAchievements(); sfx.levelUp(); this.prize = prize; }
    else if (!this.isGuest) store.mutate(st => { st.conquest.campaign = null; });
    const txt = win ? (o.why === 'luna' ? `¡Plantaste tu bandera en la Luna en ${dateOf(s.t).text}! Premio: 🪙 ${this.prize}` : `¡Dominas el mundo en ${dateOf(s.t).text}! Premio: 🪙 ${this.prize}`)
      : o.why === 'luna' ? `${s.nations[o.winner]?.name} plantó su bandera en la Luna y ganó la partida.` : o.why === 'dominacion' ? `${s.nations[o.winner]?.name} domina el mundo.` : 'Tu país se quedó sin territorio.';
    const m = modal(win ? '🏆 ¡Victoria!' : '😢 Derrota', [h('p', txt), h('button.btn.gold', { style: { width: '100%' }, onclick: () => { m.close(); this.ended = false; if (this.isGuest) { this.exit(); return; } this.s = null; this.#setup(); } }, this.isGuest ? 'Volver al inicio' : 'Partida nueva')]);
  }
}

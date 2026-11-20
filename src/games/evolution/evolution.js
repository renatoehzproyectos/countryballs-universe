import * as THREE from 'three';
import { Countryball } from '../../characters/countryball.js';
import { LiteBall } from '../../characters/liteball.js';
import { disposeScene } from '../../core/engine.js';
import { input } from '../../core/input.js';
import { store } from '../../core/store.js';
import { bus } from '../../core/events.js';
import { sfx } from '../../core/audio.js';
import { BALLS, BALL_BY_ID } from '../../data/countryballs.js';
import { WORLDS, WORLD_BY_ID, evoXpNeeded, rebirthLevelNeeded } from '../../data/worlds.js';
import { EGGS, PET_BY_ID } from '../../data/pets.js';
import { addCoins, addGems, addProfileXp, getMultipliers, grantBall, checkAchievements } from '../../core/economy.js';
import { hatchEgg, maxPetSlots } from '../../core/pets.js';
import { h, ui, fmt, ballAvatar, modal, confirmBox, toast } from '../../ui/dom.js';
import { mountJoystick } from '../../ui/joystick.js';
import { openShop, openInventory, openCollection } from '../../ui/panels.js';
import { buildArena, SHAPES, ARENA } from './world.js';

const eyeG = new THREE.SphereGeometry(0.2, 8, 6), pupG = new THREE.SphereGeometry(0.1, 6, 4);
const eyeM = new THREE.MeshBasicMaterial({ color: '#fff' }), pupM = new THREE.MeshBasicMaterial({ color: '#000' });
const rnd = (a, b) => a + Math.random() * (b - a);
const unlocked = (w, e) => e.level >= w.req.level && e.rebirths >= w.req.rebirth;

/** Game One — Countryballs Evolution: explore, fight, collect, evolve, rebirth. */
export default class EvolutionGame {
  constructor(manager) {
    this.manager = manager; this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
    this.enemies = []; this.coins = []; this.chests = []; this.relics = []; this.npcs = []; this.pets = []; this.bolts = []; this.telegraphs = [];
    this.boss = null; this.altar = null; this.kills = 0; this.hp = 100; this.invuln = 0; this.atkCd = 0; this.spawnCd = 0; this.dead = 0;
    this.coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.12, 12); this.coinMat = new THREE.MeshStandardMaterial({ color: '#ffd23a', emissive: '#aa7a00', metalness: 0.7, roughness: 0.3 });
  }

  get ev() { return store.state.evolution; }
  get def() { return WORLD_BY_ID[this.ev.world]; }
  get tier() { return this.def.tier; }
  get maxHp() { return 100 + 12 * this.ev.level; }
  get atk() { return (10 + 3 * this.ev.level) * getMultipliers().attack; }

  async mount({ exit }) {
    this.exit = exit;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#556', 1.1)); const sun = new THREE.DirectionalLight('#fff', 1.4); sun.position.set(10, 20, 8); this.scene.add(sun);
    this.player = new Countryball({ flag: BALL_BY_ID[store.state.selectedBall].flag, ...store.state.equipped }); await this.player.ready;
    this.scene.add(this.player.group);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 14), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3 })); this.shadow.rotation.x = -Math.PI / 2; this.scene.add(this.shadow);
    this.#buildHud(); this.joyOff = mountJoystick();
    this.offs = [bus.on('change', () => this.#refreshHud()), bus.on('ball-changed', () => this.#refreshPlayer())];
    if (!unlocked(this.def, this.ev)) store.mutate(s => { s.evolution.world = 'europe'; });
    this.loadWorld(this.ev.world); this.hp = this.maxHp;
    this.#syncPets(); toast('Move with the joystick / WASD. Attacks are automatic!');
  }

  // ------------------------------------------------------------------ world
  loadWorld(id) {
    if (this.arena) { this.scene.remove(this.arena); disposeScene(this.arena); }
    [...this.enemies, ...this.coins, ...this.chests, ...this.relics, ...this.npcs].forEach(e => this.scene.remove(e.mesh));
    this.altar && this.scene.remove(this.altar.mesh);
    this.enemies = []; this.coins = []; this.chests = []; this.relics = []; this.npcs = []; this.boss = null; this.kills = 0;
    store.mutate(s => { s.evolution.world = id; if (!s.evolution.worldsUnlocked.includes(id)) s.evolution.worldsUnlocked.push(id); });
    const d = this.def; this.arena = buildArena(this.scene, d); this.player.group.position.set(0, 1, 6);
    for (let i = 0; i < 24; i++) this.#spawnCoin();
    for (let i = 0; i < 6; i++) this.#spawnRelic();
    for (let i = 0; i < 3; i++) this.#spawnChest();
    d.npcs.forEach((n, i) => { const b = new LiteBall({ flag: n.flag, size: 0.9 }); const a = i * 2.4 + 0.8; b.group.position.set(Math.cos(a) * 12, 0.9, Math.sin(a) * 12 - 4); this.scene.add(b.group);
      this.npcs.push({ mesh: b.group, ball: b, def: n, key: `${id}:${i}` }); });
    const alt = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#7a3bd1', emissive: '#4a1a99', emissiveIntensity: 0.6 }));
    alt.position.set(0, 0.3, -14); this.scene.add(alt); this.altar = { mesh: alt };
    this.#refreshHud();
  }

  #randSpot(min = 6, max = ARENA - 3) { const a = rnd(0, 6.283), r = rnd(min, max); return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); }
  #spawnCoin(at, val) {
    const m = new THREE.Mesh(this.coinGeo, this.coinMat); m.rotation.x = Math.PI / 2; const p = at ?? this.#randSpot(); m.position.set(p.x, 0.7, p.z); this.scene.add(m);
    this.coins.push({ mesh: m, val: val ?? Math.round(2 * this.tier ** 1.7 * getMultipliers().coins), vel: new THREE.Vector3(), fly: false });
  }
  #spawnRelic() {
    const col = this.def.relic.color, m = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 }));
    const p = this.#randSpot(8); m.position.set(p.x, 1, p.z); this.scene.add(m); this.relics.push({ mesh: m });
  }
  #spawnChest() {
    const g = new THREE.Group(), box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1), new THREE.MeshStandardMaterial({ color: '#b8742a' })), lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.1), new THREE.MeshStandardMaterial({ color: '#ffc933', metalness: 0.6, roughness: 0.3 }));
    box.position.y = 0.5; lid.position.y = 1.15; g.add(box, lid); const p = this.#randSpot(10); g.position.set(p.x, 0, p.z); this.scene.add(g); this.chests.push({ mesh: g });
  }

  #spawnEnemy() {
    const d = this.def, t = this.tier, type = d.enemies[Math.floor(Math.random() * d.enemies.length)], lv = this.ev.level;
    const grp = new THREE.Group(), body = new THREE.Group(); const bm = new THREE.Mesh(SHAPES[type.shape](), new THREE.MeshStandardMaterial({ color: type.color, flatShading: true, roughness: 0.6 })); bm.position.y = 1; body.add(bm);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(eyeG, eyeM); e.position.set(sx * 0.35, 1.2, 0.75); e.scale.set(1, 1.3, 0.5); const p = new THREE.Mesh(pupG, pupM); p.position.set(sx * 0.35, 1.18, 0.85); p.scale.set(1, 1.2, 0.5); body.add(e, p); }
    grp.add(body);
    const bar = new THREE.Group(), bg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), new THREE.MeshBasicMaterial({ color: '#000', depthTest: false })), fg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), new THREE.MeshBasicMaterial({ color: '#ff4d4d', depthTest: false }));
    fg.position.z = 0.01; bg.renderOrder = 5; fg.renderOrder = 6; bar.add(bg, fg); bar.position.y = 2.7; grp.add(bar);
    const pos = this.player.group.position.clone().add(this.#randSpot(14, 24)); const r = Math.hypot(pos.x, pos.z); if (r > ARENA - 2) pos.multiplyScalar((ARENA - 2) / r); pos.y = 0; grp.position.copy(pos); this.scene.add(grp);
    const hp = 20 * t ** 1.8 * (1 + lv * 0.03);
    this.enemies.push({ mesh: grp, body, bar, fg, hp, max: hp, spd: 2.2 + t * 0.25, dmg: 5 + 6 * t, cd: 0, ph: Math.random() * 6, xp: 8 * t ** 1.6, coin: 5 * t ** 1.7 });
  }

  #summonBoss() {
    if (this.boss) return; if (this.kills < 8) { toast(`Defeat ${8 - this.kills} more enemies to awaken the boss`, 'bad'); return; }
    const t = this.tier, hp = 20 * t ** 1.8 * (1 + this.ev.level * 0.03) * 30;
    const b = new LiteBall({ flag: this.def.boss.flag, size: 3, angry: true }); b.group.position.set(0, 3, -14); this.scene.add(b.group);
    const bar = h('div.bar.boss', { style: { height: '14px', width: 'min(360px,70vw)' } }, h('i', { style: { width: '100%' } }));
    this.bossUi = h('div', { style: { position: 'fixed', top: 'calc(54px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 3 } }, h('div', { style: { fontWeight: 800, textShadow: '0 2px 0 #000' } }, '☠ ' + this.def.boss.name), bar);
    ui().append(this.bossUi); this.boss = { ball: b, mesh: b.group, hp, max: hp, dmg: (5 + 6 * t) * 1.6, spd: 3, slam: 3, bar: bar.firstChild }; this.kills = 0; sfx.boom(); toast(`${this.def.boss.name} has awakened!`, 'epic');
  }

  // ------------------------------------------------------------------ progression
  #gainXp(n) {
    const e = this.ev; n *= getMultipliers().xp; let leveled = false;
    store.mutate(s => { s.evolution.xp += n; while (s.evolution.xp >= evoXpNeeded(s.evolution.level) && s.evolution.level < 200) { s.evolution.xp -= evoXpNeeded(s.evolution.level); s.evolution.level++; leveled = true; } });
    addProfileXp(n * 0.4); if (leveled) this.#onLevelUp();
  }
  #onLevelUp() {
    const lv = this.ev.level; this.hp = this.maxHp; sfx.levelUp(); this.#burst(this.player.group.position, '#ffd23a'); toast(`⬆ Evolution level ${lv}!`, 'good');
    let newest = null; for (const b of BALLS) if (!b.secret && b.level <= lv && !store.state.ownedBalls.includes(b.id)) { grantBall(b.id, { announce: false }); newest = b; }
    if (newest) { toast(`✨ EVOLVED! ${newest.name} unlocked`, 'epic'); store.mutate(s => { s.selectedBall = newest.id; }); this.#refreshPlayer(); this.#burst(this.player.group.position, '#ff4d8d'); }
    for (const w of WORLDS) if (unlocked(w, this.ev) && !this.ev.worldsUnlocked.includes(w.id)) { store.mutate(s => { s.evolution.worldsUnlocked.push(w.id); }); toast(`🌍 World unlocked: ${w.name}`, 'epic'); }
    checkAchievements();
  }
  #refreshPlayer() { const s = store.state; this.player.setFlag(BALL_BY_ID[s.selectedBall].flag); this.player.setCosmetics(s.equipped); this.player.setHappy(true); setTimeout(() => this.player.setHappy(false), 1500); }

  #track(type, n = 1) {
    this.def.npcs.forEach((npc, i) => { if (npc.quest.type !== type) return; const k = `${this.def.id}:${i}`;
      store.mutate(s => { const q = (s.evolution.quests[k] ??= { p: 0, claimed: false }); if (!q.claimed) q.p = Math.min(npc.quest.n, q.p + n); }); });
  }

  #kill(e) {
    const m = getMultipliers(); this.scene.remove(e.mesh); this.enemies.splice(this.enemies.indexOf(e), 1); this.kills++;
    store.mutate(s => { s.stats.enemiesDefeated++; });
    this.#spawnCoin(e.mesh.position.clone(), Math.round(e.coin * m.coins)); this.#gainXp(e.xp); this.#track('kill'); sfx.hit(); this.#burst(e.mesh.position, '#fff');
    if (Math.random() < 0.05 * m.luck) this.#spawnRelic();
  }
  #killBoss() {
    const t = this.tier, b = this.boss; this.scene.remove(b.mesh); this.bossUi.remove(); this.boss = null; this.telegraphs.forEach(x => this.scene.remove(x.mesh)); this.telegraphs = [];
    const coins = Math.round(400 * t ** 1.8 * getMultipliers().coins), gems = 2 + t;
    addCoins(coins); addGems(gems); this.#gainXp(60 * t ** 1.7);
    const pet = hatchEgg(t < 4 ? EGGS[0] : EGGS[1]);
    store.mutate(s => { s.stats.bossesDefeated++; s.evolution.bossesKilled[this.def.id] = (s.evolution.bossesKilled[this.def.id] ?? 0) + 1; });
    this.#burst(b.mesh.position, '#ff4d8d', 40); sfx.levelUp(); checkAchievements();
    const m = modal('🏆 Boss defeated!', h('div.center', ballAvatar(pet.flag, 90), h('p', `${this.def.boss.name} dropped: 🪙 ${fmt(coins)} · 💎 ${gems} · 🥚 ${pet.name}`), h('button.btn.green', { onclick: () => m.close() }, 'Awesome')));
    this.kills = 0;
  }

  #hurt(d) {
    if (this.invuln > 0 || this.dead > 0) return; this.hp -= d; this.invuln = 0.8; sfx.hurt(); this.#float(this.player.group.position, '-' + Math.round(d), '#ff5d5d');
    if (this.hp <= 0) { this.dead = 2; this.hp = 0; toast('Knocked out! Respawning…', 'bad'); }
  }

  // ------------------------------------------------------------------ fx
  #float(pos, text, color = '#fff') {
    const v = pos.clone().setY(pos.y + 2).project(this.camera); if (v.z > 1) return;
    const el = h('div', { style: { position: 'fixed', left: (v.x * 0.5 + 0.5) * innerWidth + 'px', top: (-v.y * 0.5 + 0.5) * innerHeight + 'px', color, fontWeight: 900, textShadow: '0 2px 0 #000', pointerEvents: 'none', transition: 'transform .7s ease-out,opacity .7s', zIndex: 4 } }, text);
    ui().append(el); requestAnimationFrame(() => { el.style.transform = 'translateY(-40px)'; el.style.opacity = 0; }); setTimeout(() => el.remove(), 750);
  }
  #burst(pos, color, n = 14) {
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), new THREE.MeshBasicMaterial({ color, transparent: true })); m.position.copy(pos).setY(pos.y + 1); this.scene.add(m);
      this.bolts.push({ mesh: m, vel: new THREE.Vector3(rnd(-4, 4), rnd(2, 7), rnd(-4, 4)), life: 0.6, particle: true }); }
  }

  // ------------------------------------------------------------------ HUD
  #buildHud() {
    this.hud = h('div'); const s = store.state;
    this.elLevel = h('div', { style: { fontWeight: 800 } }); this.elXp = h('i'); this.elHp = h('i'); this.elNext = h('div.mute', { style: { fontSize: '11px' } });
    this.elCoins = h('div.chip'); this.elGems = h('div.chip'); this.elWorld = h('div.chip');
    this.ballChip = h('div');
    const top = h('div.hud-top', { style: { left: '64px' } }, h('div.chip', { style: { borderRadius: '16px' } }, this.ballChip, h('div', { style: { minWidth: '110px' } }, this.elLevel, h('div.bar', this.elXp), h('div.bar.hp', { style: { marginTop: '3px' } }, this.elHp), this.elNext)), h('div.grow'), h('div', { style: { display: 'grid', gap: '6px', justifyItems: 'end' } }, this.elCoins, this.elGems, this.elWorld));
    const back = h('button.btn.back', { onclick: () => this.exit() }, '🏠');
    this.prompt = h('button.btn.green.prompt', { style: { display: 'none', zIndex: 3 } });
    const dock = h('div.dock', { style: { right: '10px', left: 'auto', flexDirection: 'column', alignItems: 'flex-end', bottom: 'calc(30px + env(safe-area-inset-bottom))' } },
      h('button.btn.icon-btn', { onclick: () => this.#worldsMenu() }, '🗺️', h('small', 'Worlds')), h('button.btn.icon-btn', { onclick: () => openInventory() }, '🎒', h('small', 'Pets')),
      h('button.btn.icon-btn', { onclick: () => openCollection() }, '📖', h('small', 'Book')), h('button.btn.icon-btn', { onclick: () => this.#rebirthMenu() }, '🔄', h('small', 'Rebirth')),
      h('button.btn.icon-btn', { onclick: () => openShop() }, '🛒', h('small', 'Shop')));
    ui().append(top, back, dock, this.prompt); this.hudEls = [top, back, dock, this.prompt]; this.#refreshHud();
  }
  #refreshHud() {
    if (!this.elLevel) return; const s = store.state, e = s.evolution, nb = BALLS.filter(b => !b.secret && b.level > e.level)[0], mult = getMultipliers();
    this.elLevel.textContent = `Evo Lv ${e.level}${e.rebirths ? ' · ♻' + e.rebirths : ''}`; this.elXp.style.width = e.xp / evoXpNeeded(e.level) * 100 + '%';
    this.elNext.textContent = nb ? `Next: ${nb.name} @ Lv ${nb.level}` : 'All balls evolved!';
    this.elCoins.textContent = `🪙 ${fmt(s.coins)}  ×${mult.coins.toFixed(2)}`; this.elGems.textContent = '💎 ' + s.gems; this.elWorld.textContent = `${this.def.icon} ${this.def.name}`;
    const f = BALL_BY_ID[s.selectedBall].flag; if (this.ballFlag !== f) { this.ballFlag = f; this.ballChip.replaceChildren(ballAvatar(f, 34)); }
  }

  #worldsMenu() {
    const e = this.ev, m = modal('🗺️ Worlds', h('div', WORLDS.map(w => { const ok = unlocked(w, e);
      return h('button.btn', { style: { display: 'flex', width: '100%', gap: '10px', alignItems: 'center', marginBottom: '8px', textAlign: 'left', opacity: ok ? 1 : 0.55 }, onclick: () => { if (!ok) { sfx.wrong(); return; } m.close(); if (w.id !== e.world) { this.loadWorld(w.id); sfx.click(); } } },
        h('span', { style: { fontSize: '30px' } }, w.icon), h('div.grow', h('div', { style: { fontWeight: 800 } }, w.name), h('div.mute', { style: { fontSize: '12px' } }, ok ? `Boss: ${w.boss.name} · Tier ${w.tier}` : `🔒 Evo Lv ${w.req.level}${w.req.rebirth ? ` + ${w.req.rebirth} rebirth${w.req.rebirth > 1 ? 's' : ''}` : ''}`)), w.id === e.world ? '📍' : ''); })));
  }

  #rebirthMenu() {
    const e = this.ev, need = rebirthLevelNeeded(e.rebirths), ok = e.level >= need, m = store.state.stats;
    const mm = modal('🔄 Rebirth', [h('p', 'Reset your Evolution level, XP, worlds and quests to gain PERMANENT bonuses. Your Countryballs, pets, cosmetics and currency are kept.'),
      h('div.kv', h('span.mute', 'Requirement'), h('b', `Evo Lv ${need} ${ok ? '✔' : `(you: ${e.level})`}`), h('span.mute', 'Current rebirths'), h('b', e.rebirths), h('span.mute', 'Coins & XP'), h('b', `×${(1 + e.rebirths * 0.5).toFixed(1)} → ×${(1 + (e.rebirths + 1) * 0.5).toFixed(1)}`), h('span.mute', 'Damage'), h('b', `+15% each`), h('span.mute', 'Perks'), h('b', 'Pet slot @1 & @3, new worlds, secret balls')),
      h('div', { style: { height: '12px' } }), h('button.btn.gold', { disabled: !ok, style: { width: '100%' }, onclick: () => confirmBox('Rebirth now?', 'Your level resets to 1.', () => { mm.close(); this.#rebirth(); }) }, ok ? 'REBIRTH' : 'Not ready')]);
  }
  #rebirth() {
    store.mutate(s => { const e = s.evolution; e.rebirths++; s.stats.rebirths++; e.level = 1; e.xp = 0; e.world = 'europe'; e.worldsUnlocked = ['europe']; e.quests = {}; });
    sfx.levelUp(); toast('♻ Reborn! Permanent bonuses increased.', 'epic'); checkAchievements(); this.hp = this.maxHp; this.loadWorld('europe'); this.#syncPets();
  }

  #npcMenu(n) {
    const q = (store.state.evolution.quests[n.key] ??= { p: 0, claimed: false }), d = n.def.quest, done = q.p >= d.n, t = this.tier;
    const m = modal(n.def.name, h('div.center', ballAvatar(n.def.flag, 80), h('p', `"Brave ball! ${d.text}, and I'll reward you."`), h('div.bar', h('i', { style: { width: q.p / d.n * 100 + '%' } })), h('p.mute', `${Math.min(q.p, d.n)} / ${d.n}`),
      q.claimed ? h('p', '✅ Quest complete — come back after a rebirth!') : h('button.btn.gold', { disabled: !done, onclick: () => { const c = Math.round(120 * t ** 1.8 * getMultipliers().coins); addCoins(c); addGems(1 + (t >> 1)); this.#gainXp(40 * t ** 1.6); store.mutate(s => { s.evolution.quests[n.key].claimed = true; }); m.close(); toast(`Reward: 🪙 ${fmt(c)} + 💎`, 'good'); } }, done ? 'Claim reward' : 'In progress')));
  }

  #syncPets() {
    this.pets.forEach(p => { this.scene.remove(p.ball.group); p.ball.dispose(); }); this.pets = [];
    this.ev.equippedPets.forEach((id, i) => { const b = new LiteBall({ flag: PET_BY_ID[id].flag, size: 0.45 }); b.group.position.copy(this.player.group.position); this.scene.add(b.group); this.pets.push({ ball: b, i }); });
  }

  // ------------------------------------------------------------------ loop
  update(dt, t) {
    const p = this.player.group, m = getMultipliers(), ax = input.axis();
    if (this.dead > 0) { this.dead -= dt; if (this.dead <= 0) { this.hp = this.maxHp; p.position.set(0, 1, 6); this.invuln = 2; } }
    else {
      const dir = new THREE.Vector3(ax.x, 0, ax.y), moving = dir.lengthSq() > 0.01, speed = 7.5;
      if (moving) { p.position.addScaledVector(dir, speed * dt); let da = Math.atan2(dir.x, dir.z) - p.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); p.rotation.y += da * Math.min(1, dt * 12); }
      const r = Math.hypot(p.position.x, p.position.z); if (r > ARENA) p.position.multiplyScalar(ARENA / r);
      const b = moving ? Math.abs(Math.sin(t * 12)) * 0.3 : Math.sin(t * 2) * 0.04; p.position.y = 1 + b; this.player.squash(moving ? (0.5 - Math.abs(Math.sin(t * 12))) * 0.12 : 0);
    }
    this.invuln -= dt; p.visible = this.dead > 0 ? false : this.invuln > 0 ? Math.floor(t * 20) % 2 === 0 : true;
    this.shadow.position.set(p.position.x, 0.06, p.position.z);
    this.camera.position.lerp(new THREE.Vector3(p.position.x, 15, p.position.z + 12), Math.min(1, dt * 5)); this.camera.lookAt(p.position.x, 0, p.position.z - 1);

    // spawning
    this.spawnCd -= dt; if (this.spawnCd <= 0 && this.enemies.length < 12 + this.tier) { this.#spawnEnemy(); this.spawnCd = 1.2; }
    while (this.coins.length < 16) this.#spawnCoin(); while (this.relics.length < 3) this.#spawnRelic(); while (this.chests.length < 2) this.#spawnChest();

    // auto attack
    this.atkCd -= dt;
    if (this.atkCd <= 0 && this.dead <= 0) {
      let best = null, bd = 8; const targets = this.boss ? [...this.enemies, this.boss] : this.enemies;
      for (const e of targets) { const d = e.mesh.position.distanceTo(p.position) - (e === this.boss ? 2 : 0); if (d < bd) { bd = d; best = e; } }
      if (best) {
        this.atkCd = 0.55; const crit = Math.random() < 0.12 * m.luck, dmg = this.atk * (crit ? 2 : 1) * rnd(0.9, 1.1); best.hp -= dmg; sfx.hit();
        const geo = new THREE.BufferGeometry().setFromPoints([p.position.clone().setY(1.2), best.mesh.position.clone().setY(1.2)]);
        this.scene.add(Object.assign(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: crit ? '#ff4d8d' : '#ffe14a', transparent: true })), {})); const line = this.scene.children[this.scene.children.length - 1]; this.bolts.push({ mesh: line, life: 0.12, line: true });
        this.#float(best.mesh.position, Math.round(dmg) + (crit ? '!' : ''), crit ? '#ff4d8d' : '#fff');
        if (best === this.boss) { best.ball.squash(0.15); if (best.hp <= 0) this.#killBoss(); } else if (best.hp <= 0) this.#kill(best);
      }
    }
    // enemies
    for (const e of this.enemies) {
      const to = p.position.clone().sub(e.mesh.position).setY(0), d = to.length(); e.cd -= dt;
      if (d < 16 && this.dead <= 0) { to.normalize(); e.mesh.position.addScaledVector(to, e.spd * dt); e.body.rotation.y = Math.atan2(to.x, to.z); }
      else { e.mesh.position.x += Math.sin(t + e.ph) * dt; }
      e.body.position.y = Math.abs(Math.sin(t * 6 + e.ph)) * 0.25; e.body.rotation.x = Math.sin(t * 4 + e.ph) * 0.1;
      e.bar.quaternion.copy(this.camera.quaternion); e.fg.scale.x = Math.max(0.001, e.hp / e.max); e.fg.position.x = -0.8 * (1 - e.fg.scale.x);
      if (d < 1.6 && e.cd <= 0) { this.#hurt(e.dmg); e.cd = 1; }
    }
    if (this.boss) {
      const b = this.boss, to = p.position.clone().sub(b.mesh.position).setY(0), d = to.length();
      if (d > 4) { to.normalize(); b.mesh.position.addScaledVector(to, b.spd * dt); b.mesh.rotation.y = Math.atan2(to.x, to.z); }
      b.mesh.position.y = 3 + Math.abs(Math.sin(t * 3)) * 0.4; b.bar.style.width = Math.max(0, b.hp / b.max * 100) + '%'; b.slam -= dt;
      if (b.slam <= 0) { b.slam = 3.2; const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 4, 32), new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.45, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(p.position.x, 0.1, p.position.z); this.scene.add(ring); this.telegraphs.push({ mesh: ring, t: 1.1 }); }
    }
    for (const tg of [...this.telegraphs]) { tg.t -= dt; tg.mesh.material.opacity = 0.25 + 0.3 * Math.sin(tg.t * 12); if (tg.t <= 0) { if (tg.mesh.position.distanceTo(new THREE.Vector3(p.position.x, 0.1, p.position.z)) < 4) this.#hurt(this.boss?.dmg ?? 20); sfx.boom(); this.scene.remove(tg.mesh); this.telegraphs.splice(this.telegraphs.indexOf(tg), 1); } }

    // pickups
    const mag = 3.5 * m.magnet;
    for (const c of [...this.coins]) {
      c.mesh.rotation.z += dt * 4; const d = c.mesh.position.distanceTo(p.position);
      if (d < mag) c.fly = true;
      if (c.fly) { c.mesh.position.lerp(p.position, Math.min(1, dt * 9)); if (d < 1.1) { addCoins(c.val, { silent: false }); this.#track('coins', c.val); this.scene.remove(c.mesh); this.coins.splice(this.coins.indexOf(c), 1); } }
    }
    for (const r of [...this.relics]) { r.mesh.rotation.y += dt * 2; r.mesh.position.y = 1 + Math.sin(t * 3) * 0.2;
      if (r.mesh.position.distanceTo(p.position) < 1.8) { this.scene.remove(r.mesh); this.relics.splice(this.relics.indexOf(r), 1); const c = Math.round(20 * this.tier ** 1.7 * m.coins); addCoins(c); this.#gainXp(10 * this.tier ** 1.5); this.#track('relic'); toast(`Found ${this.def.relic.name}! +${fmt(c)}🪙`, 'good'); this.#burst(r.mesh.position, this.def.relic.color); } }
    for (const c of [...this.chests]) {
      if (c.mesh.position.distanceTo(p.position) < 2) { this.scene.remove(c.mesh); this.chests.splice(this.chests.indexOf(c), 1); this.#openChest(c); }
    }
    for (const n of this.npcs) { n.mesh.position.y = 0.9 + Math.abs(Math.sin(t * 3 + n.mesh.position.x)) * 0.15; n.mesh.lookAt(p.position.x, 0.9, p.position.z); }
    for (const pt of this.pets) { const g = pt.ball.group, a = t * 1.5 + pt.i * 2.1, tgt = p.position.clone().add(new THREE.Vector3(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2)); g.position.lerp(tgt, Math.min(1, dt * 4)); g.position.y = 0.6 + Math.abs(Math.sin(t * 6 + pt.i)) * 0.3; g.lookAt(p.position.x, g.position.y, p.position.z); }
    for (const b of [...this.bolts]) { b.life -= dt; if (b.particle) { b.mesh.position.addScaledVector(b.vel, dt); b.vel.y -= 14 * dt; b.mesh.material.opacity = Math.max(0, b.life / 0.6); }
      if (b.life <= 0) { this.scene.remove(b.mesh); b.mesh.geometry?.dispose(); b.mesh.material?.dispose(); this.bolts.splice(this.bolts.indexOf(b), 1); } }

    // interaction prompt
    let act = null, label = '';
    for (const n of this.npcs) if (n.mesh.position.distanceTo(p.position) < 3.5) { act = () => this.#npcMenu(n); label = '💬 Talk to ' + n.def.name; }
    if (!act && !this.boss && this.altar.mesh.position.distanceTo(p.position) < 4) { act = () => this.#summonBoss(); label = `☠ Summon ${this.def.boss.name} (${Math.min(8, this.kills)}/8)`; }
    if (act !== this.act) { this.prompt.style.display = act ? 'block' : 'none'; } if (act) { this.prompt.textContent = label; this.prompt.onclick = act; } this.act = act;
    this.elHp.style.width = Math.max(0, this.hp / this.maxHp * 100) + '%'; this.hp = Math.min(this.maxHp, this.hp + dt * (1 + this.ev.level * 0.1));
    this.altar.mesh.material.emissiveIntensity = 0.4 + Math.sin(t * 3) * 0.3;
  }

  #openChest() {
    const m = getMultipliers(), t = this.tier, r = Math.random();
    store.mutate(s => { s.stats.chestsOpened++; }); sfx.levelUp();
    if (r < 0.15 * m.luck) { const pet = hatchEgg(EGGS[0]); toast(`📦 Chest: ${pet.name} pet!`, 'epic'); }
    else if (r < 0.4) { const g = 1 + Math.floor(Math.random() * (1 + t)); addGems(g); toast(`📦 Chest: 💎 ${g}`, 'good'); }
    else { const c = Math.round(60 * t ** 1.8 * m.coins * rnd(0.8, 1.6)); addCoins(c); toast(`📦 Chest: 🪙 ${fmt(c)}`, 'good'); }
    this.#gainXp(15 * t ** 1.5);
  }

  unmount() {
    this.offs?.forEach(f => f()); this.joyOff?.(); this.hudEls?.forEach(e => e.remove()); this.bossUi?.remove();
    this.pets.forEach(p => p.ball.dispose()); this.player.dispose(); disposeScene(this.scene); this.scene.clear(); this.coinGeo.dispose(); this.coinMat.dispose();
  }
}

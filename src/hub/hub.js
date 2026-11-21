import * as THREE from 'three';
import { Countryball } from '../characters/countryball.js';
import { LiteBall } from '../characters/liteball.js';
import { disposeScene } from '../core/engine.js';
import { input } from '../core/input.js';
import { store } from '../core/store.js';
import { bus } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { BALL_BY_ID } from '../data/countryballs.js';
import { h, ui, ballAvatar, fmt, modal } from '../ui/dom.js';
import { mountJoystick } from '../ui/joystick.js';
import { openShop, openInventory, openCollection, openProfile } from '../ui/panels.js';
import { profileXpNeeded } from '../core/economy.js';
import { multiplayer } from '../core/multiplayer.js';

const label = (text, color = '#ffc933', w = 512) => {
  const c = document.createElement('canvas'); c.width = w; c.height = 128; const g = c.getContext('2d');
  g.font = '800 72px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = '#0b1530'; g.strokeText(text, w / 2, 66);
  g.fillStyle = color; g.fillText(text, w / 2, 66);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  s.scale.set(4, 1, 1); s.renderOrder = 10; return s;
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...o });

/** The 3D home world: plaza, portal to the games, shop, locker and collection monument. */
export class Hub {
  constructor(manager) { this.manager = manager; this.scene = new THREE.Scene(); this.interactables = []; this.wanderers = []; this.target = null; this.camYaw = 0; this.jy = 0; this.vy = 0; this.spin = 0; }

  async mount() {
    const sc = this.scene;
    sc.background = new THREE.Color('#7ec8ff'); sc.fog = new THREE.Fog('#a8dcff', 35, 95);
    sc.add(new THREE.HemisphereLight('#ffffff', '#4a7a3a', 1.1));
    const sun = new THREE.DirectionalLight('#fff3d0', 1.6); sun.position.set(12, 22, 10); sc.add(sun);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
    this.#buildWorld(); this.#buildLandmarks();
    this.player = new Countryball({ flag: BALL_BY_ID[store.state.selectedBall].flag, ...store.state.equipped });
    await this.player.ready; this.player.group.position.set(0, 1, 5); sc.add(this.player.group);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28 }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.02; sc.add(this.shadow);
    this.#spawnCrowd(); this.#bindInput(); this.#buildHud();
    this.remoteBalls = new Map();
    this.mpOffs = [multiplayer.on('player-state', p => this.#remoteState(p)), multiplayer.on('player-left', p => this.#remoteLeft(p))];
    this.off = bus.on('ball-changed', () => this.#refreshPlayer());
    this.offChange = bus.on('change', () => this.#updateHud());
    this.#updateHud(); this.#dailyReward();
  }

  #refreshPlayer() {
    const s = store.state, b = BALL_BY_ID[s.selectedBall];
    this.player.setFlag(b.flag); this.player.setCosmetics(s.equipped); this.player.setHappy(true); setTimeout(() => this.player.setHappy(false), 1200);
    this.#spawnCrowd();
  }

  #buildWorld() {
    const sc = this.scene;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 40), std('#58b04a')); ground.rotation.x = -Math.PI / 2; sc.add(ground); this.ground = ground;
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(14, 14.6, 0.3, 40), std('#e8e2d0')); plaza.position.y = 0.05; sc.add(plaza);
    for (const [r, c] of [[12.5, '#4aa3ff'], [9, '#ffc933'], [5, '#ff5d5d']]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 48), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.22; sc.add(ring);
    }
    // instanced trees (3 draw calls for 60 trees)
    const N = 60, trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), std('#7a4b25'), N);
    const l1 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 2.6, 7), std('#2f8f46'), N), l2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 2.2, 7), std('#3aa656'), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const a = Math.random() * 6.283, r = 19 + Math.random() * 36, k = 0.8 + Math.random() * 0.9; p.set(Math.cos(a) * r, 0, Math.sin(a) * r); s.setScalar(k);
      m.compose(p.clone().setY(0.8 * k), q, s); trunk.setMatrixAt(i, m);
      m.compose(p.clone().setY(2.6 * k), q, s); l1.setMatrixAt(i, m);
      m.compose(p.clone().setY(3.9 * k), q, s); l2.setMatrixAt(i, m);
    }
    sc.add(trunk, l1, l2);
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group(); for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + Math.random() * 1.5, 0), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.9 })); b.position.set(j * 2.2, Math.random(), Math.random() * 1.5); c.add(b); }
      c.position.set(-60 + Math.random() * 120, 22 + Math.random() * 10, -50 + Math.random() * 60); sc.add(c); this.clouds.push(c);
    }
  }

  #addInteractable(name, group, pos, radius, action, labelText, color) {
    group.position.copy(pos); this.scene.add(group);
    const lab = label(labelText, color); lab.position.set(0, 5, 0); group.add(lab);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 2; group.add(hit);
    hit.userData.action = action; this.interactables.push({ name, pos, radius, action, hit, group });
  }

  #buildLandmarks() {
    // Portal to the three games
    const portal = new THREE.Group();
    const gold = std('#ffc933', { metalness: 0.6, roughness: 0.3, flatShading: false, emissive: '#ffaa00', emissiveIntensity: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.32, 10, 40), gold); ring.position.y = 3.2; portal.add(ring);
    for (const x of [-2.6, 2.6]) { const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3.2, 8), std('#e8e2d0')); pil.position.set(x, 1.6, 0); portal.add(pil); }
    this.swirl = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), new THREE.MeshBasicMaterial({ map: this.#swirlTex(), transparent: true, side: THREE.DoubleSide })); this.swirl.position.y = 3.2; portal.add(this.swirl);
    this.#addInteractable('Juegos', portal, new THREE.Vector3(0, 0, -10), 4, () => this.openGames(), '▶ JUEGOS', '#ffc933');
    // Shop stall
    const shop = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 1.6), std('#a8693a')); counter.position.y = 0.6; shop.add(counter);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, 2.6), std('#e23b3b')); awning.position.y = 3.2; shop.add(awning);
    for (const x of [-2, 2]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 6), std('#fff')); pole.position.set(x, 1.6, 0.9); shop.add(pole); }
    shop.rotation.y = 0.6; this.#addInteractable('Tienda', shop, new THREE.Vector3(-10, 0, -2), 3.5, () => openShop(), '🛒 TIENDA', '#ff9a9a');
    // Locker / wardrobe
    const lock = new THREE.Group();
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 1.2), std(['#4aa3ff', '#7dc4ff', '#3a86d9'][i])); l.position.set((i - 1) * 1.25, 1.5, 0); lock.add(l); }
    lock.rotation.y = -0.6; this.#addInteractable('Armario', lock, new THREE.Vector3(10, 0, -2), 3.5, () => openInventory(), '🎒 ARMARIO', '#9fd0ff');
    // Collection monument
    const mon = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 1, 8), std('#e8e2d0')); base.position.y = 0.5; mon.add(base);
    this.book = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.2), std('#7a3bd1')); this.book.position.y = 1.6; mon.add(this.book);
    this.#addInteractable('Álbum', mon, new THREE.Vector3(0, 0, 11), 3, () => openCollection(), '📖 ÁLBUM', '#d9b3ff');
  }

  #swirlTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 5, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, '#7ad7ff'); gr.addColorStop(0.7, '#7a3bd1'); gr.addColorStop(1, '#2a0a66'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#ffffffaa'; g.lineWidth = 6; for (let k = 0; k < 4; k++) { g.beginPath(); for (let t = 0; t < 6; t += 0.1) { const r = t * 20, a = t + k * 1.57; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.center.set(0.5, 0.5); return t;
  }

  #spawnCrowd() {
    this.wanderers.forEach(w => { this.scene.remove(w.ball.group); w.ball.dispose(); }); this.wanderers = [];
    const ids = store.state.ownedBalls.filter(i => i !== store.state.selectedBall).slice(-7);
    ids.forEach((id, i) => {
      const b = new LiteBall({ flag: BALL_BY_ID[id].flag, size: 0.6 }); const a = i / ids.length * 6.283;
      b.group.position.set(Math.cos(a) * 8, 0.6, Math.sin(a) * 8 + 2); this.scene.add(b.group);
      this.wanderers.push({ ball: b, goal: new THREE.Vector3().copy(b.group.position), wait: Math.random() * 3, ph: Math.random() * 6 });
    });
  }

  #bindInput() {
    const el = document.getElementById('stage'); let down = null;
    this.onDown = e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: this.camYaw }; };
    this.onMove = e => { if (down && e.buttons !== 0 && !(e.target.closest?.('.joy'))) { const dx = e.clientX - down.x; if (Math.abs(dx) > 6) this.camYaw = down.yaw - dx * 0.006; } };
    this.onUp = e => {
      if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
      if (moved < 10 && dt < 350) this.#tap(e.clientX, e.clientY);
    };
    el.addEventListener('pointerdown', this.onDown); el.addEventListener('pointermove', this.onMove); el.addEventListener('pointerup', this.onUp);
    this.unbind = () => { el.removeEventListener('pointerdown', this.onDown); el.removeEventListener('pointermove', this.onMove); el.removeEventListener('pointerup', this.onUp); };
  }

  #tap(x, y) {
    const ndc = new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.camera);
    const hit = rc.intersectObjects(this.interactables.map(i => i.hit), false)[0];
    if (hit) { sfx.click(); hit.object.userData.action(); return; }
    const g = rc.intersectObject(this.ground)[0]; if (g) this.target = g.point.clone();
  }

  #buildHud() {
    this.joyOff = mountJoystick();
    this.hudTop = h('div.hud-top'); this.mpButton = h('button.btn.sm', { style: { position: 'fixed', right: '12px', top: 'calc(62px + env(safe-area-inset-top))', zIndex: 8 }, onclick: () => multiplayer.openMenu() }, '🌐 Multijugador'); this.dock = h('div.dock', { style: { gap: '8px' } },
      h('button.btn.icon-btn', { onclick: () => openShop() }, '🛒', h('small', 'Tienda')),
      h('button.btn.icon-btn', { onclick: () => openInventory() }, '🎒', h('small', 'Armario')),
      h('button.btn.gold.play', { onclick: () => this.openGames() }, '▶ JUGAR'),
      h('button.btn.icon-btn', { onclick: () => openCollection() }, '📖', h('small', 'Álbum')),
      h('button.btn.icon-btn', { onclick: () => openProfile() }, '👤', h('small', 'Perfil')),
      h('a.btn.icon-btn', { href: '/downloads/countryballs-universe.zip', download: 'countryballs-universe.zip', title: 'Descargar el juego (.zip)' }, '⬇️', h('small', 'Descargar')));
    this.prompt = h('button.btn.green.prompt', { style: { display: 'none' }, onclick: () => this.near?.action() });
    this.mission = h('div.chip.mission'); this.jumpBtn = h('button.btn.gold.jump', { onclick: () => { input.jump = true; } }, '🦘');
    this.emoteBtn = h('button.btn.icon-btn', { style: { position: 'fixed', left: '22px', bottom: 'calc(170px + env(safe-area-inset-bottom))' }, onclick: () => this.#emote() }, '😄');
    ui().append(this.hudTop, this.dock, this.prompt, this.mission, this.jumpBtn, this.emoteBtn, this.mpButton);
  }

  #remoteState(data) {
    if (data.scene !== 'hub') { this.#remoteLeft({ id: data.id }); return; }
    let entry=this.remoteBalls.get(data.id);
    if(!entry){const def=Object.values(BALL_BY_ID).find(b=>b.flag===data.flag)||BALL_BY_ID.pl;const ball=new LiteBall({flag:def.flag,size:1});this.scene.add(ball.group);entry={ball};this.remoteBalls.set(data.id,entry);}
    entry.ball.group.position.set(data.x,data.y||1,data.z);entry.ball.group.rotation.y=data.rotation||0;
  }
  #remoteLeft({id,all}={}) { for(const [key,e] of this.remoteBalls) if(all||key===id){this.scene.remove(e.ball.group);e.ball.dispose();this.remoteBalls.delete(key);} }

  #emote() { this.spin = 1; this.vy = Math.max(this.vy, 8); sfx.levelUp(); this.player.setHappy(true); setTimeout(() => this.player.setHappy(false), 1500); }

  #missionText() {
    const s = store.state;
    if (s.evolution.level < 3) return '🎯 Misión: ¡juega Evolución y llega al nivel 3!';
    if (s.stats.flagsCorrect < 10) return '🎯 Misión: ¡adivina 10 banderas!';
    if (!s.ownedCosmetics.length) return '🎯 Misión: ¡compra un sombrero en la tienda!';
    if (s.ownedEmpires.length < 1) return '🎯 Misión: ¡domina un continente de banderas y gana un imperio!';
    if (s.stats.conquests < 3) return '🎯 Misión: ¡conquista 3 territorios!';
    return '🎯 Misión: ¡colecciona todas las Countryballs!';
  }

  #dailyReward() {
    const s = store.state, today = new Date().toISOString().slice(0, 10); if (s.daily.last === today) return;
    const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10), streak = s.daily.last === yest ? s.daily.streak + 1 : 1, coins = 100 * Math.min(streak, 7), gems = streak % 7 === 0 ? 5 : 1;
    const m = modal('🎁 ¡Regalo diario!', h('div.center', h('div', { style: { fontSize: '64px' } }, '🎁'), h('p', `¡Día ${streak} seguido!`), h('p', `🪙 ${coins}  💎 ${gems}`), h('p.mute', 'Vuelve mañana para un premio más grande (hasta 7 días).'),
      h('button.btn.gold', { onclick: () => { store.mutate(x => { x.daily.last = today; x.daily.streak = streak; x.coins += coins; x.gems += gems; x.stats.coinsEarned += coins; }); sfx.levelUp(); m.close(); } }, '¡Recoger!')));
  }

  #updateHud() {
    const s = store.state; if (!this.hudTop) return; this.mission.textContent = this.#missionText();
    this.hudTop.replaceChildren(
      h('div.chip', { onclick: () => openProfile(), style: { cursor: 'pointer' } }, ballAvatar(BALL_BY_ID[s.selectedBall].flag, 30),
        h('div', h('div', `Nv ${s.level}`), h('div.bar', { style: { width: '70px' } }, h('i', { style: { width: s.xp / profileXpNeeded(s.level) * 100 + '%' } })))),
      h('div.grow'), h('div.chip', '🪙 ' + fmt(s.coins)), h('div.chip', '💎 ' + s.gems));
  }

  openGames() {
    const s = store.state, e = s.evolution;
    const card = (id, emoji, title, desc, stat, color) => h('button.btn', { style: { display: 'flex', gap: '12px', alignItems: 'center', textAlign: 'left', width: '100%', marginBottom: '10px', background: color, padding: '14px' }, onclick: () => { sfx.click(); m.close(); this.manager.launch(id); } },
      h('span', { style: { fontSize: '40px' } }, emoji), h('div.grow', h('div', { style: { fontSize: '18px', fontWeight: 800 } }, title), h('div', { style: { fontWeight: 500, fontSize: '13px', opacity: 0.9 } }, desc), h('div', { style: { fontSize: '12px', marginTop: '3px' } }, stat)));
    const m = modal('🎮 ¡Elige un juego!', [
      card('evolution', '🌍', 'Evolución', 'Explora mundos, vence jefes, colecciona mascotas y evoluciona.', `Nivel ${e.level} · ${e.rebirths} renaceres`, 'linear-gradient(90deg,#1f8a4c,#2fb36a)'),
      card('conquest', '🗺️', 'Conquista Mundial', 'Estrategia en tiempo real: expande, pacta, guerrea y llega a la Luna.', `Imperios ${s.ownedEmpires.length}/5`, 'linear-gradient(90deg,#9a2a2a,#d24a4a)'),
      card('flagquiz', '🚩', 'Adivina la bandera', '¡Gana imperios acertando banderas!', `Mejor racha ${s.stats.bestStreak} · ${s.stats.flagsCorrect} aciertos`, 'linear-gradient(90deg,#2a5fc9,#4a8cff)')]);
  }

  update(dt, t) {
    this.mpTimer=(this.mpTimer||0)-dt; if(this.mpTimer<=0){this.mpTimer=0.1;multiplayer.sendState('hub',this.player.group.position,this.player.group.rotation.y);}
    const p = this.player.group, ax = input.axis();
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)), right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const dir = new THREE.Vector3().addScaledVector(right, ax.x).addScaledVector(fwd, -ax.y);
    if (dir.lengthSq() > 0.01) this.target = null;
    else if (this.target) { dir.copy(this.target).sub(p.position).setY(0); if (dir.length() < 0.4) { this.target = null; dir.set(0, 0, 0); } else dir.normalize(); }
    const moving = dir.lengthSq() > 0.01;
    if (moving) { p.position.addScaledVector(dir, 7 * dt * Math.min(1, dir.length() || 1)); let da = Math.atan2(dir.x, dir.z) - p.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); p.rotation.y += da * Math.min(1, dt * 12); }
    const r = Math.hypot(p.position.x, p.position.z); if (r > 60) p.position.multiplyScalar(60 / r);
    const bounce = moving ? Math.abs(Math.sin(t * 11)) * 0.35 : Math.sin(t * 2) * 0.04;
    if (input.jump && this.jy <= 0.01) { this.vy = 10; sfx.click(); } input.jump = false;
    this.vy -= 28 * dt; this.jy = Math.max(0, this.jy + this.vy * dt); if (this.jy === 0) this.vy = 0;
    if (this.spin > 0) { this.spin -= dt * 1.4; p.rotation.y += dt * 14; }
    p.position.y = 1 + bounce + this.jy; this.player.squash(moving ? (0.5 - Math.abs(Math.sin(t * 11))) * 0.12 : Math.sin(t * 2) * 0.02);
    this.shadow.position.set(p.position.x, 0.2, p.position.z); this.shadow.scale.setScalar(Math.max(0.3, 1 - bounce * 0.4 - this.jy * 0.15));
    // camera
    const cd = new THREE.Vector3(Math.sin(this.camYaw) * 10, 6.5, Math.cos(this.camYaw) * 10).add(p.position);
    this.camera.position.lerp(cd, Math.min(1, dt * 5)); this.camera.lookAt(p.position.x, 1.5, p.position.z);
    // ambient animation
    this.swirl.rotation.z += dt * 0.8;
    this.book.rotation.y += dt; this.clouds.forEach(c => { c.position.x += dt * 0.8; if (c.position.x > 70) c.position.x = -70; });
    for (const w of this.wanderers) {
      const g = w.ball.group; w.wait -= dt;
      if (w.wait <= 0 && g.position.distanceTo(w.goal) < 0.5) { const a = Math.random() * 6.283, rr = 3 + Math.random() * 9; w.goal.set(Math.cos(a) * rr, 0.6, Math.sin(a) * rr); w.wait = 1 + Math.random() * 3; }
      const d = w.goal.clone().sub(g.position).setY(0);
      if (d.length() > 0.5) { d.normalize(); g.position.addScaledVector(d, 2.2 * dt); g.rotation.y = Math.atan2(d.x, d.z); g.position.y = 0.6 + Math.abs(Math.sin(t * 8 + w.ph)) * 0.25; }
    }
    // proximity prompt
    let near = null; for (const i of this.interactables) if (i.pos.distanceTo(p.position) < i.radius + 1) near = i;
    if (near !== this.near) { this.near = near; this.prompt.style.display = near ? 'block' : 'none'; if (near) this.prompt.textContent = 'Abrir ' + near.name; }
  }

  unmount() {
    this.unbind?.(); this.joyOff?.(); this.off?.(); this.offChange?.(); this.mpOffs?.forEach(fn=>fn()); this.#remoteLeft({all:true});
    this.hudTop?.remove(); this.mpButton?.remove(); this.dock?.remove(); this.prompt?.remove(); this.mission?.remove(); this.jumpBtn?.remove(); this.emoteBtn?.remove();
    this.player?.dispose(); this.wanderers.forEach(w => w.ball.dispose()); disposeScene(this.scene);
  }
}

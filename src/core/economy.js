import { store } from './store.js';
import { bus } from './events.js';
import { BALL_BY_ID, SECRET_RULES, ballPower } from '../data/countryballs.js';
import { PET_BY_ID } from '../data/pets.js';
import { sfx } from './audio.js';

/** Economy + progression services shared by all games. */
export const profileXpNeeded = l => Math.round(100 * l ** 1.35);

export function addCoins(n, { silent = false } = {}) {
  n = Math.round(n); if (n <= 0) return;
  store.mutate(s => { s.coins += n; s.stats.coinsEarned += n; });
  if (!silent) sfx.coin();
}
export function addGems(n) { store.mutate(s => { s.gems += n; }); }
export function spendCoins(n) {
  if (store.state.coins < n) { sfx.wrong(); return false; }
  store.mutate(s => { s.coins -= n; }); sfx.click(); return true;
}
export function spendGems(n) {
  if (store.state.gems < n) { sfx.wrong(); return false; }
  store.mutate(s => { s.gems -= n; }); sfx.click(); return true;
}

/** Profile-wide XP (every game feeds it). */
export function addProfileXp(n) {
  store.mutate(s => {
    s.xp += Math.round(n);
    while (s.xp >= profileXpNeeded(s.level)) {
      s.xp -= profileXpNeeded(s.level); s.level++;
      s.coins += 50 * s.level;
      bus.emit('toast', { text: `¡Nivel de perfil ${s.level}! +${50 * s.level} monedas`, kind: 'good' }); sfx.levelUp();
    }
  });
  checkAchievements();
}

export function grantBall(id, { announce = true } = {}) {
  if (store.state.ownedBalls.includes(id)) return false;
  store.mutate(st => { st.ownedBalls.push(id); if (!st.discovered.includes(id)) st.discovered.push(id); });
  if (announce) { bus.emit('toast', { text: `¡Desbloqueaste ${BALL_BY_ID[id]?.name ?? id}!`, kind: 'epic' }); sfx.levelUp(); }
  return true;
}

export function grantEmpire(id) {
  if (store.state.ownedEmpires.includes(id)) return false;
  store.mutate(s => { s.ownedEmpires.push(id); });
  bus.emit('toast', { text: '¡Imperio desbloqueado en Conquista Mundial!', kind: 'epic' }); sfx.levelUp();
  return true;
}

/** Unlock secret Countryballs whose hidden conditions are now met. */
export function checkSecrets() {
  for (const [id, rule] of Object.entries(SECRET_RULES)) {
    if (!store.state.ownedBalls.includes(id) && rule.test(store.state)) grantBall(id);
  }
}

/** Combined multipliers from the selected ball, rebirths and equipped pets. */
export function getMultipliers() {
  const e = store.state.evolution;
  const bp = ballPower(store.state.selectedBall);
  let coins = 1 + (bp - 1) * 0.5, xp = coins, attack = bp, magnet = 1, luck = 1;
  coins *= 1 + e.rebirths * 0.5; xp *= 1 + e.rebirths * 0.5; attack *= 1 + e.rebirths * 0.15;
  for (const pid of e.equippedPets) {
    const p = PET_BY_ID[pid]; if (!p) continue;
    const v = 1 + p.bonus;
    if (p.type === 'coins') coins *= v; else if (p.type === 'xp') xp *= v;
    else if (p.type === 'attack') attack *= v; else if (p.type === 'magnet') magnet *= v; else if (p.type === 'luck') luck *= v;
  }
  return { coins, xp, attack, magnet, luck };
}

// ---------------- Achievements ----------------
export const ACHIEVEMENTS = [
  { id: 'first_coin',  name: 'Calderilla',    desc: 'Gana 100 monedas',            test: s => s.stats.coinsEarned >= 100 },
  { id: 'rich',        name: 'Dragón del tesoro', desc: 'Gana 100.000 monedas',        test: s => s.stats.coinsEarned >= 100000 },
  { id: 'slayer',      name: 'Rompebolas',     desc: 'Vence a 100 enemigos',        test: s => s.stats.enemiesDefeated >= 100 },
  { id: 'boss',        name: 'Cazajefes',      desc: 'Vence a un jefe',             test: s => s.stats.bossesDefeated >= 1 },
  { id: 'rebirth',     name: 'Renacido',           desc: 'Haz un Renacer',              test: s => s.stats.rebirths >= 1 },
  { id: 'collector',   name: 'Coleccionista',        desc: 'Ten 10 Countryballs',       test: s => s.ownedBalls.length >= 10 },
  { id: 'curator',     name: 'Gran coleccionista',          desc: 'Ten 30 Countryballs',       test: s => s.ownedBalls.length >= 30 },
  { id: 'pets',        name: 'Amigo de mascotas',        desc: 'Abre 10 huevos',             test: s => s.stats.petsHatched >= 10 },
  { id: 'flags50',     name: 'Fan de banderas',         desc: 'Acierta 50 banderas', test: s => s.stats.flagsCorrect >= 50 },
  { id: 'flags500',    name: 'Experto en banderas',    desc: 'Acierta 500 banderas',test: s => s.stats.flagsCorrect >= 500 },
  { id: 'streak10',    name: '¡En racha!',          desc: 'Racha de 10 banderas',            test: s => s.stats.bestStreak >= 10 },
  { id: 'empire',      name: 'Heredero imperial',    desc: 'Desbloquea un imperio',test: s => s.ownedEmpires.length >= 1 },
  { id: 'allempires',  name: 'Emperador de emperadores', desc: 'Desbloquea todos los imperios',    test: s => s.ownedEmpires.length >= 30 },
  { id: 'conqueror',   name: 'Conquistador',        desc: 'Conquista 10 territorios',    test: s => s.stats.conquests >= 10 },
  { id: 'victor',      name: 'Rey del mundo',      desc: 'Gana una Conquista Mundial', test: s => s.conquest.wins >= 1 },
  { id: 'wearer',      name: 'Con mucho estilo',      desc: 'Ten 5 accesorios',           test: s => s.ownedCosmetics.length >= 5 }
];

let checking = false;
export function checkAchievements() {
  if (checking) return; checking = true;
  checkSecrets();
  for (const a of ACHIEVEMENTS) {
    if (!store.state.achievements.includes(a.id) && a.test(store.state)) {
      store.mutate(s => { s.achievements.push(a.id); });
      bus.emit('toast', { text: `🏆 ${a.name}`, kind: 'epic' }); sfx.levelUp();
    }
  }
  checking = false;
}

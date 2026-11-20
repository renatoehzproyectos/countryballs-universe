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
      bus.emit('toast', { text: `Profile level ${s.level}! +${50 * s.level} coins`, kind: 'good' }); sfx.levelUp();
    }
  });
  checkAchievements();
}

export function grantBall(id, { announce = true } = {}) {
  if (store.state.ownedBalls.includes(id)) return false;
  store.mutate(st => { st.ownedBalls.push(id); if (!st.discovered.includes(id)) st.discovered.push(id); });
  if (announce) { bus.emit('toast', { text: `Unlocked ${BALL_BY_ID[id]?.name ?? id}!`, kind: 'epic' }); sfx.levelUp(); }
  return true;
}

export function grantEmpire(id) {
  if (store.state.ownedEmpires.includes(id)) return false;
  store.mutate(s => { s.ownedEmpires.push(id); });
  bus.emit('toast', { text: 'Historical empire unlocked in World Conquest!', kind: 'epic' }); sfx.levelUp();
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
  { id: 'first_coin',  name: 'Pocket Change',    desc: 'Earn 100 coins',            test: s => s.stats.coinsEarned >= 100 },
  { id: 'rich',        name: 'Treasure Hoarder', desc: 'Earn 100,000 coins',        test: s => s.stats.coinsEarned >= 100000 },
  { id: 'slayer',      name: 'Ball Breaker',     desc: 'Defeat 100 enemies',        test: s => s.stats.enemiesDefeated >= 100 },
  { id: 'boss',        name: 'Boss Hunter',      desc: 'Defeat a boss',             test: s => s.stats.bossesDefeated >= 1 },
  { id: 'rebirth',     name: 'Reborn',           desc: 'Rebirth once',              test: s => s.stats.rebirths >= 1 },
  { id: 'collector',   name: 'Collector',        desc: 'Own 10 Countryballs',       test: s => s.ownedBalls.length >= 10 },
  { id: 'curator',     name: 'Curator',          desc: 'Own 30 Countryballs',       test: s => s.ownedBalls.length >= 30 },
  { id: 'pets',        name: 'Pet Lover',        desc: 'Hatch 10 pets',             test: s => s.stats.petsHatched >= 10 },
  { id: 'flags50',     name: 'Flag Fan',         desc: 'Answer 50 flags correctly', test: s => s.stats.flagsCorrect >= 50 },
  { id: 'flags500',    name: 'Vexillologist',    desc: 'Answer 500 flags correctly',test: s => s.stats.flagsCorrect >= 500 },
  { id: 'streak10',    name: 'On Fire',          desc: '10 flag streak',            test: s => s.stats.bestStreak >= 10 },
  { id: 'empire',      name: 'Imperial Heir',    desc: 'Unlock a historical empire',test: s => s.ownedEmpires.length >= 1 },
  { id: 'allempires',  name: 'Emperor of Emperors', desc: 'Unlock every empire',    test: s => s.ownedEmpires.length >= 5 },
  { id: 'conqueror',   name: 'Conqueror',        desc: 'Conquer 10 territories',    test: s => s.stats.conquests >= 10 },
  { id: 'victor',      name: 'World Ruler',      desc: 'Win a World Conquest campaign', test: s => s.conquest.wins >= 1 },
  { id: 'wearer',      name: 'Fashionista',      desc: 'Own 5 cosmetics',           test: s => s.ownedCosmetics.length >= 5 }
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

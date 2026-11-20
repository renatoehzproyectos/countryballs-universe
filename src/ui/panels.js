import { h, modal, ballAvatar, rarityBadge, fmt, confirmBox } from './dom.js';
import { store } from '../core/store.js';
import { bus } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { BALLS, BALL_BY_ID, SECRET_RULES } from '../data/countryballs.js';
import { COSMETICS } from '../data/cosmetics.js';
import { PETS, PET_BY_ID, EGGS, petTypeLabel } from '../data/pets.js';
import { RARITY, RARITY_ORDER } from '../data/rarity.js';
import { spendCoins, spendGems, grantBall, checkAchievements, ACHIEVEMENTS, profileXpNeeded } from '../core/economy.js';
import { hatchEgg, maxPetSlots } from '../core/pets.js';

const price = (n, cur = 'coins') => (cur === 'gems' ? '💎' : '🪙') + fmt(n);

/** Shared panels used by the hub (and reachable from games): shop, inventory, collection, profile. */
export function openShop(tab = 'balls') {
  const m = modal('🛒 Shop', ''); const render = () => {
    const s = store.state; m.body.replaceChildren(
      h('div.tabs', [['balls', 'Countryballs'], ['hats', 'Hats'], ['glasses', 'Glasses'], ['eggs', 'Pet Eggs']].map(([k, l]) =>
        h('button.tab' + (tab === k ? '.on' : ''), { onclick: () => { tab = k; sfx.click(); render(); } }, l))),
      h('div.row', h('span.chip', '🪙 ' + fmt(s.coins)), h('span.chip', '💎 ' + s.gems)),
      h('div', { style: { height: '10px' } }),
      tab === 'balls' ? ballGrid() : tab === 'eggs' ? eggList() : cosmeticGrid(tab === 'hats' ? 'hat' : 'glasses'));
  };
  const ballGrid = () => h('div.grid', BALLS.filter(b => !b.secret).map(b => {
    const own = store.state.ownedBalls.includes(b.id), lvl = store.state.evolution.level;
    return h('div.card', ballAvatar(b.flag, 58), h('div.nm', b.name), rarityBadge(b.rarity),
      own ? h('button.btn.sm' + (store.state.selectedBall === b.id ? '.green' : ''), { onclick: () => { select(b.id); render(); } }, store.state.selectedBall === b.id ? 'Selected' : 'Select')
        : h('div', h('button.btn.gold.sm', { onclick: () => { if (spendCoins(b.price)) { grantBall(b.id); render(); } } }, 'Buy ' + price(b.price)),
          h('div.mute', { style: { fontSize: '11px', marginTop: '4px' } }, `or reach Evo Lv ${b.level}${lvl >= b.level ? ' ✔' : ''}`)));
  }));
  const cosmeticGrid = slot => h('div.grid', COSMETICS.filter(c => c.slot === slot).map(c => {
    const own = store.state.ownedCosmetics.includes(c.id);
    return h('div.card', h('div', { style: { fontSize: '44px' } }, c.icon), h('div.nm', c.name),
      own ? h('span.mute', 'Owned — equip in Locker') : h('button.btn.gold.sm', { onclick: () => { if (spendCoins(c.price)) { store.mutate(s => { s.ownedCosmetics.push(c.id); s.equipped[c.slot] = c.id; }); checkAchievements(); render(); } } }, 'Buy ' + price(c.price)));
  }));
  const eggList = () => h('div.grid', EGGS.map(e => h('div.card', h('div', { style: { fontSize: '48px' } }, '🥚'), h('div.nm', e.name),
    h('div.mute', { style: { fontSize: '11px' } }, Object.entries(e.odds).map(([r, p]) => `${RARITY[r].label} ${p}%`).join(' · ')),
    h('button.btn.gold.sm', { onclick: () => { const cost = (e.cur === 'gems' ? spendGems : spendCoins)(e.price); if (cost) { const p = hatchEgg(e); showHatch(p); render(); } } }, 'Hatch ' + price(e.price, e.cur)))));
  render(); const off = bus.on('change', () => { if (m.el.isConnected) render(); else off(); }); return m;
}

function showHatch(p) { sfx.levelUp(); const m = modal('🥚 Hatched!', h('div.center', ballAvatar(p.flag, 110), h('h3', p.name), rarityBadge(p.rarity), h('p.mute', `+${Math.round(p.bonus * 100)}% ${petTypeLabel[p.type]}`), h('button.btn.green', { onclick: () => m.close() }, 'Nice!'))); }

function select(id) {
  store.mutate(s => { s.selectedBall = id; }); sfx.click(); bus.emit('ball-changed', id);
}

export function openInventory() {
  const m = modal('🎒 Locker', ''); const render = () => {
    const s = store.state, e = s.evolution;
    m.body.replaceChildren(
      h('h3', `Countryballs (${s.ownedBalls.length})`),
      h('div.grid', s.ownedBalls.map(id => { const b = BALL_BY_ID[id]; return h('div.card' + (s.selectedBall === id ? '.sel' : ''), { onclick: () => { select(id); render(); } }, ballAvatar(b.flag, 52), h('div.nm', b.name), rarityBadge(b.rarity)); })),
      h('h3', 'Hats & Glasses'),
      s.ownedCosmetics.length ? h('div.grid', [
        h('div.card' + (!s.equipped.hat && !s.equipped.glasses ? '.sel' : ''), { onclick: () => { store.mutate(x => { x.equipped.hat = x.equipped.glasses = null; }); bus.emit('ball-changed'); render(); } }, h('div', { style: { fontSize: '38px' } }, '🚫'), 'None'),
        ...s.ownedCosmetics.map(id => { const c = COSMETICS.find(x => x.id === id); const on = s.equipped[c.slot] === id;
          return h('div.card' + (on ? '.sel' : ''), { onclick: () => { store.mutate(x => { x.equipped[c.slot] = on ? null : id; }); sfx.click(); bus.emit('ball-changed'); render(); } }, h('div', { style: { fontSize: '38px' } }, c.icon), h('div.nm', c.name), h('span.mute', c.slot)); })]) : h('p.mute', 'Buy cosmetics in the Shop.'),
      h('h3', `Pets (${e.equippedPets.length}/${maxPetSlots()} equipped)`),
      e.pets.length ? h('div.grid', e.pets.map((id, i) => { const p = PET_BY_ID[id]; const on = e.equippedPets.includes(id);
        return h('div.card' + (on ? '.sel' : ''), { onclick: () => { togglePet(id); render(); } }, ballAvatar(p.flag, 46), h('div.nm', p.name), rarityBadge(p.rarity), h('span.mute', `+${Math.round(p.bonus * 100)}% ${petTypeLabel[p.type]}`)); })) : h('p.mute', 'Hatch eggs in the Shop or find them in chests.'));
  }; render(); return m;
}
export function togglePet(id) {
  store.mutate(s => { const e = s.evolution, i = e.equippedPets.indexOf(id);
    if (i >= 0) e.equippedPets.splice(i, 1); else if (e.equippedPets.length < maxPetSlots()) e.equippedPets.push(id); });
  sfx.click();
}

export function openCollection() {
  const s = store.state, total = BALLS.length, have = s.discovered.length;
  const m = modal(`📖 Collection ${have}/${total}`, [h('div.bar', h('i', { style: { width: have / total * 100 + '%' } })), h('div', { style: { height: '12px' } }),
    ...RARITY_ORDER.map(r => { const list = BALLS.filter(b => b.rarity === r); if (!list.length) return null;
      return [h('h3', { style: { color: RARITY[r].color } }, `${RARITY[r].label} — ${list.filter(b => s.discovered.includes(b.id)).length}/${list.length}`),
        h('div.grid', list.map(b => { const d = s.discovered.includes(b.id), own = s.ownedBalls.includes(b.id);
          return h('div.card', ballAvatar(b.flag, 52, !d), h('div.nm', d ? b.name : '???'), h('span.mute', { style: { fontSize: '11px' } }, own ? 'Owned' : d ? 'Discovered' : b.secret ? 'Secret' : `Evo Lv ${b.level}`),
            b.secret && d && !own ? h('span.mute', { style: { fontSize: '11px' } }, SECRET_RULES[b.id].hint) : null); }))]; })]);
  return m;
}

export function openProfile() {
  const s = store.state, st = s.stats;
  const m = modal('👤 Profile', [
    h('div.row', ballAvatar(BALL_BY_ID[s.selectedBall].flag, 70), h('div.grow', h('div', { style: { fontSize: '20px', fontWeight: 800 } }, s.name), h('div.mute', `Level ${s.level}`), h('div.bar', h('i', { style: { width: s.xp / profileXpNeeded(s.level) * 100 + '%' } })))),
    h('h3', 'Global statistics'),
    h('div.kv', Object.entries({ 'Coins earned': fmt(st.coinsEarned), 'Enemies defeated': fmt(st.enemiesDefeated), 'Bosses defeated': st.bossesDefeated, 'Rebirths': st.rebirths, 'Flags correct': `${st.flagsCorrect}/${st.flagsAnswered}`, 'Best flag streak': st.bestStreak, 'Territories conquered': st.conquests, 'Campaigns won': s.conquest.wins, 'Empires unlocked': `${s.ownedEmpires.length}/5`, 'Countryballs owned': s.ownedBalls.length, 'Pets hatched': st.petsHatched }).flatMap(([k, v]) => [h('span.mute', k), h('b', v)])),
    h('h3', `Achievements ${s.achievements.length}/${ACHIEVEMENTS.length}`),
    h('div.pill-list', ACHIEVEMENTS.map(a => h('span.chip', { style: { opacity: s.achievements.includes(a.id) ? 1 : 0.4 }, title: a.desc }, (s.achievements.includes(a.id) ? '🏆 ' : '🔒 ') + a.name))),
    h('h3', 'Settings'),
    h('div.row.wrap', h('button.btn', { onclick: e => { store.mutate(x => { x.settings.sound = !x.settings.sound; }); e.target.textContent = store.state.settings.sound ? '🔊 Sound on' : '🔇 Sound off'; } }, s.settings.sound ? '🔊 Sound on' : '🔇 Sound off'),
      h('button.btn.red', { onclick: () => confirmBox('Erase save?', 'This deletes ALL progress in every game.', () => { store.reset(); location.reload(); }) }, 'Erase save'))]);
  return m;
}

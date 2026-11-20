import { store } from './store.js';
import { PETS } from '../data/pets.js';
import { RARITY } from '../data/rarity.js';
import { getMultipliers, checkAchievements } from './economy.js';

export const maxPetSlots = () => 3 + (store.state.evolution.rebirths >= 1) + (store.state.evolution.rebirths >= 3);

function rollRarity(odds, luck = 1) {
  const adj = Object.entries(odds).map(([r, p]) => [r, p * (r === 'common' ? 1 : luck)]);
  let x = Math.random() * adj.reduce((a, [, p]) => a + p, 0);
  for (const [r, p] of adj) { if ((x -= p) <= 0) return r; } return adj[0][0];
}

/** Roll a pet from an egg definition and add it to the profile. */
export function hatchEgg(egg) {
  const r = rollRarity(egg.odds, getMultipliers().luck);
  const pool = PETS.filter(p => p.rarity === r); const pet = (pool.length ? pool : PETS.filter(p => p.rarity === 'common'))[Math.floor(Math.random() * (pool.length || 5))];
  store.mutate(s => { s.evolution.pets.push(pet.id); s.stats.petsHatched++; if (s.evolution.equippedPets.length < maxPetSlots() && !s.evolution.equippedPets.includes(pet.id)) s.evolution.equippedPets.push(pet.id); });
  checkAchievements(); return pet;
}
export { RARITY };

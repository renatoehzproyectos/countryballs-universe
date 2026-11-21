import { bus } from './events.js';

/**
 * Save system. One profile shared by every game, persisted in localStorage.
 * Mutate only through `store.mutate(fn)` so saves and change events stay consistent.
 */
const KEY = 'countryballs-universe:v1';

const defaults = () => ({
  v: 1, name: 'Player', coins: 300, gems: 5, xp: 0, level: 1,
  selectedBall: 'pl', ownedBalls: ['pl'], discovered: ['pl'],
  ownedCosmetics: [], equipped: { hat: null, glasses: null },
  ownedEmpires: [], achievements: [],
  stats: {
    playtime: 0, coinsEarned: 0, enemiesDefeated: 0, bossesDefeated: 0, flagsCorrect: 0, flagsAnswered: 0,
    bestStreak: 0, warsWon: 0, conquests: 0, rebirths: 0, chestsOpened: 0, petsHatched: 0,
    gamesPlayed: { evolution: 0, conquest: 0, flagquiz: 0 }
  },
  evolution: { level: 1, xp: 0, rebirths: 0, world: 'europe', worldsUnlocked: ['europe'], pets: [], equippedPets: [], bossesKilled: {}, quests: {} },
  quiz: { mastered: {}, wrong: [], records: {}, daily: { date: '', score: 0 } },
  conquest: { campaign: null, wins: 0 },
  daily: { last: '', streak: 0 },
  settings: { sound: true }
});

function merge(base, saved) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return saved ?? base;
  const out = { ...base };
  for (const k of Object.keys(saved ?? {})) {
    out[k] = k in base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])
      ? merge(base[k], saved[k]) : saved[k];
  }
  return out;
}

class Store {
  state = defaults();
  #timer = null;

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = merge(defaults(), JSON.parse(raw));
    } catch (e) { console.warn('Save corrupted, starting fresh', e); }
    return this.state;
  }

  save() {
    clearTimeout(this.#timer);
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { console.warn('Save failed', e); }
  }

  /** Apply a mutation, schedule a debounced save and notify listeners. */
  mutate(fn) {
    fn(this.state);
    bus.emit('change', this.state);
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.save(), 400);
  }

  reset() { this.state = defaults(); this.save(); bus.emit('change', this.state); }
}

export const store = new Store();
window.addEventListener('pagehide', () => store.save());
document.addEventListener('visibilitychange', () => { if (document.hidden) store.save(); });

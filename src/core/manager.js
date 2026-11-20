import { Engine } from './engine.js';
import { store } from './store.js';
import { wipe, ui } from '../ui/dom.js';
import { checkAchievements } from './economy.js';

/**
 * GameManager: boots the hub, lazy-loads each game's chunk on demand and guarantees only one
 * app (scene + DOM) is alive at a time. Every game exports `default class { mount(ctx); unmount(); }`.
 */
const LOADERS = {
  evolution: () => import('../games/evolution/evolution.js'),
  conquest:  () => import('../games/conquest/conquest.js'),
  flagquiz:  () => import('../games/flagquiz/flagquiz.js')
};

export class GameManager {
  constructor(canvas) { this.engine = new Engine(canvas); this.current = null; this.id = null; this.playTimer = setInterval(() => { store.mutate(s => { s.stats.playtime += 5; }); }, 5000); }

  async #swap(id, makeApp) {
    this.current?.unmount?.(); this.engine.setActive(null); this.current = null;
    ui().querySelectorAll('.modal-wrap').forEach(n => n.remove());
    const app = await makeApp(); this.current = app; this.id = id;
    await app.mount({ engine: this.engine, exit: () => this.goHome() });
    this.engine.setActive(app); checkAchievements();
  }

  async goHome() { return wipe(() => this.#swap('hub', async () => new (await import('../hub/hub.js')).Hub(this))); }

  async launch(id) {
    return wipe(() => this.#swap(id, async () => {
      const mod = await LOADERS[id](); store.mutate(s => { s.stats.gamesPlayed[id]++; });
      return new mod.default(this);
    }));
  }

  async boot() { await this.#swap('hub', async () => new (await import('../hub/hub.js')).Hub(this)); }
}

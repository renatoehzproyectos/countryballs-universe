import { Engine } from './engine.js';
import { store } from './store.js';
import { wipe, ui, h, modal } from '../ui/dom.js';
import { multiplayer } from './multiplayer.js';
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
  constructor(canvas) { this.engine = new Engine(canvas); this.current = null; this.id = null; this.playTimer = setInterval(() => { store.mutate(s => { s.stats.playtime += 5; }); }, 5000);
    // A host started a multiplayer Conquest game: offer to join from anywhere in the app.
    multiplayer.on('message', ({ msg }) => { if (msg?.t === 'cq:invite' && multiplayer.role === 'guest' && this.id !== 'conquest' && !this.inviteOpen) this.#invite(msg); });
  }

  #invite(msg) {
    this.inviteOpen = true;
    const m = modal('🗺️ Conquista Mundial', [h('p', `${msg.name || 'El anfitrión'} está jugando Conquista. ¿Te unes?`),
      h('button.btn.green', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { this.inviteOpen = false; m.close(); this.launch('conquest'); } }, '▶ Unirme'),
      h('button.btn', { style: { width: '100%' }, onclick: () => m.close() }, 'Ahora no')], { onClose: () => setTimeout(() => { this.inviteOpen = false; }, 20000) });
  }

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

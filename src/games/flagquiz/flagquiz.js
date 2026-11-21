import { createMapView } from '../../ui/mapview.js';
import { store } from '../../core/store.js';
import { sfx } from '../../core/audio.js';
import { h, ui, fmt, ballAvatar, toast } from '../../ui/dom.js';
import { flagUrl } from '../../characters/flags.js';
import { addCoins, addProfileXp, grantEmpire, checkAchievements, ACHIEVEMENTS } from '../../core/economy.js';
import { EMPIRES, EMPIRE_REQ } from '../../data/empires.js';
import { CONTINENTS, ALL, makeQuestion, poolFor, mapPool, masteryOf, empiresEarned, mulberry } from './questions.js';
import { openProfile } from '../../ui/panels.js';

const MODES = [
  { id: 'classic', icon: '🎯', name: 'Clásico', desc: '20 banderas · 5 vidas' },
  { id: 'time', icon: '⏱️', name: 'Contrarreloj', desc: 'Todas las que puedas en 60 segundos' },
  { id: 'continents', icon: '🌍', name: 'Continentes', desc: 'Domina un continente y gana imperios' },
  { id: 'expert', icon: '🧠', name: 'Experto', desc: 'Banderas parecidas y raras · 5 vidas' },
  { id: 'map', icon: '📍', name: 'Reto del mapa', desc: 'Encuentra el país en el mapa' },
  { id: 'daily', icon: '📅', name: 'Reto diario', desc: 'Las mismas 10 banderas para todos hoy' }
];
const today = () => new Date().toISOString().slice(0, 10);

/** Game Three — Guess the Flag. Pure DOM (no inactive 3D scene is kept alive). */
export default class FlagQuiz {
  constructor(manager) { this.manager = manager; this.root = null; }
  async mount({ exit }) { this.exit = exit; this.root = h('div', { style: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#16306e,#0b1530)', overflow: 'auto', touchAction: 'pan-y', zIndex: 2, padding: 'calc(60px + env(safe-area-inset-top)) 14px 24px' } }); ui().append(this.root);
    this.back = h('button.btn.back', { style: { zIndex: 5 }, onclick: () => (this.run ? this.#quit() : this.exit()) }, '🏠'); ui().append(this.back); this.menu(); }
  unmount() { clearInterval(this.timer); this.root?.remove(); this.back?.remove(); }

  // ------------------------------------------------------------ menu
  menu() {
    clearInterval(this.timer); this.run = null; const s = store.state, q = s.quiz, rec = q.records;
    const earned = empiresEarned(); earned.forEach(id => grantEmpire(id));
    this.root.replaceChildren(
      h('h2', { style: { margin: '0 0 4px' } }, '🚩 Adivina la bandera'), h('p.mute', { style: { margin: '0 0 12px' } }, `${s.stats.flagsCorrect} aciertos · mejor racha ${s.stats.bestStreak} · ${q.wrong.length} por repasar`),
      h('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' } }, MODES.map(m => h('button.card', { style: { cursor: 'pointer', color: 'inherit' }, onclick: () => { sfx.click(); m.id === 'continents' ? this.continentPick() : this.start(m.id); } },
        h('div', { style: { fontSize: '34px' } }, m.icon), h('div.nm', m.name), h('div.mute', { style: { fontSize: '11px' } }, m.desc),
        h('div', { style: { fontSize: '11px', color: 'var(--gold)' } }, m.id === 'daily' ? (q.daily.date === today() ? `Hoy: ${q.daily.score}/10` : '¡Aún no jugado hoy!') : rec[m.id] != null ? `Récord: ${rec[m.id]}` : '')))),
      h('h3', '👑 Imperios (se juegan en Conquista Mundial)'),
      h('div.card', { style: { alignItems: 'stretch', textAlign: 'left' } }, Object.values(EMPIRES).map(e => { const own = s.ownedEmpires.includes(e.id);
        return h('div.row', { style: { padding: '4px 0' } }, ballAvatar(e.flag, 34, !own), h('div.grow', h('div.nm', e.name), h('div.mute', { style: { fontSize: '11px' } }, own ? '✅ Desbloqueado' : EMPIRE_REQ[e.id]))); })),
      h('h3', '🗺️ Dominio de continentes (acierta el 80 % de sus banderas)'),
      h('div.card', { style: { alignItems: 'stretch', textAlign: 'left' } }, CONTINENTS.map(c => { const m = masteryOf(c);
        return h('div', { style: { padding: '4px 0' } }, h('div.row', h('span.grow', c), h('span.mute', `${m.have}/${m.need}${m.done ? ' ✅' : ''}`)), h('div.bar', h('i', { style: { width: Math.min(100, m.have / m.need * 100) + '%' } }))); })),
      h('div', { style: { height: '10px' } }), h('button.btn', { onclick: () => openProfile() }, '🏆 Logros y estadísticas'));
  }
  continentPick() {
    this.root.replaceChildren(h('h2', 'Elige un continente'), h('div.grid', CONTINENTS.map(c => { const m = masteryOf(c);
      return h('button.card', { style: { color: 'inherit', cursor: 'pointer' }, onclick: () => this.start('continents', c) }, h('div.nm', c), h('div.mute', `${m.have}/${m.total} aprendidas`), h('div.bar', { style: { width: '100%' } }, h('i', { style: { width: Math.min(100, m.have / m.need * 100) + '%' } }))); })),
      h('div', { style: { height: '10px' } }), h('button.btn', { onclick: () => this.menu() }, '← Volver'));
  }

  // ------------------------------------------------------------ run
  start(mode, cont) {
    const classic = mode === 'classic', expert = mode === 'expert', daily = mode === 'daily';
    const pool = mode === 'continents' ? poolFor(cont) : mode === 'map' ? mapPool() : ALL;
    this.run = { mode, cont, pool, score: 0, correct: 0, streak: 0, best: 0, asked: 0, total: classic ? 20 : daily ? 10 : mode === 'continents' ? 15 : Infinity, lives: classic || expert || mode === 'map' ? 5 : 99, time: 60, seen: new Set(), rand: daily ? mulberry([...today()].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) : Math.random, coins: 0, xp: 0, locked: false, learned: [] };
    if (mode === 'time') { this.timer = setInterval(() => { this.run.time--; this.#hud(); if (this.run.time <= 0) this.end(); }, 1000); }
    this.next();
  }
  #quit() { this.end(true); }

  next() {
    const r = this.run; if (!r) return; if (r.asked >= r.total || r.lives <= 0) return this.end();
    r.locked = false; r.q = makeQuestion(r.pool, { level: r.asked, expert: r.mode === 'expert', rand: r.rand, wrongFirst: r.mode !== 'daily', avoid: r.seen });
    r.seen.add(r.q.target.code); if (r.seen.size > Math.min(30, r.pool.length - 6)) r.seen.clear(); r.asked++; this.#render();
  }

  #hud() {
    const r = this.run; if (!this.elHud) return;
    this.elHud.textContent = `${r.mode === 'time' ? `⏱ ${r.time}s · ` : ''}${r.lives < 50 ? '❤'.repeat(Math.max(0, r.lives)) + ' · ' : ''}Puntos ${r.score} · 🔥 ${r.streak}${r.total < Infinity ? ` · ${Math.min(r.asked, r.total)}/${r.total}` : ''}`;
  }

  #render() {
    const r = this.run, q = r.q; this.elHud = h('div.chip', { style: { justifyContent: 'center', marginBottom: '10px' } });
    const flag = h('img', { src: flagUrl(q.target.code), style: { width: 'min(340px,80vw)', maxHeight: '30vh', objectFit: 'contain', borderRadius: '10px', boxShadow: '0 6px 0 #0006', background: '#fff2', display: 'block', margin: '0 auto 14px' } });
    this.root.replaceChildren(this.elHud, flag, r.mode === 'map' ? this.#mapUi() : this.#options());
    this.#hud();
  }
  #options() {
    const r = this.run; return h('div', { style: { display: 'grid', gap: '10px', maxWidth: '520px', margin: '0 auto' } }, r.q.options.map(o => h('button.btn', { style: { padding: '14px', fontSize: '17px', textAlign: 'center' }, onclick: e => this.answer(o.code, e.currentTarget) }, o.name)));
  }
  #mapUi() {
    this.mapView = createMapView({ onTap: (id, el) => this.answer(id, el) }); this.mapEls = this.mapView.paths;
    const box = h('div', { style: { height: '38vh', minHeight: '220px', borderRadius: '14px', overflow: 'hidden' } }, this.mapView.el);
    return h('div', box, h('div.mute.center', { style: { padding: '6px', fontSize: '12px' } }, 'Arrastra para mover · pellizca para acercar · toca el país'));
  }

  answer(code, el) {
    const r = this.run; if (r.locked) return; r.locked = true;
    const ok = code === r.q.target.code, t = r.q.target, S = store.state;
    store.mutate(s => { s.stats.flagsAnswered++; });
    if (ok) {
      sfx.right(); r.streak++; r.best = Math.max(r.best, r.streak); r.correct++; const pts = 10 + Math.min(r.streak, 10) * 2 + (r.mode === 'expert' ? 10 : 0); r.score += pts; r.coins += 5 + Math.min(r.streak, 10) + (r.mode === 'expert' ? 8 : 0); r.xp += 4;
      store.mutate(s => { s.stats.flagsCorrect++; s.stats.bestStreak = Math.max(s.stats.bestStreak, r.streak); s.quiz.wrong = s.quiz.wrong.filter(c => c !== t.code); const m = (s.quiz.mastered[t.cont] ??= []); if (!m.includes(t.code)) { m.push(t.code); r.learned.push(t.name); } });
      if (r.mode === 'time') r.time += 0; el?.classList?.add('green'); if (el?.style) el.style.background = 'linear-gradient(#52e690,#1fae5b)'; if (el?.tagName === 'path') el.setAttribute('fill', '#2fe07a');
    } else {
      sfx.wrong(); r.streak = 0; if (r.lives < 50) r.lives--; if (r.mode === 'time') r.time = Math.max(0, r.time - 3);
      store.mutate(s => { if (!s.quiz.wrong.includes(t.code)) s.quiz.wrong.push(t.code); }); if (el?.style) el.style.background = 'linear-gradient(#ff7b7b,#d23a3a)'; if (el?.tagName === 'path') el.setAttribute('fill', '#e04a4a');
      if (r.mode === 'map') { r.q.target.code && this.mapEls?.[t.code]?.setAttribute('fill', '#ffd24a'); } else for (const b of this.root.querySelectorAll('.btn')) if (b.textContent === t.name) b.style.background = 'linear-gradient(#52e690,#1fae5b)';
    }
    this.#hud(); checkAchievements();
    // reveal the answer (name) briefly before moving on
    const note = h('div.center', { style: { marginTop: '10px', fontWeight: 800 } }, ok ? `✅ ${t.name}` : `❌ Era ${t.name}`); this.root.append(note);
    setTimeout(() => this.next(), ok ? 650 : 1500);
  }

  end(quit = false) {
    clearInterval(this.timer); const r = this.run; if (!r) return this.exit(); this.run = null;
    const bonus = r.mode === 'daily' && store.state.quiz.daily.date !== today() ? 100 + r.correct * 10 : 0;
    const coins = r.coins + bonus, xp = r.xp;
    if (r.asked > 0) { addCoins(coins); addProfileXp(xp);
      store.mutate(s => { const k = r.mode; s.quiz.records[k] = Math.max(s.quiz.records[k] ?? 0, r.score); if (r.mode === 'daily' && s.quiz.daily.date !== today()) s.quiz.daily = { date: today(), score: r.correct }; }); }
    const earned = empiresEarned().filter(e => !store.state.ownedEmpires.includes(e)); earned.forEach(e => grantEmpire(e)); checkAchievements();
    if (quit && r.asked <= 1) return this.menu();
    this.root.replaceChildren(h('div.center', { style: { maxWidth: '460px', margin: '0 auto' } }, h('h2', quit ? 'Partida terminada' : r.lives <= 0 ? '💔 ¡Sin vidas!' : '🏁 ¡Terminaste!'),
      h('div.card', { style: { fontSize: '16px' } }, h('div', { style: { fontSize: '36px', fontWeight: 900, color: 'var(--gold)' } }, r.score), h('div', `${r.correct} aciertos · mejor racha ${r.best}`), h('div', `Premio: 🪙 ${fmt(coins)} · ⭐ ${xp} XP${bonus ? ' (¡bonus diario!)' : ''}`),
        r.learned.length ? h('div.mute', { style: { fontSize: '12px' } }, `Nuevas: ${r.learned.slice(0, 6).join(', ')}${r.learned.length > 6 ? '…' : ''}`) : null),
      ...earned.map(e => h('div.card', { style: { borderColor: 'var(--gold)', marginTop: '10px' } }, h('div', '👑 ¡IMPERIO DESBLOQUEADO!'), ballAvatar(EMPIRES[e].flag, 70), h('div.nm', EMPIRES[e].name), h('div.mute', 'Ya puedes jugarlo en Conquista Mundial'))),
      h('div.row', { style: { marginTop: '14px' } }, h('button.btn.gold.grow', { onclick: () => this.start(r.mode, r.cont) }, '↻ Otra vez'), h('button.btn.grow', { onclick: () => this.menu() }, 'Menú')),
      earned.length ? h('button.btn.green', { style: { marginTop: '10px', width: '100%' }, onclick: () => this.manager.launch('conquest') }, '🗺️ Ir a Conquista Mundial') : null));
  }
}

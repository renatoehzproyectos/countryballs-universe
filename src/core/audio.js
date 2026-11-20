import { store } from './store.js';

/** Synthesised sound effects (WebAudio) — zero audio files to ship. */
let ctx = null;
const ensure = () => {
  if (!store.state.settings.sound) return null;
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};
function tone(freq, dur = 0.12, { type = 'sine', vol = 0.12, slide = 0, delay = 0 } = {}) {
  const c = ensure(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  click:   () => tone(520, 0.06, { type: 'triangle' }),
  coin:    () => { tone(880, 0.07, { type: 'square', vol: 0.06 }); tone(1320, 0.1, { type: 'square', vol: 0.06, delay: 0.06 }); },
  hit:     () => tone(180, 0.1, { type: 'sawtooth', vol: 0.08, slide: -90 }),
  hurt:    () => tone(140, 0.2, { type: 'square', vol: 0.1, slide: -80 }),
  right:   () => { tone(660, 0.1, { type: 'triangle' }); tone(990, 0.16, { type: 'triangle', delay: 0.09 }); },
  wrong:   () => tone(200, 0.25, { type: 'sawtooth', vol: 0.1, slide: -100 }),
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.1, delay: i * 0.09 })),
  boom:    () => tone(90, 0.4, { type: 'sawtooth', vol: 0.14, slide: -60 }),
  war:     () => { tone(110, 0.3, { type: 'sawtooth', vol: 0.1 }); tone(82, 0.4, { type: 'sawtooth', vol: 0.1, delay: 0.15 }); },
  treaty:  () => [392, 523, 659].forEach((f, i) => tone(f, 0.2, { type: 'sine', vol: 0.1, delay: i * 0.12 }))
};

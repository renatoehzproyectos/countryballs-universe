/** Tiny pub/sub used to decouple systems (store → HUD, games → achievements…). */
class EventBus {
  #m = new Map();
  on(ev, fn) { (this.#m.get(ev) ?? this.#m.set(ev, new Set()).get(ev)).add(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this.#m.get(ev)?.delete(fn); }
  emit(ev, data) { this.#m.get(ev)?.forEach(fn => fn(data)); }
}
export const bus = new EventBus();

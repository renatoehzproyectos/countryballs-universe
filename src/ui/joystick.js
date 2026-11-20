import { h, ui } from './dom.js';
import { input } from '../core/input.js';

/** Floating on-screen joystick (touch + mouse). Returns a disposer. */
export function mountJoystick() {
  const knob = h('i'), base = h('div.joy', knob); ui().append(base);
  let id = null, cx = 0, cy = 0; const R = 46;
  const move = e => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
    if (l > R) { dx = dx / l * R; dy = dy / l * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; input.joy.x = dx / R; input.joy.y = dy / R;
  };
  const end = e => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; input.joy.x = input.joy.y = 0; };
  base.addEventListener('pointerdown', e => { id = e.pointerId; base.setPointerCapture(id); const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); });
  base.addEventListener('pointermove', move); base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  return () => { base.remove(); input.joy.x = input.joy.y = 0; };
}

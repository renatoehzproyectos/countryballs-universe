import { h, ui } from './dom.js';
import { input } from '../core/input.js';

/** Multi-touch virtual joystick. It tracks only its own pointer, leaving other fingers free
 * to press jump or interact with the UI at the same time.
 */
export function mountJoystick() {
  const knob = h('i'), base = h('div.joy', knob);
  base.setAttribute('aria-label', 'Joystick de movimiento');
  base.setAttribute('role', 'application');
  base.style.touchAction = 'none';
  ui().append(base);

  let pointerId = null, cx = 0, cy = 0;
  const R = 46;
  const move = e => {
    if (e.pointerId !== pointerId) return;
    if (e.cancelable) e.preventDefault();
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    knob.style.transform = `translate3d(${dx}px,${dy}px,0)`;
    input.joy.x = dx / R;
    input.joy.y = dy / R;
  };
  const end = e => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    try { if (base.hasPointerCapture(e.pointerId)) base.releasePointerCapture(e.pointerId); } catch {}
    knob.style.transform = '';
    input.joy.x = input.joy.y = 0;
    input.releasePointer(e.pointerId);
  };
  base.addEventListener('pointerdown', e => {
    if (pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    pointerId = e.pointerId;
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    try { base.setPointerCapture(pointerId); } catch {}
    input.setPointer(pointerId, 'move');
    move(e);
  }, { passive: false });
  base.addEventListener('pointermove', move, { passive: false });
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
  base.addEventListener('lostpointercapture', end);
  return () => {
    if (pointerId !== null) { input.releasePointer(pointerId); pointerId = null; }
    base.remove();
    input.joy.x = input.joy.y = 0;
  };
}

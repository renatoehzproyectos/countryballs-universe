/** Unified movement input: keyboard (WASD/arrows) + virtual joystick. */
const keys = new Set();
addEventListener('keydown', e => keys.add(e.code));
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
export const input = {
  joy: { x: 0, y: 0 },
  /** x: right, y: down (screen space), length <= 1 */
  axis() {
    let x = this.joy.x, y = this.joy.y;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y); return l > 1 ? { x: x / l, y: y / l } : { x, y };
  },
  pressed: code => keys.has(code)
};

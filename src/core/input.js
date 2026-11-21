/** Unified input: keyboard + multi-touch virtual controls.
 * Movement and jump are independent, so a player can move and jump with two fingers.
 */
const keys = new Set();
const pointers = new Map();

addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); pointers.clear(); input.joy.x = input.joy.y = 0; });
addEventListener('contextmenu', e => { if (e.pointerType === 'touch') e.preventDefault(); });

export const input = {
  joy: { x: 0, y: 0 },
  jump: false,
  /** x: right, y: down (screen space), length <= 1 */
  axis() {
    let x = this.joy.x, y = this.joy.y;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  },
  pressed: code => keys.has(code),
  setPointer(id, data) { pointers.set(id, data); },
  releasePointer(id) { pointers.delete(id); },
  get activePointers() { return pointers.size; }
};

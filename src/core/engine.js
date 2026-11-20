import * as THREE from 'three';

/**
 * Owns the single WebGLRenderer + RAF loop. Only the *active* app is updated/rendered;
 * apps without a scene (DOM games) simply pause the loop, so nothing runs in the background.
 * App contract: { scene?, camera?, update?(dt, t), resize?(w, h) }.
 */
export class Engine {
  constructor(canvas) {
    const mobile = matchMedia('(pointer:coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = canvas; this.app = null; this.clock = new THREE.Clock(); this.t = 0; this.running = false;
    addEventListener('resize', () => this.resize());
    this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false);
    if (this.app?.camera) { this.app.camera.aspect = w / h; this.app.camera.updateProjectionMatrix(); }
    this.app?.resize?.(w, h);
  }
  setActive(app) {
    this.app = app; this.canvas.style.display = app?.scene ? 'block' : 'none';
    this.resize();
    if (app?.scene && !this.running) { this.running = true; this.clock.getDelta(); requestAnimationFrame(this.#loop); }
  }
  #loop = () => {
    if (!this.app?.scene) { this.running = false; return; }
    const dt = Math.min(this.clock.getDelta(), 0.05); this.t += dt;
    this.app.update?.(dt, this.t);
    this.renderer.render(this.app.scene, this.app.camera);
    requestAnimationFrame(this.#loop);
  };
}

/** Free GPU memory held by a scene graph. */
export function disposeScene(scene) {
  scene.traverse(o => {
    o.geometry?.dispose?.();
    const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose?.(); x.dispose?.(); });
  });
}

import * as THREE from 'three';
import { getFlagTexture } from './countryball.js';

/**
 * Lightweight procedural countryball (≈300 triangles) for pets, NPCs and crowds,
 * so we can show dozens on mobile. Same public API as the full Countryball.
 */
const body = new THREE.SphereGeometry(1, 20, 14);
const uv = new Float32Array(body.attributes.position.count * 2);
for (let i = 0; i < uv.length / 2; i++) {
  const p = body.attributes.position, x = p.getX(i), y = p.getY(i), z = p.getZ(i);
  uv[i * 2] = 0.5 + x / 2; uv[i * 2 + 1] = 0.5 + y / 2; // front-facing planar mapping (+Z front)
}
body.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
const eyeG = new THREE.SphereGeometry(0.2, 10, 8), pupG = new THREE.SphereGeometry(0.1, 8, 6);
const eyeM = new THREE.MeshBasicMaterial({ color: '#fff' }), pupM = new THREE.MeshBasicMaterial({ color: '#000' });

export class LiteBall {
  constructor({ flag, size = 1, angry = false, tint = null } = {}) {
    this.group = new THREE.Group(); this.pivot = new THREE.Group(); this.group.add(this.pivot);
    this.group.scale.setScalar(size); this.radius = 1;
    // Unlit material preserves every flag's original colors on mobile screens.
    this.mat = new THREE.MeshBasicMaterial({ color: tint ?? '#ffffff', side: THREE.DoubleSide, toneMapped: false });
    this.pivot.add(new THREE.Mesh(body, this.mat));
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(eyeG, eyeM); e.position.set(sx * 0.32, 0.18, 0.88); e.scale.set(1, 1.35, 0.5);
      const p = new THREE.Mesh(pupG, pupM); p.position.set(sx * 0.32, 0.16, 0.95); p.scale.set(1, 1.2, 0.5);
      this.pivot.add(e, p);
      if (angry) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.05), pupM); b.position.set(sx * 0.3, 0.52, 0.93); b.rotation.z = -sx * 0.45; this.pivot.add(b); }
    }
    this.flag = flag; this.ready = flag ? this.setFlagAsync(flag).then(() => this) : Promise.resolve(this);
  }
  async setFlagAsync(key) { this.mat.map = await getFlagTexture(key); this.mat.needsUpdate = true; this.flag = key; }
  setFlag(k) { this.setFlagAsync(k); }
  setHappy() {} setCosmetics() {}
  squash(s) { this.pivot.scale.set(1 - s * 0.35, 1 + s, 1 - s * 0.35); }
  dispose() { this.mat.dispose(); }
}

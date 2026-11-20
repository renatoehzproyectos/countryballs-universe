import * as THREE from 'three';

/** Procedural low-poly hats & glasses. Ball radius is ~1, front faces +Z. */
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o });
const mesh = (geo, m, pos = [0, 0, 0], rot = [0, 0, 0]) => {
  const x = new THREE.Mesh(geo, m); x.position.set(...pos); x.rotation.set(...rot); return x;
};
const HATS = {
  cap() { const g = new THREE.Group(), m = mat('#d62828');
    g.add(mesh(new THREE.SphereGeometry(0.62, 14, 8, 0, 6.3, 0, 1.4), m, [0, 0.82, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 14, 1, false, -1.6, 3.2), m, [0, 0.9, 0.55], [0.15, 0, 0])); return g; },
  party() { const g = new THREE.Group();
    g.add(mesh(new THREE.ConeGeometry(0.38, 0.9, 12), mat('#ff4da6'), [0, 1.3, 0], [0, 0, 0.12]));
    g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), mat('#ffe14a'), [0.05, 1.78, 0])); return g; },
  cowboy() { const g = new THREE.Group(), m = mat('#8b5a2b');
    g.add(mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 18), m, [0, 0.9, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.45, 14), m, [0, 1.12, 0])); return g; },
  tophat() { const g = new THREE.Group(), m = mat('#161616');
    g.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 18), m, [0, 0.92, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 16), m, [0, 1.28, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 16), mat('#b91c1c'), [0, 1.0, 0])); return g; },
  helmet() { const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(0.72, 16, 10, 0, 6.3, 0, 1.3), mat('#4b5d3a', { roughness: 0.9 }), [0, 0.74, 0])); return g; },
  wizard() { const g = new THREE.Group(), m = mat('#3b2a8c');
    g.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 18), m, [0, 0.9, 0]));
    g.add(mesh(new THREE.ConeGeometry(0.46, 1.25, 14), m, [0, 1.5, 0], [0, 0, -0.12]));
    g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), mat('#ffd54a', { emissive: '#ffd54a' }), [0.1, 1.55, 0.42])); return g; },
  crown() { const g = new THREE.Group(), m = mat('#ffc933', { metalness: 0.8, roughness: 0.25 });
    g.add(mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.3, 10, 1, true), m, [0, 1.0, 0]));
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283;
      g.add(mesh(new THREE.ConeGeometry(0.1, 0.28, 5), m, [Math.cos(a) * 0.43, 1.28, Math.sin(a) * 0.43])); }
    return g; },
  halo() { const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 24), mat('#fff0a0', { emissive: '#ffd54a', emissiveIntensity: 0.9 }), [0, 1.35, 0], [Math.PI / 2, 0, 0])); return g; }
};
const GLASSES = {
  round() { const g = new THREE.Group(), m = mat('#222');
    for (const x of [-0.3, 0.3]) g.add(mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16), m, [x, 0.12, 0.99]));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), m, [0, 0.14, 0.99])); return g; },
  shades() { const g = new THREE.Group(), m = mat('#0a0a0a', { roughness: 0.15, metalness: 0.4 });
    for (const x of [-0.3, 0.3]) g.add(mesh(new THREE.BoxGeometry(0.44, 0.26, 0.05), m, [x, 0.12, 0.98]));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), m, [0, 0.18, 0.99])); return g; },
  monocle() { const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 18), mat('#e8b923', { metalness: 0.8 }), [0.3, 0.12, 0.99])); return g; },
  visor() { const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1.1, 0.26, 0.06), mat('#19f5d0', { emissive: '#19f5d0', emissiveIntensity: 0.7, transparent: true, opacity: 0.85 }), [0, 0.12, 0.99])); return g; }
};
export function buildCosmetic(slot, id) {
  const f = (slot === 'hat' ? HATS : GLASSES)[id]; return f ? f() : null;
}

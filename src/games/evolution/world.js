import * as THREE from 'three';

export const ARENA = 34;
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });

/** Low-poly enemy bodies. */
export const SHAPES = {
  box: () => new THREE.BoxGeometry(1.5, 1.5, 1.5), cone: () => new THREE.ConeGeometry(0.95, 1.8, 7),
  ico: () => new THREE.IcosahedronGeometry(1, 0), octa: () => new THREE.OctahedronGeometry(1.1, 0),
  tetra: () => new THREE.TetrahedronGeometry(1.2, 0), torus: () => new THREE.TorusGeometry(0.8, 0.35, 6, 10)
};

/** Scenery parts per prop kind: [geometry factory, colour, y offset]. */
const PROPS = {
  pine:    [[() => new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), '#7a4b25', 0.8], [() => new THREE.ConeGeometry(1.4, 3, 7), '#2f8f46', 2.8]],
  palm:    [[() => new THREE.CylinderGeometry(0.2, 0.3, 3.4, 6), '#a9753b', 1.7], [() => new THREE.ConeGeometry(1.8, 0.9, 6), '#34c25a', 3.6]],
  rock:    [[() => new THREE.DodecahedronGeometry(1.4, 0), '#8f98a8', 0.9]],
  acacia:  [[() => new THREE.CylinderGeometry(0.2, 0.3, 2.6, 6), '#6b4a2a', 1.3], [() => new THREE.CylinderGeometry(2.2, 1.6, 0.5, 8), '#5f9f3a', 2.8]],
  crystal: [[() => new THREE.OctahedronGeometry(1.2, 0), '#7ee7ff', 1.6, [0.7, 1.7, 0.7]]]
};

/** Build ground, sky tint and instanced scenery for a world definition. Returns a Group to dispose later. */
export function buildArena(scene, def) {
  const g = new THREE.Group();
  scene.background = new THREE.Color(def.sky); scene.fog = new THREE.Fog(def.sky, 40, 90);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(ARENA + 14, 48), std(def.ground)); ground.rotation.x = -Math.PI / 2; g.add(ground);
  const rim = new THREE.Mesh(new THREE.RingGeometry(ARENA, ARENA + 0.6, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.05; g.add(rim);
  const parts = PROPS[def.prop], N = 46, m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const meshes = parts.map(([geo, col]) => { const im = new THREE.InstancedMesh(geo(), std(col, def.prop === 'crystal' ? { emissive: col, emissiveIntensity: 0.4 } : {}), N); g.add(im); return im; });
  for (let i = 0; i < N; i++) {
    const a = Math.random() * 6.283, r = ARENA - 3 + Math.random() * 16, k = 0.8 + Math.random() * 0.9; p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    parts.forEach(([, , y, sc], j) => { s.set(...(sc ?? [1, 1, 1])).multiplyScalar(k); m.compose(p.clone().setY(y * k), q, s); meshes[j].setMatrixAt(i, m); });
  }
  scene.add(g); return g;
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadFlag } from './flags.js';
import { buildCosmetic } from './cosmetics.js';

/**
 * Countryball factory. Uses the supplied Blender model (public/models/countryball.glb):
 * the body mesh gets a freshly generated flag texture + the supplied rough normal map,
 * the white corneas and black pupils are kept, and the alternate "happy" eyes can be toggled.
 * The model faces +X natively; we wrap it so the finished ball faces +Z.
 */
let template = null, templatePromise = null, normalTex = null;
const textures = new Map();

function loadTemplate() {
  templatePromise ??= new Promise((resolve, reject) => {
    new GLTFLoader().load('/models/countryball.glb', gltf => {
      template = gltf.scene;
      normalTex = new THREE.TextureLoader().load('/models/ball_normal.png');
      normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping; normalTex.repeat.set(5, 3);
      resolve(template);
    }, undefined, reject);
  });
  return templatePromise;
}

/**
 * Front-facing planar UVs: what the player sees from the front IS the flag (like the reference
 * figurine), instead of wrapping it around the sphere where only a stretched sliver shows.
 * Local +X is the model's front, local +Z ends up screen-left, so u runs along -Z.
 */
function applyFrontUVs(geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3());
  const R = Math.max(bb.max.z - bb.min.z, bb.max.y - bb.min.y) / 2 || 1;
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = 0.5 - (p.getZ(i) - c.z) / (2 * R);
    uv[i * 2 + 1] = 0.5 + (p.getY(i) - c.y) / (2 * R);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/**
 * Flag texture (square, mapped to the ball's front disc). The central part of the flag is shown
 * at roughly its natural proportions (so e.g. Chile shows canton + star, white and red bands);
 * very wide flags are squeezed a little so they are not cropped to a tiny slice.
 */
export async function getFlagTexture(key) {
  if (textures.has(key)) return textures.get(key);
  const img = await loadFlag(key);
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const sw = img.naturalWidth || img.width || 3, sh = img.naturalHeight || img.height || 2;
  const aspect = sw / sh, f = Math.min(1, Math.max(1 / aspect, 0.62));
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (sw * (1 - f)) / 2, 0, sw * f, sh, 0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  textures.set(key, t); return t;
}

export class Countryball {
  /** @param {{flag:string, hat?:string|null, glasses?:string|null, size?:number}} opts */
  constructor({ flag, hat = null, glasses = null, size = 1 } = {}) {
    this.group = new THREE.Group();        // translate/rotate this
    this.pivot = new THREE.Group();        // squash & stretch target
    this.group.add(this.pivot);
    this.size = size; this.flag = flag; this.happyEyes = []; this.neutralEyes = [];
    this.group.scale.setScalar(size);
    this.ready = this.#build(flag).then(() => { this.setCosmetics({ hat, glasses }); return this; });
  }

  async #build(flag) {
    const [tpl, tex] = await Promise.all([loadTemplate(), getFlagTexture(flag)]);
    const model = tpl.clone(true);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3());
    const inner = new THREE.Group(); inner.add(model); model.position.sub(c);
    inner.rotation.y = -Math.PI / 2;        // +X (model front) -> +Z
    this.pivot.add(inner);
    const happy = new Set(['feliz derecha_6', 'feliz derecha.001_7', 'feliz izquierda_8', 'feliz izquierda.001_9']);
    model.traverse(o => {
      if (happy.has(o.name)) { this.happyEyes.push(o); o.visible = false; }
      if (o.name === 'ball_0') {
        const body = o.children[0];
        body.geometry = body.geometry.clone(); applyFrontUVs(body.geometry);
        this.body = body;
        this.bodyMat = new THREE.MeshStandardMaterial({ map: tex, normalMap: normalTex, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.55, metalness: 0.05 });
        body.material = this.bodyMat;
      }
    });
    // normalise radius to ~1 (model is ~1.0 already); expose for hit-testing
    this.radius = 1;
  }

  setFlag(key) { getFlagTexture(key).then(t => { if (this.bodyMat) { this.bodyMat.map = t; this.bodyMat.needsUpdate = true; this.flag = key; } }); }

  setHappy(on) {
    // Happy eyes overlay the neutral pupils; both share the corneas.
    for (const e of this.happyEyes) e.visible = on;
  }

  setCosmetics({ hat, glasses }) {
    this.accessories?.forEach(a => this.pivot.remove(a)); this.accessories = [];
    for (const [slot, id] of [['hat', hat], ['glasses', glasses]]) {
      const m = id && buildCosmetic(slot, id); if (m) { this.pivot.add(m); this.accessories.push(m); }
    }
  }

  /** Cartoony squash: s>0 stretches vertically. */
  squash(s) { this.pivot.scale.set(1 - s * 0.35, 1 + s, 1 - s * 0.35); }

  dispose() { this.bodyMat?.dispose(); this.body?.geometry.dispose(); }
}

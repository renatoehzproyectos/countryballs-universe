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
function applySphericalFlagUVs(geo, frontAxis = 'x') {
  // Planar front projection, 3:2 flag: the whole flag is visible from the front.
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  const v = new THREE.Vector3();
  const a = 0.8;        // half visible width (in radii)
  const b = a / 1.5;    // half visible height (3:2)
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const side = frontAxis === 'z' ? v.x : -v.z;
    uv[i * 2] = 0.5 + side / (2 * a);
    uv[i * 2 + 1] = 0.5 + v.y / (2 * b);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/**
 * Creates a 2:1 equirectangular flag texture for spherical UVs. All source flags
 * (SVG and procedural canvas flags) go through this same path, so the main ball,
 * NPCs, evolution balls and remote players render consistently.
 */
export async function getFlagTexture(key) {
  if (textures.has(key)) return textures.get(key);
  const img = await loadFlag(key);
  const W = 768, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { alpha: false });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  const sw = img.naturalWidth || img.width || 3;
  const sh = img.naturalHeight || img.height || 2;
  // A flag covers the full sphere. A small aspect adaptation is preferable to
  // cropping important details such as stars, suns, crosses or coats of arms.
  g.drawImage(img, 0, 0, sw, sh, 0, 0, W, H);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  textures.set(key, t);
  return t;
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
        body.geometry = body.geometry.clone(); applySphericalFlagUVs(body.geometry, 'x');
        this.body = body;
        // Preserve exact flag colors: lighting and the decorative normal map washed out pale stripes and emblems on mobile.
        this.bodyMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
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

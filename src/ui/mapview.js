import geo from '../data/geo.json';

const NS = 'http://www.w3.org/2000/svg';
/** Interactive SVG world map with one-finger pan, two-finger pinch zoom and tap selection. */
export function createMapView({ onTap, ocean = '#0a3a6b' } = {}) {
  const el = document.createElement('div');
  el.style.cssText = `background:${ocean};overflow:hidden;touch-action:none;overscroll-behavior:contain;position:relative;width:100%;height:100%`;
  const svg = document.createElementNS(NS, 'svg');
  svg.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  const land = document.createElementNS(NS, 'g'), over = document.createElementNS(NS, 'g');
  over.style.pointerEvents = 'none'; svg.append(land, over); el.append(svg);
  const paths = {};
  for (const r of geo.regions) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', r.d); p.dataset.id = r.id; p.setAttribute('fill', '#3d7a4a');
    p.setAttribute('stroke', '#0b2a1a'); p.setAttribute('stroke-width', '0.35');
    p.setAttribute('vector-effect', 'non-scaling-stroke'); land.append(p); paths[r.id] = p;
  }
  const vb = { x: 0, y: 0, w: geo.w, h: geo.h };
  const apply = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  apply();
  const clamp = () => {
    vb.w = Math.min(geo.w, Math.max(70, vb.w)); vb.h = vb.w * geo.h / geo.w;
    vb.x = Math.max(0, Math.min(geo.w - vb.w, vb.x));
    vb.y = Math.max(0, Math.min(geo.h - vb.h, vb.y)); apply();
  };
  const zoomAt = (k, fx, fy) => {
    const nw = Math.min(geo.w, Math.max(70, vb.w * k)), nh = nw * geo.h / geo.w;
    vb.x += (vb.w - nw) * fx; vb.y += (vb.h - nh) * fy;
    vb.w = nw; vb.h = nh; clamp();
  };
  el.addEventListener('wheel', e => {
    e.preventDefault(); const r = el.getBoundingClientRect();
    zoomAt(e.deltaY > 0 ? 1.15 : 0.87, (e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height);
  }, { passive: false });

  const pts = new Map();
  let pinchDistance = 0, pinchMid = null;
  const pointData = e => ({ x: e.clientX, y: e.clientY });
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const midpoint = (a,b) => ({ x:(a.x+b.x)/2, y:(a.y+b.y)/2 });
  const pointerDown = e => {
    if (e.cancelable) e.preventDefault();
    const rec = { ...pointData(e), startX:e.clientX, startY:e.clientY,
      moved:false, target:e.target, pointerType:e.pointerType };
    pts.set(e.pointerId, rec);
    try { el.setPointerCapture(e.pointerId); } catch {}
    if (pts.size === 2) {
      const [a,b] = [...pts.values()];
      pinchDistance = distance(a,b); pinchMid = midpoint(a,b);
      for (const p of pts.values()) p.moved = true;
    } else if (pts.size > 2) {
      for (const p of pts.values()) p.moved = true;
    }
  };
  const pointerMove = e => {
    const prev = pts.get(e.pointerId); if (!prev) return;
    if (e.cancelable) e.preventDefault();
    const next = { ...prev, x:e.clientX, y:e.clientY };
    if (Math.hypot(next.x-prev.startX, next.y-prev.startY) > 7) next.moved = true;
    pts.set(e.pointerId, next);
    const r = el.getBoundingClientRect();
    if (pts.size === 1) {
      if (next.moved) {
        const scale = Math.max(vb.w/r.width, vb.h/r.height);
        vb.x -= (next.x-prev.x)*scale; vb.y -= (next.y-prev.y)*scale; clamp();
      }
    } else if (pts.size === 2) {
      const [a,b] = [...pts.values()], d = distance(a,b), mid = midpoint(a,b);
      if (pinchDistance > 0 && d > 0) {
        zoomAt(pinchDistance/d, (mid.x-r.left)/r.width, (mid.y-r.top)/r.height);
        const scale = Math.max(vb.w/r.width, vb.h/r.height);
        vb.x -= (mid.x-pinchMid.x)*scale; vb.y -= (mid.y-pinchMid.y)*scale; clamp();
      }
      pinchDistance = d; pinchMid = mid;
    }
  };
  const pointerUp = e => {
    const rec = pts.get(e.pointerId); if (!rec) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) { pinchDistance = 0; pinchMid = null; }
    if (pts.size === 0 && !rec.moved && e.type === 'pointerup') {
      const id = rec.target?.dataset?.id;
      if (id && onTap) onTap(id, rec.target);
    }
  };
  el.addEventListener('pointerdown', pointerDown, { passive:false });
  el.addEventListener('pointermove', pointerMove, { passive:false });
  el.addEventListener('pointerup', pointerUp);
  el.addEventListener('pointercancel', pointerUp);
  el.addEventListener('lostpointercapture', pointerUp);
  return {
    el, svg, paths, overlay: over,
    fill(id, color) { paths[id]?.setAttribute('fill', color); },
    stroke(id, color, w = 0.35) { const p = paths[id]; if (p) { p.setAttribute('stroke', color); p.setAttribute('stroke-width', w); } },
    focus(id, zoom = 0.3) { const r = geo.regions.find(x => x.id === id); if (!r) return; vb.w = geo.w*zoom; vb.h = vb.w*geo.h/geo.w; vb.x = r.cx-vb.w/2; vb.y = r.cy-vb.h/2; clamp(); },
    reset() { vb.x = vb.y = 0; vb.w = geo.w; vb.h = geo.h; apply(); },
    zoomBy: k => zoomAt(k, 0.5, 0.5)
  };
}
export { geo };

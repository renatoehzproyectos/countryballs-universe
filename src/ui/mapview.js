import geo from '../data/geo.json';

const NS = 'http://www.w3.org/2000/svg';
/**
 * Interactive SVG world map with pan + pinch/scroll zoom. Shared by World Conquest and the
 * Flag Quiz map challenge. Taps are distinguished from drags, so panning never selects a country.
 */
export function createMapView({ onTap, ocean = '#0a3a6b' } = {}) {
  const el = document.createElement('div'); el.style.cssText = `background:${ocean};overflow:hidden;touch-action:none;position:relative;width:100%;height:100%`;
  const svg = document.createElementNS(NS, 'svg'); svg.style.cssText = 'width:100%;height:100%;display:block'; svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  const land = document.createElementNS(NS, 'g'), over = document.createElementNS(NS, 'g'); over.style.pointerEvents = 'none'; svg.append(land, over); el.append(svg);
  const paths = {};
  for (const r of geo.regions) {
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', r.d); p.dataset.id = r.id; p.setAttribute('fill', '#3d7a4a'); p.setAttribute('stroke', '#0b2a1a'); p.setAttribute('stroke-width', '0.35'); p.setAttribute('vector-effect', 'non-scaling-stroke');
    land.append(p); paths[r.id] = p;
  }
  const vb = { x: 0, y: 0, w: geo.w, h: geo.h }; const apply = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); apply();
  const clamp = () => { vb.w = Math.min(geo.w, Math.max(70, vb.w)); vb.h = vb.w * geo.h / geo.w; vb.x = Math.max(0, Math.min(geo.w - vb.w, vb.x)); vb.y = Math.max(0, Math.min(geo.h - vb.h, vb.y)); apply(); };
  const zoomAt = (k, fx, fy) => { const nw = Math.min(geo.w, Math.max(70, vb.w * k)), nh = nw * geo.h / geo.w; vb.x += (vb.w - nw) * fx; vb.y += (vb.h - nh) * fy; vb.w = nw; vb.h = nh; clamp(); };
  el.addEventListener('wheel', e => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.deltaY > 0 ? 1.15 : 0.87, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
  const pts = new Map(); let pinch = 0, down = null;
  el.addEventListener('pointerdown', e => { pts.set(e.pointerId, e); down = { x: e.clientX, y: e.clientY, moved: false, target: e.target }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); down.moved = true; } });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, e); const r = el.getBoundingClientRect(), scale = vb.w / r.width * Math.max(1, (r.height * geo.w / geo.h) / r.width < 1 ? 1 : 1);
    if (pts.size === 1) { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) down.moved = true; if (down?.moved) { const k = Math.max(vb.w / r.width, vb.h / r.height); vb.x -= (e.clientX - prev.clientX) * k; vb.y -= (e.clientY - prev.clientY) * k; clamp(); } }
    else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (pinch) zoomAt(pinch / d, 0.5, 0.5); pinch = d; }
  });
  const up = e => { const was = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (was && down && !down.moved && e.type === 'pointerup') { const id = down.target?.dataset?.id; if (id && onTap) onTap(id, down.target); } if (!pts.size) down = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  return {
    el, svg, paths, overlay: over,
    fill(id, color) { paths[id]?.setAttribute('fill', color); },
    stroke(id, color, w = 0.35) { const p = paths[id]; if (p) { p.setAttribute('stroke', color); p.setAttribute('stroke-width', w); } },
    focus(id, zoom = 0.3) { const r = geo.regions.find(x => x.id === id); if (!r) return; vb.w = geo.w * zoom; vb.h = vb.w * geo.h / geo.w; vb.x = r.cx - vb.w / 2; vb.y = r.cy - vb.h / 2; clamp(); },
    reset() { vb.x = vb.y = 0; vb.w = geo.w; vb.h = geo.h; apply(); },
    zoomBy: k => zoomAt(k, 0.5, 0.5)
  };
}
export { geo };

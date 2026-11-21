// Build-time data generator: world-atlas + world-countries -> compact JSON used by Conquest & Quiz.
// Run with `npm run gen:geo`. Output is committed so deploys need no generation step.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
const require = createRequire(import.meta.url);
const topo = require('world-atlas/countries-110m.json');
const countries = require('world-countries');

const W = 1000, H = 500;
const projection = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
const path = geoPath(projection).digits?.(1) ?? geoPath(projection);
const byNum = Object.fromEntries(countries.map(c => [c.ccn3, c]));
const a3to2 = Object.fromEntries(countries.map(c => [c.cca3, c.cca2]));

const regions = [];
for (const f of feature(topo, topo.objects.countries).features) {
  if (f.properties.name === 'Antarctica') continue;
  let c = byNum[String(f.id).padStart(3, '0')];
  if (!c) { // Kosovo, N. Cyprus, Somaliland have no ccn3 in atlas
    if (f.properties.name === 'Kosovo') c = countries.find(x => x.cca2 === 'XK');
    if (!c) continue;
  }
  const d = path(f); if (!d) continue;
  const [cx, cy] = path.centroid(f);
  regions.push({ id: c.cca2, d: d.replace(/(\d+\.\d)\d+/g, '$1'), cx: +cx.toFixed(1), cy: +cy.toFixed(1), area: Math.round(path.area(f)) });
}
const ids = new Set(regions.map(r => r.id));
const meta = {};
for (const c of countries) {
  if (!(c.independent || ids.has(c.cca2))) continue;
  const sub = c.subregion || '';
  let cont = c.region;
  if (cont === 'Americas') cont = sub === 'South America' ? 'South America' : 'North America';
  meta[c.cca2] = {
    n: c.translations?.spa?.common ?? c.name.common, r: cont, cap: (c.capital && c.capital[0]) || '—',
    b: (c.borders || []).map(x => a3to2[x]).filter(Boolean), a: c.area, ind: !!c.independent
  };
}
writeFileSync('src/data/geo.json', JSON.stringify({ w: W, h: H, regions }));
writeFileSync('src/data/countryMeta.json', JSON.stringify(meta));
console.log('regions', regions.length, 'meta', Object.keys(meta).length,
  'independent', Object.values(meta).filter(m => m.ind).length);

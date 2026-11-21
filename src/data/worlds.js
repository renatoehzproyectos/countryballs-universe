/**
 * Evolution worlds. `tier` scales enemy stats and rewards. `req` gates travel
 * (Evolution level + rebirths). `props` describes instanced scenery as [geometry, colour, y, scale].
 * Enemy `shape` maps to a low-poly geometry in the game.
 */
export const WORLDS = [
  { id: 'europe', name: 'Llanuras de Europa', icon: '🏰', tier: 1, req: { level: 1, rebirth: 0 }, sky: '#8fd3ff', ground: '#6bbf59', prop: 'pine',
    enemies: [{ name: 'Cubo travieso', shape: 'box', color: '#c7b27a' }, { name: 'Peón gruñón', shape: 'cone', color: '#9b7bd1' }],
    relic: { name: 'Ámbar', color: '#ffb347' }, boss: { name: 'Zar Gruñón', flag: 'ru' }, npcs: [{ name: 'Abuelo Franceball', flag: 'fr', quest: { type: 'kill', n: 12, text: 'Vence a 12 traviesos' } }, { name: 'Panadero Germanyball', flag: 'de', quest: { type: 'coins', n: 150, text: 'Recoge 150 monedas' } }] },
  { id: 'samerica', name: 'Selva Amazónica', icon: '🌴', tier: 2, req: { level: 8, rebirth: 0 }, sky: '#9be8c8', ground: '#2f9e4f', prop: 'palm',
    enemies: [{ name: 'Baba de selva', shape: 'ico', color: '#4de06a' }, { name: 'Pincho de liana', shape: 'tetra', color: '#157a3a' }],
    relic: { name: 'Ídolo de jade', color: '#2fe0a0' }, boss: { name: 'Gran Jaguar', flag: 'br' }, npcs: [{ name: 'Guía Chileball', flag: 'cl', quest: { type: 'kill', n: 20, text: 'Vence a 20 bichos de la selva' } }, { name: 'Exploradora Peruball', flag: 'pe', quest: { type: 'relic', n: 3, text: 'Encuentra 3 ídolos de jade' } }] },
  { id: 'asia', name: 'Montañas de Asia', icon: '⛩️', tier: 3, req: { level: 18, rebirth: 0 }, sky: '#ffd6e0', ground: '#9bb85a', prop: 'rock',
    enemies: [{ name: 'Farolillo Oni', shape: 'octa', color: '#ff5d5d' }, { name: 'Anillo tormenta', shape: 'torus', color: '#ffd24a' }],
    relic: { name: 'Rollo de seda', color: '#ff8fb0' }, boss: { name: 'Emperador Dragón', flag: 'cn' }, npcs: [{ name: 'Monje Japanball', flag: 'jp', quest: { type: 'kill', n: 30, text: 'Vence a 30 espíritus' } }, { name: 'Comerciante Indiaball', flag: 'in', quest: { type: 'coins', n: 800, text: 'Recoge 800 monedas' } }] },
  { id: 'africa', name: 'Sabana de África', icon: '🦁', tier: 4, req: { level: 30, rebirth: 0 }, sky: '#ffe3a3', ground: '#d2ab55', prop: 'acacia',
    enemies: [{ name: 'Escarabajo', shape: 'ico', color: '#c4572a' }, { name: 'Tótem solar', shape: 'box', color: '#ffb02e' }],
    relic: { name: 'Pepita de oro', color: '#ffd400' }, boss: { name: 'Faraón Gigante', flag: 'eg' }, npcs: [{ name: 'Anciano Nigeriaball', flag: 'ng', quest: { type: 'kill', n: 40, text: 'Vence a 40 fieras' } }, { name: 'Explorador Southafricaball', flag: 'za', quest: { type: 'relic', n: 4, text: 'Encuentra 4 pepitas de oro' } }] },
  { id: 'atlantis', name: 'Profundidades de la Atlántida', icon: '🔱', tier: 5, req: { level: 45, rebirth: 0 }, sky: '#6fe3e0', ground: '#1b6e8a', prop: 'crystal',
    enemies: [{ name: 'Gólem de coral', shape: 'octa', color: '#ff7ab6' }, { name: 'Orbe abisal', shape: 'ico', color: '#3a7bff' }],
    relic: { name: 'Perla', color: '#e8fffb' }, boss: { name: 'Señor Kraken', flag: 'atlantis' }, npcs: [{ name: 'Sacerdote Greeceball', flag: 'gr', quest: { type: 'kill', n: 50, text: 'Vence a 50 espíritus del mar' } }, { name: 'Marinero Portugalball', flag: 'pt', quest: { type: 'coins', n: 3000, text: 'Recoge 3000 monedas' } }] },
  { id: 'cosmos', name: 'Dimensión Cósmica', icon: '🌌', tier: 6, req: { level: 60, rebirth: 1 }, sky: '#1a0f4a', ground: '#2a1a5e', prop: 'crystal',
    enemies: [{ name: 'Chispa estelar', shape: 'tetra', color: '#9b5cff' }, { name: 'Núcleo nebulosa', shape: 'ico', color: '#ff4da6' }],
    relic: { name: 'Trozo de estrella', color: '#fff27a' }, boss: { name: 'Gran Cósmico', flag: 'galaxy' }, npcs: [{ name: 'Oráculo Cosmicball', flag: 'galaxy', quest: { type: 'kill', n: 60, text: 'Vence a 60 criaturas estelares' } }, { name: 'Piloto EUball', flag: 'eu', quest: { type: 'relic', n: 5, text: 'Encuentra 5 trozos de estrella' } }] },
  { id: 'void', name: 'Dimensión del Vacío', icon: '🕳️', tier: 7, req: { level: 80, rebirth: 2 }, sky: '#05010a', ground: '#150a26', prop: 'rock',
    enemies: [{ name: 'Sombra nula', shape: 'octa', color: '#7a2cff' }, { name: 'Ojo del vacío', shape: 'torus', color: '#19f5d0' }],
    relic: { name: 'Fragmento del vacío', color: '#b36bff' }, boss: { name: 'El Gran Vacío', flag: 'void' }, npcs: [{ name: 'Ermitaño Pirateball', flag: 'pirate', quest: { type: 'kill', n: 80, text: 'Vence a 80 sombras del vacío' } }, { name: 'Vidente Goldball', flag: 'gold', quest: { type: 'coins', n: 20000, text: 'Recoge 20.000 monedas' } }] }
];
export const WORLD_BY_ID = Object.fromEntries(WORLDS.map(w => [w.id, w]));
export const evoXpNeeded = l => Math.round(20 * l ** 1.5);
export const rebirthLevelNeeded = r => Math.min(60, 25 + 5 * r);

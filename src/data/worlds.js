/**
 * Evolution worlds. `tier` scales enemy stats and rewards. `req` gates travel
 * (Evolution level + rebirths). `props` describes instanced scenery as [geometry, colour, y, scale].
 * Enemy `shape` maps to a low-poly geometry in the game.
 */
export const WORLDS = [
  { id: 'europe', name: 'Europe Plains', icon: '🏰', tier: 1, req: { level: 1, rebirth: 0 }, sky: '#8fd3ff', ground: '#6bbf59', prop: 'pine',
    enemies: [{ name: 'Rogue Cube', shape: 'box', color: '#c7b27a' }, { name: 'Angry Pawn', shape: 'cone', color: '#9b7bd1' }],
    relic: { name: 'Amber Shard', color: '#ffb347' }, boss: { name: 'Mad Tsarball', flag: 'ru' }, npcs: [{ name: 'Old Franceball', flag: 'fr', quest: { type: 'kill', n: 12, text: 'Defeat 12 rogues' } }, { name: 'Baker Germanyball', flag: 'de', quest: { type: 'coins', n: 150, text: 'Collect 150 coins' } }] },
  { id: 'samerica', name: 'Amazon Jungle', icon: '🌴', tier: 2, req: { level: 8, rebirth: 0 }, sky: '#9be8c8', ground: '#2f9e4f', prop: 'palm',
    enemies: [{ name: 'Jungle Slime', shape: 'ico', color: '#4de06a' }, { name: 'Vine Spike', shape: 'tetra', color: '#157a3a' }],
    relic: { name: 'Jade Idol', color: '#2fe0a0' }, boss: { name: 'El Gran Jaguarball', flag: 'br' }, npcs: [{ name: 'Guide Chileball', flag: 'cl', quest: { type: 'kill', n: 20, text: 'Clear 20 jungle foes' } }, { name: 'Explorer Peruball', flag: 'pe', quest: { type: 'relic', n: 3, text: 'Find 3 Jade Idols' } }] },
  { id: 'asia', name: 'Asian Highlands', icon: '⛩️', tier: 3, req: { level: 18, rebirth: 0 }, sky: '#ffd6e0', ground: '#9bb85a', prop: 'rock',
    enemies: [{ name: 'Lantern Oni', shape: 'octa', color: '#ff5d5d' }, { name: 'Storm Ring', shape: 'torus', color: '#ffd24a' }],
    relic: { name: 'Silk Scroll', color: '#ff8fb0' }, boss: { name: 'Dragon Emperor', flag: 'cn' }, npcs: [{ name: 'Monk Japanball', flag: 'jp', quest: { type: 'kill', n: 30, text: 'Defeat 30 spirits' } }, { name: 'Merchant Indiaball', flag: 'in', quest: { type: 'coins', n: 800, text: 'Collect 800 coins' } }] },
  { id: 'africa', name: 'African Savanna', icon: '🦁', tier: 4, req: { level: 30, rebirth: 0 }, sky: '#ffe3a3', ground: '#d2ab55', prop: 'acacia',
    enemies: [{ name: 'Dune Scarab', shape: 'ico', color: '#c4572a' }, { name: 'Sun Totem', shape: 'box', color: '#ffb02e' }],
    relic: { name: 'Gold Nugget', color: '#ffd400' }, boss: { name: 'Pharaoh Colossus', flag: 'eg' }, npcs: [{ name: 'Elder Nigeriaball', flag: 'ng', quest: { type: 'kill', n: 40, text: 'Defeat 40 beasts' } }, { name: 'Scout Southafricaball', flag: 'za', quest: { type: 'relic', n: 4, text: 'Find 4 Gold Nuggets' } }] },
  { id: 'atlantis', name: 'Atlantis Deeps', icon: '🔱', tier: 5, req: { level: 45, rebirth: 0 }, sky: '#6fe3e0', ground: '#1b6e8a', prop: 'crystal',
    enemies: [{ name: 'Coral Golem', shape: 'octa', color: '#ff7ab6' }, { name: 'Abyss Orb', shape: 'ico', color: '#3a7bff' }],
    relic: { name: 'Pearl', color: '#e8fffb' }, boss: { name: 'Kraken Lord', flag: 'atlantis' }, npcs: [{ name: 'Priest Greeceball', flag: 'gr', quest: { type: 'kill', n: 50, text: 'Banish 50 sea spirits' } }, { name: 'Sailor Portugalball', flag: 'pt', quest: { type: 'coins', n: 3000, text: 'Collect 3000 coins' } }] },
  { id: 'cosmos', name: 'Cosmic Dimension', icon: '🌌', tier: 6, req: { level: 60, rebirth: 1 }, sky: '#1a0f4a', ground: '#2a1a5e', prop: 'crystal',
    enemies: [{ name: 'Star Wisp', shape: 'tetra', color: '#9b5cff' }, { name: 'Nebula Core', shape: 'ico', color: '#ff4da6' }],
    relic: { name: 'Star Fragment', color: '#fff27a' }, boss: { name: 'Cosmic Eldritchball', flag: 'galaxy' }, npcs: [{ name: 'Oracle Cosmicball', flag: 'galaxy', quest: { type: 'kill', n: 60, text: 'Defeat 60 star spawn' } }, { name: 'Pilot EUball', flag: 'eu', quest: { type: 'relic', n: 5, text: 'Find 5 Star Fragments' } }] },
  { id: 'void', name: 'Void Dimension', icon: '🕳️', tier: 7, req: { level: 80, rebirth: 2 }, sky: '#05010a', ground: '#150a26', prop: 'rock',
    enemies: [{ name: 'Null Shade', shape: 'octa', color: '#7a2cff' }, { name: 'Rift Eye', shape: 'torus', color: '#19f5d0' }],
    relic: { name: 'Void Shard', color: '#b36bff' }, boss: { name: 'The Voidball', flag: 'void' }, npcs: [{ name: 'Hermit Pirateball', flag: 'pirate', quest: { type: 'kill', n: 80, text: 'Defeat 80 void shades' } }, { name: 'Seer Goldball', flag: 'gold', quest: { type: 'coins', n: 20000, text: 'Collect 20,000 coins' } }] }
];
export const WORLD_BY_ID = Object.fromEntries(WORLDS.map(w => [w.id, w]));
export const evoXpNeeded = l => Math.round(20 * l ** 1.5);
export const rebirthLevelNeeded = r => Math.min(60, 25 + 5 * r);

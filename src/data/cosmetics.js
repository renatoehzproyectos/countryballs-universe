/** Wearable cosmetics. Meshes are built procedurally in characters/cosmetics.js. */
export const COSMETICS = [
  { id: 'cap',     slot: 'hat',     name: 'Baseball Cap',  price: 200,  icon: '🧢' },
  { id: 'party',   slot: 'hat',     name: 'Party Hat',     price: 300,  icon: '🎉' },
  { id: 'cowboy',  slot: 'hat',     name: 'Cowboy Hat',    price: 900,  icon: '🤠' },
  { id: 'tophat',  slot: 'hat',     name: 'Top Hat',       price: 1200, icon: '🎩' },
  { id: 'helmet',  slot: 'hat',     name: 'Soldier Helmet',price: 1500, icon: '🪖' },
  { id: 'wizard',  slot: 'hat',     name: 'Wizard Hat',    price: 2400, icon: '🧙' },
  { id: 'crown',   slot: 'hat',     name: 'Royal Crown',   price: 5000, icon: '👑' },
  { id: 'halo',    slot: 'hat',     name: 'Golden Halo',   price: 9000, icon: '😇' },
  { id: 'round',   slot: 'glasses', name: 'Round Glasses', price: 250,  icon: '👓' },
  { id: 'shades',  slot: 'glasses', name: 'Sunglasses',    price: 600,  icon: '🕶️' },
  { id: 'monocle', slot: 'glasses', name: 'Monocle',       price: 1000, icon: '🧐' },
  { id: 'visor',   slot: 'glasses', name: 'Cyber Visor',   price: 3500, icon: '🥽' }
];
export const COSMETIC_BY_ID = Object.fromEntries(COSMETICS.map(c => [c.id, c]));

/** Wearable cosmetics. Meshes are built procedurally in characters/cosmetics.js. */
export const COSMETICS = [
  { id: 'cap',     slot: 'hat',     name: 'Gorra',  price: 200,  icon: '🧢' },
  { id: 'party',   slot: 'hat',     name: 'Gorro de fiesta',     price: 300,  icon: '🎉' },
  { id: 'cowboy',  slot: 'hat',     name: 'Sombrero vaquero',    price: 900,  icon: '🤠' },
  { id: 'tophat',  slot: 'hat',     name: 'Sombrero de copa',       price: 1200, icon: '🎩' },
  { id: 'helmet',  slot: 'hat',     name: 'Casco',price: 1500, icon: '🪖' },
  { id: 'wizard',  slot: 'hat',     name: 'Gorro de mago',    price: 2400, icon: '🧙' },
  { id: 'crown',   slot: 'hat',     name: 'Corona real',   price: 5000, icon: '👑' },
  { id: 'halo',    slot: 'hat',     name: 'Aureola dorada',   price: 9000, icon: '😇' },
  { id: 'round',   slot: 'glasses', name: 'Gafas redondas', price: 250,  icon: '👓' },
  { id: 'shades',  slot: 'glasses', name: 'Gafas de sol',    price: 600,  icon: '🕶️' },
  { id: 'monocle', slot: 'glasses', name: 'Monóculo',       price: 1000, icon: '🧐' },
  { id: 'visor',   slot: 'glasses', name: 'Visor ciber',   price: 3500, icon: '🥽' }
];
export const COSMETIC_BY_ID = Object.fromEntries(COSMETICS.map(c => [c.id, c]));

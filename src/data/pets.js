/** Companion Countryballs. `type` = which multiplier they boost, `bonus` = fraction (0.1 = +10%). */
const P = (id, name, rarity, type, bonus) => ({ id, name, flag: id, rarity, type, bonus });
export const PETS = [
  P('pl', 'Mini Polandball', 'common', 'coins', 0.05), P('cl', 'Mini Chileball', 'common', 'xp', 0.05),
  P('ar', 'Mini Argentinaball', 'common', 'magnet', 0.1), P('br', 'Mini Brazilball', 'common', 'attack', 0.05),
  P('ca', 'Mini Canadaball', 'common', 'luck', 0.05),
  P('de', 'Mini Germanyball', 'rare', 'attack', 0.12), P('fr', 'Mini Franceball', 'rare', 'xp', 0.12),
  P('jp', 'Mini Japanball', 'rare', 'coins', 0.12), P('it', 'Mini Italyball', 'rare', 'luck', 0.12),
  P('us', 'Mini USAball', 'epic', 'coins', 0.25), P('cn', 'Mini Chinaball', 'epic', 'xp', 0.25),
  P('gb', 'Mini UKball', 'epic', 'magnet', 0.4),
  P('su', 'Mini Sovietball', 'legendary', 'attack', 0.5), P('rome', 'Mini Roman Ball', 'legendary', 'coins', 0.5),
  P('mongol', 'Mini Mongolball', 'legendary', 'xp', 0.5),
  P('eu', 'Mini EUball', 'mythical', 'coins', 1.0), P('galaxy', 'Mini Cosmicball', 'mythical', 'xp', 1.0),
  P('gold', 'Mini Goldball', 'secret', 'coins', 2.0)
];
export const PET_BY_ID = Object.fromEntries(PETS.map(p => [p.id, p]));
export const EGGS = [
  { id: 'basic', name: 'Huevo básico',  price: 400,  cur: 'coins', odds: { common: 80, rare: 19, epic: 1 } },
  { id: 'rare',  name: 'Huevo raro',   price: 4000, cur: 'coins', odds: { common: 30, rare: 50, epic: 18, legendary: 2 } },
  { id: 'mythic',name: 'Huevo mítico', price: 25,   cur: 'gems',  odds: { rare: 30, epic: 45, legendary: 20, mythical: 4.5, secret: 0.5 } }
];
export const petTypeLabel = { coins: 'Monedas', xp: 'XP', attack: 'Fuerza', magnet: 'Imán', luck: 'Suerte' };

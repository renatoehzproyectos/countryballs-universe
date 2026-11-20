/** Rarity table shared by Countryballs, pets and UI colouring. `power` scales bonuses. */
export const RARITY = {
  common:    { label: 'Common',    color: '#9aa8bd', power: 1.0, weight: 60 },
  rare:      { label: 'Rare',      color: '#4aa3ff', power: 1.4, weight: 25 },
  epic:      { label: 'Epic',      color: '#b362ff', power: 1.9, weight: 10 },
  legendary: { label: 'Legendary', color: '#ffb02e', power: 2.6, weight: 3.5 },
  mythical:  { label: 'Mythical',  color: '#ff4d8d', power: 3.5, weight: 1.2 },
  secret:    { label: 'Secret',    color: '#19f5d0', power: 5.0, weight: 0.3 }
};
export const RARITY_ORDER = Object.keys(RARITY);

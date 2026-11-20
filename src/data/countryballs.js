import { RARITY } from './rarity.js';

/**
 * The Countryball roster. `flag` is either an ISO code (public/flags/xx.svg)
 * or a procedural flag key (see characters/flags.js).
 * `level` = Evolution level that unlocks it for free; `price` = instant purchase in the shop.
 * `secret` entries are hidden until a special condition is met (see SECRET_RULES).
 */
const tier = (rarity, rows) => rows.map(([id, name, level, flag]) => ({
  id, name, flag: flag ?? id, rarity, level, price: Math.round(level ** 1.8 * 30 / 10) * 10
}));

export const BALLS = [
  ...tier('common', [
    ['pl', 'Polandball', 1], ['cl', 'Chileball', 3], ['ar', 'Argentinaball', 5], ['br', 'Brazilball', 7],
    ['mx', 'Mexicoball', 9], ['co', 'Colombiaball', 10], ['pe', 'Peruball', 11], ['ca', 'Canadaball', 12],
    ['au', 'Australiaball', 13], ['nl', 'Netherlandsball', 14], ['be', 'Belgiumball', 15], ['pt', 'Portugalball', 16],
    ['es', 'Spainball', 17], ['se', 'Swedenball', 18], ['no', 'Norwayball', 19], ['fi', 'Finlandball', 20],
    ['dk', 'Denmarkball', 21], ['ch', 'Switzerlandball', 22], ['at', 'Austriaball', 23], ['cz', 'Czechiaball', 24]
  ]),
  ...tier('rare', [
    ['de', 'Germanyball', 26], ['fr', 'Franceball', 28], ['us', 'USAball', 30], ['it', 'Italyball', 32],
    ['jp', 'Japanball', 34], ['kr', 'South Koreaball', 36], ['in', 'Indiaball', 38], ['cn', 'Chinaball', 40],
    ['tr', 'Turkeyball', 42], ['eg', 'Egyptball', 44]
  ]),
  ...tier('epic', [
    ['gb', 'UKball', 46], ['ru', 'Russiaball', 48], ['za', 'South Africaball', 50], ['ng', 'Nigeriaball', 52],
    ['sa', 'Saudi Arabiaball', 54], ['ua', 'Ukraineball', 56], ['gr', 'Greeceball', 58], ['ie', 'Irelandball', 60]
  ]),
  ...tier('legendary', [
    ['su', 'Sovietball', 62], ['rome', 'Roman Empireball', 66], ['british', 'British Empireball', 70],
    ['mongol', 'Mongol Empireball', 74], ['aztec', 'Aztec Empireball', 78], ['mali_empire', 'Mali Empireball', 82]
  ]),
  ...tier('mythical', [
    ['eu', 'EUball', 86], ['aq', 'Antarcticaball', 90], ['atlantis', 'Atlantisball', 94], ['galaxy', 'Cosmicball', 98]
  ]),
  ...['gold', 'rainbow', 'void', 'pirate'].map((id, i) => ({
    id, flag: id, rarity: 'secret', secret: true, level: 999, price: 0,
    name: ['Golden Ball', 'Rainbowball', 'Voidball', 'Pirateball'][i]
  }))
];

/** Hidden unlock rules; receive the full save state. `hint` shows in the collection book once the ball is discovered. */
export const SECRET_RULES = {
  gold:    { hint: 'Rebirth once.',                      test: s => s.stats.rebirths >= 1 },
  rainbow: { hint: 'Reach a 25 streak in Guess the Flag.', test: s => s.stats.bestStreak >= 25 },
  void:    { hint: 'Rebirth three times.',               test: s => s.stats.rebirths >= 3 },
  pirate:  { hint: 'Defeat 5 bosses.',                   test: s => s.stats.bossesDefeated >= 5 }
};

export const BALL_BY_ID = Object.fromEntries(BALLS.map(b => [b.id, b]));
export const ballPower = id => RARITY[BALL_BY_ID[id]?.rarity ?? 'common'].power;

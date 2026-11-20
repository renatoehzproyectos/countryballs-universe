/**
 * Historical empires. They are unlocked in Guess the Flag and playable in World Conquest.
 * `regions` = ISO codes of the map regions that start under the empire's control.
 * Modifiers keep them powerful but balanced (each has a strength AND a weakness).
 */
export const EMPIRES = {
  rome: { id: 'rome', name: 'Roman Empire', flag: 'rome', color: '#b3202a', capital: 'IT',
    blurb: 'Disciplined legions and roads, but hostile barbarian borders.',
    mods: { income: 1.0, troops: 1.35, equipment: 1.0, hostile: ['DE', 'PL', 'RU', 'UA'] },
    regions: ['IT', 'FR', 'ES', 'PT', 'GB', 'GR', 'TR', 'EG', 'LY', 'TN', 'DZ', 'MA', 'BG', 'RO', 'AL', 'HR', 'RS', 'BA', 'ME', 'MK', 'SI', 'CH', 'AT', 'BE', 'LU', 'SY', 'LB', 'IL', 'JO', 'CY', 'HU'],
    reward: { quiz: 'Europe' } },
  british: { id: 'british', name: 'British Empire', flag: 'british', color: '#c8102e', capital: 'GB',
    blurb: 'Wealthy world-spanning colonies, but spread thin across the oceans.',
    mods: { income: 1.3, troops: 0.8, equipment: 1.2, hostile: [] },
    regions: ['GB', 'IE', 'CA', 'AU', 'NZ', 'IN', 'PK', 'BD', 'LK', 'MM', 'MY', 'ZA', 'NG', 'GH', 'KE', 'UG', 'TZ', 'ZM', 'ZW', 'SD', 'EG', 'IQ', 'JO', 'YE', 'GY', 'BZ', 'JM', 'SL'],
    reward: { quiz: 'All' } },
  mongol: { id: 'mongol', name: 'Mongol Empire', flag: 'mongol', color: '#2a6fd6', capital: 'MN',
    blurb: 'Unstoppable horde — huge armies but a weak economy.',
    mods: { income: 0.7, troops: 1.7, equipment: 0.8, hostile: [] },
    regions: ['MN', 'CN', 'KZ', 'KG', 'UZ', 'TM', 'TJ', 'AF', 'IR', 'IQ', 'RU', 'UA', 'BY', 'KR', 'KP', 'AZ', 'GE', 'AM', 'TR', 'PL', 'HU'],
    reward: { quiz: 'Asia' } },
  aztec: { id: 'aztec', name: 'Aztec Empire', flag: 'aztec', color: '#16a085', capital: 'MX',
    blurb: 'Vast population and zeal, but obsidian-age equipment.',
    mods: { income: 0.9, troops: 1.3, equipment: 0.5, hostile: ['US', 'CO'] },
    regions: ['MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'DO', 'HT', 'JM', 'CO', 'EC'],
    reward: { quiz: 'Americas' } },
  mali_empire: { id: 'mali_empire', name: 'Mali Empire', flag: 'mali_empire', color: '#e8b923', capital: 'ML',
    blurb: 'Fabulous gold wealth, but few soldiers.',
    mods: { income: 1.7, troops: 0.7, equipment: 0.9, hostile: [] },
    regions: ['ML', 'SN', 'GM', 'GN', 'MR', 'BF', 'NE', 'NG', 'CI', 'GH', 'SL', 'LR', 'TD', 'DZ', 'BJ', 'TG'],
    reward: { quiz: 'Africa' } }
};
export const EMPIRE_REQ = {
  rome: 'Master Europe in Guess the Flag', mongol: 'Master Asia in Guess the Flag', aztec: 'Master North & South America in Guess the Flag',
  mali_empire: 'Master Africa in Guess the Flag', british: 'Master EVERY continent in Guess the Flag'
};

/** Static design data for World Conquest (real-time strategy mode, inspired by "Take Over The World!"). */
export const START_YEAR = 1945;
export const DAY_SECS = 0.5;                 // real seconds per game day at 1x
export const SPEEDS = [0, 1, 2, 4];
export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function dateOf(t) {
  let y = START_YEAR + Math.floor(t / 365), d = t % 365, m = 0;
  while (d >= MD[m]) { d -= MD[m]; m++; }
  return { year: y, month: m, day: d + 1, text: `${d + 1} ${MONTHS[m]} ${y}` };
}

export const LANDLOCKED = new Set('AF AM AT AZ BY BT BO BW BF BI CF TD CZ SZ ET HU XK LA LS LU MW ML MD MN NP NE MK PY RW SK SS CH TJ TM UG UZ ZM ZW RS KZ KG'.split(' '));

export const STRUCTS = {
  city:    { name: 'Ciudad', icon: '🏙', cost: 80, max: 10, desc: 'Genera ingresos y población (más tropas posibles).' },
  factory: { name: 'Fábrica', icon: '🏭', cost: 120, max: 8, desc: 'Produce recursos industriales y puntos de investigación.' },
  port:    { name: 'Puerto', icon: '⚓', cost: 150, max: 1, desc: 'Permite construir barcos e invadir por mar.', coastal: true },
  base:    { name: 'Base militar', icon: '🎖', cost: 200, max: 3, desc: 'Defiende la zona, aumenta el ejército máximo y lanza bombas y misiles.' },
  space:   { name: 'Base espacial', icon: '🛰', cost: 600, max: 1, desc: 'Necesaria para la carrera espacial.', tech: 'space1' }
};
export const structCost = (kind, have) => Math.round(STRUCTS[kind].cost * (1 + 0.3 * have));

export const TECHS = {
  ind1:  { name: 'Industria I', icon: '🏭', cost: 60, req: [], desc: '+25 % de producción y +8 % de dinero.' },
  ind2:  { name: 'Industria II', icon: '🏭', cost: 170, req: ['ind1'], desc: '+25 % de producción y +8 % de dinero.' },
  ind3:  { name: 'Industria III', icon: '🏭', cost: 340, req: ['ind2'], desc: '+25 % de producción y +8 % de dinero.' },
  mil1:  { name: 'Ejército I', icon: '🪖', cost: 70, req: [], desc: 'Tus soldados luchan un 15 % mejor.' },
  mil2:  { name: 'Ejército II', icon: '🪖', cost: 190, req: ['mil1'], desc: 'Otro +15 % de fuerza.' },
  mil3:  { name: 'Ejército III', icon: '🪖', cost: 380, req: ['mil2'], desc: 'Otro +15 % de fuerza.' },
  navy1: { name: 'Marina I', icon: '🚢', cost: 90, req: [], desc: 'Barcos más fuertes y alcance naval 160.' },
  navy2: { name: 'Marina II', icon: '🚢', cost: 230, req: ['navy1'], desc: 'Alcance naval 240 e invasiones más eficaces.' },
  air:   { name: 'Aviación', icon: '✈️', cost: 150, req: ['mil1'], desc: 'Desbloquea las bombas aéreas.' },
  rocket:{ name: 'Cohetería', icon: '🚀', cost: 210, req: ['ind1'], desc: 'Desbloquea los misiles.' },
  nuclear:{ name: 'Física nuclear', icon: '☢️', cost: 520, req: ['rocket', 'ind2'], desc: 'Desbloquea la bomba atómica.' },
  space1:{ name: 'Tecnología espacial I', icon: '🛰', cost: 320, req: ['rocket'], desc: 'Permite la base espacial y empieza el programa espacial.' },
  space2:{ name: 'Tecnología espacial II', icon: '🛰', cost: 480, req: ['space1', 'ind2'], desc: 'Permite construir una base lunar.' },
  space3:{ name: 'Tecnología espacial III', icon: '🛰', cost: 640, req: ['space2'], desc: 'Permite plantar la bandera en la Luna.' }
};

export const WEAPONS = {
  missile: { name: 'Misil', icon: '🚀', tech: 'rocket', m: 40, i: 25, range: 200, radius: 0, power: 1, speed: 35, from: 'base', desc: 'Alcance medio. Daña ejército y edificios de una zona.' },
  bomb:    { name: 'Bomba aérea', icon: '💣', tech: 'air', m: 70, i: 45, range: 110, radius: 22, power: 2, speed: 25, from: 'base', desc: 'Alcance corto, muy potente y con radio de impacto.' },
  nuke:    { name: 'Bomba atómica', icon: '☢️', tech: 'nuclear', m: 420, i: 300, range: 520, radius: 40, power: 6, speed: 45, from: 'any', desc: 'Alcance enorme y devastación total. Todos te odiarán.' }
};

export const SPACE = [
  { id: 'tech',   name: 'Desarrollar tecnología espacial', icon: '🔬', tech: 'space1', auto: true },
  { id: 'base',   name: 'Construir una base espacial', icon: '🛰', struct: 'space' },
  { id: 'rocket', name: 'Fabricar un cohete', icon: '🚀', m: 250, i: 350, days: 20 },
  { id: 'launch', name: 'Lanzar la misión espacial', icon: '🔥', m: 200, i: 0, days: 8 },
  { id: 'transit',name: 'Viajar a la Luna', icon: '🌑', auto: true, days: 25 },
  { id: 'lunar',  name: 'Establecer una base lunar', icon: '🏗', tech: 'space2', m: 500, i: 200, days: 25 },
  { id: 'flag',   name: 'Plantar la bandera del país', icon: '🚩', tech: 'space3', m: 100, i: 0, days: 10 }
];

/** National superpowers: unlocked by paying, passive bonus + one active ability. */
export const SUPERPOWERS = {
  US: { name: 'Poder económico y militar', icon: '🦅', cost: 2500, tech: 'ind2', passive: { income: 1.25, troops: 1.15 }, passiveText: '+25 % dinero, +15 % ejército',
        act: { name: 'Ayuda de guerra', text: '+600 🪙, +120 🏭 y +30k soldados', cd: 120 } },
  CN: { name: 'Producción industrial', icon: '🐉', cost: 2500, tech: 'ind2', passive: { ind: 1.6, troops: 1.1 }, passiveText: '+60 % producción industrial, +10 % ejército',
        act: { name: 'Gran salto industrial', text: 'Producción ×2 durante 60 días', cd: 150, days: 60 } },
  RU: { name: 'Capacidad militar', icon: '🐻', cost: 2500, tech: 'mil2', passive: { troops: 1.3, def: 1.2 }, passiveText: '+30 % ejército, +20 % defensa',
        act: { name: 'Movilización general', text: '+40k soldados gratis', cd: 120 } },
  GB: { name: 'Poder naval', icon: '👑', cost: 2500, tech: 'navy1', passive: { ships: 0.6, income: 1.1, range: 60 }, passiveText: 'Barcos −40 % de coste, +60 de alcance naval, +10 % dinero',
        act: { name: 'Flota de la Reina', text: '+8 barcos al instante', cd: 120 } }
};

export const PACTS = {
  embassy:  { name: 'Relaciones diplomáticas', icon: '🏛', desc: 'Abre embajadas. Necesario para pactar.', thr: -25 },
  coop:     { name: 'Cooperación científica', icon: '🔬', desc: 'Los dos investigan un 12 % más rápido.', thr: 0 },
  trade:    { name: 'Acuerdo comercial', icon: '💱', desc: 'Los dos ganan un 6 % más de dinero.', thr: 5 },
  alliance: { name: 'Alianza', icon: '🤝', desc: 'No os podéis atacar y os defendéis en las guerras.', thr: 25 }
};

# 🌍 Countryballs Universe

One 3D browser universe, three interconnected games, one persistent profile.
Vanilla **ES Modules + Three.js + Vite**. No backend, no external requests at runtime — deploys to Vercel as a static site.

## Deploy
```bash
npm install
npm run dev        # local dev
npm run build      # outputs ./dist
```
**Vercel:** push to GitHub → *Add New Project* → import. Framework preset *Vite* is auto-detected (`vercel.json` included).

## The games
| Game | What it is |
|---|---|
| **3D Hub** | You start in a 3D plaza with your Countryball. Walk/drag-rotate, tap the glowing **GAMES portal** (or ▶ PLAY), Shop, Locker, Collection book, Profile. |
| **Evolution** | Real-time 3D arena. Auto-combat, coins/XP, chests, relics, NPC quests, 7 worlds, bosses with telegraphed slams, pets, rarities, collection, **Rebirth** multipliers. Levelling *evolves* you into new Countryballs. |
| **World Conquest** | Interactive world map (174 territories). Cities → income, factories → equipment, armies → upkeep. Alliances (defensive / military), trade (+ equipment market), non-aggression pacts, vassals & puppets, war, battles, peace deals, reputation & betrayal, personality-driven AI, historical empires. Autosaved campaign. |
| **Guess the Flag** | Classic, Time Attack, Continents, Expert (lookalikes), Map Challenge, Daily Challenge. Mistakes are re-queued. Mastering 80 % of a continent **permanently unlocks an empire** for Conquest. |

Empire rewards: Europe → Roman · Asia → Mongol · N+S America → Aztec · Africa → Mali · every continent → British.

## Architecture
```
src/
  main.js                 entry: load profile → boot 3D hub
  core/                   shared services (no game logic)
    manager.js            lazy-loads games, one active app at a time
    engine.js             single WebGL renderer + RAF loop (paused for DOM games)
    store.js              save system (localStorage, versioned, deep-merged defaults)
    economy.js            coins/gems/XP, multipliers, achievements, secrets, unlocks
    pets.js  audio.js  input.js  events.js
  data/                   pure data: countryballs, pets, cosmetics, worlds, empires, rarity, geo
  characters/             Countryball (your Blender GLB) · LiteBall · cosmetics · flag provider
  hub/hub.js              main 3D world
  ui/                     dom helpers, panels (shop/locker/book/profile), joystick, SVG map view
  games/
    evolution/            world.js (scenery) + evolution.js (gameplay)
    conquest/             sim.js (pure logic: economy, diplomacy, war, AI) + conquest.js (UI)
    flagquiz/             questions.js (generation, mastery) + flagquiz.js (modes, UI)
scripts/generate-geo.mjs  builds map + country metadata from world-atlas / world-countries
public/flags/             your flag SVG pack      public/models/  your GLB template
```
Module boundaries: `data/` and `games/conquest/sim.js` are DOM-free; games only talk to each other through `store`, `economy` and the `bus`.

## Assets used
- Your **countryball_blender.glb**: body gets a generated flag texture + the normal map extracted from the GLB; eyes are kept. `3d_antarcita_countryball_model.glb` is kept in `public/models/` as the visual reference.
- Your **country-flags** SVGs (all 255) in `public/flags/`.
- Historical/fantasy flags (Rome, USSR, Mongol, Aztec, Cosmic, Gold…) are drawn procedurally; audio is synthesised.

## Performance
Mobile pixel-ratio cap, instanced scenery, ~300-tri LiteBalls for crowds/pets, each game in its own lazy chunk, inactive scenes disposed, Three.js in a separately cached chunk.

## Saves
`localStorage` key `countryballs-universe:v1`. Profile → *Erase save* resets it.

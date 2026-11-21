# Countryballs Universe

Un universo 3D de Countryballs con tres juegos que comparten un mismo perfil:

- 🌍 **Evolución** — explora mundos, vence jefes, colecciona mascotas y evoluciona.
- 🗺️ **Conquista Mundial** — haz amigos, comercia y conquista el mapa del mundo.
- 🚩 **Adivina la bandera** — gana imperios acertando banderas.

## Cómo abrirlo

Necesitas [Node.js](https://nodejs.org) 18 o más nuevo.

```bash
npm install
npm run dev
```

Abre la dirección que aparece en la terminal (por defecto `http://localhost:5173`).

Para generar la versión final lista para subir a un hosting:

```bash
npm run build
npm run preview
```

## Estructura

```
countryballs-universe/
├─ index.html          pantalla que carga el juego
├─ vite.config.js      configuración de Vite
├─ public/
│  ├─ flags/           banderas en SVG
│  └─ models/          modelos 3D del countryball
└─ src/
   ├─ main.js          punto de entrada
   ├─ core/            perfil, guardado, audio, motor, economía
   ├─ data/            countryballs, mundos, emporios, mascotas, geo
   ├─ characters/      modelo 3D, banderas, cosméticos
   ├─ hub/             mundo central y su interfaz
   ├─ ui/              botones, ventanas, joystick, mapa
   └─ games/           evolución, conquista y adivina la bandera
```

El progreso se guarda en el propio navegador, así que no hace falta ninguna cuenta ni servidor.

## 🗺️ Conquista Mundial (tiempo real)

Rehecha siguiendo el análisis de *Take Over The World!*:

- **Tiempo continuo** con ⏸ / 1× / 2× / 4× y calendario (empieza en 1945). No hay botón «siguiente mes».
- **Mapa político**: elige país (nombre, bandera, territorio → confirmar). Cada zona tiene propietario y color; las fronteras se actualizan.
- **Expansión** hacia tierras sin dueño (por frontera o por puerto) y **conquista militar** por separado.
- **Economía**: ciudades (dinero y gente), fábricas (industria e investigación), puertos, bases militares y bases espaciales.
- **Guerra**: tropas marchando por el mapa, invasiones marítimas con barcos, misiles, bombas y bomba atómica.
- **Diplomacia**: ALIANZA (relaciones, cooperación, comercio, alianza, protección) y GUERRA; paz con condiciones (territorios, reparaciones, estado títere).
- **Imperios históricos** que renacen al controlar el 70 % de su territorio, **superpoderes** (EE. UU., China, Rusia, Reino Unido) y **carrera espacial** de 7 fases hasta plantar la bandera en la Luna.
- **Bots** en todos los demás países (expanden, construyen, investigan, pactan, atacan, piden paz y compiten por la Luna).
- Victoria: dominar el 60 % del mundo (con títeres) o plantar la bandera en la Luna.

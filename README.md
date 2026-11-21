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

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


## Actualización: Countryballs e imperios

- Se conserva la bandera completa en la textura frontal de los Countryballs; ya no se recortan cantones ni estrellas. Chile tiene una bandera dibujada explícitamente con su estrella blanca.
- Se añadieron 29 imperios y estados históricos para Conquista Mundial.
- Cada imperio tiene su Countryball y se desbloquea en Countryballs Evolution al alcanzar el nivel indicado; al desbloquearlo queda disponible como nación inicial en Conquista Mundial.


## Corrección global de banderas en Countryballs

Todas las banderas ahora conservan la proporción de su archivo original al proyectarse sobre la cara frontal de la esfera. Se elimina el estiramiento cuadrado que deformaba cruces, estrellas, franjas, escudos y cantones. Los espacios de adaptación se rellenan extendiendo los píxeles del borde de la propia bandera, evitando recortes y evitando dejar zonas transparentes. Se aplica automáticamente a banderas ISO, banderas históricas personalizadas y Countryballs desbloqueables.


## 🌐 Multijugador por código

- En el mundo central, pulsa **🌐 Multijugador**.
- El anfitrión crea una sala y comparte el código numérico de 4 dígitos.
- Los visitantes escriben ese código y pulsan **Unirse a sala**.
- Hasta 8 visitantes pueden conectarse; sus Countryballs se ven en tiempo real en el hub y en el mismo mundo de Evolución.
- La conexión usa WebRTC mediante PeerJS y requiere Internet. No necesita configurar un servidor propio.
- Los perfiles y recompensas se guardan localmente en cada dispositivo. Conquista Mundial y Adivina la Bandera todavía no comparten una partida sincronizada en esta versión.
- Ejecuta `npm install` para instalar PeerJS y despliega el proyecto normalmente en Vercel/HTTPS.

## Corrección de conexión de salas multijugador

- Host y visitante usan explícitamente el mismo servidor público de señalización PeerJS (`0.peerjs.com`, HTTPS/WSS por 443).
- El anfitrión registra las conexiones entrantes antes de anunciar que la sala está lista.
- Se añadió confirmación de sala (`room-accepted`) y rechazo explícito si está llena.
- El visitante escucha la confirmación antes de que el canal abra para evitar perder un mensaje rápido.
- Los errores ahora distinguen entre servidor no disponible, anfitrión no encontrado, sala cerrada y sala llena.
- La conexión requiere Internet y puede verse afectada si la red bloquea WebSocket/WebRTC; esta app estática no puede garantizar conexiones en redes restrictivas sin un servidor de señalización propio.


## Multijugador: compatibilidad de salas basada en RocketPrismas

Se reemplazó el esquema anterior de IDs largos por el patrón de salas que utiliza RocketPrismas:
- Mismo servidor público de señalización PeerJS (`0.peerjs.com:443`, HTTPS).
- IDs de sala deterministas derivados del código (`cb` + cuatro dígitos).
- Configuración ICE STUN/TURN de respaldo de RocketPrismas.
- El anfitrión reserva el ID y solo publica el código después del evento `open` del servidor.
- El visitante abre su propio Peer y conecta al ID derivado del mismo código.
- Confirmación `room-accepted` / `room-rejected` y espera explícita del canal de datos.
- Hasta 8 visitantes por anfitrión.

La presencia y sincronización de avatares continúa limitada al hub y al modo Evolución, tal como en la versión anterior.


## Corrección de Countryballs (texturas de banderas)

- Se unificó la proyección de banderas mediante UV esféricas equirectangulares.
- El personaje principal (`Countryball`) y las esferas ligeras (`LiteBall`) ahora centran la bandera hacia el frente y la envuelven alrededor de toda la esfera.
- Se aplica al hub, NPC, mascotas, evoluciones y jugadores remotos.
- Se conservan las banderas SVG existentes y las banderas históricas/procedurales.

## Conquista multijugador
1. El anfitrión crea una sala en 🌐 Multijugador (hub o menú ☰ de Conquista) y empieza/continúa una partida.
2. Los invitados se unen con el código de 4 dígitos; al empezar Conquista les aparece "¿Te unes?".
3. Cada invitado elige un país libre (sustituye a su IA). Si lo eliminan, puede elegir otro; si se desconecta, vuelve a la IA.
4. El anfitrión simula todo (`sim.js`); los invitados reciben deltas (`netsync.js`) y mandan órdenes (`cq:cmd`). Las propuestas entre jugadores van al buzón 🔔 del otro jugador.

# Plan: Paisaje de Marte de película (Vite + Three.js)

## Lo que pediste
1. Crear un proyecto con **Vite + Three.js** y **prender el servidor apenas se pueda**, para verlo en vivo en el navegador de Cursor.
2. Un **paisaje de Marte que se vea de película**:
   - dunas
   - rocas
   - cielo color caramelo con polvo
   - sol de tarde con luz cálida y sombras suaves
   - las dos lunas de Marte (Fobos y Deimos)
3. **Que se vea algo en menos de 2 minutos** después de aprobar el plan, y después mejorarlo.
4. Crear **`npm run check`**: abre la página en un Chrome invisible (Playwright con tu Chrome, sin descargar navegadores), guarda una captura y lista los errores de consola.
5. **Correr el check tras cada mejora grande**, mirar la captura y corregir. **Máximo 3 rondas.**
6. **Listo** cuando no haya errores y la captura muestre todo lo pedido.

## Cómo lo voy a hacer

### Paso 1 — Proyecto y servidor (minuto 0–1)
- Ya está instalado: Node, Vite, Three.js y playwright-core (no hay que esperar instalaciones).
- Creo `index.html` y `src/main.js` y prendo `npm run dev` → te aviso la URL **http://localhost:5173** para abrirla en Cursor.

### Paso 2 — Primera vista (antes de 2 minutos)
Una escena sencilla pero ya marciana: suelo rojizo ondulado, cielo caramelo, niebla de polvo y luz cálida baja de tarde. Vite recarga solo, así que lo ves aparecer.

### Paso 3 — `npm run check`
`scripts/check.mjs`: abre la página en tu Chrome en modo invisible, espera unos segundos, guarda `screenshots/check.png` y lista los errores de consola (con la URL si es un archivo que falta). Si hay errores, termina en fallo.

### Paso 4 — Mejora grande: el paisaje de película
| Pedido | Cómo se logra |
|---|---|
| Dunas | Terreno con relieve de ruido y crestas de duna, color óxido/ocre según altura |
| Rocas | Rocas irregulares repartidas sobre el suelo, con sombra |
| Cielo caramelo con polvo | Cielo degradado caramelo → marrón en el horizonte + niebla + partículas de polvo flotando |
| Sol de tarde, luz cálida, sombras suaves | Sol bajo con disco brillante, luz anaranjada y sombras largas y difuminadas |
| Las dos lunas | Fobos (más grande) y Deimos, pequeñas e irregulares, moviéndose despacio en el cielo |
| De película | Cámara baja con giro lento, tono cinematográfico |

### Paso 5 — Revisión (máximo 3 rondas)
Ronda = `npm run check` → miro la captura y los errores → corrijo.
Me detengo cuando: **0 errores** y la captura muestra **dunas, rocas, cielo caramelo con polvo, sol cálido con sombras suaves y las dos lunas**. Te muestro la captura final.

## Archivos
`index.html`, `src/main.js`, `scripts/check.mjs` (y guardo este plan en `plan.md`).

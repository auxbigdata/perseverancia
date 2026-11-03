# Proyecto: Simulación 3D del rover Perseverance

## Descripción

Vamos a construir una **simulación 3D del rover Perseverance** de la NASA, el robot que explora Marte desde 2021 en el cráter Jezero.
El proyecto está pensado para hacerse en **una clase de 60 minutos**, de forma guiada y paso a paso.

**Objetivo:** al final de la clase tener una página web que muestre el rover en 3D sobre un terreno marciano, que se pueda mover con el teclado y explorar con la cámara.

## Stack tecnológico

- **HTML + JavaScript** (sin instalaciones complicadas)
- **Three.js** (librería 3D para el navegador, cargada desde CDN)
- Se abre directamente en el navegador (`index.html`), o con un servidor local simple si hace falta

## Plan de la clase (60 min)

| Tiempo | Bloque | Qué se hace |
|--------|--------|-------------|
| 0–5 min | Introducción | Qué es Perseverance, sus partes (cuerpo, 6 ruedas, mástil con cámaras, brazo robótico, helicóptero Ingenuity) |
| 5–15 min | Escena base | Crear `index.html`, cargar Three.js, escena + cámara + luz + render |
| 15–25 min | Terreno marciano | Suelo rojizo con relieve, rocas, cielo color marciano, niebla |
| 25–40 min | Construir el rover | Modelar con figuras básicas: cuerpo, 6 ruedas, suspensión, mástil, cámara, brazo, panel/RTG |
| 40–50 min | Movimiento | Controles con teclado (W/A/S/D o flechas), ruedas que giran, cámara que sigue al rover |
| 50–57 min | Extras | Polvo, brazo animado, mini Ingenuity volando, HUD con datos (posición, sol marciano) |
| 57–60 min | Cierre | Repaso de lo aprendido y próximos pasos |

## Convenciones del proyecto

- Idioma de comentarios y textos: **español**
- Código simple y bien comentado, pensado para enseñar
- Todo en pocos archivos (`index.html`, `main.js`) para que sea fácil de seguir en clase
- Construir por pasos: cada paso debe funcionar antes de pasar al siguiente

## Registro del proceso — 2026-10-30

> Aquí se va guardando todo lo que hacemos durante la clase de hoy.

- [x] Creado el `CLAUDE.md` con la descripción del proyecto y el plan de la clase
- [ ] Escena base con Three.js
- [ ] Terreno marciano
- [ ] Modelo del rover Perseverance
- [ ] Controles de movimiento y cámara
- [ ] Extras (Ingenuity, polvo, HUD)
- [ ] Repaso final

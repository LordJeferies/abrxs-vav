# Validación de Foundation 0.2 · 2026-10-02

Entorno Linux, Node 24.19.0. No certifica tu Mac, Tauri ni DaVinci.

| Gate | Resultado |
|---|---|
| TypeScript UI + service/core | PASS |
| JSON Schema compile + 4 fixtures | PASS |
| Schemas generados coinciden con validadores runtime | PASS |
| Vitest core/store/jobs | PASS, 9 pruebas |
| Vite production build | PASS |
| Doctor básico | PASS para Node; carpeta nueva aún sin datos |
| npm run dev (servicio + Vite) | PASS, UI y proxy API responden 200 |
| UI Chromium 140 / Playwright 1.55.1 | PASS |
| UI móvil 390px | PASS, sin overflow de página |

## Recorrido real de navegador

Crear proyecto 30000/1001; guardar evento; undo/redo; recargar página; ejecutar
validación estructural; generar TXT; comprobar resultado 1.001–2.002 s para frames
30–60; rechazar escritura con revisión antigua (409); rechazar origen externo y
POST sin header local (403); detener/reiniciar servicio; recuperar proyecto y resultados.
No hubo errores JavaScript de página durante el recorrido.

## Pruebas de recuperación

La suite usa directorios temporales y repositorios de archivos reales. Simula fallo
antes de rename conservando bytes previos; archivo corrupto que no puede sobrescribirse;
editores concurrentes; running recuperado como interrupted; cancelación ante resultado
tardío; retry limitado y queue que sigue procesando después de un handler fallido.
Esto no simula un corte eléctrico real del filesystem ni certifica todos los discos.

## Capturas

Datos sintéticos de QA; no contienen proyectos ni medios reales de clientes.

- screenshots/hub-desktop.png
- screenshots/activity-desktop.png
- screenshots/hub-mobile.png

## Advertencias de build

Rollup omite comentarios PURE no interpretables en Zod. No impiden el build.
Workflow Studio se carga aparte: bundle principal aproximado 339 kB y módulo de
workflow 181 kB (antes de gzip), sin advertencia de chunk mayor a 500 kB.
Playwright queda fijado en 1.55.1 y lockfile para reproducir este gate.

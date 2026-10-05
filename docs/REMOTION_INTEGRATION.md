# ABRXSVAV — REMOTION INTEGRATION (codificada desde los 4 tutoriales de referencia)

> Fuente: los 4 videos de la biblioteca (transcripts leídos 2026-10-05):
> ① Vox explainer (7wuYBfE131U) · ② viral reel (xOhh274Ayac) · ③ curso Remotion
> (f393grXJn9E) · ④ SaaS glassmorphism (b7KlsXNQobs). Cada técnica se mapea a un
> elemento CONCRETO de AbrxsVAV. Remotion = video desde código (frames = capturas del
> DOM); excelente para motion graphics/títulos/gráficas; NO para cortar footage ni
> grading (eso es NLE → Delivery/Coach).

## 1. La voz manda: el transcript ES el timeline (①②③)

- Cada línea del voice-over/transcript = una ESCENA; "each scene starts and ends on its
  own narration". En AbrxsVAV esto es literal: **Canter ya produce transcripción
  word-level** → el Motion Composer agrupa palabras en beats → 1 beat = 1 composición
  con `startFrame/endFrame` exactos del transcript (frames, nunca segundos al compilar).
- Regla ②: 5–6 líneas × ~5 s = reel de 25–30 s. Regla ③: los números de FRAME son la
  moneda al pedir cambios ("del frame 46 al 76…"), nunca segundos.

## 2. Sistema visual bloqueado (①③) = Client Profile + Pack

- Un fondo compartido en TODAS las escenas + mismas fuentes + misma paleta de acento;
  **lo que cambia es midground/foreground**. En la app: `ClientProfile` (tokens) +
  `visual-packs` registry; el sistema visual se congela por proyecto y las capas
  variables son datos, no código nuevo.
- Estructura de carpetas ①: `scenes/scene-01/…` → en la app: cada evento motion del
  grafo referencia su composición (`motionComposition`) — misma idea, versionada.

## 3. Las 3 capas canónicas por escena (①②)

```
z=0  BACKGROUND  compartido/bloqueado (foto, patrón, pared)
z=1  MIDGROUND   cutouts en B&W + halftone (personajes), nubes, humo (screen blend)
z=2  FOREGROUND  estructuras/objetos/titulares + offset drop shadow ("levitar del papel")
```
`CompositionSpec.layers` implementa exactamente esto (z ascendente al compilar).

## 4. Animar con intención: spring + interpolate, nada más (①③)

- Solo dos primitivas: **spring()** para pops y **interpolate()** para rangos —
  entradas escalonadas ("stagger", que no todo se mueva a la vez). En `@abraxas/motion`:
  keyframes deterministas + `ease-in-out` único (canon R6); el **wobble con decaimiento**
  (③: "ease-out + decaying wobble, no cartoonish") entra como preset de easing con
  amortiguación fija — jamás spring pop puro en documental.
- Zoom canon ≤ 1.18 para B-rolls; los pushes de reel (①②: 1→1.6, luego 6.8x frame 76)
  son presets de CHOREOGRAPHY por escena, no por defecto global.

## 5. Tratamientos = presets de datos (registry `treatment-presets`, v0.5.0)

| TREATMENT | RECETA (de los videos) | DÓNDE |
|---|---|---|
| halftone.v1 | B&W + patrón halftone (una línea de código en Remotion) — look revista/papel ①③ | filtro por capa |
| film-treatment.v1 | sandwich de texturas: film grain + grunge wash + scan lines (línea negra 1.6px al 16%) + vignette + corner blur + gate weave ②③ | overlay pack |
| time-boil-12fps | posterize a 12 fps para stutter stop-motion ②③ | opción de composición |
| screen-blend-smoke | humo/partículas en screen blend, levantar grises, crush, feather de bordes ② | filtro por capa |
| glass-panel.v1 | vidrio SaaS ④: frost blur 12–14px · edge light 16–17% · face dark 58% opacity · corners 22px cards/34px panel · slab de grosor 20px/3px | pack xr.glass-ui |
| glass-light.v1 | luz = 2 elipses apiladas (core blanco caliente + wash 2x), screen blend, órbita; blur core ~28px; refracción ~235px; viaje de color verde→teal→violeta; reactividad 55% ④ | pack xr.glass-ui |
| weld-detach | foto+marco soldados como UNA unidad hasta el frame N; el marco sigue, la foto aterriza; crossfade B&W→color + blur burst 0→9px→0 ② | choreography preset |
| floor-shadow | duplicar imagen → proyectar al piso, oscurecer, skew = sombra ② | helper de capa |
| lamp-swing | lámpara con hold keyframes + flicker; highlight de escritorio (sepia/sat/hue) ② | choreography preset |

Agregue un tratamiento = agregar una entrada al registry (dato, jamás código).

## 6. Flujo canónico dentro de la app (del transcript al MP4)

```
Canter (VO word-level) → beats por línea
  → Motion Composer: 1 composición por beat (3 capas, preset de motion/treatment)
  → Studio/Remotion Studio (paso 7): prop controls (scale/x/y) — los valores se GUARDAN
  → ensamblar master: composiciones encadenadas, cada una dura exactamente su línea
  → VO/TTS + SFX (registry) + música → render 1080p MP4 mezclado
     (o solo composición → kit para CapCut/DaVinci, misma verdad del grafo)
```
Regla ②: construir escena por escena y recién entonces fusionar al master — arreglar
una escena no debe romper otra (en la app: eventos aislados + Error Boundaries).

## 7. Desde el editor: motion POR SECCIONES (lo pedido)

En Dresser/Canyon, seleccionas un rango del timeline → "Componer motion para esta
sección" → `POST /api/motion/compose` con `startFrame/endFrame` del rango → crea el
evento `kind:'motion'` con la composición acotada y encola `motion.render` (RenderSpec
Remotion-ready + comandos FFmpeg por capa). Por MCP: `vav_motion_compose` con los
mismos parámetros — el agente pide motion para una sección exacta del video.

## 8. MCP — todo Remotion es operable por agente

`vav_motion_compose` (componer sección), `vav_motion_list` (composiciones del
proyecto), `vav_motion_render` (encolar render de una composición) — y en el paso 7,
Remotion Studio embebido con sus prop controls expuestos también por MCP
(vav_props_set / vav_props_get). La app entera queda como un "MCP de edición de
video" (mismo espíritu que el MCP de DaVinci): el agente puede montar, vestir,
componer motion y exportar.

## 9. Lo que NO hacemos (honesto)

- Nada de cámara 3D real en Remotion: ④ lo confirma — el "movimiento de cámara" es el
  wrapper moviéndose en 3D (divs); la esfera SaaS usa Three.js en pase separado —
  eso es el pack xr.glass-ui del paso 7, no core.
- No reemplaza al NLE: corte/grading/finishing siguen en Canter/Delivery/Coach.

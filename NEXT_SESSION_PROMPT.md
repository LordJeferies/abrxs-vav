# PROMPT MAESTRO — siguiente sesión de desarrollo de AbrxsVAV

> Copia TODO este bloque y pégalo como primer mensaje del chat nuevo.
> Actualizado: 2026-10-05 · repo en `f04b12d` · 32/32 tests · app verificada instalable.

---

Estás continuando el desarrollo de **AbrxsVAV** (Video · Audio · Visual, familia
"Abraxas", de LordJeferies): una app de escritorio para producir contenido de calidad
de cine desde tu Mac. La idea maestra: **una MoneyPrinterTurbo con esteroides y con
control humano** — toma un video largo o un guion, lo corta en piezas, las viste con
imágenes/animaciones/subtítulos de calidad profesional, genera prompts para
cualquier IA de imagen/video, y entrega MP4 finales o kits para CapCut/DaVinci.
Diferencias clave con MoneyPrinter: NO es un generador opaco (la IA propone, el
humano aprueba — HITL), NO reinterpreta tu guion (tu corte manda), es modular por
registries (agregar un tipo nuevo = datos, no código), todo es operable por MCP
(la app entera es un "MCP de edición de video" al estilo del MCP de DaVinci), y
tiene un sistema de Client Profiles para que la marca de cada cliente se respete.

## 1. Estado verificado (todo esto es REAL, probado con E2E)

- Repo: https://github.com/LordJeferies/abrxs-vav · 32/32 tests · check/build verdes.
- **App corriendo**: `git clone` + `./INSTALL_MAC.command` → http://127.0.0.1:4317
  (verificado con instalación fresca). Shell React con 11 estaciones, ⌘K, undo/redo.
- **Core real**: ProjectStore (escrituras atómicas, CAS por revisión, .bak), JobEngine
  (serial, watchdog 15min, recuperación post-crash), 6 registries
  (`/api/registries`: XR 7 · SFX 13 · motion 10 · captions 4 · packs 3 · treatments 9),
  ActionCatalog de 29 acciones (`/api/catalog`), MCP stdio de 28 tools (`mcp/server.mjs`).
- **Client Profiles** (contracts v2.4 + `apps/service/src/clients.ts`): cadena
  System→Client→Project→Video→Event con fuente por valor, tokens $colors.*,
  import TXT con confianza high/medium, AI Package de 8 archivos, import de respuesta
  "ABRXS CLIENT PROFILE v1" con diff antes de aplicar.
- **Prompt Studio** (`packages/prompts`): sujeto INTACTO + capas de cine por
  intensidad 1-3 + HandoffPackage para CUALQUIER IA. Providers: Higgsfield
  (POST→request_id→poll real, falta validar con key), NVIDIA NIM (imágenes), Demo
  (pipeline completo sin claves).
- **Motion Composer** (`packages/motion`): capas con imágenes → keyframes
  deterministas (10 presets canon R6, zoom ≤1.18, ease-in-out) → RenderSpec JSON
  Remotion-ready + comandos FFmpeg zoompan. Rangos del editor soportados.
- **Modo Coach** (`/api/coach/plan`): grafo → plan de montaje paso a paso para
  CapCut/DaVinci. **QA estructural** (`/api/qa/analyze`). **LiquidGlass real** en la
  shell (styles.css, capa UI). Corpus sintético de CI. Sitio PWA:
  https://lordjeferies.github.io/abrxsvavstatus/
- **`apps/service/src/media.ts` ESCRITO PERO SIN WIRE** (10KB): ffprobe, proxy 540p,
  filmstrip, waveform, parseSrt/Vtt/Txt, sliceSrt, keywords, cutPiece (re-encode
  frame-accurate), renderFinal (corte + B-rolls Ken Burns fullscreen zoompan +
  subtitles burn con force_style del cliente). **ESTE ES EL TRABAJO INMEDIATO.**

## 2. Tu primera tarea — wire del pipeline (ver CONTINUITY.txt §F)

1. Handlers: `canter.ingest`, `canter.export_piece`, `dresser.render_piece`
   (patrón igual a `media.generate` en handlers.ts).
2. Rutas sync con CAS: `POST /api/canter/ingest` (probe + evento MASTER con
   extensions.media + job de proxy), `/api/canter/transcript_import`,
   `/api/canter/cut` (piezas con extensions.source {masterEventId,startSec,endSec}),
   `/api/dresser/plan` (reglas: transcript slice + densidad del client profile →
   ghost b_rolls con stockQuery=keywords), `/api/dresser/render`.
3. UI funcional (patrón VisualStudio.tsx): **Canter** (ingest por ruta → filmstrip →
   import transcript → cortar piezas → export con "Reveal in Finder"),
   **Dresser** (plan visual por pieza → render final), **Clients wizard** (form).
4. MCP +4 tools. Tests de parseSrt/keywords/plan. E2E con video sintético:
   `ffmpeg -f lavfi -i testsrc=duration=60:size=1080x1920 -f lavfi -i sine=440
   -shortest master.mp4` → ingest → transcript → cut → export → render → verificar
   MP4 en .abraxas-data/renders/. Commit pequeño por paso, verificar disco siempre.

## 3. Después (en orden) — mapa completo en docs/REQUISITOS_MAESTROS.md

Paso 2: Whisper MLX + adapter Canter 3.8.1 (necesita máster real del usuario) ·
Paso 3: Kanban/Mapa XYFlow · Paso 4: companion PWA iPhone + Supabase (workspace
`abrxs-vav`, tablas vav_state/vav_commands — SQL en docs/CLOUD_AND_PROVIDERS.md) +
Drive readonly-first + comandos precargados offline · Paso 5: Dresser batch 20
verticales + QA de píxeles (necesita keys Pexels/Pixabay del usuario) · Paso 6:
ComfyUI + compare A/B + strict free mode · Paso 7: bundle Remotion + prop controls
por MCP + familias XR completas + variants · Paso 8: kits FCPXML/EDL/CapCut +
reporte de licencias + reference render · Paso 9: Workflow Studio recipes + Review ·
Paso 10: empaquetado Tauri .app + updater + Faceless + i18n.

## 4. REGLAS DE ORO (no negociables)

- Lee PRIMERO: `docs/REQUISITOS_MAESTROS.md` (todos los requisitos con estado),
  `docs/00_ABRSX_VAV_ADDENDUM.md` (gana conflictos), `CONTINUITY.txt`, `AGENTS.md`.
- Tiempo = frames (out exclusivo). Production Graph = única verdad. Todo por MCP
  (ActionCatalog). La IA propone, el humano aprueba. MoneyPrinterTurbo = motor solo
  (⛔ task.py). Prohibido código AGPL/PolyForm. LiquidGlass SOLO capa UI. TYPO y
  renders deterministas jamás a IA. Zoom ≤ 1.18. Escrituras atómicas siempre.
- Verifica en disco tras CADA resultado sospechoso (ha habido resultados de
  herramientas fabricados en sesiones largas; el disco siempre fue coherente).
  Sesiones cortas, commits pequeños con push, actualizar ROADMAP/CHANGELOG/
  CONTINUITY/IMPLEMENTATION_STATUS en cada hito. "npm run check && npm test &&
  npm run build" antes de empezar y antes de cada commit.
- Al terminar cada bloque: mover checkbox en ROADMAP.txt y actualizar la línea
  "SIGUIENTE ACCIÓN" (el sitio status.html lee eso en vivo).

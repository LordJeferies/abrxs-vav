# Cambios

## AbrxsVAV 0.6.0-M3 · 2026-10-05 (AssetStore + Client Profiles consolidados)

- **AssetStore canónico** (contracts v2.6 `abrxs.asset.v1` + `apps/service/src/assets.ts`):
  registro de archivos reales con hash STREAMING, kind por extensión, provenance
  (origin/detail/license), scope projectId/clientId. Registro IDEMPOTENTE por ref+hash
  e **ids sin reciclar** (max+1 — una referencia huérfana jamás apunta al asset nuevo).
  Acciones vav.assets.list/register/delete + MCP ×3.
- **ClientProfile v1.1** (aditivo): voice, audience, logos (refs a assets, jamás
  binarios). Import JSON validado con diff (`vav.clients.import_json` + MCP).
- **Vínculo proyecto→cliente**: `projectContent.clientId` (aditivo) + acción
  `vav.projects.set_client` con CAS por revisión + MCP.
- Paridad MCP **45↔45**. Tests 142 → **152**.

## AbrxsVAV 0.6.0-M2b · 2026-10-05 (M2 cerrado: Canter completo con UI)

- **UI Canter real** (Canter.tsx): viewer de máster por PROXY con streaming
  Range (scrub sin cargar el máster), filmstrip, transcript clicable, creación
  de piezas por TEXTO/ANCLAS con candidates ambiguos, inspector frame-aware,
  export con job, delete con confirmación.
- **Text→Piece hardening**: índice {normalized, originalWordIndex}; fuzzy solo
  ≥4 tokens con decideAlignment (≥0.9 y ventaja ≥0.05 para auto-crear; si no
  AMBIGUOUS/UNRESOLVED con candidates); floor/ceil racionales — el clip no
  corta palabras (tests en 6 timebases).
- **Seguridad de streaming**: /api/media/:id/file — el cliente jamás envía
  paths; id+kind resuelven contra la entidad persistida; Range 206/416
  estricto; traversal imposible; E2E HTTP con servidor real en proceso hijo.
- **Doctor**: whisper.cpp binario PASS / modelo SKIP (sin ggml; no descarga
  automática) y mlx_whisper PASS con modelo cacheado.
- Paridad MCP 40↔40. 102 → **142 tests**. Diarización: PENDING documentado.

## AbrxsVAV 0.6.0-M2a · 2026-10-05 (transcripción local word-level — slice 1)

- **media.transcribe** (job con target `media_source`): transcripción LOCAL real con
  **mlx_whisper** (Apple Silicon; modelo `mlx-community/whisper-large-v3-turbo` ya
  cacheado) — word-level JSON CANÓNICO (`transcript.words.json`) + derivados SRT/TXT.
  whisper.cpp soportado como backend alternativo (`ABRXS_WHISPER_CPP_MODEL`).
- **Cache por hash**: mismo hash del máster + mismo backend/modelo → NO re-ejecuta
  Whisper (verificado por test). Acción `vav.canter.transcribe` + tool MCP (paridad 35↔35).
- `MediaSource.transcriptRef` (delta aditivo en contracts) + `extensions.transcript`
  con idioma/backend/cached.
- Tests: 99 → **102** (voz sintetizada con `say` → transcripción real en el Mac; gated:
  sin backend/modelo, los tests se saltan honestos en CI sin MLX).

## AbrxsVAV 0.6.0 · 2026-10-05 (M1 — primer vertical real)

- **Vertical MASTER → C01 → MP4 de punta a punta**: `media.ingest` (MediaSource +
  probe con fps RACIONAL + hash streaming + proxy 540p + filmstrip uniforme + waveform,
  todo con refs persistidas) → `canter.create_piece` (rango por frames out-exclusivos,
  validado contra la duración del máster) → `canter.export_piece` (corte real MP4
  re-encode, frames→segundos solo en la frontera ffmpeg) → **reopen**: proyecto,
  sources, piezas y outputs persisten en disco.
- **EntityRepository**: colecciones JSON atómicas y validadas para entidades con ids
  no-uuid ("MS01", "C01").
- **ActionCatalog +5** (`vav.media.ingest`, `vav.media.list_sources`,
  `vav.canter.list_pieces`, `vav.canter.create_piece`, `vav.canter.export_piece`) y
  **MCP +5 tools** — paridad 34↔34 verificada por test.
- **PROJECT_STATUS.json**: fuente machine-readable para VAVStatus (parte del DoD).
- Handlers refactorizados a `createJobHandlers(deps)` (stores inyectados); los handlers
  puros siguen exportados como `handlers` para compatibilidad.
- Versión 0.6.0 (fuente única ABRXS_VERSION). Branching: `dev/vav-complete` pasa a ser
  la rama de integración del producto completo.

## AbrxsVAV 0.5.1 · 2026-10-05 (core hardening A — rama `dev/0.5.1-media-core`)

- **Tiempo canónico con helpers racionales** (`packages/contracts/src/time.ts`):
  `framesToSeconds` / `secondsToFrames` / `framesToTimecode` / `timecodeToFrames` con
  timebase racional y drop-frame SMPTE real (`;` en 30000/1001 y 60000/1001). Los 8 fps
  del milestone probados con round-trip; nada hardcodea 30 fps.
- **Contratos v2.5 (delta aditivo)**: `Piece` (`abrxs.piece.v1` — pieza individual con
  sourceRange por frames, provenance y relación explícita con el Production Graph),
  `MediaSource` (`abrxs.media-source.v1` — ref opaca, sin FFmpeg en el contrato) y
  **Job target + payload** (`target {kind,ref}` + `payload` en `abraxas.job.v2`).
  JSON Schemas generados (`piece.v1`, `media-source.v1`).
- **Jobs con objetivo explícito**: `JobEngine.enqueue` acepta `{target,payload}`
  (incluidos en el fingerprint de idempotencia SOLO cuando el caller los pasa
  explícitamente — sin options, el fingerprint es EXACTAMENTE el legacy
  `{kind,revision,content}` y los jobs persistidos antes de 0.5.1 siguen
  deduplicando); `POST /api/jobs` y la tool MCP
  `vav_create_job` los aceptan; `media.generate` / `motion.render` resuelven el evento
  del target — nunca "el primer evento compatible". Compatible con jobs v2 en disco.
- **Versión normalizada**: `ABRXS_VERSION` (contracts) = fuente única; manifests,
  Tauri, health/catalog, Doctor, coach y MCP (heredada de /api/health) alineados a
  0.5.1; test de consistencia anti-deriva.
- **Paridad MCP ↔ ActionCatalog**: nuevo test que audita el código real del MCP contra
  el catálogo (29 acciones ↔ 29 tools). Hueco corregido: +tool `vav_clients_create`.
- Tests: 32 → 70 (time, media-core/piece/media-source/job-target, version, mcp-parity).

## AbrxsVAV 0.5.0 · 2026-10-05 (hito Visual Studio + modularidad + coach)

- **Prompt Studio** (`packages/prompts`): catálogos de cine (7 cámaras, 6 lentes, 6 luz,
  4 stocks, atmósferas, grades, composiciones) + motor de mejora con regla de
  **sujeto intacto** (3 intensidades) + mapeo de motions canon R6 → lenguaje de cámara
  + `buildHandoff()` → HandoffPackage para CUALQUIER IA. 5 tests propios.
- **Providers de generación** (capa 2 Higgsfield): `HiggsfieldProvider` real
  (POST→request_id→poll, soul-styles, Test Connection con HTTP+latencia),
  `NvidiaProvider` (imágenes NIM), `DemoProvider` (pipeline completo sin claves).
  Claves SOLO en el entorno del servicio (HF_API_KEY / NVIDIA_API_KEY).
- **Visual Studio** en el desktop (Visual Lab): wizard con referencias (cámara, lente,
  luz, stock, atmósfera, color, composición, motion), intensidades, mejorar prompt,
  generar en la app (crea evento en el grafo con CAS y encola `media.generate`),
  handoff .txt con descarga + copia, estado y Test Connection de providers.
- **Registries modulares** (`/api/registries`): 5 catálogos versionados (7 familias XR,
  13 SFX, 10 motions, 4 presets de captions, 3 packs) — extender tipos = agregar
  entradas de datos, jamás código. Las herramientas se usan solas o juntas.
- **Modo Coach** (`/api/coach/plan`, tool `vav_coach_plan`): compila el grafo en un
  plan de montaje paso a paso (QUÉ/CÓMO/POR QUÉ por timecode) para terminar el video
  en CapCut/DaVinci o por MCP de DaVinci — la semilla del NlePlan del paso 8.
- **MCP crece a 18 tools**: +studio_enhance, +studio_generate, +studio_handoff,
  +providers_status, +providers_test, +registries_list, +coach_plan.
- **CONTINUITY.txt** nuevo: continuación de desarrollo para cualquier IA + contexto
  de soporte técnico + roadmap de lo pedido (Drive, PWA con comandos precargados,
  coach, modularidad).
- E2E verificado por MCP y HTTP: enhance (sujeto intacto, 7 capas), generate demo
  (evento en grafo → job completed con output del provider), handoff (expectedFilename),
  providers status. 20/20 tests.
- docs/HIGGSFIELD_INTEGRATION.md: la integración de 3 capas (studio/providers/UI)
  y su roadmap (editor de escenas y cinema/short studio completos → paso 5).
- **Motion Composer** (`packages/motion`): motion graphics deterministas estilo
  Remotion — capas (imágenes/texto/video) sobre el timeline → keyframes canon
  (10 presets R6, ease-in-out único, zoom ≤ 1.18) → RenderSpec JSON Remotion-ready
  + comandos FFmpeg zoompan por capa (preview inmediato). Ruta /api/motion con
  soporte de RANGOS (componer motion para una sección del editor), job
  motion.render, GET /api/motion (listar composiciones). 6 tests propios.
- **docs/REMOTION_INTEGRATION.md**: los 4 tutoriales Remotion codificados a la
  arquitectura — VO=timeline (beats de Canter → 1 composición por línea),
  sistema visual bloqueado (Client Profile + packs), 3 capas canónicas
  (bg/mid/fg), spring+interpolate+wobble, halftone, film treatment sandwich,
  weld&detach, receta glass SaaS (frost 12-14px, edge 16%, face 58%),
  prop controls, escena-por-escena antes de fusionar al master.
- Registry `treatment-presets` (9 tratamientos de los videos: halftone, film
  treatment, time-boil 12fps, screen-blend smoke, glass panel/light, weld&detach,
  floor shadow, lamp swing). MCP a 21 tools (+motion_compose/list/render).
- **Client Profiles + config resuelta** (contracts v2.4 + apps/service/clients.ts):
  cadena System→Client→Project→Video→Event con fuente por valor (vav_config_resolve),
  tokens de marca ($colors.*), sourcePriority/negativeRules/editorialRules/glossary,
  import TXT determinista con confianza (high/medium), AI Package System (8 archivos
  para IA externa) e import del formato ABRXS CLIENT PROFILE v1 con diff antes de
  aplicar. 6 tests propios.
- **QA estructural** (/api/qa/analyze + vav_qa_analyze): solapes A-roll/XR, colisiones
  de captions, huecos, familias/SFX/tratamientos desconocidos, recetas incompletas.
- **INSTALL_MAC.command**: instalación/arranque con doble clic (npm ci + build +
  service + abre el navegador). MCP a 28 tools (+clients×5, config_resolve, qa).
- docs/DRESSER_RUNTIME.md: arquitectura modular consolidada del análisis de Dresser
  (runtime de acabado audiovisual, cadena de resolución, niveles de plugin, QA,
  media intelligence pendiente → paso 2).

## AbrxsVAV 0.4.0 · 2026-10-04 (paso 1 del plan de 11)

- Contracts v2.3: delta aditivo en `@abraxas/contracts` — MaterializationStrategy,
  VisualPlanItem, AssetSlot, XrFamilyDefinition, EditGrammar, HandoffPackage,
  ImportResult, PromptRecord, ActionDefinition (12/12 tests verdes).
- ActionCatalog real: `/api/catalog` con las 12 acciones vav.* del servicio —
  principio MCP-first: UI, companion, MCP y tests consumen el mismo catálogo.
- Servidor MCP local `mcp/server.mjs` (stdio, cero dependencias): 13 herramientas,
  incluida `vav_smoke` (E2E real: proyecto → job completed → undo/redo). Escrituras
  exigen confirm:true; modo READ_ONLY disponible.
- Watchdog del JobEngine: timeout por tipo de trabajo (default 15 min, configurable).
- Shell: ModuleErrorBoundary por estación; branding ABRXSVAV v0.4 en la UI.
- Corpus sintético de CI en `samples/corpus/` (podcast con ghost events del canon).
- Sitio oficial en Pages: https://lordjeferies.github.io/abrxsvavstatus/ (status
  dinámico desde este repo + asistente local sin nube).

## AbrxsVAV 0.3.0 · 2026-10-04 (paso 0 del plan de 11)

- Renombrado a AbrxsVAV (branding visible: título de ventana, productName, README).
  Scope interno `@abraxas/*` y IDs de contratos sin cambios, según addendum.
- Nuevo addendum maestro `docs/00_ABRSX_VAV_ADDENDUM.md`: identidad, 8 principios,
  11 estaciones, conceptos v2.1–v2.3, reglas de generación, XR canon, MPT adapter,
  batch, calidad, prohibiciones.
- Docs nuevos: `STATIONS_SPEC.md` (qué/cómo/referencias por estación),
  `CONTRACTS_V2_SPEC.md` (schemas Zod v2.2+v2.3), `BUILD_PLAN_11_STEPS.md`,
  `MCP_INTEGRATION.md` (patrones de los 4 repos propios + ActionCatalog),
  `HANDOFF_UX.md` (prompts copiar/TXT/batch + Import Result),
  `CLOUD_AND_PROVIDERS.md` (Supabase abrxs-vav, Drive, NVIDIA NIM, Firebase fallback),
  `STABILITY_REQUIREMENTS.md`, `UI_CANON.md`, `UI_QA_CHECKLIST.md`,
  `SOURCES_AND_REUSE.md`.
- `packages/ui` nuevo: `tokens.css` + `materials.css` (design system dark-first,
  LiquidGlass solo en UI layer, modos de accesibilidad).
- AGENTS.md ampliado con reglas MCP-first, canon UI, provenance y Definition of Done.
- WORK_START_PROMPT.md reescrito para arrancar el paso 1 con contexto completo.
- Investigación Apple Design 2026 (whats-new/get-started/HIG/resources): doc
  APPLE_HIG_RESEARCH.md con validaciones externas del diseño y 5 adopciones nuevas
  (scroll edge effects, glass tint, checklist HIG de IA, ícono en capas, UI kits 27
  como referencia). UI_CANON.md §13 nuevo; ROADMAP.txt añadido para continuar el
  desarrollo desde cualquier app/agente.

## Foundation 0.2.0 · 2026-10-02

- Implementados ProjectStore, historial undo/redo y JobEngine persistentes.
- Nuevo servicio local Node con archivos atómicos, backups y control de revisión.
- Project Hub y Activity conectados a datos reales; plan por frames editable.
- Import/export graph v2 y resultados estructurales/TXT descargables.
- Contratos de proyecto/operación/trabajo sincronizados, fixtures y tests significativos.
- Lockfile, CI npm ci, smoke UI/API, Doctor básico y documentación de continuidad.
- Auditados los repos propios; registrada la integración futura con Alfa/VideoFlow.
- Referencias del usuario consolidadas y tareas preparadas para Copilot.

## Foundation 0.1.0

Starter UI, schemas iniciales, scaffold Tauri y documentos de producto.

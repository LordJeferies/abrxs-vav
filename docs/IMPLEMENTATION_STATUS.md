# Implementation Status · AbrxsVAV 0.5.0 (pasos 0–1 + hito Visual Studio)

> Base heredada: Foundation 0.2.0 (su estado REAL/MOCK/PENDIENTE sigue válido y está
> en la sección inferior). Este bloque refleja el delta AbrxsVAV.

## REAL (0.5.0 — hito Visual Studio + modularidad + coach)

- Prompt Studio (`packages/prompts`): catálogos de cine + motor enhance con sujeto
  intacto (3 intensidades) + motions canon R6 → lenguaje de cámara + buildHandoff()
  para CUALQUIER IA. 5 tests propios (20/20 totales).
- Providers de generación: Higgsfield real (POST→request_id→poll, soul-styles,
  test connection HTTP+latencia), NVIDIA NIM (imágenes), Demo (pipeline completo
  sin claves). Claves solo en el entorno del servicio.
- Visual Studio en el desktop: wizard con referencias, generar integrado al grafo
  (evento con receta vía CAS + job media.generate), handoff .txt, providers panel.
- Registries modulares (/api/registries): 5 catálogos versionados — XR(7), SFX(13),
  motion(10), captions(4), packs(3). Extender tipos = datos, no código.
- Modo Coach (/api/coach/plan + vav_coach_plan): plan de montaje QUÉ/CÓMO/POR QUÉ
  por timecode compilado del grafo para CapCut/DaVinci.
- MCP a 18 tools (studio×3, providers×2, registries, coach). E2E por MCP y HTTP
  verificado: enhance (sujeto intacto + 7 capas), generate demo (evento→job
  completed), handoff (expectedFilename), providers status.
- CONTINUITY.txt (continuación dev para cualquier IA + contexto de soporte).
- docs/HIGGSFIELD_INTEGRATION.md (3 capas + roadmap de editor de escenas).

## REAL (0.4.0 — paso 1 completo)

- Contracts v2.3 en TS/Zod (delta aditivo sobre project v1/job v2): MaterializationStrategy,
  VisualPlanItem, AssetSlot, XrFamilyDefinition, EditGrammar, HandoffPackage/ImportResult,
  PromptRecord, ActionDefinition, CaptionPolicy, DeliverableLevel. 12/12 tests verdes
  (incluye corpus sintético que valida contratos v2.3 de punta a punta).
- ActionCatalog real en el servicio (`/api/catalog`) con 12 acciones tipadas vav.* —
  la única lista de acciones del sistema (UI/companion/MCP/tests consumen lo mismo).
- Servidor MCP local (`mcp/server.mjs`, stdio, sin dependencias): 13 herramientas
  incluida `vav_smoke` E2E. Probado contra el servicio real: crear proyecto → job
  completed → undo/redo — **smoke passed**. Escrituras exigen confirm:true;
  VAV_MCP_READ_ONLY disponible.
- Watchdog del JobEngine (timeout por tipo de trabajo, default 15 min configurable
  ABRAXAS_JOB_WATCHDOG_MS) — el job colgado se aborta y queda failed con explicación.
- Error Boundary por módulo en el shell (un módulo caído no tumba la app) + branding
  AbrxsVAV en la UI (ABRXSVAV v0.4).
- Corpus sintético de CI (`samples/corpus/corpus-podcast-v1.json`): podcast sintético
  con ghost events B-roll/X-roll/captions/SFX según el canon de contenido.
- Crash test existente de Foundation verificado: recover marca running→interrupted y el
  retry re-ejecuta el snapshot original.
- Sitio oficial publicado: https://lordjeferies.github.io/abrxsvavstatus/ con status
  dinámico desde este repo + asistente local.

## REAL (0.3.0 — paso 0)

- Repo `abrxs-vav` creado desde Foundation 0.2.0; branding visible renombrado
  (README, título de ventana, productName, index.html). Scope interno `@abraxas/*` intacto.
- Documentación completa: addendum maestro, STATIONS_SPEC, BUILD_PLAN_11_STEPS,
  CONTRACTS_V2_SPEC, MCP_INTEGRATION, HANDOFF_UX, CLOUD_AND_PROVIDERS,
  STABILITY_REQUIREMENTS, UI_CANON, APPLE_HIG_RESEARCH, UI_QA_CHECKLIST,
  SOURCES_AND_REUSE, CONTENT_TYPES_SPEC, ROADMAP.txt.
- `packages/ui` con `tokens.css` + `materials.css` (design system dark-first del canon).

## PENDIENTE (sigue el BUILD_PLAN_11_STEPS.md)

- Paso 2: Canter adapter (motor 3.8.1 + Whisper + MediaService por rangos + confirmación
  de cortes). Es el salto de "core certificado" a "producción real".
- Pasos 3–10: vistas compartidas, companion PWA, Dresser batch, Visual Lab, XR Composer,
  captions/delivery, Workflow Studio, Faceless/browser adapter.

---

# Implementation Status · Foundation 0.2.0 (heredado)

## REAL

- Shell React conectada a servicio local Node; Project Hub y Activity con datos reales.
- Crear/seleccionar/reabrir/renombrar proyectos con FPS racional.
- Añadir/editar/quitar eventos con frames enteros y rangos [startFrame,endFrame).
- Importar graph v2 con preview, validación y sustitución deshacible; descargar graph.
- Store versionado en archivos, validación de entrada/lectura, escritura atómica,
  fsync, copia anterior .bak y bloqueo de un único servicio por carpeta.
- CAS por revisión: una ventana obsoleta no sobrescribe otra.
- OperationLog en el mismo archivo/transacción del proyecto; 100 pasos undo/redo.
- JobEngine local de un worker: queued/running/completed/failed/cancelled,
  progress, snapshot de entrada, cancelación, retry manual (3 intentos), dedup.
- Recuperación: queued continúa; running se marca failed/interrupted para reintento.
- Handlers: validación ESTRUCTURAL y compilación del plan de edición TXT.
- Descarga de resultados, errores explícitos, indicadores de conexión y guardado.
- Doctor básico de Node/integridad de registros. Contratos runtime/JSON sincronizados.
- Archivo package-lock y CI reproducible con npm ci.

## MOCK / PROTOTIPO

- Workflow Studio: canvas XYFlow de ejemplo; no ejecuta recipes ni persiste nodos.
- static-preview: diseño antiguo del bootstrap; no representa el estado del core.
- Las páginas de estaciones pendientes describen responsabilidad, no ejecutan funciones.

## PENDIENTE

- Modelo multi-piece y SourceMap; adapter Alfa/Canter/Review con roundtrip sin pérdida.
- AssetStore binario, hashes/provenance de recursos, media ingest/preview/FFmpeg.
- Captions reales, Dresser/render, providers IA/stock y browser-assisted generation.
- Clientes, Visual Lab, recipes, Review, QA audiovisual, DaVinci MCP y CapCut Kit.
- Checkpoints de etapas de media, autoscheduling retry/backoff y resource limits.
- Integración de estos servicios en el editor actual v0.19.3.
- Integración nativa Tauri/Keychain, instalador DMG y certificación real macOS.

## Límites conocidos

Un proyecto contiene un graph; esta versión no migra automáticamente Alfa o graph v1.
No incluye media y no verifica que assetRefs existan. Validar estructura no aprueba un
video. El TXT es instructivo, no ejecuta acciones ni reproduce video.
El estado del servicio es local; no hay autenticación multiusuario ni exposición en red.
Las escrituras atómicas están diseñadas/probadas para filesystem local POSIX, no
carpetas de red. Un archivo corrupto requiere revisión de .bak; no se restaura solo.
La recuperación repite handlers puros del milestone; handlers con efectos externos
necesitarán idempotency/checkpoints antes de registrarse.

## Verificación

`npm run check`, `npm test`, `npm run build`, `npm run doctor`.
Suite core cubre persistencia/reapertura, undo/redo, fallos de escritura, corrupción,
conflictos, recuperación, cancelación, límite de retries y compilación racional.
La verificación de navegador y API se registra en docs/VALIDATION_REPORT.md.

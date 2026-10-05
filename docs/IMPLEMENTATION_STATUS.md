# Implementation Status · AbrxsVAV (estado por hito)

> Estado exacto por hito, marcado REAL / MOCK / EXPERIMENTAL / PENDIENTE.
> Base heredada: Foundation 0.2.0 (su estado sigue válido, sección inferior).

## REAL (0.5.1 — core hardening A: Piece, MediaSource, Job target, tiempo, versiones, paridad)

- **Helpers de tiempo canónicos** (`packages/contracts/src/time.ts`): `framesToSeconds`,
  `secondsToFrames`, `framesToTimecode`, `timecodeToFrames` con timebase **racional**
  (fpsNumerator/fpsDenominator) y drop-frame SMPTE real (30000/1001 y 60000/1001;
  separador `;`). Los 8 fps del milestone validados (23.976/24/25/29.97/30/50/59.94/60)
  con round-trip exhaustivo DF 0..40000. Sin hardcoded 30 fps. 11 tests.
- **Contratos v2.5 (delta aditivo sobre v2.4)** en `@abraxas/contracts` + JSON Schemas
  generados (`contracts/piece.v1.schema.json`, `contracts/media-source.v1.schema.json`,
  `job.v2` actualizado):
  - `Piece` (`abrxs.piece.v1`): pieza individual derivada de un source (id, label,
    projectId, sourceRef, sourceRange por frames out-exclusivos, status, transcriptRef,
    outputRefs, eventRefs, provenance mínima). Sirve para clips verticales/horizontales,
    segmentos, material derivado y batch futuro.
  - `MediaSource` (`abrxs.media-source.v1`): kind (master/proxy/audio/image/video/
    generated_video/final_render), ref opaca (sin detalles de FFmpeg), hash opcional,
    durationFrames+timebase, dimensiones, codec, audio, proxy/waveform/filmstrip refs.
  - **Job target + payload**: `target {kind: project|piece|event|asset|media_source, ref}`
    y `payload` opcionales en `abraxas.job.v2`. `JobEngine.enqueue(project, kind, {target,
    payload})` incluye target/payload en el fingerprint de idempotencia SOLO cuando el
    caller los pasa explícitamente — sin options el fingerprint es EXACTAMENTE el legacy
    `{kind,revision,content}` (verificado por test contra el hash esperado), así que los
    jobs persistidos antes de 0.5.1 siguen deduplicando tras actualizar. `media.generate` y
    `motion.render` resuelven EXACTAMENTE el evento del target (nunca "el primer evento
    compatible"). Compatibilidad: jobs v2 en disco sin target siguen validando
    (target por defecto = proyecto completo). REAL con tests de compatibilidad.
- **Versión normalizada**: `ABRXS_VERSION` (`packages/contracts/src/version.ts`) es la
  fuente única (0.5.1). Alineados: 9 manifests de workspace, `tauri.conf.json`,
  `/api/health`, `/api/catalog`, Doctor, `coach.ts`, y el MCP (lo hereda de `/api/health`
  al inicializar, sin hardcodear). `tests/version.test.ts` impide la deriva futura.
- **Paridad MCP ↔ ActionCatalog** (`tests/mcp-parity.test.ts`): lee el código real de
  `mcp/server.mjs` y exige (1) todo `api()` apunta a una acción del catálogo, (2) toda
  acción es alcanzable por ≥1 tool salvo alias documentados (`vav.motion.render` vía
  `vav.jobs.create`), (3) sin tools huérfanos, (4) confirm:true en destructivas.
  Hueco detectado y corregido: `vav.clients.create` no tenía tool → nueva `vav_clients_create`.
  29 acciones ↔ 29 tools. Suite completa: 70/70 tests (baseline 32 + 38 nuevos).

## MOCK / EXPERIMENTAL (0.5.1)

- `Piece` y `MediaSource` son **contratos REAL pero infraestructura PENDIENTE**: aún no
  hay colección persistida (`pieces/`, `media-sources/`), rutas de servicio ni tools
  canter_*/dresser_* que los usen. No marcar como feature usable hasta el wire de media.
- Providers demo/simulados siguen siendo MOCK honesto (demo provider).

## PENDIENTE (0.5.1 → sigue)

- Wire de `apps/service/src/media.ts` (Bloque 1 — otro agente): canter.ingest/export_piece,
  dresser.render_piece + rutas + MCP +4 tools + tests de parseSrt/keywords/E2E. Al aterrizar,
  debe usar `Piece`/`MediaSource`/`target` de este hito (frames canónicos, no segundos).
- `SourceSegment[]` multi-segmento sobre Piece (nota de migración 2 de CONTRACTS_V2_SPEC).
- Streaming SHA, filmstrip uniforme y Doctor media básico ya son REAL (ver media hardening B,
  sección siguiente); queda PENDIENTE el diagnóstico FFmpeg profundo (fonts, MLX/Whisper,
  hw-encoder matrix) y el wire de media.ts.

## REAL (media hardening B — rama `agent/zcode/53flash-media-hardening-b` → `dev/0.5.1-media-core`)

- **SHA256 streaming** (`sha256File` en `apps/service/src/media.ts`): `createReadStream`
  con chunks de 1 MiB → memoria ~constante aunque el máster pese GB. Errores claros
  (ENOENT incluido). Antes: `readFile` completo en RAM. Tests: multi-chunk de 8 MB vs
  referencia, archivo vacío (digest conocido), error de archivo inexistente.
- **Filmstrip uniforme** (`makeFilmstrip`): captura EXACTAMENTE N thumbnails repartidos
  por TODA la duración (midpoint de cada segmento duration/N, `planThumbnailTimestamps`
  pura y testeable) — un seek por thumbnail, memoria ~constante, válido para 23.976…60
  fps sin hardcodear "frames cada X". Antes: `select='not(mod(n,50))'` solo muestreaba
  los primeros ~40 s de un máster de 2 h. Retry al final real si el seek cae fuera.
- **Paths hostiles** (espacios, acentos, unicode, `()[]:,'`): `execFile` ya era argv puro
  (sin shell); el único punto crítico era el path dentro de `subtitles=` en el
  filtergraph. `escapeFilterPath` implementa el **doble backslash-escape de dos niveles
  de la documentación oficial de FFmpeg** (verificado empíricamente con ffmpeg 9 — las
  variantes con comillas NO sobreviven el parser del grafo). Tests con nombres tipo
  `Vídeos José (López) & [prueba], con: colón/episodio 01 – versión 'final' [v2].mp4` y
  `Client's subs [v2], ep:01.srt` sobre probe/filmstrip/cutPiece/renderFinal real.
- **Doctor media** (`scripts/doctor-media.ts`, integrado en `npm run doctor`): ffmpeg y
  ffprobe (encontrados + versión), directorio temp escribible, espacio libre (WARN <5 GB),
  decodificación real de video sintético (testsrc2→ffprobe con codec NATIVO mpeg4 —
  desacoplado de los encoders H264: sin libx264 también debe PASS), encode H264 con
  fixture real (libx264, fallback h264_videotoolbox; `encoderArgs()` con argumentos
  específicos por encoder — nunca `-preset` fuera de libx264), VideoToolbox como INFO en
  macOS (nunca requisito cross-platform). Sin FFmpeg → FAIL/SKIP honestos, nunca crash.
  PENDIENTE: fonts, MLX/Whisper, providers AI, ComfyUI, DaVinci/CapCut (fuera de alcance).
- **`npm run test:media`** (`tests/media.test.ts`): fixtures sintéticos con FFmpeg
  (testsrc2+sine), gated a la presencia de ffmpeg (CI sin ffmpeg corre solo las partes
  puras). Suite combinada tras integrar Core A: 89/89 (16 de ellos en test:media).

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

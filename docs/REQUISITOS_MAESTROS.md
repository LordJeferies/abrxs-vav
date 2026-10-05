# ABRXSVAV — REQUISITOS MAESTROS (catálogo completo, verificado)

> **Este es el documento de referencia definitiva de qué DEBE ser la app.** Consolidado
> de TODOS los chats y decisiones desde el inicio (diseño original AbrxsVAV, análisis
> modular de Dresser, Higgsfield, los 4 tutoriales Remotion, MCP-first, Handoff UX,
> nubes, canon Apple). Si algo de esta lista no está implementado, es trabajo pendiente
> EXPLÍCITO — nunca "se olvidó". Estados: ✅ REAL (verificado en repo) · 🚧 BASE
> (existe, falta completar) · ⏳ PENDIENTE (especificado, sin implementar).
> Última revisión: 2026-10-05 · versión repo: 0.5.0 (adf85b6).

## A. Producto — una app, 11 estaciones, core compartido

| # | REQUISITO | FUENTE | DÓNDE VIVE | ESTADO |
|---|---|---|---|---|
| A1 | Una sola app de escritorio (Tauri+React) con 11 estaciones: Hub·Plan·Canter·Dresser·Visual Lab·Workflows·Review·Delivery·Clients·Library·Activity | diseño original | `apps/desktop` shell + `apps/service` | 🚧 shell real; Tauri empaquetado ⏳ (paso 10) |
| A2 | Production Graph como ÚNICA fuente de verdad; NlePlan siempre compilado del grafo | original + Dresser chat | `packages/contracts` graphSchema | ✅ |
| A3 | Tiempo canónico = frames enteros (out exclusivo), fps racional; UI muestra segundos | original + Dresser chat | contracts `startFrame/endFrame`, timebase | ✅ |
| A4 | Toda acción = Operation registrada; undo/redo (100 pasos) | original | ProjectStore history | ✅ |
| A5 | Entrar por cualquier estación (sin wizard): máster→Canter, clips→Dresser, guion→Plan | Dresser chat | shell estaciones independientes | ✅ estructura / 🚧 flujos |
| A6 | Separar PROYECTO (podcast EP32) de PIEZAS (C01..C20) con estado propio cada una | Dresser chat | contracts Piece (🚧 single-graph) | ⏳ multi-piece (paso 2-3) |
| A7 | Kanban/Lista/Mapa XYFlow como vistas compartidas del proyecto | Dresser chat + Canter 3.8.1 | pendiente | ⏳ paso 3 |
| A8 | LiquidGlass real en la UI (capa UI solo), canon Apple pixel-precision, dark-first | original + Apple research | `styles.css` LiquidGlass v1 + `packages/ui` + docs/UI_CANON.md | ✅ base / 🚧 prop controls |

## B. Pipeline de medios (el flujo real de trabajo)

| # | REQUISITO | FUENTE | DÓNDE | ESTADO |
|---|---|---|---|---|
| B1 | Ingest de máster: ffprobe (duración/fps/resolución/audio), proxy 540p, filmstrip, waveform | Dresser chat (Media Intelligence) + Canter 3.8.1 | `apps/service/src/media.ts` probe/makeProxy/makeFilmstrip/makeWaveform | ✅ motor / 🚧 wire+UI |
| B2 | Transcript word-level: Whisper MLX local (puente con Abrxs_transcriber_v1); import SRT/VTT/TXT mientras | Canter + transcriber v1 | `media.ts` parseTranscript/sliceSrt ✅ ; Whisper ⏳ paso 2 | 🚧 |
| B3 | Selección editorial sobre transcript; cortes con confirmación manual de límites (apertura/cierre alineados al texto); timestamps = pista, no autoridad | Canter 3.8.1 + original | media.ts corte ✅ ; UI selección ⏳ | 🚧 |
| B4 | Piezas: corte frame-accurate FFmpeg, cola serial persistida, cancelable, reintentable | Canter 3.8.1 | `media.ts` cutPiece ✅ + JobEngine ✅ | ✅ motor / 🚧 wire |
| B5 | Visual Director: propone ghost events (B-roll/XR/captions) con propósito; aprobar o auto-aprobar; función > cuota | original | reglas deterministas pendientes de wire | ⏳ paso 5 |
| B6 | Batch: 20 clips → B-roll automático + captions + render + QA → 20 MP4; jobs aislados (un fallo no tumba el lote) | original + Dresser chat | JobEngine aislado ✅; batch ⏳ paso 5 | 🚧 |
| B7 | Captions: estilos por cliente, karaoke word-level, safe areas, políticas (full/none/preserve_existing/inserts_only/smart) | original + Kapwing | captionPresets registry ✅; render quemado ✅ (media.ts); engine completo ⏳ | 🚧 |
| B8 | QA Engine: estructural (colisiones/solapes/refs) ✅; de píxeles (black frames, safe areas, caption fuera de zona) + repair loop máx 3 | Dresser chat + video-use | `/api/qa/analyze` ✅ ; píxeles ⏳ | 🚧 |
| B9 | Render final v1: corte + B-rolls Ken Burns fullscreen + captions quemadas (estilo del cliente) | esta sesión | `media.ts` renderFinal | ✅ motor / 🚧 wire |
| B10 | Proxy media para scrub fluido (editor usa proxy, render usa máster) | HyCanvas/Dresser chat | makeProxy ✅ / integración editor ⏳ | 🚧 |
| B11 | Media Intelligence: SceneMap, FaceMap, SpeakerMap, GeometryMap (safe zones), active-speaker | Dresser chat (Diffusion/Clips Kitty) | — | ⏳ paso 5-6 |
| B12 | Resource scheduler (CPU/GPU/red: no correr Whisper+ComfyUI+renders a la vez) + prefetch | Dresser chat (Clips Kitty) | — | ⏳ |
| B13 | Asset Store: sha256, mime, resolución, origen (generated/stock/client), licencia, provider, modelo, prompt, seed | Dresser chat | fingerprints de jobs ✅ ; AssetStore completo ⏳ | 🚧 |
| B14 | Library con bins/tags/ratings, 3 niveles (Client/Project/Global), virtualización 500+ | original + ViralMint | estación placeholder | ⏳ |
| B15 | Learned preferences por cliente (explícitas SIEMPRE ganan; aprender solo sugiere) | Dresser chat (Clips Kitty) | — | ⏳ paso 10 |

## C. Modularidad (nunca ifs crecientes)

| # | REQUISITO | DÓNDE | ESTADO |
|---|---|---|---|
| C1 | Registries versionados: XR(7)·SFX(13)·Motion(10)·Captions(4)·Packs(3)·Treatments(9) | `/api/registries` | ✅ |
| C2 | Extender un tipo = agregar entrada de datos (nivel 1 Preset) | registries | ✅ |
| C3 | Nivel 2 Recipe (workflows declarativos) y Nivel 3 Plugin (código aislado, permisos, sandbox) | — | ⏳ paso 9 |
| C4 | Capability system (plugins declaran requires; falta de capacidad = error claro, no crash) | XrFamilyDefinition.requires ✅ / checker ⏳ | 🚧 |
| C5 | Plugins aislados: XR que crashea no tumba batch ni app | Error Boundaries + jobs aislados | ✅ |
| C6 | Event Bus (asset.generated → cache/timeline/QA) | — | ⏳ |
| C7 | Presets congelados por snapshot al crear proyecto; update explícito | — | ⏳ paso 5 |
| C8 | Visual Packs estilo OpusClip (manifest/schema/preview/motion-spec/SHA256SUMS) | visual-packs registry base ✅ / formato pack ⏳ | 🚧 |

## D. Clientes (perfil manda sobre todo)

| # | REQUISITO | DÓNDE | ESTADO |
|---|---|---|---|
| D1 | Client Profile persistente: brand tokens, fonts, captions, broll, xroll, sfx, glossary, negativeRules, editorialRules, platformProfiles | `clientProfileSchema` v2.4 + `clients.ts` | ✅ |
| D2 | Cadena System→Client→Project→Video→Event, cada valor con fuente visible | `resolveConfig` + `/api/config/resolve` | ✅ |
| D3 | Tokens de marca ($colors.accent) resueltos al aplicar | resolveConfig | ✅ |
| D4 | Import TXT desordenado → hechos con confianza (high/medium) → diff → apply (nunca silencioso) | `parseClientTxt` + import_txt route | ✅ |
| D5 | AI Package System (8 archivos) + import formato ABRXS CLIENT PROFILE v1 con diff | `exportAIPackage`/`importAIResponse` | ✅ |
| D6 | UI wizard cómodo de clientes (form, no JSON) con vista de confianza | — | ⏳ (esta sesión siguiente) |
| D7 | Client Lexicon: nombres canónicos para corregir transcripts | glossary ✅ (dato) / uso en Canter ⏳ | 🚧 |
| D8 | Client Components (guardar lower-third/quote card reutilizable — VEED) | — | ⏳ |
| D9 | Assets de cliente prioridad 1 en búsqueda (Client Library) | sourcePriority ✅ dato / resolución real ⏳ | 🚧 |
| D10 | Delivery Profiles por plataforma (instagram vs youtube densidades) | platformProfiles ✅ dato / consumo ⏳ | 🚧 |
| D11 | Clientes globales (fuera de Canter/Dresser), herencia Organization→Client→Project | ClientStore global ✅ | 🚧 |

## E. Generación (IA y stock)

| # | REQUISITO | DÓNDE | ESTADO |
|---|---|---|---|
| E1 | Prioridad de materialización: local→native_api→tool_api→browser_adapter→manual_handoff | MaterializationStrategy | ✅ contrato |
| E2 | Prompt Studio: sujeto intacto + capas de cine (3 intensidades) + motion canon→lenguaje de cámara | `packages/prompts` | ✅ |
| E3 | HandoffPackage para CUALQUIER IA (prompt+negative+spec+expectedFilename) + Import Result automático | HandoffPackage + `/api/studio/handoff` | ✅ (motor) / UI arrastrar ⏳ |
| E4 | Higgsfield provider: auth KEY_ID:SECRET, POST→request_id→poll, soul-styles, Test Connection | `providers.ts` higgsfieldProvider | ✅ código / validar con key real ⏳ |
| E5 | NVIDIA NIM: imágenes (FLUX/SD3.5) + LLM/vision; video NO | providers.ts nvidiaProvider | ✅ código / key del usuario ⏳ |
| E6 | ComfyUI local (workflows JSON externos, sustitución prompt/seed/size) | — | ⏳ paso 6 |
| E7 | STRICT FREE MODE: sin fallback pagado silencioso; confirmación antes de gastar | spec + demo provider | 🚧 (regla definida; enforce en router ⏳) |
| E8 | Provider Registry por capabilities + circuit breaker + rate limit + backoff | providers.ts base / breaker ⏳ | 🚧 |
| E9 | Auto Model Selection explicable ("por qué elegí X") | — | ⏳ paso 6 |

## F. XR canon R6/R6.1 (gramática oficial de X-rolls)

| # | REQUISITO | DÓNDE | ESTADO |
|---|---|---|---|
| F1 | 7 familias (COMIC_INFO·COMIC_CC·TYPO·PHOTOS·OBJECTS·PHOTO_OBJECT·NO_XR) como plugins versionados | xr-families registry + XrFamilyDefinition | ✅ datos / composers ⏳ paso 7 |
| F2 | Densidades por formato: intro=6 exactos · vertical 2-4 · horizontal ≈1/120s · episodio ≈1/300s | CONTENT_TYPES_SPEC + density rules | ✅ dato / enforce ⏳ |
| F3 | Reglas de selección: no misma familia consecutiva · diversidad · narrativeFitOverridesDiversity | spec | ✅ dato / enforce ⏳ |
| F4 | Estados beta→alfa→generated→approved→omega | XrProductionState | ✅ contrato |
| F5 | XR Composer DETERMINISTA: IA genera assets, la app mueve cámara; TYPO jamás IA | addendum §7 | ✅ principio / Remotion bundle ⏳ paso 7 |
| F6 | XR = mini-composición en capas (scene.json + bg/mid/fg/overlays/captions + motion.json) | CompositionSpec (packages/motion) | ✅ base / pack XR completo ⏳ |
| F7 | Deliverable levels: assets_only / preview / final + variants A/B/C | DeliverableLevel + variants | ✅ contrato / flujo ⏳ |
| F8 | Motion: 10 presets canon (zoom ≤1.18, ease-in-out único) → lenguaje de cámara | MOTION canon + packages/motion | ✅ |
| F9 | SFX: librería reconocible (13 familias con variantes, 9 campos por evento, repetición>invención) | sfx-families registry | ✅ dato / render ⏳ |

## G. Remotion / motion graphics (4 tutoriales codificados)

| # | REQUISITO | DÓNDE | ESTADO |
|---|---|---|---|
| G1 | VO=timeline: cada línea del transcript = escena que empieza/termina con su narración | REMOTION_INTEGRATION §1 | ✅ spec / beats ⏳ paso 5 |
| G2 | Sistema visual bloqueado (bg compartido + fuentes + paleta; varía mid/foreground) | Client Profile + packs | ✅ dato / compositor ⏳ |
| G3 | 3 capas canónicas (bg/mid/fg) + halftone B&W cutouts + offset drop shadow | CompositionSpec layers + treatment halftone | ✅ base |
| G4 | Film treatment sandwich (grain, scan lines 1.6px/16%, vignette, corner blur, gate weave) | treatment film-treatment.v1 | ✅ dato / aplicar ⏳ |
| G5 | Spring + interpolate + wobble con decaimiento (no cartoonish); stagger; frame numbers como moneda | keyframes canon | ✅ (ease-in-out) / spring preset ⏳ |
| G6 | Glass SaaS pack (frost 12-14px, edge 16-17%, face 58%, corners 22/34, slab 20px/3px, luz orbital, reactividad 55%) | treatment glass-panel/light.v1 | ✅ dato / pack Remotion ⏳ paso 7 |
| G7 | Weld&detach, floor shadow, lamp flicker, screen-blend smoke, time-boil 12fps | treatments | ✅ dato / aplicar ⏳ |
| G8 | Prop controls (inspector por capas, valores con SAVE) + Remotion Studio embebido | — | ⏳ paso 7 |
| G9 | Motion Composer compilable desde el editor POR SECCIONES + MCP | /api/motion (startFrame) + vav_motion_* | ✅ |

## H. MCP-first (todo operable y testeable por agente)

| # | REQUISITO | DÓNDE | ESTADO |
|---|---|---|---|
| H1 | ActionCatalog único → UI/companion/MCP/tests | /api/catalog (29 acciones) | ✅ |
| H2 | Servidor MCP stdio local, sin DB propia, confirm:true en destructivas, READ_ONLY flag | mcp/server.mjs | ✅ |
| H3 | Tools por dominio: core, canter, studio, handoff, providers, motion, clients, config, qa, coach (28) | mcp/server.mjs | ✅ |
| H4 | La app como "MCP de edición de video" (estilo DaVinci/AE MCP): agente mueve XR03, baja zoom, etc. | base real / tools de edición fina ⏳ | 🚧 |
| H5 | Tests de integración = mismas acciones del catálogo (in-process) + vav_smoke E2E | tests + vav_smoke | ✅ |
| H6 | Modo coach: plan de montaje QUÉ/CÓMO/POR QUÉ por timecode para CapCut/DaVinci o MCP DaVinci | /api/coach/plan | ✅ |
| H7 | NlePlan compilado: FCPXML/EDL DaVinci, draft CapCut, EDIT_PLAN.txt, reference render, inyección directa vía MCP DaVinci | — | ⏳ paso 8 |

## I. Nubes y dispositivos

| # | REQUISITO | ESTADO |
|---|---|---|
| I1 | Companion PWA (GitHub Pages) para iPhone: ver jobs, aprobar, notas, comandos | ⏳ paso 4 (sitio informativo ✅ PWA instalable ✅) |
| I2 | Comandos precargados offline (cola vav_commands en Supabase, se ejecutan al abrir desktop) | ⏳ paso 4 |
| I3 | Supabase: mismo proyecto, workspace abrxs-vav, tablas vav_state+vav_commands, payload vav.v1, CAS expectedRevision | ✅ decisión / tablas ⏳ paso 4 |
| I4 | Google Drive readonly-first (OAuth Web/Desktop split), buscador de archivos, subir entregas | ⏳ pasos 4-5 |
| I5 | Review Companion sincronizado con notas targetRef | ⏳ paso 4 (Abrxs-Review base) |
| I6 | Publicación: NO nativa (publisher/n8n externo) | ✅ decisión |

## J. Calidad y barra mínima

| # | REQUISITO | ESTADO |
|---|---|---|
| J1 | Barra: la intro EP55 es el MÍNIMO; 5 capas (editorial/visual/motion/audio/ritmo) | ✅ criterio / QA ⏳ |
| J2 | Provenance total por asset (origen, provider, modelo, prompt, seed, hash, licencia) | 🚧 (jobs fingerprint ✅; store ⏳) |
| J3 | Reporte de licencias por export | ⏳ paso 8 |
| J4 | Corpus sintético de CI | ✅ samples/corpus |
| J5 | Presupuestos de rendimiento medibles (shell<2s, módulo<300ms, scrub 60fps, 500+ assets) | ✅ definidos / medir ⏳ |
| J6 | Visual regression de templates en CI | ⏳ paso 9 |
| J7 | Export versionado (FINAL_v3, jamás sobrescribir) + re-export con último preset | ⏳ paso 8 |
| J8 | Fichas canónicas R6 como jobs de generación (FULL_EPISODE prompt = Workflow Recipe) | ⏳ paso 7-9 |

## K. Infraestructura y entrega

| # | REQUISITO | ESTADO |
|---|---|---|
| K1 | Escritorio Tauri (justificado: FFmpeg, SQLite, procesos) | 🚧 scaffold / empaquetado ⏳ paso 10 |
| K2 | INSTALL_MAC.command (doble clic = instalar+abrir) + instalación desde cero por cualquier chat | ✅ verificado E2E |
| K3 | Doctor (FFmpeg, GPU, disco, providers, DB, keys) con semáforos | 🚧 básico ✅ / ampliar paso 5 |
| K4 | Estabilidad: escrituras atómicas+.bak ✅, lock ✅, CAS ✅, watchdog ✅, circuit breaker ⏳, WAL-SQLite ⏳, migraciones+backup ⏳ | 🚧 |
| K5 | Logs estructurados + visor; crash reporter opt-in local | ⏳ paso 1-5 |
| K6 | Feature flags para módulos inestables sin rebuild | ⏳ |
| K7 | i18n scaffold es/en desde el día 1 | ⏳ paso 10 |
| K8 | Updater Tauri + SW update prompt PWA | ⏳ paso 10 |
| K9 | CONTINUITY.txt + ROADMAP.txt: cualquier IA puede continuar el desarrollo | ✅ |
| K10 | Sitio oficial con status EN VIVO desde el repo + asistente local | ✅ |

## L. Reglas duras (prohibiciones) — nunca negociables

1. ⛔ `task.py` de MoneyPrinterTurbo / enviarle guiones a reinterpretar.
2. ⛔ Providers de IA antes del core (ya cumplido — core completo).
3. ⛔ Reescribir Canter 3.8.1 / Review 05 (adapters).
4. ⛔ Segundas fuentes de verdad (plan DaVinci paralelo, DB del MCP).
5. ⛔ Providers acoplados a módulos (todo por capability).
6. ⛔ Saltarse checkpoint humano en generación cara.
7. ⛔ Secretos en repo/docs/logs/MCP results (claves solo en entorno del servicio/Keychain).
8. ⛔ Código AGPL/PolyForm/no-comercial (OpenChatCut, SupoClip, ViralMint, Clips Studio, Rescript, SUPIR, OpenShot, HyCanvas) — solo patrones.
9. ⛔ LiquidGlass sobre contenido (solo capa UI) · ⛔ TYPO delegado a IA · ⛔ zoom > 1.18.

## M. Referencias — qué se copia de dónde (mapa completo)

Ver `docs/SOURCES_AND_REUSE.md` (tabla completa con licencias). Resumen: REUSE
Foundation/Canter/Review/LiquidGlass/Creativly/OpusClip/openshortsX · ADAPT
MoneyPrinterTurbo (jamás task.py)·NodeBanana·video-use · INTEGRATE XYFlow·VideoFlow
core · REFERENCE Freepik MCP·Langflow·n8n·Clarity·aPulse·Descript·Kapwing·VEED·
Diffusion Studio (MPL, selectivo)·CutScript·YFT · ⛔ AGPL/PolyForm/no-comercial.

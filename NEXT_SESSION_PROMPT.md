# NEXT_SESSION_PROMPT — CONTINUAR Y TERMINAR ABRXSVAV (autónomo, hito a hito)

> Sesión de origen: ZCode 2026-10-05/06 (M0–M6 integrados). Pega esto en un agente
> nuevo (Claude Code / ZCode) tal cual, o pídele solo: «Lee NEXT_SESSION_PROMPT.md
> en dev/vav-complete y ejecútalo».

## REPOSITORIO Y ESTADO
- Repo: https://github.com/LordJeferies/abrxs-vav
- Rama de integración: **dev/vav-complete** (HEAD esperado ≥ 26877d3) · `main` = estable, NO tocar.
- Copia local existente: /Users/lordjef/dev/abrxs-vav (si no existe, clona).
- GitHub CLI autenticado como LordJeferies (email verificado — push funciona).
- Versión 0.6.0 · 174/174 tests · doctor exit 0 · paridad MCP 55↔55 · CI verde.

## 0. REGLA PRINCIPAL
Avanza AUTÓNOMAMENTE milestone por milestone:
IMPLEMENTAR → TESTEAR → DOCS → PROJECT_STATUS → COMMIT → PR → CI verde → MERGE a dev/vav-complete → SIGUIENTE.
NO te detengas a preguntar. NO toques main (solo el PR final M19). NO reinicies arquitectura. NO repitas lo hecho.
Solo detente ante bloqueo REAL (credencial/hardware/aprobación humana); documéntalo como BLOCKED en
docs/PROJECT_STATUS.json (blockers) y continúa con lo demás.

## 1. INSPECCIÓN OBLIGATORIA (antes de tocar nada)
git fetch origin && git checkout dev/vav-complete && git pull --ff-only
Comprueba HEAD/CI/working tree. Luego: npm ci && npm run check && npm test && npm run test:media && npm run build && npm run doctor
Lee: CONTINUITY.txt, ROADMAP.txt, docs/PROJECT_STATUS.json, docs/IMPLEMENTATION_STATUS.md, CHANGELOG.md, AGENTS.md.
EL CÓDIGO ACTUAL MANDA sobre los docs si difieren.

## 2. HECHO (M0–M6) — capacidades REALES verificadas E2E
- **0.5.1/M0**: Piece/MediaSource/Job target explícito, timebase racional + drop-frame SMPTE,
  versión única ABRXS_VERSION, SHA streaming, filmstrip uniforme, paths hostiles (escape
  filtergraph doble backslash), Doctor media (ffmpeg/ffprobe/decode mpeg4/H264/whisper honesto).
- **M1**: vertical real MASTER→ingest→C01→MP4 (EntityRepository JSON atómico, media.ingest con
  probe fps racional + derivados, canter.create_piece por frames, canter.export_piece real).
- **M2**: media.transcribe (mlx_whisper word-level canónico + SRT/TXT + cache por hash),
  text→Piece (align exact/normalized/anchors/fuzzy + decideAlignment con gating), UI Canter.
- **M3**: AssetStore canónico (idempotente por ref+hash, ids sin reciclar, provenance/licencia),
  ClientProfile v1.1 (voice/audience/logos), projectContent.clientId + set_client CAS.
- **M4**: Dresser MVP (beats del transcript → keywords→tags → b-roll con WHY o caption;
  densidad/negativas del cliente; eventos en grafo por CAS idempotentes; render vestido 1080x1920).
- **M5**: Batch (auto-piezas por partición entera, anti-repetición de b-rolls por excludeAssetIds,
  JobEngine.pause/resume cooperativo, estado de lote CALCULADO de los jobs).
- **M6**: Visual Lab v1 (searchAssets scoring determinista, grabFrame con escalera de seeks,
  similarAssets, attachAssetToEvent CAS con WHY).

## 3. REGLAS INVIOlABLES
1. Production Graph = única verdad audiovisual. Nada de timelines paralelos.
2. Tiempo canónico: frames enteros out-exclusivos + timebase RACIONAL. Segundos SOLO en la
   frontera FFmpeg/UI. Límites de clip: floor al abrir, ceil al cerrar.
3. Toda operación nueva converge en ActionCatalog (apps/service/src/catalog.ts) + handler + route +
   MCP tool + test de paridad (55↔55 hoy; crece siempre 1:1). MCP no implementa lógica.
4. Versiones: ABRXS_VERSION (packages/contracts/src/version.ts) única fuente; bump solo al cerrar
   milestone (9 manifests + tauri.conf); tests/version.test.ts lo exige.
5. Repos con cache en memoria = SINGLE-WRITER (el servicio escribe); los tests E2E HTTP siembran
   entidades ANTES de arrancar el server.
6. Handlers con deps inyectadas (createJobHandlers(deps)); jobs con target EXPLÍCITO; fingerprint
   legacy {kind,revision,content} cuando no hay target/payload (compat pre-0.5.1, con test).
7. Sin secretos en git/JSON/logs. Escritura atómica (atomicWrite). Nunca cargar un máster en RAM.

## 4. GOTCHAS YA RESUELTOS (no reintroducir)
- ffmpeg: '-shortest' acorta el vídeo al audio → -ss tras el EOF produce 0 frames con exit 0 y
  stderr vacío. Patrón: escalera de seeks descendente validando salida (grabFrame, makeFilmstrip).
- Filtergraph: SOLO doble backslash-escape de dos niveles (escapeFilterPath) — comillas rompen el parser.
- renderFinal escala la BASE a 1080x1920 (overlay toma dims del primer input).
- autoWindows: partición entera [floor(i·N/c), floor((i+1)·N/c)) — floor/ceil rompe contigüidad.
- vitest.config.ts: fileParallelism:false — NO quitar (E2E real-media en paralelo flaquea).
- E2E gated (HAS_FFMPEG/HAS_SAY/BACKEND) se saltan honestos en CI sin MLX; en este Mac corren
  (mlx-community/whisper-large-v3-turbo cacheada; whisper-cli sin ggml → Doctor binario PASS/modelo SKIP).
- Edición con scripts: verifica SIEMPRE tras escribir (grep) — un assert a mitad deja estado híbrido.

## 5. MILESTONES RESTANTES (PRs separados hacia dev/vav-complete)
M7 — XR/Visual Packs: pack registry (manifest+schema+tokens+preview+tests) para
  TYPO/PHOTOS/OBJECTS/COMIC_INFO/COMIC_CC/DATA_STORY/LIQUID_GLASS; adapter ProductionGraph→
  Remotion/VideoFlow (RenderSpec ya existe en packages/motion). Gate: 1 pack XR base REAL E2E.
M8 — Review: notas por rango, approve/reject/compare sobre Pieces/renders + auditoría del repo
  LordJeferies/Abrxs-Review (preserva lo útil, moderniza).
M9 — Delivery: DAVINCI_PACKAGE (TIMELINE.json compilado del grafo, EDIT_PLAN.txt, ASSET_MANIFEST)
  + CAPCUT_PACKAGE + assets-only/SRT/ASS. El plan se COMPILA del ProductionGraph.
M10 — Workflow Studio: nodos XYFlow (INPUT/ANALYSIS/AI/MEDIA/ABRAXAS/LOGIC/OUTPUT); recipes
  expuestas también en ActionCatalog.
M11 — Browser/external generation: BrowserGenerationAdapter (local→API→MCP→browser→manual) sin
  saltarse CAPTCHA/paywalls; GENERATE AI PACKAGE + IMPORT RESULT.
M12 — Preproducción script-only + faceless (script→TTS/VO→plan→captions→render).
M13 — Estabilidad/instalador/release pipeline (INSTALL_MAC, codesign, doctor completo).
M14–M17 — Geómetra VX, Brand Creator VX, Builder VX, Canvases VX (AUDIT de repos propios primero;
  ContentPotential→ContentSpec con contracts canónicos).
M18 — Full Studio: shells standalone (Abrxs Canter.app, Dresser.app…) montando los MISMOS módulos.
M19 — Release Candidate: docs/RELEASE_CANDIDATE.md + PR dev/vav-complete→main (NO mergear).
DEUDA DE UI (intercala donde encaje): browsing de assets en Visual Lab, UI Dresser,
wizard de Clients, shells standalone.

## 6. DEFINITION OF DONE POR MILESTONE
[ ] contracts aditivos + schemas regenerados (npm run contracts:generate)
[ ] implementación real + persistencia · tests (unit + E2E gated real cuando aplique media)
[ ] npm run check ✓ · npm test ✓ · npm run test:media ✓ · npm run build ✓ · npm run doctor exit 0
[ ] CI green en el PR · mergeable=true · merge con --match-head-commit <SHA>
[ ] CHANGELOG.md + docs/IMPLEMENTATION_STATUS.md (REAL/MOCK/PENDING honesto) + ROADMAP.txt
[ ] docs/PROJECT_STATUS.json actualizado · VAVStatus lo refleja (lee dev/vav-complete)
[ ] sin secretos · sin regresiones (3 corridas de npm test en verde si tocaste media)

## 7. GIT
Rama feature/m<N>-<nombre> desde dev/vav-complete · commits pequeños Conventional Commits ·
PR → dev/vav-complete · CI verde + mergeable → merge · pull + suite completa en verde · siguiente.
push normal (—force-with-lease solo tras rebase explícito, jamás --force).

## 8. SI TE QUEDAS SIN CONTEXTO
Actualiza ANTES: CONTINUITY.txt (estado + siguiente acción EXACTA), ROADMAP.txt,
docs/IMPLEMENTATION_STATUS.md, docs/PROJECT_STATUS.json, CHANGELOG.md.
Debe poder continuar otra sesión sin reconstruir contexto.

## 9. EMPIEZA AHORA
1) inspección §1 → 2) M7 XR/Visual Packs (feature/m7-visual-packs) → 3) M8→M19 con el DoD →
al cerrar cada milestone informa solo: MILESTONE / HECHO / TESTS / PR / STATUS / VAVSTATUS / NEXT.
GitHub es la verdad. main permanece estable. dev/vav-complete es la integración. EJECUTA.

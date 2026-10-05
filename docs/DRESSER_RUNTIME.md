# ABRXSVAV — DRESSER RUNTIME (arquitectura modular consolidada)

> Consolida el análisis modular de Dresser (chat del 2026-10-04: Client Profiles,
> Style Packs, AI Package System, Treatment Registry, Media Intelligence, QA Engine,
> NLE Export) sobre la app ya construida. Fuente de las decisiones de producto;
> implementación viva señalada con ✅.

## 1. Principio: un runtime modular de acabado audiovisual

El core no sabe qué es COMIC_INFO, NVIDIA, Montserrat ni karaoke — solo Project,
Graph, Event, Asset, Job, Plugin, Operation, Time, State. Los módulos enseñan todo lo
demás. UNA APP · MUCHOS MÓDULOS · CORE COMPARTIDO · MOTORES SEPARADOS.

| CAPA | CONTENIDO | ESTADO |
|---|---|---|
| CORE | ProjectStore, Production Graph, Jobs, Cache (fingerprint), Operation Log | ✅ Foundation real |
| CLIENTS | Client Profile, Project Profile, Style Packs, resolution chain | ✅ v0.5 (clientes.ts) |
| REGISTRIES | XR(7) · SFX(13) · Motion(10) · Captions(4) · Packs(3) · Treatments(9) · Fonts | ✅ /api/registries |
| CONTENT ANALYSIS | Transcript (Canter word-level), SceneMap, FaceMap, SpeakerMap, GeometryMap | ⏳ paso 2 (Canter adapter) |
| VISUAL DIRECTOR | Beats → ghost events con propósito, Visual Opportunity Score | ⏳ paso 5 |
| GENERATION | Provider Registry ✅ (demo/hf/nvidia) · Router con prioridad por cliente ✅ (sourcePriority en perfil) · Visual Recipes | parcial |
| MOTION | Motion Composer ✅ (capas→keyframes→RenderSpec/FFmpeg) · Remotion bundle | ✅ base / paso 7 |
| QA ENGINE | QA estructural ✅ (colisiones/solapes/gaps/refs) · QA de píxeles (black frames, safe areas) | ✅ base / con media |
| EXPORT | Coach ✅ (plan de montaje) · NlePlan FCPXML/EDL · CapCut Kit · DaVinci MCP | paso 8 |
| UI | Shell 11 estaciones ✅ · Visual Studio ✅ · Inspector por propiedades | parcial |

## 2. Client Profiles + cadena de resolución ✅

```
SYSTEM DEFAULTS → CLIENT PROFILE → PROJECT PROFILE → VIDEO → EVENT (gana la más específica)
```
- `clientProfileSchema` (contracts v2.4): brand tokens ($colors.accent), fonts,
  captions/broll/xroll/sfx presets, **sourcePriority** por cliente, glossary
  (canonical spelling), negativeRules, editorialRules, platformProfiles.
- `resolveConfig()` devuelve cada valor **con su fuente** (`/api/config/resolve`,
  `vav_config_resolve`) — el "View Resolved Config" del análisis.
- Tokens `$colors.*` se resuelven al leer: cambiar el color del cliente actualiza
  todos los presets que lo referencian (§3 del análisis).

## 3. AI Package System ✅ (genérico, no solo clientes)

Export → IA externa → respuesta estructurada → validación → **diff** → apply:
- `POST /api/clients/:id/import_txt` → hechos con **confidence** high/medium + diff SIN aplicar.
- `POST /api/clients/:id/ai_package` → los 8 archivos (01_RAW…08_RESPONSE_SCHEMA).
- `POST /api/clients/:id/ai_import` → formato legible `ABRXS CLIENT PROFILE v1`
  ([CLIENT]/[BRAND]/[FONTS]/[NEGATIVE_RULES]…) con diff; `apply:true` aplica.
- El mismo patrón sirve mañana para Visual Plans, XR definitions, caption presets.

## 4. Plugins: 3 niveles de extensión (análisis §13)

1. **Preset** (solo datos — 99% de "agregar un tipo"): registries ✅
2. **Recipe** (workflow declarativo: AssetSearch→Generate→Transform→Compose): paso 5
3. **Plugin** (código aislado, con permisos declarados estilo sandbox): paso 9+

Reglas de estabilidad ya implementadas: versionado semver por entrada
(`xroll.comic-info@1.2.0`), capability declarations (`requires` en XrFamilyDefinition),
jobs aislados (un fallo no tumba el batch), Error Boundaries por módulo, atomic
writes + .bak, snapshots de presets al crear proyecto (⏳ al conectar Dresser MVP).

## 5. QA Engine ✅ (estructural) → repair loop

`GET /api/qa/analyze?projectId=` (`vav_qa_analyze`): solapes A-roll, colisiones de
captions, solapes XR, huecos largos, familias XR/SFX/tratamientos/captions
desconocidos (contra registries), recetas incompletas, mismatch de rangos motion.
QA de píxeles (black frames, caption fuera de safe area con video real) entra con el
pipeline de render (paso 5). Repair loop: máx 3 (limita el JobEngine).

## 6. Media Intelligence (⏳ paso 2, el siguiente gran bloque)

TranscriptMap (✅ vendrá de Canter word-level) + SceneMap + FaceMap + SpeakerMap +
GeometryMap (safe zones para captions/overlays) + Filmstrip/Waveform bajo demanda.
El Visual Director consume esto + Client Profile + EditGrammar → ghost events.
Paquete para IA externa con transcript compacto + contact sheets solo para casos
complejos (video-use pattern: barato→caro).

## 7. Pendiente para "app completa" (mapeado a pasos)

| FASE (análisis) | NUESTRO PASO | QUÉ FALTA |
|---|---|---|
| F1 Media Core | paso 2 | Canter adapter (Whisper, MediaService rangos, confirmación de cortes) |
| F2 Editor | paso 3 | Vistas compartidas Kanban/Mapa XYFlow |
| F3 MVP útil | paso 5 | Batch B-roll 20 clips + captions + render + QA píxeles |
| F4 Client System UI | — | UI visual de Clients (hoy por MCP/API; wizard cómodo) |
| F5 X-Rolls | paso 7 | XR Composer por familias + Remotion bundle |
| F6 Plugins | paso 9 | Workflow Studio + marketplace de packs |
| F7 Interchange | paso 8 | FCPXML/EDL/CapCut kit/DaVinci MCP |
| F8 Avanzado | paso 10 | Learned preferences, multimodal planning, repair automático |

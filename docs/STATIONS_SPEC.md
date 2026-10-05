# ABRXSVAV — SPEC POR ESTACIÓN (las 11 herramientas + shell)

> Complementa el addendum (`docs/00_ABRSX_VAV_ADDENDUM.md`). Para cada estación:
> propósito, qué hace, qué NO hace, cómo lo hace (mecánica), qué hay que construir,
> referencias concretas (repo → qué se toma), y criterio de salida verificable.
> Las etiquetas de referencias: **REUSE** = copiar código compatible · **ADAPT** =
> recrear el patrón · **INTEGRATE** = dependencia real · **REFERENCE** = solo estudiar.

---

## 0. SHELL (no es estación: es el contenedor)

**Propósito:** una sola app; las estaciones son módulos lazy dentro de un shell común.

**Qué hace:** navegación hash (`#/canter`), TopBar con 11 estaciones + undo/redo + badge
de jobs activos, Command Palette (⌘K), Error Boundary **por módulo** (Canter puede morir
y Review sigue), tema dark-first con tokens, módulos lazy como chunks independientes,
autosave de sesión (módulo, pieza, scroll, playhead).

**Qué NO hace:** no contiene lógica de ninguna estación; no procesa medios en el hilo principal (regla dura: todo pesado va a commands de Tauri o workers).

**Qué construir:** `shell/App.tsx` (routing + Suspense), `shell/modules.ts` (registro),
`shell/TopBar.tsx`, `shell/CommandPalette.tsx`, `shell/ModuleErrorBoundary.tsx`,
`shell/Icon.tsx` (set único estilo Lucide, stroke 1.5), `packages/ui/tokens.css` +
`materials.css` (ya creados en este repo).

**Referencias:** patrón lazy-modules de tu repo abraxas-os · LiquidGlass (MIT, REUSE para
materiales del shell) · Lucide (iconografía única) · Apple HIG (dos capas contenido/UI).
El starter Foundation ya trae shell React + servicio local funcionando (REAL).

**Verificación:** navegar 11 estaciones sin crash; ⌘K abre paleta; un módulo con error no tumba el resto; recargar conserva proyecto y posición.

---

## 1. HUB — la puerta de entrada

**Propósito:** proyectos persistentes con estado por estación y "continuar donde ibas".

**Qué hace:** lista de proyectos (grid de cards con nombre + fecha), crear/abrir/borrar,
panel de estado por estación calculado desde el grafo (BRIEF ✓ · TRANSCRIPCIÓN ✓ ·
CORTES 20 · PLAN VISUAL 12/20 · ASSETS 9 · REVIEW pendiente), botón "Continuar en X"
(la primera estación incompleta), actividad reciente de jobs.

**Qué NO hace:** no edita contenido; no duplica funciones de Activity.

**Cómo:** lee ProjectStore + ProductionGraph y calcula conteos por status. Cero estado propio más allá del formulario de creación.

**Qué construir:** `modules/hub/` (ProjectList, StationStatus, NewProjectForm, JobPreview).

**Referencias:** Foundation ya tiene Project Hub REAL (REUSE de `apps/desktop/src/ProjectHub.tsx`).

**Verificación:** crear proyecto → recargar → sigue ahí; el botón "Continuar" apunta a la estación correcta según el estado del grafo.

---

## 2. PLAN — cuando aún no hay video

**Propósito:** entrar con un `guion.txt` y salir con estructura de contenido y preproducción visual — sin que exista un video.

**Qué hace:** parse de texto → estructura de beats → LLM propone plan visual preliminar
(b-rolls potenciales, ideas de X-rolls, SFX, captions) → todo queda como nodos `proposed`
del grafo esperando a que exista el máster. Edición manual de beats.

**Qué NO hace:** no genera video ni audio; no obliga a usar la IA (parse determinista primero, LLM opcional).

**Cómo:** Provider Router con capability `llm.complete`; prompts versionados (PromptRecord); Client Profile + EditGrammar condicionan las propuestas.

**Qué construir:** módulo plan (ScriptImport, BeatEditor, VisualPrePlan), handler de job `plan.propose_beats`.

**Referencias:** tutoriales Remotion Vox-style (videos 45–48 de REFERENCE_SOURCES: script→beats→asset sheet) · Creativly (MIT: scene/beat architecture, tokens centralizados).

**Verificación:** pegar guion de 2 páginas → 15–30 beats editables en el grafo; cerrar y reabrir sin pérdida.

---

## 3. CANTER — decide QUÉ queda y EN QUÉ ORDEN

**Propósito:** ingest, transcripción word-level, alineación texto↔video, selección editorial, cortes, multicortes, orden narrativo, ajuste IN/OUT, exportación limpia.

**Qué hace (port del 3.8.1 + elevado):**
- Ingest de máster con transcripción existente sin repetir Whisper.
- MediaService por rangos — el podcast jamás se carga entero en memoria; streaming por rangos.
- Selección de texto conectada al visor/cabezal; el inspector sigue el bloque alcanzado.
- Cola serial persistida con prioridad, cancelación y reintento; progreso real por sección.
- Cortes provisionales por timestamp → **confirmación manual de límites** → alineación textual apertura/cierre.
- Fichas con source map (segmentos del máster); recetas de exportación con detección de recetas iguales.
- Visor del máster junto a Lista/Mapa; búsqueda pausada resalta palabras.

**Qué NO hace:** no decide cómo se ve nada (eso es Dresser); no reescribe el motor 3.8.1 — lo envuelve.

**Cómo:** `CanterAdapter` sobre el motor Python/Rust de `Abrxs-Canter 3.8.1` (clon de
referencia: github.com/LordJeferies/Abrxs-Canter) · Whisper local (MLX/whisper.cpp) o
Whisper JAX en servidor como provider `transcribe` · FFmpeg sidecar para cortes físicos.

**Qué construir:** adapter del motor, módulo canter (Ingest, TranscriptView, PieceCards,
MasterViewer, ExportRecipes), handlers `canter.transcribe`, `canter.cut`, `canter.export_piece`, MediaService.

**Referencias:** **Abrxs-Canter (REUSE — es tuyo, 3.8.1)** · CutScript (patrón transcript-based editing; verificar licencia antes de copiar bloques) · OpenChatCut/Clips Studio (AGPL — SOLO patrón: agente+timeline, active-speaker) · Descript/Kapwing (REFERENCE UX de edición por texto).

**Verificación (salida del paso 2 del plan):** máster real de podcast → 10 piezas cortadas, visibles en el grafo, exportadas limpias.

---

## 4. DRESSER — decide CÓMO SE VE lo que quedó

**Propósito:** planes visuales, captions, X-rolls, QA del vestido. El módulo más nuevo.

**Herramientas internas (7):**
1. **Visual Director** — analiza la pieza (transcript, audio, escenas/rostros) y propone
   ghost events segmentados: "0:00–0:08 hook → X-roll titular", "0:14–0:22 habla de Tokio
   → b-roll". Cada propuesta es un nodo `proposed` con `purpose` explicado. Inputs:
   `Transcript + SceneMap + ClientProfile + EditGrammar + Platform → nodos proposed`.
   Botón "Explica esta decisión" en cada ghost event (ancla textual + regla + densidad).
2. **Visual Plan Settings** — densidad B-roll 3–6/min, tipos (Foto Ken Burns, Stock video),
   fuentes (cliente → stock → IA), X-roll on/off + familias, captions smart, grammar,
   [Revisar propuestas] / [Auto-aprobar todo].
3. **Asset Finder** — consulta → Pexels + Pixabay + biblioteca local en paralelo → grilla
   con previews y filtros (orientación/duración/licencia) → un clic adjunta con licencia registrada.
4. **Caption Engine** — layouts, estilos por Client Profile, karaoke word-level, safe areas,
   packs visuales; CaptionPolicy (incluye `preserve_existing`/`inserts_only` para videos ya subtitulados); render quemado o SRT/ASS.
5. **XR Studio** — elegir pack (`xr.vox-paper.v1`, `xr.glass-ui.v1`…), llenar parámetros,
   preview vivo, render. Template + parámetros + brand tokens; jamás inventado a ciegas.
6. **Timeline + QA** — capas visuales sobre el source map; self-eval pre-review (texto fuera
   de safe area, captions desincronizadas, huecos) → reporte.
7. **Handoff** — ver `docs/HANDOFF_UX.md`.

**Qué NO hace:** no reemplaza DaVinci (sin grading/multicam/mixing); no reinventa narrativa (eso es Canter); no depende de IA para todo (TYPO determinista, SRT no necesita LLM).

**Cómo:** Asset Sheet pipeline obligatorio (addendum §9); materialización por prioridad;
MPT adapter para stock/AI providers; XR Composer determinista FFmpeg/Remotion.

**Qué construir:** módulo dresser completo, VisualDirector job handler, asset finder service,
caption renderer, XR pack runtime (`packages/packs/`), handlers `dresser.plan_visual`,
`dresser.apply_batch`, `render.ken_burns`.

**Referencias:** **MoneyPrinterTurbo (ADAPT: material.py → Asset Finder)** · video-use
(MIT: análisis barato→caro, self-eval repair) · OpusClip Video Tools (MIT: template
catalogs, motion specs) · Creativly (MIT: tokens/scenes) · OpusClip catálogos ·
Freepik MCP (REFERENCE del ciclo search→generate→job→download — construir provider propio).

**Verificación (salida del paso 5):** 20 clips verticales → 20 MP4 terminados; el 19 falla, los otros 19 siguen; cache evita regenerar.

---

## 5. VISUAL LAB — search · generate · compare

**Propósito:** el taller de assets. Funciona integrado a Dresser Y de forma independiente (guarda en Client/Project/Global Library).

**Qué hace:** búsqueda paralela multi-provider (stock), Generation Space (prompt → Provider
Router → job → asset), **compare A/B** de variantes, **Import Result** (match por
`expectedFilename`), enhance providers (upscale, remove-bg, extend, variaciones) vía
`EnhancementProviderRegistry`, storyboard, history, strict free mode (sin fallback pagado
silencioso), Auto Model Selection explicable ("por qué elegí ComfyUI→Wan I2V").

**Qué NO hace:** no edita timeline; no decide dónde se usa el asset (eso es Dresser).

**Cómo:** Provider Registry por capabilities; Workflows de ComfyUI fuera del código
(`workflows/image/flux.json`, `workflows/video/wan_i2v.json` — sustitución solo de
prompt/seed/size/frames/input); NVIDIA NIM como provider de imagen/LLM/vision;
handoff manual siempre disponible (Modo A).

**Qué construir:** módulo visual-lab (SearchPanel, GenerateSpace, CompareView, ImportResult,
EnhancePanel), providers stock/ai/enhance, handlers `lab.search_stock`, `lab.generate`,
`lab.import_result`, `lab.enhance`.

**Referencias:** Freepik MCP + Freepik Spaces (REFERENCE UX) · Clarity Upscaler (REFERENCE
patrón multi-step) · MPT AI providers (ADAPT) · ComfyUI (local generation) · SUPIR ⛔ no comercial.

**Verificación (salida del paso 6):** BR07 con 8 opciones de stock; handoff a IA externa y retorno sin reconfigurar nada; upscale vía provider con confirmación de coste.

---

## 6. WORKFLOW STUDIO — la fábrica de recetas

**Propósito:** editor visual de nodos para construir/modificar recipes (ej. "Vertical Podcast": procesa 20 clips con un clic).

**Qué hace:** canvas XYFlow con catálogo — INPUT (video, script, cliente) · ANALYSIS
(transcript, escenas, rostros) · AI (imagen, video, TTS, LLM) · MEDIA (stock, trim,
stitch, upscale) · ABRAXAS (b-roll plan, x-roll, captions, add-to-graph) · LOGIC (Array,
Router, Conditional Switch, **Human Approval**, Retry) · OUTPUT (MP4, DaVinci, Delivery).
Un workflow publicado puede exponerse como REST/MCP interno.

**Qué NO hace:** no es n8n — sin Gmail, CRM, weather; orquesta producción audiovisual exclusivamente. El usuario cotidiano no lo abre: el recipe "Vertical Podcast" ya existe.

**Cómo:** el Production Graph sigue siendo la única verdad; el Studio orquesta jobs con `dependsOn`.

**Qué construir:** módulo workflow (canvas, node catalog, recipe runner), recipes como datos versionados, handler `workflow.run` con HITL checkpoints.

**Referencias:** **Node Banana (MIT, ADAPT+REUSE: nodos tipados, ejecución topológica, Array/Router/Switch, ComfyUI)** · XYFlow (MIT, INTEGRATE) · n8n/Langflow (REFERENCE: branching, retry, HITL) · Wireflow (REFERENCE workflow→API) · Vibe Workflow (REFERENCE UX; no su backend).

**Verificación (salida del paso 9):** recipe "Vertical Podcast" editable en canvas; HITL pausa un lote de 20 y espera tu decisión desde el teléfono.

---

## 7. REVIEW — feedback y aprobación (transversal)

**Propósito:** notas sobre cualquier cosa, comparación, aprobación.

**Qué hace:** notas con `targetRef` al objeto exacto del grafo (un corte, un b-roll, un
rango), comparación de versiones/carruseles, aprobación o "cambios solicitados" con
regeneración; el status de la pieza fluye `review → changes_requested → approved`.
Notas manuales y TXT/JSON exportables (como Review 05 ya hace). El companion PWA habla
los mismos contratos.

**Qué NO hace:** no reescribe Review 05 — se conecta por adapter; no inventa sincronización de iframe (lección del audit de tu repo).

**Qué construir:** módulo review desktop, Review Companion PWA (GitHub Pages) con canal de
comandos tipados (paso 4 del plan), handler `review.add_note`, `review.set_status`.

**Referencias:** **Abrxs-Review (REUSE — es tuyo; Drive token-flow readonly-first ya probado)**.

**Verificación (salida del paso 4):** desde el iPhone: ver un job corriendo, aprobar un checkpoint, dejar una nota en C07 — y el desktop lo aplica. Offline: comando en cola se ejecuta al reconectar.

---

## 8. DELIVERY — salida dual

**Propósito:** entregar el proyecto terminado en el formato que necesites.

**Qué hace (dos caminos por pieza):**
- **Render propio:** MP4 vestido y limpio (VideoFlow/Remotion/FFmpeg) con los assets ya adjuntos.
- **Kit de edición:** carpeta organizada con assets + FCPXML/EDL (DaVinci) + draft CapCut +
  SRT/ASS + **NlePlan compilado desde el grafo** + EDIT_PLAN.txt humano-legible + Edit
  Instruction Sheet consumible por agente MCP de DaVinci + **reference render** (proxy
  que muestra cómo debe quedar). Los assets ya fueron creados y descargados por la app antes — el finishing es solo montaje.
- Presets: FINAL SOCIAL (MP4+SRT) / CAPCUT HANDOFF / DAVINCI PRO (todo + NlePlan + ref render).
- Export con nombre versionado (FINAL_v3, nunca sobrescribir) + "re-exportar con último preset".
- **Reporte de provenance/licencias por export**: cada entrega lista todos los assets (fuente, URL, licencia, provider).

**Qué NO hace:** no publica en redes directamente (eso es n8n externo); no sustituye el finishing pro.

**Qué construir:** módulo delivery, compilador NlePlan, generadores FCPXML/EDL/CapCut draft,
handlers `delivery.render_piece`, `delivery.compile_kit`, `delivery.export_handoff_report`.

**Referencias:** Rescript (REFERENCE patrones FCPXML/AAF — ⛔ PolyForm, no copiar código) · DaVinci MCP docs (REFERENCE) · tu flujo actual EP55 (REFERENCE).

**Verificación (salida del paso 8):** video con captions quemados → inserts-only correcto; kit DaVinci abre y reproduce igual que el reference render.

---

## 9. CLIENTS — la identidad, global

**Propósito:** perfiles de marca que todos los módulos consumen.

**Qué hace:** brand (colores, fuentes, logos), glosario (Canter lo usa para corregir
transcripciones), reglas de captions/b-roll/x-roll, negative rules ("no inventar imagen
identificable del padre"), assets del cliente, asignación de EditGrammar. Import TXT →
IA → draft → diff → aplicar. Los colores/reglas condicionan Visual Director, Caption
Engine y XR Studio.

**Qué NO hace:** no guarda secretos (eso es Credential Store/Keychain).

**Qué construir:** módulo clients, ClientProfile schema (ya existe en Foundation como JSON schema), handler `clients.import_txt`.

**Referencias:** `docs/CLIENTS_AND_PROFILES.md` existente · editorial-os brands (tu propio patrón MCP `brand_*`).

**Verificación:** TXT desordenado de cliente → draft con confidence → diff visual → aplicar → Dresser usa los tokens sin reconfigurar.

---

## 10. LIBRARY

**Propósito:** assets (provenance + licencia + cache hash), templates, packs instalados (X-roll, motion, title, data), bins/folders/tags/ratings/labels.

**Qué NO hace:** no confunde assets de proyecto con de biblioteca global (3 niveles: Client/Project/Global).

**Qué construir:** módulo library, AssetStore binario con hashes, pack installer, vista grid/list con virtualización (500+ assets sin lag — requisito P0 de paridad).

**Referencias:** Foundation asset-manifest.v1 schema (REUSE) · OpusClip catalogs (ADAPT).

**Verificación:** importar 500 assets → scroll fluido; filtro por licencia/provider/pack.

---

## 11. ACTIVITY

**Propósito:** la cola de jobs global de toda la app + salud del sistema.

**Qué hace:** lista de jobs (progreso real, cancelar, reintentar, prioridad, dependsOn),
recuperación post-crash (running → interrupted con acciones Reanudar/Reiniciar), Doctor
(FFmpeg versión, GPU, disco, latencia de providers, ComfyUI alcanzable, estado de la DB,
tokens vencidos — semáforos), logs estructurados con rotación y visor.

**Qué NO hace:** no ejecuta jobs él mismo — muestra y controla el JobEngine del core.

**Qué construir:** módulo activity (JobList, JobDetail, DoctorPanel, LogViewer), watchdog
por tipo de job, circuit breaker por provider, preflight de disco.

**Referencias:** **JobEngine de Foundation (REUSE — ya es REAL)** · cola de Canter 3.8.1
(port elevado a core) · aPulse (REFERENCE health checks → Doctor).

**Verificación (salida del paso 1):** crear proyecto, lanzar job, matar la app a mitad, reabrir y recuperar — el test de crash pasa. Doctor muestra FFmpeg ✓, disco ✓, providers con latencia.

---

## Resumen: qué se copia de dónde (por estación)

| ESTACIÓN | REUSE (código) | ADAPT (patrón) | REFERENCE (estudio) |
|---|---|---|---|
| Shell | LiquidGlass, Lucide, Foundation shell | lazy-modules abraxas-os | Apple HIG |
| Hub | Foundation ProjectHub | — | — |
| Plan | — | Creativly beats | Remotion Vox videos |
| Canter | Abrxs-Canter (adapter) | — | Descript, CutScript (⚠ licencia) |
| Dresser | — | MPT material.py, OpusClip, video-use | Freepik MCP |
| Visual Lab | — | MPT AI providers | Freepik Spaces, Clarity |
| Workflow Studio | Node Banana, XYFlow | — | n8n, Langflow, Wireflow |
| Review | Abrxs-Review (adapter) | — | — |
| Delivery | — | — | Rescript ⛔ código, DaVinci docs |
| Clients | Foundation schemas | editorial-os brands | — |
| Library | Foundation asset-manifest | OpusClip catalogs | — |
| Activity | Foundation JobEngine | cola Canter 3.8.1 | aPulse |

Tabla completa con licencias y commits: `docs/SOURCES_AND_REUSE.md`.

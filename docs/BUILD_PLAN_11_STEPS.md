# ABRXSVAV — PLAN DE CONSTRUCCIÓN: 11 PASOS (0–10)

> Supersede `docs/DEVELOPMENT_ROADMAP.md` como orden de trabajo (aquel queda como
> referencia histórica de Foundation). Cada paso termina en una release utilizable —
> nunca en avances invisibles. ≈22 semanas a ritmo de sesiones con QA honesto.

## El ciclo canónico de cada paso

```
paso n
  ├─ git fetch → verificación de main y working tree limpio
  ├─ worktree/staging para cambios grandes (nunca tocar main directo)
  ├─ backup completo antes de: migraciones de DB, cambios de contracts
  ├─ implementar → tests → build
  ├─ npm run doctor pasa (versión, DB, FFmpeg, providers, disco)
  ├─ verificación vía ActionCatalog/MCP (vav_smoke por paso, ver MCP_INTEGRATION.md)
  ├─ QA del checklist de release (docs/UI_QA_CHECKLIST.md si toca UI)
  ├─ commit → tag → push
  ├─ release: PATCH ZIP + FULL ZIP (siempre ambos)
  ├─ changelog + bump de versión
  └─ docs/IMPLEMENTATION_STATUS.md actualizado: REAL / MOCK / PENDIENTE
```

Reglas de superficie: Desktop = repo + release instalada (updater en paso 10);
Companion PWA = "frontend publicado = fuente de verdad" (bump de Service Worker cache en
cada release); Contracts = inmutables salvo migración con backup + dry-run.

## ETAPA A — Fundación (≈3 semanas)

### Paso 0 — Repo + contratos + tokens (≈ esta entrega ya dejó la base)
**Se construye:** monorepo con branding AbrxsVAV, docs completos (addendum, stations,
contracts v2.2/2.3, MCP, handoff, nubes, canon UI, QA, sources), `packages/ui/tokens.css`
+ `materials.css`, CI verde, addendum en /docs.
**Salida verificable:** `npm run build` verde; contracts parsean; shell abre con nombre/
tema nuevos; `npm test` pasa.
**Estado:** ejecutado — ver `docs/IMPLEMENTATION_STATUS.md` §0.3.0.

### Paso 1 — Core desktop (el paso más importante del proyecto)
**Se construye:** integración del Lote 1 (contracts v2.3 TS, ProjectStore con escrituras
atómicas + WAL, JobEngine con fases + cache + watchdog, OperationLog undo/redo, Doctor v1,
Hub, Activity, Error Boundaries por módulo, autosave de sesión, virtualización de listas,
matriz de 11 estados en primitives, scaffold MCP con tools de diagnóstico), corpus
sintético como fixture de CI.
**Salida verificable:** crear proyecto, lanzar job, matar la app a mitad, reabrir y
recuperar — **el test de crash pasa**. `vav_status`/`vav_doctor` responden por MCP.
**Prohibido:** providers de IA antes de este paso completo.

## ETAPA B — Producción + Companion (≈5 semanas)

### Paso 2 — Canter integrado
Adapter al motor 3.8.1, estación funcional (ingest → transcript → fichas → cortes),
MediaService por rangos, confirmación manual de límites.
**Salida:** máster real de podcast → 10 piezas en el grafo, exportadas limpias.

### Paso 3 — Vistas compartidas
Lista, Kanban, Mapa (XYFlow); seleccionar pieza reinicia rango en visor.
**Salida:** mover pieza en Kanban cambia su status en el grafo; Mapa muestra master→piezas.

### Paso 4 — Companion PWA v1 (GitHub Pages)
Estado de jobs en vivo, lista de piezas, notas con targetRef, aprobaciones, HITL
checkpoints, envío de comandos. Canal local (pareo por token) + relay Supabase
(`vav_state` + `vav_commands`, workspace `abrxs-vav`).
**Salida:** desde el iPhone: ver un job, aprobar un checkpoint, dejar nota en C07 — y el
desktop lo aplica. Offline: comando en cola se ejecuta al reconectar.
**Por qué va antes de Dresser:** cuando llegue el primer batch de 20 videos ya apruebas desde el teléfono.

## ETAPA C — Dressing y generación (≈10 semanas)

### Paso 5 — Dresser MVP = Batch B-roll
Ghost events del Visual Director (densidad configurable), Asset Finder (cliente→stock→IA),
Ken Burns, captions básicos, FFmpeg, auto-approve opcional, Import Result v1.
**Salida:** 20 clips verticales → 20 MP4; el 19 falla, los otros 19 siguen; cache evita regenerar.

### Paso 6 — Visual Lab MVP
Search paralelo (patrón MPT), Generation Space, compare A/B, Import Result completo,
handoff UX completa (ver HANDOFF_UX.md), enhance providers, strict free mode.
**Salida:** BR07 con 8 opciones de stock; handoff a IA externa y retorno sin reconfigurar.

### Paso 7 — XR Composer + familias canon R6
TYPO, PHOTOS, OBJECTS, PHOTO_OBJECT, COMIC_INFO; variants; deliverable levels; MPT service
adapter (material/voice/subtitle/video).
**Salida:** XR03 Amanda: 1 máster + 5 estados FFmpeg → FINAL; editar timing no re-llama
IA; TYPO 100% determinista.

### Paso 8 — Captions scene-aware + Delivery compile
Caption policies (preserve_existing / inserts_only), SFX registry semántico, NlePlan desde
el grafo, EDIT_PLAN.txt, kits DaVinci/CapCut, reference render, reporte de provenance/licencias.
**Salida:** video con captions quemados → inserts-only correcto; kit DaVinci abre y reproduce igual que el reference render.

## ETAPA D — Automatización y cierre (≈4 semanas)

### Paso 9 — Workflow Studio + Review desktop
XYFlow: Array/Router/Switch/Retry/Human Approval; Review desktop completo con compare de
versiones; companion sync.
**Salida:** recipe "Vertical Podcast" editable en canvas; HITL pausa un lote de 20 y
espera tu decisión desde el teléfono.

### Paso 10 — Faceless Mode + cierre
Receta completa script→video (produciendo proyecto con Production Graph), Browser Adapter
(plugin aislado Playwright), updater, workspaces de layout, project templates, i18n
scaffold, galería /design, visual regression en CI.
**Salida:** script → video faceless completo vía receta; un browser adapter que falla no toca nada más.

## Presupuestos de rendimiento (medibles, publicados en IMPLEMENTATION_STATUS)

- Shell interactivo < 2 s · cambio de módulo < 300 ms
- Scrub de proxy 1080p a 60 fps · interacción de timeline < 16 ms/frame
- Virtualización: 500+ assets sin lag

## Qué NO entra (evitar bloat)

Multicam, color grading completo, mezcla de audio profesional, marketplace público de
plugins, edición no-lineal completa, publicación directa en redes (va por n8n externo).

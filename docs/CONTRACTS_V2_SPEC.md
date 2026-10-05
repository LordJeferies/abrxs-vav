# ABRXSVAV — CONTRATOS v2.2 + v2.3 (delta sobre Foundation)

> Este documento es la fuente de la implementación de `@abraxas/contracts` en el paso 1.
> El starter Foundation ya trae contratos base (Master, Transcript, Piece, SourceSegment,
> Asset, Job, OperationEvent, Note, ProductionGraph v2 — ver `contracts/*.schema.json`).
> Este delta **agrega/reemplaza** para llegar a v2.3. Reglas: tiempo = frames (out
> exclusivo); ningún módulo define sus propios tipos; los IDs internos `@abraxas` no cambian.

```typescript
/* ═══ ABRXSVAV v2.2 — XR canon + MPT engine + batch B-roll ═══ */

// Estados de producción XR (canon R6.1)
export const XrProductionState = z.enum([
  "beta",       // propuesto por el sistema
  "alfa",       // aprobado editorialmente, sin assets aún
  "generated",  // assets/render listos
  "approved",   // revisado y aprobado
  "omega",      // compuesto en la pieza / entregado
]);

// Nivel de entregable (equivale a los "stop-at" de MPT)
export const DeliverableLevel = z.enum(["assets_only", "preview", "final"]);

// Política de captions (incluye videos con captions quemados)
export const CaptionPolicy = z.enum([
  "full", "none", "preserve_existing", "inserts_only", "smart",
]);

// ── Materialization: el QUÉ separado del CÓMO ──────────────────────────
export const MaterializationMode = z.enum([
  "local",            // ComfyUI / Remotion / VideoFlow / FFmpeg
  "native_api",       // provider con API (Kling, Pexels, NVIDIA NIM…)
  "tool_api",         // MCP / tool externa
  "browser_adapter",  // Playwright — plugin opcional, jamás core
  "manual_handoff",   // paquete para IA externa o humano
]);

export const MaterializationStrategy = z.object({
  mode: MaterializationMode,
  providerId: Id.nullable().default(null),
  adapterId:  Id.nullable().default(null),
  engineId:   Id.nullable().default(null),
  params: z.record(z.unknown()).default({}),
  fallbacks: z.array(MaterializationMode).default([]), // orden de degradación
});

// ── Slot de asset — la unidad del Asset Plan ───────────────────────────
export const AssetSlot = z.object({
  id: Id,                                   // "A01"
  type: z.enum(["image","video","master_image","object","audio"]),
  sourcePolicy: z.enum(["client_first","stock_first","ai_first","frame_grab","any"])
    .default("any"),
  prompt: z.string().nullable().default(null),
  stockQuery: z.string().nullable().default(null),
  negative: z.string().default(""),
  resolvedAssetId: Id.nullable().default(null),
  source: z.enum(["client","stock","ai_image","ai_video","frame_grab","upload"])
    .nullable().default(null),
  status: z.enum(["pending","resolved","failed"]).default("pending"),
});

// ── Familia XR como plugin (canon R6 → registry) ───────────────────────
export const XrFamilyDefinition = z.object({
  id: Id,                                    // "xroll.comic-info@1.2.0"
  family: z.string(),                        // "COMIC_INFO"
  version: z.string(),
  durationSec: z.object({ min: z.number(), max: z.number() }),
  assetSlots: z.array(AssetSlot.pick({ id:true, type:true, sourcePolicy:true,
    prompt:true, stockQuery:true, negative:true })),
  states: z.array(z.object({
    id: Id,                                  // "S01"
    assetRefs: z.array(Id),
    cameraMove: z.string().default("cut"),   // "push_in","pan_ll_lr","full"…
    durationFrames: Frame,
  })),
  captionPolicy: CaptionPolicy.default("none"),
  sfxRoles: z.array(z.string()).default([]), // ["transition.whoosh"] (rol semántico)
  requires: z.array(z.string()).default(["renderer.remotion"]),
});

// ── VisualPlanItem v3 — unifica B-roll simple y X-roll complejo ────────
export const VisualPlanItemV3 = z.object({
  id: Id,
  pieceId: Id,
  kind: z.enum(["b_roll","x_roll","caption","sfx","graphic","title"]),
  range: TimeRange,                          // en timeline EDITADO de la pieza
  purpose: z.string().default(""),           // POR QUÉ existe (función > cuota)
  anchorText: z.string().nullable().default(null),

  // B-roll simple
  brollType: z.enum([
    "photo","photo_ken_burns","stock_video","ai_video","sequence",
    "screenshot","document","data_support",
  ]).nullable().default(null),

  // X-roll (canon R6)
  familyId: Id.nullable().default(null),
  productionState: XrProductionState.nullable().default(null),

  // Asset Plan (compartido por ambos)
  assetSlots: z.array(AssetSlot).default([]),

  // Materialización + entregable + variantes
  materialization: MaterializationStrategy,
  deliverable: DeliverableLevel.default("final"),
  variants: z.array(z.object({
    id: Id, label: z.string(),
    assetRefs: z.array(Id),
    status: z.enum(["pending","approved","rejected"]).default("pending"),
  })).default([]),

  continuityGroup: Id.nullable().default(null),
  startFrameAssetId: Id.nullable().default(null), // imagen inicio (i2v)
  endFrameAssetId:   Id.nullable().default(null), // imagen fin (i2v)
  status: z.enum(["proposed","approved","materializing","generated","rejected"])
    .default("proposed"),
});

// ── EditGrammar — estilos de edición como dato ─────────────────────────
export const EditGrammar = z.object({
  id: Id,                                    // "grammar.editorial-documentary.v1"
  label: z.string(),
  rules: z.object({
    cutPacing: z.enum(["slow","measured","fast","beat_synced"]).default("measured"),
    maxStaticSeconds: z.number().default(6),
    brollDensityPerMin: z.tuple([z.number(), z.number()]).default([3, 6]),
    xrCadencePerMin: z.number().default(0.2),   // ≈1 cada 5 min
    functionOverQuota: z.literal(true).default(true),
  }),
  clientProfileId: Id.nullable().default(null),
});

// ── ContinuityGroup — coherencia entre generaciones ────────────────────
export const ContinuityGroup = z.object({
  id: Id,
  kind: z.enum(["character","style","location","sequence"]),
  label: z.string(),
  referenceAssetIds: z.array(Id).default([]),
  seedLock: z.string().nullable().default(null),
});

// ── HandoffPackage — para IA externa (Modo A) o humano ─────────────────
export const HandoffPackage = z.object({
  id: Id,
  targetKind: z.enum(["visual_item","asset_slot","piece"]),
  targetRef: Id,
  providerHint: z.string().default(""),       // "kling" | "veo" | "runway" | "generic"…
  prompt: z.string(),
  negative: z.string().default(""),
  outputSpec: z.object({
    aspectRatio: z.string().default("9:16"),
    durationSec: z.number().nullable().default(null),
    fps: z.number().nullable().default(null),
    motionDescription: z.string().default(""),
  }),
  referenceAssetIds: z.array(Id).default([]),
  startFrameAssetId: Id.nullable().default(null),
  endFrameAssetId: Id.nullable().default(null),
  expectedFilename: z.string(),               // "BR03_tokyo-night.mp4" — clave del retorno
  returnInstructions: z.string().default(""),
  createdAt: IsoDate,
});

// Import Result: matchea lo que vuelve por expectedFilename y sabe qué evento era
export const ImportResult = z.object({
  id: Id,
  packageId: Id.nullable().default(null),     // si se identificó el handoff
  expectedFilename: z.string(),
  matchedTargetRef: Id.nullable().default(null),
  matchConfidence: z.number().min(0).max(1).default(0),
  resolvedAssetId: Id.nullable().default(null),
  status: z.enum(["matched","ambiguous","unmatched","attached"]),
});

// ── NlePlan — SIEMPRE compilado desde el Production Graph ──────────────
export const NlePlan = z.object({
  id: Id,
  pieceId: Id,
  target: z.enum(["davinci_fcpxml","davinci_edl","capcut_draft","edit_plan_txt"]),
  tracks: z.array(z.object({
    id: Id,
    kind: z.enum(["base","b_roll","x_roll","caption","sfx","title"]),
    events: z.array(z.object({
      range: TimeRange,                       // timeline editado
      assetUri: z.string().nullable(),
      sourceMap: z.array(SourceSegment).default([]),
      transform: z.record(z.unknown()).default({}),
      instructions: z.string().default(""),   // texto para humano o agente MCP
    })),
  })),
  referenceRenderUri: z.string().nullable().default(null),
  compiledAt: IsoDate,
});

// ═══ ABRXSVAV v2.3 — MCP-first + provenance de prompts ═════════════════

// PromptRecord: todo prompt de IA queda versionado con su job
export const PromptRecord = z.object({
  id: Id,
  jobId: Id,
  capability: z.string(),                     // "image.generate","llm.complete"…
  providerId: Id.nullable().default(null),
  prompt: z.string(),
  negative: z.string().default(""),
  params: z.record(z.unknown()).default({}),  // seed, size, model…
  createdAt: IsoDate,
});

// ActionCatalog: la única lista de acciones del sistema (→ MCP / PWA / tests)
export const ActionDefinition = z.object({
  name: z.string(),                           // "vav.create_project" (dotted, vav.*)
  module: z.string(),                         // "hub","canter","dresser"…
  summary: z.string(),
  inputSchema: z.record(z.unknown()),         // JSON Schema (derivado de Zod)
  outputSchema: z.record(z.unknown()).default({}),
  destructive: z.boolean().default(false),    // ⇒ exige confirm:true
  requiresOpenProject: z.boolean().default(true),
  minRole: z.enum(["local","companion","mcp"]).default("mcp"), // visibilidad
  since: z.string(),                          // versión de contracts que la introdujo
});

// Job v2 (extiende el Job de Foundation): fases + cache + variante
export const JobPhase = z.enum([
  "queued","downloading","analyzing","generating","composing","rendering",
  "uploading","done",
]);
export const CacheKey = z.object({
  fingerprint: z.string(),   // hash(prompt+model+seed+params+inputs)
  scope: z.enum(["job","project","global"]).default("job"),
});
```

## Notas de migración respecto a Foundation

1. Foundation guarda graph v2 con JSON Schemas (`contracts/*.schema.json`) + generador de
   validadores runtime. El delta v2.2/v2.3 se integra **en dos capas**: (a) schemas JSON
   nuevos para `visual-item`, `xr-family`, `handoff-package`, `nle-plan`; (b) tipos TS/Zod
   en `packages/contracts`. `scripts/generate-contracts.ts --check` debe seguir pasando.
2. El `Piece` de Foundation aún no tiene sourceMap multi-segmento: el contrato
   `SourceSegment[]` del delta es aditivo (el fixture roundtrip Alfa→graph→Alfa del
   `OWN_REPOS_AUDIT.md` sigue siendo requisito previo a multi-piece).
3. Escrituras de nube (companion): toda mutación del payload `vav.v1` lleva
   `expectedRevision` (CAS contra `vav_state.revision`) — igual que editorial-os.
4. Regla de oro de acciones: si una feature no expone su acción en `ActionCatalog`, no
   está terminada (Definition of Done del AGENTS.md se actualiza con esto).

## Qué se considera "contrato" y qué no

- **Contrato** (versión inmutable, migración con backup + dry-run): schemas, ActionCatalog,
  formatos graph v2/vav.v1.
- **No contrato**: presets de UI, textos de prompts del Visual Director (son PromptRecords
  versionados, pero su texto puede evolucionar sin bump de schema).

## Delta v2.5 (0.5.1) — MEDIA CORE: Piece, MediaSource, Job target

Implementado en `packages/contracts/src/index.ts` + `time.ts`. Delta **aditivo** sobre
v2.4; JSON Schemas generados en `contracts/piece.v1.schema.json` y
`contracts/media-source.v1.schema.json` (job.v2 actualizado). Tiempo canónico = frames
enteros out-exclusivos con timebase racional; helpers oficiales en `time.ts`
(`framesToSeconds`, `secondsToFrames`, `framesToTimecode`, `timecodeToFrames`, drop-frame
SMPTE para 30000/1001 y 60000/1001). Ningún módulo define sus propios tipos de tiempo.

```typescript
// MediaSource: átomo de ingest (ref opaca — los detalles de FFmpeg viven en la frontera)
export const mediaSourceSchema = z.strictObject({
  schemaVersion: z.literal('abrxs.media-source.v1'),
  id, kind: ['master','proxy','audio','image','video','generated_video','final_render'],
  ref, hash?, hashAlgorithm?: ['sha256'], durationFrames?, timebase?,
  width?, height?, codec?, audio? {present, channels?, sampleRate?},
  proxyRef?, waveformRef?, filmstripRef?, extensions?
}).refine(m => durationFrames>0 ⇒ timebase presente);

// Piece: pieza individual derivada (clips verticales/horizontales, segmentos, batch)
export const pieceSchema = z.strictObject({
  schemaVersion: z.literal('abrxs.piece.v1'),
  id, label, projectId,          // relación con el Production Graph
  sourceRef,                     // id de MediaSource
  sourceRange {startFrame, endFrame},  // out-exclusivo, frames de LA FUENTE
  status: ['draft','cutting','ready','review','approved','exported','failed'],
  transcriptRef?, outputRefs[], eventRefs[],  // eventos del grafo que cubre
  provenance {createdFrom: ['manual_cut','auto_segment','visual_plan','import','generation','unknown'], createdAt, note?},
  extensions?
});

// Job v2 extendido (opcional ⇒ compatible con jobs en disco)
target: { kind: ['project','piece','event','asset','media_source'], ref }
payload?: Record<string, unknown>
// Regla: un job NUNCA resuelve "el primer evento compatible" cuando declara target.
// Sin target, el job es sobre el proyecto completo (legado). El target entra en el
// fingerprint de idempotencia SOLO cuando el caller lo pasa explícitamente: sin
// options el fingerprint es EXACTAMENTE el legacy {kind,revision,content}, así que
// los jobs persistidos antes de 0.5.1 siguen deduplicando tras actualizar.
```

Notas de migración v2.5: (1) los jobs `abraxas.job.v2` existentes siguen válidos sin
`target`/`payload`; (2) `versions`: `ABRXS_VERSION` (`packages/contracts/src/version.ts`)
es la única fuente de versión del producto — los manifests, Tauri, health, Doctor y MCP
se alinean a ella y `tests/version.test.ts` verifica la consistencia; (3) el wire de
`media.ts` (canter/dresser) DEBE usar estos contratos con frames canónicos, no segundos.

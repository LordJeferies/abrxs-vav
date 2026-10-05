import { z } from 'zod';
export const timebaseSchema = z.strictObject({ fpsNumerator: z.number().int().positive(), fpsDenominator: z.number().int().positive() });
export const eventSchema = z.strictObject({
  id: z.string().min(1).max(120), label: z.string().trim().min(1).max(160).optional(), kind: z.enum(['a_roll','b_roll','xr','image','motion','sfx','music','caption','vo','transition','note']),
  startFrame: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), endFrame: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  status: z.enum(['ghost','planned','creating','ready','review','approved','failed']),
  visualTypeId: z.string().optional(), assetRefs: z.array(z.string()).optional(), extensions: z.record(z.string(), z.unknown()).optional()
}).refine(e => e.endFrame > e.startFrame, { message: 'El final debe ser posterior al inicio.', path: ['endFrame'] });
export const graphSchema = z.strictObject({
  schemaVersion: z.literal('abraxas.production-graph.v2'), projectId: z.string().min(1), timebase: timebaseSchema, events: z.array(eventSchema)
}).refine(g => new Set(g.events.map(e => e.id)).size === g.events.length, { message: 'Los IDs de eventos deben ser únicos.', path: ['events'] });
export type Timebase = z.infer<typeof timebaseSchema>;
export type ProductionEvent = z.infer<typeof eventSchema>;
export type ProductionGraph = z.infer<typeof graphSchema>;
export type ProductionEventKind = ProductionEvent['kind'];
export const projectContentSchema = z.strictObject({ name: z.string().trim().min(1).max(160), graph: graphSchema });
export type ProjectContent = z.infer<typeof projectContentSchema>;
export const operationSchema = z.strictObject({ id:z.string(), label:z.string(), timestamp:z.string(), before:projectContentSchema, after:projectContentSchema });
export const projectSchema = z.strictObject({
  schemaVersion:z.literal('abraxas.project.v1'), id:z.string().uuid(), revision:z.number().int().nonnegative(), createdAt:z.string(), updatedAt:z.string(), content:projectContentSchema,
  history:z.strictObject({ undo:z.array(operationSchema).max(100), redo:z.array(operationSchema).max(100) })
}).refine(p => p.id === p.content.graph.projectId && [...p.history.undo, ...p.history.redo].every(o => o.before.graph.projectId === p.id && o.after.graph.projectId === p.id), {message:'El graph y su historial deben pertenecer al proyecto.'});
export type Project = z.infer<typeof projectSchema>;
/* v2.5 (0.5.1): objetivo explícito del job — qué procesa, nunca "el primer evento compatible". */
export const jobTargetKindSchema = z.enum(['project','piece','event','asset','media_source']);
export type JobTargetKind = z.infer<typeof jobTargetKindSchema>;
export const jobTargetSchema = z.strictObject({ kind: jobTargetKindSchema, ref: z.string().min(1) });
export type JobTarget = z.infer<typeof jobTargetSchema>;
export const jobPayloadSchema = z.record(z.string(), z.unknown());
export type JobPayload = z.infer<typeof jobPayloadSchema>;
/** Target por defecto de un job legado sin target: el proyecto completo. */
export const defaultJobTarget = (projectId:string):JobTarget => ({ kind:'project', ref:projectId });

export const jobSchema = z.strictObject({
  schemaVersion:z.literal('abraxas.job.v2'), id:z.string().uuid(), projectId:z.string().uuid(), kind:z.string(), handler:z.string(), status:z.enum(['queued','running','completed','failed','cancelled']),
  inputFingerprint:z.string(), input:projectContentSchema, sourceRevision:z.number().int().nonnegative(), progress:z.number().min(0).max(1), attempt:z.number().int().nonnegative(), maxAttempts:z.number().int().positive(),
  createdAt:z.string(), updatedAt:z.string(), error:z.string().optional(), output:z.string().optional(), interrupted:z.boolean().optional(),
  target:jobTargetSchema.optional(), payload:jobPayloadSchema.optional()
});
export type Job = z.infer<typeof jobSchema>;

/* ═══ ABRXSVAV v2.3 — XR canon + materialización + handoff + ActionCatalog ═══
   Delta aditivo sobre project v1/job v2 (ver docs/CONTRACTS_V2_SPEC.md).
   Tiempo canónico = frames (out exclusivo). Ningún módulo define sus propios tipos. */

export const materializationModeSchema = z.enum(['local','native_api','tool_api','browser_adapter','manual_handoff']);
export type MaterializationMode = z.infer<typeof materializationModeSchema>;
export const materializationStrategySchema = z.strictObject({
  mode: materializationModeSchema,
  providerId: z.string().optional(),
  adapterId: z.string().optional(),
  engineId: z.string().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
  fallbacks: z.array(materializationModeSchema).default([]) // orden de degradación: local→api→tool→browser→manual
});
export type MaterializationStrategy = z.infer<typeof materializationStrategySchema>;

export const xrProductionStateSchema = z.enum(['beta','alfa','generated','approved','omega']);
export const deliverableLevelSchema = z.enum(['assets_only','preview','final']);
export const captionPolicySchema = z.enum(['full','none','preserve_existing','inserts_only','smart']);

export const assetSlotSchema = z.strictObject({
  id: z.string().min(1), // "A01"
  type: z.enum(['image','video','master_image','object','audio']),
  sourcePolicy: z.enum(['client_first','stock_first','ai_first','frame_grab','any']).default('any'),
  prompt: z.string().optional(),
  stockQuery: z.string().optional(),
  negative: z.string().default(''),
  resolvedAssetId: z.string().optional(),
  source: z.enum(['client','stock','ai_image','ai_video','frame_grab','upload']).optional(),
  status: z.enum(['pending','resolved','failed']).default('pending')
});
export type AssetSlot = z.infer<typeof assetSlotSchema>;

export const visualPlanItemSchema = z.strictObject({
  id: z.string().min(1), pieceId: z.string().optional(),
  kind: z.enum(['b_roll','x_roll','caption','sfx','graphic','title']),
  startFrame: z.number().int().nonnegative(), endFrame: z.number().int().positive(),
  purpose: z.string().default(''), // POR QUÉ existe (función narrativa > cuota)
  anchorText: z.string().optional(),
  brollType: z.enum(['photo','photo_ken_burns','stock_video','ai_video','sequence','screenshot','document','data_support']).optional(),
  familyId: z.string().optional(), // "xroll.comic-info@1.2.0"
  productionState: xrProductionStateSchema.optional(),
  assetSlots: z.array(assetSlotSchema).default([]),
  materialization: materializationStrategySchema,
  deliverable: deliverableLevelSchema.default('final'),
  variants: z.array(z.strictObject({ id: z.string(), label: z.string(), assetRefs: z.array(z.string()).default([]), status: z.enum(['pending','approved','rejected']).default('pending') })).default([]),
  continuityGroup: z.string().optional(),
  startFrameAssetId: z.string().optional(),
  endFrameAssetId: z.string().optional(),
  status: z.enum(['proposed','approved','materializing','generated','rejected']).default('proposed')
}).refine(v => v.endFrame > v.startFrame, { message: 'El final debe ser posterior al inicio.', path: ['endFrame'] });
export type VisualPlanItem = z.infer<typeof visualPlanItemSchema>;

export const xrFamilyDefinitionSchema = z.strictObject({
  id: z.string().min(1), family: z.string().min(1), version: z.string().min(1),
  durationSec: z.strictObject({ min: z.number(), max: z.number() }),
  assetSlots: z.array(assetSlotSchema).default([]),
  states: z.array(z.strictObject({ id: z.string(), assetRefs: z.array(z.string()).default([]), cameraMove: z.string().default('cut'), durationFrames: z.number().int().positive() })).default([]),
  captionPolicy: captionPolicySchema.default('none'),
  sfxRoles: z.array(z.string()).default([]),
  requires: z.array(z.string()).default([])
});
export type XrFamilyDefinition = z.infer<typeof xrFamilyDefinitionSchema>;

export const editGrammarSchema = z.strictObject({
  id: z.string().min(1), label: z.string().min(1),
  rules: z.strictObject({
    cutPacing: z.enum(['slow','measured','fast','beat_synced']).default('measured'),
    maxStaticSeconds: z.number().default(6),
    brollDensityPerMin: z.tuple([z.number(), z.number()]).default([3, 6]),
    xrCadencePerMin: z.number().default(0.2),
    functionOverQuota: z.literal(true).default(true)
  })
});
export type EditGrammar = z.infer<typeof editGrammarSchema>;

export const handoffPackageSchema = z.strictObject({
  id: z.string().min(1),
  targetKind: z.enum(['visual_item','asset_slot','piece']), targetRef: z.string().min(1),
  providerHint: z.string().default(''),
  prompt: z.string().min(1), negative: z.string().default(''),
  outputSpec: z.strictObject({ aspectRatio: z.string().default('9:16'), durationSec: z.number().optional(), fps: z.number().optional(), motionDescription: z.string().default('') }).prefault({}),
  referenceAssetIds: z.array(z.string()).default([]),
  startFrameAssetId: z.string().optional(), endFrameAssetId: z.string().optional(),
  expectedFilename: z.string().min(1), // clave del Import Result
  returnInstructions: z.string().default(''),
  createdAt: z.string()
});
export type HandoffPackage = z.infer<typeof handoffPackageSchema>;

export const importResultSchema = z.strictObject({
  id: z.string().min(1), packageId: z.string().optional(),
  expectedFilename: z.string(), matchedTargetRef: z.string().optional(),
  matchConfidence: z.number().min(0).max(1).default(0),
  resolvedAssetId: z.string().optional(),
  status: z.enum(['matched','ambiguous','unmatched','attached'])
});
export type ImportResult = z.infer<typeof importResultSchema>;

export const promptRecordSchema = z.strictObject({
  id: z.string().min(1), jobId: z.string().min(1), capability: z.string(),
  providerId: z.string().optional(), prompt: z.string(), negative: z.string().default(''),
  params: z.record(z.string(), z.unknown()).default({}), createdAt: z.string()
});
export type PromptRecord = z.infer<typeof promptRecordSchema>;

/** Acción del ActionCatalog: la única lista de acciones del sistema → UI / companion / MCP / tests. */
export const actionDefinitionSchema = z.strictObject({
  name: z.string().regex(/^vav\.[a-z][a-zA-Z.]*$/), // "vav.projects.create"
  module: z.string(), summary: z.string(),
  method: z.enum(['GET','POST','PUT']),
  path: z.string(), // ruta del servicio local
  destructive: z.boolean().default(false), // ⇒ exige confirm:true en MCP
  requiresOpenProject: z.boolean().default(false),
  since: z.string()
});
export type ActionDefinition = z.infer<typeof actionDefinitionSchema>;

/* ═══ ABRXSVAV v2.4 — CLIENT PROFILES + config resuelta (Dresser runtime) ═══
   Cadena de resolución: SYSTEM → CLIENT → PROJECT → VIDEO → EVENT (gana la más
   específica). Tokens de marca ($colors.accent) para que cambiar un color no toque
   presets. Fuente: análisis modular de Dresser (docs/DRESSER_RUNTIME.md). */

export const sourcePrioritySchema = z.array(z.enum(['client','frame_grab','stock','ai_image','ai_video'])).default(['client','frame_grab','stock','ai_image','ai_video']);
export const clientProfileSchema = z.strictObject({
  schemaVersion: z.literal('abrxs.client-profile.v1'),
  clientId: z.string().min(1),
  name: z.string().min(1),
  brand: z.strictObject({
    colors: z.record(z.string(), z.string()).default({}),        // primary/accent/text…
    fonts: z.record(z.string(), z.string()).default({})          // primary→font.montserrat
  }).prefault({}),
  captions: z.strictObject({ preset: z.string().default('caption.amanda.vertical.v1'), highlightColor: z.string().default('$colors.accent') }).prefault({}),
  broll: z.strictObject({ preset: z.string().default('documentary_clean'), density: z.enum(['low','medium','high']).default('medium'), sourcePriority: sourcePrioritySchema }).prefault({}),
  xroll: z.strictObject({ density: z.enum(['off','low','medium']).default('low'), allowed: z.array(z.string()).default([]) }).prefault({}),
  sfx: z.strictObject({ preset: z.string().default('subtle') }).prefault({}),
  glossary: z.array(z.strictObject({ term: z.string(), canonical: z.string().optional(), dontTranslate: z.boolean().default(false) })).default([]),
  negativeRules: z.array(z.string()).default([]),                // "no estética futurista"
  editorialRules: z.array(z.string()).default([]),               // "no B-roll en los primeros 3s"
  platformProfiles: z.record(z.string(), z.record(z.string(), z.unknown())).default({}), // instagram: {captionDensity:'high'}
  createdAt: z.string().optional(), updatedAt: z.string().optional()
});
export type ClientProfile = z.infer<typeof clientProfileSchema>;

/** Entrada de la config resuelta: cada valor sabe DE DÓNDE vino (View Resolved Config). */
export const resolvedEntrySchema = z.strictObject({ key: z.string(), value: z.unknown(), source: z.enum(['system','client','project','video','event']) });
export type ResolvedEntry = z.infer<typeof resolvedEntrySchema>;
export const resolvedConfigSchema = z.strictObject({
  clientId: z.string().nullable(), entries: z.array(resolvedEntrySchema)
});
export type ResolvedConfig = z.infer<typeof resolvedConfigSchema>;

/* ═══ ABRXSVAV v2.5 — MEDIA CORE: MediaSource + Piece + Job target (0.5.1) ═══
   Delta aditivo (REQUISITOS A6: separar PROYECTO de PIEZAS). Tiempo canónico =
   frames enteros out-exclusivo con timebase racional; helpers en ./time.
   Ningún detalle de FFmpeg entra en estos contratos: las rutas/refs son opacas. */

export * from './time';
export * from './version';

export const mediaSourceKindSchema = z.enum(['master','proxy','audio','image','video','generated_video','final_render']);
export type MediaSourceKind = z.infer<typeof mediaSourceKindSchema>;

/** Pista de audio declarada (presencia + datos conocidos; nunca decodificamos aquí). */
export const audioTrackSchema = z.strictObject({
  present: z.boolean(),
  channels: z.number().int().positive().optional(),
  sampleRate: z.number().int().positive().optional()
});
export type AudioTrack = z.infer<typeof audioTrackSchema>;

/** Fuente de medios: el átomo de ingest de Canter/dresser. ref = ruta o URI opaca. */
export const mediaSourceSchema = z.strictObject({
  schemaVersion: z.literal('abrxs.media-source.v1'),
  id: z.string().min(1).max(120),
  kind: mediaSourceKindSchema,
  ref: z.string().min(1),
  hash: z.string().min(8).max(128).optional(),
  hashAlgorithm: z.enum(['sha256']).optional(),
  durationFrames: z.number().int().nonnegative().optional(),
  timebase: timebaseSchema.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  codec: z.string().min(1).optional(),
  audio: audioTrackSchema.optional(),
  proxyRef: z.string().optional(),
  waveformRef: z.string().optional(),
  filmstripRef: z.string().optional(),
  extensions: z.record(z.string(), z.unknown()).optional()
}).refine(m => m.durationFrames==null||m.durationFrames===0||!!m.timebase, { message: 'durationFrames requiere timebase racional.', path: ['timebase'] });
export type MediaSource = z.infer<typeof mediaSourceSchema>;

export const pieceStatusSchema = z.enum(['draft','cutting','ready','review','approved','exported','failed']);
export type PieceStatus = z.infer<typeof pieceStatusSchema>;

/** Rango sobre una fuente, en frames out-exclusivos de SU timebase. */
export const frameRangeSchema = z.strictObject({
  startFrame: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  endFrame: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
}).refine(r => r.endFrame > r.startFrame, { message: 'El final debe ser posterior al inicio.', path: ['endFrame'] });
export type FrameRange = z.infer<typeof frameRangeSchema>;

/** Procedencia mínima: cómo nació la pieza y cuándo (AGENTS §8: todo asset con provenance). */
export const pieceProvenanceSchema = z.strictObject({
  createdFrom: z.enum(['manual_cut','auto_segment','visual_plan','import','generation','unknown']),
  createdAt: z.string(),
  note: z.string().optional()
});
export type PieceProvenance = z.infer<typeof pieceProvenanceSchema>;

/** Pieza individual derivada de una fuente: clip vertical/horizontal, segmento,
    material derivado o miembro de un batch futuro. No reemplaza al Production
    Graph: le pertenece por projectId y lo referencia por eventRefs. */
export const pieceSchema = z.strictObject({
  schemaVersion: z.literal('abrxs.piece.v1'),
  id: z.string().min(1).max(120),            // "C01", "P07"…
  label: z.string().trim().min(1).max(160),
  projectId: z.string().min(1),              // pertenencia al Production Graph
  sourceRef: z.string().min(1),              // id de una MediaSource
  sourceRange: frameRangeSchema,
  status: pieceStatusSchema.default('draft'),
  transcriptRef: z.string().optional(),
  outputRefs: z.array(z.string()).default([]), // renders/exports de la pieza
  eventRefs: z.array(z.string()).default([]),  // eventos del grafo que cubre
  provenance: pieceProvenanceSchema,
  extensions: z.record(z.string(), z.unknown()).optional()
});
export type Piece = z.infer<typeof pieceSchema>;

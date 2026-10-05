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
export const jobSchema = z.strictObject({
  schemaVersion:z.literal('abraxas.job.v2'), id:z.string().uuid(), projectId:z.string().uuid(), kind:z.string(), handler:z.string(), status:z.enum(['queued','running','completed','failed','cancelled']),
  inputFingerprint:z.string(), input:projectContentSchema, sourceRevision:z.number().int().nonnegative(), progress:z.number().min(0).max(1), attempt:z.number().int().nonnegative(), maxAttempts:z.number().int().positive(),
  createdAt:z.string(), updatedAt:z.string(), error:z.string().optional(), output:z.string().optional(), interrupted:z.boolean().optional()
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

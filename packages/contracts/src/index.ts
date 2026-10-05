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

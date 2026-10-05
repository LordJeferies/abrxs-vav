/* ═══ CANTER SERVICE — vertical MASTER → MediaSource → Piece → MP4 (0.6.0) ═══
   Funciones de servicio que comparten la ruta HTTP y los tests: crean entidades
   (MediaSource/Piece) y encolan jobs con target EXPLÍCTICO (nunca "el primer
   evento compatible"). El trabajo pesado vive en los handlers (media.ingest,
   canter.export_piece); aquí solo hay decisiones de dominio y persistencia. */
import { join } from 'node:path';
import type { JobEngine } from '@abraxas/core';
import { mediaSourceSchema, pieceSchema, type Job, type MediaSource, type Piece, type Project } from '@abraxas/contracts';
import { EntityRepository } from './entity-repository';

export interface CanterStores {
  mediaSources: EntityRepository<MediaSource>;
  pieces: EntityRepository<Piece>;
  dataDirectory: string;
}

const nextId = async (existing: Array<{ id: string }>, prefix: string): Promise<string> => {
  let n = existing.length + 1;
  const taken = new Set(existing.map(e => e.id));
  let id = `${prefix}${String(n).padStart(2, '0')}`;
  while (taken.has(id)) { n++; id = `${prefix}${String(n).padStart(2, '0')}`; }
  return id;
};

/** Ingesta: crea la MediaSource del máster y encola media.ingest (probe/hash/
    proxy/filmstrip/waveform). El máster NUNCA se carga en RAM (hash streaming). */
export async function ingestMaster(stores: CanterStores, engine: JobEngine, project: Project, input: { path: string; label?: string }): Promise<{ source: MediaSource; job: Job }> {
  const sources = await stores.mediaSources.list();
  const source = mediaSourceSchema.parse({
    schemaVersion: 'abrxs.media-source.v1',
    id: await nextId(sources, 'MS'),
    kind: 'master',
    ref: input.path,
    ...(input.label ? { extensions: { label: input.label } } : {}),
  });
  await stores.mediaSources.put(source);
  const job = await engine.enqueue(project, 'media.ingest', { target: { kind: 'media_source', ref: source.id } });
  return { source, job };
}

/** Crea una Piece por FRAMES sobre un MediaSource (out-exclusivo). Sincrónico:
    es metadato barato; el corte real va por job (canter.export_piece). */
export async function createPiece(stores: CanterStores, input: {
  projectId: string; pieceId?: string; label: string; mediaSourceId: string;
  sourceRange: { startFrame: number; endFrame: number }; eventRefs?: string[];
  transcriptRef?: string;
}): Promise<Piece> {
  const source = await stores.mediaSources.get(input.mediaSourceId);
  if (!source) throw new Error(`MediaSource ${input.mediaSourceId} no existe. Ingresa el máster primero.`);
  if (source.durationFrames != null && input.sourceRange.endFrame > source.durationFrames)
    throw new Error(`El rango de la pieza excede la duración del máster (${source.durationFrames} frames).`);
  const pieces = await stores.pieces.list();
  if (pieces.some(p => p.id === input.pieceId)) throw new Error(`Ya existe una pieza ${input.pieceId}.`);
  const piece = pieceSchema.parse({
    schemaVersion: 'abrxs.piece.v1',
    id: input.pieceId || await nextId(pieces, 'C'),
    label: input.label,
    projectId: input.projectId,
    sourceRef: source.id,
    sourceRange: input.sourceRange,
    status: 'draft',
    transcriptRef: input.transcriptRef,
    eventRefs: input.eventRefs ?? [],
    provenance: { createdFrom: 'manual_cut', createdAt: new Date().toISOString() },
  });
  return stores.pieces.put(piece);
}

/** Encola el corte real (canter.export_piece) sobre la pieza. El payload lleva
    el número de export para permitir re-export tras completar sin romper el
    dedupe (doble clic seguido sí deduplica). */
export async function exportPiece(stores: CanterStores, engine: JobEngine, project: Project, pieceId: string): Promise<{ piece: Piece; job: Job }> {
  const piece = await stores.pieces.get(pieceId);
  if (!piece) throw new Error(`Pieza ${pieceId} no existe.`);
  if (piece.projectId !== project.id) throw new Error(`La pieza ${pieceId} pertenece a otro proyecto.`);
  const job = await engine.enqueue(project, 'canter.export_piece', {
    target: { kind: 'piece', ref: piece.id },
    payload: { exportNumber: piece.outputRefs.length + 1 },
  });
  return { piece, job };
}

/** Carpeta de salida de una export: exports/<pieza>/<pieza>-<n>.mp4 */
export const exportOutputPath = (stores: CanterStores, piece: Piece, exportNumber: number): string =>
  join(stores.dataDirectory, 'exports', piece.id, `${piece.id}-${String(exportNumber).padStart(2, '0')}.mp4`);

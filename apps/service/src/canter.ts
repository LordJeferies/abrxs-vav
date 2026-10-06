/* ═══ CANTER SERVICE — vertical MASTER → MediaSource → Piece → MP4 (0.6.0) ═══
   Funciones de servicio que comparten la ruta HTTP y los tests: crean entidades
   (MediaSource/Piece) y encolan jobs con target EXPLÍCTICO (nunca "el primer
   evento compatible"). El trabajo pesado vive en los handlers (media.ingest,
   canter.export_piece); aquí solo hay decisiones de dominio y persistencia. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JobEngine } from '@abraxas/core';
import { mediaSourceSchema, pieceSchema, type Job, type MediaSource, type Piece, type Project } from '@abraxas/contracts';
import { EntityRepository } from './entity-repository';
import { alignText, alignAnchors, decideAlignment, type AlignCandidate, type AlignmentStatus } from './align';
import type { TranscriptWords } from './transcribe';

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

/* ── M2 slice 2: TEXTO → Piece (alignment sobre transcript word-level) ── */

/** Carga el transcript words.json canónico de una MediaSource. */
export async function loadTranscript(stores: CanterStores, source: MediaSource): Promise<TranscriptWords> {
  if (!source.transcriptRef) throw new Error(`El máster ${source.id} no tiene transcripción. Ejecuta canter.transcribe.`);
  return JSON.parse(await readFile(source.transcriptRef, 'utf8')) as TranscriptWords;
}

/** Alinea texto/anclas contra el transcript de un source → candidates con FRAMES. */
export async function alignSourceText(stores: CanterStores, source: MediaSource, query: {
  text?: string; openingText?: string; closingText?: string;
}): Promise<AlignCandidate[]> {
  if (!source.timebase) throw new Error(`El máster ${source.id} no tiene timebase (ingesta incompleta).`);
  const transcript = await loadTranscript(stores, source);
  if (query.openingText && query.closingText) return alignAnchors(transcript, query.openingText, query.closingText, source.timebase);
  if (query.text) return alignText(transcript, query.text, source.timebase);
  throw new Error('Debes enviar text o (openingText + closingText).');
}

/** Crea una Piece desde TEXTO alineado. Estrategia→decisión: MATCH crea;
    AMBIGUOUS/UNRESOLVED devuelve candidates para que la UI elija con
    candidateIndex (NUNCA se crea al azar ni con confianza dudosa). */
export async function createPieceFromText(stores: CanterStores, input: {
  projectId: string; label: string; mediaSourceId: string;
  text?: string; openingText?: string; closingText?: string;
  candidateIndex?: number; pieceId?: string;
}): Promise<{ piece?: Piece; candidates?: AlignCandidate[]; status?: AlignmentStatus }> {
  const source = await stores.mediaSources.get(input.mediaSourceId);
  if (!source) throw new Error(`MediaSource ${input.mediaSourceId} no existe.`);
  const candidates = await alignSourceText(stores, source, input);
  if (!candidates.length) throw new Error('No se encontró ese texto en el transcript (exacto, normalizado ni fuzzy).');
  const decision = decideAlignment(candidates);
  if (decision.status !== 'MATCH' && input.candidateIndex == null)
    return { candidates, status: decision.status };
  const chosen = candidates[Math.min(input.candidateIndex ?? 0, candidates.length - 1)];
  const pieces = await stores.pieces.list();
  if (input.pieceId && pieces.some(p => p.id === input.pieceId)) throw new Error(`Ya existe una pieza ${input.pieceId}.`);
  const piece = pieceSchema.parse({
    schemaVersion: 'abrxs.piece.v1',
    id: input.pieceId || await nextId(pieces, 'C'),
    label: input.label,
    projectId: input.projectId,
    sourceRef: source.id,
    sourceRange: { startFrame: chosen.startFrame, endFrame: chosen.endFrame },
    status: 'draft',
    transcriptRef: source.transcriptRef,
    eventRefs: [],
    provenance: { createdFrom: 'transcript_text_alignment', createdAt: new Date().toISOString(),
      note: `strategy=${chosen.strategy} confidence=${chosen.confidence} matchedText="${chosen.matchedText.slice(0, 120)}"` },
    extensions: { alignment: { strategy: chosen.strategy, confidence: chosen.confidence, matchedText: chosen.matchedText,
      startSec: chosen.startSec, endSec: chosen.endSec } },
  });
  return { piece: await stores.pieces.put(piece), status: decision.status };
}

/** Actualiza label/rango de una pieza (frames canónicos; validación contra el máster). */
export async function updatePiece(stores: CanterStores, pieceId: string, patch: { label?: string; sourceRange?: { startFrame: number; endFrame: number } }): Promise<Piece> {
  const piece = await stores.pieces.get(pieceId);
  if (!piece) throw new Error(`Pieza ${pieceId} no existe.`);
  const source = await stores.mediaSources.get(piece.sourceRef);
  const range = patch.sourceRange ?? piece.sourceRange;
  if (source?.durationFrames != null && range.endFrame > source.durationFrames)
    throw new Error(`El rango excede la duración del máster (${source.durationFrames} frames).`);
  return stores.pieces.put({ ...piece, label: patch.label?.trim() || piece.label, sourceRange: range });
}

/** Elimina una pieza (los MP4 exportados en disco NO se borran: son historia). */
export async function deletePiece(stores: CanterStores, pieceId: string): Promise<boolean> {
  return stores.pieces.remove(pieceId);
}

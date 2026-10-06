/* ═══ ASSET STORE — registro canónico de materiales (M3) ═══
   Registra archivos reales (cliente/stock/AI/frames) con hash STREAMING,
   kind por extensión (o explícito), provenance y licencia. Registro
   IDEMPOTENTE: mismo ref+hash → devuelve el asset existente (no duplica).
   El binario jamás vive en el JSON — solo refs y metadatos. */
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { assetSchema, type Asset, type AssetKind, type AssetProvenance } from '@abraxas/contracts';
import { sha256File } from './media';
import { EntityRepository } from './entity-repository';

export interface AssetStores { assets: EntityRepository<Asset> }

const KIND_BY_EXT: Record<string, AssetKind> = {
  '.jpg':'image','.jpeg':'image','.png':'image','.webp':'image','.gif':'image','.svg':'image','.heic':'image',
  '.mp4':'video','.mov':'video','.webm':'video','.mkv':'video',
  '.m4a':'audio','.mp3':'audio','.wav':'audio','.aac':'audio','.aiff':'audio','.flac':'audio',
  '.srt':'caption','.vtt':'caption','.ass':'caption',
  '.pdf':'document','.md':'document','.txt':'document'
};

/** Id secuencial SIN reciclar: max numérico existente +1. Reciclar el id de un
    asset borrado haría que referencias huérfanas (AssetSlot.resolvedAssetId)
    apuntaran silenciosamente al asset nuevo. */
const nextId = (existing: Array<{ id: string }>): string => {
  const max = existing.reduce((m, e) => {
    const match = /^A(\d+)$/.exec(e.id);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `A${String(max + 1).padStart(2, '0')}`;
};

export async function registerAsset(stores: AssetStores, input: {
  label: string; path: string; kind?: AssetKind;
  projectId?: string; clientId?: string;
  provenance?: AssetProvenance;
}): Promise<{ asset: Asset; created: boolean }> {
  const info = await stat(input.path).catch(() => null);
  if (!info || !info.isFile()) throw new Error(`El archivo no existe o no es un archivo regular: ${input.path}`);
  const kind: AssetKind = input.kind ?? KIND_BY_EXT[extname(input.path).toLowerCase()] ?? 'other';
  const hash = await sha256File(input.path); // streaming: GB sin cargar RAM
  const existing = await stores.assets.list();
  const duplicate = existing.find(a => a.hash === hash && a.ref === input.path);
  if (duplicate) return { asset: duplicate, created: false }; // idempotente por ref+hash
  const asset = assetSchema.parse({
    schemaVersion: 'abrxs.asset.v1',
    id: nextId(existing),
    label: input.label,
    kind, ref: input.path,
    hash, hashAlgorithm: 'sha256', sizeBytes: info.size,
    projectId: input.projectId, clientId: input.clientId,
    provenance: input.provenance ?? { origin: 'import' },
    createdAt: new Date().toISOString(),
  });
  return { asset: await stores.assets.put(asset), created: true };
}

export async function deleteAsset(stores: AssetStores, assetId: string): Promise<boolean> {
  return stores.assets.remove(assetId); // el archivo en disco NO se borra
}

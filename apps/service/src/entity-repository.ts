/* ═══ ENTITY REPOSITORY — colección JSON por tipo de entidad (0.6.0) ═══
   Persistencia simple y honesta para MediaSources y Pieces: UN archivo JSON
   por colección (media-sources.json / pieces.json), escritura ATÓMICA (reutiliza
   atomicWrite de FileRepository), validación por entidad contra su schema zod,
   cache en memoria y serialización por SerialQueue. Los entity ids NO son uuid
   ("MS01", "C01"), así que no pasa por el FileRepository de uuids.
   Las entidades son METADATOS pequeños; los binarios viven en archivos con refs. */
import { z } from 'zod';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SerialQueue } from '@abraxas/core';
import { atomicWrite } from './file-repository';

export class EntityRepository<T extends { id: string }> {
  private cache: T[] | null = null;
  private queue = new SerialQueue();
  constructor(private path: string, private schema: z.ZodType<T>, private collection: string) {}
  async init(): Promise<void> {
    await mkdir(join(this.path, '..'), { recursive: true, mode: 0o700 });
    await this.load();
  }
  private async load(): Promise<T[]> {
    if (this.cache) return this.cache;
    try {
      const raw = JSON.parse(await readFile(this.path, 'utf8')) as { entities?: unknown[] };
      this.cache = (raw.entities ?? []).map(e => this.schema.parse(e));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') this.cache = [];
      else throw error;
    }
    return this.cache;
  }
  list(): Promise<T[]> {
    return this.queue.run(async () => [...await this.load()]);
  }
  get(id: string): Promise<T | null> {
    return this.queue.run(async () => (await this.load()).find(e => e.id === id) ?? null);
  }
  put(value: T): Promise<T> {
    return this.queue.run(async () => {
      const valid = this.schema.parse(value);
      const list = await this.load();
      const index = list.findIndex(e => e.id === valid.id);
      if (index >= 0) list[index] = valid; else list.push(valid);
      await atomicWrite(this.path, JSON.stringify({ schemaVersion: this.collection, entities: list }, null, 2));
      return valid;
    });
  }
}

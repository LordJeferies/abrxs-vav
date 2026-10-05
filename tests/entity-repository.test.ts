import { describe,it,expect,afterEach } from 'vitest';
import { mkdtemp,rm,readFile,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pieceSchema,mediaSourceSchema } from '@abraxas/contracts';
import { EntityRepository } from '../apps/service/src/entity-repository';

const directories:string[]=[];
afterEach(async()=>{for(const dir of directories.splice(0))await rm(dir,{recursive:true,force:true});});
const makeRepo=async(name:string,schema:'piece'|'source')=>{
  const dir=await mkdtemp(join(tmpdir(),'abrxs-entity-'));directories.push(dir);
  const path=join(dir,name);
  const repo=new EntityRepository(path,schema==='piece'?pieceSchema:mediaSourceSchema,schema==='piece'?'abrxs.pieces.v1':'abrxs.media-sources.v1');
  await repo.init();
  return {dir,path,repo};
};
const piece=(id:string)=>({schemaVersion:'abrxs.piece.v1',id,label:`Pieza ${id}`,projectId:'proj-1',
  sourceRef:'MS01',sourceRange:{startFrame:0,endFrame:900},
  provenance:{createdFrom:'manual_cut',createdAt:'2026-10-05T00:00:00.000Z'}} as const);

describe('EntityRepository (colección JSON atómica)',()=>{
  it('put/get/list con validación por entidad y defaults aplicados',async()=>{
    const {repo}=await makeRepo('pieces.json','piece');
    const saved=await repo.put(piece('C01'));
    expect(saved.status).toBe('draft'); // default del schema
    expect(saved.outputRefs).toEqual([]);
    expect((await repo.get('C01'))?.id).toBe('C01');
    expect(await repo.get('NOPE')).toBeNull();
    expect(await repo.list()).toHaveLength(1);
  });
  it('put sobre el mismo id actualiza (upsert) sin duplicar',async()=>{
    const {repo}=await makeRepo('pieces.json','piece');
    await repo.put(piece('C01'));
    await repo.put({...piece('C01'),status:'exported' as const,outputRefs:['/x/C01.mp4']});
    const list=await repo.list();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('exported');
  });
  it('rechaza entidades inválidas y NO corrompe el archivo persistido',async()=>{
    const {repo,path}=await makeRepo('pieces.json','piece');
    await repo.put(piece('C01'));
    await expect(repo.put({...piece('C02'),sourceRange:{startFrame:50,endFrame:10}})).rejects.toThrow();
    await expect(repo.put({...piece('C03'),id:''})).rejects.toThrow();
    expect(await repo.list()).toHaveLength(1); // solo C01
    const raw=JSON.parse(await readFile(path,'utf8'));
    expect(raw.entities).toHaveLength(1);
  });
  it('reabrir una instancia nueva sobre el mismo archivo conserva las entidades',async()=>{
    const {path,repo}=await makeRepo('pieces.json','piece');
    await repo.put(piece('C01'));await repo.put(piece('C02'));
    const reopened=new EntityRepository(path,pieceSchema,'abrxs.pieces.v1');
    await reopened.init();
    expect((await reopened.list()).map(p=>p.id).sort()).toEqual(['C01','C02']);
  });
  it('archivo inexistente al reabrir → colección vacía (no crash)',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'abrxs-entity-'));directories.push(dir);
    const repo=new EntityRepository(join(dir,'nuevo.json'),mediaSourceSchema,'abrxs.media-sources.v1');
    await repo.init();
    expect(await repo.list()).toEqual([]);
  });
});

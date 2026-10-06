/* ═══ BATCH — lote de piezas vestidas y renderizadas (M5) ═══
   DROP N → auto-piezas desde la duración del máster → plan por pieza con
   ANTI-REPETICIÓN de b-rolls (excludeAssetIds acumulado) → render jobs en cola
   (el JobEngine drena serialmente; pausa cooperativa disponible).
   El estado del lote NO se persiste: se CALCULA de los jobs (única verdad). */
import { batchSchema, pieceSchema, type Batch, type ClientProfile, type Project } from '@abraxas/contracts';
import type { JobEngine } from '@abraxas/core';
import type { EntityRepository } from './entity-repository';
import { buildDresserPlan, type DresserStores } from './dresser';

export interface BatchStores extends DresserStores {
  batches: EntityRepository<Batch>;
  editProject:(id:string,expectedRevision:number,label:string,content:Project['content'])=>Promise<Project>;
  getProject:(id:string)=>Promise<Project>;
}

/** Divide la duración del máster en N ventanas iguales (frames canónicos
    out-exclusivos, floor/ceil) — sin solapes y ordenadas. */
export function autoWindows(durationFrames:number,count:number):Array<{startFrame:number;endFrame:number}>{
  if(!Number.isInteger(count)||count<1)throw new Error('El batch necesita count entero ≥ 1.');
  if(durationFrames<count)throw new Error(`El máster (${durationFrames} frames) no alcanza para ${count} piezas.`);
  // Partición entera canónica: [floor(i·N/c), floor((i+1)·N/c)) — sin solapes
  // ni huecos y con cobertura total (floor/ceil aquí rompería la contigüidad).
  return Array.from({length:count},(_,i)=>({
    startFrame:Math.floor(i*durationFrames/count),
    endFrame:Math.floor((i+1)*durationFrames/count)}));
}

const nextBatchId=(existing:Array<{id:string}>):string=>{
  const max=existing.reduce((m,e)=>{const x=/^B(\d+)$/.exec(e.id);return x?Math.max(m,Number(x[1])):m;},0);
  return `B${String(max+1).padStart(2,'0')}`;
};

/** Crea el lote: piezas explícitas o AUTO (ventanas iguales del máster
    ingestado), plan por pieza con anti-repetición, render jobs en cola. */
export async function createBatch(stores:BatchStores, engine:JobEngine, project:Project, input:{
  count?:number; pieceIds?:string[]; profile?:ClientProfile;
}): Promise<{ batch:Batch; pieces:string[] }>{
  if(input.count&&input.pieceIds)throw new Error('Envía count (auto) o pieceIds, no ambos.');

  // 1) Piezas: explícitas o auto desde la duración del máster ingestado.
  let pieceIds=input.pieceIds;
  if(!pieceIds){
    const count=input.count??1;
    const masters=(await stores.mediaSources.list()).filter(m=>(m.durationFrames??0)>0&&m.timebase);
    const master=masters[masters.length-1];
    if(!master)throw new Error('No hay máster ingestado para el batch (media.ingest primero).');
    const windows=autoWindows(master.durationFrames!,count);
    pieceIds=[];
    for(const [i,win] of windows.entries()){
      const pieceId=`C${String(i+1).padStart(2,'0')}`;
      if(await stores.pieces.get(pieceId))throw new Error(`Ya existe la pieza ${pieceId}; elimínala o usa pieceIds explícitos.`);
      await stores.pieces.put(pieceSchema.parse({
        schemaVersion:'abrxs.piece.v1',id:pieceId,label:`Batch clip ${i+1}`,projectId:project.id,
        sourceRef:master.id,sourceRange:win,status:'draft',
        provenance:{createdFrom:'auto_segment',createdAt:new Date().toISOString()}}));
      pieceIds.push(pieceId);
    }
  }else{
    for(const id of pieceIds){const p=await stores.pieces.get(id);if(!p)throw new Error(`La pieza ${id} no existe.`);}
  }

  // 2) Plan por pieza con ANTI-REPETICIÓN: cada b-roll usado se reserva para
  //    las siguientes piezas (si no queda alternativa, caption honesto).
  const usedAssetIds:string[]=[];
  for(const pieceId of pieceIds){
    const fresh=await stores.getProject(project.id);
    const plan=await buildDresserPlan({stores,editProject:stores.editProject},fresh,{pieceId,profile:input.profile,excludeAssetIds:usedAssetIds});
    usedAssetIds.push(...plan.plan.brolls.map(b=>b.assetId));
  }

  // 3) Render jobs en cola (fingerprint dedupe intacto: re-batch idéntico no re-encola).
  const fresh=await stores.getProject(project.id);
  const jobIds:string[]=[];
  for(const pieceId of pieceIds){
    const job=await engine.enqueue(fresh,'dresser.render_piece',{target:{kind:'piece',ref:pieceId},payload:{renderNumber:1}});
    jobIds.push(job.id);
  }

  // 4) Registro del lote (id secuencial sin reciclar, como assets).
  const batches=await stores.batches.list();
  const batch=batchSchema.parse({
    schemaVersion:'abrxs.batch.v1',id:nextBatchId(batches),projectId:project.id,
    pieceIds,jobIds,clientId:input.profile?.clientId,createdAt:new Date().toISOString()});
  await stores.batches.put(batch);
  return { batch, pieces:pieceIds };
}

export interface BatchStatus {
  status:'queued'|'running'|'completed'|'failed'|'partial'|'missing';
  total:number;completed:number;failed:number;queuedOrRunning:number;
  jobs:Array<{id:string;pieceId?:string;status:string;progress:number}>;
}

/** Estado CALCULADO de los jobs — el batch no guarda verdad duplicada. */
export async function getBatchStatus(stores:BatchStores,engine:JobEngine,batchId:string):Promise<{batch:Batch;status:BatchStatus}|null>{
  const batch=await stores.batches.get(batchId);
  if(!batch)return null;
  const jobs=await engine.list();
  const detail=batch.jobIds.map(id=>{
    const j=jobs.find(x=>x.id===id);
    return {id,pieceId:j?.target?.ref,status:j?.status??'missing',progress:j?.progress??0};
  });
  if(!detail.length)return {batch,status:{status:'missing',total:0,completed:0,failed:0,queuedOrRunning:0,jobs:[]}};
  const completed=detail.filter(j=>j.status==='completed').length;
  const failed=detail.filter(j=>j.status==='failed').length;
  const queuedOrRunning=detail.filter(j=>['queued','running'].includes(j.status)).length;
  const status:BatchStatus['status']=
    completed===detail.length?'completed'
    :failed&&completed===0&&queuedOrRunning===0?'failed'
    :failed>0?'partial'
    :queuedOrRunning>0?'running':'missing';
  return {batch,status:{status,total:detail.length,completed,failed,queuedOrRunning,jobs:detail}};
}

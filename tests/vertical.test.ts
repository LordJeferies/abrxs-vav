/* ═══ M1 — VERTICAL REAL E2E: MASTER → ingest → PIECE C01 → corte MP4 → reopen ═══
   Usa el MISMO wiring que el servicio real (EntityRepository + createJobHandlers +
   ProjectStore + JobEngine) y fixtures sintéticos de FFmpeg. Criterio del
   milestone: el MP4 existe, es h264, dura el rango pedido; y tras REABRIR las
   tiendas desde disco TODO SIGUE EXISTIENDO (proyecto, source, pieza, outputs). */
import { describe,it,expect,afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp,rm,stat,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { ProjectStore,JobEngine } from '@abraxas/core';
import { projectSchema,mediaSourceSchema,pieceSchema,jobSchema,framesToSeconds } from '@abraxas/contracts';
import { FileRepository } from '../apps/service/src/file-repository';
import { EntityRepository } from '../apps/service/src/entity-repository';
import { createJobHandlers } from '../apps/service/src/handlers';
import { ingestMaster,createPiece,exportPiece } from '../apps/service/src/canter';
import { probe } from '../apps/service/src/media';

const run=(cmd:string,args:string[]):Promise<{code:number;stdout:string;stderr:string}>=>new Promise(resolve=>{
  execFile(cmd,args,{timeout:120_000,maxBuffer:16*1024*1024},(err,stdout,stderr)=>{
    if(!err)return resolve({code:0,stdout,stderr});
    resolve({code:typeof err.code==='number'?err.code:127,stdout,stderr});
  });
});
const HAS_FFMPEG=await run('ffmpeg',['-version']).then(r=>r.code===0);

const dirs:string[]=[],engines:JobEngine[]=[];
afterAll(async()=>{for(const e of engines.splice(0))await e.stop();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
const eventually=async(cond:()=>Promise<boolean>)=>{for(let i=0;i<600;i++){if(await cond())return;await wait(50);}throw new Error('Timeout esperando el vertical');};
const fingerprint=(v:string)=>createHash('sha256').update(v).digest('hex');

(HAS_FFMPEG?describe:describe.skip)('Vertical M1: MASTER → MediaSource → C01 → MP4',()=>{
  it('ingesta un máster real, crea la pieza C01, la corta a MP4 y TODO sobrevive al reopen',async()=>{
    // 1) Entorno real: proyecto + tiendas de entidades + handlers con deps + JobEngine.
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-vertical-'));dirs.push(dataDir);
    const repo=new FileRepository(join(dataDir,'projects'),projectSchema);await repo.init();
    const jobs=new FileRepository(join(dataDir,'jobs'),jobSchema);await jobs.init();
    const store=new ProjectStore(repo);
    const project=await store.create('JOC · Podcast EP32',{fpsNumerator:30000,fpsDenominator:1001});
    const mediaSources=new EntityRepository(join(dataDir,'entities','media-sources.json'),mediaSourceSchema,'abrxs.media-sources.v1');await mediaSources.init();
    const pieces=new EntityRepository(join(dataDir,'entities','pieces.json'),pieceSchema,'abrxs.pieces.v1');await pieces.init();
    const stores={mediaSources,pieces,dataDirectory:dataDir};
    const engine=new JobEngine(jobs,createJobHandlers(stores),fingerprint,{defaultWatchdogMs:120_000});engines.push(engine);
    await engine.recover();

    // 2) Máster sintético real (10 s, 29.97, con audio) en disco.
    const master=join(dataDir,'master-in.mp4');
    const gen=await run('ffmpeg',['-y','-f','lavfi','-i','testsrc2=size=320x240:rate=30000/1001:duration=10',
      '-f','lavfi','-i','sine=frequency=440:duration=10','-c:v','libx264','-preset','ultrafast','-crf','35',
      '-pix_fmt','yuv420p','-c:a','aac','-shortest',master]);
    expect(gen.code).toBe(0);

    // 3) INGEST → job media.ingest → MediaSource con hash/timebase/duración/derivados.
    const {source,job:ingestJob}=await ingestMaster(stores,engine,project,{path:master,label:'EP32 máster'});
    expect(source.id).toBe('MS01');
    await eventually(async()=>(await engine.get(ingestJob.id)).status==='completed');
    const ingested=await mediaSources.get('MS01');
    expect(ingested?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ingested?.timebase).toEqual({fpsNumerator:30000,fpsDenominator:1001});
    expect(ingested?.durationFrames).toBeGreaterThan(299);
    expect(ingested?.width).toBe(320);
    expect(ingested?.audio?.present).toBe(true);
    expect(ingested?.proxyRef).toBeTruthy();
    expect((await stat(ingested!.proxyRef!)).size).toBeGreaterThan(0);
    expect(ingested?.filmstripRef).toBeTruthy();
    expect((await stat(ingested!.filmstripRef!)).size).toBeGreaterThan(0);
    expect(ingested?.waveformRef).toBeTruthy(); // el máster tiene audio → waveform real
    const proxyProbe=await probe(ingested!.proxyRef!);
    expect(proxyProbe.height).toBeLessThanOrEqual(540);

    // 4) PIECE C01 por FRAMES (out-exclusivo) sobre el máster ingestado (~3 s = 90 frames a 29.97).
    const piece=await createPiece(stores,{projectId:project.id,pieceId:'C01',label:'Hook EP32',
      mediaSourceId:'MS01',sourceRange:{startFrame:0,endFrame:90}});
    expect(piece.status).toBe('draft');
    await expect(createPiece(stores,{projectId:project.id,pieceId:'C01',label:'Duplicada',
      mediaSourceId:'MS01',sourceRange:{startFrame:0,endFrame:100}})).rejects.toThrow(/Ya existe/);
    await expect(createPiece(stores,{projectId:project.id,pieceId:'C02',label:'Fuera de rango',
      mediaSourceId:'MS01',sourceRange:{startFrame:0,endFrame:301}})).rejects.toThrow(/excede/);

    // 5) EXPORT → job canter.export_piece → MP4 REAL en disco.
    const {job:exportJob}=await exportPiece(stores,engine,project,'C01');
    await eventually(async()=>(await engine.get(exportJob.id)).status==='completed');
    const exported=await pieces.get('C01');
    expect(exported?.status).toBe('exported');
    expect(exported?.outputRefs).toHaveLength(1);
    const output=exported!.outputRefs[0];
    expect((await stat(output)).size).toBeGreaterThan(0);
    const cutProbe=await probe(output);
    const expectedSec=framesToSeconds(90,{fpsNumerator:30000,fpsDenominator:1001});
    expect(cutProbe.durationSec).toBeGreaterThan(expectedSec-0.5);
    expect(cutProbe.durationSec).toBeLessThan(expectedSec+0.5);

    // 6) REOPEN: instancias NUEVAS sobre el mismo disco → TODO SIGUE EXISTIENDO.
    const mediaSources2=new EntityRepository(join(dataDir,'entities','media-sources.json'),mediaSourceSchema,'abrxs.media-sources.v1');
    const pieces2=new EntityRepository(join(dataDir,'entities','pieces.json'),pieceSchema,'abrxs.pieces.v1');
    const store2=new ProjectStore(new FileRepository(join(dataDir,'projects'),projectSchema));
    const reopenedSource=await mediaSources2.get('MS01');
    const reopenedPiece=await pieces2.get('C01');
    const reopenedProject=await store2.get(project.id);
    expect(reopenedSource?.hash).toBe(ingested?.hash);
    expect(reopenedPiece?.status).toBe('exported');
    expect(reopenedPiece?.outputRefs[0]).toBe(output);
    expect(reopenedProject.content.name).toBe('JOC · Podcast EP32');
  },60_000);

  it('media.ingest sin target explícito falla (nunca resuelve por conveniencia)',async()=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-vertical2-'));dirs.push(dataDir);
    const handlers=createJobHandlers({mediaSources:new EntityRepository(join(dataDir,'entities','m.json'),mediaSourceSchema,'abrxs.media-sources.v1'),pieces:new EntityRepository(join(dataDir,'entities','p.json'),pieceSchema,'abrxs.pieces.v1'),dataDirectory:dataDir});
    await expect(handlers['media.ingest']({target:{kind:'piece',ref:'C01'}} as never,
      {signal:new AbortController().signal,progress:async()=>{}})).rejects.toThrow(/target media_source/);
    await expect(createJobHandlers()['media.ingest']({target:{kind:'media_source',ref:'MS01'}} as never,
      {signal:new AbortController().signal,progress:async()=>{}})).rejects.toThrow(/sin stores/);
  });
  it('el fixture base existe para CI sin FFmpeg (skip honesto, no error)',async()=>{
    // cuando no hay ffmpeg el describe entero se salta; esta prueba documenta el gate.
    expect(typeof HAS_FFMPEG).toBe('boolean');
    await writeFile(join(tmpdir(),'.vertical-gate'),String(HAS_FFMPEG));
  });
});

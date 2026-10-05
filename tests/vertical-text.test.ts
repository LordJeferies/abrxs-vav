/* ═══ M2 slice 2 — E2E REAL: voz → transcript → TEXTO → Piece → MP4 → reopen ═══
   Extiende el vertical de M1 con el eslabón de TEXTO: la frase se busca en el
   transcript word-level (alineación exacta/normalizada), se convierte a frames
   con floor/ceil sobre la timebase racional del máster y la pieza se exporta a
   MP4 real. Gated: sin say/mlx_whisper/modelo → skip honesto. */
import { describe,it,expect,afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp,rm,stat,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { ProjectStore,JobEngine } from '@abraxas/core';
import { projectSchema,jobSchema,mediaSourceSchema,pieceSchema,framesToSeconds } from '@abraxas/contracts';
import { FileRepository } from '../apps/service/src/file-repository';
import { EntityRepository } from '../apps/service/src/entity-repository';
import { createJobHandlers } from '../apps/service/src/handlers';
import { ingestMaster,createPieceFromText,exportPiece } from '../apps/service/src/canter';
import { transcribeMaster,detectTranscribeBackend } from '../apps/service/src/transcribe';
import { probe } from '../apps/service/src/media';

const run=(cmd:string,args:string[],timeout=60_000):Promise<{code:number;stdout:string;stderr:string}>=>new Promise(resolve=>{
  execFile(cmd,args,{timeout,maxBuffer:16*1024*1024},(err,stdout,stderr)=>{
    if(!err)return resolve({code:0,stdout,stderr});
    resolve({code:typeof err.code==='number'?err.code:127,stdout,stderr});
  });
});
const HAS_SAY=await run('say',['-v','?']).then(r=>r.code===0);
const BACKEND=await detectTranscribeBackend().catch(()=>null);
const GATED=HAS_SAY&&!!BACKEND;
const dirs:string[]=[],engines:JobEngine[]=[];
afterAll(async()=>{for(const e of engines.splice(0))await e.stop();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
const eventually=async(cond:()=>Promise<boolean>)=>{for(let i=0;i<600;i++){if(await cond())return;await wait(50);}throw new Error('Timeout');};
const fingerprint=(v:string)=>createHash('sha256').update(v).digest('hex');

(GATED?describe:describe.skip)('Vertical M2 completo: VOZ → transcript → TEXTO → Piece → MP4',()=>{
  it('frase del usuario → rango canónico → pieza exportada → reopen',async()=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-m2e2e-'));dirs.push(dataDir);
    const repo=new FileRepository(join(dataDir,'projects'),projectSchema);await repo.init();
    const jobs=new FileRepository(join(dataDir,'jobs'),jobSchema);await jobs.init();
    const store=new ProjectStore(repo);
    const project=await store.create('Podcast M2',{fpsNumerator:30000,fpsDenominator:1001});
    const mediaSources=new EntityRepository(join(dataDir,'entities','media-sources.json'),mediaSourceSchema,'abrxs.media-sources.v1');await mediaSources.init();
    const pieces=new EntityRepository(join(dataDir,'entities','pieces.json'),pieceSchema,'abrxs.pieces.v1');await pieces.init();
    const stores={mediaSources,pieces,dataDirectory:dataDir};
    const engine=new JobEngine(jobs,createJobHandlers(stores),fingerprint,{defaultWatchdogMs:180_000});engines.push(engine);
    await engine.recover();

    // 1) Máster con VOZ real (say → m4a, 6 s, 29.97 con audio).
    const aiff=join(dataDir,'voz.aiff'),master=join(dataDir,'voz.m4a');
    const frase1='Hola y bienvenidos al programa de hoy';
    const frase2='Y con esto terminamos el episodio';
    expect((await run('say',['-o',aiff,`${frase1}. ${frase2}.`])).code).toBe(0);
    expect((await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=30000/1001:duration=6',
      '-i',aiff,'-map','0:v','-map','1:a','-c:v','libx264','-preset','ultrafast','-crf','35','-pix_fmt','yuv420p',
      '-c:a','aac','-shortest',master])).code).toBe(0);

    // 2) INGEST.
    const {source,job:ingestJob}=await ingestMaster(stores,engine,project,{path:master,label:'EP M2'});
    await eventually(async()=>(await engine.get(ingestJob.id)).status==='completed');
    const ingested=await mediaSources.get(source.id);
    expect(ingested?.timebase).toEqual({fpsNumerator:30000,fpsDenominator:1001});

    // 3) TRANSCRIBE (real, con cache).
    const transcribeJob=await engine.enqueue(project,'media.transcribe',{target:{kind:'media_source',ref:source.id}});
    await eventually(async()=>(await engine.get(transcribeJob.id)).status==='completed');
    const withTranscript=await mediaSources.get(source.id);
    expect(withTranscript?.transcriptRef).toBeTruthy();

    // 4) TEXTO → PIECE: la frase 1 se busca por TEXTO (normalizada — la frase
    //    se toma del transcript para no depender del ASR exacto).
    const transcript=JSON.parse(await readFile(withTranscript!.transcriptRef!,'utf8')) as {segments:Array<{text:string}>};
    const query=transcript.segments[0].text;
    const result=await createPieceFromText(stores,{projectId:project.id,label:'Intro por texto',
      mediaSourceId:source.id,text:query,pieceId:'C01'});
    expect(result.status).toBe('MATCH');
    expect(result.piece!.provenance.createdFrom).toBe('transcript_text_alignment');
    expect(result.piece!.sourceRange.endFrame).toBeGreaterThan(result.piece!.sourceRange.startFrame);

    // 5) EXPORT real → MP4 con la duración del rango alineado.
    const {job:exportJob}=await exportPiece(stores,engine,project,'C01');
    await eventually(async()=>(await engine.get(exportJob.id)).status==='completed');
    const exported=await pieces.get('C01');
    expect(exported?.outputRefs).toHaveLength(1);
    const cut=await probe(exported!.outputRefs[0]);
    const expectedSec=framesToSeconds(result.piece!.sourceRange.endFrame,{fpsNumerator:30000,fpsDenominator:1001})
      -framesToSeconds(result.piece!.sourceRange.startFrame,{fpsNumerator:30000,fpsDenominator:1001});
    expect(cut.durationSec).toBeGreaterThan(expectedSec-0.6);
    expect(cut.durationSec).toBeLessThan(expectedSec+0.6);

    // 6) REOPEN: tiendas nuevas → pieza C01 con alignment metadata.
    const pieces2=new EntityRepository(join(dataDir,'entities','pieces.json'),pieceSchema,'abrxs.pieces.v1');
    const reopened=await pieces2.get('C01');
    expect(reopened?.provenance.createdFrom).toBe('transcript_text_alignment');
    expect((reopened?.extensions?.alignment as {confidence:number}).confidence).toBeGreaterThanOrEqual(0.75);
    expect(reopened?.outputRefs).toHaveLength(1);
  },240_000);
});
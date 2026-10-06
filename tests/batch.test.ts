/* ═══ M5 — BATCH: anti-repetición, auto-piezas, pause/resume, estado calculado ═══ */
import { describe,it,expect,afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp,rm,writeFile,stat,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { ProjectStore,JobEngine } from '@abraxas/core';
import { projectSchema,jobSchema,mediaSourceSchema,pieceSchema,assetSchema,batchSchema } from '@abraxas/contracts';
import { FileRepository } from '../apps/service/src/file-repository';
import { EntityRepository } from '../apps/service/src/entity-repository';
import { createJobHandlers } from '../apps/service/src/handlers';
import { ingestMaster } from '../apps/service/src/canter';
import { createBatch,getBatchStatus,autoWindows } from '../apps/service/src/batch';
import { buildDresserPlan } from '../apps/service/src/dresser';
import { transcribeMaster,detectTranscribeBackend } from '../apps/service/src/transcribe';
import { probe } from '../apps/service/src/media';

const run=(cmd:string,args:string[],timeout=60_000):Promise<{code:number;stdout:string;stderr:string}>=>new Promise(resolve=>{
  execFile(cmd,args,{timeout,maxBuffer:16*1024*1024},(err,stdout,stderr)=>{
    if(!err)return resolve({code:0,stdout,stderr});
    resolve({code:typeof err.code==='number'?err.code:127,stdout,stderr});
  });
});
const HAS_FFMPEG=await run('ffmpeg',['-version']).then(r=>r.code===0);
const HAS_SAY=await run('say',['-v','?']).then(r=>r.code===0);
const BACKEND=await detectTranscribeBackend().catch(()=>null);
const GATED=HAS_FFMPEG&&HAS_SAY&&!!BACKEND;

const dirs:string[]=[],engines:JobEngine[]=[];
afterAll(async()=>{for(const e of engines.splice(0))await e.stop();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
const fingerprint=(v:string)=>createHash('sha256').update(v).digest('hex');
const eventually=async(cond:()=>Promise<boolean>)=>{for(let i=0;i<1200;i++){if(await cond())return;await wait(50);}throw new Error('Timeout');};

describe('autoWindows (reparto entero sin solapes ni huecos)',()=>{
  it('270 frames en 3 → [0,90) [90,180) [180,270)',()=>{
    expect(autoWindows(270,3)).toEqual([{startFrame:0,endFrame:90},{startFrame:90,endFrame:180},{startFrame:180,endFrame:270}]);
  });
  it('reparto no divisible: partición entera contigua que cubre TODO (sin solapes)',()=>{
    const wins=autoWindows(1000,3);
    expect(wins).toEqual([{startFrame:0,endFrame:333},{startFrame:333,endFrame:666},{startFrame:666,endFrame:1000}]);
  });
  it('count inválido o máster demasiado corto → error',()=>{
    expect(()=>autoWindows(100,0)).toThrow();
    expect(()=>autoWindows(100,2.5)).toThrow();
    expect(()=>autoWindows(5,10)).toThrow();
  });
});

describe('JobEngine.pause/resume (pausa cooperativa)',()=>{
  const makeEngine=async()=>{
    const dir=await mkdtemp(join(tmpdir(),'abrxs-pause-'));dirs.push(dir);
    const projects=new FileRepository(join(dir,'projects'),projectSchema);await projects.init();
    const jobs=new FileRepository(join(dir,'jobs'),jobSchema);await jobs.init();
    const store=new ProjectStore(projects);
    const project=await store.create('Pausa',{fpsNumerator:30,fpsDenominator:1});
    const engine=new JobEngine(jobs,{slow:async(_,{signal,progress})=>{for(let i=0;i<10;i++){await wait(30,undefined,{signal});await progress(i/10);}return 'ok';}},fingerprint);
    engines.push(engine);
    return {store,project,engine};
  };
  it('pause detiene la desencolación; resume continúa; los en curso terminan',async()=>{
    const {engine,project}=await makeEngine();
    engine.pause();
    const j1=await engine.enqueue(project,'slow',{payload:{n:1}});
    await wait(150);
    expect(engine.isPaused).toBe(true);
    expect((await engine.get(j1.id)).status).toBe('queued'); // NO desencola
    engine.resume();
    await eventually(async()=>(await engine.get(j1.id)).status==='completed');
    expect((await engine.get(j1.id)).output).toBe('ok');
  });
  it('un job EN CURSO al pausar termina su ejecución (cooperativo, no se aborta)',async()=>{
    const {engine,project}=await makeEngine();
    const running=await engine.enqueue(project,'slow',{payload:{n:1}});
    await eventually(async()=>(await engine.get(running.id)).progress>0.1);
    engine.pause();
    const midProgress=(await engine.get(running.id)).progress;
    await eventually(async()=>(await engine.get(running.id)).status==='completed'); // terminó pese a la pausa
    expect((await engine.get(running.id)).progress).toBeGreaterThanOrEqual(midProgress);
    // y lo que se encola con el engine pausado NO arranca hasta resume
    const j2=await engine.enqueue(project,'slow',{payload:{n:2}});
    await wait(150);
    expect((await engine.get(j2.id)).status).toBe('queued');
    engine.resume();
    await eventually(async()=>(await engine.get(j2.id)).status==='completed');
  });
});

describe('Batch: anti-repetición y estado calculado (fixtures sin ffmpeg)',()=>{
  const makeEnv=async(handlerOverride?:{dresser_render?:()=>Promise<string>})=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-batch-'));dirs.push(dataDir);
    const projects=new FileRepository(join(dataDir,'projects'),projectSchema);await projects.init();
    const jobs=new FileRepository(join(dataDir,'jobs'),jobSchema);await jobs.init();
    const store=new ProjectStore(projects);
    const project=await store.create('Batch Test',{fpsNumerator:30000,fpsDenominator:1001});
    const mediaSources=new EntityRepository(join(dataDir,'entities','m.json'),mediaSourceSchema,'abrxs.media-sources.v1');await mediaSources.init();
    const pieces=new EntityRepository(join(dataDir,'entities','p.json'),pieceSchema,'abrxs.pieces.v1');await pieces.init();
    const assets=new EntityRepository(join(dataDir,'entities','a.json'),assetSchema,'abrxs.assets.v1');await assets.init();
    const batches=new EntityRepository(join(dataDir,'entities','b.json'),batchSchema,'abrxs.batches.v1');await batches.init();
    const stores={mediaSources,pieces,assets,batches,dataDirectory:dataDir,
      editProject:store.edit.bind(store),getProject:(id:string)=>store.get(id)};
    // máster con transcript de 2 frases en 2 mitades (0–4.5s y 4.5–9s)
    const words=[...[w2(0.2,0.5,'La'),w2(0.5,0.9,'logística'),w2(0.9,1.2,'de'),w2(1.2,1.6,'hoy'),w2(1.6,2.0,'cambió.'),w2(2.0,2.5,'Esto'),w2(2.5,2.9,'afecta'),w2(2.9,3.3,'tus'),w2(3.3,3.7,'envíos.'),w2(3.7,4.4,'Mucho.')],
      ...[w2(4.5,4.9,'La'),w2(4.9,5.3,'logística'),w2(5.3,5.7,'global'),w2(5.7,6.1,'sube.'),w2(6.1,6.6,'Los'),w2(6.6,7.0,'plazos'),w2(7.0,7.4,'empeoran.'),w2(7.4,8.8,'Fin.')]];
    await mediaSources.put(mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'MS01',kind:'master',
      ref:join(dataDir,'master.mp4'),hash:fingerprint('m'),timebase:{fpsNumerator:30000,fpsDenominator:1001},durationFrames:270}));
    await writeFile(join(dataDir,'transcript.json'),JSON.stringify({backend:'mlx_whisper',model:'t',sourceHash:'x',language:'es',
      segments:[{start:0.2,end:4.4,text:words.slice(0,10).map(x=>x.word).join(' '),words:words.slice(0,10)},
        {start:4.5,end:8.8,text:words.slice(10).map(x=>x.word).join(' '),words:words.slice(10)}]}));
    const source=await mediaSources.get('MS01');
    await mediaSources.put({...source!,transcriptRef:join(dataDir,'transcript.json')});
    const img=join(dataDir,'broll.png');await writeFile(img,'img');
    await assets.put(assetSchema.parse({schemaVersion:'abrxs.asset.v1',id:'A01',label:'B-roll logística',kind:'image',ref:img,
      projectId:project.id,provenance:{origin:'import'},createdAt:new Date().toISOString(),extensions:{tags:['logistica']}}));
    const handlers=createJobHandlers({...stores});
    const engine=new JobEngine(jobs,handlerOverride?.dresser_render
      ?{...handlers,'dresser.render_piece':async()=>{return 'ok (fast handler de test)';}}
      :handlers,fingerprint,{defaultWatchdogMs:180_000});engines.push(engine);
    await engine.recover();
    return {dataDir,stores,store,project,engine};
  };
  const w2=(start:number,end:number,word:string)=>({start,end,word});

  it('batch auto count=2: C01/C02 sin solapes + anti-repetición (A01 solo en la primera)',async()=>{
    const {stores,store,project,engine}=await makeEnv({dresser_render:async()=>Promise.resolve('ok')});
    const {batch}=await createBatch(stores,engine,await store.get(project.id),{count:2});
    expect(batch.pieceIds).toEqual(['C01','C02']);
    const c01=await stores.pieces.get('C01'),c02=await stores.pieces.get('C02');
    expect(c01!.sourceRange).toEqual({startFrame:0,endFrame:135});
    expect(c02!.sourceRange).toEqual({startFrame:135,endFrame:270});
    const p1=(c01!.extensions as {dressPlan?:{beats:Array<{kind:string;why:string}>}}).dressPlan!;
    const p2=(c02!.extensions as {dressPlan?:{beats:Array<{kind:string;why:string}>}}).dressPlan!;
    expect(p1.beats.some(b=>b.kind==='b_roll')).toBe(true);
    expect(p2.beats.some(b=>b.kind==='b_roll')).toBe(false);           // A01 reservado
    expect(p2.beats.some(b=>b.why.includes('anti-repetición'))).toBe(true);
    // estado calculado → completed cuando los jobs terminan
    await eventually(async()=>(await getBatchStatus(stores,engine,batch.id))!.status.status==='completed');
    const st=await getBatchStatus(stores,engine,batch.id);
    expect(st!.status.total).toBe(2);
    expect(st!.status.completed).toBe(2);
    // (los MP4 reales se validan en el E2E gated de abajo; aquí el handler es rápido)
  },60_000);
  it('count y pieceIds a la vez → error',async()=>{
    const {stores,store,project,engine}=await makeEnv({dresser_render:async()=>Promise.resolve('ok')});
    await expect(createBatch(stores,engine,await store.get(project.id),{count:2,pieceIds:['C01']})).rejects.toThrow(/no ambos/);
  });
  it('piezas explícitas inexistentes → error claro',async()=>{
    const {stores,store,project,engine}=await makeEnv({dresser_render:async()=>Promise.resolve('ok')});
    await expect(createBatch(stores,engine,await store.get(project.id),{pieceIds:['CZ99']})).rejects.toThrow(/no existe/);
  });
});

(HAS_FFMPEG&&HAS_SAY&&BACKEND?describe:describe.skip)('Vertical M5 E2E real (voz → batch auto → 2 MP4 vestidos)',()=>{
  it('voz → transcribe → batch count=2 → planes con anti-repetición → 2 MP4 → reopen',async()=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-m5e2e-'));dirs.push(dataDir);
    const projects=new FileRepository(join(dataDir,'projects'),projectSchema);await projects.init();
    const jobs=new FileRepository(join(dataDir,'jobs'),jobSchema);await jobs.init();
    const store=new ProjectStore(projects);
    const project=await store.create('Podcast M5',{fpsNumerator:30000,fpsDenominator:1001});
    const mediaSources=new EntityRepository(join(dataDir,'entities','m.json'),mediaSourceSchema,'abrxs.media-sources.v1');await mediaSources.init();
    const pieces=new EntityRepository(join(dataDir,'entities','p.json'),pieceSchema,'abrxs.pieces.v1');await pieces.init();
    const assets=new EntityRepository(join(dataDir,'entities','a.json'),assetSchema,'abrxs.assets.v1');await assets.init();
    const batches=new EntityRepository(join(dataDir,'entities','b.json'),batchSchema,'abrxs.batches.v1');await batches.init();
    const stores={mediaSources,pieces,assets,batches,dataDirectory:dataDir,editProject:store.edit.bind(store),getProject:(id:string)=>store.get(id)};
    const engine=new JobEngine(jobs,createJobHandlers({...stores}),fingerprint,{defaultWatchdogMs:180_000});engines.push(engine);
    await engine.recover();
    // voz real
    const aiff=join(dataDir,'voz.aiff'),master=join(dataDir,'voz.m4a');
    expect((await run('say',['-o',aiff,'La logística de hoy cambió por completo. Y afecta tus envíos directos.'])).code).toBe(0);
    expect((await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=30000/1001:duration=6',
      '-i',aiff,'-map','0:v','-map','1:a','-c:v','libx264','-preset','ultrafast','-crf','35','-pix_fmt','yuv420p','-c:a','aac','-shortest',master])).code).toBe(0);
    const {source,job:ing}=await ingestMaster(stores,engine,project,{path:master,label:'M5 máster'});
    await eventually(async()=>(await engine.get(ing.id)).status==='completed');
    const tJob=await engine.enqueue(project,'media.transcribe',{target:{kind:'media_source',ref:source.id}});
    await eventually(async()=>(await engine.get(tJob.id)).status==='completed');
    // imagen b-roll taggeada con palabra real del transcript
    const withT=await mediaSources.get(source.id);
    const transcript=JSON.parse(await readFile(withT!.transcriptRef!,'utf8')) as {segments:Array<{text:string}>};
    const palabra=transcript.segments[0].text.split(/\s+/).map(x=>x.replace(/[.,!?¿¡]/g,'')).find(x=>x.length>=4)!.toLowerCase();
    const img=join(dataDir,'broll.png');
    expect((await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=0x1B2A4A:size=640x960:duration=1','-frames:v','1',img])).code).toBe(0);
    await assets.put(assetSchema.parse({schemaVersion:'abrxs.asset.v1',id:'A01',label:`B-roll ${palabra}`,kind:'image',ref:img,
      projectId:project.id,provenance:{origin:'import'},createdAt:new Date().toISOString(),extensions:{tags:[palabra]}}));
    // BATCH auto count=2
    const {batch}=await createBatch(stores,engine,await store.get(project.id),{count:2});
    await eventually(async()=>(await getBatchStatus(stores,engine,batch.id))!.status.status==='completed');
    const st=await getBatchStatus(stores,engine,batch.id);
    expect(st!.status.completed).toBe(2);
    // 2 MP4 vestidos reales
    for(const pid of batch.pieceIds){
      const p=await pieces.get(pid);
      const out=p!.outputRefs.find(r=>r.includes('dressed-'))!;
      const info=await probe(out);
      expect(info.width).toBe(1080);
      expect(info.height).toBe(1920);
    }
    // reopen: piezas, batch y outputs persisten
    const pieces2=new EntityRepository(join(dataDir,'entities','p.json'),pieceSchema,'abrxs.pieces.v1');
    for(const pid of batch.pieceIds){
      const p=await pieces2.get(pid);
      expect(p!.outputRefs.length).toBeGreaterThan(0);
    }
  },420_000);
});

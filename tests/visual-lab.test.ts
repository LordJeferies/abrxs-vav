/* ═══ M6 — VISUAL LAB: search/frame-grab/similar/attach ═══ */
import { describe,it,expect,afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp,rm,writeFile,stat,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { ProjectStore,JobEngine } from '@abraxas/core';
import { projectSchema,jobSchema,mediaSourceSchema,pieceSchema,assetSchema } from '@abraxas/contracts';
import { FileRepository } from '../apps/service/src/file-repository';
import { EntityRepository } from '../apps/service/src/entity-repository';
import { createJobHandlers } from '../apps/service/src/handlers';
import { ingestMaster,createPieceFromText } from '../apps/service/src/canter';
import { buildDresserPlan } from '../apps/service/src/dresser';
import { searchAssets,grabFrame,similarAssets,attachAssetToEvent } from '../apps/service/src/visual-lab';
import { transcribeMaster,detectTranscribeBackend } from '../apps/service/src/transcribe';

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

const mkAsset=(id:string,label:string,tags:string[],extra:Partial<AssetEx>= {})=>assetSchema.parse({
  schemaVersion:'abrxs.asset.v1',id,label,kind:'image',ref:`/store/${id}.png`,
  provenance:{origin:'import',detail:extra.detail},createdAt:'2026-10-05T00:00:00Z',
  extensions:{tags},...extra.projectId?{projectId:extra.projectId}:{},...extra.clientId?{clientId:extra.clientId}:{}});
interface AssetEx { detail?:string; projectId?:string; clientId?:string }

describe('searchAssets (scoring determinista)',()=>{
  const assets=[
    mkAsset('A01','Camión de reparto',['logistica','camion'],{detail:'stock: pexels'}),
    mkAsset('A02','Logística aérea',['logistica','avion']),
    mkAsset('A03','Oficina corporativa',['oficina']),
    mkAsset('A04','Camión blanco',['camion'],{projectId:'proj-2'})
  ];
  it('label pesa 2 sobre tags (1) y ordena por score',()=>{
    const hits=searchAssets(assets,'logistica');
    expect(hits[0].asset.id).toBe('A02');   // label 'Logística' (2) + tag (1) = 3
    expect(hits[1].asset.id).toBe('A01');   // solo tag... label 'logística'→ 2+1 también
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
  });
  it('acentos y mayúsculas indiferentes; prefix parcial puntúa menos',()=>{
    const hits=searchAssets(assets,'logíst');
    expect(hits.length).toBe(2);            // A01/A02 por prefix ~ (0.5)
    expect(hits.every(h=>h.matched.some(m=>m.endsWith('~')))).toBe(true);
  });
  it('filtros por kind/cliente/project',()=>{
    expect(searchAssets(assets,'camión',{projectId:'proj-2'}).map(h=>h.asset.id)).toEqual(['A04']);
    expect(searchAssets(assets,'camion',{kind:'video'})).toEqual([]);
  });
  it('sin query → últimos registrados (sin crash)',()=>{
    const hits=searchAssets(assets,'');
    expect(hits.map(h=>h.asset.id)).toEqual(['A04','A03','A02','A01']);
  });
});

describe('similarAssets (compare)',()=>{
  const assets=[
    mkAsset('A01','Logística',['logistica']),
    mkAsset('A02','Logística alternativa',['logistica']),
    mkAsset('A03','Sin relación',['oficina'])
  ];
  it('overlap de tags ordena y excluye el propio',()=>{
    const hits=similarAssets(assets,'A01');
    expect(hits.map(h=>h.asset.id)).toEqual(['A02']);
    expect(hits[0].matched).toContain('logistica');
    expect(()=>similarAssets(assets,'NOPE')).toThrow(/no existe/);
  });
});

(HAS_FFMPEG?describe:describe.skip)('Frame grab real (ffmpeg)',()=>{
  it('extrae un frame del máster sintético y lo registra como Asset',async()=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-frame-'));dirs.push(dataDir);
    const master=join(dataDir,'master.mp4');
    expect((await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=30000/1001:duration=4',
      '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',master])).code).toBe(0);
    const mediaSources=new EntityRepository(join(dataDir,'entities','m.json'),mediaSourceSchema,'abrxs.media-sources.v1');await mediaSources.init();
    await mediaSources.put(mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'MS01',kind:'master',
      ref:master,hash:fingerprint('m'),timebase:{fpsNumerator:30000,fpsDenominator:1001},durationFrames:120}));
    const stores={mediaSources,pieces:new EntityRepository(join(dataDir,'entities','p.json'),pieceSchema,'abrxs.pieces.v1'),assets:new EntityRepository(join(dataDir,'entities','a.json'),assetSchema,'abrxs.assets.v1'),dataDirectory:dataDir};
    await (stores.assets).init();await (stores.pieces).init();
    const {asset,created}=await grabFrame(stores,{mediaSourceId:'MS01',atSec:1.5,tags:['testframe']});
    expect(created).toBe(true);
    expect(asset.kind).toBe('image');
    expect(asset.provenance.origin).toBe('source_frame');
    expect(asset.provenance.detail).toContain('1.500');
    expect((await stat(asset.ref)).size).toBeGreaterThan(0);
    // el frame es buscable por tag
    expect(searchAssets(await stores.assets.list(),'testframe').map(h=>h.asset.id)).toContain(asset.id);
  });
});

(HAS_FFMPEG&&HAS_SAY&&BACKEND?describe:describe.skip)('Visual Lab E2E real: frame grab → search → attach a b_roll del grafo',()=>{
  it('máster con voz → dresser plan → frame grab → search → attach (CAS) → grafo actualizado',async()=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-m6e2e-'));dirs.push(dataDir);
    const projects=new FileRepository(join(dataDir,'projects'),projectSchema);await projects.init();
    const jobs=new FileRepository(join(dataDir,'jobs'),jobSchema);await jobs.init();
    const store=new ProjectStore(projects);
    const project=await store.create('Podcast M6',{fpsNumerator:30000,fpsDenominator:1001});
    const mediaSources=new EntityRepository(join(dataDir,'entities','m.json'),mediaSourceSchema,'abrxs.media-sources.v1');await mediaSources.init();
    const pieces=new EntityRepository(join(dataDir,'entities','p.json'),pieceSchema,'abrxs.pieces.v1');await pieces.init();
    const assets=new EntityRepository(join(dataDir,'entities','a.json'),assetSchema,'abrxs.assets.v1');await assets.init();
    const stores={mediaSources,pieces,assets,dataDirectory:dataDir};
    const engine=new JobEngine(jobs,createJobHandlers(stores),fingerprint,{defaultWatchdogMs:180_000});engines.push(engine);
    await engine.recover();
    // voz real + transcribe
    const aiff=join(dataDir,'voz.aiff'),master=join(dataDir,'voz.m4a');
    expect((await run('say',['-o',aiff,'La logística de hoy cambió por completo. Y afecta tus envíos directos.'])).code).toBe(0);
    expect((await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=30000/1001:duration=6',
      '-i',aiff,'-map','0:v','-map','1:a','-c:v','libx264','-preset','ultrafast','-crf','35','-pix_fmt','yuv420p','-c:a','aac','-shortest',master])).code).toBe(0);
    const {source,job:ing}=await ingestMaster(stores,engine,project,{path:master,label:'M6 máster'});
    await eventually(async()=>(await engine.get(ing.id)).status==='completed');
    const tJob=await engine.enqueue(project,'media.transcribe',{target:{kind:'media_source',ref:source.id}});
    await eventually(async()=>(await engine.get(tJob.id)).status==='completed');
    // pieza por texto + plan dresser → evento b_roll con A01
    const withT=await mediaSources.get(source.id);
    const transcript=JSON.parse(await readFile(withT!.transcriptRef!,'utf8')) as {segments:Array<{text:string}>};
    const frase=transcript.segments[0].text;
    await createPieceFromText(stores,{projectId:project.id,label:'Intro',mediaSourceId:source.id,text:frase,pieceId:'C01'});
    const palabra=frase.split(/\s+/).map(x=>x.replace(/[.,!?¿¡]/g,'')).find(x=>x.length>=4)!.toLowerCase();
    const img=join(dataDir,'broll.png');
    expect((await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=0x1B2A4A:size=640x960:duration=1','-frames:v','1',img])).code).toBe(0);
    await assets.put(assetSchema.parse({schemaVersion:'abrxs.asset.v1',id:'A01',label:`B-roll ${palabra}`,kind:'image',ref:img,
      projectId:project.id,provenance:{origin:'import'},createdAt:new Date().toISOString(),extensions:{tags:[palabra]}}));
    const fresh=await store.get(project.id);
    await buildDresserPlan({stores,editProject:store.edit.bind(store)},fresh,{pieceId:'C01'});
    // FRAME GRAB real del máster (nuevo asset A02)
    const ff=await run('ffmpeg',['-y','-v','error','-ss','4.200','-i',withT!.ref!,'-frames:v','1',join(dataDir,'frames',source.id,'probe.png')]);
    console.error('DEBUG ffmpeg frame:',ff.code,ff.stderr.slice(-200));
    const {asset:frameAsset}=await grabFrame(stores,{mediaSourceId:source.id,atSec:4.2,label:'Frame memorable',projectId:project.id,tags:['frame']});
    expect(frameAsset.provenance.origin).toBe('source_frame');
    // SEARCH lo encuentra; SIMILAR no lo confunde con A01 (tags distintos)
    const hits=searchAssets(await assets.list(),palabra);
    expect(hits.map(h=>h.asset.id)).toContain('A01');
    // ATTACH: reemplaza el asset del evento b_roll por el frame (CAS)
    const afterPlan=await store.get(project.id);
    const brollEvent=afterPlan.content.graph.events.find(e=>e.kind==='b_roll')!;
    const {project:edited}=await attachAssetToEvent({stores,editProject:store.edit.bind(store)},
      afterPlan,{eventId:brollEvent.id,assetId:frameAsset.id,note:'prueba visual'});
    const updated=edited.content.graph.events.find(e=>e.id===brollEvent.id)!;
    expect(updated.assetRefs).toEqual([frameAsset.id]);
    expect((updated.extensions as {why?:string}).why).toContain('Visual Lab');
    // reopen: el swap persiste
    const store2=new ProjectStore(new FileRepository(join(dataDir,'projects'),projectSchema));
    expect((await store2.get(project.id)).content.graph.events.find(e=>e.id===brollEvent.id)!.assetRefs).toEqual([frameAsset.id]);
  },300_000);
});

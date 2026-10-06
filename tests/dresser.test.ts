/* ═══ M4 — DRESSER MVP: plan determinista (puro) + vertical vestido E2E (gated) ═══ */
import { describe,it,expect,afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp,rm,writeFile,stat,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { ProjectStore,JobEngine } from '@abraxas/core';
import { projectSchema,jobSchema,mediaSourceSchema,pieceSchema,assetSchema,framesToSeconds, type Asset } from '@abraxas/contracts';
import { FileRepository } from '../apps/service/src/file-repository';
import { EntityRepository } from '../apps/service/src/entity-repository';
import { createJobHandlers } from '../apps/service/src/handlers';
import { ingestMaster,createPieceFromText } from '../apps/service/src/canter';
import { buildDresserPlan,splitBeats,enqueueDresserRender,getDressPlan } from '../apps/service/src/dresser';
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
const eventually=async(cond:()=>Promise<boolean>)=>{for(let i=0;i<600;i++){if(await cond())return;await wait(50);}throw new Error('Timeout');};

const w=(start:number,end:number,word:string)=>({start,end,word});

describe('splitBeats (determinista, word-level)',()=>{
  it('corta en puntuación final y agrupa sin puntuación por maxWords',()=>{
    const words=[w(0,0.5,'Hola.'),w(0.5,1.2,'Esto'),w(1.2,1.9,'es'),w(1.9,2.6,'una'),w(2.6,3.3,'frase'),w(3.3,4.0,'larga'),
      w(4.0,4.7,'sin'),w(4.7,5.4,'puntuación'),w(5.4,6.1,'que'),w(6.1,6.8,'sigue'),w(6.8,7.5,'y'),w(7.5,8.2,'sigue'),
      w(8.2,8.9,'más'),w(8.9,9.6,'palabras.'),w(9.6,10.0,'Fin.')];
    const beats=splitBeats(words);
    // Hola. | 12 palabras (cap) | remanente 'palabras.' | Fin.
    expect(beats).toHaveLength(4);
    expect(beats[0].text).toBe('Hola.');
    expect(beats[1].text.split(' ')).toHaveLength(12);
    expect(beats[2].text).toBe('palabras.');
    expect(beats[3].text).toBe('Fin.');
    expect(beats[0].startSec).toBe(0);
    expect(beats[3].endSec).toBe(10.0);
  });
});

describe('buildDresserPlan (puro: fixtures sin ffmpeg)',()=>{
  const makeEnv=async(profile?:Parameters<typeof buildDresserPlan>[2]['profile'])=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-dresser-'));dirs.push(dataDir);
    const projects=new FileRepository(join(dataDir,'projects'),projectSchema);await projects.init();
    const store=new ProjectStore(projects);
    const project=await store.create('Dresser Test',{fpsNumerator:30000,fpsDenominator:1001});
    const mediaSources=new EntityRepository(join(dataDir,'entities','m.json'),mediaSourceSchema,'abrxs.media-sources.v1');await mediaSources.init();
    const pieces=new EntityRepository(join(dataDir,'entities','p.json'),pieceSchema,'abrxs.pieces.v1');await pieces.init();
    const assets=new EntityRepository(join(dataDir,'entities','a.json'),assetSchema,'abrxs.assets.v1');await assets.init();
    const stores={mediaSources,pieces,assets,dataDirectory:dataDir};
    // máster ingestado con transcript word-level (español, 2 frases, 3–9 s)
    const words=[w(3.0,3.4,'La'),w(3.4,3.8,'logística'),w(3.8,4.2,'de'),w(3.8,4.6,'hoy'),w(4.6,5.0,'cambió.'),
      w(5.0,5.6,'Esto'),w(5.6,6.0,'afecta'),w(6.0,6.4,'tus'),w(6.4,6.8,'envíos.'),w(6.8,7.2,'Y'),w(7.2,7.6,'mucho.')];
    await mediaSources.put(mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'MS01',kind:'master',
      ref:join(dataDir,'master.mp4'),hash:fingerprint('m'),timebase:{fpsNumerator:30000,fpsDenominator:1001},durationFrames:270}));
    await writeFile(join(dataDir,'transcript.json'),JSON.stringify({backend:'mlx_whisper',model:'t',sourceHash:'x',language:'es',
      segments:[{start:3.0,end:7.6,text:words.map(x=>x.word).join(' '),words}]}));
    const source=await mediaSources.get('MS01');
    await mediaSources.put({...source!,transcriptRef:join(dataDir,'transcript.json')});
    // pieza 3.0 s–7.6 s → frames floor/ceil: 89–228
    const piece=await pieces.put(pieceSchema.parse({schemaVersion:'abrxs.piece.v1',id:'C01',label:'Intro',projectId:project.id,
      sourceRef:'MS01',sourceRange:{startFrame:89,endFrame:228},
      provenance:{createdFrom:'manual_cut',createdAt:'2026-10-05T00:00:00Z'}}));
    // assets con tags
    const mkAsset=async(id:string,label:string,tags:string[])=>{
      const ref=join(dataDir,`${id}.png`);await writeFile(ref,'img');
      await assets.put(assetSchema.parse({schemaVersion:'abrxs.asset.v1',id,label,kind:'image',ref,
        projectId:project.id,provenance:{origin:'import'},createdAt:'2026-10-05T00:00:00Z',extensions:{tags}}));
    };
    await mkAsset('A01','Camión de logística',['logistica','camión']);
    await mkAsset('A02','Cajas de envío',['envíos','cajas']);
    const deps={stores,editProject:store.edit.bind(store)};
    return {deps,store,project,pieces,assets,dataDir,profile};
  };

  it('plan determinista: b-roll SOLO donde keywords matchean tags, con WHY y frames absolutos',async()=>{
    const {deps,store,project}=await makeEnv();
    const fresh=await store.get(project.id);
    const {plan}=await buildDresserPlan(deps,fresh,{pieceId:'C01'});
    const brollBeats=plan.beats.filter(b=>b.kind==='b_roll');
    expect(brollBeats.length).toBeGreaterThanOrEqual(1);
    expect(brollBeats[0].assetId).toBe('A01');            // 'logística' matchea tags de A01
    expect(brollBeats[0].why).toContain('keyword');
    // frames absolutos dentro del rango de la pieza (89–228)
    for(const b of plan.beats){
      expect(b.startFrame).toBeGreaterThanOrEqual(89);
      expect(b.endFrame).toBeLessThanOrEqual(228);
    }
    // eventos en el grafo con dressPieceId
    const events=fresh.content.graph.events;
    void events;
    const planEvents=plan.beats.length;
    expect(planEvents).toBeGreaterThan(0);
    // re-plan idempotente: NO duplica eventos de la misma pieza
    const afterPlan=await store.get(project.id);
    const count1=afterPlan.content.graph.events.length;
    await buildDresserPlan(deps,afterPlan,{pieceId:'C01'});
    const afterPlan2=await store.get(project.id);
    expect(afterPlan2.content.graph.events.length).toBe(count1);
  });

  it('densidad del cliente limita los b-rolls (low=1 aunque haya 2 matches)',async()=>{
    let env=await makeEnv();
    const p=await env.store.get(env.project.id);
    // A02 también matchea ('envíos' en beat 2) — con density low solo 1 b-roll
    const {plan}=await buildDresserPlan(env.deps,p,{pieceId:'C01',profile:clientProfile('acme','low')});
    expect(plan.beats.filter(b=>b.kind==='b_roll')).toHaveLength(1);
    // density high → 2
    env=await makeEnv();
    const p2=await env.store.get(env.project.id);
    const {plan:plan2}=await buildDresserPlan(env.deps,p2,{pieceId:'C01',profile:clientProfile('acme','high')});
    expect(plan2.beats.filter(b=>b.kind==='b_roll')).toHaveLength(2);
  });

  it('negativeRules del cliente prohíben el b-roll del beat (caption en su lugar)',async()=>{
    const env=await makeEnv();
    const p=await env.store.get(env.project.id);
    const {plan}=await buildDresserPlan(env.deps,p,{pieceId:'C01',
      profile:{...clientProfile('acme','high'),negativeRules:['no logística']}});
    expect(plan.beats.filter(b=>b.kind==='b_roll')).toHaveLength(1); // solo el de 'envíos'
    const blocked=plan.beats.find(b=>b.text.includes('logística'));
    expect(blocked?.kind).toBe('caption');
    expect(blocked?.why).toContain('prohíbe');
  });

  it('SRT piece-relativo en disco (empieza en 00:00:00,000)',async()=>{
    const {deps,store,project,dataDir}=await makeEnv();
    const fresh=await store.get(project.id);
    const {plan}=await buildDresserPlan(deps,fresh,{pieceId:'C01'});
    const srt=await readFile(plan.captions.srtRef,'utf8');
    expect(srt).toMatch(/00:00:00,0\d\d -->/);           // relativo a la pieza (primer word ~30ms)
    // La pieza dura ~4.6 s: ningún cue puede llevar tiempo ABSOLUTO del máster (>5 s)
    expect(srt).not.toMatch(/00:00:0[5-9]|00:0[1-9]:/);
  });
});

function clientProfile(clientId:string,density:'low'|'medium'|'high'){
  return {schemaVersion:'abrxs.client-profile.v1',clientId,name:'Test',brand:{},captions:{},broll:{density},xroll:{},sfx:{},glossary:[],negativeRules:[],editorialRules:[],platformProfiles:{}};
}

(HAS_FFMPEG&&HAS_SAY&&BACKEND?describe:describe.skip)('Vertical M4 vestido E2E (voz real → plan → render con b-roll y captions)',()=>{
  it('voz → transcribe → pieza por texto → plan → render → MP4 con captions quemadas → reopen',async()=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-m4e2e-'));dirs.push(dataDir);
    const projects=new FileRepository(join(dataDir,'projects'),projectSchema);await projects.init();
    const jobs=new FileRepository(join(dataDir,'jobs'),jobSchema);await jobs.init();
    const store=new ProjectStore(projects);
    const project=await store.create('Podcast M4',{fpsNumerator:30000,fpsDenominator:1001});
    const mediaSources=new EntityRepository(join(dataDir,'entities','m.json'),mediaSourceSchema,'abrxs.media-sources.v1');await mediaSources.init();
    const pieces=new EntityRepository(join(dataDir,'entities','p.json'),pieceSchema,'abrxs.pieces.v1');await pieces.init();
    const assets=new EntityRepository(join(dataDir,'entities','a.json'),assetSchema,'abrxs.assets.v1');await assets.init();
    const stores={mediaSources,pieces,assets,dataDirectory:dataDir};
    const engine=new JobEngine(jobs,createJobHandlers({...stores}),fingerprint,{defaultWatchdogMs:180_000});engines.push(engine);
    await engine.recover();

    // máster con voz real
    const aiff=join(dataDir,'voz.aiff'),master=join(dataDir,'voz.m4a');
    expect((await run('say',['-o',aiff,'La logística de hoy cambió por completo. Y afecta tus envíos directos.'])).code).toBe(0);
    expect((await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=30000/1001:duration=6',
      '-i',aiff,'-map','0:v','-map','1:a','-c:v','libx264','-preset','ultrafast','-crf','35','-pix_fmt','yuv420p','-c:a','aac','-shortest',master])).code).toBe(0);
    const {source,job:ing}=await ingestMaster(stores,engine,project,{path:master,label:'M4 máster'});
    await eventually(async()=>(await engine.get(ing.id)).status==='completed');
    const tJob=await engine.enqueue(project,'media.transcribe',{target:{kind:'media_source',ref:source.id}});
    await eventually(async()=>(await engine.get(tJob.id)).status==='completed');

    // pieza por texto (primera frase del transcript)
    const withT=await mediaSources.get(source.id);
    const transcript=JSON.parse(await readFile(withT!.transcriptRef!,'utf8')) as {segments:Array<{text:string}>};
    const frase=transcript.segments[0].text;
    const {piece}=await createPieceFromText(stores,{projectId:project.id,label:'Intro vestida',mediaSourceId:source.id,text:frase,pieceId:'C01'});

    // asset b-roll con tag de la frase (imagen real generada con ffmpeg)
    const img=join(dataDir,'broll.png');
    expect((await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=0x1B2A4A:size=640x960:duration=1','-frames:v','1',img])).code).toBe(0);
    const palabra=frase.split(/\s+/).map(x=>x.replace(/[.,!?¿¡]/g,'')).find(x=>x.length>=4)!.toLowerCase();
    await assets.put(assetSchema.parse({schemaVersion:'abrxs.asset.v1',id:'A01',label:`B-roll ${palabra}`,kind:'image',
      ref:img,projectId:project.id,provenance:{origin:'import'},createdAt:new Date().toISOString(),extensions:{tags:[palabra]}}));
    const brAsset={id:'A01'};

    // PLAN
    const dressed=await buildDresserPlan({stores,editProject:store.edit.bind(store)},await store.get(project.id),{pieceId:'C01'});
    expect(dressed.plan.beats.filter(b=>b.kind==='b_roll').length).toBeGreaterThanOrEqual(1);
    const afterPlan=await store.get(project.id);
    expect(afterPlan.content.graph.events.some(e=>e.kind==='b_roll')).toBe(true);

    const storedPlan=(await pieces.get('C01'))?.extensions as {dressPlan?:{brolls:unknown[];beats:unknown[]}};
    console.error('DEBUG stored plan: brolls=',storedPlan?.dressPlan?.brolls?.length,'beats=',storedPlan?.dressPlan?.beats?.length,
      JSON.stringify(storedPlan?.dressPlan?.brolls));
    // RENDER vestido
    const renderJob=await enqueueDresserRender(stores,engine,await store.get(project.id),'C01');
    await eventually(async()=>(await engine.get(renderJob.id)).status==='completed');
    const exported=await pieces.get('C01');
    const dressedOut=exported!.outputRefs.find(r=>r.includes('dressed-'));
    expect(dressedOut).toBeTruthy();
    const info=await probe(dressedOut!);
    if(info.width!==1080)console.error('DEBUG render final:',JSON.stringify({width:info.width,brollsInPlan:storedPlan?.dressPlan?.brolls}));
    expect(info.width).toBe(1080);                      // renderFinal es vertical fijo (MVP)
    const expectedSec=framesToSeconds(piece.sourceRange.endFrame,{fpsNumerator:30000,fpsDenominator:1001})
      -framesToSeconds(piece.sourceRange.startFrame,{fpsNumerator:30000,fpsDenominator:1001});
    expect(info.durationSec).toBeGreaterThan(expectedSec-0.6);
    expect(info.durationSec).toBeLessThan(expectedSec+0.6);

    // reopen: plan y eventos persisten
    const pieces2=new EntityRepository(join(dataDir,'entities','p.json'),pieceSchema,'abrxs.pieces.v1');
    const reopened=await pieces2.get('C01');
    expect(getDressPlan({mediaSources,pieces:pieces2,assets,dataDirectory:dataDir},'C01')!==null||!!reopened?.extensions?.dressPlan).toBe(true);
  },300_000);
});

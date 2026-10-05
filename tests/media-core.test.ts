import { describe,it,expect,afterEach } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { ProjectStore,JobEngine,type JobHandler } from '@abraxas/core';
import { pieceSchema,mediaSourceSchema,jobSchema,defaultJobTarget,type Job } from '@abraxas/contracts';
import { FileRepository } from '../apps/service/src/file-repository';
import { handlers } from '../apps/service/src/handlers';

const directories:string[]=[];
const engines:JobEngine[]=[];
afterEach(async()=>{for(const engine of engines.splice(0))await engine.stop();for(const dir of directories.splice(0))await rm(dir,{recursive:true,force:true});});

const TB={fpsNumerator:30000,fpsDenominator:1001};

describe('Piece (abrxs.piece.v1)',()=>{
  const valid={schemaVersion:'abrxs.piece.v1',id:'C01',label:'Clip vertical TikTok',projectId:'proj-1',
    sourceRef:'MS01',sourceRange:{startFrame:0,endFrame:1800},
    provenance:{createdFrom:'manual_cut',createdAt:'2026-10-05T00:00:00.000Z'}};
  it('valida una pieza completa y aplica defaults',()=>{
    const piece=pieceSchema.parse(valid);
    expect(piece.status).toBe('draft');
    expect(piece.outputRefs).toEqual([]);
    expect(piece.eventRefs).toEqual([]);
  });
  it('representa clips verticales, horizontales, segmentos y material derivado',()=>{
    for(const label of ['Vertical 9:16','Horizontal 16:9','Segmento 02','Derivado waveform']){
      expect(()=>pieceSchema.parse({...valid,id:label.replace(/\s/g,''),label})).not.toThrow();
    }
  });
  it('rechaza rango inválido, estado desconocido, label vacío y provenance sin createdFrom',()=>{
    expect(()=>pieceSchema.parse({...valid,sourceRange:{startFrame:10,endFrame:10}})).toThrow(/posterior/);
    expect(()=>pieceSchema.parse({...valid,sourceRange:{startFrame:20,endFrame:10}})).toThrow();
    expect(()=>pieceSchema.parse({...valid,status:'published'})).toThrow();
    expect(()=>pieceSchema.parse({...valid,label:'   '})).toThrow();
    expect(()=>pieceSchema.parse({...valid,provenance:{createdAt:'2026-10-05T00:00:00.000Z'}})).toThrow();
  });
  it('exige campos de identidad y relación con el Production Graph',()=>{
    expect(()=>pieceSchema.parse({...valid,id:''})).toThrow();
    expect(()=>pieceSchema.parse({...valid,projectId:''})).toThrow();
    expect(()=>pieceSchema.parse({...valid,sourceRef:''})).toThrow();
  });
});

describe('MediaSource (abrxs.media-source.v1)',()=>{
  it('valida una fuente mínima (id/kind/ref)',()=>{
    const source=mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'MS01',kind:'master',ref:'/media/ep32/master.mov'});
    expect(source.extensions).toBeUndefined();
  });
  it('valida una fuente completa con hash, timebase, audio y derivados',()=>{
    expect(()=>mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'MS01',kind:'master',
      ref:'/media/ep32/master.mov',hash:'a'.repeat(64),hashAlgorithm:'sha256',
      durationFrames:107892,timebase:TB,width:3840,height:2160,codec:'prores',
      audio:{present:true,channels:2,sampleRate:48000},
      proxyRef:'/media/ep32/proxy_540.mp4',waveformRef:'/media/ep32/waveform.png',filmstripRef:'/media/ep32/filmstrip.jpg'})).not.toThrow();
  });
  it('acepta todos los kinds previstos (incluidos los futuros)',()=>{
    for(const kind of ['master','proxy','audio','image','video','generated_video','final_render']){
      expect(()=>mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'X',kind,ref:'r'})).not.toThrow();
    }
    expect(()=>mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'X',kind:'ffmpeg_project',ref:'r'})).toThrow();
  });
  it('durationFrames exige timebase racional (el frame sin fps no tiene significado)',()=>{
    expect(()=>mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'X',kind:'video',ref:'r',durationFrames:100})).toThrow(/timebase/);
    expect(()=>mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'X',kind:'video',ref:'r',durationFrames:100,timebase:TB})).not.toThrow();
  });
  it('no permite detalles de FFmpeg en el contrato (ref opaca)',()=>{
    // El contrato acepta cualquier ref: la interpretación vive en la frontera (media.ts), no aquí.
    expect(()=>mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'X',kind:'video',ref:'s3://bucket/master.mov'})).not.toThrow();
  });
});

describe('Job target + payload (v2.5, compatible con jobs v2 existentes)',()=>{
  it('los jobs legados sin target siguen validando (muestra del repo)',async()=>{
    const { readFile }=await import('node:fs/promises');
    const sample=JSON.parse(await readFile(new URL('../samples/job.sample.json',import.meta.url),'utf8'));
    const job=jobSchema.parse(sample);
    expect(job.target).toBeUndefined();
    expect(defaultJobTarget(job.projectId)).toEqual({kind:'project',ref:job.projectId});
  });
  it('enqueue sin target → target por defecto es el proyecto completo',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'abrxs-mediacore-'));directories.push(dir);
    const repo=new FileRepository(join(dir,'projects'),(await import('@abraxas/contracts')).projectSchema);await repo.init();
    const jobs=new FileRepository(join(dir,'jobs'),jobSchema);await jobs.init();
    const store=new ProjectStore(repo);const project=await store.create('Target Test',TB);
    const engine=new JobEngine(jobs,{'project.validate':handlers['project.validate']},value=>createHash('sha256').update(value).digest('hex'));
    engines.push(engine);
    const job=await engine.enqueue(project,'project.validate');
    expect(job.target).toEqual({kind:'project',ref:project.id});
  });
  it('enqueue con target event lo persiste y lo aísla en el fingerprint',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'abrxs-mediacore-'));directories.push(dir);
    const repo=new FileRepository(join(dir,'projects'),(await import('@abraxas/contracts')).projectSchema);await repo.init();
    const jobs=new FileRepository(join(dir,'jobs'),jobSchema);await jobs.init();
    const store=new ProjectStore(repo);const project=await store.create('Target Test',TB);
    const engine=new JobEngine(jobs,{'project.validate':handlers['project.validate']},value=>createHash('sha256').update(value).digest('hex'));
    engines.push(engine);
    const jobA=await engine.enqueue(project,'project.validate',{target:{kind:'event',ref:'A01'}});
    const jobB=await engine.enqueue(project,'project.validate',{target:{kind:'event',ref:'B02'}});
    expect(jobA.target).toEqual({kind:'event',ref:'A01'});
    expect(jobB.id).not.toBe(jobA.id); // distinto target ⇒ distinto trabajo (nunca dedupe accidental)
    const jobA2=await engine.enqueue(project,'project.validate',{target:{kind:'event',ref:'A01'}});
    expect(jobA2.id).toBe(jobA.id);   // mismo target + misma revisión ⇒ idempotente
  });
  it('media.generate con target event resuelve EXACTAMENTE ese evento',async()=>{
    const content={name:'T',graph:{schemaVersion:'abraxas.production-graph.v2',projectId:'p',timebase:TB,events:[
      {id:'EV_RECIPE',kind:'image',startFrame:0,endFrame:120,status:'planned',extensions:{recipe:{strategy:'demo',workflow:'std',prompt:'un gato'}}},
      {id:'EV_OTRO',kind:'image',startFrame:120,endFrame:240,status:'planned',extensions:{recipe:{strategy:'demo',workflow:'std',prompt:'otro'}}}
    ]}};
    const base={projectId:'00000000-0000-0000-0000-000000000000',sourceRevision:1,progress:0,attempt:1,maxAttempts:3,createdAt:'',updatedAt:''} as const;
    const output=await handlers['media.generate']({...base,input:content,target:{kind:'event',ref:'EV_OTRO'}} as unknown as Job,{signal:new AbortController().signal,progress:async()=>{}});
    expect(JSON.parse(output).event).toBe('EV_OTRO');
  });
  it('media.generate con target inexistente falla con error explícito (nunca resuelve otro evento)',async()=>{
    const content={name:'T',graph:{schemaVersion:'abraxas.production-graph.v2',projectId:'p',timebase:TB,events:[
      {id:'EV_RECIPE',kind:'image',startFrame:0,endFrame:120,status:'planned',extensions:{recipe:{strategy:'demo',workflow:'std',prompt:'un gato'}}}
    ]}};
    const base={projectId:'00000000-0000-0000-0000-000000000000',sourceRevision:1,progress:0,attempt:1,maxAttempts:3,createdAt:'',updatedAt:''} as const;
    await expect(handlers['media.generate']({...base,input:content,target:{kind:'event',ref:'NOPE'}} as unknown as Job,
      {signal:new AbortController().signal,progress:async()=>{}})).rejects.toThrow(/NOPE.*no existe/);
  });
  it('media.generate legado (sin target) conserva el comportamiento anterior',async()=>{
    const content={name:'T',graph:{schemaVersion:'abraxas.production-graph.v2',projectId:'p',timebase:TB,events:[
      {id:'EV_RECIPE',kind:'image',startFrame:0,endFrame:120,status:'planned',extensions:{recipe:{strategy:'demo',workflow:'std',prompt:'un gato'}}}
    ]}};
    const base={projectId:'00000000-0000-0000-0000-000000000000',sourceRevision:1,progress:0,attempt:1,maxAttempts:3,createdAt:'',updatedAt:''} as const;
    const output=await handlers['media.generate']({...base,input:content} as unknown as Job,{signal:new AbortController().signal,progress:async()=>{}});
    expect(JSON.parse(output).event).toBe('EV_RECIPE');
  });
  it('motion.render con target event renderiza solo ese evento',async()=>{
    const composition={id:'comp',fps:30,width:1080,height:1920,durationFrames:30,layers:[{id:'L1',kind:'text',text:'Hola',startFrame:0,endFrame:30}]};
    const content={name:'T',graph:{schemaVersion:'abraxas.production-graph.v2',projectId:'p',timebase:TB,events:[
      {id:'MO01',kind:'motion',startFrame:0,endFrame:30,status:'planned',extensions:{motionComposition:composition}},
      {id:'MO02',kind:'motion',startFrame:30,endFrame:60,status:'planned',extensions:{motionComposition:composition}}
    ]}};
    const base={projectId:'00000000-0000-0000-0000-000000000000',sourceRevision:1,progress:0,attempt:1,maxAttempts:3,createdAt:'',updatedAt:''} as const;
    const output=await handlers['motion.render']({...base,input:content,target:{kind:'event',ref:'MO02'}} as unknown as Job,{signal:new AbortController().signal,progress:async()=>{}});
    const parsed=JSON.parse(output);
    expect(parsed.compositions).toHaveLength(1);
    expect(parsed.compositions[0].event).toBe('MO02');
  });
});

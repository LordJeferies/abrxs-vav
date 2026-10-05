/* ═══ M2 — TRANSCRIPCIÓN LOCAL REAL (gated a mlx_whisper + modelo cacheado) ═══
   macOS `say` sintetiza voz real → ffmpeg a m4a → media.transcribe con
   mlx_whisper (modelo YA cacheado en el Mac) → words.json canónico + SRT/TXT.
   Sin backend/modelo → los tests se saltan honestamente (CI sin MLX). */
import { describe,it,expect,afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp,rm,stat,readFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { mediaSourceSchema,mediaSourceSchema as ms } from '@abraxas/contracts';
import { EntityRepository } from '../apps/service/src/entity-repository';
import { createJobHandlers } from '../apps/service/src/handlers';
import { transcribeMaster,detectTranscribeBackend } from '../apps/service/src/transcribe';

const run=(cmd:string,args:string[],timeout=60_000):Promise<{code:number;stdout:string;stderr:string}>=>new Promise(resolve=>{
  execFile(cmd,args,{timeout,maxBuffer:16*1024*1024},(err,stdout,stderr)=>{
    if(!err)return resolve({code:0,stdout,stderr});
    resolve({code:typeof err.code==='number'?err.code:127,stdout,stderr});
  });
});
const HAS_SAY=await run('say',['-v','?']).then(r=>r.code===0);
const BACKEND=await detectTranscribeBackend().catch(()=>null);
const GATED=HAS_SAY&&!!BACKEND;

const dirs:string[]=[];
afterAll(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
const fingerprint=(v:string)=>createHash('sha256').update(v).digest('hex');

(GATED?describe:describe.skip)('Transcripción local real (mlx_whisper, modelo cacheado)',()=>{
  it('detecta backend mlx_whisper con modelo cacheado',()=>{
    expect(BACKEND?.backend).toBe('mlx_whisper');
    expect(BACKEND?.model).toMatch(/mlx-community\//);
  });
  it('voz sintetizada → words.json + SRT + TXT con cache por hash',async()=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-transcribe-'));dirs.push(dataDir);
    const aiff=join(dataDir,'voz.aiff'),master=join(dataDir,'voz.m4a');
    expect((await run('say',['-o',aiff,'Hola, esto es una prueba de transcripción local de AbrxsVAV.'])).code).toBe(0);
    expect((await run('ffmpeg',['-y','-v','error','-i',aiff,'-c:a','aac',master])).code).toBe(0);
    const source=ms.parse({schemaVersion:'abrxs.media-source.v1',id:'MS_VOZ',kind:'master',ref:master,
      hash:fingerprint('voz-fixture'),timebase:{fpsNumerator:30000,fpsDenominator:1001},durationFrames:120});
    const result=await transcribeMaster({sourceRef:master,sourceHash:source.hash!,
      outDir:join(dataDir,'transcriptions','MS_VOZ'),signal:new AbortController().signal});
    expect(result.cached).toBe(false);
    expect((await stat(result.wordsRef)).size).toBeGreaterThan(0);
    const words=JSON.parse(await readFile(result.wordsRef,'utf8'));
    expect(words.segments.length).toBeGreaterThan(0);
    expect(words.sourceHash).toBe(source.hash);
    expect(await readFile(result.srtRef,'utf8')).toContain('-->');
    expect(await readFile(result.txtRef,'utf8').then(t=>t.toLowerCase())).toContain('transcripci');
    // CACHE: segunda llamada con el mismo hash NO re-ejecuta whisper.
    const again=await transcribeMaster({sourceRef:master,sourceHash:source.hash!,
      outDir:join(dataDir,'transcriptions','MS_VOZ')});
    expect(again.cached).toBe(true);
  },300_000);
  it('handler media.transcribe con cache invalidado re-transcribe y actualiza transcriptRef',async()=>{
    const dataDir=await mkdtemp(join(tmpdir(),'abrxs-transcribe2-'));dirs.push(dataDir);
    const aiff=join(dataDir,'voz2.aiff'),master=join(dataDir,'voz2.m4a');
    await run('say',['-o',aiff,'Segunda prueba de audio para el motor.']);
    await run('ffmpeg',['-y','-v','error','-i',aiff,'-c:a','aac',master]);
    const sources=new EntityRepository(join(dataDir,'entities','m.json'),mediaSourceSchema,'abrxs.media-sources.v1');await sources.init();
    const pieces=new EntityRepository(join(dataDir,'entities','p.json'),mediaSourceSchema,'abrxs.pieces.v1');await pieces.init();
    const handlers=createJobHandlers({mediaSources:sources,pieces:pieces as never,dataDirectory:dataDir});
    const source=mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'MS01',kind:'master',ref:master,
      hash:fingerprint('voz2'),timebase:{fpsNumerator:30000,fpsDenominator:1001},durationFrames:100});
    await sources.put(source);
    const out=await handlers['media.transcribe']({target:{kind:'media_source',ref:'MS01'}} as never,
      {signal:new AbortController().signal,progress:async()=>{}});
    const parsed=JSON.parse(out);
    expect(parsed.source).toBe('MS01');
    expect(parsed.segments).toBeGreaterThan(0);
    const updated=await sources.get('MS01');
    expect(updated?.transcriptRef).toBeTruthy();
    expect(updated?.extensions?.transcript).toBeTruthy();
  },300_000);
});

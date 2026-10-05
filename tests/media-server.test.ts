/* ═══ E2E HTTP del servidor REAL (proceso hijo) — enfoque en seguridad del
   endpoint de media y en el vertical texto→pieza vía API. El servidor arranca
   con ABRAXAS_DATA_DIR temporal y puerto efímero; las entidades se siembran
   directamente en disco (sin ffmpeg: el streaming no valida contenido). */
import { describe,it,expect,afterAll } from 'vitest';
import { spawn,type ChildProcess } from 'node:child_process';
import { mkdtemp,rm,writeFile,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mediaSourceSchema } from '@abraxas/contracts';
import { EntityRepository } from '../apps/service/src/entity-repository';

const dataDir=await mkdtemp(join(tmpdir(),'abrxs-http-'));
const PORT=4399,BASE=`http://127.0.0.1:${PORT}`;
let server:ChildProcess|null=null;
let ready=false;

// Sembrar: media source MS01 con master/proxy reales dentro del dataDir,
// y una pieza C01 para update/delete.
const mediaDir=join(dataDir,'media','MS01');
await mkdir(mediaDir,{recursive:true});
await writeFile(join(mediaDir,'master.mp4'),Buffer.alloc(2048,7));
await writeFile(join(mediaDir,'proxy_540.mp4'),Buffer.alloc(512,3));
const sources=new EntityRepository(join(dataDir,'entities','media-sources.json'),mediaSourceSchema,'abrxs.media-sources.v1');
await sources.init();
const wordsPath=join(mediaDir,'transcript.words.json');
const wordsRepeatedPath=join(mediaDir,'transcript-repeated.words.json');
await writeFile(wordsPath,JSON.stringify({backend:'mlx_whisper',model:'test',sourceHash:'a'.repeat(64),language:'es',
  segments:[{start:0.4,end:1.2,text:'Bienvenidos al programa de hoy',words:[
    {start:0.4,end:0.7,word:'Bienvenidos'},{start:0.7,end:0.85,word:'al'},{start:0.85,end:1.0,word:'programa'},{start:1.0,end:1.2,word:'de hoy'}]},
    {start:1.4,end:2.0,text:'Vamos a empezar',words:[
    {start:1.4,end:1.7,word:'Vamos'},{start:1.7,end:1.9,word:'a'},{start:1.9,end:2.0,word:'empezar'}]}]}));
await writeFile(wordsRepeatedPath,JSON.stringify({backend:'mlx_whisper',model:'test',sourceHash:'b'.repeat(64),language:'es',
  segments:[{start:0.4,end:1.0,text:'Vamos a empezar',words:[
    {start:0.4,end:0.7,word:'Vamos'},{start:0.7,end:0.85,word:'a'},{start:0.85,end:1.0,word:'empezar'}]},
    {start:2.0,end:2.6,text:'Vamos a empezar',words:[
    {start:2.0,end:2.3,word:'Vamos'},{start:2.3,end:2.45,word:'a'},{start:2.45,end:2.6,word:'empezar'}]}]}));
await sources.put(mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'MS01',kind:'master',
  ref:join(mediaDir,'master.mp4'),hash:'a'.repeat(64),hashAlgorithm:'sha256',
  timebase:{fpsNumerator:30000,fpsDenominator:1001},durationFrames:600,proxyRef:join(mediaDir,'proxy_540.mp4'),transcriptRef:wordsPath}));
await sources.put(mediaSourceSchema.parse({schemaVersion:'abrxs.media-source.v1',id:'MS02',kind:'master',
  ref:join(mediaDir,'master.mp4'),hash:'b'.repeat(64),hashAlgorithm:'sha256',
  timebase:{fpsNumerator:30000,fpsDenominator:1001},durationFrames:600,transcriptRef:wordsRepeatedPath}));

function start():Promise<void>{
  return new Promise((resolve,reject)=>{
    server=spawn('node',['--import','tsx','apps/service/src/server.ts'],{
      cwd:process.cwd(),
      env:{...process.env,ABRAXAS_DATA_DIR:dataDir,ABRAXAS_PORT:String(PORT)},
      stdio:['ignore','pipe','pipe']
    });
    let out='';
    const timer=setTimeout(()=>reject(new Error('Server timeout: '+out)),20_000);
    server.stdout!.on('data',c=>{out+=c;if(out.includes('http://127.0.0.1')){clearTimeout(timer);ready=true;resolve();}});
    server.stderr!.on('data',c=>{out+=c;});
    server.on('exit',code=>{if(!ready){clearTimeout(timer);reject(new Error('Server exit '+code+': '+out));}});
  });
}
afterAll(async()=>{
  server?.kill('SIGTERM');
  await new Promise(r=>setTimeout(r,300));
  await rm(dataDir,{recursive:true,force:true});
});

describe('Servidor HTTP real — seguridad y vertical por API',()=>{
  it('arranca y responde health',async()=>{
    await start();
    const h=await fetch(`${BASE}/api/health`);
    expect(h.status).toBe(200);
    expect((await h.json()).version).toBe('0.6.0');
  });
  it('GET /api/media/MS01/file?kind=proxy → 200 con Accept-Ranges y Content-Length',async()=>{
    const r=await fetch(`${BASE}/api/media/MS01/file?kind=proxy`);
    expect(r.status).toBe(200);
    expect(r.headers.get('accept-ranges')).toBe('bytes');
    expect(r.headers.get('content-length')).toBe('512');
    expect(r.headers.get('content-type')).toBe('video/mp4');
    expect(Buffer.from(await r.arrayBuffer()).length).toBe(512);
  });
  it('Range válido → 206 con Content-Range correcto',async()=>{
    const r=await fetch(`${BASE}/api/media/MS01/file?kind=master`,{headers:{Range:'bytes=100-299'}});
    expect(r.status).toBe(206);
    expect(r.headers.get('content-range')).toBe('bytes 100-299/2048');
    expect(r.headers.get('content-length')).toBe('200');
  });
  it('Range suffix (bytes=-100) → 206 de los últimos 100 bytes',async()=>{
    const r=await fetch(`${BASE}/api/media/MS01/file?kind=master`,{headers:{Range:'bytes=-100'}});
    expect(r.status).toBe(206);
    expect(r.headers.get('content-range')).toBe('bytes 1948-2047/2048');
  });
  it('Range inválido → 416 con Content-Range completo',async()=>{
    for(const bad of ['bytes=9999-','bytes=0-99999','bytes=abc','items=0-1','bytes=-0']){
      const r=await fetch(`${BASE}/api/media/MS01/file?kind=master`,{headers:{Range:bad}});
      expect(r.status,`Range ${bad}`).toBe(416);
      expect(r.headers.get('content-range')).toBe('bytes */2048');
    }
  });
  it('kind inexistente / id inexistente → 404 (sin filtrar paths)',async()=>{
    expect((await fetch(`${BASE}/api/media/MS01/file?kind=secreto`)).status).toBe(404);
    expect((await fetch(`${BASE}/api/media/MS99/file?kind=master`)).status).toBe(404);
  });
  it('id con caracteres peligrosos → 400 (nunca path arbitrario)',async()=>{
    for(const bad of ['..%2F..%2Fetc','MS01%2F..%2F..','MS%2D01%2E%2E']){
      const r=await fetch(`${BASE}/api/media/${bad}/file?kind=master`);
      expect([400,404]).toContain(r.status); // jamás 200 con contenido fuera del store
    }
  });
  it('endpoint de paths arbitrarios NO existe (el viejo media-file fue eliminado)',async()=>{
    const r=await fetch(`${BASE}/api/media-file?path=/etc/passwd`);
    expect(r.status).toBe(404);
  });
  it('vertical texto→pieza por API: transcript → align → piece → update → delete',async()=>{
    // GET transcript (MS01 sembrado ANTES de arrancar el server: single-writer)
    const tr=await fetch(`${BASE}/api/canter/transcript/MS01`);
    expect(tr.status).toBe(200);
    expect(((await tr.json()) as {segments:unknown[]}).segments).toHaveLength(2);
    // align preview
    const al=await fetch(`${BASE}/api/canter/align`,{method:'POST',headers:{'Content-Type':'application/json','X-Abraxas-Client':'local'},
      body:JSON.stringify({mediaSourceId:'MS01',text:'Bienvenidos al programa'})});
    const align=await al.json() as {candidates:Array<{startFrame:number;endFrame:number}>};
    expect(align.candidates).toHaveLength(1);
    expect(align.candidates[0].startFrame).toBe(11);   // floor(0.4*30000/1001)=11
    expect(align.candidates[0].endFrame).toBeGreaterThan(20);
    // proyecto + pieza desde texto
    const proj=await (await fetch(`${BASE}/api/projects`,{method:'POST',headers:{'Content-Type':'application/json','X-Abraxas-Client':'local'},
      body:JSON.stringify({name:'HTTP Test',timebase:{fpsNumerator:30000,fpsDenominator:1001}})})).json() as {id:string;revision:number};
    const created=await fetch(`${BASE}/api/canter/pieces/from_text`,{method:'POST',headers:{'Content-Type':'application/json','X-Abraxas-Client':'local'},
      body:JSON.stringify({projectId:proj.id,revision:proj.revision,label:'Intro',mediaSourceId:'MS01',text:'Vamos a empezar'})});
    expect(created.status).toBe(201);
    const piece=await created.json() as {id:string,sourceRange:{startFrame:number;endFrame:number},provenance:{createdFrom:string}};
    expect(piece.provenance.createdFrom).toBe('transcript_text_alignment');
    expect(piece.sourceRange.startFrame).toBe(41);      // floor(1.4*29.97)=41
    expect(piece.sourceRange.endFrame).toBe(60);        // ceil(2.0*29.97)=60
    // ambigüedad NO crea (texto repetido en MS02) → 409 con 2 candidates
    const amb=await fetch(`${BASE}/api/canter/pieces/from_text`,{method:'POST',headers:{'Content-Type':'application/json','X-Abraxas-Client':'local'},
      body:JSON.stringify({projectId:proj.id,revision:proj.revision,label:'Ambigua',mediaSourceId:'MS02',text:'Vamos a empezar'})});
    expect(amb.status).toBe(409);
    const ambBody=await amb.json() as {candidates:unknown[]};
    expect(ambBody.candidates).toHaveLength(2);
    // candidateIndex explícito SÍ crea la segunda
    const forced=await fetch(`${BASE}/api/canter/pieces/from_text`,{method:'POST',headers:{'Content-Type':'application/json','X-Abraxas-Client':'local'},
      body:JSON.stringify({projectId:proj.id,revision:proj.revision,label:'Segunda',mediaSourceId:'MS02',text:'Vamos a empezar',candidateIndex:1})});
    expect(forced.status).toBe(201);
    const forcedPiece=await forced.json() as {sourceRange:{startFrame:number}};
    expect(forcedPiece.sourceRange.startFrame).toBe(59); // floor(2.0*29.97)=59
    // update + delete
    const up=await fetch(`${BASE}/api/canter/pieces/${piece.id}`,{method:'PUT',headers:{'Content-Type':'application/json','X-Abraxas-Client':'local'},
      body:JSON.stringify({label:'Intro v2',sourceRange:{startFrame:12,endFrame:60}})});
    expect(up.status).toBe(200);
    const del=await fetch(`${BASE}/api/canter/pieces/${piece.id}/delete`,{method:'POST',headers:{'Content-Type':'application/json','X-Abraxas-Client':'local'},body:'{}'});
    expect(del.status).toBe(200);
    const list=await (await fetch(`${BASE}/api/canter/pieces?projectId=${proj.id}`)).json() as {pieces:unknown[]};
    expect(list.pieces).toHaveLength(1); // quedó solo la forzada
  },30_000);
});

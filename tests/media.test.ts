import { describe,it,expect,beforeAll,afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp,rm,mkdir,writeFile,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash,randomBytes } from 'node:crypto';
import { sha256File,planThumbnailTimestamps,probeDurationSec,makeFilmstrip,probe,cutPiece,renderFinal,escapeFilterPath } from '../apps/service/src/media';
import { runMediaChecks } from '../scripts/doctor-media';

const run=(cmd:string,args:string[]):Promise<{code:number;stdout:string;stderr:string}>=>new Promise(resolve=>{
  execFile(cmd,args,{timeout:120_000,maxBuffer:16*1024*1024},(err,stdout,stderr)=>{
    if(!err)return resolve({code:0,stdout,stderr});
    resolve({code:typeof err.code==='number'?err.code:127,stdout,stderr});
  });
});
const HAS_FFMPEG=await run('ffmpeg',['-version']).then(r=>r.code===0);

/* Fixtures sintéticos (testsrc2): nada de videos privados del usuario. */
const dirs:string[]=[];
let plainDir='';
let nastyDir='';
let master='';
let nastyVideo='';
let nastySrt='';
async function synthVideo(out:string,durationSec=10,width=320,height=240){
  const r=await run('ffmpeg',['-y','-f','lavfi','-i',`testsrc2=size=${width}x${height}:rate=30:duration=${durationSec}`,
    '-f','lavfi','-i',`sine=frequency=440:duration=${durationSec}`,
    '-c:v','libx264','-preset','ultrafast','-crf','35','-pix_fmt','yuv420p','-c:a','aac','-shortest',out]);
  if(r.code!==0)throw new Error(`fixture ffmpeg falló: ${r.stderr.slice(-300)}`);
}
beforeAll(async()=>{
  if(!HAS_FFMPEG)return;
  plainDir=await mkdtemp(join(tmpdir(),'abrxs-media-'));dirs.push(plainDir);
  master=join(plainDir,'master.mp4');
  await synthVideo(master);
  // Path hostil real: espacios, acentos, unicode, paréntesis, corchetes, apóstrofes, coma y dos puntos.
  nastyDir=join(plainDir,"Vídeos José (López) & [prueba], con: colón");
  await mkdir(nastyDir,{recursive:true});
  nastyVideo=join(nastyDir,"episodio 01 – versión 'final' [v2].mp4");
  await synthVideo(nastyVideo,6);
  nastySrt=join(nastyDir,"Client's subs [v2], ep:01.srt");
  await writeFile(nastySrt,'1\n00:00:00,000 --> 00:00:02,000\nSubtítulo con acentos: José\'s café & más\n\n2\n00:00:02,000 --> 00:00:04,000\nSegunda línea [entre corchetes]\n');
},120_000);
afterAll(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});

describe('Streaming SHA256 (memoria ~constante)',()=>{
  it('coincide con el hash de referencia en archivos multi-chunk (8 MB > chunk de 1 MiB)',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'abrxs-hash-'));dirs.push(dir);
    const file=join(dir,'grande.bin');
    const buf=randomBytes(8*1024*1024+137); // tamaño no alineado al chunk
    await writeFile(file,buf);
    expect(await sha256File(file)).toBe(createHash('sha256').update(buf).digest('hex'));
  });
  it('archivo vacío → digest SHA256 conocido',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'abrxs-hash-'));dirs.push(dir);
    const file=join(dir,'vacio.bin');
    await writeFile(file,'');
    expect(await sha256File(file)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('errores claros para archivos inexistentes',async()=>{
    await expect(sha256File('/no/existe/ninguno.bin')).rejects.toThrow(/No se pudo leer/);
  });
});

describe('planThumbnailTimestamps (uniformes sobre TODA la duración)',()=>{
  it('2 horas con N=12 → 12 timestamps a lo largo de las 7200 s',()=>{
    const ts=planThumbnailTimestamps(7200,12);
    expect(ts).toHaveLength(12);
    expect(ts[0]).toBe(300);            // 7200*0.5/12
    expect(ts[11]).toBe(6900);          // 7200*11.5/12 — NO pegado al inicio
    expect(ts.every((t,i)=>i===0||t>ts[i-1])).toBe(true);
    const gaps=ts.slice(1).map((t,i)=>t-ts[i]);
    expect(Math.max(...gaps)-Math.min(...gaps)).toBeLessThan(1); // separación ~uniforme
  });
  it('funciona para las duraciones/fps raros (no hardcodea frames cada X)',()=>{
    for(const duration of [0.5,6,10,600.52,7200]){
      const ts=planThumbnailTimestamps(duration,7);
      expect(ts).toHaveLength(7);
      expect(ts[0]).toBeGreaterThan(0);
      expect(ts[6]).toBeLessThan(duration);
    }
  });
  it('rechaza duración inválida y counts sin sentido',()=>{
    expect(()=>planThumbnailTimestamps(0,5)).toThrow();
    expect(()=>planThumbnailTimestamps(-1,5)).toThrow();
    expect(()=>planThumbnailTimestamps(Number.NaN,5)).toThrow();
    expect(()=>planThumbnailTimestamps(10,0)).toThrow();
    expect(()=>planThumbnailTimestamps(10,2.5)).toThrow();
  });
});

describe('escapeFilterPath (filtergraph, dos niveles backslash según docs de ffmpeg)',()=>{
  it('escapa \\ \' y : en nivel opción y vuelve a escapar (más , ; [ ]) en nivel grafo',()=>{
    expect(escapeFilterPath('/a/b.mp4')).toBe('/a/b.mp4');
    expect(escapeFilterPath("/a/b's.mp4")).toBe(String.raw`/a/b\\\'s.mp4`);
    expect(escapeFilterPath('/a/b:c.mp4')).toBe(String.raw`/a/b\\\:c.mp4`);
    expect(escapeFilterPath('/a/b,c;d.mp4')).toBe(String.raw`/a/b\,c\;d.mp4`);
  });
});

(HAS_FFMPEG?describe:describe.skip)('Media engine con FFmpeg real',()=>{
  it('probe: duración, dimensiones, audio y hash coherentes',async()=>{
    const info=await probe(master);
    expect(info.durationSec).toBeGreaterThan(9);
    expect(info.width).toBe(320);expect(info.height).toBe(240);
    expect(info.hasAudio).toBe(true);
    expect(info.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(info.fps).toBeCloseTo(30,0);
  });
  it('probeDurationSec: duración ligera sin hash del archivo',async()=>{
    expect(await probeDurationSec(master)).toBeGreaterThan(9);
  });
  it('makeFilmstrip: genera la tira y el grid pedido',async()=>{
    const out=await makeFilmstrip(master,plainDir,12,6);
    const s=await stat(out);expect(s.size).toBeGreaterThan(0);
    const {stdout}=await run('ffprobe',['-v','quiet','-print_format','json','-show_streams',out]);
    const stream=(JSON.parse(stdout) as {streams?:Array<{width?:number;height?:number}>}).streams?.[0];
    expect(stream?.width).toBe(6*240); // 6 columnas de 240px
    expect(stream?.height).toBeGreaterThan(0);
  });
  it('makeFilmstrip: count no múltiplo de columnas no rompe (padding del tile)',async()=>{
    const out=await makeFilmstrip(master,plainDir,5,6);
    expect((await stat(out)).size).toBeGreaterThan(0);
  });
  it('cutPiece y renderFinal funcionan con paths hostiles (unicode, espacios, \'()[]:,)',async()=>{
    const strip=await makeFilmstrip(nastyVideo,nastyDir,6,6);
    expect((await stat(strip)).size).toBeGreaterThan(0);
    const cut=join(nastyDir,"corte 'x' [1], ep:01.mp4");
    await cutPiece(nastyVideo,0.5,2.5,cut);
    expect((await stat(cut)).size).toBeGreaterThan(0);
    const rendered=join(nastyDir,"render final 'x' [1], ep:01.mp4");
    await renderFinal({src:nastyVideo,inSec:0.2,outSec:2.2,outPath:rendered,srtPath:nastySrt});
    const s=await stat(rendered);expect(s.size).toBeGreaterThan(0);
    const {stdout}=await run('ffprobe',['-v','quiet','-print_format','json','-show_streams',rendered]);
    const streams=(JSON.parse(stdout) as {streams?:Array<{codec_name?:string}>}).streams??[];
    expect(streams.some(st=>st.codec_name==='h264')).toBe(true);
  });
  it('Doctor media: ffmpeg/ffprobe/decode/H264/temp en PASS (o SKIP honesto)',async()=>{
    const reports=await runMediaChecks();
    const byCheck=Object.fromEntries(reports.map(r=>[r.check,r]));
    expect(byCheck['ffmpeg'].status).toBe('PASS');
    expect(byCheck['ffprobe'].status).toBe('PASS');
    expect(byCheck['directorio temp escribible'].status).toBe('PASS');
    expect(byCheck['decodificar video (sintético)'].status).toBe('PASS');
    expect(byCheck['encode H264'].status).toBe('PASS');
    expect(reports.some(r=>r.status==='FAIL')).toBe(false);
    const failed=reports.filter(r=>r.status==='FAIL').map(r=>`${r.check}: ${r.detail}`);
    expect(failed,failed.join('; ')).toHaveLength(0);
  });
});

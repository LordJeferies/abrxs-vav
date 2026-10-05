/* ═══ TRANSCRIPCIÓN LOCAL — whisper word-level como base canónica (M2) ═══
   Backend: mlx_whisper (Apple Silicon, modelos mlx-community ya cacheados en
   HuggingFace local). whisper.cpp queda como backend alternativo si existe un
   binario + modelo ggml. Word-level JSON = canónico; SRT/TXT = derivados.
   CACHE: si el words.json del source existe y el hash del máster no cambió,
   NO se re-ejecuta Whisper. Errores legibles; jamás secretos. */
import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite } from './file-repository';

export interface WhisperWord { start: number; end: number; word: string }
export interface WhisperSegment { start: number; end: number; text: string; words?: WhisperWord[] }
export interface TranscriptWords { language?: string; backend: string; model: string; sourceHash: string; segments: WhisperSegment[] }

const run=(cmd:string,args:string[],timeoutMs:number):Promise<{code:number;stdout:string;stderr:string}>=>new Promise(resolve=>{
  execFile(cmd,args,{timeout:timeoutMs,maxBuffer:32*1024*1024},(err,stdout,stderr)=>{
    if(!err)return resolve({code:0,stdout,stderr});
    resolve({code:typeof err.code==='number'?err.code:127,stdout,stderr:err.code==='ENOENT'?`${cmd} no encontrado`:stderr});
  });
});

/** Detecta el backend disponible SIN ejecutar Whisper: mlx_whisper en PATH +
    modelo cacheado local; o whisper-cli + modelo ggml. */ 
export async function detectTranscribeBackend(model?:string):Promise<{backend:'mlx_whisper'|'whisper_cpp';model:string}|null>{
  const mlxModel=model||process.env.ABRXS_MLX_MODEL||'mlx-community/whisper-large-v3-turbo';
  const hfCache=join(homedir(),'.cache','huggingface','hub',`models--${mlxModel.replace(/\//g,'--')}`);
  const mlx=await run('mlx_whisper',['--help'],20_000);
  if(mlx.code===0){
    let cached=true;
    try{await stat(hfCache);}catch{cached=false;} // sin caché solo bloquea si no hay red; se intenta igual
    if(cached)return {backend:'mlx_whisper',model:mlxModel};
  }
  const cppModel=model||process.env.ABRXS_WHISPER_CPP_MODEL||'';
  const cpp=await run('whisper-cli',['--help'],20_000);
  if(cpp.code===0&&cppModel)return {backend:'whisper_cpp',model:cppModel};
  return null;
}

const srtTime=(s:number):string=>{
  const ms=Math.round((s%1)*1000),t=Math.floor(s);
  return `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(t%60).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
};

/** Derivados del words.json canónico: SRT por segmentos y TXT plano. */
export function deriveSrt(t:TranscriptWords):string{
  return t.segments.map((s,i)=>`${i+1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text.trim()}`).join('\n\n');
}
export function deriveTxt(t:TranscriptWords):string{
  return t.segments.map(s=>s.text.trim()).join('\n\n');
}

/** Transcribe un máster (o su proxy si es muy pesado) y persiste words.json +
    derivados. Devuelve las rutas. NO re-transcribe si el cache es válido. */
export async function transcribeMaster(opts:{
  sourceRef:string;sourceHash:string;outDir:string;model?:string;signal?:AbortSignal;
}):Promise<{wordsRef:string;srtRef:string;txtRef:string;transcript:TranscriptWords;cached:boolean}>{
  const backend=await detectTranscribeBackend(opts.model);
  if(!backend)throw new Error('Sin backend de transcripción: instala mlx_whisper con un modelo cacheado, o whisper-cli con ABRXS_WHISPER_CPP_MODEL.');
  await mkdir(opts.outDir,{recursive:true,mode:0o700});
  const wordsRef=join(opts.outDir,'transcript.words.json'),srtRef=join(opts.outDir,'transcript.srt'),txtRef=join(opts.outDir,'transcript.txt');
  // CACHE: mismo backend+modelo+hash → reutilizar.
  try{
    const previous=JSON.parse(await readFile(wordsRef,'utf8')) as TranscriptWords;
    if(previous.sourceHash===opts.sourceHash&&previous.backend===backend.backend&&previous.model===backend.model){
      return {wordsRef,srtRef,txtRef,transcript:previous,cached:true};
    }
  }catch{/* sin cache válido → transcribir */}
  opts.signal?.throwIfAborted();
  let transcript:TranscriptWords;
  if(backend.backend==='mlx_whisper'){
    const result=await run('mlx_whisper',[opts.sourceRef,'--model',backend.model,'--output-format','json',
      '--output-dir',opts.outDir,'--word-timestamps','True'],1_800_000);
    if(result.code!==0)throw new Error(`mlx_whisper falló: ${(result.stderr||result.stdout).slice(-400)}`);
    const base=opts.sourceRef.replace(/\.[^.]+$/,'').split('/').pop()!;
    const json=JSON.parse(await readFile(join(opts.outDir,`${base}.json`),'utf8')) as {language?:string;segments?:WhisperSegment[]};
    transcript={language:json.language,backend:backend.backend,model:backend.model,sourceHash:opts.sourceHash,
      segments:(json.segments??[]).map(s=>({...s,words:s.words?.map(w=>({start:w.start,end:w.end,word:w.word}))}))};
  }else{
    const modelBin=backend.model;
    const result=await run('whisper-cli',['-m',modelBin,'-f',opts.sourceRef,'-oj','-of',join(opts.outDir,'transcript')],1_800_000);
    if(result.code!==0)throw new Error(`whisper-cli falló: ${(result.stderr||result.stdout).slice(-400)}`);
    const json=JSON.parse(await readFile(join(opts.outDir,'transcript.json'),'utf8')) as {language?:string;transcription?:Array<{offsets?:{from:number;to:number};text?:string}>};
    const segments=(json.transcription??[]).map(seg=>({start:(seg.offsets?.from??0)/1000,end:(seg.offsets?.to??0)/1000,text:seg.text??''}));
    transcript={language:json.language,backend:backend.backend,model:backend.model,sourceHash:opts.sourceHash,segments};
  }
  await atomicWrite(wordsRef,JSON.stringify(transcript,null,2));
  await writeFile(srtRef,deriveSrt(transcript),'utf8');
  await writeFile(txtRef,deriveTxt(transcript),'utf8');
  return {wordsRef,srtRef,txtRef,transcript,cached:false};
}

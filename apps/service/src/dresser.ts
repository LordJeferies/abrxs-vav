/* ═══ DRESSER MVP — Visual Director determinista (M4) ═══
   PIECE + TRANSCRIPT + CLIENT PROFILE → VISUAL PLAN → eventos PERSISTENTES en
   el Production Graph (CAS) → render (handler dresser.render_piece).
   MVP HEURÍSTICO y determinista — SIN LLM y SIN "B-roll cada N segundos":
   - Beats = frases del transcript word-level de la pieza (puntuación o ~12 palabras).
   - Cada beat → keywords (media.ts keywords(), es/en) → si un Asset registrado
     matchea tags y las reglas del cliente lo permiten → B-ROLL con WHY; si no →
     solo caption.
   - Reglas del cliente: broll.density (low/medium/high = 1/2/4 b-rolls por pieza)
     y negativeRules (keyword prohibida → caption).
   - Tiempo canónico: frames out-exclusivos ABSOLUTOS del máster (el Graph es la
     única verdad audiovisual); los segundos solo nacen en la frontera FFmpeg.
   El plan resuelto se persiste en piece.extensions.dressPlan: el handler de
   render ejecuta sin re-decidir nada. El CAS del Graph entra inyectado
   (editProject = ProjectStore.edit) — dresser nunca escribe directo. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { framesToSeconds, secondsToFrameCeil, secondsToFrameFloor, type Asset, type ClientProfile, type Project } from '@abraxas/contracts';
import type { JobEngine } from '@abraxas/core';
import type { EntityRepository } from './entity-repository';
import { keywords, sliceSrt, type Segment } from './media';
import { loadTranscript, type CanterStores } from './canter';

export interface DressBeat { kind:'b_roll'|'caption'; text:string; startFrame:number; endFrame:number; why:string; assetId?:string }
export interface DressPlan {
  createdAt:string; clientId?:string; pieceId:string;
  beats:DressBeat[];
  brolls:Array<{ assetId:string; ref:string; inSec:number; outSec:number; motion:'ZOOM_IN'|'ZOOM_OUT'|'STATIC' }>;
  captions:{ srtRef:string };
  captionStyle:{ primaryColor:string; fontName:string };
}

export interface DresserStores extends CanterStores { assets:EntityRepository<Asset> }
const DENSITY:{low:number;medium:number;high:number}={low:1,medium:2,high:4};
export interface DresserDeps {
  stores:DresserStores;
  /** CAS del ProjectStore: edit(id, expectedRevision, label, content) → Project. */
  editProject:(id:string,expectedRevision:number,label:string,content:Project['content'])=>Promise<Project>;
}

/** Frases (beats) desde WORDS word-level: timings exactos por palabra.
    Corta en puntuación final (.?!…) o al llegar a maxWords. */
export function splitBeats(words:Array<{start:number;end:number;word:string}>,maxWords=12):Segment[]{
  const beats:Segment[]=[];
  let buffer:Array<{start:number;end:number;word:string}>=[];
  const flush=()=>{ if(!buffer.length)return;
    beats.push({startSec:buffer[0].start,endSec:buffer[buffer.length-1].end,text:buffer.map(w=>w.word).join(' ').replace(/\s+/g,' ').trim()});
    buffer=[]; };
  for(const w of words){
    buffer.push(w);
    if(/[.?!…]$/.test(w.word)||buffer.length>=maxWords)flush();
  }
  flush();
  return beats.filter(b=>b.endSec>b.startSec);
}

/** '#RRGGBB' → '&H00BBGGRR' (ASS); tokens '$colors.*' o raros → blanco. */
export function toAssColor(color:string|undefined):string{
  const m=/^#([0-9a-fA-F]{6})$/.exec(color??'');
  if(!m)return '&H00FFFFFF';
  const n=m[1];
  return `&H00${n.slice(4,6)}${n.slice(2,4)}${n.slice(0,2)}`.toUpperCase();
}

function negated(text:string,rules:string[]):string|undefined{
  return rules.find(r=>{const term=r.toLowerCase().replace(/^no\s+/,'').trim();return term&&text.toLowerCase().includes(term);});
}

/** Construye y PERSISTE el plan: beats → eventos en el Graph (CAS, idempotente
    por pieza) + dressPlan en piece.extensions + SRT piece-relativo en disco. */
export async function buildDresserPlan(deps:DresserDeps, project:Project, input:{
  pieceId:string; profile?:ClientProfile;
  /** AssetIds reservados por OTROS clips del batch (anti-repetición M5). */
  excludeAssetIds?:string[];
}): Promise<{ project:Project; plan:DressPlan }>{
  const {stores}=deps;
  const piece=await stores.pieces.get(input.pieceId);
  if(!piece)throw new Error(`Pieza ${input.pieceId} no existe.`);
  if(piece.projectId!==project.id)throw new Error(`La pieza ${input.pieceId} pertenece a otro proyecto.`);
  const source=await stores.mediaSources.get(piece.sourceRef);
  if(!source?.timebase||source.durationFrames==null)throw new Error('El máster de la pieza no está ingestado (media.ingest).');
  const transcript=await loadTranscript(stores,source);

  const pieceIn=framesToSeconds(piece.sourceRange.startFrame,source.timebase);
  const pieceOut=framesToSeconds(piece.sourceRange.endFrame,source.timebase);
  const allWords=transcript.segments.flatMap(s=>s.words?.length?s.words:[]);
  const inWindow=allWords.filter(w=>w.end>pieceIn&&w.start<pieceOut);

  const profile=input.profile;
  const cap=DENSITY[profile?.broll?.density??'medium'];
  const negatives=profile?.negativeRules??[];
  const allAssets=await stores.assets.list();
  const candidates=allAssets.filter(a=>a.kind==='image'
    &&(!a.projectId||a.projectId===project.id)
    &&Array.isArray((a.extensions as {tags?:unknown}|undefined)?.tags));

  const beatsRaw=splitBeats(inWindow.map(w=>({start:w.start,end:w.end,word:w.word})));
  const beats:DressBeat[]=[];const brolls:DressPlan['brolls']=[];
  let used=0;
  for(const beat of beatsRaw){
    const startFrame=Math.min(secondsToFrameFloor(beat.startSec,source.timebase),source.durationFrames-1);
    const endFrame=Math.min(secondsToFrameCeil(beat.endSec,source.timebase),source.durationFrames);
    const kw=keywords(beat.text).split(' ').filter(Boolean);
    const neg=negated(beat.text,negatives);
    const match=used<cap&&!neg?candidates.find(a=>{
      if(input.excludeAssetIds?.includes(a.id))return false; // reservado por otro clip del batch
      const tags=((a.extensions as {tags?:string[]})?.tags??[]).map(t=>t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
      return kw.some(k=>tags.includes(k));
    }):undefined;
    if(match){
      used++;
      const hit=kw.filter(k=>((match.extensions as {tags?:string[]})?.tags??[]).map((t:string)=>t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')).includes(k)).join(', ');
      beats.push({kind:'b_roll',text:beat.text,startFrame,endFrame,assetId:match.id,
        why:`B-roll «${match.label}» por keyword [${hit}] en el beat (${beat.startSec.toFixed(2)}–${beat.endSec.toFixed(2)} s)`});
      brolls.push({assetId:match.id,ref:match.ref,inSec:beat.startSec-pieceIn,outSec:beat.endSec-pieceIn,motion:'ZOOM_IN'});
    }else{
      const wouldMatch=!neg&&candidates.some(a=>{
        const tags=((a.extensions as {tags?:string[]})?.tags??[]).map(t=>t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
        return kw.some(k=>tags.includes(k));
      });
      beats.push({kind:'caption',text:beat.text,startFrame,endFrame,
        why:neg?`Caption (regla del cliente prohíbe B-roll: "${neg}")`
          :wouldMatch?'Caption (asset compatible reservado por otro clip del lote — anti-repetición)'
          :'Caption (sin asset que matchee las keywords del beat)'});
    }
  }

  const srt=sliceSrt(beatsRaw.map(b=>({startSec:b.startSec,endSec:b.endSec,text:b.text})),pieceIn,pieceOut);
  const srtDir=join(stores.dataDirectory,'dresser',piece.id);
  await mkdir(srtDir,{recursive:true,mode:0o700});
  const srtRef=join(srtDir,'captions.srt');
  await writeFile(srtRef,srt,'utf8');

  const plan:DressPlan={
    createdAt:new Date().toISOString(),
    clientId:input.profile?.clientId??project.content.clientId,
    pieceId:piece.id,beats,brolls,captions:{srtRef},
    captionStyle:{primaryColor:toAssColor(profile?.captions?.highlightColor?.startsWith('#')?profile.captions.highlightColor:undefined),
      fontName:profile?.brand?.fonts?.primary?.replace(/^font\./,'')??'Helvetica'}
  };

  // Eventos en el Graph: frames absolutos, idempotente (reemplaza los de ESTA pieza).
  let br=0,cp=0;
  const kept=project.content.graph.events.filter(e=>!((e.extensions as {dressPieceId?:string}|undefined)?.dressPieceId===piece.id));
  const usedIds=new Set(kept.map(e=>e.id));
  const dresserEvents=beats.map(b=>{
    const isB=b.kind==='b_roll';
    const base=isB?`BR${String(++br).padStart(2,'0')}`:`CP${String(++cp).padStart(2,'0')}`;
    let unique=base,n=2;
    while(usedIds.has(unique))unique=`${base}_${n++}`;
    usedIds.add(unique);
    return isB
      ?{id:unique,kind:'b_roll' as const,startFrame:b.startFrame,endFrame:b.endFrame,status:'ready' as const,
        assetRefs:[b.assetId!],extensions:{dressPieceId:piece.id,why:b.why,motion:'ZOOM_IN'}}
      :{id:unique,kind:'caption' as const,startFrame:b.startFrame,endFrame:b.endFrame,status:'ready' as const,
        extensions:{dressPieceId:piece.id,why:b.why,captionText:b.text}};
  });
  const content={...project.content,graph:{...project.content.graph,events:[...kept,...dresserEvents]}};
  const edited=await deps.editProject(project.id,project.revision,`Dresser: ${piece.label}`,content);

  // dressPlan en la pieza (los datos que el render ejecutará sin re-decidir).
  await stores.pieces.put({...piece,extensions:{...piece.extensions,dressPlan:{...plan}}});
  return { project: edited, plan };
}

/** Encola el render vestido de la pieza (target piece; re-render con payload). */
export async function enqueueDresserRender(stores:DresserStores,engine:JobEngine,project:Project,pieceId:string){
  const piece=await stores.pieces.get(pieceId);
  if(!piece)throw new Error(`Pieza ${pieceId} no existe.`);
  if(!(piece.extensions as {dressPlan?:DressPlan}|undefined)?.dressPlan)
    throw new Error(`La pieza ${pieceId} no tiene plan de Dresser. Ejecuta dresser.plan primero.`);
  return engine.enqueue(project,'dresser.render_piece',{target:{kind:'piece',ref:piece.id},payload:{renderNumber:piece.outputRefs.length+1}});
}

/** Lee el plan persistido de una pieza. */
export async function getDressPlan(stores:DresserStores,pieceId:string):Promise<DressPlan|null>{
  const piece=await stores.pieces.get(pieceId);
  return (piece?.extensions as {dressPlan?:DressPlan}|undefined)?.dressPlan??null;
}

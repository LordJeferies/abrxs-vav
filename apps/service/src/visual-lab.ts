/* ═══ VISUAL LAB — workspace de assets (M6) ═══
   SEARCH unificada sobre el AssetStore (label/tags/provenance, scoring
   determinista) · FRAME GRAB del máster (ffmpeg → Asset con provenance
   source_frame) · SIMILAR (compare por tags/kind) · USE (attach de un Asset
   a un evento b_roll del grafo por CAS — el Production Graph sigue siendo la
   única verdad audiovisual). Búsqueda y comparación: sin LLM, sin red. */
import { execFile } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { framesToSeconds, type Asset, type Project } from '@abraxas/contracts';
import { registerAsset } from './assets';
import type { DresserStores } from './dresser';

const run=(cmd:string,args:string[],timeoutMs=120_000):Promise<{code:number;stdout:string;stderr:string}>=>new Promise(resolve=>{
  execFile(cmd,args,{timeout:timeoutMs,maxBuffer:32*1024*1024},(err,stdout,stderr)=>{
    if(!err)return resolve({code:0,stdout,stderr});
    resolve({code:typeof err.code==='number'?err.code:127,stdout,stderr});
  });
});

const norm=(s:string):string=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const tokensOf=(s:string):string[]=>norm(s).split(/[^a-z0-9ñ]+/).filter(t=>t.length>=3);

export interface AssetHit { asset:Asset; score:number; matched:string[] }

/** Búsqueda determinista sobre el AssetStore: label (peso 2) + tags/provenance
    detail (peso 1). Sin query → últimos registrados. */
export function searchAssets(assets:Asset[], query:string, filters:{kind?:string;projectId?:string;clientId?:string}={}):AssetHit[] {
  let pool=assets;
  if(filters.kind)pool=pool.filter(a=>a.kind===filters.kind);
  if(filters.projectId)pool=pool.filter(a=>a.projectId===filters.projectId);
  if(filters.clientId)pool=pool.filter(a=>a.clientId===filters.clientId);
  const qTokens=tokensOf(query);
  if(!qTokens.length)return pool.slice().reverse().map(asset=>({asset,score:0,matched:[]}));
  const hits:AssetHit[]=[];
  for(const asset of pool){
    const labelTokens=tokensOf(asset.label);
    const tagTokens=(asset.extensions as {tags?:string[]}|undefined)?.tags?.flatMap(t=>tokensOf(t))??[];
    const provTokens=tokensOf(asset.provenance.detail??'');
    const matched:string[]=[];let score=0;
    for(const q of qTokens){
      const hasPrefix=(list:string[])=>list.some(l=>l.startsWith(q)||q.startsWith(l));
      if(labelTokens.includes(q)){score+=2;matched.push(q);}
      else if(tagTokens.includes(q)){score+=1;matched.push(q);}
      else if(provTokens.includes(q)){score+=1;matched.push(q);}
      else if(hasPrefix(labelTokens)||hasPrefix(tagTokens)||hasPrefix(provTokens)){score+=0.5;matched.push(q+'~');}
    }
    if(score>0)hits.push({asset,score:Math.round(score*10)/10,matched});
  }
  return hits.sort((a,b)=>b.score-a.score||b.asset.createdAt.localeCompare(a.asset.createdAt));
}

/** FRAME GRAB: extrae un frame del máster y lo REGISTRA como Asset
    (provenance source_frame; tags del input). Ref dentro del store. */
export async function grabFrame(stores:DresserStores, input:{
  mediaSourceId:string; atSec:number; label?:string; tags?:string[]; projectId?:string;
}): Promise<{asset:Asset;created:boolean}>{
  const source=await stores.mediaSources.get(input.mediaSourceId);
  if(!source)throw new Error(`MediaSource ${input.mediaSourceId} no existe.`);
  if(!(source.durationFrames&&source.durationFrames>0))throw new Error('El máster no está ingestado (media.ingest).');
  if(!Number.isFinite(input.atSec)||input.atSec<0)throw new Error('atSec debe ser un número ≥ 0.');
  const dir=join(stores.dataDirectory,'frames',source.id);
  await mkdir(dir,{recursive:true,mode:0o700});
  // '-shortest' puede acortar el vídeo a la duración del audio: un -ss cerca
  // del EOF produce 0 frames con exit 0 (verificado empíricamente). Escalera de
  // seeks descendente con validación de salida — determinista y explicada en
  // provenance.detail (el tiempo REAL del frame extraído).
  const durSec=framesToSeconds(source.durationFrames!,source.timebase!);
  // Prioridad: el atSec pedido PRIMERO; luego retrocesos deterministas.
  const wants=[...new Set([input.atSec,durSec-0.3,durSec-0.7,durSec/2,0]
    .map(x=>+Math.max(0,Math.min(x,durSec-0.05)).toFixed(3)))];
  let out:string|undefined,effSec:number|undefined,lastErr='';
  for(const t of wants){
    const candidate=join(dir,`frame-${t.toFixed(3).replace('.','_')}.png`);
    const r=await run('ffmpeg',['-y','-v','error','-ss',t.toFixed(3),'-i',source.ref,'-frames:v','1',candidate]);
    if(r.code===0&&await stat(candidate).then(x=>x.size>0).catch(()=>false)){out=candidate;effSec=t;break;}
    lastErr=`t=${t}: exit ${r.code} ${(r.stderr||'').slice(-120)}`;
  }
  if(!out||effSec==null){
    const listing=await readdir(dir).catch(()=>['(dir ilegible)']);
    throw new Error(`No se pudo extraer ningún frame de ${source.id} (duración ${durSec.toFixed(2)} s); intentos: ${wants.join(', ')}; dir: ${listing.join(', ')}; último error: ${lastErr}`);
  }
  return registerAsset(stores,{
    label:input.label||`Frame ${input.atSec.toFixed(2)}s · ${source.id}`,
    path:out,kind:'image',projectId:input.projectId,tags:input.tags,
    provenance:{origin:'source_frame',detail:`frame @ ${effSec.toFixed(3)} s de ${source.id}`}});
}

/** COMPARE: assets similares (tags compartidos, mismo kind preferido). */
export function similarAssets(assets:Asset[], assetId:string, limit=5):AssetHit[] {
  const self=assets.find(a=>a.id===assetId);
  if(!self)throw new Error(`Asset ${assetId} no existe.`);
  const selfTags=new Set(((self.extensions as {tags?:string[]}|undefined)?.tags??[]).flatMap(t=>tokensOf(t)));
  return assets.filter(a=>a.id!==assetId).map(asset=>{
    const tags=((asset.extensions as {tags?:string[]}|undefined)?.tags??[]).flatMap(t=>tokensOf(t));
    const overlap=[...selfTags].filter(t=>tags.includes(t));
    let score=overlap.length*2;
    if(asset.kind===self.kind)score+=0.5;
    return {asset,score,matched:overlap};
  }).filter(h=>h.matched.length>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}

/** USE: vincula un Asset a un evento b_roll del grafo (CAS por revisión).
    Registra el swap en extensions.why — el Graph sigue siendo la única verdad. */
export async function attachAssetToEvent(deps:{
  stores:DresserStores;
  editProject:(id:string,expectedRevision:number,label:string,content:Project['content'])=>Promise<Project>;
}, project:Project, input:{eventId:string; assetId:string; note?:string}): Promise<{project:Project; asset:Asset}>{
  const event=project.content.graph.events.find(e=>e.id===input.eventId);
  if(!event)throw new Error(`El evento ${input.eventId} no existe en el grafo.`);
  if(!['b_roll','xr','image','motion'].includes(event.kind))throw new Error(`El evento ${input.eventId} (${event.kind}) no acepta asset visual.`);
  const asset=await deps.stores.assets.get(input.assetId);
  if(!asset)throw new Error(`Asset ${input.assetId} no existe.`);
  const content={...project.content,graph:{...project.content.graph,events:project.content.graph.events.map(e=>
    e.id!==input.eventId?e:{...e,assetRefs:[input.assetId],
      extensions:{...e.extensions,why:`${((e.extensions as {why?:string})?.why??'').split(';')[0].trim()}; asset «${asset.label}» vinculado por Visual Lab${input.note?` (${input.note})`:''}`}})}};
  const edited=await deps.editProject(project.id,project.revision,`Visual Lab: ${input.assetId} → ${input.eventId}`,content);
  return {project:edited,asset};
}

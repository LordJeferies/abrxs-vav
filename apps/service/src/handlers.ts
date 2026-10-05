import { setTimeout as wait } from 'node:timers/promises';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { graphSchema, framesToSeconds, secondsToFrames, type MediaSource, type Piece } from '@abraxas/contracts';
import type { JobHandler } from '@abraxas/core';
import { providers } from './providers';
import { compileComposition, type CompositionSpec } from '@abraxas/motion';
import { probe, makeProxy, makeFilmstrip, makeWaveform, cutPiece } from './media';
import type { EntityRepository } from './entity-repository';
import { exportOutputPath, type CanterStores } from './canter';

/* Deps del vertical MASTER → MediaSource → Piece → MP4 (0.6.0). Sin deps,
   los handlers de media.ingest / canter.export_piece fallan con error claro
   (los handlers puros —validate/edit-plan/generate/motion— funcionan igual). */
export interface JobHandlerDeps {
  mediaSources?: EntityRepository<MediaSource>;
  pieces?: EntityRepository<Piece>;
  dataDirectory?: string;
}

const requireStores = (deps: JobHandlerDeps): CanterStores => {
  if (!deps.mediaSources || !deps.pieces || !deps.dataDirectory)
    throw new Error('Handlers de media/canter sin stores: pasa mediaSources, pieces y dataDirectory al servicio.');
  return { mediaSources: deps.mediaSources, pieces: deps.pieces, dataDirectory: deps.dataDirectory };
};

export const createJobHandlers = (deps: JobHandlerDeps = {}): Record<string, JobHandler> => ({
  'media.ingest':async(job,{signal,progress})=>{
    const stores=requireStores(deps);
    const sourceId=job.target?.kind==='media_source'?job.target.ref:null;
    if(!sourceId)throw new Error('media.ingest requiere target media_source explícito.');
    const source=await stores.mediaSources.get(sourceId);
    if(!source)throw new Error(`MediaSource ${sourceId} no existe.`);
    signal.throwIfAborted();
    await stat(source.ref); // error humano si el archivo no está accesible
    const info=await probe(source.ref);
    await progress(0.25);
    if(!info.fpsNumerator||!info.fpsDenominator||!info.fpsNumerator||info.fpsNumerator<=0)
      throw new Error(`ffprobe no reportó fps racional para ${source.ref}; no se ingesta sin timebase canónica.`);
    const timebase={fpsNumerator:info.fpsNumerator,fpsDenominator:info.fpsDenominator};
    const updated:MediaSource={...source,
      hash:info.hash,hashAlgorithm:'sha256',
      timebase,durationFrames:secondsToFrames(info.durationSec,timebase),
      width:info.width,height:info.height,codec:info.codec??undefined,
      audio:{present:info.hasAudio}};
    signal.throwIfAborted();
    const mediaDir=join(stores.dataDirectory,'media',source.id);
    updated.proxyRef=await makeProxy(source.ref,mediaDir);
    await progress(0.55); signal.throwIfAborted();
    updated.filmstripRef=await makeFilmstrip(source.ref,mediaDir,24,6);
    await progress(0.8); signal.throwIfAborted();
    const waveform=await makeWaveform(source.ref,mediaDir); // null honesto si no hay audio
    if(waveform)updated.waveformRef=waveform;
    await progress(0.95);
    await stores.mediaSources.put(updated);
    return JSON.stringify({source:updated.id,kind:updated.kind,durationFrames:updated.durationFrames,
      timebase:`${timebase.fpsNumerator}/${timebase.fpsDenominator}`,proxyRef:updated.proxyRef,
      filmstripRef:updated.filmstripRef,waveformRef:updated.waveformRef,
      note:'Derivados generados localmente; el máster nunca se cargó completo en RAM.'},null,2);
  },
  'canter.export_piece':async(job,{signal,progress})=>{
    const stores=requireStores(deps);
    const pieceId=job.target?.kind==='piece'?job.target.ref:null;
    if(!pieceId)throw new Error('canter.export_piece requiere target piece explícito.');
    const piece=await stores.pieces.get(pieceId);
    if(!piece)throw new Error(`Pieza ${pieceId} no existe.`);
    const source=await stores.mediaSources.get(piece.sourceRef);
    if(!source)throw new Error(`MediaSource ${piece.sourceRef} de la pieza no existe.`);
    if(!source.timebase||source.durationFrames==null)
      throw new Error(`El máster ${source.id} no está ingestado (sin timebase/duración). Ejecuta media.ingest.`);
    const exportNumber=Number((job.payload as {exportNumber?:unknown}|undefined)?.exportNumber??piece.outputRefs.length+1);
    const outPath=exportOutputPath(stores,piece,exportNumber);
    signal.throwIfAborted();
    // Frames canónicos → segundos SOLO en la frontera ffmpeg (timebase racional del máster).
    const out=await cutPiece(source.ref,
      framesToSeconds(piece.sourceRange.startFrame,source.timebase),
      framesToSeconds(piece.sourceRange.endFrame,source.timebase),outPath);
    await progress(0.9); signal.throwIfAborted();
    const saved=await stores.pieces.put({...piece,status:'exported',
      outputRefs:[...piece.outputRefs.filter(r=>!r.startsWith(outPath)),outPath]});
    return JSON.stringify({piece:saved.id,output:outPath,range:saved.sourceRange,
      timebase:`${source.timebase.fpsNumerator}/${source.timebase.fpsDenominator}`},null,2);
  },
  'motion.render':async(job,{signal,progress})=>{
    // Composiciones motion viven en los eventos del grafo (extensions.motionComposition).
    // v2.5: si el job declara target event, renderiza SOLO ese evento (nunca otros por conveniencia).
    const all=job.input.graph.events.filter(e=>e.extensions&&typeof e.extensions==='object'&&'motionComposition'in e.extensions);
    const events=job.target?.kind==='event'?all.filter(e=>e.id===job.target!.ref):all;
    if(!events.length)throw new Error(job.target?.kind==='event'?`El evento objetivo ${job.target.ref} no tiene motionComposition.`:'El proyecto no tiene eventos con motionComposition.');
    const specs=events.map((e)=>{
      signal.throwIfAborted();
      const spec=compileComposition(e.extensions!.motionComposition as CompositionSpec);
      return {event:e.id,compositionId:spec.compositionId,layers:spec.layers.length,ffmpeg:spec.ffmpeg};
    });
    await progress(0.6); signal.throwIfAborted();
    await progress(0.9);
    return JSON.stringify({specVersion:'abrxs.motion-render.v1',compositions:specs,note:'RenderSpec Remotion-ready + comandos FFmpeg por capa. El render final entra con el bundle Remotion (paso 7).'},null,2);
  },
  'media.generate':async(job,{signal,progress})=>{
    // La receta vive en el evento del grafo (core-integrado): extensions.recipe.
    // v2.5: con target event se resuelve EXACTAMENTE ese evento; el fallback legado
    // (primer evento con receta) solo aplica a jobs viejos sin target.
    const events=job.input.graph.events;
    const targetEventId=job.target?.kind==='event'?job.target.ref:null;
    const event=targetEventId
      ?events.find(e=>e.id===targetEventId)
      :events.find(e=>e.extensions&&typeof e.extensions==='object'&&'recipe'in e.extensions);
    if(!event)throw new Error(targetEventId
      ?`El evento objetivo ${targetEventId} no existe en el grafo del job (target event).`
      :'El proyecto no tiene ningún evento con receta de generación (extensions.recipe).');
    const recipe=event.extensions!.recipe as {strategy?:string;workflow?:string;prompt?:string;negative?:string;params?:Record<string,unknown>};
    const provider=providers[recipe.strategy||'demo']??providers.demo;
    await progress(0.1);
    const submitted=await provider.submit({workflow:recipe.workflow||'std',prompt:recipe.prompt||'',negative:recipe.negative||'',params:recipe.params||{}},signal);
    await progress(0.3);
    let current=submitted;let ticks=0;
    while(current.status==='running'&&ticks<60){
      current=await provider.poll(current,signal);
      ticks++;await progress(Math.min(0.95,0.3+ticks*0.05));
      if(current.status==='running')await wait(500,undefined,{signal});
    }
    if(current.status==='failed')throw new Error(current.error||'Generación fallida en el provider.');
    return JSON.stringify({event:event.id,provider:current.providerId,status:current.status,outputs:current.outputs},null,2);
  },
  'project.validate':async(job,{signal,progress})=>{
    signal.throwIfAborted(); await progress(0.2);
    const graph=graphSchema.parse(job.input.graph); await progress(0.7); signal.throwIfAborted();
    return JSON.stringify({project:job.input.name,revision:job.sourceRevision,events:graph.events.length,
      timing:'Frames enteros; endFrame exclusivo.',structuralValidation:'passed',
      warnings:graph.events.filter(e=>['a_roll','b_roll','xr','image','vo','music','sfx'].includes(e.kind)&&!e.assetRefs?.length).map(e=>`${e.id}: no tiene recurso vinculado.`),
      scope:'Validación estructural. No verifica archivos, audio, rostros ni calidad de render.'},null,2);
  },
  'project.edit-plan':async(job,{signal,progress})=>{
    const graph=graphSchema.parse(job.input.graph);signal.throwIfAborted();
    const lines=[`ABRAXAS · ${job.input.name}`,`Revisión ${job.sourceRevision}`,`FPS ${graph.timebase.fpsNumerator}/${graph.timebase.fpsDenominator}`,'Rangos [inicio, final): final exclusivo.','Plan editorial; no ejecuta operaciones en DaVinci/CapCut.',''];
    const events=[...graph.events].sort((a,b)=>a.startFrame-b.startFrame);
    for(let i=0;i<events.length;i++){
      signal.throwIfAborted();const e=events[i],fps=graph.timebase.fpsNumerator/graph.timebase.fpsDenominator;
      lines.push(`${e.label||e.id} · ${e.kind} · ${e.status} (ID: ${e.id})`,`Frames ${e.startFrame}–${e.endFrame} | ${(e.startFrame/fps).toFixed(3)}–${(e.endFrame/fps).toFixed(3)} s`,`Recursos: ${e.assetRefs?.join(', ')||'pendientes'}`,'');
      await progress((i+1)/(events.length+1));
      // Yield to I/O so large plans can be cancelled without blocking the service.
      await wait(0,undefined,{signal});
    }
    return lines.join('\n');
  }
});

/** Handlers sin stores (legacy/tests): media.ingest y canter.export_piece fallan
    con error claro si alguien los encola sin wiring del servicio. */
export const handlers:Record<string,JobHandler>=createJobHandlers();

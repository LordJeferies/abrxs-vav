import { setTimeout as wait } from 'node:timers/promises';
import { graphSchema } from '@abraxas/contracts';
import type { JobHandler } from '@abraxas/core';
import { providers } from './providers';

export const handlers:Record<string,JobHandler>={
  'media.generate':async(job,{signal,progress})=>{
    // La receta vive en el evento del grafo (core-integrado): extensions.recipe
    const event=job.input.graph.events.find(e=>e.extensions&&typeof e.extensions==='object'&&'recipe'in e.extensions);
    if(!event)throw new Error('El proyecto no tiene ningún evento con receta de generación (extensions.recipe).');
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
};

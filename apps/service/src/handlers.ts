import { setTimeout as wait } from 'node:timers/promises';
import { graphSchema } from '@abraxas/contracts';
import type { JobHandler } from '@abraxas/core';

export const handlers:Record<string,JobHandler>={
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

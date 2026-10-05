import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { z, ZodError } from 'zod';
import { ProjectStore, JobEngine, ConflictError, NotFoundError } from '@abraxas/core';
import { projectSchema, jobSchema, projectContentSchema, timebaseSchema, clientProfileSchema, jobTargetSchema, jobPayloadSchema, mediaSourceSchema, pieceSchema, ABRXS_VERSION } from '@abraxas/contracts';
import { FileRepository } from './file-repository';
import { EntityRepository } from './entity-repository';
import { createJobHandlers } from './handlers';
import { catalog } from './catalog';
import { ingestMaster, createPiece, exportPiece, type CanterStores } from './canter';
import { enhancePrompt, buildHandoff, type EnhanceOptions } from '@abraxas/prompts';
import { providerStatus, testConnection } from './providers';
import { registries } from './registries';
import { compileComposition } from '@abraxas/motion';
import { ClientStore, parseClientTxt, applyDraft, exportAIPackage, importAIResponse, diffProfile, resolveConfig } from './clients';
import { analyzeGraph } from './qa';
import { buildCoachPlan } from './coach';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const dataDirectory=resolve(process.env.ABRAXAS_DATA_DIR||join(root,'.abraxas-data'));
const port=Number(process.env.ABRAXAS_PORT||4317);
const dist=join(root,'apps/desktop/dist');
const projectRepository=new FileRepository(join(dataDirectory,'projects'),projectSchema);
const jobRepository=new FileRepository(join(dataDirectory,'jobs'),jobSchema);
const store=new ProjectStore(projectRepository);
const clientStore=new ClientStore(join(dataDirectory,'clients'));
const canterStores:CanterStores={
  mediaSources:new EntityRepository(join(dataDirectory,'entities','media-sources.json'),mediaSourceSchema,'abrxs.media-sources.v1'),
  pieces:new EntityRepository(join(dataDirectory,'entities','pieces.json'),pieceSchema,'abrxs.pieces.v1'),
  dataDirectory
};
const jobHandlers=createJobHandlers(canterStores);
const engine=new JobEngine(jobRepository,jobHandlers,value=>createHash('sha256').update(value).digest('hex'),{
  defaultWatchdogMs:Number(process.env.ABRAXAS_JOB_WATCHDOG_MS||900_000) // 15 min por defecto
});

async function lock(){
  await mkdir(dataDirectory,{recursive:true,mode:0o700});const path=join(dataDirectory,'.service.lock');
  try{const handle=await open(path,'wx',0o600);await handle.writeFile(String(process.pid));await handle.close();}
  catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
    const pid=Number(await readFile(path,'utf8'));if(!Number.isInteger(pid)||pid<1)throw new Error('Bloqueo de datos inválido. Comprueba que no hay otro servicio y elimina .service.lock.');
    try{process.kill(pid,0);throw new Error('Ya hay otro servicio usando esta carpeta de datos.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}
    await unlink(path);return lock();
  }
  return async()=>{await unlink(path).catch(()=>{});};
}
function send(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
async function body(req:IncomingMessage){
  const parts:Buffer[]=[];let size=0;
  for await(const part of req){size+=part.length;if(size>5_000_000)throw new Error('El archivo excede el límite de 5 MB.');parts.push(part);}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new Error('JSON inválido.');}
}
const revisionSchema=z.strictObject({revision:z.number().int().nonnegative()});
const server=createServer(async(req,res)=>{
  try{
    const allowedHosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
    if(!allowedHosts.has(req.headers.host||'')){send(res,403,{error:'Host no autorizado.'});return;}
    const url=new URL(req.url||'/',`http://127.0.0.1:${port}`);
    if(url.pathname.startsWith('/api/')){
      const allowedOrigins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`,'http://127.0.0.1:1420','http://localhost:1420']);
      if(req.headers.origin&&!allowedOrigins.has(req.headers.origin)){send(res,403,{error:'Origen no autorizado.'});return;}
      if(req.method!=='GET'&&req.headers['x-abraxas-client']!=='local'){send(res,403,{error:'Petición local requerida.'});return;}
      const segments=url.pathname.slice(5).split('/');const [resource,id,action,extra]=segments;
      if(req.method==='GET'&&resource==='health'){send(res,200,{status:'ready',version:ABRXS_VERSION,product:'AbrxsVAV',storage:'local-files',handlers:Object.keys(jobHandlers),actions:catalog.length});return;}
      if(req.method==='GET'&&resource==='catalog'){send(res,200,{product:'AbrxsVAV',version:ABRXS_VERSION,actions:catalog});return;}
      if(resource==='projects'){
        if(req.method==='GET'&&!id){send(res,200,await store.list());return;}
        if(req.method==='POST'&&!id){const input=z.strictObject({name:z.string(),timebase:timebaseSchema}).parse(await body(req));send(res,201,await store.create(input.name,input.timebase));return;}
        if(req.method==='GET'&&id&&!action){send(res,200,await store.get(id));return;}
        if(req.method==='PUT'&&id&&!action){const input=z.strictObject({revision:z.number().int().nonnegative(),label:z.string().min(1).max(200),content:projectContentSchema}).parse(await body(req));send(res,200,await store.edit(id,input.revision,input.label,input.content));return;}
        if(req.method==='POST'&&id&&(action==='undo'||action==='redo')){const input=revisionSchema.parse(await body(req));send(res,200,await store.travel(id,input.revision,action));return;}
      }
      if(resource==='jobs'){
        if(req.method==='GET'&&!id){send(res,200,await engine.list());return;}
        if(req.method==='POST'&&!id){const input=z.strictObject({projectId:z.string().uuid(),revision:z.number().int().nonnegative(),kind:z.enum(['project.validate','project.edit-plan','media.generate','motion.render']),target:jobTargetSchema.optional(),payload:jobPayloadSchema.optional()}).parse(await body(req));const project=await store.get(input.projectId);if(project.revision!==input.revision)throw new ConflictError('Recarga el proyecto antes de crear el trabajo.');send(res,201,await engine.enqueue(project,input.kind,{target:input.target,payload:input.payload}));return;}
        if(req.method==='POST'&&id&&action==='cancel'){send(res,200,await engine.cancel(id));return;}
        if(req.method==='POST'&&id&&action==='retry'){send(res,200,await engine.retry(id));return;}
      }
      if(resource==='studio'){
        // Prompt Studio (capa 1 — docs/HIGGSFIELD_INTEGRATION.md): in-process, sin coste
        if(req.method==='POST'&&id==='enhance'&&!action){const input=z.strictObject({subject:z.string().min(1),intensity:z.union([z.literal(1),z.literal(2),z.literal(3)]),options:z.record(z.string(),z.string()).default({})}).parse(await body(req));send(res,200,enhancePrompt(input.subject,input.intensity,input.options as EnhanceOptions));return;}
        if(req.method==='POST'&&id==='handoff'&&!action){const input=z.strictObject({targetRef:z.string().min(1),subject:z.string().min(1),intensity:z.union([z.literal(1),z.literal(2),z.literal(3)]),options:z.record(z.string(),z.string()).default({}),providerHint:z.string().default('generic'),aspectRatio:z.string().optional(),durationSec:z.number().optional(),expectedFilename:z.string().optional()}).parse(await body(req));const result=enhancePrompt(input.subject,input.intensity,input.options as EnhanceOptions);const pkg=buildHandoff(result,{targetRef:input.targetRef,providerHint:input.providerHint,aspectRatio:input.aspectRatio,durationSec:input.durationSec,expectedFilename:input.expectedFilename});const txt=['HANDOFF ABRXSVAV',`PROMPT: ${pkg.prompt}`,`NEGATIVE: ${pkg.negative}`,`OUTPUT: ${pkg.outputSpec.aspectRatio}${pkg.outputSpec.durationSec?` · ${pkg.outputSpec.durationSec}s`:''}`,`GUARDA COMO: ${pkg.expectedFilename}`,pkg.returnInstructions].join('\n');send(res,200,{package:pkg,txt});return;}
        // Generación (capa 2): edita el grafo (CAS) y encola media.generate
        if(req.method==='POST'&&id==='generate'&&!action){const input=z.strictObject({projectId:z.string().uuid(),revision:z.number().int().nonnegative(),eventId:z.string().optional(),label:z.string().default('Visual Studio'),subject:z.string().min(1),intensity:z.union([z.literal(1),z.literal(2),z.literal(3)]),options:z.record(z.string(),z.string()).default({}),strategy:z.enum(['demo','higgsfield','nvidia']).default('demo'),workflow:z.string().default('std'),aspectRatio:z.string().default('9:16'),durationSec:z.number().optional()}).parse(await body(req));const project=await store.get(input.projectId);if(project.revision!==input.revision)throw new ConflictError('Recarga el proyecto antes de generar.');
          const result=enhancePrompt(input.subject,input.intensity,input.options as EnhanceOptions);
          const eventId=input.eventId||`ST${String(project.content.graph.events.length+1).padStart(2,'0')}_studio`;
          const event={id:eventId,label:input.label,kind:'image' as const,startFrame:0,endFrame:Math.max(1,Math.round((input.durationSec??4)*(project.content.graph.timebase.fpsNumerator/project.content.graph.timebase.fpsDenominator))),status:'ghost' as const,extensions:{purpose:`Visual Studio: ${result.subject.slice(0,80)}`,recipe:{strategy:input.strategy,workflow:input.workflow,prompt:result.prompt,negative:result.negative,params:{aspectRatio:input.aspectRatio,durationSec:input.durationSec},appliedLayers:result.appliedLayers}}};
          const content={...project.content,graph:{...project.content.graph,events:[...project.content.graph.events.filter(e=>e.id!==eventId),event]}};
          const edited=await store.edit(input.projectId,input.revision,`Visual Studio · ${result.subject.slice(0,60)}`,content);
          const job=await engine.enqueue(edited,'media.generate');send(res,201,{project:edited,job,recipe:{prompt:result.prompt,negative:result.negative,appliedLayers:result.appliedLayers,eventId}});return;}
      }
      if(resource==='motion'){
        // Motion Composer: capas (imágenes/texto) → composición determinista estilo Remotion
        if(req.method==='GET'&&!id){const pid=url.searchParams.get('projectId');if(!pid)throw new Error('Falta projectId.');const project=await store.get(pid);send(res,200,project.content.graph.events.filter(e=>e.kind==='motion'&&e.extensions&&'motionComposition'in e.extensions).map(e=>({event:e.id,label:e.label,composition:e.extensions!.motionComposition})));return;}
        if(req.method==='POST'&&!id){const input=z.strictObject({projectId:z.string().uuid(),revision:z.number().int().nonnegative(),label:z.string().default('Motion Composer'),startFrame:z.number().int().nonnegative().default(0),composition:z.record(z.string(),z.unknown())}).parse(await body(req));const project=await store.get(input.projectId);if(project.revision!==input.revision)throw new ConflictError('Recarga el proyecto antes de componer.');
          const renderSpec=compileComposition(input.composition as never);
          const eventId=`MO${String(project.content.graph.events.filter(e=>e.kind==='motion').length+1).padStart(2,'0')}_motion`;
          const event={id:eventId,label:input.label,kind:'motion' as const,startFrame:input.startFrame,endFrame:input.startFrame+renderSpec.durationFrames,status:'planned' as const,extensions:{purpose:`Motion Composer: ${renderSpec.layers.length} capas deterministas`,motionComposition:input.composition}};
          const content={...project.content,graph:{...project.content.graph,events:[...project.content.graph.events.filter(e=>e.id!==eventId),event]}};
          const edited=await store.edit(input.projectId,input.revision,`Motion Composer · ${input.composition.id as string}`,content);
          const job=await engine.enqueue(edited,'motion.render');
          send(res,201,{project:edited,job,eventId,renderSpec});return;}
      }
      if(resource==='providers'){
        if(req.method==='GET'&&!id){send(res,200,{providers:providerStatus()});return;}
        if(req.method==='POST'&&id==='test'&&!action){const input=z.strictObject({provider:z.string().min(1)}).parse(await body(req));send(res,200,await testConnection(input.provider));return;}
      }
      if(resource==='registries'&&req.method==='GET'&&!id){send(res,200,{registries});return;}
      if(resource==='clients'){
        if(req.method==='GET'&&!id){send(res,200,await clientStore.list());return;}
        if(req.method==='POST'&&!id&&!action){const input=z.strictObject({name:z.string().min(1),rawTxt:z.string().default('')}).parse(await body(req));let profile=await clientStore.put(clientProfileSchema.parse({schemaVersion:'abrxs.client-profile.v1',clientId:input.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name:input.name}));if(input.rawTxt){const draft=parseClientTxt(input.rawTxt,profile.clientId);profile=await clientStore.put(applyDraft(profile,draft));}send(res,201,profile);return;}
        if(req.method==='GET'&&id&&!action){const c=await clientStore.get(id);if(!c)throw new NotFoundError('Cliente no encontrado.');send(res,200,c);return;}
        if(req.method==='POST'&&id&&action==='import_txt'){const input=z.strictObject({rawTxt:z.string().min(1)}).parse(await body(req));const before=await clientStore.get(id);if(!before)throw new NotFoundError('Cliente no encontrado.');const draft=parseClientTxt(input.rawTxt,id);const after=applyDraft(before,draft);send(res,200,{draft,diff:diffProfile(before,after)});return;}
        if(req.method==='POST'&&id&&action==='apply_draft'){const input=z.strictObject({profile:clientProfileSchema}).parse(await body(req));const saved=await clientStore.put(input.profile);send(res,200,{profile:saved});return;}
        if(req.method==='POST'&&id&&action==='ai_package'){const input=z.strictObject({rawTxt:z.string().default(''),responseTxt:z.string().default('')}).parse(await body(req));const profile=await clientStore.get(id);const draft=parseClientTxt(input.rawTxt,id);if(input.responseTxt){const aiDraft=importAIResponse(input.responseTxt);const after=applyDraft(profile,draft);send(res,200,{package:exportAIPackage(profile,{...draft,raw:input.rawTxt||aiDraft.raw},{presets:{captions:'caption.amanda.vertical.v1', broll:'documentary_clean'},visualTypes:'ver /api/registries'}),importedDraft:aiDraft,diff:diffProfile(profile,after)});return;}send(res,200,{package:exportAIPackage(profile,draft,{presets:{},visualTypes:'ver /api/registries'})});return;}
        if(req.method==='POST'&&id&&action==='ai_import'){const input=z.strictObject({responseTxt:z.string().min(1),apply:z.boolean().default(false)}).parse(await body(req));const before=await clientStore.get(id);if(!before)throw new NotFoundError('Cliente no encontrado.');const aiDraft=importAIResponse(input.responseTxt);const after=applyDraft(before,aiDraft);const diff=diffProfile(before,after);if(input.apply)await clientStore.put(after);send(res,200,{diff,applied:input.apply,profile:input.apply?after:undefined});return;}
      }
      if(resource==='config'&&id==='resolve'&&req.method==='GET'){
        const client=url.searchParams.get('client');
        let overrides:Record<string,unknown>={};
        const pid=url.searchParams.get('projectId');
        let projectName:string|null=null;
        if(pid){const proj=await store.get(pid);projectName=proj.content.name;}
        const c=client?await clientStore.get(client):null;
        const resolved=resolveConfig({client:c,projectOverrides:overrides});
        send(res,200,{...resolved,projectName});return;}
      if(resource==='qa'&&id==='analyze'&&req.method==='GET'){
        const pid=url.searchParams.get('projectId');if(!pid)throw new Error('Falta projectId.');
        send(res,200,analyzeGraph(await store.get(pid)));return;}
      if(resource==='coach'&&id==='plan'&&req.method==='GET'){const pid=url.searchParams.get('projectId');if(!pid)throw new Error('Falta projectId.');const target=url.searchParams.get('target');send(res,200,buildCoachPlan(await store.get(pid),target==='capcut'||target==='davinci'?target:'any'));return;}
      // ── 0.6.0 — M1: vertical real MASTER → MediaSource → Piece → MP4 ──
      if(resource==='media'){
        if(req.method==='POST'&&id==='ingest'&&!action){const input=z.strictObject({projectId:z.string().uuid(),revision:z.number().int().nonnegative(),path:z.string().min(1),label:z.string().max(160).optional()}).parse(await body(req));const project=await store.get(input.projectId);if(project.revision!==input.revision)throw new ConflictError('Recarga el proyecto antes de ingestar.');send(res,201,await ingestMaster(canterStores,engine,project,{path:input.path,label:input.label}));return;}
        if(req.method==='GET'&&!id){send(res,200,{sources:await canterStores.mediaSources.list()});return;}
      }
      if(resource==='canter'){
        if(req.method==='GET'&&id==='pieces'&&!action){const pid=url.searchParams.get('projectId');const all=await canterStores.pieces.list();send(res,200,{pieces:pid?all.filter(p=>p.projectId===pid):all});return;}
        if(req.method==='POST'&&id==='pieces'&&!action){const input=z.strictObject({projectId:z.string().uuid(),revision:z.number().int().nonnegative(),pieceId:z.string().trim().min(1).max(120).optional(),label:z.string().trim().min(1).max(160),mediaSourceId:z.string().min(1),sourceRange:z.strictObject({startFrame:z.number().int().nonnegative(),endFrame:z.number().int().positive()}),eventRefs:z.array(z.string()).default([])}).parse(await body(req));const project=await store.get(input.projectId);if(project.revision!==input.revision)throw new ConflictError('Recarga el proyecto antes de crear la pieza.');const piece=await createPiece(canterStores,{projectId:input.projectId,pieceId:input.pieceId,label:input.label,mediaSourceId:input.mediaSourceId,sourceRange:input.sourceRange,eventRefs:input.eventRefs});send(res,201,piece);return;}
        if(req.method==='POST'&&id==='transcribe'&&!action){const input=z.strictObject({projectId:z.string().uuid(),revision:z.number().int().nonnegative(),mediaSourceId:z.string().min(1)}).parse(await body(req));const project=await store.get(input.projectId);if(project.revision!==input.revision)throw new ConflictError('Recarga el proyecto antes de transcribir.');const source=await canterStores.mediaSources.get(input.mediaSourceId);if(!source)throw new NotFoundError(`MediaSource ${input.mediaSourceId} no existe.`);const job=await engine.enqueue(project,'media.transcribe',{target:{kind:'media_source',ref:source.id}});send(res,201,{source,job});return;}
        if(req.method==='POST'&&id==='pieces'&&action&&extra==='export'){const input=z.strictObject({projectId:z.string().uuid(),revision:z.number().int().nonnegative()}).parse(await body(req));const project=await store.get(input.projectId);if(project.revision!==input.revision)throw new ConflictError('Recarga el proyecto antes de exportar.');send(res,201,await exportPiece(canterStores,engine,project,action));return;}
      }
      send(res,404,{error:'Ruta no encontrada.'});return;
    }
    if(req.method!=='GET'){send(res,405,{error:'Método no permitido.'});return;}
    const normalized=resolve(dist,'.'+decodeURIComponent(url.pathname));
    if(!normalized.startsWith(dist+'/')&&normalized!==dist){send(res,403,{error:'Ruta no permitida.'});return;}
    let file=normalized;
    try{if(url.pathname==='/')file=join(dist,'index.html');const content=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'} as Record<string,string>)[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(content);}
    catch{send(res,404,{error:'Interfaz no compilada. Ejecuta npm run build o usa npm run dev.'});}
  }catch(e){send(res,e instanceof ConflictError?409:e instanceof NotFoundError?404:400,{error:e instanceof ZodError?e.issues.map(i=>i.message).join(' '):e instanceof Error?e.message:'Error inesperado.'});}
});
async function main(){
  const release=await lock();
  try{
    await projectRepository.init();await jobRepository.init();await clientStore.init();await canterStores.mediaSources.init();await canterStores.pieces.init();await store.list();await engine.recover();
    server.on('error',async error=>{console.error(error.message);await engine.stop();await release();process.exit(1);});
    server.listen(port,'127.0.0.1',()=>console.log(`AbrxsVAV: http://127.0.0.1:${port} · datos ${dataDirectory}`));
    for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void engine.stop().then(()=>new Promise<void>(r=>server.close(()=>r()))).then(release).then(()=>process.exit(0));});
  }catch(error){await release();throw error;}
}
main().catch(e=>{console.error('No se pudo iniciar AbrxsVAV:',e.message);process.exit(1);});

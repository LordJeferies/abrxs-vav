import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { z, ZodError } from 'zod';
import { ProjectStore, JobEngine, ConflictError, NotFoundError } from '@abraxas/core';
import { projectSchema, jobSchema, projectContentSchema, timebaseSchema } from '@abraxas/contracts';
import { FileRepository } from './file-repository';
import { handlers } from './handlers';
import { catalog } from './catalog';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const dataDirectory=resolve(process.env.ABRAXAS_DATA_DIR||join(root,'.abraxas-data'));
const port=Number(process.env.ABRAXAS_PORT||4317);
const dist=join(root,'apps/desktop/dist');
const projectRepository=new FileRepository(join(dataDirectory,'projects'),projectSchema);
const jobRepository=new FileRepository(join(dataDirectory,'jobs'),jobSchema);
const store=new ProjectStore(projectRepository);
const engine=new JobEngine(jobRepository,handlers,value=>createHash('sha256').update(value).digest('hex'),{
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
      const segments=url.pathname.slice(5).split('/');const [resource,id,action]=segments;
      if(req.method==='GET'&&resource==='health'){send(res,200,{status:'ready',version:'0.4.0',product:'AbrxsVAV',storage:'local-files',handlers:Object.keys(handlers),actions:catalog.length});return;}
      if(req.method==='GET'&&resource==='catalog'){send(res,200,{product:'AbrxsVAV',version:'0.4.0',actions:catalog});return;}
      if(resource==='projects'){
        if(req.method==='GET'&&!id){send(res,200,await store.list());return;}
        if(req.method==='POST'&&!id){const input=z.strictObject({name:z.string(),timebase:timebaseSchema}).parse(await body(req));send(res,201,await store.create(input.name,input.timebase));return;}
        if(req.method==='GET'&&id&&!action){send(res,200,await store.get(id));return;}
        if(req.method==='PUT'&&id&&!action){const input=z.strictObject({revision:z.number().int().nonnegative(),label:z.string().min(1).max(200),content:projectContentSchema}).parse(await body(req));send(res,200,await store.edit(id,input.revision,input.label,input.content));return;}
        if(req.method==='POST'&&id&&(action==='undo'||action==='redo')){const input=revisionSchema.parse(await body(req));send(res,200,await store.travel(id,input.revision,action));return;}
      }
      if(resource==='jobs'){
        if(req.method==='GET'&&!id){send(res,200,await engine.list());return;}
        if(req.method==='POST'&&!id){const input=z.strictObject({projectId:z.string().uuid(),revision:z.number().int().nonnegative(),kind:z.enum(['project.validate','project.edit-plan'])}).parse(await body(req));const project=await store.get(input.projectId);if(project.revision!==input.revision)throw new ConflictError('Recarga el proyecto antes de crear el trabajo.');send(res,201,await engine.enqueue(project,input.kind));return;}
        if(req.method==='POST'&&id&&action==='cancel'){send(res,200,await engine.cancel(id));return;}
        if(req.method==='POST'&&id&&action==='retry'){send(res,200,await engine.retry(id));return;}
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
    await projectRepository.init();await jobRepository.init();await store.list();await engine.recover();
    server.on('error',async error=>{console.error(error.message);await engine.stop();await release();process.exit(1);});
    server.listen(port,'127.0.0.1',()=>console.log(`AbrxsVAV: http://127.0.0.1:${port} · datos ${dataDirectory}`));
    for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void engine.stop().then(()=>new Promise<void>(r=>server.close(()=>r()))).then(release).then(()=>process.exit(0));});
  }catch(error){await release();throw error;}
}
main().catch(e=>{console.error('No se pudo iniciar AbrxsVAV:',e.message);process.exit(1);});

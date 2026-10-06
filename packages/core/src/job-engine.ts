import { jobSchema, defaultJobTarget, type Job, type JobPayload, type JobTarget, type Project } from '@abraxas/contracts';
import { NotFoundError, SerialQueue, type Repository } from './project-store';
export type JobHandler = (job:Job,context:{signal:AbortSignal;progress:(value:number)=>Promise<void>})=>Promise<string>;
export interface JobEngineOptions {
  /** Watchdog: tiempo máximo por tipo de trabajo (ms). Al expirar se aborta y marca failed. */
  watchdogMs?:Record<string,number>;
  defaultWatchdogMs?:number;
}
export class JobEngine {
  private queue=new SerialQueue(); private active=new Map<string,AbortController>(); private pumping=false; private stopped=false; private runningTask:Promise<void>=Promise.resolve(); private paused=false;
  /** Pausa la DESENCOLACIÓN: los jobs en curso terminan (pausa cooperativa). */
  pause():void{this.paused=true;}
  resume():void{this.paused=false;this.pump();}
  get isPaused():boolean{return this.paused;}
  constructor(private repository:Repository<Job>,private handlers:Record<string,JobHandler>,private fingerprint:(value:string)=>string,private options:JobEngineOptions={}){}
  list(){return this.repository.list();}
  async get(id:string){const j=await this.repository.get(id);if(!j)throw new NotFoundError('Trabajo no encontrado.');return j;}
  async recover(){
    await this.queue.run(async()=>{for(const job of await this.list()) if(job.status==='running') await this.save({...job,status:'failed',interrupted:true,error:'La aplicación se cerró durante este trabajo. Puedes reintentarlo.'});}); this.pump();
  }
  /** Opciones v2.5 (0.5.1): target explícito (nunca resolver "el primer evento compatible") y payload libre.
      Sin target, el job es sobre el proyecto completo (legado, compatible con jobs existentes).
      COMPATIBILIDAD DE IDEMPOTENCIA: el fingerprint se calcula sobre los target/payload CRUDOS
      (no sobre el default) — sin options explícitas, JSON.stringify omite las claves undefined y
      el string hash es EXACTAMENTE el legacy {kind,revision,content}; los jobs persistidos antes
      de 0.5.1 siguen deduplicando tras actualizar. Con target/payload explícitos entra el nuevo
      formato {kind,revision,content,target,payload}. */
  enqueue(project:Project,kind:string,options?:{target?:JobTarget;payload?:JobPayload}):Promise<Job>{
    return this.queue.run(async()=>{
      if(!this.handlers[kind])throw new Error('Tipo de trabajo no disponible.');
      const target=options?.target??defaultJobTarget(project.id);
      const payload=options?.payload;
      const inputFingerprint=this.fingerprint(JSON.stringify({kind,revision:project.revision,content:project.content,target:options?.target,payload:options?.payload}));
      const existing=(await this.list()).find(j=>j.inputFingerprint===inputFingerprint && ['queued','running','completed'].includes(j.status));
      if(existing)return existing;
      const timestamp=new Date().toISOString();
      const job=jobSchema.parse({schemaVersion:'abraxas.job.v2',id:crypto.randomUUID(),projectId:project.id,kind,handler:kind,status:'queued',inputFingerprint,input:project.content,sourceRevision:project.revision,progress:0,attempt:0,maxAttempts:3,createdAt:timestamp,updatedAt:timestamp,target,payload});
      await this.save(job); this.pump(); return job;
    });
  }
  cancel(id:string){return this.queue.run(async()=>{
    const job=await this.get(id);if(!['queued','running'].includes(job.status))throw new Error('Solo se pueden cancelar trabajos activos.');
    const next=await this.save({...job,status:'cancelled'});this.active.get(id)?.abort();return next;
  });}
  retry(id:string){return this.queue.run(async()=>{
    const job=await this.get(id);if(!['failed','cancelled'].includes(job.status))throw new Error('Este trabajo no necesita reintento.');
    if(job.attempt>=job.maxAttempts)throw new Error('Se alcanzó el máximo de intentos.');
    if(this.active.has(id))throw new Error('La cancelación todavía está terminando. Reintenta en un momento.');
    const next=await this.save({...job,status:'queued',progress:0,error:undefined,output:undefined,interrupted:false});this.pump();return next;
  });}
  async stop(){this.stopped=true;for(const controller of this.active.values())controller.abort();await this.runningTask;await this.queue.run(async()=>{});}
  private async save(job:Job){const value=jobSchema.parse({...job,updatedAt:new Date().toISOString()});await this.repository.put(value.id,value);return value;}
  private pump(){if(this.pumping||this.stopped||this.paused)return;this.pumping=true;this.runningTask=Promise.resolve().then(()=>this.run()).catch(e=>{console.error('Job engine persistence error:',e);this.stopped=true;}).finally(async()=>{this.pumping=false;if(!this.stopped&&!this.paused&&(await this.list()).some(j=>j.status==='queued'))this.pump();});}
  private async run(){
    while(!this.stopped&&!this.paused){
      const job=await this.queue.run(async()=>{
        const candidate=(await this.list()).filter(j=>j.status==='queued').sort((a,b)=>a.createdAt.localeCompare(b.createdAt))[0];
        if(!candidate)return null;return this.save({...candidate,status:'running',attempt:candidate.attempt+1});
      });
      if(!job||this.stopped)return;
      const controller=new AbortController();this.active.set(job.id,controller);
      const watchdogMs=this.options.watchdogMs?.[job.kind]??this.options.defaultWatchdogMs;
      const watchdog=watchdogMs?setTimeout(()=>controller.abort(new Error(`Watchdog: el trabajo excedió ${Math.round(watchdogMs/1000)} s y fue cancelado.`)),watchdogMs):null;
      try{
        const handler=this.handlers[job.handler];if(!handler)throw new Error('Handler no instalado.');
        const output=await handler(job,{signal:controller.signal,progress:value=>this.queue.run(async()=>{
          const current=await this.get(job.id);if(current.status==='running'&&!this.stopped)await this.save({...current,progress:Math.max(current.progress,Math.min(0.99,Math.max(0,value)))});
        })});
        await this.queue.run(async()=>{const current=await this.get(job.id);if(current.status==='running'&&!this.stopped&&!controller.signal.aborted)await this.save({...current,status:'completed',progress:1,output});});
      }catch(error){
        const message=error instanceof Error?error.message:'Trabajo fallido.';
        await this.queue.run(async()=>{const current=await this.get(job.id);if(current.status==='running'&&!this.stopped)await this.save({...current,status:'failed',error:message});});
      }finally{if(watchdog)clearTimeout(watchdog);this.active.delete(job.id);}
    }
  }
}

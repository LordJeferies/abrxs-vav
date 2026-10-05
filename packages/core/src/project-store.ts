import { projectSchema, projectContentSchema, type Project, type ProjectContent, type Timebase } from '@abraxas/contracts';
export interface Repository<T> { list():Promise<T[]>; get(id:string):Promise<T|null>; put(id:string,value:T):Promise<void>; }
export class ConflictError extends Error {}
export class NotFoundError extends Error {}
export class SerialQueue {
  private tail:Promise<unknown> = Promise.resolve();
  run<T>(action:()=>Promise<T>):Promise<T> { const task = this.tail.then(action); this.tail = task.catch(()=>{}); return task; }
}
export class ProjectStore {
  private queue = new SerialQueue();
  constructor(private repository:Repository<Project>, private now=()=>new Date().toISOString(), private id=()=>crypto.randomUUID()) {}
  list(){ return this.repository.list(); }
  async get(id:string){ const p=await this.repository.get(id); if(!p) throw new NotFoundError('Proyecto no encontrado.'); return p; }
  create(name:string,timebase:Timebase):Promise<Project> {
    return this.queue.run(async()=>{
      const id=this.id(), timestamp=this.now();
      const p=projectSchema.parse({schemaVersion:'abraxas.project.v1',id,revision:0,createdAt:timestamp,updatedAt:timestamp,
        content:{name,graph:{schemaVersion:'abraxas.production-graph.v2',projectId:id,timebase,events:[]}},history:{undo:[],redo:[]}});
      await this.repository.put(id,p); return p;
    });
  }
  edit(id:string,expectedRevision:number,label:string,content:ProjectContent) {
    return this.queue.run(async()=>{
      const p=await this.get(id); this.check(p,expectedRevision); const after=projectContentSchema.parse(content);
      if(after.graph.projectId !== id) throw new Error('No se puede cambiar la identidad del proyecto.');
      if(JSON.stringify(p.content)===JSON.stringify(after)) return p;
      const next=projectSchema.parse({...p, revision:p.revision+1, updatedAt:this.now(), content:after,
        history:{undo:[...p.history.undo,{id:this.id(),label,timestamp:this.now(),before:p.content,after}].slice(-100),redo:[]}});
      await this.repository.put(id,next); return next;
    });
  }
  travel(id:string,expectedRevision:number,direction:'undo'|'redo') {
    return this.queue.run(async()=>{
      const p=await this.get(id); this.check(p,expectedRevision);
      const origin=p.history[direction], operation=origin.at(-1); if(!operation) return p;
      const opposite=direction==='undo'?'redo':'undo';
      const next=projectSchema.parse({...p,revision:p.revision+1,updatedAt:this.now(),content:operation[direction==='undo'?'before':'after'],
        history:{...p.history,[direction]:origin.slice(0,-1),[opposite]:[...p.history[opposite],operation]}});
      await this.repository.put(id,next); return next;
    });
  }
  private check(p:Project,revision:number){if(p.revision!==revision) throw new ConflictError('El proyecto cambió en otra ventana. Recarga antes de editar.');}
}

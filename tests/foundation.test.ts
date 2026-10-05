import { describe,it,expect,afterEach } from 'vitest';
import { mkdtemp,rm,readFile,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { ProjectStore,JobEngine,ConflictError,type JobHandler } from '@abraxas/core';
import { projectSchema,jobSchema,type Job } from '@abraxas/contracts';
import { FileRepository,atomicWrite } from '../apps/service/src/file-repository';
import { handlers } from '../apps/service/src/handlers';
const directories:string[]=[];
const engines:JobEngine[]=[];
afterEach(async()=>{for(const engine of engines.splice(0))await engine.stop();for(const dir of directories.splice(0))await rm(dir,{recursive:true,force:true});});
async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'abraxas-test-'));directories.push(dir);
 const repo=new FileRepository(join(dir,'projects'),projectSchema);await repo.init();
 const jobs=new FileRepository(join(dir,'jobs'),jobSchema);await jobs.init();
 const store=new ProjectStore(repo);const project=await store.create('JOC · Podcast',{fpsNumerator:30000,fpsDenominator:1001});
 return {dir,repo,jobs,store,project};
}
const fingerprint=(value:string)=>createHash('sha256').update(value).digest('hex');
function engine(jobs:FileRepository<Job>,registry:Record<string,JobHandler>){const value=new JobEngine(jobs,registry,fingerprint);engines.push(value);return value;}
async function eventually(condition:()=>Promise<boolean>){for(let i=0;i<200;i++){if(await condition())return;await wait(5);}throw new Error('Timed out');}
describe('ProjectStore local persistence',()=>{
 it('reopens a project and preserves undo/redo through service replacement',async()=>{
  const {store,repo,project}=await fixture();const next=await store.edit(project.id,0,'Renombrar',{...project.content,name:'Amanda'});
  const reopened=new ProjectStore(new FileRepository(repo.directory,projectSchema));expect((await reopened.get(project.id)).content.name).toBe('Amanda');
  const undone=await reopened.travel(next.id,1,'undo');expect(undone.content.name).toBe(project.content.name);
  const redone=await reopened.travel(next.id,2,'redo');expect(redone.content.name).toBe('Amanda');expect(redone.revision).toBe(3);
  await reopened.travel(next.id,3,'undo');await reopened.edit(next.id,4,'Otra edición',{...project.content,name:'Otra'});expect((await reopened.get(next.id)).history.redo).toHaveLength(0);
 });
 it('rejects stale editors and invalid frame ranges without changing disk',async()=>{
  const {store,project}=await fixture();await store.edit(project.id,0,'Nombre',{...project.content,name:'Nuevo'});
  await expect(store.edit(project.id,0,'Perdido',{...project.content,name:'Obsoleto'})).rejects.toBeInstanceOf(ConflictError);
  await expect(store.edit(project.id,1,'Rango roto',{...project.content,graph:{...project.content.graph,events:[{id:'br',kind:'b_roll',startFrame:20,endFrame:10,status:'planned'}]}})).rejects.toThrow();
  expect((await store.get(project.id)).content.name).toBe('Nuevo');
 });
 it('keeps previous bytes after failure before rename; corrupt files are never silently overwritten',async()=>{
  const {repo,project}=await fixture();const path=join(repo.directory,`${project.id}.json`),before=await readFile(path,'utf8');
  await expect(atomicWrite(path,'broken',async()=>{throw new Error('Power loss');})).rejects.toThrow('Power loss');expect(await readFile(path,'utf8')).toBe(before);
  await writeFile(path,'{broken');await expect(repo.put(project.id,project)).rejects.toThrow('inválido');expect(await readFile(path,'utf8')).toBe('{broken');
 });
 it('serializes simultaneous operations so only one expected revision commits',async()=>{
  const {store,project}=await fixture();const results=await Promise.allSettled(['A','B'].map(name=>store.edit(project.id,0,'Nombre',{...project.content,name})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await store.get(project.id)).revision).toBe(1);
 });
});
describe('JobEngine',()=>{
 it('persists actual validation output and reuses identical completed input',async()=>{
  const {jobs,project}=await fixture(),worker=engine(jobs,handlers);await worker.recover();const job=await worker.enqueue(project,'project.validate');
  await eventually(async()=>(await worker.get(job.id)).status==='completed');expect(JSON.parse((await worker.get(job.id)).output!).structuralValidation).toBe('passed');
  expect((await worker.enqueue(project,'project.validate')).id).toBe(job.id);
  const restarted=engine(new FileRepository(jobs.directory,jobSchema),handlers);await restarted.recover();expect((await restarted.get(job.id)).output).toBeDefined();
 });
 it('recovers running jobs as interrupted and retries their original snapshot',async()=>{
  const {jobs,project}=await fixture();const first=engine(jobs,{'test':async(_,{signal,progress})=>{await progress(.4);await wait(10000,undefined,{signal});return 'old';}});
  const job=await first.enqueue(project,'test');await eventually(async()=>(await first.get(job.id)).progress===.4);await first.stop();
  const restarted=engine(jobs,{'test':async j=>j.input.name});await restarted.recover();const recovered=await restarted.get(job.id);expect(recovered.status).toBe('failed');expect(recovered.interrupted).toBe(true);
  await restarted.retry(job.id);await eventually(async()=>(await restarted.get(job.id)).status==='completed');expect((await restarted.get(job.id)).attempt).toBe(2);expect((await restarted.get(job.id)).output).toBe(project.content.name);
 });
 it('cancellation prevents a late handler result from becoming completed',async()=>{
  const {jobs,project}=await fixture();let finish!:(s:string)=>void;const worker=engine(jobs,{test:async()=>new Promise<string>(r=>{finish=r;})});
  const job=await worker.enqueue(project,'test');await eventually(async()=>!!finish);await worker.cancel(job.id);finish('late result');await wait(20);
  expect((await worker.get(job.id)).status).toBe('cancelled');expect((await worker.get(job.id)).output).toBeUndefined();
 });
 it('isolates failures, limits retries and keeps the queue moving',async()=>{
  const {jobs,project}=await fixture();const worker=engine(jobs,{bad:async()=>{throw new Error('Provider failed');},good:async()=> 'ok'});
  const bad=await worker.enqueue(project,'bad'),good=await worker.enqueue(project,'good');await eventually(async()=>(await worker.get(good.id)).status==='completed');
  for(let attempt=1;attempt<3;attempt++){await eventually(async()=>(await worker.get(bad.id)).status==='failed');await worker.retry(bad.id);}
  await eventually(async()=>(await worker.get(bad.id)).status==='failed'&&(await worker.get(bad.id)).attempt===3);await expect(worker.retry(bad.id)).rejects.toThrow('máximo');
 });
 it('compiles instructions from integer frames with the rational timebase',async()=>{
  const {project}=await fixture();project.content.graph.events=[{id:'BR01',kind:'b_roll',status:'planned',startFrame:30,endFrame:60,assetRefs:['BR01.mp4']}];
  const output=await handlers['project.edit-plan']({input:project.content,sourceRevision:2} as Job,{signal:new AbortController().signal,progress:async()=>{}});
  expect(output).toContain('1.001–2.002 s');expect(output).toContain('BR01.mp4');
 });
});

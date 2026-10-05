import { useCallback, useEffect, useState } from 'react';
import type { Job, Project, ProjectContent, Timebase } from '@abraxas/contracts';

export async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch(`/api/${path}`,{method,headers:{'Content-Type':'application/json','X-Abraxas-Client':'local'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let value;try{value=JSON.parse(text);}catch{throw new Error('El servicio local no responde. Inícialo con npm run dev o npm start.');}
  if(!response.ok)throw new Error(value.error||'La operación no se completó.');return value as T;
}
export function download(name:string,text:string,type='application/json'){
  const url=URL.createObjectURL(new Blob([text],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function useWorkspace(){
  const [projects,setProjects]=useState<Project[]>([]),[project,setProject]=useState<Project|null>(null),[jobs,setJobs]=useState<Job[]>([]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[connected,setConnected]=useState(false);
  const refresh=useCallback(async(preferred?:string)=>{
    const list=await request<Project[]>('projects');setProjects(list);
    const id=preferred||localStorage.getItem('abraxas.selected-project');
    const selected=list.find(p=>p.id===id)||list[0]||null;setProject(selected);
    if(selected)localStorage.setItem('abraxas.selected-project',selected.id);
    setJobs(await request<Job[]>('jobs'));setConnected(true);
  },[]);
  useEffect(()=>{let disposed=false;
    void refresh().catch(e=>{if(!disposed){setError(e.message);setConnected(false);}}).finally(()=>{if(!disposed)setReady(true);});
    const timer=setInterval(()=>{void request<Job[]>('jobs').then(j=>{if(!disposed){setJobs(j);setConnected(true);}}).catch(()=>{if(!disposed)setConnected(false);});},1000);
    return()=>{disposed=true;clearInterval(timer);};
  },[refresh]);
  async function action(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();return true;}catch(e){setError(e instanceof Error?e.message:'Error inesperado.');return false;}finally{setBusy(false);}}
  const save=async(content:ProjectContent,label:string)=>{if(!project)return false;return action(async()=>{const next=await request<Project>(`projects/${project.id}`,'PUT',{revision:project.revision,content,label});await refresh(next.id);});};
  return {projects,project,jobs,error,busy,ready,connected,setError,
    create:(name:string,timebase:Timebase)=>action(async()=>{const next=await request<Project>('projects','POST',{name,timebase});await refresh(next.id);}),
    select:(id:string)=>action(()=>refresh(id)),reload:()=>action(()=>refresh(project?.id)),save,
    travel:(direction:'undo'|'redo')=>action(async()=>{if(project){await request(`projects/${project.id}/${direction}`,'POST',{revision:project.revision});await refresh(project.id);}}),
    enqueue:(kind:string)=>action(async()=>{if(project){await request('jobs','POST',{projectId:project.id,revision:project.revision,kind});setJobs(await request<Job[]>('jobs'));}}),
    jobAction:(id:string,command:'cancel'|'retry')=>action(async()=>{await request(`jobs/${id}/${command}`,'POST',{});setJobs(await request<Job[]>('jobs'));})
  };
}
export type Workspace=ReturnType<typeof useWorkspace>;

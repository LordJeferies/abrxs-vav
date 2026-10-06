import { useWorkspace } from './workspace';
import { ProjectHub } from './ProjectHub';
import { Activity } from './Activity';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';
import { VisualStudio } from './VisualStudio';
import { Canter } from './Canter';
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
const Workflow = lazy(()=>import('./Workflow'));

type Station = 'hub'|'plan'|'canter'|'dresser'|'visual'|'workflow'|'review'|'delivery'|'clients'|'library'|'activity';
const stations: {id:Station; label:string; description:string; status?:string}[] = [
  {id:'hub',label:'Project Hub',description:'Estado y continuidad del proyecto'},
  {id:'plan',label:'Plan',description:'Idea · Beta · Alfa · guion · Visual Plan',status:'planned'},
  {id:'canter',label:'Canter',description:'Transcribir · alinear · seleccionar · cortar',status:'m2'},
  {id:'dresser',label:'Dresser',description:'B-roll · XR · captions · motion · SFX',status:'planned'},
  {id:'visual',label:'Visual Lab',description:'Visual Studio · buscar · generar · comparar',status:'studio-v1'},
  {id:'workflow',label:'Workflow Studio',description:'Recipes y automatización audiovisual',status:'prototype'},
  {id:'review',label:'Review',description:'Notas · comparar · aprobar',status:'companion'},
  {id:'delivery',label:'Delivery',description:'MP4 · assets · DaVinci · CapCut',status:'planned'},
  {id:'clients',label:'Clients',description:'Brand · fonts · glossary · presets',status:'planned'},
  {id:'library',label:'Library',description:'Assets · packs · templates',status:'planned'},
  {id:'activity',label:'Activity',description:'Jobs · errors · retries · doctor',status:'foundation'}
];


function ShellCard({title,children}:{title:string;children:ReactNode}){return <section className="glass card"><h3>{title}</h3>{children}</section>}

export function App(){
  const [active,setActive]=useState<Station>('hub');
  const w=useWorkspace();
  const station=useMemo(()=>stations.find(s=>s.id===active)!,[active]);
  return <div className="app-shell">
      <aside className="sidebar glass">
        <div className="brand"><div className="mark">V</div><div><strong>ABRXSVAV</strong><span>Video · Audio · Visual · v0.4</span></div></div>
      <nav aria-label="Estaciones">{stations.map(s=><button key={s.id} className={active===s.id?'active':''} onClick={()=>setActive(s.id)}><b>{s.label}{(s.id==='hub'||s.id==='activity')&&<span className="nav-dot"/>}</b><small>{s.description}</small></button>)}</nav>
      <div className="sidebar-foot">Planificar · cortar · vestir · revisar</div>
    </aside>
    <main>
      <header className="topbar glass"><div><small>PROYECTO</small><h1>{w.project?.content.name||'Sin proyecto abierto'}</h1></div><div className="status"><span className={`dot ${w.connected?'':'offline'}`}/>{w.busy?'Guardando…':w.connected?'Servicio local conectado':'Servicio local desconectado'}</div></header>
      {w.error&&<div className="error-banner" role="alert"><span>{w.error}</span><button disabled={w.busy} onClick={()=>void w.reload()}>Recargar datos</button><button onClick={()=>w.setError('')}>Cerrar</button></div>}
      {!w.ready?<div className="content">Abriendo tu estudio…</div>:<ModuleErrorBoundary key={active} moduleId={active}>{active==='hub'?<ProjectHub workspace={w}/>:active==='activity'?<Activity workspace={w}/>:active==='workflow'?<Suspense fallback={<div className="content">Abriendo Workflow Studio…</div>}><Workflow/></Suspense>:active==='visual'?<VisualStudio workspace={w}/>:<StationPage title={station.label} description={station.description} status="Pendiente de implementación"/>}</ModuleErrorBoundary>}
    </main>
  </div>
}


function StationPage({title,description,status}:{title:string;description:string;status?:string}){
 const details:Record<string,string[]>={
  'Canter':['Ingest y media source','Word-level transcript + alignment','Fichas, bloques, source map y cortes','Adapter incremental hacia Canter 3.8.1'],
  'Dresser':['Visual Director','B-roll / X-roll / captions / SFX','Frame-accurate editor + inspector','Auto render, QA y reexport individual'],
  'Visual Lab':['Client/source/stock search','AI image/video generation','Compare, annotate, enhance','Browser-assisted/manual handoff'],
  'Review':['Desktop review module','Abrxs-Review web companion','Timed notes and approvals','Comparison and delivery feedback'],
  'Delivery':['Final MP4','Assets only','CapCut Kit','DaVinci human + MCP plans'],
  'Clients':['TXT/MD/JSON import','Brand tokens and fonts','Glossary and negative rules','Style packs + project overrides'],
  'Library':['Asset provenance','Visual/Motion/Caption packs','Client components','Search and reuse'],
  'Activity':['Persistent Job Engine','Retry/cancel/resume','Resource scheduling','Doctor + diagnostics'],
  'Plan':['Script / transcript only','Beta → Alfa','Visual Plan before recording','AI package roundtrip']
 };
 return <div className="content"><section className="hero compact glass"><div><p className="eyebrow">{status||'MODULE'}</p><h2>{title}</h2><p>{description}</p></div></section><div className="grid two"><ShellCard title="Responsabilidad">{(details[title]||['Module contract','Independent implementation','Shared project state','Tests + diagnostics']).map(x=><div className="check" key={x}>· {x}</div>)}</ShellCard><ShellCard title="Regla de integración"><p>Este módulo no debe guardar una verdad paralela. Lee y escribe contratos versionados del proyecto; procesos caros pasan por Job Engine y assets por Asset Store.</p></ShellCard></div></div>
}

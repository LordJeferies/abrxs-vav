import { useCallback,useEffect,useRef,useState } from 'react';
import type { Workspace } from './workspace';
import { request } from './workspace';
import type { MediaSource,Piece } from '@abraxas/contracts';

/* ═══ CANTER — transcribir · alinear · seleccionar · cortar (M2 UI) ═══
   Datos REALES del servicio: /api/media/*, /api/canter/*, /api/jobs.
   El dominio vive en frames; los segundos solo se muestran (frontera UI).
   El video usa el PROXY vía streaming con Range (scrub sin cargar el máster). */

interface TranscriptWords { language?:string; segments:Array<{start:number;end:number;text:string;words?:Array<{start:number;end:number;word:string}>}> }
interface AlignCandidate { startFrame:number; endFrame:number; confidence:number; matchedText:string; strategy:string }

const mediaUrl=(sourceId:string,kind:string)=>`/api/media/${encodeURIComponent(sourceId)}/file?kind=${kind}`;
const toSec=(frames:number,tb:{fpsNumerator:number;fpsDenominator:number})=>frames*tb.fpsDenominator/tb.fpsNumerator;
const fmtTimecode=(frames:number,tb:{fpsNumerator:number;fpsDenominator:number})=>{
  const secs=frames*tb.fpsDenominator/tb.fpsNumerator,fps=tb.fpsNumerator/tb.fpsDenominator;
  const hh=Math.floor(secs/3600),mm=Math.floor(secs/60)%60,ss=Math.floor(secs)%60,ff=Math.floor((secs-Math.floor(secs))*fps);
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(ff).padStart(2,'0')}`;
};

export function Canter({workspace}:{workspace:Workspace}){
  const project=workspace.project;
  const tb=project?.content.graph.timebase??{fpsNumerator:30000,fpsDenominator:1001};
  const [sources,setSources]=useState<MediaSource[]>([]);
  const [sourceId,setSourceId]=useState<string>('');
  const [transcript,setTranscript]=useState<TranscriptWords|null>(null);
  const [pieces,setPieces]=useState<Piece[]>([]);
  const [selected,setSelected]=useState<Piece|null>(null);
  const [ingestPath,setIngestPath]=useState('');
  const [queryText,setQueryText]=useState('');
  const [opening,setOpening]=useState('');const [closing,setClosing]=useState('');
  const [anchorMode,setAnchorMode]=useState(false);
  const [candidates,setCandidates]=useState<AlignCandidate[]|null>(null);
  const [busy,setBusy]=useState('');const [error,setError]=useState('');
  const videoRef=useRef<HTMLVideoElement|null>(null);

  const refresh=useCallback(async()=>{
    try{
      setSources((await request<{sources:MediaSource[]}>('media/sources')).sources);
      if(project)setPieces((await request<{pieces:Piece[]}>(`canter/pieces?projectId=${project.id}`)).pieces);
    }catch(e){setError(e instanceof Error?e.message:'Error');}
  },[project]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if(!sourceId){setTranscript(null);return;}
    void request<TranscriptWords>(`canter/transcript/${sourceId}`).then(setTranscript).catch(()=>setTranscript(null));
  },[sourceId]);

  const act=async(label:string,fn:()=>Promise<void>)=>{setBusy(label);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Error inesperado');}finally{setBusy('');}};

  const ingest=()=>act('ingest',async()=>{
    if(!project)throw new Error('Abre un proyecto primero.');
    await request('media/ingest','POST',{projectId:project.id,revision:project.revision,path:ingestPath,label:'Máster'});
    setIngestPath('');await refresh();
  });
  const transcribe=()=>act('transcribe',async()=>{
    if(!project)throw new Error('Abre un proyecto primero.');
    await request('canter/transcribe','POST',{projectId:project.id,revision:project.revision,mediaSourceId:sourceId});
    setTimeout(()=>void refresh(),1200); // el job corre en background; refresca para transcriptRef
  });
  const align=()=>act('align',async()=>{
    const body=anchorMode?{mediaSourceId:sourceId,openingText:opening,closingText:closing}:{mediaSourceId:sourceId,text:queryText};
    const r=await request<{candidates:AlignCandidate[]}>('canter/align','POST',body);
    setCandidates(r.candidates);if(!r.candidates.length)setError('Sin coincidencias en el transcript.');
  });
  const createFromText=(candidateIndex?:number)=>act('piece',async()=>{
    if(!project)throw new Error('Abre un proyecto primero.');
    const body=anchorMode
      ?{projectId:project.id,revision:project.revision,label:opening.slice(0,40)||'Pieza por texto',mediaSourceId:sourceId,openingText:opening,closingText:closing,candidateIndex}
      :{projectId:project.id,revision:project.revision,label:queryText.slice(0,40)||'Pieza por texto',mediaSourceId:sourceId,text:queryText,candidateIndex};
    const r=await request<{piece?:Piece;status?:string;candidates?:AlignCandidate[]}>('canter/pieces/from_text','POST',body);
    if(!r.piece){setCandidates(r.candidates??[]);return;} // 409 ambiguo → chips de candidates
    setCandidates(null);await refresh();
  });
  const exportPiece=()=>act('export',async()=>{
    if(!project||!selected)throw new Error('Selecciona una pieza.');
    await request(`canter/pieces/${selected.id}/export`,'POST',{projectId:project.id,revision:project.revision});
    setTimeout(()=>void refresh(),800);
  });
  const savePiece=()=>act('save',async()=>{
    if(!selected)throw new Error('Selecciona una pieza.');
    await request(`canter/pieces/${selected.id}`,'PUT',{label:selected.label,sourceRange:selected.sourceRange});
    await refresh();
  });
  const deletePiece=()=>act('delete',async()=>{
    if(!selected)throw new Error('Selecciona una pieza.');
    if(!window.confirm(`¿Eliminar la pieza ${selected.id}? (los MP4 exportados no se borran)`))return;
    await request(`canter/pieces/${selected.id}/delete`,'POST',{});
    setSelected(null);await refresh();
  });
  const source=sources.find(s=>s.id===sourceId)??null;

  return <div className="content">
    <section className="hero compact glass"><div><p className="eyebrow">CANTER · M2</p><h2>Transcribir · alinear · cortar</h2>
      <p>Vertical real: máster → MediaSource → transcript word-level → pieza por texto → MP4. Frames canónicos {tb.fpsNumerator}/{tb.fpsDenominator}.</p></div></section>
    {error&&<div className="error-banner" role="alert"><span>{error}</span><button onClick={()=>setError('')}>Cerrar</button></div>}

    <div className="grid two">
      <section className="glass card">
        <h3>1 · Máster</h3>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <input style={{flex:1}} placeholder="/ruta/al/master.mp4" value={ingestPath} onChange={e=>setIngestPath(e.target.value)}/>
          <button disabled={busy!==''||!ingestPath} onClick={ingest}>Ingestar</button>
        </div>
        <select value={sourceId} onChange={e=>setSourceId(e.target.value)} style={{width:'100%'}}>
          <option value="">{sources.length?'Elegir máster…':'Sin másters ingestrados'}</option>
          {sources.map(s=><option key={s.id} value={s.id}>{s.id} · {s.kind}{s.durationFrames?` · ${s.durationFrames}f`:''}</option>)}
        </select>
        {source&&<>
          {source.proxyRef
            ?<video ref={videoRef} controls style={{width:'100%',marginTop:10,borderRadius:12}} src={mediaUrl(source.id,'proxy')}/>
            :<p className="sub" style={{marginTop:10}}>Sin proxy todavía (ingesta en curso).</p>}
          {source.filmstripRef&&<img alt="filmstrip" style={{width:'100%',marginTop:8,borderRadius:8}} src={mediaUrl(source.id,'filmstrip')}/>}
          <p className="sub" style={{marginTop:8}}>{source.durationFrames?`${source.durationFrames} frames · ${(source.durationFrames*tb.fpsDenominator/tb.fpsNumerator).toFixed(1)} s`:'Sin duración'}{source.waveformRef&&<> · <a href={mediaUrl(source.id,'waveform')} target="_blank" rel="noopener">waveform</a></>}</p>
          <button disabled={busy!==''||!sourceId} onClick={transcribe} style={{marginTop:8}}>{busy==='transcribe'?'Transcribiendo…':'Transcribir (whisper local)'}</button>
        </>}
      </section>

      <section className="glass card">
        <h3>2 · Transcript → pieza</h3>
        {!transcript&&<p className="sub">{sourceId?'Sin transcript: transcribe el máster primero.':'Elige un máster.'}</p>}
        {transcript&&<>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
            <label style={{fontSize:12}}><input type="checkbox" checked={anchorMode} onChange={e=>setAnchorMode(e.target.checked)}/> modo anclas (inicio+fin)</label>
          </div>
          {anchorMode
            ?<div style={{display:'flex',flexDirection:'column',gap:6}}>
              <input placeholder="Inicio: «cuando comenzamos a…»" value={opening} onChange={e=>setOpening(e.target.value)}/>
              <input placeholder="Fin: «esa fue la diferencia»" value={closing} onChange={e=>setClosing(e.target.value)}/>
             </div>
            :<input style={{width:'100%'}} placeholder="Frase del transcript para crear la pieza…" value={queryText} onChange={e=>setQueryText(e.target.value)}/>}
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button disabled={busy!==''} onClick={align}>Alinear (preview)</button>
            <button disabled={busy!==''||!project} onClick={()=>createFromText()}>Crear pieza</button>
          </div>
          {candidates&&<div style={{marginTop:10}}>
            <p className="sub">{candidates.length} candidate(s) — elige una para crear la pieza:</p>
            {candidates.map((c,i)=><div key={i} className="commit" style={{display:'flex',alignItems:'center'}}>
              <span style={{flex:1}}>{c.matchedText.slice(0,80)} <b>· {c.strategy} · {(c.confidence*100).toFixed(0)}%</b></span>
              <button onClick={()=>void createFromText(i)}>Usar</button>
            </div>)}
          </div>}
          <div style={{marginTop:12,maxHeight:220,overflow:'auto'}}>
            {transcript.segments.map((seg,i)=><p key={i} style={{cursor:'pointer',fontSize:13.5,margin:'4px 0'}}
              onClick={()=>{if(videoRef.current)videoRef.current.currentTime=seg.start;}}>
              <b>[{seg.start.toFixed(1)}]</b> {seg.text}</p>)}
          </div>
        </>}
      </section>
    </div>

    <div className="grid two" style={{marginTop:16}}>
      <section className="glass card">
        <h3>3 · Piezas ({pieces.length})</h3>
        {!pieces.length&&<p className="sub">Sin piezas todavía.</p>}
        {pieces.map(p=><div key={p.id} className="commit" style={{cursor:'pointer',background:selected?.id===p.id?'rgba(41,151,255,.12)':'transparent'}}
          onClick={()=>setSelected(p)}>
          <span style={{flex:1}}><b>{p.id}</b> {p.label}</span>
          <span className="date">{(toSec(p.sourceRange.endFrame-p.sourceRange.startFrame,tb)).toFixed(1)}s · {p.status}</span>
        </div>)}
      </section>
      <section className="glass card">
        <h3>4 · Inspector {selected?`· ${selected.id}`:''}</h3>
        {!selected&&<p className="sub">Selecciona una pieza.</p>}
        {selected&&<>
          <label style={{fontSize:12}}>Label</label>
          <input style={{width:'100%'}} value={selected.label} onChange={e=>setSelected({...selected,label:e.target.value})}/>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <div style={{flex:1}}><label style={{fontSize:12}}>Start frame</label>
              <input style={{width:'100%'}} type="number" min={0} value={selected.sourceRange.startFrame}
                onChange={e=>setSelected({...selected,sourceRange:{...selected.sourceRange,startFrame:Number(e.target.value)}})}/>
              <p className="sub">{fmtTimecode(selected.sourceRange.startFrame,tb)}</p></div>
            <div style={{flex:1}}><label style={{fontSize:12}}>End frame (out-exclusivo)</label>
              <input style={{width:'100%'}} type="number" min={1} value={selected.sourceRange.endFrame}
                onChange={e=>setSelected({...selected,sourceRange:{...selected.sourceRange,endFrame:Number(e.target.value)}})}/>
              <p className="sub">{fmtTimecode(selected.sourceRange.endFrame,tb)}</p></div>
          </div>
          <p className="sub" style={{marginTop:4}}>Duración: {(toSec(selected.sourceRange.endFrame-selected.sourceRange.startFrame,tb)).toFixed(2)} s ·
            provenance: {selected.provenance.createdFrom} · {selected.eventRefs.length} Visual Events</p>
          <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
            <button disabled={busy!==''} onClick={savePiece}>Guardar</button>
            <button disabled={busy!==''||!project} onClick={exportPiece}>{busy==='export'?'Exportando…':'Exportar MP4'}</button>
            <button disabled={busy!==''} onClick={deletePiece} style={{color:'#ff453a'}}>Eliminar</button>
          </div>
          {selected.outputRefs.length>0&&<p className="sub" style={{marginTop:8}}>
            Outputs: {selected.outputRefs.length} · último: {selected.outputRefs[selected.outputRefs.length-1].split('/').pop()}
            {' · '}<a href={mediaUrl(selected.sourceRef,'proxy')} target="_blank" rel="noopener">preview del máster</a></p>}
        </>}
      </section>
    </div>
  </div>;
}

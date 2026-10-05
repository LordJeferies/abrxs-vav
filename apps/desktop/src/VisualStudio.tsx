import { useEffect, useState } from 'react';
import { request, download, type Workspace } from './workspace';

/* ── Catálogos (espejo de @abraxas/prompts para el wizard con referencias visuales) ── */
type Entry = { id: string; label: string; ref?: string };
const CAMERA: Entry[] = [
  { id: '', label: '— sin definir —' },
  { id: 'arri-alexa-35', label: 'ARRI Alexa 35', ref: 'Cine premium' },
  { id: 'red-komodo', label: 'RED Komodo', ref: 'Acción nítida' },
  { id: 'sony-venice', label: 'Sony Venice 2', ref: 'Drama' },
  { id: 'imax-65', label: 'IMAX 65mm', ref: 'Épico' },
  { id: 'bolex-16', label: 'Bolex 16mm', ref: 'Analógico' },
  { id: 'iphone-cine', label: 'iPhone cine', ref: 'UGC vertical' },
  { id: 'drone-fpv', label: 'Drone FPV', ref: 'Aéreo dinámico' }
];
const LENS: Entry[] = [
  { id: '', label: '— auto (según intensidad) —' },
  { id: '35mm-prime', label: '35mm prime' }, { id: '50mm-prime', label: '50mm prime' },
  { id: '85mm-prime', label: '85mm bokeh' }, { id: 'anamorphic', label: 'Anamórfica 2x' },
  { id: 'macro', label: 'Macro' }, { id: 'wide-18', label: 'Gran angular 18mm' }
];
const LIGHT: Entry[] = [
  { id: '', label: '— auto —' },
  { id: 'three-point', label: '3 puntos clásico' }, { id: 'golden-hour', label: 'Golden hour' },
  { id: 'practicals', label: 'Neones / prácticas' }, { id: 'low-key', label: 'Low key dramático' },
  { id: 'overcast', label: 'Nublado suave' }, { id: 'hard-noon', label: 'Mediodía duro' }
];
const STOCK: Entry[] = [
  { id: '', label: '— auto —' },
  { id: 'kodak-5219', label: 'Kodak Vision3 500T' }, { id: 'portra-400', label: 'Portra 400' },
  { id: 'cinestill-800', label: 'CineStill 800T' }, { id: 'digital-clean', label: 'Digital limpio' }
];
const ATMO: Entry[] = [
  { id: '', label: '— auto —' },
  { id: 'haze', label: 'Bruma' }, { id: 'rain', label: 'Lluvia' },
  { id: 'dust', label: 'Polvo en el aire' }, { id: 'fog', label: 'Niebla densa' }, { id: 'none', label: 'Limpio' }
];
const GRADE: Entry[] = [
  { id: '', label: '— auto —' },
  { id: 'teal-orange', label: 'Teal & Orange' }, { id: 'bleach', label: 'Bleach bypass' },
  { id: 'warm-vintage', label: 'Vintage cálido' }, { id: 'neo-noir', label: 'Neo-noir' }, { id: 'natural', label: 'Natural' }
];
const COMP: Entry[] = [
  { id: '', label: '— sin definir —' },
  { id: 'thirds', label: 'Tercios' }, { id: 'centered', label: 'Centrado' },
  { id: 'leading-lines', label: 'Líneas guía' }, { id: 'frame-in-frame', label: 'Marco en marco' }
];
const MOTION: Entry[] = [
  { id: '', label: '— sin motion —' },
  { id: 'STATIC', label: 'Static' }, { id: 'ZOOM_IN', label: 'Push in' }, { id: 'ZOOM_OUT', label: 'Pull back' },
  { id: 'PAN_LEFT', label: 'Pan izquierda' }, { id: 'PAN_RIGHT', label: 'Pan derecha' },
  { id: 'PAN_UP', label: 'Tilt arriba' }, { id: 'PAN_DOWN', label: 'Tilt abajo' },
  { id: 'ZOOM_IN_PAN', label: 'Push + deriva' }, { id: 'ZOOM_OUT_PAN', label: 'Pull + deriva' },
  { id: 'SLOW_DRIFT', label: 'Slow drift' }
];
const STRATEGIES = [
  { id: 'demo', label: 'Demo (gratis, pipeline real)' },
  { id: 'higgsfield', label: 'Higgsfield (HF_API_KEY en el servicio)' },
  { id: 'nvidia', label: 'NVIDIA NIM (NVIDIA_API_KEY)' }
] as const;

interface EnhanceResult { prompt: string; negative: string; appliedLayers: string[]; subject: string; }
interface ProviderRow { id: string; capability: string; ready: boolean; note: string; }

export function VisualStudio({ workspace }: { workspace: Workspace }) {
  const w = workspace;
  const [subject, setSubject] = useState('');
  const [intensity, setIntensity] = useState<1 | 2 | 3>(2);
  const [opts, setOpts] = useState<Record<string, string>>({});
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [strategy, setStrategy] = useState<string>('demo');
  const [aspect, setAspect] = useState('9:16');
  const [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  useEffect(() => { void request<{ providers: ProviderRow[] }>('providers').then(r => setProviders(r.providers)).catch(() => {}); }, []);
  const set = (k: string, v: string) => setOpts(o => ({ ...o, [k]: v }));
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); setNote(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado.'); } finally { setBusy(false); } };

  const enhance = () => run(async () => setResult(await request<EnhanceResult>('studio/enhance', 'POST', { subject, intensity, options: opts })));

  const generate = () => run(async () => {
    if (!w.project) throw new Error('Abre o crea un proyecto en el Hub primero.');
    const r = await request<{ recipe: { prompt: string; eventId: string } }>('studio/generate', 'POST',
      { projectId: w.project.id, revision: w.project.revision, subject, intensity, options: opts, strategy, aspectRatio: aspect, label: `Visual Studio · ${subject.slice(0, 40)}` });
    await w.reload();
    setNote(`Evento ${r.recipe.eventId} creado en el grafo y job encolado (provider ${strategy}). Síguelo en Activity.`);
  });

  const handoff = () => run(async () => {
    const r = await request<{ package: { expectedFilename: string }; txt: string }>('studio/handoff', 'POST',
      { targetRef: 'standalone', subject, intensity, options: opts, providerHint: 'generic', aspectRatio: aspect });
    download(r.package.expectedFilename.replace(/\.\w+$/, '.txt'), r.txt, 'text/plain');
    await navigator.clipboard?.writeText(r.txt).catch(() => {});
    setNote(`Handoff ${r.package.expectedFilename} descargado y copiado al portapapeles. Pégalo en tu IA y trae el resultado con ese nombre.`);
  });

  const testProvider = (id: string) => run(async () => {
    const r = await request<{ ok: boolean; http?: number; ms: number; detail: string }>('providers/test', 'POST', { provider: id });
    setNote(`${id}: ${r.ok ? '✓' : '✗'} ${r.http ? `HTTP ${r.http} · ` : ''}${r.ms}ms — ${r.detail}`);
  });

  return <div className="content">
    <section className="hero compact glass"><div>
      <p className="eyebrow">VISUAL STUDIO · PROMPT ALCHEMY</p>
      <h2>Crea visuales de calidad de cine — con cualquier IA</h2>
      <p>El sujeto que escribas queda intacto; el motor añade las capas de cine
      (cámara, lente, luz, stock, atmósfera, color, motion del canon R6). Genera en la app
      si tienes API conectada, o exporta el handoff para tu IA favorita.</p>
    </div></section>

    <div className="grid two">
      <section className="glass card">
        <h3>1 · Sujeto (sagrado — nunca se reescribe)</h3>
        <textarea value={subject} onChange={e => setSubject(e.target.value)} rows={3}
          placeholder="Ej.: a dentist walking into an empty clinic at night"
          style={{ width: '100%', minHeight: 72, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, color: 'inherit', fontSize: 14 }} />
        <h3 style={{ marginTop: 16 }}>2 · Intensidad del look</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {([1, 2, 3] as const).map(i => <button key={i} className={intensity === i ? 'active' : ''} onClick={() => setIntensity(i)}>{i === 1 ? 'Discreta' : i === 2 ? 'Cinemática' : 'De cine profesional'}</button>)}
        </div>
        <h3 style={{ marginTop: 16 }}>3 · Dirección de fotografía (wizard)</h3>
        <div className="grid two" style={{ gap: 8 }}>
          {([['camera', 'Cámara', CAMERA], ['lens', 'Lente', LENS], ['light', 'Luz', LIGHT], ['stock', 'Stock fílmico', STOCK], ['atmosphere', 'Atmósfera', ATMO], ['grade', 'Color', GRADE], ['composition', 'Composición', COMP], ['motion', 'Motion (canon R6)', MOTION]] as const).map(([key, label, list]) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
              <select value={opts[key] ?? ''} onChange={e => set(key, e.target.value)}
                style={{ height: 32, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'inherit', padding: '0 8px' }}>
                {list.map(o => <option key={o.id} value={o.id}>{o.label}{o.ref ? ` · ${o.ref}` : ''}</option>)}
              </select>
            </label>
          ))}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>Formato</span>
            <select value={aspect} onChange={e => setAspect(e.target.value)} style={{ height: 32, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'inherit', padding: '0 8px' }}>
              <option>9:16</option><option>16:9</option><option>1:1</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="primary" disabled={busy || !subject.trim()} onClick={enhance}>✦ Mejorar prompt</button>
          <button disabled={busy || !subject.trim()} onClick={generate}>Generar en la app ({strategy})</button>
          <button disabled={busy || !subject.trim()} onClick={handoff}>Exportar handoff (.txt)</button>
        </div>
        {note && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ok, #34c77b)' }}>{note}</p>}
        {error && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--danger, #e5534b)' }} role="alert">{error}</p>}
      </section>

      <section className="glass card">
        <h3>Resultado (antes/después verificable)</h3>
        {result ? <>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Capas añadidas: {result.appliedLayers.join(' · ') || 'ninguna (intensidad sin capas)'}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 260, overflow: 'auto' }}>{result.prompt}</pre>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>NEGATIVE: {result.negative}</p>
          <button onClick={() => { void navigator.clipboard?.writeText(`${result.prompt}\n\nNEGATIVE: ${result.negative}`); setNote('Prompt completo copiado.'); }}>Copiar prompt + negative</button>
        </> : <p className="sub">Escribe un sujeto y pulsa "Mejorar prompt" — el resultado siempre
        comienza con TU texto, verbatim, y muestra qué capas se añadieron.</p>}
        <h3 style={{ marginTop: 20 }}>Providers de generación</h3>
        <table>
          <thead><tr><th>Provider</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {providers.map(p => <tr key={p.id}>
              <td>{p.id}<br /><small style={{ color: 'var(--muted)' }}>{STRATEGIES.find(s => s.id === p.id)?.label ?? p.capability}</small></td>
              <td>{p.ready ? <span style={{ color: '#34c77b' }}>✓ listo</span> : <span style={{ color: '#e8b341' }}>sin clave</span>}</td>
              <td><button onClick={() => testProvider(p.id)}>Probar</button></td>
            </tr>)}
          </tbody>
        </table>
        <p className="sub" style={{ marginTop: 10 }}>Las claves viven SOLO en el entorno del servicio
        (HF_API_KEY = KEY_ID:SECRET de un solo uso, NVIDIA_API_KEY = nvapi-…). "Probar" hace un
        Test Connection real con HTTP y latencia. Sin clave, el provider Demo ejecuta el pipeline
        completo simulado.</p>
      </section>
    </div>
  </div>;
}

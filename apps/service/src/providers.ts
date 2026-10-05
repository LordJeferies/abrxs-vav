/* Providers de generación — capa 2 de la integración Higgsfield
   (docs/HIGGSFIELD_INTEGRATION.md). Todos por capability; el servicio es el único
   que ve las keys (jamás el cliente). Sin key → DemoProvider con pipeline idéntico. */
import { setTimeout as wait } from 'node:timers/promises';

export interface GenerateRequest {
  workflow: string;                 // "std" | "pro-4k" | "soul-id" | workflow de HF
  prompt: string; negative: string;
  params: Record<string, unknown>;  // aspectRatio, durationSec, seed…
}
export interface GenerateJob {
  providerId: string; externalId?: string; statusUrl?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  outputs: Array<{ filename: string; url?: string; note?: string }>;
  error?: string;
}
export interface GenerationProvider {
  id: string; capability: 'image.generate' | 'video.generate' | 'demo';
  submit(req: GenerateRequest, signal: AbortSignal): Promise<GenerateJob>;
  poll(job: GenerateJob, signal: AbortSignal): Promise<GenerateJob>;
}
export interface ProviderStatus { id: string; capability: string; ready: boolean; note: string; }

/* ── Demo: pipeline idéntico, sin coste, para verificar de punta a punta ── */
export const demoProvider: GenerationProvider = {
  id: 'demo', capability: 'demo',
  async submit(req, signal) {
    await wait(300, undefined, { signal });
    return { providerId: 'demo', externalId: `demo_${Date.now().toString(36)}`, status: 'running',
      outputs: [], note: req.workflow };
  },
  async poll(job, signal) {
    await wait(500, undefined, { signal });
    const filename = `${job.externalId ?? 'demo'}.png`;
    return { ...job, status: 'completed',
      outputs: [{ filename, note: 'Demo: asset simulado. Conecta una API (Higgsfield/NVIDIA) para resultados reales.' }] };
  }
};

/* ── Higgsfield: POST → request_id/status_url → poll (docs §2) ── */
const HF_BASE = process.env.HF_BASE_URL || 'https://api.higgsfield.ai/v1';
function hfHeaders(): HeadersInit {
  const key = process.env.HF_API_KEY || ''; // "KEY_ID:KEY_SECRET" — base64 por el caller o aquí:
  const encoded = key.includes(':') ? Buffer.from(key).toString('base64') : key;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${encoded}` };
}
export const higgsfieldProvider: GenerationProvider = {
  id: 'higgsfield', capability: 'video.generate',
  async submit(req, signal) {
    const res = await fetch(`${HF_BASE}/${encodeURIComponent(req.workflow)}`, {
      method: 'POST', headers: hfHeaders(), signal,
      body: JSON.stringify({ prompt: req.prompt, negative_prompt: req.negative, ...req.params })
    }).catch(e => { throw new Error(`Higgsfield no alcanzable: ${e.message}`); });
    if (!res.ok) throw new Error(`Higgsfield HTTP ${res.status} — revisa HF_API_KEY (formato KEY_ID:KEY_SECRET) y el workflow "${req.workflow}".`);
    const out = await res.json() as { request_id?: string; status_url?: string; id?: string };
    return { providerId: 'higgsfield', externalId: out.request_id ?? out.id, statusUrl: out.status_url, status: 'running', outputs: [] };
  },
  async poll(job, signal) {
    if (!job.statusUrl) return { ...job, status: 'failed', error: 'Sin status_url del submit.' };
    const res = await fetch(job.statusUrl, { headers: hfHeaders(), signal });
    if (!res.ok) return { ...job, status: 'failed', error: `Poll HTTP ${res.status}` };
    const out = await res.json() as { status?: string; outputs?: Array<{ url?: string; filename?: string }>; error?: string };
    const status = out.status === 'completed' ? 'completed' : out.status === 'failed' ? 'failed' : 'running';
    return { ...job, status, error: out.error,
      outputs: (out.outputs ?? []).map((o, i) => ({ filename: o.filename ?? `${job.externalId}_${i}.mp4`, url: o.url })) };
  }
};

/* ── NVIDIA NIM (OpenAI-compatible; imágenes confirmadas, video no) ── */
export const nvidiaProvider: GenerationProvider = {
  id: 'nvidia', capability: 'image.generate',
  async submit(req, signal) {
    if (!process.env.NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY no configurada (nvapi-…).');
    const res = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
      body: JSON.stringify({ model: process.env.NVIDIA_IMAGE_MODEL || 'flux.1-schnell', prompt: req.prompt, ...req.params })
    });
    if (!res.ok) throw new Error(`NVIDIA HTTP ${res.status}`);
    const out = await res.json() as { data?: Array<{ b64_json?: string; url?: string }> };
    return { providerId: 'nvidia', externalId: `nv_${Date.now().toString(36)}`, status: 'completed',
      outputs: (out.data ?? []).map((d, i) => ({ filename: `nv_${i}.png`, url: d.url, note: d.b64_json ? 'b64 (descargar al Asset Store)' : undefined })) };
  },
  async poll(job) { return job; }
};

export const providers: Record<string, GenerationProvider> = {
  demo: demoProvider, higgsfield: higgsfieldProvider, nvidia: nvidiaProvider
};

export function providerStatus(): ProviderStatus[] {
  return [
    { id: 'demo', capability: 'demo', ready: true, note: 'Pipeline simulado, siempre disponible.' },
    { id: 'higgsfield', capability: 'video.generate', ready: !!process.env.HF_API_KEY,
      note: process.env.HF_API_KEY ? 'HF_API_KEY configurada (KEY_ID:KEY_SECRET).' : 'Configura HF_API_KEY en el entorno del servicio.' },
    { id: 'nvidia', capability: 'image.generate', ready: !!process.env.NVIDIA_API_KEY,
      note: process.env.NVIDIA_API_KEY ? 'NVIDIA_API_KEY configurada.' : 'Configura NVIDIA_API_KEY (nvapi-…).' }
  ];
}

/** Test Connection real: mide HTTP code + latencia contra el endpoint de estilos/auth. */
export async function testConnection(providerId: string): Promise<{ ok: boolean; http?: number; ms: number; detail: string }> {
  const started = Date.now();
  if (providerId === 'demo') return { ok: true, ms: 0, detail: 'Provider demo: siempre listo.' };
  if (providerId === 'higgsfield') {
    if (!process.env.HF_API_KEY) return { ok: false, ms: 0, detail: 'HF_API_KEY ausente. Pide la clave de un solo uso y expórtala al entorno del servicio.' };
    try {
      const res = await fetch(`${HF_BASE}/text2image/soul-styles`, { headers: hfHeaders(), signal: AbortSignal.timeout(8000) });
      return { ok: res.ok, http: res.status, ms: Date.now() - started, detail: res.ok ? 'soul-styles OK — clave válida.' : 'Clave rechazada o endpoint cambiado.' };
    } catch (e) { return { ok: false, ms: Date.now() - started, detail: `Red/CORS: ${e instanceof Error ? e.message : e}` }; }
  }
  if (providerId === 'nvidia') {
    if (!process.env.NVIDIA_API_KEY) return { ok: false, ms: 0, detail: 'NVIDIA_API_KEY ausente (nvapi-…).' };
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/models', { headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` }, signal: AbortSignal.timeout(8000) });
      return { ok: res.ok, http: res.status, ms: Date.now() - started, detail: res.ok ? 'Catálogo NIM accesible.' : 'Clave rechazada.' };
    } catch (e) { return { ok: false, ms: Date.now() - started, detail: `Red: ${e instanceof Error ? e.message : e}` }; }
  }
  return { ok: false, ms: 0, detail: `Provider desconocido: ${providerId}` };
}

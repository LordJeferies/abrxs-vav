/* ═══ CLIENTS — perfiles de cliente + resolución de configuración + AI Package ═══
   Del análisis modular de Dresser (docs/DRESSER_RUNTIME.md §2-4, §11-16):
   · Cadena System → Client → Project → Video → Event (gana la más específica).
   · Import TXT con hechos/confianza → draft → diff → apply (la IA nunca aplica en silencio).
   · AI Package System genérico: exporta paquete para IA externa e importa la respuesta
     validada (formato ABRXS CLIENT PROFILE v1 legible).
   · Tokens de marca ($colors.accent) resueltos al leer la config. */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { clientProfileSchema, resolvedEntrySchema, type ClientProfile, type ResolvedConfig } from '@abraxas/contracts';

export interface Fact { key: string; value: unknown; confidence: 'high' | 'medium'; evidence: string; }
export interface Draft { clientId?: string; facts: Fact[]; raw: string; }

export class ClientStore {
  constructor(private dir: string) {}
  private path(id: string) { return join(this.dir, id, 'client.json'); }
  async init() { await mkdir(this.dir, { recursive: true, mode: 0o700 }); }
  async list(): Promise<ClientProfile[]> {
    const ids = (await readdir(this.dir).catch(() => [])).filter(f => !f.startsWith('.'));
    const out: ClientProfile[] = [];
    for (const id of ids) { const c = await this.get(id).catch(() => null); if (c) out.push(c); }
    return out;
  }
  async get(id: string): Promise<ClientProfile | null> {
    try { return clientProfileSchema.parse(JSON.parse(await readFile(this.path(id), 'utf8'))); }
    catch { return null; }
  }
  async put(profile: ClientProfile): Promise<ClientProfile> {
    const now = new Date().toISOString();
    const next = clientProfileSchema.parse({ ...profile, clientId: profile.clientId || profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), createdAt: profile.createdAt ?? now, updatedAt: now });
    await mkdir(join(this.dir, next.clientId), { recursive: true, mode: 0o700 });
    await writeFile(this.path(next.clientId), JSON.stringify(next, null, 2));
    return next;
  }
}

/* ── Parser TXT: separa hechos de dudas con confidence (chat §12) ── */
export function parseClientTxt(raw: string, fallbackId?: string): Draft {
  const facts: Fact[] = [];
  const name = raw.match(/^\s*cliente\s*:\s*(.+)$/im)?.[1]?.trim();
  if (name) facts.push({ key: 'name', value: name, confidence: 'high', evidence: 'línea "Cliente:"' });
  const colors = [...raw.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => `#${m[1].toUpperCase()}`);
  if (colors.length) {
    facts.push({ key: 'brand.colors.primary', value: colors[0], confidence: 'high', evidence: `hex ${colors[0]}` });
    if (colors[1]) facts.push({ key: 'brand.colors.accent', value: colors[1], confidence: 'high', evidence: `hex ${colors[1]}` });
  }
  const font = raw.match(/fuentes?\s+principal(?:es)?[^.\n]*?([A-Z][A-Za-z ]{2,20})/i)?.[1]?.trim()
    ?? raw.match(/fuente\s*:?\s*([A-Z][A-Za-z ]{2,20})/i)?.[1]?.trim();
  if (font) facts.push({ key: 'brand.fonts.primary', value: `font.${font.toLowerCase().replace(/\s+/g, '-')}`, confidence: 'high', evidence: `mención de fuente "${font}"` });
  const density = raw.match(/\b(B-roll|b-rolls?)[^.\n]*?(documental|documentary|cinem[aá]tico|realista)/i)?.[1];
  if (density) facts.push({ key: 'broll.preset', value: 'documentary_clean', confidence: 'medium', evidence: 'estilo documental/realista' });
  for (const line of raw.split(/\n+/).map(l => l.trim()).filter(l => /^(no |evita|avoid|jamás)/i.test(l))) {
    facts.push({ key: 'negativeRules+', value: line.replace(/^no\s+usar\s+/i, ''), confidence: 'high', evidence: 'regla negativa explícita' });
  }
  for (const line of raw.split(/\n+/).map(l => l.trim()).filter(l => /^(los |las |el |la )?\s*(subt[ií]tulos|captions?|palabras clave)\b[^.:]*\b(dorad[oa]|limpi[oa]|destacad[oa])/i.test(l))) {
    facts.push({ key: 'captions.highlightColor', value: '$colors.accent', confidence: 'medium', evidence: 'captions con palabras destacadas' });
    break;
  }
  const xr = raw.match(/X-?rolls?[^.\n]*?(editorial|datos|infograf)/i);
  if (xr) facts.push({ key: 'xroll.density', value: 'low', confidence: 'medium', evidence: 'X-rolls editoriales → densidad baja' });
  if (fallbackId) facts.push({ key: 'clientId', value: fallbackId, confidence: 'high', evidence: 'nombre dado por el usuario' });
  return { clientId: fallbackId ?? (typeof name === 'string' ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined), facts, raw };
}

/** Aplica un draft sobre un perfil (existente o nuevo). Sin IA en el camino: reglas deterministas. */
export function applyDraft(base: ClientProfile | null, draft: Draft): ClientProfile {
  const p: ClientProfile = base ? structuredClone(base) : clientProfileSchema.parse({
    schemaVersion: 'abrxs.client-profile.v1', clientId: draft.clientId ?? 'cliente', name: 'Cliente'
  });
  for (const f of draft.facts) {
    if (f.key === 'negativeRules+') { if (!p.negativeRules.includes(String(f.value))) p.negativeRules.push(String(f.value)); }
    else if (f.key === 'clientId') p.clientId = String(f.value);
    else if (f.key === 'name') p.name = String(f.value);
    else if (f.key.startsWith('brand.colors.')) p.brand.colors[f.key.split('.').pop()!] = String(f.value);
    else if (f.key.startsWith('brand.fonts.')) p.brand.fonts[f.key.split('.').pop()!] = String(f.value);
    else if (f.key === 'broll.preset') p.broll.preset = String(f.value);
    else if (f.key === 'xroll.density') p.xroll.density = String(f.value) as ClientProfile['xroll']['density'];
    else if (f.key === 'captions.highlightColor') p.captions.highlightColor = String(f.value);
  }
  return p;
}

/* ── AI Package System (chat §13): exporta 8 archivos para IA externa ── */
export function exportAIPackage(profile: ClientProfile | null, draft: Draft | null, catalogs: Record<string, unknown>): Record<string, string> {
  const fields = profile ? Object.entries(profile).filter(([k]) => !['schemaVersion', 'createdAt', 'updatedAt'].includes(k)) : [];
  return {
    '01_RAW_CLIENT_INFO.txt': draft?.raw ?? '(sin TXT de origen)',
    '02_DRESSER_FIELDS.txt': fields.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join('\n') || '(perfil vacío)',
    '03_AVAILABLE_PRESETS.txt': JSON.stringify(catalogs.presets ?? {}, null, 2),
    '04_AVAILABLE_FONTS.txt': JSON.stringify(catalogs.fonts ?? ['font.montserrat', 'font.inter', 'font.bebas-neue', 'font.client.brand-primary'], null, 2),
    '05_AVAILABLE_VISUAL_TYPES.txt': JSON.stringify(catalogs.visualTypes ?? {}, null, 2),
    '06_RULES.txt': ['Cada campo puede tomar valores de los catálogos.', 'Las negativeRules se agregan como frases cortas.', 'No inventes presets fuera de los catálogos.', 'Devuelve EXACTAMENTE el formato ABRXS CLIENT PROFILE v1.'].join('\n'),
    '07_PROMPT.txt': 'Completa el perfil del cliente en formato ABRXS CLIENT PROFILE v1 usando 01-06. Devuelve solo el perfil.',
    '08_RESPONSE_SCHEMA.json': JSON.stringify({ format: 'ABRXS CLIENT PROFILE v1', sections: ['CLIENT', 'BRAND', 'FONTS', 'CAPTIONS', 'BROLL', 'XROLL', 'SFX', 'NEGATIVE_RULES'] }, null, 2),
  };
}

/** Import de la respuesta IA en formato ABRXS CLIENT PROFILE v1 (TXT legible, chat §15). */
export function importAIResponse(txt: string): Draft {
  const facts: Fact[] = [];
  const section = (name: string) => {
    const m = txt.match(new RegExp(`\\[${name}\\]\\s*([^\\[]*)`, 'i'));
    return m?.[1] ?? '';
  };
  const kv = (s: string) => s.split('\n').map(l => l.trim()).filter(l => /\s*=\s*/.test(l)).map(l => l.split('=').map(x => x.trim()));
  const name = kv(section('CLIENT')).find(([k]) => k === 'name')?.[1];
  if (name) facts.push({ key: 'name', value: name, confidence: 'high', evidence: '[CLIENT]' });
  for (const [k, v] of kv(section('BRAND'))) if (/color/i.test(k)) facts.push({ key: `brand.colors.${k.replace('_color', '').toLowerCase()}`, value: v, confidence: 'high', evidence: '[BRAND]' });
  for (const [k, v] of kv(section('FONTS'))) facts.push({ key: `brand.fonts.${k.toLowerCase()}`, value: v.startsWith('font.') ? v : `font.${v.toLowerCase()}`, confidence: 'high', evidence: '[FONTS]' });
  for (const [k, v] of kv(section('BROLL'))) if (k === 'preset') facts.push({ key: 'broll.preset', value: v, confidence: 'medium', evidence: '[BROLL]' });
  for (const [k, v] of kv(section('XROLL'))) if (k === 'density') facts.push({ key: 'xroll.density', value: v, confidence: 'medium', evidence: '[XROLL]' });
  for (const line of section('NEGATIVE_RULES').split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean))
    facts.push({ key: 'negativeRules+', value: line, confidence: 'high', evidence: '[NEGATIVE_RULES]' });
  return { facts, raw: txt };
}

/** Diff legible para "Apply Changes" (chat §35): nunca aplicar en silencio. */
export function diffProfile(before: ClientProfile | null, after: ClientProfile): Array<{ field: string; from: unknown; to: unknown }> {
  const flat = (o: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
    const acc: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(acc, flat(v as Record<string, unknown>, `${prefix}${k}.`));
      else acc[`${prefix}${k}`] = v;
    }
    return acc;
  };
  const b = before ? flat(before as unknown as Record<string, unknown>) : {};
  const a = flat(after as unknown as Record<string, unknown>);
  const out: Array<{ field: string; from: unknown; to: unknown }> = [];
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (['updatedAt', 'createdAt', 'clientId'].includes(k)) continue;
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) out.push({ field: k, from: b[k] ?? '(vacío)', to: a[k] });
  }
  return out;
}

/* ── Resolución de configuración: SYSTEM → CLIENT → PROJECT → VIDEO → EVENT (chat §3, §33) ── */
export function resolveConfig(opts: { client?: ClientProfile | null; projectOverrides?: Record<string, unknown> }): ResolvedConfig {
  const entries: ResolvedConfig['entries'] = [];
  const set = (key: string, value: unknown, source: ResolvedConfig['entries'][number]['source']) => {
    const i = entries.findIndex(e => e.key === key);
    if (i >= 0) entries[i] = resolvedEntrySchema.parse({ key, value, source });
    else entries.push(resolvedEntrySchema.parse({ key, value, source }));
  };
  // SYSTEM defaults
  set('captions.preset', 'caption.amanda.vertical.v1', 'system');
  set('broll.preset', 'documentary_clean', 'system');
  set('broll.density', 'medium', 'system');
  set('broll.sourcePriority', ['client', 'frame_grab', 'stock', 'ai_image', 'ai_video'], 'system');
  set('xroll.density', 'low', 'system');
  set('sfx.preset', 'subtle', 'system');
  // CLIENT
  const c = opts.client;
  if (c) {
    if (c.captions.preset) set('captions.preset', c.captions.preset, 'client');
    if (Object.keys(c.brand.colors).length) set('brand.colors', c.brand.colors, 'client');
    if (Object.keys(c.brand.fonts).length) set('brand.fonts', c.brand.fonts, 'client');
    set('broll.density', c.broll.density, 'client');
    set('broll.sourcePriority', c.broll.sourcePriority, 'client');
    set('xroll.density', c.xroll.density, 'client');
    set('captions.highlightColor', c.captions.highlightColor, 'client');
    set('negativeRules', c.negativeRules, 'client');
    set('sfx.preset', c.sfx.preset, 'client');
    // resolución de tokens $colors.* → valores reales
    for (const e of entries) {
      if (typeof e.value === 'string' && e.value.startsWith('$colors.')) {
        const token = e.value.slice('$colors.'.length);
        const real = c.brand.colors[token];
        if (real) set(e.key, real, 'client');
      }
    }
  }
  // PROJECT overrides
  for (const [k, v] of Object.entries(opts.projectOverrides ?? {})) set(k, v, 'project');
  return { clientId: c?.clientId ?? null, entries };
}

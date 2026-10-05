/* ═══ ABRXSVAV PROMPT STUDIO — el cerebro cinematográfico ═══
   Reglas del motor (docs/HIGGSFIELD_INTEGRATION.md §3):
   1. El sujeto es sagrado: nunca se reescribe sujeto, acción ni encuadre del usuario.
   2. Las capas de cine se AÑADEN por intensidad; nunca compiten con el sujeto.
   3. Motion presets del canon R6 mapeados a lenguaje de cámara.
   4. Negative siempre incluido.
   5. Toda receta es exportable como HandoffPackage (contracts v2.3) para CUALQUIER IA. */

import type { HandoffPackage } from '@abraxas/contracts';

/* ── Catálogos de cine (cada opción: id + etiqueta + frase técnica lista para prompt) ── */

export interface CatalogEntry { id: string; label: string; phrase: string; ref?: string; }

export const CAMERAS: CatalogEntry[] = [
  { id: 'arri-alexa-35', label: 'ARRI Alexa 35', phrase: 'shot on ARRI Alexa 35, organic digital film texture', ref: '🎵 Cine premium' },
  { id: 'red-komodo', label: 'RED Komodo', phrase: 'RED Komodo 6K, crisp high-detail digital capture', ref: '🎵 Acción/nítido' },
  { id: 'sony-venice', label: 'Sony Venice 2', phrase: 'Sony Venice 2, rich cinematic color science', ref: '🎵 Drama' },
  { id: 'imax-65', label: 'IMAX 65mm', phrase: 'IMAX 65mm large format, immense scale and clarity', ref: '🎵 Épico' },
  { id: 'bolex-16', label: 'Bolex 16mm', phrase: 'vintage Bolex 16mm, grain and gate weave', ref: '🎵 Documental analógico' },
  { id: 'iphone-cine', label: 'iPhone (modo cine)', phrase: 'iPhone cinematic mode, natural handheld feel', ref: '🎵 UGC/vertical' },
  { id: 'drone-fpv', label: 'Drone FPV', phrase: 'FPV drone shot, fast immersive aerial movement', ref: '🎵 Dinámico aéreo' },
];

export const LENSES: CatalogEntry[] = [
  { id: '35mm-prime', label: '35mm prime', phrase: '35mm prime lens, natural field of view' },
  { id: '50mm-prime', label: '50mm prime', phrase: '50mm prime lens, human perspective, shallow depth of field' },
  { id: '85mm-prime', label: '85mm prime', phrase: '85mm portrait lens, creamy bokeh, compressed background' },
  { id: 'anamorphic', label: 'Anamórfica 2x', phrase: '2x anamorphic lens, oval bokeh, horizontal blue flares' },
  { id: 'macro', label: 'Macro', phrase: 'macro lens, extreme detail on textures' },
  { id: 'wide-18', label: 'Gran angular 18mm', phrase: '18mm wide angle, dramatic perspective depth' },
];

export const LIGHTING: CatalogEntry[] = [
  { id: 'three-point', label: '3 puntos clásico', phrase: 'classic three-point lighting, balanced key and fill' },
  { id: 'golden-hour', label: 'Golden hour', phrase: 'golden hour sunlight, long warm shadows' },
  { id: 'practicals', label: 'Prácticas (neones/lámparas)', phrase: 'lit by practical neon signs and warm lamps in frame' },
  { id: 'low-key', label: 'Low key dramático', phrase: 'low-key chiaroscuro lighting, deep shadows, single motivated source' },
  { id: 'overcast', label: 'Nublado suave', phrase: 'soft overcast daylight, even diffuse light' },
  { id: 'hard-noon', label: 'Mediodía duro', phrase: 'hard noon sunlight, crisp contrast, sharp shadows' },
];

export const FILM_STOCKS: CatalogEntry[] = [
  { id: 'kodak-5219', label: 'Kodak Vision3 500T', phrase: 'Kodak Vision3 500T film emulation, fine grain, warm halation' },
  { id: 'portra-400', label: 'Kodak Portra 400', phrase: 'Kodak Portra 400 stills look, gentle pastel skin tones' },
  { id: 'cinestill-800', label: 'CineStill 800T', phrase: 'CineStill 800T, tungsten balance, red halation around highlights' },
  { id: 'digital-clean', label: 'Digital limpio', phrase: 'clean digital capture, no added grain' },
];

export const ATMOSPHERES: CatalogEntry[] = [
  { id: 'haze', label: 'Bruma ligera', phrase: 'light atmospheric haze adding depth layers' },
  { id: 'rain', label: 'Lluvia', phrase: 'falling rain, wet reflective surfaces' },
  { id: 'dust', label: 'Polvo en el aire', phrase: 'floating dust particles catching the light' },
  { id: 'fog', label: 'Niebla densa', phrase: 'dense fog, silhouettes emerging from white' },
  { id: 'none', label: 'Limpio', phrase: '' },
];

export const COLOR_GRADES: CatalogEntry[] = [
  { id: 'teal-orange', label: 'Teal & Orange', phrase: 'teal and orange cinematic grade' },
  { id: 'bleach', label: 'Bleach bypass', phrase: 'bleach bypass grade, desaturated silver contrast' },
  { id: 'warm-vintage', label: 'Vintage cálido', phrase: 'warm vintage grade, faded blacks' },
  { id: 'neo-noir', label: 'Neo-noir', phrase: 'neo-noir grade, cyan shadows and magenta highlights' },
  { id: 'natural', label: 'Natural', phrase: 'natural color, true-to-life grading' },
];

export const COMPOSITIONS: CatalogEntry[] = [
  { id: 'thirds', label: 'Tercios', phrase: 'rule-of-thirds composition' },
  { id: 'centered', label: 'Centrado simétrico', phrase: 'centered symmetrical composition' },
  { id: 'leading-lines', label: 'Líneas guía', phrase: 'strong leading lines drawing the eye to the subject' },
  { id: 'frame-in-frame', label: 'Marco dentro de marco', phrase: 'frame-within-a-frame composition' },
];

/* Motion canon R6 → lenguaje de cámara (docs/CONTENT_TYPES_SPEC.md §3; zoom ≤ 1.18) */
export const MOTION_PHRASES: Record<string, string> = {
  STATIC: 'locked-off static shot',
  ZOOM_IN: 'slow cinematic push in',
  ZOOM_OUT: 'gentle pull back revealing the scene',
  PAN_LEFT: 'smooth pan to the left',
  PAN_RIGHT: 'smooth pan to the right',
  PAN_UP: 'slow tilt upward',
  PAN_DOWN: 'slow tilt downward',
  ZOOM_IN_PAN: 'push in while drifting laterally',
  ZOOM_OUT_PAN: 'pull back with a lateral drift',
  SLOW_DRIFT: 'subtle floating drift, almost imperceptible',
};

export const BASE_NEGATIVE = 'watermark, text overlay, logo, deformed hands, extra fingers, low contrast, flat lighting, amateur, blurry, jpeg artifacts, oversaturated';

/* ── Motor de mejora ── */

export type Intensity = 1 | 2 | 3;
export interface EnhanceOptions {
  camera?: string; lens?: string; light?: string; stock?: string;
  atmosphere?: string; grade?: string; composition?: string; motion?: string;
}
export interface EnhanceResult {
  prompt: string; negative: string;
  appliedLayers: string[];          // qué se añadió (auditoría "antes/después")
  subject: string;                   // el original, intacto
  intensity: Intensity;
}

/** Frases por intensidad. Intensidad 3 añade lenguaje de rodaje real. */
const LAYER_BUDGET: Record<Intensity, string[]> = {
  1: ['light', 'grade'],
  2: ['light', 'lens', 'grade', 'motion'],
  3: ['camera', 'lens', 'light', 'stock', 'atmosphere', 'grade', 'composition', 'motion'],
};

const byId = (list: CatalogEntry[], id?: string) => list.find(e => e.id === id);

/**
 * enhancePrompt — añade capas cinematográficas SIN tocar el sujeto.
 * La garantía de "sujeto intacto" es estructural: el resultado SIEMPRE empieza
 * con el texto original del usuario, verbatim.
 */
export function enhancePrompt(subject: string, intensity: Intensity, opts: EnhanceOptions = {}): EnhanceResult {
  const clean = subject.trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('El sujeto del prompt no puede estar vacío.');
  const layers = LAYER_BUDGET[intensity];
  const phrases: string[] = [];
  const applied: string[] = [];
  const pick = (key: keyof EnhanceOptions, list: CatalogEntry[], fallback?: CatalogEntry) => {
    if (!layers.includes(key)) return;
    const entry = byId(list, opts[key]) ?? fallback;
    if (entry?.phrase) { phrases.push(entry.phrase); applied.push(entry.label); }
  };
  pick('camera', CAMERAS);
  pick('lens', LENSES, byId(LENSES, '50mm-prime'));
  pick('light', LIGHTING, byId(LIGHTING, 'three-point'));
  pick('stock', FILM_STOCKS, byId(FILM_STOCKS, 'kodak-5219'));
  pick('atmosphere', ATMOSPHERES);
  pick('grade', COLOR_GRADES, byId(COLOR_GRADES, 'natural'));
  pick('composition', COMPOSITIONS);
  if (layers.includes('motion') && opts.motion && MOTION_PHRASES[opts.motion]) {
    phrases.push(MOTION_PHRASES[opts.motion]); applied.push(`Motion ${opts.motion}`);
  }
  const prompt = [clean, ...phrases].join(', ');
  return { prompt, negative: BASE_NEGATIVE, appliedLayers: applied, subject: clean, intensity };
}

/* ── Handoff para cualquier IA ── */

export interface HandoffInput {
  targetRef: string;                // id del evento/slot del grafo (o "standalone")
  providerHint?: string;            // 'kling' | 'veo' | 'runway' | 'freepik' | 'generic' | 'higgsfield'
  aspectRatio?: string; durationSec?: number; fps?: number;
  startFrameAssetId?: string; endFrameAssetId?: string;
  expectedFilename?: string;
}

/** buildHandoff — convierte un resultado del Studio en HandoffPackage (contracts v2.3). */
export function buildHandoff(result: EnhanceResult, input: HandoffInput): HandoffPackage {
  const slug = result.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32).replace(/^-|-$/g, '') || 'asset';
  const hint = input.providerHint ?? 'generic';
  const header: Record<string, string> = {
    kling: `[Kling · usa el prompt completo, respetando negative]`,
    veo: `[Veo · describe la escena como una sola toma continua]`,
    runway: `[Runway · prompt principal + negative en su campo]`,
    freepik: `[Freepik · estilo por defecto; pega el negative en "exclude"]`,
    higgsfield: `[Higgsfield · selecciona el workflow indicado y pega el prompt]`,
    generic: `[Generador IA · prompt principal + negative]`,
  };
  const lines = [header[hint] ?? header.generic, `PROMPT: ${result.prompt}`, `NEGATIVE: ${result.negative}`];
  const spec: string[] = [];
  if (input.aspectRatio) spec.push(`Aspect ${input.aspectRatio}`);
  if (input.durationSec) spec.push(`Duración ${input.durationSec}s`);
  if (input.fps) spec.push(`${input.fps} fps`);
  if (spec.length) lines.push(`OUTPUT: ${spec.join(' · ')}`);
  lines.push(`GUARDA EL RESULTADO COMO: ${input.expectedFilename ?? `${slug}.mp4`}`);
  lines.push('DEVOLUCIÓN: arrastra el archivo a AbrxsVAV (Import Result lo adjunta al evento).');
  return {
    id: `hp_${crypto.randomUUID().slice(0, 8)}`,
    targetKind: 'visual_item', targetRef: input.targetRef,
    providerHint: hint, prompt: result.prompt, negative: result.negative,
    outputSpec: { aspectRatio: input.aspectRatio ?? '9:16', durationSec: input.durationSec ?? undefined, fps: input.fps ?? undefined, motionDescription: result.appliedLayers.find(l => l.startsWith('Motion')) ?? '' },
    referenceAssetIds: [],
    startFrameAssetId: input.startFrameAssetId, endFrameAssetId: input.endFrameAssetId,
    expectedFilename: input.expectedFilename ?? `${slug}.mp4`,
    returnInstructions: 'Arrastra el archivo generado a AbrxsVAV o usa Import Result; matchea por expectedFilename.',
    createdAt: new Date().toISOString(),
  };
}

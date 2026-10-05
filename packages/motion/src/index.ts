/* ═══ ABRXSVAV MOTION COMPOSER — motion graphics deterministas por capas ═══
   Estilo Remotion: las imágenes/textos viven en CAPAS sobre el timeline y el
   movimiento es CÓDIGO puro (keyframes + easing), nunca IA. Dos salidas:
   (a) RenderSpec JSON — consumible por el bundle Remotion del paso 7;
   (b) comandos FFmpeg zoompan — preview/render inmediato sin bundle.
   Canon: zoom ≤ 1.18 · easing ease-in-out único · rangos [inicio, fin) en frames. */

export const ZOOM_MAX = 1.18; // canon R6: nada de "zoom 110% flaco" ni beyond
export const EASING = 'ease-in-out';

export type MotionPreset =
  | 'STATIC' | 'ZOOM_IN' | 'ZOOM_OUT'
  | 'PAN_LEFT' | 'PAN_RIGHT' | 'PAN_UP' | 'PAN_DOWN'
  | 'ZOOM_IN_PAN' | 'ZOOM_OUT_PAN' | 'SLOW_DRIFT';

export interface LayerSpec {
  id: string;
  assetUri?: string;                 // imagen/video (kind image|video)
  kind: 'image' | 'video' | 'text';
  text?: string;                     // kind text
  startFrame: number; endFrame: number; // [in, out) — out exclusivo
  motion?: MotionPreset;
  origin?: { x: number; y: number }; // centro 0.5/0.5; PAN/ZOOM orbitan aquí
  scaleFrom?: number;                // zoom inicial (default 1.0)
  scaleTo?: number;                  // zoom final (default por preset, ≤ ZOOM_MAX)
  opacity?: number;                  // 0..1 (default 1)
  z?: number;                        // orden de capa (mayor = encima)
  fontSize?: number;                 // kind text
}

export interface CompositionSpec {
  id: string;
  fps: number;
  width: number; height: number;
  durationFrames: number;            // out exclusivo
  layers: LayerSpec[];
}

export interface Keyframe { frame: number; scale: number; x: number; y: number; opacity: number; }
export interface RenderLayer {
  id: string; kind: LayerSpec['kind']; assetUri?: string; text?: string; fontSize?: number;
  z: number; keyframes: Keyframe[];  // ordenados por frame — interpolación ease-in-out
}
export interface RenderSpec {
  specVersion: 'abrxs.motion-render.v1';
  compositionId: string; fps: number; width: number; height: number; durationFrames: number;
  easing: typeof EASING;
  layers: RenderLayer[];             // z ascendente (fondo → frente)
  ffmpeg: string[];                  // comandos zoompan por capa de imagen (preview)
}

const DEFAULT_ORIGINS: Record<MotionPreset, { x: number; y: number }> = {
  STATIC: { x: 0.5, y: 0.5 }, ZOOM_IN: { x: 0.5, y: 0.5 }, ZOOM_OUT: { x: 0.5, y: 0.5 },
  PAN_LEFT: { x: 0.62, y: 0.5 }, PAN_RIGHT: { x: 0.38, y: 0.5 },
  PAN_UP: { x: 0.5, y: 0.62 }, PAN_DOWN: { x: 0.5, y: 0.38 },
  ZOOM_IN_PAN: { x: 0.42, y: 0.55 }, ZOOM_OUT_PAN: { x: 0.58, y: 0.45 },
  SLOW_DRIFT: { x: 0.5, y: 0.5 },
};
/** Zoom por preset (canon: destino ≤ ZOOM_MAX; SLOW_DRIFT casi imperceptible). */
const PRESET_ZOOM: Record<MotionPreset, { from: number; to: number; drift: number }> = {
  STATIC: { from: 1.0, to: 1.0, drift: 0 },
  ZOOM_IN: { from: 1.0, to: 1.12, drift: 0 },
  ZOOM_OUT: { from: 1.12, to: 1.0, drift: 0 },
  PAN_LEFT: { from: 1.08, to: 1.08, drift: 0 },
  PAN_RIGHT: { from: 1.08, to: 1.08, drift: 0 },
  PAN_UP: { from: 1.08, to: 1.08, drift: 0 },
  PAN_DOWN: { from: 1.08, to: 1.08, drift: 0 },
  ZOOM_IN_PAN: { from: 1.0, to: 1.14, drift: 0.04 },
  ZOOM_OUT_PAN: { from: 1.14, to: 1.0, drift: 0.04 },
  SLOW_DRIFT: { from: 1.04, to: 1.06, drift: 0.015 },
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** ease-in-out cúbico — el ÚNICO easing del canon. */
export const easeInOut = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function validateLayer(l: LayerSpec, spec: CompositionSpec): void {
  if (!l.id) throw new Error('Cada capa necesita id.');
  if (!Number.isInteger(l.startFrame) || !Number.isInteger(l.endFrame)) throw new Error(`Capa ${l.id}: start/endFrame deben ser enteros.`);
  if (l.endFrame <= l.startFrame) throw new Error(`Capa ${l.id}: endFrame debe ser mayor a startFrame (out exclusivo).`);
  if (l.startFrame < 0 || l.endFrame > spec.durationFrames) throw new Error(`Capa ${l.id}: fuera del rango de la composición [0, ${spec.durationFrames}).`);
  if ((l.kind === 'image' || l.kind === 'video') && !l.assetUri) throw new Error(`Capa ${l.id}: kind ${l.kind} requiere assetUri.`);
  if (l.kind === 'text' && !l.text) throw new Error(`Capa ${l.id}: kind text requiere text.`);
  if (l.opacity !== undefined && (l.opacity < 0 || l.opacity > 1)) throw new Error(`Capa ${l.id}: opacity debe estar en [0,1].`);
  if (l.scaleTo !== undefined && l.scaleTo > ZOOM_MAX) throw new Error(`Capa ${l.id}: scaleTo ${l.scaleTo} excede el canon ZOOM_MAX ${ZOOM_MAX}.`);
}

/** Keyframes deterministas de una capa — el movimiento es función del preset, no de IA. */
export function layerKeyframes(l: LayerSpec, spec: CompositionSpec): Keyframe[] {
  const dur = l.endFrame - l.startFrame;
  const preset = l.motion ?? 'STATIC';
  const zoom = PRESET_ZOOM[preset];
  const from = clamp(l.scaleFrom ?? zoom.from, 1, ZOOM_MAX);
  const to = clamp(l.scaleTo ?? zoom.to, from, ZOOM_MAX);
  const o = l.origin ?? DEFAULT_ORIGINS[preset];
  const drift = zoom.drift;
  const opacity = l.opacity ?? 1;
  const at = (p: number): Keyframe => {
    const e = easeInOut(clamp(p, 0, 1));
    // PAN: la cámara se desplaza hacia el lado indicado → el origen se mueve al opuesto
    let dx = 0, dy = 0;
    if (preset === 'PAN_LEFT') dx = -0.06 * e; else if (preset === 'PAN_RIGHT') dx = 0.06 * e;
    if (preset === 'PAN_UP') dy = -0.06 * e; else if (preset === 'PAN_DOWN') dy = 0.06 * e;
    if (preset === 'ZOOM_IN_PAN') { dx = 0.05 * e; dy = -0.03 * e; }
    if (preset === 'ZOOM_OUT_PAN') { dx = -0.05 * e; dy = 0.03 * e; }
    if (preset === 'SLOW_DRIFT') { dx = drift * e; dy = (drift / 2) * Math.sin(e * Math.PI); }
    return {
      frame: l.startFrame + Math.round(dur * p),
      scale: +(from + (to - from) * e).toFixed(4),
      x: +(clamp(o.x + dx, 0, 1)).toFixed(4),
      y: +(clamp(o.y + dy, 0, 1)).toFixed(4),
      opacity,
    };
  };
  return [at(0), at(0.5), at(1)];
}

/** Comando FFmpeg zoompan para una capa de imagen (preview/render inmediato). */
export function layerFfmpeg(l: LayerSpec, spec: CompositionSpec): string | null {
  if (l.kind !== 'image' || !l.assetUri) return null;
  const kfs = layerKeyframes(l, spec);
  const dur = l.endFrame - l.startFrame;
  const d = kfs[kfs.length - 1].scale - kfs[0].scale;
  const dx = kfs[kfs.length - 1].x - kfs[0].x;
  const dy = kfs[kfs.length - 1].y - kfs[0].y;
  const zoomExpr = `'min(${kfs[0].scale.toFixed(4)}+(${d.toFixed(4)})*on/${dur},${ZOOM_MAX})'`;
  const xExpr = `'iw/2-(iw/zoom/2)+(${dx.toFixed(4)})*iw*on/${dur}'`;
  const yExpr = `'ih/2-(ih/zoom/2)+(${dy.toFixed(4)})*ih*on/${dur}'`;
  return `ffmpeg -loop 1 -i "${l.assetUri}" -vf "zoompan=z=${zoomExpr}:x=${xExpr}:y=${yExpr}:d=${dur}:s=${spec.width}x${spec.height}:fps=${spec.fps}" -frames:v ${dur} -c:v libx264 -pix_fmt yuv420p "layer_${l.id}.mp4"`;
}

/** Compila la composición completa → RenderSpec (Remotion-ready) + comandos FFmpeg. */
export function compileComposition(spec: CompositionSpec): RenderSpec {
  if (!spec.id) throw new Error('La composición necesita id.');
  if (!Number.isInteger(spec.fps) || spec.fps <= 0) throw new Error('fps debe ser un entero positivo.');
  if (!Number.isInteger(spec.durationFrames) || spec.durationFrames <= 0) throw new Error('durationFrames debe ser un entero positivo.');
  if (!spec.layers.length) throw new Error('La composición necesita al menos una capa.');
  const seen = new Set<string>();
  for (const l of spec.layers) {
    if (seen.has(l.id)) throw new Error(`Capa duplicada: ${l.id}.`);
    seen.add(l.id);
    validateLayer(l, spec);
  }
  const layers: RenderLayer[] = [...spec.layers]
    .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    .map(l => ({
      id: l.id, kind: l.kind, assetUri: l.assetUri, text: l.text, fontSize: l.fontSize,
      z: l.z ?? 0, keyframes: layerKeyframes(l, spec),
    }));
  const ffmpeg = spec.layers.map(l => layerFfmpeg(l, spec)).filter((c): c is string => !!c);
  return {
    specVersion: 'abrxs.motion-render.v1', compositionId: spec.id,
    fps: spec.fps, width: spec.width, height: spec.height, durationFrames: spec.durationFrames,
    easing: EASING, layers, ffmpeg,
  };
}

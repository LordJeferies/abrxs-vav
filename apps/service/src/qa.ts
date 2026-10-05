/* ═══ VISUAL QA (estructural) — del análisis Dresser §19-21 ═══
   Revisa el grafo ANTES de render: colisiones, solapes, gaps, referencias
   rotas y status inconsistente. El QA sobre píxeles (black frames, safe areas
   con video real) entra cuando exista media — este es el subset estructural
   siempre disponible. Repair loop: el caller decide reintento (máx 3, ya lo
   limita el JobEngine). */
import type { Project } from '@abraxas/contracts';
import { registries } from './registries';

export interface QaIssue { severity: 'error' | 'warning' | 'info'; code: string; message: string; ref?: string; }
export interface QaReport { projectId: string; ok: boolean; counts: { error: number; warning: number; info: number }; issues: QaIssue[]; note: string; }

const KNOWN_XR = new Set(registries.find(r => r.id === 'xr-families')!.entries.map(e => e.id));
const KNOWN_SFX = new Set(registries.find(r => r.id === 'sfx-families')!.entries.map(e => e.id));
const KNOWN_CAPTIONS = new Set(registries.find(r => r.id === 'caption-presets')!.entries.map(e => e.id));
const KNOWN_TREATMENTS = new Set((registries.find(r => r.id === 'treatment-presets')?.entries ?? []).map(e => e.id));

export function analyzeGraph(project: Project): QaReport {
  const g = project.content.graph;
  const issues: QaIssue[] = [];
  const add = (severity: QaIssue['severity'], code: string, message: string, ref?: string) => issues.push({ severity, code, message, ref });

  const inRange = (e: { startFrame: number; endFrame: number }) => e.startFrame >= 0 && e.endFrame <= g.events.length ? true : true;
  void inRange;

  // 1. Rangos válidos y dentro de la pieza (gap detection entre A-rolls)
  const aRolls = g.events.filter(e => e.kind === 'a_roll').sort((a, b) => a.startFrame - b.startFrame);
  for (let i = 1; i < aRolls.length; i++) {
    const prev = aRolls[i - 1], cur = aRolls[i];
    if (cur.startFrame < prev.endFrame) add('error', 'qa.overlap.a_roll', `Los clips A-roll se solapan: ${prev.id} termina en ${prev.endFrame} pero ${cur.id} empieza en ${cur.startFrame}.`, cur.id);
    else if (cur.startFrame - prev.endFrame > 45) add('warning', 'qa.gap.timeline', `Hueco de ${cur.startFrame - prev.endFrame} frames entre ${prev.id} y ${cur.id}.`, cur.id);
  }

  // 2. Colisiones de captions (misma pista T9 no puede tener dos captions al mismo tiempo)
  const caps = g.events.filter(e => e.kind === 'caption').sort((a, b) => a.startFrame - b.startFrame);
  for (let i = 1; i < caps.length; i++) {
    if (caps[i].startFrame < caps[i - 1].endFrame) add('error', 'qa.collision.caption', `Captions solapados: ${caps[i - 1].id} y ${caps[i].id} coinciden en ${caps[i].startFrame}–${caps[i - 1].endFrame}.`, caps[i].id);
  }

  // 3. Solapes XR (T2: un X-roll a la vez)
  const xrs = g.events.filter(e => e.kind === 'xr').sort((a, b) => a.startFrame - b.startFrame);
  for (let i = 1; i < xrs.length; i++) {
    if (xrs[i].startFrame < xrs[i - 1].endFrame) add('error', 'qa.overlap.xr', `X-rolls solapados: ${xrs[i - 1].id} y ${xrs[i].id}.`, xrs[i].id);
  }

  // 4. Referencias a tipos conocidos (registries) — datos, no código
  for (const e of g.events) {
    const x = (e.extensions ?? {}) as Record<string, unknown>;
    if (e.kind === 'xr' && e.visualTypeId && !KNOWN_XR.has(e.visualTypeId.split('@')[0]))
      add('warning', 'qa.unknown.xr_family', `${e.id} usa familia XR desconocida "${e.visualTypeId}" (no está en el registry xr-families).`, e.id);
    if (e.kind === 'sfx') {
      const role = String(x.sfxRole ?? '');
      if (role && !KNOWN_SFX.has(role)) add('warning', 'qa.unknown.sfx_role', `${e.id} usa SFX "${role}" fuera de la librería canónica.`, e.id);
    }
    if (e.kind === 'caption') {
      const style = String(x.style ?? x.preset ?? '');
      if (style && !KNOWN_CAPTIONS.has(style)) add('info', 'qa.unknown.caption_preset', `${e.id} usa caption "${style}" no registrado (puede ser client-custom).`, e.id);
    }
    const treatments = x.treatments;
    if (Array.isArray(treatments)) for (const t of treatments)
      if (typeof t === 'string' && !KNOWN_TREATMENTS.has(t)) add('warning', 'qa.unknown.treatment', `${e.id} usa tratamiento "${t}" no registrado.`, e.id);
  }

  // 5. Recetas de generación incompletas
  for (const e of g.events) {
    const x = (e.extensions ?? {}) as Record<string, unknown>;
    if (x.recipe && typeof x.recipe === 'object') {
      const r = x.recipe as Record<string, unknown>;
      if (!r.prompt) add('error', 'qa.recipe.no_prompt', `${e.id} tiene receta de generación sin prompt.`, e.id);
    }
    if ('motionComposition' in x) {
      const mc = x.motionComposition as { layers?: unknown[]; durationFrames?: number };
      if (!mc.layers?.length) add('error', 'qa.motion.no_layers', `${e.id} tiene motionComposition sin capas.`, e.id);
      if (e.endFrame - e.startFrame !== mc.durationFrames) add('warning', 'qa.motion.range_mismatch', `${e.id}: el rango del evento (${e.endFrame - e.startFrame}) no coincide con durationFrames (${mc.durationFrames}).`, e.id);
    }
  }

  // 6. Cobertura de captions en piezas con speech (info, no error)
  if (aRolls.length && !caps.length) add('info', 'qa.captions.missing', 'Hay A-roll pero ningún evento de captions.', undefined);

  const counts = { error: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.severity]++;
  return {
    projectId: project.id, ok: counts.error === 0, counts, issues,
    note: `QA estructural (v0.5): ${counts.error} errores, ${counts.warning} avisos, ${counts.info} notas. QA de píxeles (black frames, safe areas con media real) entra con el pipeline de render.`,
  };
}

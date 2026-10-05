/* Modo COACH — el productor de video que te va diciendo el paso a paso.
   Compila el Production Graph en instrucciones funcionales: qué agregar, dónde,
   con qué valores y por qué — para montar la pieza en CapCut, DaVinci (o por MCP),
   con la misma verdad que usa la app (el NlePlan SIEMPRE se compila del grafo). */
import type { Project } from '@abraxas/contracts';

export interface CoachStep {
  n: number; title: string; app: string;
  timecode: string; what: string; how: string; why: string;
}
export interface CoachPlan {
  projectId: string; projectName: string; fps: string;
  summary: string; steps: CoachStep[]; txt: string;
  note: string;
}

const KIND_LABEL: Record<string, string> = {
  a_roll: 'clip base (A-roll)', b_roll: 'B-roll', xr: 'X-roll', image: 'imagen',
  motion: 'animación de cámara', sfx: 'efecto de sonido', music: 'música',
  caption: 'subtítulo', vo: 'voz en off', transition: 'transición', note: 'nota'
};

export function buildCoachPlan(project: Project, target: 'capcut' | 'davinci' | 'any' = 'any'): CoachPlan {
  const g = project.content.graph;
  const fps = g.timebase.fpsNumerator / g.timebase.fpsDenominator;
  const tc = (f: number) => {
    const total = f / fps, s = Math.floor(total % 60), m = Math.floor(total / 60) % 60, h = Math.floor(total / 3600);
    const fr = Math.round(f % fps);
    return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  };
  const steps: CoachStep[] = [];
  let n = 0;
  const push = (title: string, app: string, e: { startFrame: number; endFrame: number }, what: string, how: string, why: string) =>
    steps.push({ n: ++n, title, app, timecode: `${tc(e.startFrame)} → ${tc(e.endFrame)}`, what, how, why });

  const events = [...g.events].sort((a, b) => a.startFrame - b.startFrame);
  const base = events.filter(e => e.kind === 'a_roll');
  if (base.length) {
    push('Monta el clip base', target === 'capcut' ? 'CapCut' : target === 'davinci' ? 'DaVinci' : 'CapCut/DaVinci',
      base[0], `Coloca ${base.length === 1 ? 'el clip A-roll' : `${base.length} clips A-roll`} en la pista principal`,
      'Importa el máster, corta por los rangos indicados y ponlos en orden en la pista 1',
      'El A-roll es la columna vertebral: todo lo demás se monta encima');
  }
  for (const e of events) {
    const x = (e.extensions ?? {}) as Record<string, unknown>;
    if (e.kind === 'b_roll') {
      const q = (x.stockQuery as string) ?? (x.purpose as string) ?? e.label ?? '';
      push('Inserta B-roll', target === 'capcut' ? 'CapCut' : 'DaVinci', e,
        `${e.label ?? 'B-roll'} encima del A-roll`,
        `Busca "${q}" en Pexels/Pixabay (o usa el asset ya descargado por la app), ponlo en la pista de arriba y aplica ${x.brollType === 'photo_ken_burns' ? 'un zoom lento 1.0→1.12 (Ken Burns)' : 'el movimiento indicado en la receta'}`,
        (x.purpose as string) ?? 'refuerza visualmente lo que se dice en ese tramo');
    } else if (e.kind === 'xr' && e.visualTypeId) {
      push('Compone el X-roll', 'Archivo del proyecto (ya renderizado)', e,
        `${e.label ?? 'X-roll'} — archivo terminado`,
        'Importa el MP4 del X-roll y colócalo en la pista superior en el rango indicado; si falta, expórtalo desde Visual Studio o XR Studio',
        (x.purpose as string) ?? 'pieza visual generada con función editorial');
    } else if (e.kind === 'caption') {
      push('Subtitula', target === 'capcut' ? 'CapCut (auto-captions o SRT)' : 'DaVinci (importar SRT)', e,
        'Subtítulos estilo del cliente',
        x.captionPolicy === 'inserts_only' ? 'El video YA trae captions quemados: solo añade los inserts/destacados que faltan' : 'Importa el SRT exportado por la app y aplica el preset del cliente',
        'las captions fidelizan en vertical; respeta la safe area inferior');
    } else if (e.kind === 'sfx') {
      push('Sonido puntual', 'CapCut/DaVinci (pista de audio)', e,
        `${x.sfxRole ?? 'SFX'} ${x.variant ? `(${x.variant})` : ''}`,
        `Coloca el efecto en ${tc(e.startFrame)} con fade de 2–4 frames y baja la música (ducking) si hay`,
        (x.purpose as string) ?? 'motivar el cambio visual — SFX sin motivo se nota amateur');
    }
  }
  const summary = `${steps.length} pasos para montar "${project.content.name}"` +
    (events.some(e => e.status === 'ghost') ? ' · OJO: hay eventos ghost (propuestas sin materializar) — revísalos en Dresser antes de montar' : '');
  const txt = [
    `PLAN DE MONTAJE · ${project.content.name} · ${fps.toFixed(3)} fps · rangos [inicio, fin)`,
    `Compilado del Production Graph por el Coach de AbrxsVAV — una sola verdad, sin planes paralelos.`,
    '',
    ...steps.map(s => [
      `PASO ${s.n} · ${s.title} (${s.app})`,
      `  DÓNDE:  ${s.timecode}`,
      `  QUÉ:    ${s.what}`,
      `  CÓMO:   ${s.how}`,
      `  POR QUÉ: ${s.why}`, ''
    ].join('\n')),
    'TIP: este mismo plan es consumible por un agente con el MCP de DaVinci/CapCut — cada paso tiene rango, contenido y valores exactos.'
  ].join('\n');
  return { projectId: project.id, projectName: project.content.name, fps: `${g.timebase.fpsNumerator}/${g.timebase.fpsDenominator}`, summary, steps, txt, note: 'Compilado desde el grafo (v0.5.0). El plan completo NlePlan (FCPXML/EDL/kits) llega en el paso 8.' };
}

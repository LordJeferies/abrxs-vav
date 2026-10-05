import type { ActionDefinition } from '@abraxas/contracts';

/**
 * ActionCatalog — la única lista de acciones del sistema (principio MCP-first).
 * La UI, el companion, el servidor MCP (mcp/server.mjs) y los tests llaman estas
 * mismas rutas. Si una feature no aparece aquí, no está terminada (AGENTS.md §14).
 * Las destructivas exigen confirm:true desde MCP; el navegador ya opera con sus propias UI.
 */
export const catalog: ActionDefinition[] = [
  { name:'vav.status', module:'core', summary:'Estado del servicio: versión, almacenamiento y handlers instalados.', method:'GET', path:'/api/health', destructive:false, requiresOpenProject:false, since:'0.4.0' },
  { name:'vav.catalog.list', module:'core', summary:'Lista este catálogo de acciones con sus rutas y métodos.', method:'GET', path:'/api/catalog', destructive:false, requiresOpenProject:false, since:'0.4.0' },
  { name:'vav.projects.list', module:'hub', summary:'Lista los proyectos locales.', method:'GET', path:'/api/projects', destructive:false, requiresOpenProject:false, since:'0.4.0' },
  { name:'vav.projects.create', module:'hub', summary:'Crea un proyecto con nombre y timebase racional.', method:'POST', path:'/api/projects', destructive:false, requiresOpenProject:false, since:'0.4.0' },
  { name:'vav.projects.get', module:'hub', summary:'Lee un proyecto completo (grafo e historial).', method:'GET', path:'/api/projects/:id', destructive:false, requiresOpenProject:true, since:'0.4.0' },
  { name:'vav.projects.edit', module:'hub', summary:'Edita el contenido con CAS por revisión.', method:'PUT', path:'/api/projects/:id', destructive:false, requiresOpenProject:true, since:'0.4.0' },
  { name:'vav.projects.undo', module:'hub', summary:'Deshace la última operación del historial.', method:'POST', path:'/api/projects/:id/undo', destructive:false, requiresOpenProject:true, since:'0.4.0' },
  { name:'vav.projects.redo', module:'hub', summary:'Reaplica la siguiente operación del historial.', method:'POST', path:'/api/projects/:id/redo', destructive:false, requiresOpenProject:true, since:'0.4.0' },
  { name:'vav.jobs.list', module:'activity', summary:'Lista los trabajos (jobs) con estado y progreso.', method:'GET', path:'/api/jobs', destructive:false, requiresOpenProject:false, since:'0.4.0' },
  { name:'vav.jobs.create', module:'activity', summary:'Encola un trabajo sobre un proyecto (validate / edit-plan).', method:'POST', path:'/api/jobs', destructive:false, requiresOpenProject:true, since:'0.4.0' },
  { name:'vav.jobs.cancel', module:'activity', summary:'Cancela un trabajo en cola o en ejecución.', method:'POST', path:'/api/jobs/:id/cancel', destructive:false, requiresOpenProject:false, since:'0.4.0' },
  { name:'vav.jobs.retry', module:'activity', summary:'Reintenta un trabajo fallido o cancelado.', method:'POST', path:'/api/jobs/:id/retry', destructive:false, requiresOpenProject:false, since:'0.4.0' },
  { name:'vav.studio.enhance', module:'visual-lab', summary:'Prompt Studio: añade capas cinematográficas al sujeto (intensidades 1-3) sin tocarlo.', method:'POST', path:'/api/studio/enhance', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.studio.generate', module:'visual-lab', summary:'Genera un visual: crea evento en el grafo (CAS) y encola media.generate (demo/higgsfield/nvidia).', method:'POST', path:'/api/studio/generate', destructive:false, requiresOpenProject:true, since:'0.5.0' },
  { name:'vav.studio.handoff', module:'visual-lab', summary:'Construye HandoffPackage (.json + .txt) para generar en CUALQUIER IA externa.', method:'POST', path:'/api/studio/handoff', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.providers.status', module:'visual-lab', summary:'Providers de generación registrados y su salud.', method:'GET', path:'/api/providers', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.providers.test', module:'visual-lab', summary:'Test Connection real (HTTP + latencia) contra un provider.', method:'POST', path:'/api/providers/test', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.registries.list', module:'core', summary:'Catálogos modulares versionados (XR, SFX, motion, captions, packs) — extender tipos = agregar entradas.', method:'GET', path:'/api/registries', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.coach.plan', module:'delivery', summary:'Modo coach: plan de montaje paso a paso (qué/cómo/por qué por timecode) compilado del grafo para CapCut/DaVinci.', method:'GET', path:'/api/coach/plan?projectId=:id', destructive:false, requiresOpenProject:true, since:'0.5.0' },
  { name:'vav.motion.compose', module:'visual-lab', summary:'Motion Composer: capas (imágenes/texto) → composición determinista estilo Remotion (keyframes canon, zoom ≤1.18) + comandos FFmpeg por capa.', method:'POST', path:'/api/motion', destructive:false, requiresOpenProject:true, since:'0.5.0' },
  { name:'vav.motion.list', module:'visual-lab', summary:'Composiciones motion del proyecto (eventos kind=motion con su spec).', method:'GET', path:'/api/motion?projectId=:id', destructive:false, requiresOpenProject:true, since:'0.5.0' },
  { name:'vav.motion.render', module:'visual-lab', summary:'Re-renderiza una composición motion existente (job motion.render sobre la revisión actual).', method:'POST', path:'/api/jobs', destructive:false, requiresOpenProject:true, since:'0.5.0' },
  { name:'vav.clients.list', module:'clients', summary:'Lista los perfiles de cliente.', method:'GET', path:'/api/clients', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.clients.create', module:'clients', summary:'Crea un cliente (opcionalmente importa su TXT con hechos+confianza).', method:'POST', path:'/api/clients', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.clients.get', module:'clients', summary:'Lee un perfil de cliente completo.', method:'GET', path:'/api/clients/:id', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.clients.import_txt', module:'clients', summary:'Parsea un TXT del cliente → draft con confianza + diff. No aplica sin confirmación.', method:'POST', path:'/api/clients/:id/import_txt', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.clients.ai_import', module:'clients', summary:'Importa la respuesta de IA (ABRXS CLIENT PROFILE v1) con diff; apply:true para aplicar.', method:'POST', path:'/api/clients/:id/ai_import', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.config.resolve', module:'clients', summary:'Config resuelta System→Client→Project→Video→Event (cada valor con su fuente).', method:'GET', path:'/api/config/resolve?client=:id', destructive:false, requiresOpenProject:false, since:'0.5.0' },
  { name:'vav.qa.analyze', module:'review', summary:'QA estructural del grafo: colisiones, solapes, huecos, referencias desconocidas.', method:'GET', path:'/api/qa/analyze?projectId=:id', destructive:false, requiresOpenProject:true, since:'0.5.0' },
  /* ── 0.6.0 — M1: vertical real MASTER → MediaSource → Piece → MP4 ── */
  { name:'vav.media.ingest', module:'canter', summary:'Ingesta un máster: MediaSource + job (probe, hash streaming, proxy 540p, filmstrip uniforme, waveform).', method:'POST', path:'/api/media/ingest', destructive:false, requiresOpenProject:true, since:'0.6.0' },
  { name:'vav.media.list_sources', module:'canter', summary:'MediaSources persistidas con sus derivados (proxy/filmstrip/waveform refs).', method:'GET', path:'/api/media/sources', destructive:false, requiresOpenProject:false, since:'0.6.0' },
  { name:'vav.canter.list_pieces', module:'canter', summary:'Piezas (clips) persistidas, filtrables por projectId.', method:'GET', path:'/api/canter/pieces', destructive:false, requiresOpenProject:false, since:'0.6.0' },
  { name:'vav.canter.create_piece', module:'canter', summary:'Crea una Piece: rango por FRAMES (out-exclusivo) sobre un MediaSource ingestado.', method:'POST', path:'/api/canter/pieces', destructive:false, requiresOpenProject:true, since:'0.6.0' },
  { name:'vav.canter.export_piece', module:'canter', summary:'Encola el corte real MP4 de una pieza (job canter.export_piece sobre target piece).', method:'POST', path:'/api/canter/pieces/:id/export', destructive:false, requiresOpenProject:true, since:'0.6.0' },
  { name:'vav.canter.transcribe', module:'canter', summary:'Transcribe un máster ingestado (whisper local word-level; cache por hash) → words.json + SRT/TXT.', method:'POST', path:'/api/canter/transcribe', destructive:false, requiresOpenProject:true, since:'0.6.0' },
  { name:'vav.canter.align_text', module:'canter', summary:'Alinea texto/anclas contra el transcript word-level → candidates[] con frames (no muta).', method:'POST', path:'/api/canter/align', destructive:false, requiresOpenProject:false, since:'0.6.0' },
  { name:'vav.canter.create_piece_from_text', module:'canter', summary:'Crea una Piece desde TEXTO alineado (con ambigüedad devuelve candidates para elegir).', method:'POST', path:'/api/canter/pieces/from_text', destructive:false, requiresOpenProject:true, since:'0.6.0' },
  { name:'vav.canter.get_transcript', module:'canter', summary:'Transcript word-level canónico de un MediaSource (segments + words).', method:'GET', path:'/api/canter/transcript/:id', destructive:false, requiresOpenProject:false, since:'0.6.0' },
  { name:'vav.canter.update_piece', module:'canter', summary:'Actualiza label/rango (frames) de una pieza.', method:'PUT', path:'/api/canter/pieces/:id', destructive:false, requiresOpenProject:true, since:'0.6.0' },
  { name:'vav.canter.delete_piece', module:'canter', summary:'Elimina una pieza (los MP4 exportados no se borran).', method:'POST', path:'/api/canter/pieces/:id/delete', destructive:true, requiresOpenProject:true, since:'0.6.0' }
];

/** Ruteo inverso: dado un nombre vav.* y parámetros, produce método/ruta concretos. */
export function resolveAction(name:string,params:Record<string,unknown>){
  const def=catalog.find(a=>a.name===name);
  if(!def)return null;
  const id=typeof params.id==='string'?encodeURIComponent(params.id):null;
  const path=def.path.replace(':id',id??'');
  return { method:def.method, path };
}

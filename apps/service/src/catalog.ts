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
  { name:'vav.jobs.retry', module:'activity', summary:'Reintenta un trabajo fallido o cancelado.', method:'POST', path:'/api/jobs/:id/retry', destructive:false, requiresOpenProject:false, since:'0.4.0' }
];

/** Ruteo inverso: dado un nombre vav.* y parámetros, produce método/ruta concretos. */
export function resolveAction(name:string,params:Record<string,unknown>){
  const def=catalog.find(a=>a.name===name);
  if(!def)return null;
  const id=typeof params.id==='string'?encodeURIComponent(params.id):null;
  const path=def.path.replace(':id',id??'');
  return { method:def.method, path };
}

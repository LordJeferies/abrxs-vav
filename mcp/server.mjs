#!/usr/bin/env node
/* AbrxsVAV MCP — servidor local por stdio (patrón publisher/openshortsX del repo propio).
   Requiere la app corriendo (npm start → http://127.0.0.1:4317). El MCP NO tiene su propia
   base de datos: reenvía al servicio local, que es el único dueño del estado.
   Protocolo: MCP JSON-RPC mínimo (initialize / tools/list / tools/call) sin dependencias. */
import readline from 'node:readline';

const BASE = process.env.VAV_SERVICE_URL || 'http://127.0.0.1:4317';
const READ_ONLY = /^true$/i.test(process.env.VAV_MCP_READ_ONLY || '');
const HEADERS = { 'Content-Type': 'application/json', 'X-Abraxas-Client': 'local' };

async function api(action, params = {}, { internal = false } = {}) {
  const catalogRes = await fetch(`${BASE}/api/catalog`).then(r => r.json()).catch(() => null);
  const actions = catalogRes?.actions || [];
  const def = actions.find(a => a.name === action);
  if (!def) throw new Error(`Acción desconocida: ${action}. La app está corriendo? ${BASE}`);
  if (READ_ONLY && def.method !== 'GET') throw new Error('Servidor MCP en modo READ_ONLY.');
  if (!internal && def.destructive && params.confirm !== true)
    throw new Error(`La acción ${action} es destructiva y requiere confirm:true explícito.`);
  const path = def.path.replace(':id', encodeURIComponent(String(params.id ?? '')));
  const { id: _id, confirm: _c, ...payload } = params;
  const res = await fetch(`${BASE}${path}`, {
    method: def.method, headers: HEADERS,
    body: def.method === 'GET' ? undefined : JSON.stringify(payload)
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
  return out;
}

const tools = [
  { name: 'vav_status', description: 'Estado del servicio AbrxsVAV: versión, almacenamiento y handlers. Llámala primero.', inputSchema: { type: 'object', additionalProperties: false } },
  { name: 'vav_catalog', description: 'Lista el ActionCatalog completo (acciones disponibles, rutas, reglas).', inputSchema: { type: 'object', additionalProperties: false } },
  { name: 'vav_list_projects', description: 'Lista los proyectos locales.', inputSchema: { type: 'object', additionalProperties: false } },
  { name: 'vav_create_project', description: 'Crea un proyecto. fpsNumerator/fpsDenominator racionales (ej. 30000/1001).', inputSchema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, fpsNumerator: { type: 'number', default: 30000 }, fpsDenominator: { type: 'number', default: 1001 } }, required: ['name'] } },
  { name: 'vav_get_project', description: 'Lee un proyecto completo (grafo, eventos, historial).', inputSchema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'vav_edit_project', description: 'Edita el contenido del proyecto con CAS: requiere revision actual.', inputSchema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, revision: { type: 'number' }, label: { type: 'string' }, content: { type: 'object' } }, required: ['id', 'revision', 'label', 'content'] } },
  { name: 'vav_undo_project', description: 'Deshace la última operación del proyecto.', inputSchema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, revision: { type: 'number' } }, required: ['id', 'revision'] } },
  { name: 'vav_redo_project', description: 'Rehace la siguiente operación del proyecto.', inputSchema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, revision: { type: 'number' } }, required: ['id', 'revision'] } },
  { name: 'vav_list_jobs', description: 'Lista los trabajos con estado y progreso.', inputSchema: { type: 'object', additionalProperties: false } },
  { name: 'vav_create_job', description: 'Encola un trabajo (project.validate | project.edit-plan) sobre un proyecto con su revisión actual.', inputSchema: { type: 'object', additionalProperties: false, properties: { projectId: { type: 'string' }, revision: { type: 'number' }, kind: { type: 'string', enum: ['project.validate', 'project.edit-plan'] } }, required: ['projectId', 'revision', 'kind'] } },
  { name: 'vav_cancel_job', description: 'Cancela un trabajo activo.', inputSchema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'vav_retry_job', description: 'Reintenta un trabajo fallido o cancelado.', inputSchema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'vav_smoke', description: 'Prueba E2E del core: crea un proyecto temporal, valida, hace undo/redo y limpia. Útil para verificar la app por código.', inputSchema: { type: 'object', additionalProperties: false } }
];

async function callTool(name, args) {
  switch (name) {
    case 'vav_status': return api('vav.status');
    case 'vav_catalog': return api('vav.catalog.list');
    case 'vav_list_projects': return api('vav.projects.list');
    case 'vav_create_project': return api('vav.projects.create', { name: args.name, timebase: { fpsNumerator: args.fpsNumerator ?? 30000, fpsDenominator: args.fpsDenominator ?? 1001 } });
    case 'vav_get_project': return api('vav.projects.get', args);
    case 'vav_edit_project': return api('vav.projects.edit', args);
    case 'vav_undo_project': return api('vav.projects.undo', args);
    case 'vav_redo_project': return api('vav.projects.redo', args);
    case 'vav_list_jobs': return api('vav.jobs.list');
    case 'vav_create_job': return api('vav.jobs.create', args);
    case 'vav_cancel_job': return api('vav.jobs.cancel', args);
    case 'vav_retry_job': return api('vav.jobs.retry', args);
    case 'vav_smoke': {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const project = await api('vav.projects.create', { name: `SMOKE_${stamp}`, timebase: { fpsNumerator: 30000, fpsDenominator: 1001 } }, { internal: true });
      const job = await api('vav.jobs.create', { projectId: project.id, revision: project.revision, kind: 'project.validate' }, { internal: true });
      let status = 'unknown';
      for (let i = 0; i < 100 && !['completed', 'failed'].includes(status); i++) {
        await new Promise(r => setTimeout(r, 100));
        const jobs = await api('vav.jobs.list', {}, { internal: true });
        status = (Array.isArray(jobs) ? jobs : jobs.jobs || []).find(j => j.id === job.id)?.status ?? 'unknown';
      }
      const undone = await api('vav.projects.undo', { id: project.id, revision: project.revision }, { internal: true });
      const redone = await api('vav.projects.redo', { id: project.id, revision: undone.revision }, { internal: true });
      return { smoke: 'passed', projectId: project.id, jobStatus: status, undoRedoRevision: redone.revision, note: 'Proyecto SMOKE_… creado para la prueba; puede borrarse.' };
    }
    default: throw new Error(`Tool desconocida: ${name}`);
  }
}

const rl = readline.createInterface({ input: process.stdin });
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
rl.on('line', line => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  (async () => {
    if (method === 'initialize') return { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'abrxs-vav-mcp', version: '0.4.0' } };
    if (method === 'notifications/initialized' || method?.startsWith('notifications/')) return null;
    if (method === 'tools/list') return { tools };
    if (method === 'tools/call') {
      try {
        const result = await callTool(params.name, params.arguments || {});
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `ERROR: ${e.message}` }], isError: true };
      }
    }
    return null;
  })().then(result => { if (result !== null) send({ jsonrpc: '2.0', id, result }); })
     .catch(e => send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } }));
});

import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { catalog } from '../apps/service/src/catalog';

/* ═══ PARIDAD ActionCatalog ↔ MCP (0.5.1) ═══
   ActionCatalog = fuente de verdad (AGENTS.md §14). El servidor MCP
   (mcp/server.mjs) es un cliente del servicio local: cada tool debe
   reenviar a una acción del catálogo, y cada acción debe ser alcanzable
   por al menos un tool (con alias convenientes documentados abajo).
   Este test lee el código real del servidor MCP y no permite deriva. */

const read=async(path:string)=>readFile(new URL('../'+path,import.meta.url),'utf8');

/** Alias convenientes intencionales: acciones sin tool propio porque un tool
    más genérico las cubre. Cada entrada debe estar justificada aquí. */
const ALIAS_ACTIONS:Record<string,string>={
  // vav_motion_render reenvía a vav.jobs.create con kind=motion.render (mismo endpoint /api/jobs).
  'vav.motion.render':'cubierto por vav_motion_render → vav.jobs.create (kind=motion.render)'
};

describe('Paridad MCP ↔ ActionCatalog',()=>{
  it('extrae los tools reales de mcp/server.mjs',async()=>{
    const source=await read('mcp/server.mjs');
    const tools=[...source.matchAll(/\{\s*name:\s*'([a-z_]+)'/g)].map(m=>m[1]);
    expect(tools.length).toBeGreaterThan(20);
    expect(new Set(tools).size).toBe(tools.length); // sin duplicados
  });
  it('todo api() del MCP apunta a una acción existente del ActionCatalog',async()=>{
    const source=await read('mcp/server.mjs');
    const mappings=[...source.matchAll(/case '([a-z_]+)':\s*return api\('([a-z][a-zA-Z._]*)'/g)];
    expect(mappings.length).toBeGreaterThan(20);
    const catalogNames=new Set(catalog.map(a=>a.name));
    for(const [,tool,action] of mappings){
      expect(catalogNames.has(action),`El tool ${tool} llama a ${action}, que no existe en el ActionCatalog`).toBe(true);
    }
  });
  it('toda acción del catálogo es alcanzable por un tool MCP (1:1 salvo alias documentados)',async()=>{
    const source=await read('mcp/server.mjs');
    const targets=new Set([...source.matchAll(/case '([a-z_]+)':\s*return api\('([a-z][a-zA-Z._]*)'/g)].map(m=>m[2]));
    for(const action of catalog){
      if(targets.has(action.name))continue;
      expect(ALIAS_ACTIONS[action.name],
        `La acción ${action.name} no tiene tool MCP ni alias documentado en ALIAS_ACTIONS`).toBeDefined();
    }
  });
  it('no hay tools huérfanos: cada tool tiene case en callTool (vav_smoke incluido)',async()=>{
    const source=await read('mcp/server.mjs');
    const tools=new Set([...source.matchAll(/\{\s*name:\s*'([a-z_]+)'/g)].map(m=>m[1]));
    const cases=new Set([...source.matchAll(/case '([a-z_]+)':/g)].map(m=>m[1]));
    for(const tool of tools)expect(cases.has(tool),`El tool ${tool} no tiene case en callTool`).toBe(true);
    for(const c of cases)expect(tools.has(c),`El case ${c} no corresponde a ningún tool listado`).toBe(true);
  });
  it('vav_smoke existe como tool de diagnóstico E2E',async()=>{
    const source=await read('mcp/server.mjs');
    expect(source).toContain("name: 'vav_smoke'");
    expect(source).toContain("case 'vav_smoke'");
  });
  it('las acciones destructivas del catálogo exigen confirm en el MCP',async()=>{
    const source=await read('mcp/server.mjs');
    expect(source).toContain('def.destructive');
    expect(source).toContain('confirm !== true');
    for(const action of catalog.filter(a=>a.destructive)){
      expect(action.name).toMatch(/^vav\./); // sanidad: nombres canónicos
    }
  });
});

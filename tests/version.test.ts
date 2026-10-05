import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { ABRXS_VERSION } from '@abraxas/contracts';

const read=(path:string)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const manifests=[
  'package.json','apps/service/package.json','apps/desktop/package.json',
  'packages/contracts/package.json','packages/core/package.json',
  'packages/motion/package.json','packages/prompts/package.json','packages/ui/package.json'
];

describe('Normalización de versiones (fuente única: ABRXS_VERSION)',()=>{
  it('ABRXS_VERSION coincide con el package raíz',async()=>{
    const root=JSON.parse(await read('package.json'));
    expect(root.version).toBe(ABRXS_VERSION);
  });
  it('todos los workspaces y Tauri comparten la versión del producto',async()=>{
    for(const path of manifests){
      const pkg=JSON.parse(await read(path));
      expect(pkg.version,`${path}`).toBe(ABRXS_VERSION);
    }
    const tauri=JSON.parse(await read('apps/desktop/src-tauri/tauri.conf.json'));
    expect(tauri.version).toBe(ABRXS_VERSION);
  });
  it('las dependencias internas @abraxas/* apuntan a la versión publicada de cada workspace',async()=>{
    const versions=new Map<string,string>();
    for(const path of manifests){
      const pkg=JSON.parse(await read(path));
      versions.set(pkg.name,pkg.version);
    }
    for(const path of manifests){
      const pkg=JSON.parse(await read(path));
      for(const dep of Object.keys({...pkg.dependencies,...pkg.devDependencies})){
        if(!dep.startsWith('@abraxas/'))continue;
        expect(versions.get(dep),`${path} → ${dep}`).toBeDefined();
        expect(pkg.dependencies[dep],`${path} → ${dep}`).toBe(versions.get(dep));
      }
    }
  });
  it('health/catalog, doctor y MCP no hardcodean versión (la heredan de ABRXS_VERSION)',async()=>{
    for(const path of ['apps/service/src/server.ts','scripts/doctor.ts','mcp/server.mjs']){
      const source=await read(path);
      const hardcoded=source.match(/['"]\d+\.\d+\.\d+['"]/g);
      expect(hardcoded,`${path} contiene versiones hardcodeadas: ${hardcoded?.join(', ')}`).toBeNull();
    }
  });
  it('doctor reporta ABRXS_VERSION',async()=>{
    const source=await read('scripts/doctor.ts');
    expect(source).toContain('ABRXS_VERSION');
  });
});

import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { ABRXS_VERSION } from '@abraxas/contracts';

/* PROJECT_STATUS.json es la fuente machine-readable de VAVStatus. Este test
   impide que se pudra el JSON o que se desincronice del producto. */
describe('PROJECT_STATUS.json (fuente de VAVStatus)',()=>{
  const read=async()=>JSON.parse(await readFile(new URL('../docs/PROJECT_STATUS.json',import.meta.url),'utf8'));
  it('JSON válido con schema y campos obligatorios',async()=>{
    const status=await read();
    expect(status.schemaVersion).toBe('abrxs.project-status.v1');
    expect(status.product).toBe('AbrxsVAV');
    expect(status.stableBranch).toBe('main');
    expect(typeof status.developmentBranch).toBe('string');
    expect(status.currentVersion).toBe(ABRXS_VERSION); // misma fuente única
    expect(typeof status.currentMilestone).toBe('string');
    expect(typeof status.nextAction).toBe('string');
    expect(Array.isArray(status.milestones)).toBe(true);
    expect(Array.isArray(status.blockers)).toBe(true);
  });
  it('los estados de módulos usan el vocabulario REAL/PARTIAL/MOCK/PENDING/BLOCKED',async()=>{
    const status=await read();
    const allowed=new Set(['REAL','PARTIAL','MOCK','PENDING','BLOCKED']);
    for(const [module,state] of Object.entries(status.modules as Record<string,string>))
      expect(allowed.has(state),`${module}=${state}`).toBe(true);
  });
});

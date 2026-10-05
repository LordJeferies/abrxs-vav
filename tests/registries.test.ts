import { describe,it,expect } from 'vitest';
import { registries } from '../apps/service/src/registries';
import { buildCoachPlan } from '../apps/service/src/coach';
import { projectSchema } from '@abraxas/contracts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const corpus=projectSchema.parse(JSON.parse(await readFile(join(import.meta.dirname,'..','samples/corpus/corpus-podcast-v1.json'),'utf8')));

describe('Registries modulares',()=>{
 it('expone los 5 catálogos versionados del canon',()=>{
  const ids=registries.map(r=>r.id);
  expect(ids).toEqual(['xr-families','sfx-families','motion-presets','caption-presets','visual-packs']);
  expect(registries.find(r=>r.id==='xr-families')!.entries).toHaveLength(7);
  expect(registries.find(r=>r.id==='sfx-families')!.entries).toHaveLength(13);
  expect(registries.find(r=>r.id==='motion-presets')!.entries).toHaveLength(10);
 });
 it('extender un tipo = agregar una entrada (dato, no código)',()=>{
  const xr=registries.find(r=>r.id==='xr-families')!;
  const extended=[...xr.entries,{id:'xroll.map-route',label:'MAP_ROUTE',note:'nueva familia por datos'}];
  expect(extended).toHaveLength(8);
  expect(extended.at(-1)!.id).toBe('xroll.map-route');
 });
});

describe('Modo Coach',()=>{
 it('compila el grafo en pasos ordenados con qué/cómo/por qué',()=>{
  const plan=buildCoachPlan(corpus,'capcut');
  expect(plan.projectName).toContain('CORPUS');
  expect(plan.steps.length).toBeGreaterThanOrEqual(4);
  expect(plan.steps[0].title).toContain('Monta el clip base');
  expect(plan.steps.map(s=>s.title).join(' ')).toContain('B-roll');
  expect(plan.steps.map(s=>s.title).join(' ')).toContain('X-roll');
  expect(plan.steps.some(s=>s.app.includes('CapCut'))).toBe(true);
  expect(plan.summary).toContain('ghost');
  expect(plan.txt).toContain('PLAN DE MONTAJE');
  expect(plan.txt).toContain('POR QUÉ');
 });
});

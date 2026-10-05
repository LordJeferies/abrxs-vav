import { describe,it,expect } from 'vitest';
import { parseClientTxt, applyDraft, exportAIPackage, importAIResponse, diffProfile, resolveConfig } from '../apps/service/src/clients';
import { analyzeGraph } from '../apps/service/src/qa';
import { clientProfileSchema, projectSchema } from '@abraxas/contracts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const base=clientProfileSchema.parse({schemaVersion:'abrxs.client-profile.v1',clientId:'amanda',name:'Amanda'});
const corpusProject=projectSchema.parse(JSON.parse(await readFile(join(import.meta.dirname,'..','samples/corpus/corpus-podcast-v1.json'),'utf8')));

describe('Client Profiles',()=>{
 it('parses a messy client TXT into facts with confidence',()=>{
  const draft=parseClientTxt(`Cliente: Amanda\n\nColores:\nAzul oscuro #102C46\nDorado #B89A62\n\nFuente principal Montserrat.\n\nB-roll documental y realista.\nNo usar estética futurista.\nLos subtítulos deben verse limpios. Las palabras clave pueden ir doradas.`);
  const keys=draft.facts.map(f=>f.key);
  expect(keys).toContain('name');
  expect(keys).toContain('brand.colors.primary');
  expect(keys).toContain('brand.colors.accent');
  expect(draft.facts.find(f=>f.key==='brand.colors.primary')!.value).toBe('#102C46');
  expect(draft.facts.find(f=>f.key==='brand.colors.primary')!.confidence).toBe('high');
  expect(keys).toContain('negativeRules+');
  expect(draft.facts.some(f=>f.confidence==='medium')).toBe(true);
 });
 it('applies a draft deterministically and diff shows every change',()=>{
  const draft=parseClientTxt('Cliente: Amanda\n#102C46\n#B89A62\nNo usar neones.');
  const after=applyDraft(base,draft);
  const d=diffProfile(base,after);
  expect(d.some(x=>x.field==='brand.colors.primary' && x.to==='#102C46')).toBe(true);
  expect(after.negativeRules.join(' ')).toContain('neones');
 });
 it('AI package roundtrip: import ABRXS CLIENT PROFILE v1 and diff',()=>{
  const pkg=exportAIPackage(base,null,{});
  expect(Object.keys(pkg).filter(k=>k.endsWith('.txt')).length).toBe(7);
  const response=`ABRXS CLIENT PROFILE v1\n\n[CLIENT]\nname = Amanda\n\n[BRAND]\nprimary_color = #102C46\naccent_color = #B89A62\n\n[FONTS]\nprimary = Montserrat\n\n[NEGATIVE_RULES]\n- no futuristic UI`;
  const ai=importAIResponse(response);
  const after=applyDraft(base,ai);
  expect(after.brand.colors.primary).toBe('#102C46');
  expect(after.brand.fonts.primary).toBe('font.montserrat');
  expect(diffProfile(base,after).length).toBeGreaterThan(0);
 });
 it('resolution chain: system → client wins → project overrides client',()=>{
  const amanda=applyDraft(base,parseClientTxt('Cliente: Amanda\n#102C46\n#B89A62\nFuente principal Montserrat.'));
  amanda.broll.density='high';
  const r1=resolveConfig({client:amanda});
  expect(r1.entries.find(e=>e.key==='broll.density')).toMatchObject({value:'high',source:'client'});
  // un valor custom del cliente gana al default del sistema con source 'client'
  amanda.captions.preset='caption.joc.clean.v1';
  expect(resolveConfig({client:amanda}).entries.find(e=>e.key==='captions.preset')).toMatchObject({value:'caption.joc.clean.v1',source:'client'});
  const r2=resolveConfig({client:amanda,projectOverrides:{'broll.density':'low'}});
  expect(r2.entries.find(e=>e.key==='broll.density')).toMatchObject({value:'low',source:'project'});
  // token $colors.accent resuelto al hex real del cliente
  amanda.captions.highlightColor='$colors.accent';
  const r3=resolveConfig({client:amanda});
  expect(r3.entries.find(e=>e.key==='captions.highlightColor')!.value).toBe('#B89A62');
 });
});

describe('QA estructural',()=>{
 it('passes the corpus project (no structural errors)',async()=>{
  const corpus=projectSchema.parse(JSON.parse(await readFile(join(import.meta.dirname,'..','samples/corpus/corpus-podcast-v1.json'),'utf8')));
  const report=analyzeGraph(corpus);
  expect(report.counts.error).toBe(0);
  expect(report.issues.some(i=>i.code==='qa.captions.missing')).toBe(false); // el corpus trae captions
 });
 it('flags overlapping captions and unknown XR family',()=>{
  const broken={...corpusProject, content:{...corpusProject.content, name:'QA roto', graph:{...corpusProject.content.graph, events:[
    {id:'AR01',kind:'a_roll',startFrame:0,endFrame:600,status:'planned'},
    {id:'CAP01',kind:'caption',startFrame:0,endFrame:600,status:'planned'},
    {id:'CAP02',kind:'caption',startFrame:300,endFrame:700,status:'planned'},
    {id:'XR99',kind:'xr',startFrame:0,endFrame:100,status:'planned',visualTypeId:'xroll.map-route@1.0.0'}
  ]}}} as unknown as Parameters<typeof analyzeGraph>[0];
  const report=analyzeGraph(broken);
  expect(report.issues.some(i=>i.code==='qa.collision.caption')).toBe(true);
  expect(report.issues.some(i=>i.code==='qa.unknown.xr_family')).toBe(true);
  expect(report.ok).toBe(false);
 });
});

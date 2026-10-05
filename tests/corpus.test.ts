import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectSchema, visualPlanItemSchema, handoffPackageSchema, actionDefinitionSchema, xrFamilyDefinitionSchema, materializationStrategySchema } from '@abraxas/contracts';

const corpusDir=join(import.meta.dirname,'..','samples','corpus');
const corpus=JSON.parse(await readFile(join(corpusDir,'corpus-podcast-v1.json'),'utf8'));

describe('Corpus sintético (fixture de CI)',()=>{
 it('parses as a valid project v1 with ghost visual events',()=>{
  const project=projectSchema.parse(corpus);
  expect(project.content.graph.events.length).toBeGreaterThanOrEqual(5);
  expect(project.content.graph.events.some(e=>e.status==='ghost'&&!['a_roll','note'].includes(e.kind))).toBe(true);
 });
 it('derives valid contracts v2.3 objects from the corpus events',()=>{
  const br=corpus.content.graph.events.find((e:{id:string})=>e.id==='BR01_tokyo');
  const item=visualPlanItemSchema.parse({
    id:'vpi_BR01',pieceId:'C01',kind:'b_roll',startFrame:br.startFrame,endFrame:br.endFrame,
    purpose:br.extensions.purpose,anchorText:br.extensions.anchorText,brollType:br.extensions.brollType,
    assetSlots:[{id:'A01',type:'image',prompt:'tokyo night rain vertical, cinematic',negative:'people, watermark'}],
    materialization:materializationStrategySchema.parse({mode:'native_api',providerId:'pexels',fallbacks:['manual_handoff']})
  });
  expect(item.status).toBe('proposed');
  const pkg=handoffPackageSchema.parse({
    id:'hp_BR01',targetKind:'visual_item',targetRef:item.id,providerHint:'kling',
    prompt:item.assetSlots[0].prompt!,expectedFilename:'BR01_tokyo-night.mp4',createdAt:new Date().toISOString()
  });
  expect(pkg.outputSpec.aspectRatio).toBe('9:16');
 });
 it('validates an XR family definition and an action definition',()=>{
  const family=xrFamilyDefinitionSchema.parse({
    id:'xroll.comic-info@1.2.0',family:'COMIC_INFO',version:'1.2.0',durationSec:{min:6,max:14},
    states:[{id:'S01',cameraMove:'push_in',durationFrames:60},{id:'S02',cameraMove:'pan_ll_lr',durationFrames:54}],
    sfxRoles:['SFX_WHOOSH'],requires:['renderer.ffmpeg']
  });
  expect(family.captionPolicy).toBe('none');
  const action=actionDefinitionSchema.parse({
    name:'vav.jobs.create',module:'activity',summary:'Encola un trabajo.',method:'POST',path:'/api/jobs',since:'0.4.0'
  });
  expect(action.destructive).toBe(false);
  expect(actionDefinitionSchema.safeParse({name:'shell.exec',module:'x',summary:'x',method:'GET',path:'/',since:'0'}).success).toBe(false);
 });
});

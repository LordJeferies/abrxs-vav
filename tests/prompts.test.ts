import { describe,it,expect } from 'vitest';
import { enhancePrompt, buildHandoff, CAMERAS, MOTION_PHRASES, BASE_NEGATIVE } from '@abraxas/prompts';

describe('Prompt Studio — motor de mejora',()=>{
 const subject='a dentist walking into an empty clinic at night';
 it('keeps the subject VERBATIM at every intensity (sujeto intacto)',()=>{
  for(const i of [1,2,3] as const){
   const r=enhancePrompt(subject,i,{camera:'arri-alexa-35',atmosphere:'rain',motion:'ZOOM_IN'});
   expect(r.prompt.startsWith(subject)).toBe(true);
   expect(r.subject).toBe(subject);
  }
 });
 it('adds layers by intensity budget',()=>{
  const r1=enhancePrompt(subject,1);
  const r3=enhancePrompt(subject,3,{camera:'imax-65',atmosphere:'haze',motion:'ZOOM_IN_PAN'});
  expect(r1.appliedLayers.length).toBeLessThan(r3.appliedLayers.length);
  expect(r3.prompt).toContain('IMAX 65mm');
  expect(r3.prompt).toContain('atmospheric haze');
  expect(r3.prompt).toContain(MOTION_PHRASES.ZOOM_IN_PAN);
 });
 it('throws on empty subject and always includes the negative',()=>{
  expect(()=>enhancePrompt('   ',1)).toThrow('sujeto');
  expect(enhancePrompt(subject,1).negative).toBe(BASE_NEGATIVE);
 });
 it('builds a HandoffPackage that any AI can consume',()=>{
  const r=enhancePrompt(subject,2,{motion:'SLOW_DRIFT'});
  const pkg=buildHandoff(r,{targetRef:'XR01',providerHint:'kling',aspectRatio:'9:16',durationSec:8,expectedFilename:'XR01_clinic-night.mp4'});
  expect(pkg.prompt.startsWith(subject)).toBe(true);
  expect(pkg.expectedFilename).toBe('XR01_clinic-night.mp4');
  expect(pkg.outputSpec.durationSec).toBe(8);
  expect(pkg.returnInstructions).toContain('Import Result');
  expect(pkg.providerHint).toBe('kling'); // el header de formato va en el .txt, no en el prompt limpio
 });
 it('catalogs expose reference hints for visual wizards',()=>{
  expect(CAMERAS.every(c=>!!c.label&&!!c.phrase)).toBe(true);
  expect(CAMERAS.some(c=>c.ref)).toBe(true);
 });
});

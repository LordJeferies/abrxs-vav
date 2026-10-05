import { describe,it,expect } from 'vitest';
import { compileComposition, layerKeyframes, layerFfmpeg, ZOOM_MAX, type CompositionSpec } from '@abraxas/motion';

const base: CompositionSpec = {
  id: 'comp_ep55_xr03', fps: 30, width: 1080, height: 1920, durationFrames: 300,
  layers: [
    { id: 'BG_master', kind: 'image', assetUri: 'assets/comic-info-master.png', startFrame: 0, endFrame: 300, motion: 'ZOOM_IN', z: 0 },
    { id: 'TXT_checklist', kind: 'text', text: 'REVÁLIDA: 3 fuentes, 0 consenso', startFrame: 30, endFrame: 180, motion: 'PAN_UP', fontSize: 64, z: 2 },
    { id: 'IMG_foto', kind: 'image', assetUri: 'assets/clinic-night.png', startFrame: 60, endFrame: 240, motion: 'SLOW_DRIFT', z: 1, opacity: 0.9 },
  ]
};

describe('Motion Composer (imágenes en capas → animación determinista)',()=>{
 it('compiles layers sorted by z with 3 deterministic keyframes each',()=>{
  const spec=compileComposition(base);
  expect(spec.specVersion).toBe('abrxs.motion-render.v1');
  expect(spec.layers.map(l=>l.id)).toEqual(['BG_master','IMG_foto','TXT_checklist']);
  for(const l of spec.layers){
   expect(l.keyframes).toHaveLength(3);
   expect(l.keyframes[0].frame).toBeLessThan(l.keyframes[2].frame);
  }
 });
 it('ZOOM_IN goes 1.0→1.12 with ease-in-out (midpoint slower than linear)',()=>{
  const kfs=layerKeyframes({...base.layers[0],motion:'ZOOM_IN'},base);
  expect(kfs[0].scale).toBe(1);expect(kfs[2].scale).toBe(1.12);
  const linearMid=1.06, mid=kfs[1].scale;
  expect(Math.abs(mid-linearMid)).toBeLessThan(0.004); // ease-in-out cúbico ≈ lineal al 50%
  expect(kfs.every(k=>k.scale<=ZOOM_MAX)).toBe(true);
 });
 it('clamps zoom to the canon ZOOM_MAX 1.18 and rejects scaleTo beyond it',()=>{
  expect(()=>compileComposition({...base,layers:[{...base.layers[0],scaleTo:1.3}]})).toThrow(/ZOOM_MAX/);
  const clamped=layerKeyframes({...base.layers[0],scaleTo:9},base);
  expect(clamped.every(k=>k.scale<=ZOOM_MAX)).toBe(true);
 });
 it('PAN presets move the origin toward the named side',()=>{
  const left=layerKeyframes({...base.layers[0],motion:'PAN_LEFT'},base);
  expect(left[2].x).toBeLessThan(left[0].x);
  const up=layerKeyframes({...base.layers[0],motion:'PAN_UP'},base);
  expect(up[2].y).toBeLessThan(up[0].y);
 });
 it('emits valid FFmpeg zoompan per image layer and skips text',()=>{
  const spec=compileComposition(base);
  expect(spec.ffmpeg).toHaveLength(2);
  const cmd=layerFfmpeg(base.layers[0],base)!;
  expect(cmd).toContain('zoompan');
  expect(cmd).toContain('1080x1920');
  expect(cmd).toContain('fps=30');
  expect(cmd).toContain('-pix_fmt yuv420p');
  expect(layerFfmpeg(base.layers[1],base)).toBeNull(); // text → Remotion, no ffmpeg
 });
 it('validates ranges [in,out) and layer requirements',()=>{
  expect(()=>compileComposition({...base,layers:[{...base.layers[0],endFrame:0}]})).toThrow(/endFrame/);
  expect(()=>compileComposition({...base,layers:[{...base.layers[0],endFrame:301}]})).toThrow(/rango/);
  expect(()=>compileComposition({...base,layers:[{id:'X',kind:'image',startFrame:0,endFrame:10}]})).toThrow(/assetUri/);
  expect(()=>compileComposition({...base,layers:[{id:'X',kind:'text',text:'hola',startFrame:0,endFrame:10},{...base.layers[0]}]})).not.toThrow();
 });
});

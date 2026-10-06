/* ═══ M3 — AssetStore + ClientProfile v1.1 + vínculo proyecto→cliente ═══ */
import { describe,it,expect,afterEach } from 'vitest';
import { mkdtemp,rm,writeFile,stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { assetSchema,clientProfileSchema,projectContentSchema } from '@abraxas/contracts';
import { EntityRepository } from '../apps/service/src/entity-repository';
import { registerAsset,deleteAsset } from '../apps/service/src/assets';
import { ProjectStore } from '@abraxas/core';
import { FileRepository } from '../apps/service/src/file-repository';
import { diffProfile } from '../apps/service/src/clients';

const dirs:string[]=[];
afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
const makeStores=async()=>{
  const dir=await mkdtemp(join(tmpdir(),'abrxs-assets-'));dirs.push(dir);
  const assets=new EntityRepository(join(dir,'entities','assets.json'),assetSchema,'abrxs.assets.v1');
  await assets.init();
  return {dir,assets};
};

describe('AssetStore (M3)',()=>{
  it('registra un archivo real: kind por extensión, hash streaming correcto, tamaño',async()=>{
    const {dir,assets}=await makeStores();
    const file=join(dir,'logo.png');
    const bytes=Buffer.from('PNGDATA-TEST-12345');
    await writeFile(file,bytes);
    const {asset,created}=await registerAsset({assets},{label:'Logo cliente',path:file,clientId:'acme',provenance:{origin:'client'}});
    expect(created).toBe(true);
    expect(asset.id).toBe('A01');
    expect(asset.kind).toBe('image');
    expect(asset.hash).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(asset.hashAlgorithm).toBe('sha256');
    expect(asset.sizeBytes).toBe(bytes.length);
    expect(asset.clientId).toBe('acme');
    expect(asset.provenance.origin).toBe('client');
    expect(await assets.get('A01')).toBeTruthy();
  });
  it('registro IDEMPOTENTE: mismo ref+hash devuelve el asset existente (sin duplicados)',async()=>{
    const {dir,assets}=await makeStores();
    const file=join(dir,'broll.mp4');
    await writeFile(file,'video-bytes');
    const a=await registerAsset({assets},{label:'B-roll',path:file});
    const b=await registerAsset({assets},{label:'B-roll (otra vez)',path:file});
    expect(b.created).toBe(false);
    expect(b.asset.id).toBe(a.asset.id);
    expect((await assets.list())).toHaveLength(1);
  });
  it('archivo inexistente → error claro sin crear nada',async()=>{
    const {assets}=await makeStores();
    await expect(registerAsset({assets},{label:'Fantasma',path:'/no/existe.mp4'})).rejects.toThrow(/no existe/);
    expect(await assets.list()).toHaveLength(0);
  });
  it('delete: quita el registro (el archivo queda en disco), inexistente → false',async()=>{
    const {dir,assets}=await makeStores();
    const file=join(dir,'a.jpg');
    await writeFile(file,'x');
    const {asset}=await registerAsset({assets},{label:'A',path:file});
    expect(await deleteAsset({assets},asset.id)).toBe(true);
    expect(await assets.get(asset.id)).toBeNull();
    expect(await deleteAsset({assets},asset.id)).toBe(false);
    await expect(stat(file)).resolves.toBeTruthy(); // archivo intacto
  });
  it('IDs sin reciclar tras delete: el nuevo asset NUNCA reutiliza A01',async()=>{
    const {dir,assets}=await makeStores();
    const f1=join(dir,'uno.png');await writeFile(f1,'uno');
    const f2=join(dir,'dos.png');await writeFile(f2,'dos');
    const a=await registerAsset({assets},{label:'1',path:f1});
    await registerAsset({assets},{label:'2',path:f2});
    await deleteAsset({assets},a.asset.id);           // borra A01
    const f3=join(dir,'tres.png');await writeFile(f3,'tres');
    const c=await registerAsset({assets},{label:'3',path:f3});
    expect(c.asset.id).toBe('A03');                   // max+1: A01 jamás se recicla
  });
});

describe('ClientProfile v1.1 (aditivo: voice/audience/logos)',()=>{
  it('perfil LEGADO sin los campos nuevos sigue validando (backwards compat)',()=>{
    const legacy={schemaVersion:'abrxs.client-profile.v1',clientId:'acme',name:'ACME',brand:{},captions:{},broll:{},xroll:{},sfx:{},glossary:[],negativeRules:[],editorialRules:[],platformProfiles:{}};
    const profile=clientProfileSchema.parse(legacy);
    expect(profile.voice).toBeUndefined();
    expect(profile.logos).toEqual([]);
  });
  it('perfil NUEVO con voice/audience/logos valida (logos = refs, jamás binarios)',()=>{
    const profile=clientProfileSchema.parse({schemaVersion:'abrxs.client-profile.v1',clientId:'acme',name:'ACME',
      voice:'Cercano pero experto; tuteo',audience:'Empresas logística 30-50',
      logos:[{label:'Principal',ref:'/brand/acme/logo.png'},{label:'Mono blanco',ref:'/brand/acme/logo-white.png'}]});
    expect(profile.logos).toHaveLength(2);
    expect(profile.voice).toContain('experto');
  });
  it('diffProfile detecta los campos nuevos entre perfiles',()=>{
    const before=clientProfileSchema.parse({schemaVersion:'abrxs.client-profile.v1',clientId:'acme',name:'ACME'});
    const after=clientProfileSchema.parse({...before,voice:'Nueva voz',logos:[{label:'L',ref:'/l.png'}]});
    const diff=diffProfile(before,after);
    expect(JSON.stringify(diff)).toContain('voice');
    expect(JSON.stringify(diff)).toContain('logos');
  });
});

describe('Vínculo proyecto→cliente (projectContent.clientId, aditivo)',()=>{
  it('contenido con clientId valida y persiste vía ProjectStore CAS',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'abrxs-projclient-'));dirs.push(dir);
    const projects=new FileRepository(join(dir,'projects2'),(await import('@abraxas/contracts')).projectSchema);await projects.init();
    const store=new ProjectStore(projects);
    const project=await store.create('Con cliente',{fpsNumerator:30000,fpsDenominator:1001});
    const content={...project.content,clientId:'acme'};
    const edited=await store.edit(project.id,project.revision,'Vincular ACME',content);
    expect(edited.content.clientId).toBe('acme');
    const reopened=new ProjectStore(new FileRepository(join(dir,'projects2'),(await import('@abraxas/contracts')).projectSchema));
    expect((await reopened.get(project.id)).content.clientId).toBe('acme');
    // desvincular
    const cleared=await store.edit(project.id,edited.revision,'Desvincular',{...edited.content,clientId:undefined});
    expect(cleared.content.clientId).toBeUndefined();
  });
  it('graph intacto: el contenido con clientId sigue siendo un projectContent válido',()=>{
    expect(projectContentSchema.parse({name:'X',graph:{schemaVersion:'abraxas.production-graph.v2',projectId:'x',
      timebase:{fpsNumerator:24,fpsDenominator:1},events:[]},clientId:'c'}).clientId).toBe('c');
  });
});

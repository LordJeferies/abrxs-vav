import { resolve } from 'node:path';
import { readdir } from 'node:fs/promises';
import { projectSchema,jobSchema,ABRXS_VERSION } from '@abraxas/contracts';
import { FileRepository } from '../apps/service/src/file-repository';
import { runMediaChecks } from './doctor-media';
const directory=resolve(process.env.ABRAXAS_DATA_DIR||'.abraxas-data');
const reports:Array<{check:string;status:string;detail:string}>=[];
reports.push({check:'Node',status:Number(process.versions.node.split('.')[0])>=22?'PASS':'FAIL',detail:process.versions.node});
for(const [name,schema] of [['projects',projectSchema],['jobs',jobSchema]] as const){
 const path=resolve(directory,name);
 try{await readdir(path);const repository=new FileRepository(path,schema as typeof projectSchema);const records=await repository.list();reports.push({check:name,status:'PASS',detail:`${records.length} registros válidos`});}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')reports.push({check:name,status:'NOT_CREATED',detail:'Se creará al iniciar el servicio.'});else reports.push({check:name,status:'FAIL',detail:error instanceof Error?error.message:'Error de lectura'});}
}
reports.push(...await runMediaChecks());
console.log(JSON.stringify({version:ABRXS_VERSION,scope:'Node, almacenamiento (projects/jobs) y capacidades locales de media: ffmpeg/ffprobe, temp, disk, decode (mpeg4), encode H264, whisper.cpp (binario+modelo) y mlx_whisper (CLI+modelo cacheado); no certifica providers AI, ComfyUI, Tauri ni NLEs.',reports},null,2));
if(reports.some(r=>r.status==='FAIL'))process.exitCode=1;

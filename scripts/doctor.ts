import { resolve } from 'node:path';
import { readdir } from 'node:fs/promises';
import { projectSchema,jobSchema } from '@abraxas/contracts';
import { FileRepository } from '../apps/service/src/file-repository';
const directory=resolve(process.env.ABRAXAS_DATA_DIR||'.abraxas-data');
const reports:Array<{check:string;status:string;detail:string}>=[];
reports.push({check:'Node',status:Number(process.versions.node.split('.')[0])>=22?'PASS':'FAIL',detail:process.versions.node});
for(const [name,schema] of [['projects',projectSchema],['jobs',jobSchema]] as const){
 const path=resolve(directory,name);
 try{await readdir(path);const repository=new FileRepository(path,schema as typeof projectSchema);const records=await repository.list();reports.push({check:name,status:'PASS',detail:`${records.length} registros válidos`});}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')reports.push({check:name,status:'NOT_CREATED',detail:'Se creará al iniciar el servicio.'});else reports.push({check:name,status:'FAIL',detail:error instanceof Error?error.message:'Error de lectura'});}
}
console.log(JSON.stringify({version:'0.2.0',scope:'Node e integridad del almacenamiento; no certifica FFmpeg, modelos, Tauri ni render.',reports},null,2));
if(reports.some(r=>r.status==='FAIL'))process.exitCode=1;

import { mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Repository } from '@abraxas/core';
import type { z } from 'zod';

export async function atomicWrite(path:string,data:string,beforeRename?:()=>Promise<void>){
  const temp=`${path}.${crypto.randomUUID()}.tmp`;
  try{
    const handle=await open(temp,'wx',0o600);
    try{await handle.writeFile(data,'utf8');await handle.sync();}finally{await handle.close();}
    await beforeRename?.(); await rename(temp,path);
    // fsync the directory as well as the file for crash durability on local POSIX filesystems.
    const directory=await open(join(path,'..'),'r');try{await directory.sync();}finally{await directory.close();}
  }finally{await unlink(temp).catch(()=>{});}
}
export class FileRepository<T extends {id:string}> implements Repository<T>{
  constructor(readonly directory:string,private schema:z.ZodType<T>){}
  async init(){await mkdir(this.directory,{recursive:true,mode:0o700});}
  private path(id:string){if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Identificador inválido.');return join(this.directory,`${id}.json`);}
  async get(id:string):Promise<T|null>{
    let text:string;try{text=await readFile(this.path(id),'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
    try{const value=this.schema.parse(JSON.parse(text));if(value.id!==id)throw new Error('Identidad incorrecta.');return value;}catch{throw new Error(`Archivo ${id}.json inválido o con versión incompatible. Se conserva sin cambios; revisa su copia .bak.`);}
  }
  async list():Promise<T[]>{const files=await readdir(this.directory);const values:T[]=[];for(const file of files.filter(f=>/^[0-9a-f-]{36}\.json$/i.test(f))){const value=await this.get(file.slice(0,-5));if(value!==null)values.push(value);}return values;}
  async put(id:string,value:T){
    const validated=this.schema.parse(value);if(validated.id!==id)throw new Error('Identidad incorrecta.');
    const path=this.path(id),previous=await this.get(id);
    if(previous)await atomicWrite(`${path}.bak`,JSON.stringify(previous,null,2));
    await atomicWrite(path,JSON.stringify(validated,null,2));
  }
}

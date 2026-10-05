import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import { graphSchema, jobSchema, projectSchema, operationSchema, pieceSchema, mediaSourceSchema } from '@abraxas/contracts';
const schemas={
 'production-graph.v2':graphSchema,'job.v2':jobSchema,'project.v1':projectSchema,'operation.v1':operationSchema,
 'piece.v1':pieceSchema,'media-source.v1':mediaSourceSchema
};
for(const [name,schema] of Object.entries(schemas)){
 const json=z.toJSONSchema(schema);const value=JSON.stringify({...json,$id:`https://abraxas.local/schemas/${name}.json`},null,2)+'\n';
 const path=new URL(`../contracts/${name}.schema.json`,import.meta.url);
 if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==value)throw new Error(`Schema desactualizado: ${name}. Ejecuta npm run contracts:generate.`);}
 else await writeFile(path,value);
}
console.log('Contratos de runtime y JSON Schema sincronizados.');

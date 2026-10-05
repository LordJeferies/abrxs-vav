import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
const ajv=new Ajv2020({strict:false,allErrors:true,validateFormats:false});
const directory=new URL('../contracts/',import.meta.url);const validators=new Map();
for(const name of fs.readdirSync(directory).filter(x=>x.endsWith('.schema.json'))){const schema=JSON.parse(fs.readFileSync(new URL(name,directory),'utf8'));validators.set(name,ajv.compile(schema));console.log('✓ schema',name);}
const cases=[['project.sample.json','production-graph.v2.schema.json'],['client.sample.json','client-profile.v1.schema.json'],['project-record.sample.json','project.v1.schema.json'],['job.sample.json','job.v2.schema.json']];
for(const [sample,schemaName] of cases){const validate=validators.get(schemaName);const value=JSON.parse(fs.readFileSync(new URL('../samples/'+sample,import.meta.url),'utf8'));if(!validate(value))throw new Error(`${sample}: ${ajv.errorsText(validate.errors)}`);console.log('✓ fixture',sample);}

import fs from 'node:fs';
const required=['README.md','AGENTS.md','WORK_START_PROMPT.md','apps/desktop/src/App.tsx','contracts/production-graph.v2.schema.json','references/REFERENCE_SOURCES.md'];
let ok=true; for(const f of required){if(!fs.existsSync(f)){console.error('missing',f);ok=false}else console.log('✓',f)}
for(const f of fs.readdirSync('contracts').filter(x=>x.endsWith('.json'))){try{JSON.parse(fs.readFileSync('contracts/'+f,'utf8'));console.log('✓ json',f)}catch(e){console.error('bad json',f,e.message);ok=false}}
if(!ok)process.exit(1);

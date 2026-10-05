import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm,mkdir } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url)),port=4318,base=`http://127.0.0.1:${port}`;
const data=await mkdtemp(join(tmpdir(),'abraxas-ui-')),artifacts=resolve(process.env.ABRAXAS_UI_ARTIFACT_DIR||join(tmpdir(),'abraxas-ui-artifacts'));
await mkdir(artifacts,{recursive:true});
let service,browser;let consoleErrors=[];
async function start(){
 service=spawn(process.execPath,['--import','tsx','apps/service/src/server.ts'],{cwd:root,env:{...process.env,ABRAXAS_PORT:String(port),ABRAXAS_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
 let logs='';service.stdout.on('data',d=>logs+=d);service.stderr.on('data',d=>logs+=d);
 for(let i=0;i<100;i++){try{if((await fetch(`${base}/api/health`)).ok)return;}catch{}if(service.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,50));}
 throw new Error(`Service startup timeout: ${logs}`);
}
async function stop(){if(service&&service.exitCode===null){const done=new Promise(r=>service.once('exit',r));service.kill('SIGTERM');await done;}}
async function api(path,method='GET',body,headers={}){return fetch(`${base}/api/${path}`,{method,headers:{'Content-Type':'application/json','X-Abraxas-Client':'local',...headers},body:body===undefined?undefined:JSON.stringify(body)});}
try{
 await start();browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>consoleErrors.push(e.message));
 await page.goto(base);await page.getByLabel('Nombre',{exact:true}).fill('JOC · QA Foundation');
 await page.getByLabel('Fotogramas por segundo').selectOption('30000/1001');await page.getByRole('button',{name:'Crear y abrir'}).click();
 await page.locator('.editor').waitFor();await page.getByRole('button',{name:'+ Añadir evento'}).click();
 await page.getByLabel('Inicio (frames)').fill('30');await page.getByLabel('Final exclusivo (frames)').fill('60');await page.getByLabel('IDs de recursos').fill('BR01.mp4');
 await page.getByRole('button',{name:'Guardar evento'}).click();await page.locator('tbody tr').waitFor();
 assert.equal(await page.locator('tbody tr').count(),1);
 await page.getByRole('button',{name:/Deshacer/}).click();await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===0);
 await page.getByRole('button',{name:/Rehacer/}).click();await page.locator('tbody tr').waitFor();
 await page.reload();await page.locator('tbody tr').waitFor();assert.equal(await page.locator('tbody tr').count(),1);
 await page.getByRole('button',{name:'Validar estructura'}).click();await page.getByRole('button',{name:'Activity Jobs'}).click();
 await page.locator('.job .completed').waitFor();await page.getByRole('button',{name:'Ver resultado'}).click();assert.match(await page.locator('pre').innerText(),/passed/);
 await page.getByRole('button',{name:'Crear instrucciones TXT'}).click();await page.waitForFunction(()=>document.querySelectorAll('.job .completed').length===2);
 const jobs=await (await api('jobs')).json();assert.equal(jobs.length,2);assert.match(jobs.find(j=>j.kind==='project.edit-plan').output,/1.001–2.002 s/);
 const projects=await (await api('projects')).json(),project=projects[0];
 assert.equal((await api(`projects/${project.id}`,'PUT',{revision:0,label:'Stale',content:{...project.content,name:'stale'}})).status,409);
 assert.equal((await api('projects','POST',{name:'Evil',timebase:{fpsNumerator:30,fpsDenominator:1}},{Origin:'https://example.com'})).status,403);
 assert.equal((await fetch(`${base}/api/projects`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 await stop();await start();await page.reload();await page.locator('tbody tr').waitFor();assert.equal(await page.locator('tbody tr').count(),1);
 await page.screenshot({path:join(artifacts,'hub-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Activity Jobs'}).click();await page.locator('.job .completed').first().waitFor();assert.equal(await page.locator('.job .completed').count(),2);
 await page.screenshot({path:join(artifacts,'activity-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Project Hub Estado'}).click();await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflows mobile viewport');
 await page.screenshot({path:join(artifacts,'hub-mobile.png'),fullPage:true});
 assert.deepEqual(consoleErrors,[]);console.log('PASS UI/API: create, event edit, undo/redo, reload, validation, TXT, stale revision, origin guard, service restart, mobile layout.');console.log(`QA screenshots: ${artifacts}`);
}finally{await browser?.close();await stop();await rm(data,{recursive:true,force:true});}

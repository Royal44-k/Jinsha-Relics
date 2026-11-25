// Exercise the extracted archive and its own redistributable HTTP server.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const [unpacked,reportPath]=process.argv.slice(2);
const server=spawn(process.execPath,['local-server.cjs','--no-open'],{cwd:unpacked,env:{...process.env,JINSHA_PORT:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let browser;
try{
 const origin=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Local server did not start')),15000);
  server.stdout.once('data',chunk=>{clearTimeout(timeout);resolve(chunk.toString().trim());});
  server.once('exit',code=>{clearTimeout(timeout);reject(Error('Local server exit '+code));});
 });
 const edge=process.env.JINSHA_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
 browser=await chromium.launch({headless:true,executablePath:edge});
 const page=await browser.newPage({viewport:{width:1280,height:800},acceptDownloads:true});
 const errors=[],bad=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),new URL(r.url()).pathname]);});
 page.on('request',r=>{if(r.url().startsWith('http')&&!r.url().startsWith(origin))external.push(r.url());});
 await page.addInitScript(()=>{
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(dest,...args){
   const result=connect.call(this,dest,...args);
   if(dest===this.context.destination&&!window.releaseAudioMeter){
    const meter=this.context.createAnalyser();meter.fftSize=1024;
    connect.call(this,meter);window.releaseAudioMeter=meter;
   }
   return result;
  };
 });
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 assert.equal(await page.title(),'金沙：古蜀秘境');
 await page.getByRole('button',{name:'全屏体验',exact:true}).click();
 await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);
 await page.getByRole('button',{name:'退出全屏',exact:true}).click();
 await page.waitForFunction(()=>!document.fullscreenElement);
 await page.locator('#cover-sound').click();
 await page.getByRole('radio',{name:'只听人声'}).check();
 const voices=[];
 for(const [role,id] of [['narrator','intro-n'],['spirit','intro-s']]){
  const response=page.waitForResponse(r=>r.url().endsWith('/'+id+'.wav')&&r.status()===200);
  await page.locator('[data-preview="'+role+'"]').click();
  const sound=await response;
  const pcm=await sound.body();assert.equal(pcm.toString('ascii',0,4),'RIFF');assert.ok(pcm.length>40000);
  await page.waitForFunction(()=>{
   const meter=window.releaseAudioMeter;if(!meter)return false;
   const frames=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(frames);
   return frames.some(x=>Math.abs(x)>.01);
  },null,{timeout:15000});
  voices.push({id,bytes:pcm.length,fromGameAudio:true});
 }
 await page.getByRole('radio',{name:'人声优先'}).check();
 await page.locator('.listening-close').click();
 await page.locator('#enter').click();
 await page.locator('#folio.prologue-open').waitFor();
 await page.getByRole('button',{name:'西台烟火'}).click();
 await page.locator('.witness img').evaluate(i=>i.decode());
 await page.getByRole('button',{name:'落到探方边'}).click();
 await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().mode==='travel'&&window.__JINSHA_SURVEY__.snapshot().motion.drawCalls>0,null,{timeout:80000});
 const before=await page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().motion.position);
 await page.keyboard.down('w');
 await page.waitForFunction(p=>window.__JINSHA_SURVEY__.snapshot().motion.position.some((v,i)=>Math.abs(p[i]-v)>.12),before);
 await page.keyboard.up('w');await page.keyboard.press('p');
 const photo=page.locator('dialog.field-photo[open]');
 await photo.locator('select').selectOption('.5625');
 await photo.locator('canvas').focus();await page.keyboard.press('ArrowRight');
 const downloaded=page.waitForEvent('download');await photo.locator('.photo-save').click();await downloaded;
 const printSize=await photo.locator('[role=status] a').evaluate(async a=>{const b=await createImageBitmap(await (await fetch(a.href)).blob());return [b.width,b.height];});
 assert.deepEqual(printSize,[1080,1920]);
 await photo.locator('[data-close]').click();await page.keyboard.press('j');
 await page.getByRole('button',{name:'证据推理台',exact:true}).click();
 const cases=page.locator('dialog.investigation-desk[open] .iv-case');
 await cases.first().waitFor();
 assert.equal(await cases.count(),4);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.iv-case img')).every(i=>i.complete&&i.naturalWidth));
 for(const local of ['credits-v10.html','references.html','licenses/three.txt','fonts/OFL.txt']){
  const r=await page.request.get(new URL(local,origin).href);assert.equal(r.status(),200);
 }
 const saved={entry:await page.title(),fullscreenEnterExit:true,newJourney:true,realMovement:true,voices,photoExport:printSize,evidenceCases:await cases.count(),
   externalRequests:external,failedResponses:bad,pageErrors:errors};
 assert.deepEqual(external,[]);assert.deepEqual(bad,[]);assert.deepEqual(errors,[]);
 await writeFile(reportPath,JSON.stringify(saved,null,2));
}finally{await browser?.close();server.kill();}

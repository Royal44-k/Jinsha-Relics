import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const server=process.env.JINSHA_ORIGIN?null:await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
if(server)await server.listen();
const origin=process.env.JINSHA_ORIGIN||server.resolvedUrls.local[0];
const out='docs/v12/traversal';
await mkdir(out,{recursive:true});
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
const page=await browser.newPage({viewport:{width:1040,height:650},reducedMotion:'reduce'});
const errors=[],report={origin:process.env.JINSHA_ORIGIN||'Vite game homepage',input:'New browser context; normal menu, keyboard, and game buttons only',checks:[],errors};
page.setDefaultTimeout(80000);
page.on('pageerror',e=>errors.push(String(e)));
const state=()=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().motion);
const wrap=n=>Math.atan2(Math.sin(n),Math.cos(n));
async function face(target){
  for(let attempt=0;attempt<8;attempt++){
    const current=await state(),diff=wrap(target-current.yaw);
    if(Math.abs(diff)<.024)return;
    const key=diff<0?'d':'a';
    await page.keyboard.down(key);await page.waitForTimeout(Math.max(20,Math.min(420,Math.abs(diff)*425)));await page.keyboard.up(key);
  }
}
async function hold(key,ms){
  await page.keyboard.down(key);try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}
}
async function markSite(label){
  await page.locator('#notebook').click();
  await page.locator('summary').filter({hasText:'地图支线'}).click();
  await page.getByRole('button',{name:'标记 · '+label,exact:true}).click();
  await page.locator('#guide').click();
  await page.waitForFunction(name=>!document.querySelector('#interact').hidden&&document.querySelector('#interact').textContent.includes(name)&&document.querySelector('#guide').textContent==='循迹领航',label,{timeout:90000});
}
try{
  await page.goto(origin);await page.locator('#enter').click();
  await page.getByRole('button',{name:'落到探方边'}).click();await page.waitForFunction(()=>document.body.dataset.mode==='travel');
  const basket={x:-8.02,z:34.51};
  const dist=pos=>Math.hypot(pos[0]-basket.x,pos[2]-basket.z);
  let bird=await state();
  await face(Math.atan2(bird.position[0]-basket.x,bird.position[2]-basket.z));
  await page.evaluate(()=>{const t=window.__travelSample={points:[],intervals:[],last:0};
    function read(stamp){if(!t.finished){t.points.push(window.__JINSHA_SURVEY__.snapshot().motion.position);if(t.last)t.intervals.push(stamp-t.last);t.last=stamp;requestAnimationFrame(read);}}requestAnimationFrame(read);});
  await page.keyboard.down('w');
  await page.waitForFunction(b=>{const p=window.__JINSHA_SURVEY__.snapshot().motion.position;return Math.hypot(p[0]-b.x,p[2]-b.z)<.74;},basket,{timeout:18000});
  await page.keyboard.up('w');await page.waitForTimeout(160);
  bird=await state();await face(Math.atan2(bird.position[0]-basket.x,bird.position[2]-basket.z));
  await hold('w',190);
  await page.screenshot({path:join(out,'trench-basket.jpg'),type:'jpeg',quality:84});
  await page.keyboard.press('x');await page.waitForTimeout(650);await page.keyboard.up('w');
  const contact=await state(),samples=await page.evaluate(()=>{window.__travelSample.finished=true;return window.__travelSample;});
  const closest=Math.min(...samples.points.map(dist));
  assert.ok(closest>=.604&&closest<=.67,'nearest basket approach '+closest);
  samples.intervals.sort((a,b)=>a-b);
  report.checks.push({action:'Walk at the woven sieve, then dash against it',position:contact.position,nearest:closest,bodyPlusBasketRadius:.62,
    sampledFrames:samples.points.length,medianMs:samples.intervals[Math.floor(samples.intervals.length*.5)],p95Ms:samples.intervals[Math.floor(samples.intervals.length*.95)]});
  await face(contact.yaw+Math.PI*.5);await hold('w',650);
  const aside=await state();assert.ok(dist(aside.position)>1.1);
  report.checks.push({action:'Turn and walk around the blocked side',position:aside.position});
  await markSite('西岸织棚');
  const west=await state();assert.ok(Math.hypot(west.position[0]+43,west.position[2]-25.7)<.28);
  await page.keyboard.press('r');
  await page.waitForFunction(()=>!document.querySelector('#perch').hidden&&document.querySelector('#perch').textContent.includes('织棚老树横枝'));
  await page.keyboard.press('t');
  await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.mode==='perched',null,{timeout:14000});
  report.checks.push({action:'Route to the weaving shed and perch on the living branch',position:(await state()).position});
  await page.screenshot({path:join(out,'west-perch.jpg'),type:'jpeg',quality:84});
  await page.keyboard.press('t');
  await markSite('东台石场');report.checks.push({action:'Fly from the branch to the quarry',position:(await state()).position});
  await markSite('北汊渔地');
  await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.mode==='swimming');
  await page.keyboard.down('c');await page.waitForFunction(()=>{const m=window.__JINSHA_SURVEY__.snapshot().motion;return m.mode==='diving'&&m.position[1]<-.65;});
  const water=await state();await page.keyboard.up('c');
  report.checks.push({action:'Reach the north channel and dive below the waterline',position:water.position});
  assert.deepEqual(errors,[]);report.passed=true;
}catch(error){report.error=String(error);report.last=await state().catch(()=>null);await page.screenshot({path:join(out,'failure.jpg')}).catch(()=>{});throw error;}
finally{await writeFile(join(out,'travel.json'),JSON.stringify(report,null,2));await browser.close();await server?.close();}

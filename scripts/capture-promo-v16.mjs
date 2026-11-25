// Capture live DOM/WebGL pixels from the normal game and its chapter menu.
// Checkpoint exists only in a disposable browser context. No shipped CSS,
// scene, camera or animation is replaced for filming.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chapterIds,saveKey} from '../src/v10/ledger.js';
import {createServer} from 'vite';
import {enterRiverbank,openChapterList,selectChapter} from './chapter-review-driver.mjs';

const out=process.env.JINSHA_RUSHES||path.join(tmpdir(),'jinsha-v16-rushes');
const server=process.env.JINSHA_CAPTURE_SOURCE?await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}}):null;
if(server)await server.listen();
const origin=server?'http://127.0.0.1:'+server.httpServer.address().port:process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const wanted=new Set(process.argv.slice(2));
const use=name=>!wanted.size||wanted.has(name);
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({executablePath:edge,headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
await mkdir(out,{recursive:true});
const context=await browser.newContext({viewport:{width:840,height:1070},deviceScaleFactor:1});
await context.addInitScript(({id,chapters})=>{
  if(window!==window.top)return;
  if(location.search.includes('take=birds'))localStorage.setItem(id,JSON.stringify({version:1,completed:[],started:true,quality:'high',muted:false}));
  if(!localStorage.getItem(id))localStorage.setItem(id,JSON.stringify({version:1,completed:chapters,started:true,ending:true,quality:'high',muted:false}));
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(dest,...args){
    const result=connect.call(this,dest,...args);
    if(dest===this.context.destination&&this.context instanceof AudioContext&&!window.gameCaptureBus){
      window.gameCaptureBus=this.context.createMediaStreamDestination();connect.call(this,window.gameCaptureBus);
    }return result;
  };
},{id:saveKey,chapters:chapterIds});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
page.on('pageerror',e=>console.error('PAGE',e.message));page.setDefaultTimeout(35000);
const sleep=t=>new Promise(ok=>setTimeout(ok,t));
const press=(root,name)=>root.getByRole('button',{name,exact:true}).click();
async function home(){await page.goto(origin,{waitUntil:'domcontentloaded'});await enterRiverbank(page);}
async function review(id){await home();await openChapterList(page);return selectChapter(page,id);}
async function drag(ax,ay,bx,by,ms){
  await page.mouse.move(ax,ay);await page.mouse.down();
  const n=Math.max(5,Math.round(ms/42));
  for(let i=1;i<=n;i++){const u=i/n;await page.mouse.move(ax+(bx-ax)*u,ay+(by-ay)*u);await sleep(ms/n);}
  await page.mouse.up();
}
async function shoot(name,action){
  const dir=path.join(out,name);await mkdir(dir,{recursive:true});
  const first=await page.screenshot({type:'jpeg',quality:95});
  let start=Date.now()/1000,frames=[{at:0,file:'first.jpg'}],writes=[writeFile(path.join(dir,'first.jpg'),first)],last=0;
  function frame(e){
    void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
    const at=e.metadata.timestamp-start;if(at-last<1/31)return;last=at;
    const file=String(frames.length).padStart(5,'0')+'.jpg';frames.push({at,file});writes.push(writeFile(path.join(dir,file),Buffer.from(e.data,'base64')));
  }
  cdp.on('Page.screencastFrame',frame);
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:93,maxWidth:840,maxHeight:1070,everyNthFrame:1});
  try{await action();}finally{
    const seconds=Date.now()/1000-start;
    await cdp.send('Page.stopScreencast');cdp.off('Page.screencastFrame',frame);await Promise.all(writes);
    const bundle=await page.locator('script[type=module][src]').first().getAttribute('src');
    await writeFile(path.join(dir,'frames.json'),JSON.stringify({name,seconds,frames,origin,bundle,viewport:[840,1070]}));
    console.log(name,seconds.toFixed(2)+'s',frames.length+' frames');
  }
}
try{
 if(use('mask')){
  await home();await page.locator('#notebook').click();await press(page,'金面具特展');
  await page.locator('.gold-mask-room[data-mode=live]').waitFor({timeout:60000});
  await page.locator('.gold-mask-live canvas').waitFor();await sleep(600);
  const r=await page.locator('.gold-mask-live canvas').boundingBox();
  await shoot('mask',async()=>{await sleep(250);await drag(r.x+r.width*.54,r.y+r.height*.51,r.x+r.width*.78,r.y+r.height*.48,1900);await page.locator('.gold-mask-views [data-view=back]').click();await sleep(2200);});
 }
 if(use('flight')){
  await home();await page.locator('#notebook').click();await page.locator('[data-map-place="carbon-rice"]').click();await press(page,'在罗盘标记');
  await shoot('flight',async()=>{await page.locator('#guide').click();await sleep(7800);});
 }
 if(use('foil')){
  const f=await review('sunfoil');await f.locator('.jss-lamp-handle').waitFor();await sleep(700);
  const v=await f.locator('.jss-viewport').boundingBox(),rail=await f.locator('.jss-lamp-track').boundingBox(),h=await f.locator('.jss-lamp-handle').boundingBox();
  await shoot('foil',async()=>{await drag(v.x+v.width*.46,v.y+v.height*.52,v.x+v.width*.65,v.y+v.height*.55,1500);await sleep(350);await drag(h.x+h.width/2,h.y+h.height/2,rail.x+rail.width-19,h.y+h.height/2,2400);await sleep(1100);await press(f,'判作镂空');await sleep(1000);});
 }
 if(use('ivory')){
  const f=await review('ivory-record');await f.locator('.jss-focus-mark').first().click();await sleep(950);
  const a=await f.getByRole('button',{name:'拖动便携比例尺'}).boundingBox(),b=await f.getByRole('button',{name:'放置同框比例尺'}).boundingBox();
  await shoot('ivory',async()=>{await sleep(280);await drag(a.x+a.width/2,a.y+a.height/2,b.x+b.width/2,b.y+b.height/2,1450);
    const lens=f.getByRole('slider'),r=await lens.boundingBox();
    await lens.click({position:{x:8+(r.width-16)*(74-10)/80,y:r.height/2}});await sleep(550);await press(f,'按下快门');await sleep(1380);await f.locator('.jss-focus-mark').nth(1).click();await sleep(1500);});
 }
 if(use('raft')){
  const f=await review('paleochannel');await press(f,'解缆出发');await sleep(430);
  await shoot('raft',async()=>{await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowLeft');await sleep(3200);await page.keyboard.up('ArrowLeft');await page.keyboard.down('ArrowRight');await sleep(2300);await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowUp');await sleep(400);});
 }
 if(use('bronze')){
  const f=await review('bronze-shadow');await f.locator('.at-view canvas').waitFor();await sleep(800);
  const act=name=>f.locator('[data-action="'+name+'"]').click();
  const view=await f.locator('.at-view canvas').boundingBox();
  const x=view.x+view.width*.43,y=view.y+view.height*.42;
  await shoot('bronze',async()=>{await drag(x,y,x+94,y-4,1300);await sleep(200);await press(f,'标出薄尾');await sleep(400);await act('support-right');await sleep(280);await act('support-right');await sleep(300);await act('support-test');await sleep(1400);});
 }
 if(use('dawn')){
  await home();await page.locator('#notebook').click();await press(page,'重看终章');await press(page,'沿轴候日');
  for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');
  await shoot('dawn',async()=>{await press(page,'沿轴候日');await sleep(14600);});
 }
 if(use('posts')){
  const f=await review('nine-posts');await sleep(800);
  async function line(a,b){const aa=await f.getByRole('button',{name:'柱洞 '+a,exact:true}).boundingBox(),bb=await f.getByRole('button',{name:'柱洞 '+b,exact:true}).boundingBox();await drag(aa.x+aa.width/2,aa.y+aa.height/2,bb.x+bb.width/2,bb.y+bb.height/2,1000);await sleep(450);}
  await shoot('posts',async()=>{await line(1,2);await line(2,5);await line(1,5);await sleep(800);});
 }
 if(use('investigation')){
  await home();await page.locator('#notebook').click();await press(page,'证据推理台');
  await page.locator('.iv-case:enabled').nth(1).click();
  const box=page.locator('dialog.investigation-desk');
  async function slide(a,b,ms){await a.scrollIntoViewIfNeeded();const ra=await a.boundingBox(),rb=await b.boundingBox();await drag(ra.x+ra.width/2,ra.y+ra.height/2,rb.x+rb.width/2,rb.y+rb.height/2,ms);}
  async function examine(n){await box.locator('[data-specimen="'+n+'"]').click();await slide(box.locator('.iv-lens'),box.locator('.iv-target'),1000);await sleep(450);await box.locator('[data-action=record]').click();}
  await shoot('investigation',async()=>{await examine(0);await sleep(400);await examine(1);await sleep(700);});
  await shoot('pair',async()=>{for(let i=0;i<2;i++){await slide(box.locator('[data-note="'+i+'"]'),box.locator('[data-slot="'+i+'"]'),800);await sleep(350);}
    await box.getByText('可把水流搬运列为夹砾带的成因假设',{exact:true}).click();await box.locator('.iv-report').click();await sleep(1500);});
 }
 if(use('birds')){
  await page.goto(origin+'/?take=birds',{waitUntil:'domcontentloaded'});await enterRiverbank(page);await sleep(1450);
  await sleep(6500);await page.keyboard.press('r');await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.yaw<-.96,null,{polling:'raf'});await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.waterbirds?.flights>0,null,{timeout:14000});
  await shoot('birds',async()=>{await sleep(600);await page.keyboard.up('KeyW');await page.keyboard.down('KeyA');await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.yaw>-.24,null,{polling:'raf'});await page.keyboard.up('KeyA');await sleep(6500);});
  console.log('birds',await page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().motion.waterbirds));
 }
 if(use('bed')){
  await home();await sleep(11000);
  const b64=await page.evaluate(async()=>{
    const bus=window.gameCaptureBus;if(!bus)throw new Error('No live game sound output');
    const rec=new MediaRecorder(bus.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:192000});
    const bits=[];rec.ondataavailable=e=>bits.push(e.data);
    const end=new Promise(resolve=>{rec.onstop=resolve;});rec.start();await new Promise(r=>setTimeout(r,48000));rec.stop();await end;
    return new Promise(resolve=>{const rd=new FileReader();rd.onload=()=>resolve(rd.result.split(',')[1]);rd.readAsDataURL(new Blob(bits,{type:'audio/webm'}));});
  });
  await writeFile(path.join(out,'river-live.webm'),Buffer.from(b64,'base64'));console.log('bed: 48 seconds of live river soundtrack');
 }
}finally{await browser.close();await server?.close();}

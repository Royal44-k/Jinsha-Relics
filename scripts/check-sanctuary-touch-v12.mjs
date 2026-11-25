import assert from 'node:assert/strict';
import {createReadStream,existsSync} from 'node:fs';
import {mkdir,stat,writeFile} from 'node:fs/promises';
import {extname,join,resolve,sep} from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {saveKey,chapterIds} from '../src/v10/ledger.js';
import {enterRiverbank, openChapterList, selectChapter, returnedToRiverbank} from './chapter-review-driver.mjs';

async function memoryRelease(){
  const {build}=await import('vite');
  const buildResult=await build({logLevel:'error',build:{write:false,copyPublicDir:false}});
  const assets=new Map(buildResult.output.map(f=>['/'+f.fileName,f.type==='asset'?f.source:f.code]));
  const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.json':'application/json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.webm':'video/webm','.mp4':'video/mp4'};
  const publicDir=resolve('public');
  const server=createServer(async(req,res)=>{
    try{
      const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),url=path==='/'?'/index.html':path;
      const type=mime[extname(url)]||'application/octet-stream';
      if(assets.has(url)){res.writeHead(200,{'Content-Type':type}).end(assets.get(url));return;}
      const file=resolve(publicDir,'.'+url);
      if(!file.startsWith(publicDir+sep)||!(await stat(file)).isFile()){res.writeHead(404).end();return;}
      const s=createReadStream(file);s.on('error',()=>res.destroy());res.on('close',()=>s.destroy());res.writeHead(200,{'Content-Type':type});s.pipe(res);
    }catch{if(!res.headersSent)res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));return server;
}
const server=process.argv.includes('--build')?await memoryRelease():null;
const origin=server?'http://127.0.0.1:'+server.address().port:process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const out=process.env.JINSHA_PROOF||'docs/v12/sanctuary';
await mkdir(out,{recursive:true});
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
await context.addInitScript(({key,ids})=>{
  if(window===window.top&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,completed:ids,started:true,ending:true,muted:true,quality:'economy'}));
},{key:saveKey,ids:chapterIds});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
await page.addInitScript(()=>{
  window.__touchAudit=[];
  for(const name of ['pointerdown','pointerup','pointercancel','click'])document.addEventListener(name,e=>{
    const t=e.target;window.__touchAudit.push([name,e.pointerType,t.tagName,t.className,t.tagName==='BUTTON'?t.textContent:'',Math.round(e.clientX),Math.round(e.clientY)]);
    if(window.__touchAudit.length>22)window.__touchAudit.shift();
  },{capture:true,passive:true});
});
const report={origin,viewport:'390×844 CSS pixels',input:'Chromium touch emulation, trusted single-finger CDP touch strokes, no keyboard or mouse',setup:'One archive with all nine chapters before opening the title. Chapter interactions use only player-facing controls.',checks:[],gestures:[],images:[],errors:[],failures:[]};
page.setDefaultTimeout(14000);
page.setDefaultNavigationTimeout(60000);
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
let frame;
const button=name=>frame.getByRole('button',{name,exact:true});
const read=()=>frame.locator('.jss-readout').innerText();
const note=()=>frame.locator('.jss-note').innerText();
const check=(name,ok,evidence)=>{assert.ok(ok,name+' '+JSON.stringify(evidence??''));report.checks.push({name,...(evidence==null?{}:{evidence})});};
const box=async loc=>{const b=await loc.boundingBox();assert.ok(b,'Element visible');return b;};
const at=(b,x=.5,y=.5)=>[b.x+b.width*x,b.y+b.height*y];
const center=async loc=>at(await box(loc));
const shot=async name=>{const filename='touch-'+name+'.jpg';await page.screenshot({path:join(out,filename),type:'jpeg',quality:87});report.images.push(filename);};
async function drag(label,a,b){
  for(const p of [a,b])assert.ok(p[0]>=0&&p[0]<390&&p[1]>=0&&p[1]<844,label+' endpoints visible '+JSON.stringify([a,b]));
  const hit=await page.evaluate(([x,y])=>{
    const host=document.elementFromPoint(x,y);
    if(!(host instanceof HTMLIFrameElement))return host?.className;
    const rect=host.getBoundingClientRect();
    const el=host.contentDocument.elementFromPoint(x-rect.left-host.clientLeft,y-rect.top-host.clientTop);
    return el?.getAttribute('aria-label')||el?.className;
  },a);
  const send=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{id:1,x,y,radiusX:4,radiusY:4,force:.6}]});
  await send('touchStart',...a);for(let i=1;i<=12;i++)await send('touchMove',a[0]+(b[0]-a[0])*i/12,a[1]+(b[1]-a[1])*i/12);
  await send('touchEnd');report.gestures.push({label,hit,from:a.map(Math.round),to:b.map(Math.round)});
}
async function enter(id){
  await openChapterList(page,true);
  frame=await selectChapter(page,id,true);
  assert.equal(await frame.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().site),id);
  const canvas=frame.locator('.jss-surface canvas');await canvas.waitFor();
  const gpu=await canvas.evaluate(el=>!!el.getContext('webgl2'));
  check(id+' opens from riverbank in WebGL2',gpu);return frame.locator('.jss-viewport');
}
async function returnMain(){
  await button('再玩本关').waitFor();await frame.locator('#review-finish-return').tap();
  await returnedToRiverbank(page);
}
async function foil(){
  const view=await enter('sunfoil');
  for(const index of [0,1,2]){
    const id='specimen '+(index+1),v=await box(view);await drag(id+' sample turn',at(v,.40,.49),at(v,.62,.49));
    check(id+' sample turned from actual surface stroke',/已侧看/.test(await read()),await read());
    const hand=await center(frame.locator('.jss-lamp-handle')),rail=await box(frame.locator('.jss-lamp-track'));
    await drag(id+' lower lamp carriage',hand,[rail.x+rail.width-19,hand[1]]);
    const reading=await read(),label=await frame.locator('.jss-glass-label').innerText();
    const description=await note(),kind=description.includes('完整的弧孔')?'镂空':description.includes('没有漏光')?'折痕':description.includes('通到试片的外沿')?'缺口':null;
    check(id+' reaches transmitted light',/已侧看.*2\/2/.test(reading)&&/透射光/.test(label)&&kind,{reading,label,description});
    if(index===0)await shot('optics');await button('判作'+kind).tap();
    const expected=index===2?'三种边缘已辨明':'已辨 '+(index+1)+'/3';
    await frame.waitForFunction(expected=>document.querySelector('.jss-readout').textContent.includes(expected),expected,{timeout:3500});
    check(id+' identified from the observed edge',(await read()).includes(expected));
  }
  await button('带走透光图版　→').tap();await returnMain();
}
async function posts(){
  await enter('nine-posts');
  for(const [from,to,n] of [[1,2,'2.90'],[2,5,'1.90'],[1,5,'3.47']]){
    await drag('survey '+from+' → '+to,await center(button('柱洞 '+from)),await center(button('柱洞 '+to)));
    const label=await frame.locator('.jss-glass-label').innerText();
    check('rope '+from+' → '+to+' records '+n+' m',label.includes(n+' m'),{label,reading:await read()});
  }
  await shot('baseline');await button('沿东南轴线候日　→').tap();await returnMain();
}
async function ivory(){
  const view=await enter('ivory-record');
  const lens=frame.getByRole('slider'),holder=button('拖动便携比例尺'),landing=button('放置同框比例尺');
  for(const [i,aim] of [74,46,27].entries()){
    await frame.locator('.jss-film button').nth(i).tap();
    // The marked drop point follows the working camera. Wait for it to settle
    // before taking both endpoints, just as a player can see it settle.
    await landing.tap({trial:true});
    await drag('ruler '+(i+1),await center(holder),await center(landing));
    check('ruler '+(i+1)+' placed by ray onto the near mud',/标尺入镜/.test(await read()),await read());
    const v=await box(view);
    if(i===0){
      const mark=frame.locator('.jss-focus-mark').nth(2),before=await center(mark);
      await drag('horizontal camera rail',at(v,.32,.34),at(v,.52,.34));
      await page.waitForTimeout(250);const after=await center(mark);
      check('lateral stroke reprojects the far camera target',Math.hypot(after[0]-before[0],after[1]-before[1])>3,{before,after});
    }
    const current=Number(await lens.inputValue()),dy=(current-aim)/.32;
    // Chromium expands touch hit areas around small controls. Choose clear mud
    // with one fingertip of clearance around both ends of the focus stroke.
    const relative=await view.evaluate((el,dy)=>{
      const r=el.getBoundingClientRect(),buttons=Array.from(el.querySelectorAll('button:not([hidden])'),b=>b.getBoundingClientRect());
      for(const u of [.76,.23,.55,.83])for(const v of [.40,.54,.28]){
        const x=r.x+u*r.width,y=r.y+v*r.height;
        if(y+dy<r.top+22||y+dy>r.bottom-22)continue;
        if(buttons.every(b=>x<b.left-23||x>b.right+23||Math.max(y,y+dy)<b.top-23||Math.min(y,y+dy)>b.bottom+23))return [x-r.left,y-r.top];
      }
      throw Error('No unobstructed mud stroke fits the frame');
    },dy),start=[v.x+relative[0],v.y+relative[1]],end=[start[0],start[1]+dy];
    await drag('focus plane '+(i+1),start,end);
    const achieved=Number(await lens.inputValue());
    check('vertical swipe focuses frame '+(i+1),Math.abs(achieved-aim)<=5&&/双像重合/.test(await read()),{aim,achieved});
    await button('按下快门').tap();
    check('retained photographic contact '+(i+1),await frame.locator('.jss-film button.exposed').count()===i+1);
  }
  const images=await frame.locator('.jss-film button.exposed i').evaluateAll(cells=>cells.map(c=>c.style.backgroundImage));
  check('three distinct JPEG photographs',new Set(images).size===3&&images.every(x=>x.includes('data:image/jpeg;base64,')));
  await shot('photography');await button('封存三格底片　→').tap();await returnMain();
}
try{
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await enterRiverbank(page,true);
  for(const [site,walk] of [['optics',foil],['baseline',posts],['photography',ivory]]){
    try{await walk();}
    catch(e){
      report.failures.push({site,message:e.message,note:await frame?.locator('.jss-note').textContent({timeout:500}).catch(()=>''),reading:await frame?.locator('.jss-readout').textContent({timeout:500}).catch(()=>''),events:await frame?.evaluate(()=>window.__touchAudit).catch(()=>[])});
      await shot(site+'-failure');
      await page.goto(origin,{waitUntil:'domcontentloaded'});
      await enterRiverbank(page,true);
    }
  }
  check('touch completion and return preserve the archived route',await page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().completed.length===9));
  assert.deepEqual(report.errors,[]);assert.ok(!report.failures.length,report.failures.map(f=>f.site+' '+f.message).join('\n'));report.ok=true;
}finally{
  await cdp.detach();await browser.close();server?.close();await writeFile(join(out,'touch.json'),JSON.stringify(report,null,2)+'\n');
}

import assert from 'node:assert/strict';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {chapterIds,saveKey} from '../src/v10/ledger.js';
import {enterRiverbank, openChapterList, selectChapter} from './chapter-review-driver.mjs';

// Use a private browser profile with a completed save. Every workshop is entered
// through the riverbank chapter list and is played through its replay receipt.
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'docs/v12/workshops');
const capture=process.argv.includes('--capture');
const rapid=process.argv.includes('--rapid');
const target=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const cases=[], errors=[];
if(capture)mkdirSync(out,{recursive:true});
const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:path.join(tmpdir(),'jinsha-v12-workshop-gestures'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
await server.listen();
const base='http://127.0.0.1:'+server.httpServer.address().port;
const browser=await chromium.launch({executablePath:process.env.WORKSHOP_BROWSER||(existsSync(edge)?edge:undefined),headless:true});
const center=b=>({x:b.x+b.width/2,y:b.y+b.height/2});
const point=(b,x,y)=>({x:b.x+b.width*x,y:b.y+b.height*y});
const line=(a,b,n=5)=>Array.from({length:n+1},(_,i)=>({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}));

async function test(device,id,play){
  const name=device+'-'+id;
  if(target&&!name.includes(target))return;
  const touch=device==='touch', row={name,steps:[],controls:[],layouts:[],shots:[],errors:[]};
  cases.push(row);
  const page=await browser.newPage({viewport:touch?{width:390,height:844}:{width:1280,height:800},deviceScaleFactor:1,hasTouch:touch,isMobile:touch});
  page.setDefaultTimeout(12000);
  const cdp=await page.context().newCDPSession(page);
  page.on('pageerror',e=>row.errors.push(e.message));
  let frame;
  const selector=s=>frame.locator(s), action=n=>selector('[data-action="'+n+'"]');
  const read=()=>selector('.at-readout').innerText();
  const canvas=()=>selector('.at-view canvas').boundingBox();
  async function layout(stage){
    const result=await selector('.js-at').evaluate(root=>{
      const rect=root.querySelector('.at-view').getBoundingClientRect();
      const panel=root.querySelector('.at-panel');
      const visible=[...root.querySelectorAll('.at-controls button,.at-tail-tag,.at-turn-handle')].filter(e=>e.getClientRects().length);
      const clipped=[],small=[],occluded=[];
      for(const e of visible){
        const r=e.getBoundingClientRect(),inside=e.contains.bind(e);
        const label=e.ariaLabel||e.textContent.trim();
        if(r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5)clipped.push(label);
        if(Math.min(r.width,r.height)<44)small.push(label);
        const targets=[[.5,.5],[.14,.5],[.86,.5],[.5,.14],[.5,.86]];
        if(targets.some(([x,y])=>!inside(document.elementFromPoint(r.x+r.width*x,r.y+r.height*y))))occluded.push(label);
      }
      return {counts:visible.length,small,clipped,occluded,panelScroll:Math.round(panel.scrollHeight-panel.clientHeight),overlap:Math.round(Math.max(0,rect.bottom-panel.getBoundingClientRect().top)),horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
    });
    row.layouts.push({stage,...result});
    assert.equal(result.horizontalOverflow,0,'page overflow: '+stage);
    assert.deepEqual(result.clipped,[],'controls outside screen: '+stage);
    assert.deepEqual(result.occluded,[],'controls obscured: '+stage);
    if(touch){
      assert.deepEqual(result.small,[],'touch targets under 44px: '+stage);
      assert.equal(result.overlap,0,'canvas overlaps panel: '+stage);
    }
  }
  async function shot(suffix){
    if(!capture)return;
    const file=name+'-'+suffix+'.png';
    const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
    writeFileSync(path.join(out,file),Buffer.from(data,'base64'));row.shots.push(file);
  }
  async function feedback(regex){
    const msg=await selector('.at-feedback').innerText();assert.match(msg,regex);row.steps.push(msg);
  }
  async function measure(el){
    await el.scrollIntoViewIfNeeded();
    const metric=await el.evaluate(e=>{
      const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      const under=document.elementFromPoint(x,y);
      return {label:e.ariaLabel||e.textContent.trim(),width:Math.round(r.width),height:Math.round(r.height),x:Math.round(x),y:Math.round(y),reachable:e.contains(under)};
    });
    if(!row.controls.some(c=>c.label===metric.label))row.controls.push(metric);
    assert.ok(metric.reachable,'center occluded: '+JSON.stringify(metric));
    assert.ok(Math.min(metric.width,metric.height)>=(touch?44:24),'target too small: '+JSON.stringify(metric));
    // CDP input uses main-frame coordinates, even with a dialog around the chapter.
    return {...metric,...center(await el.boundingBox())};
  }
  async function clickEl(el){
    const m=await measure(el);
    if(touch){
      const begin=await frame.evaluate(()=>window.contact.events.length);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:m.x,y:m.y,id:1,radiusX:4,radiusY:4,force:.6}]});
      if(!rapid)await page.waitForTimeout(65);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await frame.waitForFunction(({label,begin})=>window.contact.events.slice(begin).some(e=>e[0]==='click'&&e[1]===label),{label:m.label,begin},{timeout:1500});
    }else await el.click();
  }
  const click=n=>clickEl(action(n));
  async function gesture(points){
    assert.ok(points.length>=2);
    if(touch){
      const touchPoints=p=>[{...p,id:1,radiusX:5,radiusY:5,force:.65}];
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touchPoints(points[0])});
      for(const p of points.slice(1)){
        if(!rapid)await page.waitForTimeout(24);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touchPoints(p)});
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      // Lift and move the same finger to the next onscreen control.
      if(!rapid)await page.waitForTimeout(200);
    }else{
      await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
      for(const p of points.slice(1))await page.mouse.move(p.x,p.y);
      await page.mouse.up();
    }
    await frame.waitForFunction(()=>window.contact.captured.length===0,{},{timeout:2200});
  }
  const drag=(a,b)=>gesture(line(a,b));
  try{
    await page.addInitScript(({key,completed})=>{
      if(window===window.top&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,completed,started:true,muted:true,quality:'economy'}));
      window.contact={got:0,lost:0,captured:[],types:[],events:[]};
      for(const type of ['pointerdown','pointerup','pointercancel','click'])document.addEventListener(type,e=>{
        if(!e.target.closest?.('.js-at'))return;
        const label=e.target.ariaLabel||e.target.textContent.trim()||e.target.tagName;
        window.contact.events.push([type,label,Math.round(e.clientX),Math.round(e.clientY),e.pointerType]);
      },true);
      for(const type of ['gotpointercapture','lostpointercapture'])document.addEventListener(type,e=>{
        const c=window.contact;
        if(type==='gotpointercapture'){
          if(!e.target.closest?.('.js-at'))return;
          c.got++;c.captured.push(e.pointerId);if(!c.types.includes(e.pointerType))c.types.push(e.pointerType);
        }else if(c.captured.includes(e.pointerId)){c.lost++;c.captured=c.captured.filter(id=>id!==e.pointerId);}
      },true);
    },{key:saveKey,completed:chapterIds.slice(0,6)});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await enterRiverbank(page,touch);
    await openChapterList(page,touch);
    frame=await selectChapter(page,id,touch);
    await selector('.at-view canvas').waitFor({timeout:45000});
    const r=await canvas();
    row.canvas={width:Math.round(r.width),height:Math.round(r.height)};
    assert.ok(r.width>=300&&r.height>=175);
    await layout('entry');
    async function cancelTouch(p){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    }
    await play({frame,selector,action,clickEl,click,measure,gesture,drag,read,feedback,canvas,shot,row,layout,touch,cancelTouch});
    await selector('#folio.receipt-open[open]').waitFor({timeout:10000});
    row.receipt=await selector('#folio-title').innerText();
    row.release=await frame.evaluate(()=>{const {got,lost,captured,types}=window.contact;return {got,lost,captured,types};});
    assert.ok(row.release.got>1&&row.release.got===row.release.lost);
    assert.deepEqual(row.release.types,[touch?'touch':'mouse']);
    assert.deepEqual(row.errors,[]);
    row.pass=true;
  }catch(e){row.pass=false;row.failure=e.message;row.lastEvents=await frame?.evaluate(()=>window.contact?.events.slice(-12)).catch(()=>[]);errors.push(name+': '+row.failure);await shot('failure');}
  finally{
    await page.close();console.log(name,row.pass?'PASS':row.failure);
    if(capture)writeFileSync(path.join(out,target?'partial-'+target+'.json':'gestures.json'),JSON.stringify(cases,null,2));
  }
}

async function jade({click,canvas,drag,feedback,shot,read,action,layout}){
  let c=await canvas();
  const a=point(c,.26,.52),b=point(c,.74,.52);
  await click('charge-grit');await feedback(/先横拉/);
  await drag(b,a);await feedback(/湿痕/);await click('charge-grit');
  for(let i=0;i<8;i++){
    if(i===4){await drag(b,a);await feedback(/发干/);await click('wet');}
    await drag(i%2?a:b,i%2?b:a);
  }
  await action('jade-record').waitFor();
  await layout('side-light');
  await click('jade-record');await feedback(/逆光/);
  c=await canvas();const start=point(c,.3,.53);
  await drag(start,{x:start.x+108,y:start.y});
  assert.match(await read(),/可记录/);
  await shot('side-light');await click('jade-record');
}

async function clay({selector,action,click,measure,gesture,drag,feedback,canvas,shot,read,row,layout,touch,cancelTouch}){
  await click('gauge');await feedback(/再展开/);
  if(touch){
    const p=center(await action('widen').boundingBox()),gauge=selector('.at-instrument output').first();
    const initial=await gauge.innerText();
    await cancelTouch(p);assert.equal(await gauge.innerText(),initial,'canceled button');
    await drag(p,{x:p.x+70,y:p.y});assert.equal(await gauge.innerText(),initial,'dragged-out button');
    await click('widen');assert.equal(await gauge.innerText(),'100 格','one tap advances one step');
    await click('narrow');assert.equal(await gauge.innerText(),initial,'one tap returns one step');
    row.steps.push('取消、拖出按钮均未改变口规；单击仅移动一格。');
  }
  let c=await canvas();await drag(point(c,.42,.5),point(c,.50,.5));
  await click('gauge');await feedback(/口规恰好/);await shot('handle');
  const handle=selector('.at-turn-handle'),piece=selector('.at-shard-pin'),target=selector('.at-target-pin');
  for(let i=0;i<3;i++){
    await layout('shard-'+(i+1));
    const angle=Number((await read()).match(/(-?\d+)°/)[1])*Math.PI/180;
    const h=await measure(handle),p=center(await piece.boundingBox()),goal=center(await target.boundingBox());
    const dx=h.x-p.x,dy=h.y-p.y,r=Math.hypot(dx,dy),polar=Math.atan2(dy,dx);
    const arc=Array.from({length:9},(_,j)=>({x:p.x+r*Math.cos(polar+angle*j/8),y:p.y+r*Math.sin(polar+angle*j/8)}));
    await gesture(arc);
    const rest=await read();assert.ok(Math.abs(Number(rest.match(/(-?\d+)°/)[1]))<=6,'rotation did not settle: '+rest);
    row.steps.push(rest);await drag(p,goal);
    const count=await selector('.at-instrument output').last().innerText();
    assert.equal(count,(i+1)+' / 3','drag shard '+i+' at '+JSON.stringify({p,goal,feedback:await selector('.at-feedback').innerText()}));
  }
  await click('clay-record');await feedback(/侧面才能/);
  await layout('turntable');
  c=await canvas();const a=point(c,.31,.5);await drag(a,{x:a.x+104,y:a.y});
  assert.match(await read(),/可归档/);await shot('restored');await click('clay-record');
}

async function bronze({frame,selector,clickEl,click,canvas,drag,feedback,shot,read,row,layout}){
  await click('support-test');await feedback(/先从侧面/);
  let c=await canvas(),a=point(c,.40,.40);await drag(a,{x:a.x+68,y:a.y});
  await layout('tail');await shot('tail');await clickEl(selector('.at-tail-tag'));await feedback(/折垂的尾端已标出/);
  const lower=async()=>{c=await canvas();const p=point(c,.48,.36);await drag(p,{x:p.x,y:p.y+Math.min(65,c.height*.2)});};
  await lower();await feedback(/腹托太靠前/);
  await frame.waitForFunction(()=>document.querySelector('.js-at header [aria-current="step"]')?.textContent.includes('调整双托'),{},{timeout:3000});
  c=await canvas();
  await drag(point(c,.30,.70),point(c,.36,.70));
  const chest=await read();assert.match(chest,/胸下衬托/);row.steps.push(chest);
  await drag(point(c,.49,.70),point(c,.63,.70));
  const belly=await read();assert.match(belly,/腹下衬托/);row.steps.push(belly);
  await shot('supports');await lower();await feedback(/重心夹在两托之间|支护图已就位/);
}

try{
  for(const device of ['desktop','touch']){
    for(const [id,fn] of [['jade-cut',jade],['clay-fit',clay],['bronze-shadow',bronze]])await test(device,id,fn);
  }
}finally{await browser.close();await server.close();}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}

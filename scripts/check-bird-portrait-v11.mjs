import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {relics} from '../src/v11/collection-data.js';
import {collectionKey} from '../src/v11/collection-state.js';

const server=process.env.JINSHA_ORIGIN?null:await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
if(server)await server.listen();
const origin=process.env.JINSHA_ORIGIN||server.resolvedUrls.local[0];
const proof=process.env.JINSHA_PORTRAIT_PROOF||resolve('docs/v11/collection/bird-portrait');
await mkdir(proof,{recursive:true});
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const errors=[];
const report={origin:process.env.JINSHA_ORIGIN?'built game':'Vite project entry',metrics:{},scenarios:[]};
let browser;
async function newPage(options={}){
  const context=await browser.newContext(options);
  const page=await context.newPage();
  page.setDefaultTimeout(70000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error'&&/THREE\.WebGLProgram|shader error/i.test(msg.text()))errors.push(msg.text());});
  return {context,page};
}
async function launchCard(page){
  const requests=[];
  page.on('request',r=>{if(/\/shuoyu(?:\.lod1)?\.glb(?:\?|$)/.test(r.url()))requests.push(r.url());});
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('#cover-profile').click();
  await page.locator('#observe-guide').waitFor();
  assert.equal(requests.length,0,'The cover and outfit list must not request a rig');
  await page.locator('#observe-guide').click();
  return requests;
}
const card=page=>page.locator('.bp-studio');
const selectPose=(page,id)=>page.locator('.bp-pose-group button[data-pose='+id+']');
async function frozenPixels(page){
  const s=await page.locator('.bp-view').screenshot({scale:'css'});
  return s.toString('base64');
}
async function changedPixels(page,a,b){
  return page.evaluate(async parts=>{
    const imgs=await Promise.all(parts.map(async part=>{
      const i=new Image();i.src='data:image/png;base64,'+part;await i.decode();return i;
    }));
    const [w,h]=[imgs[0].width,imgs[0].height],c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    const pixels=imgs.map(i=>{ctx.drawImage(i,0,0);return ctx.getImageData(0,0,w,h).data;});
    let n=0,area=0;
    // Crop the UI labels from the comparison so only the rendered subject and pedestal remain.
    for(let y=Math.floor(h*.16);y<h*.86;y+=2)for(let x=Math.floor(w*.1);x<w*.9;x+=2){
      area++;const at=4*(y*w+x);
      if([0,1,2].reduce((d,k)=>d+Math.abs(pixels[0][at+k]-pixels[1][at+k]),0)>34)n++;
    }
    return n/area;
  },[a,b]);
}
async function layout(page){
  assert.equal(await page.locator('#folio').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
}
async function measureExposure(page){
  const shot=await frozenPixels(page);
  return page.evaluate(async data=>{
    const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0);const px=ctx.getImageData(0,0,c.width,c.height).data;
    let samples=0,nearWhite=0;const luminances=[];
    for(let y=Math.round(c.height*.14);y<c.height*.84;y+=2)for(let x=Math.round(c.width*.18);x<c.width*.82;x+=2){
      const i=(x+y*c.width)*4; samples++;
      if(Math.min(px[i],px[i+1],px[i+2])>=248)nearWhite++;
      luminances.push(.2126*px[i]+.7152*px[i+1]+.0722*px[i+2]);
    }
    luminances.sort((a,b)=>a-b);
    return {samples,allChannels248Fraction:nearWhite/samples,lumaP95:+luminances[Math.floor(samples*.95)].toFixed(2)};
  },shot);
}
try{
  browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  {
    const {page,context}=await newPage({viewport:{width:1280,height:900}});
    const requests=await launchCard(page);
    await page.locator('.bp-canvas-slot canvas[data-motion=grounded]').waitFor();
    assert.equal(requests.length,1);
    const canvas=page.locator('.bp-canvas-slot canvas');
    assert.equal(await canvas.getAttribute('data-feathers'),'articulated-primary-pairs');
    assert.equal(await canvas.getAttribute('data-equipped'),'reed-1');
    await page.locator('[data-cmd=motion]').click();
    await card(page).locator('[data-cmd=motion][aria-pressed=true]').waitFor();
    await page.waitForTimeout(350);
    const stood=await frozenPixels(page);
    await page.locator('#folio').screenshot({path:join(proof,'desktop-stand.png')});
    report.metrics.standExposure=await measureExposure(page);
    await selectPose(page,'wing').click();await page.locator('canvas[data-motion=flying]').waitFor();
    const spread=await frozenPixels(page);
    const wingChange=await changedPixels(page,stood,spread);
    assert.ok(wingChange>.025,'Pose must actually change the rendered bird: '+wingChange);
    await selectPose(page,'skim').click();await page.locator('canvas[data-motion=gliding]').waitFor();
    const skim=await frozenPixels(page);
    await page.locator('.bp-view').screenshot({path:join(proof,'desktop-skim.png')});
    const skimChange=await changedPixels(page,spread,skim);assert.ok(skimChange>.015,'Skimming must render differently: '+skimChange);
    const view=page.locator('.bp-view'),heading=page.locator('.bp-heading');
    const initial=await heading.innerText();await view.focus();await page.keyboard.press('ArrowRight');assert.notEqual(await heading.innerText(),initial);
    await page.keyboard.press('Home');assert.equal(await heading.innerText(),initial);
    const box=await view.boundingBox();await page.mouse.move(box.x+box.width*.45,box.y+box.height*.53);
    await page.mouse.down();await page.mouse.move(box.x+box.width*.64,box.y+box.height*.55,{steps:5});await page.mouse.up();assert.notEqual(await heading.innerText(),initial);
    await selectPose(page,'stand').click();await page.locator('canvas[data-motion=grounded]').waitFor();
    await page.locator('[data-cmd=close]').click();await page.locator('.bp-studio[data-focus=eye]').waitFor();
    await page.waitForFunction(()=>{const val=document.querySelector('.bp-canvas-slot canvas')?.dataset.lidClosure;return val!==undefined&&Number(val)<=.015;});
    await view.screenshot({path:join(proof,'desktop-eye.png')});
    report.metrics.eyeExposure=await measureExposure(page);
    const closeChange=await changedPixels(page,stood,await frozenPixels(page));assert.ok(closeChange>.08,'Eye macro must change the rendering: '+closeChange);
    if(!await page.locator('.bp-origin a').isVisible())await page.locator('.bp-origin summary').click();
    assert.ok(await page.locator('.bp-origin a').isVisible());await layout(page);
    const gl=await canvas.evaluateHandle(c=>c.getContext('webgl2'));
    await page.getByRole('button',{name:'返回羽装'}).click();await page.locator('#observe-guide').waitFor();
    assert.equal(await card(page).count(),0);assert.equal(await gl.evaluate(c=>c.isContextLost()),true);
    await page.getByRole('button',{name:'回到标题'}).click();
    console.log('Desktop pose / skim / eye changed pixel ratios',wingChange,skimChange,closeChange);
    report.metrics.changedPixelFraction={standingToWing:wingChange,wingToSkim:skimChange,standingToEye:closeChange};
    assert.ok(report.metrics.standExposure.allChannels248Fraction<.015&&report.metrics.eyeExposure.allChannels248Fraction<.015);
    report.scenarios.push({viewport:'1280×900',rig:'articulated-primary-pairs',form:'reed-1',actions:['deferred load','stand / wing / skim','click / drag / keyboard','eye macro','context release','return to wardrobe and title']});
    await context.close();
  }
  {
    const {context,page}=await newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
    // Isolated browser save with a legitimately affordable third-tier feather upgrade.
    await page.addInitScript(({key,ids})=>{
      for(const id of ids)localStorage.setItem(key+'.chapters.'+id,'1');
      for(const level of [2,3])localStorage.setItem(key+'.upgrades.sun-'+level,'1');
      localStorage.setItem(key,'sun');
    },{key:collectionKey,ids:relics.map(r=>r.id)});
    const requests=await launchCard(page);
    await page.locator('.bp-studio[data-state=poster]').waitFor();assert.equal(requests.length,0);
    assert.ok(await page.locator('.bp-poster').evaluate(async i=>{await i.decode();return i.naturalWidth>=250&&i.currentSrc.endsWith('/form-sun.webp');}));
    await selectPose(page,'skim').tap();assert.match(await page.locator('.bp-observation').innerText(),/水面/);
    await page.getByRole('button',{name:'打开三维定格'}).tap();
    const glider=page.locator('canvas[data-motion=gliding]');await glider.waitFor();
    assert.equal(await glider.getAttribute('data-equipped'),'sun-3');
    assert.equal(await card(page).getAttribute('data-paused'),'true');
    await page.locator('[data-cmd=right]').tap();
    await page.locator('[data-cmd=close]').tap();await page.locator('.bp-studio[data-focus=eye]').waitFor();
    await page.locator('[data-cmd=close]').tap();await selectPose(page,'wing').tap();await page.locator('canvas[data-motion=flying]').waitFor();
    await page.locator('#folio').screenshot({path:join(proof,'narrow-wing.png')});await layout(page);
    await page.getByRole('button',{name:'回到标题'}).tap();await page.locator('#folio').waitFor({state:'hidden'});
    await card(page).waitFor({state:'detached'});
    await context.close();console.log('Narrow touch, reduced motion and equipped sun-3 passed.');
    report.scenarios.push({viewport:'390×844',form:'sun-3',actions:['reduced-motion poster','explicit frozen 3D','touch orbit and eye','pose switching','return to title']});
  }
  {
    const {context,page}=await newPage({viewport:{width:320,height:700},isMobile:true,hasTouch:true});
    await page.addInitScript(()=>{
      const get=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};
    });
    const requests=await launchCard(page);
    await page.getByRole('button',{name:'重试三维'}).waitFor();
    assert.equal(requests.length,0);assert.equal(await page.locator('.bp-canvas-slot canvas').count(),0);
    await selectPose(page,'wing').tap();assert.match(await page.locator('.bp-observation').innerText(),/飞羽/);
    await page.locator('.bp-origin summary').tap();assert.match(await page.locator('.bp-origin').innerText(),/由游戏创作/);
    await page.locator('#folio').screenshot({path:join(proof,'fallback-320.png')});
    await layout(page);await page.getByRole('button',{name:'回到标题'}).tap();await context.close();
    console.log('320px WebGL unavailable fallback passed.');
    report.scenarios.push({viewport:'320×700',webgl:false,actions:['no rig download','static outfit poster','three posture notes','museum source','return to title']});
  }
  assert.deepEqual(errors,[]);
  report.testedAt=new Date().toISOString();
  report.engine=await browser.version();
  report.method='Separate Edge contexts, SwiftShader on desktop and touch devices. Changed pixels count central stage pixels with summed RGB difference > 34 between frozen poses. Exposure measures the rendered central crop, with near-white defined as all three channels >= 248; this is not a hardware HDR test.';
  await writeFile(join(proof,'checks.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Verified character card. Screenshots:',proof);
}finally{await browser?.close();await server?.close();}

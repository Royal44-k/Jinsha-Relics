import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {joint} from '../src/v10/trench-profile.js';
import {registeredDetail} from './bake-strata-lens-v11.mjs';

const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
await server.listen();
const origin=server.resolvedUrls.local[0],out='docs/v11/collection/';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const fixture='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="/src/v10/expedition.css" rel="stylesheet"><link href="/src/v11/expedition.css" rel="stylesheet"></head><body style="margin:0;background:#182322"><dialog id="strata-dialog" aria-label="探方剖面放大镜"><button class="lens-close">返回观察</button><section id="museum"></section></dialog></body></html>';
const report={fixture:'生产组件与滨河探方同一土壁、同一层界。独立 UTF-8 展厅。',checks:[],errors:[]};
const mount=p=>p.evaluate(async()=>{
  const {mountStrataLens}=await import('/src/v11/strata-lens.js');
  window.disposeLens=mountStrataLens(document.querySelector('#museum'));
});
let browser;
async function open(touch=false) {
  const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1000,height:850},hasTouch:touch,isMobile:touch,deviceScaleFactor:touch?2:1});
  await context.routeWebSocket(/^ws:\/\/(127\.0\.0\.1|localhost):/,()=>{});
  const page=await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/__strata-lens',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));
  await page.goto(origin+'__strata-lens');
  await page.evaluate(()=>document.querySelector('dialog').showModal());
  assert.equal(await page.locator('.lens-close').innerText(),'返回观察');
  return {context,page};
}
async function pick(page,x,y,touch=false) {
  const canvas=page.locator('.strata-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const rect=await canvas.boundingBox();
  const px=rect.x+rect.width*x/900,py=rect.y+rect.height*y/400;
  if(touch)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py);
}
const layer=(page,id)=>page.locator('.strata-lens[data-layer='+id+']').waitFor();
try {
  browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
  const {page,context}=await open();
  if(process.argv.includes('--render')){
    const encoded=await registeredDetail(page);
    await writeFile('public/assets/v11/strata-detail.webp',Buffer.from(encoded.split(',')[1],'base64'));
  }
  report.registration=await page.evaluate(async()=>{
    const {width,height,top}=await import('/src/v10/trench-profile.js');
    const imgs=[];
    for(const url of ['/assets/v10/trench-registered.webp','/assets/v11/strata-detail.webp']){
      const img=new Image();img.src=url;await img.decode();imgs.push(img);
    }
    const pixels=imgs.map(img=>{
      const c=document.createElement('canvas');c.width=width;c.height=height;
      const g=c.getContext('2d');g.drawImage(img,0,0,width,height);
      return g.getImageData(0,0,width,height).data;
    });
    let sum=0,count=0;
    for(let x=0;x<width;x+=3)for(let y=Math.ceil(top(x))+4;y<height-2;y+=3){
      const p=(y*width+x)*4;
      for(let k=0;k<3;k++){sum+=Math.abs(pixels[0][p+k]-pixels[1][p+k]);count++;}
    }
    return {original:imgs[0].naturalWidth,detail:imgs[1].naturalWidth,averageChannelDifference:Number((sum/count).toFixed(2))};
  });
  assert.ok(report.registration.detail>report.registration.original*1.95);
  assert.ok(report.registration.averageChannelDifference<12);
  await mount(page);
  assert.equal(await page.locator('.strata-title').innerText(),'剖面放大镜');
  await page.locator('[data-painted=registered]').waitFor();
  const c=page.locator('.strata-canvas'),read=page.locator('.strata-readout');
  await layer(page,'contact');
  await page.keyboard.press('ArrowDown');await layer(page,'fine');
  await page.keyboard.press('ArrowUp');await layer(page,'contact');
  await page.screenshot({path:out+'strata-context.jpg',quality:89});
  const cases=[['roots',74],['sand',164],['contact',joint(638)],['fine',319]];
  const unique=new Set();
  for(const [id,y] of cases){await pick(page,638,y);await layer(page,id);unique.add(await page.locator('.strata-copy').innerText());}
  assert.equal(unique.size,4);
  await pick(page,130,8);await layer(page,'fine');
  await c.press('ArrowUp');await layer(page,'contact');
  await c.press('ArrowLeft');
  assert.match(await read.innerText(),/西段/);
  await c.press('Enter');await page.locator('[data-painted=detail]').waitFor();
  await page.screenshot({path:out+'strata-detail.jpg',quality:91});
  await c.press('ArrowRight');await layer(page,'contact');
  assert.match(await read.innerText(),/东段/);
  await c.press('Space');await page.locator('[data-scale=context]').waitFor();
  await page.locator('.strata-basis summary').click();
  assert.equal(await page.locator('.strata-basis a').count(),2);
  assert.ok((await page.locator('.strata-basis p').innerText()).includes('16 层'));
  await page.evaluate(()=>{window.disposeLens();window.disposeLens();});
  assert.equal(await c.count(),0);
  await mount(page);await mount(page);assert.equal(await c.count(),1);
  await page.evaluate(()=>document.querySelector('dialog').close());
  await c.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  report.checks.push('Desktop clicks map four depths to four independent evidence notes; ceiling clicks ignored.','Keyboard switches layers, tracks the same boundary between both sampling windows, and changes magnification.','Source note and two links, remount, double cleanup, close and zero progress writes.');
  await context.close();
  const mobile=await open(true);
  await mount(mobile.page);
  await mobile.page.locator('[data-painted=registered]').waitFor();
  for(const [id,y] of cases){await pick(mobile.page,638,y,true);await layer(mobile.page,id);}
  await mobile.page.locator('[data-sample=sand]').tap();
  await mobile.page.getByRole('button',{name:'放大 2.8×'}).tap();
  await mobile.page.locator('[data-painted=detail]').waitFor();
  await mobile.page.getByRole('button',{name:'换到西窗'}).tap();await layer(mobile.page,'sand');
  await mobile.page.screenshot({path:out+'strata-touch.jpg',quality:89});
  await mobile.page.getByRole('button',{name:'返回原位'}).tap();
  const bounds=await mobile.page.locator('#strata-dialog').evaluate(el=>[el.scrollWidth,el.clientWidth,document.documentElement.scrollWidth,window.innerWidth]);
  assert.ok(bounds[0]<=bounds[1]+1 && bounds[2]<=bounds[3]+1,JSON.stringify(bounds));
  report.touchBounds=bounds;
  report.checks.push('390px true touchscreen: all four depths, magnification, cross-window selection, return and horizontal fit.');
  await mobile.context.close();
  assert.deepEqual(report.errors,[]);await writeFile(out+'strata-checks.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await browser?.close();await server.close();}

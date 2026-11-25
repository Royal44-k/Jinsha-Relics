import {chromium} from 'playwright';
import {createServer} from 'vite';
import {existsSync} from 'node:fs';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const render=process.argv.includes('--render');
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
await server.listen();
const origin=server.resolvedUrls.local[0],output='docs/v11/collection';
const fixture='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/v10/expedition.css"><link rel="stylesheet" href="/src/v11/collection.css"></head><body style="margin:0;background:#141f20"><dialog id="folio" class="collection-open" style="width:min(910px,96vw)"><div id="folio-body"><h2>商周大金面具</h2><section id="museum"></section></div></dialog></body></html>';
const report={driver:'Independent Vite stage fixture with production endgame component, bundled model and materials.',checks:[],errors:[]};
let browser;
async function newCase({fallback=false,touch=false}={}) {
  const context=await browser.newContext({viewport:touch?{width:390,height:830}:{width:960,height:700},hasTouch:touch});
  await context.routeWebSocket(/^ws:\/\/(127\.0\.0\.1|localhost):/,()=>{});
  const page=await context.newPage();page.setDefaultTimeout(150000);
  if(fallback) await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:original.call(this,type,...args);};
  });
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/__gold-study',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));
  await page.goto(origin+'__gold-study',{waitUntil:'domcontentloaded',timeout:120000});
  await page.evaluate(()=>document.querySelector('dialog').showModal());
  assert.equal(await page.locator('#folio-body h2').innerText(),'商周大金面具');
  return {context,page};
}
const mount=async page=>page.evaluate(async ()=>{
  const {mountGoldMask}=await import('/src/v11/gold-mask.js');
  window.unmountMask=mountGoldMask(document.getElementById('museum'));
});
const hash=page=>page.locator('.gold-mask-live canvas').evaluate(c=>c.toDataURL('image/webp',.72));
try {
  await mkdir(output,{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const {page,context}=await newCase();
  if(render){
    const plates=await page.evaluate(async()=>{
      const {maskViews}=await import('/src/v11/gold-mask.js');
      const {createArtifactStage}=await import('/src/v11/collection-inspection.js');
      const canvas=document.createElement('canvas');document.body.append(canvas);
      const stage=await createArtifactStage(canvas,'mask',680);
      const output=[];
      for(const view of maskViews){
        stage.inspect(view.pose);
        output.push({id:view.id,image:canvas.toDataURL('image/webp',.88)});
      }
      stage.dispose();canvas.remove();return output;
    });
    for(const plate of plates) await writeFile('public/assets/v11/collections/mask-'+plate.id+'.webp',Buffer.from(plate.image.split(',')[1],'base64'));
    console.log('Rendered',plates.length,'original gallery views');
  }
  await mount(page);
  await page.locator('.gold-mask-room[data-mode=live]').waitFor();
  const canvas=page.locator('.gold-mask-live canvas');
  assert.equal(await page.getByRole('link',{name:/成都金沙遗址博物馆/}).getAttribute('href'),'https://www.jinshasitemuseum.com/node/197');
  const front=await hash(page);
  await page.getByRole('button',{name:'翻看内面',exact:true}).click();
  assert.notEqual(await hash(page),front);
  assert.match(await page.locator('.gold-mask-reading').textContent(),/内面.*粗糙/);
  assert.equal(await page.getByRole('button',{name:'换正光',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'眼口镂孔',exact:true}).click();
  const eyes=await hash(page);
  await canvas.focus();await page.keyboard.press('ArrowRight');
  assert.notEqual(await hash(page),eyes);
  await page.getByRole('button',{name:'器物全貌',exact:true}).click();
  await page.screenshot({path:output+'/gold-mask-room.jpg',type:'jpeg',quality:86});
  await page.getByRole('button',{name:'收起模型',exact:true}).click();
  assert.ok(await page.locator('.gold-mask-room[data-mode=still]').isVisible());
  for(const id of ['eyes','ear','back','whole']){
    await page.locator('.gold-mask-views [data-view='+id+']').click();
    assert.ok(await page.locator('.gold-mask-stills img').evaluate(async image=>{await image.decode();return image.naturalWidth>500;}));
  }
  await page.getByRole('button',{name:'开启三维展台',exact:true}).click();
  await page.locator('.gold-mask-room[data-mode=live]').waitFor();
  await page.evaluate(()=>{window.unmountMask();window.unmountMask();});
  assert.equal(await page.locator('.gold-mask-room canvas, .gold-mask-room').count(),0);
  await mount(page);await page.evaluate(()=>document.querySelector('dialog').close());
  await page.waitForFunction(()=>!document.querySelector('.gold-mask-room'));
  report.checks.push('True front, side and concave back material views. Keyboard orbit changes rendered pixels. All four matching high-resolution stills decode. Reopen, double cleanup and native dialog close remove the stage.');
  await context.close();
  const mobile=await newCase({touch:true});await mount(mobile.page);
  await mobile.page.locator('.gold-mask-room[data-mode=live]').waitFor();
  const touchCanvas=mobile.page.locator('.gold-mask-live canvas');
  const box=await touchCanvas.boundingBox();
  const cdp=await mobile.context.newCDPSession(mobile.page);
  const before=await hash(mobile.page);
  const x=box.x+box.width*.35,y=box.y+box.height*.46;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+6*i,y:y+2*i}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.notEqual(await hash(mobile.page),before);
  assert.ok(await mobile.page.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  report.checks.push('Injected native touch input rotates the actual canvas; 390px gallery has no horizontal overflow.');
  await mobile.context.close();
  const weak=await newCase({fallback:true});
  await mount(weak.page);await weak.page.locator('.gold-mask-room[data-mode=fallback]').waitFor();
  await weak.page.getByRole('button',{name:'翻看内面',exact:true}).click();
  assert.ok(await weak.page.locator('.gold-mask-stills img').evaluate(async i=>{await i.decode();return i.src.endsWith('/mask-back.webp');}));
  assert.equal(await weak.page.locator('.gold-mask-live canvas').count(),0);
  await weak.page.screenshot({path:output+'/gold-mask-static-back.jpg',type:'jpeg',quality:83});
  report.checks.push('With WebGL unavailable all four observation controls, original stills and museum context remain reachable.');
  await weak.context.close();assert.deepEqual(report.errors,[]);
  console.log(report.checks);
} catch(error) {
  report.failure=String(error.stack||error);throw error;
} finally {
  await writeFile(output+'/gold-mask-checks.json',JSON.stringify(report,null,2));
  await browser?.close();await server.close();
}


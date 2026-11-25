import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out='docs/v11/collection/';
const reports=[];
const isolated=process.argv.includes('--isolated');
let browser;
try {
  browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [width,height] of [[390,844],[320,740]]) {
    const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    let release;
    const fullSizeReady=new Promise(resolve=>{release=resolve;});
    await page.route('**/assets/v11/collections/form-*.webp',async route=>{await fullSizeReady;await route.continue();});
    await page.routeWebSocket(/^ws:\/\/(127\.0\.0\.1|localhost):/,()=>{});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    if(isolated)await page.route('**/__wardrobe-test',route=>route.fulfill({
      contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/v10/expedition.css"><link rel="stylesheet" href="/src/v11/expedition.css"><button id="cover-profile">羽灵档案</button><dialog id="folio" class="collection-open"><div id="folio-body"><h2>羽装与能力</h2><section id="panel"></section></div></dialog><script type="module">import {createCollection} from "/src/v11/collection.js";const collection=createCollection();document.querySelector("#cover-profile").onclick=()=>{document.querySelector("dialog").showModal();collection.mountWardrobe(document.querySelector("#panel"));};</script>'
    }));
    await page.goto(server.resolvedUrls.local[0]+(isolated?'__wardrobe-test':''),{waitUntil:'domcontentloaded',timeout:120000});
    await page.locator('#cover-profile').tap({timeout:120000});
    const thumbs=page.locator('.jc-form-image');
    await thumbs.first().waitFor();
    // Hold the high-resolution responses until every bird has been measured on screen.
    for(const resolution of [80,560]){
      if(resolution===560){release();await page.locator('#folio').evaluate(el=>el.scrollTop=0);}
      await page.waitForFunction(size=>document.querySelectorAll('.jc-form-image img').length===3&&[...document.querySelectorAll('.jc-form-image img')].every(i=>i.complete&&i.naturalWidth===size),resolution,{timeout:9000});
      const initial=await thumbs.evaluateAll(nodes=>nodes.map(n=>{
        const img=n.querySelector('img'),r=img.getBoundingClientRect(),v=n.getBoundingClientRect();
        return {source:img.currentSrc.startsWith('data:')?'embedded':img.currentSrc.split('/').pop(),loaded:img.complete,image:[r.width,r.height],box:[v.width,v.height]};
      }));
      console.log('Opened',width,JSON.stringify(initial));
      for(const item of initial)assert.ok(item.loaded&&Math.min(...item.image)>55,'Images must have decoded dimensions before first scroll');
      const originalScreen=await page.screenshot({type:'jpeg',quality:92});
      const samples=[];
      for(const thumb of await thumbs.all()) {
        await thumb.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
        const before=await thumb.screenshot({animations:'disabled',scale:'css'});
        const art=thumb.locator('img');
        await art.evaluate(el=>{el.style.visibility='hidden';});
        const empty=await thumb.screenshot({animations:'disabled',scale:'css'});
        await art.evaluate(el=>{el.style.removeProperty('visibility');});
        const pixels=await page.evaluate(async urls=>{
          const images=await Promise.all(urls.map(async src=>{const i=new Image();i.src=src;await i.decode();return i;}));
          const w=images[0].width,h=images[0].height;
          const data=images.map(img=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(img,0,0);return g.getImageData(0,0,w,h).data;});
          let minX=w,minY=h,maxX=-1,maxY=-1,painted=0;
          for(let y=0;y<h;y++)for(let x=0;x<w;x++){
            const p=4*(y*w+x);
            if(Math.abs(data[0][p]-data[1][p])+Math.abs(data[0][p+1]-data[1][p+1])+Math.abs(data[0][p+2]-data[1][p+2])<34)continue;
            painted++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
          }
          return {box:[w,h],visible:[minX,minY,maxX,maxY],painted};
        },[before,empty].map(b=>'data:image/png;base64,'+b.toString('base64')));
        const [x1,y1,x2,y2]=pixels.visible;
        assert.ok(x2-x1>=pixels.box[0]*.75 && y2-y1>=105 && pixels.painted>2400,'Bird must be visible in the actual screenshot '+JSON.stringify(pixels));
        assert.ok(x1>=1 && x2<pixels.box[0]-1 && y1>=2 && y2<pixels.box[1]-1,'Bird must remain fully framed');
        samples.push(pixels);
      }
      assert.equal(await page.locator('#folio').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
      assert.deepEqual(errors,[]);
      reports.push({width,height,resolution,initial,samples,errors});
      const name=width===390?'feather-mobile.jpg':'feather-mobile-320.jpg';
      if(width===390 && !isolated)await writeFile(resolution===80?out+'feather-mobile-first-frame.jpg':'docs/v11/campaign/portrait-wardrobe.jpg',originalScreen);
      if(resolution===560&&!isolated)await writeFile(out+name,originalScreen);
    }
    await page.close();
  }
  if(!isolated)await writeFile(out+'portrait-checks.json',JSON.stringify(reports,null,2)+'\n');
  console.log('PASSED',JSON.stringify(reports));
} finally {await browser?.close();await server.close();}

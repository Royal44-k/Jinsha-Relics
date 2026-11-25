import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {chapterIds} from '../src/v10/ledger.js';

const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});
await server.listen();
const address='http://127.0.0.1:'+server.httpServer.address().port;
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(address+'/credits-v10.html');
  await page.evaluate(async()=>{
    document.head.querySelectorAll('link[rel="stylesheet"],style').forEach(node=>node.remove());
    const viewport=document.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';document.head.append(viewport);
    document.body.style.margin='0';const host=document.createElement('main');host.style.height='100dvh';document.body.replaceChildren(host);
    // Exercise the flat-renderer path, including a silent audio context, without starting a second travelling world.
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};
    const photo=document.createElement('canvas');photo.width=80;photo.height=50;const p=photo.getContext('2d');
    p.fillStyle='#987859';p.fillRect(0,0,80,50);p.fillStyle='#e9d1b5';p.fillRect(12,22,50,6);
    const jpeg=photo.toDataURL('image/jpeg');window.printPhotos=[jpeg,jpeg,jpeg];
    const {mountFinale}=await import('/src/v10/sanctuary.js');
    const {renderFieldTriptych}=await import('/src/v14/field-triptych.js');
    window.rendered=id=>renderFieldTriptych(id,window.printPhotos);
    const audio=new AudioContext(),base=audio.createOscillator.bind(audio);window.tones=0;window.level=0;
    audio.createOscillator=()=>{window.tones++;return base();};
    window.endTrial=mountFinale(host,{
      reduced:true,photos:window.printPhotos,fieldTriptych:['paleochannel','jade-cut','nine-posts'],
      audioContext:audio,audioDestination:audio.destination,get volume(){return window.level;},
      complete:r=>{window.printResult=r;}
    });
  });
  const tap=text=>page.getByRole('button',{name:text,exact:true}).tap();
  for(let i=0;i<4;i++)await tap('向右移步');
  await tap('沿轴候日');await tap('略过镜头，进入展厅');await tap('进入九站印相台　→');
  assert.equal(await page.locator('[data-print="jade-cut"]').getAttribute('aria-checked'),'true');
  const cdp=await page.context().newCDPSession(page);
  async function drag(from,to){
    const point=(x,y)=>[{x,y,radiusX:4,radiusY:4,id:1}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(from.x,from.y)});
    for(let i=1;i<=12;i++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(from.x+(to.x-from.x)*i/12,from.y+(to.y-from.y)*i/12)});
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  async function center(selector){
    const b=await page.locator(selector).boundingBox();assert.ok(b,selector);return {x:b.x+b.width/2,y:b.y+b.height/2};
  }
  await drag(await center('[data-print="river-trench"]'),await center('[data-print="root-survey"]'));
  assert.equal(await page.locator('[data-print="root-survey"]').getAttribute('aria-checked'),'true');
  await page.locator('[data-print=ivory-record]').tap();
  await tap('把三幅排入印框');
  assert.equal(await page.locator('.js-print-frames img').nth(2).getAttribute('src'),await page.evaluate(()=>window.printPhotos[0]));
  await tap('重选底片');
  assert.equal(await page.locator('[data-print="root-survey"]').getAttribute('aria-checked'),'true');
  await tap('把三幅排入印框');
  const frame=await page.locator('.js-print-work').boundingBox(),start=await center('.js-print-handle');
  await drag(start,{x:frame.x+frame.width-4,y:start.y});
  assert.equal(await page.locator('.js-print-room').getAttribute('data-phase'),'printed');
  assert.equal(await page.evaluate(()=>window.tones),0);
  const out=process.env.JINSHA_PROOF;
  if(out){await mkdir(out,{recursive:true});await page.screenshot({path:join(out,'touch-triptych.jpg'),type:'jpeg',quality:88});}
  await tap('完成探险，查看收获　→');
  const result=await page.evaluate(()=>window.printResult);
  assert.deepEqual(result,{dawnAligned:true,fieldTriptych:['root-survey','jade-cut','ivory-record']});
  const combinations=await page.evaluate(ids=>{
    let n=0;
    for(const a of ids.slice(0,3))for(const b of ids.slice(3,6))for(const c of ids.slice(6)){
      const work=window.rendered([a,b,c]);if(work?.querySelectorAll('.js-print-frame').length===3)n++;
    }
    return n;
  },chapterIds);
  assert.equal(combinations,27);assert.deepEqual(errors,[]);
  const summary={viewport:'390×844',input:'CDP touch events',renderer:'Canvas2D',reducedMotion:true,
    handedBack:result.fieldTriptych,combinations,mutedOscillators:0,restoredEdition:true,photoRetained:true,errors};
  if(out)await writeFile(join(out,'touch-triptych.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
} finally{await browser.close();await server.close();}

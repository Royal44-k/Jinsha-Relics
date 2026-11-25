import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const fixture={name:'sanctuary-verification',configureServer(dev){
  dev.middlewares.use('/__sanctuary_check',(request,response)=>{response.setHeader('content-type','text/html; charset=utf-8');response.end(harness);});
}};
const server=await createServer({plugins:[fixture],server:{host:'127.0.0.1',port:0,hmr:false,strictPort:false},logLevel:'error'});
await server.listen();
const base='http://127.0.0.1:'+server.httpServer.address().port;
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const flat=process.env.SANCTUARY_2D==='1';
const options={headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding',...(flat?['--disable-webgl','--disable-gpu']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]};
if(process.env.BROWSER_PATH)options.executablePath=process.env.BROWSER_PATH;
else if(existsSync(edge))options.executablePath=edge;
const browser=await chromium.launch(options);
const errors=[],issues=[],directory=process.env.SANCTUARY_SHOTS;
if(directory)mkdirSync(directory,{recursive:true});
const harness=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}main{height:100dvh}#result{position:fixed;bottom:0}</style><main></main><output id="result"></output><script type="module">
import {mountSanctuary,mountFinale} from '/src/v10/sanctuary.js';
import {evidencePlate} from '/src/v10/evidence-plates.js';
import {validFilm,encode,restore,chapterIds} from '/src/v10/ledger.js';
let live; const host=document.querySelector('main'),out=document.querySelector('#result');
const bus=new AudioContext(), tap=bus.createAnalyser(), sink=bus.createGain();sink.gain.value=0;tap.connect(sink);sink.connect(bus.destination);
const samples=new Float32Array(tap.fftSize);window.audioPeak=0;setInterval(()=>{tap.getFloatTimeDomainData(samples);for(const value of samples)window.audioPeak=Math.max(window.audioPeak,Math.abs(value));},40);
window.checkFilm=async photos=>{
 const film=validFilm(photos),saved=restore(encode({...restore(null),completed:chapterIds.slice(0,7),photos:film}));
 if(saved.photos.join('|')!==photos.join('|'))throw Error('The three plates did not survive ledger encoding');
 return Promise.all(film.map(async url=>{
  const img=new Image();img.src=url;await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const pen=c.getContext('2d');pen.drawImage(img,0,0);const data=pen.getImageData(0,0,c.width,c.height).data;
  let lo=255,hi=0;for(let i=0;i<data.length;i+=52){const l=.25*data[i]+.59*data[i+1]+.16*data[i+2];lo=Math.min(lo,l);hi=Math.max(hi,l);}
  return {width:img.width,height:img.height,bytes:atob(url.split(',')[1]).length,contrast:Math.floor(hi-lo)};
 }));
};
window.inspectPlates=()=>{const samples=[];host.replaceChildren();host.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);align-content:start;height:auto;gap:4px;background:#363c32;padding:6px';for(let i=0;i<9;i++){const c=evidencePlate(i);c.style.margin=0;host.append(c);samples.push(c.toDataURL());}return new Set(samples).size;};
window.start=id=>{live?.abort();live=new AbortController();out.textContent='';const opts={signal:live.signal,reduced:false,audioContext:bus,audioDestination:tap,volume:1,complete(result){out.textContent=id+':'+JSON.stringify(result||{});live.abort();}};if(id==='finale')mountFinale(host,opts);else mountSanctuary(id,host,opts);};</script></html>`;
try {
 for(const small of [false,true]){
  const page=await browser.newPage({viewport:small?{width:390,height:844}:{width:1200,height:760},hasTouch:small});
  page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')issues.push(message.text()+' '+message.location().url);});
  await page.goto(base+'/__sanctuary_check');await page.waitForFunction(()=>typeof window.start==='function');
  const tap=async node=>small?node.tap():node.click();
  const shot=async id=>{if(directory){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:directory+'/'+id+(small?'-phone':'-desk')+'.jpg',type:'jpeg',quality:88});}};
  const start=async id=>{
    await page.evaluate(v=>window.start(v),id);
    try{await page.waitForFunction(()=>document.querySelector('.jss-surface canvas')?.width>200);}
    catch(error){
      const state=await page.evaluate(()=>({root:document.querySelector('main')?.innerText,width:document.querySelector('.jss-surface canvas')?.width,canvasBounds:document.querySelector('.jss-surface canvas')?.getBoundingClientRect().toJSON(),visibility:document.visibilityState}));
      throw new Error(id+' failed to present its viewport. '+JSON.stringify({state,errors,issues}),{cause:error});
    }
  };
  const done=async id=>{await page.waitForFunction(id=>document.querySelector('#result').textContent.startsWith(id+':'),id);assert.equal(await page.locator('main > *').count(),0);};
  const slider=async val=>{
    const input=page.getByRole('slider'),bounds=await input.boundingBox(),lo=Number(await input.getAttribute('min')),hi=Number(await input.getAttribute('max'));
    const point={x:8+(bounds.width-16)*(val-lo)/(hi-lo),y:bounds.height/2};
    if(small)await input.tap({position:point});else await input.click({position:point});
    const remaining=val-Number(await input.inputValue());
    for(let i=0;i<Math.abs(remaining);i++)await input.press(remaining>0?'ArrowRight':'ArrowLeft');
  };
  await start('ivory-record');await shot('07-ivory');
  const drawingBuffer=await page.locator('.jss-surface canvas').evaluate(c=>c.getContext('webgl2')?.getContextAttributes()?.preserveDrawingBuffer??null);
  if(!flat)assert.equal(drawingBuffer,false,'Photo test must run with the real WebGL buffer policy');
  const shutter=page.getByRole('button',{name:'按下快门'});
  await tap(shutter);assert.match(await page.locator('.jss-note').textContent(),/先点/);
  const exposed=[];
  for(const [sequence,i] of [2,0,1].entries()){
    const mark=sequence===0?page.locator('.jss-focus-mark').nth(i):page.locator('.jss-film button').nth(i);
    await tap(mark);
    if(sequence===0){await tap(shutter);assert.match(await page.locator('.jss-note').textContent(),/分开/);}
    await slider([74,46,27][i]);await tap(shutter);assert.equal(await page.locator('.jss-film .exposed').count(),sequence+1);
    exposed[i]=await page.locator('.jss-film i').nth(i).evaluate(cell=>cell.style.backgroundImage.match(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/)[0]);
  }
  await shot('07-exposed');await tap(page.getByRole('button',{name:/封存三格/}));await done('ivory-record');
  const captured=JSON.parse((await page.locator('#result').textContent()).slice('ivory-record:'.length)).photos;
  assert.deepEqual(captured,exposed);assert.equal(new Set(captured).size,3);
  const metrics=await page.evaluate(photos=>window.checkFilm(photos),captured);
  assert.equal(metrics.length,3);for(const m of metrics){assert.equal(m.width,256);assert.equal(m.height,164);assert.ok(m.bytes<=24576&&m.contrast>=6);}
  console.log(JSON.stringify({device:small?'touch':'desktop',preserveDrawingBuffer:drawingBuffer,photographs:metrics}));
  if(process.argv.includes('--film')){await page.close();continue;}
  await start('sunfoil');await shot('08-foil');
  await tap(page.getByRole('button',{name:'固定透光灯'}));assert.match(await page.locator('.jss-note').textContent(),/68/);
  await slider(75);await tap(page.getByRole('button',{name:'固定透光灯'}));
  if(small){for(let i=0;i<12;i++)await tap(page.getByRole('button',{name:/逆时针拓一段/}));}
  else{
    const bounds=await page.locator('.jss-gesture').boundingBox(),circle=page.locator('.jss-guide');
    const [cx,cy,r]=await Promise.all(['cx','cy','r'].map(key=>circle.getAttribute(key).then(Number)));
    const point=i=>[bounds.x+cx+Math.cos(-Math.PI/2-i*Math.PI/32)*r,bounds.y+cy+Math.sin(-Math.PI/2-i*Math.PI/32)*r];
    await page.mouse.move(...point(0));await page.mouse.down();for(let i=1;i<=64;i++)await page.mouse.move(...point(i));await page.mouse.up();
  }
  await shot('08-trace');for(let i=0;i<12;i++)await tap(page.getByRole('button',{name:/顺时针拓一段/}));
  await tap(page.getByRole('button',{name:/收起负形拓片/}));await done('sunfoil');
  await start('nine-posts');await shot('09-court');
  await tap(page.getByRole('button',{name:'听参考短句'}));await page.waitForFunction(()=>document.querySelector('.jss-note')?.textContent.includes('木、河、石'));
  assert.ok(await page.evaluate(()=>window.audioPeak>.005),'The gallery audio must reach the caller’s bus');
  for(const n of [0,1,2])await tap(page.locator('.jss-post').nth(n));
  await tap(page.getByRole('button',{name:'奏响九柱'}));await page.waitForFunction(()=>document.querySelector('.jss-note')?.textContent.includes('还未合上'));
  for(const n of [3,1,8])await tap(page.locator('.jss-post').nth(n));
  await tap(page.getByRole('button',{name:'奏响九柱'}));await tap(page.getByRole('button',{name:/留下九柱/}));await done('nine-posts');
  await start('finale');await shot('10-opening');
  if(!small){await page.waitForFunction(()=>document.querySelector('.jss-final-lines small')?.textContent.includes('空白'));await shot('10-record');}
  await tap(page.getByRole('button',{name:'跳至题记'}));await shot('10-finale');
  const inscription=small?'让想象留下可辨的笔迹':'让证据保有原来的位置';
  await tap(page.getByRole('button',{name:inscription}));await tap(page.getByRole('button',{name:/回到河岸/}));await done('finale');
  assert.match(await page.locator('#result').textContent(),new RegExp(inscription));
  assert.equal(await page.evaluate(()=>window.inspectPlates()),9);
  const plateShot=process.env.SANCTUARY_PLATES||(directory&&directory+'/evidence-plates.jpg');
  if(!small&&plateShot)await page.locator('main').screenshot({path:plateShot,type:'jpeg',quality:92});
  console.log((small?'Touch 390×844':'Mouse 1200×760')+' completed all four scenes');await page.close();
 }
 const expectedContextError=s=>flat&&(/Error creating WebGL context|A WebGL context could not be created/.test(s));
 assert.deepEqual(errors,[]);assert.deepEqual(issues.filter(s=>!/favicon|ERR_ABORTED/.test(s)&&!expectedContextError(s)),[]);
}finally{await browser.close();await server.close();}


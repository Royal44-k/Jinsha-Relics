import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {Vector3,Scene} from 'three';
import {createSurveyWorld,ground,westEdge} from '../src/v10/geography.js';
import {FIELD_TRAILS,createFieldTrails} from '../src/v11/field-trails.js';
import {planSurveyFlight} from '../src/v10/survey-flight.js';

const place=FIELD_TRAILS.find(item=>item.id==='carbon-rice');
const world=createSurveyWorld(),scene=new Scene();
createFieldTrails(scene,{},world);
const pos=(x,z)=>new Vector3(x,ground(x,z),z);
const start=pos(-11,40),entry=pos(...place.entry);
assert.ok(westEdge(place.z)<place.x-8);
assert.equal(world.sample(entry).boundary,null);
assert.ok(planSurveyFlight(world,start,entry));
const wall=world.resolveMotion(pos(place.x-6,place.z-1.7),pos(place.x-3.4,place.z-1.7),.23).hit;
assert.ok(wall,'West wall must stop a crossing');
assert.ok(!world.resolveMotion(pos(place.x-2.7,place.z+2.1),pos(place.x-2.7,place.z-.6),.23).hit,'Doorway must admit the bird');

const touch=process.argv.includes('--touch');
const out=process.env.JINSHA_PROOF||(touch?'docs/v14/yard-touch':'docs/v14');
await mkdir(out,{recursive:true});
const external=process.env.JINSHA_ORIGIN;
const server=external?null:await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});
if(server)await server.listen();
const origin=external||'http://127.0.0.1:'+server.httpServer.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
  const page=await browser.newPage({viewport:touch?{width:390,height:844}:{width:1220,height:820},isMobile:touch,hasTouch:touch,reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    let seen=false;
    const proto=window.WebGL2RenderingContext?.prototype;
    if(!proto)return;
    for(const method of ['texImage2D','texSubImage2D']){
      const original=proto[method];
      proto[method]=function(...args){
        const source=args.at(-1);
        if(!seen&&source instanceof HTMLImageElement&&source.src.endsWith('/assets/v14/daub.webp')){
          seen=true;window.yardFirstMaterialUpload=window.__JINSHA_SURVEY__?.snapshot().motion?.position;
        }
        return original.apply(this,args);
      };
    }
  });
  const cdp=touch?await page.context().newCDPSession(page):null;
  const press=loc=>touch?loc.tap():loc.click();
  async function drag(points){
    if(cdp){
      const send=(type,list)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:list.map(([x,y])=>({x,y,id:1}))});
      await send('touchStart',[points[0]]);
      for(const point of points.slice(1))await send('touchMove',[point]);
      await send('touchEnd',[]);
    }else{
      await page.mouse.move(...points[0]);await page.mouse.down();
      for(const point of points.slice(1))await page.mouse.move(...point);
      await page.mouse.up();
    }
  }
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await press(page.locator('#enter'));
  await press(page.getByRole('button',{name:'落到探方边'}));
  await page.waitForFunction(()=>document.body.dataset.mode==='travel',null,{timeout:160000});
  await press(page.locator('#notebook'));
  await press(page.locator('#folio [data-map-place="carbon-rice"]'));
  await press(page.getByRole('button',{name:/在罗盘标记/}));
  await press(page.locator('#notebook'));
  assert.equal(await page.getByRole('combobox',{name:'选择地图地点'}).inputValue(),'carbon-rice');
  await press(page.getByRole('button',{name:'回到河岸',exact:true}));
  await press(page.locator('#guide'));
  await page.waitForFunction(()=>document.querySelector('#guide').textContent==='循迹领航'&&document.querySelector('#interact').textContent.includes('西台烟火里')&&!document.querySelector('#interact').hidden,null,{timeout:70000});
  await page.screenshot({path:join(out,'west-yard-arrival.jpg'),quality:85});
  const snap=()=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
  const arrived=await snap();
  const firstUpload=await page.evaluate(()=>window.yardFirstMaterialUpload);
  assert.ok(firstUpload,'The yard wall texture must reach the actual WebGL renderer on the approach');
  const revealDistance=+Math.hypot(firstUpload[0]-place.x,firstUpload[2]-place.z).toFixed(1);
  assert.ok(revealDistance<=place.revealRadius+.1,'Yard textures became visible outside the reveal radius: '+revealDistance);
  await press(page.locator('#interact'));
  const lab=page.locator('#flotation-room'),canvas=lab.locator('canvas');
  await canvas.waitFor();
  const firstContext=await canvas.evaluateHandle(c=>c.getContext('webgl2'));
  assert.equal(await firstContext.evaluate(gl=>!!gl&&!gl.isContextLost()),true);
  if(touch)await press(lab.getByRole('button',{name:'返回小院'}));else await page.keyboard.press('Escape');
  await lab.waitFor({state:'detached'});
  assert.equal(await firstContext.evaluate(gl=>gl.isContextLost()),true);
  await firstContext.dispose();
  assert.deepEqual((await snap()).collection.fieldFinds,[]);
  await press(page.locator('#interact'));await canvas.waitFor();
  let scale,cx,cy;
  async function center(){
    const rect=await canvas.boundingBox();
    scale=Math.min(rect.width/5.6,rect.height/4.64);cx=rect.x+rect.width/2;cy=rect.y+rect.height*.47;
  }
  await center();
  const circle=[];
  for(let i=0;i<=48;i++){const a=Math.PI*4*i/48;circle.push([cx+scale*Math.cos(a),cy+scale*.75*Math.sin(a)]);}
  await drag(circle);await press(lab.getByRole('button',{name:'取网勺'}));await center();
  const sweep=[[cx-scale*1.3,cy-scale*.8]];
  for(let row=0;row<6;row++){
    const y=cy+scale*(-.92+.34*row);
    for(let i=0;i<=13;i++)sweep.push([cx+scale*(row%2?-1:1)*(-1.36+2.72*i/13),y]);
  }
  await drag(sweep);
  assert.ok(await lab.locator('.float-submit').isVisible(),await lab.locator('output').innerText());
  await press(lab.getByRole('button',{name:'移入阴干观察盘'}));await center();
  const rotate=()=>drag(Array.from({length:9},(_,i)=>[cx-52+i*14,cy]));
  await rotate();await press(lab.getByRole('button',{name:'登记此件为稻粒'}));
  assert.equal(await lab.getAttribute('data-phase'),'inspect');
  await press(lab.getByRole('button',{name:'标本乙'}));await rotate();
  await page.screenshot({path:join(out,'flotation-rice-study.jpg'),quality:87});
  await press(lab.getByRole('button',{name:'登记此件为稻粒'}));
  await press(lab.getByRole('button',{name:'收录图记，返回小院'}));
  await lab.waitFor({state:'detached'});
  const end=await snap();
  assert.ok(end.collection.fieldFinds.includes('carbon-rice'));
  assert.equal(end.collection.totalXP-arrived.collection.totalXP,12);
  await press(page.locator('#interact'));await canvas.waitFor();
  assert.equal(await canvas.evaluate(c=>!c.getContext('webgl2').isContextLost()),true);
  await press(lab.getByRole('button',{name:'返回小院'}));
  await lab.waitFor({state:'detached'});
  assert.equal((await snap()).collection.totalXP,end.collection.totalXP);
  await press(page.locator('#notebook'));await press(page.getByRole('button',{name:'珍藏与鉴定'}));await press(page.getByRole('button',{name:/炭化稻粒图记/}));
  const citation=await page.locator('a[href$="/info/4877"]').count();assert.ok(citation);
  assert.deepEqual(errors,[]);
  const entryBundle=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).find(s=>/\/expedition-[\w-]+\.js$/.test(s)));
  const report={origin,entryBundle,input:touch?'touch emulation':'mouse and keyboard',found:end.collection.fieldFinds,xp:end.collection.totalXP-arrived.collection.totalXP,wall,doorway:true,position:arrived.motion.position,firstWallTextureUploadMetres:revealDistance,privateContextReleased:true,completedYardReopened:true,citation,errors};
  await writeFile(join(out,'west-yard.json'),JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();await server?.close();}

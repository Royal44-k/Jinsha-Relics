import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const phone=process.env.JINSHA_TOUCH==='1';
const out=process.env.JINSHA_PROOF||'docs/v16/river-passage'+(phone?'/mobile':'');
await mkdir(out,{recursive:true});
const host=process.env.JINSHA_ORIGIN;
const server=host?null:await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});
if(server)await server.listen();
const origin=host||'http://127.0.0.1:'+server.httpServer.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const size=phone?{width:390,height:844}:{width:1280,height:720};
const ctx=await browser.newContext({viewport:size,...(phone?{hasTouch:true,isMobile:true,reducedMotion:'reduce'}:{}),...(process.env.JINSHA_RECORD?{recordVideo:{dir:out,size}}:{})});
const page=await ctx.newPage();
const touch=phone?await ctx.newCDPSession(page):null;
async function steer(key,down){
  if(!touch)return down?page.keyboard.down(key):page.keyboard.up(key);
  if(!down)return touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const b=await page.locator('#stick').boundingBox();
  assert.ok(b,'touch joystick is reachable');
  const offset={KeyD:[.64,.5],KeyA:[.36,.5],KeyW:[.51,.13]}[key];
  return touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*offset[0],y:b.y+b.height*offset[1]}]});
}
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',message=>{if(message.type()==='error'&&/NaN|THREE.WebGLProgram|WebGL: INVALID/i.test(message.text()))errors.push(message.text().slice(0,260));});
const snap=()=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().motion);
const photo=name=>page.screenshot({path:out+'/'+name+'.jpg',quality:90});
try{
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:130000});
  await page.locator('#enter').click();
  await page.getByRole('button',{name:'落到探方边'}).click();
  await page.waitForFunction(()=>document.body.dataset.mode==='travel',null,{timeout:160000});
  await page.locator('#world-view canvas').focus();
  const start=await snap();
  console.log('Grounded shore contacts',JSON.stringify(start.footContacts));
  await writeFile(out+'/ground-contact.json',JSON.stringify({position:start.position,feet:start.footContacts},null,2));
  for(const foot of start.footContacts){
    assert.ok(foot.planted&&Math.abs(foot.ground-foot.rendered)<.001);
    assert.ok(Math.abs(foot.at[1]-foot.ground)<.023,'closed foot must reach the supporting triangle');
  }
  if(!phone){
    await page.keyboard.press('p');
    const workbench=page.locator('.field-photo'),lens=workbench.locator('canvas');
    await lens.focus();
    for(let i=0;i<12;i++)await lens.press('ArrowLeft');
    const download=page.waitForEvent('download');
    await workbench.getByRole('button',{name:'保存实景照片'}).click();
    await(await download).saveAs(out+'/grounded-plumage.jpg');
    await page.keyboard.press('Escape');
    await page.locator('#world-view canvas').focus();
  }
  assert.ok(start.waterbirds.visible&&start.waterbirds.flights===0);
  // Steer with the same keys as a player; coordinates are only read back.
  if(phone)await page.locator('#cruise').tap();
  else await page.keyboard.press('KeyR');
  await steer('KeyD',true);
  await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.yaw<-.95,null,{polling:'raf',timeout:10000});
  await steer('KeyD',false);const approachYaw=(await snap()).yaw;await steer('KeyW',true);
  await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.waterbirds.flights>0,null,{timeout:20000});
  await steer('KeyW',false);
  const rise=await snap();await photo('takeoff');
  if(phone)assert.ok(Math.abs(rise.yaw-approachYaw)<.045,'pushing the thumb forward may not steer the bird');
  await steer('KeyA',true);
  await page.waitForFunction(heading=>window.__JINSHA_SURVEY__.snapshot().motion.yaw>heading,phone?-.87:-.60,{polling:'raf',timeout:10000});
  await steer('KeyA',false);
  await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.waterbirds.center[1]>1.75,null,{timeout:30000});
  await photo('flight');
  await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.waterbirds.pool===1,null,{timeout:45000});
  const settled=await snap();
  assert.equal(settled.waterbirds.flights,1);
  assert.equal(await page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().completed.length),0);
  assert.deepEqual(errors,[]);
  const entry=await page.locator('script[type=module]').first().getAttribute('src');
  await writeFile(out+'/river-passage.json',JSON.stringify({origin,entry,controls:phone?'touch / reduced motion':'keyboard',approachYaw,start,rise,settled,errors},null,2));
}catch(e){console.error(await snap().catch(()=>null));await photo('failure').catch(()=>{});throw e;}
finally{await ctx.close();await browser.close();await server?.close();}

const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const out='docs/v7/camera-final';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),report={at:new Date().toISOString(),errors:[],angles:[]};page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.route('**/@vite/client',async r=>{const q=await r.fetch();await r.fulfill({response:q,body:(await q.text()).replace('case "update":','case "test-disabled-update":').replace('case "full-reload":','case "test-disabled-full-reload":')});});
  await page.route('**/src/v2/main.js*',async r=>{const q=await r.fetch();await r.fulfill({response:q,body:(await q.text())+'\nwindow.__CAMERA_PROBE__=()=>{const target=position.clone().add(new THREE.Vector3(0,.85,0)),dir=target.clone().sub(camera.position),ray=new THREE.Raycaster(camera.position,dir.clone().normalize(),0,Math.max(0,dir.length()-.1));return {colliders:adventure.cameraColliders.length,hits:ray.intersectObjects(adventure.cameraColliders,true).length,camera:camera.position.toArray(),hero:position.toArray()};};'});});
  await page.goto('http://127.0.0.1:5186');await page.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});await page.locator('#start-btn').click();await page.keyboard.press('KeyW');
  const d=await page.evaluate(()=>window.__JINSHA_V2__.adventureDebug());
  for(const id of ['root-socket-2','light-wheel-1']){
   const p=d.targets.find(t=>t.id===id).position;await page.evaluate(p=>window.__JINSHA_V2__.goPoint(p),p);
   for(let i=0;i<8;i++){await page.evaluate(a=>window.__JINSHA_V2__.look(a),i*Math.PI/4);await page.waitForTimeout(100);const state=await page.evaluate(()=>window.__CAMERA_PROBE__());report.angles.push({id,angle:i*45,...state});assert.ok(state.colliders>=11);assert.equal(state.hits,0,id+' camera-to-hero clearance at '+i);if(i===2||i===5)await page.screenshot({path:out+'/'+id+'-'+i+'.png'});}
  }
  report.gl=await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getError());assert.equal(report.gl,0);assert.deepEqual(report.errors,[]);console.log(JSON.stringify({checkedViews:report.angles.length,occluded:report.angles.filter(x=>x.hits).length,gl:report.gl,errors:report.errors},null,2));
 }catch(e){report.failure=e.stack;await page.screenshot({path:out+'/failure.png'});throw e;}finally{await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});

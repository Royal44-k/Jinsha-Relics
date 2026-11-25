const legacyEntry=require('./legacy-entry-v9.cjs');
const {chromium}=require('playwright'),fs=require('node:fs');
const OUT='docs/v9/motion';fs.mkdirSync(OUT,{recursive:true});
const report={at:new Date().toISOString(),errors:[],samples:[]};
function instrument(source){return source.replace('last=performance.now();frame=requestAnimationFrame(tick);',`window.__MOTION_REVIEW__={
get:()=>({yaw,pitch,position:position.toArray(),visual:visualPosition.toArray(),camera:camera.position.toArray(),target:cameraTarget.toArray(),characterYaw:character.group.rotation.y,motion:motion.getSnapshot(),water:traversal.sample(position)}),
freeze:()=>cancelAnimationFrame(frame),resume:()=>{last=performance.now();frame=requestAnimationFrame(tick);},
render:(dof)=>{bokeh.enabled=dof;composer.render();},
sample:(array)=>traversal.sample(new THREE.Vector3().fromArray(array)),
point:(f,l,y)=>{const p=forest.sample(f*forest.length),t=forest.path.getTangentAt(f);p.add(new THREE.Vector3(-t.z,0,t.x).multiplyScalar(l));p.y=y;return p.toArray();}};
last=performance.now();frame=requestAnimationFrame(tick);`);}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
await page.route('**/@vite/client',r=>r.fulfill({status:200,contentType:'application/javascript',body:'export function updateStyle(id,content){let s=document.getElementById(id);if(!s){s=document.createElement("style");s.id=id;document.head.appendChild(s);}s.textContent=content;}export function removeStyle(id){document.getElementById(id)?.remove();}export function createHotContext(){return {accept(){},dispose(){},on(){},send(){},invalidate(){},prune(){}}}'}));
await page.route('**/src/v2/main.js*',async r=>{try{const response=await r.fetch({timeout:60000});await r.fulfill({response,body:instrument(await response.text())});}catch(e){report.errors.push('route: '+e.message);await r.abort();}});
await page.goto(legacyEntry(),{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__MOTION_REVIEW__,null,{timeout:120000});
await page.evaluate(()=>__MOTION_REVIEW__.freeze());await page.evaluate(()=>__MOTION_REVIEW__.render(true));await page.screenshot({path:OUT+'/baseline-title-dof.png'});await page.evaluate(()=>__MOTION_REVIEW__.render(false));await page.screenshot({path:OUT+'/baseline-title-clear.png'});await page.evaluate(()=>__MOTION_REVIEW__.resume());
await page.locator('#start-btn').click();await page.waitForTimeout(3500);await page.evaluate(()=>__JINSHA_V2__.go(15));await page.waitForTimeout(800);
report.before=await page.evaluate(()=>__MOTION_REVIEW__.get());await page.keyboard.down('KeyD');await page.waitForTimeout(1600);await page.keyboard.up('KeyD');report.after=await page.evaluate(()=>__MOTION_REVIEW__.get());await page.screenshot({path:OUT+'/baseline-strafe.png'});
report.river=await page.evaluate(()=>{const rows=[];for(const f of [.17,.225,.3,.31,.4,.65])for(const l of [7,9,11,13,15])for(const y of [-1.4,-.62,-.34,0]){const p=__MOTION_REVIEW__.point(f,l,y);rows.push({f,l,y,p,sample:__MOTION_REVIEW__.sample(p)});}return rows;});
const river=report.river.filter(r=>r.sample.waterDepth>.7).sort((a,b)=>b.sample.waterDepth-a.sample.waterDepth)[0];
if(river){await page.evaluate(p=>__JINSHA_V2__.goPoint(p),river.p);await page.waitForTimeout(1500);await page.keyboard.down('KeyD');for(let i=0;i<60;i++){await page.waitForTimeout(50);report.samples.push(await page.evaluate(()=>__MOTION_REVIEW__.get()));}await page.keyboard.up('KeyD');await page.screenshot({path:OUT+'/baseline-water.png'});}
report.gl=await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getError());fs.writeFileSync(OUT+'/baseline-runtime.json',JSON.stringify(report,null,2));console.log(JSON.stringify({before:report.before,after:report.after,waterModes:[...new Set(report.samples.map(s=>s.motion.mode))],errors:report.errors,gl:report.gl}));
}finally{await browser.close();fs.writeFileSync(OUT+'/baseline-runtime.json',JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});

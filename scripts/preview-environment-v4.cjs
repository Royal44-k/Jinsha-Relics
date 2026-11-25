const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 fs.mkdirSync('docs/v4/environment-runtime',{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.goto('http://127.0.0.1:5187/environment-preview-v4.html');
  await page.waitForFunction(()=>window.ready,null,{timeout:120000});
  const report={shots:[],errors};
  for(const [name,f,side,height] of [['root',.105,1,3.2],['gap',.302,3,3.4],['shore',.205,5,2.3],['hamlet',.56,-4,3.8],['posts',.84,1,3.4]]){
   const stats=await page.evaluate(a=>{window.shot(...a);return {...window.preview.renderer.info.render,detail:window.preview.detail.stats()};},[f,side,height]);
   await page.screenshot({path:`docs/v4/environment-runtime/${name}.png`});report.shots.push({name,...stats});
  }
  await page.evaluate(()=>{const {world}=window.preview,p=world.pool;window.look([p.x-2,-1.7,p.z+4],[p.x,-1.6,p.z-3]);});
  await page.screenshot({path:'docs/v4/environment-runtime/underwater.png'});
  // Explicit close views show roof fibres, clay mouths and grain silhouettes.
  for(const name of ['Timber and thatch · artistic interpretation','Rice field · original domestic impression']){
   await page.evaluate(name=>{const {world,THREE:T}=window.preview,o=world.group.getObjectByName(name),p=o.getWorldPosition(new T.Vector3()),q=new T.Vector3(name.startsWith('Timber')?-4.2:4,name.startsWith('Timber')?3.5:1.3,name.startsWith('Timber')?-5:-6).applyEuler(o.rotation).add(p);window.look(q.toArray(),p.clone().add(new T.Vector3(0,name.startsWith('Timber')?1.9:.65,0)).toArray());},name);
   await page.screenshot({path:`docs/v4/environment-runtime/${name.startsWith('Timber')?'thatch-close':'rice-close'}.png`});
  }
  report.quality=await page.evaluate(()=>{const {detail,camera,renderer,scene,world,forest,THREE:T}=window.preview;const p=forest.sample(forest.length*.56);window.shot(.56,-7,2.4);const checks=[];for(const quality of ['high','low']){detail.update(.016,4,p,camera,quality);renderer.render(scene,camera);checks.push({quality,...detail.stats(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});}return {checks,pool:world.sample(world.pool),bridge:world.sample(world.bridges[0].centre),gap:world.sample(world.gorge)};});
  assert.ok(report.quality.pool.waterDepth>2.7);assert.ok(report.quality.gap.groundHeight< -5);assert.equal(report.quality.bridge.groundHeight,.15);
  assert.ok(report.quality.checks[0].activeDraws<=12);assert.ok(report.quality.checks[1].activeDraws<=6);assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/v4/environment-runtime/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5218';
const read=page=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().motion);
async function verifyMotion(page){
  const until=(predicate,args,timeout=90000)=>page.waitForFunction(predicate,args,{timeout});
  async function waypoint(title){
    await page.locator('#notebook').click();await page.locator('summary').filter({hasText:'地图支线'}).click();
    await page.getByRole('button',{name:'标记 · '+title,exact:true}).click();
    await page.locator('#guide').click();
    await until(title=>{
      const local=document.querySelector('#interact');
      return !local.hidden&&local.textContent.includes(title)&&document.querySelector('#guide').textContent==='循迹领航';
    },title);
  }
  const checks={};
  async function capture(name){
    if(!process.env.JINSHA_PROOF)return;
    fs.mkdirSync(process.env.JINSHA_PROOF,{recursive:true});
    await page.screenshot({path:path.join(process.env.JINSHA_PROOF,name+'.jpg'),type:'jpeg',quality:89});
  }
  await waypoint('西岸织棚');await page.keyboard.press('r');
  await until(()=>!document.querySelector('#perch').hidden&&document.querySelector('#perch').textContent.includes('织棚老树横枝'));
  await page.keyboard.press('t');
  await until(()=>window.__JINSHA_SURVEY__.snapshot().motion.perchId==='spindle-living-bough');
  const landed=await read(page);assert.equal(landed.mode,'perched');checks.perch=landed.position;
  await capture('bough');
  await page.keyboard.press('t');await until(()=>window.__JINSHA_SURVEY__.snapshot().motion.mode!=='perched');
  await page.keyboard.press('r');await until(()=>window.__JINSHA_SURVEY__.snapshot().motion.cruise);
  await until(()=>document.querySelector('#motion-name').textContent==='持续飞行');
  checks.cruise=await page.locator('#motion-name').innerText();
  await waypoint('北汊渔地');await until(()=>window.__JINSHA_SURVEY__.snapshot().motion.mode==='swimming');
  await page.evaluate(()=>{
    window.riverLensSamples=[];
    function sample(){
      if(!window.riverLensSamples)return;
      const {cameraY,waterMix,fogDensity}=window.__JINSHA_SURVEY__.snapshot().motion;
      window.riverLensSamples.push({cameraY,waterMix,fogDensity});requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.keyboard.down('c');
  try{await until(()=>{const m=window.__JINSHA_SURVEY__.snapshot().motion;return m.mode==='diving'&&m.position[1]<-.62&&m.oxygen<1&&m.waterMix>.48;});}
  finally{await page.keyboard.up('c');}
  checks.dive=(await read(page)).position;
  await capture('submerged');
  await page.keyboard.press('Space');await until(()=>window.__JINSHA_SURVEY__.snapshot().motion.mode==='swimming');
  await until(()=>window.__JINSHA_SURVEY__.snapshot().motion.waterMix<.04);
  const samples=await page.evaluate(()=>{const samples=window.riverLensSamples;window.riverLensSamples=null;return samples;});
  const inBetween=samples.filter(s=>s.waterMix>.06&&s.waterMix<.94);
  assert.ok(inBetween.length>=2);assert.ok(samples.some(s=>s.cameraY<-.1&&s.fogDensity>.06));
  checks.lens={frames:samples.length,transitional:inBetween.length,peakMix:Math.max(...samples.map(s=>s.waterMix))};
  checks.surface=(await read(page)).position;
  // Continue along the water rather than jumping the barrier. The inward
  // current and warning start before the survey bounds, then reverse cleanly.
  await page.keyboard.down('w');
  try{await until(()=>window.__JINSHA_SURVEY__.snapshot().motion.boundary.includes('向南方'));}
  finally{await page.keyboard.up('w');}
  const border=await read(page);checks.boundary={position:border.position,message:border.boundary};assert.ok(border.position[2]>-84);
  await capture('river-boundary');
  await page.keyboard.down('s');
  try{await until(()=>{const m=window.__JINSHA_SURVEY__.snapshot().motion;return !m.boundary&&m.position[2]>-78;});}
  finally{await page.keyboard.up('s');}
  checks.returned=(await read(page)).position;
  return checks;
}
module.exports={verifyMotion};
if(require.main===module)(async()=>{
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser=await chromium.launch({channel:fs.existsSync(edge)?'msedge':undefined,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:800,height:600},reducedMotion:'reduce'});
  try{
    const failures=[];page.on('pageerror',e=>failures.push(e.message));page.setDefaultTimeout(90000);
    await page.goto(origin);await page.locator('#enter').click();await page.getByRole('button',{name:'落到探方边',exact:true}).click();
    await page.waitForFunction(()=>document.body.dataset.mode==='travel',null,{timeout:150000});
    console.log(JSON.stringify(await verifyMotion(page),null,2));assert.deepEqual(failures,[]);
  }catch(e){console.error(await read(page),await page.locator('#travel-message').textContent());throw e;}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

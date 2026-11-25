const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.SURVEY_URL||'http://127.0.0.1:5188/';
const dest=path.resolve(__dirname,'../docs/v10/workshops/entry-audit');fs.mkdirSync(dest,{recursive:true});
const mobile=process.argv.includes('--mobile'),label=mobile?'portrait':'desktop',checks=[];
async function run(){
  const browser=await chromium.launch({headless:true,executablePath:process.env.WORKSHOP_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1120,height:700},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
  page.setDefaultTimeout(45000);const cdp=await page.context().newCDPSession(page),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
  const snap=()=>page.evaluate(()=>window.__JINSHA_SURVEY__?.snapshot());
  const mark=name=>{checks.push(name);console.log(label,name);};
  const shot=async name=>{
    const {data}=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:80,fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true});
    fs.writeFileSync(path.join(dest,label+'-'+name+'.jpg'),Buffer.from(data,'base64'));
  };
  const click=async sel=>{const loc=page.locator(sel);if(mobile)await loc.tap();else await loc.click();};
  const state=mode=>page.waitForFunction(m=>window.__JINSHA_SURVEY__?.snapshot().mode===m,mode,{timeout:60000});
  const hold=async(sel,xRatio,yRatio)=>{
    const r=await page.locator(sel).boundingBox();
    const p={x:r.x+r.width*xRatio,y:r.y+r.height*yRatio,id:1,radiusX:5,radiusY:5,force:.7};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
  };
  const release=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const frames=n=>page.evaluate(n=>new Promise(resolve=>{function next(){if(--n<=0)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);}),n);
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('#enter').waitFor();
    const bundle=await page.locator('script[type="module"]').first().getAttribute('src');
    console.log(label,'bundle',bundle);await shot('cover');await page.waitForTimeout(1150);await shot('cover-settled');mark('title');
    await click('#cover-profile');await page.waitForFunction(()=>{const img=document.querySelector('.bird-plate img');return img?.complete&&img.naturalWidth===900;});await shot('bird-card');await click('#folio-close');mark('actual V10 plumage portrait');
    await click('#enter');await page.locator('#folio[open]').waitFor();await shot('intro');mark('first prologue');
    await click('#folio-body .folio-buttons button');await state('travel');
    await page.waitForFunction(()=>window.__JINSHA_SURVEY__?.snapshot().motion?.drawCalls>0,null,{timeout:90000});
    await shot('start');const initial=await snap(),startWaypoint=await page.locator('#waypoint').getAttribute('style');mark('river world');
    if(mobile){await hold('#stick',.87,.30);await frames(7);await release();}
    else{await page.keyboard.down('d');await frames(7);await page.keyboard.up('d');await page.keyboard.down('w');await frames(8);await page.keyboard.up('w');}
    await frames(4);const turning=await snap(),turnWaypoint=await page.locator('#waypoint').getAttribute('style');await shot('turn');
    assert.notDeepEqual(turning.motion.position,initial.motion.position);
    mark('changed course');
    if(mobile){
      const at=turning.motion.position;await click('#dash');await frames(5);
      const after=(await snap()).motion.position;assert.ok(Math.hypot(after[0]-at[0],after[2]-at[2])>.2);
      assert.equal(await page.locator('#stick').isVisible(),true);mark('touch dash');
    }
    if(mobile)await click('#cruise');else await page.keyboard.press('r');
    await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.mode==='flying');await frames(5);await shot('airborne');
    const flying=await snap();mark('sustained flight');
    if(mobile){await click('#cruise');await hold('#down',.5,.5);}
    else{await page.keyboard.press('r');await page.keyboard.down('c');}
    await page.waitForFunction(()=>['grounded','swimming','perched'].includes(window.__JINSHA_SURVEY__.snapshot().motion.mode),null,{timeout:60000});
    if(mobile)await release();else await page.keyboard.up('c');
    const landed=await snap();mark('landed');
    await click('#notebook');await state('journal');await shot('journal');
    await click('#folio-close');await state('travel');mark('notebook and return');
    await click('#guide');await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().near||window.__JINSHA_SURVEY__.snapshot().mode==='activity',null,{timeout:90000});
    // Nearness can become true several seconds before the guide actually lands.
    await page.waitForFunction(()=>document.querySelector('#motion-name').textContent!=='领航'||window.__JINSHA_SURVEY__.snapshot().mode==='activity',null,{timeout:90000});
    if((await snap()).mode!=='activity')await click('#interact');
    await state('activity');await frames(4);await shot('first-station');mark('entered first station');
    await click('#leave');await state('travel');await page.locator('#interact').waitFor();
    await click('#interact');await state('activity');mark('left and re-entered first station');
    // Quit with the trench still open. Only completed records should persist.
    const beforeReload=await page.evaluate(()=>JSON.parse(localStorage.getItem('jinsha-river-survey-v10')));
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#enter')?.textContent.includes('继续调查'));
    await click('#enter');await state('travel');await frames(3);await shot('resumed');
    const recovered=await snap();assert.deepEqual(recovered.completed,beforeReload.completed);assert.equal(recovered.site,'river-trench');
    mark('interruption and recovery');
    const layout=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],objective:document.querySelector('#objective').getBoundingClientRect().toJSON(),action:document.querySelector('#guide').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));
    assert.equal(layout.overflow,false);
    const report={base,bundle,device:label,checks,initial,turning,startWaypoint,turnWaypoint,flying,landed,recovered,layout,errors,failed};
    console.log(JSON.stringify(report));fs.writeFileSync(path.join(dest,label+'.json'),JSON.stringify(report,null,2));
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  }catch(error){
    try{await shot('failure');console.error(label,'snapshot',await snap(),await page.locator('body').innerText(),errors,failed);}catch{}
    throw error;
  }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});

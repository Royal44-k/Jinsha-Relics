const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const output=path.resolve(process.env.JINSHA_PROOF||path.join(__dirname,'../docs/v12/campaign'));
fs.mkdirSync(output,{recursive:true});
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
async function main(){
  const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(edge)?edge:undefined});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage(),issues=[];
  page.on('pageerror',error=>issues.push(error.message));
  page.on('response',response=>{if(response.status()>=400)issues.push(response.url());});
  page.setDefaultTimeout(70000);
  const shot=name=>page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:86});
  try{
    await page.goto(origin);await page.locator('#enter').waitFor();
    assert.equal(await page.title(),'金沙：古蜀秘境');await shot('portrait-cover');
    await page.locator('#cover-profile').tap();await page.locator('.jc').waitFor();
    assert.equal(await page.locator('#folio').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
    await page.waitForFunction(()=>{const image=document.querySelector('.jc-form-image img');return image?.complete&&image.naturalWidth>0&&image.getBoundingClientRect().width>40;});
    assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(e=>/bird-portrait[^/]*\.js/.test(e.name))),false);
    await shot('portrait-wardrobe');await page.locator('#observe-guide').tap();
    await page.getByRole('button',{name:'返回羽装',exact:true}).waitFor();
    await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>/bird-portrait[^/]*\.js/.test(e.name)));
    await page.getByRole('button',{name:'返回羽装',exact:true}).tap();
    await page.locator('#observe-guide').waitFor();await page.locator('#folio-close').tap();
    await page.locator('#enter').tap();await page.getByRole('button',{name:'九柱方位'}).tap();
    assert.match(await page.locator('.witness p').innerText(),/冬至/);
    assert.equal(await page.locator('#folio').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
    await page.getByRole('button',{name:'落到探方边'}).tap();
    await page.waitForFunction(()=>window.__JINSHA_SURVEY__?.snapshot().mode==='travel',null,{timeout:100000});
    await page.locator('#cruise').tap();await page.waitForFunction(()=>/飞|翼|翔/.test(document.getElementById('motion-name').textContent));
    await shot('portrait-river');await page.locator('#notebook').tap();
    await page.locator('summary',{hasText:'地图支线'}).tap();
    assert.equal(await page.locator('.trail-options button').count(),4);
    await page.locator('.trail-options button').first().tap();
    await page.waitForFunction(()=>document.getElementById('task').textContent.includes('织'));
    assert.deepEqual(issues,[]);
    fs.writeFileSync(path.join(output,'portrait.json'),JSON.stringify({ok:true,viewport:'390 × 844 emulated touch in Edge',checks:['title and illustrated field dossier fit','optional 3D character observation loads on request and returns to wardrobe','prologue locations touchable','cruise from real travel HUD','open notebook and track optional field trail'],issues},null,2));
    console.log('Portrait entry, dossier, flight and tracked trail passed');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

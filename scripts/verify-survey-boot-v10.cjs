const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const folder=path.resolve(process.env.JINSHA_PROOF||path.join(__dirname,'../docs/v12/campaign'));
fs.mkdirSync(folder,{recursive:true});
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function check(){
  const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(edge)?edge:undefined});
  try{
    const context=await browser.newContext({viewport:{width:1220,height:720},reducedMotion:'reduce'}),page=await context.newPage(),checks=[];
    page.setDefaultTimeout(65000);
    let requested,release;
    const held=new Promise(resolve=>requested=resolve),gate=new Promise(resolve=>release=resolve);
    await page.route('**/assets/shuoyu*.glb',async route=>{
      requested();await gate;await route.abort();
    });
    const enter=async()=>{
      await page.locator('#enter').click();await page.getByRole('button',{name:'落到探方边'}).click();
    };
    await page.goto(url);await enter();await held;
    assert.ok(await page.locator('#embark').isVisible());
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'2');
    assert.ok(await page.locator('#cover').evaluate(node=>node.inert));
    await page.screenshot({path:path.join(folder,'loading.jpg'),type:'jpeg',quality:86});
    checks.push('Delayed model leaves the illustrated loading screen and actual resource stage visible');
    release();await page.waitForFunction(()=>document.querySelector('#boot-state').textContent.includes('重试'));
    assert.ok(await page.locator('#embark').isHidden());assert.ok(await page.locator('#enter').isEnabled());
    assert.equal(await page.locator('#cover').evaluate(node=>node.inert),false);
    checks.push('Failure returns to an operable title and retains the repair message');
    await page.unroute('**/assets/shuoyu*.glb');await enter();
    await page.waitForFunction(()=>window.__JINSHA_SURVEY__?.snapshot().mode==='travel'&&window.__JINSHA_SURVEY__.snapshot().motion.drawCalls>0);
    assert.ok(await page.locator('#embark').isHidden());
    assert.ok(await page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().motion.position.every(Number.isFinite)));
    checks.push('Retry with the model restored enters the rendered river on the same page with reduced motion');
    // Also read the state actually written by the preference UI from a stale tab.
    const second=await context.newPage();await second.goto(url);
    await second.locator('#enter').click();await second.locator('#notebook').waitFor();
    const known=await page.evaluate(()=>localStorage.getItem('jinsha-ancient-shu-v11'));
    await page.locator('#mute').click();await second.locator('#notebook').click();
    await second.locator('summary',{hasText:'画面与性能'}).click();
    await second.getByRole('combobox',{name:'地图画面质量'}).selectOption('economy');
    await second.waitForFunction(()=>{const r=JSON.parse(localStorage.getItem('jinsha-ancient-shu-v11'));return r?.quality==='economy'&&r.muted;});
    assert.ok(JSON.parse(known).started);checks.push('Independent same-origin tabs preserve both mute and quality settings');
    fs.writeFileSync(path.join(folder,'boot-retry.json'),JSON.stringify({url,checks,ok:true},null,2));console.log(checks.join('\n'));
  }finally{await browser.close();}
}
check().catch(error=>{console.error(error);process.exitCode=1;});

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5194';
const snap=page=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
async function collectTrails(page){
  async function mark(title){
    await page.locator('#notebook').click();await page.locator('summary').filter({hasText:'地图支线'}).click();
    await page.getByRole('button',{name:'标记 · '+title,exact:true}).click();
    await page.locator('#guide').click();
    await page.waitForFunction(title=>{
      const local=document.querySelector('#interact');
      return !local.hidden&&local.textContent.includes(title)&&document.querySelector('#guide').textContent==='循迹领航';
    },title,{timeout:90000});
  }
  async function walkToTool(label){
    await page.keyboard.down('w');
    try{await page.waitForFunction(text=>document.querySelector('#task').textContent.includes('按 E '+text),label,{timeout:100000});}
    finally{await page.keyboard.up('w');}
  }
  async function found(id){
    await page.keyboard.press('e');
    await page.waitForFunction(key=>window.__JINSHA_SURVEY__.snapshot().collection.fieldFinds.includes(key),id,{timeout:15000});
  }
  await mark('西岸织棚');
  for(const label of ['检查牵麻工位','检查加捻工位','登记纺轮']){
    await walkToTool(label);
    if(label==='登记纺轮')await found('spindle');else await page.keyboard.press('e');
  }
  await mark('东台石场');await page.keyboard.press('r');
  await page.waitForFunction(()=>document.querySelector('#task').textContent.includes('按 E 登记'),null,{timeout:60000});
  await found('stoneblank');
  await mark('北汊渔地');
  await page.waitForFunction(()=>document.querySelector('#motion-name').textContent==='浮游');
  await page.keyboard.down('c');
  try{await page.waitForFunction(()=>document.querySelector('#task').textContent.includes('按 E 登记'),null,{timeout:35000});}
  finally{await page.keyboard.up('c');}
  await found('netsinker');
}
module.exports={collectTrails};
if(require.main===module)(async()=>{
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser=await chromium.launch({channel:fs.existsSync(edge)?'msedge':undefined,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:800,height:600},reducedMotion:'reduce'});
  try{
    page.on('pageerror',console.error);page.setDefaultTimeout(90000);
    await page.goto(origin);await page.locator('#enter').click();
    await page.getByRole('button',{name:'落到探方边',exact:true}).click();
    await page.waitForFunction(()=>document.body.dataset.mode==='travel',null,{timeout:140000});
    await collectTrails(page);
    const {collection}=await snap(page);assert.deepEqual([...collection.fieldFinds].sort(),['netsinker','spindle','stoneblank']);
    console.log(JSON.stringify({fieldFinds:collection.fieldFinds}));
  }catch(e){
    console.error(await snap(page),await page.locator('#task').innerText(),await page.locator('#boot-state').innerText());
    throw e;
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

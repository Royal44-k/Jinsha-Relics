const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

const button=(page,name)=>page.getByRole('button',{name,exact:true});
async function walkIvory(page,{capture}={}){
  const marks=page.locator('.jss-focus-mark');
  for(const [index,value] of [74,46,27].entries()){
    await marks.nth(index).click();await button(page,'按下快门').click();
    assert.match(await page.locator('.jss-note').innerText(),/同框比例尺/);
    if(index===0){
      // The camera eases towards a selected specimen. Playwright waits for
      // the projected drop point to settle before the actual pointer gesture.
      const landing=button(page,'放置同框比例尺');await landing.click({trial:true});
      await button(page,'拖动便携比例尺').dragTo(landing);
    } else await page.keyboard.press('b');
    const lens=page.getByRole('slider'),r=await lens.boundingBox();
    await lens.click({position:{x:8+(r.width-16)*(value-10)/80,y:r.height/2}});
    if(index===2)await capture?.('photography');
    await button(page,'按下快门').click();
    if(index===0){
      await button(page,'重拍选中底片').click();
      assert.equal(await page.locator('.jss-film .exposed').count(),0);
      await button(page,'按下快门').click();
    }
  }
  await page.getByRole('button',{name:/封存三格/}).click();
}
async function walkSunfoil(page,{capture}={}){
  await button(page,'判作镂空').click();
  assert.match(await page.locator('.jss-note').innerText(),/横拖试片/);
  for(const kind of ['镂空','折痕','缺口']){
    const shot=await page.locator('.jss-viewport').boundingBox();
    await page.mouse.move(shot.x+shot.width*.43,shot.y+shot.height*.53);await page.mouse.down();
    await page.mouse.move(shot.x+shot.width*.59,shot.y+shot.height*.55,{steps:7});await page.mouse.up();
    const h=await page.locator('.jss-lamp-handle').boundingBox(),rail=await page.locator('.jss-lamp-track').boundingBox();
    await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();
    await page.mouse.move(rail.x+rail.width-19,h.y+h.height/2,{steps:8});await page.mouse.up();
    assert.match(await page.locator('.jss-readout').innerText(),/已侧看.*2\/2/);
    if(kind==='镂空')await capture?.('optics');
    await button(page,'判作'+kind).click();
  }
  await button(page,'带走透光图版　→').click();
}
async function walkNinePosts(page,{capture,input=page}={}){
  async function span(from,to){
    const a=await button(page,'柱洞 '+from).boundingBox(),b=await button(page,'柱洞 '+to).boundingBox();
    await input.mouse.move(a.x+a.width/2,a.y+a.height/2);await input.mouse.down();
    await input.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:6});await input.mouse.up();
  }
  await span(1,5);
  assert.match(await page.locator('.jss-note').innerText(),/3.47 米/);
  await span(1,2);await input.keyboard.press('2');await input.keyboard.press('5');
  assert.match(await page.locator('.jss-note').innerText(),/对角线复核/);
  await span(1,5);
  await capture?.('baseline');
  await button(page,'沿东南轴线候日　→').click();
}
async function walkDawn(page,{watch=false,capture}={}){
  await button(page,'沿轴候日').click();
  assert.match(await page.locator('.jss-note').innerText(),/向右移步/);
  for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');
  await capture?.('solstice');
  await button(page,'沿轴候日').click();
  if(!watch)await button(page,'略过镜头，进入展厅').click();
  await button(page,'进入九站印相台　→').click({timeout:100000});
  await page.getByRole('radio',{name:'陶片的层位'}).click();
  await page.getByRole('radio',{name:'玉料的锯缝'}).press('ArrowRight');
  await page.getByRole('radio',{name:'象牙的叠压'}).click();
  assert.equal(await page.getByRole('radio',{name:'陶片的断口'}).getAttribute('aria-checked'),'true');
  await capture?.('contact-sheet');
  await button(page,'把三幅排入印框').click();
  const handle=page.getByRole('slider',{name:'从左向右推开印框遮板'});
  await handle.press('ArrowRight');
  assert.equal(await handle.getAttribute('aria-valuenow'),'10');
  await handle.press('End');
  assert.equal(await page.locator('.js-print-work figure,.js-print-work .js-print-frame').count(),3);
  await capture?.('gallery');
  await button(page,'完成探险，查看收获　→').click({timeout:100000});
}
module.exports={walkIvory,walkSunfoil,walkNinePosts,walkDawn};

// The fixture exercises the same exported mounts as the normal expedition.
// It has no save editor and feeds these walkthroughs only browser input.
if(require.main===module)(async()=>{
  const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5194';
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser=await chromium.launch({channel:fs.existsSync(edge)?'msedge':undefined,headless:true,
    args:process.env.JINSHA_GPU==='1'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const viewport=process.env.JINSHA_PORTRAIT==='1'?{width:390,height:800}:{width:960,height:610};
    const page=await browser.newPage({viewport});
    const faults=[];page.on('pageerror',err=>faults.push(err.message));
    page.on('console',msg=>{if(msg.type()==='error')faults.push(msg.location().url+' '+msg.text());});
    await page.route('**/favicon.ico',route=>route.fulfill({status:204}));
    await page.goto(origin+'/credits-v10.html');
    await page.evaluate(()=>{
      for(const el of document.querySelectorAll('style,link[rel=stylesheet]'))el.remove();
      document.body.style.margin='0';const host=document.createElement('main');host.style.height='100dvh';document.body.replaceChildren(host);
    });
    const results=[];
    for(const [id,walk] of [['ivory-record',walkIvory],['sunfoil',walkSunfoil],['nine-posts',walkNinePosts],['finale',walkDawn]]){
      await page.evaluate(async id=>{
        const {mountSanctuary,mountFinale}=await import('/src/v10/sanctuary.js');
        const host=document.querySelector('main');
        window.unmountStage?.();delete host.dataset.result;
        const options={complete:r=>{host.dataset.result=JSON.stringify(r??true);}};
        window.unmountStage=id==='finale'?mountFinale(host,options):mountSanctuary(id,host,options);
      },id);
      const capture=process.env.JINSHA_PROOF?async name=>{
        fs.mkdirSync(process.env.JINSHA_PROOF,{recursive:true});
        await page.screenshot({path:path.join(process.env.JINSHA_PROOF,name+'.jpg'),type:'jpeg',quality:89});
      }:null;
      await walk(page,{capture});
      const result=JSON.parse(await page.locator('main').getAttribute('data-result'));
      if(id==='ivory-record'){assert.ok(result.photos.every(src=>src.startsWith('data:image/jpeg;base64,')));results.push({photos:result.photos.length});}
      else results.push(result);
    }
    assert.deepEqual(results,[{photos:3},{optics:['镂空','折痕','缺口']},{bay:2.9,depth:1.9},{dawnAligned:true,fieldTriptych:['river-trench','clay-fit','ivory-record']}]);
    assert.deepEqual(faults,[]);console.log(JSON.stringify({passed:results},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

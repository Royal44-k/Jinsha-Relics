import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {chapterIds,saveKey} from '../src/v10/ledger.js';

const source=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const out=process.env.JINSHA_PROOF||'docs/v14';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({executablePath:existsSync(edge)?edge:undefined,headless:true});
const report={source,checks:[],screens:[]};
await mkdir(out,{recursive:true});

async function inspect(page){
  return page.locator('#folio').evaluate(folio=>{
    const body=folio.querySelector('.ledger-content'),row=folio.querySelector('nav.folio-buttons'),description=folio.querySelector('.atlas-description');
    const b=body.getBoundingClientRect(),n=row.getBoundingClientRect(),d=description.getBoundingClientRect();
    return {
      readerHeight:b.height,navHeight:n.height,overlap:Math.max(0,b.bottom-n.top),
      scrolled:body.scrollTop,readerBottom:b.bottom,descriptionTop:d.top,descriptionBottom:d.bottom,
      descriptionVisible:d.top>=b.top-1&&d.bottom<=b.bottom+1,
      descriptionHit:document.elementFromPoint(d.left+d.width/2,d.top+d.height/2)===description,
      navWidth:row.clientWidth,navTotal:row.scrollWidth,dialogOverflow:folio.scrollHeight-folio.clientHeight
    };
  });
}

async function visit(name,viewport,touch){
  const context=await browser.newContext({viewport,isMobile:touch,hasTouch:touch,deviceScaleFactor:1,reducedMotion:'reduce'});
  const errors=[],page=await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror',error=>errors.push(error.message));
  const press=loc=>touch?loc.tap():loc.click();
  const screen={name,viewport,touch,errors};report.screens.push(screen);
  try{
    await page.addInitScript(({key,ids})=>{
      if(window===window.top&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({
        version:1,started:true,completed:ids,quality:'economy',muted:true
      }));
    },{key:saveKey,ids:chapterIds.slice(0,4)});
    await page.goto(source,{waitUntil:'domcontentloaded'});
    const asset=await page.locator('script[type=module][src]').last().getAttribute('src');report.asset=asset;screen.asset=asset;
    await press(page.locator('#enter'));await press(page.locator('#notebook'));
    const atlas=page.locator('.field-atlas'),chooser=atlas.getByRole('combobox');
    const scroll=page.locator('.ledger-content'),nav=page.locator('#folio nav.folio-buttons');
    assert.equal(await chooser.inputValue(),'clay-fit');
    assert.equal(await atlas.locator('[data-map-place="bronze-shadow"]').count(),0);
    if(touch)await chooser.selectOption('jade-cut');
    else await press(atlas.locator('[data-map-place="jade-cut"]'));
    assert.equal(await chooser.inputValue(),'jade-cut');
    assert.match(await atlas.locator('.atlas-description').innerText(),/已归档.*直线.*米/);

    const replay=atlas.getByRole('button',{name:'就地回顾'});
    // Scroll only the reader. Leave the initiating target fully visible so the
    // browser also uses its natural focus restoration when the replay closes.
    await replay.evaluate(button=>{
      const scroller=button.closest('.ledger-content');
      const localY=button.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
      scroller.scrollTop=Math.max(1,localY-22);
    });
    const before=(await inspect(page)).scrolled;
    assert.ok(before>0);
    await press(replay);
    const frame=page.frameLocator('iframe[name=chapter-review]');
    await press(frame.locator('#leave'));await atlas.waitFor();
    assert.equal(await chooser.inputValue(),'jade-cut');
    assert.ok(Math.abs((await inspect(page)).scrolled-before)<=1);
    screen.restoredScroll=before;

    const checkpoint=await page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
    await chooser.selectOption('carbon-rice');
    // At normal desktop and portrait heights, the site note is visible even
    // from the top of a fresh book. A short landscape book has a scrollable map.
    await scroll.evaluate(el=>{el.scrollTop=0;});
    const first=await inspect(page);
    assert.ok(first.overlap<=1&&first.dialogOverflow<=1);
    assert.ok(first.readerHeight>115);
    if(viewport.height>=550)assert.ok(first.descriptionVisible&&first.descriptionHit,JSON.stringify(first));
    else await atlas.locator('.atlas-description').evaluate(el=>el.scrollIntoView({block:'nearest'}));
    const visible=await inspect(page);
    assert.ok(visible.descriptionVisible&&visible.descriptionHit&&visible.overlap<=1,JSON.stringify(visible));
    screen.geometry=visible;
    const file=name==='desktop'?'river-atlas.jpg':'river-atlas-'+name+'.jpg';
    await page.screenshot({path:out+'/'+file,type:'jpeg',quality:90});screen.image=file;

    if(visible.navTotal>visible.navWidth){
      const last=nav.getByRole('button',{name:'返回标题',exact:true});
      await last.evaluate(el=>el.scrollIntoView({block:'nearest',inline:'end'}));
      assert.ok(await nav.evaluate(el=>el.scrollLeft>0));
      assert.ok(await last.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
      await nav.evaluate(el=>{el.scrollLeft=0;});
      assert.ok(Math.abs((await inspect(page)).scrolled-visible.scrolled)<=1);
    }
    await press(atlas.getByRole('button',{name:'在罗盘标记'}));
    await page.waitForFunction(()=>document.getElementById('place').textContent==='西台烟火里');
    const here=await page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
    assert.ok(Math.hypot(...here.motion.position.map((v,i)=>v-checkpoint.motion.position[i]))<.1);
    await press(page.locator('#notebook'));assert.equal(await chooser.inputValue(),'carbon-rice');
    assert.equal(here.collection.totalXP,checkpoint.collection.totalXP);
    assert.deepEqual(here.completed,checkpoint.completed);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.body.dataset.mode==='travel'&&!document.getElementById('folio').open);
    assert.deepEqual(errors,[]);console.log(name,visible);
  }catch(error){screen.failure=String(error);throw error;}
  finally{await context.close();}
}

try{
  await visit('desktop',{width:1280,height:800},false);
  await visit('portrait',{width:390,height:844},true);
  await visit('landscape',{width:667,height:375},true);
  report.checks=['未揭晓主线保持隐藏','回顾后保留选中地点与正文滚动位置','说明和导航各自可见可点','横向查看导航保留正文阅读位置','原地标记西台后保留站位与阅历','Esc 合上地图返回河岸'];
  report.ok=true;
}finally{
  await writeFile(out+'/river-atlas.json',JSON.stringify(report,null,2));await browser.close();
}

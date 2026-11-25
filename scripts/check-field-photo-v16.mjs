import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

const server=process.argv.includes('--source')?await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}}):null;
if(server)await server.listen();
const origin=server?'http://127.0.0.1:'+server.httpServer.address().port:process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const out=process.env.JINSHA_PROOF||'docs/v16/photography';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1366,height:850},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(90000);
  await page.goto(origin);await page.locator('#enter').click();
  await page.getByRole('button',{name:'落到探方边'}).click();
  await page.waitForFunction(()=>document.body.dataset.mode==='travel'&&window.__JINSHA_SURVEY__.snapshot().motion.drawCalls>0);
  const snap=()=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
  const before=await snap();
  await page.keyboard.press('p');
  const room=page.locator('.field-photo'),preview=room.locator('canvas');
  await page.waitForFunction(()=>document.querySelector('.field-photo canvas')?.width>300);
  const signature=()=>preview.evaluate(canvas=>canvas.toDataURL('image/jpeg',.4));
  const initial=await signature();assert.ok(initial.length>4000);
  for(let i=0;i<12;i++)await preview.press('ArrowLeft');
  await page.waitForFunction(old=>document.querySelector('.field-photo canvas').toDataURL('image/jpeg',.4)!==old,initial);
  async function save(name){
    const downloaded=page.waitForEvent('download');await room.getByRole('button',{name:'保存实景照片'}).click();
    const file=await downloaded;await file.saveAs(out+'/'+name+'.jpg');
    return room.locator('a[download],small a').evaluate(async a=>{
      const blob=await(await fetch(a.href)).blob(),image=await createImageBitmap(blob);
      const size=[image.width,image.height];image.close();return size;
    });
  }
  assert.deepEqual(await save('river-portrait'),[1440,1920]);
  await room.locator('select').selectOption('.5625');assert.deepEqual(await save('river-vertical'),[1080,1920]);
  await room.getByText('恢复视角').click();await room.locator('select').selectOption('1.77777778');
  assert.deepEqual(await save('river-widescreen'),[1920,1080]);
  await page.keyboard.press('Escape');await room.waitFor({state:'detached'});
  const after=await snap();assert.deepEqual(before.completed,after.completed);
  assert.ok(Math.hypot(...before.motion.position.map((n,i)=>n-after.motion.position[i]))<.08);
  await page.keyboard.press('j');await page.getByRole('button',{name:'河岸摄影'}).click();
  await room.waitFor();
  await room.getByRole('button',{name:'关闭河岸摄影'}).click();assert.ok(await page.locator('#folio').isVisible());
  assert.deepEqual(errors,[]);
  const entry=await page.locator('script[type=module]').first().getAttribute('src');
  await page.close();
  const touch=[];
  const sizes=[{width:390,height:844},{width:667,height:375}];
  if(process.argv.includes('--landscape-first'))sizes.reverse();
  for(const viewport of sizes){
    const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,isMobile:true});
    const mobile=await context.newPage();
    mobile.setDefaultTimeout(60000);
    mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto(origin);await mobile.locator('#enter').tap();
    await mobile.getByRole('button',{name:'落到探方边'}).tap();
    await mobile.waitForFunction(()=>document.body.dataset.mode==='travel'&&window.__JINSHA_SURVEY__.snapshot().motion.drawCalls>0);
    const menu=mobile.locator('#field-menu:visible,#notebook:visible').first();
    await menu.tap();await mobile.getByRole('button',{name:'河岸摄影'}).tap();
    const panel=mobile.locator('.field-photo'),canvas=panel.locator('canvas');
    await mobile.waitForFunction(()=>document.querySelector('.field-photo canvas')?.width>300);
    await panel.evaluate(room=>{
      room.trace=[];
      for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture','click','touchstart','touchend','touchcancel']){
        document.addEventListener(type,e=>{
          const p=e.changedTouches?.[0]||e;
          const node=n=>n?.className||n?.tagName;
          room.trace.push({type,at:Math.round(performance.now()),x:p.clientX,y:p.clientY,target:node(e.target),
            hit:node(document.elementFromPoint(p.clientX,p.clientY)),trusted:e.isTrusted,id:e.pointerId});
        },{capture:true});
      }
    });
    const widthCheck=await panel.evaluate(e=>e.scrollWidth-e.clientWidth);
    assert.ok(widthCheck<=2,'photography dialog spills horizontally at '+viewport.width);
    const fingerprint=()=>canvas.evaluate(c=>c.toDataURL('image/jpeg',.26));
    const rect=await canvas.boundingBox(),x=rect.x+rect.width*.55,y=rect.y+rect.height*.5;
    await mobile.screenshot({path:out+'/touch-'+viewport.width+'.jpg',type:'jpeg',quality:78});
    assert.equal(await mobile.evaluate(([x,y])=>document.elementFromPoint(x,y)?.tagName,[x,y]),'CANVAS');
    assert.ok(await canvas.evaluate(c=>c.clientHeight<=c.parentElement.clientHeight+1),'preview fits viewfinder');
    const input=await context.newCDPSession(mobile);
    const originalFile=panel.locator('a[download]');
    const capture=()=>panel.evaluate(room=>{
      const save=room.querySelector('.photo-save'),rect=save.getBoundingClientRect();
      return {trace:room.trace,saveRect:rect.toJSON(),hit:document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.className,
        status:room.querySelector('[role=status]').textContent,disabled:save.disabled,scroll:room.scrollTop,visualScale:visualViewport.scale};
    });
    const rounds=Number(process.env.JINSHA_PHOTO_REPEATS)||(viewport.width===667?4:2);
    const downloads=[];mobile.on('download',file=>downloads.push(file));
    let lastUrl='';
    // Chromium can omit the compatibility click after a swipe: pointerup and
    // touchend reach an enabled save button, yet its former onclick never ran.
    // A single real tap must generate a fresh file each time, even on retries.
    for(let attempt=0;attempt<rounds;attempt++){
      const old=await fingerprint();
      // The link created on the first print may change the dialog height.
      const box=await canvas.boundingBox(),cx=box.x+box.width*.5,cy=box.y+box.height*.5;
      const contact=(type,dx)=>input.send('Input.dispatchTouchEvent',{type,
        touchPoints:type==='touchEnd'?[]:[{x:cx+dx,y:cy,id:2}]});
      const span=Math.min(57,box.width*.24)*(attempt%2?-1:1);
      await contact('touchStart',0);await contact('touchMove',span*.5);await contact('touchMove',span);await contact('touchEnd',span);
      await mobile.waitForFunction(old=>document.querySelector('.field-photo canvas').toDataURL('image/jpeg',.26)!==old,old);
      const save=panel.getByRole('button',{name:'保存实景照片'});
      const automatic=mobile.waitForEvent('download',{timeout:2200}).catch(()=>null);
      await save.tap();
      try{
        await mobile.waitForFunction(last=>{const url=document.querySelector('.field-photo a[download]')?.href;return url&&url!==last;},lastUrl,{timeout:12000});
      }catch(err){
        await writeFile(out+'/failure-'+viewport.width+'.json',JSON.stringify({attempt,...await capture()},null,2));
        throw err;
      }
      lastUrl=await originalFile.getAttribute('href');
      if(!await automatic&&downloads.length===attempt){
        const download=mobile.waitForEvent('download');await originalFile.tap();await download;
      }
      assert.equal(downloads.length,attempt+1);
      assert.match(downloads[attempt].suggestedFilename(),/\.jpg$/);
      assert.equal(await downloads[attempt].failure(),null);
      const jpeg=await originalFile.evaluate(async a=>{
        const blob=await (await fetch(a.href)).blob(),image=await createImageBitmap(blob);
        const result=[blob.type,image.width,image.height];image.close();return result;
      });
      assert.deepEqual(jpeg,['image/jpeg',1440,1920]);
    }
    const inputTrace=await capture();
    await panel.getByRole('button',{name:'关闭河岸摄影'}).tap();
    try{
      await panel.waitFor({state:'detached',timeout:3500});
      assert.ok(await mobile.locator('#folio').isVisible(),'closing the camera returns to the open map');
    }catch(err){
      const closeState=await mobile.evaluate(()=>({mode:document.body.dataset.mode,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>[e.id,e.className]),focused:document.activeElement?.outerHTML.slice(0,160)}));
      await writeFile(out+'/close-'+viewport.width+'.json',JSON.stringify({closeState,inputTrace},null,2));
      throw err;
    }
    await mobile.getByRole('button',{name:'回到河岸',exact:true}).tap();
    assert.equal(await mobile.locator('body').getAttribute('data-mode'),'travel');
    touch.push({...viewport,drag:true,download:true,prints:rounds,returnToTravel:true,inputTrace});await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(out+'/check.json',JSON.stringify({origin,entry,roles:['P','图鉴'],exported:['1440×1920','1080×1920','1920×1080'],touch,errors},null,2));
}finally{await browser.close();await server?.close();}

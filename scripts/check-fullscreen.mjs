import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {chapterIds,saveKey} from '../src/v10/ledger.js';

const server=process.env.JINSHA_ORIGIN ? null : await createServer({
  logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}
});
if(server)await server.listen();
const url=process.env.JINSHA_ORIGIN || 'http://127.0.0.1:'+server.httpServer.address().port;
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({executablePath:existsSync(edge)?edge:undefined});
async function checkLayout(button) {
  const result=await button.evaluate(b=>{
    const r=b.getBoundingClientRect();
    const bounds=r.left>=0 && r.right<=innerWidth+1 && r.top>=0 && r.top<100;
    const available=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    const overlaps=[...b.parentElement.children].some(s=>{
      if(s===b || !s.getClientRects().length)return false;
      const q=s.getBoundingClientRect();
      return q.left<r.right && q.right>r.left && q.top<r.bottom && q.bottom>r.top;
    });
    return {withinHeader:bounds,reachable:b.contains(available),overlaps};
  });
  assert.deepEqual(result,{withinHeader:true,reachable:true,overlaps:false});
}
try {
  const ctx=await browser.newContext({viewport:{width:1366,height:820}});
  await ctx.addInitScript(({key,id})=>{
    if(window===window.top && !localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({
      version:1,completed:[id],started:true,muted:true,quality:'economy'
    }));
  },{key:saveKey,id:chapterIds[0]});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  const cover=page.locator('#cover .game-fullscreen');
  for(const width of [320,390,667,1366]){
    await page.setViewportSize({width,height:width===667?375:820});
    await checkLayout(cover);
  }
  await cover.click();
  await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);
  await page.getByRole('button',{name:'退出全屏',exact:true}).waitFor();
  await page.locator('#enter').click();
  await page.waitForFunction(()=>document.body.dataset.mode==='travel',null,{timeout:90000});
  const travel=page.locator('#overlay .game-fullscreen');
  assert.equal(await travel.getAttribute('aria-pressed'),'true');
  await travel.click();
  await page.waitForFunction(()=>document.fullscreenElement===null);
  for(const width of [320,390,667,1366]){
    await page.setViewportSize({width,height:width===667?375:820});
    await checkLayout(travel);
  }
  await page.locator('#review-travel').click();
  await page.locator('[data-review-id="river-trench"]').click();
  const guest=page.frameLocator('iframe[name=chapter-review]');
  const workbench=guest.locator('#sheet .game-fullscreen');
  await workbench.waitFor({timeout:90000});
  for(const width of [320,390,667,1366]){
    await page.setViewportSize({width,height:width===667?375:820});
    await checkLayout(workbench);
  }
  await workbench.click();
  await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);
  assert.equal(await workbench.getAttribute('aria-label'),'退出全屏');
  await workbench.press('Escape');
  await page.waitForFunction(()=>!document.fullscreenElement);
  await guest.locator('#leave').waitFor();
  await workbench.click();
  await page.waitForFunction(()=>Boolean(document.fullscreenElement));
  await guest.locator('#leave').click();
  await page.locator('iframe[name=chapter-review]').waitFor({state:'detached'});
  assert.equal(await travel.getAttribute('aria-label'),'退出全屏');
  await page.evaluate(()=>document.exitFullscreen());
  await page.waitForFunction(()=>document.querySelector('#overlay .game-fullscreen').getAttribute('aria-label')==='全屏体验');
  assert.deepEqual(errors,[]);
  const blocked=await browser.newContext();
  await blocked.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('blocked'));});
  const embedded=await blocked.newPage();
  await embedded.goto(url);
  await embedded.locator('#cover .game-fullscreen').click();
  await embedded.locator('#fullscreen-notice').waitFor();
  assert.equal(await embedded.locator('#cover .game-fullscreen').getAttribute('aria-pressed'),'false');
  console.log('Fullscreen passed: cover, river, review workbench, external exit, keyboard, restricted browser, four layout widths.');
}finally{await browser.close();await server?.close();}

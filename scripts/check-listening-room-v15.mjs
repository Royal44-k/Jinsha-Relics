import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {chapterIds,saveKey} from '../src/v10/ledger.js';

const source=process.env.JINSHA_ORIGIN;
const out=process.env.JINSHA_PROOF||'docs/v15/listening-room'+(source?'':'-source');
const server=source?null:await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});
if(server)await server.listen();
const address=source||'http://127.0.0.1:'+server.httpServer.address().port;
const executable='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({executablePath:existsSync(executable)?executable:undefined,headless:true});
const manifest=JSON.parse(readFileSync(new URL('../public/assets/v15/voices/index.json',import.meta.url),'utf8'));
const clips=Object.fromEntries(manifest.entries.filter(e=>['intro-n','intro-s'].includes(e.id)).map(e=>[e.role,{seconds:e.seconds,text:e.text,src:e.src}]));
const report={source:address,build:source?'production':'Vite source',browser:browser.version(),runs:[]};
await mkdir(out,{recursive:true});

function coverWork(){
  const ids=['enter','new-journey','journey-library','cover-profile','credits','cover-sound'];
  const buttons=ids.map(id=>{
    const el=document.getElementById(id),b=el.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;
    return {id,x:b.x,y:b.y,w:b.width,h:b.height,hit:el.contains(document.elementFromPoint(x,y)),inside:b.x>=0&&b.y>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1};
  });
  const sound=buttons.at(-1);
  const overlap=buttons.slice(0,-1).filter(b=>b.w&&Math.min(b.x+b.w,sound.x+sound.w)>Math.max(b.x,sound.x)&&Math.min(b.y+b.h,sound.y+sound.h)>Math.max(b.y,sound.y));
  const range=document.createRange();range.selectNodeContents(document.getElementById('cover-sound'));
  return {buttons,overlap:overlap.map(b=>b.id),soundTextLines:range.getClientRects().length,viewport:[innerWidth,innerHeight]};
}
async function visit(name,width,height,touch){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:touch,hasTouch:touch,reducedMotion:'reduce'});
  const proof={name,width,height,touch,checks:[],errors:[]};
  report.runs.push(proof);
  await context.addInitScript(({key,ids,clips})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,started:true,completed:ids,quality:'economy',muted:false}));
    // Observe the browser's real decoded sources without driving playback.
    window.__sampleEvents=[];
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      const result=start.apply(this,args);
      const role=Object.keys(clips).find(k=>!this.loop&&Math.abs((this.buffer?.duration??0)-clips[k].seconds)<.002);
      if(role){
        const row={role,began:this.context.currentTime,duration:this.buffer.duration,ended:null};
        window.__sampleEvents.push(row);this.addEventListener('ended',()=>row.ended=this.context.currentTime,{once:true});
      }
      return result;
    };
  },{key:saveKey,ids:chapterIds.slice(0,2),clips});
  const page=await context.newPage();
  page.setDefaultTimeout(75000);
  page.on('pageerror',error=>proof.errors.push(error.message));
  const downloads=[];
  page.on('response',response=>{
    const path=new URL(response.url()).pathname;
    if(path===clips.narrator.src||path===clips.spirit.src)downloads.push({path,status:response.status()});
  });
  const room=page.locator('#listening-room'),sound=page.locator('#cover-sound');
  const tap=loc=>touch?loc.tap():loc.click();
  const focus=()=>page.evaluate(()=>document.activeElement.id);
  const roleRadio=role=>room.locator('input[value="'+role+'"]');
  const button=role=>room.locator('[data-preview="'+role+'"]');
  const pressRole=role=>tap(button(role));
  const waitRestore=role=>page.waitForFunction(r=>document.querySelector('[data-preview="'+r+'"]').getAttribute('aria-pressed')==='false',role,{timeout:20000});
  const snap=label=>page.screenshot({path:join(out,name+'-'+label+'.jpg'),type:'jpeg',quality:86});
  const check=t=>{proof.checks.push(t);console.log(name+' '+t);};
  try{
    await page.goto(address,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__JINSHA_SURVEY__);
    proof.entry=await page.locator('script[type="module"][src]').last().getAttribute('src');
    await page.evaluate(()=>document.fonts.ready);
    proof.cover=await page.evaluate(coverWork);
    assert.ok(proof.cover.buttons.every(b=>b.inside&&b.hit),JSON.stringify(proof.cover));
    assert.ok(proof.cover.buttons.at(-1).h>=44&&proof.cover.buttons.at(-1).w>=44);
    assert.deepEqual(proof.cover.overlap,[]);
    assert.equal(proof.cover.soundTextLines,1);
    await snap('cover');
    await tap(sound);await room.waitFor();
    assert.equal(await roleRadio('dialogue').isChecked(),true);
    assert.ok(await roleRadio('dialogue').evaluate(e=>document.activeElement===e));
    check('首页六个目标独立命中，声音入口打开且默认聚焦人声优先');
    proof.room=await room.evaluate(el=>{
      const b=el.getBoundingClientRect();
      const controls=[...el.querySelectorAll('button,label')];
      const visible=controls.every(control=>{const r=control.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom;});
      return {x:b.x,y:b.y,w:b.width,h:b.height,allControlsVisible:visible,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,overflowX:el.scrollWidth-el.clientWidth};
    });
    assert.ok(proof.room.overflowX<2);
    assert.ok(proof.room.allControlsVisible,'首次打开应看得到全部七项操作');
    for(const choice of ['balanced','voice-only','dialogue','balanced']){
      await tap(roleRadio(choice).locator('..'));assert.equal(await roleRadio(choice).isChecked(),true);
      assert.equal(await room.locator('input:checked').count(),1);
      assert.equal(await page.evaluate(()=>localStorage.getItem('jinsha-listening-mix-v15')),choice);
    }
    await snap('settings');
    if(touch)await tap(room.locator('.listening-close'));else await page.keyboard.press('Escape');
    await room.waitFor({state:'hidden'});
    assert.equal(await focus(),'cover-sound');
    await page.reload();await page.waitForFunction(()=>!!window.__JINSHA_SURVEY__);
    await tap(sound);await room.waitFor();assert.equal(await roleRadio('balanced').isChecked(),true);
    check('三个单选可切换，刷新保持均衡，关闭回到原入口');
    if(name==='desktop'){
      await page.keyboard.press('Tab');assert.ok(await room.evaluate(el=>el.contains(document.activeElement)));
      await tap(room.locator('.listening-mute'));
      assert.match(await button('narrator').innerText(),/开启并试听旁白/);
      await pressRole('narrator');
      await page.waitForFunction(()=>window.__sampleEvents.some(e=>e.role==='narrator'));
      assert.match(await button('narrator').innerText(),/停止旁白/);
      assert.equal(await room.locator('.listening-mute').innerText(),'静音');
      assert.ok((await room.locator('.listening-caption').innerText()).includes(clips.narrator.text));
      await pressRole('narrator');await waitRestore('narrator');
      await page.waitForFunction(()=>window.__sampleEvents.some(e=>e.role==='narrator'&&e.ended!==null));
      const stopped=await page.evaluate(()=>window.__sampleEvents.find(e=>e.role==='narrator'));
      assert.ok(stopped.ended-stopped.began<stopped.duration-.3);
      check('静音后明确试听旁白，真实采样启动，手动提前停止');
      await pressRole('spirit');
      await page.waitForFunction(()=>window.__sampleEvents.some(e=>e.role==='spirit'));
      assert.match(await button('spirit').innerText(),/停止烁羽/);
      await waitRestore('spirit');
      proof.samples=await page.evaluate(()=>window.__sampleEvents);
      const natural=proof.samples.find(e=>e.role==='spirit');
      assert.ok(natural.ended-natural.began>=natural.duration-.15,JSON.stringify(natural));
      assert.equal(await button('spirit').innerText(),'试听烁羽');
      assert.ok(downloads.some(r=>r.path===clips.narrator.src&&r.status===200));
      assert.ok(downloads.some(r=>r.path===clips.spirit.src&&r.status===200));
      proof.downloads=downloads;check('烁羽的真实音轨自然播完，按钮自动恢复试听');
      await pressRole('narrator');await page.keyboard.press('Escape');await room.waitFor({state:'hidden'});
      await tap(page.locator('#enter'));await page.locator('#notebook').waitFor();
      await page.keyboard.press('j');await page.locator('#folio.ledger-open').waitFor();
      const origin=page.locator('#folio').getByRole('button',{name:'声音设置',exact:true});
      await tap(origin);await room.waitFor();
      assert.equal(await roleRadio('balanced').isChecked(),true);
      await page.keyboard.press('Escape');await room.waitFor({state:'hidden'});
      assert.ok(await origin.evaluate(el=>document.activeElement===el));
      assert.ok(await page.locator('#folio.ledger-open').isVisible());
      await page.keyboard.press('Escape');await page.locator('#folio').waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().mode),'travel');
      check('J 图鉴打开声音设置，Esc 先回同一导航按钮，再回河岸');
    }else{
      await tap(room.locator('.listening-mute'));assert.match(await button('spirit').innerText(),/开启并试听/);
      await pressRole('spirit');await page.waitForFunction(()=>window.__sampleEvents.some(e=>e.role==='spirit'));
      await tap(room.locator('.listening-close'));await room.waitFor({state:'hidden'});
      assert.equal(await focus(),'cover-sound');
      check('触屏下试听与关闭均能直接操作');
      if(name==='mobile'||name==='landscape'){
        await tap(page.locator('#enter'));await tap(page.locator('#notebook'));
        const atlas=page.locator('#folio.ledger-open'),origin=atlas.getByRole('button',{name:'声音设置',exact:true});
        await tap(origin);await room.waitFor();
        await tap(room.locator('.listening-close'));await room.waitFor({state:'hidden'});
        assert.ok(await atlas.isVisible());assert.ok(await origin.evaluate(el=>el===document.activeElement));
        await tap(atlas.getByRole('button',{name:'回到河岸',exact:true}));await atlas.waitFor({state:'hidden'});
        check('触屏可从图鉴导航打开声音设置，关闭后回同一入口并返回河岸');
      }
    }
    assert.deepEqual(proof.errors,[]);proof.ok=true;
  }catch(error){
    proof.ok=false;proof.failure=error.stack;console.error(name,error.message);
    try{await snap('failure');}catch{}
  }finally{await context.close();}
}
try{
  for(const config of [['narrow',320,568,true],['mobile',390,844,true],['landscape',667,375,true],['desktop',1366,820,false]])await visit(...config);
}finally{
  await browser.close();if(server)await server.close();
  report.ok=report.runs.length===4&&report.runs.every(r=>r.ok);
  await writeFile(join(out,'browser.json'),JSON.stringify(report,null,2));
  if(!report.ok)process.exitCode=1;
}

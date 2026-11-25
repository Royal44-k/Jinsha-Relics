import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createServer,preview} from 'vite';
import {chapterIds,saveKey,encode,restore} from '../src/v10/ledger.js';
import {collectionKey} from '../src/v11/collection-state.js';
import {journeyKey} from '../src/v14/journeys.js';

const out=process.env.JINSHA_PROOF||'docs/v14/journeys';
const external=process.env.JINSHA_ORIGIN;
const release=process.argv.includes('--release');
const local={host:'127.0.0.1',port:0,open:false};
const server=external?null:release?await preview({logLevel:'error',preview:local}):await createServer({logLevel:'error',server:{...local,hmr:false}});
if(server&&!release)await server.listen();
const origin=external||'http://127.0.0.1:'+server.httpServer.address().port;
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({executablePath:existsSync(edge)?edge:undefined,headless:true,
  args:['--disable-renderer-backgrounding','--disable-background-timer-throttling']});
const report={date:new Date().toISOString(),browser:browser.version(),source:external||(release?'dist':'Vite source'),url:origin,
  fixtures:'Saved-game scenarios begin with four archived stations and one quiz. The separate named journey is prepared at one archived station for storage isolation and three for the delayed fourth-station handoff. Both jade investigations use the regular player controls.',runs:[]};
const record=n=>encode({...restore(null),started:true,completed:chapterIds.slice(0,n),muted:true,quality:'economy'});
await mkdir(out,{recursive:true});

async function finishJadeAndLeave(page,station,key){
  const action=id=>station.locator('[data-action="'+id+'"]');
  for(const move of ['pull-left','charge-grit','pull-left','pull-right','pull-left','pull-right','wet','pull-left','pull-right','pull-left','pull-right'])await action(move).click();
  for(let i=0;i<6;i++)await action('jade-turn-right').click();
  await page.evaluate(key=>new Promise(acquired=>{
    navigator.locks.request(key,()=>new Promise(release=>{window.releaseJourneyLock=release;acquired();}));
  }),key);
  try{
    await station.getByRole('button',{name:'记录切面磨痕'}).click();
    await page.evaluate(async key=>{
      const deadline=performance.now()+15000;
      while(performance.now()<deadline){
        if((await navigator.locks.query()).pending.some(lock=>lock.name===key))return;
        await new Promise(resolve=>setTimeout(resolve,30));
      }
      throw new Error('归档写入未在锁上排队');
    },key);
    await station.locator('#leave').click();
  }finally{await page.evaluate(()=>window.releaseJourneyLock?.());}
}

async function run(name,hasSave,mobile){
  const viewport=mobile?{width:390,height:844}:{width:1366,height:820};
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce',deviceScaleFactor:1});
  if(hasSave)await context.addInitScript(({key,old,quiz})=>{
    if(window===window.top&&!localStorage.getItem(key)){
      localStorage.setItem(key,old);localStorage.setItem('jinsha-river-survey-v10',old);
      localStorage.setItem(quiz,'1');localStorage.setItem('jinsha-flume-v1.wan',JSON.stringify({version:1,gate:79,trials:3}));
    }
  },{key:saveKey,old:record(4),quiz:collectionKey+'.quizzes.river-trench'});
  const proof={name,viewport,input:mobile?'touchscreen emulation':'keyboard and mouse',checks:[],screens:[],errors:[]};
  report.runs.push(proof);
  const newPage=async()=>{
    const p=await context.newPage();p.setDefaultTimeout(90000);
    p.on('pageerror',e=>proof.errors.push(e.message));return p;
  };
  const page=await newPage();
  const tap=locator=>mobile?locator.tap():locator.click();
  const snapshot=p=>p.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
  const check=(label,detail)=>{proof.checks.push({label,detail});console.log(name+' · '+label);};
  async function photo(label){
    await page.evaluate(()=>document.fonts.ready);
    if(mobile)await page.waitForTimeout(300);
    const file=name+'-'+label+'.jpg';await page.screenshot({path:join(out,file),type:'jpeg',quality:89});proof.screens.push(file);
  }
  try{
    await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__JINSHA_SURVEY__);
    proof.entry=await page.locator('script[type="module"][src]').last().getAttribute('src');
    if(!hasSave){
      assert.match(await page.locator('#enter').innerText(),/开始探索/);
      assert.equal(await page.locator('#new-journey').isVisible(),false);
      assert.equal(await page.locator('#journey-library').isVisible(),false);
      await photo('home');await tap(page.locator('#enter'));await page.locator('#folio.prologue-open').waitFor();
      check('初访首页直接进入序章');return;
    }
    assert.match(await page.locator('#enter').innerText(),/继续探索/);
    assert.equal(await page.locator('#new-journey').isVisible(),true);
    await photo('home');
    const panel=page.locator('#journey-panel'),library=page.locator('#journey-library');
    await tap(library);assert.equal(await panel.locator('.journey-card').count(),1);
    if(mobile)await tap(page.locator('#journey-close'));
    else{
      await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
      assert.ok(await panel.evaluate(p=>p.contains(document.activeElement)));
      await page.keyboard.press('Escape');
    }
    await panel.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>document.activeElement.id),'journey-library');
    assert.equal((await snapshot(page)).completed.length,4);
    check('关闭档案返回原入口，浏览目录不会建档');
    let other=null;
    if(!mobile){other=await newPage();await other.goto(origin);await other.waitForFunction(()=>!!window.__JINSHA_SURVEY__);}
    if(mobile)await tap(page.locator('#new-journey'));
    else await page.locator('#new-journey').dblclick();
    await page.locator('#folio.prologue-open').waitFor();
    const id=new URL(page.url()).searchParams.get('journey');assert.match(id,/^j-[a-f0-9]{32}$/);
    const fresh=await snapshot(page);assert.equal(fresh.completed.length,0);assert.equal(fresh.collection.totalXP,0);
    assert.equal(await page.getByRole('button',{name:/承接旧版/}).count(),0);
    const smoke=page.getByRole('button',{name:'西台烟火'});
    await tap(smoke);assert.equal(await smoke.getAttribute('aria-pressed'),'true');
    const picture=page.locator('.witness img');await picture.evaluate(img=>img.decode());
    assert.match(await picture.getAttribute('src'),/west-terrace-dawn/);await photo('new-prologue');
    check('另启旅程获得独立序章，可查看西台烟火图版',id);
    await tap(page.getByRole('button',{name:'落到探方边'}));await page.locator('#review-travel').waitFor();
    assert.equal((await snapshot(page)).site,chapterIds[0]);
    await tap(page.locator('#notebook'));await tap(page.getByRole('button',{name:'返回标题',exact:true}));
    await tap(library);assert.equal(await panel.locator('.journey-card').count(),2);
    assert.equal(await panel.locator('[aria-current=true]').getAttribute('data-journey'),id);
    assert.match(await panel.locator('[data-journey=first]').innerText(),/4 \/ 9/);
    await photo('two-journeys');await tap(panel.locator('[data-journey=first]'));
    await page.locator('#review-travel').waitFor();
    const resumed=await snapshot(page);
    assert.equal(resumed.site,'clay-fit');assert.equal(resumed.collection.totalXP,138);assert.equal(resumed.completed.length,4);
    check('从首站回到档案，选择原卷直达第五站并保留四站及鉴定阅历',resumed.site);
    if(other){
      assert.equal(await other.evaluate(()=>history.state.jinshaJourney),'first');
      await other.evaluate(([key,data])=>localStorage.setItem(key,data),[journeyKey(id,saveKey),record(1)]);
      const selected=new URL(origin);selected.searchParams.set('journey',id);await other.goto(selected.href);
      await other.locator('#enter').click();await other.locator('#review-travel').click();
      await other.locator('[data-review=river-trench]').click();
      const guest=other.frameLocator('iframe[name=chapter-review]');await guest.locator('#leave').waitFor();
      assert.equal(await guest.locator('body').evaluate(()=>window.__JINSHA_SURVEY__.snapshot().collection.totalXP),30);
      await guest.locator('#sheet-mute').click();
      await other.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).muted===false,journeyKey(id,saveKey));
      assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).muted,saveKey),true);
      await guest.locator('#leave').click();await other.locator('#notebook').click();await other.locator('.flume-launch').click();
      const gate=other.locator('.fl-lab input[type=range]');assert.equal(await gate.inputValue(),'32');
      await gate.focus();await gate.press('ArrowRight');
      await other.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.gate===33,journeyKey(id,'jinsha-flume-v1.wan'));
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jinsha-flume-v1.wan')).gate),79);
      check('双标签与回顾工作台分别保存阅历、静音和水闸开度');
      await page.locator('#review-travel').click();
      await page.locator('[data-review=jade-cut]').click();
      const jade=page.frameLocator('iframe[name=chapter-review]');
      await finishJadeAndLeave(page,jade,saveKey);
      await page.locator('iframe[name=chapter-review]').waitFor({state:'detached'});
      await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).revisits?.['jade-cut']===1,saveKey);
      check('历史玉作提交后立即离开，延迟的写盘仍由原旅程完成一次');
      const namedKey=journeyKey(id,saveKey);
      await other.evaluate(([key,raw])=>localStorage.setItem(key,raw),[namedKey,record(3)]);
      await other.reload();await other.locator('#enter').click();await other.locator('#guide').click();
      await other.locator('#interact').waitFor();await other.locator('#interact').click();
      await finishJadeAndLeave(other,other,namedKey);
      await other.waitForFunction(key=>document.body.dataset.mode==='travel'&&JSON.parse(localStorage.getItem(key)).completed.length===4,namedKey);
      assert.equal((await snapshot(other)).site,'clay-fit');
      assert.match(await other.locator('#place').innerText(),/陶作修复架/);
      check('主线玉作已提交时返回河岸，落盘后仍追踪第五站');
    }
  }catch(error){proof.failure=String(error);throw error;}
  finally{await context.close();assert.deepEqual(proof.errors,[]);}
}

try{
  await run('fresh',false,false);await run('desktop',true,false);await run('mobile',true,true);report.ok=true;
}finally{
  await writeFile(join(out,'journeys.json'),JSON.stringify(report,null,2));await browser.close();await server?.close();
}

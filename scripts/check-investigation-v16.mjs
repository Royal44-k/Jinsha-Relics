import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {chapterIds,saveKey} from '../src/v10/ledger.js';
import {cases} from '../src/v16/investigation-cases.js';

const external=process.env.JINSHA_ORIGIN;
const server=external?null:await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});
if(server)await server.listen();
const url=external||'http://127.0.0.1:'+server.httpServer.address().port;
const out=process.env.JINSHA_PROOF||'docs/v16/investigation';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
const report={url,runs:[]};
await mkdir(out,{recursive:true});
try{
  for(const touch of (process.argv.includes('--touch')?[true]:[false,true])){
    const width=touch?390:1280,height=touch?844:800,n=touch?0:9;
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:touch,isMobile:touch});
    const page=await context.newPage();page.setDefaultTimeout(40000);
    const errors=[],run={touch,width,height,n,errors,solved:[]};report.runs.push(run);
    page.on('pageerror',err=>errors.push(err.message));
    const client=await context.newCDPSession(page),snap=()=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
    await page.addInitScript(({chapterIds,saveKey,n})=>{
      if(!localStorage.getItem(saveKey))localStorage.setItem(saveKey,JSON.stringify({version:1,started:true,completed:chapterIds.slice(0,n),ending:n===9,muted:true,quality:'economy'}));
    },{chapterIds,saveKey,n});
    const tap=locator=>touch?locator.tap():locator.click();
    async function drag(from,to){
      if(!touch){await page.mouse.move(...from);await page.mouse.down();await page.mouse.move(...to,{steps:9});await page.mouse.up();return;}
      const send=(type,x,y)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,radiusX:3,radiusY:3,id:5}]});
      await send('touchStart',...from);
      for(let k=1;k<=8;k++)await send('touchMove',from[0]+(to[0]-from[0])*k/8,from[1]+(to[1]-from[1])*k/8);
      await send('touchEnd');
    }
    const center=async loc=>{const r=await loc.boundingBox();assert.ok(r&&r.width>0);return [r.x+r.width/2,r.y+r.height/2];};
    const q=s=>page.locator('.investigation-desk '+s);
    async function open(){
      await tap(page.getByRole('button',{name:'证据推理台',exact:true}));
      await q('.iv-case:enabled').first().waitFor();
    }
    await page.goto(url,{waitUntil:'domcontentloaded'});
    run.asset=await page.locator('script[src][type=module]').last().getAttribute('src');
    report.entry??=run.asset;
    if(process.env.JINSHA_EXPECT_ENTRY)assert.equal(run.asset,process.env.JINSHA_EXPECT_ENTRY);
    assert.equal(run.asset,report.entry,'Both input modes must use the same release');
    await tap(page.locator('#enter'));
    await page.waitForFunction(()=>document.body.dataset.mode==='travel');
    const before=await snap();
    if(touch)await tap(page.locator('#field-menu'));else await page.keyboard.press('j');
    await open();assert.equal(await q('.iv-case:enabled').count(),touch?1:4);
    for(const entry of cases.filter(e=>e.need<=n)){
      await tap(q('.iv-case:enabled').filter({hasText:entry.name}));
      if(entry.id==='bank')await page.screenshot({path:join(out,'river-inspection.jpg'),type:'jpeg',quality:87});
      for(let i=0;i<3;i++){
        await tap(q('[data-specimen="'+i+'"]'));
        const glass=q('.iv-plate');
        if(i===0){await glass.scrollIntoViewIfNeeded();await drag(await center(q('.iv-lens')),await center(q('.iv-target')));}
        else if(i===1&&!touch){await glass.focus();await page.keyboard.press('Home');}
        else await tap(q('.iv-align'));
        await tap(q('[data-action=record]'));assert.equal(await q('[data-note]').count(),i+1);
        if(entry.id==='section'&&i===0){
          await tap(q('.iv-exit'));await open();await tap(q('.iv-case:enabled').first());
          assert.equal(await q('[data-note]').count(),1);
        }
      }
      const pairs=touch?['01']:['01','02','12'];
      for(const pair of pairs){
        for(let k=0;k<2;k++){
          const note=q('[data-note="'+pair[k]+'"]'),slot=q('[data-slot="'+k+'"]');
          if(pair==='01'){
            await slot.scrollIntoViewIfNeeded();await drag(await center(note),await center(slot));
          }else await tap(note);
        }
        await tap(page.getByRole('button',{name:entry.unsupported,exact:true}));
        assert.ok((await q('.iv-feedback').innerText()).length>5);
        await tap(page.getByRole('button',{name:entry.results[pair].claim,exact:true}));
        assert.equal(await q('.iv-report figure').count(),2);
        run.solved.push(entry.id+'-'+pair);
        if(entry.id==='bank'&&pair==='01')await page.screenshot({path:join(out,'river-evidence.jpg'),type:'jpeg',quality:87});
        if(pair!==pairs.at(-1))await tap(q('.iv-report-actions button').first());
      }
      await tap(q('.iv-report-actions button').last());
      assert.match(await q('.iv-case:enabled').filter({hasText:entry.name}).innerText(),new RegExp('已收录 '+pairs.length+' / 3'));
    }
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.investigation-desk'));
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'证据推理台');
    await page.reload();await tap(page.locator('#enter'));await page.waitForFunction(()=>document.body.dataset.mode==='travel');
    if(touch)await tap(page.locator('#field-menu'));else await page.keyboard.press('j');
    await open();await tap(q('.iv-case:enabled').first());await tap(q('.iv-history summary'));
    const count=touch?1:3;assert.equal(await q('.iv-history button').count(),count);
    await tap(q('.iv-history button').first());assert.equal(await q('.iv-report figure').count(),2);
    await tap(q('.iv-exit'));await tap(page.getByRole('button',{name:'回到河岸',exact:true}));
    const after=await snap();assert.deepEqual(before.completed,after.completed);
    assert.equal(before.collection.totalXP,after.collection.totalXP);
    if(touch){
      await tap(page.locator('#field-menu'));
      await tap(page.getByRole('button',{name:'返回标题',exact:true}));
      await tap(page.locator('#new-journey'));
      await tap(page.getByRole('button',{name:'落到探方边'}));
      await page.waitForFunction(()=>document.body.dataset.mode==='travel');
      await tap(page.locator('#field-menu'));await open();
      assert.match(await q('.iv-case:enabled').first().innerText(),/已收录 0 \/ 3/);
      await tap(q('.iv-case:enabled').first());
      assert.equal(await q('[data-note]').count(),0);run.independentJourney=true;
    }
    assert.deepEqual(errors,[]);run.ok=true;await context.close();
  }
  report.ok=true;
}finally{
  await writeFile(join(out,'evidence.json'),JSON.stringify(report,null,2));
  await browser.close();await server?.close();
}
console.log(JSON.stringify(report));

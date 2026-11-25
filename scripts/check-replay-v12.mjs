import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {chapterIds,saveKey} from '../src/v10/ledger.js';
import sanctuary from './walk-sanctuary-v11.cjs';
import {activate, activeReview, enterRiverbank, openChapterList, selectChapter, returnedToRiverbank} from './chapter-review-driver.mjs';

const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const output=process.env.JINSHA_PROOF||'docs/v12/replay';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const report={origin,fixture:'Existing archives with three or nine completed chapters. No progress injected after the initial page load.',checks:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
await mkdir(output,{recursive:true});

async function replay(count,mobile){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1180,height:740},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1,reducedMotion:'reduce'});
  try{
    const page=await context.newPage();
    page.on('pageerror',error=>report.errors.push(error.message));
    page.on('response',r=>{if(r.status()>=400)report.errors.push(r.url());});
    await page.addInitScript(({key,ids})=>{
      if(window===window.top&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,started:true,ending:ids.length===9,completed:ids,muted:true,quality:'economy'}));
    },{key:saveKey,ids:chapterIds.slice(0,count)});
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    const button=name=>page.getByRole('button',{name,exact:true});
    const use=locator=>activate(locator,mobile);
    const snapshot=()=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
    await enterRiverbank(page,mobile);
    const original=await snapshot(),xp=original.collection.totalXP;
    await use(page.locator('#notebook'));
    await use(button('进入古河水槽'));await page.locator('.fl-target').first().waitFor();
    assert.equal(await page.locator('.fl-target:enabled').count(),mobile?2:3);
    await use(button('先试流'));await page.locator('.fl-status').waitFor();
    if(mobile)await use(button('收起水槽'));else await page.keyboard.press('Escape');
    await page.locator('#flume-room').waitFor({state:'detached'});
    assert.equal(await page.locator('#folio').evaluate(el=>el.open),true);
    assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('flume-launch')),true);
    await use(page.locator('#folio-close'));
    const list=await openChapterList(page,mobile);
    assert.equal(await list.locator('button[data-review]:enabled').count(),count);
    assert.ok(await list.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await page.screenshot({path:output+'/'+(mobile?'phone':'desktop')+'-chapters.jpg',type:'jpeg',quality:85});
    const id=mobile?chapterIds[0]:chapterIds[8];
    let frame=await selectChapter(page,id,mobile);
    const chapterButton=name=>frame.getByRole('button',{name,exact:true});
    assert.equal(await frame.evaluate(()=>window.__JINSHA_SURVEY__.snapshot().site),id);
    if(!mobile){
      await sanctuary.walkNinePosts(frame,{input:page});
      await chapterButton('再玩本关').waitFor();
      await use(chapterButton('进入古河水槽'));await frame.locator('.fl-target').first().waitFor();await use(chapterButton('收起水槽'));
      await frame.locator('#flume-room').waitFor({state:'detached'});
      await use(chapterButton('再玩本关'));
      frame=await activeReview(page);
      await chapterButton('柱洞 1').waitFor();
    }
    const resources=await frame.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name));
    assert.equal(resources.some(name=>/\.glb(?:\?|$)|\/traverse[-.]/.test(name)),false);
    await use(frame.locator('#leave'));
    await returnedToRiverbank(page);
    const final=await snapshot();assert.equal(final.mode,'travel');assert.equal(final.collection.totalXP,xp);
    assert.equal(final.site,original.site);
    assert.deepEqual(final.completed,chapterIds.slice(0,count));
    if(!mobile){
      const reopened=await openChapterList(page);
      assert.match(await reopened.locator('[data-review="'+id+'"]').innerText(),/1\s*次/);
      await use(reopened.locator('#review-resume'));
    }
    report.checks.push({count,touch:mobile,unlockedCores:mobile?2:3,entered:id,returnedToSite:final.site,receiptReplay:!mobile,unchangedXP:xp,reviewDownloadedWorld:false});
  }finally{await context.close();}
}
try{
  await replay(3,true);await replay(9,false);assert.deepEqual(report.errors,[]);report.ok=true;
}finally{
  await browser.close();await writeFile(output+'/replay.json',JSON.stringify(report,null,2));
}
console.log('Verified touch and desktop chapter replay, sediment lab unlocks, receipt return and progression.');

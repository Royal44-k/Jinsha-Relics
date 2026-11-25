import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chapterIds,saveKey} from '../src/v10/ledger.js';
import {enterRiverbank, openChapterList, selectChapter} from './chapter-review-driver.mjs';

const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const lines=JSON.parse(await readFile('src/v10/survey-voices.json','utf8'));
const manifest=JSON.parse(await readFile('public/assets/v15/voices/index.json','utf8'));
const firstSiteDuration=manifest.entries.find(entry=>entry.id==='site-1').seconds;
const output=process.env.JINSHA_PROOF||'docs/v15/voice',edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({executablePath:existsSync(edge)?edge:undefined,headless:true});
await mkdir(output,{recursive:true});
const report={origin,requests:[],errors:[]};
try{
  const page=await browser.newPage({viewport:{width:1050,height:720}});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('request',r=>{if(r.url().includes('/assets/v15/voices/'))report.requests.push(r.url().split('/').at(-1));});
  await page.addInitScript(({key,id,firstSiteDuration})=>{
    if(window===window.top&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,started:true,completed:[id],muted:true,quality:'economy'}));
    // Watch the actual sample start in the review iframe. A successful fetch
    // alone cannot show that the first word or the cached replay reached WebAudio.
    window.__siteStarts=[];
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      const result=start.apply(this,args);
      if(!this.loop&&Math.abs((this.buffer?.duration||0)-firstSiteDuration)<.002){
        window.__siteStarts.push({when:args[0],state:this.context.state,duration:this.buffer.duration});
      }
      return result;
    };
  },{key:saveKey,id:chapterIds[0],firstSiteDuration});
  await page.goto(origin,{waitUntil:'networkidle'});
  report.entry=await page.locator('script[type="module"][src]').last().getAttribute('src');
  assert.deepEqual(report.requests,[]);await page.locator('#cover-profile').click();
  const first=page.waitForResponse(response=>response.url().endsWith('/intro-s.wav'));
  await page.getByRole('button',{name:'听烁羽说话',exact:true}).click();assert.ok((await first).ok());
  assert.ok((await page.locator('.dossier-line').innerText()).includes(lines.find(line=>line.id==='intro-s').text));
  await page.locator('#folio-close').click();
  await enterRiverbank(page);
  await openChapterList(page);
  const [frame,site]=await Promise.all([
    selectChapter(page,'river-trench'),
    page.waitForResponse(r=>r.url().endsWith('/site-1.wav')&&r.frame().name()==='chapter-review')
  ]);
  assert.ok(site.ok());
  await frame.waitForFunction(()=>window.__siteStarts.length===1);
  await frame.locator('#transcript summary').click();
  assert.equal(await frame.locator('#transcript p').innerText(),lines.find(line=>line.id==='site-1').text);
  await frame.locator('#voice-replay').click();await page.keyboard.press('Escape');
  await frame.waitForFunction(()=>window.__siteStarts.length===2);
  report.firstAndReplayedSample=await frame.evaluate(()=>window.__siteStarts);
  assert.ok(report.firstAndReplayedSample.every(row=>row.state==='running'));
  assert.equal(await frame.locator('#transcript').evaluate(el=>el.open),false);
  assert.equal(await frame.evaluate(()=>document.body.dataset.mode),'activity');
  report.initialNavigation=[...report.requests];
  report.pcm=await page.evaluate(async records=>{
    const ac=new AudioContext();const result=[];
    try{
      for(const {id,role} of records){
        const response=await fetch('/assets/v15/voices/'+id+'.wav');if(!response.ok)throw Error(id+' '+response.status);
        const buffer=await ac.decodeAudioData(await response.arrayBuffer());const channel=buffer.getChannelData(0);
        let mean=0,peak=0;
        for(const value of channel){mean+=value*value;peak=Math.max(Math.abs(value),peak);}
        result.push({id,role,seconds:+buffer.duration.toFixed(3),rms:+Math.sqrt(mean/channel.length).toFixed(4),peak:+peak.toFixed(4)});
      }
    }finally{await ac.close();}
    return result;
  },lines);
  assert.ok(report.pcm.every(row=>row.seconds>1&&row.rms>.015&&row.peak<1));assert.equal(report.pcm.length,21);
  assert.deepEqual(report.errors,[]);report.ok=true;
}finally{
  await browser.close();await writeFile(output+'/browser.json',JSON.stringify(report,null,2));
}
console.log('21 production voice clips decoded. Dossier preview, site narration, replay and transcript verified.');

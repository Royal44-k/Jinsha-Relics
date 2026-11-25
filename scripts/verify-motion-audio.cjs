const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__motion_audio',r=>r.fulfill({contentType:'text/html',body:'<button>Play</button><script type="module">import {ForestAudio} from "/src/v2/audio.js";window.audio=new ForestAudio();document.querySelector("button").onclick=()=>audio.unlock();</script>'}));
  await page.goto('http://127.0.0.1:5186/__motion_audio');await page.locator('button').click();await page.waitForFunction(()=>window.audio?.layers['flight-wind']?.gain);
  const decoded=await page.evaluate(async()=>{const list=[];for(const key of ['step','land','wing','splash','dive','surface','perch']){const b=await audio._buffer('motion-'+key);list.push({key,duration:b?.duration});}return list;});assert.ok(decoded.every(v=>v.duration>.1&&v.duration<2));
  await page.evaluate(()=>audio.setMotion({mode:'flying',speed:6}));await page.waitForTimeout(900);assert.ok(await page.evaluate(()=>audio.layers['flight-wind'].gain.gain.value)>.30);
  await page.evaluate(()=>audio.setMotion({mode:'diving',speed:1}));await page.waitForTimeout(900);const submerged=await page.evaluate(()=>({frequency:audio.environmentFilter.frequency.value,wind:audio.layers['flight-wind'].gain.gain.value}));assert.ok(submerged.frequency<1600&&submerged.wind<.03);
  await page.evaluate(()=>audio.setMotion({mode:'swimming',speed:1}));await page.waitForTimeout(900);assert.ok(await page.evaluate(()=>audio.environmentFilter.frequency.value)>17000);
  await page.evaluate(async()=>{await audio.playMotion('splash');audio.setPaused(true);});await page.waitForFunction(()=>audio.context.state==='suspended');assert.deepEqual(errors,[]);
  const report={date:new Date().toISOString(),checks:['Seven motion cues decode','Airspeed raises flight wind','Diving lowers environment low-pass and removes flight wind','Surfacing restores full-frequency environment','Pause suspends motion audio'],decoded,submerged,errors,listening:'Signal/routing validation only; subjective listening not performed.'};fs.writeFileSync('docs/v3/runtime/motion-audio-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

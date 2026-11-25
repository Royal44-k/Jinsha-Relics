const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=JSON.parse(fs.readFileSync(path.join(root,'src/v10/survey-voices.json'),'utf8'));
async function main(){
  const {createServer}=await import('vite');
  const server=await createServer({root,cacheDir:path.join(require('node:os').tmpdir(),'jinsha-audio-v10-check-cache'),configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0}});await server.listen();
  const browser=await chromium.launch({executablePath:process.env.WORKSHOP_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const url='http://127.0.0.1:'+server.httpServer.address().port+'/audio-check';
  const page=await browser.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\.(ogg|wav)$/.test(r.url()))requests.push(r.url().split('/').pop());});
  await page.route('**/audio-check',r=>r.fulfill({contentType:'text/html',body:'<button id="unlock">开启声音</button><script type="module">import {createSurveyAudio} from "/src/v10/survey-audio.js";window.a=createSurveyAudio();window.begin=()=>a.unlock();document.querySelector("button").onclick=begin;</script>'}));
  try{
    await page.goto(url);await page.waitForFunction(()=>!!window.a);
    assert.equal(await page.evaluate(()=>a.context),null);
    assert.equal(requests.length,0,'no sound download before interaction');
    await page.evaluate(()=>a.setMuted(true));await page.click('#unlock');
    assert.equal(await page.evaluate(()=>a.context),null,'a saved muted preference creates no running audio graph');
    await page.evaluate(()=>a.setMuted(false));
    await page.click('#unlock');await page.waitForFunction(()=>a.context?.state==='running');
    const result=await page.evaluate(async entries=>{
      const ctx=a.context,analyser=ctx.createAnalyser();analyser.fftSize=2048;
      a.destination.connect(analyser);
      async function rms(ms){
        let energy=0,count=0,highest=0;
        const readings=new Float32Array(analyser.fftSize),until=performance.now()+ms;
        do{
          await new Promise(r=>setTimeout(r,22));analyser.getFloatTimeDomainData(readings);
          for(const n of readings){if(!Number.isFinite(n))throw Error('Nonfinite audio');energy+=n*n;highest=Math.max(highest,Math.abs(n));count++;}
        }while(performance.now()<until);
        return {rms:Math.sqrt(energy/count),peak:highest};
      }
      const regions=[];
      for(const i of [0,3,6]){a.setScene(i,'travel');regions.push(await rms(2500));}
      a.setScene(8,'activity');await new Promise(r=>setTimeout(r,300));
      const surveyBed=await rms(700),cues={},warningChannels={};
      const splitter=ctx.createChannelSplitter(2),meters=[ctx.createAnalyser(),ctx.createAnalyser()];
      a.destination.connect(splitter);meters.forEach((meter,side)=>splitter.connect(meter,side));
      for(const name of ['jade-scrape','water-drop','clay-fit','bronze-register','paddle','rope','record','eddy-warn-left','eddy-warn-right','eddy-hit','eddy-open','eddy-strike','screen-wash','slide-click','canopy-rise','plumage','discovery','solstice']){
        const warning=name.startsWith('eddy-warn');
        if(warning)a.setScene(1,'activity');
        if(!a.cue(name))throw Error('Ignored '+name);
        const [combined,channels]=await Promise.all([rms(340),warning?(async()=>{
          const totals=[0,0],wave=new Float32Array(meters[0].fftSize);
          for(let k=0;k<10;k++){
            await new Promise(resolve=>setTimeout(resolve,26));
            meters.forEach((meter,i)=>{meter.getFloatTimeDomainData(wave);for(const v of wave)totals[i]+=v*v;});
          }
          return totals.map(sum=>Math.sqrt(sum/(10*wave.length)));
        })():null]);
        cues[name]=combined;if(warning)warningChannels[name]=channels;
        await new Promise(r=>setTimeout(r,370));
      }
      a.destination.disconnect(splitter);splitter.disconnect();meters.forEach(m=>m.disconnect());
      // Decode every shipped voice independently for both roles and all stations.
      const clips=[];
      for(const entry of entries){
        const response=await fetch('/assets/v15/voices/'+entry.id+'.wav');
        const b=await ctx.decodeAudioData(await response.arrayBuffer());
        const channel=b.getChannelData(0);let energy=0,peak=0;
        for(const n of channel){energy+=n*n;peak=Math.max(peak,Math.abs(n));}
        clips.push({id:entry.id,seconds:b.duration,rms:Math.sqrt(energy/channel.length),peak});
      }
      const dialogue=entries[0];const spoken=await a.speak(dialogue.text,dialogue.role),speech=await rms(850);
      a.setMuted(true);await new Promise(r=>setTimeout(r,130));
      const muted={state:ctx.state,gain:a.destination.gain.value,cue:a.cue('water-drop'),speak:await a.speak(entries[1].text,'spirit')};
      a.setMuted(false);await a.unlock();a.setScene(6,'finale');
      const resumed=await rms(1050);
      // Leaving during fetch/decoding must make a pending speech request stale.
      const delayed=a.speak(entries.at(-1).text,'spirit');a.setScene(1,'journal');
      const superseded=await delayed;
      a.destroy();a.destroy();await new Promise(r=>setTimeout(r,100));const closed=ctx.state;
      const after=await a.unlock();
      return {regions,surveyBed,cues,warningChannels,clips,spoken,speech,muted,resumed,superseded,closed,after};
    },files);
    assert.equal(result.clips.length,21);
    assert.ok(result.clips.every(b=>b.seconds>2&&b.seconds<30&&b.rms>.02&&b.peak<1.05),'all offline dialogue material audible and bounded');
    assert.ok(result.regions.every(r=>r.rms>.002&&r.peak<.90),'all three score arrangements have signal');
    assert.ok(result.surveyBed.rms>.0001&&result.surveyBed.peak<.90,'the measurement court has an audible, bounded underscore');
    assert.ok(Object.values(result.cues).every(r=>r.rms>.0005),'all field and current cues are audible');
    for(const [name,side] of [['eddy-warn-left',0],['eddy-warn-right',1]]){
      const channels=result.warningChannels[name];assert.ok(channels[side]>channels[1-side]*1.5,'current audible from its marked side');
    }
    assert.equal(result.spoken,true);assert.ok(result.speech.rms>.015);
    assert.equal(result.muted.gain,0);assert.equal(result.muted.cue,false);assert.equal(result.muted.speak,false);assert.equal(result.muted.state,'suspended');
    assert.ok(result.resumed.rms>.001);assert.equal(result.superseded,false);assert.equal(result.closed,'closed');assert.equal(result.after,false);
    assert.deepEqual(errors,[]);
    const audit={threeRegionalRms:result.regions.map(r=>r.rms),speechRms:result.speech.rms,muted:result.muted,measurementUnderscore:result.surveyBed.rms,offlineClips:result.clips.length,foleyRms:result.cues,warningChannels:result.warningChannels,resumed:result.resumed.rms,closed:result.closed,errors};
    const output=process.env.JINSHA_PROOF||path.join(root,'docs/v15/audio');
    fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(output,'audio.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify(audit,null,2));
  }finally{await browser.close();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

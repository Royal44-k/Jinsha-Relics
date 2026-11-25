import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';

// A known tone extending to the very last frame makes dropped syllable tails
// and an unintended restart measurable independently of the current casting.
const rate=24000,samples=rate*2,wave=Buffer.alloc(44+samples*2);
wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);
wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);
wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*2,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);
wave.write('data',36);wave.writeUInt32LE(samples*2,40);
for(let i=0;i<samples;i++)wave.writeInt16LE(Math.round(6200*Math.sin(i*2*Math.PI*(i<samples-rate/4?367:1090)/rate)),44+i*2);
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});
await server.listen();
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
try{
  const page=await browser.newPage();
  page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  let release,received;
  const requested=new Promise(res=>{received=res;});
  const blocked=new Promise(res=>{release=res;});
  await page.route('**/voice-audit',route=>route.fulfill({contentType:'text/html',body:'<button>开启</button>'}));
  const probeModule=`
class Probe extends AudioWorkletProcessor {
  process(inputs){const data=inputs[0]?.[0];if(data){let power=0;for(const x of data)power+=x*x;this.port.postMessage([currentTime,Math.sqrt(power/data.length)]);}return true;}
}
registerProcessor('probe',Probe);`;
  await page.route('**/assets/v15/voices/*.wav',async route=>{
    if(route.request().url().endsWith('/intro-s.wav')){received();await blocked;}
    await route.fulfill({contentType:'audio/wav',body:wave});
  });
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/voice-audit');
  await page.evaluate(async probeCode=>{
    const {createSurveyAudio}=await import('/src/v10/survey-audio.js');
    const lines=(await import('/src/v10/survey-voices.json')).default;
    window.say=id=>{const l=lines.find(x=>x.id===id);return a.speak(l.text,l.role);};
    window.starts=[];window.signal=[];window.wait=ms=>new Promise(r=>setTimeout(r,ms));
    window.endRoles=[];
    window.a=createSurveyAudio({onSpeechStart:(text,role,length)=>starts.push({text,role,length,time:a.context.currentTime}),onSpeechEnd:role=>endRoles.push(role)});
    a.setScene(0,'travel');a.setMix('voice-only');
    document.querySelector('button').onclick=async()=>{
      await a.unlock();
      const moduleUrl=URL.createObjectURL(new Blob([probeCode],{type:'text/javascript'}));
      try{await a.context.audioWorklet.addModule(moduleUrl);}finally{URL.revokeObjectURL(moduleUrl);}
      const probe=new AudioWorkletNode(a.context,'probe');
      probe.port.onmessage=e=>signal.push(e.data);
      a.destination.connect(probe);probe.connect(a.context.destination);window.probeReady=true;
    };
  },probeModule);
  await page.getByRole('button').click();await page.waitForFunction(()=>window.probeReady);
  console.log('AudioWorklet ready');
  const result=await page.evaluate(async()=>{
    await wait(180);const silent=Math.max(0,...signal.slice(-14).map(x=>x[1]));
    const actionInVoiceOnly=a.cue('water-drop');
    await say('intro-n');await wait(120);
    const missing=await a.speak('没有这句录音','spirit');a.setScene(0,'journal');await wait(100);
    a.pauseForReview(true);await wait(120);
    const pauseTime=a.context.currentTime,paused=a.context.state;
    await wait(170);const heldSeconds=a.context.currentTime-pauseTime;
    a.pauseForReview(false);await wait(180);
    // Drive the native visibility event to exercise the background policy in headless Edge.
    let hidden=false;Object.defineProperty(document,'visibilityState',{get:()=>hidden?'hidden':'visible',configurable:true});
    hidden=true;document.dispatchEvent(new Event('visibilitychange'));await wait(130);
    const background=a.context.state;hidden=false;document.dispatchEvent(new Event('visibilitychange'));
    await wait(100);delete document.visibilityState;
    const first=starts[0];
    for(let i=0;i<150&&a.context.currentTime<first.time+2.16;i++)await wait(40);
    const tail=signal.filter(([t])=>t>first.time+1.95&&t<first.time+1.99).map(x=>x[1]);
    return {silent,actionInVoiceOnly,missing,paused,heldSeconds,background,starts:starts.length,endRoles:[...endRoles],tailRms:Math.max(0,...tail)};
  });
  assert.equal(result.actionInVoiceOnly,false);assert.ok(result.silent<.000001);
  assert.equal(result.missing,false);assert.equal(result.paused,'suspended');assert.equal(result.background,'suspended');
  assert.equal(result.starts,1);assert.deepEqual(result.endRoles,['narrator']);assert.ok(result.heldSeconds<.02);assert.ok(result.tailRms>.055);
  console.log('Interrupted/resumed test tone retained its ending',result);
  await page.evaluate(()=>{window.queuedLine=say('intro-s');});
  await requested;
  await page.evaluate(()=>a.pauseForReview(true));release();
  assert.equal(await page.evaluate(()=>queuedLine),false);
  await page.evaluate(()=>a.pauseForReview(false));await page.waitForFunction(()=>starts.length===2);
  const mixes=await page.evaluate(async()=>{
    const oscillator=a.context.createOscillator(),trim=a.context.createGain();trim.gain.value=.08;
    oscillator.connect(trim);trim.connect(a.effectsDestination);oscillator.start();
    const meter=a.context.createAnalyser(),buffer=new Float32Array(256);
    meter.fftSize=buffer.length;a.effectsDestination.connect(meter);
    const level=()=>{meter.getFloatTimeDomainData(buffer);return Math.sqrt(buffer.reduce((s,x)=>s+x*x,0)/buffer.length);};
    a.stopSpeech();a.setScene(5,'travel');a.setMix('balanced');await wait(200);
    const balanced=a.effectsDestination.gain.value,externalBefore=level();
    a.setMix('dialogue');a.setMix('dialogue');await wait(150);
    const dialogue=a.effectsDestination.gain.value;
    await say('intro-n');await wait(250);const speechEffects=a.effectsDestination.gain.value;
    a.stopSpeech();await wait(300);const recovered=a.effectsDestination.gain.value;
    a.setMix('voice-only');await wait(170);const off=a.effectsDestination.gain.value,externalAfter=level();
    a.setMuted(true);a.setMix('balanced');await wait(150);const muted=a.context.state;
    const refused=await say('intro-s');const ctx=a.context;oscillator.stop();oscillator.disconnect();trim.disconnect();meter.disconnect();a.destroy();await wait(120);
    return {balanced,dialogue,speechEffects,recovered,off,externalBefore,externalAfter,muted,refused,endRoles:[...endRoles],closed:ctx.state};
  });
  assert.ok(mixes.balanced>mixes.dialogue&&mixes.dialogue>mixes.speechEffects);
  assert.ok(Math.abs(mixes.recovered-mixes.dialogue)<.03);assert.equal(mixes.off,0);
  assert.ok(mixes.externalBefore>.01);assert.ok(mixes.externalAfter<.000001);assert.deepEqual(mixes.endRoles,['narrator']);
  assert.equal(mixes.muted,'suspended');assert.equal(mixes.refused,false);assert.equal(mixes.closed,'closed');assert.deepEqual(errors,[]);
  const report={fixture:'2 s calibration tone; final 250 ms at 1090 Hz',...result,decodeResumedOnce:true,mixes,errors};
  console.log(JSON.stringify(report));
  if(process.env.JINSHA_PROOF){await mkdir(process.env.JINSHA_PROOF,{recursive:true});await writeFile(join(process.env.JINSHA_PROOF,'dialogue-playback.json'),JSON.stringify(report,null,2));}
}finally{await browser.close();await server.close();}

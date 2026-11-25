import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined});
try{
  const page=await browser.newPage();
  await page.route('**/court-audio',route=>route.fulfill({contentType:'text/html',body:'<button>开启声音</button>'}));
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/court-audio');
  await page.evaluate(async()=>{
    const {createSurveyAudio}=await import('/src/v10/survey-audio.js'),connections=[];
    const connect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(dest,...args){
      connections.push([this,dest]);return connect.call(this,dest,...args);
    };
    window.edges=connections;
    window.a=createSurveyAudio();a.setScene(0,'travel');
    document.querySelector('button').onclick=()=>a.unlock();
  });
  await page.getByRole('button').click();
  await page.waitForFunction(()=>edges.some(([node])=>node instanceof AudioBufferSourceNode&&node.loop&&node.buffer.duration>2));
  const result=await page.evaluate(async()=>{
    const air=edges.find(([n])=>n instanceof AudioBufferSourceNode&&n.loop&&n.buffer.duration>2)[1];
    const music=edges.find(([n])=>n===air)[1],wait=ms=>new Promise(r=>setTimeout(r,ms));
    const loops=()=>edges.filter(([n])=>n instanceof AudioBufferSourceNode&&n.loop&&n.buffer.duration>2).map(([,dst])=>dst);
    const beds=()=>edges.filter(([src,dst])=>dst===music&&src instanceof GainNode&&!loops().includes(src)).map(([src])=>src);
    async function energy(node,ms){
      const meter=a.context.createAnalyser(),wave=new Float32Array(256);
      meter.fftSize=wave.length;node.connect(meter);let peak=0;
      for(let t=0;t<ms;t+=40){
        await wait(40);meter.getFloatTimeDomainData(wave);
        peak=Math.max(peak,Math.sqrt(wave.reduce((s,v)=>s+v*v,0)/wave.length));
      }
      node.disconnect(meter);return peak;
    }
    a.setLocality('west-court',.2);await wait(900);
    const west=beds()[0];
    // Chrome can suspend DSP on a silent branch between individual rustles.
    // An inaudible pilot keeps the gain's sampled value current through a fade.
    const pilot=a.context.createConstantSource();pilot.offset.value=.00001;pilot.connect(west);pilot.start();
    await wait(150);const nearEdge=west.gain.value;
    a.setLocality('west-court',1);const reeds=await energy(west,4700);
    const center=west.gain.value,riverAtCourt=air.gain.value;
    a.setLocality('flotation',1);await wait(115);
    const basin=beds().at(-1),wet=await energy(basin,1850),afterSwitch=west.gain.value;
    const voices=(await import('/src/v10/survey-voices.json')).default;
    const clip=voices.find(v=>v.role==='narrator');
    await a.speak(clip.text,clip.role);await wait(360);const duringSpeech=music.gain.value;
    a.pauseForReview(true);await wait(100);const paused=a.context.state;
    a.pauseForReview(false);await wait(850);a.setMuted(true);await wait(120);
    const muted=a.context.state;
    a.setLocality('west-court',1);a.setMuted(false);await wait(900);
    const beforeLeave=beds().length;
    a.setLocality(null);await wait(980);
    const silent=await energy(west,150),riverAway=loops().at(-1).gain.value;
    a.setScene(7,'activity');a.setLocality('west-court',1);await wait(180);
    const chapterGain=west.gain.value,ctx=a.context;pilot.stop();pilot.disconnect();
    a.destroy();await wait(120);
    return {nearEdge,center,reeds,wet,afterSwitch,duringSpeech,muted,paused,silent,riverAtCourt,riverAway,
      busesCreated:beforeLeave,chapterGain,closed:ctx.state};
  });
  console.log(JSON.stringify(result));
  assert.ok(Math.abs(result.nearEdge-.2)<.025&&result.center>.98);
  assert.ok(result.reeds>.0001&&result.wet>.0001);
  assert.equal(result.afterSwitch,0);assert.ok(result.duringSpeech<.5);
  assert.equal(result.paused,'suspended');assert.equal(result.muted,'suspended');
  assert.equal(result.busesCreated,2);assert.ok(result.silent<.000001);
  assert.equal(result.chapterGain,0);assert.equal(result.closed,'closed');
  // The river is attenuated as the courtyard nears. Muting replaces its loop.
  assert.ok(result.riverAtCourt>.1&&result.riverAtCourt<.15&&result.riverAway>.35);
  if(process.env.JINSHA_PROOF){
    await mkdir(process.env.JINSHA_PROOF,{recursive:true});
    await writeFile(join(process.env.JINSHA_PROOF,'west-court-audio.json'),JSON.stringify(result,null,2));
  }
}finally{await browser.close();await server.close();}

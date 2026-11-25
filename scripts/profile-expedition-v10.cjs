const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/v10/campaign');
const url=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
async function main(){
  const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(edge)?edge:undefined,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    const issues=[];page.on('pageerror',e=>issues.push(e.message));await page.goto(url);
    await page.locator('#enter').click();await page.getByRole('button',{name:'落到探方边'}).click();
    await page.waitForFunction(()=>{const game=window.__JINSHA_SURVEY__?.snapshot();return game?.mode==='travel'&&game.motion?.drawCalls>0;},null,{timeout:100000});
    const measured=await page.evaluate(async()=>{
      const canvas=document.querySelector('#world-view canvas'),gl=canvas.getContext('webgl2'),extension=gl.getExtension('WEBGL_debug_renderer_info');
      const gpu=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
      const samples=[],begin=performance.now();let last=begin,warm=4;
      await new Promise(resolve=>{function sample(t){if(warm>0)warm--;else samples.push(t-last);last=t;
        if(samples.length>=150||samples.length>=8&&t-begin>12000)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});
      const sorted=samples.slice().sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(p*sorted.length))];
      return {gpu,viewport:[innerWidth,innerHeight],framebuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],samples:samples.length,medianFrameMs:pct(.5),p95FrameMs:pct(.95),worstFrameMs:pct(1),render:window.__JINSHA_SURVEY__.snapshot().motion};
    });
    await page.screenshot({path:path.join(out,'measured-riverbank.jpg'),type:'jpeg',quality:90,timeout:90000});
    async function captureMotion(keys,ms){
      for(const key of keys)await page.keyboard.down(key);
      try{return await page.evaluate(async duration=>{
        const times=[],start=performance.now();let last=0;
        await new Promise(resolve=>{function f(t){if(last)times.push(t-last);last=t;
          if(t-start>=duration&&times.length>3)resolve();else requestAnimationFrame(f);}requestAnimationFrame(f);});
        times.sort((a,b)=>a-b);return {samples:times.length,medianFrameMs:times[Math.floor(times.length*.5)],p95FrameMs:times[Math.floor(times.length*.95)],worstFrameMs:times.at(-1),motion:window.__JINSHA_SURVEY__.snapshot().motion};
      },ms);}finally{for(const key of keys.reverse())await page.keyboard.up(key);}
    }
    measured.walk=await captureMotion(['Shift','w'],2000);
    await page.keyboard.press('r');measured.turningFlight=await captureMotion(['w','d'],2500);
    await page.screenshot({path:path.join(out,'measured-flight.jpg'),type:'jpeg',quality:89,timeout:90000});
    measured.issues=issues;measured.scope='One headless Edge device. Still shot after four warm frames, then two seconds of fast walking and 2.5 seconds of turning flight. Not a universal hardware benchmark.';
    fs.writeFileSync(path.join(out,'frame-profile.json'),JSON.stringify(measured,null,2));console.log(JSON.stringify(measured));
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});


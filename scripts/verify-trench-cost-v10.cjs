const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.JINSHA_ORIGIN || 'http://127.0.0.1:5197';
const phase = process.argv[2] || 'candidate';
const output = 'docs/v10/fieldwork/trench-render-cost.json';
const median = values => values.slice().sort((a,b) => a-b)[Math.floor(values.length/2)];
const fixture = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>html,body,main{width:100%;height:100%;margin:0}*{box-sizing:border-box}</style><main></main>';

async function measure(browser) {
  const page = await browser.newPage({viewport:{width:1120,height:700}});
  try {
    await page.route('**/trench-cost-check', r => r.fulfill({body:fixture,contentType:'text/html'}));
    await page.goto(origin+'/trench-cost-check');
    const cold = await page.evaluate(async () => {
      const ctx = CanvasRenderingContext2D.prototype;
      const ops = {ellipse:0,createImageData:0,getImageData:0};
      for (const key of Object.keys(ops)) {
        const original = ctx[key];
        ctx[key] = function(...args) { ops[key]++; return original.apply(this,args); };
      }
      const {mountFieldwork} = await import('/src/v10/fieldwork.js');
      window.mountBench = () => {
        const start = performance.now();
        const cleanup = mountFieldwork('river-trench',document.querySelector('main'),{});
        const duration = performance.now()-start;
        return {cleanup,duration};
      };
      const startOps={...ops};
      const first=window.mountBench();window.cleanupBench=first.cleanup;
      window.benchOps=ops;
      return {ms:first.duration,ellipses:ops.ellipse-startOps.ellipse,rawBuffers:ops.createImageData-startOps.createImageData};
    });
    const canvas=page.locator('.js-field canvas');
    await page.locator('canvas[data-material="registered-strata"]').waitFor();
    const readyOps=await page.evaluate(()=>({...window.benchOps}));
    const rect=await canvas.boundingBox(),scale=Math.min(rect.width/1020,rect.height/560);
    const ox=rect.x+(rect.width-900*scale)/2,oy=rect.y+(rect.height-400*scale)/2+6*scale;
    await page.evaluate(()=>{window.stamps=[];const step=t=>{window.stamps.push(t);if(window.captureBrush)requestAnimationFrame(step);};window.captureBrush=true;requestAnimationFrame(step);});
    await page.mouse.move(ox+194*scale,oy+195*scale);await page.mouse.down();
    for(let i=0;i<30;i++)await page.mouse.move(ox+(194+(i%10)*6)*scale,oy+(195+Math.floor(i/10)*8)*scale);
    await page.mouse.up();
    const brush=await page.evaluate(async()=>{
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      window.captureBrush=false;
      const intervals=window.stamps.slice(1).map((x,i)=>x-window.stamps[i]).sort((a,b)=>a-b);
      return {samples:intervals.length,p95Ms:intervals[Math.floor((intervals.length-1)*.95)],maxMs:intervals.at(-1)};
    });
    const warm=await page.evaluate(()=>{window.cleanupBench();const next=window.mountBench();next.cleanup();return next.duration;});
    return {cold,readyOps,brush,warm};
  } finally {await page.close();}
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    const runs=[];
    for(let i=0;i<3;i++)runs.push(await measure(browser));
    if(phase==='candidate')for(const run of runs){
      assert.equal(run.readyOps.createImageData,0,'fixed soil should be decoded');
      assert.equal(run.readyOps.getImageData,0,'fixed soil should not be read back');
      assert.ok(run.cold.ellipses<150,'the thousands of fixed pebbles should be baked');
    }
    const summary={coldMountMedianMs:median(runs.map(r=>r.cold.ms)),warmMountMedianMs:median(runs.map(r=>r.warm)),brushP95MedianMs:median(runs.map(r=>r.brush.p95Ms)),brushMaxMedianMs:median(runs.map(r=>r.brush.maxMs))};
    const result=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{};
    result[phase]={scope:'Three fresh headless Edge contexts, 1120×700. Individual fieldwork mount and mouse drag. Canvas operations are instrumented. Timings are local measurements.',runs,summary};
    fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(phase,JSON.stringify({summary,ops:runs.map(r=>[r.cold.ellipses,r.readyOps.createImageData,r.readyOps.getImageData])}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

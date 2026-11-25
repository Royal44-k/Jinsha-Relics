const { chromium }=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5197';
const url=base+'/__measure-jinsha-fieldwork';
const fixture='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}html,body,main{margin:0;width:100%;height:100%;overflow:hidden}</style><main></main><script type="module">import { mountFieldwork } from "/src/v10/fieldwork.js";let close=null;window.visit=id=>{close?.();close=mountFieldwork(id,document.querySelector("main"));};</script></html>';
const output=process.env.JINSHA_FIELD_TIMINGS||'docs/v10/fieldwork/frame-times-v11.json';
async function run(){
  const executablePath=process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser=await chromium.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const report={conditions:'One headless Edge page, 1280 × 720, DPR 1, requested SwiftShader, 2800 ms per phase, no screenshots during sampling. Other host processes are outside harness control.',browser:browser.version(),measurements:[]};
  page.on('pageerror',e=>console.error(e));page.setDefaultTimeout(60000);
  await page.route(url,r=>r.fulfill({contentType:'text/html',body:fixture}));
  await page.addInitScript(()=>{
    const spans=[];new PerformanceObserver(list=>spans.push(...list.getEntries().map(e=>[e.startTime,e.duration]))).observe({entryTypes:['longtask']});
    window.beginFrames=label=>{const start=performance.now(),samples=[];let last=start;
      window.pendingFrames=new Promise(resolve=>{function frame(){
        const now=performance.now();samples.push(now-last);last=now;
        if(now<start+2800){requestAnimationFrame(frame);return;}
        const sorted=samples.slice().sort((a,b)=>a-b),pick=q=>Math.round(sorted[Math.max(0,Math.ceil(sorted.length*q)-1)]*10)/10;
        const tasks=spans.filter(e=>e[0]<now&&e[0]+e[1]>start).map(e=>Math.round(e[1]));
        resolve({phase:label,n:samples.length,p50:pick(.5),p95:pick(.95),max:pick(1),longTasks:tasks});
      }requestAnimationFrame(frame);});
    };
  });
  try{
    await page.goto(url);await page.waitForFunction(()=>window.visit);
    const sample=async(label,start)=>{await page.evaluate(name=>window.beginFrames(name),label);if(start)await start();const out=await page.evaluate(()=>window.pendingFrames);report.measurements.push(out);console.log(JSON.stringify(out));};
    const visit=id=>page.evaluate(id=>window.visit(id),id);
    const button=name=>page.getByRole('button',{name,exact:true});
    const click=async name=>{const target=button(name);await target.waitFor();const b=await target.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);};
    await sample('trench first mount',()=>visit('river-trench'));
    await sample('trench brush held',async()=>{const c=page.locator('canvas').first();await c.focus();await page.keyboard.down('Space');await page.keyboard.down('ArrowRight');});await page.keyboard.up('Space');await page.keyboard.up('ArrowRight');
    if(process.argv.includes('--trench-only'))return;
    await sample('river first mount',()=>visit('paleochannel'));
    report.renderer=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
    await sample('river near first berth',async()=>{await click('解缆出发');await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowUp');});
    await page.waitForFunction(()=>document.querySelector('.js-field-reading').textContent.includes('第二站'),null,{timeout:180000});await page.keyboard.up('ArrowLeft');await page.keyboard.down('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('.js-field-reading').textContent.includes('合拢'),null,{timeout:180000});await page.keyboard.up('ArrowUp');await page.keyboard.up('ArrowRight');
    await sample('driftwood transit',()=>click('观测漂木'));
    await sample('root first mount',()=>visit('root-survey'));
    await sample('root orbit',()=>click('向右环看'));
    await sample('microscope entry',()=>click('采集根部样本'));
    await sample('microscope rotation',async()=>{await click('散孔参照');for(let i=0;i<3;i++)await click('顺转 15°');});
    await sample('canopy growth',()=>click('复核切片'));
    await button('看古林复原').waitFor();
    await sample('reconstructed forest',()=>click('看古林复原'));
  }finally{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});

const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const cpuDust=process.argv.includes('--cpu-dust');
const cpuBackground=process.argv.includes('--cpu-background'),finalBuild=process.argv.includes('--final');
const override=cpuDust?'dust':cpuBackground?'background':null;
const output=path.resolve('docs/v10/fieldwork',cpuDust?'trench-input-dust-cpu.json':cpuBackground?'trench-input-background-cpu.json':finalBuild?'trench-input-final.json':'trench-input-timeline.json');
const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const round=n=>Math.round(n*10)/10;

// Read-only browser telemetry. No screenshots, game-state writes or replacements
// of rendering/input functions. The surrounding controller supplies real input.
function instrument(){
  const log=window.trenchInputProbe={gate:0,end:0,events:[],moves:[],gaps:[],frames:[],longTasks:[],longFrames:[],slowInputs:[]};
  const add=(name,detail={},t=performance.now())=>log.events.push({name,t,...detail});
  let stroke=0,previous=0,lastCanvas=null,material='',reading='';
  const recording=()=>log.gate&&!log.end;
  for(const type of ['pointerdown','pointerup','pointermove','click']){
    addEventListener(type,e=>{
      if(type==='click'&&e.target.closest?.('#interact')&&!log.gate){
        log.gate=performance.now();performance.mark('jinsha-trench-gate');add('enter-click',{eventTime:e.timeStamp});return;
      }
      if(!recording())return;
      const isCanvas=e.target.matches?.('.js-field-view canvas');
      if(isCanvas&&type==='pointerdown'){stroke++;add('canvas-down',{stroke,eventTime:e.timeStamp,x:e.clientX,y:e.clientY});}
      else if(isCanvas&&type==='pointerup')add('canvas-up',{stroke,eventTime:e.timeStamp});
      else if(isCanvas&&type==='pointermove'&&e.buttons)log.moves.push([performance.now(),e.timeStamp,stroke]);
      else if(type==='click'&&e.target.closest?.('.js-field-tools button'))add('tool-click',{tool:e.target.textContent,eventTime:e.timeStamp});
    },true);
  }
  function frame(t){
    if(recording()){
      if(previous){
        log.frames.push(t-previous);
        if(t-previous>50)log.gaps.push({from:previous,to:t,span:t-previous,callbackObserved:performance.now()});
      }
      const canvas=document.querySelector('.js-field-view canvas');
      if(canvas&&canvas!==lastCanvas){lastCanvas=canvas;add('canvas-in-frame');}
      if(canvas?.dataset.material&&canvas.dataset.material!==material){material=canvas.dataset.material;add('material-in-frame',{material});}
      const header=document.querySelector('.js-field-reading strong')?.textContent;
      if(header&&header!==reading){reading=header;add('reading-in-frame',{header});}
    }
    previous=t;
    if(!log.end)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  addEventListener('DOMContentLoaded',()=>{
    const observer=new MutationObserver(()=>{
      const mode=document.body.dataset.mode;
      if(recording())add('mode',{mode});
      if(mode==='receipt'&&recording()){log.end=performance.now();performance.mark('jinsha-trench-receipt');observer.disconnect();}
    });
    observer.observe(document.body,{attributeFilter:['data-mode']});
  },{once:true});
  for(const [type,field] of [['longtask','longTasks'],['long-animation-frame','longFrames']]){
    if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;
    new PerformanceObserver(list=>{
      for(const e of list.getEntries()){
        const row={start:e.startTime,duration:e.duration};
        if(type==='long-animation-frame')Object.assign(row,{blocking:e.blockingDuration,renderStart:e.renderStart,styleStart:e.styleAndLayoutStart,firstUI:e.firstUIEventTimestamp,
          scripts:e.scripts.map(s=>({fn:s.sourceFunctionName,source:s.sourceURL.split('/').at(-1),start:s.startTime,duration:s.duration,invoker:s.invoker}))});
        else row.attribution=e.attribution.map(a=>[a.name,a.containerType]);
        log[field].push(row);
      }
    }).observe({type,buffered:true});
  }
  if(PerformanceObserver.supportedEntryTypes.includes('event')){
    new PerformanceObserver(list=>{
      for(const e of list.getEntries())log.slowInputs.push({name:e.name,start:e.startTime,duration:e.duration,
        dispatchStart:e.processingStart,dispatchEnd:e.processingEnd,interactionId:e.interactionId});
    }).observe({type:'event',durationThreshold:16,buffered:true});
  }
}
function selectDetachedContext(which){
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
    const matches=which==='dust'?(this.width===900&&this.height===400):(this.width===1&&this.height===1);
    if(type==='2d'&&!this.isConnected&&matches&&document.querySelector('.js-field-river-trench')){
      // The 900x400 dust mask and 1x1 deferred-size background are detached.
      // The visible output canvas is attached before its context is requested.
      HTMLCanvasElement.prototype.getContext=original;
      const ctx=original.call(this,type,{...args[0],willReadFrequently:true});
      window.trenchTestContext={which,width:this.width,height:this.height,detached:!this.isConnected,
        attrs:ctx.getContextAttributes(),stack:new Error().stack.split('\n').slice(2,4)};
      return ctx;
    }
    return original.call(this,type,...args);
  };
}
function extract(log){
  const {gate,end}=log,relative=t=>round(t-gate),clip=r=>r.start<end&&r.start+r.duration>gate;
  const events=log.events.map(e=>({...e,t:relative(e.t),...(e.eventTime===undefined?{}:{eventTime:relative(e.eventTime)})}));
  const moves=log.moves.map(([t,issued,stroke])=>[relative(t),relative(issued),stroke]);
  return {receiptMs:relative(end),frames:log.frames.length,medianMs:round([...log.frames].sort((a,b)=>a-b)[Math.floor(log.frames.length*.5)]),
    events,moves,moveColumns:['DOM capture ms','event.timeStamp ms','stroke number'],
    gaps:log.gaps.map(g=>({from:relative(g.from),to:relative(g.to),duration:round(g.span),rafCallbackAt:relative(g.callbackObserved)})),
    longTasks:log.longTasks.filter(clip).map(x=>({...x,start:relative(x.start),duration:round(x.duration)})),
    slowInputs:log.slowInputs.filter(clip).map(x=>({...x,start:relative(x.start),dispatchStart:relative(x.dispatchStart),dispatchEnd:relative(x.dispatchEnd)})),
    longFrames:log.longFrames.filter(clip).map(x=>({...x,start:relative(x.start),duration:round(x.duration),renderStart:x.renderStart?relative(x.renderStart):null,styleStart:x.styleStart?relative(x.styleStart):null,firstUI:x.firstUI?relative(x.firstUI):null,
      scripts:x.scripts.map(s=>({...s,start:relative(s.start),duration:round(s.duration)}))})),
    resources:log.resources.filter(r=>r.start<end&&(r.end>=gate||/trench-|cutbank|forest_floor/.test(r.name))).map(r=>({name:r.name,start:relative(r.start),end:relative(r.end),bytes:r.bytes}))};
}
function metrics(m){
  const keep=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','ThreadTime','TaskOtherDuration'];
  return Object.fromEntries(m.metrics.filter(row=>keep.includes(row.name)).map(row=>[row.name,row.value]));
}
async function run(delay,label){
  const browser=await chromium.launch({headless:true,executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  try{
    const page=await browser.newPage({viewport:{width:1040,height:650},deviceScaleFactor:1});
    page.setDefaultTimeout(90000);await page.addInitScript(instrument);
    if(override)await page.addInitScript(selectDetachedContext,override);
    const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    const bundle=await page.locator('script[type=module]').first().getAttribute('src');
    const button=name=>page.getByRole('button',{name,exact:true});
    await page.locator('#enter').click();await button('落到探方边').click();
    await page.waitForFunction(()=>window.__JINSHA_SURVEY__?.snapshot().motion?.drawCalls>0);
    await page.locator('#guide').click();await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().near);
    const before=metrics(await cdp.send('Performance.getMetrics'));
    const syncStart=performance.now(),pageNow=await page.evaluate(()=>performance.now()),syncEnd=performance.now();
    const offset=pageNow-(syncStart+syncEnd)/2,driver=[];
    async function input(action,fn){
      const start=performance.now();await fn();const end=performance.now();
      if(end-start>50||!action.startsWith('move-'))driver.push({action,start:start+offset,end:end+offset});
    }
    await input('enter',()=>page.locator('#interact').click());const canvas=page.locator('.js-field canvas');await canvas.waitFor();
    if(delay)await page.waitForTimeout(delay);
    const r=await canvas.boundingBox(),s=Math.min(r.width/1020,r.height/560);
    const at=(x,y)=>[r.x+(r.width-900*s)/2+x*s,r.y+(r.height-400*s)/2+(6+y)*s];
    const seam=x=>221+.054*(x-430)+12*Math.sin(x*.008)+5*Math.sin(x*.025);
    for(const x of [224,648]){
      const points=[];for(let k=0;k<4;k++)for(const dx of (k%2?[42,24,8,-8,-24,-42]:[-42,-24,-8,8,24,42]))points.push(at(x+dx,seam(x)-33+22*k));
      await input('hover-'+x,()=>page.mouse.move(...points[0]));await input('down-'+x,()=>page.mouse.down());
      for(const [i,p] of points.slice(1).entries())await input('move-'+x+'-'+i,()=>page.mouse.move(...p,{steps:2}));
      await input('up-'+x,()=>page.mouse.up());
    }
    await input('switch-tool',()=>button('改用记录针').click());
    for(const x of [224,648])await input('pin-'+x,()=>page.mouse.click(...at(x,seam(x))));
    await input('archive',()=>button('收录层位拓页').click());
    await page.waitForFunction(()=>window.trenchInputProbe.end>0);
    const after=metrics(await cdp.send('Performance.getMetrics'));
    await page.waitForTimeout(180); // Drain observer delivery after receipt.
    const log=await page.evaluate(()=>({...window.trenchInputProbe,resources:performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').at(-1),start:r.startTime,end:r.responseEnd,bytes:r.transferSize}))}));
    assert(log.gate&&log.end>log.gate);assert.equal(log.events.filter(e=>e.name==='canvas-down').length,4);
    const measured=extract(log),testContext=override?await page.evaluate(()=>window.trenchTestContext):null;
    if(override)assert.equal(testContext?.attrs?.willReadFrequently,true);
    const fieldworkBundle=log.resources.find(r=>/^fieldwork-.*\.js$/.test(r.name))?.name;
    return {label,firstBrushDelayMs:delay,bundle,fieldworkBundle,contextOverride:testContext,driverClockHalfRoundTripMs:round((syncEnd-syncStart)/2),driver:driver.map(d=>({action:d.action,start:round(d.start-log.gate),end:round(d.end-log.gate)})),sessionCPUms:Object.fromEntries(Object.keys(after).map(k=>[k,round((after[k]-before[k])*1000)])),...measured};
  }finally{await browser.close();}
}
(async()=>{
  const result={route:origin,scope:'Fresh native Edge process per run. No screenshots or progress injection. Times are ms relative to the captured station-entry click. CPU counters cover the slightly wider CDP before-entry/after-receipt interval.',runs:[]};
  const scenarios=override?[[0,'immediate-'+override+'-cpu']]:[[0,'immediate-1'],[750,'wait-before-first-brush'],[0,'immediate-2']];
  for(const [delay,label] of scenarios){
    const entry=await run(delay,label);result.runs.push(entry);fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    console.log(label,JSON.stringify({receiptMs:entry.receiptMs,gaps:entry.gaps,downs:entry.events.filter(e=>e.name==='canvas-down').map(e=>e.t),tools:entry.events.filter(e=>e.name==='tool-click').map(e=>e.t),cpu:entry.sessionCPUms}));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

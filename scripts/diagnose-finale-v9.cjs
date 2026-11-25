const legacyEntry=require('./legacy-entry-v9.cjs');
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const OUT=process.env.JINSHA_OUTPUT||'docs/v9/motion/finale-profile',URL=legacyEntry();
const TRACE=process.env.JINSHA_TRACE==='1',OBSERVE=TRACE||process.env.JINSHA_LONGTASKS==='1',PROFILE_MS=Math.max(8000,Number(process.env.JINSHA_PROFILE_MS)||8000);
const DISCOVERY=process.env.JINSHA_DISCOVERY_ANIMATION||'default';
assert.ok(DISCOVERY==='default'||DISCOVERY==='off'||Number.isFinite(Number(DISCOVERY))&&Number(DISCOVERY)>=.1&&Number(DISCOVERY)<=5,'JINSHA_DISCOVERY_ANIMATION must be default, off, or a duration in seconds between .1 and 5.');
const GROWTH=process.env.JINSHA_GROWTH_ANIMATION||'default';
assert.ok(['default','off','cached','flat','contained','hud-layer'].includes(GROWTH)||Number.isFinite(Number(GROWTH))&&Number(GROWTH)>=.1&&Number(GROWTH)<=5,'JINSHA_GROWTH_ANIMATION must be default, off, cached, flat, contained, hud-layer, or a duration in seconds between .1 and 5.');
const client='export function updateStyle(id,content){let s=document.getElementById(id);if(!s){s=document.createElement("style");s.id=id;document.head.appendChild(s);}s.textContent=content;}export function removeStyle(id){document.getElementById(id)?.remove();}export function createHotContext(){return {accept(){},dispose(){},on(){},send(){},invalidate(){},prune(){}}}';

const prefix=`
const __finaleProfile={active:false,current:null,lastRaf:null,frames:[],outside:[],marks:[],observers:[],longTasks:[],longAnimationFrames:[]};
function __finaleEntries(entries){for(const entry of entries){
 if(entry.entryType==='longtask')__finaleProfile.longTasks.push({name:entry.name,startTime:entry.startTime,duration:entry.duration,attribution:Array.from(entry.attribution||[],a=>({name:a.name,containerType:a.containerType,containerId:a.containerId,containerName:a.containerName,containerSrc:a.containerSrc}))});
 if(entry.entryType==='long-animation-frame')__finaleProfile.longAnimationFrames.push({startTime:entry.startTime,duration:entry.duration,blockingDuration:entry.blockingDuration,renderStart:entry.renderStart,styleAndLayoutStart:entry.styleAndLayoutStart,firstUIEventTimestamp:entry.firstUIEventTimestamp,scripts:Array.from(entry.scripts||[],s=>({startTime:s.startTime,duration:s.duration,executionStart:s.executionStart,invoker:s.invoker,invokerType:s.invokerType,sourceURL:s.sourceURL,sourceFunctionName:s.sourceFunctionName,sourceCharPosition:s.sourceCharPosition,pauseDuration:s.pauseDuration,forcedStyleAndLayoutDuration:s.forcedStyleAndLayoutDuration}))});
}}
function __finaleMeasure(kind,callback,detail=null){
 if(!__finaleProfile.active)return callback();
 const start=performance.now();try{return callback();}finally{
  const ms=performance.now()-start,row=__finaleProfile.current;
  if(row){row[kind+'Ms']+=ms;row[kind+'Calls']++;if(kind==='event')row.events.push({...detail,ms});}
  else __finaleProfile.outside.push({at:start,kind,ms,...detail});
 }
}
function persist(...args){return __finaleMeasure('persist',()=>__finaleOriginalPersist(...args));}
function onAdventureEvent(event){return __finaleMeasure('event',()=>__finaleOriginalEvent(event),{type:event.type,id:event.id||null});}
function tick(now){
 if(!__finaleProfile.active)return __finaleOriginalTick(now);
 const start=performance.now(),row={raf:now,at:start,rawGapMs:__finaleProfile.lastRaf===null?0:now-__finaleProfile.lastRaf,adventureMs:0,eventMs:0,persistMs:0,renderMs:0,adventureCalls:0,eventCalls:0,persistCalls:0,renderCalls:0,events:[],programsBefore:renderer.info.programs.length,geometriesBefore:renderer.info.memory.geometries,texturesBefore:renderer.info.memory.textures};
 __finaleProfile.lastRaf=now;__finaleProfile.current=row;
 try{return __finaleOriginalTick(now);}finally{
  row.totalSyncMs=performance.now()-start;row.programsAfter=renderer.info.programs.length;row.geometriesAfter=renderer.info.memory.geometries;row.texturesAfter=renderer.info.memory.textures;row.drawCalls=renderer.info.render.calls;row.completed=state.completed;row.mode=state.mode;row.motion=motion.state.mode;row.holdingF=keys.has('KeyF');row.shot=activeShot?{id:activeShot.id,weight:activeShot.weight,progress:activeShot.progress}:null;row.bokeh={enabled:bokeh.enabled,aperture:bokeh.uniforms.aperture.value};
  __finaleProfile.frames.push(row);__finaleProfile.current=null;
 }
}
`;
const hook=`
const __finaleNativeUpdate=adventure.update.bind(adventure),__finaleNativeRender=composer.render.bind(composer);
adventure.update=(...args)=>__finaleMeasure('adventure',()=>__finaleNativeUpdate(...args));
composer.render=(...args)=>__finaleMeasure('render',()=>__finaleNativeRender(...args));
window.__FINALE_PROFILE__={
 prepare(){
  const data=adventure.serialize();data.root={slots:[0,1,2],held:null};data.light.turns=[1,3,2];data.water.turns=[0,2,0];data.trial.completed=true;data.finale.complete=false;
  adventure.restore(data);clearTransientUI();director.reset();const target=adventure.debug().targets.find(t=>t.id==='sun-focus');position.fromArray(target.position);motion.reset(position);state.distance=forest.project(position).distance;forest.update(0,time,position);
  const sun=adventure.snapshot().finalTarget;yaw=Math.atan2(-(sun[0]-position.x),-(sun[2]-position.z))+1.7;character.group.rotation.y=yaw;snapCamera();adventure.update(0,time,{position,motion:motion.state,yaw,facingYaw:yaw,playing:true});
  return {position:position.toArray(),yaw,focus:adventure.snapshot().focusGuide};
 },
 start({observe=false}={}){
  Object.assign(__finaleProfile,{active:true,current:null,lastRaf:null,frames:[],outside:[],marks:[],observers:[],longTasks:[],longAnimationFrames:[]});
  if(observe&&typeof PerformanceObserver!=='undefined')for(const type of ['longtask','long-animation-frame'])if(PerformanceObserver.supportedEntryTypes.includes(type)){const observer=new PerformanceObserver(list=>__finaleEntries(list.getEntries()));observer.observe({type,buffered:false});__finaleProfile.observers.push(observer);}
  const at=performance.now();performance.mark('jinsha-finale-profile-start');__finaleProfile.marks.push({name:'profile start',at});return {at,timeOrigin:performance.timeOrigin,observerTypes:typeof PerformanceObserver==='undefined'?[]:PerformanceObserver.supportedEntryTypes};
 },
 mark(name){const at=performance.now();__finaleProfile.marks.push({name,at});performance.mark('jinsha-finale-'+name.replaceAll(' ','-'));},
 status:()=>({mode:state.mode,completed:state.completed}),
 stop(){__finaleProfile.active=false;for(const observer of __finaleProfile.observers){__finaleEntries(observer.takeRecords());observer.disconnect();}__finaleProfile.observers=[];performance.mark('jinsha-finale-profile-stop');return {frames:__finaleProfile.frames,outside:__finaleProfile.outside,marks:__finaleProfile.marks,longTasks:__finaleProfile.longTasks,longAnimationFrames:__finaleProfile.longAnimationFrames,completed:state.completed,programs:renderer.info.programs.map(p=>({id:p.id,name:p.name,usedTimes:p.usedTimes}))};}
};
`;
function instrument(source){
 for(const [from,to]of [['function persist(', 'function __finaleOriginalPersist('],['function onAdventureEvent(', 'function __finaleOriginalEvent('],['function tick(', 'function __finaleOriginalTick(']]){
  if(source.split(from).length!==2)throw Error('Instrumentation anchor missing or ambiguous: '+from);
  source=source.replace(from,to);
 }
 const anchor='last=performance.now();frame=requestAnimationFrame(tick);';
 if(source.split(anchor).length!==2)throw Error('Finale boot instrumentation anchor changed');
 return prefix+source.replace(anchor,hook+anchor);
}
function discoveryVariant(source,value){
 if(value==='default')return source;
 const original='.v5-discovery.is-arriving{animation:v5-discovered .85s ease-out both}';
 assert.equal(source.split(original).length-1,1,'Discovery animation response anchor changed');
 return source.replace(original,value==='off'?'.v5-discovery.is-arriving{animation:none!important}':'.v5-discovery.is-arriving{animation:v5-discovered '+Number(value)+'s ease-out both}');
}
function growthVariant(source,value){
 if(value==='default')return source;
 if(value==='flat'){const gradient='background:linear-gradient(90deg,#102c2700,#183b2ded 20%,#183b2ded 80%,#102c2700)';assert.equal(source.split(gradient).length-1,1,'Growth background response anchor changed');return source.replace(gradient,'background:#183b2ded');}
 if(value==='hud-layer'){const root='#v9-growth-hud{position:absolute;';assert.equal(source.split(root).length-1,1,'Growth HUD response anchor changed');return source.replace(root,root+'will-change:transform;transform:translateZ(0);');}
 const original='animation:v9-growth-arrive .7s ease-out';assert.equal(source.split(original).length-1,1,'Growth animation response anchor changed');
 return source.replace(original,value==='off'?'animation:none!important':value==='cached'?original+';will-change:transform,opacity':value==='contained'?original+';contain:paint':'animation:v9-growth-arrive '+Number(value)+'s ease-out');
}
function summarize(trace){
 const rows=trace.frames,nonfirst=rows.slice(1),q=(field,p)=>{const sorted=nonfirst.map(r=>r[field]).sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)];};
 return {frames:rows.length,elapsedMs:rows.at(-1)?.at-rows[0]?.at,
  rawGap:{median:q('rawGapMs',.5),p95:q('rawGapMs',.95),max:Math.max(...nonfirst.map(r=>r.rawGapMs))},
  synchronous:{totalMax:Math.max(...rows.map(r=>r.totalSyncMs)),adventureMax:Math.max(...rows.map(r=>r.adventureMs)),eventMax:Math.max(...rows.map(r=>r.eventMs)),persistMax:Math.max(...rows.map(r=>r.persistMs)),renderMax:Math.max(...rows.map(r=>r.renderMs))},
  completionEvents:rows.flatMap((r,index)=>r.events.filter(e=>e.type==='complete').map(e=>({index,at:r.at,...e}))),
  largestGaps:nonfirst.map((row,i)=>({index:i+1,row,previous:rows[i]})).sort((a,b)=>b.row.rawGapMs-a.row.rawGapMs).slice(0,12)};
}

async function run(){
 fs.mkdirSync(OUT,{recursive:true});const report={at:new Date().toISOString(),method:'Response-only instrumentation of development main.js. Four prerequisite memories are fixture-restored; finale remains incomplete and is completed with actual keyboard F. No per-frame full snapshot, screenshots, console logs or gl.finish. Event and persist timings are inclusive subsets of adventure.update; do not sum them. raw RAF gap may reflect the preceding frame, which is retained alongside each peak. Optional CDP trace and PerformanceObservers add diagnostic overhead; compare timing only with matching diagnostics enabled.',traceEnabled:TRACE,observersEnabled:OBSERVE,profileMs:PROFILE_MS,discoveryAnimation:DISCOVERY,discoveryResponses:0,growthAnimation:GROWTH,growthResponses:0,errors:[],warnings:[]};
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});let page,cdp,tracing=false,closing=false;
 async function stopTrace(){
  if(!tracing)return;tracing=false;const completed=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await completed;
  const fd=fs.openSync(OUT+'/trace.json','w');try{let eof=false;while(!eof){const chunk=await cdp.send('IO.read',{handle:stream,size:1024*1024});fs.writeSync(fd,chunk.base64Encoded?Buffer.from(chunk.data,'base64'):chunk.data);eof=chunk.eof;}}finally{fs.closeSync(fd);await cdp.send('IO.close',{handle:stream});}
  report.traceFile=OUT+'/trace.json';
 }
 try{
  page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
  await page.route('**/@vite/client',async r=>{try{await r.fulfill({status:200,contentType:'application/javascript',body:client});}catch(e){if(!closing)report.errors.push(e.message);}});
  if(DISCOVERY!=='default')await page.route('**/src/v5/experience-ui.css*',async r=>{try{const response=await r.fetch({timeout:60000}),body=discoveryVariant(await response.text(),DISCOVERY);report.discoveryResponses++;await r.fulfill({response,body});}catch(e){if(!closing)report.errors.push(e.message);await r.abort().catch(()=>{});}});
  if(GROWTH!=='default')await page.route('**/src/v9/growth-ui.css*',async r=>{try{const response=await r.fetch({timeout:60000}),body=growthVariant(await response.text(),GROWTH);report.growthResponses++;await r.fulfill({response,body});}catch(e){if(!closing)report.errors.push(e.message);await r.abort().catch(()=>{});}});
  await page.route('**/src/v2/main.js*',async r=>{try{const response=await r.fetch({timeout:60000});await r.fulfill({response,body:instrument(await response.text())});}catch(e){if(!closing)report.errors.push(e.message);await r.abort().catch(()=>{});}});
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__FINALE_PROFILE__,null,{timeout:120000});if(DISCOVERY!=='default')assert.ok(report.discoveryResponses>0,'Discovery CSS variant was not requested');if(GROWTH!=='default')assert.ok(report.growthResponses>0,'Growth CSS variant was not requested');await page.locator('#start-btn').click();await page.waitForFunction(()=>__FINALE_PROFILE__.status().mode==='playing');
  report.fixture=await page.evaluate(()=>__FINALE_PROFILE__.prepare());assert.equal(report.fixture.focus.ready,true);assert.equal(report.fixture.focus.inPosition,true);assert.equal(report.fixture.focus.facing,false);assert.equal(await page.evaluate(()=>__FINALE_PROFILE__.status().completed),false);
  // Let relocation/fixture UI settle before the measured baseline. The end
  // event itself is never invoked by a diagnostic shortcut.
  await page.waitForTimeout(1600);
  if(TRACE){cdp=await page.context().newCDPSession(page);report.traceCategories=['devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.frame','v8','disabled-by-default-v8.gc','blink.user_timing','loading','gpu','cc'];await cdp.send('Tracing.start',{categories:report.traceCategories.join(','),options:'record-as-much-as-possible',transferMode:'ReturnAsStream'});tracing=true;}
  report.profileStart=await page.evaluate(observe=>__FINALE_PROFILE__.start({observe}),OBSERVE);await page.waitForTimeout(1800);
  await page.evaluate(()=>__FINALE_PROFILE__.mark('F down'));await page.keyboard.down('KeyF');await page.waitForFunction(()=>__FINALE_PROFILE__.status().completed,null,{timeout:12000});await page.evaluate(()=>__FINALE_PROFILE__.mark('completion observed'));await page.keyboard.up('KeyF');
  const elapsed=await page.evaluate(start=>performance.now()-start,report.profileStart.at);await page.waitForTimeout(Math.max(3500,PROFILE_MS-elapsed));
  report.trace=await page.evaluate(()=>__FINALE_PROFILE__.stop());await stopTrace();report.summary=summarize(report.trace);assert.equal(report.trace.completed,true);assert.ok(report.summary.completionEvents.length>0);assert.ok(report.trace.frames.some(r=>r.holdingF));
  report.gl=await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getError());await page.screenshot({path:OUT+'/after-profile.png'});assert.equal(report.gl,0);assert.deepEqual(report.errors,[]);
  console.log(JSON.stringify({frames:report.summary.frames,rawGap:report.summary.rawGap,synchronous:report.summary.synchronous,completionEvents:report.summary.completionEvents,errors:report.errors,gl:report.gl}));
 }catch(error){report.failure=error.stack||error.message;throw error;}finally{await stopTrace().catch(error=>{report.traceFailure=error.message;});closing=true;await page?.keyboard.up('KeyF').catch(()=>{});await page?.unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});await browser.close();fs.writeFileSync(OUT+'/result.json',JSON.stringify(report,null,2));}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={instrument,summarize,discoveryVariant,growthVariant};

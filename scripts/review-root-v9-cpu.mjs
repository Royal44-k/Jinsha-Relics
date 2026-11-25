import fs from 'node:fs';
import {LivingJourneyAudio} from '../src/v9/audio.js';
import {createLifeEffects} from '../src/v9/life-effects.js';
import * as THREE from 'three';

const report={at:new Date().toISOString(),scope:'Read-only runtime review of root-owned modules. Mock DOM/AudioContext, real module logic; no WebGL or audible playback.',audio:[],ui:[],effects:{}};
for(const cue of ['encounter-wave','rotate','stage']){
 const a=new LivingJourneyAudio(),sources=[];
 const node=()=>({connect(){},disconnect(){},gain:{value:1,cancelScheduledValues(){},setTargetAtTime(){}},playbackRate:{value:1},start(){sources.push(cue);},stop(){}});
 a.context={currentTime:20,suspend:()=>Promise.resolve(),resume:()=>Promise.resolve(),createBufferSource:node,createGain:node};
 a.buses={effects:{}};a.unlocked=true;a._prepareLife=()=>Promise.resolve();a._foley=()=>{sources.push(cue);return true;};
 let resolve;a._buffer=()=>new Promise(r=>resolve=r);
 const pending=a.playWorldCue(cue);
 a.setPaused(true);a.resetJourneyEffects();a.resetMoments();a.setPaused(false);
 resolve({duration:.7});await pending;
 report.audio.push({cue,scenario:'decode requested before pause/reset; resolves after resume into next journey',sourcesStarted:sources.length,lifeEpoch:a.lifeEpoch});
}
{
 const a=new LivingJourneyAudio(),sources=[],node=()=>({connect(){},disconnect(){},gain:{value:1,cancelScheduledValues(){},setTargetAtTime(){}},start(){sources.push('living');},stop(){}});
 a.context={currentTime:20,suspend:()=>Promise.resolve(),resume:()=>Promise.resolve(),createBufferSource:node,createGain:node};a.buses={music:{}};a.unlocked=true;
 let resolve;a._buffer=()=>new Promise(r=>resolve=r);const pending=a.playMoment('living');a.setPaused(true);a.setPaused(false);resolve({duration:.7});await pending;
 report.audio.push({cue:'cinematic-moment-living',scenario:'decode requested before ordinary menu pause; resolves after resume (without journey reset)',sourcesStarted:sources.length,eventEpoch:a.eventEpoch,momentEpoch:a.momentEpoch});
}

// Only the DOM properties exercised by createGrowthUI. No layout claims.
class Element{constructor(){this.hidden=false;this.style={};this.dataset={};this.textContent='';this.classList={toggle(){}};this.children=new Map();}setAttribute(){}appendChild(){}remove(){}querySelector(id){if(!this.children.has(id))this.children.set(id,new Element());return this.children.get(id);}}
const hud=new Element();let root,clock=10000;
globalThis.document={createElement(){return root=new Element();},getElementById(){return hud;},body:hud};
globalThis.matchMedia=()=>({matches:false});globalThis.innerWidth=1440;
const oldPerformance=globalThis.performance;Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
try{
 const code=fs.readFileSync('src/v9/growth-ui.js','utf8').replace("import './growth-ui.css';",'');
 const {createGrowthUI}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const ui=createGrowthUI();
 const growth=level=>({growth:{level,name:['初羽','青翎','曜羽'][level],essence:level===2?10:level===1?4:0,nextAt:[4,10,null][level]},inventory:{}});
 ui.update(growth(0),{mode:'playing'});clock+=100;ui.update(growth(1),{mode:'playing'});
 report.ui.push({scenario:'normal level-up',arrivalVisible:!root.querySelector('#v9-growth-arrival').hidden,title:root.querySelector('#v9-growth-arrival-title').textContent});
 clock+=500;ui.update(growth(1),{mode:'title'});clock+=500;ui.update(growth(0),{mode:'playing'});
 report.ui.push({scenario:'return to title and start new journey inside 6.5-second arrival duration',arrivalVisible:!root.querySelector('#v9-growth-arrival').hidden,title:root.querySelector('#v9-growth-arrival-title').textContent,actualLevel:0});
 ui.dispose();
}finally{Object.defineProperty(globalThis,'performance',{configurable:true,value:oldPerformance});}

const scene=new THREE.Scene(),fx=createLifeEffects(scene);
for(let i=0;i<100;i++){fx.pulse([0,0,0],[5,1,-5]);fx.update(.016);}
report.effects.after100Pulses={...fx.stats(),sceneChildren:scene.children.length};
fx.reset();report.effects.afterReset=fx.stats();
fx.pulse([0,0,0],[5,1,-5]);fx.update(.2);const activePath=scene.children[0].children.find(item=>item.visible),before=activePath.children[0].instanceMatrix.array.slice();
for(let i=0;i<100;i++)fx.update(.016,{playing:false});
const after=activePath.children[0].instanceMatrix.array;
report.effects.pauseMatricesStable=before.every((v,i)=>v===after[i]);
fx.dispose();report.effects.afterDisposeSceneChildren=scene.children.length;
fs.mkdirSync('docs/v9/character/review',{recursive:true});fs.writeFileSync('docs/v9/character/review/root-cpu-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

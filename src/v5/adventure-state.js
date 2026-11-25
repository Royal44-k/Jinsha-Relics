import {ADVENTURE_STAGES,FEATHER_DEFINITIONS} from './adventure-data.js';
import {sanitizeExpedition} from '../v9/expedition-state.js';

export const LIGHT_TARGETS=Object.freeze([1,3,2]);
export const WATER_TARGETS=Object.freeze([0,2,0]);
export const RING_COUNT=6;
const ids=new Set(ADVENTURE_STAGES.map(s=>s.id)),featherIds=new Set(FEATHER_DEFINITIONS.map(f=>f.id));
const validTurn=n=>Number.isInteger(n)&&n>=0&&n<4;
const turns=(v,fallback)=>fallback.map((n,i)=>validTurn(v?.[i])?v[i]:n);
const copy=value=>JSON.parse(JSON.stringify(value));
const unique=(a,allowed)=>[...new Set(Array.isArray(a)?a.filter(v=>allowed.has(v)):[])];

/** Each L-shaped channel has two ports. N,E,S,W are 0,1,2,3. */
export function channelFlow(angles){
 const ports=angles.map(turn=>[turn%4,(turn+1)%4]);
 const required=[[0,1],[3,2],[0,1]];let flowing=true;
 return required.map((pair,i)=>(flowing=flowing&&pair.every(port=>ports[i].includes(port))));
}

export function sanitizeAdventure(value,legacyCollected=[]){
 const d=value&&typeof value==='object'?value:{},legacy=new Set(Array.isArray(legacyCollected)?legacyCollected:[]);
 const slots=[null,null,null],used=new Set();
 for(let i=0;i<3;i++){const bud=d.root?.slots?.[i];if(Number.isInteger(bud)&&bud>=0&&bud<3&&!used.has(bud)){slots[i]=bud;used.add(bud);}}
 let held=d.root?.held;if(!Number.isInteger(held)||held<0||held>2||used.has(held))held=null;
 if(legacy.has('bird')){slots.splice(0,3,0,1,2);held=null;}
 const lightTurns=legacy.has('jade')?[...LIGHT_TARGETS]:turns(d.light?.turns,[0,0,0]);
 const waterTurns=legacy.has('mask')?[...WATER_TARGETS]:turns(d.water?.turns,[1,0,3]);
 const trialCompleted=d.trial?.completed===true||legacy.has('tiger');
 const firstFour=slots.every(v=>v!==null)&&lightTurns.every((v,i)=>v===LIGHT_TARGETS[i])&&channelFlow(waterTurns).every(Boolean)&&trialCompleted;
 const finaleComplete=(d.finale?.complete===true&&firstFour)||legacy.has('sun');
 // A previously completed ending implies the prerequisite memories in old saves.
 if(finaleComplete){slots.splice(0,3,0,1,2);held=null;lightTurns.splice(0,3,...LIGHT_TARGETS);waterTurns.splice(0,3,...WATER_TARGETS);}
 const discovered=unique(d.discovered,ids);
 for(const stage of ADVENTURE_STAGES)if(legacy.has(stage.relicId)||finaleComplete)if(!discovered.includes(stage.id))discovered.push(stage.id);
 return {version:1,root:{slots,held},light:{turns:lightTurns},water:{turns:waterTurns},trial:{completed:trialCompleted||finaleComplete,best:Number.isFinite(d.trial?.best)&&d.trial.best>0&&d.trial.best<3600?d.trial.best:null,assist:d.trial?.assist===true},finale:{complete:finaleComplete},discovered,feathers:unique(d.feathers,featherIds),furthestDistance:Number.isFinite(d.furthestDistance)?Math.max(0,Math.min(10000,d.furthestDistance)):0,expedition:sanitizeExpedition(d.expedition)};
}

/** Swept, forward plane crossing prevents tunnelling at low frame rates. */
export function segmentPassesRing(from,to,ring,radius=ring.radius){
 const a=from.map((n,i)=>n-ring.position[i]),b=to.map((n,i)=>n-ring.position[i]);
 const dot=(x,y)=>x.reduce((v,n,i)=>v+n*y[i],0),da=dot(a,ring.normal),db=dot(b,ring.normal);
 if(da>0||db<0||db-da<1e-6)return false;
 const t=-da/(db-da),point=a.map((n,i)=>n+(b[i]-n)*t);
 return dot(point,point)<=radius*radius;
}

export function createAdventureState({saved,legacyCollected=[],onEvent=()=>{}}={}){
 let data=sanitizeAdventure(saved,legacyCollected),focus=0;
 const trial={active:false,time:0,ringsHit:0,assistAtStart:false};
 const done=id=>id==='root'?data.root.slots.every(v=>v!==null):id==='light'?data.light.turns.every((v,i)=>v===LIGHT_TARGETS[i]):id==='water'?channelFlow(data.water.turns).every(Boolean):id==='flight'?data.trial.completed:data.finale.complete;
 const rewarded=new Set(ADVENTURE_STAGES.filter(s=>done(s.id)).map(s=>s.id));
 const emit=(type,detail={})=>onEvent({type,...detail});
 function changed(detail={}){emit('change',detail);}
 function finish(id){if(!done(id)||rewarded.has(id))return;rewarded.add(id);if(!data.discovered.includes(id))data.discovered.push(id);const stage=ADVENTURE_STAGES.find(s=>s.id===id);emit('stage',{id,relicId:stage.relicId,title:stage.title});if(id==='sun')emit('complete');}
 function discover(id){if(!ids.has(id)||data.discovered.includes(id))return false;data.discovered.push(id);const s=ADVENTURE_STAGES.find(v=>v.id===id);emit('discovery',{id,title:s.title,text:s.discovery});changed();return true;}
 function takeLight(index){if(done('root')||data.root.held!==null||!Number.isInteger(index)||index<0||index>2||data.root.slots.includes(index))return false;data.root.held=index;emit('cue',{name:'light-pickup'});changed();return true;}
 function placeLight(index){if(!Number.isInteger(index)||index<0||index>2||data.root.slots[index]!==null||data.root.held===null)return false;data.root.slots[index]=data.root.held;data.root.held=null;emit('cue',{name:'light-place'});finish('root');changed();return true;}
 function rotateLight(index){if(done('light')||!Number.isInteger(index)||index<0||index>2)return false;data.light.turns[index]=(data.light.turns[index]+1)%4;emit('cue',{name:'jade-turn'});finish('light');changed();return true;}
 function rotateWater(index){if(done('water')||!Number.isInteger(index)||index<0||index>2)return false;data.water.turns[index]=(data.water.turns[index]+1)%4;emit('cue',{name:'water-turn'});finish('water');changed();return true;}
 function collectFeather(id){if(!featherIds.has(id)||data.feathers.includes(id))return false;data.feathers.push(id);const feather=FEATHER_DEFINITIONS.find(f=>f.id===id);emit('discovery',{id,title:feather.label,text:data.feathers.length===12?'十二道微光，记住了你走过的每一种路。':'你发现了一枚光羽。水下、枝头和岔路，还藏着别的回响。'});emit('cue',{name:'feather'});changed();return true;}
 function startTrial(){trial.active=true;trial.time=0;trial.ringsHit=0;trial.assistAtStart=data.trial.assist;emit('cue',{name:'trial-start'});emit('message',{speaker:'烁羽',text:data.trial.assist?'风环已放宽。别着急，沿着亮起的风，慢慢飞。':'先向上，再向前。跟着那一道最亮的风环。'});changed();return true;}
 function tickTrial(dt,playing=true){if(trial.active&&playing)trial.time+=(Number.isFinite(dt)?Math.max(dt,0):0);}
 function hitRing(index){if(!trial.active||index!==trial.ringsHit)return false;trial.ringsHit++;emit('cue',{name:'ring',index});if(trial.ringsHit===RING_COUNT){trial.active=false;data.trial.completed=true;if(!trial.assistAtStart&&trial.time>0&&(data.trial.best===null||trial.time<data.trial.best))data.trial.best=trial.time;finish('flight');emit('message',{speaker:'烁羽',text:trial.assistAtStart?'风会记得你穿过长夜的身影。':'飞过来了！长夜的那一头，也有光。'});changed();}return true;}
 function focusFinale(dt,aligned,playing=true){if(!playing||done('sun')||!['root','light','water','flight'].every(done))return;focus=Math.max(0,Math.min(1,focus+(aligned?1:-.65)*(Number.isFinite(dt)?Math.max(dt,0):0)/1.8));if(focus>=1){data.finale.complete=true;finish('sun');changed();}}
 function restore(saved,legacy=[]){data=sanitizeAdventure(saved,legacy);focus=0;trial.active=false;trial.time=0;trial.ringsHit=0;rewarded.clear();for(const s of ADVENTURE_STAGES)if(done(s.id))rewarded.add(s.id);}
 function setAssist(value){const bool=value===true;if(data.trial.assist===bool)return;data.trial.assist=bool;if(trial.active&&bool)trial.assistAtStart=true;changed();}
 function visit(distance){if(Number.isFinite(distance))data.furthestDistance=Math.max(data.furthestDistance,Math.min(10000,Math.max(0,distance)));}
 return {get data(){return data;},get focus(){return focus;},trial,done,discover,takeLight,placeLight,rotateLight,rotateWater,collectFeather,startTrial,tickTrial,hitRing,focusFinale,setAssist,visit,serialize:()=>copy(data),restore,reset:()=>restore(null)};
}

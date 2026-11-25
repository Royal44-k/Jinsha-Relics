import {simulationDelta} from '../v8/frame-time.js';

export const LIVING_MOMENTS=Object.freeze([
 {id:'lantern-bough',title:'一枝星河',short:'古树回信',duration:2.8,story:'你收起羽翼，古树间的微光才敢靠近。山林也会回答安静的来客。'},
 {id:'river-mirror',title:'水下的银环',short:'河流回信',duration:3,story:'当水声盖过脚步，银鳞不再躲藏。你成为了河流中安静的一部分。'},
 {id:'wing-passage',title:'与风同路',short:'群鸟回信',duration:2.5,story:'你没有追赶它们，而是等到邀请。穿过下一阵风时，你已不再独行。'},
]);
const ids=new Set(LIVING_MOMENTS.map(m=>m.id));
const clean=a=>[...new Set(Array.isArray(a)?a.filter(id=>ids.has(id)):[])];
export function sanitizeLiving(data){const completed=clean(data?.completed);return {version:1,completed,discovered:clean([...clean(data?.discovered),...completed])};}

/** Optional observation rewards use only game-time and physical action. */
export function createLivingState(saved,onEvent=()=>{}){
 let value=sanitizeLiving(saved),runtime={};
 const fresh=()=>{runtime=Object.fromEntries(LIVING_MOMENTS.map(m=>[m.id,{timer:0,invitation:0,phase:'quiet',reveal:0,cooldown:0}]));};fresh();
 function emit(type,id){onEvent({type,id,...LIVING_MOMENTS.find(m=>m.id===id)});}
 function update(dt,input={}){
  if(!input.playing)return;dt=simulationDelta(dt);
  for(const [key,r] of Object.entries(runtime)){r.reveal=Math.max(0,r.reveal-dt);r.cooldown=Math.max(0,r.cooldown-dt);if(key!==input.id)r.timer=Math.max(0,r.timer-dt*.8);}
  const {id,distance=Infinity,mode='grounded',listening=false,speed=0}=input,m=LIVING_MOMENTS.find(m=>m.id===id);if(!m)return;
  const r=runtime[id];if(distance<15&&!value.discovered.includes(id)){value.discovered.push(id);emit('discover',id);}
  const near=distance<(id==='wing-passage'?12:id==='river-mirror'?5:1.6);
  if(id==='wing-passage'&&near&&listening&&mode==='grounded'&&speed<.4){r.invitation=Math.min(2,r.invitation+dt);if(r.invitation>=2&&r.phase==='quiet'){r.phase='invited';emit('ready',id);}}
  const condition=near&&listening&&(id==='lantern-bough'?mode==='perched'&&speed<.3:id==='river-mirror'?mode==='diving'&&speed<1.1:r.invitation>=2&&['flying','gliding','rising'].includes(mode));
  if(condition&&r.cooldown===0){r.timer=Math.min(m.duration,r.timer+dt);if(r.timer>=m.duration){r.reveal=14;r.cooldown=22;r.timer=0;r.phase='responding';if(!value.completed.includes(id)){value.completed.push(id);emit('complete',id);}else emit('revisit',id);}}
  else r.timer=Math.max(0,r.timer-dt*.8);
  if(r.phase==='responding'&&r.reveal===0)r.phase=id==='wing-passage'?'invited':'quiet';
 }
 function snapshot(id){const m=LIVING_MOMENTS.find(m=>m.id===id),r=runtime[id];if(!m)return null;return {...m,done:value.completed.includes(id),discovered:value.discovered.includes(id),phase:r.phase,progress:r.timer/m.duration,invitation:r.invitation/2,reveal:r.reveal};}
 return {update,snapshot,serialize:()=>sanitizeLiving(value),restore(data){value=sanitizeLiving(data);fresh();},reset(){value=sanitizeLiving();fresh();},all:()=>LIVING_MOMENTS.map(m=>snapshot(m.id))};
}

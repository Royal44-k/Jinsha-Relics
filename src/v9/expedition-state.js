/** Original memory-landscape encounters. No creature or ritual is a historical reconstruction. */
export const ENCOUNTERS=Object.freeze([
 {id:'reed',title:'芦岸 · 滞息',fraction:.251,lateral:-6.8,hits:2,windup:1.9,waveTime:2.0,exposed:3.1,radius:10,attack:'ripple',reward:'芦岸种火',story:'古根醒了，河岸却听不见新叶摩擦的声音。滞留的蚀影缠着芦芽，等一声清亮的鸣光。',clearText:'听见了吗？芦叶又会在风里相遇。古根带来的春意，终于走到了水边。'},
 {id:'stone',title:'石廊 · 回声',fraction:.468,lateral:-6.2,hits:3,windup:1.85,waveTime:3.4,exposed:3.0,radius:10.8,attack:'echo',reward:'石心种火',story:'石廊尽头是泥火聚落。这里曾传来脚步与陶器轻碰的声音，蚀影把回家的路藏进了沉默。',clearText:'石缝里的光接起来了。沿着它走，前面有人留下过泥与火的温度。'},
 {id:'dusk',title:'暮原 · 噬光',fraction:.894,lateral:-6.3,hits:3,windup:2.1,waveTime:2.2,exposed:2.6,radius:11.5,attack:'broken',reward:'暮原种火',story:'越过长夜后，最后一簇种火还守在九柱之前。让它醒来，把林、河与人的回声送往日轮。',clearText:'最后一簇火没有熄灭。回望来路，林、河与聚落都在你羽间——现在，去迎接日轮吧。'},
]);
const validIds=new Set(ENCOUNTERS.map(e=>e.id));
// The low ground wave clears below the feet during the useful part of a
// ballistic short jump (actual 4.1 m/s launch apex ~0.834 m at 90 Hz).
// Requiring 0.85 m made every unpowered Space tap fail despite its animation.
export const WAVE_CLEARANCE_HEIGHT=.58;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function sanitizeExpedition(value){const cleared=[...new Set(Array.isArray(value?.cleared)?value.cleared.filter(id=>validIds.has(id)):[])],discovered=[...new Set([...(Array.isArray(value?.discovered)?value.discovered.filter(id=>validIds.has(id)):[]),...cleared])];return {cleared,discovered};}
export function growthFromJourney({stages=0,feathers=0,cleared=[]}={}){
 const completed=clamp(Number.isFinite(stages)?Math.floor(stages):0,0,5),found=clamp(Number.isFinite(feathers)?Math.floor(feathers):0,0,12);
 const essence=completed*2+Math.floor(found/3)+sanitizeExpedition({cleared}).cleared.length*2,level=essence>=10?2:essence>=4?1:0;
 return {level,name:['初羽','青翎','曜羽'][level],essence,nextAt:[4,10,null][level],airEfficiency:[1,.9,.8][level],dashRecovery:[1,.88,.76][level],pulseReach:[6.2,7.2,8.4][level],description:['林河的每一次回应，都让你的羽翼生长。','嫩绿翎缘初生；羽力更持久，闪身恢复更快。','青金冠纹展开；长途飞行与连贯闪身更加从容。'][level]};
}

/** CPU-only combat rules with swept radial collision and a bounded fixed-step clock. */
export function createExpeditionState({saved,onEvent=()=>{}}={}){
 let data=sanitizeExpedition(saved),active=null,cooldown=0,clock=0,lastPlayer=null;
 const emit=(type,detail={})=>onEvent({type,...detail});
 const definition=id=>ENCOUNTERS.find(e=>e.id===id);
 function discover(id){const d=definition(id);if(!d||data.discovered.includes(id))return false;data.discovered.push(id);emit('discovery',{id:'encounter-'+id,title:d.title,text:d.story});emit('change');return true;}
 function resetRuntime(){active=null;cooldown=0;lastPlayer=null;}
 function begin(id){const d=definition(id);if(!d||data.cleared.includes(id)||active&&active.phase!=='retry')return false;discover(id);active={id,phase:'windup',elapsed:0,health:d.hits,ward:3,cycle:0,hitThisWave:false,waveRadius:0,hitFlash:0};lastPlayer=null;emit('cue',{name:'encounter-wake',id});emit('message',{speaker:'烁羽',text:'那是缠住记忆的蚀影。看地面的波纹——跳起、展翼，或闪身躲开；青心露出时再鸣光。'});return true;}
 function leave(){if(!active)return false;const id=active.id,cleared=active.phase==='cleared';resetRuntime();if(!cleared){emit('encounter-exit',{id});emit('message',{speaker:'烁羽',text:'先退到安静的地方。等准备好了，再回来唤醒它。'});}return true;}
 function pulse({distance=Infinity,facing=true,reach=6.2,playing=true}={}){
  if(!playing||!active||active.phase==='retry')return false;
  if(cooldown>0)return false;
  cooldown=.7;
  const d=definition(active.id);
  if(active.phase!=='exposed'){emit('message',{speaker:'烁羽',text:'蚀影还护着种心。先避开环波，等它变成青绿色。'});emit('cue',{name:'pulse-blocked'});return false;}
  if(distance>reach||!facing){emit('message',{speaker:'烁羽',text:distance>reach?'靠近青绿色的种心，再按 E 或 B 鸣光。':'转向青绿色的种心，再释放鸣光。'});return false;}
  active.health--;active.hitFlash=.45;emit('cue',{name:'pulse-hit',id:active.id});emit('pulse',{id:active.id,health:active.health});
  if(active.health<=0){const id=active.id;data.cleared.push(id);active.phase='cleared';active.elapsed=0;active.waveRadius=0;emit('encounter-cleared',{id,title:d.title,reward:d.reward});emit('message',{speaker:'烁羽',text:d.clearText});emit('change');}
  else{active.phase='windup';active.elapsed=-.65;active.waveRadius=0;active.hitThisWave=false;active.cycle++;}
  return true;
 }
 function advance(dt,{distance=Infinity,height=0,dashing=false,playing=true,angle=0}={}){
  if(!playing)return;
  const delta=clamp(Number.isFinite(dt)?dt:0,0,.25);clock+=delta;cooldown=Math.max(0,cooldown-delta);
  if(!active)return;
  if(distance>15.5){leave();return;}
  if(active.phase==='retry'||active.phase==='cleared'){active.elapsed+=delta;if(active.phase==='cleared'&&active.elapsed>3)resetRuntime();return;}
  const d=definition(active.id),priorDistance=lastPlayer?.distance??distance,priorHeight=lastPlayer?.height??height;
  // Short internal steps preserve the swept wave even when a frame crosses phase boundaries.
  let remaining=delta;while(remaining>1e-8&&active&&active.phase!=='retry'){
   const step=Math.min(1/60,remaining),portion=delta>0?(delta-remaining+step)/delta:1,playerDistance=priorDistance+(distance-priorDistance)*portion,playerHeight=priorHeight+(height-priorHeight)*portion;
   remaining-=step;active.hitFlash=Math.max(0,active.hitFlash-step);active.elapsed+=step;
   if(active.phase==='windup'&&active.elapsed>=d.windup){active.elapsed-=d.windup;active.phase='wave';active.waveRadius=0;active.waveLeg=0;active.hitThisWave=false;emit('cue',{name:'encounter-wave',id:active.id});}
   if(active.phase==='wave'){
    const previousRadius=active.waveRadius,waveProgress=clamp(active.elapsed/d.waveTime,0,1),waveLeg=d.attack==='echo'&&waveProgress>.5?1:0;if(waveLeg!==active.waveLeg){active.waveLeg=waveLeg;active.hitThisWave=false;emit('cue',{name:'encounter-wave',id:active.id,returning:true});}
    active.waveRadius=(d.attack==='echo'?waveProgress<=.5?waveProgress*2:(1-waveProgress)*2:waveProgress)*d.radius;
    const crossed=playerDistance>=Math.min(previousRadius,active.waveRadius)-.48&&playerDistance<=Math.max(previousRadius,active.waveRadius)+.48,safeAngle=Math.PI/2+active.cycle*.9,angularDistance=Math.abs(Math.atan2(Math.sin(angle-safeAngle),Math.cos(angle-safeAngle))),insideGap=d.attack==='broken'&&angularDistance<Math.PI/5;
    if(!active.hitThisWave&&crossed){active.hitThisWave=true;if(playerHeight<WAVE_CLEARANCE_HEIGHT&&!dashing&&!insideGap){active.ward--;active.hitFlash=.5;emit('cue',{name:'encounter-hurt',id:active.id});emit('encounter-hit',{id:active.id,ward:active.ward});if(active.ward<=0){active.phase='retry';active.elapsed=0;active.waveRadius=0;emit('message',{speaker:'烁羽',text:'护光散了，先收一收翅膀。按 E 重新试一次；也可以离开这里，稍后再来。'});break;}}}
    if(active.elapsed>=d.waveTime){active.elapsed-=d.waveTime;active.phase='exposed';active.waveRadius=0;emit('cue',{name:'encounter-open',id:active.id});}
   }else if(active.phase==='exposed'&&active.elapsed>=d.exposed){active.elapsed-=d.exposed;active.phase='windup';active.cycle++;}
  }
  lastPlayer={distance,height};
 }
 function snapshot(id,distance=Infinity,reach=6.2,facing=true){
  const d=definition(id);if(!d)return null;const a=active?.id===id?active:null,cleared=data.cleared.includes(id),phase=a?.phase||(cleared?'cleared':'idle'),duration=phase==='windup'?d.windup:phase==='wave'?d.waveTime:d.exposed;
  const hints={idle:d.attack==='echo'?'回声会折返。准备连续越波，等青心露出。':d.attack==='broken'?'寻找青色缺口；蚀浪退去时，鸣光唤回种火。':'看它蓄起的环波。越过去，等青心露出。',windup:d.attack==='echo'?'回声会去而复返 · 准备连续越过两道波':d.attack==='broken'?'青色缺口是安全通道 · 侧移入位或跳起 / 闪身':'环波正在蓄起 · 空格跳起 / X 闪身 / 展翼',wave:d.attack==='echo'?(a?.waveLeg?'回声正在折返 · 再越过一次！':'第一道波向外扩散 · 留意它会折返'):d.attack==='broken'?'留在青色缺口 · 或跳起 / 闪身越过蚀浪':'越过地面的环波 · 每一波只伤一次护光',exposed:distance>reach?'青心已露出 · 靠近后 E / B 鸣光':!facing?'转向青绿色种心 · E / B 鸣光':'青心已露出 · E / B 鸣光',retry:'护光散去 · E 重试，或离开此处稍后再来',cleared:'记忆已净化 · 种火永久保存'};
  return {id,title:d.title,phase,health:a?.health??(cleared?0:d.hits),maxHealth:d.hits,ward:a?.ward??3,hint:hints[phase],distance,facing,canPulse:phase==='exposed'&&distance<=reach&&facing&&cooldown<=0,progress:clamp((a?.elapsed||0)/duration,0,1),waveRadius:a?.waveRadius||0,hitFlash:a?.hitFlash||0,active:!!a&&phase!=='cleared',reward:d.reward,attack:d.attack,cycle:a?.cycle||0,safeAngle:Math.PI/2+(a?.cycle||0)*.9};
 }
 function restore(saved){data=sanitizeExpedition(saved);resetRuntime();}
 return {begin,discover,leave,pulse,advance,snapshot,restore,reset:()=>restore(null),get activeId(){return active?.id??null;},get data(){return data;},serialize:()=>({cleared:[...data.cleared],discovered:[...data.discovered]})};
}

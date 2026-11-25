import * as T from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createCharacter } from '../v2/character.js';
import { applyRiverPlumage } from './river-plumage.js';
import { createLocomotion } from '../v3/locomotion.js';
import { createLandscape } from './landscape.js';
import { createStations } from './stations.js';
import { createRiverHabitat } from './river-habitat.js';
import { createFieldReading } from './field-reading.js';
import { cameraReach } from './camera-boom.js';
import { photograph } from '../v16/field-camera.js';
import {planSurveyFlight,advanceSurveyFlight} from './survey-flight.js';
import { createGroundContact } from './ground-contact.js';
import {createRiverPassage} from '../v16/river-passage.js';
import { createShadowAnchor } from '../v9/shadow-anchor.js';
import { createSurveyWorld,sites,ground,origin } from './geography.js';
import { skillLevel } from './ledger.js';
import { createFieldTrails } from '../v11/field-trails.js';
import { applyCollectionLook } from '../v11/collection-look.js';

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const facing=(a,b)=>Math.atan2(a.x-b.x,a.z-b.z);
const smooth=(n,d)=>1-Math.exp(-n*d);
const states={grounded:'踏查',perched:'停栖',swimming:'浮游',diving:'潜水',flying:'振翼',gliding:'滑翔',rising:'起跃',falling:'落羽'};
const walkingKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyC','KeyR','ControlLeft','ControlRight','ShiftLeft','ShiftRight','AltLeft','AltRight','KeyX','KeyT']);
export async function createTraverse(host,callbacks){
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  const gl=renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');
  const software=info&&/swiftshader|llvmpipe|software rasterizer|basic render/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  let limit=software ? .74 : Math.min(window.devicePixelRatio||1,1.45);
  let active=true,reviewHold=false,ratio=limit,last=0,time=0,frame=0;
  let poor=0,good=0,lastResize=0,uiClock=0,count=0,target=0,yaw=0,orbit=0,tilt=.22,drag=null,guideRun=null,feet=0;
  let lookFree=0,destroyed=false;const life=new AbortController(),held=new Set();
  const listen=(el,type,fn,opts={})=>el.addEventListener(type,fn,{...opts,signal:life.signal});
  const keys=(...codes)=>codes.some(c=>held.has(c));
  renderer.setPixelRatio(ratio);renderer.setSize(host.clientWidth,host.clientHeight,false);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=!software;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  const canvas=renderer.domElement;host.append(canvas);canvas.tabIndex=0;canvas.setAttribute('aria-label','烁羽的河岸视野');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(56,host.clientWidth/host.clientHeight,.11,470);
  scene.fog=new T.FogExp2(0xafb9a8,.0142);
  const fill=new T.HemisphereLight(0xdae8ed,0x98775c,1.55),key=new T.DirectionalLight(0xffdfac,2.55);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:1,far:65});
  key.shadow.bias=-.0009;key.shadow.normalBias=.025;key.shadow.camera.updateProjectionMatrix();scene.add(fill,key,key.target);
  let environment=null;
  const environmentReady=new HDRLoader().loadAsync('/assets/environment/forest-light-512.hdr').then(map=>{
    if(destroyed){map.dispose();return;}
    map.mapping=T.EquirectangularReflectionMapping;scene.environment=environment=map;scene.environmentIntensity=.44;
  },()=>{});
  const world=createSurveyWorld();let scenery,stations,actor,habitat,reading,trails,traits,passage;
  function dispose(){
    if(destroyed)return;destroyed=true;active=false;cancelAnimationFrame(frame);life.abort();stations?.dispose?.();trails?.dispose?.();habitat?.dispose();passage?.dispose();actor?.dispose();
    scene.traverse(obj=>{if(obj.isMesh){obj.geometry.dispose();const materials=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of materials){for(const texture of [m.map,m.normalMap,m.alphaMap])texture?.dispose();m.dispose();}}});
    environment?.dispose();renderer.dispose();canvas.remove();
  }
  try{
    callbacks.loading?.('铺开河岸地形、芦滩与探方',1);
    await new Promise(resolve=>setTimeout(resolve,0));
    scenery=createLandscape(scene,world);stations=createStations(scene,world);habitat=createRiverHabitat(scene,world);reading=createFieldReading(scene,callbacks.observation,world);
    passage=createRiverPassage(scene,{reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,cue:callbacks.cue});
    trails=createFieldTrails(scene,{...callbacks,sideFinished:()=>trackSide(null)},world);
    callbacks.loading?.('载入羽片、骨骼与探方的土层材质',2);
    [actor]=await Promise.all([createCharacter({lod:software||matchMedia('(max-width:700px)').matches?1:0,plumage:applyRiverPlumage}),stations.ready,environmentReady]);
  }catch(e){dispose();throw e;}
  scene.add(actor.group);
  const pos=new T.Vector3(),eye=new T.Vector3(),aim=new T.Vector3(),nextEye=new T.Vector3(),nextAim=new T.Vector3(),goal=new T.Vector3(),renderPos=new T.Vector3(),mark=new T.Vector3();
  const contact=createGroundContact(scene,world);
  const airFog=new T.Color(0x839588),underwaterFog=new T.Color(0x386c66);
  let law='grounded',snapView=true,stickX=0,stickY=0,diveCamera=0,waterMix=0;
  const motion=createLocomotion({world,position:pos,onEvent:event=>{if(!active)return;
    if(event.type==='splash'||event.type==='surface')contact.ripple(pos,event.type==='splash'?1:.6);
    callbacks.cue(event.type);if(['boundary','shallow-water','perch','obstacle','perch-hint','perch-blocked','cruise-hint','recovery','oxygen'].includes(event.type))callbacks.message(event.text);
  }});
  function setTraits(next){
    traits=next||null;if(traits)applyCollectionLook(actor,traits);
    motion.setGrowth({airEfficiency:Math.min(traits?.airEfficiency??1,1-.085*skillLevel(count)),dashRecovery:Math.min(traits?.dashRecovery??1,1-.10*skillLevel(count)),groundSpeed:traits?.groundSpeed??1,collection:!!traits});
  }
  function setTarget(n,i=Math.min(n,8)){
    count=n;target=i;const [gx,gz]=sites[i];goal.set(gx,ground(gx,gz),gz);guideRun=null;uiClock=1;
    trails.track(null);setTraits(callbacks.loadout?.()||traits);
  }
  function trackSide(id){
    const item=trails.track(id),at=item?.entry||sites[target];
    const bed=ground(...at);goal.set(at[0],item?Math.max(0,bed):bed,at[1]);guideRun=null;uiClock=1;
    if(item)callbacks.message(item.title+'。'+item.hint);return !!item;
  }
  function interactSide(){
    if(!active)return false;
    const was=trails.tracked,handled=trails.interact();
    if(was&&!trails.tracked)trackSide(null);
    return handled;
  }
  function returnToCheckpoint(n){
    reading.reset();trails.restore();passage.reset();diveCamera=waterMix=0;
    setTarget(n);const at=n===0?origin:sites[Math.min(8,n-1)];
    pos.set(at[0],ground(...at),at[1]);motion.reset(pos);
    yaw=pos.distanceTo(goal)>.1?facing(pos,goal):.18;orbit=yaw;actor.group.rotation.y=yaw;snapView=true;
  }
  function setActive(value) {
    active=value;held.clear();stickX=stickY=0;document.querySelector('#stick i').style.transform='';guideRun=null;drag=null;motion.stop();
    cancelAnimationFrame(frame);last=0;
    if(active&&!reviewHold&&!document.hidden)frame=requestAnimationFrame(draw);
  }
  function pauseForReview(value){
    reviewHold=value;held.clear();stickX=stickY=0;drag=null;
    document.querySelector('#stick i').style.transform='';
    cancelAnimationFrame(frame);last=0;
    if(active&&!reviewHold&&!document.hidden)frame=requestAnimationFrame(draw);
  }
  function stopGuide(){if(guideRun){guideRun=null;motion.reset(pos);callbacks.message('已接管烁羽。');}}
  function guided(){
    if(!active)return;
    canvas.focus({preventScroll:true});
    if(guideRun){stopGuide();return;}
    const d=Math.hypot(pos.x-goal.x,pos.z-goal.z);
    if(d<3.4&&Math.abs(pos.y-goal.y)<2.3){callbacks.interact();return;}
    guideRun=planSurveyFlight(world,pos,goal);
    if(!guideRun){callbacks.message('这里的翼展空间不足。沿障碍侧面走出几步，再开启领航。');return;}
    motion.stop();yaw=facing(pos,goal);lookFree=0;callbacks.message('烁羽正沿旧岸线领航。按移动键可随时接管。');
  }
  function action(code){
    if(!active)return;
    if(code==='Space')motion.jump();
    else if(code==='KeyR')motion.toggleCruise();
    else if(code==='KeyC'||code==='ControlLeft')motion.dive();
    else if(code==='AltLeft'||code==='AltRight'||code==='KeyX')motion.dash({moveZ:1,yaw});
    else if(code==='KeyT')motion.requestPerch();
  }
  listen(window,'keydown',e=>{
    if(!active||reviewHold||e.defaultPrevented||e.metaKey||!walkingKeys.has(e.code))return;
    if(e.ctrlKey&&!e.code.startsWith('Control')||e.altKey&&!e.code.startsWith('Alt'))return;
    if(e.target?.closest?.('input,select,textarea')||e.code==='Space'&&e.target?.closest?.('button,summary,a'))return;
    if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code))canvas.focus({preventScroll:true});
    e.preventDefault();if(!e.repeat){stopGuide();held.add(e.code);action(e.code);}
  });
  listen(window,'keyup',e=>held.delete(e.code));
  listen(window,'blur',()=>{held.clear();stickX=stickY=0;});
  listen(document,'visibilitychange',()=>{held.clear();cancelAnimationFrame(frame);last=0;if(active&&!reviewHold&&!document.hidden)frame=requestAnimationFrame(draw);});
  listen(canvas,'pointerdown',e=>{if(!active)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
  listen(canvas,'pointermove',e=>{if(!active||drag?.id!==e.pointerId)return;
    orbit-=(e.clientX-drag.x)*.006;tilt=T.MathUtils.clamp(tilt+(e.clientY-drag.y)*.004,-.025,.85);drag.x=e.clientX;drag.y=e.clientY;lookFree=1;
  });
  listen(canvas,'lostpointercapture',()=>{drag=null;});
  const pad=document.getElementById('stick');
  function steer(e){
    const b=pad.getBoundingClientRect(),dx=(e.clientX-b.left-b.width/2)/(b.width*.45),dy=(e.clientY-b.top-b.height/2)/(b.height*.45);
    // A thumb held forward rarely lands on the center pixel. A small axial
    // dead zone allows steady straight flight without slowly rotating the view.
    const axis=v=>Math.sign(v)*Math.max(0,(Math.abs(v)-.075)/.925);
    const x=axis(dx),y=axis(dy),n=Math.max(1,Math.hypot(x,y));
    stickX=x/n;stickY=-y/n;pad.firstElementChild.style.transform='translate('+stickX*19+'px,'+(-stickY*19)+'px)';
  }
  listen(pad,'pointerdown',e=>{stopGuide();pad.setPointerCapture(e.pointerId);steer(e);});listen(pad,'pointermove',e=>{if(pad.hasPointerCapture(e.pointerId))steer(e);});
  listen(pad,'lostpointercapture',()=>{stickX=stickY=0;pad.firstElementChild.style.transform='';});
  for(const [id,code] of [['air','Space'],['down','KeyC'],['cruise','KeyR'],['dash','KeyX']]){
    const button=document.getElementById(id);
    listen(button,'pointerdown',e=>{stopGuide();button.setPointerCapture(e.pointerId);held.add(code);action(code);});
    listen(button,'lostpointercapture',()=>held.delete(code));
  }
  function resize(){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  function setQuality(value='auto'){
    const cap=value==='economy'?(software?.62:1):value==='high'?(software?1:1.7):(software?.74:1.45);
    limit=Math.min(window.devicePixelRatio||1,cap);ratio=limit;good=poor=0;
    renderer.shadowMap.enabled=!software&&value!=='economy';resize();
  }
  listen(window,'resize',resize);
  function applyPose(dt,elapsed){
    let anim=motion.state;
    if(guideRun){
      const x=pos.x,z=pos.z,status=advanceSurveyFlight(world,guideRun,pos,elapsed);
      if(status==='blocked'){
        guideRun=planSurveyFlight(world,pos,goal);
        if(!guideRun){motion.reset(pos);callbacks.message('前路被遮住了。请在开阔处重新领航。');}
      }
      if(Math.hypot(pos.x-x,pos.z-z)>.00003)yaw+=wrap(Math.atan2(x-pos.x,z-pos.z)-yaw)*smooth(12,dt);
      renderPos.copy(pos);anim=guideRun?{mode:'flying',cruise:true,wingbeat:.7,speed:4.6}:motion.state;
      if(status==='arrived'){guideRun=null;motion.reset(pos);anim=motion.state;
        const side=trails.tracked;
        if(side){yaw=facing(pos,side);orbit=yaw;snapView=true;}
        callbacks.message(side?side.hint:'已抵达。观察四周，按 E 开始记录。');}
    }else{
      const turn=(Number(keys('KeyD','ArrowRight'))-Number(keys('KeyA','ArrowLeft')))+stickX;
      yaw-=T.MathUtils.clamp(turn,-1,1)*dt*2.15;
      const move=T.MathUtils.clamp((Number(keys('KeyW','ArrowUp'))-Number(keys('KeyS','ArrowDown')))+stickY,-1,1);
      motion.update(dt,{yaw,moveZ:move,moveX:0,sprint:keys('ShiftLeft','ShiftRight')||Math.abs(stickY)>.8,ascend:keys('Space'),descend:keys('KeyC','ControlLeft','ControlRight')});
      motion.getRenderPosition(renderPos);
      if(move||turn)lookFree=Math.max(0,lookFree-dt);
      if(anim.mode==='grounded'&&anim.speed>.25){feet+=dt*anim.speed;if(feet>.79){feet=0;callbacks.cue('step',.45);}}
    }
    if(!drag&&lookFree<=0)orbit+=wrap(yaw-orbit)*smooth(5.2,dt);
    actor.group.position.copy(renderPos);
    actor.group.rotation.y+=wrap((anim.mode==='perched'&&Number.isFinite(anim.perchYaw)?anim.perchYaw:yaw)-actor.group.rotation.y)*smooth(14,dt);
    // This ground probe also resolves raised walkways and the pottery deck.
    actor.update(dt,time,{...anim,...callbacks.birdSpeech?.(),growth:{level:skillLevel(count)},sampleGround:footHeight,
      attentionYaw:anim.speed<.25?T.MathUtils.clamp(wrap(facing(pos,goal)-yaw),-.35,.35):0});
    law=anim.mode;
  }
  const footHeight=p=>world.sample(p).groundHeight;
  function draw(stamp){
    if(!active||reviewHold||destroyed||document.hidden)return;
    const elapsed=last?(stamp-last)/1000:1/60,dt=Math.min(.20,elapsed);last=stamp;time+=dt;
    if(elapsed>.036){poor+=Math.min(.3,elapsed);good=0;}else if(elapsed<.020){good+=elapsed;poor=Math.max(0,poor-dt*.4);}
    if(stamp/1000-lastResize>4&&(poor>1.8&&ratio>.62||good>14&&ratio<limit)){
      ratio=poor>1.8?Math.max(.62,ratio-.14):Math.min(limit,ratio+.1);poor=good=0;resize();lastResize=stamp/1000;
    }
    applyPose(dt,elapsed);
    // Cross the meniscus with the actual lens. The bird can begin diving while
    // the camera is still in air, or emerge while the lens is still submerged.
    diveCamera=T.MathUtils.damp(diveCamera,law==='diving'?1:0,5.8,dt);
    nextAim.copy(renderPos);nextAim.y+=1.04-.42*diveCamera;nextAim.x-=Math.sin(orbit)*.53;nextAim.z-=Math.cos(orbit)*.53;
    const range=guideRun?5.2:3.95-.90*diveCamera;
    nextEye.set(renderPos.x+Math.sin(orbit)*range,nextAim.y+.22+Math.sin(tilt)*range,renderPos.z+Math.cos(orbit)*range);
    const cameraBed=ground(nextEye.x,nextEye.z);
    nextEye.y=Math.max(nextEye.y,cameraBed+.55);
    if(diveCamera>.001&&cameraBed<-.10){
      const submergedEye=Math.max(cameraBed+.28,Math.min(-.15,renderPos.y+.43));
      nextEye.y=T.MathUtils.lerp(nextEye.y,submergedEye,diveCamera);
    }
    nextEye.lerp(nextAim,1-cameraReach(nextAim,nextEye,world.solidsNear(nextAim,nextEye,.18)));
    if(snapView){snapView=false;eye.copy(nextEye);aim.copy(nextAim);}else{eye.lerp(nextEye,smooth(10,dt));aim.lerp(nextAim,smooth(12,dt));}
    camera.position.copy(eye).lerp(aim,1-cameraReach(aim,eye,world.solidsNear(aim,eye,.18)));camera.lookAt(aim);camera.updateMatrixWorld();
    const shadowInterval=motion.state.speed>.1||!motion.state.grounded||guideRun ? .045 : .20;
    if(stamp/1000-lastShadow>=shadowInterval||snapShadow){
      key.target.position.copy(shadowAnchor(renderPos,lightOffset,24,key.shadow.mapSize.x));key.position.copy(key.target.position).add(lightOffset);
      renderer.shadowMap.needsUpdate=true;lastShadow=stamp/1000;snapShadow=false;
    }
    const lensHeight=camera.position.y,wetBank=T.MathUtils.smoothstep(-ground(camera.position.x,camera.position.z),.02,.38);
    const immersion=(1-T.MathUtils.smoothstep(lensHeight,-.31,.09))*wetBank;
    waterMix=T.MathUtils.damp(waterMix,immersion,7.5,dt);
    scene.fog.color.copy(airFog).lerp(underwaterFog,waterMix);
    scene.fog.density=T.MathUtils.lerp(.0142,.14,waterMix);
    scenery(time,camera);stations.update(time,count,pos);habitat.update(time,pos);trails.update(dt,pos,motion.state);reading.update(dt,count,motion.state,pos);
    contact.update(dt,renderPos,motion.state,law==='grounded'?actor.getFootContacts():[],actor.group.rotation.y);
    passage.update(dt,renderPos,guideRun?'flying':law,motion.state.speed);
    renderer.render(scene,camera);
    uiClock+=dt;if(uiClock>.09){uiClock=0;
      const detailed=trails.siteWaypoint(mark);if(!detailed)mark.copy(goal);
      const vertical=Math.abs(pos.y-mark.y),dist=Math.hypot(pos.x-mark.x,pos.z-mark.z,detailed?vertical:0),relative=wrap(facing(pos,mark)-orbit);
      mark.y+=detailed ? .08 : 1.6;mark.project(camera);
      const candidate=motion.getPerchCandidate();
      callbacks.status({dist,relative,near:dist<4.2&&vertical<2.7&&!trails.tracked,mark,mode:guideRun?'领航':motion.state.cruise?'持续飞行':states[law],resource:law==='diving'?motion.state.oxygen:motion.state.stamina,guided:!!guideRun,perch:candidate?.canRequest,perchLabel:law==='perched'?'离枝展翼':candidate?.label,...trails.info()});
    }
    frame=requestAnimationFrame(draw);
  }
  const lightOffset=new T.Vector3(-15,22,-12),shadowAnchor=createShadowAnchor();
  let lastShadow=-Infinity,snapShadow=true;
  returnToCheckpoint(0);active=false;
  const warmed=new Set();
  function compileReveal(group){
    // Three builds a different shader for the translucent archaeological
    // reveal. Precompile that variant before its first moving-camera frame.
    const solids=new Set();
    group.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.transparent)solids.add(m);});
    renderer.compile(group,camera,scene);
    for(const m of solids){m.transparent=true;m.needsUpdate=true;}
    try{return renderer.compileAsync(group,camera,scene);}
    finally{for(const m of solids){m.transparent=false;m.needsUpdate=true;}}
  }
  function warmStation(index){
    if(destroyed||index<0||index>=sites.length||warmed.has(index))return;
    warmed.add(index);
    const group=stations.prepare(index);if(!group)return;
    const compile=()=>{if(!destroyed)return compileReveal(group);};
    // Scan-backed roots may arrive a little after the rest of their timber frame.
    Promise.resolve(group.userData.assetReady).then(compile).catch(()=>warmed.delete(index));
  }
  async function prime(n){
    returnToCheckpoint(n);await habitat.prime(time,pos);
    snapShadow=true;active=true;draw(performance.now());setActive(false);
    const group=stations.groups.find(o=>o.visible);
    if(group)await compileReveal(group);
    if(n===0){
      // The first bend exposes materials outside the arrival camera's frustum.
      // Render their first use under the illustrated loader, without advancing
      // the simulation or moving the player's camera. Yield between directions.
      const sideView=camera.clone(),boom=camera.position.clone().sub(aim),up=new T.Vector3(0,1,0);
      for(const angle of [Math.PI/2,Math.PI,-Math.PI/2]){
        await new Promise(resolve=>setTimeout(resolve,16));
        if(destroyed)return;
        sideView.position.copy(boom).applyAxisAngle(up,angle).add(aim);
        sideView.lookAt(aim);sideView.updateMatrixWorld();renderer.render(scene,sideView);
      }
    }
    // Upload the finished, nearby scan materials and shadow pass while the
    // illustrated loader still owns the screen. Let the compositor keep moving.
    renderer.render(scene,camera);
    const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
    if(!fence)return;
    gl.flush();const deadline=performance.now()+2500;
    try{
      while(gl.clientWaitSync(fence,0,0)===gl.TIMEOUT_EXPIRED&&performance.now()<deadline){
        await new Promise(resolve=>setTimeout(resolve,16));
      }
    }finally{gl.deleteSync(fence);}
  }
  function presentShore(dt){
    time+=dt;applyPose(dt,dt);scenery(time,camera);habitat.update(time,pos);renderer.render(scene,camera);
  }
  return {photograph:(output,options)=>photograph(renderer,scene,camera,aim,world,output,options),
    setTarget,setTraits,trackSide,interactSide,returnToCheckpoint,setActive,pauseForReview,setQuality,guided,dispose,prime,presentShore,warmStation,focus:()=>canvas.focus({preventScroll:true}),trace:()=>reading.toggle(count),get tracing(){return reading.active;},
    perch:()=>motion.requestPerch(),get position(){return pos;},get target(){return target;},get trackedTrail(){return trails.tracked?.id??null;},
    stats:()=>({position:pos.toArray(),target,count,mode:law,cruise:motion.state.cruise,perchId:motion.state.perchId,boundary:motion.state.boundaryMessage,oxygen:motion.state.oxygen,yaw,cameraY:camera.position.y,waterMix,fogDensity:scene.fog.density,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,ratio,perches:world.perches.length,
      waterbirds:passage.snapshot(),footContacts:actor.getFootContacts().map(({position:p,planted})=>({at:p.toArray(),planted,ground:footHeight(p),rendered:world.terrainSurface.heightAt(p.x,p.z)})),modelForm:{...actor.group.userData.collectionForm},traits:{groundSpeed:traits?.groundSpeed??1,...motion.getSnapshot().growth}})};
}

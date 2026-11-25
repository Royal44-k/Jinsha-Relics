import fs from 'node:fs/promises';
const file='src/v2/main.js';
let s=await fs.readFile(file,'utf8');
function replace(a,b){if(!s.includes(a))throw Error('Missing integration anchor: '+a.slice(0,90));s=s.replace(a,b);}
function fn(name,body){const re=new RegExp('^(?:async )?function '+name+'\\([^\\n]*$','m');if(!re.test(s))throw Error('Missing function '+name);s=s.replace(re,()=>body);}
replace("import { OutputPass }", "import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';\nimport { createLocomotion } from '../v3/locomotion.js';\nimport { createTraversalWorld } from '../v3/traversal-world.js';\nimport { createTraversalEffects, immersionShader } from '../v3/traversal-effects.js';\nimport { OutputPass }");
replace('let muted=settings.master===0',`let traversal,motion,traversalFX,immersionPass,nearestPerch,nearSite,immersion=0,stepTravel=0,wingAt=0,feedbackUntil=0,actionKind='';
const knownZones=new Set(),seenPlaces=new Set(),waterColor=new THREE.Color('#16483e');
let muted=settings.master===0`);
replace('writeSave({...state,lights:[...activated]})','writeSave({...state,lights:[...activated],travel:motion?{safePosition:motion.getSnapshot().safePosition,safePerchId:motion.state.perchId}:null})');
replace("velocity.set(0,0,0);$('joystick')","velocity.set(0,0,0);motion?.stop();$('joystick')");
replace("document.body.classList.toggle('reduced',!!settings.reduced);","document.body.classList.toggle('reduced',!!settings.reduced);traversalFX?.setReduced(settings.reduced);if(immersionPass)immersionPass.uniforms.uReduced.value=settings.reduced?1:0;");
fn('start',`async function start(restore=false){
 resetInput();await audio.unlock();audio.setPaused(false);applySettings();let checkpoint=null;
 if(!restore){state.collected.clear();state.completed=false;activated.clear();state.distance=0;knownZones.clear();seenPlaces.clear();}
 else{const current=readSave();state.distance=clamp(current?.distance||state.distance,0,forest.length);if(current){state.collected=new Set(current.collected);state.completed=current.completed;activated.clear();for(const i of current.lights||[])activated.add(i);checkpoint=current.travel;}}
 position.copy(forest.sample(state.distance));
 if(checkpoint?.safePosition){const p=new THREE.Vector3().fromArray(checkpoint.safePosition),surface=traversal.sample(p);if(!surface.boundary||surface.boundary.distance>0){const perch=traversal.perches.find(v=>v.id===checkpoint.safePerchId&&v.position.distanceTo(p)<.2);position.copy(perch?perch.position:p);if(!perch)position.y=surface.waterDepth>.65?surface.waterLevel-.42:surface.groundHeight;}}
 motion.reset(position);air=verticalSpeed=0;yaw=headingAt(state.distance);pitch=.22;state.mode='playing';character.group.rotation.y=yaw;
 $('title-screen').hidden=true;$('ending').hidden=true;$('hud').hidden=false;updateQuest();snapCamera();persist();
 if(restore&&state.completed){state.mode='ending';$('hud').hidden=true;$('ending').hidden=false;audio.speak('ending');}
 else{audio.speak('intro');showChapter(restore?'重返林河':'序 · 林间初醒',restore?'风，记得你的脚步':'一羽，入林');}
}`);
replace("position.copy(forest.sample(0));air=0;","position.copy(forest.sample(0));motion?.reset(position);air=0;immersion=0;");
replace('倾听找方向 · 侧光看细节 · 借风短跃','踏地行走 · 借风飞行 · 枝头栖停 · 潜入河流');
replace('position.copy(forest.sample(state.distance));air=verticalSpeed=0;snapCamera();closeDialog();toast(\'已回到身边的小径。\');',"position.fromArray(motion.getSnapshot().safePosition);motion.reset(position);snapCamera();closeDialog();toast('已回到最近一次安稳落脚的位置。');");
fn('openHelp',`function openHelp(){openDialog(\`<p class="eyebrow">脚下、风中，与水下</p><h2 id="dialog-title">让身体带你探索</h2><table class="control-table"><tr><td>W A S D / 方向键</td><td>沿镜头方向移动；Shift 奔跑或加速飞行。</td></tr><tr><td>拖动场景</td><td>环顾四周；高枝与浅滩都可能藏在侧面。</td></tr><tr><td>空格 · ↑</td><td>轻按跳跃，按住振翼上升；松开滑翔。水中按住上浮。</td></tr><tr><td>Ctrl / C · ↓</td><td>空中缓降，水面下潜；水下继续下潜。</td></tr><tr><td>E · 就近行动</td><td>低速靠近金色枝环可栖停；靠近器物或生活遗迹可观察。</td></tr><tr><td>Q / F</td><td>倾听寻路 / 展开侧光。终章在四处光点留下光。</td></tr><tr><td>J / Escape</td><td>记忆手册 / 暂停与返回安全落脚点。</td></tr></table><p>羽力不足时仍能滑翔，落地或停栖恢复。水下气息不足会自动上浮。强风与金羽会提醒你折返林缘；断岸也有可步行的原木桥。</p><p>触屏：左摇杆移动，拖动右侧环顾，长按 ↑ / ↓ 控制升降。所有提示都有文字，减少动态选项不会影响通行。</p>\`);}`);
fn('cameraPosition',`function cameraPosition(){
 const m=motion?.state,water=m?.mode==='diving',flying=m&&!m.grounded&&!['swimming','diving'].includes(m.mode);
 cameraTarget.copy(position).y+=water?.48:.85;
 const distance=water?2.9:flying?5.1:4.25,vertical=water?.1+pitch: .32+pitch*2.2;
 desiredCamera.copy(cameraTarget).add(new THREE.Vector3(Math.sin(yaw)*distance,vertical,Math.cos(yaw)*distance));
 rayDirection.copy(desiredCamera).sub(cameraTarget);const length=rayDirection.length();rayDirection.normalize();let allowed=length;
 const colliders=(forest.cameraColliders||[]).filter(o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;});
 const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 for(const offset of [-.18,0,.18]){ray.set(cameraTarget.clone().addScaledVector(right,offset),rayDirection);ray.far=length;const hit=ray.intersectObjects(colliders,true)[0];if(hit)allowed=Math.min(allowed,Math.max(.8,hit.distance-.32));}
 desiredCamera.copy(cameraTarget).addScaledVector(rayDirection,allowed);
 const surface=traversal.sample(desiredCamera);desiredCamera.y=Math.max(desiredCamera.y,surface.groundHeight+.32);
 if(water&&surface.waterLevel!==null)desiredCamera.y=Math.min(desiredCamera.y,surface.waterLevel-.20);
 return desiredCamera;
}`);
fn('tick',`function tick(now){
 frame=requestAnimationFrame(tick);const raw=(now-last)/1000,dt=Math.min(.04,raw||.016);last=now;const live=state.mode!=='modal';if(live)time+=dt;
 if(state.mode==='playing'){
  frameTimes.push(raw*1000);if(frameTimes.length>1200)frameTimes.shift();updatePlayer(dt);forest.update(dt,time,position);traversal.update(dt,time,motion);nearestPerch=traversalFX.update(dt,time,motion.state,position,traversal).nearestPerch;updateNearby();updateTravelUI();if(time-saveAt>3){persist();saveAt=time;}
 }else if(state.mode==='title'){
  position.copy(forest.sample(0));character.group.rotation.y=Math.PI-.35+Math.sin(time*.15)*.09;forest.update(dt,time,position);traversal.update(dt,time,{position,state:{mode:'grounded',speed:0}});camera.position.copy(position).add(new THREE.Vector3(1.15,1.15,2.8));camera.lookAt(position.clone().add(new THREE.Vector3(-.6,.72,0)));
 }
 character.group.position.copy(position);character.update(live?dt:0,time,{...(state.mode==='title'?{mode:'grounded',speed:0,grounded:true}:motion.state),listening:state.listening});
 if(state.mode==='playing'){camera.position.lerp(cameraPosition(),1-Math.exp(-dt*(settings.reduced?18:6)));camera.lookAt(cameraTarget);const fov=48+(settings.reduced?0:Math.max(0,motion.state.speed-3)*1.1);camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*2));camera.updateProjectionMatrix();}
 sun.position.copy(position).add(new THREE.Vector3(-12,24,8));sun.target.position.copy(position);sun.target.updateMatrixWorld();sideLight.position.copy(position).add(new THREE.Vector3(Math.cos(yaw)*1.8,1.3,-Math.sin(yaw)*1.8));sideLight.target.position.copy(position).add(new THREE.Vector3(-Math.sin(yaw)*4,.6,-Math.cos(yaw)*4));sideLight.target.updateMatrixWorld();
 for(const site of lightSites)site.visible=state.collected.size===5&&site.position.distanceTo(position)<22;
 updateEffects(live?dt:0);updateImmersion(live?dt:0);bokeh.enabled=state.mode==='title'&&settings.quality!=='low';renderer.info.reset();composer.render();
 if(preview){if(!preview.dragging()&&!settings.reduced)preview.group.rotation.y+=dt*.12;if(preview.isCharacter){preview.model.traverse(o=>{if(o.isBone&&/wing/i.test(o.name)&&preview.poseUntil>time)o.rotation.z=Math.sin(time*3)*.3;});}preview.renderer.render(preview.scene,preview.camera);}
}`);
fn('updatePlayer',`function updatePlayer(dt){
 motion.update(dt,{moveX:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.x,moveZ:(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-touch.y,yaw,ascend:keys.has('Space'),descend:keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('KeyC'),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),listen:state.listening});
 velocity.copy(motion.velocity);state.distance=clamp(forest.project(position).distance,0,forest.length);
 if(motion.state.speed>.10){const angle=Math.atan2(-velocity.x,-velocity.z);character.group.rotation.y+=Math.atan2(Math.sin(angle-character.group.rotation.y),Math.cos(angle-character.group.rotation.y))*(1-Math.exp(-dt*8));}
 if(motion.state.mode==='grounded'&&motion.state.speed>.3){stepTravel+=dt*motion.state.speed;if(stepTravel>.45){stepTravel=0;traversalFX.emit({type:'step'},position);audio.playMotion('step',.42+motion.state.speed*.1);}}else stepTravel=0;
 if(motion.state.mode==='flying'&&time-wingAt>.55){audio.playMotion('takeoff',.32);wingAt=time;}
 audio.setMotion(motion.state);const region=Math.floor(state.distance/Math.max(1,forest.length/6));if(region!==regionIndex){regionIndex=region;audio.setRegion(regionIndex);}
}`);
fn('jump',`function jump(){if(state.mode==='playing')motion.jump();}`);
fn('updateNearby',`function updateNearby(){
 let nearest=null,dist=3.8;for(const landmark of forest.landmarks){const d=landmark.position.distanceTo(position);if(d<dist){dist=d;nearest=landmark;}}
 state.nearby=nearest?.id||null;nearSite=traversal.landmarks.find(l=>l.type==='culture'&&l.position.distanceTo(position)<6)||null;
 const m=motion.state;actionKind=nearest?'memory':nearestPerch&&m.mode!=='perched'?'perch':nearSite?'place':m.mode==='perched'?'leave':m.mode==='swimming'?'dive':m.mode==='diving'?'surface':'';
 document.body.classList.toggle('near-memory',!!actionKind);$('interact').hidden=!actionKind;
 if(nearest)$('interact-name').textContent=(state.collected.has(nearest.id)?'重读':'观察')+' · '+memories.find(v=>v.id===nearest.id).name;
 else if(actionKind)$('interact-name').textContent=({perch:'减速停栖 · '+nearestPerch?.label,place:'走近 · '+nearSite?.label,leave:'离枝，再次出发',dive:'收翼 · 潜入河流',surface:'向着水光 · 浮起'})[actionKind];
 $('interact').querySelector('small').textContent=actionKind==='perch'?'金环标记可停靠的枝杈':actionKind==='place'?'生活也留下了回响':'靠近，才看见';
}`);
const extra=`
function interact(){
 if(state.mode!=='playing')return;
 if(actionKind==='memory')inspect(state.nearby);
 else if(actionKind==='place'){const place=nearSite;seenPlaces.add(place.id);openDialog('<p class="eyebrow">林河手记 · '+place.label+'</p><h2 id="dialog-title">'+place.label+'</h2><p>'+place.detail+'</p><p>'+(place.evidence||'这里借由考古线索创作可探索的生活意象，建筑外观、植物布置与空间关系属于艺术演绎。')+'</p>'+(place.source?'<a class="source-link" href="'+place.source+'" target="_blank" rel="noopener noreferrer">阅读博物馆研究资料 ↗</a>':'')+'<div class="menu-actions"><button id="place-close" class="outline-button">带着新的发现，继续前行</button></div>');$('place-close').onclick=closeDialog;}
 else if(!motion.interact()&&actionKind==='perch')travelFeedback('先松开方向键，放缓一些，再停到枝头。','perch');
}
function travelFeedback(text,type='info'){
 $('travel-feedback').hidden=false;$('travel-feedback').dataset.kind=type;$('travel-feedback-text').textContent=text;feedbackUntil=time+5;
}
function onMotionEvent(event){
 const point=position.clone(),surface=traversal?.sample(position);if(['splash','surface','dive'].includes(event.type)&&surface?.waterLevel!==null)point.y=surface.waterLevel;
 traversalFX?.emit(event,point);audio.playMotion(event.type,event.impact?Math.min(1,.35+event.impact*.1):.75);
 if(event.type==='land')character?.trigger?.('Land');if(event.type==='jump'||event.type==='takeoff')character?.trigger?.('Start');
 if(['obstacle','boundary'].includes(event.type))character?.trigger?.('StartleRecover');
 if(event.type==='zone'){if(!knownZones.has(event.zoneId)){knownZones.add(event.zoneId);travelFeedback(event.text,'zone');}return;}
 if(!['land','jump','takeoff','splash'].includes(event.type)&&event.text)travelFeedback(event.text,event.type);
 if(event.type==='recovery'){$('travel-fade').classList.add('active');setTimeout(()=>$('travel-fade').classList.remove('active'),700);snapCamera();}
}
function updateTravelUI(){
 const m=motion.state,s=traversal.sample(position),wet=['swimming','diving'].includes(m.mode),airborne=!m.grounded&&!wet;
 const labels={grounded:'踏地',rising:'跃起',flying:'振翼',gliding:'滑翔',falling:'缓降',swimming:'浮游',diving:'潜行',perched:'枝头歇息'};
 $('motion-label').textContent=labels[m.mode];$('motion-zone').textContent=s.zoneName;
 $('stamina-meter').hidden=!(airborne||m.stamina<.96);$('stamina-value').style.transform='scaleX('+m.stamina+')';$('stamina-meter').setAttribute('aria-label','羽力 '+Math.round(m.stamina*100)+'%');
 $('oxygen-meter').hidden=m.mode!=='diving';$('oxygen-value').style.transform='scaleX('+m.oxygen+')';$('oxygen-meter').setAttribute('aria-label','气息 '+Math.round(m.oxygen*100)+'%');$('oxygen-meter').classList.toggle('low',m.oxygen<.3);
 $('travel-instruction').textContent=m.mode==='perched'?'空格离枝 · 松开双翼，歇一会':wet?'空格上浮 · Ctrl / C 下潜':airborne?'按住空格振翼 · 松开滑翔 · Ctrl / C 缓降':'轻按空格跳跃 · 长按展翼';
 if(s.boundary){const alpha=clamp((7-s.boundary.distance)/10,0,.48);$('boundary-veil').style.opacity=alpha;const angle=Math.atan2(s.boundary.inward.x,s.boundary.inward.z)+yaw+Math.PI;$('boundary-arrow').style.transform='rotate('+angle+'rad)';$('boundary-cue').hidden=false;$('boundary-copy').textContent=s.boundary.message;}
 else{$('boundary-veil').style.opacity=0;$('boundary-cue').hidden=true;}
 if(time>feedbackUntil)$('travel-feedback').hidden=true;
}
function updateImmersion(dt){
 const water=traversal.sample(camera.position),inside=state.mode!=='title'&&water.waterLevel!==null&&camera.position.y<water.waterLevel-.06;
 immersion+=(Number(inside)-immersion)*(1-Math.exp(-dt*4));immersionPass.uniforms.uTime.value=time;immersionPass.uniforms.uImmersion.value=immersion;immersionPass.enabled=immersion>.002;
 if(inside){scene.fog.color.copy(waterColor);scene.fog.near=1.8;scene.fog.far=13;scene.background.copy(waterColor);}
}
`;
replace('function bind(){',extra+'\nfunction bind(){');
replace("if(e.code==='KeyE'&&state.nearby)inspect(state.nearby);","if(e.code==='KeyE')interact();");
replace("$('interact').onclick=()=>state.nearby&&inspect(state.nearby);","$('interact').onclick=interact;");
replace("$('touch-jump').onpointercancel=()=>keys.delete('Space');","$('touch-jump').onpointercancel=()=>keys.delete('Space');$('touch-down').onpointerdown=e=>{e.preventDefault();e.target.setPointerCapture(e.pointerId);keys.add('KeyC');};$('touch-down').onpointerup=$('touch-down').onpointercancel=()=>keys.delete('KeyC');");
replace("await forest.ready;position.copy(forest.sample(0));","await forest.ready;traversal=createTraversalWorld(scene,forest);position.copy(forest.sample(0));motion=createLocomotion({world:traversal,position,onEvent:onMotionEvent});traversalFX=createTraversalEffects(scene);");
replace('composer.addPass(bloom);composer.addPass(new OutputPass());','composer.addPass(bloom);immersionPass=new ShaderPass(immersionShader);immersionPass.enabled=false;composer.addPass(immersionPass);composer.addPass(new OutputPass());');
replace('mode:state.mode,position:position.toArray(),distance:state.distance','mode:state.mode,position:position.toArray(),motion:motion.getSnapshot(),immersion,camera:camera.position.toArray(),places:traversal.landmarks.map(l=>({...l,position:l.position.toArray()})),perches:traversal.perches.map(p=>({...p,position:p.position.toArray()})),distance:state.distance');
replace('position.copy(forest.sample(clamp(distance,0,forest.length)));state.distance=distance;','position.copy(forest.sample(clamp(distance,0,forest.length)));position.y=traversal.sample(position).groundHeight;motion.reset(position);state.distance=distance;');
replace('position.fromArray(array);position.copy(forest.constrain(position));snapCamera();','position.fromArray(array);motion.reset(position);forest.update(0,time,position);snapCamera();');
await fs.writeFile(file,s);

let h=await fs.readFile('index.html','utf8');
h=h.replace('<div id="grading"','<div id="boundary-veil" aria-hidden="true"></div><div id="travel-fade" aria-hidden="true"></div><div id="grading"');
h=h.replace('<div id="hud" hidden>','<div id="hud" hidden><div id="travel-status"><div class="travel-heading"><span id="motion-label">踏地</span><span id="motion-zone">根林初醒</span></div><p id="travel-instruction">轻按空格跳跃 · 长按展翼</p><div id="stamina-meter" class="travel-meter" hidden role="meter" aria-label="羽力"><span>羽力</span><i><b id="stamina-value"></b></i></div><div id="oxygen-meter" class="travel-meter" hidden role="meter" aria-label="气息"><span>气息</span><i><b id="oxygen-value"></b></i></div></div><div id="travel-feedback" hidden role="status"><span class="feedback-mark">◇</span><p id="travel-feedback-text"></p></div><div id="boundary-cue" hidden><span id="boundary-arrow">↑</span><p id="boundary-copy"></p></div>');
h=h.replace('短跃滑翔</span>','跳跃 / 振翼</span>').replace('aria-label="短跃滑翔"','aria-label="跳跃、长按振翼或上浮"');
h=h.replace('<button id="touch-jump"','<button id="touch-down" aria-label="下降或下潜">↓</button><button id="touch-jump"');
h=h.replace('自由探索<span>·</span>循声寻路','林间行走<span>·</span>借风飞行');
await fs.writeFile('index.html',h);

let j=await fs.readFile('src/v2/journey.js','utf8');
j=j.replace('settings:typeof data.settings',"travel:validTravel(data.travel),settings:typeof data.settings");
j=j.replace('lights:state.lights||[],settings:state.settings','lights:state.lights||[],travel:validTravel(state.travel),settings:state.settings');
j+='\nfunction validTravel(value){if(!value||!Array.isArray(value.safePosition)||value.safePosition.length!==3||!value.safePosition.every(n=>Number.isFinite(n)&&Math.abs(n)<10000))return null;return {safePosition:value.safePosition.slice(),safePerchId:typeof value.safePerchId===\'string\'?value.safePerchId:null};}\n';
await fs.writeFile('src/v2/journey.js',j);
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));pkg.version='3.0.0';pkg.scripts.test=pkg.scripts['test:unit']='node --test scripts/journey.test.js scripts/locomotion.test.js';pkg.scripts['test:v3']='node scripts/smoke-v3.cjs';await fs.writeFile('package.json',JSON.stringify(pkg,null,2)+'\n');
console.log('Integrated v3 movement, water camera, effects, audio, save and UI.');

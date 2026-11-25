import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWorld, createRelic } from './world.js';
import { Soundscape } from './audio.js';
import { relics, relicIcon } from './data.js';
import './style.css';

const $ = id => document.getElementById(id);
const STORE = 'jinsha-sun-v1';
let saved;
try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { saved = null; }
const validIds = new Set(relics.map(r => r.id));
const state = { mode:'title', collected:new Set((saved?.collected||[]).filter(id=>validIds.has(id))), completed:!!saved?.completed, muted:saved?.muted??false, voice:false, quality:'high', reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, guiding:null };
const sound = new Soundscape({muted:state.muted});
const keys = new Set();
let modalKind=null, previousFocus=null, nearby=null, toastTimer, subtitleTimer, preview=null, drag=null;
let yaw=0, pitch=.12, elapsed=0, lastSave=0, gameTime=0;
const playerPos = new THREE.Vector3(0,4,23), velocity = new THREE.Vector3();
let renderer;
try {
 renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
} catch {
 $('loading').innerHTML='<p>此浏览器暂时无法开启 3D 场景</p><span>请开启浏览器硬件加速，或在新版 Edge / Chrome 中重试。</span>';
 throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.info.autoReset=false;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
$('scene').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#102b30');
scene.fog = new THREE.FogExp2('#173639',.014);
const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.1,400);
camera.position.set(32,17,40);
camera.lookAt(0,6,0);
const pmrem=new THREE.PMREMGenerator(renderer), environment=new RoomEnvironment();
scene.environment=pmrem.fromScene(environment,.04).texture;
scene.environmentIntensity=.46;
environment.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight('#a7d7d4','#29231c',1.0));
const sunLight=new THREE.DirectionalLight('#ffdaa0',2.8);
sunLight.position.set(-24,42,5);sunLight.castShadow=true;
sunLight.shadow.mapSize.set(2048,2048);
Object.assign(sunLight.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:130});
sunLight.shadow.normalBias=.08; sunLight.shadow.bias=-.00015;
scene.add(sunLight);
const rim=new THREE.DirectionalLight('#78c1c8',1.0);rim.position.set(25,15,-45);scene.add(rim);
const skyGeo=new THREE.SphereGeometry(190,32,24);
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uTime:{value:0}},vertexShader:'varying vec3 vPos; void main(){vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vPos;uniform float uTime;void main(){vec3 d=normalize(vPos);float h=smoothstep(-.12,.75,d.y);vec3 col=mix(vec3(.035,.10,.105),vec3(.006,.023,.038),h);float s=pow(max(dot(d,normalize(vec3(-.48,.43,-.7))),0.),80.);col+=vec3(.32,.19,.06)*s;float clouds=sin(d.x*14.+d.z*6.)*sin(d.z*15.-d.y*8.)*.004;col+=clouds;gl_FragColor=vec4(col,1.);}`});
scene.add(new THREE.Mesh(skyGeo,skyMat));
const waterMat=new THREE.ShaderMaterial({transparent:true,uniforms:{uTime:{value:0}},vertexShader:'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vPos;uniform float uTime;void main(){float n=sin(vPos.x*.13+uTime*.1)*sin(vPos.y*.12+uTime*.12);float r=pow(abs(sin(vPos.x*.28+vPos.y*.41+n*2.)),22.);vec3 c=vec3(.012,.039,.043)+r*vec3(.002,.004,.003);gl_FragColor=vec4(c,.8*(1.-smoothstep(70.,180.,length(vPos.xy))));}`});
const water=new THREE.Mesh(new THREE.PlaneGeometry(400,400),waterMat);water.rotation.x=-Math.PI/2;water.position.y=-13;scene.add(water);
const world=createWorld(scene);
// Simple collision proxies keep the camera out of the entrance and tree.
const collisionMeshes=[], playerObstacles=[];
const collisionMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
function collider(x,y,z,w,h,d){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),collisionMaterial);mesh.position.set(x,y,z);mesh.updateMatrixWorld();collisionMeshes.push(mesh);playerObstacles.push({x,z,rx:w/2+.38,rz:d/2+.38,minY:y-h/2-.3,maxY:y+h/2+.3});}
collider(-10,6,-1,2.8,12,2.8);
collider(-4,1.8,14,1.5,3.6,1.7);collider(4,1.8,14,1.5,3.6,1.7);
for(let i=0;i<12;i++){const a=(i+.5)/12*Math.PI;collider(Math.cos(a)*4,3.5+Math.sin(a)*4,14,1.1,1.1,1.5);}
collider(21.7,3.2,-26,2.3,4.4,2.3);collider(30.3,3.2,-26,2.3,4.4,2.3);collider(26,5.8,-26,10.9,1.1,2.5);
const cameraRay=new THREE.Raycaster(), cameraOrigin=new THREE.Vector3(), cameraDirection=new THREE.Vector3();
function clearCameraPosition(position){cameraOrigin.copy(playerPos).y+=.7;cameraDirection.copy(position).sub(cameraOrigin);const length=cameraDirection.length();cameraRay.set(cameraOrigin,cameraDirection.normalize());cameraRay.far=length;const hit=cameraRay.intersectObjects(collisionMeshes,false)[0];if(hit)position.copy(cameraOrigin).addScaledVector(cameraDirection,Math.max(.65,hit.distance-.3));}
function resolveObstacles(){for(const o of playerObstacles){if(playerPos.y<o.minY||playerPos.y>o.maxY)continue;const dx=playerPos.x-o.x,dz=playerPos.z-o.z;if(Math.abs(dx)<o.rx&&Math.abs(dz)<o.rz){if(o.rx-Math.abs(dx)<o.rz-Math.abs(dz))playerPos.x=o.x+Math.sign(dx||1)*o.rx;else playerPos.z=o.z+Math.sign(dz||1)*o.rz;}}}
// Distant hanging haze layers create depth between the islands.
const mistCanvas=document.createElement('canvas');mistCanvas.width=128;mistCanvas.height=128;
const mctx=mistCanvas.getContext('2d'), gradient=mctx.createRadialGradient(64,64,2,64,64,64);
gradient.addColorStop(0,'rgba(161,203,183,.32)');gradient.addColorStop(1,'rgba(161,203,183,0)');mctx.fillStyle=gradient;mctx.fillRect(0,0,128,128);
const mistTex=new THREE.CanvasTexture(mistCanvas), mists=[];
for(let i=0;i<15;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:mistTex,transparent:true,opacity:.26,depthWrite:false}));s.position.set(Math.sin(i*2.4)*50,-3+(i%4)*1.4,-i*7+30);s.scale.set(38,8,1);scene.add(s);mists.push(s);}
const rayGeo=new THREE.PlaneGeometry(8,60), rayMat=new THREE.MeshBasicMaterial({color:'#e9d5a0',transparent:true,opacity:.018,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
for(let i=0;i<6;i++){const ray=new THREE.Mesh(rayGeo,rayMat);ray.position.set(-25+i*8,23,-20-i*4);ray.rotation.z=-.55;scene.add(ray);}
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.24,.55,1.15);composer.addPass(bloom);composer.addPass(new OutputPass());

// A small guiding spirit, inspired by the reference video's central flying avatar.
const spirit=new THREE.Group();
const glowMat=new THREE.MeshStandardMaterial({color:'#fff5d6',emissive:'#ffe7aa',emissiveIntensity:.45,roughness:.35});
const body=new THREE.Mesh(new THREE.SphereGeometry(.25,24,20),glowMat);body.scale.set(.78,1.15,.78);body.position.y=.18;spirit.add(body);
const tail=new THREE.Mesh(new THREE.ConeGeometry(.21,.6,20),glowMat);tail.rotation.z=Math.PI;tail.position.y=-.15;spirit.add(tail);
const head=new THREE.Mesh(new THREE.SphereGeometry(.15,20,16),glowMat);head.position.y=.53;spirit.add(head);
const crest=new THREE.Mesh(new THREE.ConeGeometry(.07,.27,12),glowMat);crest.position.set(.04,.76,0);crest.rotation.z=-.35;spirit.add(crest);
const wingGeo=new THREE.SphereGeometry(.24,16,12), wings=[];
for(const side of [-1,1]){const w=new THREE.Mesh(wingGeo,glowMat);w.scale.set(1.65,.15,.6);w.position.set(side*.3,.18,.03);spirit.add(w);wings.push(w);}
const halo=new THREE.Mesh(new THREE.TorusGeometry(.45,.027,8,48),new THREE.MeshStandardMaterial({color:'#cf9d42',metalness:.85,roughness:.3,emissive:'#c89426',emissiveIntensity:.3}));halo.rotation.x=-Math.PI/2;halo.position.y=-.35;spirit.add(halo);
const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:mistTex,color:'#ffd586',transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.scale.set(1.7,1.7,1);spirit.add(sprite);
const spiritLight=new THREE.PointLight('#ffe3a2',.45,5);spiritLight.position.set(0,-.8,.15);spirit.add(spiritLight);scene.add(spirit);spirit.visible=false;
const trailPositions=new Float32Array(65*3), trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPositions,3));
const trail=new THREE.Points(trailGeo,new THREE.PointsMaterial({color:'#ffe2a0',size:.07,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(trail);trail.visible=false;
const waypoints = new Map();
for(const relic of relics){const node=document.createElement('div');node.className='waypoint';node.innerHTML=`<i></i><span>${relic.name}</span><small></small>`;$('waypoints').appendChild(node);waypoints.set(relic.id,node);}

function save(){try{localStorage.setItem(STORE,JSON.stringify({collected:[...state.collected],completed:state.completed,position:playerPos.toArray(),yaw,muted:state.muted}));}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function subtitle(text,duration=6500){$('subtitle').textContent=text;$('subtitle').style.opacity='1';clearTimeout(subtitleTimer);subtitleTimer=setTimeout(()=>$('subtitle').style.opacity='0',duration);if(state.voice)sound.speak(text);}
function updateProgress(){
 $('seal-progress').innerHTML=relics.filter(r=>r.id!=='sun').map(r=>`<span class="seal ${state.collected.has(r.id)?'found':''}" title="${r.name}">${relicIcon(r.id)}</span>`).join('');
 $('journal-count').textContent=`${state.collected.size}/5`;
 const n=[...state.collected].filter(x=>x!=='sun').length;
 $('objective').textContent=state.completed?'记忆已苏醒，自由探索这片秘境':n===4?'回到日轮之下，唤醒太阳神鸟':`寻回四段记忆 · 已发现 ${n} / 4`;
 $('chapter').textContent=state.completed?'终章 · 日轮复苏':n===4?'终章 · 寻回太阳':`第${['一','二','三','四'][Math.min(n,3)]}章 · ${['万物有灵','方圆之间','金面无言','长夜守望'][Math.min(n,3)]}`;
 for(const [id,node] of waypoints)node.classList.toggle('found',state.collected.has(id));
 world.setAwakened(state.completed);
}
function updateSoundButton(){const on=sound.started&&!state.muted;$('sound-btn').setAttribute('aria-label',on?'静音':'开启声音');$('sound-btn').setAttribute('aria-pressed',String(on));document.querySelector('.sound-bars').classList.toggle('playing',on);}
async function enableSound(){await sound.start();sound.setMuted(state.muted);updateSoundButton();}
$('sound-btn').onclick=async()=>{if(!sound.started){state.muted=false;await enableSound();}else{state.muted=!state.muted;sound.setMuted(state.muted);updateSoundButton();}save();};
function begin(resume=false){
 if(!resume){state.collected.clear();state.completed=false;playerPos.set(0,4,23);yaw=0;}else if(Array.isArray(saved?.position)&&saved.position.length===3&&saved.position.every(Number.isFinite)){playerPos.fromArray(saved.position);playerPos.clamp(new THREE.Vector3(-65,2,-80),new THREE.Vector3(65,30,40));yaw=Number.isFinite(saved.yaw)?saved.yaw:0;}
 closeModal();state.mode='playing';gameTime=0;state.guiding=null;velocity.set(0,0,0);spirit.visible=true;trail.visible=true;
 for(let i=0;i<65;i++)playerPos.toArray(trailPositions,i*3);
 $('title-screen').classList.add('hidden');$('hud').classList.remove('hidden');$('ending').classList.add('hidden');document.querySelector('.edition').textContent='古蜀记忆 · 自由探索';
 updateProgress();enableSound();save();subtitle(resume?'微光仍在，旅程继续。':'你是一缕被唤醒的微光。循着古木，寻找四段失落的记忆。',8500);
}
$('start-btn').onclick=()=>{if(state.collected.size){openModal('restart',`<p class="eyebrow">重新启程</p><h2>重写这段旅程？</h2><p>已有的 ${state.collected.size} 件文物记录会被清空。也可以继续当前探索。</p><div class="menu-buttons"><button class="primary-button" id="confirm-restart">重新启程</button><button class="text-button" id="cancel-restart">保留进度</button></div>`);$('confirm-restart').onclick=()=>begin(false);$('cancel-restart').onclick=closeModal;}else begin(false);};
$('continue-btn').onclick=()=>begin(true);
if(state.collected.size||saved?.position)$('continue-btn').classList.remove('hidden');
document.querySelector('.brand').onclick=e=>{e.preventDefault();if(state.mode!=='title')openPause();};
function openModal(kind,html){previousFocus=document.activeElement;disposePreview();modalKind=kind;keys.clear();state.guiding=null;$('guide-status').classList.add('hidden');$('modal').innerHTML=`<button class="close-modal" aria-label="关闭">×</button>${html}`;$('modal-backdrop').classList.remove('hidden');$('modal').querySelector('.close-modal').onclick=closeModal;$('modal').querySelector('.close-modal').focus();}
function closeModal(){disposePreview();modalKind=null;$('modal-backdrop').classList.add('hidden');sound.stopVoice();keys.clear();previousFocus?.focus?.();}
$('modal-backdrop').addEventListener('click',e=>{if(e.target===$('modal-backdrop'))closeModal();});
function disposePreview(){if(!preview)return;preview.scene.traverse(o=>{if(o.isMesh)o.geometry.dispose();});preview.renderer.dispose();preview.renderer.forceContextLoss();preview=null;}
function showPreview(id){
 const host=$('relic-preview');if(!host)return;
 const pr=new THREE.WebGLRenderer({antialias:true,alpha:true});pr.setPixelRatio(Math.min(devicePixelRatio,1.5));pr.setSize(host.clientWidth,host.clientHeight);pr.toneMapping=THREE.ACESFilmicToneMapping;pr.toneMappingExposure=1.3;host.prepend(pr.domElement);
 const ps=new THREE.Scene();ps.environment=scene.environment;ps.environmentIntensity=1.2;ps.add(new THREE.HemisphereLight('#ecf7eb','#24352f',3));const pl=new THREE.DirectionalLight('#ffe4b1',4);pl.position.set(3,4,5);ps.add(pl);const blue=new THREE.DirectionalLight('#8abcc2',3);blue.position.set(-3,1,-2);ps.add(blue);
 const model=createRelic(id,1);ps.add(model);const box=new THREE.Box3().setFromObject(model);const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());model.position.sub(center);const scale=3/Math.max(size.x,size.y,size.z);model.scale.multiplyScalar(scale);model.position.multiplyScalar(scale);
 const pivot=new THREE.Group();ps.remove(model);pivot.add(model);ps.add(pivot);const pc=new THREE.PerspectiveCamera(40,host.clientWidth/host.clientHeight,.1,100);pc.position.set(0,.35,6);pc.lookAt(0,0,0);
 preview={renderer:pr,scene:ps,camera:pc,pivot,dragging:false};let px=0;
 pr.domElement.onpointerdown=e=>{preview.dragging=true;px=e.clientX;pr.domElement.setPointerCapture(e.pointerId);};pr.domElement.onpointermove=e=>{if(preview?.dragging){preview.pivot.rotation.y+=(e.clientX-px)*.012;px=e.clientX;}};pr.domElement.onpointerup=()=>{if(preview)preview.dragging=false;};
}
function showRelic(id){
 const r=relics.find(x=>x.id===id),found=state.collected.has(id);const ready=[...state.collected].filter(x=>x!=='sun').length===4;
 openModal('relic',`<div class="relic-layout"><div class="relic-view" id="relic-preview"><span>拖动旋转 · 艺术化三维模型</span></div><div class="relic-copy"><p class="eyebrow">${found?'记忆图鉴':'发现 · '+r.role}</p><h2>${r.name}</h2><div class="hero-english">${r.english}</div><span class="relic-tag">${r.era}</span><p>${r.detail}</p><p class="fact">${r.fact}</p><button id="record-btn" class="primary-button">${id==='sun'&&!found?(ready?'开启日轮谜题':'继续寻找四段记忆'):found?'返回秘境':'收录记忆'} <span>→</span></button><a class="source-link" href="${r.source}" target="_blank" rel="noopener noreferrer">查阅馆藏资料 ↗</a></div></div>`);
 showPreview(id);if(state.voice)sound.speak(r.detail);
 $('record-btn').onclick=()=>{if(id==='sun'&&!found){if(ready)openPuzzle();else{closeModal();toast('还需找回铜立人、玉琮、金面具与石虎的记忆');}return;}if(!found){state.collected.add(id);sound.discover();updateProgress();save();closeModal();toast(`记忆已收录 · ${r.name}`);subtitle(r.clue);if(state.collected.size===4)setTimeout(()=>subtitle('四段记忆已经归来。回到太阳神鸟，让日轮再次流转。',8000),6500);}else closeModal();};
}
function openJournal(){openModal('journal',`<p class="eyebrow">MEMORIES OF JINSHA</p><h2>拾光 · 记忆图鉴</h2><p>在秘境中与文物相遇，让一段古蜀记忆重新被看见。</p><div class="journal-grid">${relics.map(r=>`<button class="journal-card ${state.collected.has(r.id)?'':'locked'}" data-relic="${r.id}">${relicIcon(r.id)}<span>${r.name}</span><small>${state.collected.has(r.id)?'已收录 · 点击检视':'尚未发现 · 点击引路'}</small></button>`).join('')}</div><p class="art-note">场景、尺寸与模型为艺术演绎；文物知识参考博物馆公开馆藏资料。</p>`);$('modal').querySelectorAll('[data-relic]').forEach(b=>b.onclick=()=>{const id=b.dataset.relic;if(state.collected.has(id))showRelic(id);else{closeModal();guide(id);}});}
$('journal-btn').onclick=openJournal;
function openSettings(){openModal('settings',`<p class="eyebrow">让旅程更适合你</p><h2>视听设置</h2><div class="settings-row"><span>环境音量<small>风声、低音与金属泛音</small></span><input id="volume" type="range" aria-label="环境音量" min="0" max="100" value="${Math.round(sound.volume*100)}"/></div><div class="settings-row"><span>画面质量<small>轻量模式降低分辨率与后期辉光</small></span><select id="quality" aria-label="画面质量"><option value="high" ${state.quality==='high'?'selected':''}>电影画质</option><option value="low" ${state.quality==='low'?'selected':''}>轻量流畅</option></select></div><div class="settings-row"><span>中文语音讲述<small>使用设备提供的中文语音</small></span><button id="voice-toggle" class="switch">${state.voice?'已开启':'已关闭'}</button></div><div class="settings-row"><span>减少动态效果<small>减少自动镜头与场景动态</small></span><button id="motion-toggle" class="switch">${state.reduced?'已开启':'已关闭'}</button></div><div class="menu-buttons"><button id="fullscreen" class="primary-button">${document.fullscreenElement?'退出全屏':'进入全屏'} ↗</button><button id="settings-close" class="text-button">返回旅程 →</button></div>`);$('volume').oninput=e=>{sound.setVolume(+e.target.value/100);enableSound();};$('quality').onchange=e=>{state.quality=e.target.value;renderer.setPixelRatio(Math.min(devicePixelRatio,state.quality==='low'?1:1.7));bloom.enabled=state.quality==='high';renderer.shadowMap.enabled=state.quality==='high';resize();};$('voice-toggle').onclick=()=>{state.voice=!state.voice;$('voice-toggle').textContent=state.voice?'已开启':'已关闭';if(state.voice)sound.speak('循着微光，重返金沙。');else sound.stopVoice();};$('motion-toggle').onclick=()=>{state.reduced=!state.reduced;$('motion-toggle').textContent=state.reduced?'已开启':'已关闭';};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();$('fullscreen').textContent=document.fullscreenElement?'退出全屏 ↗':'进入全屏 ↗';}catch{toast('此窗口不支持全屏，可在浏览器中打开');}};$('settings-close').onclick=closeModal;}
$('settings-btn').onclick=openSettings;
function openPause(){if(state.mode!=='playing')return;save();openModal('pause',`<p class="eyebrow">微光在此停留</p><h2>旅程暂停</h2><p>已收录 ${state.collected.size} / 5 件文物。进度已保存在此浏览器。</p><div class="menu-buttons"><button id="resume" class="primary-button">继续探索 →</button><button id="pause-settings" class="text-button">视听设置</button><button id="home" class="text-button">回到标题</button></div><p class="art-note">WASD 飞行 · 拖动环顾 · 方向键转向 · 空格上升 · Ctrl 下降 · Shift 加速<br/>E 交互 · G 循光引路 · J 图鉴 · Esc 暂停</p>`);$('resume').onclick=closeModal;$('pause-settings').onclick=openSettings;$('home').onclick=()=>{closeModal();state.mode='title';spirit.visible=false;trail.visible=false;$('hud').classList.add('hidden');$('title-screen').classList.remove('hidden');$('continue-btn').classList.remove('hidden');saved={position:playerPos.toArray(),yaw};};}
$('pause-btn').onclick=openPause;
function openAbout(){openModal('about',`<p class="eyebrow">创作与考据</p><h2>从遗址，到记忆之境</h2><p>本作参考所提供视频中的灵鸟飞行、浮岛、藤蔓石门与巨型文物意象，构建可自由探索的古蜀幻想空间。岛屿、建筑、谜题与文物比例均为艺术演绎，不是金沙遗址的考古复原；程序化模型并非文物三维扫描。</p><h3>真实文明，是想象的起点</h3><p>金沙遗址于2001年在成都发现。滨河祭祀遗存中出土的金、铜、玉、石器与象牙，是场景与故事的文化依据。每件图鉴均提供公开馆藏来源，明确事实与创作的边界。</p><div class="about-links"><a href="https://www.jinshasitemuseum.com/node/174" target="_blank" rel="noopener">金沙遗址博物馆 ↗</a><a href="https://www.shanghaimuseum.net/mu/frontend/pg/article/id/CI00159740" target="_blank" rel="noopener">十节玉琮资料 ↗</a></div><h3>交互设计参考</h3><p>借鉴 Smithsonian Voyager 的文物旋转检视、CyArk 的空间导览，以及 Discovery Tour 的无战斗文化探索。声音为原创实时合成环境音；可选旁白由设备语音服务提供。</p><div class="about-links"><a href="https://smithsonian.github.io/dpo-voyager/explorer/overview/" target="_blank" rel="noopener">Smithsonian Voyager ↗</a><a href="https://tapestry.cyark.org/content/petra" target="_blank" rel="noopener">CyArk · Petra ↗</a><a href="https://www.ubisoft.com/en-gb/game/assassins-creed/discovery-tour" target="_blank" rel="noopener">Discovery Tour ↗</a></div><p class="art-note">金沙 · 日轮之下 / ECHOES OF THE SUN<br/>一场以尊重文物为起点的想象之旅。</p>`);}
$('about-btn').onclick=openAbout;
function openPuzzle(){
 let outer=3,inner=2;
 openModal('puzzle',`<div class="puzzle-layout"><div class="puzzle-wheel"><div id="outer-ring" class="ring">${[0,1,2,3].map(i=>`<span style="transform:rotate(${i*90}deg)">⌁</span>`).join('')}</div><div id="inner-ring" class="puzzle-core"><i></i></div></div><div><p class="eyebrow">终章 · 日轮复苏</p><h2>让光重逢</h2><p>四鸟环日，十二道光芒回旋。<br/>转动两重日轮，让外环的首鸟与内环的金色标记同时回到正上方。</p><div id="puzzle-readout" class="puzzle-readout"></div><div class="puzzle-buttons"><button id="rotate-outer">外环 ↶ 30°</button><button id="rotate-inner">内环 ↶ 30°</button></div><button id="awaken" class="primary-button" disabled>唤醒日轮 <span>✦</span></button><p class="puzzle-hint">提示：两环都归于 0° 时，记忆便会相合。</p><p class="art-note">此谜题为游戏创作，文物本身不具有机械转动结构。</p></div></div>`);
 function redraw(){$('outer-ring').style.transform=`rotate(${outer*30}deg)`;$('inner-ring').style.transform=`rotate(${inner*30}deg)`;$('puzzle-readout').textContent=`外环 ${outer*30}°　 /　 内环 ${inner*30}°`;$('awaken').disabled=outer!==0||inner!==0;}
 $('rotate-outer').onclick=()=>{outer=(outer+11)%12;sound.chime(false);redraw();};$('rotate-inner').onclick=()=>{inner=(inner+11)%12;sound.chime(false);redraw();};
 $('awaken').onclick=()=>{if(outer||inner)return;state.collected.add('sun');state.completed=true;closeModal();state.mode='finale';world.setAwakened(true);sound.finale();updateProgress();save();$('hud').classList.add('hidden');$('flash').style.opacity='.75';setTimeout(()=>$('flash').style.opacity='0',700);setTimeout(()=>$('ending').classList.remove('hidden'),2200);};redraw();
}
$('return-world').onclick=()=>{state.mode='playing';$('ending').classList.add('hidden');$('hud').classList.remove('hidden');subtitle('光从未远去。继续在秘境中，聆听文明的回响。');};
function guide(id){if(state.mode!=='playing')return;const target=id||relics.find(r=>r.id!=='sun'&&!state.collected.has(r.id))?.id||'sun';state.guiding=target;$('guide-status').classList.remove('hidden');toast(`循光前往 · ${relics.find(r=>r.id===target).name}`);}
$('guide-btn').onclick=()=>guide();
function interact(){if(nearby&&!modalKind&&state.mode==='playing')showRelic(nearby.id);}
$('interact').onclick=interact;
const movementKeys=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight','ShiftLeft','ShiftRight'];
addEventListener('keydown',e=>{
 if(e.code==='Tab'&&modalKind){const focusables=[...$('modal').querySelectorAll('button:not(:disabled),a,input,select')];if(focusables.length){const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(e.code==='Escape'){e.preventDefault();if(modalKind)closeModal();else openPause();return;}
 if(modalKind||state.mode!=='playing')return;
 if(movementKeys.includes(e.code)){e.preventDefault();keys.add(e.code);if(!e.code.startsWith('Shift')){state.guiding=null;$('guide-status').classList.add('hidden');}}
 if(e.repeat)return;if(e.code==='KeyE')interact();if(e.code==='KeyJ')openJournal();if(e.code==='KeyG')guide();
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();drag=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='playing'&&!modalKind)openPause();});
renderer.domElement.addEventListener('pointerdown',e=>{if(state.mode==='playing'&&!modalKind){drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);}});
renderer.domElement.addEventListener('pointermove',e=>{if(drag&&!modalKind){yaw-=(e.clientX-drag.x)*.004;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-drag.y)*.002,-.28,.7);drag={x:e.clientX,y:e.clientY};state.guiding=null;$('guide-status').classList.add('hidden');}});
renderer.domElement.addEventListener('pointerup',()=>drag=null);renderer.domElement.addEventListener('pointercancel',()=>drag=null);renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
let joy={x:0,y:0},joyPointer=null;
const joystick=$('joystick');joystick.onpointerdown=e=>{joyPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);updateJoy(e);};
function updateJoy(e){if(joyPointer!==e.pointerId)return;const b=joystick.getBoundingClientRect();joy.x=THREE.MathUtils.clamp((e.clientX-b.left-b.width/2)/35,-1,1);joy.y=THREE.MathUtils.clamp((e.clientY-b.top-b.height/2)/35,-1,1);joystick.firstElementChild.style.transform=`translate(${joy.x*25}px,${joy.y*25}px)`;state.guiding=null;$('guide-status').classList.add('hidden');}
joystick.onpointermove=updateJoy;joystick.onpointerup=joystick.onpointercancel=()=>{joyPointer=null;joy={x:0,y:0};joystick.firstElementChild.style.transform='';};
for(const [id,key] of [['up-btn','Space'],['down-btn','ControlLeft']]){$(id).onpointerdown=e=>{keys.add(key);$(id).setPointerCapture(e.pointerId);};$(id).onpointerup=$(id).onpointercancel=()=>keys.delete(key);}

const mapCtx=$('map').getContext('2d');
function drawMap(){const c=mapCtx;c.clearRect(0,0,240,240);c.save();c.beginPath();c.arc(120,120,113,0,Math.PI*2);c.clip();c.strokeStyle='#bca76e16';c.lineWidth=1;for(let i=0;i<240;i+=30){c.beginPath();c.moveTo(i,0);c.lineTo(i,240);c.moveTo(0,i);c.lineTo(240,i);c.stroke();}const point=(x,z)=>[120+x*2.4,158+z*2.4];for(const [x,z,r]of [[0,0,36],[26,-22,23],[-26,-23,25],[0,-49,23]]){const p=point(x,z);c.fillStyle='#82a18b22';c.strokeStyle='#8ca38d55';c.beginPath();c.ellipse(p[0],p[1],r,r*.75,-.3,0,Math.PI*2);c.fill();c.stroke();}for(const r of relics){const p=point(r.position[0],r.position[2]);c.fillStyle=state.collected.has(r.id)?'#789f8e':'#dbc083';c.beginPath();c.arc(p[0],p[1],r.id==='sun'?4:2.5,0,Math.PI*2);c.fill();}const p=point(playerPos.x,playerPos.z);c.translate(...p);c.rotate(yaw);c.fillStyle='#fff3cf';c.beginPath();c.moveTo(0,-7);c.lineTo(4,5);c.lineTo(0,3);c.lineTo(-4,5);c.closePath();c.fill();c.restore();}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);if(preview){const host=$('relic-preview');preview.renderer.setSize(host.clientWidth,host.clientHeight);preview.camera.aspect=host.clientWidth/host.clientHeight;preview.camera.updateProjectionMatrix();}}
addEventListener('resize',resize);
let prev=performance.now(),frames=0,fpsTime=0,currentFPS=60;
const temp=new THREE.Vector3(),desiredCam=new THREE.Vector3(),lookAt=new THREE.Vector3(),heroTarget=new THREE.Vector3(0,5,-1);
function animate(now){
 requestAnimationFrame(animate);const dt=Math.min((now-prev)/1000,.05);prev=now;elapsed+=dt;
 frames++;fpsTime+=dt;if(fpsTime>1){currentFPS=Math.round(frames/fpsTime);fpsTime=0;frames=0;}
 const t=state.reduced?0:elapsed;
 if(!modalKind){world.update(t,dt);waterMat.uniforms.uTime.value=t;skyMat.uniforms.uTime.value=t;}
 if(state.mode==='title'){
  const angle=state.reduced?0:Math.sin(elapsed*.07)*.08;
  desiredCam.set(32+Math.sin(angle)*20,17+Math.sin(t*.13)*.5,40);camera.position.lerp(desiredCam,1-Math.exp(-dt*1.5));camera.lookAt(heroTarget);
 }else if(state.mode==='playing'){
  if(!modalKind){
   gameTime+=dt;let moving=false;
   if(state.guiding){
    const r=relics.find(r=>r.id===state.guiding);temp.fromArray(r.position).add(new THREE.Vector3(0,0,5));const distance=playerPos.distanceTo(temp);
    if(distance<.65){state.guiding=null;yaw=Math.atan2(r.position[0]-playerPos.x,playerPos.z-r.position[2]);velocity.set(0,0,0);$('guide-status').classList.add('hidden');toast('已抵达，按 E 触碰这段记忆');}
    else{const dir=temp.sub(playerPos).normalize();velocity.lerp(dir.multiplyScalar(Math.min(12,distance*2)),1-Math.exp(-dt*3));const targetYaw=Math.atan2(velocity.x,-velocity.z);yaw+=Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw))*Math.min(1,dt*2);moving=true;}
   }else{
    if(keys.has('ArrowLeft'))yaw-=dt*1.5;if(keys.has('ArrowRight'))yaw+=dt*1.5;
    const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joy.y;
    const side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joy.x;
    const height=(keys.has('Space')?1:0)-(keys.has('ControlLeft')||keys.has('ControlRight')?1:0);
    const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?15:8;
    temp.set(Math.sin(yaw)*forward+Math.cos(yaw)*side,height*.8,-Math.cos(yaw)*forward+Math.sin(yaw)*side);
    if(temp.length()>1)temp.normalize();temp.multiplyScalar(speed);velocity.lerp(temp,1-Math.exp(-dt*5));moving=temp.lengthSq()>.1;
   }
   playerPos.addScaledVector(velocity,dt);resolveObstacles();playerPos.clamp(new THREE.Vector3(-65,2,-80),new THREE.Vector3(65,30,40));
   // Keep the spirit above raised island floors while allowing flight around them.
   const islands=[[0,0,19,2],[26,-22,10,3],[-26,-23,11,4],[0,-49,12,6]];
   for(const [x,z,r,h]of islands)if(Math.hypot(playerPos.x-x,playerPos.z-z)<r)playerPos.y=Math.max(playerPos.y,h);
   spirit.position.copy(playerPos);spirit.position.y+=Math.sin(t*2.8)*.14;spirit.rotation.y=yaw;spirit.rotation.z=THREE.MathUtils.lerp(spirit.rotation.z,-velocity.x*.015,dt*4);
   wings[0].rotation.z=Math.sin(t*5)*.22;wings[1].rotation.z=-Math.sin(t*5)*.22;halo.rotation.z=t*.5;
   for(let i=64;i>0;i--){for(let j=0;j<3;j++)trailPositions[i*3+j]=trailPositions[(i-1)*3+j];}spirit.position.toArray(trailPositions,0);trailGeo.attributes.position.needsUpdate=true;
   if(moving&&Math.floor(elapsed*2)!==Math.floor((elapsed-dt)*2))sound.footstep();
   const region=playerPos.z< -35?'象牙之境':playerPos.x>13?'方圆之境':playerPos.x< -13?'金面之境':'古木之境';$('region').textContent=region;
   const directions=['北','东北','东','东南','南','西南','西','西北'];$('compass-heading').textContent=directions[((Math.round(yaw/(Math.PI/4))%8)+8)%8];
   let nearest=null,nearestDistance=7.7;for(const r of relics){const d=playerPos.distanceTo(new THREE.Vector3(...r.position));if(d<nearestDistance){nearest=r;nearestDistance=d;}}nearby=nearest;
   $('interact').classList.toggle('hidden',!nearby);if(nearby)$('interact-name').textContent=nearby.name;
   if(elapsed-lastSave>4){save();lastSave=elapsed;}
  }
  const distance=innerWidth<700?8.7:7.2;
  desiredCam.copy(playerPos).add(new THREE.Vector3(-Math.sin(yaw)*distance,3.2+pitch*7,Math.cos(yaw)*distance));
  clearCameraPosition(desiredCam);
  camera.position.lerp(desiredCam,1-Math.exp(-dt*(state.reduced?10:3)));
  clearCameraPosition(camera.position);
  lookAt.copy(playerPos).add(new THREE.Vector3(Math.sin(yaw)*3,.7-pitch*3,-Math.cos(yaw)*3));camera.lookAt(lookAt);
  for(const r of relics){temp.fromArray(r.position);temp.y+=2.3;const dist=temp.distanceTo(playerPos),node=waypoints.get(r.id);temp.project(camera);const visible=temp.z<1&&temp.z>0&&Math.abs(temp.x)<.9&&Math.abs(temp.y)<.8&&dist>8;node.style.display=visible?'block':'none';if(visible){node.style.left=`${(temp.x*.5+.5)*innerWidth}px`;node.style.top=`${(-temp.y*.5+.5)*innerHeight}px`;node.querySelector('small').textContent=`${Math.round(dist)} m`;}}
  drawMap();
 }else if(state.mode==='finale'){
  desiredCam.set(24,15,22);camera.position.lerp(desiredCam,1-Math.exp(-dt*.4));camera.lookAt(2,9,-7);
 }
 if(preview){if(!preview.dragging&&!state.reduced)preview.pivot.rotation.y+=dt*.25;preview.renderer.render(preview.scene,preview.camera);}
 renderer.info.reset();composer.render();
}
updateProgress();resize();requestAnimationFrame(animate);
setTimeout(()=>{$('loading').style.opacity='0';setTimeout(()=>$('loading').classList.add('hidden'),800);},500);
// Read-only telemetry for local verification and performance inspection.
window.__JINSHA__={snapshot:()=>({mode:state.mode,collected:[...state.collected],completed:state.completed,position:playerPos.toArray(),guiding:state.guiding,nearby:nearby?.id,modal:modalKind,fps:currentFPS,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),renderer};

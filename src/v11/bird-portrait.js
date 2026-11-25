import './bird-portrait.css';
import * as T from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {createCharacter} from '../v2/character.js';
import {applyRiverPlumage} from '../v10/river-plumage.js';
import {applyCollectionLook} from './collection-look.js';
import {forms} from './collection-data.js';

const poses={
  stand:{label:'停立',mode:'grounded',lift:0,observation:'看它收拢双翼，胸羽随呼吸起伏。转到侧面，喙尖的弧线与额前绒羽就会分开。'},
  wing:{label:'展翼',mode:'flying',lift:.28,observation:'展开双翼时，外侧长飞羽依次分开。顺着翼根转向翼尖，可以看见羽装的颜色和轮廓。'},
  skim:{label:'掠水',mode:'gliding',lift:.15,observation:'掠过水面时，烁羽收起脚，放平双翼。尾羽在轻微侧倾中调整方向，羽尖的倒影掠过水纹。'}
};
const cameraHome=.84;
const diagramSource='https://artsandculture.google.com/asset/bronze-bird/7QH-c8Zpgsixjg?hl=zh-cn';
const waterMirror={
  ...Reflector.ReflectorShader,
  name:'PortraitWaterMirror',
  fragmentShader:`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec4 reflection=texture2DProj(tDiffuse,vUv);
      vec3 pool=mix(color*.37,reflection.rgb*color*1.8,reflection.a);
      gl_FragColor=vec4(pool,.29);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
};

export function mountBirdPortrait(host,{traits,reduced=false,signal}={}){
  if(!host||signal?.aborted)return ()=>{};
  const form=forms.find(f=>f.id===traits?.id)||forms[0],level=T.MathUtils.clamp(Math.round(Number(traits?.level)||1),1,3);
  const equipped={...form,...traits,id:form.id,level};
  const reducedMotion=reduced||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const section=document.createElement('section');section.className='bp-studio';section.setAttribute('aria-label','烁羽三维观察台');
  section.innerHTML=`<div class="bp-stage"><div class="bp-view" tabindex="0" role="group" aria-label="转动烁羽，方向键转身或改变俯仰">
    <img class="bp-poster" alt=""><div class="bp-canvas-slot"></div>
    <div class="bp-caption"><strong></strong><span></span></div>
    <p class="bp-status" role="status"></p><span class="bp-heading" aria-hidden="true"></span>
    </div><div class="bp-camera" aria-label="观察镜头">
      <button type="button" data-cmd="left" aria-label="向左转动烁羽">↶ 左转</button>
      <button type="button" data-cmd="right" aria-label="向右转动烁羽">右转 ↷</button>
      <button type="button" data-cmd="close" aria-pressed="false">近看眼喙</button>
      <button type="button" data-cmd="motion">定格</button>
    </div></div>
    <div class="bp-sheet"><div class="bp-pose-group" role="group" aria-label="姿态观察"></div>
      <p class="bp-observation" aria-live="polite"></p>
      <details class="bp-origin"><summary>从铜鸟到烁羽</summary>
        <figure><img src="/assets/v11/collections/bronze.webp" alt="鸟形铜器的教学模型"><figcaption>鸟形铜器 · 教学模型</figcaption></figure>
        <p>这件金沙铜鸟昂首，圆眼突出，双翼收拢上翘，尾羽下折。烁羽从这些轮廓取形。</p>
        <p>它的绒羽、飞行姿态、潜水能力和各阶羽装由游戏创作。你在观察台看见的，就是随你进入河岸的角色骨骼模型。</p>
        <a href="${diagramSource}" target="_blank" rel="noopener">金沙遗址博物馆 · 铜鸟藏品资料 ↗</a>
      </details>
    </div>`;
  host.append(section);
  const get=selector=>section.querySelector(selector),view=get('.bp-view'),slot=get('.bp-canvas-slot'),status=get('.bp-status');
  const poster=get('.bp-poster'),motionButton=get('[data-cmd=motion]'),closeButton=get('[data-cmd=close]'),direction=get('.bp-heading');
  get('.bp-origin').open=window.matchMedia('(min-width: 790px)').matches;
  poster.src='/assets/v11/collections/form-'+form.id+(level===3?'':'-'+level)+'.webp';
  poster.alt=form.title+'羽装第'+level+'阶的烁羽静态图版';
  get('.bp-caption strong').textContent=form.title;get('.bp-caption span').textContent='羽装 · '+['初羽','进阶','盛羽'][level-1];
  const lifetime=new AbortController();
  function on(node,event,fn,opts={}){node.addEventListener(event,fn,{...opts,signal:lifetime.signal});}
  let pose='stand',close=false,paused=!!reducedMotion,disposed=false,busy=false,phase='poster',drag=null;
  let renderer,scene,camera,character,environment,ground,pool,wakes,shadow,keyLight,head,eyeBone,irisMap,stoneMap;
  let frame=0,last=0,clock=1.1,dirty=true,yaw=cameraHome,pitch=.17,lift=0,cameraDistance=2.83,eyeFocus=0;
  const target=new T.Vector3(),eyeTarget=new T.Vector3(),lens=new T.Vector3();
  const gold=new T.Color(0xd6b87a),moss=new T.Color(0x445347);
  function refresh(){
    section.dataset.state=phase;section.dataset.pose=pose;section.dataset.form=form.id;section.dataset.level=String(level);
    section.dataset.focus=close?'eye':'body';section.dataset.paused=String(paused);
    for(const button of section.querySelectorAll('[data-pose]'))button.setAttribute('aria-pressed',String(button.dataset.pose===pose));
    const live=phase==='ready';
    get('.bp-camera').hidden=!live;
    motionButton.textContent=paused?'播放动作':'定格';motionButton.setAttribute('aria-pressed',String(paused));
    closeButton.setAttribute('aria-pressed',String(close));closeButton.textContent=close?'观看全身':'近看眼喙';
    get('.bp-observation').textContent=poses[pose].observation;
    view.setAttribute('aria-busy',String(busy));view.setAttribute('aria-label',form.title+'羽装 · '+poses[pose].label+(live?'。拖动或按方向键改变视角。':'。当前显示静态资料图版。'));
    const degrees=T.MathUtils.euclideanModulo(Math.round(T.MathUtils.radToDeg(yaw)),360);
    direction.textContent=live?(close?'眼与喙近景':'全身')+'　'+degrees+'°':'羽装图版';
  }
  function paintPoster(text,askFor3D){
    status.replaceChildren(document.createTextNode(text));status.hidden=false;
    if(askFor3D){
      const open=document.createElement('button');open.type='button';open.textContent=reducedMotion?'打开三维定格':'重试三维';
      on(open,'click',start);status.append(open);
    }
  }
  function settle(mode){
    if(!character)return;
    for(let i=0;i<30;i++)character.update(1/35,clock+i/35,movement(mode));
    clock+=30/35;lift=poses[mode].lift;
  }
  function movement(id){
    return {mode:poses[id].mode,speed:id==='stand'?0:id==='wing'?3.8:4.7,
      wingbeat:id==='wing'?.87:0,cruise:id==='wing',bank:id==='skim'?-.20:0,pitch:id==='skim'?-.08:0,
      wetness:id==='skim'?.34:0,attentionYaw:id==='stand'?.15:0,growth:{level:0}};
  }
  function choose(id){
    if(!poses[id])return;
    pose=id;dirty=true;if(paused&&character)settle(pose);
    refresh();schedule();
  }
  for(const [id,p] of Object.entries(poses)){
    const button=document.createElement('button');button.type='button';button.dataset.pose=id;button.textContent=p.label;get('.bp-pose-group').append(button);on(button,'click',()=>choose(id));
  }
  function orbit(dx,dy=0){yaw+=dx;pitch=T.MathUtils.clamp(pitch+dy,-.12,.72);dirty=true;refresh();schedule();}
  function inspectEye(){close=!close;if(close){yaw=.95;pitch=.07;}dirty=true;refresh();schedule();}
  on(get('[data-cmd=left]'),'click',()=>orbit(-Math.PI/6));on(get('[data-cmd=right]'),'click',()=>orbit(Math.PI/6));
  on(closeButton,'click',inspectEye);on(motionButton,'click',()=>{paused=!paused;last=0;dirty=true;refresh();schedule();});
  on(view,'pointerdown',e=>{if(e.button!==0||phase!=='ready'||e.target.closest('button'))return;view.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY};view.setPointerCapture(e.pointerId);});
  on(view,'pointermove',e=>{if(e.pointerId!==drag?.id)return;orbit((drag.x-e.clientX)*.012,(e.clientY-drag.y)*.005);drag.x=e.clientX;drag.y=e.clientY;});
  on(view,'lostpointercapture',()=>{drag=null;});
  on(view,'keydown',e=>{
    if(phase!=='ready'||e.target!==view||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Enter'].includes(e.key))return;
    e.stopPropagation();e.preventDefault();
    if(e.key==='Home'){yaw=cameraHome;pitch=.17;close=false;orbit(0);}
    else if(e.key==='Enter')inspectEye();else if(e.key==='ArrowUp'||e.key==='ArrowDown')orbit(0,e.key==='ArrowUp'?.09:-.09);
    else orbit(e.key==='ArrowLeft'?-.16:.16);
  });
  function softContact(){
    const tile=document.createElement('canvas');tile.width=tile.height=96;const p=tile.getContext('2d'),g=p.createRadialGradient(48,48,1,48,48,48);
    g.addColorStop(0,'rgba(5,9,8,.74)');g.addColorStop(.45,'rgba(5,9,8,.42)');g.addColorStop(1,'rgba(5,9,8,0)');p.fillStyle=g;p.fillRect(0,0,96,96);
    return new T.CanvasTexture(tile);
  }
  function makeStudio(software){
    scene=new T.Scene();camera=new T.PerspectiveCamera(30,1,.035,24);
    scene.add(new T.HemisphereLight(0xd1e1dd,0x675740,.99));
    keyLight=new T.DirectionalLight(0xffe2b5,2.36);
    keyLight.position.set(3.1,3.4,-1.8);keyLight.target.position.set(0,.48,0);
    keyLight.castShadow=true;
    const shadowSize=software?512:1024;
    keyLight.shadow.mapSize.set(shadowSize,shadowSize);
    Object.assign(keyLight.shadow.camera,{left:-1.16,right:1.16,top:1.38,bottom:-1.10,near:.1,far:8});
    keyLight.shadow.normalBias=.004;keyLight.shadow.bias=-.00055;
    scene.add(keyLight,keyLight.target);
    for(const [color,intensity,x,y,z] of [[0xa4ccde,1.57,-2.1,2.3,2],[0xe4cfad,.43,-2.5,.9,-2.8]]){
      const light=new T.DirectionalLight(color,intensity);light.position.set(x,y,z);scene.add(light);
    }
    const disk=new T.CylinderGeometry(.78,.81,.053,96);
    ground=new T.Mesh(disk,new T.MeshStandardMaterial({color:moss,roughness:.88,metalness:.09}));
    ground.position.y=-.033;ground.receiveShadow=true;scene.add(ground);
    const rim=new T.Mesh(new T.TorusGeometry(.795,.004,6,100),new T.MeshStandardMaterial({color:gold,roughness:.60,metalness:.41}));
    rim.rotation.x=Math.PI/2;rim.position.y=-.034;scene.add(rim);
    const mirrorSize=software?192:384;
    pool=new Reflector(new T.CircleGeometry(.77,72),{textureWidth:mirrorSize,textureHeight:mirrorSize,multisample:0,clipBias:.003,color:0x5e9c97,shader:waterMirror});
    pool.material.transparent=true;
    pool.rotation.x=-Math.PI/2;pool.position.y=-.001;pool.visible=false;scene.add(pool);
    const currentScene=scene;
    const loader=new T.TextureLoader();stoneMap=loader.load('/assets/environment/rock_boulder_dry_diff_1k.webp',texture=>{if(disposed||currentScene!==scene)return;ground.material.map=texture;ground.material.needsUpdate=true;dirty=true;schedule();});stoneMap.colorSpace=T.SRGBColorSpace;
    new HDRLoader().loadAsync('/assets/environment/forest-light-512.hdr').then(tex=>{
      if(disposed||scene!==currentScene){tex.dispose();return;}tex.mapping=T.EquirectangularReflectionMapping;environment=tex;scene.environment=tex;scene.environmentIntensity=.40;dirty=true;schedule();
    }).catch(()=>{});
    irisMap=softContact();shadow=new T.Mesh(new T.PlaneGeometry(1.10,.83),new T.MeshBasicMaterial({map:irisMap,transparent:true,depthWrite:false,toneMapped:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=-.003;scene.add(shadow);
    wakes=[];
    for(let i=0;i<4;i++){
      const wake=new T.Mesh(new T.TorusGeometry(.37,.007,5,60,Math.PI*1.5),new T.MeshBasicMaterial({color:0xabc4b1,transparent:true,opacity:0,depthWrite:false}));
      wake.rotation.set(-Math.PI/2,0,-.83);wake.position.y=.004;scene.add(wake);wakes.push(wake);
    }
  }
  function resize(){
    if(!renderer||!camera||!view.clientWidth||!view.clientHeight)return;
    renderer.setSize(view.clientWidth,view.clientHeight,false);camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();dirty=true;schedule();
  }
  function schedule(){if(!disposed&&phase==='ready'&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;if(disposed||!character||document.hidden)return;
    if(!section.isConnected){cleanup();return;}
    const dt=last?Math.min(.09,(now-last)/1000):1/60;last=now;
    if(!paused){
      clock+=dt;character.update(dt,clock,movement(pose));lift=T.MathUtils.damp(lift,poses[pose].lift,4.2,dt);
    }
    if(paused&&close){
      const lids=character.group.getObjectByName('Eyelids');
      // End a captured blink on its own opening motion before freezing the iris detail.
      for(let i=0;i<40&&(lids?.morphTargetInfluences?.[0]??0)>.015;i++){
        clock+=1/60;character.update(1/60,clock,movement(pose));
      }
      renderer.domElement.dataset.lidClosure=String(lids?.morphTargetInfluences?.[0]??0);
    }
    if(dirty)renderer.domElement.dataset.motion=character.group.userData.motion.mode;
    const wing=pose==='wing',skim=pose==='skim';
    character.group.position.y=lift+(paused?0:wing?Math.sin(clock*4.8)*.027:skim?Math.sin(clock*2.2)*.012:0);
    if(shadow){shadow.scale.setScalar(1+lift*.46);shadow.material.opacity=.73-lift*.65;}
    pool.visible=skim;
    ground.material.color.setHex(skim?0x447274:0x758070);ground.material.roughness=skim?.34:.87;
    for(const [i,wake] of wakes.entries()){
      const f=((clock*.44+i*.25)%1);wake.visible=skim;wake.scale.set(.45+f*1.17,.25+f*.78,1);
      wake.position.set(Math.sin(clock*.66)*.03,.007,.02+f*.42);wake.material.opacity=.26*Math.sin(Math.PI*f);
    }
    character.group.updateMatrixWorld(true);
    const fit=Math.max(1,1.11/camera.aspect);
    const desiredDistance=(close?1.08:wing||skim?3.32:2.80)*fit;
    const approach=paused||dirty?1:1-Math.exp(-dt*6.8);
    cameraDistance=T.MathUtils.lerp(cameraDistance,desiredDistance,approach);eyeFocus=T.MathUtils.lerp(eyeFocus,close?1:0,approach);
    target.set(0,character.group.position.y+.62,.035);
    if(eyeBone||head){(eyeBone||head).getWorldPosition(eyeTarget);eyeTarget.z-=.030;target.lerp(eyeTarget,eyeFocus);}
    lens.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(cameraDistance);
    camera.position.copy(target).add(lens);camera.lookAt(target);renderer.render(scene,camera);dirty=false;
    if(!paused)schedule();
  }
  function release(){
    cancelAnimationFrame(frame);frame=0;last=0;character?.dispose();character=null;
    if(pool){pool.removeFromParent();pool.geometry.dispose();pool.dispose();pool=null;}
    keyLight?.shadow.dispose();keyLight=null;
    if(scene){const assets=new Set();scene.traverse(node=>{if(node.geometry)assets.add(node.geometry);for(const m of [].concat(node.material||[]))assets.add(m);});assets.forEach(a=>a.dispose?.());}
    irisMap?.dispose();stoneMap?.dispose();environment?.dispose();irisMap=stoneMap=environment=null;
    scene=camera=ground=head=eyeBone=null;
    if(renderer){const instance=renderer;renderer=null;instance.dispose();instance.forceContextLoss();instance.domElement.remove();}
    wakes=[];slot.replaceChildren();
  }
  const observer=new ResizeObserver(resize);observer.observe(view);
  on(document,'visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;last=0;if(!document.hidden){dirty=true;schedule();}});
  async function start(){
    if(busy||disposed||phase==='ready')return;
    busy=true;phase='loading';refresh();paintPoster('正在展开骨骼与羽片…',false);
    try{
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');slot.append(canvas);
      const gl=canvas.getContext('webgl2',{antialias:true,alpha:true,powerPreference:'high-performance'});
      if(!gl)throw Error('webgl2 unavailable');
      renderer=new T.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true});
      const ext=gl.getExtension('WEBGL_debug_renderer_info'),soft=ext&&/swiftshader|llvmpipe|software rasterizer|basic render/i.test(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,soft?1:1.6));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
      on(canvas,'webglcontextlost',e=>{e.preventDefault();if(disposed||phase!=='ready'||canvas!==renderer?.domElement)return;phase='poster';release();busy=false;refresh();paintPoster('三维画面已暂停，可继续查看羽装图版。',true);});
      makeStudio(soft);resize();
      const rig=await createCharacter({lod:soft||view.clientWidth<360?1:0,plumage:applyRiverPlumage});
      if(disposed){rig.dispose();return;}character=rig;scene.add(rig.group);
      head=rig.group.getObjectByName('Head');eyeBone=rig.group.getObjectByName('EyeR');
      settle(pose);applyCollectionLook(rig,equipped);
      canvas.dataset.feathers=rig.group.userData.motion.featherRig;
      canvas.dataset.equipped=rig.group.userData.collectionForm.id+'-'+rig.group.userData.collectionForm.level;
      if(gl.isContextLost())throw Error('webgl context lost');
      phase='ready';busy=false;status.hidden=true;refresh();dirty=true;resize();
    }catch{
      if(disposed)return;phase='poster';release();busy=false;refresh();
      paintPoster('当前为羽装静态图版。仍可查阅三种动作及其来历。',true);
    }
  }
  function cleanup(){
    if(disposed)return;disposed=true;lifetime.abort();signal?.removeEventListener('abort',cleanup);
    observer.disconnect();release();section.remove();
  }
  signal?.addEventListener('abort',cleanup,{once:true});
  refresh();
  if(reducedMotion){paintPoster('减少动态已开启。可按需查看定格的骨骼与羽片。',true);}
  else start();
  return cleanup;
}

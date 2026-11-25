import * as T from 'three';
import { V, fieldStudio, seeded, mesh, rod, mat, joinFixedProps, useVertexLighting } from './fieldwork-studio.js';
import {createCharacter} from '../v2/character.js';
import {applyRiverPlumage} from './river-plumage.js';
import {forms} from '../v11/collection-data.js';
import {applyCollectionLook} from '../v11/collection-look.js';
import {makeRiverEddy} from './fieldwork-eddy.js';
import {driftTransit} from './fieldwork-drift.js';

const center = s => 1.22*Math.sin(s*.18)-.52*Math.cos(s*.33);
const breadth = s => 3.6+.44*Math.sin(s*.19+.3);
const bank = (s,side) => center(s)+side*breadth(s);
const riverHeight=(x,s)=>{
  const side=x>center(s)?1:-1,edge=side*(x-bank(s,side));
  return edge*.43 + .13*Math.sin(s*.63+x*.81)+.10*Math.cos(s*.91-x*.33);
};
const stopA={s:14,x:bank(14,-1)+.9};
const stopB={s:29,x:bank(29,1)-.95};
const bars=[{s:7.7,x:center(7.7)+1.25,rx:1.7,rz:1.6},{s:21.6,x:center(21.6)-1.5,rx:1.35,rz:1.45}];
export function buildBanks(studio){
  const {scene,texture}=studio,rand=seeded(314);
  const ground=texture('/assets/v5/ground/aerial_grass_rock_diff_1k.webp');
  const surface=mat(0xffffff,.94,{map:ground,vertexColors:true});
  const sandColor=new T.Color(0xdabe97),bankColor=new T.Color(0x71815f),color=new T.Color();
  for(const side of [-1,1]){
    const vertices=[],indices=[],colors=[],uv=[];
    for(let j=0;j<=180;j++){const s=-10+j*.36;
      for(let i=0;i<=16;i++){
        const outward=-1.1+i*.9,x=bank(s,side)+side*outward,h=riverHeight(x,s);
        vertices.push(x,h,-s);uv.push(x*.11,-s*.11);
        color.copy(sandColor).lerp(bankColor,T.MathUtils.smoothstep(outward,.55,3.1));color.multiplyScalar(.83+.12*Math.sin(x*.9+s*.61)+rand()*.09);colors.push(color.r,color.g,color.b);
        if(i<16&&j<180){const a=j*17+i;if(side===1)indices.push(a,a+1,a+18,a,a+18,a+17);else indices.push(a,a+18,a+1,a,a+17,a+18);}
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();mesh(scene,geo,surface);
  }
  for(const b of bars){
    const shoal=new T.SphereGeometry(1,36,14),vertices=shoal.attributes.position;
    for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),noise=1+.13*Math.sin(z*9+x*4)+.09*Math.cos(x*8-z*4);
      vertices.setXYZ(i,x*noise+.14*Math.sin(z*3),y*(1+.17*Math.sin(x*5+z*5)),z*noise);}
    shoal.computeVertexNormals();
    const dune=mesh(scene,shoal,mat(0xbeb9a0,.98,{map:ground}),V(b.x,-.16,-b.s));dune.scale.set(b.rx,.28,b.rz);
  }
  const dummy=new T.Object3D(),reeds=[],leaves=[],plumes=[],pebbles=[];
  function batch(geometry,material,list){
    const inst=new T.InstancedMesh(geometry,material,list.length);list.forEach(([x,y,z,rx,ry,rz,sx,sy,sz,tint],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);inst.setColorAt(i,new T.Color(tint));});scene.add(inst);return inst;
  }
  for(let i=0;i<(studio.software?96:180);i++){
    const s=rand()*48-5,side=rand()>.5?1:-1,cx=bank(s,side)+side*rand()*1.7,cz=-s;
    for(let k=0;k<7;k++){const x=cx+(rand()-.5)*.7,z=cz+(rand()-.5)*.7,h=Math.max(-.02,riverHeight(x,-z)),size=.45+rand()*.85,lean=(rand()-.5)*.32;
      reeds.push([x,h+size*.5,z,0,0,lean,1,size,1,rand()>.5?0x968553:0x87945e]);
      leaves.push([x-.055,h+size*.42,z,.2,rand()*6,.55,1,size*.65,1,0x778952]);
      if(k%3===0)plumes.push([x-Math.sin(lean)*size*.47,h+size*.96,z,0,0,lean,1,size*.3,1,0xc7ac7c]);
    }
  }
  for(let i=0;i<(studio.software?300:640);i++){
    const s=rand()*52-6,side=rand()>.5?1:-1,x=bank(s,side)+side*(rand()*2-.66),h=riverHeight(x,s),size=rand()*.25+.04;
    pebbles.push([x,h,-s,rand(),rand()*6,0,size,size*.53,size*.73,rand()>.5?0x9a9781:0x7c7769]);
  }
  batch(new T.CylinderGeometry(.006,.014,1,4),mat(0xffffff),reeds);
  const blade=new T.BufferGeometry().setFromPoints([V(-.03,-.5,0),V(.04,-.3,0),V(0,.5,0)]);blade.computeVertexNormals();
  batch(blade,mat(0xffffff,.9,{side:T.DoubleSide}),leaves);
  batch(new T.SphereGeometry(.048,5,5),mat(0xffffff),plumes.map(a=>{a[7]*=18;return a;}));
  batch(new T.IcosahedronGeometry(1,studio.software?0:1),mat(0xbdb9a9,.91),pebbles);
}

export async function bankProjection(ctx,studio){
  const image=new Image();image.decoding='async';image.src='/assets/v10/fieldwork-riverbank-lod.webp';
  try{await image.decode();}catch{if(!ctx.closed)buildBanks(studio);return;}
  if(ctx.closed)return;
  // Orthographic motion translates every fixed bank vertex by the same
  // screen-space offset. The original projected silhouettes remain registered
  // with the live shoal collisions and the moving gauge throughout the route.
  const map=new T.Texture(image);map.colorSpace=T.SRGBColorSpace;map.needsUpdate=true;
  const sheet=mesh(studio.scene,new T.PlaneGeometry(44,38),new T.MeshBasicMaterial({
    map,alphaTest:.22,toneMapped:false,fog:false,depthTest:false,depthWrite:false
  }),V(0,0,-17));
  sheet.lookAt(sheet.position.clone().add(V(1.75,8.05,11.8)));sheet.renderOrder=-8;
}
function makeWater(studio){
  const geom=new T.PlaneGeometry(36,90);geom.rotateX(-Math.PI/2);
  const uniforms={uTime:{value:0}};
  if(studio.software){
    const surface=studio.texture('/assets/v10/fieldwork-riffles.webp','data');
    const water=new T.ShaderMaterial({uniforms:{...uniforms,surface:{value:surface}},vertexShader:
      'varying vec2 river;void main(){vec4 w=modelMatrix*vec4(position,1.);river=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader:`varying vec2 river;uniform float uTime;uniform sampler2D surface;
      void main(){vec3 a=texture2D(surface,river*vec2(.115,.092)+vec2(0.,uTime*.027)).rgb;
      vec3 b=texture2D(surface,river.yx*vec2(.068,.146)-vec2(uTime*.013,uTime*.004)).rgb;
      vec3 col=mix(vec3(.042,.075,.058),vec3(.15,.25,.23),.54*a.g+.24*b.g+.20*a.r);
      col+=vec3(.54,.43,.24)*a.b*(.23+.70*b.r)+vec3(.028,.034,.026)*(a.r+b.r-.8);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    const sheet=mesh(studio.scene,geom,water,V(0,.005,-17));sheet.renderOrder=-10;return t=>uniforms.uTime.value=t;
  }
  const shader=new T.ShaderMaterial({uniforms,vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec3 vWorld;uniform float uTime;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 c=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(c),hash(c+vec2(1,0)),f.x),mix(hash(c+vec2(0,1)),hash(c+1.),f.x),f.y);}
      void main(){vec2 p=vWorld.xz;float s=-p.y,mid=1.22*sin(s*.18)-.52*cos(s*.33),edge=abs(p.x-mid)-(3.6+.44*sin(s*.19+.3));
      float grains=noise(p*vec2(2.6,.68)+vec2(0.,uTime*.26));float swirls=noise(p*vec2(.83,.52)-uTime*.046);
      float chisels=noise(p*vec2(6.1,13.9)+vec2(uTime*.17,-uTime*.65));
      float wave=.55*cos(p.y*8.+p.x*2.+swirls*8.+uTime*1.85)+.29*sin(p.x*5.1+p.y*12.+grains*5.-uTime*2.65)+.16*cos(p.x*2.5-p.y*24.+chisels*5.+uTime*2.9);
      vec3 bed=mix(vec3(.029,.055,.037),vec3(.11,.135,.068),grains);
      vec3 sky=mix(vec3(.12,.22,.23),vec3(.26,.30,.23),swirls);
      float reedShade=smoothstep(-3.1,-.25,edge+swirls*1.15+wave*.25)*(.22+.17*grains);
      vec3 col=mix(bed,sky,.27+.17*wave+.11*grains);col*=1.-reedShade;
      col=mix(col,vec3(.16,.146,.08),smoothstep(-1.35,.25,edge)*(.35+.35*swirls));
      float sun=pow(max(0.,wave),15.)*smoothstep(.40,.69,chisels)*(.16+.6*exp(-abs(p.x+2.+sin(s*.37))*.35));col+=vec3(.91,.74,.4)*sun;
      col+=vec3(.075,.073,.054)*pow(max(0.,sin((edge+swirls*.24)*29.+uTime*1.3)),14.)*smoothstep(-.41,.09,edge)*chisels;
      gl_FragColor=vec4(col,1.); 
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  mesh(studio.scene,geom,shader,V(0,.005,-17));return t=>uniforms.uTime.value=t;
}
function makeBoat(scene){
  const raft=new T.Group();scene.add(raft);
  const culms=[mat(0x8e7747),mat(0xb99c63),mat(0x8a8652)],rope=mat(0x544938),node=mat(0x5b5c39);
  for(let i=-3;i<=3;i++){const x=i*.11,len=.91-Math.abs(i)*.06;
    rod(raft,V(x,.085,-len),V(x,.085,len),.053,culms[(i+3)%3],.052,10);
    for(const z of [-.62,-.2,.22,.65])rod(raft,V(x,.086,z-.012),V(x,.086,z+.012),.055,node,.055,8);}
  for(const z of [-.56,.55]){rod(raft,V(-.4,.14,z),V(.4,.14,z),.035,culms[0]);for(const x of [-.31,.02,.3]){const binding=mesh(raft,new T.TorusGeometry(.065,.011,4,12),rope,V(x,.115,z));binding.rotation.y=Math.PI/2;}}
  const pole=rod(raft,V(-.15,.16,-.46),V(.43,.7,.54),.017,culms[1]);
  const parcel=mesh(raft,new T.CylinderGeometry(.12,.15,.27,12,1),mat(0xbea278),V(0,.25,.22));parcel.rotation.z=.16;
  joinFixedProps(raft,[pole]);
  return {raft,pole,poleRest:pole.rotation.z};
}
export function navigateRiver(ctx){
  const studio=fieldStudio(ctx,{background:0xb3b7a1,sky:0xf7e7c5,bounce:0x5b705f,key:0xffde9c,zoom:5.3,fog:.018});studio.minimumWidth(4.75);
  const {scene,camera,canvas}=studio;canvas.setAttribute('aria-label','古河道，左右键横拨，按住上键加速，空格减速。');
  let banksReady=!studio.software;
  if(studio.software)bankProjection(ctx,studio).then(()=>{banksReady=true;if(started&&!ctx.closed)canvas.focus({preventScroll:true});});
  else buildBanks(studio);
  const water=makeWater(studio),{raft,pole,poleRest}=makeBoat(scene),gold=mat(0xd4bc72),wood=mat(0x604f35);
  const form=forms.find(item=>item.id===ctx.traits?.id);
  const look=form?{...form,...ctx.traits,level:T.MathUtils.clamp(Math.round(Number(ctx.traits.level)||1),1,3)}:null;
  const outfit=look?look.id+'-'+look.level:'plumage';
  let companion=null;
  // The fixed survey camera frames the passenger at only a few dozen pixels.
  // The software renderer can sample the same river plumage in five yaw poses.
  let poseMap=null;
  if(studio.software){
    poseMap=studio.texture('/assets/v10/fieldwork-raft-'+outfit+'.webp');poseMap.repeat.set(.2,1/3);poseMap.offset.set(.4,(2-Math.min(2,Math.max(0,Math.round(ctx.growthLevel||0))))/3);
    const passenger=new T.Sprite(new T.SpriteMaterial({map:poseMap,transparent:true,depthWrite:false,toneMapped:false}));passenger.scale.setScalar(1.78*.71);passenger.position.set(0,.166+.55*.71,-.17);raft.add(passenger);
    canvas.dataset.equipped=outfit;
  }else createCharacter({lod:1,plumage:applyRiverPlumage}).then(bird=>{
    if(ctx.closed){bird.dispose();return;}
    if(look)applyCollectionLook(bird,look);
    companion=bird;bird.group.scale.setScalar(.71);bird.group.position.set(0,.166,-.17);raft.add(bird.group);
    const equipped=bird.group.userData.collectionForm;canvas.dataset.equipped=equipped?equipped.id+'-'+equipped.level:'plumage';
  }).catch(()=>{});
  ctx.onClose(()=>companion?.dispose());
  const stops=[stopA,stopB];
  for(const [i,p] of stops.entries()){
    for(const ofs of [-.3,.3])rod(scene,V(p.x+ofs,0,-p.s),V(p.x+ofs,1.06,-p.s),.028,wood,.019);
    const cross=rod(scene,V(p.x-.4,.89,-p.s),V(p.x+.4,.89,-p.s),.03,gold);
    cross.name=i?'南岸水标':'芦湾水标';
    mesh(scene,new T.PlaneGeometry(.40,.54),mat(i?0x9b704b:0xe2cea6,.97,{side:T.DoubleSide}),V(p.x,.62,-p.s));
  }
  const targetRing=mesh(scene,new T.RingGeometry(.63,.67,64),new T.MeshBasicMaterial({color:0xf8d881,side:T.DoubleSide,transparent:true,opacity:.7,depthWrite:false}));targetRing.rotation.x=-Math.PI/2;
  if(studio.software)useVertexLighting(scene);
  const label=document.createElement('span');label.className='js-field-caption';ctx.overlay.append(label);
  const strong=document.createElement('strong'),sub=document.createElement('span');ctx.read.append(strong,sub);
  let s=1.8,x=center(s),lateral=0,v=0,target=0,started=false,secured=false,dragTarget=null,keys=new Set(),lastCue=0,hasGrounded=false;
  const launch=ctx.button('解缆出发',()=>{if(secured){transit.enter();targetRing.visible=false;return;}started=true;launch.hidden=true;ctx.cue('water');canvas.focus({preventScroll:true});update();});
  function held(text,code){const b=ctx.button(text,()=>{});b.disabled=true;
    ctx.on(b,'pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(code);ctx.cue('paddle');});const cancel=()=>keys.delete(code);
    ctx.on(b,'pointerup',cancel);ctx.on(b,'pointercancel',cancel);ctx.on(b,'lostpointercapture',cancel);return b;}
  const controls=[held('向左拨','ArrowLeft'),held('下篙加速','ArrowUp'),held('向右拨','ArrowRight')];
  ctx.on(canvas,'keydown',e=>{if(eddy.active||!['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW'].includes(e.code))return;e.preventDefault();e.stopPropagation();keys.add(e.code);});
  ctx.on(canvas,'keyup',e=>keys.delete(e.code));ctx.on(canvas,'blur',()=>keys.clear());ctx.on(window,'blur',()=>{keys.clear();dragTarget=null;});
  function guide(e){if(eddy.active||!started||secured)return;const bounds=canvas.getBoundingClientRect();dragTarget=T.MathUtils.clamp((e.clientX-bounds.left)/bounds.width*2-1,-.96,.96);}
  ctx.on(canvas,'pointerdown',e=>{if(eddy.active)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);guide(e);});ctx.on(canvas,'pointermove',e=>{if(e.buttons)guide(e);});const release=()=>dragTarget=null;
  ctx.on(canvas,'pointerup',release);ctx.on(canvas,'pointercancel',release);ctx.on(canvas,'lostpointercapture',release);
  function update(){
    ctx.step?.(target?2:1,4,secured?'从南岸布下测线':target?'操筏靠近右岸赭旗':'操筏进入左岸内湾');
    strong.textContent=secured?'实测岸线已合拢':target?'第二站 · 南岸桩':'第一站 · 芦湾桩';
    sub.textContent=secured?'两处靠泊记录已写入岸线图':target?'芦湾水位已记录　向右岸靠泊':'循浅色岸线进入左侧内湾';
    ctx.tip(secured?'竹排靠稳。一段木头在南岸内湾漂移。用测线观察它怎样越过刚刚绘下的岸边坐标。':!started?'水会带着竹排前行。先在左岸的双桩间测水，再向右驶向南岸。':'左右键或按住按钮横拨，↑ 加速，空格减速。也可按住水面左右移动。');
    if(secured){launch.hidden=false;launch.textContent='观测漂木';}
    for(const b of controls)b.disabled=!started||secured;
  }
  let camS=s,camX=center(s),clock=0,drawX=x,drawS=s,returning=false;
  const eddy=makeRiverEddy(ctx,{studio,center,breadth,pose:()=>({s,x}),
    channel(stream){const shoal=bars.find(b=>Math.abs(stream-b.s)<b.rz+1.4);return shoal?shoal.s+Math.sign(stream-shoal.s||1)*(shoal.rz+1.45):stream;},
    read(title,description){strong.textContent=title;sub.textContent=description;},
    onEnter(){keys.clear();dragTarget=null;targetRing.visible=false;returning=false;},
    onLeave(){keys.clear();dragTarget=null;targetRing.visible=true;returning=true;update();}
  });
  const transit=driftTransit(ctx,studio,()=>{update();launch.focus({preventScroll:true});});
  update();
  function navigate(dt){
      const destination=stops[target],remain=destination.s-s;
      let steer=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
      if(dragTarget!==null)steer=T.MathUtils.clamp((center(s)+dragTarget*breadth(s)-x)*1.55,-1,1);
      const ahead=keys.has('ArrowUp')||keys.has('KeyW');
      const drift=.10*Math.sin(s*.64)+.045*Math.sin(s*1.5);
      lateral=T.MathUtils.damp(lateral,steer*3.05+drift,4.8,dt);
      const oldX=x,oldS=s;
      const flow=keys.has('Space')?.08:ahead?2.65:1.18;
      v=T.MathUtils.damp(v,flow*Math.min(1,Math.max(.05,remain+.08)),2.8,dt);
      s=Math.min(destination.s,s+v*dt);x=T.MathUtils.clamp(x+lateral*dt,bank(s,-1)+.37,bank(s,1)-.37);
      let stuck=false;
      for(const b of bars){if(((x-b.x)/b.rx)**2+((s-b.s)/b.rz)**2<1){const k=(x-b.x)/b.rx,z=(s-b.s)/b.rz,m=Math.hypot(k,z)||1;x=b.x+b.rx*k/m;s=b.s+b.rz*z/m;stuck=true;}}
      if(stuck&&!hasGrounded){ctx.tip('船底擦过了沙脊。向旁边拨桨，等水带你绕过去。');ctx.cue('brush');}
      if(!stuck&&hasGrounded)update();hasGrounded=stuck;
      if(Math.hypot(x-oldX,s-oldS)>.001&&steer&&clock-lastCue>.85){ctx.cue('paddle');lastCue=clock;}
      if(Math.hypot(s-destination.s,x-destination.x)<1.03){ctx.cue('mark');if(target===0){target=1;transit.prepare();ctx.tip('芦湾已测。下一面赭色水标在右岸。');}else{secured=true;}update();}
      else if(remain<.3&&!hasGrounded){ctx.tip('水标就在旁边。按住横拨，驶入金色泊位。');}
  }
  ctx.frame((dt)=>{
    if(!banksReady)return;
    clock+=dt;
    if(transit.active||transit.finished){
      if(transit.active){transit.update(dt);if(label.textContent!=='南岸回水　／　漂木过境')label.textContent='南岸回水　／　漂木过境';}
      transit.render();return;
    }
    const trial=eddy.frame(dt,clock);
    if(!trial&&started&&!secured){
      const steps=Math.ceil(dt*40);
      for(let i=0;i<steps&&!secured;i++)navigate(dt/steps);
    }
    const dest=stops[target];targetRing.position.set(dest.x,.037,-dest.s);targetRing.scale.setScalar(1+Math.sin(clock*2)*.055);
    if(trial){drawX=trial.x;drawS=trial.s;}
    else if(returning){drawX=T.MathUtils.damp(drawX,x,7,dt);drawS=T.MathUtils.damp(drawS,s,7,dt);if(Math.hypot(x-drawX,s-drawS)<.03)returning=false;}
    else {drawX=x;drawS=s;}
    const steer=trial?trial.lateral:lateral;
    raft.position.set(drawX,.095+Math.sin(clock*2)*.027,-drawS);raft.rotation.set(Math.sin(clock*1.66)*.025,-steer*.095,-steer*.022+Math.cos(clock*1.82)*.019+(trial?.roll||0));pole.rotation.z=poleRest+.07*Math.sin(clock*2)-(trial?.stroke||0);
    camS=T.MathUtils.damp(camS,drawS,3.5,dt);camX=T.MathUtils.damp(camX,center(drawS)*.48+drawX*.12,3.5,dt);
    if(poseMap)poseMap.offset.x=T.MathUtils.clamp(2+Math.round(raft.rotation.y/.20),0,4)*.2;
    companion?.update(Math.min(dt,.1),clock,{mode:'grounded',speed:0,attentionYaw:steer*.07,growth:{level:ctx.growthLevel||0},...ctx.birdSpeech?.()});
    camera.position.set(camX+1.75,8.05,-camS+9.4);camera.lookAt(camX,0,-camS-2.4);
    if(!trial){
      const caption=secured?'南岸 · 已靠泊':(dest.s-s>1.1?'下游 '+Math.ceil(dest.s-s)+' 米　':'就近靠泊　')+(target?'右岸赭旗':'左岸白旗');
      if(label.textContent!==caption)label.textContent=caption;
    }
    water(clock);studio.render(true);if(trial)eddy.locate();
  });
}

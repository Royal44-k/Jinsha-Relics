import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadDetailedRelics} from '../v4/relic-loader.js';

function maskProfile(x,y){
  const a=Math.abs(x),square=v=>v*v;
  const bump=(cx,cy,width,height)=>Math.exp(-square((a-cx)/width)-square((y-cy)/height));
  const dome=.28-.245*x*x-.027*y*y;
  const width=.105+.055*THREE.MathUtils.smoothstep(-y,-.15,.43);
  const bridge=.34*Math.exp(-square(x/width)-Math.pow((y+.035)/.43,4));
  const nose=.20*bump(0,-.32,.18,.13)+.087*bump(.165,-.37,.085,.085);
  const browRise=.32+.19*Math.sin(a*1.95);
  const brow=.105*Math.exp(-square((y-browRise)/.115))*THREE.MathUtils.smoothstep(a,.065,.22)*(1-THREE.MathUtils.smoothstep(a,.97,1.13));
  const features=.13*bump(.72,-.28,.35,.25)+.05*bump(.25,-.72,.30,.10)-.125*bump(1.45,.26,.16,.26);
  return dome+bridge+nose+brow+features;
}

function maskNormalMap() {
  const width=336,height=186,rgba=new Uint8Array(width*height*4),e=.0015;
  const v=new THREE.Vector3();
  for(let iy=0;iy<height;iy++)for(let ix=0;ix<width;ix++){
    const x=-1.8+3.6*(ix+.5)/width,y=-1+2*(iy+.5)/height;
    const dx=(maskProfile(x+e,y)-maskProfile(x-e,y))/(2*e);
    const dy=(maskProfile(x,y+e)-maskProfile(x,y-e))/(2*e);
    v.set(-dx,-dy,1).normalize();
    const i=(iy*width+ix)*4;
    rgba[i]=Math.round(127.5*(1+v.x));rgba[i+1]=Math.round(127.5*(1+v.y));rgba[i+2]=Math.round(127.5*(1+v.z));rgba[i+3]=255;
  }
  const map=new THREE.DataTexture(rgba,width,height,THREE.RGBAFormat);
  // Front-cap UVs are the unrolled sheet coordinates. Sample the die's
  // continuous normal field instead of reflecting each long triangulation edge.
  map.matrixAutoUpdate=false;map.matrix.set(1/3.6,0,.5,0,.5,.5,0,0,1);
  map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  return map;
}

// The original thin mask has real cap and edge surfaces. Batch triangles into
// three groups so the entire concave side can carry a distinct finish.
function mountMaskSurfaces(mesh,materials,geometries,textures) {
  const geometry=mesh.geometry.clone(),normal=geometry.attributes.normal,position=geometry.attributes.position;
  const sampleNormal=new THREE.Vector3(),epsilon=.0015;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),nz=normal.getZ(i);
    const orientation=Math.sign(nz);
    // Retain the cut and bevel loops of the original blank. A continuous
    // die surface lifts the bridge and alae, with a separate reverse skin.
    position.setZ(i,maskProfile(x,y)+.0085*THREE.MathUtils.clamp(nz*12,-1,1));
    if(Math.abs(nz)>.07){
      const dx=(maskProfile(x+epsilon,y)-maskProfile(x-epsilon,y))/(2*epsilon);
      const dy=(maskProfile(x,y+epsilon)-maskProfile(x,y-epsilon))/(2*epsilon);
      sampleNormal.set(-dx*orientation,-dy*orientation,orientation).normalize();
      normal.setXYZ(i,sampleNormal.x,sampleNormal.y,sampleNormal.z);
    }
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const source=geometry.index?.array;
  const batches=[[],[],[]];
  const length=source?.length ?? normal.count;
  for(let i=0;i<length;i+=3){
    const a=source?source[i]:i,b=source?source[i+1]:i+1,c=source?source[i+2]:i+2;
    const z=(normal.getZ(a)+normal.getZ(b)+normal.getZ(c))/3;
    batches[z>.18?0:z<-.18?1:2].push(a,b,c);
  }
  geometry.clearGroups();
  geometry.setIndex(batches.flat());
  let offset=0;
  batches.forEach((batch,index)=>{geometry.addGroup(offset,batch.length,index);offset+=batch.length;});
  const polished=mesh.material.clone();polished.roughness=.51;polished.bumpScale=.003;polished.side=THREE.FrontSide;
  polished.normalMap=maskNormalMap();polished.normalMapType=THREE.ObjectSpaceNormalMap;textures.push(polished.normalMap);
  const inner=mesh.material.clone();inner.color.multiply(new THREE.Color('#bd9662'));inner.roughness=.91;inner.metalness=.73;inner.bumpScale=.018;inner.side=THREE.FrontSide;
  const edge=mesh.material.clone();edge.roughness=.58;edge.bumpScale=.004;
  for(const material of [polished,inner,edge])materials.set(material,material);
  geometries.push(geometry);
  mesh.geometry=geometry;mesh.material=[polished,inner,edge];
}

export async function createArtifactStage(canvas, id, size = 430) {
  const models=await loadDetailedRelics();
  if (!canvas.isConnected) return null;
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setPixelRatio(1);
  renderer.setSize(size,size,false);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.91;
  const scene=new THREE.Scene();
  const studio=new RoomEnvironment();
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(studio,.025);
  studio.dispose();pmrem.dispose();
  scene.environment=environment.texture;
  scene.background=new THREE.Color('#0c191e');
  scene.environmentIntensity=1.04;
  const object=models[id];
  const localMaterials=new Map(),localGeometry=[],localTextures=[];
  object.traverse(node=>{
    if(!node.isMesh)return;
    if(id==='mask'){mountMaskSurfaces(node,localMaterials,localGeometry,localTextures);return;}
    const source=node.material;
    if(!localMaterials.has(source)){
      const sample=source.clone();
      if(id==='jade' && source.vertexColors){
        sample.color.multiply(new THREE.Color('#9aa993'));
        sample.roughness=.68;
      }
      if(id==='bird')sample.color.multiply(new THREE.Color('#b6baaa'));
      localMaterials.set(source,sample);
    }
    node.material=localMaterials.get(source);
  });
  const pivot=new THREE.Group();
  const bounds=new THREE.Box3().setFromObject(object);
  const center=bounds.getCenter(new THREE.Vector3());
  const dimensions=bounds.getSize(new THREE.Vector3());
  const scale=1.65/Math.max(dimensions.x,dimensions.y,dimensions.z);
  object.position.copy(center).multiplyScalar(-scale);
  object.scale.setScalar(scale);
  pivot.add(object);scene.add(pivot);
  const camera=new THREE.PerspectiveCamera(38,1,.05,30);
  camera.position.set(0,0,2.85);camera.lookAt(0,0,0);
  const ambient=new THREE.HemisphereLight('#e7f2ef','#7c6959',1.07);
  const key=new THREE.DirectionalLight('#ffe3b3',2.35);
  const rim=new THREE.DirectionalLight('#d9f0ff',1.05);
  rim.position.set(-2,1,-2);
  scene.add(ambient,key,rim);
  let frontal=true,near=false;
  const original = {jade:[-.61,.43],bird:[-1.2,.12],sun:[-.12,.14],mask:[-.18,.065]}[id];
  const pose={yaw:original[0],pitch:original[1]};
  function draw() {
    pivot.rotation.order='YXZ';
    pivot.rotation.y=pose.yaw;pivot.rotation.x=pose.pitch;
    renderer.render(scene,camera);
  }
  function lighting() {
    key.position.set(frontal?2.3:-3.5,frontal?2.8:.2,frontal?2.2:1.0);
    key.intensity=frontal?1.65:2.6;
    scene.environmentIntensity=frontal?.78:.56;
    ambient.intensity=frontal?.62:.45;
    draw();
  }
  lighting();
  return {
    rotate(dx,dy){pose.yaw+=dx;pose.pitch=THREE.MathUtils.clamp(pose.pitch+dy,-1.22,1.22);draw();},
    inspect({yaw=original[0],pitch=original[1],z=2.85,x=0,y=0,sideLight=false}={}){
      pose.yaw=yaw;pose.pitch=pitch;camera.position.z=z;near=z<2.2;
      pivot.position.set(x,y,0);frontal=!sideLight;lighting();
      return {near,sideLight};
    },
    light(){frontal=!frontal;lighting();return !frontal;},
    zoom(){near=!near;camera.position.z=near?2.09:2.85;draw();return near;},
    reset(){pose.yaw=original[0];pose.pitch=original[1];near=false;camera.position.z=2.85;pivot.position.set(0,0,0);frontal=true;lighting();},
    dispose(){for(const material of localMaterials.values())material.dispose();for(const geo of localGeometry)geo.dispose();for(const texture of localTextures)texture.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();pivot.removeFromParent();}
  };
}

export function mountArtifactViewer(host, id, label, close, options={}) {
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label',label+'互动复原模型，方向键旋转');
  canvas.tabIndex=0;
  const controls=document.createElement('div');controls.className='jc-view-controls';
  const status=document.createElement('span');status.className='jc-view-status';status.setAttribute('role','status');
  status.textContent='正在布置文物灯光…';
  let stage=null,done=false;
  function control(text,action,always=false) {
    const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=!always;
    b.addEventListener('click',()=>action(b));controls.append(b);
    return b;
  }
  const left=control('向左转',()=>stage.rotate(-.36,0));
  const right=control('向右转',()=>stage.rotate(.36,0));
  const light=control('换侧光',b=>{const active=stage.light();b.textContent=active?'换正光':'换侧光';b.setAttribute('aria-pressed',String(active));});
  const zoom=control('看细部',b=>{const active=stage.zoom();b.textContent=active?'看全貌':'看细部';b.setAttribute('aria-pressed',String(active));});
  const closeButton=control('收起模型',()=>close(),true);
  light.setAttribute('aria-pressed','false');zoom.setAttribute('aria-pressed','false');
  host.append(canvas,status,controls);
  let pointer=null,x=0,y=0,tick=0,deltaX=0,deltaY=0;
  function flush(){
    tick=0;
    if(stage && !done) stage.rotate(deltaX*.012,deltaY*.010);
    deltaX=deltaY=0;
  }
  canvas.addEventListener('pointerdown',e=>{
    if (!stage || pointer!==null) return;
    pointer=e.pointerId;x=e.clientX;y=e.clientY;canvas.setPointerCapture(pointer);canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointer)return;
    deltaX+=e.clientX-x;deltaY+=e.clientY-y;x=e.clientX;y=e.clientY;
    if(!tick)tick=requestAnimationFrame(flush);
  });
  canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
  canvas.addEventListener('keydown',e=>{
    const axes={ArrowLeft:[-.16,0],ArrowRight:[.16,0],ArrowUp:[0,-.13],ArrowDown:[0,.13]};
    if(stage && axes[e.key]){e.preventDefault();e.stopPropagation();stage.rotate(...axes[e.key]);}
  });
  const dialog=host.closest('dialog');
  function release() {
    if(done)return;
    done=true;observer.disconnect();dialog?.removeEventListener('close',release);
    if(tick)cancelAnimationFrame(tick);
    stage?.dispose();stage=null;
  }
  const observer=new MutationObserver(()=>{if(!host.isConnected)release();});
  observer.observe(document.body,{childList:true,subtree:true});
  dialog?.addEventListener('close',release,{once:true});
  createArtifactStage(canvas,id,Math.min(560,Math.max(340,Math.round(host.clientWidth*1.5)))).then(result=>{
    if(done || !host.isConnected) { result?.dispose();return; }
    if(!result)return;
    stage=result;
    for(const b of [left,right,light,zoom])b.disabled=false;
    status.textContent='拖动或使用方向键旋看';
    if(options.onReady) options.onReady({...stage,inspect:pose=>{
      const actual=stage.inspect(pose);
      light.setAttribute('aria-pressed',String(actual.sideLight));light.textContent=actual.sideLight?'换正光':'换侧光';
      zoom.setAttribute('aria-pressed',String(actual.near));zoom.textContent=actual.near?'看全貌':'看细部';
    }});
    if(options.focusCanvas!==false) canvas.focus({preventScroll:true});
  }).catch(()=>{
    if(done)return;
    canvas.hidden=true;status.textContent='当前设备未能显示模型，可收起模型查看图鉴。';
    options.onError?.();
    if(options.focusCanvas!==false) closeButton.focus({preventScroll:true});
  });
  return release;
}


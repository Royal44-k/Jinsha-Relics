import * as THREE from 'three';
import {advanceParticle} from '../v8/frame-time.js';

// Short-lived, pooled effects are physical feedback, not permanent scene clutter.
export function createTraversalEffects(scene) {
  const group=new THREE.Group();group.name='Feet · feathers · water';scene.add(group);
  const up=new THREE.Vector3(0,1,0), dummy=new THREE.Object3D();
  const ringGeometry=new THREE.RingGeometry(.975,1,64);
  ringGeometry.rotateX(-Math.PI/2);
  const rings=Array.from({length:14},()=>{
    const mesh=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:'#c5e1c3',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    mesh.visible=false;group.add(mesh);return {mesh,age:0,life:0,start:.1,growth:1};
  });
  const count=170,positions=new Float32Array(count*3),colors=new Float32Array(count*3),particles=[];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(16,16,1,16,16,15);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.3,'rgba(255,255,255,.7)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);
  const map=new THREE.CanvasTexture(canvas),material=new THREE.PointsMaterial({map,size:.07,transparent:true,vertexColors:true,depthWrite:false,opacity:.75});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;group.add(points);
  for(let i=0;i<count;i++){positions[i*3+1]=-1000;particles.push({active:false,age:0,life:1,position:new THREE.Vector3(),velocity:new THREE.Vector3(),color:new THREE.Color(),kind:'dust'});}
  const leafGeometry=new THREE.BufferGeometry();leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.05,0,.10,0,.025,.24,.05,0,.10],3));leafGeometry.setIndex([0,1,2,0,2,3]);leafGeometry.computeVertexNormals();
  const leafMaterial=new THREE.MeshStandardMaterial({color:'#6b6541',roughness:.92,side:THREE.DoubleSide});
  const leaves=new THREE.InstancedMesh(leafGeometry,leafMaterial,24);leaves.frustumCulled=false;group.add(leaves);
  const leafStates=Array.from({length:24},()=>({age:0,life:0,p:new THREE.Vector3(),v:new THREE.Vector3(),spin:0}));
  const perchRing=new THREE.Mesh(new THREE.TorusGeometry(.38,.015,5,48),new THREE.MeshBasicMaterial({color:'#e3c48a',transparent:true,opacity:.65,depthWrite:false}));
  perchRing.rotation.x=-Math.PI/2;perchRing.visible=false;group.add(perchRing);
  let cursor=0,leafCursor=0,ringCursor=0,trailTimer=0,windTimer=0,reduced=false,randomSeed=307;
  const random=()=>{randomSeed=(1664525*randomSeed+1013904223)>>>0;return randomSeed/4294967296;};

  function spawn(position,kind,n=8,speed=1){
    for(let i=0;i<n;i++){
      const p=particles[cursor++%count];p.active=true;p.age=0;p.life=kind==='bubble'?2.4:.7+random()*.8;p.kind=kind;
      p.position.copy(position).add(new THREE.Vector3((random()-.5)*.3,.08,(random()-.5)*.3));
      p.velocity.set((random()-.5)*speed,kind==='bubble'?.25+random()*.45:.2+random()*speed,(random()-.5)*speed);
      p.color.set(kind==='bubble'?'#b2e1d7':kind==='splash'?'#dcf1dc':kind==='feather'?'#e7c789':'#a99770');
    }
  }
  function ring(position,{life=2,growth=1.5,start=.12}={}){
    const r=rings[ringCursor++%rings.length];r.age=0;r.life=life;r.start=start;r.growth=growth;r.mesh.position.copy(position);r.mesh.position.y+=.025;r.mesh.visible=true;
  }
  function emit(event,position){
    const p=position||event.position;if(!p)return;
    if(event.type==='step'){
      spawn(p,'dust',reduced?1:4,.28);
      if(!reduced&&random()<.18){const leaf=leafStates[leafCursor++%leafStates.length];leaf.age=0;leaf.life=.8;leaf.p.copy(p).y+=.03;leaf.v.set((random()-.5)*.28,.22+random()*.18,(random()-.5)*.28);leaf.spin=random()*6;}
    }else if(['splash','water-enter','land-water','surface'].includes(event.type)){
      spawn(p,'splash',reduced?6:22,1.5);ring(p,{life:2.3,growth:2.1});
    }else if(event.type==='dive'){
      spawn(p,'bubble',reduced?4:16,.3);ring(p,{growth:1.1});
    }else if(event.type==='land'){
      spawn(p,'dust',reduced?5:16,1);ring(p,{life:.6,growth:.7,start:.1});
    }else if(['takeoff','jump'].includes(event.type)){
      spawn(p,'feather',reduced?3:11,.65);
    }else if(event.type==='perch')spawn(p,'feather',5,.25);
    else if(event.type==='dash')spawn(p,event.surface==='water'?'bubble':event.surface==='ground'?'dust':'feather',reduced?3:9,event.surface==='ground'?.55:.25);
  }
  function update(dt,time,state,position,world){
    trailTimer+=dt;windTimer+=dt;
    const wet=state.mode==='swimming'||state.mode==='diving';
    const surface=world.sample(position);
    if(!wet&&surface.boundary&&surface.boundary.distance<5&&windTimer>.18){
      const n=reduced?1:3,p=position.clone().add(new THREE.Vector3((random()-.5)*5,.5+random()*2,(random()-.5)*5));spawn(p,'feather',n,.3);
      for(let i=0;i<n;i++){const particle=particles[(cursor-1-i+count)%count];particle.velocity.copy(surface.boundary.inward).multiplyScalar(2.2);particle.velocity.y=.1;}
      windTimer=0;
    }
    if(state.mode==='diving'&&trailTimer>.13){const head=position.clone().addScaledVector(up,.8);spawn(head,'bubble',reduced?1:3,.16);trailTimer=0;}
    else if(['flying','gliding'].includes(state.mode)&&state.speed>2&&trailTimer>.10){spawn(position.clone().addScaledVector(up,.55),'feather',reduced?0:1,.08);trailTimer=0;}
    // Continuous swimming wakes are owned by the river, preventing doubled rings.
    for(let i=0;i<count;i++){
      const p=particles[i],j=i*3;
      if(!p.active){positions[j+1]=-1000;continue;}
      p.age+=dt;if(p.age>=p.life){p.active=false;positions[j+1]=-1000;continue;}
      advanceParticle(p.position,p.velocity,p.kind==='bubble'?.2:p.kind==='splash'?-3.6:-.3,dt);positions[j]=p.position.x;positions[j+1]=p.position.y;positions[j+2]=p.position.z;
      const fade=Math.sin(Math.PI*p.age/p.life);colors[j]=p.color.r*fade;colors[j+1]=p.color.g*fade;colors[j+2]=p.color.b*fade;
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
    for(const r of rings){if(!r.mesh.visible)continue;r.age+=dt;if(r.age>=r.life){r.mesh.visible=false;continue;}const t=r.age/r.life;r.mesh.scale.setScalar(r.start+r.growth*t);r.mesh.material.opacity=(1-t)*.16;}
    for(let i=0;i<leafStates.length;i++){
      const l=leafStates[i];l.age+=dt;
      if(l.age>=l.life){dummy.position.set(0,-1000,0);dummy.scale.setScalar(.001);}
      else{advanceParticle(l.p,l.v,-1.2,dt);dummy.position.copy(l.p);dummy.rotation.set(Math.sin(l.age*5+l.spin),l.age*4+l.spin,.5);dummy.scale.setScalar(1-l.age/l.life*.5);}
      dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
    }leaves.instanceMatrix.needsUpdate=true;
    let nearest=null,best=2.4;
    for(const perch of world.perches){const distance=perch.position.distanceTo(position);if(distance<best&&position.y>perch.position.y-.9){best=distance;nearest=perch;}}
    perchRing.visible=!!nearest&&!wet&&state.mode!=='perched';if(nearest){perchRing.position.copy(nearest.position).y+=.035;perchRing.scale.setScalar(1+Math.sin(time*2)*.08);}
    return {nearestPerch:nearest};
  }
  return {emit,update,setReduced(value){reduced=!!value;},dispose(){group.removeFromParent();ringGeometry.dispose();rings.forEach(r=>r.mesh.material.dispose());geometry.dispose();material.dispose();map.dispose();leafGeometry.dispose();leafMaterial.dispose();perchRing.geometry.dispose();perchRing.material.dispose();}};
}

export const immersionShader={
  uniforms:{tDiffuse:{value:null},uTime:{value:0},uImmersion:{value:0},uReduced:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;uniform float uImmersion;uniform float uReduced;varying vec2 vUv;
  void main(){vec2 uv=vUv;uv.x+=sin(uv.y*21.+uTime*.9)*.0018*uImmersion*(1.-uReduced);uv.y+=sin(uv.x*17.-uTime*.5)*.001*uImmersion*(1.-uReduced);vec3 c=texture2D(tDiffuse,uv).rgb;float caustic=pow(max(0.,sin(uv.x*31.+uv.y*23.+uTime)*sin(uv.y*37.-uv.x*19.-uTime*.8)),9.);vec3 water=c*vec3(.58,.88,.87)+vec3(.0,.018,.017);water+=caustic*vec3(.01,.025,.021);float edge=1.-smoothstep(.25,.78,length(vUv-.5));c=mix(c,water*(.65+edge*.35),uImmersion);gl_FragColor=vec4(c,1.);}`
};

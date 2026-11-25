import {fieldTime,reviewPaused} from '../v13/review-clock.js';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadDetailedRelics } from '../v4/relic-loader.js';

const TAU=Math.PI*2, V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const cap=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
function noise(seed){
  let a=seed|0;
  return ()=>{a=(Math.imul(a,1664525)+1013904223)|0;return (a>>>0)/4294967296;};
}
function material(color,roughness=.85,metalness=0){return new T.MeshStandardMaterial({color,roughness,metalness});}
function mesh(root,g,m,p=[0,0,0]){
  const o=new T.Mesh(g,m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;
}
function cylinder(root,r1,r2,h,m,p,n=32){return mesh(root,new T.CylinderGeometry(r1,r2,h,n),m,p);}
function rod(root,a,b,r,mat,r2=r){
  const av=V(...a),bv=V(...b),d=bv.clone().sub(av);
  const o=cylinder(root,r2,r,d.length(),mat,av.lerp(bv,.5).toArray(),8);o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o;
}
function sceneLights(s,bg,fog,key=0xffe0ab){
  s.scene.background=new T.Color(bg);s.scene.fog=new T.FogExp2(fog,.022);
  s.scene.add(new T.HemisphereLight(0xf4e7cb,0x5b4942,1.43));
  const sun=new T.DirectionalLight(key,2.5);sun.position.set(-5,8,4);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,far:40});sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.024;sun.shadow.bias=-.00045;
  s.scene.add(sun);
  const fill=new T.DirectionalLight(0x96bec8,.86);fill.position.set(5,3,-3);s.scene.add(fill);
  return sun;
}
function terrainMaterial(s,hex,detail='rock_boulder_dry',repeat=4){
  const m=material(hex,.93);
  if(!s.renderer)return m;
  const tex=new T.TextureLoader().load('/assets/environment/'+detail+'_diff_1k.webp',()=>s.invalidate());
  tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(repeat,repeat);tex.anisotropy=Math.min(4,s.renderer.capabilities.getMaxAnisotropy());m.map=tex;
  s.extra.add(tex);return m;
}
function floor(root,w,d,y,m){
  const plane=mesh(root,new T.PlaneGeometry(w,d),m,[0,y,0]);plane.rotation.x=-Math.PI/2;plane.castShadow=false;return plane;
}
function instanced(root,geo,mat,points){
  const group=new T.InstancedMesh(geo,mat,points.length),obj=new T.Object3D();
  points.forEach((p,i)=>{
    obj.position.set(...p.slice(0,3));obj.scale.set(...p.slice(3,6));obj.rotation.set(...(p[6]||[0,0,0]));
    obj.updateMatrix();group.setMatrixAt(i,obj.matrix);if(p[7])group.setColorAt(i,new T.Color(p[7]));
  });
  group.receiveShadow=true;group.castShadow=true;root.add(group);return group;
}
function surfaceMap(s,name){
  if(!s.renderer)return null;
  s.surfaceMaps??=new Map();
  if(s.surfaceMaps.has(name))return s.surfaceMaps.get(name);
  const tex=new T.TextureLoader().load('/assets/v12/'+name+'.png',()=>{if(!s.gone)s.invalidate();});
  tex.wrapS=tex.wrapT=T.RepeatWrapping;s.extra.add(tex);s.surfaceMaps.set(name,tex);
  return tex;
}
function sediment(s,wall=false){
  const tex=surfaceMap(s,wall?'deposit-wall':'river-sediment');
  const m=material(tex?0xffffff:0x806c54);
  if(tex){tex.colorSpace=T.SRGBColorSpace;tex.repeat.set(wall?3:7,wall?1:7);}
  m.map=tex;m.bumpMap=tex;m.bumpScale=wall?.038:.062;return m;
}
function coast(s,height,seed=32,earth=null){
  const rand=noise(seed),g=new T.PlaneGeometry(45,48,64,60);g.rotateX(-Math.PI/2);const v=g.attributes.position;
  for(let i=0;i<v.count;i++){const x=v.getX(i),z=v.getZ(i);v.setY(i,height+Math.sin(x*.92+z*.77)*.046+(rand()-.5)*.065);}
  g.computeVertexNormals();return mesh(s.scene,g,earth||terrainMaterial(s,0xa89470,'forest_floor',11));
}
function scatter(s,seed,extents,count,y,size=1){
  const rng=noise(seed),pebbles=[];
  for(let i=0;i<count;i++){
    const x=(rng()-.5)*extents[0],z=(rng()-.5)*extents[1],r=(.024+rng()**3*.13)*size;
    pebbles.push([x,y+r*.09,z,r*1.6,r*.55,r,[rng()*.33,rng()*TAU,rng()*.21],new T.Color().setHSL(.064+rng()*.028,.12+rng()*.14,.11+rng()*.18)]);
  }
  return instanced(s.scene,new T.IcosahedronGeometry(1,1),material(0xffffff),pebbles);
}
function reeds(s,seed,clusters,y){
  const rng=noise(seed),stems=[],leaves=[],heads=[];
  clusters.forEach(([cx,cz,spread,n])=>{
    for(let i=0;i<n;i++){
      const x=cx+(rng()-.5)*spread,z=cz+(rng()-.5)*spread,h=.32+rng()*.73,a=-.18+(cx-x)*.16+(rng()-.5)*.15,lean=(z-cz)*.13;
      stems.push([x,y+h/2,z,.008,h,.007,[lean,0,a]]);
      if(rng()>.64)heads.push([x-Math.sin(a)*h*.48,y+h*.97,z+Math.sin(lean)*h*.46,.018,.075,.017,[lean,0,a]]);
      for(const sign of [-1,1])leaves.push([x-.045*sign,y+h*.40,z,.016,h*.52,.006,[lean,rng(),sign*(.17+rng()*.41)-.16]]);
    }
  });
  instanced(s.scene,new T.CylinderGeometry(.6,1,1,4),material(0x657147),stems);
  instanced(s.scene,new T.SphereGeometry(1,5,4),material(0x77834d),leaves);
  instanced(s.scene,new T.SphereGeometry(1,5,5),material(0xb89569),heads);
}
function sky(s,top,horizon,bottom){
  const sphere=new T.Mesh(new T.SphereGeometry(80,36,20),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(top)},horizon:{value:new T.Color(horizon)},bottom:{value:new T.Color(bottom)}},
    vertexShader:'varying vec3 vp;void main(){vp=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 vp;uniform vec3 top,horizon,bottom;void main(){float h=normalize(vp).y;vec3 tint=mix(horizon,top,smoothstep(0.,.56,h));tint=mix(tint,bottom,smoothstep(0.,.38,-h));gl_FragColor=vec4(tint,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
  }));sphere.frustumCulled=false;s.scene.add(sphere);
}
function water(s,position,plate,w=40,d=9){
  const mat=new T.ShaderMaterial({uniforms:{t:{value:0},panorama:{value:plate}},
    vertexShader:'varying vec3 v;void main(){vec4 world=modelMatrix*vec4(position,1.);v=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
    fragmentShader:`varying vec3 v;uniform float t;uniform sampler2D panorama;
    void main(){vec3 ray=normalize(v-cameraPosition);float u=clamp(.5+atan(ray.x,-ray.z)/2.6,.005,.995);
    float wave=sin(v.z*12.+v.x*1.7+t*.6+.5*sin(v.x*2.4+v.z*3.5))+sin(v.z*21.+t*.82+v.x*1.1);
    float depth=clamp((-v.z-3.)/24.,0.,1.);vec2 uv=vec2(u+.003*wave,.04+depth*.33+.003*wave);
    vec3 c=texture2D(panorama,uv).rgb;float glint=smoothstep(1.62,1.99,wave)*.05;
    gl_FragColor=vec4(c*vec3(.93,1.,.97)+vec3(.61,.43,.26)*glint,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
  });
  const o=mesh(s.scene,new T.PlaneGeometry(w,d),mat,position);o.rotation.x=-Math.PI/2;o.castShadow=false;
  s.anim.push(t=>mat.uniforms.t.value=t);return o;
}

export function createSanctuaryStage(ctx,make){
  const canvas=document.createElement('canvas');canvas.style.opacity='0';ctx.surface.append(canvas);
  let renderer;
  try{
    const settings={antialias:true,alpha:false,powerPreference:'high-performance'};
    const context=canvas.getContext('webgl2',settings);
    if(context)renderer=new T.WebGLRenderer({...settings,canvas,context});
  }catch{}
  if(renderer){
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  }
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.08,160);
  let dirty=true;
  const st={scene,camera,renderer,ctx,extra:new Set(),anim:[],gone:false,span:8,aspect:1,invalidate(){dirty=true;if(renderer)renderer.shadowMap.needsUpdate=true;}};
  st.look=(pos,target)=>{camera.position.set(...pos);camera.lookAt(...target);camera.updateMatrixWorld(true);};
  st.environment=()=>{
    if(!renderer)return;
    const gen=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),map=gen.fromScene(room,.045,.1,100,{size:64});
    scene.environment=map.texture;scene.environmentIntensity=.78;room.dispose();gen.dispose();st.extra.add(map);
  };
  const art=make(st), project=point=>{
    const v=V(...point).project(camera);return [(v.x+1)/2,(1-v.y)/2];
  };
  let frame=0,width=0,height=0,canvas2,pen,lost=false;
  const layout=[],animation=[];
  st.projectMarkers=()=>layout.forEach(fn=>fn(project));
  function fallback(){
    if(canvas2)return;
    lost=true;canvas2=document.createElement('canvas');canvas.replaceWith(canvas2);canvas2.width=Math.max(1,width);canvas2.height=Math.max(1,height);
    pen=canvas2.getContext('2d');dirty=true;
  }
  if(!renderer)fallback();
  else ctx.on(canvas,'webglcontextlost',ev=>{ev.preventDefault();if(!st.gone)fallback();});
  function paintFallback(t){
    const g=pen.createLinearGradient(0,0,0,height);g.addColorStop(0,art.paper?.[0]||'#74624e');g.addColorStop(1,art.paper?.[1]||'#261f1a');pen.fillStyle=g;pen.fillRect(0,0,width,height);
    art.flat?.(pen,width,height,project,t);
  }
  function resize(){
    const r=ctx.viewport.getBoundingClientRect();width=Math.max(1,Math.round(r.width));height=Math.max(1,Math.round(r.height));
    camera.aspect=st.aspect=width/height;st.compose?.(st.aspect);
    camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(st.fov||34)/2)*Math.max(1,(st.fit||1.55)/camera.aspect)));
    camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    if(!lost)renderer.setSize(width,height,false);else {canvas2.width=width;canvas2.height=height;}
    st.invalidate();layout.forEach(fn=>fn(project));
  }
  const ro=new ResizeObserver(resize);ro.observe(ctx.viewport);resize();
  const start=fieldTime();let last=start,readyFrames=0;
  function draw(now){
    if(st.gone)return;frame=requestAnimationFrame(draw);if(document.hidden||reviewPaused())return;
    now=fieldTime(now);
    const t=(now-start)/1000,dt=Math.min((now-last)/1000,.1);last=now;
    const reduced=ctx.options.reduced||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(st.step?.(dt,reduced)){dirty=true;st.projectMarkers();}
    animation.forEach(fn=>fn(t,dt));st.anim.forEach(fn=>fn(reduced?0:t,dt));
    if(!dirty&&!animation.length&&!st.anim.length)return;dirty=false;
    if(!lost){
      renderer.render(scene,camera);
      if(!st.readyView||st.readyView()){
        readyFrames++;
        if(!st.readyView||readyFrames>=3&&t>.32){canvas.style.opacity='1';ctx.surface.classList.add('scene-ready');}
      }
    }else{paintFallback(t);ctx.surface.classList.add('scene-ready');}
  }
  frame=requestAnimationFrame(draw);
  async function snapshot(point){
    try{
      if(!lost&&renderer.getContext().isContextLost())fallback();
      const [px,py]=project(point),source=lost?canvas2:renderer.domElement;
      if(source.width<2||source.height<2)return '';
      const mini=document.createElement('canvas');mini.width=256;mini.height=164;
      const p=mini.getContext('2d',{willReadFrequently:true}),w=Math.max(1,Math.floor(Math.min(source.width*.31,source.height*256/164))),h=Math.max(1,Math.round(w*164/256));
      // WebGL normally clears its drawing buffer after compositing. Render and
      // copy in this task, before yielding to the compositor.
      if(lost)paintFallback((fieldTime()-start)/1000);else renderer.render(scene,camera);
      const x=Math.round(cap(px*source.width-w/2,0,source.width-w)),y=Math.round(cap(py*source.height-h/2,0,source.height-h));
      let bitmap=null;
      if(typeof createImageBitmap==='function'){
        try{bitmap=await createImageBitmap(source,x,y,w,h,{resizeWidth:256,resizeHeight:164,resizeQuality:'high'});}catch{}
      }
      if(st.gone){bitmap?.close();return '';}
      if(bitmap){p.drawImage(bitmap,0,0);bitmap.close();}
      else{
        if(!lost)renderer.render(scene,camera);
        p.drawImage(source,x,y,w,h,0,0,256,164);
      }
      const pixels=p.getImageData(0,0,256,164).data;
      let lo=255,hi=0;
      for(let i=0;i<pixels.length;i+=52){const l=.25*pixels[i]+.59*pixels[i+1]+.16*pixels[i+2];lo=Math.min(lo,l);hi=Math.max(hi,l);}
      if(hi-lo<6)return '';
      const prefix='data:image/jpeg;base64,';
      for(const quality of [.85,.69,.50,.30,.14]){
        const photo=mini.toDataURL('image/jpeg',quality);
        if(photo.startsWith(prefix)&&photo.length-prefix.length<=32768)return photo;
      }
      return '';
    }catch{return '';}
  }
  ctx.disposers.push(()=>{
    st.gone=true;cancelAnimationFrame(frame);ro.disconnect();
    const resources=new Set(st.extra);
    scene.traverse(o=>{
      if(o.userData.sharedSource)return;
      if(o.geometry)resources.add(o.geometry);if(o.isInstancedMesh)resources.add(o);
      for(const m of [].concat(o.material||[]))resources.add(m);
      if(o.shadow)resources.add(o.shadow);
    });
    resources.forEach(x=>x.dispose?.());renderer?.dispose();renderer?.forceContextLoss();
  });
  return {art,project,snapshot,holdImage(){cancelAnimationFrame(frame);},onFrame(fn){animation.push(fn);},onLayout(fn){layout.push(fn);fn(project);}};
}

// Varied cross-sections, axial striations, longitudinal cracking and an open pulp cavity.
function tusk(root,points,radius,seed,openStart=true,endRadius=.12){
  const rng=noise(seed),path=new T.CatmullRomCurve3(points.map(p=>V(...p))),N=80,S=24;
  const frames=path.computeFrenetFrames(N,false),vertices=[],colors=[],indices=[];
  const grain=Array.from({length:S},()=>rng()),base=new T.Color(0xbeb398),tip=new T.Color(0xd9ca9e);
  for(let i=0;i<=N;i++){
    const t=i/N,p=path.getPointAt(t),normal=frames.normals[i],bin=frames.binormals[i];
    for(let j=0;j<S;j++){
      const a=TAU*j/S,r=radius*(endRadius+(1-endRadius)*(1-t)**.80)*(1+.009*Math.sin(t*76)+grain[j]*.021);
      const q=p.clone().addScaledVector(normal,r*Math.cos(a)).addScaledVector(bin,r*Math.sin(a)*.9);vertices.push(...q.toArray());
      const c=base.clone().lerp(tip,t).multiplyScalar(.9+.08*grain[j]+.018*Math.cos(t*90+Math.sin(a*3))-.05*Math.sin(a)**4);colors.push(c.r,c.g,c.b);
      if(i<N){const a0=i*S+j,b=i*S+(j+1)%S,c0=a0+S,d=b+S;indices.push(a0,c0,b,b,c0,d);}
    }
  }
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));geom.setIndex(indices);geom.computeVertexNormals();
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.76,side:T.DoubleSide});mesh(root,geom,mat);
  if(openStart){
    const p=path.getPointAt(0),tan=path.getTangentAt(0).negate(),rim=mesh(root,new T.RingGeometry(radius*.48,radius*.99,30),material(0xa79a74),p.toArray());
    rim.quaternion.setFromUnitVectors(V(0,0,1),tan);rim.material.side=T.DoubleSide;
    const dark=mesh(root,new T.CircleGeometry(radius*.53,26),material(0x514d3e),p.clone().addScaledVector(tan,-.022).toArray());dark.quaternion.copy(rim.quaternion);dark.material.side=T.DoubleSide;
  }
  if(endRadius>.3){
    const p=path.getPointAt(1),tan=path.getTangentAt(1),m=material(0xbca67e);
    const face=mesh(root,new T.CircleGeometry(radius*endRadius*.98,27),m,p.toArray());
    face.quaternion.setFromUnitVectors(V(0,0,1),tan);m.side=T.DoubleSide;
  }
  const crackColor=material(0x77684d);
  for(let k=0;k<5;k++){
    const a=rng()*TAU,start=.09+rng()*.56,length=.055+rng()*.21,pts=[];
    for(let j=0;j<10;j++){
      const t=start+length*j/9,frame=Math.floor(t*N),r=radius*(endRadius+(1-endRadius)*(1-t)**.80)*1.02,ang=a+Math.sin(t*39)*.014;
      pts.push(path.getPointAt(t).addScaledVector(frames.normals[frame],r*Math.cos(ang)).addScaledVector(frames.binormals[frame],r*Math.sin(ang)*.90));
    }
    mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(pts),14,.0028,3,false),crackColor);
  }
}
function layerWall(s,x1,z1,x2,z2){
  const layers=[[-.14,.16,0x9f8d77],[.015,.12,0xd4c5ae],[.13,.12,0x9a8778],[.24,.06,0xc2b9a1],[.29,.19,0xb8aa97],[.47,.12,0x9f9788]];
  const rand=noise(3451),base=sediment(s,true);
  layers.forEach(([y,h,col],level)=>{
    const geo=new T.PlaneGeometry(1,1,68,1),pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){const q=pos.getX(i)+.5,top=pos.getY(i)+.5;
      pos.setXYZ(i,x1+(x2-x1)*q+(rand()-.5)*.015,y+top*h+.042*Math.sin(q*12)+.025*Math.cos(q*25+level*.13),z1+(z2-z1)*q);}
    geo.computeVertexNormals();const m=base.clone();m.color.set(col);m.side=T.DoubleSide;mesh(s.scene,geo,m);
  });
  base.dispose();
}
export function drawIvory(s){
  sceneLights(s,0x76654b,0x81735b);s.fov=32;s.fit=1.72;s.look([0,6.8,8.3],[0,.12,0]);coast(s,-.14,21,sediment(s));
  const look=V(0,.12,0),eye=V(),destLook=V(),destEye=V(),base=V();
  let selected=-1,moving=false,orbitAngle=0;
  function acquire(){
    if(selected>=0)destLook.set(...targets[selected]).multiplyScalar(.63);
    else destLook.set(0,.12,0);
    destEye.copy(base).sub(V(0,.12,0)).applyAxisAngle(up,orbitAngle).multiplyScalar(selected<0?1:.79).add(destLook);
    moving=true;
  }
  const up=V(0,1,0);
  s.compose=aspect=>{
    const portrait=aspect<.88;s.fov=portrait?36:32;s.fit=portrait?.50:1.72;
    base.set(...(portrait?[7.3,7.1,.50]:[0,6.8,8.3]));acquire();
    eye.copy(destEye);look.copy(destLook);s.look(eye.toArray(),look.toArray());moving=false;
  };
  s.step=(dt,reduced)=>{
    if(!moving)return false;
    const factor=reduced?1:1-Math.exp(-dt*8.5);eye.lerp(destEye,factor);look.lerp(destLook,factor);
    s.look(eye.toArray(),look.toArray());moving=eye.distanceToSquared(destEye)>.0001;return true;
  };
  const root=s.scene,rand=noise(279);
  const border=material(0x4d422f);layerWall(s,-6,-2.5,6,-2.5);layerWall(s,-5,2,-5,-2.5);
  const specs=[
    [[[-3.9,.11,.91],[-3.08,.17,.21],[-2.08,.22,-.26],[-1.05,.23,-.59],[-.70,.25,-.81]],.235],
    [[[-3.14,.10,-1.32],[-2.69,.25,-.92],[-2.48,.53,-.13],[-2.02,.34,.62],[-1.56,.25,.84]],.205],
    [[[-1.02,.12,-.98],[-.57,.20,-.5],[.07,.26,-.02],[.62,.18,.22]],.244,.70],
    [[[.83,.16,.29],[1.06,.18,.47],[1.42,.17,.64],[1.78,.23,.65]],.171],
    [[[1.43,.085,-1.3],[2.04,.14,-1.06],[2.58,.14,-.63],[2.88,.13,-.1],[2.99,.09,.65]],.22]
  ];
  specs.forEach(([p,r,tip],i)=>tusk(root,p,r,379+i,true,tip));
  scatter(s,391,[10,5.8],560,-.105,.75);
  const patches=[];for(let i=0;i<65;i++){const x=2.75+rand()*.55,z=-.6+rand()*.96;patches.push([x,-.035+rand()*.065,z,.1+rand()*.12,.045+rand()*.07,.09+rand()*.09,[rand()*.22,rand()*TAU,0]]);}
  instanced(root,new T.DodecahedronGeometry(1,0),material(0x514835),patches);
  // Survey string and its bichrome metric rod remain outside the three relationships.
  for(const x of [-4.3,4.3]){
    cylinder(root,.043,.054,.88,border,[x,.22,-2],9);rod(root,[x,-.03,1.87],[x,.28,-2],.008,material(0xd4c4a4));
  }
  rod(root,[-4.3,.31,-2],[4.3,.31,-2],.008,material(0xcbbea4));
  const targets=[[-2.45,.65,-.12],[.76,.31,.21],[2.85,.37,-.15]];
  const scale=new T.Group(),pale=material(0xe5d9ba),dark=material(0x302c28);
  root.add(scale);scale.visible=false;
  for(let tick=0;tick<10;tick++)mesh(scale,new T.BoxGeometry(.10,.036,.127),tick%2?dark:pale,[(tick-4.5)*.10,0,0]);
  const toe=mesh(scale,new T.ConeGeometry(.06,.13,3),dark,[.55,0,0]);toe.rotation.z=-Math.PI/2;
  const positions=new Map(),ray=new T.Raycaster(),plane=new T.Plane(V(0,1,0),.034);
  const rulerSpot=i=>[targets[i][0],-.034,[1.12,1.03,1.06][i]];
  function layScale(i,screen){
    const reference=rulerSpot(i);let p=V(...reference);
    if(screen){
      ray.setFromCamera(new T.Vector2(screen[0]*2-1,1-screen[1]*2),s.camera);
      if(!ray.ray.intersectPlane(plane,p)||Math.abs(p.x-reference[0])>.60||Math.abs(p.z-reference[2])>.23)return false;
    }
    scale.position.copy(p);scale.visible=true;positions.set(i,p.clone());s.invalidate();return true;
  }
  const light=new T.PointLight(0xffdf9e,0,2,2);root.add(light);
  return {targets,rulerSpot,layScale,orbit(delta){orbitAngle=cap(orbitAngle+delta,-.63,.63);acquire();s.invalidate();},framing(i){
      const center=V(...targets[i]);return positions.has(i)?center.lerp(positions.get(i),.40).toArray():center.toArray();
    },emphasize(i){selected=i;acquire();light.position.set(...targets[i]);light.position.y+=.9;light.intensity=.65;
      scale.visible=positions.has(i);if(scale.visible)scale.position.copy(positions.get(i));s.invalidate();},paper:['#88755a','#493e35'],
    flat(p,w,h,project){p.lineCap='round';specs.forEach(([pts,r])=>{
      p.beginPath();pts.forEach((pt,j)=>{const [x,y]=project(pt);j?p.lineTo(x*w,y*h):p.moveTo(x*w,y*h);});p.lineWidth=Math.max(3,r*h*.11);p.strokeStyle='#d1bf92';p.stroke();
    });if(scale.visible)for(let i=0;i<10;i++){
      const pt=scale.position.clone();pt.x+=(i-4.5)*.10;const [x,y]=project(pt.toArray());p.fillStyle=i%2?'#39332e':'#e6d9bc';p.fillRect(x*w,y*h,Math.max(2,w*.009),Math.max(2,h*.010));
    }}};
}

function metalTexture(s){return surfaceMap(s,'gold-relief');}
function foilShape(){
  const outer=new T.Shape();outer.absarc(0,0,1.5,0,TAU,false);
  const voids=new T.Path();const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
  voids.moveTo(...polar(1.045,0));
  for(let i=0;i<12;i++){
    const a=i*TAU/12;
    voids.bezierCurveTo(...polar(.91,a-.08),...polar(.68,a-.29),...polar(.64,a-.36));
    voids.bezierCurveTo(...polar(.80,a-.08),...polar(.97,a+.29),...polar(1.045,a+TAU/12));
  }
  voids.closePath();outer.holes.push(voids);
  const bird=new T.Path();bird.moveTo(-.94,.93);
  bird.bezierCurveTo(-.77,1.19,-.58,1.31,-.23,1.29);bird.bezierCurveTo(-.18,1.45,-.08,1.42,-.07,1.37);
  bird.bezierCurveTo(-.01,1.32,.05,1.37,.12,1.40);bird.quadraticCurveTo(.16,1.34,.02,1.28);
  bird.quadraticCurveTo(.35,1.41,.56,1.22);bird.lineTo(.91,1.01);bird.lineTo(.58,1.13);bird.lineTo(.84,.92);
  bird.bezierCurveTo(.63,1.01,.54,1.17,.36,1.18);bird.quadraticCurveTo(.07,1.19,-.12,1.13);
  bird.bezierCurveTo(-.46,1.29,-.74,1.11,-.94,.93);bird.closePath();
  for(let i=0;i<4;i++){
    const c=Math.cos(i*TAU/4),s=Math.sin(i*TAU/4),path=new T.Path();
    bird.getPoints(9).forEach(({x,y},j)=>j?path.lineTo(x*c-y*s,y*c+x*s):path.moveTo(x*c-y*s,y*c+x*s));path.closePath();outer.holes.push(path);
  }
  return outer;
}
function foilModel(s,parent,detailed=false){
  const shape=foilShape(),geo=new T.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:2,curveSegments:24});
  const mat=material(0xdcb259,.44,.82);mat.bumpMap=metalTexture(s);mat.bumpScale=.011;
  const foil=new T.Group();parent.add(foil);const proxy=mesh(foil,geo,mat);
  if(detailed&&s.renderer)loadDetailedRelics().then(models=>{
    if(s.gone)return;
    models.sun.traverse(obj=>{
      if(!obj.isMesh)return;
      const source=Array.isArray(obj.material)?obj.material[0]:obj.material;
      if(source.map){
        mat.map=source.map;mat.roughnessMap=source.roughnessMap;
        if(source.bumpMap){mat.bumpMap=source.bumpMap;mat.bumpScale=.019;}
        mat.color.setHex(0xf4e1b5);mat.needsUpdate=true;
      }
      obj.userData.sharedSource=true;obj.material=mat;obj.castShadow=true;obj.receiveShadow=true;
    });foil.add(models.sun);proxy.visible=false;s.invalidate();
  }).catch(()=>{});
  return {foil,mat,shape};
}
function foilDrawing(p,cx,cy,r,shape,color){
  const points=shape.extractPoints(28);p.save();p.translate(cx,cy);p.scale(r/1.5,-r/1.5);p.beginPath();
  [points.shape,...points.holes].forEach(path=>{path.forEach(({x,y},i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();});p.fillStyle=color;p.fill('evenodd');p.restore();
}
export function drawFoil(s){
  s.look([0,0,7.1],[0,0,0]);s.fov=30;s.fit=1.14;s.environment();
  const primary=sceneLights(s,0x17211e,0x252c23,0xffe3a8);s.scene.fog.density=.015;
  s.scene.add(new T.AmbientLight(0x827a64,.6));const root=new T.Group();s.scene.add(root);
  const model=foilModel(s,root,true);s.scene.environmentIntensity=.45;
  const panel=mesh(s.scene,new T.PlaneGeometry(13,8),terrainMaterial(s,0x554e43,'rock_boulder_dry',4),[0,0,-.63]);
  panel.castShadow=false;
  const paper=new T.MeshStandardMaterial({color:0x332e23,emissive:0xffd99a,emissiveIntensity:.05,roughness:.95});
  mesh(root,new T.CircleGeometry(1.63,96),paper,[0,0,-.13]);
  const frame=mesh(root,new T.TorusGeometry(1.65,.021,8,100),material(0x645941,.49,.71),[0,0,-.14]);frame.castShadow=false;
  const ticks=[];
  for(let i=0;i<72;i++){
    const a=i*TAU/72,l=i%6===0?.078:.032;
    ticks.push([Math.sin(a)*1.715,Math.cos(a)*1.715,-.12,.008,l,.008,[0,0,-a]]);
  }
  instanced(root,new T.BoxGeometry(1,1,1),material(0xafa186,.65,.3),ticks);
  const slides=[];
  for(let i=0;i<3;i++){
    const plate=new T.Shape();
    plate.moveTo(-1.04,-.68);plate.lineTo(1.04,-.68);plate.lineTo(1.04,.68);
    if(i===2){plate.lineTo(.32,.68);plate.lineTo(.21,.34);plate.lineTo(.16,.40);plate.lineTo(.073,-.17);plate.lineTo(-.03,.24);plate.lineTo(-.11,.15);plate.lineTo(.01,.68);}
    plate.lineTo(-1.04,.68);plate.closePath();
    if(i===0){const hole=new T.Path();hole.moveTo(-.64,-.26);hole.bezierCurveTo(-.31,.39,.18,.43,.63,.25);hole.quadraticCurveTo(-.19,.23,-.64,-.26);hole.closePath();plate.holes.push(hole);}
    const geo=new T.ExtrudeGeometry(plate,{depth:.024,bevelEnabled:true,bevelThickness:.009,bevelSize:.011,bevelSegments:2,curveSegments:28});
    const m=material(0xd4a853,.40,.64);m.bumpMap=model.mat.bumpMap;m.bumpScale=.006;
    const slide=mesh(root,geo,m,[0,0,.10]);slide.visible=false;
    if(i===1){
      geo.dispose();
      const fold=new T.PlaneGeometry(2.08,1.36,100,36),v=fold.attributes.position;
      for(let j=0;j<v.count;j++){const x=v.getX(j),y=v.getY(j),spine=y*.37+.09*Math.sin(y*4);v.setZ(j,.15*Math.exp(-Math.abs(x-spine)*8));}
      fold.computeVertexNormals();slide.geometry=fold;
    }
    slides.push(slide);
  }
  let level=18,selected=-1;
  function light(value){
    level=value;const amount=value/90;primary.position.set(-6+amount*4,4-amount*3,.85+amount*.7);
    paper.emissiveIntensity=.015+amount**4*1.38;model.mat.color.set(0xad7b2e).lerp(new T.Color(0xa67222),amount);model.mat.roughness=.32+amount*.10;s.invalidate();
  }
  let tilt=0;
  function turn(value){
    tilt=value;
    for(const item of [model.foil,...slides]){item.rotation.y=tilt;item.rotation.x=-tilt*.16;}
    s.invalidate();
  }
  function lamp(fraction){
    const arc=T.MathUtils.lerp(-1.45,.45,fraction);
    light(12+78*fraction);
    primary.position.set(4*Math.sin(arc),1.55,2.8*Math.cos(arc)*(1-2*fraction));
    primary.intensity=3.4-2.72*fraction;s.invalidate();
  }
  return {light,lamp,turn,inspect(index,mode){
    selected=index;model.foil.visible=index<0;slides.forEach((obj,i)=>{obj.visible=i===index;obj.material.color.setHex(mode==='back'?0x584634:0xe8bb69);obj.material.metalness=mode==='back'?.28:.67;});
    light(mode==='back'?90:12);primary.intensity=mode==='back'?.68:3.4;primary.position.set(mode==='edge'?-4:0,1.55,mode==='edge'?1.0:2);
    s.invalidate();
  },paper:['#45493e','#202922'],flat(p,w,h,project){
    const a=project([0,0,0]),b=project([1.5,0,0]),r=(b[0]-a[0])*w;
    p.fillStyle=level>=68?'#e7cf9d':'#695e48';p.beginPath();p.arc(a[0]*w,a[1]*h,r*1.08,0,TAU);p.fill();
    if(selected<0){foilDrawing(p,a[0]*w,a[1]*h,r,model.shape,'#c19b46');return;}
    p.save();p.translate(a[0]*w,a[1]*h);p.scale(r/1.5*Math.cos(tilt),-r/1.5);
    p.fillStyle=level>68?'#554937':'#c3a05f';p.beginPath();p.rect(-1.04,-.68,2.08,1.36);
    if(selected===0){p.moveTo(-.64,-.26);p.bezierCurveTo(-.31,.39,.18,.43,.63,.25);p.quadraticCurveTo(-.19,.23,-.64,-.26);p.closePath();}
    if(selected===2){p.moveTo(.32,.69);p.lineTo(.21,.34);p.lineTo(.16,.4);p.lineTo(.073,-.17);p.lineTo(-.03,.24);p.lineTo(-.11,.15);p.lineTo(.01,.69);p.closePath();}
    p.fill('evenodd');if(selected===1&&level<68){p.strokeStyle='#f1d391';p.lineWidth=.04;p.beginPath();p.moveTo(-.27,-.68);p.lineTo(.27,.68);p.stroke();}
    p.restore();
  }};
}

function excavationCourt(s,final=false){
  const root=s.scene,targets=[],rings=[],flares=[],stumps=[];
  const bank=z=>-3.63+Math.sin(z*.46)*.29+.06*Math.sin(z*1.4);
  const ground=new T.Shape();ground.moveTo(-34,-32);ground.lineTo(34,-32);
  for(let x=34;x>=-34;x-=.5)ground.lineTo(x,-bank(x));
  ground.closePath();
  const dirt=sediment(s);dirt.map?.repeat.set(.36,.36);
  scatter(s,31,[15,6.5],290,-.148,.74);
  let loaded=false;
  const plate=new T.TextureLoader().load('/assets/v10/sanctuary-dawn.webp',()=>{loaded=true;screen.visible=true;s.invalidate();},undefined,()=>{loaded=true;s.invalidate();});
  s.readyView=()=>loaded;
  plate.colorSpace=T.SRGBColorSpace;s.extra.add(plate);
  const fadeCanvas=document.createElement('canvas');fadeCanvas.width=2;fadeCanvas.height=128;const fadePen=fadeCanvas.getContext('2d'),fade=fadePen.createLinearGradient(0,0,0,128);
  fade.addColorStop(0,'black');fade.addColorStop(.23,'white');fade.addColorStop(1,'white');fadePen.fillStyle=fade;fadePen.fillRect(0,0,2,128);
  const feather=new T.CanvasTexture(fadeCanvas);s.extra.add(feather);
  const panoMat=new T.MeshBasicMaterial({map:plate,alphaMap:feather,transparent:true,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false});
  const panoGeo=new T.PlaneGeometry(1,1,62,12),panoVerts=panoGeo.attributes.position;
  for(let i=0;i<panoVerts.count;i++){
    const a=panoVerts.getX(i)*2.6,h=panoVerts.getY(i)*37;
    panoVerts.setXYZ(i,Math.sin(a)*32,h+2.2+Math.max(0,h-8)**2*.14,-Math.cos(a)*32);
  }
  const screen=mesh(root,panoGeo,panoMat);screen.visible=false;screen.castShadow=false;screen.receiveShadow=false;
  const outline=material(0x725d46),soil=material(0x352d26),residue=terrainMaterial(s,0x71604c,'bark_brown_02',1.6);
  function square(path,r,c){
    path.moveTo(-r+c,-r);path.lineTo(r-c,-r);path.quadraticCurveTo(r,-r,r,-r+c);path.lineTo(r,r-c);path.quadraticCurveTo(r,r,r-c,r);
    path.lineTo(-r+c,r);path.quadraticCurveTo(-r,r,-r,r-c);path.lineTo(-r,-r+c);path.quadraticCurveTo(-r,-r,-r+c,-r);path.closePath();return path;
  }
  const rimShape=square(new T.Shape(),.42,.096);rimShape.holes.push(square(new T.Path(),.382,.082));
  const rimGeo=new T.ExtrudeGeometry(rimShape,{depth:.008,bevelThickness:.003,bevelSize:.005,bevelSegments:1,curveSegments:5});
  const pitShape=square(new T.Shape(),.385,.082),pitGeo=new T.ShapeGeometry(pitShape,6),loop=pitShape.getPoints(6);
  const faces=[],verts=[];
  for(const pt of loop){verts.push(pt.x,0,-pt.y,pt.x*.78,-.44,-pt.y*.78);}
  for(let i=0;i<loop.length-1;i++){const j=i*2;faces.push(j,j+1,j+2,j+2,j+1,j+3);}
  const well=new T.BufferGeometry();well.setAttribute('position',new T.Float32BufferAttribute(verts,3));well.setIndex(faces);well.computeVertexNormals();
  const wellMat=material(0x463528);wellMat.side=T.DoubleSide;
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const i=row*3+col,x=(col-1)*2.9,z=(row-1)*1.9;
    targets.push([x,.09,z]);const group=new T.Group();group.position.set(x,-.133,z);root.add(group);
    // The museum describes square posts of about .40 m, set 2.9 × 1.9 m apart.
    const aperture=.55;group.scale.set(aperture,1,aperture);
    const hole=new T.Path();loop.forEach((p,j)=>j?hole.lineTo(x+p.x*aperture,p.y*aperture-z):hole.moveTo(x+p.x*aperture,p.y*aperture-z));hole.closePath();ground.holes.push(hole);
    const lip=mesh(group,rimGeo,outline);lip.rotation.x=-Math.PI/2;
    mesh(group,well,wellMat);
    const pit=mesh(group,pitGeo,soil,[0,-.432,0]);pit.rotation.x=-Math.PI/2;pit.scale.setScalar(.80);
    let stub=null;if(i===2||i===4||i===6){stub=cylinder(group,.12,.15,.19,residue,[.04,-.31,.012],15);stub.rotation.z=.09;}
    const ring=mesh(group,new T.RingGeometry(.48,.501,54),new T.MeshBasicMaterial({color:0xffcd7f,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}),[0,.08,0]);
    ring.rotation.x=-Math.PI/2;ring.castShadow=false;rings.push(ring);
    const glow=mesh(group,new T.CylinderGeometry(.25,.34,.04,24),new T.MeshBasicMaterial({color:[0x9bcfca,0xe49745,0xc1bada][row],transparent:true,opacity:0,depthWrite:false}),[0,.055,0]);
    glow.castShadow=false;flares.push(glow);stumps.push(stub);
  }
  const soilBank=mesh(root,new T.ShapeGeometry(ground,7),dirt,[0,-.137,0]);soilBank.rotation.x=-Math.PI/2;
  const tones=Array(9).fill(-20);
  function strike(index){tones[index]=fieldTime()/1000;}
  s.anim.push(()=>{
    const now=fieldTime()/1000;
    rings.forEach((ring,index)=>{
      const amount=cap((now-tones[index])/1.27);
      ring.scale.setScalar(.8+amount*.99);ring.material.opacity=(1-amount)**1.7*.9;flares[index].material.opacity=(1-amount)**2*.88;
    });
  });
  water(s,[0,-.18,-19.1],plate,74,32);
  reeds(s,848,[[-4.4,-3.3,1.9,66],[4.6,-3.28,2.2,75],[-5.9,1.7,2.4,42],[6.2,.4,1.8,29]],-.17);
  return {targets,strike,tones,plate};
}
export function drawCourt(s){
  s.look([0,4.1,8.9],[0,-.07,-.65]);s.fov=34;s.fit=1.56;
  s.compose=aspect=>{
    const portrait=aspect<.88;s.fit=portrait?1.50:1.56;
    s.look(portrait||aspect>2.3?[0,7.1,5.7]:[0,4.1,8.9],[0,-.07,-.65]);
  };
  sceneLights(s,0x92978b,0x9c9987,0xffce91);sky(s,0x546674,0xd8c6a2,0x8a8976);
  const court=excavationCourt(s);
  const rope=material(0xc6a26c,.96),pin=material(0x614934),tips=material(0xf6ddaf);
  for(const m of [rope,pin,tips])s.extra.add(m);
  let latest=null,cord=null;
  const previewGeometry=new T.BufferGeometry(),previewPoints=new T.Float32BufferAttribute(new Float32Array(6),3);
  previewGeometry.setAttribute('position',previewPoints);
  const thread=new T.Line(previewGeometry,new T.LineBasicMaterial({color:0xffdc8e}));
  thread.frustumCulled=false;thread.visible=false;s.scene.add(thread);
  const ray=new T.Raycaster(),plane=new T.Plane(V(0,1,0),-.19),spot=V();
  function pull(from,u,v){
    if(from===null){thread.visible=false;s.invalidate();return;}
    ray.setFromCamera(new T.Vector2(u*2-1,1-v*2),s.camera);
    if(!ray.ray.intersectPlane(plane,spot))return;
    const start=court.targets[from];
    previewPoints.setXYZ(0,start[0],.19,start[2]);previewPoints.setXYZ(1,spot.x,.19,spot.z);
    previewPoints.needsUpdate=true;thread.visible=true;s.invalidate();
    return Math.hypot(start[0]-spot.x,start[2]-spot.z);
  }
  function baseline(from,to){
    latest=[from,to];
    if(cord){cord.removeFromParent();cord.traverse(o=>o.geometry?.dispose());}
    const start=court.targets[from],end=court.targets[to],a=V(...start),b=V(...end);a.y=b.y=.19;
    cord=new T.Group();s.scene.add(cord);rod(cord,a.toArray(),b.toArray(),.024,rope);
    for(const point of [a,b])cylinder(cord,.045,.052,.43,pin,[point.x,.11,point.z],8);
    const distance=a.distanceTo(b);
    for(let mark=.5;mark<distance;mark+=.5){const p=a.clone().lerp(b,mark/distance);mesh(cord,new T.SphereGeometry(.045,9,6),tips,p.toArray());}
    s.invalidate();
  }
  return {...court,baseline,pull,paper:['#959889','#494c3e'],flat(p,w,h,project){
    court.targets.forEach((v,i)=>{const [x,y]=project(v);p.fillStyle='#352e26';p.beginPath();p.ellipse(w*x,h*y,w*.042,h*.033,0,0,TAU);p.fill();p.lineWidth=3;p.strokeStyle=fieldTime()/1000-court.tones[i]<1.2?'#efcb8a':'#a58a62';p.stroke();});
    if(latest){const [a,b]=latest.map(i=>project(court.targets[i]));p.strokeStyle='#efc78b';p.lineWidth=3;p.beginPath();p.moveTo(a[0]*w,a[1]*h);p.lineTo(b[0]*w,b[1]*h);p.stroke();}
    if(thread.visible){const a=project([previewPoints.getX(0),.19,previewPoints.getZ(0)]),b=project(spot.toArray());p.strokeStyle='#ffe2a3';p.lineWidth=2;p.beginPath();p.moveTo(a[0]*w,a[1]*h);p.lineTo(b[0]*w,b[1]*h);p.stroke();}
  }};
}
function distantBird(s,root){
  const bird=new T.Group(),plumage=material(0x625540,.77,.12),gilt=material(0xa48757,.62,.24);
  const body=mesh(bird,new T.SphereGeometry(1,16,12),plumage);body.scale.set(.13,.115,.34);
  const head=mesh(bird,new T.SphereGeometry(.092,12,8),gilt,[0,.063,.29]);head.scale.z=1.22;
  const bill=mesh(bird,new T.ConeGeometry(.043,.17,8),plumage,[0,.043,.437]);bill.rotation.x=Math.PI/2;
  const mantle=material(0x887552,.71,.20);
  for(const mat of [plumage,mantle])mat.side=T.DoubleSide;
  const tail=new T.Shape();
  tail.moveTo(-.073,0);tail.quadraticCurveTo(-.09,.16,-.126,.38);tail.lineTo(-.035,.34);
  tail.lineTo(0,.40);tail.lineTo(.035,.34);tail.lineTo(.126,.38);tail.quadraticCurveTo(.09,.16,.073,0);tail.closePath();
  const fan=mesh(bird,new T.ShapeGeometry(tail,8),plumage,[0,0,-.19]);fan.rotation.x=-Math.PI/2-.11;
  const joints=[];
  for(const sign of [-1,1]){
    const arm=new T.Group(),wrist=new T.Group();bird.add(arm);arm.add(wrist);arm.position.set(sign*.056,.065,.075);wrist.position.set(sign*.41,0,.03);
    const inner=new T.Shape();inner.moveTo(0,-.12);inner.quadraticCurveTo(sign*.16,-.24,sign*.43,-.14);
    inner.lineTo(sign*.44,.12);inner.quadraticCurveTo(sign*.19,.19,0,.22);inner.closePath();
    mesh(arm,new T.ShapeGeometry(inner,12),mantle).rotation.x=-Math.PI/2;
    // Slotted primaries fold at the wrist as the inner wing takes the load.
    const outer=new T.Shape();outer.moveTo(-sign*.035,-.11);outer.quadraticCurveTo(sign*.27,-.15,sign*.63,.018);
    for(const [x,y] of [[.31,.002],[.59,.112],[.27,.061],[.49,.185],[.23,.123],[.37,.23],[.17,.158],[.25,.251],[.11,.182]]){
      outer.lineTo(sign*x,y);
    }
    outer.quadraticCurveTo(sign*.01,.20,-sign*.04,.125);outer.closePath();
    mesh(wrist,new T.ShapeGeometry(outer,10),plumage).rotation.x=-Math.PI/2;
    joints.push({sign,arm,wrist});
  }
  bird.userData.stroke=(phase,glide)=>{
    const flex=Math.sin(phase),lag=Math.sin(phase-.68);
    for(const {sign,arm,wrist} of joints){
      arm.rotation.z=sign*(.10+(1-glide)*flex*.48);
      wrist.rotation.z=sign*(-.11+(1-glide)*(lag-flex)*.52);
      wrist.rotation.y=sign*(1-glide)*Math.max(0,-lag)*.22;
    }
  };
  root.add(bird);return bird;
}
export function drawFinale(s){
  s.fov=35;s.fit=1.3;const key=sceneLights(s,0x9aada9,0xb1aa96,0xffbf75);
  s.environment();s.scene.environmentIntensity=.40;
  sky(s,0x526d7b,0xf1d4a7,0x7d8c7e);s.scene.fog.density=.028;
  const court=excavationCourt(s,true);
  const columns=new T.Group();s.scene.add(columns);const wood=terrainMaterial(s,0x9b7752,'bark_brown_02',1.8);
  wood.transparent=true;wood.depthWrite=false;wood.opacity=0;
  court.targets.forEach(([x,y,z],i)=>{
    const post=mesh(columns,new T.BoxGeometry(.37,3.8+Math.sin(i)*.17,.37),wood,[x,1.77,z]);post.rotation.z=Math.sin(i)*.009;
  });
  for(let i=0;i<3;i++)rod(columns,[-2.98,3.55,(i-1)*1.9],[2.98,3.55,(i-1)*1.9],.10,wood);
  const orb=new T.Group();s.scene.add(orb);const {shape,mat}=foilModel(s,orb,true);
  mat.metalness=.32;mat.roughness=.38;mat.emissive.set(0x8b5310);mat.emissiveIntensity=.12;
  orb.position.set(3.18,2.85,-4.3);
  const birds=Array.from({length:4},()=>distantBird(s,s.scene));
  const dust=[],rn=noise(3428);
  for(let i=0;i<100;i++)dust.push((rn()-.5)*15,rn()*4,-rn()*10);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(dust,3));
  const specks=new T.Points(geo,new T.PointsMaterial({color:0xf3cf8f,size:.025,transparent:true,opacity:.64,depthWrite:false}));s.scene.add(specks);
  const horizon=[0,7.15,-24.5];
  const disk=mesh(s.scene,new T.CircleGeometry(.48,64),new T.MeshBasicMaterial({color:0xffdf9b,fog:false}),horizon);
  disk.castShadow=false;
  const haloMap=document.createElement('canvas');haloMap.width=haloMap.height=128;const ink=haloMap.getContext('2d'),glow=ink.createRadialGradient(64,64,0,64,64,64);
  glow.addColorStop(0,'rgba(255,205,116,.65)');glow.addColorStop(.26,'rgba(255,192,97,.30)');glow.addColorStop(1,'rgba(255,174,83,0)');ink.fillStyle=glow;ink.fillRect(0,0,128,128);
  const haloTex=new T.CanvasTexture(haloMap);haloTex.colorSpace=T.SRGBColorSpace;s.extra.add(haloTex);
  const halo=new T.Sprite(new T.SpriteMaterial({map:haloTex,depthWrite:false,transparent:true,blending:T.AdditiveBlending}));halo.scale.set(5.5,5.5,1);disk.add(halo);
  const sights=new T.Group();s.scene.add(sights);
  const guideMat=terrainMaterial(s,0xa89976,'bark_brown_02',1.4);
  for(const z of [-1.9,1.9]){
    const height=.97+(5.85-z)*(horizon[1]-.97)/(5.85-horizon[2])-.10;
    rod(sights,[0,-.08,z],[0,height,z],.032,guideMat);
    rod(sights,[-.13,height+.10,z],[0,height-.02,z],.017,guideMat);rod(sights,[0,height-.02,z],[.13,height+.10,z],.017,guideMat);
  }
  // A physical exhibit beyond the river set provides a matched cut from the
  // four birds in the sky to one conserved object under a modern display lamp.
  const gallery=new T.Group();gallery.position.set(65,0,0);s.scene.add(gallery);
  const basalt=material(0x1d292a,.77),velvet=material(0x182425,.95),brass=material(0x9b7c48,.45,.57);
  mesh(gallery,new T.BoxGeometry(48,20,.4),basalt,[0,3,-3]);mesh(gallery,new T.BoxGeometry(32,.3,28),basalt,[0,-.2,0]);
  instanced(gallery,new T.BoxGeometry(1,1,1),velvet,Array.from({length:53},(_,i)=>[-10+i*.4,3,-2.73,.075,8,.07]));
  const plinth=mesh(gallery,new T.BoxGeometry(4.12,.65,1.58),basalt,[1.15,.28,-.35]);plinth.receiveShadow=true;
  mesh(gallery,new T.BoxGeometry(4.09,.033,1.62),brass,[1.15,.60,-.35]);
  const ringMount=mesh(gallery,new T.CylinderGeometry(1.7,1.7,.17,80),velvet,[1.15,2.38,-.85]);ringMount.rotation.x=Math.PI/2;
  const exhibit=foilModel(s,gallery,true);exhibit.foil.position.set(1.15,2.38,-.67);exhibit.mat.color.setHex(0xcda74e);exhibit.mat.metalness=.47;exhibit.mat.roughness=.36;
  for(const x of [-.20,2.5])rod(gallery,[x,.64,-.76],[x,1.57,-.75],.023,brass);
  rod(gallery,[-.2,1.46,-.75],[2.5,1.46,-.75],.018,brass);
  const lamplight=new T.SpotLight(0xffe4aa,62,14,.58,.6,2);lamplight.position.set(2.4,6.0,1.15);lamplight.target.position.set(1.15,2.3,-.75);gallery.add(lamplight,lamplight.target);
  const innerLamp=material(0xf3c783);innerLamp.emissive.setHex(0xe0a04f);innerLamp.emissiveIntensity=.5;
  mesh(gallery,new T.BoxGeometry(6.1,.024,.18),innerLamp,[1.3,4.9,-2.47]);gallery.visible=false;
  function sight(offset){
    current=-1;gallery.visible=columns.visible=orb.visible=false;birds.forEach(bird=>bird.visible=false);
    sights.visible=true;disk.position.y=horizon[1];s.look([offset,.97,5.85],[offset,horizon[1],horizon[2]]);key.intensity=1.73;s.invalidate();
  }
  let current=0;
  function seek(time,reduced){
    current=time;const t=cap(time,0,28),smooth=n=>{const a=cap(n);return a*a*(3-2*a);};
    const a=smooth((t-.5)/13),b=smooth((t-10)/9),c=smooth((t-15)/5);
    gallery.visible=t>=14.8;
    if(gallery.visible){
      const advance=reduced?1:smooth((t-14.8)/4.9);
      const center=s.aspect<.88?66.08:65.03;
      s.look([center+.12*advance,2.48+.16*advance,6.42-.85*advance],[center,2.28,-.68]);s.scene.fog.density=.008;
    }else if(reduced)s.look([1.8,2.15,8.1],[.5,2.34,-3.1]);
    else{
      const shift=smooth(t/4.8);
      s.look([a*3.12,.97+a*1.7,5.85+a*2.3],[a*.75,horizon[1]*(1-shift)+(1.18+a*.90)*shift,horizon[2]*(1-shift)+(-5.5+a*3)*shift]);
    }
    sights.visible=t<4.8;disk.position.y=horizon[1]+smooth(t/9)*1.6;key.intensity=1.73+smooth(t/7)*1.43;
    wood.opacity=.65*smooth((t-4.2)/3)*(1-smooth((t-11)/4));columns.visible=wood.opacity>.02;
    orb.visible=b>.003;orb.scale.setScalar(.68+.28*b);orb.rotation.y=(1-b)*.92-.13+c*.09;orb.position.y=2.54+b*.5;
    if(!reduced)specks.rotation.y=Math.sin(t*.09)*.092;
    birds.forEach((bird,i)=>{
      const angle=t*(reduced?0:.22)+i*TAU/4;
      bird.visible=t>8;bird.scale.setScalar(.36+.09*Math.cos(angle));bird.position.set(Math.cos(angle)*2.8+.4,2.48+Math.sin(angle*.79+i)*.41,-6.4+Math.sin(angle)*1.07);
      bird.rotation.set(-.08,-angle,.14*Math.sin(angle*2));
      bird.userData.stroke(reduced?0:t*5.1+i*1.7,reduced?1:.5+.48*Math.sin(t*.81+i));
    });
  }
  sight(0);
  return {seek,sight,horizon,paper:['#b5c1b9','#696d53'],flat(p,w,h){
    if(current>=14.8){const grad=p.createRadialGradient(w*.64,h*.42,8,w*.64,h*.42,w*.72);grad.addColorStop(0,'#514434');grad.addColorStop(.62,'#202b28');grad.addColorStop(1,'#0e1819');p.fillStyle=grad;p.fillRect(0,0,w,h);
      p.fillStyle='#353e35';p.fillRect(w*.48,h*.75,w*.37,h*.08);foilDrawing(p,w*.66,h*.44,Math.min(w,h)*.27,shape,'#dbb46a');return;}
    const img=court.plate.image;
    if(img?.width){const scale=Math.max(w/img.width,h/img.height);p.drawImage(img,(w-img.width*scale)/2,(h-img.height*scale)/2,img.width*scale,img.height*scale);}
    else {const grad=p.createLinearGradient(0,h*.46,0,h);grad.addColorStop(0,'#9fa68e');grad.addColorStop(1,'#525643');p.fillStyle=grad;p.fillRect(0,h*.47,w,h);}
    if(current<0){const center=V(...horizon).project(s.camera);p.beginPath();p.arc((center.x+1)*w/2,(1-center.y)*h/2,h*.025,0,TAU);p.fillStyle='#ffe5a7';p.fill();}
    if(current>9)foilDrawing(p,w*.69,h*.31,Math.min(w,h)*.17,shape,'#d0a659');
  }};
}

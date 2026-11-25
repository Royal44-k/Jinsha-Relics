import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ground,riverWidth,riverX} from './geography.js';

const TAU=Math.PI*2;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const shore=(z,side,inset=1.2)=>riverX(z)+side*(riverWidth(z)+inset);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>t*t*(3-2*t);
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const patches=[
  {x:-14.15,z:36.5,kind:'wood',name:'探方外的倒木根盘'},
  {x:shore(26,-1),z:26,kind:'water',name:'浅湾白鹭'},
  {x:18.4,z:7.7,kind:'work',name:'治玉棚背阴坡'},
  {x:22.6,z:-16.4,kind:'wood',name:'陶作场外的腐殖层'},
  {x:shore(-28,-1),z:-28,kind:'water',name:'水线蜻蜓'},
  {x:-18.8,z:-37.2,kind:'work',name:'祭祀区外缘'},
  {x:shore(-52,1),z:-52,kind:'water',name:'芦苇浅汊'},
  {x:18.4,z:-59.4,kind:'wood',name:'九柱外缘的林下根株'}
];

function mesh(parent,geometry,mat,x=0,y=0,z=0){
  const obj=new T.Mesh(geometry,mat);obj.position.set(x,y,z);obj.receiveShadow=true;parent.add(obj);return obj;
}
function mat(color,roughness=.88){return new T.MeshStandardMaterial({color,roughness});}
function instanced(parent,geometry,material,poses){
  const obj=new T.InstancedMesh(geometry,material,poses.length),dummy=new T.Object3D();
  poses.forEach(([x,y,z,sx,sy,sz,rx,ry,rz],i)=>{
    dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);
    dummy.updateMatrix();obj.setMatrixAt(i,dummy.matrix);
  });
  obj.computeBoundingSphere();obj.receiveShadow=true;parent.add(obj);return obj;
}
function bladeShape(sign){
  const shape=new T.Shape();
  shape.moveTo(0,0);shape.quadraticCurveTo(.25*sign,.20,.43*sign,.28);
  shape.quadraticCurveTo(.62*sign,.22,.85*sign,.13);
  for(const [tip,edge] of [[.72,.14],[.65,.08],[.57,.04],[.47,.01]]){shape.lineTo(tip*sign,edge-.085);shape.lineTo((tip-.045)*sign,edge);}
  shape.quadraticCurveTo(.21*sign,-.15,0,-.14);shape.closePath();
  const geometry=new T.ShapeGeometry(shape,5);geometry.rotateX(Math.PI/2);return geometry;
}
function riverBird(parent,assets,phase){
  const g=new T.Group(),body=new T.Group(),wings=[];g.add(body);parent.add(g);
  const pearl=assets.plume,ink=assets.charcoal,reed=assets.reed;
  const belly=mesh(body,assets.ellipsoid,pearl,0,.29,0);belly.scale.set(.105,.145,.29);belly.rotation.x=-.19;
  const neck=new T.CatmullRomCurve3([V(0,.35,.11),V(-.005,.41,.23),V(.005,.48,.16),V(0,.58,.13),V(0,.65,.22)]);
  mesh(body,new T.TubeGeometry(neck,13,.040,6,false),pearl);
  const head=mesh(body,assets.ellipsoid,pearl,0,.665,.225);head.scale.set(.060,.065,.094);
  const beak=mesh(body,new T.ConeGeometry(.035,.23,7),ink,0,.653,.406);beak.rotation.x=Math.PI/2;
  for(const sign of [-1,1]){
    const eye=mesh(body,assets.ellipsoid,ink,sign*.054,.685,.253);eye.scale.setScalar(.013);
    const wing=mesh(body,assets.birdWings[sign<0?0:1],pearl,sign*.036,.38,.055);wings.push(wing);
  }
  const legs=new T.Group();g.add(legs);
  for(const sign of [-1,1]){
    mesh(legs,assets.leg,reed,sign*.034,.126,-.028).rotation.x=sign*.08;
    const toes=mesh(legs,assets.ellipsoid,reed,sign*.034,.012,.001);toes.scale.set(.023,.012,.075);
  }
  const rng=random(641+phase);
  const yaw=.4+rng()*.8;
  let last=-15,wasNear=false;
  return function animate(time,player,home){
    const x=home.x,z=home.z;
    const y=Math.max(-.065,ground(x,z)),dx=player.x-x,dz=player.z-z;
    const near=dx*dx+dz*dz<11.6&&Math.abs(player.y-y)<2.9;
    if(near&&!wasNear&&time-last>8.5)last=time;
    wasNear=near;const t=(time-last)/7.25,flight=t>=0&&t<=1;
    const lift=flight?Math.sin(Math.PI*t):0,a=flight?t*TAU:0;
    const slide=flight?Math.sin(a)*2.8:0,back=flight?-(1-Math.cos(a))*1.55:0;
    g.position.set(x+slide,y+lift*1.74,z+back);
    g.rotation.y=yaw+(flight?Math.sin(a)*.65:Math.sin(time*.28+phase)*.12);
    const opening=smooth(clamp(lift*3.5,0,1)),flap=Math.sin(time*17+phase);
    wings.forEach((wing,i)=>{
      const sign=i===0?-1:1;
      wing.rotation.set(.03,sign*(1-opening)*1.32,sign*(-.13+opening*(.17+flap*.57)),'YXZ');
      wing.scale.x=.48+opening*.52;
    });
    legs.rotation.x=opening*.98;body.rotation.x=(flight?-.12:0)+Math.sin(time*.95+phase)*.023;
  };
}
function dragonflies(parent,assets,seed){
  const rng=random(seed),group=new T.Group();parent.add(group);
  const insects=Array.from({length:3},(_,i)=>{
    const g=new T.Group(),wingSet=new T.Group();g.add(wingSet);group.add(g);
    const tail=mesh(g,assets.insectTail,assets.dragon,0,0,-.038);tail.rotation.x=Math.PI/2;
    const head=mesh(g,assets.ellipsoid,assets.dragon,0,.008,.055);head.scale.set(.025,.019,.023);
    for(const row of [0,1])for(const sign of [-1,1]){
      const wing=mesh(wingSet,assets.insectWing,assets.glass,sign*(row?.077:.089),.012,row?-.031:.014);
      wing.rotation.set(-Math.PI/2,sign*.08,sign*(row?.25:-.11));wing.scale.set(row?.136:.155,row?.046:.038,1);
    }
    return {g,wingSet,x:(i-1)*.60,z:(rng()-.5)*.61,h:.5+rng()*.43,phase:rng()*TAU};
  });
  let flee=0,lastTime=0;
  return function animate(time,player,site){
    const d=(player.x-site.x)**2+(player.z-site.z)**2;
    const dt=clamp(time-lastTime,0,.15);lastTime=time;
    flee+=((d<4&&Math.abs(player.y-ground(site.x,site.z))<2.3?1:0)-flee)*(1-Math.exp(-dt*4));
    for(const {g,wingSet,x,z,h,phase} of insects){
      const ix=site.x+x+.55*Math.sin(time*.77+phase)+flee*.62;
      const iz=site.z+z+.36*Math.cos(time*.84+phase)-flee*.94;
      g.position.set(ix,Math.max(.13,ground(ix,iz))+h+.08*Math.sin(time*2.3+phase)+.34*flee,iz);
      g.rotation.y=Math.atan2(.55*.77*Math.cos(time*.77+phase),-.36*.84*Math.sin(time*.84+phase));
      wingSet.rotation.z=Math.sin(time*37+phase)*.14;
    }
  };
}
function plantLeaves(materials,rng,parent,x,z){
  const poses=[];
  for(let i=0;i<16;i++){
    const angle=rng()*TAU,dist=.25+rng()*1.25,xx=x+Math.cos(angle)*dist,zz=z+Math.sin(angle)*dist;
    const rise=.04+rng()*.12;
    poses.push([xx,ground(xx,zz)+rise,zz,.13+rng()*.13,.26+rng()*.23,1,-1.12+rng()*.17,angle,rng()*.35]);
  }
  instanced(parent,materials.leafGeo,materials.leaf,poses);
}
function release(graphs){
  const geometry=new Set(),material=new Set(),textures=new Set();
  for(const graph of graphs)graph.traverse(obj=>{
    if(obj.isInstancedMesh)obj.dispose();
    if(obj.geometry)geometry.add(obj.geometry);
    for(const mat of [].concat(obj.material||[])){material.add(mat);for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);}
  });
  geometry.forEach(g=>g.dispose());material.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}

export function createRiverHabitat(scene,world){
  const root=new T.Group();root.name='金沙 · 岸边微生境';scene.add(root);
  const loader=new GLTFLoader(),textures=new T.TextureLoader(),sources=[];
  const assets={
    leaf:mat(0xb4bb8c),leafGeo:new T.PlaneGeometry(1,1,1,2),stone:mat(0x9c9d89),stoneGeo:new T.IcosahedronGeometry(1,1),
    plume:mat(0xe0dcd0),charcoal:mat(0x3d463b),reed:mat(0x81804f),dragon:mat(0x38787a,.54),
    glass:new T.MeshStandardMaterial({color:0xc8d6c7,roughness:.35,metalness:.12,transparent:true,opacity:.47,side:T.DoubleSide,depthWrite:false}),
    ellipsoid:new T.SphereGeometry(1,9,6),birdWings:[bladeShape(-1),bladeShape(1)],leg:new T.CylinderGeometry(.009,.009,.25,5),
    insectWing:new T.CircleGeometry(1,9),insectTail:new T.CylinderGeometry(.008,.015,.142,6)
  };
  assets.plume.side=T.DoubleSide;assets.leaf.side=T.DoubleSide;assets.leaf.alphaTest=.48;assets.leaf.roughness=.9;
  function map(path,color){
    const tex=textures.load(path);if(color)tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=2;return tex;
  }
  assets.leaf.map=map('/assets/v6/canopy/island-leaf-color.webp',true);assets.leaf.normalMap=map('/assets/v6/canopy/island-leaf-normal.webp',false);assets.leaf.normalScale.set(.34,.34);
  assets.stone.map=map('/assets/environment/rock_boulder_dry_diff_1k.webp',true);
  const loaderJobs=new Map();let disposed=false;
  function scan(id){
    if(loaderJobs.has(id))return loaderJobs.get(id);
    const url=id==='fern'?'/assets/v5/fern_02/fern_02.gltf':'/assets/v10/tree-root-lod.gltf';
    const task=loader.loadAsync(url).then(gltf=>{
      if(disposed){release([gltf.scene]);return [];}
      sources.push(gltf.scene);const found=[];
      gltf.scene.traverse(o=>{
        if(!o.isMesh)return;
        const tris=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;
        if(id==='fern'&&tris>850)return;
        found.push(o);
      });
      return found;
    }).catch(()=>[]);
    loaderJobs.set(id,task);return task;
  }
  const neighborhoods=patches.map((site,i)=>{
    const block=new T.Group();block.name=site.name;block.visible=false;root.add(block);
    const rng=random(8405+i*753),poses=[];
    for(let k=0;k<(site.kind==='work'?7:4);k++){
      const a=rng()*TAU,d=.51+rng()*1.31,x=site.x+Math.sin(a)*d,z=site.z+Math.cos(a)*d,r=.08+rng()*.23;
      poses.push([x,ground(x,z)+r*.10,z,r*1.5,r*.64,r,(rng()-.5)*.31,a,(rng()-.5)*.17]);
    }
    instanced(block,assets.stoneGeo,assets.stone,poses);plantLeaves(assets,rng,block,site.x,site.z);
    let animate=()=>{};
    if(site.kind==='water'){
      const flyers=dragonflies(block,assets,680+i);
      const egret=riverBird(block,assets,i);const z=site.z+.8;
      const birdHome={x:shore(z,site.x<riverX(site.z)?-1:1,.40),z};
      animate=(t,p)=>{flyers(t,p,site);egret(t,p,birdHome);};
    }
    let ready;
    function populate(){
      if(ready)return ready;
      const fern=scan('fern').then(models=>{
        if(disposed||!models.length)return;
        for(let j=0;j<(site.kind==='work'?3:4);j++){
          const a=j*TAU/4+.33*rng(),d=.57+rng()*.88,x=site.x+Math.sin(a)*d,z=site.z+Math.cos(a)*d;
          const scan=models[j%models.length],plant=mesh(block,scan.geometry,scan.material,x,ground(x,z)-.025,z);
          plant.rotation.y=a;plant.scale.setScalar(.82+rng()*.85);
        }
      });
      const stump=site.kind==='wood'&&scan('stump').then(([sample])=>{
        if(disposed||!sample)return;
        const stump=mesh(block,sample.geometry,sample.material,site.x,ground(site.x,site.z)+.07,site.z);
        stump.rotation.y=.4+i*1.7;stump.scale.setScalar(i===0?1.66:1.28);
        if(world){
          // Sample the visible scan in its own transform. The spaces between
          // roots remain walkable, unlike a single bounding cylinder.
          stump.updateMatrixWorld(true);
          const p=V(),cells=new Map(),size=.32,positions=sample.geometry.attributes.position;
          for(let v=0;v<positions.count;v++){
            p.fromBufferAttribute(positions,v).applyMatrix4(stump.matrixWorld);
            const x=Math.floor(p.x/size),z=Math.floor(p.z/size),id=x+','+z;
            if(!cells.has(id)||cells.get(id).top<p.y)cells.set(id,{x:(x+.5)*size,z:(z+.5)*size,top:p.y});
          }
          for(const {x,z,top} of cells.values()){
            const y=ground(x,z)-.035;
            if(top>y+.16)world.colliders.push({x,z,y,height:top-y,halfX:size/2,halfZ:size/2,hint:'这里露着老树根。沿根盘外缘绕行，或跳过较低的侧根。'});
          }
          world.invalidateSolids?.();
        }
      });
      ready=Promise.all([fern,stump]);return ready;
    }
    return {site,block,populate,animate,dist:Infinity};
  });
  const active=[],last=V(Infinity,Infinity,Infinity);
  function update(time,player){
    const p=player?.position||player;if(disposed||!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return;
    if(Math.abs(p.x-last.x)+Math.abs(p.z-last.z)>.48){
      last.set(p.x,p.y,p.z);active.length=0;
      for(const n of neighborhoods){n.dist=(p.x-n.site.x)**2+(p.z-n.site.z)**2;if(n.dist<20**2)active.push(n);}
      active.sort((a,b)=>a.dist-b.dist);active.length=Math.min(2,active.length);
      for(const n of neighborhoods){n.block.visible=active.includes(n);if(n.block.visible)n.populate();}
    }
    for(const n of active)n.animate(time,p);
  }
  function dispose(){
    if(disposed)return;disposed=true;root.removeFromParent();release([root,...sources]);
    active.length=0;sources.length=0;loaderJobs.clear();
  }
  function prime(time,player){
    update(time,player);
    return Promise.all(active.map(n=>n.populate()));
  }
  return {update,prime,dispose};
}

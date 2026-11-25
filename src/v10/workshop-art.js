import * as T from 'three';
import {bowl,material,mesh,ring,rod,vector,workshopSurface} from './workshop-scene.js';

const TAU=Math.PI*2;
const block=(p,x,y,z,w,h,d,s)=>mesh(p,new T.BoxGeometry(w,h,d),s,x,y,z);
const cyl=(p,x,y,z,r,h,s)=>mesh(p,new T.CylinderGeometry(r,r,h,48),s,x,y,z);

function ellipse(parent,x,y,z,rx,ry,rz,surface) {
  const item=mesh(parent,new T.SphereGeometry(1,32,20),surface,x,y,z);
  item.scale.set(rx,ry,rz);return item;
}

function plankBench(parent,wood,base) {
  for(let i=-3;i<=3;i++)block(parent,0,-.24,i*1.08,14,.47,1.07,wood);
  block(parent,0,-.56,0,13.8,.35,7.6,base);
}

function wovenMat(parent,x,y,z,w,d,linen){
  block(parent,x,y,z,w,.045,d,linen);
  const cord=material(0x6e6348);
  for(const side of [-1,1]) {
    rod(parent,vector(x-w/2,y+.024,z+side*(d/2-.12)),vector(x+w/2,y+.024,z+side*(d/2-.12)),.015,cord,6);
    rod(parent,vector(x+side*(w/2-.12),y+.024,z-d/2),vector(x+side*(w/2-.12),y+.024,z+d/2),.015,cord,6);
  }
}

function chippedHalf(parent,flip,surface) {
  const shape=new T.Shape();
  const pts=flip?[[.012,-.72],[.32,-.76],[.56,-.72],[.96,-.77],[1.20,-.65],[1.39,-.46],[1.45,-.22],[1.37,-.02],[1.39,.24],[1.24,.47],[1.18,.62],[.82,.67],[.42,.78],[.012,.68]]:
    [[.012,-.72],[.26,-.77],[.49,-.85],[.88,-.73],[1.20,-.68],[1.34,-.48],[1.40,-.21],[1.36,.01],[1.42,.19],[1.29,.43],[1.05,.54],[.91,.71],[.51,.75],[.28,.81],[.012,.68]];
  pts.forEach(([x,y],i)=>shape[i?'lineTo':'moveTo'](flip?-x:x,y));shape.closePath();
  const stone=mesh(parent,new T.ExtrudeGeometry(shape,{depth:.62,bevelEnabled:true,bevelSegments:4,steps:1,bevelThickness:.095,bevelSize:.07,curveSegments:16}),surface,0,.74,0);
  stone.rotation.x=Math.PI/2;return stone;
}

function jadeTemplate(parent,surface){
  const shell=new T.Shape(),a0=-.08*Math.PI,a1=1.11*Math.PI,r=.834;
  shell.absarc(0,0,r+.044,a0,a1,false);
  shell.absarc(0,0,r-.044,a1,a0,true);shell.closePath();
  const arc=mesh(parent,new T.ExtrudeGeometry(shell,{depth:.032,bevelEnabled:true,bevelSize:.011,bevelThickness:.008,bevelSegments:2,curveSegments:36}),surface);
  arc.rotation.x=-Math.PI/2;
  return arc;
}

export function jadeBench(scene) {
  const wood=workshopSurface('wood',scene),jade=workshopSurface('jade',scene),stone=workshopSurface('stone',scene),linen=workshopSurface('linen',scene);
  plankBench(scene,wood,material(0x322b23));
  wovenMat(scene,0,.025,0,5.65,3.45,linen);
  stone.color.set(0xb1ab96);
  const outline=new T.Shape();
  [[-1.93,-.85],[-1.76,-1.15],[-.91,-1.21],[.05,-1.16],[1.21,-1.21],[1.88,-.94],[1.98,-.49],[1.87,.78],[1.54,1.16],[.10,1.2],[-1.36,1.08],[-1.96,.70]].forEach(([x,z],i)=>outline[i?'lineTo':'moveTo'](x,z));
  outline.closePath();
  const slab=mesh(scene,new T.ExtrudeGeometry(outline,{depth:.17,bevelEnabled:true,bevelSegments:3,bevelThickness:.038,bevelSize:.046}),stone,0,.276,0);
  slab.rotation.x=Math.PI/2;
  slab.rotation.y=-.02;
  const blank=new T.Group();blank.position.y=.30;scene.add(blank);
  const left=chippedHalf(blank,true,jade),right=chippedHalf(blank,false,jade);
  const woodHandle=wood, cord=material(0x867555,{roughness:.93});
  const tool=new T.Group();tool.rotation.y=Math.PI/2;scene.add(tool);
  rod(tool,vector(-1.65,0,0),vector(1.65,0,0),.014,cord);
  for(const strand of [0,Math.PI]){
    const path=[];
    for(let i=0;i<=230;i++){
      const t=i/230,a=t*67*Math.PI+strand;
      path.push(vector(t*3.26-1.63,.010*Math.cos(a),.010*Math.sin(a)));
    }
    mesh(tool,new T.TubeGeometry(new T.CatmullRomCurve3(path),230,.008,4,false),material(strand?0x75664b:0xc4b082));
  }
  for(const sign of [-1,1]){
    const h=ellipse(tool,sign*1.68,.02,0,.22,.10,.17,woodHandle);
    h.rotation.y=sign*.4;
    for(let i=0;i<4;i++){
      const thread=ring(tool,.103,.012,cord,sign*(1.60+i*.036),.01,0);
      thread.rotation.set(0,Math.PI/2,0);thread.scale.y=1.4;
    }
  }
  const clay=workshopSurface('clay',scene);
  bowl(scene,[[.1,0],[.28,.04],[.47,.35],[.45,.38],[.40,.34],[.24,.06],[0,.055]],clay,2.0,.03,-1.45);
  const water=new T.MeshPhysicalMaterial({color:0x476159,transparent:true,opacity:.58,roughness:.16,metalness:.13,clearcoat:1,clearcoatRoughness:.13});
  const waterSurface=cyl(scene,2,.30,-1.45,.405,.015,water);
  const ripple=ring(scene,.20,.005,material(0xcee1bd,{transparent:true,opacity:.17}),2,.315,-1.45);
  const drops=new T.Group();scene.add(drops);
  const droplets=Array.from({length:7},(_,i)=>ellipse(drops,0,0,0,.022+i%3*.005,.031+i%2*.009,.022,water));
  drops.visible=false;
  function pour(phase){
    drops.visible=phase>0&&phase<1;
    droplets.forEach((drop,i)=>{
      const t=Math.max(0,Math.min(1,(phase-i*.043)/.74));
      drop.visible=t>0&&t<1;
      drop.position.set(2*(1-t),.32+.83*t+2.75*t*(1-t),-1.45*(1-t)+(i-3)*.024);
    });
    ripple.scale.setScalar(.29+phase*1.55);
    ripple.material.opacity=.22*(1-phase);
  }
  // Sand, water scoop and the notched sticks make the working scale visible.
  const grains=new T.InstancedMesh(new T.IcosahedronGeometry(.032,0),material(0xc4b082),95);
  const dummy=new T.Object3D();
  for(let i=0;i<95;i++){
    const a=i*2.4,r=.49*Math.sqrt((i+.5)/95);
    dummy.position.set(-2.05+Math.cos(a)*r,.086+.08*(1-r*2),-.68+Math.sin(a)*r*.7);
    dummy.scale.setScalar(.55+(i%7)*.12);dummy.rotation.set(a,.13*i,0);dummy.updateMatrix();grains.setMatrixAt(i,dummy.matrix);
  }scene.add(grains);
  rod(scene,vector(1.74,.17,.95),vector(2.55,.14,.25),.041,wood);
  ellipse(scene,1.74,.16,.95,.16,.04,.20,wood);
  const cut=block(scene,0,1.105,0,.025,.012,1.42,material(0x15201b));cut.visible=false;
  const template=new T.Group();scene.add(template);template.position.set(.12,1.25,.08);
  const templateJade=jadeTemplate(template,jade);templateJade.rotation.z=-.17;
  function update(travel,depth,moisture,phase){
    tool.position.set(0,1.17-depth*.65,travel*.43);
    cut.visible=depth>.01;cut.scale.x=.5+depth*2.4;
    jade.roughness=.26+(1-moisture)*.39;
    left.position.x=-phase*.17;right.position.x=phase*.27;
    right.rotation.z=phase*.1;
    ripple.scale.setScalar(.72+Math.sin(phase*7)*.15);
    waterSurface.material.roughness=.18;
    template.visible=phase>.42;
    template.scale.setScalar(.78*Math.max(0,(phase-.42)/.58));
  }
  update(0,0,.84,0);
  const scars=new T.Group();blank.add(scars);scars.visible=false;
  const groovePoints=[];
  for(let band=0;band<18;band++){
    const y=.18+band*.027;
    for(let segment=0;segment<12;segment++){
      for(const j of [segment,segment+1]){
        const z=-.53+j*.085+.012*Math.sin(band);
        groovePoints.push(.052,y+.016*Math.cos(z*3+band*.3),z);
      }
    }
  }
  const lines=new T.BufferGeometry();
  lines.setAttribute('position',new T.Float32BufferAttribute(groovePoints,3));
  scars.add(new T.LineSegments(lines,new T.LineBasicMaterial({color:0x4b6b55,transparent:true,opacity:.74})));
  function inspect(angle){
    scars.visible=true;tool.visible=right.visible=template.visible=cut.visible=false;
    left.position.x=0;blank.rotation.y=angle;blank.position.x=.48;blank.position.y=.48;
    jade.roughness=.43;
  }
  return {update,pour,inspect};
}

// Front-wall pieces share the same broken cross sections. Their cross section
// includes the exposed clay core, so the fracture stays visible from above.
const profile=[[0,.44],[.16,.61],[.37,.91],[.51,1.04],[.66,1.03],[.82,.86],[.91,.76],[1,.83]];
const height=2.15;
function radius(v){
  for(let i=1;i<profile.length;i++)if(v<=profile[i][0]){
    const [a,r]=profile[i-1],[b,s]=profile[i];return T.MathUtils.lerp(r,s,(v-a)/(b-a));
  }return .83;
}
function seam(index,u){
  if(index===0)return 0;if(index===3)return 1;
  return [0,.36,.73,1][index]+.036*Math.sin(u*9+index)+.026*Math.sin(u*21-index);
}
function shardGeometry(section,back=false) {
  const pos=[],uv=[],indices=[],colors=[];
  function point(a,v,r,grain){
    pos.push(Math.sin(a)*r,v*height,Math.cos(a)*r);
    uv.push((a+Math.PI)/TAU*2.4,v*1.4);
    colors.push(grain,grain*.98,grain*.94);
  }
  const cols=42,rows=12,a0=back?1.38:-1.38,a1=back?TAU-1.38:1.38;
  const vAt=(u,v)=>back?v:T.MathUtils.lerp(seam(section,u),seam(section+1,u),v);
  function grid(width,depth,add,reverse=false){
    const start=pos.length/3;
    for(let y=0;y<=depth;y++)for(let x=0;x<=width;x++)add(x/width,y/depth);
    for(let y=0;y<depth;y++)for(let x=0;x<width;x++){
      const a=start+y*(width+1)+x,b=a+1,c=a+width+1,d=c+1;
      indices.push(...(reverse?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
    }
  }
  for(const inner of [false,true]){
    grid(cols,rows,(u,v)=>{
      const t=vAt(u,v),a=T.MathUtils.lerp(a0,a1,u),incision=.009*Math.sin(t*280);
      point(a,t,radius(t)-(inner?.077:0)+incision,inner?.72:1);
    },inner);
  }
  for(const top of [false,true])grid(cols,1,(u,v)=>{
    const t=vAt(u,top?1:0);point(T.MathUtils.lerp(a0,a1,u),t,radius(t)-v*.077,.83+Math.sin(u*350)*.07);
  },!top);
  for(const side of [false,true])grid(rows,1,(v,w)=>{
    const t=vAt(side?1:0,v);point(side?a1:a0,t,radius(t)-w*.077,.85);
  },side);
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

export function clayBench(scene){
  const wood=workshopSurface('wood',scene),linen=workshopSurface('linen',scene),clay=workshopSurface('clay',scene),stone=workshopSurface('stone',scene);
  clay.vertexColors=true;clay.side=T.DoubleSide;
  new T.TextureLoader().load('/assets/v10/workshop/kiln-room.webp',map=>{
    if(scene.userData.studioClosed){map.dispose();return;}
    map.colorSpace=T.SRGBColorSpace;scene.background=map;
    scene.dispatchEvent({type:'surface-ready'});
  });
  stone.color.set(0x8c785e);
  block(scene,0,-2.12,0,38,.3,50,stone);
  for(const x of [-3.03,3.03])for(const z of [-2.91,2.91]){
    rod(scene,vector(x,-1.96,z),vector(x*.94,-.42,z*.96),.13,wood);
  }
  plankBench(scene,wood,material(0x35261e));wovenMat(scene,0,.025,0,8.5,3.8,linen);
  const base=cyl(scene,0,.13,0,1.32,.17,wood);
  ring(scene,1.17,.014,material(0xb99d65),0,.222,0);
  const origin=vector(0,.235,0);
  const back=mesh(scene,shardGeometry(0,true),clay,...origin.toArray());
  back.name='Surviving rear wall';
  const placements=[[-2.47,1.28], [2.43,.98], [-2.16,2.48]];
  const pieces=[];
  for(let i=0;i<3;i++){
    const geo=shardGeometry(i);
    geo.computeBoundingBox();const center=geo.boundingBox.getCenter(new T.Vector3());
    geo.translate(-center.x,-center.y,-center.z);
    const target=center.clone().add(origin);
    const item=mesh(scene,geo,clay,placements[i][0],placements[i][1],target.z);
    item.rotation.z=[Math.PI/3,-Math.PI/3,Math.PI/2][i];
    pieces.push({item,target,index:i,angle:item.rotation.z,locked:false});
  }
  // The jade workshop's rim gauge supplies the missing rim diameter.
  const jade=workshopSurface('jade',scene);
  const gauge=new T.Group();scene.add(gauge);
  gauge.position.set(0,origin.y+height+.025,0);
  jadeTemplate(gauge,jade);
  for(let i=0;i<12;i++){
    const a=-Math.PI/2+(i+.08)*Math.PI/12,b=a+Math.PI/24;
    rod(gauge,vector(Math.sin(a)*.834,0,Math.cos(a)*.834),vector(Math.sin(b)*.834,0,Math.cos(b)*.834),.015,jade,8);
  }
  // The brush, smoothing stone and fired samples stay on the work surface.
  ellipse(scene,2.04,.15,-1.07,.37,.13,.23,stone);
  rod(scene,vector(-3.08,.12,-1.04),vector(-1.66,.12,-1.52),.045,wood);
  ellipse(scene,-1.65,.12,-1.52,.13,.06,.07,linen);
  const turntable=new T.Group();scene.add(turntable);
  function showRestoration(){
    for(const object of [base,back,...pieces.map(p=>p.item)])turntable.attach(object);
    gauge.visible=false;
  }
  return {pieces,gauge,base,origin,turntable,showRestoration};
}

function featherWing(parent,bronze,side){
  const shape=new T.Shape();shape.moveTo(-.63,.20);
  shape.bezierCurveTo(-.12,.48,.26,.37,.99,.72);
  shape.bezierCurveTo(.65,.22,.14,-.22,-.36,-.20);
  shape.bezierCurveTo(-.68,-.12,-.73,.11,-.63,.20);
  const wing=mesh(parent,new T.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.036,bevelThickness:.025,bevelSegments:3,curveSegments:24}),bronze,0,0,side*.27);
  wing.rotation.y=side*.08;
  const raised=material(0x8f8c5b,{roughness:.52,metalness:.6});
  for(let i=0;i<5;i++){
    const y=i*.047;
    const curve=new T.CatmullRomCurve3([vector(-.43,.02+y,side*.36),vector(-.04,.06+y,side*.39),vector(.29+i*.11,.19+y+i*.033,side*.37)]);
    mesh(parent,new T.TubeGeometry(curve,18,.012,6,false),raised);
  }
}

export function birdBench(scene){
  const stone=workshopSurface('stone',scene),bronze=workshopSurface('bronze',scene),wood=workshopSurface('wood',scene);
  const green=material(0x928c60,{metalness:.54,roughness:.42});
  block(scene,0,-.25,0,14,.48,8,stone);
  const board=block(scene,0,1.60,-1.32,5.25,3.20,.075,workshopSurface('linen',scene));
  for(const side of [-1,1]){
    rod(scene,vector(side*2.69,.02,-1.33),vector(side*2.69,3.38,-1.33),.075,wood);
    rod(scene,vector(side*2.69,.04,-1.22),vector(side*2.69,2.14,-1.35),.06,wood);
  }
  rod(scene,vector(-2.80,3.21,-1.32),vector(2.80,3.21,-1.32),.07,wood);
  const stand=new T.Group();scene.add(stand);
  const restored=new T.Group(),fired=workshopSurface('clay',scene);
  fired.vertexColors=true;fired.side=T.DoubleSide;stand.add(restored);
  restored.position.y=.79;restored.rotation.z=Math.PI;restored.scale.setScalar(.36);
  mesh(restored,shardGeometry(0,true),fired);
  for(let i=0;i<3;i++)mesh(restored,shardGeometry(i),fired);
  const joint=material(0x4f3b2e,{roughness:.92});
  for(const i of [1,2]){
    const points=[];
    for(let j=0;j<=42;j++){
      const u=j/42,a=T.MathUtils.lerp(-1.38,1.38,u),v=seam(i,u),r=radius(v)+.015;
      points.push(vector(Math.sin(a)*r,v*height,Math.cos(a)*r));
    }
    mesh(restored,new T.TubeGeometry(new T.CatmullRomCurve3(points),48,.009,4,false),joint);
  }
  cyl(stand,0,.038,0,.67,.055,wood);
  ring(stand,.63,.012,green,0,.070,0);
  const bird=new T.Group();stand.add(bird);bird.position.y=1.69;
  ellipse(bird,0,0,0,.77,.40,.34,bronze).rotation.z=-.25;
  ellipse(bird,-.48,.25,0,.28,.51,.29,bronze).rotation.z=-.21;
  ellipse(bird,-.64,.59,0,.35,.32,.29,bronze);
  const beak=new T.Shape();beak.moveTo(-.80,.70);beak.quadraticCurveTo(-1.13,.70,-1.35,.49);beak.lineTo(-1.19,.45);beak.lineTo(-.77,.48);
  mesh(bird,new T.ExtrudeGeometry(beak,{depth:.18,bevelSize:.035,bevelThickness:.035,bevelEnabled:true,bevelSegments:3}),bronze,0,0,-.09);
  for(const s of [-1,1]){
    ellipse(bird,-.72,.64,s*.245,.105,.115,.065,green);
    ellipse(bird,-.74,.65,s*.292,.056,.067,.030,bronze);
    featherWing(bird,bronze,s);
  }
  const tail=new T.Shape();tail.moveTo(.43,.07);tail.quadraticCurveTo(.90,.01,1.16,-.20);tail.lineTo(1.29,-.79);tail.lineTo(1.15,-.81);tail.lineTo(.89,-.35);tail.lineTo(.42,-.21);
  mesh(bird,new T.ExtrudeGeometry(tail,{depth:.20,bevelEnabled:true,bevelSize:.037,bevelThickness:.035,bevelSegments:3}),bronze,0,0,-.10);
  const post=rod(bird,vector(-.05,-.92,0),vector(-.05,-.25,0),.08,bronze);
  post.name='Exhibition support';
  const points=[vector(-.73,.65,.31),vector(.84,.57,.28),vector(1.21,-.71,.09)];
  stand.rotation.y=1.25;
  return {bird,board,points,update(angle){stand.rotation.y=angle;stand.updateMatrixWorld(true);}};
}

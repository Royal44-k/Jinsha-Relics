import * as T from 'three';
import {ground,riverX,riverWidth,sites} from './geography.js';

const tau=Math.PI*2,cellSize=10,radius=20;
const forms=[
  {name:'浅水箭叶',width:[.96,.94,.71,.45,.18,.015],h:.38,l:.30,w:.093,stalk:.19,count:5,tint:0x81985f,limit:39},
  {name:'岸坡心叶',width:[.72,1,.90,.65,.30,.012],h:.18,l:.27,w:.089,stalk:.087,count:7,tint:0x74965d,limit:49},
  {name:'岸脊莎叶',width:[.42,1,.68,.015],h:.37,l:.32,w:.020,stalk:.015,count:9,tint:0xa2ae71,limit:34},
  {name:'背风处卷叶',width:[.16,.91,1,.64,.01],h:.027,l:.21,w:.045,stalk:.013,count:5,tint:0xb48453,limit:34}
];
const smooth=T.MathUtils.smoothstep;
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

// One small shared surface records the pale midrib, slanting secondary
// veins, and the change in thickness toward the margin of a folded leaf.
function veinTexture(){
  const size=128,data=new Uint8Array(size*size*4),rng=random(3891);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const t=j/(size-1),s=(i/(size-1)-.5)*2,edge=Math.abs(s);
    const mid=Math.exp(-edge*edge*680)*(1-.51*t);
    const line=Math.abs(Math.sin((t-.245*edge-.069*edge*edge+.020*Math.sin(t*14+Math.sign(s)))*Math.PI*7));
    const vein=(1-smooth(line,0,.19))*(1-edge*.73)*Math.min(1,edge*19);
    const v=198+20*mid+17*vein+11*(1-edge)+8*(rng()-.5)+5*Math.sin(13*t-3*s);
    const p=(j*size+i)*4;
    data[p]=v+6*mid;data[p+1]=v+5;data[p+2]=v-6*vein;data[p+3]=255;
  }
  const map=new T.DataTexture(data,size,size,T.RGBAFormat);
  map.colorSpace=T.SRGBColorSpace;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;
  map.generateMipmaps=true;map.needsUpdate=true;return map;
}

function rosette(form,index){
  const rng=random(751+index*139),points=[],colors=[],uv=[],indices=[],color=new T.Color();
  function vertex(x,y,z,u,v,brightness){
    points.push(x,y,z);uv.push(u,v);color.setHex(form.tint).multiplyScalar(brightness);colors.push(color.r,color.g,color.b);
    return points.length/3-1;
  }
  for(let leaf=0;leaf<form.count;leaf++){
    const angle=leaf*2.39996+.48*(rng()-.5),dx=Math.sin(angle),dz=Math.cos(angle),tilt=(rng()-.5)*.43;
    const growth=.73+.39*rng(),h=form.h*growth,length=form.l*(.75+.45*rng()),width=form.w*(.8+.35*rng());
    const dry=index===3,stem=form.stalk*growth,offset=dry?.31*rng():.015*rng(),footX=dx*offset,footZ=dz*offset;
    const stalkReach=(dry?.05:.15)*length,headX=footX+dx*stalkReach,headZ=footZ+dz*stalkReach;
    const tint=.79+.28*rng(),stalkWidth=dry?.003:.005;
    const base=vertex(footX-dz*stalkWidth,0,footZ+dx*stalkWidth,0,0,tint*.72);
    vertex(footX+dz*stalkWidth,0,footZ-dx*stalkWidth,1,0,tint*.72);
    vertex(headX+dz*stalkWidth,stem,headZ-dx*stalkWidth,1,1,tint);
    vertex(headX-dz*stalkWidth,stem,headZ+dx*stalkWidth,0,1,tint);indices.push(base,base+3,base+1,base+1,base+3,base+2);
    const first=points.length/3;
    for(let row=0;row<form.width.length;row++){
      const t=row/(form.width.length-1),curve=Math.sin(Math.PI*t),wide=width*form.width[row];
      const reach=length*(t*.61+t*t*.39),cx=headX+dx*reach+dz*tilt*curve*width,cz=headZ+dz*reach-dx*tilt*curve*width;
      const cy=stem+(h-stem)*(.77*t+.69*curve)+(dry?.014*curve:0);
      for(let side=-1;side<=1;side++){
        // Arrow-shaped and heart-shaped leaves have basal lobes either side
        // of the petiole; the pointed tip arches outward under its own weight.
        const lobe=(index===0?.36:index===1?.18:0)*length*(1-t)**6*Math.abs(side);
        const fold=(dry?-.21:.19)*wide*Math.abs(side);
        vertex(cx+dz*wide*side-dx*lobe,cy-fold+side*tilt*wide,cz-dx*wide*side-dz*lobe,
          (side+1)/2,t,tint*(side===0?1.08:.91+.07*side));
      }
      if(row===0)continue;
      const p=first+(row-1)*3;
      for(let s=0;s<2;s++){const k=p+s;indices.push(k,k+3,k+1,k+1,k+3,k+4);}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

function buildStands(routeDistance){
  const rng=random(259188),cells=new Map(),up=new T.Vector3(0,1,0),normal=new T.Vector3(),turn=new T.Quaternion(),dummy=new T.Object3D();
  const color=new T.Color();
  function place(x,z,kind){
    const h=ground(x,z);
    if(h<.015||routeDistance(x,z)<1.9||sites.some(([a,b],i)=>(x-a)**2+(z-b)**2<(i===8?6.8:5.15)**2))return;
    const gx=(ground(x+.12,z)-ground(x-.12,z))/.24,gz=(ground(x,z+.12)-ground(x,z-.12))/.24;
    if(Math.hypot(gx,gz)>.95)return;
    const gxCell=Math.floor(x/cellSize),gzCell=Math.floor(z/cellSize),key=gxCell+','+gzCell;
    const spacing=kind===2?.86:kind===0?.47:kind===1?.36:.29;
    for(let cx=Math.floor((x-spacing)/cellSize);cx<=Math.floor((x+spacing)/cellSize);cx++){
      for(let cz=Math.floor((z-spacing)/cellSize);cz<=Math.floor((z+spacing)/cellSize);cz++){
        const neighbors=cells.get(cx+','+cz);
        if(neighbors?.some(p=>p.kind===kind&&(x-p.x)**2+(z-p.z)**2<spacing*spacing))return;
      }
    }
    if(!cells.has(key))cells.set(key,[]);
    normal.set(-gx,1,-gz).normalize();
    dummy.quaternion.setFromUnitVectors(up,normal).multiply(turn.setFromAxisAngle(up,rng()*tau));
    const scale=.76+.46*rng();dummy.scale.set(scale,(.78+.36*rng())*scale,scale);
    dummy.position.set(x,h+(kind===3?.009:-.017),z);dummy.updateMatrix();
    const light=.76+.24*rng();color.setRGB(light*(.92+.08*rng()),light,light*(.86+.1*rng()));
    cells.get(key).push({x,z,kind,matrix:dummy.matrix.clone(),tint:color.clone(),distance:0});
  }
  function stand(x,z,bias=-1){
    const bank=Math.abs(x-riverX(z))-riverWidth(z),h=ground(x,z);
    const kind=bias>=0?bias:bank<3.6&&h<.91?0:bank<7?2:rng()<.72?1:3;
    const a=rng()*tau,l=.84+rng()*1.65,w=.37+rng()*.83,spacing=kind===3?6:4+Math.floor(rng()*4);
    for(let i=0;i<spacing;i++){
      const u=(rng()-.5)*2*l,v=(rng()-.5)*2*w;
      place(x+Math.cos(a)*u-Math.sin(a)*v,z+Math.sin(a)*u+Math.cos(a)*v,kind);
    }
  }
  for(let i=0;i<156;i++){
    const z=-67+rng()*116,side=i%2?1:-1;
    stand(riverX(z)+side*(riverWidth(z)+1.1+rng()*6.5),z);
  }
  for(let i=0;i<287;i++){
    const x=-35+70*rng(),z=-68+117*rng();
    if(routeDistance(x,z)<18||rng()<.34)stand(x,z);
  }
  // Low stands frame the approach from both sides of the first trench.
  for(const [x,z,k] of [[-14.5,40.4,1],[-7.4,40,2],[-5.4,36.4,1],[-15.8,34,3],[-14.4,43.4,1],[-6.8,43.7,3]])stand(x,z,k);
  // The extended field camps sit beyond the original 70 m meadow. Frame
  // their open working areas with patchy understorey and a wet sedge margin.
  for(const [x,z] of [[-43,21],[45,-13]])for(let i=0;i<46;i++){
    const a=i*2.40,r=3.6+rng()*12;stand(x+Math.cos(a)*r,z+Math.sin(a)*r,i%6===0?3:1);
  }
  for(let i=0;i<27;i++){
    const z=-81+rng()*13;stand(riverX(z)+(i%2?1:-1)*(riverWidth(z)+1.6+rng()*1.9),z,0);
  }
  for(let i=0;i<63;i++){
    const a=i*2.40,r=7.2+rng()*6.5;
    stand(-61+Math.cos(a)*r,-41+Math.sin(a)*r,i%6===0?3:i%3===0?2:1);
  }
  return cells;
}

export function createRiverGroundcover(scene,routeDistance){
  const cells=buildStands(routeDistance),breeze={value:0},veins=veinTexture(),reach=forms.map(()=>({value:radius}));
  const meshes=forms.map((form,i)=>{
    const material=new T.MeshStandardMaterial({map:veins,roughness:.88,vertexColors:true,side:T.DoubleSide});
    material.onBeforeCompile=shader=>{
      shader.uniforms.herbTime=breeze;shader.uniforms.herbReach=reach[i];
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        uniform float herbTime,herbReach;`).replace('#include <begin_vertex>',`#include <begin_vertex>
        vec2 root=instanceMatrix[3].xz;
        float fade=1.-smoothstep(max(1.,herbReach-4.3),herbReach-.85,distance(cameraPosition.xz,root));
        float sway=sin(dot(root,vec2(.59,.18))+herbTime*1.25)*.11;
        transformed.x+=sway*position.y*position.y;transformed*=fade;`);
    };
    const mesh=new T.InstancedMesh(rosette(form,i),material,form.limit);
    // These four buffers contain only the cells neighbouring the camera.
    mesh.name=form.name;mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.setColorAt(0,new T.Color());mesh.instanceColor.setUsage(T.DynamicDrawUsage);
    scene.add(mesh);return mesh;
  });
  let lastX=Infinity,lastZ=Infinity;
  const nearby=forms.map(()=>[]);
  return (camera,time)=>{
    breeze.value=time;
    if((camera.x-lastX)**2+(camera.z-lastZ)**2<.85**2)return;
    lastX=camera.x;lastZ=camera.z;
    for(const list of nearby)list.length=0;
    for(let cx=Math.floor((camera.x-radius)/cellSize);cx<=Math.floor((camera.x+radius)/cellSize);cx++){
      for(let cz=Math.floor((camera.z-radius)/cellSize);cz<=Math.floor((camera.z+radius)/cellSize);cz++){
        const cell=cells.get(cx+','+cz);if(!cell)continue;
        for(const plant of cell){
          plant.distance=(camera.x-plant.x)**2+(camera.z-plant.z)**2;
          if(plant.distance<radius**2)nearby[plant.kind].push(plant);
        }
      }
    }
    for(let kind=0;kind<forms.length;kind++){
      const mesh=meshes[kind],list=nearby[kind],limit=forms[kind].limit;
      if(list.length>limit)list.sort((a,b)=>a.distance-b.distance);
      reach[kind].value=list.length>limit?Math.sqrt(list[limit-1].distance):radius;
      mesh.count=Math.min(list.length,limit);mesh.visible=mesh.count>0;
      for(let i=0;i<mesh.count;i++){mesh.setMatrixAt(i,list[i].matrix);mesh.setColorAt(i,list[i].tint);}
      mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
    }
  };
}

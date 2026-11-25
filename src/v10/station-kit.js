import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ground} from './geography.js';

export const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const tau=Math.PI*2;
export const up=V(0,1,0);
export function seeded(n){return ()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
function mapAt(url,tones){
  let loaded;const ready=new Promise(resolve=>{loaded=resolve;});
  const tex=new T.TextureLoader().load(url,()=>loaded(true),undefined,()=>loaded(false));
  // An uninitialised GPU texture samples black. Supply a coloured piece of
  // the same material until the real decoded pixels replace it.
  const tile=document.createElement('canvas');tile.width=tile.height=24;const ctx=tile.getContext('2d'),noise=seeded(3459);
  for(let row=0;row<24;row++)for(let col=0;col<24;col++){
    const color=tones.length>1?tones[Math.min(tones.length-1,Math.floor(row*tones.length/24))]:tones[0];
    ctx.fillStyle=color;ctx.fillRect(col,row,1,1);ctx.fillStyle=noise()>.52?'#ffffff12':'#34251b13';ctx.fillRect(col,row,1,1);
  }
  tex.image=tile;tex.needsUpdate=true;tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=3;tex.userData.ready=ready;return tex;
}
export function makePalette(){
  const bark=mapAt('/assets/environment/bark_brown_02_diff_1k.webp',['#8a765a']);
  const mineral=mapAt('/assets/environment/rock_boulder_dry_diff_1k.webp',['#a49e87']);
  const loam=mapAt('/assets/v5/ground/aerial_grass_rock_diff_1k.webp',['#98895f']);
  const strata=mapAt('/assets/v10/trench-strata.webp',['#826951','#987353','#a4875e','#b49769','#ad956f','#655746','#897a60','#92846e']);strata.wrapS=strata.wrapT=T.ClampToEdgeWrapping;
  const props={wood:{map:bark,roughness:.9},earth:{map:loam,roughness:.98},stone:{map:mineral,roughness:.88},
    profile:{map:strata,bumpMap:strata,bumpScale:.029,roughness:.97},matte:{roughness:.87},cloth:{roughness:.98,side:T.DoubleSide},ceramic:{roughness:.72,side:T.DoubleSide},
    bronze:{roughness:.62,metalness:.55},gold:{roughness:.39,metalness:.74,side:T.DoubleSide},flame:{roughness:.91,emissive:0xff8945,emissiveIntensity:1.45}};
  const palette=Object.fromEntries(Object.entries(props).map(([key,p])=>[key,new T.MeshStandardMaterial({...p,vertexColors:true,forceSinglePass:true})]));
  Object.defineProperty(palette,'ready',{value:Promise.all([bark,mineral,loam,strata].map(t=>t.userData.ready))});return palette;
}
export function makeKit(group,palette,world,index,isAlive){
  const batches=new Map(),materials=[],colliders=[],perches=[],surfaces=[],rng=seeded(903+index*217);
  const y=(x,z)=>ground(group.position.x+x,group.position.z+z)-group.position.y;
  const terrainY=world.terrainSurface?(x,z)=>world.terrainSurface.heightAt(group.position.x+x,group.position.z+z)-group.position.y:y;
  // A whole landmark is a small number of merged draws. Shapes still retain
  // their own geometry, UVs, orientation and pigments after batching.
  function shape(g,kind,tint,p=[0,0,0],r=[0,0,0],scale=[1,1,1]){
    if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}
    if(!g.hasAttribute('normal'))g.computeVertexNormals();
    if(!g.hasAttribute('uv'))g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
    const q=r.isQuaternion?r:new T.Quaternion().setFromEuler(new T.Euler(...r));
    g.applyMatrix4(new T.Matrix4().compose(V(...p),q,V(...scale)));
    const c=new T.Color(tint),rgb=new Float32Array(g.attributes.position.count*3);for(let i=0;i<rgb.length;i+=3){rgb[i]=c.r;rgb[i+1]=c.g;rgb[i+2]=c.b;}
    g.setAttribute('color',new T.BufferAttribute(rgb,3));
    if(kind==='riverBed'){
      if(world.terrainSurface)world.terrainSurface.applyTo(g,group.position);
      else kind='earth';
    }
    if(!batches.has(kind))batches.set(kind,[]);batches.get(kind).push(g);
  }
  function rod(a,b,r,kind='wood',color=0xb19970,r2=r,sides=10){
    const start=V(...a),end=V(...b),axis=end.clone().sub(start);
    shape(new T.CylinderGeometry(r2,r,axis.length(),sides),kind,color,start.lerp(end,.5).toArray(),new T.Quaternion().setFromUnitVectors(up,axis.normalize()));
  }
  function box(pos,dim,kind,color,rot){shape(new T.BoxGeometry(...dim),kind,color,pos,rot);}
  function ell(pos,dim,kind,color,rot){shape(new T.SphereGeometry(1,16,10),kind,color,pos,rot,dim);}
  function ring(pos,radius,gauge,kind,tint,rot=[Math.PI/2,0,0]){
    shape(new T.TorusGeometry(radius,gauge,6,32),kind,tint,pos,rot);
  }
  function pot(pos,profile,color,scale=1){
    shape(new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),30),'ceramic',color,pos,[0,0,0],[scale,scale,scale]);
  }
  function sweep(points,widths,kind,color,flatten=1){
    const path=new T.CatmullRomCurve3(points.map(p=>V(...p))),widest=Math.max(...widths);
    const n=Math.max(widest<.03?5:10,Math.ceil(path.getLength()*(widest<.03?3.5:9))),nr=widest<.028?5:widest<.063?8:12;
    const knot=path.computeFrenetFrames(n,false),v=[],uv=[],idx=[];
    for(let i=0;i<=n;i++){const t=i/n,p=path.getPointAt(t),where=t*(widths.length-1),j=Math.min(widths.length-2,Math.floor(where));
      const r=T.MathUtils.lerp(widths[j],widths[j+1],where-j);
      for(let k=0;k<=nr;k++){const a=k/nr*tau,pv=p.clone().addScaledVector(knot.normals[i],Math.cos(a)*r).addScaledVector(knot.binormals[i],Math.sin(a)*r*flatten);
        v.push(...pv.toArray());uv.push(t*2,k/nr);
        if(i<n&&k<nr){const u=i*(nr+1)+k;idx.push(u,u+nr+1,u+1,u+1,u+nr+1,u+nr+2);}
      }
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();shape(g,kind,color);
  }
  function solidBox(x,z,bottom,height,halfX,halfZ,hint){
    colliders.push({x:group.position.x+x,z:group.position.z+z,y:group.position.y+bottom,height,halfX,halfZ,hint});
  }
  function cloth(corners,kind,color,dip=.1){
    const p=corners.map(q=>V(...q)),n=12,h=6,vertices=[],uv=[],idx=[];
    for(let j=0;j<=h;j++)for(let i=0;i<=n;i++){
      const u=i/n,v=j/h,a=p[0].clone().lerp(p[1],u),b=p[3].clone().lerp(p[2],u),q=a.lerp(b,v);
      q.y-=dip*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);q.z+=Math.sin(u*20+v*5)*dip*.22;
      vertices.push(q.x,q.y,q.z);uv.push(u,v);if(i<n&&j<h){const k=j*(n+1)+i;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
    }
    // Eight small roof panels follow the pitched fabric. The floor below stays open.
    if(Math.abs(corners[0][2]-corners[3][2])>.75&&Math.abs(corners[0][0]-corners[1][0])>2){
      for(let z=0;z<2;z++)for(let x=0;x<4;x++){
        const bounds=new T.Box3();
        for(let j=z*h/2;j<=(z+1)*h/2;j++)for(let i=x*n/4;i<=(x+1)*n/4;i++){
          const k=(j*(n+1)+i)*3;bounds.expandByPoint(V(vertices[k],vertices[k+1],vertices[k+2]));
        }
        const lo=bounds.min,hi=bounds.max;
        solidBox((lo.x+hi.x)/2,(lo.z+hi.z)/2,lo.y-.04,hi.y-lo.y+.075,(hi.x-lo.x)/2,(hi.z-lo.z)/2,'棚顶就在上方。沿棚檐飞出，再向上展翼。');
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();shape(geo,kind,color);
  }
  const coll=(x,z,bottom,height,radius,hint)=>{colliders.push({x:group.position.x+x,z:group.position.z+z,y:group.position.y+bottom,height,radius,hint});};
  function peg(x,z,h,r=.075,kind='wood',color=0xc1ac83){
    const bottom=y(x,z);rod([x,bottom-.11,z],[x,bottom+h,z],r,kind,color,r*.82);return bottom+h;
  }
  function perch(name,x,h,z,yaw=0){
    perches.push({id:'station-'+index+'-'+perches.length,name,label:name,position:V(group.position.x+x,group.position.y+h,group.position.z+z),yaw});
  }
  function surface(x0,x1,z0,z1,height,earth=false){
    surfaces.push({earth,minX:x0+group.position.x,maxX:x1+group.position.x,minZ:z0+group.position.z,maxZ:z1+group.position.z,
      heightAt:(x,z)=>group.position.y+height(x-group.position.x,z-group.position.z)});
  }
  function addScan(object){
    object.traverse(node=>{if(!node.isMesh)return;node.castShadow=true;node.receiveShadow=true;
      for(const m of Array.isArray(node.material)?node.material:[node.material]){m.forceSinglePass=true;materials.push(m);}});
    group.add(object);
  }
  function finish(){
    for(const [kind,parts] of batches){const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();
      const material=kind==='riverBed'?world.terrainSurface.makeMaterial():palette[kind].clone();
      const object=new T.Mesh(geometry,material);object.castShadow=kind!=='riverBed';object.receiveShadow=true;object.name=group.name+' · '+kind;
      group.add(object);materials.push(material);
    }
    function removeFrom(list,items){if(!list)return;for(const item of items){const ix=list.indexOf(item);if(ix>=0)list.splice(ix,1);}}
    batches.clear();return {materials,activate(){world.colliders.push(...colliders);world.invalidateSolids?.();world.perches.push(...perches);world.surfaces?.push(...surfaces);},
      deactivate(){removeFrom(world.colliders,colliders);world.invalidateSolids?.();removeFrom(world.perches,perches);removeFrom(world.surfaces,surfaces);}};
  }
  return {y,terrainY,rng,group,shape,rod,box,ell,ring,pot,sweep,cloth,coll,solidBox,peg,perch,surface,isAlive,addScan,finish};
}

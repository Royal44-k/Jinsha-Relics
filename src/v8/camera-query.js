import {BufferGeometry,InstancedMesh,Matrix4,Mesh,Ray,Raycaster,Sphere,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

/** Exact, camera-only triangle queries. Nothing patches Three's global prototypes. */
export function createCameraQuery(){
 const geometryCache=new WeakMap(),instanceCache=new WeakMap(),sphere=new Sphere(),proxy=new Mesh(),hits=[],direction=new Vector3(),point=new Vector3(),query=new Raycaster(),localRay=new Ray(),inverse=new Matrix4(),scaledDirection=new Vector3();
 let builds=0,casts=0,instanceTests=0,instanceRejected=0;
 function geometryRecord(object){
  const g=object.geometry,p=g.attributes.position,index=g.index,pBuffer=p.data||p,iBuffer=index?.data||index,array=Array.isArray(object.material),groupKey=array?g.groups.map(v=>`${v.start}:${v.count}:${v.materialIndex}`).join(','):'';
  let modes=geometryCache.get(g);if(!modes){modes={};geometryCache.set(g,modes);}
  const key=array?'array':'single';let record=modes[key];
  if(record&&record.position===p&&record.index===index&&record.pBuffer===pBuffer&&record.iBuffer===iBuffer&&record.pVersion===pBuffer.version&&record.iVersion===(iBuffer?.version||0)&&record.start===g.drawRange.start&&record.count===g.drawRange.count&&record.groups===groupKey)return record;
  // Share the original buffers without editing its index or groups. In particular,
  // a single material ignores geometry groups in Three, including gaps in groups.
  const view=new BufferGeometry();for(const name of Object.keys(g.attributes))view.setAttribute(name,g.attributes[name]);view.setIndex(index);view.setDrawRange(g.drawRange.start,g.drawRange.count);if(array)view.groups=g.groups.map(v=>({...v}));
  view.computeBoundingSphere();
  const triangles=(index?.count||p.count)/3,tree=triangles>=128?new MeshBVH(view,{indirect:true,targetLeafSize:12}):null;
  record={position:p,index,pBuffer,iBuffer,pVersion:pBuffer.version,iVersion:iBuffer?.version||0,start:g.drawRange.start,count:g.drawRange.count,groups:groupKey,view,tree,sphere:view.boundingSphere};modes[key]=record;builds++;return record;
 }
 function withinSegment(bound){
  const along=direction.copy(bound.center).sub(query.ray.origin).dot(query.ray.direction);
  if(along+bound.radius<query.near||along-bound.radius>query.far)return false;
  query.ray.at(Math.max(query.near,Math.min(query.far,along)),point);
  return point.distanceToSquared(bound.center)<=bound.radius*bound.radius+1e-10;
 }
 function castMesh(object,record,matrix,instanceId,bound){
  if(object.material===undefined)return;
  if(!withinSegment(bound||sphere.copy(record.sphere).applyMatrix4(matrix))){if(instanceId!==undefined)instanceRejected++;return;}
  hits.length=0;proxy.geometry=record.view;proxy.material=object.material;proxy.matrixWorld.copy(matrix);
  if(record.tree){
   localRay.copy(query.ray).applyMatrix4(inverse.copy(matrix).invert());
   // A non-uniform parent followed by child rotation creates shear. Convert
   // along the actual ray direction, not decomposed column scale lengths.
   const e=matrix.elements,d=localRay.direction,scale=scaledDirection.set(e[0]*d.x+e[4]*d.y+e[8]*d.z,e[1]*d.x+e[5]*d.y+e[9]*d.z,e[2]*d.x+e[6]*d.y+e[10]*d.z).length();
   if(scale>0){const hit=record.tree.raycastFirst(localRay,object.material,query.near/scale,query.far/scale);if(hit){hit.point.applyMatrix4(matrix);hit.distance=hit.point.distanceTo(query.ray.origin);hits.push(hit);}}
  }else Mesh.prototype.raycast.call(proxy,query,hits);
  for(const hit of hits)if(!best||hit.distance<best.distance){hit.object=object;if(instanceId!==undefined)hit.instanceId=instanceId;best=hit;query.far=hit.distance;}
 }
 let best=null;
 function visit(object,recursive){
  let descend=true;
  if(object.layers.test(query.layers)){
   const isInstance=object.isInstancedMesh&&object.raycast===InstancedMesh.prototype.raycast&&!object.morphTexture;
   const isStatic=object.isMesh&&!object.isSkinnedMesh&&!object.morphTargetInfluences?.length&&object.raycast===Mesh.prototype.raycast;
   if(isStatic||isInstance){
    const record=geometryRecord(object);
    if(isInstance){
     let saved=instanceCache.get(object);const attribute=object.instanceMatrix,version=attribute.version,count=object.count;
     if(!saved||saved.attribute!==attribute||saved.version!==version||saved.count!==count||saved.record!==record){saved={attribute,version,count,record,world:new Matrix4(),valid:false,matrices:Array.from({length:count},(_,i)=>object.getMatrixAt(i,new Matrix4())),worldMatrices:Array.from({length:count},()=>new Matrix4()),bounds:Array.from({length:count},()=>new Sphere())};instanceCache.set(object,saved);}
     if(!saved.valid||!saved.world.equals(object.matrixWorld)){saved.world.copy(object.matrixWorld);saved.valid=true;for(let i=0;i<count;i++){saved.worldMatrices[i].multiplyMatrices(object.matrixWorld,saved.matrices[i]);saved.bounds[i].copy(record.sphere).applyMatrix4(saved.worldMatrices[i]);}}
     for(let i=0;i<count;i++){instanceTests++;castMesh(object,record,saved.worldMatrices[i],i,saved.bounds[i]);}
    }else castMesh(object,record,object.matrixWorld);
   }else{hits.length=0;descend=object.raycast(query,hits)!==false;for(const hit of hits)if(!best||hit.distance<best.distance){best=hit;query.far=hit.distance;}}
  }
  if(recursive&&descend)for(const child of object.children)visit(child,true);
 }
 function first(raycaster,objects,recursive=true){
  casts++;best=null;query.ray.copy(raycaster.ray);query.near=raycaster.near;query.far=raycaster.far;query.layers.mask=raycaster.layers.mask;query.camera=raycaster.camera;query.params=raycaster.params;query.firstHitOnly=true;
  for(const object of objects)visit(object,recursive);return best;
 }
 function prepare(objects){const seen=new Set();for(const object of objects)object.traverse(o=>{if(seen.has(o)||!o.isMesh||o.isSkinnedMesh||o.morphTargetInfluences?.length)return;seen.add(o);geometryRecord(o);});}
 return {first,prepare,stats:()=>({builds,casts,instanceTests,instanceRejected})};
}

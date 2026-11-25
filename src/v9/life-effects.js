import * as T from 'three';

/** Small pooled light gestures: a readable direction and impact, without whitening the character. */
export function createLifeEffects(scene){
 const group=new T.Group();group.name='鸣光 · 行进与落点';scene.add(group);
 const geometry=new T.SphereGeometry(.045,7,5),ringGeometry=new T.TorusGeometry(.28,.008,5,40),lineGeometry=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);
 const paths=Array.from({length:3},()=>{
  const root=new T.Group();group.add(root);root.visible=false;
  const material=new T.MeshBasicMaterial({color:0xc8dec0,transparent:true,opacity:0,depthWrite:false,toneMapped:true});
  const beads=new T.InstancedMesh(geometry,material,9);beads.frustumCulled=false;root.add(beads);
  const ringMaterial=material.clone(),ring=new T.Mesh(ringGeometry,ringMaterial);root.add(ring);
  const trailMaterial=new T.LineBasicMaterial({color:0x9ebc9d,transparent:true,opacity:0,depthWrite:false}),trail=new T.Line(lineGeometry.clone(),trailMaterial);trail.frustumCulled=false;root.add(trail);
  return {root,beads,ring,trail,material,ringMaterial,trailMaterial,start:new T.Vector3(),end:new T.Vector3(),age:2};
 });
 const dummy=new T.Object3D(),p=new T.Vector3(),normal=new T.Vector3(),up=new T.Vector3(0,0,1);let count=0;
 function pulse(from,to){
  if(!from||!to)return false;
  const item=paths[count++%paths.length];item.start.copy(from.isVector3?from:new T.Vector3().fromArray(from)).y+=.7;item.end.copy(to.isVector3?to:new T.Vector3().fromArray(to));item.age=0;item.root.visible=true;
  normal.copy(item.start).sub(item.end).normalize();item.ring.quaternion.setFromUnitVectors(up,normal);return true;
 }
 function update(dt,{playing=true,reduced=false}={}){
  const delta=playing?Math.min(.1,Math.max(0,dt||0)):0;
  for(const item of paths){if(!item.root.visible)continue;item.age+=delta;const t=item.age/.38;
   if(item.age>.78){item.root.visible=false;continue;}
   for(let i=0;i<9;i++){const u=T.MathUtils.clamp(t-i*.035,0,1);p.copy(item.start).lerp(item.end,u);p.y+=Math.sin(u*Math.PI)*(reduced?0:.24);dummy.position.copy(p);dummy.scale.setScalar((1-i/12)*(.7+.3*Math.sin(Math.PI*u)));dummy.updateMatrix();item.beads.setMatrixAt(i,dummy.matrix);}
   item.beads.instanceMatrix.needsUpdate=true;item.material.opacity=t<1?.52:Math.max(0,.52-(t-1)*1.7);
   const line=item.trail.geometry.attributes.position;line.setXYZ(0,item.start.x,item.start.y,item.start.z);line.setXYZ(1,p.x,p.y,p.z);line.needsUpdate=true;item.trailMaterial.opacity=t<1?.16:0;
   item.ring.position.copy(item.end);const impact=Math.max(0,(item.age-.32)/.46);item.ring.scale.setScalar(.4+impact*1.8);item.ringMaterial.opacity=item.age>.32?Math.sin(Math.PI*Math.min(1,impact))*.55:0;
  }
 }
 return {pulse,update,reset(){for(const p of paths)p.root.visible=false;},stats:()=>({pulses:count,active:paths.filter(p=>p.root.visible).length}),dispose(){group.removeFromParent();geometry.dispose();ringGeometry.dispose();lineGeometry.dispose();for(const p of paths){p.beads.dispose();p.material.dispose();p.ringMaterial.dispose();p.trailMaterial.dispose();p.trail.geometry.dispose();}}};
}

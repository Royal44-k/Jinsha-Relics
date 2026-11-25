import * as THREE from 'three';

export function createBranchGeometry(points,radii,sides=8,steps=24){
 const curve=new THREE.CatmullRomCurve3(points),p=[],uv=[],idx=[];
 // Authored knots include the exact landing point. Keep parameter-space rings
 // and give parallel transport the same tangents (its default is arc length).
 const frames=THREE.Curve.prototype.computeFrenetFrames.call({getTangentAt(t,target){return curve.getTangent(t,target);}},steps,false);
 let travel=0;const previous=new THREE.Vector3(),radial=new THREE.Vector3();
 for(let i=0;i<=steps;i++){
  const t=i/steps,point=curve.getPoint(t),k=Math.min(radii.length-2,Math.floor(t*(radii.length-1))),f=t*(radii.length-1)-k,r=THREE.MathUtils.lerp(radii[k],radii[k+1],f);
  if(i)travel+=point.distanceTo(previous);previous.copy(point);
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2;radial.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));
   p.push(point.x+radial.x*r,point.y+radial.y*r,point.z+radial.z*r);uv.push(j/sides*2,travel);
   if(i<steps&&j<sides){const q=i*(sides+1)+j;idx.push(q,q+1,q+sides+1,q+1,q+sides+2,q+sides+1);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 // The wrapping UV requires two vertices, but the bark surface has no crease.
 const normals=g.attributes.normal,a=new THREE.Vector3(),b=new THREE.Vector3();
 for(let i=0;i<=steps;i++){const first=i*(sides+1),last=first+sides;a.fromBufferAttribute(normals,first).add(b.fromBufferAttribute(normals,last)).normalize();normals.setXYZ(first,a.x,a.y,a.z);normals.setXYZ(last,a.x,a.y,a.z);}
 return g;
}

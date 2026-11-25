import {Vector3,Raycaster,PerspectiveCamera,Matrix4,Frustum,Sphere} from 'three';
import {createCameraQuery} from '../v8/camera-query.js';

/** Constrain the submitted camera, after smoothing or cinematic blending. */
export function createCameraClearance(){
 const direction=new Vector3(),right=new Vector3(),up=new Vector3(),origin=new Vector3(),axis=new Vector3(0,1,0),ray=new Raycaster(),query=createCameraQuery();
 const shotCamera=new PerspectiveCamera(),viewProjection=new Matrix4(),frustum=new Frustum(),subjectSphere=new Sphere(new Vector3(),.7);
 function constrain(camera,target,colliders,position=camera.position){
  direction.copy(position).sub(target);const distance=direction.length();
  if(distance<1e-6||!colliders.length)return false;
  direction.multiplyScalar(1/distance);right.crossVectors(axis,direction);
  if(right.lengthSq()<1e-8)right.set(1,0,0);else right.normalize();
  up.crossVectors(direction,right).normalize();
  const halfHeight=(camera.near||.08)*Math.tan((camera.fov||48)*Math.PI/360)/(camera.zoom||1),x=halfHeight*(camera.aspect||1)+.025,y=halfHeight+.025;
  let allowed=distance;
  // Centre plus four expanded near-plane corners. Scratch vectors and the
  // intersection list are reused; the render/material state is never changed.
  for(let i=0;i<5;i++){
   origin.copy(target);if(i)origin.addScaledVector(right,i<3?-x:x).addScaledVector(up,i%2?-y:y);
   ray.set(origin,direction);ray.far=distance;const hit=query.first(ray,colliders);
   if(hit)allowed=Math.min(allowed,Math.max(0,hit.distance-.1));
  }
  if(allowed>=distance)return false;
  // A minimum chase distance would put the camera back through close geometry.
  position.copy(target).addScaledVector(direction,allowed);return true;
 }
 function isUsableShot(camera,position,target,subject,fov=camera.fov){
  if(position.distanceToSquared(target)<1.4*1.4)return false;
  shotCamera.position.copy(position);shotCamera.up.copy(camera.up);shotCamera.fov=fov;shotCamera.aspect=camera.aspect;shotCamera.zoom=camera.zoom;shotCamera.near=camera.near;shotCamera.far=camera.far;
  shotCamera.lookAt(target);shotCamera.updateProjectionMatrix();shotCamera.updateMatrixWorld();
  viewProjection.multiplyMatrices(shotCamera.projectionMatrix,shotCamera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
  // Reject only a wholly lost character, allowing deliberate off-centre shots.
  subjectSphere.center.copy(subject).y+=.78;return frustum.intersectsSphere(subjectSphere);
 }
 return {constrain,isUsableShot,first:query.first,prepare:query.prepare,stats:query.stats};
}

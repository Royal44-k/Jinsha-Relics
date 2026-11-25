import {Vector3,Quaternion,Matrix4} from 'three';

/** Keep the whole dawn motif and the companion in frame, with room for the epilogue. */
export function createEndingCamera(){
 const forward=new Vector3(),right=new Vector3(),eye=new Vector3(),target=new Vector3(),up=new Vector3(0,1,0),matrix=new Matrix4(),orientation=new Quaternion();
 return {
  update(camera,position,focus,dt,reduced=false){
   if(!Array.isArray(focus)||focus.length!==3||!focus.every(Number.isFinite))return;
   target.fromArray(focus);
   // A completed save can be resumed elsewhere; preserve that local view.
   if(target.distanceTo(position)>60)return;
   forward.copy(target).sub(position).setY(0).normalize();
   if(forward.lengthSq()<.01)return;
   right.crossVectors(forward,up).normalize();
   eye.copy(position).addScaledVector(forward,-5.6).addScaledVector(up,2.55);
   target.lerp(position.clone().addScaledVector(up,1.05),.68);
   if(camera.aspect>1.2)target.addScaledVector(right,-2.1);
   matrix.lookAt(eye,target,up);orientation.setFromRotationMatrix(matrix);
   const blend=reduced?1:1-Math.exp(-Math.max(0,dt)*1.5);
   camera.position.lerp(eye,blend);camera.quaternion.slerp(orientation,blend);
   camera.fov+=((camera.aspect>1.2?52:63)-camera.fov)*blend;camera.updateProjectionMatrix();
  }
 };
}

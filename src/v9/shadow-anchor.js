import {Vector3} from 'three';

/** Keep a translating directional shadow on its own texel grid. Lighting
 * direction is untouched; only the orthographic coverage centre is snapped. */
export function createShadowAnchor(){
 const z=new Vector3(),right=new Vector3(),up=new Vector3(),worldUp=new Vector3(0,1,0),result=new Vector3();
 return function anchor(focus,offset,span=36,mapSize=2048){
  z.copy(offset).normalize();right.crossVectors(worldUp,z);
  if(right.lengthSq()<1e-8)right.set(1,0,0);else right.normalize();
  up.crossVectors(z,right).normalize();
  const step=span/Math.max(1,mapSize),x=focus.dot(right),y=focus.dot(up);
  return result.copy(focus).addScaledVector(right,Math.round(x/step)*step-x).addScaledVector(up,Math.round(y/step)*step-y);
 };
}

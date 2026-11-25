import {Spherical,Vector2,Vector3} from 'three';
import {ground} from '../v10/geography.js';
import {cameraReach} from '../v10/camera-boom.js';

// Render the same frozen scene with a separate lens. No screen capture or
// preserved WebGL drawing buffer is needed during ordinary play.
export function photograph(renderer,scene,camera,aim,world,canvas,{yaw,pitch,zoom,width,height}){
  const lens=camera.clone(),arm=new Vector3().subVectors(camera.position,aim);
  const orbit=new Spherical().setFromVector3(arm);
  orbit.theta+=yaw;
  orbit.phi=Math.max(.28,Math.min(Math.PI-.28,orbit.phi+pitch));
  lens.position.copy(aim).add(arm.setFromSpherical(orbit));
  lens.position.y=Math.max(ground(lens.position.x,lens.position.z)+.24,lens.position.y);
  lens.position.lerp(aim,1-cameraReach(aim,lens.position,world.solidsNear(aim,lens.position,.18)));
  lens.aspect=width/height;lens.zoom=zoom;lens.lookAt(aim);lens.updateProjectionMatrix();
  const size=renderer.getSize(new Vector2()),ratio=renderer.getPixelRatio();
  try{
    renderer.setDrawingBufferSize(width,height,1);
    renderer.render(scene,lens);
    canvas.width=width;canvas.height=height;
    canvas.getContext('2d').drawImage(renderer.domElement,0,0);
  }finally{
    renderer.setDrawingBufferSize(size.x,size.y,ratio);
    renderer.render(scene,camera);
  }
}

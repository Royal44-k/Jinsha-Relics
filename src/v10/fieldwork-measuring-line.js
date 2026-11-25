import * as T from 'three';

// Endpoints are surveyed positions in the drift scene. The moving end is
// unprojected onto the same water plane used by the measuring posts.
export function measuringLine(ctx,scene,camera,canvas,secured) {
  const left=new T.Vector3(-1.05,.095,0),right=new T.Vector3(1.05,.095,0),tip=left.clone();
  const points=new T.BufferAttribute(new Float32Array(9),3),geometry=new T.BufferGeometry();
  geometry.setAttribute('position',points);
  const cable=new T.Line(geometry,new T.LineBasicMaterial({color:0xffe9a5}));cable.frustumCulled=false;
  scene.add(cable);
  const project=new T.Vector3(),ray=new T.Raycaster(),water=new T.Plane(new T.Vector3(0,1,0),-left.y);
  const widgets=[['牵出测绳','button'],['对岸系桩','span']].map(([name,element],i)=>{
    const tag=document.createElement(element);tag.className='fw-survey-tie tie-'+i;tag.textContent=name;
    if(!i){tag.type='button';tag.setAttribute('aria-label','拖动测绳绳头');}
    ctx.overlay.append(tag);tag.hidden=true;
    const stake=new T.Mesh(new T.CylinderGeometry(.05,.075,.51,12),new T.MeshStandardMaterial({color:0xb89056,roughness:.81}));
    stake.position.copy(i?right:left);stake.position.y=.025;scene.add(stake);
    return tag;
  });
  let dragging=null,locked=false;
  function write(){
    points.setXYZ(0,left.x,left.y,left.z);points.setXYZ(1,(left.x+tip.x)/2,left.y-.035,(left.z+tip.z)/2);points.setXYZ(2,tip.x,left.y,tip.z);
    points.needsUpdate=true;
  }
  function locate(){
    for(const [i,tag] of widgets.entries()){
      project.copy(i?right:tip).project(camera);
      tag.style.left=((project.x+1)*.5*canvas.clientWidth)+'px';tag.style.top=((1-project.y)*.5*canvas.clientHeight)+'px';
    }
  }
  function hook(){
    dragging=null;locked=true;tip.copy(right);write();for(const tag of widgets)tag.hidden=true;secured();
  }
  const grip=widgets[0];
  ctx.on(grip,'pointerdown',e=>{dragging=e.pointerId;grip.setPointerCapture(e.pointerId);});
  ctx.on(grip,'pointermove',e=>{
    if(dragging!==e.pointerId)return;const box=canvas.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((e.clientX-box.left)*2/box.width-1,1-(e.clientY-box.top)*2/box.height),camera);
    ray.ray.intersectPlane(water,tip);tip.x=T.MathUtils.clamp(tip.x,-1.5,1.5);tip.z=T.MathUtils.clamp(tip.z,-1,1);
    write();locate();
  });
  ctx.on(grip,'pointerup',e=>{if(dragging!==e.pointerId)return;dragging=null;
    if(tip.distanceTo(right)<.44)hook();
    else{tip.copy(left);write();locate();ctx.tip('测绳还没有挂住对岸的桩。按住绳头，横过水面，在「对岸系桩」处松手。');}
  });
  for(const type of ['pointercancel','lostpointercapture'])ctx.on(grip,type,()=>{if(dragging!==null){dragging=null;tip.copy(left);write();locate();}});
  return {hook,locate,get locked(){return locked;},
    show(setting){for(const tag of widgets)tag.hidden=!setting;if(setting){locked=false;tip.copy(left);write();locate();}},
    hide(){dragging=null;for(const tag of widgets)tag.hidden=true;}};
}

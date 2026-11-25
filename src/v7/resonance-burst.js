import * as T from 'three';
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

export function resonanceEnvelope(elapsed,duration){
 if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=duration)return 0;
 return .78*smooth(0,.28,elapsed)*(1-smooth(Math.max(.3,duration-.95),duration,elapsed));
}

// An original curved gold vane, kept small enough to belong to the world.
// This replaces the large rectangular strips used by the earlier celebration.
export function createResonanceBurst(scene){
 const shape=new T.Shape();shape.moveTo(0,-.085);shape.bezierCurveTo(-.022,-.04,-.022,.034,.005,.092);shape.bezierCurveTo(.022,.043,.032,-.018,0,-.085);
 const geometry=new T.ShapeGeometry(shape,6),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++)p.setZ(i,.004*Math.sin((p.getY(i)+.085)/.177*Math.PI));
 geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({color:'#dec18a',metalness:.58,roughness:.48,emissive:'#8b703e',emissiveIntensity:.1,side:T.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true});
 const mesh=new T.InstancedMesh(geometry,material,32);mesh.name='V7 · 回响的羽形金箔';mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
 const origin=new T.Vector3(),dummy=new T.Object3D();let start=-Infinity,duration=3;
 // Keep this temporary draw inside the synchronous loading-render scope. It
 // uploads the full instance buffer without triggering a celebration.
 function prepareWarmup(){
  const state={visible:mesh.visible,frustumCulled:mesh.frustumCulled,count:mesh.count,opacity:material.opacity,depthWrite:material.depthWrite};
  mesh.visible=true;mesh.frustumCulled=false;mesh.count=32;material.opacity=0;material.depthWrite=false;
  let restored=false;
  return ()=>{if(restored)return;restored=true;mesh.visible=state.visible;mesh.frustumCulled=state.frustumCulled;mesh.count=state.count;material.opacity=state.opacity;material.depthWrite=state.depthWrite;};
 }
 function reset(){start=-Infinity;mesh.visible=false;}
 function trigger(time,position,seconds=3){start=time;duration=Math.max(1,Number(seconds)||3);origin.copy(position);}
 function update(time,{reduced=false,quality='high'}={}){
  const age=time-start,opacity=resonanceEnvelope(age,duration);mesh.visible=opacity>0;if(!mesh.visible)return;
  material.opacity=opacity;mesh.count=reduced?12:quality==='low'?18:32;
  const progress=reduced?.38:T.MathUtils.clamp(age/duration,0,1),unfurl=smooth(0,1,progress);
  for(let i=0;i<mesh.count;i++){
   const a=i*2.399+(reduced?0:age*.22),r=.4+unfurl*.75+(i%5)*.09;
   dummy.position.set(origin.x+Math.cos(a)*r,origin.y+.62+unfurl*.8+(i%7)*.105,origin.z+Math.sin(a)*r);
   dummy.rotation.set(.4+Math.sin(i)*.6,a+(reduced?0:age*.45),Math.sin(i*1.7)*.8);
   dummy.scale.setScalar(.55+(i%6)*.075);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;
 }
 return {trigger,update,reset,prepareWarmup,mesh,dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();}};
}

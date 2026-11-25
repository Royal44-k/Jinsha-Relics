import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRiverReflection,createRiverVisibility} from '../src/v6/world-water.js';

// Reconstruct the existing authored shoreline, independently of the bounds code.
const controls=[[0,12],[-2,-3],[-12,-14],[-18,-26],[-10,-39],[8,-48],[15,-65],[5,-78],[-9,-86],[-22,-101],[-21,-121],[-5,-137],[13,-147],[23,-167],[14,-186],[-5,-193],[-17,-213],[-10,-232],[9,-244],[18,-265],[6,-282],[0,-302]];
const path=new T.CatmullRomCurve3(controls.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal');
path.arcLengthDivisions=1800;path.updateArcLengths();
const length=path.getLength(),positions=[],indices=[];
for(let i=0;i<=320;i++){
 const d=length*(.135+i/320*.84),p=path.getPointAt(d/length),t=path.getTangentAt(d/length),right=new T.Vector3(-t.z,0,t.x),center=10.5+2*Math.sin(d*.027),half=d<length*.31?6.1:3.6;
 for(const side of [-1,1]){const q=p.clone().addScaledVector(right,center+side*half);positions.push(q.x,-.198,q.z);}
 if(i<320){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
}
const river=new T.BufferGeometry();river.setAttribute('position',new T.Float32BufferAttribute(positions,3));river.setIndex(indices);
const identity=new T.Matrix4();
function cameraAt(f,y=1.619,pitch=0){
 const p=path.getPointAt(f),t=path.getTangentAt(f),camera=new T.PerspectiveCamera(48,1.6,.08,150);
 camera.position.copy(p).addScaledVector(t,-4.25).setY(y);camera.lookAt(p.clone().setY(.815));camera.rotateX(pitch);camera.updateMatrixWorld();return camera;
}
// Independent triangle clipping against all six homogeneous clip planes.
// Unlike a vertex-in-frustum test this catches triangles spanning the view.
function anyTriangleVisible(geometry,camera,matrixWorld=identity){
 const matrix=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(matrixWorld),position=geometry.attributes.position,index=geometry.index;
 const planes=[p=>p.w+p.x,p=>p.w-p.x,p=>p.w+p.y,p=>p.w-p.y,p=>p.w+p.z,p=>p.w-p.z];
 const count=index?.count??position.count;
 for(let i=0;i<count;i+=3){
  let polygon=[];for(let j=0;j<3;j++){const k=index?index.getX(i+j):i+j;polygon.push(new T.Vector4(position.getX(k),position.getY(k),position.getZ(k),1).applyMatrix4(matrix));}
  for(const plane of planes){
   const clipped=[];for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length],da=plane(a),db=plane(b);if(da>=0)clipped.push(a);if((da>=0)!==(db>=0))clipped.push(a.clone().lerp(b,da/(da-db)));}
   polygon=clipped;if(!polygon.length)break;
  }
  if(polygon.length>=3)return true;
 }
 return false;
}

test('all five forward performance views keep the real river reflection',()=>{
 const visibility=createRiverVisibility(river);assert.equal(visibility.segments,40);
 for(const f of [.04,.225,.413,.57,.88]){const camera=cameraAt(f);assert.ok(anyTriangleVisible(river,camera),`independent visible water at ${f}`);assert.equal(visibility.intersects(camera,identity),true);}
});

test('camera sweeps never reject any geometrically visible river triangle',()=>{
 const visibility=createRiverVisibility(river);let visible=0,rejected=0;
 for(const f of [.04,.225,.413,.57,.88])for(const altitude of [1.619,7])for(const pitch of [-.4,0,.5])for(let step=0;step<24;step++){
  const camera=cameraAt(f,altitude,pitch);camera.rotateOnWorldAxis(new T.Vector3(0,1,0),step*Math.PI/12);camera.updateMatrixWorld();
  const exact=anyTriangleVisible(river,camera),candidate=visibility.intersects(camera,identity);
  if(exact){visible++;assert.ok(candidate,`false rejection: ${f}/${altitude}/${pitch}/${step}`);}if(!candidate)rejected++;
 }
 assert.ok(visible>100);assert.ok(rejected>100,`expected useful offscreen rejection, got ${rejected}`);
});

test('bounds honor transformed water and triangles crossing view edges',()=>{
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-100,-1,0,100,-1,0,0,100,0],3));
 const transform=new T.Matrix4().compose(new T.Vector3(3,1,-8),new T.Quaternion().setFromEuler(new T.Euler(.1,.2,.1)),new T.Vector3(1.3,.7,2));
 const camera=new T.PerspectiveCamera(48,1.6,.08,150);camera.lookAt(0,0,-1);camera.updateMatrixWorld();
 assert.ok(anyTriangleVisible(geometry,camera,transform));assert.ok(createRiverVisibility(geometry).intersects(camera,transform));
 geometry.dispose();
});

test('offscreen callback skips only the nested render and re-entry refreshes that frame',()=>{
 const scene=new T.Scene(),group=new T.Group();scene.add(group);
 const material=new T.ShaderMaterial({uniforms:{uTime:{value:0},uDeep:{value:new T.Color('#133b36')},uSky:{value:new T.Color('#8ca8a1')}}});
 const original=new T.Mesh(river.clone(),material);original.name='Reflective winding river';group.add(original);
 const reflection=createRiverReflection({scene,forest:{group,length,project:()=>({distance:length*.413})}}),camera=cameraAt(.413),base=camera.clone();scene.updateMatrixWorld(true);
 let renders=0,target=null;
 const renderer={info:{autoReset:true,render:{calls:0}},xr:{enabled:false},shadowMap:{autoUpdate:true},state:{buffers:{depth:{setMask(){}}},viewport(){}},autoClear:true,getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},render(){renders++;this.info.render.calls+=20;}};
 reflection.update(0,0,{position:new T.Vector3(),camera,quality:'high'});
 const sameMaterial=reflection.water.material;
 reflection.water.onBeforeRender(renderer,scene,camera);assert.equal(renders,1);assert.equal(reflection.stats().inView,true);
 camera.rotateOnWorldAxis(new T.Vector3(0,1,0),Math.PI/2);camera.updateMatrixWorld();
 reflection.water.onBeforeRender(renderer,scene,camera);assert.equal(renders,1);assert.equal(reflection.stats().inView,false);assert.equal(reflection.stats().skippedFrames,1);
 assert.equal(reflection.water.visible,true);assert.equal(original.visible,false);assert.equal(reflection.water.material,sameMaterial);
 camera.copy(base);camera.updateMatrixWorld();reflection.water.onBeforeRender(renderer,scene,camera);assert.equal(renders,2);assert.equal(reflection.stats().inView,true);assert.equal(reflection.stats().frames,2);
 assert.equal(renderer.info.autoReset,true);assert.equal(target,null);
 reflection.dispose();original.geometry.dispose();material.dispose();
});

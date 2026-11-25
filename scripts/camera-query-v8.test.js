import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createCameraQuery} from '../src/v8/camera-query.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function compare(query,ray,objects){const expected=ray.intersectObjects(objects,true)[0],actual=query.first(ray,objects);assert.equal(!!actual,!!expected);if(expected){assert.ok(Math.abs(actual.distance-expected.distance)<1e-5,`${actual.distance} != ${expected.distance}`);assert.equal(actual.object,expected.object);assert.equal(actual.instanceId,expected.instanceId);assert.ok(actual.point.distanceTo(expected.point)<1e-5);}return actual;}
let seed=43;const r=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
test('camera BVH equals Three nearest triangle across transformed instanced and single meshes',()=>{
 const query=createCameraQuery(),geo=new T.TorusKnotGeometry(1,.3,150,12),before=geo.index.array.slice(),mat=new T.MeshBasicMaterial({side:T.DoubleSide}),single=new T.Mesh(geo,mat),instances=new T.InstancedMesh(geo,mat,18),dummy=new T.Object3D();
 single.position.set(-2,.5,0);single.scale.set(.8,1.4,.6);single.rotation.set(.2,.6,.1);
 for(let i=0;i<18;i++){dummy.position.set((i%6)*3-8,Math.floor(i/6)*3-2,-4);dummy.rotation.set(i*.3,i*.2,0);dummy.scale.set(.8,1+i*.03,.7);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);}instances.instanceMatrix.needsUpdate=true;instances.rotation.y=.3;single.updateMatrixWorld();instances.updateMatrixWorld();query.prepare([single,instances]);
 for(let i=0;i<350;i++){const origin=V(r()*24-12,r()*12-4,r()*12-1),target=V(r()*20-10,r()*10-3,-3),ray=new T.Raycaster(origin,target.sub(origin).normalize(),i%5===0?1:0,4+r()*24);compare(query,ray,[single,instances]);}
 assert.deepEqual(geo.index.array,before,'BVH must not reorder render triangles');assert.equal(geo.boundsTree,undefined,'no renderer-visible boundsTree attachment');
});
test('camera queries preserve material sides, groups, draw range, layers and inside starts',()=>{
 const query=createCameraQuery(),geo=new T.SphereGeometry(2,30,20),mesh=new T.Mesh(geo,new T.MeshBasicMaterial());mesh.updateMatrixWorld();
 for(const side of [T.FrontSide,T.BackSide,T.DoubleSide]){mesh.material.side=side;for(const origin of [V(),V(0,0,5),V(1.9,0,0)])compare(query,new T.Raycaster(origin,V(0,0,-1),0,12),[mesh]);}
 const materials=[new T.MeshBasicMaterial({side:T.FrontSide}),new T.MeshBasicMaterial({side:T.DoubleSide})];geo.clearGroups();geo.addGroup(0,300,0);geo.addGroup(600,geo.index.count-600,1);mesh.material=materials;
 for(let i=0;i<100;i++){const p=V(r()*6-3,r()*6-3,5);compare(query,new T.Raycaster(p,V().sub(p).normalize(),0,20),[mesh]);}
 mesh.material=materials[1];compare(query,new T.Raycaster(V(0,0,5),V(0,0,-1),0,20),[mesh]);geo.setDrawRange(0,300);compare(query,new T.Raycaster(V(0,0,5),V(0,0,-1),0,20),[mesh]);mesh.layers.set(2);compare(query,new T.Raycaster(V(0,0,5),V(0,0,-1),0,20),[mesh]);
});
test('instance count, transforms, geometry replacement and vertex version invalidate correctly',()=>{
 const query=createCameraQuery(),mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1,12,12,12),new T.MeshBasicMaterial({side:T.DoubleSide}),2),matrix=new T.Matrix4(),ray=new T.Raycaster(V(0,0,4),V(0,0,-1),0,12);mesh.setMatrixAt(0,matrix.makeTranslation(0,0,0));mesh.setMatrixAt(1,matrix.makeTranslation(4,0,0));mesh.instanceMatrix.needsUpdate=true;mesh.updateMatrixWorld();compare(query,ray,[mesh]);
 mesh.setMatrixAt(0,matrix.makeTranslation(5,0,0));mesh.instanceMatrix.needsUpdate=true;compare(query,ray,[mesh]);mesh.setMatrixAt(1,matrix.makeTranslation(0,0,2));mesh.instanceMatrix.needsUpdate=true;compare(query,ray,[mesh]);mesh.count=1;compare(query,ray,[mesh]);mesh.count=2;mesh.position.z=-1;mesh.updateMatrixWorld();compare(query,ray,[mesh]);
 mesh.geometry=new T.SphereGeometry(.8,24,12);compare(query,ray,[mesh]);mesh.geometry.scale(.5,.5,.5);compare(query,ray,[mesh]);
});
test('custom raycasts retain their semantics and recursive-stop contract',()=>{
 const query=createCameraQuery(),group=new T.Group(),child=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()),ray=new T.Raycaster(V(0,0,3),V(0,0,-1),0,12);group.add(child);group.updateMatrixWorld();group.raycast=()=>false;compare(query,ray,[group]);group.raycast=()=>undefined;compare(query,ray,[group]);
 child.raycast=function(ray,hits){hits.push({distance:1,point:ray.ray.at(1,V()),object:this});};compare(query,ray,[group]);
});
test('non-uniform parent scale with a rotated child preserves finite near/far clipping',()=>{
 const query=createCameraQuery(),parent=new T.Group(),mesh=new T.Mesh(new T.SphereGeometry(1,24,18),new T.MeshBasicMaterial({side:T.DoubleSide}));parent.scale.set(3,.7,1.4);mesh.rotation.set(.6,.7,.8);parent.add(mesh);parent.updateMatrixWorld();
 for(let i=0;i<120;i++){const origin=V(r()*10-5,r()*6-3,5),ray=new T.Raycaster(origin,V().sub(origin).normalize(),0,30),hit=ray.intersectObject(mesh)[0];if(!hit)continue;ray.far=hit.distance+1e-5;compare(query,ray,[mesh]);ray.near=hit.distance+1e-5;ray.far=30;compare(query,ray,[mesh]);}
});

test('interleaved position buffer versions and replacement invalidate cached triangles',()=>{
 const query=createCameraQuery(),geometry=new T.SphereGeometry(1,24,18),source=geometry.attributes.position,values=new Float32Array(source.count*4);
 for(let i=0;i<source.count;i++){values[i*4]=source.getX(i);values[i*4+1]=source.getY(i);values[i*4+2]=source.getZ(i);values[i*4+3]=.5;}
 const position=new T.InterleavedBufferAttribute(new T.InterleavedBuffer(values,4),3,0);geometry.setAttribute('position',position);
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide})),ray=new T.Raycaster(V(0,0,4),V(0,0,-1),0,12);mesh.updateMatrixWorld();compare(query,ray,[mesh]);
 for(let i=0;i<position.count;i++)position.setX(i,position.getX(i)+8);position.needsUpdate=true;geometry.boundingSphere=null;ray.ray.origin.x=8;compare(query,ray,[mesh]);
 const moved=position.data.array.slice();for(let i=0;i<position.count;i++)moved[i*4]-=12;position.data=new T.InterleavedBuffer(moved,4);geometry.boundingSphere=null;ray.ray.origin.x=-4;compare(query,ray,[mesh]);
 assert.equal(query.stats().builds,3);
});

test('replacing the instance matrix attribute at the same version refreshes transformed bounds',()=>{
 const query=createCameraQuery(),mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1,6,6,6),new T.MeshBasicMaterial(),1),ray=new T.Raycaster(V(0,0,4),V(0,0,-1),0,12);
 mesh.setMatrixAt(0,new T.Matrix4());mesh.updateMatrixWorld();compare(query,ray,[mesh]);
 const replacement=mesh.instanceMatrix.clone();new T.Matrix4().makeTranslation(8,0,0).toArray(replacement.array);assert.equal(replacement.version,mesh.instanceMatrix.version);mesh.instanceMatrix=replacement;mesh.boundingSphere=null;ray.ray.origin.x=8;compare(query,ray,[mesh]);
});

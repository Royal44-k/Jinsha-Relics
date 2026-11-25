import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,SphereGeometry,Mesh,MeshBasicMaterial,DoubleSide,Vector3,Group} from 'three';
import {chooseRebirthView,rebirthViewPose,REBIRTH_OBSERVATION_DURATION} from '../src/v9/rebirth-view.js';
const V=(x=0,y=0,z=0)=>new Vector3(x,y,z),material=new MeshBasicMaterial({side:DoubleSide});
const options={focus:V(),anchor:V(0,0,3),yaw:1,raycast:(ray,objects,recursive)=>ray.intersectObjects(objects,recursive)[0]||null,sampleTerrain:()=>0};
function box(x,y,z,sx,sy,sz){const mesh=new Mesh(new BoxGeometry(sx,sy,sz),material);mesh.position.set(x,y,z);mesh.updateMatrixWorld(true);return mesh;}
test('clear environment keeps the original anchor direction and matches the full authored pull-back',()=>{
 const result=chooseRebirthView(options);assert.equal(result.offset,0);assert.equal(result.yaw,0);assert.equal(result.candidates,1);assert.ok(result.probes<250);
 const start=rebirthViewPose({focus:V(),yaw:result.yaw,elapsed:0}),end=rebirthViewPose({focus:V(),yaw:result.yaw,elapsed:REBIRTH_OBSERVATION_DURATION});assert.equal(start.position.z,7.8);assert.equal(end.position.z,19);assert.ok(Math.abs(end.position.y-6.8)<1e-12);assert.ok(Math.abs(end.target.y-5.9)<1e-12);
 assert.equal(chooseRebirthView({...options,anchor:V(),yaw:.73}).yaw,.73);
});
test('a broad wall forces a stable side view instead of a late push toward the subject',()=>{
 const wall=box(0,8,6,80,20,.25),result=chooseRebirthView({...options,colliders:[wall]});assert.ok(result);assert.equal(result.offset,Math.PI/2);assert.equal(chooseRebirthView({...options,colliders:[wall]}).yaw,result.yaw);wall.geometry.dispose();
});
test('a nearby branch and a late pull-back obstruction are both checked before selecting a view',()=>{
 const branch=new Mesh(new SphereGeometry(.3,12,8),material);branch.position.set(0,2.6,7.8);branch.updateMatrixWorld(true);const near=chooseRebirthView({...options,colliders:[branch]});assert.ok(near);assert.equal(near.offset,Math.PI/12);
 const later=rebirthViewPose({focus:V(),yaw:0,elapsed:14}),trunk=box(later.position.x,later.position.y,later.position.z,.6,2,.6),far=chooseRebirthView({...options,colliders:[trunk]});assert.ok(far);assert.notEqual(far.offset,0);branch.geometry.dispose();trunk.geometry.dispose();
});
test('only the rebirth subject is excluded, including nested tagged parents; terrain remains solid',()=>{
 const group=new Group(),subject=box(0,5,0,1,12,1);group.userData.cameraSubject='rebirth-root';group.add(subject);group.updateMatrixWorld(true);assert.equal(chooseRebirthView({...options,colliders:[group]}).offset,0);
 const enclosure=box(0,5,0,5,20,5);assert.equal(chooseRebirthView({...options,colliders:[enclosure]}),null);assert.equal(chooseRebirthView({...options,sampleTerrain:()=>12}),null);assert.equal(chooseRebirthView({...options,sampleTerrain:()=>NaN}),null);assert.equal(chooseRebirthView({...options,raycast:null}),null);subject.geometry.dispose();enclosure.geometry.dispose();
});

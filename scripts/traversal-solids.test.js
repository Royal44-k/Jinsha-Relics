import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTraversalWorld} from '../src/v3/traversal-world.js';

function fixture(){
 const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),group=new THREE.Group(),path=new THREE.LineCurve3(V(),V(0,0,-400));
 const forest={group,path,length:400,sample:d=>V(0,0,-d),sampleGround:()=>0,sampleMain:p=>({distance:Math.max(0,Math.min(400,-p.z)),point:V(0,0,Math.max(-400,Math.min(0,p.z)))}),colliders:[],cameraColliders:[]};
 const world=createTraversalWorld(new THREE.Scene(),forest),hut=world.group.getObjectByName('Timber and thatch · artistic interpretation');world.group.updateMatrixWorld(true);
 return {world,V,house:(x=0,y=0,z=0)=>hut.localToWorld(V(x,y,z))};
}
test('wood floor and three entry steps provide actual foot support',()=>{const {world,house}=fixture();try{assert.equal(world.sample(house(0,.72,0)).groundHeight,.715);for(const [z,h]of [[-2.75,.18],[-2.39,.44],[-2.03,.715]])assert.ok(Math.abs(world.sample(house(0,h,z)).groundHeight-h)<1e-6);}finally{world.dispose();}});
test('floor blocks a body from passing through its underside while the steps stay accessible',()=>{const {world,house}=fixture();try{const underside=world.resolveMotion(house(-4,0,0),house(0,0,0));assert.ok(underside.hit);assert.ok(underside.position.distanceTo(house(0,0,0))>2);const landing=world.resolveMotion(house(0,1.2,0),house(0,.72,0));assert.equal(landing.hit,false);}finally{world.dispose();}});
test('nine posts and house posts collide below their tops and permit flight above',()=>{const {world,V,house}=fixture();try{assert.ok(world.resolveMotion(V(4.6,1,-336),V(6.6,1,-336)).hit);assert.equal(world.resolveMotion(V(4.6,5,-336),V(6.6,5,-336)).hit,false);assert.ok(world.resolveMotion(house(-3,1,-1.7),house(-1,1,-1.7)).hit);assert.equal(world.resolveMotion(house(-3,5,-1.7),house(-1,5,-1.7)).hit,false);}finally{world.dispose();}});
test('fog-hidden domestic groups stop rendering and a nearby photo camera reveals them without changing solids',()=>{const {world,V,house}=fixture();try{const farm=world.group.getObjectByName('Rice field · original domestic impression'),hut=world.group.getObjectByName('Timber and thatch · artistic interpretation');world.update(0,0,{position:V(0,0,0)});assert.equal(farm.visible,false);assert.equal(hut.visible,false);const camera=new THREE.PerspectiveCamera();camera.position.copy(house(0,3,-4));camera.lookAt(house(0,1,0));world.update(0,0,{position:V(0,0,0)},camera);assert.equal(farm.visible,true);assert.equal(hut.visible,true);assert.ok(world.resolveMotion(house(-3,1,-1.7),house(-1,1,-1.7)).hit);}finally{world.dispose();}});

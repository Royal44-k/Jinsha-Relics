import test from 'node:test';
import assert from 'node:assert/strict';
import {createLivingState,sanitizeLiving} from '../src/v6/living-state.js';
import * as THREE from 'three';
import {createLivingWorld} from '../src/v6/living-world.js';

const tick=(s,id,input,n=60)=>{for(let i=0;i<n;i++)s.update(.05,{id,distance:1,playing:true,listening:true,speed:0,mode:'grounded',...input});};
test('perch encounter needs actual still perching and listening, with one permanent reward',()=>{
 const events=[],s=createLivingState(null,e=>events.push(e));
 tick(s,'lantern-bough',{mode:'grounded'},100);assert.equal(s.serialize().completed.length,0);
 tick(s,'lantern-bough',{mode:'perched',listening:false},100);assert.equal(s.serialize().completed.length,0);
 tick(s,'lantern-bough',{mode:'perched'},60);assert.deepEqual(s.serialize().completed,['lantern-bough']);
 tick(s,'lantern-bough',{mode:'perched'},200);assert.equal(events.filter(e=>e.type==='complete').length,1);
});
test('fish require slow diving; rushing or dry ground cannot unlock',()=>{
 const s=createLivingState();tick(s,'river-mirror',{mode:'diving',speed:2.7},100);assert.equal(s.serialize().completed.length,0);
 tick(s,'river-mirror',{mode:'grounded'},100);assert.equal(s.serialize().completed.length,0);
 tick(s,'river-mirror',{mode:'diving',speed:.3},65);assert.deepEqual(s.serialize().completed,['river-mirror']);
});
test('bird invitation must precede flight, and distance/menus block progress',()=>{
 const s=createLivingState();tick(s,'wing-passage',{mode:'flying'},100);assert.equal(s.serialize().completed.length,0);
 tick(s,'wing-passage',{mode:'grounded'},45);assert.equal(s.snapshot('wing-passage').phase,'invited');
 tick(s,'wing-passage',{mode:'flying',playing:false},100);assert.equal(s.snapshot('wing-passage').progress,0);
 tick(s,'wing-passage',{mode:'flying',distance:30},100);assert.equal(s.serialize().completed.length,0);
 tick(s,'wing-passage',{mode:'flying'},55);assert.deepEqual(s.serialize().completed,['wing-passage']);
});
test('save normalization discards unknown IDs and partial timers never resume',()=>{
 assert.deepEqual(sanitizeLiving({completed:['river-mirror','bad','river-mirror'],discovered:['bad']}),{version:1,completed:['river-mirror'],discovered:['river-mirror']});
 const s=createLivingState();tick(s,'lantern-bough',{mode:'perched'},20);const save=s.serialize();s.restore(save);assert.equal(s.snapshot('lantern-bough').progress,0);
 s.restore({completed:['wing-passage']});assert.equal(s.snapshot('wing-passage').done,true);s.reset();assert.equal(s.serialize().completed.length,0);
});
test('leaving a moment releases partial observation, while paused menus preserve it',()=>{
 const s=createLivingState();tick(s,'river-mirror',{mode:'diving'},35);assert.ok(s.snapshot('river-mirror').progress>.5);
 for(let i=0;i<60;i++)s.update(.05,{playing:true});assert.equal(s.snapshot('river-mirror').progress,0);
 tick(s,'lantern-bough',{mode:'perched'},20);const p=s.snapshot('lantern-bough').progress;
 for(let i=0;i<60;i++)s.update(.05,{playing:false});assert.equal(s.snapshot('lantern-bough').progress,p);
});
test('actual scene animals are finite, low quality reduces instances, and disposal restores legacy school',()=>{
 const scene=new THREE.Scene(),g=new THREE.Group(),old=new THREE.Group();old.name='V4 · fork-tailed river school';g.add(old);
 const forest={length:400,path:new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,0,-400)),sample:d=>new THREE.Vector3(0,0,-d)};
 const traversal={group:g,perches:[{id:'branch-0',position:new THREE.Vector3(-2,4.9,-42)}],pool:new THREE.Vector3(12,-.2,-86),sample:()=>({groundHeight:-2.5})};
 const w=createLivingWorld({scene,forest,traversal});w.update(.1,.1,{playing:true,position:new THREE.Vector3(12,-1.1,-86),motion:{mode:'diving',speed:0},listening:true,quality:'low'});
 w.group.traverse(o=>{if(o.isInstancedMesh)for(const n of o.instanceMatrix.array)assert.ok(Number.isFinite(n));if(o.geometry?.attributes.position)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
 assert.equal(w.group.getObjectByName('Silver school · embodied encounter').count,20);assert.equal(old.visible,false);w.dispose();assert.equal(old.visible,true);assert.equal(scene.children.length,0);
});
test('flocks avoid the camera and do not rearrange while the photo camera moves',()=>{
 const scene=new THREE.Scene(),forest={length:400,path:new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,0,-400)),sample:d=>new THREE.Vector3(0,0,-d)},traversal={group:new THREE.Group(),perches:[],sample:()=>({groundHeight:-2.5})};
 const w=createLivingWorld({scene,forest,traversal}),p=new THREE.Vector3().fromArray(w.debug().moments[2].position),camera=new THREE.PerspectiveCamera();camera.position.copy(p).add(new THREE.Vector3(2.4,2.2,0));
 w.update(.1,.1,{playing:true,position:p,motion:{mode:'grounded',speed:0},camera});
 const flock=w.group.getObjectByName('Ivory passage · companion flock'),m=new THREE.Matrix4(),v=new THREE.Vector3();
 for(let i=0;i<flock.count;i++){flock.getMatrixAt(i,m);v.setFromMatrixPosition(m);assert.ok(v.distanceTo(camera.position)>1.99);}
 const before=Array.from(flock.instanceMatrix.array);camera.position.addScalar(3);w.update(.1,.2,{playing:false,camera});assert.deepEqual(Array.from(flock.instanceMatrix.array),before);w.dispose();
});

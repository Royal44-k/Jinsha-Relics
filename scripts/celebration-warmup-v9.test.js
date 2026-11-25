import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createDawnReprise} from '../src/v6/dawn-reprise.js';
import {createResonanceBurst} from '../src/v7/resonance-burst.js';

const renderState=object=>({visible:object.visible,frustumCulled:object.frustumCulled,count:object.count,opacity:object.material.opacity,depthWrite:object.material.depthWrite,materialVersion:object.material.version,geometry:object.geometry,material:object.material});

test('loading upload makes exactly the four celebration geometries drawable without color or depth writes',()=>{
 const scene=new T.Scene(),dawn=createDawnReprise(scene),burst=createResonanceBurst(scene),before=dawn.snapshot(),objects=[...dawn.group.children,burst.mesh],states=objects.map(renderState);
 const restoreDawn=dawn.prepareWarmup(),restoreBurst=burst.prepareWarmup();
 try{
  const drawables=[];scene.traverseVisible(object=>{if(object.isMesh||object.isPoints)drawables.push(object);});
  assert.equal(drawables.length,4);assert.equal(new Set(drawables.map(object=>object.geometry)).size,4);
  for(const object of drawables){assert.equal(object.frustumCulled,false);assert.equal(object.material.opacity,0);assert.equal(object.material.depthWrite,false);assert.equal(object.material.transparent,true);}
  assert.equal(burst.mesh.count,32);assert.equal(dawn.group.children[0].count,4);
  assert.equal(dawn.snapshot().age,before.age);assert.equal(dawn.snapshot().completed,before.completed);assert.equal(dawn.snapshot().reveal,before.reveal);
 }finally{restoreBurst();restoreDawn();}
 assert.deepEqual(dawn.snapshot(),before);assert.deepEqual(objects.map(renderState),states);
 // Preparing the draw must not schedule a delayed celebration either.
 burst.update(100);assert.equal(burst.mesh.visible,false);
 dawn.dispose();burst.dispose();
});

test('a failed loading draw restores an already active scene and cleanup is idempotent',()=>{
 const scene=new T.Scene(),dawn=createDawnReprise(scene),burst=createResonanceBurst(scene);
 const adventure={completed:true,finalTarget:[0,5,0],stages:[{id:'sun',position:[0,0,5]}]},position=new T.Vector3(0,0,2);
 for(let frame=0;frame<55;frame++)dawn.update(.05,frame*.05,{adventure,position});
 burst.trigger(5,position,4);burst.update(5.8,{quality:'low'});
 assert.equal(burst.mesh.count,18);assert.equal(burst.mesh.visible,true);
 const objects=[...dawn.group.children,burst.mesh];objects[1].visible=false;objects[2].frustumCulled=true;
 const before=dawn.snapshot(),states=objects.map(renderState),transforms=objects.map(object=>object.matrix.clone());
 const restoreDawn=dawn.prepareWarmup(),restoreBurst=burst.prepareWarmup();
 assert.throws(()=>{try{throw new Error('loading draw failed');}finally{restoreBurst();restoreDawn();}},/loading draw failed/);
 assert.deepEqual(dawn.snapshot(),before);assert.deepEqual(objects.map(renderState),states);
 objects.forEach((object,index)=>assert.deepEqual(object.matrix,transforms[index]));
 // Repeated finally/disposal paths must not overwrite changes made afterwards.
 burst.mesh.visible=false;dawn.group.visible=false;restoreBurst();restoreDawn();
 assert.equal(burst.mesh.visible,false);assert.equal(dawn.group.visible,false);
 // Warmup did not alter the original trigger time or duration.
 burst.update(6);assert.equal(burst.mesh.visible,true);burst.update(9.01);assert.equal(burst.mesh.visible,false);
 dawn.dispose();burst.dispose();
});

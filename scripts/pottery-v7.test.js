import test from 'node:test';
import assert from 'node:assert/strict';
import {createPotteryState,sanitizePottery,POTTERY_PROFILE} from '../src/v7/pottery-state.js';
import * as THREE from 'three';
import {createPotteryWorld,createPotteryGeometry} from '../src/v7/pottery-world.js';

test('pottery sanitizes malformed shapes and never restores a running firing',()=>{
 const a=sanitizePottery({profile:[NaN,Infinity],pattern:'evil',firing:3,works:Array(20).fill({profile:POTTERY_PROFILE,pattern:'ripple'})});
 assert.equal(a.profile.length,13);assert.ok(a.profile.every(n=>n>=.18&&n<=.68));assert.equal(a.pattern,'plain');assert.equal(a.works.length,3);assert.equal('firing' in a,false);
 const s=createPotteryState();s.fire();s.update(2,true);s.restore(s.serialize());assert.equal(s.snapshot().firing,false);assert.equal(s.snapshot().heat,0);
});
test('pottery has an actual open mouth, finite inner wall and a solid base at every allowed radius',()=>{
 for(const radius of [.18,.4,.68])for(const pattern of ['plain','ripple','seed']){
  const g=createPotteryGeometry(Array(13).fill(radius),pattern),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.updateMatrixWorld();
  for(const n of g.attributes.position.array)assert.ok(Number.isFinite(n));for(const n of g.attributes.normal.array)assert.ok(Number.isFinite(n));
  const down=new THREE.Raycaster(new THREE.Vector3(0,2,0),new THREE.Vector3(0,-1,0));const hit=down.intersectObject(m)[0];assert.ok(hit);assert.ok(hit.point.y<.13,'mouth is open down to the internal base');
  const side=new THREE.Raycaster(new THREE.Vector3(0,.7,0),new THREE.Vector3(1,0,0));const inner=side.intersectObject(m)[0];assert.ok(inner.point.x<radius&&inner.point.x>radius-.08);g.dispose();m.material.dispose();
 }
});
test('the pottery table blocks walking, allows flight over it and releases every owned geometry',()=>{
 const barkMap=new THREE.Texture(),scene=new THREE.Scene(),forest={surfaces:{bark:{map:barkMap}},group:new THREE.Group(),length:400,path:new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,0,-400)),sample:d=>new THREE.Vector3(0,0,-d)},traversal={sample:()=>({groundHeight:0})};
 const w=createPotteryWorld({scene,forest,traversal}),c=w.centre;assert.ok(w.group.children.some(o=>o.material?.map===barkMap),'early construction keeps the pending shared bark texture before image.src exists');
 const blocked=w.resolveMotion(c.clone().add(new THREE.Vector3(3,0,0)),c.clone().add(new THREE.Vector3(-3,0,0)));assert.ok(blocked.hit);
 const lowFlight=w.resolveMotion(c.clone().add(new THREE.Vector3(3,1,0)),c.clone().add(new THREE.Vector3(-3,1,0)));assert.equal(lowFlight.hit,true,'the vessel itself is solid above the table');
 const airborne=w.resolveMotion(c.clone().add(new THREE.Vector3(3,2.2,0)),c.clone().add(new THREE.Vector3(-3,2.2,0)));assert.equal(airborne.hit,false);
 w.update(.1,{position:c.clone().add(new THREE.Vector3(2,0,0)),motion:{mode:'grounded'},playing:true});assert.ok(w.snapshot().interaction);
 w.update(.1,{position:c.clone().add(new THREE.Vector3(2,0,0)),motion:{mode:'flying'},playing:true});assert.equal(w.snapshot().interaction,null);
 let geometries=0,disposed=0;w.group.traverse(o=>{if(o.geometry){geometries++;o.geometry.addEventListener('dispose',()=>disposed++);}});w.dispose();assert.equal(disposed,geometries);assert.equal(scene.children.length,0);
});
test('continuous local shaping leaves the distant foot alone and creates a bounded hollow profile',()=>{
 const s=createPotteryState(),before=s.snapshot().profile;s.shape(.75,.13);const after=s.snapshot().profile;
 assert.ok(after[9]>before[9]+.06);assert.equal(after[0],before[0]);assert.ok(Math.abs(after[3]-before[3])<.005);
 for(let i=0;i<1000;i++)s.shape(i%2,.4);assert.ok(s.snapshot().profile.every(n=>n>=.18&&n<=.68));
 s.shape(.5,NaN);assert.ok(s.snapshot().profile.every(Number.isFinite));
});
test('firing progresses only while live and preserves the exact authored form once',()=>{
 const events=[],s=createPotteryState(null,e=>events.push(e));s.shape(.4,.1);s.setPattern('seed');const own=s.snapshot().profile;s.fire();
 for(let i=0;i<100;i++)s.update(.1,false);assert.equal(s.snapshot().heat,0);assert.equal(s.shape(.4,.1),false);
 for(let i=0;i<85;i++)s.update(.1,true);assert.equal(s.snapshot().fired,true);assert.equal(s.snapshot().works.length,1);assert.deepEqual(s.snapshot().works[0].profile,own);assert.equal(s.snapshot().works[0].pattern,'seed');
 for(let i=0;i<85;i++)s.update(.1,true);assert.equal(events.filter(e=>e.type==='fired').length,1);s.restore(s.serialize());assert.equal(s.snapshot().fired,true);assert.equal(s.snapshot().works.length,1);
});
test('remaking keeps the last three personal works while resetting only the wet clay',()=>{
 const s=createPotteryState();for(let n=0;n<5;n++){s.shape(.3+n*.1,.04);s.fire();for(let i=0;i<85;i++)s.update(.1,true);if(n<4)s.remake();}
 assert.equal(s.snapshot().works.length,3);assert.equal(s.snapshot().totalMade,5);const saved=s.serialize();s.remake();assert.equal(s.snapshot().works.length,3);assert.equal(s.snapshot().fired,false);assert.equal(saved.works.length,3);
 s.reset();assert.equal(s.snapshot().works.length,0);assert.equal(s.snapshot().totalMade,0);
});
test('a pointer stroke undoes as a whole, and undo cannot modify a fired vessel',()=>{
 const s=createPotteryState(),before=s.serialize();s.beginStroke();for(let i=0;i<30;i++)s.shape(.7,.004);s.endStroke();assert.notDeepEqual(s.serialize().profile,before.profile);assert.equal(s.snapshot().canUndo,true);s.undo();assert.deepEqual(s.serialize(),before);assert.equal(s.snapshot().canUndo,false);
 s.setPattern('ripple');s.undo();assert.equal(s.snapshot().pattern,'plain');s.shape(.4,.05);s.fire();assert.equal(s.undo(),false);for(let i=0;i<80;i++)s.update(.1,true);assert.equal(s.undo(),false);s.restore(s.serialize());assert.equal(s.snapshot().canUndo,false);
});
test('viewing old works is read-only and returning restores the exact current clay geometry',()=>{
 const scene=new THREE.Scene(),forest={group:new THREE.Group(),length:400,path:new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,0,-400)),sample:d=>new THREE.Vector3(0,0,-d)},traversal={sample:()=>({groundHeight:0})},saved={profile:POTTERY_PROFILE.map((r,i)=>i>4?r+.05:r),pattern:'seed',works:[{profile:Array(13).fill(.23),pattern:'plain'},{profile:Array(13).fill(.55),pattern:'ripple'}],totalMade:2};
 const w=createPotteryWorld({scene,forest,traversal,saved});w.setActive(true);w.update(.1,{position:w.centre.clone().add(new THREE.Vector3(2,0,0)),playing:true,active:true});const before=w.serialize(),mesh=w.group.getObjectByName('Your own hollow vessel'),positions=Array.from(mesh.geometry.attributes.position.array);
 assert.equal(w.showWork(0),true);assert.equal(w.snapshot().viewingWork,0);assert.equal(w.snapshot().displayFired,true);assert.notDeepEqual(Array.from(mesh.geometry.attributes.position.array),positions);
 assert.equal(w.shape(.5,.1),false);assert.equal(w.smooth(.5),false);assert.equal(w.setPattern('plain'),false);assert.equal(w.fire(),false);assert.equal(w.remake(),false);assert.equal(w.undo(),false);assert.deepEqual(w.serialize(),before);
 w.showWork(1);assert.equal(w.snapshot().displayPattern,'ripple');assert.deepEqual(w.serialize(),before);w.showWork(null);assert.equal(w.snapshot().viewingWork,null);assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),positions);assert.deepEqual(w.serialize(),before);
 assert.equal(w.showWork(999),false);w.dispose();
});
test('quality changes reduce vessel mesh cost while preserving the authored form and inner opening',()=>{
 const scene=new THREE.Scene(),forest={group:new THREE.Group(),length:400,path:new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,0,-400)),sample:d=>new THREE.Vector3(0,0,-d)},traversal={sample:()=>({groundHeight:0})},w=createPotteryWorld({scene,forest,traversal});w.setActive(true);const ctx={position:w.centre.clone().add(new THREE.Vector3(2,0,0)),playing:true,active:true};w.update(.1,{...ctx,quality:'high'});w.shape(.6,.05);w.update(.1,ctx);const mesh=w.group.getObjectByName('Your own hollow vessel'),high=mesh.geometry.index.count,shape=w.serialize();w.update(.1,{...ctx,quality:'low'});assert.ok(mesh.geometry.index.count<high*.65);assert.deepEqual(w.serialize(),shape);const lowGeometry=mesh.geometry;w.update(.1,{...ctx,quality:'low'});assert.equal(mesh.geometry,lowGeometry,'unchanged frames do not allocate a new pot');w.dispose();
});
test('the nearby pottery invitation is emitted once and saved discovery never repeats it',()=>{
 const scene=new THREE.Scene(),forest={group:new THREE.Group(),length:400,path:new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,0,-400)),sample:d=>new THREE.Vector3(0,0,-d)},traversal={sample:()=>({groundHeight:0})},events=[],w=createPotteryWorld({scene,forest,traversal,onEvent:e=>events.push(e)});const position=w.centre.clone().add(new THREE.Vector3(8,0,0));
 w.update(.1,{position,playing:false});assert.equal(events.length,0);w.update(.1,{position,playing:true});w.update(.1,{position,playing:true});assert.equal(events.filter(e=>e.type==='discover').length,1);assert.ok(events.find(e=>e.type==='change'));const save=w.serialize();w.restore(save);w.update(.1,{position,playing:true});assert.equal(events.filter(e=>e.type==='discover').length,1);w.dispose();
});

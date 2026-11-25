import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createPotteryWorld} from '../src/v7/pottery-world.js';
import {createLocomotion} from '../src/v3/locomotion.js';
import {STORE,readSave,writeSave} from '../src/v2/journey.js';
import {createPotteryState} from '../src/v7/pottery-state.js';

function setup(){
 const scene=new T.Scene(),forest={group:new T.Group(),length:400,path:new T.LineCurve3(new T.Vector3(),new T.Vector3(0,0,-400)),sample:d=>new T.Vector3(0,0,-d)};
 const sample=()=>({groundHeight:0,waterLevel:null,waterDepth:0,ceil:16,surface:'soil'});
 const pottery=createPotteryWorld({scene,forest,traversal:{sample}});
 return {pottery,sample};
}

test('solid pottery contact supplies the normal required for movement and obstacle feedback',()=>{
 const {pottery,sample}=setup(),events=[],position=pottery.centre.clone().add(new T.Vector3(3,0,0));
 const motion=createLocomotion({position,world:{sample,resolveMotion:pottery.resolveMotion},onEvent:e=>events.push(e)});
 for(let n=0;n<180;n++)motion.update(1/60,{moveX:-1,moveZ:0,yaw:0});
 assert.ok(position.x>pottery.centre.x+1.4,'table prevents walking through');
 assert.ok(events.some(e=>e.type==='obstacle'&&/陶案/.test(e.text)),'the physical contact explains why it blocked the player');
 pottery.dispose();
});

test('a pre-pottery version 2 save keeps its chapter inventory and safe position through the new writer',()=>{
 const legacy={version:2,collected:['bird','jade'],completed:false,distance:123.45,lights:[1],travel:{safePosition:[2,.1,-119],safePerchId:null},settings:{quality:'low',music:.2}};
 let value=JSON.stringify(legacy);const storage={getItem:k=>k===STORE?value:null,setItem:(k,v)=>{assert.equal(k,STORE);value=v;}};
 const migrated=readSave(storage);assert.deepEqual(migrated.collected,legacy.collected);assert.deepEqual(migrated.travel,legacy.travel);assert.equal(migrated.distance,legacy.distance);assert.equal(migrated.pottery.totalMade,0);
 assert.equal(writeSave({...migrated,collected:new Set(migrated.collected)},storage),true);
 const restored=readSave(storage);assert.deepEqual(restored.adventure,migrated.adventure);assert.deepEqual(restored.collected,migrated.collected);assert.deepEqual(restored.travel,migrated.travel);assert.deepEqual(restored.settings,migrated.settings);
});

test('saving a second partly fired vessel keeps the prior work and restores the editable current form',()=>{
 const p=createPotteryState();p.shape(.55,.06);p.setPattern('seed');p.fire();for(let i=0;i<76;i++)p.update(.1,true);const first=p.serialize().works[0];p.remake();p.shape(.9,-.05);const current=p.serialize().profile;p.fire();for(let i=0;i<19;i++)p.update(.1,true);
 let value;const storage={setItem:(_,v)=>value=v,getItem:()=>value};writeSave({collected:new Set(['bird']),distance:250,completed:false,settings:{},pottery:p.serialize()},storage);
 const restored=createPotteryState(readSave(storage).pottery);assert.equal(restored.snapshot().firing,false);assert.equal(restored.snapshot().fired,false);assert.deepEqual(restored.snapshot().profile,current);assert.equal(restored.snapshot().totalMade,1);assert.deepEqual(restored.snapshot().works,[first]);
});

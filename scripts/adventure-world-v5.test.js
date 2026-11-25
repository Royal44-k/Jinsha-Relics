import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAdventureWorld} from '../src/v5/adventure-world.js';

function setup(saved,withProjection=false){
 const scene=new THREE.Scene(),path=new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,0,-400));
 const forest={length:400,path,sample:d=>new THREE.Vector3(0,0,-d),sampleGround:()=>0};
 if(withProjection)forest.project=p=>({distance:Math.max(0,Math.min(400,-p.z))});
 const traversal={perches:[],sample:()=>({groundHeight:-2,waterLevel:-.2})},events=[];
 const world=createAdventureWorld({scene,forest,traversal,saved,onEvent:e=>events.push(e)});let time=0;
 const move=(p,other={})=>{time+=.05;world.update(.05,time,{position:new THREE.Vector3().fromArray(p),motion:{mode:'grounded',stamina:1},yaw:0,playing:true,...other});};
 return {world,events,move,scene};
}

test('all five chapters can complete through spatial update and E/F without quiz or private mutation',()=>{
 const {world,events,move}=setup();const positions=world.debug();
 for(let i=0;i<3;i++){move(positions.targets.find(t=>t.id===`root-bud-${i}`).position);assert.equal(world.interact(),true);assert.equal(world.snapshot().inventory.carried,true);move(positions.targets.find(t=>t.id===`root-socket-${i}`).position);assert.equal(world.interact(),true);}
 assert.equal(world.snapshot().stages[0].done,true);
 for(const [i,turns] of [1,3,2].entries()){move(positions.targets.find(t=>t.id===`light-wheel-${i}`).position);for(let n=0;n<turns;n++)assert.equal(world.interact(),true);}
 assert.equal(world.snapshot().stages[1].done,true);
 for(const [i,turns] of [3,2,1].entries()){move(positions.targets.find(t=>t.id===`water-wheel-${i}`).position);for(let n=0;n<turns;n++)assert.equal(world.interact(),true);}
 assert.equal(world.snapshot().stages[2].done,true);
 move(positions.targets.find(t=>t.id==='flight-start').position);world.interact();
 for(const ring of positions.rings){const a=ring.position.map((n,i)=>n-ring.normal[i]*2),b=ring.position.map((n,i)=>n+ring.normal[i]*2);move(a,{motion:{mode:'flying',stamina:.3}});move(b,{motion:{mode:'flying',stamina:.3}});}
 assert.equal(world.snapshot().stages[3].done,true);
 const stand=positions.targets.find(t=>t.id==='sun-focus').position,dx=positions.finalTarget[0]-stand[0],dz=positions.finalTarget[2]-stand[2],yaw=Math.atan2(-dx,-dz);
 for(let i=0;i<40;i++)move(stand,{yaw,lightHeld:true});
 assert.equal(world.snapshot().completed,true);assert.equal(events.filter(e=>e.type==='stage').length,5);assert.equal(events.filter(e=>e.type==='complete').length,1);
 world.dispose();assert.equal(sceneChildren(world),0);
 function sceneChildren(w){return w.group.parent?1:0;}
});

test('location and playing state are required for interaction; optional discoveries persist',()=>{
 const {world,move}=setup();assert.equal(world.interact(),false);move([100,0,0]);assert.equal(world.interact(),false);
 for(const f of world.debug().feathers){move([f.position[0],f.position[1]-.55,f.position[2]]);assert.equal(world.interact(),true,f.id);}
 assert.equal(world.snapshot().inventory.feathers,12);const saved=world.serialize();world.reset();assert.equal(world.snapshot().inventory.feathers,0);world.restore(saved);assert.equal(world.snapshot().inventory.feathers,12);world.dispose();
});

test('menus freeze an active flight and restored data never restores a running timer',()=>{
 const {world,move}=setup();move(world.debug().targets.find(t=>t.id==='flight-start').position);world.interact();move([0,2,-280]);const before=world.snapshot().challenge.time;
 world.update(10,100,{playing:false});assert.equal(world.snapshot().challenge.time,before);const save=world.serialize();world.restore(save);move([0,0,-278]);assert.equal(world.snapshot().challenge.active,false);world.dispose();
});

test('listening gives the actual nearest carry target with camera-relative left/right',()=>{
 const {world,move}=setup(),bud=world.debug().targets.find(t=>t.id==='root-bud-0');
 move([bud.position[0]-4,0,bud.position[2]],{yaw:0,listening:true});let hint=world.getHint();assert.equal(hint.direction,'右侧');assert.ok(hint.bearing>0);assert.equal(hint.label,'散落的光芽');
 move([bud.position[0]+4,0,bud.position[2]],{yaw:0,listening:true});hint=world.getHint();assert.equal(hint.direction,'左侧');assert.ok(hint.bearing<0);
 move(bud.position);world.interact();assert.equal(world.getHint().label,'等候光芽的空巢');world.dispose();
});

test('off-path listening guides back to the valley before following its winding route',()=>{
 const {world,move}=setup(undefined,true);move([18,0,-15],{yaw:0,listening:true});let hint=world.getHint();assert.equal(hint.label,'河谷小径');assert.equal(hint.direction,'左侧');assert.equal(hint.distance,18);assert.deepEqual(hint.position,[0,0,-15]);
 move([0,0,-15],{yaw:0,listening:true});hint=world.getHint();assert.equal(hint.direction,'正前方');assert.equal(hint.distance,10);assert.deepEqual(hint.position,[0,0,-25]);world.dispose();
});

test('final focus hints use the real stand radius and never instruct the player to fly upward',()=>{
 const {world,move}=setup();world.restore(null,['bird','jade','mask','tiger']);const stand=world.debug().targets.find(t=>t.id==='sun-focus').position;
 move([stand[0]+1.9,stand[1],stand[2]]);assert.equal(world.getHint().label,'九柱观景位');assert.notEqual(world.snapshot().interaction?.key,'F');
 move(stand);assert.equal(world.getHint().label,'远方的日轮');assert.equal(world.snapshot().interaction.key,'F');assert.ok(!world.getHint().text.includes('升高'));world.dispose();
});

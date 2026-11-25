import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAdventureWorld} from '../src/v5/adventure-world.js';

function setup(saved){const scene=new T.Scene(),path=new T.LineCurve3(new T.Vector3(),new T.Vector3(0,0,-400)),events=[],traversal={perches:[],groundAt:()=>0};const forest={length:400,path,sample:d=>new T.Vector3(0,0,-d),sampleGround:()=>0};const world=createAdventureWorld({scene,forest,traversal,saved,onEvent:e=>events.push(e)});let time=0;const move=(p,extra={},dt=.05)=>{time+=dt;world.update(dt,time,{position:new T.Vector3().fromArray(p),playing:true,motion:{mode:'grounded',stamina:1},yaw:0,...extra});};return {world,move,events,traversal};}
const target=(world,id)=>world.debug().targets.find(t=>t.id===id).position;
const yawTo=(a,b)=>Math.atan2(-(b[0]-a[0]),-(b[2]-a[2]));
test('world encounters are discovered spatially, accept real E exposure hits, reject backward pulses, and preserve rewards',()=>{
 const {world,move,events}=setup({root:{slots:[0,1,2]}}),p=target(world,'encounter-reed'),core=world.debug().encounters.find(e=>e.id==='reed').position,yaw=yawTo(p,core);
 assert.equal(world.snapshot().encounters.every(e=>!e.discovered&&e.position===null),true);move(p,{yaw});assert.equal(world.snapshot().interaction.label,'唤醒蚀影 · 开始净化');assert.equal(world.interact(),true);
 const air=p.map((n,i)=>n+(i===1?1.1:0));let guard=0;while(world.snapshot().encounter.phase!=='exposed'&&guard++<300)move(air,{yaw,motion:{mode:'flying'}});
 assert.equal(world.snapshot().encounter.ward,3);move(air,{yaw,facingYaw:yaw+Math.PI,motion:{mode:'flying'}});assert.equal(world.snapshot().encounter.facing,false);assert.equal(world.pulse(),false);assert.equal(world.snapshot().encounter.health,2);
 for(let i=0;i<16;i++)move(air,{yaw,facingYaw:yaw,motion:{mode:'flying'}});assert.equal(world.interact(),true);
 guard=0;while(world.snapshot().encounter.phase!=='exposed'&&guard++<300)move(air,{yaw,motion:{mode:'flying'}});assert.equal(world.interact(),true);
 assert.equal(world.snapshot().encounter.phase,'cleared');assert.equal(world.snapshot().growth.level,1);assert.deepEqual(world.serialize().expedition.cleared,['reed']);
 const save=world.serialize(),count=events.filter(e=>e.type==='encounter-cleared').length;world.restore(save);move(p,{yaw});assert.equal(world.snapshot().encounters[0].cleared,true);assert.equal(world.snapshot().growth.level,1);assert.equal(events.filter(e=>e.type==='encounter-cleared').length,count);
 for(const event of events.filter(e=>e.type==='cue'&&e.id==='reed'))assert.deepEqual(event.position,[core[0],core[1]+1.28,core[2]]);world.dispose();
});
test('world battle offers failure, retry and safe exit, while menus freeze the actual active challenge',()=>{
 const {world,move}=setup(),p=target(world,'encounter-stone');move(p);world.interact();const before=world.snapshot().encounter;for(let i=0;i<100;i++)move(p,{playing:false});assert.equal(world.snapshot().encounter.progress,before.progress);
 let guard=0;while(world.snapshot().encounter.phase!=='retry'&&guard++<1000)move(p);assert.equal(world.snapshot().encounter.ward,0);assert.equal(world.snapshot().interaction.label,'重新凝起护光');assert.equal(world.interact(),true);assert.equal(world.snapshot().encounter.ward,3);
 move([100,0,0]);assert.equal(world.snapshot().encounter,null);move(p);assert.equal(world.snapshot().encounter.phase,'idle');world.dispose();
});
test('three returned buds grow a mature tree, unlock a real branch, and allow a reward-free replay',()=>{
 const {world,move,traversal,events}=setup();for(let i=0;i<3;i++){move(target(world,'root-bud-'+i));world.interact();move(target(world,'root-socket-'+i));world.interact();}
 const stand=target(world,'root-memory');for(let i=0;i<360;i++)move(stand);assert.equal(world.snapshot().rootLife.phase,'mature');assert.equal(traversal.perches.filter(p=>p.id==='reborn-root-bough').length,1);assert.ok(traversal.perches.at(-1).position.y>5.8);
 assert.equal(world.interact(),true);move(stand);assert.ok(world.snapshot().rootLife.progress<.02);assert.equal(traversal.perches.some(p=>p.id==='reborn-root-bough'),false);assert.equal(events.filter(e=>e.type==='stage'&&e.id==='root').length,1);
 world.restore(world.serialize());assert.equal(world.snapshot().rootLife.phase,'mature');assert.equal(traversal.perches.filter(p=>p.id==='reborn-root-bough').length,1);world.dispose();
});
test('focus feedback separates central position from character facing and never uses camera yaw over real facing',()=>{
 const saved={root:{slots:[0,1,2]},light:{turns:[1,3,2]},water:{turns:[0,2,0]},trial:{completed:true}}, {world,move}=setup(saved),p=target(world,'sun-focus'),sun=world.debug().finalTarget,yaw=yawTo(p,sun);
 move([p[0],p[1]+1.3,p[2]],{yaw,facingYaw:yaw+Math.PI,lightHeld:false});let guide=world.snapshot().focusGuide;assert.equal(guide.inPosition,true);assert.equal(guide.reason,'hold');assert.equal(guide.facing,false);
 move(p,{yaw,facingYaw:yaw+Math.PI,lightHeld:true});assert.equal(world.snapshot().focusGuide.reason,'turn');assert.equal(world.snapshot().focus,0);
 for(let i=0;i<38;i++)move(p,{yaw:yaw+Math.PI,facingYaw:yaw,lightHeld:true});assert.equal(world.snapshot().completed,true);assert.equal(world.snapshot().growth.level,2);world.dispose();
});

test('loading an unfinished journey immediately removes a previous journey branch before checkpoint validation',()=>{
 const {world,move,traversal}=setup({root:{slots:[0,1,2]}}),perch=traversal.perches.find(p=>p.id==='reborn-root-bough');
 move(perch.position.toArray(),{motion:{mode:'perched',perchId:perch.id}});
 world.restore({root:{slots:[0,null,null]}});
 assert.equal(world.snapshot().rootLife.phase,'sprouting');assert.equal(traversal.perches.some(p=>p.id===perch.id),false);
 world.restore({root:{slots:[0,1,2]}});move(perch.position.toArray(),{motion:{mode:'perched',perchId:perch.id}});world.reset();
 assert.equal(world.snapshot().rootLife.phase,'dormant');assert.equal(traversal.perches.some(p=>p.id===perch.id),false);world.dispose();
});

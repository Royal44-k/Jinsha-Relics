import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootfallTracker,createCameraResponse} from '../src/v7/travel-response.js';

const foot=(id,x,planted=true)=>({id,position:{x,y:0,z:0},planted});
test('an ordinary 200ms frame does not suppress a real new foot contact',()=>{
 const t=createFootfallTracker(),step=(dt,f)=>t.update(dt,{mode:'grounded',speed:3.9,position:{x:0,y:0,z:0},feet:[f],sample:()=>({groundHeight:0,surface:'soil'})});
 step(.1,foot('left',0));step(.01,foot('left',.1,false));assert.equal(step(.2,foot('left',.4,true)).length,1);
});
test('footfalls follow each landing, never stationary frames or suspended time',()=>{
 const t=createFootfallTracker();const step=(dt,feet)=>t.update(dt,{mode:'grounded',speed:1.9,position:{x:0,y:0,z:0},feet,sample:()=>({groundHeight:0,surface:'soil'})});
 assert.deepEqual(step(.02,[foot('left',0),foot('right',0)]),[]);
 assert.deepEqual(step(.2,[foot('left',.2,false),foot('right',0)]),[]);
 assert.equal(step(.2,[foot('left',.4),foot('right',0)]).length,1);
 for(let i=0;i<20;i++)assert.equal(step(.02,[foot('left',.4),foot('right',0)]).length,0);
 step(.2,[foot('left',.6,false)]);assert.equal(step(0,[foot('left',.8)]).length,0);
 assert.equal(step(.2,[foot('left',.8)]).length,1);
});
test('airborne, underwater and teleport discontinuities produce no walking marks',()=>{
 const t=createFootfallTracker(),sample=()=>({groundHeight:0,surface:'mud'}),position={x:0,y:0,z:0};
 t.update(.1,{mode:'grounded',speed:2,position,feet:[foot('left',0)],sample});
 t.update(.2,{mode:'grounded',speed:2,position,feet:[foot('left',.2,false)],sample});
 assert.equal(t.update(.2,{mode:'flying',speed:5,position,feet:[foot('left',.4)],sample}).length,0);
 assert.equal(t.update(.2,{mode:'grounded',speed:2,position:{x:30,y:0,z:0},feet:[foot('left',30)],sample}).length,0);
 t.reset();assert.equal(t.snapshot().count,0);
});
test('camera landing response is bounded, pause-safe and disabled by reduced motion',()=>{
 const c=createCameraResponse();c.impulse(8);let peak=0;for(let i=0;i<100;i++){let v=c.update(1/60,{speed:0});peak=Math.max(peak,Math.abs(v.y));assert.ok(Number.isFinite(v.y));}
 assert.ok(peak>0&&peak<=.085);const before={...c.snapshot()};c.update(0,{speed:8});assert.deepEqual(c.snapshot(),before);
 c.impulse(15);assert.deepEqual(c.update(.016,{speed:7,reduced:true}),{y:0,roll:0});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createMechanismCollision} from '../src/v5/adventure-collision.js';
const V=(x=0,y=0,z=0)=>new Vector3(x,y,z);

test('root collision is swept, slides around its real trunk and permits flight above it',()=>{
 const world=createMechanismCollision({rootPosition:V(),jadePosition:V(30,0,0)});
 const through=world.resolveMotion(V(-3,0,0),V(3,0,0),.27);assert.equal(through.hit,true);assert.ok(through.position.x<0);
 const over=world.resolveMotion(V(-3,2,0),V(3,2,0),.27);assert.equal(over.hit,false);assert.ok(over.position.distanceTo(V(3,2,0))<.001);
 const around=world.resolveMotion(V(-3,0,1),V(3,0,1),.27);assert.equal(around.hit,false);
});

test('jade discs stop high-speed flight, frames stop edge clipping and controls remain reachable',()=>{
 const world=createMechanismCollision({rootPosition:V(30,0,0),jadePosition:V()});
 const through=world.resolveMotion(V(0,1,-8),V(0,1,8));assert.equal(through.hit,true);assert.ok(through.position.z< -2.45);
 const over=world.resolveMotion(V(0,2.8,-8),V(0,2.8,8));assert.equal(over.hit,false);
 const frame=world.resolveMotion(V(1.06,0,-4),V(1.06,0,-1));assert.equal(frame.hit,true);
 for(const z of [-2.45,0,2.45]){const control=V(1.85,0,z),stationary=world.resolveMotion(control,control);assert.equal(stationary.hit,false);assert.ok(stationary.position.distanceTo(control)<.0001);}
});

test('oriented jade collision uses the same world rotation as the rendered assembly',()=>{
 const world=createMechanismCollision({rootPosition:V(-30,0,0),jadePosition:V(10,0,20),jadeYaw:Math.PI/2});
 const blocked=world.resolveMotion(V(2,1,20),V(18,1,20));assert.equal(blocked.hit,true);assert.ok(blocked.position.x<10);
 const overhead=world.resolveMotion(V(2,3,20),V(18,3,20));assert.equal(overhead.hit,false);
});

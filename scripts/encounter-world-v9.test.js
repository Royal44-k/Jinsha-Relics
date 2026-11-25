import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createEncounterWorld} from '../src/v9/encounter-world.js';
import {createExpeditionState} from '../src/v9/expedition-state.js';
function create(slope=false){const parent=new T.Group(),bark=new T.MeshStandardMaterial(),rock=new T.MeshStandardMaterial(),ground=p=>slope?p.x*.08+p.z*.02:0;const world=createEncounterWorld({parent,at:(fraction,lateral)=>{const p=new T.Vector3(lateral,0,-fraction*400);p.y=ground(p);return p;},tangent:()=>new T.Vector3(0,0,-1),bark,rock,ground});return {world,parent,bark,rock,ground};}
test('arena waves stay on sampled terrain while their radius advances, including translated/rotated cells',()=>{
 const {world,ground,bark,rock}=create(true),item=world.items[0];item.terrain.fill(item.wave.geometry,5.3);item.group.updateWorldMatrix(true,true);const p=item.wave.geometry.attributes.position;
 for(let i=0;i<p.count;i++){const local=new T.Vector3().fromBufferAttribute(p,i),point=item.group.localToWorld(local.clone());assert.ok(Math.abs(point.y-ground(point)-.075)<.003);assert.ok(Math.hypot(local.x,local.z)>4.9&&Math.hypot(local.x,local.z)<5.4);}
 world.dispose();bark.dispose();rock.dispose();
});
test('stone corridor collision is swept and leaves a walkable middle and flyable roof',()=>{
 const {world,bark,rock}=create(),core=world.items[1].position,from=core.clone().add(new T.Vector3(-6,0,0)),to=core.clone().add(new T.Vector3(-1,0,0));const blocked=world.resolveMotion(from,to);assert.equal(blocked.hit,true);assert.ok(blocked.position.x<core.x-4.1);
 assert.equal(world.resolveMotion(core.clone().add(new T.Vector3(0,0,5)),core.clone().add(new T.Vector3(0,0,-5))),null);assert.equal(world.resolveMotion(from.clone().setY(6),to.clone().setY(6)),null);world.dispose();bark.dispose();rock.dispose();
});
test('restored arenas show distinct regional geometry and do not regrow rewards on every visit',()=>{
 const {world,bark,rock}=create(),state=createExpeditionState({saved:{cleared:['reed','stone','dusk']}});world.restore(state.data.cleared);
 for(const item of world.items){world.update(.05,1,{player:item.position,state});assert.equal(item.restored.visible,true);assert.equal(item.restored.scale.y,1);assert.ok(item.restored.children.length>=1);assert.equal(item.shells.every(s=>!s.visible),true);}
 assert.notEqual(world.items[0].restored.children.length,world.items[1].restored.children.length);const item=world.items[2],height=item.coreGroup.position.y,yaw=item.core.rotation.y;world.update(0,99,{player:item.position,state});assert.equal(item.coreGroup.position.y,height);assert.equal(item.core.rotation.y,yaw);world.dispose();bark.dispose();rock.dispose();
});

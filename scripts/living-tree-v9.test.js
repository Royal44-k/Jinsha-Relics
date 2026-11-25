import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createLivingTree,treeLifePose,TREE_REBIRTH_SECONDS} from '../src/v9/living-tree.js';
test('rebirth is continuous, monotonic, starts dead and ends with a green tall canopy',()=>{
 let previous=treeLifePose(0);assert.equal(previous.phase,'dormant');assert.equal(previous.leafScale,0);
 for(let age=.01;age<=18;age+=.01){const pose=treeLifePose(age,3);assert.ok(pose.height>=previous.height);assert.ok(pose.height-previous.height<.04);assert.ok(pose.leafScale>=previous.leafScale);previous=pose;}
 const mature=treeLifePose(TREE_REBIRTH_SECONDS,3);assert.equal(mature.phase,'mature');assert.ok(mature.height>14);assert.equal(mature.leafScale,1);
});
test('tree lifecycle pauses, restores mature saves, and replays without repeated journey rewards',()=>{
 const parent=new T.Group(),bark=new T.MeshStandardMaterial(),events=[],tree=createLivingTree({parent,bark,onEvent:e=>events.push(e)});
 tree.update(.1,{lights:1});assert.equal(tree.snapshot().phase,'sprouting');assert.equal(tree.snapshot().progress,0);
 for(let i=0;i<80;i++)tree.update(.25,{lights:3,playing:false});assert.equal(tree.snapshot().progress,0);
 for(let i=0;i<72;i++)tree.update(.25,{lights:3});assert.equal(tree.snapshot().phase,'mature');assert.equal(tree.replay(),true);assert.equal(tree.replay(),false);
 assert.equal(tree.snapshot().progress,0);tree.restore({completed:true,lights:3});assert.equal(tree.snapshot().progress,1);assert.equal(tree.snapshot().replaying,false);
 assert.equal(events.some(e=>['stage','change','growth'].includes(e.type)),false);tree.dispose();assert.equal(parent.children.length,0);bark.dispose();
});
test('authored tree geometry is finite, has tiered branches and true leaf silhouettes',()=>{
 const parent=new T.Group(),bark=new T.MeshStandardMaterial(),tree=createLivingTree({parent,bark,completed:true,lights:3});assert.equal(tree.debug().branches,9);assert.ok(tree.debug().leaves>1500);
 parent.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(const n of p.array)assert.ok(Number.isFinite(n));if(o.isInstancedMesh){assert.ok(o.geometry.attributes.position.count>20);assert.ok(o.instanceColor);}});
 tree.dispose();bark.dispose();
});
test('resting branch bark has a real two-dimensional unwrap, rather than a collapsed ring stripe',()=>{
 const parent=new T.Group(),bark=new T.MeshStandardMaterial(),tree=createLivingTree({parent,bark,completed:true,lights:3}),branch=tree.group.children.find(g=>g.isGroup&&g.children.some(m=>m.name==='骨干枝与三级细枝')).children.find(m=>m.name==='骨干枝与三级细枝'),uv=branch.geometry.attributes.uv,index=branch.geometry.index;
 for(let i=0;i<80*20*6;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),area=(uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a));assert.ok(Math.abs(area)>1e-6,'each coarse-branch triangle must span UV area');}
 tree.dispose();bark.dispose();
});

test('restoring mature history is silent while an explicit replay emits its new lifecycle',()=>{
 const parent=new T.Group(),bark=new T.MeshStandardMaterial(),events=[],tree=createLivingTree({parent,bark,completed:true,lights:3,onEvent:e=>events.push(e)});
 tree.update(.1,{lights:3});assert.deepEqual(events,[]);
 tree.restore({completed:true,lights:3});tree.update(.1,{lights:3});assert.deepEqual(events,[]);
 assert.equal(tree.replay(),true);tree.update(.1,{lights:3});assert.equal(events.filter(e=>e.type==='tree-rebirth').length,1);assert.equal(events.some(e=>e.type==='tree-life'&&e.phase==='awakening'&&e.replay),true);
 tree.dispose();bark.dispose();
});

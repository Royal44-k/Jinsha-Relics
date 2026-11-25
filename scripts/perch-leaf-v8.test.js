import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createPerchLeafGeometry,PERCH_LEAF_RECT} from '../src/v8/perch-leaf.js';
import {createTraversalWorld} from '../src/v3/traversal-world.js';

test('perch leaves bend in both directions and sample exactly one existing atlas leaf',()=>{
 const g=createPerchLeafGeometry(),p=g.attributes.position,uv=g.attributes.uv;assert.equal(p.count,12);assert.equal(g.index.count,36);assert.ok(p.getZ(4)>p.getZ(3));assert.ok(p.getZ(4)>p.getZ(1));
 for(let i=0;i<uv.count;i++){assert.ok(uv.getX(i)>=PERCH_LEAF_RECT[0]/1024&&uv.getX(i)<=PERCH_LEAF_RECT[2]/1024);assert.ok(uv.getY(i)>=1-PERCH_LEAF_RECT[3]/1024&&uv.getY(i)<=1-PERCH_LEAF_RECT[1]/1024);}
 g.dispose();
});
test('perch canopy keeps the forest material and wind callback without taking disposal ownership',()=>{
 const shared=new T.MeshStandardMaterial({alphaTest:.42,side:T.DoubleSide}),wind=()=>{};shared.onBeforeCompile=wind;let disposals=0;shared.addEventListener('dispose',()=>disposals++);
 const group=new T.Group(),path=new T.LineCurve3(new T.Vector3(),new T.Vector3(0,0,-400)),forest={group,path,length:400,sample:d=>new T.Vector3(0,0,-d),sampleGround:()=>0,sampleMain:p=>({distance:-p.z,point:new T.Vector3(0,0,p.z)}),colliders:[],cameraColliders:[],surfaces:{canopy:shared}},world=createTraversalWorld(new T.Scene(),forest),leaves=[];
 world.group.traverse(o=>{if(o.name==='Perch canopy · atlas leaves')leaves.push(o);});assert.equal(leaves.length,5);for(const leaf of leaves){assert.equal(leaf.material,shared);assert.equal(leaf.material.onBeforeCompile,wind);assert.equal(leaf.material.alphaTest,.42);}
 world.dispose();assert.equal(disposals,0);shared.dispose();assert.equal(disposals,1);
});

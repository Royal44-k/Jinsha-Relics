import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from 'three';
import {WebGLObjects} from '../node_modules/three/src/renderers/webgl/WebGLObjects.js';
import {createLifeEffects} from '../src/v9/life-effects.js';

test('disposing the pooled light paths releases every instanced attribute through Three ownership hooks',()=>{
 const scene=new Scene(),effects=createLifeEffects(scene),meshes=[],attributes=new Set(),released=new Set();
 scene.traverse(object=>{if(object.isInstancedMesh)meshes.push(object);});
 // Exercise the installed renderer's actual disposal listener without making a
 // graphics context. Geometry disposal alone does not own instanceMatrix data.
 const objects=WebGLObjects({ARRAY_BUFFER:34962},{get:(object,geometry)=>geometry,update(){}},{update:attribute=>attributes.add(attribute),remove:attribute=>attributes.delete(attribute)},{releaseStatesOfObject:object=>released.add(object)},{render:{frame:1}});
 try{
  for(const mesh of meshes)objects.update(mesh);
  assert.equal(attributes.size,3,'all three reusable paths have an instance buffer');
  effects.dispose();
  assert.equal(scene.children.length,0);
  assert.equal(attributes.size,0,'renderer must receive the mesh disposal event for each instanceMatrix');
  assert.equal(released.size,meshes.length,'instance-specific binding state must also be released');
 }finally{for(const mesh of meshes)mesh.dispose();objects.dispose();}
});

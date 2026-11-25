import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRiverReflection} from '../src/v6/world-water.js';
function fixture(){
 const scene=new T.Scene(),group=new T.Group(),actor=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());scene.add(group,actor);actor.position.set(1,2,3);
 const geometry=new T.PlaneGeometry(20,20).rotateX(-Math.PI/2),material=new T.ShaderMaterial({uniforms:{uTime:{value:0},uDeep:{value:new T.Color()},uSky:{value:new T.Color()}}}),river=new T.Mesh(geometry,material);river.name='Reflective winding river';group.add(river);
 const reflection=createRiverReflection({scene,forest:{group,length:100,project:()=>({distance:22})}}),camera=new T.PerspectiveCamera(48,1.6,.08,150);camera.position.set(0,2,5);camera.lookAt(0,-.2,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
 let nestedUpdates=0,recorded=null,target=null,throwOnRender=false;
 const renderer={info:{autoReset:true,render:{calls:0}},xr:{enabled:false},shadowMap:{autoUpdate:true},state:{buffers:{depth:{setMask(){}}},viewport(){}},autoClear:true,getRenderTarget:()=>target,setRenderTarget:v=>target=v,render(s){if(s.matrixWorldAutoUpdate){nestedUpdates++;s.updateMatrixWorld();}recorded=actor.matrixWorld.clone();if(throwOnRender)throw Error('fixture submission failure');}};
 return {scene,actor,camera,reflection,renderer,get nestedUpdates(){return nestedUpdates;},get recorded(){return recorded;},fail(){throwOnRender=true;},draw(){reflection.update(1/60,1,{position:new T.Vector3(),camera});reflection.water.onBeforeRender(renderer,scene,camera);},dispose(){reflection.dispose();geometry.dispose();material.dispose();actor.geometry.dispose();actor.material.dispose();}};
}
test('nested reflection reuses this frames already evaluated scene matrices',()=>{const f=fixture();try{f.actor.position.set(2,3,4);f.scene.updateMatrixWorld();const expected=f.actor.matrixWorld.clone();f.draw();assert.equal(f.nestedUpdates,0);assert.deepEqual(f.recorded.elements,expected.elements);assert.equal(f.scene.matrixWorldAutoUpdate,true);}finally{f.dispose();}});
test('original manual scene matrix policy is restored after reflection',()=>{const f=fixture();try{f.scene.matrixWorldAutoUpdate=false;f.draw();assert.equal(f.scene.matrixWorldAutoUpdate,false);assert.equal(f.nestedUpdates,0);}finally{f.dispose();}});
test('scene update policy is restored when a nested submission throws',()=>{const f=fixture();try{f.fail();assert.throws(()=>f.draw(),/fixture submission/);assert.equal(f.scene.matrixWorldAutoUpdate,true);assert.equal(f.renderer.info.autoReset,true);}finally{f.dispose();}});

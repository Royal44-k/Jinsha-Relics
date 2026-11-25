import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRiverReflection} from '../src/v6/world-water.js';

// GPU-free boundary fixture: the real Reflector computes its view/projection;
// only its nested WebGL submission is replaced with a counting renderer.
function fixture(){
 const scene=new T.Scene(),group=new T.Group();scene.add(group);
 const geometry=new T.PlaneGeometry(20,20).rotateX(-Math.PI/2);
 const material=new T.ShaderMaterial({uniforms:{uTime:{value:0},uDeep:{value:new T.Color()},uSky:{value:new T.Color()}}});
 const original=new T.Mesh(geometry,material);original.name='Reflective winding river';group.add(original);
 const reflection=createRiverReflection({scene,forest:{group,length:100,project:()=>({distance:22.5})}});
 const camera=new T.PerspectiveCamera(48,1.6,.08,150);camera.position.set(0,2,5);camera.lookAt(0,-.2,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
 let renders=0,target=null;const shadows=[];
 const renderer={info:{autoReset:true,render:{calls:0}},xr:{enabled:false},shadowMap:{autoUpdate:true},state:{buffers:{depth:{setMask(){}}},viewport(){}},autoClear:true,getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},render(){renders++;shadows.push(this.shadowMap.autoUpdate);this.info.render.calls+=20;}};
 return {reflection,camera,original,renderer,shadows,get renders(){return renders;},draw(time,quality='high'){material.uniforms.uTime.value=time;camera.updateMatrixWorld();reflection.update(1/60,time,{position:new T.Vector3(),camera,quality});if(reflection.water.visible)reflection.water.onBeforeRender(renderer,scene,camera);},dispose(){reflection.dispose();geometry.dispose();material.dispose();}};
}

test('stationary 60 Hz view submits 30 reflections while water time advances every frame',()=>{
 const f=fixture();try{for(let i=0;i<60;i++)f.draw(i/60);assert.equal(f.renders,30);assert.equal(f.reflection.stats().cachedFrames,30);assert.equal(f.reflection.water.material.uniforms.uTime.value,59/60);assert.ok(f.shadows.every(value=>value===false));assert.equal(f.renderer.shadowMap.autoUpdate,true);assert.equal(f.renderer.info.autoReset,true);}finally{f.dispose();}
});

test('continuous tiny camera movement never reuses an old projected reflection',()=>{
 const f=fixture();try{let previous;for(let i=0;i<20;i++){f.camera.position.x+=1e-9;f.draw(i/120);const matrix=f.reflection.water.material.uniforms.textureMatrix.value.elements.slice();if(previous)assert.notDeepEqual(matrix,previous);previous=matrix;}assert.equal(f.renders,20);}finally{f.dispose();}
});

test('stationary paused view holds the texture, but camera turn and zoom refresh immediately',()=>{
 const f=fixture();try{f.draw(1);const old=f.reflection.water.material.uniforms.textureMatrix.value.clone();for(let i=0;i<20;i++)f.draw(1);assert.equal(f.renders,1);assert.equal(f.reflection.stats().cpuSubmitMs,0);assert.equal(f.reflection.stats().reflectionCalls,0);f.camera.rotateY(.001);f.draw(1);assert.equal(f.renders,2);assert.ok(!f.reflection.water.material.uniforms.textureMatrix.value.equals(old));f.camera.fov=49;f.camera.updateProjectionMatrix();f.draw(1);assert.equal(f.renders,3);}finally{f.dispose();}
});

test('offscreen return and low-to-high quality render in the same frame even when time is paused',()=>{
 const f=fixture();try{f.draw(0);const rotation=f.camera.quaternion.clone();f.camera.rotateY(Math.PI);f.draw(0);assert.equal(f.renders,1);assert.equal(f.reflection.stats().inView,false);f.camera.quaternion.copy(rotation);f.draw(0);assert.equal(f.renders,2);f.draw(0,'low');assert.equal(f.original.visible,true);f.draw(0,'high');assert.equal(f.renders,3);assert.equal(f.original.visible,false);}finally{f.dispose();}
});

// Import lazily so a not-yet-implemented cadence is a clear missing-feature
// assertion, and the integration regression above still runs against V6.
const clockModule=await import('../src/v7/reflection-clock.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
function clockFixture(){assert.equal(typeof clockModule.createReflectionClock,'function','pure reflection cadence must exist');const clock=clockModule.createReflectionClock(),world=new T.Matrix4().elements,projection=new T.Matrix4().elements;return {clock,world,projection,draw(time,extra={}){return clock.shouldRender({time,world,projection,...extra});}};}

test('stable 60, 90, 120 and 144 Hz sampling preserves 30 Hz phase without degrading to 20 Hz',()=>{
 for(const rate of [60,90,120,144]){const f=clockFixture();let count=0;for(let i=0;i<rate*10;i++)if(f.draw(i/rate))count++;assert.equal(count,300,`refreshes at ${rate} Hz`);}
});

test('cadence recovers after a long gap without a catch-up burst and tolerates a clock reset',()=>{
 const f=clockFixture();assert.equal(f.draw(0),true);assert.equal(f.draw(.005),false);assert.equal(f.draw(.2),true);assert.equal(f.draw(.205),false);assert.equal(f.draw(.234),true);assert.equal(f.draw(0),true);assert.equal(f.draw(0),false);
});

test('exact matrix changes and explicit invalidation override a paused cadence',()=>{
 const f=clockFixture();assert.equal(f.draw(1),true);assert.equal(f.draw(1),false);f.world[12]=1e-12;assert.equal(f.draw(1),true);f.projection[0]+=1e-12;assert.equal(f.draw(1),true);assert.equal(f.draw(1),false);f.clock.invalidate();assert.equal(f.draw(1),true);
});

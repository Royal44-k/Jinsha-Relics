import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {createResonanceBurst,resonanceEnvelope} from '../src/v7/resonance-burst.js';
test('three-second and five-second celebrations begin at zero and fade at their real duration',()=>{
 for(const duration of [3,5]){assert.equal(resonanceEnvelope(0,duration),0);assert.equal(resonanceEnvelope(duration,duration),0);assert.ok(resonanceEnvelope(.5,duration)>.7);assert.ok(resonanceEnvelope(duration-.2,duration)<.2);}
});
test('pause holds exact feather matrices; reduced motion fades without spatial drift; reset clears',()=>{
 const burst=createResonanceBurst(new Scene());burst.trigger(10,new Vector3(2,0,-5),3);burst.update(11);const a=burst.mesh.instanceMatrix.array.slice();burst.update(11);assert.deepEqual(burst.mesh.instanceMatrix.array,a);
 burst.update(11,{reduced:true});const b=burst.mesh.instanceMatrix.array.slice();burst.update(11.8,{reduced:true});assert.deepEqual(burst.mesh.instanceMatrix.array,b);assert.equal(burst.mesh.count,12);burst.reset();assert.equal(burst.mesh.visible,false);burst.dispose();
});

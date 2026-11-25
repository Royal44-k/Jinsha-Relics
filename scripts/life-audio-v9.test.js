import test from 'node:test';
import assert from 'node:assert/strict';
import {LIFE_SOUNDS,createLifeGesture} from '../src/v9/life-foley.js';

test('life gestures stay finite, audible, bounded and click-free at audio boundaries',()=>{
 for(const kind of LIFE_SOUNDS){
  const {data,duration,sampleRate}=createLifeGesture(kind,24000),peak=data.reduce((n,v)=>Math.max(n,Math.abs(v)),0),mean=data.reduce((a,b)=>a+b,0)/data.length,rms=Math.sqrt(data.reduce((a,b)=>a+b*b,0)/data.length);
  assert.equal(data.length,Math.ceil(duration*sampleRate));assert.ok(data.every(Number.isFinite),kind);
  assert.ok(peak>.025&&peak<.65,`${kind} peak ${peak}`);assert.ok(rms>.006&&rms<.15,`${kind} rms ${rms}`);
  assert.ok(Math.abs(mean)<.001,`${kind} DC ${mean}`);assert.equal(data[0],0);assert.equal(data.at(-1),0);
 }
});
test('warnings, opening and successful pulse have distinct temporal energy and repeat deterministically',()=>{
 const samples=['wave','open','pulse','hurt'].map(k=>createLifeGesture(k,12000));
 const fingerprints=samples.map(s=>Array.from({length:8},(_,j)=>{const a=Math.floor(j*s.data.length/8),b=Math.floor((j+1)*s.data.length/8);return s.data.slice(a,b).reduce((p,v)=>p+v*v,0)/(b-a);}).map(n=>n.toFixed(5)).join(','));
 assert.equal(new Set(fingerprints).size,4);
 assert.deepEqual(createLifeGesture('wave',12000,3).data,createLifeGesture('wave',12000,3).data);
 assert.notDeepEqual(createLifeGesture('wave',12000,3).data,createLifeGesture('wave',12000,4).data);
});
test('unknown events cannot silently become the same generic cue',()=>assert.throws(()=>createLifeGesture('not-an-event'),RangeError));

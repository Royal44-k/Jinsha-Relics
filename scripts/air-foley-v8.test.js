import test from 'node:test';
import assert from 'node:assert/strict';
import {createAirGesture} from '../src/v8/air-foley.js';
test('air gestures remain bounded, finite and silent at their edges at both common audio rates',()=>{
 for(const rate of [44100,48000])for(const kind of ['dash','water','cruise','perch'])for(let variant=0;variant<4;variant++){
  const {data,duration}=createAirGesture(kind,rate,9127+variant*197);let peak=0,power=0;for(const x of data){assert.ok(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));power+=x*x;}
  assert.equal(data.length,Math.ceil(rate*duration));assert.equal(data[0],0);assert.equal(data.at(-1),0);assert.ok(peak<.6&&peak>.01);assert.ok(Math.sqrt(power/data.length)<.15);
 }
});

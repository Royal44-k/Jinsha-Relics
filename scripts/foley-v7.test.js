import test from 'node:test';
import assert from 'node:assert/strict';
import {createFoleySamples} from '../src/v7/foley.js';

test('surface and pottery foley are bounded, audible and click-free original buffers',()=>{
 for(const kind of ['litter','soil','mud','wood','stone','clay','wing','shape','smooth','pattern','fire','fired','remake']){
  const {data,duration}=createFoleySamples(kind,24000);let energy=0,peak=0;for(const v of data){assert.ok(Number.isFinite(v));energy+=v*v;peak=Math.max(peak,Math.abs(v));}
  assert.ok(peak<.85,kind+' does not clip');assert.ok(Math.sqrt(energy/data.length)>.005,kind+' audible');assert.ok(Math.abs(data[0])<.001&&Math.abs(data.at(-1))<.001,kind+' silence edges');assert.equal(data.length,Math.ceil(duration*24000));
 }
});
test('surface variants are repeatable but materially distinct',()=>{
 const a=createFoleySamples('wood',24000,1).data,b=createFoleySamples('wood',24000,1).data,c=createFoleySamples('wood',24000,2).data,d=createFoleySamples('stone',24000,1).data;
 assert.deepEqual(a,b);assert.notDeepEqual(a,c);assert.notDeepEqual(a,d);
});

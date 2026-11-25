import test from 'node:test';
import assert from 'node:assert/strict';
import {riverBankExtent} from '../src/v9/river-bank.js';
const options={point:{x:0,z:0},normal:{x:1,z:0},center:10,side:-1,minimum:6.1};
test('river edge extends through the submerged old bank and hides fade on dry ground',()=>{
 const bed=(x)=>-1.05+Math.max(0,Math.abs(x-10)-5.2)*.62;
 const extent=riverBankExtent({...options,groundAt:bed});
 assert.ok(extent>7.4);assert.ok(bed(10-extent)>.2);
 assert.ok(bed(10-(extent-.8))>-.2);
});
test('river bank search is bounded for a bottomless gorge and deterministic on each side',()=>{
 assert.equal(riverBankExtent({...options,groundAt:()=>-8}),9.7);
 const groundAt=(x)=>Math.abs(x-10)>6.4?0:-1;
 assert.equal(riverBankExtent({...options,groundAt}),riverBankExtent({...options,side:1,groundAt}));
});

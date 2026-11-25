import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreMix } from '../src/v6/audio.js';
test('flight opens the orchestration and diving gives the river its own layer',()=>{
 const ground=scoreMix({mode:'grounded',speed:0},null,0);
 const air=scoreMix({mode:'flying',speed:7},null,.5);
 const water=scoreMix({mode:'diving',speed:1},null,.2);
 assert.ok(air.air>ground.air+.5);
 assert.ok(water.water>ground.water+.5);
 assert.ok(water.ground<ground.ground);
});
test('quiet ecological attention changes arrangement without exceeding the mix budget',()=>{
 for(const mode of ['grounded','perched','flying','diving','swimming'])for(const progress of [0,.2,.5,1,NaN]){
  const m=scoreMix({mode,speed:Infinity},{nearest:{progress}},1);
  for(const v of Object.values(m))assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
  assert.ok(m.ground+m.air*.85+m.water*.5<1.75);
 }
 assert.ok(scoreMix({mode:'perched'}, {nearest:{progress:.8}},0).water>.1);
});

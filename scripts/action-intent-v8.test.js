import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveActionIntent,perchGuidance} from '../src/v8/action-intent.js';
const feather={id:'feather-branch',key:'E',label:'拾取光羽'};
const branch={id:'b1',label:'歇脚枝',canRequest:true};
test('a reachable branch wins E over its feather while airborne',()=>{
 assert.equal(resolveActionIntent({adventure:feather,perch:branch,motion:{mode:'gliding',grounded:false}}).kind,'perch');
});
test('collectible remains reachable after landing on the branch',()=>{
 assert.equal(resolveActionIntent({adventure:feather,perch:branch,motion:{mode:'perched',grounded:true}}).kind,'adventure');
});
test('a branch does not steal a flight trial or distant ground interaction',()=>{
 assert.equal(resolveActionIntent({adventure:feather,perch:branch,motion:{mode:'flying'},trialActive:true}).kind,'adventure');
 assert.equal(resolveActionIntent({adventure:feather,perch:branch,motion:{mode:'grounded',grounded:true}}).kind,'adventure');
});
test('an approach offers cancellation instead of collecting through a moving landing',()=>{
 assert.equal(resolveActionIntent({adventure:feather,motion:{perchApproach:'b1'}}).kind,'perch-cancel');
});
test('branch guidance explains height, distance and readiness',()=>{
 assert.match(perchGuidance({...branch,canRequest:false,height:2,distance:4.12}).detail,/升高.*4.1米/);
 assert.match(perchGuidance(branch).detail,/R 停栖/);
 assert.equal(perchGuidance(null),null);
});

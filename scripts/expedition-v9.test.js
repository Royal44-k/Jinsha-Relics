import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpeditionState,sanitizeExpedition,growthFromJourney,ENCOUNTERS} from '../src/v9/expedition-state.js';

const advance=(s,seconds,input={},fps=60)=>{for(let i=0;i<Math.ceil(seconds*fps);i++)s.advance(Math.min(1/fps,seconds-i/fps),{distance:3,height:0,playing:true,...input});};
const expose=(s,id='reed')=>{let limit=0;while(s.snapshot(id,3).phase!=='exposed'&&limit++<700)s.advance(1/60,{distance:3,height:1.1,playing:true});assert.equal(s.snapshot(id,3).phase,'exposed');};
test('growth derives from capped facts, migrates complete old journeys, and never farms duplicate ids',()=>{
 assert.equal(growthFromJourney().level,0);assert.equal(growthFromJourney({stages:1,cleared:['reed']}).level,1);
 assert.equal(growthFromJourney({stages:5}).level,2);assert.equal(growthFromJourney({stages:NaN,feathers:Infinity,cleared:['reed','reed','fake']}).essence,2);
 assert.deepEqual(sanitizeExpedition({cleared:['reed','fake','reed',null,'stone']}),{cleared:['reed','stone'],discovered:['reed','stone']});
 const end=growthFromJourney({stages:500,feathers:500,cleared:ENCOUNTERS.map(d=>d.id)});assert.equal(end.essence,20);assert.equal(end.nextAt,null);
});
test('telegraphed encounter accepts exposure pulses only and saves rewards once',()=>{
 const events=[],s=createExpeditionState({onEvent:e=>events.push(e)});assert.equal(s.begin('reed'),true);assert.equal(s.pulse({distance:3}),false);
 expose(s);assert.equal(s.pulse({distance:20}),false);advance(s,.71,{height:1.1});assert.equal(s.pulse({distance:3}),true);
 expose(s);assert.equal(s.pulse({distance:3}),true);assert.equal(s.snapshot('reed',3).phase,'cleared');assert.equal(s.begin('reed'),false);
 assert.deepEqual(s.serialize(),{cleared:['reed'],discovered:['reed']});assert.equal(events.filter(e=>e.type==='encounter-cleared').length,1);
});
test('each advancing wave damages at most once, three missed waves offer retry without losing records',()=>{
 const s=createExpeditionState({saved:{cleared:['stone']}});s.begin('reed');advance(s,4.1);assert.equal(s.snapshot('reed',3).ward,2);
 advance(s,20);assert.equal(s.snapshot('reed',3).phase,'retry');assert.deepEqual(s.serialize(),{cleared:['stone'],discovered:['stone','reed']});
 assert.equal(s.begin('reed'),true);assert.equal(s.snapshot('reed',3).ward,3);
});
test('explicit airborne height and dash immunity dodge the wave; idle guard does not',()=>{
 for(const input of [{height:1},{dashing:true}]){const s=createExpeditionState();s.begin('reed');advance(s,4,input);assert.equal(s.snapshot('reed',3).ward,3);}
 const s=createExpeditionState();s.begin('reed');advance(s,4);assert.equal(s.snapshot('reed',3).ward,2);
});
test('pause freezes phase/cooldown and leaving an arena safely resets its unfinished attempt',()=>{
 const s=createExpeditionState();s.begin('reed');advance(s,1);const before=s.snapshot('reed',3);advance(s,100,{playing:false});assert.deepEqual(s.snapshot('reed',3),before);
 s.advance(.1,{distance:16,playing:true});assert.equal(s.activeId,null);assert.equal(s.snapshot('reed',3).phase,'idle');assert.equal(s.begin('reed'),true);
 s.restore({cleared:['reed']});assert.equal(s.activeId,null);assert.equal(s.snapshot('reed',3).phase,'cleared');
});
test('encounter timing and damage agree at 30/60/144fps and long frames remain bounded',()=>{
 const snapshots=[30,60,144].map(fps=>{const s=createExpeditionState();s.begin('stone');advance(s,5.5,{},fps);return s.snapshot('stone',3);});
 assert.equal(new Set(snapshots.map(s=>s.phase)).size,1);assert.equal(new Set(snapshots.map(s=>s.ward)).size,1);assert.ok(Math.max(...snapshots.map(s=>s.progress))-Math.min(...snapshots.map(s=>s.progress))<.025);
 const s=createExpeditionState();s.begin('reed');s.advance(99,{distance:3,playing:true});assert.equal(s.snapshot('reed',3).phase,'windup');
});
test('stone echo returns as a second readable wave and dusk offers a real shifting safe gap',()=>{
 const stone=createExpeditionState();stone.begin('stone');advance(stone,4.9);assert.equal(stone.snapshot('stone',3).ward,1);assert.match(stone.snapshot('stone',3).hint,/折返/);
 const safe=createExpeditionState();safe.begin('dusk');advance(safe,4.5,{angle:Math.PI/2});assert.equal(safe.snapshot('dusk',3).ward,3);assert.equal(safe.snapshot('dusk',3).phase,'exposed');assert.equal(safe.pulse({distance:3}),true);assert.ok(safe.snapshot('dusk',3).safeAngle>Math.PI/2+.8);
 const unsafe=createExpeditionState();unsafe.begin('dusk');advance(unsafe,4.5,{angle:0});assert.equal(unsafe.snapshot('dusk',3).ward,2);
});

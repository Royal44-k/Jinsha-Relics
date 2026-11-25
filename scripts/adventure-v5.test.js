import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeAdventure,createAdventureState,channelFlow,segmentPassesRing,LIGHT_TARGETS,WATER_TARGETS} from '../src/v5/adventure-state.js';

test('sanitizes hostile saves and migrates legacy rewards without emitting them twice',()=>{
 const saved=sanitizeAdventure({root:{slots:[9,9,2],held:2},light:{turns:[Infinity,-1,'2']},feathers:['feather-0','feather-0','wrong'],trial:{best:-3}},['jade','bird','tiger']);
 assert.deepEqual(saved.root.slots,[0,1,2]);assert.equal(saved.root.held,null);assert.deepEqual(saved.light.turns,LIGHT_TARGETS);assert.equal(saved.trial.completed,true);assert.equal(saved.trial.best,null);assert.deepEqual(saved.feathers,['feather-0']);
 const events=[];const state=createAdventureState({saved,onEvent:e=>events.push(e)});state.rotateLight(0);assert.equal(events.filter(e=>e.type==='stage').length,0);
});
test('carry a single unique bud, recover it after reload, place three distinct roots once',()=>{
 const events=[];let state=createAdventureState({onEvent:e=>events.push(e)});
 assert.equal(state.takeLight(0),true);assert.equal(state.takeLight(1),false);
 state=createAdventureState({saved:state.serialize(),onEvent:e=>events.push(e)});
 assert.equal(state.data.root.held,0);assert.equal(state.placeLight(0),true);assert.equal(state.takeLight(0),false);
 for(let i=1;i<3;i++){state.takeLight(i);state.placeLight(i);}
 assert.equal(state.done('root'),true);assert.equal(events.filter(e=>e.type==='stage'&&e.id==='root').length,1);assert.equal(state.placeLight(2),false);
});
test('water moves only through both matching ports, including intermediate partial flow',()=>{
 assert.deepEqual(channelFlow(WATER_TARGETS),[true,true,true]);
 assert.deepEqual(channelFlow([0,0,0]),[true,false,false]);
 assert.deepEqual(channelFlow([1,2,0]),[false,false,false]);
});
test('rotary puzzles require the complete physical orientation and reward once',()=>{
 const events=[];const state=createAdventureState({onEvent:e=>events.push(e)});
 for(let i=0;i<3;i++)while(state.data.light.turns[i]!==LIGHT_TARGETS[i])state.rotateLight(i);
 assert.equal(state.done('light'),true);
 for(let i=0;i<3;i++)while(state.data.water.turns[i]!==WATER_TARGETS[i])state.rotateWater(i);
 assert.equal(state.done('water'),true);assert.equal(events.filter(e=>e.type==='stage').length,2);
});
test('ring crossing is directional and robust to a high-speed step',()=>{
 const ring={position:[0,3,0],normal:[0,0,-1],radius:1.8};
 assert.equal(segmentPassesRing([0,3,5],[0,3,-5],ring),true);
 assert.equal(segmentPassesRing([2.5,3,5],[2.5,3,-5],ring),false);
 assert.equal(segmentPassesRing([0,3,-5],[0,3,5],ring),false);
 assert.equal(segmentPassesRing([0,0,5],[0,0,-5],ring),false);
});
test('flight is ordered, pause-safe, forgiving and keeps the best legitimate time',()=>{
 const state=createAdventureState();state.startTrial();state.tickTrial(1,true);state.tickTrial(8,false);assert.equal(state.trial.time,1);
 assert.equal(state.hitRing(1),false);for(let i=0;i<6;i++)assert.equal(state.hitRing(i),true);
 assert.equal(state.done('flight'),true);assert.equal(state.data.trial.best,1);
 state.startTrial();state.tickTrial(2,true);for(let i=0;i<6;i++)state.hitRing(i);assert.equal(state.data.trial.best,1);
 state.setAssist(true);state.startTrial();state.tickTrial(.5,true);for(let i=0;i<6;i++)state.hitRing(i);assert.equal(state.data.trial.best,1);
});
test('finale requires all four echoes and sustained held focus; menus cannot advance it',()=>{
 const state=createAdventureState();state.focusFinale(4,true,true);assert.equal(state.done('sun'),false);
 state.restore(null,['bird','jade','mask','tiger']);state.focusFinale(1,true,true);state.focusFinale(6,true,false);assert.ok(state.focus>0&&state.focus<1);
 state.focusFinale(1,true,true);assert.equal(state.done('sun'),true);
 const saved=state.serialize();state.restore(saved);assert.equal(state.done('sun'),true);
});
test('optional feathers are unique, valid and save roundtrip is independent',()=>{
 const state=createAdventureState();assert.equal(state.collectFeather('feather-8'),true);assert.equal(state.collectFeather('feather-8'),false);assert.equal(state.collectFeather('bad'),false);
 const saved=state.serialize();saved.feathers.push('feather-1');assert.deepEqual(state.data.feathers,['feather-8']);
});

test('revealed travel distance survives return journeys, reload and malformed input',()=>{
 const state=createAdventureState();state.visit(180);state.visit(32);state.visit(NaN);assert.equal(state.data.furthestDistance,180);
 const reloaded=createAdventureState({saved:state.serialize()});assert.equal(reloaded.data.furthestDistance,180);reloaded.reset();assert.equal(reloaded.data.furthestDistance,0);
 assert.equal(sanitizeAdventure({furthestDistance:Infinity}).furthestDistance,0);assert.equal(sanitizeAdventure({furthestDistance:-4}).furthestDistance,0);
});

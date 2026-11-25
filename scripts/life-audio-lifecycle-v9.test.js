import test from 'node:test';
import assert from 'node:assert/strict';
import {LivingJourneyAudio} from '../src/v9/audio.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function setup(loader){
 const audio=new LivingJourneyAudio(),played=[];
 audio.context={currentTime:10,suspend:async()=>{},resume:async()=>{}};audio.unlocked=true;
 audio._prepareLife=()=>{};audio._buffer=loader;audio._foley=(kind,p,strength)=>{played.push({kind,p,strength});return true;};audio._next=()=>{};
 return {audio,played};
}
test('a warning pending across pause/resume does not arrive late in the next phase',async()=>{
 const pending=deferred(),{audio,played}=setup(()=>pending.promise),work=audio.playWorldCue('encounter-wave',[1,2,3]);
 audio.setPaused(true);audio.setPaused(false);pending.resolve({duration:1});assert.equal(await work,false);assert.equal(played.length,0);
});
test('restarting a journey invalidates a pending cue and a fresh cue retains its spatial origin',async()=>{
 const pending=deferred(),{audio,played}=setup(()=>pending.promise),work=audio.playWorldCue('encounter-open',[1,2,3]);
 audio.resetJourneyEffects();pending.resolve({duration:1});assert.equal(await work,false);assert.equal(played.length,0);
 audio.context.currentTime+=1;assert.equal(await audio.playWorldCue('pulse-hit',[7,1.28,-8]),true);assert.equal(played[0].kind,'life-pulse');assert.deepEqual(played[0].p,[7,1.28,-8]);
});
test('a missing unrelated cue never blocks an available hit response',async()=>{
 const {audio,played}=setup(async name=>name==='v9-life-pulse'?{duration:.74}:null);audio._prepareLife=()=>new Promise(()=>{});
 assert.equal(await audio.playWorldCue('pulse-hit',[0,1,0]),true);assert.equal(played.length,1);assert.equal(await audio.playWorldCue('encounter-wave',[0,1,0]),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicAudio} from '../src/v6/audio.js';
function setup(){const a=new CinematicAudio(),sources=[];a.context={currentTime:3,createBufferSource(){const s={started:0,stopped:0,connect(){},disconnect(){},start(){this.started++},stop(){this.stopped++}};sources.push(s);return s;},createGain(){return{gain:{value:0},connect(){},disconnect(){}}}};a.buses={music:{}};a.unlocked=true;a._buffer=async()=>({duration:8});a._scoreMix=()=>{};return{a,sources};}
test('new journey clears cinematic sources, ducking and cooldown',async()=>{const{a,sources}=setup();await a.playMoment('sun');assert.equal(a.momentSources.size,1);assert.equal(a.momentUntil,11);a.resetMoments();assert.equal(a.momentSources.size,0);assert.equal(a.cueSources.size,0);assert.equal(sources[0].stopped,1);assert.equal(a.momentUntil,0);assert.equal(a.lastMoment,-100);await a.playMoment('living');assert.equal(sources.length,2);assert.equal(sources[1].started,1);});
test('late cinematic buffer cannot start after returning to title',async()=>{const{a,sources}=setup();let resolve;a._buffer=()=>new Promise(r=>resolve=r);const pending=a.playMoment('sun');a.resetMoments();resolve({duration:8});await pending;assert.equal(sources.length,0);assert.equal(a.momentUntil,0);});
test('ordinary menu pause preserves the pending cinematic source',async()=>{const{a,sources}=setup();await a.playMoment('sun');a.context.suspend=async()=>{};a.setPaused(true);assert.equal(a.momentSources.size,1);assert.equal(sources[0].stopped,0);assert.equal(a.momentUntil,11);});
test('an undecoded cinematic stinger cannot arrive after a pause cycle or its action window',async t=>{
 const{a,sources}=setup();a.context.suspend=async()=>{};a.context.resume=async()=>{};
 let now=100,resolve;t.mock.method(performance,'now',()=>now);a._buffer=()=>new Promise(r=>resolve=r);
 const paused=a.playMoment('living');a.setPaused(true);a.setPaused(false);resolve({duration:8});await paused;
 assert.equal(sources.length,0);assert.equal(a.momentUntil,0);
 a.context.currentTime=6;const late=a.playMoment('living');now+=1201;resolve({duration:8});await late;
 assert.equal(sources.length,0);assert.equal(a.momentSources.size,0);assert.equal(a.momentUntil,0);
});

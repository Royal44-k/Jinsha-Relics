import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicAudio} from '../src/v6/audio.js';

const param=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}});
function setup(loader){
 const audio=new CinematicAudio(),sources=[],requests=[];
 const context={currentTime:10,state:'running',createBufferSource(){const source={starts:[],stops:0,connect(){},disconnect(){},start(...args){this.starts.push(args);},stop(){this.stops++;}};sources.push(source);return source;},createGain(){return{gain:param(),connect(){},disconnect(){}};},suspend:async()=>{context.state='suspended';},resume:async()=>{context.state='running';},close:async()=>{context.state='closed';}};
 audio.context=context;audio.unlocked=true;audio.master=context.createGain();audio.buses=Object.fromEntries(['music','ambience','voice','effects'].map(k=>[k,context.createGain()]));
 audio._buffer=async name=>{requests.push(name);return loader(name,requests.filter(n=>n===name).length);};
 return{audio,context,sources,requests};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const buffer={duration:12};

test('successful first load starts three stems together exactly once',async()=>{
 const {audio,sources,requests}=setup(()=>buffer);await audio._startMusic();
 assert.equal(sources.length,3);assert.equal(requests.length,3);
 for(const source of sources){assert.equal(source.starts.length,1);assert.equal(source.starts[0][0],10.09);assert.equal(source.starts[0][1]??0,0);}
 for(let i=0;i<20;i++)audio.setLiving({},{});await audio._startMusic();
 assert.equal(sources.length,3);assert.equal(requests.length,3);
});

test('a missing stem joins at the shared loop phase without restarting existing stems',async()=>{
 const {audio,context,sources,requests}=setup((name,n)=>name.endsWith('-air')&&n===1?null:buffer);
 await audio._startMusic();const ground=audio.layers['score-ground'].source,water=audio.layers['score-water'].source,start=audio.scoreStart;
 assert.equal(sources.length,2);context.currentTime=11;await audio._startMusic();assert.equal(requests.length,3);
 context.currentTime=37.5;audio.setLiving({},{});await flush();
 assert.ok(audio.layers['score-air']);assert.equal(sources.length,3);assert.equal(requests.length,4);
 assert.equal(audio.layers['score-ground'].source,ground);assert.equal(audio.layers['score-water'].source,water);assert.equal(audio.scoreStart,start);
 const [at,offset]=audio.layers['score-air'].source.starts[0];assert.ok(Math.abs(at-37.59)<1e-9);assert.ok(Math.abs(offset-(at-start)%12)<1e-9);
 assert.equal(ground.starts.length,1);assert.equal(water.starts.length,1);
});

test('failed ground cannot duplicate successful air or water and retries are bounded',async()=>{
 const {audio,context,sources,requests}=setup(name=>name.endsWith('-ground')?null:buffer);
 await audio._startMusic();
 for(const t of [10.5,11,12,13,15,16,17,23,24,40,100,1000]){context.currentTime=t;await audio._startMusic();}
 assert.equal(sources.length,2);assert.equal(requests.filter(n=>n.endsWith('-ground')).length,4);
 assert.equal(requests.filter(n=>n.endsWith('-air')).length,1);assert.equal(requests.filter(n=>n.endsWith('-water')).length,1);
 for(const source of sources)assert.equal(source.starts.length,1);
});

test('pause during download defers source creation and resumes cached stems without another request',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const {audio,context,sources,requests}=setup(()=>pending);
 const loading=audio._startMusic();audio.setPaused(true);resolve(buffer);await loading;
 assert.equal(sources.length,0);await audio._startMusic();assert.equal(requests.length,3);
 audio.setPaused(false);context.currentTime=20;await audio._startMusic();assert.equal(sources.length,3);assert.equal(requests.length,3);
 assert.equal(audio.scoreStart,20.09);
});

test('dispose during retry prevents late sources and further requests',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const {audio,context,sources,requests}=setup((name,n)=>name.endsWith('-air')?(n===1?null:pending):buffer);
 await audio._startMusic();context.currentTime=15;const loading=audio._startMusic();audio.dispose();resolve(buffer);await loading;
 assert.equal(sources.length,2);assert.equal(sources[0].stops,1);assert.equal(sources[1].stops,1);
 await audio._startMusic();assert.equal(requests.length,4);assert.equal(Object.keys(audio.layers).length,0);assert.equal(audio.musicPending,false);
});

test('overlapping retry calls share one request and preserve bus volume and ducking',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const {audio,context,sources,requests}=setup((name,n)=>name.endsWith('-water')?(n===1?null:pending):buffer);
 await audio._startMusic();audio.setVolume('music',.2);audio.active={id:'intro'};audio._mix();
 context.currentTime=15;const loading=audio._startMusic();for(let i=0;i<30;i++)audio.setLiving({},{});await audio._startMusic();assert.equal(requests.length,4);
 resolve(buffer);await loading;assert.equal(sources.length,3);assert.equal(audio.buses.music.gain.value,.05);assert.equal(audio.volumes.music,.2);
});

test('a later unlock also recovers a stem without requiring a playing update',async()=>{
 const {audio,context,sources,requests}=setup((name,n)=>name.endsWith('-air')&&n===1?null:buffer);
 await audio._startMusic();context.currentTime=15;audio.voiceAnalyser={};audio.startedEnvironments=true;audio._startLayer=async()=>{};
 const previous=globalThis.window;globalThis.window={AudioContext:function(){}};
 try{assert.equal(await audio.unlock(),true);await flush();}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
 assert.equal(sources.length,3);assert.equal(requests.length,4);assert.ok(Math.abs(audio.layers['score-air'].offset-5)<1e-9);
});

test('a recovered stem waits through a pause and preserves the existing music phase',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const {audio,context,sources,requests}=setup((name,n)=>name.endsWith('-air')?(n===1?null:pending):buffer);
 await audio._startMusic();const anchor=audio.scoreStart;context.currentTime=15;const loading=audio._startMusic();audio.setPaused(true);resolve(buffer);await loading;
 assert.equal(sources.length,2);assert.ok(sources.every(source=>source.stops===0));assert.equal(audio.musicPending,false);
 audio.setPaused(false);audio.setLiving({},{});await flush();assert.equal(sources.length,3);assert.equal(requests.length,4);assert.equal(audio.scoreStart,anchor);
 const [at,offset]=audio.layers['score-air'].source.starts[0];assert.ok(Math.abs(offset-(at-anchor)%12)<1e-9);
});

test('rejected downloads release the pending lock and all-failed startup establishes its clock only on success',async()=>{
 const {audio,context,sources,requests}=setup((name,n)=>{if(n<3)throw new Error('temporary decode failure');return buffer;});
 await audio._startMusic();assert.equal(audio.musicPending,false);assert.equal(audio.scoreStart,undefined);assert.equal(sources.length,0);
 context.currentTime=12;await audio._startMusic();assert.equal(audio.musicPending,false);assert.equal(sources.length,0);
 context.currentTime=16;await audio._startMusic();assert.equal(sources.length,3);assert.equal(requests.length,9);assert.equal(audio.scoreStart,16.09);
 for(const source of sources)assert.deepEqual(source.starts,[[16.09,0]]);
});

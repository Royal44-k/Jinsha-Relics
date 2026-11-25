import {V6_DIALOGUE} from './dialogue.js';
import {AdventureAudio} from '../v5/audio.js';
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const SCORE_NAMES=['ground','air','water'];
export function scoreMix(motion={},living,progress=0){
 const air=['rising','flying','gliding','falling'].includes(motion.mode),water=motion.mode==='diving',attention=clamp(living?.nearest?.progress||0),speed=clamp((motion.speed||0)/8);
 return {ground:water?.3:air?.64:.9,air:water?.03:air?.56+speed*.26:progress>.78?.19:.035,water:water?.88:motion.mode==='swimming'?.34:.03+attention*.32};
}

/** Three sample-performed stems share a clock, harmony, bar length and loop. */
export class CinematicAudio extends AdventureAudio {
 constructor(options={}){
  super(options);Object.assign(this.dialogue,V6_DIALOGUE);for(const id of Object.keys(V6_DIALOGUE))this.assetURLs[id]='/assets/audio/'+id+'.ogg';this.motionState={};this.livingState=null;this.progress=0;this.scoreGains={};this.lastScoreMix=-1;this.momentUntil=0;this.lastMoment=-100;this.momentSources=new Set();this.momentEpoch=0;
  this.scoreComplete=false;this.scoreRetry=Object.fromEntries(SCORE_NAMES.map(name=>[name,{attempts:0,nextAt:0,buffer:null}]));
  for(const name of ['score-ground','score-air','score-water','moment-living','moment-dawn'])this.assetURLs['v6-'+name]='/assets/audio/v6-'+name+'.ogg';
 }
 async unlock(){
  const result=await super.unlock();
  if(this.context&&!this.voiceAnalyser){this.voiceAnalyser=this.context.createAnalyser();this.voiceAnalyser.fftSize=256;this.voiceSamples=new Float32Array(256);this.buses.voice.connect(this.voiceAnalyser);}
  return result;
 }
 async _startMusic(){
  if(this.musicPending||this.scoreComplete||this.disposed||this.paused||!this.unlocked||!this.context)return;
  const now=this.context.currentTime,names=SCORE_NAMES.filter(name=>{
   const retry=this.scoreRetry[name];return !this.layers['score-'+name]&&(retry.buffer||(retry.attempts<4&&now>=retry.nextAt));
  });
  if(!names.length)return;
  this.musicPending=true;
  try{
   const buffers=await Promise.all(names.map(async name=>{
    const retry=this.scoreRetry[name];if(retry.buffer)return retry.buffer;
    retry.attempts++;let buffer=null;try{buffer=await this._buffer('v6-score-'+name);}catch{}
    // Preserve a decoded stem across a pause; retries must not fetch it again.
    retry.buffer=this.disposed?null:buffer;
    if(!buffer)retry.nextAt=this.context.currentTime+2**retry.attempts;
    return buffer;
   }));
   if(this.disposed||this.paused)return;
   const at=this.context.currentTime+.09;
   if(this.scoreStart===undefined&&buffers.some(Boolean))this.scoreStart=at;
   for(let i=0;i<names.length;i++){
    const buffer=buffers[i],key='score-'+names[i];if(!buffer||this.layers[key])continue;
    // Existing sources keep running. A recovered stem joins the same musical
    // clock, including after any AudioContext suspension and any loop wrap.
    const offset=((at-this.scoreStart)%buffer.duration+buffer.duration)%buffer.duration;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.loop=true;source.connect(gain);gain.connect(this.buses.music);gain.gain.value=0;source.start(at,offset);this.layers[key]={source,gain,startedAt:at,offset};this.scoreRetry[names[i]].buffer=null;
   }
   this.scoreComplete=SCORE_NAMES.every(name=>this.layers['score-'+name]?.source);this._mix();
  }finally{this.musicPending=false;}
 }
 setMotion(state){this.motionState={...state};super.setMotion(state);}
 setAdventure(snapshot,options={}){this.progress=options.progress||0;super.setAdventure(snapshot,options);}
 setLiving(snapshot,motion){this.livingState=snapshot;if(motion)this.motionState=motion;this._scoreMix();if(!this.scoreComplete)this._startMusic();}
 _scoreMix(force=false){
  if(!this.context)return;const now=this.context.currentTime;if(!force&&now-this.lastScoreMix<.12)return;this.lastScoreMix=now;
  const mix=scoreMix(this.motionState,this.livingState,this.progress),moment=now<this.momentUntil?.54:1;
  for(const [key,value] of Object.entries(mix)){const layer=this.layers['score-'+key],target=value*moment;if(layer?.gain&&(force||Math.abs((this.scoreGains[key]??-1)-target)>.008)){this._target(layer.gain.gain,target,1.15);this.scoreGains[key]=target;}}
 }
 _mix(){super._mix();this._scoreMix(true);}
 getSpeechLevel(){
  if(!this.voiceAnalyser||this.paused||!this.active||this.dialogue[this.active.id]?.speaker!=='烁羽')return 0;
  this.voiceAnalyser.getFloatTimeDomainData(this.voiceSamples);let power=0;for(const v of this.voiceSamples)power+=v*v;return clamp(Math.sqrt(power/this.voiceSamples.length)*14);
 }
 resetMoments(){
  this.momentEpoch++;this.momentUntil=0;this.lastMoment=-100;
  for(const source of this.momentSources){try{source.stop();}catch{}this.cueSources.delete(source);source.disconnect();}
  this.momentSources.clear();this._scoreMix(true);
 }
 async playMoment(name){
  if(!this.context||this.paused||!this.unlocked||this.disposed)return;
  const now=this.context.currentTime;if(now-this.lastMoment<2.5)return;this.lastMoment=now;
  const epoch=this.momentEpoch,eventEpoch=this.eventEpoch,requestedAt=performance.now(),file=name==='sun'?'v6-moment-dawn':'v6-moment-living',buffer=await this._buffer(file);
  // A decoded, playing moment may suspend with the menu. A request that was
  // still downloading must not replay an old action after the player resumes.
  if(epoch!==this.momentEpoch||eventEpoch!==this.eventEpoch||performance.now()-requestedAt>1200||!buffer||this.paused||this.disposed)return;
  const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=name==='sun'?.8:.64;source.connect(gain);gain.connect(this.buses.music);this.cueSources.add(source);this.momentSources.add(source);this.momentUntil=this.context.currentTime+buffer.duration;this._scoreMix(true);
  source.onended=()=>{this.cueSources.delete(source);this.momentSources.delete(source);source.disconnect();gain.disconnect();this._scoreMix(true);};source.start();
 }
 debug(){return {...super.debug(),score:{startedAt:this.scoreStart,gains:{...this.scoreGains},motion:this.motionState.mode,duration:this.layers['score-ground']?.source.buffer.duration,synchronized:['ground','air','water'].map(n=>this.layers['score-'+n]?.startedAt)},speechLevel:this.getSpeechLevel()};}
}

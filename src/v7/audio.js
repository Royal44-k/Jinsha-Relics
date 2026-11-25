import {CinematicAudio} from '../v6/audio.js';
import {createFoleySamples} from './foley.js';
import {V7_DIALOGUE} from './dialogue.js';

export class JourneyAudio extends CinematicAudio{
 constructor(options={}){super(options);Object.assign(this.dialogue,V7_DIALOGUE);for(const id of Object.keys(V7_DIALOGUE))this.assetURLs[id]='/assets/audio/'+id+'.ogg';this.foleyBuffers=new Map();this.foleySources=new Set();this.foleyCount=0;this.foleyLast=new Map();this.potteryActive=false;this.foleyVariant=0;}
 _mix(){super._mix();if(this.context&&this.potteryActive)this._target(this.buses.music.gain,this.volumes.music*(this.active?.25:.72),.55);}
 setListeningCamera(camera){
  if(!this.context||!camera||!this.potteryActive)return;
  const listener=this.context.listener,t=this.context.currentTime,p=camera.position,e=camera.matrixWorld.elements,d=[-e[8],-e[9],-e[10]],u=[e[4],e[5],e[6]];
  if(listener.positionX){for(const [param,value]of [[listener.positionX,p.x],[listener.positionY,p.y],[listener.positionZ,p.z],[listener.forwardX,d[0]],[listener.forwardY,d[1]],[listener.forwardZ,d[2]],[listener.upX,u[0]],[listener.upY,u[1]],[listener.upZ,u[2]]])param.setTargetAtTime(value,t,.05);}
  else{listener.setPosition(p.x,p.y,p.z);listener.setOrientation(...d,...u);}
 }
 setPotteryActive(active){if(this.potteryActive===active)return;this.potteryActive=active;this._mix();}
 _foley(kind,position,strength=.6){
  if(!this.unlocked||this.paused||this.disposed||!this.context||this.foleySources.size>=24)return false;
  const now=this.context.currentTime,rate=kind==='shape'||kind==='smooth'?.085:.06;
  if(now-(this.foleyLast.get(kind)??-100)<rate)return false;this.foleyLast.set(kind,now);
  const variant=this.foleyVariant++%4,key=kind+variant;
  if(!this.foleyBuffers.has(key)){const pcm=createFoleySamples(kind,this.context.sampleRate,7103+variant*197),buffer=this.context.createBuffer(1,pcm.data.length,pcm.sampleRate);buffer.copyToChannel(pcm.data,0);this.foleyBuffers.set(key,buffer);}
  const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.foleyBuffers.get(key);source.playbackRate.value=.97+variant*.02;gain.gain.value=Math.max(.05,Math.min(1,strength))*(kind==='fire'?.75:.7);source.connect(gain);
  let panner=null;if(position){const p=position.toArray?position.toArray():Array.isArray(position)?position:[position.x,position.y,position.z];panner=this.context.createPanner();panner.panningModel='HRTF';panner.refDistance=2;panner.maxDistance=25;panner.rolloffFactor=.65;panner.positionX.value=p[0];panner.positionY.value=p[1];panner.positionZ.value=p[2];gain.connect(panner);panner.connect(this.buses.effects);}else gain.connect(this.buses.effects);
  this.cueSources.add(source);this.foleySources.add(source);this.foleyCount++;
  source.onended=()=>{this.cueSources.delete(source);this.foleySources.delete(source);source.disconnect();gain.disconnect();panner?.disconnect();};source.start();return true;
 }
 playFootfall(event){return this._foley(event.surface||'soil',event.position,event.strength);}
 playWingbeat(strength,position){return this._foley('wing',position,.15+Math.max(0,Math.min(1,strength||0))*.12);}
 playPottery(event){const name=String(event.name||'shape').replace(/^pot-/,'');return this._foley(({startFire:'fire',finish:'fired',sculpt:'shape',stamp:'pattern',reference:'remake',orbit:'smooth'})[name]||name,event.position,event.strength??.55);}
 resetJourneyEffects(){this.resetWorldCues?.();for(const source of this.foleySources){try{source.stop();}catch{}}this.foleySources.clear();this.foleyLast.clear();this.setPotteryActive(false);}
 debug(){return {...super.debug(),foley:{played:this.foleyCount,active:this.foleySources.size,buffers:this.foleyBuffers.size,pottery:this.potteryActive}};}
 dispose(){this.resetJourneyEffects();this.foleyBuffers.clear();super.dispose();}
}

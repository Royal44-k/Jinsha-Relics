import { ForestAudio } from '../v2/audio.js';
import { V5_DIALOGUE } from './dialogue.js';
const cueAsset = name => /pickup|feather/.test(name)?'pickup':/place/.test(name)?'place':/turn|rotate/.test(name)?'rotate':/ring/.test(name)?'ring':/water|connect/.test(name)?'connect':/stage|complete|discover|success/.test(name)?'stage':/retry/.test(name)?'retry':'echo';

/** Authored stereo score, local performances and spatial interaction cues. */
export class AdventureAudio extends ForestAudio {
 constructor(options={}) { super({...options,dialogue:V5_DIALOGUE}); this.musicAssets={exploration:'v5-exploration',reveal:'v5-reveal'};this.environment={water:0,fire:0,night:0};this.listenerPosition=[0,0,0];this.lastCue=new Map();this.startedEnvironments=false;this.assetURLs=Object.fromEntries([...Object.keys(V5_DIALOGUE),'forest','flight-wind',...['exploration','reveal','pickup','place','rotate','ring','connect','stage','echo','retry','water','fire','night'].map(n=>'v5-'+n)].map(name=>[name,'/assets/audio/'+name+'.ogg']));Object.assign(this.assetURLs,{forest:'/assets/audio/v5-field-forest.ogg','v5-water':'/assets/audio/v5-field-water.ogg','v5-fire':'/assets/audio/v5-field-fire.ogg'}); }
 async unlock(){const ok=await super.unlock();if(this.unlocked&&this.context&&!this.startedEnvironments){this.startedEnvironments=true;for(const key of ['water','fire','night'])this._startLayer('v5-'+key,'ambience');}return ok;}
 setAdventure(snapshot,{position,cameraDirection,progress=0}={}){
  if(position)this.listenerPosition=position.toArray?position.toArray():position;
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  this.environment.water=.7*smooth(.11,.18,progress)*(1-smooth(.29,.37,progress))+.3*smooth(.82,.94,progress);
  this.environment.fire=.42*smooth(.49,.55,progress)*(1-smooth(.64,.72,progress));
  this.environment.night=.38*smooth(.65,.8,progress);
  const region=progress<.16?0:progress<.34?1:progress<.51?2:progress<.73?3:4;
  if(region!==this.region){this.region=region;this._mix();}
  if(!this.context)return;
  const listener=this.context.listener,t=this.context.currentTime,p=this.listenerPosition,d=cameraDirection||[0,0,-1];
  if(listener.positionX){for(const [param,v] of [[listener.positionX,p[0]],[listener.positionY,p[1]+.7],[listener.positionZ,p[2]],[listener.forwardX,d[0]],[listener.forwardY,d[1]],[listener.forwardZ,d[2]],[listener.upX,0],[listener.upY,1],[listener.upZ,0]])param.setTargetAtTime(v,t,.05);}else{listener.setPosition(...p);listener.setOrientation(...d,0,1,0);}
  for(const key of ['water','fire','night'])if(this.layers['v5-'+key]?.gain)this._target(this.layers['v5-'+key].gain.gain,this.environment[key],1.2);
 }
 _mix(){super._mix();if(!this.context)return;for(const key of ['water','fire','night'])if(this.layers['v5-'+key]?.gain)this._target(this.layers['v5-'+key].gain.gain,this.environment?.[key]||0,1.2);if(this.layers.forest?.gain)this._target(this.layers.forest.gain.gain,this.region>=4?.25:.6,1.2);}
 async playWorldCue(name,position,strength=1){
  if(!this.unlocked||this.paused||this.disposed)return;const key=cueAsset(name),now=performance.now();if(now-(this.lastCue.get(key)||-9999)<90)return;this.lastCue.set(key,now);
  const epoch=this.eventEpoch||0,buffer=await this._buffer('v5-'+key);if(!buffer||this.paused||this.disposed||epoch!==(this.eventEpoch||0)||performance.now()-now>1200)return;
  const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=Math.max(.15,Math.min(1,strength));source.connect(gain);let panner=null;
  if(position){panner=this.context.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=3;panner.maxDistance=45;panner.rolloffFactor=.7;const p=position.toArray?position.toArray():position;panner.positionX.value=p[0];panner.positionY.value=p[1]+.5;panner.positionZ.value=p[2];gain.connect(panner);panner.connect(this.buses.effects);}else gain.connect(this.buses.effects);
  this.worldSources??=new Set();this.worldSources.add(source);this.cueSources.add(source);source.onended=()=>{this.cueSources.delete(source);this.worldSources?.delete(source);source.disconnect();gain.disconnect();panner?.disconnect();};source.start();
 }
 resetWorldCues(){this.eventEpoch=(this.eventEpoch||0)+1;for(const source of this.worldSources||[]){try{source.stop();}catch{}}this.worldSources?.clear();this.lastCue.clear();}
 playCue(name){return this.playWorldCue(name);}
 clearDialogue(){this.queue.length=0;this.recent.clear();const active=this.active;if(active){clearTimeout(active.timer);this.active=null;try{active.source?.stop();}catch{}active.source?.disconnect();}this.onSubtitle({text:'',speaker:'',duration:0});this._mix();}
 debug(){return {unlocked:this.unlocked,context:this.context?.state,region:this.region,layers:Object.keys(this.layers),active:this.active?.id,queued:[...this.queue],environment:{...this.environment},spatialSources:this.cueSources.size};}
}

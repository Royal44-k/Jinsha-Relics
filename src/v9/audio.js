import {FlightAudio} from '../v8/audio.js';
import {LIFE_SOUNDS} from './life-foley.js';

const eventSounds={
 'encounter-wake':'wake','encounter-wave':'wave','encounter-open':'open','encounter-hurt':'hurt',
 'pulse-hit':'pulse','pulse-blocked':'blocked','encounter-cleared':'seed',
 'tree-sprouting':'shoot','tree-awakening':'shoot','tree-rising':'bough','tree-unfurling':'canopy','tree-mature':'seed','growth':'evolve',
};

export class LivingJourneyAudio extends FlightAudio{
 constructor(options={}){super(options);this.lifePrepared=false;this.lifeCounts={};this.lifeCueTimes=new Map();this.encounterActive=false;this.lifeMixAt=-1;this.lifeEpoch=0;for(const kind of LIFE_SOUNDS)this.assetURLs['v9-life-'+kind]='/assets/audio/v9/'+kind+'.wav';}
 async _prepareLife(){
  if(!this.context||this.disposed||this.lifePrepared)return;
  if(this.lifePreparing)return this.lifePreparing;
  // Pre-rendered small mono files decode asynchronously. No PCM synthesis in a movement frame.
  this.lifePreparing=Promise.all(LIFE_SOUNDS.map(async kind=>{
   if(this.foleyBuffers.has('life-'+kind+'0'))return;
   const buffer=await this._buffer('v9-life-'+kind);if(!buffer||this.disposed)return;
   for(let variant=0;variant<4;variant++)this.foleyBuffers.set('life-'+kind+variant,buffer);
  })).then(()=>{this.lifePrepared=LIFE_SOUNDS.every(kind=>this.foleyBuffers.has('life-'+kind+'0'));}).finally(()=>{this.lifePreparing=null;});
  return this.lifePreparing;
 }
 async unlock(){const ok=await super.unlock();this._prepareLife();return ok;}
 async playWorldCue(name,position,strength=1){
  const kind=eventSounds[name];if(!kind)return super.playWorldCue(name,position,strength);
  if(!this.context||!this.unlocked||this.paused||this.disposed)return false;
  const now=this.context.currentTime;if(now-(this.lifeCueTimes.get(name)??-100)<.12)return false;
  const epoch=this.lifeEpoch,requestedAt=performance.now();this.lifeCueTimes.set(name,now);this._prepareLife();
  // A missing unrelated cue must not delay an already decoded warning.
  const buffer=await this._buffer('v9-life-'+kind);
  if(!buffer||this.paused||this.disposed||epoch!==this.lifeEpoch||performance.now()-requestedAt>1200)return false;
  for(let variant=0;variant<4;variant++)this.foleyBuffers.set('life-'+kind+variant,buffer);
  const played=this._foley('life-'+kind,position,Math.min(1,strength)*(kind==='hurt'?.7:kind==='wave'?.82:.72));
  if(played)this.lifeCounts[name]=(this.lifeCounts[name]||0)+1;
  return played;
 }
 setAdventure(snapshot,options={}){
  const active=!!snapshot?.encounter?.active;
  if(active!==this.encounterActive){this.encounterActive=active;this._scoreMix(true);}
  super.setAdventure(snapshot,options);
 }
 _scoreMix(force=false){
  super._scoreMix(force);
  if(!this.context||!this.encounterActive)return;
  const now=this.context.currentTime;if(!force&&now-this.lifeMixAt<.12)return;this.lifeMixAt=now;
  // Keep the same score/harmony; make space for readable warning sounds.
  if(this.layers['score-air']?.gain)this._target(this.layers['score-air'].gain.gain,.10,.7);
  if(this.layers['score-ground']?.gain)this._target(this.layers['score-ground'].gain.gain,.48,.7);
 }
 setPaused(paused){if(paused&&!this.paused)this.lifeEpoch=(this.lifeEpoch||0)+1;super.setPaused(paused);}
 resetJourneyEffects(){super.resetJourneyEffects();this.lifeEpoch=(this.lifeEpoch||0)+1;this.lifeCueTimes?.clear();this.encounterActive=false;}
 debug(){return {...super.debug(),life:{prepared:this.lifePrepared,played:{...this.lifeCounts},encounter:this.encounterActive}};}
}

import {JourneyAudio} from '../v7/audio.js';
import {createAirGesture} from './air-foley.js';
export class FlightAudio extends JourneyAudio{
 _prepareAir(){
  if(!this.context||this.disposed)return;
  for(const kind of ['dash','water','cruise','perch'])for(let variant=0;variant<4;variant++){
   const key='air-'+kind+variant;if(this.foleyBuffers.has(key))continue;
   const pcm=createAirGesture(kind,this.context.sampleRate,9127+variant*197),buffer=this.context.createBuffer(1,pcm.data.length,pcm.sampleRate);buffer.copyToChannel(pcm.data,0);this.foleyBuffers.set(key,buffer);
  }
 }
 async unlock(){const result=await super.unlock();this._prepareAir();return result;}
 playAirGesture(kind,position){if(!['dash','water','cruise','perch'].includes(kind))return false;this._prepareAir();return this._foley('air-'+kind,position,kind==='dash'?.64:.45);}
}

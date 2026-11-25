import {simulationDelta} from '../v8/frame-time.js';

/** The lens crosses a small band around the physical water plane. A wave or
 * millimetre of camera correction cannot repeatedly toggle the whole grade. */
export function createWaterView(){
 let inside=false,amount=0;
 return {
  update(dt,{waterLevel=null,cameraY=0,enabled=true}={}){
   const elapsed=simulationDelta(dt);if(!elapsed)return amount;
   if(!enabled){inside=false;amount=0;return amount;}
   if(!Number.isFinite(waterLevel))inside=false;
   else if(inside){if(cameraY>waterLevel+.08)inside=false;}
   else if(cameraY<waterLevel-.14)inside=true;
   amount+=(Number(inside)-amount)*(1-Math.exp(-elapsed*4.5));return amount;
  },reset(){inside=false;amount=0;},snapshot:()=>({inside,amount})
 };
}

const TAU=Math.PI*2;
const durations={wake:1.15,wave:1.05,open:1.35,hurt:.54,pulse:.74,blocked:.36,seed:1.8,shoot:1.6,bough:2.7,canopy:3.2,evolve:2.5};
export const LIFE_SOUNDS=Object.freeze(Object.keys(durations));
/** Original restrained wind, wood and struck-stone gestures. This is sound design, not an ancient-music reconstruction. */
export function createLifeGesture(kind,sampleRate=48000,seed=9197){
 if(!LIFE_SOUNDS.includes(kind))throw new RangeError('Unknown life gesture');
 const duration=durations[kind],count=Math.ceil(sampleRate*duration),data=new Float32Array(count);
 let rng=seed>>>0,low=0,mid=0,previous=0,phase=0;
 const random=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/4294967296*2-1;};
 for(let i=0;i<count;i++){
  const t=i/sampleRate,x=t/duration,n=random();low+=(n-low)*.035;mid+=(n-mid)*.16;
  const high=n-previous;previous=n;
  const edge=Math.sin(Math.PI*Math.min(1,t/.012)/2)**2*Math.sin(Math.PI*Math.min(1,(duration-t)/.045)/2)**2;
  let v=0;
  if(kind==='wake'){
   phase+=TAU*(91-19*x)/sampleRate;
   v=(Math.sin(phase)*.12+Math.sin(phase*2.73)*.027)*Math.exp(-t*3.7)+low*.65*Math.sin(Math.PI*x)**1.2;
  }else if(kind==='wave'){
   const env=Math.sin(Math.PI*x)**1.65;
   phase+=TAU*(105+38*Math.sin(Math.PI*x))/sampleRate;
   v=(low*.94+mid*.17+Math.sin(phase)*.035)*env;
  }else if(kind==='open'||kind==='seed'||kind==='evolve'){
   // A small pentatonic rise: soft woody fundamental, a few inharmonic stone partials.
   const notes=kind==='open'?[293.66,440]:kind==='seed'?[220,293.66,440]:[220,293.66,392,440];
   for(let j=0;j<notes.length;j++){
    const nt=t-j*(kind==='open'?.15:.23);if(nt<0)continue;
    const a=Math.min(1,nt/.006)*Math.exp(-nt*(kind==='open'?4.2:2.6)),f=notes[j];
    v+=a*(Math.sin(TAU*f*nt)*.065+Math.sin(TAU*f*2.71*nt)*.018*Math.exp(-nt*4)+Math.sin(TAU*f*4.13*nt)*.006*Math.exp(-nt*8));
   }
   v+=low*.08*Math.sin(Math.PI*x);
  }else if(kind==='pulse'){
   phase+=TAU*(310-95*x)/sampleRate;
   v=Math.sin(Math.PI*x)**1.8*(low*.33+Math.sin(phase)*.07)+Math.sin(TAU*587.33*t)*Math.exp(-t*7)*.06;
  }else if(kind==='blocked'){
   v=(low*.36+Math.sin(TAU*174*t)*.07+Math.sin(TAU*421*t)*.024)*Math.exp(-t*14);
  }else if(kind==='hurt'){
   phase+=TAU*(145-65*x)/sampleRate;
   v=(mid*.24+low*.6+Math.sin(phase)*.075)*Math.exp(-t*8.5);
  }else{
   const env=Math.sin(Math.PI*x)**.8;
   const grain=.35+.65*Math.sin(t*(kind==='canopy'?41:27))**8;
   const creak=kind==='bough'?(Math.sin(TAU*(73*t+12*t*t))*.035+Math.sin(TAU*191*t)*.018)*Math.sin(Math.PI*x):0;
   v=(low*(kind==='canopy'?.52:.75)+mid*.075+high*.018*grain)*env+creak;
   if(kind==='shoot')v+=Math.sin(TAU*523.25*t)*.016*Math.exp(-t*3);
  }
  data[i]=v*edge;
 }
 // Smooth zero-end correction removes DC without creating a step at either edge.
 const mean=data.reduce((a,b)=>a+b,0)/count;for(let i=0;i<count;i++)data[i]-=mean*(1-Math.cos(TAU*i/(count-1)));
 data[0]=0;data[count-1]=0;
 return {sampleRate,duration,data};
}

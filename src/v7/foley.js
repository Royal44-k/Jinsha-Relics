const durations={litter:.28,soil:.24,mud:.32,wood:.25,stone:.27,clay:.28,wing:.18,shape:.38,smooth:.46,pattern:.3,fire:1.8,fired:1.1,remake:.42};
/** Original deterministic foley textures; no downloaded or imitation recordings. */
export function createFoleySamples(kind,sampleRate=48000,seed=7103){
 const duration=durations[kind]||.28,count=Math.ceil(duration*sampleRate),data=new Float32Array(count);
 let randomSeed=seed>>>0,low=0,previous=0;const random=()=>{randomSeed=(1664525*randomSeed+1013904223)>>>0;return randomSeed/4294967296*2-1;};
 const tactile=kind==='shape'||kind==='smooth',fire=kind==='fire',ring=kind==='fired';
 for(let i=0;i<count;i++){
  const t=i/sampleRate,x=t/duration,noise=random();low+=(noise-low)*(kind==='mud'?.055:tactile?.08:fire?.025:.24);
  const high=noise-previous;previous=noise;
  let env=Math.min(1,t/(tactile?.025:.003))*Math.exp(-t/(fire?.8:tactile?.18:ring?.28:.055));
  env*=Math.min(1,(duration-t)/.025);
  let value=low*.8+high*.025;
  if(kind==='litter')value=noise*.21*(.5+.5*Math.pow(Math.sin(t*269),8))+low*.3;
  if(kind==='wood')value=low*.36+Math.sin(t*2*Math.PI*187)*Math.exp(-t*22)*.19+Math.sin(t*2*Math.PI*413)*Math.exp(-t*40)*.07;
  if(kind==='stone')value=high*.13+low*.28+Math.sin(t*2*Math.PI*713)*Math.exp(-t*45)*.09;
  if(kind==='mud')value=low*1.9+Math.sin(t*2*Math.PI*(94-t*40))*Math.exp(-t*25)*.07;
  if(kind==='clay')value=low*.9+high*.035;
  if(kind==='wing'){env=Math.sin(Math.PI*x)**1.5;value=low*.8+noise*.04;}
  if(tactile)value=low*1.4*(.65+.25*Math.sin(t*37)+.1*Math.sin(t*113));
  if(kind==='pattern'||ring){value=low*.13;for(const [freq,gain,decay]of [[233,.18,5],[608,.10,9],[1113,.05,14]])value+=Math.sin(t*2*Math.PI*freq)*gain*Math.exp(-t*decay);env=Math.min(1,t/.002)*Math.min(1,(duration-t)/.035);}
  if(fire){env=Math.sin(Math.PI*x)**.8;value=low*.95+noise*.018;if(Math.sin(t*87)*Math.sin(t*133)>.94)value+=noise*.12;}
  data[i]=value*env*.68;
 }
 // Each short event starts/ends at silence; remove its small DC component with
 // a smooth zero-edge window rather than introducing a click at the boundary.
 const mean=data.reduce((a,b)=>a+b,0)/count;for(let i=0;i<count;i++)data[i]-=mean*(1-Math.cos(Math.PI*2*i/(count-1)));
 return {sampleRate,duration,data};
}

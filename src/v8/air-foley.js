const lengths={dash:.32,water:.46,cruise:.48,perch:.42};
/** Original close movement textures. No external sample or tonal fanfare. */
export function createAirGesture(kind,sampleRate=48000,seed=9127){
 const duration=lengths[kind]||.32,data=new Float32Array(Math.ceil(sampleRate*duration));
 let rng=seed>>>0,low=0,slow=0;
 for(let i=0;i<data.length;i++){
  rng=(Math.imul(rng,1664525)+1013904223)>>>0;const n=rng/4294967296*2-1,t=i/sampleRate,x=t/duration;
  low+=(n-low)*(.08+.16*(1-x));slow+=(n-slow)*.018;
  const envelope=Math.sin(Math.PI*x)**(kind==='perch'?2.3:1.4),air=(low-slow)*.55+slow*.24;
  let v=air;
  if(kind==='dash')v=air*(.65+.35*Math.sin(Math.PI*x))+slow*.35;
  if(kind==='cruise')v=air*(.3+.7*Math.sin(Math.PI*x*2)**2);
  if(kind==='perch')v=slow*.4+Math.sin(2*Math.PI*172*t)*Math.exp(-t*24)*.055+air*.22;
  if(kind==='water')v=slow*.7+low*.18+Math.sin(2*Math.PI*(210*t-125*t*t))*Math.exp(-t*8)*.07;
  data[i]=v*envelope;
 }
 data[0]=data[data.length-1]=0;return {sampleRate,duration,data};
}

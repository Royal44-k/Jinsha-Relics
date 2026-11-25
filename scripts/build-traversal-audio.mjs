import fs from 'node:fs';
import path from 'node:path';
const folder=path.resolve('public/assets/audio');fs.mkdirSync(folder,{recursive:true});
let seed=88373;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296)*2-1;
const rate=22050,manifest=[];
function render(name,seconds,sample){const samples=Math.floor(seconds*rate),data=new Float32Array(samples);let last=0,peak=0;for(let i=0;i<samples;i++){const t=i/rate,lastNoise=last;last=last*.76+rand()*.24;const x=sample(t,seconds,last,rand(),lastNoise);data[i]=Number.isFinite(x)?x:0;peak=Math.max(peak,Math.abs(data[i]));}const gain=peak>.8?.8/peak:1,b=Buffer.alloc(44+samples*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)b.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(data[i]*gain*32767))),44+i*2);fs.writeFileSync(path.join(folder,name+'.wav'),b);manifest.push({name,seconds,bytes:b.length,peak:peak*gain});}
render('motion-step',.28,(t,d,n,h)=>n*.46*Math.exp(-t*30)+Math.sin(t*2*Math.PI*93)*.11*Math.exp(-t*37)+h*.035*Math.exp(-t*13));
render('motion-land',.65,(t,d,n,h)=>n*.55*Math.exp(-t*12)+Math.sin(t*2*Math.PI*(80-28*t))*.2*Math.exp(-t*18)+h*.018*Math.exp(-t*6));
render('motion-wing',.65,(t,d,n,h)=>n*.40*Math.pow(Math.sin(Math.PI*t/d),1.7)+h*.025*Math.sin(Math.PI*t/d));
render('motion-splash',1.4,(t,d,n,h)=>h*.22*Math.exp(-t*3.7)+n*.38*Math.exp(-t*4.9)+Math.sin(t*2*Math.PI*(380-110*t))*Math.exp(-t*9)*.06);
render('motion-dive',1.2,(t,d,n,h)=>n*.14*Math.sin(Math.PI*t/d)+Math.sin(t*2*Math.PI*(200+250*t))*Math.pow(Math.max(0,Math.sin(t*31)),12)*.10*Math.exp(-t*1.8));
render('motion-surface',1.2,(t,d,n,h)=>n*.25*Math.sin(Math.PI*t/d)+h*.06*Math.exp(-Math.pow((t-.2)*5,2)));
render('motion-perch',.5,(t,d,n,h)=>n*.28*Math.exp(-t*18)+Math.sin(t*2*Math.PI*460)*.025*Math.exp(-t*24));
render('flight-wind',12,(t,d,n,h)=>n*(.2+.04*Math.sin(t*Math.PI/3))*.8*Math.min(1,t*3,(d-t)*3));
fs.writeFileSync(path.join(folder,'motion-manifest.json'),JSON.stringify({creator:'Original deterministic offline synthesis; not field recordings',sampleRate:rate,files:manifest},null,2));
console.log(JSON.stringify({files:manifest.length,bytes:manifest.reduce((s,f)=>s+f.bytes,0),maxPeak:Math.max(...manifest.map(f=>f.peak))}));

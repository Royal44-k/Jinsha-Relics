// Original Jinsha composition performed with CC0 VSCO 2 CE samples.
// Modern art direction, not a reconstruction of ancient Shu instrumentation.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),source=path.join(root,'scripts/audio-source/v6'),out=path.join(root,'public/assets/audio');
const rate=24000,beat=.8,bars=24,length=bars*4*beat,N=Math.round(length*rate),TAU=Math.PI*2;
const manifest=JSON.parse(fs.readFileSync(path.join(source,'sources.json')));
const report={created:new Date().toISOString(),title:'万物回声 / Letters from the living world',tempo:75,meter:'4/4',duration:length,scale:'D E G A B, modal D/G/E movement',samples:[],renders:[]};
function readWav(filename){
 const b=fs.readFileSync(filename);let fmt,data;
 for(let o=12;o+8<=b.length;){const id=b.toString('ascii',o,o+4),n=b.readUInt32LE(o+4);if(id==='fmt ')fmt={format:b.readUInt16LE(o+8),channels:b.readUInt16LE(o+10),rate:b.readUInt32LE(o+12),bits:b.readUInt16LE(o+22)};if(id==='data')data={offset:o+8,bytes:n};o+=8+n+(n%2);}
 if(!fmt||!data||fmt.format!==1||![16,24].includes(fmt.bits))throw Error('Unsupported source '+filename);
 const bytes=fmt.bits/8,frames=data.bytes/(bytes*fmt.channels),samples=Array.from({length:2},()=>new Float32Array(frames));let peak=0;
 for(let i=0;i<frames;i++)for(let c=0;c<2;c++){const o=data.offset+(i*fmt.channels+Math.min(c,fmt.channels-1))*bytes,v=(bytes===3?b.readIntLE(o,3)/8388608:b.readInt16LE(o)/32768);samples[c][i]=v;peak=Math.max(peak,Math.abs(v));}
 let first=0;while(first<frames&&Math.max(Math.abs(samples[0][first]),Math.abs(samples[1][first]))<peak*.008)first++;
 first=Math.max(0,first-Math.round(fmt.rate*.012));
 const trimmed=samples.map(c=>c.slice(first));for(const c of trimmed)for(let i=0;i<c.length;i++)c[i]*=.8/Math.max(.01,peak);
 return {samples:trimmed,rate:fmt.rate,frames:trimmed[0].length,seconds:trimmed[0].length/fmt.rate};
}
function pitch(sample,pitchClass){
 const data=sample.samples[0],start=Math.min(Math.round(.8*sample.rate),Math.floor(data.length*.2)),count=Math.min(18000,data.length-start-4000);let found=[];
 for(let midi=24+pitchClass;midi<=90;midi+=12){const hz=440*2**((midi-69)/12),lag=sample.rate/hz;let xy=0,xx=0,yy=0;for(let j=0;j<count;j+=2){const a=data[start+j],at=start+j+lag,i=Math.floor(at),f=at-i,b=data[i]*(1-f)+data[i+1]*f;xy+=a*b;xx+=a*a;yy+=b*b;}found.push({midi,hz,correlation:xy/Math.sqrt(xx*yy)});}
 const viable=found.filter(f=>f.correlation>.75);return viable.length?viable.at(-1):found.sort((a,b)=>b.correlation-a.correlation)[0];
}
const classes={'flute-a':9,'flute-c':0,'flute-e':4,'cello-d':2,'cello-a':9,'cello-high':2,'harp-d':2,'harp-a':9,'harp-g':7};
const samples={};for(const f of manifest.files){const sample=readWav(path.join(source,f.id+'.wav'));sample.midi=f.id==='gong'?60:pitch(sample,classes[f.id]).midi;samples[f.id]=sample;report.samples.push({id:f.id,rootMidi:sample.midi,seconds:sample.seconds,bytes:f.bytes,license:f.license,pitchCheck:f.id==='gong'?null:pitch(sample,classes[f.id])});}
if(process.argv.includes('--inspect')){console.log(JSON.stringify(report.samples,null,2));process.exit(0);}
const stereo=n=>[new Float32Array(n),new Float32Array(n)];
const stems={ground:stereo(N),air:stereo(N),water:stereo(N)};
const midi={D2:38,E2:40,G2:43,A2:45,B2:47,D3:50,E3:52,G3:55,A3:57,B3:59,D4:62,E4:64,G4:67,A4:69,B4:71,D5:74,E5:76,G5:79,A5:81};
function choose(kind,note){const choices=Object.keys(samples).filter(id=>id.startsWith(kind));return choices.sort((a,b)=>Math.abs(samples[a].midi-note)-Math.abs(samples[b].midi-note))[0];}
function note(stem,kind,pitchValue,start,duration,gain=.2,pan=0,{loop=true,attack=.05,release=.6}={}){
 const key=kind==='gong'?'gong':choose(kind,pitchValue),sample=samples[key],ratio=2**((pitchValue-sample.midi)/12),step=sample.rate/rate*ratio;
 const available=sample.frames/step/rate,dur=Math.min(duration,available-.03),frames=Math.round(dur*rate),offset=Math.round(start*rate);
 const gl=Math.sqrt((1-pan)/2)*gain,gr=Math.sqrt((1+pan)/2)*gain;
 for(let i=0;i<frames;i++){const time=i/rate,index=i*step,j=Math.floor(index),f=index-j,env=Math.min(1,time/attack)*Math.min(1,Math.max(0,(dur-time)/release)),at=loop?((offset+i)%stem[0].length+stem[0].length)%stem[0].length:offset+i;if(at<0||at>=stem[0].length)continue;stem[0][at]+=(sample.samples[0][j]*(1-f)+sample.samples[0][j+1]*f)*gl*env;stem[1][at]+=(sample.samples[1][j]*(1-f)+sample.samples[1][j+1]*f)*gr*env;}
}
function room(stem,wet=.4,loop=true){
 const dry=stem.map(x=>x.slice());for(let ch=0;ch<2;ch++)for(const [seconds,gain] of [[.043,.17],[.079,.16],[.127,.12],[.191,.09],[.283,.07],[.419,.05],[.613,.037],[.877,.025],[1.217,.015]]){const delay=Math.round((seconds+ch*.013)*rate);for(let i=0;i<stem[ch].length;i++){if(!loop&&i<delay)continue;const at=((i-delay)%stem[ch].length+stem[ch].length)%stem[ch].length;stem[ch][i]+=dry[1-ch][at]*gain*wet;}}
}
// Each 19.2-second phrase uses a shared harmony across the three stems; any
// vertical combination is musical. Pitch changes stay close to recorded roots.
const harmonies=[['D3','A3','E4'],['G3','D4','A4'],['E3','B3','G4'],['D3','A3','D4']];
for(let section=0;section<4;section++){
 const at=section*19.2,[bass,fifth,color]=harmonies[section];
 for(let j=0;j<3;j++){
  note(stems.ground,'cello',midi[bass],at+j*6.4-.2,7.1,.24,-.12,{attack:.75,release:1.1});
  note(stems.air,'cello',midi[fifth],at+j*6.4-.1,7.0,.17,.22,{attack:.65,release:1.2});
  note(stems.water,'cello',midi[bass]+12,at+j*6.4,6.8,.09,-.25,{attack:1.4,release:1.5});
 }
 const pulse=[bass,fifth,color,fifth];
 for(let j=0;j<12;j++){
  note(stems.ground,'harp',midi[pulse[j%4]],at+j*1.6+.17,4.7,.12+(j%4===0?.035:0),j%2?.2:-.22,{attack:.008,release:1.2});
  if(j%2===0)note(stems.water,'harp',midi[pulse[(j+2)%4]]+12,at+j*1.6+.6,5.2,.14,Math.sin(j)*.52,{attack:.05,release:1.6});
 }
 for(let j=0;j<24;j++){const p=[midi[bass]+12,midi[fifth],midi[color],midi[fifth]][j%4];note(stems.air,'harp',p,at+j*.8+.11,2.7,.11+Math.sin(j*.35)*.02,Math.sin(j*.7)*.35,{attack:.008,release:.65});}
}
// A restrained five-note main theme, with genuine breaths between phrases.
const melody=[[2.8,'D4',2.2],[5.6,'E4',1.3],[7.8,'A4',3.4],[13.3,'G4',2.9],[21.2,'G4',2.5],[24.8,'A4',1.8],[27.6,'B4',3.2],[33.4,'A4',2.4],[41.1,'E4',2.7],[45.2,'G4',3.8],[51.3,'A4',2.8],[60.8,'D5',2.4],[64.1,'B4',1.6],[66.6,'A4',2.9],[71.6,'D4',3.4]];
for(const [t,p,d] of melody)note(stems.ground,'flute',midi[p],t,d,.26,.06,{attack:.16,release:.45});
for(const [t,p,d] of [[7.4,'E5',2.2],[16,'A4',2.1],[27,'D5',2.8],[35,'B4',2.7],[44,'A4',2.3],[53,'G4',2.8],[64,'A4',3],[71,'D5',3.2]])note(stems.air,'flute',midi[p],t,d,.18,-.16,{attack:.24,release:.55});
for(const [t,p,d] of [[6.2,'D5',4.2],[25.7,'A4',4.1],[45.1,'E5',3.8],[64.2,'D5',5.2]])note(stems.water,'flute',midi[p],t,d,.13,.3,{attack:1,release:1.8});
for(const s of Object.values(stems))room(s,.72);
function write(name,stem,peakCeiling=.58,normalize=true){
 let peak=0,energy=0;for(const ch of stem)for(const v of ch){if(!Number.isFinite(v))throw Error('Non-finite '+name);peak=Math.max(peak,Math.abs(v));energy+=v*v;}
 const scale=normalize?Math.min(2.5,peakCeiling/Math.max(.001,peak)):1,data=Buffer.alloc(stem[0].length*4),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
 for(let i=0;i<stem[0].length;i++)for(let c=0;c<2;c++)data.writeInt16LE(Math.round(Math.max(-.99,Math.min(.99,stem[c][i]*scale))*32767),i*4+c*2);
 fs.writeFileSync(path.join(out,name+'.wav'),Buffer.concat([header,data]));report.renders.push({name,duration:stem[0].length/rate,peak:peak*scale,rms:Math.sqrt(energy/(stem[0].length*2))*scale,bytes:header.length+data.length});
}
// A common mastering scalar preserves stem balance. Dynamic gain is runtime.
let comboPeak=0;for(let i=0;i<N;i++)for(let c=0;c<2;c++)comboPeak=Math.max(comboPeak,Math.abs(stems.ground[c][i]+stems.air[c][i]*.85+stems.water[c][i]*.5));
const master=.7/Math.max(.01,comboPeak);for(const stem of Object.values(stems))for(const ch of stem)for(let i=0;i<ch.length;i++)ch[i]*=master;
for(const [name,stem] of Object.entries(stems))write('v6-score-'+name,stem,.58,false);
const glimpse=stereo(rate*7);for(const [t,p] of [[.05,'D4'],[.4,'A4'],[.85,'B4'],[1.6,'E5'],[2.6,'D5']])note(glimpse,'harp',midi[p],t,5,.35,Math.sin(t)*.4,{loop:false,attack:.01,release:1});note(glimpse,'flute',midi.A4,1.2,4.7,.20,.05,{loop:false,attack:.4,release:1.4});room(glimpse,.8,false);write('v6-moment-living',glimpse,.42);
const dawn=stereo(rate*9);for(const [t,p] of [[0,'D3'],[.2,'A3'],[.6,'D4'],[1.1,'E4'],[1.8,'A4'],[2.9,'B4'],[4.2,'D5']])note(dawn,'harp',midi[p],t,5.5,.32,Math.sin(t)*.4,{loop:false,attack:.01,release:1.2});note(dawn,'gong',60,0,2.8,.15,0,{loop:false,attack:.03,release:.7});note(dawn,'cello',midi.D3,.2,7.5,.25,-.2,{loop:false,attack:.4,release:1.4});note(dawn,'flute',midi.D5,2.8,4.5,.25,.2,{loop:false,attack:.3,release:.9});room(dawn,.85,false);write('v6-moment-dawn',dawn,.50);
fs.writeFileSync(path.join(root,'docs/v6/score-render.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({samples:report.samples.map(s=>({id:s.id,midi:s.rootMidi})),renders:report.renders},null,2));

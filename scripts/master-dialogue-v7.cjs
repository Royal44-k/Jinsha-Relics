const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=path.join(__dirname,'audio-source/v7');
function readWav(file){
 const b=fs.readFileSync(file);let fmt,data;
 for(let o=12;o+8<=b.length;){const name=b.toString('ascii',o,o+4),size=b.readUInt32LE(o+4);if(name==='fmt ')fmt=b.subarray(o+8,o+8+size);if(name==='data')data=b.subarray(o+8,o+8+size);o+=8+size+(size%2);}
 if(!fmt||!data||fmt.readUInt16LE(0)!==1||fmt.readUInt16LE(14)!==16)throw Error('Expected original 16-bit PCM: '+file);
 return {data,channels:fmt.readUInt16LE(2),rate:fmt.readUInt32LE(4)};
}
function writeWav(file,samples,rate,channels){
 const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*channels*2,28);b.writeUInt16LE(channels*2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(samples[i]*32768))),44+i*2);fs.writeFileSync(file,b);
}
const edits=JSON.parse(fs.readFileSync(path.join(source,'dialogue-edit-map.json'),'utf8'));
const clips=[...edits.clips.map(c=>({...c,file:'shuoyu-original.wav'})),{id:'v7_pottery_narrator',file:'narrator-original.wav',from:0,to:Infinity}],report=[];
for(const clip of clips){
 const wav=readWav(path.join(source,clip.file)),frames=wav.data.length/(2*wav.channels),from=Math.round(clip.from*wav.rate),to=Math.min(frames,Math.round(clip.to*wav.rate)),samples=new Float32Array((to-from)*wav.channels);let peak=0,energy=0;
 for(let i=0;i<samples.length;i++){const frame=Math.floor(i/wav.channels),edge=Math.min(1,frame/(wav.rate*.004),(to-from-1-frame)/(wav.rate*.004));const value=wav.data.readInt16LE((from*wav.channels+i)*2)/32768*Math.max(0,edge);samples[i]=value;peak=Math.max(peak,Math.abs(value));energy+=value*value;}
 const rms=Math.sqrt(energy/samples.length),gain=Math.min(.74/peak,.12/rms,1);
 // Keep the full performance, timing and pitch. Apply only constant headroom
 // and a 4 ms edge fade; no compressor pumping or destructive denoising.
 for(let i=0;i<samples.length;i++)samples[i]*=gain;
 writeWav(path.join(root,'public/assets/audio',clip.id+'.wav'),samples,wav.rate,wav.channels);
 report.push({id:clip.id,source:clip.file,from:from/wav.rate,to:to/wav.rate,duration:(to-from)/wav.rate,sourcePeak:peak,sourceRms:rms,gain,gainDb:20*Math.log10(gain),pcmPeak:peak*gain,pcmRms:rms*gain});
}
fs.writeFileSync(path.join(root,'docs/v7/dialogue-mastering.json'),JSON.stringify({at:new Date().toISOString(),method:'Constant gain from untouched service originals; PCM peak <= 0.74 and RMS <= 0.12, 4 ms edge fade, unchanged speed/pitch/duration. Decode the final Opus separately to verify codec overshoot stays below full scale.',clips:report},null,2));console.log(JSON.stringify(report,null,2));

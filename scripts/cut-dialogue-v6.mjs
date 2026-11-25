import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),source=path.join(root,'scripts/audio-source/v6'),out=path.join(root,'public/assets/audio');
const script=JSON.parse(fs.readFileSync(path.join(source,'dialogue-script.json'))),response=JSON.parse(fs.readFileSync(path.join(source,'spirit-response.json'))),wav=fs.readFileSync(path.join(source,'spirit-original.wav'));
let fmt,data;for(let o=12;o+8<wav.length;){const id=wav.toString('ascii',o,o+4),size=wav.readUInt32LE(o+4);if(id==='fmt ')fmt={format:wav.readUInt16LE(o+8),channels:wav.readUInt16LE(o+10),rate:wav.readUInt32LE(o+12),bits:wav.readUInt16LE(o+22)};if(id==='data')data={offset:o+8,size};o+=8+size+size%2;}
if(!fmt||!data||fmt.format!==1||fmt.bits!==16)throw Error('Unexpected original WAV format');
const characters=response.original_characters,lines=[];let current=[];
for(const c of characters){if(c.text==='\n'){lines.push(current);current=[];}else current.push(c);}if(current.length)lines.push(current);
if(lines.length!==script.cues.length)throw Error('Generated line count mismatch');
const dialogue={},mapping=[],rate=22050;
for(let l=0;l<lines.length;l++){
 const [id,text]=script.cues[l],line=lines[l];if(line.map(c=>c.text).join('')!==text)throw Error('Text mismatch '+id);
 const words=line.filter(c=>/[\p{L}\p{N}]/u.test(c.text)),start=Math.max(0,words[0].start_time-.1),end=Math.min(response.duration,words.at(-1).end_time+.12),frames=Math.round((end-start)*rate),body=Buffer.alloc(frames*2);
 let peak=0,energy=0;
 for(let i=0;i<frames;i++){const at=(start+i/rate)*fmt.rate,j=Math.floor(at),f=at-j;let value=0;for(let c=0;c<fmt.channels;c++){const a=wav.readInt16LE(data.offset+(j*fmt.channels+c)*2)/32768,b=wav.readInt16LE(data.offset+((j+1)*fmt.channels+c)*2)/32768;value+=(a*(1-f)+b*f)/fmt.channels;}const edge=Math.min(1,i/(rate*.006),(frames-1-i)/(rate*.006));value*=Math.max(0,edge)*.72;peak=Math.max(peak,Math.abs(value));energy+=value*value;body.writeInt16LE(Math.round(Math.max(-.999,Math.min(.999,value))*32767),i*2);}
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+body.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(body.length,40);fs.writeFileSync(path.join(out,id+'.wav'),Buffer.concat([h,body]));
 dialogue[id]={speaker:'烁羽',text,duration:frames/rate};mapping.push({id,sourceStart:start,sourceEnd:end,duration:frames/rate,peak,rms:Math.sqrt(energy/frames),speed:1,pitch:1});
}
fs.writeFileSync(path.join(root,'src/v6/dialogue.js'),'// Original V6 script; durations measured from the cut local audio.\nexport const V6_DIALOGUE = Object.freeze('+JSON.stringify(dialogue,null,2)+');\n');
fs.writeFileSync(path.join(root,'docs/v6/dialogue-edit-map.json'),JSON.stringify({voice:script.voice,voiceId:script.voiceId,sourceDuration:response.duration,format:fmt,mapping,review:'Text and timing checked against provider alignment; subjective listening not certified.'},null,2));console.log(JSON.stringify(mapping,null,2));

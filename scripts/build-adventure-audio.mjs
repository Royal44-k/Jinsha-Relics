/** Original offline score and source-to-cue editor. Run: node scripts/build-forest-audio.mjs
 * No third-party samples, no OS TTS, no pitch/time manipulation of voice originals.
 * The score evokes bronze / stone / breath; it is not archaeological reconstruction.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/assets/audio');
fs.mkdirSync(out, { recursive: true });
const rate = 24000, length = 48, frames = rate * length, tau = 2 * Math.PI;
const TAU = tau;
let seed = 17391;
function noise() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; }
function waveHeader(dataBytes, sampleRate, channels, bits = 16) {
  const h = Buffer.alloc(44); h.write('RIFF'); h.writeUInt32LE(36 + dataBytes, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * channels * bits / 8, 28);
  h.writeUInt16LE(channels * bits / 8, 32); h.writeUInt16LE(bits, 34); h.write('data', 36); h.writeUInt32LE(dataBytes, 40); return h;
}
function writeStereo(name, left, right, peak = .42) {
  let max = 0, energy = 0;
  for (let i = 0; i < left.length; i++) { max = Math.max(max, Math.abs(left[i]), Math.abs(right[i])); energy += left[i] ** 2 + right[i] ** 2; }
  const scale = peak / Math.max(.001, max), data = Buffer.alloc(left.length * 4);
  for (let i = 0; i < left.length; i++) {data.writeInt16LE(Math.round(left[i]*scale*32767),i*4);data.writeInt16LE(Math.round(right[i]*scale*32767),i*4+2);}
  fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.concat([waveHeader(data.length, rate, 2), data]));
  return { file: `${name}.wav`, duration: left.length / rate, sampleRate: rate, channels: 2, peakCeiling: peak, note: 'Stereo equal-power placement and cross-channel room reflections' };
}
function stereo(n = frames) { return [new Float32Array(n), new Float32Array(n)]; }
function place(stem, signal, time, gain, pan = 0) {
  const start = Math.floor(time * rate), gl = Math.sqrt((1 - pan) / 2) * gain, gr = Math.sqrt((1 + pan) / 2) * gain;
  for (let i = 0; i < signal.length; i++) {
    const at = (start + i + stem[0].length) % stem[0].length;
    stem[0][at] += signal[i] * gl; stem[1][at] += signal[i] * gr;
  }
}
function modal(freq, seconds, kind) {
  const ratios = kind === 'stone' ? [1, 2.78, 5.42, 8.93] : [1, 2.01, 2.71, 4.07, 5.42, 6.83];
  const signal = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < signal.length; i++) {
    const t = i / rate, attack = 1 - Math.exp(-t * (kind === 'stone' ? 1400 : 550));
    let value = 0;
    for (let p = 0; p < ratios.length; p++) value += Math.sin(tau * freq * ratios[p] * t) * Math.exp(-t * (p * .65 + (kind === 'stone' ? 3.2 : .8))) / (1 + p * 2.5);
    signal[i] = attack * value;
  }
  return signal;
}
function flute(freq, seconds, dynamic = 1) {
  const signal = new Float32Array(Math.floor(seconds * rate)); let phase = 0, air = 0;
  for (let i = 0; i < signal.length; i++) {
    const t = i / rate, env = Math.min(1, t / .22) * Math.pow(Math.max(0, 1 - t / seconds), .7) * Math.min(1, (seconds - t) / .25);
    const vibrato = Math.sin(tau * 4.7 * t) * .0018 * Math.min(1, t / .8);
    phase += tau * freq / rate * (1 + vibrato); air = air * .79 + noise() * .21;
    signal[i] = env * dynamic * (Math.sin(phase) * .8 + Math.sin(2 * phase) * .10 + Math.sin(3 * phase) * .045 + air * .12);
  }
  return signal;
}
function bowed(freq, seconds) {
  const signal = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < signal.length; i++) {
    const t = i / rate, env = Math.sin(Math.PI * t / seconds) ** 2;
    signal[i] = env * (.8 * Math.sin(tau * freq * t + .15 * Math.sin(tau * .2 * t)) + .18 * Math.sin(tau * 2 * freq * t) + .05 * Math.sin(tau * 3.002 * freq * t));
  }
  return signal;
}
function room(stem, wet, loop = true) {
  // Delayed reflections of the rendered performance; periodic wrap yields continuous loop tails.
  const taps = [[.079,.20],[.113,.17],[.181,.13],[.277,.10],[.431,.07],[.683,.045],[1.017,.028],[1.513,.018]];
  const dry = stem.map(x => x.slice());
  for (let c = 0; c < 2; c++) for (const [sec, gain] of taps) {
    const delay = Math.floor((sec + c * .017) * rate);
    for (let i = 0; i < stem[c].length; i++) { if(!loop && i < delay)continue; const at=((i-delay)%dry[c].length+dry[c].length)%dry[c].length; stem[c][i] += dry[(c + 1) % 2][at] * gain * wet; }
  }
}
const notes = { D: 293.665, E:329.628, G:391.995, A:440, B:493.883, d:587.33 };
function makeScore(reveal) {
  seed = 17391; const stem = stereo();
  const roots = [146.8325, 97.99875, 164.814, 146.8325];
  roots.forEach((freq, i) => { place(stem, bowed(freq, 14), i * 12 - 1, .09, -.18); place(stem, bowed(freq * 1.5, 14), i * 12 - 1, .045, .2); });
  const stones = [[.4,'D'],[7.2,'A'],[13.0,'G'],[20.8,'B'],[26.1,'E'],[32.3,'G'],[39.7,'A'],[45.2,'D']];
  stones.forEach(([t, note], i) => place(stem, modal(notes[note], 4, 'stone'), t, reveal ? .15 : .22, i % 2 ? .35 : -.35));
  [[3.6,'A'],[17.7,'B'],[29.8,'G'],[43.2,'D']].forEach(([t,n], i) => place(stem, modal(notes[n] / 2, 7, 'bronze'), t, .1, i % 2 ? -.3 : .3));
  const phrase = reveal
    ? [[1.7,'D',2.7],[5.0,'E',1.8],[7.4,'A',3.1],[12.3,'G',2.5],[15.4,'B',2.1],[18.4,'A',3.6],[25.2,'E',2.6],[28.5,'G',2.2],[31.5,'A',3.2],[37.5,'d',2.6],[40.6,'B',1.7],[43.2,'A',3.5]]
    : [[4.1,'D',3.0],[8.3,'A',3.4],[18.6,'G',3.0],[22.5,'E',2.4],[31.4,'G',3.1],[36.3,'A',3.3],[44.0,'D',3.6]];
  phrase.forEach(([t,n,d], i) => place(stem, flute(notes[n] * (reveal ? 1 : .5),d), t, reveal ? .23 : .15, Math.sin(i * 2) * .12));
  room(stem, 1.1); return writeStereo(reveal ? 'v5-reveal' : 'v5-exploration', ...stem, reveal ? .42 : .32);
}
function makeAmbience() {
  const stem = stereo(); seed = 1991; let low = 0, lpL = 0, lpR = 0;
  for (let i = 0; i < frames; i++) {
    const t = i / rate, wind = .11 + .035 * Math.sin(tau * t / length) + .025 * Math.sin(tau * 3 * t / length);
    low = low * .999 + noise() * .001;
    lpL = lpL * .92 + noise() * .08; lpR = lpR * .92 + noise() * .08;
    stem[0][i] = low * .4 + lpL * wind; stem[1][i] = low * .4 + lpR * wind;
  }
  // Tiny, non-literal water resonances, not field recordings or archaeological samples.
  for (let j = 0; j < 68; j++) {
    const t = (noise() + 1) / 2 * length, f = 570 + (noise() + 1) * 670;
    place(stem, modal(f, .15, 'stone'), t, .008 + .006 * (noise() + 1), noise() * .85);
  }
  // Short equal-power head/tail blend removes the noise seam without a repeating volume dip.
  const blend = 2000;
  for (const ch of stem) for (let i = 0; i < blend; i++) {
    const mix = i / blend; ch[i] = ch[ch.length - blend + i] * (1 - mix) + ch[i] * mix;
  }
  return writeStereo('forest', ...stem, .14);
}
function makeCue(name, reveal) {
  const stem = stereo(rate * (reveal ? 5 : 2));
  place(stem, modal(587.33, reveal ? 4 : 1.8, 'stone'), .05, .3, -.12);
  if (reveal) { place(stem, modal(880,4,'bronze'), .28,.12,.25); place(stem, flute(587.33,2.7), .45,.18,0); }
  room(stem,.55);
  for (const ch of stem) for(let i = 0; i < ch.length; i++) ch[i] *= Math.min(1,i/(rate*.015),(ch.length-i)/(rate*.3));
  return writeStereo(name,...stem,.3);
}
function readWav(file) {
  const bytes = fs.readFileSync(file); let fmt, data;
  if (bytes.toString('ascii',0,4) !== 'RIFF') throw new Error('Expected original WAV');
  for (let offset=12; offset+8<=bytes.length;) {
    const id=bytes.toString('ascii',offset,offset+4), size=bytes.readUInt32LE(offset+4);
    if(id==='fmt ') fmt={format:bytes.readUInt16LE(offset+8),channels:bytes.readUInt16LE(offset+10),rate:bytes.readUInt32LE(offset+12),align:bytes.readUInt16LE(offset+20),bits:bytes.readUInt16LE(offset+22)};
    if(id==='data') data=bytes.subarray(offset+8,offset+8+size); offset+=8+size+(size%2);
  }
  if(!fmt||!data||fmt.format!==1||fmt.bits!==16)throw new Error('Unsupported original format');
  return {...fmt,data};
}

function cutV5Voices(){
 const linesByRole=JSON.parse(fs.readFileSync(path.join(root,'scripts/audio-source/v5/script.json'),'utf8')),cues=[];
 for(const role of ['spirit','narrator']){
  const raw=JSON.parse(fs.readFileSync(path.join(root,'scripts/audio-source/v5/'+role+'-response.json'),'utf8'));
  const meta=raw.structuredContent||JSON.parse(raw.content.find(c=>c.type==='text').text),original=readWav(path.join(root,'scripts/audio-source/v5/'+role+'-original.wav')),chars=meta.original_characters;
  const lines=linesByRole[role],expected=lines.map(x=>x[1]).join('\n\n');
  if(chars.map(x=>x.text).join('')!==expected)throw new Error('V5 aligned script mismatch '+role);
  let cursor=0;const segments=lines.map(([id,text])=>{const count=[...text].length,cc=chars.slice(cursor,cursor+count);cursor+=count+2;return {id,text,chars:cc};}),boundaries=[0];
  for(let i=1;i<segments.length;i++){const previous=segments[i-1].chars.filter(x=>/[\p{L}\p{N}]/u.test(x.text)).at(-1);boundaries.push((previous.end_time+segments[i].chars[0].start_time)/2);}
  boundaries.push(original.data.length/original.align/original.rate);
  for(let i=0;i<segments.length;i++){
   const seg=segments[i],start=Math.floor(boundaries[i]*original.rate),end=Math.floor(boundaries[i+1]*original.rate),targetRate=22050,count=Math.floor((end-start)*targetRate/original.rate),data=Buffer.alloc(count*2);
   for(let j=0;j<count;j++){
    const pos=start+j*original.rate/targetRate,centre=Math.floor(pos);let sum=0,weight=0;
    for(let k=-16;k<=16;k++){const idx=Math.max(start,Math.min(end-1,centre+k)),x=idx-pos,cutoff=.45,w=(Math.abs(x)<.00001?cutoff:Math.sin(Math.PI*x*cutoff)/(Math.PI*x))*(.5+.5*Math.cos(Math.PI*x/17));let mono=0;for(let c=0;c<original.channels;c++)mono+=original.data.readInt16LE(idx*original.align+c*2)/original.channels;sum+=mono*w;weight+=w;}
    data.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(sum/weight*.72))),j*2);
   }
   const fade=Math.floor(targetRate*.003);for(let n=0;n<fade;n++)for(const idx of [n,count-1-n])data.writeInt16LE(Math.round(data.readInt16LE(idx*2)*n/fade),idx*2);
   fs.writeFileSync(path.join(out,seg.id+'.wav'),Buffer.concat([waveHeader(data.length,targetRate,1),data]));
   cues.push({id:seg.id,speaker:role==='spirit'?'烁羽':'录忆者',text:seg.text,file:seg.id+'.wav',duration:count/targetRate,source:role+'-original.wav',sourceStart:start/original.rate,sourceEnd:end/original.rate,voiceId:role==='spirit'?'4f8c25eb83f4488d82c2a2e38dc0a9d3':'6c364011f30747c9a0a89eec3787cadc'});
  }
 }
 return cues;
}
function cue(name,kind,tones,duration=2.5){
 const stem=stereo(Math.floor(rate*duration));
 for(let i=0;i<tones.length;i++){const f=tones[i];place(stem,modal(f,duration-i*.12,kind),.025+i*.12,.28/(1+i*.22),(i%2?1:-1)*.22);}
 room(stem,.5,false);for(const channel of stem)for(let i=0;i<channel.length;i++)channel[i]*=Math.min(1,i/(rate*.008),(channel.length-i)/(rate*.25));
 return writeStereo('v5-'+name,...stem,.26);
}
function ambience(name,kind){
 const seconds=16,stem=stereo(rate*seconds);seed=kind==='water'?8781:kind==='fire'?119:18291;let low=[0,0];
 for(let i=0;i<stem[0].length;i++){
  const t=i/rate;
  for(let c=0;c<2;c++){
   const n=noise();low[c]=low[c]*.92+n*.08;let v=0;
   if(kind==='water')v=low[c]*.7+n*.07+Math.sin(t*TAU*(370+80*Math.sin(t*1.1+c)))*Math.pow(Math.max(0,Math.sin(t*3.7+c)*Math.sin(t*7.3)),9)*.055;
   if(kind==='fire')v=low[c]*.5+(Math.abs(n)>.996?n*.4:0)+n*.025*(.6+.4*Math.sin(t*TAU/8));
   if(kind==='night'){const pulse=Math.pow(Math.max(0,Math.sin(t*TAU*2.2+c)),5),swell=.5+.5*Math.sin(t*TAU/8+c);v=Math.sin(t*TAU*(3400+c*170))*.018*pulse*swell+low[c]*.10;}
   const edge=Math.min(1,t/.4,(seconds-t)/.4);stem[c][i]=v*edge;
  }
 }
 room(stem,.35);return writeStereo('v5-'+name,...stem,.16);
}
const score=[makeScore(false),makeScore(true)];
const fx=[
 cue('pickup','stone',[783.99,1174.66],1.8),cue('place','bronze',[293.665,440,587.33],3),
 cue('rotate','stone',[196,293.665],.9),cue('ring','stone',[587.33,880,1174.66],1.6),
 cue('connect','bronze',[392,587.33,783.99],2.5),cue('stage','bronze',[293.665,392,440,587.33],4),
 cue('echo','stone',[293.665,440],2.3),cue('retry','stone',[293.665,196],1.3),
 ambience('water','water'),ambience('fire','fire'),ambience('night','night')];
const cues=cutV5Voices();
const manifest={created:new Date().toISOString(),score:{title:'五境 · 回响',creator:'Original modal/offline synthesis, stereo arrangements; not historical music reconstruction or field recordings',sampleRate:rate},plan:'HeyGen free account observed 2026-11-18; internal local evaluation, no commercial distribution claim',scoreFiles:score,effects:fx,cues,review:'Provider text/timestamps and numeric waveform validation; subjective listening quality is not certified'};
fs.writeFileSync(path.join(out,'v5-manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(root,'src/v5/dialogue.js'),'// Local generated Mandarin cues; metadata in public/assets/audio/v5-manifest.json.\nexport const V5_DIALOGUE = '+JSON.stringify(Object.fromEntries(cues.map(({id,speaker,text,duration})=>[id,{speaker,text,duration}])),null,2)+';\n');
console.log(JSON.stringify({music:score,effects:fx.map(v=>({file:v.file,duration:v.duration})),cues:cues.map(v=>({id:v.id,duration:v.duration})),voiceDuration:cues.reduce((s,c)=>s+c.duration,0)},null,2));

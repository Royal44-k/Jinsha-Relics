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
  const scale = peak / Math.max(.001, max), data = Buffer.alloc(left.length * 2);
  for (let i = 0; i < left.length; i++) data.writeInt16LE(Math.round((left[i] + right[i]) * .5 * scale * 32767), i * 2);
  fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.concat([waveHeader(data.length, rate, 1), data]));
  return { file: `${name}.wav`, duration: left.length / rate, sampleRate: rate, channels: 1, peakCeiling: peak, note: 'Mono distribution mix; editable stereo render remains in composition source' };
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
function room(stem, wet) {
  // Delayed reflections of the rendered performance; periodic wrap yields continuous loop tails.
  const taps = [[.079,.20],[.113,.17],[.181,.13],[.277,.10],[.431,.07],[.683,.045],[1.017,.028],[1.513,.018]];
  const dry = stem.map(x => x.slice());
  for (let c = 0; c < 2; c++) for (const [sec, gain] of taps) {
    const delay = Math.floor((sec + c * .017) * rate);
    for (let i = 0; i < stem[c].length; i++) stem[c][i] += dry[(c + 1) % 2][(i - delay + dry[c].length) % dry[c].length] * gain * wet;
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
  room(stem, 1.1); return writeStereo(reveal ? 'reveal' : 'exploration', ...stem, reveal ? .42 : .32);
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
function cutVoices() {
  const cues = [];
  for(const role of ['spirit','narrator']) {
    const meta=JSON.parse(fs.readFileSync(path.join(root,`scripts/audio-source/${role}.json`),'utf8'));
    const original=readWav(path.join(root,'docs/v2/audio-production-sources',`${role}-original.wav`)), chars=meta.response.original_characters;
    const expected=meta.lines.map(x=>x[1]).join('\n\n');
    if(chars.map(x=>x.text).join('')!==expected)throw new Error('Timestamp text mismatch');
    let cursor=0;
    const segments=meta.lines.map(([id,text])=>{const count=[...text].length, cc=chars.slice(cursor,cursor+count);cursor+=count+2;return {id,text,chars:cc};});
    const boundaries=[0];
    for(let i=1;i<segments.length;i++){
      const prev=segments[i-1].chars.filter(x=>/[\p{L}\p{N}]/u.test(x.text)).at(-1);
      const next=segments[i].chars[0];boundaries.push((prev.end_time+next.start_time)/2);
    }
    boundaries.push(original.data.length/original.align/original.rate);
    for(let i=0;i<segments.length;i++){
      const seg=segments[i], start=Math.floor(boundaries[i]*original.rate),end=Math.floor(boundaries[i+1]*original.rate);
      const targetRate=22050, count=Math.floor((end-start)/original.rate*targetRate),data=Buffer.alloc(count*2);
      // Source is 44.1 kHz. Low-pass windowed-sinc resampling to 22.05 kHz keeps speed and pitch.
      for(let j=0;j<count;j++){
        const position=start+j*original.rate/targetRate, center=Math.floor(position);let sum=0,weight=0;
        for(let k=-16;k<=16;k++){
          const idx=Math.max(start,Math.min(end-1,center+k)),x=idx-position,cutoff=.45;
          const w=(Math.abs(x)<.00001?cutoff:Math.sin(Math.PI*x*cutoff)/(Math.PI*x))*(.5+.5*Math.cos(Math.PI*x/17));
          let mono=0;for(let c=0;c<original.channels;c++)mono+=original.data.readInt16LE(idx*original.align+c*2)/original.channels;
          sum+=mono*w;weight+=w;
        }
        // Preserve ~2.85 dB headroom; originals arrive near full scale, sinc can overshoot.
        data.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(sum/weight*.72))),j*2);
      }
      // 3 ms anti-click boundary fade only; source words and performance remain at 1x.
      const fade=Math.floor(targetRate*.003);
      for(let n=0;n<fade;n++)for(const idx of [n,count-1-n]){const pos=idx*2;data.writeInt16LE(Math.round(data.readInt16LE(pos)*n/fade),pos);}
      fs.writeFileSync(path.join(out,seg.id+'.wav'),Buffer.concat([waveHeader(data.length,targetRate,1),data]));
      cues.push({id:seg.id,speaker:role==='spirit'?'烁羽':'录忆者',text:seg.text,file:seg.id+'.wav',source:role+'-original.wav',sourceStart:start/original.rate,sourceEnd:end/original.rate,duration:count/targetRate,voiceId:meta.voiceId,timing:'Provider character alignment; phrase cuts at midpoint of inter-line gaps; no word highlighting'});
    }
  }
  return cues;
}
const manifest={created:'2026-11-18',score:{title:'林下金石',producer:'Codex / original algorithmic composition and offline modal synthesis',historicalClaim:false,license:'Original project score; no third-party sample material'},music:[makeScore(false),makeScore(true),makeAmbience(),makeCue('cue_touch',false),makeCue('cue_reveal',true)],cues:cutVoices()};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({music:manifest.music,cues:manifest.cues.map(({id,duration})=>({id,duration}))},null,2));

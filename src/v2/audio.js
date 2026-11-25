// Local, pre-rendered performances. Never substitutes the operating system voice.
export const DIALOGUE = Object.freeze({
  intro: { speaker: '烁羽', text: '我叫烁羽。雾后面还有路吗？我们一起去看看。', duration: 7.2 },
  listen: { speaker: '烁羽', text: '先停一停。水声，好像藏在树根后面。', duration: 5.6 },
  bird: { speaker: '录忆者', text: '这只铜鸟昂首、收翼，尾羽折而下垂。请转动光线，看看它的轮廓。', duration: 11 },
  jade: { speaker: '录忆者', text: '外方内圆，是这件玉琮醒目的构形。眼前的机关，是我们为探索创作的谜题。', duration: 12 },
  mask: { speaker: '烁羽', text: '这片金色很薄。把侧光移过来，边缘就亮了。', duration: 6.5 },
  tiger: { speaker: '录忆者', text: '石虎身上的深浅纹带，来自石材自身。顺着纹带观察，让碎片重新相接。', duration: 11.5 },
  sun: { speaker: '录忆者', text: '四只鸟围绕十二道光芒。古人的想象留下了线索，也留下了尚未回答的问题。', duration: 12 },
  ending: { speaker: '烁羽', text: '光回来了。我也记住了，和你走过的路。', duration: 6 },
  spirit_preview: { speaker: '烁羽', text: '我叫烁羽。我能照亮这一小段，剩下的，我们一起去找。', duration: 8 },
  narrator_preview: { speaker: '录忆者', text: '我是录忆者。器物留下的线索，需要我们慢慢观察。', duration: 8 },
});
const ASSETS = '/assets/audio/';
const clamp = v => Math.max(0, Math.min(1, Number.isFinite(Number(v)) ? Number(v) : 0));

export class ForestAudio {
  constructor({ onSubtitle = () => {}, dialogue = {} } = {}) {
    this.onSubtitle = onSubtitle;
    this.dialogue = { ...DIALOGUE, ...dialogue };
    this.volumes = { music: .55, ambience: .55, voice: .9, effects: .65, master: 1 };
    this.queue = []; this.recent = new Map(); this.buffers = new Map();
    this.region = 0; this.paused = false; this.disposed = false; this.active = null;
    this.layers = {}; this.cueSources = new Set(); this.unlocked = false;this.eventEpoch=0;
  }
  async unlock() {
    if (this.disposed) return false;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain(); this.master.connect(this.context.destination);
        this.environmentFilter=this.context.createBiquadFilter();this.environmentFilter.type='lowpass';this.environmentFilter.frequency.value=18000;this.environmentFilter.Q.value=.6;this.environmentFilter.connect(this.master);
        this.buses = {};
        for (const name of ['music', 'ambience', 'voice', 'effects']) {
          const gain = this.context.createGain(); gain.connect(name==='voice'?this.master:this.environmentFilter); this.buses[name] = gain;
        }
        this._mix();
      }
      if (!this.paused) await this.context.resume();
      this.unlocked = true;
      this._startMusic();
      this._startLayer('forest', 'ambience');
      this._startLayer('flight-wind','effects');
      this._next();
      return this.context.state === 'running';
    } catch { return false; }
  }
  async _buffer(name) {
    if (!this.context || this.disposed) return null;
    if (!this.buffers.has(name)) {
      const context = this.context;
      const request = (async () => {
        const urls = this.assetURLs?.[name] ? [this.assetURLs[name], ASSETS + name + '.wav'] : [ASSETS + name + '.wav'];
        for(const url of urls){
          const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
          try { const response=await fetch(url,{signal:controller.signal});if(response.ok)return await context.decodeAudioData(await response.arrayBuffer()); }
          catch {} finally {clearTimeout(timeout);}
        }
        this.buffers.delete(name);return null;
      })();
      this.buffers.set(name, request);
    }
    return this.buffers.get(name);
  }
  async _startLayer(name, bus) {
    if (this.layers[name] || this.disposed) return;
    this.layers[name] = { pending: true };
    const buffer = await this._buffer(name);
    if (!buffer || this.disposed) { delete this.layers[name]; return; }
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; source.loop = true; source.connect(gain); gain.connect(this.buses[bus]);
    gain.gain.value = 0; source.start(); this.layers[name] = { source, gain };
    this._mix();
  }
  async _startMusic() {
    if (this.musicPending || this.layers.exploration || this.disposed) return;
    this.musicPending = true;
    const buffers = await Promise.all(['exploration', 'reveal'].map(name => this._buffer(this.musicAssets?.[name] || name)));
    if (this.disposed) return;
    const at = this.context.currentTime + .08;
    for (let i = 0; i < buffers.length; i++) {
      if (!buffers[i]) continue;
      const source = this.context.createBufferSource(), gain = this.context.createGain();
      source.buffer = buffers[i]; source.loop = true; source.connect(gain); gain.connect(this.buses.music);
      gain.gain.value = 0; source.start(at); this.layers[['exploration', 'reveal'][i]] = { source, gain };
    }
    this.musicPending = false; this._mix();
  }
  _target(param, value, seconds = .3) {
    if (!this.context) return;
    param.cancelScheduledValues(this.context.currentTime);
    param.setTargetAtTime(value, this.context.currentTime, seconds);
  }
  _mix() {
    if (!this.context) return;
    const duck = this.active ? .25 : 1;
    this._target(this.master.gain, this.volumes.master, .08);
    for (const [name, gain] of Object.entries(this.buses)) {
      this._target(gain.gain, this.volumes[name] * (name === 'music' ? duck : name === 'ambience' && this.active ? .5 : 1));
    }
    const revealed = this.region >= 4 ? .8 : this.region >= 2 ? .36 : 0;
    if (this.layers.exploration?.gain) this._target(this.layers.exploration.gain.gain, 1 - revealed, 1.4);
    if (this.layers.reveal?.gain) this._target(this.layers.reveal.gain.gain, revealed, 1.4);
    if (this.layers.forest?.gain) this._target(this.layers.forest.gain.gain, .65 + (this.region % 2) * .15, 1.1);
  }
  setRegion(index) { this.region = Math.max(0, Math.min(5, Number(index) || 0)); this._mix(); }
  setVolume(bus, value) {
    const name = ({ bgm: 'music', ambient: 'ambience', dialogue: 'voice', sfx: 'effects' })[bus] || bus;
    if (name in this.volumes) { this.volumes[name] = clamp(value); this._mix(); }
  }
  speak(id) {
    if (!this.dialogue[id] || this.disposed) return false;
    const now = performance.now(), preview = id.endsWith('_preview');
    if (this.active?.id === id || this.queue.includes(id) || (!preview && now - (this.recent.get(id) ?? -Infinity) < 15000)) return false;
    this.queue.push(id); this.recent.set(id, now); this._next(); return true;
  }
  async _next() {
    if (this.active || this.paused || this.disposed || !this.queue.length) return;
    const id = this.queue.shift(), line = this.dialogue[id];
    const active = { id, remaining: line.duration, startedAt: 0, source: null, timer: null, state: 'loading' };
    this.active = active; this._mix();
    const buffer = this.unlocked ? await this._buffer(id) : null;
    if (this.disposed || this.active !== active) return;
    if (buffer) {
      clearTimeout(active.timer); active.timer = null; active.state = 'playing';
      active.remaining = buffer.duration;
      active.source = this.context.createBufferSource(); active.source.buffer = buffer;
      active.source.connect(this.buses.voice);
      active.source.onended = () => this._finish(active);
      active.source.start(); active.startedAt = this.context.currentTime;
      if (!this.paused) this.onSubtitle({ ...line, duration: buffer.duration });
    } else {
      active.state = 'fallback';
      if (!this.paused) { this.onSubtitle({ ...line, duration: active.remaining }); this._fallbackTimer(active); }
    }
  }
  _fallbackTimer(active) {
    active.startedAt = performance.now();
    active.timer = setTimeout(() => this._finish(active), active.remaining * 1000);
  }
  _finish(active) {
    if (this.active !== active || this.disposed) return;
    clearTimeout(active.timer); active.source?.disconnect(); this.active = null; this._mix(); this._next();
  }
  setPaused(paused) {
    if (this.disposed || this.paused === Boolean(paused)) return;
    if(paused)this.eventEpoch++;
    this.paused = Boolean(paused); const active = this.active;
    if (this.paused) {
      this.context?.suspend().catch(() => {});
      if (active?.timer) {
        clearTimeout(active.timer); active.timer = null;
        active.remaining = Math.max(.1, active.remaining - (performance.now() - active.startedAt) / 1000);
      }
    } else {
      if (this.unlocked) this.context?.resume().catch(() => {});
      if (active && active.state !== 'loading') {
        const remaining = active.source ? Math.max(.1, active.remaining - (this.context.currentTime - active.startedAt)) : active.remaining;
        this.onSubtitle({ ...this.dialogue[active.id], duration: remaining });
        if (active.state === 'fallback') this._fallbackTimer(active);
      } else if (!active) this._next();
    }
  }
  async playCue(name) {
    if (!this.unlocked || this.paused || this.disposed) return;
    const epoch=this.eventEpoch,requestedAt=performance.now();
    const key = /reveal|discover|solve|success|complete|ending/.test(name) ? 'cue_reveal' : 'cue_touch';
    const buffer = await this._buffer(key);
    if (!buffer || this.paused || this.disposed || epoch!==this.eventEpoch || performance.now()-requestedAt>1200) return;
    const source = this.context.createBufferSource(); source.buffer = buffer; source.connect(this.buses.effects);
    this.cueSources.add(source); source.onended = () => { this.cueSources.delete(source); source.disconnect(); }; source.start();
  }
  setMotion(state) {
    if(!this.context)return;
    const underwater=state.mode==='diving';
    this._target(this.environmentFilter.frequency,underwater?1000:18000,.25);
    const flying=['rising','flying','gliding','falling'].includes(state.mode);
    if(this.layers['flight-wind']?.gain)this._target(this.layers['flight-wind'].gain.gain,flying?Math.min(.55,(state.speed||0)*.06):0,.3);
  }
  async playMotion(type, strength=1) {
    if(!this.unlocked||this.paused||this.disposed)return;
    const epoch=this.eventEpoch;
    const map={step:'step',jump:'wing',takeoff:'wing',land:'land',splash:'splash',dive:'dive',surface:'surface',perch:'perch'};
    if(!map[type])return;const now=performance.now();this.motionTimes??={};if(now-(this.motionTimes[type]??-Infinity)<120)return;this.motionTimes[type]=now;
    const buffer=await this._buffer('motion-'+map[type]);if(!buffer||this.paused||this.disposed||epoch!==this.eventEpoch||performance.now()-now>1200)return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=Math.max(.1,Math.min(1,strength))*.7;source.connect(gain);gain.connect(this.buses.effects);this.cueSources.add(source);source.onended=()=>{this.cueSources.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
  dispose() {
    this.disposed = true; this.queue.length = 0; clearTimeout(this.active?.timer);
    for (const item of Object.values(this.layers)) { try { item.source?.stop(); } catch {} }
    for (const source of this.cueSources) { try { source.stop(); } catch {} }
    try { this.active?.source?.stop(); } catch {}
    this.context?.close().catch(() => {}); this.buffers.clear(); this.layers = {}; this.active = null;
  }
}

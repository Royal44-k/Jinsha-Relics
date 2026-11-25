/**
 * Original procedural soundscape. No recordings, downloads, or autoplay.
 * Call start() directly from a pointer/keyboard gesture; a false result means
 * the browser could not enable audio, and the game can continue silently.
 */
export class Soundscape {
  constructor({ volume = 0.42, muted = false } = {}) {
    this.context = null;
    this.master = null;
    this.volume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.42));
    this.muted = Boolean(muted);
    this.available = Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
    this.started = false;
    this.disposed = false;
    this._sources = new Set();
    this._nodes = new Set();
    this._melodyTimer = null;
    this._stepTime = -Infinity;
    this._stepSide = 1;
    this._melodyIndex = 0;
    this._noiseBuffer = null;
    this._voice = null;
    this._visibilityHandler = () => {
      if (!this.context || this.disposed) return;
      if (document.hidden) {
        this.stopVoice();
        this.context.suspend().catch(() => {});
      } else if (this.started) {
        this.context.resume().catch(() => {});
      }
    };
  }

  async start() {
    if (this.disposed || !this.available) return false;
    try {
      if (!this.context) {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        this.context = new Audio({ latencyHint: 'interactive' });
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -18;
        limiter.knee.value = 16;
        limiter.ratio.value = 4;
        limiter.attack.value = 0.008;
        limiter.release.value = 0.3;
        this.master.connect(limiter);
        limiter.connect(this.context.destination);
        this._nodes.add(this.master);
        this._nodes.add(limiter);
        this._noiseBuffer = this._makeNoise(4);
      }
      // Request resume before awaiting so the call retains the user gesture.
      await this.context.resume();
      if (this.disposed || this.context.state !== 'running') return false;
      if (!this.started) {
        this.started = true;
        this._ambience();
        this._scheduleMelody();
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', this._visibilityHandler);
        }
      }
      this._updateVolume(0.8);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) this.stopVoice();
    this._updateVolume(0.12);
  }

  setVolume(volume) {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.min(1, Math.max(0, volume));
    this._updateVolume(0.12);
    if (this._voice) this._voice.volume = this.volume * 0.9;
  }

  _updateVolume(seconds) {
    if (!this.master || !this.context || this.context.state === 'closed') return;
    const time = this.context.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(time);
    gain.setValueAtTime(gain.value, time);
    gain.linearRampToValueAtTime(this.muted ? 0 : this.volume, time + seconds);
  }

  _makeNoise(seconds) {
    const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown-leaning noise is softer than raw white noise for wind and gravel.
    let previous = 0;
    for (let i = 0; i < data.length; i += 1) {
      previous = (previous + (Math.random() * 2 - 1) * 0.045) / 1.025;
      data[i] = previous * 3.6;
    }
    return buffer;
  }

  _track(source, nodes = []) {
    this._sources.add(source);
    for (const node of nodes) this._nodes.add(node);
    source.onended = () => {
      this._sources.delete(source);
      try { source.disconnect(); } catch { /* Already disposed. */ }
      for (const node of nodes) {
        try { node.disconnect(); } catch { /* Already disposed. */ }
        this._nodes.delete(node);
      }
    };
    return source;
  }

  _ambience() {
    const ctx = this.context;
    const time = ctx.currentTime;
    // Air through an imagined wooded river bank, with an almost imperceptible swell.
    const air = ctx.createBufferSource();
    air.buffer = this._noiseBuffer;
    air.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 620;
    lowpass.Q.value = 0.35;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.11;
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.075;
    const breathAmount = ctx.createGain();
    breathAmount.gain.value = 0.045;
    breath.connect(breathAmount);
    breathAmount.connect(airGain.gain);
    air.connect(lowpass);
    lowpass.connect(airGain);
    airGain.connect(this.master);
    this._track(air, [lowpass, airGain]).start(time);
    this._track(breath, [breathAmount]).start(time);

    // Open fifths leave the foreground bells and narration room to breathe.
    [73.416, 110, 146.832].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 1 ? -3 : 2;
      gain.gain.value = index === 0 ? 0.025 : 0.012;
      oscillator.connect(gain);
      gain.connect(this.master);
      this._track(oscillator, [gain]).start(time);
    });
  }

  _ready() {
    return this.started && !this.disposed && !this.muted &&
      this.context?.state === 'running';
  }

  _tone(frequency, when, duration, amplitude = 0.1, pan = 0, metallic = false) {
    if (!this._ready()) return;
    const ctx = this.context;
    // Inharmonic partials give discoveries a restrained bronze-bell color.
    const partials = metallic ? [[1, 1], [2.76, 0.2], [4.07, 0.07]] : [[1, 1], [2, 0.09]];
    for (const [ratio, weight] of partials) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (panner.pan) panner.pan.value = pan;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * ratio;
      const end = when + duration / Math.sqrt(ratio);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(amplitude * weight, when + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(panner);
      panner.connect(this.master);
      this._track(oscillator, [gain, panner]);
      oscillator.start(when);
      oscillator.stop(end + 0.05);
    }
  }

  _scheduleMelody() {
    if (this.disposed) return;
    this._melodyTimer = setTimeout(() => {
      if (this._ready() && !this._voice) {
        // A slow D pentatonic phrase; intentionally sparse, with no recorded music.
        const notes = [293.665, 440, 391.995, 329.628, 493.883, 440, 293.665, 391.995];
        const index = this._melodyIndex++ % notes.length;
        this._tone(notes[index], this.context.currentTime, 4.2, 0.028, Math.sin(index * 2) * 0.45);
      }
      this._scheduleMelody();
    }, 6500 + Math.random() * 5500);
  }

  footstep() {
    if (!this._ready()) return;
    const ctx = this.context;
    const time = ctx.currentTime;
    if (time - this._stepTime < 0.24) return;
    this._stepTime = time;
    this._stepSide *= -1;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = this._stepSide * 0.16;
    source.buffer = this._noiseBuffer;
    source.playbackRate.value = 0.85 + Math.random() * 0.25;
    filter.type = 'lowpass';
    filter.frequency.value = 570 + Math.random() * 300;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.25, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.17);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.master);
    this._track(source, [filter, gain, pan]);
    source.start(time, Math.random() * 2);
    source.stop(time + 0.19);
  }

  discover() {
    if (!this._ready()) return;
    const time = this.context.currentTime;
    [293.665, 440, 587.33].forEach((note, index) => {
      this._tone(note, time + index * 0.16, 2.8, 0.12 - index * 0.02, (index - 1) * 0.2, true);
    });
  }

  chime(success = true) {
    if (!this._ready()) return;
    const time = this.context.currentTime;
    const notes = success ? [440, 587.33, 659.255] : [220, 196];
    notes.forEach((note, index) => {
      this._tone(note, time + index * 0.16, success ? 1.8 : 0.7, success ? 0.1 : 0.065, 0, success);
    });
  }

  finale() {
    if (!this._ready()) return;
    const time = this.context.currentTime;
    [146.832, 220, 293.665, 391.995, 440, 587.33].forEach((note, index) => {
      this._tone(note, time + index * 0.36, 5.4, 0.075, (index % 3 - 1) * 0.3, true);
    });
    this._tone(73.416, time, 6.5, 0.12);
  }

  /** Optional accessible narration. Voice availability depends on the browser/OS. */
  speak(text) {
    if (!this.started || this.disposed || this.muted || !this.volume ||
        !globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance || !text) return false;
    this.stopVoice();
    try {
      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.lang = 'zh-CN';
      utterance.rate = 0.84;
      utterance.pitch = 0.9;
      utterance.volume = this.volume * 0.9;
      const voices = speechSynthesis.getVoices();
      const voice = voices.find((candidate) => /^zh[-_]CN$/i.test(candidate.lang)) ||
        voices.find((candidate) => /^zh/i.test(candidate.lang));
      if (voice) utterance.voice = voice;
      const done = () => { if (this._voice === utterance) this._voice = null; };
      utterance.onend = done;
      utterance.onerror = done;
      this._voice = utterance;
      speechSynthesis.speak(utterance);
      return true;
    } catch {
      this._voice = null;
      return false;
    }
  }

  stopVoice() {
    if (this._voice && globalThis.speechSynthesis) {
      try { speechSynthesis.cancel(); } catch { /* Narration is optional. */ }
    }
    this._voice = null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.started = false;
    clearTimeout(this._melodyTimer);
    this.stopVoice();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
    for (const source of this._sources) {
      try { source.stop(); source.disconnect(); } catch { /* One-shot already ended. */ }
    }
    for (const node of this._nodes) {
      try { node.disconnect(); } catch { /* Already disconnected. */ }
    }
    this._sources.clear();
    this._nodes.clear();
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this._noiseBuffer = null;
  }
}

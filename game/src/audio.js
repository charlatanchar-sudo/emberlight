// Emberlight's sound: every effect is synthesised with WebAudio oscillators and filtered
// noise — there are no audio files. The context is created lazily on the first user gesture
// (browsers refuse to start one sooner), and a master gain node carries the mute switch.

const FIRE_MIN_INTERVAL = 0.045; // seconds; a held trigger would otherwise stack into mush

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.lastFireAt = -Infinity;
  }

  /** Create (or resume) the audio context. Call from click and key handlers. */
  unlock() {
    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  /** Flip the mute switch; returns the new muted state. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.setValueAtTime(this.muted ? 0 : 0.5, this.context.currentTime);
    }
    return this.muted;
  }

  /** One oscillator note with a pitch glide and an exponential decay envelope. */
  tone({ type = 'sine', from = 440, to = null, duration = 0.15, gain = 0.2, delay = 0 }) {
    if (!this.context || this.muted) return;
    const start = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** One burst of white noise through a low-pass filter: explosions and heavy hits. */
  noise({ duration = 0.25, gain = 0.3, cutoff = 1200, delay = 0 }) {
    if (!this.context || this.muted) return;
    const start = this.context.currentTime + delay;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(60, start + duration);
    const amp = this.context.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(amp).connect(this.master);
    source.start(start);
  }

  /** The warden's bolt leaving the barrel: a short square blip that drops in pitch. */
  fire() {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (now - this.lastFireAt < FIRE_MIN_INTERVAL) return;
    this.lastFireAt = now;
    this.tone({ type: 'square', from: 920, to: 480, duration: 0.07, gain: 0.055 });
  }

  /** A bolt striking a moth: a tiny metallic tick. */
  hit() {
    this.tone({ type: 'triangle', from: 1500, to: 900, duration: 0.05, gain: 0.07 });
  }

  /** A moth bursting. Big kills (the storm elite) get a longer, deeper boom. */
  explosion(big = false) {
    this.noise({ duration: big ? 0.55 : 0.22, gain: big ? 0.5 : 0.22, cutoff: big ? 900 : 1500 });
    this.tone({ type: 'sine', from: big ? 220 : 320, to: 50, duration: big ? 0.5 : 0.2, gain: big ? 0.4 : 0.18 });
  }

  /** An ember shard collected: a rising chirp that climbs with the combo stack. */
  pickup(stacks = 0) {
    const base = 620 * Math.pow(1.059, Math.min(stacks, 12));
    this.tone({ type: 'sine', from: base, to: base * 1.5, duration: 0.09, gain: 0.12 });
  }

  /** The warden's hull taking a hit: a harsh falling saw. */
  playerHurt() {
    this.tone({ type: 'sawtooth', from: 200, to: 60, duration: 0.22, gain: 0.25 });
    this.noise({ duration: 0.12, gain: 0.12, cutoff: 800 });
  }

  /** A moth reaching the lantern: a deep thud under a glassy crack. */
  lanternHurt() {
    this.tone({ type: 'sine', from: 110, to: 40, duration: 0.35, gain: 0.45 });
    this.tone({ type: 'triangle', from: 1800, to: 300, duration: 0.12, gain: 0.08 });
  }

  /** A new wave announced: two warm triangle notes, up a fifth. */
  waveStart() {
    this.tone({ type: 'triangle', from: 392, duration: 0.14, gain: 0.18 });
    this.tone({ type: 'triangle', from: 587, duration: 0.2, gain: 0.18, delay: 0.11 });
  }

  /** A run beginning: a quick rising sweep. */
  runStart() {
    this.tone({ type: 'triangle', from: 330, to: 880, duration: 0.25, gain: 0.16 });
  }

  /** The light going out: three descending notes and a last low boom. */
  gameOver() {
    this.tone({ type: 'triangle', from: 523, duration: 0.25, gain: 0.2 });
    this.tone({ type: 'triangle', from: 392, duration: 0.25, gain: 0.2, delay: 0.22 });
    this.tone({ type: 'triangle', from: 262, duration: 0.5, gain: 0.22, delay: 0.44 });
    this.noise({ duration: 0.7, gain: 0.25, cutoff: 500, delay: 0.1 });
  }
}

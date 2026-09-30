// Web Audio API ambient soundscapes synthesizer for real spatial atmospheric immersion

class SoundscapeEngine {
  private audioCtx: AudioContext | null = null;
  private currentSource: OscillatorNode | AudioNode | null = null;
  private isPlaying: boolean = false;
  private currentType: string = '';
  private timer: any = null;

  constructor() {
    // Auto-unlock AudioContext on first user interaction to comply with browser autoplay policies
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }
  }

  private initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Plays synthesized temple bell resonance
  public playTempleBells(volume: number = 0.5) {
    this.stop();
    this.initContext();
    if (!this.audioCtx) return;

    this.isPlaying = true;
    this.currentType = 'temple-chimes';

    const playBellStrike = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      
      const ctx = this.audioCtx;
      const fundamental = 432; // Healing frequency / Indian scale fundamental
      const harmonics = [fundamental, fundamental * 1.5, fundamental * 2.04, fundamental * 2.76, fundamental * 3.42];

      harmonics.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const duration = 3.5 - idx * 0.4;
        const noteGain = (volume / (idx + 1)) * 0.4;

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(noteGain, ctx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      });
    };

    playBellStrike();
    this.timer = setInterval(playBellStrike, 4500);
  }

  // Plays synthesized Marina coastal sea waves
  public playMarinaWaves(volume: number = 0.4) {
    this.stop();
    this.initContext();
    if (!this.audioCtx) return;

    this.isPlaying = true;
    this.currentType = 'marina-waves';

    const ctx = this.audioCtx;
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume * 0.3, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    whiteNoise.start();
    this.currentSource = whiteNoise;

    // LFO for periodic wave crests and swells
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.18, ctx.currentTime); // ~5.5 seconds wave period
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(450, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
  }

  // Plays synthesized Filter Coffee roastery sizzle
  public playFilterCoffeeAroma(volume: number = 0.35) {
    this.stop();
    this.initContext();
    if (!this.audioCtx) return;

    this.isPlaying = true;
    this.currentType = 'filter-coffee';

    const ctx = this.audioCtx;
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.6;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.Q.setValueAtTime(3.5, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume * 0.25, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    noise.start();
    this.currentSource = noise;
  }

  public playSoundscape(type: 'temple-chimes' | 'filter-coffee' | 'marina-waves' | 'monsoon-rain' | 'belfry', volume: number = 0.5) {
    if (type === 'temple-chimes' || type === 'belfry') {
      this.playTempleBells(volume);
    } else if (type === 'marina-waves') {
      this.playMarinaWaves(volume);
    } else if (type === 'filter-coffee') {
      this.playFilterCoffeeAroma(volume);
    } else {
      this.playMarinaWaves(volume * 0.8);
    }
  }

  public stop() {
    this.isPlaying = false;
    this.currentType = '';
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.currentSource) {
      try {
        (this.currentSource as any).stop?.();
      } catch {}
      this.currentSource = null;
    }
  }

  /**
   * Plays a subtle directional heritage chime with stereo panning based on relative azimuth
   * @param pan Stereo pan between -1.0 (full left) and +1.0 (full right), 0 is center
   * @param distanceMeters Proximity distance between 1m and 50m
   * @param baseFreq Harmonic fundamental chime pitch (e.g. 528 Hz or 432 Hz)
   */
  public playDirectionalProximityChime(
    pan: number = 0,
    distanceMeters: number = 35,
    baseFreq: number = 528
  ) {
    this.initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const clampedPan = Math.max(-1, Math.min(1, pan));

    // Dynamic volume and brightness inversely proportional to distance (closer = clearer/brighter)
    const normalizedDist = Math.max(0, Math.min(1, distanceMeters / 50));
    const proximityGain = (1 - normalizedDist * 0.45) * 0.42;

    // Harmonic frequencies for ethereal sacred heritage bell strike
    const harmonics = [baseFreq, baseFreq * 1.5, baseFreq * 2.02, baseFreq * 2.76];

    // Stereo Panner (if supported) or fallback
    let pannerNode: StereoPannerNode | null = null;
    try {
      if (ctx.createStereoPanner) {
        pannerNode = ctx.createStereoPanner();
        pannerNode.pan.setValueAtTime(clampedPan, ctx.currentTime);
      }
    } catch (e) {
      console.warn('StereoPanner not supported on this device/browser');
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(proximityGain, ctx.currentTime);

    if (pannerNode) {
      masterGain.connect(pannerNode);
      pannerNode.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    harmonics.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const decayDuration = 2.4 - idx * 0.35;
      const weight = (1 / (idx + 1)) * 0.55;

      noteGain.gain.setValueAtTime(0, ctx.currentTime);
      noteGain.gain.linearRampToValueAtTime(weight, ctx.currentTime + 0.025);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + decayDuration);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + decayDuration);
    });

    // If extremely close (< 20m), add a second delayed harmonic overtone ping
    if (distanceMeters < 20) {
      setTimeout(() => {
        if (!this.audioCtx) return;
        const subCtx = this.audioCtx;
        const subOsc = subCtx.createOscillator();
        const subGain = subCtx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(baseFreq * 2, subCtx.currentTime);
        subGain.gain.setValueAtTime(0, subCtx.currentTime);
        subGain.gain.linearRampToValueAtTime(proximityGain * 0.4, subCtx.currentTime + 0.02);
        subGain.gain.exponentialRampToValueAtTime(0.0001, subCtx.currentTime + 1.2);
        subOsc.connect(subGain);
        if (pannerNode) {
          subGain.connect(pannerNode);
        } else {
          subGain.connect(subCtx.destination);
        }
        subOsc.start(subCtx.currentTime);
        subOsc.stop(subCtx.currentTime + 1.2);
      }, 160);
    }
  }

  public getActiveType() {
    return this.isPlaying ? this.currentType : null;
  }
}

export const soundscapeEngine = new SoundscapeEngine();

import { findClosestNoteByFrequency, NoteSpec } from '../data/curriculum';

export interface MicPitchReading {
  frequency: number;
  note: NoteSpec;
  cents: number;
  rms: number;
  holdProgress: number; // 0 to 1
}

class SoundAndPitchEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  // Microphone pitch detection state
  private micStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private rafId: number | null = null;
  private timeDomainBuffer: Float32Array<ArrayBuffer> | null = null;
  private onPitchCallback: ((reading: MicPitchReading | null) => void) | null = null;
  private onNoteConfirmedCallback: ((note: NoteSpec) => void) | null = null;

  private stableMidi: number | null = null;
  private stableStartTime: number = 0;
  private cooldownUntil: number = 0;
  private readonly REQUIRED_HOLD_MS = 160; // fast & responsive yet immune to transients

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Synthesize a realistic warm acoustic piano tone using harmonic partials and filter envelope
   */
  public playPianoNote(frequency: number, duration = 0.85, volume = 0.28) {
    if (this.isMuted) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const masterGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(frequency * 6.5, 9000), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 1.8, 600), now + duration);

      // Piano amplitude envelope: crisp hammer strike -> natural exponential decay
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(volume, now + 0.012);
      masterGain.gain.exponentialRampToValueAtTime(volume * 0.45, now + 0.18);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Partial 1: Fundamental (Triangle/Sine blend)
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(frequency, now);
      osc1.connect(filter);

      // Partial 2: 2nd Harmonic (Octave overtone for warmth)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(frequency * 2, now);
      gain2.gain.setValueAtTime(0.32, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.65);
      osc2.connect(gain2);
      gain2.connect(filter);

      // Partial 3: 3rd Harmonic (Twelfth for acoustic body)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(frequency * 3, now);
      gain3.gain.setValueAtTime(0.11, now);
      gain3.gain.exponentialRampToValueAtTime(0.005, now + duration * 0.4);
      osc3.connect(gain3);
      gain3.connect(filter);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);

      osc1.stop(now + duration + 0.04);
      osc2.stop(now + duration + 0.04);
      osc3.stop(now + duration + 0.04);
    } catch {
      // Ignore audio errors if browser blocks autoplay prior to gesture
    }
  }

  /**
   * Play the target note pitch + a subtle high harmonic confirmation shimmer
   */
  public playCorrectFeedback(frequency: number) {
    if (this.isMuted) return;
    this.playPianoNote(frequency, 0.9, 0.3);
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency * 2, now + 0.05);
      gain.gain.setValueAtTime(0.0001, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.05);
      osc.stop(now + 0.45);
    } catch {
      // ignore
    }
  }

  /**
   * Soft, low muted buzzer sound for wrong answers
   */
  public playWrongFeedback() {
    if (this.isMuted) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      // Minor second low interval (softly filtered)
      osc1.frequency.setValueAtTime(138.59, now); // C#3
      osc2.frequency.setValueAtTime(130.81, now); // C3

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch {
      // ignore
    }
  }

  /**
   * Celebratory arpeggio when completing a level
   */
  public playLevelCompleteFanfare(passed: boolean) {
    if (this.isMuted) return;
    const notes = passed ? [261.63, 329.63, 392.0, 523.25] : [293.66, 261.63];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playPianoNote(freq, idx === notes.length - 1 ? 1.2 : 0.45, 0.24);
      }, idx * 115);
    });
  }

  /**
   * High-precision AudioContext clock for drift-free rhythm scheduling
   */
  public getAudioTime(): number {
    return this.ensureContext().currentTime;
  }

  /**
   * Synthesize woodblock metronome click ("Tick" on Beat 1, "Tock" on other beats)
   */
  public playMetronomeClick(isDownbeat: boolean, scheduledTime?: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.ensureContext();
      const t = scheduledTime !== undefined ? Math.max(ctx.currentTime, scheduledTime) : ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      const baseFreq = isDownbeat ? 1180 : 780;
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.48, t + 0.032);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq, t);
      filter.Q.setValueAtTime(3.2, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(isDownbeat ? 0.36 : 0.22, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.042);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.048);
    } catch {
      // ignore
    }
  }

  private activePadOsc1: OscillatorNode | null = null;
  private activePadOsc2: OscillatorNode | null = null;
  private activePadGain: GainNode | null = null;

  /**
   * Start a tactile drum-pad + warm marimba sustain tone when the user presses down (pointerdown / Spacebar)
   */
  public startRhythmPadHold(frequency = 293.66) {
    this.stopRhythmPadHold();
    if (this.isMuted) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      // Crisp percussive attack transient
      const transientOsc = ctx.createOscillator();
      const transientGain = ctx.createGain();
      transientOsc.type = 'sine';
      transientOsc.frequency.setValueAtTime(frequency * 3, now);
      transientOsc.frequency.exponentialRampToValueAtTime(frequency, now + 0.035);
      transientGain.gain.setValueAtTime(0.24, now);
      transientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      transientOsc.connect(transientGain);
      transientGain.connect(ctx.destination);
      transientOsc.start(now);
      transientOsc.stop(now + 0.05);

      // Sustained warm body while user holds the pad/key
      const gain = ctx.createGain();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(frequency, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(frequency * 2, now);

      const subGain2 = ctx.createGain();
      subGain2.gain.setValueAtTime(0.22, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.26, now + 0.01);
      // Keep audible sustain for up to 5 seconds so Whole Notes (4 beats) ring clearly while held
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.02, now + 4.8);

      osc1.connect(filter);
      osc2.connect(subGain2);
      subGain2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);

      this.activePadOsc1 = osc1;
      this.activePadOsc2 = osc2;
      this.activePadGain = gain;
    } catch {
      // ignore
    }
  }

  /**
   * Release the sustained rhythm pad tone when the user lifts their finger/Spacebar
   */
  public stopRhythmPadHold() {
    if (!this.ctx || !this.activePadGain) return;
    try {
      const now = this.ctx.currentTime;
      const gain = this.activePadGain;
      const osc1 = this.activePadOsc1;
      const osc2 = this.activePadOsc2;

      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

      setTimeout(() => {
        try {
          osc1?.stop();
          osc2?.stop();
          osc1?.disconnect();
          osc2?.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      }, 80);
    } catch {
      // ignore
    } finally {
      this.activePadOsc1 = null;
      this.activePadOsc2 = null;
      this.activePadGain = null;
    }
  }

  /**
   * Play a scheduled rhythm demonstration note for the "Listen First" (استمع أولاً) mode
   */
  public playRhythmNoteDemo(durationSeconds: number, scheduledTime?: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.ensureContext();
      const t = scheduledTime !== undefined ? Math.max(ctx.currentTime, scheduledTime) : ctx.currentTime;
      const effDur = Math.max(0.09, durationSeconds * 0.88);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(329.63, t); // E4 warm marimba-piano pitch
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, t);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.25, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.14, t + Math.min(0.18, effDur * 0.5));
      gain.gain.exponentialRampToValueAtTime(0.0001, t + effDur);

      osc1.connect(filter);
      osc2.connect(g2);
      g2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + effDur + 0.02);
      osc2.stop(t + effDur + 0.02);
    } catch {
      // ignore
    }
  }

  /**
   * Start Microphone Pitch Detection using Time-Domain Autocorrelation
   */
  public async startMicrophone(
    onPitch: (reading: MicPitchReading | null) => void,
    onNoteConfirmed: (note: NoteSpec) => void
  ): Promise<{ ok: boolean; error?: string }> {
    this.stopMicrophone();
    this.onPitchCallback = onPitch;
    this.onNoteConfirmedCallback = onNoteConfirmed;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { ok: false, error: 'Microphone API is not supported in this browser.' };
    }

    try {
      const ctx = this.ensureContext();
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });

      this.micSource = ctx.createMediaStreamSource(this.micStream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.micSource.connect(this.analyser);
      this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);

      this.stableMidi = null;
      this.stableStartTime = 0;
      this.cooldownUntil = performance.now() + 250;

      const loop = () => {
        if (!this.analyser || !this.timeDomainBuffer || !this.ctx) return;
        this.analyser.getFloatTimeDomainData(this.timeDomainBuffer);

        const result = this.autoCorrelate(this.timeDomainBuffer, this.ctx.sampleRate);
        const now = performance.now();

        if (result.frequency > 0) {
          const matched = findClosestNoteByFrequency(result.frequency);
          if (matched && Math.abs(matched.cents) <= 45) {
            if (now < this.cooldownUntil) {
              this.onPitchCallback?.({
                frequency: result.frequency,
                note: matched.note,
                cents: matched.cents,
                rms: result.rms,
                holdProgress: 0,
              });
            } else {
              if (this.stableMidi === matched.note.midi) {
                const elapsed = now - this.stableStartTime;
                const progress = Math.min(1, elapsed / this.REQUIRED_HOLD_MS);

                this.onPitchCallback?.({
                  frequency: result.frequency,
                  note: matched.note,
                  cents: matched.cents,
                  rms: result.rms,
                  holdProgress: progress,
                });

                if (progress >= 1) {
                  // Confirmed! Enter brief cooldown so sustained tone doesn't double-trigger
                  this.cooldownUntil = now + 650;
                  this.stableMidi = null;
                  this.onNoteConfirmedCallback?.(matched.note);
                }
              } else {
                this.stableMidi = matched.note.midi;
                this.stableStartTime = now;
                this.onPitchCallback?.({
                  frequency: result.frequency,
                  note: matched.note,
                  cents: matched.cents,
                  rms: result.rms,
                  holdProgress: 0.1,
                });
              }
            }
          } else {
            this.stableMidi = null;
            this.onPitchCallback?.(null);
          }
        } else {
          this.stableMidi = null;
          this.onPitchCallback?.(null);
        }

        this.rafId = requestAnimationFrame(loop);
      };

      this.rafId = requestAnimationFrame(loop);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone permission denied.';
      return { ok: false, error: msg };
    }
  }

  public stopMicrophone() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // ignore
      }
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.analyser = null;
    this.stableMidi = null;
  }

  /**
   * Normalized Time-Domain Autocorrelation with Parabolic Interpolation
   * Accurately detects fundamental pitch from 82 Hz (E2) to 1100 Hz (C6+)
   */
  private autoCorrelate(
    buf: Float32Array<ArrayBuffer>,
    sampleRate: number
  ): { frequency: number; rms: number } {
    const size = buf.length;
    let rms = 0;

    for (let i = 0; i < size; i++) {
      const val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / size);

    // Noise gate: ignore quiet room ambiance
    if (rms < 0.014) {
      return { frequency: -1, rms };
    }

    // Trim leading/trailing silence to sharpen correlation window
    let r1 = 0;
    let r2 = size - 1;
    const thres = 0.2;
    for (let i = 0; i < size / 2; i++) {
      if (Math.abs(buf[i]) < thres) {
        r1 = i;
        break;
      }
    }
    for (let i = 1; i < size / 2; i++) {
      if (Math.abs(buf[size - i]) < thres) {
        r2 = size - i;
        break;
      }
    }

    const trimmed = buf.slice(r1, r2);
    const newSize = trimmed.length;
    if (newSize < 64) return { frequency: -1, rms };

    const c = new Float32Array(newSize);
    for (let i = 0; i < newSize; i++) {
      let sum = 0;
      for (let j = 0; j < newSize - i; j++) {
        sum += trimmed[j] * trimmed[j + i];
      }
      c[i] = sum;
    }

    // Skip zero-lag peak (walk down initial slope)
    let d = 0;
    while (d < newSize - 1 && c[d] > c[d + 1]) {
      d++;
    }

    let maxval = -1;
    let maxpos = -1;
    for (let i = d; i < newSize; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    // Clarity threshold: ensure harmonic periodicity
    if (maxpos <= 0 || maxval < c[0] * 0.45) {
      return { frequency: -1, rms };
    }

    // Parabolic interpolation for sub-sample precision
    let T0 = maxpos;
    if (T0 > 0 && T0 < newSize - 1) {
      const x1 = c[T0 - 1];
      const x2 = c[T0];
      const x3 = c[T0 + 1];
      const a = (x1 + x3 - 2 * x2) / 2;
      const b = (x3 - x1) / 2;
      if (a) {
        T0 = T0 - b / (2 * a);
      }
    }

    const frequency = sampleRate / T0;
    if (frequency < 80 || frequency > 1250) {
      return { frequency: -1, rms };
    }

    return { frequency, rms };
  }
}

export const audioEngine = new SoundAndPitchEngine();

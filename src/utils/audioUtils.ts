// Audio Utilities & DSP Audio Engine for Voice Cloning Studio

let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioCtxClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

// Generate synthetic studio impulse response for Convolution Reverb
function createStudioImpulseResponse(ctx: AudioContext, duration: number = 1.5, decay: number = 2.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const n = (Math.random() * 2 - 1) * Math.pow(1 - t / duration, decay);
    left[i] = n;
    right[i] = n;
  }
  return impulse;
}

export interface StudioDspEffects {
  bassBoostDb: number;      // e.g. 0 to +12 dB
  trebleClarityDb: number;  // e.g. 0 to +8 dB
  reverbAmount: number;     // e.g. 0 to 0.7
  playbackSpeed: number;    // e.g. 0.8 to 1.5
}

export class StudioAudioEngine {
  private ctx: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode;
  private gainNode: GainNode;
  private bassFilter: BiquadFilterNode;
  private trebleFilter: BiquadFilterNode;
  private convolver: ConvolverNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private isPlaying: boolean = false;
  private onEndedCallback: (() => void) | null = null;

  constructor() {
    this.ctx = getAudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.gainNode = this.ctx.createGain();
    this.bassFilter = this.ctx.createBiquadFilter();
    this.bassFilter.type = 'lowshelf';
    this.bassFilter.frequency.value = 220; // warm chest resonance

    this.trebleFilter = this.ctx.createBiquadFilter();
    this.trebleFilter.type = 'highshelf';
    this.trebleFilter.frequency.value = 3500; // vocal air & presence

    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = createStudioImpulseResponse(this.ctx, 1.2, 2.5);

    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.wetGain.gain.value = 0;
  }

  public async loadFromBase64(base64Wav: string): Promise<AudioBuffer> {
    this.stop();
    const clean = base64Wav.replace(/^data:[^;]+;base64,/, '');
    const binary = atob(clean);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;
    this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.pauseOffset = 0;
    return this.audioBuffer;
  }

  public applyEffects(effects: StudioDspEffects) {
    if (this.bassFilter) {
      this.bassFilter.gain.setTargetAtTime(effects.bassBoostDb, this.ctx.currentTime, 0.05);
    }
    if (this.trebleFilter) {
      this.trebleFilter.gain.setTargetAtTime(effects.trebleClarityDb, this.ctx.currentTime, 0.05);
    }
    if (this.wetGain && this.dryGain) {
      this.wetGain.gain.setTargetAtTime(effects.reverbAmount * 0.6, this.ctx.currentTime, 0.05);
      this.dryGain.gain.setTargetAtTime(1 - effects.reverbAmount * 0.3, this.ctx.currentTime, 0.05);
    }
    if (this.source && this.source.playbackRate) {
      this.source.playbackRate.setValueAtTime(effects.playbackSpeed, this.ctx.currentTime);
    }
  }

  public play(effects?: StudioDspEffects, onEnded?: () => void) {
    if (!this.audioBuffer) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.isPlaying) {
      this.stop();
    }

    this.onEndedCallback = onEnded || null;
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.audioBuffer;

    if (effects?.playbackSpeed) {
      this.source.playbackRate.value = effects.playbackSpeed;
    }

    // Connect audio graph:
    // Source -> Bass -> Treble -> [Dry -> Analyser -> Out] & [Convolver -> Wet -> Analyser -> Out]
    this.source.connect(this.bassFilter);
    this.bassFilter.connect(this.trebleFilter);

    this.trebleFilter.connect(this.dryGain);
    this.dryGain.connect(this.gainNode);

    this.trebleFilter.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.gainNode);

    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    if (effects) {
      this.applyEffects(effects);
    }

    const offset = Math.min(this.pauseOffset, this.audioBuffer.duration);
    this.startTime = this.ctx.currentTime - offset;
    this.source.start(0, offset);
    this.isPlaying = true;

    this.source.onended = () => {
      this.isPlaying = false;
      this.pauseOffset = 0;
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    };
  }

  public pause() {
    if (!this.isPlaying || !this.source) return;
    const elapsed = this.ctx.currentTime - this.startTime;
    this.pauseOffset = elapsed;
    try {
      this.source.stop();
    } catch {}
    this.isPlaying = false;
  }

  public stop() {
    if (this.source) {
      try {
        this.source.stop();
      } catch {}
      this.source.disconnect();
      this.source = null;
    }
    this.isPlaying = false;
    this.pauseOffset = 0;
  }

  public seek(targetRatio: number, effects?: StudioDspEffects) {
    if (!this.audioBuffer) return;
    const targetSeconds = this.audioBuffer.duration * Math.max(0, Math.min(1, targetRatio));
    const wasPlaying = this.isPlaying;
    this.stop();
    this.pauseOffset = targetSeconds;
    if (wasPlaying) {
      this.play(effects, this.onEndedCallback || undefined);
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying) return this.pauseOffset;
    return this.ctx.currentTime - this.startTime;
  }

  public getDuration(): number {
    return this.audioBuffer?.duration || 0;
  }

  public getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  public isAudioPlaying(): boolean {
    return this.isPlaying;
  }
}

// Download base64 WAV file as audio file
export function downloadWavFile(base64Wav: string, filename: string = 'cloned-voice.wav') {
  const clean = base64Wav.replace(/^data:[^;]+;base64,/, '');
  const byteChars = atob(clean);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Convert Audio Blob to Base64
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

import type { SoundPackId } from '../types/chess';

export type ChessSoundType =
  | 'move'
  | 'capture'
  | 'check'
  | 'checkmate'
  | 'castle'
  | 'promote'
  | 'victory'
  | 'defeat'
  | 'draw'
  | 'click';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private pack: SoundPackId = 'wood';
  private volume = 0.7;
  private muted = false;

  configure(pack: SoundPackId, volume: number, muted: boolean) {
    this.pack = pack;
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainPeak: number, delay = 0) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainPeak * this.volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  play(sound: ChessSoundType) {
    if (this.muted || this.pack === 'silent' || this.volume <= 0) return;

    const baseOsc: OscillatorType =
      this.pack === 'wood' ? 'triangle' : this.pack === 'glass' ? 'sine' : 'square';
    const scale = this.pack === 'glass' ? 1.55 : this.pack === 'digital' ? 1.2 : 1;

    switch (sound) {
      case 'move':
        this.tone(190 * scale, 0.075, baseOsc, 0.25);
        break;
      case 'capture':
        this.tone(145 * scale, 0.09, 'sawtooth', 0.22);
        this.tone(260 * scale, 0.06, baseOsc, 0.18, 0.02);
        break;
      case 'castle':
        this.tone(190 * scale, 0.07, baseOsc, 0.24);
        this.tone(235 * scale, 0.07, baseOsc, 0.24, 0.08);
        break;
      case 'promote':
        this.tone(440, 0.08, 'triangle', 0.2);
        this.tone(660, 0.14, 'triangle', 0.24, 0.07);
        break;
      case 'check':
        this.tone(520 * scale, 0.1, 'triangle', 0.26);
        this.tone(680 * scale, 0.12, 'sine', 0.22, 0.06);
        break;
      case 'checkmate':
        this.tone(330, 0.14, 'triangle', 0.28);
        this.tone(262, 0.24, 'triangle', 0.3, 0.12);
        break;
      case 'victory':
        this.tone(523.25, 0.1, 'triangle', 0.22);
        this.tone(659.25, 0.1, 'triangle', 0.22, 0.09);
        this.tone(783.99, 0.24, 'triangle', 0.26, 0.18);
        break;
      case 'defeat':
        this.tone(349.23, 0.12, 'triangle', 0.22);
        this.tone(293.66, 0.24, 'triangle', 0.22, 0.12);
        break;
      case 'draw':
        this.tone(440, 0.12, 'sine', 0.18);
        this.tone(440, 0.14, 'sine', 0.16, 0.14);
        break;
      case 'click':
        this.tone(620, 0.03, 'sine', 0.08);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();

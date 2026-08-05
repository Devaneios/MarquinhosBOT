// Minimal synthesized SFX (Web Audio oscillator beeps) — no external audio
// assets in the repo, so hit/score/win each get a short square-wave blip at
// a different pitch/duration instead of a sample.
type BeepSpec = { frequency: number; durationSeconds: number };

const HIT: BeepSpec = { frequency: 220, durationSeconds: 0.05 };
const SCORE: BeepSpec = { frequency: 440, durationSeconds: 0.15 };
const WIN: BeepSpec = { frequency: 660, durationSeconds: 0.3 };

export class PongSfx {
  private ctx: AudioContext | null = null;
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  hit() {
    this.beep(HIT);
  }

  score() {
    this.beep(SCORE);
  }

  win() {
    this.beep(WIN);
  }

  dispose() {
    this.ctx?.close();
    this.ctx = null;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) this.ctx = new Ctor();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private beep({ frequency, durationSeconds }: BeepSpec) {
    const ctx = this.getContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + durationSeconds,
    );
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + durationSeconds);
  }
}

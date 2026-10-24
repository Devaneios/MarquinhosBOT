const CHIME_NOTES = [
  { frequency: 523.25, offsetSeconds: 0, durationSeconds: 0.09 },
  { frequency: 659.25, offsetSeconds: 0.08, durationSeconds: 0.14 },
];

let sharedAudioContext: AudioContext | null = null;
let sharedAudioContextCtor: typeof AudioContext | null = null;

function getSharedContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext || sharedAudioContextCtor !== Ctor) {
    sharedAudioContext = new Ctor();
    sharedAudioContextCtor = Ctor;
  }
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

export function resetAchievementChimeContext(): void {
  sharedAudioContext?.close?.();
  sharedAudioContext = null;
  sharedAudioContextCtor = null;
}

export function playAchievementChime(enabled: boolean): boolean {
  if (!enabled) return false;
  try {
    const ctx = getSharedContext();
    if (!ctx) return false;
    for (const note of CHIME_NOTES) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const startAt = ctx.currentTime + note.offsetSeconds;
      const stopAt = startAt + note.durationSeconds;
      oscillator.type = 'triangle';
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0.12, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(stopAt);
    }
    return true;
  } catch {
    return false;
  }
}

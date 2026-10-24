import { afterEach, describe, expect, it, mock } from 'bun:test';
import {
  playAchievementChime,
  resetAchievementChimeContext,
} from './achievementChime';

describe('playAchievementChime', () => {
  const originalAudioContext = window.AudioContext;

  afterEach(() => {
    resetAchievementChimeContext();
    window.AudioContext = originalAudioContext;
  });

  it('does not play when sounds are disabled', () => {
    const startMock = mock(() => {});
    window.AudioContext = class {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator() {
        return {
          type: 'sine',
          frequency: { value: 0 },
          connect: () => {},
          start: startMock,
          stop: () => {},
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
          },
          connect: () => {},
        };
      }
      resume() {
        return Promise.resolve();
      }
    } as unknown as typeof AudioContext;

    expect(playAchievementChime(false)).toBe(false);
    expect(startMock).not.toHaveBeenCalled();
  });

  it('synthesizes the celebratory two-note chime and reuses a single AudioContext across plays', () => {
    let constructCount = 0;
    const startMock = mock(() => {});
    window.AudioContext = class {
      state = 'running';
      currentTime = 0;
      destination = {};
      constructor() {
        constructCount += 1;
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { value: 0 },
          connect: () => {},
          start: startMock,
          stop: () => {},
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
          },
          connect: () => {},
        };
      }
      resume() {
        return Promise.resolve();
      }
    } as unknown as typeof AudioContext;

    expect(playAchievementChime(true)).toBe(true);
    expect(playAchievementChime(true)).toBe(true);
    expect(constructCount).toBe(1);
    expect(startMock).toHaveBeenCalledTimes(4);
  });
});

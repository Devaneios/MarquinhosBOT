import '@/i18n';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'bun:test';
import {
  CONNECTING_SCRIPTS,
  INITIAL_STATE,
  frameMs,
  next,
  type AnimationState,
} from '../connectingTimeline';
import { WordleConnectingAnimation } from './WordleConnectingAnimation';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function playScript(start: AnimationState) {
  const frames = [start];
  let state = start;
  while (state.phase !== 'clearing') {
    state = next(state);
    frames.push(state);
  }
  return { frames, after: next(state) };
}

describe('WordleConnectingAnimation timeline', () => {
  it('types, reveals and solves every script, then moves to the next', () => {
    let state = INITIAL_STATE;
    for (const [index, script] of CONNECTING_SCRIPTS.entries()) {
      const { frames, after } = playScript(state);
      const solved = frames.find((frame) => frame.phase === 'solved');
      expect(script.guesses[solved!.row]).toBe(script.answer);
      expect(frames.filter((f) => f.phase === 'revealing')).toHaveLength(
        script.guesses.length,
      );
      expect(after).toEqual({
        ...INITIAL_STATE,
        script: (index + 1) % CONNECTING_SCRIPTS.length,
      });
      state = after;
    }
    expect(state).toEqual(INITIAL_STATE);
  });

  it('gives every frame a positive duration', () => {
    const { frames } = playScript(INITIAL_STATE);
    for (const frame of frames)
      expect(frameMs(frame, () => 0)).toBeGreaterThan(0);
  });
});

describe('WordleConnectingAnimation', () => {
  it('shows the solved board without motion when reduced motion is requested', () => {
    window.matchMedia = (query: string) =>
      ({
        matches: query === '(prefers-reduced-motion: reduce)',
      }) as MediaQueryList;
    const { container } = render(<WordleConnectingAnimation />);
    const letters = Array.from(container.querySelectorAll('.termo-tile'))
      .map((tile) => tile.textContent)
      .join('');
    expect(letters).toBe(CONNECTING_SCRIPTS[0].guesses.join('').toUpperCase());
  });

  it('starts from an empty board with the first cell active', () => {
    window.matchMedia = () => ({ matches: false }) as MediaQueryList;
    const { container } = render(<WordleConnectingAnimation />);
    const tiles = container.querySelectorAll('.termo-tile');
    expect(tiles).toHaveLength(20);
    expect([...tiles].every((tile) => tile.textContent === '')).toBe(true);
    expect(tiles[0].className).toContain('ring-marquinhos-accent');
  });
});

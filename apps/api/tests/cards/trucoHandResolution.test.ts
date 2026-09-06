import { describe, expect, it } from 'bun:test';
import {
  decisiveWinner,
  resolveHandWinner,
} from 'services/activity/cards/rulesets/truco/handResolution';

describe('decisiveWinner', () => {
  it('returns null until a team has 2 non-tied trick wins', () => {
    expect(decisiveWinner(['A'])).toBeNull();
    expect(decisiveWinner(['A', 'tie'])).toBeNull();
    expect(decisiveWinner(['A', 'B'])).toBeNull();
  });

  it('returns the team once it has 2 non-tied wins', () => {
    expect(decisiveWinner(['A', 'A'])).toBe('A');
    expect(decisiveWinner(['B', 'tie', 'B'])).toBe('B');
  });
});

describe('resolveHandWinner', () => {
  it('awards the hand to whichever team wins 2 tricks outright', () => {
    expect(resolveHandWinner(['A', 'A'], 'A')).toBe('A');
    expect(resolveHandWinner(['A', 'B', 'B'], 'A')).toBe('B');
  });

  it('carries the first trick when the rest tie', () => {
    expect(resolveHandWinner(['A', 'tie', 'tie'], 'B')).toBe('A');
  });

  it('falls to the second trick winner when the first tied', () => {
    expect(resolveHandWinner(['tie', 'B', 'tie'], 'A')).toBe('B');
  });

  it('falls to the third trick winner when the first two tied', () => {
    expect(resolveHandWinner(['tie', 'tie', 'A'], 'B')).toBe('A');
  });

  it('falls back to the lead team when every trick ties', () => {
    expect(resolveHandWinner(['tie', 'tie', 'tie'], 'B')).toBe('B');
  });
});

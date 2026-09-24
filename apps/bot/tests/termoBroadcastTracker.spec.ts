import { describe, expect, it } from 'bun:test';
import { TermoBroadcastTracker } from '../src/lib/termoBroadcastTracker';

describe('TermoBroadcastTracker', () => {
  it('has news when a day has more winners than its last broadcast', () => {
    const tracker = new TermoBroadcastTracker();
    tracker.record('g1', { wordDate: '2026-09-23', winnersCount: 2 });

    expect(
      tracker.hasNews('g1', { wordDate: '2026-09-23', winnersCount: 2 }),
    ).toBe(false);
    expect(
      tracker.hasNews('g1', { wordDate: '2026-09-23', winnersCount: 3 }),
    ).toBe(true);
  });

  it("counts a new day's winners from zero", () => {
    const tracker = new TermoBroadcastTracker();
    tracker.record('g1', { wordDate: '2026-09-23', winnersCount: 5 });

    expect(
      tracker.hasNews('g1', { wordDate: '2026-09-24', winnersCount: 1 }),
    ).toBe(true);
  });
});

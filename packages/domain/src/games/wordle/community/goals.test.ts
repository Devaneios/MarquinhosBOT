import { describe, expect, it } from 'bun:test';
import { finalizeGoal, goalProgress, goalStateAt } from './goals';

describe('community goals', () => {
  const goal = {
    id: 'goal',
    guildId: 'a',
    target: 2,
    startsAt: 100,
    endsAt: 200,
    status: 'scheduled' as const,
  };
  it('transitions to active and finalizing at the fixed boundaries', () => {
    expect(goalStateAt(goal, 99)).toBe('scheduled');
    expect(goalStateAt(goal, 100)).toBe('active');
    expect(goalStateAt(goal, 200)).toBe('finalizing');
  });
  it('counts distinct players per day with accepted attempts and local presence', () => {
    const events = [
      {
        guildId: 'a',
        userId: 'one',
        date: '2026-10-01',
        occurredAt: 100,
        attempts: 1,
        present: true,
      },
      {
        guildId: 'a',
        userId: 'one',
        date: '2026-10-01',
        occurredAt: 101,
        attempts: 3,
        present: true,
      },
      {
        guildId: 'a',
        userId: 'two',
        date: '2026-10-01',
        occurredAt: 199,
        attempts: 0,
        present: true,
      },
      {
        guildId: 'a',
        userId: 'one',
        date: '2026-10-02',
        occurredAt: 199,
        attempts: 1,
        present: true,
      },
      {
        guildId: 'b',
        userId: 'three',
        date: '2026-10-01',
        occurredAt: 150,
        attempts: 1,
        present: true,
      },
      {
        guildId: 'a',
        userId: 'four',
        date: '2026-10-01',
        occurredAt: 200,
        attempts: 1,
        present: true,
      },
      {
        guildId: 'a',
        userId: 'five',
        date: '2026-10-01',
        occurredAt: 150,
        attempts: 1,
        present: false,
      },
    ];
    const progress = goalProgress(goal, events);
    expect(progress).toEqual({ count: 2, contributors: ['one'] });
    expect(finalizeGoal(goal, progress, 199)).toBe('active');
    expect(finalizeGoal(goal, progress, 200)).toBe('completed');
    expect(finalizeGoal(goal, { count: 1, contributors: ['one'] }, 200)).toBe(
      'expired',
    );
  });
});

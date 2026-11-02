import { describe, expect, it } from 'bun:test';
import { prepareGlobalWordleReconciliation } from '../src/services/wordle/globalReconciliation';

describe('prepareGlobalWordleReconciliation', () => {
  it('consolidates equivalent histories deterministically while preserving origins', () => {
    const input = {
      days: [
        { guildId: 'b', date: '2026-01-01', answer: 'termo' },
        { guildId: 'a', date: '2026-01-01', answer: 'termo' },
      ],
      sessions: [
        {
          id: 's2',
          userId: 'u',
          guildId: 'b',
          date: '2026-01-01',
          guesses: '["teste"]',
          solved: false,
          attempts: 1,
          createdAt: 20,
        },
        {
          id: 's1',
          userId: 'u',
          guildId: 'a',
          date: '2026-01-01',
          guesses: '[ "teste" ]',
          solved: false,
          attempts: 1,
          createdAt: 10,
        },
      ],
    };
    const result = prepareGlobalWordleReconciliation(input);
    expect(result.conflicts).toEqual([]);
    expect(result.days).toEqual([
      { date: '2026-01-01', answer: 'termo', origins: ['a', 'b'] },
    ]);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.sourceIds).toEqual(['s1', 's2']);
    expect(result.sessions[0]?.canonicalId).toBe('s1');
    expect(
      prepareGlobalWordleReconciliation({
        days: input.days.toReversed(),
        sessions: input.sessions.toReversed(),
      }),
    ).toEqual(result);
  });

  it('reports conflicting words or sessions and never emits partial data', () => {
    const result = prepareGlobalWordleReconciliation({
      days: [
        { guildId: 'a', date: '2026-01-01', answer: 'termo' },
        { guildId: 'b', date: '2026-01-01', answer: 'barco' },
      ],
      sessions: [
        {
          id: 's1',
          userId: 'u',
          guildId: 'a',
          date: '2026-01-01',
          guesses: '[]',
          solved: false,
          attempts: 0,
          createdAt: 10,
        },
        {
          id: 's2',
          userId: 'u',
          guildId: 'b',
          date: '2026-01-01',
          guesses: '["teste"]',
          solved: false,
          attempts: 1,
          createdAt: 20,
        },
      ],
    });
    expect(result.days).toEqual([]);
    expect(result.sessions).toEqual([]);
    expect(result.conflicts).toEqual([
      'conflicting_days:1',
      'conflicting_sessions:1',
    ]);
    expect(JSON.stringify(result)).not.toContain('termo');
    expect(JSON.stringify(result)).not.toContain('"u"');
  });

  it('refuses malformed guesses and legacy days without an answer', () => {
    const result = prepareGlobalWordleReconciliation({
      days: [{ guildId: 'a', date: '2026-01-01', answer: null }],
      sessions: [
        {
          id: 's',
          userId: 'u',
          guildId: 'a',
          date: '2026-01-01',
          guesses: '{',
          solved: false,
          attempts: 1,
          createdAt: 1,
        },
      ],
    });
    expect(result.days).toEqual([]);
    expect(result.conflicts).toEqual([
      'missing_answers:1',
      'invalid_sessions:1',
    ]);
  });

  it('refuses a legacy origin with no answer even if another server has one', () => {
    const result = prepareGlobalWordleReconciliation({
      days: [
        { guildId: 'a', date: '2026-01-01', answer: 'termo' },
        { guildId: 'b', date: '2026-01-01', answer: null },
      ],
      sessions: [],
    });
    expect(result.conflicts).toEqual(['missing_answers:1']);
    expect(result.days).toEqual([]);
  });
});

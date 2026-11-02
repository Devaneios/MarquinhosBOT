import { describe, expect, it } from 'bun:test';
import { auditGlobalWordleHistory } from '../src/services/wordle/globalAudit';

describe('auditGlobalWordleHistory', () => {
  it('counts duplicate days and conflicts without returning player data', () => {
    const report = auditGlobalWordleHistory({
      days: [
        { guildId: 'a', date: '2026-01-01', answer: 'carta' },
        { guildId: 'b', date: '2026-01-01', answer: 'carta' },
        { guildId: 'c', date: '2026-01-01', answer: 'barco' },
      ],
      sessions: [
        { userId: 'u1', guildId: 'a', date: '2026-01-01', guesses: '[]' },
        { userId: 'u1', guildId: 'b', date: '2026-01-01', guesses: '[]' },
        { userId: 'u2', guildId: 'c', date: '2026-01-01', guesses: '[]' },
      ],
    });

    expect(report.daysWithMultipleAnswers).toBe(1);
    expect(report.playersWithMultipleSessions).toBe(1);
    expect(report.duplicateSessionGroups).toBe(1);
    expect(JSON.stringify(report)).not.toContain('u1');
    expect(JSON.stringify(report)).not.toContain('carta');
  });

  it('distinguishes identical sessions from divergent guesses', () => {
    const report = auditGlobalWordleHistory({
      days: [],
      sessions: [
        { userId: 'u', guildId: 'a', date: '2026-01-01', guesses: '["a"]' },
        { userId: 'u', guildId: 'b', date: '2026-01-01', guesses: '["a"]' },
        { userId: 'v', guildId: 'a', date: '2026-01-01', guesses: '["b"]' },
        { userId: 'v', guildId: 'b', date: '2026-01-01', guesses: '["c"]' },
      ],
    });

    expect(report.identicalSessionGroups).toBe(1);
    expect(report.divergentSessionGroups).toBe(1);
  });

  it('counts conflicting drafts without exposing their contents', () => {
    const report = auditGlobalWordleHistory({
      days: [],
      sessions: [],
      drafts: [
        { userId: 'u', guildId: 'a', date: '2026-01-01', state: 'draft-a' },
        { userId: 'u', guildId: 'b', date: '2026-01-01', state: 'draft-b' },
      ],
    });

    expect(report.duplicateDraftGroups).toBe(1);
    expect(report.divergentDraftGroups).toBe(1);
    expect(JSON.stringify(report)).not.toContain('draft-a');
  });
});

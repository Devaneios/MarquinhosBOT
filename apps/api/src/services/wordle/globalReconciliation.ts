/** A read-only preflight. Source rows remain authoritative until migration. */
export interface LegacyDay {
  guildId: string;
  date: string;
  answer: string | null;
}

export interface LegacySession {
  id: string;
  userId: string;
  guildId: string;
  date: string;
  guesses: string;
  solved: boolean;
  attempts: number;
  createdAt: number;
}

interface ReconciledDay {
  date: string;
  answer: string;
  origins: string[];
}

interface ReconciledSession {
  canonicalId: string;
  sourceIds: string[];
}

export interface ReconciliationPreview {
  conflicts: string[];
  days: ReconciledDay[];
  sessions: ReconciledSession[];
}

export function prepareGlobalWordleReconciliation(input: {
  days: readonly LegacyDay[];
  sessions: readonly LegacySession[];
}): ReconciliationPreview {
  const dayGroups = new Map<string, LegacyDay[]>();
  for (const row of input.days) {
    const group = dayGroups.get(row.date) ?? [];
    group.push(row);
    dayGroups.set(row.date, group);
  }
  let conflictingDays = 0;
  let missingAnswers = 0;
  const days: ReconciledDay[] = [];
  for (const [date, rows] of [...dayGroups].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const answers = new Set(
      rows
        .map((row) => row.answer)
        .filter((answer): answer is string => answer !== null),
    );
    if (answers.size > 1) conflictingDays++;
    if (rows.some((row) => row.answer === null)) missingAnswers++;
    const answer = answers.values().next().value;
    if (answers.size === 1 && answer !== undefined) {
      days.push({
        date,
        answer,
        origins: [...new Set(rows.map((row) => row.guildId))].sort(),
      });
    }
  }

  const groups = new Map<string, LegacySession[]>();
  for (const row of input.sessions) {
    const key = JSON.stringify([row.userId, row.date]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  let invalidSessions = 0;
  let conflictingSessions = 0;
  const sessions: ReconciledSession[] = [];
  for (const [, rows] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const fingerprints = new Set<string>();
    let invalid = false;
    for (const row of rows) {
      try {
        const guesses: unknown = JSON.parse(row.guesses);
        if (!Array.isArray(guesses) || !dayGroups.has(row.date))
          throw new Error('invalid session');
        fingerprints.add(JSON.stringify([guesses, row.solved, row.attempts]));
      } catch {
        invalid = true;
      }
    }
    if (invalid) invalidSessions++;
    if (fingerprints.size > 1) conflictingSessions++;
    const sorted = [...rows].sort(
      (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
    );
    const first = sorted[0];
    if (first && !invalid && fingerprints.size === 1) {
      sessions.push({
        canonicalId: first.id,
        sourceIds: sorted.map((row) => row.id),
      });
    }
  }
  const conflicts = [
    conflictingDays && `conflicting_days:${conflictingDays}`,
    missingAnswers && `missing_answers:${missingAnswers}`,
    invalidSessions && `invalid_sessions:${invalidSessions}`,
    conflictingSessions && `conflicting_sessions:${conflictingSessions}`,
  ].filter((value): value is string => typeof value === 'string');
  return conflicts.length
    ? { conflicts, days: [], sessions: [] }
    : { conflicts, days, sessions };
}

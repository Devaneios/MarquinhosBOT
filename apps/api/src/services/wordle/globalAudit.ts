export interface GlobalWordleDayRow {
  guildId: string;
  date: string;
  answer: string | null;
}

export interface GlobalWordleSessionRow {
  userId: string;
  guildId: string;
  date: string;
  guesses: string;
  state?: string;
}

export interface GlobalWordleDraftRow {
  userId: string;
  guildId: string;
  date: string;
  state: string;
}

export interface GlobalWordleAuditInput {
  days: readonly GlobalWordleDayRow[];
  sessions: readonly GlobalWordleSessionRow[];
  drafts?: readonly GlobalWordleDraftRow[];
  achievementKeys?: readonly string[];
  discoveryKeys?: readonly string[];
  experienceByPlayer?: readonly { userId: string; totalXp: number }[];
}

export interface GlobalWordleAuditReport {
  dayRows: number;
  uniqueDates: number;
  daysWithMultipleAnswers: number;
  sessionRows: number;
  playersWithMultipleSessions: number;
  duplicateSessionGroups: number;
  identicalSessionGroups: number;
  divergentSessionGroups: number;
  duplicateDraftGroups: number;
  divergentDraftGroups: number;
  duplicateAchievementGroups: number;
  duplicateDiscoveryGroups: number;
  playersWithDifferentServerExperience: number;
}

function countDuplicateKeys(keys: readonly string[] | undefined): number {
  const counts = new Map<string, number>();
  for (const key of keys ?? []) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.values()].filter((count) => count > 1).length;
}

export function auditGlobalWordleHistory(
  input: GlobalWordleAuditInput,
): GlobalWordleAuditReport {
  const answersByDate = new Map<string, Set<string>>();
  for (const day of input.days) {
    if (day.answer === null) continue;
    const answers = answersByDate.get(day.date) ?? new Set<string>();
    answers.add(day.answer);
    answersByDate.set(day.date, answers);
  }

  const sessionsByPlayerDate = new Map<string, GlobalWordleSessionRow[]>();
  for (const session of input.sessions) {
    const key = `${session.userId}\u0000${session.date}`;
    const group = sessionsByPlayerDate.get(key) ?? [];
    group.push(session);
    sessionsByPlayerDate.set(key, group);
  }

  let duplicateSessionGroups = 0;
  let identicalSessionGroups = 0;
  let divergentSessionGroups = 0;
  for (const group of sessionsByPlayerDate.values()) {
    if (group.length < 2) continue;
    duplicateSessionGroups++;
    if (
      new Set(group.map((session) => session.state ?? session.guesses)).size ===
      1
    ) {
      identicalSessionGroups++;
    } else {
      divergentSessionGroups++;
    }
  }

  const draftsByPlayerDate = new Map<string, string[]>();
  for (const draft of input.drafts ?? []) {
    const key = `${draft.userId}\u0000${draft.date}`;
    const states = draftsByPlayerDate.get(key) ?? [];
    states.push(draft.state);
    draftsByPlayerDate.set(key, states);
  }
  const duplicateDraftGroups = [...draftsByPlayerDate.values()].filter(
    (states) => states.length > 1,
  ).length;

  const experienceByPlayer = new Map<string, Set<number>>();
  for (const row of input.experienceByPlayer ?? []) {
    const totals = experienceByPlayer.get(row.userId) ?? new Set<number>();
    totals.add(row.totalXp);
    experienceByPlayer.set(row.userId, totals);
  }

  return {
    dayRows: input.days.length,
    uniqueDates: answersByDate.size,
    daysWithMultipleAnswers: [...answersByDate.values()].filter(
      (answers) => answers.size > 1,
    ).length,
    sessionRows: input.sessions.length,
    playersWithMultipleSessions: duplicateSessionGroups,
    duplicateSessionGroups,
    identicalSessionGroups,
    divergentSessionGroups,
    duplicateDraftGroups,
    divergentDraftGroups: [...draftsByPlayerDate.values()].filter(
      (states) => states.length > 1 && new Set(states).size > 1,
    ).length,
    duplicateAchievementGroups: countDuplicateKeys(input.achievementKeys),
    duplicateDiscoveryGroups: countDuplicateKeys(input.discoveryKeys),
    playersWithDifferentServerExperience: [
      ...experienceByPlayer.values(),
    ].filter((totals) => totals.size > 1).length,
  };
}

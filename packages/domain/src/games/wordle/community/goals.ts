export type GoalStatus =
  'scheduled' | 'active' | 'finalizing' | 'completed' | 'expired';
export type CommunityGoal = {
  id: string;
  guildId: string;
  target: number;
  startsAt: number;
  endsAt: number;
  status: GoalStatus;
};
export type GoalEvent = {
  guildId: string;
  userId: string;
  date: string;
  occurredAt: number;
  attempts: number;
  present: boolean;
};
export type GoalProgress = { count: number; contributors: string[] };

export function goalStateAt(goal: CommunityGoal, now: number): GoalStatus {
  if (goal.status === 'completed' || goal.status === 'expired')
    return goal.status;
  if (now < goal.startsAt) return 'scheduled';
  return now < goal.endsAt ? 'active' : 'finalizing';
}

export function goalProgress(
  goal: CommunityGoal,
  events: readonly GoalEvent[],
): GoalProgress {
  const facts = new Set<string>();
  const contributors = new Set<string>();
  for (const event of events) {
    if (
      event.guildId !== goal.guildId ||
      event.occurredAt < goal.startsAt ||
      event.occurredAt >= goal.endsAt ||
      event.attempts < 1 ||
      !event.present
    )
      continue;
    facts.add(JSON.stringify([event.userId, event.date]));
    contributors.add(event.userId);
  }
  return { count: facts.size, contributors: [...contributors].sort() };
}

/** Call only after reconciling all accepted facts through the end of the goal. */
export function finalizeGoal(
  goal: CommunityGoal,
  progress: GoalProgress,
  now: number,
): GoalStatus {
  const status = goalStateAt(goal, now);
  if (status !== 'finalizing') return status;
  return progress.count >= goal.target ? 'completed' : 'expired';
}

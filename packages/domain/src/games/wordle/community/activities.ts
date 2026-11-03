export type PatternChallenge = {
  guildId: string;
  patternId: string;
  opensAt: number;
  closesAt: number;
};

export type GalleryOccurrence = {
  id: string;
  userId: string;
  guildId: string;
  family: string;
  date: string;
  sourceAt: number | null;
  present: boolean;
};
export function galleryEntries<T extends GalleryOccurrence>(
  guildId: string,
  today: string,
  startsAt: number,
  endsAt: number,
  occurrences: readonly T[],
): T[] {
  const eligible = occurrences.filter(
    (item) =>
      item.guildId === guildId &&
      item.present &&
      item.date < today &&
      item.sourceAt !== null &&
      item.sourceAt >= startsAt &&
      item.sourceAt < endsAt,
  );
  eligible.sort(
    (a, b) =>
      a.family.localeCompare(b.family, 'en') ||
      a.sourceAt! - b.sourceAt! ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const selected = new Map<string, T>();
  for (const item of eligible)
    if (!selected.has(item.userId)) selected.set(item.userId, item);
  return [...selected.values()].sort((a, b) =>
    a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0,
  );
}
export type ChallengeJoin = { userId: string; joinedAt: number };
export type ChallengeOccurrence = {
  userId: string;
  guildId: string;
  patternId: string;
  sourceAt: number | null;
  present: boolean;
};

export function challengeParticipants(
  challenge: PatternChallenge,
  joins: readonly ChallengeJoin[],
  occurrences: readonly ChallengeOccurrence[],
): string[] {
  const joined = new Set(
    joins
      .filter(
        (join) =>
          join.joinedAt >= challenge.opensAt &&
          join.joinedAt < challenge.closesAt,
      )
      .map((join) => join.userId),
  );
  return [
    ...new Set(
      occurrences
        .filter(
          (occurrence) =>
            occurrence.guildId === challenge.guildId &&
            occurrence.patternId === challenge.patternId &&
            occurrence.sourceAt !== null &&
            occurrence.sourceAt >= challenge.opensAt &&
            occurrence.sourceAt < challenge.closesAt &&
            occurrence.present &&
            joined.has(occurrence.userId),
        )
        .map((occurrence) => occurrence.userId),
    ),
  ].sort();
}

export type BingoCondition =
  | { kind: 'participation'; target: number }
  | { kind: 'pattern'; family: string; target: number };
export type BingoCard = {
  guildId: string;
  version: number;
  startsAt: number;
  endsAt: number;
  allowMulti: boolean;
  cells: readonly { id: string; condition: BingoCondition }[];
};
export type BingoEvent = {
  id: string;
  actionId?: string;
  guildId: string;
  userId: string;
  occurredAt: number;
} & ({ kind: 'participation' } | { kind: 'pattern'; family: string });

export function bingoProgress(card: BingoCard, events: readonly BingoEvent[]) {
  if (
    card.cells.length !== 9 ||
    new Set(card.cells.map((cell) => cell.id)).size !== 9 ||
    card.cells.some(
      (cell) =>
        !Number.isSafeInteger(cell.condition.target) ||
        cell.condition.target < 1,
    )
  )
    throw new Error('Invalid bingo card');
  const counts = Array<number>(9).fill(0);
  const seen = new Set<string>();
  const assignedActions = new Set<string>();
  const sorted = [...events].sort(
    (a, b) =>
      a.occurredAt - b.occurredAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const event of sorted) {
    if (
      seen.has(event.id) ||
      (!card.allowMulti && assignedActions.has(event.actionId ?? event.id)) ||
      event.guildId !== card.guildId ||
      event.occurredAt < card.startsAt ||
      event.occurredAt >= card.endsAt
    )
      continue;
    seen.add(event.id);
    for (const [index, cell] of card.cells.entries()) {
      const condition = cell.condition;
      if (counts[index]! >= condition.target || condition.kind !== event.kind)
        continue;
      if (
        condition.kind === 'pattern' &&
        event.kind === 'pattern' &&
        condition.family !== event.family
      )
        continue;
      counts[index] = counts[index]! + 1;
      assignedActions.add(event.actionId ?? event.id);
      if (!card.allowMulti) break;
    }
  }
  const filled = counts.map(
    (count, index) => count >= card.cells[index]!.condition.target,
  );
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ].filter((line) => line.every((index) => filled[index]));
  return { counts, filled, lines, complete: filled.every(Boolean) };
}

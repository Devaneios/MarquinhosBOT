export type AlbumPattern = { patternId: string; family: string };
export type AlbumContribution = {
  occurrenceId: string;
  patternId: string;
  userId: string;
  occurredAt: number;
};
export type AlbumPage = AlbumPattern & {
  contributorCount: number;
  contributors: string[];
  firstContribution: AlbumContribution | null;
};

/** Contributions are already filtered by community presence at the boundary. */
export function buildAlbumPages(
  catalog: readonly AlbumPattern[],
  contributions: readonly AlbumContribution[],
): AlbumPage[] {
  const byPattern = new Map<string, AlbumContribution[]>();
  const seen = new Set<string>();
  for (const contribution of contributions) {
    if (seen.has(contribution.occurrenceId)) continue;
    seen.add(contribution.occurrenceId);
    const rows = byPattern.get(contribution.patternId) ?? [];
    rows.push(contribution);
    byPattern.set(contribution.patternId, rows);
  }
  return catalog.map((pattern) => {
    const rows = byPattern.get(pattern.patternId) ?? [];
    rows.sort(
      (a, b) =>
        a.occurredAt - b.occurredAt ||
        (a.occurrenceId < b.occurrenceId
          ? -1
          : a.occurrenceId > b.occurrenceId
            ? 1
            : 0),
    );
    const contributors = [...new Set(rows.map((row) => row.userId))];
    return {
      ...pattern,
      contributorCount: contributors.length,
      contributors,
      firstContribution: rows[0] ?? null,
    };
  });
}

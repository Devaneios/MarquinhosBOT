const PAGE_SIZE = 10;

/** Resolves Discord membership before assigning the ten displayed positions. */
export async function collectVerifiedLeaderboard<
  T extends { userId: string },
  M,
>(
  fetchPage: (offset: number) => Promise<{ data: T[]; groupStreak: number }>,
  fetchMembers: (ids: string[]) => Promise<ReadonlyMap<string, M>>,
): Promise<{ entries: Array<{ entry: T; member: M }>; groupStreak: number }> {
  const entries: Array<{ entry: T; member: M }> = [];
  const seen = new Set<string>();
  let offset = 0;
  let groupStreak = 0;
  while (entries.length < PAGE_SIZE) {
    if (offset > 100000)
      throw new Error('Wordle leaderboard exceeds pagination limit');
    const page = await fetchPage(offset);
    if (offset === 0) groupStreak = page.groupStreak;
    if (page.data.length === 0) break;
    const members = await fetchMembers(page.data.map((entry) => entry.userId));
    for (const entry of page.data) {
      if (seen.has(entry.userId))
        throw new Error('Wordle leaderboard changed during pagination');
      seen.add(entry.userId);
      const member = members.get(entry.userId);
      if (member) entries.push({ entry, member });
      if (entries.length === PAGE_SIZE) break;
    }
    if (page.data.length < PAGE_SIZE) break;
    offset += page.data.length;
  }
  return { entries, groupStreak };
}

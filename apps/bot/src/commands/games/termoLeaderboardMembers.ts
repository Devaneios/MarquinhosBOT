const PAGE_SIZE = 10;
const MEMBER_RETRY_DELAYS_MS = [1000, 3000];

async function withRetries<R>(
  run: () => Promise<R>,
  delaysMs: readonly number[],
): Promise<R> {
  for (const delay of delaysMs) {
    try {
      return await run();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return run();
}

/**
 * Resolves Discord membership before assigning the ten displayed positions.
 * Entries are never published unverified: if Discord keeps failing after the
 * retries, this rejects.
 */
export async function collectVerifiedLeaderboard<
  T extends { userId: string },
  M,
>(
  fetchPage: (offset: number) => Promise<{ data: T[]; groupStreak: number }>,
  fetchMembers: (ids: string[]) => Promise<ReadonlyMap<string, M>>,
  retryDelaysMs: readonly number[] = MEMBER_RETRY_DELAYS_MS,
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
    const members = await withRetries(
      () => fetchMembers(page.data.map((entry) => entry.userId)),
      retryDelaysMs,
    );
    for (const entry of page.data) {
      // A live ranking can shift between pages and repeat a player; keep
      // the first (higher) position.
      if (seen.has(entry.userId)) continue;
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

import type { Db } from '@marquinhos/database/client';
import {
  wordleAlbumContributions,
  wordleAlbumMilestones,
} from '@marquinhos/database/schema';
import type { AlbumPattern } from '@marquinhos/domain/games/wordle/community/album';
import { reconcileAlbumMilestone } from '@marquinhos/domain/games/wordle/community/albumMilestones';
import { eq, sql } from 'drizzle-orm';

export class WordleAlbumMilestoneService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async reconcile(guildId: string, catalog: readonly AlbumPattern[]) {
    return this.database.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-album-milestones', guildId])}, 0))`,
      );
      const contributions = await tx
        .select({ patternId: wordleAlbumContributions.pattern_id })
        .from(wordleAlbumContributions)
        .where(eq(wordleAlbumContributions.guild_id, guildId));
      const contributed = new Set(contributions.map((row) => row.patternId));
      const stored = await tx
        .select()
        .from(wordleAlbumMilestones)
        .where(eq(wordleAlbumMilestones.guild_id, guildId));
      const families = new Set([
        ...catalog.map((pattern) => pattern.family),
        ...stored.map((row) => row.family),
      ]);
      const result = [];
      for (const family of [...families].sort()) {
        const row = stored.find((item) => item.family === family);
        const existing = row
          ? {
              patternIds: row.pattern_ids,
              completedAt: row.completed_at,
              revisedAt: row.revised_at,
              status: row.status,
            }
          : null;
        const ids = catalog
          .filter((pattern) => pattern.family === family)
          .map((pattern) => pattern.patternId)
          .sort();
        const milestone = reconcileAlbumMilestone(
          existing,
          ids,
          contributed,
          this.now(),
        );
        if (!milestone) continue;
        if (!existing || milestone !== existing) {
          await tx
            .insert(wordleAlbumMilestones)
            .values({
              guild_id: guildId,
              family,
              pattern_ids: milestone.patternIds,
              completed_at: milestone.completedAt,
              revised_at: milestone.revisedAt,
              status: milestone.status,
            })
            .onConflictDoUpdate({
              target: [
                wordleAlbumMilestones.guild_id,
                wordleAlbumMilestones.family,
              ],
              set: {
                revised_at: milestone.revisedAt,
                status: milestone.status,
              },
            });
        }
        result.push({ family, ...milestone });
      }
      return result;
    });
  }
}

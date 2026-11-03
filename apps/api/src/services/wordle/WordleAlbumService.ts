import type { Db } from '@marquinhos/database/client';
import { wordleAlbumContributions } from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import type { AlbumContribution } from '@marquinhos/domain/games/wordle/community/album';
import { buildAlbumPages } from '@marquinhos/domain/games/wordle/community/album';
import { eq, sql } from 'drizzle-orm';
import { WordleAlbumMilestoneService } from './WordleAlbumMilestoneService';

export class WordleAlbumService {
  constructor(private readonly database: Db) {}

  async reconcile(guildId?: string): Promise<void> {
    await this.database.execute(sql`
      INSERT INTO wordle_album_contributions (guild_id, user_id, word_date, pattern_id, occurred_at)
      SELECT p.guild_id, o.user_id, o.word_date, o.pattern_id, o.occurred_at
      FROM wordle_global_occurrences o
      INNER JOIN wordle_community_daily_presence p ON p.user_id = o.user_id AND p.word_date = o.word_date
      ${guildId === undefined ? sql`` : sql`WHERE p.guild_id = ${guildId}`}
      ON CONFLICT (guild_id, user_id, word_date, pattern_id)
      DO UPDATE SET occurred_at = EXCLUDED.occurred_at
      WHERE wordle_album_contributions.occurred_at IS DISTINCT FROM EXCLUDED.occurred_at
    `);
  }

  async contributions(guildId: string): Promise<AlbumContribution[]> {
    const rows = await this.database
      .select()
      .from(wordleAlbumContributions)
      .where(eq(wordleAlbumContributions.guild_id, guildId));
    return rows.map((row) => ({
      occurrenceId: JSON.stringify([
        row.user_id,
        row.word_date,
        row.pattern_id,
      ]),
      patternId: row.pattern_id,
      userId: row.user_id,
      occurredAt: row.occurred_at,
    }));
  }

  async pages(guildId: string) {
    await this.reconcile(guildId);
    const definitions = WORDLE_ACHIEVEMENT_CATALOG.flatMap((definition) =>
      definition.kind === 'drawing' && !definition.hidden
        ? [
            {
              patternId: definition.drawing.patternId,
              family: definition.family,
              name: definition.name,
              icon: definition.icon,
              mask: [...definition.drawing.mask],
            },
          ]
        : [],
    );
    const projected = buildAlbumPages(
      definitions,
      await this.contributions(guildId),
    );
    const milestones = await new WordleAlbumMilestoneService(
      this.database,
    ).reconcile(guildId, definitions);
    return projected.map((page, index) => ({
      ...page,
      name: definitions[index]!.name,
      icon: definitions[index]!.icon,
      mask: definitions[index]!.mask,
      familyMilestone:
        milestones.find((milestone) => milestone.family === page.family) ??
        null,
    }));
  }
}

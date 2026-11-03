import type { Db } from '@marquinhos/database/client';
import {
  wordleAlbumContributions,
  wordleAlbumPages,
  wordleCommunityDailyPresence,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import type {
  AlbumContribution,
  AlbumPage,
} from '@marquinhos/domain/games/wordle/community/album';
import { buildAlbumPages } from '@marquinhos/domain/games/wordle/community/album';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { WordleAlbumMilestoneService } from './WordleAlbumMilestoneService';
import { WordleNotificationService } from './WordleNotificationService';
import { getWordleDayEndEpoch } from './wordleDate';

export class WordleAlbumService {
  constructor(private readonly database: Db) {}

  async reconcile(guildId?: string): Promise<void> {
    await this.database.execute(sql`
      INSERT INTO wordle_album_contributions (guild_id, user_id, word_date, pattern_id, occurred_at)
      SELECT p.guild_id, o.user_id, o.word_date, o.pattern_id,
        -- When the guess was played, not when achievements were evaluated:
        -- the guess's accept time, else the (seconds) solve time for draft
        -- wins and imported history, else the evaluation time.
        coalesce(o.source_at, s.solved_at * 1000, o.occurred_at)
      FROM wordle_global_occurrences o
      INNER JOIN wordle_community_daily_presence p ON p.user_id = o.user_id AND p.word_date = o.word_date
      LEFT JOIN wordle_global_sessions s ON s.id = o.session_id
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

  async reconcileUser(userId: string): Promise<void> {
    const guilds = await this.database
      .selectDistinct({ guildId: wordleCommunityDailyPresence.guild_id })
      .from(wordleCommunityDailyPresence)
      .where(eq(wordleCommunityDailyPresence.user_id, userId));
    for (const { guildId } of guilds) await this.pages(guildId);
  }

  private async recordPages(
    guildId: string,
    pages: AlbumPage[],
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-album-pages', guildId])}, 0))`,
      );
      for (const page of pages) {
        if (!page.firstContribution) continue;
        const [sourceRow] = await tx
          .select({ patternId: wordleAlbumContributions.pattern_id })
          .from(wordleAlbumContributions)
          .where(
            and(
              eq(wordleAlbumContributions.guild_id, guildId),
              eq(wordleAlbumContributions.pattern_id, page.patternId),
            ),
          )
          .limit(1)
          .for('update');
        if (!sourceRow) continue;
        const inserted = await tx
          .insert(wordleAlbumPages)
          .values({
            guild_id: guildId,
            pattern_id: page.patternId,
            first_recorded_at: page.firstContribution.occurredAt,
          })
          .onConflictDoNothing()
          .returning({ patternId: wordleAlbumPages.pattern_id });
        if (!inserted.length) continue;
        const source = z
          .tuple([z.string(), z.iso.date(), z.string()])
          .safeParse(JSON.parse(page.firstContribution.occurrenceId));
        if (!source.success) continue;
        const eligibleAt = (getWordleDayEndEpoch(source.data[1]) + 1) * 1000;
        await new WordleNotificationService(this.database).enqueueWithin(
          tx,
          guildId,
          'page',
          `page:${page.patternId}`,
          { patternId: page.patternId },
          eligibleAt,
        );
      }
    });
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
    await this.recordPages(guildId, projected);
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

import { NestFactory } from '@nestjs/core';
import type { Db } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  userLevels,
  wordleDays,
  wordleDrafts,
  wordlePatternDiscoveries,
  wordleSessions,
} from '@marquinhos/database/schema';
import { eq, inArray } from 'drizzle-orm';
import { DB } from '../src/database/database.tokens';
import { ScriptsModule } from '../src/scripts/scripts.module';
import { auditGlobalWordleHistory } from '../src/modules/wordle/services/global-audit';

async function main() {
  const app = await NestFactory.createApplicationContext(ScriptsModule, {
    logger: false,
  });
  try {
    const database = app.get<Db>(DB);
    const [days, sessions, drafts, wordleAchievementRows] = await Promise.all([
      database.select().from(wordleDays),
      database.select().from(wordleSessions),
      database.select().from(wordleDrafts),
      database
        .select({ id: achievements.id })
        .from(achievements)
        .where(eq(achievements.category, 'wordle')),
    ]);
    const achievementIds = wordleAchievementRows.map((row) => row.id);
    const [earned, discoveries, levels] = await Promise.all([
      achievementIds.length
        ? database
            .select({
              user_id: userAchievements.user_id,
              achievement_id: userAchievements.achievement_id,
            })
            .from(userAchievements)
            .where(inArray(userAchievements.achievement_id, achievementIds))
        : Promise.resolve([]),
      database
        .select({
          user_id: wordlePatternDiscoveries.user_id,
          pattern_id: wordlePatternDiscoveries.pattern_id,
        })
        .from(wordlePatternDiscoveries),
      database
        .select({ user_id: userLevels.user_id, total_xp: userLevels.total_xp })
        .from(userLevels),
    ]);

    const report = auditGlobalWordleHistory({
      days: days.map((row) => ({
        guildId: row.guild_id,
        date: row.word_date,
        answer: row.word,
      })),
      sessions: sessions.map((row) => ({
        userId: row.user_id,
        guildId: row.guild_id,
        date: row.word_date,
        guesses: row.guesses,
        state: JSON.stringify({
          guesses: row.guesses,
          solved: row.solved,
          solvedFromDraft: row.solved_from_draft,
          attempts: row.attempts,
          solvedAt: row.solved_at,
        }),
      })),
      drafts: drafts.map((row) => ({
        userId: row.user_id,
        guildId: row.guild_id,
        date: row.word_date,
        state: JSON.stringify({
          rowIndex: row.row_index,
          cells: row.cells,
          activeIndex: row.active_index,
          revision: row.revision,
          finalizedAt: row.finalized_at,
          awardReconciledAt: row.award_reconciled_at,
        }),
      })),
      achievementKeys: earned.map(
        (row) => `${row.user_id}\u0000${row.achievement_id}`,
      ),
      discoveryKeys: discoveries.map(
        (row) => `${row.user_id}\u0000${row.pattern_id}`,
      ),
      experienceByPlayer: levels.map((row) => ({
        userId: row.user_id,
        totalXp: row.total_xp,
      })),
    });

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await app.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Wordle audit failed',
    );
    process.exitCode = 1;
  });
}

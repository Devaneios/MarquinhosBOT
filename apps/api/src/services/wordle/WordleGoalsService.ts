import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityGoals,
  wordleGlobalAcceptedGuesses,
} from '@marquinhos/database/schema';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export class WordleGoalsService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async create(
    guildId: string,
    target: number,
    startsAt: number,
    endsAt: number,
  ) {
    const now = this.now();
    if (
      !guildId ||
      !Number.isSafeInteger(target) ||
      target <= 0 ||
      !Number.isSafeInteger(startsAt) ||
      !Number.isSafeInteger(endsAt) ||
      startsAt <= now ||
      startsAt >= endsAt
    )
      throw new Error('Invalid community goal');
    const [row] = await this.database
      .insert(wordleCommunityGoals)
      .values({
        id: randomUUID(),
        guild_id: guildId,
        target,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'scheduled',
        created_at: now,
      })
      .returning();
    return this.map(row!);
  }

  async list(guildId: string) {
    const rows = await this.database
      .select()
      .from(wordleCommunityGoals)
      .where(eq(wordleCommunityGoals.guild_id, guildId))
      .orderBy(
        asc(wordleCommunityGoals.starts_at),
        asc(wordleCommunityGoals.id),
      );
    return rows.map((row) => this.map(row));
  }

  async progress(
    goalId: string,
    guildId: string,
  ): Promise<{ count: number; contributors: string[] }> {
    const [goal] = await this.database
      .select()
      .from(wordleCommunityGoals)
      .where(
        and(
          eq(wordleCommunityGoals.id, goalId),
          eq(wordleCommunityGoals.guild_id, guildId),
        ),
      );
    if (!goal) throw new Error('Goal not found');
    const facts = await this.database
      .selectDistinct({
        userId: wordleGlobalAcceptedGuesses.user_id,
        date: wordleGlobalAcceptedGuesses.word_date,
      })
      .from(wordleGlobalAcceptedGuesses)
      .innerJoin(
        wordleCommunityDailyPresence,
        and(
          eq(
            wordleCommunityDailyPresence.user_id,
            wordleGlobalAcceptedGuesses.user_id,
          ),
          eq(
            wordleCommunityDailyPresence.word_date,
            wordleGlobalAcceptedGuesses.word_date,
          ),
        ),
      )
      .where(
        and(
          eq(wordleCommunityDailyPresence.guild_id, guildId),
          gte(wordleGlobalAcceptedGuesses.accepted_at, goal.starts_at),
          lt(wordleGlobalAcceptedGuesses.accepted_at, goal.ends_at),
          lt(wordleCommunityDailyPresence.recorded_at_ms, goal.ends_at),
        ),
      );
    return {
      count: facts.length,
      contributors: [...new Set(facts.map((fact) => fact.userId))].sort(),
    };
  }

  private map(row: typeof wordleCommunityGoals.$inferSelect) {
    return {
      id: row.id,
      guildId: row.guild_id,
      target: row.target,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
    };
  }
}

import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityGoals,
  wordleGlobalAcceptedGuesses,
  wordleGoalAwards,
  wordleGoalContributions,
  wordleGoalDecorations,
} from '@marquinhos/database/schema';
import { goalStateAt } from '@marquinhos/domain/games/wordle/community/goals';
import { and, asc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { logger } from 'utils/logger';
import { lockGoalFactsForClosing } from './goalFactLock';

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
    return rows.map((row) => {
      const goal = this.map(row);
      return { ...goal, status: goalStateAt(goal, this.now()) };
    });
  }

  async processDue(): Promise<number> {
    const due = await this.database
      .select({
        id: wordleCommunityGoals.id,
        guildId: wordleCommunityGoals.guild_id,
      })
      .from(wordleCommunityGoals)
      .where(
        and(
          lte(wordleCommunityGoals.ends_at, this.now()),
          inArray(wordleCommunityGoals.status, [
            'scheduled',
            'active',
            'finalizing',
          ]),
        ),
      )
      .orderBy(asc(wordleCommunityGoals.ends_at), asc(wordleCommunityGoals.id));
    let processed = 0;
    for (const goal of due) {
      try {
        await this.close(goal.id, goal.guildId);
        processed++;
      } catch {
        logger.warn('wordle.goal.reconciliation_failed');
      }
    }
    return processed;
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
    if (goal.status === 'completed' || goal.status === 'expired') {
      const facts = await this.database
        .select({ userId: wordleGoalContributions.user_id })
        .from(wordleGoalContributions)
        .where(eq(wordleGoalContributions.goal_id, goalId));
      return {
        count: facts.length,
        contributors: [...new Set(facts.map((fact) => fact.userId))].sort(),
      };
    }
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

  async close(goalId: string, guildId: string) {
    return this.database.transaction(async (tx) => {
      await lockGoalFactsForClosing(tx);
      const [goal] = await tx
        .select()
        .from(wordleCommunityGoals)
        .where(
          and(
            eq(wordleCommunityGoals.id, goalId),
            eq(wordleCommunityGoals.guild_id, guildId),
          ),
        )
        .for('update');
      if (!goal) throw new Error('Goal not found');
      if (goal.status === 'completed' || goal.status === 'expired')
        return this.map(goal);
      const now = this.now();
      if (now < goal.ends_at) throw new Error('Goal is still active');
      await tx
        .update(wordleCommunityGoals)
        .set({ status: 'finalizing' })
        .where(eq(wordleCommunityGoals.id, goalId));
      await tx.execute(sql`
        INSERT INTO wordle_goal_contributions (goal_id, guild_id, user_id, word_date, session_id, attempt)
        SELECT DISTINCT ON (e.user_id, e.word_date) ${goalId}, p.guild_id, e.user_id, e.word_date, e.session_id, e.attempt
        FROM wordle_global_accepted_guesses e
        INNER JOIN wordle_community_daily_presence p ON p.user_id = e.user_id AND p.word_date = e.word_date
        WHERE p.guild_id = ${guildId} AND p.recorded_at_ms < ${goal.ends_at}
          AND e.accepted_at >= ${goal.starts_at} AND e.accepted_at < ${goal.ends_at}
        ORDER BY e.user_id, e.word_date, e.accepted_at, e.session_id, e.attempt
        ON CONFLICT (goal_id, user_id, word_date) DO NOTHING
      `);
      const contributions = await tx
        .select({ userId: wordleGoalContributions.user_id })
        .from(wordleGoalContributions)
        .where(eq(wordleGoalContributions.goal_id, goalId));
      const completed = contributions.length >= goal.target;
      if (completed) {
        const users = [...new Set(contributions.map((row) => row.userId))];
        if (users.length)
          await tx
            .insert(wordleGoalAwards)
            .values(
              users.map((userId) => ({
                goal_id: goalId,
                user_id: userId,
                granted_at: now,
              })),
            )
            .onConflictDoNothing();
        await tx
          .insert(wordleGoalDecorations)
          .values({ goal_id: goalId, guild_id: guildId, granted_at: now })
          .onConflictDoNothing();
      }
      const [updated] = await tx
        .update(wordleCommunityGoals)
        .set({ status: completed ? 'completed' : 'expired' })
        .where(eq(wordleCommunityGoals.id, goalId))
        .returning();
      return this.map(updated!);
    });
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

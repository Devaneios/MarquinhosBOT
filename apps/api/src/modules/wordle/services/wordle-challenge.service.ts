import type { Db } from '@marquinhos/database/client';
import {
  wordleChallengeJoins,
  wordleCommunityDailyPresence,
  wordleGlobalAchievements,
  wordleGlobalOccurrences,
  wordlePatternChallenges,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { challengeParticipants } from '@marquinhos/domain/games/wordle/community/activities';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { and, asc, desc, eq, gt, gte, lt, or, sql } from 'drizzle-orm';
import { WORDLE_NOW } from 'modules/wordle/wordle.tokens';
import { randomUUID } from 'node:crypto';

const DAY_MS = 86_400_000;
const MAX_CHALLENGE_DURATION_MS = 30 * DAY_MS;
const MAX_MEMBER_CHALLENGES_PER_DAY = 3;
const MAX_OPEN_COMMUNITY_CHALLENGES = 20;
const CHALLENGE_LIST_LIMIT = 25;

export class InvalidWordleChallenge extends Error {}
@Injectable()
export class WordleChallengeService {
  constructor(
    @Inject(DB) private readonly database: Db,
    @Inject(WORDLE_NOW)
    private readonly now: () => number = Date.now,
  ) {}

  async create(
    guildId: string,
    userId: string,
    patternId: string,
    closesAt: number,
  ) {
    const definition = WORDLE_ACHIEVEMENT_CATALOG.find(
      (entry) =>
        entry.kind === 'drawing' && entry.drawing.patternId === patternId,
    );
    const now = this.now();
    if (
      !guildId ||
      !userId ||
      !definition ||
      !Number.isSafeInteger(closesAt) ||
      closesAt <= now ||
      closesAt > now + MAX_CHALLENGE_DURATION_MS
    )
      throw new InvalidWordleChallenge('Invalid challenge');
    const row = await this.database.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-challenges', guildId])}, 0))`,
      );
      const [owned] = await tx
        .select()
        .from(wordleGlobalAchievements)
        .where(
          and(
            eq(wordleGlobalAchievements.user_id, userId),
            eq(wordleGlobalAchievements.achievement_id, definition.id),
          ),
        )
        .for('update');
      if (!owned) throw new InvalidWordleChallenge('Pattern not unlocked');
      const open = gt(wordlePatternChallenges.closes_at, now);
      const recentByMember = and(
        eq(wordlePatternChallenges.creator_user_id, userId),
        gt(wordlePatternChallenges.opens_at, now - DAY_MS),
      );
      const [counts] = await tx
        .select({
          open: sql<number>`count(*) filter (where ${open})::int`,
          recentByMember: sql<number>`count(*) filter (where ${recentByMember})::int`,
        })
        .from(wordlePatternChallenges)
        .where(
          and(
            eq(wordlePatternChallenges.guild_id, guildId),
            or(open, recentByMember),
          ),
        );
      if (
        counts &&
        (counts.open >= MAX_OPEN_COMMUNITY_CHALLENGES ||
          counts.recentByMember >= MAX_MEMBER_CHALLENGES_PER_DAY)
      )
        throw new InvalidWordleChallenge('Challenge creation limit reached');
      const [created] = await tx
        .insert(wordlePatternChallenges)
        .values({
          id: randomUUID(),
          guild_id: guildId,
          creator_user_id: userId,
          pattern_id: patternId,
          opens_at: now,
          closes_at: closesAt,
        })
        .returning();
      await tx
        .insert(wordleChallengeJoins)
        .values({ challenge_id: created!.id, user_id: userId, joined_at: now });
      return created!;
    });
    return this.get(row.id, guildId, userId);
  }

  async join(id: string, guildId: string, userId: string): Promise<void> {
    await this.database.transaction(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(wordlePatternChallenges)
        .where(
          and(
            eq(wordlePatternChallenges.id, id),
            eq(wordlePatternChallenges.guild_id, guildId),
          ),
        )
        .for('update');
      const now = this.now();
      if (!challenge || now < challenge.opens_at || now >= challenge.closes_at)
        throw new InvalidWordleChallenge('Challenge closed or missing');
      await tx
        .insert(wordleChallengeJoins)
        .values({ challenge_id: id, user_id: userId, joined_at: now })
        .onConflictDoNothing();
    });
  }

  async get(id: string, guildId: string, viewerId?: string) {
    const [challenge] = await this.database
      .select()
      .from(wordlePatternChallenges)
      .where(
        and(
          eq(wordlePatternChallenges.id, id),
          eq(wordlePatternChallenges.guild_id, guildId),
        ),
      );
    if (!challenge) throw new InvalidWordleChallenge('Challenge not found');
    return this.details(challenge, viewerId);
  }

  private async details(
    challenge: typeof wordlePatternChallenges.$inferSelect,
    viewerId?: string,
  ) {
    const guildId = challenge.guild_id;
    const joins = await this.database
      .select()
      .from(wordleChallengeJoins)
      .where(eq(wordleChallengeJoins.challenge_id, challenge.id));
    const occurrences = await this.database
      .select({
        userId: wordleGlobalOccurrences.user_id,
        patternId: wordleGlobalOccurrences.pattern_id,
        sourceAt: wordleGlobalOccurrences.source_at,
      })
      .from(wordleGlobalOccurrences)
      .innerJoin(
        wordleCommunityDailyPresence,
        and(
          eq(
            wordleCommunityDailyPresence.user_id,
            wordleGlobalOccurrences.user_id,
          ),
          eq(
            wordleCommunityDailyPresence.word_date,
            wordleGlobalOccurrences.word_date,
          ),
        ),
      )
      .where(
        and(
          eq(wordleCommunityDailyPresence.guild_id, guildId),
          eq(wordleGlobalOccurrences.pattern_id, challenge.pattern_id),
          lt(wordleCommunityDailyPresence.recorded_at_ms, challenge.closes_at),
          gte(wordleGlobalOccurrences.source_at, challenge.opens_at),
          lt(wordleGlobalOccurrences.source_at, challenge.closes_at),
        ),
      );
    const participants = challengeParticipants(
      {
        guildId,
        patternId: challenge.pattern_id,
        opensAt: challenge.opens_at,
        closesAt: challenge.closes_at,
      },
      joins.map((join) => ({ userId: join.user_id, joinedAt: join.joined_at })),
      occurrences.map((item) => ({ ...item, guildId, present: true })),
    );
    return {
      id: challenge.id,
      guildId,
      creatorId: challenge.creator_user_id,
      patternId: challenge.pattern_id,
      opensAt: challenge.opens_at,
      closesAt: challenge.closes_at,
      status:
        this.now() >= challenge.closes_at
          ? ('closed' as const)
          : ('open' as const),
      participants,
      joined:
        viewerId !== undefined &&
        joins.some((join) => join.user_id === viewerId),
    };
  }

  async list(guildId: string, viewerId?: string) {
    const rows = await this.database
      .select()
      .from(wordlePatternChallenges)
      .where(eq(wordlePatternChallenges.guild_id, guildId))
      .orderBy(
        desc(gt(wordlePatternChallenges.closes_at, this.now())),
        desc(wordlePatternChallenges.opens_at),
        asc(wordlePatternChallenges.id),
      )
      .limit(CHALLENGE_LIST_LIMIT);
    return Promise.all(rows.map((row) => this.details(row, viewerId)));
  }
}

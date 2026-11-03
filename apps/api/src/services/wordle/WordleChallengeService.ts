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
import { and, asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export class InvalidWordleChallenge extends Error {}
export class WordleChallengeService {
  constructor(
    private readonly database: Db,
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
      closesAt <= now
    )
      throw new InvalidWordleChallenge('Invalid challenge');
    const row = await this.database.transaction(async (tx) => {
      const [owned] = await tx
        .select()
        .from(wordleGlobalAchievements)
        .where(
          and(
            eq(wordleGlobalAchievements.user_id, userId),
            eq(wordleGlobalAchievements.achievement_id, definition.id),
          ),
        );
      if (!owned) throw new InvalidWordleChallenge('Pattern not unlocked');
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
    return this.get(row.id, guildId);
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

  async get(id: string, guildId: string) {
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
    const joins = await this.database
      .select()
      .from(wordleChallengeJoins)
      .where(eq(wordleChallengeJoins.challenge_id, id));
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
    };
  }

  async list(guildId: string) {
    const rows = await this.database
      .select({ id: wordlePatternChallenges.id })
      .from(wordlePatternChallenges)
      .where(eq(wordlePatternChallenges.guild_id, guildId))
      .orderBy(asc(wordlePatternChallenges.opens_at));
    return Promise.all(rows.map((row) => this.get(row.id, guildId)));
  }
}

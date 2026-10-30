import {
  guessRowSchema,
  wordleAchievementsOverviewSchema,
  wordlePatternEvidenceSchema,
  type WordleAchievementUpdate,
  type WordleAchievementsOverview,
  type WordlePatternEvidence,
} from '@marquinhos/contracts/wordle';
import { db, type DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  wordleDays,
  wordlePatternDiscoveries,
  wordleSessions,
  wordleStreaks,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import {
  analyzeWordleAchievements,
  type WordleAchievementEvaluation,
} from '@marquinhos/domain/games/wordle/achievements/engine/evaluate';
import type { AchievementHistoryDay } from '@marquinhos/domain/games/wordle/achievements/engine/history';
import { computeWordlePlayerStats } from '@marquinhos/domain/games/wordle/playerStats';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';
import { getRecifeDate, getWordleTimeZone } from 'services/wordle/wordleDate';
import { z } from 'zod';

const backfillOptionsSchema = z.object({
  guildId: z.string().min(1).optional(),
  batchSize: z.number().int().min(1).max(1000).default(100),
});

function readGuesses(serialized: string) {
  try {
    const parsed = z.array(guessRowSchema).safeParse(JSON.parse(serialized));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

type HistoryDay = AchievementHistoryDay & { sessionId: string };
type AwardResult = WordleAchievementUpdate;

export class WordleAchievementService {
  private readonly awards = new AchievementService(new LevelingService());

  private async loadHistory(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ) {
    const history = await exec
      .select({
        session: wordleSessions,
        word: wordleDays.word,
        width: wordleDays.word_length,
      })
      .from(wordleSessions)
      .leftJoin(
        wordleDays,
        and(
          eq(wordleDays.guild_id, wordleSessions.guild_id),
          eq(wordleDays.word_date, wordleSessions.word_date),
        ),
      )
      .where(
        and(
          eq(wordleSessions.user_id, userId),
          eq(wordleSessions.guild_id, guildId),
          or(
            gt(wordleSessions.attempts, 0),
            eq(wordleSessions.solved_from_draft, true),
          ),
        ),
      )
      .orderBy(asc(wordleSessions.word_date));
    const solvedDates = history
      .filter(({ session }) => session.solved && session.solved_at !== null)
      .map(({ session }) => session.word_date);
    const firstSolvers =
      solvedDates.length === 0
        ? []
        : await exec
            .selectDistinctOn([wordleSessions.word_date], {
              date: wordleSessions.word_date,
              id: wordleSessions.id,
            })
            .from(wordleSessions)
            .where(
              and(
                eq(wordleSessions.guild_id, guildId),
                inArray(wordleSessions.word_date, solvedDates),
                eq(wordleSessions.solved, true),
                isNotNull(wordleSessions.solved_at),
                or(
                  gt(wordleSessions.attempts, 0),
                  eq(wordleSessions.solved_from_draft, true),
                ),
                or(
                  eq(wordleSessions.first_solver, true),
                  isNull(wordleSessions.first_solver),
                ),
              ),
            )
            .orderBy(
              asc(wordleSessions.word_date),
              desc(sql`coalesce(${wordleSessions.first_solver}, false)`),
              asc(wordleSessions.solved_at),
              asc(wordleSessions.id),
            );
    const firstIds = new Set(firstSolvers.map((row) => row.id));
    const [saved] = await exec
      .select()
      .from(wordleStreaks)
      .where(
        and(
          eq(wordleStreaks.user_id, userId),
          eq(wordleStreaks.guild_id, guildId),
        ),
      );
    const days: HistoryDay[] = history.map(({ session: row, word, width }) => {
      const normalized = word === null ? null : stripDiacritics(word);
      return {
        sessionId: row.id,
        date: row.word_date,
        solved: row.solved,
        solvedFromDraft: row.solved_from_draft,
        attempts: row.attempts,
        guesses: readGuesses(row.guesses),
        wordLength: width,
        answerHasRepeatedLetters:
          normalized === null
            ? null
            : new Set(normalized).size < normalized.length,
        answerHasAccent: word === null ? null : word !== normalized,
        startedAt: row.created_at,
        solvedAt: row.solved ? row.solved_at : null,
        firstSolverInGuild: row.solved && firstIds.has(row.id),
      };
    });
    return {
      days,
      options: {
        today: getRecifeDate(),
        timeZone: getWordleTimeZone(),
        persistedBestStreak: Math.max(
          saved?.current_streak ?? 0,
          saved?.max_streak ?? 0,
        ),
      },
    };
  }

  private loadUnlocks(userId: string, guildId: string, exec: DbExecutor) {
    return exec
      .select({
        id: userAchievements.achievement_id,
        at: userAchievements.unlocked_at,
      })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(achievements.id, userAchievements.achievement_id),
      )
      .where(
        and(
          eq(userAchievements.user_id, userId),
          eq(userAchievements.guild_id, guildId),
          eq(achievements.category, 'wordle'),
        ),
      );
  }

  private async loadDiscoveries(
    userId: string,
    guildId: string,
    exec: DbExecutor,
  ) {
    const rows = await exec
      .select()
      .from(wordlePatternDiscoveries)
      .where(
        and(
          eq(wordlePatternDiscoveries.user_id, userId),
          eq(wordlePatternDiscoveries.guild_id, guildId),
        ),
      );
    const evidence = new Map<string, WordlePatternEvidence>();
    for (const row of rows) {
      const parsed = wordlePatternEvidenceSchema.safeParse(row.evidence);
      if (parsed.success) evidence.set(row.pattern_id, parsed.data);
    }
    return evidence;
  }

  private async holderPercentages(guildId: string, exec: DbExecutor) {
    const [total] = await exec
      .select({ players: countDistinct(wordleSessions.user_id) })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.guild_id, guildId),
          or(
            gt(wordleSessions.attempts, 0),
            eq(wordleSessions.solved_from_draft, true),
          ),
        ),
      );
    const percentages = new Map<string, number>();
    if (!total?.players) return { percentages, hasPlayers: false };
    const holders = await exec
      .select({
        id: userAchievements.achievement_id,
        holders: countDistinct(userAchievements.user_id),
      })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(achievements.id, userAchievements.achievement_id),
      )
      .where(
        and(
          eq(userAchievements.guild_id, guildId),
          eq(achievements.category, 'wordle'),
          sql`EXISTS (
        SELECT 1 FROM ${wordleSessions}
        WHERE ${wordleSessions.user_id} = ${userAchievements.user_id}
          AND ${wordleSessions.guild_id} = ${userAchievements.guild_id}
          AND (${wordleSessions.attempts} > 0 OR ${wordleSessions.solved_from_draft})
      )`,
        ),
      )
      .groupBy(userAchievements.achievement_id);
    for (const row of holders)
      percentages.set(
        row.id,
        Math.round((row.holders / total.players) * 10000) / 100,
      );
    return { percentages, hasPlayers: true };
  }

  private async snapshot(
    guildId: string,
    history: Awaited<ReturnType<WordleAchievementService['loadHistory']>>,
    evidence: Map<string, WordlePatternEvidence>,
    evaluations: readonly WordleAchievementEvaluation[],
    unlocks: ReadonlyMap<string, number>,
    exec: DbExecutor,
  ) {
    const progress = new Map(evaluations.map((row) => [row.id, row.progress]));
    const { percentages, hasPlayers } = await this.holderPercentages(
      guildId,
      exec,
    );
    const collection = WORDLE_ACHIEVEMENT_CATALOG.map((definition) => {
      const at = unlocks.get(definition.id);
      const concealed = definition.hidden && at === undefined;
      const drawing =
        definition.kind === 'drawing' ? definition.drawing : undefined;
      return {
        id: definition.id,
        family: definition.family,
        tier: definition.tier,
        hidden: definition.hidden,
        name: concealed ? '' : definition.name,
        description: concealed ? '' : definition.description,
        icon: concealed ? '❔' : definition.icon,
        rarity: definition.rarity,
        rewardXp: definition.rewardXp,
        unlockedAt: at === undefined ? null : new Date(at).toISOString(),
        progress: concealed ? null : (progress.get(definition.id) ?? null),
        holdersPercent: hasPlayers
          ? (percentages.get(definition.id) ?? 0)
          : null,
        ...(drawing && !concealed
          ? {
              patternPreview: {
                patternId: drawing.patternId,
                mask: drawing.mask,
                variants: drawing.variants,
                colors: drawing.colors,
                rotations: drawing.rotations,
              },
              matchEvidence:
                at === undefined
                  ? null
                  : (evidence.get(drawing.patternId) ?? null),
            }
          : {}),
      };
    });
    return wordleAchievementsOverviewSchema.parse({
      achievements: collection,
      stats: computeWordlePlayerStats(history.days, history.options),
    });
  }

  async getOverview(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ): Promise<WordleAchievementsOverview> {
    if (exec === db)
      return db.transaction((tx) => this.getOverview(userId, guildId, tx));
    const history = await this.loadHistory(userId, guildId, exec);
    const evidence = await this.loadDiscoveries(userId, guildId, exec);
    const analysis = analyzeWordleAchievements(history.days, history.options);
    const evaluations = analysis.evaluate(new Set(evidence.keys()));
    const unlocks = new Map(
      (await this.loadUnlocks(userId, guildId, exec)).map((row) => [
        row.id,
        row.at,
      ]),
    );
    return this.snapshot(
      guildId,
      history,
      evidence,
      evaluations,
      unlocks,
      exec,
    );
  }

  async checkAndAward(
    userId: string,
    guildId: string,
    exec: DbExecutor,
  ): Promise<AwardResult> {
    await exec.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-achievements', userId, guildId])}, 0))`,
    );
    const history = await this.loadHistory(userId, guildId, exec);
    const existingEvidence = await this.loadDiscoveries(userId, guildId, exec);
    const analysis = analyzeWordleAchievements(history.days, history.options);
    const discoveries = analysis.discoverPatterns(
      new Set(existingEvidence.keys()),
    );
    const sessionIdsByDate = new Map(
      history.days
        .filter((day) => day.attempts > 0 && day.date <= history.options.today)
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((day) => [day.date, day.sessionId]),
    );
    if (discoveries.length > 0) {
      const discoveryRows = discoveries.map((evidence) => {
        const sessionId = sessionIdsByDate.get(evidence.date);
        if (sessionId === undefined)
          throw new Error(
            `Wordle pattern evidence has no source session for ${evidence.date}`,
          );
        return { evidence, sessionId };
      });
      await exec
        .insert(wordlePatternDiscoveries)
        .values(
          discoveryRows.map(({ evidence, sessionId }) => ({
            user_id: userId,
            guild_id: guildId,
            pattern_id: evidence.patternId,
            session_id: sessionId,
            discovered_at: Date.now(),
            evidence: wordlePatternEvidenceSchema.parse(evidence),
          })),
        )
        .onConflictDoNothing();
    }
    const evidence = await this.loadDiscoveries(userId, guildId, exec);
    const unlocks = new Map(
      (await this.loadUnlocks(userId, guildId, exec)).map((row) => [
        row.id,
        row.at,
      ]),
    );
    const evaluations = analysis.evaluate(new Set(evidence.keys()));
    const newlyUnlocked = await this.awards.unlockAchievements(
      userId,
      guildId,
      evaluations.filter((evaluation) => evaluation.met).map(({ id }) => id),
      exec,
    );
    for (const row of newlyUnlocked) {
      unlocks.set(row.id, row.unlockedAt);
    }
    const overview = await this.snapshot(
      guildId,
      history,
      evidence,
      evaluations,
      unlocks,
      exec,
    );
    return {
      overview,
      unlockedIds: newlyUnlocked.map(({ id }) => id),
    };
  }

  async backfill(input: z.input<typeof backfillOptionsSchema> = {}) {
    const options = backfillOptionsSchema.parse(input);
    await this.awards.initializeDefaults();
    let cursor: { guildId: string; userId: string } | undefined;
    let playersProcessed = 0,
      achievementsAwarded = 0;
    while (true) {
      const players = await db
        .selectDistinct({
          guildId: wordleSessions.guild_id,
          userId: wordleSessions.user_id,
        })
        .from(wordleSessions)
        .where(
          and(
            or(
              gt(wordleSessions.attempts, 0),
              eq(wordleSessions.solved_from_draft, true),
            ),
            options.guildId
              ? eq(wordleSessions.guild_id, options.guildId)
              : undefined,
            cursor
              ? or(
                  gt(wordleSessions.guild_id, cursor.guildId),
                  and(
                    eq(wordleSessions.guild_id, cursor.guildId),
                    gt(wordleSessions.user_id, cursor.userId),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(asc(wordleSessions.guild_id), asc(wordleSessions.user_id))
        .limit(options.batchSize);
      if (players.length === 0) break;
      for (const player of players) {
        const result = await db.transaction((tx) =>
          this.checkAndAward(player.userId, player.guildId, tx),
        );
        playersProcessed++;
        achievementsAwarded += result.unlockedIds.length;
        cursor = player;
      }
    }
    return { playersProcessed, achievementsAwarded };
  }
}

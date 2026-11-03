import { wordlePatternEvidenceSchema } from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleGlobalOccurrences,
  wordleNotificationConfig,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { galleryEntries } from '@marquinhos/domain/games/wordle/community/activities';
import { and, eq, gte, lt } from 'drizzle-orm';
import { z } from 'zod';
import {
  previousWordleWeek,
  WordleNotificationService,
} from './WordleNotificationService';
import { getWordleDayEndEpoch, getWordleTimeZone } from './wordleDate';

export class InvalidWordleGallery extends Error {}
export class WordleGalleryService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}
  async queuePreviousWeek(): Promise<number> {
    const guilds = await this.database
      .select({ guildId: wordleNotificationConfig.guild_id })
      .from(wordleNotificationConfig)
      .where(eq(wordleNotificationConfig.weekly, true));
    let queued = 0;
    for (const { guildId } of guilds) {
      const gallery = await this.previousWeek(guildId);
      if (!gallery.entries.length) continue;
      if (
        await new WordleNotificationService(this.database, this.now).enqueue(
          guildId,
          'weekly',
          `gallery:${gallery.weekKey}`,
          { gallery: '1', week: gallery.weekKey },
          this.now(),
        )
      )
        queued++;
    }
    return queued;
  }
  async previousWeek(guildId: string) {
    return this.forWeek(guildId, previousWordleWeek(this.now()).weekKey);
  }
  async forWeek(guildId: string, weekKey: string) {
    if (!z.iso.date().safeParse(weekKey).success)
      throw new InvalidWordleGallery('Invalid gallery week');
    const monday = new Date(`${weekKey}T12:00:00Z`);
    if (monday.getUTCDay() !== 1)
      throw new InvalidWordleGallery('Invalid gallery week');
    const priorSunday = new Date(monday);
    priorSunday.setUTCDate(priorSunday.getUTCDate() - 1);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const startsAt =
      (getWordleDayEndEpoch(priorSunday.toISOString().slice(0, 10)) + 1) * 1000;
    const endsAt =
      (getWordleDayEndEpoch(sunday.toISOString().slice(0, 10)) + 1) * 1000;
    const now = this.now();
    if (endsAt > now)
      throw new InvalidWordleGallery('Gallery week is still open');
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: getWordleTimeZone(),
    }).format(new Date(now));
    const rows = await this.database
      .select({ occurrence: wordleGlobalOccurrences })
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
          lt(wordleCommunityDailyPresence.recorded_at_ms, endsAt),
          gte(wordleGlobalOccurrences.source_at, startsAt),
          lt(wordleGlobalOccurrences.source_at, endsAt),
        ),
      );
    const occurrences = rows.flatMap(({ occurrence }) => {
      const item = WORDLE_ACHIEVEMENT_CATALOG.find(
        (definition) =>
          definition.kind === 'drawing' &&
          !definition.hidden &&
          definition.drawing.patternId === occurrence.pattern_id,
      );
      const evidence = wordlePatternEvidenceSchema.safeParse(
        occurrence.evidence,
      );
      if (
        !item ||
        item.kind !== 'drawing' ||
        !evidence.success ||
        evidence.data.date !== occurrence.word_date ||
        evidence.data.patternId !== occurrence.pattern_id
      )
        return [];
      return [
        {
          id: JSON.stringify([
            occurrence.user_id,
            occurrence.word_date,
            occurrence.pattern_id,
          ]),
          userId: occurrence.user_id,
          guildId,
          family: item.family,
          date: occurrence.word_date,
          sourceAt: occurrence.source_at,
          present: true,
          patternId: occurrence.pattern_id,
          name: item.name,
          evidence: evidence.data,
        },
      ];
    });
    const entries = galleryEntries(
      guildId,
      today,
      startsAt,
      endsAt,
      occurrences,
    ).map(({ userId, family, date, sourceAt, patternId, name, evidence }) => ({
      userId,
      family,
      date,
      sourceAt: sourceAt!,
      patternId,
      name,
      evidence,
    }));
    return { weekKey, entries };
  }
}

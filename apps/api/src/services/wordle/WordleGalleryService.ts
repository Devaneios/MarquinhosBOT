import { wordlePatternEvidenceSchema } from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleGlobalOccurrences,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { galleryEntries } from '@marquinhos/domain/games/wordle/community/activities';
import { and, eq, gte, lt } from 'drizzle-orm';
import { previousWordleWeek } from './WordleNotificationService';
import { getWordleTimeZone } from './wordleDate';

export class WordleGalleryService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}
  async previousWeek(guildId: string) {
    const now = this.now();
    const { weekKey, startsAt, endsAt } = previousWordleWeek(now);
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

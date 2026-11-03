import { wordlePatternEvidenceSchema } from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleBingoCards,
  wordleCommunityDailyPresence,
  wordleGlobalAcceptedGuesses,
  wordleGlobalOccurrences,
} from '@marquinhos/database/schema';
import { WORDLE_DRAWING_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import {
  bingoProgress,
  type BingoCard,
  type BingoEvent,
} from '@marquinhos/domain/games/wordle/community/activities';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getWordleDayEndEpoch } from './wordleDate';

const condition = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('participation'),
    target: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('pattern'),
    family: z.string().min(1),
    target: z.number().int().positive(),
  }),
]);
const cellsSchema = z
  .array(z.object({ id: z.string().min(1), condition }))
  .length(9);
const INITIAL_CELLS: BingoCard['cells'] = [
  { id: 'participation_1', condition: { kind: 'participation', target: 1 } },
  {
    id: 'letter_1',
    condition: { kind: 'pattern', family: 'letter', target: 1 },
  },
  { id: 'participation_3', condition: { kind: 'participation', target: 3 } },
  { id: 'digit_1', condition: { kind: 'pattern', family: 'digit', target: 1 } },
  { id: 'shape_1', condition: { kind: 'pattern', family: 'shape', target: 1 } },
  {
    id: 'tetromino_1',
    condition: { kind: 'pattern', family: 'tetromino', target: 1 },
  },
  { id: 'participation_5', condition: { kind: 'participation', target: 5 } },
  {
    id: 'letter_2',
    condition: { kind: 'pattern', family: 'letter', target: 2 },
  },
  { id: 'participation_7', condition: { kind: 'participation', target: 7 } },
];

export class InvalidWordleBingo extends Error {}
export class WordleBingoService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async create(
    guildId: string,
    startsAt: number,
    endsAt: number,
    allowMulti: boolean,
  ) {
    const now = this.now();
    if (
      !guildId ||
      !Number.isSafeInteger(startsAt) ||
      !Number.isSafeInteger(endsAt) ||
      startsAt <= now ||
      startsAt >= endsAt
    )
      throw new InvalidWordleBingo('Invalid bingo period');
    const [row] = await this.database
      .insert(wordleBingoCards)
      .values({
        id: randomUUID(),
        guild_id: guildId,
        version: 1,
        starts_at: startsAt,
        ends_at: endsAt,
        allow_multi: allowMulti,
        cells: INITIAL_CELLS,
        created_at: now,
      })
      .returning();
    return this.get(row!.id, guildId);
  }

  async createForDates(
    guildId: string,
    firstDate: string,
    lastDate: string,
    allowMulti: boolean,
  ) {
    if (
      !z.iso.date().safeParse(firstDate).success ||
      !z.iso.date().safeParse(lastDate).success ||
      firstDate > lastDate
    )
      throw new InvalidWordleBingo('Invalid bingo dates');
    const previous = new Date(`${firstDate}T12:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return this.create(
      guildId,
      (getWordleDayEndEpoch(previous.toISOString().slice(0, 10)) + 1) * 1000,
      (getWordleDayEndEpoch(lastDate) + 1) * 1000,
      allowMulti,
    );
  }

  async get(id: string, guildId: string) {
    const [row] = await this.database
      .select()
      .from(wordleBingoCards)
      .where(
        and(
          eq(wordleBingoCards.id, id),
          eq(wordleBingoCards.guild_id, guildId),
        ),
      );
    if (!row) throw new InvalidWordleBingo('Bingo not found');
    const cells = cellsSchema.parse(row.cells);
    const card: BingoCard = {
      guildId,
      version: row.version,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      allowMulti: row.allow_multi,
      cells,
    };
    const guesses = await this.database
      .select({
        sessionId: wordleGlobalAcceptedGuesses.session_id,
        userId: wordleGlobalAcceptedGuesses.user_id,
        date: wordleGlobalAcceptedGuesses.word_date,
        attempt: wordleGlobalAcceptedGuesses.attempt,
        at: wordleGlobalAcceptedGuesses.accepted_at,
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
          lt(wordleCommunityDailyPresence.recorded_at_ms, row.ends_at),
          gte(wordleGlobalAcceptedGuesses.accepted_at, row.starts_at),
          lt(wordleGlobalAcceptedGuesses.accepted_at, row.ends_at),
        ),
      )
      .orderBy(
        asc(wordleGlobalAcceptedGuesses.accepted_at),
        asc(wordleGlobalAcceptedGuesses.attempt),
      );
    const events: BingoEvent[] = [];
    const days = new Set<string>();
    const actions = new Map(
      guesses.map((guess) => [
        JSON.stringify([guess.sessionId, guess.attempt]),
        guess.at,
      ]),
    );
    for (const guess of guesses) {
      const day = JSON.stringify([guess.userId, guess.date]);
      if (days.has(day)) continue;
      days.add(day);
      events.push({
        id: `participation:${day}`,
        actionId: JSON.stringify([guess.sessionId, guess.attempt]),
        guildId,
        userId: guess.userId,
        occurredAt: guess.at,
        kind: 'participation',
      });
    }
    const occurrences = await this.database
      .select()
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
          lt(wordleCommunityDailyPresence.recorded_at_ms, row.ends_at),
          gte(wordleGlobalOccurrences.source_at, row.starts_at),
          lt(wordleGlobalOccurrences.source_at, row.ends_at),
        ),
      );
    for (const { wordle_global_occurrences: occurrence } of occurrences) {
      const pattern = WORDLE_DRAWING_CATALOG.find(
        (item) => item.patternId === occurrence.pattern_id,
      );
      const evidence = wordlePatternEvidenceSchema.safeParse(
        occurrence.evidence,
      );
      if (
        !pattern ||
        !evidence.success ||
        evidence.data.date !== occurrence.word_date ||
        evidence.data.patternId !== occurrence.pattern_id ||
        occurrence.source_at === null
      )
        continue;
      const attempt =
        Math.max(...evidence.data.cells.map(([index]) => index)) + 1;
      const actionId = JSON.stringify([occurrence.session_id, attempt]);
      if (actions.get(actionId) !== occurrence.source_at) continue;
      events.push({
        id: `pattern:${JSON.stringify([occurrence.user_id, occurrence.word_date, occurrence.pattern_id])}`,
        actionId,
        guildId,
        userId: occurrence.user_id,
        occurredAt: occurrence.source_at,
        kind: 'pattern',
        family: pattern.family,
      });
    }
    return {
      id: row.id,
      ...card,
      status:
        this.now() < row.starts_at
          ? ('scheduled' as const)
          : this.now() < row.ends_at
            ? ('active' as const)
            : ('closed' as const),
      progress: bingoProgress(card, events),
    };
  }

  async list(guildId: string) {
    const rows = await this.database
      .select({ id: wordleBingoCards.id })
      .from(wordleBingoCards)
      .where(eq(wordleBingoCards.guild_id, guildId))
      .orderBy(asc(wordleBingoCards.starts_at));
    return Promise.all(rows.map((row) => this.get(row.id, guildId)));
  }
}

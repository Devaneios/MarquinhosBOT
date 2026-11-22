import {
  achievements,
  userLevels,
  wordleGlobalAchievements,
  wordleGlobalDays,
} from '@marquinhos/database/schema';
import { createTestDb } from '@marquinhos/database/testing';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { achievementXpForRarity } from '@marquinhos/domain/games/wordle/achievements/rewards';
import { expect, it } from 'bun:test';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import witnesses from '../../../packages/domain/src/games/wordle/achievements/fixtures/legal-witnesses.json';
import { createWordleTestServices } from './helpers/wordleServices';

it('awards drawing variants through playable guesses and persists XP only once', async () => {
  const fixture = await createTestDb();
  try {
    const drawings = WORDLE_ACHIEVEMENT_CATALOG.filter(
      (entry) => entry.kind === 'drawing',
    );
    await fixture.db.insert(achievements).values(
      drawings.map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        category: 'wordle',
        rarity: entry.rarity,
        icon: entry.icon,
        condition: '{}',
        reward_xp: achievementXpForRarity(entry.rarity),
      })),
    );
    let date = '2026-01-01';
    const services = createWordleTestServices(fixture.db, {
      today: () => date,
      now: () => Date.parse(`${date}T15:00:00Z`),
    });
    for (const drawing of drawings) {
      expect(
        witnesses.some((item) => item.patternId === drawing.drawing.patternId),
        drawing.id,
      ).toBe(true);
    }
    for (const [index, witness] of witnesses.entries()) {
      const drawing = drawings.find(
        (entry) => entry.drawing.patternId === witness.patternId,
      );
      expect(drawing, witness.patternId).toBeDefined();
      if (!drawing) throw new Error(`Unknown drawing: ${witness.patternId}`);
      const label = `${drawing.id} (${witness.color}, variant ${witness.variant ?? 0})`;
      date = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
      const user = `drawing-player-${index}`;
      await fixture.db.insert(wordleGlobalDays).values({
        word_date: date,
        word: witness.answer,
        word_length: witness.answer.length,
        created_at: 1,
      });
      for (const guess of witness.guesses) {
        const result = await services.wordle.submitGuess(
          user,
          'guild',
          guess,
          false,
          randomUUID(),
          date,
        );
        expect(
          'error' in result ? result.error : null,
          `${label}: ${guess}`,
        ).toBeNull();
      }
      const earned = await fixture.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, user));
      expect(
        earned.map((row) => row.achievement_id),
        label,
      ).toContain(drawing.id);
      const expectedXp = earned.reduce(
        (sum, row) =>
          sum +
          (drawings.find((entry) => entry.id === row.achievement_id)?.rarity
            ? achievementXpForRarity(
                drawings.find((entry) => entry.id === row.achievement_id)!
                  .rarity,
              )
            : 0),
        0,
      );
      const [before] = await fixture.db
        .select()
        .from(userLevels)
        .where(eq(userLevels.user_id, user));
      expect(before?.total_xp, label).toBe(expectedXp);
      await services.globalAchievements.checkAndAward(user, 'guild');
      const [after] = await fixture.db
        .select()
        .from(userLevels)
        .where(eq(userLevels.user_id, user));
      expect(after?.total_xp, label).toBe(expectedXp);
      expect(
        await fixture.db
          .select()
          .from(wordleGlobalAchievements)
          .where(eq(wordleGlobalAchievements.user_id, user)),
      ).toHaveLength(earned.length);
    }
  } finally {
    await fixture.drop();
  }
}, 120_000);

import {
  achievements,
  userLevels,
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb } from '@marquinhos/database/testing';
import { expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createWordleTestGlobalAchievementService } from './helpers/wordleServices';

it('uses the current Wordle reward when a retained legacy definition has different XP', async () => {
  const fixture = await createTestDb();
  try {
    await fixture.db.insert(achievements).values({
      id: 'wordle_v2_solved_exactly_1',
      name: 'Legacy',
      description: 'Legacy',
      category: 'wordle',
      rarity: 'rare',
      icon: 'x',
      condition: JSON.stringify({ legacy: true }),
      reward_xp: 999,
    });
    await fixture.db.insert(wordleGlobalDays).values({
      word_date: '2026-11-01',
      word: 'termo',
      word_length: 5,
      created_at: 1,
    });
    await fixture.db.insert(wordleGlobalSessions).values({
      id: 'legacy-reward-session',
      user_id: 'player',
      word_date: '2026-11-01',
      attempts: 1,
      solved: true,
      solved_at: 2,
      created_at: 1,
      guesses: JSON.stringify([
        {
          guess: 'termo',
          feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
        },
      ]),
    });
    const service = createWordleTestGlobalAchievementService(
      () => Date.parse('2026-11-01T15:00:00Z'),
      fixture.db,
    );
    const result = await service.checkAndAward('player', 'guild');
    const [level] = await fixture.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, 'player'));
    const [retained] = await fixture.db
      .select()
      .from(achievements)
      .where(eq(achievements.id, 'wordle_v2_solved_exactly_1'));
    expect(result.unlockedIds).toContain('wordle_v2_solved_exactly_1');
    expect(level?.total_xp).toBe(150);
    expect(retained?.reward_xp).toBe(999);
  } finally {
    await fixture.drop();
  }
});

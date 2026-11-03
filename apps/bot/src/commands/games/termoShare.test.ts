import { expect, it } from 'bun:test';
import {
  buildShareButtonId,
  parseShareButtonId,
  selectShareAchievement,
} from './termoShare';

it('only permits sharing an achievement unlocked by the player', () => {
  const items = [
    { id: 'one', name: 'Primeira', unlockedAt: '2026-01-01' },
    { id: 'two', name: 'Bloqueada', unlockedAt: null },
  ];
  expect(selectShareAchievement(items, 'primeira')).toBe('one');
  expect(selectShareAchievement(items, 'two')).toBeNull();
  expect(selectShareAchievement(items, 'missing')).toBeNull();
});

it('keeps the selected destination and player bound to the confirmation', () => {
  const id = buildShareButtonId(
    '123456789012345678',
    '987654321098765432',
    'wordle_v2_pattern_staircase_inverted',
  );
  expect(id.length).toBeLessThanOrEqual(100);
  expect(parseShareButtonId(id)).toEqual({
    userId: '123456789012345678',
    channelId: '987654321098765432',
    achievementId: 'wordle_v2_pattern_staircase_inverted',
  });
  expect(parseShareButtonId('ts:bad')).toBeNull();
});

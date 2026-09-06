import { describe, expect, test } from 'bun:test';
import {
  createProgressBar,
  getBadgeForLevel,
  getColorForLevel,
} from '@marquinhos/formatters/level';

describe('createProgressBar', () => {
  test('returns 10 filled at 100%', () => {
    expect(createProgressBar(100)).toBe('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
  });

  test('returns 5 filled at 50%', () => {
    expect(createProgressBar(50)).toBe('🟩🟩🟩🟩🟩⬛⬛⬛⬛⬛');
  });

  test('returns 0 filled at 0%', () => {
    expect(createProgressBar(0)).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛');
  });
});

describe('getBadgeForLevel', () => {
  test('returns Iniciante for level 0', () => {
    expect(getBadgeForLevel(0)).toBe('🌱 Iniciante');
  });

  test('returns Aventureiro de Bronze for level 10', () => {
    expect(getBadgeForLevel(10)).toBe('🥉 Aventureiro de Bronze');
  });

  test('returns Mestre Supremo for level 50', () => {
    expect(getBadgeForLevel(50)).toBe('👑 Mestre Supremo');
  });
});

describe('getColorForLevel', () => {
  test('returns green for level 0', () => {
    expect(getColorForLevel(0)).toBe(0x2ecc71);
  });

  test('returns bronze for level 15', () => {
    expect(getColorForLevel(15)).toBe(0xcd7f32);
  });

  test('returns purple for level 50', () => {
    expect(getColorForLevel(50)).toBe(0x9b59b6);
  });
});

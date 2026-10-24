import { describe, expect, it } from 'bun:test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { distributionBarWidth } from '../compounds/termo';
import {
  buildTermoAchievementsImage,
  type TermoAchievementsCardInput,
} from './termo';

const OUT_DIR = join(import.meta.dir, '../../../test-output');

const veteran: TermoAchievementsCardInput = {
  displayName: 'Guilherme',
  unlocked: 14,
  total: 32,
  stats: {
    played: 87,
    wins: 81,
    winRate: 93,
    currentStreak: 12,
    bestStreak: 31,
    distribution: [1, 9, 27, 24, 12, 5, 3],
  },
  families: [
    { label: 'Vitórias', unlocked: 4, total: 6 },
    { label: 'Sequência', unlocked: 4, total: 6 },
    { label: 'Presença', unlocked: 2, total: 4 },
    { label: 'Precisão', unlocked: 2, total: 4 },
    { label: 'Persistência', unlocked: 0, total: 2 },
    { label: 'Velocidade', unlocked: 0, total: 2 },
    { label: 'Horário', unlocked: 1, total: 4 },
    { label: 'Estilo', unlocked: 1, total: 3 },
    { label: 'Retorno', unlocked: 0, total: 1 },
  ],
};

const newcomer: TermoAchievementsCardInput = {
  ...veteran,
  displayName: 'Um nome de exibição muito longo para caber no cartão',
  unlocked: 0,
  stats: {
    played: 0,
    wins: 0,
    winRate: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: [0, 0, 0, 0, 0, 0, 0],
  },
  families: veteran.families.map((f) => ({ ...f, unlocked: 0 })),
};

async function renderTo(name: string, input: TermoAchievementsCardInput) {
  const buffer = await buildTermoAchievementsImage(input);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), buffer);
  return sharp(buffer).metadata();
}

describe('buildTermoAchievementsImage', () => {
  it('renders a 480px wide PNG for an active player', async () => {
    const meta = await renderTo('termo-achievements-veteran.png', veteran);
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(480);
    expect(meta.height).toBeGreaterThan(400);
  });

  it('renders a player with no history without throwing', async () => {
    const meta = await renderTo('termo-achievements-newcomer.png', newcomer);
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(480);
  });
});

describe('distributionBarWidth', () => {
  it('scales bars to the busiest bucket with a visible minimum', () => {
    expect(distributionBarWidth(27, 27)).toBe(300);
    expect(distributionBarWidth(0, 27)).toBe(22);
    expect(distributionBarWidth(1, 27)).toBe(22);
    expect(distributionBarWidth(0, 0)).toBe(22);
    expect(distributionBarWidth(9, 27)).toBe(100);
  });
});

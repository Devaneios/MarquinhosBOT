import { describe, expect, it } from 'bun:test';
import {
  classify,
  pickEmoji,
  pickQuirkyLine,
  QUIRKY_LINE_POOLS,
} from '@marquinhos/services/aiChat/lexicon';

describe('classify', () => {
  it('classifies positive words as positivo', () => {
    expect(classify('que jogo incrível, adorei')).toBe('positivo');
  });

  it('classifies negative words as negativo', () => {
    expect(classify('que jogo ruim, odiei')).toBe('negativo');
  });

  it('classifies laughter as engracado', () => {
    expect(classify('kkkkkk mano que hilário')).toBe('engracado');
  });

  it('classifies neutral content as neutro', () => {
    expect(classify('vou sair pra comprar pão')).toBe('neutro');
  });

  it('is case-insensitive', () => {
    expect(classify('ISSO FOI ÓTIMO')).toBe('positivo');
  });
});

describe('pickEmoji', () => {
  it('always returns an emoji from the bucket pool', () => {
    const emoji = pickEmoji('positivo');
    expect(['😄', '🔥', '👏']).toContain(emoji);
  });
});

describe('pickQuirkyLine', () => {
  it('always returns a line from the bucket pool, including neutro', () => {
    const line = pickQuirkyLine('neutro');
    expect(QUIRKY_LINE_POOLS.neutro).toContain(line);
  });
});

import { describe, expect, it } from 'bun:test';
import {
  cardStrength,
  manilhaRank,
} from 'services/activity/cards/rulesets/truco/ranking';

describe('manilhaRank', () => {
  it('is the next rank after the vira in Truco rank order', () => {
    expect(manilhaRank('4')).toBe('5');
    expect(manilhaRank('K')).toBe('A');
  });

  it('wraps around from the strongest rank back to the weakest', () => {
    expect(manilhaRank('3')).toBe('4');
  });
});

describe('cardStrength', () => {
  it('ranks plain cards by Truco order (4 weakest ... 3 strongest)', () => {
    const manilha = manilhaRank('K'); // vira=K -> manilha rank='A'
    const four = cardStrength({ id: '1', suit: 'paus', rank: '4' }, manilha);
    const seven = cardStrength({ id: '2', suit: 'paus', rank: '7' }, manilha);
    const three = cardStrength({ id: '3', suit: 'paus', rank: '3' }, manilha);
    expect(seven).toBeGreaterThan(four);
    expect(three).toBeGreaterThan(seven);
  });

  it('gives manilha cards more strength than any plain card', () => {
    const manilha = manilhaRank('4'); // manilha rank = '5'
    const strongestPlain = cardStrength(
      { id: '1', suit: 'paus', rank: '3' },
      manilha,
    );
    const weakestManilha = cardStrength(
      { id: '2', suit: 'ouros', rank: '5' },
      manilha,
    );
    expect(weakestManilha).toBeGreaterThan(strongestPlain);
  });

  it('breaks ties between manilhas by suit strength (ouros < espadas < copas < paus)', () => {
    const manilha = manilhaRank('4');
    const ouros = cardStrength({ id: '1', suit: 'ouros', rank: '5' }, manilha);
    const espadas = cardStrength(
      { id: '2', suit: 'espadas', rank: '5' },
      manilha,
    );
    const copas = cardStrength({ id: '3', suit: 'copas', rank: '5' }, manilha);
    const paus = cardStrength({ id: '4', suit: 'paus', rank: '5' }, manilha);
    expect(espadas).toBeGreaterThan(ouros);
    expect(copas).toBeGreaterThan(espadas);
    expect(paus).toBeGreaterThan(copas);
  });

  it('treats two plain cards of the same rank (different suit) as equal strength', () => {
    const manilha = manilhaRank('4');
    const a = cardStrength({ id: '1', suit: 'paus', rank: 'K' }, manilha);
    const b = cardStrength({ id: '2', suit: 'copas', rank: 'K' }, manilha);
    expect(a).toBe(b);
  });
});

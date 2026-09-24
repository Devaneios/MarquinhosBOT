import { determineRoundWinners } from '@marquinhos/domain/games/rock-paper-scissors/bot/rockPaperScissors';
import { describe, expect, it } from 'bun:test';

describe('determineRoundWinners', () => {
  it('awards the winning choice to each player who made it', () => {
    expect(
      determineRoundWinners({ a: 'rock', b: 'scissors', c: 'rock' }),
    ).toEqual(['a', 'c']);
  });

  it('ties when all three choices appear', () => {
    expect(
      determineRoundWinners({ a: 'rock', b: 'paper', c: 'scissors' }),
    ).toEqual([]);
  });

  it('ties when everyone chooses the same option', () => {
    expect(determineRoundWinners({ a: 'paper', b: 'paper' })).toEqual([]);
  });
});

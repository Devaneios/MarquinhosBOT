import { describe, expect, it } from 'bun:test';
import {
  doubleElimination,
  roundRobin,
  swissRound,
  topFourPlayoff,
} from 'services/activity/pong/PongTournamentFormats';

const players = ['a', 'b', 'c', 'd'].map((userId, index) => ({
  userId,
  rating: 1800 - index * 100,
}));

describe('Pong tournament formats', () => {
  it('schedules every round-robin matchup exactly once', () => {
    const matches = roundRobin(players);
    const pairs = matches.map((match) =>
      [match.playerA, match.playerB].sort().join(':'),
    );

    expect(matches).toHaveLength(6);
    expect(new Set(pairs).size).toBe(6);
    expect(new Set(matches.map((match) => match.round)).size).toBe(3);
  });

  it('builds upper, lower and grand-final paths for double elimination', () => {
    const matches = doubleElimination(players);

    expect(matches.filter((match) => match.bracket === 'upper')).toHaveLength(
      3,
    );
    expect(matches.some((match) => match.bracket === 'lower')).toBe(true);
    expect(matches.at(-1)).toMatchObject({
      bracket: 'grand-final',
      sourceA: 'winner:upper:2:0',
      sourceB: 'winner:lower:2:0',
    });
  });

  it('pairs Swiss players by score while avoiding prior opponents', () => {
    const matches = swissRound(
      [
        { userId: 'a', rating: 1800, score: 2, opponents: ['b'] },
        { userId: 'b', rating: 1700, score: 2, opponents: ['a'] },
        { userId: 'c', rating: 1600, score: 1, opponents: [] },
        { userId: 'd', rating: 1500, score: 1, opponents: [] },
      ],
      3,
    );

    expect(matches[0]).toMatchObject({ playerA: 'a', playerB: 'c' });
    expect(matches[1]).toMatchObject({ playerA: 'b', playerB: 'd' });
  });

  it('seeds a top-four playoff as first-vs-fourth and second-vs-third', () => {
    expect(topFourPlayoff(players)).toMatchObject([
      { playerA: 'a', playerB: 'd' },
      { playerA: 'b', playerB: 'c' },
      { sourceA: 'winner:playoff:1:0', sourceB: 'winner:playoff:1:1' },
    ]);
  });
});

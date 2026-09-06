export interface PongTournamentPlayer {
  userId: string;
  rating: number;
  score?: number;
  opponents?: string[];
}

export interface PongTournamentPairing {
  round: number;
  position: number;
  playerA: string | null;
  playerB: string | null;
  bracket:
    'round-robin' | 'upper' | 'lower' | 'grand-final' | 'swiss' | 'playoff';
  sourceA?: string;
  sourceB?: string;
}

export function seedPlayers(
  players: PongTournamentPlayer[],
): PongTournamentPlayer[] {
  return [...players].sort(
    (a, b) => b.rating - a.rating || a.userId.localeCompare(b.userId),
  );
}

export function roundRobin(
  players: PongTournamentPlayer[],
): PongTournamentPairing[] {
  const seeded = seedPlayers(players).map((player) => player.userId);
  if (seeded.length % 2 === 1) seeded.push('');
  const rounds = seeded.length - 1;
  const pairings: PongTournamentPairing[] = [];
  for (let round = 0; round < rounds; round += 1) {
    for (let index = 0; index < seeded.length / 2; index += 1) {
      const playerA = seeded[index] || null;
      const playerB = seeded[seeded.length - 1 - index] || null;
      if (playerA && playerB) {
        pairings.push({
          round: round + 1,
          position: index,
          playerA,
          playerB,
          bracket: 'round-robin',
        });
      }
    }
    seeded.splice(1, 0, seeded.pop()!);
  }
  return pairings;
}

export function doubleElimination(
  players: PongTournamentPlayer[],
): PongTournamentPairing[] {
  const seeded = seedPlayers(players);
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, seeded.length)));
  const upperRounds = Math.log2(size);
  const pairings: PongTournamentPairing[] = [];
  for (let position = 0; position < size / 2; position += 1) {
    const leftSeed = position + 1;
    const rightSeed = size - position;
    pairings.push({
      round: 1,
      position,
      playerA: seeded[leftSeed - 1]?.userId ?? null,
      playerB: seeded[rightSeed - 1]?.userId ?? null,
      bracket: 'upper',
    });
  }
  for (let round = 2; round <= upperRounds; round += 1) {
    const count = size / 2 ** round;
    for (let position = 0; position < count; position += 1) {
      pairings.push({
        round,
        position,
        playerA: null,
        playerB: null,
        bracket: 'upper',
        sourceA: `winner:upper:${round - 1}:${position * 2}`,
        sourceB: `winner:upper:${round - 1}:${position * 2 + 1}`,
      });
    }
  }
  const lowerRounds = Math.max(1, 2 * (upperRounds - 1));
  for (let round = 1; round <= lowerRounds; round += 1) {
    const count = Math.max(1, size / 2 ** (Math.floor((round + 1) / 2) + 1));
    for (let position = 0; position < count; position += 1) {
      pairings.push({
        round,
        position,
        playerA: null,
        playerB: null,
        bracket: 'lower',
        sourceA:
          round === 1
            ? `loser:upper:1:${position * 2}`
            : round % 2 === 0
              ? `winner:lower:${round - 1}:${position}`
              : `winner:lower:${round - 1}:${position * 2}`,
        sourceB:
          round % 2 === 0
            ? `loser:upper:${round / 2 + 1}:${position}`
            : round === 1
              ? `loser:upper:1:${position * 2 + 1}`
              : `winner:lower:${round - 1}:${position * 2 + 1}`,
      });
    }
  }
  pairings.push({
    round: 1,
    position: 0,
    playerA: null,
    playerB: null,
    bracket: 'grand-final',
    sourceA: `winner:upper:${upperRounds}:0`,
    sourceB: `winner:lower:${lowerRounds}:0`,
  });
  return pairings;
}

export function swissRound(
  players: PongTournamentPlayer[],
  round: number,
): PongTournamentPairing[] {
  const remaining = [...players].sort(
    (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) ||
      b.rating - a.rating ||
      a.userId.localeCompare(b.userId),
  );
  const pairings: PongTournamentPairing[] = [];
  while (remaining.length >= 2) {
    const playerA = remaining.shift()!;
    let opponentIndex = remaining.findIndex(
      (player) => !(playerA.opponents ?? []).includes(player.userId),
    );
    if (opponentIndex < 0) opponentIndex = 0;
    const playerB = remaining.splice(opponentIndex, 1)[0]!;
    pairings.push({
      round,
      position: pairings.length,
      playerA: playerA.userId,
      playerB: playerB.userId,
      bracket: 'swiss',
    });
  }
  if (remaining.length === 1) {
    pairings.push({
      round,
      position: pairings.length,
      playerA: remaining[0]!.userId,
      playerB: null,
      bracket: 'swiss',
    });
  }
  return pairings;
}

export function topFourPlayoff(
  standings: PongTournamentPlayer[],
): PongTournamentPairing[] {
  const top = [...standings]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.rating - a.rating)
    .slice(0, 4);
  if (top.length < 4) throw new Error('Top-four playoff requires four players');
  return [
    {
      round: 1,
      position: 0,
      playerA: top[0]!.userId,
      playerB: top[3]!.userId,
      bracket: 'playoff',
    },
    {
      round: 1,
      position: 1,
      playerA: top[1]!.userId,
      playerB: top[2]!.userId,
      bracket: 'playoff',
    },
    {
      round: 2,
      position: 0,
      playerA: null,
      playerB: null,
      bracket: 'playoff',
      sourceA: 'winner:playoff:1:0',
      sourceB: 'winner:playoff:1:1',
    },
  ];
}

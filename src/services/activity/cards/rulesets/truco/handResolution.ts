export type TrickResult = 'A' | 'B' | 'tie';
export type Team = 'A' | 'B';

// A team that has already won 2 of the (up to 3) tricks outright has won
// the hand — no need to play the third trick.
export function decisiveWinner(results: TrickResult[]): Team | null {
  const counts = { A: 0, B: 0 };
  for (const r of results) if (r !== 'tie') counts[r]++;
  if (counts.A >= 2) return 'A';
  if (counts.B >= 2) return 'B';
  return null;
}

// Called once a hand has run its course (either a team reached 2 decisive
// wins, or all 3 tricks were played). Truco's tie-carry rule: a tied trick
// is "carried" by whichever trick actually decided something — the first
// trick's winner takes the hand if the rest tie, otherwise the next
// decisive trick's winner does. If every trick tied (rare), the hand goes
// to whichever team led the first trick.
export function resolveHandWinner(
  results: TrickResult[],
  leadTeam: Team,
): Team {
  const early = decisiveWinner(results);
  if (early) return early;
  for (const result of results) {
    if (result !== 'tie') return result;
  }
  return leadTeam;
}

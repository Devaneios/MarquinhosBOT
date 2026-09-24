// Deterministic PRNG (mulberry32) so a deal/shuffle can be reproduced from its
// seed alone — the seed is what a replay/anti-cheat audit trail stores instead
// of a full state snapshot.
//
// Reproducibility only holds because the other half of the contract is met:
// deckFactory derives card ids from suit/rank/copy rather than randomUUID, so
// replaying a seeded shuffle reproduces card *identity* and not merely order.
//
// The seed is owned by the engine, not by rulesets. CardTableSession issues one
// per match and hands it to GameDefinition.setup, so it can be recorded
// alongside the result; a ruleset that mints its own seed internally cannot be
// audited or replayed.
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // One place to issue seeds, so callers stop hand-rolling
  // `Date.now() ^ Math.random()` expressions of varying quality — and one
  // place to swap in a CSPRNG if seeds ever need to be unguessable by players.
  static randomSeed(): number {
    return (Math.random() * 0x1_0000_0000) >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Uniform integer in [0, exclusiveMax). Here so no ruleset re-derives
  // `Math.floor(next() * n)` — and so the n <= 0 guard exists once.
  nextInt(exclusiveMax: number): number {
    if (exclusiveMax <= 0) return 0;
    return Math.floor(this.next() * exclusiveMax);
  }

  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.nextInt(items.length)];
  }

  shuffle<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }
}

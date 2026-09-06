import type {
  ChainEnd,
  DominoesEngine,
  Tile,
} from 'services/activity/dominoesBlock/DominoesEngine';

// Sentinel seat id for the bot — never a real Discord snowflake, so it can't
// collide with an actual player and is easy to filter out of gamification
// results and state broadcasts.
export const DOMINOES_BOT_USER_ID = '__dominoes_bot__';

export class DominoesBot {
  // Prefers doubles (they're the most restrictive tiles to hold — only one
  // end value — so shedding them early keeps the bot's remaining hand
  // flexible) and otherwise picks a random legal tile/end.
  chooseMove(
    engine: DominoesEngine,
    botUserId: string,
  ): { tile: Tile; end?: ChainEnd } | null {
    const options = engine.getPlayableTiles(botUserId);
    if (options.length === 0) return null;

    const doubles = options.filter((o) => o.tile.a === o.tile.b);
    const pool = doubles.length > 0 ? doubles : options;
    const choice = pool[Math.floor(Math.random() * pool.length)]!;
    const end =
      choice.ends.length > 0
        ? choice.ends[Math.floor(Math.random() * choice.ends.length)]
        : undefined;

    return { tile: choice.tile, end };
  }
}

export interface Tile {
  a: number;
  b: number;
}

export type ChainEnd = 'left' | 'right';

export interface DominoesState {
  players: string[];
  hands: Record<string, Tile[]>;
  boneyard: Tile[];
  chain: Tile[];
  leftEnd: number | null;
  rightEnd: number | null;
  currentPlayer: string | null;
  passStreak: number;
  winner: string | null;
  winners: string[] | null;
  blocked: boolean;
  pipTotals: Record<string, number> | null;
}

export interface MoveResult {
  success: boolean;
  error?: string;
}

export interface DominoesEngineOptions {
  // Injectable for deterministic tests; production omits it and gets
  // Math.random. Only used to shuffle the deck, never to pick a winner.
  rng?: () => number;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

function buildDeck(): Tile[] {
  const deck: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) deck.push({ a, b });
  }
  return deck;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function pipTotal(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + tile.a + tile.b, 0);
}

function tileMatches(candidate: Tile, tile: Tile): boolean {
  return (
    (candidate.a === tile.a && candidate.b === tile.b) ||
    (candidate.a === tile.b && candidate.b === tile.a)
  );
}

function hasLegalMove(
  hand: Tile[],
  leftEnd: number | null,
  rightEnd: number | null,
): boolean {
  if (leftEnd === null || rightEnd === null) return hand.length > 0;
  return hand.some(
    (t) =>
      t.a === leftEnd ||
      t.b === leftEnd ||
      t.a === rightEnd ||
      t.b === rightEnd,
  );
}

// Hoyle's block-dominoes deal: two players draw 7 each, three or four draw 5
// each. With 2 players that leaves 14 tiles unused; with 4 it leaves 8. The
// leftover tiles form the boneyard, but the Block variant (as opposed to
// Draw dominoes) never draws from it — a player with no legal tile simply
// passes. The boneyard is kept on state only so a stuck game can be audited,
// never consulted by play/pass logic.
function handSizeFor(playerCount: number): number {
  return playerCount === 2 ? 7 : 5;
}

// The player holding the highest double opens, per standard block-dominoes
// rules; failing that (no double was dealt to anyone — possible once the
// deal no longer uses the whole set), whoever holds the single highest-pip
// tile opens; failing even that (empty hands, degenerate case), seat 0 opens.
function pickStartingPlayer(
  players: string[],
  hands: Record<string, Tile[]>,
): string {
  let bestDouble: { player: string; value: number } | null = null;
  let bestTile: { player: string; value: number } | null = null;

  for (const player of players) {
    for (const tile of hands[player] ?? []) {
      const value = tile.a + tile.b;
      if (tile.a === tile.b) {
        if (!bestDouble || tile.a > bestDouble.value) {
          bestDouble = { player, value: tile.a };
        }
      }
      if (!bestTile || value > bestTile.value) {
        bestTile = { player, value };
      }
    }
  }

  return bestDouble?.player ?? bestTile?.player ?? players[0]!;
}

export class DominoesEngine {
  private readonly state: DominoesState;

  constructor(players: string[], options: DominoesEngineOptions = {}) {
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
      throw new Error(
        `Dominoes requires ${MIN_PLAYERS}-${MAX_PLAYERS} players`,
      );
    }
    if (new Set(players).size !== players.length) {
      throw new Error('Duplicate player id');
    }

    const rng = options.rng ?? Math.random;
    const deck = shuffle(buildDeck(), rng);
    const handSize = handSizeFor(players.length);

    const hands: Record<string, Tile[]> = {};
    for (const player of players) hands[player] = deck.splice(0, handSize);

    this.state = {
      players: [...players],
      hands,
      boneyard: deck,
      chain: [],
      leftEnd: null,
      rightEnd: null,
      currentPlayer: pickStartingPlayer(players, hands),
      passStreak: 0,
      winner: null,
      winners: null,
      blocked: false,
      pipTotals: null,
    };
  }

  getState(): DominoesState {
    return {
      players: [...this.state.players],
      hands: Object.fromEntries(
        Object.entries(this.state.hands).map(([player, hand]) => [
          player,
          hand.map((t) => ({ ...t })),
        ]),
      ),
      boneyard: this.state.boneyard.map((t) => ({ ...t })),
      chain: this.state.chain.map((t) => ({ ...t })),
      leftEnd: this.state.leftEnd,
      rightEnd: this.state.rightEnd,
      currentPlayer: this.state.currentPlayer,
      passStreak: this.state.passStreak,
      winner: this.state.winner,
      winners: this.state.winners ? [...this.state.winners] : null,
      blocked: this.state.blocked,
      pipTotals: this.state.pipTotals ? { ...this.state.pipTotals } : null,
    };
  }

  isOver(): boolean {
    return this.state.winner !== null || this.state.blocked;
  }

  // Every tile in `hand` that could legally land on either open end right
  // now, paired with which end(s) accept it — the Room uses this to answer
  // "can this player pass?" without duplicating the matching rule, and the
  // client can use it to highlight playable tiles.
  getPlayableTiles(playerId: string): { tile: Tile; ends: ChainEnd[] }[] {
    const hand = this.state.hands[playerId] ?? [];
    if (this.state.chain.length === 0) {
      return hand.map((tile) => ({ tile, ends: [] }));
    }
    const { leftEnd, rightEnd } = this.state;
    return hand
      .map((tile) => {
        const ends: ChainEnd[] = [];
        if (tile.a === leftEnd || tile.b === leftEnd) ends.push('left');
        if (tile.a === rightEnd || tile.b === rightEnd) ends.push('right');
        return { tile, ends };
      })
      .filter((entry) => entry.ends.length > 0);
  }

  playTile(playerId: string, tile: Tile, end?: ChainEnd): MoveResult {
    if (this.isOver()) return { success: false, error: 'Game is already over' };
    if (this.state.currentPlayer !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    const hand = this.state.hands[playerId];
    if (!hand) return { success: false, error: 'Not a player in this game' };

    const idx = hand.findIndex((t) => tileMatches(t, tile));
    if (idx === -1)
      return { success: false, error: 'Tile is not in your hand' };
    const owned = hand[idx]!;

    if (this.state.chain.length === 0) {
      hand.splice(idx, 1);
      this.state.chain = [{ a: owned.a, b: owned.b }];
      this.state.leftEnd = owned.a;
      this.state.rightEnd = owned.b;
    } else {
      if (end !== 'left' && end !== 'right') {
        return { success: false, error: 'Must specify which end to play on' };
      }
      const openValue =
        end === 'left' ? this.state.leftEnd! : this.state.rightEnd!;
      if (owned.a !== openValue && owned.b !== openValue) {
        return { success: false, error: 'Tile does not match that end' };
      }
      const outer = owned.a === openValue ? owned.b : owned.a;
      hand.splice(idx, 1);
      if (end === 'left') {
        this.state.chain.unshift({ a: outer, b: openValue });
        this.state.leftEnd = outer;
      } else {
        this.state.chain.push({ a: openValue, b: outer });
        this.state.rightEnd = outer;
      }
    }

    this.state.passStreak = 0;

    if (hand.length === 0) {
      this.state.winner = playerId;
      this.state.winners = [playerId];
      this.state.currentPlayer = null;
      return { success: true };
    }

    this.advanceTurn();
    return { success: true };
  }

  pass(playerId: string): MoveResult {
    if (this.isOver()) return { success: false, error: 'Game is already over' };
    if (this.state.currentPlayer !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    const hand = this.state.hands[playerId];
    if (!hand) return { success: false, error: 'Not a player in this game' };

    if (hasLegalMove(hand, this.state.leftEnd, this.state.rightEnd)) {
      return { success: false, error: 'You have a legal move and cannot pass' };
    }

    this.state.passStreak += 1;
    if (this.state.passStreak >= this.state.players.length) {
      this.settleBlock();
      return { success: true };
    }

    this.advanceTurn();
    return { success: true };
  }

  private advanceTurn(): void {
    const { players, currentPlayer } = this.state;
    const idx = players.indexOf(currentPlayer!);
    this.state.currentPlayer = players[(idx + 1) % players.length]!;
  }

  // The game is blocked: nobody in a full round could play. Lowest total pip
  // count in hand wins, ties are shared rather than arbitrarily broken.
  private settleBlock(): void {
    const totals: Record<string, number> = {};
    for (const player of this.state.players) {
      totals[player] = pipTotal(this.state.hands[player] ?? []);
    }
    const lowest = Math.min(...Object.values(totals));
    this.state.pipTotals = totals;
    this.state.winners = this.state.players.filter((p) => totals[p] === lowest);
    this.state.blocked = true;
    this.state.currentPlayer = null;
  }
}

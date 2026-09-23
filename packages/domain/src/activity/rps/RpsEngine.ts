import {
  rpsPickSchema,
  type RoundResult,
  type RpsPick,
  type RpsPlayerId,
  type RpsRoundState,
} from '@marquinhos/contracts/activity/games/rockPaperScissors';

export interface RpsEngineConfig {
  bestOf?: number;
}

function determineWinner(p1Pick: RpsPick, p2Pick: RpsPick): RpsPlayerId | null {
  if (p1Pick === p2Pick) return null;

  const winMap: Record<RpsPick, RpsPick> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  return winMap[p1Pick] === p2Pick ? 'player1' : 'player2';
}

function isValidPick(pick: unknown): pick is RpsPick {
  return rpsPickSchema.safeParse(pick).success;
}

export class RpsEngine {
  private config: Required<RpsEngineConfig>;
  private currentRound = 1;
  private scores = { player1: 0, player2: 0 };
  private currentPicks: { player1?: RpsPick; player2?: RpsPick } = {};
  private history: RoundResult[] = [];

  constructor(config: RpsEngineConfig = {}) {
    this.config = {
      bestOf: config.bestOf ?? 3,
    };
  }

  submitPick(playerId: RpsPlayerId, pick: unknown): boolean {
    if (!isValidPick(pick)) return false;

    if (playerId === 'player1') {
      if (this.currentPicks.player1 !== undefined) return false;
      this.currentPicks.player1 = pick;
      return true;
    }

    if (playerId === 'player2') {
      if (this.currentPicks.player2 !== undefined) return false;
      this.currentPicks.player2 = pick;
      return true;
    }

    return false;
  }

  resolveRound(): RoundResult | null {
    if (
      this.currentPicks.player1 === undefined ||
      this.currentPicks.player2 === undefined
    ) {
      return null;
    }

    const winner = determineWinner(
      this.currentPicks.player1,
      this.currentPicks.player2,
    );

    if (winner === 'player1') {
      this.scores.player1++;
    } else if (winner === 'player2') {
      this.scores.player2++;
    }

    const result: RoundResult = {
      round: this.currentRound,
      p1Pick: this.currentPicks.player1,
      p2Pick: this.currentPicks.player2,
      winner,
    };

    this.history.push(result);
    // A tie replays the same round rather than consuming one of the
    // bestOf slots — otherwise the round counter can exceed bestOf
    // (e.g. "4/3") on a draw-heavy match.
    if (winner !== null) {
      this.currentRound++;
    }
    this.currentPicks = {};

    return result;
  }

  getRoundState(): RpsRoundState {
    const submitted: RpsPlayerId[] = [];
    if (this.currentPicks.player1 !== undefined) submitted.push('player1');
    if (this.currentPicks.player2 !== undefined) submitted.push('player2');

    return {
      round: this.currentRound,
      bestOf: this.config.bestOf,
      submitted,
      scores: { ...this.scores },
    };
  }

  getMatchWinner(): RpsPlayerId | null {
    const winsNeeded = Math.floor(this.config.bestOf / 2) + 1;
    if (this.scores.player1 >= winsNeeded) return 'player1';
    if (this.scores.player2 >= winsNeeded) return 'player2';
    return null;
  }

  getRoundHistory(): RoundResult[] {
    return [...this.history];
  }
}

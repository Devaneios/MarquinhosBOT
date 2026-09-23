export interface RoulettePlayer {
  userId: string;
  username: string;
  alive: boolean;
  survived: number;
}

export interface RouletteState {
  chambers: boolean[];
  currentChamber: number;
  totalChambers: number;
  bullets: number;
  survived: number;
  gameOver: boolean;
  result: 'survived' | 'dead' | null;
  players: RoulettePlayer[];
  currentPlayerIndex: number;
  mode: 'solo' | 'multiplayer';
}

export type RouletteAction =
  | { type: 'pull_trigger' }
  | { type: 'spin_chamber' };

export const ROULETTE_CHAMBER_COUNT = 6;

export function getRouletteBulletCount(randomValue: number): number {
  return Math.floor(randomValue * 2) + 1;
}

export function createRouletteChambers(
  totalChambers: number,
  bulletPositions: number[],
): boolean[] {
  const chambers = new Array(totalChambers).fill(false) as boolean[];
  for (const position of bulletPositions) {
    if (position >= 0 && position < totalChambers) chambers[position] = true;
  }
  return chambers;
}

export interface RouletteRewardBonus {
  rank: number;
  xpBonus: number;
  won: boolean;
}

export function createRouletteState(
  players: Array<Pick<RoulettePlayer, 'userId' | 'username'>>,
  bullets: number,
  chambers: boolean[],
): RouletteState {
  return {
    chambers: [...chambers],
    currentChamber: 0,
    totalChambers: chambers.length,
    bullets,
    survived: 0,
    gameOver: false,
    result: null,
    players: players.map((player) => ({ ...player, alive: true, survived: 0 })),
    currentPlayerIndex: 0,
    mode: players.length > 1 ? 'multiplayer' : 'solo',
  };
}

export function applyRouletteAction(
  state: RouletteState,
  userId: string,
  action: RouletteAction,
  spunChambers?: boolean[],
): { state: RouletteState; error?: 'not-your-turn' } {
  if (state.gameOver) return { state };
  if (
    state.mode === 'multiplayer' &&
    state.players[state.currentPlayerIndex]?.userId !== userId
  ) {
    return { state, error: 'not-your-turn' };
  }

  if (action.type === 'spin_chamber') {
    if (!spunChambers || spunChambers.length !== state.totalChambers) {
      return { state };
    }

    return {
      state: {
        ...state,
        chambers: [...spunChambers],
        currentChamber: 0,
        survived:
          state.mode === 'solo' ? Math.max(0, state.survived - 1) : state.survived,
      },
    };
  }

  const playerIndex = state.mode === 'solo' ? 0 : state.currentPlayerIndex;
  const players = state.players.map((player) => ({ ...player }));
  const player = players[playerIndex];
  if (!player) return { state };

  if (state.chambers[state.currentChamber]) {
    player.alive = false;
    return {
      state: {
        ...state,
        players,
        gameOver: true,
        result: state.mode === 'solo' ? 'dead' : null,
      },
    };
  }

  player.survived += 1;
  const survived = state.survived + 1;
  const currentChamber = (state.currentChamber + 1) % state.totalChambers;
  const gameOver = state.mode === 'solo' && currentChamber === 0;

  return {
    state: {
      ...state,
      players,
      survived,
      currentChamber,
      currentPlayerIndex:
        state.mode === 'multiplayer'
          ? (state.currentPlayerIndex + 1) % state.players.length
          : state.currentPlayerIndex,
      gameOver,
      result: gameOver ? 'survived' : null,
    },
  };
}

export function getRouletteScores(
  state: RouletteState,
): Record<string, number> {
  if (state.mode === 'solo') {
    return {
      [state.players[0]?.userId ?? '']:
        state.survived * 10 + (state.result === 'survived' ? 100 : 0),
    };
  }

  return Object.fromEntries(
    state.players.map((player) => [
      player.userId,
      player.survived * 15 + (player.alive ? 50 : 0),
    ]),
  );
}

export function getRouletteRewardBonuses(
  state: RouletteState,
): Record<string, RouletteRewardBonus> {
  if (state.mode === 'solo') {
    const player = state.players[0];
    return player
      ? {
          [player.userId]: {
            rank: 1,
            xpBonus: state.survived * 3 + (state.result === 'survived' ? 30 : 0),
            won: state.result === 'survived',
          },
        }
      : {};
  }

  const survivors = state.players.filter((player) => player.alive);
  return Object.fromEntries(
    state.players.map((player) => [
      player.userId,
      player.alive
        ? {
            rank: survivors.findIndex((survivor) => survivor.userId === player.userId) + 1,
            xpBonus: player.survived * 5 + (survivors.length === 1 ? 40 : 0),
            won: true,
          }
        : { rank: state.players.length, xpBonus: player.survived * 2, won: false },
    ]),
  );
}

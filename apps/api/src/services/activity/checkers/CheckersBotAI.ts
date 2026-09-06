import type {
  CheckersEngine,
  CheckersMove,
  CheckersState,
  Color,
  Position,
} from 'services/activity/checkers/CheckersEngine';

// A jump chain is mandatory move-by-move, so "prefer the biggest capture"
// means simulating each candidate jump forward on a scratch engine and
// counting how many hops it forces before the turn can pass — the engine
// itself only ever exposes one hop of legal moves at a time.
function chainCaptureCount(
  engine: CheckersEngine,
  color: Color,
  move: CheckersMove,
): number {
  const scratch = cloneViaState(engine);
  const result = scratch.move(color, move.from, move.to);
  if (!result.ok) return move.captures.length;
  let count = move.captures.length;
  let cursor: Position | null = result.mustContinue ?? null;
  while (cursor) {
    const next = scratch.getLegalMoves(color)[0];
    if (!next) break;
    const step = scratch.move(color, next.from, next.to);
    count += next.captures.length;
    cursor = step.mustContinue ?? null;
  }
  return count;
}

function cloneViaState(engine: CheckersEngine): CheckersEngine {
  const EngineCtor = engine.constructor as new () => CheckersEngine;
  const copy = new EngineCtor() as unknown as CheckersState;
  const state = engine.getState();
  copy.board = state.board.map((row) => [...row]);
  copy.turn = state.turn;
  copy.winner = state.winner;
  copy.mustContinueFrom = state.mustContinueFrom
    ? { ...state.mustContinueFrom }
    : null;
  return copy as unknown as CheckersEngine;
}

function isCenter(pos: Position): boolean {
  return pos.row >= 2 && pos.row <= 5 && pos.col >= 2 && pos.col <= 5;
}

// Heuristic used only when no capture is on the table: prefer advancing a
// king (kings are the strongest piece, so activating one outweighs a man
// shuffling forward), then prefer moves that centralize a piece, then
// prefer advancing toward promotion.
function scoreQuietMove(
  engine: CheckersEngine,
  color: Color,
  move: CheckersMove,
): number {
  const state = engine.getState();
  const piece = state.board[move.from.row]?.[move.from.col];
  let score = 0;
  if (piece?.king) score += 5;
  if (isCenter(move.to)) score += 2;
  const advance = color === 'black' ? move.to.row : 7 - move.to.row;
  score += advance * 0.1;
  return score;
}

// Prefers captures (longest chain first, kings among equal chains), else
// falls back to the quiet-move heuristic. No search beyond one heuristic
// pass — deliberately not a minimax, per the brief's "reasonable heuristic"
// bar for this bot.
export function chooseCheckersMove(
  engine: CheckersEngine,
  color: Color,
): CheckersMove | null {
  const legal = engine.getLegalMoves(color);
  const [firstMove] = legal;
  if (!firstMove) return null;

  const isCapture = firstMove.captures.length > 0;
  if (isCapture) {
    let best: CheckersMove = firstMove;
    let bestScore = -Infinity;
    for (const move of legal) {
      const chainLength = chainCaptureCount(engine, color, move);
      const state = engine.getState();
      const piece = state.board[move.from.row]?.[move.from.col];
      const score = chainLength * 10 + (piece?.king ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }

  let best: CheckersMove = firstMove;
  let bestScore = -Infinity;
  for (const move of legal) {
    const score = scoreQuietMove(engine, color, move);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

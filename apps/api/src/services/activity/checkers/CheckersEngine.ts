export type Color = 'black' | 'red';

export interface Position {
  row: number;
  col: number;
}

export interface Piece {
  color: Color;
  king: boolean;
}

export type Board = (Piece | null)[][];

export interface CheckersMove {
  from: Position;
  to: Position;
  // Length 0 for a simple move, length 1 for a jump — chains are applied one
  // hop at a time via move(), never as a pre-built multi-hop list, so a
  // single capture is all a legal move can ever carry.
  captures: Position[];
}

export interface CheckersState {
  board: Board;
  turn: Color;
  winner: Color | null;
  // Set right after a jump that leaves the same piece with another capture
  // available — the rules require it keep jumping before the turn can pass,
  // so every subsequent move() call must originate here until the chain
  // runs out.
  mustContinueFrom: Position | null;
}

export interface MoveResult {
  ok: boolean;
  error?: string;
  captured?: Position | null;
  promoted?: boolean;
  mustContinue?: Position | null;
  winner?: Color | null;
}

const SIZE = 8;

function inBounds(pos: Position): boolean {
  return pos.row >= 0 && pos.row < SIZE && pos.col >= 0 && pos.col < SIZE;
}

function samePos(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function opposite(color: Color): Color {
  return color === 'black' ? 'red' : 'black';
}

// Men only ever move/capture toward the opponent's back row; kings move in
// all four diagonal directions. Black starts at row 0 and advances toward
// row 7, red starts at row 7 and advances toward row 0.
function directionsFor(piece: Piece): Array<[number, number]> {
  if (piece.king) {
    return [
      [1, -1],
      [1, 1],
      [-1, -1],
      [-1, 1],
    ];
  }
  return piece.color === 'black'
    ? [
        [1, -1],
        [1, 1],
      ]
    : [
        [-1, -1],
        [-1, 1],
      ];
}

export class CheckersEngine {
  private readonly board: Board;
  private turn: Color = 'black';
  private winner: Color | null = null;
  private mustContinueFrom: Position | null = null;

  constructor() {
    this.board = this.initialBoard();
  }

  private initialBoard(): Board {
    const board: Board = Array.from({ length: SIZE }, () =>
      Array<Piece | null>(SIZE).fill(null),
    );
    for (let row = 0; row < SIZE; row++) {
      if (row === 3 || row === 4) continue;
      for (let col = 0; col < SIZE; col++) {
        if ((row + col) % 2 !== 1) continue;
        board[row]![col] = { color: row < 3 ? 'black' : 'red', king: false };
      }
    }
    return board;
  }

  getState(): CheckersState {
    return {
      board: this.board.map((row) => [...row]),
      turn: this.turn,
      winner: this.winner,
      mustContinueFrom: this.mustContinueFrom
        ? { ...this.mustContinueFrom }
        : null,
    };
  }

  forceWinner(color: Color) {
    if (this.winner) return;
    this.winner = color;
  }

  private pieceAt(pos: Position): Piece | null {
    return this.board[pos.row]![pos.col] ?? null;
  }

  private capturesFor(from: Position, piece: Piece): CheckersMove[] {
    const moves: CheckersMove[] = [];
    for (const [dr, dc] of directionsFor(piece)) {
      const mid: Position = { row: from.row + dr, col: from.col + dc };
      const to: Position = { row: from.row + 2 * dr, col: from.col + 2 * dc };
      if (!inBounds(to)) continue;
      const midPiece = this.pieceAt(mid);
      if (!midPiece || midPiece.color === piece.color) continue;
      if (this.pieceAt(to)) continue;
      moves.push({ from, to, captures: [mid] });
    }
    return moves;
  }

  private simpleMovesFor(from: Position, piece: Piece): CheckersMove[] {
    const moves: CheckersMove[] = [];
    for (const [dr, dc] of directionsFor(piece)) {
      const to: Position = { row: from.row + dr, col: from.col + dc };
      if (!inBounds(to)) continue;
      if (this.pieceAt(to)) continue;
      moves.push({ from, to, captures: [] });
    }
    return moves;
  }

  private piecesOf(color: Color): Position[] {
    const positions: Position[] = [];
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const piece = this.board[row]![col]!;
        if (piece && piece.color === color) positions.push({ row, col });
      }
    }
    return positions;
  }

  // Mandatory-jump rule: if any capture exists for `color`, only captures
  // are legal — non-capture moves are filtered out entirely, not merely
  // deprioritized. When mustContinueFrom is set, only that piece's captures
  // may be played, since a mid-chain jumper isn't allowed to stop and let
  // another piece move instead.
  getLegalMoves(color: Color = this.turn): CheckersMove[] {
    const origins =
      this.mustContinueFrom && color === this.turn
        ? [this.mustContinueFrom]
        : this.piecesOf(color);

    const captureMoves: CheckersMove[] = [];
    for (const pos of origins) {
      const piece = this.pieceAt(pos);
      if (!piece) continue;
      captureMoves.push(...this.capturesFor(pos, piece));
    }
    if (captureMoves.length > 0 || this.mustContinueFrom) return captureMoves;

    const simpleMoves: CheckersMove[] = [];
    for (const pos of origins) {
      const piece = this.pieceAt(pos);
      if (!piece) continue;
      simpleMoves.push(...this.simpleMovesFor(pos, piece));
    }
    return simpleMoves;
  }

  move(color: Color, from: Position, to: Position): MoveResult {
    if (this.winner) return { ok: false, error: 'game_over' };
    if (color !== this.turn) return { ok: false, error: 'not_your_turn' };

    const legal = this.getLegalMoves(color);
    const match = legal.find((m) => samePos(m.from, from) && samePos(m.to, to));
    if (!match) return { ok: false, error: 'illegal_move' };

    const piece = this.pieceAt(from)!;
    this.board[from.row]![from.col] = null;
    for (const captured of match.captures) {
      this.board[captured.row]![captured.col] = null;
    }

    const promotionRow = piece.color === 'black' ? SIZE - 1 : 0;
    const promoted = !piece.king && to.row === promotionRow;
    const movedPiece: Piece = promoted ? { ...piece, king: true } : piece;
    this.board[to.row]![to.col] = movedPiece;

    // A piece that just crowned stops its chain immediately, even if it
    // could technically still jump — the common American-rules convention,
    // and it avoids the newly-kinged piece bolting backward through
    // captures the same turn it was still a man.
    const canContinue =
      match.captures.length > 0 &&
      !promoted &&
      this.capturesFor(to, movedPiece).length > 0;

    if (canContinue) {
      this.mustContinueFrom = to;
      return {
        ok: true,
        captured: match.captures[0] ?? null,
        promoted,
        mustContinue: to,
        winner: null,
      };
    }

    this.mustContinueFrom = null;
    this.turn = opposite(color);

    if (this.piecesOf(this.turn).length === 0) {
      this.winner = color;
    } else if (this.getLegalMoves(this.turn).length === 0) {
      this.winner = color;
    }

    return {
      ok: true,
      captured: match.captures[0] ?? null,
      promoted,
      mustContinue: null,
      winner: this.winner,
    };
  }
}

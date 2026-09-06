export interface Cell {
  row: number;
  col: number;
}

export interface FoundWord {
  word: string;
  userId: string;
  start: Cell;
  end: Cell;
}

export interface InitPayload {
  size: number;
  grid: string[][];
  words: string[];
  found: FoundWord[];
  scores: Record<string, number>;
  deadline: number;
  ended: boolean;
}

export interface WordFoundPayload extends FoundWord {
  scores: Record<string, number>;
}

export interface SelectErrorPayload {
  message: string;
}

export interface GameOverPayload {
  reason: string;
  scores: Record<string, number>;
}

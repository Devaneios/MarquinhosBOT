export interface Cell {
  row: number;
  col: number;
}

export function snapToLine(start: Cell, raw: Cell): Cell {
  const dr = raw.row - start.row;
  const dc = raw.col - start.col;
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  if (ar === 0 && ac === 0) return start;

  let dirR = dr === 0 ? 0 : Math.sign(dr);
  let dirC = dc === 0 ? 0 : Math.sign(dc);
  let steps = Math.max(ar, ac);

  if (dirR !== 0 && dirC !== 0 && ar !== ac) {
    if (ar > ac) dirC = 0;
    else dirR = 0;
    steps = Math.max(ar, ac);
  }

  return { row: start.row + dirR * steps, col: start.col + dirC * steps };
}

import { BOARD_SIZE, SHIP_SIZES, type PendingShip } from './types';

export function cellsFor(ship: PendingShip): { x: number; y: number }[] {
  const size = SHIP_SIZES[ship.type];
  return Array.from({ length: size }, (_, i) => ({
    x: ship.orientation === 'horizontal' ? ship.x + i : ship.x,
    y: ship.orientation === 'horizontal' ? ship.y : ship.y + i,
  }));
}

export function isValidPlacement(
  ship: PendingShip,
  others: PendingShip[],
): boolean {
  const cells = cellsFor(ship);
  if (
    cells.some(
      (cell) =>
        cell.x < 0 ||
        cell.x >= BOARD_SIZE ||
        cell.y < 0 ||
        cell.y >= BOARD_SIZE,
    )
  ) {
    return false;
  }
  const occupied = new Set(
    others.flatMap((other) =>
      cellsFor(other).map((cell) => `${cell.x},${cell.y}`),
    ),
  );
  return cells.every((cell) => !occupied.has(`${cell.x},${cell.y}`));
}

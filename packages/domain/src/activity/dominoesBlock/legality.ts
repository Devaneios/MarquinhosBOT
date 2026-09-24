import type {
  ChainEnd,
  Tile,
} from '@marquinhos/contracts/activity/games/dominoesBlock';

export function tileMatches(candidate: Tile, tile: Tile): boolean {
  return (
    (candidate.a === tile.a && candidate.b === tile.b) ||
    (candidate.a === tile.b && candidate.b === tile.a)
  );
}

// Which end(s) of the open chain a hand tile could legally land on, purely
// from the client's own copy of the state — used to enable/disable tiles and
// to skip the end-picker when only one end accepts the tile. The server is
// the actual authority; this is only ever a UI convenience.
export function legalEndsFor(
  tile: Tile,
  leftEnd: number | null,
  rightEnd: number | null,
): ChainEnd[] {
  if (leftEnd === null || rightEnd === null) return [];
  const ends: ChainEnd[] = [];
  if (tile.a === leftEnd || tile.b === leftEnd) ends.push('left');
  if (tile.a === rightEnd || tile.b === rightEnd) ends.push('right');
  return ends;
}

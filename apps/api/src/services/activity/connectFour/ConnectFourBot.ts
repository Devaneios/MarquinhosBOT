import type {
  ConnectFourEngine,
  Disc,
} from 'services/activity/connectFour/ConnectFourEngine';

// Center-out preference: a center disc participates in more potential
// 4-in-a-row lines than an edge one, so absent a forcing move this is the
// strongest cheap heuristic without a full minimax search.
const COLUMN_PREFERENCE = [3, 2, 4, 1, 5, 0, 6];

export class ConnectFourBot {
  constructor(private readonly side: Disc) {}

  private get opponent(): Disc {
    return this.side === 'p1' ? 'p2' : 'p1';
  }

  chooseColumn(engine: ConnectFourEngine): number | null {
    const valid = new Set(engine.validColumns());
    if (valid.size === 0) return null;

    for (const col of COLUMN_PREFERENCE) {
      if (valid.has(col) && engine.wouldWin(col, this.side)) return col;
    }

    for (const col of COLUMN_PREFERENCE) {
      if (valid.has(col) && engine.wouldWin(col, this.opponent)) return col;
    }

    for (const col of COLUMN_PREFERENCE) {
      if (valid.has(col)) return col;
    }

    return null;
  }
}

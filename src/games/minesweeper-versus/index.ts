import type { GameDescriptor } from '../registry';
import { minesweeperVersusRoutes } from './minesweeperVersusRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'minesweeper-versus',
  status: 'PLAY',
  routes: minesweeperVersusRoutes,
};

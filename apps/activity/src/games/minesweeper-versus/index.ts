import type { GameDescriptor } from '../GameDescriptor';
import { minesweeperVersusRoutes } from './minesweeperVersusRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'minesweeper-versus',
  status: 'PLAY',
  routes: minesweeperVersusRoutes,
};
